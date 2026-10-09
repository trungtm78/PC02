# Kế hoạch triển khai chi tiết: Báo cáo động (Report Builder) — PC02

**Trạng thái: APPROVED — đã qua `/plan-eng-review` + Codex outside voice 09/10/2026, mọi quyết định đã chốt theo ủy quyền AUTH-0910.**
Nguồn: brainstorming (BRD/FRD/Basic/Detail Design tại `docs/PC02_Report_Builder_Design_Package/`, 32 mockup, 40+ Excel thật) → `/plan-eng-review` (§10 R1–R22) → đây.
Thực thi theo giao thức ở §11 (AUTONOMOUS EXECUTION PROTOCOL). Trạng thái triển khai sống ở `docs/PC02_Report_Builder_Design_Package/PROGRESS.md` và `UAT-COVERAGE.md`, không phải file này — file này là spec bất biến, chỉ sửa khi phát sinh quyết định mới cần ghi lại.

## 1. Context

Hiện nay các Đội/Tổ/Cơ sở nộp số liệu thống kê bằng **file Excel làm tay**:
- Ví dụ: `docs/PC02_Report_Builder_Design_Package/excel report/Tháng 10 - Biểu mẫu Thống kê số liệu HSLN.xlsx`.
- Có 16 sheet đơn vị. Mỗi sheet là biểu 228 chỉ tiêu, trong đó 33 ô cột C mở khoá để nhập.
- Sheet TỔNG cộng bằng 228 công thức `=SUM('Đội 3:Cơ sở 2'!C6)`. **190 ô trong số đó đang ra `#REF!`** vì sheet Tổ 10 bị hỏng (đã đo lúc review kỹ thuật). Đây là bằng chứng quy trình Excel làm tay đang sai số thật.
- Không có hạn chốt, không biết tổ nào chưa nộp, không có lịch sử, phải gom file tay.

Gói thiết kế `docs/PC02_Report_Builder_Design_Package/` gồm BRD, FRD, Basic Design, Detail Design, 32 mockup, 42 AC, WBS và contract. Gói tự đánh dấu "BLOCKED" vì 4 lý do. Ba lý do đã được gỡ trong phiên này:
1. Đã khảo sát repo.
2. Đã đo khoảng 40 Excel thật cùng file HSLN.
3. Anh đã ủy quyền chốt mọi quyết định theo hướng **quản trị chặt nhất, dễ mở rộng nhất, không giảm phạm vi, được tăng phạm vi, được đổi trình tự**.

Lý do thứ tư (tài khoản thử riêng cho quản lý và người nhập) chỉ chặn khâu UAT.

**Kết quả mong muốn:**
- Module `dynamic-reports` thay quy trình Excel tay.
- Mẫu Excel được tải lên một lần; hệ thống tự sinh kỳ và khoá hạn ở phía server.
- Từng tổ nhập trên lưới giống hệt Excel, rồi nộp, được duyệt và chốt kỳ.
- Quản lý xem tổng hợp và theo dõi tổ nào chưa nộp.
- Xuất ra đúng file Excel gồm TỔNG cùng các sheet theo tổ để gửi báo cáo.

## 2. Bằng chứng đo được (định hướng thiết kế)

| Nguồn | Phát hiện | Hệ quả |
|---|---|---|
| ~40 template hệ cũ + HSLN | Hàm thực dùng chỉ có `SUM` (2.341), `IF` (88), `+ −`, tham chiếu chéo sheet, SUM 3D | Tự viết bộ tính công thức có danh sách hàm cho phép; không dùng HyperFormula (GPL/thương mại) |
| HSLN + các mẫu khác | Ô mở khoá chứa **số mẫu**, không có token; Protect Sheet không bật ở file nào | Ô mở khoá không có token **không phải lỗi chặn**, chỉ cảnh báo kèm gợi ý "đặt làm ô nhập" |
| HSLN | Đơn vị nộp là **Tổ/Đội** (1 sheet/đơn vị) | Lượt giao = báo cáo × kỳ × **tổ** |
| HSLN | Sheet TỔNG có giá trị cache do Excel tính, nhưng 190/228 ô là `#REF!` | Oracle độc lập = **tự cộng 16 sheet đơn vị bằng openpyxl**; số cache của Excel chỉ dùng cho 38 dòng còn hợp lệ (xem R11) |
| Template hệ cũ | `=IF(D10=D11+…+D16,TRUE,FALSE)` | Đây là quy tắc kiểm tra số liệu → Validation Rule |
| Lớn nhất | 258 dòng × 3 cột; 93 dòng × 53 cột; tới 54 vùng gộp ô | Dựng lưới bằng bảng HTML, không cần thư viện grid |

**Tham chiếu thị trường áp dụng:**
- **DHIS2:**
  - Loại kỳ, expiry days, lock exception (tương ứng mở khoá).
  - Data input periods và open future periods.
  - Validation rule gồm vế trái, toán tử, vế phải, mức độ và chiến lược khi thiếu giá trị.
  - Tỷ lệ nộp và tỷ lệ nộp đúng hạn.
  - Phê duyệt nhiều cấp theo cây đơn vị: approve → accept, unapprove.
  - Ghi chú cho từng ô giá trị.
- **Oracle EPM Approvals:** các trạng thái Not Started, First Pass, Under Review, Not Signed Off, Approved và promotional path.
- **SAP BPC Work Status:** mỗi trạng thái quy định ai được đặt (controlled-by) và khoá theo vùng dữ liệu.
- **OneStream:** khoá tường minh và khoá ngầm khi tầng cha đã chứng nhận (certify).

## 3. Quyết định đã chốt

| ID | Quyết định | So với tài liệu gốc |
|---|---|---|
| Lưới | Lưới giống Excel: merge, độ rộng cột, viền, font, numFmt, freeze. Mobile mở editor từng ô (S24). Thêm nút "Chỉ hiện dòng có ô nhập" cho biểu dài như HSLN (258 dòng, 33 ô nhập) | Giữ; mockup S11/S15 dạng danh sách chỉ là minh hoạ |
| Đánh dấu ô | **Token Excel** theo grammar FRD §4.4 **và chọn trên web** (quét vùng → kiểu/format/AGG/bắt buộc hàng loạt). Hai nguồn sinh cùng một `Field` (`source=TOKEN\|WEB`) | Tăng phạm vi |
| Sheet | Khi tải lên phải chọn **sheet mẫu nhập** (một hoặc nhiều). Sheet tổng dùng SUM 3D bị loại kèm cảnh báo, vì hệ thống tự tổng hợp | Tăng phạm vi |
| Quy tắc ô | Mở khoá + rỗng/literal: **cảnh báo + gợi ý "đặt làm ô nhập"** (giá trị mẫu bị bỏ). Các trường hợp còn lại giữ như FRD §4.3 | Sửa FR-002 theo dữ liệu thật |
| D01 | Loại kỳ: `DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, YEARLY, ONE_TIME`. ONE_TIME tạo đúng một kỳ | Tăng phạm vi (thêm hằng ngày, nửa năm, năm) |
| D02 | **Ngày đầu kỳ tuỳ chỉnh** (ví dụ tháng 21→20). Hạn có 2 kiểu: `FIXED_IN_PERIOD` (ngày/giờ trong kỳ hiện tại hoặc kế tiếp) hoặc **`DAYS_AFTER_END`** (N ngày sau khi kỳ kết thúc + giờ). Mở nhập: đầu kỳ, N ngày trước hạn, hoặc open future periods. Tuỳ chọn **dời hạn khỏi ngày nghỉ** (`CalendarEvent` scope=SYSTEM) | Tăng phạm vi; v1 gốc không dời ngày nghỉ |
| D03 | Tổng hợp có 3 chế độ: **mặc định `SUBMITTED`** (đã nộp + đã duyệt), `APPROVED` (số chốt), `ALL_SAVED` (tạm tính, luôn có nhãn "Tạm tính"). **Ô trống tính là 0** (`blankPolicy=ZERO` mặc định, từng field chuyển được sang `IGNORE` để có hành vi của FRD). Kho dữ liệu vẫn lưu null để tính "mức điền" | Đổi FR-013/FR-025 theo quyết định của anh |
| D04 | **Nộp xong là khoá.** Quản lý **Duyệt / Trả lại (bắt buộc lý do và hạn sửa) / Huỷ duyệt**. **Chốt kỳ** khoá cả kỳ và tạo snapshot chính thức. Sửa sau khi chốt phải tạo **revision điều chỉnh** và giữ snapshot cũ (FRD §6.3). Mô hình có `approvalLevel` để mở rộng phê duyệt nhiều cấp theo `Team.parentId` | Đổi FR-023 theo quyết định của anh, tăng phạm vi |
| D05 | Bắt buộc hỗ trợ công thức. Danh sách cho phép: `+ − * /`, `&`, so sánh, `SUM AVERAGE MIN MAX COUNT ROUND IF AND OR ABS`, tham chiếu A1/vùng/chéo sheet (kể cả sheet phụ tĩnh). Không eval, có phát hiện vòng lặp và timeout. Tính hai tầng như FRD §4.5. Chia cho 0 hiện "Không tính được". Ô tham chiếu kiểu NONE hiện "Thiếu dữ liệu để tính" | Chốt |
| D06 | Lượt giao = **báo cáo × kỳ × Tổ**. Người nhập của tổ mặc định là tổ trưởng (`UserTeam.isLeader`), thêm/bớt được. Nhiều người cùng sửa thì xử lý bằng revision + 409. Enum `ReportingUnit {TEAM, USER}`: hiện thực TEAM, chế độ USER để giai đoạn sau | Đổi theo dữ liệu thật |
| D07 | Ô **mặc định không bắt buộc**, đặt bắt buộc theo ô hoặc vùng. Khi nộp, hiện "N ô để trống sẽ tính là 0" để người nhập xác nhận. Mở khoá gồm 4 kênh: grant (mặc định giờ máy chủ + 3 giờ, qua nửa đêm sang ngày sau), **tổ xin mở lại → quản lý duyệt hoặc từ chối**, **mở khoá hàng loạt**, thu hồi. Grant không đổi hạn gốc và không xoá cờ trễ hạn | Đổi mặc định bắt buộc, tăng phạm vi |
| D08 | Ngày 29–31 không tồn tại thì lấy ngày cuối tháng. Kỳ quý chọn tháng thứ 1/2/3 và ngày. Tuần theo ISO week-year. Preview tối thiểu 6 kỳ | Giữ |
| D09 | Đổi mẫu/lịch/phân công **áp dụng ngay cho kỳ đang chạy nếu chưa tổ nào có số**; nếu đã có số thì áp dụng từ kỳ kế tiếp. Điều chỉnh giữa kỳ (thêm tổ, miễn nộp) bắt buộc lý do, xác nhận tác động lên mẫu số và lưu lịch sử | Đổi một phần theo quyết định của anh |
| D10 | Quyền mới: `read:DynamicReport` (vào module), `manage:DynamicReport` (thiết lập), `admin:DynamicReport` (xem toàn bộ, huỷ chốt kỳ, miễn nộp). Vai trò theo báo cáo: **≥1 MANAGER** (duyệt, mở khoá) và **VIEWER** (lãnh đạo chỉ xem). **Không ai sửa hộ số liệu**, kể cả ADMIN. Quyền ghi tính từ assignment thật | FR-011 "đúng một quản lý" đổi thành "≥1" |
| Xuất | Tổ xuất sheet mẫu của tổ mình. Quản lý xuất **workbook giống file mẫu** gồm TỔNG (giá trị đã tính) + 1 sheet/tổ + sheet metadata. Màn C xuất danh sách CSV/XLSX. Tất cả xuất từ snapshot revision | Yêu cầu mới của anh |
| Tăng phạm vi | **Nhập từ Excel** (xem trước khác biệt, áp thành một batch). **Validation rules** (tự gợi ý từ `IF(a=b,TRUE,FALSE)`). **Ghi chú/giải trình** theo ô và theo bản nộp. **Nhắc hạn + thông báo** trong ứng dụng. Tỷ lệ nộp và tỷ lệ đúng hạn. **"Thay đổi sau mở lại so với lần nộp đầu"** | — |

