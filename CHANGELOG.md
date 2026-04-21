# Changelog

All notable changes to this project will be documented in this file.

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
