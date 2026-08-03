/**
 * Cote TVA Romania si calcul de linie de document.
 * Cotele sunt configurabile prin baza de date (tabela cote_tva); valorile de mai
 * jos sunt implicitele curente si servesc drept fallback / seed.
 */
import { type Bani, bani, roundHalfAwayFromZero, subBani } from './money.js';

export const COTE_TVA_RO = {
  STANDARD: 19,
  REDUSA_9: 9,
  REDUSA_5: 5,
  SCUTIT: 0,
} as const;

export type CotaTvaProcent = number;

export interface RezultatLinie {
  /** Baza fara TVA. */
  netBani: Bani;
  /** Valoarea TVA. */
  tvaBani: Bani;
  /** Total cu TVA. */
  brutBani: Bani;
}

export interface LinieInput {
  /** Cantitate (poate fi fractionara, ex. 2.5 kg). */
  cantitate: number;
  /** Pret unitar in bani. */
  pretUnitarBani: Bani;
  /** Cota TVA in procente (ex. 19). */
  cotaTvaProcent: CotaTvaProcent;
  /** Daca pretul unitar include deja TVA (uzual la vanzarea cu amanuntul). */
  pretIncludeTva?: boolean;
}

/** Calculeaza TVA-ul pornind de la baza neta. */
export function tvaDinNet(netBani: Bani, cotaProcent: CotaTvaProcent): Bani {
  return bani((netBani * cotaProcent) / 100);
}

/** Descompune o suma bruta (cu TVA) in net + TVA. */
export function tvaDinBrut(brutBani: Bani, cotaProcent: CotaTvaProcent): RezultatLinie {
  const net = bani(brutBani / (1 + cotaProcent / 100));
  return { netBani: net, tvaBani: subBani(brutBani, net), brutBani };
}

/** Calculeaza net / TVA / brut pentru o linie de document. */
export function calculLinie(input: LinieInput): RezultatLinie {
  const { cantitate, pretUnitarBani, cotaTvaProcent, pretIncludeTva = false } = input;

  if (pretIncludeTva) {
    const brut = roundHalfAwayFromZero(pretUnitarBani * cantitate) as Bani;
    return tvaDinBrut(brut, cotaTvaProcent);
  }

  const net = roundHalfAwayFromZero(pretUnitarBani * cantitate) as Bani;
  const tva = tvaDinNet(net, cotaTvaProcent);
  return { netBani: net, tvaBani: tva, brutBani: (net + tva) as Bani };
}

/** Totalizeaza mai multe linii (net, TVA, brut). */
export function totalizeazaLinii(linii: readonly RezultatLinie[]): RezultatLinie {
  return linii.reduce<RezultatLinie>(
    (acc, l) => ({
      netBani: (acc.netBani + l.netBani) as Bani,
      tvaBani: (acc.tvaBani + l.tvaBani) as Bani,
      brutBani: (acc.brutBani + l.brutBani) as Bani,
    }),
    { netBani: 0 as Bani, tvaBani: 0 as Bani, brutBani: 0 as Bani },
  );
}
