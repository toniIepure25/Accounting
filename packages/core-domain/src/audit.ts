import type { AuditActiune, AuditEntry } from './entities/audit.js';

export interface FiltruAudit {
  entitate?: string;
  actiune?: AuditActiune;
  utilizator?: string;
  de?: string; // ISO
  pana?: string; // ISO
}

const DATA_SIMPLA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizeaza limita superioara a intervalului la sfarsitul zilei cand e o
 * data simpla (yyyy-mm-dd, ex. dintr-un <input type="date">), altfel timp-ul
 * (un timestamp complet) ar fi comparat ca fiind "dupa" orice ora din acea zi
 * si intrarile din ziua respectiva ar fi excluse gresit.
 */
function limitaSuperioara(pana: string): string {
  return DATA_SIMPLA.test(pana) ? `${pana}T23:59:59.999Z` : pana;
}

/** Filtreaza jurnalul de audit dupa criterii optionale, cele mai recente primele. */
export function filtreazaAudit(
  intrari: readonly AuditEntry[],
  filtru: FiltruAudit = {},
): AuditEntry[] {
  const pana = filtru.pana ? limitaSuperioara(filtru.pana) : undefined;
  return intrari
    .filter((i) => !filtru.entitate || i.entitate === filtru.entitate)
    .filter((i) => !filtru.actiune || i.actiune === filtru.actiune)
    .filter((i) => !filtru.utilizator || i.utilizator === filtru.utilizator)
    .filter((i) => !filtru.de || i.timp >= filtru.de)
    .filter((i) => !pana || i.timp <= pana)
    .sort((a, b) => b.timp.localeCompare(a.timp));
}

/** Calculeaza campurile care s-au schimbat intre doua stari ale unei entitati. */
export function difCampuri(
  inainte: Record<string, unknown> | null,
  dupa: Record<string, unknown> | null,
): string[] {
  if (!inainte || !dupa) return [];
  const chei = new Set([...Object.keys(inainte), ...Object.keys(dupa)]);
  const diferite: string[] = [];
  for (const k of chei) {
    if (JSON.stringify(inainte[k]) !== JSON.stringify(dupa[k])) diferite.push(k);
  }
  return diferite;
}

/** Construieste un rezumat scurt, lizibil, pentru campul `detalii`. */
export function rezumaModificare(campuriSchimbate: readonly string[]): string {
  if (campuriSchimbate.length === 0) return '';
  if (campuriSchimbate.length <= 4) return `Campuri: ${campuriSchimbate.join(', ')}`;
  return `Campuri: ${campuriSchimbate.slice(0, 4).join(', ')} (+${campuriSchimbate.length - 4})`;
}
