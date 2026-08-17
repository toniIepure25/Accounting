import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/** Partener comercial: furnizor, client sau ambele. */
export const TipPartener = z.enum(['furnizor', 'client', 'ambele']);
export type TipPartener = z.infer<typeof TipPartener>;

/**
 * Validare de baza CUI RO. Acceptam optional prefixul "RO".
 * Validarea completa (cifra de control) se face in pachetul fiscal-ro.
 */
const cuiRegex = /^(RO)?\d{2,10}$/i;

export const PartenerSchema = z.object({
  id: z.string().uuid(),
  tip: TipPartener,
  denumire: z.string().min(1).max(200),
  cui: z.string().regex(cuiRegex, 'CUI invalid (ex. RO12345678)').nullable().default(null),
  /**
   * CNP — pentru clienti persoane fizice fara CUI (e-Factura B2C, obligatorie
   * pentru facturi >= 10.000 lei catre persoane fizice din 2025, extinsa la
   * PFA/CNP din 2026 — vezi @gr/fiscal-ro efactura.ts). Optional, informativ;
   * XML-ul e-Factura nu necesita CUI pentru un cumparator fara cod fiscal.
   */
  cnp: z
    .string()
    .regex(/^\d{13}$/, 'CNP invalid (13 cifre)')
    .nullable()
    .default(null),
  registruComert: z.string().max(30).nullable().default(null),
  adresa: z.string().max(300).default(''),
  judet: z.string().max(60).default(''),
  localitate: z.string().max(120).default(''),
  /** Cod de tara ISO-3166 alpha-2 (ex. RO, DE, FR) — implicit RO. Folosit pentru D390 (VIES). */
  tara: z.string().length(2).default('RO'),
  /**
   * Codul de TVA intracomunitar (format VIES, ex. DE123456789) — relevant doar
   * pentru parteneri din alte state UE (tara != RO), pentru declaratia D390.
   */
  codTvaIntracomunitar: z.string().max(20).nullable().default(null),
  iban: z.string().max(34).nullable().default(null),
  banca: z.string().max(120).default(''),
  telefon: z.string().max(40).default(''),
  email: z.string().email().nullable().default(null),
  platitorTva: z.boolean().default(true),
  activ: z.boolean().default(true),
  ...campuriSync,
});

export type Partener = z.infer<typeof PartenerSchema>;

/** Input de creare: fara id si fara campurile de sync (le stampileaza repository-ul). */
export const PartenerInputSchema = PartenerSchema.omit({
  id: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
});
export type PartenerInput = z.infer<typeof PartenerInputSchema>;
