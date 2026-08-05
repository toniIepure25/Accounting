/**
 * Taxonomie STABILA de erori de persistenta/tranzactie. Mesajele brute de la
 * driver (SQLite/PostgreSQL) NU se scurg catre UI — se normalizeaza in aceste
 * categorii, ca stratul de aplicatie sa poata decide (ex. retry pe conflict de
 * serializare) fara sa depinda de textul driverului.
 */

export class TransactionUsageError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'TransactionUsageError';
  }
}

/** Baza pentru conflicte care POT fi reincercate. */
export class TransactionConflictError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'TransactionConflictError';
  }
}

export class SerializationFailureError extends TransactionConflictError {
  constructor(mesaj = 'conflict de serializare — tranzactia poate fi reincercata') {
    super(mesaj);
    this.name = 'SerializationFailureError';
  }
}

export class DeadlockDetectedError extends TransactionConflictError {
  constructor(mesaj = 'deadlock detectat — tranzactia poate fi reincercata') {
    super(mesaj);
    this.name = 'DeadlockDetectedError';
  }
}

export class DatabaseBusyError extends Error {
  constructor(mesaj = 'baza de date este ocupata (locked/busy)') {
    super(mesaj);
    this.name = 'DatabaseBusyError';
  }
}

export class TransactionTimeoutError extends Error {
  constructor(mesaj = 'tranzactia a depasit timpul admis') {
    super(mesaj);
    this.name = 'TransactionTimeoutError';
  }
}

export class ConstraintViolationError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'ConstraintViolationError';
  }
}

/** Un cod PostgreSQL de eroare care merita reincercat (serializare/deadlock). */
export function esteRetryabilPg(code: string | undefined): boolean {
  // 40001 = serialization_failure, 40P01 = deadlock_detected.
  return code === '40001' || code === '40P01';
}

/** Normalizeaza o eroare SQLite (mesaj) intr-o categorie stabila. */
export function normalizeazaEroareSqlite(err: unknown): Error {
  const mesaj = err instanceof Error ? err.message : String(err);
  const m = mesaj.toLowerCase();
  if (m.includes('sqlite_busy') || m.includes('database is locked')) {
    return new DatabaseBusyError(mesaj);
  }
  if (m.includes('constraint')) return new ConstraintViolationError(mesaj);
  return err instanceof Error ? err : new Error(mesaj);
}

/** Normalizeaza o eroare PostgreSQL (obiect cu `code`) intr-o categorie stabila. */
export function normalizeazaEroarePg(err: unknown): Error {
  const code = (err as { code?: string } | null)?.code;
  const mesaj = err instanceof Error ? err.message : String(err);
  if (code === '40001') return new SerializationFailureError(mesaj);
  if (code === '40P01') return new DeadlockDetectedError(mesaj);
  if (code?.startsWith('23')) return new ConstraintViolationError(mesaj); // 23xxx = integrity constraint
  return err instanceof Error ? err : new Error(mesaj);
}
