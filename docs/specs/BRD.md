# Business Requirements Document (BRD) - Case Management

**Path**: docs/specs/BRD.md | **Version**: v1.0.0 | **TASK_ID**: TASK-2026-000006 | **EXECUTION_ID**: INTAKE-20260226-003-BUS01

## 1. Business Context
Hệ thống Quản lý vụ án PC02 là công cụ hỗ trợ cán bộ điều tra trong việc theo dõi, quản lý hồ sơ vụ án, vụ việc, đối tượng và vật chứng. Module "Quản lý vụ án" là trung tâm của hệ thống, giúp số hóa quy trình quản lý hồ sơ từ lúc tiếp nhận đến khi kết thúc.

## 2. Business Rules
| Rule ID | Rule | Source | Priority |
|---------|------|--------|----------|
| BR-01 | Mã hồ sơ phải tuân thủ format HS-YYYY-NNN và là duy nhất. | Quy định PC02 | HIGH |
| BR-02 | Mỗi hồ sơ phải có ít nhất một người xử lý (Điều tra viên). | Quy định nghiệp vụ | HIGH |
| BR-03 | Chỉ những người có thẩm quyền mới được phép xóa hồ sơ. | RBAC Spec | MED |

## 3. User Stories
- **US-01**: Là Điều tra viên, tôi muốn xem danh sách các vụ án đang phụ trách để quản lý tiến độ.
- **US-02**: Là cán bộ tiếp nhận, tôi muốn thêm mới hồ sơ vụ án với đầy đủ 10 trường thông tin nghiệp vụ.
- **US-03**: Là lãnh đạo, tôi muốn xem danh sách tổng hợp tất cả vụ án trong đơn vị.

## 4. Actors & Permissions
- **Điều tra viên**: Xem, Thêm, Sửa hồ sơ mình phụ trách.
- **Lãnh đạo đơn vị**: Xem tất cả, Phê duyệt hồ sơ.
- **Admin**: Quản lý danh mục và cấu hình hệ thống.

## 5. Non-Functional Requirements (NFR)
- **Bảo mật**: Dữ liệu vụ án là tuyệt mật.
- **Hiệu năng**: Thời gian tải danh sách < 2s cho 1000 records.
- **Sẵn sàng**: Hệ thống hoạt động 24/7.

## 6. Acceptance Criteria (AC)
- AC-01: Given user is logged in When looking at Sidebar Then "Quản lý vụ án" is visible under "Nghiệp vụ chính".
- AC-02: Given Sidebar is open When clicking "Danh sách vụ án" Then URL changes to /cases and CaseList is displayed.
- AC-03: Given on /cases page When clicking "Thêm vụ án mới" Then URL changes to /add-new-record and CaseForm is displayed.
- AC-04: Given on CaseForm page When filling all required fields and clicking "Lưu hồ sơ" Then a success alert is shown.

## 7. Out of Scope
- Quy trình phê duyệt điện tử (Workflow Approval) - Sẽ thực hiện ở phase sau.
- Tích hợp dữ liệu từ hệ thống ngoài.
