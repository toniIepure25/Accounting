import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  REGULI_TVA_RO,
  type RegulaTva,
  RegulaTvaInexistenta,
  TRANZITIE_TVA_RO_2025,
  procentTvaLaData,
  rezolvaRegulaTva,
} from './tva-temporal.js';
import { calculLinie } from './tva.js';

describe('motor TVA temporal — tranzitia RO 2025 (Legea 141/2025)', () => {
  it('cota standard e 19% pana la 31 iulie 2025 inclusiv', () => {
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-07-31', codCategorieFiscala: 'standard' }),
    ).toBe(19);
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-01-15', codCategorieFiscala: 'standard' }),
    ).toBe(19);
  });

  it('cota standard devine 21% de la 1 august 2025', () => {
    expect(
      procentTvaLaData(REGULI_TVA_RO, {
        data: TRANZITIE_TVA_RO_2025,
        codCategorieFiscala: 'standard',
      }),
    ).toBe(21);
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2026-03-10', codCategorieFiscala: 'standard' }),
    ).toBe(21);
  });

  it('cotele reduse 9% si 5% se consolideaza la 11% de la 1 august 2025', () => {
    // Inainte de tranzitie: 9 si 5 distincte.
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-07-31', codCategorieFiscala: 'redus_9' }),
    ).toBe(9);
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-07-31', codCategorieFiscala: 'redus_5' }),
    ).toBe(5);
    // Dupa tranzitie: ambele -> 11.
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-08-01', codCategorieFiscala: 'redus_9' }),
    ).toBe(11);
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-08-01', codCategorieFiscala: 'redus_5' }),
    ).toBe(11);
  });

  it('scutit ramane 0% pe ambele parti ale tranzitiei', () => {
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-07-31', codCategorieFiscala: 'scutit' }),
    ).toBe(0);
    expect(
      procentTvaLaData(REGULI_TVA_RO, { data: '2025-08-01', codCategorieFiscala: 'scutit' }),
    ).toBe(0);
  });

  it('granita e exclusiva la validPanaLa: 2025-07-31 = vechi, 2025-08-01 = nou', () => {
    const vechi = rezolvaRegulaTva(REGULI_TVA_RO, {
      data: '2025-07-31',
      codCategorieFiscala: 'standard',
    });
    const nou = rezolvaRegulaTva(REGULI_TVA_RO, {
      data: '2025-08-01',
      codCategorieFiscala: 'standard',
    });
    expect(vechi.id).toBe('ro-standard-19');
    expect(nou.id).toBe('ro-standard-21');
    expect(nou.referintaLegala).toBe('Legea 141/2025');
  });
});

