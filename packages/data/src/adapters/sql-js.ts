import type { BindParams, Database } from 'sql.js';
import type {
  SqlExecutor,
  SqlResult,
  SqliteTransactionMode,
  TransactionOptions,
} from '../sql-executor.js';
import { TransactionUsageError, normalizeazaEroareSqlite } from '../tx-errors.js';

/**
 * SqlExecutor peste `sql.js` — SQLite REAL compilat in WebAssembly, rulabil in
 * BROWSER (modul local web) si in Node (teste). Acelasi contract ca
 * `fromBetterSqlite`, deci ACELASI motor @gr/application (stoc + jurnal + fiscal)
 * si aceleasi citiri din registre ruleaza offline, fara server. NU e re-exportat
 * din indexul pachetului (ar trage WASM in orice bundle) — se importa prin
 * subcalea `@gr/data/web-sqlite`.
 *
 * sql.js e SINCRON (o singura instanta WASM, un singur writer), la fel ca
 * better-sqlite3: o tranzactie la un moment dat, nesting prin SAVEPOINT.
 * `timeoutMs`/`maxRetries` nu se aplica (fara concurenta reala) si sunt ignorate.
 * Persistenta (export/import al fisierului `.sqlite` in IndexedDB) e treaba
 * apelantului — acest adaptor se ocupa doar de executie.
 */
const MOD_BEGIN: Record<SqliteTransactionMode, string> = {
  deferred: 'BEGIN DEFERRED',
  immediate: 'BEGIN IMMEDIATE',
  exclusive: 'BEGIN EXCLUSIVE',
};

export function fromSqlJs(db: Database): SqlExecutor {
  const state = { depth: 0, savepointSeq: 0 };

  const ultimulId = (): number => {
    const r = db.exec('SELECT last_insert_rowid() AS id');
    const val = r[0]?.values?.[0]?.[0];
    return typeof val === 'number' ? val : Number(val ?? 0);
  };

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
        try {
          if (params.length === 0) {
            // `exec` accepta si mai multe instructiuni (ex. DDL de migrare).
            db.exec(sql);
            return { rowsAffected: 0 };
          }
          db.run(sql, params as BindParams);
          return { rowsAffected: db.getRowsModified(), lastInsertId: ultimulId() };
        } catch (e) {
          throw normalizeazaEroareSqlite(e);
        }
      },
      async select<T = Record<string, unknown>>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<T[]> {
        verifica();
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params as BindParams);
          const randuri: T[] = [];
          while (stmt.step()) randuri.push(stmt.getAsObject() as T);
          return randuri;
        } catch (e) {
          throw normalizeazaEroareSqlite(e);
        } finally {
          stmt.free();
        }
      },
      transaction,
    };
  }

  return creeazaExecutor();
}
