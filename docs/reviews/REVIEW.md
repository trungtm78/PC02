# Final independent adversarial review — Case Governance

Date: 2026-10-07. Baseline: `10030bed705ad1afa27eff0986b0c4c43d591aa6`. Worktree: `.worktrees/case-governance-20261006`.

**LATEST SOURCE CLOSURE: PASS for CG-FINAL-R1–R4. OVERALL MILESTONE / RELEASE: FAIL.** The four reported source defects have been corrected and independently reviewed below. CG-FINAL-R5 remains OPEN/BLOCKER. Original first-pass findings and evidence are retained as history; the scoped closure does not certify runtime UAT or production readiness.

## Independent closure review — 2026-10-07

This second pass inspected current source, changed regression oracles, provider wiring and focused evidence directly, without product/test/config changes or test/database/network execution. The reviewer remains independent of the implementer. Current source hashes are recorded below; older full backend/frontend results predate these fixes and are not represented as new whole-suite runs.

| Finding | Current source proof and regression assessment | Closure |
|---|---|---|
| CG-FINAL-R1 | `CasesService.prepareCreateFields` now reads both metadata aliases and inherits RESTRICTED when the dedicated classification or either alias is restrictive. `assertCaseReadable` still rejects unknown labels before clone processing. Source-only sensitive authority cannot satisfy the global sensitive-copy check; caller `metadata: {}` cannot downgrade the server-owned dedicated classification. The targeted clone fixture now exercises mixed NORMAL / `_sensitivity: RESTRICTED`, explicit empty metadata, 403/no-create and stale-version 409. Pinned schema inheritance remains in the existing source-bound field validation. | **CLOSED — source PASS** |
| CG-FINAL-R2 | Access-mode changes now apply `businessCredentialInvalidation(true)` inside the same serializable User CAS/audit transaction when the mode changes. Exact replay returns before another invalidation; a no-op mode does not replace credentials. Representation acquisition invalidates tokenVersion, refresh and enrollment state in its governed transaction, and replaces the password for pending enrollment/mustChangePassword accounts while retaining established activated passwords/factors. The helper clears the old enrollment hash and generates an unguessable password rather than returning a technical-known replacement. New oracles verify null enrollment/expiry/refresh, tokenVersion increment, pending trusted password activation, and single replay mutation. | **CLOSED — source PASS** |
| CG-FINAL-R3 | Both legacy FROM_PETITION and FROM_INCIDENT branches call `CaseSourceCreationService.execute`, carrying actual source identity/version and full creation content, and no caller dataScope authority. That service requires current source edit/INTERNAL/current scope and Case creation authority, locks the source, validates versions, uses content-bound durable replay, and records event/outbox/current serialization inside one serializable transaction. Both callbacks pass `tx` to CASE_CREATED audit; Incident retains its source audit/history in the same transaction. Both post-commit `case.created` emits are explicitly guarded by `!creation.replayed`, so the early durable replay does not rerun the callback/counter/audit/event/outbox or in-process emitter. CasesModule imports the module exporting the actual provider; the optional-constructor fallback instantiates the same real service and is not a bypass. Adapter delegation, source authority/version/replay and transaction tests remain green. | **CLOSED — source PASS** |
| CG-FINAL-R4 | The common Case registration data no longer invokes `machMocGiaiQuyet` or supplies an inferred resolution date. Terminal statuses are retained while absent factual dates remain absent/DB-null. The regression registers DINH_CHI and asserts the persisted creation input has no ngayGiaiQuyet. Actual reviewed legal execution still calls the helper with `plan.decision.effectiveDate`, preserving the real-date positive boundary. | **CLOSED — source PASS** |
| CG-FINAL-R5 | No complete critical UAT/application recovery/performance/monkey/current coverage acceptance evidence was supplied by this focused repair. The source closure cannot execute or sign those gates. | **OPEN — BLOCKER for milestone/release** |

**Focused evidence inspected:** `docs/test-evidence/case-governance/final-review-fix-red-green-20261007.md` records pre-fix RED exit 1: four R1/R2/R4 failures plus 223 passes, and one R3 delegation failure plus 120 passes. These RED totals are implementer-recorded summaries, not reviewer reruns or independently retained machine reports. `final-review-fix-focused-green-20261007.json` was parsed independently: **6 passing suites, 251/251 PASS, 0 FAIL, 0 pending, success true**, run start `1791391626184`; the matching markdown records exit 0. Suites are CasesService (121), Incident prosecution (7), foundation integration (19), evidence governance (81), source creation (17), principal access (6). The markdown also records post-fix `npx tsc --noEmit` and `npm run build`, both exit 0; those remain supplied command evidence.

