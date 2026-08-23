# _coverage-ledger.md — Sổ phủ + Hiệu lực (Bước 4·5·6)

**Feature:** consolidate-fields (epic HỢP NHẤT field cũ ↔ native)
**Oracle nguồn:** `_plan-scope.md` (PLAN) + `_domain-pack.md` (AUTH-*). **KHÔNG đọc code.**

---

## 1. Risk Assessment (Bước 4) — pre-populate từ Failure modes của plan

| RID | Rủi ro (từ plan/domain) | Likelihood | Impact | Tier | Phủ bởi |
|---|---|---|---|---|---|
| R-01 | Backfill **ghi đè** giá trị đã có → mất dữ liệu pháp lý | Trung bình | Thảm khốc | **CRITICAL** | COV-BF-* |
| R-02 | Giá trị không parse được bị **bịa** (vd "không rõ" → 1970-01-01) | Trung bình | Thảm khốc | **CRITICAL** | COV-BF-*, COV-DOB-* |
| R-03 | CREATE không map cột intake (plan gọi P1 blocker) → vụ mới mất field | Cao | Nặng | **CRITICAL** | COV-CR-* |
| R-04 | `legacyMetadata` re-merge tái ghi metadata cũ → 2 nguồn lệch nhau | Cao | Nặng | **CRITICAL** | COV-UP-*, COV-DUP-* |
| R-05 | Gộp sai ngữ nghĩa (`biHai`→địa chỉ, `dieuTraVien`→`handler`) → corruption/mất tên ĐTV | Thấp | Thảm khốc | **CRITICAL** | COV-SEM-* |
| R-06 | Damage/victim 3 nguồn không đồng bộ → thống kê/báo cáo sai | Cao | Nặng | **CRITICAL** | COV-ST-* |
| R-07 | Ngày date-only lệch 1 ngày (múi giờ) | Trung bình | Trung bình | HIGH | COV-DATE-* |
| R-08 | DOB year-only mất cờ precision → hồ sơ khẳng định sai ngày sinh | Trung bình | Nặng | **CRITICAL** | COV-DOB-* |
| R-09 | DTO whitelist strip field mới → lưu im lặng thất bại | Trung bình | Nặng | HIGH | COV-API-* |
| R-10 | Form vẫn còn 2 ô trùng nghĩa ở đâu đó → người nhập điền sai chỗ | Trung bình | Trung bình | HIGH | COV-UI-* |
| R-11 | Bố cục cluster sai trình tự tố tụng → nhập sai luồng | Thấp | Trung bình | STANDARD | COV-ORD-* |
| R-12 | Tìm kiếm chỉ query cột → sót vụ chưa backfill | Trung bình | Nặng | HIGH | COV-SRCH-* |
| R-13 | Bug auto-expand vụ việc (dùng biến rỗng) chưa hết | Trung bình | Trung bình | HIGH | COV-INC-* |
| R-14 | Rò dữ liệu cá nhân qua field/tìm kiếm mới, ngoài phạm vi dữ liệu | Thấp | Thảm khốc | **CRITICAL** | COV-SEC-* |
| R-15 | Mất khả năng truy nguyên bản gốc hệ cũ | Thấp | Nặng | HIGH | COV-TRC-* |

**Risk tier tổng của epic = CRITICAL** (toàn vẹn hồ sơ tố tụng đã deploy prod).

---

## 2. TC_min — ENSEMBLE (Bước 6)

| Mã | Phương pháp | Giá trị | Ghi chú |
|---|---|---|---|
| **M1** | Spec coverage items | **180** | Σ(AC-class×2)=104 + EP 24 + BVA 20 + decision rules 16 + state transitions 8 + pairwise 8 |
| **M2** | Cyclomatic ΣV(G) | **N/A** | Người dùng CẤM đọc source → không đo được. Ghi nhận là hạn chế đã khai báo, không im lặng bỏ. |
| **M3** | Functional size FP^1.2 | **N/A** | Không ước được FP tin cậy cho một epic refactor-dữ-liệu (không thêm giao dịch nghiệp vụ mới). |
| **M4** | Risk-tier backstop | **120** | Tier CRITICAL |
| | **TC_min = MAX** | **180** | |

**Cách đếm AC-class (minh bạch chống lười):** 52 AC-class × 2 = 104.
A1 = 8 · A2-C = 5 (4 lớp kiểu dữ liệu: text / date / boolean / mã-số + 1 AC *enumeration-completeness* buộc liệt kê đủ 22 field) · A2-R = 2 · A2-N = 6 · A3 = 7 · A4 = 4 · B = 6 · C = 7 · V = 7.
> Gom 22 field (C) thành 5 AC-class là **quyết định công khai**, không phải bỏ sót: AC `COV-PROMO-ALL` bắt buộc TC liệt kê **đủ 22 tên field**, fail nếu thiếu bất kỳ tên nào.

**Tổng TC kế hoạch = 195 ≥ TC_min 180.** ✅

---

## 3. Coverage Ledger — enumerate từng item

> Cột `TC` điền sau khi sinh; item không phủ phải ghi `GAP + lý do`.

