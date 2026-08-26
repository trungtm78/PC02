# UAT-COVERAGE — Epic "Form Vụ án khớp bố cục hệ cũ"

Nhánh: `feat/legacy-form-parity-vu-an` · Lập 2026-08-26

Yêu cầu gốc của anh, chép nguyên văn để đối chiếu ngược:

> Toàn bộ item trên màn hình nhập liệu phải giống hệ thống cũ, cả về tên và vị trí trong màn
> hình tạo mới và chỉnh sửa. Đồng thời làm sao chuyển được toàn bộ data hệ thống cũ vào hệ
> thống mới.

Kèm bốn quyết định đã chốt: caption giữ nguyên (sửa 3 lỗi đánh máy) · action/lọc/xuất/in
giữ của hệ mới · màn chuẩn là `/VuAn` · ô hệ mới hệ cũ không có thì gập xuống cuối tab.

---

## Cách đọc bảng

| Cột | Nghĩa |
|---|---|
| Viết test | Đã có ca kiểm tự động phủ dòng này |
| Chạy test | Đã chạy và có kết quả |
| Kết quả | ĐẠT / KHÔNG ĐẠT / CHỜ |

Mốc đúng của nhóm A lấy từ `frontend/src/features/cases/__tests__/fixtures/old-system-captions.ts`
— bản kết xuất DOM chụp thẳng từ `pc02hcm.com/doi-1/Them` ngày 26/08/2026 (chỉ đọc).

---

## A. Bố cục màn hình nhập liệu — 10 tab

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| A1 | Tab **Thông tin** — 32 ô, đúng nhãn, đúng thứ tự, đúng nửa dòng/tràn dòng | ✅ `legacy-form-layout.test.ts` + `LegacyTabBody.test.tsx` | ✅ | ĐẠT |
| A2 | Tab **Vụ việc** — 23 ô (13 gương) | ✅ | ✅ | ĐẠT |
| A3 | Tab **Vụ án** — 34 ô (14 gương) | ✅ | ✅ | ĐẠT |
| A4 | Tab **ĐTBS** — 4 ô gương + bảng con 5 cột | ✅ `legacy-form-layout.test.ts` + `DTBSTable.test.tsx` | ✅ | **ĐẠT** |
| A4b | Bảng ĐTBS: 5 cột dữ liệu + Thao tác, đúng thứ tự hệ cũ | ✅ | ✅ | ĐẠT |
| A4c | Chế độ Tạo mới: nói rõ phải lưu hồ sơ trước | ✅ | ✅ | ĐẠT |
| A4d | Ô ngày để trống bỏ hẳn khỏi lời gọi, không gửi chuỗi rỗng | ✅ | ✅ | ĐẠT |
| A4e | Ba mốc ngày ĐTBS qua được DTO máy chủ | ✅ `dtbs-moc-ngay.spec.ts` | ✅ | ĐẠT |
| A5 | Tab **Vụ việc TĐC** — 34 ô | ✅ | ✅ | ĐẠT |
| A6 | Tab **Vụ án TĐC** — 26 ô | ✅ | ✅ | ĐẠT |
| A7 | Tab **Vật chứng** — 3 ô | ✅ | ✅ | ĐẠT |
| A8 | Tab **HS nghiệp vụ** — 5 ô | ✅ | ✅ | ĐẠT |
| A9 | Tab **TK 48 trường** — 43 ô | ✅ | ✅ | ĐẠT |
| A10 | Tab **Ghi âm, ghi hình** — 13 ô | ✅ | ✅ | ĐẠT |
| A11 | Tổng số ô khớp bản chụp, không thừa không thiếu | ✅ | ✅ | ĐẠT |
| A12 | Sửa đúng 3 lỗi đánh máy, mọi chữ khác giữ nguyên | ✅ | ✅ | ĐẠT |
| A13 | Trường gương: sửa một chỗ, mọi tab đổi theo | ✅ `LegacyLayoutSection.test.tsx` | ✅ | ĐẠT |
| A14 | Màn **Tạo mới** và **Chỉnh sửa** dùng chung một đặc tả | ✅ (cấu trúc: cùng `LegacyTabBody`) | ✅ | ĐẠT |
| A15 | Khối "Bổ sung hệ mới" gập sẵn, không xoá tính năng nào | ✅ `LegacyTabBody.test.tsx` | ✅ | ĐẠT |
| A16 | Khối "Nguồn vụ án" ghim trên cùng (máy chủ bắt buộc) | ✅ | ✅ | ĐẠT |