The clone and terminal-registration fixtures now expose the confirmed defects while retaining denial/no-write/version and source-preservation assertions. Adapter unit tests mock the shared boundary to prove delegation; the separate real service unit suite proves its current-authority/replay/transaction behavior. Neither mock layer proves actual JWT/DB/browser rollback or concurrent credential activation. Post-acquisition old-token/password/JWT, actual persisted clone privacy, all terminal historical cases/report periods and source adapter fault/race UAT remain R5 runtime obligations. No assertion timeout was relaxed, permission check suppressed, or missing runtime result labeled PASS by this review.

Closure source snapshot (SHA256, read-only check exit 0):

| File | SHA256 |
|---|---|
| `backend/src/cases/cases.service.ts` | `31b075c7460ac50039c830c0089511ab1c637e739ea9fbc2704e3c1308a6bba6` |
| `backend/src/cases/governance/case-principal-access.service.ts` | `596c09d67764c94b5c5df13c90d2879c06e833815d995a73dbc0773d1bb69c91` |
| `backend/src/cases/evidence-governance/evidence-governance.service.ts` | `b79c28d674cf929a146e783e5ee71efeae52a5154e64a9f54aff62a5564b4963` |
| `backend/src/case-child-access/case-source-creation.service.ts` | `40052f577183a0dd0e7d6a94f01f110a51f48b4591edf9cfa6a865f7ffedafc4` |
| `backend/src/cases/cases.module.ts` | `5a789760b0bec0bce07cf26b05d4743a816017a2fe67588190412158ebefaeda` |

**Closure verdict: PASS for the bounded source repairs R1–R4.** Continue final source-bound affected validation and the unchanged R5 acceptance/recovery gates. This is not a human production GO.

## Authority, independence and method

Applied the project `AGENTS.md`, RTK instructions and `.agents/skills/sdlc-adversarial-review/SKILL.md`. Read BRD, FRD CG01–CG17, acceptance criteria, `docs/architecture/CASE_GOVERNANCE.md`, approved `docs/plans/PLAN.md`, tracked diff against the baseline, new governance/child/graph source, relevant regressions, prior scoped reviews and fresh evidence. The worktree does not contain its own AGENTS.md; the root project's instructions apply.

This reviewer did not implement the reviewed source. The first pass was read-only; only this report was written. No product/test/config edits, test reruns, database access, credentials, network, maintenance CLI execution, production access, messaging, index or commit operations occurred. Inspection concentrated on authorization, alternate adapters, transaction/replay boundaries, classification, byte disclosure, history and release evidence. Findings below are source-path proofs and required regression oracles, **not claimed executed reproductions**. This review does not independently authenticate the cited legal instruments or signed decisions.

Commands included RTK-prefixed `git status --short`, `git diff --stat 10030bed`, focused `git diff`, `rg` inventories/searches, read-only PowerShell source slices and Python JSON/SHA256 checks. The final evidence/hash checks exited 0. A few initial missing-file/glob/PowerShell-filter reads failed and were corrected by exact-path reads; no failed read was treated as verification.

## Findings

### CG-FINAL-R1 — MAJOR — Clone can downgrade a legacy restricted source

**Current status: CLOSED (source closure PASS above). Historical first-pass finding follows.**

**Requirements:** CG01/CG14/CG15; acceptance 1/8/9; frozen clone classification and dual-alias policy.

**Evidence:** `backend/src/cases/cases.service.ts:398` reads only `source.metadata.sensitivity`; its clone classification at 400–403 considers that label and dedicated `Case.sensitivity`. In contrast, `case-governance.service.ts:1033` treats both `metadata.sensitivity` and `metadata._sensitivity` as restrictive. `case-field-schema.service.ts:108` chooses caller-supplied metadata when present. The direct-create transaction at `cases.service.ts:2189` persists the returned classification and metadata. The clone regression in `foundation-integration.spec.ts:345` exercises dedicated RESTRICTED, not the legacy-alias-only case.

