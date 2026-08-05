-- Phase 3: elimina ULTIMUL UNSAFE_RUNTIME_DEFAULT de TVA din schema — coloana
-- `produse.cota_tva_procent INTEGER NOT NULL DEFAULT 19`. Dupa Faza 1 cota
-- autoritara se rezolva din `cod_categorie_fiscala` + data documentului, iar
-- schema de domeniu (ProdusSchema) marcheaza `cotaTvaProcent` drept indiciu
-- LEGACY nullable. Coloana din DB trebuie sa permita NULL, altfel orice produs
-- nou inserat prin repository (care scrie NULL) ar fi respins — sau ar reprimi
-- tacit 19% prin default, exact defectul pe care Faza 1 l-a eliminat.
--
-- SQLite nu suporta ALTER COLUMN DROP NOT NULL/DROP DEFAULT, deci reconstruim
-- tabela (reteta oficiala SQLite). Migratiile nu ruleaza cu foreign_keys ON in
-- acest runner, iar tabelele care referentiaza `produse` o fac prin NUME — dupa
-- RENAME numele revine, deci referintele raman valide.
--
-- Echivalentul PostgreSQL (cand migratiile vor rula pe PG) e mai simplu si nu
-- necesita reconstructie:
--   ALTER TABLE produse ALTER COLUMN cota_tva_procent DROP NOT NULL;
--   ALTER TABLE produse ALTER COLUMN cota_tva_procent DROP DEFAULT;

CREATE TABLE produse_nou (
  id                    TEXT PRIMARY KEY,
  cod                   TEXT NOT NULL,
  denumire              TEXT NOT NULL,
  tip                   TEXT NOT NULL DEFAULT 'marfa',
  unitate_masura        TEXT NOT NULL DEFAULT 'buc',
  -- indiciu legacy: nullable, FARA default (nicio cota tacita).
  cota_tva_procent      INTEGER,
  cod_categorie_fiscala TEXT,
  grupa_id              TEXT REFERENCES grupe_produse(id),
  pret_vanzare_bani     INTEGER NOT NULL DEFAULT 0,
  stoc_minim            REAL NOT NULL DEFAULT 0,
  cod_bare              TEXT,
  activ                 INTEGER NOT NULL DEFAULT 1,
  updated_at            TEXT NOT NULL DEFAULT '',
  version               INTEGER NOT NULL DEFAULT 1,
  deleted_at            TEXT
);

INSERT INTO produse_nou
  (id, cod, denumire, tip, unitate_masura, cota_tva_procent, cod_categorie_fiscala,
   grupa_id, pret_vanzare_bani, stoc_minim, cod_bare, activ, updated_at, version, deleted_at)
  SELECT
    id, cod, denumire, tip, unitate_masura, cota_tva_procent, cod_categorie_fiscala,
    grupa_id, pret_vanzare_bani, stoc_minim, cod_bare, activ, updated_at, version, deleted_at
  FROM produse;

DROP TABLE produse;
ALTER TABLE produse_nou RENAME TO produse;
CREATE UNIQUE INDEX IF NOT EXISTS ux_produse_cod ON produse(cod);
