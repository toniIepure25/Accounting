-- Scopare multi-firma pe entitatile tranzactionale (documente/casa/banca/
-- mijloace fixe) — pana acum toate firmele vedeau aceleasi date. Coloana e
-- NULLABLE si fara valoare implicita: randurile existente raman `NULL`
-- (vizibile pentru toate firmele — vezi @gr/data randuriVizibilePentruFirma),
-- randurile noi sunt stampilate cu firma curenta la creare.

ALTER TABLE documente ADD COLUMN firma_id TEXT;
ALTER TABLE documente_linii ADD COLUMN firma_id TEXT;
ALTER TABLE operatiuni_casa ADD COLUMN firma_id TEXT;
ALTER TABLE operatiuni_bancare ADD COLUMN firma_id TEXT;
ALTER TABLE mijloace_fixe ADD COLUMN firma_id TEXT;

CREATE INDEX IF NOT EXISTS ix_documente_firma ON documente(firma_id);
CREATE INDEX IF NOT EXISTS ix_operatiuni_casa_firma ON operatiuni_casa(firma_id);
