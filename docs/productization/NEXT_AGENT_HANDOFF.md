# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `8d2bef8` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** governance; **Phase 1** effective-dated RO VAT; **Phase 2**
  transactions (IMPLEMENTED_NOT_POSTGRES_VERIFIED); **Phase 3** commands & aggregate;
  **Phase 4** locking/idempotency/numbering; **Phase 5** stock ledger; **Phase 6**
  accounting journal; **Phase 7** fiscal-event ledger.
- **Phase 8 — e-Factura SPV workflow** (done):
  - Migration 0018: `efactura_submissions` (durable per-document lifecycle: state,
    ANAF upload index, status, download id, idempotency key, timestamps; partial
    unique index blocks a second active submission).
  - `packages/core-domain/src/efactura-spv.ts` — pure state machine
    ciorna_xml→validat→incarcat→acceptat|respins (eroare = retryable transport).
  - `packages/fiscal-ro/src/efactura-builder.ts` — build CIUS-RO `EFacturaInput`
    from the posted invoice + firma + partener + `valideazaStructuralEFactura`.
  - `packages/data/src/efactura-repo.ts` — create/get/update submission.
  - `packages/application/src/efactura.ts` — `pregatesteEfactura` (build XML +
    structural validate + persist, idempotent), `incarcaEfactura` (upload via an
    INJECTED uploader; idempotent — a retry never re-submits; transport failure →
    retryable `eroare`), `inregistreazaRaspunsSpv` (accept/reject).
  - Tests: 4 pure + 7 real-SQLite (with a fake uploader).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **320 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 136, data 52, application 47, ui 22, license 22,
  fiscal-ro 11, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV.

## What is intentionally NOT done yet (be honest)
- **Real SPV transport + digital signature** live in the server/desktop integration,
  not the command layer — the uploader is injected and faked in tests. Official
  ANAF XSD/CIUS-RO validation and a live round-trip are external gates.
- **UI/transport wiring** (from Phase 3) and **UI reports** (`useStoc`, accounting/
  fiscal pages, `fiscal-ro` d394/d390) still compute from documents — point them at
  the persisted ledgers, and add an e-Factura panel driving the new commands.
- Effective-dated posting profiles / dimensions / periods remain a later refinement.

## Next priority: Phase 9 — SAF-T (D406) canonical + validation
1. Build a **canonical SAF-T** model from the persisted ledgers (journal + stock +
   fiscal events + master data), not an ad-hoc structural subset —
   `packages/fiscal-ro/saft.ts` already has a subset; replace its source with the
   persisted ledgers so it reconciles to the accounting.
2. Emit the **D406 XML** structure; validate structurally; mark
   EXTERNAL_REVIEW_REQUIRED against the official ANAF SAF-T validator (cannot run
   in-env).
3. Cover master data (accounts, customers/suppliers, products), general-ledger
   entries (from `journal_lines`), and source documents; reconcile SAF-T GL totals
   to the trial balance.
- Acceptance: SAF-T is generated from persisted ledgers and reconciles to the
  journal/trial-balance; structural validity checked; official validator = external.

## Forbidden regressions
- Keep every prior guarantee (no-unsafe-VAT-default, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count + journal reconciliation, durable e-Factura + idempotent
  upload).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–8 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` now also depends on `@gr/fiscal-ro` (run `npm install` after pull).

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `8d2bef8` (+ doc commit).
> Phases 0–8 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report + real-SPV/official-validator wiring still pending). Begin Phase 9:
> generate a canonical SAF-T (D406) from the PERSISTED ledgers (journal_lines +
> stock + fiscal events + master data), emit the D406 XML structure, validate
> structurally, and reconcile SAF-T GL totals to the trial balance. Replace the
> ad-hoc subset in `fiscal-ro/saft.ts` with the ledger-sourced model. Mark
> EXTERNAL_REVIEW_REQUIRED against the official ANAF SAF-T validator (cannot run
> in-env). Update the ledger + handoff. No claim without evidence.