### 3.1 AC phải sửa trong gói thiết kế (để UAT lấy đúng oracle)

| AC | Bản sửa |
|---|---|
| AC-002 | Mở khoá + rỗng/literal → **cảnh báo + gợi ý**, không chặn; khoá + token, công thức ở ô mở khoá, ô nhập bị ẩn → vẫn chặn xuất bản |
| AC-011 | ≥1 quản lý; ≥1 tổ phải nộp; mỗi tổ ≥1 người nhập đang hoạt động; không trùng |
| AC-013 | Mặc định chế độ `SUBMITTED`, nhãn "Đã nộp X/Y · Đã duyệt Z/Y". `ALL_SAVED` luôn gắn nhãn "Tạm tính" |
| AC-023 | Nộp thì khoá; chỉ Trả lại hoặc mở khoá mới sửa tiếp được. Thiếu ô bắt buộc hoặc vi phạm validation rule mức ERROR → không cho nộp |
| AC-025 | `blankPolicy=ZERO`: 10, 0, null → SUM 10, AVG 3,33, COUNT 2 (COUNT đếm ô có giá trị). `IGNORE`: SUM 10, AVG 5, COUNT 2 (đúng FRD) |
| AC-009 | ONE_TIME giữ nguyên; thêm AC mới cho DAILY |
| Mọi AC nói "người" | Đọc là "tổ (lượt giao)"; người nhập là thành viên được chỉ định của tổ |

### 3.2 Máy trạng thái bản nộp

`NOT_STARTED → DRAFT → SUBMITTED → APPROVED`
- `SUBMITTED → RETURNED` (quản lý trả lại kèm lý do và `returnDueAt`).
- `RETURNED → (lưu) → SUBMITTED`.
- `APPROVED → SUBMITTED` (huỷ duyệt, kèm lý do).
- Kỳ `FINALIZED` khoá tất cả; tạo `ADJUSTMENT` revision nếu được `admin:DynamicReport` mở chốt.

**Được ghi** khi thoả đủ các điều kiện sau:
- Là người nhập của assignment.
- `state ∈ {NOT_STARTED, DRAFT, RETURNED}`.
- Kỳ chưa FINALIZED.
- Tài khoản đang hoạt động.
- Thời điểm hợp lệ: `opensAt ≤ now_db < dueAt`, **hoặc** có grant ACTIVE, **hoặc** (RETURNED và `now_db < returnDueAt`).

Server kiểm tra trong transaction, đọc `now()` của DB ngay sát lúc commit; nếu phải chờ khoá hàng thì lấy lại `now` sau khi có khoá (Detail Design §Quyền ghi).

**Các chiều trạng thái độc lập ở màn C:**
- Tiến độ: Chưa bắt đầu / Đang nhập / Đã nộp / Đã duyệt / Bị trả lại.
- Quyền nhập: Chưa mở / Đang mở / Đã khoá / Mở lại.
- Đúng hạn: Chưa đến hạn / Nộp đúng hạn / Nộp trễ / Quá hạn chưa nộp.
- Nghĩa vụ: Phải nộp / Miễn.

## 4. Kiến trúc

Toàn bộ nằm trong backend hiện có, module `backend/src/dynamic-reports/`, route `/api/v1/bao-cao-dong/*`. Tên này tránh trùng `@Controller('reports')` và feature key `reports` đã có. Frontend là `frontend/src/features/dynamic-reports/`, menu section `reports` thêm nhóm "Báo cáo động" gồm 3 mục: Thiết lập báo cáo / Nhập & tổng hợp / Tình trạng nhập liệu.

### 4.1 Engine thuần (`now` truyền vào, không I/O)

| Engine | Vị trí | Nội dung |
|---|---|---|
| `period` | `dynamic-reports/engine/period/` | ScheduleRule + now → danh sách kỳ: periodKey (ISO week-year…), start/end (date-only), opensAt, dueAt (UTC). Xử lý ngày đầu kỳ tuỳ chỉnh, DAYS_AFTER_END, dời ngày nghỉ, cuối tháng. Câu mô tả tiếng Việt cho S05–S08 |
| `token` | `engine/template/token.ts` | Grammar FRD §4.4: alias Num/AGV, kiểm tra kiểu và AGG tương thích, chuẩn hoá format ngày/giờ, mã lỗi |
| `template-parser` | `engine/template/parser.ts` | exceljs Workbook → `Layout` (thứ tự sheet, used range, merge, widths/heights, font/fill/border/align/wrap, numFmt, freeze, print area, hidden) + effective locked (resolve style kế thừa) + phân loại ô + `issues[]` (Sheet!Cell, mã, nguyên nhân, cách sửa). Phát hiện ảnh, conditional formatting, chart, pivot, named range, external link, data connection, macro. Phát hiện date system 1900/1904. Gợi ý nhãn từ tiêu đề dòng/cột |
| `expr` | `engine/expr/` | Tokenizer → AST → evaluator theo danh sách hàm cho phép; đồ thị phụ thuộc, phát hiện vòng lặp, giới hạn bước tính; tham chiếu chéo sheet. Dùng chung cho công thức ô và validation rule. Có hàm `PREV(ref)` cho rule so với kỳ trước |
| `decimal` | `engine/decimal.ts` | `decimal.js` (dependency mới). Chuỗi decimal chuẩn, precision ≤18, scale ≤4; parse vi-VN (`1.234,50` / `1234,50`), báo lỗi khi mơ hồ |
| `values` | `engine/values.ts` | Validate theo kiểu NUM/TEXT/DATE/TIME + min/max/scale/maxLength; DATE ISO date-only; TIME HH:mm; TEXT giữ nguyên, có giới hạn |
| `aggregate` | `engine/aggregate.ts` | Tính hai tầng, blankPolicy, SUM/AVG/MIN/MAX/COUNT/NONE, danh sách nguồn đóng góp và mẫu số |
| `access` | `engine/access.ts` | (assignment, state, grants, returnDueAt, period, user, now) → `{canEdit, effectiveLockAt, reason}` |
| `status` | `engine/status.ts` | Các chiều trạng thái + KPI (FRD §7.2–7.3, đã sửa theo D04) |
| `paste` | `engine/paste.ts` (dùng chung FE/BE qua copy có cổng kiểm) | TSV → patch theo vị trí; từ chối nguyên khối nếu có ô khoá hoặc lỗi |

### 4.2 Dịch vụ NestJS

- `TemplateService`: tải lên, chạy parse trong **worker thread** có timeout và giới hạn bộ nhớ, validate, preview, đánh dấu ô trên web.
- `ReportConfigService`: nháp, CAS, xuất bản (idempotency key), phiên bản, sao chép cấu hình, ngừng phát sinh, D09.
- `PeriodScheduler`: cron, idempotent `unique(reportId, periodKey)`, bù kỳ sau downtime, không sinh kỳ quá khứ trước `effectiveFrom`.
- `SubmissionService`: lưu, nộp, nhập Excel. Có CAS `expectedRevision` và idempotency `(actor, action, key)` với request hash, TTL 24h, `IDEMPOTENCY_MISMATCH`.
- `ReviewService`: duyệt, trả lại, huỷ duyệt, chốt kỳ, mở chốt (ADJUSTMENT).
- `UnlockService`: grant, request, duyệt/từ chối request, bulk, revoke, tự chuyển sang EXPIRED.
- `AdjustmentService`: thêm tổ hoặc miễn nộp giữa kỳ, có lý do và tác động lên mẫu số.
- `AggregateService`: snapshot theo `sourceHash` (period + version + mode + vector revision), vô hiệu hoá khi lưu, nộp, duyệt, đổi assignment; đánh dấu snapshot sai và tạo snapshot sửa.
- `StatusQueryService`: LEFT JOIN từ assignment, chụp `asOf` một lần, filter/sort theo allowlist, pageSize 25 (tối đa 100).
- `ExportService`: ExportJob chụp vector trước khi chạy, dựng file bằng exceljs từ template bất biến, lưu riêng tư, tải qua API có kiểm quyền lại, TTL 24h, chạy lại khi lỗi.
- `CommentService`.
- `ReminderScheduler`: nhắc trước 3 ngày/24h/3h chỉ tổ chưa nộp, chống trùng, kiểm quyền lại lúc gửi.
- `ClockController` `GET /bao-cao-dong/clock`.

**Mã lỗi** (`backend/src/common/constants/` theo quy ước WIRE FORMAT): `TEMPLATE_INVALID, PARSE_TIMEOUT, REPORT_LOCKED, REVISION_CONFLICT, CELL_VALIDATION, VALIDATION_RULE_FAILED, IDEMPOTENCY_MISMATCH, FORBIDDEN (404 chống dò), EXPORT_FAILED, RATE_LIMITED, INVALID_STATE_TRANSITION`.

Phản hồi lỗi 422 có cấu trúc `{code, message, errors[{fieldId, sheet, cell, code, message}], correlationId}`. Phản hồi khi lưu thành công: `{assignmentId, revision, state, savedAt, serverTime, effectiveLockAt, editable, fieldErrors, ruleViolations}`.

### 4.3 Mô hình dữ liệu (Prisma, migration chỉ thêm mới, FK không cascade xoá)

