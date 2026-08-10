# ADR-0007: Gate API ở cấp class, và danh sách module không bao giờ gate

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-E4..E6, `backend/src/feature-flags/guards/feature-flag.guard.ts`

## Bối cảnh

Có 37 cờ tính năng nhưng chỉ 3 controller thực sự mang `@FeatureFlag(...)`. Tắt cờ `cases` hôm nay chỉ ẩn mục menu; `GET /api/v1/cases` vẫn trả 200. Cờ tắt mà API vẫn phục vụ thì cờ đó không phải là công tắc.

Nhưng gate bừa sẽ làm hỏng những thứ không liên quan.

## Quyết định

**Cấp gate: class.** Khớp với docstring của decorator và cả ba usage hiện có. Chỉ gate ở cấp route khi một controller phục vụ hai feature.

**Danh sách không bao giờ gate:**

- Sáu cờ lõi (`auth`, `admin`, `settings`, `feature-flags`, `audit`, `dashboard`) — xem [ADR-0001](0001-feature-flag-core-keys-compile-time.md).
- `notifications` — chuông nằm trên shell, mọi trang đều gọi.
- Module **tra cứu**: `directory`, `admin-units`, `master-class`, `crimes`, `catalog`, `address-mapping`. Tắt `directory` mà gate API thì dropdown trong form tạo vụ án chết ngầm, và người dùng không có cách nào lần ra nguyên nhân.

Manifest mang thêm trường `gating: 'api' | 'menu-only'` (mặc định `menu-only`, giữ nguyên hành vi 34 module hiện tại). Một spec đối chiếu hai chiều: manifest khai `'api'` thì phải có decorator, và ngược lại.

**Triển khai theo ba đợt tăng dần rủi ro** — lá trước (`kpi`, `journey`, `lawyers`, ...), rồi module nghiệp vụ, cuối cùng `cases`/`incidents`/`petitions`.

## Hệ quả

- "Chưa gate" chuyển từ trôi dạt ngầm thành một quyết định ghi trong manifest và được CI kiểm.
- Gate controller **không** chặn lời gọi service nội bộ. Đây là tính chất tốt: module A tắt vẫn không làm hỏng module B đang gọi service của A trong cùng tiến trình.
- Mỗi lần gate là một dòng decorator, revert được theo từng đợt.

## Phương án đã cân nhắc và loại bỏ

**Gate tất cả 34 module cùng lúc.** Loại vì bán kính nổ quá lớn và không có cách khoanh vùng khi hỏng.

**Gate ở cấp route cho mọi thứ.** Loại vì nhiều lần khai báo hơn, dễ sót hơn, mà không thêm khả năng kiểm soát nào ở mức module.

## Điều kiện xem lại

Trước khi thực hiện đợt E6 (`cases`, `incidents`, `petitions`). Đợt đó bị chặn cứng bởi [ADR-0008](0008-mobile-blocks-api-gating.md).
