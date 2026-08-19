import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/** Cont din planul de conturi romanesc. */
export const PlanContSchema = z.object({
  id: z.string().uuid(),
  simbol: z.string().min(1).max(20),
  denumire: z.string().min(1).max(160),
  clasa: z.number().int().min(1).max(9),
  tip: z.enum(['sintetic', 'analitic']).default('sintetic'),
  ...campuriSync,
});
export type PlanCont = z.infer<typeof PlanContSchema>;

/** Angajat (Personal). */
export const PersonalSchema = z.object({
  id: z.string().uuid(),
  marca: z.string().max(20).default(''),
  nume: z.string().min(1).max(160),
  functie: z.string().max(120).default(''),
  cnp: z.string().max(13).nullable().default(null),
  gestionar: z.boolean().default(false),
  activ: z.boolean().default(true),
  ...campuriSync,
});
export type Personal = z.infer<typeof PersonalSchema>;

/** Element din lista de preturi. */
export const ListaPretSchema = z.object({
  id: z.string().uuid(),
  lista: z.string().min(1).max(60).default('standard'),
  produsId: z.string().uuid(),
  pretBani: z.number().int().min(0).default(0),
  valabilDe: z.string().nullable().default(null),
  ...campuriSync,
});
export type ListaPret = z.infer<typeof ListaPretSchema>;

/** Tip de consum (nomenclator pentru bonuri de consum). */
export const TipConsumSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(20),
  denumire: z.string().min(1).max(120),
  cont: z.string().max(20).default(''),
  ...campuriSync,
});
export type TipConsum = z.infer<typeof TipConsumSchema>;

/** Obiect de inventar. */
export const ObiectInventarSchema = z.object({
  id: z.string().uuid(),
  cod: z.string().min(1).max(30),
  denumire: z.string().min(1).max(200),
  cantitate: z.number().min(0).default(1),
  valoareBani: z.number().int().min(0).default(0),
  gestiuneId: z.string().uuid().nullable().default(null),
  dataIntrare: z.string().nullable().default(null),
  activ: z.boolean().default(true),
  ...campuriSync,
});
export type ObiectInventar = z.infer<typeof ObiectInventarSchema>;
