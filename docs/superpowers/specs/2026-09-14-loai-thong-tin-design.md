# Ô "Loại thông tin" của Đơn thư — một ô, smart select, danh mục từ dữ liệu cũ

Ngày: 14/09/2026 · Trạng thái: chờ anh duyệt · Đợt 2 (tìm kiếm kiểu Odoo trên mọi màn danh sách) là đặc tả RIÊNG.

## 1. Vì sao

Form Đơn thư có hai ô cùng nghĩa:

| Ô | Cột | Kiểu | Dữ liệu (bản sao 27/08/2026) |
|---|---|---|---|
| Loại đơn thư (bắt buộc) | `petitions.petitionType` | enum `LoaiDon`: TO_CAO · KHIEU_NAI · KIEN_NGHI · PHAN_ANH | **trống 46.741/46.741** |
| Loại thông tin | `petitions.loaiThongTin` | chữ tự do | **có ở 46.655**, 735 giá trị (624 sau khi bỏ hoa/thường, dấu cách) |

Hệ cũ chỉ có MỘT ô `loai_thong_tin` và **không có bảng danh mục** — cán bộ gõ tay (`legacy_danh_muc` là dữ liệu cửa hàng, không liên quan). Kết quả: cùng một loại có nhiều cách viết ("Tố giác" / "tố giác" / "Tố giác (02 đơn)"; "Khiếu nại (QĐ tố tụng)" / "Khiếu nại (Quyết định tố tụng)").

Anh yêu cầu: gộp về một ô như hệ cũ, dùng smart select như ô "Đơn vị xử lý" (tìm trên máy chủ + tạo mới), nạp danh mục từ dữ liệu cũ (giống nhau chỉ lấy một), điền dữ liệu cho hồ sơ.

**Ràng buộc phải giữ**: `petitionType` đang quyết định hạn giải quyết tự tính (`petitions.service.ts:476`): TO_CAO 30 ngày · KHIEU_NAI 30 · KIEN_NGHI 15 · còn lại → PHAN_ANH 15 (`seed-deadline-rules.ts:33-36`). Bỏ ô mà không có gì thay là hạn tính sai.

## 2. Quyết định đã chốt với anh

1. **Gộp thành một ô** "Loại thông tin". Bỏ ô "Loại đơn thư" khỏi form.
2. **Gộp theo nghĩa + chuẩn hoá chữ trên hồ sơ.** In bảng gộp cho anh duyệt trước khi ghi; bản gốc hệ cũ vẫn nằm nguyên trong `legacyRaw`.
3. **Mỗi mục danh mục mang một nhóm hạn** (Tố cáo / Khiếu nại / Kiến nghị / Phản ánh), gán sẵn theo tên, anh sửa được trong màn Danh mục.
4. **Nguồn điền cho hồ sơ trống**: `loai_thong_tin` trong bản thô hệ cũ → giá trị `petitionType` hiện có → suy từ tóm tắt nội dung. KHÔNG ghi đè hồ sơ đã có giá trị (ngoài bước chuẩn hoá chữ ở mục 2).
5. Làm đợt này trước; tìm kiếm Odoo đợt sau.

## 3. Thiết kế

### 3.1 Danh mục `LOAI_THONG_TIN`

- Dùng bảng `Directory` sẵn có, `type = 'LOAI_THONG_TIN'`. Không thêm bảng, không migration lược đồ.
- `metadata`: `{ nhomHan: 'TO_CAO'|'KHIEU_NAI'|'KIEN_NGHI'|'PHAN_ANH', nguon: 'legacy'|'tao-nhanh', choDuyet: boolean, soHoSo: number, bienThe: string[] }`.
- **Khoá gộp** (hàm thuần, tệp mới `backend/src/common/utils/khoa-loai-thong-tin.util.ts`, cạnh `chuan-hoa-ten.util.ts`):
  NFC → bỏ dấu cách thừa (kể cả NBSP) → chữ thường → bỏ hậu tố đếm `(0N đơn)` → mở viết tắt trong ngoặc (`QĐ`→`quyết định`, `HV`→`hành vi`) → bỏ dấu câu cuối.
- **Tên hiển thị** của mục = cách viết phổ biến nhất trong nhóm, viết hoa chữ đầu.
- **Giá trị ghép** ("Tố giác, Đề nghị") giữ thành MỘT mục riêng — không tách, vì hồ sơ ấy thật sự mang cả hai.
- **Nhóm hạn gán sẵn**: khoá bắt đầu `tố cáo` → TO_CAO; `khiếu nại` → KHIEU_NAI; `kiến nghị` → KIEN_NGHI; còn lại → PHAN_ANH (đúng hành vi hiện nay khi không chọn loại).
- Mục **dưới 3 hồ sơ** → `choDuyet: true` (cùng cơ chế duyệt đã có của `DON_VI`, `DirectoriesPage.tsx:231-248`).

### 3.2 Form Đơn thư

