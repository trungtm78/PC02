# _plan-scope.md — Bước 0.5 Plan Grounding

**Plan nguồn:** `C:\Users\Than Minh Trung\.claude\plans\h-y-ph-n-t-ch-to-n-floofy-fairy.md`
**Tiêu đề:** HỢP NHẤT field cũ (di trú) ↔ field mới (native) → 1 field/khái niệm, cột typed làm nơi lưu chuẩn + sắp xếp form logic
**Trạng thái thực thi:** PR #218 (data-consolidation) + PR #219 (layout-reorg) đã merge & deploy prod 2026-08-23.
**Nhánh:** `feat/consolidate-legacy-native-fields`

## ⚠️ Ràng buộc phương pháp (lệnh của người dùng — đã hiệu chỉnh giữa phiên)

**Lệnh gốc:** "không được dùng codebase để tạo test case".
**Hiệu chỉnh của người dùng sau khi làm rõ:** codebase ĐƯỢC phân tích — chỉ cấm lấy *kết quả mong đợi* từ đó.

Bức tường lửa áp dụng (xem `_codebase-map.md`):
| Được lấy từ code | CẤM lấy từ code |
|---|---|
| Điểm neo: endpoint, tên trường, nhãn/testid, lệnh chạy, danh sách trạng thái | **Kết quả mong đợi (oracle)** |
| Đo độ phức tạp → sàn số TC (M2) | Suy luận "code làm vậy nên đúng là vậy" (tautology oracle) |

- **Oracle vẫn 100% từ PLAN.** Mọi `expected` truy về `_plan-scope.md` hoặc AUTH-* của `_domain-pack.md`.
- **Drift (code ≠ plan)** phát hiện ở Bước 1 là *giả thuyết cần kiểm chứng ở tầng sản phẩm*, KHÔNG phải verdict. Xem DRIFT-1…DRIFT-5.
- P4 của Bước 0.5 (cross-check plan-claim) thực hiện **cả hai chiều**: đối chiếu code (nhanh, chỉ ra chỗ nghi) **và** đối chiếu hệ thống chạy thật (kết luận). Chỉ chiều thứ hai được ra verdict — đúng tầng sản phẩm (trụ 5 layer parity).

## P2 — Deep-read: ý định & quyết định

**Vấn đề gốc:** 1 khái niệm nghiệp vụ có **2 ô nhập trùng nghĩa** (ô "native" người dùng thiết kế + ô "di trú" từ hệ cũ pc02hcm.com). Người nhập phải điền 2 nơi cho cùng một thứ.

**Sự thật lưu trữ mà plan tuyên bố** (đây là CLAIM cần UAT kiểm chứng, KHÔNG phải tiền đề được chấp nhận vô điều kiện):

| # | Claim của plan | Mã kiểm |
|---|---|---|
| PC-1 | Field "native" (`reporter*`, `damageAmount`, `receiveDate`…) trước đây lưu trong `Case.metadata` JSON, KHÔNG phải cột | PLAN-PC-01 |
| PC-2 | Field "di trú" CÓ cột Case nhưng form đọc/ghi qua metadata → cột là snapshot write-only, stale | PLAN-PC-02 |
| PC-3 | `soTienBiThietHai`/`soLuongBiHai`/`soNguoiBiThuong` thuộc bảng `CaseStatistic`, KHÔNG thuộc `Case` | PLAN-PC-03 |
| PC-4 | Damage/victim tồn tại ở **3 nơi** (metadata.damageAmount + metadata.stat_damageAmount + case_statistics) | PLAN-PC-04 |

**2 lệnh người dùng chốt (ràng buộc thiết kế — oracle hạng Claim):**
- **D1:** hướng gộp = giữ **CỘT typed làm canonical**, ô form gắn **nhãn native**; KHÔNG hạ data xuống metadata.
- **D2:** cặp cùng nghĩa **lệch kiểu → chuyển data về KIỂU field NATIVE**.
- Ràng buộc: không giảm scope; được đổi trình tự; được tăng scope.

**Mục tiêu cuối (AC tối thượng):** mỗi khái niệm = **1 ô form (nhãn native) ↔ 1 cột typed queryable ↔ 0 metadata trùng**, **không sót data**.

## P3 — Extract: bảng rule_ref BẮT BUỘC phủ

### A1 — 8 cặp GỘP (Vụ án). Canonical = cột; ô form nhãn native; backfill từ CẢ metadata (`meta.<native>` ưu tiên, else `meta.<old>`)

