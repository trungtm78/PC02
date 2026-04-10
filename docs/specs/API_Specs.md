# API_Specs — Quản lý Vụ án

Path: docs/specs/API_Specs.md | Layer: API | Version: v1.0.0 | Action: CREATE | TASK_ID: TASK-2026-000007 | EXECUTION_ID: INTAKE-20260226-001-K9A2

## 1. Overview
- **Base URL**: `/api/v1`
- **Auth**: JWT Bearer Token
- **Content-Type**: application/json

## 2. Endpoints

### GET /cases
Lấy danh sách hồ sơ vụ án.
- **Query Params**:
  - `status`: String (Lọc theo trạng thái)
  - `q`: String (Tìm kiếm theo tên/id)
  - `page`, `limit`: Pagination
- **Response 200**: Array of Case objects.

### GET /cases/:id
Lấy chi tiết một vụ án.

### POST /cases
Tạo mới vụ án.
- **Body**: `{ name, crime, investigatorId, deadline, unit, ... }`

### PATCH /cases/:id
Cập nhật thông tin vụ án.

### GET /subjects
Lấy danh sách đối tượng. Filter theo `type` (SUSPECT, VICTIM, WITNESS).

### GET /lawyers
Lấy danh sách luật sư.

### POST /lawyers
Gán luật sư cho vụ án/bị can.

### GET /dashboard/stats
Lấy dữ liệu thống kê nhanh (tổng số, mới, quá hạn, đã xử l).

### GET /dashboard/charts
Lấy dữ liệu biểu đồ cho Dashboard (Line chart & Pie chart).

### GET /calendar/events
Lấy danh sách sự kiện kèm bộ lọc theo loại/ngày.

### POST /calendar/events
Tạo mới sự kiện hoặc lịch hẹn.

## 3. Common Error Codes
- 400: Validation Error.
- 401: Unauthorized.
- 403: Forbidden (Không có quyền thao tác).
- 404: Case not found.
