# Guide (HTML) — hướng dẫn sử dụng có ảnh chụp thật

Sinh trang hướng dẫn tại `docs/huong-dan-su-dung/index.html`, ảnh ở `anh/`.

## Nguyên tắc
**Không nhét dữ liệu thẳng vào cơ sở dữ liệu.** Kịch bản tự đăng nhập, tự gõ vào form và tự
bấm lưu như một cán bộ đang trực. Số tiếp nhận đơn, mã vụ việc, mã hồ sơ vụ án trong ảnh đều
do máy chủ cấp trong chính lần chạy đó.

Lý do không phải là sự cầu kỳ: hướng dẫn minh hoạ bằng ảnh dựng sẽ trôi khỏi sản phẩm một cách
âm thầm — ảnh vẫn trông đúng rất lâu sau khi màn hình nó mô tả đã đổi. Hướng dẫn phải tự đi hết
luồng để có ảnh thì sẽ **hỏng ngay tại chỗ** khi luồng đổi, tức đúng lúc nó sắp bắt đầu nói sai.

## Thứ tự các chương
Theo vòng đời hồ sơ, không theo thứ tự menu: đơn thư → vụ việc → vụ án → người và tài liệu →
báo cáo → quản trị. Dạy theo menu sẽ phải giải thích "Báo cáo tháng" trước khi người đọc từng
tạo một bản ghi nào để được đếm trong đó.

## Chạy
Cần backend `:3000` và frontend `:5173` đang chạy, DB đã seed nền
(`prisma/seed.ts`, `seed-crimes-blhs2015.ts`, `seed-document-numbers.ts`).

```bash
node tools/guide-html/record.mjs   # đăng nhập, tạo data, chụp ảnh → manifest.json
node tools/guide-html/build.mjs    # manifest.json → index.html
```

Biến môi trường: `GUIDE_BASE_URL`, `GUIDE_USER`, `GUIDE_PASS`, `GUIDE_OUT`.

## Khi một bước hỏng
`record.mjs` không dừng — nó đánh dấu bước đó là lỗi, vẫn chụp màn hình hiện trạng và in ra
danh sách lỗi ở cuối. Trang HTML tô đỏ đúng bước đó kèm thông báo lỗi. Hướng dẫn dừng ở màn
hình hỏng đầu tiên nói cho bạn ít hơn là hướng dẫn chỉ ra tất cả chúng.
