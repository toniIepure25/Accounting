import {
  type SqlExecutor,
  type SqlResult,
  type TransactionIsolation,
  type TransactionOptions,
  TransactionUsageError,
  esteRetryabilPg,
  normalizeazaEroarePg,
} from '@gr/data';

/**
 * SqlExecutor peste PostgreSQL (biblioteca `pg`). Converteste placeholderele `?`
 * (stil SQLite) in `$1, $2, ...` (stil Postgres). Tipurile Pool/Client sunt
 * locale (duck-typing), ca sa nu legam server-ul de tipurile `pg` la compilare.
 *
 * Tranzactii: se ia un CLIENT DEDICAT din pool (`connect()`), toate
 * instructiunile tranzactiei trec prin el, iar clientul se elibereaza mereu la
 * final. Reincercare marginita DOAR pentru esecuri retryabile (serializare
 * 40001 / deadlock 40P01). Nivelul de izolare se seteaza dintr-o lista alba —
 * NU se interpoleaza sir brut in SQL.
 *
 * NOTA: aceasta cale NU e exercitata in mediul curent (fara PostgreSQL). Codul
 * e scris si typecheck-uit; verificarea reala se face in jobul CI cu container
 * Postgres (vezi .github/workflows) — pana atunci: IMPLEMENTED_NOT_POSTGRES_VERIFIED.
 */
export interface PgQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}
export interface PgClient {
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
  release(): void;
}
export interface PgPool {
  query(text: string, params?: unknown[]): Promise<PgQueryResult>;
  connect(): Promise<PgClient>;
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const ISO_SQL: Record<TransactionIsolation, string> = {
  read_committed: 'READ COMMITTED',
  repeatable_read: 'REPEATABLE READ',
  serializable: 'SERIALIZABLE',
};

/** Executor peste un client dedicat (in interiorul unei tranzactii), cu SAVEPOINT pentru nesting. */
function executorPeClient(client: PgClient, state: { depth: number; sp: number }): SqlExecutor {
  function creeaza(finishedRef?: { finished: boolean }): SqlExecutor {
    const verifica = () => {
      if (finishedRef?.finished) {
        throw new TransactionUsageError('executor de tranzactie folosit dupa terminare');
      }
    };
    async function transaction<T>(
      _options: TransactionOptions,
      work: (tx: SqlExecutor) => Promise<T>,
    ): Promise<T> {
      verifica();
      const sp = `sp_${++state.sp}`;
      await client.query(`SAVEPOINT ${sp}`);
      state.depth++;
      const finished = { finished: false };
      try {
        const rezultat = await work(creeaza(finished));
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        finished.finished = true;
        state.depth--;
        return rezultat;
      } catch (e) {
        try {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          await client.query(`RELEASE SAVEPOINT ${sp}`);
        } catch (rb) {
          console.error('[tx] ROLLBACK TO SAVEPOINT a esuat:', (rb as Error).message);
        }
        finished.finished = true;
        state.depth--;
        throw normalizeazaEroarePg(e);
      }
    }
    return {
      async execute(sql, params = []): Promise<SqlResult> {
        verifica();
        const r = await client.query(toPg(sql), params as unknown[]);
        return { rowsAffected: r.rowCount ?? 0 };
      },
      async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
        verifica();
        const r = await client.query(toPg(sql), params as unknown[]);
        return r.rows as T[];
      },
      transaction,
    };
  }
  return creeaza();
}

export function createPgExecutor(pool: PgPool): SqlExecutor {
  async function transaction<T>(
    options: TransactionOptions,
    work: (tx: SqlExecutor) => Promise<T>,
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 0;
    let ultimaEroare: unknown;
    for (let incercare = 0; incercare <= maxRetries; incercare++) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (options.isolation) {
          await client.query(`SET TRANSACTION ISOLATION LEVEL ${ISO_SQL[options.isolation]}`);
        }
        const rezultat = await work(executorPeClient(client, { depth: 1, sp: 0 }));
        await client.query('COMMIT');
        return rezultat;
      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch (rb) {
          console.error('[tx] ROLLBACK a esuat:', (rb as Error).message);
        }
        const code = (e as { code?: string } | null)?.code;
        ultimaEroare = normalizeazaEroarePg(e);
        // Reincearca DOAR conflictele retryabile, si doar daca mai avem incercari.
        if (esteRetryabilPg(code) && incercare < maxRetries) {
          continue;
        }
        throw ultimaEroare;
      } finally {
        client.release();
      }
    }
    throw ultimaEroare;
  }

  return {
    async execute(sql, params = []): Promise<SqlResult> {
      const r = await pool.query(toPg(sql), params as unknown[]);
      return { rowsAffected: r.rowCount ?? 0 };
    },
    async select<T = Record<string, unknown>>(sql: string, params: readonly unknown[] = []) {
      const r = await pool.query(toPg(sql), params as unknown[]);
      return r.rows as T[];
    },
    transaction,
  };
}
