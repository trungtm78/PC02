# UAT — Đợt 22–23/09/2026 (hai màn Đơn thư)

12 PR (#467 → #482) · 54 tệp sản phẩm · prod 47.626 đơn thư.

**140 ca / 10 nhóm A–J.** Số 140 là `TC_min` do `coverage_calc.py` tính từ `_coverage-ledger.md`, KHÔNG phải con số đặt ra: `M1=140 · M2=120 · M3=33 · M4=120 → MAX=140`. Độ phủ 134/140 item (95,7%) — 6 item còn lại là GAP có lý do, khai rõ trong ledger.

Điều kiện kết thúc: 100% dòng PASS. **Bỏ qua ≠ đạt.**

## Quy ước

- **Nguồn**: yêu cầu số mấy của anh (YC1–YC14), hoặc lỗi đang sống trên bản đang chạy.
- **Oracle lấy từ `_domain-pack.md`**, tức từ yêu cầu của anh — không lấy từ mã nguồn.
- Ca kiểm tự động đã có là **lớp đơn vị/thành phần**, KHÔNG thay được UAT.

---

## A. Xuất Excel "mọi trường"

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| A1 | Tệp mọi trường chứa ô chỉ có trên form, không có trên bảng | R1-ALL | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A2 | Số cột tệp mọi trường đếm được đúng 42 | R1-COUNT | BOUNDARY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A3 | Ô nằm trong nhóm GẬP trên form vẫn được xuất | R1-HIDDEN | EDGE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A4 | Cột thuộc nhóm gập mà CÓ dữ liệu thì thật sự xuất hiện trong tệp | R1-HIDDEN | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A5 | Cột rỗng sạch không có trong tệp | R1-EMPTY | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A6 | 88 khoá metadata rỗng sạch đã bị cắt | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A7 | 3 cột riêng rỗng sạch đã bị cắt | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A8 | Rỗng kiểu NULL được tính là rỗng | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A9 | Rỗng kiểu chuỗi trắng được tính là rỗng | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A10 | Rỗng kiểu mảng rỗng được tính là rỗng | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A11 | Rỗng kiểu JSON null được tính là rỗng | R1-EMPTY | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A12 | Hai lần xuất liên tiếp cho cùng bộ cột | R1-FIXED | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A13 | Bộ cột KHÔNG đo lại lúc xuất | R1-FIXED | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A14 | Ba cột định danh stt, sttCu, status đều có mặt | R1-COUNT | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A15 | Từng ô trong tệp khớp dữ liệu nguồn, đối chiếu theo hồ sơ | R1-VALUE | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A16 | Tập 42 cột khớp ĐÚNG bộ cột chuẩn, không chỉ đúng số lượng | R1-VALUE | BOUNDARY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A17 | Khoá lưu đọc đúng cho cột riêng | R1-VALUE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A18 | Khoá lưu đọc đúng cho khoá metadata | R1-VALUE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A19 | Cột đã cắt mà có dữ liệu thì phép đo báo ĐỎ | R1-GUARD | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A20 | Phép đo trong deploy chỉ cảnh báo, không chặn deploy | R1-GUARD | EDGE | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A21 | Xuất đúng trần 5.000 dòng | R1-CAP | BOUNDARY | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A22 | Quá trần thì cắt còn 5.000 và nói rõ đã cắt | R1-CAP | BOUNDARY | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A23 | Thiếu quyền xuất đầy đủ thì bị từ chối | R1-ALL | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A24 | Vai vô danh không gọi được đường xuất | R1-ALL | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A25 | Kết cặp nguồn đơn x loại thông tin x trạng thái trên tệp xuất | R1-VALUE | EP | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| A26 | Vượt trần xuất thì báo trước, không để tải xong mới hỏng | R1-CAP | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## B. Sửa nhanh ngay trong bảng

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| B1 | Ô RỖNG hiện nút có cả biểu tượng và nhãn chữ | R2-EMPTY | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B2 | Bấm nút ở ô rỗng mở popup nhập | R2-EMPTY | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B3 | Ô ĐÃ CÓ chữ vẫn có nút sửa nhanh | R2-FILLED | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B4 | Bấm nút ở ô có chữ mở popup mang sẵn giá trị cũ | R2-FILLED | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B5 | Sửa giá trị cũ rồi lưu thì giá trị mới thay thế | R2-FILLED | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B6 | Bấm vào CHỮ mở hồ sơ, KHÔNG mở popup | R2-TEXT | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B7 | Ô rỗng thì nút chính là nội dung ô | R2-TEXT | EDGE | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B8 | Thành phần nút chặn lan sự kiện chuột trong khung dựng thử | R2-STOP | STATE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B9 | Thành phần nút chặn lan sự kiện bàn phím trong khung dựng thử | R2-STOP | STATE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B10 | Trên BẢNG THẬT, Enter ở nút mở popup mà không chuyển sang hồ sơ | R2-STOP | STATE | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B11 | Biểu tượng là bút, cùng biểu tượng sửa của hệ | R2-ICON | GREEN | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B12 | Vùng chạm của nút đạt tối thiểu WCAG 2.2 | R2-ICON | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B13 | Tải tệp lên từ ngay trong danh sách | R2-FILE | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B14 | Tải tệp xuống từ ngay trong danh sách | R2-FILE | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B15 | Tên tệp tải về theo máy chủ, không bị ép tên | R2-FILE | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B16 | Nhãn đọc được nói rõ sửa ô nào của hồ sơ nào | R2-A11Y | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B17 | Tới được nút bằng phím Tab | R2-A11Y | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B18 | Lưu xong bảng cập nhật ngay, không cần tải lại | R2-SAVE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B19 | Lưu hỏng thì báo lỗi và KHÔNG mất chữ đã gõ | R2-SAVE | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B20 | Sửa nhanh hồ sơ ngoài phạm vi bị chặn | R2-SAVE | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B21 | Tệp ngoài danh sách loại cho phép bị từ chối | R2-FILE | SECURITY | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B22 | Tên tệp chứa ký tự đường dẫn bị vô hiệu hoá | R2-FILE | SECURITY | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B23 | Đóng popup rồi mở lại thì lấy giá trị từ máy chủ | R2-SAVE | STATE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B24 | Lưu xong rồi mở dòng KHÁC không mang giá trị dòng trước | R2-SAVE | STATE | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B25 | Hai tab cùng mở, tab A sửa nhanh, tab B tải lại thấy đúng | R2-SAVE | STATE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B26 | Sửa nhanh: ô rỗng, có quyền sửa | R2-FILLED | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B27 | Sửa nhanh: ô có chữ, có quyền sửa | R2-FILLED | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B28 | Sửa nhanh: ô rỗng, không quyền sửa | R2-FILLED | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B29 | Sửa nhanh: ô có chữ, không quyền sửa | R2-FILLED | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B30 | Popup sửa nhanh có lối thoát rõ ràng | R2-SAVE | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B31 | Nút sửa nhanh nhất quán với chỗ sửa khác trong hệ | R2-ICON | UX | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B32 | Thông báo lỗi nói được cách khắc phục | R2-SAVE | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B33 | Sửa từ bảng ít thao tác hơn mở hồ sơ | R2-EMPTY | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B34 | Popup có đủ trạng thái tải, rỗng, lỗi, khoá | R2-SAVE | UX | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B35 | Tiêu điểm không bị che khi cuộn bảng | R2-A11Y | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B36 | Tương phản chữ trên nút đạt mức AA | R2-ICON | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B37 | Mọi nút có tên đọc được | R2-A11Y | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B38 | Popup giữ tiêu điểm đúng cách và Esc thoát được | R2-SAVE | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| B39 | Quét tự động không còn lỗi mức A/AA | R2-A11Y | A11Y | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## C. Cột "Loại thông tin"

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| C1 | Cột Loại thông tin đứng ngay trước Nguồn đơn/Đơn vị giao | R3-POS | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C2 | Thứ tự cột giữ nguyên sau khi tải lại trang | R3-POS | STATE | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C3 | Danh mục loại thông tin có mục để chọn | R3-DATA | DATA | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C4 | Máy chủ trả LỖI thì ô báo tải hỏng | R3-DATA | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C5 | Máy chủ trả THÀNH CÔNG với danh sách rỗng thì nói rõ là danh mục chưa có mục | R3-DATA | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C6 | Cột Loại thông tin có trong tệp xuất | R3-EXPORT | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| C7 | Trạng thái rỗng của bảng phân biệt với tải hỏng | R3-DATA | UX | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## D. Tạo đơn mới từ đơn đang mở

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| D1 | Nút hiện khi đang SỬA hồ sơ | R4-BTN | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D2 | Nút KHÔNG hiện khi đang tạo mới | R4-BTN | RED | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D3 | Đơn mới mang theo nội dung đơn cũ | R4-COPY | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D4 | Đơn mới KHÔNG mang STT của đơn cũ | R4-FRESH | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D5 | Đơn mới KHÔNG mang kết quả xử lý của đơn cũ | R4-FRESH | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D6 | Mọi tuyến form đều được gắn khoá dựng lại theo hồ sơ | R4-FRESH | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D7 | Đi hồ sơ A rồi tạo mới rồi sang hồ sơ B không dính trạng thái | R4-FRESH | STATE | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D8 | Lưu thì ra một hồ sơ MỚI | R4-SAVE | GREEN | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D9 | Đơn cũ không đổi sau khi lưu đơn mới | R4-SAVE | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| D10 | Không đòi nhập lại thông tin vừa nhập | R4-COPY | A11Y | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## E. Khu tải tệp cạnh Kết quả xử lý

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| E1 | Khu tải tệp nằm cạnh ô Kết quả xử lý | R5-PLACE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E2 | Tệp tải ở khu này mang đúng loại của khu | R5-TYPE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E3 | Loại KHÔNG rơi về Văn bản | R5-TYPE | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E4 | Hai khu tải tệp phân biệt được trên màn hình | R5-TWO | UX | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E5 | Hai khu có định danh kiểm thử riêng | R5-TWO | GREEN | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E6 | Danh mục loại tài liệu có mục sau khi deploy | R5-SEED | DATA | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E7 | Seed lần đầu TẠO ĐỦ mục, lần hai giữ nguyên định danh và nội dung | R5-SEED | DATA | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| E8 | Seed chạy trong deploy và deploy ĐỎ nếu seed hỏng | R5-SEED | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## F. Hai ô trên form

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| F1 | Màn tạo mới: ô báo cáo Ban Giám đốc đã là Không | R6-DEFAULT | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| F2 | Hồ sơ cũ có giá trị khác thì GIỮ, không đè Không | R6-DEFAULT | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| F3 | Ô Đồ vật, tài liệu kèm theo không còn trên form | R6-REMOVE | GREEN | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| F4 | Mở hồ sơ cũ, KHÔNG sửa gì, Lưu: ô đã ẩn đi nguyên vẹn | R6-KEEP | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| F5 | Sửa một ô KHÁC rồi Lưu: ô đã ẩn vẫn nguyên | R6-KEEP | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| F6 | Gieo lỗi: gửi RỖNG đè lên ô đã ẩn thì cổng phải ĐỎ | R6-KEEP | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## G. Ô tên người gửi gợi ý

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| G1 | Gõ 2 ký tự trở lên thì hiện tên đã có trong dữ liệu | R7-SUGGEST | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G2 | Khớp GIỮA chuỗi, không chỉ khớp đầu chuỗi | R7-SUGGEST | EP | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G3 | Ký tự đặc biệt của mẫu tìm được thoát đúng | R7-SUGGEST | SECURITY | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G4 | Một ký tự thì CHƯA gợi ý | R7-MIN | BOUNDARY | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G5 | Hai ký tự thì CÓ gợi ý | R7-MIN | BOUNDARY | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G6 | Nhiều kết quả thì cắt còn tối đa 10 | R7-MAX | BOUNDARY | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G7 | Gõ tên CHƯA CÓ rồi bấm Lưu NGAY thì tên được ghi | R7-TYPE | RED | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G8 | Gõ rồi rời ô rồi quay lại, chữ còn nguyên | R7-TYPE | STATE | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G9 | Gợi ý chỉ lấy hồ sơ trong phạm vi người đăng nhập | R7-SCOPE | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| G10 | Cán bộ tổ khác không thấy tên ngoài phạm vi | R7-SCOPE | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## H. Nhãn nút và tiêu đề tệp

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| H1 | Hai nút có nhãn phân biệt được | R8-LABEL | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H2 | Nhãn nói rõ nút nào xuất đúng cột đang xem | R8-LABEL | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H3 | Tiêu đề trong tệp nút đang xem là DANH SÁCH ĐƠN THƯ | R8-TITLE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H4 | Tiêu đề trong tệp nút mọi trường là DANH SÁCH ĐƠN THƯ | R8-TITLE | GREEN | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H5 | Không còn hậu tố ĐẦY ĐỦ TRƯỜNG | R8-TITLE | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H6 | Một hằng số tiêu đề dùng cho cả hai đường xuất | R8-ONE | GREEN | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H7 | Nút xuất: có bộ lọc, có quyền xuất đầy đủ | R8-LABEL | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H8 | Nút xuất: có bộ lọc, không quyền xuất đầy đủ | R8-LABEL | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H9 | Nút xuất: không bộ lọc, có quyền xuất đầy đủ | R8-LABEL | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H10 | Nút xuất: không bộ lọc, không quyền xuất đầy đủ | R8-LABEL | DECISION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H11 | Đang xuất thì nút cho biết hệ đang chạy | R8-LABEL | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| H12 | Nhãn nút dùng từ nghiệp vụ, không dùng từ kỹ thuật | R8-LABEL | UX | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## I. Hàng nút không lệch

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| I1 | Bốn nút và dòng đếm nằm cùng một đường căn | R9-ALIGN | UX | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I2 | Nhóm hành động phụ không dựng khối bọc dọc | R9-ALIGN | GREEN | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I3 | Màn hẹp thì hàng nút xuống dòng, không tràn | R9-WRAP | COMPAT | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I4 | Nhãn dài khi có thay đổi chưa áp dụng cũng không tràn | R9-WRAP | COMPAT | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I5 | Nút đang báo LỖI không làm lệch hàng | R9-ERR | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I6 | Thứ tự tiêu điểm theo thứ tự đọc | R9-ALIGN | A11Y | P2 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I7 | Chạy đúng trên Chrome | R9-ALIGN | COMPAT | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I8 | Chạy đúng trên Edge Chromium | R9-ALIGN | COMPAT | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| I9 | Bố cục đúng ở màn 1366x768 | R9-WRAP | COMPAT | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |

## J. Bề mặt liền kề — hồi quy, quyền, phạm vi

| ID | Mệnh đề | Luật | Loại | Ưu tiên | Kết quả |
|---|---|---|---|---|---|
| J1 | Mở hồ sơ DI TRÚ thì không ô nào biến mất | X1 | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J2 | Hồ sơ DI TRÚ không báo lỗi giả ở ngày viết đơn | X1 | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J3 | Nút đang xem xuất đúng cột đang nhìn | X2 | REGRESSION | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J4 | Nút đang xem KHÔNG cắt cột theo dữ liệu | X2 | RED | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J5 | Tạo đơn thư bình thường vẫn thành công | X3 | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J6 | Mọi khoá form gửi lên đều được máy chủ khai nhận | X3 | REGRESSION | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J7 | Cán bộ (không phải quản trị) lưu được đơn | X4 | PERMISSIONS | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J8 | Cán bộ xuất được tệp mọi trường | X4 | PERMISSIONS | P1 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J9 | Máy chủ báo mã bản dựng khớp commit đã hợp nhất | X5 | GREEN | P0 | **ĐẠT** — đo 23/09 04:38, buildId `290f65d17c` khớp `origin/main` |
| J10 | Cán bộ tổ khác không thấy hồ sơ ngoài phạm vi | X6 | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J11 | Tệp xuất cũng lọc theo phạm vi dữ liệu | X6 | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J12 | Tệp của nút ĐANG XEM cũng lọc theo phạm vi dữ liệu | X6 | SECURITY | P0 | **CHƯA CHẠY** — chặn ở tài khoản thử |
| J13 | Sau deploy, đường kiểm tra sức khoẻ trả mã bản dựng đúng | X5 | GREEN | P0 | **ĐẠT** — đo 23/09 04:38, buildId `290f65d17c` khớp `origin/main` |

---

## Lượt soát đối kháng đã chạy

Codex (`gpt-6-astra`) soát bộ 136 ca đầu tiên và bắt **7 lỗi thật**. Đã sửa trọn, bộ ca lên 140:

| # | Lỗi | Sửa |
|---|---|---|
| 1 | `COV-R6-KEEP-3` gieo lỗi bằng cách **bỏ khoá** khỏi thân lời gọi, trong khi oracle cảnh báo **gửi rỗng đè lên**. Bỏ khoá không làm mất dữ liệu | Gieo chuỗi rỗng và `null` lên ô đang có dữ liệu |
| 2 | `COV-R1-HIDDEN-2` chỉ kiểm **nhãn lý do** loại trừ — bộ xuất vẫn có thể bỏ sạch cột gập miễn bảng lý do ghi chữ "rỗng" | Đổi sang đối chiếu cột gập CÓ dữ liệu thật sự xuất ra |
| 3 | `COV-R5-SEED-2` chỉ đếm số mục giữa hai lượt — seed **không làm gì cả** vẫn xanh vì 0 bằng 0 | So nguyên bộ ba (id, mã, tên); lần 1 phải TẠO, lần 2 phải GIỮ NGUYÊN |
| 4 | `COV-R1-ALL-2` + `COV-R1-VALUE-1` chỉ đếm 42 và đòi mỗi cột có ≥1 ô khác rỗng — **đúng số nhưng sai tập cột hoặc lệch giá trị vẫn lọt** | Thêm `COV-R1-VALUE-4` so TẬP cột; đổi VALUE-1 sang đối chiếu từng ô với nguồn độc lập |
| 5 | `COV-R2-STOP-1/2` nói về bảng nhưng bằng chứng là bộ nghe giả ở tầng UNIT | Thu hẹp câu chữ về "khung dựng thử"; thêm `COV-R2-STOP-3` tầng E2E trên bảng thật |
| 6 | `COV-R3-DATA-2` nói "danh mục rỗng" nhưng dựng **máy chủ trả lỗi** — bỏ sót đúng dạng hỏng im lặng (200 kèm mảng rỗng) | Tách làm hai: giữ ca lỗi, thêm `COV-R3-DATA-3` |
| 7 | `COV-R1-GUARD-1` ghi tầng UNIT nhưng thao tác là ghi CSDL bản sao rồi chạy CLI | Đổi tầng sang API (tích hợp CLI–CSDL) |

`COV-X6-3` thêm mới từ phát hiện 1 của Codex: ca phạm vi cũ chỉ phủ nút **mọi trường**, bỏ trống nút **đang xem** — đường ra thứ hai chưa ai kiểm có rò hồ sơ tổ khác không.

---

## Vì sao chưa dòng nào khác PASS

5 tài khoản thử bị khoá ngày 20/09 (mật khẩu lộ ở repo công khai) và anh chưa cấp tài khoản mới. Mọi ca E2E và phần lớn ca API đều cần đăng nhập prod.

Bốn ca phạm vi dữ liệu (`COV-R7-SCOPE-2`, `COV-X6-1`, `COV-X6-2`, `COV-X6-3`) cần **thêm** một tài khoản cán bộ thuộc tổ khác — không có tài khoản thứ hai thì chỉ chứng minh được là mình thấy hồ sơ của mình, không chứng minh được ranh giới.

Em KHÔNG ghi PASS cho ca chưa chạy, và KHÔNG suy PASS từ ca kiểm đơn vị: mệnh đề nói về sản phẩm thì bằng chứng phải đi qua giao diện hoặc HTTP.

## Trần kết luận hiện tại

`self_audit.py` → **SẴN SÀNG-KÈM-KHUYẾT**. Soát đối kháng đã chạy (Codex, 7 phát hiện, đã sửa). Còn trống hai phép đo máy không làm được: **gieo lỗi** và **đánh giá trải nghiệm bằng người đóng vai thật**.
