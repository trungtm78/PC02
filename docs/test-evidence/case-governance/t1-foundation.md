# T1 foundation implementation and handoff evidence

Date: 2026-10-06. Worktree: `.worktrees/case-governance-20261006`, baseline `10030bed`.

This report covers the resumed T1a core/schema/ordinary Case boundary and Case-related Audit implementation. It does not certify the complete CG01–17 release, independent review, UAT, or production deployment. The original full scope remains required. No production environment, ordinary `.env`, real business data, push, or commit was used by this writer.

## Continuity and ownership

The preceding core writer stopped because of model usage, not a technical failure. Its partial implementation was retained. It reported hash 12, authorization 5, seed 2, and schema 2 tests passing; those are predecessor-reported evidence, not this writer's fresh claim. The parent recorded the baseline as backend 6,271 and frontend 4,022 passing tests.

T1b owns legal actions/rules/configuration, field schema and field policy helpers, relations, tasks, queues, deadline effects, and outbox. T2 owns the pure canonical registry/helper and original canonical frontend work. T3 owns evidence/disclosure/custody/preservation, Documents, import/rollback guards. T4 owns frontend governance. This writer owns Prisma schema/migration packaging, foundation/module wiring, CasesService/controller/bulk integration, principal access-mode management, and Case-related audit policy. Child namespace ACL closure remains assigned to a separate writer by the parent; the common pending guard alone is not that closure.

## Changes and first-review findings

- Current database actor, active role permissions, current scope, sensitivity and exact unexpired grants authorize all foundation operations. Technical ADMIN provides no implicit governance approval capability. Sensitive Case access is enforced even when the caller supplies null scope. Missing/SQL-null/JSON-null legacy metadata remains visible; unknown classifications are quarantined.
- Stable canonical request hashing, source snapshot CAS, durable operation ledger, events, audit, aggregate changes and outbox writes share one serializable transaction. Retry replay rechecks current authority, current field policy and related Case scope.
- Handoff preserves identity, legal status/phase/dates/deadline, records exact owned Document versions and structured receipt shortcomings, and requires active team/designated-recipient membership. Initial same-team receipt is permitted for PHAN_LOAI or legacy-null stage. DA_NHAN same-team responsibility changes use assignment. Dedicated accept/return/cancel can clear pending while the flag is off.
- Canonical create/update calls T2 `normalizeCanonicalCaseWrite` before mapping and uses its complete metadata directly. Nullable statistic dates now persist explicit null instead of silently retaining the old date. Required name null/blank returns 400 while omitted name is preserved.
- Ordinary save never invokes an implicit source Incident factory. Status history and status audit are inside the Case transaction. Suspension requires the actual civil decision date and reason, including imported old Cases.
- Atomic ordinary Case saves invoke T1b `validateForWrite` inside the same transaction and pin the server-owned field definition FK. Ordinary reads and exports use current native/custom field policies; search/count/export share authorized predicates and policy-aware search partitions. New phase/action/decision/missing/queue filter DTOs call the common T1b filter builder.
- Basic PUT with feature on cannot actually change owner/team. Dedicated assignment requires current dispatcher/assignment authority, active target membership and version. Cross-team changes use handoff. Recovery mode retains adopted legal state/date/deadline/reason/decision-number protections. Bulk assignment revalidates target membership in its transaction, requires versions for feature-on/adopted Cases, and rejects cross-team transfers.
- Clone create binds source ID/version, authorizes source in its transaction, preserves classification and pinned field policy, resets source linkage, and rejects restricted cloning based only on a source-specific grant.
- Explicit server `User.caseAccessMode` preserves INTERNAL legacy behavior. REPRESENTATION_ONLY requires current exact Case list/view/edit/download capabilities without expired/revoked staff fallback. List-only users receive summary rows; approved exact-version packet downloads are the disclosure path and general Word/Excel exports are denied. Current actor mode/revision appears in capabilities.
- Principal mode management requires INTERNAL, explicit `CaseGovernance.manage_access`, repository `User.write`, target writable scope, User timestamp/revision CAS, a reason and request key. Mode/revision/audit are atomic; serialization races retry once and become current authorized replay or 409.
- The parent recorded read-only audit finding CG-AU01 before repairs. Audit queries now exclude inaccessible direct/related Case parents before pagination/count/distinct/search/CSV and redact native/custom metadata before calculating changed fields. Non-Case audit behavior is preserved.
- This writer reported a read-only duplicate-candidate finding to the parent before repairs: `exactWhere` was copied before visibility was attached. RED showed the exact query lacking the authorized predicate. Both exact and partial queries now carry visibility; create/update pass the real actor and candidates are reserialized. The proposed protected-name fixture was initially invalid because name is outside the frozen 132 registry; that invalid fixture was discarded and reported as a fixture/design issue, not a product RED. The parent assigned a separate header-only policy catalog to T1b without changing the frozen 132 inventory.
- Additional receipt coverage found a real cancellation defect: the dedicated clear path used the ordinary pending-write freeze. RED raised `Pending handoff protects this case`; GREEN verifies accept/cancel/return while flag off, one audit/outbox, idempotent replay, preserved legal dates/status, designated recipient and aggregate revision denial. Only the explicit clear path bypasses the pending freeze itself; current scope/permission/sensitivity/version and sender checks remain.

