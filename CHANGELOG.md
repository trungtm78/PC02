# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0.0] - 2026-04-26

### Added
- **Dispatcher Permission Group (`canDispatch`)**: Điều tra viên OFFICER có `canDispatch=true` có thể xem và phân công vụ việc/vụ án/đơn thư của mọi tổ. `DispatchGuard` + `DataScope` bypass đảm bảo quyền truy cập xuyên tổ an toàn. JWT invalidation tức thì khi toggle `canDispatch`.
- **Assign endpoints**: `PATCH /cases/:id/assign`, `PATCH /incidents/:id/assign`, `PATCH /petitions/:id/assign` — cho phép dispatcher phân công đội/điều tra viên mà không cần thuộc tổ đó.
- **Frontend Assign UI**: `AssignModal` component + assign buttons trên Cases/Incidents/Petitions list pages. Admin toggle bật/tắt `canDispatch` trên User Management page.
- **Docker Compose full-stack**: `docker-compose.yml` với 3 services (`db` PostgreSQL 16, `backend` NestJS, `frontend` nginx). Multi-stage Dockerfiles, `docker-entrypoint.sh` chạy migrate → seed → start. Nginx reverse proxy `/api/*` → backend.
- **Mobile production build script**: `build_mobile_prod.bat` — build APK release với `--dart-define=API_BASE_URL=http://<SERVER>/api/v1`.
- **Audit before/after state**: `AuditService.wrapUpdate()` helper + áp dụng cho 11 services — UPDATE log ghi lại state trước và sau thay đổi.
- **GitHub Actions CI**: `.github/workflows/ci.yml` chạy 628 backend unit tests trên mỗi push/PR.
- **UAT SDLC artifacts + Optimistic locking**: Checklist UAT đầy đủ + `version` field optimistic locking trên 10 mutation endpoints để ngăn concurrent write conflict.

### Fixed
- **FINDING-013 Security**: Enforce `DataAccessGrant.accessLevel` write-scope trên tất cả mutation paths — loại bỏ leo thang quyền.
- **Incidents assign**: CUID validation (`@IsString()` thay `@IsUUID('4')`) + `investigatorId` optional (cho phép assign team trước, điều tra viên sau).
- **Cases/Petitions assign DTOs**: Tương tự — CUID validation fix cho `assignedTeamId`, `assignedToId`, `investigatorId`.

## [0.8.0.0] - 2026-04-25

### Added
- **Biometric login (TouchID/FaceID)**: `BiometricService` lưu credentials vào Keychain/Keystore, tự động đăng nhập khi mở app. iOS `NSFaceIDUsageDescription` + Android `minSdk 23` cho `local_auth`. Logout xóa credentials sinh trắc học.
- **Petitions overdue filter**: Tab "Quá hạn" trong Đơn thư screen trả đúng đơn thư đã qua hạn — backend `?overdue=true` filter với `PetitionStatus` enum (type-safe).
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage Android — 175 steps, 0 failures, health score 99/100.
- **Team-scoped deadline notifications**: Scheduler gửi push đến toàn tổ phụ trách, DataAccessGrant holders. Loại trừ ADMIN role và inactive users.

### Fixed
- **Dashboard stats nhất quán**: `DINH_CHI` tính vào `processedCases` (đình chỉ = đã xử lý). `TAM_DINH_CHI` loại khỏi `overdueCount` (tạm đình chỉ không phải quá hạn).
- **CRITICAL — api_client isolate crash**: Queued requests không wrap `completeError()` trong try/catch — khi refresh fail, crash isolate. Đã wrap + return early.
- **SECURITY — MITM risk on token refresh**: Bare `Dio()` cho refresh request không có timeout. Thay bằng `Dio(BaseOptions(...))` với cùng config như client chính.
- **Duplicate notifications**: `markNotified()` đảo thứ tự trước `sendToUser()` — push throw không còn bỏ sót dedup record.
- **Scheduler DB failure silences all notifications**: `systemSetting.findUnique` thêm try/catch, fallback 7 ngày khi DB hiccup lúc 07:00.
- **Biometric credentials leak after logout**: `logout()` nay `Future.wait([storage.clear(), biometricService.clear()])` — không để credentials sinh trắc học của user cũ.
- **PetitionStatus string literals → enum**: `petitions.service.ts` overdue filter dùng `PetitionStatus.DA_GIAI_QUYET` thay chuỗi literal (type-safe, refactor-safe).

