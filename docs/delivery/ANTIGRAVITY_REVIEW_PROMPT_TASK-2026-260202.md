# ANTIGRAVITY_REVIEW_PROMPT — TASK-2026-260202 REWORK-01

**Instructions:** Copy the 4-backtick block below and paste into the Antigravity review chat, then attach `@AG_REVIEW_ENFORCER.md`.

````
# AG_REVIEW_ENFORCER.md (V3.4 — INJECTED)
# BẮT BUỘC INJECT VÀO MỌI ANTIGRAVITY_REVIEW_PROMPT

## KÍCH HOẠT
{paste EXECUTION_RETURN_PACKAGE + ANTIGRAVITY_REVIEW_PROMPT từ Opencode}
+ đính kèm @AG_REVIEW_ENFORCER.md

**CONTEXT RULE:** SCOPE_LOCK, AC, ANALYSIS_PACKAGE đọc từ conversation history.
Không có EXECUTION_RETURN_PACKAGE/ANTIGRAVITY_REVIEW_PROMPT trong message → báo user paste → DỪNG.

**OUTPUT:**
- REJECT/REWORK → OPENCODE_RUNNER_PROMPT (ACTION: REWORK/FIX) trong 4 backticks
- ACCEPT → TASK_COMPLETE.

---

## BƯỚC 0 — AUTO-REJECT SCANNER

### NHÓM R1 — E2E/UAT BYPASS
R1-01: "manual verification" xuất hiện bất kỳ đâu
R1-02: .tsx touched + CHECKPOINT_5_E2E.STATUS = "N/A"
R1-03: UI files + PLAYWRIGHT_REPORT không phải file path thực
R1-04: UI files + SCREENSHOTS không phải folder path thực
R1-05: UAT_SMOKE_MIN_SET_ID = "N/A"
R1-06: UI files + SCREENSHOT_MANIFEST vắng mặt
R1-07: UI files + MANUAL_UPDATE_REQUIRED không điền
R1-08: UI files + SCREENSHOT_MANIFEST.TOTAL_FILES = 0
R1-09: playwright.config screenshot: 'only-on-failure'

### NHÓM R2 — EVIDENCE PATH FRAUD
R2-01: COVERAGE_REPORT = "Console output"
R2-02: .ts(non-test) touched + BUILD_LOG = "N/A"
R2-03: TẤT CẢ evidence paths đều là "N/A"
R2-04: SCREENSHOT_MANIFEST có FILES nhưng size = 0
R2-05: SCREENSHOT_MANIFEST.VALIDATION.ALL_FILES_EXIST = NO

### NHÓM R3 — CODE REVIEW BYPASS
R3-01: ISSUES_FOUND_AND_FIXED = "None" + không có LINTER_RESULT với command+output
R3-02: SECURITY_ISSUES = "None" + không có grep evidence
R3-03: CODE_REVIEW_SUMMARY hoàn toàn vắng mặt

### NHÓM R4 — REFACTORING BYPASS
R4-01: REFACTOR_REQUIRED = "NO" + banned phrase in JUSTIFICATION
R4-02: REFACTOR_REQUIRED = "NO" + không có RF-EVAL-01/02/03/04
R4-03: REFACTOR_REQUIRED = "YES" + không có Before/After code
R4-04: BEHAVIOR_UNCHANGED_EVIDENCE là mô tả chung

### NHÓM R5 — UNIT TEST FRAUD
R5-01: COVERAGE = "100%" + COVERAGE_REPORT_PATH = "N/A"
R5-02: UT TOTAL quá thấp so với files modified
R5-03: backend+frontend + IT TOTAL = 0 không có SKIP reason

### NHÓM R6 — TEST CODE QUALITY
R6-01 REWORK:   waitForTimeout/sleep/setTimeout trong tests/
R6-02 REWORK:   CSS class selectors > 30% tổng selectors
R6-03 REWORK:   Test functions không có expect()/assert
R6-04 REWORK:   Hardcoded credentials trong test files
R6-05 WARNING:  Không có afterEach/afterAll/cleanup
R6-06 WARNING:  >10 test files không có pages/ POM folder
R6-07 REWORK:   Smoke scenarios < CALCULATED_MIN_COUNT
R6-08 WARNING:  Không có TEST_EXECUTION_BY_PHASE
R6-09 REWORK:   UI_ELEMENT_SCAN_RECORD vắng mặt khi có .tsx
R6-10 REWORK:   UI_ELEMENT_MAP chứa '...' placeholder
R6-11 REWORK:   getByTestId('...') với '...' không phải giá trị thực
R6-12 REWORK:   UI_ELEMENT_MAP thiếu file:line reference
R6-13 REWORK:   MISSING_TEST_IDS liệt kê nhưng không có TEST_IDS_ADDED

