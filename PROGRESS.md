# PROGRESS
Updated: 2026-11-03 | Epic: scan-image intake with LLM (Petition / Incident / Case) | Milestone: M1/10 | Task: spec written, PR1 starting

STATUS: IN_PROGRESS

Spec (approved design, reviewed + outside-reviewed): `docs/superpowers/specs/2026-11-03-nhap-tu-anh-scan-llm-design.md`.
Branch: `feat/nhap-tu-anh-scan-llm` (from `origin/main` `5e964b2f`). Working branch is local only; nothing pushed.

## Current work (autonomous)

Milestones follow the spec's delivery order (vertical slice first):

| # | Milestone | State |
|---|---|---|
| M1 | Contracts and foundations | DONE in code (commits 4e4b48ce, 91539819, 746f554a, 606fd969, c8ebbafb); full-suite run pending |
| M2 | LLM gateway + configuration, Anthropic adapter | DONE (backend 155 specs incl. PostgreSQL; admin screen 38 UI tests; full suites: backend 9183 pass, frontend 5702 pass, only load-timeout flakes that pass alone) |
| M3 | Vertical-slice pipeline (images) | IN PROGRESS: pure core DONE and run for real with Haiku (G1 transcribe, G2 analyse with versioned prompts, G3 deterministic projection, G4 checks; 119 specs). LEFT: persistence (sessions, pages, immutable revisions, job queue), original/derived image storage with sharp, atomic bind at save, HTTP API |
| M4 | Petition UI | queued |
| M5 | Golden set + scorer, run on the slice | queued |
| M6 | Gemini + OpenAI-compatible adapters, fallback chain | queued |
| M7 | PDF subsystem | queued |
| M8 | Incident + Case | queued |
| M9 | Re-read on saved records | queued |
| M10 | Quality + cost dashboard | queued |

BUOC TIEP THEO (next step): M3 DONE so far (all committed on the branch): sessions + immutable revisions, image storage with sharp, job queue (4c692b3c), read executor + runner + failure classifier + purge cron + `OcrImportModule` (7a6540bf), HTTP API under `/ocr/*` with `OcrIntakeService` (per-destination send permissions, 20 MB single-file upload, owner-only) (e0b9189c); permissions `use/sendInternal/sendCloud` on subject `OcrImport` seeded; DEPLOY.md section written. 186+ ocr-import and 123 llm specs green, DB specs in the CI Database Gate list. LEFT in M3: (1) `ocrPhienId` + `ocrPhienBan` on the three create DTOs (Petition/Incident/Case), atomic bind inside the create transaction (owner, same entity, current fingerprint, not yet bound; set boundRecordId + status BOUND) and a durable finalisation job that copies originals into `Document` (type BAN_SCAN, sha256) after commit + orphan sweeper; a research agent was asked (03/11) to map the create flows and Document storage. (2) Grant-by-role decision for `use:OcrImport` is left to the role screen (documented). Then M4 (Petition UI).
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
