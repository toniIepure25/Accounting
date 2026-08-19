import {
  type ConfiguratieMobila,
  ConfiguratieMobilaSchema,
  type DepartamentProductie,
  type OptiuneConfigurator,
  type StareProductie,
} from './entities/mobila.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';
import type { Bani } from './money.js';
import type { Piesa, RezultatNesting } from './nesting.js';

/**
 * Calculeaza pretul unei configuratii de mobila:
 *   pret = pret de baza + optiuni fixe + (suprafata_fata_mp * pret_material_pe_mp)
 * Suprafata frontala aproximata din latime x inaltime (mm -> mp).
 */
export function calculPretConfiguratie(
  pretBazaBani: number,
  cfg: ConfiguratieMobila,
  optiuni: readonly FaraCampuriSync<OptiuneConfigurator>[],
): Bani {
  const byId = new Map(optiuni.map((o) => [o.id, o]));
  let total = pretBazaBani;

  const suprafataMp = (cfg.latimeMm * cfg.inaltimeMm) / 1_000_000;

  const material = cfg.materialId ? byId.get(cfg.materialId) : undefined;
  if (material) {
    total += material.pretBani + Math.round(material.pretPeMpBani * suprafataMp);
  }
  const finisaj = cfg.finisajId ? byId.get(cfg.finisajId) : undefined;
  if (finisaj) {
    total += finisaj.pretBani + Math.round(finisaj.pretPeMpBani * suprafataMp);
  }
  for (const id of cfg.accesoriiIds) {
    const acc = byId.get(id);
    if (acc) total += acc.pretBani;
  }

  return Math.max(0, Math.round(total)) as Bani;
}

/** Restul de plata pe o comanda = total brut - avans. */
export function restDePlata(totalBrutBani: number, avansBani: number): Bani {
  return Math.max(0, totalBrutBani - avansBani) as Bani;
}

export interface PanouDebitare {
  denumire: string;
  latimeMm: number;
  inaltimeMm: number;
  bucati: number;
}

/**
 * Lista de debitare pentru un corp simplu (cutie): laterale, blat+fund, spate.
 * Din dimensiunile configuratiei si grosimea materialului. Pentru productie —
 * util fabricii de mobila pentru calculul consumului si al panourilor de taiat.
 */
export function listaDebitare(
  cfg: ConfiguratieMobila,
  grosimeMm = 18,
): { panouri: PanouDebitare[]; suprafataMp: number } {
  const { latimeMm: W, inaltimeMm: H, adancimeMm: D } = cfg;
  const panouri: PanouDebitare[] = [
    { denumire: 'Lateral', latimeMm: D, inaltimeMm: H, bucati: 2 },
    { denumire: 'Blat / Fund', latimeMm: Math.max(0, W - 2 * grosimeMm), inaltimeMm: D, bucati: 2 },
    { denumire: 'Spate', latimeMm: W, inaltimeMm: H, bucati: 1 },
  ];
  const suprafataMp = panouri.reduce(
    (a, p) => a + (p.bucati * (p.latimeMm * p.inaltimeMm)) / 1_000_000,
    0,
  );
  return { panouri, suprafataMp: Math.round(suprafataMp * 1000) / 1000 };
}

/** Transforma panourile de debitare in piese pentru motorul de nesting. */
export function panouriCaPiese(panouri: readonly PanouDebitare[]): Piesa[] {
  return panouri.map((p) => ({
    eticheta: p.denumire,
    latimeMm: p.latimeMm,
    inaltimeMm: p.inaltimeMm,
    bucati: p.bucati,
  }));
}

/**
 * Cant (edge banding): metri liniari de ABS/PVC pentru panouri. Implicit se
 * cantuiesc toate cele 4 laturi; `laturi` permite 1..4 (ex. doar fața văzută).
 */
export function calculCantMl(panouri: readonly PanouDebitare[], laturi: 1 | 2 | 3 | 4 = 4): number {
  let ml = 0;
  for (const p of panouri) {
    const laturiMm = [p.latimeMm, p.latimeMm, p.inaltimeMm, p.inaltimeMm].slice(0, laturi);
    ml += (p.bucati * laturiMm.reduce((a, b) => a + b, 0)) / 1000;
  }
  return Math.round(ml * 100) / 100;
}

/** BOM feronerie: agregă accesoriile alese (id-uri repetate = cantitate). */
export function necesarFeronerie(
  cfg: ConfiguratieMobila,
  optiuni: readonly FaraCampuriSync<OptiuneConfigurator>[],
): { denumire: string; bucati: number }[] {
  const byId = new Map(optiuni.map((o) => [o.id, o]));
  const cnt = new Map<string, number>();
  for (const id of cfg.accesoriiIds) cnt.set(id, (cnt.get(id) ?? 0) + 1);
  return [...cnt.entries()].map(([id, bucati]) => ({
    denumire: byId.get(id)?.denumire ?? id,
    bucati,
  }));
}

