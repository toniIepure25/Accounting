import { type Document, type DocumentLinie, directieStoc } from './entities/document.js';
import type { Bani } from './money.js';
import type { MiscareStoc } from './stock.js';
import { calculLinie, totalizeazaLinii } from './tva.js';

/** Recalculeaza net/TVA/brut pentru o linie de document. */
export function recalculLinie(linie: DocumentLinie): DocumentLinie {
  const r = calculLinie({
    cantitate: linie.cantitate,
    pretUnitarBani: linie.pretUnitarBani as Bani,
    cotaTvaProcent: linie.cotaTvaProcent,
    pretIncludeTva: linie.pretIncludeTva,
  });
  return { ...linie, netBani: r.netBani, tvaBani: r.tvaBani, brutBani: r.brutBani };
}

/** Totalurile unui document pe baza liniilor. */
export function recalculDocument(linii: readonly DocumentLinie[]): {
  totalNetBani: number;
  totalTvaBani: number;
  totalBrutBani: number;
} {
  const t = totalizeazaLinii(
    linii.map((l) => ({
      netBani: l.netBani as Bani,
      tvaBani: l.tvaBani as Bani,
      brutBani: l.brutBani as Bani,
    })),
  );
  return { totalNetBani: t.netBani, totalTvaBani: t.tvaBani, totalBrutBani: t.brutBani };
}

/**
 * Genereaza miscarile de stoc pentru un document validat. Transferul produce o
 * iesire din gestiunea sursa si o intrare in gestiunea destinatie. Valoarea
 * intrarilor este pe baza netului (cost); iesirile raman 0 si se evalueaza CMP.
 */
export function genereazaMiscari(doc: Document, linii: readonly DocumentLinie[]): MiscareStoc[] {
  const dir = directieStoc(doc.tip);
  const miscari: MiscareStoc[] = [];

  for (const l of linii) {
    if (!l.produsId) continue;

    if (doc.tip === 'receptie_transfer' && doc.gestiuneId && doc.gestiuneDestinatieId) {
      miscari.push(mk(doc, l, doc.gestiuneId, -Math.abs(l.cantitate), 0));
      miscari.push(mk(doc, l, doc.gestiuneDestinatieId, Math.abs(l.cantitate), l.netBani));
      continue;
    }

    if (doc.tip === 'plus_minus' && doc.gestiuneId) {
      // semnul rezulta din cantitatea liniei (poate fi negativa la minus)
      const val = l.cantitate >= 0 ? l.netBani : 0;
      miscari.push(mk(doc, l, doc.gestiuneId, l.cantitate, val));
      continue;
    }

    if (dir === 0 || !doc.gestiuneId) continue;
    const cantitate = dir * Math.abs(l.cantitate);
    const valoare = dir > 0 ? l.netBani : 0; // iesirile se evalueaza CMP
    miscari.push(mk(doc, l, doc.gestiuneId, cantitate, valoare));
  }

  return miscari;
}

/**
 * Data-limita globala de inchidere de perioada — cea mai recenta dintre toate
 * firmele. Multi-firma nu scopeaza inca datele per firma (vezi firma.ts), deci
 * o inchidere de perioada pe ORICE firma se aplica global tuturor documentelor
 * — o simplificare conservatoare si onesta pana cand scoparea reala exista.
 */
export function celMaiRecentBlocaj(
  firme: readonly { perioadaBlocataPanaLa: string | null }[],
): string | null {
  const date = firme.map((f) => f.perioadaBlocataPanaLa).filter((d): d is string => Boolean(d));
  return date.length > 0 ? date.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Un document e blocat (perioada inchisa) daca data lui <= data-limita de blocare. */
export function documentBlocat(dataDoc: string, blocatPanaLa: string | null): boolean {
  return blocatPanaLa != null && dataDoc <= blocatPanaLa;
}

function mk(
  doc: Document,
  l: DocumentLinie,
  gestiuneId: string,
  cantitate: number,
  valoareBani: number,
): MiscareStoc {
  return {
    id: crypto.randomUUID(),
    data: doc.data,
    gestiuneId,
    produsId: l.produsId!,
    documentId: doc.id,
    documentCod: doc.cod,
    tip: doc.tip,
    cantitate,
    valoareBani,
  };
}
