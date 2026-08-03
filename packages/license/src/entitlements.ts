import { EDITIONS, type EditionId, type ModuleId, type PlanId } from './editions.js';
import type { LicentaPayload } from './license.js';
import { utilizatoriMaxPermisi } from './stare.js';

/** Drepturile de acces active (ce module poate folosi clientul). */
export interface Entitlements {
  editie: EditionId;
  client: string;
  module: ReadonlySet<ModuleId>;
  licentiat: boolean;
  expira: string | null;
  /** Planul comercial, `null` pentru demo si pentru licentele emise inainte de planuri. */
  plan: PlanId | null;
  /** Numar maxim de utilizatori activi; `null` = nelimitat. */
  utilizatoriMax: number | null;
  trial: boolean;
}

/** Construieste entitlements dintr-un payload de licenta valid. */
export function entitlementsDinLicenta(payload: LicentaPayload): Entitlements {
  const module = payload.module ?? EDITIONS[payload.editie].module;
  return {
    editie: payload.editie,
    client: payload.client,
    module: new Set(module),
    licentiat: true,
    expira: payload.expira,
    plan: payload.plan ?? null,
    utilizatoriMax: utilizatoriMaxPermisi(payload),
    trial: payload.trial === true,
  };
}

/** Entitlements implicite (fara licenta) — o editie data, marcata nelicentiata. */
export function entitlementsImplicite(editie: EditionId = 'mobila'): Entitlements {
  return {
    editie,
    client: 'Nelicentiat',
    module: new Set(EDITIONS[editie].module),
    licentiat: false,
    expira: null,
    plan: null,
    utilizatoriMax: null,
    trial: false,
  };
}

/** Are clientul acces la un modul? */
export function areModul(ent: Entitlements, modul: ModuleId): boolean {
  return ent.module.has(modul);
}
