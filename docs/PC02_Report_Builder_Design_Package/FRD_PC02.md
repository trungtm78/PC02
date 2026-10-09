# FRD Báo cáo động PC02

Tài liệu mô tả chức năng quan sát được trên ba phân hệ và các quy tắc xử lý cần thống nhất giữa giao diện và máy chủ. Developer và QA sử dụng mã FR cùng AC và Screen ID để triển khai và nghiệm thu. Tất cả ví dụ người dùng và số liệu trong mockup là dữ liệu minh họa.

Phiên bản 1.0 ngày 09/10/2026. Áp dụng BRD cùng phiên bản. Quyết định đề xuất chưa duyệt được tập trung tại BRD mục D01 đến D10.

## Use case

| Mã | Actor và mục đích | Luồng và ngoại lệ |
|---|---|---|
| UC-01 | Thiết lập tạo và xuất bản báo cáo | S01→S02→S03→S05 đến S08→S09→S10; S04 nếu mẫu lỗi |
| UC-02 | Người nhập hoàn thành kỳ | S11→S12 nếu lỗi→S11 hoàn thành; S13 hết hạn; S26 mất mạng hoặc conflict |
| UC-03 | Quản lý xem tổng và cá nhân | S15→S18 nguồn số liệu hoặc S16 cá nhân; không cho sửa |
| UC-04 | Quản lý mở lại | S16→S17→S14 cho người nhập; hết hiệu lực trở về S13 |
| UC-05 | Theo dõi nghĩa vụ | S19→S20 ma trận→S16 chi tiết hoặc S21 lịch sử |
| UC-06 | Quản lý phiên bản | S01→S22→wizard nháp mới; giữ nguyên kỳ cũ |
| UC-07 | Xuất báo cáo | S15/S16/S19→S25; thất bại retry có kiểm tra quyền |

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


## Danh mục chức năng và tiêu chí nghiệm thu

### FR-001 Tải mẫu Excel

Nguồn BR-01. Màn hình S02. Nghiệm thu AC-001 qua IT-001 và UAT-001.

Upload .xlsx hợp lệ tạo bản nháp và preview; file sai loại/vượt giới hạn báo lỗi, không publish.

### FR-002 Locked và input

Nguồn BR-01. Màn hình S03. Nghiệm thu AC-002 qua IT-002 và UAT-002.

Locked literal chỉ đọc; unlocked token tạo input; locked token và unlocked trống/literal báo Sheet!Cell.

### FR-003 Grammar token

Nguồn BR-01. Màn hình S04. Nghiệm thu AC-003 qua IT-003 và UAT-003.

Chấp nhận TEXT NUM DATE TIME, format optional, AGG optional; Num chuẩn NUM, AGV cảnh báo alias AVG; token sai bị chặn.

### FR-004 Bố cục Excel

Nguồn BR-01. Màn hình S11. Nghiệm thu AC-004 qua IT-004 và UAT-004.

Giữ sheet merge font border wrap kích thước và freeze trong phạm vi hỗ trợ; cảnh báo thành phần ngoài phạm vi.

### FR-005 Ô gộp và ẩn

Nguồn BR-01. Màn hình S03. Nghiệm thu AC-005 qua IT-005 và UAT-005.

Chỉ anchor của merge là field; input ẩn bị chặn publish; không nhân đôi giá trị.

### FR-006 Lịch tuần

Nguồn BR-02. Màn hình S05. Nghiệm thu AC-006 qua IT-006 và UAT-006.

Chọn thứ và giờ, preview 6 kỳ; ISO week-year đúng tại tuần giao năm.

### FR-007 Lịch tháng

Nguồn BR-02. Màn hình S06. Nghiệm thu AC-007 qua IT-007 và UAT-007.

Ngày 1–31/cuối tháng, ngày thiếu chuyển cuối tháng và preview rõ.

### FR-008 Lịch quý

Nguồn BR-02. Màn hình S07. Nghiệm thu AC-008 qua IT-008 và UAT-008.

Chọn tháng thứ 1/2/3 và ngày, quý hiện tại/kế tiếp; preview ngày thật.

### FR-009 Ngày chính xác

Nguồn BR-02. Màn hình S08. Nghiệm thu AC-009 qua IT-009 và UAT-009.

Tạo một kỳ tại ngày giờ chọn, không tự lặp; hiển thị khoảng dữ liệu.

### FR-010 Khóa server

Nguồn BR-02. Màn hình S13. Nghiệm thu AC-010 qua IT-010 và UAT-010.

