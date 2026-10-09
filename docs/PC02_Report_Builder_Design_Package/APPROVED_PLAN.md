# PC02 — Kế hoạch chức năng và UI/UX báo cáo động

Phiên bản đề xuất 1.0 · 09/10/2026 · Múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7)

**Trạng thái: kế hoạch đề xuất để duyệt, chưa phê duyệt triển khai.** Tên file APPROVED_PLAN.md theo quy ước bộ bàn giao SDLC, không có nghĩa người dùng đã duyệt. Không thực hiện thay đổi cấu hình, ghi dữ liệu báo cáo hay triển khai lên hệ thống.

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

## 4. A — Thiết lập báo cáo (Report Builder)

### 4.1 Danh sách và vòng đời mẫu

Bảng: Mã, Tên báo cáo, Loại kỳ, Hạn tiếp theo, Người quản lý, Số người nhập, Phiên bản mẫu, Trạng thái, Cập nhật gần nhất. Filter: tên/mã, loại kỳ, người quản lý, trạng thái. Hành động: Tạo báo cáo, Xem, Sửa bản nháp, Tạo phiên bản mới, Sao chép cấu hình, Ngừng phát sinh kỳ mới. Không xóa cứng báo cáo đã có dữ liệu.

Vòng đời: Nháp → Đã xuất bản → Ngừng phát sinh kỳ. Bản nháp chưa hiện cho người nhập. Chỉ xuất bản khi file hợp lệ, có lịch hợp lệ, có đúng một quản lý và ít nhất một người nhập đang hoạt động. Ngừng phát sinh kỳ không âm thầm đóng kỳ đang mở; muốn đóng kỳ cần thao tác riêng và nhật ký.

### 4.2 Wizard 4 bước

| Bước | Nội dung | Kiểm tra và phản hồi |
|---|---|---|
| 1. Thông tin & mẫu Excel | Mã duy nhất, tên, mô tả, upload .xlsx, xem hướng dẫn tạo mẫu | Kiểm tra cấu trúc file, giới hạn, báo tiến trình; thay file có cảnh báo nếu làm mất mapping nháp |
| 2. Kiểm tra ô nhập | Preview theo sheet; màu phân biệt ô tĩnh/ô nhập/ô công thức; click ô mở bảng thuộc tính | Danh sách lỗi có Sheet!Cell, nguyên nhân, cách sửa; chặn xuất bản nếu còn lỗi |
| 3. Kỳ & hạn nhập | Tuần/tháng/quý/ngày cụ thể; chọn thời điểm mở, ngày chốt, giờ chốt; múi giờ | Câu mô tả tự nhiên và preview ít nhất 6 kỳ kế tiếp, kể cả ngày không tồn tại |
| 4. Phân công & xác nhận | 1 quản lý, nhiều người nhập; tìm theo tên/mã/đơn vị; tổng kết toàn bộ cấu hình | Loại trùng, cảnh báo user ngừng hoạt động; chọn phạm vi áp dụng từ kỳ nào; Lưu nháp / Xuất bản |

Footer cố định: Quay lại, Lưu nháp, Tiếp theo/Xuất bản. Khi đang parse hoặc lưu: disable nút gây gửi trùng. Nếu mất mạng: giữ form trong phiên hiện tại, cho thử lại. Khi thoát có thay đổi chưa lưu: cảnh báo. Không lưu dữ liệu nhạy cảm vào localStorage theo mặc định.

### 4.3 Quy ước đọc Excel

**Nguồn định nghĩa trường là giá trị token trong ô unlocked; định dạng hiển thị/style đọc từ workbook.** Không suy đoán kiểu dữ liệu từ màu nền hoặc giá trị số hiện có. Đọc thuộc tính Locked hiệu lực sau khi resolve style kế thừa, không chỉ cờ có/không trong XML.

Trong Excel, bảo vệ ô liên quan đồng thời tới Locked và sheet protection. Module này dùng Locked như metadata nghiệp vụ ngay cả khi sheet chưa bật Protect Sheet; server vẫn tự cưỡng chế quyền. Đây là quy ước chủ động của ứng dụng, không xem bảo vệ Excel là cơ chế bảo mật của website. Tham khảo Microsoft: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.protection?view=openxml-3.0.1

