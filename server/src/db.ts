import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type DataProvider,
  type Migration,
  createMemoryProvider,
  createSqlProvider,
  demoSeed,
  migrate,
} from '@gr/data';
import { log } from './log.js';
import { createPgExecutor } from './pg-executor.js';

const AICI = dirname(fileURLToPath(import.meta.url));
const DIRECTOR_MIGRATII = join(AICI, '../../db/migrations');

function incarcaMigratii(): Migration[] {
  return readdirSync(DIRECTOR_MIGRATII)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.sql$/, ''),
      sql: readFileSync(join(DIRECTOR_MIGRATII, f), 'utf8'),
    }));
}

export interface ServerDb {
  provider: DataProvider;
  /** true = PostgreSQL (persistent); false = memorie (demo, se pierde la restart). */
  persistent: boolean;
  /** Verificare de sanatate a conexiunii, pentru /ready. */
  verificaConexiune: () => Promise<boolean>;
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
      'DATABASE_URL nesetat — pornesc cu provider in-memory (date demo, NEPERSISTENTE). ' +
        'Pentru PostgreSQL real, seteaza DATABASE_URL (vezi docker-compose.yml).',
    );
    return {
      provider: createMemoryProvider(demoSeed),
      persistent: false,
      verificaConexiune: async () => true,
    };
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
