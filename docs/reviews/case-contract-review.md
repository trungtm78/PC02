# Case governance contract preflight — FAIL

Date: 2026-10-06. Reviewer: independent `case_contract_review` agent. Baseline: 10030bed / 0.73.0.0. First pass was read-only except this requested report. No product, schema, tests, database, production, or original dirty-root changes; no commits.

Read BRD, FRD, acceptance criteria, CASE_GOVERNANCE architecture, PLAN, PROGRESS, root AGENTS/RTK and the adversarial-review skill; inspected existing permission, Case, document, schema and rollback paths. No contradiction between the higher-priority requirements was found. Full scope remains approved. FAIL means integration prerequisites below must be closed before dependent implementation is accepted; these are within-scope technical decisions, not a request for another plan approval.

## Findings

### CG-R01 — BLOCKER: registering capabilities silently grants them to ADMIN through existing seed

Evidence: `backend/prisma/seed.ts:59-67` queries every Permission and upserts every row into ADMIN RolePermission. Architecture line 9 and FRD CG07 explicitly prohibit automatic business grants. The existing PermissionsGuard performs rolePermission checks correctly, but that does not prevent the seed from manufacturing those grants.

Impact/reproduction: register CaseGovernance review/publish/dispose permissions, run normal seed, and an unapproved technical ADMIN acquires business authority. A service checking explicit rows would still allow it.

Acceptance: exclude governance capabilities from blanket seed grants (including every deployment/repair seed path); preserve existing legitimately explicit grants; test registration followed by ordinary reseed grants none to ADMIN or other roles. Synthetic test roles may receive explicit fixture grants. Test self-review denial and inactive actors independently of permissions.

### CG-R02 — BLOCKER: preservation and holds need protection at existing hard-delete rollback boundaries

Evidence: `backend/src/xlsx-imports/commit.service.ts:535-567` permits `force` to skip dependency checks then hard-deletes imported Cases; `backend/src/legacy-migration/legacy-migration.service.ts:600-616` hard-deletes migrated Lawyers/Cases. Existing Evidence.case uses Cascade and Document.case uses SetNull (`backend/prisma/schema.prisma`, Evidence and Document models). T3's named file ownership concentrates on evidence/documents, while these integrations lie elsewhere.

Impact: adding immutable ledgers alone does not establish that original parents, physical evidence, representation, and provenance survive rollback; a force operation must never bypass a hold. A FK failure is useful defense but must not be the only unspecified user-facing behavior.

Acceptance: core/schema and evidence owners freeze Restrict/preservation relationships and a transactional deletion/hold check used by all rollback/disposition/purge routes, including force. Fresh DB tests attempt both rollback routes with held and governed synthetic records and verify all identities/history/bytes remain. No irreversible production operation is authorized.

### CG-R03 — MAJOR: document ownership and streaming access cannot be secured only by new packet endpoints

Evidence: `backend/src/documents/documents.service.ts:453-532` authorizes the current parent, then permits replacement caseId/incidentId after existence checks without target write-scope checks. `documents.controller.ts:203-220` does scoped getById, a separate getDownloadInfo read, then opens a stream; `documents.service.ts:594` accepts no DataScope. This separation creates an integration seam for ownership/grant/hold changes. Existing original bytes live at uploadDir/fileName.

Impact: reassignment can undermine frozen asset ownership and authorized evidence hydration; old download routes can bypass separate download grants or race packet checks. A hash record detects alteration but by itself does not ensure storage immutability.

Acceptance: define one service authorization/read-snapshot contract for ordinary download, packet export, registered assets and derivative access. Validate both old/new parents transactionally, protect immutable version references, use server-resolved files only, and document byte-preservation/reverification strategy. Tests cover reparenting to an inaccessible Case, grant revocation/ownership change between lookup and hydration, byte tamper, and every old download/export route. New files must not overwrite originals.

### CG-R04 — MAJOR: T0 coverage inventory and per-action legal publication matrix are not yet reviewable

Evidence: BRD/FRD/PLAN assert 132 unique keys, 181 placements, 10 tabs and 21 ids 26–46; PLAN T0 explicitly requires inventory and legal-source matrix. The provided contract does not enumerate the keys/action mapping or each action's source provision, phase transition, required decision, effective interval and authority. Existing layout is `frontend/src/features/cases/legacy-form-layout.def.ts`; legacy field catalogs exist under docs/legacy.

