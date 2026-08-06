/**
 * Persistenta registrului de stoc (Faza 5). Citeste/scrie `stock_ledger_entries`
 * (append-only) si `stock_balances` (sold materializat). Motorul de CMP este pur
 * (@gr/core-domain `posteazaStocDocument`); aici e doar I/O-ul, folosit din
 * interiorul tranzactiei comenzii de postare.
 */

import type { IntrareLedgerStoc, SoldCurent } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

export interface SoldStocPersistat {
  gestiuneId: string;
  produsId: string;
  firmaId: string | null;
  cantitate: number;
  valoareBani: number;
  pmpBani: number;
}

/** Soldul curent al unei perechi (gestiune, produs), sau `null` daca nu exista. */
export async function citesteBalantaStoc(
  exec: SqlExecutor,
  gestiuneId: string,
  produsId: string,
): Promise<SoldCurent | null> {
  const r = await exec.select<{ cantitate: number; valoare_bani: number }>(
    'SELECT cantitate, valoare_bani FROM stock_balances WHERE gestiune_id = ? AND produs_id = ?',
    [gestiuneId, produsId],
  );
  if (r.length === 0) return null;
  return { cantitate: Number(r[0]!.cantitate), valoareBani: Number(r[0]!.valoare_bani) };
}

/** Scrie o intrare de registru (append-only). */
export async function scrieIntrareLedger(
  exec: SqlExecutor,
  e: IntrareLedgerStoc,
  createdAt: string,
): Promise<void> {
  await exec.execute(
    `INSERT INTO stock_ledger_entries
       (id, firma_id, gestiune_id, produs_id, document_id, document_linie_id, data,
        tip_document, cantitate, valoare_bani, sold_cantitate_dupa,
        sold_valoare_bani_dupa, pmp_bani_dupa, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      e.firmaId,
      e.gestiuneId,
      e.produsId,
      e.documentId,
      e.documentLinieId,
      e.data,
      e.tipDocument,
      e.cantitate,
      e.valoareBani,
      e.soldCantitateDupa,
      e.soldValoareBaniDupa,
      e.pmpBaniDupa,
      createdAt,
    ],
  );
}

/** Upsert sold materializat (INSERT sau UPDATE) — compatibil SQLite + PostgreSQL. */
export async function upsertBalantaStoc(
  exec: SqlExecutor,
  s: SoldStocPersistat,
  updatedAt: string,
): Promise<void> {
  await exec.execute(
    `INSERT INTO stock_balances
       (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (gestiune_id, produs_id) DO UPDATE SET
       cantitate = excluded.cantitate,
       valoare_bani = excluded.valoare_bani,
       pmp_bani = excluded.pmp_bani,
       firma_id = excluded.firma_id,
       updated_at = excluded.updated_at`,
    [s.gestiuneId, s.produsId, s.firmaId, s.cantitate, s.valoareBani, s.pmpBani, updatedAt],
  );
}

/** Toate soldurile materializate (pentru rapoarte care deriva din registru). */
export async function listeazaBalanteStoc(
  exec: SqlExecutor,
  firmaId?: string | null,
): Promise<SoldStocPersistat[]> {
  const randuri =
    firmaId != null
      ? await exec.select<Record<string, unknown>>(
          'SELECT * FROM stock_balances WHERE firma_id = ?',
          [firmaId],
        )
      : await exec.select<Record<string, unknown>>('SELECT * FROM stock_balances');
  return randuri.map((r) => ({
    gestiuneId: String(r.gestiune_id),
    produsId: String(r.produs_id),
    firmaId: (r.firma_id as string | null) ?? null,
    cantitate: Number(r.cantitate),
    valoareBani: Number(r.valoare_bani),
    pmpBani: Number(r.pmp_bani),
  }));
}

/** Intrarile de registru pentru un document (pentru audit / stornare). */
export async function listeazaLedgerDocument(
  exec: SqlExecutor,
  documentId: string,
): Promise<Record<string, unknown>[]> {
  return exec.select<Record<string, unknown>>(
    'SELECT * FROM stock_ledger_entries WHERE document_id = ? ORDER BY created_at',
    [documentId],
  );
}
