# Basic Design Báo cáo động PC02

Tài liệu thiết kế tổng thể xác định các thành phần luồng dữ liệu và giao diện tích hợp cho module báo cáo động trong PC02. Thiết kế ưu tiên tái sử dụng nền tảng xác thực phân quyền lưu file và ghi nhật ký của hệ thống sau khi đối chiếu source code.

Phiên bản 1.0 ngày 09/10/2026. Kiến trúc logic độc lập framework; không coi tên endpoint hoặc entity đề xuất là cấu trúc đang tồn tại trong hệ thống.

## Các thành phần và ranh giới

| Thành phần | Trách nhiệm | Đầu ra |
|---|---|---|
| Report UI | Wizard grid manager dashboard state và keyboard | Request theo API contract và trạng thái người dùng |
| Report Application Service | Điều phối publish period assignment submission grant | Transaction và revision hợp lệ |
| Authorization Policy | Kiểm tra configurer manager owner scope | Allow hoặc lỗi quyền |
| Template Service | Lưu file immutable parse schema layout và validation | TemplateVersion đã kiểm tra |
| Clock Schedule Service | Sinh kỳ và tính effective edit permission | Period và server time |
| Calculation Service | Công thức giới hạn aggregate snapshot | Số tổng kèm tập nguồn |
| Status Query Service | Tổng hợp nghĩa vụ trạng thái và chỉ số | KPI bảng ma trận |
| Export Worker | Dựng file từ snapshot typed values | File và metadata kiểm soát quyền |
| Database và private file store | Dữ liệu phiên bản audit và file | Lịch sử có thể đối soát |

## Luồng dữ liệu chính

Upload đi vào Template Service trong vùng xử lý giới hạn tài nguyên, tạo schema đã kiểm tra. Xuất bản liên kết template version với lịch và phân công. Scheduler sinh kỳ cùng assignments. Grid lấy schema của kỳ và submission của người hiện tại. Save đi qua policy và clock, validate rồi tạo revision. Calculation Service đọc một tập revision nhất quán; Status Service đọc assignment và submission state. Export dùng đúng snapshot đã chọn, không đọc dữ liệu biến động nhiều lần trong cùng job.

## Quy tắc triển khai thành phần

Mặc định xây thành module trong backend hiện có để giữ transaction và quyền nhất quán. Không tách microservice chỉ vì tên logic khác nhau. Parser và export có thể chạy worker riêng trong cùng hạ tầng khi benchmark cho thấy cần. Formula engine chạy phía server làm nguồn kết quả; frontend preview không có quyền quyết định số chính thức. Nếu dùng cùng engine hai phía vẫn phải có test expected độc lập.

## Quan hệ dữ liệu

ReportDefinition có nhiều TemplateVersion và ScheduleVersion, có nhiều ReportPeriod. Mỗi Period tham chiếu chính xác một TemplateVersion và có nhiều Assignment. Một Assignment có tối đa một Submission, Submission có nhiều revision. Assignment có nhiều UnlockGrant lịch sử nhưng quyền hiện tại tính từ các grant chưa thu hồi còn hiệu lực. AggregateSnapshot tham chiếu Period và tập revision nguồn. ReportManagerAssignment lưu lịch sử quyền quản lý; quyền xem hiện tại dùng assignment quản lý hiện hành, lịch sử audit không tự cấp quyền truy cập.

## 3. Kiến trúc thông tin và vai trò

Nhóm BÁO CÁO & THỐNG KÊ → “Báo cáo động”: **Thiết lập báo cáo**, **Nhập & tổng hợp**, **Tình trạng nhập liệu**. Giữ nguyên menu báo cáo nghiệp vụ hiện có. Tên tiếng Anh tương ứng: Report Setup, Report Register, Report Status.

| Chức năng | Người thiết lập | Người quản lý được gán | Người nhập được gán |
|---|---|---|---|
| Tạo mẫu, upload, lịch, phân công, xuất bản phiên bản | Có theo quyền cấu hình | Không mặc định | Không |
| Xem danh sách báo cáo | Theo phạm vi cấu hình | Chỉ báo cáo quản lý | Chỉ báo cáo được nhập |
| Xem tổng hợp và dữ liệu từng người | Chỉ khi có quyền xem dữ liệu riêng | Có, trong báo cáo quản lý | Chỉ dữ liệu của mình |
| Sửa dữ liệu nhập | Không mặc định | Không trong chế độ quản lý | Của mình, còn hạn hoặc được mở khóa |
| Mở khóa một người, một kỳ | Không mặc định | Có, có thời điểm hết hiệu lực và lý do | Không |
| Xem tình trạng toàn bộ người nhập | Theo quyền giám sát riêng | Trong báo cáo quản lý | Chỉ việc được giao của mình |
| Xuất Excel | Theo quyền xem tương ứng | Tổng hợp và cá nhân trong phạm vi | Dữ liệu của mình |