### F1 — Tạo mới Vụ án (canonical trên CREATE) · rule PLAN-B2, PLAN-A1-*, PLAN-V3
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-CR-01 | CREATE lưu `tenCungCap` vào cột (không chỉ metadata) | AC+ | PLAN-A1-01 | TC-001 |
| COV-CR-02 | CREATE lưu `cccdCungCap` vào cột | AC+ | PLAN-A1-02 | TC-002 |
| COV-CR-03 | CREATE lưu `sdtCungCap` vào cột | AC+ | PLAN-A1-04 | TC-003 |
| COV-CR-04 | CREATE lưu `diaChiCungCap` vào cột | AC+ | PLAN-A1-05 | TC-004 |
| COV-CR-05 | CREATE lưu `moTaChiTiet` vào cột | AC+ | PLAN-A1-06 | TC-005 |
| COV-CR-06 | CREATE lưu `receiveDate` (cột N mới) | AC+ | PLAN-A2-N | TC-006 |
| COV-CR-07 | CREATE lưu `caseClassification` (cột N mới) | AC+ | PLAN-A2-N | TC-007 |
| COV-CR-08 | CREATE lưu `tinhTrang` (cột N mới) | AC+ | PLAN-A2-N | TC-008 |
| COV-CR-09 | CREATE lưu `toiDanhBanDau` (cột N mới) | AC+ | PLAN-A2-N/A3-R6 | TC-009 |
| COV-CR-10 | CREATE lưu `reporterDateOfBirth` + precision | AC+ | PLAN-A1-03 | TC-010 |
| COV-CR-11 | CREATE lưu `payload.statistic.soTienBiThietHai` (tạo row nếu chưa có) | AC+ | PLAN-A1-07 | TC-011 |
| COV-CR-12 | CREATE lưu `payload.statistic.soLuongBiHai` | AC+ | PLAN-A1-08 | TC-012 |
| COV-CR-13 | CREATE **không** để trống cột khi form có giá trị (regression P1 blocker) | AC− | PLAN-B2 | TC-013 |
| COV-CR-14 | CREATE với toàn bộ intake rỗng → không tạo rác, không lỗi 500 | AC− | PLAN-B2 | TC-014 |
| COV-CR-15 | CREATE gửi field không khai trong DTO → bị từ chối/strip có kiểm soát, không lỗi im lặng | AC− | PLAN-V4 | TC-015 |
| COV-CR-16 | CREATE idempotent với dual-write (lưu 2 lần cùng payload → không nhân đôi statistic row) | AC− | PLAN-B2 | TC-016 |
| COV-CR-17 | Reload sau CREATE hiển thị **từ cột** đúng mọi giá trị vừa nhập | AC+ | PLAN-V3 | TC-017 |
| COV-CR-18 | E2E web: tạo vụ án mới qua giao diện, 1 ô/khái niệm, lưu thành công | E2E | PLAN-V3/V5 | TC-018 |

### F2 — Sửa Vụ án (đọc/ghi canonical, fallback metadata) · rule PLAN-B4, PLAN-V3
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-UP-01 | Vụ ĐÃ backfill: form hiển thị giá trị lấy **từ cột** | AC+ | PLAN-B4 | TC-019 |
| COV-UP-02 | Vụ CHƯA backfill (cột NULL, metadata có): form **fallback metadata**, không hiện trống | AC+ | PLAN-B4 | TC-020 |
| COV-UP-03 | Cột và metadata KHÁC nhau → **cột thắng** khi hiển thị | DECISION | PLAN-B4 | TC-021 |
| COV-UP-04 | Sửa giá trị → cột đổi | AC+ | PLAN-V3 | TC-022 |
| COV-UP-05 | Sửa giá trị → **không** phát sinh key metadata promoted MỚI (EXPECTED-DEFERRED: dual-write còn bật) | AC− | PLAN-B4-b/B6 | TC-023 |
| COV-UP-06 | Xóa trắng 1 ô đã có giá trị → cột về NULL/rỗng, không bị metadata cũ "hồi sinh" giá trị | AC− | PLAN-B4 | TC-024 |
| COV-UP-07 | Lưu lại **không đổi gì** → giá trị không tự biến đổi (no-op an toàn) | AC− | PLAN-B4 | TC-025 |
| COV-UP-08 | Sửa → reload → sửa lần 2: giá trị không "quay ngược" về bản cũ (re-merge legacyMetadata) | AC− | PLAN-B4 | TC-026 |
| COV-UP-09 | Field đã lên form chính KHÔNG còn xuất hiện trong panel parity/legacy dynamic (2 nguồn ghi 1 cột) | AC− | PLAN-B4 | TC-027 |
| COV-UP-10 | Sửa đồng thời 2 phiên trên cùng vụ → không mất giá trị âm thầm | EDGE | PLAN-B4 | TC-028 |
| COV-UP-11 | Vụ có metadata rỗng chuỗi `""` → hiển thị trống, không hiện `""` như giá trị | EP | PLAN-B3 | TC-029 |
| COV-UP-12 | E2E web: mở vụ đã di trú → sửa 1 field → lưu → reload đúng | E2E | PLAN-V3 | TC-030 |

