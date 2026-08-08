/**
 * Persistenta registrului de stoc (Faza 5). Citeste/scrie `stock_ledger_entries`
 * (append-only) si `stock_balances` (sold materializat). Motorul de CMP este pur
 * (@gr/core-domain `posteazaStocDocument`); aici e doar I/O-ul, folosit din
 * interiorul tranzactiei comenzii de postare.
 */

import type { IntrareLedgerStoc, MiscareStoc, SoldCurent, SoldStoc } from '@gr/core-domain';
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

/**
 * Miscarile de stoc PERSISTATE (registru append-only), sub forma `MiscareStoc[]`
 * folosita de rapoartele de stoc (fise de magazie, rulaje). Sursa de adevar
 * scrisa la postare — NU recalculata din documente in client. Codul documentului
 * vine dintr-un LEFT JOIN cu `documente`. Optional scopate pe firma; ordonate
 * cronologic.
 */
export async function listeazaMiscariStocPersistate(
  exec: SqlExecutor,
  firmaId?: string | null,
): Promise<MiscareStoc[]> {
  const undeFirma = firmaId != null ? ' WHERE sle.firma_id = ?' : '';
  const params = firmaId != null ? [firmaId] : [];
  const randuri = await exec.select<{
    id: string;
    data: string;
    gestiune_id: string;
    produs_id: string;
    document_id: string;
    document_cod: string;
    tip: string;
    cantitate: number;
    valoare_bani: number;
  }>(
    `SELECT sle.id AS id, sle.data AS data, sle.gestiune_id AS gestiune_id,
            sle.produs_id AS produs_id, sle.document_id AS document_id,
            COALESCE(d.cod, '') AS document_cod, sle.tip_document AS tip,
            sle.cantitate AS cantitate, sle.valoare_bani AS valoare_bani
       FROM stock_ledger_entries sle
       LEFT JOIN documente d ON d.id = sle.document_id${undeFirma}
      ORDER BY sle.data, sle.created_at, sle.id`,
    params,
  );
  return randuri.map((r) => ({
    id: String(r.id),
    data: String(r.data),
    gestiuneId: String(r.gestiune_id),
    produsId: String(r.produs_id),
    documentId: String(r.document_id),
    documentCod: String(r.document_cod),
    tip: String(r.tip),
    cantitate: Number(r.cantitate),
    valoareBani: Number(r.valoare_bani),
  }));
}

/** Soldurile de stoc materializate ca `SoldStoc[]` (pentru balanta stocurilor). */
export async function listeazaSolduriStoc(
  exec: SqlExecutor,
  firmaId?: string | null,
): Promise<SoldStoc[]> {
  const balante = await listeazaBalanteStoc(exec, firmaId);
  return balante.map((b) => ({
    gestiuneId: b.gestiuneId,
    produsId: b.produsId,
    cantitate: b.cantitate,
    valoareBani: b.valoareBani,
    pmpBani: b.pmpBani,
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
