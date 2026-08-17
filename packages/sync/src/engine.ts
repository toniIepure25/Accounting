import {
  type OptiuniReconciliereSigura,
  type RezultatReconciliereSigura,
  reconcileSigur,
} from './policy.js';
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

export interface RezultatSincronizareSigura<T> extends RezultatReconciliereSigura<T> {
  finalizatLa: string;
}

/**
 * Ciclu de sincronizare SIGUR pentru date financiare (RK-12): la fel ca
 * `sincronizeaza`, dar reconcilierea NU e last-write-wins — un rand BLOCAT pe
 * server (document postat/stornat/anulat + registrele lui) nu e niciodata
 * suprascris de un push local invechit. O editare locala pe un rand blocat pe
 * server devine CONFLICT (raportat, nu trimis); clientul adopta versiunea
 * serverului. Restul (nomenclatoare/ciorne ne-blocate) urmeaza LWW normal.
 *
 * `optiuni.blocat(r)` decide daca un rand REMOTE e imutabil (ex.
 * `d => d.stare === 'validat' || d.stare === 'stornat' || d.stare === 'anulat'`).
 */
export async function sincronizeazaSigur<T extends Versionat>(
  sursa: SursaSincronizare<T>,
  optiuni: OptiuniReconciliereSigura<T>,
): Promise<RezultatSincronizareSigura<T>> {
  const [local, remote] = await Promise.all([sursa.citesteLocal(), sursa.citesteRemote()]);
  const rezultat = reconcileSigur(local, remote, optiuni);

  // Ordinea: intai ADOPTA versiunile serverului (dePull, incl. randurile blocate
  // aflate in conflict), apoi trimite scrierile locale sigure (dePush). Astfel un
  // rand blocat pe server nu poate fi impins de un local invechit.
  if (rezultat.dePull.length > 0) await sursa.scrieLocal(rezultat.dePull);
  if (rezultat.dePush.length > 0) await sursa.scrieRemote(rezultat.dePush);

  return { ...rezultat, finalizatLa: new Date().toISOString() };
}
