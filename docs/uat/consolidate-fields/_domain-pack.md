# _domain-pack.md — Bước 0: Domain Research & Discovery

**Phạm vi:** epic HỢP NHẤT field cũ (di trú) ↔ field mới (native) — hệ quản lý Đơn thư / Vụ việc / Vụ án PC02.
**Nguồn chân lý:** PLAN (xem `_plan-scope.md`) + khung pháp lý/chuẩn dữ liệu bên dưới.
**Ràng buộc:** KHÔNG dùng codebase để suy ra hành vi mong đợi. Mọi oracle có neo **nguồn ngoài code**.

---

## Pha A — Authority Brief (nguồn chân lý ngoài code)

Domain = **hồ sơ tố tụng hình sự** ⇒ **regulated**. Mất/lệch một trường trong hồ sơ không phải lỗi UI — là rủi ro **pháp lý**. Research SÂU.

| ID | Nguồn chân lý | Rule kiểm chứng được | Áp vào |
|---|---|---|---|
| AUTH-01 | **BLTTHS 2015** — chế định hồ sơ vụ án, biên bản, tài liệu tố tụng | Thông tin đã ghi nhận trong hồ sơ **không được biến mất hoặc bị thay đổi ngầm** bởi thao tác kỹ thuật; mọi thay đổi phải truy nguyên được | PLAN-V2, PLAN-B3, PLAN-B6 |
| AUTH-02 | **TT 28/2020/TT-BCA** — trình tự tiếp nhận, giải quyết tố giác/tin báo/kiến nghị khởi tố | Vòng đời hồ sơ đi theo trình tự **tiếp nhận → xác minh → kết quả**; trường của giai đoạn sau không được đứng trước trường tiếp nhận trong biểu nhập | PLAN-C-A…G, PLAN-C-RULE |
| AUTH-03 | **Luật Căn cước 26/2023/QH15** | CCCD = **12 chữ số**; số CCCD đi kèm **ngày cấp** và **nơi cấp** như một cụm định danh | PLAN-A1-02, PLAN-C-B |
| AUTH-04 | **NĐ 13/2023/NĐ-CP** — bảo vệ dữ liệu cá nhân | Họ tên / ngày sinh / CCCD / SĐT / địa chỉ của người tố cáo là **dữ liệu cá nhân**: chỉ hiển thị cho người có phạm vi dữ liệu hợp lệ, không rò qua tìm kiếm/API ngoài phạm vi | SEC-* |
| AUTH-05 | **ISO/IEC 25012** — Data Quality Model (accuracy, completeness, consistency, traceability) | Hợp nhất 2 nguồn về 1 nơi phải giữ **completeness** (không rơi hàng) và **consistency** (một khái niệm một giá trị), có **traceability** về bản gốc | PLAN-V2, PLAN-V5 |
| AUTH-06 | **Nguyên tắc di trú không mất mát** (lossless migration; ISO 8000 data-quality) | Chỉ được ghi khi đích **rỗng**; xung đột phải **báo cáo**, không ghi đè; giá trị không phân tích được phải **từ chối có ghi nhận**, KHÔNG suy đoán | PLAN-B3 |
| AUTH-07 | **ISO 8601 + quy ước date-only** | Ngày không có thành phần giờ phải ổn định qua múi giờ (không off-by-one khi lưu/đọc); độ chính xác thấp (chỉ có năm) phải được **đánh dấu tường minh**, không giả vờ là ngày chính xác | PLAN-A1-03, PLAN-B1 |
| AUTH-08 | **ISO 9241-11 + Nielsen #4 (consistency), #6 (recognition), #8 (minimalist)** | Một khái niệm hiển thị **một lần**; ô trùng nghĩa buộc người dùng đoán "điền ô nào" = lỗi usability nghiêm trọng | PLAN-V5, UX-* |
| AUTH-09 | **WCAG 2.2 AA** | Nhãn ô liên kết đúng control; cụm field có tiêu đề nhóm; target ≥24px; focus không bị che | A11Y-* |

**Ghi chú trung thực:** AUTH-01…04 là văn bản pháp luật Việt Nam áp dụng cho nghiệp vụ này; UAT dùng chúng ở mức **nguyên tắc** (toàn vẹn hồ sơ, cụm định danh, bảo vệ dữ liệu cá nhân), KHÔNG trích điều khoản chi tiết để tránh viện dẫn sai.