## Obsolete expectations adjudicated by the parent

The parent explicitly confirmed CG09 requires an explicit source action rather than automatic Incident creation on ordinary save. Previous positive automatic-source tests were converted to assert no Incident or counter increment and preserved Case metadata/provenance; T1b covers the explicit positive source workflow. CG05 requires the actual suspension decision date; previous Now/default expectations were converted to 400 plus unchanged Case/history/audit, with positive fixtures supplying the exact actual date. No test cases or negative security assertions were dropped to produce PASS.

Fixtures now model an active DB actor, real role permissions and NORMAL schema defaults. Old empty-filter assertions retain the no-extra-filter purpose while also asserting the mandatory current visibility predicate. Duplicate query scope assertions now include mandatory sensitivity visibility rather than expecting scope alone.

## Migration freeze

All migrations are additive with Restrict references, nullable unknown legacy phase/stage, and flag default OFF. The parent applied and certified these only on guarded private PostgreSQL `127.0.0.1:55441/pc02_case_governance_uat`; prior 127 migration checksums and the synthetic sentinel were preserved. These applied files are locked and must not be rewritten. Any further schema addition requires migration 132.

| Migration | SHA-256 certified by parent |
| --- | --- |
| 128 `20261006060000_case_governance` | `1513d3d638ea771e476a7bd46fb2951524a92d80d4f90ebd471d770d73af001d` |
| 129 `20261006073000_case_relation_disclosure_pin` | `c204177f3802fbd330c44fe82d109f993f1bc45165661483930f4825cbf161c3` |
| 130 `20261006074500_case_principal_access_mode` | `86369ffc65591c763dcca58c16a78ca415b408e90348dc19d5abf9d5c39a93f4` |
| 131 `20261006080000_case_receipt_custody_field_policy` | `232276cc4c4627deb0a12d3a277d4db0eaa9b4c4f1fafbb2a9534016f95c2fe9` |

Initial OFF was independently proved by the parent. The parent subsequently set ON for parallel synthetic fixtures; this writer did not toggle the shared flag. The private runner reads the parent-owned password file, does not print credentials, sets only process-local `CASE_GOVERNANCE_UAT_DATABASE_URL`, and checks exact hostname/port/database before test writes.

## Fresh commands and evidence

All shell commands used `rtk proxy`, from the isolated worktree or backend directory. Counts below identify the actual command scope; skipped opt-in database tests are not claimed PASS.