| Trường hợp | Xử lý đề xuất |
|---|---|
| Locked=true, literal | Ô tĩnh, giữ nội dung và style, không nhận input |
| Locked=false, token hợp lệ | Sinh input theo kiểu dữ liệu; token không xuất hiện trong bản nhập |
| Locked=false, ô trống hoặc literal không phải token | Lỗi cấu hình tại địa chỉ ô; không tự gán TEXT |
| Locked=true nhưng chứa token | Báo lỗi “Ô định nghĩa trường đang khóa”; tránh vô tình hiển thị token như nội dung |
| Ô có công thức Excel | Mở rộng đề xuất: ô tính toán chỉ đọc, phải Locked=true; không coi là input |
| Công thức trong ô unlocked | Chặn xuất bản; yêu cầu khóa ô hoặc thay bằng token |
| Ô gộp | Chỉ ô góc trên trái là field; toàn vùng dùng cùng quyền; phát hiện metadata xung đột |
| Sheet/hàng/cột ẩn có input | Báo lỗi, yêu cầu làm hiện hoặc loại khỏi vùng báo cáo; không tạo việc bắt buộc vô hình |
| Sheet phụ tĩnh dùng trong công thức | Chỉ chấp nhận nếu nằm trong phạm vi engine đã hỗ trợ và được hiển thị trong preview thiết lập |

Chỉ hỗ trợ `.xlsx` giai đoạn 1. Không hỗ trợ `.xls`, `.xlsm`, file mã hóa bằng mật khẩu, macro, OLE, external link hay data connection. Kiểm tra cả nội dung ZIP/XML và MIME; không chỉ extension. Giới hạn đề xuất cho spike: 10 MB nén, 100 MB giải nén, tối đa 5 sheet báo cáo, 50.000 ô có nội dung/style trong vùng dùng, 5.000 input/workbook. Các mức này là mục tiêu thử nghiệm, phải điều chỉnh theo mẫu thật; file vượt giới hạn bị từ chối có lý do, không cắt mất ô.

Giữ các thuộc tính trọng yếu: thứ tự sheet, nội dung, merge, độ rộng cột, chiều cao dòng, border, màu nền, font, căn lề, wrap, format số/ngày, freeze panes và print area đã hỗ trợ. Đánh giá riêng ảnh/logo, conditional formatting, biểu đồ, pivot, named ranges; nếu có thành phần không hỗ trợ phải báo trước khi xuất bản. Không cam kết giống Excel 100% với mọi workbook.

### 4.4 Grammar và kiểm tra dữ liệu

Grammar v1: `{TYPE}`, `{TYPE|FORMAT}`, `{TYPE|FORMAT|AGG}`. Cho phép format rỗng như `{NUM||SUM}`; trim khoảng trắng ngoài token, type/agg không phân biệt hoa thường; giữ nguyên nội dung format. Token phải chiếm toàn bộ giá trị ô. Ký tự phân cách `|` và dấu ngoặc không được nhúng trong format ở v1. Format không hợp lệ bị báo tại thiết lập, không rơi về dạng khác âm thầm.

| Token | Input | Lưu trữ/hiển thị | Tổng hợp |
|---|---|---|---|
| `{NUM|#,##0|SUM}` | Số; không cho chữ, NaN, infinity, scientific notation ở v1 | Decimal; hiển thị dấu phân nhóm theo locale cấu hình | Cộng các giá trị hợp lệ cùng ô |
| `{NUM|#,##0.00|AVG}` | Số thập phân | Format chỉ định hiển thị; precision/scale là rule riêng | Tổng chia số giá trị có mặt |
| `{TEXT}` | Text Unicode, không ép chuỗi mã thành số | Giữ số 0 đầu; escape khi render | Không tổng hợp |
| `{DATE|dd/mm/yyyy}` | Date picker hoặc gõ đúng ngày/tháng/năm | Lưu ngày ISO yyyy-mm-dd, không đổi múi giờ | Không tổng hợp mặc định |
| `{TIME|hh:mm}` | Time picker 24 giờ | Lưu HH:mm, không tự hiểu là duration | Không tổng hợp mặc định |

