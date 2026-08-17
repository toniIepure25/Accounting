import {
  type DataProvider,
  MIGRATII_INCORPORATE,
  type SqlExecutor,
  type SqlResult,
  type TransactionOptions,
  createSqlProvider,
  demoSeed,
  migrate,
} from '@gr/data';
import { fromSqlJs } from '@gr/data/web-sqlite';
import type { Database, SqlJsStatic } from 'sql.js';

/**
 * Motorul LOCAL (web) real: SQLite compilat in WebAssembly (sql.js), acelasi
 * `@gr/application` (stoc + jurnal + fiscal atomic) + aceleasi citiri din registre
 * ca serverul, dar in browser, OFFLINE, fara backend. Inlocuieste providerul
 * in-memory (`createMemoryProvider`) pentru modul `local-sqlite`.
 *
 * Persistenta: intreaga baza (`db.export()`) e salvata (debounce) intr-un
 * `StocatorBaza` (IndexedDB in browser) dupa fiecare scriere si reincarcata la
 * pornire — deci datele supravietuiesc unui refresh, spre deosebire de demo.
 */

/** Persistenta instantaneului binar al bazei SQLite. */
export interface StocatorBaza {
  incarca(): Promise<Uint8Array | null>;
  salveaza(bytes: Uint8Array): Promise<void>;
}

/**
 * Executorul SQLite-WASM al modului `local-sqlite` CURENT (singleton — un singur
 * motor local per aplicatie). Setat de `creeazaProviderLocalSqlite`; citit de
 * `useComenzi`/`useRapoarte` ca sa ruleze motorul @gr/application + citirile din
 * registre pe ACELASI executor ca providerul. `null` cat timp nu s-a initializat
 * (dar `data-context` blocheaza randarea pana atunci, deci consumatorii il vad gata).
 */
let execLocalCurent: SqlExecutor | null = null;
export function getExecLocal(): SqlExecutor | null {
  return execLocalCurent;
}

export interface OptiuniLocalSqlite {
  /** Unde se persista baza. Implicit IndexedDB (`stocatorIndexedDb`). */
  stocator?: StocatorBaza;
  /** Seed cu date demo cand baza e goala (prima pornire). Implicit true. */
  seed?: boolean;
  /** Injectabil pentru teste. Implicit `import('sql.js')`. */
  initSqlJs?: (config?: { locateFile?: (f: string) => string }) => Promise<SqlJsStatic>;
  /** Localizarea fisierului .wasm. Implicit URL-ul din bundle-ul Vite. */
  wasmLocateFile?: (f: string) => string;
  /** Debounce (ms) pentru salvarea instantaneului. Implicit 250. */
  debounceMs?: number;
}

/** StocatorBaza in-memory (teste / fallback fara IndexedDB). */
export function stocatorMemorieBaza(initial?: Uint8Array | null): StocatorBaza {
  let bytes: Uint8Array | null = initial ?? null;
  return {
    incarca: async () => bytes,
    salveaza: async (b) => {
      bytes = b;
    },
  };
}

/** StocatorBaza peste IndexedDB (o singura cheie = intreaga baza). */
export function stocatorIndexedDb(nume = 'gr-local-sqlite'): StocatorBaza {
  const CHEIE = 'baza';
  const deschide = (): Promise<IDBDatabase> =>
    new Promise((rezolva, respinge) => {
      const cerere = indexedDB.open(nume, 1);
      cerere.onupgradeneeded = () => cerere.result.createObjectStore('kv');
      cerere.onsuccess = () => rezolva(cerere.result);
      cerere.onerror = () => respinge(cerere.error);
    });
  return {
    incarca: async () => {
      const db = await deschide();
      return new Promise<Uint8Array | null>((rezolva, respinge) => {
        const t = db.transaction('kv', 'readonly').objectStore('kv').get(CHEIE);
        t.onsuccess = () => rezolva((t.result as Uint8Array) ?? null);
        t.onerror = () => respinge(t.error);
      });
    },
    salveaza: async (bytes) => {
      const db = await deschide();
      await new Promise<void>((rezolva, respinge) => {
        const t = db.transaction('kv', 'readwrite').objectStore('kv').put(bytes, CHEIE);
        t.onsuccess = () => rezolva();
        t.onerror = () => respinge(t.error);
      });
    },
  };
}

