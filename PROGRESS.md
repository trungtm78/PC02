# PROGRESS

# ACTIVE EPIC (13/11/2026): team permissions + team lifecycle + report criteria per team
Spec = plan file `C:\Users\Than Minh Trung\.claude\plans\t-i-m-n-h-nh-danh-twinkling-acorn.md` (approved, ENG CLEARED). Protocol = AUTONOMOUS EXECUTION PROTOCOL (no questions; stop only for done / real blocker / irreversible-or-security action). Branch: `feat/team-lifecycle` from `origin/main` `74043fd6`. Commit trailer per session reminder; never `git add -A`, never `git stash -u`; `uat/` is untracked and must stay so.

## Đã hoàn thành
- M0 mockup; **M1 team lifecycle = PR #650, PRODUCTION** (E2E on production 21/21, test data removed).
- **Report criteria part 1 = PR #652, PRODUCTION build `3015851d`** (supersedes #651): criteria from an Excel column / cells, hand-typed criteria, per-team subsets (`DynReportTarget.itemKeys` -> `DynReportAssignment.ownedFieldKeys`), one contributors helper, editor sees/saves/submits only the team's part (fields, rules, grid, own Excel file), totals per owned field, stable criterion codes across versions. E2E on production 22/22 (API, admin account), test data removed. Two Codex passes, 7 findings fixed.
- The owner allowed the agent to merge with `gh pr merge --squash --admin` after CI is green (said "merge ... deploy" twice on 13/11); deploy.yml always ends red because of the known petition shadow-column step, judge by health `buildId` + `--log-failed`.
- **Report criteria part 2 = PR #653, PRODUCTION build `95ba59d6`**: official file made by itself when a period is closed (sheet "Tổng hợp" + one sheet per team, kept without expiry, "Tạo lại" supersedes, reopening voids, catch-up cron), a team's criteria changed mid-period with a reason (backend), team criteria in edit/copy screens, criterion code stored. E2E on production 34/34 (`prod-e2e-official.cjs` in the session scratchpad: figures in the file equal the API summary), test data removed.

## Đang làm dở
- On production: #650 team lifecycle; #652/#653/#654 report criteria per team; #655 permissions foundation; **#656 permission screen + write API (`9ff5f8fd`, E2E 24/24)**; **#657 record filters ready for precise scopes, every check names its subject (`1ee7796a`, read-only smoke check identical before/after)**; **#658 services ask shared scope helpers, journey petitions follow the common rule (merged `8f5fc779`; smoke check before/after was running: `prod-lists-check.cjs` in the session scratchpad)**.
- Mode `QUYEN_THEO_TO_CHE_DO` is OFF on production: nothing configured on `/admin/phan-quyen` has any effect yet. The screen has NOT been opened in a real browser (no Chrome extension connected); the Vietnamese labels of special permissions in `frontend/src/locales/permissions.vi.ts` were worded by an agent and need the owner's read. E2E runs left `E2E-` rows in the permission change history (the product's own log; not removed).
- Branch `feat/authz-enforce-wiring` (from `origin/main` `8f5fc779`), 3 commits, NOT pushed = **PR D5: the request path asks permissions by team first, acted on only in ENFORCE**:
  - `authz/authz-scope.service.ts` (`forUser`, `keysFor`: `undefined` unless ENFORCE), `AuthzService.currentMode()` (one cached settings row, 10 s), `AuthzModule` now `@Global()`.
  - Callers: `UnitScopeService.resolveScope`, `CaseGovernanceService.currentScope`, `PermissionsGuard`, `AuthService.getProfile` (all `@Optional()`, fall back to before on `undefined`).
  - `SettingsService.updateValue` refuses anything but OFF / SHADOW for the mode key.
  - `teams/team-tree.constants.ts` (import cycle that left a provider undefined at start-up; caught by `src/app.bootstrap.spec.ts`, which MUST be run for any change of imports between auth / authz / teams).
  - Specs: `authz/enforce-wiring.spec.ts` (21), `authz/authz-scope.service.spec.ts` (8). Codex pass (`codex-out10.txt`) and backend full suite (`be-full11.json`) were running in the background.
