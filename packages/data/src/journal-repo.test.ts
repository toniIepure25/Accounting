import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import { createReportsClient } from './api-rapoarte.js';
import { listeazaNoteContabilePersistate, scrieNotaContabila } from './journal-repo.js';
import { type Migration, migrate } from './migrate.js';
import type { SqlExecutor } from './sql-executor.js';

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

describe('listeazaNoteContabilePersistate — note contabile din registru', () => {
  it('grupeaza postarile pe nota si ordoneaza cronologic', async () => {
    const exec = await baza();
    await scrieNotaContabila(
      exec,
      {
        documentId: null,
        firmaId: null,
        data: '2026-02-10',
        documentCod: 'FV-1',
        explicatie: 'Vanzare',
        postari: [
          { cont: '4111', debitBani: 2420, creditBani: 0 },
          { cont: '707', debitBani: 0, creditBani: 2000 },
          { cont: '4427', debitBani: 0, creditBani: 420 },
        ],
      },
      NOW,
    );
    await scrieNotaContabila(
      exec,
      {
        documentId: null,
        firmaId: null,
        data: '2026-02-05',
        documentCod: 'NIR-1',
        explicatie: 'Receptie',
        postari: [
          { cont: '371', debitBani: 1000, creditBani: 0 },
          { cont: '401', debitBani: 0, creditBani: 1000 },
        ],
      },
      NOW,
    );

    const note = await listeazaNoteContabilePersistate(exec);
    expect(note).toHaveLength(2);
    // Ordonate pe data crescator: NIR (02-05) inaintea FV (02-10).
    expect(note[0]!.documentCod).toBe('NIR-1');
    expect(note[1]!.documentCod).toBe('FV-1');
    expect(note[1]!.postari).toHaveLength(3);
    const tot = note.flatMap((n) => n.postari);
    const debit = tot.reduce((s, p) => s + p.debitBani, 0);
    const credit = tot.reduce((s, p) => s + p.creditBani, 0);
    expect(debit).toBe(credit); // echilibrat
  });

  it('scopeaza pe firma', async () => {
    const exec = await baza();
    const nota = (firmaId: string | null, cod: string) => ({
      documentId: null,
      firmaId,
      data: '2026-02-10',
      documentCod: cod,
      explicatie: 'x',
      postari: [{ cont: '5311', debitBani: 100, creditBani: 100 }],
    });
    await scrieNotaContabila(exec, nota('firma-A', 'A-1'), NOW);
    await scrieNotaContabila(exec, nota('firma-B', 'B-1'), NOW);

    const aleA = await listeazaNoteContabilePersistate(exec, 'firma-A');
    expect(aleA.map((n) => n.documentCod)).toEqual(['A-1']);
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

describe('createReportsClient — client de rapoarte persistate', () => {
  it('noteContabile: GET /reports/journal cu token Bearer', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(raspuns(200, [{ data: '2026-02-10', documentCod: 'FV-1', postari: [] }]));
    const client = createReportsClient('http://srv:8787/', () => 'tok');

    const note = await client.noteContabile();

    expect(note).toHaveLength(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/reports/journal');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });
});
