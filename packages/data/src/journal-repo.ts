/**
 * Persistenta registrului-jurnal contabil (Faza 6). Scrie `journal_entries` +
 * `journal_lines` (append-only) si citeste pentru rapoarte/stornare. Generarea
 * notei e pura (@gr/core-domain `genereazaNotaDocument`); aici e doar I/O, folosit
 * din interiorul tranzactiei de postare.
 */

import type { NotaContabila, Postare } from '@gr/core-domain';
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

/**
 * Notele contabile PERSISTATE (entry + postarile lui), grupate ca `NotaContabila`
 * — sursa pentru rapoartele contabile (registru-jurnal, cartea mare, balanta, fisa
 * de cont) citite din registru, nu recalculate din documente. Optional scopate pe
 * firma. Ordonate cronologic (data, apoi ordinea de scriere).
 */
export async function listeazaNoteContabilePersistate(
  exec: SqlExecutor,
  firmaId?: string | null,
): Promise<NotaContabila[]> {
  const undeFirma = firmaId != null ? ' WHERE je.firma_id = ?' : '';
  const paramsEntry = firmaId != null ? [firmaId] : [];
  const entryuri = await exec.select<{
    id: string;
    data: string;
    document_cod: string;
    explicatie: string;
  }>(
    `SELECT je.id AS id, je.data AS data, je.document_cod AS document_cod, je.explicatie AS explicatie
       FROM journal_entries je${undeFirma}
      ORDER BY je.data, je.created_at, je.id`,
    paramsEntry,
  );
  if (entryuri.length === 0) return [];

  const postariPeEntry = new Map<string, Postare[]>();
  for (const e of entryuri) {
    const linii = await exec.select<Postare>(
      `SELECT cont AS cont, debit_bani AS debitBani, credit_bani AS creditBani
         FROM journal_lines WHERE entry_id = ? ORDER BY id`,
      [e.id],
    );
    postariPeEntry.set(e.id, linii);
  }
  return entryuri.map((e) => ({
    data: e.data,
    documentCod: e.document_cod,
    explicatie: e.explicatie,
    postari: postariPeEntry.get(e.id) ?? [],
  }));
}

/** Liniile jurnalului pe un interval de date (+ firma) — pentru SAF-T / balanta pe perioada. */
export async function listeazaLiniiJurnalInterval(
  exec: SqlExecutor,
  interval: { de?: string; pana?: string; firmaId?: string | null } = {},
): Promise<Postare[]> {
  const conditii: string[] = [];
  const params: unknown[] = [];
  if (interval.de) {
    conditii.push('je.data >= ?');
    params.push(interval.de);
  }
  if (interval.pana) {
    conditii.push('je.data <= ?');
    params.push(interval.pana);
  }
  if (interval.firmaId != null) {
    conditii.push('je.firma_id = ?');
    params.push(interval.firmaId);
  }
  const where = conditii.length > 0 ? ` WHERE ${conditii.join(' AND ')}` : '';
  return exec.select<Postare>(
    `SELECT jl.cont AS cont, jl.debit_bani AS debitBani, jl.credit_bani AS creditBani
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.entry_id${where}
      ORDER BY je.data, je.created_at, jl.id`,
    params,
  );
}
