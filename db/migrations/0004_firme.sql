-- Nomenclator de firme (persoane juridice). O instalare poate gestiona mai
-- multe firme (multi-firma). Scoparea completa pe firma a documentelor si
-- operatiunilor se adauga la nivel de server intr-o etapa ulterioara.

CREATE TABLE IF NOT EXISTS firme (
  id                TEXT PRIMARY KEY,
  cod               TEXT NOT NULL,
  denumire          TEXT NOT NULL,
  cui               TEXT NOT NULL DEFAULT '',
  registru_comert   TEXT NOT NULL DEFAULT '',
  adresa            TEXT NOT NULL DEFAULT '',
  judet             TEXT NOT NULL DEFAULT '',
  localitate        TEXT NOT NULL DEFAULT '',
  iban              TEXT NOT NULL DEFAULT '',
  banca             TEXT NOT NULL DEFAULT '',
  perioada_blocata_pana_la TEXT,
  activa            INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_firme_cod ON firme(cod);
