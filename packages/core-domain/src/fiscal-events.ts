/**
 * Generarea PURA a evenimentelor fiscale ale unui document postat (Faza 7).
 * Un eveniment fiscal = un fapt de TVA pe o cota si o directie (colectata =
 * vanzari / iesire; deductibila = achizitii / intrare). Se grupeaza liniile pe
 * cota (snapshot-ul de pe linia postata) si se emite un eveniment per cota.
 *
 * Respecta ACEEASI potrivire 3-way ca jurnalul (contabilitate/journal): o factura
 * de cumparare acoperita de un NIR postat NU emite eveniment deductibil (NIR-ul a
 * generat deja faptul fiscal). Asa se elimina dubla numarare NIR<->factura la
 * baza declaratiilor (RK-07).
 */

import type { Document, DocumentLinie, DocumentTip } from './entities/document.js';

export type DirectieTva = 'colectata' | 'deductibila';

export interface EvenimentFiscal {
  documentId: string;
  data: string;
  directie: DirectieTva;
  cotaProcent: number;
  categorieFiscala: string | null;
  bazaBani: number;
  tvaBani: number;
  partenerId: string | null;
  tara: string;
  context: string;
}

export interface OptiuniEvenimenteFiscale {
  /** Factura de cumparare acoperita de un NIR postat => niciun eveniment deductibil. */
  sursaEsteNirPostat?: boolean;
  /** Tara partenerului (ISO2). Implicit 'RO'. Relevant pentru D390. */
  tara?: string;
  /** Contextul tranzactiei (intern/intracomunitar/export/import). Implicit 'intern'. */
  context?: string;
}

const VANZARI: readonly DocumentTip[] = ['factura_vanzare', 'vanzare_amanunt'];

/** Directia de TVA a unui document, sau `null` daca nu are efect de TVA. */
export function directieTva(tip: DocumentTip, sursaEsteNirPostat: boolean): DirectieTva | null {
  if (VANZARI.includes(tip)) return 'colectata';
  if (tip === 'receptie_furnizor') return 'deductibila';
  if (tip === 'factura_cumparare') return sursaEsteNirPostat ? null : 'deductibila';
  return null;
}

/**
 * Genereaza evenimentele fiscale ale unui document postat (unul per cota de TVA
 * folosita pe linii). Documentele fara efect de TVA (transfer/plus-minus/aviz/
 * proforma/comanda/livrare/amortizare) sau facturile acoperite de NIR nu produc
 * evenimente.
 */
export function genereazaEvenimenteFiscaleDocument(
  doc: Document,
  linii: readonly DocumentLinie[],
  optiuni: OptiuniEvenimenteFiscale = {},
): EvenimentFiscal[] {
  const directie = directieTva(doc.tip, optiuni.sursaEsteNirPostat ?? false);
  if (!directie) return [];

  const tara = optiuni.tara ?? 'RO';
  const context = optiuni.context ?? 'intern';

  // Grupeaza pe cota (snapshot-ul de pe linia postata).
  const peCota = new Map<number, { baza: number; tva: number }>();
  for (const l of linii) {
    const cur = peCota.get(l.cotaTvaProcent) ?? { baza: 0, tva: 0 };
    cur.baza += l.netBani;
    cur.tva += l.tvaBani;
    peCota.set(l.cotaTvaProcent, cur);
  }

  return [...peCota.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([cotaProcent, v]) => ({
      documentId: doc.id,
      data: doc.data,
      directie,
      cotaProcent,
      categorieFiscala: null,
      bazaBani: v.baza,
      tvaBani: v.tva,
      partenerId: doc.partenerId,
      tara,
      context,
    }));
}

/** Rezultatul decontului de TVA pe o perioada (din evenimente). */
export interface DecontDinEvenimente {
  tvaColectataBani: number;
  tvaDeductibilaBani: number;
  dePlataBani: number;
  deRecuperatBani: number;
  colectataPeCota: { cotaProcent: number; bazaBani: number; tvaBani: number }[];
  deductibilaPeCota: { cotaProcent: number; bazaBani: number; tvaBani: number }[];
}

/**
 * Decont de TVA (baza D300) calculat din evenimentele fiscale persistate — NU
 * din documente. Fara dubla numarare (evenimentele respecta deja potrivirea NIR).
 */
export function decontDinEvenimente(evenimente: readonly EvenimentFiscal[]): DecontDinEvenimente {
  const grup = (dir: DirectieTva) => {
    const map = new Map<number, { cotaProcent: number; bazaBani: number; tvaBani: number }>();
    let tva = 0;
    for (const e of evenimente) {
      if (e.directie !== dir) continue;
      const r = map.get(e.cotaProcent) ?? { cotaProcent: e.cotaProcent, bazaBani: 0, tvaBani: 0 };
      r.bazaBani += e.bazaBani;
      r.tvaBani += e.tvaBani;
      map.set(e.cotaProcent, r);
      tva += e.tvaBani;
    }
    return { peCota: [...map.values()].sort((a, b) => b.cotaProcent - a.cotaProcent), tva };
  };

  const colectata = grup('colectata');
  const deductibila = grup('deductibila');
  const sold = colectata.tva - deductibila.tva;
  return {
    tvaColectataBani: colectata.tva,
    tvaDeductibilaBani: deductibila.tva,
    dePlataBani: sold > 0 ? sold : 0,
    deRecuperatBani: sold < 0 ? -sold : 0,
    colectataPeCota: colectata.peCota,
    deductibilaPeCota: deductibila.peCota,
  };
}
