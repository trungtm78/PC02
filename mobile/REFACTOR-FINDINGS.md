# Mobile Refactor — Findings & Deferred Items

**Branch:** `refactor/mobile-source-quality`
**Started:** 2026-05-08
**Approach:** pure refactor, zero behavior change — observable behavior of running app must remain identical for all valid inputs.

This document catalogs:
1. ✅ Refactors landed in this session (commits + verification status)
2. 📋 Latent bugs found during audit (recommended fixes — out of scope; user decides)
3. 🚧 Deferred refactor phases (designs ready, not yet implemented)
4. 📊 Performance hotspots (not addressed — assessment only)

---

## ✅ Landed in this session

### Commit `8ec4300` — Phase 1: Centralize API providers
- Created `lib/core/api/providers.dart` as single source of truth for 10 providers (`apiClientProvider`, `tokenStorageProvider`, `authApiProvider`, `casesApiProvider`, `dashboardApiProvider`, `devicesApiProvider`, `incidentsApiProvider`, `notificationsApiProvider`, `petitionsApiProvider`, `settingsApiProvider`).
- Removed inline declarations from `auth_provider.dart`, `dashboard_screen.dart`, `notifications_screen.dart`, `deadline_settings_provider.dart`, `fcm_service.dart`.
- Updated 12 consumer files to import from `providers.dart` instead of `dashboard_screen.dart` (cross-feature dependency smell).
- **Verification:** `flutter analyze` 28 → 27 issues (one fewer unused import); `flutter test` 53 pass / 1 fail (pre-existing `petitions_api_test.dart` mock issue, not introduced).

### Commit `9baef67` — Phase 6: Force-unwrap hardening (deadline)
- `Case.isOverdue`, `Case.daysUntilDeadline`, `Incident.*`, `Petition.*`, `DeadlineBadge.build`: replaced `deadline!.X()` after a null check with local capture pattern `final d = deadline; ... d.X()`.
- Identical bytecode/behavior; clearer intent.
- **Verification:** analyze 27 issues (unchanged), test 53 pass / 1 fail (unchanged).

### NOT changed (force-unwraps that are intentionally idiomatic)
- `api_client.dart:55,95,100` — `_refreshCompleter!.X()` guarded by `_isRefreshing` flag.
- `main.dart:93,104,115` — `state.pathParameters['id']!` guaranteed by GoRouter `:id` path matcher.
- `login_screen.dart:48` — `_formKey.currentState!.validate()` standard Flutter form pattern.
- `auth_provider.dart:96` — `state.pendingTwoFaToken!` guarded by 2FA flow precondition.

---

## 📋 Latent Bugs (recommended fixes — separate commits)

### BUG-1 (high) — 2FA login path doesn't initialize FCM
**File:** `lib/features/auth/login_screen.dart:62-64,124-125`
**Symptom:** `fcmServiceProvider.init()` is called only on the email/password success path. The 2FA verification path goes through `auth_provider._finalize()` → `state = AuthState(isAuthenticated: true)` → router redirect to `/`, but FCM is never registered. Affected users won't receive push notifications until they kill+reopen the app.
**Recommended fix:** Move FCM init from `login_screen.dart` into `AuthNotifier._finalize()` so all login paths register devices uniformly.
**Why it's not in this PR:** Phase 4 (FCM/auth decouple) is an explicit behavior change.

### BUG-2 (medium) — `NotificationRouter.init()` never called
**File:** `lib/core/fcm/notification_router.dart`
**Symptom:** `NotificationRouter` declares `init(GoRouter router)` for deep-linking from push notifications. `main.dart` builds the router (line 60) but never wires it to the notification router. Tapping a notification while app is backgrounded does nothing.
**Recommended fix:** Add `NotificationRouter.init(router)` after router construction in `_PC02App.build` or in `_AppInit.build`.

### BUG-3 (medium) — `LogoutNotifier` couples auth to devices API
**File:** `lib/core/auth/auth_provider.dart:117-120`
**Symptom:** `AuthNotifier.logout()` calls `_devicesApi.unregister(fcmToken)` — auth knows about device-registration. If `DevicesApi` contract changes, auth breaks. Coupling violation.
**Recommended fix:** Move `unregister` call into `FcmService.cleanup()`; auth invokes via callback. Pairs with BUG-1 fix (Phase 4).

