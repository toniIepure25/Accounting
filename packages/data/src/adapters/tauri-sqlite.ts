import type { SqlExecutor, SqlResult } from '../sql-executor.js';

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

/** Adapteaza un `Database` Tauri (SQLite) la interfata noastra `SqlExecutor`. */
export function fromTauriDatabase(db: TauriSqlDatabase): SqlExecutor {
  return {
    async execute(sql, params = []): Promise<SqlResult> {
      const r = await db.execute(sql, params as unknown[]);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId };
    },
    async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      return db.select<T[]>(sql, params as unknown[]);
    },
  };
}
