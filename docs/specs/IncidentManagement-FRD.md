# FRD: Quản lý Vụ việc
Path: docs/specs/IncidentManagement-FRD.md | Layer: Functional | Version: 1.0.0 | Action: CREATE | TASK_ID: TASK-2026-260202 | EXECUTION_ID: INTAKE-20260226-001-C4D1

## 1. Feature Overview
Chức năng Quản lý Vụ việc cho phép người dùng tiếp nhận, theo dõi và xử lý các vụ việc điều tra từ giai đoạn tiếp nhận nguồn tin đến khi có kết luận hoặc chuyển đổi thành vụ án.

## 2. Functional Requirements
| FR-ID | Description | Priority | AC Mapping |
|-------|-------------|----------|------------|
| FR-01 | Xem danh sách vụ việc với đầy đủ cột thông tin: STT, Mã/Tên, Ngày, Đơn vị, Người nhập, Điều tra viên, Hạn xử lý, Trạng thái. | HIGH | AC-01 |
| FR-02 | Thêm mới vụ việc với form chi tiết (kế thừa pattern từ AddNewRecord.tsx). | HIGH | AC-02 |
| FR-03 | Phân công điều tra viên chính/phối hợp cho vụ việc. | HIGH | N/A |
| FR-04 | Khởi tố vụ việc thành vụ án (chuyển đổi dữ liệu tự động). | HIGH | AC-03 |
| FR-05 | Tạm đình chỉ xử lý vụ việc. | MEDIUM | N/A |
| FR-06 | Phục hồi xử lý nguồn tin vụ việc. | MEDIUM | N/A |

## 3. Workflow
1. Tiếp nhận nguồn tin -> Tạo Vụ việc (Chờ xử lý).
2. Phân công Điều tra viên -> Vụ việc (Đang xác minh).
3. Xác minh vụ việc -> Cập nhật tiến độ.
4. Kết quả xác minh:
   - Khởi tố -> Chuyển thành Vụ án.
   - Không khởi tố -> Kết thúc.
   - Tạm đình chỉ -> Tạm dừng theo dõi.

## 4. Business Logic
- Vụ việc quá hạn: Hiển thị badge "Quá hạn" nếu `Today > Deadline`.
- Khởi tố: Khi nhấn khởi tố, hệ thống phải yêu cầu nhập `Số quyết định` và `Ngày quyết định`, sau đó copy dữ liệu sang phân hệ Quản lý Vụ án.

## 5. Data Validation
(Copy từ TABLE 2.2.A của ANALYSIS_PACKAGE)
| Field | Required | Type | Min | Max | Format | Business Rule |
|-------|----------|------|-----|-----|--------|---------------|
| Tên vụ việc | Yes | String | 10 | 255 | N/A | Phải mô tả rõ nội dung |
| Ngày xảy ra | Yes | Date | N/A | Today | DD/MM/YYYY | Không được ở tương lai |

## 6. Error Handling
- Hiển thị lỗi validation ngay trên field hoặc qua Sonner toast.

## 7. Edge Cases
- EC-01: Chuyển Vụ việc sang Vụ án khi thông tin chưa đủ.
- EC-02: Tìm kiếm Vụ việc với tiếng Việt có dấu/không dấu.
- EC-04: Tạm đình chỉ vụ việc đã quá hạn xử lý.

## 8. Integration Points
- Sidebar: Thêm menu "Quản lý Vụ việc".
- Case Management: Module chuyển tiếp dữ liệu sang Vụ án.
