import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  getSubmisieDupaDocument,
  migrate,
  withExecutor,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EFacturaNepermisaError,
  incarcaEfactura,
  inregistreazaRaspunsSpv,
  pregatesteEfactura,
} from './efactura.js';
import { createDraftDocument } from './lifecycle.js';
import { postDocument } from './post-document.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-16T09:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  firmaId: string;
  g1: string;
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
  const partener = await repos.parteneri.create({
    tip: 'client',
    denumire: 'Client SRL',
    cui: 'RO12345678',
    localitate: 'Bucuresti',
    judet: 'Bucuresti',
    adresa: 'Str. Exemplu 1',
  });
  const firma = await repos.firme.create({
    cod: 'F1',
    denumire: 'Furnizor SRL',
    cui: 'RO87654321',
    localitate: 'Cluj',
    judet: 'Cluj',
    adresa: 'Bd. Test 2',
  });
  const g1 = await repos.gestiuni.create({ cod: 'G1', denumire: 'Depozit' });
  // stoc de deschidere ca vanzarea sa treaca (politica implicita interzice sub-zero)
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, NULL, 1000, 1000000, 1000, ?)`,
    [g1.id, p.id, NOW],
  );
  return { exec, produsId: p.id, partenerId: partener.id, firmaId: firma.id, g1: g1.id };
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

async function facturaVanzarePostata(fx: Fixture, over: Partial<Document> = {}): Promise<string> {
  const d = DocumentSchema.parse({
    id: crypto.randomUUID(),
    firmaId: fx.firmaId,
    tip: 'factura_vanzare',
    serie: 'FV',
    data: '2025-09-10',
    partenerId: fx.partenerId,
    gestiuneId: fx.g1,
    stare: 'ciorna',
    ...over,
  });
  const l = DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId: d.id,
    produsId: fx.produsId,
    denumire: 'Dulap',
    cantitate: 2,
    pretUnitarBani: 10000,
    cotaTvaProcent: 21,
  });
  await createDraftDocument(deps(fx), { document: d, linii: [l] });
  await postDocument(deps(fx), d.id);
  return d.id;
}

describe('P8 — workflow e-Factura SPV durabil', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('pregateste: genereaza XML valid structural si persista in starea validat', async () => {
    const docId = await facturaVanzarePostata(fx);
    const sub = await pregatesteEfactura(deps(fx), docId);
    expect(sub.stare).toBe('validat');
    expect(sub.xml).toContain('<Invoice');
    expect(sub.xml).toContain('CIUS-RO');
    expect(sub.xml).toContain('RO87654321'); // CUI vanzator
  });

  it('pregatirea e idempotenta: a doua oara intoarce aceeasi submisie', async () => {
    const docId = await facturaVanzarePostata(fx);
    const a = await pregatesteEfactura(deps(fx), docId);
    const b = await pregatesteEfactura(deps(fx), docId);
    expect(b.id).toBe(a.id);
    const n = await fx.exec.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM efactura_submissions WHERE document_id = ?',
      [docId],
    );
    expect(Number(n[0]!.n)).toBe(1);
  });

  it('incarcarea foloseste uploader-ul injectat si trece in starea incarcat', async () => {
    const docId = await facturaVanzarePostata(fx);
    await pregatesteEfactura(deps(fx), docId);
    const uploader = vi.fn().mockResolvedValue({ uploadIndex: 'SPV-123', mesaj: 'ok' });
    const sub = await incarcaEfactura(deps(fx), docId, { uploader });
    expect(uploader).toHaveBeenCalledTimes(1);
    expect(sub.stare).toBe('incarcat');
    expect(sub.uploadIndex).toBe('SPV-123');
  });

  it('IDEMPOTENT: o a doua incarcare NU re-trimite la SPV', async () => {
    const docId = await facturaVanzarePostata(fx);
    await pregatesteEfactura(deps(fx), docId);
    const uploader = vi.fn().mockResolvedValue({ uploadIndex: 'SPV-1' });
    await incarcaEfactura(deps(fx), docId, { uploader });
    await incarcaEfactura(deps(fx), docId, { uploader }); // retry
    expect(uploader).toHaveBeenCalledTimes(1); // o singura trimitere
  });

  it('esec de transport => stare eroare (reincercabil), apoi incarcare reusita', async () => {
    const docId = await facturaVanzarePostata(fx);
    await pregatesteEfactura(deps(fx), docId);
    const uploaderRau = vi.fn().mockRejectedValue(new Error('retea cazuta'));
    await expect(incarcaEfactura(deps(fx), docId, { uploader: uploaderRau })).rejects.toThrow(
      'retea cazuta',
    );
    expect((await getSubmisieDupaDocument(fx.exec, docId))?.stare).toBe('eroare');

    const uploaderBun = vi.fn().mockResolvedValue({ uploadIndex: 'SPV-9' });
    const sub = await incarcaEfactura(deps(fx), docId, { uploader: uploaderBun });
    expect(sub.stare).toBe('incarcat');
  });

  it('raspunsul SPV: acceptare seteaza id de descarcare; respingerea e finala', async () => {
    const docId = await facturaVanzarePostata(fx);
    await pregatesteEfactura(deps(fx), docId);
    await incarcaEfactura(deps(fx), docId, {
      uploader: vi.fn().mockResolvedValue({ uploadIndex: 'SPV-5' }),
    });
    const acc = await inregistreazaRaspunsSpv(deps(fx), docId, {
      acceptat: true,
      idDescarcare: 'DL-77',
    });
    expect(acc.stare).toBe('acceptat');
    expect(acc.idDescarcare).toBe('DL-77');
  });

  it('respinge e-Factura pentru un document care nu e factura de vanzare', async () => {
    const docId = await facturaVanzarePostata(fx, { tip: 'factura_vanzare' });
    // un NIR nu poate emite e-Factura
    const nirId = crypto.randomUUID();
    const nir = DocumentSchema.parse({
      id: nirId,
      firmaId: fx.firmaId,
      tip: 'receptie_furnizor',
      serie: 'NIR',
      data: '2025-09-10',
      partenerId: fx.partenerId,
      gestiuneId: fx.g1,
      stare: 'ciorna',
    });
    await createDraftDocument(deps(fx), {
      document: nir,
      linii: [
        DocumentLinieSchema.parse({
          id: crypto.randomUUID(),
          documentId: nirId,
          produsId: fx.produsId,
          denumire: 'Dulap',
          cantitate: 1,
          pretUnitarBani: 1000,
          cotaTvaProcent: 21,
        }),
      ],
    });
    await postDocument(deps(fx), nirId);
    await expect(pregatesteEfactura(deps(fx), nirId)).rejects.toBeInstanceOf(
      EFacturaNepermisaError,
    );
    expect(docId).toBeTruthy();
  });
});
