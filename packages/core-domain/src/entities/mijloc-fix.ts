import { z } from 'zod';

/**
 * Mijloc fix (activ imobilizat corporal): utilaje, mobilier, echipamente,
 * cladiri etc. Amortizarea lunara se genereaza automat ca nota contabila
 * (681/281) — vezi core-domain/mijloace-fixe.ts si pagina Mijloace fixe.
 */
export const MetodaAmortizare = z.enum(['liniara', 'degresiva']);
export type MetodaAmortizare = z.infer<typeof MetodaAmortizare>;

export const MijlocFixSchema = z.object({
  id: z.string().uuid(),
  /** Scopare multi-firma — vezi Document.firmaId pentru semantica completa. */
  firmaId: z.string().uuid().nullable().default(null),
  cod: z.string().min(1).max(30),
  denumire: z.string().min(1).max(200),
  categorie: z.string().max(120).default(''),
  /** Valoarea de intrare (cost de achizitie), in bani. */
  valoareIntrareBani: z.number().int().min(0).default(0),
  dataPunereFunctiune: z.string(), // ISO yyyy-mm-dd
  /** Durata normala de functionare, in luni (ex. 60 = 5 ani). */
  durataNormalaLuni: z.number().int().min(1).default(60),
  metodaAmortizare: MetodaAmortizare.default('liniara'),
  /**
   * Coeficient de amortizare degresiva (ex. 1.5/2.0/2.5 dupa durata normala,
   * conform Codului Fiscal) — introdus explicit, nu dedus automat, ca sa nu
   * presupunem un prag de durata fara sa fie verificat de contabil.
   */
  coeficientDegresiv: z.number().min(1).default(1),
  /** Amortizarea cumulata pana acum, in bani (actualizata la fiecare rulare). */
  amortizareCumulataBani: z.number().int().min(0).default(0),
  gestiuneId: z.string().uuid().nullable().default(null),
  activ: z.boolean().default(true),
  casat: z.boolean().default(false),
  dataCasare: z.string().nullable().default(null),
});
export type MijlocFix = z.infer<typeof MijlocFixSchema>;

export const MijlocFixInputSchema = MijlocFixSchema.omit({ id: true });
export type MijlocFixInput = z.infer<typeof MijlocFixInputSchema>;