| Model | Trường và ràng buộc chính |
|---|---|
| `DynReport` | code unique, name, description, status `DRAFT/PUBLISHED/SUSPENDED/ARCHIVED`, reportingUnit, effectiveFrom, configVersion (CAS), createdBy |
| `DynReportVersion` | reportId, version, status `DRAFT/PUBLISHED/RETIRED`, fileBytes, sha256, fileName, selectedSheets, layout Json, dateSystem, parserVersion, engineVersion, issues Json, publishedAt; unique(reportId, version); bất biến sau khi xuất bản |
| `DynReportField` | versionId, sheetKey, address, fieldKey, label, type, format, aggregate, blankPolicy, required, min/max (Decimal), scale, maxLength, helpText, source; unique(versionId, sheetKey, address) |
| `DynReportFormula` | versionId, sheetKey, address, expression, ast Json, deps |
| `DynReportValidationRule` | versionId, name, leftExpr, operator (gồm compulsory/exclusive pair), rightExpr, severity `ERROR/WARNING`, message, missingStrategy, origin `MANUAL/SUGGESTED_FROM_IF` |
| `DynReportSchedule` | reportId, periodType, startAnchor, dueRule Json, openRule Json, shiftNonWorking, timezone, effectiveFrom, supersededAt |
| `DynReportRole` | reportId, userId, role `MANAGER/VIEWER`, validFrom/To |
| `DynReportTarget` / `DynReportTargetEditor` | tổ phải nộp và người nhập của tổ, validFrom/To |
| `DynReportPeriod` | reportId, periodKey, startDate, endDate, opensAt, dueAt, versionId, scheduleSnapshot, status `OPEN/FINALIZED`, finalizedAt/By; unique(reportId, periodKey) |
| `DynReportAssignment` (+ `…Editor`) | periodId, teamId, teamSnapshot, obligation `REQUIRED/EXEMPT`, exemptReason/By/At, addedMidPeriodReason; unique(periodId, teamId) |
| `DynReportSubmission` | assignmentId unique, state, currentRevision, values Json `{fieldKey:{t,v}}`, firstSavedAt, firstSubmittedAt, firstSubmittedRevision, submittedAt, approvedAt/By, returnedReason, returnDueAt |
| `DynReportRevision` | submissionId, revision, kind `SAVE/IMPORT/SUBMIT/RETURN/APPROVE/UNAPPROVE/ADJUSTMENT`, values Json, diff Json, actorId, reason, committedAt; unique(submissionId, revision); bất biến |
| `DynReportUnlock` | assignmentId, kind `GRANT/REQUEST`, status `PENDING/ACTIVE/REJECTED/REVOKED/EXPIRED`, startsAt, expiresAt, reason, requestedBy, decidedBy, decisionReason, revokedBy/Reason, bulkBatchId |
| `DynReportComment` | assignmentId, fieldKey?, body, authorId, createdAt |
| `DynReportSnapshot` | periodId, mode, sourceHash, sourceRevisions Json, values Json, engineVersion, asOf, invalidatedAt/Reason, official |
| `DynReportExport` | requestedBy, kind, scope Json, snapshotId, status, fileBytes, expiresAt, error |
| `DynReportIdempotency` | actorId, action, key, requestHash, resultRef, expiresAt; unique(actorId, action, key) |

Audit đi qua `AuditService.log(…, tx)` ở mọi thao tác: xuất bản, phân công, lưu, nộp, duyệt, trả lại, grant, revoke, request, chốt kỳ, miễn nộp, xuất file. Audit dữ liệu chỉ ghi diff theo fieldKey và revision, không ghi toàn bộ giá trị vào log vận hành.

Thêm giá trị vào enum `NotificationType` qua migration. Thêm enum Prisma và nhãn tiếng Việt vào `frontend/src/shared/enums/status-labels.ts` (`npm run gen:enums`); cấm so sánh bằng chuỗi literal.

## 5. Dùng lại từ repo

- `backend/src/xlsx-imports/hostile-xlsx-guard.ts`: `assertMagicBytes`, `assertCompressedSize`, `assertNoZipBomb`, `assertWorkbookLimits`, `throwIfAborted`, `computeSha256`.
- `backend/src/common/utils/xlsx-formula-escape.util.ts` (`escapeXlsxCell`): xuất TEXT an toàn.
- `backend/src/common/bca-excel.helper.ts`: khối tiêu đề BCA cho sheet metadata khi xuất.
- `backend/src/document-numbers/period-key.util.ts` (`computePeriodKey`, Intl Asia/Ho_Chi_Minh) và `backend/src/common/utils/thong-ke-ky.util.ts` (mẫu hàm thuần có tiêm `now`).
- `backend/src/document-templates/*`: upload multer, lưu bytes/sha trong DB, endpoint `detect` để preview.
- `backend/src/edit-window/`: khuôn luồng "xin mở lại → duyệt/từ chối".
- `backend/src/cases/cases.service.ts` (~2354, 409 khi `expectedUpdatedAt` lệch) và `backend/src/audit/audit.service.ts` `logBulkHeader` (unique actor+key, bắt P2002): khuôn CAS và idempotency.
- `backend/src/notifications/notification-event.service.ts` (`@OnEvent` → `sendInApp`) cùng `NotificationSseService`.
- `@RequirePermissions` + `PermissionsGuard`; `backend/prisma/seed-permissions.ts`; `backend/prisma/seed.ts` (cấp quyền cho vai trò); gate `backend/src/common/cong-route-co-quyen.spec.ts`.
- Feature flag: khuôn module `backend/src/event-categories/`; `backend/src/feature-flags/feature-registry.ts` (đăng ký tay, có spec ép); `@FeatureFlag` + `FeatureFlagGuard`; `backend/prisma/seed-feature-flags.ts`.
- `backend/src/teams/teams.service.ts` (`getDescendantIds`), `UserTeam.isLeader`, `unit-scope.service.ts` (phạm vi xem của VIEWER/ADMIN).
- `CalendarEvent` scope=SYSTEM cho ngày nghỉ.
- Frontend:
  - `frontend/src/features/kpi/` làm khuôn feature.
  - `lib/dates.ts`, `react-number-format`, `@tanstack/react-query`, `react-hook-form` + `zod`, `recharts`.
  - `components/shared/ListPageShell` cho S01/S19.
  - `useOChuDongBo` để giữ bộ lọc trên URL (React Router 7), khoá phân trang có tiền tố `{prefix}_page`.
  - `user-table-layouts` cho tuỳ chọn cột ở S19.

## 6. Lộ trình PR (đổi trình tự: engine thuần và lõi P0 khoá/quyền/tính đúng đi trước)

Quy trình mỗi PR: TDD → `/review` → `/codex` → backend `npx jest --no-coverage` + `npx tsc --noEmit`, frontend `npx vitest run` + `npx tsc -b` → commit → PR → merge → deploy (flag tắt) → kiểm tra health.

Làm trong **git worktree từ `main`**, vì nhánh hiện tại `fix/petition-all-column-search` có rất nhiều thay đổi chưa commit không thuộc việc này.

| PR | Phạm vi giao | Ước lượng (ngày công) |
|---|---|---|
| **0** | Spec `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md`; cập nhật gói thiết kế (D01–D10 đã chốt, bảng AC sửa §3.1, `PROGRESS.md`); fixture `backend/test/fixtures/dynamic-reports/`: HSLN, `bao_cao_ngay.xlsx`, A09, A10, PL7 cùng các file độc hại giả lập; ma trận vai trò (gate UAT-901) | 1–2 |
| **1** | Engine thuần §4.1 đủ 10 engine, unit test + property test (`fast-check`) + fixture độc lập (AGG01, RATE01, DATE01, kỳ biên) | 10–12 |
| **2** | Schema + migration; quyền + seed; feature flag `dynamic-reports`; khung module FE/BE; menu; clock endpoint; mã lỗi; idempotency; nhãn trạng thái; guard 404 chống dò | 4–5 |
| **3** | TemplateService (validate/parse trong worker, giới hạn, an toàn, chọn sheet, preview, đánh dấu ô trên web) | 6–8 |
| **4** | Màn A: S01–S10, S22, S30, S31 (ngừng phát sinh), S32 + `GridRenderer` dùng chung (chỉ đọc) | 10–12 |
| **5** | PeriodScheduler + assignment + điều chỉnh giữa kỳ + miễn nộp (BE) | 3–4 |
| **6** | Màn B người nhập: S11–S14, S24, S26, S28, S29 + S35 Nhập từ Excel + xuất bản của tổ | 12–15 |
| **7** | Màn B quản lý: S15–S18, S21, S25, S31 (thu hồi) + S33 Duyệt/Trả + S34 Xin mở lại/hàng chờ/bulk + S38 Chốt kỳ + xuất TỔNG+tổ | 12–14 |
| **8** | Màn C: S19, S20, S23, S27 + xuất danh sách | 8–10 |
| **9** | S36 Validation rules (UI soạn và gợi ý từ IF) + S37 Ghi chú/giải trình + ReminderScheduler + thông báo | 6–8 |
| **10** | Hoàn thiện: hiệu năng, a11y, responsive, giám sát, runbook, UAT, monkey test (một lần cuối), pilot HSLN | 8–10 |

Tổng khoảng **97–117 ngày công** sau review kỹ thuật (gốc ước 62–87; trước review 80–100). Phần tăng thêm gồm: R2 sinh mã engine, R12 khoá kỳ, R13 VIEWER theo phạm vi, R14 thay người nhập, R15 PREV, R21 phê duyệt nhiều cấp, R22 chế độ nộp theo người — xem §10. Có thể chạy song song: PR3 ∥ PR5 sau PR2; FE PR4 bắt đầu khi contract PR3 đã ổn định.

### 6.1 Chi tiết giao theo PR (checklist không sót yêu cầu)

**PR1 – Engine:**
- Token: các tổ hợp hợp lệ/sai, alias Num/AGV, `{NUM||SUM}`, trim, AGG không hợp kiểu → lỗi.
- Period: ví dụ FRD §5 (tuần 41/2026 → 05–11/10, khoá 09/10 17:00; T10 → 31/10; T2/2027 ngày 31 → 28/02; QIV tháng 3 ngày 25 → 25/12), tuần giao năm, năm nhuận, QIV→QI, kỳ 21→20, DAYS_AFTER_END rơi vào ngày nghỉ, DAILY, ONE_TIME, "kỳ chưa kết thúc mà đã khoá" (cảnh báo trong preview).
- Decimal: âm, 18 chữ số/4 lẻ, vượt giới hạn → lỗi; không tự làm tròn; vi-VN.
- Values: 31/02, chuỗi `12345`, năm 2 chữ số, 25:80; TEXT `=1+1` và `<script>`; số 0 đầu.
- Expr: SUM/IF/3D bị từ chối khi không thuộc sheet mẫu; vòng lặp; chia 0; hàm lạ.
- Aggregate: AGG01 với cả 2 blankPolicy; RATE01 (9/10 + 1/90 → 10%); COUNT; NONE; tập rỗng.
- Access: biên T−1ms/T/T+1ms; grant ngắn hơn hạn gốc không rút ngắn hạn; revoke; RETURNED + returnDueAt; FINALIZED; user bị vô hiệu.
- Status: KPI, mẫu số 0 → "—".
- Paste: qua merge, qua ô khoá, ngày sai → từ chối nguyên khối.

**PR2 – Nền tảng:**
- Quyền `read/manage/admin:DynamicReport` vào `SEED_PERMISSIONS` và `seed.ts`; manifest + registry; flag tắt mặc định.
- Cổng route-quyền phải xanh.
- `GET /clock`.
- Danh sách báo cáo theo `mode=input|manage|setup`: chỉ trả báo cáo có quyền; truy cập ngoài phạm vi trả 404 (AC-012, AC-035).

