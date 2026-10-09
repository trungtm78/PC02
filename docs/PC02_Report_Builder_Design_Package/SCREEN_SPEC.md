# Danh mục màn hình và hành vi UI

32 màn hình hoặc trạng thái trong Mockup_PC02.html. Thiết kế vector 1440×960, có SVG chỉnh sửa trong thư mục mockups. Nút trong bản vẽ là minh họa; menu catalog hoạt động offline. Không kết nối dữ liệu thật.

## S01 Danh sách thiết lập

Vai trò: Người thiết lập.

Lọc, tạo mới, xem và quản lý vòng đời báo cáo.

- Tạo báo cáo: S02
- Xem phiên bản: S22

## S02 Upload mẫu Excel

Vai trò: Người thiết lập.

Kiểm tra loại file và parse trước khi sang bước tiếp theo; upload không tự xuất bản.

- Chọn file hợp lệ: S03
- File lỗi: S04

## S03 Preview và thuộc tính ô

Vai trò: Người thiết lập.

Đối soát schema theo Sheet!Cell; sửa thuộc tính nháp và xem cảnh báo.

- Có lỗi import: S04
- Tiếp theo: S05

## S04 Lỗi import và validation mẫu

Vai trò: Người thiết lập.

Danh sách lỗi có vị trí nguyên nhân và cách sửa; không âm thầm bỏ qua ô lỗi.

- Tải lại: S02
- Mẫu hợp lệ: S03

## S05 Cấu hình kỳ tuần

Vai trò: Người thiết lập.

Bản sản phẩm hiển thị tối thiểu 6 kỳ kế tiếp; mẫu ngắn thể hiện ngày biên. Ngày cụ thể là một lần.

- Đổi kiểu kỳ: S05–S08
- Tiếp theo: S09

## S06 Cấu hình kỳ tháng

Vai trò: Người thiết lập.

Bản sản phẩm hiển thị tối thiểu 6 kỳ kế tiếp; mẫu ngắn thể hiện ngày biên. Ngày cụ thể là một lần.

- Đổi kiểu kỳ: S05–S08
- Tiếp theo: S09

## S07 Cấu hình kỳ quý

Vai trò: Người thiết lập.

Bản sản phẩm hiển thị tối thiểu 6 kỳ kế tiếp; mẫu ngắn thể hiện ngày biên. Ngày cụ thể là một lần.

- Đổi kiểu kỳ: S05–S08
- Tiếp theo: S09

## S08 Cấu hình kỳ ngày cụ thể

Vai trò: Người thiết lập.

Bản sản phẩm hiển thị tối thiểu 6 kỳ kế tiếp; mẫu ngắn thể hiện ngày biên. Ngày cụ thể là một lần.

- Đổi kiểu kỳ: S05–S08
- Tiếp theo: S09

## S09 Phân công quản lý và người nhập

Vai trò: Người thiết lập.

Multi-select có tìm kiếm, đơn vị và loại trùng. Một người quản lý theo đề xuất.

- Xem xác nhận: S10

## S10 Xác nhận xuất bản

Vai trò: Người thiết lập.

Có ngày hiệu lực rõ; publish không tự tạo kỳ quá khứ.

- Xuất bản thành công: S01

## S11 Nhập báo cáo

Vai trò: Người nhập.

Điều hướng bằng Tab; date/time có picker. Còn 2 giờ 15 phút · Hạn nhập 09/10/2026 lúc 17:00

- Kiểm tra: S12
- Đến hạn: S13
- Được mở lại: S14
- Lỗi lưu: S26

## S12 Kiểm tra dữ liệu nhập

Vai trò: Người nhập.

Điều hướng bằng Tab; date/time có picker. Có 2 ô cần sửa. Các giá trị chưa hợp lệ chưa được lưu.

- Kiểm tra: S12
- Đến hạn: S13
- Được mở lại: S14
- Lỗi lưu: S26

## S13 Báo cáo đã khóa

Vai trò: Người nhập.

Điều hướng bằng Tab; date/time có picker. Đã khóa lúc 17:00 ngày 09/10/2026. Liên hệ quản lý nếu cần nhập lại.

- Kiểm tra: S12
- Đến hạn: S13
- Được mở lại: S14
- Lỗi lưu: S26

## S14 Báo cáo được mở lại

Vai trò: Người nhập.

Điều hướng bằng Tab; date/time có picker. Được nhập lại đến 10/10/2026 lúc 02:30 · Hạn gốc vẫn là 09/10 lúc 17:00

- Kiểm tra: S12
- Đến hạn: S13
- Được mở lại: S14
- Lỗi lưu: S26

## S15 Tổng hợp của người quản lý

