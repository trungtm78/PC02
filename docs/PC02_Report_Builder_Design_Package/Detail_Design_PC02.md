# Detail Design Báo cáo động PC02

Tài liệu hướng dẫn hiện thực các thuật toán dữ liệu API và chuyển trạng thái cho module báo cáo động. Dùng cùng FRD Basic Design mockup và execution contract phiên bản 1.0. Các tên route và kiểu dữ liệu bên dưới là hợp đồng đề xuất để ánh xạ sang framework hiện hành sau khảo sát repository.

## Quy ước định danh và phiên bản

ID public là chuỗi opaque do server sinh; client không suy ra ID từ tên hoặc vị trí. Field ID ổn định trong một TemplateVersion và liên kết sheet id cùng địa chỉ anchor. Không dùng A2 làm khóa toàn cục vì khác sheet và khác version có thể khác ý nghĩa. revision là số nguyên tăng đơn điệu trên một submission. Template schema version và calculation engine version lưu độc lập với số phiên bản báo cáo.

## Data dictionary và ràng buộc

| Entity | Field chính và kiểu logic | Constraint hoặc index |
|---|---|---|
| ReportDefinition | id string; code varchar64; name varchar255; status enum; effective_from date | unique code; index status |
| TemplateVersion | id; report_id FK; version int; file_ref; sha256; schema_json; parser_version; created_by; created_at timestamptz | unique report_id version; immutable sau publish |
| FieldDefinition | id; version_id FK; sheet_id string; address string; type enum; format string; agg enum; required bool; limits JSON | unique version sheet anchor; type và agg compatible |
| ReportPeriod | id; report_id FK; period_key varchar32; opens_at; original_due_at; period_start date; period_end date; template_version_id FK | unique report period_key; opens_at nhỏ hơn due_at |
| Assignment | id; period_id FK; input_user_id FK; unit_snapshot JSON; obligation enum; exemption_reason; assignment_version int | unique period user; index user period; giữ bản ghi khi miễn |
| Submission | id; assignment_id FK; current_revision bigint; progress enum; first_saved_at; first_completed_at; current_completed_at | unique assignment; index progress updated_at |
| SubmissionRevision | id; submission_id FK; revision bigint; values_json typed; complete bool; saved_by; committed_at | unique submission revision; immutable |
| UnlockGrant | id; assignment_id FK; start_at; expires_at; reason varchar1000; actor_id; revoked_at; revoked_by; revoke_reason | expires_at lớn hơn start_at; index assignment expires_at |
| AggregateSnapshot | id; period_id; mode enum; source_hash; source_revisions JSON; values JSON; engine_version; as_of | index period mode source_hash; không sửa snapshot |
| IdempotencyRecord | actor_id; action; key; request_hash; result_ref; status; expires_at | unique actor action key; TTL đề xuất24h |
| ExportJob | id; requested_by; scope_ref; snapshot_id; filters_json; status; file_ref; expires_at | quyền kiểm tra tại create và download; index status |
| AuditEvent | id; actor_id; action; entity_type; entity_id; before_revision; after_revision; reason; at; correlation_id | append-only; index entity at và actor at |

Các FK không cascade delete dữ liệu báo cáo đã phát sinh. Typed values có shape field_id→{type,value}; NUM value là chuỗi decimal chuẩn; null là giá trị rỗng thật, không phải chuỗi "null". Style schema không cho arbitrary HTML hay script. Giới hạn schema/file được kiểm tra trước lưu.

## Schema biểu mẫu mẫu

```json
{
  "schemaVersion": 1,
  "templateVersionId": "tv_demo_v1",
  "dateSystem": "1900",
  "locale": "vi-VN",
  "sheets": [{"id":"sheet_1","name":"BaoCao","merges":["B1:E1"]}],
  "fields": [
    {"id":"f_a2","sheetId":"sheet_1","address":"A2","type":"NUM","format":"#,##0","aggregate":"SUM","required":true,"limits":{"scale":0,"min":"0"}},
    {"id":"f_a5","sheetId":"sheet_1","address":"A5","type":"TEXT","aggregate":"NONE","required":false,"limits":{"maxLength":2000}},
    {"id":"f_ak12","sheetId":"sheet_1","address":"AK12","type":"DATE","format":"dd/mm/yyyy","aggregate":"NONE","required":true}
  ]
}
```

## Thuật toán import

