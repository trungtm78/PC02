# BRD Báo cáo động PC02

Tài liệu xác định mục tiêu nghiệp vụ và phạm vi triển khai chức năng báo cáo theo mẫu Excel cho người thiết lập, người quản lý và người nhập. Kết quả cần đạt là người nhập làm việc trên biểu mẫu quen thuộc, quản lý xem số tổng có thể đối soát, và hệ thống cưỡng chế hạn nhập chính xác.

Phiên bản 1.0 ngày 09/10/2026. Chủ sở hữu nghiệp vụ và người phê duyệt: do đơn vị chỉ định. Trạng thái đề xuất chờ duyệt các quyết định D01 đến D10.

## Mục tiêu nghiệp vụ

| Mã | Mục tiêu và phạm vi |
|---|---|
| BR-01 | Tái sử dụng bố cục Excel để định nghĩa ô nhập mà không viết riêng từng màn báo cáo |
| BR-02 | Tự sinh kỳ và cưỡng chế hạn hoàn thành theo tuần tháng quý hoặc ngày cụ thể |
| BR-03 | Giao đúng người quản lý và nhiều người nhập theo từng báo cáo |
| BR-04 | Xem dữ liệu từng người và tổng hợp có nguồn gốc số liệu rõ |
| BR-05 | Cho phép nhập lại có thời hạn theo từng người và từng kỳ |
| BR-06 | Kiểm soát kiểu dữ liệu và định dạng ngay khi nhập |
| BR-07 | Lưu nháp an toàn và xác nhận hoàn thành tách biệt |
| BR-08 | Theo dõi đầy đủ nghĩa vụ báo cáo kể cả người chưa nhập |
| BR-09 | Giữ lịch sử mẫu dữ liệu phân công và xuất báo cáo đối soát |
| BR-10 | Tích hợp vào PC02 với quyền đúng tính ổn định và khả năng sử dụng phù hợp |

## Quy trình nghiệp vụ đích

Người thiết lập chuẩn bị file Excel và gán token cho ô unlocked. Sau khi kiểm tra preview, người thiết lập chọn lịch, phân công và xuất bản. Hệ thống sinh kỳ và các lượt giao. Người nhập chọn báo cáo và kỳ, lưu dữ liệu, kiểm tra và xác nhận hoàn thành. Khi tới hạn, server chặn mọi ghi không có grant còn hiệu lực. Người quản lý xem tổng hoặc từng người, có thể mở lại một lượt giao kèm lý do và ngày giờ khóa lại. Màn tình trạng luôn lấy toàn bộ lượt giao làm cơ sở để không bỏ sót người chưa nhập.

## Ranh giới phạm vi và giá trị

Phải có trong lần triển khai lõi: A B C, grammar token, lưu và tổng hợp, kỳ và khóa, mở lại, phân quyền, lịch sử và xuất Excel. Không yêu cầu thay thế các báo cáo nghiệp vụ đang sinh từ hồ sơ; không có luồng phê duyệt nhiều cấp, chữ ký số, lấy tự động số liệu hồ sơ, hay gửi email SMS trong phạm vi lõi. Các nội dung này chỉ thêm khi có yêu cầu thay đổi riêng.

Lợi ích dự kiến: giảm thời gian tạo màn nhập cho mẫu mới, giảm nhập sai kiểu, giảm tổng hợp thủ công và phát hiện chậm báo cáo sớm hơn. Chưa có baseline thực tế để cam kết phần trăm tiết kiệm. Pilot đo thời gian setup một mẫu, tỷ lệ lỗi input, thời gian đối soát và số lượt phải nhắc việc trước và sau.

## Các bên tham gia và trách nhiệm

| Vai trò | Trách nhiệm |
|---|---|
| Chủ nghiệp vụ | Chốt kỳ hạn ý nghĩa tổng hợp và nghiệm thu số liệu |
| Người thiết lập | Chuẩn bị mẫu kiểm tra schema lịch phân công và phiên bản |
| Người quản lý | Theo dõi xem dữ liệu và quyết định mở lại trong phạm vi |
| Người nhập | Nhập đúng dữ liệu tự kiểm tra và hoàn thành trước hạn |
| BA UX | Quản lý yêu cầu quyết định nghiệp vụ và tính dễ dùng |
| BE FE | Xây dựng theo FRD và thiết kế đã chốt giữ traceability |
| QA và người dùng UAT | Kiểm thử hành vi quyền thời gian số tổng và trải nghiệm |
| Vận hành | Triển khai sao lưu giám sát và phục hồi |

