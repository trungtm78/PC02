# UI Specs: Module Quản lý Vụ việc

Path: docs/specs/UI_Specs.md | Layer: UI_UX | Version: 1.0.0 | Action: CREATE | TASK_ID: TASK-2026-022601

## 1. Screen Inventory
- **IncidentListPage**: Màn hình danh sách vụ việc, tích hợp tìm kiếm và lọc.
- **IncidentFormPage**: Màn hình thêm mới/chỉnh sửa thông tin vụ việc.
- **AssignInvestigatorModal**: Modal phân công cán bộ thụ lý.
- **ProsecutionModal**: Modal thực hiện lệnh khởi tố.
- **ExportReportsPage**: Màn hình tìm kiếm, lọc và xuất dữ liệu ra Excel/Word.
- **DistrictStatisticsPage**: Màn hình xem biểu đồ (tròn, đường) theo quận/huyện.
- **OverdueRecordsPage**: Màn hình hiển thị danh sách hồ sơ xử lý trễ hạn (cảnh báo đỏ/vàng).
- **ActivityLogPage**: Màn hình xem nhật ký thao tác trên toàn hệ thống.

## 2. Screen Definitions
### 2.1 IncidentListPage
- **Layout**: MainLayout với sidebar.
- **Header**: Tiêu đề "Quản lý Vụ việc", nút "Thêm vụ việc".
- **Filters**: 
    - Search input: Mã vụ việc, Tên vụ việc.
    - Select: Trạng thái (Pending, Investigating, Suspended, Completed, Overdue).
    - Select: Điều tra viên thụ lý.
- **Table Columns**: STT, Mã vụ việc (VV-YYYY-XXX), Tên vụ việc, Loại vụ việc, ĐV Thụ lý, ĐTV Thụ lý, Hạn xử lý, Trạng thái (Badge), Thao tác (Icon menu).

### 2.2 IncidentFormPage
- **Fields**: Tên vụ việc (Input), Loại vụ việc (Select), Mô tả (Textarea), Từ ngày (Date), Đến ngày (Date).
- **Validation**: Tên vụ việc bắt buộc, Từ ngày không được lớn hơn Đến ngày.

### 2.3 Quản lý Báo cáo & Thống kê
- **Layout**: Thừa kế MainLayout.
- **ExportReportsPage**: Header "Xuất báo cáo", Filter Bar (Từ/Đến ngày, Người tạo), Nút "Xuất Excel/Word", Table dữ liệu.
- **DistrictStatisticsPage**: Recharts container hiển thị biểu đồ. Dropdown chọn Tiêu chí thống kê.
- **ActivityLogPage**: Thanh filter nhiều điều kiện (User, Hành động, Thời gian). Bảng timeline dọc hoặc lưới ngang có xem chi tiết (drawer).

## 3. Field Definitions (TABLE 2.2.A)
| Field | Required | Type | Min | Max | Format | Business Rule |
|-------|----------|------|-----|-----|--------|---------------|
| Tên vụ việc | Yes | String | 5 | 255 | Text | Tóm tắt sự việc |
| Mã vụ việc | Yes | String | - | - | VV-YYYY-XXX | Tự động sinh, Duy nhất |
| Từ ngày | Yes | Date | - | - | YYYY-MM-DD | ≤ Đến ngày |
| Đến ngày | Yes | Date | - | - | YYYY-MM-DD | |
| Deadline | No | Date | - | - | YYYY-MM-DD | Chỉ nhập khi Phân công |
| Từ ngày (Báo cáo) | Yes | Date | - | - | YYYY-MM-DD | Phải trước/bằng Đến ngày |
| Đến ngày (Báo cáo) | Yes | Date | - | - | YYYY-MM-DD | Phải sau/bằng Từ ngày |

## 4. Field State Logic (TABLE 2.2.B)
| Field | Default | Show When | Disable When |
|-------|---------|-----------|--------------|
| ĐTV Thụ lý | null | Always | Trạng thái = DA_GIAI_QUYET |
| Nút Khởi tố | - | Trạng thái = DANG_XAC_MINH | Trạng thái != DANG_XAC_MINH |

## 5. Form Submission (TABLE 2.2.E)
| Step | Action | Validation | Confirm Dialog | On Success |
|------|--------|------------|----------------|------------|
| Tạo mới | Click Lưu | Field Validation | No | Toast Success + Redirect |
| Phân công | Click Xác nhận | Chọn ĐTV + Deadline | Yes | Close Modal + Refresh List |
| Khởi tố | Click Khởi tố | Nhập số QĐ | Yes | Redirect to Case Detail |

## 6. Error Display (TABLE 2.2.F)
| Error Type | Location | Format | Duration |
|------------|----------|--------|----------|
| Validation | Inline | Text (Red) | Permanent until fixed |
| API Error | Toast | Notification | 5 seconds |
| Conflict | Modal | Alert | Until closed |
