/**
 * Construieste intrarea e-Factura (EFacturaInput) dintr-un document de vanzare
 * POSTAT + firma emitenta + partenerul cumparator, si valideaza STRUCTURAL
 * rezultatul. Generarea XML-ului ramane in `efactura.ts`.
 *
 * IMPORTANT: validarea de aici este STRUCTURALA (campuri obligatorii + coerenta
 * sume). NU inlocuieste validatorul oficial ANAF/SPV (schema XSD + reguli de
 * business CIUS-RO), care nu poate rula in acest mediu — vezi EXTERNAL_REVIEW_REQUIRED.
 */

import type { Document, DocumentLinie, Firma, Partener } from '@gr/core-domain';
import type { EFacturaInput, EFacturaLinie, EFacturaParte } from './efactura.js';

function parteDinFirma(f: Firma): EFacturaParte {
  return {
    nume: f.denumire,
    cui: f.cui || null,
    adresa: f.adresa,
    oras: f.localitate,
    judet: f.judet,
    tara: 'RO',
  };
}

function parteDinPartener(p: Partener): EFacturaParte {
  return {
    nume: p.denumire,
    cui: p.cui,
    cnp: p.cnp,
    adresa: p.adresa,
    oras: p.localitate,
    judet: p.judet,
    tara: p.tara,
  };
}

function linieEFactura(l: DocumentLinie): EFacturaLinie {
  return {
    denumire: l.denumire,
    cantitate: l.cantitate,
    unitateMasura: l.unitateMasura,
    pretUnitarBani: l.pretUnitarBani,
    cotaTvaProcent: l.cotaTvaProcent,
    netBani: l.netBani,
    tvaBani: l.tvaBani,
  };
}

export function construiesteEFacturaInput(
  doc: Document,
  linii: readonly DocumentLinie[],
  vanzator: Firma,
  cumparator: Partener,
): EFacturaInput {
  return {
    serieNumar: doc.cod,
    dataEmitere: doc.data,
    scadenta: doc.scadenta,
    moneda: 'RON',
    vanzator: parteDinFirma(vanzator),
    cumparator: parteDinPartener(cumparator),
    linii: linii.map(linieEFactura),
    totalNetBani: doc.totalNetBani,
    totalTvaBani: doc.totalTvaBani,
    totalBrutBani: doc.totalBrutBani,
  };
}

export interface ProblemaValidareEfactura {
  camp: string;
  mesaj: string;
}

/**
 * Validare STRUCTURALA (nu oficiala): campuri obligatorii + coerenta sumelor.
 * Intoarce lista problemelor; lista goala => structural valida.
 */
export function valideazaStructuralEFactura(input: EFacturaInput): ProblemaValidareEfactura[] {
  const probleme: ProblemaValidareEfactura[] = [];
  const add = (camp: string, mesaj: string) => probleme.push({ camp, mesaj });

  if (!input.serieNumar) add('serieNumar', 'lipseste seria/numarul facturii');
  if (!input.dataEmitere) add('dataEmitere', 'lipseste data emiterii');
  if (!input.vanzator.cui) add('vanzator.cui', 'emitentul (vanzatorul) trebuie sa aiba CUI');
  if (!input.vanzator.nume) add('vanzator.nume', 'lipseste denumirea vanzatorului');
  if (!input.cumparator.nume) add('cumparator.nume', 'lipseste denumirea cumparatorului');
  // B2B necesita CUI la cumparator; B2C accepta CNP. Lipsa ambelor => atentie.
  if (!input.cumparator.cui && !input.cumparator.cnp) {
    add('cumparator', 'cumparatorul nu are nici CUI (B2B), nici CNP (B2C)');
  }
  if (input.linii.length === 0) add('linii', 'factura nu are nicio linie');

  // Coerenta sumelor: net + TVA = brut, iar totalurile = suma liniilor.
  if (input.totalNetBani + input.totalTvaBani !== input.totalBrutBani) {
    add('totaluri', 'net + TVA != brut');
  }
  const sumaNet = input.linii.reduce((s, l) => s + l.netBani, 0);
  const sumaTva = input.linii.reduce((s, l) => s + l.tvaBani, 0);
  if (sumaNet !== input.totalNetBani) add('totalNetBani', 'totalul net difera de suma liniilor');
  if (sumaTva !== input.totalTvaBani) add('totalTvaBani', 'totalul TVA difera de suma liniilor');

  return probleme;
}