Chuẩn hóa `Num` → NUM. Từ `agv` trong yêu cầu được hiểu là ý định AVG; đề xuất chấp nhận AGV như alias có cảnh báo ở bước import và lưu chuẩn AVG. `dd/MM/yyyy` và `dd/mm/yyyy` trong DATE đều chuẩn hóa sang bộ format ngày của hệ thống; không truyền trực tiếp chuỗi Excel cho thư viện date frontend. TIME dùng parser riêng để tránh nhầm tháng với phút.

NUM: mặc định cho số âm; nếu chỉ tiêu là số lượng thì cấu hình min=0, scale=0 ở bảng thuộc tính. Định dạng `#,##0` không tự biến dữ liệu 1.5 thành 2 khi lưu; nếu không đặt scale=0 thì giá trị vẫn là 1.5, chỉ hiển thị làm tròn. Preview phải cho thấy cả raw và formatted để phát hiện sai lệch. Đề xuất decimal tối đa 18 chữ số, 4 số lẻ; vượt giới hạn phải báo lỗi, không tự làm tròn dữ liệu nhập.

Locale đề xuất vi-VN: giải thích ngay dưới trường cách nhập `1.234,50`; chấp nhận dạng không nhóm `1234,50`, dùng cùng quy tắc khi paste. Không tự đoán giữa dấu chấm thập phân và dấu chấm phân nhóm; trường hợp mơ hồ phải báo cách sửa. Request API truyền decimal dưới dạng chuỗi chuẩn `1234.50`, không dùng số float làm nguồn sự thật.

DATE từ chối 31/02, chuỗi số như 12345, ngày thiếu năm hoặc không đúng format; picker luôn có. TIME từ chối 25:80 và giá trị số không có cấu trúc giờ. DATE nhận năm 4 chữ số; quy tắc khoảng ngày cấu hình riêng. Khi đọc/export Excel phải xử lý date system 1900/1904; không diễn giải mọi number thành ngày. Nguồn: https://support.microsoft.com/en-us/excel/date-systems-in-excel

Thuộc tính bổ sung ở bảng thiết lập, không làm phức tạp token: tên field hiển thị, bắt buộc, min/max, scale, max length, hướng dẫn. Đề xuất mặc định tất cả input bắt buộc, người thiết lập có thể bỏ chọn; TEXT mặc định tối đa 2.000 ký tự. Khi nhãn khó suy ra từ tiêu đề dòng/cột, yêu cầu người thiết lập đặt tên; địa chỉ Sheet!Cell vẫn luôn hiện để đối soát.

### 4.5 Tổng hợp và công thức — hai lớp riêng

AGG giai đoạn 1: NUM hỗ trợ SUM, AVG, MIN, MAX, COUNT; mọi kiểu hỗ trợ NONE; TEXT/DATE/TIME chưa cho tổng hợp ngoài NONE. Không có AGG → NONE. Không dùng SUM cho ngày hoặc văn bản. Metadata không phải Excel formula và không được thực thi như mã.

Bản tổng dùng cùng template. Ô tĩnh giữ nguyên; ô NUM có AGG tính theo cùng template version + kỳ + địa chỉ; ô input NONE hiện “— / Không tổng hợp”, cho drill-down xem từng người. Không tự nối TEXT, lấy người cuối hay lấy ngày gần nhất. Ô trống là null, khác số 0. SUM/AVG/MIN/MAX trên tập rỗng hiện “—”; COUNT hiện 0; AVG bỏ null, tính cả 0. Ví dụ A2 của ba người là 10, 0, null → SUM=10, AVG=5, COUNT=2. Mỗi assignment chỉ đóng góp một revision hiệu lực, không cộng các lần lưu lịch sử.

Mặc định tổng hợp **dữ liệu hợp lệ đã lưu của tất cả người được giao**, kể cả nháp, đúng yêu cầu quản lý xem toàn bộ dữ liệu đã nhập. Luôn ghi “Tạm tính — X/Y đã hoàn thành; Z/Y đã có dữ liệu”. Có lựa chọn “Chỉ bản đã hoàn thành” tách biệt; export lưu rõ chế độ, tập revision và thời điểm. Không trình bày số tạm tính như số đã chốt.

