# T2 independent read-only review

Spec compliance: **FAIL**. Task quality: **FAIL**. First review of frozen package `.superpowers/sdd/PLAN/t2-review-2026-10-06T06-09-27-775Z.md`, baseline `10030bed`, on 2026-10-06. No source, index, branch, or test changes were made. Findings precede fixes.

Authority: task-T2-brief; BRD preservation/provenance; FRD CG01/CG15; acceptance criteria 1/9; architecture CASE_GOVERNANCE.md:19,41,45. These are task verdicts, not milestone/UAT/release certification.

## Verified strengths

- Frozen inventory contains 132 unique rows, 181 placements, ten tabs. The generated backend registry contains 132 entries; `case-canonical-fields.spec.ts:55` checks every inventory column/kind/type/label. `canonical-inventory.test.ts:20` checks frontend mapping and typed create/edit/read/clone/clear behavior against that external inventory.
- Canonical false/zero precedence, alias removal, durable clear markers, and unknown sibling preservation have useful behavioral tests: backend `case-canonical-fields.spec.ts:28,108,137`; frontend `canonical-fields.test.ts:9,19,36` and `nullable-boolean.test.ts:16`.
- `CaseInformationTabs.tsx:23` uses the existing layouts and shared renderer, with visible read-only unverified/clear annotations at lines 19–20. `CaseInformationTabs.test.tsx:19` exercises all ten layouts and their placements. `CaseDetailPage.tsx:1948` retains the existing specialized tab navigation and renders the original information/defendant/lawyer/timeline/conclusion/journey panels alongside the new information view.
- `CaseFormPage/index.tsx:437` normalizes after the parity merge; `custom-field-persistence.test.tsx:23` verifies the real form's PUT metadata and optimistic-lock token through mocked transport. `useCaseFieldSchema.ts:6,18` binds results to the endpoint and immediately hides another case's schema during navigation.

## Task-owned findings

### T2-R1 — MAJOR — Published select transport and renderer disagree

Evidence: `frontend/src/features/cases/CaseCustomFields.tsx:5,33` requires `{value,label}[]`. The actual server definition requires string options (`backend/src/cases/governance/configuration.validation.ts:146`), and its endpoint returns those fields unchanged (`case-field-schema.service.ts:221`). Existing component fixtures use the incompatible object representation (`CaseCustomFields.test.tsx:12`); the form persistence fixture tests only text.

Effect/reproduction: render a valid published `custom_choice` definition with `options:['yes','no']` and value `'yes'`. A read-only frozen-component SSR probe emitted `<option></option><option></option>` and a React missing-key warning. Neither choice is usable as its declared server value. This is a T2 client defect, not an unverified downstream requirement.

Closure: align with the actual frozen HTTP contract, or coordinate one consistent contract without reducing functionality. Add a transport-compatible published-select interaction/persistence regression proving both options have correct values/captions, false/zero/null remain typed, and server validation accepts the selected value. No blank options or new key warnings.

### T2-R2 — MAJOR — Existing detail summary still contradicts canonical information

Evidence: `frontend/src/pages/cases/CaseDetailPage.tsx:1285` calls `canonical('soLuongBiHai')`, while ownership is `statistic.soLuongBiHai` (`legacy-form-layout.def.ts:1349`). Line 1221 uses `canonicalValue('supervisingUnit') || caseData?.unit`, despite `supervisingUnit` owning `donViGiaiQuyet`; `unit` is a different receiving-unit concept (`legacy-form-layout.def.ts:1538`).

Effect/reproduction: a frozen-accessor probe with `{statistic:{soLuongBiHai:4},metadata:{soLuongBiHai:'stale 9'}}` returns stale 9 for the summary call and canonical 4 for the inventory key. With `{donViGiaiQuyet:null,unit:'other receiving unit',metadata:{_canonicalClears:{donViGiaiQuyet:true}}}`, the accessor returns cleared/null, but the summary displays the other unit. A user sees contradictory detail values, including a value after an explicit canonical clear.

Closure: use the registered nested victim-count key and respect clear provenance in the summary. Distinct unit concepts must have distinct labels/ownership. Add actual CaseDetail regressions for canonical count vs stale metadata and a cleared resolving unit; both summary and ten-tab view must agree.

### T2-R3 — MAJOR — Editable fallback loses unverified provenance

Evidence: `frontend/src/features/cases/canonical-fields.ts:102` hydrates a `legacy-unverified` result into plain form values and retains no per-field provenance. `CaseFormPage/LegacyTabBody.tsx:51,69` annotates only uncertain dates; ordinary legacy text/number/select/flag fallbacks get no unverified source annotation. The form's save at `CaseFormPage/index.tsx:437` writes those hydrated values as canonical fields. Read-only annotations at `CaseInformationTabs.tsx:19` therefore disappear after an unrelated save.

Effect/reasoning: `{moTaChiTiet:null,metadata:{description:'legacy statement'}}` initially reads as unverified, but the editable description presents it as an ordinary current value. Saving another field promotes the untouched statement into `moTaChiTiet`, after which the accessor labels it canonical. The required visible provenance/verification distinction is lost without an explicit officer decision.

Closure: retain enough source/provenance state to label editable fallback values and avoid silently upgrading their verification through unrelated saves. Test an ordinary fallback field in the actual editable layout, then an unrelated save/reopen, explicit correction, and clear. Dates and nullable flags must retain their current working behavior.

### T2-R4 — MAJOR — Optional custom Boolean cannot distinguish or restore unknown