| rule_ref | Ô native (bỏ) | Ô di trú (bỏ) | Canonical | Lưu tại | Nhãn form | Ràng buộc riêng |
|---|---|---|---|---|---|---|
| PLAN-A1-01 | `reporter` | `tenCungCap` | `tenCungCap` | C — Case | "Người tố cáo/Báo tin" | — |
| PLAN-A1-02 | `reporterIdNumber` | `cccdCungCap` | `cccdCungCap` | C — Case | "Số CCCD" | — |
| PLAN-A1-03 | `reporterDateOfBirth` (date) | `sinhNamCungCap` (String) | `reporterDateOfBirth` | N — cột Date MỚI | "Ngày sinh" | lệch kiểu → kiểu native (Date); năm-only cũ → `YYYY-01-01` + cột `reporterDateOfBirthPrecision='year'` (CẤM dùng cờ metadata) |
| PLAN-A1-04 | `reporterPhone` | `sdtCungCap` | `sdtCungCap` | C — Case | "Số điện thoại" | — |
| PLAN-A1-05 | `reporterAddress` | `diaChiCungCap` | `diaChiCungCap` | C — Case | "Địa chỉ" | **CẤM gộp `biHai`** — `biHai` = "Bị hại" (tên/đối tượng) ≠ địa chỉ → gộp = corruption. `biHai` giữ riêng (cluster B) |
| PLAN-A1-06 | `description` | `moTaChiTiet` | `moTaChiTiet` | C — Case | "Tóm tắt nội dung" | — |
| PLAN-A1-07 | `damageAmount` + `stat_damageAmount` | `soTienBiThietHai` | `soTienBiThietHai` | S — CaseStatistic | "Số tiền thiệt hại (VND)" | hợp nhất **3 nơi**; ghi `payload.statistic.*`; tạo row `case_statistics` nếu vụ chưa có |
| PLAN-A1-08 | `stat_victimCount` | `soLuongBiHai` | `soLuongBiHai` | S — CaseStatistic | "Số bị hại" | như trên |

### A2 — THĂNG field thành field chính thức (form đọc/ghi THẲNG cột, không qua metadata)

- **PLAN-A2-C** — 22 field đã có cột Case, chỉ rebind + đặt chỗ:
  `nguonDon`, `soPhieuChuyen`, `ngayPhieuChuyen`, `ngayGiaoDonViGiaiQuyet`, `ngayDeXuat`, `ngayVietDon`, `ngayCapCccd`, `noiCapCccd`, `ghiChuTrungDon`, `baoCaoBanGiamDoc`(bool), `lanhDaoToTung`, `nhanXet`, `yeuCauBoSung`, `ketQuaXuLyKhac`, `doVatTaiLieuKemTheo`, `phanLoaiHoSoNoiBo`, `noiXayRa`, `phuongThucThuDoan`, `phanLoaiToiPhamLinhVuc`, `nghiVanDoiTuong`, `sttCu`, `soHoSoCu`
- **PLAN-A2-R** — reconcile tên form-key ↔ tên cột: `deXuatXuLy` → cột `deXuat` (bỏ form-key thừa); `dieuTraVienText` → cột `dieuTraVien` (xem R7)
- **PLAN-A2-N** — 6 cột PHẢI thêm mới (migration): `receiveDate`(Date), `caseClassification`, `tinhTrang`, `toiDanhBanDau`, `reporterDateOfBirth`(Date), `reporterDateOfBirthPrecision`

### A3 — Quyết định review R1–R7 (oracle hạng Claim, đã chốt)

| rule_ref | Nội dung | Anti-behaviour (FAIL nếu xảy ra) |
|---|---|---|
| PLAN-A3-R1 | Canonical damage/victim = `case_statistics.soTienBiThietHai`/`soLuongBiHai`; metadata.damageAmount + stat_damageAmount + tab Thống kê đọc/ghi CÙNG cột; tắt đường metadata trùng | Sửa ở tab Thống kê không phản ánh ở tab Thông tin (hoặc ngược lại) |
| PLAN-A3-R2 | Giữ cột `noiXayRa` (cluster C). CẤM merge vào `specificAddress`/`criminalLocation` (khác ngữ cảnh). `specificAddress` (metadata) gộp về `noiXayRa` | `noiXayRa` bị ghi đè bởi địa chỉ hành chính |
| PLAN-A3-R3 | Giữ cột `phuongThucThuDoan` (cluster C), thăng — không có native tương đương | Bị coi là trùng và bị bỏ |
| PLAN-A3-R4 | Giữ cột `phanLoaiToiPhamLinhVuc`; `stat_crimeField` (nếu cùng nghĩa) đọc CHUNG cột | 2 nguồn lệch nhau |
| PLAN-A3-R5 | Giữ cột text `nghiVanDoiTuong` (ghi chú nhanh, cluster B). CẤM merge vào Subjects (thực thể có cấu trúc) — giữ CẢ HAI | Ghi chú bị nuốt khi có Subject |
| PLAN-A3-R6 | THÊM cột `toiDanhBanDau`, đặt cạnh cụm tội danh (cluster D). CẤM merge `criminalSecondaryType` | Tội danh ban đầu ghi đè tội danh phụ |
| PLAN-A3-R7 | **CẤM merge** `dieuTraVien`(text hệ cũ) với `handler`/`investigatorId`(FK user). Giữ CẢ HAI: handler = ô chính (cluster E), `dieuTraVien` = dòng tham chiếu "ĐTV (hệ cũ)" | Merge → MẤT data khi tên ĐTV không match user nào |

