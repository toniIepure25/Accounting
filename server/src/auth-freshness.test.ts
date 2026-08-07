import { describe, expect, it } from 'vitest';
import { type UtilizatorSesiune, sesiuneProaspata } from './auth.js';

const utilizator = (over: Partial<UtilizatorSesiune> = {}): UtilizatorSesiune => ({
  id: 'u1',
  nume: 'Ion',
  rol: 'contabil',
  firmaId: 'f1',
  activ: true,
  sessionVersion: 1,
  ...over,
});

const payload = (over: Partial<{ utilizatorId: string; sessionVersion?: number }> = {}) => ({
  utilizatorId: 'u1',
  sessionVersion: 1,
  ...over,
});

describe('sesiuneProaspata — prospetimea sesiunii (Faza 11, RK-11)', () => {
  it('sesiune valida: intoarce rol/firma PROASPETE din utilizatorul curent', () => {
    // tokenul a fost emis cand utilizatorul era casier; acum e admin.
    const s = sesiuneProaspata(payload(), utilizator({ rol: 'admin', firmaId: 'f2' }));
    expect(s).not.toBeNull();
    expect(s?.rol).toBe('admin'); // rolul nou, nu cel din token
    expect(s?.firmaId).toBe('f2');
  });

  it('utilizator dezactivat => sesiune respinsa imediat', () => {
    expect(sesiuneProaspata(payload(), utilizator({ activ: false }))).toBeNull();
  });

  it('utilizator inexistent => null', () => {
    expect(sesiuneProaspata(payload(), null)).toBeNull();
  });

  it('versiune de sesiune invechita (delogare fortata / schimbare parola) => respinsa', () => {
    // utilizatorul a fost trecut la sessionVersion 2 (parola schimbata); tokenul poarta 1.
    expect(
      sesiuneProaspata(payload({ sessionVersion: 1 }), utilizator({ sessionVersion: 2 })),
    ).toBeNull();
  });

  it('versiune potrivita => acceptata', () => {
    expect(
      sesiuneProaspata(payload({ sessionVersion: 2 }), utilizator({ sessionVersion: 2 })),
    ).not.toBeNull();
  });

  it('tokenuri vechi fara sessionVersion sunt tratate ca versiunea 1', () => {
    expect(
      sesiuneProaspata({ utilizatorId: 'u1' }, utilizator({ sessionVersion: 1 })),
    ).not.toBeNull();
    expect(sesiuneProaspata({ utilizatorId: 'u1' }, utilizator({ sessionVersion: 2 }))).toBeNull();
  });
});
