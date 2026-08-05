/**
 * Agregatul de document: masina de stari a ciclului de viata + invariantele lui,
 * ca FUNCTII PURE (fara I/O). Stratul de aplicatie (@gr/application) detine
 * tranzitiile si le executa tranzactional; aici traieste doar REGULA, testabila
 * izolat.
 *
 * Ciclul de viata (ADR-0003):
 *
 *   ciorna ──► aprobat ──► validat(=postat) ──► stornat
 *      │          │
 *      └────► anulat ◄────┘
 *
 * Reguli:
 *  - `ciorna`/`aprobat`: editabile; totalurile si TVA se pot recalcula.
 *  - `validat` (POSTAT): imutabil. Fara PATCH/DELETE prin CRUD generic.
 *    Corectarea se face DOAR prin stornare (`stornat`).
 *  - `stornat`/`anulat`: terminale.
 *
 * Totalurile NU se iau pe incredere de la client: `recalculeazaAgregat`
 * recalculeaza net/TVA/brut server-side din linii, iar postarea foloseste
 * exclusiv valorile recalculate.
 */

import { recalculDocument, recalculLinie } from './documents.js';
import {
  type Document,
  type DocumentLinie,
  type DocumentStare,
  directieStoc,
} from './entities/document.js';

/** Nume semantice pentru starile persistate (vezi DocumentStare in entities). */
export const STARE_DOC = {
  /** draft */
  CIORNA: 'ciorna',
  /** approved */
  APROBAT: 'aprobat',
  /** posted — nume legacy pastrat intentionat (vezi DocumentStare). */
  POSTAT: 'validat',
  /** reversed */
  STORNAT: 'stornat',
  /** cancelled */
  ANULAT: 'anulat',
} as const satisfies Record<string, DocumentStare>;

/**
 * Tranzitiile permise. O postare poate porni direct din `ciorna` sau din
 * `aprobat` — nu impunem un pas de aprobare obligatoriu (ar rupe UX-ul existent
 * intr-un pas), dar il facem POSIBIL si explicit.
 */
const TRANZITII: Record<DocumentStare, readonly DocumentStare[]> = {
  ciorna: ['aprobat', 'validat', 'anulat'],
  aprobat: ['ciorna', 'validat', 'anulat'],
  validat: ['stornat'],
  stornat: [],
  anulat: [],
};

/** Starile in care documentul e imutabil (fara editare/stergere prin CRUD). */
const IMUTABILE: ReadonlySet<DocumentStare> = new Set(['validat', 'stornat', 'anulat']);

export function tranzitiePermisa(de_la: DocumentStare, la: DocumentStare): boolean {
  return TRANZITII[de_la].includes(la);
}

/** Documentul poate fi editat/sters direct? Doar ciorna si aprobat. */
export function esteEditabil(stare: DocumentStare): boolean {
  return !IMUTABILE.has(stare);
}

/** Documentul e postat (a produs efecte)? */
export function estePostat(stare: DocumentStare): boolean {
  return stare === 'validat';
}

/** Documentul e imutabil (postat/stornat/anulat)? */
export function esteImutabil(stare: DocumentStare): boolean {
  return IMUTABILE.has(stare);
}

/** Aruncata cand se cere o tranzitie de stare care nu e permisa. */
export class TranzitieNepermisaError extends Error {
  constructor(
    public readonly de_la: DocumentStare,
    public readonly la: DocumentStare,
  ) {
    super(`Tranzitie de stare nepermisa: ${de_la} -> ${la}.`);
    this.name = 'TranzitieNepermisaError';
  }
}

/** Aruncata cand se incearca modificarea/stergerea unui document imutabil. */
export class DocumentImutabilError extends Error {
  constructor(
    public readonly stare: DocumentStare,
    public readonly operatie: string,
  ) {
    super(
      `Documentul este in starea "${stare}" (imutabil) — operatia "${operatie}" nu este permisa. Corectarea unui document postat se face prin stornare, nu prin editare.`,
    );
    this.name = 'DocumentImutabilError';
  }
}

