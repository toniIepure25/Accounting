import type Database from 'better-sqlite3';
import type { SqlExecutor, SqlResult } from '../sql-executor.js';

/**
 * SqlExecutor peste `better-sqlite3` — SQLite REAL, sincron, rulabil in Node
 * (teste + eventual desktop). NU e re-exportat din indexul pachetului: leaga un
 * modul nativ, iar bundle-ul web (Vite) nu trebuie sa-l includa. Se importa
 * direct (`./adapters/better-sqlite.js`) doar unde exista Node.
 *
 * Contractul nostru e async; better-sqlite3 e sincron, deci ambalam in Promise.
 * Faza 2 va adauga `transaction()` peste aceeasi conexiune.
 */
export function fromBetterSqlite(db: Database.Database): SqlExecutor {
  const executor: SqlExecutor = {
    async execute(sql: string, params: readonly unknown[] = []): Promise<SqlResult> {
      if (params.length === 0) {
        // DDL / instructiuni fara parametri: `exec` accepta orice, inclusiv
        // constructii pe care `prepare` nu le poate pregati.
        db.exec(sql);
        return { rowsAffected: 0 };
      }
      const info = db.prepare(sql).run(...(params as never[]));
      return {
        rowsAffected: info.changes,
        lastInsertId: Number(info.lastInsertRowid),
      };
    },
    async select<T = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<T[]> {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
  };
  return executor;
}
