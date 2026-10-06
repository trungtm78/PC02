# Isolated Incident release patch — independent first pass

Date: 06/10/2026. Baseline: `1b09ff08d6772ef2edce54d79f50509755c2ef11` (reported live 0.72.1.2). Reviewed actual tracked diff and new task files in `.worktrees/incident-release-20261006`, not the unrelated dirty root workspace.

**FIRST-PASS CODE VERDICT: FAIL — 1 MAJOR finding. CLOSURE CODE VERDICT: PASS — PR-01 closed by the re-review below.** Deployment is explicitly authorized by the user after corrections; this review does not repeat that authorization question. Fresh release quality gates still apply. No product source, DB, fixture, production environment, or authentication was mutated by the reviewer. This report is the only reviewer write.

## PR-01 — MAJOR: bulk mutations trust stale preflight eligibility after handoff/terminal transitions

Evidence (paths relative to the isolated release worktree):

- `backend/src/incidents/bulk/incidents.bulk.service.ts:107`–140 fetches assignment eligibility/scope once, selecting only ID/status/stage. Per-item update at lines 145–154 checks ID and stage in null/DA_NHAN, adding a version only if an optional map was supplied; it does not bind server-observed version/status/ownership/deletion. The bulk controller at lines 40–51 does not supply that optional timestamp map.
- The delete preflight at `backend/src/incidents/bulk/incidents.bulk.service.ts:374`–423 checks scope, TIEP_NHAN, not-pending, and empty related collections. Per-item update at lines 427–440 checks ID, not-deleted and not-pending stage only, with no source version/status/ownership check.
- Handoff acceptance changes team/assignee and returns the record to DA_NHAN (`backend/src/incidents/incidents-handoff.service.ts:232`–243). Thus a not-pending predicate alone cannot detect a full send→accept cycle after preflight.

Impact/reproduction reasoning:

1. Pause bulk delete after it accepts a writable TIEP_NHAN dossier assigned to A. Send and accept the dossier into B, preserving legal status. Resume item execution: DA_NHAN satisfies the current predicate, and actor A deletes the now-transferred dossier even when it is outside A's write scope.
2. Pause bulk assign after eligible preflight; another operation prosecutes the dossier or otherwise makes it terminal. Resume: stage still DA_NHAN and there is no status/version predicate, so assignment can change status back to DANG_XAC_MINH while retaining the prosecution Case link.
3. A pause through a complete handoff send/accept likewise permits stale bulk assignment after receipt. Dispatchers may intentionally have global assignment authority, so that example is primarily a stale-workflow/ownership conflict; the delete case is the direct scope violation. Do not conflate dispatcher assignment scope with ordinary write scope.

Acceptance: bind every per-item mutation to the server preflight snapshot (fallback updatedAt, stage, status, assigned team/assignee, deletedAt and required relationship eligibility), or lock/re-read/revalidate eligibility and scope inside each item transaction. Preserve current per-item failure classification and atomic item audit. Add controlled real-DB races for bulk assign/delete after send→accept, terminal/prosecution transitions, and related-document changes. Rejected items must remain unchanged, classify as concurrent/ineligible/permission according to the existing bulk contract, and create no successful item audit. Existing initial-pending rejection tests are necessary but do not cover these races.

## Compatibility constraints assessed

- PC-01: the release keeps idempotency key as fifth create argument and adds intake options sixth. Intake forwards the header. Mode enters the canonical request hash, so normal/intake key reuse conflicts. Live duplicate-review and reporter-suggestion behavior is retained.
- PC-02: the live result-update endpoint remains, now uses the checked snapshot predicate and shared pending write guard while retaining transactional result audit and client-version behavior. PHAN_LOAI text editing remains consistent with general editing.
- PC-03: live merge retains sorted FOR UPDATE locks, in-transaction re-read, source/target scope and graph/terminal checks, relinking, history and atomic audit; new readiness checks run inside the transaction. Transfer preserves live original-source data rather than overwriting chuyenTuDonVi.
- PC-04: deployed A2 shadow schema/search are preserved; the isolated release adds the handoff migration rather than duplicating the old A2 migration. The additive migration retains unknown stages as NULL, partial one-pending uniqueness, self-link guard and flag OFF default. Reported rehearsal uses production schema-only plus migration checksum metadata; no legal dossiers were copied.
- Both prosecution entry paths retain CASE number allocation/reservation flow, source mapping/snapshot, guarded two-sided links, Incident final result/history, and transactional audit. Frontend preserves the live read-only form/detail routes, result/merge actions and creation retry header while adding intake views/inbox and dedicated business handlers.

## Fresh reviewer verification and limitations

Independently ran in the isolated backend: `rtk npm test -- --runInBand --runTestsByPath src/incidents/incidents-release-compatibility.spec.ts src/incidents/bulk/incidents.bulk.service.spec.ts src/cases/cases-incident-prosecution.spec.ts` — exit 0, 3 suites / 28 tests PASS. Those suites do not expose PR-01; green counts do not close the race finding.

