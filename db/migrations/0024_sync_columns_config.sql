-- Coloane de sincronizare pe tabelele de configurare (configurator Mobila +
-- retetar bucatarie) — ultimele nomenclatoare sincronizabile fara coloanele de
-- sync. Aceleasi conventii (version/updated_at/deleted_at). Compatibil SQLite si
-- PostgreSQL. `documente`/`documente_linii` raman separate (au deja `version`).

ALTER TABLE optiuni_configurator ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE optiuni_configurator ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE optiuni_configurator ADD COLUMN deleted_at TEXT;

ALTER TABLE profil_configurator ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profil_configurator ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE profil_configurator ADD COLUMN deleted_at TEXT;

ALTER TABLE combinatii_interzise ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE combinatii_interzise ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE combinatii_interzise ADD COLUMN deleted_at TEXT;

ALTER TABLE preparate ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE preparate ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE preparate ADD COLUMN deleted_at TEXT;

ALTER TABLE retete_linii ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE retete_linii ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE retete_linii ADD COLUMN deleted_at TEXT;