### F3 — Thiệt hại & Số bị hại (3 nơi → 1 cột CaseStatistic) · rule PLAN-A1-07/08, PLAN-A3-R1
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-ST-01 | Nhập thiệt hại ở tab Thông tin → tab Thống kê hiện đúng số | AC+ | PLAN-A3-R1 | TC-031 |
| COV-ST-02 | Nhập thiệt hại ở tab Thống kê → tab Thông tin hiện đúng số | AC+ | PLAN-A3-R1 | TC-032 |
| COV-ST-03 | Số bị hại: 2 tab đồng bộ 2 chiều | AC+ | PLAN-A1-08 | TC-033 |
| COV-ST-04 | Vụ chưa có row thống kê → nhập thiệt hại tạo row mới, không lỗi | AC+ | PLAN-A1-07 | TC-034 |
| COV-ST-05 | Vụ đã có row thống kê → cập nhật, KHÔNG tạo row thứ 2 | AC− | PLAN-A1-07 | TC-035 |
| COV-ST-06 | Vụ cũ có `metadata.damageAmount` → hiển thị đúng ở cả 2 tab (fallback) | AC+ | PLAN-B3 | TC-036 |
| COV-ST-07 | Vụ cũ có `metadata.stat_damageAmount` khác `metadata.damageAmount` → không hiện 2 số mâu thuẫn | DECISION | PLAN-A3-R1 | TC-037 |
| COV-ST-08 | BVA thiệt hại = 0 | BVA | PLAN-A1-07 | TC-038 |
| COV-ST-09 | BVA thiệt hại âm → từ chối, không lưu | BVA− | PLAN-A1-07 | TC-039 |
| COV-ST-10 | BVA thiệt hại rất lớn (≥ 1e12 VND) → lưu đúng, không tràn/không làm tròn sai | BVA | PLAN-A1-07 | TC-040 |
| COV-ST-11 | Thiệt hại nhập có phân cách/ký tự tiền tệ ("1.500.000 đ") → lưu số đúng hoặc từ chối rõ ràng, KHÔNG lưu sai thầm lặng | EP− | PLAN-B3 | TC-041 |
| COV-ST-12 | Thiệt hại nhập chữ ("không rõ") → từ chối, KHÔNG bịa 0 | EP− | PLAN-B3/NO-FABRICATION | TC-042 |
| COV-ST-13 | BVA số bị hại = 0 | BVA | PLAN-A1-08 | TC-043 |
| COV-ST-14 | BVA số bị hại = 1 | BVA | PLAN-A1-08 | TC-044 |
| COV-ST-15 | Số bị hại âm / thập phân → từ chối | BVA− | PLAN-A1-08 | TC-045 |
| COV-ST-16 | Xóa trắng thiệt hại → về rỗng ở CẢ 2 tab (không còn số cũ ở tab kia) | AC− | PLAN-A3-R1 | TC-046 |
| COV-ST-17 | Tổng hợp/thống kê hệ thống đọc cùng nguồn với form (không lệch) | AC+ | PLAN-A3-R1 | TC-047 |
| COV-ST-18 | E2E web: nhập thiệt hại + bị hại → xem tab Thống kê → số khớp | E2E | PLAN-A3-R1 | TC-048 |

### F4 — Ngày sinh, precision & quy ước ngày · rule PLAN-A1-03, PLAN-B1
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-DOB-01 | Nhập ngày sinh đầy đủ → lưu đúng ngày, precision KHÔNG phải 'year' | AC+ | PLAN-A1-03 | TC-049 |
| COV-DOB-02 | Dữ liệu cũ chỉ có năm ("1985") → lưu `1985-01-01` + precision `'year'` | AC+ | PLAN-A1-03 | TC-050 |
| COV-DOB-03 | Precision `'year'` → giao diện KHÔNG khẳng định "01/01" là ngày sinh thật | AC+ | PRECISION-EXPLICIT | TC-051 |
| COV-DOB-04 | Cờ precision nằm ở **cột**, không phải metadata | AC+ | PLAN-A1-03 | TC-052 |
| COV-DOB-05 | Round-trip: mở vụ year-only → lưu lại không đổi gì → vẫn year-only (không "thăng" thành ngày chính xác) | AC− | PLAN-A1-03 | TC-053 |
| COV-DOB-06 | Sửa từ year-only sang ngày đầy đủ → precision chuyển sang chính xác | STATE | PLAN-A1-03 | TC-054 |
| COV-DOB-07 | BVA ngày không tồn tại (31/02) → từ chối, KHÔNG tự nắn ngày | BVA− | NO-FABRICATION | TC-055 |
| COV-DOB-08 | BVA giá trị epoch/1970-01-01 từ dữ liệu rác → reject, không nhận là ngày sinh | BVA− | PLAN-B3 | TC-056 |
| COV-DOB-09 | BVA ngày sinh tương lai → từ chối hoặc cảnh báo rõ | BVA− | PLAN-A1-03 | TC-057 |
| COV-DOB-10 | Date-only không lệch 1 ngày khi lưu/đọc (múi giờ VN) | AC+ | DATE-NO-DRIFT | TC-058 |
| COV-DOB-11 | Các cột ngày khác (`receiveDate`, `ngayCapCccd`, `ngayPhieuChuyen`) cũng không lệch ngày | AC+ | PLAN-B1 | TC-059 |
| COV-DOB-12 | Giá trị năm phi lý ("19855", "0000") → reject có ghi nhận | EP− | PLAN-B3 | TC-060 |