**PR3 – TemplateService:**
- Chỉ nhận `.xlsx`; kiểm tra magic bytes, MIME và nội dung ZIP/XML.
- Từ chối xls/xlsm/mã hoá/macro/OLE/external link/data connection.
- Giới hạn 10 MB nén / 100 MB giải nén / 5 sheet / 50.000 ô / 5.000 input; vượt thì từ chối có lý do, không cắt ô.
- Worker có timeout → `PARSE_TIMEOUT`.
- Không fetch URL; log không chứa nội dung ô.
- Giữ thứ tự sheet, merge, kích thước, style, numFmt, freeze, print area.
- **Báo trước khi xuất bản** nếu có ảnh/logo, conditional formatting, chart, pivot, named range.
- Phân loại ô theo §3; anchor của merge; ô nhập bị ẩn → lỗi.
- Gợi ý nhãn từ tiêu đề dòng/cột; bắt buộc đặt tên khi không suy được.
- API đánh dấu/bỏ đánh dấu vùng ô; gợi ý validation rule từ `IF(a=b,TRUE,FALSE)`.
- Thay file khi nháp đã có mapping → trả danh sách mapping sẽ mất để UI cảnh báo.

**PR4 – Màn A:**
- **S01:**
  - Bảng: Mã, Tên, Loại kỳ, Hạn tiếp theo, Quản lý, Số tổ, Phiên bản, Trạng thái, Cập nhật.
  - Lọc: tên/mã, loại kỳ, quản lý, trạng thái.
  - Hành động: Tạo / Xem / Sửa nháp / Tạo phiên bản / **Sao chép cấu hình** / **Ngừng phát sinh** (không tự đóng kỳ đang mở; đóng kỳ là thao tác riêng có nhật ký) / không xoá cứng khi đã có dữ liệu.
  - Trạng thái rỗng: hướng dẫn tạo mẫu đầu tiên.
- **Wizard 4 bước:**
  - Bước 1 (S02): mã unique, tên, mô tả, **tải hướng dẫn + file mẫu có token**, tiến trình, chọn sheet.
  - Bước 2 (S03/S04/S32): preview theo sheet với tab tên đầy đủ khi hover/focus và dropdown "Tất cả sheet"; màu + biểu tượng phân biệt tĩnh/nhập/fx; inspector (nhãn, kiểu, format, AGG, blankPolicy, bắt buộc, min/max, scale, maxLength, hướng dẫn) hiện raw và formatted; quét vùng để đánh dấu; drawer lỗi theo Sheet!Cell, bấm lỗi thì focus đúng ô.
  - Bước 3 (S05–S08): loại kỳ, ngày đầu kỳ, kiểu hạn, giờ, kỳ hiện tại/kế tiếp, mở nhập, dời ngày nghỉ, múi giờ; câu mô tả tiếng Việt; preview ≥6 kỳ, đánh dấu ngày bị dời hoặc lấy cuối tháng.
  - Bước 4 (S09/S10): ≥1 quản lý, VIEWER, chọn tổ (tìm theo tên/mã/đơn vị cha) và người nhập của từng tổ; loại trùng; cảnh báo tài khoản ngừng hoạt động; **chọn kỳ hiệu lực**; tổng kết toàn bộ cấu hình; Lưu nháp / Xuất bản (idempotency); không sinh kỳ quá khứ.
- **Footer cố định:** khoá nút khi đang gửi; giữ form khi mất mạng và cho thử lại; cảnh báo khi rời trang chưa lưu; không lưu dữ liệu vào localStorage.
- **S22:** danh sách phiên bản và kỳ dùng phiên bản nào; tạo phiên bản mới; tiếp tục nháp; áp quy tắc D09.
- **S30:** thêm tổ hoặc miễn nộp giữa kỳ, có lý do và preview tác động lên mẫu số. **S31:** ngừng phát sinh.
- **Bản nháp:** người nhập không thấy.

**PR5 – Lịch và phân công:**
- Cron + bù kỳ sau downtime.
- `unique(reportId, periodKey)`; assignment `unique(periodId, teamId)`.
- Chụp snapshot lịch, phiên bản và danh sách tổ lúc sinh kỳ.
- Không sinh trùng assignment hay thông báo khi job chạy lại.
- Tài khoản bị vô hiệu: chặn ghi ngay nhưng nghĩa vụ vẫn còn; miễn nộp cần sự kiện quản trị.

**PR6 – Màn B người nhập:**
- **Thanh trên:** combo báo cáo có tìm kiếm; kỳ kèm khoảng ngày; trạng thái; hạn đầy đủ + đếm ngược theo giờ máy chủ. Mặc định chọn kỳ đang mở gần hạn nhất, nếu không có thì kỳ mới nhất. Báo cáo/kỳ rỗng thì hướng dẫn liên hệ quản lý. Có công tắc chế độ "Báo cáo tôi nhập / Báo cáo tôi quản lý".
- **Lưới:**
  - Tab sheet; hiện địa chỉ ô; zoom 80/100/125; vừa chiều rộng và toàn màn hình; cố định tiêu đề và cột nhãn.
  - Ô tĩnh nền trung tính; ô nhập viền rõ + chữ "Có thể nhập"; ô công thức có fx; không dùng màu làm tín hiệu duy nhất.
  - Tab/Enter chỉ đi qua ô nhập, bỏ qua ô khoá và ô gộp phụ.
  - Cuộn ngang thay vì co chữ; chỉ một vùng cuộn chính.
  - Nút "Chỉ hiện dòng có ô nhập".
- **Editor theo kiểu (S28):** NUM theo vi-VN có chú thích cách nhập; DATE có picker và gõ được, không lệch ngày vì timezone; TIME 24h. Lỗi hiện ngay ô (aria-describedby) và trong drawer tổng; bấm lỗi thì focus ô.
- **Thanh trạng thái:** "Đã lưu lúc …" qua live region; số ô bắt buộc đã điền; các nút Lưu nháp / Kiểm tra / Nộp. Autosave sau 2 giây ngừng nhập và khi blur. Giá trị sai không gửi lên.
- **Dán TSV** nguyên tử. TEXT bắt đầu bằng `=` vẫn là text.
- **Nộp (S29):** chờ autosave xong; xác nhận "N ô trống tính là 0"; rule ERROR thì chặn, WARNING thì yêu cầu xác nhận.
- **Hết hạn (S13):** chuyển sang chỉ đọc + banner "Đã khoá lúc …". Server từ chối nguyên batch thì giữ bộ đệm trong bộ nhớ, hiện "Thay đổi này chưa được lưu do hết hạn".
- **Được mở lại (S14):** hiện "Được nhập lại đến … · Hạn gốc vẫn là …". Tải lại quyền và yêu cầu người dùng xem lại bộ đệm, không tự gửi lại.
- **Mất mạng / 409 (S26):** dialog so sánh bản server với thay đổi chưa lưu; retry với cùng key; lưu các batch nối tiếp.
- **Nhiều tab:** làm mới quyền khi tab được focus, có polling nhẹ.
- **Trạng thái tải:** skeleton đúng trang đích ngay khi chuyển route.
- **Mobile (S24):** editor từng ô.
- **S35 Nhập từ Excel:** khớp theo địa chỉ ô, xem trước khác biệt, áp nguyên tử, revision kind=IMPORT.
- **Xuất bản của tổ:** sheet mẫu + giá trị + kết quả công thức + tiêu đề kỳ.

**PR7 – Màn B quản lý:**
- **Combo:** chỉ báo cáo mình là MANAGER hoặc VIEWER; kỳ bắt buộc.
- **Mặc định S15 Tổng hợp + "Tất cả tổ":**
  - Thanh tóm tắt: đã nộp X/Y, đã duyệt, có dữ liệu, quá hạn, chế độ tính.
  - Đổi chế độ `SUBMITTED/APPROVED/ALL_SAVED`.
  - Ô NONE hiện "— / Không tổng hợp".
  - Không có nút sửa hoặc lưu.
- **S16 Xem bản của một tổ** (chỉ đọc, cùng phiên bản): lưu lần cuối, trạng thái, hạn gốc, hạn mở lại, lịch sử. Tổ chưa nhập hiện template trống, không báo "không tìm thấy".
- **S18 Nguồn số liệu:** giá trị từng tổ, revision, thời điểm, trạng thái, mẫu số AVG/COUNT; đọc từ snapshot.
- **S33 Duyệt / Trả lại / Huỷ duyệt:** đơn lẻ và hàng loạt.
- **S17 Mở khoá:**
  - Thông tin báo cáo/kỳ/tổ cố định, không đổi ngầm.
  - Mặc định giờ máy chủ + 3 giờ, qua ngày; không cho thời điểm quá khứ; lý do bắt buộc.
  - Câu preview "Cho phép … sửa … đến …".
- **S34:** hàng chờ yêu cầu mở lại; mở khoá hàng loạt.
- **S31 Thu hồi:** có lý do.
- **S38 Chốt kỳ / mở chốt** (admin, ADJUSTMENT).
- **S21 Lịch sử/audit:** chỉ đọc; diff theo ô; "thay đổi so với lần nộp đầu".
- **S25 Xuất:**
  - Job + trạng thái + retry.
  - Workbook TỔNG + 1 sheet/tổ (tên theo tổ, thứ tự theo cây tổ) + sheet metadata (kỳ, phiên bản, chế độ, vector nguồn, thời điểm).
  - Xử lý date system; TEXT xuất dạng string.
  - Tải qua API có kiểm quyền; TTL 24h; không có URL công khai.

**PR8 – Màn C:**
- **Dòng 1:** "Dữ liệu cập nhật lúc …", Làm mới, Xuất danh sách.
- **Bộ lọc:** báo cáo hoặc tất cả, loại kỳ, kỳ hoặc khoảng kỳ, đơn vị (cây tổ), người nhập, quản lý, tiến độ, tình trạng hạn, đang mở lại. Bộ lọc nâng cao trong drawer (S27). Giữ bộ lọc trên URL khi quay lại.
- **Thẻ KPI** bấm được để lọc: Phải nộp / Đã nộp / Đã duyệt / Đang nhập / Chưa bắt đầu / Quá hạn / Đang mở lại. Có chú thích chỉ số chồng lấp; tỷ lệ đúng hạn; độ phủ dữ liệu; mẫu số 0 → "—"; kỳ tương lai hiện tách riêng.
- **Biểu đồ:** cột theo đơn vị + xu hướng giữa các kỳ cùng loại; tooltip ghi tử/mẫu; không dùng donut; thu gọn được.
- **Bảng:**
  - Cột: Báo cáo, Kỳ (khoảng ngày thật khi trộn loại kỳ), Tổ, Đơn vị cha, Mức điền, Tiến độ, Hạn gốc, Khoá lại lúc, Nộp lúc, Duyệt lúc, Cập nhật cuối, Số lần mở lại, Thay đổi sau mở lại, Thao tác.
  - Sắp xếp mặc định: quá hạn chưa nộp trước, rồi sắp đến hạn.
  - Tuỳ chọn cột; phân trang ở server.
  - Bấm dòng → drawer lịch sử + link sang B đúng báo cáo/kỳ/tổ.