Evidence: `frontend/src/features/cases/CaseCustomFields.tsx:29` renders null/missing and false as the same unchecked checkbox and writes only true/false. The server explicitly permits null for optional custom fields (`configuration.validation.ts:170`). By comparison, the native nullable control implements mixed state and reset (`CaseNullableBooleanField.tsx:8`).

Effect/reproduction: the same frozen-component SSR probe with optional `custom_flag:null` emits an ordinary unchecked checkbox, with no unknown label/mixed state/reset. An officer cannot distinguish an unverified value from false or clear a previously known Boolean back to null. Read-only mode does distinguish null from false, so editable and read-only semantics disagree.

Closure: provide explicit unknown/null, false and true states for optional custom Booleans, including an accessible reset. Add published-schema regressions for untouched null, explicit false, true, clear-to-null and save/reopen. Required Boolean validation must treat false as a supplied value.

### T2-R5 — MAJOR — Backend canonical helper loses original uncertain date on direct correction/clear

Evidence: `backend/src/cases/case-canonical-fields.ts:88,90` deletes or replaces owned date aliases without archiving their original value. Frontend-only `preservePartialCaseDates` archives such sources (`frontend/src/features/cases/canonical-fields.ts:83`), but a server API write cannot depend on a particular client doing so. Architecture line 45 requires original date/EDTF preservation.

Effect/reproduction: frozen backend helper probes against existing `{ngayXayRa:'198X'}` return only `{ngayXayRa:'1981-10-05',_canonicalClears:{}}` after correction, or only `{_canonicalClears:{ngayXayRa:true}}` after explicit null. In both cases the original `198X` disappears from normalized metadata. A non-UI caller loses uncertain source data even if T1 assigns the helper's complete metadata correctly.

Closure: preserve original uncertain dates server-side before changing/deleting owned aliases, using the agreed provenance representation and without resurrecting them as current values. Add helper regressions for correction and clear of top-level and nested statistic partial dates, then T1/T5 must verify direct-API persisted roundtrips. T2 owns the pure helper fix; T1 owns service integration.

## Minor finding

### T2-R6 — MINOR — Existing verification output is not pristine

Evidence: `docs/test-evidence/case-governance/t2-canonical.md:42,56` records Vite chunk-size/Browserslist-age warnings, React act warnings and jsdom navigation limitations. The select reproduction additionally emits a product React key warning, which belongs to MAJOR T2-R1 rather than this inherited noise.

Effect: passing assertions do not establish warning-free output; test warnings can mask future async/render regressions. Closure: retain this qualification, distinguish inherited warnings from introduced ones, and repair focused test synchronization/environment limitations when those tests are touched. Baseline tool/dependency warnings can remain documented downstream debt; do not suppress production errors to manufacture clean output.

## Cannot verify from the T2 package — downstream gates

- **T1:** atomic CasesService integration, replacement rather than stale remerge of normalized metadata, server schema pinning/adoption/immutability, field authorization, DTO/DB typed/null persistence, and concurrent writes. The already reported statistic builder null-date-to-undefined issue (`t2-canonical.md:54`) remains a required T1 regression/closure, separate from T2-R5.
- **T4:** native field capability filtering, governance configuration/publication/adoption workflows and field-specific access/validation presentation. The select transport was checked only to resolve T2-R1; the entire schema/ACL service was not reviewed.
- **T5:** real persisted API/browser 132-field and 181-placement acceptance, custom typed fields, partial-date clear/correction/source preservation, role/scope/sensitivity matrices, search/count/detail/Word/Excel consistency, URL restoration, clone resets, partial-upload retry, runtime usability/accessibility and independent UAT. Existing synthetic tests support these gates but do not replace them.
- No production access, real-dossier mutation, deployment or release GO was reviewed or performed.

## Evidence and review boundary

Reviewed `t2-verification.json` and its report: 4322/4322 frontend tests in 381 files, 269 backend helper tests, and frontend typecheck/build/scoped lint/backend scoped lint reported exit 0. These suites were not repeated. Directly read coverage summaries: frontend statements 98.01%, branches 91.79%, functions 97.67%, lines 99.11%; backend statements 95.74%, branches 91.42%, functions 100%, lines 97.56%. The backend artifact is under `backend/docs/test-evidence/case-governance/t2-backend-coverage/coverage-summary.json`; frontend is under `docs/test-evidence/case-governance/t2-frontend-coverage/coverage-summary.json`.

Focused read-only commands used `rtk proxy node -e`: frozen accessor with inventory-backed descriptors (T2-R2), frozen component TypeScript transpile plus React server render (T2-R1/R4), and frozen backend helper/registry transpile (T2-R5). All three probes exited 0 and exposed the outputs above; they were demonstrations of specific missing boundary cases, not suite certification. Inspection commands used `rtk rg` or `rtk proxy powershell/node`. An initial quoted inspection probe and an initial incorrectly resolved coverage path exited 1, then were corrected; neither was a product test failure.

The diff was reviewed once in bounded sequential chunks; one tool-truncated text-test portion was recovered. No broad code crawl or Git commands were used. Outside-package checks were limited to named risks: select/nullable transport definitions and response serialization; victim-count/unit ownership mappings; the editable form's provenance/save shell and shared layout annotation forwarding; payload function context cut off in diff hunks for clear/date semantics; and the existing civil-date utility. These checks did not certify those downstream modules.

Assessment: **Needs fixes**. Zero task BLOCKER findings; five task MAJOR findings and one inherited MINOR qualification. Require regression-first closure and a focused independent re-review before marking T2 approved; milestone readiness additionally depends on the explicit downstream gates above.
