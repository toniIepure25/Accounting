/**
 * Comenzile de ciclu de viata ale documentului (in afara de postare, care e in
 * post-document.ts). Fiecare comanda ruleaza intr-o tranzactie proprie, verifica
 * tranzitia/imutabilitatea prin agregatul pur si scrie atomic.
 */

import {
  type Document,
  type DocumentLinie,
  STARE_DOC,
  asertaEditabil,
  asertaTranzitie,
  recalculeazaAgregat,
} from '@gr/core-domain';
import { withExecutor } from '@gr/data';
import { type DocumentCuLinii, DocumentInexistentError, incarcaDocumentCuLinii } from './load.js';
import { asertaVersiune } from './locking.js';
import { stornoStocDocument } from './stock.js';
import { copiazaSnapshotLinie } from './tax-snapshot.js';
import { type CommandDeps, type DocumentPayload, acum } from './types.js';

/** Creeaza o CIORNA (document + linii) atomic, cu totaluri recalculate server-side. */
export async function createDraftDocument(
  deps: CommandDeps,
  payload: DocumentPayload,
): Promise<DocumentCuLinii> {
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);
    const draft: Document = { ...payload.document, stare: STARE_DOC.CIORNA };
    const recalc = recalculeazaAgregat(draft, payload.linii);
    const creat = await repos.documente.create(recalc.document);
    for (const l of recalc.linii) {
      await repos.documenteLinii.create({ ...l, documentId: creat.id });
    }
    return incarcaDocumentCuLinii(repos, creat.id);
  });
}

/** Modifica o ciorna/aprobat (imutabilitatea blocheaza documentele postate). */
export async function updateDraftDocument(
  deps: CommandDeps,
  id: string,
  patch: {
    document?: Partial<Document>;
    linii?: readonly DocumentLinie[];
    /** Blocare optimista: versiunea asteptata a documentului (Faza 4). */
    expectedVersion?: number;
  },
): Promise<DocumentCuLinii> {
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);
    const current = await repos.documente.getById(id);
    if (!current) throw new DocumentInexistentError(id);
    asertaVersiune(id, current.version, patch.expectedVersion);
    asertaEditabil(current.stare, 'update');

    const doc: Document = patch.document
      ? { ...current, ...patch.document, id, stare: current.stare }
      : current;

    let linii: readonly DocumentLinie[];
    if (patch.linii) {
      const existente = (await repos.documenteLinii.list()).filter((l) => l.documentId === id);
      for (const l of existente) await repos.documenteLinii.remove(l.id);
      linii = patch.linii;
    } else {
      linii = (await repos.documenteLinii.list()).filter((l) => l.documentId === id);
    }

    const recalc = recalculeazaAgregat(doc, linii);
    await repos.documente.update(id, { ...recalc.document, version: current.version + 1 });
    for (const l of recalc.linii) {
      if (patch.linii) {
        await repos.documenteLinii.create({ ...l, documentId: id });
      } else {
        await repos.documenteLinii.update(l.id, {
          netBani: l.netBani,
          tvaBani: l.tvaBani,
          brutBani: l.brutBani,
        });
      }
    }
    return incarcaDocumentCuLinii(repos, id);
  });
}

/** Aproba o ciorna (ciorna -> aprobat). */
export async function approveDocument(
  deps: CommandDeps,
  id: string,
  expectedVersion?: number,
): Promise<Document> {
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);
    const doc = await repos.documente.getById(id);
    if (!doc) throw new DocumentInexistentError(id);
    asertaVersiune(id, doc.version, expectedVersion);
    asertaTranzitie(doc.stare, STARE_DOC.APROBAT);
    return repos.documente.update(id, { stare: STARE_DOC.APROBAT, version: doc.version + 1 });
  });
}

/** Anuleaza un document ne-postat (ciorna/aprobat -> anulat). */
export async function cancelDocument(
  deps: CommandDeps,
  id: string,
  expectedVersion?: number,
): Promise<Document> {
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);
    const doc = await repos.documente.getById(id);
    if (!doc) throw new DocumentInexistentError(id);
    asertaVersiune(id, doc.version, expectedVersion);
    asertaTranzitie(doc.stare, STARE_DOC.ANULAT);
    return repos.documente.update(id, { stare: STARE_DOC.ANULAT, version: doc.version + 1 });
  });
}

export interface OptiuniStornare {
  /** Data documentului de stornare (ISO). Implicit data documentului original. */
  data?: string;
  motiv?: string;
  /** Blocare optimista: versiunea asteptata a documentului original (Faza 4). */
  expectedVersion?: number;
}

/**
 * Storneaza un document POSTAT (postat -> stornat) si creeaza un document de
 * stornare LEGAT, cu linii negate, atomic. Snapshot-ul fiscal se copiaza de pe
 * liniile originale (aceeasi identitate de regula). NU atinge inca registrele de
 * stoc/contabile persistate (fazele 5/6 nu exista) — aceasta comanda flip-uieste
 * starea si emite documentul-oglinda; efectele de registru se leaga cand exista.
 */
export async function reverseDocument(
  deps: CommandDeps,
  id: string,
  optiuni: OptiuniStornare = {},
): Promise<DocumentCuLinii> {
  const t = acum(deps);
  return deps.exec.transaction({ sqliteMode: 'immediate' }, async (tx) => {
    const repos = withExecutor(tx);
    const { document, linii } = await incarcaDocumentCuLinii(repos, id);
    asertaVersiune(id, document.version, optiuni.expectedVersion);
    asertaTranzitie(document.stare, STARE_DOC.STORNAT);

    // 1. marcheaza originalul ca stornat
    await repos.documente.update(id, {
      stare: STARE_DOC.STORNAT,
      version: document.version + 1,
    });

    // 2. creeaza documentul de stornare (oglinda negata), el insusi POSTAT
    const dataStorno = optiuni.data ?? document.data;
    const an = new Date(dataStorno).getFullYear();
    const alocat = await repos.numerotare.next(document.tip, an, document.serie ?? '', 6);
    const stornoId = crypto.randomUUID();
    const stornoDoc: Document = {
      ...document,
      id: stornoId,
      data: dataStorno,
      numar: alocat.numar,
      cod: alocat.cod,
      documentSursaId: id,
      stare: STARE_DOC.POSTAT,
      observatii: `Stornare a documentului ${document.cod}.${optiuni.motiv ? ` ${optiuni.motiv}` : ''} [${t}]`,
      totalNetBani: -document.totalNetBani,
      totalTvaBani: -document.totalTvaBani,
      totalBrutBani: -document.totalBrutBani,
    };
    await repos.documente.create(stornoDoc);

    for (const l of linii) {
      const stornoLinieId = crypto.randomUUID();
      await repos.documenteLinii.create({
        ...l,
        id: stornoLinieId,
        documentId: stornoId,
        cantitate: -l.cantitate,
        netBani: -l.netBani,
        tvaBani: -l.tvaBani,
        brutBani: -l.brutBani,
      });
      await copiazaSnapshotLinie(tx, l.id, stornoLinieId);
    }

    // Storneaza in registrul de stoc: intrari compensatorii (negate) pe documentul
    // de stornare; soldurile revin la valoarea de dinainte de postare.
    await stornoStocDocument(tx, id, stornoId, dataStorno, document.firmaId ?? null, t);

    return incarcaDocumentCuLinii(repos, stornoId);
  });
}
