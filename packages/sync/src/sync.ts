/**
 * Motor de sincronizare offline-first. Fiecare inregistrare poarta `version`,
 * `updatedAt` si `deletedAt` (tombstone). Reconcilierea foloseste last-write-wins:
 * castiga versiunea mai mare; la egalitate, `updatedAt` mai recent. O stergere
 * (tombstone) participa la LWW ca orice modificare.
 */
export interface Versionat {
  id: string;
  version: number;
  updatedAt: string; // ISO
  deletedAt?: string | null;
}

/** Alege invingatorul intre doua versiuni ale aceleiasi inregistrari. */
export function alegeInvingator<T extends Versionat>(a: T, b: T): T {
  if (a.version !== b.version) return a.version > b.version ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export interface RezultatReconciliere<T> {
  /** Starea finala combinata (include tombstones). */
  merged: T[];
  /** Inregistrari de trimis la server (localul e mai nou). */
  dePush: T[];
  /** Inregistrari de aplicat local (serverul e mai nou). */
  dePull: T[];
}

/** Reconciliaza doua seturi (local si remote) prin last-write-wins. */
export function reconcile<T extends Versionat>(
  local: readonly T[],
  remote: readonly T[],
): RezultatReconciliere<T> {
  const lMap = new Map(local.map((r) => [r.id, r]));
  const rMap = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...lMap.keys(), ...rMap.keys()]);

  const merged: T[] = [];
  const dePush: T[] = [];
  const dePull: T[] = [];

  for (const id of ids) {
    const l = lMap.get(id);
    const r = rMap.get(id);
    if (l && !r) {
      merged.push(l);
      dePush.push(l);
    } else if (!l && r) {
      merged.push(r);
      dePull.push(r);
    } else if (l && r) {
      const win = alegeInvingator(l, r);
      merged.push(win);
      if (win === l && (l.version !== r.version || l.updatedAt !== r.updatedAt)) dePush.push(l);
      else if (win === r && (l.version !== r.version || l.updatedAt !== r.updatedAt))
        dePull.push(r);
    }
  }

  return { merged, dePush, dePull };
}

/** Inregistrarile active (fara tombstones), pentru afisare. */
export function active<T extends Versionat>(inregistrari: readonly T[]): T[] {
  return inregistrari.filter((r) => !r.deletedAt);
}

/** Aplica modificari primite peste un store local (LWW), returnand noul store. */
export function aplica<T extends Versionat>(store: readonly T[], modificari: readonly T[]): T[] {
  const map = new Map(store.map((r) => [r.id, r]));
  for (const m of modificari) {
    const existing = map.get(m.id);
    map.set(m.id, existing ? alegeInvingator(existing, m) : m);
  }
  return [...map.values()];
}

/** Marcheaza o modificare locala: bumpeaza versiunea si updatedAt. */
export function modificaLocal<T extends Versionat>(inregistrare: T, acum = new Date()): T {
  return { ...inregistrare, version: inregistrare.version + 1, updatedAt: acum.toISOString() };
}

/** Marcheaza o stergere locala (tombstone). */
export function stergeLocal<T extends Versionat>(inregistrare: T, acum = new Date()): T {
  return {
    ...inregistrare,
    version: inregistrare.version + 1,
    updatedAt: acum.toISOString(),
    deletedAt: acum.toISOString(),
  };
}
