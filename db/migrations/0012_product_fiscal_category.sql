-- Phase 1 (P1-A6/A7): categorie fiscala pe produs + campuri forward-compatible
-- pentru snapshot-ul de TVA rezolvat pe linia de document (posting-ul autoritar
-- ramane in Faza 3 — campurile raman NULL pana atunci).
--
-- De ce: `produse.cota_tva_procent DEFAULT 19` si `documente_linii.cota_tva_procent
-- DEFAULT 19` erau UNSAFE_RUNTIME_DEFAULT — orice produs/linie nou primea tacit
-- 19%, gresit dupa 01.08.2025. Produsul poarta acum o CATEGORIE FISCALA stabila
-- (`cod_categorie_fiscala`), iar cota se rezolva la data documentului din
-- tax_rules. `cota_tva_procent` ramane ca INDICIU LEGACY (audit/migrare), nu ca
-- sursa autoritara pentru documente noi.

-- Produs: categorie fiscala (nullable; NULL/necategorizat => necesita rezolvare).
ALTER TABLE produse ADD COLUMN cod_categorie_fiscala TEXT;

-- Backfill din indiciul legacy de procent. Mapare fidela pe TIER-ul istoric:
-- 19->standard, 9->redus_9, 5->redus_5, 0->scutit. Orice alt procent =>
-- 'necategorizat' (NU se ghiceste tacit) => rezolvarea va arunca eroare pana la
-- clasificare manuala.
UPDATE produse SET cod_categorie_fiscala = CASE cota_tva_procent
    WHEN 19 THEN 'standard'
    WHEN 21 THEN 'standard'
    WHEN 9  THEN 'redus_9'
    WHEN 11 THEN 'redus_9'
    WHEN 5  THEN 'redus_5'
    WHEN 0  THEN 'scutit'
    ELSE 'necategorizat'
  END
  WHERE cod_categorie_fiscala IS NULL;

-- Linie de document: snapshot al TVA rezolvat, populat la POSTARE (Faza 3).
-- Nullable acum; forward-compatible. `cota_tva_procent` legacy ramane.
ALTER TABLE documente_linii ADD COLUMN tax_rule_id TEXT;
ALTER TABLE documente_linii ADD COLUMN tax_rule_version INTEGER;
ALTER TABLE documente_linii ADD COLUMN resolved_tax_rate_bp INTEGER;
ALTER TABLE documente_linii ADD COLUMN tax_category TEXT;
ALTER TABLE documente_linii ADD COLUMN tax_legal_reference TEXT;
ALTER TABLE documente_linii ADD COLUMN tax_resolution_snapshot TEXT;