export interface NecesarConsum {
  produsId: string;
  cantitate: number;
}

/**
 * Consumul REAL de stoc pentru o configuratie: materialul si finisajul (daca
 * au un `produsId` legat in optiuni) consuma suprafataMp (din listaDebitare),
 * iar fiecare accesoriu ales consuma o bucata din produsul legat. Optiunile
 * fara `produsId` (pur decorative/informative) nu genereaza consum — asta e
 * baza pentru bonul de consum auto-generat la trecerea comenzii in productie.
 */
export function necesarConsumStoc(
  cfg: ConfiguratieMobila,
  optiuni: readonly FaraCampuriSync<OptiuneConfigurator>[],
  suprafataMp: number,
): NecesarConsum[] {
  const byId = new Map(optiuni.map((o) => [o.id, o]));
  const brut: NecesarConsum[] = [];

  const material = cfg.materialId ? byId.get(cfg.materialId) : undefined;
  if (material?.produsId) brut.push({ produsId: material.produsId, cantitate: suprafataMp });

  const finisaj = cfg.finisajId ? byId.get(cfg.finisajId) : undefined;
  if (finisaj?.produsId) brut.push({ produsId: finisaj.produsId, cantitate: suprafataMp });

  const accesoriiCount = new Map<string, number>();
  for (const id of cfg.accesoriiIds) accesoriiCount.set(id, (accesoriiCount.get(id) ?? 0) + 1);
  for (const [id, count] of accesoriiCount) {
    const opt = byId.get(id);
    if (opt?.produsId) brut.push({ produsId: opt.produsId, cantitate: count });
  }

  // Agrega produse duplicate (ex. materialul si finisajul legate de acelasi produs din catalog).
  const agregat = new Map<string, number>();
  for (const n of brut) agregat.set(n.produsId, (agregat.get(n.produsId) ?? 0) + n.cantitate);
  return [...agregat.entries()].map(([produsId, cantitate]) => ({
    produsId,
    cantitate: Math.round(cantitate * 1000) / 1000,
  }));
}

export interface ReguliConfigurator {
  latimeMinMm?: number;
  latimeMaxMm?: number;
  inaltimeMinMm?: number;
  inaltimeMaxMm?: number;
  adancimeMinMm?: number;
  adancimeMaxMm?: number;
  /** Perechi material×finisaj interzise. */
  combinatiiInterzise?: { materialId: string; finisajId: string }[];
}

/** Verifică o configurație față de reguli; întoarce erorile (gol = valid). */
export function verificaConfiguratie(
  cfg: ConfiguratieMobila,
  reguli: ReguliConfigurator,
): string[] {
  const e: string[] = [];
  const chk = (v: number, min: number | undefined, max: number | undefined, nume: string) => {
    if (min !== undefined && v < min) e.push(`${nume} sub minim (${min} mm)`);
    if (max !== undefined && v > max) e.push(`${nume} peste maxim (${max} mm)`);
  };
  chk(cfg.latimeMm, reguli.latimeMinMm, reguli.latimeMaxMm, 'Latimea');
  chk(cfg.inaltimeMm, reguli.inaltimeMinMm, reguli.inaltimeMaxMm, 'Inaltimea');
  chk(cfg.adancimeMm, reguli.adancimeMinMm, reguli.adancimeMaxMm, 'Adancimea');
  for (const c of reguli.combinatiiInterzise ?? []) {
    if (cfg.materialId === c.materialId && cfg.finisajId === c.finisajId) {
      e.push('Combinatie material × finisaj interzisa');
    }
  }
  return e;
}

/**
 * Masina de stari a ciclului de PRODUCTIE al unei comenzi de mobila (Faza 14):
 *   oferta → confirmata → in_productie → finalizata → livrata → facturata
 * Starea de productie e OPERATIONALA si mutabila; se tine separat de documentul
 * comanda (care, odata postat, e imutabil — vezi document-aggregate.ts). Astfel
 * progresul in fabrica avanseaza fara sa atinga documentul postat.
 */
const TRANZITII_PRODUCTIE: Record<StareProductie, readonly StareProductie[]> = {
  oferta: ['confirmata'],
  confirmata: ['in_productie'],
  in_productie: ['finalizata'],
  finalizata: ['livrata'],
  livrata: ['facturata'],
  facturata: [],
};

