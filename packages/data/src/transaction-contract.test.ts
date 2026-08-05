import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import type { SqlExecutor } from './sql-executor.js';
import { ConstraintViolationError, TransactionUsageError } from './tx-errors.js';

/**
 * Suita de CONTRACT pentru tranzactii, rulata pe SQLite REAL (better-sqlite3).
 * E scrisa peste `SqlExecutor`, deci aceleasi scenarii pot fi rulate si pe alt
 * adaptor (ex. PostgreSQL, in jobul CI dedicat) apeland `contractTranzactii`.
 */
export function contractTranzactii(numeAdaptor: string, creeaza: () => SqlExecutor) {
  describe(`contract tranzactii — ${numeAdaptor}`, () => {
    let exec: SqlExecutor;
    beforeEach(async () => {
      exec = creeaza();
      await exec.execute('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL UNIQUE)');
    });

    async function nrRanduri(e: SqlExecutor = exec): Promise<number> {
      const r = await e.select<{ n: number }>('SELECT COUNT(*) AS n FROM t');
      return Number(r[0]!.n);
    }

    it('1. commit la succes', async () => {
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
      });
      expect(await nrRanduri()).toBe(1);
    });

    it('2. rollback cand prima instructiune esueaza', async () => {
      await expect(
        exec.transaction({}, async (tx) => {
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, null]); // NOT NULL violation
        }),
      ).rejects.toBeInstanceOf(ConstraintViolationError);
      expect(await nrRanduri()).toBe(0);
    });

    it('3+4. rollback cand o instructiune din mijloc/final esueaza — nimic nu ramane', async () => {
      await expect(
        exec.transaction({}, async (tx) => {
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'b']);
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [3, 'a']); // UNIQUE violation
        }),
      ).rejects.toBeInstanceOf(ConstraintViolationError);
      expect(await nrRanduri()).toBe(0);
    });

    it('5. rollback cand callback-ul arunca o eroare de domeniu', async () => {
      class EroareDomeniu extends Error {}
      await expect(
        exec.transaction({}, async (tx) => {
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
          throw new EroareDomeniu('reguli de business');
        }),
      ).rejects.toBeInstanceOf(EroareDomeniu);
      expect(await nrRanduri()).toBe(0);
    });

    it('6. read-your-writes in interiorul tranzactiei', async () => {
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
        expect(await nrRanduri(tx)).toBe(1); // vizibil in aceeasi tranzactie
      });
    });

    it('7. modificarile sunt invizibile dupa rollback', async () => {
      await exec
        .transaction({}, async (tx) => {
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
          throw new Error('abort');
        })
        .catch(() => {});
      expect(await nrRanduri()).toBe(0);
    });

    it('8. constrangerile raman impuse (eroare normalizata)', async () => {
      await exec.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'x']);
      await expect(
        exec.transaction({}, async (tx) => {
          await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'x']); // UNIQUE
        }),
      ).rejects.toBeInstanceOf(ConstraintViolationError);
    });

    it('12. nesting via savepoint: rollback interior pastreaza exteriorul', async () => {
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
        // Tranzactie interioara care esueaza — doar ea se anuleaza.
        await tx
          .transaction({}, async (tx2) => {
            await tx2.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'b']);
            throw new Error('abort interior');
          })
          .catch(() => {});
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [3, 'c']);
      });
      const vals = (await exec.select<{ v: string }>('SELECT v FROM t ORDER BY v')).map((r) => r.v);
      expect(vals).toEqual(['a', 'c']); // 'b' anulat de savepoint
    });

    it('12b. nesting: commit interior + exterior persista ambele', async () => {
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
        await tx.transaction({}, async (tx2) => {
          await tx2.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'b']);
        });
      });
      expect(await nrRanduri()).toBe(2);
    });

    it('13. tranzactii independente secventiale', async () => {
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
      });
      await exec.transaction({}, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [2, 'b']);
      });
      expect(await nrRanduri()).toBe(2);
    });

    it('18. executorul de tranzactie nu mai poate fi folosit dupa terminare', async () => {
      let scapat: SqlExecutor | null = null;
      await exec.transaction({}, async (tx) => {
        scapat = tx;
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
      });
      await expect((scapat as unknown as SqlExecutor).select('SELECT 1')).rejects.toBeInstanceOf(
        TransactionUsageError,
      );
    });

    it('BEGIN IMMEDIATE e acceptat pentru operatiuni sensibile la stoc', async () => {
      await exec.transaction({ sqliteMode: 'immediate' }, async (tx) => {
        await tx.execute('INSERT INTO t (id, v) VALUES (?, ?)', [1, 'a']);
      });
      expect(await nrRanduri()).toBe(1);
    });
  });
}

// Rulare reala pe SQLite (better-sqlite3).
contractTranzactii('better-sqlite3', () => fromBetterSqlite(new Database(':memory:')));