1. Kiểm tra MIME extension kích thước và ZIP entries trước giải nén; bỏ đường dẫn traversal, giới hạn tổng kích thước và tỷ lệ giải nén.
2. Đọc workbook properties, date system, sheets, styles và effective protection. Chỉ parse dữ liệu không thực thi macro hoặc external connection.
3. Xác định vùng dùng hữu hạn và map merge anchor. Kiểm tra hidden input và feature không hỗ trợ.
4. Phân loại cell: literal locked, token unlocked, formula locked. Nếu bất nhất tạo lỗi cùng sheet/address/raw token đã escape.
5. Parse token theo grammar; normalize type/agg; validate format tương thích và rule limits.
6. Parse formula thành AST whitelist, xây dependency graph, kiểm tra vòng lặp và tham chiếu ngoài phạm vi. Không dùng eval.
7. Tạo schema/layout versioned, hash file và danh sách error/warning. Preview thể hiện lỗi; chỉ cho publish nếu error_count bằng0 và có ít nhất1 input.

## Parse token và số

Regex hình thức không thay validation ngữ nghĩa. Bóc đúng một cặp ngoặc ngoài, split tối đa3 phần theo |; type nằm trong allowlist. Không có agg thì NONE. Format rỗng dùng format chuẩn theo type. AGV chỉ alias khi parser option cho phép và phát warning. Escape không hỗ trợ trong grammar v1.

NUM client parse theo locale được cấu hình, không tự thử nhiều locale đến khi ra số. Backend chỉ nhận canonical decimal string có dấu trừ tùy chọn, phần nguyên và phần thập phân, không separator hoặc exponent. Kiểm tra tổng precision và scale trước chuyển decimal. Format hiển thị không sửa stored value. Comparison và aggregation dùng decimal, chỉ round tại lớp hiển thị hoặc hàm ROUND được định nghĩa.

## Quyền ghi và khóa giao dịch

```text
save(actor, assignment, expected_revision, key, patches):
  begin transaction
  load assignment + period + submission under appropriate lock
  require authenticated active actor owns this assignment
  check idempotency key hash; replay prior result with current permissions
  require obligation == REQUIRED and report permits existing-period writes
  require period.template_version == request.template_version
  now = database_clock_at_write_decision()
  allowed = opens_at <= now AND (
      now < original_due_at OR exists valid unrevoked grant at now)
  require allowed
  require current_revision == expected_revision
  validate every patch against field allowlist type limits and locked flag
  apply entire batch to current typed values
  recalculate supported formulas; fail batch on invalid computation policy
  if values actually changed: append revision with complete=false
  update submission pointer and audit atomically
  commit and return committed revision savedAt serverTime permissions
```

Idempotency replay phải vẫn xác thực actor và quyền đọc trước khi trả kết quả cũ. Cùng key khác payload trả IDEMPOTENCY_MISMATCH; không tái thực hiện. Write không thay đổi dữ liệu trả revision hiện tại, không hủy trạng thái hoàn thành. Complete cùng revision đã hoàn thành là no-op có phản hồi thành công. Check clock nằm trong giao dịch ngay trước ghi; nếu transaction phải chờ lock thì lấy lại now sau khi được lock.

## Request và response cụ thể

```json
PATCH /assignments/as_demo/values
{
  "templateVersionId":"tv_demo_v1",
  "expectedRevision":7,
  "idempotencyKey":"opaque-client-key",
  "patches":[{"fieldId":"f_a2","value":"125"},{"fieldId":"f_ak12","value":"2026-10-09"}]
}
```

```json
{
  "assignmentId":"as_demo",
  "revision":8,
  "progress":"IN_PROGRESS",
  "savedAt":"2026-10-09T07:10:00Z",
  "serverTime":"2026-10-09T07:10:00Z",
  "effectiveLockAt":"2026-10-09T10:00:00Z",
  "editable":true,
  "fieldErrors":[]
}
```

```json
HTTP 422
{
  "code":"CELL_VALIDATION",
  "message":"Có dữ liệu chưa hợp lệ",
  "errors":[{"fieldId":"f_ak12","sheet":"BaoCao","cell":"AK12","code":"DATE_INVALID","message":"Ngày không hợp lệ. Chọn ngày từ lịch."}],
  "correlationId":"request-reference"
}
```