/** Aruncata cand un document nu respecta invariantele (ex. pentru postare). */
export class DocumentInvalidError extends Error {
  constructor(public readonly motive: readonly string[]) {
    super(`Document invalid: ${motive.join('; ')}`);
    this.name = 'DocumentInvalidError';
  }
}

/** Verifica o tranzitie si arunca daca nu e permisa. */
export function asertaTranzitie(de_la: DocumentStare, la: DocumentStare): void {
  if (!tranzitiePermisa(de_la, la)) throw new TranzitieNepermisaError(de_la, la);
}

/** Verifica faptul ca un document poate fi editat si arunca altfel. */
export function asertaEditabil(stare: DocumentStare, operatie: string): void {
  if (!esteEditabil(stare)) throw new DocumentImutabilError(stare, operatie);
}

/**
 * Recalculeaza server-side net/TVA/brut pe fiecare linie si totalurile
 * documentului. Nu are incredere in valorile primite de la client. Intoarce un
 * agregat nou (nu muteaza intrarile).
 */
export function recalculeazaAgregat(
  doc: Document,
  linii: readonly DocumentLinie[],
): { document: Document; linii: DocumentLinie[] } {
  const liniiRecalc = linii.map(recalculLinie);
  const totaluri = recalculDocument(liniiRecalc);
  return {
    document: {
      ...doc,
      totalNetBani: totaluri.totalNetBani,
      totalTvaBani: totaluri.totalTvaBani,
      totalBrutBani: totaluri.totalBrutBani,
    },
    linii: liniiRecalc,
  };
}

/** Tipuri de document care necesita un partener (nu se pot posta fara). */
const NECESITA_PARTENER: ReadonlySet<Document['tip']> = new Set([
  'factura_vanzare',
  'factura_cumparare',
]);

/**
 * Valideaza invariantele necesare POSTARII si intoarce agregatul recalculat
 * server-side. Arunca `DocumentInvalidError` cu toate motivele adunate.
 *
 * Nu decide inca efecte de stoc/contabile persistate (fazele 5/6) — verifica
 * doar coerenta structurala si campurile obligatorii pentru tipul de document.
 */
export function validaPentruPostare(
  doc: Document,
  linii: readonly DocumentLinie[],
): { document: Document; linii: DocumentLinie[] } {
  const motive: string[] = [];

  if (linii.length === 0) motive.push('documentul nu are nicio linie');

  linii.forEach((l, i) => {
    if (!Number.isFinite(l.cantitate) || l.cantitate === 0) {
      motive.push(`linia ${i + 1}: cantitate invalida (${l.cantitate})`);
    }
    if (!Number.isInteger(l.pretUnitarBani) || l.pretUnitarBani < 0) {
      motive.push(`linia ${i + 1}: pret unitar invalid (${l.pretUnitarBani})`);
    }
    if (l.cotaTvaProcent < 0 || l.cotaTvaProcent > 100) {
      motive.push(`linia ${i + 1}: cota TVA in afara intervalului (${l.cotaTvaProcent})`);
    }
  });

  // Gestiune obligatorie cand documentul afecteaza stocul.
  const dir = directieStoc(doc.tip);
  if ((dir !== 0 || doc.tip === 'plus_minus') && !doc.gestiuneId) {
    motive.push(`tipul "${doc.tip}" afecteaza stocul si necesita o gestiune`);
  }
  if (doc.tip === 'receptie_transfer' && !doc.gestiuneDestinatieId) {
    motive.push('transferul necesita o gestiune de destinatie');
  }
  if (NECESITA_PARTENER.has(doc.tip) && !doc.partenerId) {
    motive.push(`tipul "${doc.tip}" necesita un partener`);
  }

  if (motive.length > 0) throw new DocumentInvalidError(motive);

  return recalculeazaAgregat(doc, linii);
}