### BUG-4 (medium) — 14 silent `catch (_) {}` swallow exceptions
| File | Line | Context |
|------|------|---------|
| `main.dart` | 31 | Firebase init timeout — currently ignored silently |
| `login_screen.dart` | 64, 125 | FCM init failure |
| `auth_provider.dart` | 87, 99, 120 | Login throw, 2FA throw, device unregister fail |
| `api_client.dart` | 99 | Refresh token call failure |
| `biometric_service.dart` | 17 | Biometric authentication error |
| `notifications_screen.dart` | 102 | Mark-read API failure |
| `case_detail_screen.dart` | 31, similar in incident/petition | Detail-fetch exception in display layer |
| `deadline_settings_provider.dart` | 14 | Settings fetch failure |
| `notification_router.dart` | (multiple) | Future not awaited |

**Recommended fix:** Add a `core/logging/log.dart` thin wrapper (`debugPrint` in debug, no-op in release). Each swallowed exception either gets a log call or a justification comment. Each fix is a separate commit.

### BUG-5 (low) — Hardcoded API URL
**File:** `lib/core/api/api_client.dart:5-8`
**Symptom:** Default for `--dart-define API_BASE_URL` is `http://10.0.2.2:3000/api/v1`. Production build with no `--dart-define` will hit emulator-only address.
**Recommended fix:** Either keep `--dart-define` discipline (require build-time arg) or read from config file/build flavor. Document the requirement in README.

### BUG-6 (low) — Detail screens cast nested fields without null check
**Files:**
- `case_detail_screen.dart:69` — `(c['investigator'] as Map)['fullName']`
- `incident_detail_screen.dart:66` — same pattern
- `petition_detail_screen.dart:65` — same pattern

**Symptom:** If response payload has `investigator: null` (no investigator assigned), the `as Map` cast crashes with `TypeError`. Currently no UI test covers this path.
**Recommended fix:** `(c['investigator'] as Map?)?['fullName'] as String? ?? ''` — null-safe chain.
**Note:** Could be addressed by Phase 3 (typed JSON helpers) if migrated to the new helper API.

### BUG-7 (low) — `flutter_local_notifications` package unused
**File:** `pubspec.yaml`
**Symptom:** Package declared but no `import 'package:flutter_local_notifications'` in lib/. Dead dependency.
**Recommended fix:** Remove from pubspec or implement local notifications properly (likely needed for FCM display when app is foreground).

### BUG-8 (low) — `_unreadCountProvider` declared but never referenced
**File:** `lib/features/notifications/notifications_screen.dart:18`
**Symptom:** `flutter analyze` warning: declaration isn't referenced.
**Recommended fix:** Either wire it up to a badge UI or remove.

### BUG-9 (low) — `_semanticsHandle` declared but never referenced
**File:** `lib/main.dart:22`
**Symptom:** Top-level field assigned in `main()` to keep semantics enabled, but never read anywhere → analyzer flags as unused. Field IS still doing its job (anchoring the SemanticsHandle so it isn't GC'd), so removing it would actually break Maestro testing in debug mode.
**Recommended fix:** Add `// ignore: unused_element` with justification comment — this is intentional.

---

## 🚧 Deferred Refactor Phases

### Phase 0.3 — Golden screenshot tests (deferred)
**Why deferred:** Requires real device/emulator setup and `flutter test --update-goldens` per platform. On Windows, golden tests can have OS-specific font rendering. Recommended to defer until CI runs goldens on a stable Linux environment.
**Recommended next:** Add 5 stable widgets first: `StatusChip`, `DeadlineBadge`, `EmptyState`, `OfflineBanner`, `_StatCard` (extracted from `dashboard_screen.dart`).

### Phase 0.4 — Maestro flow recreation (partial)
**Why partial:** Earlier UAT report at `.gstack/qa-mobile-reports/uat-pc02-mobile-2026-05-08.md` documented `clearState: true` not clearing Flutter secure storage. Wrapper script needed to `adb pm clear` before each chained flow.
**Recommended next:** Either single-chain flow (login once → exercise all features → logout, no clearState in between) or wrapper script that runs `adb shell pm clear vn.gov.pc02.mobile` before each Maestro invocation.

### Phase 0.5 — Codex broad consult (deferred)
**Why deferred:** Heavy operation (token cost, time). Static audit captured high-impact issues already in the BUG-* table above.
**Recommended invocation:**
```
/codex consult "Review entire mobile/lib Flutter codebase. Identify:
(1) bugs in business logic not covered in REFACTOR-FINDINGS.md,
(2) security concerns specific to token handling and secure storage,
(3) Riverpod 2.6.1 anti-patterns,
(4) testability obstacles. Output structured markdown."
```
Append output to a "Codex Day-0 Consult" section in this file.

### Phase 2 — Extract `SearchableTabbedList<T>` (deferred)
**Why deferred:** Medium risk + medium surface (3 list screens). Better as a focused dedicated PR.
**Design (for next session):**

