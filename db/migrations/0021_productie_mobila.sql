-- Phase 14 (Mobila): urmarirea OPERATIONALA a productiei unei comenzi de mobila,
-- SEPARAT de documentul comanda. Documentul comanda, odata postat, e imutabil
-- (Faza 3); progresul in fabrica (stare + departamente + cost real de materiale)
-- avanseaza aici, fara sa atinga documentul postat. Consumul real de materiale se
-- posteaza printr-un `bon_consum` (bon_consum_id), deci descarcarea de gestiune +
-- nota contabila 601 trec prin acelasi motor autoritar (postDocument).

CREATE TABLE IF NOT EXISTS productie_mobila (
  document_id             TEXT PRIMARY KEY REFERENCES documente(id),
  firma_id                TEXT,
  stare_productie         TEXT NOT NULL DEFAULT 'oferta',
  departamente_finalizate TEXT NOT NULL DEFAULT '[]',
  cost_manopera_bani      INTEGER NOT NULL DEFAULT 0,
  cost_materiale_bani     INTEGER NOT NULL DEFAULT 0,
  -- Bonul de consum postat care a descarcat materialele (link de trasabilitate).
  bon_consum_id           TEXT REFERENCES documente(id),
  updated_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_productie_stare ON productie_mobila (stare_productie);
