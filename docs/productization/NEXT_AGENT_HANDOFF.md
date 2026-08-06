# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `74b64d8` before the doc commit (the doc commit is the tip).
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
- **Phase 5** persistent stock ledger (CMP, transfer conservation, never-clamp).
- **Phase 6** persistent double-entry accounting journal (balanced; reversal nets
  to zero; stock↔accounting reconcile).
- **Phase 7 — fiscal event ledger** (done):
  - Migration 0017: append-only `fiscal_events` (direction/rate/base/VAT/partner/
    country/context).
  - `packages/core-domain/src/fiscal-events.ts` — pure
    `genereazaEvenimenteFiscaleDocument` (direction by type, grouped by posted-line
    rate; respects the shared 3-way NIR match) + `decontDinEvenimente` (D300 base).
  - `packages/data/src/fiscal-events-repo.ts` — write / list by interval / by doc.
  - `packages/application/src/fiscal.ts` — `emiteEvenimenteFiscaleDocument`
    (called by `postDocument` atomically after the journal; `esteFacturaAcoperitaDeNir`
    shared with the journal) + `stornoEvenimenteFiscaleDocument` (negates events).
  - Tests: 7 pure + 5 real-SQLite (no NIR↔invoice double count, reconciles to
    journal 4426/4427, interval filter, reversal nets to zero).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **309 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 132, data 52, application 40, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators.

## What is intentionally NOT done yet (be honest)
- **UI/transport wiring** (from Phase 3): UI still saves via the generic provider
  in some paths; the web-demo memory provider has no executor.
- **UI reports** (`useStoc`, accounting/fiscal pages, `fiscal-ro` d394/d390) still
  compute from documents — point them at the persisted stock/journal/fiscal-event
  ledgers.
- **Official declaration XML** (D300/D394/D390/SAF-T) and the ANAF validator are
  external gates — the code computes correct bases/recaps but does not emit the
  official filing format verified against the real validator.
- Effective-dated posting profiles / analytic dimensions / periods are a later
  refinement (current profile is the fixed RO monografie).

## Next priority: Phase 8 — e-Factura end-to-end (SPV workflow)
1. **Durable SPV state machine** per invoice: draft-XML → validated → uploaded →
   {accepted | rejected} → stored (with ANAF upload id, status, timestamps,
   error messages), persisted — not the current generate/download-only path.
2. Build the **e-Factura UBL/CIUS-RO XML** from the posted document + fiscal
   snapshot (reuse `packages/fiscal-ro/efactura.ts`); validate structure; mark
   EXTERNAL_REVIEW_REQUIRED where the official ANAF/SPV validator can't run in-env.
3. Idempotent upload + poll (reuse the Phase 4 idempotency store); retries never
   double-submit; store the SPV response atomically.
4. B2C CNP handling and the mandatory-e-Factura thresholds already sketched in
   `efactura.ts` — persist and enforce at posting.
- Acceptance: an invoice has a durable, auditable SPV lifecycle; XML is
  structurally valid; no double submission under retry. Real SPV round-trip is an
  external gate (needs ANAF credentials/endpoint).

## Forbidden regressions
- Keep every prior guarantee: no-unsafe-VAT-default guard, posted-doc immutability,
  transaction contract, optimistic locking, idempotency, stock atomicity +
  never-clamp, balanced journal + reversal-nets-to-zero + stock↔accounting
  reconcile, fiscal events (no double count + journal reconciliation).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–7 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero) —
  post a receipt first or seed a `stock_balances` row.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `74b64d8` (+ doc commit).
> Phases 0–7 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report + official-XML wiring still pending). Begin Phase 8: a durable, persisted
> e-Factura SPV state machine per invoice (draft-XML → validated → uploaded →
> accepted|rejected, with ANAF upload id/status/errors), building the CIUS-RO XML
> from the posted document + fiscal snapshot, idempotent upload/poll (reuse the
> Phase 4 idempotency store) so retries never double-submit, all persisted
> atomically. Mark EXTERNAL_REVIEW_REQUIRED where the official ANAF/SPV validator
> can't run in-env. Update the ledger + handoff. No claim without evidence.
