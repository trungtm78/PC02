# ADR-0005: Danh mục do Nhà nước ban hành chỉ nạp bằng seed, không có CRUD

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: `backend/prisma/seed-crimes-blhs2015.ts`, `seed-admin-units.ts`, `seed-permissions.ts`, `backend/src/legacy-migration/cli/`

## Bối cảnh

Rà soát vòng đời dữ liệu tìm ra một số model không có endpoint tạo nào — chỉ sinh ra từ seed hoặc CLI. Nhìn theo tiêu chí "mọi chức năng phải có nơi tạo data" thì đây là lỗ hổng.

Nhưng không phải model nào cũng nên có UI tạo.

## Quyết định

Chấp nhận seed-only cho:

| Model | Vì sao |
|---|---|
| `Crime` | Danh mục tội danh BLHS 2015 do Quốc hội ban hành. Cán bộ không được thêm tội danh. |
| `AdminUnitDatasetImport`, dữ liệu đơn vị hành chính | Địa giới hành chính do Nhà nước công bố. Sửa tay là làm sai dữ liệu gốc. |
| `Permission` | Sinh ra từ code — mỗi permission chỉ có nghĩa vì có một `@RequirePermissions` tương ứng. Đã có đường ghi gián tiếp qua `PATCH /admin/roles/:id/permissions` (upsert). |
| `LegacyStaging`, `LegacyImportRun`, `LegacyImportError`, `LegacyUnitAlias` | Vùng làm việc của CLI di trú chạy một lần. `POST /legacy-migration/dry-run\|commit` nhận `records[]` trong body, **không** đọc staging, nên chúng không phải consumer của bảng này. |

Ghi lý do vào JSDoc của controller/service tương ứng thay vì đẻ UI.

## Hệ quả

- Cập nhật danh mục pháp lý cần một lần deploy kèm seed. Đúng với tần suất thay đổi của chúng.
- Người rà soát về sau nhìn thấy "model không có POST" sẽ đọc được lý do ngay tại chỗ, thay vì kết luận là thiếu sót.

## Phương án đã cân nhắc và loại bỏ

**Làm CRUD cho `Crime` và đơn vị hành chính.** Loại vì nó biến dữ liệu pháp lý chuẩn thành dữ liệu ai cũng sửa được, và không có quy trình duyệt nào đứng sau.

## Điều kiện xem lại

Khi luật đổi đủ thường xuyên để một lần deploy trở thành trở ngại thật, hoặc khi cần một quy trình duyệt hai bước cho danh mục pháp lý. Lúc đó nó giống `DeadlineRuleVersion` hơn là một CRUD.