## B. Màn Danh sách vụ án

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| B1 | 9 cột hệ cũ + Trạng thái, đúng thứ tự | ✅ `CaseListPageShell.test.tsx` | ✅ | ĐẠT |
| B2 | Cột **Đối tượng bị can** ở vị trí 3, in tên bị can | ✅ | ✅ | ĐẠT |
| B3 | Dư thì gộp "+N", đếm đúng số bị can | ✅ (FE) + ✅ `cases.service.spec.ts` (BE `_count`) | ✅ | ĐẠT |
| B4 | Hồ sơ chưa có bị can hiện gạch ngang | ✅ | ✅ | ĐẠT |
| B5 | `Nguồn đơn/Đơn vị giao` ẩn sẵn, bật lại được | ✅ | ✅ | ĐẠT |
| B6 | Thao tác giữ đầu + ghim mép trái | ✅ | ✅ | ĐẠT |
| B7 | Bộ lọc, xuất Excel, phân trang, sắp xếp giữ nguyên | ✅ (bộ ca kiểm sẵn có) | ✅ | ĐẠT |

## C. Lưu và đọc lại dữ liệu

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| C1 | Điền kín mọi ô của 10 tab → không ô nào rơi giữa đường | ✅ `legacyFormPayload.test.ts` | ✅ | ĐẠT |
| C2 | Một vòng lưu → mở lại: giá trị giữ nguyên | ✅ | ✅ | ĐẠT |
| C3 | Xoá trắng một ô → giá trị cũ mất theo | ✅ | ✅ | ĐẠT |
| C4 | DTO nhận đủ ô mới (thiếu là 400, không lưu được) | ✅ `legacy-form-parity.dto.spec.ts` | ✅ | ĐẠT |
| C5 | Ô hệ cũ đi xuống Prisma ở CẢ tạo mới lẫn chỉnh sửa | ✅ `cases.service.spec.ts` + `legacy-form-parity.mapper.spec.ts` | ✅ | ĐẠT |
| C6 | Đối tượng nhập tay không bị loại thầm lặng | ✅ `subjectsKhongMatDuLieu.test.ts` | ✅ | ĐẠT |
| C7 | Ô rỗng của đối tượng bỏ hẳn, không gửi chuỗi rỗng | ✅ | ✅ | ĐẠT |
| C8 | Panel bổ sung không đè giá trị gõ trong tab | ✅ `LegacyParityFields.khongTrungO.test.tsx` | ✅ | ĐẠT |
| C9 | Tab Ủy thác dùng chung ô với tab Thông tin | ✅ | ✅ | ĐẠT |
| C10 | Mã hồ sơ không gửi lên (số hiệu tự sinh) | ✅ | ✅ | ĐẠT |

## D. Chuyển dữ liệu hệ cũ

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| D1 | 7 mốc ngày thống kê vào `case_statistics` | ✅ `legacy-form-parity.migration.spec.ts` | ✅ | ĐẠT |
| D2 | 12 chỉ tiêu VPHC / ghi âm ghi hình vào cột | ✅ | ✅ | ĐẠT |
| D3 | 24 khoá hệ cũ mới có cột vào `cases` | ✅ | ✅ | ĐẠT |
| D4 | Bản gốc `legacyRaw` giữ nguyên, lưới an toàn không mỏng đi | ✅ | ✅ | ĐẠT |
| D5 | Sổ đăng ký khoá đã ánh xạ phản ánh đúng thực tế | ✅ | ✅ | ĐẠT |
| D6 | Cổng "không sót dữ liệu" xanh | ✅ `field-parity.gate.spec.ts` | ✅ | ĐẠT |
| D7 | Cờ `formOnly` không thành cửa sau khai cột bừa | ✅ | ✅ | ĐẠT |
| D8 | Công cụ bù chỉ điền ô trống, chạy lại không đổi gì | ✅ `backfill-statistic.util.spec.ts` | ✅ | ĐẠT |
| D9 | **Bù dữ liệu trên CSDL THẬT, đọc lại từng cột** | ✅ `verify-backfill-parity.ts` | ✅ | ĐẠT |
| D10 | Công cụ sinh `legacyParityFields.generated.ts` khớp đặc tả | ✅ (`--check`) | ✅ | ĐẠT |

