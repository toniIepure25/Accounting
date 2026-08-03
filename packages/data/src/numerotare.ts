import { formateazaCodDocument } from '@gr/core-domain';
import type { SqlExecutor } from './sql-executor.js';

/** Rezultatul alocarii unui numar de document. */
export interface NumarAlocat {
  numar: number;
  cod: string;
}

/**
 * Alocator ATOMIC de numere de document. Inlocuieste calculul client-side
 * ("numarul maxim existent + 1"), care are doua defecte reale:
 *   1. sub concurenta (mai multi utilizatori), doua cereri pot calcula acelasi
 *      numar inainte ca vreuna sa salveze documentul -> duplicat;
 *   2. daca un document e sters, urmatorul document de acelasi tip poate primi
 *      un numar deja folosit anterior -> coliziune / gaura in numerotare.
 * Fiecare implementare garanteaza un numar UNIC per (tipDocument, an).
 */
export interface Numerotare {
  next(
    tipDocument: string,
    an: number,
    prefixImplicit: string,
    lungimeImplicita?: number,
  ): Promise<NumarAlocat>;
}

/**
 * Implementare SQL: UPDATE ... RETURNING (Postgres si SQLite 3.35+ suporta
 * RETURNING nativ). Daca seria nu exista inca pentru (tipDocument, an), se
 * insereaza cu numarul 1. Corect si sub concurenta pe un singur proces server
 * (baza de date serializeaza UPDATE-urile pe acelasi rand).
 */
export function createSqlNumerotare(exec: SqlExecutor): Numerotare {
  return {
    async next(tipDocument, an, prefixImplicit, lungimeImplicita = 6) {
      const existente = await exec.select<{
        prefix: string;
        ultimul_numar: number;
        lungime_numar: number;
      }>(
        'SELECT prefix, ultimul_numar, lungime_numar FROM serii_documente WHERE tip_document = ? AND an = ?',
        [tipDocument, an],
      );

      if (existente.length === 0) {
        await exec.execute(
          `INSERT INTO serii_documente (id, tip_document, prefix, an, ultimul_numar, lungime_numar, punct_de_lucru_id)
           VALUES (?, ?, ?, ?, 1, ?, NULL)`,
          [crypto.randomUUID(), tipDocument, prefixImplicit, an, lungimeImplicita],
        );
        return {
          numar: 1,
          cod: formateazaCodDocument(
            { prefix: prefixImplicit, an, lungimeNumar: lungimeImplicita },
            1,
          ),
        };
      }

      await exec.execute(
        'UPDATE serii_documente SET ultimul_numar = ultimul_numar + 1 WHERE tip_document = ? AND an = ?',
        [tipDocument, an],
      );
      const [rand] = await exec.select<{
        prefix: string;
        ultimul_numar: number;
        lungime_numar: number;
      }>(
        'SELECT prefix, ultimul_numar, lungime_numar FROM serii_documente WHERE tip_document = ? AND an = ?',
        [tipDocument, an],
      );
      const numar = rand!.ultimul_numar;
      return {
        numar,
        cod: formateazaCodDocument(
          { prefix: rand!.prefix, an, lungimeNumar: rand!.lungime_numar },
          numar,
        ),
      };
    },
  };
}

/** Un numar deja folosit (ex. de un document din seed-ul demo), pentru initializarea corecta a alocatorului. */
export interface NumarExistent {
  tipDocument: string;
  an: number;
  numar: number;
  prefix?: string;
  lungime?: number;
}

/**
 * Implementare in-memory (demo web fara DB). Serializeaza alocarile pe aceeasi
 * cheie (tipDocument+an) printr-un lant de promisiuni, ca doua apeluri
 * concurente in acelasi tab sa nu poata primi vreodata acelasi numar.
 *
 * `existente` initializeaza contorul de la cel mai mare numar deja folosit —
 * altfel documentele din seed-ul demo (inserate direct, fara sa treaca prin
 * acest alocator) ar fi invizibile pentru el, iar primul document nou creat
 * ar primi din nou numarul 1, coliziune vizibila cu un document deja existent.
 */
export function createMemoryNumerotare(existente: readonly NumarExistent[] = []): Numerotare {
  const stare = new Map<string, { ultimulNumar: number; prefix: string; lungime: number }>();
  for (const e of existente) {
    const cheie = `${e.tipDocument}::${e.an}`;
    const curent = stare.get(cheie);
    if (!curent || e.numar > curent.ultimulNumar) {
      stare.set(cheie, {
        ultimulNumar: e.numar,
        prefix: e.prefix ?? curent?.prefix ?? '',
        lungime: e.lungime ?? curent?.lungime ?? 6,
      });
    }
  }
  const cozi = new Map<string, Promise<unknown>>();

  return {
    next(tipDocument, an, prefixImplicit, lungimeImplicita = 6) {
      const cheie = `${tipDocument}::${an}`;
      const executa = async (): Promise<NumarAlocat> => {
        const curent = stare.get(cheie) ?? {
          ultimulNumar: 0,
          prefix: prefixImplicit,
          lungime: lungimeImplicita,
        };
        const numar = curent.ultimulNumar + 1;
        stare.set(cheie, { ...curent, ultimulNumar: numar });
        return {
          numar,
          cod: formateazaCodDocument(
            { prefix: curent.prefix, an, lungimeNumar: curent.lungime },
            numar,
          ),
        };
      };
      // inlantuie pe coada existenta a acestei chei, ca sa serializeze apelurile concurente
      const anterior = cozi.get(cheie) ?? Promise.resolve();
      const rezultat = anterior.then(executa, executa);
      cozi.set(
        cheie,
        rezultat.catch(() => undefined),
      );
      return rezultat;
    },
  };
}
