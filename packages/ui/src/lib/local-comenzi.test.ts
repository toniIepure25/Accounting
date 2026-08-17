// @vitest-environment node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createDraftDocument } from '@gr/application';
import { DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { withExecutor } from '@gr/data';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { createLocalCommandClient } from './local-comenzi.js';
import { creeazaProviderLocalSqlite, stocatorMemorieBaza } from './local-sqlite.js';

const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve('sql.js'));
const NOW = '2026-02-20T09:00:00.000Z';
const injectii = {
  initSqlJs,
  wasmLocateFile: (f: string) => join(DIST, f),
  seed: false as const,
  debounceMs: 5,
};

describe('createLocalCommandClient — motorul @gr/application in modul local-sqlite', () => {
  it('posteaza pe executorul local: scrie jurnal + stoc + fiscal (nu doar flip de stare)', async () => {
    const { exec } = await creeazaProviderLocalSqlite({
      ...injectii,
      stocator: stocatorMemorieBaza(),
    });
    const repos = withExecutor(exec);

    const firma = await repos.firme.create({ cod: 'A', denumire: 'Firma A', cui: 'RO1' });
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
    await createDraftDocument(
      { exec, actor: 't', now: () => NOW },
      { document: doc, linii: [linie] },
    );

    // Postare prin clientul de comenzi LOCAL (acelasi motor ca serverul).
    const client = createLocalCommandClient(exec, 'tester');
    const rez = (await client.posteaza(doc.id)) as { document: { stare: string } };
    expect(rez.document.stare).toBe('validat');

    const [[j], [s], [f]] = await Promise.all([
      exec.select<{ n: number }>('SELECT count(*) AS n FROM journal_lines'),
      exec.select<{ n: number }>('SELECT count(*) AS n FROM stock_ledger_entries'),
      exec.select<{ n: number }>('SELECT count(*) AS n FROM fiscal_events'),
    ]);
    expect(j!.n).toBeGreaterThan(0);
    expect(s!.n).toBeGreaterThan(0);
    expect(f!.n).toBeGreaterThan(0);

    const [bal] = await exec.select<{ d: number; c: number }>(
      'SELECT COALESCE(SUM(debit_bani),0) AS d, COALESCE(SUM(credit_bani),0) AS c FROM journal_lines',
    );
    expect(bal!.d).toBe(bal!.c); // partida dubla
  });
});