describe('motor TVA temporal — corectitudine si erori explicite', () => {
  it('arunca eroare EXPLICITA cand nu exista regula (fara cota implicita tacita)', () => {
    expect(() =>
      rezolvaRegulaTva(REGULI_TVA_RO, { data: '2025-08-01', codCategorieFiscala: 'inexistent' }),
    ).toThrow(RegulaTvaInexistenta);
  });

  it('arunca eroare cand data e inaintea oricarei reguli', () => {
    expect(() =>
      rezolvaRegulaTva(REGULI_TVA_RO, { data: '1999-01-01', codCategorieFiscala: 'standard' }),
    ).toThrow(RegulaTvaInexistenta);
  });

  it('ignora ora/fusul din data (compara doar ziua)', () => {
    expect(
      procentTvaLaData(REGULI_TVA_RO, {
        data: '2025-08-01T09:30:00.000Z',
        codCategorieFiscala: 'standard',
      }),
    ).toBe(21);
  });

  it('la intervale suprapuse alege regula cu validDeLa cel mai recent', () => {
    const reguli: RegulaTva[] = [
      {
        id: 'a',
        versiune: 1,
        jurisdictie: 'RO',
        categorie: 'standard',
        codCategorieFiscala: 'standard',
        procent: 19,
        validDeLa: '2020-01-01',
        validPanaLa: null,
        referintaLegala: 'x',
        descriere: 'vechi, deschis',
      },
      {
        id: 'b',
        versiune: 1,
        jurisdictie: 'RO',
        categorie: 'standard',
        codCategorieFiscala: 'standard',
        procent: 21,
        validDeLa: '2025-08-01',
        validPanaLa: null,
        referintaLegala: 'y',
        descriere: 'nou, deschis, suprapus',
      },
    ];
    expect(procentTvaLaData(reguli, { data: '2026-01-01', codCategorieFiscala: 'standard' })).toBe(
      21,
    );
    expect(procentTvaLaData(reguli, { data: '2024-01-01', codCategorieFiscala: 'standard' })).toBe(
      19,
    );
  });

  it('se integreaza cu calculLinie: cota rezolvata alimenteaza calculul liniei', () => {
    // Aceeasi linie (100 RON net) da TVA diferit inainte/dupa tranzitie.
    const netPret = 10_000; // 100.00 RON in bani
    const inainte = calculLinie({
      cantitate: 1,
      // biome-ignore lint/suspicious/noExplicitAny: pretUnitarBani e branded Bani; in test folosim valoarea bruta
      pretUnitarBani: netPret as any,
      cotaTvaProcent: procentTvaLaData(REGULI_TVA_RO, {
        data: '2025-07-31',
        codCategorieFiscala: 'standard',
      }),
    });
    const dupa = calculLinie({
      cantitate: 1,
      // biome-ignore lint/suspicious/noExplicitAny: idem
      pretUnitarBani: netPret as any,
      cotaTvaProcent: procentTvaLaData(REGULI_TVA_RO, {
        data: '2025-08-01',
        codCategorieFiscala: 'standard',
      }),
    });
    expect(inainte.tvaBani).toBe(1_900); // 19% din 100 RON
    expect(dupa.tvaBani).toBe(2_100); // 21% din 100 RON
  });
});

describe('motor TVA temporal — invarianti (property-based)', () => {
  const categorii = ['standard', 'redus_9', 'redus_5', 'scutit'];
  const dataArb = fc
    .date({ min: new Date('2017-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10));
  const catArb = fc.constantFrom(...categorii);

  it('regula rezolvata acopera intotdeauna data ceruta', () => {
    fc.assert(
      fc.property(dataArb, catArb, (data, codCategorieFiscala) => {
        const r = rezolvaRegulaTva(REGULI_TVA_RO, { data, codCategorieFiscala });
        const zi = Number(data.replace(/-/g, ''));
        expect(Number(r.validDeLa.replace(/-/g, ''))).toBeLessThanOrEqual(zi);
        if (r.validPanaLa !== null) {
          expect(zi).toBeLessThan(Number(r.validPanaLa.replace(/-/g, '')));
        }
      }),
    );
  });

  it('rezolvarea e determinista: aceeasi intrare -> aceeasi regula', () => {
    fc.assert(
      fc.property(dataArb, catArb, (data, codCategorieFiscala) => {
        const a = rezolvaRegulaTva(REGULI_TVA_RO, { data, codCategorieFiscala });
        const b = rezolvaRegulaTva(REGULI_TVA_RO, { data, codCategorieFiscala });
        expect(a.id).toBe(b.id);
      }),
    );
  });

  it('standardul e mereu 19% inainte de tranzitie si 21% dupa (determinism istoric)', () => {
    fc.assert(
      fc.property(dataArb, (data) => {
        const procent = procentTvaLaData(REGULI_TVA_RO, { data, codCategorieFiscala: 'standard' });
        const esteDupaTranzitie =
          Number(data.replace(/-/g, '')) >= Number(TRANZITIE_TVA_RO_2025.replace(/-/g, ''));
        expect(procent).toBe(esteDupaTranzitie ? 21 : 19);
      }),
    );
  });
});
