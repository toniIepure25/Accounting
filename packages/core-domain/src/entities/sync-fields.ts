import { z } from 'zod';

/**
 * Campurile de sincronizare, comune tuturor entitatilor sincronizabile
 * (offline-first, Faza 12). Coloanele exista in DB de la migratia 0001
 * (`version`, `updated_at`, `deleted_at`); acest fragment le expune si in schema
 * Zod, ca repository-ul SQL generic sa le CITEASCA (nu le mai elimina la parse) si
 * sa le STAMPILEZE la scriere:
 *   - `version`   incepe la 1 si creste cu 1 la fiecare update;
 *   - `updatedAt` ISO, setat la fiecare creare/actualizare;
 *   - `deletedAt` tombstone (null = viu) — pentru propagarea stergerilor la sync.
 *
 * Reconcilierea (`@gr/sync` `Versionat`) are nevoie exact de aceste campuri.
 * Se aplica pe entitati prin spread: `z.object({ ...camp, ...campuriSync })`.
 */
export const campuriSync = {
  version: z.number().int().min(1).default(1),
  updatedAt: z.string().default(''),
  deletedAt: z.string().nullable().default(null),
};

/** Cheile campurilor de sincronizare (pentru introspectie in repository). */
export const CHEI_SYNC = ['version', 'updatedAt', 'deletedAt'] as const;
