# PROGRESS
Updated: 2026-11-03 | Milestone: M1/1 (Petition list: search every field that holds data) | Task: 1/3 (PR1 generator)

Previous work: Case governance is DONE (PR #503 merged 2026-10-08, UAT 856/856 PASS). Its 2026-10-07 snapshot lived in this file and is preserved in git history (`git log -- PROGRESS.md`).

Spec: `docs/superpowers/specs/2026-11-03-don-thu-tim-moi-truong-design.md`. Approved plan: `C:\Users\Than Minh Trung\.claude\plans\t-i-m-n-h-nh-danh-twinkling-acorn.md`.

## Done
- [x] M1-T1 PR1 generator: kind `so` + `nguonJson` (JSON-backed fields) - branch `feat/tim-kiem-kieu-so-va-nguon-json` - patch coverage 100% (189/189) - review/codex checkpoint pending

## In progress
Task: M1-T1 PR1 - checkpoint (full backend suite, /review, /codex, commit, PR)
Done: generator (`sinh-tim-kiem.ts`), condition builder (`dieu-kien.ts`), schema-drift gates (`tep-sinh.ts`), spec `nguon-json-va-so.spec.ts` (31 cases), regenerated `frontend/src/shared/tim-kiem/generated.ts` (union gains `'so'`), design doc.
NEXT STEP: run full backend + frontend suites, then /review and /codex on the diff, fix findings, commit (Conventional Commits, English), push, open PR, wait for CI, merge, verify deploy.
Related files: `backend/src/common/tim-kiem/{dieu-kien.ts,sinh/sinh-tim-kiem.ts,sinh/tep-sinh.ts,sinh/nguon-json-va-so.spec.ts}`.

## Next tasks
1. M1-T2 PR2 backend: declare the 30 fields in `khai/don-thu.khai.ts`, `npm run gen:tim-kiem` (new migration), add columns + `crimeChinh`/`metadata` to `CHON_DONG_DANH_SACH_DON_THU` (`petitions.service.ts`), completeness gate `petitions/form-don-thu-tim-duoc.gate.spec.ts` reusing `COT_XUAT_DAY_DU_LOAI_TRU`, PostgreSQL gate tests, migration/write timing numbers. Must first measure the real JSON date format of `ngayKhoiTo` / `ngayQDPhanCongNguonTin` (ISO date vs ISO timestamp vs dd/mm/yyyy) on local seeded data and the legacy mapper.
2. M1-T3 PR3 frontend: 30 hidden columns in `PetitionListPageShell.tsx`, "Hidden columns" group in `OTimKiemThe` that enables the column, `GIA_TRI_CHON_DON_THU` (huongXuLy, laCongNgheCao), client-side `loc-theo-the` handling of `so`.
3. Final: `UAT-COVERAGE.md` matrix + UAT per row, then set `STATUS: ALL_MILESTONES_DONE`.

## Update 2026-11-03 (later): PR1 merged (#632, deployed buildId cf638c86). PR2 and PR3 MERGED INTO ONE PR
Reason: two cross-package gates make them inseparable - `timKiemCotKhai` (frontend) needs a list column for EVERY declared tag key, and `khaiCotXuat` (frontend reads `backend/src/petitions/xuat-danh-sach-don-thu.ts`) needs an export column with the same key as every list column. Declaring 30 tags without the 30 columns (or the reverse) turns `main` red.
Branch: `feat/don-thu-tim-moi-truong`. Backend done (khai, migration `20261103125717_tim_kiem_don_thu_moi_truong`, schema fields, list select + crime-name lookup, 30 export columns, completeness gate, PostgreSQL spec 37/37 on PG18 local, CI job updated). NEXT STEP: frontend - 30 hidden columns in `PetitionListPageShell.tsx`, "Hidden columns" suggestion group in `OTimKiemThe`, `GIA_TRI_CHON_DON_THU`, client-side `so` in `loc-theo-the.ts`; then measurements (migration time, write cost, search timings on `pc02_that` copy), full suites, review, PR.

## Architecture decisions
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-11-03 | Extend the generator (no second filter system) | `feedback_mo_rong_primitive_khong_dung_he_thu_hai` | one declaration drives migration, Prisma fields, UI keys |
| 2026-11-03 | Tag key `nhanXet` -> column `nhanThay` | form translates `nhanXet -> nhanThay` for petitions | wrong column would match 0 rows silently |
| 2026-11-03 | JSON date shadow = ISO text, range compare, no index | planner ignored btree on date ranges (measured earlier) | no write-cost index |
| 2026-11-03 | `so` kind excluded from the "all columns" box | typing `5` must not match every 5-victim record | numbers are searchable only through their own tag |

## Assumptions decided
| Ambiguity | Interpretation | Basis |
|---|---|---|
| "add missing fields" | only fields holding data on production (0-row fields stay out, already listed in `cot-xuat-day-du.loai-tru.ts`) | user chose "every field with real data" |
| Hidden-column suggestions | group "Hidden columns", choosing enables the column | user chose "suggest hidden columns too" |
| `1.5` typed in a number tag | decimal 1.5 (cannot be a thousands group); `1.500` = 1500 | Vietnamese number format |

## Test status
Backend full suite: 9081 pass, 3 failures in `period-export.spec.ts` / `monthly-report-export.service.spec.ts` caused by machine load (158 s run); both suites pass in isolation (43/43). Backend `tsc`: clean. Frontend `tsc -b`: clean. Patch coverage PR1: 197/197 = 100%. Review: checklist pass found and fixed one real bug (JSON date shadow column not hidden from API payloads in `cot-bong-an.ts`, test seeded-red verified); Codex review: no actionable regressions. Frontend full suite: running.

## Technical debt / risks
- 3 prettier errors already present on `main` in `dieu-kien.ts` (2) and `tep-sinh.ts` (1); left untouched to keep the diff minimal.
- JSON text/date fields have no source-column fallback (virtual column): rows with an unloaded shadow do not match them. Mitigated by the migration backfill.
- `tuBang` shadow (crime name) goes stale if a crime is renamed until the shadow is reloaded.
- Prod read access is blocked for the agent: real-data measurements (JSON date format, fill rates) use the existing prod measurements recorded in `cot-xuat-day-du.loai-tru.ts` plus local data; anything else needs the user's permission.
- Deploy of PR2 rewrites ~48k petition rows and adds ~20 trigram indexes: measure and schedule outside peak hours.
