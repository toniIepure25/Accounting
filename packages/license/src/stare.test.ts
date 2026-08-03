import { describe, expect, it } from 'vitest';
import { entitlementsDinLicenta } from './entitlements.js';
import type { LicentaPayload } from './license.js';
import {
  ZILE_AVERTISMENT,
  ZILE_GRATIE,
  maiIncapeUnUtilizator,
  permiteScriere,
  stareLicenta,
  utilizatoriMaxPermisi,
} from './stare.js';

const ACUM = new Date('2026-07-01T12:00:00.000Z');
const MS_ZI = 24 * 60 * 60 * 1000;

/** O licenta care expira peste `zile` zile fata de ACUM (negativ = deja expirata). */
function licentaCare(expiraPesteZile: number | null, extra: Partial<LicentaPayload> = {}) {
  return {
    client: 'Test SRL',
    editie: 'mobila',
    emisLa: '2026-01-01T00:00:00.000Z',
    expira:
      expiraPesteZile === null
        ? null
        : new Date(ACUM.getTime() + expiraPesteZile * MS_ZI).toISOString(),
    ...extra,
  } satisfies LicentaPayload;
}

describe('stareLicenta', () => {
  it('fara licenta = demo', () => {
    expect(stareLicenta(null, ACUM)).toEqual({ stare: 'demo' });
  });

  it('licenta perpetua (fara data de expirare) e mereu activa', () => {
    expect(stareLicenta(licentaCare(null), ACUM)).toEqual({ stare: 'activa', zileRamase: null });
  });

  it('licenta cu mult timp ramas e activa, fara avertisment', () => {
    const r = stareLicenta(licentaCare(200), ACUM);
    expect(r.stare).toBe('activa');
  });

  it('licenta care expira in fereastra de avertisment semnaleaza asta', () => {
    const r = stareLicenta(licentaCare(ZILE_AVERTISMENT - 5), ACUM);
    expect(r.stare).toBe('expira_curand');
    if (r.stare === 'expira_curand') expect(r.zileRamase).toBe(ZILE_AVERTISMENT - 5);
  });

  it('o licenta de trial e semnalata ca trial, nu ca "expira curand"', () => {
    const r = stareLicenta(licentaCare(5, { trial: true }), ACUM);
    expect(r.stare).toBe('trial');
    if (r.stare === 'trial') expect(r.zileRamase).toBe(5);
  });

  it('imediat dupa expirare intra in perioada de gratie, nu direct in blocare', () => {
    const r = stareLicenta(licentaCare(-1), ACUM);
    expect(r.stare).toBe('gratie');
    if (r.stare === 'gratie') expect(r.zileRamase).toBe(ZILE_GRATIE - 1);
  });

  it('dupa epuizarea perioadei de gratie devine expirata', () => {
    expect(stareLicenta(licentaCare(-ZILE_GRATIE), ACUM)).toEqual({ stare: 'expirata' });
    expect(stareLicenta(licentaCare(-100), ACUM)).toEqual({ stare: 'expirata' });
  });
});

describe('permiteScriere', () => {
  it('permite scrierea in toate starile in afara de expirata', () => {
    expect(permiteScriere({ stare: 'demo' })).toBe(true);
    expect(permiteScriere({ stare: 'activa', zileRamase: null })).toBe(true);
    expect(permiteScriere({ stare: 'trial', zileRamase: 3 })).toBe(true);
    expect(permiteScriere({ stare: 'expira_curand', zileRamase: 3 })).toBe(true);
    // Perioada de gratie ramane complet functionala — asta e tot rostul ei.
    expect(permiteScriere({ stare: 'gratie', zileRamase: 2 })).toBe(true);
  });

  it('blocheaza scrierea doar cand licenta e expirata definitiv', () => {
    expect(permiteScriere({ stare: 'expirata' })).toBe(false);
  });
});

describe('limita de utilizatori (seats)', () => {
  it('fara licenta sau fara plan = nelimitat (retrocompatibil cu licentele vechi)', () => {
    expect(utilizatoriMaxPermisi(null)).toBeNull();
    expect(utilizatoriMaxPermisi(licentaCare(null))).toBeNull();
  });

  it('planul stabileste limita implicita', () => {
    expect(utilizatoriMaxPermisi(licentaCare(null, { plan: 'esential' }))).toBe(3);
    expect(utilizatoriMaxPermisi(licentaCare(null, { plan: 'profesional' }))).toBe(10);
    expect(utilizatoriMaxPermisi(licentaCare(null, { plan: 'enterprise' }))).toBeNull();
  });

  it('o valoare explicita in licenta are prioritate fata de plan (contract negociat)', () => {
    expect(utilizatoriMaxPermisi(licentaCare(null, { plan: 'esential', utilizatoriMax: 25 }))).toBe(
      25,
    );
  });

  it('maiIncapeUnUtilizator respecta limita', () => {
    const lic = licentaCare(null, { plan: 'esential' }); // 3 utilizatori
    expect(maiIncapeUnUtilizator(lic, 2)).toBe(true);
    expect(maiIncapeUnUtilizator(lic, 3)).toBe(false);
    expect(maiIncapeUnUtilizator(lic, 4)).toBe(false);
    // Nelimitat
    expect(maiIncapeUnUtilizator(licentaCare(null, { plan: 'enterprise' }), 999)).toBe(true);
  });
});

describe('entitlements — campuri comerciale', () => {
  it('preia planul, limita de utilizatori si marcajul de trial din licenta', () => {
    const ent = entitlementsDinLicenta(
      licentaCare(30, { plan: 'profesional', trial: true }) as LicentaPayload,
    );
    expect(ent.plan).toBe('profesional');
    expect(ent.utilizatoriMax).toBe(10);
    expect(ent.trial).toBe(true);
  });

  it('o licenta veche (fara campuri comerciale) ramane nelimitata si neconsiderata trial', () => {
    const ent = entitlementsDinLicenta(licentaCare(null) as LicentaPayload);
    expect(ent.plan).toBeNull();
    expect(ent.utilizatoriMax).toBeNull();
    expect(ent.trial).toBe(false);
  });
});
