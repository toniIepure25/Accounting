import type { OperatiuneCasa } from './entities/casa.js';
import type { Document, DocumentTip } from './entities/document.js';

/** Rand de jurnal (intrari/iesiri/cumparari/vanzari) — documente filtrate + totaluri. */
export interface RandJurnal {
  cod: string;
  data: string;
  partenerId: string | null;
  totalNetBani: number;
  totalTvaBani: number;
  totalBrutBani: number;
}

export interface TotalJurnal {
  netBani: number;
  tvaBani: number;
  brutBani: number;
}

/** Construieste un jurnal din documentele de tipurile cerute, intr-un interval. */
export function jurnal(
  documente: readonly Document[],
  tipuri: readonly DocumentTip[],
  interval?: { de?: string; pana?: string },
): { randuri: RandJurnal[]; total: TotalJurnal } {
  const set = new Set(tipuri);
  const randuri = documente
    .filter((d) => set.has(d.tip) && d.stare === 'validat')
    .filter((d) => (interval?.de ? d.data >= interval.de : true))
    .filter((d) => (interval?.pana ? d.data <= interval.pana : true))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((d) => ({
      cod: d.cod,
      data: d.data,
      partenerId: d.partenerId,
      totalNetBani: d.totalNetBani,
      totalTvaBani: d.totalTvaBani,
      totalBrutBani: d.totalBrutBani,
    }));

  const total = randuri.reduce<TotalJurnal>(
    (acc, r) => ({
      netBani: acc.netBani + r.totalNetBani,
      tvaBani: acc.tvaBani + r.totalTvaBani,
      brutBani: acc.brutBani + r.totalBrutBani,
    }),
    { netBani: 0, tvaBani: 0, brutBani: 0 },
  );

  return { randuri, total };
}

/** Sold partener = facturi (datorii/creante) - incasari/plati din casa. */
export interface SoldPartener {
  partenerId: string;
  debitBani: number; // facturat catre / de la
  creditBani: number; // incasat / platit
  soldBani: number;
}

/**
 * Balanta partenerilor pentru un tip de factura (cumparare -> furnizori,
 * vanzare -> clienti), reconciliata cu operatiunile de casa.
 */
export function balantaParteneri(
  documente: readonly Document[],
  operatiuniCasa: readonly OperatiuneCasa[],
  tipuriFactura: readonly DocumentTip[],
  tipCasa: 'incasare' | 'plata',
): SoldPartener[] {
  const set = new Set(tipuriFactura);
  const map = new Map<string, SoldPartener>();
  const get = (id: string) =>
    map.get(id) ??
    map.set(id, { partenerId: id, debitBani: 0, creditBani: 0, soldBani: 0 }).get(id)!;

  for (const d of documente) {
    if (set.has(d.tip) && d.stare === 'validat' && d.partenerId) {
      get(d.partenerId).debitBani += d.totalBrutBani;
    }
  }
  for (const op of operatiuniCasa) {
    if (op.tip === tipCasa && op.partenerId) {
      get(op.partenerId).creditBani += op.sumaBani;
    }
  }
  for (const s of map.values()) s.soldBani = s.debitBani - s.creditBani;
  return [...map.values()];
}

export interface RandInventar {
  categorie: string;
  denumire: string;
  valoareBani: number;
}

export interface RegistruInventar {
  data: string;
  randuri: RandInventar[];
  totalGeneralBani: number;
}

/**
 * Registru-inventar (legal, la o data — de obicei sfarsit de luna/an): aduna
 * intr-un singur document toate elementele patrimoniale evaluate — stocuri,
 * mijloace fixe (valoare ramasa), creante (clienti), datorii (furnizori,
 * cu semn negativ — se scad din patrimoniu), disponibilitati banesti. Fiecare
 * categorie e deja calculata in altă parte (soldStoc/CMP, balantaParteneri,
 * registruCasa, mijloace fixe) — functia doar le structureaza legal si
 * calculeaza totalul general.
 */
export function registruInventar(
  data: string,
  categorii: readonly {
    categorie: string;
    randuri: readonly { denumire: string; valoareBani: number }[];
  }[],
): RegistruInventar {
  const randuri: RandInventar[] = categorii.flatMap((c) =>
    c.randuri.map((r) => ({
      categorie: c.categorie,
      denumire: r.denumire,
      valoareBani: r.valoareBani,
    })),
  );
  const totalGeneralBani = randuri.reduce((a, r) => a + r.valoareBani, 0);
  return { data, randuri, totalGeneralBani };
}

/** Registru de casa: operatiuni ordonate cu sold curent (rulant). */
export function registruCasa(
  operatiuni: readonly OperatiuneCasa[],
  soldInitialBani = 0,
): { operatiuni: (OperatiuneCasa & { soldBani: number })[]; soldFinalBani: number } {
  let sold = soldInitialBani;
  const rows = [...operatiuni]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((op) => {
      sold += op.tip === 'incasare' ? op.sumaBani : -op.sumaBani;
      return { ...op, soldBani: sold };
    });
  return { operatiuni: rows, soldFinalBani: sold };
}
