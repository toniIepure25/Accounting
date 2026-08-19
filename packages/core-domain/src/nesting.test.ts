import { describe, expect, it } from 'vitest';
import type { ConfiguratieMobila, OptiuneConfigurator } from './entities/mobila.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';
import {
  calculCantMl,
  listaDebitare,
  necesarConsumStoc,
  necesarFeronerie,
  panouriCaPiese,
  verificaConfiguratie,
} from './mobila.js';
import { type Piesa, optimizeazaDebitare } from './nesting.js';

const PLACA = { latimeMm: 2800, inaltimeMm: 2070 };

describe('nesting / optimizare debitare', () => {
  it('aseaza 3 laterale pe o singura placa', () => {
    const piese: Piesa[] = [{ eticheta: 'Lateral', latimeMm: 600, inaltimeMm: 2000, bucati: 3 }];
    const r = optimizeazaDebitare(piese, PLACA, { permiteRotire: false });
    expect(r.nrPlaci).toBe(1);
    expect(r.placi[0]!.plasari).toHaveLength(3);
    expect(r.procentPierdere).toBeGreaterThan(0);
    expect(r.procentPierdere).toBeLessThan(100);
  });

  it('depaseste pe mai multe placi cand nu incap', () => {
    const piese: Piesa[] = [{ eticheta: 'Lateral', latimeMm: 600, inaltimeMm: 2000, bucati: 10 }];
    const r = optimizeazaDebitare(piese, PLACA, { permiteRotire: false });
    // 4 per placa (2400 + kerf ≤ 2800; al 2-lea raft ar depasi inaltimea) → 3 placi
    expect(r.nrPlaci).toBe(3);
    const totalPlasari = r.placi.reduce((a, p) => a + p.plasari.length, 0);
    expect(totalPlasari).toBe(10);
  });

  it('suprafata folosita = suma reperelor", waste corect', () => {
    const piese: Piesa[] = [{ eticheta: 'X', latimeMm: 600, inaltimeMm: 2000, bucati: 3 }];
    const r = optimizeazaDebitare(piese, PLACA, { permiteRotire: false });
    expect(r.suprafataFolositaMm2).toBe(3 * 600 * 2000);
    expect(r.suprafataTotalaMm2).toBe(2800 * 2070);
  });
});

describe('cant + feronerie + reguli', () => {
  const cfg: ConfiguratieMobila = {
    latimeMm: 1000,
    inaltimeMm: 2000,
    adancimeMm: 600,
    materialId: 'mat',
    finisajId: 'fin',
    accesoriiIds: ['acc', 'acc', 'sertar'],
    stareProductie: 'oferta',
    costManoperaBani: 0,
    departamenteFinalizate: [],
    dataMontaj: null,
    curier: '',
    awb: '',
  };

  it('calculeaza metri liniari de cant (toate laturile)', () => {
    const { panouri } = listaDebitare(cfg, 18);
    // Lateral 600x2000 x2, Blat/Fund 964x600 x2, Spate 1000x2000 x1
    expect(calculCantMl(panouri, 4)).toBeCloseTo(22.66, 1);
    expect(panouriCaPiese(panouri)).toHaveLength(3);
  });

  it('agregă BOM feronerie din accesoriile alese', () => {
    const optiuni: FaraCampuriSync<OptiuneConfigurator>[] = [
      {
        id: 'acc',
        tip: 'accesoriu',
        cod: 'A',
        denumire: 'Amortizor',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: null,
        activ: true,
      },
      {
        id: 'sertar',
        tip: 'accesoriu',
        cod: 'S',
        denumire: 'Glisiera sertar',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: null,
        activ: true,
      },
    ];
    const bom = necesarFeronerie(cfg, optiuni);
    expect(bom.find((x) => x.denumire === 'Amortizor')!.bucati).toBe(2);
    expect(bom.find((x) => x.denumire === 'Glisiera sertar')!.bucati).toBe(1);
  });

  it('necesarConsumStoc: material+finisaj consuma suprafata, accesoriile consuma bucati, optiunile fara produsId nu genereaza consum', () => {
    const optiuni: FaraCampuriSync<OptiuneConfigurator>[] = [
      {
        id: 'mat',
        tip: 'material',
        cod: 'PAL',
        denumire: 'PAL',
        pretBani: 0,
        pretPeMpBani: 5000,
        produsId: 'produs-pal',
        activ: true,
      },
      {
        id: 'fin',
        tip: 'finisaj',
        cod: 'MAT',
        denumire: 'Finisaj mat',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: null,
        activ: true,
      },
      {
        id: 'acc',
        tip: 'accesoriu',
        cod: 'A',
        denumire: 'Amortizor',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: 'produs-amortizor',
        activ: true,
      },
      {
        id: 'sertar',
        tip: 'accesoriu',
        cod: 'S',
        denumire: 'Glisiera',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: null,
        activ: true,
      },
    ];
    const consum = necesarConsumStoc(cfg, optiuni, 4.2);
    expect(consum).toHaveLength(2); // finisaj si sertar nu au produsId -> nu genereaza consum
    expect(consum.find((c) => c.produsId === 'produs-pal')!.cantitate).toBe(4.2);
    expect(consum.find((c) => c.produsId === 'produs-amortizor')!.cantitate).toBe(2); // 'acc' apare de 2 ori in accesoriiIds
  });

  it('necesarConsumStoc agrega cantitatile cand material si finisaj sunt legate de acelasi produs', () => {
    const optiuni: FaraCampuriSync<OptiuneConfigurator>[] = [
      {
        id: 'mat',
        tip: 'material',
        cod: 'PAL',
        denumire: 'PAL',
        pretBani: 0,
        pretPeMpBani: 5000,
        produsId: 'produs-comun',
        activ: true,
      },
      {
        id: 'fin',
        tip: 'finisaj',
        cod: 'MAT',
        denumire: 'Finisaj mat',
        pretBani: 0,
        pretPeMpBani: 0,
        produsId: 'produs-comun',
        activ: true,
      },
    ];
    const consum = necesarConsumStoc(cfg, optiuni, 3);
    expect(consum).toHaveLength(1);
    expect(consum[0]!.cantitate).toBe(6);
  });

  it('verifică regulile de configurator', () => {
    const erori = verificaConfiguratie(cfg, {
      latimeMaxMm: 800,
      combinatiiInterzise: [{ materialId: 'mat', finisajId: 'fin' }],
    });
    expect(erori.some((x) => x.includes('Latimea'))).toBe(true);
    expect(erori.some((x) => x.includes('interzisa'))).toBe(true);
    expect(verificaConfiguratie(cfg, { latimeMaxMm: 2000 })).toHaveLength(0);
  });
});
