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

/**
 * Imparte un fisier SQL in instructiuni individuale, corect fata de:
 *  - comentarii de linie `-- ...` (oriunde, nu doar la inceput de statement);
 *  - siruri intre ghilimele simple, inclusiv `''` escapat;
 *  - `;` care apar in interiorul unui sir.
 *
 * Varianta anterioara (split naiv pe `;` + filtrarea chunk-urilor care incep cu
 * `--`) ARUNCA prima instructiune a oricarui fisier care incepe cu un comentariu
 * (ex. 0001_init.sql) — bug latent nedetectat fiindca migratiile nu au fost
 * rulate niciodata pe o baza SQLite/PostgreSQL reala (demo-ul in-memory nu
 * foloseste SQL). Acum comentariile sunt indepartate, nu folosite ca delimitator.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    const next = sql[i + 1];
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next; // ghilimea escapata '' — face parte din sir
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === '-' && next === '-') {
      // Comentariu de linie: sari pana la sfarsitul liniei.
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }
    if (ch === ';') {
      const t = current.trim();
      if (t.length > 0) statements.push(t);
      current = '';
      continue;
    }
    current += ch;
  }
  const t = current.trim();
  if (t.length > 0) statements.push(t);
  return statements;
}