- **S20 Ma trận:** ≤12 cột, nhiều hơn thì chuyển sang bảng; phân biệt "Không giao" với "Chưa nhập"; tooltip hạn.
- **Xuất:** CSV/XLSX dùng cùng filter, quyền và `asOf`.
- **Trạng thái màn (S23):** loading/empty/error/forbidden cho cả module; không hiện số cũ như số mới; không lộ số tổng ngoài phạm vi.

**PR9 – Mở rộng phạm vi:**
- **S36 Validation rules:** soạn quy tắc, nhận gợi ý từ IF; mức ERROR chặn nộp, WARNING cần xác nhận; hiện vi phạm ở drawer.
- **S37 Ghi chú:** theo ô và theo bản nộp.
- **ReminderScheduler:** nhắc trước 3 ngày/24h/3h chỉ tổ chưa nộp; chống trùng; kiểm quyền lại.
- **Thông báo** khi trả lại / duyệt / mở khoá / có yêu cầu mở lại / chốt kỳ.

**PR10 – Hoàn thiện:**
- **Benchmark:** 5.000 input, 200 tổ, 50 ghi đồng thời; p95 mở form ≤3s, lưu ≤1s, tổng hợp/màn C ≤3s; ghi rõ cấu hình môi trường đo.
- **Visual QA:** 1440/1366/1024/768.
- **Bàn phím/WCAG AA:** focus nhìn thấy, tooltip mở được bằng bàn phím.
- **Metric vận hành:** tỷ lệ parse lỗi, tỷ lệ lưu lỗi/409, số request bị chặn sau hạn, grant đang hiệu lực, độ trễ job/số kỳ sinh trùng, thời gian tổng hợp/xuất, chênh lệch đối soát. Log có correlation id.
- **Runbook:** rollback (tắt flag, giữ dữ liệu), backup + thử restore.
- **UAT:** UAT-001…042 (đã sửa theo §3.1) + ca cho phạm vi tăng; UAT-903 walkthrough mọi Screen ID; UAT-905 ký nghiệm thu.
- **Monkey test** chạy một lần ở cuối.
- **Pilot HSLN tháng:** đo các chỉ số lợi ích trong BRD (thời gian thiết lập một mẫu, tỷ lệ nhập sai kiểu, thời gian đối soát, số lần phải nhắc việc).

## 7. Ma trận truy vết (không sót)

| FR/AC | PR | FR/AC | PR | FR/AC | PR |
|---|---|---|---|---|---|
| 001 Tải mẫu | 3, 4 | 015 Mở lại theo tổ | 1, 7 | 029 Bộ lọc kỳ | 8 |
| 002 Locked/input | 1, 3 | 016 Mặc định +3h | 1, 7 | 030 Trạng thái/KPI | 1, 8 |
| 003 Grammar | 1, 3 | 017 Grant hết hạn/thu hồi | 1, 7 | 031 Drilldown/ma trận | 8 |
| 004 Bố cục | 3, 4, 6 | 018 NUM | 1, 6 | 032 Phiên bản | 4, 5 |
| 005 Gộp/ẩn | 1, 3 | 019 DATE/TIME | 1, 6 | 033 Audit | 2, 5, 6, 7 |
| 006 Tuần | 1, 4 | 020 TEXT an toàn | 1, 6, 7 | 034 Xuất Excel | 6, 7, 8 |
| 007 Tháng | 1, 4 | 021 Dán | 1, 6 | 035 Hai vai trò | 2, 6, 7 |
| 008 Quý | 1, 4 | 022 Autosave | 6 | 036 Trạng thái UI | 4, 6, 7, 8, 10 |
| 009 Ngày chính xác | 1, 4 | 023 Nộp | 1, 6 | 037 Bàn phím/responsive | 6, 10 |
| 010 Khoá server | 1, 6 | 024 Đồng thời | 6 | 038 Hiệu năng | 10 |
| 011 Phân công | 4 | 025 SUM/AVG/null | 1, 7 | 039 Upload không an toàn | 3 |
| 012 Combo theo quyền | 2 | 026 NONE | 1, 3, 7 | 040 Job/timezone | 1, 5 |
| 013 Mặc định tổng hợp | 7 | 027 Công thức 2 tầng | 1, 7 | 041 Thay phân công | 4, 5 |
| 014 Xem tổ chỉ đọc | 7 | 028 Mọi lượt giao | 8 | 042 Triển khai an toàn | 2, 10 |

**Màn hình:**
- S01–S10, S22, S30, S32 → PR4; S31 → PR4 + PR7.
- S11–S14, S24, S26, S28, S29 → PR6.
- S15–S18, S21, S25 → PR7.
- S19, S20, S27 → PR8.
- S23 → PR4/6/7/8, gate ở PR10.
- Màn mới: S33, S34, S38 → PR7; S35 → PR6; S36, S37 → PR9.

**BR:**
- BR-01 → PR1/3/4; BR-02 → PR1/4/5/6; BR-03 → PR2/4; BR-04 → PR1/7.
- BR-05 → PR7; BR-06 → PR1/6; BR-07 → PR6; BR-08 → PR8.
- BR-09 → PR4/5/7; BR-10 → PR2/10.

**Gate:** UAT-901 → PR0; UAT-902 (IT-902 spike engine) → PR1; UAT-903 → PR10; UAT-904 (IT-904 migration) → PR2; UAT-905 → PR10.

## 8. Kiểm chứng

- **Oracle độc lập theo nghiệp vụ (không lấy kết quả mong đợi từ code):**
  - Nạp 16 sheet tổ của file HSLN thành 16 bản nộp, chạy tổng hợp, so **từng ô** với **giá trị cache Excel trong sheet TỔNG** (sinh fixture bằng openpyxl `data_only=True`).
  - Fixture theo Detail Design: AGG01, RATE01, DATE01 (1900/1904 cùng ngày hiển thị), LOCK01 (chờ khoá hàng vượt hạn → bị chặn), VERSION01 (kỳ cũ vẫn render v1 sau khi xuất bản v2).
- **Thời gian:** đồng hồ điều khiển được, đủ các biên đã liệt kê ở PR1. Chạy lại job sau downtime không sinh trùng.
- **Bảo mật:** gọi API trực tiếp bằng danh tính khác (đổi assignment/period/cell, thêm thuộc tính lạ, URL xuất không có quyền, quản lý cố PATCH, VIEWER cố ghi, request mở lại vào tổ khác) → 403/404, revision không đổi. Gate `cong-route-co-quyen.spec.ts` phải xanh.
- **Lệnh chạy:**
  - `cd backend && npx jest --no-coverage && npx tsc --noEmit`
  - `cd frontend && npx vitest run --no-coverage && npx tsc -b`
  - Playwright API/E2E trên PostgreSQL 18 @127.0.0.1:5433 với `UAT_DATABASE_URL` cô lập.
- **Chạy thật (`/run`):**
  1. Tải HSLN → chọn sheet "Đội 3" → "đặt 33 ô làm NUM·SUM" → kỳ tháng, hạn 5 ngày sau kỳ.
  2. Phân 3 tổ → xuất bản.
  3. Hai tài khoản tổ nhập (dán TSV, nhập từ Excel) → nộp.
  4. Quản lý duyệt một tổ, trả lại một tổ, mở khoá tổ thứ ba sau hạn.
  5. Xuất TỔNG + từng tổ → so với file mẫu.
  6. Xuất bản v2 → kỳ cũ vẫn hiện v1.
- **UAT:** `/uat-test-writer` lấy oracle từ FRD + §3.1 → `/uat-test-only` trên môi trường thật. **Chờ anh cấp tài khoản quản lý và người nhập riêng** (5 tài khoản thử cũ đã khoá).
- **Deploy:** flag tắt → `db:seed:features` → health → bật flag cho nhóm pilot → đối soát một chu kỳ → mở rộng.

## 9. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Sai ô nhập do style kế thừa | Resolve effective protection; golden test theo từng Sheet!Cell |
| Lưới lệch Excel | Visual QA template thật ở 4 viewport |
| Lách hạn qua API | Giờ DB trong transaction; LOCK01 |
| Mất cập nhật do nhiều tab | CAS + idempotency; test 2 tab |
| Decimal lần đầu dùng trong repo | Mọi phép tính qua `engine/decimal.ts`; API trao đổi số dạng chuỗi |
| Parser treo vì file độc | Worker thread, timeout, giới hạn bộ nhớ |
| Sai công thức sau khi chốt | Đánh dấu snapshot vô hiệu + tạo snapshot sửa + audit; không ghi đè lịch sử |
| Rollback | Tắt flag, giữ dữ liệu và revision, không drop bảng; autosave không được báo thành công khi module tạm dừng |

## 11. Giao thức thực thi (AUTONOMOUS EXECUTION PROTOCOL do anh ban hành 09/10/2026)

- **Không dừng hỏi.** Chỉ dừng theo §8 của giao thức: (a) xong toàn bộ và UAT 100% PASS; (b) blocker thật sau khi đã thử ít nhất 2 phương án; (c) thao tác không hoàn tác được hoặc có rủi ro bảo mật (push lên `main`, ghi prod, migration prod, deploy). Riêng (c) phải xin xác nhận.
- **Vòng mỗi task:**
  1. `superpowers:writing-plans` → `superpowers:executing-plans`
  2. TDD RED → GREEN → REFACTOR
  3. Đủ DoD 6 mục: AC, patch coverage ≥90% line, full suite xanh, lint/tsc/build sạch, không TODO/code chết, đã cập nhật PROGRESS
  4. `superpowers:verification-before-completion` → `/review` → `/codex`
  5. Commit → sang task kế tiếp
- **Mỗi milestone (= một PR ở §6):** chạy `/plan-eng-review` đối chiếu code với spec gốc; lệch thì sửa và chạy lại.
- **Chuẩn code của module này:**
  - Định danh, comment và commit message bằng **tiếng Anh**.
  - **Không hardcode chuỗi hiển thị**: khoá i18n theo namespace `dynamicReports.<screen>.<action>.<state>`, resource `vi` là bản chính.
  - Mã lỗi từ server dịch ở frontend.
  - Đây là quy định riêng cho module này theo giao thức của anh. Các phần code cũ của PC02 giữ nguyên thói quen.
- **Assumption A1 – bảo toàn dữ liệu:** `PROGRESS.md` và `UAT-COVERAGE.md` ở gốc repo đang theo dõi việc khác. Vì vậy nguồn sự thật của module này là **`docs/PC02_Report_Builder_Design_Package/PROGRESS.md`** (file của gói thiết kế, cùng mẫu §7) và **`docs/PC02_Report_Builder_Design_Package/UAT-COVERAGE.md`**. Không ghi đè file ở gốc repo.
- **Assumption A2 – nơi làm việc:** git worktree `../pc02-dynamic-reports` trên nhánh `feat/dynamic-reports-m1-…` tách từ `origin/main`. Nhánh hiện tại có khoảng 1.000 file thay đổi chưa commit, không được động vào.
- **Assumption A3 – môi trường kiểm thử thật:** PostgreSQL 18 @127.0.0.1:5433, DB riêng `pc02_dynamic_reports_test`.

