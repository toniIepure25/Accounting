/**
 * Garda de inchidere de perioada PER FIRMA (Faza 10). Un document cu data in
 * perioada inchisa a firmei lui nu mai poate fi postat/stornat — de la niciun
 * rol. Inlocuieste blocajul global de dinainte (o inchidere pe orice firma bloca
 * toate firmele).
 */

import { documentBlocatPentruFirma } from '@gr/core-domain';
import { withExecutor } from '@gr/data';
import type { SqlExecutor } from '@gr/data';

export class PerioadaInchisaError extends Error {
  constructor(
    public readonly documentCod: string,
    public readonly data: string,
  ) {
    super(
      `Perioada este inchisa pentru firma acestui document: ${documentCod} (data ${data}) nu mai poate fi postat/stornat. Ridica inchiderea din Setari pentru a continua.`,
    );
    this.name = 'PerioadaInchisaError';
  }
}

/**
 * Arunca `PerioadaInchisaError` daca documentul cade in perioada inchisa a firmei
 * lui. Documentele fara firma nu au inchidere specifica.
 */
export async function asertaPerioadaDeschisa(
  tx: SqlExecutor,
  doc: { cod: string; data: string; firmaId: string | null },
): Promise<void> {
  if (!doc.firmaId) return;
  const firma = await withExecutor(tx).firme.getById(doc.firmaId);
  if (documentBlocatPentruFirma(doc.data, firma)) {
    throw new PerioadaInchisaError(doc.cod, doc.data);
  }
}