Đề xuất hỗ trợ công thức nội bộ được giới hạn: +, -, *, /, SUM, AVERAGE, MIN, MAX, COUNT, IF, ROUND, tham chiếu A1/range trong workbook. Spike phải xác nhận danh sách thật trước khi cam kết. Chặn vòng lặp, external link, hàm không cho phép; timeout tính toán; không eval chuỗi tùy ý. Cache result của Excel không là nguồn tính chính vì có thể đã cũ.

Thứ tự: (1) tính ô công thức từng người; (2) tổng hợp các ô input có AGG; (3) tính lại công thức trên bản tổng. Không cộng trực tiếp các tỷ lệ phần trăm của từng người. Ví dụ tỷ lệ chung = tổng số đã xử lý / tổng tiếp nhận, không phải trung bình đơn giản các tỷ lệ. Công thức tham chiếu ô NONE hoặc ô thiếu trên bản tổng phải hiện “Thiếu dữ liệu để tính”; không đổi null thành 0 âm thầm.

## 5. Lịch kỳ, hạn khóa và thay đổi cấu hình

Tách **kỳ dữ liệu**, **thời điểm mở nhập**, **hạn khóa**. Người dùng chọn một kiểu kỳ cho từng báo cáo; bản thiết lập phải cho xem ngày bắt đầu/kết thúc kỳ và hạn thật. Đề xuất mặc định mở nhập từ đầu kỳ; hạn là thời điểm trong kỳ hoặc kỳ kế tiếp được chọn rõ. Không dùng duy nhất chữ “ngày báo cáo” cho ba ý nghĩa này.

| Kiểu | Cấu hình UI | Quy tắc đề xuất |
|---|---|---|
| Tuần | Thứ 2…Chủ nhật; giờ; hạn trong tuần hiện tại hoặc tuần kế tiếp | Tuần ISO bắt đầu thứ 2; ID bao gồm ISO week-year để không sai đầu năm |
| Tháng | Ngày 1…31 hoặc cuối tháng; giờ; tháng hiện tại/kế tiếp | Ngày 29–31 không có: dùng ngày cuối tháng, hiển thị rõ trong preview |
| Quý | Tháng thứ 1/2/3 của quý + ngày trong tháng + giờ; quý hiện tại/kế tiếp | Quý dương lịch; dễ hiểu hơn bắt nhập “ngày thứ 75”; hỗ trợ cuối tháng |
| Ngày chính xác | Date picker + giờ; khoảng kỳ dữ liệu nếu cần | Một kỳ một lần, không ngầm lặp hằng ngày; yêu cầu xác nhận cách hiểu này |

Ví dụ đề xuất: tuần 41/2026 là 05–11/10/2026, khóa thứ Sáu 09/10 lúc 17:00 nếu chọn trong tuần; tháng 10 khóa 31/10 lúc 17:00; tháng 2/2027 cấu hình ngày 31 thì hạn 28/02 lúc 17:00; quý IV chọn tháng thứ 3/ngày 25 thì hạn 25/12 lúc 17:00. Preview giúp nhận ra trường hợp kỳ chưa kết thúc nhưng đã khóa. Không tự dời vì ngày lễ/cuối tuần ở v1.

Mọi thời điểm lưu UTC, hiển thị múi giờ nghiệp vụ. Server quyết định: nhận ghi khi `opens_at <= server_now < effective_lock_at` và assignment/quyền/cell hợp lệ. Tại đúng thời điểm khóa: từ chối ghi. Trình duyệt có countdown theo server time; job chỉ phục vụ thông báo/snapshot, không phải điều kiện duy nhất để khóa.

Kỳ lưu snapshot của template version, deadline gốc, cấu hình lịch và danh sách người được giao. Sửa lịch/mẫu/phân công mặc định áp dụng từ kỳ chưa mở tiếp theo. Muốn thêm/bỏ người ở kỳ đang chạy cần thao tác riêng có lý do, xác nhận ảnh hưởng mẫu số, giữ lịch sử và dữ liệu cũ. Không thay layout của kỳ đã có dữ liệu. Tài khoản bị vô hiệu hóa được chặn ghi ngay nhưng không làm biến mất nghĩa vụ đã giao; miễn thực hiện cần sự kiện quản trị riêng có lý do.