---

# REVIEW KỸ THUẬT (/plan-eng-review, 09/10/2026)

**Target:** chính file plan này. **Code tham chiếu:** `origin/main` @ `bdf0fa08`. Nhánh `fix/petition-all-column-search` đang chậm 60 commit (áp dụng bài học cũ `pc02-stale-branch-vs-main`).

**Cách ra quyết định:** anh đã ủy quyền thường trực trong phiên này ("Tất cả gì cần phải descion thì hãy quyệt định dựa trên tiêu chí quản trị sâu nhất, tính mở rộng tốt nhất, không được giảm scope, cho phép tăng scope…"). Vì vậy mọi lựa chọn bên dưới được **tự quyết theo ủy quyền đó**, chọn phương án Completeness 10/10. Câu trả lời tham chiếu cho mọi mục là `AUTH-0910`.

## 10. Sửa đổi bắt buộc sau review (ưu tiên hơn các mục 1–9 khi mâu thuẫn)

1. **R1 – Cấu trúc gọn hơn, giữ nguyên phạm vi:**
   - Gộp toàn bộ chuyển trạng thái (lưu/nộp/duyệt/trả/huỷ duyệt/mở khoá/xin mở lại/miễn/thay người nhập/chốt/mở chốt) vào một **`SubmissionWorkflowService` chạy bằng bảng chuyển trạng thái khai báo** `TRANSITIONS[state][action] = {guard, controlledBy, next, revisionKind, auditAction, notify}` (mẫu SAP BPC controlled-by). Bỏ `ReviewService`, `UnlockService`, `AdjustmentService` riêng.
   - Bỏ bảng `DynReportFormula`: công thức nằm trong `DynReportVersion.layout` (bất biến) kèm AST đã biên dịch.
2. **R2 – Engine thuần dùng chung FE/BE:**
   - Nguồn duy nhất là `backend/src/dynamic-reports/engine/` (cấm import `@nestjs`/`@prisma`/`fs`).
   - Script `npm run gen:dr-engine` (cùng kiểu `gen:enums`) sao sang `frontend/src/features/dynamic-reports/engine/generated/`.
   - Hai cổng: (a) byte bằng nhau giữa bản sinh và bản nguồn; (b) ranh giới import.
   - Frontend thêm `decimal.js`.
   - Lưới dùng `expr` để tính lại ô fx ngay khi gõ. Server vẫn là nguồn số chính thức.
3. **R3 – Parser đúng với file thật:**
   - Mở rộng **shared formula** (exceljs `sharedFormula` → dịch tham chiếu tương đối). Đo được: `bao_cao_ngay.xlsx` có 211 ô, A09 có 21 ô.
   - **Locked hiệu lực** tính theo thứ tự ô → style dòng → style cột (`<col style>`, HSLN có 68) → mặc định Excel `locked=true` khi không khai.
   - `definedNames`: `_xlnm.Print_Area`/`Print_Titles` là thuộc tính in. Named range do người dùng đặt mà công thức có dùng → báo không hỗ trợ.
   - Công thức 3D và `#REF!` trong sheet không được chọn → bỏ qua kèm cảnh báo; nếu nằm trong sheet được chọn → lỗi.
4. **R4 – Đồng hồ:** quyết định ghi dùng `clock_timestamp()` lấy **sau khi đã giữ khoá hàng**. `now()` của Postgres là thời điểm bắt đầu transaction, nên chờ khoá vượt hạn vẫn lọt.
5. **R5 – Bản nộp tạo sẵn:** `DynReportSubmission` được tạo cùng lúc với assignment (state NOT_STARTED, revision 0). Mọi thao tác ghi dùng `SELECT … FOR UPDATE` trên dòng này. P2002 nếu còn xảy ra → `REVISION_CONFLICT` 409, không trả 500.
6. **R6 – Cô lập parser và giới hạn hai tầng:**
   - Parse trong `worker_threads` có `resourceLimits.maxOldGenerationSizeMb` và `terminate()` khi quá thời gian (repo chưa từng dùng worker).
   - **Giới hạn an toàn cấp file** giữ `XLSX_LIMITS` hiện có (50 MB, 20 sheet). **Giới hạn mẫu báo cáo** (≤5 sheet được chọn, ≤50.000 ô, ≤5.000 ô nhập) chỉ áp **sau khi chọn sheet**. File HSLN có 17 sheet nên vẫn tải lên được.
   - Tham số hoá `assertWorkbookLimits(workbook, limits)`, không sao chép guard.
7. **R7 – Ngày nghỉ:**
   - Engine thuần nhận `nonWorkingDates` do service tính sẵn bằng `CalendarEventsService.expandOccurrences()` (scope SYSTEM, `isOfficialDayOff`) cộng quy tắc Thứ Bảy/Chủ nhật.
   - `dueAt` được **chụp lại khi sinh kỳ**. Sửa lịch nghỉ sau đó không làm dời hạn cũ; muốn tính lại phải qua thao tác admin có audit.
8. **R8 – Dấu nhận diện file xuất:**
   - Mọi file xuất có sheet `__dr_meta` ở trạng thái veryHidden cùng custom property: reportId, versionId, periodKey, teamId, sha mẫu, exportId.
   - Khi "Nhập từ Excel": dấu không khớp → từ chối kèm hướng dẫn. File không có dấu → chỉ chấp nhận nếu cấu trúc sheet/ô khớp hash layout.
9. **R9 – Lưu revision:**
   - Lần lưu thường (SAVE) chỉ ghi **diff**.
   - SUBMIT/APPROVE/RETURN/UNAPPROVE/ADJUSTMENT/IMPORT ghi **bản đầy đủ**.
   - `Submission.values` giữ giá trị hiện tại. Dựng lại một revision = bản đầy đủ gần nhất + các diff sau đó.
10. **R10 – Audit không chứa số liệu:**
    - `AuditLog` chỉ ghi metadata: actor, action, id, số revision, lý do. Lý do: `GET /audit` chỉ cần `read:AuditLog`, nên ghi số liệu vào đó sẽ lộ dữ liệu ra ngoài phạm vi báo cáo.
    - Diff giá trị chỉ nằm trong `DynReportRevision`, đọc qua API có kiểm quyền báo cáo. Màn S21 đọc từ revision.
11. **R11 – Oracle kiểm thử:**
    - Script sinh fixture tự cộng 16 sheet đơn vị bằng openpyxl. Đây là mã độc lập với engine.
    - Số cache của Excel chỉ dùng cho 38 dòng không lỗi.
    - Thêm ca kiểm "Tổ 10 hỏng `#REF!`" → hệ thống phải từ chối hoặc báo lỗi rõ, không cộng câm.
12. **R12 – Giao thức khoá kỳ:**
    - Thứ tự khoá cố định: `period` → `assignment` → `submission`.
    - Lưu/nộp: `SELECT period … FOR SHARE` + kiểm `status=OPEN`.
    - Chốt kỳ, đổi cấu hình (D09), thêm/miễn/thay người nhập: `FOR UPDATE` trên period, chờ các lần lưu đang chạy xong.
    - Snapshot chính thức chụp trong cùng transaction với việc chốt kỳ.
    - Kiểm thử song song thật trên Postgres: lưu ↔ chốt, lưu ↔ D09, chốt ↔ chốt.
13. **R13 – VIEWER theo phạm vi:**
    - `DynReportRole` thêm `teamScopeId?` (một cây con). Quyền của dynamic-reports **chỉ** tính từ: vai trò báo cáo, người nhập của assignment, và `admin:DynamicReport`. Không dùng DataScope chung.
    - Snapshot có `contributorSetHash`. Tổng hợp theo phạm vi tính trên đúng tập tổ được phép.
    - File xuất lưu phạm vi lúc tạo. Khi tải về kiểm lại; nếu phạm vi đã hẹp hơn → từ chối và yêu cầu xuất lại.
14. **R14 – Thay người nhập giữa kỳ:**
    - Thao tác có audit: thêm/bớt/thay người nhập của một assignment mà vẫn giữ giá trị, hạn và lịch sử.
    - Màn C có cảnh báo "lượt giao không còn người nhập hoạt động". Khi một tài khoản bị khoá, hệ thống gợi ý thay người.
15. **R15 – `PREV(ref)` có thể tái lập:**
    - Nguồn: snapshot FINALIZED của kỳ trước; nếu chưa có thì revision APPROVED gần nhất của cùng tổ; không có nữa thì áp `missingStrategy`.
    - Field khớp nhau qua các phiên bản bằng `fieldKey` ổn định (khi tạo phiên bản mới có bước "nối field cũ").
    - Kết quả kiểm tra lưu kèm `sourceRef` để tái lập. Kỳ trước bị điều chỉnh → đánh dấu kết quả cần kiểm lại.
16. **R16** – (đã gộp vào R13) Quy tắc phân quyền viết thành tài liệu ở PR2.
17. **R17 – Job không chạy chồng:** scheduler, reminder và dọn file đều dùng `pg_try_advisory_lock(<jobKey>)` để một lần chạy không đè lên lần trước.
18. **R18 – Xuất an toàn:** CSV và XLSX ở màn C đều qua `escapeXlsxCell` (chống formula injection). Có cron dọn `DynReportExport` hết TTL 24h. Tên file được làm sạch.
19. **R19 – Lưới lớn:** `GridRenderer` chỉ render theo cửa sổ dòng khi vượt 2.000 ô; không thêm dependency. Tab/Enter vẫn đi qua mọi ô nhập.
20. **R20 – Chỉ mục:**
    - `DynReportAssignment(periodId)`, `(teamId, periodId)`.
    - `DynReportSubmission(state, submittedAt)`.
    - `DynReportPeriod(reportId, dueAt)`, `(status, dueAt)`.
    - `DynReportUnlock(assignmentId, status, expiresAt)`.
    - `DynReportRevision(submissionId, revision)`.
    - `DynReportRole(userId)`, `DynReportAssignmentEditor(userId)`.
    - Migration dùng `CREATE INDEX` thường, **không dùng CONCURRENTLY** (bài học v0.40).
21. **R21 – Phê duyệt nhiều cấp (TODO → làm ngay):**
    - Chuỗi duyệt cấu hình 1..N cấp theo cây `Team.parentId` (DHIS2 approve/accept).
    - Bảng chuyển trạng thái R1 thêm cấp duyệt; cấp trên đã duyệt thì cấp dưới không huỷ duyệt được.
    - Thêm vào PR7, khoảng +5 ngày.
