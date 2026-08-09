import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from './api-admin.js';
import type { BackupBaza } from './backup-sql.js';

function raspuns(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    json: async () => body,
  } as Response;
}

const SNAP: BackupBaza = {
  versiune: 1,
  exportatLa: '2026-08-09T00:00:00.000Z',
  tabele: {
    firme: [{ id: 'f1' }],
    journal_lines: [{ id: 'j1', debit_bani: 100, credit_bani: 100 }],
  },
};

describe('createAdminClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('backup: GET /admin/backup cu token, intoarce instantaneul complet', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(raspuns(200, SNAP));
    const client = createAdminClient('http://srv:8787/', () => 'tok');

    const snap = await client.backup();

    expect(snap.tabele.journal_lines).toHaveLength(1); // registrele sunt incluse
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/admin/backup');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('restaureaza: POST /admin/restore cu corpul = instantaneul', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(raspuns(200, { tabeleRestaurate: 2, randuriRestaurate: 2 }));
    const client = createAdminClient('http://srv:8787', () => 'tok');

    const r = await client.restaureaza(SNAP);

    expect(r).toEqual({ tabeleRestaurate: 2, randuriRestaurate: 2 });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/admin/restore');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string).tabele.firme).toHaveLength(1);
  });

  it('propaga mesajul de eroare al serverului (ex. 501 pe PostgreSQL)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      raspuns(501, { error: 'Backup/restore pe PostgreSQL se face prin CLI' }),
    );
    const client = createAdminClient('http://srv:8787', () => 'tok');

    await expect(client.backup()).rejects.toThrow('CLI');
  });
});
