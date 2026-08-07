/**
 * Persistenta urmaririi de productie mobila (Faza 14). Starea operationala a unei
 * comenzi (separata de documentul comanda imutabil). Masina de stari e pura
 * (@gr/core-domain mobila.ts); aici e doar I/O.
 */

import type { StareProductie } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

export interface ProductieMobila {
  documentId: string;
  firmaId: string | null;
  stareProductie: StareProductie;
  departamenteFinalizate: string[];
  costManoperaBani: number;
  costMaterialeBani: number;
  bonConsumId: string | null;
  updatedAt: string;
}

// biome-ignore lint/suspicious/noExplicitAny: rand SQL snake_case
function rand(r: any): ProductieMobila {
  return {
    documentId: r.document_id,
    firmaId: r.firma_id ?? null,
    stareProductie: r.stare_productie,
    departamenteFinalizate: JSON.parse(r.departamente_finalizate ?? '[]'),
    costManoperaBani: Number(r.cost_manopera_bani),
    costMaterialeBani: Number(r.cost_materiale_bani),
    bonConsumId: r.bon_consum_id ?? null,
    updatedAt: r.updated_at,
  };
}

export async function getProductieMobila(
  exec: SqlExecutor,
  documentId: string,
): Promise<ProductieMobila | null> {
  const r = await exec.select<Record<string, unknown>>(
    'SELECT * FROM productie_mobila WHERE document_id = ?',
    [documentId],
  );
  return r.length > 0 ? rand(r[0]!) : null;
}

/** Upsert al randului de productie (INSERT sau UPDATE) — compatibil SQLite + PostgreSQL. */
export async function upsertProductieMobila(
  exec: SqlExecutor,
  p: Omit<ProductieMobila, 'updatedAt'>,
  updatedAt: string,
): Promise<void> {
  await exec.execute(
    `INSERT INTO productie_mobila
       (document_id, firma_id, stare_productie, departamente_finalizate,
        cost_manopera_bani, cost_materiale_bani, bon_consum_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (document_id) DO UPDATE SET
       firma_id = excluded.firma_id,
       stare_productie = excluded.stare_productie,
       departamente_finalizate = excluded.departamente_finalizate,
       cost_manopera_bani = excluded.cost_manopera_bani,
       cost_materiale_bani = excluded.cost_materiale_bani,
       bon_consum_id = excluded.bon_consum_id,
       updated_at = excluded.updated_at`,
    [
      p.documentId,
      p.firmaId,
      p.stareProductie,
      JSON.stringify(p.departamenteFinalizate),
      p.costManoperaBani,
      p.costMaterialeBani,
      p.bonConsumId,
      updatedAt,
    ],
  );
}