Create `mobile/lib/shared/widgets/searchable_tabbed_list.dart`:
```dart
class SearchableTabbedList<T> extends ConsumerStatefulWidget {
  final List<({String label, FutureProvider<List<T>> provider})> tabs;
  final Widget Function(BuildContext, T) itemBuilder;
  final bool Function(T item, String query) searchPredicate;
  final String emptyMessage;
  // ... rest of API
}
```
Replace ~95% identical scaffolding in `cases_screen.dart`, `incidents_screen.dart`, `petitions_screen.dart` (TabBar + search field + filter logic + shimmer + empty state).

Pair with adding `Key(item.id)` on `_CaseCard`/`_IncidentCard`/`_PetitionCard` for state preservation across filter changes.

Convert local `_searchQuery` state from `setState` to `ValueNotifier<String>` inside the new widget so screen-level rebuilds don't fire on every keystroke (micro-perf, observably equivalent).

### Phase 3 — Safe JSON parsing helpers (designed, not implemented)
**Why deferred:** 22 cast sites across 8 API files + 3 detail screens. Each replacement is mechanical but error-prone — needs careful per-file diff review. Better as a dedicated session with proper test coverage.

**Files affected:**
| File | Cast count |
|------|------------|
| `auth_api.dart` | 2 |
| `cases_api.dart` | 4 |
| `incidents_api.dart` | 4 |
| `notifications_api.dart` | 3 |
| `petitions_api.dart` | 4 |
| `dashboard_api.dart` | 0 (already uses runtime checks) |
| `case_detail_screen.dart` | 1 |
| `incident_detail_screen.dart` | 1 |
| `petition_detail_screen.dart` | 1 |
| `auth_provider.dart` | 1 (data['user']) |
| `notification.dart` (model) | 1 |

**Design:** Create `mobile/lib/core/api/json_utils.dart`:
```dart
import 'package:dio/dio.dart';

class ApiFormatException extends DioException {
  ApiFormatException(this.message, {RequestOptions? requestOptions, this.path})
      : super(requestOptions: requestOptions ?? RequestOptions());
  @override final String message;
  final String? path;

  @override
  String toString() => 'ApiFormatException${path != null ? " at \$path" : ""}: \$message';
}

Map<String, dynamic> asMap(dynamic v, {String? path}) {
  if (v is Map<String, dynamic>) return v;
  if (v is Map) return Map<String, dynamic>.from(v);
  throw ApiFormatException('Expected Map, got ${v.runtimeType}', path: path);
}

List<dynamic> asList(dynamic v, {String? path}) {
  if (v is List) return v;
  throw ApiFormatException('Expected List, got ${v.runtimeType}', path: path);
}

String asString(dynamic v, {String? path, String? fallback}) {
  if (v is String) return v;
  if (v == null && fallback != null) return fallback;
  throw ApiFormatException('Expected String, got ${v.runtimeType}', path: path);
}
```

**Migration sample (cases_api.dart):**
```dart
// Before
final data = resp.data as Map<String, dynamic>;
final items = data['items'] as List;
return items.map((e) => Case.fromJson(e as Map<String, dynamic>)).toList();

// After
final data = asMap(resp.data, path: 'cases.list.body');
final items = asList(data['items'], path: 'cases.list.items');
return items.map((e) => Case.fromJson(asMap(e, path: 'cases.list.item'))).toList();
```

**Behavior preservation:** for valid Map<String, dynamic> response, `asMap()` returns the input unchanged. The behavior change is limited to malformed payloads (now `ApiFormatException` instead of `_TypeError`).

**Side benefit:** `asMap()` handles `Map<dynamic, dynamic>` (which Dio sometimes returns from JSON.decode); the bare `as Map<String, dynamic>` cast fails on this. If any production payload has been failing silently due to this, the helper would expose it. **Worth investigating before merging.**

**Add tests:** `mobile/test/core/api/json_utils_test.dart` covering valid/null/wrong-type cases for each helper.

### Phase 4 — FCM/auth decouple (NOT a refactor — scope decision)
This is an explicit behavior change that fixes BUG-1, BUG-2, BUG-3 simultaneously. Recommended to discuss as a feature/bug-fix PR after the refactor branch lands.

### Phase 5 — Catch block triage (NOT a refactor — itemized fixes)
Same as BUG-4 above. Each `catch (_) {}` is a per-line decision (keep / log / surface). Recommended as a separate PR with one commit per file.

### Phase 7 — Test backfill (designed, not implemented)
Currently: 8 test files / 754 lines vs ~38 prod files. Strongest coverage in `auth_provider_test.dart` (98 lines). Zero widget tests for feature screens.

