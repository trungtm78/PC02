# Entity Relationship Diagram (ERD) - Case Management

**Path**: docs/specs/ERD.md | **Version**: v1.1.0 | **TASK_ID**: TASK-2026-000007 | **EXECUTION_ID**: INTAKE-20260226-001-K9A2

## 1. Entity Overview
Module Quản lý vụ án tập trung vào thực thể `Case` và các quan hệ với `User` (Investigator), `Subject`, `Evidence`.

## 2. Tables
### Table: Cases
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | String | NO | PK, CUID/UUID |
| name | String | NO | Tên vụ án |
| crime | String | NO | Tội danh |
| status | String | NO | Trạng thái (10 bước) |
| investigatorId | String | NO | FK to Users |
| deadline | DateTime | YES | Hạn điều tra |
| unit | String | YES | Đơn vị thụ lý |
| subjectsCount | Int | NO | Default 0 |
| createdAt | DateTime | NO | |
| updatedAt | DateTime | NO | |

### Table: Subjects (Extended)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| type | String | NO | SUSPECT, VICTIM, WITNESS |

### Table: Lawyers
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | String | NO | PK |
| fullName | String | NO | Họ tên luật sư |
| lawFirm | String | YES | Văn phòng luật |
| barNumber | String | YES | Số thẻ luật sư |
| caseId | String | NO | FK to Cases |
| subjectId | String | YES | FK to Subjects (Client) |

### Table: Petitions
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | String | NO | PK |
| stt | String | NO | Số thứ tự/Mã đơn thư |
| createdBy | String | NO | Người nhập |
| receivedDate | DateTime | NO | Ngày tiếp nhận |
| deadline | DateTime | YES | Hạn xử lý |
| senderName | String | NO | Tên người gửi |
| summary | String | NO | Tóm tắt nội dung |
| status | String | NO | Trạng thái (classified, converted, archived...) |
| linkedCaseId | String | YES | FK to Cases (nếu đã chuyển thành vụ án) |
| linkedIncidentId| String | YES | FK to Incidents (nếu đã chuyển thành vụ việc) |

## 3. Relationships
- **User (1) --- (n) Case**: Một ĐTV phụ trách nhiều vụ án.
- **Case (1) --- (n) AuditLog**: Log thao tác trên vụ án.

## 4. Indexes
- Index on `status`, `investigatorId`.

## 5. Migration Plan
1. Cập nhật `prisma/schema.prisma`.
2. Chạy `npx prisma migrate dev --name init_cases`.
3. Seed dữ liệu mẫu (nếu cần).
