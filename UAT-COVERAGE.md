# Sổ phủ UAT — In từ danh sách · STT cũ · bản in Word giống hệ cũ

Mỗi dòng là một MỆNH ĐỀ kèm **tầng của bằng chứng**. Mệnh đề có chủ ngữ là *người dùng* thì bằng
chứng phải đi qua giao diện hoặc HTTP; mệnh đề nói về một *hàm* thì ca đơn vị là đủ — và câu chữ
phải thu hẹp lại cho khớp. Ghi PASS cho mệnh đề rộng dựa trên bằng chứng hẹp là dạng trượt mà mọi
tầng đều xanh trong khi tính năng không dùng được.

Trạng thái: **PASS** · **FAIL** · **CHƯA CHẠY** (chưa có bằng chứng) · **KHÔNG SO ĐƯỢC** (không
có đối chứng).

## M1 — Nút In trên cột Thao tác

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M1-1 | Hành động `print` có trong registry của Vụ án · Vụ việc · Đơn thư | đơn vị | PASS |
| M1-2 | Bảng gộp chọn đúng thực thể theo `recordType` của dòng | đơn vị | PASS |
| M1-3 | `printModal` khai BẮT BUỘC nên shell quên nối là lỗi biên dịch | biên dịch | PASS |
| M1-4 | **Cán bộ bấm icon In trên một dòng danh sách thì mở đúng màn in chứng từ** | E2E trên máy thật | PASS |
| M1-5 | **Chọn mẫu trong popup ấy rồi tải được tệp Word** | E2E trên máy thật | PASS (`ChungTu_20260909.docx`) |

## M2 — STT cũ trong cột STT

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M2-1 | Chuỗi hiển thị đúng dạng hệ cũ `16-243 - (STT cũ: 208)` | đơn vị | PASS |
| M2-2 | Hồ sơ KHÔNG có STT cũ thì không hiện gì thêm | đơn vị | PASS |
| M2-3 | Ô lọc nhận cả `208` lẫn `2016-208` như hệ cũ | đơn vị | PASS |
| M2-4 | Máy chủ Vụ việc TRẢ VỀ `sttCu` (thiếu thì 3.323 hồ sơ trống lặng lẽ) | tích hợp | PASS |
| M2-5 | **Mở danh sách Vụ việc trên máy thật thấy số cũ ở cột STT** | E2E trên máy thật | PASS (hồ sơ `2017-259`) |

## M3 — Bản in Word giống hệ cũ

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M3-1 | Phép so THẤY được khác biệt ngắt đoạn | đơn vị (ca đỏ trước, xanh sau) | PASS |
| M3-2 | Phép so THẤY được khác biệt kiểu chữ (đậm · nghiêng · gạch chân · cỡ) | đơn vị | PASS |
| M3-3 | Bản hệ mới đem so là thứ MÁY CHỦ THẬT trả về, không phải dựng lại | tích hợp (gọi API prod) | PASS |
| M3-4 | `

` ra ĐOẠN mới, `
` đơn ra ngắt dòng mềm — như hệ cũ | đơn vị + dịch vụ | PASS |
| M3-5 | Chỉ mẫu `HE_CU_*` dùng quy ước ấy; mẫu PC01 giữ ngắt dòng mềm | dịch vụ xuất | PASS |
| M3-6 | Định dạng của nhãn KHÔNG trùm lên phần giá trị | đơn vị | PASS |
| M3-7 | **8 mẫu có bản gốc: bản in hệ mới khớp hệ cũ về chữ · đoạn · kiểu chữ** | đối chiếu hiện vật trên máy thật | CHƯA CHẠY LẠI (chờ #348) |
| M3-8 | 3 mẫu hệ cũ chưa từng in | — | KHÔNG SO ĐƯỢC |
| M3-9 | 17 mẫu tố tụng PC01 không có đối tác ở hệ cũ | — | KHÔNG SO ĐƯỢC |
| M3-10 | Mẫu hệ cũ được mời in ở đủ thực thể mà hồ sơ loại ấy nằm | cổng CI + đếm trên máy thật | PASS |
| M3-11 | Mẫu tự điền được ở MỌI thực thể nó được mời in | cổng CI | PASS |
| M3-12 | **Cán bộ mở một Vụ việc di trú từ hồ sơ "Trả hồ sơ" thì thấy mẫu ấy trong popup** | E2E trên máy thật | PASS (hồ sơ `2017-18`) |

## Ba chỗ CỐ Ý khác hệ cũ

| Chỗ | Hệ cũ | Hệ mới | Vì sao |
|---|---|---|---|
| Hồ sơ thiếu khoá | in ra tên biến `${de_xuat}` | in trống | lỗi hệ cũ, không chép |
| Nút In trên danh sách | không có | có | hệ cũ phải mở hồ sơ mới in được |
| Cột Thao tác | ở cuối | ở đầu | anh chốt 25/08 |

## Việc chưa làm

- **M5 — monkey test**, sau khi mọi mệnh đề trên PASS.


## Bốn lần bộ chạy UAT tự đỏ giả (09/09/2026)

Lượt đầu **0/5**, và không mệnh đề nào trong đó là lỗi sản phẩm:

| Chỗ trượt | Vì sao đỏ giả |
|---|---|
| Ô đăng nhập dò theo NHÃN | ô có `id` nhưng không có nhãn liên kết → không đăng nhập được → mọi mệnh đề sau đỏ |
| `getByTestId('btn-print')` | testid dựng theo từng dòng (`btn-print-<id>`), khớp chính xác là trượt |
| Tìm kiếm dùng `?q=` | khoá có TIỀN TỐ (`incidents_q`), nên trang bỏ qua và hiện danh sách mặc định — toàn bản nhập thử, không bản nào có STT cũ |
| Tìm nút In ở màn CHI TIẾT Vụ việc | nút ấy nằm ở màn sửa và ở danh sách, không ở màn chi tiết |

Ảnh chụp màn hình là thứ phân biệt được "sản phẩm hỏng" với "bộ chạy hỏng": nhìn ảnh thấy
**icon máy in nằm sẵn trong cột Thao tác**, tức sản phẩm đúng còn phép đo sai.
