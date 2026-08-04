# ADR-0003: Document lifecycle and immutability

- Status: accepted
- Date: 2026-08-04

## Context
Documents are stored via generic CRUD, so a posted invoice or stock receipt can
be edited or deleted with the same endpoint as a draft. There is no explicit
lifecycle, and posting is a state patch rather than a business event.

## Decision
Adopt an explicit aggregate lifecycle:

```
draft → approved → posted → (reversed | cancelled)
```

Rules:
- **draft**: freely editable; totals and tax may be recalculated on
  date/partner/product-category/context change.
- **approved**: validated, awaiting posting; still correctable back to draft
  where policy allows.
- **posted**: emits stock and/or accounting and/or fiscal events; **immutable**.
  No PATCH/DELETE through any generic endpoint.
- **reversed / cancelled**: correction via reversal, cancellation (where legally
  valid), or credit note — each producing linked compensating stock/accounting
  entries that net the original to zero.

The final legal document number is allocated at the authoritative lifecycle step
(posting), with a DB unique constraint on `(company, type, fiscal_year, series,
number)` and idempotency so retries never create duplicates (Phase 4).

## Consequences
- Auditors and users can trust that a posted record never silently changed.
- Requires command handlers (ADR-0001) to own transitions and validation.
- UI must present reversal/credit-note flows instead of edit-in-place for posted
  documents.
