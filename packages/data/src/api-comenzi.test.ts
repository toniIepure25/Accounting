import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCommandClient } from './api-comenzi.js';

function raspuns(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    json: async () => body,
  } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe('createCommandClient — client de comenzi autoritare', () => {
  it('posteaza: POST /commands/post-document cu documentId + token Bearer', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(raspuns(200, { document: { id: 'd1', stare: 'validat' } }));
    const client = createCommandClient('http://srv:8787/', () => 'tok-123');

    const rez = (await client.posteaza('d1', 2)) as { document: { stare: string } };

    expect(rez.document.stare).toBe('validat');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/commands/post-document'); // slash final normalizat
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init?.body as string)).toEqual({ documentId: 'd1', expectedVersion: 2 });
  });

  it('storneaza: POST /commands/reverse-document cu motiv/data', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(raspuns(200, { ok: true }));
    const client = createCommandClient('http://srv:8787', () => null);

    await client.storneaza('d9', { motiv: 'eroare', data: '2026-03-01' });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('http://srv:8787/commands/reverse-document');
    expect(JSON.parse(init?.body as string)).toEqual({
      documentId: 'd9',
      motiv: 'eroare',
      data: '2026-03-01',
    });
    // Fara token => fara antet authorization.
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('ridica mesajul de business al serverului (nu „HTTP 409")', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      raspuns(409, { error: 'Tranzitie nepermisa: documentul e deja validat.' }),
    );
    const client = createCommandClient('http://srv', () => null);

    await expect(client.posteaza('d1')).rejects.toThrow(
      'Tranzitie nepermisa: documentul e deja validat.',
    );
  });

  it('cade pe un mesaj generic cand raspunsul de eroare nu are corp JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('nu e JSON');
      },
    } as unknown as Response);
    const client = createCommandClient('http://srv', () => null);

    await expect(client.posteaza('d1')).rejects.toThrow(
      'Eroare server (500 Internal Server Error)',
    );
  });
});
