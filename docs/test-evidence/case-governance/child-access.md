# Case child / source / account authority evidence

Status: **IMPLEMENTATION FROZEN FOR INDEPENDENT READ-ONLY REVIEW. Review, requirements-derived actual HTTP/JWT UAT and the consolidated whole-backend types/build gate remain required. No release or CG01-17 completion is claimed.**

The owned product manifest is child-source-hashes.json: 45 backend files including all direct/bulk child services/controllers/modules, account/enrollment/worker guards, source creation/JSON/preservation adapters and explicitly transferred FieldSchema/legal-phase/civil queue/CasesService overdue/Bulk assignment deltas. Calendar/KPI/reports/shared/notification/template rendering was transferred to case_core_integration_finish; Documents/evidence/import/core sensitivity/schema remain T3-owned; frontend remains T4-owned. No commits/index/push/deployment, normal .env, production access or external messages.

## Route closure matrix

child-entrypoint-matrix.json assigns **314/314** AST candidates an actual effect, owner, current authority/native/profile requirement and evidence: **0 OPEN**, 114 implemented pending review/UAT, 170 other-owner, 30 actual non-Case. Other-owner entries require their owner's acceptance; this report does not certify them. Source-only Word/Excel/bulk selectors and declared form/export registries contain no Case-derived fields, so their ordinary source permission/scope protocol remains applicable. Rendered dynamic template consumers are explicitly assigned to the graph owner. Generic Incident/Petition list/count filters do not receive unrelated Case SQL.

Physical Evidence established-state ordinary PUT/bulk inventory is **NOT APPLICABLE**: no such route/delegate exists; only initial Case evidence.createMany was found. T3 ledger/provenance/custody owns established assets. Initial creation compatibility remains root/core reviewed scope.

## Implemented boundaries

- Mandatory HTTP actor reaches direct child read/list/count/search/serialization and every mutation. Actual current role/entity, current Case view/write/profile/scope/sensitivity/pending checks apply. Pinned native policies partition parent token searches and serializers; bulk exports enforce current export/profile and pinned exportability. Child parent/version, parent revision/CAS and audit share Serializable transactions.
- Optional Proposal/Delegation parents retain standalone creator protocols. Linked old/new parents are guarded; number/audit/child/parent CAS are atomic. Returned parent hydration/export uses its own policy. Delegation assignment notifications publish after commit, including final parent CAS success.
- Current explicit User.write + CaseGovernance.manage_access governs business account/role/security/enrollment and live-granted/representation principals. Target writable scope includes inactive account maintenance in active owned teams; finite managers must control every affected role account. Business scope grants additionally require an active owned destination. Ordinary non-governance account/grant management remains compatible. Self capability acquisition is denied; acquisition invalidates enrollment/refresh/tokenVersion and uses an unguessable pending-activation password while preserving 2FA factors. Delayed bulk workers and credential job reads recheck current authority.
- Explicit Incident/Petition Case creation preserves the authorized flow with current source edit + current Case.write/creation scope/INTERNAL profile. Canonical/default-pinned typed validation, actual source version, stable operation/hash/replay, Case counter/lineage/audit/event/outbox share one transaction. Optional caseCustomFields supplies only declared typed values through the real validator. Missing required defaults reject creation; false/zero remain valid; legacy unrelated omissions remain unknown. Petition Document moves use T3's real parent/provenance/hold guard and selected Document versions.
- Source single/bulk deletion preserves governed Case lineage in both FK directions, holds and current source/parent write authority. Incident merge preserves Case-owned source documents/Petition lineage and guards current source/target before the original atomic protocol. Mixed source JSON uses current foreign-Case view and each foreign ID's own pinned native policy, removing inaccessible IDs/graphs/aliases while retaining ordinary source facts. Known otherCase/parentCase and discriminated Case sourceSnapshot are covered; unrelated source snapshot IDs remain source IDs.
- Transferred strict legal phase equality includes null; HCM civil days drive overdue and the full seventh-day window. Queue formulas consume serialized native fields with explicit readiness, preserving unknown/protected distinctions. Overdue Case list predicates partition deadline/status readability. Governed bulk assignment requires INTERNAL dispatcher authority plus operate, and persists replay/event/audit/revision atomically; OFF ordinary legacy compatibility remains.

