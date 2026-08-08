/**
 * CLI de BACKUP / RESTAURARE la nivel de baza, pentru operatiuni (disaster
 * recovery). Se sprijina pe motorul din @gr/data (`backup-sql.ts`):
 *   - `backup`  : citeste o baza SQLite, o PROBEAZA restaurand-o intr-o baza
 *                 temporara (un backup netestat nu e un backup) si scrie un fisier
 *                 JSON cu suma de control (checksum) SHA-256.
 *   - `restore` : verifica checksum-ul fisierului, apoi restaureaza ATOMIC in baza
 *                 tinta (migrata la aceeasi schema), refuzand un jurnal dezechilibrat.
 *   - `verify`  : verifica un fisier de backup (checksum + proba de restaurare)
 *                 fara sa atinga vreo baza de productie.
 *
 * Vizeaza calea SQLite (desktop/local). Pentru PostgreSQL foloseste pg_dump / PITR
 * (vezi docs/ops/DR_RUNBOOK.md).
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type BackupBaza,
  type SqlExecutor,
  backupVerificat,
  importBazaSql,
  migrate,
} from '@gr/data';
import { fromBetterSqlite } from '@gr/data/node-sqlite';
import Database from 'better-sqlite3';
import { incarcaMigratii } from './db.js';

/** Anvelopa scrisa pe disc: snapshot + suma de control ca sa detectam coruptia. */
export interface FisierBackup {
  format: 'gr-backup';
  versiune: 1;
  checksum: string; // SHA-256 (hex) al snapshot-ului serializat
  snapshot: BackupBaza;
}

/** Suma de control a unui snapshot, deterministica pentru aceeasi versiune de cod. */
export function checksumSnapshot(snapshot: BackupBaza): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

/** Deschide o baza SQLite dintr-un fisier ca executor SQL. */
function deschide(caleBaza: string, readonly = false): SqlExecutor {
  return fromBetterSqlite(new Database(caleBaza, { readonly }));
}

/** Creeaza o baza-scratch in-memory, migrata la schema curenta (pentru probe). */
async function scratchMigrat(): Promise<SqlExecutor> {
  const exec = fromBetterSqlite(new Database(':memory:'));
  await migrate(exec, incarcaMigratii());
  return exec;
}

/**
 * Face un backup PROBAT al bazei SQLite din `caleBaza` si il scrie in `caleIesire`
 * (JSON cu checksum). Arunca daca proba de restaurare esueaza — deci nu scriem
 * niciodata pe disc un backup despre care nu stim ca se restaureaza curat.
 */
export async function faBackup(caleBaza: string, caleIesire: string): Promise<FisierBackup> {
  const exec = deschide(caleBaza, true);
  const snapshot = await backupVerificat(exec, scratchMigrat);
  const fisier: FisierBackup = {
    format: 'gr-backup',
    versiune: 1,
    checksum: checksumSnapshot(snapshot),
    snapshot,
  };
  writeFileSync(caleIesire, JSON.stringify(fisier));
  return fisier;
}

/** Ridicata cand fisierul de backup e corupt (checksum/format gresit). */
export class FisierBackupInvalidError extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = 'FisierBackupInvalidError';
  }
}

/** Citeste + valideaza un fisier de backup (format + checksum). */
export function citesteFisierBackup(caleFisier: string): FisierBackup {
  let parsat: FisierBackup;
  try {
    parsat = JSON.parse(readFileSync(caleFisier, 'utf8')) as FisierBackup;
  } catch (e) {
    throw new FisierBackupInvalidError(`fisier de backup necitibil: ${(e as Error).message}`);
  }
  if (parsat?.format !== 'gr-backup' || !parsat.snapshot) {
    throw new FisierBackupInvalidError('format de fisier necunoscut (nu e un backup gr-backup)');
  }
  const asteptat = checksumSnapshot(parsat.snapshot);
  if (parsat.checksum !== asteptat) {
    throw new FisierBackupInvalidError(
      'checksum invalid — fisierul de backup e corupt sau modificat',
    );
  }
  return parsat;
}

/** Verifica un fisier de backup: checksum + proba de restaurare intr-o baza-scratch. */
export async function verificaFisier(caleFisier: string): Promise<void> {
  const fisier = citesteFisierBackup(caleFisier);
  const scratch = await scratchMigrat();
  await importBazaSql(scratch, fisier.snapshot, { verificaIntegritatea: true });
}

/**
 * Restaureaza un fisier de backup in baza SQLite din `caleBaza` (creata + migrata
 * daca lipseste). Verifica checksum-ul si respinge un jurnal dezechilibrat.
 */
export async function restaureaza(caleFisier: string, caleBaza: string): Promise<void> {
  const fisier = citesteFisierBackup(caleFisier);
  const exec = deschide(caleBaza);
  await migrate(exec, incarcaMigratii()); // asigura schema pe tinta
  await importBazaSql(exec, fisier.snapshot, { verificaIntegritatea: true });
}

const UTILIZARE = `Utilizare:
  backup  <baza.sqlite> <iesire.json>   Fa un backup probat (checksum + proba de restaurare)
  restore <intrare.json> <baza.sqlite>  Restaureaza un backup (verifica checksum + jurnal)
  verify  <intrare.json>                Verifica un fisier de backup fara sa atingi productia`;

export async function main(argv: readonly string[]): Promise<number> {
  const [comanda, a, b] = argv;
  try {
    switch (comanda) {
      case 'backup': {
        if (!a || !b) throw new Error('backup necesita <baza.sqlite> <iesire.json>');
        const f = await faBackup(a, b);
        const total = Object.values(f.snapshot.tabele).reduce((n, r) => n + r.length, 0);
        process.stdout.write(
          `Backup probat OK: ${total} randuri, checksum ${f.checksum.slice(0, 12)}… -> ${b}\n`,
        );
        return 0;
      }
      case 'restore': {
        if (!a || !b) throw new Error('restore necesita <intrare.json> <baza.sqlite>');
        await restaureaza(a, b);
        process.stdout.write(`Restaurare OK din ${a} -> ${b}\n`);
        return 0;
      }
      case 'verify': {
        if (!a) throw new Error('verify necesita <intrare.json>');
        await verificaFisier(a);
        process.stdout.write(`Backup valid: ${a}\n`);
        return 0;
      }
      default:
        process.stderr.write(`${UTILIZARE}\n`);
        return comanda ? 1 : 2;
    }
  } catch (e) {
    process.stderr.write(`Eroare: ${(e as Error).message}\n`);
    return 1;
  }
}

// Ruleaza doar cand e invocat direct (nu la import in teste).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((cod) => process.exit(cod));
}
