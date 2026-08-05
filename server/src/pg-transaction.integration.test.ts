import { describe, expect, it } from 'vitest';
import { createPgExecutor } from './pg-executor.js';

/**
 * Test de integrare pe PostgreSQL REAL. Ruleaza DOAR cand `DATABASE_URL` e setat
 * (jobul CI cu container Postgres) — altfel e SARIT, ca sa nu pretinda o
 * verificare care nu a avut loc. In mediul de dezvoltare fara Postgres, acest
 * test apare ca "skipped", nu ca "passed".
 */
const DATABASE_URL = process.env.DATABASE_URL;
const d = DATABASE_URL ? describe : describe.skip;

d('PostgreSQL real — tranzactii', () => {
  it('commit persista, rollback anuleaza, read-your-writes in tranzactie', async () => {
    // Import dinamic: `pg` e optional (poate lipsi in mediul local).
    const pg = await import('pg');
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    // biome-ignore lint/suspicious/noExplicitAny: Pool-ul `pg` real satisface duck-type-ul PgPool
    const exec = createPgExecutor(pool as any);
    try {
      await exec.execute('DROP TABLE IF EXISTS tx_test');
      await exec.execute('CREATE TABLE tx_test (id INTEGER PRIMARY KEY, v TEXT NOT NULL UNIQUE)');

      const nr = async () =>
        Number((await exec.select<{ n: number }>('SELECT COUNT(*)::int AS n FROM tx_test'))[0]!.n);

      // Commit
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO tx_test (id, v) VALUES (?, ?)', [1, 'a']);
        // read-your-writes in tranzactie
        const inTx = await tx.select<{ n: number }>('SELECT COUNT(*)::int AS n FROM tx_test');
        expect(Number(inTx[0]!.n)).toBe(1);
      });
      expect(await nr()).toBe(1);

      // Rollback
      await exec
        .transaction({}, async (tx) => {
          await tx.execute('INSERT INTO tx_test (id, v) VALUES (?, ?)', [2, 'b']);
          throw new Error('abort');
        })
        .catch(() => {});
      expect(await nr()).toBe(1);

      await exec.execute('DROP TABLE IF EXISTS tx_test');
    } finally {
      await pool.end();
    }
  });
});
