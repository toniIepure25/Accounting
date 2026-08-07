-- Phase 13: index compus pentru interogarea paginata a documentelor (RK-13).
-- Caile fierbinti filtreaza pe firma + interval de date si pagineaza cronologic;
-- indexul (firma_id, data, id) acopera si filtrarea, si ordinea + cursorul keyset,
-- evitand scanarea intregii tabele in stratul de aplicatie.
CREATE INDEX IF NOT EXISTS ix_documente_firma_data_id ON documente (firma_id, data, id);

-- Pentru filtrarea pe tip + data (ex. rapoarte pe un tip de document).
CREATE INDEX IF NOT EXISTS ix_documente_tip_data_id ON documente (tip, data, id);
