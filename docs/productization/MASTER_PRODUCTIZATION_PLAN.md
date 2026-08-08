# Master productization plan

Traceable plan for turning the ERP into a commercially sellable Romanian
furniture-manufacturing product. Phases execute **strictly in order**; no
lower-priority feature work begins while a launch-blocking phase is incomplete.

Requirement IDs are stable: `P<phase>-R<n>`. Status ∈ `todo | in_progress | done | blocked`.
Evidence and commit SHAs are tracked in [`EXECUTION_LEDGER.json`](EXECUTION_LEDGER.json).

## Guiding gates (a feature is "done" only when all hold)
Implemented · persisted · transactionally safe · authorized server-side · tested
on SQLite **and** PostgreSQL where applicable · failure/concurrency tested ·
documented · observable · upgrade-safe · validated against authoritative external
specs where applicable. No claim without evidence.

## Phase index

| Phase | Theme | Launch-blocking | Status |
|---|---|---|---|
| 0 | Baseline, governance, safety net | yes | done |
| 1 | Temporal (effective-dated) tax engine + current RO VAT | yes | done (P1-R5b posted-line snapshot blocked by P3) |
| 2 | Transaction-capable persistence | yes | IMPLEMENTED_NOT_POSTGRES_VERIFIED |
| 3 | Application commands + document aggregate | yes | done (UI/transport wiring per mode remaining) |
| 4 | Optimistic locking, numbering, idempotency | yes | done (real-PG concurrency race = CI only) |
| 5 | Persistent immutable stock ledger | yes | done (UI report wiring remaining) |
| 6 | Persistent immutable accounting ledger | yes | done (effective posting profiles = later refinement) |
| 7 | Fiscal event ledger + D300/D394/D390 | yes | done (D300 base from events; D394/D390 XML = external gate) |
| 8 | e-Factura end-to-end (SPV workflow) | yes | done (durable+idempotent; real SPV/validator = external gate) |
| 9 | SAF-T / D406 canonical | yes | done (GL from journal, reconciles; ANAF validator = external gate) |
| 10 | Multi-company correctness + period closing | yes | done (per-firm close + scoped reports; null-firma backfill remaining) |
| 11 | Auth freshness + security hardening | yes | done (fresh role + session version; Redis/pen-test = external) |
| 12 | Sync/offline redesign (no LWW for posted data) | yes | done (safe reconcile + idempotent replay; client wiring remaining) |
| 13 | Query model + performance | yes | done (keyset document query + indexes; migrate remaining callers) |
| 14 | Furniture manufacturing differentiation | no (post-integrity) | done (production lifecycle + BOM consumption; UI wiring remaining) |
| 15 | UX / role-based usability | no | todo |
| 16 | Backup, restore, migrations, DR | yes | done (full-DB snapshot/restore incl. ledgers, verified round-trip; PG-native/encryption/runbook = P17) |
| 17 | CI/CD + release engineering | yes | todo |
| 18 | Licensing + customer administration | no | todo |
| 19 | Migration from legacy (KISS/Access, CSV) | no | todo |
| 20 | Docs, support, legal, commercialization | no | todo |

## Requirement register (key requirements per phase)

### P0 — Baseline & governance
- **P0-R1** Baseline audit with evidence — `docs/productization/BASELINE_AUDIT.md`. **done**
- **P0-R2** Master plan with stable requirement IDs — this file. **done**
- **P0-R3** Machine-readable execution ledger. **done**
- **P0-R4** ADRs (command layer, immutable ledgers, doc lifecycle, tax versioning). **in_progress**
- **P0-R5** Risk register + release-readiness checklist. **in_progress**

### P1 — Temporal tax engine
- **P1-R1** Verify current RO VAT rates against authoritative sources (2025 change).
- **P1-R2** Effective-dated `TaxRule` model (valid_from/valid_to, category, context, legal ref, form mappings).
- **P1-R3** Server-side resolver: (date, product category, partner status, transaction context) → rule; explicit error when none applies.
- **P1-R4** Seed current + historical RO rules incl. the 2025 transition.
- **P1-R5** Persist resolved rule/version on every posted line (**depends on P3**).
- **P1-R6** Drafts recalc on date/partner/category/context change; posted docs immutable.
- **P1-R7** Tests: boundaries, historical determinism, mixed/exempt/reverse-charge, transition fixtures, property invariants.
- Acceptance: new docs no longer default to 19% when a later rule applies; resolution server-side; historical determinism.

### P2 — Transactions
- **P2-R1** `SqlExecutor.transaction(options, work)` with rollback-on-failure.
- **P2-R2** SQLite (`BEGIN IMMEDIATE` for stock-sensitive) + PostgreSQL (serialization retry) impls.
- **P2-R3** Fault-injection support; nested-tx semantics defined; timeout strategy.
- Acceptance: induced failure after any step leaves no partial mutation; same contract suite passes on SQLite + PG.