### A4 — Đơn thư / Vụ việc (milestone riêng, KHÔNG phải ghi chú phụ)

| rule_ref | Nội dung |
|---|---|
| PLAN-A4-01 | Chạy phân loại C/S/N/R riêng cho Petition & Incident rồi mới thăng/gộp; đa số THĂNG + sắp xếp |
| PLAN-A4-02 | Cặp GỘP cần soát: Đơn thư `toiDanhBanDau` vs `crimeChinhId` |
| PLAN-A4-03 | **Bug kèm:** IncidentFormPage — auto-expand section phải dùng `d.status` (record vừa tải) thay vì biến `status` rỗng → mở đúng giai đoạn |
| PLAN-A4-04 | Petition/Incident: person fields vốn là cột native → KHÔNG cần đụng data; parity cols đã chính thức + panel LegacyParityFields |

### B — Thực thi (thứ tự an toàn chống mất data)

| rule_ref | Yêu cầu kiểm chứng được |
|---|---|
| PLAN-B1 | Migration thêm cột (N) + DTO create/update; **ngày = quy ước date-only (00:00 giờ VN)** tránh off-by-one |
| PLAN-B2 | Dual-write cửa sổ tương thích: CREATE + UPDATE ghi CẢ cột lẫn metadata, idempotent. **CREATE bắt buộc map cột intake (P1 blocker — trước đó chỉ UPDATE có)** |
| PLAN-B3 | Backfill SQL: backup trước; **chỉ-khi-cột-NULL**; giá trị không parse được → bảng `migration_reject` (cột để NULL, KHÔNG bịa); cột đã có giá trị KHÁC metadata → **KHÔNG đè**, ghi `migration_conflict`; damage/victim upsert `case_statistics` ON CONFLICT |
| PLAN-B4 | FE rebind: đọc `apiData.<col>` + `apiData.statistic.<col>`, fallback `meta.<key>` cho vụ chưa backfill; ghi top-level/statistic; **NGỪNG ghi `metadata.<promotedKey>`**; **lọc key đã thăng khỏi `legacyMetadata` re-merge**; `tabs`: 1 ô/khái niệm; field đã vào form chính phải GỠ khỏi `parityState` (tránh 2 nguồn ghi 1 cột); search query theo cột + fallback metadata |
| PLAN-B5 | `legacy-mapper` cập nhật để lần di trú/nhập sau ghi canonical cột (KHÔNG optional) |
| PLAN-B6 | Sau khi backfill + FE ổn định → gỡ dual-write metadata. **KHÔNG xóa metadata cũ trong DB** (lưới an toàn); `LegacyRawPanel` giữ nguyên |

### C — Sắp xếp form theo cluster dòng tố tụng

