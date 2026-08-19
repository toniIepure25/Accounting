-- Coloanele de sincronizare (version / updated_at / deleted_at) pe tabelele de
-- date MASTER care nu le aveau inca — necesare pentru versionarea entitatilor
-- (offline-first, reconciliere; vezi core-domain `campuriSync` + repository-ul
-- generic care le stampileaza). Compatibil SQLite si PostgreSQL.
--
-- NU primesc aceste coloane: registrele (journal/stock/fiscal — generate de
-- comenzi, nu se sincronizeaza ca date), tabelele de referinta/interne
-- (cote_tva, unitati_masura, serii_documente, tax_rules, idempotency_keys,
-- audit_log) si `documente`/`documente_linii` (au deja `version` pentru blocarea
-- optimista — se trateaza separat).

ALTER TABLE firme ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE firme ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE firme ADD COLUMN deleted_at TEXT;

ALTER TABLE grupe_produse ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE grupe_produse ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE grupe_produse ADD COLUMN deleted_at TEXT;

ALTER TABLE plan_conturi ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plan_conturi ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE plan_conturi ADD COLUMN deleted_at TEXT;

ALTER TABLE personal ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE personal ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE personal ADD COLUMN deleted_at TEXT;

ALTER TABLE liste_preturi ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE liste_preturi ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE liste_preturi ADD COLUMN deleted_at TEXT;

ALTER TABLE tip_consum ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tip_consum ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE tip_consum ADD COLUMN deleted_at TEXT;

ALTER TABLE obiecte_inventar ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE obiecte_inventar ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE obiecte_inventar ADD COLUMN deleted_at TEXT;
