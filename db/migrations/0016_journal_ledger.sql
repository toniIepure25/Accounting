-- Phase 6: registru-jurnal contabil PERSISTENT si append-only (partida dubla).
--
-- Pana acum notele contabile se RECALCULAU la cerere din documente
-- (core-domain/contabilitate.ts genereazaNoteContabile + paginile Contabilitate).
-- Acum postarea unui document scrie notele in acest registru, in ACEEASI
-- tranzactie cu documentul + registrul de stoc, deci contabilitatea si stocul
-- sunt mereu coerente si auditabile. Fiecare nota este ECHILIBRATA
-- (suma debit = suma credit).

CREATE TABLE IF NOT EXISTS journal_entries (
  id           TEXT PRIMARY KEY,
  firma_id     TEXT,
  document_id  TEXT REFERENCES documente(id),
  data         TEXT NOT NULL,
  document_cod TEXT NOT NULL,
  explicatie   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_journal_entries_doc ON journal_entries (document_id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_data ON journal_entries (data);

CREATE TABLE IF NOT EXISTS journal_lines (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT NOT NULL REFERENCES journal_entries(id),
  cont        TEXT NOT NULL,
  debit_bani  INTEGER NOT NULL DEFAULT 0,
  credit_bani INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_journal_lines_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS ix_journal_lines_cont ON journal_lines (cont);
