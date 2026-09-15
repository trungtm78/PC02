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
| M3-7 | **8 mẫu có bản gốc: bản in hệ mới khớp hệ cũ về chữ · đoạn · kiểu chữ** | đối chiếu hiện vật trên máy thật | PASS 10/10 cặp (vòng 4) |
| M3-8 | 3 mẫu hệ cũ chưa từng in | — | KHÔNG SO ĐƯỢC; chỉ kiểm được là dựng ra tệp hợp lệ, 0 biến sót |
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

## M5 — Monkey test

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M5-1 | 44 màn hình mở được, không màn nào trắng | E2E trên máy thật | PASS |
| M5-2 | 40 lượt bấm ngẫu nhiên không làm vỡ trang | E2E trên máy thật | PASS |
| M5-3 | Không màn nào hiện "Đã xảy ra lỗi" | E2E trên máy thật | PASS |
| M5-4 | Không lỗi console nào ngoài một lỗi đã tìm ra gốc | E2E trên máy thật | PASS |

**Bắt được một lỗi thật ngoài phạm vi việc được giao:** `/api/v1/notifications/stream` trả 401
trên mọi màn hình — dòng thông báo trực tuyến chưa từng chạy. Gốc và cách vá ở PR #351.
Báo cáo đầy đủ: `docs/monkey-test-ket-qua.md`.

Chạy trên máy thật nên bộ monkey **chặn mọi lời gọi ghi ở tầng mạng** — không sửa một hồ sơ nào.


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


## M6 — Ô tìm dạng thẻ (đợt tìm kiếm, 15–16/09/2026)

Sổ phủ của đợt tìm kiếm. Quy tắc của tệp này giữ nguyên: mệnh đề có chủ ngữ là *cán bộ* chỉ được
PASS bằng bằng chứng đi qua giao diện hoặc HTTP trên máy thật — ca kiểm đơn vị KHÔNG đủ, dù xanh.

### Máy chủ (bằng chứng: ca kiểm đơn vị/tích hợp — đã có)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-1 | Thẻ `khoá~giá trị` thành điều kiện nối `where.AND`, không gán đè khoá tầng trên (giữ phạm vi dữ liệu) | đơn vị | PASS |
| M6-2 | Khoá thẻ không có trong khai → 400, KHÔNG âm thầm trả dữ liệu chưa lọc | đơn vị | PASS |
| M6-3 | Thẻ chọn trên cột Boolean dùng `equals` (Prisma `BoolFilter` không có `in`) | đơn vị + cổng kiểu cột | PASS (lỗi 500 đã sửa) |
| M6-4 | Kiểu thẻ khai hợp kiểu cột `schema.prisma` ở MỌI khai | cổng CI | PASS |
| M6-5 | Nhật ký: xuất CSV áp CÙNG thẻ với danh sách | đơn vị | PASS |
| M6-6 | Trễ hạn: chỉ nhận `*` + khoá chung ba khai; khoá riêng một loại → 400 | đơn vị | PASS |
| M6-7 | Trễ hạn: lọc `priority` và `recordType` (hoa/thường) áp ở máy chủ | đơn vị | PASS (đã sửa sau codex) |
| M6-8 | Danh sách đã xoá (Khôi phục) nhận thẻ theo khai từng loại + DTO kiểm `limit`/`offset` | đơn vị | PASS |

### Cán bộ trên máy thật (CHƯA CHẠY — phải bấm thử sau khi deploy)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-9 | **Gõ không dấu ("nguyen") ra hồ sơ có dấu ("Nguyễn") ở từng màn danh sách** | E2E trên máy thật | CHƯA CHẠY |
| M6-10 | **Chọn được cột cụ thể trong gợi ý rồi lọc đúng cột ấy** | E2E trên máy thật | CHƯA CHẠY |
| M6-11 | **Thẻ nằm trên địa chỉ trang: lùi trang và dán đường dẫn giữ nguyên bộ lọc** | E2E trên máy thật | CHƯA CHẠY |
| M6-12 | **Chọn thẻ Trạng thái ở Người dùng · Danh mục · Ánh xạ địa chỉ không lỗi** (lỗi 500 đã sửa) | E2E trên máy thật | CHƯA CHẠY |
| M6-13 | **Nhật ký: gõ không dấu ra ĐÚNG tên người thực hiện** (trước đây trình duyệt lọc lại nên không bao giờ ra) | E2E trên máy thật | CHƯA CHẠY |
| M6-14 | **Ô tìm toàn cục: "Xem tất cả" mở danh sách ĐÃ lọc** (trước gửi `?search=` không màn nào đọc) | E2E trên máy thật | CHƯA CHẠY |
| M6-15 | **Ô tìm toàn cục: bấm một vụ việc mở đúng hồ sơ ấy; bấm một đối tượng mở danh sách đúng loại** | E2E trên máy thật | CHƯA CHẠY |
| M6-16 | **Cờ `TIM_KIEM_THE` tắt → ô chữ cũ vẫn tìm được như trước** | E2E trên máy thật | CHƯA CHẠY |
| M6-17 | **Bộ gõ tiếng Việt: Enter lúc đang ghép chữ không mở nhầm kết quả** | E2E Chrome thật | CHƯA CHẠY |

### Số đo phải có sau khi deploy (CHƯA CHẠY)

| # | Mệnh đề | Tầng bằng chứng | Trạng thái |
|---|---|---|---|
| M6-18 | Nạp cột bóng prod xong, chạy thử lại còn 0 dòng lệch (mọi bảng M6) | CLI trên prod | CHƯA CHẠY |
| M6-19 | Kiểm vàng bỏ dấu (chuỗi thật) lệch 0 giữa JS và SQL | CLI trên prod | CHƯA CHẠY |
| M6-20 | EXPLAIN các truy vấn thẻ dùng chỉ mục GIN, không quét cả bảng | EXPLAIN trên prod | CHƯA CHẠY |

### Đã biết, cố ý không làm trong đợt này

| Chỗ | Vì sao |
|---|---|
| Thẻ `*` không tìm `petitions.unit` (89/47.273 dòng = 0,19%) và `cases.unit` (0 dòng) | đổi khai phải sinh lại cột bóng đơn thư đã chạy prod từ M2; số đo quá nhỏ so với rủi ro |
| Nút "Xuất Excel" ở Xuất báo cáo không áp ô tìm | vốn đã vậy trước đợt này (không phải hồi quy) |
| Đơn vị hành chính giữ ô chữ | là ô gợi ý kiểu Cmd+K, không phải màn danh sách; chỉ máy chủ bỏ dấu |

## Chốt cuối (09/09/2026)

Cả năm mốc PASS trên **máy thật**, kiểm tận nơi chứ không suy từ ca kiểm:

- **10/10 cặp bản in**: 0 lệch dữ liệu · 0 lệch bố cục · 0 lệch kiểu chữ. Bốn chỗ lệch còn lại
  đều là hệ cũ tự in ra tên biến của nó — lỗi hệ cũ, cố ý không chép.
- **5/5 mệnh đề có chủ ngữ là CÁN BỘ** chạy qua giao diện thật.
- **Monkey test**: 44 màn · 40 lượt bấm · 0 màn trắng · **0 lời gọi bị máy chủ từ chối**.

Ba lỗi tìm thêm ngoài phạm vi được giao, đã vá và đã lên máy: 5.227 hồ sơ không mời in được
chứng từ hệ cũ (#347) · dòng thông báo trực tuyến 401 (#351) · ô lọc cán bộ rỗng (#353).

Hai bộ công cụ đã đưa vào kho để chạy lại được: `tools/monkey-test/` và `tools/uat-may-that/`.