| rule_ref | Cluster | Nội dung |
|---|---|---|
| PLAN-C-A | Định danh & tiếp nhận | mã hồ sơ, `receiveDate`+giờ, đơn vị, nguồn (`caseProvenance` enum + `nguonDon` text), `soPhieuChuyen`+`ngayPhieuChuyen`, `ngayGiaoDonViGiaiQuyet`, `ngayDeXuat`/`ngayVietDon` |
| PLAN-C-B | Chủ thể (mọi field người 1 chỗ) | người tố cáo (họ tên, ngày sinh, giới tính, **CCCD + ngày cấp + nơi cấp LIỀN KỀ**, SĐT, email, địa chỉ, quan hệ); `biHai`; `nghiVanDoiTuong` + Subjects |
| PLAN-C-C | Sự việc & địa điểm | tiêu đề, `moTaChiTiet`, `phuongThucThuDoan`, `noiXayRa`, ngày xảy ra/phát hiện |
| PLAN-C-D | Phân loại & tố tụng | `caseClassification`, ưu tiên, tội danh (chính + `toiDanhBanDau` + phụ LIỀN NHAU), `phanLoaiToiPhamLinhVuc`, `phanLoaiHoSoNoiBo`, VKS/tòa |
| PLAN-C-E | Phân công (1 section) | `handler`(FK) + `dieuTraVien`(tham chiếu), đơn vị thụ lý, `lanhDaoToTung`, cán bộ đề xuất, hạn xử lý |
| PLAN-C-F | Kết quả & giai đoạn sau | loại kết quả, các QĐ (khởi tố→không khởi tố→tạm đình chỉ→phục hồi→đình chỉ→tách/nhập→bản án), `soTienBiThietHai`/`soLuongBiHai`, `nhanXet`/`deXuat`/`ketQuaXuLyKhac`/`yeuCauBoSung` |
| PLAN-C-G | Thống kê + di trú | tab Thống kê (đọc chung cột statistic) + `sttCu`/`soHoSoCu` + `LegacyRawPanel` cuối |
| PLAN-C-RULE | Nguyên tắc | required đầu section; CCCD số/ngày/nơi liền nhau; KHÔNG để field giai-đoạn-sau trước tiếp-nhận; mỗi cụm người/địa điểm/phân công 1 chỗ |

### Verification — 7 tiêu chí của plan (AC nghiệm thu, UAT phủ 100%)

| rule_ref | Tiêu chí |
|---|---|
| PLAN-V1 | migrate/generate sạch; tsc FE+BE; vitest 3 form + jest cases xanh |
| PLAN-V2 | **Không mất data — đo bằng ROW-COVERAGE + conflict inventory, KHÔNG value-count:** với mỗi cột `#rows cột non-null SAU` ≥ `#rows có (metadata native ∪ old) non-null TRƯỚC` − `#conflict` − `#reject`; bảng conflict/reject rỗng hoặc đã review từng dòng; metadata + cột + legacyRaw CÒN trong DB |
| PLAN-V3 | **1 store:** sửa 1 vụ trên FE → giá trị vào cột/statistic; metadata promoted-key KHÔNG được ghi mới; reload hiện đúng TỪ CỘT. CREATE vụ mới → cột có data (regression cho P1 CREATE) |
| PLAN-V4 | **DTO whitelist:** field mới qua class-validator không bị strip; integration API create/update cho ≥1 field mỗi loại C/S/N/R |
| PLAN-V5 | **Đầy đủ UI:** mỗi khái niệm 1 ô; `LegacyRawPanel` hiện bản gốc |
| PLAN-V6 | **Logic nhập:** 3 form theo cluster A–G; required đầu; CCCD liền nhau; không lặp cụm; bug IncidentFormPage hết |
| PLAN-V7 | Local xanh → duyệt → prod (pg_dump, SQL idempotent, migrate deploy, FE qua PR, /review + /codex mỗi bước) |

### NOT IN SCOPE (plan tuyên bố — UAT PHẢI TÔN TRỌNG, không test)
- KHÔNG drop cột, KHÔNG xóa metadata cũ trong DB (chỉ ngừng đọc/ghi).
- (tùy chọn tương lai, chưa làm) PR2c: ngừng hẳn ghi metadata promoted-key + lọc `legacyMetadata` re-merge; reorg thêm cho form Đơn thư/Vụ việc.
  → **Hệ quả UAT:** TC liên quan "NGỪNG ghi metadata" (PLAN-B4-b / PLAN-B6 / PLAN-V3-b) đánh dấu **EXPECTED-DEFERRED**: dual-write còn bật là ĐÚNG trạng thái hiện tại; TC vẫn chạy để ĐO drift, verdict tính riêng, KHÔNG tính là bug.

## P4 — Cross-check plan-claim vs THỰC TẾ (thực hiện ở Bước 7b, black-box)

| Mã | Claim phải verify LIVE |
|---|---|
| CL-1 | (PLAN-B2) CREATE map cột intake — plan gọi là "P1 blocker" đã vá → verify bằng tạo vụ mới rồi đọc lại |
| CL-2 | (PLAN-B3) backfill: "1866 vụ, 0 conflict, 20 reject" → verify bảng conflict/reject + row-coverage |
| CL-3 | (PLAN-A1-03) DOB precision round-trip year-only → verify nhập/đọc lại không trôi ngày |
| CL-4 | (PLAN-A1-07) damage 3 nơi → 1 → verify 2 tab đồng bộ |
| CL-5 | (PLAN-A4-03) bug IncidentFormPage auto-expand → verify mở đúng giai đoạn |
| CL-6 | (PLAN-B4) dual-write còn bật (EXPECTED-DEFERRED) → đo, không fail |
