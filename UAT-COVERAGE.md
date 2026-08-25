# UAT-COVERAGE — Danh sách theo bố cục hệ cũ (v0.73.0.0)

Spec gốc: `~/.claude/plans/gleaming-pondering-thacker.md` · PR #230 (đã gộp `2dfdeab`, **đã deploy**)

Chạy ngày **25/08/2026** trên **bản chạy thật** `https://new.pc02hcm.com` với **dữ liệu thật**
(46.660 đơn thư · 4.717 vụ việc · 3.380 vụ án). Toàn bộ ca kiểm API **chỉ đọc** — không
tạo/sửa/xoá hồ sơ nào.

## Kết quả

| Lớp | Số ca | Đạt | Không đạt |
|---|---|---|---|
| Ca kiểm đơn vị máy chủ (jest) | 2.975 | **2.975** | 0 |
| Ca kiểm đơn vị giao diện (vitest) | 1.541 | **1.541** | 0 |
| **UAT API trên bản chạy thật (playwright)** | **26** | **26** | **0** |
| **Tổng** | **4.542** | **4.542** | **0** |

## Ma trận phủ

| ID | Màn hình / Chức năng | Bằng chứng | Kết quả |
|---|---|---|---|
| U-01 | Đơn thư — đủ cột đúng thứ tự hệ cũ | `PetitionListPageShell.test.tsx` — so vị trí tiêu đề cột | ✅ PASS |
| U-02 | Đơn thư — Tóm tắt nội dung có chữ, "Xem thêm" mở rộng | unit + UAT `AC-1` trên bản thật | ✅ PASS |
| U-03 | Đơn thư — Thao tác là cột CUỐI | unit — `viTri('Thao tác') === headers.length - 1` | ✅ PASS |
| U-04 | Đơn thư — mã hiện `26-…`, dữ liệu vẫn `2026-…` | unit + `formatHoSoCode` (4 ca) | ✅ PASS |
| U-05 | Đơn thư — lọc STT **cả hai dạng** ra cùng hồ sơ | UAT `AC-3` — so danh sách id, không chỉ so số lượng | ✅ PASS |
| U-06 | Đơn thư — lọc STT cũ | UAT `AC-4` | ✅ PASS |
| U-07 | Đơn thư — lọc Cán bộ nhập | UAT `AC-5` + `AC-7` (dropdown lấy được danh sách) | ✅ PASS |
| U-08 | Đơn thư — Từ ngày / Đến ngày | `LegacyFilterPanel.test.tsx` + bộ lọc ngày sẵn có | ✅ PASS |
| U-09 | Đơn thư — Chọn khoảng thời gian (5 mốc) | `dateRangePresets.test.ts` (10 ca) | ✅ PASS |
| U-10 | Đơn thư — Xóa bộ lọc | unit — `onReset` + `url.clearAll()` | ✅ PASS |
| U-11 | Đơn thư — **GIỮ** chip trạng thái, thẻ thống kê | unit `getAllByRole('tab')` + UAT `/stats` | ✅ PASS |
| U-12 | Đơn thư — **GIỮ** sắp xếp theo cột | UAT — `sortOrder=asc` vẫn 200 | ✅ PASS |
| U-13 | Vụ việc — đủ cột, Thao tác cuối, Tóm tắt có chữ | `IncidentListPageShell.test.tsx` + UAT `AC-1` | ✅ PASS |
| U-14 | Vụ việc — mã hiện dạng ngắn | unit — hiện `26-9706` | ✅ PASS |
| U-15 | Vụ việc — lọc STT / STT cũ / Cán bộ nhập | UAT `AC-3/4/5` | ✅ PASS |
| U-16 | Vụ việc — GIỮ chip, thẻ, sắp xếp | unit + UAT | ✅ PASS |
| U-17 | Vụ án — đủ cột, Thao tác cuối, Tóm tắt có chữ | `CaseListPageShell.test.tsx` + UAT `AC-1` | ✅ PASS |
| U-18 | Vụ án — mã hiện dạng ngắn | unit — hiện `26-9893` | ✅ PASS |
| U-19 | Vụ án — lọc STT / STT cũ / Cán bộ nhập | UAT `AC-3/4/5` | ✅ PASS |
| U-20 | Vụ án — GIỮ chip, thẻ, sắp xếp | unit + UAT | ✅ PASS |
| U-21 | Cả ba — bộ lọc lưu trong địa chỉ trang | unit — đọc `url.getParam`, ca kiểm nạp từ URL | ✅ PASS |
| U-22 | Cả ba — đổi bộ lọc thì về trang 1 | unit — `setParams({..., page: '1'})` | ✅ PASS |
| U-23 | Xuất Excel | **Đơn thư**: HTTP 200, file Excel thật 101.636 byte. **Vụ việc/Vụ án**: N/A — máy chủ KHÔNG có endpoint xuất; nút không được dựng nên không có nút chết | ✅ PASS |
| U-24 | Máy chủ — lọc `stt` hai dạng (API thật) | UAT `AC-3` × 3 màn hình | ✅ PASS |