**Impact/reproduction:** An INTERNAL actor with Case creation rights, a writable destination and an exact source-only sensitive grant can read a source whose dedicated classification is NORMAL and metadata contains `_sensitivity: RESTRICTED`. Supply its current clone source/version and `metadata: {}`. The source read succeeds, the clone-specific denial is skipped, and the new Case receives dedicated NORMAL with the restrictive alias absent. Information copied through the official source-bound flow becomes readable outside the source's exact grant. The same downgrade is possible for a global sensitive reader; wider source visibility is not declassification authority.

**Acceptance condition:** Derive clone classification from the same authoritative dedicated/both-alias policy as point reads. Preserve restricted classification and pinned field policy independently of caller metadata; source-only grants must not authorize an unrestricted destination. Add RED regressions for `_sensitivity` alone, mixed NORMAL/RESTRICTED aliases, explicit empty/replacement metadata, and exact-source grants; retain valid unrestricted clones, stale-version rejection and unknown-label quarantine. Verify actual persistence and unrelated-reader denial.

### CG-FINAL-R2 — MAJOR — Preexisting technical credentials survive non-role business-authority acquisition

**Current status: CLOSED (source closure PASS above). Historical first-pass finding follows.**

**Requirements:** CG07/CG13/CG14; existing CG-RP01 account-authority finding and trusted provisioning boundary.

**Evidence:** `backend/src/cases/governance/case-principal-access.service.ts:131` updates only caseAccessMode/revision when changing a principal's authoritative access profile. `cases/evidence-governance/evidence-governance.service.ts:1420` validates and creates a representation grant but never invalidates the grantee's existing credentials or enrollment token. Admin role/capability acquisition correctly uses `businessCredentialInvalidation` (`admin.service.ts:456`, `:810`), demonstrating the intended protection, but these non-role acquisition paths do not call an equivalent safeguard. `auth/services/enrollment.service.ts:95` loads the *current* User and subsequently accepts its still-present enrollment hash with its freshly loaded role/version/updatedAt. `auth/strategies/jwt.strategy.ts:65` rejects old access tokens only when tokenVersion changes.

**Impact/reproduction:** A technical administrator legitimately generates enrollment/reset credentials while an account is ordinary INTERNAL with no protected Case rights. Later an authorized business manager changes it to REPRESENTATION_ONLY and gives it a Case-specific grant. The technical-issued enrollment token/password/session survives; consuming the old enrollment token *after* those changes loads fresh User versions and can establish a password/session for the newly protected principal. Guards correctly block a new technical reset after acquisition but do not neutralize the already-held credential. Role-promotion regressions do not cover this non-role path.

**Acceptance condition:** Establish the same transactional credential/trust boundary when principal-mode or scoped/representation acquisition gives an ordinary account new protected authority. Invalidate pre-acquisition enrollment/refresh/access credentials and known technical passwords where new trusted activation is required; preserve established trusted accounts, factors, legitimate revocations and no-op/replay behavior. Add actual post-acquisition old-token/password/JWT negatives, trusted activation positives, and acquisition-versus-enrollment concurrency/rollback tests. Cover the complete bounded non-role acquisition path rather than only role changes. Do not merely compare versions loaded after the acquisition.

### CG-FINAL-R3 — MAJOR — Legacy POST /cases source adapters bypass current source authority and governed creation protocol

**Current status: CLOSED for the source-adapter finding (source closure PASS above). Historical first-pass finding follows.**

**Requirements:** CG09/CG10/CG14; current source edit/creation authority, atomic lineage and content-bound replay.

**Evidence:** `backend/src/cases/cases.controller.ts` POST create requires Case.write only. `cases.service.ts:1799` and `:1956` implement FROM_PETITION/FROM_INCIDENT separately, using supplied dataScope predicates and their own transactions. They never check current Petition.edit/Incident.edit. The new `case-child-access/case-source-creation.service.ts:80` explicitly checks that permission, resolves current actor/profile/scope, and implements the durable source command protocol; the legacy Case route does not use it. Both legacy branches **do have source version CAS** (`cases.service.ts:1900`, `:2071`); that is not the defect. Incident creation audits are already in its transaction. Petition CASE_CREATED audit at `:1931` is after commit; ordinary direct creation also audits after commit at `:2224`. The alternate source paths do not create the new content-bound operation/event/internal-outbox protocol.

