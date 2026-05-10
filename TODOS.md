# TODOS

## Security

### FINDING-002: Git history contains `.env.test` credentials
**Priority:** P1
**Details:** Commit `92bfbee` added `.env.test` with plaintext `DieuTra@PC02#2026` password. File was removed in a subsequent commit but remains in git history. Requires `git filter-repo` + force-push (destructive, coordinate with team).

**Steps:**
1. Rotate `DieuTra@PC02#2026` password in all environments first
2. Run `git filter-repo --path .env.test --invert-paths`
3. Coordinate force-push with all collaborators (history rewrite)
4. Rotate GitHub deploy tokens/secrets after push

**Discovered:** 2026-04-20 (CSO security audit)



### PERF-002: GET /kpi/trend makes ~120 DB count queries per call
**Priority:** P3 (acceptable at current scale with <10k rows + createdAt index)
**Details:** `getKpiTrend()` runs 12 months × 4 KPIs × ~2.5 counts = ~120 `prisma.count()` calls. They run in 12 parallel batches (one per month), so it's 12 sequential DB round-trips. With a good index on `createdAt` this is fast. Will degrade as data grows.
**Fix:** Refactor to raw SQL `GROUP BY EXTRACT(MONTH FROM "createdAt")` — reduces to 4 queries total.
**Discovered:** 2026-04-23 (eng review)

### PERF-001: DataScopeInterceptor makes 5-15 DB queries per request (no caching)
**Priority:** P3 (acceptable at current scale, trigger at >30 concurrent users)
**Details:** `UnitScopeService.resolveScope()` is called on every authenticated API request. It does: `userTeam.findMany` + recursive `getDescendantIds` (N × MAX_DEPTH=3) + `dataAccessGrant.findMany` + `getUserIdsForTeams`. No in-memory cache. At 50 concurrent users this is ~750-1500 extra DB queries/second.
**Fix:** Add TTL-based in-memory cache in `UnitScopeService` keyed on `userId`. Invalidate on team membership change or DataAccessGrant upsert. TTL=60s is safe.
**Discovered:** 2026-04-23 (eng review)

### SCHEMA-001: Case.unit + Case.assignedTeamId redundancy (also Incident.unitId + donViGiaiQuyet)
**Priority:** P3 (consistency / tech debt)
**Details:** `Case.unit` (String, free-text) song song `Case.assignedTeamId` (FK Team) đại diện cùng concept "đơn vị thụ lý". Tương tự `Incident.unitId` (String) + `Incident.donViGiaiQuyet` (text). Form FE hiện điền cả hai để workaround. Long-term redundancy gây nhầm lẫn (which is source of truth) và rủi ro inconsistency (text rename không cập nhật FK).
**Fix:** Consolidate về 1 FK + display label gián tiếp qua join. Migration cần backfill `assignedTeamId` từ `unit` text qua name-match (lossy nếu không match được team hiện hữu).
**Discovered:** 2026-05-09 (eng review during plan-defaults work)

---

## Stub-Check Findings — 2026-05-01 (`/stub-check` scan on feat/mobile)

### STUB-P1: Buttons/handlers làm không gì hết

| ID | File | Line | Issue |
|----|------|------|-------|
| STUB-001 | `frontend/src/pages/incidents/IncidentListPage.tsx` | 302 | "Xuất Excel" (`btn-export`) thiếu `onClick` |
| STUB-002 | `frontend/src/pages/workflow/CaseExchangePage.tsx` | 212 | "Xuất Excel" (`export-excel-btn`) thiếu `onClick` |
| STUB-003 | `frontend/src/pages/workflow/CaseExchangePage.tsx` | 744 | Download đính kèm chat thiếu `onClick` |
| STUB-004 | `frontend/src/pages/workflow/InvestigationDelegationPage.tsx` | 393 | "Xuất Excel" (`export-excel-btn`) thiếu `onClick` |
| STUB-005 | `frontend/src/pages/settings/SettingsPage.tsx` | 114 | "Sửa" user thiếu `onClick` (→ navigate hoặc modal) |
| STUB-006 | `frontend/src/pages/settings/SettingsPage.tsx` | 115 | "Xóa" user thiếu `onClick` (→ api.delete) |
| STUB-007 | `frontend/src/pages/users/UserManagementPage.tsx` | 346 | "Xuất Excel" user list thiếu `onClick` |
| STUB-008 | `frontend/src/pages/cases/CaseListPage.tsx` | 406 | "Xuất báo cáo" thiếu `onClick` |
| STUB-009 | `frontend/src/pages/petitions/PetitionListPage.tsx` | 423 | "Áp dụng" filter nâng cao thiếu `onClick` |
| STUB-010 | `frontend/src/pages/classification/ProsecutorProposalPage.tsx` | 1081 | `handleDownloadPDF` chỉ `alert("đang phát triển")` |
| STUB-011 | `frontend/src/pages/cases/CaseListPage.tsx` | 752-758 | Pagination Trước/1/Sau thiếu `onClick` (stub display) |
| STUB-012 | `frontend/src/pages/petitions/PetitionListPage.tsx` | 659-665 | Pagination Trước/1/Sau thiếu `onClick` (stub display) |
| STUB-013 | `frontend/src/pages/workflow/CaseExchangePage.tsx` | 428-430 | Pagination Trước/1/Sau thiếu `onClick` (stub display) |
| STUB-014 | `frontend/src/pages/workflow/TransferAndReturnPage.tsx` | 628-629 | Pagination Trước/Sau thiếu `onClick` (stub display) |

