import { describe, expect, it } from 'vitest';
import { comenziDeReluat, curataCoada, puneInCoada } from './offline-queue.js';
import { reconcileSigur } from './policy.js';

interface Doc {
  id: string;
  version: number;
  updatedAt: string;
  deletedAt?: string | null;
  stare: 'ciorna' | 'validat';
}

const blocat = (d: Doc) => d.stare === 'validat';

describe('reconcileSigur — protejeaza datele postate de LWW (RK-12)', () => {
  it('o editare locala pe un document POSTAT pe server nu se trimite; e conflict, se aduce serverul', () => {
    const local: Doc = { id: '1', version: 2, updatedAt: '2026-02-02', stare: 'ciorna' }; // editat offline
    const remote: Doc = { id: '1', version: 3, updatedAt: '2026-02-05', stare: 'validat' }; // postat pe server
    const r = reconcileSigur([local], [remote], { blocat });
    expect(r.dePush).toHaveLength(0); // NU se suprascrie serverul
    expect(r.dePull).toEqual([remote]); // clientul adopta versiunea serverului
    expect(r.conflicte).toEqual([{ id: '1', motiv: 'server_blocat' }]);
    expect(r.merged[0]).toBe(remote);
  });

  it('o ciorna noua creata offline se poate trimite', () => {
    const local: Doc = { id: '2', version: 1, updatedAt: '2026-02-02', stare: 'ciorna' };
    const r = reconcileSigur([local], [], { blocat });
    expect(r.dePush).toEqual([local]);
    expect(r.conflicte).toHaveLength(0);
  });

  it('randurile ne-blocate folosesc LWW normal', () => {
    const local: Doc = { id: '3', version: 5, updatedAt: '2026-02-09', stare: 'ciorna' };
    const remote: Doc = { id: '3', version: 4, updatedAt: '2026-02-08', stare: 'ciorna' };
    const r = reconcileSigur([local], [remote], { blocat });
    expect(r.dePush).toEqual([local]); // localul e mai nou
    expect(r.conflicte).toHaveLength(0);
  });

  it('document postat identic pe ambele parti: fara conflict, fara push/pull', () => {
    const rec: Doc = { id: '4', version: 3, updatedAt: '2026-02-05', stare: 'validat' };
    const r = reconcileSigur([{ ...rec }], [{ ...rec }], { blocat });
    expect(r.dePush).toHaveLength(0);
    expect(r.dePull).toHaveLength(0);
    expect(r.conflicte).toHaveLength(0);
  });
});

describe('coada de comenzi offline — redare idempotenta', () => {
  const c = (key: string, tip: 'posteaza' | 'creeaza_ciorna' = 'posteaza') => ({
    idempotencyKey: key,
    tip,
    creataLa: '2026-02-10',
  });

  it('comenzile deja executate nu se mai redau', () => {
    const coada = [c('k1'), c('k2'), c('k3')];
    const executate = new Set(['k1']);
    expect(comenziDeReluat(coada, executate).map((x) => x.idempotencyKey)).toEqual(['k2', 'k3']);
  });

  it('o cheie duplicata in coada se reda o singura data', () => {
    const coada = [c('k1'), c('k1')];
    expect(comenziDeReluat(coada, new Set())).toHaveLength(1);
  });

  it('puneInCoada e idempotent la enqueue (nu adauga aceeasi cheie de doua ori)', () => {
    let coada = puneInCoada([], c('k1'));
    coada = puneInCoada(coada, c('k1'));
    expect(coada).toHaveLength(1);
  });

  it('curataCoada scoate comenzile confirmate', () => {
    const coada = [c('k1'), c('k2')];
    expect(curataCoada(coada, new Set(['k1'])).map((x) => x.idempotencyKey)).toEqual(['k2']);
  });
});
