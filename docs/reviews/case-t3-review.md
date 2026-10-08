# T3 first independent read-only review — 2026-10-06

SPEC_COMPLIANCE: FAIL
CODE_QUALITY: FAIL
VERDICT: FAIL
GATE_TASK: FAIL — CG14 ordinary Document enumeration and existing two-parent compatibility are incomplete; disposition receipt provenance is incomplete.
GATE_SOURCE: FAIL — confirmed malformed nested input bypasses boundary validation; affected legacy gate exercises actorless service calls.
GATE_SECURITY: FAIL — unrestricted unregistered-Document alternative bypasses current Case visibility.
GATE_DESIGN: FAIL — CG-R03 and preservation/source-snapshot boundaries need the corrections below.
CROSS_MODEL: unavailable — this is a separate independent Codex task reviewer, not an asserted different-model review; any required whole-branch cross-model gate remains with the coordinator.
DOC_DEBT: (none)

## Scope and evidence

Reviewed against FRD CG11–CG14, acceptance criteria 7–8, approved architecture and frozen CG-R02/CG-R03/R05 interfaces, and approved PLAN T3. The source of the review is `.superpowers/sdd/PLAN/t3-review-20261006.md`, baseline `10030bed`, with adjacent `.sha256.json`. All 32 owned file hashes matched the manifest at review time (0 mismatches). Source is uncommitted; the report does not certify a different later revision.

The implementation evidence records 190 PASS in 9 evidence/private suites, including 8 real private PostgreSQL cases; 145 PASS in 8 affected Document/rollback suites; types, owned lint and build exit 0. Reported coverage is 91.83% lines, 91.13% statements, 86.65% branches, 100% functions. No 90% branch or complete release-coverage claim is made. These are implementer-provided fresh runs, reviewed against the frozen source and tests; the reviewer did not repeat broad suites or access credentials/databases.

Three focused in-memory probes used `rtk proxy powershell -NoProfile -EncodedCommand <script>`, piping a script to `node -r ts-node/register/transpile-only -` from backend. Exit 0, no database, files, network, or application writes. The probes imported frozen source, constructed minimal current-policy doubles, and exercised the concrete doubts below. Results: P1 `{"caseAssetVersion_document":{"none":{}}}` as the unrestricted first OR; P2 authenticated two-parent detail `ForbiddenException:403`; P3 null packet item `TypeError:status=undefined`. These are narrow source-behavior reproductions, not UAT or full authorization-matrix evidence.

Source/index/HEAD/branch, `.env`, normal DB and real dossiers were not changed or accessed. Only this explicitly requested review artifact was written. Other active writers' files were outside this task review.

## Findings

### T3-R1 — BLOCKER — ordinary list/count/search exposes unregistered Documents from unreadable Cases

Evidence: `backend/src/cases/evidence-governance/evidence-governance.service.ts:2547` defines unregistered as only `caseAssetVersion_document.none`; line 2575 inserts that alternative directly for INTERNAL users, omitting the computed current `readableCaseWhere`. `backend/src/documents/documents.service.ts:129` consumes it. Lines 146–162 then use the supplied legacy scope filter, and lines 182–207 select Document description, Case ID/name and other metadata and count using the same permissive predicate. The HTTP route supplies a Document-derived request scope; it does not repair the missing current Case predicate.

Effect: an active INTERNAL principal with Document.read and legacy team/global scope can enumerate/search/count an unregistered attachment owned by a RESTRICTED Case that current Case access denies, or one outside current Case authority after role/scope change. No registered asset is required to leak Document/Case identifiers and metadata. The test at `evidence-governance.service.spec.ts:596` endorses the permissive unregistered branch rather than proving restriction.

Reproduction: create a synthetic same-team RESTRICTED Case and an ordinary unregistered Document, then query `/documents` as a non-sensitive INTERNAL actor with Document.read. The unregistered OR passes even if `readableCaseWhere` excludes that Case. P1 independently confirmed the predicate ignores an intentionally restrictive current readable set.

Acceptance condition: apply authoritative current actor/Case scope, sensitivity and field-policy predicates to every Case-owned Document alternative before pagination/search/count/serialization. Preserve legitimate Incident/Petition access through an explicit safe compatibility rule; that path must not expose hidden Case IDs/names/fields. Add real service/private DB list/count/search negatives for unregistered restricted attachments and stale supplied scope, plus legacy non-Case positives. Both list and count must deny the same rows.

### T3-R2 — MAJOR — authenticated two-parent legacy files regress despite the green legacy gate

