/**
 * Abstractia peste executia SQL. Fiecare mod de deployment furnizeaza o
 * implementare concreta:
 *   - local (desktop):   plugin @tauri-apps/plugin-sql peste SQLite
 *   - local (web):       sql.js / wa-sqlite (WASM) peste SQLite
 *   - retea/cloud:       driver `pg` peste PostgreSQL (in `server/`)
 * Restul aplicatiei nu cunoaste driverul concret.
 */
export interface SqlResult {
  rowsAffected: number;
  lastInsertId?: number | string;
}

export interface SqlExecutor {
  /** Comanda de modificare (INSERT/UPDATE/DELETE/DDL). */
  execute(sql: string, params?: readonly unknown[]): Promise<SqlResult>;
  /** Interogare care returneaza randuri. */
  select<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}