Tác vụ sinh kỳ idempotent, unique(report_id, period_key); có cơ chế bù kỳ khi scheduler gián đoạn. Không tạo lại assignment hoặc gửi thông báo trùng khi job retry. Khi xuất bản lần đầu chọn ngày hiệu lực; không tự phát sinh hàng loạt kỳ quá khứ.

## 6. B — Nhập & tổng hợp (Report Register)

### 6.1 Chế độ người nhập

Thanh trên: combo báo cáo có tìm kiếm, kỳ báo cáo có khoảng ngày, trạng thái, hạn khóa đầy đủ và thời gian còn lại. Mặc định chọn kỳ đang mở gần hạn nhất; nếu không có, chọn kỳ mới nhất có quyền xem. Báo cáo/kỳ trống có hướng dẫn liên hệ quản lý, không hiển thị lỗi kỹ thuật.

Vùng chính: lưới giống template, tên sheet, địa chỉ ô, zoom 80/100/125%, vừa chiều rộng/toàn màn hình, cố định tiêu đề và cột nhãn theo template. Ô tĩnh nền trung tính; ô nhập có viền rõ và chỉ dẫn “Có thể nhập”; ô công thức có biểu tượng fx; không dùng màu là tín hiệu duy nhất. Tab/Enter đi qua các ô nhập, bỏ qua ô khóa và ô gộp phụ. Bảng rất rộng giữ cuộn ngang thay vì co chữ không đọc được.

Thanh trạng thái cố định: “Đã lưu lúc …”, số ô đã điền hợp lệ/tổng số ô bắt buộc; nút **Lưu nháp**, **Kiểm tra**, **Hoàn thành báo cáo**. Đề xuất autosave sau 2 giây ngừng nhập và khi blur, có Lưu nháp chủ động. Invalid input ở client không gửi; không ghi đè giá trị đã lưu bằng chuỗi sai. API vẫn validate lại toàn bộ.

“Hoàn thành” là tuyên bố người nhập đã kiểm tra, không phải phê duyệt của quản lý. Cho hoàn thành khi đủ ô bắt buộc, không có lỗi kiểu/công thức. Sau hoàn thành vẫn được sửa trước hạn theo yêu cầu gốc; lần sửa thành công chuyển về Đang nhập và cần hoàn thành lại. Ghi nhận mốc hoàn thành đầu tiên và revision hoàn thành hiện tại để không mất lịch sử.

Paste nhiều ô: hỗ trợ TSV từ Excel, preview lỗi theo ô, không dịch chuyển cột khi gặp ô khóa; nếu có bất kỳ ô đích không hợp lệ/khóa thì từ chối cả khối và nêu địa chỉ. Lưu thay đổi theo batch nguyên tử. Paste text bắt đầu `=` trong TEXT là text, không tạo công thức; export phải dùng kiểu string rõ ràng.

Khi hết hạn: chuyển tất cả input sang readonly, ẩn hoặc disable nút ghi, banner “Đã khóa lúc …”. Nếu request tới server sau hạn thì từ chối toàn batch, hiển thị “Thay đổi này chưa được lưu do hết hạn”, giữ buffer trong bộ nhớ phiên để người dùng biết phần chưa lưu; không giả báo lưu thành công. Khi được mở khóa, tải quyền/hạn mới, yêu cầu người dùng xem lại buffer trước khi gửi lại; không tự replay dữ liệu cũ.

### 6.2 Chế độ người quản lý

Combo báo cáo chỉ gồm mẫu do mình quản lý. Combo kỳ bắt buộc. Chọn báo cáo mặc định mở **Tổng hợp** và lọc người **Tất cả người được giao**. Thanh tóm tắt X/Y hoàn thành, số có dữ liệu, số quá hạn chưa hoàn thành và chế độ tính. Hành động: xem tổng hợp, xem cá nhân, xuất Excel theo quyền; không có sửa hộ, Lưu nháp hay Hoàn thành.

