# Hướng dẫn sử dụng — Quản lý Đơn thư
TASK-ID: TASK-2026-260202 | Phiên bản: 1.0.0 | Ngày: 2026-02-26

---

## 1. Tổng quan

Module **Quản lý Đơn thư** cho phép cán bộ điều tra tiếp nhận, xử lý và theo dõi đơn thư tố cáo, khiếu nại của công dân. Module hỗ trợ chuyển đổi đơn thư thành Vụ việc hoặc Vụ án khi cần thiết.

### Truy cập
1. Đăng nhập vào hệ thống với tài khoản cán bộ.
2. Từ sidebar, chọn **NGHIỆP VỤ CHÍNH** → **Quản lý đơn thư**.
3. Hoặc truy cập URL: `/petitions`

---

## 2. Danh sách Đơn thư

### Mô tả
Trang danh sách hiển thị tất cả đơn thư trong hệ thống với các tính năng tìm kiếm, lọc và thao tác.

### Các tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| Tìm kiếm nhanh | Nhập từ khóa để lọc theo STT, tên người gửi, nghi vấn đối tượng, tóm tắt nội dung |
| Tìm kiếm nâng cao | Lọc theo ngày tiếp nhận, đơn vị, trạng thái, tên người gửi |
| Thêm mới | Nhấn nút "Thêm mới" để mở form tiếp nhận đơn thư |
| Xem chi tiết | Nhấn icon mắt để xem thông tin đơn thư |
| Chỉnh sửa | Nhấn icon bút để cập nhật thông tin |
| Chuyển đổi | Nhấn "⋮" để mở menu: Chuyển Vụ việc / Vụ án / Lưu đơn / Hướng dẫn |
| Cảnh báo quá hạn | Badge đỏ "Quá hạn" hiển thị khi đơn thư đã vượt hạn xử lý |

### Trạng thái đơn thư

| Mã trạng thái | Hiển thị | Ý nghĩa |
|---------------|----------|---------|
| MOI_TIEP_NHAN | Mới tiếp nhận | Đơn thư vừa được nhập vào hệ thống |
| DANG_XU_LY | Đang xử lý | Đơn thư đang được cán bộ xử lý |
| CHO_PHE_DUYET | Chờ phê duyệt | Đơn thư chờ lãnh đạo phê duyệt |
| DA_LUU_DON | Đã lưu đơn | Đơn thư được lưu trữ, không tiếp tục xử lý |
| DA_GIAI_QUYET | Đã giải quyết | Đơn thư đã được giải quyết xong |
| DA_CHUYEN_VU_VIEC | Đã chuyển VV | Đơn thư đã chuyển thành Vụ việc |
| DA_CHUYEN_VU_AN | Đã chuyển VA | Đơn thư đã chuyển thành Vụ án |

---

## 3. Tiếp nhận Đơn thư mới

### Truy cập
- Nhấn nút **"Thêm mới"** trên trang danh sách.
- Hoặc truy cập URL: `/petitions/new`

### Các trường bắt buộc (*)

| Trường | Mô tả |
|--------|-------|
| Ngày tiếp nhận * | Ngày tiếp nhận đơn thư (không được là ngày tương lai) |
| Số tiếp nhận * | Mã đơn thư duy nhất, định dạng gợi ý: DT-{NĂM}-{STT} |
| Họ và tên người gửi * | Tên đầy đủ của người gửi đơn |
| Địa chỉ người gửi * | Địa chỉ liên hệ của người gửi |
| Loại đơn thư * | Tố cáo / Khiếu nại / Kiến nghị / Phản ánh |
| Mức độ ưu tiên * | Cao / Trung bình / Thấp |
| Tóm tắt nội dung * | Tóm tắt ngắn gọn nội dung đơn thư |
| Nội dung chi tiết * | Mô tả đầy đủ nội dung đơn thư |

### Các trường tùy chọn

| Trường | Mô tả |
|--------|-------|
| Đơn vị tiếp nhận | Đơn vị công an tiếp nhận đơn |
| Năm sinh người gửi | Năm sinh (4 chữ số) |
| Số điện thoại | Định dạng 10-11 chữ số |
| Email | Email liên hệ người gửi |
| Đối tượng nghi vấn | Tên đối tượng bị tố cáo (nếu có) |
| Địa chỉ đối tượng | Địa chỉ đối tượng nghi vấn |
| Tài liệu đính kèm | Ghi chú về tài liệu kèm theo |
| Hạn xử lý | Ngày hạn cuối xử lý đơn thư |
| Người được giao xử lý | Tên cán bộ phụ trách |
| Ghi chú | Thông tin bổ sung |

### Lưu đơn thư
1. Điền đầy đủ các trường bắt buộc.
2. Nhấn nút **"Lưu đơn thư"** (hoặc nút "Lưu đơn thư" ở góc trên phải).
3. Hệ thống kiểm tra validation và lưu vào DB.
4. Sau khi lưu thành công, tự động quay về trang danh sách.

