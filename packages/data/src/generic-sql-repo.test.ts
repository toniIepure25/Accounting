import { campuriSync } from '@gr/core-domain';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { createSqlRepository } from './generic-sql-repo.js';
import type { SqlExecutor } from './sql-executor.js';

const Fx = z.object({ id: z.string(), v: z.string(), ...campuriSync });
type Fx = z.infer<typeof Fx>;

async function repoSync(now: () => string) {
  const exec: SqlExecutor = fromBetterSqlite(new Database(':memory:'));
  await exec.execute(
    'CREATE TABLE fx (id TEXT PRIMARY KEY, v TEXT NOT NULL, version INTEGER, updated_at TEXT, deleted_at TEXT)',
  );
  return createSqlRepository<Fx>(exec, 'fx', Fx, now);
}

describe('createSqlRepository — stampilarea campurilor de sincronizare', () => {
  it('create stampileaza version=1, updatedAt=acum, deletedAt=null', async () => {
    const r = await repoSync(() => '2026-01-01T00:00:00.000Z');
    const c = await r.create({ id: '1', v: 'a' });
    expect(c.version).toBe(1);
    expect(c.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(c.deletedAt).toBeNull();
    // Persistat: recitirea da aceleasi valori.
    expect((await r.getById('1'))!.version).toBe(1);
  });

  it('update creste version cu 1 si reactualizeaza updatedAt', async () => {
    let t = '2026-01-01T00:00:00.000Z';
    const r = await repoSync(() => t);
    await r.create({ id: '1', v: 'a' });
    t = '2026-02-02T00:00:00.000Z';
    const u = await r.update('1', { v: 'b' });
    expect(u.version).toBe(2);
    expect(u.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    const u2 = await r.update('1', { v: 'c' });
    expect(u2.version).toBe(3);
  });

  it('scriere VERBATIM: un `updatedAt` explicit e pastrat (calea de sincronizare)', async () => {
    const r = await repoSync(() => 'ACUM');
    // Ca si cum sincronizarea ar scrie randul de pe server, cu versiunea lui.
    const c = await r.create({ id: '2', v: 'x', version: 7, updatedAt: 'SERVER', deletedAt: null });
    expect(c.version).toBe(7);
    expect(c.updatedAt).toBe('SERVER'); // NU re-stampilat
    // Idem la update cu updatedAt explicit.
    const u = await r.update('2', { v: 'y', version: 9, updatedAt: 'SERVER2' });
    expect(u.version).toBe(9);
    expect(u.updatedAt).toBe('SERVER2');
  });

  it('entitatile FARA campuri de sync nu sunt afectate (comportament neschimbat)', async () => {
    const Plain = z.object({ id: z.string(), v: z.string() });
    type Plain = z.infer<typeof Plain>;
    const exec = fromBetterSqlite(new Database(':memory:'));
    await exec.execute('CREATE TABLE p (id TEXT PRIMARY KEY, v TEXT NOT NULL)');
    const r = createSqlRepository<Plain>(exec, 'p', Plain);
    const c = await r.create({ id: '1', v: 'a' });
    expect(c).toEqual({ id: '1', v: 'a' }); // fara campuri de sync adaugate
  });
});
