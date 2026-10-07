SPEC: **FAIL**  
QUALITY: **FAIL**

Limitation: I reviewed only the inline frozen diff, requirements, and supplied evidence text. I did not run hash checks, tests, filesystem reads, Prisma validation, or runtime/JWT UAT.

Strengths: the implementation shows real attention to CAS/idempotency, explicit capabilities, immutable published config, policy-aware search partitioning, transaction-wrapped mutations, and outbox lease/retry behavior. The test set also includes meaningful negative oracles around protected search, schema pinning, replay, and outbox suppression.

**BLOCKER Findings**

`T1-policy-R1` — Pending handoff is not guaranteed to be unique  
Source: `backend/prisma/schema.prisma`, added `CaseHandoff` model around `+3394` to `+3423`; `backend/src/cases/governance/case-governance.service.ts`, `sendHandoff` around `+548` to `+573`.

Defect: the schema has only `@@index([caseId, state])`, not a partial unique constraint for one pending handoff per case. `sendHandoff` creates a new `CaseHandoff` after setting `intakeStage: 'CHO_NHAN'`, but there is no source-level uniqueness guard shown that prevents two concurrent `HANDOFF_SEND` operations from both creating `state='PENDING'` ledgers for the same case.

Impact: violates CG02 and architecture’s “exactly one pending ledger” requirement. Concurrent dispatch can create multiple pending receipt ledgers, making accept/cancel/return semantics ambiguous and breaking the parent-write protection invariant.

Proof: the model declares no unique pending constraint, and `sendHandoff` does not query/update with a “no pending handoff exists” predicate before `caseHandoff.create`.

Closure: add an enforceable DB-level partial unique index for pending handoffs per `caseId` or an equivalent serializable checked invariant, plus a concurrent-send regression proving only one pending ledger/event/audit/outbox survives.

`T1-policy-R2` — Representation grants with no expiry are treated as invalid for Case access  
Source: `backend/src/cases/governance/case-governance.service.ts`, `representationWhere` around `+98` to `+112`, `representation` around `+114` to `+134`.

Defect: both representation filters require `expiresAt: { gt: new Date() }`. The approved access model requires expiring grants to be enforced, but does not require every grant to have an expiry, and other grant logic in this same group accepts `expiresAt: null` as active.

Impact: valid open-ended representation grants are denied for list/view/edit/download/share/dispose paths. This breaks CG13/14 and can cause authorized representatives to lose current access.

Proof: `CaseGovernanceGrant` sensitivity checks use `OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]`, but `CaseRepresentationGrant` checks do not. The schema makes `CaseRepresentationGrant.expiresAt DateTime` non-null, but the requirement and principal-boundary closure describe expiry/revocation semantics, not mandatory expiry. If the schema intentionally forbids open-ended representation grants, that is a requirements mismatch.

Closure: either make representation grants explicitly non-null-expiring in the requirements and UI contract, or update schema/service predicates to support `expiresAt null` consistently, with tests for null, expired, and revoked grants.

**MAJOR Findings**

`T1-policy-R3` — Configuration publication allows author to publish their own reviewed revision  
Source: `backend/src/cases/governance/case-configuration.service.ts`, `transition` publish branch around `+255` to `+269`.

Defect: publish rejects only when `row.authorId === actor.actorId`. It does not reject when `row.reviewedById === actor.actorId`. The architecture requires author/reviewer separation and explicit independent approval; publishing should not let the same reviewer finalize their own approval unless the approved workflow explicitly defines a third role boundary.

Impact: weakens CG07 separation of duties. A reviewer can both approve and publish a rule/field schema revision, concentrating legal activation authority.

Proof: review branch sets `reviewedById: actor.actorId` around `+241` to `+247`; publish branch checks author/hash/revision/status but never checks `row.reviewedById !== actor.actorId`.

Closure: enforce publisher independence from reviewer, or document and test the intended two-person model if publisher may equal reviewer. Given the accepted criteria “cannot self-review/publish even ADMIN,” add negative tests for reviewer-as-publisher.

