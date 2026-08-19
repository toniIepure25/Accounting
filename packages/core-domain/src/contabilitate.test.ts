import { describe, expect, it } from 'vitest';
import {
  balantaVerificare,
  fisaCont,
  genereazaNoteAmortizare,
  genereazaNoteContabile,
} from './contabilitate.js';
import type { OperatiuneCasa } from './entities/casa.js';
import type { Document } from './entities/document.js';
import type { MijlocFix } from './entities/mijloc-fix.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';

const docs: Document[] = [
  {
    id: 'd1',
    tip: 'receptie_furnizor',
    stare: 'validat',
    cod: 'NIR-1',
    data: '2026-02-05',
    totalNetBani: 700000,
    totalTvaBani: 133000,
    totalBrutBani: 833000,
  } as Document,
  {
    id: 'd2',
    tip: 'factura_vanzare',
    stare: 'validat',
    cod: 'FCT-1',
    data: '2026-03-01',
    totalNetBani: 10000,
    totalTvaBani: 1900,
    totalBrutBani: 11900,
  } as Document,
  {
    id: 'd3',
    tip: 'factura_vanzare',
    stare: 'ciorna',
    cod: 'FCT-2',
    data: '2026-03-02',
    totalBrutBani: 5000,
  } as Document,
];
const casa: FaraCampuriSync<OperatiuneCasa>[] = [
  {
    id: 'o1',
    tip: 'incasare',
    data: '2026-03-05',
    sumaBani: 5000,
    document: 'FCT-1',
  } as OperatiuneCasa,
];

