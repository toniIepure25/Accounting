import { describe, expect, it, vi } from 'vitest';
import { sincronizeaza } from './engine.js';
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
