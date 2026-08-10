# ADR-0009: Cache cờ tính năng giả định một instance, không làm pub/sub

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-B1, `backend/src/feature-flags/feature-flags.service.ts:15-20`

## Bối cảnh

`FeatureFlagsService` cache cờ trong một `Map` per-process với TTL 30 giây. Với nhiều instance, hai tiến trình có thể lệch nhau tối đa 30 giây sau một lần bật/tắt.

Phản xạ là dựng Redis pub/sub để invalidate.

## Quyết định

Không làm. Production là **một** service systemd `pc02-backend`, không cluster. `setEnabled()` đã đặt `cacheExpiresAt = 0` và `await ensureFresh()`, nên độ trễ server là 0.

Thay vào đó, bốn việc rẻ:

1. `POST /feature-flags/refresh` để ép invalidate — hữu ích sau khi sửa DB bằng SQL tay, và là sẵn hook nếu về sau đứng sau load balancer.
2. Frontend gọi `refresh()` ngay sau mỗi PATCH thành công.
3. Banner trên `/admin/tinh-nang` nói thật: *"Thay đổi có hiệu lực ngay trên máy chủ. Người dùng đang mở sẵn trang sẽ thấy sau khi tải lại."*
4. Ghi giả định một-instance ngay trên hằng `CACHE_TTL_MS`, kèm điều kiện nâng cấp.

## Hệ quả

- Độ trễ thật với người dùng **không nằm ở server** mà ở client: `FeatureFlagsContext` chỉ fetch một lần lúc mount. Đầu tư Redis mà không sửa chỗ đó là tối ưu nhầm chỗ.
- TTL 30 giây trở thành cận trên khi có instance thứ hai, chứ không phải chi phí hiện tại.
- `FEATURE_FLAG_CACHE_TTL_MS` đã là biến môi trường, nên hạ TTL là thay đổi zero-code nếu cần gấp.

## Phương án đã cân nhắc và loại bỏ

**Redis pub/sub.** Loại: thêm một thành phần hạ tầng để giải quyết một vấn đề chưa tồn tại, trong khi nút thắt thật nằm ở phía client.

**Bỏ cache, đọc DB mỗi request.** Loại: mỗi request qua guard sẽ thành một truy vấn, đổi một vấn đề nhất quán lý thuyết lấy một vấn đề tải thật.

## Điều kiện xem lại

Khi thêm instance backend thứ hai hoặc bật cluster mode. Khi đó chọn một trong: Postgres `LISTEN/NOTIFY` trên kênh `feature_flags_changed`; hạ `FEATURE_FLAG_CACHE_TTL_MS` xuống 5000; hoặc fan-out `POST /feature-flags/refresh` tới từng instance.
