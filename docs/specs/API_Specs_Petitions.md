# API_Specs — Quản lý Đơn thư

Path: docs/specs/API_Specs_Petitions.md | Layer: API | Version: v1.0.0 | Action: CREATE | TASK_ID: TASK-2026-260202 | EXECUTION_ID: INTAKE-20260226-001-B7C9

## 1. Overview
- **Base URL**: `/api/v1/petitions`
- **Auth**: JWT Bearer Token
- **Content-Type**: application/json

## 2. Endpoints

### GET /
Lấy danh sách đơn thư.
- **Query Params**:
  - `status`: String (classified, transferred, guided, archived, converted_incident)
  - `q`: String (Search by STT, senderName, summary)
  - `fromDate`, `toDate`: Date filter
  - `district`: String
- **Response 200**: `[{ id, stt, senderName, summary, status, ... }]`

### GET /:id
Lấy chi tiết đơn thư.

### POST /
Tiếp nhận đơn thư mới.
- **Body**: `{ stt, receivedDate, senderName, summary, ... }`

### PATCH /:id
Cập nhật thông tin đơn thư.

### POST /:id/convert-incident
Chuyển đổi đơn thư thành vụ việc.
- **Body**: `{ incidentName, incidentType, description, assignedTo }`
- **Logic**: Tạo bản ghi Incident mới, cập nhật trạng thái Petition thành `converted_incident` và gắn `linkedIncidentId`.

### POST /:id/convert-case
Chuyển đổi đơn thư thành vụ án.
- **Body**: `{ caseName, crime, jurisdiction, suspect, prosecutionDecision, prosecutionDate }`
- **Logic**: Tạo bản ghi Case mới, cập nhật trạng thái Petition thành `converted_case` và gắn `linkedCaseId`.

## 3. Error Codes
- 400: Validation Error (Thiếu trường bắt buộc).
- 403: Forbidden (Không có quyền xử lý đơn thư này).
- 404: Petition not found.
- 409: Conflict (Đơn thư đã được chuyển đổi trước đó).

## 4. Enum Deviation Note (TASK-2026-260202)
**ARTIFACT_DEVIATION — Approved:**
Spec ban đầu dùng `converted_incident`/`converted_case` (tiếng Anh).
Implementation dùng enum tiếng Việt từ Prisma schema:
| Spec value          | Implementation value   | Ý nghĩa                    |
|---------------------|------------------------|----------------------------|
| `converted_incident`| `DA_CHUYEN_VU_VIEC`    | Đã chuyển thành Vụ việc    |
| `converted_case`    | `DA_CHUYEN_VU_AN`      | Đã chuyển thành Vụ án      |
| `classified`        | `MOI_TIEP_NHAN`        | Mới tiếp nhận               |
| `transferred`       | `DANG_XU_LY`           | Đang xử lý                 |
| `archived`          | `DA_LUU_DON`           | Đã lưu đơn                 |

**Justification:** Toàn bộ hệ thống dùng enum tiếng Việt để đồng nhất với Prisma schema và nghiệp vụ PC02.
Spec sẽ được cập nhật trong version v1.1.0 khi có DB migration thực tế.
