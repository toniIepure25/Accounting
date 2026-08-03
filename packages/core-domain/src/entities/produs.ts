import { z } from 'zod';
import { COTE_TVA_RO } from '../tva.js';

/** Tipul articolului din nomenclator. */
export const TipProdus = z.enum([
  'marfa',
  'material',
  'produs_finit',
  'serviciu',
  'obiect_inventar',
]);
export type TipProdus = z.infer<typeof TipProdus>;

export const ProdusSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(30),
  denumire: z.string().min(1).max(200),
  tip: TipProdus.default('marfa'),
  unitateMasura: z.string().min(1).max(12).default('buc'),
  cotaTvaProcent: z.number().int().min(0).max(100).default(COTE_TVA_RO.STANDARD),
  grupaId: z.string().uuid().nullable().default(null),
  /** Pret de vanzare implicit, in bani (fara TVA). */
  pretVanzareBani: z.number().int().min(0).default(0),
  /** Stoc minim pentru alerte (in unitatea de masura). */
  stocMinim: z.number().min(0).default(0),
  /** Camp liber pentru cod de bare / SKU. */
  codBare: z.string().max(64).nullable().default(null),
  activ: z.boolean().default(true),
});

export type Produs = z.infer<typeof ProdusSchema>;

export const ProdusInputSchema = ProdusSchema.omit({ id: true });
export type ProdusInput = z.infer<typeof ProdusInputSchema>;
