# Đối chiếu dữ liệu in ra trên chứng từ Word: hệ cũ ↔ hệ mới

**Ngày:** 28/08/2026 · **Nhánh:** `feat/doi-chieu-ban-in-word` · **Phạm vi:** dữ liệu điền vào
bản in Word, không đụng giao diện hay chức năng khác.

---

## Tổng kết

| | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Hồ sơ đối chiếu (chọn theo rủi ro) | 42 | 42 |
| So được | 40 | 40 |
| **Khớp từng dòng** | 0 | **21** |
| Còn lệch | 40 | 19 |
| **Chỗ lệch về DỮ LIỆU** | 7 nhóm | **0** |

19 hồ sơ còn lệch đều lệch **cùng một chỗ duy nhất**: hệ cũ in ra chính tên biến của nó
(`${yeu_cau_bo_sung}`, `${de_xuat}`, `${ nguon_don}`) vì hồ sơ không có khoá ấy. Đó là lỗi của
hệ cũ, không phải đặc tả cần chép lại — xem mục "Khác có chủ đích".

**Không còn chỗ nào lệch về giá trị dữ liệu.**

---

## Cách làm

1. Đăng nhập `pc02hcm.com` **chỉ đọc**, tải bản in thật qua `GET /doi-1/XuatFile/<id>` — đúng
   đường nút "Xuất Word" trên màn danh sách. Không gọi bất kỳ đường ghi nào.
2. Dựng bản hệ mới bằng **đúng đường mã máy chủ dùng**: `buildTemplatePlaceholders` →
   `DocxRenderer` → chính tệp `.docx` trong kho.
3. Bóc chữ hai bên, căn dòng bằng dãy con chung dài nhất, in ra từng chỗ lệch.

Công cụ: `backend/src/legacy-migration/cli/so-ban-in.ts`.
Đọc dữ liệu hồ sơ **thẳng từ Mongo hệ cũ** (chỉ đọc), không dùng bản sao — cán bộ vẫn sửa hồ sơ
hằng ngày, so với ảnh chụp cũ là so hai hồ sơ khác nhau.

### Mốc đúng lấy từ đâu

Không lấy từ mã hệ mới. Ba nguồn độc lập:

| Nguồn | Dùng để |
|---|---|
| 3 bản in `.docx` tải về, lưu ở `ban-in-he-cu/` | Neo từng giá trị bằng mắt |
| `_PC02/Modules/doi_1/act/xuatfile.php` | Luật điền của hệ cũ |
| Bảng `TruongTuyChinh` trong CSDL hệ cũ | Kiểu của 132 trường hồ sơ |

Ba hồ sơ neo, trong đó **86374 là hồ sơ quyết định** vì nó có ngày một chữ số VÀ tháng một chữ
số — chỉ nó mới phân biệt được luật đệm số 0 không đối xứng:

| id | loai | stt | ngay | thang | hệ cũ in ở đầu văn bản |
|---|---|---|---|---|---|
| 85651 | vu_an_da_phan_loai | 9842 | 21 | 7 | `Số: 9842/ĐX-PC02-Đ1` · `ngày 21 tháng 7 năm 2026` |
| 86950 | don_thu | 11141 | 24 | 8 | `Số: 11141/ĐX-PC02-Đ1` · `ngày 24 tháng 8 năm 2026` |
| **86374** | don_thu | 10565 | **9** | **8** | `Số: 10565/ĐX-PC02-Đ1` · **`ngày 09 tháng 8 năm 2026`** |

---

## Bảy nhóm lệch đã sửa

Số hồ sơ đo trên dữ liệu sống ngày 28/08/2026 (55.207 hồ sơ · 238 cán bộ).

| # | Chỗ lệch | Hệ cũ in | Hệ mới in (trước) | Số hồ sơ |
|---|---|---|---|---|
| 1 | `${stt}` — số hiệu văn bản | `9842` | `26-9842` | **55.067 (100%)** |
| 2 | `${ten_ngan}` — dòng "Lưu:" | chuỗi cán bộ tự đặt | chữ tự suy ra | **16.713 (30,3%)** |
| 3 | `${thang}` | `8` | `08` | **42.178** |
| 4 | `ngay_tiep_nhan_nguon_tin` | `09/8/2026` nguyên văn | `09/08/2026` | 22.037 |
| 5 | `ngay_phieu_chuyen` | nguyên văn | chuẩn hoá | 7.144 |
| 6 | 3 trường ngày là **chữ tự do** | nguyên văn | **TRỐNG** | 8.436 |
| 7 | khoảng trắng thừa | đã cắt | giữ nguyên | 791 |

### Gốc chung của nhóm 3–7

Bản in đang quyết định định dạng theo **kiểu CỘT của hệ mới**, trong khi nó phải theo
`TruongTuyChinh` — bảng nói **hệ cũ IN ra sao**. Hai bảng, hai vai khác nhau:

- `field-parity.def.ts` → trường ấy lưu vào cột kiểu gì *(việc của di trú)*
- `TruongTuyChinh` → hệ cũ in trường ấy ra sao *(việc của bản in)*