## [0.7.0.0] - 2026-04-25

### Added
- **Team-scoped deadline notifications**: DeadlineScheduler gửi push đến toàn bộ tổ phụ trách (không chỉ điều tra viên trực tiếp) — tích hợp với DataAccessGrant và UserTeam. Loại trừ admin role và inactive user trong phân phối push.
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage trên Android — login, wrong password, cases list, case detail, incidents list, petitions list, dashboard, tab navigation, petition detail, logout. Windows-compatible với Java direct invocation (bypass CMD classpath limit).
- **Dashboard fix**: 4 stat cards bây giờ hiển thị số thật — fix response envelope unwrap + field name mismatch (`processedCases` vs `resolvedCases`).
- **StatusChip localization**: Tất cả 22 enum value (CaseStatus + IncidentStatus) hiển thị tên tiếng Việt, màu theo ngữ nghĩa (đỏ = quá hạn, vàng = đình chỉ, xanh = hoàn thành, xanh navy = đang xử lý).
- **Regression tests**: `dashboard_api_test.dart` (5 tests) + `status_chip_test.dart` (8 widget tests) — bảo vệ cả 2 bug vừa fix và 4 color branch của StatusChip.

### Fixed
- **Terminal statuses hoàn chỉnh**: `DA_KET_LUAN` thêm vào `TERMINAL_CASE_STATUSES` (hết thông báo cho vụ án đã kết luận). 7 incident terminal statuses còn thiếu được thêm vào (`CHUYEN_XPHC`, `TDC_HET_THOI_HIEU`, `TDC_HTH_KHONG_KT`, `PHUC_HOI_NGUON_TIN`, `DA_CHUYEN_DON_VI`, `DA_NHAP_VU_KHAC`, `PHAN_LOAI_DAN_SU`).
- **NaN guard cho CANH_BAO_SAP_HAN**: `parseInt` với giá trị không hợp lệ fallback về 7 ngày thay vì tạo `Invalid Date` làm tắt toàn bộ cảnh báo sắp đến hạn.
- **Dashboard API null safety**: Type guard trước khi cast `resp.data` — trả về stats rỗng thay vì crash khi API trả về non-map body.
- **Maestro flows**: `clearState: true` để reset auth state giữa các flows. Coordinate-based tap thay cho Vietnamese Unicode text (Maestro 1.39.0 Windows bug). Logout assertion mạnh hơn.

## [0.6.0.0] - 2026-04-24

