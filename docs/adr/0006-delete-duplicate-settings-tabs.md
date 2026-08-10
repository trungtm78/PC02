# ADR-0006: Xoá ba tab mockup ở `/settings` thay vì hiện thực chúng

- **Trạng thái**: Đề xuất (sẽ chấp nhận khi PR-C1 merge)
- **Ngày**: 2026-08-10
- **Liên quan**: PR-C1, `frontend/src/pages/settings/SettingsPage.tsx`

## Bối cảnh

Ba tab của `/settings` là mockup hoàn toàn:

- **Người dùng** (`:115-119`) — bảng ba người bịa: `Nguyễn Văn A / nguyenvana@pc02.gov.vn`, `Trần Thị B`, `Lê Văn C`.
- **Phân quyền** (`:151-224`) — `roles` và `permissions` viết cứng; nút "Thêm vai trò mới" không có `onClick`; checkbox không có `onChange`; nút "Lưu thay đổi" không có `onClick`.
- **Tham số** (`:363-410`) — năm tham số viết cứng, input không có `onChange`, nút Lưu không có `onClick`.

Yêu cầu của người dùng là "không cho phép chỉ là mockup". Cách đọc thẳng là nối ba tab này vào API thật.

Nhưng cả ba chức năng **đã tồn tại và đã chạy thật** ở nơi khác: `/nguoi-dung` (quản lý user + tab Vai trò & Phân quyền đầy đủ, có bulk import, reset 2FA) và `/admin/settings` (CRUD `SystemSetting` thật). Cả hai đều đã có mục trong sidebar.

## Quyết định

Xoá ba tab. Thay bằng một khối "Quản trị nâng cao" chứa hai liên kết sang hai trang thật.

## Hệ quả

- Không còn dữ liệu bịa trên màn hình quản trị.
- Không sinh ra hai nơi cùng làm một việc — thứ chắc chắn sẽ lệch nhau về sau.
- PR này **xoá code**, dễ bị đọc nhầm là giảm tính năng. Mô tả PR phải nêu rõ hai trang thay thế và vị trí của chúng trong sidebar.
- Một số test đang khoá nội dung giả (`'Quản lý ngườI dùng'`, `nguyenvana@pc02.gov.vn`, `'Kích thước file tối đa'`) sẽ bị xoá theo. Tổng số test giảm ở PR-C1 rồi tăng lại từ PR-C5.

## Phương án đã cân nhắc và loại bỏ

**Nối ba tab vào API thật.** Backend đã có đủ (`GET /admin/users`, `/admin/roles`, `/admin/permissions`, `PATCH /admin/roles/:id/permissions`, `GET|PUT /settings`), nên về kỹ thuật là làm được. Loại vì kết quả là hai màn hình quản lý user, hai ma trận phân quyền, hai trang tham số — và bản mới sẽ lại thiếu bulk import, enrollment link, reset 2FA vốn chỉ có ở `/nguoi-dung`.

## Điều kiện xem lại

Nếu `/settings` được định vị lại thành trang cấu hình duy nhất và `/nguoi-dung` bị gộp vào đó. Đó là một quyết định thông tin kiến trúc, không phải việc lấp mockup.
