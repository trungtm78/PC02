# CG-ER01 — Basic evidence governance read contract

Read-only runtime smoke finding, MAJOR OPEN. Architecture frozen integration closure says: “Basic governance reads derive existing Case read rights; sensitive operate/review/publish/share/custody/dispose require explicit capability.” Core GET governance/capabilities follow this contract.

Actual private HTTP evidence: runtime-smoke.json reports authorized synthetic author with current Case read/edit, operate/share/download/custody/dispose/read_sensitive receives200 for Case/governance/capabilities but403 for evidence-governance. Controller requires Case.read; evidence-governance.service.ts getSummary additionally requires CaseGovernance.read. The frozen architecture does not define that extra gate for basic summary. This creates an inconsistent prerequisite not described by capabilities, which does not return read.

Closure: align basic summary with the approved current Case read/scope/sensitivity contract while keeping asset/document entitlement, recipient representation, field policy and all command/download/custody/share/disposition capability checks. Or identify explicit higher-priority requirement necessitating a separate summary gate and return the inconsistency for controller resolution before changes. Add a real service/controller negative/positive regression, not only a mocked route test. Do not manufacture PASS by granting an unmentioned capability to the fixture.

No source changes by this review; T3 owns closure.
