# UAT-COVERAGE — Dynamic Report Builder

Ma trận phủ theo §9 giao thức. Cập nhật mỗi khi `/uat-test-writer` → `/uat-test-runner` chạy cho một dòng. Chỉ kết thúc toàn bộ công việc khi **100% dòng = PASS**.

Quy ước `Kết quả`: `CHƯA LÀM` / `PASS` / `FAIL` / `N/A (lý do)`.

## A. 38 màn hình/trạng thái (32 mockup gốc + 6 màn mới từ review)

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| S01 | Danh sách thiết lập báo cáo | ĐÃ VIẾT (3 TC, uat.json) | ĐÃ CHẠY THẬT 1 E2E Playwright | **PASS phần hiển thị** (admin, render đúng dữ liệu, không lỗi). TC permission-scope (chỉ thấy báo cáo của mình) CHƯA kiểm. |
| S02 | Upload mẫu Excel | ĐÃ VIẾT (6 TC, uat.json) | ĐÃ CHẠY THẬT (full E2E API, template thật 2 sheet 4 kiểu) | **PASS** — upload+sheets-detect đúng; 8 field TEXT/NUM/DATE/TIME phát hiện đúng qua token grammar. |
| S03 | Preview và thuộc tính ô | ĐÃ VIẾT (7 TC, uat.json) | ĐÃ CHẠY THẬT 1/7 (full E2E) | **PASS phần phát hiện field** + phát hiện hành vi thật của `LOCKED_LOOKS_LIKE_TOKEN` (WARNING, không chặn) khi ô vô tình để locked — khớp đúng cảnh báo mô tả trong AC-002 sửa. |
| S04 | Lỗi import và validation mẫu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S05 | Cấu hình kỳ tuần | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S06 | Cấu hình kỳ tháng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S07 | Cấu hình kỳ quý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S08 | Cấu hình kỳ ngày cụ thể (+ DAILY mới) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S09 | Phân công quản lý/VIEWER và người nhập theo tổ | ĐÃ VIẾT (7 TC, uat.json) | ĐÃ CHẠY THẬT (full E2E) | **PASS** — publish với 2 tổ + 1 manager qua config thật, DB tạo đúng `DynReportTarget`/`DynReportRole`. |
| S10 | Xác nhận xuất bản | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT (full E2E) | **PASS** — `POST /reports` publish=true trả 201, report+version tạo thật. |
| S11 | Nhập báo cáo | ĐÃ VIẾT (10 TC, uat.json) | ĐÃ CHẠY THẬT 3/10 (full E2E) | **PASS**: NUM invalid ("abc") → 400 CELL_VALIDATION đúng; giá trị hợp lệ TEXT/NUM/DATE/TIME lưu đúng (200). Autosave debounce/paste/boundary CHƯA kiểm. |
| S12 | Kiểm tra dữ liệu nhập | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S13 | Báo cáo đã khoá | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT 1 API + 1 E2E Playwright | **PASS phần API** (PATCH bị chặn 403/409 khi SUBMITTED — xác nhận ở lượt 1). **CHƯA kết luận phần UI** (trang mở đúng, nhưng chưa xác nhận chắc ô nhập có hiện readonly đúng — selector E2E quá rộng, cần làm lại với locator cụ thể). |
| S14 | Báo cáo được mở lại | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S15 | Tổng hợp của người quản lý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S16 | Xem cá nhân (tổ) chỉ đọc | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S17 | Dialog mở khoá | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S18 | Nguồn số tổng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S19 | Dashboard tình trạng | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT 1 E2E Playwright | **PASS phần hiển thị** (manager-test, render đúng dữ liệu thật, không lỗi). Chi tiết số liệu KPI/mẫu số CHƯA kiểm. |
| S20 | Ma trận người/tổ và báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S21 | Lịch sử và audit | ĐÃ VIẾT (2 TC, uat.json) | ĐÃ CHẠY THẬT 1/2 (quan sát DB trực tiếp) | **PASS** — `dyn_report_revisions` (actor+reason+kind+revision+thời điểm) có dữ liệu thật đầy đủ từ các lượt SAVE/SUBMIT/RETURN/APPROVE/UNAPPROVE trước đó. |
| S22 | Quản lý phiên bản | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S23 | Loading/empty/error/permission toàn module | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S24 | Responsive và editor từng ô (mobile) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S25 | Xuất file và trạng thái job | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S26 | Mất mạng và revision conflict | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S27 | Biểu đồ và filter nâng cao | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S28 | Date/Time picker và editor theo kiểu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S29 | Xác nhận và kết quả hoàn thành/nộp | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S30 | Điều chỉnh và miễn nghĩa vụ giữa kỳ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S31 | Ngừng phát sinh và thu hồi grant | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S32 | Lưới template và ràng buộc field (quét vùng web) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S33 | Duyệt / Trả lại / Huỷ duyệt (nhiều cấp, R21) | ĐÃ VIẾT (5 TC, uat.json) | ĐÃ CHẠY THẬT 2/5 + 1 E2E Playwright + 1 thí nghiệm sạch 2 cấp | **PASS — BUG-001 đóng hoàn toàn.** Tìm thấy ở lượt 1 (P1/S2), vá ở PR #584 (commit `dcf4ed7f`, merge vào nhánh UAT này), 7 unit test mới + full suite 8221/8336 PASS. 1 cấp duyệt mặc định xác nhận đúng qua E2E Playwright thật. Kịch bản 2 cấp: lượt thử đầu của tôi "có vẻ bất thường" do fixture artifact còn sót từ thử nghiệm trước (approvalLevel đã =1 sẵn, không phải 0 như giả định) — KHÔNG phải bug. Kỹ sư PR #584 tái lập độc lập bằng thí nghiệm sạch (build lại loại cache, baseline sạch, gọi trực tiếp `SubmissionService.approve()` qua service/transition thật): **PASS cả 2 bước** (cấp 1 giữ SUBMITTED, cấp 2 mới APPROVED). UI cấu hình `approvalLevel>1` vẫn CHƯA tồn tại — GAP riêng, không phải BUG-001. |
| S34 | Hàng chờ yêu cầu mở lại + mở khoá hàng loạt | ĐÃ VIẾT (2 TC, uat.json) | ĐÃ CHẠY THẬT 1 API + 1 E2E Playwright | **PASS phần hiển thị** (trang tải không lỗi) **+ PASS phần state-gate** (yêu cầu mở lại không tự mở, xác nhận ở lượt 1). Luồng duyệt/từ chối hàng loạt CHƯA kiểm. |
| S35 | Nhập từ Excel (re-import có dấu __dr_meta) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S36 | Validation rules (soạn + gợi ý từ IF) | ĐÃ VIẾT (5 TC, uat.json) | ĐÃ CHẠY THẬT 1/5 (full E2E) | **Rule ERROR qua được khi khớp dữ liệu (SUBMIT 201)**; TC-S36-01/02 gốc trong `uat.json` thiết kế SAI kiến trúc (rule cross-sheet không bao giờ áp dụng được — `missingStrategy=SKIP`, xác nhận bằng đọc code) — không phải bug sản phẩm, cần SỬA TC ở lượt sau. TC-S36-03 (gợi ý từ IF) xác nhận qua chính comment trong code là **GAP có thật**: `suggest-rules.ts` viết + unit test nhưng "never wired to any endpoint or UI" — ghi oracle_type=GAP. |
| S37 | Ghi chú/giải trình theo ô và theo bản nộp | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT 3/4 (full E2E) | **PASS** — ghi chú theo ô (editor) và theo cả bản nộp (manager, fieldKey=null) đều tạo đúng (201), editor đọc được cả 2 loại. |
| S38 | Chốt kỳ / mở chốt (ADJUSTMENT) | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT 3/4 (full E2E + tái xác nhận vá) | **PASS — BUG-002 ĐÃ VÁ (PR #586)**: `finalizePeriod()` tìm thấy không kiểm submission trước khi chốt (P1/S3, lượt 4), đã vá chặn chốt kỳ hoàn toàn trống (2 unit test mới, full suite PASS); tôi tái lập lại qua API thật sau merge → **409 chặn đúng "Chưa có tổ nào nộp dữ liệu..."**. Không ép 100% hoàn thành (đúng theo spec — kỳ có ≥1 tổ nộp vẫn chốt được). **PASS phần khoá-sau-chốt**: SAVE/SUBMIT/APPROVE/finalize-lần-2 sau FINALIZED đều bị chặn đúng (409). **GAP UX còn lại (chưa vá)**: `window.confirm` không hiện tỷ lệ hoàn thành khi chốt kỳ MỘT PHẦN (vd 1/16 tổ) — xem `_EXECUTION_REPORT.md`. |

## B. Engine thuần (PR1 — không phải màn hình, nhưng là chức năng độc lập cần phủ)

| ID | Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| E01 | period: sinh kỳ DAILY/WEEKLY/MONTHLY/QUARTERLY/SEMI_ANNUAL/YEARLY/ONE_TIME, biên lịch | PASS | PASS | PASS (25/25) |
| E02 | token: grammar `{TYPE\|FORMAT\|AGG}`, alias Num/AGV | PASS | PASS | PASS (27/27) |
| E03 | template-parser: locked hiệu lực, shared formula, merge, hidden | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM (PR3) |
| E04 | expr: SUM/IF/AVERAGE/MIN/MAX/COUNT/ROUND/AND/OR/ABS, vòng lặp, PREV | PASS | PASS | PASS (52/52) |
| E05 | decimal: precision/scale, parse vi-VN | PASS | PASS | PASS (36/36) |
| E06 | values: NUM/TEXT/DATE/TIME validate | PASS | PASS | PASS (39/39) |
| E07 | aggregate: SUM/AVG/MIN/MAX/COUNT/NONE, blankPolicy ZERO/IGNORE, oracle HSLN | PASS | PASS | PASS (12/12, đối chiếu 228 dòng oracle thật) |
| E08 | access: canEdit theo state/grant/deadline/now | PASS | PASS | PASS (18/18) |
| E09 | status: KPI, mẫu số 0 | PASS | PASS | PASS (17/17) |
| E10 | paste: TSV nguyên tử | PASS | PASS | PASS (16/16) |
| E11 | date-math (dùng chung, không có trong danh mục gốc) | PASS | PASS | PASS (32/32) |

## C. Xuyên suốt (gate, không phải 1 màn hình)

| ID | Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| X01 | Quyền: route-quyền gate, 404 chống dò, VIEWER theo phạm vi | ĐÃ VIẾT (6 TC, uat.json) | ĐÃ CHẠY THẬT 2/6 qua API live | **PASS cho 2 ca đã chạy**: (1) vô danh không token GET report tồn tại vs không tồn tại → cả hai 404 giống nhau (không lộ tồn tại). (2) VIEWER GET `/submissions/:id/review` của báo cáo mình KHÔNG có vai phù hợp → 404 "Không tìm thấy lượt giao này" (an toàn, không lộ). 4/6 TC còn lại (scope theo team, admin read-only, dual-role mode bypass) CHƯA chạy — cần set up thêm fixture nhiều tổ. |
| X02 | Đồng thời: lưu↔chốt kỳ, lưu↔D09, 2 editor cùng tổ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X03 | Audit không chứa số liệu | ĐÃ VIẾT (2 TC, uat.json) | ĐÃ QUAN SÁT 1/2 qua DB thật | **CHƯA KẾT LUẬN — GAP cần người quyết**: kiến trúc thật KHÔNG có audit log tách biệt không chứa số liệu; audit trail (`dyn_report_revisions`) lưu `valuesFull` theo đúng mục đích (snapshot rollback). Oracle gốc của X03 giả định sai kiến trúc — cần người có thẩm quyền sản phẩm xác nhận lại ý định thật của X03 trước khi viết lại TC. Xem `_EXECUTION_REPORT.md`. |
| X04 | Hiệu năng: 5.000 input/200 tổ/50 ghi đồng thời | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X05 | Upload không an toàn (macro/mã hoá/zip bomb) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X06 | Monkey test (chạy một lần cuối) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X07 | Triển khai an toàn: flag, rollback, migration additive | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

**Tổng: 53 dòng. PASS (unit jest, chưa phải UAT đầy đủ): 10/53** (toàn bộ engine thuần PR1).
**Checkpoint PR10 UAT 11/10/2026 (lượt 5)**: Bước 0→7 (`uat-test-writer`) đã chạy —
`_domain-pack.md`, `_platform.json`, `_coverage-ledger.md`, `uat.json` (78 TC, qua Cổng 0
`validate_uat_json.py` và Cổng 1 `coverage_calc.py`: TC_min=214 theo M1, phủ 94/214 coverage
item = 43,9%). Đã EXECUTE LIVE qua API + UI thật trên dev cục bộ (không phải 78/78 — ưu tiên
chất lượng hơn số lượng theo đúng chỉ đạo):
- **BUG-001** (S33/R21, totalApprovalLevels hardcode) — tìm thấy lượt 1, **ĐÃ VÁ PR #584,
  ĐÃ ĐÓNG HOÀN TOÀN** (tái lập độc lập cả 2 bước 2 cấp bằng thí nghiệm sạch — PASS).
- **BUG-002** (S38, `finalizePeriod()` không kiểm đã có tổ nộp trước khi chốt kỳ, P1/S3) —
  tìm thấy lượt 4 qua **full E2E journey thật** (upload→preview→publish→nhập→duyệt→chốt kỳ
  nối tiếp qua API thật, không mock), **ĐÃ VÁ PR #586, đã tái xác nhận độc lập qua API thật
  — 409 chặn đúng**. GAP UX còn lại (chốt kỳ một phần không hiện tỷ lệ) CHƯA vá, xem
  `_EXECUTION_REPORT.md`.
- **5 E2E Playwright PASS thật** (J-REVIEW-01, S01, S13, S19, S34) + **1 full E2E API journey
  PASS qua 10 bước thật** (S02→S03→S09→S10→S11→S36→S37→S33→S38, bắt được BUG-002).
- **PASS**: S21 audit trail, X01 một phần, clock guard, S37 (ghi chú theo ô/bản nộp), khoá
  đúng sau chốt kỳ (REPORT_LOCKED 409 mọi lần thử sau FINALIZED).
- **1 GAP xác nhận bằng chính comment trong code** (S36-03 "gợi ý từ IF" — `suggest-rules.ts`
  viết+test nhưng chưa wire UI/endpoint).
- **1 GAP cần người quyết** (X03 — oracle gốc giả định sai kiến trúc thật).
- **1 bài học tự sửa** (TC-S36-01/02 gốc thiết kế sai kiến trúc — rule cross-sheet không bao
  giờ áp dụng được do `missingStrategy=SKIP`; không phải bug, cần viết lại TC).
- **1 phát hiện hạ tầng đã tự vá** (khoá JWT lệch cặp sau restart).

Chi tiết đầy đủ: `_EXECUTION_REPORT.md`. **CHƯA đạt 100% PASS — còn ở trạng thái
SẴN SÀNG-KÈM-KHUYẾT**, không coi là xong; các dòng còn `CHƯA LÀM` thật sự chưa chạy, không
suy ra PASS.

**Lưu ý về "PASS" ở mục B (engine):** đây là kết quả `jest` cấp đơn vị (TDD trong lúc code), không phải UAT đầy đủ theo giao thức §9 (viết bởi `/uat-test-writer`, chạy bởi `/uat-test-runner`/`/uat-test-only` trên hệ thống thật đang chạy). Các dòng này **không tự động coi là "100% PASS" của UAT** — khi tới PR10 (giai đoạn UAT), phải chạy `/uat-test-writer` cho toàn bộ ma trận rồi `/uat-test-runner` thật trên staging, kể cả với phần engine đã xanh ở đây.
