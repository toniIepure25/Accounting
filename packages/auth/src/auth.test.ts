import { describe, expect, it } from 'vitest';
import { hashParola, verificaParola } from './password.js';
import { PERMISIUNI_ROL, arePermisiune } from './roles.js';
import { emiteToken, verificaToken } from './session.js';

const SECRET = 'secret-server-2026';

describe('parole (PBKDF2)', () => {
  it('hash-uieste si verifica o parola corecta', async () => {
    const h = await hashParola('parola-mea-secreta');
    expect(h.startsWith('pbkdf2$')).toBe(true);
    expect(await verificaParola('parola-mea-secreta', h)).toBe(true);
  });

  it('respinge o parola gresita', async () => {
    const h = await hashParola('parola-corecta');
    expect(await verificaParola('parola-gresita', h)).toBe(false);
  });

  it('genereaza salt diferit -> hash diferit la aceeasi parola', async () => {
    const a = await hashParola('aceeasi');
    const b = await hashParola('aceeasi');
    expect(a).not.toBe(b);
    expect(await verificaParola('aceeasi', a)).toBe(true);
    expect(await verificaParola('aceeasi', b)).toBe(true);
  });
});

describe('RBAC — matrice de permisiuni', () => {
  it('admin are toate permisiunile', () => {
    expect(arePermisiune('admin', 'utilizatori.administrare')).toBe(true);
    expect(arePermisiune('admin', 'fiscal.trimitere')).toBe(true);
  });

  it('casierul NU poate valida documente sau administra utilizatori', () => {
    expect(arePermisiune('casier', 'documente.validare')).toBe(false);
    expect(arePermisiune('casier', 'utilizatori.administrare')).toBe(false);
    expect(arePermisiune('casier', 'casa.operare')).toBe(true);
  });

  it('vanzatorul nu are acces la contabilitate', () => {
    expect(arePermisiune('vanzator', 'contabilitate.vizualizare')).toBe(false);
  });

  it('fiecare rol e definit in matrice', () => {
    expect(Object.keys(PERMISIUNI_ROL).sort()).toEqual(
      ['admin', 'casier', 'contabil', 'gestionar', 'vanzator'].sort(),
    );
  });
});

describe('token de sesiune', () => {
  it('emite si verifica un token valid', async () => {
    const token = await emiteToken(
      {
        utilizatorId: 'u1',
        nume: 'Ion',
        rol: 'contabil',
        firmaId: 'f1',
        emisLa: '2026-01-01',
        expiraLa: '2030-01-01',
      },
      SECRET,
    );
    const r = await verificaToken(token, SECRET);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.payload.rol).toBe('contabil');
  });

  it('respinge un token expirat', async () => {
    const token = await emiteToken(
      {
        utilizatorId: 'u1',
        nume: 'Ion',
        rol: 'casier',
        firmaId: null,
        emisLa: '2020-01-01',
        expiraLa: '2020-01-02',
      },
      SECRET,
    );
    const r = await verificaToken(token, SECRET);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.motiv).toBe('expirat');
  });

  it('respinge un token modificat', async () => {
    const token = await emiteToken(
      {
        utilizatorId: 'u1',
        nume: 'Ion',
        rol: 'admin',
        firmaId: null,
        emisLa: '2026-01-01',
        expiraLa: '2030-01-01',
      },
      SECRET,
    );
    const r = await verificaToken(`${token}x`, SECRET);
    expect(r.valid).toBe(false);
  });
});
