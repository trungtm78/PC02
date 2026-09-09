# Monkey test — kết quả 09/09/2026

## Cách chạy, và giới hạn CỐ Ý

Chạy trên MÁY THẬT, nơi có ~55.000 hồ sơ án thật. Bấm bừa vào nút Lưu / Xoá / Chuyển trạng thái
là sửa dữ liệu vụ án có thật, không phải "thử nghiệm". Nên bộ này:

- **chặn mọi lời gọi GHI ở tầng mạng** (`POST`/`PUT`/`PATCH`/`DELETE`), trừ đăng nhập — lưới an
  toàn không dựa vào việc đoán đúng nhãn nút;
- bỏ qua nút có chữ xoá · lưu · duyệt · chuyển · khởi tố · đình chỉ · huỷ · gửi · đăng xuất…

Đi **44 màn hình** (danh sách lấy từ bộ định tuyến) + **40 lượt bấm ngẫu nhiên**.

## Kết quả

**Không màn hình trắng. Không lỗi trang. Không màn "Đã xảy ra lỗi".**

Đúng **một** lỗi, lặp trên mọi màn hình:

| Lỗi | Đường | Ảnh hưởng |
|---|---|---|
| 401 Unauthorized | `/api/v1/notifications/stream` | dòng thông báo trực tuyến KHÔNG chạy cho bất kỳ ai |

Kiểm lại bằng lời gọi trực tiếp, **cùng một token**: `/notifications` trả 200, `/notifications/stream`
trả 401 — cả khi để token ở header lẫn ở query.

**Gốc:** cổng SSE đòi `payload.type === 'access'` còn máy chủ ký token truy cập bằng payload
trần. Đã vá ở PR #351, kèm cổng so hai bộ luật token với nhau.

## Bộ chạy tự đỏ giả — hai lần

Lượt đầu báo "0 màn · 40 chỗ đáng ngờ", và không cái nào là lỗi sản phẩm:

| Chỗ trượt | Vì sao |
|---|---|
| Đếm đường bằng thẻ `<a href>` | thanh menu điều hướng bằng router, không có `href` → 0 đường → mọi lượt bấm sau đó vỡ |
| Bộ lọc console bắt cả lỗi do CHÍNH bộ chặn ghi gây ra | phải loại `Failed to fetch` / `aborted` ra, nếu không thì tự mình báo mình |

Danh sách đường nay lấy thẳng từ bộ định tuyến (`MONKEY_ROUTES`).
