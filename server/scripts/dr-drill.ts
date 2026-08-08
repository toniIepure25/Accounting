/**
 * Exercitiu de disaster-recovery, rulat in CI (vezi .github/workflows/ci.yml).
 *
 * PROBEAZA procedura reala, nu doar functii izolate: creeaza o baza SQLite pe
 * disc cu date postate (document + jurnal echilibrat), o salveaza prin CLI-ul de
 * backup (backup probat + checksum), o RESTAUREAZA intr-o baza complet noua si
 * verifica ca datele + integritatea au supravietuit. Iese cu cod != 0 la orice
 * abatere — deci un regres in calea de backup/restaurare pica build-ul.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { faBackup, restaureaza, verificaFisier } from '../src/backup-cli.js';
import { incarcaMigratii } from '../src/db.js';

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'gr-dr-'));
  const sursa = join(dir, 'productie.sqlite');
  const fisier = join(dir, 'backup.json');
  const restaurat = join(dir, 'restaurat.sqlite');

  try {
    // 1. Baza "de productie" cu date postate.
    const exec = fromBetterSqlite(new Database(sursa));
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

    // 2. Backup probat + 3. verificare fisier + 4. restaurare in baza noua.
    await faBackup(sursa, fisier);
    await verificaFisier(fisier);
    await restaureaza(fisier, restaurat);

    // 5. Asertiuni pe baza restaurata.
    const tinta = fromBetterSqlite(new Database(restaurat, { readonly: true }));
    const [d] = await tinta.select<{ n: number }>('SELECT COUNT(*) AS n FROM documente');
    const [j] = await tinta.select<{ d: number; c: number }>(
      'SELECT SUM(debit_bani) AS d, SUM(credit_bani) AS c FROM journal_lines',
    );
    if (Number(d?.n) !== 1) throw new Error(`documente asteptate 1, gasit ${d?.n}`);
    if (Number(j?.d) !== Number(j?.c))
      throw new Error(`jurnal dezechilibrat dupa restaurare: ${j?.d} != ${j?.c}`);
    if (Number(j?.d) !== 2420) throw new Error(`total jurnal asteptat 2420, gasit ${j?.d}`);

    process.stdout.write(
      'Exercitiu DR OK: backup -> verificare -> restaurare, integritate pastrata.\n',
    );
  } finally {
    // Curatarea nu trebuie sa pice drill-ul (pe Windows fisierele SQLite pot fi
    // inca blocate); pe CI (Linux) unlink-ul reuseste oricum.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((e) => {
  process.stderr.write(`Exercitiu DR ESUAT: ${(e as Error).message}\n`);
  process.exit(1);
});