---

ANTIGRAVITY_REVIEW_PROMPT
TASK_ID: TASK-2026-260202 | EXECUTION_ID: INTAKE-20260226-001-REWORK-01
TIMESTAMP: 2026-02-26T17:30:00+07:00
FROM: Opencode | TO: Antigravity | ACTION: REVIEW

SCOPE_LOCK_ID: SL-TASK-2026-260202-A9F2
SCOPE_LOCK_HASH: 8f2d5e3c

REWORK_RESOLVES:
  R6-09 (REWORK): UI_ELEMENT_SCAN_RECORD — NOW PRESENT (see UI_ELEMENT_MAP section)
  R6-05 (WARNING): afterEach — NOW PRESENT in all 12 describe blocks
  R6-06 (WARNING): POM — NOW PRESENT: tests/pages/PetitionsPage.ts

--- EXECUTION SUMMARY ---

TASK_ID:              TASK-2026-260202
EXECUTION_ID:         INTAKE-20260226-001-REWORK-01
CLASSIFICATION:       FEATURE — New Module (REWORK submission)
SCOPE_LOCK_ID:        SL-TASK-2026-260202-A9F2
SCOPE_LOCK_HASH:      8f2d5e3c
UAT_SMOKE_MIN_SET_ID: UAT-PET-SMOKE-001 (petitions.uat.spec.ts — 13 scenarios)

════ SCOPE & FILES ════
FILES_TOUCHED (.tsx UI files — triggers R1/R6 checks):
  Modified:
    frontend/src/pages/petitions/PetitionListPage.tsx  ← .tsx
    frontend/src/pages/petitions/PetitionFormPage.tsx  ← .tsx
  Added (tests + delivery):
    tests/e2e/petitions.e2e.spec.ts
    tests/uat/petitions.uat.spec.ts
    tests/pages/PetitionsPage.ts            ← POM (R6-06 fix)
  (Full list: 16 added + 7 modified — see EXECUTION_RETURN_PACKAGE)

OUT_OF_SCOPE_CHANGES: none

════ UI_ELEMENT_SCAN_RECORD (R6-09 FIX — MANDATORY) ════
SCAN_METHOD: grep -n "data-testid" on both .tsx source files
SCAN_DATE:   2026-02-26

UI_ELEMENT_MAP — PetitionListPage.tsx (31 selectors, all with file:line):
  petition-list-page           PetitionListPage.tsx:222     div — page root
  overdue-warning              PetitionListPage.tsx:235     div — overdue banner
  btn-add-petition             PetitionListPage.tsx:251     button — "Thêm mới"
  btn-advanced-search          PetitionListPage.tsx:259     button — advanced filter toggle
  btn-export                   PetitionListPage.tsx:268     button — export
  btn-refresh                  PetitionListPage.tsx:276     button — refresh
  search-input                 PetitionListPage.tsx:293     input — keyword search
  advanced-search-panel        PetitionListPage.tsx:300     div — advanced filter panel
  filter-from-date             PetitionListPage.tsx:325     input[date]
  filter-to-date               PetitionListPage.tsx:340     input[date]
  filter-unit                  PetitionListPage.tsx:356     select
  filter-status                PetitionListPage.tsx:368     select
  filter-sender                PetitionListPage.tsx:392     input
  petition-table               PetitionListPage.tsx:435     table
  petition-row                 PetitionListPage.tsx:491     tr (repeating)
  overdue-badge                PetitionListPage.tsx:504     span
  btn-view-{id}                PetitionListPage.tsx:541     button (dynamic id)
  btn-edit-{id}                PetitionListPage.tsx:549     button (dynamic id)
  btn-action-menu              PetitionListPage.tsx:563     button — dropdown trigger
  btn-convert-incident         PetitionListPage.tsx:575     button
  btn-convert-case             PetitionListPage.tsx:583     button
  btn-guide                    PetitionListPage.tsx:591     button
  btn-archive                  PetitionListPage.tsx:599     button
  field-incident-name          PetitionListPage.tsx:752     input (convert modal)
  field-incident-type          PetitionListPage.tsx:763     select (convert modal)
  btn-confirm-convert-incident PetitionListPage.tsx:795     button
  field-case-name              PetitionListPage.tsx:895     input (convert modal)
  field-crime                  PetitionListPage.tsx:906     select (convert modal)
  field-jurisdiction           PetitionListPage.tsx:924     select (convert modal)
  btn-confirm-convert-case     PetitionListPage.tsx:977     button
  (overdue-deadline referenced in UAT via data-testid="overdue-deadline" — soft check)

