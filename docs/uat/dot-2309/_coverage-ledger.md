# Coverage Ledger — đợt 22–23/09/2026 (hai màn Đơn thư)

> Sinh TRƯỚC khi viết ca (enumerate-before-write). Oracle: `_domain-pack.md` — lấy từ 14 yêu cầu
> của anh, không lấy từ mã. Cột **Tầng** nói bằng chứng đi qua đâu: **E2E** = Chrome thật + máy
> chủ + CSDL thật · **API** = HTTP thật · **UNIT** = ca kiểm đơn vị (chỉ dùng khi chủ ngữ của
> mệnh đề là một hàm, và câu chữ đã thu hẹp cho khớp).
>
> Ghi PASS cho mệnh đề rộng dựa trên bằng chứng hẹp là dạng trượt mà mọi tầng đều xanh trong khi
> tính năng không dùng được. Đợt này đã gặp **15 lần cổng rỗng** — xem `PROGRESS.md`.

## TC_min = MAX(M1, M2, M3, M4)

**Khai cho máy đọc (`coverage_calc.py` tự tính lại, không lấy số người tự ghi):**
`M2=120` · `FP=18` · `risk=CRITICAL`

M1 KHÔNG khai ở đây — nó được đếm từ số dòng của Sổ mệnh đề bên dưới.

| Phương pháp | Cách đếm | Giá trị |
|---|---|---|
| **M1** spec coverage items (29119-4) | **Đếm từ Sổ mệnh đề bên dưới**, không ước lượng: 47 luật trong `_domain-pack.md` khai triển thành coverage item qua AC + ca phủ định + EP + BVA + decision + state/sneak + đặc tính 25010 áp dụng | **136** |
| **M2** Σ V(G) cyclomatic | **Đo bằng `lizard 1.23.0`** trên 7 tệp MỚI có logic: `kiem-cot-xuat-day-du.ts` 42 · `xuat-day-du-don-thu.ts` 33 · `ONhapGoiY.tsx` 22 · `OSuaNhanh.tsx` 9 · `KetQuaXuLyModal.tsx` 7 · `chepSangDonMoi.ts` 4 · `lamTrongForm.ts` 3 — 58 hàm | **120** |
| **M3** ceil(FP^1.2) | 14 yêu cầu + 4 phần tăng phạm vi (CLI `kiem-cot-xuat-day-du`, `seed-loai-tai-lieu`, `seed-quyen`, nối vào `deploy.sh`) ≈ 18 FP → ceil(18^1.2) | **33** |
| **M4** risk-tier backstop | **CRITICAL 120** | **120** |

**TC_min = 136** (M1 chi phối). Tổng ca thật: **136** — đạt sàn bằng coverage, 0 ca chèn cho đủ số.

### Vì sao M4 là CRITICAL chứ không HIGH

Bảng tier là cố định (CRITICAL 120 · HIGH 80 · STANDARD 50 · LOW 25) — không có số ở giữa để
chọn. Đợt 20/09 xếp HIGH cho một form nhập liệu dùng hàng ngày có ghi dữ liệu và có in văn bản
gửi ra ngoài ngành. Đợt này mang **thêm một bề mặt mà đợt trước không có**: R6-REMOVE bỏ ô khỏi
màn hình. Bỏ ô mà thân lời gọi vẫn gửi rỗng đè lên là **xoá dữ liệu của hồ sơ cũ ngay lần cán bộ
mở ra sửa một ô khác** — 27.572 hồ sơ, và không ai thấy vì ô gây mất đã không còn hiện.

Mất dữ liệu im lặng trên hàng chục nghìn hồ sơ nghiệp vụ là CRITICAL.

### M2 không phải phỏng đoán

Đo trên **tệp thêm mới**, không đo cả tệp bị sửa: `lizard` trên 26 tệp sản phẩm thay đổi cho
ΣV(G) ≈ 979, nhưng con số ấy gồm cả mã có từ trước và sẽ thổi sàn lên một cách không trung thực.
3 tệp mới còn lại (`cot-xuat-day-du.loai-tru.ts`, `khai-truong-form-don-thu.generated.ts`,
`loai-tep.def.ts`) là khai báo thuần, 0 hàm, nên không vào tổng.

