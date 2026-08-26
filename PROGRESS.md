# PROGRESS

Cập nhật: 2026-08-26T13:05+07:00 | Milestone: PR0/7 | Task: 1/1 của PR0

> Epic trước (**Vụ án**, 5/5 milestone, deploy máy thật 26/08/2026) lưu ở
> [docs/progress/2026-08-25-danh-sach-giong-he-cu.md](docs/progress/2026-08-25-danh-sach-giong-he-cu.md).
> Bốn PR của epic ấy đã lên máy thật: #243 #244 #246 #247 #248.

Epic hiện tại: **Đồng bộ form Đơn thư với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: `fix/donthu-xoa-trang` → PR #249

## Đã hoàn thành

- [x] **PR0 — Vá xoá-trắng ở Đơn thư** — PR #249, 4 commit
  - `a652cdfb` tách `buildPetitionPayload.ts` + `petition-form-types.ts`, 41 khoá
    `|| undefined` → `oHeCu()` gửi `null`. Cổng `xoaTrangMoiODonThu.gate.test.ts`.
  - `25df9533` sửa lỗi múi giờ **do chính commit trên gây ra** (viết lại hàm lấy ngày bằng
    UTC thay vì dùng `today()` sẵn có) + hai ô tổ hợp đổi dấu hiệu `""` → `null`.
  - `17c77917` `stripHtmlTags` giữ nguyên `null` — 30 trường DTO Đơn thư trước đó nuốt mất
    tín hiệu xoá, khiến bản vá giao diện không có tác dụng.
  - `67d9c43a` chặn `null` vào ba cột NOT NULL (`stt`, `receivedDate`, `senderName`) → 400
    thay vì để Prisma nổ 500.

## Hàng đợi task kế tiếp

1. **PR1** — rút hạ tầng bố cục ra `features/legacy-form/` + `components/legacy-form/`,
   generic hoá `LegacyFormSpec`, thay nhánh `entity === "case"` ở `LegacyParityFields.tsx`
   bằng `ownedColumns(spec)`. *Không phụ thuộc gì.*
2. **PR2** — tách `PetitionFormPage.tsx` thành thư mục cùng tên. *Phụ thuộc PR0 (xong).*
3. **PR3** — chuyển Vụ án sang `DOI1_FORM_SHAPE` + `CASE_BINDING`. *Phụ thuộc PR1.*
4. **PR4** — 9 cột Đơn thư + migration + `PARITY.petition` 9→18 cặp + vá bộ chuyển dữ liệu
   coi `"0"` là rỗng. *Không phụ thuộc gì.*
5. **PR5** — form Đơn thư 10 tab theo bố cục hệ cũ. *Phụ thuộc PR2 + PR3 + PR4.*
6. **PR6** — backfill + dọn 30.089/30.956 ô `= 0` + siết cổng. *Phụ thuộc PR4.*

**BƯỚC TIẾP THEO:** chờ CI PR #249 xanh → gộp → deploy → bấm thử trên máy thật (tạo đơn
`KIEMTHU`, xoá trắng vài ô, lưu, mở lại phải trống) → bắt đầu PR1.

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 26/08 | Ô "Phân loại ban đầu" chọn được nhưng mở `ConvertPetitionModal` | Anh chốt. Hệ mới tách ba bảng nên ô chọn không tự chuyển hồ sơ được; chọn tự do sẽ nói dối | PR5 |
| 26/08 | 30.089 ô `soTienBiThietHai = 0` và 30.956 ô `soLuongBiHai = 0` là "chưa có số liệu" → dọn | Anh chốt. Hệ cũ chỉ có 1.447/599 hồ sơ có số thật; "thiệt hại 0 đồng" là khẳng định, khác "chưa có số liệu" | PR4 + PR6 |
| 26/08 | Một bản mô tả hình dạng form (`DOI1_FORM_SHAPE`) + hai bảng buộc riêng | Hệ cũ dùng CHUNG một form `/doi-1/Them` cho Đơn thư và Vụ án; chép nội dung sang tệp thứ hai là mở đường cho hai màn trôi khỏi nhau | PR1 + PR3 + PR5 |
| 26/08 | Tab "Bị can" đọc từ `Subject` qua `linkedCase`, không thêm cột | Petition không có quan hệ `subjects`, và bảng `bi_can` hệ cũ RỖNG | PR5 |
| 26/08 | Chặn `null` ở lớp ghi, không ở lớp DTO | `@IsOptional()` của `PartialType` chạy trước và nuốt mọi kiểm tra khác khi giá trị là `null` | PR0 (xong) |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Đơn thư | Đối tượng là **Đơn thư**; và màn *danh sách* Đơn thư đã khớp hệ cũ nên việc nằm ở **form** | Câu trước đó: "vào Đơn thư → click vào Thêm mới". Đo trên máy thật: `/petitions` đã có đúng 9 cột hệ cũ + Trạng thái |
| Chú thích tiếng Anh hay tiếng Việt | **Tiếng Việt**, theo convention kho mã | §4 của protocol: "Convention hiện có của repo thắng sở thích cá nhân". Toàn bộ kho mã và epic Vụ án vừa xong đều dùng tiếng Việt; đổi giữa chừng làm kho mã pha hai thứ tiếng |
| Ba ô `assignedTeamId`, `summary`, `stt` có đổi sang gửi `null` không | **Không** — giữ ngữ nghĩa cũ | Chúng không có chỗ nhập trên màn hình; cán bộ không xoá trắng được thứ mình không nhìn thấy, đổi chỉ thêm đường xoá nhầm |

## Trạng thái test

Full suite: **PASS** — 1892/1892 giao diện, 3142/3142 máy chủ.
`tsc -b` (giao diện) + `tsc --noEmit` (máy chủ): sạch.
Test fail: không.

## Nợ kỹ thuật / rủi ro

- **Chưa bấm thử trên máy thật.** Bài học #248: ca kiểm xanh ba vòng vẫn sót 4 lỗi chặn.
  Bắt buộc bấm thử sau khi PR #249 lên máy thật.
- `sttCu` có cột và **31.460 hồ sơ có dữ liệu** nhưng không có ô nhập nào → PR5.
- `truong_hop_bao_cao_ban_giam_doc`: **35.261 hồ sơ có CHỮ** mà cột hệ mới là Đúng/Sai → mất
  chữ. Thêm `baoCaoBanGiamDocText` ở PR4, đúng cách đã làm cho Vụ án.
- `tinh_trang`: **15.039 hồ sơ có dữ liệu**, chưa có cột → PR4.
- Yêu cầu anh nhắc lại 26/08: *"chuyển hết dữ liệu, tuyệt đối không thiếu field, tên field
  giữ nguyên hệ cũ"* → phải thành **cổng kiểm** ở PR6 (`audit-field-coverage` báo 0 khoá có
  data mà chưa map), không chỉ là lời hứa.
