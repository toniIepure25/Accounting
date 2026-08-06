-- Phase 7: registru de EVENIMENTE FISCALE persistat si append-only.
--
-- Pana acum declaratiile (decont TVA/D300, D394, D390) se recalculau din listele
-- de documente, filtrand pe tip — ceea ce dubla TVA-ul deductibil cand exista si
-- NIR (receptie_furnizor) SI factura de cumparare pentru aceeasi achizitie
-- (RK-07). Acum postarea scrie faptele fiscale (baza + TVA pe cota si directie),
-- RESPECTAND aceeasi potrivire 3-way ca jurnalul (o factura acoperita de un NIR
-- postat NU emite eveniment deductibil). Declaratiile citesc FAPTE, nu re-deduc
-- din documente — deci reconciliaza cu jurnalul (4426/4427).

CREATE TABLE IF NOT EXISTS fiscal_events (
  id                 TEXT PRIMARY KEY,
  firma_id           TEXT,
  document_id        TEXT REFERENCES documente(id),
  data               TEXT NOT NULL,
  -- 'colectata' (TVA de iesire/vanzari) sau 'deductibila' (TVA de intrare/achizitii).
  directie           TEXT NOT NULL,
  categorie_fiscala  TEXT,
  cota_procent       INTEGER NOT NULL,
  baza_bani          INTEGER NOT NULL,
  tva_bani           INTEGER NOT NULL,
  partener_id        TEXT,
  tara               TEXT NOT NULL DEFAULT 'RO',
  context            TEXT NOT NULL DEFAULT 'intern',
  created_at         TEXT NOT NULL,
  CHECK (directie IN ('colectata', 'deductibila'))
);
CREATE INDEX IF NOT EXISTS ix_fiscal_events_doc ON fiscal_events (document_id);
CREATE INDEX IF NOT EXISTS ix_fiscal_events_data ON fiscal_events (data);
CREATE INDEX IF NOT EXISTS ix_fiscal_events_dir ON fiscal_events (directie, cota_procent);
CREATE INDEX IF NOT EXISTS ix_fiscal_events_partener ON fiscal_events (partener_id);
