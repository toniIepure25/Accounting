/**
 * Magazie de idempotenta (Faza 4, P4-R2). O comanda cu efecte (ex. postarea, care
 * aloca un numar legal) poate primi o cheie de idempotenta. La o REINCERCARE cu
 * aceeasi cheie, comanda NU se re-executa — se intoarce raspunsul memorat. Astfel
 * o retea nesigura sau un client care reincearca nu posteaza / nu aloca numar de
 * doua ori.
 *
 * Se executa in interiorul tranzactiei comenzii: verificarea, munca si scrierea
 * raspunsului sunt atomice. Cheia primara pe `idempotency_keys.key` este garda
 * finala: sub concurenta, a doua tranzactie fie asteapta (SQLite BEGIN IMMEDIATE)
 * si vede cheia, fie esueaza pe cheia primara la INSERT si face rollback — in
 * niciun caz nu comite de doua ori.
 */

import type { SqlExecutor } from '@gr/data';

/** Aruncata cand aceeasi cheie de idempotenta e refolosita pentru o cerere diferita. */
export class IdempotencyConflictError extends Error {
  constructor(public readonly key: string) {
    super(
      `Cheia de idempotenta "${key}" a fost deja folosita pentru o cerere diferita. Foloseste o cheie noua pentru o comanda noua.`,
    );
    this.name = 'IdempotencyConflictError';
  }
}

interface RandIdempotenta {
  request_hash: string;
  response: string;
}

/**
 * Ruleaza `work` cel mult o data pentru `key`. Daca `key` exista deja cu acelasi
 * `requestHash`, intoarce raspunsul memorat fara a rula `work`. Un hash diferit
 * pe aceeasi cheie => `IdempotencyConflictError`.
 */
export async function cuIdempotenta<T>(
  tx: SqlExecutor,
  key: string,
  requestHash: string,
  acum: string,
  work: () => Promise<T>,
): Promise<T> {
  const existente = await tx.select<RandIdempotenta>(
    'SELECT request_hash, response FROM idempotency_keys WHERE key = ?',
    [key],
  );
  if (existente.length > 0) {
    const rand = existente[0]!;
    if (rand.request_hash !== requestHash) throw new IdempotencyConflictError(key);
    return JSON.parse(rand.response) as T;
  }

  const rezultat = await work();

  await tx.execute(
    'INSERT INTO idempotency_keys (key, request_hash, response, created_at) VALUES (?, ?, ?, ?)',
    [key, requestHash, JSON.stringify(rezultat), acum],
  );
  return rezultat;
}
