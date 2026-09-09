# Monkey test — đi lung tung tìm màn hình vỡ

Bộ này đi qua mọi màn hình, bấm ngẫu nhiên trong phạm vi **chỉ đọc**, và báo về những thứ mà ca
kiểm đơn vị không thấy: màn hình trắng, lỗi console, chữ "Đã xảy ra lỗi", trang không mở được.

Ngày 09/09/2026 nó bắt được **hai lỗi thật**, cả hai đều hỏng lặng lẽ — không màn nào báo gì:

| Lỗi | Hậu quả |
|---|---|
| `/api/v1/notifications/stream` trả 401 | dòng thông báo trực tuyến chưa từng chạy cho ai |
| `/api/v1/admin/users?isActive=true` trả 400 | ô lọc **Cán bộ** rỗng trên cả ba trang danh sách |

Lỗi thứ hai chỉ lộ ra ở lượt chạy **sau khi** vá lỗi thứ nhất: 401 nhiều quá nên nó bị chôn.
Vá một lớp nhiễu là thấy lớp dưới — nên chạy lại sau mỗi lần vá.

## Chạy

```bash
cd tools/guide-recorder   # nơi có playwright
UAT_PASS='<mật khẩu>' MONKEY_ROUTES=../monkey-test/duong-mac-dinh.txt node ../monkey-test/monkey.cjs
```

| Biến | Mặc định | Nghĩa |
|---|---|---|
| `UAT_BASE` | `http://171.244.40.245` | máy chủ |
| `UAT_USER` | `admin@pc02.local` | tài khoản |
| `UAT_PASS` | — | **bắt buộc** |
| `MONKEY_ROUNDS` | 40 | số lượt bấm ngẫu nhiên |
| `MONKEY_ROUTES` | `C:/PC02/duong.txt` | danh sách đường, mỗi dòng một đường |
| `MONKEY_OUT` | `C:/PC02/docs/monkey-ket-qua.json` | nơi ghi kết quả |

Cập nhật danh sách đường:

```bash
grep -rhoE "path: '[a-z0-9/:_-]+'" frontend/src --include=*.tsx --include=*.ts   | sed "s/path: //;s/'//g" | grep -vE "^/(auth|r|:)|:|/new$" | sort -u > duong-mac-dinh.txt
```

## Giới hạn CỐ Ý: chỉ đọc

Chạy trên máy thật, nơi có ~55.000 hồ sơ án thật. Bấm bừa vào nút Lưu / Xoá / Chuyển trạng thái
là **sửa dữ liệu vụ án có thật**, không phải "thử nghiệm". Nên:

- **mọi lời gọi GHI bị chặn ở tầng mạng** (`POST`/`PUT`/`PATCH`/`DELETE`), trừ đăng nhập — lưới
  an toàn không dựa vào việc đoán đúng nhãn nút;
- nút có chữ xoá · lưu · duyệt · chuyển · khởi tố · đình chỉ · huỷ · gửi · đăng xuất… bị bỏ qua.

## Hai lần bộ chạy tự đỏ giả

Ghi lại để lần sau đừng dẫm:

| Chỗ trượt | Vì sao |
|---|---|
| Đếm đường bằng thẻ `<a href>` | thanh menu điều hướng bằng router, không có `href` → 0 đường → mọi lượt bấm sau đó vỡ |
| Bộ lọc console bắt cả lỗi do CHÍNH bộ chặn ghi gây ra | phải loại `Failed to fetch` / `aborted` ra, nếu không thì tự mình báo mình |

Ảnh chụp màn hình là thứ phân biệt được "sản phẩm hỏng" với "bộ chạy hỏng".
