import { z } from 'zod';
import { campuriSync } from './sync-fields.js';

/**
 * Optiune de configurator pentru modulul Mobila: materiale (PAL/MDF), finisaje,
 * accesorii (feronerie). Pretul unei configuratii = pret de baza al produsului
 * + contributiile optiunilor alese (fixe si/sau pe metru patrat).
 */
export const OptiuneConfiguratorSchema = z.object({
  id: z.string().uuid(),
  tip: z.enum(['material', 'finisaj', 'accesoriu']),
  cod: z.string().min(1).max(30),
  denumire: z.string().min(1).max(160),
  /** Contributie fixa la pret (bani). */
  pretBani: z.number().int().min(0).default(0),
  /** Contributie pe metru patrat (bani/mp) — pentru materiale. */
  pretPeMpBani: z.number().int().min(0).default(0),
  /**
   * Produsul real din catalog (materie prima/marfa) corespunzator acestei
   * optiuni — daca e setat, la trecerea unei comenzi in productie se
   * genereaza consum real de stoc pentru acest produs (vezi
   * `necesarConsumStoc` din mobila.ts). Optional: o optiune fara produsId nu
   * genereaza consum (ex. o optiune pur decorativa/informativa).
   */
  produsId: z.string().uuid().nullable().default(null),
  activ: z.boolean().default(true),
  ...campuriSync,
});
export type OptiuneConfigurator = z.infer<typeof OptiuneConfiguratorSchema>;

export const StareProductie = z.enum([
  'oferta',
  'confirmata',
  'in_productie',
  'finalizata',
  'livrata',
  'facturata',
]);
export type StareProductie = z.infer<typeof StareProductie>;

/**
 * Departamente de productie prin care trece o comanda cat timp e "in_productie"
 * — debitare (taiere panouri) → cant (margini ABS/PVC) → CNC (frezare/gauri) →
 * vopsitorie (finisaj) → montaj (asamblare). Ordinea e fixa; o comanda nu
 * poate "sari" un departament (vezi `urmatorulDepartament`/`toateDepartamenteleFinalizate`
 * din mobila.ts).
 */
export const DepartamentProductie = z.enum(['debitare', 'cant', 'cnc', 'vopsitorie', 'montaj']);
export type DepartamentProductie = z.infer<typeof DepartamentProductie>;

/**
 * Configuratie a unei comenzi de mobila (se salveaza in `meta` pe Document).
 */
export const ConfiguratieMobilaSchema = z.object({
  latimeMm: z.number().min(0).default(0),
  inaltimeMm: z.number().min(0).default(0),
  adancimeMm: z.number().min(0).default(0),
  materialId: z.string().uuid().nullable().default(null),
  finisajId: z.string().uuid().nullable().default(null),
  accesoriiIds: z.array(z.string().uuid()).default([]),
  stareProductie: StareProductie.default('oferta'),
  /** Cost manopera estimat (bani) — parte din costul real al comenzii, alaturi de costul materialelor consumate. */
  costManoperaBani: z.number().int().min(0).default(0),
  /** Departamentele deja finalizate cat timp comanda e "in_productie" (vezi DepartamentProductie). */
  departamenteFinalizate: z.array(DepartamentProductie).default([]),
  /** Data planificata de montaj la client — separata de data de livrare (aviz). */
  dataMontaj: z.string().nullable().default(null),
  /** Curier/transportator pentru livrare (ex. "Fan Courier", "Transport propriu"). */
  curier: z.string().max(120).default(''),
  /** Numar AWB (aviz de expediere al curierului), daca livrarea se face prin curier. */
  awb: z.string().max(60).default(''),
});
export type ConfiguratieMobila = z.infer<typeof ConfiguratieMobilaSchema>;

/**
 * Profil de reguli pentru configurator (dimensiuni min/max) — se astepta o
 * SINGURA inregistrare activa (UI-ul editeaza randul existent in loc sa
 * permita mai multe profile, ca sa nu existe ambiguitate care se aplica).
 * Combinatiile interzise sunt intr-o tabela separata (`CombinatieInterzisaSchema`),
 * fiindca sunt o lista, nu un profil unic.
 */
export const ProfilConfiguratorSchema = z.object({
  id: z.string().uuid(),
  latimeMinMm: z.number().int().min(0).nullable().default(null),
  latimeMaxMm: z.number().int().min(0).nullable().default(null),
  inaltimeMinMm: z.number().int().min(0).nullable().default(null),
  inaltimeMaxMm: z.number().int().min(0).nullable().default(null),
  adancimeMinMm: z.number().int().min(0).nullable().default(null),
  adancimeMaxMm: z.number().int().min(0).nullable().default(null),
  ...campuriSync,
});
export type ProfilConfigurator = z.infer<typeof ProfilConfiguratorSchema>;

/** O combinatie material×finisaj interzisa (ex. un anumit PAL nu se lacuieste). */
export const CombinatieInterzisaSchema = z.object({
  id: z.string().uuid(),
  materialId: z.string().uuid(),
  finisajId: z.string().uuid(),
  ...campuriSync,
});
export type CombinatieInterzisa = z.infer<typeof CombinatieInterzisaSchema>;
