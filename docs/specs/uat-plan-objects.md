# UAT Plan - Quản lý đối tượng

Path: docs/specs/uat-plan-objects.md | Layer: Testing | Version: v1.0.0 | Action: CREATE | TASK_ID: TASK-2026-261225

## 1. Mục tiêu
Đảm bảo các chức năng quản lý Bị hại, Nhân chứng, Luật sư hoạt động đúng nghiệp vụ và tích hợp chính xác vào Vụ án.

## 2. Kịch bản kiểm thử (Scenarios)

| ID | Mô tả kịch bản | Kết quả mong đợi |
|----|----------------|-----------------|
| UAT-OBJ-01 | Thêm mới Bị hại từ trang Danh sách Bị hại | Bản ghi được lưu với type 'VICTIM', xuất hiện trong danh sách. |
| UAT-OBJ-02 | Thêm mới Nhân chứng từ trang Danh sách Nhân chứng | Bản ghi được lưu với type 'WITNESS'. |
| UAT-OBJ-03 | Gán Luật sư cho Bị can trong Vụ án | Luật sư xuất hiện ở tab Luật sư trong chi tiết vụ án đó. |
| UAT-OBJ-04 | Kiểm tra lọc FK (Quận -> Phường) | Khi chọn Quận, danh sách Phường chỉ hiển thị các phường thuộc quận đó. |
| UAT-OBJ-05 | Kiểm tra tính duy nhất của CCCD | Không cho phép lưu 2 đối tượng cùng số CCCD (trừ soft-delete). |

## 3. Tiêu chí nghiệm thu (AC)
- [ ] AC-01: CRUD Bị hại/Nhân chứng thành công.
- [ ] AC-02: Gán và hiển thị quan hệ Luật sư - Bị can thành công.
- [ ] AC-03: Tab "Đối tượng liên quan" hiển thị đúng dữ liệu liên kết.
