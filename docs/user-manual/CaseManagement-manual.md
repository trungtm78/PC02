# Hướng dẫn sử dụng: Phân hệ Quản lý vụ án

Path: docs/user-manual/CaseManagement-manual.md | Layer: Business | Version: 1.1.0 | Action: CREATE | TASK_ID: TASK-2026-000002

## 1. Giới thiệu
Phân hệ Quản lý vụ án cung cấp các công cụ để theo dõi, quản lý hồ sơ vụ án từ giai đoạn tiếp nhận tin báo đến khi có kết luận điều tra.

## 2. Truy cập
Từ menu chính, chọn **NGHIỆP VỤ CHÍNH** -> **Quản lý vụ án**. 
Ngoài ra, ngườI dùng có thể truy cập các chức năng khác từ menu **HỆ THỐNG**:
- **Tổng quan**: Theo dõi thống kê toàn hệ thống.
- **Lịch làm việc**: Quản lý lịch hẹn và tiến độ vụ án.
- **Cài đặt**: Cấu hình các tham số và phân quyền.

## 3. Các chức năng chính
### 3.1 Nhập hồ sơ mới
1. Nhấn nút **Thêm mới hồ sơ**.
2. Điền đầy đủ thông tin trong 10 tabs (Thông tin, Vụ việc, Vụ án, ĐTBS, ...). 
   - Tab **Thông tin** bao gồm 50+ trường nghiệp vụ chia thành 6 nhóm.
   - Tab **Thống kê 48 trường** cần nhập liệu để phục vụ báo cáo.
3. Nhấn **Lưu** để hoàn tất.

### 3.2 Xem danh sách vụ án
- Truy cập vào **Danh sách vụ án**.
- Sử dụng **Bộ lọc nâng cao** (Từ ngày, Đến ngày, Đơn vị, ĐTV, Tội danh) để tìm kiếm chính xác.
- Theo dõi các vụ án có badge **Quá hạn** màu đỏ để ưu tiên xử lý.

### 3.3 Xem chi tiết vụ án
- Nhấn vào mã vụ án trong danh sách.
- Trang chi tiết hiển thị thông tin qua 5 Tabs:
  - **Thông tin chung**: Tóm tắt vụ án và nhật ký cập nhật.
  - **Bị can**: Danh sách và trạng thái giam giữ (có Modal thêm mới).
  - **Luật sư**: Quản lý luật sư bào chữa.
  - **Tiến trình**: Timeline chi tiết các hoạt động điều tra.
  - **Kết luận**: Ghi nhận kết quả cuối cùng hoặc yêu cầu ĐTBS.

### 3.6 Theo dõi Thống kê đối tượng nhanh
- Tại các trang **Danh sách Bị can**, **Bị hại**, **Nhân chứng**, hệ thống cung cấp 4 khối thống kê nhanh ở đầu trang:
  - Giúp nắm bắt tổng số đối tượng và trạng thái xử lý trọng tâm (ví dụ: số ngườI đang tạm giam, số ngườI đã bồi thường).
  - Số liệu được cập nhật dựa trên kết quả tìm kiếm/lọc hiện tại.

### 3.7 Quản lý Bị hại (Mới)
- NgườI dùng có thể trực tiếp nhấn nút **Thêm bị hại** ngay tại trang danh sách để mở form nhập liệu nhanh.
- Các thông tin chính bao gồm: Họ tên, Năm sinh, Địa chỉ, Tình trạng bồi thường và Số tiền thiệt hại.

### 3.4 Quản lý Đơn thư
- Truy cập vào **Quản lý Đơn thư** từ menu chính.
- **Tiếp nhận**: Nhấn **Thêm mới**, nhập thông tin ngườI gửi và nội dung đơn.
- **Xem chi tiết**: Nhấn icon **Mắt** trong danh sách để xem lại nội dung (chế độ chỉ đọc).
- **Xử lý**: Sử dụng menu Thao tác để chuyển đơn thư thành Vụ việc hoặc Vụ án.

