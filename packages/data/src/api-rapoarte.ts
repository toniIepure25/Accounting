import type { DecontDinEvenimente, MiscareStoc, NotaContabila, SoldStoc } from '@gr/core-domain';
import type { FurnizorToken } from './api-repo.js';
import type { FiltruDocumente, PaginaDocumente, PaginareKeyset } from './document-query.js';

/** Rapoartele de stoc citite din registru: miscari (fise/rulaje) + solduri materializate. */
export interface RaportStoc {
  miscari: MiscareStoc[];
  solduri: SoldStoc[];
}

/** Fisierul SAF-T (D406) generat din registru + reconcilierea General Ledger. */
export interface RaportSaft {
  xml: string;
  reconciliere: { totalDebitBani: number; totalCreditBani: number; echilibrat: boolean };
}

/**
 * Client pentru RAPOARTELE citite din registrele persistente ale serverului
 * (modurile retea/cloud). Ex.: notele contabile vin din `journal_entries` +
 * `journal_lines` scrise la postare — sursa de adevar — nu recalculate din
 * documente in client. In modul local (fara server) apelantul cade pe recalculare.
 */
export interface ClientRapoarte {
  /** Notele contabile persistate (registru-jurnal / cartea mare / balanta / fisa). */
  noteContabile(): Promise<NotaContabila[]>;
  /** Miscarile + soldurile de stoc persistate (fise de magazie, balanta, rulaje). */
  stoc(): Promise<RaportStoc>;
  /** Decontul de TVA (baza D300) din evenimentele fiscale persistate, pe o perioada. */
  decont(interval?: { de?: string; pana?: string }): Promise<DecontDinEvenimente>;
  /** O pagina de documente (keyset), filtrata + paginata pe server (RK-13). */
  documente(filtru?: FiltruDocumente, paginare?: PaginareKeyset): Promise<PaginaDocumente>;
  /** Fisierul SAF-T (D406) pe luna/an, din registrul contabil persistat. */
  saft(perioada: { an: number; luna: number }): Promise<RaportSaft>;
}

export function createReportsClient(baseUrl: string, getToken?: FurnizorToken): ClientRapoarte {
  const base = baseUrl.replace(/\/$/, '');
  const headers = () => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    const token = getToken?.();
    if (token) h.authorization = `Bearer ${token}`;
    return h;
  };

  const ok = async (r: Response) => {
    if (!r.ok) {
      try {
        const corp = (await r.json()) as { error?: string };
        if (corp?.error) throw new Error(corp.error);
      } catch {
        /* fara corp JSON */
      }
      throw new Error(`Eroare server (${r.status} ${r.statusText})`);
    }
    return r.json();
  };

  return {
    noteContabile: () =>
      fetch(`${base}/reports/journal`, { headers: headers() }).then(ok) as Promise<NotaContabila[]>,
    stoc: () =>
      fetch(`${base}/reports/stock`, { headers: headers() }).then(ok) as Promise<RaportStoc>,
    decont: (interval = {}) => {
      const q = new URLSearchParams();
      if (interval.de) q.set('de', interval.de);
      if (interval.pana) q.set('pana', interval.pana);
      const qs = q.toString();
      return fetch(`${base}/reports/decont${qs ? `?${qs}` : ''}`, { headers: headers() }).then(
        ok,
      ) as Promise<DecontDinEvenimente>;
    },
    documente: (filtru = {}, paginare = {}) => {
      const q = new URLSearchParams();
      if (filtru.tip) q.set('tip', filtru.tip);
      if (filtru.stare) q.set('stare', filtru.stare);
      if (filtru.partenerId) q.set('partener_id', filtru.partenerId);
      if (filtru.de) q.set('de', filtru.de);
      if (filtru.pana) q.set('pana', filtru.pana);
      if (paginare.limita) q.set('limita', String(paginare.limita));
      if (paginare.dupa) {
        q.set('cursor_data', paginare.dupa.data);
        q.set('cursor_id', paginare.dupa.id);
      }
      const qs = q.toString();
      return fetch(`${base}/reports/documents${qs ? `?${qs}` : ''}`, { headers: headers() }).then(
        ok,
      ) as Promise<PaginaDocumente>;
    },
    saft: ({ an, luna }) =>
      fetch(`${base}/reports/saft?an=${an}&luna=${luna}`, { headers: headers() }).then(
        ok,
      ) as Promise<RaportSaft>,
  };
}
