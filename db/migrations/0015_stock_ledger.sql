-- Phase 5: registru de stoc PERSISTENT si append-only + solduri materializate.
--
-- Pana acum stocul se RECALCULA la cerere din documente (core-domain/stock.ts
-- ruleazaStoc + ui/hooks/useStoc.ts), deci nu exista o pista de audit imutabila
-- si nici o garda reala impotriva vanzarii sub zero sub concurenta. Registrul de
-- aici este SURSA DE ADEVAR: fiecare postare de document scrie intrari (append-
-- only) cu soldul rezultat DUPA fiecare miscare (cantitate + valoare + CMP),
-- iar `stock_balances` tine soldul curent materializat pentru citiri O(1) si
-- pentru verificarea de stoc negativ in aceeasi tranzactie cu documentul.

CREATE TABLE IF NOT EXISTS stock_ledger_entries (
  id                     TEXT PRIMARY KEY,
  firma_id               TEXT,
  gestiune_id            TEXT NOT NULL REFERENCES gestiuni(id),
  produs_id              TEXT NOT NULL REFERENCES produse(id),
  document_id            TEXT NOT NULL REFERENCES documente(id),
  document_linie_id      TEXT,
  data                   TEXT NOT NULL,
  tip_document           TEXT NOT NULL,
  -- Miscarea cu semn: pozitiv intrare, negativ iesire.
  cantitate              REAL NOT NULL,
  valoare_bani           INTEGER NOT NULL,
  -- Soldul REZULTAT dupa aceasta intrare (running balance) — face registrul
  -- auto-suficient: rapoartele citesc ultima intrare fara sa recalculeze tot.
  sold_cantitate_dupa    REAL NOT NULL,
  sold_valoare_bani_dupa INTEGER NOT NULL,
  pmp_bani_dupa          INTEGER NOT NULL,
  created_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_gp ON stock_ledger_entries (gestiune_id, produs_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_doc ON stock_ledger_entries (document_id);

-- Sold curent materializat per (gestiune, produs). Derivabil din registru, dar
-- persistat pentru citiri rapide si pentru lacatul de scriere (BEGIN IMMEDIATE)
-- care impiedica doua iesiri concurente sa treaca amandoua de verificarea de stoc.
CREATE TABLE IF NOT EXISTS stock_balances (
  gestiune_id  TEXT NOT NULL REFERENCES gestiuni(id),
  produs_id    TEXT NOT NULL REFERENCES produse(id),
  firma_id     TEXT,
  cantitate    REAL NOT NULL DEFAULT 0,
  valoare_bani INTEGER NOT NULL DEFAULT 0,
  pmp_bani     INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (gestiune_id, produs_id)
);
