// @vitest-environment node
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createDraftDocument } from '@gr/application';
import { DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { withExecutor } from '@gr/data';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { createLocalCommandClient } from './local-comenzi.js';
import { createLocalReportsClient } from './local-rapoarte.js';
import { creeazaProviderLocalSqlite, getExecLocal, stocatorMemorieBaza } from './local-sqlite.js';

const require = createRequire(import.meta.url);
const DIST = dirname(require.resolve('sql.js'));
const NOW = '2025-09-10T09:00:00.000Z';

describe('createLocalReportsClient — rapoartele local-sqlite citesc registrele locale', () => {
  it('dupa o postare locala, jurnalul + stocul + decontul reflecta registrele scrise', async () => {
    await creeazaProviderLocalSqlite({
      initSqlJs,
      wasmLocateFile: (f: string) => join(DIST, f),
      seed: false,
      debounceMs: 5,
      stocator: stocatorMemorieBaza(),
    });
    const exec = getExecLocal();
    if (!exec) throw new Error('exec local neinitializat');
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
    await createLocalCommandClient(exec, 't').posteaza(doc.id);

    const rap = createLocalReportsClient(exec, () => firma.id);

    // Jurnal: note contabile din registru, echilibrate.
    const note = await rap.noteContabile();
    expect(note.length).toBeGreaterThan(0);

    // Stoc: 10 buc receptionate, sold pe gestiune.
    const { solduri } = await rap.stoc();
    expect(solduri.some((s) => s.cantitate === 10)).toBe(true);

    // Decont (D300): TVA deductibila din achizitie (baza 10000 * 21% = 2100).
    const decont = await rap.decont({ de: '2025-09-01', pana: '2025-09-30' });
    expect(decont.tvaDeductibilaBani).toBe(2100);

    // Scopare pe firma: o alta firma nu vede notele acesteia.
    const rapAlta = createLocalReportsClient(exec, () => 'firma-inexistenta');
    expect(await rapAlta.noteContabile()).toHaveLength(0);
  });
});
