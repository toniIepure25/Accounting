import { describe, expect, it, vi } from 'vitest';
import { sincronizeaza, sincronizeazaSigur } from './engine.js';
import type { Versionat } from './sync.js';

const rec = (id: string, version: number, updatedAt: string): Versionat => ({
  id,
  version,
  updatedAt,
});

describe('motor de sincronizare (orchestrator)', () => {
  it('trimite dePush la remote si aplica dePull local', async () => {
    const local = [rec('a', 3, '2026-05-01'), rec('b', 1, '2026-01-01')];
    const remote = [rec('a', 1, '2026-01-01'), rec('c', 2, '2026-02-01')];

    const scrieLocal = vi.fn().mockResolvedValue(undefined);
    const scrieRemote = vi.fn().mockResolvedValue(undefined);

    const r = await sincronizeaza({
      citesteLocal: async () => local,
      citesteRemote: async () => remote,
      scrieLocal,
      scrieRemote,
    });

    expect(scrieRemote).toHaveBeenCalledTimes(1);
    expect(scrieRemote.mock.calls[0]![0].map((x: Versionat) => x.id).sort()).toEqual(['a', 'b']);
    expect(scrieLocal).toHaveBeenCalledTimes(1);
    expect(scrieLocal.mock.calls[0]![0].map((x: Versionat) => x.id)).toEqual(['c']);
    expect(r.merged).toHaveLength(3);
    expect(r.finalizatLa).toBeTruthy();
  });

  it('nu apeleaza scrieRemote/scrieLocal daca nu sunt diferente', async () => {
    const local = [rec('a', 1, '2026-01-01')];
    const remote = [rec('a', 1, '2026-01-01')];
    const scrieLocal = vi.fn();
    const scrieRemote = vi.fn();

    await sincronizeaza({
      citesteLocal: async () => local,
      citesteRemote: async () => remote,
      scrieLocal,
      scrieRemote,
    });

    expect(scrieLocal).not.toHaveBeenCalled();
    expect(scrieRemote).not.toHaveBeenCalled();
  });

  it('propaga eroarea daca reteaua e cazuta (scrieRemote esueaza)', async () => {
    const local = [rec('a', 2, '2026-05-01')];
    const remote: Versionat[] = [];

    await expect(
      sincronizeaza({
        citesteLocal: async () => local,
        citesteRemote: async () => remote,
        scrieLocal: vi.fn(),
        scrieRemote: vi.fn().mockRejectedValue(new Error('retea indisponibila')),
      }),
    ).rejects.toThrow('retea indisponibila');
  });
});

interface Doc extends Versionat {
  stare: 'ciorna' | 'validat';
}
const doc = (id: string, version: number, updatedAt: string, stare: Doc['stare']): Doc => ({
  id,
  version,
  updatedAt,
  stare,
});

describe('sincronizeazaSigur — sync fara last-write-wins pe date financiare (RK-12)', () => {
  const blocat = (d: Doc) => d.stare === 'validat';

  it('un rand BLOCAT pe server nu e suprascris de un push local invechit — devine conflict', async () => {
    // 'a': editat local (v5, ciorna) dar postat pe server (v3, validat) -> protejat.
    // 'b': ciorna noua locala -> se trimite. 'c': doc nou pe server -> se aduce.
    const local = [doc('a', 5, '2026-05-01', 'ciorna'), doc('b', 1, '2026-01-01', 'ciorna')];
    const remote = [doc('a', 3, '2026-03-01', 'validat'), doc('c', 2, '2026-02-01', 'validat')];

    const scrieLocal = vi.fn().mockResolvedValue(undefined);
    const scrieRemote = vi.fn().mockResolvedValue(undefined);

    const r = await sincronizeazaSigur(
      {
        citesteLocal: async () => local,
        citesteRemote: async () => remote,
        scrieLocal,
        scrieRemote,
      },
      { blocat },
    );

    // Localul 'a' (v5) NU se trimite; doar ciorna noua 'b'.
    expect(scrieRemote).toHaveBeenCalledTimes(1);
    expect(scrieRemote.mock.calls[0]![0].map((x: Doc) => x.id)).toEqual(['b']);
    // Se ADOPTA local versiunile serverului pentru 'a' (blocat, in conflict) si 'c' (nou).
    expect(scrieLocal.mock.calls[0]![0].map((x: Doc) => x.id).sort()).toEqual(['a', 'c']);
    const aPull = scrieLocal.mock.calls[0]![0].find((x: Doc) => x.id === 'a');
    expect(aPull.version).toBe(3); // versiunea SERVERULUI, nu localul v5
    // Conflictul e RAPORTAT (nu fuzionat).
    expect(r.conflicte).toEqual([{ id: 'a', motiv: 'server_blocat' }]);
  });

  it('aplica pull-ul INAINTE de push, deci un rand blocat nu poate fi impins', async () => {
    const local = [doc('a', 9, '2026-09-01', 'ciorna')];
    const remote = [doc('a', 4, '2026-04-01', 'validat')];
    const ordine: string[] = [];
    await sincronizeazaSigur(
      {
        citesteLocal: async () => local,
        citesteRemote: async () => remote,
        scrieLocal: vi.fn().mockImplementation(async () => {
          ordine.push('local');
        }),
        scrieRemote: vi.fn().mockImplementation(async () => {
          ordine.push('remote');
        }),
      },
      { blocat },
    );
    // Doar pull (adopta serverul); niciun push al randului blocat.
    expect(ordine).toEqual(['local']);
  });

  it('randuri ne-blocate: LWW normal (localul mai nou se trimite, fara conflict)', async () => {
    const local = [doc('n', 5, '2026-05-01', 'ciorna')];
    const remote = [doc('n', 2, '2026-02-01', 'ciorna')];
    const scrieRemote = vi.fn().mockResolvedValue(undefined);
    const r = await sincronizeazaSigur(
      {
        citesteLocal: async () => local,
        citesteRemote: async () => remote,
        scrieLocal: vi.fn(),
        scrieRemote,
      },
      { blocat },
    );
    expect(scrieRemote.mock.calls[0]![0].map((x: Doc) => x.id)).toEqual(['n']);
    expect(r.conflicte).toHaveLength(0);
  });
});
