# T2 canonical case information evidence

Approved contract: CG01/CG15, frozen 132 keys / 181 placements / ten tabs, architecture CG-R04/CG-R05. Worktree baseline `10030bed`; source ownership limited to canonical field helpers, CaseForm/Detail information integration, and their tests. CasesService/schema integration is owned by T1.

## Implemented contracts

- Backend `normalizeCanonicalCaseWrite(input, existingMetadata?)` returns the unchanged business fields and complete normalized metadata. T1 must assign the returned metadata directly, without merging stale metadata afterward. Explicit canonical null/empty string/empty array writes remove owned aliases and persist `_canonicalClears[columnPath]=true`; false and zero remain values. Metadata-only writes cannot revoke prior clears. Unknown metadata and original dates/EDTF survive. Nested statistic aliases are normalized without mutating their input. Native Boolean `baoCaoBanGiamDoc` is never interpreted as the text alias for `baoCaoBanGiamDocText`.
- Backend generated field registry is checked against every frozen inventory key, column, kind, type, and label. Frontend derives field ownership and actual captions from `CASE_LEGACY_SPEC`; it does not duplicate the 132-field UI definition.
- CaseForm reads canonical values before legacy metadata and distinguishes cleared versus missing values. Final save normalization runs after the parity-field merge. Nullable statistic clears and six supplemental promoted fields now send explicit null rather than omission. `noiXayRa` and statistic damage clears cannot be restored by supplementary aliases.
- CaseDetail retains all six specialized tabs, routes, defendant/lawyer/conclusion/timeline/journey behavior. Its information panel and narrative use the canonical accessor. Its additional read-only ten-tab view reuses `LegacyLayoutSection`, preserves all 181 placements, displays false/zero, and labels unverified legacy values.
- Published custom field definitions load from the approved default or pinned case schema endpoints. Typed text/textarea/number/boolean/date/select controls and read-only displays share the published definition; unknown values are not rendered. Navigation hides another case's schema immediately. Edits persist through `metadata._customFields`; the client does not assign the authoritative schema-version FK. Partial-upload retries use the created case's pinned schema route.
- Unchanged uncertain legacy date source values remain metadata rather than entering DateTime columns. Original uncertain sources survive correction/clear in `_canonicalDateSources`; real date correction removes the unverified display. The editable native date input shows a visible original-date annotation. Newly supplied arbitrary invalid dates still reach the existing DTO validation and are not silently accepted.
- Four nullable legacy Boolean fields retain null through untouched edit, save, reload and clone. The shared case layout and supplementary statistics cells use the same mixed-state control: unknown is visibly “Chưa xác minh,” an explicit “Không” choice stores false, and reset stores null. New defaults for these nullable fields remain unknown. Known true/false values retain their existing checkbox interaction. Read-only information also distinguishes unknown from false.

## RED evidence

All commands prefixed with `rtk proxy`; paths below are relative to frontend/backend working directories respectively.