### P3 — Commands & aggregate — **done**
- **P3-R1** `packages/application` with command handlers — **done**: `postDocument`
  (transactional, tax snapshot, number allocation), `createDraft`, `updateDraft`,
  `approve`, `cancel`, `reverse`. CreditNote/ClosePeriod/RecordPayment deferred to
  their owning phases (7/10/…).
- **P3-R2** Document aggregate + lifecycle (ciorna→aprobat→validat→stornat|anulat);
  posted immutable — **done** (pure, 12 tests).
- **P3-R3** Server-side invariant validation + totals recomputed server-side +
  posted-document immutability enforced on generic REST — **done**.
- Acceptance: posting is an atomic business event (one transaction); posted docs
  immutable server-side. Remaining integration: routing the UI/API transport
  through the command layer per deployment mode (memory/api/sqlite).

### P4 — Concurrency & idempotency — **done**
- **P4-R1** Optimistic locking (`version`, `expectedVersion`, conflict response) —
  **done**: `Document.version` bumped on every authoritative write;
  `ConflictOptimistaError` (409) on stale version.
- **P4-R2** Idempotency store (key + request hash + stored response) — **done**:
  `cuIdempotenta` dedupes inside the command transaction; retried `postDocument`
  returns the stored response, allocates no second number.
- **P4-R3** DB unique constraint on `(firma, tip, year, series, number)`; allocate
  at authoritative step — **done**: partial unique index (WHERE numar>0); number
  allocated at posting.
- Acceptance: zero duplicate numbers/postings under retries — verified on real
  SQLite. True multi-process race belongs to the PostgreSQL CI job.

### P5 — Stock ledger — **done**
- **P5-R1** `stock_ledger_entries` (append-only) + `stock_balances` (materialized) —
  **done** (migration 0015; running qty/value/CMP persisted per entry).
- **P5-R2** CMP valuation; transfer value conservation; negative-stock policy
  (interzice/avertizeaza/permite), never clamp — **done** (pure engine
  `stock-ledger.ts`; emitted atomically by `postDocument`; reversal nets to zero).
- Acceptance: reports derive from the persisted ledger; concurrent overselling
  denied by default; value reconciles on transfer. Remaining: wire the UI stock
  report (`useStoc`) to the persisted balances instead of recomputing.

### P6 — Accounting ledger — **done**
- **P6-R1** `journal_entries`/`journal_lines` (append-only, double-entry) —
  **done** (migration 0016). Effective-dated posting profiles / dimensions /
  periods are a later refinement (current profile is the fixed RO monografie).
- **P6-R2** Every entry balanced (Σdebit=Σcredit); NIR↔invoice no double-count —
  **done**: `genereazaNotaDocument` (balanced by construction + `asertaNotaEchilibrata`),
  emitted atomically by `postDocument` with the stock COGS; 3-way match respected;
  reversal swaps debit/credit (nets to zero).
- Acceptance: persisted, balanced, source-traceable; reversal nets to zero;
  stock↔accounting reconcile (account 371 == persisted stock value) — verified on
  real SQLite. External accountant sign-off is a commercial-readiness gate.

### P7 — Fiscal event ledger + declarations — **done**
- **P7-R1** Persistent append-only `fiscal_events` (direction/rate/base/VAT/partner/
  country/context) written at posting — **done** (migration 0017).
- **P7-R2** VAT return (D300 base) derives from events, not document lists;
  no NIR↔invoice double-count; reconciles to the journal (4426/4427); reversal
  nets to zero — **done** (`fiscal-events.ts` + `decontDinEvenimente`).
- Acceptance: declarations read persisted fiscal facts; deductible VAT counted once
  across NIR+invoice; totals reconcile to accounting — verified on real SQLite.
  Official D394/D390 XML + ANAF validator sign-off is an external commercial gate.

### P8 — e-Factura SPV workflow — **done**
- **P8-R1** Durable persisted SPV state machine + submissions — **done**
  (migration 0018; ciorna_xml→validat→incarcat→acceptat|respins, retryable eroare).
- **P8-R2** CIUS-RO XML from the posted invoice + structural validation; idempotent
  upload/poll — **done** (`efactura-builder.ts` + command layer; injected uploader,
  no double submission under retry).
- Acceptance: an invoice has a durable, auditable SPV lifecycle; XML is built from
  the posted document and structurally valid; upload is idempotent — verified on
  real SQLite. Official ANAF XSD/CIUS-RO validation, digital signature, and a live
  SPV round-trip are external commercial gates.

### P9 — SAF-T / D406 canonical — **done**
- **P9-R1** SAF-T GeneralLedgerEntries sourced from the persisted journal +
  balance reconciliation + XML — **done** (`fiscal-ro/saft.ts`).
- **P9-R2** Application builder assembles the D406 AuditFile from persisted ledgers
  for a period; SAF-T GL reconciles to the trial balance — **done** — verified on
  real SQLite.
- Acceptance: SAF-T derives from persisted ledgers and reconciles to the
  journal/trial-balance; structural validity checked. Official ANAF SAF-T
  validator + full D406 field coverage + opening balances are external gates.

