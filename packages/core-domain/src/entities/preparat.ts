import { z } from 'zod';

/** Preparat de bucatarie (produs compus dintr-o reteta). */
export const PreparatSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(30),
  denumire: z.string().min(1).max(200),
  grupaId: z.string().uuid().nullable().default(null),
  unitateMasura: z.string().default('portie'),
  pretVanzareBani: z.number().int().min(0).default(0),
  /** Cota TVA — setata explicit; fara default tacit (fost 9%). Vezi motorul temporal de TVA. */
  cotaTvaProcent: z.number().int().min(0).max(100),
  activ: z.boolean().default(true),
});
export type Preparat = z.infer<typeof PreparatSchema>;

/** Componenta din reteta unui preparat (materie prima + cantitate). */
export const RetetaLinieSchema = z.object({
  id: z.string().uuid(),
  preparatId: z.string().uuid(),
  produsId: z.string().uuid(),
  cantitate: z.number().min(0).default(0),
  unitateMasura: z.string().default('kg'),
});
export type RetetaLinie = z.infer<typeof RetetaLinieSchema>;
