-- Coloane de sincronizare pe tabelele OPERATIONALE scopate pe firma
-- (operatiuni de casa/banca, mijloace fixe) — continuarea versionarii entitatilor
-- din 0022. Aceleasi conventii (version/updated_at/deleted_at). Compatibil
-- SQLite si PostgreSQL. Registrele generate de comenzi raman excluse.

ALTER TABLE operatiuni_casa ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE operatiuni_casa ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE operatiuni_casa ADD COLUMN deleted_at TEXT;

ALTER TABLE operatiuni_bancare ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE operatiuni_bancare ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE operatiuni_bancare ADD COLUMN deleted_at TEXT;

ALTER TABLE mijloace_fixe ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mijloace_fixe ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE mijloace_fixe ADD COLUMN deleted_at TEXT;
