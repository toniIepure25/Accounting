import type { Document, DocumentTip, Partener } from '@gr/core-domain';

/**
 * D390 (VIES) — declaratie recapitulativa privind operatiunile intracomunitare.
 * Declaratie DE LUCRU: grupeaza documentele validate pe parteneri din alte
 * state membre UE (Partener.tara != 'RO'), cu codul de TVA intracomunitar.
 * Formatul exact de depunere (XML declaratia unica ANAF, coduri de operatiune
 * L/A/S) trebuie confirmat la depunere.
 */
export interface RandD390 {
  partenerId: string;
  denumire: string;
  tara: string;
  codTvaIntracomunitar: string | null;
  operatiune: 'livrare' | 'achizitie';
  nrDocumente: number;
  bazaBani: number;
}

const VANZARI: DocumentTip[] = ['factura_vanzare', 'vanzare_amanunt'];
const CUMPARARI: DocumentTip[] = ['factura_cumparare', 'receptie_furnizor'];

/**
 * Operatiuni intracomunitare (livrari catre / achizitii de la parteneri din
 * alte state UE), grupate pe partener, pentru o perioada.
 */
export function sumarD390(
  documente: readonly Document[],
  parteneri: readonly Partener[],
  interval?: { de?: string; pana?: string },
): RandD390[] {
  const inInterval = (d: Document) =>
    (interval?.de ? d.data >= interval.de : true) &&
    (interval?.pana ? d.data <= interval.pana : true);
  const parteneriUE = new Map(parteneri.filter((p) => p.tara !== 'RO').map((p) => [p.id, p]));
  const map = new Map<string, RandD390>();

  for (const d of documente) {
    if (d.stare !== 'validat' || !inInterval(d) || !d.partenerId) continue;
    const p = parteneriUE.get(d.partenerId);
    if (!p) continue; // partener din RO -> nu e operatiune intracomunitara

    const operatiune: 'livrare' | 'achizitie' | null = VANZARI.includes(d.tip)
      ? 'livrare'
      : CUMPARARI.includes(d.tip)
        ? 'achizitie'
        : null;
    if (!operatiune) continue;

    const cheie = `${p.id}::${operatiune}`;
    const r =
      map.get(cheie) ??
      map
        .set(cheie, {
          partenerId: p.id,
          denumire: p.denumire,
          tara: p.tara,
          codTvaIntracomunitar: p.codTvaIntracomunitar,
          operatiune,
          nrDocumente: 0,
          bazaBani: 0,
        })
        .get(cheie)!;
    r.nrDocumente += 1;
    r.bazaBani += d.totalNetBani;
  }
  return [...map.values()].sort((a, b) => a.denumire.localeCompare(b.denumire));
}