### F5 — Thăng field di trú thành field chính thức · rule PLAN-A2-C/R/N
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-PROMO-ALL | **Enumeration-completeness**: đủ 22 field (C) có ô trên form và lưu vào cột — thiếu 1 tên = FAIL | AC+ | PLAN-A2-C | TC-061 |
| COV-PROMO-TXT | Lớp text: `nguonDon`, `soPhieuChuyen`, `noiCapCccd`, `ghiChuTrungDon`, `lanhDaoToTung`, `nhanXet`, `yeuCauBoSung`, `ketQuaXuLyKhac`, `doVatTaiLieuKemTheo`, `phanLoaiHoSoNoiBo`, `noiXayRa`, `phuongThucThuDoan`, `phanLoaiToiPhamLinhVuc`, `nghiVanDoiTuong` | AC+ | PLAN-A2-C | TC-062…TC-065 |
| COV-PROMO-DATE | Lớp ngày: `ngayPhieuChuyen`, `ngayGiaoDonViGiaiQuyet`, `ngayDeXuat`, `ngayVietDon`, `ngayCapCccd` | AC+ | PLAN-A2-C | TC-066…TC-068 |
| COV-PROMO-BOOL | Lớp boolean: `baoCaoBanGiamDoc` (true/false/để trống) | DECISION | PLAN-A2-C | TC-069…TC-071 |
| COV-PROMO-ID | Lớp mã số: `sttCu`, `soHoSoCu` (hiển thị + lưu + tìm được) | AC+ | PLAN-A2-C | TC-072…TC-073 |
| COV-PROMO-NEG | Negative lớp text: quá dài / ký tự đặc biệt / chỉ khoảng trắng | EP− | PLAN-A2-C | TC-074…TC-076 |
| COV-PROMO-R1 | `deXuatXuLy` → chỉ còn **một** ô, lưu vào cột `deXuat`; không còn ô trùng | AC+ | PLAN-A2-R | TC-077 |
| COV-PROMO-R1N | Dữ liệu cũ ở `deXuat` không bị mất khi form dùng tên mới | AC− | PLAN-A2-R | TC-078 |
| COV-PROMO-R2 | `dieuTraVienText` → cột `dieuTraVien`, hiển thị nhãn "ĐTV (hệ cũ)" | AC+ | PLAN-A2-R/A3-R7 | TC-079 |
| COV-PROMO-N | 6 cột mới (N) tồn tại & nhận giá trị: `receiveDate`, `caseClassification`, `tinhTrang`, `toiDanhBanDau`, `reporterDateOfBirth`, `reporterDateOfBirthPrecision` | AC+ | PLAN-A2-N | TC-080 |
| COV-PROMO-NNEG | Cột N nhận giá trị ngoài miền hợp lệ → phản ứng có kiểm soát | EP− | PLAN-A2-N | TC-081 |
| COV-PROMO-GAP | `caseClassification`/`tinhTrang` chưa có tập giá trị hợp lệ trong plan | **GAP-03** | — | TC-082 (ghi nhận, không phán xét) |

### F13 — Hợp đồng API & DTO whitelist · rule PLAN-V4
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-API-01 | POST tạo vụ với field loại **C** → đọc lại có giá trị (không bị strip) | AC+ | PLAN-V4 | TC-083 |
| COV-API-02 | POST/PATCH với field loại **S** (statistic) → đọc lại có giá trị | AC+ | PLAN-V4 | TC-084 |
| COV-API-03 | POST/PATCH với field loại **N** → đọc lại có giá trị | AC+ | PLAN-V4 | TC-085 |
| COV-API-04 | POST/PATCH với field loại **R** (tên đã reconcile) → đọc lại có giá trị | AC+ | PLAN-V4 | TC-086 |
| COV-API-05 | Gửi tên form-key **cũ đã bỏ** (`deXuatXuLy`) → không lưu nhầm/không 500 | AC− | PLAN-A2-R | TC-087 |
| COV-API-06 | Sai kiểu (chuỗi cho cột Date/số) → 400 có thông điệp, KHÔNG 500, KHÔNG lưu méo | EP− | PLAN-V4 | TC-088 |
| COV-API-07 | PATCH chỉ 1 field → các cột khác **không bị xóa** | AC− | PLAN-B4 | TC-089 |
| COV-API-08 | Response GET chi tiết trả đủ cột canonical + `statistic.*` cho FE dùng | AC+ | PLAN-B4 | TC-090 |

