import { describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import { createMemoryProvider } from './provider.js';
import type { SqlExecutor } from './sql-executor.js';

describe('memory provider - gestiuni', () => {
  it('creeaza, citeste, actualizeaza si sterge', async () => {
    const db = createMemoryProvider();

    const g = await db.gestiuni.create({
      cod: 'BAR',
      denumire: 'Gestiune Bar',
      gestionar: 'Ion Pop',
      contSintetic: '371',
      contAnalitic: '371.01',
      tip: 'global_valorica',
      punctDeLucruId: null,
      activ: true,
    });
    expect(g.id).toBeTruthy();
    expect(g.cod).toBe('BAR');

    expect(await db.gestiuni.list()).toHaveLength(1);

    const updated = await db.gestiuni.update(g.id, { denumire: 'Bar Central' });
    expect(updated.denumire).toBe('Bar Central');

    await db.gestiuni.remove(g.id);
    expect(await db.gestiuni.list()).toHaveLength(0);
  });

  it('aplica valorile implicite din schema (activ=true, tip implicit)', async () => {
    const db = createMemoryProvider();
    const g = await db.gestiuni.create({
      cod: 'DEP',
      denumire: 'Depozit',
    } as never);
    expect(g.activ).toBe(true);
    expect(g.tip).toBe('cantitativ_valorica');
  });
});

describe('migrate runner', () => {
  it('aplica doar migratiile neaplicate, o singura data', async () => {
    // Executor mock care simuleaza minimal tabela _migrations.
    const appliedIds = new Set<string>();
    const executed: string[] = [];
    const exec: SqlExecutor = {
      async execute(sql, params) {
        executed.push(sql.split('\n')[0]!.trim());
        if (sql.startsWith('INSERT INTO _migrations')) {
          appliedIds.add(String(params?.[0]));
        }
        return { rowsAffected: 1 };
      },
      async select<T>(sql: string) {
        if (sql.includes('FROM _migrations')) {
          return [...appliedIds].map((id) => ({ id })) as T[];
        }
        return [] as T[];
      },
      // Migrate runner nu foloseste tranzactii — stub minimal (ruleaza work direct).
      async transaction(_options, work) {
        return work(exec);
      },
    };

    const migrations = [
      { id: '0001_init', sql: 'CREATE TABLE a (id TEXT);' },
      { id: '0002_more', sql: 'CREATE TABLE b (id TEXT);' },
    ];

    const first = await migrate(exec, migrations);
    expect(first).toEqual(['0001_init', '0002_more']);

    const second = await migrate(exec, migrations);
    expect(second).toEqual([]); // deja aplicate
  });
});