**Recommended additions (~8 files, ~600 lines):**
- `test/features/cases/cases_screen_test.dart` — list rendering, empty state, search filter (post-Phase 2 makes this 10× easier)
- `test/features/incidents/incidents_screen_test.dart` (similar)
- `test/features/petitions/petitions_screen_test.dart` (similar)
- `test/features/cases/case_detail_screen_test.dart` — mock realistic JSON, assert no "null"/"undefined" rendered
- `test/features/incidents/incident_detail_screen_test.dart`
- `test/features/petitions/petition_detail_screen_test.dart`
- `test/core/api/api_client_test.dart` — token refresh interceptor (most security-critical, currently zero coverage)
- `test/features/dashboard/dashboard_provider_test.dart` — `Future.wait` orchestration

**Reuse:** `mocktail` (already in dev_dependencies per `auth_provider_test.dart:10-16`).

**Pre-existing fix:** `test/petitions_api_test.dart:51` — Mock not stubbed for the test scenario. 1 line fix during this backfill.

---

## 📊 Performance hotspots (assessment only — not addressed)

### PERF-1 — No pagination on list screens
**Files:** `cases_screen.dart`, `incidents_screen.dart`, `petitions_screen.dart`
**Status:** `ListView.separated` is lazy (good), but the API returns up to `limit=20` in one go and the UI loads ALL filter results at once. With 100+ items, scroll jank likely.
**Recommended fix:** add offset/limit state, infinite scroll on scroll-to-end. Server already supports limit/offset.

### PERF-2 — Missing `Key` on list items
**Files:** `cases_screen.dart:145`, `incidents_screen.dart:149-151`, `petitions_screen.dart:148-150`
**Status:** `_CaseCard`, `_IncidentCard`, `_PetitionCard` rendered without `key:`. Reordering or filtering recreates the widget instead of moving it. Cosmetic + state-loss in animated children.
**Recommended fix:** `_CaseCard(key: ValueKey(item.id), c: item)` — small, low-risk, would land naturally with Phase 2.

### PERF-3 — JSON parsing on main isolate
**Files:** all `*_api.dart` map calls
**Status:** All API responses parsed via `.map((e) => X.fromJson(e))` synchronously on main isolate. Acceptable at `limit=20` payload (~10KB). Watch as data grows.
**Recommended fix:** if any API endpoint returns >100 items or >50KB, use `compute()` for off-isolate parsing.

### PERF-4 — Cold-start blocked by Firebase init
**File:** `main.dart:29-31`
**Status:** `Firebase.initializeApp()` blocks `main()` for up to 3 seconds (timeout). User sees blank screen during cold start.
**Recommended fix:** kick off Firebase init in background, render `_AppInit` immediately. Auth flow doesn't need Firebase.

### PERF-5 — `withOpacity` deprecated
**Files:** `notifications_screen.dart:113`, `app_drawer.dart:79`, `deadline_badge.dart:39`
**Status:** Flutter 3.10+ deprecated `Color.withOpacity` for precision loss. Replace with `.withValues(alpha: 0.12)`.
**Recommended fix:** trivial sed replacement; no behavior change.

---

## Recommended next session

Suggested order based on risk vs ROI:

1. **Phase 3** (JSON helpers) — high ROI, medium-high risk; needs careful per-file review
2. **Phase 2** (SearchableTabbedList) — high ROI, medium risk; biggest deduplication win
3. **Phase 7** (test backfill) — pure addition, foundational for future PRs
4. **Phase 4 + 5** (FCM/auth decouple + catch triage) — discuss as separate feature PR; explicit behavior changes
5. **PERF-2** (list keys) — lands naturally with Phase 2
6. **PERF-5** (withOpacity → withValues) — trivial cleanup, can batch with anything

## Verification commands

After each refactor commit:
```bash
cd mobile
flutter analyze            # must not increase issue count vs baseline (28)
flutter test --no-pub      # must remain at 53 pass / 1 fail (baseline)
flutter test --update-goldens && git diff test/golden/  # empty diff (when goldens land)
```

End-to-end (when emulator + APK setup is functional):
```bash
adb shell pm clear vn.gov.pc02.mobile
maestro test maestro/flows/01_login_success.yaml
adb shell pm clear vn.gov.pc02.mobile
maestro test maestro/flows/03_cases_list.yaml
# ... etc
```

## Baseline references

- Baseline tag: `git tag refactor/baseline-mobile-2026-05-08`
- Baseline outputs: `.gstack/refactor/baseline-{analyze,test,format}.txt`
- Initial UAT report (referenced for known issues): `.gstack/qa-mobile-reports/uat-pc02-mobile-2026-05-08.md`
