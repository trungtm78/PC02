# Gieo lỗi ↔ ca kiểm — đợt 22–23/09/2026

`self_audit.py` đánh dấu **fault-seeding** là mục CẦN NGƯỜI: máy không tự nghĩ ra được
lỗi nào đáng gieo. Bảng này là phép đo ấy, làm ở **tầng đặc tả** — mutation cổ điển
trên E2E không khả thi.

Cách đọc: mỗi luật trong `_domain-pack.md` nhận **một lỗi có thể xảy ra thật**, rồi
chỉ đích danh ca nào phải chuyển đỏ. **Luật nào không ca nào bắt được thì oracle của
nó là trang trí** — và đó là phát hiện, không phải chú thích.

Danh sách ca lấy từ `uat.json` theo `rule_ref`, không gõ tay.

| Luật | Lỗi gieo | Ca phải ĐỎ | Ca phủ luật này |
|---|---|---|---|
| `R1-ALL` | Đường xuất 'mọi trường' đọc bộ cột của bảng thay vì bảng khai form | ca đối chiếu cột ngoài bảng: tệp mất mọi cột chỉ có trên form | TC-001, TC-103, TC-105 |
| `R1-HIDDEN` | Bộ dựng bộ cột loại luôn mọi ô thuộc nhóm gập | ca đối chiếu cột gập CÓ dữ liệu: các cột ấy biến mất khỏi tệp | TC-003, TC-004 |
| `R1-EMPTY` | Điều kiện rỗng chỉ kiểm IS NULL, bỏ chuỗi trắng / mảng rỗng / null JSON | bốn ca phân vùng rỗng: cột toàn chuỗi trắng bị xếp là CÓ dữ liệu nên không bị cắt | TC-005, TC-006, TC-007, TC-008, TC-009, TC-010, TC-011 |
| `R1-FIXED` | Bộ cột được đo lại tại thời điểm xuất | ca hai lượt xuất: thêm dữ liệu vào cột đã cắt giữa hai lượt thì hai hàng tiêu đề khác nhau | TC-012, TC-013 |
| `R1-COUNT` | Cắt nhầm một cột và thêm nhầm một cột khác, tổng vẫn 42 | ca so TẬP cột (COV-R1-VALUE-4): phép đếm vẫn xanh, phép so tập đỏ | TC-002, TC-014 |
| `R1-VALUE` | Dòng xuất bị lệch một hàng so với danh sách hồ sơ | ca đối chiếu từng ô với nguồn độc lập: mọi cột vẫn khác rỗng nhưng sai hồ sơ | TC-015, TC-016, TC-017, TC-018, TC-119 |
| `R1-GUARD` | CLI kiểm bộ cột luôn thoát 0 | ca gieo lỗi CLI: ghi giá trị vào cột đã cắt mà CLI vẫn xanh | TC-019, TC-020 |
| `R1-CAP` | Trần đặt ở 5.000 nhưng cắt bằng LIMIT 4999 | ca biên đúng trần: khớp 5.000 hồ sơ chỉ ra 4.999 dòng | TC-021, TC-022, TC-124 |
| `R2-EMPTY` | Nút sửa nhanh chỉ vẽ biểu tượng, bỏ nhãn chữ ở ô rỗng | ca ô rỗng: không tìm thấy nhãn chữ | TC-023, TC-024, TC-127 |
| `R2-FILLED` | Điều kiện vẽ nút là 'ô rỗng' thay vì 'có quyền sửa' | ca ô ĐÃ CÓ chữ: không có nút — đây đúng câu anh hỏi 23/09 | TC-025, TC-026, TC-027, TC-115, TC-116, TC-117, TC-118 |
| `R2-TEXT` | Bọc cả ô trong thẻ nút | ca bấm vào chữ: mở popup thay vì mở hồ sơ | TC-028, TC-029 |
| `R2-STOP` | Chỉ chặn lan sự kiện chuột, bỏ bàn phím | ca E2E bàn phím trên bảng thật (COV-R2-STOP-3): Enter vừa mở popup vừa đổi địa chỉ trang. Hai ca đơn vị KHÔNG bắt được nếu khung dựng thử không gắn bộ định tuyến | TC-030, TC-031, TC-032 |
| `R2-ICON` | Đổi sang một biểu tượng riêng cho màn này | ca so biểu tượng với danh mục hành động chung | TC-033, TC-034, TC-123, TC-131 |
| `R2-FILE` | Nút tải xuống dùng thuộc tính download ép tên tệp | ca tên tệp tiếng Việt: tên nhận được khác tên máy chủ khai | TC-035, TC-036, TC-037, TC-106, TC-107 |
| `R2-A11Y` | Nhãn trợ năng để nguyên chuỗi 'Sửa nhanh' cho mọi dòng | ca nhãn đọc được: 50 nút trùng nhãn, không nhận ra dòng | TC-038, TC-039, TC-129, TC-132, TC-135 |
| `R2-SAVE` | Popup lưu xong không làm mới dữ liệu bảng | ca cập nhật ngay: ô vẫn giá trị cũ cho tới khi tải lại trang | TC-040, TC-041, TC-104, TC-108, TC-109, TC-110, TC-122, TC-126, TC-128, TC-133 |
| `R3-POS` | Cột Loại thông tin chèn vào cuối bảng | ca vị trí: không đứng ngay trước Nguồn đơn/Đơn vị giao | TC-042, TC-043 |
| `R3-DATA` | Máy chủ trả 200 kèm mảng rỗng khi danh mục chưa seed | ca COV-R3-DATA-3: ô im lặng thay vì nói rõ danh mục chưa có mục. Ca giả lập LỖI (DATA-2) KHÔNG bắt được — đó là lý do phải tách hai | TC-044, TC-045, TC-046, TC-125 |
| `R3-EXPORT` | Thêm cột lên bảng nhưng quên khai ở đường xuất | ca cột trong tệp xuất | TC-047 |
| `R4-BTN` | Nút hiện ở cả chế độ tạo mới | ca phủ định chế độ tạo mới | TC-048, TC-049 |
| `R4-COPY` | Hàm chép trả về đối tượng rỗng | ca đơn mới mang nội dung đơn cũ | TC-050, TC-130 |
| `R4-FRESH` | Gỡ khoá dựng lại theo hồ sơ khỏi một tuyến biểu mẫu | ca cổng tuyến (COV-R4-FRESH-3) đỏ ngay; ca E2E đường vòng A→tạo mới→B cũng đỏ | TC-051, TC-052, TC-053, TC-054 |
| `R4-SAVE` | Hàm lưu gửi kèm định danh đơn nguồn | ca đơn cũ không đổi: đơn nguồn bị ghi đè | TC-055, TC-056 |
| `R5-PLACE` | Chuyển khu tải tệp sang tab tài liệu chung | ca vị trí khu tải tệp | TC-057 |
| `R5-TYPE` | Biểu mẫu tải lên đặt loại mặc định là Văn bản | ca loại KHÔNG rơi về Văn bản | TC-058, TC-059 |
| `R5-TWO` | Hai khu dùng chung một tiền tố định danh | ca định danh riêng: chọn được nhiều hơn một phần tử | TC-060, TC-061 |
| `R5-SEED` | Seed sửa thành không làm gì cả | ca COV-R5-SEED-2 sau khi sửa: lần 1 không tạo mục nào. Bản CŨ của ca ấy KHÔNG bắt được vì chỉ đếm 0 = 0 | TC-062, TC-063, TC-140 |
| `R6-DEFAULT` | Giá trị mặc định gán cả ở chế độ sửa | ca hồ sơ cũ giá trị Có: bị đè thành Không | TC-064, TC-065 |
| `R6-REMOVE` | Ô vẫn còn trên màn sửa, chỉ ẩn ở màn tạo | ca kiểm cả hai màn | TC-066 |
| `R6-KEEP` | Ô đã ẩn gửi lên chuỗi rỗng trong khi hồ sơ đang có dữ liệu | ca giữ dữ liệu (COV-R6-KEEP-1/2) đỏ, và ca gieo lỗi COV-R6-KEEP-3 chứng minh cổng bắt được. Bản CŨ của KEEP-3 gieo bằng cách bỏ khoá — KHÔNG bắt được lớp lỗi này | TC-067, TC-068, TC-069 |
| `R7-SUGGEST` | Mẫu tìm đổi từ %chuoi% sang chuoi% | ca khớp GIỮA chuỗi | TC-070, TC-071, TC-072 |
| `R7-MIN` | Ngưỡng tối thiểu đổi từ 2 lên 3 ký tự | ca biên 2 ký tự: không trả gợi ý | TC-073, TC-074 |
| `R7-MAX` | Bỏ mệnh đề giới hạn số kết quả | ca biên tối đa: trả về hơn 10 mục | TC-075 |
| `R7-TYPE` | Ô gợi ý chốt giá trị ở sự kiện rời ô thay vì từng phím | ca gõ tên chưa có rồi bấm Lưu NGAY: tên bị mất | TC-076, TC-077 |
| `R7-SCOPE` | Truy vấn gợi ý bỏ bộ lọc phạm vi | hai ca phạm vi: trả tên hồ sơ tổ khác | TC-078, TC-079 |
| `R8-LABEL` | Hai nút đặt cùng một nhãn | ca nhãn phân biệt được | TC-080, TC-081, TC-111, TC-112, TC-113, TC-114, TC-120, TC-121 |
| `R8-TITLE` | Một trong hai đường xuất giữ lại hậu tố ĐẦY ĐỦ TRƯỜNG | ca phủ định hậu tố, chạy trên CẢ HAI tệp | TC-082, TC-083, TC-084 |
| `R8-ONE` | Tách hằng số tiêu đề thành hai chuỗi viết thẳng | ca đếm chuỗi viết thẳng | TC-085 |
| `R9-ALIGN` | Bọc hai nút xuất trong một khối xếp dọc | ca đo toạ độ tâm dọc, và ca đọc cây phần tử | TC-086, TC-087, TC-134, TC-136, TC-137 |
| `R9-WRAP` | Gỡ thuộc tính cho phép xuống dòng khỏi hàng nút | ca màn hẹp 400 pixel: xuất hiện thanh cuộn ngang | TC-088, TC-089, TC-138 |
| `R9-ERR` | Chữ báo lỗi đặt trong luồng thay vì tách khỏi luồng | ca nút đang báo lỗi: bốn nút lệch đường căn | TC-090 |
| `X1` | Bộ đọc ngày viết đơn từ chối chữ tự do | ca hồ sơ DI TRÚ: báo lỗi giả trên 4.454 hồ sơ mang chữ tự do | TC-091, TC-092 |
| `X2` | Nút 'đang xem' dùng chung bộ cột đã cắt theo dữ liệu | ca phủ định: cột đang hiện mà rỗng ở trang này bị mất khỏi tệp | TC-093, TC-094 |
| `X3` | Thêm một khoá vào thân lời gọi mà không khai ở lược đồ máy chủ | ca cổng đối chiếu khoá; ca tạo đơn bình thường trả 400 thay vì 201 | TC-095, TC-096 |
| `X4` | Quyền mới chỉ cấp cho vai quản trị | hai ca vai cán bộ: bị từ chối | TC-097, TC-098 |
| `X5` | Deploy chuyển tệp nhưng không khởi động lại tiến trình | ca mốc bản dựng: mã bản dựng vẫn là bản cũ | TC-099, TC-139 |
| `X6` | Đường xuất gọi thẳng kho dữ liệu, đi vòng qua bộ lọc phạm vi | ba ca phạm vi, gồm COV-X6-3 cho nút 'đang xem' — nút ấy trước lượt soát Codex KHÔNG có ca nào phủ | TC-100, TC-101, TC-102 |

