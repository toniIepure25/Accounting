# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `a86d24c` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** (done): baseline + governance.
- **Phase 1 — effective-dated RO VAT** (done): temporal engine, persisted
  `tax_rules`, product fiscal category, silent-default removal + guard, admin
  registry. P1-R5b posted-line tax snapshot done in Phase 3.
- **Phase 2 — transactions** (IMPLEMENTED_NOT_POSTGRES_VERIFIED): `SqlExecutor.transaction`,
  error taxonomy, real-SQLite + Tauri + PostgreSQL impls, `withExecutor`, CI job.
- **Phase 3 — commands & aggregate** (done): pure document aggregate
  (`document-aggregate.ts`), `@gr/application` (`postDocument` + lifecycle +
  reversal + immutability guard), server rejects generic PATCH/DELETE on posted
  docs. Migration 0013 removed the last unsafe VAT DB default.
- **Phase 4 — locking, numbering, idempotency** (done):
  - `Document.version` + optimistic locking (`expectedVersion` on updateDraft/
    approve/cancel/post/reverse; `ConflictOptimistaError` 409; version bumped on
    each write). See `packages/application/src/locking.ts`.
  - Idempotency store (`idempotency_keys` + `cuIdempotenta`): retried
    `postDocument` with the same key returns the stored response, allocates no
    second number; `IdempotencyConflictError` on key reuse. See
    `packages/application/src/idempotency.ts`.
  - Partial unique index `ux_documente_numar` on (firma_id, tip, year(data),
    serie, numar) WHERE numar>0 — DB backstop for numbering. Migration 0014.
  - 10 real-SQLite tests (`concurrency.test.ts`).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **271 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 111, data 52, application 23, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI service), Tauri native build, Playwright e2e.

## What is intentionally NOT done yet (be honest)
- **UI/transport wiring per deployment mode** (carried from Phase 3): the command
  layer + server guard exist and are tested, but the React UI still saves via the
  generic provider in some paths; the web-demo memory provider has no executor.
- **True multi-process concurrency** for numbering/idempotency is only meaningful
  on PostgreSQL; the SQLite test is single-connection. The real-PG race belongs to
  the CI postgres job.
- The unique numbering index treats NULL `firma_id` as distinct — legacy null-firma
  documents rely on the allocator, not the DB backstop.

## Next priority: Phase 5 — persistent immutable stock ledger
1. **Tables**: `stock_posting_batches`, `stock_ledger_entries`, `stock_balances`
   (+ cost layers if CMP needs them). Append-only ledger; balances derived.
2. **postDocument emits stock**: when a posted document affects stock
   (`directieStoc`/`genereazaMiscari` in core-domain), write ledger entries inside
   the SAME `exec.transaction` as the document — reuse the fault-injection harness
   to prove atomicity (document + stock commit or roll back together).
3. **CMP valuation**; transfer value conservation; negative-stock policy
   (DENY/WARN/ALLOW) — never silently clamp. `BEGIN IMMEDIATE` (already used by
   postDocument) prevents concurrent oversell.
4. **Reports derive from the ledger**, not from recomputing over document lists;
   reversal (`reverseDocument`) emits compensating ledger entries that net to zero.
- Acceptance: stock reports reconcile to the ledger; concurrent overselling
  prevented; value conserved on transfer.

## Forbidden regressions
- Keep the no-unsafe-VAT-default guard, posted-doc immutability, transaction
  contract, optimistic locking, and idempotency intact.
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3/4 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- SQL unique indexes treat NULL as distinct — set a non-null `firma_id` in tests
  that exercise the numbering constraint.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `a86d24c` (+ doc commit).
> Phases 0–4 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport wiring
> still pending from Phase 3). Begin Phase 5: a persistent, append-only stock
> ledger (`stock_ledger_entries` + balances), emitted by `postDocument` inside the
> same transaction as the document (atomic; reuse the fault-injection harness),
> with CMP valuation, transfer value conservation, and an explicit negative-stock
> policy (never clamp). Reports derive from the ledger; reversal nets to zero.
> Update the ledger + handoff. No claim without evidence.