## 1. Nguồn yêu cầu, phạm vi và mức độ xác minh

Nguồn chính: yêu cầu A/B/C trong hội thoại ngày 09/10/2026. Khảo sát trực tiếp bằng tài khoản được cung cấp tại https://new.pc02hcm.com/login, hệ thống hiển thị phiên bản 0.74.0.0. Đã đăng nhập thành công; quan sát Dashboard, Báo cáo tháng, Thống kê 48 trường, danh sách và form thêm Mẫu chứng từ; mở nhóm Báo cáo & Thống kê, Hệ thống, Quản trị. Không sao chép dữ liệu hồ sơ vào tài liệu thiết kế.

Chưa được cung cấp repository, API specification, database schema, Excel template thật hoặc tài khoản riêng cho người quản lý/người nhập. Vì vậy nhận xét giao diện có bằng chứng trực tiếp; thiết kế dữ liệu/API bên dưới là đề xuất, chưa khẳng định kiến trúc backend hiện hành. Chưa kiểm thử quyền hoặc hành vi ghi trên hệ thống thật. Không kết luận một chức năng không tồn tại chỉ vì chưa thấy trên menu.

Phạm vi chính: A — Thiết lập báo cáo từ Excel; B — Nhập và tổng hợp báo cáo theo người dùng; C — Theo dõi tình trạng nhập liệu. Bao gồm phân quyền, kỳ/hạn, mở khóa, phiên bản mẫu, nhật ký, xuất Excel phục vụ đối soát. Không thay thế các báo cáo tháng/quý đang lấy số liệu từ hồ sơ nghiệp vụ; không tự động đưa dữ liệu vụ án sang báo cáo động trong giai đoạn này.

## 2. Đánh giá UI/UX hiện trạng

| Quan sát trực tiếp | Tác động | Đề xuất áp dụng |
|---|---|---|
| Sidebar xanh đậm, điểm nhấn vàng, nội dung nền sáng; đã chia nhóm chức năng | Nhận diện nhất quán, có thể kế thừa | Giữ khung ứng dụng, font và thành phần hiện có; thêm nhóm “Báo cáo động” với 3 mục |
| Báo cáo tháng có chọn kỳ, phiên bản, tải xuống, tab phụ lục và khay vấn đề | Có mẫu tương tác phù hợp cho báo cáo | Kế thừa bộ lọc kỳ và cách liệt kê lỗi; tách phiên bản mẫu và phiên bản dữ liệu |
| Khi chuyển sang báo cáo tháng, URL đổi trước khi nội dung cũ biến mất; sau đó có “Đang mở báo cáo” | Người dùng có thể hiểu nhầm đang xem đúng trang | Chuyển ngay sang skeleton của trang đích, khóa thao tác khi đang tải |
| Ở viewport khoảng 1363×936, một số tên tab phụ lục bị cắt và cần cuộn ngang | Khó nhận biết đang ở phần nào | Tab sheet có tên đầy đủ khi focus/hover, dropdown “Tất cả sheet”, chế độ toàn màn hình |
| Sidebar, tab phụ lục, bảng và khay vấn đề cùng có vùng cuộn | Giảm diện tích nhập; dễ mất vị trí | Khay lỗi dạng drawer đóng/mở; sidebar có thể thu gọn; chỉ một vùng cuộn chính cho lưới |
| Một số mã trạng thái như TIEP_NHAN và DA_CHUYEN_DON_VI xuất hiện ở giao diện đã xem | Người dùng phải tự diễn giải mã nội bộ | Toàn bộ trạng thái mới dùng tiếng Việt, badge có chữ và biểu tượng |
| Báo cáo tháng có tiến độ 25%, nhưng tại vùng đã xem không thấy định nghĩa mẫu số ngay cạnh | Có thể hiểu sai “tiến độ” | C hiển thị rõ “Đã hoàn thành X/Y lượt được giao”, có tooltip công thức |
| Mẫu chứng từ hỗ trợ .docx, placeholder và ánh xạ biến | Khác bản chất Excel nhập liệu theo ô | Xây module báo cáo động riêng; chỉ tái sử dụng upload/storage/audit nếu kiểm tra code thấy phù hợp |
| Thống kê 48 trường có khoảng ngày, đơn vị, “Xem thống kê”, empty state | Mẫu filter đơn giản, dễ hiểu | Giữ cách lọc nhưng ưu tiên kỳ báo cáo theo lịch của từng mẫu |

