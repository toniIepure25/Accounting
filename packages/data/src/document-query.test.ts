import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { type CursorDocument, interogheazaDocumente } from './document-query.js';
import { type Migration, migrate } from './migrate.js';
import { withExecutor } from './provider.js';
import type { SqlExecutor } from './sql-executor.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const FIRMA_A = '00000000-0000-4000-8000-00000000000a';
const FIRMA_B = '00000000-0000-4000-8000-00000000000b';

async function seed(exec: SqlExecutor): Promise<void> {
  const repos = withExecutor(exec);
  // 10 documente firma A pe zile diferite; 5 firma B.
  for (let i = 1; i <= 10; i++) {
    await repos.documente.create({
      firmaId: FIRMA_A,
      tip: i % 2 === 0 ? 'factura_vanzare' : 'receptie_furnizor',
      data: `2025-09-${String(i).padStart(2, '0')}`,
      cod: `A-${i}`,
    });
  }
  for (let i = 1; i <= 5; i++) {
    await repos.documente.create({
      firmaId: FIRMA_B,
      tip: 'factura_vanzare',
      data: `2025-09-${String(i).padStart(2, '0')}`,
      cod: `B-${i}`,
    });
  }
}

describe('interogheazaDocumente — paginare keyset + filtre (Faza 13)', () => {
  let exec: SqlExecutor;
  beforeEach(async () => {
    exec = fromBetterSqlite(new Database(':memory:'));
    await migrate(exec, migratii());
    await seed(exec);
  });

  it('intoarce o pagina marginita + cursor de continuare', async () => {
    const p = await interogheazaDocumente(exec, { firmaId: FIRMA_A }, { limita: 4 });
    expect(p.randuri).toHaveLength(4);
    expect(p.urmatorCursor).not.toBeNull();
    // ordonat descrescator pe data
    expect(p.randuri[0]!.data > p.randuri[3]!.data).toBe(true);
  });

  it('paginare completa: fara suprapunere si fara goluri; ultima pagina fara cursor', async () => {
    const vazute: string[] = [];
    let cursor: CursorDocument | null = null;
    let pagini = 0;
    do {
      const p = await interogheazaDocumente(
        exec,
        { firmaId: FIRMA_A },
        { limita: 3, dupa: cursor ?? undefined },
      );
      for (const d of p.randuri) vazute.push(d.cod);
      cursor = p.urmatorCursor;
      pagini++;
      expect(pagini).toBeLessThan(10); // termina
    } while (cursor);

    expect(vazute).toHaveLength(10); // toate documentele firmei A
    expect(new Set(vazute).size).toBe(10); // fara duplicate
  });

  it('filtreaza pe firma: firma A nu vede documentele firmei B', async () => {
    const p = await interogheazaDocumente(exec, { firmaId: FIRMA_A }, { limita: 100 });
    expect(p.randuri).toHaveLength(10);
    expect(p.randuri.every((d) => d.firmaId === FIRMA_A)).toBe(true);
  });

  it('filtreaza pe tip + interval de date', async () => {
    const p = await interogheazaDocumente(
      exec,
      { firmaId: FIRMA_A, tip: 'factura_vanzare', de: '2025-09-05', pana: '2025-09-10' },
      { limita: 100 },
    );
    // facturi de vanzare (i par) intre 05 si 10 => 06, 08, 10
    expect(p.randuri.map((d) => d.cod).sort()).toEqual(['A-10', 'A-6', 'A-8']);
  });

  it('limita e marginita (max 500)', async () => {
    const p = await interogheazaDocumente(exec, {}, { limita: 100000 });
    expect(p.randuri.length).toBeLessThanOrEqual(500);
  });
});
