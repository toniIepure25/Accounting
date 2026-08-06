/**
 * Comenzile e-Factura (Faza 8). Ciclul de viata durabil la SPV, persistat:
 *   pregatesteEfactura  -> construieste XML din documentul postat + valideaza
 *                          structural + persista submisia (ciorna_xml -> validat)
 *   incarcaEfactura     -> incarca la SPV printr-un `uploader` INJECTAT (apelul
 *                          real ANAF traieste in server/desktop, nu aici), IDEMPOTENT
 *                          (o reincercare cu aceeasi cheie NU re-incarca)
 *   inregistreazaRaspunsSpv -> incarcat -> acceptat | respins
 *
 * Apelul de retea real la SPV NU se face aici (mediul nu are credentiale ANAF) —
 * validarea oficiala XSD/CIUS-RO ramane EXTERNAL_REVIEW_REQUIRED.
 */

import { type StareEfactura, asertaTranzitieEfactura } from '@gr/core-domain';
import {
  type SubmisieEfactura,
  actualizeazaSubmisieEfactura,
  creeazaSubmisieEfactura,
  getSubmisieDupaDocument,
  withExecutor,
} from '@gr/data';
import {
  construiesteEFacturaInput,
  genereazaEFacturaXML,
  valideazaStructuralEFactura,
} from '@gr/fiscal-ro';
import { DocumentInexistentError, incarcaDocumentCuLinii } from './load.js';
import { type CommandDeps, acum } from './types.js';

/** Aruncata cand un document nu poate genera e-Factura (tip gresit / nepostat). */
export class EFacturaNepermisaError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'EFacturaNepermisaError';
  }
}

/** Aruncata cand XML-ul nu trece validarea structurala. */
export class EFacturaInvalidaError extends Error {
  constructor(public readonly probleme: readonly { camp: string; mesaj: string }[]) {
    super(
      `e-Factura invalida structural: ${probleme.map((p) => `${p.camp}: ${p.mesaj}`).join('; ')}`,
    );
    this.name = 'EFacturaInvalidaError';
  }
}

/**
 * Pregateste e-Factura: genereaza XML-ul din documentul de vanzare POSTAT, il
 * valideaza structural si persista submisia in starea `validat`. Idempotent: daca
 * exista deja o submisie activa pentru document, o intoarce (nu regenereaza).
 */
export async function pregatesteEfactura(
  deps: CommandDeps,
  documentId: string,
): Promise<SubmisieEfactura> {
  const t = acum(deps);
  return deps.exec.transaction({}, async (tx) => {
    const repos = withExecutor(tx);

    const existenta = await getSubmisieDupaDocument(tx, documentId);
    if (existenta && existenta.stare !== 'respins' && existenta.stare !== 'eroare') {
      return existenta; // deja pregatita/incarcata — idempotent
    }

    const { document, linii } = await incarcaDocumentCuLinii(repos, documentId);
    if (document.tip !== 'factura_vanzare' && document.tip !== 'vanzare_amanunt') {
      throw new EFacturaNepermisaError(
        `e-Factura se emite doar pentru facturi de vanzare (document ${document.cod}, tip ${document.tip}).`,
      );
    }
    if (document.stare !== 'validat') {
      throw new EFacturaNepermisaError(
        `documentul ${document.cod} nu este postat (stare ${document.stare}) — nu se poate emite e-Factura.`,
      );
    }
    if (!document.partenerId) throw new EFacturaNepermisaError('factura nu are cumparator.');

    const firma = document.firmaId ? await repos.firme.getById(document.firmaId) : null;
    const partener = await repos.parteneri.getById(document.partenerId);
    if (!firma) throw new EFacturaNepermisaError('lipseste firma emitenta pentru e-Factura.');
    if (!partener) throw new DocumentInexistentError(document.partenerId);

    const input = construiesteEFacturaInput(document, linii, firma, partener);
    const probleme = valideazaStructuralEFactura(input);
    if (probleme.length > 0) throw new EFacturaInvalidaError(probleme);

    const xml = genereazaEFacturaXML(input);
    return creeazaSubmisieEfactura(
      tx,
      {
        id: crypto.randomUUID(),
        firmaId: document.firmaId ?? null,
        documentId,
        stare: 'validat',
        xml,
        uploadIndex: null,
        mesajStare: null,
        idDescarcare: null,
        idempotencyKey: null,
      },
      t,
    );
  });
}