**Fix pattern cho STUB-001, 002, 004, 007, 008:** client-side CSV từ `filteredData` — copy pattern từ `ActivityLogPage.tsx`.
**Fix pattern cho STUB-005:** `navigate(\`/settings/users/${user.id}/edit\`)` hoặc mở modal.
**Fix pattern cho STUB-006:** `api.delete(\`/users/${user.id}\`)` + confirm dialog.
**Fix pattern cho STUB-009:** gọi `fetchData()` với filter state hiện tại.
**Fix pattern cho STUB-003:** `window.open(att.url, '_blank')` hoặc `api.get` download stream.
**Fix pattern cho STUB-011..014:** wiring pagination state (currentPage, setCurrentPage).
**Fix pattern cho STUB-010:** `window.print()` với HTML template (tương tự receipt trong ExportReportsPage).

---

### STUB-P2: Giả thành công, không gọi API

| ID | File | Line | Issue |
|----|------|------|-------|
| STUB-015 | `frontend/src/pages/cases/CaseFormPage/index.tsx` | 239 | `handleSaveDraft` — `console.log + alert()`, cần `api.put(/cases/:id, {status:'DRAFT'})` hoặc `localStorage` fallback |

---

### STUB-P3: Services/Controllers thiếu spec file

**Services (7 thiếu spec):**
- `src/calendar/calendar.service.ts`
- `src/dashboard/dashboard.service.ts`
- `src/notifications/notifications.service.ts`
- `src/push/devices.service.ts`
- `src/reports/tdac/tdac-export.service.ts`
- `src/settings/settings.service.ts`
- `src/shared/action-plans/action-plans.service.ts`

**Controllers (27 thiếu spec)** — hầu hết controllers chưa có unit test. Ưu tiên cao nhất: `cases.controller.ts`, `petitions.controller.ts`, `incidents.controller.ts`, `reports.controller.ts`.

---

### STUB-P4: Code quality

| ID | File | Line | Issue |
|----|------|------|-------|
| STUB-016 | `frontend/src/pages/cases/CaseFormPage/index.tsx` | 240 | `console.log("[CaseFormPage] Lưu nháp:", formData)` — debug log còn trong production |

---

### API Contract Risks (cần verify)

| File | Line | Risk |
|------|------|------|
| `frontend/src/pages/cases/CaseDetailPage.tsx` | 768, 973 | `setCaseData(res.data.data)` — nếu `caseData` state có typed interface thì cần transform |
| `frontend/src/pages/reports/TdacReportPage.tsx` | 127 | `setReportData(res.data)` — cần check interface vs backend shape |

**Discovered:** 2026-05-01 (`/stub-check` automated scan, branch feat/mobile)

---

## Web

### SHORTCUTS-001: Wire 7 remaining shortcut actions to handlers
**Priority:** P2
**Details:** Phase 4 of `/feat/keyboard-shortcuts-manager` migrated 3 existing (F9/F10/Ctrl+Shift+L) and wired 4 new (save, cancel, logout, showCheatSheet). 7 actions defined in registry but not wired to handlers: `saveDraft`, `search`, `newRecord`, `delete`, `print`, `export`, `refreshList`. Handlers exist in their respective pages; just need `useShortcut('action', handler)` call.
**Files:**
- `saveDraft` → `frontend/src/pages/cases/CaseFormPage/index.tsx` after `handleSaveDraft`
- `search` → `frontend/src/components/GlobalSearchBar.tsx` (focus input)
- `newRecord` → list pages (CaseListPage, IncidentListPage, PetitionListPage)
- `delete` → CaseDetailPage / IncidentDetailPage (record context)
- `print` / `export` → ExportReportsPage
- `refreshList` → list pages (queryClient.invalidateQueries)
**Discovered:** 2026-05-10 (autoplan Phase 4 leverage point)

## Completed

