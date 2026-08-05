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

export type TransactionIsolation = 'read_committed' | 'repeatable_read' | 'serializable';

/** Modul SQLite de pornire a tranzactiei (BEGIN ...). */
export type SqliteTransactionMode = 'deferred' | 'immediate' | 'exclusive';

export interface TransactionOptions {
  /** Nivel de izolare (PostgreSQL). Ignorat de SQLite (care are un singur writer). */
  isolation?: TransactionIsolation;
  /**
   * Modul BEGIN pentru SQLite. `immediate` ia lacatul de scriere imediat — de
   * folosit pentru operatiunile sensibile la stoc, ca doua retrageri
   * concurente sa nu poata reusi amandoua. Implicit `deferred`.
   */
  sqliteMode?: SqliteTransactionMode;
  /** Timp maxim (ms) pentru tranzactie (unde e suportat). */
  timeoutMs?: number;
  /** Reincercari la conflict de serializare/deadlock (PostgreSQL). Implicit 0. */
  maxRetries?: number;
}

export interface SqlExecutor {
  /** Comanda de modificare (INSERT/UPDATE/DELETE/DDL). */
  execute(sql: string, params?: readonly unknown[]): Promise<SqlResult>;
  /** Interogare care returneaza randuri. */
  select<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /**
   * Ruleaza `work` intr-o tranzactie. Callback-ul primeste un executor legat de
   * tranzactie — toate instructiunile trec prin aceeasi conexiune/tranzactie.
   * Commit la succes; ROLLBACK la orice eroare (eroarea originala se propaga).
   * Nesting: prin SAVEPOINT (unde e suportat). Executorul legat NU mai poate fi
   * folosit dupa terminarea tranzactiei (arunca `TransactionUsageError`).
   */
  transaction<T>(options: TransactionOptions, work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