export function tranzitieProductiePermisa(de_la: StareProductie, la: StareProductie): boolean {
  return TRANZITII_PRODUCTIE[de_la].includes(la);
}

export class TranzitieProductieNepermisaError extends Error {
  constructor(
    public readonly de_la: StareProductie,
    public readonly la: StareProductie,
  ) {
    super(`Tranzitie de productie nepermisa: ${de_la} -> ${la}.`);
    this.name = 'TranzitieProductieNepermisaError';
  }
}

export function asertaTranzitieProductie(de_la: StareProductie, la: StareProductie): void {
  if (!tranzitieProductiePermisa(de_la, la)) throw new TranzitieProductieNepermisaError(de_la, la);
}

/** Ordinea fixa a departamentelor de productie (vezi DepartamentProductie). */
export const DEPARTAMENTE_PRODUCTIE: DepartamentProductie[] = [
  'debitare',
  'cant',
  'cnc',
  'vopsitorie',
  'montaj',
];

export const ETICHETE_DEPARTAMENT: Record<DepartamentProductie, string> = {
  debitare: 'Debitare',
  cant: 'Cant',
  cnc: 'CNC',
  vopsitorie: 'Vopsitorie',
  montaj: 'Montaj',
};

/**
 * Urmatorul departament neterminat, in ordine fixa — `null` daca toate sunt
 * finalizate. O comanda nu poate "sari" un departament: marcarea unuia ca
 * finalizat presupune ca toate cele dinaintea lui sunt deja finalizate.
 */
export function urmatorulDepartament(
  finalizate: readonly DepartamentProductie[],
): DepartamentProductie | null {
  return DEPARTAMENTE_PRODUCTIE.find((d) => !finalizate.includes(d)) ?? null;
}

/** True cand toate departamentele de productie sunt finalizate. */
export function toateDepartamenteleFinalizate(
  finalizate: readonly DepartamentProductie[],
): boolean {
  return urmatorulDepartament(finalizate) === null;
}

/**
 * Piesele de debitat pentru un LOT de comenzi (nu doar una) — eticheta fiecarei
 * piese e prefixata cu codul comenzii sursa, ca lista de croire/diagrama de
 * taiere sa ramana trasabila pana la comanda clientului chiar si atunci cand
 * mai multe comenzi sunt taiate impreuna pe aceleasi placi (asa se obtine
 * economia reala de material — optimizarea per-comanda individuala, facuta
 * doar in preview la configurare, nu o poate atinge).
 */
export function panouriPentruLot(
  comenzi: readonly { cod: string; cfg: ConfiguratieMobila }[],
  grosimeMm = 18,
): Piesa[] {
  return comenzi.flatMap(({ cod, cfg }) =>
    panouriCaPiese(listaDebitare(cfg, grosimeMm).panouri).map((p) => ({
      ...p,
      eticheta: `${cod} · ${p.eticheta}`,
    })),
  );
}

export interface RandCroire {
  placaIndex: number;
  eticheta: string;
  xMm: number;
  yMm: number;
  latimeMm: number;
  inaltimeMm: number;
  rotit: boolean;
}

/** Aplatizeaza un rezultat de nesting intr-un rand-per-piesa, gata pentru export CNC (CSV). */
export function randuriCroire(nesting: RezultatNesting): RandCroire[] {
  return nesting.placi.flatMap((pl) =>
    pl.plasari.map((p) => ({
      placaIndex: pl.index + 1,
      eticheta: p.eticheta,
      xMm: p.x,
      yMm: p.y,
      latimeMm: p.latimeMm,
      inaltimeMm: p.inaltimeMm,
      rotit: p.rotit,
    })),
  );
}

/** Configuratie "goala" (toate valorile implicite din schema) — punct de plecare pentru o comanda noua in Configurator. */
export const CONFIGURATIE_MOBILA_GOALA: ConfiguratieMobila = ConfiguratieMobilaSchema.parse({});

/**
 * Parseaza configuratia unei comenzi Mobila din `Document.meta` (JSON liber),
 * cu valorile implicite din schema Zod pentru campuri lipsa (documente mai
 * vechi, dinainte de un camp nou) sau pentru meta invalid/gol. Sursa unica
 * folosita de toate ecranele care citesc configuratia unei comenzi
 * (Configurator, Productie, Livrari, Dashboard) — evita reimplementarea
 * acelorasi valori implicite in fiecare loc.
 */
export function parseConfiguratieMobila(meta: string): ConfiguratieMobila {
  try {
    return ConfiguratieMobilaSchema.parse(JSON.parse(meta));
  } catch {
    return CONFIGURATIE_MOBILA_GOALA;
  }
}