Impact: different writers can encode different canonical ownership, action semantics or legal readiness; a test asserting only counts can pass with wrong entries. Current legal source references are a baseline, not proof that every action is legally publishable.

Acceptance: freeze a machine-readable 132-key/181-placement inventory and 21-id semantic catalog with field ownership/clear semantics, source provenance and requirement-derived positive/negative oracles before consumers diverge. Record per-action validated legal sources, with unpublished/unverified rules fail-closed. Never activate rules merely because catalog or technical seed exists. This review did not independently validate statute contents and makes no legal-compliance claim.

### CG-R05 — MAJOR: multi-writer shared mutation/version contract needs explicit freeze

Evidence: architecture specifies actor/requestKey uniqueness, expected aggregate versions, Case governanceRevision plus updatedAt, content hash, field definitions and exact packet revision, but not the concrete shared DTO/replay namespace/hash canonicalization or transaction helper signature. PLAN requires shared schema/auth contract before T3 and HTTP contract before T4. Existing Case update uses optional updatedAt CAS (`cases.service.ts:2356`), synthesizes suspension date (`:2337`), and writes status history/audit after parent update (`:2435-2459`). The architecture already correctly requires these last behaviors to change.

Impact: independent implementations can hash differently, replay across command types/cases, invalidate approvals incompletely, or use stale pending/authority checks outside their mutation transaction. New endpoint-only checks leave legacy and bulk mutation bypasses.

Acceptance: one owner freezes actor context, query predicate, transaction client guard, command version fields, canonical request digest, idempotency scope/result and 409 mapping. Enumerate all parent/child/bulk/import mutation entrypoints and assign each integration owner. Test legal-date absence/EDTF/invalid civil dates without `now` fallback, history atomic rollback even flag OFF, pending child-write race, cross-case/key replay, and changed request invalidating approval. Published definitions/rules and approved packets require immutable version IDs, not mutable JSON links alone.

## Required interface decisions before dependent writers

1. Core owns Prisma schema/migration and shared cases.service integration; evidence proposes schema needs before core freeze, not concurrent schema edits.
2. Freeze capability checks requiring current active actor, ordinary Case permissions/DataScope, explicit governance capability and validated relation/sensitivity/expiring grant; define fail-closed behavior for malformed conditions and unknown sensitivity.
3. Freeze canonical field accessor/tombstone representation and backend validation shape for frontend/Word/Excel/search; preserve unknown historical fields without converting them to authoritative legal facts.
4. Freeze action/request/rule/packet review states and exact version/hash invalidation, including author/reviewer separation for every lifecycle, flag-OFF handoff clearing, and immutable audit/history ownership.
5. Freeze shared authorized list/count/export/dashboard predicate and clock; define directed relation types and cycle scope so symmetric RELATED links are not accidentally treated as legal merges. Lock source/targets in stable order for concurrent cycle/scope checks.
6. Freeze evidence storage and restrictive FKs, streaming verification, retention no-policy behavior, correction events, holds and representation capability distinctions. A technical hash must not be presented as external signature authenticity.
7. Outbox lease, retry and idempotent Notification write must share a transaction and recheck recipient visibility. Never conflate task counts with unscoped source records.

## Verification evidence and limits

- Commands: `rtk proxy powershell -NoProfile -Command ...` read the named contracts and selected source ranges; `rtk proxy rg -n ...` identified integration entrypoints. Five inspection invocations completed with exit 0; one initial rg invocation exited 1 because `backend/src/evidences` does not exist (Evidence is currently a model/Case child, not that module). Subsequent source inspection resolved the location. Large unrelated frontend search output was truncated; conclusions above cite individually inspected source.
- Tests executed by this reviewer: 0 (read-only contract review, not implementation acceptance). Coverage, runtime security, migration, performance, recovery, and UAT are unverified here. No fabricated PASS percentage or score.
- No higher-priority requirement conflict requiring user clarification found. Missing implementation interface decisions can be made under the user's existing delegated authority and recorded by the coordinator.
- Re-review required after findings are addressed in the shared contract and implementation evidence is available. Production GO, external legal-source publication validation and historical-data apply gates remain unchanged.

**FAIL — 2 BLOCKER, 3 MAJOR; findings reported before fixes.**
