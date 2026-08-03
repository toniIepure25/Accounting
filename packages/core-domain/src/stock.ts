import type { Bani } from './money.js';

/** O miscare de stoc (generata din documente la validare). */
export interface MiscareStoc {
  id: string;
  data: string; // ISO
  gestiuneId: string;
  produsId: string;
  documentId: string;
  documentCod: string;
  tip: string; // tipul documentului sursa
  /** Cantitate cu semn: pozitiv intrare, negativ iesire. */
  cantitate: number;
  /** Valoare cu semn (bani). La iesiri se completeaza de motorul CMP. */
  valoareBani: number;
}

export interface SoldStoc {
  gestiuneId: string;
  produsId: string;
  cantitate: number;
  valoareBani: number;
  /** Pret mediu ponderat (bani / unitate). */
  pmpBani: number;
}

const key = (g: string, p: string) => `${g}::${p}`;

/**
 * Ruleaza miscarile in ordine cronologica si calculeaza soldurile in metoda
 * pretului mediu ponderat (CMP). Pentru iesirile fara valoare data, valoarea se
 * calculeaza la CMP-ul curent. Returneaza soldurile finale si miscarile evaluate.
 */
export function ruleazaStoc(miscari: readonly MiscareStoc[]): {
  solduri: SoldStoc[];
  miscariEvaluate: MiscareStoc[];
} {
  const acc = new Map<string, { cantitate: number; valoareBani: number }>();
  const ordonate = [...miscari].sort((a, b) => a.data.localeCompare(b.data));
  const miscariEvaluate: MiscareStoc[] = [];

  for (const m of ordonate) {
    const k = key(m.gestiuneId, m.produsId);
    const cur = acc.get(k) ?? { cantitate: 0, valoareBani: 0 };
    let valoare = m.valoareBani;

    if (m.cantitate >= 0) {
      // intrare: adauga cantitatea si valoarea data
      cur.cantitate += m.cantitate;
      cur.valoareBani += valoare;
    } else {
      // iesire: evalueaza la CMP curent daca nu are valoare
      const pmp = cur.cantitate > 0 ? cur.valoareBani / cur.cantitate : 0;
      if (valoare === 0) valoare = Math.round(m.cantitate * pmp);
      cur.cantitate += m.cantitate; // m.cantitate e negativ
      cur.valoareBani += valoare; // valoare e negativa
      if (cur.cantitate <= 0) {
        cur.cantitate = Math.max(cur.cantitate, 0);
        cur.valoareBani = Math.max(cur.valoareBani, 0);
      }
    }

    acc.set(k, cur);
    miscariEvaluate.push({ ...m, valoareBani: valoare });
  }

  const solduri: SoldStoc[] = [...acc.entries()].map(([k, v]) => {
    const [gestiuneId, produsId] = k.split('::');
    return {
      gestiuneId: gestiuneId!,
      produsId: produsId!,
      cantitate: v.cantitate,
      valoareBani: v.valoareBani as Bani,
      pmpBani: v.cantitate > 0 ? Math.round(v.valoareBani / v.cantitate) : 0,
    };
  });

  return { solduri, miscariEvaluate };
}

/** Soldul curent pentru o pereche gestiune+produs (0 daca lipseste). */
export function soldProdus(
  solduri: readonly SoldStoc[],
  gestiuneId: string,
  produsId: string,
): SoldStoc {
  return (
    solduri.find((s) => s.gestiuneId === gestiuneId && s.produsId === produsId) ?? {
      gestiuneId,
      produsId,
      cantitate: 0,
      valoareBani: 0,
      pmpBani: 0,
    }
  );
}