POST unlock body gồm expiresAt theo ISO timezone offset và reason; server quyết định startsAt=now. Response gồm grantId originalDueAt effectiveLockAt và auditRef. POST complete body gồm expectedRevision và idempotencyKey. GET status query nhận reportId periodId hoặc period range cùng loại, unitId userId progress timing accessState, page pageSize sort; pageSize mặc định25 tối đa100, sort nằm trong allowlist. Response gồm items total summary asOf filterEcho. Thay đổi filter reset page về1.

## Chuyển trạng thái submission

| Trước | Sự kiện | Điều kiện | Sau |
|---|---|---|---|
| Chưa bắt đầu | Save có thay đổi | Được ghi và hợp lệ | Đang nhập |
| Đang nhập | Complete | Required đầy đủ không lỗi còn quyền ghi | Hoàn thành |
| Hoàn thành | Save không đổi | Request idempotent hoặc no-op | Hoàn thành |
| Hoàn thành | Save có đổi | Còn hạn hoặc grant hiệu lực | Đang nhập |
| Bất kỳ | Đến hạn | Không grant | Progress giữ nguyên quyền nhập Đã khóa |
| Bất kỳ | Grant | Quản lý đúng phạm vi | Progress giữ nguyên quyền Mở lại |
| Bất kỳ | Grant hết hạn | Đã quá hạn gốc | Progress giữ nguyên quyền Đã khóa |

## Thuật toán aggregate và status

Mở transaction đọc snapshot, lấy assignment REQUIRED trong period, chọn revision hiện tại theo mode all_saved hoặc completed. Lưu vector assignment→revision gồm cả chưa nhập=null. Với từng field NUM có agg, lọc null rồi tính decimal. NONE trả null kèm displayKind=not_aggregated. Formula tổng chạy trên các giá trị đã tổng hợp; null dependency trả thiếu dữ liệu thay vì0. Tạo source_hash từ period version mode và vector; cache theo hash. Khi save/grant/assignment thay đổi, aggregate hoặc status cache liên quan hết hiệu lực. Grant không đổi số tổng nhưng đổi metadata quyền/hạn.

Status query bắt đầu từ assignments LEFT JOIN submission để không mất người chưa nhập. Chọn tập kỳ theo filter; loại kỳ chưa mở khỏi KPI nghĩa vụ hiện tại và hiển thị riêng. completed_count dựa trên current revision. overdue_count dùng original_due_at và current_completed=false. reopened_count chỉ grant còn hiệu lực và đã quá hạn gốc. Query và export dùng cùng policy scope. Chụp asOf một lần để tất cả KPI và bảng cùng ranh giới thời gian.

## Frontend state và điều phối request

Khóa cache theo reportId periodId assignmentId templateVersionId. Đổi báo cáo/kỳ kiểm tra dirty buffer; xác nhận lưu hoặc bỏ; không trộn dữ liệu từ request cũ. Cancel request cũ hoặc kiểm tra request sequence trước apply response. Autosave tách dirty buffer pending batch và last persisted revision; serialize các batch trên cùng submission, không gửi song song nhiều expectedRevision bằng nhau. Response lỗi giữ dirty buffer; retry dùng cùng key chỉ khi payload không đổi. Complete chờ autosave flush thành công rồi dùng revision mới.

Hạn client dùng serverTime offset và refresh khi focus; display countdown không cấp quyền. Date picker trả date-only; browser timezone không đổi ngày. Validation phía client dùng cùng metadata schema nhưng server validate độc lập. Grid export/paste không dùng DOM làm nguồn dữ liệu; store typed values là nguồn UI.

## Export và bảo quản file

ExportJob chụp source revision vector trước khi enqueue; worker chỉ đọc revision bất biến. Xây workbook từ template immutable, thay token bằng giá trị typed và recalculated formulas/result theo policy; không để token trong file phát hành. Kèm sheet metadata hoặc thông tin đầu báo cáo về kỳ mẫu nguồn chế độ tổng hợp và thời điểm. TEXT xuất kiểu string, không diễn giải = + - @ như công thức. Lưu file private, download qua API kiểm tra quyền hiện hành, TTL đề xuất24h cho file export; template/submission retention theo chính sách đơn vị. Không dùng public permanent URL.

## Mã thông báo và kiểm thử lỗi