Chọn một người trong combo/danh sách bên trái → hiển thị đúng bản dữ liệu của người đó, cùng kỳ/template version, readonly. Hiện thời điểm lưu cuối, trạng thái hoàn thành, hạn gốc, hạn mở lại nếu có, lịch sử cập nhật và nút **Mở lại quyền nhập**. Người chưa nhập hiện cùng template trống, không báo “không tìm thấy”.

Drawer nguồn số liệu: từ một ô tổng, xem giá trị đã lưu từng người, revision, cập nhật cuối, trạng thái và mẫu số của AVG/COUNT; không cho sửa. Tổng hợp đọc từ snapshot revision nhất quán để tránh UI và Excel export khác nhau trong lúc user đang lưu.

### 6.3 Dialog mở khóa

Hiển thị báo cáo, kỳ và người nhận quyền ở đầu, không cho đổi ngầm. Trường “Khóa lại lúc”: ngày và giờ; mặc định **server_now + 3 giờ**, chuyển sang ngày hôm sau nếu qua nửa đêm. Ví dụ 23:30 ngày 09/10 → 02:30 ngày 10/10. Điều này giải quyết xung đột giữa “ngày hiện tại” và “cộng 3 tiếng”; mặc định ngày hiện tại chỉ khi không qua ngày mới.

Thêm lý do bắt buộc, preview câu “Cho phép [người] sửa [báo cáo/kỳ] đến [thời điểm]”. Thời điểm kết thúc phải ở tương lai. Mở khóa chỉ cho đúng report-period-assignment, không mở cả mẫu hoặc các kỳ khác. Server kiểm tra quyền quản lý tại thời điểm thao tác; ghi audit cùng transaction. Có thu hồi mở khóa sớm với lý do, không sửa dữ liệu.

Trước hạn gốc vẫn được nhập theo hạn gốc; một grant ngắn hơn không rút ngắn hạn gốc. Sau hạn gốc, chỉ grant đang hiệu lực mới cho ghi. Khi thu hồi grant, trở về kiểm tra hạn gốc. Gia hạn/mở lại không thay deadline gốc và không biến báo cáo trễ thành đúng hạn. Nếu cần sửa chính thức kỳ đã chốt, tạo revision điều chỉnh và giữ snapshot chốt trước đó; việc chốt hành chính cứng là phạm vi mở rộng, không mặc định thêm phê duyệt vào v1.

## 7. C — Tình trạng nhập liệu và quản trị

### 7.1 Câu hỏi quản trị mà màn hình phải trả lời

Ai phải nộp nhưng chưa bắt đầu? Ai có dữ liệu nhưng chưa hoàn thành? Báo cáo nào sắp khóa? Ai đã quá hạn? Ai đang được mở lại và lúc nào khóa lại? Đơn vị nào có tỷ lệ hoàn thành thấp? Số tổng đã bao phủ bao nhiêu người? Dữ liệu sau mở lại thay đổi bao nhiêu so với chốt ban đầu?

Đơn vị thống kê gốc là **một lượt giao = báo cáo × kỳ × người nhập**. Không đếm số tài khoản duy nhất để làm mẫu số khi lọc nhiều báo cáo. Một người có ba báo cáo tạo ba nghĩa vụ. Bộ lọc: báo cáo hoặc tất cả, loại kỳ, kỳ cụ thể/từ–đến kỳ, đơn vị, người nhập, quản lý, trạng thái hoàn thành, tình trạng hạn, đang mở lại. Khi trộn loại kỳ, hiển thị khoảng ngày thật và tổng số lượt, không gọi chung “tháng”.

### 7.2 Trạng thái nhiều chiều

