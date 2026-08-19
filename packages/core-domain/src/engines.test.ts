import { describe, expect, it } from 'vitest';
import {
  celMaiRecentBlocaj,
  documentBlocat,
  genereazaMiscari,
  recalculDocument,
  recalculLinie,
} from './documents.js';
import type { OperatiuneCasa } from './entities/casa.js';
import type { Document, DocumentLinie } from './entities/document.js';
import type { ConfiguratieMobila, OptiuneConfigurator } from './entities/mobila.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';
import { calculPretConfiguratie, listaDebitare, restDePlata } from './mobila.js';
import { balantaParteneri, jurnal, registruCasa, registruInventar } from './reports.js';
import { type MiscareStoc, ruleazaStoc, soldProdus } from './stock.js';

function linie(over: Partial<DocumentLinie>): DocumentLinie {
  return recalculLinie({
    id: crypto.randomUUID(),
    documentId: 'doc',
    firmaId: null,
    produsId: 'prod-1',
    denumire: 'X',
    unitateMasura: 'buc',
    cantitate: 1,
    pretUnitarBani: 0,
    cotaTvaProcent: 19,
    pretIncludeTva: false,
    netBani: 0,
    tvaBani: 0,
    brutBani: 0,
    ...over,
  });
}

describe('stock CMP', () => {
  it('calculeaza sold si pret mediu ponderat', () => {
    const base = { produsId: 'p', gestiuneId: 'g', documentId: 'd', documentCod: 'c', tip: 'x' };
    const miscari: MiscareStoc[] = [
      { id: '1', data: '2026-01-01', cantitate: 10, valoareBani: 1000, ...base },
      { id: '2', data: '2026-01-02', cantitate: 10, valoareBani: 1200, ...base },
      { id: '3', data: '2026-01-03', cantitate: -5, valoareBani: 0, ...base },
    ];
    const { solduri } = ruleazaStoc(miscari);
    const s = soldProdus(solduri, 'g', 'p');
    expect(s.cantitate).toBe(15);
    expect(s.pmpBani).toBe(110);
    expect(s.valoareBani).toBe(1650); // 2200 - 5*110
  });
});

describe('documents', () => {
  it('recalculeaza linia si totalurile', () => {
    const l = linie({ cantitate: 3, pretUnitarBani: 1000, cotaTvaProcent: 19 });
    expect(l.netBani).toBe(3000);
    expect(l.tvaBani).toBe(570);
    const t = recalculDocument([l]);
    expect(t.totalBrutBani).toBe(3570);
  });

  it('genereaza o intrare la receptie furnizor', () => {
    const doc = {
      id: 'd',
      tip: 'receptie_furnizor',
      cod: 'NIR-1',
      data: '2026-02-01',
      gestiuneId: 'g',
    } as Document;
    const m = genereazaMiscari(doc, [linie({ cantitate: 5, pretUnitarBani: 2000 })]);
    expect(m).toHaveLength(1);
    expect(m[0]!.cantitate).toBe(5);
    expect(m[0]!.valoareBani).toBe(10000);
  });

  it('genereaza doua miscari la transfer', () => {
    const doc = {
      id: 'd',
      tip: 'receptie_transfer',
      cod: 'TR-1',
      data: '2026-02-01',
      gestiuneId: 'g1',
      gestiuneDestinatieId: 'g2',
    } as Document;
    const m = genereazaMiscari(doc, [linie({ cantitate: 4, pretUnitarBani: 1000 })]);
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.gestiuneId === 'g1')!.cantitate).toBe(-4);
    expect(m.find((x) => x.gestiuneId === 'g2')!.cantitate).toBe(4);
  });
});

describe('inchidere de perioada', () => {
  it('celMaiRecentBlocaj ia cea mai recenta data dintre firme, ignorand null', () => {
    expect(
      celMaiRecentBlocaj([
        { perioadaBlocataPanaLa: '2026-03-31' },
        { perioadaBlocataPanaLa: null },
        { perioadaBlocataPanaLa: '2026-05-31' },
      ]),
    ).toBe('2026-05-31');
    expect(celMaiRecentBlocaj([{ perioadaBlocataPanaLa: null }])).toBeNull();
    expect(celMaiRecentBlocaj([])).toBeNull();
  });

  it('documentBlocat: data <= blocatPanaLa e blocata, dupa nu', () => {
    expect(documentBlocat('2026-03-15', '2026-03-31')).toBe(true);
    expect(documentBlocat('2026-03-31', '2026-03-31')).toBe(true); // ziua limita inclusiv
    expect(documentBlocat('2026-04-01', '2026-03-31')).toBe(false);
    expect(documentBlocat('2026-04-01', null)).toBe(false);
  });
});

