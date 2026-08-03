import { describe, expect, it } from 'vitest';
import { randuriVizibilePentruFirma, withFirmaScope } from './firma-scope.js';
import { createMemoryRepository } from './repository.js';

interface Rand {
  id: string;
  firmaId: string | null;
  denumire: string;
}

describe('randuriVizibilePentruFirma', () => {
  const randuri: Rand[] = [
    { id: '1', firmaId: 'A', denumire: 'a' },
    { id: '2', firmaId: 'B', denumire: 'b' },
    { id: '3', firmaId: null, denumire: 'vechi, nescopat' },
  ];

  it('fara firma curenta (null), nu filtreaza nimic', () => {
    expect(randuriVizibilePentruFirma(randuri, null)).toHaveLength(3);
  });

  it('cu firma curenta, arata doar randurile ei plus cele nescopate', () => {
    const vizibile = randuriVizibilePentruFirma(randuri, 'A');
    expect(vizibile.map((r) => r.id).sort()).toEqual(['1', '3']);
  });

  it('o firma fara randuri proprii vede doar cele nescopate', () => {
    const vizibile = randuriVizibilePentruFirma(randuri, 'C');
    expect(vizibile.map((r) => r.id)).toEqual(['3']);
  });
});

describe('withFirmaScope', () => {
  const buildRepo = () =>
    createMemoryRepository<Rand, Partial<Rand>>(
      (input, id) => ({
        id,
        firmaId: (input.firmaId as string | null | undefined) ?? null,
        denumire: (input.denumire as string) ?? '',
      }),
      [
        { id: '1', firmaId: 'A', denumire: 'a' },
        { id: '2', firmaId: 'B', denumire: 'b' },
      ],
    );

  it('list() arata doar randurile firmei curente', async () => {
    let firmaCurenta = 'A';
    const scoped = withFirmaScope(buildRepo(), () => firmaCurenta);
    expect(await scoped.list()).toHaveLength(1);
    firmaCurenta = 'B';
    expect(await scoped.list()).toHaveLength(1);
  });

  it('create() stampileaza firma curenta, ignorand orice firmaId trimis de apelant', async () => {
    const scoped = withFirmaScope(buildRepo(), () => 'A');
    const creat = await scoped.create({ denumire: 'nou', firmaId: 'ALTCEVA' });
    expect(creat.firmaId).toBe('A');
  });

  it('fara firma curenta selectata, list() nu filtreaza si create() nu stampileaza', async () => {
    const scoped = withFirmaScope(buildRepo(), () => null);
    expect(await scoped.list()).toHaveLength(2);
    const creat = await scoped.create({ denumire: 'nou' });
    expect(creat.firmaId).toBeNull();
  });
});
