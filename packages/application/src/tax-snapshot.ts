/**
 * Rezolvarea + persistarea SNAPSHOT-ului fiscal pe linia postata (P1-R5b).
 *
 * La postare, cota de TVA a fiecarei linii se rezolva AUTORITAR din regulile
 * PERSISTATE (tax_rules), pe categorie fiscala + data documentului, si se
 * ingheata pe linie: identitatea regulii (id + versiune), cota in puncte de baza,
 * referinta legala si un JSON de audit. Astfel un document postat pastreaza cota
 * de la momentul faptului generator, chiar daca regula se schimba ulterior.
 */

import { DocumentInvalidError, type DocumentLinie } from '@gr/core-domain';
import {
  type DataProvider,
  type SqlExecutor,
  createSqlTaxRuleRepository,
  rezolvaTvaPersistat,
} from '@gr/data';

export interface SnapshotLinie {
  taxRuleId: string;
  taxRuleVersion: number;
  resolvedTaxRateBp: number;
  taxCategory: string;
  taxLegalReference: string;
  /** Cota rezolvata in procente (pentru recalcul de linie). */
  procent: number;
  /** JSON de audit al rezolvarii (stocat in `tax_resolution_snapshot`). */
  snapshotJson: string;
}

/**
 * Rezolva snapshot-ul fiscal pentru o linie. Categoria fiscala vine din produs;
 * pentru liniile fara produs se accepta un `override`. Fara categorie
 * rezolvabila => `DocumentInvalidError` (niciodata o cota inventata tacit).
 * Fara regula aplicabila la data respectiva => `RegulaTvaInexistenta` (din
 * `rezolvaTvaPersistat`), care propaga si aborteaza tranzactia.
 */
export async function rezolvaSnapshotLinie(
  tx: SqlExecutor,
  repos: DataProvider,
  doc: { data: string },
  linie: DocumentLinie,
  categorieOverride: string | undefined,
  acum: string,
): Promise<SnapshotLinie> {
  let cod = categorieOverride;
  if (!cod && linie.produsId) {
    const p = await repos.produse.getById(linie.produsId);
    cod = p?.codCategorieFiscala ?? undefined;
  }
  if (!cod) {
    throw new DocumentInvalidError([
      `linia "${linie.denumire}" nu are o categorie fiscala rezolvabila (fara produs si fara override)`,
    ]);
  }

  const taxRepo = createSqlTaxRuleRepository(tx);
  const r = await rezolvaTvaPersistat(taxRepo, { data: doc.data, codCategorieFiscala: cod });

  const snapshotJson = JSON.stringify({
    resolvedAt: acum,
    codCategorieFiscala: cod,
    jurisdiction: r.persistata.jurisdiction,
    validFrom: r.persistata.validFrom,
    validTo: r.persistata.validTo,
    procent: r.procent,
    rateBasisPoints: r.persistata.rateBasisPoints,
    ruleId: r.persistata.id,
    ruleVersion: r.persistata.version,
  });

  return {
    taxRuleId: r.persistata.id,
    taxRuleVersion: r.persistata.version,
    resolvedTaxRateBp: r.persistata.rateBasisPoints,
    taxCategory: r.persistata.category,
    taxLegalReference: r.persistata.legalReference,
    procent: r.procent,
    snapshotJson,
  };
}

const COLOANE_SNAPSHOT =
  'tax_rule_id, tax_rule_version, resolved_tax_rate_bp, tax_category, tax_legal_reference, tax_resolution_snapshot';

/** Scrie coloanele de snapshot fiscal pe linia data. */
export async function persistaSnapshotLinie(
  tx: SqlExecutor,
  lineId: string,
  s: SnapshotLinie,
): Promise<void> {
  await tx.execute(
    `UPDATE documente_linii SET
       tax_rule_id = ?, tax_rule_version = ?, resolved_tax_rate_bp = ?,
       tax_category = ?, tax_legal_reference = ?, tax_resolution_snapshot = ?
     WHERE id = ?`,
    [
      s.taxRuleId,
      s.taxRuleVersion,
      s.resolvedTaxRateBp,
      s.taxCategory,
      s.taxLegalReference,
      s.snapshotJson,
      lineId,
    ],
  );
}

/** Copiaza snapshot-ul fiscal de pe o linie pe alta (ex. la stornare). */
export async function copiazaSnapshotLinie(
  tx: SqlExecutor,
  fromLineId: string,
  toLineId: string,
): Promise<void> {
  const [r] = await tx.select<Record<string, unknown>>(
    `SELECT ${COLOANE_SNAPSHOT} FROM documente_linii WHERE id = ?`,
    [fromLineId],
  );
  if (!r || r.tax_rule_id == null) return; // sursa nu are snapshot — nimic de copiat
  await tx.execute(
    `UPDATE documente_linii SET ${COLOANE_SNAPSHOT.split(', ')
      .map((c) => `${c} = ?`)
      .join(', ')} WHERE id = ?`,
    [
      r.tax_rule_id,
      r.tax_rule_version,
      r.resolved_tax_rate_bp,
      r.tax_category,
      r.tax_legal_reference,
      r.tax_resolution_snapshot,
      toLineId,
    ],
  );
}

/** Citeste snapshot-ul fiscal persistat al unei linii (pentru verificari/audit). */
export async function citesteSnapshotLinie(
  exec: SqlExecutor,
  lineId: string,
): Promise<Record<string, unknown> | null> {
  const [r] = await exec.select<Record<string, unknown>>(
    `SELECT ${COLOANE_SNAPSHOT} FROM documente_linii WHERE id = ?`,
    [lineId],
  );
  return r ?? null;
}
