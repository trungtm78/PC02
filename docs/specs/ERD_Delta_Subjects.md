# ERD Delta - Quản lý đối tượng (Subjects)
Path: docs/specs/ERD_Delta_Subjects.md | Layer: DATA | Version: v1.1 | Action: UPDATE | TASK_ID: TASK-2026-261224

## 1. Entity Overview
Bổ sung thực thể `Subject` (Đối tượng) để quản lý thông tin bị can, bị cáo trong hệ thống. Thực thể này liên kết với `Case` (Vụ án) và các danh mục hệ thống (`Directory`).

## 2. Tables

### Table: subjects
| Column | Type | Nullable | Default | FK | Description |
|--------|------|----------|---------|----|-------------|
| id | String | No | cuid() | No | Primary Key |
| fullName | String | No | - | No | Họ và tên đầy đủ |
| dateOfBirth | DateTime | No | - | No | Ngày tháng năm sinh |
| gender | String | No | - | No | Giới tính |
| idNumber | String | No | - | No | CCCD/CMND (Unique) |
| address | String | No | - | No | Địa chỉ thường trú/tạm trú |
| phone | String | Yes | - | No | Số điện thoại liên lạc |
| occupationId | String | Yes | - | Yes | Nghề nghiệp (Directories) |
| nationalityId| String | Yes | - | Yes | Quốc tịch (Directories) |
| districtId | String | Yes | - | Yes | Quận/Huyện (Directories) |
| wardId | String | Yes | - | Yes | Phường/Xã (Directories) |
| caseId | String | No | - | Yes | Vụ án liên quan (Cases) |
| crimeId | String | No | - | Yes | Tội danh chính (Directories) |
| status | String | No | "INVESTIGATING" | No | Trạng thái (INVESTIGATING, DETAINED, etc) |
| notes | String | Yes | - | No | Ghi chú thêm |
| createdAt | DateTime | No | now() | No | Thời điểm tạo |
| updatedAt | DateTime | No | updated() | No | Thời điểm cập nhật |

## 3. Relationships
- `Subject` (n) -> (1) `Case`: Mỗi đối tượng thuộc về một vụ án.
- `Subject` (n) -> (1) `Directory`: Liên kết với danh mục tội danh, nghề nghiệp, quốc tịch, địa bàn.

## 4. Indexes
- `@@unique([idNumber])`: Đảm bảo không trùng số định danh.
- `@@index([caseId])`: Tối ưu tìm kiếm đối tượng theo vụ án.
- `@@index([fullName])`: Tối ưu tìm kiếm theo tên.

## 5. Migration Plan
1. `npx prisma migrate dev --name add_subject_model`: Tạo bảng subjects mới.
2. Kiểm tra các ràng buộc khóa ngoại với bảng `cases` và `directories`.
