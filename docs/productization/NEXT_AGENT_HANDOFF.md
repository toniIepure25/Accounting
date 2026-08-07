# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `76cc9e4` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed — all LAUNCH-BLOCKING integrity phases (0–13)
- **0** governance · **1** effective-dated RO VAT · **2** transactions
  (IMPLEMENTED_NOT_POSTGRES_VERIFIED) · **3** command layer + document aggregate ·
  **4** optimistic locking/idempotency/numbering · **5** persistent stock ledger ·
  **6** persistent accounting journal · **7** fiscal-event ledger · **8** e-Factura
  SPV workflow · **9** SAF-T (D406) from ledgers · **10** multi-company + per-firm
  period close · **11** auth freshness · **12** sync no-LWW on posted data.
- **Phase 13 — query model + performance** (done):
  - `packages/data/src/document-query.ts` — `interogheazaDocumente(exec, filtru,
    paginare)`: parameterized filter (firma/tip/stare/partener/date) + keyset
    pagination (order by data,id desc; strict cursor; bounded LIMIT 1..500;
    next-cursor). Migration 0020: composite indexes (firma_id,data,id) + (tip,data,id).
  - 5 real-SQLite tests (bounded page, full pagination without overlap/gaps, firma
    isolation, tip+date filter, page clamp).

## Also done
- **Phase 14 — furniture (Mobila) vertical** (non-launch-blocking): production
  lifecycle state machine + `pornesteProductie` posts a BOM-driven `bon_consum` via
  `postDocument` (stock/journal/fiscal atomic); `productie_mobila` persists the
  operational state apart from the immutable order (migration 0021). 6 tests.
- **UI/transport wiring, slice 1 (WIRING-1)**: the demo server now runs on a real
  better-sqlite3 executor with migrations + seed (was a memory stub), so the full
  engine runs without PostgreSQL; `POST /commands/<post|reverse|approve|cancel>-document`
  dispatch to `@gr/application` over the server executor (RBAC + stable HTTP error
  mapping). Closes part of the Phase 3 "UI sends commands" gap at the transport
  layer. 6 server tests on better-sqlite. See `server/src/commands.ts`, `db.ts`.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **361 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 138, data 57, application 57, server 18, ui 22,
  license 22, sync 17, fiscal-ro 14, auth 11, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV, independent pen-test.

## What is intentionally NOT done yet (be honest)
Cross-cutting integration debt accumulated across the integrity phases — the
engine layers are built + tested, but not everywhere wired into the UI/transport:
- **UI/transport wiring**: the React UI still saves via the generic provider in
  some paths (Phase 3 commands not the only write path); UI reports (`useStoc`,
  accounting/fiscal/SAF-T pages) still recompute from documents rather than the
  persisted ledgers; no e-Factura / SAF-T / decont panels driving the new commands;
  the safe reconciliation + offline command queue (Phase 12) aren't in the client
  sync loop; `interogheazaDocumente` isn't yet the document-list source in the UI.
- **External gates**: official ANAF validators (SAF-T, e-Factura) + live SPV
  round-trip + independent pen-test + external accountant/legal review.
- **Data**: legacy `firma_id IS NULL` rows globally visible until a backfill;
  in-memory revocation store needs Redis for multi-instance.

## Next priority (user chose UI-wiring + Mobila + Ops; Mobila done)
Two remaining build directions the user selected:
- **UI/transport wiring** — surface the built engines in the app: route document
  save/post/reverse through the `@gr/application` commands (not generic CRUD); make
  reports read the persisted ledgers (stock_balances / journal_lines /
  fiscal_events) instead of recomputing; add e-Factura / SAF-T / decont / production
  panels; wire the keyset document query into the list; wire the offline command
  queue + safe reconciliation into the client sync loop. Highest immediate value;
  verify with the Browser preview (`preview_start`) per the run skill.
- **Ops (Phase 16/17)** — backup/restore/DR (there is `packages/data/backup.ts`
  already) + CI/CD & release engineering (signed installer/updater, tested restore,
  runbooks). More testable in-env than UI.
Pick per user priority; if unclear, ask.

## (superseded) former next priority — Phase 14 furniture (now DONE)
This is the first NON-launch-blocking phase and the product's first vertical
(furniture / "Mobila"). The base already has a configurator + nesting + BOM in
`packages/core-domain` (`mobila.ts`, `nesting.ts`, `engines.test.ts`) and a
`comanda_mobila` document type.
1. **Production lifecycle for a furniture order**: model `comanda_mobila`
   states (oferta → confirmata → in_productie → finalizat → livrat) as a pure
   aggregate (mirror the document-aggregate pattern), wired through a command.
2. **BOM → material consumption**: on production start, generate the material
   `bon_consum`(s) from the configurator BOM and post them (reuse `postDocument`
   so stock/journal/fiscal all fire atomically) — the furniture order's cost rolls
   up from real consumed-material CMP, not an estimate.
3. **Nesting/cut-list** as a persisted artifact of the order (reuse `nesting.ts`);
   surface offcut yield.
- Acceptance: a furniture order drives real, atomic material consumption + costing
  through the existing posting engine; production state is an explicit lifecycle.
- NOTE: this is post-integrity and lower-risk — confirm with the user whether to
  proceed with Phase 14 (furniture depth) or instead spend the next phase WIRING
  the built engines into the UI (arguably higher user value now that the core is
  complete). Use AskUserQuestion if unsure.

## Forbidden regressions
- Keep every prior guarantee (VAT default guard, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count, durable e-Factura + idempotent upload, SAF-T reconciles,
  per-firm period close + firm-scoped reports, session freshness, no-LWW-on-posted,
  keyset query bounds).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–13 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` depends on `@gr/core-domain`, `@gr/data`, `@gr/fiscal-ro`.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `eb0f76f` (+ doc commit).
> ALL launch-blocking integrity phases (0–13) are done (Phase 2
> IMPLEMENTED_NOT_POSTGRES_VERIFIED). Remaining cross-cutting work is UI/transport
> wiring of the built engines + external gates (see handoff). Decide the next
> phase: either Phase 14 (furniture/Mobila manufacturing depth — production
> lifecycle + BOM-driven atomic material consumption through postDocument) or a
> UI-wiring phase that surfaces the persisted ledgers, commands, e-Factura/SAF-T,
> and the keyset document query in the app. Ask the user which to prioritize if
> unclear. Update the ledger + handoff. No claim without evidence.
