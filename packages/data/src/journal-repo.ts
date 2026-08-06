/**
 * Persistenta registrului-jurnal contabil (Faza 6). Scrie `journal_entries` +
 * `journal_lines` (append-only) si citeste pentru rapoarte/stornare. Generarea
 * notei e pura (@gr/core-domain `genereazaNotaDocument`); aici e doar I/O, folosit
 * din interiorul tranzactiei de postare.
 */

import type { Postare } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

export interface NotaContabilaPersistata {
  documentId: string | null;
  firmaId: string | null;
  data: string;
  documentCod: string;
  explicatie: string;
  postari: readonly Postare[];
}

/** Scrie o nota contabila (entry + linii) in registru. Intoarce id-ul entry-ului. */
export async function scrieNotaContabila(
  exec: SqlExecutor,
  nota: NotaContabilaPersistata,
  createdAt: string,
): Promise<string> {
  const entryId = crypto.randomUUID();
  await exec.execute(
    `INSERT INTO journal_entries (id, firma_id, document_id, data, document_cod, explicatie, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entryId,
      nota.firmaId,
      nota.documentId,
      nota.data,
      nota.documentCod,
      nota.explicatie,
      createdAt,
    ],
  );
  for (const post of nota.postari) {
    await exec.execute(
      'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), entryId, post.cont, post.debitBani, post.creditBani],
    );
  }
  return entryId;
}

/** Postarile (linii) ale notelor unui document — pentru stornare/audit. */
export async function listeazaLiniiJurnalDocument(
  exec: SqlExecutor,
  documentId: string,
): Promise<Postare[]> {
  return exec.select<Postare>(
    `SELECT jl.cont AS cont, jl.debit_bani AS debitBani, jl.credit_bani AS creditBani
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.entry_id
      WHERE je.document_id = ?
      ORDER BY je.created_at, jl.id`,
    [documentId],
  );
}

/** Toate liniile jurnalului (pentru balanta de verificare persistata). */
export async function listeazaLiniiJurnal(
  exec: SqlExecutor,
  firmaId?: string | null,
): Promise<Postare[]> {
  if (firmaId != null) {
    return exec.select<Postare>(
      `SELECT jl.cont AS cont, jl.debit_bani AS debitBani, jl.credit_bani AS creditBani
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.firma_id = ?`,
      [firmaId],
    );
  }
  return exec.select<Postare>(
    'SELECT cont AS cont, debit_bani AS debitBani, credit_bani AS creditBani FROM journal_lines',
  );
}