Bốn trường `ngay_phieu_chuyen`, `ngay_tiep_nhan_nguon_tin`, `ngay_viet_don`,
`ngay_cap_cccd_nguyen_don` được hệ cũ khai là **kiểu chữ** — cán bộ gõ tay, hệ cũ in nguyên văn.
Hệ mới khai `DateTime` (đúng cho cột CSDL) rồi dùng luôn kiểu ấy để in. Trong 11 trường `date`
thật của hệ cũ, chỉ `thoi_han_thuc_hien_uy_thac_dieu_tra` có mặt trên mẫu in.

Nay bảng kiểu ấy được **sinh thẳng từ CSDL hệ cũ** (132 trường) chứ không chép tay:
`gen-kieu-truong-he-cu.ts` → `kieu-truong-he-cu.generated.ts`.

### Nhóm 2 — dòng "Lưu:"

Hệ cũ không suy ra chữ viết tắt: mỗi cán bộ tự đặt một chuỗi ở `thanh_vien.ten_ngan`.

| | số cán bộ | |
|---|---:|---|
| chuỗi tự đặt KHỚP chữ hệ mới suy ra | 11 | |
| tự đặt KHÁC | **210** | `Bùi Thanh Trà → Trà` · `Đội 5 → Đ5` · `Tổ Truy Nã → TRUYNA` |
| để rỗng có chủ ý | 16 | hệ cũ in TRỐNG |
| không có cột | 1 | hệ cũ in HỌ TÊN ĐẦY ĐỦ |

Ba nhánh, không phải hai. Cột `users.shortName` nullable, và **chuỗi rỗng khác NULL** — gộp hai
cái là mất một nhánh.

---

## Hiệu lực — gieo lỗi

Ca kiểm xanh không chứng minh bộ đối chiếu có răng. Đã gieo lỗi hai tầng:

| Gieo gì | Kết quả |
|---|---|
| Đổi `ngay_viet_don` từ `text` sang `date` trong bảng kiểu | **4 ca kiểm đỏ**; khôi phục → xanh |
| Bỏ luật đệm số 0 của `${ngay}` | Bộ đối chiếu báo **8 dòng lệch** trên hồ sơ 86374; khôi phục → khớp hoàn toàn |

Bản thân công cụ cũng đã tự dẫm ba cái bẫy, cả ba nay đều có ca kiểm chốt:

1. **Không giải mã `&quot;`** — PhpWord nhét thẳng dấu ngoặc kép vào XML còn docxtemplater mã
   hoá; hai cách viết của cùng một ký tự. Công cụ báo mọi câu có ngoặc kép là lệch.
2. **So theo vị trí** — hệ cũ in thừa một dòng là mọi dòng sau lệch theo: báo 9 chỗ sai trong
   khi chỉ có 1.
3. **Đọc bản sao CSDL ngày 25/08** trong khi hệ cũ đã sửa hồ sơ — báo 28 dòng lệch giả.

---

## Khác có chủ đích — chờ anh quyết

Ba việc dưới đây **hệ mới cố ý không chép lại**, vì chép lại là in lỗi của hệ cũ lên văn bản
chính thức. Em không tự đảo ngược; anh quyết từng cái.

### 1. Hệ cũ in ra chính tên biến khi hồ sơ thiếu khoá

PhpWord chỉ thay khoá nào được khai. Hồ sơ không có khoá thì chỗ ấy in ra nguyên chữ.
Bằng chứng tận mắt: bản in hồ sơ 85651 có dòng `${yeu_cau_bo_sung}` nằm giữa văn bản.

| Chỗ điền | Số hồ sơ CÓ dữ liệu | Hệ cũ in | Hệ mới in |
|---|---:|---|---|
| `yeu_cau_bo_sung` | 871 / 55.067 | `${yeu_cau_bo_sung}` | *(trống)* |
| `de_xuat` | 1.138 / 55.067 | `${de_xuat}` | *(trống)* |
| `${ nguon_don}` | — | `${ nguon_don}` | *(trống)* |
| 16 khoá khác | 0 | `${bi_can}`, `${yeu_cau}`… | *(trống)* |

`${ nguon_don}` (thừa một dấu cách đầu) là **lỗi đánh máy trong `tra_ho_so_mau.docx`**: hệ cũ
gọi `setValue('nguon_don')` nên ô có dấu cách không bao giờ được thay.

**Đề xuất: giữ như hiện tại (in trống).**

### 2. Hai ô hệ mới điền được mà hệ cũ bỏ trống

`an_tra_bo_sung_mau.docx` in `${toi_danh}` và `${don_vi}`. Hồ sơ hệ cũ không có hai khoá ấy nên
hệ cũ in ra mã biến, còn hệ mới lấy được từ cột `crime`/`unit` của Vụ án.
**Đề xuất: giữ — cán bộ nhìn bản in hệ cũ tưởng hồ sơ chưa nhập tội danh.**

### 3. Mã canh `-1` ở ô Tình trạng hồ sơ