Tại now bằng hạn hoặc sau hạn API từ chối batch; đồng hồ client/job chậm không thay đổi kết quả.

### FR-011 Phân công

Nguồn BR-03. Màn hình S09. Nghiệm thu AC-011 qua IT-011 và UAT-011.

Đúng một quản lý, nhiều người nhập không trùng, bỏ user inactive khi gán mới; publish thiếu người bị chặn.

### FR-012 Combo theo quyền

Nguồn BR-03. Màn hình S11. Nghiệm thu AC-012 qua IT-012 và UAT-012.

Chế độ nhập chỉ báo cáo được giao; quản lý chỉ báo cáo quản lý; truy cập trực tiếp ngoài phạm vi bị từ chối.

### FR-013 Mặc định tổng hợp

Nguồn BR-04. Màn hình S15. Nghiệm thu AC-013 qua IT-013 và UAT-013.

Quản lý chọn báo cáo/kỳ mở tổng hợp all_saved, badge tạm tính và X/Y hoàn thành.

### FR-014 Xem cá nhân chỉ đọc

Nguồn BR-04. Màn hình S16. Nghiệm thu AC-014 qua IT-014 và UAT-014.

Quản lý chọn người thấy dữ liệu cùng kỳ, không có write; API sửa hộ bị chặn.

### FR-015 Mở lại từng người

Nguồn BR-05. Màn hình S17. Nghiệm thu AC-015 qua IT-015 và UAT-015.

Grant chỉ đúng assignment/kỳ, lý do bắt buộc, manager hợp lệ; không mở các người hoặc kỳ khác.

### FR-016 Mặc định ba giờ

Nguồn BR-05. Màn hình S17. Nghiệm thu AC-016 qua IT-016 và UAT-016.

Default bằng server_now+3h, 23:30 chuyển 02:30 hôm sau; cấm thời điểm quá khứ.

### FR-017 Grant hết hạn và thu hồi

Nguồn BR-05. Màn hình S14. Nghiệm thu AC-017 qua IT-017 và UAT-017.

API từ chối sau expires_at hoặc revoke nếu quá hạn gốc; trước hạn gốc vẫn áp dụng quyền gốc.

### FR-018 NUM

Nguồn BR-06. Màn hình S12. Nghiệm thu AC-018 qua IT-018 và UAT-018.

Editor và API từ chối chữ/NaN/infinity, giữ decimal, validate scale/min/max; không âm thầm làm tròn.

### FR-019 DATE TIME

Nguồn BR-06. Màn hình S12. Nghiệm thu AC-019 qua IT-019 và UAT-019.

Có picker, từ chối 31/02 số bất kỳ 25:80; date-only không đổi ngày vì timezone.

### FR-020 TEXT và an toàn hiển thị

Nguồn BR-06. Màn hình S11. Nghiệm thu AC-020 qua IT-020 và UAT-020.

Giữ Unicode và số 0 đầu, escape HTML, TEXT bắt đầu = không thực thi công thức.

### FR-021 Paste

Nguồn BR-06. Màn hình S12. Nghiệm thu AC-021 qua IT-021 và UAT-021.

Paste TSV giữ vị trí; block có ô khóa/invalid từ chối nguyên khối với lỗi đúng ô.

### FR-022 Autosave và mất mạng

Nguồn BR-07. Màn hình S26. Nghiệm thu AC-022 qua IT-022 và UAT-022.

Debounce 2s, trạng thái lưu rõ; retry idempotent; mất mạng không báo đã lưu.

### FR-023 Hoàn thành

Nguồn BR-07. Màn hình S11. Nghiệm thu AC-023 qua IT-023 và UAT-023.

Chỉ hoàn thành khi required hợp lệ; sửa revision đã hoàn thành chuyển đang nhập; không khóa sớm ngoài hạn.

### FR-024 Đồng thời

Nguồn BR-07. Màn hình S26. Nghiệm thu AC-024 qua IT-024 và UAT-024.

Revision cũ trả 409; giữ buffer và cho so sánh, không overwrite người dùng âm thầm.

### FR-025 SUM AVG và null

Nguồn BR-04. Màn hình S18. Nghiệm thu AC-025 qua IT-025 và UAT-025.

10,0,null cho SUM10 AVG5 COUNT2; empty SUM là null COUNT0; mỗi assignment góp một revision.

### FR-026 NONE và kiểu tổng hợp

Nguồn BR-04. Màn hình S15. Nghiệm thu AC-026 qua IT-026 và UAT-026.

