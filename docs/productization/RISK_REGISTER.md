# Risk register

Severity: **S1** launch-blocking correctness/legal/security · **S2** major ·
**S3** moderate · **S4** minor. Status updated as phases close.

| ID | Risk | Sev | Evidence / trigger | Mitigation (phase) | Status |
|---|---|---|---|---|---|
| RK-01 | Hardcoded 19% VAT wrong after 2025 RO rate change | S1→S3 | was `tva.ts` const/`produs.ts` default 19 | **Downgraded**: temporal engine + persisted rules + runtime wiring done; silent default removed (guard test). Remaining: external review of per-good category mapping | downgraded |
| RK-02 | Posting not atomic (no DB transaction) | S1→closed | was no `transaction()` | **Closed** (document posting): `postDocument` (Phase 3) writes document+lines+tax snapshot atomically in one `exec.transaction`; fault-injection tests prove no partial write. Stock/accounting ledger effects await Phase 5/6 persistence | closed |
| RK-03 | Stock/accounting derived, not persisted → not immutable/auditable | S1→closed | was no ledger tables | **Closed**: persistent append-only stock ledger (P5) **and** double-entry accounting journal (P6), both emitted atomically at posting; reports derive from them; stock↔accounting reconcile | closed |
| RK-04 | Posted documents editable/deletable via generic CRUD | S1→S3 | generic repo contract | **Downgraded**: aggregate immutability (esteImutabil) + server rejects generic PATCH/DELETE on posted/reversed/cancelled docs (409, all roles) + command guard. Remaining: route local desktop UI (direct SQLite, no server) through the guard | downgraded |
| RK-05 | Duplicate numbers/postings under concurrency | S1→S3 | was no unique constraint at posting, no idempotency | **Downgraded**: optimistic locking (version/expectedVersion, 409) + idempotency store (retry returns stored response) + partial unique index on (firma, tip, year, serie, numar) as DB backstop; number allocated at posting. Verified on real SQLite. Remaining: exercise true multi-process race on real PostgreSQL (CI) | downgraded |
| RK-06 | Concurrent overselling (negative stock) | S1→S3 | was in-memory CMP, no locking | **Downgraded**: persistent balances checked inside the posting transaction; default `interzice` policy denies sub-zero exits (never clamps); `BEGIN IMMEDIATE` serializes writers. Verified on real SQLite; true multi-process race is the PostgreSQL CI job | downgraded |
| RK-18 | Migration runner dropped statements after leading comments (never run on real DB) | S1→closed | 0001's first CREATE TABLE dropped by naive splitter | **Closed**: quote-aware splitter + real-SQLite migration test (P2 work) | closed |
| RK-07 | Fiscal reports may double-count NIR↔invoice | S1→closed | was derived from doc lists | **Closed at source**: posting writes a persistent fiscal-event ledger respecting the 3-way match; the VAT return (D300 base) derives from events, counts deductible VAT once across NIR+invoice, and reconciles to the journal (4426/4427). Official D394/D390 XML + ANAF validator sign-off remains a commercial gate | closed |
| RK-08 | e-Factura not a durable SPV workflow; no official validation | S1→S2 | was generate/download XML only | **Downgraded**: durable persisted SPV state machine (ciorna_xml→validat→incarcat→acceptat\|respins, retryable eroare), CIUS-RO XML built from the posted invoice, structural validation, idempotent upload (no double submission under retry). Remaining: official ANAF XSD/CIUS-RO validation + real SPV round-trip + digital signature — external gate | downgraded |
| RK-09 | SAF-T subset unvalidated vs official validator | S1 | structural subset | Canonical SAF-T + validator (P9) | open |
| RK-10 | Cross-company data leakage (null-scoped rows global) | S1 | firma-scope leaves null visible | Company scoping + migration (P10) | open |
| RK-11 | Stale role/company retained until token expiry | S1 | in-memory revocation, 12h tokens | Session version / reload / Redis (P11) | open |
| RK-12 | LWW sync corrupts posted financial data | S1 | sync engine LWW | Server-authoritative replication (P12) | open |
| RK-13 | Full-table `list()` + in-memory filter won't scale | S2 | repo `list()` everywhere | Query DTOs + keyset pagination (P13) | open |
| RK-14 | PostgreSQL path unverified in this env | S2 | no PG in sandbox | Dual-DB CI job (P17) | open |
| RK-15 | Legal/fiscal/security/market gates need external parties | S1 | accountant/lawyer/pen-test/pilots | Out of code scope; tracked, not claimed | open |
| RK-16 | Windows dev port contention (`tsx watch` respawns) | S4 | observed EADDRINUSE | Use `Get-NetTCPConnection \| Stop-Process` | mitigated |
| RK-17 | Public repo exposes full commercial source | S3 | repo is public | User decision; noted, not code-fixable | open |
