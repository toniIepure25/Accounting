# Baseline audit — commercial-readiness program

> Evidence-based snapshot of the repository at the start of the productization
> program. Every claim here was verified by running a command or reading code,
> not inferred from the README. Where something could **not** be verified in
> this environment, it is marked **UNVERIFIED**.

## 1. Repository identity

| Field | Value |
|---|---|
| Remote | `https://github.com/toniIepure25/Accounting.git` |
| Code root | `revamp/` (own git repo; legacy KISS/WPF app in parent dir untouched) |
| Branch | `main` |
| HEAD SHA | `0fd74168e8d5502f7c9bd29f980c6d8738ab417a` |
| `origin/main` vs HEAD | 0 ahead / 0 behind (pushed, live on GitHub) |
| Worktree | clean |

## 2. Architecture inventory

- **Monorepo** (npm workspaces + Turborepo).
- Packages: `core-domain`, `data`, `fiscal-ro`, `auth`, `license`, `ai`, `sync`, `ui`.
- Apps: `desktop` (Tauri v2), `mobile`, `web`.
- `server/` — Node `http` API (no framework), for LAN/cloud.
- `db/migrations/` — 10 SQL files (`0001_init` … `0010_branding_firma`).
- **`packages/modules/` does not exist** (README references it — stale).

### Data / persistence
- Authoritative data contract = **generic CRUD repositories** (`repository.ts`,
  `generic-sql-repo.ts`, `provider.ts`). No application/command layer.
- `SqlExecutor` = `execute()` + `select()` only. **No `transaction()`**.
- Tables created by migrations (27): documents, `documente_linii`, cash/bank ops,
  nomenclatures (parteneri, produse, gestiuni, plan_conturi, cote_tva, …), users,
  audit_log, mijloace_fixe, serii_documente, configurator, branding.
- **No `stock_ledger_*`, no `journal_entries` / `journal_lines`.** Stock valuation
  (`stock.ts`, CMP) and double-entry accounting (`contabilitate.ts`) are computed
  **on the fly** from documents, not persisted as immutable ledgers.

### VAT handling (Phase 1 target — hard evidence)
- `cote_tva` table = `(procent INTEGER PK, denumire, implicita)` — **not
  effective-dated** (no `valid_from`/`valid_to`).
- The only reference to `cote_tva` in code is a **comment** in `tva.ts`. The
  runtime never reads it.
- VAT is hardcoded: `COTE_TVA_RO = { STANDARD: 19, REDUSA_9: 9, REDUSA_5: 5,
  SCUTIT: 0 }`; `entities/produs.ts` defaults `cotaTvaProcent` to 19.
- This is the "disconnected configurability claim" the program calls out, **and**
  19% is fiscally wrong for documents dated on/after the 2025 RO VAT change.

## 3. Baseline checks (run at audit time — evidence)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **10/10 packages OK** |
| Unit + component tests | `npx turbo run test --force` | **179 passing** (see below) |
| Lint | `npx biome check .` | clean (1 pre-existing `noExplicitAny` warning) |
| Web build | `npm run build:web` | succeeds (initial JS ~372 kB) |
| E2E | `npm run test:e2e` | 4 Playwright tests green |

Per-package test counts: core-domain **81**, data **22**, license **22**, ui **19**,
fiscal-ro **11**, auth **10**, sync **9**, ai **5**. Total **179**.

### UNVERIFIED in this environment (no fabrication)
- PostgreSQL integration tests (only in-memory + SQLite structure exercised).
- Tauri native build (needs Rust toolchain).
- Real ANAF SPV calls (needs qualified certificate + credentials).
- Official SAF-T (D406) and e-Factura CIUS-RO validators (no tooling/credentials).
- Any legal/fiscal "certification" — none exists and none is claimed.

## 4. Gap summary vs. commercial-readiness (maps to program phases)

| # | Gap (evidence) | Phase |
|---|---|---|
| G1 | VAT hardcoded 19/9/5; table not effective-dated, not read | 1 |
| G2 | No DB transaction abstraction | 2 |
| G3 | UI orchestrates persistence; no command/application layer | 3 |
| G4 | No optimistic locking / idempotency; numbering not DB-unique-constrained at posting | 4 |
| G5 | No persistent immutable stock ledger (derived only) | 5 |
| G6 | No persistent balanced accounting ledger (derived only) | 6 |
| G7 | Fiscal reports built from document-type lists, not a fiscal-event layer | 7 |
| G8 | e-Factura = generate/download XML, no durable SPV workflow/state machine | 8 |
| G9 | SAF-T structural subset, not validated against official validator | 9 |
| G10 | Multi-company: null-scoped rows globally visible; period locks not fully scoped | 10 |
| G11 | Auth: stale role/company retained until token expiry (in-memory revocation only) | 11 |
| G12 | Sync uses last-write-wins (unsafe for posted/financial data) | 12 |
| G13 | Query model uses `list()` + in-memory filtering; no keyset pagination at scale | 13 |
| G14 | Furniture vertical present but shallow vs. full quote-to-cash + costing | 14 |

## 5. What is genuinely sound (preserve, don't rewrite)

- Monorepo separation of concerns; money in minor units (`Bani`); Zod validation.
- Server-side RBAC enforcement; PBKDF2 passwords; timing-safe session compare.
- Asymmetric ECDSA licensing (public key cannot forge licenses).
- Audit-log append-only on server; period-close concept; firma-scope concept.
- Property-based tests for money/VAT; structured server logging + request-id.
- These are the foundations the program **extends**, per operating principle 2.2.