Một tài khoản có cả hai vai trò: có nút chuyển **“Báo cáo tôi nhập / Báo cáo tôi quản lý”**. Chế độ quản lý luôn chỉ đọc; chỉ trong chế độ nhập mới sửa được bản ghi của chính mình. Quyền backend dựa trên assignment thật, không dựa vào mode gửi từ trình duyệt. Admin hệ thống không tự động được sửa hộ số liệu; quyền xem rộng phải khớp chính sách hiện hành sau khi khảo sát repository.

## 8. Tiêu chuẩn UI và trạng thái bắt buộc

Desktop 1440/1366 là ưu tiên; kiểm tra thêm 1024 và 768. Trên điện thoại cho xem, chọn kỳ, xem tiến độ; nếu cần nhập bảng rộng vẫn giữ cuộn ngang và mở editor từng ô, không tự biến đổi cấu trúc Excel. Không coi desktop screenshot là bằng chứng mobile đạt yêu cầu.

| Tình huống | A — Setup | B — Register | C — Status |
|---|---|---|---|
| Loading | Progress upload/parse, disable xuất bản | Skeleton lưới đúng trang, disable input | Skeleton KPI/bảng, không để số cũ trông như mới |
| Empty | Hướng dẫn tạo mẫu đầu tiên | Không có phân công hoặc chưa có kỳ | Không có lượt giao trong bộ lọc |
| Error | Sheet!Cell + nguyên nhân + cách sửa | Lỗi ngay ô và drawer tổng; lỗi lưu riêng | Giữ filter, thông báo tải lỗi và retry |
| Permission | Không có quyền tạo/đổi mẫu | Không quyền khác với không dữ liệu; backend từ chối | Không lộ số tổng ngoài phạm vi |
| Boundary | Mẫu lỗi/không input/vượt giới hạn | Hết hạn, mất mạng, nhiều tab, mở lại hết hạn | Mẫu số 0, kỳ tương lai, user vô hiệu |

Label rõ, focus nhìn thấy, điều khiển bằng bàn phím, tooltip đọc bằng keyboard, lỗi gắn aria-describedby, trạng thái lưu qua live region. Date/time có thể gõ và dùng picker; không phụ thuộc placeholder. Màu tương phản kiểm tra ở bước thiết kế chi tiết, mục tiêu WCAG AA. Với grid tùy biến/canvas phải chứng minh keyboard và accessibility trước khi chọn thư viện.

## 9. Thiết kế dữ liệu đề xuất

| Entity | Trường và ràng buộc trọng yếu |
|---|---|
| ReportDefinition | id, code unique, name, description, owner/configurer, lifecycle, effective_from |
| TemplateVersion | report_id, version, immutable file hash/reference, schema JSON, style/layout, parser_version, validation_result; unique(report_id, version) |
| FieldDefinition | template_version_id, sheet_id, cell_address, field_id, label, type, format, aggregate, required, limits; unique(version, sheet, anchor cell) |
| ScheduleVersion | report_id, recurrence, cutoff rule, opening rule, timezone, effective_from; giữ lịch sử |
| ReportPeriod | report_id, period_key, start/end, opens_at, original_due_at, template_version_id, schedule snapshot; unique(report_id, period_key) |
| Assignment | period_id, input_user_id, unit snapshot, obligation state; unique(period_id, input_user_id) |
| ReportManagerAssignment | report_id, manager_user_id, valid_from/to; đúng một quản lý hiện hành theo đề xuất |
| Submission | assignment_id unique, current_revision, progress, first_saved_at, first_completed_at, current_completed_at, updated_at |
| SubmissionRevision | submission_id, revision unique, typed values, completion flag, actor, committed_at; bất biến để audit và aggregate snapshot |
| UnlockGrant | assignment_id, starts_at, expires_at, reason, granted_by, revoked_at/by/reason; không đổi original_due_at |
| AggregateSnapshot | period_id, mode, source revision vector/hash, values, created_at, schema/engine version; tái tạo được |
| AuditEvent | actor, action, report/period/assignment, field/revision diff, timestamp, reason, correlation id; append-only theo quyền |

