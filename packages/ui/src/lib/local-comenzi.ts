import {
  type CommandDeps,
  approveDocument,
  cancelDocument,
  postDocument,
  reverseDocument,
} from '@gr/application';
import type { ClientComenziOffline, CorpComanda, NumeComandaDocument, SqlExecutor } from '@gr/data';

/**
 * Client de COMENZI pentru modul `local-sqlite`: ruleaza ACELASI motor
 * @gr/application (postare/stornare = stoc + jurnal + fiscal atomic) direct pe
 * executorul SQLite-WASM din browser — deci postarea scrie registrele local,
 * offline, exact ca pe server, nu doar un flip de stare prin CRUD.
 *
 * Implementeaza `ClientComenziOffline` (nu doar `ClientComenzi`) ca sa fie
 * interschimbabil cu clientul de retea in `useComenzi`; `sincronizeaza`/
 * `inAsteptare` sunt no-op (local nu are coada — scrierile sunt deja aplicate).
 */
export function createLocalCommandClient(exec: SqlExecutor, actor: string): ClientComenziOffline {
  const deps: CommandDeps = { exec, actor };
  const ruleaza = (nume: NumeComandaDocument, corp: CorpComanda): Promise<unknown> => {
    switch (nume) {
      case 'post-document':
        return postDocument(deps, corp.documentId, { expectedVersion: corp.expectedVersion });
      case 'reverse-document':
        return reverseDocument(deps, corp.documentId, {
          motiv: corp.motiv,
          data: corp.data,
          expectedVersion: corp.expectedVersion,
        });
      case 'approve-document':
        return approveDocument(deps, corp.documentId, corp.expectedVersion);
      case 'cancel-document':
        return cancelDocument(deps, corp.documentId, corp.expectedVersion);
      default:
        return Promise.reject(new Error(`comanda necunoscuta: ${nume}`));
    }
  };
  return {
    ruleaza,
    posteaza: (documentId, expectedVersion) =>
      ruleaza('post-document', { documentId, expectedVersion }),
    storneaza: (documentId, optiuni = {}) =>
      ruleaza('reverse-document', { documentId, ...optiuni }),
    sincronizeaza: async () => ({ redate: 0, esuate: [], ramase: 0 }),
    inAsteptare: () => [],
  };
}
