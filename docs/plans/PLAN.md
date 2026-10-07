# Case governance implementation contract

Status: APPROVED. User pasted full plan and requested IMPLEMENT on2026-10-06. Execution permitted now; do not ask another plan approval. Baseline10030bed705ad1afa27eff0986b0c4c43d591aa6, branchfeat/case-governance-20261006, isolated `.worktrees/case-governance-20261006`; original dirty root preserved.

Source priority: requirements/BRD→FRD→acceptance→architecture/CASE_GOVERNANCE→this contract. AllCG01–CG17 scope mandatory. User delegates implementation decisions and expands scope for governance; no MVP/placeholder substitution.

## Ordered tasks and dependencies
| Task | Requirement | Files/modules | Dependency/verification |
|---|---|---|---|
| T0 | All | Documents, inventory132/legacy21/legal-source matrix, fresh baseline | Approved user plan captured before code; independent read-only contract review |
| T1 | CG02–10/14/16 | Prisma additive schema+migration; cases/governance module, cases.service/bulk/common parent helper; core permissions+catalog/decision/revision/rule/relations/tasks/outbox | T0; TDD, unit+private DB race/atomicity/ACL; shared schema contract ready before consumers |
| T2 | CG01/15 | frontend CaseForm/Detail canonical/shared field registry+132-key tests; backend canonical clear/field-definition contract | T0; independent file ownership, RED metadata/clear bug,10-tab clone/upload regression |
| T3 | CG11–14 | cases/evidence-governance, documents/evidences enforcement, packet/manifest/offline verifier/custody/holds/retention/representation | T1 schema, auth contract; RED tamper/parent-scope/hold/revision; DB/local files only |
| T4 | CG02–16 | frontend Case governance UI, inbox, action/decision/request/review/rule/relations/evidence packets/holds/tasks/dashboard; list/history/phase/missing filters | T1+T2+T3 HTTP contract; user workflows not developer configuration artifacts; meaningful interaction/persistence tests |
| T5 | CG17 | Full critical UAT132-fields/21-actions/security/migration/coverage/restore/monkey bounded local; rollout docs | T1–T4 independently reviewed, zeroBLOCKER/MAJOR; full baseline suites+types/lint/build ≥90% patch coverage |

Cross-task interface changes require controller coordination within approved architecture, never silent scope cuts. Schema and canonical service integration assigned one writer; distinct frontend/evidence modules may run in parallel once interfaces freeze. First review read-only findings reported before fixes. No tests weakened or rewritten for PASS.

## Commands/evidence
Backend: npm ci; npx prisma generate; npx prisma validate; npm test -- --runInBand; npx tsc --noEmit; npm run build; scoped npx eslint. Frontend: npm ci; npm test -- --maxWorkers=4; npx tsc -b; npm run build; scoped npx eslint. Root Playwright npm ci and Chromium/WebKit required for UAT. Preserve logs/exit codes/counts/source hashes, RED→GREEN proof, coverage oracle and independent reports. Opt-in DB tests only ownloopback55441/pc02_case_governance_uat, local browser ports5280/3001 with private test keys.

## Release/recovery/risks
FlagOFF blocks new commands/config publication but permits clearing existing handoffs and reading historical records. Additive schema persists through code rollback; never DROP decision/evidence history. No inferred legacy links/events. Current rules/fields retained and published versions pinned; new rules require legal-source/authority validation. Recover decisions/history/audit/outbox consistency under faults and restore. No external purchase, secret exposure, production test writes or arbitrary recipient notifications. Entire quality score measured, not declared from green unit tests. Concrete production release remains separately gated by review/UAT and user GO.

Next step: fresh baseline→T0 independent contract review→T1 schema/core and T2 canonical information. Continue all tasks throughT5; record progress and blockers precisely.

First read-only contract review reported CG-R01..05 before fixes. Within-approved-scope closures freeze seed exclusion (T1), all import/legacy rollback and document hydration/hold guards (T3), machine132/21 inventories (T0) and shared namespace/hash/CAS interfaces (T1 exported contracts). See architecture Frozen integration closures. ReviewFAIL is an implementation obligation, not another user approval request. Dependent feature readiness remains blocked until corrected code/DB/security tests pass; safe independent tasks can proceed against frozen contracts.