ΣV(G) của các hàm **bị sửa** trong tệp cũ chưa tính vào đây — nghĩa là 120 là **sàn dưới** của
M2, không phải giá trị đầy đủ. Không ảnh hưởng kết luận: M1 = 136 vẫn chi phối.

---

## Sổ mệnh đề

| Coverage item | Mệnh đề | Tầng | Loại | Ca |
|---|---|---|---|---|
| COV-R1-ALL-1 | Tệp mọi trường chứa ô chỉ có trên form, không có trên bảng | E2E | GREEN | TC-001 |
| COV-R1-ALL-2 | Số cột tệp mọi trường đếm được đúng 42 | E2E | BOUNDARY | TC-002 |
| COV-R1-HIDDEN-1 | Ô nằm trong nhóm GẬP trên form vẫn được xuất | E2E | EDGE | TC-003 |
| COV-R1-HIDDEN-2 | Gập KHÔNG phải lý do loại cột | UNIT | RED | TC-004 |
| COV-R1-EMPTY-1 | Cột rỗng sạch không có trong tệp | E2E | GREEN | TC-005 |
| COV-R1-EMPTY-2 | 88 khoá metadata rỗng sạch đã bị cắt | UNIT | EP | TC-006 |
| COV-R1-EMPTY-3 | 3 cột riêng rỗng sạch đã bị cắt | UNIT | EP | TC-007 |
| COV-R1-EMPTY-4 | Rỗng kiểu NULL được tính là rỗng | API | EP | TC-008 |
| COV-R1-EMPTY-5 | Rỗng kiểu chuỗi trắng được tính là rỗng | API | EP | TC-009 |
| COV-R1-EMPTY-6 | Rỗng kiểu mảng rỗng được tính là rỗng | API | EP | TC-010 |
| COV-R1-EMPTY-7 | Rỗng kiểu JSON null được tính là rỗng | API | EP | TC-011 |
| COV-R1-FIXED-1 | Hai lần xuất liên tiếp cho cùng bộ cột | E2E | GREEN | TC-012 |
| COV-R1-FIXED-2 | Bộ cột KHÔNG đo lại lúc xuất | UNIT | RED | TC-013 |
| COV-R1-COUNT-2 | Ba cột định danh stt, sttCu, status đều có mặt | E2E | GREEN | TC-014 |
| COV-R1-VALUE-1 | Mọi cột trong tệp mang giá trị, không phải ô trống | E2E | GREEN | TC-015 |
| COV-R1-VALUE-2 | Khoá lưu đọc đúng cho cột riêng | UNIT | GREEN | TC-016 |
| COV-R1-VALUE-3 | Khoá lưu đọc đúng cho khoá metadata | UNIT | GREEN | TC-017 |
| COV-R1-GUARD-1 | Cột đã cắt mà có dữ liệu thì phép đo báo ĐỎ | UNIT | RED | TC-018 |
| COV-R1-GUARD-2 | Phép đo trong deploy chỉ cảnh báo, không chặn deploy | API | EDGE | TC-019 |
| COV-R1-CAP-1 | Xuất đúng trần 5.000 dòng | API | BOUNDARY | TC-020 |
| COV-R1-CAP-2 | Quá trần thì cắt còn 5.000 và nói rõ đã cắt | API | BOUNDARY | TC-021 |
| COV-R2-EMPTY-1 | Ô RỖNG hiện nút có cả biểu tượng và nhãn chữ | E2E | GREEN | TC-022 |
| COV-R2-EMPTY-2 | Bấm nút ở ô rỗng mở popup nhập | E2E | GREEN | TC-023 |
| COV-R2-FILLED-1 | Ô ĐÃ CÓ chữ vẫn có nút sửa nhanh | E2E | GREEN | TC-024 |
| COV-R2-FILLED-2 | Bấm nút ở ô có chữ mở popup mang sẵn giá trị cũ | E2E | GREEN | TC-025 |
| COV-R2-FILLED-3 | Sửa giá trị cũ rồi lưu thì giá trị mới thay thế | E2E | GREEN | TC-026 |
| COV-R2-TEXT-1 | Bấm vào CHỮ mở hồ sơ, KHÔNG mở popup | E2E | RED | TC-027 |
| COV-R2-TEXT-2 | Ô rỗng thì nút chính là nội dung ô | E2E | EDGE | TC-028 |
| COV-R2-STOP-1 | Bấm chuột trên nút không lan ra dòng | UNIT | STATE | TC-029 |
| COV-R2-STOP-2 | Gõ Enter trên nút không lan ra dòng | UNIT | STATE | TC-030 |
| COV-R2-ICON-1 | Biểu tượng là bút, cùng biểu tượng sửa của hệ | UNIT | GREEN | TC-031 |
| COV-R2-ICON-2 | Vùng chạm của nút đạt tối thiểu WCAG 2.2 | E2E | A11Y | TC-032 |
| COV-R2-FILE-1 | Tải tệp lên từ ngay trong danh sách | E2E | GREEN | TC-033 |
| COV-R2-FILE-2 | Tải tệp xuống từ ngay trong danh sách | E2E | GREEN | TC-034 |
| COV-R2-FILE-3 | Tên tệp tải về theo máy chủ, không bị ép tên | E2E | RED | TC-035 |
| COV-R2-A11Y-1 | Nhãn đọc được nói rõ sửa ô nào của hồ sơ nào | E2E | A11Y | TC-036 |
| COV-R2-A11Y-2 | Tới được nút bằng phím Tab | E2E | A11Y | TC-037 |
| COV-R2-SAVE-1 | Lưu xong bảng cập nhật ngay, không cần tải lại | E2E | GREEN | TC-038 |
| COV-R2-SAVE-2 | Lưu hỏng thì báo lỗi và KHÔNG mất chữ đã gõ | E2E | RED | TC-039 |
| COV-R3-POS-1 | Cột Loại thông tin đứng ngay trước Nguồn đơn/Đơn vị giao | E2E | GREEN | TC-040 |
| COV-R3-POS-2 | Thứ tự cột giữ nguyên sau khi tải lại trang | E2E | STATE | TC-041 |
| COV-R3-DATA-1 | Danh mục loại thông tin có mục để chọn | E2E | DATA | TC-042 |
| COV-R3-DATA-2 | Danh mục rỗng thì báo hỏng, không im lặng | E2E | RED | TC-043 |
| COV-R3-EXPORT-1 | Cột Loại thông tin có trong tệp xuất | E2E | GREEN | TC-044 |
| COV-R4-BTN-1 | Nút hiện khi đang SỬA hồ sơ | E2E | GREEN | TC-045 |
| COV-R4-BTN-2 | Nút KHÔNG hiện khi đang tạo mới | E2E | RED | TC-046 |
| COV-R4-COPY-1 | Đơn mới mang theo nội dung đơn cũ | E2E | GREEN | TC-047 |
| COV-R4-FRESH-1 | Đơn mới KHÔNG mang STT của đơn cũ | E2E | RED | TC-048 |
| COV-R4-FRESH-2 | Đơn mới KHÔNG mang kết quả xử lý của đơn cũ | E2E | RED | TC-049 |
| COV-R4-FRESH-3 | Mọi tuyến form đều được gắn khoá dựng lại theo hồ sơ | UNIT | REGRESSION | TC-050 |
| COV-R4-FRESH-4 | Đi hồ sơ A rồi tạo mới rồi sang hồ sơ B không dính trạng thái | E2E | STATE | TC-051 |
| COV-R4-SAVE-1 | Lưu thì ra một hồ sơ MỚI | E2E | GREEN | TC-052 |
| COV-R4-SAVE-2 | Đơn cũ không đổi sau khi lưu đơn mới | API | REGRESSION | TC-053 |
| COV-R5-PLACE-1 | Khu tải tệp nằm cạnh ô Kết quả xử lý | E2E | GREEN | TC-054 |
| COV-R5-TYPE-1 | Tệp tải ở khu này mang đúng loại của khu | E2E | GREEN | TC-055 |
| COV-R5-TYPE-2 | Loại KHÔNG rơi về Văn bản | UNIT | RED | TC-056 |
| COV-R5-TWO-1 | Hai khu tải tệp phân biệt được trên màn hình | E2E | UX | TC-057 |
| COV-R5-TWO-2 | Hai khu có định danh kiểm thử riêng | UNIT | GREEN | TC-058 |
| COV-R5-SEED-1 | Danh mục loại tài liệu có mục sau khi deploy | API | DATA | TC-059 |
| COV-R5-SEED-2 | Chạy seed lại lần nữa vẫn an toàn | API | DATA | TC-060 |
| COV-R6-DEFAULT-1 | Màn tạo mới | E2E | GREEN | TC-061 |
| COV-R6-DEFAULT-2 | Hồ sơ cũ có giá trị khác thì GIỮ, không đè Không | E2E | RED | TC-062 |
| COV-R6-REMOVE-1 | Ô Đồ vật, tài liệu kèm theo không còn trên form | E2E | GREEN | TC-063 |
| COV-R6-KEEP-1 | Mở hồ sơ cũ, KHÔNG sửa gì, Lưu | E2E | REGRESSION | TC-064 |
| COV-R6-KEEP-2 | Sửa một ô KHÁC rồi Lưu | E2E | REGRESSION | TC-065 |
| COV-R6-KEEP-3 | Gieo lỗi | UNIT | RED | TC-066 |
| COV-R7-SUGGEST-1 | Gõ 2 ký tự trở lên thì hiện tên đã có trong dữ liệu | E2E | GREEN | TC-067 |
| COV-R7-SUGGEST-2 | Khớp GIỮA chuỗi, không chỉ khớp đầu chuỗi | API | EP | TC-068 |
| COV-R7-SUGGEST-3 | Ký tự đặc biệt của mẫu tìm được thoát đúng | API | SECURITY | TC-069 |
| COV-R7-MIN-1 | Một ký tự thì CHƯA gợi ý | API | BOUNDARY | TC-070 |
| COV-R7-MIN-2 | Hai ký tự thì CÓ gợi ý | API | BOUNDARY | TC-071 |
| COV-R7-MAX-1 | Nhiều kết quả thì cắt còn tối đa 10 | API | BOUNDARY | TC-072 |
| COV-R7-TYPE-1 | Gõ tên CHƯA CÓ rồi bấm Lưu NGAY thì tên được ghi | E2E | RED | TC-073 |
| COV-R7-TYPE-2 | Gõ rồi rời ô rồi quay lại, chữ còn nguyên | E2E | STATE | TC-074 |
| COV-R7-SCOPE-1 | Gợi ý chỉ lấy hồ sơ trong phạm vi người đăng nhập | API | SECURITY | TC-075 |
| COV-R7-SCOPE-2 | Cán bộ tổ khác không thấy tên ngoài phạm vi | API | SECURITY | TC-076 |
| COV-R8-LABEL-1 | Hai nút có nhãn phân biệt được | E2E | UX | TC-077 |
| COV-R8-LABEL-2 | Nhãn nói rõ nút nào xuất đúng cột đang xem | E2E | UX | TC-078 |
| COV-R8-TITLE-1 | Tiêu đề trong tệp nút đang xem là DANH SÁCH ĐƠN THƯ | E2E | GREEN | TC-079 |
| COV-R8-TITLE-2 | Tiêu đề trong tệp nút mọi trường là DANH SÁCH ĐƠN THƯ | E2E | GREEN | TC-080 |
| COV-R8-TITLE-3 | Không còn hậu tố ĐẦY ĐỦ TRƯỜNG | E2E | RED | TC-081 |
| COV-R8-ONE-1 | Một hằng số tiêu đề dùng cho cả hai đường xuất | UNIT | GREEN | TC-082 |
| COV-R9-ALIGN-1 | Bốn nút và dòng đếm nằm cùng một đường căn | E2E | UX | TC-083 |
| COV-R9-ALIGN-2 | Nhóm hành động phụ không dựng khối bọc dọc | UNIT | GREEN | TC-084 |
| COV-R9-WRAP-1 | Màn hẹp thì hàng nút xuống dòng, không tràn | E2E | COMPAT | TC-085 |
| COV-R9-WRAP-2 | Nhãn dài khi có thay đổi chưa áp dụng cũng không tràn | E2E | COMPAT | TC-086 |
| COV-R9-ERR-1 | Nút đang báo LỖI không làm lệch hàng | E2E | RED | TC-087 |
| COV-X1-1 | Mở hồ sơ DI TRÚ thì không ô nào biến mất | E2E | REGRESSION | TC-088 |
| COV-X1-2 | Hồ sơ DI TRÚ không báo lỗi giả ở ngày viết đơn | E2E | REGRESSION | TC-089 |
| COV-X2-1 | Nút đang xem xuất đúng cột đang nhìn | E2E | REGRESSION | TC-090 |
| COV-X2-2 | Nút đang xem KHÔNG cắt cột theo dữ liệu | E2E | RED | TC-091 |
| COV-X3-1 | Tạo đơn thư bình thường vẫn thành công | API | REGRESSION | TC-092 |
| COV-X3-2 | Mọi khoá form gửi lên đều được máy chủ khai nhận | UNIT | REGRESSION | TC-093 |
| COV-X4-1 | Cán bộ (không phải quản trị) lưu được đơn | E2E | PERMISSIONS | TC-094 |
| COV-X4-2 | Cán bộ xuất được tệp mọi trường | E2E | PERMISSIONS | TC-095 |
| COV-X5-1 | Máy chủ báo mã bản dựng khớp commit đã hợp nhất | API | GREEN | TC-096 |
| COV-X6-1 | Cán bộ tổ khác không thấy hồ sơ ngoài phạm vi | API | SECURITY | TC-097 |
| COV-X6-2 | Tệp xuất cũng lọc theo phạm vi dữ liệu | API | SECURITY | TC-098 |
| COV-SEC-1 | Thiếu quyền xuất đầy đủ thì bị từ chối | API | SECURITY | TC-099 |
| COV-SEC-2 | Sửa nhanh hồ sơ ngoài phạm vi bị chặn | API | SECURITY | TC-100 |
| COV-SEC-3 | Vai vô danh không gọi được đường xuất | API | SECURITY | TC-101 |
| COV-SEC-4 | Tệp ngoài danh sách loại cho phép bị từ chối | API | SECURITY | TC-102 |
| COV-SEC-5 | Tên tệp chứa ký tự đường dẫn bị vô hiệu hoá | API | SECURITY | TC-103 |
| COV-ST-1 | Đóng popup rồi mở lại thì lấy giá trị từ máy chủ | E2E | STATE | TC-104 |
| COV-ST-2 | Lưu xong rồi mở dòng KHÁC không mang giá trị dòng trước | E2E | STATE | TC-105 |
| COV-ST-3 | Hai tab cùng mở, tab A sửa nhanh, tab B tải lại thấy đúng | E2E | STATE | TC-106 |
| COV-DEC-1 | Nút xuất | E2E | DECISION | TC-107, TC-108, TC-109, TC-110 |
| COV-DEC-2 | Sửa nhanh | E2E | DECISION | TC-111, TC-112, TC-113, TC-114 |
| COV-PAIR-1 | Kết cặp nguồn đơn x loại thông tin x trạng thái trên tệp xuất | E2E | EP | TC-115 |
| COV-UX-1 | Đang xuất thì nút cho biết hệ đang chạy | E2E | UX | TC-116 |
| COV-UX-2 | Nhãn nút dùng từ nghiệp vụ, không dùng từ kỹ thuật | E2E | UX | TC-117 |
| COV-UX-3 | Popup sửa nhanh có lối thoát rõ ràng | E2E | UX | TC-118 |
| COV-UX-4 | Nút sửa nhanh nhất quán với chỗ sửa khác trong hệ | E2E | UX | TC-119 |
| COV-UX-5 | Vượt trần xuất thì báo trước, không để tải xong mới hỏng | E2E | UX | TC-120 |
| COV-UX-6 | Trạng thái rỗng của bảng phân biệt với tải hỏng | E2E | UX | TC-121 |
| COV-UX-7 | Thông báo lỗi nói được cách khắc phục | E2E | UX | TC-122 |
| COV-UX-8 | Sửa từ bảng ít thao tác hơn mở hồ sơ | E2E | UX | TC-123 |
| COV-UX-9 | Popup có đủ trạng thái tải, rỗng, lỗi, khoá | E2E | UX | TC-124 |
| COV-A11Y-1 | Tiêu điểm không bị che khi cuộn bảng | E2E | A11Y | TC-125 |
| COV-A11Y-2 | Không đòi nhập lại thông tin vừa nhập | E2E | A11Y | TC-126 |
| COV-A11Y-3 | Tương phản chữ trên nút đạt mức AA | E2E | A11Y | TC-127 |
| COV-A11Y-4 | Mọi nút có tên đọc được | E2E | A11Y | TC-128 |
| COV-A11Y-5 | Popup giữ tiêu điểm đúng cách và Esc thoát được | E2E | A11Y | TC-129 |
| COV-A11Y-6 | Thứ tự tiêu điểm theo thứ tự đọc | E2E | A11Y | TC-130 |
| COV-A11Y-7 | Quét tự động không còn lỗi mức A/AA | E2E | A11Y | TC-131 |
| COV-COMPAT-1 | Chạy đúng trên Chrome | E2E | COMPAT | TC-132 |
| COV-COMPAT-2 | Chạy đúng trên Edge Chromium | E2E | COMPAT | TC-133 |
| COV-COMPAT-3 | Bố cục đúng ở màn 1366x768 | E2E | COMPAT | TC-134 |
| COV-OAT-1 | Sau deploy, đường kiểm tra sức khoẻ trả mã bản dựng đúng | API | GREEN | TC-135 |
| COV-OAT-2 | Seed chạy trong deploy và deploy ĐỎ nếu seed hỏng | API | RED | TC-136 |
| COV-PERF-1 | Ngân sách thời gian xuất 5.000 dòng | API | — | GAP — chưa có p95 do anh đặt. Bịa ngưỡng rồi tuyên bố đạt là biến câu hỏi chưa có lời đáp thành lời khẳng định. Đề nghị anh chốt ngân sách rồi bổ sung ca. |
| COV-PERF-2 | Ngân sách thời gian trả gợi ý tên | API | — | GAP — chưa có p95 do anh đặt. Đo nền: ô gợi ý quét cột bóng có chỉ mục trigram, chưa có mốc đối chứng để nói nhanh hay chậm. |
| COV-PERF-3 | Ngân sách mở trang đầu danh sách 47.626 hồ sơ | API | — | GAP — chưa có p95 do anh đặt. Đã biết nhánh ngày chạy Seq Scan 20-230 ms trên bản sao; con số ấy là phép đo, không phải ngưỡng nghiệm thu. |
| COV-PERF-4 | Hai người cùng sửa nhanh một hồ sơ | API | — | GAP — cần hai tài khoản thử đồng thời trên prod; 5 tài khoản cũ đã khoá 20/09 và anh chưa cấp tài khoản mới. |
| COV-A11Y-8 | Trình đọc màn hình thật (NVDA/JAWS) | E2E | — | GAP — không có trên máy. Kiểm được vai trò, tên và bàn phím; không kiểm được lời đọc thật. |
| COV-COMPAT-4 | Safari và iOS | E2E | — | GAP — cán bộ dùng Chrome/Edge Chromium; máy chủ dựng là Windows nên không chạy được WebKit của Apple. |

## Trạng thái

Ma trận `UAT-COVERAGE.md` viết tay trước đó có **46 dòng** — thiếu **91 ca** so với sàn, và con số
46 không tính từ phương pháp nào cả, em tự đặt. Đó là lỗi của em, không phải lỗi của phép đo.

Sổ mệnh đề và ma trận ca sinh bằng `/uat-test-writer` từ `_domain-pack.md`, không viết tay.

**Điều kiện kết thúc:** 100% dòng PASS. Bỏ qua ≠ đạt.

## Khoảng trống CÓ LÝ DO

| Không phủ | Vì sao |
|---|---|
| Trình đọc màn hình thật (NVDA/JAWS) | Không có trên máy; kiểm được vai trò + tên + bàn phím, không kiểm được lời đọc |
| Safari / iOS | Cán bộ dùng Chrome/Edge Chromium; host Windows không dựng được |
| Ghi dữ liệu lên prod bằng CLI | Chưa được anh duyệt; CLI `kiem-cot-xuat-day-du` chỉ đọc |
