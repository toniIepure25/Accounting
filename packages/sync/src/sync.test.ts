import { describe, expect, it } from 'vitest';
import { type Versionat, active, alegeInvingator, aplica, reconcile, stergeLocal } from './sync.js';

const rec = (
  id: string,
  version: number,
  updatedAt: string,
  deletedAt: string | null = null,
): Versionat => ({
  id,
  version,
  updatedAt,
  deletedAt,
});

describe('LWW', () => {
  it('castiga versiunea mai mare', () => {
    expect(alegeInvingator(rec('a', 2, '2026-01-01'), rec('a', 5, '2020-01-01')).version).toBe(5);
  });
  it('la egalitate de versiune, castiga updatedAt mai recent', () => {
    expect(alegeInvingator(rec('a', 3, '2026-05-01'), rec('a', 3, '2026-01-01')).updatedAt).toBe(
      '2026-05-01',
    );
  });
});

describe('reconcile', () => {
  it('localul mai nou merge la push, remote-ul mai nou la pull', () => {
    const local = [rec('a', 3, '2026-05-01'), rec('b', 1, '2026-01-01')];
    const remote = [rec('a', 1, '2026-01-01'), rec('c', 2, '2026-02-01')];
    const r = reconcile(local, remote);
    expect(r.dePush.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(r.dePull.map((x) => x.id).sort()).toEqual(['c']);
    expect(r.merged).toHaveLength(3);
    expect(r.merged.find((x) => x.id === 'a')!.version).toBe(3);
  });

  it('o stergere cu versiune mai mare castiga', () => {
    const local = [rec('a', 5, '2026-05-01', '2026-05-01')]; // tombstone
    const remote = [rec('a', 3, '2026-04-01')];
    const r = reconcile(local, remote);
    expect(r.merged[0]!.deletedAt).toBeTruthy();
    expect(active(r.merged)).toHaveLength(0);
    expect(r.dePush.map((x) => x.id)).toEqual(['a']);
  });
});

describe('aplica + tombstone', () => {
  it('aplica modificari LWW peste store', () => {
    const store = [rec('a', 1, '2026-01-01'), rec('b', 1, '2026-01-01')];
    const next = aplica(store, [rec('a', 2, '2026-02-01')]);
    expect(next.find((x) => x.id === 'a')!.version).toBe(2);
  });
  it('stergeLocal produce un tombstone cu versiune bumpata', () => {
    const t = stergeLocal(rec('a', 4, '2026-01-01'));
    expect(t.version).toBe(5);
    expect(t.deletedAt).toBeTruthy();
  });
});