### Added
- **Flutter Mobile App (Android + iOS)**: Ứng dụng di động đầy đủ tính năng — xem tiến độ hồ sơ/vụ việc/đơn thư theo thời gian thực, nhận push notification khi quá hạn hoặc sắp đến hạn. Phân phối qua Firebase App Distribution. Material 3, Riverpod state management, GoRouter navigation.
- **FCM Push Notification**: Backend FCM HTTP v1 — `PushService` gửi push đến tất cả thiết bị của user, tự xóa stale token (`INVALID_ARGUMENT`/`NOT_FOUND`). `DevicesController` (POST/DELETE `/devices`) đăng ký/hủy FCM token sau login/logout.
- **DeadlineScheduler**: Cron job 07:00 mỗi ngày kiểm tra vụ án/vụ việc/đơn thư quá hạn và sắp đến hạn, gửi push notification đến điều tra viên phụ trách. Dedup bằng `OverdueNotification` table (1 lần/24h/hồ sơ). Null guard cho `investigatorId`. `Promise.allSettled` để tránh một thiết bị lỗi block các thiết bị khác.
- **UserDevice + OverdueNotification schema**: 2 model mới trong Prisma — `user_devices` (FCM token per user, upsert by token), `overdue_notifications` (dedup tracking với unique constraint `resourceType+resourceId+userId`).
- **CANH_BAO_SAP_HAN setting**: Key mới trong SystemSetting với default 7 ngày — ngưỡng cảnh báo sắp đến hạn, cấu hình từ web admin, Flutter app đọc qua `GET /settings`.
- **5-tab Bottom Navigation**: Dashboard / Hồ sơ / Vụ việc / Đơn thư / Thông báo — unread badge count trên tab Thông báo. Drawer với logo PC02 + tên/vai trò người dùng + Đăng xuất.
- **DeadlineBadge (3 màu)**: Đỏ (quá hạn), Vàng (≤ CANH_BAO_SAP_HAN ngày), Xanh (còn thời gian). Đọc ngưỡng từ Riverpod `deadlineSettingsProvider` (cache 1 lần khi khởi động).
- **Offline Banner**: Banner "Không có kết nối" tự động hiện khi mất mạng (`connectivity_plus`).
- **2FA Mobile Flow**: Màn hình nhập OTP 6 chữ số, auto-submit khi đủ 6 ký tự, back về Login xóa pending state.
- **Shimmer Loading + Pull-to-Refresh**: Skeleton animation trên lần tải đầu, pull-to-refresh trên tất cả list screens.
- **Optimistic Mark-Read**: Tap thông báo → đánh dấu đã đọc ngay (revert khi lỗi).
- **8 Flutter unit tests**: `auth_provider_test.dart` (4) + `deadline_badge_test.dart` (4). 14 backend tests: `push.service.spec.ts` (5) + `deadline.scheduler.spec.ts` (8) + 1 devices controller test.

### Fixed
- **TwoFaSetupModal**: Phân biệt 409 "pending setup" vs "already enabled" — chỉ hiện nút "Huỷ setup cũ và bắt đầu lại" khi lỗi message chứa 'chờ xác nhận', tránh vô tình huỷ 2FA đã kích hoạt.
- **DevicesController**: `DELETE /devices/:token` truyền `userId` vào `unregister()` để enforce ownership — tránh user xóa token của người khác.

## [0.5.6.0] - 2026-04-24

### Added
- **Từ viết tắt cá nhân (Text Expansion)**: Người dùng tự định nghĩa thư viện phím tắt cá nhân (ví dụ: `lvs` → `Lê Văn Sỹ`). Gõ phím tắt + F9 trong bất kỳ ô nhập liệu nào để mở rộng tự động. Hoạt động trên toàn bộ hệ thống (global F9 listener trong MainLayout).
- **API abbreviations**: 5 endpoint — GET list, PUT upsert, DELETE remove, POST copy-from, GET users. Xác thực chỉ qua JwtAuthGuard (dữ liệu cá nhân).
- **Copy từ người dùng khác**: Sao chép thư viện viết tắt từ user khác theo 2 chế độ — Gộp (merge, giữ phím tắt hiện tại) hoặc Thay thế hoàn toàn (replace dùng atomic `$transaction`).
- **Settings tab "Từ viết tắt"**: Giao diện quản lý — bảng danh sách, form thêm/sửa, panel sao chép từ người dùng khác.
- **Schema `UserAbbreviation`**: Bảng `user_abbreviations` với unique index `(userId, shortcut)`, FK cascade on delete.
- **20 unit tests**: `abbreviations.service.spec.ts` (15) + `abbreviations.controller.spec.ts` (5).

## [0.5.5.0] - 2026-04-24

