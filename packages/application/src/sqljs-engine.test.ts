import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { type Migration, type SqlExecutor, migrate, withExecutor } from '@gr/data';
import { fromSqlJs } from '@gr/data/web-sqlite';
import initSqlJs from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDraftDocument } from './lifecycle.js';
import { postDocument } from './post-document.js';

const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve('sql.js'));
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-20T09:00:00.000Z';
// biome-ignore lint/suspicious/noExplicitAny: SqlJsStatic
let SQL: any;
beforeAll(async () => {
  SQL = await initSqlJs({ locateFile: (f: string) => join(DIST, f) });
});

/**
 * Proba DE FOND: ACELASI motor @gr/application (postare = stoc + jurnal + fiscal,
 * atomic) ruleaza pe executorul SQLite-WASM (browser, modul local), nu doar pe
 * better-sqlite3 (server). Daca acest test trece, motorul si registrele merg
 * offline, fara server — de aici, wiring-ul LOCAL mode.
 */
describe('@gr/application pe SQLite WASM (fromSqlJs) — paritate cu serverul', () => {
  it('postDocument scrie jurnal + stoc + evenimente fiscale in browser-engine', async () => {
    const exec: SqlExecutor = fromSqlJs(new SQL.Database());
    await migrate(exec, migratii());
    const repos = withExecutor(exec);

    const firma = await repos.firme.create({ cod: 'A', denumire: 'Firma A', cui: 'RO123' });
    const partener = await repos.parteneri.create({ tip: 'furnizor', denumire: 'Furnizor A' });
    const gest = await repos.gestiuni.create({ cod: 'G-A', denumire: 'Depozit A' });
    const produs = await repos.produse.create({
      cod: 'DULAP',
      denumire: 'Dulap',
      codCategorieFiscala: 'standard',
    });

    const doc = DocumentSchema.parse({
      id: crypto.randomUUID(),
      firmaId: firma.id,
      tip: 'receptie_furnizor',
      serie: 'NIR',
      data: '2025-09-10',
      partenerId: partener.id,
      gestiuneId: gest.id,
      stare: 'ciorna',
    });
    const linie = DocumentLinieSchema.parse({
      id: crypto.randomUUID(),
      documentId: doc.id,
      produsId: produs.id,
      denumire: 'Dulap',
      cantitate: 10,
      pretUnitarBani: 1000,
      cotaTvaProcent: 21,
    });

    const deps = { exec, actor: 'tester', now: () => NOW };
    await createDraftDocument(deps, { document: doc, linii: [linie] });
    const rez = await postDocument(deps, doc.id);
    expect(rez.document.stare).toBe('validat');

    // Registrele au fost scrise ATOMIC de acelasi motor, pe executorul WASM.
    const [[jurnal], [stoc], [fisc]] = await Promise.all([
      exec.select<{ n: number }>('SELECT count(*) AS n FROM journal_lines'),
      exec.select<{ n: number }>('SELECT count(*) AS n FROM stock_ledger_entries'),
      exec.select<{ n: number }>('SELECT count(*) AS n FROM fiscal_events'),
    ]);
    expect(jurnal!.n).toBeGreaterThan(0);
    expect(stoc!.n).toBeGreaterThan(0);
    expect(fisc!.n).toBeGreaterThan(0);

    // Partida dubla: suma debitelor == suma creditelor pe jurnalul scris.
    const [bal] = await exec.select<{ d: number; c: number }>(
      'SELECT COALESCE(SUM(debit_bani),0) AS d, COALESCE(SUM(credit_bani),0) AS c FROM journal_lines',
    );
    expect(bal!.d).toBe(bal!.c);
  });
});