describe('reports', () => {
  const docs: Document[] = [
    {
      tip: 'factura_vanzare',
      stare: 'validat',
      data: '2026-03-01',
      partenerId: 'client-1',
      cod: 'FV-1',
      totalNetBani: 10000,
      totalTvaBani: 1900,
      totalBrutBani: 11900,
    } as Document,
    {
      tip: 'factura_vanzare',
      stare: 'ciorna',
      data: '2026-03-02',
      cod: 'FV-2',
      totalBrutBani: 5000,
    } as Document,
  ];

  it('jurnalul include doar documentele validate', () => {
    const j = jurnal(docs, ['factura_vanzare']);
    expect(j.randuri).toHaveLength(1);
    expect(j.total.brutBani).toBe(11900);
  });

  it('balanta clientilor reconciliaza cu incasarile', () => {
    const casa: OperatiuneCasa[] = [
      {
        id: '1',
        data: '2026-03-05',
        tip: 'incasare',
        sumaBani: 5000,
        partenerId: 'client-1',
      } as OperatiuneCasa,
    ];
    const b = balantaParteneri(docs, casa, ['factura_vanzare'], 'incasare');
    const c = b.find((x) => x.partenerId === 'client-1')!;
    expect(c.debitBani).toBe(11900);
    expect(c.creditBani).toBe(5000);
    expect(c.soldBani).toBe(6900);
  });

  it('registrul de casa calculeaza soldul rulant', () => {
    const casa: OperatiuneCasa[] = [
      { id: '1', data: '2026-03-01', tip: 'incasare', sumaBani: 10000 } as OperatiuneCasa,
      { id: '2', data: '2026-03-02', tip: 'plata', sumaBani: 3000 } as OperatiuneCasa,
    ];
    const r = registruCasa(casa, 0);
    expect(r.soldFinalBani).toBe(7000);
    expect(r.operatiuni[1]!.soldBani).toBe(7000);
  });

  it('registrul-inventar agrega categoriile si calculeaza totalul general', () => {
    const r = registruInventar('2026-06-30', [
      { categorie: 'Stocuri', randuri: [{ denumire: 'PAL melaminat', valoareBani: 400_000 }] },
      { categorie: 'Mijloace fixe', randuri: [{ denumire: 'CNC', valoareBani: 960_000 }] },
      { categorie: 'Creante', randuri: [{ denumire: 'Client X', valoareBani: 100_000 }] },
      { categorie: 'Datorii', randuri: [{ denumire: 'Furnizor Y', valoareBani: -50_000 }] },
    ]);
    expect(r.randuri).toHaveLength(4);
    expect(r.totalGeneralBani).toBe(400_000 + 960_000 + 100_000 - 50_000);
  });
});

describe('mobila configurator', () => {
  const optiuni: FaraCampuriSync<OptiuneConfigurator>[] = [
    {
      id: 'mat',
      tip: 'material',
      cod: 'PAL',
      denumire: 'PAL',
      pretBani: 0,
      pretPeMpBani: 5000,
      produsId: null,
      activ: true,
    },
    {
      id: 'fin',
      tip: 'finisaj',
      cod: 'MAT',
      denumire: 'Mat',
      pretBani: 2000,
      pretPeMpBani: 0,
      produsId: null,
      activ: true,
    },
    {
      id: 'acc',
      tip: 'accesoriu',
      cod: 'SOFT',
      denumire: 'Amortizor',
      pretBani: 1500,
      pretPeMpBani: 0,
      produsId: null,
      activ: true,
    },
  ];

  it('calculeaza pretul configuratiei', () => {
    const cfg: ConfiguratieMobila = {
      latimeMm: 1000,
      inaltimeMm: 2000, // 2 mp
      adancimeMm: 600,
      materialId: 'mat',
      finisajId: 'fin',
      accesoriiIds: ['acc'],
      stareProductie: 'oferta',
      costManoperaBani: 0,
      departamenteFinalizate: [],
      dataMontaj: null,
      curier: '',
      awb: '',
    };
    // baza 50000 + material 2mp*5000=10000 + finisaj 2000 + accesoriu 1500 = 63500
    expect(calculPretConfiguratie(50000, cfg, optiuni)).toBe(63500);
  });

  it('calculeaza restul de plata', () => {
    expect(restDePlata(63500, 20000)).toBe(43500);
  });

  it('genereaza lista de debitare pentru un corp', () => {
    const cfg: ConfiguratieMobila = {
      latimeMm: 1000,
      inaltimeMm: 2000,
      adancimeMm: 600,
      materialId: null,
      finisajId: null,
      accesoriiIds: [],
      stareProductie: 'oferta',
      costManoperaBani: 0,
      departamenteFinalizate: [],
      dataMontaj: null,
      curier: '',
      awb: '',
    };
    const { panouri, suprafataMp } = listaDebitare(cfg, 18);
    expect(panouri).toHaveLength(3);
    expect(panouri.find((p) => p.denumire === 'Spate')!.latimeMm).toBe(1000);
    // 2*(600*2000) + 2*(964*600) + 1*(1000*2000) = 2.4 + 1.1568 + 2 = 5.5568 mp
    expect(suprafataMp).toBeCloseTo(5.557, 2);
  });
});
