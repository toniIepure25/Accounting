# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `fa6dd97` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** governance; **Phase 1** effective-dated RO VAT; **Phase 2**
  transactions (IMPLEMENTED_NOT_POSTGRES_VERIFIED); **Phase 3** commands & aggregate;
  **Phase 4** locking/idempotency/numbering; **Phase 5** stock ledger; **Phase 6**
  accounting journal; **Phase 7** fiscal-event ledger; **Phase 8** e-Factura SPV;
  **Phase 9** SAF-T (D406) from ledgers.
- **Phase 10 — multi-company + period close** (done):
  - `core-domain/documents.ts` — `documentBlocatPentruFirma` (per-firm close).
  - `application/perioada.ts` — `PerioadaInchisaError` + `asertaPerioadaDeschisa`;
    `postDocument`/`reverseDocument` reject posting into the document firm's closed
    period (one firm's close no longer blocks another).
  - `application/fiscal.ts` — `genereazaDecontDinRegistre` (firm-scoped VAT return);
    SAF-T builder already filters by `firma_id`.
  - `server/auth.ts` + `index.ts` — `perioadaBlocataPentru` per-firm (was global).
  - 3 real-SQLite two-firm tests (scoped decont/SAF-T, per-firm close).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **329 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 136, data 52, application 53, ui 22, license 22,
  fiscal-ro 14, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV.

## What is intentionally NOT done yet (be honest)
- **Legacy `firma_id IS NULL` rows stay globally visible** — new posted rows carry
  firma_id, but a backfill/scope-migration for old rows is a later refinement.
- **UI/transport wiring** (from Phase 3) and **UI reports** still compute from
  documents in some paths — point them at the persisted, firm-scoped ledgers; add
  e-Factura + SAF-T + decont panels driving the new commands.
- Official ANAF validators (SAF-T, e-Factura) + live SPV round-trip are external gates.

## Next priority: Phase 11 — auth freshness + security hardening
1. **Session/role freshness (RK-11)**: today role/company changes take effect only
   at token expiry (in-memory revocation, ~12h tokens). Add a session-version /
   reload mechanism so a revoked or role-changed user is rejected promptly
   (bump a per-user `session_version`; include it in the token; reject on mismatch).
   See `packages/auth` + `server/src/auth.ts`.
2. **Security hardening**: verify authz on every mutating route (the command layer
   is authoritative but the generic REST CRUD must not bypass it), rate-limit auth
   endpoints, ensure the immutability + period-close + firma guards can't be
   sidestepped via the generic provider. Consider running `/security-review`.
3. Tests: a role downgrade / revocation takes effect without waiting for expiry;
   protected routes reject stale sessions.
- Acceptance: stale role/company can't act after a revocation; no generic-CRUD
  bypass of the authoritative guards.

## Forbidden regressions
- Keep every prior guarantee (VAT default guard, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count, durable e-Factura + idempotent upload, SAF-T reconciles,
  per-firm period close + firm-scoped reports).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–10 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` depends on `@gr/core-domain`, `@gr/data`, `@gr/fiscal-ro`.

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `fa6dd97` (+ doc commit).
> Phases 0–10 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report wiring + legacy null-firma backfill still pending). Begin Phase 11: auth
> freshness (a session-version/reload mechanism so revoked or role-changed users
> are rejected promptly, not only at token expiry — RK-11) plus security hardening
> (no generic-CRUD bypass of the authoritative immutability/period-close/firma
> guards; rate-limit auth). Add tests proving a revocation/role-change takes effect
> without waiting for expiry. Update the ledger + handoff. No claim without evidence.
