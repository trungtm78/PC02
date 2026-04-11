# Changelog

All notable changes to this project will be documented in this file.

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
