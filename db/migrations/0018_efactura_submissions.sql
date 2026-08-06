-- Phase 8: workflow e-Factura DURABIL (SPV). Pana acum se putea doar genera si
-- descarca XML-ul — nu exista o pista de audit a ciclului de viata la SPV (ce s-a
-- incarcat, cand, cu ce raspuns). Acum fiecare factura are o SUBMISIE persistata
-- cu stare, indexul de incarcare ANAF, mesajele de stare si cheia de idempotenta
-- (o reincercare cu aceeasi cheie NU re-incarca).
--
-- Stari: ciorna_xml -> validat -> incarcat -> (acceptat | respins); `eroare` =
-- esec de transport (reincercabil). O singura submisie ACTIVA per document
-- (index unic partial pe document_id pentru starile ne-terminale/acceptate).

CREATE TABLE IF NOT EXISTS efactura_submissions (
  id               TEXT PRIMARY KEY,
  firma_id         TEXT,
  document_id      TEXT NOT NULL REFERENCES documente(id),
  stare            TEXT NOT NULL,
  xml              TEXT,
  upload_index     TEXT,
  mesaj_stare      TEXT,
  id_descarcare    TEXT,
  idempotency_key  TEXT UNIQUE,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK (stare IN ('ciorna_xml', 'validat', 'incarcat', 'acceptat', 'respins', 'eroare'))
);
CREATE INDEX IF NOT EXISTS ix_efactura_document ON efactura_submissions (document_id);
CREATE INDEX IF NOT EXISTS ix_efactura_stare ON efactura_submissions (stare);

-- Cel mult O submisie care nu e respinsa/eroare per document (nu incarci de doua
-- ori aceeasi factura). Retrimiterea dupa respingere e permisa (o noua submisie).
CREATE UNIQUE INDEX IF NOT EXISTS ux_efactura_activa
  ON efactura_submissions (document_id)
  WHERE stare IN ('ciorna_xml', 'validat', 'incarcat', 'acceptat');