### F6 — Ngữ nghĩa KHÔNG được gộp · rule PLAN-A1-05, PLAN-A3-R2…R7
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-SEM-01 | `biHai` giữ ô riêng, KHÔNG nối vào địa chỉ | AC+ | PLAN-A1-05 | TC-091 |
| COV-SEM-02 | Nhập cả `biHai` và `diaChiCungCap` → 2 giá trị độc lập, không lẫn | AC− | PLAN-A1-05 | TC-092 |
| COV-SEM-03 | `noiXayRa` giữ riêng, không bị `specificAddress`/địa chỉ hành chính ghi đè | AC+ | PLAN-A3-R2 | TC-093 |
| COV-SEM-04 | `specificAddress` cũ (metadata) hiển thị gộp về ô `noiXayRa`, không mất | AC+ | PLAN-A3-R2 | TC-094 |
| COV-SEM-05 | `phuongThucThuDoan` tồn tại như ô riêng | AC+ | PLAN-A3-R3 | TC-095 |
| COV-SEM-06 | `phanLoaiToiPhamLinhVuc` và `stat_crimeField` đọc **cùng** giá trị | AC+ | PLAN-A3-R4 | TC-096 |
| COV-SEM-07 | `nghiVanDoiTuong` (text) và danh sách Subjects cùng tồn tại, không nuốt nhau | AC+ | PLAN-A3-R5 | TC-097 |
| COV-SEM-08 | Thêm Subject có cấu trúc → `nghiVanDoiTuong` không bị xóa | AC− | PLAN-A3-R5 | TC-098 |
| COV-SEM-09 | `toiDanhBanDau` và `criminalSecondaryType` là 2 ô khác nhau | AC+ | PLAN-A3-R6 | TC-099 |
| COV-SEM-10 | Đặt `toiDanhBanDau` → tội danh phụ không đổi | AC− | PLAN-A3-R6 | TC-100 |
| COV-SEM-11 | `dieuTraVien`(text) và `handler`(FK) cùng tồn tại | AC+ | PLAN-A3-R7 | TC-101 |
| COV-SEM-12 | Vụ có `dieuTraVien` = tên KHÔNG khớp user nào → tên vẫn hiển thị, KHÔNG mất | AC− | PLAN-A3-R7 | TC-102 |
| COV-SEM-13 | Gán `handler` → `dieuTraVien` text không bị ghi đè | AC− | PLAN-A3-R7 | TC-103 |
| COV-SEM-14 | Pairwise: (biHai có/không) × (địa chỉ có/không) × (noiXayRa có/không) | PAIRWISE | PLAN-A1-05/A3-R2 | TC-104 |
| COV-SEM-15 | Pairwise: (dieuTraVien có/không) × (handler có/không) × (Subjects có/không) | PAIRWISE | PLAN-A3-R5/R7 | TC-105 |

### F7 — Backfill & toàn vẹn dữ liệu · rule PLAN-B3, PLAN-V2
**Decision table backfill** (4 điều kiện → rule khả thi):
| Rule | cột NULL? | meta native? | meta old? | parse được? | Kết quả kỳ vọng | cov_id | TC |
|---|---|---|---|---|---|---|---|
| DR-1 | Có | Có | – | Có | ghi cột = meta native | COV-BF-01 | TC-106 |
| DR-2 | Có | Không | Có | Có | ghi cột = meta old | COV-BF-02 | TC-107 |
| DR-3 | Có | Có | Có (khác) | Có | **ưu tiên native** | COV-BF-03 | TC-108 |
| DR-4 | Có | Có/Có | – | Không | cột NULL + ghi `migration_reject` | COV-BF-04 | TC-109 |
| DR-5 | Không (đã có, GIỐNG meta) | Có | – | Có | giữ nguyên, không conflict | COV-BF-05 | TC-110 |
| DR-6 | Không (đã có, KHÁC meta) | Có | – | Có | **KHÔNG đè** + ghi `migration_conflict` | COV-BF-06 | TC-111 |
| DR-7 | Có | Không | Không | – | không làm gì (cột vẫn NULL) | COV-BF-07 | TC-112 |
| DR-8 | Có | chuỗi rỗng/khoảng trắng | – | – | coi như không có → không ghi | COV-BF-08 | TC-113 |

| cov_id | Coverage item bổ sung | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-BF-09 | Chạy backfill **lần 2** → idempotent, số liệu không đổi | AC− | PLAN-B3/V7 | TC-114 |
| COV-BF-10 | Row-coverage mỗi cột: `#rows sau ≥ #rows nguồn − conflict − reject` | AC+ | PLAN-V2 | TC-115 |
| COV-BF-11 | Bảng `migration_conflict` đọc được & mỗi dòng có (case_id, field, col_value, meta_value) | AC+ | PLAN-B3 | TC-116 |
| COV-BF-12 | Bảng `migration_reject` đọc được & giải thích được lý do reject | AC+ | PLAN-B3 | TC-117 |
| COV-BF-13 | Xác minh claim CL-2 của plan ("1866 vụ, 0 conflict, 20 reject") khớp thực tế | AC+ | CL-2 | TC-118 |
| COV-BF-14 | Backfill damage/victim upsert `case_statistics`: vụ chưa có row → tạo; đã có → cập nhật, không nhân đôi | DECISION | PLAN-B3 | TC-119 |
| COV-BF-15 | Sau backfill, metadata gốc **vẫn còn** trong DB (không bị xóa) | AC+ | PLAN-B6/V2 | TC-120 |
| COV-BF-16 | Có bản backup trước khi backfill (pg_dump) | AC+ | PLAN-B3/V7 | TC-121 |
| COV-BF-17 | 20 bản ghi reject: mỗi bản vẫn giữ giá trị gốc ở metadata để người dùng xử lý tay | AC+ | NO-FABRICATION | TC-122 |