**Impact/reproduction:** A current actor with Case.write and a writable destination, but without the relevant source edit permission, calls POST /cases with FROM_PETITION or FROM_INCIDENT, source ID and valid source timestamp. This route can change the source's linked Case/status despite the dedicated conversion route denying that actor. Current source authority can also differ from supplied scope. On the Petition route an injected CASE_CREATED audit failure occurs after source/Case/counter/children have committed, returning failure without rolling back the business mutation; a retry is not the same durable replay.

**Acceptance condition:** Route all public Case-from-source adapters through the frozen current-source command boundary, or provide equivalent current source entity rights/profile/scope, source/target versions, content-bound namespace/replay and atomic audit/event/outbox in their transaction. Add negative controller/service tests for each missing source edit right and stale current scope, fault rollback including Petition audit, and exact retry/differing-content conflict; retain existing Incident/UTDT/source compatibility. Do not remove the existing valid source CAS or repeat the already-correct Incident audit fix.

### CG-FINAL-R4 — MAJOR — Creating a terminal historical Case invents its resolution date

**Current status: CLOSED (source closure PASS above). Historical first-pass finding follows.**

**Requirements:** BRD preservation of unknown/partial historical dates; CG04/CG05; acceptance 3 (missing dates never become now).

**Evidence:** `backend/src/cases/cases.service.ts:1541` accepts dto.status and constructs creation data. At `:1548` it calls `machMocGiaiQuyet('case', TIEP_NHAN, dto.status, null)` without a factual civil date. `common/trang-thai/trang-thai-ket-thuc.ts:137` defaults its fifth argument to `new Date()`, and `mocGiaiQuyetMoi` assigns that value on a nonterminal-to-terminal transition. Terminal states include DA_KET_LUAN, DA_LUU_TRU, DINH_CHI and DA_CHUYEN_DON_VI. This path is ordinary Case registration, not a reviewed legal execution with a real effective date.

**Impact/reproduction:** Register/clone a historical terminal-status Case without a verified resolution date. The database gains ngayGiaiQuyet equal to save time, and monthly/quarterly resolved-case statistics subsequently count it in the present period. Unknown legal/business history is transformed into an asserted current event. This inherited behavior conflicts with the approved preservation requirement even though it is preexisting code.

**Acceptance condition:** Ordinary registration must preserve an unknown resolution date as unknown; an actual committed legal transition uses the validated decision effective date. Add a regression for each relevant terminal registration/clone with missing or partial historical facts and reporting-period assertions, plus a real-date governed execution positive. Preserve approved statuses and legacy facts; do not infer a date from registration/createdAt.

### CG-FINAL-R5 — BLOCKER for milestone/release — Required acceptance and safe-recovery evidence is incomplete

**Current status: OPEN / BLOCKER.**

**Requirements:** CG17; acceptance 10; T5 and human production GO.

**Evidence/reasoning:** A read-only JSON count of `docs/uat/case-governance/uat-plan.json` yields **856 NOT_RUN / 0 executed cases**. Latest `private-db/runtime-smoke.json` explicitly identifies itself as technical smoke, not full UAT; its 11/11 HTTP checks do not exercise complete field/action/browser workflows. `private-db/restore-rehearsal.json` is a 2026-10-06 database-only component restoration with 131 migration rows, while final migration certification has 133. File restoration is likewise a component proof. `case-rollback-policy-gap.md` correctly requires a minimum safe authorization artifact and post-recovery restricted/field/representation/packet/hold negatives. There is no reviewed final application-recovery/flag-OFF artifact/hash and complete replay of those negatives in the evidence inspected. Full requirements-derived browser/JWT UAT, bounded monkey/performance evidence and a current complete patch-coverage/lint acceptance conclusion remain open.

Old source-bound coverage cannot be called current: read-only hash comparison found child manifest 36/45 matches (9 fixes/integration deltas) and core-finish manifest 51/60 matches. Those expected mismatches are not product defects; they mean the old >=90% reports do not certify all final executable changes. Whole-owned child lint remains documented as 460 legacy errors/1 warning, distinct from passing added-hunk lint. No invented >=90% branch gate is required.

**Impact:** The implementation cannot satisfy the agreed milestone completion or release contract. Rolling back to the pre-governance application can preserve tables yet lose sensitive-field/principal authorization; schema restoration alone does not prove safe application recovery.

