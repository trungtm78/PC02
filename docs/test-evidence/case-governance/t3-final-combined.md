# Combined scoped re-review handoff

Scope: independent T3-R1–R4 plus adjudicated core legal-R2 sensitivity aliases and legal-R4 relation uniqueness. The first FAIL remains visible; this is implementation evidence for independent re-review, not self-approval or release certification.

Before-source: `.superpowers/sdd/PLAN/t3-before` and `t1-confirmed-before`. Current **43 source/test/schema/migration SHA256s**: `t3-final-source.sha256.json`. Original T3 fixes and RED evidence remain in `t3-fix1.md`; its35-file hash is retained as an intermediate milestone, not the final source.

## Confirmed fixes

- Current Document list/count/search/detail/bytes share authoritative actor, Case and permitted alternate-parent scope. NORMAL unregistered INTERNAL legacy files remain accessible through current Document.read + Incident/Petition.read without invented Case.read/Gov.download; hidden Case identifiers/names and name-search membership are withheld. Published fully public pinned policy is eligible; restricted native/custom, export-denied, invalid publication and unknown classification exclude the fallback. Registered/protected/representation bytes retain their stronger authorization. Controller/private metadata and hidden-name-count REDs are GREEN.
- Disposition document receipts bind owning Case, exact Document version, SHA256/length and lineage, typed132 Restrict FK and server-owned snapshot. Previously unregistered receipts become immutable originals atomically. Ordinary update/reparent/delete and rollback refuse provenance; stale/tampered source negatives pass. Reference-only receipts explicitly have sourceSnapshot:null /EXTERNAL_REFERENCE_ONLY. RED1 source pin and RED3 mutation guards are GREEN.
- Malformed packet items/capability/disposition arrays return400 before preflight or operation writes. RED15→GREEN15 and actual private controller operation-count proof pass.
- Both metadata.sensitivity and metadata._sensitivity tighten point/query access; either unknown quarantines even an explicit sensitive reader, and neither NORMAL alias downgrades the other RESTRICTED alias. Scoped sensitive grants permit exact known restricted Cases. Controlled inspection retains explicit INTERNAL/read/edit/manage_access/read_sensitive/purpose/write-scope and pending guards, allowing authorized correction inspection without opening ordinary reads. Unit RED4/6→GREEN6, actual PostgreSQL point/list/count/Excel/inspection RED→GREEN. T3's alternate-parent eligibility checks both aliases too; its independent alias escape RED→GREEN is included.
- Additive133 creates active-only unique source/target/type coverage before dropping the old global index; all original/corrected rows and FKs remain. Active duplicates fail P2002; new links after revoke/deletion succeed; original relation payload, decision FK, decision facts/hash and reviewed request are retained. The persistence fixture does not certify a human legal signature or the fixture source's file health. Schema and realDB REDs are GREEN.133 checksum: `696c5179ba101b752641c5680ba608b53093ea2f28e7ea849062eb25c79387a6`, privately applied by root;128–132 unchanged. Prisma validate/generate exit0.
- Exported legacy maintenance functions are lazy and retain require.main guards. Tests inject MOCK Prisma/preservation/backfill/exit, run the real orchestration, and prove before-delete refusal, ignored force, sequencing, propagation and protected cleanup. No default CLI entry, normal.env, database, external process or real deletion runs. Cleanup-disconnect regression RED1→GREEN1. Controller verified-byte transport/module acyclic graph and upload failed-stream/rollback originals are tested.
- Readonly notification helper `CaseEvidenceGovernanceService.assertPacketNotificationRecipient(tx,packetId,actor)` verifies current exact approved recipient, expiry/revoke, download capability, both Case/item/profile/grant/link/field/source bindings and manifest hash; returns only identifiers/revision/approval hash, no bytes/full Case view. RED1→GREEN1 supplied to the notification owner. Source-adapter document-parent guard remains tested and supplied to the child owner.

## Final evidence and exact denominator

One combined affected corpus: **22 suites /427 PASS**, including **23 private DB tests** (11 evidence,12 foundation), exit0. Then bounded changed orchestration/controller/module/upload tests: **4 suites /21 PASS**, exit0. Notification helper addition: current evidence corpus **11 suites /226 PASS**, private11 PASS, exit0. These runs overlap; they are not three disjoint test totals. Credential-safe encoded PowerShell uses only coordinator-owned private127.0.0.1:55441/pc02_case_governance_uat; no credential/URL printing, .env, reset, production or real-record access.

Current coverage maps replace changed CLI/evidence maps and retain unchanged-source maps; constituent LCOV reports remain in `backend/src/coverage-t3-final`, `coverage-t3-seams`, `coverage-t3-evidence-current`. The merge method and summary JSON are retained. Across all collected sources: **1673/1834 lines=91.22%, 1735/1925 statements=90.12%, branches83.42%**. New evidence: **919/997 lines=92.17%, statements91.18%, branches86.93%**. No ≥90 branch claim.

Actual added executable statement-start lines from `git diff --unified=0 10030bed`, without exclusion of missed executable lines: **255/275=92.73%**. Exact JSON and reproducible method: `t3-final-patch-coverage.json` / `t3-final-patch-coverage-method.cjs`.

| Existing product file | Covered /changed executable lines |
|---|---:|
| Documents controller |8/8|
| Documents service |151/165|
| Documents module |2/2|
| XLSX commit service |18/20|
| Legacy migration service |33/35|
| Legacy seed maintenance |14/15|
| Legacy parity maintenance |29/30|

Unexecuted CLI patch lines are default entry calls, not hidden exclusions. Existing baseline legacy-service paths remain in whole-file coverage. Upload storage current lines100%/branches90%. Source SQL/index proof is from schema regression and actual DB constraints, not a fabricated Istanbul SQL percentage.

Owned lint passes: evidence/core alias/foundation/schema-test/Document paths and isolated maintenance/controller/module/upload tests (exit0). Latest whole backend build is **not certified**: exit1 from concurrent other-owner delegation/proposal trailing-call and graph-access inferred-shape errors; these were routed to their owners. No owned error was emitted. Earlier T3 fixed-scope build passed before those concurrent changes. Root owns final whole-branch type/build/full-suite gate.

No commits. Exclude generated coverage directories from source staging; stage43-source manifest plus evidence artifacts deliberately. Retained own private file recovery leaves add legacy-normal.bin/disposition-target.bin/disposition-receipt.bin under pc02-evidence-db-*; tamper is restored in finally. Relation-history persistence fixture's unregistered synthetic source reference is explicitly not a healthy-file/recovery claim. UAT/performance/full integration and independent scoped re-review remain root-owned.