22. **R22 – Chế độ nộp theo người (TODO → làm ngay):**
    - `ReportingUnit=USER` hiện thực đầy đủ, chọn khi thiết lập; lượt giao = báo cáo × kỳ × người.
    - Thêm vào PR4/PR5/PR8, khoảng +4 ngày. Ma trận quyền kiểm cả hai chế độ.

### Sơ đồ

```
Trạng thái bản nộp (R1, R21) — mỗi cạnh là một dòng trong TRANSITIONS
 NOT_STARTED --save--> DRAFT --submit(rules OK, chờ autosave)--> SUBMITTED
     ^                  |  ^                                       |  |
     |                  |  +----------save-------- RETURNED <-return(lý do,returnDueAt)
     |                  |                                          |
     |               (khoá hạn: chỉ grant/request ACTIVE mới cho save)
     |                                                             v
     |                                      APPROVED[L1..Ln] --unapprove(lý do, chỉ khi cấp trên chưa duyệt)
 period FINALIZE (FOR UPDATE period) ---> khoá tất cả ---> reopen(admin) -> ADJUSTMENT revision

Đường ghi (R4, R5, R12)
 PATCH values ─► auth (JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
   └► tx BEGIN
       ├► SELECT period FOR SHARE ─► status=OPEN?            ─ no ─► 409 REPORT_LOCKED
       ├► SELECT assignment + editor(actor) ─ không phải editor ─► 404 FORBIDDEN
       ├► SELECT submission FOR UPDATE
       ├► now := clock_timestamp()
       ├► access(state, grants, dueAt, returnDueAt, now) ─ false ─► 409 REPORT_LOCKED (giữ bộ đệm ở FE)
       ├► idempotency(actor,key,hash) ─ trùng ─► trả kết quả cũ │ khác hash ─► 422 IDEMPOTENCY_MISMATCH
       ├► expectedRevision == current? ─ no ─► 409 REVISION_CONFLICT
       ├► validate từng patch (allowlist fieldKey, kiểu, giới hạn) ─ lỗi ─► 422 CELL_VALIDATION (toàn batch)
       ├► tính lại công thức + rule ─► ghi revision (diff), cập nhật submission, AuditLog(metadata)
       └► COMMIT ─► vô hiệu snapshot liên quan ─► 200 {revision, savedAt, serverTime, effectiveLockAt}

Thứ tự khoá (R12): period → assignment → submission (không bao giờ ngược lại)
```

### Failure modes (đường mới → lỗi thực tế → kiểm thử/xử lý → người dùng thấy gì)

| Đường | Lỗi thực tế | Test + xử lý | Người dùng thấy |
|---|---|---|---|
| Upload/parse | File độc làm treo hoặc hết bộ nhớ | Worker bị terminate + test fixture độc | Thông báo `PARSE_TIMEOUT` có mã tham chiếu |
| Parser | Shared formula hoặc khoá theo cột bị đọc sai | Golden test trên file thật (R3) | Preview đúng; sai thì bị chặn trước khi xuất bản |
| Lưu sát hạn | Chờ khoá vượt hạn mà vẫn ghi được | Test LOCK01 + `clock_timestamp` | 409 kèm banner, bộ đệm được giữ |
| Lưu ↔ chốt kỳ | Lần lưu commit sau khi đã chụp snapshot | Test song song R12 | Lưu bị từ chối với thông báo rõ |
| Hai người cùng tổ | Insert submission trùng | Bản nộp tạo sẵn + FOR UPDATE (R5) | Một người nhận 409 kèm dialog so sánh |
| Scheduler | Sinh kỳ trùng hoặc chạy chồng | Unique + advisory lock (R17) | Không thấy kỳ trùng |
| Xuất | Lộ số của tổ ngoài phạm vi | `contributorSetHash` + kiểm lại khi tải (R13) | 404 hoặc yêu cầu xuất lại |
| Audit | Lộ số liệu qua `/audit` | Chỉ ghi metadata (R10) + test gate | — |
| Nhập Excel | Áp file của phiên bản mẫu khác | Dấu `__dr_meta` (R8) | Từ chối kèm hướng dẫn |
| PREV | Cùng dữ liệu nhưng kết quả kiểm khác nhau theo ngày | Nguồn được ghim (R15) | Kết quả ổn định, ghi rõ nguồn |

**Critical gaps (không test + không xử lý + lỗi câm): 0** sau khi áp R1–R22.

### Test review — sơ đồ phủ (mọi đường đều mới; tất cả là kiểm thử theo kế hoạch)

```
CODE PATHS (dự kiến)                                       USER FLOWS
[+] engine/token, values, decimal                         [+] Thiết lập (A)
  ├── [GAP→PR1] grammar/alias/format sai                    ├── [GAP→E2E] upload HSLN → chọn sheet → đánh dấu 33 ô → xuất bản
  └── [GAP→PR1] vi-VN 1.234,50 / mơ hồ / 18 chữ số          ├── [GAP→E2E] thay file khi nháp có mapping → cảnh báo
[+] engine/period                                           └── [GAP] bấm Xuất bản 2 lần → 1 lần (idempotency)
  ├── [GAP→PR1] tuần giao năm, 29–31, QIV→QI, 21→20      [+] Người nhập (B)
  └── [GAP→PR1] DAYS_AFTER_END + ngày nghỉ (R7)             ├── [GAP→E2E] nhập → autosave → nộp → bị khoá
[+] engine/template-parser                                  ├── [GAP→E2E] hết hạn khi đang gõ → 409 → bộ đệm còn
  ├── [GAP→PR3] shared formula (R3)                         ├── [GAP→E2E] 2 tab / 2 người cùng tổ → 409 + so sánh
  ├── [GAP→PR3] locked theo cột/dòng/mặc định (R3)          ├── [GAP] dán TSV qua ô khoá → từ chối nguyên khối
  └── [GAP→PR3] 17 sheet chọn 1 (R6), #REF! (R11)           └── [GAP→E2E] nhập từ Excel sai phiên bản → từ chối (R8)
[+] engine/expr, aggregate                                [+] Quản lý (B)
  ├── [GAP→PR1] SUM/IF/chia 0/vòng lặp/PREV (R15)           ├── [GAP→E2E] duyệt / trả lại / huỷ duyệt nhiều cấp (R21)
  └── [GAP→PR1] HSLN oracle độc lập (R11), RATE01, AGG01    ├── [GAP→E2E] mở khoá +3h qua nửa đêm, thu hồi, hàng loạt
[+] SubmissionWorkflowService (R1)                          └── [GAP→E2E] xuất TỔNG + từng tổ, đúng phạm vi (R13)
  ├── [GAP→PR6/7] mọi dòng TRANSITIONS: cho phép + bị cấm [+] Tình trạng (C)
  ├── [GAP→IT] clock_timestamp sau khoá (R4)                ├── [GAP→E2E] KPI khớp phân công, mẫu số 0 → "—"
  └── [GAP→IT] lưu ↔ chốt ↔ D09 song song (R12)             └── [GAP] lọc giữ trên URL khi quay lại
[+] Quyền                                                 [+] Lỗi người dùng thấy
  ├── [GAP→IT] manager PATCH, VIEWER ghi, IDOR fieldKey     ├── [GAP] mất mạng → không báo "đã lưu"
  └── [GAP→IT] /audit không chứa số liệu (R10)              └── [GAP] 404 khác "không có dữ liệu"

COVERAGE hiện tại: 0/30 (toàn bộ là mã mới) | Tất cả GAP đã gán PR và kiểm thử ở §6.1, §8 và R1–R22
```

Test Plan Artifact: `~/.gstack/projects/pc02-case-management/Than-Minh-Trung-fix-petition-all-column-search-eng-review-test-plan-20261009-151547.md`

### Hiệu năng

- **R9:** revision dạng diff tránh phình kho dữ liệu. Ước tính 5.000 ô × 30 B ≈ 150 KB cho mỗi bản đầy đủ; nếu ghi đủ ở mỗi lần autosave của 200 tổ thì lên tới GB.
- **R20:** danh sách chỉ mục.
- **R19:** lưới chỉ render theo cửa sổ khi lớn.
- **Snapshot:** cache theo `sourceHash + contributorSetHash`.
- **Xuất 200 sheet:** dùng exceljs bình thường (mỗi sheet ≤258 dòng, nhẹ).

### What already exists (dùng lại, không dựng lại)

- `hostile-xlsx-guard.ts` (tham số hoá, R6)
- `CalendarEventsService.expandOccurrences()` (R7)
- `escapeXlsxCell` (R18)
- `@Throttle` / `ThrottlerModule` cho `RATE_LIMITED`
- `useOChuDongBo` (`frontend/src/components/shared/ListPageShell/useOChuDongBo.ts`)
- `AuditService.log(…, tx)` (chỉ metadata, R10)
- Luồng xin/duyệt của `edit-window`
- Khuôn `DocumentTemplate` lưu bytes + sha
- `gen:enums` làm khuôn cho `gen:dr-engine` (R2)

### NOT in scope

- Lấy số liệu tự động từ hồ sơ vụ án/đơn thư vào báo cáo động: BRD loại trừ; module `XuatBaoCao` của hệ cũ đã làm việc này theo hướng riêng.
- Email/SMS: BRD loại khỏi lõi; chỉ dùng thông báo trong ứng dụng.
- Chữ ký số: BRD loại trừ.
- Không có mục nào khác bị hoãn: hai TODO đã được chuyển thành R21 và R22 làm ngay.

### Worktree parallelization

| Bước | Module | Phụ thuộc |
|---|---|---|
| PR0 spec/fixture | docs/, backend/test/fixtures | — |
| PR1 engine | backend/src/dynamic-reports/engine | PR0 |
| PR2 nền tảng | prisma/, dynamic-reports (khung), feature-flags, frontend/features | PR0 |
| PR3 template | dynamic-reports/template | PR1, PR2 |
| PR5 lịch | dynamic-reports/schedule | PR1, PR2 |
| PR4 màn A | frontend/features/dynamic-reports/setup | PR3 |
| PR6 màn B nhập | …/register + workflow | PR4, PR5 |
| PR7 màn B quản lý | …/manage + workflow | PR6 |
| PR8 màn C | …/status | PR6 |
| PR9 mở rộng | rules, comments, reminders | PR6 |
| PR10 hoàn thiện | toàn module | PR7, PR8, PR9 |

- **Lane A:** PR1. **Lane B:** PR2. Hai lane chạy song song (khác module); merge cả hai.
- **Lane C:** PR3. **Lane D:** PR5. Chạy song song.
- Sau đó PR4 → PR6.
- **Lane E:** PR7. **Lane F:** PR8. **Lane G:** PR9. Ba lane chạy song song; xung đột ở `workflow/` và `schema.prisma` thì xếp lượt merge.
- **Cuối cùng:** PR10.

### Implementation Tasks

Tổng hợp từ các phát hiện của review này. Mỗi task bắt nguồn từ một phát hiện cụ thể; đánh dấu khi đã ship.

- [ ] **T1 (P1, human: ~3d / CC: ~2h)** — workflow — Dựng `SubmissionWorkflowService` + bảng `TRANSITIONS` (R1, R21)
  - Surfaced by: Code quality Q1 / Codex #4
  - Files: backend/src/dynamic-reports/workflow/
  - Verify: jest spec cho từng dòng TRANSITIONS
