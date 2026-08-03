import type { Document, DocumentLinie } from '@gr/core-domain';

/** Rezultatul decontului de TVA pe o perioada. */
export interface DecontTVA {
  tvaColectataBani: number;
  tvaDeductibilaBani: number;
  /** > 0 => TVA de plata; 0 altfel. */
  dePlataBani: number;
  /** > 0 => TVA de recuperat; 0 altfel. */
  deRecuperatBani: number;
}

const VANZARI: Document['tip'][] = ['factura_vanzare', 'vanzare_amanunt'];
const CUMPARARI: Document['tip'][] = ['factura_cumparare', 'receptie_furnizor'];

/** Calculeaza decontul de TVA din documentele validate, optional pe interval. */
export function decontTVA(
  documente: readonly Document[],
  interval?: { de?: string; pana?: string },
): DecontTVA {
  const inInterval = (d: Document) =>
    (interval?.de ? d.data >= interval.de : true) &&
    (interval?.pana ? d.data <= interval.pana : true);

  let colectata = 0;
  let deductibila = 0;
  for (const d of documente) {
    if (d.stare !== 'validat' || !inInterval(d)) continue;
    if (VANZARI.includes(d.tip)) colectata += d.totalTvaBani;
    else if (CUMPARARI.includes(d.tip)) deductibila += d.totalTvaBani;
  }

  const sold = colectata - deductibila;
  return {
    tvaColectataBani: colectata,
    tvaDeductibilaBani: deductibila,
    dePlataBani: sold > 0 ? sold : 0,
    deRecuperatBani: sold < 0 ? -sold : 0,
  };
}

/** Un rand din decontul detaliat, pe o singura cota de TVA. */
export interface RandDecontCota {
  cotaProcent: number;
  bazaBani: number;
  tvaBani: number;
}

export interface DecontTVADetaliat extends DecontTVA {
  colectataPeCota: RandDecontCota[];
  deductibilaPeCota: RandDecontCota[];
}

function grupeazaPeCota(
  documente: readonly Document[],
  linii: readonly DocumentLinie[],
  tipuri: readonly Document['tip'][],
  inInterval: (d: Document) => boolean,
): RandDecontCota[] {
  const map = new Map<number, RandDecontCota>();
  const idDoc = new Set(
    documente
      .filter((d) => d.stare === 'validat' && inInterval(d) && tipuri.includes(d.tip))
      .map((d) => d.id),
  );
  for (const l of linii) {
    if (!idDoc.has(l.documentId)) continue;
    const r = map.get(l.cotaTvaProcent) ?? {
      cotaProcent: l.cotaTvaProcent,
      bazaBani: 0,
      tvaBani: 0,
    };
    r.bazaBani += l.netBani;
    r.tvaBani += l.tvaBani;
    map.set(l.cotaTvaProcent, r);
  }
  return [...map.values()].sort((a, b) => b.cotaProcent - a.cotaProcent);
}

/**
 * Decont de TVA detaliat pe cote (19/9/5/0) — baza de lucru pentru formularul
 * D300. Necesita liniile documentelor (nu doar totalurile), ca sa poata
 * defalca baza si TVA pe fiecare cota folosita. Nota: aceasta e o declaratie
 * DE LUCRU (structura si sumele sunt corecte), nu XML-ul oficial D300 — formatul
 * exact de depunere (declaratia unica ANAF) trebuie confirmat la depunere.
 */
export function decontTVADetaliat(
  documente: readonly Document[],
  linii: readonly DocumentLinie[],
  interval?: { de?: string; pana?: string },
): DecontTVADetaliat {
  const de = decontTVA(documente, interval);
  const inInterval = (d: Document) =>
    (interval?.de ? d.data >= interval.de : true) &&
    (interval?.pana ? d.data <= interval.pana : true);
  return {
    ...de,
    colectataPeCota: grupeazaPeCota(documente, linii, VANZARI, inInterval),
    deductibilaPeCota: grupeazaPeCota(documente, linii, CUMPARARI, inInterval),
  };
}
