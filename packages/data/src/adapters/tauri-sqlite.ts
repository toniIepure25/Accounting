import type {
  SqlExecutor,
  SqlResult,
  SqliteTransactionMode,
  TransactionOptions,
} from '../sql-executor.js';
import { TransactionUsageError, normalizeazaEroareSqlite } from '../tx-errors.js';

/**
 * Forma minima a obiectului `Database` din `@tauri-apps/plugin-sql`.
 * O declaram local ca sa nu legam pachetul `data` de Tauri (dependinta traieste
 * in `apps/desktop`).
 */
export interface TauriSqlDatabase {
  execute(
    query: string,
    bindValues?: unknown[],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

const MOD_BEGIN: Record<SqliteTransactionMode, string> = {
  deferred: 'BEGIN DEFERRED',
  immediate: 'BEGIN IMMEDIATE',
  exclusive: 'BEGIN EXCLUSIVE',
};

/**
 * Adapteaza un `Database` Tauri (SQLite) la interfata `SqlExecutor`, cu suport
 * de tranzactii (BEGIN/COMMIT/ROLLBACK, nesting prin SAVEPOINT). Plugin-ul Tauri
 * expune o singura conexiune — o tranzactie la un moment dat. Aceasta cale NU e
 * exercitata in testele Node (necesita runtime Tauri); logica oglindeste exact
 * adaptorul better-sqlite, care e testat pe SQLite real.
 */
export function fromTauriDatabase(db: TauriSqlDatabase): SqlExecutor {
  const state = { depth: 0, savepointSeq: 0 };

  function creeazaExecutor(finishedRef?: { finished: boolean }): SqlExecutor {
    const verifica = () => {
      if (finishedRef?.finished) {
        throw new TransactionUsageError('executor de tranzactie folosit dupa terminare');
      }
    };

    async function transaction<T>(
      options: TransactionOptions,
      work: (tx: SqlExecutor) => Promise<T>,
    ): Promise<T> {
      verifica();
      const topLevel = state.depth === 0;
      const sp = `sp_${++state.savepointSeq}`;
      if (topLevel) await db.execute(MOD_BEGIN[options.sqliteMode ?? 'deferred']);
      else await db.execute(`SAVEPOINT ${sp}`);
      state.depth++;
      const finished = { finished: false };
      const tx = creeazaExecutor(finished);
      try {
        const rezultat = await work(tx);
        if (topLevel) await db.execute('COMMIT');
        else await db.execute(`RELEASE ${sp}`);
        finished.finished = true;
        state.depth--;
        return rezultat;
      } catch (eroareWork) {
        try {
          if (topLevel) {
            await db.execute('ROLLBACK');
          } else {
            await db.execute(`ROLLBACK TO ${sp}`);
            await db.execute(`RELEASE ${sp}`);
          }
        } catch (eroareRollback) {
          console.error('[tx] ROLLBACK a esuat:', (eroareRollback as Error).message);
        }
        finished.finished = true;
        state.depth--;
        throw normalizeazaEroareSqlite(eroareWork);
      }
    }

    return {
      async execute(sql, params = []): Promise<SqlResult> {
        verifica();
        const r = await db.execute(sql, params as unknown[]);
        return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId };
      },
      async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
        verifica();
        return db.select<T[]>(sql, params as unknown[]);
      },
      transaction,
    };
  }

  return creeazaExecutor();
}
