-- Tabele operationale: documente, casa, nomenclatoare suplimentare, modul Mobila.
-- Numele coloanelor = camelCase-ul din entitati transformat in snake_case
-- (folosit de factory-ul SQL generic din packages/data).

CREATE TABLE IF NOT EXISTS documente (
  id                     TEXT PRIMARY KEY,
  tip                    TEXT NOT NULL,
  serie                  TEXT NOT NULL DEFAULT '',
  numar                  INTEGER NOT NULL DEFAULT 0,
  cod                    TEXT NOT NULL DEFAULT '',
  data                   TEXT NOT NULL,
  partener_id            TEXT REFERENCES parteneri(id),
  gestiune_id            TEXT REFERENCES gestiuni(id),
  gestiune_destinatie_id TEXT REFERENCES gestiuni(id),
  punct_de_lucru_id      TEXT REFERENCES puncte_lucru(id),
  document_sursa_id      TEXT REFERENCES documente(id),
  scadenta               TEXT,
  observatii             TEXT NOT NULL DEFAULT '',
  stare                  TEXT NOT NULL DEFAULT 'ciorna',
  total_net_bani         INTEGER NOT NULL DEFAULT 0,
  total_tva_bani         INTEGER NOT NULL DEFAULT 0,
  total_brut_bani        INTEGER NOT NULL DEFAULT 0,
  avans_bani             INTEGER NOT NULL DEFAULT 0,
  meta                   TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_documente_tip ON documente(tip);
CREATE INDEX IF NOT EXISTS ix_documente_data ON documente(data);

CREATE TABLE IF NOT EXISTS documente_linii (
  id                TEXT PRIMARY KEY,
  document_id       TEXT NOT NULL REFERENCES documente(id),
  produs_id         TEXT REFERENCES produse(id),
  denumire          TEXT NOT NULL,
  unitate_masura    TEXT NOT NULL DEFAULT 'buc',
  cantitate         REAL NOT NULL DEFAULT 1,
  pret_unitar_bani  INTEGER NOT NULL DEFAULT 0,
  cota_tva_procent  INTEGER NOT NULL DEFAULT 19,
  pret_include_tva  INTEGER NOT NULL DEFAULT 0,
  net_bani          INTEGER NOT NULL DEFAULT 0,
  tva_bani          INTEGER NOT NULL DEFAULT 0,
  brut_bani         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_linii_document ON documente_linii(document_id);

-- Nota: miscarile de stoc NU sunt persistate intr-o tabela separata — se
-- recalculeaza la cerere din documente + linii (CMP, vezi core-domain/stock.ts
-- ruleazaStoc + ui/hooks/useStoc.ts). O tabela `miscari_stoc` anterioara nu era
-- folosita de niciun repository si a fost eliminata.

CREATE TABLE IF NOT EXISTS operatiuni_casa (
  id                TEXT PRIMARY KEY,
  data              TEXT NOT NULL,
  tip               TEXT NOT NULL,
  suma_bani         INTEGER NOT NULL DEFAULT 0,
  partener_id       TEXT REFERENCES parteneri(id),
  document          TEXT NOT NULL DEFAULT '',
  explicatie        TEXT NOT NULL DEFAULT '',
  punct_de_lucru_id TEXT REFERENCES puncte_lucru(id)
);

CREATE TABLE IF NOT EXISTS liste_preturi (
  id          TEXT PRIMARY KEY,
  lista       TEXT NOT NULL DEFAULT 'standard',
  produs_id   TEXT NOT NULL REFERENCES produse(id),
  pret_bani   INTEGER NOT NULL DEFAULT 0,
  valabil_de  TEXT
);

CREATE TABLE IF NOT EXISTS personal (
  id          TEXT PRIMARY KEY,
  marca       TEXT NOT NULL DEFAULT '',
  nume        TEXT NOT NULL,
  functie     TEXT NOT NULL DEFAULT '',
  cnp         TEXT,
  gestionar   INTEGER NOT NULL DEFAULT 0,
  activ       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tip_consum (
  id          TEXT PRIMARY KEY,
  cod         TEXT NOT NULL,
  denumire    TEXT NOT NULL,
  cont        TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS obiecte_inventar (
  id            TEXT PRIMARY KEY,
  cod           TEXT NOT NULL,
  denumire      TEXT NOT NULL,
  cantitate     REAL NOT NULL DEFAULT 1,
  valoare_bani  INTEGER NOT NULL DEFAULT 0,
  gestiune_id   TEXT REFERENCES gestiuni(id),
  data_intrare  TEXT,
  activ         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS preparate (
  id                TEXT PRIMARY KEY,
  cod               TEXT NOT NULL,
  denumire          TEXT NOT NULL,
  grupa_id          TEXT REFERENCES grupe_produse(id),
  unitate_masura    TEXT NOT NULL DEFAULT 'portie',
  pret_vanzare_bani INTEGER NOT NULL DEFAULT 0,
  cota_tva_procent  INTEGER NOT NULL DEFAULT 9,
  activ             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS retete_linii (
  id             TEXT PRIMARY KEY,
  preparat_id    TEXT NOT NULL REFERENCES preparate(id),
  produs_id      TEXT NOT NULL REFERENCES produse(id),
  cantitate      REAL NOT NULL DEFAULT 0,
  unitate_masura TEXT NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS optiuni_configurator (
  id              TEXT PRIMARY KEY,
  tip             TEXT NOT NULL,
  cod             TEXT NOT NULL,
  denumire        TEXT NOT NULL,
  pret_bani       INTEGER NOT NULL DEFAULT 0,
  pret_pe_mp_bani INTEGER NOT NULL DEFAULT 0,
  produs_id       TEXT REFERENCES produse(id),
  activ           INTEGER NOT NULL DEFAULT 1
);
