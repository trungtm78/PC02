# UAT-COVERAGE — mẫu tự đặt tích sẵn + chọn/bỏ chọn hàng loạt khi in

Chạy trên **máy thật** `http://171.244.40.245` ngày 28/08/2026, bản dựng `f9ac8c67`.

| ID | Màn hình / Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| **API — cờ đi trọn đường** ||||
| A-01 | Đường của popup trả về trường `selectedByDefault` | ✔ | ✔ | **PASS** |
| A-02 | Bật cờ ở màn quản lý → popup thấy đã bật | ✔ | ✔ | **PASS** |
| A-03 | Tắt cờ ở màn quản lý → popup thấy đã tắt | ✔ | ✔ | **PASS** |
| A-04 | Đổi cờ không làm mất cấu hình khác của mẫu | ✔ | ✔ | **PASS** |
| A-05a | Đường Đơn thư trả về cờ | ✔ | ✔ | **PASS** |
| A-05b | Đường Vụ việc trả về cờ | ✔ | ✔ | **PASS** |
| A-05c | Đường Vụ án trả về cờ | ✔ | ✔ | **PASS** |
| **Giao diện — bấm đúng thứ cán bộ bấm** ||||
| E-01 | Màn Quản lý mẫu: công tắc bật/tắt, tải lại trang vẫn giữ | ✔ | ✔ | **PASS** |
| E-02 | Popup In chứng từ: mở ra không tích sẵn + nút Xuất khoá | ✔ | ✔ | **PASS** |
| E-03 | Popup: **Chọn tất cả** tích được, không tích mẫu bị khoá | ✔ | ✔ | **PASS** |
| E-04 | Popup: **Bỏ chọn tất cả** về rỗng + nút Xuất khoá lại | ✔ | ✔ | **PASS** |
| **Thành phần — nhánh khó dựng trên máy thật** ||||
| C-01 | Mẫu bật cờ → tích sẵn | ✔ | ✔ | **PASS** |
| C-02 | Mẫu tắt cờ → không tích sẵn | ✔ | ✔ | **PASS** |
| C-03 | Mẫu bật cờ nhưng **thiếu thông tin** → không tích | ✔ | ✔ | **PASS** |
| C-04 | Sau "Lưu bổ sung": chỉ mẫu bật cờ mới tự tích | ✔ | ✔ | **PASS** |
| C-05 | Form sửa mẫu: ô tích đọc đúng giá trị đang có | ✔ | ✔ | **PASS** |
| C-06 | Form tạo mẫu: mặc định TẮT và gửi kèm lên API | ✔ | ✔ | **PASS** |
| C-07 | Form tạo mẫu: bật ô thì gửi `true` | ✔ | ✔ | **PASS** |
| C-08 | Công tắc: đang bật thì bấm là TẮT (không một chiều) | ✔ | ✔ | **PASS** |
| C-09 | Công tắc: bấm dòng khác lúc một dòng đang gửi vẫn ăn | ✔ | ✔ | **PASS** |
| C-10 | Công tắc: không nạp lại cả bảng sau khi bấm | ✔ | ✔ | **PASS** |
| **Backend — chỗ dễ nuốt giá trị** ||||
| B-01 | DTO parse boolean multipart (`'true'`/`'false'`/bool) | ✔ | ✔ | **PASS** |
| B-02 | Không gửi cờ thì để trống, không tự thành `false` | ✔ | ✔ | **PASS** |
| B-03 | DTO sửa kế thừa được cờ | ✔ | ✔ | **PASS** |
| B-04 | `create` ghi đúng cờ admin gửi | ✔ | ✔ | **PASS** |
| B-05 | `create` không gửi cờ → mặc định TẮT | ✔ | ✔ | **PASS** |
| B-06 | `update` đổi được cờ | ✔ | ✔ | **PASS** |
| B-07 | **CỔNG**: `select` của bộ nạp popup có khai cờ | ✔ | ✔ | **PASS** |

**28/28 dòng PASS.**

## Tệp

| Loại | Tệp |
|---|---|
| API (máy thật) | `tests/api/tich-san-va-chon-hang-loat-uat.api.spec.ts` — 7/7 |
| Giao diện (máy thật) | `tests/e2e/tich-san-va-chon-hang-loat-uat.e2e.spec.ts` — 2/2 |
| Thành phần | `frontend/src/features/document-templates/components/__tests__/tichSanVaChonHangLoat.test.tsx` (8) · `pages/__tests__/congTacTichSan.test.tsx` (6) · `components/__tests__/TemplateFormModal.test.tsx` (+3) |
| Backend | `backend/src/document-templates/tich-san-khi-in.spec.ts` — 10/10 |

## Hiệu lực — gieo lỗi

Cổng B-07 là chốt chặn quan trọng nhất: quên khai cột trong `select` thì popup không bao giờ
thấy cờ, admin bật công tắc mà chẳng có gì đổi, **và mọi ca kiểm khác vẫn xanh**.

Đã gieo lỗi: bỏ dòng `selectedByDefault: true` khỏi `select` → **1 ca đỏ**; khôi phục → xanh lại.

## Đối chiếu ngược với yêu cầu gốc

| Anh yêu cầu | Dòng phủ |
|---|---|
| "cho phép setting mặc định được chọn hay không tại màn hình Quản lý mẫu chứng từ" | E-01 · C-05..C-10 · B-01..B-07 · A-02, A-03 |
| "tại màn hình In chứng từ thêm select all và unselect all" | E-03 · E-04 · C-01..C-04 |
| Áp cho cả ba màn (popup dùng chung) | A-05a/b/c |

Không sót màn hình hay chức năng nào trong phạm vi.

## Bài kiểm tự dẫm hai bẫy — ghi lại

1. **Bóc thân phản hồi hai kiểu ở hai chỗ** trong cùng một tệp → 3 ca báo đỏ giả. Đã gom về một
   hàm duy nhất.
2. **Đặt tên tệp E2E không khớp mẫu của bộ chạy** (`*-uat.e2e.spec.ts`) → "No tests found", nhìn
   như đã chạy xong mà thật ra không chạy ca nào. Đây là kiểu xanh giả nguy hiểm nhất: báo cáo
   sạch vì **không có gì được kiểm**.

## Còn lại

Sau deploy, **28 mẫu đều TẮT** — cán bộ mở popup thấy trống cho tới khi anh bật mẫu hay dùng ở
màn Quản lý mẫu chứng từ. Đây là hành vi anh đã chốt; bài kiểm luôn trả cấu hình về nguyên trạng
nên không mẫu nào bị để lại ở trạng thái lạ.
