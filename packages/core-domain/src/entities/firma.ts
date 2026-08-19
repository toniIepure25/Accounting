import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/**
 * Firma (persoana juridica). O singura instalare poate gestiona mai multe
 * firme (ex. un contabil care tine mai multe societati client, sau un holding
 * cu mai multe SRL-uri) — de aici "multi-firma". Scoparea completa a datelor
 * pe firma (fiecare document/operatiune legat de o firma anume) se aplica la
 * nivel de server intr-o etapa ulterioara; aici e fundatia: nomenclatorul de
 * firme + firma activa selectata pentru sesiunea curenta.
 */
export const FirmaSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(20),
  denumire: z.string().min(1).max(200),
  cui: z.string().max(20).default(''),
  registruComert: z.string().max(30).default(''),
  adresa: z.string().max(300).default(''),
  judet: z.string().max(60).default(''),
  localitate: z.string().max(120).default(''),
  iban: z.string().max(34).default(''),
  banca: z.string().max(120).default(''),
  /**
   * Inchidere de perioada (yyyy-mm-dd): documentele cu data <= aceasta valoare
   * nu mai pot fi validate/editate/sterse de NICIUN rol (nici admin) — practica
   * standard in contabilitate, ca sa previna modificari accidentale dupa ce o
   * luna/an a fost inchisa. Se schimba explicit din Setari, nu se ocoleste din
   * ecranul de documente. `null` = nicio perioada inchisa.
   */
  perioadaBlocataPanaLa: z.string().nullable().default(null),
  activa: z.boolean().default(true),
  /**
   * White-label: logo ca data URL (PNG/JPG/SVG mic, incarcat direct din
   * Setari, fara upload pe server — instalarea ramane offline-first). Aplicat
   * runtime in Sidebar + pe documentele client-facing (factura, deviz).
   */
  logoDataUrl: z.string().nullable().default(null),
  /** Culoare primara (hex, ex. "#2563eb") aplicata runtime peste tokenul --primary din tema. `null` = culoarea implicita a aplicatiei. */
  culoarePrimara: z.string().nullable().default(null),
  /** Nume afisat in Sidebar/titlul paginii in locul denumirii generice a aplicatiei — pentru instalari vandute sub brand propriu. `null` = denumirea generica. */
  numeAplicatie: z.string().max(80).nullable().default(null),
  ...campuriSync,
});

export type Firma = z.infer<typeof FirmaSchema>;

export const FirmaInputSchema = FirmaSchema.omit({
  id: true,
  version: true,
  updatedAt: true,
  deletedAt: true,
});
export type FirmaInput = z.infer<typeof FirmaInputSchema>;
