# Mobile E2E — Maestro flows

End-to-end tests for the PC02 Flutter app, driving a real Android emulator
against a real backend with the test-fixtures module enabled. Designed to
catch the bugs that unit tests + widget tests cannot: contract drift between
mobile and backend, navigation race conditions, and state-machine regressions
across the auth flow.

## What's tested

| File | Scenario | Catches |
|---|---|---|
| `01-normal-login.yaml` | Happy-path login → dashboard | Smoke / API URL config regressions |
| `02-login-2fa.yaml` | Login → 2FA OTP → dashboard | FCM init after OTP (BUG-1) |
| `03-first-login-change-password.yaml` | Login with temp pw → forced change → dashboard | **Codex C1 CRITICAL** — discriminated union for `pending: true` + `reason: 'MUST_CHANGE_PASSWORD'` |
| `04-post-otp-forced-change.yaml` | Login + 2FA → forced change → dashboard | **Codex C2 CRITICAL** — `verify2fa()` result sealed type (pre-fix crashed on missing accessToken) |
| `05-stale-token-409-superseded.yaml` | Admin re-resets mid-flow → 409 → toast + login | **Codex C7 + Claude F2** — stale token UX, no silent catch |

## Stable selectors over Vietnamese label matching

Every interactive auth widget is wrapped in `Semantics(identifier: ...)`. The
identifiers live in [`lib/core/testing/maestro_keys.dart`](../lib/core/testing/maestro_keys.dart).
Flows match by `id: "..."` rather than `text: "..."` so:

1. Localization edits (e.g., changing "Đăng nhập" copy) don't break flows.
2. Ambiguous duplicates (the same text appearing on multiple screens) become a
   non-issue — identifiers are globally unique.
3. The contract between flows and screens is *explicit* — if you delete a
   Semantics widget the flow fails fast with "element not found".

To add a new flow:
1. Add a new constant in `MaestroKeys`.
2. Wrap the widget: `Semantics(identifier: MaestroKeys.fooBar, child: ...)`.
3. Use `tapOn: id: "foo-bar"` in the YAML.

## Running locally

### Prereqs

```bash
# 1. Install Maestro CLI
curl -fLsS "https://get.maestro.mobile.dev" | bash

# 2. Boot any Android emulator (e.g., from Android Studio or `flutter emulators`).

# 3. Build a debug APK that points at your local backend.
cd mobile
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
adb install -r build/app/outputs/flutter-apk/app-debug.apk

# 4. Start backend with E2E_TEST_MODE on.
cd ../backend
export E2E_TEST_MODE=true
export TEST_SEED_TOKEN=$(openssl rand -hex 32)
export DATABASE_URL=postgresql://...   # your local DB
npm run start:dev
```

### Run flows

```bash
# All flows in order
export MAESTRO_API_BASE_URL=http://10.0.2.2:3000/api/v1
export MAESTRO_TEST_SEED_TOKEN="$TEST_SEED_TOKEN"
maestro test mobile/.maestro/flows/

# Single flow
maestro test mobile/.maestro/flows/03-first-login-change-password.yaml

# With Maestro Studio (interactive selector inspector — useful when adding flows)
maestro studio
```

### Cleanup test users

```bash
curl -X DELETE \
  -H "x-test-seed-token: $TEST_SEED_TOKEN" \
  http://localhost:3000/api/v1/test/e2e-users
```

## CI

`.github/workflows/mobile-e2e.yml` runs the full suite on every push to
`feat/mobile-**` branches and on PRs touching `mobile/` or `backend/src/auth/`
+ `backend/src/test-fixtures/`. The workflow:

1. Spins up a PostgreSQL service container and applies Prisma migrations.
2. Generates a fresh `TEST_SEED_TOKEN` per job (never reused, never leaked).
3. Starts the backend with `E2E_TEST_MODE=true`.
4. Builds a debug APK with the right `API_BASE_URL`.
5. Boots `api-level: 34` Android emulator via `reactivecircus/android-emulator-runner`.
6. Installs the APK and runs `maestro test` with JUnit output.
7. Uploads JUnit XML + Maestro debug artifacts (screenshots, recordings).

Runtime: ~12-15 min cold, ~6 min warm (AVD cached).

## Security model — test-fixtures endpoint

The `/api/v1/test/seed-user` endpoint exists ONLY when:
1. `E2E_TEST_MODE === 'true'` env (production deploys never set this).
2. The `X-Test-Seed-Token` header matches `TEST_SEED_TOKEN` env (constant-time compare).
3. The seeded email matches `^e2e\+[a-z0-9_-]+@test\.pc02\.local$` (no real users touchable).

When `E2E_TEST_MODE` is unset, the controller is NOT registered — routes
return 404, confirming nothing about whether the feature exists.

`TestFixturesModule.forRoot()` is the single conditional. `git grep TestFixtures`
finds only the test-fixtures/ directory and one line in `app.module.ts` — easy
to audit.

Guard tests live at [`test-mode.guard.spec.ts`](../../backend/src/test-fixtures/guards/test-mode.guard.spec.ts).

## Adding a new flow

1. Identify the user journey + the bug it catches. If the bug doesn't have a
   regression test name yet, write one — be specific so future readers can
   grep for it.
2. Reuse existing `MaestroKeys`. If a new screen needs identifiers, add them
   to that file with naming convention `<screen>-<element>`.
3. Start flow with `evalScript` calling `/test/seed-user` to arrange state.
4. Use `launchApp: clearState: true` so each flow starts isolated.
5. Selectors: `id: "..."` (Semantics identifier), NOT `text: "..."`.
6. Assertions: `assertVisible` + `assertNotVisible` — both prove the
   navigation went where you intended.
7. Add the new file to `config.yaml` `flowsOrder` if order matters
   (typically yes — earlier flows seed cheaper state).

## Known limitations

- **Disabled-button state not asserted.** Flutter's `Semantics(enabled: false)`
  *does* propagate but Maestro currently has no first-class "is disabled"
  matcher. We work around by asserting downstream behavior (clicking the
  submit button on an invalid form should NOT navigate).
- **Per-rule strength state.** `Semantics(value: 'passed' / 'pending')` is set
  but Maestro 1.x doesn't have a stable matcher for the `value` field. We
  assert the rules are *visible* on screen; visual diff for state would
  require Maestro Cloud's screenshot comparison.
- **FCM push delivery.** Flow 02 doesn't assert a real push — Firebase test
  delivery to emulator requires FCM-on-emulator setup. Deep-link routing
  (BUG-2) is covered by widget tests, not E2E.
