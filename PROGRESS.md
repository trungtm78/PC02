# PROGRESS

Cập nhật: 2026-08-26T17:40+07:00 | Milestone: 6/7 | Task: còn đúng MỘT việc

> Epic trước (**Vụ án**, deploy máy thật 26/08/2026) lưu ở
> [docs/progress/2026-08-25-danh-sach-giong-he-cu.md](docs/progress/2026-08-25-danh-sach-giong-he-cu.md).
> Năm PR của epic ấy đã lên máy thật: #243 #244 #246 #247 #248.

Epic hiện tại: **Đồng bộ form Đơn thư với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: `main` — 8 PR đã gộp và deploy.

## Đã hoàn thành và ĐÃ LÊN MÁY THẬT

| PR | Nội dung | Bằng chứng |
|---|---|---|
| #249 | 43 ô Đơn thư xoá trắng không được — vá 3 tầng | **bấm thử trên máy thật**: xoá 3 ô, lưu, mở lại trống hẳn |
| #250 | Rút hạ tầng bố cục ra tầng chung | 401 ca kiểm Vụ án xanh **không sửa dòng nào** |
| #251 | 9 cột cho ô hệ cũ còn kẹt + `"0"` thôi thành số không | 9 cột có trên máy thật |
| #252 · #253 | Công cụ dọn số 0 + vá con trỏ trượt | **0 ô còn bằng 0** |
| #254 | Tách `PetitionFormPage` thành thư mục | 1.287 → 1.123 dòng |
| #255 | Bảng buộc bố cục hệ cũ vào dữ liệu Đơn thư | cổng `moiOCoChoLuu` phủ 132 ô |
| #256 | `renderOverride` — giữ widget mạnh của hệ mới | 654 ca kiểm Vụ án xanh |

### Dữ liệu đã chuyển (đo trên máy thật)

**Bù 51.386 ô** cho 35.502 đơn thư: `baoCaoBanGiamDocText` 35.261 · `tinhTrang` 15.039 ·
`soQDPhanCongNguonTin` 411 · `ngayQDPhanCongNguonTin` 407 · `soQDTamDinhChiNguonTin` 58 ·
`ngayQDTamDinhChiNguonTin` 61 · `canCuTamDinhChiNguonTin` 54 · `soPhucHoiNguonTin` 48 ·
`ngayPhucHoiNguonTin` 47.

**Dọn 61.045 ô số bịa** về trống. Còn lại 1.477 và 609 số thật — khớp số đo ban đầu.

Sao lưu riêng trước khi đổi dữ liệu:
`/var/backups/pc02/truoc-bu-donthu-20260826_151540.sql.gz` (118 MB).

## VIỆC CÒN LẠI — đúng một việc

**Dựng 10 tab lên form Đơn thư** (`frontend/src/pages/petitions/PetitionFormPage/index.tsx`).

Mọi hạ tầng đã sẵn: `PETITION_LEGACY_SPEC`, `LegacyTabBody`, `renderOverride`, `KHOA_NHANH_PHU`.

**BƯỚC TIẾP THEO, theo đúng thứ tự:**

1. Thêm trạng thái `tabDangMo` + thanh 10 tab đọc từ `LEGACY_TAB_LABEL`.
2. Bọc phần thẻ hiện có vào `<LegacyTabBody spec={PETITION_LEGACY_SPEC} tabId="info">` làm
   khối "Bổ sung hệ mới"; 9 tab còn lại render `LegacyTabBody` trần.
3. `pinnedTop` = hai ô máy chủ BẮT BUỘC mà bố cục hệ cũ không có: **`receivedDate`** và
   **`petitionType`**. Gập chúng đi là lặp lại lỗi #248 — cán bộ bấm Lưu, bị chặn bởi một ô
   không nhìn thấy được.
4. **Gỡ 29 ô trùng** khỏi các thẻ cũ — bố cục hệ cũ đã có ô cho chúng, để cả hai thì hai ô
   cùng ghi một cột. Script đã viết sẵn ở `scratchpad/godup.py` (biết cắt cả `<div>` lẫn
   `<label>`, tự dừng nếu hai khối lồng nhau). Danh sách 29 ô nằm trong script.
5. **BA Ô KHÔNG ĐƯỢC GỠ THẲNG** — phải chuyển thành `renderOverride`, nếu không là hạ cấp
   năng lực (đã thử một lần và thấy `dupQuery` / `PhoneInput` thành mã chết):
   `senderPhone` (PhoneInput) · `raSoatTrung` (tra đơn trùng) · `toiDanhBanDau` (tra tiền án).
