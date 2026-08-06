/**
 * Persistenta registrului de evenimente fiscale (Faza 7). Scrie `fiscal_events`
 * (append-only) si citeste pentru declaratii (decont/D300, D394, D390). Generarea
 * evenimentelor e pura (@gr/core-domain `genereazaEvenimenteFiscaleDocument`);
 * aici e doar I/O, folosit din interiorul tranzactiei de postare.
 */

import type { EvenimentFiscal } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

/** Scrie un eveniment fiscal in registru. */
export async function scrieEvenimentFiscal(
  exec: SqlExecutor,
  e: EvenimentFiscal,
  firmaId: string | null,
  createdAt: string,
): Promise<void> {
  await exec.execute(
    `INSERT INTO fiscal_events
       (id, firma_id, document_id, data, directie, categorie_fiscala, cota_procent,
        baza_bani, tva_bani, partener_id, tara, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      firmaId,
      e.documentId,
      e.data,
      e.directie,
      e.categorieFiscala,
      e.cotaProcent,
      e.bazaBani,
      e.tvaBani,
      e.partenerId,
      e.tara,
      e.context,
      createdAt,
    ],
  );
}

// biome-ignore lint/suspicious/noExplicitAny: rand SQL snake_case
function rand(r: any): EvenimentFiscal {
  return {
    documentId: r.document_id,
    data: r.data,
    directie: r.directie,
    cotaProcent: Number(r.cota_procent),
    categorieFiscala: r.categorie_fiscala ?? null,
    bazaBani: Number(r.baza_bani),
    tvaBani: Number(r.tva_bani),
    partenerId: r.partener_id ?? null,
    tara: r.tara,
    context: r.context,
  };
}

export interface IntervalFiscal {
  de?: string;
  pana?: string;
  firmaId?: string | null;
}

/** Evenimentele fiscale dintr-un interval (pentru declaratii). */
export async function listeazaEvenimenteFiscale(
  exec: SqlExecutor,
  interval: IntervalFiscal = {},
): Promise<EvenimentFiscal[]> {
  const conditii: string[] = [];
  const params: unknown[] = [];
  if (interval.de) {
    conditii.push('data >= ?');
    params.push(interval.de);
  }
  if (interval.pana) {
    conditii.push('data <= ?');
    params.push(interval.pana);
  }
  if (interval.firmaId != null) {
    conditii.push('firma_id = ?');
    params.push(interval.firmaId);
  }
  const where = conditii.length > 0 ? ` WHERE ${conditii.join(' AND ')}` : '';
  const randuri = await exec.select<Record<string, unknown>>(
    `SELECT * FROM fiscal_events${where} ORDER BY data, created_at`,
    params,
  );
  return randuri.map(rand);
}

/** Evenimentele fiscale ale unui document (pentru stornare/audit). */
export async function listeazaEvenimenteFiscaleDocument(
  exec: SqlExecutor,
  documentId: string,
): Promise<EvenimentFiscal[]> {
  const randuri = await exec.select<Record<string, unknown>>(
    'SELECT * FROM fiscal_events WHERE document_id = ? ORDER BY created_at',
    [documentId],
  );
  return randuri.map(rand);
}