| Command | Observed RED |
| --- | --- |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/canonical-fields.test.ts` | Initial four assertion failures: cleared/empty canonical description resurrected stale metadata; no durable tombstone; nullable statistic clear omitted. Later two assertion failures exposed native crime clear and nested statistic aliases. One date assertion failure exposed invalid legacy date promotion. Six supplemental clear assertion failures exposed omitted proposal/classification writes. |
| Backend `npm test -- --runInBand src/cases/case-canonical-fields.spec.ts --silent` | After the import/data bootstrap, 135 expected assertion failures with 132 frozen registry contracts already passing; later native crime/name and nested statistic regressions failed before their fixes. Bootstrap import/setup failures were not treated as behavioral RED evidence. |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/canonical-inventory.test.ts` | Two assertion failures among 265 tests: location clear restored `specificAddress`; damage clear restored supplementary amount. |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/CaseInformationTabs.test.tsx` | Two failed DOM assertions before read-only rendering: canonical content missing; ten tabs absent. |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/CaseCustomFields.test.tsx` | Two failed field/value assertions before typed controls; one unsafe-definition assertion failed before filtering. |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/useCaseFieldSchema.test.tsx` | Two missing-schema/error assertions before transport; then default-route and stale-case navigation assertions failed before their fixes. |
| Frontend `npm test -- --maxWorkers=2 src/pages/cases/CaseFormPage/__tests__/LegacyTabBody.test.tsx` | Original partial-date annotation absent (one failed assertion, thirteen existing tests passed). |
| Frontend `npm test -- --maxWorkers=2 src/features/cases/__tests__/nullable-boolean.test.tsx` | Four unknown-null assertions returned false; the mixed-state control was absent. Five assertion failures confirmed before the nullable preservation/UI fixes. Self-review reported the Boolean(null)/`===true` coercion sources to the parent before fixing. |

## Fresh verification

| Gate | Result |
| --- | --- |
| Backend canonical focused suite | 269 tests PASS, exit 0. |
| Backend helper coverage | Statements 95.74%, branches 91.42%, functions 100%, lines 97.56%; exit 0. JSON summary in `t2-backend-coverage/coverage-summary.json`. |
| Frontend final new modules coverage suite | 298 tests PASS across seven files, exit 0; statements 98.01%, branches 91.79%, functions 97.67%, lines 99.11%. Includes the nullable control and all supplemental clear regressions. JSON summary in `t2-frontend-coverage/coverage-summary.json`. |
| Frontend targeted final supplemental/payload regression | 95 tests PASS across three files, exit 0. |
| Frontend affected case suites after nullable/source fixes | 40 files / 676 tests PASS, exit 0. Two additional read-only/layout assertions were added afterward and are covered by the final full suite. |
| Frontend final scoped ESLint | PASS exit 0, including nullable control, types and supplementary statistics integration. |
| Backend scoped ESLint | PASS exit 0, all three owned backend files. |
| Frontend final type check | `rtk proxy npx tsc -b`, exit 0, after nullable/source fixes. |
| Frontend final build | `rtk proxy npm run build`, exit 0; 3042 modules, Vite build 34.60 seconds. Existing chunk-size and Browserslist-age warnings remain. |
| Frontend final full suite | 381 files / 4322 tests PASS, exit 0, 441.11 seconds, including Incident/Petition/UTDT/clone/upload/search/export existing regressions. Command `rtk proxy npm test -- --maxWorkers=4 --reporter=default --reporter=json --outputFile=../docs/test-evidence/case-governance/t2-frontend-final-full.json`. Product hashes remained identical throughout the final run. |
| Nullable clone/layout focused supplement | 20 tests PASS across two files, exit 0; includes four unknown-null clone assertions and actual shared-layout mixed → false → unknown interactions. |

The earlier full frontend run overlapped new supplemental regression additions and the corrective source edits. It reported 379 passing / 1 failing file and 4309 passing / 6 failing assertions, exit 1, in 656.82 seconds. Those six regressions were running against the cached pre-fix payload module and subsequently passed in the focused 95-test gate. That mixed-state run is retained as `t2-frontend-full.json` but is explicitly not final certification.

Machine-readable final results: `t2-verification.json`, exact final product hashes: `t2-source-hashes.json`. T2 is ready for the independent read-only review; the complete governance milestone and backend/global/private DB gates are not declared complete by this task report.

## Integration boundaries and remaining release gates

The real CaseForm persistence test verifies the published schema response, typed edit, PUT metadata value, unknown source preservation, and existing optimistic-lock token. It uses synthetic mocked HTTP transport; it does not certify server publication/adoption, field access filtering, private DB roundtrip, or browser UAT. T1 owns CasesService integration and schema version validation; T4/T5 own full governance configuration, actual persisted search/export consistency, access matrices, independent review, browser evidence, and release gates. No production access, real dossiers, external messages, commits, pushes, or deployment were performed by this worker.

Read-only server integration finding reported before any T2 backend fix: `case-statistic.builder.ts` converts null date values to undefined, which can keep an old persisted statistic date despite a clear payload. T1's core writer owns the regression/fix; actual DB roundtrip remains a required integration gate. Generic read-only legacy fallback values carry provenance labels; editable partial dates carry source annotations and nullable flags expose unknown state. The independent review should assess any additional editable provenance disclosure required by CG01.

Existing suites emit React `act(...)` warnings and some jsdom navigation limitations; new focused typed-field/persistence tests do not suppress production errors. These warnings are not failing assertions and must not be described as pristine output.

## Independent review fix round 1 of 5

The first independent review reported FAIL with five MAJOR findings before this round: `docs/reviews/case-t2-review.md`, T2-R1 through T2-R5. The immutable pre-fix product copy is `.superpowers/sdd/PLAN/t2-before`. This section records implementation closure candidates; independent re-review remains required.

| Finding | Regression-first evidence | Resulting behavior |
| --- | --- | --- |
| R1 published select transport | Real `string[]` fixture failed one option assertion and reproduced a React missing-key warning. The incompatible synthetic object-option fixture was replaced with the actual HTTP definition, not loosened. | Published options render their declared strings as captions/values. Actual CaseForm PUT carries selected `no`; the actual backend `validateCustomValues` accepts both `yes`/`no` with required false, number zero and optional null. Focused component/persistence tests pass without that introduced key warning. |
| R2 detail summary contradiction | Two actual CaseDetail DOM regressions failed: stale flat victim count instead of nested canonical 4, and receiving unit displayed for a cleared resolving unit. | Summary reads `statistic.soLuongBiHai`. Resolving and receiving units have separate labels and values; a resolving-unit clear remains blank. Two new actual-detail tests plus nine existing detail workflow tests pass. |
| R3 editable fallback verification | Six ordinary layout/payload assertions failed before source snapshots. Additional nested-shape and explicit same-false selection/mirror assertions failed before their fixes. | Client-only source snapshots preserve exact false/zero/array/raw types and label editable unverified fallback. Unrelated saves omit its canonical write and retain its metadata source, including after parity merge. Explicit correction, clear, or field confirmation changes that behavior. Partial dates cannot be confirmed as complete dates. Native and supplementary nullable controls treat an explicit false choice consistently. Ten provenance regressions, actual CaseForm unrelated-edit persistence, and existing date/nullable/inventory gates pass. No client snapshot or authoritative verification flag is sent to the server. |
| R4 optional custom Boolean unknown | Two assertions failed: optional null lacked mixed state/reset; required false failed native validity. | Optional Boolean reuses the mixed-state control with explicit false/true/reset-null. Required Boolean uses true/false choices where false is a supplied valid value and null remains missing. Actual CaseForm save/reopen tests preserve null, false and true; existing native Boolean behavior remains passing. |
| R5 server-side uncertain-date loss | Four top/nested correction/clear archive assertions failed before server archival; a create-source assertion failed before incoming-source archival. | Pure helper archives uncertain original date/EDTF values before replacing or deleting aliases. Top-level, flat/nested statistics, create, correction, clear and preservation of an existing original archive are tested. Complete real civil dates remain unchanged. Source classification reuses the existing calendar validator; no source date is fabricated and no CasesService/legal backend contract was edited. |

Round-1 product hash manifest: `t2-fix1-source-hashes.json`; original T2 hashes and verification records remain intact. Fresh verification collected so far:

- Frontend affected case suites: 42 files, 696 tests PASS, exit 0. Includes original clone, upload retry, UTDT, Word export, layout and detail workflows.
- Backend pure-helper/real-schema-value suite: 278 tests PASS, exit 0. Backend coverage includes helper and generated registry: 100% statements/lines/functions, 98.18% branches.
- Frontend scoped lint, backend scoped lint and frontend `tsc -b`: exit 0. A needless test cast and formatting-only lint failure were corrected without changing assertions.
- Frontend production build: exit 0, 3042 modules, Vite 10.67 seconds. Inherited chunk-size and Browserslist-age warnings remain.
- Frontend coverage includes all twelve owned frontend products, including existing CaseForm, Detail, payload, merge, layout, types and statistics modules. Its whole-file aggregate is 59.76% statements / 62.68% lines because existing unrelated code is included; this is not claimed as patch coverage. The five new modules aggregate 98.32% statements / 98.52% lines.
- Executable patch coverage against `10030bed`, across all fourteen owned frontend/backend products: **234/238 changed executable lines (98.32%)** and **339/364 changed branch outcomes (93.13%)**. No existing changed module is omitted. Standard Istanbul statement-start line hits and changed branch locations are used; deleted and non-executable lines are not counted. Artifact `t2-fix1-patch-coverage.json`; reproduce with `rtk proxy node docs/test-evidence/case-governance/measure-t2-patch-coverage.cjs` from the worktree root.
- Both coverage directories contain `coverage-final.json` and `coverage-summary.json`: `t2-fix1-frontend-coverage/` and `t2-fix1-backend-coverage/` under this evidence directory. The backend path is now absolute in its Jest command, avoiding the earlier relative-directory ambiguity.
- Full frontend regression is running against frozen round-1 products: `rtk proxy npm test -- --maxWorkers=4 --reporter=default --reporter=json --outputFile=../docs/test-evidence/case-governance/t2-fix1-frontend-full.json`. Completion/exit code will be recorded below; no full-round PASS is inferred while it runs.

Final round-1 full frontend command completed: **383 files / 4340 tests PASS, exit 0**, 335.13 seconds. Frozen product hashes remained unchanged. Machine-readable result: `t2-fix1-verification.json`; full test output: `t2-fix1-frontend-full.json`. All task-owned fixes are now ready for scoped independent re-review. This does not override the prior FAIL verdict until that re-review closes the findings.

Inherited React act/jsdom/Vite warnings remain qualified. Newly added focused select, actual-summary, provenance and custom-Boolean cases passed without suppressing production errors. Server persistence/schema pinning/field privacy and actual API/browser UAT remain the existing T1/T4/T5 downstream gates. This fix package does not certify the whole governance milestone or authorize production release.
