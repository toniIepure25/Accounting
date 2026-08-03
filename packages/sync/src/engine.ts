import { type RezultatReconciliere, type Versionat, reconcile } from './sync.js';

/**
 * Orchestrator de sincronizare: leaga logica pura de reconciliere (deja
 * testata in sync.ts) de un flux real push/pull. Generic pe orice tip de
 * inregistrare care respecta `Versionat` (id, version, updatedAt, deletedAt?).
 *
 * Nu presupune niciun transport anume — `citesteLocal`/`citesteRemote` si
 * `scrieLocal`/`scrieRemote` sunt injectate, deci acelasi motor functioneaza
 * peste orice pereche (Repository local, API remote).
 */
export interface SursaSincronizare<T extends Versionat> {
  citesteLocal: () => Promise<T[]>;
  citesteRemote: () => Promise<T[]>;
  /** Aplica local inregistrarile venite de la server (dePull). */
  scrieLocal: (randuri: readonly T[]) => Promise<void>;
  /** Trimite la server inregistrarile modificate local (dePush). */
  scrieRemote: (randuri: readonly T[]) => Promise<void>;
}

export interface RezultatSincronizare<T> extends RezultatReconciliere<T> {
  /** Momentul la care s-a incheiat sincronizarea (ISO). */
  finalizatLa: string;
}

/**
 * Ruleaza un ciclu complet de sincronizare: citeste ambele parti, reconciliaza
 * (last-write-wins), apoi scrie diferentele in ambele directii. Daca push-ul
 * sau pull-ul esueaza (retea cazuta), arunca eroarea — apelantul decide daca
 * reincearca (offline-first: aplicatia ramane utilizabila local intre timp).
 */
export async function sincronizeaza<T extends Versionat>(
  sursa: SursaSincronizare<T>,
): Promise<RezultatSincronizare<T>> {
  const [local, remote] = await Promise.all([sursa.citesteLocal(), sursa.citesteRemote()]);
  const rezultat = reconcile(local, remote);

  if (rezultat.dePush.length > 0) await sursa.scrieRemote(rezultat.dePush);
  if (rezultat.dePull.length > 0) await sursa.scrieLocal(rezultat.dePull);

  return { ...rezultat, finalizatLa: new Date().toISOString() };
}