> **Lưu ý:** Số tiếp nhận (STT) phải là duy nhất trong toàn hệ thống. Nếu trùng, hệ thống sẽ thông báo lỗi.

---

## 4. Chuyển thành Vụ việc

### Điều kiện
- Đơn thư phải ở trạng thái `MOI_TIEP_NHAN`, `DANG_XU_LY`, hoặc `CHO_PHE_DUYET`.

### Quy trình
1. Từ trang danh sách, tìm đơn thư cần chuyển.
2. Nhấn nút **"⋮"** (menu thao tác) trên hàng đơn thư.
3. Chọn **"Chuyển thành Vụ việc"**.
4. Điền thông tin trong modal:
   - **Tên vụ việc** *(bắt buộc)*
   - **Loại vụ việc** *(bắt buộc)*: Vi phạm hành chính / Tranh chấp dân sự / An ninh trật tự / Khác
   - **Mô tả chi tiết** (tùy chọn)
5. Nhấn **"Xác nhận chuyển đổi"**.
6. Đơn thư chuyển sang trạng thái **Đã chuyển VV**, Vụ việc mới được tạo.

---

## 5. Chuyển thành Vụ án

### Điều kiện
- Đơn thư phải ở trạng thái `MOI_TIEP_NHAN`, `DANG_XU_LY`, hoặc `CHO_PHE_DUYET`.

### Quy trình
1. Từ trang danh sách, tìm đơn thư cần chuyển.
2. Nhấn nút **"⋮"** (menu thao tác) trên hàng đơn thư.
3. Chọn **"Chuyển thành Vụ án"**.
4. Điền thông tin trong modal:
   - **Tên vụ án** *(bắt buộc)*
   - **Tội danh** *(bắt buộc)*: Tham nhũng / Trộm cắp tài sản / Lừa đảo / Buôn bán ma túy / Khác
   - **Thẩm quyền** *(bắt buộc)*: Công an cấp Quận/Huyện / Thành phố / Viện kiểm sát
   - Bị can, Quyết định khởi tố, Ngày khởi tố (tùy chọn)
5. Nhấn **"Xác nhận khởi tố"**.
6. Đơn thư chuyển sang trạng thái **Đã chuyển VA**, Vụ án mới được tạo.

---

## 6. Lưu đơn (Archive)

Khi đơn thư không cần tiếp tục xử lý:
1. Nhấn **"⋮"** → chọn **"Lưu đơn"**.
2. Nhập lý do lưu đơn (bắt buộc).
3. Nhấn **"Xác nhận lưu đơn"**.
4. Đơn thư chuyển sang trạng thái **Đã lưu đơn** — không thể tiếp tục xử lý.

---

## 7. Cảnh báo quá hạn

- Khi một đơn thư có `Hạn xử lý` đã qua ngày hiện tại:
  - Badge **"Quá hạn"** (màu đỏ) xuất hiện bên cạnh mã đơn thư.
  - Hàng đơn thư có nền màu đỏ nhạt.
  - Banner cảnh báo màu đỏ hiển thị ở đầu trang danh sách.

---

## 8. API Endpoints (Dành cho Developers)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/petitions` | Danh sách đơn thư (có filter, phân trang) |
| GET | `/api/v1/petitions/:id` | Chi tiết một đơn thư |
| POST | `/api/v1/petitions` | Tạo đơn thư mới |
| PUT | `/api/v1/petitions/:id` | Cập nhật đơn thư |
| DELETE | `/api/v1/petitions/:id` | Xóa mềm đơn thư |
| POST | `/api/v1/petitions/:id/convert-incident` | Chuyển thành Vụ việc |
| POST | `/api/v1/petitions/:id/convert-case` | Chuyển thành Vụ án |

### Query Parameters (GET /api/v1/petitions)

| Tham số | Kiểu | Mô tả |
|---------|------|-------|
| search | string | Tìm theo STT, tên người gửi, tóm tắt |
| status | enum | Lọc theo trạng thái |
| unit | string | Lọc theo đơn vị |
| senderName | string | Lọc theo tên người gửi |
| fromDate | date | Từ ngày tiếp nhận |
| toDate | date | Đến ngày tiếp nhận |
| limit | int | Số bản ghi mỗi trang (mặc định: 20, tối đa: 100) |
| offset | int | Vị trí bắt đầu (mặc định: 0) |
| sortBy | string | Sắp xếp theo: createdAt, receivedDate, deadline, status, senderName |
| sortOrder | asc/desc | Thứ tự sắp xếp (mặc định: desc) |

---

## 9. Quyền truy cập

| Vai trò | Xem | Thêm | Sửa | Xóa | Chuyển đổi |
|---------|-----|------|-----|-----|------------|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| OFFICER | ✓ | ✓ | ✓ | ✓ | ✓ |

---

*Tài liệu này được tạo tự động bởi OPENCODE_RUNNER trong quá trình triển khai TASK-2026-260202.*
