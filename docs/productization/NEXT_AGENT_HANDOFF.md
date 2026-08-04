# Next-agent handoff

Continuation state for the productization program. Read this + the ledger before
resuming; do not restart planning from zero.

## Exact position
- Branch: `main`
- HEAD SHA: `e8fe000` (worktree clean)
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). **Note:** `git push`
  is blocked by the sandbox's auto-mode classifier (outward-facing to a public
  repo). The user must run `git push` themselves, or grant a Bash permission rule.
  Local commits are ahead of `origin/main` after this session — confirm with
  `git status -sb` / `git log origin/main..HEAD`.

## Completed this session
- **Phase 0 (done):** `docs/productization/` — BASELINE_AUDIT.md,
  MASTER_PRODUCTIZATION_PLAN.md (20 phases, requirement IDs), EXECUTION_LEDGER.json,
  ADR-0001..0004, RISK_REGISTER.md, RELEASE_READINESS.md. Commit `ebd8338`.
- **Phase 1 core (done):** `packages/core-domain/src/tva-temporal.ts` +
  `tva-temporal.test.ts` — effective-dated VAT engine; RO rates verified against
  authoritative sources (Law 141/2025, effective 2025-08-01: 19%→21%, 5%&9%→11%).
  13 tests green. Commit `e8fe000`.

## Current test/build state (evidence)
- `npm run typecheck` → 10/10 packages OK.
- `npm test` → **192 tests** (core-domain now **94**, others unchanged:
  data 22, license 22, ui 19, fiscal-ro 11, auth 10, sync 9, ai 5).
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (verified earlier). E2E → 4 green (verified earlier).
- **Not run this session:** PostgreSQL integration, Tauri build, e2e re-run
  (unaffected by pure-domain changes). No fabricated results.

## Next highest-priority action
Finish **Phase 1** then proceed to **Phase 2** (both launch-blocking), in order:

1. **P1-R2b** — persist tax rules: new migration `0011_tax_rules.sql` (temporal
   `tax_rules` table: id, versiune, jurisdictie, categorie, cod_categorie_fiscala,
   procent, valid_de_la, valid_pana_la, referinta_legala, descriere), seed
   `REGULI_TVA_RO`, a query service, an admin screen, and **wire the runtime**:
   replace the hardcoded `COTE_TVA_RO.STANDARD` default in
   `packages/core-domain/src/entities/produs.ts` and any UI VAT pickers so the
   effective rule drives the rate. Remove the stale `cote_tva` table or migrate it.
   (`entities/produs.ts:20` currently defaults `cotaTvaProcent` to 19.)
2. **P1-R5** — persist the resolved rule/version on posted lines. **Blocked by P3**
   (needs the document aggregate + posting); do it when P3 lands.
3. **Phase 2 (P2-R1..R3)** — add `SqlExecutor.transaction(options, work)` with
   SQLite (`BEGIN IMMEDIATE`) + PostgreSQL (serialization retry) implementations
   and a fault-injection test that proves no partial mutation after a failure at
   each step. This unblocks Phases 3/5/6.

## Forbidden regressions (do not undo)
- Do not reintroduce a silent VAT default; keep `RegulaTvaInexistenta`.
- Do not delete/rewrite `tva.ts` (`calculLinie`, `COTE_TVA_RO`) — widely used;
  the temporal engine composes with it (resolve → percent → `calculLinie`).
- Do not mutate historical/posted tax treatment when rules change.
- Keep money in minor units (`Bani`); no floats.
- Do not weaken the 192-test / 10-typecheck / clean-lint baseline.

## Key design decisions (context)
- Tax rules are DATA with half-open validity `[validDeLa, validPanaLa)`; product
  carries a stable `codCategorieFiscala`, rate changes via new rule versions.
- `redus_9` / `redus_5` are historical fiscal categories both folding to 11% from
  2025-08-01; fine-grained product→category mapping (secondary legislation) is a
  later refinement — seed is correct at the *rate* level on both sides.
- ADRs 0001–0004 define the target: command/application layer, immutable ledgers +
  transactions, document lifecycle, effective-dated tax rules.

## Environment gotchas
- Windows: `tsx watch` respawns fight over port 8787; kill with
  `Get-NetTCPConnection -LocalPort 8787 | Stop-Process`, NOT `pkill`.
- Turbo caches test output; use `npx turbo run test --force` to see counts.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program from `docs/productization/`.
> HEAD `e8fe000`, Phase 0 done, Phase 1 core done. Next: P1-R2b (persist tax
> rules migration + admin UI + wire runtime off the hardcoded 19% default in
> entities/produs.ts), then Phase 2 (SqlExecutor.transaction with SQLite/PG +
> fault-injection tests). Follow the operating principles and update the ledger +
> handoff as you go. No claim without evidence.
