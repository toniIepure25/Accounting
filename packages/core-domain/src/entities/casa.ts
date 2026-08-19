import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/** Operatiune de casa (incasare / plata) pentru Registrul de casa. */
export const OperatiuneCasaSchema = z.object({
  id: z.string().uuid(),
  /** Scopare multi-firma — vezi Document.firmaId pentru semantica completa. */
  firmaId: z.string().uuid().nullable().default(null),
  data: z.string(), // ISO
  tip: z.enum(['incasare', 'plata']),
  sumaBani: z.number().int().min(0).default(0),
  partenerId: z.string().uuid().nullable().default(null),
  document: z.string().max(60).default(''),
  explicatie: z.string().max(200).default(''),
  punctDeLucruId: z.string().uuid().nullable().default(null),
  ...campuriSync,
});
export type OperatiuneCasa = z.infer<typeof OperatiuneCasaSchema>;
