SPEC: **FAIL**  
QUALITY: **FAIL**

I performed this as a text-only, read-only review from the inline package only. I did not invoke tools, shell, filesystem, MCP, network, agents, hash checks, tests, or coverage. The host’s SHA256/package verification and reported test evidence are not independently re-executed here. This review does **not** approve whole T1, production GO, full JWT UAT, evidence/child/UI integration, or statutory legal publication.

**Strengths**

The implementation has several solid foundations: all 21 legacy action codes are represented; legal sources are kept unpublished pending reviewed rules; decision validation rejects incomplete civil dates and known partial/extracted quality flags; approval is revision/hash-bound; mutations use the core transaction/idempotency path; source/allocation snapshots are server-owned; deadline calculation is declarative and avoids eval/prototype reads; and the tests include meaningful rollback, approval, source hash, relation, split, classification, and private DB/HTTP coverage.

**Findings**

`T1-legal-R1` — **BLOCKER** — Null source phase is treated as wildcard, not exact phase match.  
Source: `backend/src/cases/governance/legal-action.validation.ts:+18-21`  
Defect: `planLegalAction` only compares phase when `action.source.phase !== null`. Catalog actions whose required source phase is `null` therefore accept any non-null `record.investigationPhase`.  
Impact: actions such as `REVIEW_EXPIRY`, `RESTORE_SUSPENDED`, `SUPPLEMENT_AFTER_CONCLUSION`, and expired discontinuation can be planned/executed from stale or invalid phase state, violating “allowed exact source state/phase” and unknown legacy phase preservation.  
Proof: the condition rejects mismatched non-null catalog phases but never rejects `record.investigationPhase = 'INITIAL'` when the catalog source phase is `null`. Existing tests also skip the negative phase assertion for null source phases.  
Closure: require strict source phase equality, including `null`, or an explicit documented wildcard separate from catalog `null`; add positive/negative tests for every catalog action with `source.phase === null`.

`T1-legal-R2` — **BLOCKER** — Legacy `_sensitivity` does not tighten read/list predicates.  
Source: `backend/src/cases/governance/case-governance.service.ts:+readableCaseWhere legacy query block`, `+sensitive()` block  
Defect: legacy sensitivity checks inspect `metadata->>'sensitivity'` / `meta?.sensitivity`, but not `metadata._sensitivity`. Yet classification writes both `sensitivity` and `_sensitivity`, and the requirements say metadata-only legacy sensitivity may tighten access, never downgrade.  
Impact: a legacy Case with `Case.sensitivity = NORMAL` and `metadata._sensitivity = 'RESTRICTED'` can pass list/read/count/export predicates for an actor without sensitive authority. This is a CG14 privacy failure.  
Proof: the query raw legacy scan only selects `metadata->>'sensitivity'`; `sensitive()` only reads `meta?.sensitivity`; neither treats `_sensitivity` as restrictive.  
Closure: include `_sensitivity` in readable predicates and point-read sensitivity checks; add list/count/export/detail tests for `metadata._sensitivity = RESTRICTED`, unknown `_sensitivity`, and mixed legacy/dedicated classifications.

`T1-legal-R3` — **MAJOR** — One-pending-handoff invariant is not enforced at the schema boundary.  
Source: `backend/prisma/schema.prisma:+3408-3434`, especially `+3432`  
Defect: `CaseHandoff` has only `@@index([caseId, state])`; there is no partial unique constraint for one active `PENDING` handoff per case.  
Impact: service CAS reduces normal race risk, but the approved architecture requires a database-backed partial one-PENDING ledger. Imports, repair jobs, concurrent non-service paths, or future writers can create multiple pending ledgers, breaking receipt/assignment and pending-write protection semantics.  
Proof: schema shows indexes only, no uniqueness over active pending state.  
Closure: add an additive migration with a partial unique index for pending handoffs, plus tests proving duplicate pending insertion fails while historical accepted/cancelled/returned rows remain allowed.

`T1-legal-R4` — **MAJOR** — Relation uniqueness blocks preserved relation history after revocation/deletion.  
Source: `backend/prisma/schema.prisma:+3547-3569`, especially `+3567`  
Defect: `CaseRelation` uses global `@@unique([sourceCaseId, targetCaseId, type])` even though rows have `revision`, `revokedAt`, and `deletedAt`.  
Impact: after a reviewed correction revokes a relation, the system cannot create a later valid relation of the same type between the same cases without overwriting or deleting history. That conflicts with “relations retain history and use reviewed revocation revisions” and “prevent duplicates” as an active-state invariant.  
Proof: the unique key does not exclude revoked/deleted rows.  
Closure: replace with an active-only uniqueness constraint, e.g. partial unique where `revokedAt IS NULL AND deletedAt IS NULL`, and test re-creation after reviewed revocation while still rejecting duplicate active relations.

**Unverifiable / Separate-Gate Risks**

I could not independently verify `CaseEvidenceGovernanceService.decisionSourceSnapshot` ownership/byte-hash enforcement because that implementation was not included in the legal source group excerpt. The legal workflow relies on it for final source-document authority.

I also did not execute the reported coverage, private DB, HTTP, lint, type, build, or SHA evidence. Reported coverage >=90% executable patch lines remains host-supplied evidence, not independently certified by this pass.

Full JWT middleware UAT, child/evidence/UI integration, whole T1 approval, statutory per-action legal publication, production GO, and cross-group acceptance remain separate gates.