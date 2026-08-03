import { describe, expect, it } from 'vitest';
import { LicentaExpirataError, withLicentaGuard } from './licenta-guard.js';
import { createMemoryRepository } from './repository.js';

interface Rand {
  id: string;
  nume: string;
}

function repoCuUnRand() {
  return createMemoryRepository<Rand, Partial<Rand>>(
    (input, id) => ({ id, nume: input.nume ?? '' }),
    [{ id: 'r1', nume: 'existent' }],
  );
}

describe('withLicentaGuard', () => {
  it('cu licenta valabila, totul functioneaza normal', async () => {
    const repo = withLicentaGuard(repoCuUnRand(), () => true);
    const creat = await repo.create({ nume: 'nou' });
    expect(creat.nume).toBe('nou');
    await repo.update(creat.id, { nume: 'redenumit' });
    await repo.remove(creat.id);
    expect(await repo.list()).toHaveLength(1);
  });

  it('cu licenta expirata, CITIREA ramane permisa (datele sunt ale clientului)', async () => {
    const repo = withLicentaGuard(repoCuUnRand(), () => false);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.getById('r1')).not.toBeNull();
  });

  it('cu licenta expirata, scrierea e blocata cu o eroare identificabila', async () => {
    const repo = withLicentaGuard(repoCuUnRand(), () => false);
    await expect(repo.create({ nume: 'nou' })).rejects.toBeInstanceOf(LicentaExpirataError);
    await expect(repo.update('r1', { nume: 'x' })).rejects.toBeInstanceOf(LicentaExpirataError);
    await expect(repo.remove('r1')).rejects.toBeInstanceOf(LicentaExpirataError);
  });

  it('o scriere blocata nu modifica nimic', async () => {
    const de_baza = repoCuUnRand();
    const repo = withLicentaGuard(de_baza, () => false);
    await expect(repo.remove('r1')).rejects.toThrow();
    expect(await de_baza.list()).toHaveLength(1);
  });

  it('starea licentei e citita la fiecare apel, nu inghetata la decorare', async () => {
    let valabila = false;
    const repo = withLicentaGuard(repoCuUnRand(), () => valabila);
    await expect(repo.create({ nume: 'nou' })).rejects.toThrow();
    // Clientul reinnoieste licenta in timpul sesiunii — scrierea trebuie sa
    // redevina posibila imediat, fara repornirea aplicatiei.
    valabila = true;
    await expect(repo.create({ nume: 'nou' })).resolves.toMatchObject({ nume: 'nou' });
  });
});
