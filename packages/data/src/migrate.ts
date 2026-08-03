import type { SqlExecutor } from './sql-executor.js';

export interface Migration {
  /** Identificator ordonabil, ex. "0001_init". */
  id: string;
  sql: string;
}

/**
 * Ruleaza migratiile neaplicate, in ordine. Idempotent: tine evidenta in tabela
 * `_migrations`. Aceleasi migratii ruleaza pe SQLite si PostgreSQL.
 */
export async function migrate(
  exec: SqlExecutor,
  migrations: readonly Migration[],
): Promise<string[]> {
  await exec.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const applied = new Set(
    (await exec.select<{ id: string }>('SELECT id FROM _migrations')).map((r) => r.id),
  );

  const run: string[] = [];
  for (const m of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(m.id)) continue;
    for (const stmt of splitStatements(m.sql)) {
      await exec.execute(stmt);
    }
    await exec.execute('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)', [
      m.id,
      new Date().toISOString(),
    ]);
    run.push(m.id);
  }
  return run;
}

/** Imparte un fisier SQL in instructiuni individuale (naiv, dar suficient pentru DDL-ul nostru). */
function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
}
