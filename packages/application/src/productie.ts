/**
 * Comenzile de PRODUCTIE pentru modulul Mobila (Faza 14). Ridica valoarea
 * verticalei peste motoarele de integritate deja construite: pornirea productiei
 * genereaza consumul REAL de materiale (din BOM-ul configuratorului) si il
 * POSTEAZA printr-un `bon_consum` — deci descarcarea de gestiune (CMP) + nota
 * contabila 601 + faptele fiscale trec prin acelasi motor autoritar
 * (`postDocument`), atomic. Starea de productie e operationala si se tine separat
 * de documentul comanda (imutabil dupa postare).
 */

import {
  DocumentLinieSchema,
  DocumentSchema,
  type StareProductie,
  asertaTranzitieProductie,
  listaDebitare,
  necesarConsumStoc,
  parseConfiguratieMobila,
} from '@gr/core-domain';
import {
  type ProductieMobila,
  getProductieMobila,
  upsertProductieMobila,
  withExecutor,
} from '@gr/data';
import { EFacturaNepermisaError } from './efactura.js';
import { createDraftDocument } from './lifecycle.js';
import { DocumentInexistentError, incarcaDocumentCuLinii } from './load.js';
import { type OptiuniPostare, postDocument } from './post-document.js';
import { type CommandDeps, acum } from './types.js';

/** Starea de productie curenta a unei comenzi, sau initializata din config. */
async function starecurenta(
  deps: CommandDeps,
  comandaId: string,
): Promise<{ productie: ProductieMobila | null; stare: StareProductie }> {
  const productie = await getProductieMobila(deps.exec, comandaId);
  if (productie) return { productie, stare: productie.stareProductie };
  // Fara rand de productie inca: starea vine din configuratia comenzii (meta).
  const { document } = await incarcaDocumentCuLinii(withExecutor(deps.exec), comandaId);
  return { productie: null, stare: parseConfiguratieMobila(document.meta).stareProductie };
}

/**
 * Avanseaza starea de productie a unei comenzi (una din tranzitiile permise).
 * Nu genereaza consum — vezi `pornesteProductie` pentru tranzitia care descarca
 * materialele.
 */
export async function avanseazaProductie(
  deps: CommandDeps,
  comandaId: string,
  stareNoua: StareProductie,
): Promise<ProductieMobila> {
  const t = acum(deps);
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);
    const doc = await repos.documente.getById(comandaId);
    if (!doc) throw new DocumentInexistentError(comandaId);
    const existent = await getProductieMobila(tx, comandaId);
    const stare = existent?.stareProductie ?? parseConfiguratieMobila(doc.meta).stareProductie;
    asertaTranzitieProductie(stare, stareNoua);
    const nou: Omit<ProductieMobila, 'updatedAt'> = {
      documentId: comandaId,
      firmaId: doc.firmaId ?? null,
      stareProductie: stareNoua,
      departamenteFinalizate: existent?.departamenteFinalizate ?? [],
      costManoperaBani: existent?.costManoperaBani ?? 0,
      costMaterialeBani: existent?.costMaterialeBani ?? 0,
      bonConsumId: existent?.bonConsumId ?? null,
    };
    await upsertProductieMobila(tx, nou, t);
    return { ...nou, updatedAt: t };
  });
}

export interface OptiuniPornireProductie {
  /** Gestiunea din care se consuma materialele. Implicit gestiunea comenzii. */
  gestiuneId?: string;
  /** Politica de stoc la consum (Faza 5). Implicit `interzice`. */
  politicaStocNegativ?: OptiuniPostare['politicaStocNegativ'];
}

export interface RezultatPornireProductie {
  productie: ProductieMobila;
  /** Id-ul bonului de consum postat (sau `null` daca nu s-a consumat nimic). */
  bonConsumId: string | null;
  costMaterialeBani: number;
}

