/**
 * Motorul PUR de postare a stocului (Faza 5). Dat fiind soldul curent per
 * (gestiune, produs) si liniile unui document, produce intrarile de registru
 * (append-only) cu soldul rezultat DUPA fiecare miscare, evaluand iesirile la
 * pretul mediu ponderat (CMP) si conservand valoarea la transfer. Fara I/O:
 * stratul de aplicatie incarca soldurile persistate, ruleaza acest motor si
 * scrie intrarile + soldurile actualizate in aceeasi tranzactie cu documentul.
 *
 * Diferenta esentiala fata de vechiul `ruleazaStoc`: aici NU se face niciodata
 * clamp tacit al cantitatii/valorii la 0. O iesire care ar duce soldul sub zero
 * este tratata explicit prin `PoliticaStocNegativ` — se INTERZICE (implicit),
 * se AVERTIZEAZA sau se PERMITE, dar niciodata nu se ascunde.
 */

import { type Document, type DocumentLinie, directieStoc } from './entities/document.js';

/** Politica pentru iesirile care ar duce soldul sub zero. Niciodata clamp tacit. */
export type PoliticaStocNegativ = 'interzice' | 'avertizeaza' | 'permite';

/** Sold curent (cantitate + valoare) al unei perechi gestiune+produs. */
export interface SoldCurent {
  cantitate: number;
  valoareBani: number;
}

/** O intrare de registru rezultata din postare (mirror pe randul persistat). */
export interface IntrareLedgerStoc {
  gestiuneId: string;
  produsId: string;
  documentId: string;
  documentLinieId: string | null;
  data: string;
  tipDocument: string;
  firmaId: string | null;
  /** Miscarea cu semn: pozitiv intrare, negativ iesire. */
  cantitate: number;
  valoareBani: number;
  soldCantitateDupa: number;
  soldValoareBaniDupa: number;
  pmpBaniDupa: number;
}

export interface RezultatPostareStoc {
  entries: IntrareLedgerStoc[];
  /** Soldurile noi per cheie `gestiuneId::produsId` (pentru upsert). */
  balanteNoi: Map<string, SoldCurent>;
  avertismente: string[];
}

/** Aruncata cand o iesire ar duce soldul sub zero, sub politica `interzice`. */
export class StocInsuficientError extends Error {
  constructor(
    public readonly gestiuneId: string,
    public readonly produsId: string,
    public readonly disponibil: number,
    public readonly cerut: number,
  ) {
    super(
      `Stoc insuficient pentru produsul ${produsId} in gestiunea ${gestiuneId}: disponibil ${disponibil}, cerut ${cerut}. (Politica: interzice iesirea sub zero.)`,
    );
    this.name = 'StocInsuficientError';
  }
}

export const cheieStoc = (gestiuneId: string, produsId: string): string =>
  `${gestiuneId}::${produsId}`;

/** CMP (pret mediu ponderat) exact, in bani/unitate, sau 0 daca nu exista stoc pozitiv. */
export function pmpBani(sold: SoldCurent): number {
  return sold.cantitate > 0 ? Math.round(sold.valoareBani / sold.cantitate) : 0;
}

type DocumentStoc = Pick<
  Document,
  'id' | 'data' | 'tip' | 'gestiuneId' | 'gestiuneDestinatieId' | 'firmaId'
>;
type LinieStoc = Pick<DocumentLinie, 'id' | 'produsId' | 'cantitate' | 'netBani'>;

/**
 * Posteaza in stoc liniile unui document. Intoarce intrarile de registru cu
 * soldul rezultat dupa fiecare miscare, soldurile noi si eventualele avertismente.
 * Nu muteaza `balante`.
 */
export function posteazaStocDocument(
  doc: DocumentStoc,
  linii: readonly LinieStoc[],
  balante: ReadonlyMap<string, SoldCurent>,
  politica: PoliticaStocNegativ = 'interzice',
): RezultatPostareStoc {
  const bal = new Map<string, SoldCurent>();
  for (const [k, v] of balante) bal.set(k, { ...v });

  const entries: IntrareLedgerStoc[] = [];
  const avertismente: string[] = [];
  const dir = directieStoc(doc.tip);

  /** Aplica o singura miscare la sold; intoarce valoarea (cu semn) inregistrata. */
  const aplica = (
    gestiuneId: string,
    produsId: string,
    documentLinieId: string | null,
    cantitate: number,
    valoareData: number,
    evalueazaLaCmp: boolean,
  ): number => {
    const k = cheieStoc(gestiuneId, produsId);
    const cur = bal.get(k) ?? { cantitate: 0, valoareBani: 0 };

    let valoare = valoareData;
    if (cantitate < 0 && evalueazaLaCmp) {
      const pmpExact = cur.cantitate > 0 ? cur.valoareBani / cur.cantitate : 0;
      valoare = Math.round(cantitate * pmpExact); // cantitate negativa => valoare negativa
    }

    const cantDupa = cur.cantitate + cantitate;
    if (cantitate < 0 && cantDupa < 0) {
      // Niciodata clamp tacit — tratam explicit prin politica.
      if (politica === 'interzice') {
        throw new StocInsuficientError(gestiuneId, produsId, cur.cantitate, Math.abs(cantitate));
      }
      if (politica === 'avertizeaza') {
        avertismente.push(
          `Stoc negativ: produsul ${produsId} in gestiunea ${gestiuneId} ajunge la ${cantDupa} (disponibil ${cur.cantitate}, iesire ${Math.abs(cantitate)}).`,
        );
      }
      // 'permite': continua fara avertisment
    }

    const valDupa = cur.valoareBani + valoare;
    const soldNou: SoldCurent = { cantitate: cantDupa, valoareBani: valDupa };
    bal.set(k, soldNou);

    entries.push({
      gestiuneId,
      produsId,
      documentId: doc.id,
      documentLinieId,
      data: doc.data,
      tipDocument: doc.tip,
      firmaId: doc.firmaId ?? null,
      cantitate,
      valoareBani: valoare,
      soldCantitateDupa: cantDupa,
      soldValoareBaniDupa: valDupa,
      pmpBaniDupa: pmpBani(soldNou),
    });
    return valoare;
  };

  for (const l of linii) {
    if (!l.produsId) continue;

    // Transfer: iesire din sursa la CMP, intrare in destinatie la ACEEASI valoare
    // (conservarea valorii — nu se creeaza/pierde valoare la mutare intre gestiuni).
    if (doc.tip === 'receptie_transfer' && doc.gestiuneId && doc.gestiuneDestinatieId) {
      const valOut = aplica(doc.gestiuneId, l.produsId, l.id, -Math.abs(l.cantitate), 0, true);
      aplica(doc.gestiuneDestinatieId, l.produsId, l.id, Math.abs(l.cantitate), -valOut, false);
      continue;
    }

    // Plus/minus de inventar: semnul vine din cantitatea liniei; plusul intra la
    // valoarea neta data, minusul iese la CMP.
    if (doc.tip === 'plus_minus' && doc.gestiuneId) {
      const intrare = l.cantitate >= 0;
      aplica(doc.gestiuneId, l.produsId, l.id, l.cantitate, intrare ? l.netBani : 0, !intrare);
      continue;
    }

    if (dir === 0 || !doc.gestiuneId) continue;
    const cantitate = dir * Math.abs(l.cantitate);
    const valoare = dir > 0 ? l.netBani : 0; // intrarile la cost net; iesirile la CMP
    aplica(doc.gestiuneId, l.produsId, l.id, cantitate, valoare, dir < 0);
  }

  return { entries, balanteNoi: bal, avertismente };
}
