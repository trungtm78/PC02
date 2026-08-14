# ADR-0015 — Tắt họ rule `no-unsafe-*` trong file test

- **Trạng thái**: Được chấp nhận
- **Ngày**: 2026-08-10
- **Bối cảnh liên quan**: [ADR-0012 — Lint ratchet thay vì dọn sạch một lần](0012-lint-ratchet-instead-of-clean-slate.md)

## Bối cảnh

ADR-0012 đặt ra quy tắc: **file mới phải sạch lint**, file cũ chỉ được tốt lên
(ratchet đơn điệu). Quy tắc này hoạt động tốt cho mã sản phẩm.

Khi viết `backend/src/evidences/*.spec.ts` (PR-D1), quy tắc va vào một bức
tường không phải do chất lượng test:

```ts
expect(mockPrisma.evidence.findMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({ deletedAt: null }),
  }),
);
```

`@types/jest` khai `expect.objectContaining()` trả về `any`. Gán một `any` vào
object literal ⇒ `@typescript-eslint/no-unsafe-assignment`. Tương tự với
`expect.any()`, và với `mock.calls[0][0]` (kiểu `any[][]`) ⇒
`no-unsafe-member-access`.

Nghĩa là: **rule bắn vì cú pháp matcher chuẩn của Jest, không vì test viết ẩu.**
Riêng hai spec của module vật chứng sinh 52 lỗi thuộc họ này.

Chỉ có ba đường đi:

1. Viết assertion yếu hơn để né matcher (`toHaveBeenCalledTimes(1)` thay vì
   kiểm nội dung tham số) — **làm test tệ đi**.
2. Rắc `// eslint-disable-next-line` khắp file — bị cấm, và che luôn cả những
   `any` thật sự đáng lo.
3. Tắt rule đúng phạm vi, kèm lý do.

## Quyết định

Tắt 5 rule sau **chỉ** cho `**/*.spec.ts`, `**/*.test.ts`, `**/test-utils/**`:

- `no-unsafe-assignment`
- `no-unsafe-member-access`
- `no-unsafe-call`
- `no-unsafe-return`
- `no-unsafe-argument`

Mọi rule khác giữ nguyên trong file test: `prettier/prettier`, `no-floating-promises`,
`no-require-imports`, và toàn bộ `eslint.configs.recommended`.

Mã sản phẩm **không đổi một chữ** — cả 5 rule vẫn bật cho mọi thứ thực sự chạy
trên production.

## Hệ quả

**Tích cực**

- Baseline ratchet giảm 11.507 → 8.945 vấn đề (−2.562). Phần giảm này là nợ
  *danh nghĩa*, không phải nợ *thật*: nó chưa bao giờ chỉ ra rủi ro nào ở runtime.
- File spec mới có thể sạch lint mà không phải làm assertion yếu đi.
- Bớt được động cơ rắc `eslint-disable` — thứ nguy hiểm hơn nhiều vì nó tắt
  *tất cả* rule ở dòng đó.

**Tiêu cực**

- Một `any` thật sự lọt vào helper test (ví dụ một hàm dựng fixture trả `any`)
  sẽ không bị lint bắt nữa. Giảm nhẹ: `tsc --noEmit` vẫn chạy trên toàn bộ
  `src/` gồm cả spec, nên lỗi kiểu *thật* vẫn đỏ; thứ mất đi chỉ là cảnh báo về
  việc *lan truyền* `any`.
- Ranh giới nằm ở đường dẫn file. Một ngày nào đó có người đặt logic sản phẩm
  vào `test-utils/` thì logic đó mất lớp bảo vệ. `test-utils/` hiện chỉ chứa
  helper dựng `TestingModule` — nếu nó phình ra thì phải xem lại ADR này.

## Phương án đã cân nhắc và loại

**Ép kiểu tại chỗ dùng chung** — viết `function objContaining<T>(x: Partial<T>): T`
bọc quanh `expect.objectContaining`. Loại: phải bọc lại 5 matcher khác nhau, và
mỗi spec trong repo (223 file) phải import wrapper thì mới hết nợ — chi phí lớn
hơn lợi ích, để đổi lấy một lớp an toàn mà `tsc` đã cung cấp.

**Cho file test vào allow-list của ratchet** — tức không kiểm lint file test.
Loại: mất luôn `prettier` và `no-floating-promises`, mà `no-floating-promises`
trong spec là rule bắt bug thật (một `expect(...).rejects` quên `await` sẽ luôn
xanh).

**Giữ nguyên, tự miễn trừ cho PR-D1** — loại thẳng: ADR-0012 vừa viết xong đã
phá lệ thì ratchet mất hết hiệu lực.
