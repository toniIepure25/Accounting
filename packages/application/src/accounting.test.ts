import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONT, type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import {
  type Migration,
  type SqlExecutor,
  listeazaLiniiJurnal,
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

const NOW = '2026-02-12T09:00:00.000Z';

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

/** Suma pe un cont din journal_lines. */
async function soldCont(exec: SqlExecutor, cont: string): Promise<{ d: number; c: number }> {
  const [r] = await exec.select<{ d: number; c: number }>(
    'SELECT COALESCE(SUM(debit_bani),0) AS d, COALESCE(SUM(credit_bani),0) AS c FROM journal_lines WHERE cont = ?',
    [cont],
  );
  return { d: Number(r!.d), c: Number(r!.c) };
}

describe('P6 — registru-jurnal contabil emis atomic la postare', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('achizitia scrie o nota echilibrata (371+4426=401)', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000); // net 10000, TVA 21%
    const linii = await listeazaLiniiJurnal(fx.exec);
    const totalD = linii.reduce((s, p) => s + Number(p.debitBani), 0);
    const totalC = linii.reduce((s, p) => s + Number(p.creditBani), 0);
    expect(totalD).toBe(totalC); // echilibrata
    expect((await soldCont(fx.exec, CONT.FURNIZORI)).c).toBe(12100); // brut = 10000 + 21%
  });

  it('vanzarea scrie venit + TVA colectata + descarcare de gestiune la CMP', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000); // CMP 1000
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000); // vinde 4

    // COGS = 4 * 1000 = 4000 pe 607 (D) si 371 (C).
    expect((await soldCont(fx.exec, CONT.CHELT_MARFURI)).d).toBe(4000);
    expect((await soldCont(fx.exec, CONT.VENITURI_MARFA)).c).toBe(20000); // 4 * 50.00 net

    const linii = await listeazaLiniiJurnal(fx.exec);
    const totalD = linii.reduce((s, p) => s + Number(p.debitBani), 0);
    const totalC = linii.reduce((s, p) => s + Number(p.creditBani), 0);
    expect(totalD).toBe(totalC);
  });

  it('ATOMIC: daca postarea esueaza (stoc insuficient), nu ramane nicio nota', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 2, 1000);
    const vd = docNou(fx, { tip: 'factura_vanzare', serie: 'FV' });
    await createDraftDocument(deps(fx), {
      document: vd,
      linii: [linie(vd.id, fx.produsId, 5, 5000)],
    });
    await expect(postDocument(deps(fx), vd.id)).rejects.toBeTruthy();

    // Nota de vanzare NU a fost scrisa (o singura nota, cea de achizitie).
    const entries = await fx.exec.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM journal_entries',
    );
    expect(Number(entries[0]!.n)).toBe(1);
  });

  it('factura de cumparare legata de NIR postat nu genereaza a doua nota de achizitie', async () => {
    const nir = await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
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

    // Doar nota NIR-ului (o singura nota de achizitie), factura nu adauga a doua.
    const entries = await fx.exec.select<{ n: number }>(
      'SELECT COUNT(*) AS n FROM journal_entries',
    );
    expect(Number(entries[0]!.n)).toBe(1);
  });

  it('stornarea aduce jurnalul la zero (debit=credit pe fiecare cont net)', async () => {
    const rec = await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await reverseDocument(deps(fx), rec.document.id);

    // Dupa stornare, pentru fiecare cont debit total = credit total (net zero).
    const linii = await listeazaLiniiJurnal(fx.exec);
    const perCont = new Map<string, number>();
    for (const p of linii) {
      perCont.set(p.cont, (perCont.get(p.cont) ?? 0) + Number(p.debitBani) - Number(p.creditBani));
    }
    for (const net of perCont.values()) expect(net).toBe(0);
  });

  it('stoc <-> contabilitate reconciliaza: descarcarea 371 = costul iesirii din stoc', async () => {
    await posteaza(fx, { tip: 'receptie_furnizor', serie: 'NIR' }, 10, 1000);
    await posteaza(fx, { tip: 'factura_vanzare', serie: 'FV' }, 4, 5000);

    const cont371 = await soldCont(fx.exec, CONT.MARFURI); // achizitie 10000 D, descarcare 4000 C
    const stoc371 = cont371.d - cont371.c; // sold contabil marfa
    const [balanta] = await fx.exec.select<{ v: number }>(
      'SELECT COALESCE(SUM(valoare_bani),0) AS v FROM stock_balances',
    );
    expect(stoc371).toBe(Number(balanta!.v)); // 6000 = valoarea stocului ramas
  });
});
