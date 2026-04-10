# UAT Plan - Quản lý đối tượng (Subjects)
Path: docs/specs/UAT_Plan_Subjects.md | Layer: TESTING | Version: v1.0 | Action: CREATE | TASK_ID: TASK-2026-261224

## 1. UAT Scenarios

### UAT-01: Luồng tạo mới đối tượng hoàn chỉnh
- **Step 1**: Mở modal thêm đối tượng từ danh sách.
- **Step 2**: Nhập Họ tên, Ngày sinh, CCCD.
- **Step 3**: Chọn Vụ án (FKSelect fuzzy search) và Tội danh.
- **Step 4**: Chọn Quận/Huyện -> Chọn Phường/Xã (Cascading check).
- **Step 5**: Nhấn "Lưu".
- **Expected**: Data lưu thành công, modal đóng, Toast "Thành công" hiển thị, hàng mới xuất hiện trên đầu bảng.

### UAT-02: Kiểm tra logic Cascading địa giới hành chính
- **Step 1**: Chọn Quận 1.
- **Step 2**: Kiểm tra danh sách Phường/Xã chỉ hiển thị các phường của Quận 1.
- **Step 3**: Đổi sang Quận 3.
- **Expected**: Field Phường/Xã bị reset về rỗng, list mới hiển thị các phường của Quận 3.

### UAT-03: Kiểm tra ngăn chặn trùng CCCD
- **Step 1**: Tạo đối tượng với CCCD `001085012345` (giả sử đã có).
- **Step 2**: Nhấn "Lưu".
- **Expected**: Hệ thống báo lỗi "CCCD đã tồn tại" tại trường input, không cho phép lưu.

### UAT-04: Kiểm tra hiển thị danh sách và tìm kiếm
- **Step 1**: Gõ tên đối tượng vào ô tìm kiếm nhanh.
- **Step 2**: Gõ mã vụ án.
- **Expected**: Kết quả trả về đúng đối tượng tương ứng.

### UAT-05: Kiểm tra Routing và Menu Sidebar
- **Step 1**: Đăng nhập vào hệ thống.
- **Step 2**: Click menu **Nghiệp vụ chính** > **Quản lý đối tượng** > **Bị can / Bị cáo**.
- **Step 3**: Kiểm tra URL trình duyệt.
- **Step 4**: Kiểm tra component hiển thị.
- **Expected**: URL là `/people/suspects`, component `ObjectListPage` được render (không phải Coming Soon Page). Menu được highlight.
