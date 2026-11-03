# PROGRESS
Updated: 2026-11-03 | Milestone: M1/1 (Petition list: search every field that holds data) | Task: 2/2 (combined backend+UI PR)

Previous work: Case governance is DONE (PR #503 merged 2026-10-08, UAT 856/856 PASS). Its 2026-10-07 snapshot lived in this file and is preserved in git history (`git log -- PROGRESS.md`).

Spec: `docs/superpowers/specs/2026-11-03-don-thu-tim-moi-truong-design.md` (includes the measured decisions). Approved plan: `C:\Users\Than Minh Trung\.claude\plans\t-i-m-n-h-nh-danh-twinkling-acorn.md`.

## Done
- [x] M1-T1 PR1 generator: kind `so` + `nguonJson` - PR #632 merged, deployed (buildId cf638c86) - patch coverage 100% (197/197).

## In progress
Task: M1-T2 combined PR `feat/don-thu-tim-moi-truong` (PR2 backend + PR3 UI merged into one: gates `timKiemCotKhai` and `khaiCotXuat` read across packages, so tags without columns turn `main` red).
Done: 30 tags in `khai/don-thu.khai.ts`; migration `20261103125717_tim_kiem_don_thu_moi_truong` (columns + triggers + indexes, NO row rewrite); read-only fields in `schema.prisma`; list select + prosecution fields lifted out of `metadata` (metadata dropped from the payload) + one crime-name lookup per page; 30 export columns; 30 hidden list columns; select values for Hướng xử lý / Công nghệ cao; `OTimKiemThe.onChonTruongAn` switches a hidden column on; number validation in the UI (`laGiaTriSo`); completeness gate `form-don-thu-tim-duoc.gate.spec.ts`; PostgreSQL spec `tim-kiem-moi-truong.database.spec.ts` (38 cases, added to the CI database job).
Verification so far: backend `tsc` clean, backend full suite 9099 pass + 1 gate fixed since (`cot-danh-sach-phai-duoc-tra-ve` now lists the three flattened fields), 1626 targeted pass, 38/38 on PG18; frontend `tsc -b` clean; lint on changed lines 0 (backend and frontend).
NEXT STEP: finish the full frontend suite (running in background, result in `$TEMP/full-fe-pr2.txt`), then /review and /codex on the diff, commit, push, open PR, wait for CI, merge, deploy. AFTER DEPLOY the shadow columns of existing rows must be loaded: `cd /home/pc02/current/backend && set -a && source .env && set +a && node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that` (deploy.sh step 9e will end RED until then - expected, documented). This is a production write: needs the user's go (the agent's prod access is blocked).
Related files: `backend/src/common/tim-kiem/**`, `backend/src/petitions/**`, `frontend/src/pages/petitions/PetitionListPageShell.tsx`, `frontend/src/components/shared/ListPageShell/OTimKiemThe.tsx`.

## Next tasks
1. Post-deploy: run the batch loader on production (needs user's go), verify `--kiem` is clean and a real search on prod.
2. Final: `UAT-COVERAGE.md` matrix for the touched screens (Petition list search/columns/export) + UAT per row, then set `STATUS: ALL_MILESTONES_DONE`.

## Architecture decisions
| Date | Decision | Reason | Impact |
|---|---|---|---|
| 2026-11-03 | Extend the generator, no second filter system | `feedback_mo_rong_primitive_khong_dung_he_thu_hai` | one declaration drives migration, Prisma fields, UI keys |
| 2026-11-03 | Tag key `nhanXet` -> column `nhanThay` | the petition form translates `nhanXet -> nhanThay` | a wrong column would match 0 rows silently |
| 2026-11-03 | JSON date shadow = ISO text, range compare, no index | planner ignored btree on date ranges (measured earlier) | no write-cost index |
| 2026-11-03 | `so` kind excluded from the "all columns" box | typing `5` must not match every 5-victim record | numbers only through their own tag |
| 2026-11-03 | PR2+PR3 merged | cross-package gates (see above) | one larger PR |
| 2026-11-03 | NO `refreshExisting` for petitions | migration UPDATE of 47k rows took 312 s holding locks; loader exists | migration ~seconds; rows loaded in batches after deploy |
| 2026-11-03 | Long free text is tag-only (`vaoTatCa: false`) | in the combined shadow it made common terms 2-5x slower and doubled its index | Nhận xét/Đề xuất/ghi chú/căn cứ/phương thức searchable via their tag, not from the plain "all columns" line |
| 2026-11-03 | Drop `metadata` from the list payload after lifting 3 values | 1.6 KB/row of mostly legacy text | smaller payload; columns read flat fields |

## Assumptions decided
| Ambiguity | Interpretation | Basis |
|---|---|---|
| "add missing fields" | only fields holding data on production (0-row fields stay out, listed in `cot-xuat-day-du.loai-tru.ts`) | user chose "every field with real data" |
| Hidden-column suggestions | existing "Cột khác" group + choosing enables the column | user chose "suggest hidden columns too" |
| `1.5` typed in a number tag | decimal 1.5 (cannot be a thousands group); `1.500` = 1500 | Vietnamese number format |
| JSON date format | `yyyy-mm-dd` (form) or ISO timestamp at UTC midnight (migration mapper); anything else -> NULL, not searchable | form `<input type=date>`, `legacy-mapper.ts` |

## Test status
Backend full suite (before the last gate fix): 9099 pass / 1 fail (fixed). Backend targeted after fix: 1626 pass. PostgreSQL spec 38/38 (PG18 local). Frontend `tsc -b` clean. Frontend full suite: running. Patch coverage: PR1 100%; combined PR measured at checkpoint.

## Technical debt / risks
- Pre-existing lint errors left untouched (backend 72 across the touched files, mostly prettier in `petitions.service.ts`): the diff only touches lines it needs.
- Until the batch loader runs after deploy: old petitions are NOT found by any of the 30 new tags (the combined `tim_kiem_bd` is stale-but-non-NULL, so the server does not fall back to the source columns), and the plain "all columns" shadow lacks the new short fields for old rows. Existing tags and the plain line are unaffected. Pinned by the PostgreSQL spec; `deploy.sh` step 9e ends red until the loader has run.
- `tuBang` shadow (crime name) goes stale if a crime is renamed until reloaded.
- `loc-theo-the.ts` (client-side filtering) has no `so` branch; no screen carries a number tag today.
- Prod read/write access is blocked for the agent: the loader and any prod verification need the user.
- Disk: petitions table 470 -> ~663 MB, indexes 74 -> ~229 MB; single-row write 1.8 -> ~7 ms (local copy).