### Added
- **Cải cách hành chính — xóa bỏ cấp quận/huyện**: Directory entries type=DISTRICT đánh dấu `isActive=false` + `abolishedAt=2025-07-01`. Ward legacy cascade (parentId→DISTRICT) cũng đánh dấu `isActive=false`. Schema thêm `abolishedAt DateTime?` và `replacedByCode String?` trên Directory model.
- **Địa chỉ 2 cấp cho hồ sơ mới**: Form vụ án chỉ hiện Tỉnh/TP + Phường/Xã; danh sách phường load từ API `/directories?type=WARD&isActive=true`. Hồ sơ cũ có quận hiện amber read-only badge "Địa chỉ cũ — [quận] (trước 01/07/2025)".
- **Legacy toggle (Ctrl+Shift+L)**: Cho phép nhập lại hồ sơ giấy cũ có quận — toggle bật/tắt field Quận/Huyện với ward cascade theo `parentId`. Chỉ áp dụng cho hồ sơ mới, không đè lên dữ liệu lịch sử từ DB.
- **`Subject.districtName`**: Denormalized district name lưu tại thời điểm tạo hồ sơ — đảm bảo tên pháp lý hiển thị đúng sau cải cách. DTO + Service + Migration thêm field này.
- **Slug normalization script**: `backend/prisma/migrations/20260425000002_normalize_case_district_slugs/migrate-district-slugs.ts` — standalone script chuẩn hóa `Case.metadata.district` slugs (quan-1 → Q1 v.v.).
- **2FA infrastructure (TOTP + Email OTP)**: Thêm schema fields (`twoFaSecret`, `twoFaEnabled`, `twoFaVerified`), service (`TwoFaService`, `OtpCodeService`, `TotpEncryptionService`), controller (`TwoFaController`), guard (`TwoFaTokenGuard`), email module, và frontend pages (`TwoFaPage`, `TwoFaSetupModal`). Auth flow cập nhật hỗ trợ 2FA challenge step.

### Fixed
- Loại bỏ hardcoded `DISTRICT_OPTIONS` và `WARD_OPTIONS` trong `CaseFormPage/constants.ts` — thay bằng API-driven dropdowns.

## [0.5.4.0] - 2026-04-24

### Added
- **GAP-1: `LoaiNguonTin` enum** (BLTTHS 2015 Điều 144) — `loaiDonVu` on `Incident` changed from `String?` to `LoaiNguonTin?` (TO_GIAC / TIN_BAO / KIEN_NGHI_KHOI_TO). DTO validation rejects non-enum values with 400. Migration: `CASE-WHEN` string→enum conversion preserving existing data.
- **GAP-2: Deadline extension tracking** (BLTTHS 2015 Điều 147 khoản 2-3) — `soLanGiaHan Int @default(0)` and `ngayGiaHan DateTime?` on `Incident`. `POST /incidents/:id/extend` extends deadline (max 2 times, each +60 days configurable via SystemSettings `THOI_HAN_GIA_HAN_1`/`THOI_HAN_GIA_HAN_2`). Optimistic concurrency lock prevents double-extension race.
- **GAP-3: Max deadline corrected** — `THOI_HAN_TOI_DA` seed value `120` → `140` (20 + 60 + 60 days, Điều 147 khoản 1-3).
- **GAP-4: `LoaiDon` enum** (Luật Tố cáo 2018 / Luật Khiếu nại 2011) — `petitionType` on `Petition` changed from `String?` to `LoaiDon?` (TO_CAO / KHIEU_NAI / KIEN_NGHI / PHAN_ANH). DTO validation rejects non-enum values.
- **GAP-5: `CapDoToiPham` enum** (BLHS 2015 Điều 9) — `capDoToiPham` on `Case` (IT_NGHIEM_TRONG / NGHIEM_TRONG / RAT_NGHIEM_TRONG / DAC_BIET_NGHIEM_TRONG). KPI-4 now correctly uses `capDoToiPham` enum instead of `metadata.severity` string path.
- **GAP-6: `LyDoKhongKhoiTo` enum** (BLTTHS 2015 Điều 157) — 7 statutory grounds for non-prosecution on `Incident`. Required when transitioning to `KHONG_KHOI_TO` status — `updateStatus()` validates presence.
- **GAP-7: Petition deadline configuration** — Deadline days per petition type now read from SystemSettings (`THOI_HAN_TO_CAO`, `THOI_HAN_KHIEU_NAI`, `THOI_HAN_KIEN_NGHI`, `THOI_HAN_PHAN_ANH`). Default fallback 15 days. Audit log records `deadlineDays` + `deadlineSettingKey` for traceability.
- **GAP-9: `writableTeamIds` write-scope enforcement** — `DataScope` now includes `writableTeamIds` (subset of `teamIds` where user has WRITE grant). All mutating incident endpoints (`update`, `updateStatus`, `delete`, `mergeInto`, `transferUnit`, `assignInvestigator`, `extendDeadline`, `prosecute`) now call `checkWriteScope()` using `writableTeamIds`. READ-grant holders can no longer mutate records.
- **Frontend selects**: `loaiDonVu` filter (3 enum options, Điều 144), `petitionType` select (4 enum options), `capDoToiPham` select (4 BLHS mức độ options) replacing free-text inputs.