6. Đăng ký Đơn thư vào `features/legacy-form/registry.ts` — **cùng lúc** với bước 2, không
   sớm hơn: đăng ký trước khi có tab thì panel parity ẩn ô mà tab chưa dựng.
7. Sửa hai ca kiểm chốt hợp đồng cũ trong `PetitionFormPage.payload.test.tsx`: nhãn
   "Tóm tắt nội dung" nay CÓ (bố cục hệ cũ có ô ấy), và "Ghi chú trùng đơn" nay chỉ còn MỘT.
8. Deploy rồi **bấm thử trên máy thật** — tạo đơn `KIEMTHU`, đủ 10 tab, xoá trắng vài ô, lưu,
   mở lại; xoá đơn thử; đếm số bản ghi trước sau phải bằng nhau.

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do |
|---|---|---|
| 26/08 | Ô "Phân loại ban đầu" chọn được nhưng mở `ConvertPetitionModal` | Anh chốt. Hệ mới tách ba bảng nên ô chọn không tự chuyển hồ sơ được |
| 26/08 | 30.089 + 30.956 ô `= 0` là "chưa có số liệu" → dọn | Anh chốt. Hệ cũ chỉ 1.447/599 hồ sơ có số thật |
| 26/08 | Gộp PR3 vào bảng buộc, không tách riêng | Tách riêng phải dựng lại khoá hệ cũ cho 182 mục từ trí nhớ — dễ sai, không kiểm chứng được |
| 26/08 | Bảng buộc dùng chung đặc tả của Vụ án, chỉ khai CHỖ LƯU | Hệ cũ dùng CHUNG một form `/doi-1/Them`; chép nội dung sang tệp thứ hai là mở đường cho hai màn trôi khỏi nhau |
| 26/08 | `renderOverride` thay vì bỏ widget mạnh | Giống hệ cũ ở nhãn/thứ tự/chỗ đứng, không giống ở chỗ làm yếu đi |
| 26/08 | Chặn `null` ở lớp ghi, không ở lớp DTO | `@IsOptional()` của `PartialType` chạy trước và nuốt mọi kiểm tra khác khi giá trị là `null` |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Đơn thư | Đối tượng là **Đơn thư**; màn danh sách đã khớp nên việc nằm ở **form** | Đo trên máy thật: `/petitions` đã có đúng 9 cột hệ cũ + Trạng thái |
| Chú thích tiếng Anh hay tiếng Việt | **Tiếng Việt**, theo convention kho mã | §4: "Convention hiện có của repo thắng sở thích cá nhân" |
| Ba ô `assignedTeamId`, `summary`, `stt` có gửi `null` không | **Không** | Không có chỗ nhập trên màn hình; đổi chỉ thêm đường xoá nhầm |
| Ma trận tài liệu vs số đo trên máy thật | **Bám số đo** | Ma trận đếm theo sự CÓ MẶT của khoá: `ngay_thong_ke` báo 126, thật 1 |

## Trạng thái test

Full suite: **PASS** — 1917/1917 giao diện, 3230/3230 máy chủ.
`tsc -b` + `tsc --noEmit`: sạch. Test fail: không.

## Nợ kỹ thuật / rủi ro

- **Chưa bấm thử form Đơn thư 10 tab trên máy thật** — chỉ làm được sau khi dựng tab. Bài học
  #248: ca kiểm xanh ba vòng vẫn sót 4 lỗi chặn.
- Ma trận `docs/legacy/field-parity-matrix.md` phân loại SAI hai chỗ cho petition (coi cột
  Boolean là đủ cho `truong_hop_bao_cao_ban_giam_doc`; gán `tinh_trang` là "RESOLVE" trong khi
  bảng không có cột ấy). Đã khai `PARITY_BANG_CHUNG_DO_TAY` kèm lý do; bộ sinh ma trận vẫn
  cần sửa.
- 95 hồ sơ di trú không giữ `legacyRaw` riêng đã xử được qua thực thể anh em, nhưng cách ấy
  mới áp cho bộ dọn số 0 — `backfill-parity.ts` vẫn bỏ qua nhóm này.
- Em đẩy thẳng một commit tài liệu lên `main` (bỏ qua PR), sai quy ước kho mã. Không lặp lại.
