-- Registru de mijloace fixe (active imobilizate) + amortizare.

CREATE TABLE IF NOT EXISTS mijloace_fixe (
  id                        TEXT PRIMARY KEY,
  cod                       TEXT NOT NULL,
  denumire                  TEXT NOT NULL,
  categorie                 TEXT NOT NULL DEFAULT '',
  valoare_intrare_bani      INTEGER NOT NULL DEFAULT 0,
  data_punere_functiune     TEXT NOT NULL,
  durata_normala_luni       INTEGER NOT NULL DEFAULT 60,
  metoda_amortizare         TEXT NOT NULL DEFAULT 'liniara',
  coeficient_degresiv       REAL NOT NULL DEFAULT 1,
  amortizare_cumulata_bani  INTEGER NOT NULL DEFAULT 0,
  gestiune_id               TEXT REFERENCES gestiuni(id),
  activ                     INTEGER NOT NULL DEFAULT 1,
  casat                     INTEGER NOT NULL DEFAULT 0,
  data_casare               TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mijloace_fixe_cod ON mijloace_fixe(cod);
