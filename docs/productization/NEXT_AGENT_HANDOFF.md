# Next-agent handoff

Continuation state. Read this + the ledger before touching code. Do not restart
planning or repeat earlier phases.

## Exact position
- Branch: `main`
- HEAD SHA: `a45f87d` (WIRING-8 code) before the doc commit (the doc commit is the tip).
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
- **UI/transport wiring, slice 2 (WIRING-2)**: `createCommandClient` (`@gr/data`) +
  `useComenzi` (`@gr/ui`) — in network mode the DocumentEditor validate action writes
  the doc as a ciorna then posts via `POST /commands/post-document` (engine atomic),
  not a `stare='validat'` CRUD flip; local demo keeps the flip (no engine). 4 unit
  tests + verified LIVE in the Browser preview. See `packages/ui/src/hooks/useComenzi.ts`,
  `packages/ui/src/components/DocumentEditor.tsx`.
- **UI/transport wiring, slice 3 (WIRING-3)**: (a) storno button on validat docs →
  `POST /commands/reverse-document` (`comenzi.storneaza`), engine writes inverse
  entries + original stays immutable (local flips to stornat); (b) accounting reports
  read the persisted journal — `journal-repo.listeazaNoteContabilePersistate` +
  `@gr/data createReportsClient` + `@gr/ui useRapoarte` + server `GET /reports/journal`
  (firma-scoped); `useContabilitate` prefers persisted notes in network mode, so
  registru-jurnal / cartea mare / balanta / fisa reflect the ledger, not a recompute.
  +3 @gr/data tests + verified LIVE (post BON → storno → both shown in the persisted
  Registru-jurnal, balanced, reverse-nets-to-zero). See `packages/ui/src/hooks/useRapoarte.ts`,
  `packages/ui/src/hooks/useContabilitate.ts`, `server/src/index.ts` (`/reports/journal`).
- **UI/transport wiring, slice 4 (WIRING-4)**: STOCK reports read the persisted stock
  ledger — `stock-ledger-repo.listeazaMiscariStocPersistate` (+ doc-code join) /
  `listeazaSolduriStoc`, `@gr/data createReportsClient.stoc()`, server
  `GET /reports/stock` (firma-scoped, `rapoarte.vizualizare`); `useStoc` reads it in
  network mode (recompute fallback local; nomenclatoare from provider in both). +3
  @gr/data tests + verified LIVE (+10 MDF18 → Balanta stocurilor 10/PMP 70.00/700.00 +
  Fise de magazie Intrare 10/700.00 from `/reports/stock`). See `packages/ui/src/hooks/useStoc.ts`.
- **UI/transport wiring, slice 5 (WIRING-5)**: the D300 decont reads the persisted
  fiscal-event ledger — server `GET /reports/decont?de=&pana=` → `@gr/application`
  `genereazaDecontDinRegistre` (firma-scoped, no NIR double-counting); `@gr/data`
  `createReportsClient.decont()`; `DecontTvaPage` reads it in network mode (recompute
  fallback local). +1 @gr/data test + verified LIVE (cafea 11% sale → D300 colectata
  6.94 / de plata 6.94, cota 11% baza 63.06). See `packages/ui/src/pages/fiscal.tsx`,
  `server/src/index.ts` (`/reports/decont`).
- **UI/transport wiring, slice 6 (WIRING-6)**: the document list uses the KEYSET query
  (RK-13 downgraded S2→S4) — server `GET /reports/documents` → `interogheazaDocumente`
  (firma-scoped, keyset cursor, bounded LIMIT); `@gr/data createReportsClient.documente()`;
  `@gr/ui useDocumenteTip` loops bounded pages per tip (local fallback list()+filter).
  `DocumentEditor` uses it for the main list + NIR source picker; writes still via
  `db.documente.*` + reload. +1 @gr/data test + verified LIVE (Receptii marfa list +
  Facturi furnizori NIR picker via `/reports/documents`). See
  `packages/ui/src/hooks/useDocumenteTip.ts`.
- **UI/transport wiring, slice 7 (WIRING-7)**: the SAF-T (D406) XML export reads the
  persisted ledger — server `GET /reports/saft?an=&luna=` → `@gr/application`
  `genereazaSaftDinRegistre` (firma from session, reconciled) → `{ xml, reconciliere }`;
  `@gr/data createReportsClient.saft()`; `SaftPage` downloads the server XML in network
  mode + toasts the GL reconciliation (client build fallback local). +1 @gr/data test +
  verified LIVE (direct fetch: valid D406 `<AuditFile>` + `echilibrat:true`; SaftPage
  button → `GET /reports/saft` 200 + download). See `packages/ui/src/pages/fiscal.tsx`.
