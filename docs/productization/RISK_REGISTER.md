# Risk register

Severity: **S1** launch-blocking correctness/legal/security · **S2** major ·
**S3** moderate · **S4** minor. Status updated as phases close.

| ID | Risk | Sev | Evidence / trigger | Mitigation (phase) | Status |
|---|---|---|---|---|---|
| RK-01 | Hardcoded 19% VAT wrong after 2025 RO rate change | S1 | `tva.ts` const; `produs.ts` default 19 | Temporal tax engine + verified seed (P1) | open |
| RK-02 | Posting not atomic (no DB transaction) | S1 | `SqlExecutor` has no `transaction()` | Transaction abstraction (P2) | open |
| RK-03 | Stock/accounting derived, not persisted → not immutable/auditable | S1 | no ledger tables | Immutable ledgers (P5, P6) | open |
| RK-04 | Posted documents editable/deletable via generic CRUD | S1 | generic repo contract | Lifecycle + commands (P3) | open |
| RK-05 | Duplicate numbers/postings under concurrency | S1 | no unique constraint at posting, no idempotency | Locking + idempotency + DB constraint (P4) | open |
| RK-06 | Concurrent overselling (negative stock) | S1 | in-memory CMP, no locking | `BEGIN IMMEDIATE` + ledger + policy (P2, P5) | open |
| RK-07 | Fiscal reports may double-count NIR↔invoice | S1 | derived from doc lists | Fiscal-event layer (P7) | open |
| RK-08 | e-Factura not a durable SPV workflow; no official validation | S1 | generate/download XML only | SPV state machine + validator (P8) | open |
| RK-09 | SAF-T subset unvalidated vs official validator | S1 | structural subset | Canonical SAF-T + validator (P9) | open |
| RK-10 | Cross-company data leakage (null-scoped rows global) | S1 | firma-scope leaves null visible | Company scoping + migration (P10) | open |
| RK-11 | Stale role/company retained until token expiry | S1 | in-memory revocation, 12h tokens | Session version / reload / Redis (P11) | open |
| RK-12 | LWW sync corrupts posted financial data | S1 | sync engine LWW | Server-authoritative replication (P12) | open |
| RK-13 | Full-table `list()` + in-memory filter won't scale | S2 | repo `list()` everywhere | Query DTOs + keyset pagination (P13) | open |
| RK-14 | PostgreSQL path unverified in this env | S2 | no PG in sandbox | Dual-DB CI job (P17) | open |
| RK-15 | Legal/fiscal/security/market gates need external parties | S1 | accountant/lawyer/pen-test/pilots | Out of code scope; tracked, not claimed | open |
| RK-16 | Windows dev port contention (`tsx watch` respawns) | S4 | observed EADDRINUSE | Use `Get-NetTCPConnection \| Stop-Process` | mitigated |
| RK-17 | Public repo exposes full commercial source | S3 | repo is public | User decision; noted, not code-fixable | open |
