# Case Governance UAT Report

Date: 2026-10-08 (Asia/Bangkok)  
Environment: private synthetic loopback only (`127.0.0.1`, PostgreSQL `55441`, API `3001`, UI `5280`)  
Source freeze: `docs/test-evidence/case-governance/final-source-freeze.json`

## Result

**FAIL — UAT is still in progress.** Production release is blocked.

| Status | Critical cases |
|---|---:|
| PASS | 300 |
| FAIL | 0 |
| NOT_RUN | 556 |
| Total | 856 |

The 132 CREATE cases cover every approved canonical field through the compiled API: create, database persistence and authorized reload all passed. The 168 legal-action cases cover all 21 catalog actions against private PostgreSQL, with per-action execution/state/data/replay checks plus shared authority, revision, rule and rollback checks. A separate API lifecycle probe completed 396/396 edit, clear and clone checks, but those results are intentionally not promoted to full UAT because the approved rows also require UI, detail, export, history and source-reset evidence. Field-policy access, browser field journeys, concurrency, retry and compatibility rows remain open.

## Executed evidence

- `docs/test-evidence/case-governance/private-db/field-api-stage.json`: 132/132 typed field CREATE checks PASS.
- `docs/test-evidence/case-governance/private-db/field-lifecycle-api-stage.json`: 396/396 compiled API edit, clear and clone regression checks PASS; marked `NOT_FULL_UAT` and not counted in the table above.
- `docs/test-evidence/case-governance/private-db/runtime-smoke.json`: 11/11 loopback runtime smoke checks PASS after rebuilding and restarting the backend.
- `docs/test-evidence/case-governance/private-db/legal-workflow-uat.json`: 30/30 private PostgreSQL and HTTP checks PASS; the parameterized database run executes all 21 frozen legal actions and verifies exact state/data, one decision, history transaction, immutable source binding and replay behavior. Shared workflow checks verify authority separation, exact revision, published rules and atomic rollback.
- `docs/test-evidence/case-governance/private-db/browser-smoke/report.json`: desktop and responsive-web rendering smoke PASS with zero page errors and zero HTTP 5xx; this remains technical smoke evidence and is not counted as field-journey UAT.
- `docs/test-evidence/case-governance/private-db/web-field-edit-reload.json`: 124/124 directly addressable canonical controls were edited through the real web form, saved through the compiled backend and verified after browser reload with zero page/API error. Eight relationship, toggle or multi-select controls and the required detail/export/clone assertions remain open, so this stage is not promoted to complete field-row UAT.
- Fresh post-fix backend run: 527/527 executed suites, 7,255 PASS, 0 FAIL, 89 explicitly skipped database tests; exit 0 on 2026-10-08.
- `docs/test-evidence/case-governance/private-db/restore-rehearsal.json`: new isolated database restored exactly; 95 tables; backup and restore exit 0.
- `docs/test-evidence/case-governance/private-db/file-restore-rehearsal.json`: 83 immutable files restored and hash-verified; 8 absent/tampered fixtures explicitly excluded.

## Closed execution defect

`CG-UAT-D1` — Updating the synthetic field matrix through `PUT /cases/:id` returned HTTP 500 because the legacy form sent `null` for Boolean NOT NULL statistic columns. The builder now maps null to false for the six required flags while preserving null for the three intentionally nullable judicial flags. The regression test passed, the compiled runtime was rebuilt, and the lifecycle API rerun passed 396/396.

The review also corrected the evidence reconciler so API-only edit/clear/clone results cannot be counted as complete UI/export/history UAT.

## Release decision

No release approval. Required threshold remains 100% critical PASS with zero unresolved BLOCKER/MAJOR findings and a human production GO.
