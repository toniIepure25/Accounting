import type { Document, DocumentLinie } from '@gr/core-domain';
import type { SqlExecutor } from '@gr/data';

/**
 * Dependintele comune ale comenzilor de aplicatie. Comenzile NU vorbesc direct
 * cu driverul: primesc un `SqlExecutor` radacina (care detine tranzactiile) si
 * isi leaga singure repository-urile de tranzactie prin `withExecutor(tx)`.
 */
export interface CommandDeps {
  /** Executorul radacina (SQLite local / PostgreSQL server). Detine tranzactiile. */
  exec: SqlExecutor;
  /** Cine executa comanda (pentru audit / campuri de aprobare). */
  actor?: string;
  /** Ceas injectabil (ISO). Implicit `new Date().toISOString()`. Determinism in teste. */
  now?: () => string;
}

/** Intrare pentru crearea/postarea unui document impreuna cu liniile lui. */
export interface DocumentPayload {
  document: Document;
  linii: readonly DocumentLinie[];
  /**
   * Categorie fiscala per linie (keyed pe `linie.id`), pentru liniile FARA
   * produs. Liniile cu produs isi iau categoria din produs. Lipsa unei categorii
   * rezolvabile la postare => eroare explicita (fara cota inventata).
   */
  categoriiFiscale?: Record<string, string>;
}

export function acum(deps: CommandDeps): string {
  return (deps.now ?? (() => new Date().toISOString()))();
}

export type { Document, DocumentLinie };
