# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `2388c74` before the doc commit (the doc commit is the tip).
- Remote: `https://github.com/toniIepure25/Accounting` (HTTPS). `git push` is
  blocked for the agent by the sandbox classifier — the USER must push. Confirm
  ahead/behind with `git log --oneline origin/main..HEAD`.

## Completed
- **Phase 0** governance; **Phase 1** effective-dated RO VAT; **Phase 2**
  transactions (IMPLEMENTED_NOT_POSTGRES_VERIFIED); **Phase 3** commands & aggregate;
  **Phase 4** locking/idempotency/numbering; **Phase 5** stock ledger; **Phase 6**
  accounting journal; **Phase 7** fiscal-event ledger; **Phase 8** e-Factura SPV.
- **Phase 9 — SAF-T (D406) canonical** (done):
  - `packages/fiscal-ro/src/saft.ts` — `agregaGeneralLedger` (per-account turnover
    + closing balance), `reconciliazaGeneralLedger` (Σdebit==Σcredit); `genereazaSaftXML`
    now emits GeneralLedgerAccounts + GeneralLedgerEntries from persisted journal
    lines (was a document-only subset).
  - `packages/data/src/journal-repo.ts` — `listeazaLiniiJurnalInterval`.
  - `packages/application/src/saft.ts` — `genereazaSaftDinRegistre` assembles the
    D406 AuditFile from the persisted ledgers for a period + returns the GL
    reconciliation.
  - Tests: 3 pure fiscal-ro + 3 real-SQLite (GL reconciles to journal_lines totals,
    GeneralLedgerEntries present, interval restricts the period).

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **326 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 136, data 52, application 50, ui 22, license 22,
  fiscal-ro 14, auth 10, sync 9, server 6, ai 5.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV.

## What is intentionally NOT done yet (be honest)
- **Official ANAF validators** (SAF-T XSD/business rules, e-Factura CIUS-RO, live
  SPV round-trip) can't run in-env — `EXTERNAL_REVIEW_REQUIRED`. SAF-T opening
  balances and full D406 field coverage are later refinements.
- **UI/transport wiring** (from Phase 3) and **UI reports** (`useStoc`, accounting/
  fiscal/SAF-T pages) still compute from documents in some paths — point them at
  the persisted ledgers; add e-Factura + SAF-T panels driving the new commands.
- **Multi-company scoping is incomplete**: rows with `firma_id IS NULL` are global;
  period-close (`perioadaBlocataPanaLa`) is enforced globally, not per firma. This
  is the Phase 10 focus.

## Next priority: Phase 10 — multi-company correctness + period closing
1. **Company scoping**: ensure every posted document + its ledger effects (stock,
   journal, fiscal events, e-Factura) carry `firma_id`, and that all reads/reports
   filter by the active firm. Backfill/guard so a null-firma row can't leak across
   companies (RK-10). The stock/journal/fiscal/efactura repos already store
   `firma_id` — enforce it on the read paths + numbering (the unique numbering
   index already keys on firma_id).
2. **Period close per company**: `perioadaBlocataPanaLa` should block posting/
   reversal for THAT firm only (today `celMaiRecentBlocaj` is global — see
   `documents.ts`); move the check into the posting command per firm.
3. Tests: two firms; a document/report in firm A never sees firm B's data; posting
   into a closed period is rejected per firm.
- Acceptance: no cross-company leakage; period close is per-firm and enforced at
  the authoritative posting step.

## Forbidden regressions
- Keep every prior guarantee (VAT default guard, posted-doc immutability,
  transaction contract, locking, idempotency, stock atomicity + never-clamp,
  balanced journal + reversal-nets-to-zero + stock↔accounting reconcile, fiscal
  events no-double-count, durable e-Factura + idempotent upload, SAF-T reconciles).
- Keep money in minor units; keep migrations passing on real SQLite.
- Do not weaken Phase 3–9 tests to make new work pass.

## Environment gotchas
- Windows: kill stray servers with `Get-NetTCPConnection -LocalPort <p> | Stop-Process`.
- Turbo caches tests; use `npx turbo run test --force` for counts.
- Import the Node SQLite adapter via `@gr/data/node-sqlite`.
- FK enforcement is ON in the better-sqlite test env — seed referenced rows first.
- Tests that post a SALE need opening stock (default policy denies sub-zero).
- `@gr/application` depends on `@gr/core-domain`, `@gr/data`, `@gr/fiscal-ro`
  (run `npm install` after pull).

## Continuation prompt (paste to resume)
> Resume the Accounting productization program. HEAD `2388c74` (+ doc commit).
> Phases 0–9 done (Phase 2 IMPLEMENTED_NOT_POSTGRES_VERIFIED; UI/transport + UI
> report + official-validator wiring still pending). Begin Phase 10: enforce
> multi-company scoping end-to-end (every posted document + stock/journal/fiscal/
> efactura row carries firma_id; all reads/reports filter by the active firm; no
> null-firma cross-company leakage — RK-10) and make period-close
> (perioadaBlocataPanaLa) per-firm, enforced at the posting command. Add tests with
> two firms proving isolation + per-firm period-close rejection. Update the ledger
> + handoff. No claim without evidence.
