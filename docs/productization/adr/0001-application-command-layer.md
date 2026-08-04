# ADR-0001: Application/command layer between UI and persistence

- Status: accepted
- Date: 2026-08-04

## Context
Today the React UI orchestrates persistence by calling multiple generic CRUD
repositories in sequence (create document, then lines, then derive stock, etc.).
There is no server-side transaction and no single place that enforces business
invariants. A network failure or a malicious/buggy client can leave partial,
inconsistent state, and posted documents can be patched or deleted through the
same generic endpoints used for drafts.

## Decision
Introduce a shared **application layer** (`packages/application`) containing
authoritative **command handlers** and unit-of-work coordination. The UI issues
**commands** (e.g. `PostDocument`) and **queries**; it never coordinates
persistence across repositories. Command handlers run identically in:
- the Node server (LAN/cloud mode), and
- a trusted local command host (standalone Tauri mode).

Flow: `UI → command/query → handler → authz + license → domain validation →
effective-dated fiscal rules → transaction/unit-of-work → document aggregate →
stock ledger → accounting journal → audit → idempotency → outbox → commit`.

Generic repositories remain acceptable for **low-risk nomenclatures/config**,
but are **not** the authoritative contract for posted documents, stock/accounting
posting, production completion, settlements, period close, reversals, fiscal
submissions, audit, or licensing-sensitive operations.

## Consequences
- Business invariants are enforced once, server-side, not per screen.
- Enables atomicity, immutability, idempotency, and consistent authorization.
- Requires a transaction abstraction (ADR-0002 / Phase 2) first.
- UI data-access is refactored from multi-repo writes to command calls (Phase 3).