Evidence: `backend/src/documents/documents.service.ts:287` now unconditionally requires `assertCaseReadable` for every unregistered Case-linked record when actorId is supplied, before the existing one-readable-parent logic. `backend/src/cases/evidence-governance/evidence-governance.service.ts:175` similarly requires owning Case download authority; `backend/src/documents/documents.service.ts:911` invokes it, and line 928 skips the legacy `getById` parent check whenever caseId exists. Controller `documents.controller.ts:68` now always supplies actor identity. The two-parent positive at `tep-hai-cha-tai-duoc.gate.spec.ts:60` still calls `getById` without actor identity, skipping the new branch completely.

Effect: a legitimate staff user who can read the Petition parent of an ordinary migrated file but cannot read its NORMAL Case parent can see that file in the legacy OR list yet receives 403 on detail/download. Existing Incident/Petition compatibility and the documented “seen means downloadable” two-parent behavior are lost. The 145 PASS result does not detect this because its compatibility oracle uses the actorless path.

Reproduction: ordinary unregistered Document with allowed Petition + hidden NORMAL Case; authenticated actor has allowed Petition scope. P2 constructed this exact shape and confirmed 403 from the new Case check before the legacy OR could authorize the Petition.

Acceptance condition: preserve authorized NORMAL legacy dual-parent detail/download via the same predicate as list, while still denying registered evidence/representation-only/protected bytes and withholding hidden Case metadata. Add actor-aware positive and negative tests using actual current policy, including the HTTP/controller path, and a verified-byte download positive. Coordinate this with T3-R1 so compatibility does not become a confidentiality bypass.

### T3-R3 — MAJOR — disposition receipt Document is mutable and can disappear after execution

Evidence: `backend/src/cases/evidence-governance/evidence-governance.service.ts:2194` only checks that optional receipt.documentId currently exists under the Case. Line 2217 stores caller receipt JSON without Document version/hash/byte snapshot or a typed source link. By contrast custody pins and preserves source bytes at lines 1012–1041. Ordinary Document mutation checks at `backend/src/documents/documents.service.ts:592` and deletion at line 757 protect decision/custody sources and registered assets, with no disposition receipt check. The shared schema `backend/prisma/schema.prisma:3829` stores receipt only as JSON, without a protecting Document relation.

Effect: an approved executed disposition can retain a receipt ID while the source Document is subsequently edited, detached or soft-deleted. The recorded retirement no longer identifies the exact receipt originally supporting execution. Retired asset originals are retained correctly, but receipt provenance is weaker than the preserved execution history implies.

Reproduction: execute approved disposition using an unregistered same-Case receipt Document and no active hold; then call ordinary Document.update/reparent/delete on that receipt. Existing registration/decision/custody guards do not match it, so the source can change or disappear. This finding follows the complete source path; no database mutation was attempted.

Acceptance condition: when a receipt Document is supplied, resolve an authorized exact source snapshot (owning Case, Document version, SHA256/length and applicable asset lineage), persist server-owned provenance and preserve the referenced source across ordinary mutation/deletion and rollback. Add execute→ordinary-update/delete/reparent regression cases and changed/tampered-receipt negatives. Keep reference-only receipts only if explicitly supported by the approved business contract; do not silently treat an arbitrary JSON ID as immutable provenance. Schema changes, if needed, remain the coordinator/core writer's responsibility.

### T3-R4 — MINOR — malformed nested arrays generate internal errors instead of validated 400s

Evidence: `backend/src/cases/evidence-governance/evidence-governance.service.ts:333` dereferences each item before validating its shape, and line 1493 repeats that dereference. Line 1399 calls `.some` on capabilities without `Array.isArray`. Disposition creation at line 1458 similarly trusts the iterable collection shape. The controller uses a TypeScript interface body, not runtime nested DTO validation.

Effect/reproduction: `POST .../packets` with otherwise valid command fields and `items:[null]` raises TypeError; P3 confirmed the exception has no HTTP status and therefore becomes an internal-error response. JSON `capabilities:"download"` and non-array disposition collections have analogous unvalidated branches. No invalid command committed in the probe.

Acceptance condition: validate arrays and plain-object item shapes, string IDs/capabilities and collection bounds before property access, preflight, query or mutation. Add focused malformed item/null/non-array tests expecting 400 and no database write. Keep canonical JSON rejection and existing valid payload behavior.

## Verified strengths and requirement coverage

