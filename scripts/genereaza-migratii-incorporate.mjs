// Genereaza `packages/data/src/migratii-incorporate.ts` din `db/migrations/*.sql`.
// Motorul din browser (SQLite-WASM, modul local web) nu poate citi fisiere de pe
// disc — are nevoie de migratiile INCORPORATE ca modul JS. SQL-ul e codat cu
// JSON.stringify (fara probleme de escaping). Un test de drift (@gr/data) compara
// modulul cu fisierele de pe disc, deci acest fisier NU trebuie editat manual:
//   node scripts/genereaza-migratii-incorporate.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AICI = dirname(fileURLToPath(import.meta.url));
const DIR = join(AICI, '..', 'db', 'migrations');
const IESIRE = join(AICI, '..', 'packages', 'data', 'src', 'migratii-incorporate.ts');

const migratii = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));

const corp = migratii
  .map((m) => `  { id: ${JSON.stringify(m.id)}, sql: ${JSON.stringify(m.sql)} },`)
  .join('\n');

const continut = `import type { Migration } from './migrate.js';

/**
 * Migratiile INCORPORATE ca date (generat din \`db/migrations/*.sql\` de
 * \`scripts/genereaza-migratii-incorporate.mjs\`). Necesare in medii fara acces la
 * fisiere — motorul SQLite-WASM din browser (modul local web). NU edita manual:
 * regenereaza cu \`node scripts/genereaza-migratii-incorporate.mjs\`. Un test de
 * drift (\`migratii-incorporate.test.ts\`) garanteaza ca raman sincrone cu discul.
 */
export const MIGRATII_INCORPORATE: readonly Migration[] = [
${corp}
];
`;

writeFileSync(IESIRE, continut, 'utf8');
console.log(`Scris ${migratii.length} migratii in ${IESIRE}`);
