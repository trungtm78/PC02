# Petition all-column search verification

Original spec: ../../superpowers/specs/2026-09-27-petition-all-column-search-design.md

## Feature results

- RED: five missing-column regressions failed before implementation. Transactional replacement regression also failed before generator changes.
- Isolated PostgreSQL: stale non-null aggregates refreshed; business timestamps unchanged; subsequent information-type updates reflected in shadows.
- API-first UAT: 26 API cases + one browser case containing steps for all 21 searchable list values and suggestion/hide-column/export behavior: 27/27 PASS, retries 0, 0 cached.
- Backend full suite: 436 suites, 6046 assertions PASS. The final detectOpenHandles run exited 0 with no open-handle warning; existing SSE test subscriptions are now cleaned up.
- Frontend full suite: 3966 assertions PASS. Focused list/registry coverage: 70 assertions PASS.
- Existing engine suite: 44/44 PASS.
- Backend build/type-check and frontend build: PASS. Frontend build retains existing bundle-size/Browserslist warnings.
- Patch coverage: 100% (5/5 instrumented executable changed lines, Istanbul line mapping). Registry/column metadata are declarative; their changed entries are validated by registry/schema parity gates and live API/UI UAT, not misreported as instrumented lines.

## Review and alignment

Independent in-host review initially found non-atomic trigger replacement, isolated UAT leaking into default discovery, and missing acceptance scenarios. All were corrected; second source review: NO_FINDINGS. Migration now replaces triggers and refreshes stale petition shadows in one transaction; UAT lives in qa/petition-search with separate artifacts.

Alignment with original spec: all list data columns including hidden, Enter/suggestion interaction, accent folding, date precision, shared list/statistics/export filtering and restricted-user scope are represented in persistent tests. Only information type adds an API chip key; tk/search formats remain compatible. No production deployment.

Cross-model Claude Code runner did not complete: `Claude Code timed out after 180000ms.` CLI installation/auth metadata was checked; a configured API auth source takes precedence. Missing cross-model coverage is not treated as a clean review.

## Outstanding protocol gates

- Repository lint: backend reported 11008 errors/721 warnings; frontend reported 188 errors/29 warnings. Changed backend search files pass lint. The petition page has the same two hook-dependency warnings as HEAD; no new warnings. A repository-wide cleanup exceeds this feature's scope.
- Default Playwright discovery: 5559 tests across 209 files. Initial full-suite attempts stopped at TC-CASE-001 with `HTTP 401 — expected [200,201]`; 5558 not executed. Investigation found legacy specs independently load tests/.env.test, whose BASE_URL is non-loopback, even when UAT_PROD is off. Those initial attempts therefore did not establish local full-suite results; no successful operation was shown. Subsequent attempts explicitly pin BASE_URL/API_BASE_URL to loopback and use only a fresh local fixture token. Setting UAT_PROD='0' exposed a separate existing setup truthiness mismatch (the global setup treats it as enabled); using an empty value avoids that mismatch. The final explicitly loopback-pinned attempt then failed TC-CASE-001 with HTTP 403 because the feature fixture has petition-read permissions, while that whole-app case requires case-create permissions; 5558 tests did not run. Do not report the full Playwright suite as passing or rerun it without explicit loopback targets.
- Historical production UAT remains outside scope and was preserved in PROGRESS.md.

Feature verification passes, but overall protocol status is NOT DONE until the outstanding gates are addressed.

## Reproduction

Use only an isolated loopback PostgreSQL database named petition_search_test on port 55439 with user petition_test. Initialize it under the ignored test-results/petition-local/pgdata directory. From backend, set DATABASE_URL to that database, run `npx prisma db push`, `npx prisma generate`, then `node scripts/petition-search-uat-fixture.cjs`. The script creates random local test credentials and RSA keys only in ignored artifacts.

Start backend on localhost:3000 using that DATABASE_URL and the generated private.pem/public.pem through JWT_PRIVATE_KEY_PATH/JWT_PUBLIC_KEY_PATH; start Vite on 5179. Run `node node_modules/@playwright/test/cli.js test --config=playwright.petition-search.config.ts` from the repository root. Keep its dedicated outputDir; never run unrelated Playwright commands with their default output directory while the isolated runtime artifacts are there.

Logs and trace artifacts are in test-results/petition-local and test-results/petition-search-artifacts; they are ignored and must not be committed because auth traces contain ephemeral tokens.