Ưu tiên lưu revision dữ liệu dạng JSON typed và chỉ mục các field cần lọc; có thể dùng bảng cell nếu schema hiện hành thuận lợi. Quyết định JSON/bảng cell sau benchmark, không tạo bảng DB mới cho mỗi file Excel. Dữ liệu số dùng decimal chuẩn, DATE dùng date-only, TIME dùng time-only. Audit dữ liệu có kiểm soát truy cập và retention theo chính sách hệ thống; log vận hành không chứa mật khẩu hoặc toàn bộ nội dung ô.

## 10. API logic, an toàn ghi và hiệu năng

Tên endpoint chỉ minh họa, sẽ theo convention repository khi có quyền đọc code.

| API đề xuất | Hợp đồng chính |
|---|---|
| POST /report-templates/validate | Upload .xlsx → parse job/id + lỗi theo ô + preview schema; không tự publish |
| POST /reports; PATCH /reports/:id/draft | Tạo/sửa nháp có optimistic version; chỉ người có quyền cấu hình |
| POST /reports/:id/publish | Chốt template/schedule/assignment policy bất biến, idempotency key |
| GET /reports?mode=input hoặc manage | Chỉ trả báo cáo có quyền; mode không phải authorization |
| GET /reports/:id/periods | Kỳ trong phạm vi, server time, hạn và version |
| GET /periods/:id/my-submission | Schema/layout + typed values + current revision + effective permissions |
| PATCH /assignments/:id/values | expected_revision + idempotency key + cell patches; validate toàn batch; save nguyên tử |
| POST /assignments/:id/complete | Kiểm tra đủ dữ liệu và quyền/hạn trong cùng transaction; chốt revision hoàn thành |
| GET /periods/:id/aggregate | mode=all_saved/completed, snapshot revision vector, contributors count |
| GET /assignments/:id/submission | Quản lý có quyền hoặc chủ bản ghi; không dựa vào user_id tự khai |
| POST /assignments/:id/unlock; POST /grants/:id/revoke | Kiểm tra quản lý, thời gian, lý do, audit; idempotent |
| GET /report-status; GET /assignments/:id/history | Filter/pagination server-side, cùng phạm vi quyền với dữ liệu chi tiết |
| POST /periods/:id/exports | Chụp snapshot nhất quán, tạo file theo template, quyền trên job và download |

Server kiểm tra theo thứ tự trong transaction: xác thực → phạm vi assignment → active user → template/field allowlist → effective deadline → expected revision → validate → persist revision/audit. Thời điểm kiểm tra hạn phải sát quyết định commit, không chỉ ở lúc request vào queue. Các write đồng thời dùng lock/compare-and-swap; một thành công, request revision cũ trả 409 kèm hướng dẫn tải dữ liệu mới, không last-write-wins âm thầm.

Mã lỗi nghiệp vụ: REPORT_LOCKED (409, hạn gốc/hạn hiệu lực), REVISION_CONFLICT (409), CELL_VALIDATION (422, Sheet!Cell), TEMPLATE_INVALID (422), FORBIDDEN (403 hoặc 404 theo convention chống lộ existence), RATE_LIMITED (429). Quyền được kiểm tra lại cho export/download và aggregate drill-down, không chỉ màn hình.

Hết hạn khi đang mở nhiều tab: tab bị mất focus phải refresh quyền khi quay lại; UI nhận server event hoặc polling nhẹ; server vẫn là chốt chặn cuối. Job chậm không gia hạn. Grant hết hạn hoặc user bị gỡ quyền trong lúc đang nhập phải chặn request mới. Autosave retry dùng idempotency key; không sinh revision trùng hoặc reset completed sai.

Upload parse chạy cô lập, chống ZIP bomb/XML entity, giới hạn CPU/memory, không fetch URL nhúng, quét file theo hạ tầng hiện có. Spreadsheet xuất phải chống formula injection cho TEXT; engine công thức chỉ chạy trên formula template đã duyệt. Không đưa dữ liệu qua SaaS bên ngoài để parse/tính toán theo mặc định.

Mục tiêu benchmark đề xuất, chưa đo trên hệ thống: workbook 5.000 input, 200 người/kỳ; mở form p95 ≤3 giây sau khi API sẵn sàng, autosave p95 ≤1 giây, aggregate/status p95 ≤3 giây trên môi trường test đã ghi cấu hình. Thử 50 người lưu đồng thời, không mất/nhân đôi dữ liệu. Cache aggregate có khóa theo revision và invalidation khi save; nhãn “cập nhật lúc” phản ánh thật. Giới hạn tải phải thống nhất sau spike và không dùng các con số này như cam kết năng lực hiện hành.