## Fresh verification

| Gate | Actual result |
| --- | --- |
| Final affected + private coverage | rtk proxy powershell -NoProfile -File tools/case-governance/run-child-final-private.ps1: exit0; **119 suites /1,710 PASS /16 opt-in SKIP**. child-final-affected.json, child-final-coverage.log, raw Istanbul child-coverage-final.json |
| Actual private PostgreSQL | **13/13 PASS**, included in final coverage. Standalone child-private-db.json also records13/13 |
| Raw executable patch coverage | measure-child-checkpoint.cjs: **929/1,025 =90.634146%**, all45 owned/transferred product files, no missing files/exclusions. Branch outcomes **698/889 =78.515186%**, reported separately; no branch>=90 claim. Exact before snapshots/raw JSON/changed/uncovered lines retained |
| Scoped ESLint | run-child-final.cjs lint + child-scoped-lint.cjs: exact added-hunk diagnostics **0 errors /0 warnings**. Whole-owned-file lint remains exit1: **460 legacy errors /1 warning**, predominantly pre-existing formatting/unsafe code; raw diagnostics retained, no suppressions |
| Types | Latest whole tsc --noEmit had only graph-owner reports/graph-access/case-graph-access.service.ts:126 TS2353; no owned/root/T3 errors. Graph owner notified. Final consolidated fresh types/build belongs to root freeze gate |
| Source manifest | SHA256 for every owned product source and exact assigned baseline in child-source-hashes.json / child-patch-coverage.json; remeasurement reproduces this frozen patch |

Actual private DB proves sensitivity/native token-count, exact grant revocation, pending freeze, child/audit/parent atomicity, injected fault/concurrent reassignment rollback, technical versus scoped business credentials, old enrollment invalidation, current role revocation, both-FK governed source preservation, business scope grants/source fault rollback, and actual Incident converter/typed default/real isolated number counter/lineage/replay/current Case.write revocation.

Pure cosmetic changes to 42 unchanged class members were restored only when Prettier-normalized AST fragments matched exactly. No behavior was removed, no coverage denominator file was excluded, and final coverage was generated afterward. CasesService formatting was restricted to its transferred predicate.

## RED evidence and focused closure

Structured RED JSON remains: initial technical account security3 failures, live-grant protection2, conditional management1, prospective credentials2, enrollment promotion race1, credential job1, direct child2, explicit source authority2, required-default integration1, strict null phase5, civil/native queue and governed assignment negatives. Adjacent GREEN/original affected JSON preserves all original oracles.

Additional focused REDs: business DataAccessGrant create/revoke2 (resolved without business management), foreign otherCase/parentCase/discriminated snapshot1 (private name survived), post-CAS delegation notification1 (emitted before rollback), current source writable scope1 (deleted using stale scope), Incident merge adapter1 (moved source links despite the Case guard), immutable Supplement parent-bound delete1 (deleted by ID alone). Focused GREEN preserved all assertions; final119-suite run includes them. Controller import/provider wiring failures were integration failures and were repaired in production import order and constructor-only test providers. Invalid initial schema keys/omitted sensitivity, missing Petition required DTO values and incomplete fixture delegates were fixture mistakes, not product RED evidence.

Every private run validates 127.0.0.1:55441/pc02_case_governance_uat, reads the runtime password outside the repository without printing it, keeps the shared flag ON, retains namespaced synthetic fixtures, and never purges another writer's fixtures. No real emails were sent.

## Remaining acceptance gates

Independent read-only leaf/bounded-transfer review; graph owner's complete matrix/evidence; requirements-derived actual HTTP/JWT/API/UI UAT including source conversions/current ACL/role-mutation races and export/header/native inference; consolidated whole-backend types/build; root aggregate acceptance. These are open acceptance gates, not unimplemented owned matrix rows. Branch coverage78.52% and legacy whole-owned-file lint debt are explicit limits for adjudication. Any review/UAT finding must be reported before a scoped fix and fresh affected evidence.
