-- Phase 1 (P1-R2b): reguli de TVA cu efectivitate temporala, PERSISTATE.
-- Inlocuieste tabela `cote_tva` (procent-cheie, fara efectivitate, necitita de
-- runtime) cu un model versionat pe intervale [valid_from, valid_to).
--
-- Cota se pastreaza in PUNCTE DE BAZA (basis points), reprezentare INTREAGA
-- exacta: 19% = 1900, 21% = 2100, 11% = 1100. Nu se folosesc valori in virgula
-- mobila pentru cote (principiul din program).
--
-- Compatibil SQLite + PostgreSQL: doar tipuri si constrangeri comune. Fara
-- timestamp-uri dependente de mediu (seed-ul are created_at fix).

CREATE TABLE IF NOT EXISTS tax_rules (
  id                  TEXT PRIMARY KEY,
  jurisdiction        TEXT NOT NULL,
  tax_type            TEXT NOT NULL DEFAULT 'VAT',
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL,
  rate_basis_points   INTEGER NOT NULL,
  valid_from          TEXT NOT NULL,
  valid_to            TEXT,
  legal_reference     TEXT NOT NULL,
  legal_source_url    TEXT,
  efactura_category   TEXT,
  exemption_code      TEXT,
  reverse_charge_code TEXT,
  status              TEXT NOT NULL DEFAULT 'approved',
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  created_by          TEXT,
  approved_at         TEXT,
  approved_by         TEXT,
  CHECK (rate_basis_points >= 0),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (status IN ('draft', 'approved', 'retired'))
);

-- Cautare pe (jurisdictie, tip, categorie, data).
CREATE INDEX IF NOT EXISTS ix_tax_rules_lookup
  ON tax_rules (jurisdiction, tax_type, code, valid_from);

-- Cel mult O regula APROBATA per (jurisdictie, tip, categorie, data de start):
-- previne ambiguitatea. Versiunile draft/retired pot coexista (corectii).
CREATE UNIQUE INDEX IF NOT EXISTS ux_tax_rules_approved
  ON tax_rules (jurisdiction, tax_type, code, valid_from)
  WHERE status = 'approved';

-- Seed verificat: RO, tranzitia Legii 141/2025 (MO 699/25.07.2025), in vigoare
-- 1 august 2025. created_at fix (nu CURRENT_TIMESTAMP) — migratie deterministica.
INSERT INTO tax_rules
  (id, jurisdiction, tax_type, code, name, category, rate_basis_points, valid_from, valid_to, legal_reference, legal_source_url, status, version, created_at, created_by, approved_at, approved_by)
VALUES
  ('ro-standard-19', 'RO', 'VAT', 'standard', 'Cota standard 19% (pana la 31.07.2025)', 'standard', 1900, '2017-01-01', '2025-08-01', 'Cod fiscal (art. 291), pana la 31.07.2025', NULL, 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-standard-21', 'RO', 'VAT', 'standard', 'Cota standard 21% (de la 01.08.2025)', 'standard', 2100, '2025-08-01', NULL, 'Legea 141/2025 (MO 699/25.07.2025)', 'https://static.anaf.ro/static/10/Anaf/legislatie/L_141_2025.pdf', 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-redus9-9', 'RO', 'VAT', 'redus_9', 'Cota redusa 9% (pana la 31.07.2025)', 'redusa', 900, '2017-01-01', '2025-08-01', 'Cod fiscal (art. 291), pana la 31.07.2025', NULL, 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-redus9-11', 'RO', 'VAT', 'redus_9', 'Cota redusa unica 11% (de la 01.08.2025; foste bunuri la 9%)', 'redusa', 1100, '2025-08-01', NULL, 'Legea 141/2025 (MO 699/25.07.2025)', 'https://static.anaf.ro/static/10/Anaf/legislatie/L_141_2025.pdf', 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-redus5-5', 'RO', 'VAT', 'redus_5', 'Cota redusa 5% (pana la 31.07.2025)', 'redusa', 500, '2017-01-01', '2025-08-01', 'Cod fiscal (art. 291), pana la 31.07.2025', NULL, 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-redus5-11', 'RO', 'VAT', 'redus_5', 'Cota redusa unica 11% (de la 01.08.2025; foste bunuri la 5%)', 'redusa', 1100, '2025-08-01', NULL, 'Legea 141/2025 (MO 699/25.07.2025)', 'https://static.anaf.ro/static/10/Anaf/legislatie/L_141_2025.pdf', 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed'),
  ('ro-scutit-0', 'RO', 'VAT', 'scutit', 'Scutit de TVA (0%)', 'scutit', 0, '2017-01-01', NULL, 'Cod fiscal (operatiuni scutite)', NULL, 'approved', 1, '2025-08-01T00:00:00.000Z', 'seed', '2025-08-01T00:00:00.000Z', 'seed');
