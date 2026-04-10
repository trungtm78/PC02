# System-UI_Specs — Đặc tả giao diện phân hệ Hệ thống

Path: docs/specs/System-UI_Specs.md | Layer: UI_UX | Version: v1.0.0 | Action: CREATE | TASK_ID: TASK-2026-022601 | EXECUTION_ID: INTAKE-20260226-001-7F3A

# 1. Screen Inventory
- Dashboard Overview: Hiển thị thống kê tổng quan.
- System Calendar: Quản lý lịch biểu và sự kiện.
- Global Settings Layout: Cấu hình hệ thống và người dùng.
- FKSelection Shared Component: Component chọn dữ liệu dùng chung.

# 2. Field Definitions (TABLE 2.2.A)
| Field | Required | Type | Min | Max | Format | Business Rule |
|-------|----------|------|-----|-----|--------|---------------|
| Tên sự kiện | YES | String | 3 | 100 | Text | Không chứa mã script, tag HTML |
| Ngày bắt đầu | YES | Date | N/A | N/A | YYYY-MM-DD | Phải lớn hơn hoặc bằng ngày hiện tại |
| Loại sự kiện | YES | Enum | N/A | N/A | Selection | Thuộc danh mục loại sự kiện |

# 3. Field State Logic (TABLE 2.2.B)
| Field | Default | Show When | Hide When | Enable When | Disable When |
|-------|---------|-----------|-----------|-------------|--------------|
| Nút (+) tạo mới | Hidden | usePermission(res, 'create') | default | Always | N/A |
| Input tìm kiếm | Visible | Always | N/A | Always | N/A |

# 4. Data Loading (TABLE 2.2.D)
| Field | Load Type | Trigger | Debounce | Pagination |
|-------|-----------|---------|----------|------------|
| FK Search | Lazy | Type in input | 300ms | 10 items |
| Dashboard Stats| Eager | Component Mount | N/A | N/A |
| Event List | Eager | Component Mount/Filter change | N/A | N/A |
