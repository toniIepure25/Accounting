import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { createSqlRepository } from './generic-sql-repo.js';
import { type Migration, migrate } from './migrate.js';
import { withExecutor } from './provider.js';
import type { SqlExecutor } from './sql-executor.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

// ---------------------------------------------------------------------------
// B5 — repository-urile legate de tranzactie folosesc acelasi executor.
// ---------------------------------------------------------------------------
describe('legarea repository-urilor la tranzactie (P2-R5)', () => {
  const Fx = z.object({ id: z.string(), v: z.string() });
  type Fixture = z.infer<typeof Fx>;

  it('un repository generic peste `tx` vede propriile scrieri (read-your-writes)', async () => {
    const exec = fromBetterSqlite(new Database(':memory:'));
    await exec.execute('CREATE TABLE fx (id TEXT PRIMARY KEY, v TEXT NOT NULL)');
    await exec.transaction({}, async (tx) => {
      const repo = createSqlRepository<Fixture>(tx, 'fx', Fx);
      await repo.create({ id: '1', v: 'a' });
      expect(await repo.list()).toHaveLength(1);
    });
    const root = createSqlRepository<Fixture>(exec, 'fx', Fx);
    expect(await root.list()).toHaveLength(1);
  });

  it('doua repo-uri legate de aceeasi tranzactie fac rollback ATOMIC', async () => {
    const exec = fromBetterSqlite(new Database(':memory:'));
    await exec.execute('CREATE TABLE fa (id TEXT PRIMARY KEY, v TEXT)');
    await exec.execute('CREATE TABLE fb (id TEXT PRIMARY KEY, v TEXT)');
    await exec
      .transaction({}, async (tx) => {
        await createSqlRepository<Fixture>(tx, 'fa', Fx).create({ id: '1', v: 'a' });
        await createSqlRepository<Fixture>(tx, 'fb', Fx).create({ id: '1', v: 'b' });
        throw new Error('abort — ambele trebuie sa dispara');
      })
      .catch(() => {});
    expect(await createSqlRepository<Fixture>(exec, 'fa', Fx).list()).toHaveLength(0);
    expect(await createSqlRepository<Fixture>(exec, 'fb', Fx).list()).toHaveLength(0);
  });

  it('withExecutor(tx) leaga provider-ul real de tranzactie; rollback anuleaza scrierea', async () => {
    const exec = fromBetterSqlite(new Database(':memory:'));
    await migrate(exec, migratii());
    await exec
      .transaction({}, async (tx) => {
        const repos = withExecutor(tx);
        await repos.produse.create({ cod: 'TX1', denumire: 'Produs tranzactie' });
        expect(await repos.produse.list()).toHaveLength(1); // vizibil in tranzactie
        throw new Error('abort');
      })
      .catch(() => {});
    // Dupa rollback, provider-ul radacina nu vede produsul.
    expect(await withExecutor(exec).produse.list()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// B8 — harnas de fault-injection: esec la limite denumite, fara stare partiala.
// Reutilizabil in Faza 3 pentru boundary-urile: document / linii / stoc /
// jurnal / audit / outbox / commit (aici demonstrat pe un fixture simplu).
// ---------------------------------------------------------------------------
type Limita = 'before_first' | 'after_first' | 'after_middle' | 'before_commit';

class EroareInjectata extends Error {
  constructor(public readonly limita: Limita) {
    super(`fault injectat la limita: ${limita}`);
  }
}

async function ruleazaCuInjectie(exec: SqlExecutor, limita: Limita): Promise<void> {
  await exec.transaction({}, async (tx) => {
    if (limita === 'before_first') throw new EroareInjectata(limita);
    await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
    if (limita === 'after_first') throw new EroareInjectata(limita);
    await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'b']);
    if (limita === 'after_middle') throw new EroareInjectata(limita);
    await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [3, 'c']);
    if (limita === 'before_commit') throw new EroareInjectata(limita);
  });
}

describe('fault-injection: niciun rand durabil dupa esec la orice limita (P2-R8)', () => {
  for (const limita of [
    'before_first',
    'after_first',
    'after_middle',
    'before_commit',
  ] as Limita[]) {
    it(`esec la "${limita}" => 0 randuri persistate`, async () => {
      const exec = fromBetterSqlite(new Database(':memory:'));
      await exec.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
      await expect(ruleazaCuInjectie(exec, limita)).rejects.toBeInstanceOf(EroareInjectata);
      const n = await exec.select<{ n: number }>('SELECT COUNT(*) AS n FROM t');
      expect(Number(n[0]!.n)).toBe(0);
    });
  }
});