Root reports separate isolated DB 13 PASS, HTTP 10/10 and amendment 7/7 PASS, with full backend/frontend reruns, final coverage and UI verification still being collected. This reviewer did not run mutating UAT/DB scripts or production checks. Prior older-root results are not release-branch evidence. Root should report PR-01 before corrections, add regression-first fixes within the approved guards, and obtain read-only closure review plus fresh complete release gates. Legacy link/history backfill remains excluded. **Release is not ready while PR-01 or required verification remains unresolved.**

## PR-01 re-review checkpoint

Root reported the finding before corrections. The server-snapshot additions now bind bulk assignment/deletion to the checked version, stage, status, team, assignee and deletion state. These changes close the reported full-handoff and prosecution/status races without requiring client timestamps. Missing snapshots fail as concurrency conflicts and item audit remains after confirmed mutation. Reported controlled DB send→accept races and unit tests support those closures.

**One PR-01 acceptance point remains open: related-record changes after delete preflight.** Delete preflight still checks petitions/documents only when reading the snapshot. The updated delete predicate (`backend/src/incidents/bulk/incidents.bulk.service.ts:441`–458) has no relation-none conditions. `backend/src/documents/documents.service.ts` contains no parent Incident update during upload, so creating an attachment need not change the checked Incident version. A new attachment after preflight can leave all snapshot predicates matching, permitting deletion despite the existing no-attachments eligibility rule. This was included in the first-pass acceptance conditions and is not closed by the handoff race tests.

Acceptance: add per-item transaction eligibility protection for active related documents/petitions and a controlled relation-creation race with unchanged parent version. The rejected deletion must preserve the dossier and new relation and create no successful deletion item audit. If a stronger existing DB-level parent-version/locking mechanism is claimed instead, supply its actual evidence and test it rather than relying on parent snapshot fields alone. Code verdict remains FAIL until this point is assessed and closed.

The A1 canonical ownership fix now unions actual layout-owned columns with `LEGACY_FIELD_TO_COLUMN` values (`frontend/src/features/cases/legacy-form-layout.def.ts:466`–469). This closes the live alias ownership gap within approved A1; no new finding identified in that small fix. Actual payload/save/reload UAT evidence is reported separately by root and does not waive other gates.

## Final PR-01 closure — 06/10/2026

**PR-01 CLOSED / CODE PASS.** Bulk deletion now includes `documents: { none: { deletedAt: null } }` and `petitions: { none: { deletedAt: null } }` in the per-item guarded update (`backend/src/incidents/bulk/incidents.bulk.service.ts:461`–462), retaining all server-snapshot stage/status/version/team/assignee/deletion predicates. Eligibility failure occurs before the successful item audit.

Reviewed the new unit regression and real DB oracle (`backend/src/incidents/incidents-handoff.integration.spec.ts:684`–737): a document is created after the checked preflight rows are read, without changing the Incident version; the bulk operation must reject deletion, retain the dossier/version/new document and produce no INCIDENT_DELETED audit. Root separately reports 16/16 guarded DB integration PASS; reviewer did not execute that mutating integration suite.

Fresh independent reviewer command in the isolated backend: `rtk npm test -- --runInBand --runTestsByPath src/incidents/bulk/incidents.bulk-race.spec.ts src/incidents/bulk/incidents.bulk.service.spec.ts` — exit 0, 2 suites / 21 tests PASS (four race regressions plus the retained 17 baseline cases). No tests were removed to close the finding. The source checks and these fresh regressions support the recorded handoff/status/ownership and relation acceptance conditions. No new BLOCKER/MAJOR found in the reviewed corrections.

Final full release suites, coverage, builds/lint and PR/CI/artifact verification were still being collected at closure time. **CODE PASS is not a complete release-quality PASS or evidence that production has changed.** The user has authorized deployment after corrections; root may continue that authorized workflow once its required final release gates pass. No actual legacy backfill is included.

## Release evidence continuation — coverage and original parity distinction

Read-only inspection of `scripts/incident-release-patch-coverage.cjs` found no new material oracle defect. It enumerates the actual isolated-worktree delta/new source files against live `1b09ff08`, excludes tests/generated artifacts, and uses the previously corrected full statement/function/branch-span helper. Missing coverage, null/zero denominator or a sub-90 percentage fails the report and process. Matching the preserved single-quote style of IncidentListPageShell during baseline normalization excludes formatting-only deltas; it does not alter product behavior or test assertions. The script was inspected, not executed, because it writes coverage artifacts. Final fresh artifacts still need to be matched to the stable release source and complete test run.

