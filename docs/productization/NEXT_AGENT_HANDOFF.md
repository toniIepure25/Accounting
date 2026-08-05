# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat Phase 0.

## Exact position
- Branch: `main`
- HEAD SHA: `b9fd2ae` (worktree clean after doc commit)
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** (done): baseline + governance artifacts.
- **Phase 1 — effective-dated RO VAT** (**complete** at the safely-supported level):
  temporal engine (`tva-temporal.ts`), persisted `tax_rules` (migrations 0011/0012)
  with real-SQLite tests, `TaxRuleRepository` + DB-vs-domain equivalence, product
  `codCategorieFiscala` + backfill, silent 19% default removed (guard test),
  DocumentEditor resolves via engine, read-only admin registry. Primary-official
  evidence recorded (Law 141/2025, ANAF text read directly). `P1-R5b` (immutable
  posted-line tax snapshot) is intentionally **blocked by Phase 3** — nullable
  snapshot columns already added to `documente_linii` (forward-compatible).
- **Phase 2 — transactions** (**IMPLEMENTED_NOT_POSTGRES_VERIFIED**):
  `SqlExecutor.transaction`, error taxonomy (`tx-errors.ts`), real-SQLite impl
  (`better-sqlite.ts`, tested), Tauri impl (mirrored), PostgreSQL impl
  (`pg-executor.ts`, dedicated client + bounded retry + whitelisted isolation),
  `withExecutor(tx)` repo binding, 12 SQLite contract tests + 7 binding/fault +
  6 PG fake-pool + 1 gated real-PG (skipped locally), ADR-0005, CI postgres job.

## Current test/build state (evidence, this session)
- `npm run typecheck` → 10/10.
- `npx turbo run test --force` → **236 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 99, data 52, license 22, ui 22, fiscal-ro 11,
  auth 10, sync 9, ai 5, server 6.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (needs the CI service), Tauri native build,
  e2e was updated (595→605) but not re-run this session — re-run before relying on it.

## Next priority: Phase 3 — authoritative application commands + transactional document aggregate
Start from the PROVEN transaction foundation:
1. Create `packages/application` with real command handlers (not empty interfaces,
   not CRUD wrappers). First target: `PostDocument` writing document + lines +
   (later) stock + journal + audit inside ONE `exec.transaction(...)` via
   `withExecutor(tx)`. Reuse the fault-injection harness pattern from
   `transaction-integration.test.ts` for partial-write safety.
2. Persist the immutable tax snapshot on posted lines (`P1-R5b`): fill
   `tax_rule_id`/`tax_rule_version`/`resolved_tax_rate_bp`/`tax_category`/
   `tax_legal_reference`/`tax_resolution_snapshot` (columns already exist) using
   `rezolvaTvaPersistat`.
3. Document lifecycle (ADR-0003): draft→approved→posted→reversed|cancelled;
   block PATCH/DELETE on posted docs; corrections via reversal/credit note.
4. Optimistic locking + idempotency + DB-unique numbering (Phase 4) follow.

Do NOT: create superficial empty `packages/application`; call a state patch
"posting"; claim atomic business posting from the transaction helper alone;
mark posted docs immutable before all modification paths are blocked.

## Forbidden regressions
- Keep `RegulaTvaInexistenta` (no silent VAT default); keep the guard test green.
- Do not reintroduce `.default(19)` on entity VAT fields.
- Do not weaken the transaction contract (rollback preserves original error;
  bound executor throws after completion; PG always releases; retry only on
  40001/40P01).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not close RK-02 until Phase 3 commands actually use transactions.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`, not `pkill`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- `better-sqlite3` is the Node test SQLite (dev-dep in `@gr/data`), NOT exported
  from the package index (keeps the native module out of the web bundle).

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `b9fd2ae`. Phase 0/1 done,
> Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED. Begin Phase 3: create
> `packages/application` with a real transactional `PostDocument` command
> (document + lines + tax snapshot, atomic via `withExecutor(tx)`), persist the
> posted-line tax snapshot (P1-R5b), and enforce the document lifecycle
> (posted = immutable). Use the fault-injection harness for partial-write tests.
> Update the ledger + handoff. No claim without evidence.