/**
 * Inveleste un executor ca ORICE scriere sa programeze o salvare (debounced).
 * `txActiv` numara tranzactiile in curs: `db.export()` NU trebuie sa serializeze
 * o baza cu o tranzactie deschisa (ar persista stare NECOMITATA, poate stornata),
 * iar salvarea (setTimeout) se poate declansa intre doua instructiuni `await` ale
 * unei tranzactii — de aceea salvarea se amana cat timp `txActiv.n > 0`.
 */
function cuAutosalvare(
  exec: SqlExecutor,
  programeazaSalvare: () => void,
  txActiv: { n: number },
): SqlExecutor {
  return {
    execute: async (sql: string, params?: readonly unknown[]): Promise<SqlResult> => {
      const r = await exec.execute(sql, params);
      programeazaSalvare();
      return r;
    },
    select: (sql, params) => exec.select(sql, params),
    transaction: async <T>(opt: TransactionOptions, work: (tx: SqlExecutor) => Promise<T>) => {
      txActiv.n++;
      try {
        return await exec.transaction(opt, work);
      } finally {
        txActiv.n--;
        programeazaSalvare(); // dupa COMMIT/ROLLBACK (cand txActiv.n a revenit la 0)
      }
    },
  };
}

async function seedDemo(provider: DataProvider, exec: SqlExecutor): Promise<void> {
  await exec.execute('PRAGMA foreign_keys = OFF');
  for (const [key, randuri] of Object.entries(demoSeed)) {
    // biome-ignore lint/suspicious/noExplicitAny: acces dinamic la repo-uri
    const repo = (provider as any)[key];
    if (!repo?.create || !Array.isArray(randuri)) continue;
    for (const r of randuri) {
      try {
        await repo.create(r);
      } catch {
        /* rand demo invalid pe schema SQL — il sarim (ca pe server) */
      }
    }
  }
  await exec.execute('PRAGMA foreign_keys = ON');
}

/**
 * Construieste providerul LOCAL peste SQLite-WASM: incarca instantaneul persistat
 * (daca exista), aplica migratiile (idempotent), seed la prima pornire, apoi
 * ataseaza auto-salvarea. Intoarce un `DataProvider` obisnuit — restul aplicatiei
 * nu stie ca motorul ruleaza in browser.
 */
export async function creeazaProviderLocalSqlite(
  optiuni: OptiuniLocalSqlite = {},
): Promise<DataProvider> {
  const stocator = optiuni.stocator ?? stocatorIndexedDb();
  const debounceMs = optiuni.debounceMs ?? 250;

  const init =
    optiuni.initSqlJs ?? ((await import('sql.js')).default as OptiuniLocalSqlite['initSqlJs'])!;
  let locateFile = optiuni.wasmLocateFile;
  if (!locateFile) {
    const url = (await import('sql.js/dist/sql-wasm.wasm?url')).default;
    locateFile = () => url;
  }
  const SQL = await init({ locateFile });

  const existent = await stocator.incarca();
  const db: Database = existent ? new SQL.Database(existent) : new SQL.Database();
  const execBrut = fromSqlJs(db);

  const proaspata = !existent;
  const aplicate = await migrate(execBrut, MIGRATII_INCORPORATE);

  // Salvare debounced a intregii baze. `txActiv` protejeaza `db.export()` de a
  // serializa o tranzactie deschisa (vezi cuAutosalvare).
  const txActiv = { n: 0 };
  let planificat: ReturnType<typeof setTimeout> | null = null;
  let inSalvare = false;
  const salveaza = async () => {
    if (inSalvare) return;
    if (txActiv.n > 0) {
      programeazaSalvare(); // amana: nu exporta cat timp e o tranzactie in curs
      return;
    }
    inSalvare = true;
    try {
      await stocator.salveaza(db.export());
    } finally {
      inSalvare = false;
    }
  };
  const programeazaSalvare = () => {
    if (planificat) clearTimeout(planificat);
    planificat = setTimeout(() => {
      planificat = null;
      void salveaza();
    }, debounceMs);
  };

  if (proaspata && optiuni.seed !== false) {
    await seedDemo(createSqlProvider(execBrut), execBrut);
    await salveaza(); // persista imediat starea seed-uita
  } else if (aplicate.length > 0) {
    await salveaza(); // persista schema nou-migrata
  }

  const execFinal = cuAutosalvare(execBrut, programeazaSalvare, txActiv);
  // Expus pentru useComenzi/useRapoarte (motor + rapoarte pe ACELASI executor).
  execLocalCurent = execFinal;
  return createSqlProvider(execFinal);
}
