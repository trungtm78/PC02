# Thiết kế hướng dẫn tạo user và ánh xạ Báo cáo động

## Mục tiêu

Bổ sung vào một file HTML hướng dẫn hiện có các clip thao tác thật, có giọng đọc và phụ đề tiếng Việt, để người học hiểu đầy đủ cách tạo và quản lý tài khoản, gán tài khoản vào Tổ/Nhóm, rồi ánh xạ tài khoản vào cấu trúc phê duyệt của Báo cáo động.

## Phạm vi và dữ liệu minh họa

- Chỉ thao tác trên môi trường local và database kiểm thử cô lập.
- Tạo một Tổ/Nhóm mới và các tài khoản có tiền tố `[DEMO]` hoặc định danh `demo_`.
- Không sửa vai trò dùng chung, tài khoản thật hoặc dữ liệu production.
- Sau khi quay và xác minh, xóa toàn bộ dữ liệu demo mới khỏi database; lưu bằng chứng trước và sau khi xóa.
- Clip, âm thanh, phụ đề, nội dung chữ và mẫu tải xuống đều nằm trong một file HTML tại `docs/PC02_Report_Builder_Design_Package/hdsd/quy-trinh-nhap-lieu-bao-cao-dong.html`.

## Mô hình cần giảng rõ

Hệ thống có bốn lớp độc lập:

1. **Tài khoản:** mã cán bộ, họ tên, tên đăng nhập, trạng thái hoạt động, phòng ban và tùy chọn phân công công việc.
2. **Vai trò hệ thống:** ma trận quyền như `read:DynamicReport`, `manage:DynamicReport`, `admin:DynamicReport`.
3. **Thành viên Tổ/Nhóm:** user được thêm tại màn Tổ/Nhóm; trường Phòng ban trong hồ sơ user không thay thế quan hệ này.
4. **Vai trò trong Báo cáo động:** Quản lý, Người chỉ xem, Tổ phải nộp và Người nhập của từng tổ.

Quyền nhìn thấy và thao tác chỉ đúng khi các lớp liên quan đồng thời hợp lệ. Ví dụ: người nhập cần tài khoản hoạt động, quyền Xem, nằm trong luồng được cấu hình và được gán làm Người nhập cho đúng Tổ phải nộp; việc thuộc tổ đơn thuần không tự cấp quyền nhập.

## Kịch bản clip

### Clip 08 — Tạo Tổ/Nhóm và tài khoản

Quản trị tạo `[DEMO] Tổ tiếp nhận nguồn tin`, sau đó tạo ba tài khoản: quản lý, người nhập và người chỉ xem. Clip giải thích trường bắt buộc, trạng thái hoạt động, vai trò, phòng ban và liên kết thiết lập mật khẩu một lần. Các tài khoản hoàn tất thiết lập mật khẩu bằng luồng enrollment thật trên local.

### Clip 09 — Gán thành viên và ánh xạ Báo cáo động

Quản trị vào Tổ/Nhóm, thêm người nhập làm thành viên của tổ vừa tạo và kiểm tra lại danh sách thành viên. Sau đó mở cấu hình Báo cáo động và gán user quản lý, user chỉ xem, tổ phải nộp và user nhập tương ứng. Clip chỉ rõ mỗi lựa chọn tác động đến phần nào của quy trình.

### Clip 10 — Đăng nhập từng vai trò và so sánh

Đăng xuất rồi đăng nhập qua màn hình login bằng từng tài khoản demo:

- Người nhập thấy lượt giao của tổ, được nhập và nộp nhưng không duyệt hoặc chốt.
- Người chỉ xem thấy kỳ/tổng hợp được giao nhưng không sửa, nộp hoặc duyệt.
- Quản lý thấy màn kiểm tra/tổng hợp và các thao tác duyệt, trả lại, chốt theo trạng thái; không nhập thay cho tổ chỉ vì là quản lý.

Clip kết thúc bằng bảng so sánh trực quan User → Vai trò hệ thống → Tổ/Nhóm → Vai trò báo cáo → kết quả khi đăng nhập.

## Dọn dữ liệu

Sau khi raw video, timeline chương và bằng chứng mapping được đóng băng:

1. Xóa quan hệ vai trò báo cáo và lượt giao demo mới.
2. Xóa các quan hệ `UserTeam` demo.
3. Xóa ba user demo, token enrollment và dữ liệu phụ thuộc demo.
4. Xóa Tổ/Nhóm demo.
5. Truy vấn lại theo ID/prefix để chứng minh không còn dữ liệu demo mới.

Việc dọn dữ liệu không làm thay đổi các clip đã quay hoặc nội dung được nhúng trong HTML.

## Kiểm chứng chấp nhận

- Ba clip mới đều là video giao diện thật liên tục, không phải chuỗi ảnh tĩnh.
- Mỗi clip có âm thanh tiếng Việt nhúng sẵn, phụ đề, mục đích, kết quả và nút nhảy theo chương.
- Đăng nhập thật qua màn hình login và xác minh sự khác biệt của ba tài khoản.
- HTML hoạt động offline, không gọi tài nguyên ngoài; nút xem toàn bộ tự chuyển qua cả clip mới.
- Bộ lọc vai trò hiển thị đúng các clip liên quan.
- Bố cục không tràn ngang trên màn hình di động.
- File HTML đầu ra và file tại đường dẫn `hdsd` có cùng SHA-256.
- Bằng chứng cleanup cho thấy các ID demo mới không còn trong database local.