---

## Pha B — Ground: Oracle table

| rule_id | oracle_type | Phát biểu (expected độc lập với code) | Nguồn |
|---|---|---|---|
| ONE-FIELD-ONE-BOX | Purpose | Mỗi khái niệm nghiệp vụ chỉ có **đúng 1 ô nhập** trên form; không tồn tại 2 ô cùng nghĩa | PLAN mục tiêu + AUTH-08 |
| COL-IS-CANONICAL | Claim | Giá trị người dùng nhập phải nằm ở **cột typed** (Case hoặc CaseStatistic) và đọc lại **từ cột** | PLAN D1 |
| TYPE-FOLLOWS-NATIVE | Claim | Cặp lệch kiểu → dữ liệu chuyển về **kiểu của field native** | PLAN D2 |
| NO-DATA-LOSS | Statute | Không hàng nào mất giá trị sau hợp nhất; đo bằng **row-coverage**, không phải value-count | AUTH-01, AUTH-05, PLAN-V2 |
| NO-SILENT-OVERWRITE | Statute | Đích đã có giá trị KHÁC nguồn → **không ghi đè**, ghi `migration_conflict` | AUTH-06, PLAN-B3 |
| NO-FABRICATION | Statute | Giá trị không parse được → cột NULL + ghi `migration_reject`; **CẤM bịa** giá trị | AUTH-06, PLAN-B3 |
| PRECISION-EXPLICIT | Claim | Ngày sinh chỉ biết năm → lưu `YYYY-01-01` + cột precision `'year'`; hiển thị/đọc lại KHÔNG được biến thành "sinh ngày 01/01" chắc chắn | AUTH-07, PLAN-A1-03 |
| DATE-NO-DRIFT | World | Ngày date-only lưu/đọc lại không lệch 1 ngày qua múi giờ VN (UTC+7) | AUTH-07, PLAN-B1 |
| SEMANTIC-SEPARATION | Purpose | Field khác nghĩa **không được gộp**: `biHai`≠địa chỉ; `nghiVanDoiTuong`≠Subjects; `dieuTraVien`(text)≠`handler`(FK); `toiDanhBanDau`≠`criminalSecondaryType`; `noiXayRa`≠`specificAddress` | PLAN-A1-05, A3-R2/R5/R6/R7 |
| SINGLE-STORE-SYNC | Claim | Damage/victim: tab Thông tin và tab Thống kê đọc/ghi **cùng một cột** — sửa ở đâu cũng phản ánh ở cả hai | PLAN-A3-R1 |
| TRACE-PRESERVED | Statute | Bản gốc hệ cũ (metadata + LegacyRawPanel + `sttCu`/`soHoSoCu`) vẫn xem được sau hợp nhất | AUTH-01, PLAN-B6, PLAN-V5 |
| INTAKE-ON-CREATE | Claim | **Tạo mới** (không chỉ sửa) cũng phải ghi được các field intake vào cột | PLAN-B2 |
| WHITELIST-PASS | Claim | Field mới gửi lên không bị lớp validate **strip âm thầm** | PLAN-V4 |
| ORDER-FOLLOWS-PROCESS | Purpose | Thứ tự nhập theo dòng tố tụng A→G; required đầu section; CCCD số/ngày/nơi liền kề | AUTH-02, AUTH-03, PLAN-C |
| PHASE-AUTOEXPAND | Claim | Mở vụ việc đã có trạng thái → section giai đoạn tương ứng **tự mở** theo trạng thái của bản ghi | PLAN-A4-03 |
| SCOPE-ENFORCED | Statute | Dữ liệu cá nhân + hồ sơ chỉ trả về trong phạm vi dữ liệu của người dùng | AUTH-04 |

**GAP đã khai báo (không giả vờ pass):**
- `GAP-01` — Plan không quy định định dạng chuẩn hóa SĐT/CCCD khi gộp (vd có khoảng trắng, dấu chấm). UAT ghi nhận hành vi, không kết luận pass/fail về chuẩn hoá.
- `GAP-02` — Plan không nêu ngưỡng hiệu năng cho tìm kiếm theo cột mới. TC PERFORMANCE dùng oracle so sánh tương đối (không chậm hơn đáng kể tìm kiếm hiện có), không có ngưỡng tuyệt đối.
- `GAP-03` — Plan không định nghĩa tập giá trị hợp lệ của `caseClassification` / `tinhTrang` (String tự do hay enum). TC ghi `GAP` cho phần ràng buộc giá trị.

