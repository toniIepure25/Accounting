import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromBetterSqlite } from './adapters/better-sqlite.js';
import {
  BackupCorruptError,
  descoperaTabele,
  exportBazaSql,
  importBazaSql,
  verificaIntegritateBackup,
} from './backup-sql.js';
import { type Migration, migrate } from './migrate.js';
import type { SqlExecutor } from './sql-executor.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'db', 'migrations');
function migratii(): Migration[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ id: f.replace(/\.sql$/, ''), sql: readFileSync(join(DIR, f), 'utf8') }));
}

async function bazaGoala(): Promise<SqlExecutor> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, migratii());
  return exec;
}

const NOW = '2026-03-01T08:00:00.000Z';

/**
 * Populeaza o baza cu un caz care ATINGE registrele persistente (stoc, jurnal,
 * fiscal) + un document care se AUTO-REFERENTIAZA (storno → sursa), exact tipul
 * de date pe care backup-ul prin provider le pierde si pe care restaurarea
 * trebuie sa le reproduca fidel.
 */
async function seedRegistre(exec: SqlExecutor): Promise<{ docSursaId: string; stornoId: string }> {
  const gestiuneId = crypto.randomUUID();
  const produsId = crypto.randomUUID();
  const partenerId = crypto.randomUUID();
  const docSursaId = crypto.randomUUID();
  const stornoId = crypto.randomUUID();
  const entryId = crypto.randomUUID();

  await exec.execute('INSERT INTO gestiuni (id, cod, denumire) VALUES (?, ?, ?)', [
    gestiuneId,
    'G',
    'Depozit',
  ]);
  await exec.execute('INSERT INTO produse (id, cod, denumire) VALUES (?, ?, ?)', [
    produsId,
    'P',
    'Marfa',
  ]);
  await exec.execute('INSERT INTO parteneri (id, tip, denumire) VALUES (?, ?, ?)', [
    partenerId,
    'client',
    'Client',
  ]);

  // Document sursa (postat) + storno care il refera prin document_sursa_id.
  await exec.execute(
    'INSERT INTO documente (id, tip, data, partener_id, gestiune_id, stare, numar, serie) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [docSursaId, 'factura_vanzare', '2026-02-10', partenerId, gestiuneId, 'validat', 1, 'FV'],
  );
  await exec.execute(
    'INSERT INTO documente (id, tip, data, gestiune_id, document_sursa_id, stare, numar, serie) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [stornoId, 'storno', '2026-02-11', gestiuneId, docSursaId, 'validat', 2, 'FV'],
  );

  // Registru de stoc + sold materializat.
  await exec.execute(
    `INSERT INTO stock_ledger_entries
       (id, gestiune_id, produs_id, document_id, data, tip_document, cantitate, valoare_bani,
        sold_cantitate_dupa, sold_valoare_bani_dupa, pmp_bani_dupa, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      gestiuneId,
      produsId,
      docSursaId,
      '2026-02-10',
      'factura_vanzare',
      -2,
      -2000,
      8,
      8000,
      1000,
      NOW,
    ],
  );
  await exec.execute(
    `INSERT INTO stock_balances (gestiune_id, produs_id, cantitate, valoare_bani, pmp_bani, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [gestiuneId, produsId, 8, 8000, 1000, NOW],
  );

  // Jurnal ECHILIBRAT (debit == credit).
  await exec.execute(
    'INSERT INTO journal_entries (id, document_id, data, document_cod, explicatie, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [entryId, docSursaId, '2026-02-10', 'FV-1', 'Vanzare marfa', NOW],
  );
  await exec.execute(
    'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), entryId, '4111', 2420, 0],
  );
  await exec.execute(
    'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), entryId, '707', 0, 2000],
  );
  await exec.execute(
    'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), entryId, '4427', 0, 420],
  );

  // Eveniment fiscal (TVA colectata).
  await exec.execute(
    `INSERT INTO fiscal_events (id, document_id, data, directie, cota_procent, baza_bani, tva_bani, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), docSursaId, '2026-02-10', 'colectata', 21, 2000, 420, NOW],
  );

  return { docSursaId, stornoId };
}

/** Normalizeaza un instantaneu pentru comparatie stabila (randuri sortate). */
function normalizeaza(tabele: Record<string, Record<string, unknown>[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [t, randuri] of Object.entries(tabele)) {
    out[t] = randuri.map((r) => JSON.stringify(r)).sort();
  }
  return out;
}

describe('backup-sql — DR complet la nivel de baza (registre incluse)', () => {
  let sursa: SqlExecutor;
  beforeEach(async () => {
    sursa = await bazaGoala();
    await seedRegistre(sursa);
  });

  it('exportul cuprinde registrele persistente pe care backup-ul prin provider le pierde', async () => {
    const snap = await exportBazaSql(sursa);
    // Exact tabelele care NU au Repository si lipsesc din backup.ts.
    expect(snap.tabele.stock_ledger_entries).toHaveLength(1);
    expect(snap.tabele.journal_entries).toHaveLength(1);
    expect(snap.tabele.journal_lines).toHaveLength(3);
    expect(snap.tabele.fiscal_events).toHaveLength(1);
    expect(snap.tabele.stock_balances).toHaveLength(1);
    // `_migrations` nu e date de restaurat.
    expect(snap.tabele._migrations).toBeUndefined();
  });

  it('round-trip intr-o baza NOUA reproduce FIDEL fiecare tabela (byte cu byte)', async () => {
    const snap = await exportBazaSql(sursa);

    const tinta = await bazaGoala();
    const rez = await importBazaSql(tinta, snap);
    expect(rez.randuriRestaurate).toBeGreaterThan(0);

    const reexport = await exportBazaSql(tinta);
    expect(normalizeaza(reexport.tabele)).toEqual(normalizeaza(snap.tabele));
  });

  it('restaureaza auto-referinta documente (storno → sursa) desi FK e activ', async () => {
    const snap = await exportBazaSql(sursa);
    const tinta = await bazaGoala();
    await importBazaSql(tinta, snap);

    const [storno] = await tinta.select<{ document_sursa_id: string }>(
      "SELECT document_sursa_id FROM documente WHERE tip = 'storno'",
    );
    const [sursaDoc] = await tinta.select<{ id: string }>(
      "SELECT id FROM documente WHERE tip = 'factura_vanzare'",
    );
    expect(storno?.document_sursa_id).toBe(sursaDoc?.id);
  });

  it('modul complet STERGE datele preexistente ale tintei inainte de restaurare', async () => {
    const snap = await exportBazaSql(sursa);

    const tinta = await bazaGoala();
    await tinta.execute('INSERT INTO gestiuni (id, cod, denumire) VALUES (?, ?, ?)', [
      crypto.randomUUID(),
      'VECHE',
      'De sters',
    ]);
    await importBazaSql(tinta, snap);

    const gestiuni = await tinta.select<{ cod: string }>('SELECT cod FROM gestiuni');
    expect(gestiuni.map((g) => g.cod)).toEqual(['G']); // ramane doar ce e in backup
  });

  it('verificarea de integritate confirma jurnalul echilibrat dupa restaurare', async () => {
    const snap = await exportBazaSql(sursa);
    const tinta = await bazaGoala();
    await importBazaSql(tinta, snap, { verificaIntegritatea: true });

    const raport = await verificaIntegritateBackup(tinta);
    expect(raport.journalEchilibrat).toBe(true);
    expect(raport.totalDebitBani).toBe(2420);
    expect(raport.totalCreditBani).toBe(2420);
  });

  it('restaurarea unui backup cu jurnal DEZECHILIBRAT e respinsa (rollback)', async () => {
    const snap = await exportBazaSql(sursa);
    // Corupem backup-ul: o linie de credit lipseste => debit != credit.
    snap.tabele.journal_lines = (snap.tabele.journal_lines ?? []).filter(
      (l) => (l as { cont: string }).cont !== '4427',
    );

    const tinta = await bazaGoala();
    await expect(importBazaSql(tinta, snap, { verificaIntegritatea: true })).rejects.toBeInstanceOf(
      BackupCorruptError,
    );
    // Rollback: baza tinta a ramas goala, nu partial-restaurata.
    const [d] = await tinta.select<{ n: number }>('SELECT COUNT(*) AS n FROM documente');
    expect(Number(d?.n)).toBe(0);
  });

  it('descoperaTabele exclude tabelele interne si `_migrations`', async () => {
    const tabele = await descoperaTabele(sursa);
    expect(tabele).not.toContain('_migrations');
    expect(tabele.some((t) => t.startsWith('sqlite_'))).toBe(false);
    expect(tabele).toContain('stock_ledger_entries');
    expect(tabele).toContain('journal_lines');
  });
});
