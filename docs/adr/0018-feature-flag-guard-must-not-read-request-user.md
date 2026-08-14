# ADR-0018: `FeatureFlagGuard` phải tự xác định danh tính, không đọc `request.user`

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-14
- **Liên quan**: `backend/src/feature-flags/guards/feature-flag.guard.ts`,
  `backend/src/feature-flags/guards/feature-flag.guard.spec.ts`,
  `UAT-COVERAGE.md` (Đợt 3), các đợt gate API E4/E5/E6

## Bối cảnh

`FeatureFlagGuard` có dòng:

```ts
if (!request.user) return true;
```

Ý định hợp lý và phải giữ: người **chưa đăng nhập** không được dò xem cờ nào
đang bật bằng cách so 404 (tắt) với 401 (bật). Trả `true` để `JwtAuthGuard` phía
sau trả 401 đồng nhất. Comment trên dòng đó viết *"Decouples from APP_GUARD
registration order"*.

Nó không tách rời khỏi thứ tự — nó **phụ thuộc hoàn toàn** vào thứ tự, theo
chiều ngược lại:

1. `FeatureFlagGuard` đăng ký `APP_GUARD` **toàn cục** (`feature-flags.module.ts`).
2. `JwtAuthGuard` **không** toàn cục — gắn ở cấp controller
   (`@UseGuards(JwtAuthGuard, PermissionsGuard)`). Cả dự án chỉ có hai
   `APP_GUARD`: `ThrottlerGuard` và `FeatureFlagGuard`.
3. NestJS chạy guard toàn cục **trước** guard cấp controller.
4. ⇒ `request.user` **luôn** `undefined` khi guard này chạy.
5. ⇒ lối tắt luôn được dùng, `isEnabled()` **không bao giờ được gọi**.

**Đo trên máy chủ đang chạy:** 8 vòng liên tiếp `PATCH {enabled:false}` rồi poll
`GET /lawyers` 42 giây (TTL cache là 30 giây). **0/8 chặn được.**

Vì sao 4400 test không bắt: `feature-gating.spec.ts` kiểm *manifest ⇔ decorator
khớp nhau* — tức decorator có được **gắn** không, chứ không kiểm request có bị
**chặn** không. Tệ hơn, `feature-flag.guard.spec.ts` có hai test **khẳng định
lối tắt là đúng** (`resolves.toBe(true)`, `isEnabled` không được gọi). Test xanh,
hành vi trông như chủ ý, không ai nghi ngờ. Một test xanh khẳng định đúng cái
làm hỏng hệ thống là cách lỗi này sống sót.

## Quyết định

`FeatureFlagGuard` **không được** đọc `request.user`, vì nó chạy trước thứ tạo ra
`request.user`. Guard phải **tự xác thực bearer token** (cùng khoá công khai,
cùng thuật toán như `JwtAuthGuard` — khuôn đã có ở `TwoFaTokenGuard`), rồi:

- token hợp lệ ⇒ kiểm cờ như bình thường, cờ tắt ⇒ 404 kèm `FEATURE_DISABLED`;
- không có token / token hỏng ⇒ trả `true`, để `JwtAuthGuard` phía sau trả 401
  đồng nhất. Ý định chống dò cờ được giữ nguyên.

**Đã thi công và kiểm chứng.** `it.failing` đã bỏ `.failing` và thành test hồi quy
thật. Đo trên máy chủ đang chạy: **5/5 vòng chặn được**, gần như tức thì (0–1 giây),
`GET /lawyers` trả 404 kèm `code: "FEATURE_DISABLED"`; gọi không token vẫn trả **401**
chứ không 404, nên ý định chống dò cờ được giữ nguyên.

