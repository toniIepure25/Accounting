# ADR-0005: Transaction boundaries

- Status: accepted
- Date: 2026-08-04
- Phase: 2

## Context
`SqlExecutor` exposed only `execute()`/`select()` — no transactions. Stock and
accounting posting (Phases 5/6) and the document aggregate (Phase 3) require that
a document, its lines, stock, journal and audit commit as **one unit**, or not at
all. Every SQL executor implementation had to be identified first (audit): the
concrete implementers are `fromBetterSqlite` (Node/tests, real SQLite),
`fromTauriDatabase` (desktop SQLite), `createPgExecutor` (server, PostgreSQL),
plus in-line test doubles in `data.test.ts`/`numerotare.test.ts`. The in-memory
`createMemoryProvider` is not SQL-backed and is out of scope.

## Decision

### Transaction API
```ts
transaction<T>(options: TransactionOptions, work: (tx: SqlExecutor) => Promise<T>): Promise<T>
```
- `work` receives a **transaction-bound executor**; all its statements run on the
  same connection/transaction. Success commits; a thrown error rolls back and the
  **original** error propagates (rollback failure is logged, never replaces it).
- `TransactionOptions = { isolation?, sqliteMode?, timeoutMs?, maxRetries? }`.

### Ownership / binding
Repositories bind to a transaction by construction: `withExecutor(tx)` (=
`createSqlProvider(tx)`) yields a `DataProvider` whose repos all run through `tx`.
There is no silent fallback to the root executor. Phase 3 commands consume this.

### Nested behavior
True nesting via **SAVEPOINT** (SQLite `SAVEPOINT`/`RELEASE`/`ROLLBACK TO`;
PostgreSQL likewise). A second `BEGIN` is never issued on the same connection.

### Isolation semantics
PostgreSQL sets the level from a **whitelist** (`read_committed`/`repeatable_read`/
`serializable`) — never raw string interpolation. SQLite has a single writer;
isolation is effectively serializable and the option is ignored, `sqliteMode`
(`deferred`/`immediate`/`exclusive`) selects the BEGIN mode. `immediate` is used
for stock-sensitive work so two concurrent withdrawals cannot both proceed; it is
not globally forced for low-risk transactions.

### SQLite behavior
`fromBetterSqlite` (real, tested) and `fromTauriDatabase` (mirrored, runtime-only)
use `BEGIN DEFERRED|IMMEDIATE|EXCLUSIVE` / `COMMIT` / `ROLLBACK`, savepoints for
nesting, and a use-after-completion guard on the bound executor.

### PostgreSQL behavior
`createPgExecutor` acquires a **dedicated client** from the pool (`connect()`),
runs `BEGIN` (+ optional isolation), all statements through that client, `COMMIT`
on success, `ROLLBACK` on failure, and **always releases** the client in `finally`.

### Retry policy
Only explicitly retryable failures are retried: PostgreSQL `40001`
(serialization) and `40P01` (deadlock), bounded by `maxRetries` (default 0).
Domain/validation/constraint errors are never retried.

### Error normalization
Driver messages never reach the UI. A stable taxonomy (`tx-errors.ts`):
`TransactionConflictError`, `SerializationFailureError`, `DeadlockDetectedError`,
`DatabaseBusyError`, `TransactionTimeoutError`, `ConstraintViolationError`,
`TransactionUsageError`. SQLite/PG errors are mapped into these.

### Cancellation / timeout
`timeoutMs` is accepted; enforced where the driver allows. `better-sqlite3` is
synchronous single-connection, so timeout/`maxRetries` do not apply there and are
documented as ignored.

### Logging / correlation
Rollback failures are logged (without replacing the original error). Full
transaction telemetry (tx id, request id, command id, adapter, attempt, duration,
commit/rollback, normalized category) plugs into the structured server logger and
is wired as Phase 3 commands call `transaction()`. Secrets/tokens/certificates/
full sensitive payloads are never logged.

### Test strategy
A reusable contract suite (`transaction-contract.test.ts`, `contractTranzactii`)
runs against **real SQLite** (better-sqlite3) covering commit/rollback (at each
position)/read-your-writes/invisibility-after-rollback/constraint-enforcement/
savepoint nesting/independent transactions/use-after-completion. A fault-injection
harness proves no partial durable state after failure at named boundaries. The
same suite is intended to run against **real PostgreSQL** in CI (service
container). PostgreSQL control flow (retry/release/isolation) is additionally
verified deterministically with a fake pool; a gated real-PG integration test runs
only when `DATABASE_URL` is set.

## Consequences
- Phases 3/5/6 can write atomically and be tested for partial-write safety.
- PostgreSQL is **implemented but not verified against a real server in this
  environment** (`IMPLEMENTED_NOT_POSTGRES_VERIFIED`) until the CI Postgres job
  runs the gated integration test.