- BƯỚC TIẾP THEO: fix Codex findings with tests; push; PR; CI; merge; deploy; smoke check before/after. Then:
  - D5b: the direct `rolePermission` readers must also follow ENFORCE (`case-governance.service.ts` `permission()` / `hasCapability`, `legal-workflow.service.ts`, `dynamic-reports` admin/manage flags in `reports.service.ts`, `grid-access.service.ts`, `submission.service.ts`, `status-query.service.ts`, `report-lifecycle.service.ts`, `aggregate.service.ts`, `ocr-import/ocr-send-policy.ts`, `ocr-intake.service.ts`, `admin/bulk/bulk-import.service.ts`, `admin/case-authority.guard.ts`): one helper `AuthzScopeService.keysFor` or role fallback; gate: no `rolePermission` read outside `authz/`, `admin/admin.service.ts` and the guard. Also: every hand-made `new CaseGovernanceService(prisma)` / `new PermissionsGuard(...)` in non-spec code must receive the service; `req.dataScope ?? null` must stop turning a missing scope into "unrestricted".
  - D6: SHADOW (compute both for the acting user, log differences rate-limited), admin report for every active user (the preview engine already computes this: reuse `impactOf` against "role only"), starter templates, the gated endpoint that switches ENFORCE on (blocks while unacknowledged losses exist; needs a second admin for sensitive changes), runbook + rollback. ENFORCE is NOT switched on in production without the owner reading the report (stop condition 8c).
  - Then PR F: `UAT-COVERAGE.md` + UAT workflow scripts.
- Known side findings (not fixed, pre-existing): `delegations.service.ts:162` and `proposals.service.ts:125` stats call `dungWhere` without `actorId` and probably always answer 403.

## Hàng queue — detailed plan of everything that is left (owner asked 13/11: "plan chi tiết và làm hết đi")
Each numbered item = one PR: tests first, targeted tests + tsc, ONE Codex pass, full suites in background one after the other, CI green, `gh pr merge --squash --admin`, watch deploy (health buildId), E2E on production with self-cleaning `E2E-` data.

