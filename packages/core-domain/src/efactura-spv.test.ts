import { describe, expect, it } from 'vitest';
import {
  TranzitieEfacturaNepermisaError,
  asertaTranzitieEfactura,
  esteStareFinala,
  tranzitieEfacturaPermisa,
} from './efactura-spv.js';

describe('masina de stari e-Factura SPV', () => {
  it('parcursul fericit: ciorna_xml -> validat -> incarcat -> acceptat', () => {
    expect(tranzitieEfacturaPermisa('ciorna_xml', 'validat')).toBe(true);
    expect(tranzitieEfacturaPermisa('validat', 'incarcat')).toBe(true);
    expect(tranzitieEfacturaPermisa('incarcat', 'acceptat')).toBe(true);
  });

  it('respingerea e o stare finala', () => {
    expect(tranzitieEfacturaPermisa('incarcat', 'respins')).toBe(true);
    expect(esteStareFinala('respins')).toBe(true);
    expect(esteStareFinala('acceptat')).toBe(true);
    expect(esteStareFinala('incarcat')).toBe(false);
  });

  it('eroarea de transport e reincercabila (eroare -> incarcat)', () => {
    expect(tranzitieEfacturaPermisa('incarcat', 'eroare')).toBe(true);
    expect(tranzitieEfacturaPermisa('eroare', 'incarcat')).toBe(true);
  });

  it('tranzitiile ilegale sunt respinse', () => {
    expect(tranzitieEfacturaPermisa('ciorna_xml', 'incarcat')).toBe(false); // trebuie validat intai
    expect(tranzitieEfacturaPermisa('acceptat', 'incarcat')).toBe(false); // final
    expect(tranzitieEfacturaPermisa('respins', 'validat')).toBe(false); // final
    expect(() => asertaTranzitieEfactura('acceptat', 'incarcat')).toThrow(
      TranzitieEfacturaNepermisaError,
    );
    expect(() => asertaTranzitieEfactura('validat', 'incarcat')).not.toThrow();
  });
});
