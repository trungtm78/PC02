# API Specs - Quản lý đối tượng (Subjects)
Path: docs/specs/API_Specs_Subjects.md | Layer: API | Version: v1.0 | Action: CREATE | TASK_ID: TASK-2026-261224

## 1. Endpoints

### GET /api/subjects
- **Description**: Lấy danh sách đối tượng có phân trang và lọc.
- **Query Params**: `page`, `limit`, `search`, `caseId`, `status`.
- **Response 200**: `{ items: Subject[], total: number }`.

### POST /api/subjects
- **Description**: Tạo mới đối tượng.
- **Body**: `{ fullName, dateOfBirth, idNumber, address, caseId, crimeId, ... }`.
- **Response 201**: `Subject object`.
- **Errors**: `400 Bad Request` (Validation), `409 Conflict` (Duplicate CCCD).

### PATCH /api/subjects/:id
- **Description**: Cập nhật thông tin đối tượng.
- **Body**: Partial update object.
- **Response 200**: Updated `Subject object`.

### DELETE /api/subjects/:id
- **Description**: Xóa đối tượng (Soft delete).
- **Response 204**: No content.

## 2. Common Error Codes
- `SUB-001`: Thiếu thông tin bắt buộc.
- `SUB-002`: Định dạng ngày sinh không hợp lệ.
- `SUB-003`: CCCD đã tồn tại trong hệ thống.
- `SUB-004`: Vụ án liên quan không tồn tại.
