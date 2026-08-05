import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Document,
  DocumentImutabilError,
  DocumentInvalidError,
  DocumentLinieSchema,
  DocumentSchema,
  RegulaTvaInexistenta,
  TranzitieNepermisaError,
} from '@gr/core-domain';
import { type Migration, type SqlExecutor, migrate, withExecutor } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { asertaDocumentEditabilPersistat } from './guards.js';
import {
  approveDocument,
  cancelDocument,
  createDraftDocument,
  reverseDocument,
  updateDraftDocument,
} from './lifecycle.js';
import { postDocument } from './post-document.js';
import { citesteSnapshotLinie } from './tax-snapshot.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

const NOW = '2026-01-15T10:00:00.000Z';

interface Fixture {
  exec: SqlExecutor;
  produsId: string;
  partenerId: string;
  gestiuneId: string;
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
  const partener = await repos.parteneri.create({ tip: 'client', denumire: 'Client SRL' });
  const gestiune = await repos.gestiuni.create({ cod: 'G1', denumire: 'Gestiune 1' });
  return { exec, produsId: p.id, partenerId: partener.id, gestiuneId: gestiune.id };
}

function docNou(fx: Fixture, over: Partial<Document> = {}): Document {
  return DocumentSchema.parse({
    id: crypto.randomUUID(),
    tip: 'factura_vanzare',
    data: '2025-09-10', // dupa tranzitia 2025-08-01 => standard 21%
    partenerId: fx.partenerId,
    gestiuneId: fx.gestiuneId,
    stare: 'ciorna',
    ...over,
  });
}

function linieNoua(
  documentId: string,
  produsId: string | null,
  over: Record<string, unknown> = {},
) {
  return DocumentLinieSchema.parse({
    id: crypto.randomUUID(),
    documentId,
    produsId,
    denumire: 'Dulap',
    cantitate: 2,
    pretUnitarBani: 10000, // 100.00
    cotaTvaProcent: 19, // indiciu client GRESIT — postarea trebuie sa-l rezolve la 21
    ...over,
  });
}

const deps = (fx: Fixture) => ({ exec: fx.exec, actor: 'tester', now: () => NOW });

describe('postDocument — postare autoritara, atomica, cu snapshot fiscal', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('posteaza o ciorna: stare postata, cota rezolvata la 21%, totaluri server-side, numar alocat', async () => {
    const d = docNou(fx);
    const l = linieNoua(d.id, fx.produsId);
    await createDraftDocument(deps(fx), { document: d, linii: [l] });

    const rez = await postDocument(deps(fx), d.id);

    expect(rez.document.stare).toBe('validat');
    expect(rez.document.numar).toBe(1);
    expect(rez.document.cod).not.toBe('');
    // Cota autoritara 21% (nu 19% cat trimisese clientul): 200.00 net, 42.00 TVA.
    expect(rez.linii[0]!.cotaTvaProcent).toBe(21);
    expect(rez.document.totalNetBani).toBe(20000);
    expect(rez.document.totalTvaBani).toBe(4200);
    expect(rez.document.totalBrutBani).toBe(24200);

    // Snapshot fiscal imutabil persistat pe linie (P1-R5b).
    const snap = await citesteSnapshotLinie(fx.exec, l.id);
    expect(snap?.tax_rule_id).toBe('ro-standard-21');
    expect(Number(snap?.tax_rule_version)).toBe(1);
    expect(Number(snap?.resolved_tax_rate_bp)).toBe(2100);
    expect(snap?.tax_category).toBe('standard');
    expect(String(snap?.tax_legal_reference)).toContain('141/2025');
  });

  it('rezolva cota ISTORICA pentru o data dinainte de tranzitie (19%)', async () => {
    const d = docNou(fx, { data: '2025-07-15' });
    const l = linieNoua(d.id, fx.produsId, { cotaTvaProcent: 21 });
    await createDraftDocument(deps(fx), { document: d, linii: [l] });

    const rez = await postDocument(deps(fx), d.id);
    expect(rez.linii[0]!.cotaTvaProcent).toBe(19);
    const snap = await citesteSnapshotLinie(fx.exec, l.id);
    expect(snap?.tax_rule_id).toBe('ro-standard-19');
  });

  it('ATOMIC: o linie fara categorie fiscala rezolvabila => rollback, ciorna neatinsa', async () => {
    const prodNecat = await withExecutor(fx.exec).produse.create({
      cod: 'X',
      denumire: 'Necategorizat',
      codCategorieFiscala: 'necategorizat',
    });
    const d = docNou(fx);
    const lOk = linieNoua(d.id, fx.produsId);
    const lRau = linieNoua(d.id, prodNecat.id, { denumire: 'Necategorizat' });
    await createDraftDocument(deps(fx), { document: d, linii: [lOk, lRau] });

    await expect(postDocument(deps(fx), d.id)).rejects.toBeInstanceOf(RegulaTvaInexistenta);

    // Fara stare partiala: documentul e inca ciorna, fara snapshot, fara numar.
    const dupa = await withExecutor(fx.exec).documente.getById(d.id);
    expect(dupa?.stare).toBe('ciorna');
    expect(dupa?.numar).toBe(0);
    expect(await citesteSnapshotLinie(fx.exec, lOk.id)).toMatchObject({ tax_rule_id: null });
    const serii = await fx.exec.select<{ n: number }>('SELECT COUNT(*) AS n FROM serii_documente');
    expect(Number(serii[0]!.n)).toBe(0); // niciun numar alocat
  });

  it('linie fara produs si fara override => DocumentInvalidError (fara cota inventata)', async () => {
    const d = docNou(fx);
    const l = linieNoua(d.id, null);
    await createDraftDocument(deps(fx), { document: d, linii: [l] });
    await expect(postDocument(deps(fx), d.id)).rejects.toBeInstanceOf(DocumentInvalidError);
    expect((await withExecutor(fx.exec).documente.getById(d.id))?.stare).toBe('ciorna');
  });

  it('linie fara produs cu override de categorie => posteaza corect', async () => {
    const d = docNou(fx);
    const l = linieNoua(d.id, null, { denumire: 'Serviciu' });
    await createDraftDocument(deps(fx), { document: d, linii: [l] });
    const rez = await postDocument(deps(fx), d.id, {
      categoriiFiscale: { [l.id]: 'redus_9' },
    });
    expect(rez.linii[0]!.cotaTvaProcent).toBe(11); // redus_9 dupa tranzitie => 11%
  });

  it('respinge postarea unui document invalid (fara linii)', async () => {
    const d = docNou(fx);
    await createDraftDocument(deps(fx), { document: d, linii: [] });
    await expect(postDocument(deps(fx), d.id)).rejects.toBeInstanceOf(DocumentInvalidError);
  });
});

