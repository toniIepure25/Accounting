import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { type Migration, type SqlExecutor, migrate, withExecutor } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftDocument } from './lifecycle.js';
import { postDocument } from './post-document.js';
import { genereazaSaftDinRegistre } from './saft.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-18T09:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  g1: string;
}

async function setup(): Promise<Fixture> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  const repos = withExecutor(exec);
  const p = await repos.produse.create({
    cod: 'DULAP',
    denumire: 'Dulap',
    codCategorieFiscala: 'standard',
  });
  const partener = await repos.parteneri.create({ tip: 'ambele', denumire: 'Partener SRL' });
  const g1 = await repos.gestiuni.create({ cod: 'G1', denumire: 'Depozit' });
  return { exec, produsId: p.id, partenerId: partener.id, g1: g1.id };
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

async function posteaza(fx: Fixture, over: Partial<Document>, cantitate: number, pret: number) {
  const d = DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'receptie_furnizor',
    data: '2025-09-10',
    serie: 'NIR',
    partenerId: fx.partenerId,
    gestiuneId: fx.g1,
    stare: 'ciorna',
    ...over,
  });
  const l = DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId: d.id,
    produsId: fx.produsId,
    denumire: 'Dulap',
    cantitate,
    pretUnitarBani: pret,
    cotaTvaProcent: 21,
  });
  await createDraftDocument(deps(fx), { document: d, linii: [l] });
  return postDocument(deps(fx), d.id);
}

const companie = { nume: 'Titan CO', cui: 'RO14399840', perioadaLuna: 9, perioadaAn: 2025 };

describe('P9 — SAF-T (D406) din registrele persistate', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('genereaza SAF-T cu GeneralLedgerEntries din jurnal; GL echilibrat', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000);

    const { xml, reconciliere } = await genereazaSaftDinRegistre(deps(fx), { companie });
    expect(xml).toContain('<GeneralLedgerEntries>');
    expect(xml).toContain('<AuditFileVersion>D406</AuditFileVersion>');
    expect(reconciliere.echilibrat).toBe(true);
    expect(reconciliere.totalDebitBani).toBe(reconciliere.totalCreditBani);
  });

  it('GL-ul din SAF-T reconciliaza cu suma din journal_lines', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);

    const { reconciliere } = await genereazaSaftDinRegistre(deps(fx), { companie });
    const [r] = await fx.exec.select<{ d: number; c: number }>(
      'SELECT COALESCE(SUM(debit_bani),0) AS d, COALESCE(SUM(credit_bani),0) AS c FROM journal_lines',
    );
    expect(reconciliere.totalDebitBani).toBe(Number(r!.d));
    expect(reconciliere.totalCreditBani).toBe(Number(r!.c));
  });

  it('intervalul restrange perioada SAF-T', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR', data: '2025-08-15' }, 1, 1000);
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR', data: '2025-09-15' }, 1, 1000);

    const augustDoar = await genereazaSaftDinRegistre(deps(fx), {
      companie,
      de: '2025-08-01',
      pana: '2025-08-31',
    });
    // O singura achizitie in august: 401 credit = 1210 (net 1000 + 21% TVA).
    expect(augustDoar.reconciliere.totalCreditBani).toBe(1210);
  });
});