---

## Personas (End User thật)

| id | Vai | Điều họ cần đạt | Rủi ro nếu epic sai |
|---|---|---|---|
| `can-bo-tiep-nhan` | Cán bộ tiếp nhận đơn thư / tin báo | Nhập nhanh, đúng, **một lần** thông tin người tố cáo | Điền 2 ô → dữ liệu lệch giữa 2 nơi |
| `dieu-tra-vien` | Điều tra viên xử lý vụ việc/vụ án | Xem đủ thông tin hồ sơ cũ + nhập kết quả xác minh | Mất field di trú → thiếu căn cứ |
| `lanh-dao-doi` | Lãnh đạo duyệt/theo dõi | Đọc tóm tắt, thiệt hại, số bị hại chính xác | Số liệu 2 tab lệch → báo cáo sai |
| `can-bo-thong-ke` | Cán bộ tổng hợp/thống kê | Số liệu thiệt hại/bị hại nhất quán để tổng hợp | 3 nguồn số liệu → thống kê sai |
| `quan-tri` | Quản trị hệ thống / người chạy di trú | Backfill an toàn, soát conflict/reject | Ghi đè ngầm → mất dữ liệu pháp lý |

## Journeys

| journey_ref | Tên | Persona chính |
|---|---|---|
| J-VA-01 | Tạo mới Vụ án — nhập 1 ô/khái niệm, lưu, đọc lại từ cột | can-bo-tiep-nhan |
| J-VA-02 | Sửa Vụ án đã di trú — thấy dữ liệu cũ ở ô chính, sửa, lưu | dieu-tra-vien |
| J-VA-03 | Nhập/soát thiệt hại & số bị hại (2 tab đồng bộ) | can-bo-thong-ke |
| J-VA-04 | Xem lại dữ liệu gốc hệ cũ (LegacyRawPanel + sttCu/soHoSoCu) | dieu-tra-vien |
| J-DT-01 | Tiếp nhận & lưu Đơn thư (field parity) | can-bo-tiep-nhan |
| J-VV-01 | Mở/sửa Vụ việc — section giai đoạn tự mở đúng trạng thái | dieu-tra-vien |
| J-TIM-01 | Tìm kiếm hồ sơ theo giá trị đã hợp nhất (tên, CCCD, số cũ, nơi xảy ra) | dieu-tra-vien |
| J-ADM-01 | Di trú/backfill + đối soát row-coverage, conflict, reject | quan-tri |
| J-E2E-01 | Xuyên suốt: Đơn thư → Vụ việc → Vụ án → Thống kê → Truy nguyên | can-bo-tiep-nhan → dieu-tra-vien → lanh-dao-doi |

## Persona × Journey × Platform matrix

| Journey | web | api | ghi chú |
|---|---|---|---|
| J-VA-01 | ✅ E2E | ✅ | |
| J-VA-02 | ✅ E2E | ✅ | |
| J-VA-03 | ✅ E2E | ✅ | |
| J-VA-04 | ✅ | — | thuần đọc UI |
| J-DT-01 | ✅ E2E | ✅ | |
| J-VV-01 | ✅ E2E | — | bug auto-expand là UI-only |
| J-TIM-01 | ✅ | ✅ | |
| J-ADM-01 | — | ✅ (đối soát dữ liệu) | không có UI riêng |
| J-E2E-01 | ✅ E2E | ✅ | journey tích hợp toàn hệ thống |

**Mobile:** N/A — epic này chỉ chạm web app (NestJS API + React SPA). 12 loại TC mobile-only = **N/A có lý do**: không có artifact mobile trong phạm vi plan.

## Mock allowlist (D6)
- **Không mock module nội bộ.** DB thật, API thật, Prisma thật.
- Cho phép mock **duy nhất**: dịch vụ gửi email/push bên ngoài (nếu luồng chạm tới) — lý do: tránh gửi thật ra ngoài; không ảnh hưởng oracle của epic này.
- Đồng hồ: không freeze trừ TC ngày-tháng cần xác định (khai `clock_freeze` trong TC).
