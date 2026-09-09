# Đối chiếu bản in Word — hệ cũ ↔ hệ mới (KẾT QUẢ CUỐI, 09/09/2026)

## Kết quả

| Mẫu | Hồ sơ | Dòng chữ lệch | Đoạn định dạng lệch | Kiểu chữ lệch |
|---|---|---|---|---|
| HE_CU_BIEN_NHAN | 37315 | 0 | 0 | 0 |
| HE_CU_DANG_KY_BAO_CHUA | 69343 | 0 | 0 | 0 |
| HE_CU_DANG_KY_BAO_CHUA | 69403 | 0 | 0 | 0 |
| HE_CU_DON_THU | 37315 | 0 | 0 | 0 |
| HE_CU_HUONG_DAN | 79953 | 1 | 0 | 0 |
| HE_CU_TRAO_DOI | 86649 | 1 | 0 | 0 |
| HE_CU_TRA_HO_SO | 18 | 1 | 0 | 0 |
| HE_CU_TRA_HO_SO | 73028 | 1 | 0 | 0 |
| HE_CU_UY_THAC | 69122 | 0 | 0 | 0 |
| HE_CU_VU_AN | 69971 | 0 | 0 | 0 |

**Bốn chỗ lệch còn lại đều là lỗi của HỆ CŨ**, cố ý không chép: khi hồ sơ thiếu khoá, hệ cũ in
ra chính tên biến của nó — `Đề xuất: ${de_xuat}`, `…của ${ nguon_don} về việc…`. Hệ mới in trống.

Nghĩa là **0 chỗ lệch dữ liệu · 0 chỗ lệch bố cục · 0 chỗ lệch kiểu chữ**.

## Cách đo

Mỗi mẫu một hồ sơ có mặt ở **cả hai hệ**, chọn bản nhiều ô dữ liệu nhất. Đơn thư và Biên nhận
dùng **chung hồ sơ 37315** (hệ cũ có hai nút in trên cùng bản ghi). Hai cặp cuối là **kiểm chéo**:
mẫu khai cho Đơn thư nhưng hồ sơ đã di trú thành Vụ việc / Vụ án.

- Bản hệ cũ: `GET /doi-1/XuatFile/<id>` — đúng đường nút "Xuất Word", **chỉ đọc**.
- Bản hệ mới: `POST /api/v1/{thực thể}/{id}/export-documents` — **chính lời gọi giao diện dùng**,
  nên hiện vật đem so là thứ cán bộ nhận được.

Phép so có **ba tầng**: chữ (theo dòng, có căn dòng) · thuộc tính ĐOẠN (căn lề, thụt đầu dòng) ·
KIỂU CHỮ (đậm, nghiêng, gạch chân, cỡ — so theo từng ký tự).

## Bốn lớp khác biệt đã sửa

| # | Khác biệt | Quy mô | Phát hiện nhờ |
|---|---|---|---|
| 1 | Ô nhiều dòng: hệ cũ tách ĐOẠN Word, hệ mới ngắt dòng mềm | 15.338 + 6.259 hồ sơ | sửa phép đo cho thấy được ngắt đoạn |
| 2 | Định dạng của NHÃN trùm lên cả câu (đậm + gạch chân) | mọi mẫu có nhãn đậm | **anh nhìn ra khi đặt hai bản cạnh nhau** |
| 3 | Dòng tiếp mang cỡ chữ và đậm của dòng đầu | mẫu Uỷ thác: 13 chỗ/hồ sơ | tầng so kiểu chữ mới thêm |
| 4 | Ô `de_xuat` dùng ngắt dòng mềm; xuống dòng cuối giá trị bị bỏ | 498 hồ sơ | đo bản in thật của 4 hồ sơ |

## Vì sao lần trước báo "0 chỗ lệch" mà vẫn khác

Kết luận 28/08 **không đủ căn cứ**. Bộ bóc chữ đổi CẢ `</w:p>` LẪN `<w:br/>` thành `
` rồi bỏ
mục rỗng, nên bản tách đoạn và bản ngắt dòng mềm cho ra **đúng một mảng**; và công cụ **tự dựng
lại** phép render thay vì gọi đường xuất thật, lệch với máy chủ ở năm chỗ. Cả hai đã sửa TRƯỚC
khi sửa bản in — không sửa thứ mình chưa đo được.

Ba lần trong việc này em đọc hiện vật vội và suy ra luật sai (tưởng ngắt dòng mềm của mẫu là của
dữ liệu). Mỗi lần đều phải quay lại đo dữ liệu thô mới ra đúng.

## Độ phủ: 8/11 mẫu có đối chứng

Ba mẫu còn lại — `vu_viec_mau`, `an_tra_bo_sung_mau`, `so_dang_ky_bao_chua` — hệ cũ **chưa từng
in ra lần nào**, nên không có bản gốc để so. **Không báo "khớp"** cho thứ không so được; chỉ kiểm
được là hệ mới dựng ra tệp hợp lệ và **không sót biến nào** (đo 09/09: 185KB · 81KB · 67KB, 0 biến sót).

## Tệp

- `vong-4/` — cặp `.docx` của từng mẫu (`-HE-CU` / `-HE-MOI`)
- `anh-cuoi/` — ảnh từng trang, mở ra đối chiếu bằng mắt
- `vong-4/bang-lech.md`, `chi-tiet.json` — bảng lệch và chi tiết từng dòng