TEXT DATE TIME mặc định NONE, bản tổng hiện không tổng hợp; cấu hình SUM text bị chặn.

### FR-027 Công thức hai tầng

Nguồn BR-04. Màn hình S18. Nghiệm thu AC-027 qua IT-027 và UAT-027.

Tính cá nhân rồi tổng input rồi công thức tổng; tỷ lệ chung từ tử/mẫu tổng; cấm vòng lặp và external ref.

### FR-028 Theo dõi mọi lượt giao

Nguồn BR-08. Màn hình S19. Nghiệm thu AC-028 qua IT-028 và UAT-028.

C lấy assignment làm mẫu số, gồm người chưa nhập, loại miễn có lý do; người có 3 báo cáo là 3 lượt.

### FR-029 Bộ lọc kỳ

Nguồn BR-08. Màn hình S19. Nghiệm thu AC-029 qua IT-029 và UAT-029.

Chọn report/kỳ/đơn vị/người/status, UI và export dùng cùng filter; mixed period hiện khoảng ngày thật.

### FR-030 Trạng thái và KPI

Nguồn BR-08. Màn hình S19. Nghiệm thu AC-030 qua IT-030 và UAT-030.

Progress, quyền nhập, đúng hạn độc lập; mở lại không xóa trễ; mẫu số0 hiện —.

### FR-031 Drilldown và ma trận

Nguồn BR-08. Màn hình S20. Nghiệm thu AC-031 qua IT-031 và UAT-031.

Click status mở đúng B report/kỳ/người; không giao khác chưa nhập; ma trận giới hạn số cột.

### FR-032 Phiên bản mẫu

Nguồn BR-09. Màn hình S22. Nghiệm thu AC-032 qua IT-032 và UAT-032.

Publish mẫu mới không đổi kỳ cũ; không thay layout kỳ có dữ liệu; ngừng phát sinh không xóa dữ liệu.

### FR-033 Lịch sử và audit

Nguồn BR-09. Màn hình S21. Nghiệm thu AC-033 qua IT-033 và UAT-033.

Save/complete/grant/revoke/publish/phân công lưu actor thời điểm lý do và revision; không sửa audit từ UI.

### FR-034 Xuất Excel

Nguồn BR-09. Màn hình S25. Nghiệm thu AC-034 qua IT-034 và UAT-034.

Export giữ layout/format/typed values và snapshot source; quyền download kiểm tra lại.

### FR-035 Hai vai trò

Nguồn BR-10. Màn hình S16. Nghiệm thu AC-035 qua IT-035 và UAT-035.

User vừa quản lý vừa nhập có mode rõ; quản lý readonly, nhập chỉ own assignment.

### FR-036 Trạng thái UI

Nguồn BR-10. Màn hình S23. Nghiệm thu AC-036 qua IT-036 và UAT-036.

Mỗi màn có loading empty error forbidden; lock/mạng/conflict không che mất thông báo lưu.

### FR-037 Keyboard và responsive

Nguồn BR-10. Màn hình S24. Nghiệm thu AC-037 qua IT-037 và UAT-037.

Tab chỉ đi qua input, focus/error đọc được, 1366/1024/768 không che nút hoặc mất ô.

### FR-038 Hiệu năng

Nguồn BR-10. Màn hình S11. Nghiệm thu AC-038 qua IT-038 và UAT-038.

Fixture 5000 input/200 người, 50 concurrent; p95 form3s save1s aggregate3s trên cấu hình đã ghi.

### FR-039 Upload không an toàn

Nguồn BR-10. Màn hình S04. Nghiệm thu AC-039 qua IT-039 và UAT-039.

Reject macro/encrypted/external link/zip bomb, parser không gọi URL ngoài và có resource limit.

### FR-040 Job và timezone

Nguồn BR-02. Màn hình S05. Nghiệm thu AC-040 qua IT-040 và UAT-040.

Sinh kỳ idempotent, phục hồi downtime không trùng, UTC storage hiển thị UTC+7 nhất quán.

### FR-041 Thay phân công

Nguồn BR-09. Màn hình S22. Nghiệm thu AC-041 qua IT-041 và UAT-041.

Mặc định từ kỳ kế tiếp; kỳ hiện tại thao tác riêng có lý do và lịch sử mẫu số, không xóa submission.

### FR-042 Triển khai an toàn

Nguồn BR-10. Màn hình S23. Nghiệm thu AC-042 qua IT-042 và UAT-042.

Feature flag pilot, migration additive, restore/rollback đã thử; báo cáo cũ không hồi quy.

