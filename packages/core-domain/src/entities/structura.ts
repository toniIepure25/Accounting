import { z } from 'zod';

/** Punct de lucru (locatie a firmei). */
export const PunctLucruSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(20),
  denumire: z.string().min(1).max(160),
  adresa: z.string().max(300).default(''),
  activ: z.boolean().default(true),
});
export type PunctLucru = z.infer<typeof PunctLucruSchema>;

/** Grupa de produse / marfuri (ierarhica). */
export const GrupaProdusSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(20),
  denumire: z.string().min(1).max(160),
  parinteId: z.string().uuid().nullable().default(null),
});
export type GrupaProdus = z.infer<typeof GrupaProdusSchema>;
