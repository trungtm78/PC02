# T1b legal workflows implementation evidence

Status: implementation handed off for independent review; whole Case Governance acceptance is pending. Approved scope remains CG01–17. These tests use synthetic authority/configuration facts and do not certify statutory compliance or publish a law baseline automatically.

## Owned source manifest

All following paths are under `backend/src/cases/governance/`:

- `legal-action.catalog.ts`, `legal-action.validation.ts`, `legal-workflow.validation.ts`
- `configuration.validation.ts`, `case-configuration.service.ts`
- `legal-workflow.service.ts`, `legal-workflow.controller.ts`
- `case-field-schema.service.ts`, `case-native-field-policy.ts`, `case-policy-search.ts`
- `case-operations.service.ts`, `case-operations.controller.ts`, `case-outbox.worker.ts`
- `split-allocation.service.ts`

Owned matching specifications plus `legal-action.capabilities`, `legal-classification`, `legal-relation-revision`, `legal-split-source`, `legal-deadline-integration`, `legal-validation.boundaries`, `representation-policy-search`, `case-operations.filters`, `case-outbox.retry`, and private DB/HTTP specifications are included in the final gate. Foundation contracts/modules/controller/service, CasesService, Prisma schema/migrations, evidence service and frontend are separate owners. `case-deadline-effect.ts/spec.ts` were supplied by the deadline helper writer; the complete source is included in this coverage run and its separate evidence is `deadline-effect.md`.

Exact24 test basenames (`.spec.ts`, same source directory): `legal-action.catalog`, `legal-action.validation`, `legal-workflow.validation`, `configuration.validation`, `case-configuration.service`, `legal-workflow.service`, `case-field-schema.service`, `case-operations.service`, `case-operations.filters`, `case-outbox.worker`, `case-outbox.retry`, `case-native-field-policy`, `case-policy-search`, `legal-action.capabilities`, `legal-relation-revision`, `legal-classification`, `legal-deadline-integration`, `legal-split-source`, `split-allocation.service`, `representation-policy-search`, `case-deadline-effect`, `legal-validation.boundaries`, `legal-workflow.private-db`, `legal-workflow.private-http`.

## Implemented boundaries

Frozen21 stable actions plus explicit verification, correction, related/source links, split and classification use exact hashed request revisions, independent approval, current authority, current parent scope, effective independently published rules and pinned source byte/version snapshots. Mutations append decisions/history/events/tasks/internal outbox in the aggregate transaction. No automatic expiry discontinuation or guessed unknown phase. Split creates a real Case/counter while preserving source type/classification/policy provenance and versioned allocation parts. Relations retain history and use reviewed revocation revisions. Deadline calculations use reviewed versioned effects, actual confirmed anchors and pinned calendars, shared with task deadlines.

Published custom/native policies validate typed data and current explicit sensitive authority. Runtime schema is pinned and readable after supersession. Recursive serializers cover canonical fields, metadata aliases, audit/replay snapshots and custom fields; query partitions omit protected values. Separate header policy-only catalog extends actual basic Case columns without modifying frozen132 inventory or181 placements. Global configuration/default adoption requires INTERNAL mode. REP_ONLY summary search uses only approved summary fields; full queries require view grants. Outbox leases/retries use current recipient ACL, deterministic notification deduplication and no external delivery.

## RED → GREEN evidence

Earlier task runs recorded negative approval/source revision, actor capability, schema policy, phase/source dates, relation revocation, classification and concrete split allocation regressions before their changes. Initial source-wide coverage was64.06% lines and was reported as insufficient rather than truncating collection.

Final closure regressions:

- Reporting-period fixture:1 failure/2 passes (exit1), because the helper ignored implicit reporting dates. Updated helper:4 passes (exit0), proving dates remain on authorized/unconfigured/full-view branches and are omitted on protected-date and list-only branches while summary search survives.
- Governed protected-status fixture:1 failure/11 passes (exit1), because approved execution bypassed header policy. Updated readiness:12 passes (exit0), changed-value policy guard before any decision/history/task writes. Status, phase, deadline, resolution date and classification output use the shared policy guard.
- Deadline integration tests cover actual later receipt/end-month output and atomic rejection of missing anchors; standalone helper evidence includes RED20 failures then68 passes and calendar/leap/timezone/provenance negatives.

