/**
 * Constructia SAF-T (D406) din REGISTRELE PERSISTATE (Faza 9). Partea de
 * GeneralLedgerEntries provine din `journal_lines` (jurnalul contabil real), nu
 * din liste de documente — deci SAF-T reconciliaza cu balanta de verificare.
 *
 * Validarea oficiala ANAF (schema XSD D406 + reguli de business) NU poate rula in
 * acest mediu — EXTERNAL_REVIEW_REQUIRED.
 */

import { withExecutor } from '@gr/data';
import { listeazaLiniiJurnalInterval } from '@gr/data';
import {
  type ReconciliereSaft,
  type SaftCompanie,
  agregaGeneralLedger,
  genereazaSaftXML,
  reconciliazaGeneralLedger,
} from '@gr/fiscal-ro';
import type { CommandDeps } from './types.js';

export interface OptiuniSaft {
  companie: SaftCompanie;
  /** Interval (ISO). Implicit toata perioada. */
  de?: string;
  pana?: string;
  firmaId?: string | null;
}

export interface RezultatSaft {
  xml: string;
  reconciliere: ReconciliereSaft;
}

/**
 * Genereaza SAF-T pentru o perioada din registrele persistate. Reconcilierea
 * (Σdebit == Σcredit pe GeneralLedger) e intoarsa ca dovada ca fisierul deriva
 * dintr-un jurnal echilibrat. Master data (parteneri, produse) si facturile se
 * citesc din provider.
 */
export async function genereazaSaftDinRegistre(
  deps: CommandDeps,
  optiuni: OptiuniSaft,
): Promise<RezultatSaft> {
  const repos = withExecutor(deps.exec);

  const postariJurnal = await listeazaLiniiJurnalInterval(deps.exec, {
    de: optiuni.de,
    pana: optiuni.pana,
    firmaId: optiuni.firmaId,
  });

  const parteneri = await repos.parteneri.list();
  const produse = await repos.produse.list();
  const toateDoc = await repos.documente.list();
  const inInterval = (d: string) =>
    (optiuni.de ? d >= optiuni.de : true) && (optiuni.pana ? d <= optiuni.pana : true);
  const documente = toateDoc.filter(
    (d) => inInterval(d.data) && (optiuni.firmaId == null || d.firmaId === optiuni.firmaId),
  );

  const xml = genereazaSaftXML({
    companie: optiuni.companie,
    parteneri,
    produse,
    documente,
    postariJurnal,
  });
  const reconciliere = reconciliazaGeneralLedger(agregaGeneralLedger(postariJurnal));
  return { xml, reconciliere };
}
