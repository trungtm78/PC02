# PROGRESS
Updated: 2026-11-03 | Milestone: M1/1 (Petition list: search every field that holds data) | Task: 2/2 DONE in code, release step pending

STATUS: BLOCKED

Previous work: Case governance is DONE (PR #503 merged 2026-10-08, UAT 856/856 PASS). Its 2026-10-07 snapshot is in git history (`git log -- PROGRESS.md`).

Spec and measured decisions: `docs/superpowers/specs/2026-11-03-don-thu-tim-moi-truong-design.md`.

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
- `tuBang` shadow (crime name) goes stale if a crime is renamed until reloaded.
- `loc-theo-the.ts` (browser-side filtering) has no number branch; no screen carries a number tag today.
- Table 470 -> ~663 MB, indexes 74 -> ~229 MB on the copy; single-row write trigger 1.8 -> ~7 ms.
- CCCD number, phone and address are now in the list payload and export (same permission and data scope as the detail page).