### P10 — Multi-company correctness + period closing — **done**
- **P10-R1** Per-firm period close enforced at the posting command — **done**
  (`documentBlocatPentruFirma` + `asertaPerioadaDeschisa`; server guard per-firm).
- **P10-R2** Firm-scoped ledger reports (decont, SAF-T) with no cross-company
  leakage — **done** — verified on real SQLite with two firms.
- Acceptance: period close is per-firm and enforced authoritatively; firm-scoped
  reports never include another firm's posted data. Remaining: a backfill/scope
  migration for legacy `firma_id IS NULL` rows (still globally visible).

### P11 — Auth freshness + security hardening — **done**
- **P11-R1** Session freshness — **done**: role/firma read fresh from the DB user
  each request + `session_version` in the token; deactivation/role change take
  effect on the next request (`sesiuneProaspata`).
- **P11-R2** Force logout everywhere on password change — **done**
  (`invalideazaSesiuni` bumps `session_version`); per-request RBAC/immutability/
  period-close/firma guards remain server-enforced.
- Acceptance: stale role/company can't act after a revocation; no generic-CRUD
  bypass of the authoritative guards. Remaining: shared revocation store for
  multi-instance (Redis) + independent pen-test (external gates).

### P12 — Sync/offline redesign (no LWW for posted data) — **done**
- **P12-R1** Conflict-aware reconciliation — **done**: `reconcileSigur` never
  overwrites a server-locked (posted/immutable) record; conflicts are rejected and
  the server version pulled, not merged.
- **P12-R2** Idempotent offline command replay — **done**: offline financial
  changes queue as commands with idempotency keys; replay skips executed keys
  (pairs with the Phase 4 idempotency store).
- Acceptance: no LWW on posted/ledger data; offline replay is command-based and
  idempotent. Remaining: wire the safe reconciliation + offline queue into the
  client transport.

### P13 — Query model + performance — **done**
- **P13-R1** Query DTOs + keyset pagination — **done**: `interogheazaDocumente`
  (parameterized filter + keyset pagination, bounded LIMIT) over composite indexes
  (migration 0020), replacing `list()` + in-memory filter on the primary hot path.
- Acceptance: bounded, indexed, keyset-paginated reads instead of full-table
  `list()`. Remaining (incremental): migrate the other `list()`-based callers and
  add paginated ledger queries.

### P14 — Furniture manufacturing differentiation (Mobila) — **done**
- **P14-R1** Production lifecycle state machine (oferta→…→facturata) — **done**.
- **P14-R2** BOM-driven atomic material consumption: `pornesteProductie` posts a
  `bon_consum` via `postDocument` (stock discharge at CMP + 601 journal + fiscal),
  with production state persisted apart from the immutable order — **done**.
- Acceptance: a furniture order drives real, atomic material consumption + costing
  through the existing engine. Remaining: UI for the configurator/production board.

### WIRING-1 — Authoritative command endpoints on a real SQLite engine — **done**
- The demo server now runs on a real better-sqlite3 executor (migrations + seed),
  and `POST /commands/<post|reverse|approve|cancel>-document` dispatch to
  `@gr/application` with RBAC + stable HTTP error mapping — the full engine runs
  without PostgreSQL. Remaining UI-side wiring (DocumentEditor→/commands in network
  mode; browser SQLite for local mode; reports off the ledgers) tracked as open.

### P16 — Backup, restore, DR — **done**
- **P16-R1** Full-database backup/restore incl. persisted ledgers — **done**:
  `exportBazaSql`/`importBazaSql` (`packages/data/src/backup-sql.ts`) snapshot the
  WHOLE database (tables discovered from `sqlite_master`, so future tables can't be
  forgotten; `_migrations` excluded) and restore atomically in one transaction with
  FK deferred to commit (self-references restore correctly); optional integrity gate
  rejects an unbalanced-journal restore. Fixes the DR hole where the provider backup
  (`backup.ts`) silently omitted stock/journal/fiscal/e-Factura/production ledgers.
- Acceptance: a real post→snapshot→restore-into-fresh-DB round-trip reproduces every
  ledger byte-for-byte (verified on SQLite; +8 tests). Remaining: PostgreSQL-native
  path (pg_dump/PITR), streaming for very large DBs, snapshot encryption + off-site
  rotation + a scheduled/tested restore runbook — Phase 17.

### P17–P20
Detailed requirements captured in the ledger as each phase is reached, following
the program spec (CI/CD + release engineering incl. DR runbook, licensing + customer
admin, legacy migration, docs/support/legal). IDs assigned when work starts, to
avoid speculative churn.

## Commercial-readiness gates (must all pass before "generally ready for sale")
Engineering integrity · fiscal assurance (incl. **external accountant + legal
review**) · security (incl. **independent pen-test**) · operations (signed
installer/updater, tested restore, runbooks) · market (**≥3 paid pilots**, accountant
reconciliation). The market/legal/security-review gates require **external parties**
and cannot be satisfied by code alone — tracked but explicitly out of scope for
automated implementation.
