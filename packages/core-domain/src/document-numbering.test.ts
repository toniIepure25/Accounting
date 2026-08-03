import { describe, expect, it } from 'vitest';
import { type SerieDocument, alocaNumar, formateazaCodDocument } from './document-numbering.js';

const serie: SerieDocument = {
  id: '00000000-0000-0000-0000-000000000001',
  tipDocument: 'factura',
  prefix: 'FCT',
  an: 2026,
  ultimulNumar: 122,
  lungimeNumar: 6,
  punctDeLucruId: null,
};

describe('document-numbering', () => {
  it('formateaza codul cu zero-padding', () => {
    expect(formateazaCodDocument(serie, 123)).toBe('FCT-2026-000123');
  });

  it('aloca numarul urmator si returneaza seria actualizata (pur)', () => {
    const r = alocaNumar(serie);
    expect(r.numar).toBe(123);
    expect(r.cod).toBe('FCT-2026-000123');
    expect(r.serieActualizata.ultimulNumar).toBe(123);
    // seria originala ramane neschimbata
    expect(serie.ultimulNumar).toBe(122);
  });
});
