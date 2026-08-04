# Release-readiness checklist

The product may **not** be described as generally ready for sale until every
mandatory gate passes with evidence. `[ ]` = not met, `[x]` = met with evidence.

## Engineering integrity
- [ ] Document posting is atomic (single transaction)
- [ ] Posted records are immutable (no PATCH/DELETE)
- [ ] Stock ledger persistent and reconcilable
- [ ] Accounting ledger persistent and balanced (Σd=Σc)
- [ ] No duplicate numbering under concurrency
- [ ] No duplicate posting under retry
- [ ] Negative-stock policy enforced (never clamped)
- [ ] Migrations tested (checksum, upgrade matrix)
- [ ] Backup restore succeeds on a clean machine
- [ ] Critical tests pass on SQLite **and** PostgreSQL

## Fiscal assurance
- [ ] Effective-dated VAT rules current and verified
- [ ] Supported e-Factura cases pass official validation
- [ ] ANAF test submission works end-to-end
- [ ] D300 / D394 / D390 reconcile to journals + fiscal events
- [ ] Supported SAF-T output passes the current official validator
- [ ] External accountant review complete *(external party)*
- [ ] Legal review of product claims complete *(external party)*

## Security
- [ ] Authorization current per request / session version
- [ ] Cross-company isolation suite passes
- [ ] Secrets protected (never in logs/bundles)
- [ ] Installer and updater signed
- [ ] Independent pen-test: no unresolved critical/high *(external party)*

## Operations
- [ ] Signed Windows installer verified on clean system
- [ ] Signed updater; failed update does not corrupt DB
- [ ] Monitored deployment; tested restore; incident runbook
- [ ] Release rollback + fiscal hotfix procedure

## Market
- [ ] ≥3 paid controlled pilots, parallel to incumbent *(external)*
- [ ] Accountant reconciliation completed for pilots *(external)*
- [ ] No unresolved data-integrity incident
- [ ] Onboarding documentation; ≥2 references/case studies *(external)*

> Items marked *(external party)* cannot be satisfied by code changes alone. They
> are tracked here for honesty about what "ready for sale" requires; automated
> implementation covers the engineering and fiscal-software gates only.