**24/24 dòng PASS.**

## Hai ca kiểm cố ý bắt thứ ca kiểm đơn vị không thấy

1. **Mã không tồn tại phải ra 0 hồ sơ.** Nếu lọc dùng `contains` thay vì khớp chính xác,
   một chuỗi như `26-1` sẽ quét trúng hàng nghìn mã khác mà vẫn "chạy được".
2. **Ô lọc RỖNG không được thu hẹp kết quả.** Chuỗi rỗng lọt vào mệnh đề `where` rồi lọc ra
   0 hồ sơ là bẫy kinh điển — người dùng chỉ thấy "danh sách trống", không thấy lỗi.

Cả hai đều PASS trên cả ba màn hình.

## Ngoài phạm vi — có lý do

| Không kiểm | Lý do |
|---|---|
| "Đã chuyển đội khác", "Tìm trường bỏ trống" | **Không dựng** — hệ mới chưa có khái niệm tương đương (anh chốt qua AskUserQuestion) |
| Ô "Từ khóa" trong thẻ lọc | **Không dựng** — thanh công cụ ngay trên đã có; hai ô tìm trên một màn hình gây nhầm |
| Trang Tổng hợp, UTĐT | Ngoài phạm vi đợt này (spec §Cố ý KHÔNG làm) |
| Ứng dụng di động | Quy trình dựng hỏng sẵn từ 14/08 (`subosito/flutter-action` ghim SHA không còn tồn tại) |

## Phát hiện trong lúc UAT — KHÔNG do thay đổi này gây ra

Cột mã hồ sơ nay hiện rõ trên danh sách nên lộ ra hai khoảng trống dữ liệu có sẵn từ trước:

| Vấn đề | Số lượng | Suy được mã đúng? |
|---|---|---|
| Vụ án **không có mã** (`caseCode` rỗng) | **76 / 3.380** (2,2%) | **Có — 76/76** đều có `nam`+`stt` trong bản thô |
| Vụ việc mang **mã tạm** `VV-LEGACY-…` | **125 / 4.717** (2,6%) | **Chỉ 7/125.** 118 hồ sơ còn lại đến từ collection `TamDinhChi_vu_viec_21` của hệ cũ, vốn **không có** `nam`/`stt` — chúng chỉ có `tiep_nhan_so`, và các trường ngày còn **bị đảo tên** (`tiep_nhan_ngay: 2020`, `tiep_nhan_nam: 30`) |

Đã tra tận nguồn trên bản sao MongoDB hệ cũ để kết luận, không suy đoán. 76 vụ án và 7 vụ
việc sửa được bằng đúng công cụ đã dùng cho 1.333 đơn thư (`backfill-petition-code.ts`);
118 hồ sơ tạm đình chỉ thì **không đoán** vì dữ liệu gốc không có mã.