- **UI/transport wiring, slice 8 (WIRING-8)**: D394/D390 computed SERVER-SIDE, firma-scoped
  — `@gr/application genereazaD394`/`genereazaD390` (`packages/application/src/declaratii.ts`)
  load the firma's documents + parteneri and run the existing `@gr/fiscal-ro` grouparori;
  server `GET /reports/d394?de=&pana=` + `/reports/d390?de=&pana=`; `@gr/data d394()/d390()`;
  `D394Page`/`D390Page` fetch the server result in network mode (client grouparori kept as
  the local fallback). The client no longer pulls/aggregates the full cross-firma document
  + partener tables. +2 @gr/data + +2 @gr/application tests + verified LIVE
  (`/reports/d394` + `/reports/d390` 200 over seed; both pages render firma-scoped rows;
  D390 keeps only the DE intracom partener). NOTE: the network-mode effect refetches a few
  times on mount as `rows`/`parteneri` settle (idempotent GETs, harmless) — a small cleanup
  would drop `rows`/`parteneri` from the network branch's deps.
- **Phase 16 — backup / restore / DR** (done): `packages/data/src/backup-sql.ts` —
  `exportBazaSql`/`importBazaSql` snapshot the WHOLE database including the persisted
  engine ledgers (stock/journal/fiscal/e-Factura/production) that the provider backup
  (`backup.ts`) silently omitted — the real DR fix. Tables are discovered from
  `sqlite_master` (future tables auto-captured; `_migrations` excluded); restore is
  atomic in one transaction with `PRAGMA defer_foreign_keys = ON` so order and the
  documente self-reference don't matter; `verificaIntegritateBackup` gates on a
  balanced journal and reports per-table counts. 8 tests on real SQLite (7 in
  `@gr/data` backup-sql.test.ts, 1 end-to-end post→snapshot→restore in `@gr/application`
  backup-dr.test.ts). **SQLite-focused** — a PostgreSQL deployment still needs
  pg_dump/PITR; encryption + off-site rotation + a scheduled/tested restore runbook
  are Phase 17.
- **Phase 17 — Ops / CI-CD & DR** (in progress): `backupVerificat` (`@gr/data`,
  node-free via injected scratch factory) proves a snapshot restores cleanly before
  it is trusted; `server/src/backup-cli.ts` = `backup`/`restore`/`verify` over SQLite
  files with a SHA-256 checksum (refuses an unbalanced-journal restore); a CI
  `dr-drill` job (`server/scripts/dr-drill.ts`, run via `npx tsx`) exercises the whole
  backup→restore→verify procedure on every push; `docs/ops/DR_RUNBOOK.md` covers
  schedule/encryption/off-site + the PostgreSQL pg_dump/PITR path. +6 tests (+2
  @gr/data, +4 @gr/server). RK-14 downgraded (CI already runs a real PostgreSQL job).
  **Remaining P17**: signed installer/updater (Tauri desktop), a PostgreSQL-native
  backup exporter mirroring `backupVerificat`, in-product backup scheduling/encryption.

## Current test/build state (evidence, this session)
- `npx turbo run typecheck --force` → 11/11.
- `npx turbo run test --force` → **392 passed, 1 skipped** (gated real-PG).
  Per-package: core-domain 138, data 81, application 60, server 22, ui 22,
  license 22, sync 17, fiscal-ro 14, auth 11, ai 5.
- DR drill (`npx tsx server/scripts/dr-drill.ts`) → OK, exit 0 (also a CI job).
- WIRING-2 verified LIVE in the Browser preview (server demo SQLite + UI LAN mode):
  validating a document fired `POST /commands/post-document` (200) and the row
  became `validat`. To reproduce: `preview_start` names `api-server` + `ui-dev`;
  in the UI tab set `localStorage['gr-deployment-mode']='lan'` +
  `['gr-server-url']='http://localhost:8787'`, reload, login `admin`/`admin123`.
