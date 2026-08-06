import { describe, expect, it } from 'vitest';
import { CONT } from './contabilitate.js';
import type { Document } from './entities/document.js';
import { NotaDezechilibrataError, genereazaNotaDocument, notaEchilibrata } from './journal.js';

function doc(over: Partial<Document>): Document {
  return {
    id: 'doc-1',
    firmaId: null,
    tip: 'factura_vanzare',
    serie: 'FV',
    numar: 1,
    cod: 'FV-1',
    data: '2026-03-01',
    partenerId: 'p1',
    gestiuneId: 'g1',
    gestiuneDestinatieId: null,
    punctDeLucruId: null,
    documentSursaId: null,
    scadenta: null,
    observatii: '',
    stare: 'validat',
    totalNetBani: 10000,
    totalTvaBani: 2100,
    totalBrutBani: 12100,
    avansBani: 0,
    meta: '{}',
    version: 1,
    ...over,
  } as Document;
}

const suma = (
  postari: { debitBani: number; creditBani: number }[],
  k: 'debitBani' | 'creditBani',
) => postari.reduce((s, p) => s + p[k], 0);

describe('genereazaNotaDocument — note echilibrate per document', () => {
  it('achizitie (receptie furnizor): 371 + 4426 = 401, echilibrata', () => {
    const n = genereazaNotaDocument(doc({ tip: 'receptie_furnizor' }))!;
    expect(n.postari).toHaveLength(3);
    expect(suma(n.postari, 'debitBani')).toBe(suma(n.postari, 'creditBani'));
    expect(n.postari.find((p) => p.cont === CONT.FURNIZORI)!.creditBani).toBe(12100);
  });

  it('vanzare cu descarcare de gestiune (cost CMP) — echilibrata', () => {
    const n = genereazaNotaDocument(doc({ tip: 'factura_vanzare' }), { costIesireBani: 6000 })!;
    // 4111 D 12100 ; 707 C 10000 ; 4427 C 2100 ; 607 D 6000 ; 371 C 6000
    expect(suma(n.postari, 'debitBani')).toBe(suma(n.postari, 'creditBani'));
    expect(n.postari.find((p) => p.cont === CONT.CHELT_MARFURI)!.debitBani).toBe(6000);
  });

  it('factura de cumparare legata de un NIR postat => nicio nota (fara dubla achizitie)', () => {
    const n = genereazaNotaDocument(doc({ tip: 'factura_cumparare', documentSursaId: 'nir-1' }), {
      sursaEsteNirPostat: true,
    });
    expect(n).toBeNull();
  });

  it('factura de cumparare fara NIR => nota de achizitie normala', () => {
    const n = genereazaNotaDocument(doc({ tip: 'factura_cumparare' }), {
      sursaEsteNirPostat: false,
    });
    expect(n).not.toBeNull();
    expect(suma(n!.postari, 'debitBani')).toBe(suma(n!.postari, 'creditBani'));
  });

  it('tipurile fara efect financiar (transfer, proforma) nu produc nota', () => {
    expect(genereazaNotaDocument(doc({ tip: 'receptie_transfer' }))).toBeNull();
    expect(genereazaNotaDocument(doc({ tip: 'proforma' }))).toBeNull();
  });

  it('notaEchilibrata detecteaza dezechilibrul', () => {
    expect(notaEchilibrata([{ cont: 'x', debitBani: 5, creditBani: 5 }])).toBe(true);
    expect(notaEchilibrata([{ cont: 'x', debitBani: 5, creditBani: 4 }])).toBe(false);
  });

  it('NotaDezechilibrataError e disponibila pentru garda de aplicatie', () => {
    expect(new NotaDezechilibrataError('X', 5, 4)).toBeInstanceOf(Error);
  });
});
