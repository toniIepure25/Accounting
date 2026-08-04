# ADR-0002: Immutable ledgers + real transactions

- Status: accepted
- Date: 2026-08-04

## Context
Stock valuation and double-entry accounting are currently **derived on the fly**
from documents (`stock.ts`, `contabilitate.ts`); nothing is persisted as a
ledger. `SqlExecutor` has no `transaction()`. This means "posting" is neither
atomic nor immutable, concurrent stock withdrawals can both succeed, and reports
recompute from mutable source documents.

## Decision
1. **Transactions** (Phase 2): extend `SqlExecutor` with
   `transaction(options, work)` — rollback on any failure — with correct SQLite
   (`BEGIN IMMEDIATE` for stock-sensitive work) and PostgreSQL (serialization
   retry) implementations. Audit and business writes commit as one unit.
2. **Persistent immutable stock ledger** (Phase 5): append-only
   `stock_ledger_entries` (+ posting batches, balances projection). Balances are
   projections of the ledger; never the source of truth. Negative stock is an
   explicit policy (DENY / WARN+authorize / ALLOW-for-configured-warehouse),
   **never clamped** to zero.
3. **Persistent balanced accounting ledger** (Phase 6): append-only
   `journal_entries`/`journal_lines`; every entry satisfies Σdebit = Σcredit;
   effective-dated posting profiles instead of only hardcoded account constants.

Corrections use reversal / cancellation / credit note / compensating entries —
**never** in-place patch or delete of a posted record.

## Consequences
- Stock and accounting become auditable, reconcilable, and deterministic.
- Reports read projections/ledgers, not recomputations from mutable documents.
- Requires migrations and dual-DB (SQLite + PostgreSQL) contract tests.
- Larger write path per posting (batch + ledger + journal + audit), justified by
  correctness and legal traceability.