**Terminology correction: 132 is a count of UAT screen/function rows, not editable fields.** `docs/uat/four-record-parity/UAT-COVERAGE.md:140` defines 132 rows as four entities × 30 rows plus 12 cross-screen rows. The approved parity specification (`docs/superpowers/specs/2026-09-28-four-record-parity.md:10`–11, 26–28) separately requires complete copied/reset field matrices and create/edit/reload/clone behavior. The current form UAT samples ten representative fields across ten tabs, with upload retry and a positive-link clone reset. Its 3/3 result proves that subset, not every editable field or all 132 original screen/function rows.

Unchanged live layout narrows implementation scope and should be evidenced by an explicit live-to-release field/layout/payload/storage inventory comparison. Existing all-field source/typed-contract gates and hashes are valid regression evidence, but must be labeled separately from real persisted-value UAT. An unchanged input can still lose data through a changed service, new create mode, canonical ownership, clone reset, or payload route.

Outstanding original-parity evidence, if complete original parity is to be certified:

- Inventory every approved editable field and its storage destination, indicating copied/preserved versus reset values; identify exactly which entries are unchanged from live and which are affected by this release.
- Establish field-preserving create/edit/reload/clone roundtrips for that inventory with synthetic values, including typed dates/arrays/nulls and nested metadata, and explicit identity/code/source/history/attachment resets. Include changed intake endpoint/idempotency behavior and source-to-Case mapped/snapshotted fields.
- Retain the broader original acceptance ledger for scoped duplicate review/suggestions, URL/filter/chip/export parity, export hydration scope, permissions, code-preview races and batch Word/upload failures. Existing passing regression tests may be cited as inherited evidence; do not silently relabel an unrun original critical UAT entry PASS.
- Test the changed A1 Case ownership/alias proposal roundtrip directly and retain negative controls for new legal-state/handler decisions, received-stage guards and read-only routes. These release-specific cases can pass independently of unfinished original whole-four-entity parity.

Required release gate claims should therefore name their scope: CODE PASS / fresh clean-release tests / isolated schema-migration and DB/API/browser UAT / executable release-diff coverage, with any unproved original parity ledger and real legacy reconciliation expressly outstanding. No new product finding or repeated production GO request is introduced by this evidence clarification.

Concrete ledger checkpoint: original `UAT-COVERAGE.md` still marks Incident I-F01–I-F15 and I-L01–I-L15 CHƯA CHẠY. Fresh release form, role, history/filter, prosecution/Word and DB evidence may be attached to the corresponding cases, but not mechanically convert complete rows when only representative subcases ran. The original Case and cross-screen rows also need their named evidence/impact assessment. Preserved live UI and inherited passing evidence can be identified explicitly; they do not make an unrun row executed. Do not demand 132-field mutations on the basis of the 132-row count, and do not claim the entire older four-entity milestone complete from the Incident release subset.

## Certified scoped-release evidence audit

**SCOPED CODE / REVIEWED EVIDENCE PASS.** No new material finding in the combined coverage calculation or synthetic-fixture correction. This conclusion concerns the isolated Incident release diff, with actual legacy backfill and certification of the complete older four-entity parity milestone excluded; it does not retroactively mark unrun original ledger rows PASS.

The coverage calculator now uses `istanbul-lib-coverage.createCoverageMap().merge()` for full and additional targeted artifacts before applying the unchanged conservative full-span oracle. Reviewer independently compared the overlapping statement/function/branch maps: one shared backend file and one shared frontend file, **zero geometry mismatches**. This supports combining execution counts on the same instrumented product source. No threshold was lowered and the unchanged denominator remains 1,380. Independently summed report rows: **1,254/1,380 = 90.8695652173913%, missing []**, matching `release-patch-coverage.json`. Missing coverage and sub-90 results still fail closed. Source stability remains tied to root's release manifest; the reviewer did not execute coverage-generation scripts.

Inspected current certified full-run JSON summaries: `backend-release-certified.json` reports **6,267 passed, 0 failed, 16 pending, success true**; `frontend-release-certified.json` reports **4,021 passed, 0 failed, 0 pending, success true**. Pending backend cases are the separately enabled DB suite; root reports its **16/16 PASS** on the isolated production-schema mirror. The older `*-release-final.json` summaries contain earlier counts and must not replace these certified artifacts in final claims.

The repeated-UAT fixture now assigns independent per-run/record descriptions, source identifiers and locations while keeping the same legal/status/persistence assertions. Avoiding an unintended high-confidence duplicate is valid setup for these independent workflow scenarios, not removal of duplicate-review coverage. Actual duplicate behavior remains part of the retained live implementation and its own assertions. Root separately reports refreshed original HTTP 10/10, amendment HTTP 7/7, form 3/3 and browser/Word 3/3 PASS; those mutations were not run by this reviewer.

The release is review-ready for the explicitly authorized scoped feature once the root's final source-manifest, builds/lint/schema checks and PR/CI requirements are attached to the same artifact. Existing legacy records remain unchanged and the handoff flag defaults OFF; staged rollout and pending completion safeguards must be retained. Production deployment and post-deploy health/rollback verification are actions for root under the user's existing GO, not actions performed or certified by this read-only reviewer.