- [ ] **T2 (P1, human: ~1d / CC: ~30m)** — engine — `gen:dr-engine` + cổng byte và cổng import (R2)
  - Surfaced by: Architecture A1
  - Files: backend/scripts, frontend/src/features/dynamic-reports/engine/generated
  - Verify: gate spec đỏ khi bản sinh lệch nguồn
- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — parser — shared formula + locked hiệu lực + definedNames (R3)
  - Surfaced by: Architecture A2
  - Files: engine/template/parser.ts
  - Verify: golden test trên HSLN / bao_cao_ngay / A09
- [ ] **T4 (P1, human: ~1d / CC: ~30m)** — workflow — `clock_timestamp`, bản nộp tạo sẵn, thứ tự khoá (R4, R5, R12)
  - Surfaced by: Architecture A3/A4 / Codex #4
  - Files: dynamic-reports/workflow
  - Verify: IT song song trên Postgres 18 @5433
- [ ] **T5 (P1, human: ~1d / CC: ~30m)** — template — worker_threads + giới hạn hai tầng (R6)
  - Surfaced by: Architecture A6 / Codex #2
  - Files: dynamic-reports/template, xlsx-imports/hostile-xlsx-guard.ts
  - Verify: upload HSLN 17 sheet OK; file độc bị terminate
- [ ] **T6 (P1, human: ~1d / CC: ~30m)** — audit — chỉ metadata + gate test (R10)
  - Surfaced by: Codex #1
  - Files: dynamic-reports/*, audit usage
  - Verify: AuditLog.metadata không chứa giá trị ô
- [ ] **T7 (P1, human: ~1d / CC: ~30m)** — fixtures — oracle HSLN độc lập + ca `#REF!` (R11)
  - Surfaced by: Codex #3
  - Files: backend/test/fixtures/dynamic-reports
  - Verify: so từng ô
- [ ] **T8 (P1, human: ~3d / CC: ~1.5h)** — authz — VIEWER theo phạm vi + `contributorSetHash` + kiểm lại khi tải (R13)
  - Surfaced by: Codex #5
  - Files: dynamic-reports/aggregate, export, policy
  - Verify: IT scope thu hẹp sau khi xuất
- [ ] **T9 (P1, human: ~1d / CC: ~30m)** — workflow — thay người nhập giữa kỳ (R14)
  - Surfaced by: Codex #6
  - Verify: tài khoản bị khoá → thay → giá trị và lịch sử còn nguyên
- [ ] **T10 (P2, human: ~2d / CC: ~1h)** — expr — ghim nguồn `PREV` + nối field giữa các phiên bản (R15)
  - Surfaced by: Codex #7
  - Verify: kỳ đầu / thiếu kỳ / đổi phiên bản / kỳ trước bị điều chỉnh
- [ ] **T11 (P2, human: ~1d / CC: ~30m)** — schedule — ngày nghỉ qua `expandOccurrences` + chụp `dueAt` (R7) + advisory lock (R17)
  - Surfaced by: Architecture A7 / Code quality Q7
  - Verify: test lịch nghỉ lặp và chạy chồng
- [ ] **T12 (P2, human: ~1d / CC: ~30m)** — export — `__dr_meta` + escape CSV + cron dọn file (R8, R18)
  - Surfaced by: Code quality Q2/Q6
  - Verify: nhập lại file khác phiên bản bị từ chối
- [ ] **T13 (P2, human: ~1d / CC: ~30m)** — storage — revision diff + chỉ mục (R9, R20)
  - Surfaced by: Performance P1/P2
  - Verify: dựng lại revision N đúng bằng giá trị đã lưu
- [ ] **T14 (P2, human: ~1d / CC: ~30m)** — grid — render theo cửa sổ khi >2.000 ô (R19)
  - Surfaced by: Performance P3
  - Verify: vitest bàn phím trên lưới lớn
- [ ] **T15 (P1, human: ~4d / CC: ~2h)** — reporting unit — chế độ USER đầy đủ (R22)
  - Surfaced by: TODO → làm ngay
  - Verify: ma trận quyền chạy cho cả TEAM và USER

## Decision ledger

Mọi mục dưới đây có `State: approved` và `Actual answer: AUTH-0910`: ủy quyền thường trực của anh trong phiên 09/10/2026 cho phép tự quyết theo phương án quản trị chặt nhất, dễ mở rộng nhất, không giảm phạm vi. Phương án được chọn luôn là phương án A (recommended, Completeness 10/10).

| ID | Finding (mức · độ tin · nguồn · người phát hiện) | Plan baseline | Bằng chứng runtime | A (đã chọn) | B (bị loại) | Accepted scope |
|---|---|---|---|---|---|---|
| SC | Scope gate: ≈19 model, ≈13 service, ≈38 màn hình | §4–6 | — | Không cắt tính năng; dùng cấu trúc gọn hơn (R1) | Giữ cấu trúc gốc | R1 |
| R1 | Q1 P2 · 8 · §4.2 · Claude | 4 service chuyển trạng thái | — | Một workflow + bảng TRANSITIONS; bỏ DynReportFormula | Giữ 4 service | §10.1 |
| R2 | A1 P1 · 9 · §4.1 "paste dùng chung qua copy" · Claude | Không có cơ chế dùng chung | Không có package dùng chung; có `gen:enums` | Sinh mã + 2 cổng | Viết tay hai bản | §10.2 |
| R3 | A2 P1 · 9 · §4.1 parser · Claude | Chưa nói tới shared formula / khoá theo cột | 211 `t="shared"`; 68 `<col style>` | Mở rộng + resolve | Đọc từng ô | §10.3 |
| R4 | A3 P1 · 9 · §3.2 `now_db` · Claude | `now()` | Ngữ nghĩa Postgres | `clock_timestamp()` sau khoá | `now()` | §10.4 |
| R5 | A4 P1 · 8 · §4.3 Submission · Claude | Tạo lười | Có unique assignmentId | Tạo sẵn + FOR UPDATE | Tạo lười + bắt P2002 | §10.5 |
| R6 | A6 P1 · 9 · PR3 giới hạn · Claude + Codex #2 | 5 sheet cho cả file | HSLN 17 sheet; XLSX_LIMITS 20 sheet | Hai tầng + worker | Một tầng | §10.6 |
| R7 | A7 P2 · 8 · D02 · Claude | Đọc CalendarEvent thô | Đã có `expandOccurrences()` | Dùng lại + chụp dueAt | Đọc thô | §10.7 |
| R8 | Q2 P2 · 8 · S35 · Claude | Khớp theo địa chỉ ô | — | Dấu `__dr_meta` | Không có dấu | §10.8 |
| R9 | P1 P2 · 8 · §4.3 Revision · Claude | Lưu đủ mỗi lần | — | Diff + bản đầy đủ theo mốc | Lưu đủ | §10.9 |
| R10 | Codex #1 P1 · 9 · §4.3 audit | Diff vào AuditLog | `audit.controller.ts:25` chỉ cần `read:AuditLog` | Chỉ metadata | Mở rộng quyền audit | §10.10 |
| R11 | Codex #3 P1 · 10 · §2/§8 oracle | Dùng cache TỔNG | 190 `#REF!` | Oracle tự cộng | Dùng cache | §10.11 |
| R12 | Codex #4 P1 · 8 · §3.2/§4.2 | Chưa có giao thức khoá | — | Thứ tự khoá + FOR SHARE/UPDATE | Chỉ dựa vào bảng chuyển trạng thái | §10.12 |
| R13 | Codex #5 P1 · 8 · §5/§4.2 | Snapshot cả kỳ | — | VIEWER theo phạm vi + hash tập đóng góp | VIEWER xem cả báo cáo | §10.13 |
| R14 | Codex #6 P1 · 8 · D09/PR5 | Không có thao tác thay người | — | Thay người có audit | Chờ sang kỳ sau | §10.14 |
| R15 | Codex #7 P2 · 7 · §4.1 PREV | Chưa định nghĩa nguồn | — | Ghim nguồn + nối field | Bỏ PREV (giảm phạm vi, bị cấm) | §10.15 |
| R17 | Q7 P2 · 7 · PR5 · Claude | Chỉ có unique | Chưa có advisory lock | Advisory lock | Không có | §10.17 |
| R18 | Q6 P2 · 8 · PR8 xuất · Claude | Escape XLSX | Có `escapeXlsxCell` | Escape CSV + dọn file | — | §10.18 |
| R19 | P3 P2 · 6 · R-U · Claude | Bảng HTML render hết | Giới hạn 50.000 ô | Render theo cửa sổ | Render hết | §10.19 |
| R20 | P2 P2 · 8 · §4.3 · Claude | Chưa liệt kê chỉ mục | Bài học v0.40 về CONCURRENTLY | Danh sách chỉ mục | — | §10.20 |
| R21 | TODO · approvalLevel | Mở rộng sau | DHIS2 | C: làm ngay | A: thêm vào TODOS | §10.21 |
| R22 | TODO · ReportingUnit USER | Giai đoạn sau | Phạm vi gốc FRD theo người | C: làm ngay | A: thêm vào TODOS | §10.22 |

Approval readiness: PASS — đã kiểm SC, R1–R15, R17–R22 với câu trả lời AUTH-0910 (R16 đã gộp vào R13).

### Completion summary

- Step 0: Scope Challenge — scope accepted as-is (tăng phạm vi R21/R22; cấu trúc gọn hơn R1, không cắt tính năng)
- Architecture Review: 8 issues found
- Code Quality Review: 7 issues found
- Test Review: diagram produced, 14 gaps identified (tất cả đã gán PR)
- Performance Review: 3 issues found
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 2 items proposed → cả hai chọn C (làm ngay)
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0
- Outside voice: codex completed (7 findings, cả 7 được chấp nhận)
- Parallelization: 7 lanes, 3 đợt song song / 4 bước tuần tự
- Lake Score: 22/22

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex (`/plan-eng-review` outside voice) | Independent 2nd opinion | 1 | completed | 7 findings, 7 accepted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open (đã ánh xạ thành công việc) | 32 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex · plan-review · completed · 7 phát hiện (audit leak, giới hạn 17 sheet, oracle `#REF!`, khoá chốt kỳ, VIEWER theo phạm vi, thay người nhập, PREV), cả 7 được chấp nhận vào R6, R10–R15.
- **CROSS-MODEL:** Claude và Codex cùng đánh dấu giới hạn file (R6) và rủi ro đồng thời (R5/R12). Codex bổ sung 5 điểm Claude bỏ sót (R10, R11, R13, R14, R15).
- **VERDICT:** Eng Review ISSUES OPEN — toàn bộ 32 phát hiện đã có quyết định và task; kế hoạch sẵn sàng triển khai sau khi áp §10. Nên chạy thêm `/plan-design-review` cho 38 màn hình.

NO UNRESOLVED DECISIONS
