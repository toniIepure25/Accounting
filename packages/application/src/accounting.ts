/**
 * Orchestrarea postarii contabile din interiorul comenzilor (Faza 6). Nota se
 * genereaza pur (@gr/core-domain `genereazaNotaDocument`, garantat echilibrata);
 * aici o scriem in registrul-jurnal + gestionam potrivirea 3-way (NIR~factura) si
 * stornarea — TOATE in aceeasi tranzactie cu documentul + stocul.
 */

import { type NotaDocument, genereazaNotaDocument } from '@gr/core-domain';
import { type SqlExecutor, listeazaLiniiJurnalDocument, scrieNotaContabila } from '@gr/data';
import type { Document } from './types.js';

/**
 * Emite nota contabila a unui document postat in registrul-jurnal. `costIesireBani`
 * este COGS-ul din registrul de stoc (descarcarea de gestiune). Documentele fara
 * efect financiar (transfer/proforma/etc.) sau facturile de cumparare deja
 * acoperite de un NIR postat nu produc nicio nota.
 */
export async function emiteContabilitateDocument(
  tx: SqlExecutor,
  doc: Document,
  costIesireBani: number,
  acum: string,
): Promise<void> {
  // Potrivire 3-way: o factura de cumparare legata de un NIR postat nu mai
  // genereaza a doua nota de achizitie.
  let sursaEsteNirPostat = false;
  if (doc.tip === 'factura_cumparare' && doc.documentSursaId) {
    const [sursa] = await tx.select<{ tip: string; stare: string }>(
      'SELECT tip, stare FROM documente WHERE id = ?',
      [doc.documentSursaId],
    );
    sursaEsteNirPostat = sursa?.tip === 'receptie_furnizor' && sursa?.stare === 'validat';
  }

  const nota: NotaDocument | null = genereazaNotaDocument(doc, {
    costIesireBani,
    sursaEsteNirPostat,
  });
  if (!nota) return;

  await scrieNotaContabila(
    tx,
    {
      documentId: doc.id,
      firmaId: doc.firmaId ?? null,
      data: nota.data,
      documentCod: nota.documentCod,
      explicatie: nota.explicatie,
      postari: nota.postari,
    },
    acum,
  );
}

/**
 * Storneaza contabil un document: scrie o nota compensatorie cu debit/credit
 * INVERSAT fata de notele documentului original, legata de documentul de stornare.
 * Registrul-jurnal se aduce astfel la zero pe partea originalului.
 */
export async function stornoContabilitateDocument(
  tx: SqlExecutor,
  documentOriginalId: string,
  stornoDocId: string,
  stornoDocCod: string,
  dataStorno: string,
  firmaId: string | null,
  acum: string,
): Promise<void> {
  const originale = await listeazaLiniiJurnalDocument(tx, documentOriginalId);
  if (originale.length === 0) return;

  const postariInversate = originale.map((post) => ({
    cont: post.cont,
    debitBani: Number(post.creditBani),
    creditBani: Number(post.debitBani),
  }));

  await scrieNotaContabila(
    tx,
    {
      documentId: stornoDocId,
      firmaId,
      data: dataStorno,
      documentCod: stornoDocCod,
      explicatie: 'Stornare',
      postari: postariInversate,
    },
    acum,
  );
}
