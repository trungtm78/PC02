# tests/e2e-new

End-to-end specs that run in CI, kept separate from the 182 legacy specs under
`tests/e2e`, `tests/api` and `tests/uat-auto`.

## Why a separate directory

The legacy suite cannot be switched on as-is:

- `tests/uat-auto` (113 files, ~781 cases) asserts
  `expect([200, 201, 401, 403, 404]).toContain(res.status())` — a 401 or a 404
  passes, so a broken deployment scores green.
- `tests/api/cases-uat.api.spec.ts:70` calls `test.skip()` from the catch block
  around a network error, which turns "backend is down" into "test skipped".
- Several specs have rotted against the current UI: `objects-routing.e2e.spec.ts`
  uses port 5173 (config says 5179), `input[type="email"]` (the login field is
  `type="text"`) and testids that no longer exist.

Triaging that suite is worth doing, but it is its own task. Gating merges on it
today would gate them on noise.

## What belongs here

Specs for flows where a failure is silent and expensive — the class of bug unit
tests cannot see, because each piece works and only the seam is wrong:

| Flow | Why it needs a browser |
|---|---|
| Role permission matrix | The grid rendered all-false and Save persisted that. Every unit involved behaved correctly. |
| Sidebar for a non-admin | A feature-flag/manifest mismatch empties the menu for a whole role, with no error anywhere. |
| Evidence survives a case edit | The API returns 200 while the sub-entities are dropped. |
| Duplicate-petition decision | Must still be there after a reload. |
| Record return | Same — the modal used to report success and persist nothing. |
| Notification fan-out | Emitter and handler are tested separately; the wiring between them is not. |

## Running

This directory has no specs yet, and Playwright exits non-zero on a project
that matches nothing — hence `--pass-with-no-tests` below, and hence CI does
not run this project yet. Drop both once the first spec lands.

```bash
# against the local dev servers playwright.config.ts starts for you
npx playwright test --project=e2e-new --pass-with-no-tests

# against a deployed environment.
# UAT_PROD goes in the shell, not in the file: playwright.config.ts reads it to
# decide whether to load tests/.env.test at all.
cp tests/.env.test.example tests/.env.test   # then fill it in
UAT_PROD=1 npx playwright test --project=e2e-new --pass-with-no-tests
```

## Conventions

- One spec per flow, named after the flow, not the page.
- Reuse the page objects in `tests/pages/`.
- Assert on what the user ends up seeing, never on a status code alone — the
  legacy suite's central mistake.
- No credential or host defaults. Read them from the environment and fail loudly
  when they are missing.
