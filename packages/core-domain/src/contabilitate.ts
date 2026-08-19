/**
 * Contabilitate in partida dubla. Genereaza note contabile din documente
 * (monografie contabila romaneasca simplificata) si rapoarte derivate:
 * registru-jurnal, balanta de verificare, fisa de cont.
 */
import type { OperatiuneCasa } from './entities/casa.js';
import type { Document } from './entities/document.js';
import type { MijlocFix } from './entities/mijloc-fix.js';
import type { FaraCampuriSync } from './entities/sync-fields.js';
import { calculAmortizareLunara } from './mijloace-fixe.js';

export interface Postare {
  cont: string;
  debitBani: number;
  creditBani: number;
}

export interface NotaContabila {
  data: string;
  documentCod: string;
  explicatie: string;
  postari: Postare[];
}

/** Conturi uzuale (plan de conturi romanesc). */
export const CONT = {
  MATERII_PRIME: '301',
  PRODUSE_FINITE: '345',
  MARFURI: '371',
  FURNIZORI: '401',
  CLIENTI: '4111',
  TVA_DEDUCTIBILA: '4426',
  TVA_COLECTATA: '4427',
  CASA: '5311',
  CHELT_MATERIALE: '601',
  CHELT_MARFURI: '607',
  VENITURI_MARFA: '707',
  CHELT_AMORTIZARE: '681',
  AMORTIZARE_MIJLOACE_FIXE: '281',
} as const;

const NUME_CONT: Record<string, string> = {
  '301': 'Materii prime',
  '345': 'Produse finite',
  '371': 'Marfuri',
  '401': 'Furnizori',
  '4111': 'Clienti',
  '4426': 'TVA deductibila',
  '4427': 'TVA colectata',
  '5311': 'Casa in lei',
  '601': 'Cheltuieli cu materialele',
  '607': 'Cheltuieli privind marfurile',
  '707': 'Venituri din vanzarea marfurilor',
  '681': 'Cheltuieli de exploatare privind amortizarea',
  '281': 'Amortizari privind imobilizarile corporale',
};

export const numeCont = (simbol: string): string => NUME_CONT[simbol] ?? simbol;

export interface OptiuniMonografie {
  /** Contul de stoc pentru un document (implicit 371). Ex.: din gestiune.contSintetic. */
  contStoc?: (doc: Document) => string;
  /**
   * Costul (CMP) al iesirii de stoc pentru descarcarea de gestiune (bani), per
   * documentId — folosit atat la vanzare (607/707) cat si la consum de
   * materiale (601), ca nota contabila si fisa de magazie sa foloseasca
   * ACELASI cost, nu pretul de pe linia documentului (care poate fi pretul de
   * vanzare, diferit de costul de intrare).
   */
  costIesireBani?: (documentId: string) => number;
}

const p = (cont: string, debitBani: number, creditBani: number): Postare => ({
  cont,
  debitBani,
  creditBani,
});

