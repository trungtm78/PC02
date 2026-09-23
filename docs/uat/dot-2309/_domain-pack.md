# Domain pack — oracle đợt 22–23/09/2026 (hai màn Đơn thư)

**Oracle lấy từ ĐẶC TẢ, không lấy từ mã.** Nguồn: 14 yêu cầu anh gửi trong hai ngày 22 và
23/09/2026, trích nguyên văn ở mỗi mục. Đọc kết quả mong đợi từ mã là tự chứng minh mình đúng —
mã sai thì ca kiểm sai theo.

**Phạm vi:** 12 PR (#467 → #482), 54 tệp sản phẩm, 5.181 dòng thêm.

**Số nền đo trên prod 23/09/2026:** 47.626 đơn thư chưa xoá.

---

## R1 — Xuất Excel "mọi trường"

**Nguồn: yêu cầu 1 (22/09), yêu cầu 11 và 13 (23/09).**

> YC1: *"xuất excel ra tất cả các field đã đăng ký trên form"*
> YC11: *"xuất đầy đủ vì xuất ra rất nhiều field dư thừa, chỉ xuất tất cả các field mà tại màn
> hình tạo mới/đăng ký có thao tác thôi, các field ẩn hoặc thu nhỏ không cần đưa lên"*
> YC13: *"rà soát lại nếu trường nào trong toàn bộ data không có thì không đưa field đó vào"*
> Chốt: *"chuẩn hóa cột hiển thị vào thời điểm hiện tại… sau các cột đã chuẩn hóa thì sẽ được
> xuất ra trong tất cả các lần xuất excel (toàn bộ trường)"*

| Mã | Luật |
|---|---|
| R1-ALL | Tệp "mọi trường" chứa MỌI ô cán bộ thao tác được trên màn tạo/sửa — không chỉ cột đang hiện trên bảng. |
| R1-HIDDEN | Ô nằm trong nhóm GẬP vẫn được xuất. Gập là chuyện bố cục, không phải lý do loại. |
| R1-EMPTY | Ô mà **toàn bộ** dữ liệu hiện tại đều rỗng thì KHÔNG xuất. Rỗng = NULL, chuỗi trắng, mảng rỗng, hoặc JSON null. |
| R1-FIXED | Bộ cột chuẩn hoá MỘT lần rồi cố định. Lần xuất sau KHÔNG đo lại — hai tệp xuất cách nhau phải cùng hình dạng để đối chiếu được. |
| R1-COUNT | Sau chuẩn hoá: **42 cột**. Từ 130 ô đăng ký, cắt 88 khoá `metadata` rỗng sạch và 3 cột riêng rỗng sạch (`lanhDaoToTung`, `ngayXayRa`, `noiXayRaPhuongXa`), giữ 3 cột định danh (`stt` 47.626 · `sttCu` 31.473 · `status` 47.626). |
| R1-VALUE | Cột có trong tệp phải mang GIÁ TRỊ, không phải ô trống. Lớp lỗi đã xảy ra ở #475: 44 trường xuất ra ô trống vì đọc sai khoá lưu. |
| R1-GUARD | Cột đã cắt mà sau này CÓ dữ liệu thì phép đo phải báo — nếu không, bộ cột cố định sẽ âm thầm thiếu. |
| R1-CAP | Trần 5.000 dòng mỗi lượt xuất. Đo: 2.492 byte chữ/hồ sơ trung bình (tối đa 28.725) ⇒ 5.000 dòng ≈ 12 MB. |

## R2 — Sửa nhanh ngay trong bảng

**Nguồn: yêu cầu 2 (22/09), yêu cầu 9 (23/09), và câu hỏi chốt 23/09.**

> YC2: *"Kết quả xử lý, giải quyết khác — nhập nhanh + tải tệp lên/tải xuống từ ngoài danh sách"*
> YC9: *"icon edit nhanh rất khó nhìn hãy sửa lại icon cho dễ nhìn và chuyên nghiệp"*
> Câu hỏi chốt: *"trường hợp đã có kết quả xử lý rồi sửa nhanh bên ngoài danh sách cũng được luôn
> phải không (không chỉ là tạo mới trong trường hợp chưa có dữ liệu)"* → **Có.**

| Mã | Luật |
|---|---|
| R2-EMPTY | Ô RỖNG: nút sửa nhanh mang cả biểu tượng và nhãn chữ, vì không có gì khác trong ô để bấm. |
| R2-FILLED | Ô ĐÃ CÓ chữ: sửa nhanh vẫn dùng được. Đây là câu anh hỏi thẳng — không phải chỉ tạo mới. |
| R2-TEXT | Bấm vào **CHỮ** trong ô vẫn mở hồ sơ như mọi ô khác (`DESIGN.md §11.2`). Chỉ nút mới mở popup. |
| R2-STOP | Nút chặn lan cả `click` LẪN `keydown` — chặn mỗi `click` thì bàn phím vẫn mở nhầm hồ sơ. |
| R2-ICON | Biểu tượng là `Pencil`, đúng biểu tượng sửa của hệ (`commonResourceActions.ts`). Không dựng biểu tượng riêng cho một màn. |
| R2-FILE | Tải tệp lên và tải tệp xuống làm được từ ngay trong danh sách, không phải mở hồ sơ ra. |
| R2-A11Y | Nút có `aria-label` nói rõ đang sửa ô nào của hồ sơ nào — người dùng bàn phím nghe "Sửa nhanh" trơ trọi thì không biết sửa dòng nào. |
| R2-SAVE | Lưu từ popup xong, giá trị mới hiện ngay trên bảng, không cần tải lại trang. |

**Số nền:** `ketQuaXuLyKhac` có dữ liệu ở 11.225/47.626 hồ sơ (24%) ⇒ **76% ô rỗng**. Cả hai
trạng thái đều là đường đi hàng ngày, không cái nào là ca biên.

## R3 — Cột "Loại thông tin"

**Nguồn: yêu cầu 3 (22/09).**

> *"thêm cột Loại thông tin trước cột Nguồn đơn/Đơn vị giao"*

| Mã | Luật |
|---|---|
| R3-POS | Cột đứng NGAY TRƯỚC "Nguồn đơn/Đơn vị giao", không phải cuối bảng. |
| R3-DATA | Danh mục loại thông tin có mục để chọn. Danh mục rỗng là hỏng im lặng — đã gặp ở #470. |
| R3-EXPORT | Cột này cũng ra tệp xuất, cùng thứ tự như trên bảng. |

## R4 — Tạo đơn mới từ đơn đang mở

**Nguồn: yêu cầu 4 (22/09).**

> *"thêm button tạo đơn thư mới từ đơn thư này khi đang ở chế độ sửa"*

| Mã | Luật |
|---|---|
| R4-BTN | Nút chỉ hiện ở chế độ SỬA, không hiện khi đang tạo mới. |
| R4-COPY | Đơn mới mang theo nội dung đơn cũ để cán bộ khỏi gõ lại. |
| R4-FRESH | Đơn mới KHÔNG mang theo **STT** và **kết quả xử lý** của đơn cũ. Đây là chỗ đã hỏng: 5 tuyến form không bọc `DungLaiTheoId` nên React giữ nguyên trạng thái khi đi từ hồ sơ sang trang tạo mới. |
| R4-SAVE | Bấm Lưu thì ra một hồ sơ MỚI, đơn cũ không đổi. |

## R5 — Khu tải tệp cạnh "Kết quả xử lý"

**Nguồn: yêu cầu 5 (22/09).**

> *"thêm phần tải file lên ngay cạnh Kết quả xử lý trên form"*

| Mã | Luật |
|---|---|
| R5-PLACE | Khu tải tệp nằm cạnh ô "Kết quả xử lý", không phải ở tab tài liệu chung. |
| R5-TYPE | Tệp tải lên ở khu này mang đúng loại của khu, không rơi về "Văn bản". |
| R5-TWO | Form có HAI khu xếp hàng (tệp chung và tệp kết quả) — mỗi khu phân biệt được, cả với cán bộ lẫn với ca kiểm. |
| R5-SEED | Danh mục loại tài liệu phải có mục, nếu không khu tải tệp mở ra RỖNG. |

## R6 — Hai ô trên form

**Nguồn: yêu cầu 6 và 7 (22/09).**

> YC6: *"Trường hợp báo cáo Ban Giám đốc mặc định Không"*
> YC7: *"bỏ trường Đồ vật, tài liệu kèm theo"*

| Mã | Luật |
|---|---|
| R6-DEFAULT | Màn tạo mới mở ra, ô "Trường hợp báo cáo Ban Giám đốc" đã là "Không", cán bộ không phải chọn. |
| R6-REMOVE | Ô "Đồ vật, tài liệu kèm theo" không còn trên form. |
| R6-KEEP | Ô đã bỏ khỏi màn hình mà hồ sơ cũ có dữ liệu thì dữ liệu ấy **giữ nguyên** khi lưu. Bỏ ô mà thân lời gọi gửi rỗng đè lên là mất dữ liệu — không ai thấy, vì ô gây mất đã không còn hiện. |

## R7 — Ô tên người gửi gợi ý theo dữ liệu đã có

**Nguồn: yêu cầu 8 (22/09).**

> *"ô tên người gửi tìm kiếm giống Google trên dữ liệu đã có"*

| Mã | Luật |
|---|---|
| R7-SUGGEST | Gõ vào ô tên thì hiện tên đã có trong dữ liệu, khớp giữa chuỗi chứ không chỉ khớp đầu. |
| R7-MIN | Gõ dưới 2 ký tự thì chưa gợi ý. |
| R7-MAX | Nhiều nhất 10 gợi ý một lần. |
| R7-TYPE | Gõ tên **chưa từng có** rồi bấm Lưu ngay thì tên ấy được ghi. Ô gợi ý chỉ chốt giá trị lúc rời ô là mất chữ người ta vừa gõ. |
| R7-SCOPE | Gợi ý chỉ lấy từ hồ sơ trong phạm vi dữ liệu của người đang đăng nhập — không rò tên hồ sơ tổ khác. |

## R8 — Nhãn nút và tiêu đề tệp

**Nguồn: yêu cầu 10 và 12 (23/09).**

> YC10: *"phần xuất excel 2 button tên cũng rất khó hiểu"*
> YC12: *"tiêu đề đổi thành DANH SÁCH ĐƠN THƯ không để DANH SÁCH ĐƠN THƯ - ĐẦY ĐỦ TRƯỜNG"*

| Mã | Luật |
|---|---|
| R8-LABEL | Hai nút phân biệt được bằng nhãn: một nút xuất **đúng cột đang nhìn**, một nút xuất **mọi trường**. Đọc nhãn là biết nút nào làm gì. |
| R8-TITLE | Tiêu đề trong tệp là **`DANH SÁCH ĐƠN THƯ`** cho CẢ HAI nút. Không có hậu tố "ĐẦY ĐỦ TRƯỜNG". |
| R8-ONE | Một hằng số tiêu đề dùng cho cả hai đường xuất — hai chuỗi rời thì sẽ lệch nhau ở lần sửa sau. |

## R9 — Hàng nút không lệch

**Nguồn: yêu cầu 14 (23/09).**

> *"các button xuất excel cũng đang lệch"*

| Mã | Luật |
|---|---|
| R9-ALIGN | Bốn nút và dòng đếm nằm trên CÙNG một đường căn ngang. |
| R9-WRAP | Màn hẹp thì hàng nút xuống dòng, không tràn ra ngoài khung. |
| R9-ERR | Nút đang báo LỖI cũng không làm lệch hàng — chữ lỗi không được đẩy chiều cao nút. |

## X — Bề mặt liền kề, không sửa nhưng phải còn nguyên

| Mã | Luật |
|---|---|
| X1 | Mở hồ sơ **DI TRÚ** (hệ cũ) thì không ô nào biến mất, không ô nào báo lỗi giả. |
| X2 | Xuất Excel nút "đang xem" vẫn xuất đúng cột đang nhìn — nút ấy KHÔNG cắt theo dữ liệu. |
| X3 | Đơn thư tạo bình thường vẫn lưu được (không 400 vì khoá form mới chưa khai ở DTO). |
| X4 | OFFICER (không phải ADMIN) làm được mọi việc trên: OFFICER từng chỉ có quyền đọc nên không lưu được đơn. |
| X5 | Máy chủ báo `buildId` khớp lượt deploy — chống "deploy xong mà bản cũ còn sống". |
| X6 | Phạm vi dữ liệu: OFFICER tổ khác không thấy hồ sơ ngoài phạm vi, kể cả qua tệp xuất. |

---

## Đếm luật

R1×8 · R2×8 · R3×3 · R4×4 · R5×4 · R6×3 · R7×5 · R8×3 · R9×3 · X×6 = **47 luật**.