/** Rezultatul unei incarcari la SPV (de la `uploader`-ul injectat). */
export interface RezultatUploadSpv {
  uploadIndex: string;
  mesaj?: string;
}

export interface OptiuniIncarcare {
  /** Cheie de idempotenta: o reincercare cu aceeasi cheie NU re-incarca. */
  idempotencyKey?: string;
  /** Uploader-ul real (server/desktop). Primeste XML-ul, intoarce indexul SPV. */
  uploader: (xml: string) => Promise<RezultatUploadSpv>;
}

/**
 * Incarca e-Factura la SPV prin `uploader`. Idempotent: daca submisia e deja
 * `incarcat`/`acceptat`, sau daca `idempotencyKey` a mai fost folosita, nu se
 * re-incarca. Tranzitia `validat`/`eroare` -> `incarcat`.
 */
export async function incarcaEfactura(
  deps: CommandDeps,
  documentId: string,
  optiuni: OptiuniIncarcare,
): Promise<SubmisieEfactura> {
  const t = acum(deps);

  // 1. citeste submisia si decide daca mai e ceva de facut (in afara tranzactiei de scriere).
  const submisie = await getSubmisieDupaDocument(deps.exec, documentId);
  if (!submisie) throw new EFacturaNepermisaError('nu exista o submisie e-Factura pregatita.');
  if (submisie.stare === 'incarcat' || submisie.stare === 'acceptat') {
    return submisie; // deja incarcata — idempotent, fara re-upload
  }
  if (submisie.stare === 'respins') {
    throw new EFacturaNepermisaError('submisia a fost respinsa — pregateste o noua e-Factura.');
  }
  asertaTranzitieEfactura(submisie.stare, 'incarcat');

  // 2. efectueaza incarcarea (efect secundar extern) O SINGURA data.
  let rezultat: RezultatUploadSpv;
  try {
    rezultat = await optiuni.uploader(submisie.xml ?? '');
  } catch (e) {
    // Esec de transport: marcheaza `eroare` (reincercabil), pastreaza eroarea.
    await deps.exec.transaction({}, async (tx) => {
      await actualizeazaSubmisieEfactura(
        tx,
        submisie.id,
        { stare: 'eroare', mesajStare: (e as Error).message },
        t,
      );
    });
    throw e;
  }

  // 3. persista rezultatul incarcarii atomic.
  await deps.exec.transaction({}, async (tx) => {
    await actualizeazaSubmisieEfactura(
      tx,
      submisie.id,
      { stare: 'incarcat', uploadIndex: rezultat.uploadIndex, mesajStare: rezultat.mesaj ?? null },
      t,
    );
  });
  return (await getSubmisieDupaDocument(deps.exec, documentId))!;
}

/** Inregistreaza raspunsul final SPV: `incarcat` -> `acceptat` | `respins`. */
export async function inregistreazaRaspunsSpv(
  deps: CommandDeps,
  documentId: string,
  raspuns: { acceptat: boolean; mesaj?: string; idDescarcare?: string },
): Promise<SubmisieEfactura> {
  const t = acum(deps);
  return deps.exec.transaction({}, async (tx) => {
    const submisie = await getSubmisieDupaDocument(tx, documentId);
    if (!submisie) throw new EFacturaNepermisaError('nu exista o submisie e-Factura.');
    const stareNoua: StareEfactura = raspuns.acceptat ? 'acceptat' : 'respins';
    asertaTranzitieEfactura(submisie.stare, stareNoua);
    await actualizeazaSubmisieEfactura(
      tx,
      submisie.id,
      {
        stare: stareNoua,
        mesajStare: raspuns.mesaj ?? null,
        idDescarcare: raspuns.idDescarcare ?? null,
      },
      t,
    );
    return (await getSubmisieDupaDocument(tx, documentId))!;
  });
}
