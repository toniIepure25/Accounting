import type { Repository } from './repository.js';

/** Orice entitate care poarta o firma (scopare multi-firma). */
export interface ConFirma {
  firmaId: string | null;
}

/**
 * Randurile vizibile pentru o firma data. Cele NESCOPATE (`firmaId === null`
 * — date existente dinainte de scopare) raman vizibile pentru toate firmele,
 * ca activarea scoparii sa nu le faca sa "dispara" retroactiv; doar randurile
 * NOI, stampilate explicit cu o alta firma, devin invizibile.
 *
 * Cand `firmaId` (firma curenta a sesiunii) e `null` (ex. un cont fara firma
 * asignata), nu se filtreaza nimic — un asemenea cont vede tot.
 */
export function randuriVizibilePentruFirma<T extends ConFirma>(
  randuri: readonly T[],
  firmaId: string | null,
): T[] {
  if (!firmaId) return [...randuri];
  return randuri.filter((r) => r.firmaId == null || r.firmaId === firmaId);
}

/**
 * Decoreaza un repository cu scopare pe firma: `list()` filtreaza prin
 * `randuriVizibilePentruFirma`, `create()` stampileaza firma curenta (ignora
 * orice `firmaId` trimis de apelant). Folosit client-side (data-context.tsx)
 * pentru modurile local/memory; pentru retea/cloud, aceeasi functie de
 * filtrare e reaplicata AUTORITATIV pe server (server/src/index.ts), fiindca
 * un client nu poate fi de incredere sa impuna singur scoparea.
 */
export function withFirmaScope<T extends { id: string } & ConFirma>(
  repo: Repository<T, Partial<T>>,
  firmaIdCurent: () => string | null,
): Repository<T, Partial<T>> {
  return {
    ...repo,
    async list() {
      return randuriVizibilePentruFirma(await repo.list(), firmaIdCurent());
    },
    async create(input) {
      const fid = firmaIdCurent();
      return repo.create(fid ? { ...input, firmaId: fid } : input);
    },
  };
}
