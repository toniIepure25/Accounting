import { describe, expect, it } from 'vitest';
import { parseExtrasCsv, reconciliazaAutomat } from './banca.js';
import type { OperatiuneBancara } from './entities/banca.js';
import type { OperatiuneCasa } from './entities/casa.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';

describe('parseExtrasCsv', () => {
  it('parseaza randurile, ignorand antetul', () => {
    const csv =
      'Data,Suma,Descriere\n2026-03-01,1190.00,Incasare factura FCT-1\n2026-03-05,-500.50,Plata furnizor';
    const randuri = parseExtrasCsv(csv);
    expect(randuri).toHaveLength(2);
    expect(randuri[0]).toEqual({
      data: '2026-03-01',
      sumaBani: 119000,
      referinta: 'Incasare factura FCT-1',
    });
    expect(randuri[1]!.sumaBani).toBe(-50050);
  });

  it('ignora liniile goale sau invalide', () => {
    const csv = 'Data,Suma,Descriere\n\n2026-03-01,abc,text\n2026-03-02,100,ok';
    const randuri = parseExtrasCsv(csv);
    expect(randuri).toHaveLength(1);
    expect(randuri[0]!.sumaBani).toBe(10000);
  });
});

describe('reconciliazaAutomat', () => {
  const bancare: FaraCampuriSync<OperatiuneBancara>[] = [
    {
      id: 'b1',
      firmaId: null,
      data: '2026-03-02',
      sumaBani: 119000,
      referinta: 'incasare',
      partenerId: null,
      reconciliata: false,
      operatiuneCasaId: null,
    },
    {
      id: 'b2',
      firmaId: null,
      data: '2026-03-10',
      sumaBani: -50000,
      referinta: 'plata',
      partenerId: null,
      reconciliata: false,
      operatiuneCasaId: null,
    },
    {
      id: 'b3',
      firmaId: null,
      data: '2026-03-20',
      sumaBani: 999999,
      referinta: 'fara potrivire',
      partenerId: null,
      reconciliata: false,
      operatiuneCasaId: null,
    },
  ];
  const casa: FaraCampuriSync<OperatiuneCasa>[] = [
    {
      id: 'c1',
      firmaId: null,
      data: '2026-03-01',
      tip: 'incasare',
      sumaBani: 119000,
      partenerId: null,
      document: 'FCT-1',
      explicatie: '',
      punctDeLucruId: null,
    },
    {
      id: 'c2',
      firmaId: null,
      data: '2026-03-09',
      tip: 'plata',
      sumaBani: 50000,
      partenerId: null,
      document: '',
      explicatie: '',
      punctDeLucruId: null,
    },
  ];

  it('potriveste operatiuni cu aceeasi suma/tip si data apropiata (in limita de toleranta)', () => {
    const potriviri = reconciliazaAutomat(bancare, casa, 3);
    expect(potriviri).toHaveLength(2);
    expect(potriviri.find((p) => p.operatiuneBancaraId === 'b1')?.operatiuneCasaId).toBe('c1');
    expect(potriviri.find((p) => p.operatiuneBancaraId === 'b2')?.operatiuneCasaId).toBe('c2');
  });

  it('nu potriveste daca nu exista o suma/tip corespunzator', () => {
    const potriviri = reconciliazaAutomat(bancare, casa, 3);
    expect(potriviri.find((p) => p.operatiuneBancaraId === 'b3')).toBeUndefined();
  });

  it('nu re-foloseste o operatiune de casa deja potrivita cu alta bancara', () => {
    const bancareDuplicat: FaraCampuriSync<OperatiuneBancara>[] = [
      {
        id: 'x1',
        firmaId: null,
        data: '2026-03-02',
        sumaBani: 119000,
        referinta: '',
        partenerId: null,
        reconciliata: false,
        operatiuneCasaId: null,
      },
      {
        id: 'x2',
        firmaId: null,
        data: '2026-03-02',
        sumaBani: 119000,
        referinta: '',
        partenerId: null,
        reconciliata: false,
        operatiuneCasaId: null,
      },
    ];
    const casaUnica: FaraCampuriSync<OperatiuneCasa>[] = [
      {
        id: 'c1',
        firmaId: null,
        data: '2026-03-01',
        tip: 'incasare',
        sumaBani: 119000,
        partenerId: null,
        document: '',
        explicatie: '',
        punctDeLucruId: null,
      },
    ];
    const potriviri = reconciliazaAutomat(bancareDuplicat, casaUnica, 3);
    expect(potriviri).toHaveLength(1);
  });

  it('respecta flag-ul reconciliata (nu re-proceseaza ce e deja potrivit)', () => {
    const dejaReconciliat: FaraCampuriSync<OperatiuneBancara>[] = [
      {
        id: 'r1',
        firmaId: null,
        data: '2026-03-02',
        sumaBani: 119000,
        referinta: '',
        partenerId: null,
        reconciliata: true,
        operatiuneCasaId: 'c1',
      },
    ];
    expect(reconciliazaAutomat(dejaReconciliat, casa, 3)).toHaveLength(0);
  });
});
