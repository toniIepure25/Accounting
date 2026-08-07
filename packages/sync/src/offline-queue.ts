/**
 * Coada de COMENZI offline (Faza 12). Modelul offline-first pentru datele
 * financiare nu mai e "upsert de rand" (care ar duce la last-write-wins), ci
 * REDARE DE COMENZI: cat timp e offline, clientul pune in coada comenzi
 * autoritare (postare/stornare/creare-ciorna) cu o CHEIE DE IDEMPOTENTA; la
 * reconectare, comenzile se redau catre server. O comanda deja executata (aceeasi
 * cheie) NU se re-executa — se sare peste ea. Serverul aplica aceeasi idempotenta
 * (magazia din Faza 4), deci o dubla redare nu posteaza de doua ori.
 */

export type TipComandaOffline = 'creeaza_ciorna' | 'posteaza' | 'storneaza';

export interface ComandaOffline {
  /** Cheie de idempotenta stabila — aceeasi la fiecare redare a acestei comenzi. */
  idempotencyKey: string;
  tip: TipComandaOffline;
  documentId?: string;
  /** Sarcina utila serializata a comenzii (ex. ciorna + linii). */
  payload?: unknown;
  creataLa: string; // ISO
}

/**
 * Comenzile care mai trebuie redate: cele a caror cheie NU e deja in setul celor
 * executate cu succes. Deterministic (pastreaza ordinea din coada). Astfel o
 * reconectare care reia coada nu re-executa comenzile deja confirmate.
 */
export function comenziDeReluat(
  coada: readonly ComandaOffline[],
  cheiExecutate: ReadonlySet<string>,
): ComandaOffline[] {
  const vazute = new Set<string>();
  const out: ComandaOffline[] = [];
  for (const c of coada) {
    if (cheiExecutate.has(c.idempotencyKey) || vazute.has(c.idempotencyKey)) continue;
    vazute.add(c.idempotencyKey);
    out.push(c);
  }
  return out;
}

/** Adauga o comanda in coada doar daca nu exista deja aceeasi cheie (idempotent la enqueue). */
export function puneInCoada(
  coada: readonly ComandaOffline[],
  comanda: ComandaOffline,
): ComandaOffline[] {
  if (coada.some((c) => c.idempotencyKey === comanda.idempotencyKey)) return [...coada];
  return [...coada, comanda];
}

/** Scoate din coada comenzile confirmate (cheile executate). */
export function curataCoada(
  coada: readonly ComandaOffline[],
  cheiExecutate: ReadonlySet<string>,
): ComandaOffline[] {
  return coada.filter((c) => !cheiExecutate.has(c.idempotencyKey));
}
