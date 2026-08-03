import { PLANURI } from './editions.js';
import type { LicentaPayload } from './license.js';

/**
 * Starea comerciala a unei licente in timp. Separata de validitatea
 * criptografica (license.ts): o licenta poate avea semnatura perfect valida si
 * totusi sa fie expirata, iar produsul trebuie sa se comporte gradual —
 * avertisment inainte de expirare, perioada de gratie dupa, si abia apoi
 * restrictionare. Un client care uita sa reinnoiasca nu trebuie sa ramana
 * brusc blocat in mijlocul unei zile de lucru.
 */

/** Cu cate zile inainte de expirare incepe avertismentul in UI. */
export const ZILE_AVERTISMENT = 30;
/** Cate zile dupa expirare raman complet functionale (perioada de gratie). */
export const ZILE_GRATIE = 14;

export type StareLicenta =
  /** Fara licenta activata — mod demo/evaluare. */
  | { stare: 'demo' }
  /** Licenta platita, valabila. `zileRamase: null` = perpetua. */
  | { stare: 'activa'; zileRamase: number | null }
  /** Licenta de evaluare, inca valabila. */
  | { stare: 'trial'; zileRamase: number }
  /** Valabila, dar expira in cel mult ZILE_AVERTISMENT zile. */
  | { stare: 'expira_curand'; zileRamase: number }
  /** Expirata, dar inca in perioada de gratie — totul functioneaza normal. */
  | { stare: 'gratie'; zileRamase: number }
  /** Expirata definitiv — produsul trece in doar-citire. */
  | { stare: 'expirata' };

const MS_ZI = 24 * 60 * 60 * 1000;

/** Zile intregi (rotunjite in sus) de la `de` pana la `pana`. Negativ daca `pana` a trecut. */
function zilePanaLa(de: Date, pana: Date): number {
  return Math.ceil((pana.getTime() - de.getTime()) / MS_ZI);
}

/** Determina starea comerciala a unei licente la un moment dat. */
export function stareLicenta(payload: LicentaPayload | null, acum = new Date()): StareLicenta {
  if (!payload) return { stare: 'demo' };
  if (!payload.expira) return { stare: 'activa', zileRamase: null };

  const zileRamase = zilePanaLa(acum, new Date(payload.expira));

  if (zileRamase > 0) {
    if (payload.trial) return { stare: 'trial', zileRamase };
    if (zileRamase <= ZILE_AVERTISMENT) return { stare: 'expira_curand', zileRamase };
    return { stare: 'activa', zileRamase };
  }

  const zileDeLaExpirare = -zileRamase;
  if (zileDeLaExpirare < ZILE_GRATIE) {
    return { stare: 'gratie', zileRamase: ZILE_GRATIE - zileDeLaExpirare };
  }
  return { stare: 'expirata' };
}

/**
 * Poate utilizatorul sa mai SCRIE date? Doar starea `expirata` blocheaza.
 * Citirea si exportul raman permise NECONDITIONAT in tot produsul — datele
 * contabile sunt ale clientului, iar o licenta neplatita nu e un motiv sa le
 * ia ostatice (si ar fi si problematic legal: obligatia de pastrare a
 * documentelor contabile e a firmei, nu a furnizorului de software).
 */
export function permiteScriere(stare: StareLicenta): boolean {
  return stare.stare !== 'expirata';
}

/**
 * Numarul maxim de utilizatori activi permis de o licenta: valoarea explicita
 * din payload daca exista, altfel cea inclusa in plan. `null` = nelimitat
 * (inclusiv pentru licentele vechi, emise inainte de introducerea planurilor).
 */
export function utilizatoriMaxPermisi(payload: LicentaPayload | null): number | null {
  if (!payload) return null;
  if (payload.utilizatoriMax !== undefined && payload.utilizatoriMax !== null) {
    return payload.utilizatoriMax;
  }
  return payload.plan ? PLANURI[payload.plan].utilizatoriIncluzi : null;
}

/** Mai poate fi adaugat inca un utilizator activ fara a depasi licenta? */
export function maiIncapeUnUtilizator(
  payload: LicentaPayload | null,
  utilizatoriActiviAcum: number,
): boolean {
  const max = utilizatoriMaxPermisi(payload);
  return max === null || utilizatoriActiviAcum < max;
}
