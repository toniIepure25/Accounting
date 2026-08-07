/**
 * Interogare paginata (keyset) a documentelor (Faza 13, RK-13). Inlocuieste
 * tiparul `list()` + filtrare in memorie (care aduce toata tabela in aplicatie si
 * nu scaleaza) cu SQL parametrizat + paginare pe cursor, sprijinit de indexul
 * compus din migratia 0020.
 *
 * Paginare KEYSET (nu OFFSET): ordoneaza dupa (data, id) descrescator si continua
 * strict dupa ultimul rand din pagina anterioara — stabil chiar daca se insereaza
 * randuri intre timp, si O(pagina) indiferent cat de adanc pagini.
 */

import { type Document, DocumentSchema } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

export interface FiltruDocumente {
  firmaId?: string | null;
  tip?: string;
  stare?: string;
  partenerId?: string | null;
  /** data >= de (ISO). */
  de?: string;
  /** data <= pana (ISO). */
  pana?: string;
}

export interface CursorDocument {
  data: string;
  id: string;
}

export interface PaginareKeyset {
  /** Marimea paginii (impusa intre 1 si 500). */
  limita?: number;
  /** Continua strict dupa acest cursor (randul urmator, mai vechi). */
  dupa?: CursorDocument;
}

export interface PaginaDocumente {
  randuri: Document[];
  /** Cursorul de continuare, sau `null` daca nu mai exista randuri. */
  urmatorCursor: CursorDocument | null;
}

const snakeToCamel = (s: string): string => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function randToDocument(rand: Record<string, unknown>): Document {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rand)) obj[snakeToCamel(k)] = v;
  return DocumentSchema.parse(obj);
}

/**
 * O pagina de documente potrivite filtrului, ordonate (data, id) descrescator.
 * `urmatorCursor` != null cand exista o pagina urmatoare.
 */
export async function interogheazaDocumente(
  exec: SqlExecutor,
  filtru: FiltruDocumente = {},
  paginare: PaginareKeyset = {},
): Promise<PaginaDocumente> {
  const limita = Math.max(1, Math.min(500, paginare.limita ?? 50));

  const conditii: string[] = [];
  const params: unknown[] = [];
  const eq = (col: string, val: unknown) => {
    conditii.push(`${col} = ?`);
    params.push(val);
  };
  if (filtru.firmaId != null) eq('firma_id', filtru.firmaId);
  if (filtru.tip != null) eq('tip', filtru.tip);
  if (filtru.stare != null) eq('stare', filtru.stare);
  if (filtru.partenerId != null) eq('partener_id', filtru.partenerId);
  if (filtru.de != null) {
    conditii.push('data >= ?');
    params.push(filtru.de);
  }
  if (filtru.pana != null) {
    conditii.push('data <= ?');
    params.push(filtru.pana);
  }
  // Cursor keyset: strict "mai vechi" decat ultimul rand (data, id) descrescator.
  if (paginare.dupa) {
    conditii.push('(data < ? OR (data = ? AND id < ?))');
    params.push(paginare.dupa.data, paginare.dupa.data, paginare.dupa.id);
  }

  const where = conditii.length > 0 ? ` WHERE ${conditii.join(' AND ')}` : '';
  // Aduce un rand in plus ca sa stim daca mai exista o pagina.
  const randuri = await exec.select<Record<string, unknown>>(
    `SELECT * FROM documente${where} ORDER BY data DESC, id DESC LIMIT ?`,
    [...params, limita + 1],
  );

  const areUrmatoare = randuri.length > limita;
  const pagina = randuri.slice(0, limita).map(randToDocument);
  const ultim = pagina[pagina.length - 1];
  const urmatorCursor = areUrmatoare && ultim ? { data: ultim.data, id: ultim.id } : null;
  return { randuri: pagina, urmatorCursor };
}
