# Functional Requirements Document (FRD) - Case Management

**Path**: docs/specs/FRD.md | **Version**: v1.1.1 | **TASK_ID**: TASK-2026-000007 | **EXECUTION_ID**: INTAKE-20260226-001-K9A2

## 1. Feature Overview
Module Quản lý vụ án bao gồm các chức năng chính:
- Danh sách vụ án (với bộ lọc 10 trạng thái).
- Xem và sửa thông tin vụ án.
- Danh sách tổng hợp và xử lý hồ sơ ban đầu.
- Sửa lỗi hiển thị tiếng Việt (I18N).

## 2. Functional Requirements
| FR-ID | Description | Priority | AC Mapping |
|-------|-------------|----------|------------|
| FR-01 | Hiển thị menu Quản lý vụ án trong sidebar (có dấu). | HIGH | AC-02 |
| FR-02 | Hiển thị bảng danh sách vụ án với tiếng Việt có dấu đúng chuẩn. | HIGH | AC-02 |
| FR-03 | Bộ lọc trạng thái 10 bước (Tiếp nhận -> Lưu trữ). | HIGH | AC-01 |
| FR-04 | Chức năng Xóa vụ án (với xác nhận an toàn). | HIGH | AC-03 |
| FR-05 | Chức năng Sửa vụ án và đồng bộ DB. | HIGH | AC-04 |
| FR-06 | Tự động đánh dấu hồ sơ Quá hạn (deadline < today). | MED | AC-05 |
| FR-07 | Quản lý danh sách Bị hại và Nhân chứng (CRUD). | HIGH | AC-01 |
| FR-08 | Quản lý danh sách Luật sư và gán cho Bị can/Vụ án. | HIGH | AC-02 |
| FR-14 | Hiển thị Summary Statistics động theo loại đối tượng (Bị can, Bị hại, Nhân chứng). | HIGH | AC-01 |
| FR-15 | Tính năng "Thêm bị hại" trực tiếp từ trang danh sách bị hại. | HIGH | AC-01 |
| FR-09 | Tích hợp Tab "Đối tượng liên quan" vào Chi tiết vụ án. | HIGH | AC-03 |
| FR-10 | Phân hệ Quản lý đơn thư (Tiếp nhận, CRUD). | HIGH | AC-01 (SL-TASK-2026-260202) |
| FR-11 | Chuyển đổi Đơn thư thành Vụ việc/Vụ án. | HIGH | AC-03 (SL-TASK-2026-260202) |
| FR-12 | Cảnh báo quá hạn xử lý đơn thư. | MED | AC-04 (SL-TASK-2026-260202) |
| FR-13 | Xem chi tiết Đơn thư (Read-only mode). | HIGH | AC-01 (SL-TASK-2026-260203) |
| FR-16 | Xem danh sách Xuất báo cáo (Excel, Word). | MED | AC-01 (SL-TASK-2026-022601) |
| FR-17 | Xem biểu đồ Thống kê theo ngày và quận/huyện. | MED | AC-02, AC-03 (SL-TASK-2026-022601) |
| FR-18 | Lọc và xem danh sách Hồ sơ trễ hạn. | MED | - (SL-TASK-2026-022601) |
| FR-19 | Xem Nhật ký nghiệp vụ toàn hệ thống. | HIGH | - (SL-TASK-2026-022601) |
| FR-20 | Màn hình Tổng quan hiển thị Dashboard thống kê hồ sơ và biểu đồ xu hướng. | HIGH | AC-01 |
| FR-21 | Màn hình Lịch làm việc quản lý sự kiện, deadline vụ án với giao diện Grid tháng. | HIGH | AC-02 |
| FR-22 | Màn hình Cài đặt hệ thống quản lý Người dùng, Phân quyền, Danh mục và Tham số. | HIGH | AC-04 |
| FR-23 | Component FK Selection hỗ trợ tìm kiếm và tạo mới nhanh (nếu có quyền). | HIGH | AC-03 |

## 3. Workflow
(Giữ nguyên luồng cơ bản)
### Luồng Lọc & Thao tác:
1. Người dùng chọn trạng thái trên thanh lọc nhanh.
2. Danh sách cập nhật real-time từ API.
3. Người dùng chọn Sửa/Xóa.

## 4. Business Logic
- Quyền Sửa/Xóa chỉ dành cho Điều tra viên phụ trách hoặc Admin.
- Không cho phép xóa vụ án đã có kết luận (quy chuẩn nghiệp vụ).

## 5. Data Validation (from Table 2.2.A)
(Cập nhật từ ANALYSIS_PACKAGE)

## 6. Error Handling
(Giữ nguyên)

## 7. Edge Cases
- EC-06: Xóa vụ án đang có liên kết dữ liệu nghiệp vụ (Bị can/Luật sư).

## 8. Integration Points
- Backend API /api/v1/cases.