| Chiều | Giá trị | Quy tắc |
|---|---|---|
| Tiến độ | Chưa bắt đầu / Đang nhập / Hoàn thành | Không có dữ liệu đã lưu / có dữ liệu hoặc revision đang sửa / revision hiện tại đã hoàn thành |
| Quyền nhập | Chưa mở / Đang mở / Đã khóa / Mở lại | Tính từ server time, hạn gốc và grant |
| Đúng hạn | Chưa đến hạn / Hoàn thành đúng hạn / Hoàn thành trễ / Quá hạn chưa hoàn thành | So revision hoàn thành hiện tại với hạn gốc; lưu cả lịch sử hoàn thành đầu tiên |
| Nghĩa vụ | Phải nộp / Miễn thực hiện | Miễn phải có lý do, thời điểm và người có quyền; không suy từ user bị khóa |

Không gộp “mở lại” vào trạng thái tiến độ: một báo cáo có thể vừa Hoàn thành vừa Mở lại; nếu bắt đầu sửa thì thành Đang nhập. Nếu từng hoàn thành đúng hạn nhưng đã sửa sau hạn, hiển thị “Bản hiện tại đang chỉnh sửa; từng hoàn thành đúng hạn lúc …”; KPI hiện tại không dùng lịch sử cũ để che việc chưa hoàn thành lại.

### 7.3 KPI và cách tính

| Chỉ số | Công thức/ý nghĩa |
|---|---|
| Phải nộp | Tổng assignment hiệu lực thuộc các kỳ đã mở, trừ miễn thực hiện; kỳ tương lai tách riêng |
| Hoàn thành | Số lượt có revision hiện tại đã hoàn thành / Phải nộp |
| Chưa bắt đầu | Không có dữ liệu đã lưu trên assignment; xem trang không tính là bắt đầu |
| Đang nhập | Có dữ liệu đã lưu hoặc đã sửa lại sau hoàn thành, chưa hoàn thành revision hiện tại |
| Quá hạn chưa hoàn thành | now >= hạn gốc và revision hiện tại chưa hoàn thành; vẫn đếm khi đang mở lại |
| Đang mở lại | Grant hiệu lực sau hạn gốc; là chỉ số chồng lấp, không cộng vào tổng trạng thái tiến độ |
| Đúng hạn theo kỳ đến hạn | Lượt đã hoàn thành hiện tại trước hạn gốc / lượt phải nộp đã đến hạn; kỳ chưa đến hạn không vào mẫu số |
| Độ phủ dữ liệu | Số lượt có ít nhất một input hợp lệ đã lưu / Phải nộp |
| Mức điền từng người | Ô bắt buộc hợp lệ có giá trị / tổng ô bắt buộc; 0 hợp lệ, null không hợp lệ |

Mẫu số 0 hiển thị “— / Không có lượt được giao”, không chia cho 0 hoặc hiện 100% vô nghĩa. Không đồng nhất “điền 100%” với “hoàn thành”; vẫn cần nút xác nhận hoàn thành. Kỳ không có ô bắt buộc cho phép hoàn thành sau kiểm tra các ô đã nhập, đồng thời cảnh báo thiết lập để không tạo mẫu rỗng vô ý.

### 7.4 Bố cục đề xuất

Dòng 1: tiêu đề, “Dữ liệu cập nhật lúc …”, Làm mới, Xuất danh sách. Dòng 2: bộ lọc chính; bộ lọc nâng cao trong drawer. Dòng 3: sáu thẻ KPI Phải nộp, Hoàn thành, Đang nhập, Chưa bắt đầu, Quá hạn, Mở lại. Các thẻ click để lọc, có chú thích chỉ số chồng lấp.

Dòng 4: biểu đồ thanh tiến độ theo đơn vị và xu hướng tỷ lệ hoàn thành theo các kỳ cùng loại; tooltip luôn ghi tử/mẫu. Không dùng biểu đồ donut chứa các trạng thái chồng lấp. Mặc định thu gọn chart khi cần diện tích bảng.

Bảng công việc: Báo cáo, Kỳ, Người nhập, Đơn vị, Mức điền, Tiến độ, Hạn gốc, Khóa lại lúc, Hoàn thành lúc, Cập nhật cuối, Số lần mở lại, Thao tác. Sort mặc định ưu tiên quá hạn chưa hoàn thành, rồi sắp đến hạn. Cho tùy chọn cột và phân trang phía server. Click dòng mở drawer lịch sử và liên kết B đúng report/kỳ/người. Mọi bộ lọc giữ khi quay lại.

