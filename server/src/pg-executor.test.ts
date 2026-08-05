import { ConstraintViolationError, SerializationFailureError } from '@gr/data';
import { describe, expect, it } from 'vitest';
import { type PgClient, type PgPool, type PgQueryResult, createPgExecutor } from './pg-executor.js';

/**
 * Verifica FLUXUL DE CONTROL al tranzactiilor PostgreSQL (BEGIN/COMMIT/ROLLBACK,
 * eliberarea clientului, retry pe serializare, izolare din lista alba) cu un pool
 * FALS, determinist. NU e PostgreSQL real — deci Faza 2 ramane
 * IMPLEMENTED_NOT_POSTGRES_VERIFIED pana la jobul CI cu container Postgres. Aici
 * dovedim ca logica (release mereu, retry marginit, fara interpolare de izolare)
 * e corecta.
 */

interface Jurnal {
  interogari: string[];
  connectari: number;
  eliberari: number;
}

function poolFals(): { pool: PgPool; jurnal: Jurnal } {
  const jurnal: Jurnal = { interogari: [], connectari: 0, eliberari: 0 };
  const ras = async (): Promise<PgQueryResult> => ({ rows: [], rowCount: 0 });
  const client: PgClient = {
    query: async (text: string) => {
      jurnal.interogari.push(text);
      return ras();
    },
    release: () => {
      jurnal.eliberari++;
    },
  };
  const pool: PgPool = {
    query: async (text) => {
      jurnal.interogari.push(text);
      return ras();
    },
    connect: async () => {
      jurnal.connectari++;
      return client;
    },
  };
  return { pool, jurnal };
}

function eroarePg(code: string): Error {
  return Object.assign(new Error(`eroare pg ${code}`), { code });
}

describe('createPgExecutor — tranzactii (pool fals, determinist)', () => {
  it('commit + eliberare la succes', async () => {
    const { pool, jurnal } = poolFals();
    const exec = createPgExecutor(pool);
    const r = await exec.transaction({}, async (tx) => {
      await tx.execute('INSERT INTO t (v) VALUES (?)', ['a']);
      return 42;
    });
    expect(r).toBe(42);
    expect(jurnal.interogari).toContain('BEGIN');
    expect(jurnal.interogari).toContain('COMMIT');
    expect(jurnal.interogari).not.toContain('ROLLBACK');
    expect(jurnal.eliberari).toBe(1);
  });

  it('rollback + eliberare la esec', async () => {
    const { pool, jurnal } = poolFals();
    const exec = createPgExecutor(pool);
    await expect(
      exec.transaction({}, async () => {
        throw new Error('eroare de business');
      }),
    ).rejects.toThrow('eroare de business');
    expect(jurnal.interogari).toContain('ROLLBACK');
    expect(jurnal.interogari).not.toContain('COMMIT');
    expect(jurnal.eliberari).toBe(1); // eliberat SI la esec
  });

  it('retry marginit pe serializare (40001): reuseste la a doua incercare', async () => {
    const { pool, jurnal } = poolFals();
    const exec = createPgExecutor(pool);
    let incercari = 0;
    const r = await exec.transaction({ maxRetries: 1 }, async (tx) => {
      incercari++;
      await tx.execute('UPDATE t SET v = ?', ['x']);
      if (incercari === 1) throw eroarePg('40001'); // serialization_failure
      return 'ok';
    });
    expect(r).toBe('ok');
    expect(incercari).toBe(2);
    expect(jurnal.connectari).toBe(2); // client nou per incercare
    expect(jurnal.eliberari).toBe(2); // fiecare client eliberat
  });

  it('o eroare NEretryabila (23505) nu se reincearca', async () => {
    const { pool, jurnal } = poolFals();
    const exec = createPgExecutor(pool);
    let incercari = 0;
    await expect(
      exec.transaction({ maxRetries: 3 }, async () => {
        incercari++;
        throw eroarePg('23505'); // unique_violation — constrangere, nu retryabil
      }),
    ).rejects.toBeInstanceOf(ConstraintViolationError);
    expect(incercari).toBe(1); // o singura incercare
    expect(jurnal.connectari).toBe(1);
    expect(jurnal.eliberari).toBe(1);
  });

  it('serializarea epuizata dupa maxRetries arunca SerializationFailureError', async () => {
    const { pool } = poolFals();
    const exec = createPgExecutor(pool);
    await expect(
      exec.transaction({ maxRetries: 2 }, async () => {
        throw eroarePg('40001');
      }),
    ).rejects.toBeInstanceOf(SerializationFailureError);
  });

  it('nivelul de izolare vine dintr-o lista alba (fara interpolare de sir brut)', async () => {
    const { pool, jurnal } = poolFals();
    const exec = createPgExecutor(pool);
    await exec.transaction({ isolation: 'serializable' }, async () => 1);
    expect(jurnal.interogari).toContain('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  });
});