| Command/scope | Exit/result |
| --- | --- |
| `npx jest src/cases src/common/utils/scope src/common/utils/kiem src/audit src/seed/case-governance-permissions.spec.ts --runInBand --silent --json --outputFile=../docs/test-evidence/case-governance/foundation-affected.json` | 0; latest completed 69 suites, 1,169 tests PASS; 4 opt-in suites /44 tests skipped; 35.927s |
| Core `case-governance.service.spec.ts` | 0; 22 tests PASS after receipt/capability/representation regressions |
| Principal `case-principal-access.service.spec.ts` | 0; 6 tests PASS including scope/current read/version/race/replay |
| Foundation integration + ordinary CasesService | 0; 136 tests PASS after exact duplicate predicate repair |
| Bulk + foundation + principal focused before later additions | 0; 43 tests PASS |
| `powershell -NoProfile -File ../tools/case-governance/run-foundation-db.ps1` | 0; 7 actual PostgreSQL tests PASS, 10.729s |
| Scoped production ESLint (core/principal/CasesService/controller/bulk/Audit) | 0 after typed audit CSV and unused metadata fixes |
| Focused coverage command below | 0; 9 suites /237 tests PASS; 85.88% statements,79.32% branches,91.39% functions,87.66% lines |
| `npx tsc --noEmit` | Prior fresh runs passed0. Latest check identified concurrently introduced T3 array typing; T3 notified. Fresh final result recorded in follow-up below. |

Coverage command: `npx jest src/cases/governance/case-governance.service.spec.ts src/cases/governance/case-governance.contract.spec.ts src/cases/governance/case-principal-access.service.spec.ts src/cases/governance/foundation-integration.spec.ts src/cases/cases.service.spec.ts src/cases/bulk/cases.bulk.service.spec.ts src/audit/case-audit-policy.spec.ts src/audit/audit.service.spec.ts src/audit/audit.controller.spec.ts --runInBand --silent --coverage --collectCoverageFrom=cases/governance/case-governance.service.ts --collectCoverageFrom=cases/governance/case-governance.contract.ts --collectCoverageFrom=cases/governance/case-principal-access.service.ts --collectCoverageFrom=audit/case-audit-policy.service.ts --coverageDirectory=../docs/test-evidence/case-governance/foundation-coverage`.

Per-file focused line coverage: core 85.64%; principal94.82%; hash contract93.54%; Case audit policy93.02%. This is executable line coverage for those four product files, not a claim about all changed files or complete CG01–17 patch branches. A broader owned-boundary coverage run and reproducible raw patch measurement are recorded below when complete. The first incorrect coverage invocation prefixed collect paths with `src/` despite Jest rootDir being `src`; it yielded an empty 0% table and was corrected, not treated as evidence of coverage.

Mock-only unit fixture files document local lint exceptions for dynamic partial Prisma delegates and immediate asynchronous fixtures, matching the existing repository mocking style. Production types/lint remain enforced. Assertions and security oracles were not changed by these exceptions.

## Stable backend integration contract

`CaseGovernanceFoundationModule` exports the core service using Prisma only. `CaseFieldPolicyModule` imports foundation and exports T1b `CaseFieldSchemaService`. Full `CaseGovernanceModule` imports foundation, field policy, evidence governance and document numbers; it provides T1b legal/configuration/operations/outbox and principal management. Evidence/Documents import foundation, avoiding a legal/evidence cycle. CasesModule wires full governance and evidence modules. AuditModule imports foundation and field policy for its dedicated policy provider.

Core consumer API (all actor authority is looked up from `actor.actorId`, never trusted role/scope/profile input):

| API | Purpose |
| --- | --- |
| `assertCaseReadable(tx,id,actor)` / `assertCaseWritable(tx,id,actor)` | Current full view / write authorization; write adds pending protection |
| `readableCaseWhere(tx,actor,{includeDeleted?,representationCapability?})` | Authorized current query predicate; default representation cap list |
| `assertBaseCaseReadable(tx,id,actor)` | Base scope+sensitivity bootstrap; no pre-existing representation grant required |
| `assertCaseAccessCapability(tx,id,actor,capability)` | Exact representation capability including download without full view |
| `assertClassificationInspectable(tx,id,actor,inspectionPurpose)` | Controlled INTERNAL/manage_access/read_sensitive inspection of quarantined label; not ordinary read expansion |
| `hasCapability`, `hasEntityPermission`, `hasSensitiveAccess`, `accessProfile`, `currentActorScope` | Explicit current active authority/profile helpers |
| `mutateCase(input,actor,handler)` / `mutateAssignment(...)` | Durable request ledger, current authorization, source Case CAS and atomic handler |
| `serializeCaseResult(tx,id,result,actor)` | Full-view current native/custom and foreign-Case graph redaction |
| `serializeCaseList(tx,row,actor)` | Summary representation boundary plus current field policy |
| `ensureEnabled`, `recordEvent`, `enqueue` | Feature gate, atomic event/audit, internal outbox |