**Sửa xong lỗi này mới lộ ra lỗi thứ hai**, vốn bị che vì gate chưa bao giờ chạy tới:
`GlobalExceptionFilter` đặt `code = HttpStatus[status]` nên ghi đè `FEATURE_DISABLED`
thành `NOT_FOUND` — đúng mã mà web (`lib/api.ts`) và mobile (`api_client.dart`) rẽ
nhánh theo. Filter nay giữ mã do nơi ném đặt riêng, nhưng **chỉ khi khớp UPPER_SNAKE**:
ngoại lệ mặc định của Nest cũng có trường `error` nhưng là văn xuôi (`'Not Found'`),
lấy bừa sẽ đổi `code` của mọi lỗi sẵn có và phá hợp đồng client đang dựa vào.

## Hệ quả

**Dễ hơn:** gate API E4/E5/E6 thực sự có hiệu lực; tắt một cờ chặn được request
trong vòng TTL. Điều kiện merge E6 lấy lại được cơ sở.

**Khó hơn, phải nói ra:**

- `FeatureFlagGuard` từ chỗ chỉ phụ thuộc `Reflector` + `FeatureFlagsService`
  nay phải biết về khoá JWT và cách xác thực token. Đó là **trùng lặp** với
  `JwtAuthGuard` — chấp nhận, vì cách duy nhất để tránh trùng lặp là dựa vào thứ
  tự guard, mà chính nó là nguyên nhân sự cố này.
- Hai chữ ký xác thực token phải khớp nhau. Đổi thuật toán hoặc đường khoá ở một
  bên mà quên bên kia sẽ làm gate im lặng ngừng hoạt động **đúng như lần này**.
  Bản vá phải kèm test khoá chặt điều đó.
- Mỗi request đi qua route có gate chịu thêm một lần verify chữ ký.

## Phương án đã cân nhắc và loại bỏ

**1. Đăng ký `JwtAuthGuard` toàn cục, trước `FeatureFlagGuard`.**
Nghe gọn nhất và gần như chắc chắn là thứ người đọc sau nghĩ ra đầu tiên.
**Loại:** hệ có route công khai (`/auth/login`, `/health`, và các route mà
`FeatureFlagGuard` cố tình cho qua). Bật `JwtAuthGuard` toàn cục biến mọi route
thành route yêu cầu đăng nhập trừ khi được đánh dấu `@Public` — nghĩa là phải rà
lại **toàn bộ** controller, và **bỏ sót một cái là khoá người dùng ra khỏi hệ
thống**. Đổi một lỗi im lặng lấy một lỗi ồn ào nhưng rủi ro rộng hơn nhiều, ngay
trước lúc bàn giao.

**2. Kiểm sự có mặt của header `Authorization` thay vì `request.user`.**
Một dòng, không cần dependency mới, chạy được bất kể thứ tự guard.
**Loại:** nó không kiểm token **hợp lệ**, chỉ kiểm có chuỗi hay không. Kẻ dò chỉ
cần gửi `Authorization: Bearer x` là qua được lối tắt và lại phân biệt được 404
với 401 — đúng cái lỗ mà dòng gốc sinh ra để bịt. Vá mà vẫn để nguyên lỗ thì tệ
hơn không vá, vì nó trông như đã vá.

**3. Bỏ hẳn lối tắt — luôn kiểm cờ.**
Đơn giản nhất, và gate chắc chắn chạy.
**Loại:** mở lại đúng lỗ rò 404-vs-401 cho người chưa đăng nhập, và nhanh hơn
giới hạn của throttler. Ý định của dòng gốc là đúng; vấn đề nằm ở cách hiện thực,
không ở mục tiêu.

**4. Để nguyên, coi cờ là công cụ vận hành "mềm".**
**Loại:** ADR-0008 và điều kiện merge E6 đều dựa thẳng trên giả định gate chặn
được request từ APK cũ. Nếu cờ không chặn được thì E6 không có cơ chế bảo vệ nào,
và cả cách tiếp cận "gate theo đợt" mất cơ sở. Đây là quyết định phải sửa, không
phải quyết định để chấp nhận.
