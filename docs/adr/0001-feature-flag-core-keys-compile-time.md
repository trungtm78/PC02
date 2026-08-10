# ADR-0001: `isCore` và `defaultEnabled` của feature flag nằm ở compile-time, không thành cột DB

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-B1, `backend/src/feature-flags/`, `backend/prisma/schema.prisma` (model `FeatureFlag`)

## Bối cảnh

Trang `/admin/tinh-nang` cho admin bật/tắt từng module. Hai thuộc tính cần đi kèm mỗi cờ:

- `isCore` — cờ lõi (`auth`, `admin`, `settings`, `feature-flags`, `audit`, `dashboard`) không bao giờ được tắt. Tắt một trong số đó là tự khoá mình khỏi hệ thống, và mất luôn đường bật lại.
- `defaultEnabled` — trạng thái khi chưa có row trong `feature_flags`. Chức năng "chưa dùng" cần mặc định TẮT, trong khi 37 module hiện có phải giữ nguyên semantic default-allow.

Bảng `feature_flags` đã có sẵn `rolloutPct` và `metadata` — hai cột chưa code nào đọc.

## Quyết định

Cả hai sống trong code: `CORE_FEATURE_KEYS` là hằng số, `defaultEnabled` là trường của `FeatureManifest`. Không thêm cột nào vào `feature_flags`, không viết migration.

`isEnabled()` ép `true` cho core key kể cả khi row DB nói `false`, và `setEnabled()` từ chối yêu cầu tắt — hai lớp độc lập.

## Hệ quả

- Không ai vô hiệu hoá được hàng rào chống tự-khoá bằng một câu `UPDATE` trong psql. Muốn đổi phải qua PR và review.
- Rollback code kéo theo rollback default. Nếu `defaultEnabled` là cột DB, rollback về bản cũ sẽ để lại default của bản mới trong database.
- Ops không "phong core" cho một cờ bằng SQL được. Đây là chủ ý, không phải hạn chế.
- Phải nhớ rằng `isEnabled()` và `listAll()` dùng chung helper `effectiveEnabled()`. Nếu chỉ sửa một trong hai, hệ thống rơi vào trạng thái "menu biến mất nhưng API vẫn cho vào" — hoặc ngược lại.

## Phương án đã cân nhắc và loại bỏ

**Thêm cột `isCore` và `defaultEnabled` vào `feature_flags`.** Loại vì một câu SQL sai xoá mất hàng rào chống lockout, và vì row DB sống lâu hơn code nên rollback để lại default sai. Chi phí thêm: một migration nữa trên VM production một-instance.

**Dùng `rolloutPct` để làm gradual rollout.** Loại vì nó phá vỡ hợp đồng "bật/tắt xác định" mà trang admin hứa với người dùng, và không có yêu cầu nào cần tới. Hai cột `rolloutPct`/`metadata` để nguyên, không dùng, không xoá — `DROP COLUMN` là migration có rủi ro đổi lấy lợi ích bằng không.

## Điều kiện xem lại

Khi cần bật một tính năng cho một phần người dùng thay vì tất cả. Lúc đó `rolloutPct` mới có việc, và ADR này phải được thay thế chứ không phải vá.