**Acceptance condition:** Fix/review the source findings first, freeze current sources, then execute requirements-derived critical API/JWT/browser UAT with per-case outcomes and evidence (100% critical PASS, zero unresolved BLOCKER/MAJOR), bounded exploratory/monkey tests, recorded performance baseline/budgets, final additive DB/file/application restoration and safe flag-OFF/compatible-artifact authorization negatives. Reconcile final coverage hashes/deltas against the entire executable patch and explicit lint acceptance without exclusions/suppressions. Preserve default OFF until local/legal-publication gates pass. Production still requires a concrete human GO.

## Evidence accepted, strengths and limits

| Evidence | Observed result | Interpretation |
|---|---|---|
| `backend-frozen-final-green-20261007/backend-summary.json` | 2026-10-07 16:17 UTC; process/report exit 0; 7,254 PASS, 0 FAIL, 89 pending | Fresh full backend unit run; pending DB suites are not counted as passes |
| `frontend-frozen-final-green-20261007/frontend-summary.json` | 16:23 UTC; process/report exit 0; 4,473/4,473 PASS | Fresh full frontend run, including original regression closures |
| `child-final-affected.json` | 119 passing suites; 1,723 PASS, 0 FAIL, 16 pending | Fresh 2026-10-07 rerun, including 13 private DB tests; supersedes old 1,710 count |
| `graph-access-affected.json`, `graph-access-db.json` | 1,047 PASS/0 FAIL/7 pending; private DB 7/7 | Current graph affected/database evidence; totals overlap other corpora |
| `private-db/runtime-smoke.json` | 16:32 UTC; 11/11 PASS | Boot, basic auth/routes, restricted/active-actor negatives; technical smoke only |
| `private-db/migration-latest-certified.json` | 16:30 UTC PASS; 127 baseline + 6 additive migrations, immutable checksums, sentinel/unknown state retained | Additive migration/component compatibility proof; no production apply |
| T3/T4 current SHA checks | 43/43 T3 and 60/60 T4 match recorded manifests | Previously scoped source proofs remain tied to current source |
| Whole backend tsc and backend/frontend builds | Coordinator reports fresh 2026-10-07 exit 0 console/RTK results | Accepted as reported commands; this reviewer did not rerun them and no standalone final log artifact was supplied |

Current child source addresses the three prior findings: role-wide guard examines representation/live-granted principals and every affected writable target; Subject/Lawyer mutation responses use current serialization; child mutation scope derives authoritative transaction parent facts. Those source closures do not close the separate non-role credential-acquisition issue. Current serializable parent/CAS wrappers, exact request approval hashes, active-only relation uniqueness (migration establishes the replacement index before dropping old uniqueness), dual-alias readable guards, immutable receipt/original provenance, packet post-hydration reauthorization, hold preservation and internal outbox lease/dedup/current-recipient checks are substantial improvements. Previously adjudicated partial-pending-index, nullable-expiry and three-person-publication false positives were not reopened.

This first pass does not claim every entrypoint/UAT row, every native field or every export race was executed. Child/graph inventory triage and scoped passing tests are useful design/implementation evidence, not 100% runtime matrix acceptance. The 132-field/21-action inventories and full scope remain binding; no score or statutory certification is inferred from passing tests.

## Reviewed source snapshot

The following SHA256 values anchor the confirmed findings before fixes:

| File | SHA256 |
|---|---|
| `backend/src/cases/cases.service.ts` | `c25fbe0345794512ec0b65c85e812de74a8beb37016b3b3b5261d9c7d3ac4114` |
| `backend/src/cases/governance/case-principal-access.service.ts` | `436c45c79864380795a0108b034daa0d7d177c9e26732b3d8ba98993feee2fb3` |
| `backend/src/cases/evidence-governance/evidence-governance.service.ts` | `6aaca3d30f20076ecb1ae484396be623cfc10de6bbeeb08852a8c75d9cf90045` |
| `backend/src/auth/services/enrollment.service.ts` | `f0e198dc11ccc833b9d084cbdf1b0d69b3598f57a7fe13d8285a99b138525b38` |
| `backend/src/admin/case-authority.guard.ts` | `f9fd3353ed928260774e21e78d576bc8666a41138a56ba4d4c9fd086f48762d0` |
| `backend/src/common/trang-thai/trang-thai-ket-thuc.ts` | `58685fef399565ca9f81ad4512008cae9eb61ab0b0e1c2ff182680ec215023d2` |

**Required next step:** R1–R4 source repairs have passed independent closure; complete the remaining source-bound affected evidence and final T5 acceptance/recovery gates under CG-FINAL-R5. This report grants no production GO.

FAIL