| Mã | Hành vi UI | Phục hồi |
|---|---|---|
| TEMPLATE_INVALID | Danh sách lỗi theo ô | Sửa Excel tải lại hoặc sửa thuộc tính nháp theo quyền |
| REPORT_LOCKED | Banner đỏ nhạt readonly và giữ phần chưa lưu | Liên hệ quản lý hoặc tải lại quyền sau mở lại |
| REVISION_CONFLICT | Dialog dữ liệu server và thay đổi chưa lưu | Tải bản mới rồi áp lại có kiểm tra |
| CELL_VALIDATION | Viền ô và drawer lỗi | Click lỗi focus đúng ô |
| FORBIDDEN | Trang không có quyền không tiết lộ số liệu | Quay lại danh sách được phép |
| PARSE_TIMEOUT | Trạng thái parse thất bại có mã tham chiếu | Tối giản mẫu hoặc điều chỉnh giới hạn có kiểm chứng |
| EXPORT_FAILED | Job failed không link file lỗi | Tạo lại từ snapshot còn hợp lệ |
| NETWORK_ERROR | Chưa lưu thử lại | Không đánh dấu completed hoặc saved |

## Kiểm thử đối soát bắt buộc

Fixture AGG01 có3 người: số lượng 10 0 null cho SUM10 AVG5 COUNT2. Fixture RATE01: người A xử lý9/10, người B xử lý1/90; tỷ lệ chung10/100=10%, không lấy trung bình90% và1,11%. Fixture DATE01 chứa workbook1900 và1904 cùng ngày hiển thị; ngày ISO phải giống nhau. Fixture LOCK01 chờ row lock vượt hạn trước write; request phải bị chặn. Fixture VERSION01 đổi mẫu v2 sau kỳ v1 có dữ liệu; render/export kỳ cũ phải giữv1.

Các test chưa chạy trên sản phẩm. Mỗi kết quả thực thi phải ghi commit môi trường clock fixture và bằng chứng; không lấy validation cấu trúc contract làm bằng chứng sản phẩm đã đạt.

## 13. Test strategy và bằng chứng nghiệm thu

UT: parser token/style/merge, decimal/date/time/locale, aggregation null/0/empty, lịch và timezone, trạng thái completion. IT: quyền theo assignment, transaction deadline/revision, grant expiry, job retry, snapshot/export. E2E: wizard, nhập/paste/picker, quản lý readonly, hết hạn, mở lại, C drill-down. UAT: BA/đại diện nghiệp vụ chạy đúng các hành vi quan sát được trong ma trận AC; tất cả dùng dữ liệu giả.

Test thời gian bằng clock điều khiển: T−1ms, T, T+1ms; 23:30+3h; tháng 2 năm nhuận/không nhuận; tuần giao năm; quý IV sang quý I; lịch sau downtime. Test security bằng API trực tiếp với identity khác, sửa assignment/period/user/cell, chèn thêm property, export URL không quyền, template ngoài phạm vi. Test tổng đối soát độc lập bằng số biết trước, không dùng cùng implementation để sinh expected result.

Golden templates tối thiểu: đơn giản, nhiều sheet/merge, cột đến AK trở lên, số âm/thập phân/0/null, date 1900/1904, formula hợp lệ/không hỗ trợ/vòng lặp, hidden input, toàn locked, invalid token, file vượt giới hạn. Visual QA ở 1366/1440/1024/768: không mất nhãn, sai merge, mất ô nhập, che nút lưu hoặc sai màu trạng thái. Hiệu năng theo fixture đã chốt và log cấu hình môi trường.

## 15. Definition of Done

Task: AC tương ứng pass, test mục tiêu và regression bị ảnh hưởng pass, review không còn P0/P1, bằng chứng mới gắn commit/environment, tài liệu cập nhật. Milestone: toàn task pass; regression của module và luồng liên quan pass; UX/loading/empty/error/permission/boundary đạt; không còn P0/P1. Project: mọi AC được nghiệm thu, UAT 100% AC pass, kiểm tra quyền/khóa/tổng/export/tải đạt, người dùng nghiệp vụ chấp thuận pilot, rollback/restore thử thành công. Không lấy coverage phần trăm thay thế nghiệm thu hành vi.

**PLAN STATUS: BLOCKED FOR EXECUTION — phần phân tích và thiết kế đề xuất đã hoàn tất; chưa có repository baseline, Excel thật và xác nhận các quyết định nghiệp vụ D01–D10 để chốt contract triển khai.** Không có test sản phẩm nào được tuyên bố đã chạy từ phiên khảo sát chỉ đọc này.
