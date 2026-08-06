import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONT,
  type Document,
  DocumentLinieSchema,
  DocumentSchema,
  decontDinEvenimente,
} from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  listeazaEvenimenteFiscale,
  migrate,
  withExecutor,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDraftDocument, reverseDocument } from './lifecycle.js';
import { postDocument } from './post-document.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-14T09:00:00.000Z';

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

function docNou(fx: Fixture, over: Partial<Document>): Document {
  return DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'receptie_furnizor',
    data: '2025-09-10',
    serie: 'X',
    partenerId: fx.partenerId,
    gestiuneId: fx.g1,
    stare: 'ciorna',
    ...over,
  });
}

function linie(documentId: string, produsId: string, cantitate: number, pret: number) {
  return DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId,
    produsId,
    denumire: 'Dulap',
    cantitate,
    pretUnitarBani: pret,
    cotaTvaProcent: 21,
  });
}

async function posteaza(fx: Fixture, over: Partial<Document>, cantitate: number, pret: number) {
  const d = docNou(fx, over);
  await createDraftDocument(deps(fx), {
    document: d,
    linii: [linie(d.id, fx.produsId, cantitate, pret)],
  });
  return postDocument(deps(fx), d.id);
}

async function soldCont(exec: SqlExecutor, cont: string): Promise<number> {
  const [r] = await exec.select<{ d: number; c: number }>(
    'SELECT COALESCE(SUM(debit_bani),0) AS d, COALESCE(SUM(credit_bani),0) AS c FROM journal_lines WHERE cont = ?',
    [cont],
  );
  return Number(r!.d) - Number(r!.c);
}

describe('P7 — registru de evenimente fiscale emis atomic la postare', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('vanzarea emite un eveniment colectat; achizitia unul deductibil', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000);

    const ev = await listeazaEvenimenteFiscale(fx.exec);
    const decont = decontDinEvenimente(ev);
    expect(decont.tvaColectataBani).toBe(4200); // 4 * 50.00 * 21%
    expect(decont.tvaDeductibilaBani).toBe(2100); // 10 * 10.00 * 21%
    expect(decont.dePlataBani).toBe(2100);
  });

  it('NIR + factura de cumparare pentru aceeasi achizitie => TVA deductibil o SINGURA data (RK-07)', async () => {
    const nir = await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000); // deductibil 2100
    const fc = docNou(fx, {
      tip: 'factura_cumparare',
      serie: 'FC',
      gestiuneId: null,
      documentSursaId: nir.document.id,
    });
    await createDraftDocument(deps(fx), {
      document: fc,
      linii: [linie(fc.id, fx.produsId, 10, 1000)],
    });
    await postDocument(deps(fx), fc.id);

    const decont = decontDinEvenimente(await listeazaEvenimenteFiscale(fx.exec));
    expect(decont.tvaDeductibilaBani).toBe(2100); // NU 4200 — fara dubla numarare
  });

  it('evenimentele fiscale reconciliaza cu jurnalul (colectata=4427, deductibila=4426)', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000);

    const decont = decontDinEvenimente(await listeazaEvenimenteFiscale(fx.exec));
    // 4426 (TVA deductibila) e cont de activ: sold debitor; 4427 (colectata) creditor.
    expect(decont.tvaDeductibilaBani).toBe(await soldCont(fx.exec, CONT.TVA_DEDUCTIBILA));
    expect(decont.tvaColectataBani).toBe(-(await soldCont(fx.exec, CONT.TVA_COLECTATA)));
  });

  it('interval filtreaza evenimentele pe perioada', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR', data: '2025-08-15' }, 1, 1000);
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR', data: '2025-09-15' }, 1, 1000);
    const augustDoar = await listeazaEvenimenteFiscale(fx.exec, {
      de: '2025-08-01',
      pana: '2025-08-31',
    });
    expect(augustDoar).toHaveLength(1);
  });

  it('stornarea emite evenimente compensatorii => decontul net revine la zero', async () => {
    const rec = await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await reverseDocument(deps(fx), rec.document.id);

    const decont = decontDinEvenimente(await listeazaEvenimenteFiscale(fx.exec));
    expect(decont.tvaDeductibilaBani).toBe(0); // 2100 + (-2100)
  });
});
