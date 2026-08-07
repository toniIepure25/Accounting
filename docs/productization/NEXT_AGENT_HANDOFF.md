# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `1593ae9` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phases 0–11** (see ledger): governance, VAT engine, transactions, command
  layer + aggregate, locking/idempotency/numbering, stock ledger, accounting
  journal, fiscal-event ledger, e-Factura SPV, SAF-T, multi-company + period close,
  auth freshness.
- **Phase 12 — sync/offline redesign** (done):
  - `packages/sync/src/policy.ts` — `reconcileSigur(local, remote, {blocat})`:
    a server-locked (posted/immutable) record is never overwritten by a client
    push; a local edit to it is reported as a conflict and the server version is
    pulled, not LWW-merged. New offline drafts still push; non-locked config LWW.
  - `packages/sync/src/offline-queue.ts` — `comenziDeReluat` / `puneInCoada` /
    `curataCoada`: offline financial changes replay as idempotent COMMANDS (skip
    executed idempotency keys), not raw row upserts.
  - 8 pure tests.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **344 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 136, data 52, application 53, ui 22, license 22,
  sync 17, fiscal-ro 14, server 12, auth 11, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV, independent pen-test.

## What is intentionally NOT done yet (be honest)
- **Client transport wiring**: the safe reconciliation + offline command queue are
  pure/tested but not yet wired into the client sync loop (persist the queue,
  replay against the API provider, surface conflicts in the UI).
- **UI/transport wiring** (from Phase 3) and **UI reports** still compute from
  documents in some paths — point them at the persisted, firm-scoped ledgers.
- **Legacy `firma_id IS NULL` rows** globally visible until a backfill;
  **in-memory revocation store** needs Redis for multi-instance.
- Official ANAF validators + live SPV + independent pen-test are external gates.

## Next priority: Phase 13 — query model + performance
1. **Problem (RK-13)**: repositories expose `list()` (full-table) + in-memory
   filtering everywhere; this won't scale. Add query DTOs + keyset pagination.
2. **Read models / query endpoints**: replace `list()`-then-filter in the hot paths
   (documents, ledger reports, stock/journal/fiscal queries) with parameterized
   SQL (filter by firma/date/type, keyset paginate). The persisted ledgers already
   have indexes (stock/journal/fiscal); add the query layer over them.
3. **Indexes**: ensure the common filters (firma_id, data, tip, partener) are
   indexed; add a migration where missing.
4. Tests: a query returns a bounded page + a stable next-cursor; filtering by
   firma/date returns only matching rows; large-set behaviour is bounded (no full
   scan through the app layer).
- Acceptance: hot read paths use bounded, indexed queries with keyset pagination
  instead of `list()` + in-memory filter.

## Forbidden regressions
- Keep every prior guarantee (VAT default guard, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count, durable e-Factura + idempotent upload, SAF-T reconciles,
  per-firm period close + firm-scoped reports, session freshness, no-LWW-on-posted).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–12 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` depends on `@gr/core-domain`, `@gr/data`, `@gr/fiscal-ro`.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `1593ae9` (+ doc commit).
> Phases 0–12 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report wiring, client sync wiring, null-firma backfill, and a shared revocation
> store still pending). Begin Phase 13: a query model with DTOs + keyset pagination
> (RK-13) — replace `list()` + in-memory filter on the hot paths (documents, ledger
> reports) with parameterized, indexed SQL queries (filter by firma/date/type,
> keyset paginate); add indexes/migration where missing. Add tests proving a bounded
> page + stable cursor + firma/date filtering. Update the ledger + handoff. No claim
> without evidence.