T1b helper interfaces integrated: `validateForWrite(tx,input,existing,actor)`, `filterCustomFields(record,actor,tx,purpose)`, `assertQueryReadable(tx,actor,query,purpose,visibility?)`, `policyAwareSearchWhere(tx,actor,query,visibility?)`, `CaseOperationsService.caseFilters(query,actor,clock?)`. T3 consumes T1b `byteFieldPolicySnapshot(tx,id,actor,inspectionPurpose?)` for immutable original-byte policy proof. T1b legal receives required EvidenceGovernance service as its fourth dependency for source verification.

HTTP foundation endpoints:

- GET `/cases/:id/governance` returns `{success,data:{caseId,updatedAt,intakeStage,investigationPhase,governanceRevision,sensitivity,handoffs,events}}` after current authorization/redaction.
- GET `/cases/:id/capabilities` and GET `/cases/governance/capabilities` return current DB `actorId`, `enabled`, `caseAccessMode`, `caseAccessRevision`, explicit role caps and staff/export/clone/edit/dispatch eligibility; per-Case also returns `pendingHandoff`.
- GET `/cases/handoffs/inbox` returns current active receiving-team pending rows after sensitivity/field filtering.
- POST `/cases/:id/handoffs`: `{toTeamId,recipientId?,requestKey,expectedUpdatedAt,reason?,receiptChecklist?:[{documentId,expectedDocumentUpdatedAt,present,note?}],shortcomings?}`. Sender is server-owned. Up to100 checklist items, notes2000 and shortcomings5000 characters. Documents must belong to the Case and match actual current version.
- POST `/cases/:id/handoffs/:handoffId/accept|return|cancel`: `{requestKey,expectedUpdatedAt,expectedAggregateUpdatedAt,reason?,receiptChecklist?,shortcomings?}`; reason required for return/cancel. Stored `receiptFacts`/`resolutionFacts` include server Document timestamps; receipt does not invent a legal date.
- GET/POST `/cases/governance/principals/:userId/access-mode`. POST `{caseAccessMode,expectedUserUpdatedAt,expectedCaseAccessRevision,requestKey,reason}`; result `{success,data:{id,caseAccessMode,caseAccessRevision,updatedAt}}`.
- Normal assignment uses the existing Case assignment route and DTO; feature-on requires requestKey/expectedUpdatedAt and same-team or initial allocation. Clone create sends optional `cloneSourceCaseId` and `expectedCloneSourceUpdatedAt`; pinned field policy/sensitivity are server-owned.

Existing directory routes are GET `/teams` and GET `/admin/users`. Field schema/legal/evidence routes are documented by their owning writers, including `t1b-http-contract.md`.

## Remaining independent/release gates

Full backend/frontend regression after all writers freeze, child namespace ACL/old Evidence custody-state guard closure, independent review, native/header field-policy frontend/UAT, raw original-byte disclosure policy, deadline-effect review, Role permission governance, browser/UAT/monkey and recovery rehearsal remain parent-coordinated gates. Technical Nest bootstrap against the private DB passed according to the parent; it is not functional UAT certification. Optional UI rollback must retain a backend artifact containing these ACL/field/canonical/ledger guards even with flag OFF; the old unrestricted backend is not a safe recovery target.

