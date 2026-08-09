import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Document, DocumentLinieSchema, DocumentSchema } from '@gr/core-domain';
import { type Migration, type SqlExecutor, migrate, withExecutor } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { genereazaD390, genereazaD394 } from './declaratii.js';
import { genereazaDecontDinRegistre } from './fiscal.js';
import { createDraftDocument } from './lifecycle.js';
import { PerioadaInchisaError } from './perioada.js';
import { postDocument } from './post-document.js';
import { genereazaSaftDinRegistre } from './saft.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-02-20T09:00:00.000Z';

interface Firma {
  id: string;
  partenerId: string;
  g: string;
}
interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  a: Firma;
  b: Firma;
}

async function firma(exec: SqlExecutor, cod: string, produsId: string): Promise<Firma> {
  const repos = withExecutor(exec);
  const f = await repos.firme.create({ cod, denumire: `Firma ${cod}`, cui: `RO${cod}0000` });
  const partener = await repos.parteneri.create({ tip: 'ambele', denumire: `Partener ${cod}` });
  const g = await repos.gestiuni.create({ cod: `G-${cod}`, denumire: `Depozit ${cod}` });
  // stoc de deschidere pt. vanzari
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, firma_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, ?, 1000, 1000000, 1000, ?)`,
    [g.id, produsId, f.id, NOW],
  );
  return { id: f.id, partenerId: partener.id, g: g.id };
}

async function setup(): Promise<Fixture> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  const produs = await withExecutor(exec).produse.create({
    cod: 'DULAP',
    denumire: 'Dulap',
    codCategorieFiscala: 'standard',
  });
  return {
    exec,
    produsId: produs.id,
    a: await firma(exec, 'A', produs.id),
    b: await firma(exec, 'B', produs.id),
  };
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

async function posteaza(
  fx: Fixture,
  f: Firma,
  over: Partial<Document>,
  cant: number,
  pret: number,
) {
  const d = DocumentSchema.parse({
    id: crypto.randomUUID(),
    firmaId: f.id,
    tip: 'receptie_furnizor',
    serie: 'NIR',
    data: '2025-09-10',
    partenerId: f.partenerId,
    gestiuneId: f.g,
    stare: 'ciorna',
    ...over,
  });
  const l = DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId: d.id,
    produsId: fx.produsId,
    denumire: 'Dulap',
    cantitate: cant,
    pretUnitarBani: pret,
    cotaTvaProcent: 21,
  });
  await createDraftDocument(deps(fx), { document: d, linii: [l] });
  return postDocument(deps(fx), d.id);
}

describe('P10 — scopare multi-firma + inchidere de perioada per firma', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('decontul unei firme NU include faptele fiscale ale altei firme', async () => {
    await posteaza(fx, fx.a, { serie: 'NIR' }, 10, 1000); // firma A: deductibil 2100
    await posteaza(fx, fx.b, { serie: 'NIR' }, 5, 1000); // firma B: deductibil 1050

    const decontA = await genereazaDecontDinRegistre(deps(fx), { firmaId: fx.a.id });
    const decontB = await genereazaDecontDinRegistre(deps(fx), { firmaId: fx.b.id });
    expect(decontA.tvaDeductibilaBani).toBe(2100);
    expect(decontB.tvaDeductibilaBani).toBe(1050);
  });

  it('SAF-T-ul unei firme reflecta doar jurnalul acelei firme', async () => {
    await posteaza(fx, fx.a, { serie: 'NIR' }, 10, 1000); // A: 401 credit 12100
    await posteaza(fx, fx.b, { serie: 'NIR' }, 5, 1000); // B: 401 credit 6050

    const saftA = await genereazaSaftDinRegistre(deps(fx), {
      companie: { nume: 'A', cui: 'RO1', perioadaLuna: 9, perioadaAn: 2025 },
      firmaId: fx.a.id,
    });
    // Doar rulajele firmei A (net 10000 + TVA 2100 = 12100 pe fiecare parte).
    expect(saftA.reconciliere.totalCreditBani).toBe(12100);
    expect(saftA.reconciliere.echilibrat).toBe(true);
  });

  it('inchiderea de perioada a firmei A NU blocheaza firma B', async () => {
    await withExecutor(fx.exec).firme.update(fx.a.id, { perioadaBlocataPanaLa: '2025-12-31' });

    // Firma A: postare in perioada inchisa => respinsa.
    const dA = DocumentSchema.parse({
      id: crypto.randomUUID(),
      firmaId: fx.a.id,
      tip: 'receptie_furnizor',
      serie: 'NIR',
      data: '2025-09-10',
      partenerId: fx.a.partenerId,
      gestiuneId: fx.a.g,
      stare: 'ciorna',
    });
    await createDraftDocument(deps(fx), {
      document: dA,
      linii: [
        DocumentLinieSchema.parse({
          id: crypto.randomUUID(),
          documentId: dA.id,
          produsId: fx.produsId,
          denumire: 'Dulap',
          cantitate: 1,
          pretUnitarBani: 1000,
          cotaTvaProcent: 21,
        }),
      ],
    });
    await expect(postDocument(deps(fx), dA.id)).rejects.toBeInstanceOf(PerioadaInchisaError);

    // Firma B (fara inchidere) posteaza normal in aceeasi perioada.
    const rezB = await posteaza(fx, fx.b, { serie: 'NIR' }, 1, 1000);
    expect(rezB.document.stare).toBe('validat');
  });

  it('D394 al unei firme NU include documentele altei firme', async () => {
    await posteaza(fx, fx.a, { serie: 'NIR' }, 10, 1000); // A: achizitie de la partenerul A
    await posteaza(fx, fx.b, { serie: 'NIR' }, 5, 1000); // B: achizitie de la partenerul B

    const d394A = await genereazaD394(deps(fx), { firmaId: fx.a.id });
    expect(d394A.achizitii).toHaveLength(1);
    expect(d394A.achizitii[0]!.partenerId).toBe(fx.a.partenerId);
    expect(d394A.achizitii[0]!.bazaBani).toBe(10000);
    // Partenerul firmei B nu apare in D394-ul firmei A.
    expect(d394A.achizitii.some((r) => r.partenerId === fx.b.partenerId)).toBe(false);
  });

  it('D390 (VIES) grupeaza doar partenerii intracomunitari ai firmei', async () => {
    // Partener din alt stat UE, achizitie postata pentru firma A.
    const ueDe = await withExecutor(fx.exec).parteneri.create({
      tip: 'furnizor',
      denumire: 'Möbel DE GmbH',
      tara: 'DE',
      codTvaIntracomunitar: 'DE811111111',
    });
    await posteaza(fx, fx.a, { serie: 'NIR', partenerId: ueDe.id }, 4, 1000); // intracom
    await posteaza(fx, fx.a, { serie: 'NIR' }, 3, 1000); // partener RO -> nu in D390

    const d390A = await genereazaD390(deps(fx), { firmaId: fx.a.id });
    expect(d390A.randuri).toHaveLength(1);
    expect(d390A.randuri[0]!.tara).toBe('DE');
    expect(d390A.randuri[0]!.operatiune).toBe('achizitie');
    expect(d390A.randuri[0]!.bazaBani).toBe(4000);
    // Firma B nu are operatiuni intracomunitare.
    const d390B = await genereazaD390(deps(fx), { firmaId: fx.b.id });
    expect(d390B.randuri).toEqual([]);
  });
});
