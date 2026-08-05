# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `936a641` (worktree clean before the doc commit; the doc commit is the tip)
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** (done): baseline + governance artifacts.
- **Phase 1 — effective-dated RO VAT** (done): temporal engine, persisted
  `tax_rules`, product `codCategorieFiscala`, silent-default removal + guard,
  read-only admin registry. **P1-R5b now done** — the immutable posted-line tax
  snapshot is populated at posting (see Phase 3).
- **Phase 2 — transactions** (IMPLEMENTED_NOT_POSTGRES_VERIFIED): `SqlExecutor.transaction`,
  error taxonomy, real-SQLite impl, Tauri impl, PostgreSQL impl + CI job, `withExecutor`.
- **Phase 3 — commands & aggregate** (done):
  - `packages/core-domain/src/document-aggregate.ts` — pure lifecycle
    (ciorna→aprobat→validat(posted)→stornat|anulat), transition table,
    immutability rules, server-side total recompute, invariant validation (12 tests).
  - `packages/application` (`@gr/application`) — authoritative command handlers:
    `postDocument` (document+lines+**immutable tax snapshot** atomic in one
    `exec.transaction`, BEGIN IMMEDIATE, via `withExecutor(tx)`; VAT resolved from
    persisted rules; legal number allocated at posting), `createDraftDocument`,
    `updateDraftDocument` (immutability-guarded), `approveDocument`,
    `cancelDocument`, `reverseDocument` (posted→reversed + linked negated storno,
    snapshot copied), `asertaDocumentEditabilPersistat` guard. 13 real-SQLite tests
    incl. fault-injection (no partial write, no number burned).
  - Migration `0013_produse_cota_nullable.sql` removed the last unsafe VAT DB
    default (`produse.cota_tva_procent NOT NULL DEFAULT 19`).
  - Server enforces posted-document immutability on generic REST PATCH/DELETE (409).
  - `@gr/data` now exposes `./node-sqlite` (better-sqlite adapter) for Node consumers.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **261 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 111, data 52, application 13, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI service), Tauri native build, Playwright e2e.

## What is intentionally NOT done yet (be honest about this)
- **UI/transport wiring per deployment mode.** The command layer + server guard
  exist and are tested, but the React UI still saves via the generic provider in
  some paths, and the web-demo memory provider has no transaction/executor. Wiring
  `postDocument` end-to-end (SQLite/desktop, API/server, and a memory fallback for
  the demo) is the remaining Phase 3 integration.
- Posting does not yet emit persisted **stock/accounting** effects — those ledgers
  don't exist until Phase 5/6. `reverseDocument` flips state + emits the mirror
  document; ledger reversal attaches when the ledgers persist.

## Next priority: Phase 4 — optimistic locking, numbering, idempotency
1. **Optimistic locking**: `version` + `expectedVersion` on document
   update/post; conflict response (409) instead of last-write-wins.
2. **Idempotency store**: key + request hash + stored response, so a retried
   `postDocument` never posts twice / never allocates a second number.
3. **DB unique constraint** on `(firma, tip, an, serie, numar)`; allocate the
   number at the authoritative step (already done in `postDocument`) and let the
   constraint be the backstop under concurrency.
- Acceptance: zero duplicate numbers/postings under concurrent retries. Reuse the
  fault-injection harness; add a concurrency test (two `postDocument` on the same
  draft — one wins, one gets a conflict).

## Forbidden regressions
- Keep `RegulaTvaInexistenta` / the no-unsafe-VAT-default guard green.
- Keep posting atomic; keep posted docs immutable (aggregate + server guard).
- Keep the transaction contract intact (rollback preserves original error; bound
  executor throws after completion; PG always releases; retry only on 40001/40P01).
- Do not weaken the Phase 3 tests to pass new work.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- `better-sqlite3` is the Node test SQLite; import the adapter via
  `@gr/data/node-sqlite` (keeps the native module out of the web bundle).
- FK enforcement is ON in the better-sqlite test env — seed referenced rows
  (partener/gestiune/produs) before inserting documents.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `936a641`. Phases 0–3 done
> (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; Phase 3 command layer + aggregate +
> server immutability done, UI/transport wiring remaining). Begin Phase 4:
> optimistic locking (version/expectedVersion + 409 conflict), an idempotency
> store for `postDocument`, and a DB unique constraint on
> (firma, tip, an, serie, numar). Add a concurrency test proving no duplicate
> number/posting under retries, reusing the fault-injection harness. Update the
> ledger + handoff. No claim without evidence.