### F8 — Truy nguyên & giữ bản gốc · rule PLAN-B6, PLAN-V5, TRACE-PRESERVED
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-TRC-01 | Panel dữ liệu gốc hệ cũ hiển thị đầy đủ bản gốc | AC+ | PLAN-V5 | TC-123 |
| COV-TRC-02 | `sttCu`/`soHoSoCu` hiển thị trên chi tiết hồ sơ | AC+ | PLAN-A2-C | TC-124 |
| COV-TRC-03 | Sau khi thăng field, panel gốc **không** bị rỗng đi | AC− | PLAN-B6 | TC-125 |
| COV-TRC-04 | Field long-tail (không thăng) vẫn xem/sửa được ở panel động | AC+ | PLAN-B6 | TC-126 |
| COV-TRC-05 | Field đã thăng KHÔNG hiện trùng ở panel động (tránh 2 ô) | AC− | PLAN-B4 | TC-127 |
| COV-TRC-06 | Giá trị ngày trong panel gốc hiển thị dạng người đọc được (không phải số epoch) | AC+ | AUTH-07 | TC-128 |
| COV-TRC-07 | Sửa field ở form chính → panel gốc vẫn giữ giá trị **ban đầu** (bản gốc bất biến) | AC− | TRACE-PRESERVED | TC-129 |
| COV-TRC-08 | E2E: mở vụ đã di trú → đọc bản gốc → đối chiếu ô chính | E2E | PLAN-V5 | TC-130 |

### F9 — Bố cục form theo cluster A–G + UX + A11Y · rule PLAN-C, PLAN-V5, PLAN-V6
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-ORD-A | Cluster A (Định danh & tiếp nhận) có đủ nhóm field & đứng đầu | UX | PLAN-C-A | TC-131 |
| COV-ORD-B | Cluster B (Chủ thể) gom mọi field người vào **1 chỗ** | UX | PLAN-C-B | TC-132 |
| COV-ORD-B2 | CCCD: số + ngày cấp + nơi cấp **liền kề** | UX | PLAN-C-B/AUTH-03 | TC-133 |
| COV-ORD-C | Cluster C (Sự việc & địa điểm) | UX | PLAN-C-C | TC-134 |
| COV-ORD-D | Cluster D: tội danh chính + ban đầu + phụ **liền nhau** | UX | PLAN-C-D | TC-135 |
| COV-ORD-E | Cluster E (Phân công) gom trong 1 section | UX | PLAN-C-E | TC-136 |
| COV-ORD-F | Cluster F (Kết quả & giai đoạn sau) đứng SAU tiếp nhận | UX | PLAN-C-F/AUTH-02 | TC-137 |
| COV-ORD-G | Cluster G (Thống kê + di trú) ở cuối | UX | PLAN-C-G | TC-138 |
| COV-UI-01 | **Không còn cặp ô trùng nghĩa nào** trên form Vụ án (quét đủ 8 cặp A1) | UX | ONE-FIELD-ONE-BOX | TC-139 |
| COV-UI-02 | Mỗi ô có nhãn **native** đúng như plan quy định | UX | PLAN-A1 | TC-140 |
| COV-UI-03 | Field bắt buộc nằm đầu section | UX | PLAN-C-RULE | TC-141 |
| COV-UI-04 | Nielsen #1 visibility: lưu thành công/thất bại có phản hồi rõ | UX | AUTH-08 | TC-142 |
| COV-UI-05 | Nielsen #9: lỗi validate chỉ đúng ô sai, thông điệp tiếng Việt hiểu được | UX | AUTH-08 | TC-143 |
| COV-A11Y-01 | Mọi ô mới có nhãn liên kết đúng (đọc được bằng trình đọc màn hình) | A11Y | AUTH-09 | TC-144 |
| COV-A11Y-02 | Nhóm cluster có tiêu đề nhóm; điều hướng bàn phím theo đúng thứ tự A→G | A11Y | AUTH-09 | TC-145 |
| COV-A11Y-03 | Quét axe trên form Vụ án: 0 vi phạm mức A/AA nghiêm trọng (ghi rõ giới hạn ~57% tự động) | A11Y | AUTH-09 | TC-146 |