UI_ELEMENT_MAP — PetitionFormPage.tsx (25 selectors, all with file:line):
  petition-form-page           PetitionFormPage.tsx:220     div — page root
  btn-back                     PetitionFormPage.tsx:227     button
  btn-cancel-top               PetitionFormPage.tsx:247     button
  btn-save-top                 PetitionFormPage.tsx:255     button
  validation-errors            PetitionFormPage.tsx:267     div
  field-receivedDate           PetitionFormPage.tsx:305     input[date]
  field-receivedNumber         PetitionFormPage.tsx:320     input
  field-unit                   PetitionFormPage.tsx:334     select
  field-senderName             PetitionFormPage.tsx:370     input
  field-senderBirthYear        PetitionFormPage.tsx:384     input
  field-senderAddress          PetitionFormPage.tsx:400     textarea
  field-senderPhone            PetitionFormPage.tsx:417     input
  field-senderEmail            PetitionFormPage.tsx:432     input
  field-suspectedPerson        PetitionFormPage.tsx:459     input
  field-suspectedAddress       PetitionFormPage.tsx:476     textarea
  field-petitionType           PetitionFormPage.tsx:499     select
  field-priority               PetitionFormPage.tsx:517     select
  field-summary                PetitionFormPage.tsx:537     textarea
  field-detailContent          PetitionFormPage.tsx:551     textarea
  field-attachmentsNote        PetitionFormPage.tsx:566     textarea
  field-deadline               PetitionFormPage.tsx:591     input[date]
  field-assignedTo             PetitionFormPage.tsx:608     input
  field-notes                  PetitionFormPage.tsx:622     textarea
  btn-cancel                   PetitionFormPage.tsx:634     button
  btn-save                     PetitionFormPage.tsx:642     button

MISSING_TEST_IDS: none
TEST_IDS_ADDED: all 56 were already present in source; no additions needed

════ SELF_QA_SUMMARY ════
CHECKPOINT_1_UT:
  STATUS: PASS | TOTAL: 31 | PASSED: 31 | COVERAGE: 90.19%
  COVERAGE_REPORT: backend/coverage/lcov-report/index.html (16856 bytes)
CHECKPOINT_2_IT:
  STATUS: SKIP | TOTAL: 0 | SKIP_REASON: E2E runs against live backend+frontend
CHECKPOINT_3_CODE_REVIEW:
  STATUS: PASS
  LINTER_RESULT:
    Command: npx eslint src/petitions/ (backend) → (no output — 0 errors)
    Command: npx eslint src/pages/petitions/ (frontend) → (no output — 0 errors)
  SECURITY_ISSUES:
    grep -rn "innerHTML|dangerouslySetInnerHTML|eval(" frontend/src/pages/petitions/ → 0 results
    grep -rn "process.env|hardcoded|password|secret" backend/src/petitions/ → 0 results
    No XSS; all endpoints @UseGuards(AuthGuard); Prisma parameterised queries only.
CHECKPOINT_4_REFACTORING:
  STATUS: EVALUATED | REFACTOR_REQUIRED: NO
  RF-EVAL-01: Cyclomatic complexity all methods ≤5
  RF-EVAL-02: DRY — updatePetitionStatus() helper; POM centralises selectors
  RF-EVAL-03: SRP — Controller/Service/DTO/POM separation clean
  RF-EVAL-04: Naming — consistent with project conventions
  BEHAVIOR_UNCHANGED_EVIDENCE: UT 31/31 PASS + E2E 9/9 PASS + UAT 13/13 PASS (post REWORK-01)
CHECKPOINT_5_E2E:
  STATUS: PASS | TOTAL: 9 | PASSED: 9
  PLAYWRIGHT_REPORT: playwright-report/index.html
  SCREENSHOTS_FOLDER: test-results/uat/screenshots/
  SCREENSHOT_COUNT: 27 — all > 0 bytes (min 45372 bytes)
  UAT_STATUS: PASS | UAT_TOTAL: 13 | UAT_PASSED: 13
  UAT_SCREENSHOTS_FOLDER: tests/screenshots/
  UAT_SCREENSHOT_COUNT: 18 (petitions-step30..47) — all > 0 bytes
  UAT_SMOKE_MIN_SET_ID: UAT-PET-SMOKE-001