### 3.5 Quản lý Vụ việc
- Truy cập vào **NGHIỆP VỤ CHÍNH** -> **Quản lý Vụ việc**.
- **Danh sách**: Hiển thị tất cả vụ việc đang thụ lý. Sử dụng bộ lọc để tìm kiếm theo Trạng thái (Chờ xử lý, Đang xác minh, Tạm đình chỉ, ...) hoặc theo Điều tra viên.
- **Thao tác nghiệp vụ**:
  - **Phân công**: Nhấn nút **Phân công** trên dòng vụ việc. Chọn Điều tra viên từ danh sách và thiết lập **Hạn xử lý**. Hệ thống sẽ tự động cập nhật trạng thái thành "Đang xác minh".
  - **Khởi tố**: Đối với vụ việc có đủ căn cứ, nhấn **Khởi tố**. Nhập thông tin Quyết định khởi tố. Hệ thống sẽ tạo một hồ sơ Vụ án mới và liên kết với vụ việc này.
  - **Tạm đình chỉ**: Ghi nhận lý do và thờI gian tạm dừng xác minh.
  - **Cập nhật tiến độ**: Ghi nhật ký các hoạt động xác minh hàng ngày.

## 4. Các lưu ý
- Các trường có dấu (*) là bắt buộc.
- Cần đảm bảo tiếng Việt có dấu chính xác khi nhập liệu.

## 5. Tổng quan hệ thống (Dashboard)
- Giao diện cung cấp cái nhìn tổng thể về tình hình tội phạm và tiến độ hồ sơ.
- Các biểu đồ trực quan giúp lãnh đạo nắm bắt nhanh các điểm nóng.

## 6. Quản lý Lịch làm việc
- Lịch được hiển thị theo dạng lướI tháng.
- NgườI dùng có thể nhấn vào ngày bất kỳ để tạo ghi chú hoặc lịch hẹn cho vụ án.

## 7. Cài đặt hệ thống
- Phân hệ trung tâm để quản lý cấu trúc tổ chức và danh mục dùng chung.
- Quản trị viên sử dụng phần này để cấp quyền cho ngườI dùng mới.

## 8. Quản lý Hồ sơ & Tài liệu (Mới - v1.1.0)
**Chức năng mới** giúp lưu trữ và quản lý các tài liệu, hồ sơ liên quan đến Vụ án và Vụ việc.

### 8.1 Truy cập
- Từ menu chính, chọn **HỆ THỐNG** -> **Hồ sơ & Tài liệu**.

### 8.2 Các chức năng chính
#### 8.2.1 Xem danh sách tài liệu
- Danh sách hiển thị tất cả tài liệu đã upload với thông tin: Tiêu đề, Loại, Kích thước, Vụ án/Vụ việc liên kết, NgườI upload.
- Sử dụng thanh tìm kiếm để lọc tài liệu theo tiêu đề hoặc tên file (hỗ trợ tìm kiếm không dấu).
- Các tài liệu đã xóa sẽ không hiển thị trong danh sách (Soft delete).

#### 8.2.2 Upload tài liệu mới
1. Nhấn nút **Upload tài liệu** ở góc phải trên.
2. Chọn file từ máy tính (hỗ trợ: PDF, Word, Excel, Hình ảnh, Video, Âm thanh).
3. **Lưu ý**: Kích thước tối đa cho phép là **10MB**.
4. Điền thông tin:
   - **Tiêu đề**: Bắt buộc, nên mô tả ngắn gọn nội dung tài liệu.
   - **Loại tài liệu**: Chọn từ danh sách (Văn bản, Hình ảnh, Video, Âm thanh, Khác).
   - **Liên kết Vụ án**: Chọn từ danh sách Vụ án hiện có (tuỳ chọn).
   - **Liên kết Vụ việc**: Chọn từ danh sách Vụ việc hiện có (tuỳ chọn).
   - **Mô tả**: Thông tin bổ sung về tài liệu (tuỳ chọn).
5. Nhấn **Upload tài liệu** để hoàn tất.

#### 8.2.3 Tải xuống tài liệu
- Tại danh sách, nhấn icon **Download** trên dòng tài liệu cần tải.
- File sẽ được tải về máy với tên gốc.

#### 8.2.4 Xóa tài liệu
- Nhấn icon **Thùng rác** trên dòng tài liệu cần xóa.
- Xác nhận xóa trong hộp thoại hiện ra.
- **Lưu ý**: Tài liệu bị xóa sẽ được ẩn khỏi danh sách nhưng vẫn được lưu trữ trong hệ thống (Soft delete).

### 8.3 Hình ảnh minh họa
- **sys-doc-list**: Danh sách tài liệu ban đầu.
- **sys-doc-upload**: Modal upload với chọn Vụ án/Vụ việc.
- **sys-doc-success**: Thông báo thành công sau upload.
- **sys-doc-error**: Thông báo lỗi khi upload file quá lớn.
