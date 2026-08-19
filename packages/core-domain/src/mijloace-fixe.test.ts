import { describe, expect, it } from 'vitest';
import type { MijlocFix } from './entities/mijloc-fix.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';
import { calculAmortizareLunara, planAmortizare } from './mijloace-fixe.js';

const baza: FaraCampuriSync<MijlocFix> = {
  id: 'mf1',
  firmaId: null,
  cod: 'MF-001',
  denumire: 'Masina de debitat CNC',
  categorie: 'Utilaje',
  valoareIntrareBani: 12_000_000, // 120.000 RON
  dataPunereFunctiune: '2026-01-01',
  durataNormalaLuni: 60, // 5 ani
  metodaAmortizare: 'liniara',
  coeficientDegresiv: 1,
  amortizareCumulataBani: 0,
  gestiuneId: null,
  activ: true,
  casat: false,
  dataCasare: null,
};

describe('amortizare liniara', () => {
  it('cota lunara constanta = valoare / durata', () => {
    expect(calculAmortizareLunara(baza)).toBe(200_000); // 120.000/60 = 2.000 RON/luna
  });

  it('nu depaseste valoarea ramasa in ultima luna', () => {
    const aproapeAmortizat = { ...baza, amortizareCumulataBani: 11_900_000 };
    expect(calculAmortizareLunara(aproapeAmortizat)).toBe(100_000);
  });

  it('un mijloc fix amortizat integral sau casat nu mai genereaza amortizare', () => {
    expect(calculAmortizareLunara({ ...baza, amortizareCumulataBani: 12_000_000 })).toBe(0);
    expect(calculAmortizareLunara({ ...baza, casat: true })).toBe(0);
  });

  it('planAmortizare genereaza exact 60 de randuri, cumulat = valoarea de intrare', () => {
    const plan = planAmortizare(baza);
    expect(plan).toHaveLength(60);
    expect(plan[plan.length - 1]!.cumulatBani).toBe(12_000_000);
    expect(plan[plan.length - 1]!.ramasaBani).toBe(0);
    expect(plan.reduce((a, r) => a + r.amortizareBani, 0)).toBe(12_000_000);
  });
});

describe('amortizare degresiva', () => {
  const degresiv: FaraCampuriSync<MijlocFix> = {
    ...baza,
    metodaAmortizare: 'degresiva',
    coeficientDegresiv: 2,
  };

  it('cota degresiva initiala e mai mare decat cota liniara (coeficient > 1)', () => {
    const cotaDegresiva = calculAmortizareLunara(degresiv);
    const cotaLiniara = calculAmortizareLunara(baza);
    expect(cotaDegresiva).toBeGreaterThan(cotaLiniara);
  });

  it('planul degresiv se epuizeaza integral (comuta la liniar spre final) fara sa depaseasca valoarea', () => {
    const plan = planAmortizare(degresiv);
    expect(plan[plan.length - 1]!.cumulatBani).toBe(12_000_000);
    expect(plan.every((r) => r.cumulatBani <= 12_000_000)).toBe(true);
    // degresiv cu coeficient supraunitar amortizeaza mai repede decat liniarul (60 luni)
    expect(plan.length).toBeLessThanOrEqual(60);
  });
});
