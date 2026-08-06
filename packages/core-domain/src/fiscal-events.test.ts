import { describe, expect, it } from 'vitest';
import type { Document, DocumentLinie } from './entities/document.js';
import {
  type EvenimentFiscal,
  decontDinEvenimente,
  directieTva,
  genereazaEvenimenteFiscaleDocument,
} from './fiscal-events.js';

function doc(over: Partial<Document>): Document {
  return {
    id: 'doc-1',
    firmaId: null,
    tip: 'factura_vanzare',
    serie: 'FV',
    numar: 1,
    cod: 'FV-1',
    data: '2025-09-10',
    partenerId: 'p1',
    gestiuneId: 'g1',
    gestiuneDestinatieId: null,
    punctDeLucruId: null,
    documentSursaId: null,
    scadenta: null,
    observatii: '',
    stare: 'validat',
    totalNetBani: 0,
    totalTvaBani: 0,
    totalBrutBani: 0,
    avansBani: 0,
    meta: '{}',
    version: 1,
    ...over,
  } as Document;
}

function linie(over: Partial<DocumentLinie>): DocumentLinie {
  return {
    id: crypto.randomUUID(),
    documentId: 'doc-1',
    firmaId: null,
    produsId: 'prod',
    denumire: 'x',
    unitateMasura: 'buc',
    cantitate: 1,
    pretUnitarBani: 10000,
    cotaTvaProcent: 21,
    pretIncludeTva: false,
    netBani: 10000,
    tvaBani: 2100,
    brutBani: 12100,
    ...over,
  } as DocumentLinie;
}

describe('directieTva', () => {
  it('vanzarile sunt colectata, receptiile deductibila', () => {
    expect(directieTva('factura_vanzare', false)).toBe('colectata');
    expect(directieTva('receptie_furnizor', false)).toBe('deductibila');
    expect(directieTva('proforma', false)).toBeNull();
  });

  it('factura de cumparare acoperita de NIR postat => nicio directie', () => {
    expect(directieTva('factura_cumparare', true)).toBeNull();
    expect(directieTva('factura_cumparare', false)).toBe('deductibila');
  });
});

describe('genereazaEvenimenteFiscaleDocument', () => {
  it('grupeaza pe cota si emite un eveniment per cota', () => {
    const ev = genereazaEvenimenteFiscaleDocument(doc({ tip: 'factura_vanzare' }), [
      linie({ cotaTvaProcent: 21, netBani: 10000, tvaBani: 2100 }),
      linie({ cotaTvaProcent: 11, netBani: 5000, tvaBani: 550 }),
      linie({ cotaTvaProcent: 21, netBani: 2000, tvaBani: 420 }),
    ]);
    expect(ev).toHaveLength(2);
    const e21 = ev.find((e) => e.cotaProcent === 21)!;
    expect(e21.directie).toBe('colectata');
    expect(e21.bazaBani).toBe(12000);
    expect(e21.tvaBani).toBe(2520);
  });

  it('factura acoperita de NIR => niciun eveniment', () => {
    const ev = genereazaEvenimenteFiscaleDocument(doc({ tip: 'factura_cumparare' }), [linie({})], {
      sursaEsteNirPostat: true,
    });
    expect(ev).toHaveLength(0);
  });

  it('propaga tara + context (pentru D390)', () => {
    const ev = genereazaEvenimenteFiscaleDocument(doc({ tip: 'factura_vanzare' }), [linie({})], {
      tara: 'DE',
      context: 'intracomunitar',
    });
    expect(ev[0]!.tara).toBe('DE');
    expect(ev[0]!.context).toBe('intracomunitar');
  });
});

describe('decontDinEvenimente', () => {
  const ev = (over: Partial<EvenimentFiscal>): EvenimentFiscal => ({
    documentId: 'd',
    data: '2025-09-10',
    directie: 'colectata',
    cotaProcent: 21,
    categorieFiscala: null,
    bazaBani: 10000,
    tvaBani: 2100,
    partenerId: null,
    tara: 'RO',
    context: 'intern',
    ...over,
  });

  it('insumeaza colectata vs deductibila si calculeaza soldul', () => {
    const d = decontDinEvenimente([
      ev({ directie: 'colectata', tvaBani: 2100 }),
      ev({ directie: 'deductibila', tvaBani: 800 }),
    ]);
    expect(d.tvaColectataBani).toBe(2100);
    expect(d.tvaDeductibilaBani).toBe(800);
    expect(d.dePlataBani).toBe(1300);
    expect(d.deRecuperatBani).toBe(0);
  });

  it('TVA de recuperat cand deductibila > colectata', () => {
    const d = decontDinEvenimente([
      ev({ directie: 'colectata', tvaBani: 500 }),
      ev({ directie: 'deductibila', tvaBani: 900 }),
    ]);
    expect(d.deRecuperatBani).toBe(400);
    expect(d.dePlataBani).toBe(0);
  });
});
