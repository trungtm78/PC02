# Case Governance UAT Report

Date: 2026-10-08 (Asia/Bangkok)  
Environment: private synthetic loopback only (`127.0.0.1`, PostgreSQL `55441`, API `3001`, UI `5280`)  
Requirements: `docs/requirements/FRD.md`, `docs/requirements/acceptance-criteria.md`, canonical field and action inventories

## Result

**PASS — 856/856 critical acceptance cases passed.**

| Status | Critical cases |
|---|---:|
| PASS | 856 |
| FAIL | 0 |
| NOT_RUN | 0 |
| Total | 856 |

The executed matrix contains 660 field cases (132 fields × create, edit, clear, clone and access), 168 legal-action cases covering all 21 catalog actions, and 28 cross-cutting governance journeys. All evidence used by the matrix is checked by `tools/case-governance/reconcile-uat-results.cjs`; missing, failed or incomplete evidence makes reconciliation fail.

## Field and browser evidence

- Create: 132/132 typed fields persisted and reloaded through the compiled API.
- Edit: 124 direct controls plus 8 relationship/toggle/multi-select controls were edited in the real web form and reloaded.
- Detail/export: all 132 fields appeared consistently across the ten detail tabs and the full Excel export.
- Clear: 132/132 fields cleared through the web form; the backend and detail view retained explicit clear state without reviving legacy aliases.
- Clone: 132/132 values were retained; a new ID/code was created, source links were reset, the source revision was pinned, and duplicate review was acknowledged.
- Access: one independently reviewed and published policy protected all 132 fields. Authorized read passed; same-unit write-capable users without sensitive access received no protected fields, write returned 403, and Excel contained no protected values.
- Search/navigation: permitted search remained available, protected-only matches were excluded, and browser Back/Forward restored the exact list URL and dossier.

Primary evidence is under `docs/test-evidence/case-governance/private-db/`, including `web-field-edit-reload.json`, `web-special-field-edit-reload.json`, `web-field-detail-export.json`, `web-field-clear.json`, `web-field-clone.json`, `field-access-uat.json` and `navigation-search-uat.json`.

## Governance and operational evidence

- Private PostgreSQL/HTTP legal workflow: 30/30 PASS, including all 21 frozen action codes, authority separation, exact revision, immutable sources, idempotent replay and transaction rollback.
- Comprehensive regression: backend 7,254 PASS / 0 FAIL; frontend 4,473 PASS / 0 FAIL.
- Database authorization evidence covers principal mode, restricted search/count/export, audit masking, one-pending handoff, source conversion, current grants, queues, KPI and notification reauthorization.
- Evidence governance covers originals, hashes, derivative lineage, custody, file ACL, packets, holds, representation, retention and relation persistence.
- Migration and recovery: additive migration checks passed; isolated database restore recovered 95 tables; immutable file rehearsal hash-verified 83 files and explicitly recorded excluded invalid fixtures.
- Bounded load: 100 requests at concurrency 4, 0% errors, p95 337 ms against a 1,000 ms UAT budget.
- Browser/runtime smoke returned no page error, API failure or application crash.

The consolidated machine-readable result is `docs/test-evidence/case-governance/private-db/composite-uat-evidence.json`. Every row in `docs/uat/case-governance/uat-plan.json` links its supporting evidence.

## Release decision

The UAT critical threshold is met. Production release still requires the mandated independent adversarial review to report no unresolved BLOCKER or MAJOR finding, fresh release checks, merge/CI completion and the existing human GO for production deployment.
