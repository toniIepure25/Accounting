/**
 * Declaratiile informative D394 (livrari/achizitii pe teritoriul national) si
 * D390 (VIES, operatiuni intracomunitare) — DECLARATII DE LUCRU, calculate
 * AUTORITAR PE SERVER, scopate pe firma sesiunii. Grupatorii puri, deja testati
 * (@gr/fiscal-ro), ruleaza aici peste documentele VALIDATE ale firmei +
 * partenerii ei; clientul nu mai agrega tabelul de documente si nu mai poate
 * amesteca date intre firme. (Rescrierea nativa pe evenimente fiscale — ca
 * D300 — ramane un pas ulterior; vezi antetul din `fiscal.ts`.)
 */

import { withExecutor } from '@gr/data';
import {
  type RandD390,
  type RandD394,
  sumarD390,
  sumarD394Achizitii,
  sumarD394Livrari,
} from '@gr/fiscal-ro';
import type { CommandDeps } from './types.js';

export interface OptiuniDeclaratie {
  de?: string;
  pana?: string;
  firmaId?: string | null;
}

export interface RaportD394 {
  livrari: RandD394[];
  achizitii: RandD394[];
}

export interface RaportD390 {
  randuri: RandD390[];
}

/** Documentele firmei + partenerii ei, incarcati o data pentru grupatori. */
async function incarcaFirma(deps: CommandDeps, optiuni: OptiuniDeclaratie) {
  const repos = withExecutor(deps.exec);
  const toate = await repos.documente.list();
  const documente = toate.filter((d) => optiuni.firmaId == null || d.firmaId === optiuni.firmaId);
  const parteneri = await repos.parteneri.list();
  return { documente, parteneri };
}

/** D394 pe o perioada, scopat pe firma — livrari + achizitii grupate pe partener. */
export async function genereazaD394(
  deps: CommandDeps,
  optiuni: OptiuniDeclaratie = {},
): Promise<RaportD394> {
  const { documente, parteneri } = await incarcaFirma(deps, optiuni);
  const interval = { de: optiuni.de, pana: optiuni.pana };
  return {
    livrari: sumarD394Livrari(documente, parteneri, interval),
    achizitii: sumarD394Achizitii(documente, parteneri, interval),
  };
}

/** D390 (VIES) pe o perioada, scopat pe firma — operatiuni intracomunitare. */
export async function genereazaD390(
  deps: CommandDeps,
  optiuni: OptiuniDeclaratie = {},
): Promise<RaportD390> {
  const { documente, parteneri } = await incarcaFirma(deps, optiuni);
  return { randuri: sumarD390(documente, parteneri, { de: optiuni.de, pana: optiuni.pana }) };
}
