import { asertaEditabil } from '@gr/core-domain';
import type { DataProvider } from '@gr/data';

/**
 * Garda de imutabilitate pentru caile CRUD generice: inainte de un PATCH/DELETE
 * pe un document, verifica starea persistata si arunca `DocumentImutabilError`
 * daca documentul e postat/stornat/anulat. Se foloseste server-side (si in
 * client) ca sa nu se poata modifica/sterge un document postat prin repository-ul
 * generic, ocolind comenzile.
 */
export async function asertaDocumentEditabilPersistat(
  repos: DataProvider,
  id: string,
  operatie: string,
): Promise<void> {
  const doc = await repos.documente.getById(id);
  if (!doc) return; // inexistent — lasa stratul CRUD sa raporteze lipsa
  asertaEditabil(doc.stare, operatie);
}
