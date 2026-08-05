import type Database from 'better-sqlite3';
import type {
  SqlExecutor,
  SqlResult,
  SqliteTransactionMode,
  TransactionOptions,
} from '../sql-executor.js';
import { TransactionUsageError, normalizeazaEroareSqlite } from '../tx-errors.js';

/**
 * SqlExecutor peste `better-sqlite3` — SQLite REAL, sincron, rulabil in Node
 * (teste + eventual desktop). NU e re-exportat din indexul pachetului: leaga un
 * modul nativ, iar bundle-ul web (Vite) nu trebuie sa-l includa. Se importa
 * direct (`./adapters/better-sqlite.js`) doar unde exista Node.
 *
 * Tranzactii: `BEGIN <mode>` la nivel de top, `SAVEPOINT` pentru nesting.
 * better-sqlite3 e o singura conexiune sincrona — o tranzactie la un moment dat.
 * `timeoutMs`/`maxRetries` nu se aplica (fara concurenta reala pe aceeasi
 * conexiune sincrona) si sunt acceptate dar ignorate, documentat aici.
 */
const MOD_BEGIN: Record<SqliteTransactionMode, string> = {
  deferred: 'BEGIN DEFERRED',
  immediate: 'BEGIN IMMEDIATE',
  exclusive: 'BEGIN EXCLUSIVE',
};

export function fromBetterSqlite(db: Database.Database): SqlExecutor {
  const state = { depth: 0, savepointSeq: 0 };

  function creeazaExecutor(finishedRef?: { finished: boolean }): SqlExecutor {
    const verifica = () => {
      if (finishedRef?.finished) {
        throw new TransactionUsageError(
          'executor de tranzactie folosit dupa terminarea tranzactiei',
        );
      }
    };

    async function transaction<T>(
      options: TransactionOptions,
      work: (tx: SqlExecutor) => Promise<T>,
    ): Promise<T> {
      verifica();
      const topLevel = state.depth === 0;
      const sp = `sp_${++state.savepointSeq}`;
      try {
        if (topLevel) db.exec(MOD_BEGIN[options.sqliteMode ?? 'deferred']);
        else db.exec(`SAVEPOINT ${sp}`);
      } catch (e) {
        throw normalizeazaEroareSqlite(e);
      }
      state.depth++;
      const finished = { finished: false };
      const tx = creeazaExecutor(finished);
      try {
        const rezultat = await work(tx);
        if (topLevel) db.exec('COMMIT');
        else db.exec(`RELEASE ${sp}`);
        finished.finished = true;
        state.depth--;
        return rezultat;
      } catch (eroareWork) {
        try {
          if (topLevel) {
            db.exec('ROLLBACK');
          } else {
            db.exec(`ROLLBACK TO ${sp}`);
            db.exec(`RELEASE ${sp}`);
          }
        } catch (eroareRollback) {
          // Nu inlocui eroarea originala — doar semnaleaza esecul rollback-ului.
          console.error('[tx] ROLLBACK a esuat:', (eroareRollback as Error).message);
        }
        finished.finished = true;
        state.depth--;
        throw normalizeazaEroareSqlite(eroareWork);
      }
    }

    return {
      async execute(sql: string, params: readonly unknown[] = []): Promise<SqlResult> {
        verifica();
        if (params.length === 0) {
          db.exec(sql);
          return { rowsAffected: 0 };
        }
        const info = db.prepare(sql).run(...(params as never[]));
        return { rowsAffected: info.changes, lastInsertId: Number(info.lastInsertRowid) };
      },
      async select<T = Record<string, unknown>>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<T[]> {
        verifica();
        return db.prepare(sql).all(...(params as never[])) as T[];
      },
      transaction,
    };
  }

  return creeazaExecutor();
}
