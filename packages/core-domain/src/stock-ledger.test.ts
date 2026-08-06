import { describe, expect, it } from 'vitest';
import type { Document, DocumentLinie } from './entities/document.js';
import {
  type SoldCurent,
  StocInsuficientError,
  cheieStoc,
  posteazaStocDocument,
} from './stock-ledger.js';

const G1 = 'gest-1';
const G2 = 'gest-2';
const P = 'prod-1';

function doc(over: Partial<Document>): Document {
  return {
    id: 'doc-1',
    firmaId: null,
    tip: 'receptie_furnizor',
    serie: '',
    numar: 1,
    cod: 'X',
    data: '2026-03-01',
    partenerId: null,
    gestiuneId: G1,
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
    produsId: P,
    denumire: 'Produs',
    unitateMasura: 'buc',
    cantitate: 10,
    pretUnitarBani: 1000,
    cotaTvaProcent: 21,
    pretIncludeTva: false,
    netBani: 10000,
    tvaBani: 2100,
    brutBani: 12100,
    ...over,
  } as DocumentLinie;
}

const bal = (entries: Array<[string, SoldCurent]>) => new Map(entries);

describe('posteazaStocDocument — CMP + registru append-only', () => {
  it('intrarea creste cantitatea, valoarea si stabileste CMP', () => {
    const r = posteazaStocDocument(
      doc({ tip: 'receptie_furnizor' }),
      [linie({ cantitate: 10, netBani: 10000 })], // 10 buc la 100.00 total => 10.00/buc
      bal([]),
    );
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.soldCantitateDupa).toBe(10);
    expect(r.entries[0]!.soldValoareBaniDupa).toBe(10000);
    expect(r.entries[0]!.pmpBaniDupa).toBe(1000); // 10.00/buc
  });

  it('iesirea se evalueaza la CMP curent (nu la valoarea liniei)', () => {
    // sold initial: 10 buc, 10000 bani => CMP 1000/buc
    const r = posteazaStocDocument(
      doc({ tip: 'factura_vanzare', gestiuneId: G1 }),
      [linie({ cantitate: 4, netBani: 99999 })], // netBani irelevant la iesire
      bal([[cheieStoc(G1, P), { cantitate: 10, valoareBani: 10000 }]]),
    );
    // iese 4 buc la CMP 1000 => -4000
    expect(r.entries[0]!.cantitate).toBe(-4);
    expect(r.entries[0]!.valoareBani).toBe(-4000);
    expect(r.entries[0]!.soldCantitateDupa).toBe(6);
    expect(r.entries[0]!.soldValoareBaniDupa).toBe(6000);
    expect(r.entries[0]!.pmpBaniDupa).toBe(1000);
  });

  it('CMP mediat corect dupa doua intrari la preturi diferite', () => {
    let solduri = bal([]);
    const r1 = posteazaStocDocument(
      doc({ tip: 'receptie_furnizor' }),
      [linie({ cantitate: 10, netBani: 10000 })], // 1000/buc
      solduri,
    );
    solduri = r1.balanteNoi;
    const r2 = posteazaStocDocument(
      doc({ id: 'doc-2', tip: 'receptie_furnizor' }),
      [linie({ cantitate: 10, netBani: 20000 })], // 2000/buc
      solduri,
    );
    // total 20 buc, 30000 bani => CMP 1500/buc
    expect(r2.entries[0]!.soldCantitateDupa).toBe(20);
    expect(r2.entries[0]!.soldValoareBaniDupa).toBe(30000);
    expect(r2.entries[0]!.pmpBaniDupa).toBe(1500);
  });
});

describe('transfer — conservarea valorii intre gestiuni', () => {
  it('iesirea din sursa si intrarea in destinatie au aceeasi valoare (CMP sursa)', () => {
    const r = posteazaStocDocument(
      doc({ tip: 'receptie_transfer', gestiuneId: G1, gestiuneDestinatieId: G2 }),
      [linie({ cantitate: 4, netBani: 0 })],
      bal([[cheieStoc(G1, P), { cantitate: 10, valoareBani: 15000 }]]), // CMP 1500
    );
    const out = r.entries.find((e) => e.gestiuneId === G1)!;
    const inn = r.entries.find((e) => e.gestiuneId === G2)!;
    expect(out.valoareBani).toBe(-6000); // 4 * 1500
    expect(inn.valoareBani).toBe(6000); // conservata
    expect(out.valoareBani + inn.valoareBani).toBe(0); // suma neta zero
    // valoarea totala pe cele doua gestiuni se pastreaza
    expect(inn.soldValoareBaniDupa).toBe(6000);
    expect(out.soldValoareBaniDupa).toBe(9000);
  });
});

describe('politica de stoc negativ — niciodata clamp tacit', () => {
  const iesire = () =>
    posteazaStocDocument(
      doc({ tip: 'factura_vanzare', gestiuneId: G1 }),
      [linie({ cantitate: 5 })],
      bal([[cheieStoc(G1, P), { cantitate: 3, valoareBani: 3000 }]]), // doar 3 in stoc
    );

  it('interzice (implicit): arunca StocInsuficientError', () => {
    expect(() => iesire()).toThrow(StocInsuficientError);
  });

  it('avertizeaza: permite dar raporteaza; soldul chiar merge sub zero (fara clamp)', () => {
    const r = posteazaStocDocument(
      doc({ tip: 'factura_vanzare', gestiuneId: G1 }),
      [linie({ cantitate: 5 })],
      bal([[cheieStoc(G1, P), { cantitate: 3, valoareBani: 3000 }]]),
      'avertizeaza',
    );
    expect(r.avertismente).toHaveLength(1);
    expect(r.entries[0]!.soldCantitateDupa).toBe(-2); // NU 0 — fara clamp
  });

  it('permite: sold sub zero fara avertisment', () => {
    const r = posteazaStocDocument(
      doc({ tip: 'factura_vanzare', gestiuneId: G1 }),
      [linie({ cantitate: 5 })],
      bal([[cheieStoc(G1, P), { cantitate: 3, valoareBani: 3000 }]]),
      'permite',
    );
    expect(r.avertismente).toHaveLength(0);
    expect(r.entries[0]!.soldCantitateDupa).toBe(-2);
  });
});
