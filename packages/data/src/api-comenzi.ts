import type { FurnizorToken } from './api-repo.js';

/**
 * Client pentru COMENZILE autoritare ale serverului (POST /commands/<nume>).
 *
 * Postarea/stornarea unui document NU sunt un PATCH de stare prin CRUD-ul generic
 * — sunt evenimente de business reale care, pe server, ruleaza tranzactional prin
 * @gr/application (stoc + jurnal + fiscal atomic). UI-ul (modurile retea/cloud)
 * trebuie sa le declanseze prin acest client, ca efectul sa fie cel real, nu o
 * simpla schimbare a coloanei `stare`. In modul local (fara server) nu exista
 * motor de comenzi — apelantul cade pe calea CRUD (vezi useComenzi in @gr/ui).
 */

export type NumeComandaDocument =
  | 'post-document'
  | 'reverse-document'
  | 'approve-document'
  | 'cancel-document';

export interface CorpComanda {
  documentId: string;
  expectedVersion?: number;
  motiv?: string;
  data?: string;
}

export interface ClientComenzi {
  /** Ruleaza o comanda pe server; intoarce corpul JSON al raspunsului (documentul postat etc.). */
  ruleaza(nume: NumeComandaDocument, corp: CorpComanda): Promise<unknown>;
  /** Scurtaturi lizibile pentru cele mai folosite comenzi. */
  posteaza(documentId: string, expectedVersion?: number): Promise<unknown>;
  storneaza(documentId: string, optiuni?: { motiv?: string; data?: string }): Promise<unknown>;
}

/**
 * Construieste un client de comenzi legat de un server + un furnizor de token
 * (citit la FIECARE cerere, nu capturat o data — la fel ca `createApiRepository`).
 * Erorile de business ale serverului (409 tranzitie nepermisa, 423 perioada
 * inchisa, 409 stoc insuficient etc.) sosesc ca `{ error }` in corp si sunt
 * ridicate ca `Error` cu acel mesaj — actionabil pentru utilizator, nu „HTTP 409".
 */
export function createCommandClient(baseUrl: string, getToken?: FurnizorToken): ClientComenzi {
  const base = baseUrl.replace(/\/$/, '');
  const headers = () => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    const token = getToken?.();
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };

  const eroareDinRaspuns = async (r: Response): Promise<Error> => {
    try {
      const corp = (await r.json()) as { error?: string };
      if (corp?.error) return new Error(corp.error);
    } catch {
      /* raspuns fara corp JSON — cadem pe mesajul generic */
    }
    return new Error(`Eroare server (${r.status} ${r.statusText})`);
  };

  const ruleaza = async (nume: NumeComandaDocument, corp: CorpComanda): Promise<unknown> => {
    const r = await fetch(`${base}/commands/${nume}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(corp),
    });
    if (!r.ok) throw await eroareDinRaspuns(r);
    return r.json();
  };

  return {
    ruleaza,
    posteaza: (documentId, expectedVersion) =>
      ruleaza('post-document', { documentId, expectedVersion }),
    storneaza: (documentId, optiuni = {}) =>
      ruleaza('reverse-document', { documentId, ...optiuni }),
  };
}
