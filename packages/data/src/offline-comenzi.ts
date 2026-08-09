/**
 * Transport de COMENZI rezilient la deconectare (Faza 12, WIRING-9). Inveleste
 * un `ClientComenzi` obisnuit cu coada de comenzi offline din @gr/sync: cat timp
 * serverul e inaccesibil (offline sau cadere de retea), comanda autoritara
 * (postare/stornare/aprobare/anulare) se PUNE IN COADA cu o cheie de idempotenta
 * stabila si se REDA la reconectare. Serverul aplica aceeasi idempotenta (magazia
 * din Faza 4), deci o dubla redare NU posteaza de doua ori.
 *
 * IMPORTANT: doar COMENZILE trec prin coada. Scrierea unei ciorne noi in modul
 * retea inca merge prin CRUD-ul serverului (nu exista inca persistenta locala in
 * modul retea) — persistenta locala offline pentru date e o lucrare separata
 * (motor SQLite in browser). Aici castigul e ca postarea/stornarea unui document
 * deja persistat supravietuieste unei conexiuni intermitente, fara dubla postare.
 */

import { type ComandaOffline, comenziDeReluat, curataCoada, puneInCoada } from '@gr/sync';
import type { ClientComenzi, CorpComanda, NumeComandaDocument } from './api-comenzi.js';

/** Ridicata cand o comanda a fost pusa in coada (server inaccesibil), nu respinsa. */
export class ComandaInCoadaError extends Error {
  readonly idempotencyKey: string;
  constructor(idempotencyKey: string, message = 'Fara conexiune — comanda a fost pusa in coada.') {
    super(message);
    this.name = 'ComandaInCoadaError';
    this.idempotencyKey = idempotencyKey;
  }
}

/** True daca eroarea semnaleaza o comanda pusa in coada (pentru catch-ul din UI). */
export function esteInCoada(e: unknown): e is ComandaInCoadaError {
  return (
    e instanceof ComandaInCoadaError || (e as { name?: string })?.name === 'ComandaInCoadaError'
  );
}

/** Starea persistata a cozii: comenzile in asteptare + cheile deja executate. */
export interface StareCoada {
  coada: ComandaOffline[];
  executate: string[];
}

/** Persistenta cozii (localStorage in browser, in-memory in teste). */
export interface StocatorCoada {
  citeste(): StareCoada;
  scrie(stare: StareCoada): void;
}

/** Stocator in-memory (teste / fallback fara localStorage). */
export function stocatorMemorie(initial?: StareCoada): StocatorCoada {
  let stare: StareCoada = initial ?? { coada: [], executate: [] };
  return {
    citeste: () => ({ coada: [...stare.coada], executate: [...stare.executate] }),
    scrie: (s) => {
      stare = { coada: [...s.coada], executate: [...s.executate] };
    },
  };
}

/** Stocator peste un `Storage` (localStorage/sessionStorage). */
export function stocatorStorage(storage: Storage, cheie = 'gr-coada-comenzi'): StocatorCoada {
  return {
    citeste: () => {
      try {
        const brut = storage.getItem(cheie);
        if (!brut) return { coada: [], executate: [] };
        const p = JSON.parse(brut) as Partial<StareCoada>;
        return { coada: p.coada ?? [], executate: p.executate ?? [] };
      } catch {
        return { coada: [], executate: [] };
      }
    },
    scrie: (s) => {
      try {
        storage.setItem(cheie, JSON.stringify(s));
      } catch {
        /* quota / storage indisponibil — ignoram, coada devine best-effort */
      }
    },
  };
}

export interface OptiuniOffline {
  stocator: StocatorCoada;
  /** Suntem online? Implicit `navigator.onLine`. */
  esteOnline?: () => boolean;
  /** Eroarea e una de retea (server inaccesibil), nu una de business (4xx)? */
  esteEroareDeRetea?: (e: unknown) => boolean;
  acum?: () => string;
  /** Cate chei executate pastram (evita crestere nelimitata). Implicit 1000. */
  limitaExecutate?: number;
}

/** Rezultatul unei redari a cozii la reconectare. */
export interface RezultatSincronizare {
  redate: number;
  esuate: { idempotencyKey: string; mesaj: string }[];
  ramase: number;
}

export interface ClientComenziOffline extends ClientComenzi {
  /** Reda comenzile din coada catre server (la reconectare / manual). */
  sincronizeaza(): Promise<RezultatSincronizare>;
  /** Comenzile inca in asteptare (pentru un badge „N in asteptare"). */
  inAsteptare(): ComandaOffline[];
}

interface SarcinaComanda {
  nume: NumeComandaDocument;
  corp: CorpComanda;
}