### F10 — Tìm kiếm theo giá trị đã hợp nhất · rule PLAN-B4
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-SRCH-01 | Tìm theo tên người tố cáo (`tenCungCap`) ra đúng vụ | AC+ | PLAN-B4 | TC-147 |
| COV-SRCH-02 | Tìm theo CCCD | AC+ | PLAN-B4 | TC-148 |
| COV-SRCH-03 | Tìm theo `sttCu`/`soHoSoCu` | AC+ | PLAN-A2-C | TC-149 |
| COV-SRCH-04 | Tìm theo `noiXayRa` | AC+ | PLAN-B4 | TC-150 |
| COV-SRCH-05 | Vụ **chưa backfill** (chỉ có metadata) vẫn tìm thấy (fallback) | AC− | PLAN-B4 | TC-151 |
| COV-SRCH-06 | Từ khóa không tồn tại → 0 kết quả, không lỗi | EP− | PLAN-B4 | TC-152 |
| COV-SRCH-07 | Ký tự đặc biệt/dấu tiếng Việt trong từ khóa → không lỗi, không SQL injection | SECURITY | AUTH-04 | TC-153 |
| COV-SRCH-08 | Hiệu năng tìm kiếm theo cột mới không xấu đi rõ rệt (**GAP-02**: không có ngưỡng tuyệt đối trong plan) | PERFORMANCE | GAP-02 | TC-154 |

### F14 — Bảo mật & phạm vi dữ liệu · rule AUTH-04, SCOPE-ENFORCED
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-SEC-01 | Người dùng ngoài phạm vi không đọc được vụ qua API chi tiết (IDOR) | SECURITY | AUTH-04 | TC-155 |
| COV-SEC-02 | Tìm kiếm không trả vụ ngoài phạm vi dữ liệu | SECURITY | AUTH-04 | TC-156 |
| COV-SEC-03 | Field cá nhân mới (DOB) không lộ cho vai trò không được phép | SECURITY | AUTH-04 | TC-157 |
| COV-SEC-04 | Không token / token hết hạn → 401, không rò dữ liệu | SECURITY | AUTH-04 | TC-158 |
| COV-SEC-05 | Vai trò chỉ-đọc không sửa được cột canonical | SECURITY | AUTH-04 | TC-159 |
| COV-SEC-06 | Payload injection (SQL/XSS) vào ô text mới → không thực thi, lưu an toàn | SECURITY | OWASP | TC-160 |
| COV-SEC-07 | Bảng conflict/reject (chứa dữ liệu cá nhân) không lộ qua API công khai | SECURITY | AUTH-04 | TC-161 |
| COV-SEC-08 | Ghi nhật ký thay đổi vẫn hoạt động sau khi đổi nơi lưu (truy vết pháp lý) | AUDIT | AUTH-01 | TC-162 |

### F11 — Đơn thư (Petition) · rule PLAN-A4-01/02/04
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-PET-01 | Form Đơn thư: mỗi khái niệm 1 ô, không còn cặp trùng | AC+ | PLAN-A4-01 | TC-163 |
| COV-PET-02 | Field người (senderName…) là cột native — lưu/đọc đúng | AC+ | PLAN-A4-04 | TC-164 |
| COV-PET-03 | Panel parity Đơn thư hiển thị field cũ, không trùng ô chính | AC− | PLAN-A4-04 | TC-165 |
| COV-PET-04 | Cặp cần soát: `toiDanhBanDau` vs `crimeChinhId` — 2 ô độc lập, không ghi đè nhau | AC− | PLAN-A4-02 | TC-166 |
| COV-PET-05 | Tạo Đơn thư mới → lưu → đọc lại đủ field | AC+ | PLAN-A4-01 | TC-167 |
| COV-PET-06 | Sửa Đơn thư đã di trú → không mất field cũ | AC− | PLAN-A4-04 | TC-168 |
| COV-PET-07 | Tìm Đơn thư theo số hồ sơ cũ | AC+ | PLAN-A2-C | TC-169 |
| COV-PET-08 | Negative: bỏ trống field bắt buộc → thông báo rõ, không mất dữ liệu đã nhập | EP− | AUTH-08 | TC-170 |
| COV-PET-09 | Panel dữ liệu gốc Đơn thư còn nguyên | AC+ | PLAN-B6 | TC-171 |
| COV-PET-10 | E2E web: tiếp nhận đơn thư đầy đủ → lưu → mở lại | E2E | PLAN-A4-01 | TC-172 |

### F12 — Vụ việc (Incident) + bug auto-expand · rule PLAN-A4-03
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-INC-01 | Mở vụ việc ở giai đoạn **Tiếp nhận** → đúng section tự mở | STATE | PLAN-A4-03 | TC-173 |
| COV-INC-02 | Mở vụ việc ở giai đoạn **Xác minh** → đúng section tự mở | STATE | PLAN-A4-03 | TC-174 |
| COV-INC-03 | Mở vụ việc ở giai đoạn **Kết quả** → đúng section tự mở | STATE | PLAN-A4-03 | TC-175 |
| COV-INC-04 | Mở vụ việc ở **Tạm đình chỉ** → đúng section tự mở | STATE | PLAN-A4-03 | TC-176 |
| COV-INC-05 | Sneak path: vụ việc chưa có trạng thái/trạng thái lạ → không crash, mặc định hợp lý | STATE− | PLAN-A4-03 | TC-177 |
| COV-INC-06 | Tạo vụ việc mới (chưa có bản ghi) → không bị lỗi do trạng thái rỗng | STATE− | PLAN-A4-03 | TC-178 |
| COV-INC-07 | Form Vụ việc: mỗi khái niệm 1 ô, panel parity không trùng | AC+ | PLAN-A4-01 | TC-179 |
| COV-INC-08 | E2E web: mở vụ việc đang xác minh → section đúng mở sẵn → sửa → lưu | E2E | PLAN-A4-03 | TC-180 |

