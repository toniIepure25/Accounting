import type { NotaContabila } from '@gr/core-domain';
import type { FurnizorToken } from './api-repo.js';

/**
 * Client pentru RAPOARTELE citite din registrele persistente ale serverului
 * (modurile retea/cloud). Ex.: notele contabile vin din `journal_entries` +
 * `journal_lines` scrise la postare — sursa de adevar — nu recalculate din
 * documente in client. In modul local (fara server) apelantul cade pe recalculare.
 */
export interface ClientRapoarte {
  /** Notele contabile persistate (registru-jurnal / cartea mare / balanta / fisa). */
  noteContabile(): Promise<NotaContabila[]>;
}

export function createReportsClient(baseUrl: string, getToken?: FurnizorToken): ClientRapoarte {
  const base = baseUrl.replace(/\/$/, '');
  const headers = () => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    const token = getToken?.();
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };

  const ok = async (r: Response) => {
    if (!r.ok) {
      try {
        const corp = (await r.json()) as { error?: string };
        if (corp?.error) throw new Error(corp.error);
      } catch {
        /* fara corp JSON */
      }
      throw new Error(`Eroare server (${r.status} ${r.statusText})`);
    }
    return r.json();
  };

  return {
    noteContabile: () =>
      fetch(`${base}/reports/journal`, { headers: headers() }).then(ok) as Promise<NotaContabila[]>,
  };
}
