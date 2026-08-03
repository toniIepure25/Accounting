import { describe, expect, it } from 'vitest';
import {
  type Bani,
  addBani,
  baniToRon,
  formatBani,
  mulBani,
  ronToBani,
  roundHalfAwayFromZero,
  sumBani,
} from './money.js';

describe('money', () => {
  it('converteste RON <-> bani fara erori de virgula mobila', () => {
    expect(ronToBani(12.34)).toBe(1234);
    expect(ronToBani(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
    expect(baniToRon(1234 as Bani)).toBe(12.34);
  });

  it('rotunjeste comercial (half away from zero)', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
  });

  it('inmulteste cu cantitate fractionara si rotunjeste', () => {
    // 3.33 RON * 3 = 9.99 RON
    expect(mulBani(ronToBani(3.33), 3)).toBe(999);
    // 1.005 RON * 2 -> 201 bani (2.5 -> 3 nu se aplica aici; 100.5*2=201)
    expect(mulBani(100.5 as Bani, 2)).toBe(201);
  });

  it('aduna si totalizeaza', () => {
    expect(addBani(1234 as Bani, 100 as Bani)).toBe(1334);
    expect(sumBani([100, 200, 350] as Bani[])).toBe(650);
  });

  it('formateaza sume in ro-RO', () => {
    const s = formatBani(123456 as Bani, { withSymbol: false });
    // separatorul de mii poate fi diferit in functie de ICU; verificam zecimalele
    expect(s).toContain('34');
    expect(s.replace(/\s/g, '')).toMatch(/1[.,]?234[.,]56/);
  });
});
