import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { createReportsClient } from './api-rapoarte.js';
import { type Migration, migrate } from './migrate.js';
import type { SqlExecutor } from './sql-executor.js';
import {
  listeazaMiscariStocPersistate,
  listeazaSolduriStoc,
  scrieIntrareLedger,
  upsertBalantaStoc,
} from './stock-ledger-repo.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}
async function baza(): Promise<SqlExecutor> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  return exec;
}
const NOW = '2026-02-24T09:00:00.000Z';

describe('rapoarte de stoc persistate', () => {
  it('listeazaMiscariStocPersistate: MiscareStoc[] cu cod document (join), cronologic', async () => {
    const exec = await baza();
    const gestiuneId = crypto.randomUUID();
    const produsId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await exec.execute('INSERT INTO gestiuni (id, cod, denumire) VALUES (?, ?, ?)', [
      gestiuneId,
      'G',
      'Depozit',
    ]);
    await exec.execute('INSERT INTO produse (id, cod, denumire) VALUES (?, ?, ?)', [
      produsId,
      'P',
      'Marfa',
    ]);
    await exec.execute(
      'INSERT INTO documente (id, tip, data, gestiune_id, stare, numar, serie, cod) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [docId, 'plus_minus', '2026-02-10', gestiuneId, 'validat', 1, 'PM', 'PM-2026-000001'],
    );
    await scrieIntrareLedger(
      exec,
      {
        firmaId: null,
        gestiuneId,
        produsId,
        documentId: docId,
        documentLinieId: null,
        data: '2026-02-10',
        tipDocument: 'plus_minus',
        cantitate: 5,
        valoareBani: 5000,
        soldCantitateDupa: 5,
        soldValoareBaniDupa: 5000,
        pmpBaniDupa: 1000,
      },
      NOW,
    );

    const miscari = await listeazaMiscariStocPersistate(exec);
    expect(miscari).toHaveLength(1);
    expect(miscari[0]!.documentCod).toBe('PM-2026-000001'); // join la documente
    expect(miscari[0]!.cantitate).toBe(5);
    expect(miscari[0]!.valoareBani).toBe(5000);
  });

  it('listeazaSolduriStoc: SoldStoc[] din stock_balances, scopat pe firma', async () => {
    const exec = await baza();
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    await exec.execute('INSERT INTO gestiuni (id, cod, denumire) VALUES (?, ?, ?)', [g, 'G', 'D']);
    await exec.execute('INSERT INTO produse (id, cod, denumire) VALUES (?, ?, ?)', [p, 'P', 'M']);
    await upsertBalantaStoc(
      exec,
      {
        gestiuneId: g,
        produsId: p,
        firmaId: 'firma-A',
        cantitate: 8,
        valoareBani: 8000,
        pmpBani: 1000,
      },
      NOW,
    );

    const aleA = await listeazaSolduriStoc(exec, 'firma-A');
    expect(aleA).toHaveLength(1);
    expect(aleA[0]!.cantitate).toBe(8);
    expect(aleA[0]!.pmpBani).toBe(1000);
    expect(await listeazaSolduriStoc(exec, 'firma-B')).toHaveLength(0);
  });
});

function raspuns(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    json: async () => body,
  } as Response;
}
afterEach(() => vi.restoreAllMocks());

describe('createReportsClient.stoc', () => {
  it('GET /reports/stock cu token, intoarce {miscari, solduri}', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(raspuns(200, { miscari: [], solduri: [{ gestiuneId: 'g' }] }));
    const client = createReportsClient('http://srv:8787/', () => 'tok');

    const r = await client.stoc();

    expect(r.solduri).toHaveLength(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/reports/stock');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });
});
