import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type SqlExecutor, migrate } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FisierBackupInvalidError,
  citesteFisierBackup,
  faBackup,
  restaureaza,
  verificaFisier,
} from './backup-cli.js';
import { incarcaMigratii } from './db.js';

const gunoi: string[] = [];
function temp(sufix: string): string {
  const p = join(tmpdir(), `gr-backup-${crypto.randomUUID()}${sufix}`);
  gunoi.push(p);
  return p;
}
afterEach(() => {
  for (const p of gunoi.splice(0)) {
    try {
      rmSync(p, { force: true });
    } catch {}
  }
});

/** Creeaza un fisier SQLite migrat cu un document + jurnal ECHILIBRAT. */
async function bazaSursa(): Promise<{ cale: string; exec: SqlExecutor }> {
  const cale = temp('.sqlite');
  const exec = fromBetterSqlite(new Database(cale));
  await migrate(exec, incarcaMigratii());
  const gestiuneId = crypto.randomUUID();
  const docId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  await exec.execute('INSERT INTO gestiuni (id, cod, denumire) VALUES (?, ?, ?)', [
    gestiuneId,
    'G',
    'Depozit',
  ]);
  await exec.execute(
    'INSERT INTO documente (id, tip, data, gestiune_id, stare, numar, serie) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [docId, 'factura_vanzare', '2026-02-10', gestiuneId, 'validat', 1, 'FV'],
  );
  await exec.execute(
    'INSERT INTO journal_entries (id, document_id, data, document_cod, explicatie, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [entryId, docId, '2026-02-10', 'FV-1', 'Vanzare', '2026-02-10T00:00:00.000Z'],
  );
  await exec.execute(
    'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), entryId, '4111', 2420, 0],
  );
  await exec.execute(
    'INSERT INTO journal_lines (id, entry_id, cont, debit_bani, credit_bani) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), entryId, '707', 0, 2420],
  );
  return { cale, exec };
}

describe('backup-cli — backup/restore la nivel de fisier (DR)', () => {
  it('backup scrie un fisier probat, cu checksum; restore il reface intr-o baza noua', async () => {
    const { cale } = await bazaSursa();
    const fisier = temp('.json');
    const f = await faBackup(cale, fisier);
    expect(existsSync(fisier)).toBe(true);
    expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(f.snapshot.tabele.journal_lines).toHaveLength(2);

    // Restaurare intr-o baza SQLite complet noua (creata + migrata de CLI).
    const tinta = temp('.sqlite');
    await restaureaza(fisier, tinta);
    const execTinta = fromBetterSqlite(new Database(tinta, { readonly: true }));
    const [d] = await execTinta.select<{ n: number }>('SELECT COUNT(*) AS n FROM documente');
    const [j] = await execTinta.select<{ d: number; c: number }>(
      'SELECT SUM(debit_bani) AS d, SUM(credit_bani) AS c FROM journal_lines',
    );
    expect(Number(d?.n)).toBe(1);
    expect(Number(j?.d)).toBe(Number(j?.c)); // jurnal echilibrat pastrat
  });

  it('verify accepta un fisier bun', async () => {
    const { cale } = await bazaSursa();
    const fisier = temp('.json');
    await faBackup(cale, fisier);
    await expect(verificaFisier(fisier)).resolves.toBeUndefined();
  });

  it('un fisier cu checksum modificat e respins (coruptie detectata)', async () => {
    const { cale } = await bazaSursa();
    const fisier = temp('.json');
    await faBackup(cale, fisier);
    const stricat = citesteFisierBackup(fisier);
    // Alteram continutul fara sa recalculam checksum-ul.
    stricat.snapshot.tabele.gestiuni?.push({ id: 'x', cod: 'HACK', denumire: 'injectat' });
    writeFileSync(fisier, JSON.stringify(stricat));
    expect(() => citesteFisierBackup(fisier)).toThrow(FisierBackupInvalidError);
  });

  it('un fisier cu format necunoscut e respins', async () => {
    const fisier = temp('.json');
    writeFileSync(fisier, JSON.stringify({ ceva: 'altceva' }));
    expect(() => citesteFisierBackup(fisier)).toThrow(FisierBackupInvalidError);
  });
});
