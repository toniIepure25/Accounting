import { describe, expect, it } from 'vitest';
import { difCampuri, filtreazaAudit, rezumaModificare } from './audit.js';
import type { AuditEntry } from './entities/audit.js';

const intrari: AuditEntry[] = [
  {
    id: '1',
    timp: '2026-03-01T10:00:00Z',
    utilizator: 'Ion',
    rol: 'admin',
    actiune: 'creare',
    entitate: 'documente',
    entitateId: 'd1',
    detalii: '',
  },
  {
    id: '2',
    timp: '2026-03-02T10:00:00Z',
    utilizator: 'Maria',
    rol: 'casier',
    actiune: 'actualizare',
    entitate: 'operatiuni_casa',
    entitateId: 'o1',
    detalii: '',
  },
  {
    id: '3',
    timp: '2026-03-03T10:00:00Z',
    utilizator: 'Ion',
    rol: 'admin',
    actiune: 'stergere',
    entitate: 'documente',
    entitateId: 'd1',
    detalii: '',
  },
];

describe('audit — filtrare', () => {
  it('filtreaza dupa entitate, cele mai recente primele', () => {
    const r = filtreazaAudit(intrari, { entitate: 'documente' });
    expect(r).toHaveLength(2);
    expect(r[0]!.actiune).toBe('stergere'); // mai recent
  });

  it('filtreaza dupa utilizator si interval', () => {
    const r = filtreazaAudit(intrari, { utilizator: 'Ion', de: '2026-03-02', pana: '2026-03-03' });
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('3');
  });

  it('fara filtre returneaza tot, ordonat descrescator', () => {
    const r = filtreazaAudit(intrari);
    expect(r.map((x) => x.id)).toEqual(['3', '2', '1']);
  });
});

describe('audit — diff campuri', () => {
  it('detecteaza campurile schimbate', () => {
    const d = difCampuri({ denumire: 'A', pret: 100 }, { denumire: 'B', pret: 100 });
    expect(d).toEqual(['denumire']);
  });

  it('fara stare initiala/finala, fara diff', () => {
    expect(difCampuri(null, { a: 1 })).toEqual([]);
    expect(difCampuri({ a: 1 }, null)).toEqual([]);
  });

  it('rezumaModificare formateaza scurt sau trunchiat', () => {
    expect(rezumaModificare([])).toBe('');
    expect(rezumaModificare(['a', 'b'])).toBe('Campuri: a, b');
    expect(rezumaModificare(['a', 'b', 'c', 'd', 'e'])).toBe('Campuri: a, b, c, d (+1)');
  });
});
