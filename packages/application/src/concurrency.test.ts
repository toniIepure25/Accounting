import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import {
  ConstraintViolationError,
  type Migration,
  type SqlExecutor,
  migrate,
  withExecutor,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { IdempotencyConflictError } from './idempotency.js';
import { createDraftDocument, updateDraftDocument } from './lifecycle.js';
import { ConflictOptimistaError } from './locking.js';
import { postDocument } from './post-document.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-01T09:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  gestiuneId: string;
}

async function setup(): Promise<Fixture> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  const repos = withExecutor(exec);
  const p = await repos.produse.create({
    cod: 'DULAP',
    denumire: 'Dulap',
    codCategorieFiscala: 'standard',
  });
  const partener = await repos.parteneri.create({ tip: 'client', denumire: 'Client SRL' });
  const gestiune = await repos.gestiuni.create({ cod: 'G1', denumire: 'Gestiune 1' });
  // Seed de stoc: aceste teste vizeaza numerotarea/idempotenta, nu stocul.
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, NULL, 100000, 100000000, 1000, ?)`,
    [gestiune.id, p.id, NOW],
  );
  return { exec, produsId: p.id, partenerId: partener.id, gestiuneId: gestiune.id };
}

// firma_id fix, non-null: indexul unic de numerotare trateaza NULL-urile ca
// distincte (SQL standard), deci constrangerea protejeaza doar randurile cu firma
// setata — documentele noi. Documentele legacy fara firma raman neprotejate
// (mostenit din scoparea multi-firma incompleta), dar alocatorul le previne oricum.
const FIRMA_ID = '00000000-0000-4000-8000-000000000001';

function docNou(fx: Fixture, over: Partial<Document> = {}): Document {
  return DocumentSchema.parse({
    id: crypto.randomUUID(),
    firmaId: FIRMA_ID,
    tip: 'factura_vanzare',
    data: '2025-09-10',
    serie: 'FV',
    partenerId: fx.partenerId,
    gestiuneId: fx.gestiuneId,
    stare: 'ciorna',
    ...over,
  });
}

function linieNoua(documentId: string, produsId: string) {
  return DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId,
    produsId,
    denumire: 'Dulap',
    cantitate: 1,
    pretUnitarBani: 10000,
    cotaTvaProcent: 21,
  });
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

async function draft(fx: Fixture): Promise<string> {
  const d = docNou(fx);
  await createDraftDocument(deps(fx), { document: d, linii: [linieNoua(d.id, fx.produsId)] });
  return d.id;
}

describe('P4-R1 — blocare optimista (version / expectedVersion)', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('draftul nou porneste la versiunea 1; o modificare o incrementeaza', async () => {
    const id = await draft(fx);
    expect((await withExecutor(fx.exec).documente.getById(id))?.version).toBe(1);
    await updateDraftDocument(deps(fx), id, { document: { observatii: 'x' } });
    expect((await withExecutor(fx.exec).documente.getById(id))?.version).toBe(2);
  });

  it('o versiune asteptata invechita este respinsa (ConflictOptimistaError)', async () => {
    const id = await draft(fx);
    await updateDraftDocument(deps(fx), id, { document: { observatii: 'prima' } }); // -> v2
    await expect(
      updateDraftDocument(deps(fx), id, { document: { observatii: 'a doua' }, expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(ConflictOptimistaError);
    // versiunea corecta trece
    await expect(
      updateDraftDocument(deps(fx), id, { document: { observatii: 'a doua' }, expectedVersion: 2 }),
    ).resolves.toBeDefined();
  });

  it('postarea cu versiune asteptata gresita este respinsa; documentul ramane ciorna', async () => {
    const id = await draft(fx);
    await expect(postDocument(deps(fx), id, { expectedVersion: 99 })).rejects.toBeInstanceOf(
      ConflictOptimistaError,
    );
    expect((await withExecutor(fx.exec).documente.getById(id))?.stare).toBe('ciorna');
  });

  it('postarea incrementeaza versiunea', async () => {
    const id = await draft(fx);
    const rez = await postDocument(deps(fx), id, { expectedVersion: 1 });
    expect(rez.document.version).toBe(2);
  });
});

describe('P4-R2 — idempotenta postarii', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('reincercarea cu aceeasi cheie NU re-posteaza si NU aloca un al doilea numar', async () => {
    const id = await draft(fx);
    const prima = await postDocument(deps(fx), id, { idempotencyKey: 'k1' });
    expect(prima.document.numar).toBe(1);

    // A doua oara cu aceeasi cheie: raspuns memorat, fara re-executie.
    const adoua = await postDocument(deps(fx), id, { idempotencyKey: 'k1' });
    expect(adoua.document.numar).toBe(1);
    expect(adoua.document.cod).toBe(prima.document.cod);

    // Un singur numar alocat in total.
    const serii = await fx.exec.select<{ ultimul_numar: number }>(
      'SELECT ultimul_numar FROM serii_documente',
    );
    expect(Number(serii[0]!.ultimul_numar)).toBe(1);
    const chei = await fx.exec.select<{ n: number }>('SELECT COUNT(*) AS n FROM idempotency_keys');
    expect(Number(chei[0]!.n)).toBe(1);
  });

  it('fara cheie de idempotenta, o a doua postare esueaza (tranzitie nepermisa)', async () => {
    const id = await draft(fx);
    await postDocument(deps(fx), id);
    await expect(postDocument(deps(fx), id)).rejects.toBeTruthy();
  });

  it('aceeasi cheie pentru o cerere diferita => IdempotencyConflictError', async () => {
    const id1 = await draft(fx);
    const id2 = await draft(fx);
    await postDocument(deps(fx), id1, { idempotencyKey: 'shared' });
    await expect(postDocument(deps(fx), id2, { idempotencyKey: 'shared' })).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });
});

describe('P4-R3 — constrangere unica de numerotare (backstop DB)', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('doua postari distincte primesc numere consecutive, fara coliziune', async () => {
    const id1 = await draft(fx);
    const id2 = await draft(fx);
    const r1 = await postDocument(deps(fx), id1);
    const r2 = await postDocument(deps(fx), id2);
    expect(r1.document.numar).toBe(1);
    expect(r2.document.numar).toBe(2);
  });

  it('indexul unic respinge un al doilea document cu acelasi (firma, tip, an, serie, numar)', async () => {
    const id = await draft(fx);
    await postDocument(deps(fx), id); // FV numar 1, an 2025

    // Inserare directa a unui duplicat de numar (ocolind alocatorul) => constrangere.
    // Scrierile reale trec printr-o tranzactie, unde erorile driverului se
    // normalizeaza in taxonomia stabila (ConstraintViolationError).
    const dupl = docNou(fx, { numar: 1, cod: 'FV-DUP', stare: 'validat' });
    await expect(
      fx.exec.transaction({}, async (tx) => {
        await withExecutor(tx).documente.create(dupl);
      }),
    ).rejects.toBeInstanceOf(ConstraintViolationError);
  });

  it('ciornele (numar 0) nu se ciocnesc intre ele pe indexul partial', async () => {
    await draft(fx);
    await draft(fx);
    await draft(fx);
    const n = await fx.exec.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM documente WHERE numar = 0',
    );
    expect(Number(n[0]!.n)).toBe(3);
  });
});
