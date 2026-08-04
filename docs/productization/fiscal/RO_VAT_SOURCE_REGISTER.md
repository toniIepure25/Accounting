# Romanian VAT — source register

Evidence backing the effective-dated VAT rules in
`packages/core-domain/src/tva-temporal.ts` (`REGULI_TVA_RO`). Sources are
classified so downstream reviewers can tell primary law from explanatory
commentary. **This register documents rates, not a completeness claim** — see
"Supported scope" below.

Classification legend:
- **PRIMARY_OFFICIAL** — the enacted legal text / official gazette.
- **OFFICIAL_TECHNICAL** — tax-authority (ANAF) or Ministry of Finance technical publications/forms.
- **SECONDARY_EXPLANATORY** — reputable professional commentary (not authoritative).
- **EXTERNAL_REVIEW_REQUIRED** — needs a Romanian accountant/tax lawyer sign-off.

## The 2025 VAT change

| Field | Value |
|---|---|
| Legal act | **Legea nr. 141/2025** privind unele măsuri fiscal-bugetare |
| Official gazette | **Monitorul Oficial, Partea I, nr. 699 din 25 iulie 2025** |
| Promulgation | Decret nr. 791 din 25 iulie 2025 |
| Entry into force (VAT) | **1 august 2025** (law's own note: "a se vedea prevederile art. VII, art. X și art. LXV") |
| Amends | Legea 227/2015 (Codul fiscal), inter alia art. 291 (cote TVA) |
| Standard VAT | 19% → **21%** |
| Reduced VAT | 5% and 9% eliminated → single **11%** reduced rate |
| Exempt | 0% unchanged |

## Sources (accessed 2026-08-04)

| # | URL | Class | What it establishes | Access result |
|---|---|---|---|---|
| S1 | https://static.anaf.ro/static/10/Anaf/legislatie/L_141_2025.pdf | PRIMARY_OFFICIAL | Official ANAF-hosted full text of Law 141/2025 | **Fetched (519 KB) and read directly**: confirmed title "LEGE Nr. 141 din 25 iulie 2025", "Publicată în: Monitorul Oficial Nr. 699 din 25 iulie 2025", Decret 791/2025, entry-into-force note (art. VII/X/LXV) |
| S2 | https://legislatie.just.ro/Public/DetaliiDocument/300022 | PRIMARY_OFFICIAL | Portal Legislativ (official) document record for Law 141/2025 | URL identified via search; page not fetched in-session (JS portal) |
| S3 | https://www.avalara.com/blog/en/europe/2025/07/blog-romania-vat-rate-changes-2025.html | SECONDARY_EXPLANATORY | 19%→21%, 5%&9%→11%, eff. 2025-08-01 | Fetched and read |
| S4 | https://www.vatupdate.com/2025/07/08/romania-to-implement-new-vat-rates-standard-21-reduced-11-by-august-2025/ | SECONDARY_EXPLANATORY | Standard 21%, reduced 11% | Search snapshot |
| S5 | https://www.globalvatcompliance.com/globalvatnews/romania-vat-rate-increase-11-reduced-rate/ | SECONDARY_EXPLANATORY | 21% + consolidated 11% reduced | Search snapshot (direct fetch 403) |

## What is verified vs. what is not

**Verified (primary + corroborated):**
- Identity, gazette, promulgation and effective date of Law 141/2025 — from the
  official ANAF text (S1), read directly this session.
- Standard rate 21% and single reduced rate 11% from 2025-08-01; prior 19% /
  9% / 5% — corroborated across S1 (law identity) and S3–S5.

**NOT transcribed in-session (honest limitation):**
- The exact art. 291 Cod fiscal sub-paragraph wording. Law 141/2025 amends dozens
  of Fiscal Code articles across ~100+ pages; art. 291 sits in a later Title-VII
  point that was not transcribed here. The **rate figures** are corroborated, but
  a line-by-line art. 291 transcription is left as `EXTERNAL_REVIEW_REQUIRED`.

## Supported scope (no over-claim)

- The engine models the **rate tiers** correctly on both sides of the 2025-08-01
  boundary (standard 19→21, reduced 5&9→11, exempt 0).
- It does **not** yet model the full legal mapping of which specific goods/services
  fall in each reduced category (secondary legislation; e.g. transitional reduced
  rates for certain housing/social supplies). Product→fiscal-category assignment
  is a stable code on the product; the authoritative per-good classification is
  `EXTERNAL_REVIEW_REQUIRED`.
- **No claim of "fully compliant" or "all Romanian VAT cases supported" is made.**

## Phase-1 evidence status
`PARTIAL_EXTERNAL_EVIDENCE` upgraded → **PRIMARY_OFFICIAL obtained** for law
identity and effective date (S1). Full art. 291 transcription and per-good
category mapping remain for external fiscal review.