## Kết quả

- **47 luật** được gieo lỗi.
- **0 luật không ca nào phủ** — không có.

## Ba chỗ bảng này chứng minh lượt soát đối kháng là cần thiết

Ba dòng dưới đây, ở **bản trước lượt soát Codex**, gieo lỗi mà KHÔNG ca nào bắt được:

| Luật | Lỗi lọt | Vì sao ca cũ không bắt |
|---|---|---|
| `R6-KEEP` | gửi chuỗi rỗng đè lên ô đang có dữ liệu | ca gieo lỗi cũ bỏ khoá khỏi thân lời gọi — máy chủ trộn theo khoá có mặt nên dữ liệu **giữ nguyên**, cổng không đỏ |
| `R5-SEED` | seed không làm gì cả | ca cũ chỉ đếm số mục giữa hai lượt: 0 bằng 0 |
| `R3-DATA` | máy chủ trả 200 kèm mảng rỗng | ca cũ giả lập máy chủ trả **lỗi**, không chạm tới nhánh thành công-mà-rỗng |

Cộng thêm `X6`: nút xuất "đang xem" trước lượt soát **không có ca phạm vi nào**.

## Còn trống

Bảng này là gieo lỗi trên **giấy**. Nó chỉ ra ca nào *phải* đỏ, chưa chứng minh ca ấy
*thật sự* đỏ — muốn thế phải chạy được bộ ca, mà 138/140 ca đang chặn ở tài khoản thử
prod. Khi có tài khoản, mỗi dòng ở đây thành một lượt gieo thật.
