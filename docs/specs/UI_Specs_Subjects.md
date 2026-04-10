# UI Specs - Quản lý đối tượng (Subjects)
Path: docs/specs/UI_Specs_Subjects.md | Layer: UI_UX | Version: v1.0 | Action: CREATE | TASK_ID: TASK-2026-261224

## 1. Screen Inventory
- `ObjectList`: Danh sách đối tượng (Bị can/Bị cáo). Route: `/people/suspects` (mapped to `ObjectListPage`).
- `ObjectForm`: Modal thêm mới và chỉnh sửa thông tin đối tượng.

## 2. Field Definitions (TABLE 2.2.A)
| Field | Required | Type | Format | Business Rule |
|-------|----------|------|--------|---------------|
| Họ tên | Yes | Text | Tên riêng | Chuyển hoa chữ cái đầu |
| Ngày sinh | Yes | Date | DD/MM/YYYY | Không được lớn hơn ngày hiện tại |
| CCCD/CMND| Yes | Text | 9 hoặc 12 số | Phải duy nhất trong hệ thống |
| Địa chỉ | Yes | Text | - | Địa chỉ chi tiết |
| Tội danh | Yes | FKSelect| Categories | Lấy từ danh mục CRIME |
| Vụ án | Yes | FKSelect| Cases | Lấy từ danh sách Vụ án đang thụ lý |

## 3. Field State Logic (TABLE 2.2.B)
| Field | Default | Enable When | ReadOnly When |
|-------|---------|-------------|---------------|
| Phường/Xã | Empty | Quận/Huyện được chọn | Quận/Huyện trống |
| CCCD/CMND | Empty | Always | Khi ở chế độ Edit (tùy policy) |

## 4. Cascade (MAP 2.2.C)
- [Quận/Huyện] -> [Phường/Xã] -> [Action: filter + reset child]

## 5. Form Submission (TABLE 2.2.E)
| Step | Action | Validation | Confirm Dialog | On Success |
|------|--------|------------|----------------|------------|
| 1 | Click Lưu | Check Required | Không | Đóng modal + Toast thành công |
| 2 | Duplicate ID| Check API | Không | Hiển thị thông báo lỗi tại field |

## 6. Figma Refs
- Pattern: `Refs/SuspectsList.tsx` (Colors: Slate-800, Blue-600)
- Icons: Lucide (Shield, User, Gavel, MapPin)
