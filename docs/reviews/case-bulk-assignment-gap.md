# CG-BA01 — bulk assignment bypasses governed assignment capability

First read-only source review **MAJOR**, CG03/CG14, compatibility acceptance and approved same-guard adapter contract.

`cases/bulk/cases.bulk.controller.ts:47` uses JwtAuthGuard and DispatchGuard. `CasesBulkService.bulkAssign` calls `assertCaseAssignable` at line336 and checks the feature flag at347. Its governed branch validates versions and prohibits cross-team movement but never checks explicit CaseGovernance.operate. The common assignable guard accepts operational ADMIN/canDispatch plus Case read, while the dedicated governed assignment goes through mutateAssignment's explicit capability check. A dispatch-capable actor with Case read and no governance operation capability can therefore use bulk to perform an assignment that the governed command rejects.

The bulk mutation also updates Case/audit directly, outside the governed assignment event/revision path. Preserve existing bulk envelope and per-row outcomes, but make its feature-ON/adopted-record behavior enforce the same current actor/profile, capability, membership, expected version and business ledger effects as dedicated assignment, atomically with audit. Do not require ordinary Case.edit merely to replace the existing dispatcher-specific authority. Preserve legitimate flag-OFF legacy behavior on ungoverned internal records; representation-only remains bounded and cannot become staff dispatch.

Closure evidence: regression proving dispatch-only actor cannot mutate through bulk when governed; legitimate explicit-capability same-team assignment succeeds with unchanged ID/status/date/deadline and one consistent event/audit, stale/inactive/wrong membership denies; audit/event faults roll back and retry does not duplicate. Current permission revocation is checked inside transaction, not solely at controller entry.

Ownership: child-access writer may change only CasesBulkService and relevant specs/controller guard if necessary. Core CaseGovernanceService is currently evidence-writer-owned; coordinate any shared transactional adapter without overlapping edits.
