import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

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
  /**
   * Categoria fiscala STABILA a produsului (ex. 'standard', 'redus_9', 'scutit').
   * Sursa AUTORITARA a cotei: cota efectiva se rezolva din categorie + data
   * documentului prin motorul temporal (vezi `procentImplicitProdus`). Implicit
   * 'standard' — o categorie, NU o cota hardcodata; rezolva 21% azi, 19% istoric.
   */
  codCategorieFiscala: z.string().min(1).max(40).default('standard'),
  /**
   * @deprecated Indiciu LEGACY de cota (pastrat pentru audit/migrare). NU mai e
   * sursa autoritara pentru documente noi — nu mai are un default tacit de 19%.
   * Cota autoritara vine din `codCategorieFiscala` + data, prin motorul temporal.
   */
  cotaTvaProcent: z.number().int().min(0).max(100).nullable().default(null),
  grupaId: z.string().uuid().nullable().default(null),
  /** Pret de vanzare implicit, in bani (fara TVA). */
  pretVanzareBani: z.number().int().min(0).default(0),
  /** Stoc minim pentru alerte (in unitatea de masura). */
  stocMinim: z.number().min(0).default(0),
  /** Camp liber pentru cod de bare / SKU. */
  codBare: z.string().max(64).nullable().default(null),
  activ: z.boolean().default(true),
  ...campuriSync,
});

export type Produs = z.infer<typeof ProdusSchema>;

export const ProdusInputSchema = ProdusSchema.omit({
  id: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
});
export type ProdusInput = z.infer<typeof ProdusInputSchema>;
