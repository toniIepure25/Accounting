import { beforeAll, describe, expect, it } from 'vitest';
import { areModul, entitlementsDinLicenta, entitlementsImplicite } from './entitlements.js';
import { emiteLicenta, genereazaPerechiChei, verificaLicenta } from './license.js';

describe('licenta (semnatura asimetrica ECDSA)', () => {
  let cheiePublica: JsonWebKey;
  let cheiePrivata: JsonWebKey;

  beforeAll(async () => {
    ({ cheiePublica, cheiePrivata } = await genereazaPerechiChei());
  });

  it('emite si verifica o licenta valida', async () => {
    const cheie = await emiteLicenta(
      { client: 'Mobila SRL', editie: 'mobila', emisLa: '2026-01-01', expira: null },
      cheiePrivata,
    );
    const r = await verificaLicenta(cheie, cheiePublica);
    expect(r.valida).toBe(true);
    if (r.valida) expect(r.payload.editie).toBe('mobila');
  });

  it('respinge o cheie modificata (semnatura invalida)', async () => {
    const cheie = await emiteLicenta(
      { client: 'X', editie: 'mobila', emisLa: '2026-01-01', expira: null },
      cheiePrivata,
    );
    const stricat = `${cheie}x`;
    const r = await verificaLicenta(stricat, cheiePublica);
    expect(r.valida).toBe(false);
  });

  it('respinge o licenta expirata', async () => {
    const cheie = await emiteLicenta(
      { client: 'X', editie: 'mobila', emisLa: '2020-01-01', expira: '2021-01-01' },
      cheiePrivata,
    );
    const r = await verificaLicenta(cheie, cheiePublica);
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motiv).toBe('expirata');
  });

  it('o licenta semnata cu o alta cheie privata nu trece verificarea (nu se poate forja)', async () => {
    // Simuleaza un atacator care a citit cheia PUBLICA din clientul livrat si
    // incearca sa emita propria licenta — ceea ce o schema simetrica (HMAC cu
    // un singur secret shared) NU ar fi putut preveni.
    const atacator = await genereazaPerechiChei();
    const cheieForjata = await emiteLicenta(
      { client: 'Oricine', editie: 'full', emisLa: '2026-01-01', expira: null },
      atacator.cheiePrivata,
    );
    const r = await verificaLicenta(cheieForjata, cheiePublica);
    expect(r.valida).toBe(false);
    if (!r.valida) expect(r.motiv).toBe('semnatura');
  });
});

describe('entitlements — izolare pe editii', () => {
  it('fabrica de mobila NU are acces la HoReCa', () => {
    const ent = entitlementsDinLicenta({
      client: 'Mobila SRL',
      editie: 'mobila',
      emisLa: '2026-01-01',
      expira: null,
    });
    expect(areModul(ent, 'mobila')).toBe(true);
    expect(areModul(ent, 'core')).toBe(true);
    expect(areModul(ent, 'fiscal')).toBe(true);
    expect(areModul(ent, 'horeca')).toBe(false);
    expect(areModul(ent, 'retail')).toBe(false);
  });

  it('editia HoReCa nu are modulul Mobila', () => {
    const ent = entitlementsImplicite('horeca');
    expect(areModul(ent, 'horeca')).toBe(true);
    expect(areModul(ent, 'mobila')).toBe(false);
  });

  it('editia full are toate modulele', () => {
    const ent = entitlementsImplicite('full');
    expect(areModul(ent, 'mobila')).toBe(true);
    expect(areModul(ent, 'horeca')).toBe(true);
    expect(areModul(ent, 'retail')).toBe(true);
  });
});
