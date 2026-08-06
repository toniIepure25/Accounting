/**
 * Orchestrarea postarii in stoc din interiorul comenzilor (Faza 5). Motorul de
 * CMP e pur (@gr/core-domain); aici incarcam soldurile persistate, rulam motorul
 * si scriem intrarile de registru + soldurile actualizate — TOATE in aceeasi
 * tranzactie cu documentul, deci atomic cu postarea.
 */

import {
  type DocumentLinie,
  type PoliticaStocNegativ,
  type SoldCurent,
  cheieStoc,
  pmpBani,
  posteazaStocDocument,
} from '@gr/core-domain';
import {
  type SqlExecutor,
  citesteBalantaStoc,
  listeazaLedgerDocument,
  scrieIntrareLedger,
  upsertBalantaStoc,
} from '@gr/data';
import type { Document } from './types.js';

type DocStoc = Pick<
  Document,
  'id' | 'data' | 'tip' | 'gestiuneId' | 'gestiuneDestinatieId' | 'firmaId'
>;

/**
 * Emite in registrul de stoc miscarile unui document postat. Intoarce
 * avertismentele (politica `avertizeaza`). Sub politica `interzice`, o iesire sub
 * zero arunca `StocInsuficientError` care aborteaza toata tranzactia de postare.
 */
export async function emiteStocDocument(
  tx: SqlExecutor,
  doc: DocStoc,
  linii: readonly DocumentLinie[],
  politica: PoliticaStocNegativ,
  acum: string,
): Promise<string[]> {
  // Incarca soldurile de start pentru toate perechile (gestiune, produs) atinse.
  const balante = new Map<string, SoldCurent>();
  const seed = async (gestiuneId: string | null, produsId: string) => {
    if (!gestiuneId) return;
    const k = cheieStoc(gestiuneId, produsId);
    if (balante.has(k)) return;
    const s = await citesteBalantaStoc(tx, gestiuneId, produsId);
    if (s) balante.set(k, s);
  };
  for (const l of linii) {
    if (!l.produsId) continue;
    await seed(doc.gestiuneId, l.produsId);
    await seed(doc.gestiuneDestinatieId, l.produsId);
  }

  const r = posteazaStocDocument(doc, linii, balante, politica);

  for (const e of r.entries) await scrieIntrareLedger(tx, e, acum);
  for (const [k, sold] of r.balanteNoi) {
    const [gestiuneId, produsId] = k.split('::');
    await upsertBalantaStoc(
      tx,
      {
        gestiuneId: gestiuneId!,
        produsId: produsId!,
        firmaId: doc.firmaId ?? null,
        cantitate: sold.cantitate,
        valoareBani: sold.valoareBani,
        pmpBani: pmpBani(sold),
      },
      acum,
    );
  }
  return r.avertismente;
}

/**
 * Storneaza in stoc un document: pentru fiecare intrare de registru a
 * documentului original, scrie o intrare COMPENSATORIE (negata) pe documentul de
 * stornare si actualizeaza soldul. Registrul se aduce astfel la zero pe partea
 * originalului, iar soldurile revin la valoarea de dinainte de postare.
 */
export async function stornoStocDocument(
  tx: SqlExecutor,
  documentOriginalId: string,
  stornoDocId: string,
  dataStorno: string,
  firmaId: string | null,
  acum: string,
): Promise<void> {
  const originale = await listeazaLedgerDocument(tx, documentOriginalId);
  for (const oe of originale) {
    const gestiuneId = String(oe.gestiune_id);
    const produsId = String(oe.produs_id);
    const cantitate = -Number(oe.cantitate);
    const valoare = -Number(oe.valoare_bani);

    const cur = (await citesteBalantaStoc(tx, gestiuneId, produsId)) ?? {
      cantitate: 0,
      valoareBani: 0,
    };
    const soldNou: SoldCurent = {
      cantitate: cur.cantitate + cantitate,
      valoareBani: cur.valoareBani + valoare,
    };

    await scrieIntrareLedger(
      tx,
      {
        gestiuneId,
        produsId,
        documentId: stornoDocId,
        documentLinieId: null,
        data: dataStorno,
        tipDocument: 'stornare',
        firmaId,
        cantitate,
        valoareBani: valoare,
        soldCantitateDupa: soldNou.cantitate,
        soldValoareBaniDupa: soldNou.valoareBani,
        pmpBaniDupa: pmpBani(soldNou),
      },
      acum,
    );
    await upsertBalantaStoc(
      tx,
      {
        gestiuneId,
        produsId,
        firmaId,
        cantitate: soldNou.cantitate,
        valoareBani: soldNou.valoareBani,
        pmpBani: pmpBani(soldNou),
      },
      acum,
    );
  }
}
