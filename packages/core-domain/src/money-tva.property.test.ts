import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type Bani,
  addBani,
  bani,
  baniToRon,
  mulBani,
  ronToBani,
  roundHalfAwayFromZero,
  subBani,
  sumBani,
} from './money.js';
import { COTE_TVA_RO, calculLinie, totalizeazaLinii, tvaDinBrut } from './tva.js';

/**
 * Teste property-based (fast-check) pentru codul cel mai critic din aplicatie:
 * aritmetica banilor si calculul TVA. Testele cu exemple (money.test.ts,
 * tva.test.ts) verifica cazuri anume; acestea verifica INVARIANTI care trebuie
 * sa tina pentru ORICE combinatie de intrari — fast-check genereaza sute de
 * cazuri, inclusiv margini (0, sume mari, cantitati fractionare) pe care nu
 * le-am scrie manual. Daca un invariant pica, fast-check "micsoreaza" (shrink)
 * automat contra-exemplul la cel mai simplu caz care il reproduce.
 */

// Sume realiste: pana la 100.000 RON pe unitate, ca sa ramanem departe de
// limita sigura a intregilor si sa evitam overflow-uri artificiale.
const pret = fc.integer({ min: 0, max: 100_000_00 }).map((n) => n as Bani);
const sumaCuSemn = fc.integer({ min: -100_000_00, max: 100_000_00 }).map((n) => n as Bani);
const cantitate = fc.double({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true });
const cota = fc.constantFrom(...Object.values(COTE_TVA_RO));

describe('money — invarianti aritmetici', () => {
  it('rotunjirea comerciala e simetrica fata de zero', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (x) => {
          expect(roundHalfAwayFromZero(-x)).toBe(-roundHalfAwayFromZero(x));
        },
      ),
    );
  });

  it('conversia bani → RON → bani revine exact (fara pierdere de virgula)', () => {
    fc.assert(
      fc.property(sumaCuSemn, (b) => {
        expect(ronToBani(baniToRon(b))).toBe(b);
      }),
    );
  });

  it('scaderea anuleaza adunarea', () => {
    fc.assert(
      fc.property(sumaCuSemn, sumaCuSemn, (a, b) => {
        expect(subBani(addBani(a, b), b)).toBe(a);
      }),
    );
  });

  it('suma unei liste nu depinde de ordine', () => {
    fc.assert(
      fc.property(fc.array(sumaCuSemn), (arr) => {
        const inversat = [...arr].reverse();
        expect(sumBani(inversat)).toBe(sumBani(arr));
      }),
    );
  });

  it('suma coincide cu adunarea iterativa element cu element', () => {
    fc.assert(
      fc.property(fc.array(sumaCuSemn), (arr) => {
        const iterativ = arr.reduce((acc, v) => addBani(acc, v), 0 as Bani);
        expect(sumBani(arr)).toBe(iterativ);
      }),
    );
  });

  it('inmultirea cu 1 pastreaza suma, cu 0 o anuleaza', () => {
    fc.assert(
      fc.property(pret, (p) => {
        expect(mulBani(p, 1)).toBe(p);
        expect(mulBani(p, 0)).toBe(0 as Bani);
      }),
    );
  });

  it('bani() produce mereu un intreg', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (x) => {
          expect(Number.isInteger(bani(x))).toBe(true);
        },
      ),
    );
  });
});

describe('TVA — invarianti de calcul', () => {
  it('INVARIANTUL FUNDAMENTAL: net + TVA = brut, pentru orice linie (pret fara TVA)', () => {
    fc.assert(
      fc.property(pret, cantitate, cota, (pretUnitarBani, cant, cotaTvaProcent) => {
        const r = calculLinie({ cantitate: cant, pretUnitarBani, cotaTvaProcent });
        expect(r.netBani + r.tvaBani).toBe(r.brutBani);
      }),
    );
  });

  it('net + TVA = brut si cand pretul include deja TVA (vanzare cu amanuntul)', () => {
    fc.assert(
      fc.property(pret, cantitate, cota, (pretUnitarBani, cant, cotaTvaProcent) => {
        const r = calculLinie({
          cantitate: cant,
          pretUnitarBani,
          cotaTvaProcent,
          pretIncludeTva: true,
        });
        expect(r.netBani + r.tvaBani).toBe(r.brutBani);
      }),
    );
  });

  it('intrari nenegative → rezultate nenegative', () => {
    fc.assert(
      fc.property(pret, cantitate, cota, (pretUnitarBani, cant, cotaTvaProcent) => {
        const r = calculLinie({ cantitate: cant, pretUnitarBani, cotaTvaProcent });
        expect(r.netBani).toBeGreaterThanOrEqual(0);
        expect(r.tvaBani).toBeGreaterThanOrEqual(0);
        expect(r.brutBani).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it('cota scutita (0%) → TVA zero si brut = net', () => {
    fc.assert(
      fc.property(pret, cantitate, (pretUnitarBani, cant) => {
        const r = calculLinie({ cantitate: cant, pretUnitarBani, cotaTvaProcent: 0 });
        expect(r.tvaBani).toBe(0 as Bani);
        expect(r.brutBani).toBe(r.netBani);
      }),
    );
  });

  it('descompunerea unei sume brute pastreaza egalitatea net + TVA = brut', () => {
    fc.assert(
      fc.property(pret, cota, (brut, cotaTvaProcent) => {
        const r = tvaDinBrut(brut, cotaTvaProcent);
        expect(r.netBani + r.tvaBani).toBe(brut);
        expect(r.brutBani).toBe(brut);
      }),
    );
  });

  it('totalizarea liniilor e aditiva SI pastreaza echilibrul net + TVA = brut', () => {
    const linie = fc.record({ pretUnitarBani: pret, cantitate, cotaTvaProcent: cota });
    fc.assert(
      fc.property(fc.array(linie, { maxLength: 50 }), (inputuri) => {
        const rezultate = inputuri.map((i) => calculLinie(i));
        const total = totalizeazaLinii(rezultate);
        // Aditivitate: fiecare total = suma componentelor.
        expect(total.netBani).toBe(sumBani(rezultate.map((r) => r.netBani)));
        expect(total.tvaBani).toBe(sumBani(rezultate.map((r) => r.tvaBani)));
        expect(total.brutBani).toBe(sumBani(rezultate.map((r) => r.brutBani)));
        // Echilibrul se pastreaza si la nivel de total.
        expect(total.netBani + total.tvaBani).toBe(total.brutBani);
      }),
    );
  });
});
