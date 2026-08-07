/**
 * Endpoint-uri de COMENZI autoritare (Faza 15). Posteaza/storneaza/aproba/anuleaza
 * un document prin stratul de aplicatie (@gr/application), care ruleaza tranzactional
 * peste executorul SQL al serverului — deci UI-ul (retea/cloud) trimite COMENZI, iar
 * postarea e un eveniment de business real (stoc + jurnal + fiscal atomic), nu un
 * PATCH de stare prin CRUD-ul generic.
 */

import {
  type CommandDeps,
  DocumentInexistentError,
  PerioadaInchisaError,
  approveDocument,
  cancelDocument,
  postDocument,
  reverseDocument,
} from '@gr/application';
import {
  DocumentImutabilError,
  DocumentInvalidError,
  StocInsuficientError,
  TranzitieNepermisaError,
} from '@gr/core-domain';
import type { SqlExecutor } from '@gr/data';

export type NumeComanda =
  | 'post-document'
  | 'reverse-document'
  | 'approve-document'
  | 'cancel-document';

export const COMENZI: readonly NumeComanda[] = [
  'post-document',
  'reverse-document',
  'approve-document',
  'cancel-document',
];

export interface RezultatComanda {
  status: number;
  // biome-ignore lint/suspicious/noExplicitAny: raspuns JSON eterogen
  body: any;
}

/** Mapeaza erorile de domeniu la coduri HTTP stabile (nu scapa mesaje de driver). */
function eroareLaStatus(e: unknown): RezultatComanda {
  if (e instanceof DocumentInexistentError) return { status: 404, body: { error: e.message } };
  if (e instanceof TranzitieNepermisaError) return { status: 409, body: { error: e.message } };
  if (e instanceof DocumentImutabilError) return { status: 409, body: { error: e.message } };
  if (e instanceof PerioadaInchisaError) return { status: 423, body: { error: e.message } };
  if (e instanceof StocInsuficientError) return { status: 409, body: { error: e.message } };
  if (e instanceof DocumentInvalidError) return { status: 422, body: { error: e.message } };
  return { status: 400, body: { error: (e as Error).message ?? 'comanda a esuat' } };
}

/**
 * Executa o comanda pe documentul din `body.documentId`. `actor` identifica cine
 * a lansat comanda (pentru audit/aprobare). Intoarce statusul + corpul JSON.
 */
export async function ruleazaComanda(
  exec: SqlExecutor,
  nume: string,
  body: { documentId?: string; expectedVersion?: number; motiv?: string; data?: string },
  actor: string,
): Promise<RezultatComanda> {
  const deps: CommandDeps = { exec, actor };
  const id = body.documentId;
  if (!id) return { status: 400, body: { error: 'lipseste documentId' } };

  try {
    switch (nume) {
      case 'post-document':
        return {
          status: 200,
          body: await postDocument(deps, id, { expectedVersion: body.expectedVersion }),
        };
      case 'reverse-document':
        return {
          status: 200,
          body: await reverseDocument(deps, id, {
            motiv: body.motiv,
            data: body.data,
            expectedVersion: body.expectedVersion,
          }),
        };
      case 'approve-document':
        return { status: 200, body: await approveDocument(deps, id, body.expectedVersion) };
      case 'cancel-document':
        return { status: 200, body: await cancelDocument(deps, id, body.expectedVersion) };
      default:
        return { status: 404, body: { error: `comanda necunoscuta: ${nume}` } };
    }
  } catch (e) {
    return eroareLaStatus(e);
  }
}
