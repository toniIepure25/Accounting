-- Schema initiala. Compatibila SQLite (local) si PostgreSQL (retea/cloud).
-- Conventii:
--   id           TEXT (UUID)
--   sume in bani INTEGER (unitati minore)
--   boolean      INTEGER 0/1
--   timp         TEXT (ISO 8601)
-- Coloanele de sincronizare (updated_at, version, deleted_at) exista pe toate
-- tabelele de date pentru motorul de sync offline-first (Faza 4).

CREATE TABLE IF NOT EXISTS puncte_lucru (
  id          TEXT PRIMARY KEY,
  cod         TEXT NOT NULL,
  denumire    TEXT NOT NULL,
  adresa      TEXT NOT NULL DEFAULT '',
  activ       INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT '',
  version     INTEGER NOT NULL DEFAULT 1,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS gestiuni (
  id                TEXT PRIMARY KEY,
  cod               TEXT NOT NULL,
  denumire          TEXT NOT NULL,
  gestionar         TEXT NOT NULL DEFAULT '',
  cont_sintetic     TEXT NOT NULL DEFAULT '',
  cont_analitic     TEXT NOT NULL DEFAULT '',
  tip               TEXT NOT NULL DEFAULT 'cantitativ_valorica',
  punct_de_lucru_id TEXT REFERENCES puncte_lucru(id),
  activ             INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT NOT NULL DEFAULT '',
  version           INTEGER NOT NULL DEFAULT 1,
  deleted_at        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_gestiuni_cod ON gestiuni(cod);

CREATE TABLE IF NOT EXISTS parteneri (
  id                TEXT PRIMARY KEY,
  tip               TEXT NOT NULL,
  denumire          TEXT NOT NULL,
  cui               TEXT,
  cnp               TEXT,
  registru_comert   TEXT,
  adresa            TEXT NOT NULL DEFAULT '',
  judet             TEXT NOT NULL DEFAULT '',
  localitate        TEXT NOT NULL DEFAULT '',
  tara              TEXT NOT NULL DEFAULT 'RO',
  cod_tva_intracomunitar TEXT,
  iban              TEXT,
  banca             TEXT NOT NULL DEFAULT '',
  telefon           TEXT NOT NULL DEFAULT '',
  email             TEXT,
  platitor_tva      INTEGER NOT NULL DEFAULT 1,
  activ             INTEGER NOT NULL DEFAULT 1,
  updated_at        TEXT NOT NULL DEFAULT '',
  version           INTEGER NOT NULL DEFAULT 1,
  deleted_at        TEXT
);
CREATE INDEX IF NOT EXISTS ix_parteneri_cui ON parteneri(cui);

CREATE TABLE IF NOT EXISTS unitati_masura (
  cod         TEXT PRIMARY KEY,
  denumire    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cote_tva (
  procent     INTEGER PRIMARY KEY,
  denumire    TEXT NOT NULL,
  implicita   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS grupe_produse (
  id          TEXT PRIMARY KEY,
  cod         TEXT NOT NULL,
  denumire    TEXT NOT NULL,
  parinte_id  TEXT REFERENCES grupe_produse(id)
);

CREATE TABLE IF NOT EXISTS produse (
  id                  TEXT PRIMARY KEY,
  cod                 TEXT NOT NULL,
  denumire            TEXT NOT NULL,
  tip                 TEXT NOT NULL DEFAULT 'marfa',
  unitate_masura      TEXT NOT NULL DEFAULT 'buc',
  cota_tva_procent    INTEGER NOT NULL DEFAULT 19,
  grupa_id            TEXT REFERENCES grupe_produse(id),
  pret_vanzare_bani   INTEGER NOT NULL DEFAULT 0,
  stoc_minim          REAL NOT NULL DEFAULT 0,
  cod_bare            TEXT,
  activ               INTEGER NOT NULL DEFAULT 1,
  updated_at          TEXT NOT NULL DEFAULT '',
  version             INTEGER NOT NULL DEFAULT 1,
  deleted_at          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_produse_cod ON produse(cod);

CREATE TABLE IF NOT EXISTS plan_conturi (
  id          TEXT PRIMARY KEY,
  simbol      TEXT NOT NULL,
  denumire    TEXT NOT NULL,
  clasa       INTEGER NOT NULL,
  tip         TEXT NOT NULL DEFAULT 'sintetic'
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_plan_conturi_simbol ON plan_conturi(simbol);

CREATE TABLE IF NOT EXISTS serii_documente (
  id                TEXT PRIMARY KEY,
  tip_document      TEXT NOT NULL,
  prefix            TEXT NOT NULL,
  an                INTEGER NOT NULL,
  ultimul_numar     INTEGER NOT NULL DEFAULT 0,
  lungime_numar     INTEGER NOT NULL DEFAULT 6,
  punct_de_lucru_id TEXT REFERENCES puncte_lucru(id)
);

CREATE TABLE IF NOT EXISTS setari_firma (
  cheie       TEXT PRIMARY KEY,
  valoare     TEXT NOT NULL
);
