/**
 * Reconciliere SIGURA pentru datele financiare (Faza 12). Motorul LWW din
 * `sync.ts` e potrivit doar pentru nomenclatoare/configurare cu risc mic. Pentru
 * documente POSTATE si registrele lor (stoc/jurnal/fiscal/e-Factura) last-write-
 * wins ar putea CORUPE tacit date financiare: o editare offline invechita ar
 * suprascrie un document deja postat pe server.
 *
 * Regula (RK-12): un rand BLOCAT pe server (postat/imutabil) NU e niciodata
 * suprascris de un push al clientului. Clientul trebuie sa ADUCA (pull) versiunea
 * serverului; o editare locala pe un rand blocat pe server devine CONFLICT
 * (raportat, nu fuzionat). Serverul e autoritar; postarea/stornarea se fac prin
 * COMENZI (nu prin upsert de rand) — vezi offline-queue.ts.
 */

import { type RezultatReconciliere, type Versionat, alegeInvingator } from './sync.js';

export interface OptiuniReconciliereSigura<T> {
  /** Un rand e "blocat" (imutabil) pe server — ex. document postat/stornat/anulat. */
  blocat: (r: T) => boolean;
  /** Doua randuri sunt identice ca continut sincronizabil? Implicit: aceeasi versiune. */
  identice?: (a: T, b: T) => boolean;
}

export interface ConflictSync {
  id: string;
  motiv: 'server_blocat';
}

export interface RezultatReconciliereSigura<T> extends RezultatReconciliere<T> {
  /** Editari locale respinse fiindca serverul are randul blocat (imutabil). */
  conflicte: ConflictSync[];
}

const acelasiRand = <T extends Versionat>(a: T, b: T): boolean =>
  a.version === b.version &&
  a.updatedAt === b.updatedAt &&
  (a.deletedAt ?? null) === (b.deletedAt ?? null);

/**
 * Reconciliaza local vs. remote protejand randurile blocate pe server. Un rand
 * nou local (fara corespondent remote) se poate trimite (draft creat offline).
 * Un rand blocat pe server nu se suprascrie: se aduce versiunea serverului si,
 * daca localul difera, se semnaleaza un conflict.
 */
export function reconcileSigur<T extends Versionat>(
  local: readonly T[],
  remote: readonly T[],
  optiuni: OptiuniReconciliereSigura<T>,
): RezultatReconciliereSigura<T> {
  const identice = optiuni.identice ?? acelasiRand;
  const lMap = new Map(local.map((r) => [r.id, r]));
  const rMap = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...lMap.keys(), ...rMap.keys()]);

  const merged: T[] = [];
  const dePush: T[] = [];
  const dePull: T[] = [];
  const conflicte: ConflictSync[] = [];

  for (const id of ids) {
    const l = lMap.get(id);
    const r = rMap.get(id);

    if (l && !r) {
      // Rand nou creat local (ex. ciorna offline) — se poate trimite.
      merged.push(l);
      dePush.push(l);
      continue;
    }
    if (!l && r) {
      merged.push(r);
      dePull.push(r);
      continue;
    }
    if (!l || !r) continue;

    if (optiuni.blocat(r)) {
      // Serverul are randul BLOCAT: nu-l suprascriem niciodata prin push.
      merged.push(r);
      if (!identice(l, r)) {
        dePull.push(r); // clientul adopta versiunea serverului
        conflicte.push({ id, motiv: 'server_blocat' });
      }
      continue;
    }

    // Rand ne-blocat pe server: LWW normal (nomenclatoare/ciorne).
    const win = alegeInvingator(l, r);
    merged.push(win);
    if (!identice(l, r)) {
      if (win === l) dePush.push(l);
      else dePull.push(r);
    }
  }

  return { merged, dePush, dePull, conflicte };
}