- `npx biome check .` → clean (1 pre-existing `noExplicitAny` warning).
- `npm run build:web` → OK (~372 kB).
- **Not run in-env:** real PostgreSQL (CI), Tauri native build, Playwright e2e,
  official ANAF validators / live SPV, independent pen-test.

## What is intentionally NOT done yet (be honest)
Cross-cutting integration debt accumulated across the integrity phases — the
engine layers are built + tested, but not everywhere wired into the UI/transport:
- **UI/transport wiring**: document POST + STORNO are wired to the engine commands in
  network mode (WIRING-2/3); the ACCOUNTING reports (registru-jurnal / cartea mare /
  balanta / fisa via `useContabilitate`) read the persisted journal
  (`GET /reports/journal`); the STOCK reports (balanta stocurilor / fise de magazie /
  rulaje via `useStoc`) read the persisted stock ledger (`GET /reports/stock`, WIRING-4);
  the D300 decont reads the persisted fiscal-event ledger (`GET /reports/decont`, WIRING-5);
  the document list + source picker read the keyset query (`GET /reports/documents`, WIRING-6);
  the SAF-T (D406) XML export reads the persisted journal (`GET /reports/saft`, WIRING-7);
  D394/D390 are computed server-side, firma-scoped (`GET /reports/d394` + `/reports/d390`,
  WIRING-8). Still generic/not-yet-wired: the safe reconciliation + offline command queue
  (Phase 12) aren't in the client sync loop; no backup/restore UI action yet. All of the
  wired reads apply only in NETWORK mode — local/demo (memory, no engine) still recomputes,
  so a browser SQLite engine for local mode would unify the two paths.
- **External gates**: official ANAF validators (SAF-T, e-Factura) + live SPV
  round-trip + independent pen-test + external accountant/legal review.
- **Data**: legacy `firma_id IS NULL` rows globally visible until a backfill;
  in-memory revocation store needs Redis for multi-instance.
- **Demo-seed defect (found during WIRING-2 verification, pre-existing)**: the
  numbering allocator (`serii_documente`) is NOT seeded to match the pre-seeded
  demo documents, so the first create of an already-seeded document type (e.g. a
  new `receptie_furnizor` NIR) collides on `ux_documente_numar` → 500. Only affects
  the demo seed, not the engine. Fix: seed `serii_documente` to the max existing
  number per (firma, tip, year, serie), or make `demoSeed` documents go through the
  numbering allocator. Tracked as a background task.

## Next priority (user chose UI-wiring + Mobila + Ops; Mobila + P16 + P17-R1 done)
Remaining build directions the user selected:
- **UI/transport wiring** — POST + STORNO + accounting reports + STOCK reports + D300
  decont + document LIST + SAF-T XML + D394/D390 are wired (WIRING-2..8). Next slices:
  (1) the offline command queue + safe reconciliation (`reconcileSigur`, `comenziDeReluat`
  in `@gr/sync`) into the client sync loop — the biggest remaining Phase-12 UI gap;
  (2) a backup/restore action in the UI (`backupVerificat`/`importBazaSql` ready — likely a
  server `POST /admin/backup` returning the snapshot, restore gated carefully); (3) the
  fiscal_events-native rewrite of D394/D390 (working drafts today); (4) optionally a browser
  SQLite engine for LOCAL mode so the same ledger-reads apply offline. Verify with the
  Browser preview (`preview_start` `api-server` + `ui-dev`, LAN mode; login admin/admin123)
  per the run skill.
  - NOTE 1: restarting/reloading `api-server` (tsx watch) resets the in-memory demo DB +
    SESSION_SECRET — clear `localStorage['gr-user']` + re-login after a server change.
  - NOTE 2 (env quirk seen this session): after MANY tsx-watch reloads a browser tab's UI
    auth can wedge (login POST 200 but `gr-user` never persists, repeated background 401s);
    a FRESH browser tab logs in cleanly. Not a code regression — use a new tab if it happens.
- **Ops (Phase 17 — remaining)** — signed installer/updater for the Tauri desktop
  app (auto-update channel), a PostgreSQL-native backup exporter mirroring
  `backupVerificat` (catalog discovery + proven restore), and in-product backup
  scheduling + encryption/off-site rotation (the CLI + DR drill + runbook already exist).
Pick per user priority; if unclear, ask. The most user-visible next step is now
**UI/transport wiring** (the whole engine + ops layer is built and tested but the
React app still writes via generic CRUD on several paths).

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
