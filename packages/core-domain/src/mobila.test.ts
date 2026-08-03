import { describe, expect, it } from 'vitest';
import type { ConfiguratieMobila } from './entities/mobila.js';
import {
  DEPARTAMENTE_PRODUCTIE,
  panouriPentruLot,
  parseConfiguratieMobila,
  randuriCroire,
  toateDepartamenteleFinalizate,
  urmatorulDepartament,
} from './mobila.js';
import { optimizeazaDebitare } from './nesting.js';

describe('departamente de productie', () => {
  it('urmatorulDepartament respecta ordinea fixa', () => {
    expect(urmatorulDepartament([])).toBe('debitare');
    expect(urmatorulDepartament(['debitare'])).toBe('cant');
    expect(urmatorulDepartament(['debitare', 'cant', 'cnc', 'vopsitorie'])).toBe('montaj');
    expect(urmatorulDepartament(DEPARTAMENTE_PRODUCTIE)).toBeNull();
  });

  it('toateDepartamenteleFinalizate e true doar cand toate cele 5 sunt bifate', () => {
    expect(toateDepartamenteleFinalizate(['debitare', 'cant'])).toBe(false);
    expect(toateDepartamenteleFinalizate(DEPARTAMENTE_PRODUCTIE)).toBe(true);
  });
});

describe('nesting pe lot de comenzi', () => {
  const cfgA: ConfiguratieMobila = {
    latimeMm: 1000,
    inaltimeMm: 2000,
    adancimeMm: 600,
    materialId: null,
    finisajId: null,
    accesoriiIds: [],
    stareProductie: 'in_productie',
    costManoperaBani: 0,
    departamenteFinalizate: [],
    dataMontaj: null,
    curier: '',
    awb: '',
  };
  const cfgB: ConfiguratieMobila = { ...cfgA, latimeMm: 800, inaltimeMm: 1800 };

  it('panouriPentruLot prefixeaza fiecare piesa cu codul comenzii sursa', () => {
    const piese = panouriPentruLot([
      { cod: 'CMD-1', cfg: cfgA },
      { cod: 'CMD-2', cfg: cfgB },
    ]);
    expect(piese.length).toBe(6); // 3 panouri per comanda x 2 comenzi
    expect(
      piese.every((p) => p.eticheta.startsWith('CMD-1 ·') || p.eticheta.startsWith('CMD-2 ·')),
    ).toBe(true);
  });

  it('randuriCroire aplatizeaza nesting-ul intr-un rand per piesa plasata', () => {
    const piese = panouriPentruLot([{ cod: 'CMD-1', cfg: cfgA }]);
    const nesting = optimizeazaDebitare(piese, { latimeMm: 2800, inaltimeMm: 2070 });
    const randuri = randuriCroire(nesting);
    const totalPlasari = nesting.placi.reduce((a, p) => a + p.plasari.length, 0);
    expect(randuri).toHaveLength(totalPlasari);
    expect(randuri.every((r) => r.eticheta.startsWith('CMD-1 ·'))).toBe(true);
    expect(randuri.every((r) => r.placaIndex >= 1)).toBe(true);
  });
});

describe('parseConfiguratieMobila', () => {
  it('parseaza un meta JSON valid', () => {
    const cfg = parseConfiguratieMobila(
      JSON.stringify({ latimeMm: 1234, stareProductie: 'in_productie' }),
    );
    expect(cfg.latimeMm).toBe(1234);
    expect(cfg.stareProductie).toBe('in_productie');
  });

  it('foloseste valorile implicite din schema pentru meta gol sau invalid (documente vechi)', () => {
    expect(parseConfiguratieMobila('{}')).toMatchObject({
      latimeMm: 0,
      stareProductie: 'oferta',
      departamenteFinalizate: [],
    });
    expect(parseConfiguratieMobila('nu-e-json')).toMatchObject({ stareProductie: 'oferta' });
  });

  it('completeaza campurile lipsa dintr-un meta partial (camp nou adaugat dupa ce documentul exista deja)', () => {
    const cfg = parseConfiguratieMobila(JSON.stringify({ latimeMm: 900 }));
    expect(cfg.latimeMm).toBe(900);
    expect(cfg.curier).toBe('');
    expect(cfg.departamenteFinalizate).toEqual([]);
  });
});
