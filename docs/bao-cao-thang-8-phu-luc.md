# Báo cáo tháng 8 phụ lục

## Nguồn dữ liệu duy nhất

Mỗi lần lập báo cáo tạo một `MonthlyReportPackage` gồm kỳ, phạm vi tổ, phiên bản mẫu, snapshot của đủ 8 phụ lục, kết quả đối soát và toàn bộ dòng đóng góp. Giao diện, drill down và hai workbook đều đọc snapshot này. Sau khi chốt, hệ thống lưu luôn nội dung hai tệp và SHA-256; thay đổi hồ sơ nghiệp vụ sau đó không làm đổi báo cáo.

Vụ án ủy thác điều tra bị loại khỏi phụ lục vụ án bằng `caseType = REGULAR`. Trạng thái tại kỳ được lấy từ lịch sử trạng thái. Hồ sơ đã thay đổi sau mốc kỳ nhưng không có lịch sử đủ dùng được đưa vào khay **Cần xác minh**, không lấy trạng thái hiện tại làm trạng thái quá khứ.

Với báo cáo quá khứ giới hạn theo tổ, mọi phụ lục mang cảnh báo phạm vi cho đến khi người lập đối chiếu hồ sơ điều chuyển và gắn chứng cứ. Ngày hết thời hiệu chỉ đọc từ trường thời hiệu nghiệp vụ; hệ thống không dùng hạn xử lý để suy đoán. Bị can, kế hoạch khắc phục và biên bản trao đổi được lọc theo đúng mốc tạo, sửa, xóa và ngày nghiệp vụ của kỳ.

## Quy trình

`Nháp/Cần xác minh → Gửi duyệt → Đã duyệt → Đã chốt`; người lập không tự phê duyệt. Báo cáo còn lỗi nguồn hoặc phương trình không được gửi duyệt. Điều chỉnh số lượng phải có mã hồ sơ/sự kiện, lý do và chứng cứ; hệ thống lưu dòng `+/-` trong drill down rồi chạy lại toàn bộ đối soát. Sửa bản đã chốt được thực hiện bằng một phiên bản mới liên kết bản trước.

## API chính

- `POST /reports/monthly-packages`: tạo snapshot theo kỳ và phạm vi được cấp.
- `GET /reports/monthly-packages/:id`: mở đúng phiên bản đã lưu.
- `GET /reports/monthly-packages/:id/appendices/:code`: dữ liệu một phụ lục.
- `GET /reports/monthly-packages/:id/drilldown`: nguồn của một ô/chỉ tiêu, có phân trang.
- `POST /reports/monthly-packages/:id/adjustments`: bổ sung xác minh có chứng cứ.
- `POST /reports/monthly-packages/:id/{submit|approve|reject|reopen|finalize}`: quy trình duyệt.
- `GET /reports/monthly-packages/:id/export/{detail|summary}`: hai workbook mẫu chính thức.
- `GET /reports/monthly-packages/:id/verification`: gói JSON kiểm chứng tách biệt.

Các endpoint đọc yêu cầu đồng thời quyền xem `Case` và `Incident`, sau đó tiếp tục kiểm tra phạm vi tổ lấy từ cơ sở dữ liệu. Endpoint ghi/duyệt dùng quyền `Report` tương ứng. Tải tệp bị giới hạn tần suất. Thao tác lập, điều chỉnh, chuyển trạng thái và tải từng loại tệp được ghi vào nhật ký hoạt động cùng người dùng, địa chỉ truy cập và phiên bản báo cáo.

## Mẫu Excel

Mẫu được phiên bản hóa tại `backend/templates/xlsx/monthly-reports/2026.09`. Workbook chi tiết giữ đúng 6 sheet, workbook thống kê giữ đúng 2 sheet. Hệ thống điền vào vùng dữ liệu của mẫu, giữ công thức kiểm tra, vùng in và dòng ký tên; không thêm sheet truy vết. Gói kiểm chứng được tải riêng.

## Triển khai

1. Chạy migration `20260930143000_monthly_report_packages`.
2. Build backend; kiểm tra hai mẫu tồn tại trong `dist/templates/xlsx/monthly-reports/2026.09`.
3. Build frontend và mở `/reports/monthly`.
4. Lập một báo cáo thử, kiểm tra drill down, phép cân 07–08, hai workbook và mã SHA-256 sau khi chốt.