Tab “Ma trận”: hàng là người, cột là báo cáo/kỳ đã chọn; mỗi ô có trạng thái và tooltip hạn; chỉ dùng với tập cột vừa phải (đề xuất tối đa 12), nhiều hơn chuyển bảng. Ô không được giao là “Không giao”, khác “Chưa nhập”. Export CSV/XLSX phải cùng filter/quyền/thời điểm; snapshot export không đổi số giữa các sheet.

Nhắc việc tự động/in-app là đề xuất giai đoạn sau hoặc cấu hình tùy chọn, chưa gửi thông báo trong khảo sát này. Nếu triển khai: nhắc trước hạn 24 giờ/3 giờ, chỉ người chưa hoàn thành, chống trùng và kiểm tra quyền lại khi phát; mở lại có thông báo riêng. Không cần email/SMS để vận hành lõi A/B/C.

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

## 12. Phương án triển khai và phân rã công việc

So sánh: (a) iframe spreadsheet service — không chọn mặc định vì dữ liệu đi ngoài hệ thống và khó gắn quyền/hạn; (b) grid/spreadsheet engine tích hợp trong ứng dụng — ưu tiên, nhưng cần đánh giá license, formula, merge, accessibility; (c) dựng HTML table thuần — phù hợp mẫu đơn giản, chi phí tăng mạnh cho Excel rộng/công thức. Spike sẽ chọn (b) hoặc (c) trên file thật; không chốt tên package/license khi chưa kiểm tra stack và nhu cầu.

WBS chi tiết, dependencies, AC, test case và bằng chứng nằm ở phần phụ lục sinh kèm dưới đây và EXECUTION_CONTRACT.yaml. Ước lượng là ngày công, không phải số ngày lịch; chỉ gồm module mới, chưa gồm sửa lỗi nền tảng ngoài phạm vi. Mỗi task thực hiện RED → GREEN → REFACTOR; test hành vi, không kiểm thử đơn thuần rằng code hiện tại tồn tại.

Lịch dự kiến 8 tuần với 1 BE, 1 FE, QA 0,5–1 người và BA/UX bán thời gian: tuần 1 chốt nghiệp vụ/spike; tuần 2 nền dữ liệu/lịch/quyền và UI setup; tuần 3–4 parser/render/input; tuần 5 tổng hợp/mở lại; tuần 6 status/export; tuần 7 kiểm thử tích hợp/tải/quyền; tuần 8 UAT/pilot/khắc phục. Tối ưu song song BE/FE khi contract ổn định. Không bắt đầu chức năng phụ trước khi đạt P0 về khóa, quyền và tính đúng.

## 13. Test strategy và bằng chứng nghiệm thu

UT: parser token/style/merge, decimal/date/time/locale, aggregation null/0/empty, lịch và timezone, trạng thái completion. IT: quyền theo assignment, transaction deadline/revision, grant expiry, job retry, snapshot/export. E2E: wizard, nhập/paste/picker, quản lý readonly, hết hạn, mở lại, C drill-down. UAT: BA/đại diện nghiệp vụ chạy đúng các hành vi quan sát được trong ma trận AC; tất cả dùng dữ liệu giả.

Test thời gian bằng clock điều khiển: T−1ms, T, T+1ms; 23:30+3h; tháng 2 năm nhuận/không nhuận; tuần giao năm; quý IV sang quý I; lịch sau downtime. Test security bằng API trực tiếp với identity khác, sửa assignment/period/user/cell, chèn thêm property, export URL không quyền, template ngoài phạm vi. Test tổng đối soát độc lập bằng số biết trước, không dùng cùng implementation để sinh expected result.

Golden templates tối thiểu: đơn giản, nhiều sheet/merge, cột đến AK trở lên, số âm/thập phân/0/null, date 1900/1904, formula hợp lệ/không hỗ trợ/vòng lặp, hidden input, toàn locked, invalid token, file vượt giới hạn. Visual QA ở 1366/1440/1024/768: không mất nhãn, sai merge, mất ô nhập, che nút lưu hoặc sai màu trạng thái. Hiệu năng theo fixture đã chốt và log cấu hình môi trường.

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
