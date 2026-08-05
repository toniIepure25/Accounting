/**
 * PostDocument — comanda autoritara de "postare" a unui document. Este
 * EVENIMENTUL DE BUSINESS central al Fazei 3, construit pe fundatia de tranzactii
 * dovedita in Faza 2. Nu e un patch de stare: intr-o singura tranzactie
 * atomica ridica documentul din ciorna/aprobat in postat, rezolva si ingheata
 * cota fiscala pe fiecare linie, recalculeaza totalurile server-side si aloca
 * numarul legal. Orice esec => ROLLBACK, fara stare partiala.
 */

import {
  type Document,
  type DocumentLinie,
  STARE_DOC,
  asertaTranzitie,
  validaPentruPostare,
} from '@gr/core-domain';
import { withExecutor } from '@gr/data';
import { type DocumentCuLinii, incarcaDocumentCuLinii } from './load.js';
import { persistaSnapshotLinie, rezolvaSnapshotLinie } from './tax-snapshot.js';
import { type CommandDeps, acum } from './types.js';

export interface OptiuniPostare {
  /** Categorie fiscala per linie (keyed pe `linie.id`) pentru liniile fara produs. */
  categoriiFiscale?: Record<string, string>;
}

/**
 * Posteaza un document persistat (ciorna/aprobat -> postat).
 */
export async function postDocument(
  deps: CommandDeps,
  id: string,
  optiuni: OptiuniPostare = {},
): Promise<DocumentCuLinii> {
  const t = acum(deps);
  // `immediate`: ia lacatul de scriere din start — postarea e sensibila la stoc
  // si la alocarea de numar, deci nu vrem doua postari concurente sa avanseze.
  return deps.exec.transaction({ sqliteMode: 'immediate' }, async (tx) => {
    const repos = withExecutor(tx);
    const { document, linii } = await incarcaDocumentCuLinii(repos, id);

    // 2. tranzitia de stare (arunca daca documentul e deja postat/anulat/stornat)
    asertaTranzitie(document.stare, STARE_DOC.POSTAT);

    // 3. rezolva snapshot-ul fiscal si fixeaza cota autoritara pe fiecare linie
    const snapshots = new Map<string, Awaited<ReturnType<typeof rezolvaSnapshotLinie>>>();
    const liniiCuCota: DocumentLinie[] = [];
    for (const l of linii) {
      const s = await rezolvaSnapshotLinie(
        tx,
        repos,
        document,
        l,
        optiuni.categoriiFiscale?.[l.id],
        t,
      );
      snapshots.set(l.id, s);
      liniiCuCota.push({ ...l, cotaTvaProcent: s.procent });
    }

    // 4. valideaza invariantele + recalculeaza totalurile server-side
    const validat = validaPentruPostare(document, liniiCuCota);

    // 5. aloca numarul legal la pasul autoritar (postare)
    const an = new Date(document.data).getFullYear();
    const alocat = await repos.numerotare.next(document.tip, an, document.serie ?? '', 6);

    // 6. scrie documentul + liniile + snapshot-ul fiscal, atomic
    const docPostat: Document = {
      ...validat.document,
      stare: STARE_DOC.POSTAT,
      numar: alocat.numar,
      cod: alocat.cod,
    };
    await repos.documente.update(id, docPostat);

    for (const l of validat.linii) {
      await repos.documenteLinii.update(l.id, {
        cotaTvaProcent: l.cotaTvaProcent,
        netBani: l.netBani,
        tvaBani: l.tvaBani,
        brutBani: l.brutBani,
      });
      await persistaSnapshotLinie(tx, l.id, snapshots.get(l.id)!);
    }

    return incarcaDocumentCuLinii(repos, id);
  });
}
