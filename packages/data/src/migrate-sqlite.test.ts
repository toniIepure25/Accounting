import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { type Migration, migrate } from './migrate.js';

// packages/data/src -> repo root -> db/migrations
const DIR_MIGRATII = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'db',
  'migrations',
);

function incarcaMigratii(): Migration[] {
  return readdirSync(DIR_MIGRATII)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.sql$/, ''),
      sql: readFileSync(join(DIR_MIGRATII, f), 'utf8'),
    }));
}

function dbNou() {
  const db = new Database(':memory:');
  return { db, exec: fromBetterSqlite(db) };
}

describe('migratii pe SQLite REAL (better-sqlite3)', () => {
  it('ruleaza toate migratiile pe o baza curata, fara sa piarda prima instructiune', async () => {
    const { db, exec } = dbNou();
    const aplicate = await migrate(exec, incarcaMigratii());
    expect(aplicate.length).toBeGreaterThanOrEqual(12);

    // Regresie pentru bug-ul de splitter: `parteneri` e definit in 0001, care
    // incepe cu comentarii — inainte de fix, prima instructiune era aruncata.
    const tabele = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ['parteneri', 'produse', 'documente', 'documente_linii', 'tax_rules']) {
      expect(tabele).toContain(t);
    }
    db.close();
  });

  it('seed-ul tax_rules e prezent si corect (tranzitia RO 2025)', async () => {
    const { db, exec } = dbNou();
    await migrate(exec, incarcaMigratii());

    const toate = db.prepare('SELECT * FROM tax_rules ORDER BY id').all() as Array<{
      code: string;
      rate_basis_points: number;
      valid_from: string;
      valid_to: string | null;
      status: string;
    }>;
    expect(toate).toHaveLength(7);

    const standardVechi = toate.find((r) => r.code === 'standard' && r.valid_to !== null);
    const standardNou = toate.find((r) => r.code === 'standard' && r.valid_to === null);
    expect(standardVechi?.rate_basis_points).toBe(1900); // 19%
    expect(standardNou?.rate_basis_points).toBe(2100); // 21%
    expect(standardNou?.valid_from).toBe('2025-08-01');
    db.close();
  });

  it('indexul unic partial impiedica doua reguli APROBATE cu aceeasi (categorie, data start)', async () => {
    const { db, exec } = dbNou();
    await migrate(exec, incarcaMigratii());
    // O a doua regula 'standard' aprobata cu acelasi valid_from = conflict.
    expect(() =>
      db
        .prepare(
          `INSERT INTO tax_rules (id, jurisdiction, tax_type, code, name, category, rate_basis_points, valid_from, valid_to, legal_reference, status, version, created_at)
           VALUES ('dup', 'RO', 'VAT', 'standard', 'dup', 'standard', 2500, '2025-08-01', NULL, 'x', 'approved', 1, '2026-01-01')`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it('respinge un interval malformat (valid_to <= valid_from) prin CHECK', async () => {
    const { db, exec } = dbNou();
    await migrate(exec, incarcaMigratii());
    expect(() =>
      db
        .prepare(
          `INSERT INTO tax_rules (id, jurisdiction, tax_type, code, name, category, rate_basis_points, valid_from, valid_to, legal_reference, status, version, created_at)
           VALUES ('bad', 'RO', 'VAT', 'x', 'x', 'standard', 100, '2025-08-01', '2025-01-01', 'x', 'approved', 1, '2026-01-01')`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it('backfill produse: cota legacy -> categorie fiscala, necunoscut -> necategorizat', async () => {
    const { db, exec } = dbNou();
    const toate = incarcaMigratii();
    // Aplica pana la 0011 inclusiv, insereaza produse cu cote legacy, apoi 0012.
    const panaLa0011 = toate.filter((m) => m.id <= '0011_tax_rules');
    await migrate(exec, panaLa0011);
    const ins = db.prepare(
      "INSERT INTO produse (id, cod, denumire, cota_tva_procent, updated_at) VALUES (?, ?, ?, ?, '')",
    );
    ins.run('p19', 'P19', 'standard', 19);
    ins.run('p9', 'P9', 'redus9', 9);
    ins.run('p5', 'P5', 'redus5', 5);
    ins.run('p0', 'P0', 'scutit', 0);
    ins.run('px', 'PX', 'ciudat', 7);

    await migrate(exec, toate); // aplica doar 0012 acum

    const cat = (id: string) =>
      (
        db.prepare('SELECT cod_categorie_fiscala AS c FROM produse WHERE id = ?').get(id) as {
          c: string;
        }
      ).c;
    expect(cat('p19')).toBe('standard');
    expect(cat('p9')).toBe('redus_9');
    expect(cat('p5')).toBe('redus_5');
    expect(cat('p0')).toBe('scutit');
    expect(cat('px')).toBe('necategorizat');
    db.close();
  });

  it('este idempotent: a doua rulare nu mai aplica nimic', async () => {
    const { db, exec } = dbNou();
    const m = incarcaMigratii();
    await migrate(exec, m);
    const dinNou = await migrate(exec, m);
    expect(dinNou).toEqual([]);
    db.close();
  });
});