Hệ cũ đổ giá trị thô nên in cả mã máy. Ngày 28/08/2026 đã vá cho hệ mới hiện ô trống (PR #296).
**Đề xuất: giữ — in `-1` lên văn bản chính thức không phải đặc tả.**

---

## Phát hiện KHÁC, chưa sửa

### 1. 916 hồ sơ hệ cũ in được mà hệ mới không có màn in

| Bảng | Số hồ sơ |
|---|---:|
| `guidance_records` | 541 |
| `lawyers` | 257 |
| `exchanges` | 76 |
| `proposals` | 42 |

Hệ cũ in được mọi hồ sơ qua `/doi-1/XuatFile/<id>`. Hệ mới chỉ có màn in cho ba thực thể
Đơn thư / Vụ việc / Vụ án, nên 916 hồ sơ này không bấm in được.
**Ngoài phạm vi đợt này** (đây là chức năng, không phải dữ liệu). Cần anh quyết có mở không.

### 2. `vu_viec_mau.docx` chưa từng được hệ cũ dùng lần nào

Bảng `$template_mapping` của hệ cũ tra theo `loai`, nhưng `loai` THẬT trong dữ liệu rộng hơn
bảng ấy. Năm giá trị dưới đây **không có** trong bảng nên rơi về mẫu mặc định `vu_an_mau.docx`:

| `loai` | Số hồ sơ |
|---|---:|
| `vu_viec_da_phan_loai` | 3.040 |
| `vu_viec_phuong_xa` | 1.106 |
| `vu_an_da_phan_loai` | 908 |
| `vu_an_phuong_xa` | 350 |
| `kien_nghi_vks` | 19 |

Nghĩa là **hồ sơ Vụ việc của hệ cũ in bằng mẫu Vụ án**. Hệ mới cho cán bộ chọn mẫu trong danh
sách, nên chọn `vu_viec_mau.docx` sẽ ra một văn bản mà hệ cũ chưa từng in.
**Cần anh xác nhận: giữ mẫu Vụ việc, hay bỏ nó khỏi danh sách chọn?**

### 3. `so_dang_ky_bao_chua.docx` là mẫu mồ côi

Không `loai` nào trỏ tới nó ở hệ cũ, và 12 chỗ điền của nó không khớp trường hồ sơ nào.
Hệ mới vẫn nạp nó vào danh sách chọn. **Cần anh xác nhận có bỏ không.**

### 4. Ngắt đoạn của ô nhiều dòng

Hệ cũ đổi mỗi lần xuống dòng thành một **đoạn Word mới** có thụt đầu dòng và căn đều; hệ mới
dùng **ngắt dòng mềm**. Chữ giống nhau hoàn toàn — 21/40 hồ sơ khớp từng dòng đã bao gồm cả hồ
sơ có nội dung nhiều đoạn — nhưng thụt đầu dòng thì khác.
Ảnh hưởng 15.338 hồ sơ có `tom_tat_noi_dung` nhiều dòng và 6.259 hồ sơ có `nhan_xet` nhiều dòng.
**Là khác biệt về TRÌNH BÀY, không phải dữ liệu.** Chờ anh xem bản in thật rồi quyết.

---

## Việc phải làm trên máy thật

Hai bước, theo đúng thứ tự:

```bash
# 1. Thêm cột shortName
cd /home/pc02/current/backend && npx prisma migrate deploy

# 2. Nạp chữ viết tắt cán bộ từ hệ cũ (chạy thử trước, xem rồi mới --apply)
LEGACY_MONGO_URI="mongodb://…" npx ts-node src/legacy-migration/cli/nap-ten-ngan-can-bo.ts
LEGACY_MONGO_URI="mongodb://…" npx ts-node src/legacy-migration/cli/nap-ten-ngan-can-bo.ts --apply
```

Không chạy bước 2 thì dòng "Lưu:" in **họ tên đầy đủ** thay vì chữ viết tắt — vẫn đọc được,
không sai người, nhưng chưa giống hệ cũ.

---

## Cổng chặn tái diễn

| Cổng | Canh gì |
|---|---|
| `in-nhu-he-cu.spec.ts` | Từng luật điền, neo bằng bản in thật (25 ca) |
| `cho-dien-mau-he-cu.gate.spec.ts` | Mọi chỗ điền của 11 mẫu phải được phân loại (17 ca) |
| `so-ban-in.spec.ts` | Công cụ đối chiếu tự đúng: giải mã XML, căn dòng, chọn mẫu (21 ca) |
| `nap-ten-ngan-can-bo.spec.ts` | Bộ nạp không gán nhầm khi trùng tên (11 ca) |

Toàn bộ kho: **3.757 ca kiểm xanh**, `tsc --noEmit` sạch.

---

## Kết luận

**ĐẠT** cho phạm vi anh giao: dữ liệu in ra trên chứng từ Word của hệ mới nay giống hệ cũ, đã
kiểm bằng bản in thật trên 40 hồ sơ phủ đủ 10 loại và 5 nhóm rủi ro.

Bốn việc chờ anh quyết, đều đã ghi rõ ở trên: mã biến in ra khi thiếu dữ liệu · 916 hồ sơ chưa
có màn in · hai mẫu không dùng được · cách ngắt đoạn.
