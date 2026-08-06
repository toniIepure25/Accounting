/**
 * Orchestrarea emiterii evenimentelor fiscale din interiorul comenzilor (Faza 7).
 * Faptele fiscale se genereaza pur (@gr/core-domain
 * `genereazaEvenimenteFiscaleDocument`), respectand aceeasi potrivire NIR ca
 * jurnalul; aici le scriem in registrul de evenimente + le stornam — TOATE in
 * aceeasi tranzactie cu documentul, stocul si jurnalul. Declaratiile (D300/D394/
 * D390) citesc apoi FAPTE, nu re-deduc din documente.
 */

import { genereazaEvenimenteFiscaleDocument } from '@gr/core-domain';
import {
  type SqlExecutor,
  listeazaEvenimenteFiscaleDocument,
  scrieEvenimentFiscal,
  withExecutor,
} from '@gr/data';
import type { Document, DocumentLinie } from './types.js';

/** Contextul tranzactiei dedus din tara partenerului (simplificare onesta). */
async function taraSiContext(
  tx: SqlExecutor,
  partenerId: string | null,
): Promise<{ tara: string; context: string }> {
  if (!partenerId) return { tara: 'RO', context: 'intern' };
  const partener = await withExecutor(tx).parteneri.getById(partenerId);
  const tara = partener?.tara ?? 'RO';
  return { tara, context: tara === 'RO' ? 'intern' : 'intracomunitar' };
}

/**
 * Emite evenimentele fiscale ale unui document postat. `sursaEsteNirPostat` vine
 * din potrivirea 3-way (calculata o data la postare, partajata cu jurnalul), ca o
 * factura acoperita de NIR sa nu produca fapte fiscale duplicate.
 */
export async function emiteEvenimenteFiscaleDocument(
  tx: SqlExecutor,
  doc: Document,
  linii: readonly DocumentLinie[],
  sursaEsteNirPostat: boolean,
  acum: string,
): Promise<void> {
  const { tara, context } = await taraSiContext(tx, doc.partenerId);
  const evenimente = genereazaEvenimenteFiscaleDocument(doc, linii, {
    sursaEsteNirPostat,
    tara,
    context,
  });
  for (const e of evenimente) await scrieEvenimentFiscal(tx, e, doc.firmaId ?? null, acum);
}

/**
 * Storneaza fiscal un document: scrie evenimente COMPENSATORII (baza + TVA
 * negate) pe documentul de stornare, ca decontul perioadei sa reflecte anularea.
 */
export async function stornoEvenimenteFiscaleDocument(
  tx: SqlExecutor,
  documentOriginalId: string,
  stornoDocId: string,
  dataStorno: string,
  firmaId: string | null,
  acum: string,
): Promise<void> {
  const originale = await listeazaEvenimenteFiscaleDocument(tx, documentOriginalId);
  for (const e of originale) {
    await scrieEvenimentFiscal(
      tx,
      {
        ...e,
        documentId: stornoDocId,
        data: dataStorno,
        bazaBani: -e.bazaBani,
        tvaBani: -e.tvaBani,
      },
      firmaId,
      acum,
    );
  }
}
