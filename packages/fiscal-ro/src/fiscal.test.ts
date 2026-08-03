import type { Document, DocumentLinie, Partener, Produs } from '@gr/core-domain';
import { describe, expect, it } from 'vitest';
import { cuiValid, normalizeazaCui } from './cui.js';
import { sumarD390 } from './d390.js';
import { sumarD394Achizitii, sumarD394Livrari } from './d394.js';
import { decontTVA, decontTVADetaliat } from './decont.js';
import { type EFacturaInput, genereazaEFacturaXML } from './efactura.js';
import { genereazaSaftXML } from './saft.js';

describe('CUI', () => {
  it('valideaza cifra de control (CUI real)', () => {
    expect(cuiValid('RO14399840')).toBe(true); // eMAG / Dante International
    expect(cuiValid('14399840')).toBe(true);
  });
  it('respinge un CUI cu cifra de control gresita', () => {
    expect(cuiValid('14399841')).toBe(false);
    expect(cuiValid('RO12345678')).toBe(false);
  });
  it('normalizeaza prefixul si spatiile', () => {
    expect(normalizeazaCui('RO 143 99840')).toBe('14399840');
  });
});

describe('e-Factura XML (CIUS-RO)', () => {
  const input: EFacturaInput = {
    serieNumar: 'FCT-2026-000001',
    dataEmitere: '2026-03-01',
    scadenta: '2026-03-31',
    vanzator: {
      nume: 'SC Titan CO SRL',
      cui: 'RO14399840',
      adresa: 'Str. Principala 1',
      oras: 'Aiud',
      judet: 'Alba',
    },
    cumparator: {
      nume: 'Restaurant Boema SRL',
      cui: 'RO14837428',
      adresa: 'Str. Mare 2',
      oras: 'Aiud',
      judet: 'Alba',
    },
    linii: [
      {
        denumire: 'Bere la halba',
        cantitate: 200,
        unitateMasura: 'l',
        pretUnitarBani: 500,
        cotaTvaProcent: 19,
        netBani: 100000,
        tvaBani: 19000,
      },
    ],
    totalNetBani: 100000,
    totalTvaBani: 19000,
    totalBrutBani: 119000,
  };

  it('genereaza un XML conform CIUS-RO', () => {
    const xml = genereazaEFacturaXML(input);
    expect(xml).toContain('CIUS-RO:1.0.1');
    expect(xml).toContain('<cbc:ID>FCT-2026-000001</cbc:ID>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('Restaurant Boema SRL');
    expect(xml).toContain('<cbc:PayableAmount currencyID="RON">1190.00</cbc:PayableAmount>');
    expect(xml).toContain('<cac:InvoiceLine>');
    expect(xml).toContain('RO14399840');
  });

  it('genereaza XML valid pentru B2C (cumparator persoana fizica, fara CUI)', () => {
    const b2c: EFacturaInput = {
      ...input,
      cumparator: {
        nume: 'Popescu Ion',
        cui: null,
        cnp: '1900101123456',
        adresa: 'Str. Scurta 5',
        oras: 'Alba Iulia',
        judet: 'Alba',
      },
    };
    const xml = genereazaEFacturaXML(b2c);
    expect(xml).toContain('Popescu Ion');
    expect(xml).toContain('schemeID="CNP"');
    expect(xml).toContain('1900101123456');
    // Fara CUI, nu trebuie emis niciun PartyTaxScheme/CompanyID pentru cumparator.
    const cumparatorBlock = xml.slice(xml.indexOf('AccountingCustomerParty'));
    expect(cumparatorBlock).not.toContain('PartyTaxScheme');
    expect(xml).toContain('<cbc:PayableAmount currencyID="RON">1190.00</cbc:PayableAmount>');
  });
});

describe('decont TVA', () => {
  it('calculeaza TVA de plata', () => {
    const docs = [
      {
        tip: 'factura_vanzare',
        stare: 'validat',
        data: '2026-03-10',
        totalTvaBani: 1900,
      } as Document,
      {
        tip: 'factura_cumparare',
        stare: 'validat',
        data: '2026-03-12',
        totalTvaBani: 1000,
      } as Document,
      {
        tip: 'factura_vanzare',
        stare: 'ciorna',
        data: '2026-03-15',
        totalTvaBani: 500,
      } as Document,
    ];
    const d = decontTVA(docs);
    expect(d.tvaColectataBani).toBe(1900);
    expect(d.tvaDeductibilaBani).toBe(1000);
    expect(d.dePlataBani).toBe(900);
    expect(d.deRecuperatBani).toBe(0);
  });

  it('decontTVADetaliat defalca baza si TVA pe cote (D300)', () => {
    const docs = [
      {
        id: 'd1',
        tip: 'factura_vanzare',
        stare: 'validat',
        data: '2026-03-10',
        totalNetBani: 30000,
        totalTvaBani: 5700,
        totalBrutBani: 35700,
      } as Document,
    ];
    const linii = [
      {
        id: 'l1',
        documentId: 'd1',
        produsId: null,
        denumire: 'A',
        unitateMasura: 'buc',
        cantitate: 1,
        pretUnitarBani: 10000,
        cotaTvaProcent: 19,
        pretIncludeTva: false,
        netBani: 10000,
        tvaBani: 1900,
        brutBani: 11900,
      } as DocumentLinie,
      {
        id: 'l2',
        documentId: 'd1',
        produsId: null,
        denumire: 'B',
        unitateMasura: 'buc',
        cantitate: 1,
        pretUnitarBani: 20000,
        cotaTvaProcent: 19,
        pretIncludeTva: false,
        netBani: 20000,
        tvaBani: 3800,
        brutBani: 23800,
      } as DocumentLinie,
    ];
    const d = decontTVADetaliat(docs, linii);
    expect(d.colectataPeCota).toHaveLength(1);
    expect(d.colectataPeCota[0]).toEqual({ cotaProcent: 19, bazaBani: 30000, tvaBani: 5700 });
    expect(d.tvaColectataBani).toBe(5700);
  });
});

describe('D394 (livrari/achizitii pe partener)', () => {
  const parteneri = [
    {
      id: 'c1',
      tip: 'client',
      denumire: 'Client SRL',
      cui: 'RO14399840',
      platitorTva: true,
    } as Partener,
    {
      id: 'f1',
      tip: 'furnizor',
      denumire: 'Furnizor SRL',
      cui: 'RO14837428',
      platitorTva: true,
    } as Partener,
  ];
  const documente = [
    {
      id: 'd1',
      tip: 'factura_vanzare',
      stare: 'validat',
      data: '2026-03-01',
      partenerId: 'c1',
      totalNetBani: 10000,
      totalTvaBani: 1900,
      totalBrutBani: 11900,
    } as Document,
    {
      id: 'd2',
      tip: 'factura_vanzare',
      stare: 'validat',
      data: '2026-03-05',
      partenerId: 'c1',
      totalNetBani: 5000,
      totalTvaBani: 950,
      totalBrutBani: 5950,
    } as Document,
    {
      id: 'd3',
      tip: 'factura_cumparare',
      stare: 'validat',
      data: '2026-03-10',
      partenerId: 'f1',
      totalNetBani: 7000,
      totalTvaBani: 1330,
      totalBrutBani: 8330,
    } as Document,
    {
      id: 'd4',
      tip: 'factura_vanzare',
      stare: 'ciorna',
      data: '2026-03-12',
      partenerId: 'c1',
      totalNetBani: 999,
      totalTvaBani: 0,
      totalBrutBani: 999,
    } as Document,
  ];

  it('agrega livrarile pe client (ignora ciornele)', () => {
    const r = sumarD394Livrari(documente, parteneri);
    expect(r).toHaveLength(1);
    expect(r[0]!.nrDocumente).toBe(2);
    expect(r[0]!.bazaBani).toBe(15000);
    expect(r[0]!.cui).toBe('RO14399840');
  });

  it('agrega achizitiile pe furnizor', () => {
    const r = sumarD394Achizitii(documente, parteneri);
    expect(r).toHaveLength(1);
    expect(r[0]!.denumire).toBe('Furnizor SRL');
    expect(r[0]!.totalBani).toBe(8330);
  });
});

describe('D390 (VIES — operatiuni intracomunitare)', () => {
  const parteneri = [
    { id: 'ro1', tip: 'client', denumire: 'Client RO', tara: 'RO' } as Partener,
    {
      id: 'eu1',
      tip: 'furnizor',
      denumire: 'Holz GmbH',
      tara: 'DE',
      codTvaIntracomunitar: 'DE123456789',
    } as Partener,
  ];
  const documente = [
    {
      id: 'd1',
      tip: 'factura_cumparare',
      stare: 'validat',
      data: '2026-03-15',
      partenerId: 'eu1',
      totalNetBani: 200000,
      totalTvaBani: 0,
      totalBrutBani: 200000,
    } as Document,
    {
      id: 'd2',
      tip: 'factura_vanzare',
      stare: 'validat',
      data: '2026-03-01',
      partenerId: 'ro1',
      totalNetBani: 10000,
      totalTvaBani: 1900,
      totalBrutBani: 11900,
    } as Document,
  ];

  it('include doar partenerii din afara RO, clasificati pe tip de operatiune', () => {
    const r = sumarD390(documente, parteneri);
    expect(r).toHaveLength(1);
    expect(r[0]!.denumire).toBe('Holz GmbH');
    expect(r[0]!.operatiune).toBe('achizitie');
    expect(r[0]!.bazaBani).toBe(200000);
    expect(r[0]!.codTvaIntracomunitar).toBe('DE123456789');
  });
});

describe('SAF-T D406 (subset)', () => {
  it('genereaza un AuditFile cu master files si facturi', () => {
    const parteneri = [
      { id: 'c1', tip: 'client', denumire: 'Client SRL', cui: 'RO14399840' } as Partener,
      { id: 'f1', tip: 'furnizor', denumire: 'Furnizor SRL', cui: 'RO14837428' } as Partener,
    ];
    const produse = [{ id: 'p1', cod: 'X', denumire: 'Produs X', unitateMasura: 'buc' } as Produs];
    const documente = [
      {
        tip: 'factura_vanzare',
        stare: 'validat',
        cod: 'FCT-1',
        data: '2026-03-01',
        totalNetBani: 10000,
        totalTvaBani: 1900,
        totalBrutBani: 11900,
      } as Document,
    ];
    const xml = genereazaSaftXML({
      companie: { nume: 'Titan CO', cui: 'RO14399840', perioadaLuna: 3, perioadaAn: 2026 },
      parteneri,
      produse,
      documente,
    });
    expect(xml).toContain('<AuditFile');
    expect(xml).toContain('<AuditFileVersion>D406</AuditFileVersion>');
    expect(xml).toContain('Client SRL');
    expect(xml).toContain('Furnizor SRL');
    expect(xml).toContain('FCT-1');
  });
});
