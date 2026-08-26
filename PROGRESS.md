# PROGRESS

Cập nhật: 2026-08-26T14:35+07:00 | Milestone: PR4/7 | Task: 3/3 đã lên máy thật

> Epic trước (**Vụ án**, 5/5 milestone, deploy máy thật 26/08/2026) lưu ở
> [docs/progress/2026-08-25-danh-sach-giong-he-cu.md](docs/progress/2026-08-25-danh-sach-giong-he-cu.md).
> Bốn PR của epic ấy đã lên máy thật: #243 #244 #246 #247 #248.

Epic hiện tại: **Đồng bộ form Đơn thư với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`
Nhánh: đang ở `main`; PR #249 · #250 · #251 đã gộp và deploy

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

- [x] **PR1 — Rút hạ tầng bố cục ra tầng chung** — PR #250, deploy `2cd11da7`
  - `features/legacy-form/{types,accessors,registry}.ts` + `components/legacy-form/*`.
  - Hai tệp cũ của Vụ án thành lớp bọc mỏng → **401 ca kiểm Vụ án xanh không sửa dòng nào**.
  - Gỡ rẽ nhánh `entity === "case"` ở `LegacyParityFields` → `ownedColumnsFor(entity)`.
  - Cổng `khongDungHaiOChoMotCot` chạy cho cả ba thực thể. Codex sạch vòng đầu.

- [x] **PR4 — Chín cột Đơn thư + vá bộ chuyển số** — PR #251, deploy `6a8467ea`, đã kiểm cột trên máy thật
  - 9 cột: `baoCaoBanGiamDocText` (35.261) · `tinhTrang` (15.039) · 4 cặp QĐ/ngày (411/412, 58/62, 54, 48/48).
  - Cải chính ma trận: `ngay_thong_ke` thật 1 hồ sơ (ma trận báo 126), `ngay_thang_nam_het_thoi_hieu_vu_viec` thật 0 (báo 104) → KHÔNG dựng cột.
  - `PARITY_BANG_CHUNG_DO_TAY` cho hai chỗ ma trận phân loại sai, kèm lý do — không nới cổng.
  - `parseLegacySoLieu`: `"0"` trần là ô trống. `"0 người"` kèm đơn vị thì giữ.
  - Cổng `donthu-khong-thieu-field`: 45 khoá có ≥20 hồ sơ, mỗi khoá phải chỉ ra chỗ ở.
  - Codex bắt: cột không khai DTO thì `forbidNonWhitelisted` đá cả lời gọi 400 → mở đủ ba cửa.

## Hàng đợi task kế tiếp

1. **PR6** — bù dữ liệu 9 cột mới + dọn 30.089/30.956 ô `= 0` + siết cổng. *Phụ thuộc PR4 (xong).*
2. **PR2** — tách `PetitionFormPage.tsx` thành thư mục cùng tên. *Phụ thuộc PR0 (xong).*
3. **PR3** — chuyển Vụ án sang `DOI1_FORM_SHAPE` + `CASE_BINDING`. *Phụ thuộc PR1 (xong).*
4. **PR5** — form Đơn thư 10 tab theo bố cục hệ cũ. *Phụ thuộc PR2 + PR3 + PR4.*

**BƯỚC TIẾP THEO:** PR6 — sao lưu `pg_dump`, chạy `backfill-parity.ts --entity petition --dry`
đọc báo cáo, rồi chạy thật; sau đó dọn số 0 bằng script riêng có bản lui riêng.

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
