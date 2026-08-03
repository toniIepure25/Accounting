-- Jurnal de audit: o inregistrare per mutatie (creare/actualizare/stergere).
-- Scris de stratul de date (vezi packages/data/src/audit-wrapper.ts), citit
-- doar de utilizatori cu permisiunea audit.vizualizare (implicit: admin).

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  timp          TEXT NOT NULL,
  utilizator    TEXT NOT NULL DEFAULT 'necunoscut',
  rol           TEXT NOT NULL DEFAULT '',
  actiune       TEXT NOT NULL,
  entitate      TEXT NOT NULL,
  entitate_id   TEXT NOT NULL DEFAULT '',
  detalii       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_audit_entitate ON audit_log(entitate);
CREATE INDEX IF NOT EXISTS ix_audit_timp ON audit_log(timp);
