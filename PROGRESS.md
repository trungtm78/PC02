# PROGRESS
Updated: 2026-11-04 | Epic: scan-image intake with LLM (Petition / Incident / Case) | Milestone: M1-M10 built, review fixes applied | Task: waiting on a working LLM API key for real-data UAT and golden scoring

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

BUOC TIEP THEO (next step): everything buildable without a live key is built, reviewed by Codex three times and fixed; full backend suite 9661 pass (before the last two commits, which re-ran their own suites green: ocr-import 299, frontend 1426 in the touched areas). REMAINING: (1) a WORKING API key (the `ANTHROPIC_API_KEY` in this shell is rejected with HTTP 401 again on 04/11; no Gemini or OpenAI key) -> run `scratchpad/probe-real.cjs` or `npm run ocr:danh-gia -- --dir qa/ocr --out <outside repo> --init-golden` (24 real files in `qa/ocr`, personal data, gitignored, never commit or paste), review transcripts against the images, have a person correct `golden.draft.json`, score; (2) UAT matrix on the real bundles through the three create screens in a browser and the re-read on a saved record; (3) operator steps below (key ring env, transfer assessment, flag, role grants, `sharp` and the PDF worker asset in the deploy bundle); (4) one monkey test at the very end.
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

## Blocker report: scan-image intake (section 8b/8c)
1. **Problem.** Real-data UAT and golden-set scoring on the 24 scans in `qa/ocr` need a live model call, and no working key exists in this environment: `ANTHROPIC_API_KEY` is present but Anthropic answers HTTP 401 (checked 04/11), and there is no Gemini or OpenAI key. Everything else in the epic is built and tested; the feature stays OFF in production by design.
2. **What was tried / ruled out.** The key was re-tested against `GET /v1/models` (401). The image path was verified on the real scans without a model (type sniffing, EXIF strip, derivative). A fake provider would only exercise the screens, not the reading of real handwriting, so it would not count as the UAT the owner asked for.
3. **Proposed handling.** Owner supplies a valid key (Anthropic for the tests the owner named, Gemini Flash for production), passed per command via `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`, never stored. Then: run the scorer on `qa/ocr`, correct `golden.draft.json` by eye, click through Petition / Incident / Case and the re-read. Rotate the key pasted in chat on 03/11.
4. **Closed question for the user:** can you provide a working API key for a one-off test run (and confirm a person will correct the golden answers against the images)?

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
