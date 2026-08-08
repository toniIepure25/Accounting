# Disaster-recovery runbook — backup & restore

Operational procedure for backing up and restoring an installation. The code this
runbook drives is verified on every push by the **DR drill** CI job
(`.github/workflows/ci.yml` → `dr-drill`), which backs up a seeded database,
restores it into a fresh one, and asserts integrity — so the procedure below is
tested, not aspirational.

> Golden rule: **a backup you have not test-restored is not a backup.** Every
> backup this tooling writes is proven restorable at creation time (`backupVerificat`
> restores into a throwaway database and checks integrity before the file is
> written), and each file carries a SHA-256 checksum so on-disk corruption is caught
> before a restore begins.

## What is protected

The backup is a **full-database** snapshot — every table, including the persisted
engine ledgers that the older provider-level backup silently omitted:

- documents + lines + immutable tax snapshots
- **stock ledger** (`stock_ledger_entries`, `stock_balances`)
- **accounting journal** (`journal_entries`, `journal_lines`)
- **fiscal events** (`fiscal_events`)
- **e-Factura** submissions, **production** state, idempotency keys, nomenclatures

Tables are discovered from the database catalog, so any table added in a future
migration is captured automatically. `_migrations` is excluded — the restore target
is migrated to the matching schema first, then the data is loaded.

## SQLite deployments (desktop / local — the primary path)

Run from the repo root. The CLI lives in `@gr/server` (`npm run backup -w @gr/server -- <args>`).

### Take a backup

```bash
npm run backup -w @gr/server -- backup /path/to/app.sqlite /backups/app-$(date +%F).json
```

This opens the database read-only, proves the snapshot restores cleanly into a
temporary database, and only then writes the checksummed file. A non-zero exit
means the backup was **not** written — investigate before trusting the last good one.

### Verify a backup without touching production

```bash
npm run backup -w @gr/server -- verify /backups/app-2026-08-08.json
```

Checks the checksum and performs a full trial restore into a throwaway database
(including the balanced-journal integrity gate). Run this on a schedule against the
latest backup — a periodically **tested** restore is the difference between a backup
and a false sense of security.

### Restore

1. Stop the application so nothing writes during the restore.
2. Restore into a **new** file first (never overwrite the only copy of live data blind):

   ```bash
   npm run backup -w @gr/server -- restore /backups/app-2026-08-08.json /path/to/restored.sqlite
   ```

   The restore is atomic (single transaction, foreign keys deferred to commit) and
   refuses to complete if the journal does not balance. On any failure it rolls back
   and leaves the target untouched.
3. Sanity-check the restored file (record counts, latest documents, trial balance).
4. Swap it in (rename/point the app at it) and restart.

## Scheduling, encryption, off-site (operational policy — set per deployment)

The tooling produces a proven-restorable file; **rotation and safekeeping are an
operational responsibility** and are not yet automated in-product:

- **Schedule**: daily `backup`, plus a weekly `verify` of the most recent file.
  On desktop, drive it from Task Scheduler (Windows) / cron (Linux/macOS).
- **Encryption at rest**: the JSON snapshot contains business data in clear text —
  encrypt it before it leaves the machine (e.g. `age`, `gpg`, or an encrypted
  volume). Do not commit backups to the repo.
- **Off-site + retention**: keep at least one copy off the primary machine
  (object storage / another disk); apply a retention window (e.g. 30 daily, 12
  monthly). Test-restore at least one off-site copy per cycle.
- **RPO/RTO**: with daily backups the recovery-point objective is ≤24h; tighten by
  running `backup` more often. Recovery-time is minutes (restore + swap).

## PostgreSQL deployments (server / cloud)

The application-level tool targets SQLite. For a PostgreSQL server, use the
database-native mechanisms — they are transactionally consistent and support
point-in-time recovery:

- **Logical backup**: `pg_dump --format=custom gr > gr-$(date +%F).dump` and restore
  with `pg_restore --clean --if-exists -d gr gr-YYYY-MM-DD.dump`.
- **PITR**: enable WAL archiving (`archive_mode`, `archive_command`) + periodic base
  backups (`pg_basebackup`) for recovery to an arbitrary point.
- Run the same integrity spirit afterwards: after a restore, confirm the trial
  balance (Σdebit = Σcredit on `journal_lines`) and stock reconciliation before
  returning the system to service.

A PostgreSQL-native exporter mirroring `backupVerificat` (catalog discovery +
proven restore) is a future enhancement; until then, `pg_dump`/PITR is authoritative
for the server path.

## Related code

- `packages/data/src/backup-sql.ts` — `exportBazaSql`, `importBazaSql`,
  `backupVerificat`, `verificaIntegritateBackup`.
- `server/src/backup-cli.ts` — the `backup` / `restore` / `verify` CLI + checksum.
- `server/scripts/dr-drill.ts` — the CI DR drill exercising the whole procedure.
