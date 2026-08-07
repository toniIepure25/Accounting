import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ConfiguratieMobila,
  type Document,
  DocumentSchema,
  TranzitieProductieNepermisaError,
} from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  citesteBalantaStoc,
  getProductieMobila,
  migrate,
  withExecutor,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { avanseazaProductie, pornesteProductie } from './productie.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-22T09:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  materialId: string;
  gestiuneId: string;
  optiuneMaterialId: string;
}

async function setup(): Promise<Fixture> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  const repos = withExecutor(exec);
  const material = await repos.produse.create({
    cod: 'PAL',
    denumire: 'PAL 18mm',
    unitateMasura: 'mp',
    codCategorieFiscala: 'standard',
  });
  const gestiune = await repos.gestiuni.create({ cod: 'PROD', denumire: 'Productie' });
  // optiune de material din configurator, legata de produsul PAL.
  const opt = await repos.optiuniMobila.create({
    tip: 'material',
    cod: 'PAL18',
    denumire: 'PAL alb 18',
    produsId: material.id,
    pretPeMpBani: 5000,
  });
  // stoc de deschidere: 100 mp la 30.00/mp => CMP 3000.
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, NULL, 100, 300000, 3000, ?)`,
    [gestiune.id, material.id, NOW],
  );
  return { exec, materialId: material.id, gestiuneId: gestiune.id, optiuneMaterialId: opt.id };
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

async function comandaMobila(fx: Fixture, cfg: Partial<ConfiguratieMobila>): Promise<string> {
  const config: ConfiguratieMobila = {
    latimeMm: 1000,
    inaltimeMm: 2000,
    adancimeMm: 600,
    materialId: fx.optiuneMaterialId,
    finisajId: null,
    accesoriiIds: [],
    stareProductie: 'confirmata',
    costManoperaBani: 15000,
    departamenteFinalizate: [],
    dataMontaj: null,
    curier: '',
    awb: '',
    ...cfg,
  };
  const d: Document = DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'comanda_mobila',
    serie: 'CMD',
    numar: 1,
    cod: 'CMD-1',
    data: '2025-09-10',
    gestiuneId: fx.gestiuneId,
    stare: 'validat', // comanda postata (imutabila)
    meta: JSON.stringify(config),
  });
  await withExecutor(fx.exec).documente.create(d);
  return d.id;
}

describe('P14 — pornirea productiei genereaza consum real de materiale (atomic)', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('confirmata -> in_productie posteaza un bon de consum care descarca stocul la CMP', async () => {
    const comandaId = await comandaMobila(fx, {});
    // suprafata listaDebitare pentru 1000x2000x600 => consum de PAL (mp).
    const rez = await pornesteProductie(deps(fx), comandaId, {});

    expect(rez.productie.stareProductie).toBe('in_productie');
    expect(rez.bonConsumId).not.toBeNull();
    expect(rez.costMaterialeBani).toBeGreaterThan(0); // cost real din CMP

    // Stocul de PAL a scazut fata de cele 100 mp initiale.
    const sold = await citesteBalantaStoc(fx.exec, fx.gestiuneId, fx.materialId);
    expect(sold!.cantitate).toBeLessThan(100);

    // S-a scris o nota contabila de consum (cont 601 = costul materialelor).
    const [n] = await fx.exec.select<{ c: number }>(
      "SELECT COALESCE(SUM(debit_bani),0) AS c FROM journal_lines WHERE cont = '601'",
    );
    expect(Number(n!.c)).toBe(rez.costMaterialeBani);
  });

  it('trasabilitate: randul de productie leaga bonul de consum', async () => {
    const comandaId = await comandaMobila(fx, {});
    const rez = await pornesteProductie(deps(fx), comandaId, {});
    const p = await getProductieMobila(fx.exec, comandaId);
    expect(p?.bonConsumId).toBe(rez.bonConsumId);
    expect(p?.costManoperaBani).toBe(15000); // preluat din configuratie
  });

  it('nu se poate porni productia dintr-o stare gresita (oferta)', async () => {
    const comandaId = await comandaMobila(fx, { stareProductie: 'oferta' });
    await expect(pornesteProductie(deps(fx), comandaId, {})).rejects.toBeInstanceOf(
      TranzitieProductieNepermisaError,
    );
  });

  it('avanseazaProductie respecta masina de stari', async () => {
    const comandaId = await comandaMobila(fx, {});
    await pornesteProductie(deps(fx), comandaId, {});
    const fin = await avanseazaProductie(deps(fx), comandaId, 'finalizata');
    expect(fin.stareProductie).toBe('finalizata');
    await expect(avanseazaProductie(deps(fx), comandaId, 'facturata')).rejects.toBeInstanceOf(
      TranzitieProductieNepermisaError,
    );
  });
});
