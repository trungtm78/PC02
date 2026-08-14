# ADR-0010: Thêm giá trị enum Postgres là thao tác một chiều — rollback code không cứu được

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-D6, `scripts/deploy/rollback.sh:78-80`, migration `20260527000001`

## Bối cảnh

PR-D6 cần một giá trị mới cho enum `NotificationType` (`INCIDENT_CREATED`). Lựa chọn thay thế là dùng lại `SYSTEM`, nhưng `NotificationPreference` cho phép người dùng tắt theo từng loại — dùng `SYSTEM` nghĩa là tắt thông báo vụ việc thì tắt luôn thông báo hệ thống.

Vấn đề nằm ở chiều ngược lại. `rollback.sh:78-80` tự thú: *"DB migration NOT rolled back automatically"*. Và `deploy.sh` chạy migration **trước** khi đổi symlink, trong khi health check nằm ở bước 9 — sau khi symlink đã đổi.

Nên: deploy bản mới → phát vài notification loại mới → phát hiện sự cố → rollback code → Prisma client cũ gặp giá trị enum nó không biết → **query danh sách thông báo crash**. Không có đường lùi ngoài `pg_restore`.

## Quyết định

Chấp nhận đánh đổi và ghi lại nó, với ba ràng buộc thi công:

1. `ALTER TYPE ... ADD VALUE` nằm **một mình một file migration**. Postgres không cho dùng giá trị vừa thêm trong cùng transaction đã tạo ra nó, nên trộn với backfill sẽ fail. Tiền lệ `20260527000001` chạy được chính vì nó không backfill.
2. Không backfill dữ liệu dùng giá trị mới trong cùng lần deploy.
3. Deploy có `pg_dump` trước — đó là đường lùi thật, phải xác nhận bản dump tồn tại trước khi merge.

## Hệ quả

- Một lần deploy thêm enum là điểm không quay lại nếu không phục hồi database.
- Mọi PR thêm giá trị enum phải nêu rõ điều này trong mô tả.
- Bổ sung: sau `gen:enums`, `frontend/src/shared/enums/generated.ts` phải được commit cùng PR, nếu không frontend build gãy.

## Phương án đã cân nhắc và loại bỏ

**Dùng `SYSTEM` cho thông báo vụ việc.** Loại vì nó gộp hai loại thông báo mà người dùng cần tắt riêng.

**Đổi cột enum thành `String` với validate ở service.** Đây là hướng `DocumentType` đã đi (migration `20260627000001`) và nó giải quyết đúng vấn đề rollback. Loại **cho lần này** vì đổi kiểu một cột đang có dữ liệu là migration nặng hơn nhiều so với thêm một giá trị — nhưng ghi lại đây là hướng đúng nếu enum này còn đổi thêm vài lần nữa.

## Điều kiện xem lại

Khi `NotificationType` cần giá trị thứ ba trong vòng vài tháng. Lúc đó chi phí chuyển sang `String` + catalog đã rẻ hơn tổng chi phí của các lần `ALTER TYPE` một chiều.
