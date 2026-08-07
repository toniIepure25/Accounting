import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDraftDocument } from '@gr/application';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { type Migration, type SqlExecutor, migrate, withExecutor } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { ruleazaComanda } from './commands.js';
import { creeazaServerDb } from './db.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-24T09:00:00.000Z';

interface Fx {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  gestiuneId: string;
}

async function setup(): Promise<Fx> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  const repos = withExecutor(exec);
  const p = await repos.produse.create({
    cod: 'X',
    denumire: 'Marfa',
    codCategorieFiscala: 'standard',
  });
  const partener = await repos.parteneri.create({ tip: 'client', denumire: 'Client' });
  const g = await repos.gestiuni.create({ cod: 'G', denumire: 'Depozit' });
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, NULL, 100, 100000, 1000, ?)`,
    [g.id, p.id, NOW],
  );
  return { exec, produsId: p.id, partenerId: partener.id, gestiuneId: g.id };
}

async function draft(fx: Fx): Promise<string> {
  const d: Document = DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'factura_vanzare',
    serie: 'FV',
    data: '2025-09-10',
    partenerId: fx.partenerId,
    gestiuneId: fx.gestiuneId,
    stare: 'ciorna',
  });
  const l = DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId: d.id,
    produsId: fx.produsId,
    denumire: 'Marfa',
    cantitate: 2,
    pretUnitarBani: 5000,
    cotaTvaProcent: 21,
  });
  await createDraftDocument({ exec: fx.exec, now: () => NOW }, { document: d, linii: [l] });
  return d.id;
}

describe('ruleazaComanda — endpoint-uri de comenzi autoritare (Faza 15)', () => {
  let fx: Fx;
  beforeEach(async () => {
    fx = await setup();
  });

  it('post-document posteaza si intoarce 200 + documentul postat; motorul a scris jurnal', async () => {
    const id = await draft(fx);
    const rez = await ruleazaComanda(fx.exec, 'post-document', { documentId: id }, 'tester');
    expect(rez.status).toBe(200);
    expect(rez.body.document.stare).toBe('validat');
    const [j] = await fx.exec.select<{ n: number }>('SELECT COUNT(*) AS n FROM journal_lines');
    expect(Number(j!.n)).toBeGreaterThan(0);
  });

  it('lipsa documentId => 400', async () => {
    const rez = await ruleazaComanda(fx.exec, 'post-document', {}, 'tester');
    expect(rez.status).toBe(400);
  });

  it('document inexistent => 404', async () => {
    const rez = await ruleazaComanda(
      fx.exec,
      'post-document',
      { documentId: crypto.randomUUID() },
      'tester',
    );
    expect(rez.status).toBe(404);
  });

  it('a doua postare => 409 (tranzitie nepermisa)', async () => {
    const id = await draft(fx);
    await ruleazaComanda(fx.exec, 'post-document', { documentId: id }, 'tester');
    const rez = await ruleazaComanda(fx.exec, 'post-document', { documentId: id }, 'tester');
    expect(rez.status).toBe(409);
  });

  it('comanda necunoscuta => 404', async () => {
    const rez = await ruleazaComanda(fx.exec, 'nu-exista', { documentId: 'x' }, 'tester');
    expect(rez.status).toBe(404);
  });
});

describe('creeazaServerDb — modul demo ruleaza pe SQLite real, cu date seed', () => {
  it('fara DATABASE_URL: exec real + date demo insertate', async () => {
    const anterior = process.env.DATABASE_URL;
    process.env.DATABASE_URL = undefined;
    // biome-ignore lint/performance/noDelete: asiguram absenta variabilei pentru test
    delete process.env.DATABASE_URL;
    try {
      const db = await creeazaServerDb();
      expect(db.persistent).toBe(false);
      // exec real: tabelele exista si datele demo sunt inserate.
      const firme = await db.exec.select<{ n: number }>('SELECT COUNT(*) AS n FROM firme');
      expect(Number(firme[0]!.n)).toBeGreaterThan(0);
      const produse = await db.provider.produse.list();
      expect(produse.length).toBeGreaterThan(0);
    } finally {
      if (anterior !== undefined) process.env.DATABASE_URL = anterior;
    }
  });
});
