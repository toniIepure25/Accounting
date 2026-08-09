import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSqlRepository } from '../generic-sql-repo.js';
import { type Migration, migrate } from '../migrate.js';
import type { SqlExecutor } from '../sql-executor.js';
import { ConstraintViolationError, TransactionUsageError } from '../tx-errors.js';
import { fromSqlJs } from './sql-js.js';

const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve('sql.js'));

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'db',
  'migrations',
);
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

// biome-ignore lint/suspicious/noExplicitAny: SqlJsStatic e initializat o data
let SQL: any;
beforeAll(async () => {
  SQL = await initSqlJs({ locateFile: (f: string) => join(DIST, f) });
});
const exec = (): SqlExecutor => fromSqlJs(new SQL.Database());

describe('fromSqlJs — SqlExecutor peste SQLite WASM (paritate cu better-sqlite3)', () => {
  it('execute + select cu parametri (rowsAffected, lastInsertId, read-your-writes)', async () => {
    const e = exec();
    await e.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
    const r = await e.execute('INSERT INTO t (v) VALUES (?)', ['a']);
    expect(r.rowsAffected).toBe(1);
    expect(r.lastInsertId).toBe(1);
    const randuri = await e.select<{ id: number; v: string }>('SELECT * FROM t WHERE v = ?', ['a']);
    expect(randuri).toEqual([{ id: 1, v: 'a' }]);
  });

  it('tranzactie: commit persista, rollback pe eroare lasa baza neatinsa (atomic)', async () => {
    const e = exec();
    await e.execute('CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT NOT NULL)');
    await e.transaction({}, async (tx) => {
      await tx.execute('INSERT INTO t VALUES (?, ?)', ['1', 'a']);
    });
    expect(await e.select('SELECT * FROM t')).toHaveLength(1);

    await expect(
      e.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t VALUES (?, ?)', ['2', 'b']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // Randul '2' NU trebuie sa existe (rollback).
    expect(await e.select('SELECT * FROM t')).toHaveLength(1);
  });

  it('nesting prin SAVEPOINT: rollback-ul interior nu strica tranzactia exterioara', async () => {
    const e = exec();
    await e.execute('CREATE TABLE t (id TEXT PRIMARY KEY)');
    await e.transaction({}, async (tx) => {
      await tx.execute('INSERT INTO t VALUES (?)', ['ext']);
      await expect(
        tx.transaction({}, async (tx2) => {
          await tx2.execute('INSERT INTO t VALUES (?)', ['int']);
          throw new Error('interior');
        }),
      ).rejects.toThrow('interior');
      // Exteriorul continua; scrierea sa se pastreaza, cea interioara nu.
    });
    const ids = (await e.select<{ id: string }>('SELECT id FROM t')).map((r) => r.id);
    expect(ids).toEqual(['ext']);
  });

  it('executorul legat de tranzactie arunca dupa terminarea ei', async () => {
    const e = exec();
    let scapat: SqlExecutor | null = null;
    await e.transaction({}, async (tx) => {
      scapat = tx;
    });
    await expect(scapat!.select('SELECT 1')).rejects.toBeInstanceOf(TransactionUsageError);
  });

  it('violarea unei constrangeri UNIQUE devine ConstraintViolationError', async () => {
    const e = exec();
    await e.execute('CREATE TABLE t (id TEXT PRIMARY KEY)');
    await e.execute('INSERT INTO t VALUES (?)', ['x']);
    await expect(e.execute('INSERT INTO t VALUES (?)', ['x'])).rejects.toBeInstanceOf(
      ConstraintViolationError,
    );
  });

  it('schema REALA (toate migratiile) se aplica pe SQLite WASM', async () => {
    const e = exec();
    const aplicate = await migrate(e, migratii());
    expect(aplicate.length).toBeGreaterThan(10);
    // Tabelele-cheie (incl. registrele) exista si sunt interogabile.
    for (const t of ['documente', 'journal_lines', 'stock_ledger_entries', 'fiscal_events']) {
      expect(await e.select(`SELECT count(*) AS n FROM "${t}"`)).toEqual([{ n: 0 }]);
    }
  });

  it('un repository generic peste tx face read-your-writes + rollback atomic', async () => {
    const Fx = z.object({ id: z.string(), v: z.string() });
    const e = exec();
    await e.execute('CREATE TABLE fx (id TEXT PRIMARY KEY, v TEXT NOT NULL)');
    await e.transaction({}, async (tx) => {
      const repo = createSqlRepository<z.infer<typeof Fx>>(tx, 'fx', Fx);
      await repo.create({ id: '1', v: 'a' });
      expect(await repo.list()).toHaveLength(1);
    });
    expect(await createSqlRepository<z.infer<typeof Fx>>(e, 'fx', Fx).list()).toHaveLength(1);
  });
});