Generated throwaway schema snapshots, loose generated SQL and one-off integration/fixture Python scripts exist in the shared worktree. They are not intended release files; the parent should exclude them from serial commits. Applied migration folders and permanent tests/services must be retained.

## Final freeze: DONE WITH CONCERNS, T1 remains incomplete

At the parent's instruction this writer froze the stable foundation interfaces to free the child ACL writer slot. `t1-foundation-source-hashes.json` records the 57 owned/shared-wiring source files and their SHA-256 at `2026-10-06T07:58:49.310Z`. Reproduction script: `node docs/test-evidence/case-governance/freeze-foundation-manifest.cjs`. No source changes occurred after that manifest. Parent/future writers must regenerate it after any subsequent fixes.

Final verification, superseding the earlier table where counts differ:

- Latest affected/owned-boundary coverage run: exit0, 69 suites, **1,236 PASS /0 FAIL /45 opt-in SKIP**. Jest's exact timestamps are `2026-10-06T07:57:31.258Z` through `2026-10-06T07:57:55.851Z`; duration24.590s. JSON: `foundation-affected.json`. The command is the affected suite above with `--coverage` and eleven collectCoverageFrom products named in `measure-foundation-patch-coverage.cjs`; final coverageDirectory is an absolute path to the repository `docs/test-evidence/case-governance/foundation-coverage`.
- Latest whole backend `npx tsc --noEmit`: exit0, observed completed at `2026-10-06T07:57:56Z` after the default-sort fix. This observation timestamp is not claimed to be the precise process exit instant.
- Whole owned core/principal/Case/Audit product and documented mock-fixture lint command: exit0. Subsequent changed CaseService/integration fixture scoped ESLint also exit0; no production lint suppression was added. Success was observed before the source freeze. Earlier recorded mock-only lint failures and three synthetic object throws were corrected with documented fixture rules and real Error objects; none were represented as PASS.
- Final `npm run build`: exit0. Exact tool start checkpoint `2026-10-06T07:58:09Z`; success observed at `2026-10-06T07:59:25Z` (precise process exit instant was not separately logged). Existing gen:enums/gen:catalog build steps regenerated shared frontend enums/catalog; T4 was notified. An earlier build failed on the concurrently incomplete T3 inferred array; that failed build is not the final result.
- Valid newly published header name policy integration test now passes; the frozen132 inventory remains unchanged. Foundation integration17 tests pass, core22 and principal6 pass. Added default-sort regression RED showed private `ngayDeXuat`/`sttSort` ordering for REP list-only; GREEN uses safe ID default ordering. The same shared list/Excel helper checks forbidden implicit native date ordering. Ordinary unconfigured INTERNAL default ordering is retained.
- Fresh raw patch coverage measured at `2026-10-06T07:58:22.956Z`: **710/826 executable changed lines =85.9564%**, **705/929 changed branch outcomes =75.8881%**, across all eleven declared owned executable boundaries. Artifacts: `foundation-coverage-final.json`, `foundation-patch-coverage.json`, and `measure-foundation-patch-coverage.cjs`. Tracked baseline hunks and entire added products are included; unchanged existing lines are excluded. These numbers are **below the parent's90% raw-patch gate: PENDING**, not a release-quality PASS. The preceding four-file focused percentage is not substituted for raw patch coverage.

Open crossgate explicitly assigned by the parent to T1b plus a future core integration fix: configured implicit reporting periods can still filter a private date before the policy-aware factory sees an explicit query. The builder must remove global implicit period application and pass its standalone predicate/field into the policy factory; authorized/full-view partitions may apply the period and hidden-date/list-only partitions must retain authorized summary search without date inference. T1b is implementing the optional implicit-period factory argument. This report does not claim that crossgate fixed. Root will coordinate its subsequent integration and review.

Overall status: **DONE WITH CONCERNS for the writer handoff; T1 and CG01–17 remain incomplete**. Required raw-patch coverage improvement, implicit reporting-period partition integration, child ACL/custody mutator closure and the independent/release gates listed above remain open. The source/provider API is stable for the child writer; no stubs were introduced to satisfy handoff.
