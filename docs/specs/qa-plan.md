# QA & Verification Plan — UI Mismatch Fix
Path: docs/specs/qa-plan.md | Version: v1.0.0 | TASK_ID: TASK-2026-000004

## 1. Verification Strategy
Tập trung vào kiểm thử trực quan (Visual) và luồng nghiệp vụ cơ bản (Auth).

## 2. E2E Scenarios (Playwright)

### UAT-SC-01: Login Visual Compliance
- **Given**: Người dùng ở trang Login.
- **When**: Trang load thành công.
- **Then**: 
  - Màu nền header khớp với spec (#003973).
  - Logo PNG hiển thị thay cho icon.
  - Text chuyển sang tiếng Việt.

### UAT-SC-02: Sidebar Nested Navigation & Coming Soon
- **Given**: Admin đã đăng nhập thành công.
- **When**: Click vào menu "Kiến nghị VKS" (một mục chưa hiện thực).
- **Then**: 
  - Hệ thống chuyển hướng thành công đến trang "Sắp ra mắt".
  - Tiêu đề trang hiển thị đúng tên mục đã chọn.

### UAT-SC-03: Create New Case (10 Tabs)
- **Given**: Người dùng ở màn hình thêm mới vụ án.
- **When**: Điền đầy đủ Tab 1 (Thông tin chung) và nhấn "Lưu".
- **Then**: Hồ sơ được tạo, chuyển hướng về danh sách, hiển thị Record mới.

### UAT-SC-04: Media Upload Validation
- **Given**: Người dùng ở Tab Media của một vụ án.
- **When**: Upload file video .mp4.
- **Then**: File xuất hiện trong danh sách media với nút "Xem" và "Tải về".

## 3. UI Element Catalog
- `CaseList`: `[data-testid="case-table"]`, `[data-testid="add-case-btn"]`
- `CaseForm`: `[data-testid="tabs-list"]`, `[data-testid="save-case-btn"]`
- `LoginPage`: `#email`, `#password`, `button[type="submit"]`
- `AppSidebar`: `[data-testid="main-sidebar"]`, `[data-testid="sidebar-search"]`

## 4. Screenshot Specification
Yêu cầu Opencode chụp các ảnh sau:
1. `case-list-step01-all.png`: Danh sách vụ án tổng thể.
2. `case-form-step01-tab-info.png`: Tab Thông tin chung.
3. `case-form-step02-tab-media.png`: Tab Media sau khi upload.
4. `login-step01-visual.png`: Màn hình login tổng thể.
