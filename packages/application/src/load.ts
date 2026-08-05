import type { Document, DocumentLinie } from '@gr/core-domain';
import type { DataProvider } from '@gr/data';

/** Aruncata cand o comanda tinteste un document care nu exista. */
export class DocumentInexistentError extends Error {
  constructor(public readonly id: string) {
    super(`Documentul ${id} nu exista.`);
    this.name = 'DocumentInexistentError';
  }
}

export interface DocumentCuLinii {
  document: Document;
  linii: DocumentLinie[];
}

/**
 * Incarca un document + liniile lui. Liniile se filtreaza pe `documentId`
 * (interogarea `list()` va fi inlocuita cu un query dedicat in Faza 13 — query
 * model + paginare; la scara de acum e acceptabil si onest documentat).
 */
export async function incarcaDocumentCuLinii(
  repos: DataProvider,
  id: string,
): Promise<DocumentCuLinii> {
  const document = await repos.documente.getById(id);
  if (!document) throw new DocumentInexistentError(id);
  const toate = await repos.documenteLinii.list();
  const linii = toate.filter((l) => l.documentId === id);
  return { document, linii };
}