**PR A — report criteria part 2: DONE (#653 on production; the rest is the polish branch above).**

**PR B — permissions by team, foundation: written (see "Đang làm dở"), in review.**

**PR C — write side + screen: DONE (#656).**

**PR D — wiring + SHADOW: D1–D3 on production (#657, #658); D5 in review; D5b and D6 listed in "Đang làm dở".** (D4 "one resolver" was folded into D5: both resolvers ask the same service when enforced, and keep their own legacy behaviour otherwise.)

**PR E — ENFORCE**: replace role-name checks (about 40 sites, see the survey in the Codex/agent notes) by permission checks where they are about permissions; gate that blocks ENFORCE while unacknowledged losses exist; no self-lockout (at least one active ADMIN); runbook + rollback (set OFF); two-person approval for sensitive changes. NOT switched to ENFORCE on production without the owner reading the comparison report (it changes what 231 officers can do: stop condition 8c).

**PR F — UAT**: `UAT-COVERAGE.md` matrix of every new screen/function; `tools/uat-to`, `tools/uat-bao-cao-dong` (extended), `tools/uat-phan-quyen` workflow scripts; browser click-through when a test officer account and the Chrome extension are available.

## Quyết định kiến trúc
See the plan's Decision ledger (D1, R1–R12) and binding decisions B1–B7.
- **Authz decisions taken while building PR B (13/11, agent, per B4):**
  - *Default = the role, not a seeded template.* A team with no EXPLICIT configuration up its line gives each member what their ROLE holds at reach TEAM_TREE. This is literally today's behaviour (golden-tested), needs no data migration and cannot drift from `role_permissions`. Replaces the plan's "default template copied from production"; starter templates are still seeded for convenience (PR C).
  - *One foreign key to teams.* Member and leader template are two columns of `team_permission_configs` (no `TeamPermissionTemplate` table); overrides hang off the config. History is one table `permission_change_sets` with before/after JSON.
  - *No `menuIds` in the catalogue.* A menu item already names its permission (`quyen`); the screen derives "what this unlocks" from the pairs. The gate checks every menu `quyen` is in the catalogue.
  - *Nothing in the request path is wired in PR B.* The guard and filters are untouched, so OFF is identical by construction; the wiring comes with the precise OWN/TEAM filters in PR C, because enforcing keys without the record filters would enforce half a configuration.
  - *The revision is an append-only log (`authz_changes`), not a counter row.* A row updated in place is a lock every permission-affecting writer queues on, and it deadlocks with a team merge (Codex P1). Readers key caches by `count:max(id)`; a row is visible exactly when its change commits. Growth: one row per real change (a handful a day); no pruning yet, see Nợ kỹ thuật.
  - *A person must see what they may change:* `entryProblems()` refuses any permission of a resource that reaches further than the resource's "view" permission.
- **B8 (owner, 13/11/2026, binding):** the report criteria and loading them from an Excel file belong INSIDE the existing report setup screen ("Thiết lập báo cáo": the wizard `ReportTemplateUploadPage` -> `ReportTeamsStep` -> `ReportRulesStep` -> `ReportScheduleStep` -> `ReportSummaryStep`), not on a separate screen. Phase B therefore adds: the criteria upload as an input mode of the template step; the per-team criteria checklist inside the teams step; the matrix and bulk tools as panels of those same steps; the summary step shows the criteria per team. Editing an existing report's criteria goes through the same wizard (`ReportEditPage` / `ReportNewVersionPage`). No new top-level menu item.

## Phase B design notes (from code survey 13/11, for the criteria-from-Excel work)
- Template parse is `POST bao-cao-dong/templates/sheets` and `/preview` (backend `template/`, worker `parse-worker.ts`); the wizard `ReportTemplateUploadPage` keeps the `File` in browser memory and resends it; `/preview` already returns a `grid` (`GridModel`: rows, cols, merges, `cells` A1 -> {k:'text'|'num'|'formula'}) plus `fields[]`, `markableCells[]`. Formula cells carry no cached text (criteria in formula cells cannot be read).
- Frontend has NO spreadsheet library. `GridViewer`/`GridTable` (features/dynamic-reports/grid) already render the grid with column-letter headers and a rectangular drag-select "mark mode" (`GridMarkBinding {candidates, chosen, onPick}`); gaps: no whole-column select (column `<th>` has no handlers), no per-row tick, candidates are only unlocked cells.
- A field = an unlocked cell with a `{TYPE|FORMAT|AGG}` token (source TOKEN) or a hand-marked markable cell (source WEB); `fieldKey = Sheet!Addr`; publish re-parses the file and `reconcileFieldsWithWorkbook` demands every token cell be in the field list. Therefore criteria must be turned into a generated workbook "Chi tieu" (locked label cell in A, unlocked token cell in B per row, `escapeXlsxCell`, sheet name via `sanitizeSheetName`, never `__dr_meta`) built in a NEW backend endpoint (frontend has no xlsx lib), then fed through the existing save/new-version flow. Closest precedent: `SubmissionService.buildListWorkbook`.
- `DynReportTarget` has no per-team field subset; hook points for the subset: `toFieldView`, unknown-field checks (`submission.service.ts` ~1714, ~1999), required check (~2170), grid `fields`/`editable`, aggregate/status services, exports. `version-fields-cache` caches fields per versionId forever (fields are write-once once published).
- Because `fieldKey` is an address, inserting/reordering criterion rows changes keys; `carryOverMarks` matches by `fieldKey`. A stable criterion code (`itemKey`) is therefore needed (plan R-field `DynReportField.itemKey`).
- Known limit not enforced today: `assertWorkbookLimits` (20 sheets / 100k rows) is never called in the dynamic-reports path; tier 2 limits (5 sheets, 50k cells, 5k inputs) apply after parse; grid limits 3000 rows x 128 cols.

## Assumption
- Production writes (migrations) go only through the normal `deploy.sh` pipeline; no ad-hoc production data writes.
- The petition shadow-column loader (below) stays an owner decision; unrelated to this epic.

## Trạng thái test
- Baseline not yet re-measured on this branch.

## Nợ kỹ thuật
- **Must be closed in PR 4 before any screen can set a subset** (Codex review of PR 2, 13/11; none is reachable today because nothing writes `itemKeys`): (1) P1 Excel totals formulas and `PeriodExportScope.counted` are team-level (`aggregate.service.ts` ~1618, `export/period-export.ts` ~411): an AVG/ZERO field would divide by teams that do not own it; (2) P1 submit requires every required field of the version (`submission.service.ts` ~2170); (3) P2 save/import accept fields the team does not own (~1710, ~1995, import preview ~1909); (4) P2 the editor receives every field (`toFieldView` ~1466); (5) P2 `closing-basis.ts` ~62 and (6) the KPI denominators (`aggregate.service.ts` ~478, `status-query.service.ts` ~270) count a team whose subset is empty as owing something.
- `authz_changes` is never pruned (one row per change of memberships, roles, templates...; a bulk user import adds one per statement). At a few thousand rows a year the per-request `count(*)` stays trivial; prune by age in a maintenance job if it ever passes ~100k.
- Frontend eslint reports 9 errors in files this epic did not write (`features/dynamic-reports/grid/*`, `useCurrentFile` in `ReportTemplateUploadPage.tsx`); lint is not part of CI.
- Pre-existing, not ours: `officer-read-grant.database.spec.ts` only accepts the database `pc02_goiy_scope_test`; frontend suites `StatusDashboardPage`, `StatusMatrixPanel`, three OCR form tests and `configuration-editors` time out when the machine is loaded and pass alone.
- none yet.

---
# PREVIOUS EPIC (kept for context): scan-image intake with LLM
Updated: 2026-11-04 | Epic: scan-image intake with LLM (Petition / Incident / Case) | Milestone: M1-M10 built, review fixes applied, real-scan run done (04/11) | Task: browser UAT on the create screens + golden-set scoring by a person

STATUS: BLOCKED

Spec (approved design, reviewed + outside-reviewed): `docs/superpowers/specs/2026-11-03-nhap-tu-anh-scan-llm-design.md`.
Branch: `feat/nhap-tu-anh-scan-llm` (from `origin/main` `5e964b2f`). Working branch is local only; nothing pushed.

## Current work (autonomous)

Milestones follow the spec's delivery order (vertical slice first):

| # | Milestone | State |
|---|---|---|
| M1 | Contracts and foundations | DONE in code (commits 4e4b48ce, 91539819, 746f554a, 606fd969, c8ebbafb); full-suite run pending |
| M2 | LLM gateway + configuration, Anthropic adapter | DONE (backend 155 specs incl. PostgreSQL; admin screen 38 UI tests; full suites: backend 9183 pass, frontend 5702 pass, only load-timeout flakes that pass alone) |
| M3 | Vertical-slice pipeline (images) | DONE: backend complete and reviewed. Codex (gpt-6-astra) found 9 defects on 03/11, all fixed with tests (purge/bind race, provider eligibility re-check per attempt, stale-analysis fingerprint, atomic model readings, claim tokens + heartbeat, finaliser claim + backoff, abort-on-failure, send permission re-checked at run time). Full backend run: only load-timeout flake (passes alone) |
| M4 | Petition UI | DONE (commits 06c36481 .. c9075d39): drawer, upload/read/poll, per-field fill with no overwrite, orange fields + Save block + fill bar with per-field Confirm, undo by patch, field notes under each field, side-by-side review with transcript correction and re-analysis, binding sent only in the create request. Codex (gpt-6-astra) found 6 frontend defects, all fixed with tests. Left for later: per-field correction telemetry (`do_sua_o`) goes with M10; real-browser click-through at the end |
| M5 | Golden set + scorer | TOOLING DONE (5f0d333f): `scorer.ts` (correct / wrong / missing / INVENTED = filled where the answer says empty / unscored), `bundles.ts` (groups scans by file-name timestamp), CLI `npm run ocr:danh-gia -- --dir <scans> --out <results> [--entity] [--provider anthropic|gemini] [--model] [--bundles 0,2] [--golden file.json] [--init-golden]` (exit 1 on any invented value). NOT run on the real set: needs a working API key, then a person must correct `golden.draft.json` against the images (a score against an uncorrected draft only measures the system against itself) |
| M6 | Gemini + OpenAI-compatible adapters, fallback chain | DONE in code (c12f46a6): `GeminiProvider` (responseJsonSchema, key in header, thinking-token headroom), `OpenAiCompatibleProvider` (cloud OpenAI at a fixed host, self-hosted at the unit URL, strict json_schema, redirects refused), `ssrf-guard` run before every self-hosted call, factory wired, admin screen offers all four kinds with Gemini as the default. NOT yet exercised against the live APIs (no keys in this session): the admin key test (5 steps) will show it the first time a key is entered |
| M7 | PDF subsystem | DONE for cloud providers (2a5b36df, hardened 0af6362f after Codex): PDF upload is split by `PdfSandbox` (worker thread, 256 MB heap ceiling, a watchdog on array-buffer growth (400 MB) because decoded streams do not count against the heap, 20 s deadline, page cap checked before any page is added; encrypted / corrupt / too complex have their own codes). The single-page copies drop page actions, annotations, metadata and thumbnails, so nothing active reaches the embedded viewer. An upload is all-or-nothing (a page repeated inside the PDF is added once; a page already in the session refuses the whole file; pages added before a failure are taken back and unreferenced files removed). Anthropic reads the pages as `document` blocks, Gemini as inline data, OpenAI as `file` parts. Self-hosted servers answer `UNSUPPORTED_INPUT` and the chain fails over; rasterising PDFs for self-hosted models is NOT built (needs an external renderer on the VM). Known gap: a crash between writing a file and adding its row can leave an unreferenced file until the session expires; there is no directory sweep for such files |
| M8 | Incident + Case | DONE for the legacy-layout fields (commits 421261ce, 6031ed14, 8cae817e, e9c02851): shared `useOcrFormIntake` + `OcrIntakeSection` used by all three create forms; Case drafts in the browser keep only `{sessionId, analysisId}` and restore by re-fetching the analysis (expired scans are reported); the server's layout field names are translated to each form's own paths (Petition/Incident `dichLuu`) with a gate that every catalogue field lands on its form. NOT done: native fields outside the layout (Case `caseTitle`/`subjects[]`, Incident `name` is filled through the summary, Petition `suspectedPerson` via layout mapping) |
| M9 | Re-read on saved records | DONE in code: backend `POST /ocr/rereads` (`OcrRereadService`: edit permission + send policy, authorised `openDownload` of each BAN_SCAN document, new temporary session, same pipeline); frontend `useOcrReread` + `RereadSection` on the three edit screens: per-field comparison, "use the value from the image" writes into the open form only, the ordinary Save does the update; closing deletes the temporary session |. After Codex (0af6362f): a saved PDF scan can be re-read (stored as a PDF page, not refused as an image); starting a second reading, closing, or leaving the screen deletes the previous temporary session
| M10 | Quality + cost dashboard | DONE (0af6362f, 0071ab19): the create request carries `ocrKetQua` (the SERVER's field name + KEPT/EDITED/CLEARED, no values); the binder counts only fields the bound analysis proposed, once each, inside the bind transaction, with provider/model/prompt taken from the lineage row behind the BOUND analysis (matched by analysis prompt version and time, not the session's latest call); `GET /ocr/quality` (`read:OcrQuality`) and `/admin/chat-luong-ocr` show kept-rate per model, the most corrected fields, calls/failures/tokens/cost, and a banner with the month's spend against the cap (amber near the cap, red once reading has stopped). The 80%/100% Notification Center messages were replaced by this in-page banner |

BUOC TIEP THEO (next step): everything buildable without a live key is built, reviewed by Codex three times and fixed; full backend suite 9661 pass (before the last two commits, which re-ran their own suites green: ocr-import 299, frontend 1426 in the touched areas). REMAINING: (1) golden-set scoring: `npm run ocr:danh-gia -- --dir qa/ocr --out <outside repo> --init-golden --provider anthropic --model claude-sonnet-5-5` (key per command; 24 real files, personal data, gitignored, never commit or paste), then a person corrects `golden.draft.json` against the images and it is scored (the real-scan run itself is DONE, see below); (2) UAT matrix on the real bundles through the three create screens in a browser and the re-read on a saved record; (3) operator steps below (key ring env, transfer assessment, flag, role grants, `sharp` and the PDF worker asset in the deploy bundle); (4) one monkey test at the very end.
Real-model evidence (03/11, claude-haiku-5-5, two synthetic pages): 3 calls, ~19 s, 11k/6k tokens, sourceClass DENUNCIATION, Vietnamese summary, 14 fields filled correctly, no spurious issues; the two earlier defects (wrong class, English summary) are gone. Not yet tested on real scans/handwriting: needs the owner's golden set (M5).
Test tooling: run jest directly (`node node_modules/jest/bin/jest.js <path> --no-coverage`); the RTK wrapper hides suite load failures as "PASS 0 FAIL 0" and its log files are easy to misread. Full backend suite must be re-run before closing M2 (the earlier background run was killed by a session restart).

M1 delivered: shared AES-GCM + KeyRing (`common/crypto`), `PII_PATTERN` += api_?key, field catalogue generator (`npm run gen:khai-nhap-tu-anh`, 130/132/132 fields) + drift gate, per-field AI policy (7 fill / 15 must-confirm / 113 never) + gate, typed evidence schema (zod, provider-safe checked), unit contract (loss amount = VND), legal-role table (accused is never SUSPECT without a quoted decision).

Moved to M3 (sequencing choice): deterministic projection rules (G3) per fillable field. Known catalogue gap for M4/M8: fields outside the legacy layout (Petition `receivedDate`, `suspectedPerson`, `suspectedAddress`, `petitionType`, `senderEmail`; Incident `name`; Case `name`, `subjects[]`) need explicit "native field" declarations with the same policy gate.

Learnings from the real Haiku probe (03/11): Anthropic accepts the evidence schema as a tool and Haiku returns a validator-clean bundle (VND amounts right, no invented offence, 6/6 segments covered), BUT it labelled "Don to cao" COMPLAINT instead of DENUNCIATION and wrote the summary in English. The analysis prompt needs a Vietnamese legal glossary and forced Vietnamese text output. Also add `modusOperandi` (string|null) to the evidence schema for the "phuong thuc thu doan" field.

Test credentials: the owner pasted an Anthropic key in chat (03/11) for tests with `claude-haiku-5-5`. It is NOT stored anywhere; pass it per command via `ANTHROPIC_API_KEY`. Ask the owner to re-supply it in a new session; recommend rotating it.

Tooling note: gstack upgraded 1.91.9.0 -> 1.94.15.0; Bun upgraded 1.3.13 -> 1.4.4 because `./setup` crashed on 1.3.13 (`preflight-codex-overlap.ts`).

## Operator prerequisites (do not block code)
- Transfer-impact-assessment file (Luat 91/2025) before enabling any cloud provider; outbound Internet from the production VM to provider hosts (read-only `curl` probe, needs owner go); Claude key for tests, Gemini key for production.

## Previous work still open: Petition search release (BLOCKED on one owner decision)

Case governance is DONE (PR #503, UAT 856/856 PASS). The petition search work below is merged and live; only the production data load is pending.

## Decision 04/11: the transfer-assessment gate is removed
The owner decided the Luat 91/2025 transfer-assessment step is not needed. Removed: the rule that a cloud provider needs an active assessment (role assignment and the gateway's per-attempt eligibility), the admin endpoints `POST /llm/transfer-assessment[/withdraw]`, the `assessment` field of `GET /llm/status`, the screen section and its tests. The table `llm_transfer_assessments` and its rows are kept (no migration, nothing reads or writes it). Pre-existing documents (spec, plan) that mention the gate are superseded by this note. The `sendCloud` / `sendInternal` permissions stay: they say who may send scans to which kind of provider.

The LLM config screen was also reworked to be easy: a setup checklist (key, provider, test, in use) with a button for the next step, one click on `Dùng nhà cung cấp này` that tests and makes the provider the one in use, messages shown in the row they belong to, autofill-proof fields with a readable default name, Claude defaulting to Sonnet, and a warning on Haiku.

## Decision 04/11 (later): no confirmation step after a reading
The owner decided the confirm-before-save step is not needed: the reading fills the form as proposed and the officer corrects what is wrong. Removed: the orange fields, the Confirm buttons, the list of fields waiting in the fill bar, and the block on Save (all three create screens). Kept: the source note and quote under each filled field, Undo, the side-by-side review, the re-read, and the rule that a field the officer already typed is never overwritten. The server-side policy (`AI_FILL_MUST_CONFIRM`) and the `mustConfirm` flag in the quality statistics are unchanged; nothing waits on them. This supersedes the design item "fields that must be confirmed block Save" in the spec. The duplicate-record review (a different, older control) still asks to be acknowledged when a record matches an existing one.

## Real-scan run (04/11, key supplied by the owner, passed per command, never stored)

The 7 real bundles in `qa/ocr` (24 scans: 5 + 6x3 pages, handwritten stamps, photos of printed petitions) were run through G1-G4 (`scratchpad/probe-real.cjs`, results outside the repo). It found five defects that no test with ideal ids and canned replies could show; all fixed with tests (commits 3ae23c55, 53e76cf6, a5b2a9ab, 310b8323, 9ff6d889):
1. The analysis reply was cut off: a real 3-page bundle needs ~14k output tokens (Sonnet more), the cap was 8k, and the Anthropic adapter accepted the truncated tool input as complete. The adapter now rejects `stop_reason=max_tokens`; the budget grows with the page count (`analyseOutputBudget`).
2. The model mangled long ids: asked to cite `b3p1.s3` it wrote `p1.s3`, so every citation was dropped (2 fields survived). The model now sees only short aliases (`p1`, `p1.s3`) and the server maps them back (`restoreIds`).
3. A reply that failed the schema was re-asked with the same request. The re-ask now names the failing field paths (never values).
4. `claude-sonnet-5-5` answers HTTP 400 to a forced `tool_choice`; the adapter now falls back to `auto` (and remembers it, safe for concurrent calls).
5. Long analyses exceeded the 120 s provider timeout; a request can now carry `timeoutMs`, and the analysis asks for time proportional to its pages.

Results: claude-haiku-5-5 completed 2/7 bundles (it often returns a structurally wrong evidence bundle on the large schema; Anthropic strict tools are not usable because the schema has 27 nullable fields against a limit of 16 unions). claude-sonnet-5-5 completed 7/7 (12-15 form fields per bundle, 0-3 warnings). Spot check of one bundle against the images: all 8 identity fields (name, birth year, ID number, issue date and place, address, phone, stamp date) exactly right, including the red received-stamp. One semantic weak spot: the "date it happened" took the date of a survey extract; it is flagged "must confirm". Cost: about 100k output tokens per 3 bundles on Sonnet.
Browser UAT (04/11, Playwright + Chromium against a local backend/Vite and a scratch PostgreSQL cloned from the test schema, claude-sonnet-5-5, real scans, personal data never leaves the machine): the three create screens, the re-read and both admin screens were clicked through. Per screen: the scans upload, the reading takes 75-120 s, 9-12 fields are filled with a "from image, page N, quote" note, orange fields block Save until each is confirmed (0 record requests while blocked), undo is offered, Save creates the record, the session is bound and finalised, the 3 originals become `BAN_SCAN` documents of the record, and one outcome row per filled field is written (no values). Admin: the key test passes 5 steps, the key never comes back to the browser, the quality page shows kept 96.9% / edited 3.1% over 32 fields. The click-through found and fixed five defects no unit test could see (commits in `git log` after 9ff6d889): uploads sent as JSON so the server saw no file (`OCR_FILE_MISSING`); the visible letter-date box stayed empty under a "confirmed" badge; the re-read listed spacing/case/phone punctuation as differences; the incident duplicate check failed with HTTP 400 on a long name (96% of incident names exceed 255 characters); calls with an unknown cost left the budget cap looking safe. Not a defect, but to know: a Case still needs the officer to pick the legal source and type the title (not filled from the scan: Case `caseTitle` is a native field outside the layout, listed under M8 "NOT done").
Not done: golden-set scoring (a person must correct `golden.draft.json` against the images), Gemini Flash and OpenAI-compatible adapters on live APIs (no keys), production enablement (operator steps below). The scratch database `pc02_ocr_uat` (on 127.0.0.1:5433) and the scratchpad result files hold personal data from the real scans plus an encrypted provider key: drop the database and delete the scratchpad `real-results*`, `ui-*.png`, `tmp-ocr` when no longer needed. Recommendation for the admin screen: Haiku is too weak for evidence analysis on real scans; use Sonnet-class or Gemini Flash after the golden set passes.

## Blocker report (section 8b/8c)
1. **Problem.** The code is merged and live (PR #632 `cf638c86`, PR #633 `11a22b85`, production health `ok`, buildId `11a22b85`), but the 30 new petition search tags cannot find OLD petitions until their shadow columns are loaded. `deploy.sh` step 9e says so and ended the deploy RED on purpose: `petitions: CẦN NẠP - còn cột bóng NULL; dòng cũ lệch biểu thức hiện hành` (every other table: `đúng`). Loading them is a **write to the production database** (derived search columns only; batches of 1,000 rows; about 10 min for everything on a 47k-row copy).
2. **What was tried / ruled out.** Measured on a local copy of 47k real petitions: doing the load inside the migration took 312 s under locks (rejected; the project norm is the batch loader); a read-only production query was refused by the permission classifier earlier in this session, so no production access is assumed. The loader path is covered by the PostgreSQL spec (38 cases, in the CI database job) and was run end to end on the copy (`--kiem` exit 2 before, exit 0 after).
3. **Proposed handling.** Run the loader on production, then confirm `--kiem` is clean:
   ```
   cd /home/pc02/current/backend && set -a && source .env && set +a \
     && node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that
   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --kiem   # must exit 0
   ```
4. **Closed question for the user:** may the agent run that loader on production now (SSH `pc02vm`), or will you run it yourself? (Until it runs, existing tags and the plain "all columns" line behave exactly as before; only the 30 new tags miss old petitions.)

Also open: UAT (section 9) on the touched screens (Petition list search, hidden columns, export) was covered by gates and page tests but NOT run against production: the test accounts are locked since 2026-09-20 and the Chrome tools disconnected during this session. `STATUS` stays BLOCKED until the loader has run and a real search on production is confirmed.

## Done
- [x] M1-T1 PR1 generator (kind `so`, `nguonJson`) - #632 - patch coverage 100% (197/197).
- [x] M1-T2 PR #633: 30 tags, migration `20261103125717_tim_kiem_don_thu_moi_truong` (columns + triggers + indexes, no row rewrite), list/export columns, hidden-column enabling, shared select values, completeness gate, PostgreSQL spec, parity matrix entry.

## Verification
Backend `tsc` clean; backend full suite 9099 pass before the last gate fix, 1626 targeted pass after; PostgreSQL spec 38/38 on PG18 local AND green in the CI database job; frontend `tsc -b` clean, full suite 5654 pass (the one red was a 20 s load timeout that passes alone); lint 0 findings on changed lines; Codex review: one P2 (shared select values), fixed.

## Architecture decisions
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-11-03 | Extend the generator, no second filter system | one declaration drives migration, Prisma fields, UI keys | none |
| 2026-11-03 | Tag key `nhanXet` -> column `nhanThay` | the petition form translates `nhanXet -> nhanThay` | a wrong column would match 0 rows silently |
| 2026-11-03 | PR2 (backend) and PR3 (UI) merged | `timKiemCotKhai` and `khaiCotXuat` read across packages | one larger PR |
| 2026-11-03 | No `refreshExisting` for petitions | in-migration UPDATE 312 s under locks | loader after deploy; deploy flags it |
| 2026-11-03 | Long free text is tag-only (`vaoTatCa: false`) | in the combined shadow it made common terms 2-5x slower and doubled its index | Nhận xét/Đề xuất/ghi chú/căn cứ/phương thức via their tag only |
| 2026-11-03 | `metadata` dropped from the list payload | 1.6 KB/row of legacy text | 3 values lifted onto the row |
| 2026-11-03 | One shared table of select values | each screen kept its own copy | list, Restore, Export reports share it |

## Technical debt / risks
- Pre-existing lint errors left untouched in touched files (backend 72, mostly prettier in `petitions.service.ts`).
- `tuBang` shadow (crime name): a rename of the crime now refreshes the dependent petitions through `pc02_lan_toa_petitions_crimes` (migration `20261103161649_tim_kiem_lan_ten_toi_danh`); the rename scans `petitions` once, so only use `tuBang` for near-static tables.
- `loc-theo-the.ts` (browser-side filtering) has no number branch; no screen carries a number tag today.
- Table 470 -> ~663 MB, indexes 74 -> ~229 MB on the copy; single-row write trigger 1.8 -> ~7 ms.
- CCCD number, phone and address are now in the list payload and export (same permission and data scope as the detail page).