## E. Đối chiếu trên bản chạy thật

Chạy 2026-08-26 trên bản dựng thật: máy chủ `localhost:3000` (PG18), giao diện
`localhost:5173`, đăng nhập `admin`.

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| E1 | `/cases` — cột khớp ảnh `old-vuan-list.png` | Đối chiếu tay | ✅ | **ĐẠT** |
| E2 | `/cases/new` — 10 tab đúng thứ tự, tab Thông tin đúng 32 ô | Đối chiếu tay | ✅ | **ĐẠT** |
| E2b | Tab Vụ việc TĐC đúng 34 ô, nhãn kèm hậu tố `(Tab: …)` | Đối chiếu tay | ✅ | **ĐẠT** |
| E3 | `/cases/:id/edit` — bố cục y hệt màn Tạo mới (32 ô) | Đối chiếu tay | ✅ | **ĐẠT** |
| E3b | Panel bổ sung KHÔNG dựng ô trùng (0 ô parity) | Đối chiếu tay | ✅ | **ĐẠT** |
| E4 | Nhập → Lưu (201) → mở lại: **7/7 ô giữ nguyên giá trị** | Đối chiếu tay | ✅ | **ĐẠT** |
| E5 | Hồ sơ ĐÃ DI TRÚ mở ra có dữ liệu ở ô hệ cũ | Đối chiếu tay | ✅ | **ĐẠT** |
| E5b | Tab TK 48 trường + Vật chứng của hồ sơ di trú cũng có dữ liệu | Đối chiếu tay | ✅ | **ĐẠT** |

### Chi tiết E1 — cột thật đọc từ màn hình

```
Thao tác | STT | Ngày đề xuất | Đối tượng bị can | Tên cá nhân, cơ quan, tổ chức cung cấp,
bị hại | Tóm tắt nội dung | Đơn vị giải quyết | Kết quả xử lý, giải quyết khác | Người nhập |
Trạng thái
```

Đúng 9 cột hệ cũ (`/VuAn`) + Trạng thái, `Đối tượng bị can` ở vị trí thứ ba.

### Chi tiết E4 — bảy ô đọc lại sau khi lưu

| Ô | Giá trị gõ vào | Giá trị đọc lại |
|---|---|---|
| `ngayDeXuat` | 2026-08-20 | `2026-08-20` |
| `nguonDon` | Bưu điện | `Bưu điện` |
| `soPhieuChuyen` | PC-777 | `PC-777` |
| `ghiChuTrungDon` | Ghi chú trùng đơn thử | `Ghi chú trùng đơn thử` |
| `lanhDaoToTung` | Nguyễn Văn Lãnh | `Nguyễn Văn Lãnh` |
| `doVatTaiLieuKemTheo` | USB, CCCD photo | `USB, CCCD photo` |
| `description` | Nội dung kiểm chứng… | `Nội dung kiểm chứng…` |

Bốn ô `ngayDeXuat`, `ghiChuTrungDon`, `lanhDaoToTung`, `doVatTaiLieuKemTheo` trước epic này
**không có đường lên máy chủ** — gõ xong lưu là mất.

### Chi tiết E5 — hồ sơ ĐÃ DI TRÚ mở ở chế độ Sửa

Dựng bằng `seed-ho-so-di-tru-mau.ts` (chỉ có `legacyRaw`, không điền sẵn cột nào — đúng cảnh
hồ sơ di trú trước khi hệ thống có cột mới), rồi chạy `backfill-parity.ts --entity case`.

