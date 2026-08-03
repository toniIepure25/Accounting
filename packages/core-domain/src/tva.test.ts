import { describe, expect, it } from 'vitest';
import { type Bani, ronToBani } from './money.js';
import { COTE_TVA_RO, calculLinie, totalizeazaLinii, tvaDinBrut, tvaDinNet } from './tva.js';

describe('tva', () => {
  it('calculeaza TVA din net la cota standard 19%', () => {
    expect(tvaDinNet(ronToBani(100), COTE_TVA_RO.STANDARD)).toBe(1900);
    // 33.33 * 19% = 6.3327 -> 633 bani
    expect(tvaDinNet(ronToBani(33.33), COTE_TVA_RO.STANDARD)).toBe(633);
  });

  it('descompune corect o suma bruta in net + TVA (19%)', () => {
    const r = tvaDinBrut(ronToBani(119), COTE_TVA_RO.STANDARD);
    expect(r.netBani).toBe(10000);
    expect(r.tvaBani).toBe(1900);
    expect(r.brutBani).toBe(11900);
  });

  it('calcul linie cu pret fara TVA', () => {
    const r = calculLinie({
      cantitate: 3,
      pretUnitarBani: ronToBani(10),
      cotaTvaProcent: COTE_TVA_RO.STANDARD,
    });
    expect(r.netBani).toBe(3000);
    expect(r.tvaBani).toBe(570);
    expect(r.brutBani).toBe(3570);
  });

  it('calcul linie cu pret care include TVA (vanzare cu amanuntul)', () => {
    const r = calculLinie({
      cantitate: 2,
      pretUnitarBani: ronToBani(11.9),
      cotaTvaProcent: COTE_TVA_RO.STANDARD,
      pretIncludeTva: true,
    });
    expect(r.brutBani).toBe(2380);
    expect(r.netBani).toBe(2000);
    expect(r.tvaBani).toBe(380);
  });

  it('totalizeaza mai multe linii', () => {
    const linii = [
      calculLinie({ cantitate: 1, pretUnitarBani: ronToBani(100), cotaTvaProcent: 19 }),
      calculLinie({ cantitate: 2, pretUnitarBani: ronToBani(50), cotaTvaProcent: 9 }),
    ];
    const t = totalizeazaLinii(linii);
    expect(t.netBani).toBe(ronToBani(200) as Bani);
    expect(t.tvaBani).toBe(1900 + 900);
    expect(t.brutBani).toBe(t.netBani + t.tvaBani);
  });
});