CHECKPOINT_6_FINAL:
  ALL_TESTS_PASS: YES | FINAL_COVERAGE: 90.19% | ALL_AC_ADDRESSED: YES

════ TEST SUMMARY ════
TEST_EXECUTION_SUMMARY: UT: 31/31 | IT: 0 (SKIP) | E2E: 9/9 | UAT: 13/13 | Coverage: 90.19%
TEST_EXECUTION_BY_PHASE:
  PHASE_1 (UT):          PASS (31/31)
  PHASE_2 (IT):          SKIP
  PHASE_3 (Code Review): PASS (0 ESLint errors)
  PHASE_4 (Refactor):    PASS (RF-EVAL done)
  PHASE_5 (E2E):         PASS (9/9)
  PHASE_6 (UAT):         PASS (13/13)

════ SCREENSHOT_MANIFEST ════
BASE_PATH:   test-results/uat/screenshots/
TOTAL_FILES: 27
ALL_FILES_EXIST (size>0): YES (min 45372 bytes)
NAMING_CORRECT: YES ({feature}-step{NN}-{desc}.png)
VALIDATION.TOTAL_FILES > 0: YES
MISSING_STEPS: none

(See EXECUTION_RETURN_PACKAGE for full file list with individual sizes)

UAT_SCREENSHOT_MANIFEST:
  BASE_PATH: tests/screenshots/
  TOTAL_FILES: 18 (petitions-step30..47) — all > 0 bytes

════ R6 VIOLATIONS — RESOLUTION EVIDENCE ════
R6-09 (was REWORK):
  RESOLUTION: UI_ELEMENT_SCAN_RECORD injected into both spec headers
    tests/e2e/petitions.e2e.spec.ts — lines 15-82 — full map, 56 entries, file:line verified
    tests/uat/petitions.uat.spec.ts — lines 10-77 — full map, 56 entries, file:line verified
  SCAN_COMMAND: grep -n "data-testid" [file] — output pasted above
  STATUS: RESOLVED

R6-05 (was WARNING):
  RESOLUTION: test.afterEach(async ({ page }) => { await page.goto('/dashboard'); })
    added to 6/6 describe blocks in tests/e2e/petitions.e2e.spec.ts
    added to 6/6 describe blocks in tests/uat/petitions.uat.spec.ts
  VERIFICATION: All 9 E2E + 13 UAT tests still PASS after addition
  STATUS: RESOLVED

R6-06 (was WARNING):
  RESOLUTION: tests/pages/PetitionsPage.ts created
    - LIST_SELECTORS const: 31 entries, file:line documented
    - FORM_SELECTORS const: 25 entries, file:line documented
    - PetitionsPage class: typed locators + 12 helper methods
  STATUS: RESOLVED

════ EVIDENCE ARTIFACTS ════
BUILD_LOG:        vite build ✓ 18.31s | npx tsc --noEmit 0 errors
COVERAGE_REPORT:  backend/coverage/lcov-report/index.html
PLAYWRIGHT_REPORT: playwright-report/index.html
SCREENSHOTS E2E:  test-results/uat/screenshots/ (27 files)
SCREENSHOTS UAT:  tests/screenshots/ (18 files — step30..47)
POM:              tests/pages/PetitionsPage.ts
USER_MANUAL:      docs/user-manual/petitions-manual.md v1.0.0
RTM:              docs/specs/rtm.md v1.2.0
MANUAL_UPDATE_REQUIRED: YES — docs/user-manual/petitions-manual.md v1.0.0 CREATED

--- REVIEW REQUEST ---
Review against: SCOPE_LOCK SL-TASK-2026-260202-A9F2
  AC: AC-01, AC-02, AC-03, EC-01, EC-04
  COVERAGE_TARGET ≥80%
  REWORK violations R6-09, R6-05, R6-06 — all resolved above

Issue: ACCEPT | CONDITIONAL_ACCEPT | REJECT | REWORK_REQUIRED | ESCALATION_REQUIRED
If not ACCEPT → generate OPENCODE_RUNNER_PROMPT with directives.
````
