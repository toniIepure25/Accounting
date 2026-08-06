# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `323878a` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** governance; **Phase 1** effective-dated RO VAT (persisted rules,
  no silent default, posted-line tax snapshot done in P3).
- **Phase 2** transactions (IMPLEMENTED_NOT_POSTGRES_VERIFIED).
- **Phase 3** commands & aggregate: `@gr/application` (`postDocument` + lifecycle +
  reversal), pure `document-aggregate.ts`, server immutability guard.
- **Phase 4** optimistic locking (`Document.version`/`expectedVersion`, 409),
  idempotency store (`idempotency_keys` + `cuIdempotenta`), partial unique
  numbering index. Migration 0014.
- **Phase 5 — persistent immutable stock ledger** (done):
  - Migration 0015: append-only `stock_ledger_entries` (running qty/value/CMP
    after each move) + materialized `stock_balances` (PK gestiune+produs).
  - `packages/core-domain/src/stock-ledger.ts` — pure CMP engine
    (`posteazaStocDocument`): exits at weighted-average cost, transfer conserves
    value, negative-stock policy `interzice`(default)/`avertizeaza`/`permite`
    (NEVER a silent clamp), `StocInsuficientError`.
  - `packages/data/src/stock-ledger-repo.ts` — read balance / append entry /
    upsert balance (ON CONFLICT) / list.
  - `packages/application/src/stock.ts` — `emiteStocDocument` (called by
    `postDocument` in the SAME transaction; sub-zero exit rolls back the whole
    posting) and `stornoStocDocument` (called by `reverseDocument`; compensating
    entries net the ledger to zero).
  - Tests: 7 pure engine + 6 real-SQLite application.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **284 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 118, data 52, application 29, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e.

## What is intentionally NOT done yet (be honest)
- **UI/transport wiring** (carried from Phase 3): the React UI still saves via the
  generic provider in some paths; the web-demo memory provider has no executor.
- **UI stock report** (`useStoc`) still recomputes stock in-memory in some paths —
  it should read the persisted `stock_balances`.
- **Accounting ledger** is still derived, not persisted — that is Phase 6 (RK-03
  only downgraded for stock).
- Multi-process oversell/numbering races are meaningful only on PostgreSQL (CI);
  the SQLite tests are single-connection.

## Next priority: Phase 6 — persistent immutable accounting (journal) ledger
1. **Tables**: `journal_entries` / `journal_lines` (effective-dated posting
   profiles, dimensions, periods). Append-only, like the stock ledger.
2. **postDocument emits journal lines** inside the SAME `exec.transaction` as the
   document + stock (extend the atomic posting; reuse the fault-injection harness).
   Every entry balanced: Σdebit = Σcredit.
3. **Posting profiles**: map document type → accounts (effective-dated, like VAT).
   NIR↔invoice must not double-count (respect `documentSursaId`, mirror the
   existing `contabilitate.ts` rules but persisted).
4. **Reversal** emits compensating journal lines that net to zero; reports read
   the persisted journal; stock↔accounting reconcile.
- Acceptance: persisted, balanced, source-traceable; reversal nets to zero;
  stock and accounting reconcile. `packages/core-domain/src/contabilitate.ts`
  already computes notes in-memory — persist that, don't reinvent it.

## Forbidden regressions
- Keep: no-unsafe-VAT-default guard, posted-doc immutability, transaction
  contract, optimistic locking, idempotency, stock atomicity + never-clamp.
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3/4/5 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- SQL unique indexes treat NULL as distinct — set non-null `firma_id` in tests
  exercising the numbering constraint.
- Tests that post a SALE need opening stock (default policy denies sub-zero) —
  either post a receipt first or seed a `stock_balances` row.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `323878a` (+ doc commit).
> Phases 0–5 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport +
> UI stock-report wiring still pending). Begin Phase 6: a persistent, append-only
> accounting journal (`journal_entries`/`journal_lines`), emitted by
> `postDocument` inside the same transaction as the document + stock ledger
> (atomic; reuse the fault-injection harness), every entry balanced
> (Σdebit=Σcredit), with effective-dated posting profiles and no NIR↔invoice
> double-count. Persist the logic already in `contabilitate.ts`; reversal nets to
> zero; stock↔accounting reconcile. Update the ledger + handoff. No claim without
> evidence.
