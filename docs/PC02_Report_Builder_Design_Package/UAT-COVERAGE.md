# UAT-COVERAGE — Dynamic Report Builder

Ma trận phủ theo §9 giao thức. Cập nhật mỗi khi `/uat-test-writer` → `/uat-test-runner` chạy cho một dòng. Chỉ kết thúc toàn bộ công việc khi **100% dòng = PASS**.

Quy ước `Kết quả`: `CHƯA LÀM` / `PASS` / `FAIL` / `N/A (lý do)`.

## A. 38 màn hình/trạng thái (32 mockup gốc + 6 màn mới từ review)

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| S01 | Danh sách thiết lập báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S02 | Upload mẫu Excel | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S03 | Preview và thuộc tính ô | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S04 | Lỗi import và validation mẫu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S05 | Cấu hình kỳ tuần | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S06 | Cấu hình kỳ tháng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S07 | Cấu hình kỳ quý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S08 | Cấu hình kỳ ngày cụ thể (+ DAILY mới) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S09 | Phân công quản lý/VIEWER và người nhập theo tổ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S10 | Xác nhận xuất bản | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S11 | Nhập báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S12 | Kiểm tra dữ liệu nhập | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S13 | Báo cáo đã khoá | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S14 | Báo cáo được mở lại | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S15 | Tổng hợp của người quản lý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S16 | Xem cá nhân (tổ) chỉ đọc | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S17 | Dialog mở khoá | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S18 | Nguồn số tổng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S19 | Dashboard tình trạng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
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
| S33 | Duyệt / Trả lại / Huỷ duyệt (nhiều cấp, R21) | ĐÃ VIẾT (5 TC, uat.json) | ĐÃ CHẠY THẬT 2/5 + 1 E2E Playwright | **BUG-001 tìm thấy ở lượt 1 (P1/S2) — ĐÃ VÁ ở PR #584 (commit `dcf4ed7f`, merge vào nhánh UAT này), 7 unit test mới + full suite 8221/8336 PASS.** 1 cấp duyệt mặc định (đường chính, không cấu hình nhiều cấp) đã xác nhận chạy đúng qua E2E Playwright thật (manager xem + journey render đúng dữ liệu). Kịch bản THẬT ≥2 cấp CHƯA có UI để cấu hình (xác nhận đúng ghi chú PR #584) — một lần thử tay dựng dữ liệu 2 cấp qua SQL cho kết quả bất thường (xem `_EXECUTION_REPORT.md` mục "Quan sát CHƯA kết luận"), cần kỹ sư xác nhận lại độc lập, KHÔNG tính là FAIL mới vì cách dựng dữ liệu nằm ngoài luồng được hỗ trợ. |
| S34 | Hàng chờ yêu cầu mở lại + mở khoá hàng loạt | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S35 | Nhập từ Excel (re-import có dấu __dr_meta) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S36 | Validation rules (soạn + gợi ý từ IF) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S37 | Ghi chú/giải trình theo ô và theo bản nộp | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S38 | Chốt kỳ / mở chốt (ADJUSTMENT) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

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
**Checkpoint PR10 UAT 11/10/2026 (lượt 2)**: Bước 0→7 (`uat-test-writer`) đã chạy —
`_domain-pack.md`, `_platform.json`, `_coverage-ledger.md`, `uat.json` (78 TC, qua Cổng 0
`validate_uat_json.py` và Cổng 1 `coverage_calc.py`: TC_min=214 theo M1, phủ 94/214 coverage
item = 43,9%). Đã EXECUTE LIVE một mẫu nhỏ qua API + UI thật trên dev cục bộ (không phải
78/78): **BUG-001 tìm thấy (S33/R21) và ĐÃ VÁ ở PR #584** (merge vào nhánh UAT), **1 E2E
Playwright PASS thật** (J-REVIEW-01), **PASS** (S21 audit trail, X01 một phần, clock guard),
**1 GAP cần người quyết** (X03 — oracle gốc giả định sai kiến trúc thật), **1 quan sát bất
thường chưa kết luận** (kịch bản 2 cấp dựng tay qua SQL, cần kỹ sư PR #584 tái lập độc lập).
Chi tiết đầy đủ: `_EXECUTION_REPORT.md`. **CHƯA đạt 100% PASS — còn ở trạng thái
SẴN SÀNG-KÈM-KHUYẾT**, không coi là xong; các dòng còn `CHƯA LÀM` thật sự chưa chạy, không
suy ra PASS.

**Lưu ý về "PASS" ở mục B (engine):** đây là kết quả `jest` cấp đơn vị (TDD trong lúc code), không phải UAT đầy đủ theo giao thức §9 (viết bởi `/uat-test-writer`, chạy bởi `/uat-test-runner`/`/uat-test-only` trên hệ thống thật đang chạy). Các dòng này **không tự động coi là "100% PASS" của UAT** — khi tới PR10 (giai đoạn UAT), phải chạy `/uat-test-writer` cho toàn bộ ma trận rồi `/uat-test-runner` thật trên staging, kể cả với phần engine đã xanh ở đây.
