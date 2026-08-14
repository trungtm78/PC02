# ADR-0004: Không có `POST /settings` — key cấu hình phải khai báo trong code

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-A4, `backend/src/settings/settings.service.ts`

## Bối cảnh

`PUT /settings/:key` chỉ cập nhật key đã tồn tại; gửi key lạ thì trả `{success: false}`. Nghĩa là không thể thêm cấu hình mới qua API — chỉ qua `seed()`.

Nhìn qua thì đây là một CRUD khuyết chân.

Nhưng `SystemSetting` không phải dữ liệu người dùng. Nó là hợp đồng giữa code và cấu hình: mỗi key chỉ có nghĩa vì có một dòng code đọc nó. Hiện chỉ 5 key còn sống — 12 key `THOI_HAN_*` đã chuyển sang `DeadlineRuleVersion` và bị `assertNotDeadlineKey()` chặn nếu ai đó chèn tay.

## Quyết định

Không thêm `POST /settings`. Key mới được khai trong `SETTINGS_KEY` và trong mảng `defaults` của `seed()`, cùng lúc với code đọc nó.

## Hệ quả

- Không sinh ra được key rác mà không có gì đọc.
- Thêm một cấu hình cần một lần deploy. Với 5 key trong ba năm, đây không phải nút thắt.
- Người dùng thấy `/admin/settings` chỉ sửa được giá trị, không thêm được dòng. Cần nói rõ trên UI để không bị hiểu là thiếu chức năng.

## Phương án đã cân nhắc và loại bỏ

**Thêm `POST /settings` với `key`, `value`, `label`, `unit`.** Loại vì nó cho phép admin tạo cấu hình mà không có code nào đọc, và người tiếp theo mở bảng `system_settings` sẽ không phân biệt được key đang có tác dụng với key đã chết.

## Điều kiện xem lại

Khi xuất hiện một lớp cấu hình thật sự do người dùng định nghĩa (ví dụ tham số theo từng đơn vị). Lúc đó nó là một model khác, không phải `SystemSetting`.