/**
 * Porneste productia unei comenzi de mobila (confirmata -> in_productie) SI
 * genereaza + posteaza consumul real de materiale din BOM. Consumul trece prin
 * `postDocument`, deci sub politica implicita `interzice` un material fara stoc
 * opreste pornirea (nimic nu se posteaza partial).
 */
export async function pornesteProductie(
  deps: CommandDeps,
  comandaId: string,
  optiuni: OptiuniPornireProductie = {},
): Promise<RezultatPornireProductie> {
  const t = acum(deps);
  const repos = withExecutor(deps.exec);

  const { document: comanda } = await incarcaDocumentCuLinii(repos, comandaId);
  if (comanda.tip !== 'comanda_mobila') {
    throw new EFacturaNepermisaError(
      `productia se porneste doar pentru o comanda de mobila (document ${comanda.cod}, tip ${comanda.tip}).`,
    );
  }
  const { stare } = await starecurenta(deps, comandaId);
  asertaTranzitieProductie(stare, 'in_productie');

  const gestiuneId = optiuni.gestiuneId ?? comanda.gestiuneId;
  if (!gestiuneId) throw new EFacturaNepermisaError('comanda nu are o gestiune pentru consum.');

  // BOM -> necesar de consum (produs + cantitate) din configuratie.
  const cfg = parseConfiguratieMobila(comanda.meta);
  const optiuniCfg = await repos.optiuniMobila.list();
  const { suprafataMp } = listaDebitare(cfg);
  const necesar = necesarConsumStoc(cfg, optiuniCfg, suprafataMp);

  let bonConsumId: string | null = null;
  let costMaterialeBani = 0;

  if (necesar.length > 0) {
    // Construieste bonul de consum: o linie per material necesar.
    const bonId = crypto.randomUUID();
    const linii = [];
    for (const n of necesar) {
      const produs = await repos.produse.getById(n.produsId);
      linii.push(
        DocumentLinieSchema.parse({
          id: crypto.randomUUID(),
          documentId: bonId,
          produsId: n.produsId,
          denumire: produs?.denumire ?? n.produsId,
          cantitate: n.cantitate,
          pretUnitarBani: 0, // costul iesirii vine din CMP-ul stocului, nu de aici
          cotaTvaProcent: 0,
        }),
      );
    }
    const bonDraft = DocumentSchema.parse({
      id: bonId,
      firmaId: comanda.firmaId ?? null,
      tip: 'bon_consum',
      data: comanda.data,
      gestiuneId,
      documentSursaId: comandaId,
      observatii: `Consum materiale pentru comanda ${comanda.cod}`,
      stare: 'ciorna',
    });
    await createDraftDocument(deps, { document: bonDraft, linii });
    await postDocument(deps, bonId, { politicaStocNegativ: optiuni.politicaStocNegativ });
    bonConsumId = bonId;
    // Costul real al materialelor = descarcarea de gestiune la CMP (din registrul
    // de stoc). Pretul de pe linia bonului e 0 — costul vine din stoc, nu de aici.
    const [r] = await deps.exec.select<{ c: number }>(
      'SELECT COALESCE(SUM(-valoare_bani),0) AS c FROM stock_ledger_entries WHERE document_id = ? AND cantitate < 0',
      [bonId],
    );
    costMaterialeBani = Number(r?.c ?? 0);
  }

  // Avanseaza starea de productie + leaga bonul + costul materialelor.
  const productie = await deps.exec.transaction({}, async (tx) => {
    const existent = await getProductieMobila(tx, comandaId);
    const nou: Omit<ProductieMobila, 'updatedAt'> = {
      documentId: comandaId,
      firmaId: comanda.firmaId ?? null,
      stareProductie: 'in_productie',
      departamenteFinalizate: existent?.departamenteFinalizate ?? [],
      costManoperaBani: existent?.costManoperaBani ?? cfg.costManoperaBani,
      costMaterialeBani,
      bonConsumId,
    };
    await upsertProductieMobila(tx, nou, t);
    return { ...nou, updatedAt: t };
  });

  return { productie, bonConsumId, costMaterialeBani };
}
