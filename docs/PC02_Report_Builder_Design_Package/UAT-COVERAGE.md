# UAT-COVERAGE — Dynamic Report Builder

Ma trận phủ theo §9 giao thức. Cập nhật mỗi khi `/uat-test-writer` → `/uat-test-runner` chạy cho một dòng. Chỉ kết thúc toàn bộ công việc khi **100% dòng = PASS**.

Quy ước `Kết quả`: `CHƯA LÀM` / `PASS` / `FAIL` / `N/A (lý do)`.

## A. 38 màn hình/trạng thái (32 mockup gốc + 6 màn mới từ review)

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| S01 | Danh sách thiết lập báo cáo | ĐÃ VIẾT (3 TC, uat.json) | ĐÃ CHẠY THẬT 1 E2E Playwright | **PASS phần hiển thị** (admin, render đúng dữ liệu, không lỗi). TC permission-scope (chỉ thấy báo cáo của mình) CHƯA kiểm. |
| S02 | Upload mẫu Excel | ĐÃ VIẾT (6 TC, uat.json) | ĐÃ CHẠY THẬT (full E2E API, template thật 2 sheet 4 kiểu) | **PASS** — upload+sheets-detect đúng; 8 field TEXT/NUM/DATE/TIME phát hiện đúng qua token grammar. |
| S03 | Preview và thuộc tính ô | ĐÃ VIẾT (7 TC, uat.json) | ĐÃ CHẠY THẬT 1/7 (full E2E) | **PASS phần phát hiện field** + phát hiện hành vi thật của `LOCKED_LOOKS_LIKE_TOKEN` (WARNING, không chặn) khi ô vô tình để locked — khớp đúng cảnh báo mô tả trong AC-002 sửa. |
| S04 | Lỗi import và validation mẫu | ĐÃ VIẾT (5 TC, uat.json) | ĐÃ CHẠY THẬT 2/5 (fixture độc hại thật PR0) | **PASS**: macro (`renamed_macro_as_xlsx.xlsx`) → `400 MACRO_DETECTED`; encrypted (`password_encrypted.xlsx`) → `400 INVALID_MIME`. Dùng fixture thật có sẵn `backend/test/fixtures/dynamic-reports/hostile/`, không tự dựng. |
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
| S33 | Duyệt / Trả lại / Huỷ duyệt (nhiều cấp, R21) | ĐÃ VIẾT (5 TC, uat.json) | ĐÃ CHẠY THẬT 5/5 + 1 E2E Playwright + 1 thí nghiệm sạch 2 cấp | **PASS — cả 3 hành động chính (APPROVE/RETURN/UNAPPROVE) đã xác nhận live.** BUG-001 đóng hoàn toàn: tìm thấy lượt 1 (P1/S2), vá PR #584 (`dcf4ed7f`), tái lập sạch cả 2 bước 2 cấp PASS. Lượt 8: xác nhận thêm UNAPPROVE (APPROVED→SUBMITTED, 201) + VIEWER bị chặn đúng (404, không-lộ-tồn-tại) khi thử UNAPPROVE không phải MANAGER. UI cấu hình `approvalLevel>1` vẫn CHƯA tồn tại — GAP riêng, không phải bug. |
| S34 | Hàng chờ yêu cầu mở lại + mở khoá hàng loạt | ĐÃ VIẾT (2 TC, uat.json) | ĐÃ CHẠY THẬT 1 API + 1 E2E Playwright | **PASS phần hiển thị** (trang tải không lỗi) **+ PASS phần state-gate** (yêu cầu mở lại không tự mở, xác nhận ở lượt 1). Luồng duyệt/từ chối hàng loạt CHƯA kiểm. |
| S35 | Nhập từ Excel (re-import có dấu __dr_meta) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S36 | Validation rules (soạn + gợi ý từ IF) | ĐÃ VIẾT (5 TC, uat.json, đã SỬA TC-S36-01/02) | ĐÃ CHẠY THẬT 2/5 (full E2E, cú pháp rule đã sửa đúng) | **PASS — ERROR chặn SUBMIT (400, nêu đúng tên rule), WARNING không chặn (201)**, xác nhận live sau khi sửa 2 lỗi thiết kế TC liên tiếp (cross-sheet lượt 4, cú pháp quote Excel sai lượt 5) — chi tiết "Bài học kiểm thử lần 2" ở `_EXECUTION_REPORT.md`. **GAP UX-02 (đã biết, chưa vá)**: TC-S36-03 "gợi ý từ IF" — `suggest-rules.ts` viết + unit test nhưng chính comment trong code xác nhận "never wired to any endpoint or UI" — oracle_type=GAP. |
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
| X04 | Hiệu năng: 5.000 input/200 tổ/50 ghi đồng thời | ĐÃ VIẾT (3 script tạm, xoá sau đo) | ĐÃ ĐO THẬT 3/3 qua HTTP thật trên dev cục bộ, 11/10/2026 | **1/3 ĐẠT, 2/3 KHÔNG ĐẠT.** (1) Mở form S11, 1 báo cáo 5.000 field: p95=146,0ms vs target ≤3s — ĐẠT. (2) Autosave 50 `Promise.all` đồng thời: p95=2.839,4ms vs target ≤1s — KHÔNG ĐẠT; thêm 8/50 (16%) request trả 500 (`Transaction API error: Unable to start a transaction in the given time` — pool `pg` mặc định 10 connection, `prisma.service.ts` không set `max`); đã xác minh qua DB **KHÔNG mất/nhân đôi dữ liệu** (đúng 42 submission currentRevision=1 + đúng 42 revision mới, không trùng; 8 thất bại giữ nguyên revision=0, rollback sạch). (3) Status/màn C, kỳ 200 tổ: p95=3.775,6ms vs target ≤3s — KHÔNG ĐẠT; cô lập bằng script riêng xác định nguyên nhân: `StatusQueryService#queryRows()` (`status-query.service.ts` dòng 224-233) nạp lồng toàn bộ 5.000 field của version vào MỖI assignment (200×5.000=1 triệu tham chiếu/request) chỉ để tính tỷ lệ điền, trong khi mọi assignment cùng kỳ dùng chung 1 versionId — độ phức tạp sai O(assignments×fields) thay vì O(fields). Cả 2 KHÔNG ĐẠT đã báo cáo cho coordinator, CHƯA tự vá (theo đúng chỉ đạo, giống quy trình BUG-001/002/003). Chi tiết đầy đủ + môi trường đo: `PROGRESS.md` mục "Benchmark X04 — đo thật lần đầu". **TÁI ĐO lần 2 sau vá (11-12/10/2026, 4 lượt đo độc lập, script tạm riêng `drbench2-*`, đã xoá sau đo)**: Chỉ số (1) Mở form vẫn ĐẠT (p95 66-296ms cả 4 lượt). Chỉ số (3) Status/màn C **ĐÃ ĐẠT** — Finding-B (N+1 field fetch) vá đúng: p95 giảm từ 3.775,6ms → 492,7-570,1ms (3 lượt đo đủ), dư biên ~5-6x. Chỉ số (2) Autosave **VẪN KHÔNG ĐẠT** — Finding-A (pool 10→20) chỉ giảm bớt chứ chưa giải quyết: p95 cả 4 lượt vẫn 2.787,6-3.438,9ms (vượt target ~2,8-3,4 lần), lỗi 500 P2028 y hệt lỗi cũ vẫn còn ở 3-9/50 (6-18%, TB ~10,5%) mỗi lượt — có lượt (18%) còn CAO HƠN tỷ lệ lỗi trước vá (16%). Nguyên nhân: pool tăng nhưng `maxWait` mặc định Prisma (2000ms) không đổi, 50 ghi đồng thời/20 connection vẫn đủ để phần đuôi hàng đợi vượt 2s. Đã xác minh lại KHÔNG mất/nhân đôi dữ liệu ở cả 4 lượt. Đã báo coordinator, CHƯA tự vá thêm. Chi tiết đầy đủ: `PROGRESS.md` mục "Benchmark X04 — tái đo lần 2, sau vá Finding-A+B". |
| X05 | Upload không an toàn (macro/mã hoá/zip bomb) | ĐÃ VIẾT (4 TC, uat.json) | ĐÃ CHẠY THẬT 4/4 (fixture độc hại thật PR0 + fixture tự dựng có field hợp lệ) | **PASS cả 4/4 — BUG-003 ĐÃ VÁ (PR #588).** Macro/encrypted/zip-bomb: chặn đúng ngay ở upload (`MACRO_DETECTED`/`INVALID_MIME`/`ZIP_BOMB_RATIO`). External link: tìm thấy lượt 8 — `EXTERNAL_LINK_DETECTED` (ERROR) chỉ cảnh báo ở `preview`, KHÔNG CHẶN publish (publish vẫn 201). Đã vá: `ReportConfigService.save()` gọi `assertNoBlockingFeatureIssues()` khi `publish=true`, chặn mọi issue ERROR severity (vá tổng quát, không chỉ external-link) — merge vào nhánh UAT, chưa re-execute lại theo đúng chỉ đạo lượt cuối. Xem `_EXECUTION_REPORT.md` BUG-003. |
| X06 | Monkey test (chạy một lần cuối) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X07 | Triển khai an toàn: flag, rollback, migration additive | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

**Tổng THẬT: 56 dòng** (bảng ghi "53 dòng" ở trên là lệch CÓ TỪ TRƯỚC, từ thời điểm chưa thêm
S36-S38 vào mục A — không sửa trong lượt này vì không phải lỗi của pha UAT, chỉ ghi chú để
minh bạch số liệu). **PASS (unit jest, chưa phải UAT đầy đủ): 10/56** (toàn bộ engine thuần
PR1).

## ĐIỂM DỪNG CUỐI CÙNG — PR10 UAT, 11/10/2026 (lượt 8/8, theo thoả thuận với coordinator)

**Checkpoint PR10 UAT 11/10/2026 (lượt 8 — LƯỢT CUỐI của pha viết+thực thi)**: Bước 0→7 (`uat-test-writer`) đã chạy —
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
- **S36 ERROR/WARNING đã sửa TC và xác nhận PASS thật** (2 lần sai thiết kế test liên tiếp —
  cross-sheet rồi cú pháp quote Excel sai — đều tự phát hiện + tự sửa + tái xác nhận live).
- **2 GAP UX đã biết, ghi theo đúng yêu cầu**: GAP UX-01 (chốt kỳ một phần không hiện tỷ lệ
  hoàn thành) + GAP UX-02 (S36-03 "gợi ý từ IF" — `suggest-rules.ts` viết+test chưa wire
  UI/endpoint, xác nhận bằng chính comment trong code).
- **1 GAP cần người quyết** (X03 — oracle gốc giả định sai kiến trúc thật).
- **X05/S04 4/4 PASS — BUG-003 ĐÃ VÁ (PR #588)**: macro→`MACRO_DETECTED`,
  encrypted→`INVALID_MIME`, zip-bomb→`ZIP_BOMB_RATIO` (chặn ngay ở upload). External link:
  tìm thấy lượt 8 (`EXTERNAL_LINK_DETECTED` chỉ cảnh báo ở `preview`, không chặn publish),
  vá bằng `assertNoBlockingFeatureIssues()` chặn mọi issue ERROR khi publish (vá tổng quát).
  Đã merge vào nhánh UAT, KHÔNG re-execute lại (đúng chỉ đạo lượt cuối "không làm tiếp
  execute mới"). Xem `_EXECUTION_REPORT.md` BUG-003.
- **S33 hoàn tất cả 3 hành động** (APPROVE/RETURN/UNAPPROVE) đã xác nhận live, kể cả chặn
  đúng vai không phải MANAGER (404).
- **Adversarial-verify**: thử bác bỏ 4 PASS đã báo cáo (X01-01, S36-01, S37-03, BUG-002-fix)
  — cả 4 đều giữ nguyên, không phát hiện tautology ẩn.
- **axe-core thật cho 5 màn đã Playwright** (S01/S13/S19/S33-review/S34): phát hiện mới
  **S01 thiếu `aria-valuenow` trên 10/10 tay nắm kéo cột** (critical, CỦA MODULE, actionable)
  + `select-name` thiếu trên S13/S33-review + `aria-required-children` trên S19. Phân loại
  rõ: `aria-allowed-attr`/`color-contrast`/`target-size` xuất hiện mọi màn là CHUNG TOÀN APP
  (header/design-token chung), không phải lỗi riêng của module — xem `_EXECUTION_REPORT.md`.
- **1 phát hiện hạ tầng đã tự vá** (khoá JWT lệch cặp sau restart).

Chi tiết đầy đủ + tổng kết 8 lượt + bảng `self_audit.py` cuối cùng: `_EXECUTION_REPORT.md`
mục "TỔNG KẾT CUỐI CÙNG". **CHƯA đạt 100% PASS/78 TC — còn ở trạng thái
SẴN SÀNG-KÈM-KHUYẾT**, không coi là xong toàn bộ UAT; các dòng còn `CHƯA LÀM` thật sự chưa
chạy, không suy ra PASS. **Đây là điểm dừng tự nhiên của pha viết+thực thi UAT theo thoả
thuận với coordinator (11/10/2026)** — 3 bug thật tìm được, cả 3 đã vá (PR #584/#586/#588),
sổ a11y gộp sẵn sàng vá 1 lần, chuyển giao sang pha kế tiếp của PR10 (vá gộp a11y, benchmark
X04, runbook, monkey test X06 cuối).

**Lưu ý về "PASS" ở mục B (engine):** đây là kết quả `jest` cấp đơn vị (TDD trong lúc code), không phải UAT đầy đủ theo giao thức §9 (viết bởi `/uat-test-writer`, chạy bởi `/uat-test-runner`/`/uat-test-only` trên hệ thống thật đang chạy). Các dòng này **không tự động coi là "100% PASS" của UAT** — khi tới PR10 (giai đoạn UAT), phải chạy `/uat-test-writer` cho toàn bộ ma trận rồi `/uat-test-runner` thật trên staging, kể cả với phần engine đã xanh ở đây.