Mức ưu tiên: P0 — khóa/phân quyền/tính đúng; P1 — luồng nhập, trạng thái lưu, tổng hợp và tiến độ; P2 — tiện ích hiển thị và tối ưu thao tác. Đây là đánh giá định tính theo phiên khảo sát, không phải điểm usability đã đo với người dùng.

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

## 11. Các quyết định cần chốt trước triển khai

| ID | Vấn đề | Đề xuất đang dùng trong bản thiết kế | Ảnh hưởng nếu thay đổi |
|---|---|---|---|
| D01 | “Ngày chính xác” một lần hay lặp theo ngày? | Một kỳ một lần | Thêm recurrence daily nếu muốn lặp |
| D02 | Hạn nằm trong kỳ hay sau kỳ? | Có lựa chọn kỳ hiện tại/kế tiếp, mở từ đầu kỳ | Chi phối sinh kỳ và quá hạn |
| D03 | AVG/null và dữ liệu nháp | Bỏ null; tính 0; mặc định tổng hợp all_saved có nhãn tạm tính | Thay đổi số tổng và KPI |
| D04 | Thế nào là hoàn thành? | Có nút Hoàn thành; sửa sau đó chuyển Đang nhập | Cần điều chỉnh C nếu chỉ dựa trên độ điền |
| D05 | Công thức Excel trong ô khóa | Hỗ trợ whitelist sau spike; coi là ô tính readonly | Có thể giảm phạm vi chỉ hỗ trợ token, nếu mẫu thật không có formula |
| D06 | Một người = một bản nhập hay một đơn vị = một bản? | Đúng yêu cầu: một người một bản/ kỳ | Nếu nhiều người cùng sửa bản đơn vị cần đổi khóa chính và concurrency |
| D07 | Trường bắt buộc và thời điểm +3h | Mặc định bắt buộc, có cấu hình; +3h là datetime đầy đủ | Ảnh hưởng validation, tỷ lệ và mở lại qua ngày |
| D08 | Ngày 31 ở tháng ngắn, quý | Cuối tháng; quý chọn tháng thứ mấy và ngày | Tránh lịch không tồn tại |
| D09 | Đổi template/phân công giữa kỳ | Áp dụng kỳ tiếp theo; kỳ hiện hành cần quy trình riêng | Ảnh hưởng lịch sử/mẫu số |
| D10 | Phạm vi quyền admin và công nghệ hiện hành | Tái sử dụng RBAC sau kiểm tra repository | Không thể chốt API/schema migration khi chưa có code |

Các mục này đã có phương án mặc định cụ thể để anh review, không dừng việc lập kế hoạch. **Điểm chặn bắt đầu code:** cần repository/baseline triển khai; ít nhất 2–3 Excel thật gồm mẫu rộng, merge, formula; xác nhận D01–D10 (có thể duyệt nguyên bộ đề xuất); môi trường test và tài khoản quản lý/người nhập để xác minh phân quyền. Chưa có các bằng chứng này nên không gắn nhãn READY FOR EXECUTION.

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

## 15. Definition of Done

Task: AC tương ứng pass, test mục tiêu và regression bị ảnh hưởng pass, review không còn P0/P1, bằng chứng mới gắn commit/environment, tài liệu cập nhật. Milestone: toàn task pass; regression của module và luồng liên quan pass; UX/loading/empty/error/permission/boundary đạt; không còn P0/P1. Project: mọi AC được nghiệm thu, UAT 100% AC pass, kiểm tra quyền/khóa/tổng/export/tải đạt, người dùng nghiệp vụ chấp thuận pilot, rollback/restore thử thành công. Không lấy coverage phần trăm thay thế nghiệm thu hành vi.

**PLAN STATUS: BLOCKED FOR EXECUTION — phần phân tích và thiết kế đề xuất đã hoàn tất; chưa có repository baseline, Excel thật và xác nhận các quyết định nghiệp vụ D01–D10 để chốt contract triển khai.** Không có test sản phẩm nào được tuyên bố đã chạy từ phiên khảo sát chỉ đọc này.
