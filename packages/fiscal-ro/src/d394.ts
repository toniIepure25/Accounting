import type { Document, DocumentTip, Partener } from '@gr/core-domain';

/**
 * D394 — Declaratie informativa privind livrarile/achizitiile pe teritoriul
 * national. Aceasta e o declaratie DE LUCRU: grupeaza documentele validate pe
 * partener (cu CUI), pentru o perioada — sumele si gruparea sunt corecte;
 * formatul exact de depunere (XML declaratia unica ANAF, sectiunile A/B dupa
 * statutul de platitor TVA al partenerului) trebuie confirmat la depunere.
 */
export interface RandD394 {
  partenerId: string;
  denumire: string;
  cui: string | null;
  platitorTva: boolean;
  nrDocumente: number;
  bazaBani: number;
  tvaBani: number;
  totalBani: number;
}

const VANZARI: DocumentTip[] = ['factura_vanzare', 'vanzare_amanunt'];
const CUMPARARI: DocumentTip[] = ['factura_cumparare', 'receptie_furnizor'];

function sumar(
  documente: readonly Document[],
  parteneri: readonly Partener[],
  tipuri: readonly DocumentTip[],
  interval?: { de?: string; pana?: string },
): RandD394[] {
  const inInterval = (d: Document) =>
    (interval?.de ? d.data >= interval.de : true) &&
    (interval?.pana ? d.data <= interval.pana : true);
  const parteneriById = new Map(parteneri.map((p) => [p.id, p]));
  const map = new Map<string, RandD394>();

  for (const d of documente) {
    if (d.stare !== 'validat' || !inInterval(d) || !tipuri.includes(d.tip) || !d.partenerId)
      continue;
    const p = parteneriById.get(d.partenerId);
    const r =
      map.get(d.partenerId) ??
      map
        .set(d.partenerId, {
          partenerId: d.partenerId,
          denumire: p?.denumire ?? d.partenerId,
          cui: p?.cui ?? null,
          platitorTva: p?.platitorTva ?? false,
          nrDocumente: 0,
          bazaBani: 0,
          tvaBani: 0,
          totalBani: 0,
        })
        .get(d.partenerId)!;
    r.nrDocumente += 1;
    r.bazaBani += d.totalNetBani;
    r.tvaBani += d.totalTvaBani;
    r.totalBani += d.totalBrutBani;
  }
  return [...map.values()].sort((a, b) => b.totalBani - a.totalBani);
}

/** Livrari (vanzari) grupate pe client, pentru D394. */
export function sumarD394Livrari(
  documente: readonly Document[],
  parteneri: readonly Partener[],
  interval?: { de?: string; pana?: string },
): RandD394[] {
  return sumar(documente, parteneri, VANZARI, interval);
}

/** Achizitii (cumparari) grupate pe furnizor, pentru D394. */
export function sumarD394Achizitii(
  documente: readonly Document[],
  parteneri: readonly Partener[],
  interval?: { de?: string; pana?: string },
): RandD394[] {
  return sumar(documente, parteneri, CUMPARARI, interval);
}
