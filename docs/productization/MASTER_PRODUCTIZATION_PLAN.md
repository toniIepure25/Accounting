# Master productization plan

Traceable plan for turning the ERP into a commercially sellable Romanian
furniture-manufacturing product. Phases execute **strictly in order**; no
lower-priority feature work begins while a launch-blocking phase is incomplete.

Requirement IDs are stable: `P<phase>-R<n>`. Status ∈ `todo | in_progress | done | blocked`.
Evidence and commit SHAs are tracked in [`EXECUTION_LEDGER.json`](EXECUTION_LEDGER.json).

## Guiding gates (a feature is "done" only when all hold)
Implemented · persisted · transactionally safe · authorized server-side · tested
on SQLite **and** PostgreSQL where applicable · failure/concurrency tested ·
documented · observable · upgrade-safe · validated against authoritative external
specs where applicable. No claim without evidence.

## Phase index

| Phase | Theme | Launch-blocking | Status |
|---|---|---|---|
| 0 | Baseline, governance, safety net | yes | in_progress |
| 1 | Temporal (effective-dated) tax engine + current RO VAT | yes | in_progress |
| 2 | Transaction-capable persistence | yes | todo |
| 3 | Application commands + document aggregate | yes | todo |
| 4 | Optimistic locking, numbering, idempotency | yes | todo |
| 5 | Persistent immutable stock ledger | yes | todo |
| 6 | Persistent immutable accounting ledger | yes | todo |
| 7 | Fiscal event ledger + D300/D394/D390 | yes | todo |
| 8 | e-Factura end-to-end (SPV workflow) | yes | todo |
| 9 | SAF-T / D406 canonical | yes | todo |
| 10 | Multi-company correctness + period closing | yes | todo |
| 11 | Auth freshness + security hardening | yes | todo |
| 12 | Sync/offline redesign (no LWW for posted data) | yes | todo |
| 13 | Query model + performance | yes | todo |
| 14 | Furniture manufacturing differentiation | no (post-integrity) | todo |
| 15 | UX / role-based usability | no | todo |
| 16 | Backup, restore, migrations, DR | yes | todo |
| 17 | CI/CD + release engineering | yes | todo |
| 18 | Licensing + customer administration | no | todo |
| 19 | Migration from legacy (KISS/Access, CSV) | no | todo |
| 20 | Docs, support, legal, commercialization | no | todo |

## Requirement register (key requirements per phase)

### P0 — Baseline & governance
- **P0-R1** Baseline audit with evidence — `docs/productization/BASELINE_AUDIT.md`. **done**
- **P0-R2** Master plan with stable requirement IDs — this file. **done**
- **P0-R3** Machine-readable execution ledger. **done**
- **P0-R4** ADRs (command layer, immutable ledgers, doc lifecycle, tax versioning). **in_progress**
- **P0-R5** Risk register + release-readiness checklist. **in_progress**

### P1 — Temporal tax engine
- **P1-R1** Verify current RO VAT rates against authoritative sources (2025 change).
- **P1-R2** Effective-dated `TaxRule` model (valid_from/valid_to, category, context, legal ref, form mappings).
- **P1-R3** Server-side resolver: (date, product category, partner status, transaction context) → rule; explicit error when none applies.
- **P1-R4** Seed current + historical RO rules incl. the 2025 transition.
- **P1-R5** Persist resolved rule/version on every posted line (**depends on P3**).
- **P1-R6** Drafts recalc on date/partner/category/context change; posted docs immutable.
- **P1-R7** Tests: boundaries, historical determinism, mixed/exempt/reverse-charge, transition fixtures, property invariants.
- Acceptance: new docs no longer default to 19% when a later rule applies; resolution server-side; historical determinism.

### P2 — Transactions
- **P2-R1** `SqlExecutor.transaction(options, work)` with rollback-on-failure.
- **P2-R2** SQLite (`BEGIN IMMEDIATE` for stock-sensitive) + PostgreSQL (serialization retry) impls.
- **P2-R3** Fault-injection support; nested-tx semantics defined; timeout strategy.
- Acceptance: induced failure after any step leaves no partial mutation; same contract suite passes on SQLite + PG.

### P3 — Commands & aggregate
- **P3-R1** `packages/application` with command handlers (Create/Update/Approve/Post/Reverse/Cancel/CreditNote/ClosePeriod/RecordPayment/…).
- **P3-R2** Document aggregate + lifecycle (draft→approved→posted→reversed|cancelled); posted immutable.
- **P3-R3** Server-side validation of all invariants; totals recomputed server-side.
- Acceptance: UI sends commands; doc+lines atomic; posting is a business event.

### P4 — Concurrency & idempotency
- **P4-R1** Optimistic locking (`version`, `expectedVersion`, conflict response).
- **P4-R2** Idempotency store (key + request hash + stored response).
- **P4-R3** DB unique constraint on `(company, type, year, series, number)`; allocate at authoritative step.
- Acceptance: zero duplicate numbers/postings under concurrency + retries.

### P5 — Stock ledger
- **P5-R1** `stock_posting_batches`, `stock_ledger_entries`, `stock_balances` (+ cost layers if needed).
- **P5-R2** CMP valuation; transfer value conservation; negative-stock policy (DENY/WARN/ALLOW), never clamp.
- Acceptance: reports derive from ledger; concurrent overselling prevented; value reconciles.

### P6 — Accounting ledger
- **P6-R1** `journal_entries`/`journal_lines`, effective-dated posting profiles, dimensions, periods.
- **P6-R2** Every entry balanced (Σdebit=Σcredit); NIR↔invoice no double-count.
- Acceptance: persisted, balanced, source-traceable; reversal nets to zero; stock↔accounting reconcile.

### P7–P20
Detailed requirements captured in the ledger as each phase is reached, following
the program spec (fiscal event layer, e-Factura SPV workflow, SAF-T canonical,
multi-company, auth freshness, sync redesign, query/perf, furniture depth, UX,
backup/DR, CI/CD, licensing, legacy migration, docs/legal). IDs assigned when work
starts, to avoid speculative churn.

## Commercial-readiness gates (must all pass before "generally ready for sale")
Engineering integrity · fiscal assurance (incl. **external accountant + legal
review**) · security (incl. **independent pen-test**) · operations (signed
installer/updater, tested restore, runbooks) · market (**≥3 paid pilots**, accountant
reconciliation). The market/legal/security-review gates require **external parties**
and cannot be satisfied by code alone — tracked but explicitly out of scope for
automated implementation.