describe('imutabilitate si tranzitii de stare', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  async function postat(): Promise<Document> {
    const d = docNou(fx);
    await createDraftDocument(deps(fx), { document: d, linii: [linieNoua(d.id, fx.produsId)] });
    const rez = await postDocument(deps(fx), d.id);
    return rez.document;
  }

  it('un document nu poate fi postat de doua ori', async () => {
    const d = await postat();
    await expect(postDocument(deps(fx), d.id)).rejects.toBeInstanceOf(TranzitieNepermisaError);
  });

  it('updateDraftDocument refuza un document postat', async () => {
    const d = await postat();
    await expect(
      updateDraftDocument(deps(fx), d.id, { document: { observatii: 'hack' } }),
    ).rejects.toBeInstanceOf(DocumentImutabilError);
  });

  it('garda de imutabilitate blocheaza PATCH/DELETE prin CRUD generic', async () => {
    const d = await postat();
    await expect(
      asertaDocumentEditabilPersistat(withExecutor(fx.exec), d.id, 'delete'),
    ).rejects.toBeInstanceOf(DocumentImutabilError);
  });

  it('approve apoi cancel: ciorna->aprobat, aprobat->anulat', async () => {
    const d = docNou(fx);
    await createDraftDocument(deps(fx), { document: d, linii: [linieNoua(d.id, fx.produsId)] });
    const aprobat = await approveDocument(deps(fx), d.id);
    expect(aprobat.stare).toBe('aprobat');
    const anulat = await cancelDocument(deps(fx), d.id);
    expect(anulat.stare).toBe('anulat');
  });

  it('un document postat nu poate fi anulat (doar stornat)', async () => {
    const d = await postat();
    await expect(cancelDocument(deps(fx), d.id)).rejects.toBeInstanceOf(TranzitieNepermisaError);
  });
});

describe('stornare (reverse) — document postat -> stornat + oglinda legata', () => {
  let fx: Fixture;
  beforeEach(async () => {
    fx = await setup();
  });

  it('storneaza: originalul devine stornat, se creeaza documentul-oglinda negat cu snapshot copiat', async () => {
    const d = docNou(fx);
    const l = linieNoua(d.id, fx.produsId);
    await createDraftDocument(deps(fx), { document: d, linii: [l] });
    await postDocument(deps(fx), d.id);

    const storno = await reverseDocument(deps(fx), d.id, { motiv: 'retur' });

    const original = await withExecutor(fx.exec).documente.getById(d.id);
    expect(original?.stare).toBe('stornat');

    expect(storno.document.stare).toBe('validat');
    expect(storno.document.documentSursaId).toBe(d.id);
    expect(storno.document.totalBrutBani).toBe(-24200);
    expect(storno.linii[0]!.cantitate).toBe(-2);
    expect(storno.linii[0]!.brutBani).toBe(-24200);

    // Snapshot fiscal copiat pe linia de stornare (aceeasi identitate de regula).
    const snap = await citesteSnapshotLinie(fx.exec, storno.linii[0]!.id);
    expect(snap?.tax_rule_id).toBe('ro-standard-21');
  });

  it('un document ne-postat nu poate fi stornat', async () => {
    const d = docNou(fx);
    await createDraftDocument(deps(fx), { document: d, linii: [linieNoua(d.id, fx.produsId)] });
    await expect(reverseDocument(deps(fx), d.id)).rejects.toBeInstanceOf(TranzitieNepermisaError);
  });
});