## 12. Phương án triển khai và phân rã công việc

So sánh: (a) iframe spreadsheet service — không chọn mặc định vì dữ liệu đi ngoài hệ thống và khó gắn quyền/hạn; (b) grid/spreadsheet engine tích hợp trong ứng dụng — ưu tiên, nhưng cần đánh giá license, formula, merge, accessibility; (c) dựng HTML table thuần — phù hợp mẫu đơn giản, chi phí tăng mạnh cho Excel rộng/công thức. Spike sẽ chọn (b) hoặc (c) trên file thật; không chốt tên package/license khi chưa kiểm tra stack và nhu cầu.

WBS chi tiết, dependencies, AC, test case và bằng chứng nằm ở phần phụ lục sinh kèm dưới đây và EXECUTION_CONTRACT.yaml. Ước lượng là ngày công, không phải số ngày lịch; chỉ gồm module mới, chưa gồm sửa lỗi nền tảng ngoài phạm vi. Mỗi task thực hiện RED → GREEN → REFACTOR; test hành vi, không kiểm thử đơn thuần rằng code hiện tại tồn tại.

Lịch dự kiến 8 tuần với 1 BE, 1 FE, QA 0,5–1 người và BA/UX bán thời gian: tuần 1 chốt nghiệp vụ/spike; tuần 2 nền dữ liệu/lịch/quyền và UI setup; tuần 3–4 parser/render/input; tuần 5 tổng hợp/mở lại; tuần 6 status/export; tuần 7 kiểm thử tích hợp/tải/quyền; tuần 8 UAT/pilot/khắc phục. Tối ưu song song BE/FE khi contract ổn định. Không bắt đầu chức năng phụ trước khi đạt P0 về khóa, quyền và tính đúng.

## 14. Rủi ro, triển khai thử và rollback

| Rủi ro | Giảm thiểu | Phát hiện |
|---|---|---|
| Sai ô input do Locked/style kế thừa | Resolve effective style, preview trước publish | Golden template và đối soát từng Sheet!Cell |
| Sai tổng do null/0, nháp, phần trăm | Typed decimal, aggregate mode rõ, formula tổng đúng tầng | Fixture số độc lập và drill-down |
| Lách hạn bằng API/đồng hồ client | Check server trong transaction | IT thời gian biên và request giả |
| Mất cập nhật do nhiều tab | Expected revision + idempotency | Test 2 tab và concurrent write |
| Đổi mẫu làm hỏng lịch sử | Immutable template version, snapshot kỳ | Re-open kỳ cũ sau publish mẫu mới |
| Template quá nặng/phần mềm Excel không tương thích | Limits, whitelist, spike engine/license | Parse report, load test, visual diff |
| Quyền frontend khác backend | Một policy dùng xuyên suốt data/status/export | Negative authorization suite |
| Ước lượng thấp do chưa có code/mẫu thật | Milestone khảo sát và cập nhật WBS sau spike | Gate M01 không đạt thì không bắt đầu xây engine |

Rollout: migration additive → feature flag tắt mặc định → triển khai staging → UAT với dữ liệu giả → pilot 1–2 mẫu và nhóm nhỏ được chỉ định → đối soát số + log một chu kỳ → mở rộng. Migration không thay/xóa bảng báo cáo cũ. Backup, thử restore và kiểm tra tương thích phiên bản trước khi go-live.

Rollback: tắt cờ truy cập module/ghi mới, giữ dữ liệu và revision đã nhập; khôi phục bản ứng dụng tương thích; không drop bảng mới trong incident. Worker sinh kỳ/export phải idempotent và có version để không xử lý nhầm payload. Nếu sai công thức, giữ snapshot sai có dấu vô hiệu, tạo snapshot sửa và audit; không ghi đè lịch sử. Thông báo rõ cho người dùng về dữ liệu đang tạm dừng, không để autosave tiếp tục báo thành công.

Quan sát vận hành: tỷ lệ parse thất bại, save lỗi/409, request bị chặn quá hạn, grant còn hiệu lực, job trễ/sinh trùng, thời gian aggregate/export, chênh lệch đối soát. Alert theo ngưỡng chốt sau baseline; log dùng correlation id và định danh tham chiếu, tránh toàn bộ giá trị báo cáo.

