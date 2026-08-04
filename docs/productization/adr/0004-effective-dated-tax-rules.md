# ADR-0004: Effective-dated (temporal) tax rules

- Status: accepted
- Date: 2026-08-04

## Context
VAT is hardcoded in `tva.ts` (`STANDARD: 19`, reduced 9/5, exempt 0) and
`produs.ts` defaults to 19%. The `cote_tva` table is not effective-dated and is
never read by the runtime. Romania changed VAT rates in 2025, so a single global
percentage is both architecturally wrong (not versioned) and fiscally wrong for
documents dated after the change. A future rate change must not require a global
find-and-replace, and historical posted documents must never change retroactively.

## Decision
Model tax as **effective-dated rules** resolved at posting time:

- A `TaxRule` carries: id, version, `validFrom`, `validTo`, jurisdiction, tax
  type, category (standard/reduced/exempt/reverse-charge/out-of-scope),
  percentage, product/service fiscal category, supplier & customer VAT status,
  transaction context (domestic/intra-EU/export/import), legal reference, and
  mappings to e-Factura category, exemption/reverse-charge code, D300/D394/D390,
  SAF-T, plus approval status and source-artifact version.
- A **resolver** takes `(date, product fiscal category, partner statuses,
  transaction context)` and returns the applicable rule, or an **explicit error**
  when none applies (no silent default).
- The **resolved rule/version is persisted on every posted line** (via the
  document aggregate, Phase 3), so historical documents are deterministic even
  after future rule updates.
- **Drafts** may be recalculated when date/partner/category/context changes;
  **posted** documents never recalculate.

Current + historical Romanian rules (including the 2025 transition) are seeded
after verification against authoritative sources (P1-R1). Rates are treated as
data, not code.

## Consequences
- Future legislative changes = add a rule version with a `validFrom`, no code
  change and no retroactive mutation.
- Fiscal reports (D300/D394/D390/SAF-T) map from the resolved rule, not raw
  arbitrary percentages.
- Requires a migration for the temporal `tax_rules` table and administration UI
  (later in Phase 1); the pure resolver + model land first in `core-domain`.
