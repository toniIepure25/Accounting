import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Document,
  DocumentLinieSchema,
  DocumentSchema,
  StocInsuficientError,
} from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  citesteBalantaStoc,
  listeazaBalanteStoc,
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

const NOW = '2026-02-10T09:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  g1: string;
  g2: string;
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
  const g2 = await repos.gestiuni.create({ cod: 'G2', denumire: 'Magazin' });
  return { exec, produsId: p.id, partenerId: partener.id, g1: g1.id, g2: g2.id };
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

describe('P5 — registru de stoc emis atomic la postare', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('receptia scrie o intrare de registru + sold materializat (CMP)', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000); // 10 buc @ 10.00

    const sold = await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId);
    expect(sold?.cantitate).toBe(10);
    expect(sold?.valoareBani).toBe(10000);

    const ledger = await fx.exec.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM stock_ledger_entries',
    );
    expect(Number(ledger[0]!.n)).toBe(1);
  });

  it('vanzarea scade stocul la CMP curent; raportul deriva din sold', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000); // pret vanzare irelevant la stoc

    const sold = await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId);
    expect(sold?.cantitate).toBe(6);
    expect(sold?.valoareBani).toBe(6000); // 4 iesite la CMP 1000 => 6000 ramase

    const balante = await listeazaBalanteStoc(fx.exec);
    expect(balante).toHaveLength(1);
    expect(balante[0]!.pmpBani).toBe(1000);
  });

  it('ATOMIC: o vanzare peste stoc (interzice) arunca si face rollback total', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 3, 1000); // doar 3 in stoc

    const vd = docNou(fx, { tip: 'factura_vanzare', serie: 'FV' });
    await createDraftDocument(deps(fx), {
      document: vd,
      linii: [linie(vd.id, fx.produsId, 5, 5000)],
    });
    await expect(postDocument(deps(fx), vd.id)).rejects.toBeInstanceOf(StocInsuficientError);

    // Rollback complet: documentul ramane ciorna, soldul neschimbat, fara numar FV.
    expect((await withExecutor(fx.exec).documente.getById(vd.id))?.stare).toBe('ciorna');
    expect((await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId))?.cantitate).toBe(3);
    const seriiFv = await fx.exec.select<{ n: number }>(
      "SELECT COUNT(*) AS n FROM serii_documente WHERE tip_document = 'factura_vanzare'",
    );
    expect(Number(seriiFv[0]!.n)).toBe(0);
  });

  it('politica "permite" lasa soldul sub zero (fara clamp)', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 3, 1000);
    const vd = docNou(fx, { tip: 'factura_vanzare', serie: 'FV' });
    await createDraftDocument(deps(fx), {
      document: vd,
      linii: [linie(vd.id, fx.produsId, 5, 5000)],
    });
    await postDocument(deps(fx), vd.id, { politicaStocNegativ: 'permite' });
    expect((await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId))?.cantitate).toBe(-2);
  });

  it('stornarea readuce stocul la valoarea de dinainte (registrul se aduce la zero)', async () => {
    const rec = await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    expect((await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId))?.cantitate).toBe(10);

    await reverseDocument(deps(fx), rec.document.id);

    const sold = await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId);
    expect(sold?.cantitate).toBe(0);
    expect(sold?.valoareBani).toBe(0);
    // suma cantitatilor din registru pentru produs = 0 (intrare + compensare)
    const s = await fx.exec.select<{ t: number }>(
      'SELECT COALESCE(SUM(cantitate),0) AS t FROM stock_ledger_entries WHERE produs_id = ?',
      [fx.produsId],
    );
    expect(Number(s[0]!.t)).toBe(0);
  });

  it('transferul conserva valoarea intre gestiuni', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1500); // CMP 1500
    await posteaza(
      fx,
      { tip: 'receptie_transfer', serie: 'TR', gestiuneId: fx.g1, gestiuneDestinatieId: fx.g2 },
      4,
      0,
    );
    const sold1 = await citesteBalantaStoc(fx.exec, fx.g1, fx.produsId);
    const sold2 = await citesteBalantaStoc(fx.exec, fx.g2, fx.produsId);
    expect(sold1?.cantitate).toBe(6);
    expect(sold1?.valoareBani).toBe(9000); // 6 * 1500
    expect(sold2?.cantitate).toBe(4);
    expect(sold2?.valoareBani).toBe(6000); // 4 * 1500 — valoare conservata
    expect((sold1?.valoareBani ?? 0) + (sold2?.valoareBani ?? 0)).toBe(15000);
  });
});