- **SHORTCUTS-FOUNDATION**: Settings module 9 quản lý phím tắt — UserShortcut DB model, registry, useShortcut hook, ShortcutsModule UI, ShortcutCheatSheet overlay (`?`), kbd hints in FormActionBar, BroadcastChannel cross-tab sync, Save/Cancel/Logout wired. **Completed:** v0.13.7.0 (2026-05-10)
- **FINDING-001 (IDOR)**: `getById` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.1.0 — `assertParentInScope`/`assertCreatorInScope` added, 43 new tests. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-005 (IDOR write/list)**: `update`, `delete`, and `getList` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.2.0 — scope pre-flight on write ops + `buildScopeFilter` on list queries. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-006 (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` was not enforced by `assertCreatorInScope` (userIds.length > 0 short-circuit). Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-007 (getMessages bypass)**: `GET /exchanges/:id/messages` had no scope check. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-008 (investigation-supplements deletedAt)**: `getById` missing `deletedAt: null` filter allowed soft-deleted records to be fetched. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-009 (CORS empty string)**: `CORS_ORIGIN=` (empty env var) produced `origin: [""]` blocking all production requests. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-010 (per-IP throttle)**: `POST /auth/change-password` throttle keyed on IP. Fixed in v0.5.3.0 — `UserThrottlerGuard` keys on `user.id` post-JWT. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-011 (JWT not invalidated on password change)**: Access tokens stayed valid after password change. Fixed in v0.5.3.0 — `tokenVersion` field added to User + JWT payload; `JwtStrategy` rejects stale tokens. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-012 (trust proxy)**: `req.ip` returned proxy IP without trust proxy config. Fixed in v0.5.3.0 — `app.set('trust proxy', 1)` added to `main.ts`. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-003 (Vite CVEs)**: 6 vulnerabilities (4 HIGH) in frontend devDeps. Fixed via `npm audit fix`. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-004 (CORS hardcoded)**: CORS origin hardcoded to localhost. Fixed via `CORS_ORIGIN` env var. **Completed:** v0.5.1.0 (2026-04-21)
- **MOBILE-SEC-001 (api_client isolate crash)**: Queued Completer.future not wrapped in try/catch — completeError() on refresh failure could crash isolate. Fixed in v0.8.0.0. **Completed:** 2026-04-25
- **MOBILE-SEC-002 (bare Dio() refresh)**: Bare `Dio()` for token refresh had no timeout/config — MITM risk. Fixed with configured Dio in v0.8.0.0. **Completed:** 2026-04-25
- **MOBILE-SEC-003 (biometric credentials leak)**: logout() didn't call BiometricService.clear() — previous user's bio credentials persisted. Fixed in v0.8.0.0. **Completed:** 2026-04-25
- **SCHED-001 (duplicate notifications)**: markNotified() called after sendToUser() — push failure caused duplicate next-day notifications. Fixed in v0.8.0.0. **Completed:** 2026-04-25
- **SCHED-002 (DB failure silences all notifications)**: systemSetting.findUnique not in try/catch — DB error at 07:00 killed all deadline notifications. Fixed in v0.8.0.0. **Completed:** 2026-04-25
- **MOBILE-BUG-001 (petitions overdue tab)**: Tab "Quá hạn" returned all petitions, no overdue filter. Fixed with ?overdue=true backend param in v0.8.0.0. **Completed:** 2026-04-25
- **FINDING-013 (write-scope enforcement)**: `DataAccessGrant.accessLevel` READ/WRITE now enforced. `assertParentInScope`/`assertCreatorInScope` accept `operation='write'` param that uses `writableTeamIds` instead of `teamIds`. `checkWriteScope` added to Cases and Petitions services (Incidents already had it). All 9 child-resource services add write-scope check in update/delete paths. Petitions controller now passes `req.dataScope` to all write methods. 9 new tests in scope-filter.util.spec.ts. **Completed:** 2026-04-25
- **CONC-001 (optimistic locking)**: 10 mutation endpoints (Cases×1, Incidents×6, Petitions×3) had last-write-wins. Added optional `expectedUpdatedAt` to DTOs; Prisma P2025 → 409 ConflictException; frontend captures `updatedAt` on load and shows conflict message. 33 new tests, 591 total pass. BAC-007 UAT scenario now unblocked. **Completed:** 2026-04-25
- **DISPATCH-001 (canDispatch Dispatcher Group)**: Officer users với `canDispatch=true` có thể xem toàn bộ vụ việc/vụ án/đơn thư và phân công. `DispatchGuard`, DataScope bypass, JWT invalidation, admin toggle, `PATCH assign` endpoints cho Cases/Incidents/Petitions, frontend AssignModal. 628 tests pass. **Completed:** v0.9.0.0 (2026-04-26)
- **DOCKER-001 (Docker Compose full-stack)**: `docker-compose.yml` 3 services (PostgreSQL 16, NestJS backend, nginx frontend). Multi-stage Dockerfiles, `docker-entrypoint.sh` migrate→seed→start, nginx reverse proxy. `build_mobile_prod.bat` cho APK production. **Completed:** v0.9.0.0 (2026-04-26)
- **AUDIT-001 (wrapUpdate before/after state)**: `AuditService.wrapUpdate()` helper ghi lại trạng thái trước/sau UPDATE. Áp dụng cho 11 services. **Completed:** v0.9.0.0 (2026-04-26)
