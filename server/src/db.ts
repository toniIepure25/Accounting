import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type DataProvider,
  type Migration,
  type SqlExecutor,
  createSqlProvider,
  demoSeed,
  migrate,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { log } from './log.js';
import { createPgExecutor } from './pg-executor.js';

const AICI = dirname(fileURLToPath(import.meta.url));
const DIRECTOR_MIGRATII = join(AICI, '../../db/migrations');

export function incarcaMigratii(): Migration[] {
  return readdirSync(DIRECTOR_MIGRATII)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.sql$/, ''),
      sql: readFileSync(join(DIRECTOR_MIGRATII, f), 'utf8'),
    }));
}

/**
 * Produce un executor pe o baza SQLite in-memory GOALA dar deja migrata la
 * schema curenta. Folosit ca „scratch" de `backupVerificat` ca sa PROBEZE
 * restaurarea unui backup inainte de a-l servi (un backup netestat nu e backup).
 */
export async function creeazaScratchMigrat(): Promise<SqlExecutor> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, incarcaMigratii());
  return exec;
}

export interface ServerDb {
  provider: DataProvider;
  /**
   * Executorul SQL — DETINE tranzactiile, deci comenzile autoritare (postare/
   * stornare, @gr/application) trec prin el. Real in ambele moduri (PostgreSQL sau
   * SQLite in-memory demo), ca API-ul de comenzi sa functioneze si fara PG.
   */
  exec: SqlExecutor;
  /** true = PostgreSQL (persistent); false = SQLite in-memory (demo, se pierde la restart). */
  persistent: boolean;
  /** Verificare de sanatate a conexiunii, pentru /ready. */
  verificaConexiune: () => Promise<boolean>;
}

/**
 * Insereaza datele demo intr-un provider SQL (FK dezactivate temporar, ca ordinea
 * intre tabele sa nu conteze). Randurile care nu trec validarea de schema (ex.
 * date demo legacy cu id ne-uuid pe plan_conturi — provider-ul in-memory nu le
 * valida la seed, cel SQL da) se SAR peste, cu un avertisment — un seed de demo
 * imperfect nu trebuie sa impiedice pornirea serverului.
 */
async function seedSql(exec: SqlExecutor, provider: DataProvider): Promise<void> {
  await exec.execute('PRAGMA foreign_keys = OFF');
  let sarite = 0;
  for (const [key, randuri] of Object.entries(demoSeed)) {
    // biome-ignore lint/suspicious/noExplicitAny: acces dinamic la repo-uri
    const repo = (provider as any)[key];
    if (!repo?.create || !Array.isArray(randuri)) continue;
    for (const r of randuri) {
      try {
        await repo.create(r);
      } catch {
        sarite++;
      }
    }
  }
  await exec.execute('PRAGMA foreign_keys = ON');
  if (sarite > 0) log.warn('seed demo: randuri sarite (validare esuata)', { sarite });
}

/**
 * Construieste stratul de date al serverului.
 *   - `DATABASE_URL` setat  -> PostgreSQL real; migratiile din db/migrations
 *     ruleaza automat la pornire (idempotent — vezi @gr/data `migrate`).
 *   - altfel                -> provider in-memory cu date demo, pentru pornire
 *     instanta si probe rapide, fara nicio dependinta externa.
 *
 * `pg` e o dependinta optionala a acestui pachet (vezi package.json) — se
 * incarca dinamic doar cand e nevoie de ea, ca serverul sa porneasca si fara
 * `npm install pg` in modul demo.
 */
export async function creeazaServerDb(): Promise<ServerDb> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log.warn(
      'DATABASE_URL nesetat — pornesc cu SQLite in-memory (date demo, NEPERSISTENTE). ' +
        'Ruleaza motorul real (stoc/jurnal/fiscal) prin comenzi; pentru PostgreSQL ' +
        'persistent, seteaza DATABASE_URL (vezi docker-compose.yml).',
    );
    const exec = fromBetterSqlite(new Database(':memory:'));
    await migrate(exec, incarcaMigratii());
    const provider = createSqlProvider(exec);
    await seedSql(exec, provider);
    return { provider, exec, persistent: false, verificaConexiune: async () => true };
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  const exec = createPgExecutor(pool);

  const migratii = incarcaMigratii();
  const aplicate = await migrate(exec, migratii);
  if (aplicate.length > 0) log.info('migratii PostgreSQL aplicate', { migratii: aplicate });
  else log.info('PostgreSQL conectat, fara migratii noi de aplicat');

  return {
    provider: createSqlProvider(exec),
    exec,
    persistent: true,
    verificaConexiune: async () => {
      try {
        await exec.select('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
  };
}