- Gỡ ô `<select> Loại đơn thư` (`PetitionFormPage/index.tsx:825-840`) và luật bắt buộc (`validate.ts:47-49`).
- Ô "Loại thông tin" (đang là ô chữ trong bố cục hệ cũ) → `FKSelect directoryType="LOAI_THONG_TIN"` + `canCreate` + `useQuickCreateDirectoryModalSafe` (y hệt ô Đơn vị xử lý, `index.tsx:629-643`), qua `renderOverride` của `LegacyTabBody`. Giữ `testId="field-loaiThongTin"`, cột `loaiThongTin` không đổi.
- `buildPetitionPayload.ts`: thôi gửi `petitionType`.

### 3.3 Máy chủ

- `directory.service.ts:25` `LOAI_TAO_NHANH_DUOC` thêm `'LOAI_THONG_TIN'`. `taoNhanh` dùng khoá gộp của 3.1 để chặn tạo trùng, mục tạo nhanh `nhomHan: 'PHAN_ANH'`, `choDuyet: true`.
- `create-petition.dto.ts:110-114`: `petitionType` thành **tuỳ chọn** (vẫn kiểm thuộc danh mục nếu có gửi).
- Hàm thuần mới `nhomHanCuaLoaiThongTin(loaiThongTin, danhMuc)` ở `backend/src/petitions/loai-thong-tin.rule.ts`: tra mục danh mục theo khoá gộp → `metadata.nhomHan`; không thấy → luật theo tên ở 3.1.
- `petitions.service.ts` create/update: nếu `dto.petitionType` trống thì gán `petitionType = nhomHanCuaLoaiThongTin(...)` TRƯỚC khối tính hạn (476). Cột `petitionType` giữ lại làm "nhóm hạn" — Excel, bulk export, số văn bản (`source-resolver.ts:27`), đồng bộ Vụ án (`cases.service.ts:1627`) đọc tiếp không vỡ.
- `field-catalog.ts:431` (`loaiDon` bản in): đảo ưu tiên — `loaiThongTin` trước, `petitionType` lùi. Hệ cũ in đúng chữ loại thông tin.
- Bộ nạp hệ cũ (`legacy-migration.service.ts`, cạnh `ganHuongXuLyKhiTrong`): chuẩn hoá `loaiThongTin` về tên danh mục và gán `petitionType` theo nhóm hạn — lần `cap-nhat-tu-he-cu` sau không đổ lại chữ lộn xộn.

### 3.4 Nạp và chuẩn hoá dữ liệu — CLI `nap-loai-thong-tin.ts`

Mẫu y hệt `nap-don-vi-xu-ly.ts`: mặc định chạy thử, `--that` mới ghi.

1. Gom mọi giá trị `petitions.loaiThongTin` + `legacyRaw.loai_thong_tin` (kèm Vụ việc/Vụ án nếu cùng nghĩa — chỉ ĐỌC để bổ sung danh mục, không sửa bảng ấy đợt này).
2. Nhóm theo khoá gộp → in **bảng gộp**: tên chuẩn · số hồ sơ · nhóm hạn · các biến thể bị gộp. Xuất CSV cho anh duyệt.
3. Ghi: `createMany` danh mục (bỏ qua mục đã có); đổi `loaiThongTin` hồ sơ về tên chuẩn; hồ sơ trống điền theo thứ tự ở mục 2.4 (suy từ tóm tắt chỉ khi câu mở đầu khớp đúng một tên danh mục, vd "Tố giác ông…" → Tố giác; không khớp thì để trống); gán `petitionType` theo nhóm hạn khi đang trống.
4. SQL thô theo lô, KHÔNG đẩy `updatedAt`; chạy lại ra 0.

## 4. Không làm

- Không xoá cột `petitionType` hay enum `LoaiDon` (nhiều nơi đọc; migration xoá là một chiều).
- Không đổi Vụ việc / Vụ án (họ cũng có `loaiThongTin` — đợt sau nếu anh muốn).
- Không tính lại hạn của hồ sơ đã có hạn.

## 5. Kiểm

- Hàm khoá gộp: ca kiểm bằng CHUỖI THẬT từ dữ liệu (các cặp ở mục 1) + ca không được gộp nhầm ("Tố giác" ≠ "Tố cáo", "Rút tố giác" ≠ "Tố giác").
- Nhóm hạn: 4 nhóm + mục tạo nhanh + tên lạ → PHAN_ANH; hạn tính ra đúng số ngày khi tạo đơn không gửi `petitionType`.
- Form: chỉ còn MỘT ô hỏi loại (đếm ô); chọn/tạo mới được; lưu không bị chặn vì thiếu Loại đơn thư.
- Bản in `loaiDon`: hồ sơ có cả hai cột in `loaiThongTin`.
- CLI: chạy thử trên bản sao `pc02_that` local, đọc bảng gộp; gieo lỗi hàm khoá gộp phải làm ca kiểm đỏ.
- Máy thật: sao lưu → chạy thử → anh duyệt bảng gộp → `--that` → tạo một đơn thư mới chọn "Tố giác" kiểm hạn; mở hồ sơ di trú kiểm ô hiện đúng tên chuẩn.
