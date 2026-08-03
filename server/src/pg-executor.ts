import type { SqlExecutor, SqlResult } from '@gr/data';

/**
 * SqlExecutor peste PostgreSQL (biblioteca `pg`). Converteste placeholderele `?`
 * (stil SQLite) in `$1, $2, ...` (stil Postgres). Tiparea Pool-ului este local
 * (duck-typing), ca sa nu legam server-ul de tipurile `pg` la compilare.
 */
export interface PgQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}
export interface PgPool {
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export function createPgExecutor(pool: PgPool): SqlExecutor {
  return {
    async execute(sql, params = []): Promise<SqlResult> {
      const r = await pool.query(toPg(sql), params as unknown[]);
      return { rowsAffected: r.rowCount ?? 0 };
    },
    async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      const r = await pool.query(toPg(sql), params as unknown[]);
      return r.rows as T[];
    },
  };
}