Vai trò: Người quản lý.

Mặc định tổng hợp all_saved có nhãn tạm tính; không có nút sửa/lưu.

- Chọn người: S16
- Nguồn số liệu: S18
- Xuất Excel: S25

## S16 Xem cá nhân chỉ đọc

Vai trò: Người quản lý.

Có chuyển mode nếu đồng thời là người nhập; chỉ mode nhập cho sửa bản của mình.

- Mở lại: S17
- Lịch sử: S21
- Chế độ nhập: S11

## S17 Dialog mở khóa

Vai trò: Người quản lý.

Kiểm tra datetime tương lai và lý do; qua nửa đêm tự đổi ngày.

- Hủy: S16
- Mở lại thành công: S14

## S18 Nguồn số tổng

Vai trò: Người quản lý.

Ví dụ độc lập 10,0,null để giải thích mẫu số; không dùng chung số với báo cáo demo S15.

- Chọn người: S16
- Quay lại: S15

## S19 Dashboard tình trạng

Vai trò: Người quản lý.

KPI đếm lượt giao, filter đồng nhất, ưu tiên quá hạn; dữ liệu demo thời điểm sau hạn.

- Ma trận: S20
- Chi tiết: S16
- Xuất: S25

## S20 Ma trận người và báo cáo

Vai trò: Người quản lý.

Click ô được giao mở đúng report/kỳ/người; không giao không mở form nhập.

- Ô được giao: S16
- Danh sách: S19

## S21 Lịch sử và audit

Vai trò: Người quản lý.

Xem actor thời điểm lý do và revision; không có thao tác sửa/xóa nhật ký.

- Quay lại cá nhân: S16

## S22 Quản lý phiên bản

Vai trò: Người thiết lập.

Giữ template version và snapshot assignments; thay đổi nghĩa vụ hiện hành có nhật ký.

- Tạo phiên bản: S02
- Tiếp tục nháp: S03

## S23 Loading empty error permission

Vai trò: Mọi vai trò.

Bộ trạng thái áp dụng toàn module; không dùng trang trắng hoặc số cũ như mới.

- Thử lại: S19
- Về danh sách: S01

## S24 Responsive và editor từng ô

Vai trò: Người nhập.

Thiết kế mobile đề xuất cần kiểm chứng với template thật; không thay đổi tọa độ sheet.

- Lưu giá trị: S11
- Hết hạn: S13

## S25 Xuất file và trạng thái job

Vai trò: Theo quyền xem.

Quyền kiểm tra khi tạo và tải; file private có thời hạn; lỗi cho retry theo snapshot.

- Tải: S15
- Quay lại: S19

## S26 Mất mạng và revision conflict

Vai trò: Người nhập.

Không overwrite tự động; lưu buffer tạm trong phiên, retry idempotent, complete chờ flush.

- Tải bản mới: S11
- Quá hạn: S13

## S27 Biểu đồ và filter nâng cao

Vai trò: Người quản lý.

Chỉ so sánh các kỳ cùng loại; tooltip có tử mẫu. Apply filter đồng bộ KPI bảng chart và export.

- Áp dụng: S19
- Chọn đơn vị: S19

## S28 Date picker và editor theo kiểu

Vai trò: Người nhập.

Ngày dùng picker không nhận serial number tùy ý. TIME dùng picker 24h và format hh:mm theo cùng nguyên tắc.

- Chọn ngày: S11
- Ngày không hợp lệ: S12

## S29 Xác nhận và kết quả hoàn thành

Vai trò: Người nhập.

Chờ autosave flush trước complete. Nếu đã khóa hoặc conflict phải hiển thị lỗi và không báo thành công.

- Quay lại: S11
- Hoàn thành thành công: S11
- Hết hạn: S13

## S30 Điều chỉnh và miễn nghĩa vụ

Vai trò: Người có quyền cấu hình.

Có thêm người hoặc miễn nghĩa vụ theo quyền; không xóa submission cũ và phải lưu tác động mẫu số.

- Lưu: S19
- Hủy: S22

## S31 Ngừng phát sinh và thu hồi grant

Vai trò: Theo quyền cấu hình hoặc quản lý.

Dialog chỉ mở đúng thao tác được chọn. Không có xóa vĩnh viễn. Xác nhận luôn nêu đối tượng phạm vi ảnh hưởng.

- Ngừng phát sinh: S01
- Thu hồi: S16

## S32 Lưới template và ràng buộc field

Vai trò: Người thiết lập.

Màn inspector đầy đủ cho label required min max scale maxLength và helper text; DATE TIME dùng ràng buộc tương ứng.

- Lưu nháp: S03
- Kiểm tra lại: S04