### F15 — INTEGRATION / E2E TOÀN HỆ THỐNG · rule J-E2E-01
| cov_id | Coverage item | Kỹ thuật | rule_ref | TC |
|---|---|---|---|---|
| COV-E2E-01 | Đơn thư → chuyển thành Vụ việc: field người & nội dung **không mất** khi sang module mới | E2E | NO-DATA-LOSS | TC-181 |
| COV-E2E-02 | Vụ việc → Vụ án: giá trị canonical đi tiếp đúng ô | E2E | NO-DATA-LOSS | TC-182 |
| COV-E2E-03 | Chuỗi đầy đủ Đơn thư→Vụ việc→Vụ án→Thống kê→Truy nguyên trong 1 phiên | E2E | J-E2E-01 | TC-183 |
| COV-E2E-04 | Số liệu thiệt hại nhập ở Vụ án hiện đúng ở màn thống kê/tổng hợp toàn hệ thống | E2E | PLAN-A3-R1 | TC-184 |
| COV-E2E-05 | Hồ sơ di trú: từ tìm kiếm theo số cũ → mở chi tiết → thấy bản gốc + ô canonical khớp | E2E | TRACE-PRESERVED | TC-185 |
| COV-E2E-06 | Đa vai: cán bộ tạo → điều tra viên sửa → lãnh đạo xem, không ai thấy dữ liệu lệch | E2E | SINGLE-STORE-SYNC | TC-186 |
| COV-E2E-07 | Hồi quy: chức năng cũ ngoài epic (danh sách, phân trang, lọc) vẫn chạy | REGRESSION | — | TC-187 |
| COV-E2E-08 | Hồi quy: xuất/In chứng từ vẫn lấy đúng giá trị sau khi đổi nơi lưu | REGRESSION | NO-DATA-LOSS | TC-188 |
| COV-E2E-09 | Hồi quy: KPI/Dashboard không sai lệch sau hợp nhất | REGRESSION | PLAN-A3-R1 | TC-189 |
| COV-E2E-10 | Metamorphic: thêm điều kiện lọc ⇒ tập kết quả ⊆ tập cũ | METAMORPHIC | — | TC-190 |
| COV-E2E-11 | Metamorphic: sửa 1 field rồi sửa ngược lại ⇒ hồ sơ trở về trạng thái ban đầu | METAMORPHIC | — | TC-191 |
| COV-E2E-12 | Smoke sau deploy: health + đăng nhập + mở 3 form không lỗi | E2E | PLAN-V7 | TC-192 |
| COV-E2E-13 | Tải danh sách vụ án lớn (dữ liệu di trú thật) không lỗi/không chậm bất thường | PERFORMANCE | GAP-02 | TC-193 |
| COV-E2E-14 | Đồng thời: 2 người sửa 2 vụ khác nhau → không lẫn dữ liệu | EDGE | — | TC-194 |
| COV-E2E-15 | Kết thúc phiên: dữ liệu nhập trong phiên vẫn đúng sau đăng nhập lại | E2E | — | TC-195 |

---

## 4. Tổng hợp coverage

| Nhóm kỹ thuật | Item | Phủ | % |
|---|---|---|---|
| AC (spec plan) | 52 AC-class | 52 | 100% |
| EP partition | 24 | 24 | 100% |
| BVA boundary | 20 | 20 | 100% |
| Decision rule | 16 (DR-1…DR-8 + bool + ưu tiên đọc) | 16 | 100% |
| State transition | 8 (4 giai đoạn + sneak path) | 8 | 100% |
| Pairwise | 8 | 8 | 100% |
| ISO 25010 áp dụng | Functional suitability, Reliability (data integrity), Security, Usability, Compatibility(N/A-lý do), Performance (GAP-02), Maintainability(N/A), Portability(N/A) | 5 áp dụng + 3 N/A | 100% |
| **TỔNG TC** | **195** | ≥ TC_min 180 | ✅ |

**GAP đã khai (không giả vờ pass):** GAP-01 (chuẩn hoá SĐT/CCCD), GAP-02 (ngưỡng hiệu năng), GAP-03 (miền giá trị `caseClassification`/`tinhTrang`).
**Mobile:** 12 loại TC mobile-only = **N/A** — epic không chạm artifact mobile (xem `_platform.json`).
**TC mồ côi:** 0 — mọi TC trỏ ≥1 cov_id.
