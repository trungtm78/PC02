# Bật, theo dõi và tắt "Phân quyền theo tổ"

Tài liệu cho quản trị viên sẽ bật tính năng và cho người trực hệ thống. Đọc hết mục 1 và mục 4 trước khi bật.

## 1. Ba chế độ

| Chế độ | Hệ thống làm gì | Ai đổi được |
|---|---|---|
| **Tắt** (`OFF`) | Quyền theo vai trò như trước nay. Mọi cấu hình ở màn Phân quyền chưa có tác dụng. | Một quản trị viên |
| **Chạy thử** (`SHADOW`) | Vẫn theo vai trò. Chỉ khác ở chỗ ghi nhận là đang trong giai đoạn so sánh. | Một quản trị viên |
| **Áp dụng** (`ENFORCE`) | Người không phải quản trị viên có đúng những quyền mà tổ của họ cấp. Tổ chưa cài gì (và không tổ cha nào cài) thì giữ quyền của vai trò như cũ. | **Hai** quản trị viên: một người đề nghị, một người khác duyệt |

Quản trị viên (vai trò ADMIN) không bị giới hạn ở cả ba chế độ.

## 2. Trước khi bật

1. Vào **Quản trị → Phân quyền theo tổ**.
2. Tab **Mẫu quyền**: nếu chưa có mẫu nào, bấm tạo ba mẫu khởi đầu (Cán bộ như hiện nay / Chỉ hồ sơ của mình / Chỉ xem). Ba mẫu này dựng từ quyền hiện có của vai trò cán bộ, sửa và xoá được như mọi mẫu khác.
3. Tab **Quyền theo tổ**: chọn mẫu cho Thành viên và cho Tổ trưởng của từng tổ cần đổi. Tổ nào để nguyên thì người trong tổ giữ quyền như hôm nay.
4. Tab **Áp dụng**: đọc danh sách "Nếu áp dụng ngay bây giờ". Danh sách nêu từng người sẽ **mất**, **được thêm** hoặc **đổi phạm vi** quyền nào. Danh sách trống nghĩa là bật lên không ai đổi quyền.

Nên bắt đầu với **một tổ**, đọc danh sách, rồi mới làm tiếp các tổ khác.

## 3. Bật

1. Quản trị viên thứ nhất: ở tab **Áp dụng**, nhập lý do, tick "đã đọc danh sách", bấm **Đề nghị áp dụng**.
2. Quản trị viên thứ hai (tài khoản khác): mở cùng tab, đọc cùng danh sách, tick, bấm **Duyệt và áp dụng**.

Hệ thống từ chối và yêu cầu đọc lại danh sách khi:

- cấu hình quyền, sơ đồ tổ hoặc danh sách người đã đổi sau lúc đề nghị (danh sách người thay đổi quyền đã khác);
- đề nghị đã quá 24 giờ chưa ai duyệt;
- người duyệt chính là người đề nghị;
- việc áp dụng sẽ làm người đề nghị hoặc người duyệt mất quyền vào màn Phân quyền.

Người đề nghị rút lại được; quản trị viên khác từ chối được. Mọi lần đổi chế độ đều ghi vào lịch sử ở cuối tab và vào nhật ký hệ thống (ai, lúc nào, từ chế độ nào sang chế độ nào; không ghi danh sách quyền của từng người).

Sau khi duyệt, thay đổi có hiệu lực trong vài giây. Người đang đăng nhập không cần đăng nhập lại; thực đơn của họ cập nhật ở lần tải trang kế tiếp.

## 4. Tắt (lùi lại) — một bước, một người

Ở tab **Áp dụng**, bấm **Tắt áp dụng (về như cũ)**, nhập lý do. Mọi người quay về quyền theo vai trò ngay. Cấu hình mẫu và tổ **không mất**, bật lại sau được.

Nếu không vào được giao diện, người có quyền truy cập máy chủ chạy:

```bash
ssh pc02vm
cd /home/pc02/current/backend && set -a && source .env && set +a
psql "$DATABASE_URL" -c "UPDATE system_settings SET value = 'OFF' WHERE key = 'QUYEN_THEO_TO_CHE_DO';"
```

Máy chủ tự nhận thay đổi trong vài giây, không cần khởi động lại. Cách này không ghi lịch sử đổi chế độ, nên chỉ dùng khi giao diện không dùng được, và ghi lại việc đã làm.

## 5. Dấu hiệu cần tắt ngay

- Cán bộ báo mất quyền hoặc mất hồ sơ mà danh sách ở tab Áp dụng không nêu.
- Nhiều người cùng nhận lỗi "Hệ thống phân quyền tạm thời chưa sẵn sàng" (mã `AUTHZ_UNAVAILABLE`, HTTP 503). Khi đang Áp dụng mà máy chủ không đọc được cấu hình quyền quá 60 giây, hệ thống **từ chối** yêu cầu thay vì lùi về quyền theo vai trò, vì lùi về sẽ trả lại những quyền cấu hình đã lấy đi. Kiểm tra kết nối cơ sở dữ liệu trước; nếu chưa khắc phục được thì tắt theo mục 4.

## 6. Điều chưa được kiểm

- Chưa có lần chạy Áp dụng nào trên production. Phần đã kiểm là ca kiểm tự động trên PostgreSQL (từ cấu hình đến danh sách hồ sơ một người nhận được, gồm cả đường lùi) và máy chủ dựng cục bộ.
- Màn Phân quyền chưa được bấm thử bằng trình duyệt thật với tài khoản cán bộ.

## 7. Giới hạn đã biết khi Áp dụng

- **Thông báo đã gửi trước đó không bị thu hồi.** Từ lúc Áp dụng, thông báo hạn và thông báo phân công chỉ gửi cho người mở được hồ sơ. Những thông báo đã nằm trong hộp thông báo của một người từ trước (có tên hồ sơ, tên người gửi đơn) vẫn ở đó dù người ấy không còn mở được hồ sơ.
- **Số liệu tổng và biểu đồ ở Trang chủ đếm theo phạm vi của từng người** khi Áp dụng (người chỉ xem hồ sơ của mình sẽ thấy số của riêng mình). Khi Tắt, các số này đếm toàn đơn vị như trước nay.
- **Tài khoản quản trị cuối cùng vẫn có thể bị khoá hoặc đổi vai trò** từ màn Quản lý người dùng. Giữ ít nhất hai tài khoản quản trị đang hoạt động trong suốt thời gian Áp dụng.

Vì vậy lần bật đầu tiên nên làm với một tổ, có người trực, và có sẵn một quản trị viên để tắt.
