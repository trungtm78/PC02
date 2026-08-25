# Đơn thư có ngày tiếp nhận sai — trạng thái 25/08/2026

Đây là **lỗi nhập liệu mang từ hệ cũ sang**, không phải lỗi di trú: `legacyRaw` giữ y hệt
giá trị của hệ cũ. Chính hệ mới có luật *"Ngày tiếp nhận không được là ngày tương lai"* nên
các hồ sơ này không thể tạo mới được nữa — chúng chỉ tồn tại vì đã có sẵn ở hệ cũ.

## ĐÃ SỬA — 16 hồ sơ tự mâu thuẫn về năm

Năm của ngày tiếp nhận **lớn hơn năm phát sinh hồ sơ**. Một hồ sơ mở năm 2023 không thể
tiếp nhận năm 3023 — bản ghi tự mâu thuẫn, nên không cần hồ sơ giấy vẫn kết luận được.

Cách sửa: **thay năm bằng năm hồ sơ, giữ nguyên ngày và tháng**. Bằng chứng trực tiếp:
**5/16 hồ sơ có `ngay_viet_don` trùng đúng ngày/tháng, chỉ khác năm** (nhận `17/9/2925`,
đơn viết `17/9/2025`).

| Mã hồ sơ | Trước | Sau |
|---|---|---|
| 2023-5325 | 30/11/**3023** | 30/11/2023 |
| 2025-7057 | 17/09/**2925** | 17/09/2025 |
| 2025-10964 | 11/12/**2205** | 11/12/2025 |
| 2025-10450 | 05/12/**2205** | 05/12/2025 |
| 2023-2728 | 22/06/**2203** | 22/06/2023 |
| 2026-3696 | 19/03/**2029** | 19/03/2026 |
| 2026-10141 | 28/07/**2027** | 28/07/2026 |
| 2026-10045 | 27/07/**2027** | 27/07/2026 |
| 2025-6234 | 25/08/**2026** | 25/08/2025 |
| 2025-5667 | 11/08/**2026** | 11/08/2025 |
| 2025-3767 | 23/06/**2026** | 23/06/2025 |
| 2025-3323 | 16/06/**2026** | 16/06/2025 |
| 2025-2675 | 01/06/**2026** | 01/06/2025 |
| 2025-2676 | 01/06/**2026** | 01/06/2025 |
| 2024-2231 | 25/04/**2026** | 25/04/2024 |
| 2023-1262 | 13/03/**2026** | 13/03/2023 |

Công cụ: `sua-nam-ngay-tiep-nhan.ts`. Ba chốt an toàn — chỉ đụng hồ sơ năm mâu thuẫn; kết
quả không được ở tương lai; kết quả không được trước ngày viết đơn. 16/16 qua đủ, 0 bỏ qua.

**Không mất dữ liệu:** giá trị gốc vẫn nằm nguyên trong `legacyRaw` và hiện đầy đủ trên
bảng "Dữ liệu gốc hệ cũ".

## CÒN LẠI — 4 hồ sơ cần đối chiếu hồ sơ giấy

Bốn hồ sơ này **sai tháng**, không sai năm, nên không tự mâu thuẫn về năm và không suy ra
được giá trị đúng. Chúng đang chiếm đầu danh sách Đơn thư.

| Mã hồ sơ | Ngày nhận đang lưu | Bản ghi tạo ở hệ cũ | Ngày viết đơn | Người gửi |
|---|---|---|---|---|
| 2026-10206 | **30/09/2026** | 29/07/2026 | 26/07/2026 | Phạm Thị Nhung |
| 2026-10207 | **29/09/2026** | 29/07/2026 | 27/07/2026 | Nguyễn Thị Hoa |
| 2026-8810 | **29/09/2026** | 30/06/2026 | 25/06/2026 | Công ty luật TNHH XTVN |
| 2026-10224 | **27/09/2026** | 29/07/2026 | 23/07/2026 | Lý Cẩm Tuyền |

**Chắc chắn sai** vì hai lẽ: ngày nhận nằm ở **tương lai** (hôm nay 25/08/2026), và bản ghi
đã được **tạo ở hệ cũ trước đó hai tháng** — không thể ghi nhận một việc chưa xảy ra.

**Nhưng giá trị đúng thì không suy ra được.** Đổi tháng 9 → 7 cho hồ sơ 2026-10206 ra
30/07/2026, vẫn sau ngày tạo bản ghi 29/07 — tức phép đoán tự nhiên nhất cũng không qua nổi
phép kiểm của chính nó. Vì vậy để nguyên, chờ hồ sơ giấy.

Cán bộ sửa trực tiếp trên màn hình Đơn thư; hệ thống sẽ chặn nếu lại nhập ngày tương lai.

## Ghi chú — 13 hồ sơ có dấu hiệu nhẹ, KHÔNG kết luận là sai

Ngoài 4 hồ sơ trên còn 13 hồ sơ có ngày tiếp nhận **sau ngày tạo bản ghi** vài ngày tới vài
tuần (vd `2026-9647` nhận 19/07, tạo 17/07). Đây **chỉ là dấu hiệu, không phải bằng chứng**:
cán bộ hoàn toàn có thể mở bản ghi trước rồi ghi nhận tiếp nhận sau. Ngày của chúng đều ở
quá khứ và không mâu thuẫn với năm hồ sơ. Liệt kê để anh biết, không đề nghị sửa.

Truy vấn tìm lại nhóm này:

```sql
SELECT stt, "receivedDate"::date,
       to_timestamp(("legacyRaw"->>'_add_time')::bigint)::date AS ngay_tao
  FROM petitions
 WHERE "legacyRaw"->>'_add_time' ~ '^[0-9]+$' AND "deletedAt" IS NULL
   AND "receivedDate" > to_timestamp(("legacyRaw"->>'_add_time')::bigint) + interval '1 day'
 ORDER BY "receivedDate" DESC;
```

## Vì sao không nới bộ lọc thay cho sửa dữ liệu

Cột sắp xếp là **cột sinh tự động** của PostgreSQL, mà cột sinh **bắt buộc dùng biểu thức
bất biến** — không được gọi `now()`. Nên khoảng hợp lệ phải là hằng số `1900–2100`, không
thể là "không quá hôm nay". Đổi sang so với ngày hiện tại sẽ mất chỉ mục và làm chậm truy
vấn trên 46.631 hồ sơ. Sửa dữ liệu là cách đúng.
