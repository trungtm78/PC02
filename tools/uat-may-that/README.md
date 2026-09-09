# UAT trên máy thật — mệnh đề có chủ ngữ là CÁN BỘ

Ca kiểm đơn vị chốt registry, chuỗi hiển thị, phép so. Nhưng *"cán bộ bấm được nút In rồi tải
được tệp"* là mệnh đề về **sản phẩm**, nên bằng chứng phải đi qua giao diện. Bộ này chạy đúng
những mệnh đề ấy trên máy thật.

## Chạy

```bash
cd tools/guide-recorder   # nơi có playwright
UAT_PASS='<mật khẩu>' node ../uat-may-that/uat-may-that.cjs
```

Thoát 0 khi mọi mệnh đề đạt, 1 khi có mệnh đề trượt, 2 khi bộ chạy hỏng — ba trạng thái khác
nhau, vì "bộ chạy hỏng" không phải "sản phẩm hỏng".

| Biến | Mặc định |
|---|---|
| `UAT_BASE` | `http://171.244.40.245` |
| `UAT_USER` | `admin@pc02.local` |
| `UAT_PASS` | **bắt buộc** |
| `UAT_MA_CO_STT_CU` | `2017-259` — hồ sơ CÓ số cũ |
| `UAT_MA_TRA_HO_SO` | `2017-18` — hồ sơ "Trả hồ sơ" nay là Vụ việc |

## Bốn lần bộ chạy tự đỏ giả

Lượt đầu ngày 09/09/2026 báo **0/5**, và không mệnh đề nào trong đó là lỗi sản phẩm:

| Chỗ trượt | Vì sao đỏ giả |
|---|---|
| Ô đăng nhập dò theo NHÃN | ô có `id` nhưng không có nhãn liên kết → không đăng nhập được → mọi mệnh đề sau đỏ |
| `getByTestId('btn-print')` | testid dựng theo từng dòng (`btn-print-<id>`), khớp chính xác là trượt |
| Tìm kiếm dùng `?q=` | khoá có **tiền tố** (`incidents_q`) → trang bỏ qua, hiện danh sách mặc định toàn bản nhập thử |
| Tìm nút In ở màn CHI TIẾT | nút ấy ở màn **sửa** và ở **danh sách**, không ở màn chi tiết |

Ảnh chụp màn hình là thứ phân biệt được "sản phẩm hỏng" với "bộ chạy hỏng": nhìn ảnh thấy icon
máy in nằm sẵn trong cột Thao tác, tức sản phẩm đúng còn phép đo sai.