**21/21 ô hệ cũ ở tab Thông tin có dữ liệu**, không ô nào trắng. Tab TK 48 trường có đủ ba
mốc ngày thống kê + ngày tội phạm xảy ra + số bị hại + số tiền thiệt hại; tab Vật chứng có
đủ ba ô.

**Bốn lỗ hổng chỉ lộ ra ở bước này** (ca kiểm đơn vị không bắt được, vì chúng chỉ kiểm
`buildCase` — đường của hồ sơ di trú MỚI — chứ không kiểm `parityColumns`, đường mà công cụ
bù dùng cho hồ sơ ĐÃ di trú):

| Ô | Hậu quả nếu không vá |
|---|---|
| `baoCaoBanGiamDocText` | Mất nội dung chỉ đạo Ban Giám đốc — **đo thật: 350 vụ án** |
| `loaiThongTin` | Ô "Loại thông tin" trắng |
| `ngayTiepNhan` | Ô "Ngày tiếp nhận (theo biên bản…)" trắng — **đo thật: 1.505 vụ án** |
| `toiDanhBanDau` | Ô "Tội danh cũ trước đây" trắng — **đo thật: 2.647 vụ án** |

> **Đính chính:** các con số 34.931 / 46.259 / 49.147 / 21.854 nêu trong bản đầu lấy từ
> `field-catalog.generated.json`, mà tệp đó đếm KHOÁ CÓ MẶT trên toàn bộ 54.257 bản ghi hệ
> cũ — không phải số vụ án, và không phân biệt giá trị thật với mốc rỗng. Số đo thật trên
> máy chủ sau khi bù nằm ở bảng dưới.

---

**Tổng: 44 dòng · 44 ĐẠT · 0 KHÔNG ĐẠT.**

---

## F. Áp lên máy thật — 26/08/2026

PR #243 gộp (`ad17e37a`), deploy thành công, máy chủ khoẻ.

`backfill-parity.ts --entity case`: quét **3.359** hồ sơ, cập nhật **3.334**, điền **8.010 ô**.

| Cột | Trước | Sau | Phủ |
|---|---|---|---|
| `phanLoaiNguonTinBanDau` | 0 | 3.334 | 99,3% |
| `toiDanhBanDau` | 0 | 2.647 | 78,8% |
| `ngayTiepNhan` | 417 | 1.922 | 57,2% |
| `baoCaoBanGiamDocText` | 0 | 350 | 10,4% |
| `soQDPhanCongNguonTin` | 0 | 64 | 1,9% |
| `ngayQDPhanCongNguonTin` | 0 | 65 | 1,9% |
| 5 cột TĐC nguồn tin | 0 | 9 mỗi cột | 0,3% |

### 37 cột còn trống — đã kiểm và ĐÚNG

- **27 khoá** không hề có trong `legacy_raw` của vụ án
- **10 khoá** có mặt nhưng chỉ chứa **mốc rỗng của hệ cũ** (`"0"`, `"-25200"`). Đếm giá trị
  ngày thật trong dải mapper nhận: **0 hồ sơ** cho cả chín khoá mốc ngày.
  `parseLegacyDate` cố ý loại chúng (`legacy-mapper.ts:152`). Điền vào sẽ tạo ~1.800 ngày
  giả 01/01/1970 — tệ hơn hẳn để trống.

**Không mất dữ liệu nào.**

## Còn tồn

1. **Nạp dữ liệu môi trường**: bảng `document_number_templates` rỗng làm `POST /cases` trả
   404 — không phải lỗi của epic, nhưng ai dựng máy mới phải chạy
   `ts-node prisma/seed-document-numbers.ts`, nếu không sẽ không lưu được hồ sơ nào.

## Ngoài phạm vi (có lý do)

- **Đơn thư và Vụ việc**: epic này chỉ nhận màn Vụ án. Hai màn kia vẫn dùng đường dedup cũ.
- **Dựng cơ sở dữ liệu từ số không**: `prisma migrate deploy` hỏng ở
  `20260227000000_add_case_metadata` — nợ có sẵn, không do epic này, nhưng là rủi ro thật cho
  lần dựng máy chủ mới. Đã ghi ở `PROGRESS.md`.