`T1-policy-R4` — `CaseGovernanceGrant.capabilities` and `CaseRepresentationGrant.capabilities` are JSON but queried with `array_contains`  
Source: `backend/prisma/schema.prisma`, `CaseGovernanceGrant.capabilities Json` around `+3541`; `CaseRepresentationGrant.capabilities Json` around `+3652`; queries in `case-governance.service.ts` around `+104`, `+128`, `+315`, `+672`; `case-field-schema.service.ts` around `+45`.

Defect: the schema defines capabilities as `Json`, while queries use Prisma `array_contains`. For PostgreSQL JSON fields, provider/operator support is delicate and differs from scalar list fields. The source diff does not show a typed enum/string-array column or DB constraint proving this is a valid and indexed membership predicate.

Impact: grant checks may fail at runtime or become slow/full-scan behavior. This directly affects CG13/14 access boundaries for sensitivity and representation capabilities.

Proof: all grant membership checks assume array semantics on JSON: `capabilities: { array_contains: ['read_sensitive'] }` and similar. No validation or schema constraint guarantees the JSON value is an array of known capability strings.

Closure: store capabilities as a typed `String[]` if supported, or add explicit JSON validation plus verified Prisma/PostgreSQL tests for membership, null/malformed JSON, revoked/expired grants, and query plans where relevant.

`T1-policy-R5` — Snapshot reads hydrate handoffs/events before serialization and can leak through incomplete redaction  
Source: `backend/src/cases/governance/case-governance.service.ts`, `snapshot` around `+455` to `+489`; `redactForeignCases` around `+238` to `+325`.

Defect: `snapshot` loads all handoffs and governance events for the case, then relies on generic redaction. `serializeGovernance` only applies pinned field-policy redaction and foreign-case redaction. It does not systematically redact actor IDs, team IDs, receipt facts, resolution facts, source snapshots, or sensitive payload fields within events/handoffs according to current principal capability.

Impact: case history may expose staff identities, team assignment history, receipt checklist document IDs, reasons, or policy-sensitive payload facts to principals who can view only a limited representation/list context. This threatens CG14 history/audit serialization requirements.

Proof: `snapshot` returns raw `handoffs` and `events` in `data`. `redactForeignCases` focuses on case references; native policy redaction only applies if the case has a pinned field schema and only to configured native/custom fields.

Closure: define explicit snapshot DTOs per principal mode/capability, redact handoff/event payloads by purpose, and add tests for REPRESENTATION_ONLY, list-only, restricted case, and hidden related-case payloads.

**MINOR Findings**

`T1-policy-R6` — Dashboard due/overdue compares `Date` to a full timestamp, not civil-day semantics  
Source: `backend/src/cases/governance/case-operations.service.ts`, `member` around `+48` to `+68`.

Defect: overdue/due buckets compare `row.deadline < now` and `deadline.getTime() <= now + 7 days`. If `deadline` is a civil legal deadline stored at midnight, it becomes overdue immediately after midnight on the deadline date.

Impact: queue counts and drilldowns may misclassify same-day deadlines, creating misleading supervisory dashboards under CG16.

Closure: define civil-day deadline semantics and normalize comparisons to local/business date boundaries with tests for start/end of deadline day and timezone.

`T1-policy-R7` — `capabilities()` still treats role name `ADMIN` as dispatch authority  
Source: `backend/src/cases/governance/case-governance.service.ts`, `capabilities` around `+413` to `+419`; `globalCapabilities` around `+444` to `+446`.

Defect: returned UI capabilities set `canDispatch` true for `user.role.name === 'ADMIN'`. Requirements say technical administration is not automatic authority to approve case decisions and frozen closure excludes blanket grants. While dispatch is operational rather than approval, surfacing admin-derived dispatch authority is a scope/authority smell.

Impact: UI may enable dispatch workflows for technical admins without explicit business authority, depending on downstream service checks.

Closure: use explicit permission/capability or `canDispatch` only, and add a regression that ADMIN without dispatch/business capability sees dispatch disabled and cannot send handoffs.

I am not marking whole T1 approved. Human production GO, full JWT UAT, child/evidence/UI integration, and runtime legal publication remain separate gates.