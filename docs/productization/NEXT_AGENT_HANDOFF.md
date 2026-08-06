# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `3f108d4` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** governance; **Phase 1** effective-dated RO VAT (persisted rules, no
  silent default, posted-line tax snapshot).
- **Phase 2** transactions (IMPLEMENTED_NOT_POSTGRES_VERIFIED).
- **Phase 3** commands & aggregate (`@gr/application`, `postDocument` + lifecycle +
  reversal, server immutability guard).
- **Phase 4** optimistic locking, idempotency, unique numbering.
- **Phase 5** persistent stock ledger (CMP, transfer conservation, never-clamp
  negative policy) emitted atomically at posting.
- **Phase 6 — persistent accounting journal** (done):
  - Migration 0016: append-only `journal_entries` + `journal_lines` (double-entry).
  - `packages/core-domain/src/journal.ts` — pure `genereazaNotaDocument` reusing
    the `contabilitate.ts` monografie; every note balanced (Σdebit=Σcredit),
    `asertaNotaEchilibrata`, `NotaDezechilibrataError`.
  - `packages/data/src/journal-repo.ts` — write entry+lines, list.
  - `packages/application/src/accounting.ts` — `emiteContabilitateDocument`
    (called by `postDocument` in the SAME transaction as the document + stock;
    uses the stock COGS for the inventory discharge; 3-way NIR match => no second
    note) and `stornoContabilitateDocument` (reversal swaps debit/credit → nets to
    zero). `emiteStocDocument` now returns `costIesireBani`.
  - Tests: 7 pure + 6 real-SQLite (balanced, atomic, NIR-match, reversal nets to
    zero, **stock↔accounting reconcile**).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **297 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 125, data 52, application 35, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e.

## What is intentionally NOT done yet (be honest)
- **UI/transport wiring** (from Phase 3): UI still saves via the generic provider
  in some paths; the web-demo memory provider has no executor.
- **UI reports** (`useStoc`, accounting pages) still recompute in some paths —
  they should read the persisted `stock_balances` / `journal_lines`.
- **Posting profile** is the fixed RO monografie (`contStoc` defaults 371);
  effective-dated posting profiles + analytic dimensions + periods are a later
  refinement.
- **Fiscal declarations** (D300/D394/D390/SAF-T) still derive from documents —
  that is Phase 7+ and needs external accountant/validator sign-off.

## Next priority: Phase 7 — fiscal event ledger + D300/D394/D390
1. **Fiscal event layer**: a persisted, per-document set of fiscal facts (taxable
   base, VAT by rate/category, direction, partner VAT status, intra-community
   flags) written at posting from the tax snapshot (P1-R5b) + journal — so
   declarations read facts, not re-derive from document lists (fixes RK-07 fully).
2. **D300** (VAT return), **D394** (domestic recap), **D390** (VIES/EC sales) built
   from the fiscal event ledger; reconcile to the journal (4426/4427) and to the
   partner/country data. `packages/fiscal-ro` already has `d394.ts`/`d390.ts`/
   `decont.ts` computing from documents — persist the events and point these at
   them.
3. Validate structure against official schemas where possible (mark
   EXTERNAL_REVIEW_REQUIRED where the real ANAF validator can't run in-env).
- Acceptance: declarations derive from persisted fiscal events; no NIR↔invoice or
  cross-document double-count; totals reconcile to the accounting journal.

## Forbidden regressions
- Keep: no-unsafe-VAT-default guard, posted-doc immutability, transaction
  contract, optimistic locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconciliation.
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–6 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero) —
  post a receipt first or seed a `stock_balances` row.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `3f108d4` (+ doc commit).
> Phases 0–6 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report wiring still pending). Begin Phase 7: a persisted fiscal-event ledger
> written at posting from the tax snapshot + journal, and D300/D394/D390 built
> from those events (not re-derived from document lists), reconciling to the
> accounting journal (4426/4427) — fully fixing NIR↔invoice double-count (RK-07).
> Point the existing fiscal-ro computations at the persisted events. Mark
> EXTERNAL_REVIEW_REQUIRED where the official ANAF validator can't run in-env.
> Update the ledger + handoff. No claim without evidence.
