# UI Specs: Quản lý Vụ việc
Path: docs/specs/IncidentManagement-UI_Specs.md | Layer: UI_UX | Version: 1.0.0 | Action: CREATE | TASK_ID: TASK-2026-260202 | EXECUTION_ID: INTAKE-20260226-001-C4D1

## 1. Screen Inventory
| Screen ID | Screen Name | Path | Description |
|-----------|-------------|------|-------------|
| SCR-INC-01 | Incident List | /incidents | Danh sách vụ việc và bộ lọc tìm kiếm |
| SCR-INC-02 | Incident Form | /incidents/new, /incidents/:id/edit | Form thêm/sửa vụ việc |
| SCR-INC-03 | Incident Detail | /incidents/:id | Xem chi tiết vụ việc và thao tác nghiệp vụ |

## 2. Screen Definitions
### SCR-INC-01: Incident List
- Header: Title "Quản lý Vụ việc", Action buttons (Thêm mới, Tìm kiếm nâng cao, Xuất Excel).
- Filter Bar: Quck status buttons, Search input (Mã, Tên, ĐTV).
- Data Table: Danh sách vụ việc với pagination.
- Interaction: Click "Mắt" -> Detail, Click "Sửa" -> Form, Click "More" -> Nghiệp vụ.

## 3. Field Definitions
(TABLE 2.2.A từ ANALYSIS_PACKAGE)

## 4. Field State Logic
| Field | Default | Show When | Disable When |
|-------|---------|-----------|--------------|
| Số quyết định | Empty | Status = "Khởi tố" | Status != "Khởi tố" |

## 5. Cascade
N/A

## 6. Data Loading
- Load Type: REST API (Fetch).
- Trigger: Page Mount / Filter change.
- Pagination: 10/20 rows per page.

## 7. Form Submission
- Action: "Lưu" button.
- Validation: Client-side (React Hook Form).
- Confirm Dialog: "Khởi tố" và "Tạm đình chỉ" yêu cầu xác nhận.

## 8. Error Display
- Location: Inline dưới input field và Toast cho lỗi server.

## 9. Figma Refs
N/A (Sử dụng design pattern từ /Refs)

## 10. Accessibility
- Tab navigation support.
- Aria labels cho action buttons.