/** Genereaza notele contabile pentru documentele validate + operatiunile de casa. */
export function genereazaNoteContabile(
  documente: readonly Document[],
  operatiuniCasa: readonly FaraCampuriSync<OperatiuneCasa>[],
  optiuni: OptiuniMonografie = {},
): NotaContabila[] {
  const contStoc = optiuni.contStoc ?? (() => CONT.MARFURI);
  const cost = optiuni.costIesireBani ?? (() => 0);
  const note: NotaContabila[] = [];

  /**
   * O factura de cumparare legata de un NIR deja validat (documentSursaId)
   * e tratata ca document de POTRIVIRE (3-way match: comanda~NIR~factura), nu
   * ca o a doua achizitie — NIR-ul e singurul care miscat stocul si a generat
   * deja nota de achizitie. O factura de cumparare fara NIR asociat (ex.
   * servicii) continua sa genereze nota normal.
   */
  const legataDeNirValidat = (d: Document): boolean =>
    d.documentSursaId != null &&
    documente.some(
      (s) => s.id === d.documentSursaId && s.tip === 'receptie_furnizor' && s.stare === 'validat',
    );

  for (const d of documente) {
    if (d.stare !== 'validat') continue;

    if (
      d.tip === 'receptie_furnizor' ||
      (d.tip === 'factura_cumparare' && !legataDeNirValidat(d))
    ) {
      note.push({
        data: d.data,
        documentCod: d.cod,
        explicatie: 'Achizitie de la furnizor',
        postari: [
          p(contStoc(d), d.totalNetBani, 0),
          p(CONT.TVA_DEDUCTIBILA, d.totalTvaBani, 0),
          p(CONT.FURNIZORI, 0, d.totalBrutBani),
        ],
      });
    } else if (d.tip === 'factura_vanzare' || d.tip === 'vanzare_amanunt') {
      const postari: Postare[] = [
        p(CONT.CLIENTI, d.totalBrutBani, 0),
        p(CONT.VENITURI_MARFA, 0, d.totalNetBani),
        p(CONT.TVA_COLECTATA, 0, d.totalTvaBani),
      ];
      const c = cost(d.id);
      if (c > 0) {
        // descarcarea de gestiune (costul marfii vandute)
        postari.push(p(CONT.CHELT_MARFURI, c, 0), p(contStoc(d), 0, c));
      }
      note.push({ data: d.data, documentCod: d.cod, explicatie: 'Vanzare', postari });
    } else if (d.tip === 'bon_consum') {
      // Costul consumului = costul CMP al iesirii de stoc, NU pretul de pe
      // linia documentului (care poate fi implicit pretul de vanzare) — altfel
      // contul 601 si fisa de magazie ajung sa difere de balanta stocurilor.
      const c = cost(d.id) || d.totalNetBani;
      note.push({
        data: d.data,
        documentCod: d.cod,
        explicatie: 'Consum materiale',
        postari: [p(CONT.CHELT_MATERIALE, c, 0), p(contStoc(d), 0, c)],
      });
    } else if (d.tip === 'nota_amortizare') {
      // Generata din registrul de mijloace fixe (vezi genereazaNoteAmortizare
      // + pagina Mijloace fixe) — totalNetBani e deja suma amortizarii lunii.
      note.push({
        data: d.data,
        documentCod: d.cod,
        explicatie: 'Amortizare mijloace fixe',
        postari: [
          p(CONT.CHELT_AMORTIZARE, d.totalNetBani, 0),
          p(CONT.AMORTIZARE_MIJLOACE_FIXE, 0, d.totalNetBani),
        ],
      });
    }
    // transfer / plus-minus / aviz / proforma / comanda_mobila / livrare: fara nota financiara
  }

  for (const op of operatiuniCasa) {
    if (op.tip === 'incasare') {
      note.push({
        data: op.data,
        documentCod: op.document || 'Casa',
        explicatie: op.explicatie || 'Incasare',
        postari: [p(CONT.CASA, op.sumaBani, 0), p(CONT.CLIENTI, 0, op.sumaBani)],
      });
    } else {
      note.push({
        data: op.data,
        documentCod: op.document || 'Casa',
        explicatie: op.explicatie || 'Plata',
        postari: [p(CONT.FURNIZORI, op.sumaBani, 0), p(CONT.CASA, 0, op.sumaBani)],
      });
    }
  }

  return note.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Genereaza notele contabile de amortizare lunara (681=D / 281=C) pentru
 * mijloacele fixe active la data data. Functie PURA — actualizarea efectiva a
 * `amortizareCumulataBani` pe fiecare mijloc fix (persistarea) e responsabilitatea
 * apelantului (vezi pagina Mijloace fixe: "Ruleaza amortizare"), ca sa nu ruleze
 * de doua ori accidental aceeasi luna.
 */
export function genereazaNoteAmortizare(
  mijloaceFixe: readonly FaraCampuriSync<MijlocFix>[],
  data: string,
): NotaContabila[] {
  const note: NotaContabila[] = [];
  for (const mf of mijloaceFixe) {
    if (!mf.activ || mf.casat) continue;
    const cota = calculAmortizareLunara(mf);
    if (cota <= 0) continue;
    note.push({
      data,
      documentCod: mf.cod,
      explicatie: `Amortizare ${mf.denumire}`,
      postari: [p(CONT.CHELT_AMORTIZARE, cota, 0), p(CONT.AMORTIZARE_MIJLOACE_FIXE, 0, cota)],
    });
  }
  return note;
}

export interface RandBalanta {
  cont: string;
  nume: string;
  totalDebitBani: number;
  totalCreditBani: number;
  soldDebitorBani: number;
  soldCreditorBani: number;
}

/** Balanta de verificare: rulaje si solduri pe conturi. */
export function balantaVerificare(note: readonly NotaContabila[]): RandBalanta[] {
  const map = new Map<string, RandBalanta>();
  for (const n of note) {
    for (const post of n.postari) {
      const r =
        map.get(post.cont) ??
        map
          .set(post.cont, {
            cont: post.cont,
            nume: numeCont(post.cont),
            totalDebitBani: 0,
            totalCreditBani: 0,
            soldDebitorBani: 0,
            soldCreditorBani: 0,
          })
          .get(post.cont)!;
      r.totalDebitBani += post.debitBani;
      r.totalCreditBani += post.creditBani;
    }
  }
  for (const r of map.values()) {
    const sold = r.totalDebitBani - r.totalCreditBani;
    r.soldDebitorBani = sold > 0 ? sold : 0;
    r.soldCreditorBani = sold < 0 ? -sold : 0;
  }
  return [...map.values()].sort((a, b) => a.cont.localeCompare(b.cont));
}

/** Fisa unui cont: postarile care il ating, cu sold rulant. */
export function fisaCont(
  note: readonly NotaContabila[],
  cont: string,
): {
  data: string;
  documentCod: string;
  explicatie: string;
  debitBani: number;
  creditBani: number;
  soldBani: number;
}[] {
  let sold = 0;
  const out: {
    data: string;
    documentCod: string;
    explicatie: string;
    debitBani: number;
    creditBani: number;
    soldBani: number;
  }[] = [];
  for (const n of note) {
    for (const post of n.postari) {
      if (post.cont !== cont) continue;
      sold += post.debitBani - post.creditBani;
      out.push({
        data: n.data,
        documentCod: n.documentCod,
        explicatie: n.explicatie,
        debitBani: post.debitBani,
        creditBani: post.creditBani,
        soldBani: sold,
      });
    }
  }
  return out;
}