/** Cheie de idempotenta STABILA per comanda (aceeasi la fiecare redare). */
function cheieIdempotenta(nume: NumeComandaDocument, corp: CorpComanda): string {
  return [
    nume,
    corp.documentId,
    corp.expectedVersion ?? '-',
    corp.data ?? '',
    corp.motiv ?? '',
  ].join(':');
}

function tipComanda(nume: NumeComandaDocument): ComandaOffline['tip'] {
  if (nume === 'post-document' || nume === 'approve-document') return 'posteaza';
  if (nume === 'reverse-document') return 'storneaza';
  return 'creeaza_ciorna';
}

const eroareDeReteaImplicita = (e: unknown): boolean => {
  const err = e as { name?: string; message?: string };
  return (
    err?.name === 'TypeError' || // fetch respins (server inaccesibil)
    /failed to fetch|networkerror|network request failed|load failed/i.test(err?.message ?? '')
  );
};

/**
 * Inveleste un `ClientComenzi` cu coada offline. Cand suntem offline (sau serverul
 * e inaccesibil), comanda se pune in coada si se ridica `ComandaInCoadaError`;
 * altfel se executa direct, iar erorile de business (4xx) se propaga normal.
 */
export function createOfflineCommandClient(
  inner: ClientComenzi,
  optiuni: OptiuniOffline,
): ClientComenziOffline {
  const { stocator } = optiuni;
  const esteOnline =
    optiuni.esteOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const esteEroareDeRetea = optiuni.esteEroareDeRetea ?? eroareDeReteaImplicita;
  const acum = optiuni.acum ?? (() => new Date().toISOString());
  const limitaExecutate = optiuni.limitaExecutate ?? 1000;

  const marcheazaExecutat = (key: string): void => {
    const stare = stocator.citeste();
    const executate = stare.executate.includes(key)
      ? stare.executate
      : [...stare.executate, key].slice(-limitaExecutate);
    stocator.scrie({
      coada: curataCoada(stare.coada, new Set(executate)),
      executate,
    });
  };

  const pune = (nume: NumeComandaDocument, corp: CorpComanda, key: string): void => {
    const stare = stocator.citeste();
    const comanda: ComandaOffline = {
      idempotencyKey: key,
      tip: tipComanda(nume),
      documentId: corp.documentId,
      payload: { nume, corp } satisfies SarcinaComanda,
      creataLa: acum(),
    };
    stocator.scrie({ coada: puneInCoada(stare.coada, comanda), executate: stare.executate });
  };

  const ruleaza = async (nume: NumeComandaDocument, corp: CorpComanda): Promise<unknown> => {
    const key = cheieIdempotenta(nume, corp);
    if (!esteOnline()) {
      pune(nume, corp, key);
      throw new ComandaInCoadaError(key);
    }
    try {
      const rez = await inner.ruleaza(nume, corp);
      marcheazaExecutat(key);
      return rez;
    } catch (e) {
      if (esteEroareDeRetea(e)) {
        pune(nume, corp, key);
        throw new ComandaInCoadaError(key);
      }
      throw e; // eroare de business (server a raspuns 4xx) — se propaga
    }
  };

  const sincronizeaza = async (): Promise<RezultatSincronizare> => {
    const esuate: RezultatSincronizare['esuate'] = [];
    if (!esteOnline()) {
      return { redate: 0, esuate, ramase: stocator.citeste().coada.length };
    }
    const stare = stocator.citeste();
    const deReluat = comenziDeReluat(stare.coada, new Set(stare.executate));
    let redate = 0;
    for (const c of deReluat) {
      const sarcina = c.payload as SarcinaComanda | undefined;
      if (!sarcina?.nume) {
        marcheazaExecutat(c.idempotencyKey); // sarcina corupta — o consumam
        continue;
      }
      try {
        await inner.ruleaza(sarcina.nume, sarcina.corp);
        marcheazaExecutat(c.idempotencyKey);
        redate += 1;
      } catch (e) {
        if (esteEroareDeRetea(e)) break; // inca offline — pastram restul cozii
        // Eroare de business la redare (ex. deja postat / tranzitie nepermisa):
        // comanda a ajuns la server si a fost respinsa — o consumam ca sa nu
        // ramana blocata in coada la infinit; o raportam apelantului.
        marcheazaExecutat(c.idempotencyKey);
        esuate.push({ idempotencyKey: c.idempotencyKey, mesaj: (e as Error).message });
      }
    }
    return { redate, esuate, ramase: stocator.citeste().coada.length };
  };

  return {
    ruleaza,
    posteaza: (documentId, expectedVersion) =>
      ruleaza('post-document', { documentId, expectedVersion }),
    storneaza: (documentId, opt = {}) => ruleaza('reverse-document', { documentId, ...opt }),
    sincronizeaza,
    inAsteptare: () => stocator.citeste().coada,
  };
}