### Fixed
- **IDOR in `extendDeadline`**: Was fetching incident without scope check. Now calls `checkWriteScope()` with `dataScope` from request.
- **Silent NULL deadline coercion**: `incident.deadline ?? new Date()` replaced with explicit `BadRequestException` when deadline is null.
- **extensionDays ≤ 0 guard**: `BadRequestException` thrown if SystemSettings returns `THOI_HAN_GIA_HAN_*` ≤ 0 (invalid admin config).

### Security
- Write-scope enforcement closes FINDING-4: READ-grant users could previously call any mutating endpoint on records they could only read.

## [0.5.3.0] - 2026-04-23

### Added
- **Self-service password change**: `POST /auth/change-password` — user đổi mật khẩu của chính mình. Xác minh mật khẩu hiện tại, enforce strong password (≥8 ký tự, chữ hoa, số, ký tự đặc biệt), audit log `PASSWORD_CHANGED`, invalidate refresh tokens.
- **Frontend "Đổi mật khẩu" modal**: User avatar trên header mở dropdown → "Đổi mật khẩu" → modal với show/hide toggle, real-time strength checklist (4 rules), success state, và Vietnamese error messages.
- **`ChangePasswordDto`** + **`password.constants.ts`**: Shared `STRONG_PASSWORD_REGEX` / `STRONG_PASSWORD_MSG` constants — DRY, một chỗ thay đổi policy.

### Fixed
- **Security (rate limiting)**: `POST /auth/change-password` thiếu `@Throttle` — brute-force via stolen JWT. Đã thêm `@Throttle({ default: { ttl: 60000, limit: 5 } })`.
- **Security (session invalidation)**: Đổi mật khẩu không xóa `refreshTokenHash` — attacker giữ refresh token vẫn duy trì session. Đã thêm `refreshTokenHash: null` vào update.
- **UX**: `newPassword === currentPassword` không bị chặn. Đã thêm `BadRequestException` guard trong service.
- **DRY**: Strong password regex duplicate trong 3 DTOs — đã extract sang `auth/constants/password.constants.ts`.

### Fixed (Adversarial Review)
- **Security (null hash crash)**: `changePassword` trên tài khoản OAuth/SSO (không có `passwordHash`) gây 500 error. Đã thêm explicit guard: `BadRequestException` khi `passwordHash` là null.
- **Security (bcrypt 72-byte bypass)**: So sánh `newPassword === currentPassword` bằng string equality không phát hiện same-password khi password > 72 ký tự (bcrypt truncates). Đã chuyển sang `bcrypt.compare(newPassword, oldHash)` — correct semantic check.
- **Compliance (audit transaction)**: `auditService.log()` không nằm trong cùng transaction với `user.update()` — password thay đổi thành công nhưng audit entry có thể bị mất nếu DB blip. Đã wrap cả hai trong `prisma.$transaction()`.

### Tests
- 8 unit tests cho `AuthService.changePassword` (bao gồm null-hash guard + transaction wrapper + bcrypt same-password check), 3 controller tests (`auth.controller.spec.ts`), 8 frontend tests (`ChangePasswordModal.test.tsx`). Tổng: **474 tests / 28 suites**.

## [0.5.2.0] - 2026-04-21

