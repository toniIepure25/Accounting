-- Operatiuni bancare importate din extras (CSV) + reconciliere cu registrul de casa.

CREATE TABLE IF NOT EXISTS operatiuni_bancare (
  id                  TEXT PRIMARY KEY,
  data                TEXT NOT NULL,
  suma_bani           INTEGER NOT NULL DEFAULT 0,
  referinta           TEXT NOT NULL DEFAULT '',
  partener_id         TEXT REFERENCES parteneri(id),
  reconciliata        INTEGER NOT NULL DEFAULT 0,
  operatiune_casa_id  TEXT
);
CREATE INDEX IF NOT EXISTS ix_operatiuni_bancare_data ON operatiuni_bancare(data);
