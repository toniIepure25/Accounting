import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { migrate } from './migrate.js';
import { MIGRATII_INCORPORATE } from './migratii-incorporate.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');

function deLaDisc() {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

describe('MIGRATII_INCORPORATE — bundle sincron cu discul', () => {
  it('e IDENTIC cu db/migrations/*.sql (altfel: regenereaza bundle-ul)', () => {
    // Daca acest test pica: `node scripts/genereaza-migratii-incorporate.mjs`.
    expect(MIGRATII_INCORPORATE).toEqual(deLaDisc());
  });

  it('se aplica pe o baza goala si creeaza schema completa (incl. registrele)', async () => {
    const exec = fromBetterSqlite(new Database(':memory:'));
    const aplicate = await migrate(exec, MIGRATII_INCORPORATE);
    expect(aplicate.length).toBe(MIGRATII_INCORPORATE.length);
    for (const t of ['documente', 'journal_lines', 'stock_ledger_entries', 'fiscal_events']) {
      expect(await exec.select(`SELECT count(*) AS n FROM "${t}"`)).toEqual([{ n: 0 }]);
    }
  });
});