## Interfaces and integration

HTTP DTOs/routes and runtime policy shape are frozen in `t1b-http-contract.md`. Core integrates `validateForWrite(tx,input,existing,actor)`, `filterCustomFields(record,actor,tx,purpose)`, query guards and shared queue predicates. Evidence integrates `byteFieldPolicySnapshot(tx,caseId,actor,inspectionPurpose?)`; optional inspection purpose is server-only and narrowly authorized. Legal source hashing uses the evidence service and rechecks owner and direct relation revision; it grants no byte delivery rights.

Latest query helper signature:

`policyAwareSearchWhere(tx,actor,query,legacyVisibility?,representationViewOnly=false,implicitPeriod?:{field:string,where:Prisma.CaseWhereInput})`.

**OPEN shared integration:** Case builder must remove its globally applied Settings reporting-period predicate and pass that standalone predicate plus its actual configured field to the sixth argument. Core writer froze before this binding. Helper tests pass; end-to-end reporting-period privacy must not be claimed until the builder is bound and regressed. No blanket broad-search403 is the intended final behavior.

Rule adoption is explicit per draft `ruleVersionId`; committed Case rule pin changes on executed decision. There is no separate legal rule adoption endpoint. Field schema adoption has its own reviewed published-version route. Source snapshots and allocation snapshots are server-owned and cannot be supplied as authority by clients.

## Fresh gates

2026-10-06 final full-source coverage run: **24 suites,244 tests passed, exit0,81.872s**, including24 private DB cases and6 private Nest HTTP cases. Coverage: **lines91.03%, statements89.27%, branches80.30%, functions96.60%**. Legal workflow service specifically: lines80.41%, statements78.21%, branches69.40%, functions91.66%; these lower individual metrics remain visible for independent review. Full raw and summary reports are `t1b-coverage-final.json` and `t1b-coverage-summary.json`.

Command: `rtk proxy npm test -- --runInBand --coverage --coverageDirectory=coverage/t1b --coverageReporters=json-summary --coverageReporters=json --coverageReporters=text --collectCoverageFrom=cases/governance/{legal-action.catalog,legal-action.validation,legal-workflow.validation,configuration.validation,case-configuration.service,legal-workflow.service,case-field-schema.service,case-operations.service,case-outbox.worker,legal-workflow.controller,case-operations.controller,case-native-field-policy,case-policy-search,split-allocation.service,case-deadline-effect}.ts --runTestsByPath` followed by the24 specifications listed in the owned manifest and this report. Jest rootDir is `src`; emitted reports are under `backend/src/coverage/t1b/`. The test-list is also emitted in the run log; no filtered coverage subset was substituted.

Scoped production lint (`rtk proxy npx eslint` with all14 owned source paths): exit0. Whole backend type check (`rtk proxy npx tsc --noEmit`): exit0, no diagnostics. Full coverage collection includes all15 source files including the deadline helper, services/controllers/query/worker glue. Private DB and HTTP tests opt in only to the approved loopback UAT database; secret is read internally and never logged. Schema131 is applied and shared flag remains ON. No reset, cleanup, production access, external send, deployment or commit was performed. A prior schema131 setup drift failed before product exercise and was rerun after parent confirmed migration/client readiness.

## Remaining acceptance gates

- Parent independent read-only implementation review, including deadline helper, and any findings before fixes.
- Reporting-period builder binding and full Case/list/count/statistics/export inference regressions.
- Actual JWT/permission middleware end-to-end UAT: private HTTP fixture uses explicitly synthetic identity guards to exercise real Nest routes/services/Prisma, not real-login certification.
- T3 evidence packet/byte closure, T4 frontend workflows, T5 independent requirements-based UAT/monkey gates and the remaining child-route/security audit.
- Coverage percentages must all be reported. A line threshold alone is not proof that branches or individual service coverage reached90%.
