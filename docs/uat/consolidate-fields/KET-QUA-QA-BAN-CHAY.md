# Báo cáo QA — PC02 (bản chạy cục bộ)

**Ngày:** 2026-08-23 · **Nhánh:** `fix/uat-consolidate-findings` · **Phiên bản:** 0.71.0.0
**Mục tiêu:** http://localhost:5173 (React + Vite) · API http://localhost:3000/api/v1 (NestJS)
**Tài khoản:** admin@pc02.local · **Bậc:** Standard (vá mức critical/high/medium)
**Dữ liệu:** khối di trú thật — 3.740 vụ án · 46.135 đơn thư · 5.081 vụ việc

---

## Điểm sức khoẻ

| | Trước QA | Sau QA |
|---|---|---|
| Lỗi bảng điều khiển | **1 lỗi 401 mỗi lần chuyển trang** | **0** |
| Điểm sức khoẻ | 72 | **95** |

---

## Lỗi tìm được: 1 (đã vá)

### 🔴 ISSUE-001 · S2 · Luồng thông báo thời gian thực chưa từng kết nối được

**Trạng thái:** ✅ verified · **Commit:** `e874e4d`

**Cách phát hiện:** duyệt 6 trang, bảng điều khiển ghi đúng một lỗi 401 mỗi lần chuyển trang. Nhật ký mạng chỉ ra thủ phạm:

```
GET /api/v1/notifications/stream?token=<JWT> → 401 (7ms)
```

**Kiểm chứng độc lập:** gọi thẳng endpoint bằng token admin hợp lệ — 401 cả khi gửi qua query lẫn qua header. Không phải lỗi hết hạn (401 trả về sau 7ms).

**Nguyên nhân gốc:** `sse-jwt.guard.ts` đòi `payload.type === 'access'`. Nhưng access token do `auth.service.ts` ký mang payload `{sub, email, role, tokenVersion, canDispatch}` — **không có claim `type`**. Chỉ refresh token và các token chờ (`2fa_pending`, `change_password_pending`) mới có. Điều kiện ấy vì thế từ chối **mọi** token thật.

**Ảnh hưởng người dùng:** không ai nhận được thông báo thời gian thực nào kể từ khi tính năng lên (v0.45). Mỗi lần chuyển trang ghi một lỗi vào bảng điều khiển, làm nhiễu việc chẩn đoán các lỗi khác.

**Cách vá:** dùng đúng quy tắc của guard chính (`jwt.strategy.ts`): chỉ chặn token **có** `type` mà type đó không phải `access`. Token chờ vẫn bị chặn.

**Vì sao bộ kiểm thử cũ không bắt được:** ca kiểm của guard tự dựng payload có `type:'access'` — một giả định mà token thật không thoả. Ca kiểm xanh, tính năng hỏng. Ca kiểm mới dùng **đúng hình dạng payload mà `auth.service` ký**.

**Bằng chứng sau khi vá:**
- `GET /notifications/stream?token=…` → **200 + `text/event-stream`**
- Duyệt lại 4 trang trên trình duyệt → **0 lỗi bảng điều khiển**
- Backend **2903/2903** đạt

---

## Đã kiểm chứng ĐÚNG qua giao diện thật

Đây là phần xác nhận đợt vá v0.71.0.0 ở **tầng người dùng**, không phải tầng kiểm thử.

| Việc kiểm | Kết quả |
|---|---|
| Đăng nhập | ✅ vào `/dashboard` |
| Mở form Vụ án mới | ✅ render đủ, mã hồ sơ tự sinh `2026-10156` |
| **Nhãn ô nhập đọc được** (BUG-008) | ✅ cây trợ năng trả về đúng "Tiêu đề hồ sơ", "Mô tả chi tiết", "Nơi xảy ra", "Bị hại", "Họ và tên", "Số CCCD/CMND", "Số điện thoại", "Địa chỉ thường trú" — trước khi vá đều trống |
| Hộp xác nhận trước khi lưu | ✅ hiện tóm tắt mã hồ sơ / ngày tiếp nhận / tên vụ án |
| **Tạo vụ án và lưu** (BUG-001) | ✅ tạo được `2026-10156` |
| **Giá trị vào CỘT typed** (cam kết cốt lõi của epic) | ✅ `tenCungCap`, `cccdCungCap`, `sdtCungCap`, `noiXayRa` đều nằm ở cột — kiểm trực tiếp trong CSDL |
| **Tìm theo tên người tố cáo** (BUG-003) | ✅ 1 kết quả, đúng vụ vừa tạo |
| **Tìm theo số CCCD** (BUG-003) | ✅ 1 kết quả |
| Mở form Đơn thư mới | ✅ không lỗi |
| Mở form Vụ việc mới | ✅ không lỗi |
| Danh sách Vụ án / Đơn thư / Vụ việc | ✅ không lỗi |

---

## Ghi nhận, không phải lỗi

**Token JWT nằm trong chuỗi truy vấn.** `notifications/stream?token=<JWT>` — bắt buộc về mặt kỹ thuật vì `EventSource` của trình duyệt không đặt được tiêu đề. Nhưng chuỗi truy vấn bị máy chủ proxy ghi nhật ký và lưu trong lịch sử trình duyệt. Với hệ thống xử lý hồ sơ tố tụng (NĐ 13/2023) thì đáng cân nhắc đổi sang cookie `HttpOnly` cho riêng đường SSE. **Không sửa trong đợt này** — ngoài phạm vi, cần bàn.

---

## Còn mở

| Việc | Trạng thái |
|---|---|
| BUG-002 dọn 758 hồ sơ ô "Địa chỉ" chứa tên bị hại | Chờ anh duyệt; công cụ mặc định chỉ đọc |
| Merge PR #220 → deploy prod | **Bị cơ chế an toàn môi trường chặn** |
| Token SSE trong chuỗi truy vấn | Ghi nhận, chưa sửa |

---

## Tóm tắt cho PR

> QA trên bản chạy thật tìm 1 lỗi, đã vá và kiểm chứng. Điểm sức khoẻ 72 → 95. Lỗi: luồng thông báo thời gian thực chưa từng kết nối được kể từ v0.45 — guard SSE kiểm một claim mà access token không mang.
