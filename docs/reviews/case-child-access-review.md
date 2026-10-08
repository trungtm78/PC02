# Child/source/Admin first read-only review — 2026-10-06

SPEC_COMPLIANCE: FAIL  
CODE_QUALITY: FAIL  
VERDICT: FAIL

Three confirmed findings require scoped fixes. No source, index, commit, database, maintenance CLI, credentials or production changes were made. Only this report was written. Findings below are deterministic source-path proofs and required regression oracles, not claimed executed UAT.

## Frozen scope and independence

Reviewed the45 product deltas in `.superpowers/sdd/PLAN/child-final-review.md`, with named test/fixture checks for concrete risks. The package SHA matches `6ce034a49d359cf4675ba15d12356511dbb30a3e3485d2d419b123182aaeb38d`; read-only comparison of `child-review-impact-manifest.json` found **124/124 hashes matching, 0 missing/mismatched** (45 product/79 test-fixture), exit0. Full files were not reread except named adjacent authorization/serialization risks. Graph67, unrelated T3/Core changes and frontend were excluded.

The reviewer reused the frontend executor context but did not write this backend implementation. This establishes independent backend ownership, not fresh-context or cross-model independence, and does not review the reviewer's own T4 source.

## Findings

### CHILD-R1 — MAJOR — role-wide edits bypass protected-principal authority and scope

`backend/src/admin/case-authority.guard.ts:79` collects role users as IDs only. The `target` at97 exists only for targetUserId. Live grants at132 and REPRESENTATION_ONLY at152 are therefore checked only for an individual target. A role with no CaseGovernance permissions can contain representation-only or live-granted users, yet roleId operations classify it as nonsensitive. Required User.write/manage_access, INTERNAL management and writable-target checks are skipped. `admin.service.ts:627` and757 use precisely this roleId path for role/permission updates.

Impact: technical role administration can alter business principals' effective Case rights without the approved business-account authority; a finite business manager can affect protected accounts outside writable scope. Existing `case-authority.guard.spec.ts:105`/112 protections use targetUserId and do not prove the role-wide path.

Minimal negative oracle: reuse the ordinary-role fixture with no governance permissions, make its assigned user REPRESENTATION_ONLY (then separately give it each active Case grant type), and call guard with `{roleId:'ordinary', nextPermissions:[{subject:'Case',action:'read',conditions:null}]}` from a technical actor lacking manage_access. Expect403 and no role/permission/audit mutation. Add a finite manager with a protected role user outside writable scope and expect403. Positive oracles must retain ordinary role CRUD when no protected user exists and authorized role changes when every affected protected target is controlled. Evaluate/lock affected principals' current mode/grants rather than blanket-denying ordinary roles.

### CHILD-R2 — BLOCKER — Subject/Lawyer mutation responses disclose masked native parent fields

Subject create/update include raw parent name/status at `subjects.service.ts:284`/398, then return `data:record` at307/424. Lawyer equivalents are `lawyers.service.ts:228`/326 and252/353. GET uses childAccess.serialize, but the common mutation wrapper `case-child-access.service.ts:481` returns the callback result unchanged. Their controllers have no Case graph-policy interceptor; the global interceptor is DataScopeInterceptor.

Impact: on a NORMAL Case with pinned native name/status RESTRICTED, a legitimate child writer without read_sensitive receives protected values in POST/PUT responses even though GET masks them. Case write authority is not native-field read authority.

Closure oracle: actual pinned policy, current scoped actor with legitimate child write/edit and Case write/edit but no read_sensitive; Subject and Lawyer create/update must succeed while omitting protected parent name/status and preserving permitted child facts and parent context. Verify both service and controller results, positive sensitive-reader values, and current-grant revocation. Apply current native serialization to mutation results through the same transaction/current actor, without weakening write/CAS/audit behavior.

### CHILD-R3 — MAJOR — masked parent DTOs are reused as mutation-scope facts

Subject `getById` serializes at `subjects.service.ts:202`; update/delete then authorize against masked `existing.case` at333/449. Lawyer repeats at278/378; Conclusion at173/236; Supplement at207; linked Proposal at396/474 and Delegation at446/555. The shared scope check `common/utils/scope-filter.util.ts:169` treats omitted assignedTeamId as unassigned and refuses that for ward officers.

Impact: if a pinned policy masks both assignedTeamId and investigatorId, a legitimate ward officer on the actual writable parent receives403 for unrelated child edits/deletes, despite common writeInTransaction authorizing the real parent. Read masking changes business authority instead of only presentation. Existing ordinary mutation fixtures preserve unmasked parents and miss this condition.

Closure oracle: a current finite ward officer owns a NORMAL writable Case, both ownership header fields are unreadable, and ordinary child update/delete (plus linked optional-parent operations) must still succeed with correct parent/CAS/audit. Responses must remain masked. Foreign/borrowed-read-only parents, pending handoffs and concurrent reparenting must still fail atomically. Use current authoritative parent facts supplied/refetched inside the mutation transaction; do not authorize from serialized display DTOs or weaken scope checks.

## Boundaries inspected and evidence limits

Explicit Incident/Petition conversion now uses actual source actor/edit authority, INTERNAL creation, source version/CAS, canonical/default typed values, durable content-bound replay, number/link/audit/event/outbox in one transaction. Strict null-phase comparison leaves the catalog unchanged. Civil HCM day/seventh-day calculations and serialized/native-readable formula predicates address protected-versus-missing distinctions. Child direct/bulk paths bind parent/version and current entity rights; optional-parent counters/audit and delegation notification timing are atomic. Source deletion/merge checks both lineage directions and preservation, and source-only exports retain their ordinary protocol. These inspected strengths do not override the findings or certify every matrix row.

Implementer-reported evidence remains **119 suites/1,710 PASS/16 opt-in SKIP**, private13, executable patch929/1,025=90.6341%, branches78.5152%, scoped added-hunk lint0/0 with legacy460/1 separate. The reviewer did not repeat those tests or independently certify coverage. No90% branch gate was invented.

The separately noted **CG-RP01 cross-owner scoped-grant/principal-mode acquisition versus old technical credentials/enrollment** remains an open T3 investigation/closure gate. CHILD-R1 is the distinct child-owned role-wide protected-target classification defect; this report does not silently approve the acquisition boundary.

Root still owns consolidated backend types/build (current graph error not certified), requirements-derived actual JWT/API/browser UAT, role/source races, graph67 acceptance and production GO. Triaging314 candidates to zero OPEN is not verified UAT. This first read-only gate remains FAIL until CHILD-R1–R3 have recorded RED regressions, bounded fixes, fresh affected evidence and independent closure review.
