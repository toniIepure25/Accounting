import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/**
 * Operatiune dintr-un extras de cont bancar (importata din CSV). Reconcilierea
 * o leaga de o operatiune de casa echivalenta (incasare/plata) — vezi
 * core-domain/banca.ts reconciliazaAutomat.
 */
export const OperatiuneBancaraSchema = z.object({
  id: z.string().uuid(),
  /** Scopare multi-firma — vezi Document.firmaId pentru semantica completa. */
  firmaId: z.string().uuid().nullable().default(null),
  data: z.string(), // ISO yyyy-mm-dd
  /** Suma cu semn: pozitiv = incasare, negativ = plata (conventia extrasului). */
  sumaBani: z.number().int().default(0),
  referinta: z.string().max(300).default(''),
  partenerId: z.string().uuid().nullable().default(null),
  reconciliata: z.boolean().default(false),
  /** Operatiunea de casa cu care a fost reconciliata (daca da). */
  operatiuneCasaId: z.string().uuid().nullable().default(null),
  ...campuriSync,
});
export type OperatiuneBancara = z.infer<typeof OperatiuneBancaraSchema>;

export const OperatiuneBancaraInputSchema = OperatiuneBancaraSchema.omit({
  id: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
});
export type OperatiuneBancaraInput = z.infer<typeof OperatiuneBancaraInputSchema>;
