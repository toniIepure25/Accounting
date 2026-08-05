import { describe, expect, it } from 'vitest';
import {
  DocumentImutabilError,
  DocumentInvalidError,
  TranzitieNepermisaError,
  asertaEditabil,
  asertaTranzitie,
  esteEditabil,
  esteImutabil,
  estePostat,
  recalculeazaAgregat,
  tranzitiePermisa,
  validaPentruPostare,
} from './document-aggregate.js';
import { type Document, DocumentLinieSchema, DocumentSchema } from './entities/document.js';

function doc(over: Partial<Document> = {}): Document {
  return DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'factura_vanzare',
    data: '2025-09-10',
    partenerId: crypto.randomUUID(),
    gestiuneId: crypto.randomUUID(),
    ...over,
  });
}

function linie(over: Record<string, unknown> = {}) {
  return DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    denumire: 'Produs',
    cantitate: 2,
    pretUnitarBani: 10000,
    cotaTvaProcent: 21,
    ...over,
  });
}

describe('masina de stari a ciclului de viata', () => {
  it('tranzitiile canonice sunt permise', () => {
    expect(tranzitiePermisa('ciorna', 'aprobat')).toBe(true);
    expect(tranzitiePermisa('aprobat', 'validat')).toBe(true);
    expect(tranzitiePermisa('ciorna', 'validat')).toBe(true); // postare directa
    expect(tranzitiePermisa('validat', 'stornat')).toBe(true);
    expect(tranzitiePermisa('ciorna', 'anulat')).toBe(true);
  });

  it('tranzitiile interzise sunt respinse', () => {
    expect(tranzitiePermisa('validat', 'ciorna')).toBe(false); // postat nu revine draft
    expect(tranzitiePermisa('validat', 'anulat')).toBe(false); // postat se storneaza, nu se anuleaza
    expect(tranzitiePermisa('stornat', 'validat')).toBe(false); // terminal
    expect(tranzitiePermisa('anulat', 'ciorna')).toBe(false); // terminal
  });

  it('asertaTranzitie arunca pe tranzitie nepermisa', () => {
    expect(() => asertaTranzitie('validat', 'ciorna')).toThrow(TranzitieNepermisaError);
    expect(() => asertaTranzitie('ciorna', 'validat')).not.toThrow();
  });

  it('imutabilitatea: doar ciorna/aprobat sunt editabile', () => {
    expect(esteEditabil('ciorna')).toBe(true);
    expect(esteEditabil('aprobat')).toBe(true);
    expect(esteEditabil('validat')).toBe(false);
    expect(esteEditabil('stornat')).toBe(false);
    expect(esteEditabil('anulat')).toBe(false);
    expect(esteImutabil('validat')).toBe(true);
    expect(estePostat('validat')).toBe(true);
    expect(estePostat('aprobat')).toBe(false);
  });

  it('asertaEditabil blocheaza editarea unui document postat', () => {
    expect(() => asertaEditabil('validat', 'update')).toThrow(DocumentImutabilError);
    expect(() => asertaEditabil('ciorna', 'update')).not.toThrow();
  });
});

describe('recalculul server-side al agregatului', () => {
  it('ignora totalurile venite de la client si le recalculeaza din linii', () => {
    const d = doc({ totalNetBani: 999999, totalTvaBani: 999999, totalBrutBani: 999999 });
    const linii = [linie({ cantitate: 2, pretUnitarBani: 10000, cotaTvaProcent: 21 })];
    const r = recalculeazaAgregat(d, linii);
    // 2 * 100.00 = 200.00 net; 21% => 42.00 TVA; 242.00 brut (in bani)
    expect(r.document.totalNetBani).toBe(20000);
    expect(r.document.totalTvaBani).toBe(4200);
    expect(r.document.totalBrutBani).toBe(24200);
    expect(r.linii[0]!.netBani).toBe(20000);
    expect(r.linii[0]!.tvaBani).toBe(4200);
  });
});

describe('validarea invariantelor pentru postare', () => {
  it('accepta un document valid si intoarce agregatul recalculat', () => {
    const r = validaPentruPostare(doc(), [linie()]);
    expect(r.document.totalBrutBani).toBe(24200);
  });

  it('respinge un document fara linii', () => {
    expect(() => validaPentruPostare(doc(), [])).toThrow(DocumentInvalidError);
  });

  it('respinge o factura fara partener', () => {
    expect(() => validaPentruPostare(doc({ partenerId: null }), [linie()])).toThrow(
      DocumentInvalidError,
    );
  });

  it('respinge un document care afecteaza stocul fara gestiune', () => {
    const d = doc({ tip: 'receptie_furnizor', partenerId: crypto.randomUUID(), gestiuneId: null });
    expect(() => validaPentruPostare(d, [linie()])).toThrow(DocumentInvalidError);
  });

  it('respinge un transfer fara gestiune de destinatie', () => {
    const d = doc({
      tip: 'receptie_transfer',
      partenerId: null,
      gestiuneId: crypto.randomUUID(),
      gestiuneDestinatieId: null,
    });
    expect(() => validaPentruPostare(d, [linie()])).toThrow(DocumentInvalidError);
  });

  it('aduna toate motivele intr-o singura eroare', () => {
    try {
      validaPentruPostare(doc({ partenerId: null }), [linie({ cantitate: 0 })]);
      throw new Error('ar fi trebuit sa arunce');
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentInvalidError);
      expect((e as DocumentInvalidError).motive.length).toBeGreaterThanOrEqual(2);
    }
  });
});