| Requirement/boundary | Source and test evidence | Assessment |
|---|---|---|
| Immutable originals, streamed SHA256, safe opened descriptor, exact derivative lineage | `evidence-file-integrity.ts:14`, `:42`, `:48`, `:52`; service `:808`; lifecycle package lines 5825, 6082, 6117, 6236; exclusive upload storage `document-immutable-storage.ts:30` | Good local implementation: safe leaf names, symlink/path rejection, regular-file/inode and hash/length checks; original Document mutation blocked. |
| Exact packet revision/hash/recipient, maker/checker, revocation and hydration | service `:1096`, `:1207`, `:1761`; private test package lines 6635, 6674, 6815 | Explicit current capability and recipient policy checks, independent review, immutable approved packets/deltas, final pre-return validation and byte verifier. |
| Current profile mode and protected native-field bytes | service `:485`, `:698`, `:755`; private test package lines 6865–7083 | INTERNAL/REPRESENTATION_ONLY separate; byte policy and server-owned sensitive-review event pin hash/schema lineage. Real private tests distinguish secret original from independently reviewed public bytes. |
| Holds protect destruction while permitting authorized read | `case-preservation.ts:36`; service `:2087`; private test package line 6690; Document regression package line 9103 | No invented disclosure embargo; held export positive and disposal/force negatives exist. |
| Typed physical custody, actual holders and append corrections | service `:915`, `:967`, `:1012`; `custody-facts.ts:56`; private test package line 7084 | Actual holder/location/condition/source receipt, unknown prior holder, explicit chain-head CAS and append correction retain history. |
| Retention/review/publication/disposition/original preservation | service `:1929`, `:2050`; lifecycle package line 5971 | Eligibility preserves until reviewed policy; approved retirement keeps original bytes. Receipt source exception is T3-R3. |
| Related ownership and both scopes | service `:408`, `:1207`, `:2400`; private test package line 7227 | Typed active direct relation, owner/grant/version pinning, hidden owner omission and post-hydration check. |
| Force import/legacy/CLI preservation | `xlsx-imports/commit.service.ts:581`, `legacy-migration.service.ts:689`, CLI seed `:82`, parity `:73`/`:139` | Explicit preservation guard runs in transaction before destructive mutations; CLIs were not executed. |
| Offline trusted-manifest verifier | `disclosure-manifest.ts:42`, `:49`, `:71`; package lines 512–563 | Independently supplied trusted approval hash required; exact bytes/hash/length/duplicate checks; no signature-authenticity or recall claim. |

Tests include actual temporary files and eight real PostgreSQL workflows, not only delegation doubles. Mock unit tests are useful for malformed versions and injected denial paths but cannot certify cross-task role/scope integration. Private fixtures grant broad explicit capabilities to their synthetic role; this is test setup, not proof of every business role or production seed privilege. The opt-in private suite's `describe.skip` is intentional environment isolation; this report does not misclassify that guard as weakened product testing.

## Cannot verify from this T3 diff / remaining cross-gates

- Roles/account management, permission seeding and blanket ADMIN exclusion, authoritative current role/DataScope and user-mode changes are owned by the separate core/auth task. T3 consumes those helpers; complete role×scope×sensitivity matrix and actual published/seeded privilege inventories remain required. This report does not approve their source.
- Ordinary child Evidence/Lawyer/Subject APIs, pending guard and destructive parent/child paths beyond the owned rollback/Document changes are owned by separate tasks. Confirm their preservation and denial behavior at the cross-task gate; absence from T3 diff is not a silent PASS.
- Core replay was checked once for the concrete cached-response contract risk: `case-governance.service.ts:1285` and `:1378` reauthorize current Case and serialize cached results; T3 packet preflight at `evidence-governance.service.ts:329` rechecks current owner relations before invoking it. Current policy serialization, role removal, flag-OFF historical replay and all operation namespaces still require core review/integration proof. No T3 cached-result byte export exists (export is a fresh read).
- The receipt-schema inspection above was a single focused outside-diff check for T3-R3; the core helper reads were focused checks for replay/serialization. The partial getList hunk required reading that function's omitted unchanged middle to assess T3-R1. No broad repository crawl or whole-branch review was performed.
- Frontend routes, presentation of capabilities, real user review of public/redacted bytes, existing Word/Excel exports, and critical UAT/performance/recovery requirements belong to T4/T5 and remain unverified here.
- No additional real concurrent DB race test was run. The frozen private T3 suite is sequential and its stale-head/mid-hydration checks should not be represented as complete concurrent hold/disposition/rollback/source-update proof. Shared serializable parent CAS and preservation lock design were inspected; targeted real concurrent cross-task negatives remain a release-gate obligation.

No fixes were applied. The first independent gate remains FAIL until T3-R1–R3 are resolved and the concrete regressions above pass with fresh source/evidence; T3-R4 should be closed in the same bounded fix round.