### Fixed
- **Security (IDOR write/list)**: `update`, `delete`, và `getList` trên 9 resource phụ không kiểm tra DataScope — user từ Tổ khác có thể ghi đè hoặc liệt kê bản ghi ngoài phạm vi. Đã thêm pre-flight `await this.getById(id, dataScope)` trên mọi write op, và `buildScopeFilter` cho list queries.
- **Security (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` bị bỏ qua do short-circuit `userIds.length > 0`. Đã thêm `isDenyAll` check — scope rỗng luôn bị chặn.
- **Security (getMessages bypass)**: `GET /exchanges/:id/messages` không kiểm tra scope — user ngoài scope có thể đọc tin nhắn. Đã thêm `await this.getById(exchangeId, dataScope)` pre-flight.
- **Security (deletedAt gap)**: `InvestigationSupplementsService.getById` thiếu `deletedAt: null` filter — soft-deleted record có thể fetch theo ID. Đã thêm filter.
- **Security (CORS empty string)**: `CORS_ORIGIN=` (env var rỗng) tạo ra `origin: [""]` block mọi cross-origin request trong production. Đã thêm `.filter(Boolean)` và fallback localhost.
- **Type safety**: Thay thế `(req as any).dataScope` trong 13 controller bằng `ScopedRequest` interface — typed `Request` với `dataScope?: DataScope | null`. Xóa toàn bộ unsafe cast.
- **Code quality**: Extract magic strings thành named constants trong `scope-filter.util.ts` — `FORBIDDEN_MSG` và `NO_ACCESS_SENTINEL`, tránh lỗi typo và cho phép refactor tập trung.

### Added
- **`ScopedRequest` interface** (`backend/src/auth/interfaces/scoped-request.interface.ts`): extends Express `Request` với `dataScope?: DataScope | null`. Được import bởi tất cả 13 controller.
- **Tests**: 4 test cases deny-all scope cho `exchanges` và `guidance` service specs. Controller spec mới `exchanges.controller.spec.ts` — 4 tests xác nhận `dataScope` được forward đúng từ controller sang service. Tổng: 463 tests / 26 suites.

## [0.5.1.0] - 2026-04-21

### Fixed
- **Security (IDOR)**: `getById` trên 9 resource phụ (documents, subjects, conclusions, delegations, exchanges, guidance, investigation-supplements, lawyers, proposals) không kiểm tra phạm vi dữ liệu (DataScope). Authenticated user từ Tổ khác có thể fetch bất kỳ record nào theo ID. Đã thêm `assertParentInScope()` (kiểm tra scope qua Case/Incident cha) và `assertCreatorInScope()` (kiểm tra qua createdById), áp dụng nhất quán trên tất cả 9 service.
- **Security (CORS)**: CORS origin hardcoded `localhost:5173/5179` sẽ block mọi browser request trong production. Đã chuyển sang `CORS_ORIGIN` env var với localhost fallback cho development.
- **CVEs**: `npm audit fix` frontend — xóa 6 lỗ hổng (4 HIGH Vite dev dependencies).

### Added
- **Test coverage**: 43 unit tests mới cho security enforcement paths. Thêm 6 service spec files (conclusions, delegations, exchanges, guidance, investigation-supplements, proposals). Scope-enforcement paths trong 3 spec files hiện có (documents, subjects, lawyers) được bổ sung. `assertParentInScope`/`assertCreatorInScope` có full branch coverage bao gồm edge cases (undefined scope, empty scope, null parent, unassigned records). Tổng: 454 tests / 25 suites.

## [0.5.0.1] - 2026-04-20

### Fixed
- **KPI-4 query**: Prisma JSON path filter used invalid `in` operator (unsupported for JSON path queries). Replaced with `OR/equals` pattern so `calculateKpi4()` correctly filters án rất nghiêm trọng và đặc biệt nghiêm trọng. Backend now compiles and `/kpi/summary` returns all 4 KPI values.

## [0.5.0.0] - 2026-04-20

### Added
- **KPI Dashboard** (`/kpi`): dashboard 4 chỉ tiêu cứng công tác điều tra theo TT28/2020/TT-BCA — thụ lý 100%, giải quyết >90%, khám phá >80%, án NT/ĐBNT >95%. Hiển thị theo năm/quý/tháng, drill-down theo Tổ, biểu đồ xu hướng 12 tháng (recharts). Team member chỉ xem Tổ của mình, admin xem tất cả.
- **Modular feature architecture**: mỗi module là 1 folder tự đóng gói. Frontend `src/features/<name>/` với `feature.manifest.ts`, `routes.tsx`, `menu.ts`, `index.ts`. Backend: mỗi module có `feature.manifest.ts` + central `feature-registry.ts`. 26 backend manifests + 16 frontend feature modules đã migrate.
- **Runtime feature flags**: bảng `feature_flags` + `@FeatureFlag(key)` NestJS guard + React `useFeature(key)` hook. Admin bật/tắt module → guard trả 404, sidebar ẩn menu. Cache in-memory 30s (TTL cấu hình qua `FEATURE_FLAG_CACHE_TTL_MS`).
- **Build-time feature packs**: env var `ENABLED_FEATURES=core,cases,petitions` whitelist module khi build. Cho phép phân phối variant khác nhau cho từng khách hàng mà không fork code.
- **Auto-discovery**: frontend registry dùng Vite `import.meta.glob('./features/*/index.ts')`. Backend registry có jest spec walk filesystem để catch missing entries. Thêm feature mới = tạo 1 folder, zero sửa file chung.
- **Sidebar registry consumption**: `useMenuSections()` hook gom menu entries từ feature modules, filter theo flag state, sort theo canonical section order, drop empty sections. Stale ids (favorites/expanded/recent) tự động pruned khi feature bị disable hoặc rename.

### Changed
- `frontend/src/App.tsx`: 244 → 44 dòng. Toàn bộ hardcoded routes thay bằng `FEATURE_MODULES.flatMap(f => f.renderRoutes())`.
- `frontend/src/components/AppSidebar.tsx`: bỏ 130 dòng hardcoded `menuSections` constant, dùng `useMenuSections()` hook.
- `backend/prisma/seed.ts`: tự động gọi `seedFeatureFlags(prisma)` ở cuối main seed flow — fresh deploy không còn blank menu.
- Deploy build command: `cd backend && npm install && npm run build && npx prisma migrate deploy && npm run db:seed` (bắt buộc để seed feature_flags).

### Fixed
- **Security**: `getById` cho incidents và petitions thiếu kiểm tra phạm vi dữ liệu (dataScope). Non-admin user có thể fetch bất kỳ record nào theo ID. Đã thêm `checkRecordInScope()` khớp pattern của CasesService.
- **Security**: `DataScopeInterceptor` khi JWT thiếu `role` claim → mặc định full access. Đã thêm fallback deny-all scope `{ teamIds: [], userIds: [] }`.
- `FeatureFlagsService.ensureFresh()` wrap refresh trong try/catch: post-boot DB blip không còn 500 mọi request, serves stale cache với 5s backoff. In-flight promise dedup chống thundering herd.
- `FeatureFlagGuard`: skip flag check khi request.user undefined → anonymous caller không thể probe enabled/disabled features qua 404 vs 401 pattern. Decoupled khỏi APP_GUARD execution order.
- `listAll()` merge FEATURE_REGISTRY với DB rows: fresh deploy trả về đầy đủ features với default-allow, frontend không còn blank trong race giữa migration và seed.
- `FeatureFlagsProvider`: retry 3 lần với backoff 500/1500/3000ms, 401 → clear tokens + redirect /login, network error exhausted → surface error state.
- Dashboard tests: stat values + chart headings (mock wrapped envelope, copy match).
- Calendar tests: modal prop name (`open` không phải `isOpen`), mock api events với future dates để pass filter.

### Removed
- `useFeatureRoutes` hook (dead code, App.tsx không dùng — comment trong App.tsx giải thích tại sao frontend routing không flag-gated).

## [0.4.1.0] - 2026-04-12

### Fixed
- Phân quyền: user cấp Tổ (level 1) giờ thấy data của các Phường thuộc Tổ đó (bỏ điều kiện level === 0)
- Settings: validate giá trị số 0-365 khi admin cập nhật thời hạn (chặn "-999" hoặc "abc")
- Incidents: phase filter ưu tiên rõ ràng khi cả status và phase được truyền
- Teams: validate userId tồn tại trước khi thêm thành viên (tránh 500 error)

### Added
- TeamsPage: panel quản lý thành viên khi click vào tổ/nhóm (thêm/gỡ user, search, isLeader badge)
- Teams API: POST /teams/:id/members + DELETE /teams/:id/members/:userId với audit logging

## [0.4.0.0] - 2026-04-12

### Added
- Tổ chức lại module Vụ việc theo 4 giai đoạn nghiệp vụ BCA (TT28/2020/TT-BCA): Tiếp nhận, Xác minh, Kết quả, Tạm đình chỉ
- Sidebar đơn giản hóa: 5 items (Tất cả + 4 giai đoạn) thay 12 items phẳng
- List page: 4 phase tabs với sub-filter chips cho từng trạng thái cụ thể
- Form tạo/sửa: 4 sections collapsible theo giai đoạn (tự mở/đóng theo status, user toggle được)
- Bảng SystemSetting: cấu hình 8 thời hạn xử lý với default theo BLTTHS 2015 (Đ.147, Đ.148, Đ.149)
- Trang admin /admin/settings: xem và sửa cấu hình thời hạn với cơ sở pháp lý
- Auto-deadline: tạo vụ việc có ngày tiếp nhận → tự tính thời hạn = ngày tiếp nhận + 20 ngày (configurable)
- 8 fields nghiệp vụ mới: số quyết định, lý do không khởi tố, lý do tạm đình chỉ, địa chỉ xảy ra, thông tin người tố giác (SĐT, địa chỉ, CCCD)
- Phase filter API: `?phase=tiep-nhan` server-side resolve an toàn qua PHASE_STATUSES map
- Frontend constants: incident-phases.ts shared giữa các components

### Changed
- Labels/comments sửa theo đúng thuật ngữ BLTTHS 2015 + TT28/2020/TT-BCA (Loại nguồn tin, Người tố giác, Đối tượng bị tố giác, Đơn vị thụ lý, Thời hạn giải quyết)
- Transition map bổ sung comments điều luật cho từng chuyển trạng thái
- Settings cache TTL 5 phút, seed upsert không ghi đè admin edits

## [0.3.0.0] - 2026-04-11

### Added
- Nâng cấp module Quản lý Vụ việc với 15 trạng thái theo quy trình nghiệp vụ thực tế (từ 6 trạng thái cũ)
- Transition map validation: chỉ cho phép chuyển trạng thái theo luồng nghiệp vụ hợp lệ
- Status history tracking: ghi lại lịch sử thay đổi trạng thái với lý do
- Endpoint đổi trạng thái (PATCH /incidents/:id/status) với validation
- Endpoint nhập vào vụ khác (PATCH /incidents/:id/merge) với re-link petitions/documents
- Endpoint chuyển đơn vị (PATCH /incidents/:id/transfer) với audit trail
- Endpoint thống kê theo trạng thái (GET /incidents/stats) dùng groupBy
- 15 fields mới cho Incident: đối tượng, loại đơn vụ, bên vụ, đơn vị giải quyết, kết quả xử lý, v.v.
- Model IncidentStatusHistory cho theo dõi lịch sử thay đổi
- Sidebar sub-menus: 12 mục lọc theo trạng thái (collapsible groups)
- Bộ lọc nâng cao: loại đơn vụ, bên vụ, tình trạng hồ sơ, thời hiệu, cán bộ nhập, date range
- Server-side pagination thay thế client-side filtering
- Status transition dialog: chỉ hiện transitions hợp lệ, yêu cầu ghi chú
- 58 unit tests mới cho transitions, merge, transfer, stats, filters

### Fixed
- Khởi tố vụ việc (prosecute) giờ dùng $transaction để đảm bảo atomicity
- Code generation VV-YYYY-NNNNN dùng retry loop thay vì count-based (fix race condition)
- Status không còn thay đổi qua PUT /update, phải dùng endpoint riêng
- Form chỉnh sửa vụ việc giờ load dữ liệu hiện có (fix edit mode)
