# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `f931d44` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phases 0–10** (see ledger): governance, VAT engine, transactions, command
  layer + aggregate, locking/idempotency/numbering, stock ledger, accounting
  journal, fiscal-event ledger, e-Factura SPV, SAF-T, multi-company + period close.
- **Phase 11 — auth freshness + hardening** (done):
  - Migration 0019: `utilizatori.session_version`; `sessionVersion` in the session
    token payload (set at login).
  - `server/auth.ts` — `sesiuneProaspata(payload, utilizator)` (pure): rejects a
    deactivated user or stale session version, returns role/firma read FRESH from
    the DB user (not the stale token). `verificaCerere` uses it → role/company
    change takes effect on the next request, not at token expiry.
    `invalideazaSesiuni` bumps `session_version` (force logout everywhere), wired
    into self password-change + admin password-reset.
  - Tests: `@gr/auth` round-trip carries sessionVersion (11); 6 server unit tests
    for `sesiuneProaspata`.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **336 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 136, data 52, application 53, ui 22, license 22,
  fiscal-ro 14, server 12, auth 11, sync 9, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV, independent pen-test.

## What is intentionally NOT done yet (be honest)
- **In-memory revocation/version stores** are per-process; a multi-instance
  deployment needs a shared store (Redis). Independent pen-test is an external gate.
- **UI/transport wiring** (from Phase 3) and **UI reports** still compute from
  documents in some paths — point them at the persisted, firm-scoped ledgers; add
  e-Factura + SAF-T + decont panels; surface a "session expired / role changed"
  reload prompt in the UI.
- **Legacy `firma_id IS NULL` rows** stay globally visible until a backfill.
- Official ANAF validators (SAF-T, e-Factura) + live SPV round-trip are external gates.

## Next priority: Phase 12 — sync/offline redesign (no LWW for posted data)
1. **Problem (RK-12)**: the current sync engine uses last-write-wins, which can
   silently corrupt posted financial data (a stale offline edit overwriting a
   posted document/ledger). See `packages/sync`.
2. **Server-authoritative replication**: posted documents + their ledgers
   (stock/journal/fiscal/e-Factura) are immutable and must never be overwritten by
   a client push — the client can only *create new drafts* and *send commands*
   (post/reverse) that the server validates; conflicts on posted data are rejected,
   not merged. Reuse the optimistic-locking `version` (Phase 4) for draft edits.
3. Offline queue replays as COMMANDS (idempotent — reuse the Phase 4 idempotency
   store), not as raw row upserts; a replayed post that already happened returns
   the stored result instead of double-posting.
4. Tests: an offline stale edit to a posted document is rejected (not merged); a
   replayed post is idempotent; draft edits use optimistic version conflict.
- Acceptance: no LWW on posted/ledger data; offline replay is command-based and
  idempotent; posted records never silently change via sync.

## Forbidden regressions
- Keep every prior guarantee (VAT default guard, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count, durable e-Factura + idempotent upload, SAF-T reconciles,
  per-firm period close + firm-scoped reports, session freshness).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–11 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` depends on `@gr/core-domain`, `@gr/data`, `@gr/fiscal-ro`.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `f931d44` (+ doc commit).
> Phases 0–11 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report wiring, legacy null-firma backfill, and a shared revocation store still
> pending). Begin Phase 12: redesign sync so posted/ledger data is never subject to
> last-write-wins (RK-12) — the server is authoritative, posted records are
> immutable, and the offline queue replays as idempotent COMMANDS (post/reverse via
> the Phase 4 idempotency store), not raw row upserts; draft edits use the Phase 4
> optimistic version. Add tests proving a stale offline edit to a posted document is
> rejected (not merged) and a replayed post is idempotent. Update the ledger +
> handoff. No claim without evidence.
