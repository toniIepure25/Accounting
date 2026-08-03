-- Reguli de validare pentru configuratorul Mobila: un profil de dimensiuni
-- min/max (se asteapta un singur rand activ — UI-ul editeaza randul existent
-- in loc sa permita mai multe) + o lista de combinatii material x finisaj
-- interzise.

CREATE TABLE IF NOT EXISTS profil_configurator (
  id                TEXT PRIMARY KEY,
  latime_min_mm     INTEGER,
  latime_max_mm     INTEGER,
  inaltime_min_mm   INTEGER,
  inaltime_max_mm   INTEGER,
  adancime_min_mm   INTEGER,
  adancime_max_mm   INTEGER
);

CREATE TABLE IF NOT EXISTS combinatii_interzise (
  id           TEXT PRIMARY KEY,
  material_id  TEXT NOT NULL REFERENCES optiuni_configurator(id),
  finisaj_id   TEXT NOT NULL REFERENCES optiuni_configurator(id)
);