describe('partida dubla', () => {
  it('genereaza note doar pentru documentele validate', () => {
    const note = genereazaNoteContabile(docs, casa);
    // NIR + FCT-1 + incasare = 3 note (FCT-2 e ciorna)
    expect(note).toHaveLength(3);
  });

  it('nota de vanzare: 4111 = D, 707 + 4427 = C', () => {
    const note = genereazaNoteContabile(docs, []);
    const vanzare = note.find((n) => n.documentCod === 'FCT-1')!;
    const d4111 = vanzare.postari.find((p) => p.cont === '4111')!;
    expect(d4111.debitBani).toBe(11900);
    expect(vanzare.postari.find((p) => p.cont === '707')!.creditBani).toBe(10000);
    expect(vanzare.postari.find((p) => p.cont === '4427')!.creditBani).toBe(1900);
  });

  it('respecta invariantul partidei duble (D = C)', () => {
    const note = genereazaNoteContabile(docs, casa);
    let debit = 0;
    let credit = 0;
    for (const n of note)
      for (const p of n.postari) {
        debit += p.debitBani;
        credit += p.creditBani;
      }
    expect(debit).toBe(credit);
  });

  it('descarcarea de gestiune adauga 607 / stoc la vanzare', () => {
    const note = genereazaNoteContabile(docs, [], {
      costIesireBani: (id) => (id === 'd2' ? 6000 : 0),
    });
    const vanzare = note.find((n) => n.documentCod === 'FCT-1')!;
    expect(vanzare.postari.find((p) => p.cont === '607')!.debitBani).toBe(6000);
    expect(vanzare.postari.find((p) => p.cont === '371' && p.creditBani === 6000)).toBeTruthy();
  });

  it('bon de consum foloseste costul CMP (costIesireBani), nu pretul de pe linie', () => {
    const bon = {
      id: 'd4',
      tip: 'bon_consum',
      stare: 'validat',
      cod: 'BC-1',
      data: '2026-03-03',
      totalNetBani: 9999,
      totalTvaBani: 0,
      totalBrutBani: 9999,
    } as Document;
    const note = genereazaNoteContabile([bon], [], {
      costIesireBani: (id) => (id === 'd4' ? 4200 : 0),
    });
    const consum = note.find((n) => n.documentCod === 'BC-1')!;
    expect(consum.postari.find((p) => p.cont === '601')!.debitBani).toBe(4200);
    expect(consum.postari.find((p) => p.cont === '371')!.creditBani).toBe(4200);
  });

  it('factura de cumparare legata de un NIR validat nu mai genereaza a doua nota de achizitie', () => {
    const nir = {
      id: 'n1',
      tip: 'receptie_furnizor',
      stare: 'validat',
      cod: 'NIR-2',
      data: '2026-04-01',
      totalNetBani: 1000,
      totalTvaBani: 190,
      totalBrutBani: 1190,
    } as Document;
    const facturaLegata = {
      id: 'f1',
      tip: 'factura_cumparare',
      stare: 'validat',
      cod: 'FC-1',
      data: '2026-04-02',
      totalNetBani: 1000,
      totalTvaBani: 190,
      totalBrutBani: 1190,
      documentSursaId: 'n1',
    } as Document;
    const facturaIndependenta = {
      id: 'f2',
      tip: 'factura_cumparare',
      stare: 'validat',
      cod: 'FC-2',
      data: '2026-04-02',
      totalNetBani: 500,
      totalTvaBani: 95,
      totalBrutBani: 595,
    } as Document;

    const note = genereazaNoteContabile([nir, facturaLegata, facturaIndependenta], []);
    // NIR + factura independenta = 2 note de achizitie; factura legata de NIR nu mai genereaza una a treia.
    expect(note).toHaveLength(2);
    expect(note.find((n) => n.documentCod === 'FC-1')).toBeUndefined();
    expect(note.find((n) => n.documentCod === 'NIR-2')).toBeTruthy();
    expect(note.find((n) => n.documentCod === 'FC-2')).toBeTruthy();
  });

  it('balanta de verificare: solduri corecte', () => {
    const b = balantaVerificare(genereazaNoteContabile(docs, casa));
    const c4111 = b.find((r) => r.cont === '4111')!;
    // 11900 debit - 5000 credit = 6900 sold debitor
    expect(c4111.soldDebitorBani).toBe(6900);
    const c401 = b.find((r) => r.cont === '401')!;
    expect(c401.soldCreditorBani).toBe(833000);
  });

  it('fisa de cont pentru 4111', () => {
    const f = fisaCont(genereazaNoteContabile(docs, casa), '4111');
    expect(f).toHaveLength(2);
    expect(f[f.length - 1]!.soldBani).toBe(6900);
  });

  it('documentul nota_amortizare genereaza 681=D / 281=C in genereazaNoteContabile', () => {
    const nota = {
      id: 'na1',
      tip: 'nota_amortizare',
      stare: 'validat',
      cod: 'AMZ-2026-000001',
      data: '2026-06-30',
      totalNetBani: 20_000,
      totalTvaBani: 0,
      totalBrutBani: 20_000,
    } as Document;
    const note = genereazaNoteContabile([nota], []);
    expect(note).toHaveLength(1);
    expect(note[0]!.postari.find((p) => p.cont === '681')!.debitBani).toBe(20_000);
    expect(note[0]!.postari.find((p) => p.cont === '281')!.creditBani).toBe(20_000);
  });

  it('genereazaNoteAmortizare: 681=D / 281=C pentru mijloace fixe active', () => {
    const mf: FaraCampuriSync<MijlocFix>[] = [
      {
        id: 'mf1',
        firmaId: null,
        cod: 'MF-1',
        denumire: 'CNC',
        categorie: '',
        valoareIntrareBani: 1_200_000,
        dataPunereFunctiune: '2026-01-01',
        durataNormalaLuni: 60,
        metodaAmortizare: 'liniara',
        coeficientDegresiv: 1,
        amortizareCumulataBani: 0,
        gestiuneId: null,
        activ: true,
        casat: false,
        dataCasare: null,
      },
      {
        id: 'mf2',
        firmaId: null,
        cod: 'MF-2',
        denumire: 'Casat',
        categorie: '',
        valoareIntrareBani: 500_000,
        dataPunereFunctiune: '2020-01-01',
        durataNormalaLuni: 12,
        metodaAmortizare: 'liniara',
        coeficientDegresiv: 1,
        amortizareCumulataBani: 500_000,
        gestiuneId: null,
        activ: true,
        casat: false,
        dataCasare: null,
      },
    ];
    const note = genereazaNoteAmortizare(mf, '2026-06-30');
    expect(note).toHaveLength(1); // mf2 e deja amortizat integral -> fara nota
    expect(note[0]!.documentCod).toBe('MF-1');
    expect(note[0]!.postari.find((p) => p.cont === '681')!.debitBani).toBe(20_000);
    expect(note[0]!.postari.find((p) => p.cont === '281')!.creditBani).toBe(20_000);
  });
});
