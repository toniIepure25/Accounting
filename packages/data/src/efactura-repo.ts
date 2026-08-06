/**
 * Persistenta submisiilor e-Factura (Faza 8). Scrie/citeste `efactura_submissions`
 * — starea SPV durabila per document. Masina de stari e pura (@gr/core-domain
 * `efactura-spv`); aici e doar I/O, folosit din interiorul tranzactiei comenzii.
 */

import type { StareEfactura } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

export interface SubmisieEfactura {
  id: string;
  firmaId: string | null;
  documentId: string;
  stare: StareEfactura;
  xml: string | null;
  uploadIndex: string | null;
  mesajStare: string | null;
  idDescarcare: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// biome-ignore lint/suspicious/noExplicitAny: rand SQL snake_case
function rand(r: any): SubmisieEfactura {
  return {
    id: r.id,
    firmaId: r.firma_id ?? null,
    documentId: r.document_id,
    stare: r.stare,
    xml: r.xml ?? null,
    uploadIndex: r.upload_index ?? null,
    mesajStare: r.mesaj_stare ?? null,
    idDescarcare: r.id_descarcare ?? null,
    idempotencyKey: r.idempotency_key ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function creeazaSubmisieEfactura(
  exec: SqlExecutor,
  s: Omit<SubmisieEfactura, 'createdAt' | 'updatedAt'>,
  acum: string,
): Promise<SubmisieEfactura> {
  await exec.execute(
    `INSERT INTO efactura_submissions
       (id, firma_id, document_id, stare, xml, upload_index, mesaj_stare, id_descarcare,
        idempotency_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      s.firmaId,
      s.documentId,
      s.stare,
      s.xml,
      s.uploadIndex,
      s.mesajStare,
      s.idDescarcare,
      s.idempotencyKey,
      acum,
      acum,
    ],
  );
  return { ...s, createdAt: acum, updatedAt: acum };
}

export async function getSubmisieDupaDocument(
  exec: SqlExecutor,
  documentId: string,
): Promise<SubmisieEfactura | null> {
  // Submisia activa (ne-respinsa/ne-eroare) sau, in lipsa, cea mai recenta.
  const r = await exec.select<Record<string, unknown>>(
    'SELECT * FROM efactura_submissions WHERE document_id = ? ORDER BY updated_at DESC',
    [documentId],
  );
  return r.length > 0 ? rand(r[0]!) : null;
}

export async function getSubmisieDupaId(
  exec: SqlExecutor,
  id: string,
): Promise<SubmisieEfactura | null> {
  const r = await exec.select<Record<string, unknown>>(
    'SELECT * FROM efactura_submissions WHERE id = ?',
    [id],
  );
  return r.length > 0 ? rand(r[0]!) : null;
}

export async function actualizeazaSubmisieEfactura(
  exec: SqlExecutor,
  id: string,
  patch: Partial<
    Pick<SubmisieEfactura, 'stare' | 'xml' | 'uploadIndex' | 'mesajStare' | 'idDescarcare'>
  >,
  acum: string,
): Promise<void> {
  const seturi: string[] = ['updated_at = ?'];
  const params: unknown[] = [acum];
  if (patch.stare !== undefined) {
    seturi.push('stare = ?');
    params.push(patch.stare);
  }
  if (patch.xml !== undefined) {
    seturi.push('xml = ?');
    params.push(patch.xml);
  }
  if (patch.uploadIndex !== undefined) {
    seturi.push('upload_index = ?');
    params.push(patch.uploadIndex);
  }
  if (patch.mesajStare !== undefined) {
    seturi.push('mesaj_stare = ?');
    params.push(patch.mesajStare);
  }
  if (patch.idDescarcare !== undefined) {
    seturi.push('id_descarcare = ?');
    params.push(patch.idDescarcare);
  }
  params.push(id);
  await exec.execute(`UPDATE efactura_submissions SET ${seturi.join(', ')} WHERE id = ?`, params);
}
