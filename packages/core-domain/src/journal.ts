/**
 * Generarea PURA a notei contabile pentru UN document postat (Faza 6). Reia
 * monografia din `contabilitate.ts` (genereazaNoteContabile), dar per-document si
 * pregatita pentru persistare in registrul-jurnal. Fiecare nota este ECHILIBRATA
 * (suma debit = suma credit) — se verifica explicit inainte de scriere.
 */

import { CONT, type Postare } from './contabilitate.js';
import type { Document } from './entities/document.js';

export interface NotaDocument {
  documentId: string;
  data: string;
  documentCod: string;
  explicatie: string;
  postari: Postare[];
}

export interface OptiuniNotaDocument {
  /** Contul de stoc (implicit 371 marfuri). */
  contStoc?: string;
  /** Costul CMP al iesirii de stoc (bani), din registrul de stoc. Implicit 0. */
  costIesireBani?: number;
  /**
   * Pentru `factura_cumparare`: documentul sursa este un NIR (receptie_furnizor)
   * deja postat? Daca da, factura e doar potrivire 3-way (NIR-ul a miscat deja
   * stocul si a generat nota de achizitie) => nicio a doua nota.
   */
  sursaEsteNirPostat?: boolean;
}

/** Aruncata daca o nota nu este echilibrata (suma debit != suma credit). */
export class NotaDezechilibrataError extends Error {
  constructor(
    public readonly documentCod: string,
    public readonly totalDebit: number,
    public readonly totalCredit: number,
  ) {
    super(
      `Nota contabila pentru documentul ${documentCod} nu este echilibrata: debit ${totalDebit} != credit ${totalCredit}.`,
    );
    this.name = 'NotaDezechilibrataError';
  }
}

const p = (cont: string, debitBani: number, creditBani: number): Postare => ({
  cont,
  debitBani,
  creditBani,
});

/** Suma debit == suma credit? */
export function notaEchilibrata(postari: readonly Postare[]): boolean {
  let d = 0;
  let c = 0;
  for (const post of postari) {
    d += post.debitBani;
    c += post.creditBani;
  }
  return d === c;
}

/** Verifica echilibrul si arunca altfel. */
export function asertaNotaEchilibrata(nota: NotaDocument): void {
  let d = 0;
  let c = 0;
  for (const post of nota.postari) {
    d += post.debitBani;
    c += post.creditBani;
  }
  if (d !== c) throw new NotaDezechilibrataError(nota.documentCod, d, c);
}

/**
 * Genereaza nota contabila a unui document postat, sau `null` daca tipul de
 * document nu produce nota financiara (transfer, plus/minus, aviz, proforma,
 * comanda, livrare) sau daca e o factura de cumparare deja acoperita de NIR.
 * Nota rezultata este garantat echilibrata.
 */
export function genereazaNotaDocument(
  doc: Document,
  optiuni: OptiuniNotaDocument = {},
): NotaDocument | null {
  const contStoc = optiuni.contStoc ?? CONT.MARFURI;
  const cost = optiuni.costIesireBani ?? 0;

  let nota: NotaDocument | null = null;
  const mk = (explicatie: string, postari: Postare[]): NotaDocument => ({
    documentId: doc.id,
    data: doc.data,
    documentCod: doc.cod,
    explicatie,
    postari,
  });

  if (
    doc.tip === 'receptie_furnizor' ||
    (doc.tip === 'factura_cumparare' && !optiuni.sursaEsteNirPostat)
  ) {
    nota = mk('Achizitie de la furnizor', [
      p(contStoc, doc.totalNetBani, 0),
      p(CONT.TVA_DEDUCTIBILA, doc.totalTvaBani, 0),
      p(CONT.FURNIZORI, 0, doc.totalBrutBani),
    ]);
  } else if (doc.tip === 'factura_vanzare' || doc.tip === 'vanzare_amanunt') {
    const postari: Postare[] = [
      p(CONT.CLIENTI, doc.totalBrutBani, 0),
      p(CONT.VENITURI_MARFA, 0, doc.totalNetBani),
      p(CONT.TVA_COLECTATA, 0, doc.totalTvaBani),
    ];
    if (cost > 0) postari.push(p(CONT.CHELT_MARFURI, cost, 0), p(contStoc, 0, cost));
    nota = mk('Vanzare', postari);
  } else if (doc.tip === 'bon_consum') {
    const c = cost || doc.totalNetBani;
    nota = mk('Consum materiale', [p(CONT.CHELT_MATERIALE, c, 0), p(contStoc, 0, c)]);
  } else if (doc.tip === 'nota_amortizare') {
    nota = mk('Amortizare mijloace fixe', [
      p(CONT.CHELT_AMORTIZARE, doc.totalNetBani, 0),
      p(CONT.AMORTIZARE_MIJLOACE_FIXE, 0, doc.totalNetBani),
    ]);
  }

  if (nota) asertaNotaEchilibrata(nota);
  return nota;
}
