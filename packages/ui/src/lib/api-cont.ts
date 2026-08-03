/**
 * Apeluri catre endpoint-urile de cont care NU sunt CRUD pe o resursa, deci nu
 * incap in abstractia `Repository` din @gr/data: schimbarea parolei, resetarea
 * ei de catre un administrator si consumul de licenta raportat de server.
 *
 * Toate exista doar in modurile retea/cloud — in modul demo local nu exista
 * server, parole sau licenta impusa.
 */

const LS_SERVER = 'gr-server-url';

/** URL-ul serverului configurat in Setari, fara slash final. `null` in mod local. */
export function serverConfigurat(): string | null {
  const raw = localStorage.getItem(LS_SERVER);
  if (!raw?.trim()) return null;
  const mod = localStorage.getItem('gr-deployment-mode') ?? 'local';
  if (mod === 'local') return null;
  return raw.trim().replace(/\/$/, '');
}

async function cerere(
  url: string,
  token: string,
  optiuni: RequestInit,
): Promise<{ ok: true } | { ok: false; eroare: string }> {
  try {
    const r = await fetch(url, {
      ...optiuni,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...optiuni.headers,
      },
    });
    if (r.ok) return { ok: true };
    const corp = await r.json().catch(() => ({}) as { error?: string });
    return { ok: false, eroare: corp.error ?? `Eroare server (${r.status})` };
  } catch (e) {
    return { ok: false, eroare: e instanceof Error ? e.message : 'Serverul nu raspunde.' };
  }
}

/**
 * Schimbarea propriei parole. La succes serverul REVOCA tokenul curent, deci
 * apelantul trebuie sa deconecteze utilizatorul si sa-i ceara reautentificarea.
 */
export function schimbaParola(
  serverUrl: string,
  token: string,
  parolaVeche: string,
  parolaNoua: string,
) {
  return cerere(`${serverUrl}/auth/schimba-parola`, token, {
    method: 'POST',
    body: JSON.stringify({ parolaVeche, parolaNoua }),
  });
}

/** Resetarea parolei altui utilizator (necesita `utilizatori.administrare`). */
export function reseteazaParola(
  serverUrl: string,
  token: string,
  utilizatorId: string,
  parolaNoua: string,
) {
  return cerere(`${serverUrl}/utilizatori/${utilizatorId}/reseteaza-parola`, token, {
    method: 'POST',
    body: JSON.stringify({ parolaNoua }),
  });
}

export interface StareLicentaServer {
  utilizatoriActivi: number;
  /** `null` = nelimitat. */
  utilizatoriMax: number | null;
}

/**
 * Consumul de licenta asa cum il vede SERVERUL. Deliberat nu se calculeaza in
 * client: limita reala e cea impusa de server (`LICENSE_KEY`), iar afisarea
 * unei alte cifre decat cea care chiar blocheaza crearea ar deruta.
 */
export async function stareLicentaServer(
  serverUrl: string,
  token: string,
): Promise<StareLicentaServer | null> {
  try {
    const r = await fetch(`${serverUrl}/licenta/stare`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as StareLicentaServer;
  } catch {
    return null;
  }
}
