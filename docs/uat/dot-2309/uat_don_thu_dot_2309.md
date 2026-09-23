# UAT Test Cases — don-thu-dot-2209-2309

**Generated**: 23/09/2026 11:48  
**Complexity**: `medium`  
**Total TC**: 140  
**Companion Excel**: file `.xlsx` cùng tên trong thư mục này

## 📊 TC_min — ENSEMBLE MAX (v9)

M1 coverage-items=140 · M2 ΣV(G)=120 · M3 FP^1.2=33 · M4 risk-tier=120 → **TC_min=MAX=140** · Tổng TC thật=140 (≥ TC_min)

## 🤖 Hướng dẫn cho Claude Code

File này được thiết kế để Claude Code đọc khi cần **fix bug** từ kết quả UAT.

**Workflow**:
1. Đọc section `## TC-XXX` của TC bị fail để hiểu context
2. Đọc `### 🔧 Fix Context` để biết khu vực code cần kiểm tra
3. Edit code → chạy lại test → đánh dấu `**Status**: Verified` trong Bug Report
4. File `.xlsx` companion được update bởi runner — KHÔNG edit thủ công

**Quy ước parsing**:
- TC ID nằm trong heading `## TC-XXX` (anchor-able)
- Bug report ở format YAML trong code fence
- Checklist `- [ ]` có thể tick bằng cách thay thành `- [x]`
- Test Data ở section riêng — load 1 lần dùng cho nhiều TC

## 🔍 Self-Audit

**Tổng số TC**: 140

**Phân bố loại**:
- `GREEN`: 33
- `RED`: 19
- `UX`: 13
- `SECURITY`: 11
- `A11Y`: 10
- `STATE`: 9
- `REGRESSION`: 9
- `EP`: 8
- `DECISION`: 8
- `BOUNDARY`: 7
- `COMPAT`: 5
- `DATA`: 3
- `EDGE`: 3
- `PERMISSIONS`: 2

**Phân bố priority**:
- 🔴 `P0`: 50
- 🟠 `P1`: 70
- 🟡 `P2`: 20

**Phân bố severity nếu fail**:
-  `S2`: 33
-  `S1`: 29
-  `S3`: 58
-  `S4`: 20

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` |  | Tệp mọi trường chứa ô chỉ có trên form, không có trên bảng |  S2 |
| [TC-002](#tc-002) | 🔴 P0 | `BOUNDARY` |  | Số cột tệp mọi trường đếm được đúng 42 |  S2 |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` |  | Cột rỗng sạch không có trong tệp |  S2 |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` |  | Ba cột định danh stt, sttCu, status đều có mặt |  S2 |
| [TC-015](#tc-015) | 🔴 P0 | `GREEN` |  | Từng ô trong tệp khớp dữ liệu nguồn, đối chiếu theo hồ sơ |  S1 |
| [TC-016](#tc-016) | 🔴 P0 | `BOUNDARY` |  | Tập 42 cột khớp ĐÚNG bộ cột chuẩn, không chỉ đúng số lượng |  S2 |
| [TC-019](#tc-019) | 🔴 P0 | `RED` |  | Cột đã cắt mà có dữ liệu thì phép đo báo ĐỎ |  S2 |
| [TC-023](#tc-023) | 🔴 P0 | `GREEN` |  | Ô RỖNG hiện nút có cả biểu tượng và nhãn chữ |  S2 |
| [TC-024](#tc-024) | 🔴 P0 | `GREEN` |  | Bấm nút ở ô rỗng mở popup nhập |  S2 |
| [TC-025](#tc-025) | 🔴 P0 | `GREEN` |  | Ô ĐÃ CÓ chữ vẫn có nút sửa nhanh |  S2 |
| [TC-026](#tc-026) | 🔴 P0 | `GREEN` |  | Bấm nút ở ô có chữ mở popup mang sẵn giá trị cũ |  S2 |
| [TC-027](#tc-027) | 🔴 P0 | `GREEN` |  | Sửa giá trị cũ rồi lưu thì giá trị mới thay thế |  S1 |
| [TC-028](#tc-028) | 🔴 P0 | `RED` |  | Bấm vào CHỮ mở hồ sơ, KHÔNG mở popup |  S2 |
| [TC-032](#tc-032) | 🔴 P0 | `STATE` |  | Trên BẢNG THẬT, Enter ở nút mở popup mà không chuyển sang hồ sơ |  S2 |
| [TC-035](#tc-035) | 🔴 P0 | `GREEN` |  | Tải tệp lên từ ngay trong danh sách |  S2 |
| [TC-036](#tc-036) | 🔴 P0 | `GREEN` |  | Tải tệp xuống từ ngay trong danh sách |  S2 |
| [TC-041](#tc-041) | 🔴 P0 | `RED` |  | Lưu hỏng thì báo lỗi và KHÔNG mất chữ đã gõ |  S1 |
| [TC-044](#tc-044) | 🔴 P0 | `DATA` |  | Danh mục loại thông tin có mục để chọn |  S2 |
| [TC-046](#tc-046) | 🔴 P0 | `RED` |  | Máy chủ trả THÀNH CÔNG với danh sách rỗng thì nói rõ là danh mục chưa có mục |  S2 |
| [TC-051](#tc-051) | 🔴 P0 | `RED` |  | Đơn mới KHÔNG mang STT của đơn cũ |  S1 |
| [TC-052](#tc-052) | 🔴 P0 | `RED` |  | Đơn mới KHÔNG mang kết quả xử lý của đơn cũ |  S1 |
| [TC-053](#tc-053) | 🔴 P0 | `REGRESSION` |  | Mọi tuyến form đều được gắn khoá dựng lại theo hồ sơ |  S1 |
| [TC-054](#tc-054) | 🔴 P0 | `STATE` |  | Đi hồ sơ A rồi tạo mới rồi sang hồ sơ B không dính trạng thái |  S1 |
| [TC-055](#tc-055) | 🔴 P0 | `GREEN` |  | Lưu thì ra một hồ sơ MỚI |  S2 |
| [TC-056](#tc-056) | 🔴 P0 | `REGRESSION` |  | Đơn cũ không đổi sau khi lưu đơn mới |  S1 |
| [TC-062](#tc-062) | 🔴 P0 | `DATA` |  | Danh mục loại tài liệu có mục sau khi deploy |  S1 |
| [TC-065](#tc-065) | 🔴 P0 | `RED` |  | Hồ sơ cũ có giá trị khác thì GIỮ, không đè Không |  S1 |
| [TC-067](#tc-067) | 🔴 P0 | `REGRESSION` |  | Mở hồ sơ cũ, KHÔNG sửa gì, Lưu: ô đã ẩn đi nguyên vẹn |  S1 |
| [TC-068](#tc-068) | 🔴 P0 | `REGRESSION` |  | Sửa một ô KHÁC rồi Lưu: ô đã ẩn vẫn nguyên |  S1 |
| [TC-069](#tc-069) | 🔴 P0 | `RED` |  | Gieo lỗi: gửi RỖNG đè lên ô đã ẩn thì cổng phải ĐỎ |  S1 |
| [TC-076](#tc-076) | 🔴 P0 | `RED` |  | Gõ tên CHƯA CÓ rồi bấm Lưu NGAY thì tên được ghi |  S1 |
| [TC-078](#tc-078) | 🔴 P0 | `SECURITY` |  | Gợi ý chỉ lấy hồ sơ trong phạm vi người đăng nhập |  S1 |
| [TC-079](#tc-079) | 🔴 P0 | `SECURITY` |  | Cán bộ tổ khác không thấy tên ngoài phạm vi |  S1 |
| [TC-091](#tc-091) | 🔴 P0 | `REGRESSION` |  | Mở hồ sơ DI TRÚ thì không ô nào biến mất |  S1 |
| [TC-092](#tc-092) | 🔴 P0 | `REGRESSION` |  | Hồ sơ DI TRÚ không báo lỗi giả ở ngày viết đơn |  S2 |
| [TC-095](#tc-095) | 🔴 P0 | `REGRESSION` |  | Tạo đơn thư bình thường vẫn thành công |  S1 |
| [TC-096](#tc-096) | 🔴 P0 | `REGRESSION` |  | Mọi khoá form gửi lên đều được máy chủ khai nhận |  S1 |
| [TC-097](#tc-097) | 🔴 P0 | `PERMISSIONS` |  | Cán bộ (không phải quản trị) lưu được đơn |  S1 |
| [TC-099](#tc-099) | 🔴 P0 | `GREEN` |  | Máy chủ báo mã bản dựng khớp commit đã hợp nhất |  S2 |
| [TC-100](#tc-100) | 🔴 P0 | `SECURITY` |  | Cán bộ tổ khác không thấy hồ sơ ngoài phạm vi |  S1 |
| [TC-101](#tc-101) | 🔴 P0 | `SECURITY` |  | Tệp xuất cũng lọc theo phạm vi dữ liệu |  S1 |
| [TC-102](#tc-102) | 🔴 P0 | `SECURITY` |  | Tệp của nút ĐANG XEM cũng lọc theo phạm vi dữ liệu |  S1 |
| [TC-103](#tc-103) | 🔴 P0 | `SECURITY` |  | Thiếu quyền xuất đầy đủ thì bị từ chối |  S1 |
| [TC-104](#tc-104) | 🔴 P0 | `SECURITY` |  | Sửa nhanh hồ sơ ngoài phạm vi bị chặn |  S1 |
| [TC-105](#tc-105) | 🔴 P0 | `SECURITY` |  | Vai vô danh không gọi được đường xuất |  S1 |
| [TC-109](#tc-109) | 🔴 P0 | `STATE` |  | Lưu xong rồi mở dòng KHÁC không mang giá trị dòng trước |  S1 |
| [TC-125](#tc-125) | 🔴 P0 | `UX` |  | Trạng thái rỗng của bảng phân biệt với tải hỏng |  S2 |
| [TC-136](#tc-136) | 🔴 P0 | `COMPAT` |  | Chạy đúng trên Chrome |  S2 |
| [TC-139](#tc-139) | 🔴 P0 | `GREEN` |  | Sau deploy, đường kiểm tra sức khoẻ trả mã bản dựng đúng |  S1 |
| [TC-140](#tc-140) | 🔴 P0 | `RED` |  | Seed chạy trong deploy và deploy ĐỎ nếu seed hỏng |  S1 |
| [TC-003](#tc-003) | 🟠 P1 | `EDGE` |  | Ô nằm trong nhóm GẬP trên form vẫn được xuất |  S3 |
| [TC-004](#tc-004) | 🟠 P1 | `RED` |  | Cột thuộc nhóm gập mà CÓ dữ liệu thì thật sự xuất hiện trong tệp |  S3 |
| [TC-006](#tc-006) | 🟠 P1 | `EP` |  | 88 khoá metadata rỗng sạch đã bị cắt |  S3 |
| [TC-007](#tc-007) | 🟠 P1 | `EP` |  | 3 cột riêng rỗng sạch đã bị cắt |  S3 |
| [TC-008](#tc-008) | 🟠 P1 | `EP` |  | Rỗng kiểu NULL được tính là rỗng |  S3 |
| [TC-009](#tc-009) | 🟠 P1 | `EP` |  | Rỗng kiểu chuỗi trắng được tính là rỗng |  S3 |
| [TC-010](#tc-010) | 🟠 P1 | `EP` |  | Rỗng kiểu mảng rỗng được tính là rỗng |  S3 |
| [TC-011](#tc-011) | 🟠 P1 | `EP` |  | Rỗng kiểu JSON null được tính là rỗng |  S3 |
| [TC-012](#tc-012) | 🟠 P1 | `GREEN` |  | Hai lần xuất liên tiếp cho cùng bộ cột |  S3 |
| [TC-013](#tc-013) | 🟠 P1 | `RED` |  | Bộ cột KHÔNG đo lại lúc xuất |  S3 |
| [TC-017](#tc-017) | 🟠 P1 | `GREEN` |  | Khoá lưu đọc đúng cho cột riêng |  S2 |
| [TC-018](#tc-018) | 🟠 P1 | `GREEN` |  | Khoá lưu đọc đúng cho khoá metadata |  S2 |
| [TC-021](#tc-021) | 🟠 P1 | `BOUNDARY` |  | Xuất đúng trần 5.000 dòng |  S3 |
| [TC-022](#tc-022) | 🟠 P1 | `BOUNDARY` |  | Quá trần thì cắt còn 5.000 và nói rõ đã cắt |  S3 |
| [TC-030](#tc-030) | 🟠 P1 | `STATE` |  | Thành phần nút chặn lan sự kiện chuột trong khung dựng thử |  S2 |
| [TC-031](#tc-031) | 🟠 P1 | `STATE` |  | Thành phần nút chặn lan sự kiện bàn phím trong khung dựng thử |  S2 |
| [TC-034](#tc-034) | 🟠 P1 | `A11Y` |  | Vùng chạm của nút đạt tối thiểu WCAG 2.2 |  S3 |
| [TC-037](#tc-037) | 🟠 P1 | `RED` |  | Tên tệp tải về theo máy chủ, không bị ép tên |  S3 |
| [TC-038](#tc-038) | 🟠 P1 | `A11Y` |  | Nhãn đọc được nói rõ sửa ô nào của hồ sơ nào |  S3 |
| [TC-039](#tc-039) | 🟠 P1 | `A11Y` |  | Tới được nút bằng phím Tab |  S3 |
| [TC-040](#tc-040) | 🟠 P1 | `GREEN` |  | Lưu xong bảng cập nhật ngay, không cần tải lại |  S3 |
| [TC-042](#tc-042) | 🟠 P1 | `GREEN` |  | Cột Loại thông tin đứng ngay trước Nguồn đơn/Đơn vị giao |  S3 |
| [TC-045](#tc-045) | 🟠 P1 | `RED` |  | Máy chủ trả LỖI thì ô báo tải hỏng |  S3 |
| [TC-047](#tc-047) | 🟠 P1 | `GREEN` |  | Cột Loại thông tin có trong tệp xuất |  S3 |
| [TC-048](#tc-048) | 🟠 P1 | `GREEN` |  | Nút hiện khi đang SỬA hồ sơ |  S3 |
| [TC-050](#tc-050) | 🟠 P1 | `GREEN` |  | Đơn mới mang theo nội dung đơn cũ |  S3 |
| [TC-057](#tc-057) | 🟠 P1 | `GREEN` |  | Khu tải tệp nằm cạnh ô Kết quả xử lý |  S3 |
| [TC-058](#tc-058) | 🟠 P1 | `GREEN` |  | Tệp tải ở khu này mang đúng loại của khu |  S2 |
| [TC-059](#tc-059) | 🟠 P1 | `RED` |  | Loại KHÔNG rơi về Văn bản |  S2 |
| [TC-063](#tc-063) | 🟠 P1 | `DATA` |  | Seed lần đầu TẠO ĐỦ mục, lần hai giữ nguyên định danh và nội dung |  S3 |
| [TC-064](#tc-064) | 🟠 P1 | `GREEN` |  | Màn tạo mới: ô báo cáo Ban Giám đốc đã là Không |  S3 |
| [TC-070](#tc-070) | 🟠 P1 | `GREEN` |  | Gõ 2 ký tự trở lên thì hiện tên đã có trong dữ liệu |  S3 |
| [TC-071](#tc-071) | 🟠 P1 | `EP` |  | Khớp GIỮA chuỗi, không chỉ khớp đầu chuỗi |  S3 |
| [TC-072](#tc-072) | 🟠 P1 | `SECURITY` |  | Ký tự đặc biệt của mẫu tìm được thoát đúng |  S3 |
| [TC-077](#tc-077) | 🟠 P1 | `STATE` |  | Gõ rồi rời ô rồi quay lại, chữ còn nguyên |  S2 |
| [TC-080](#tc-080) | 🟠 P1 | `UX` |  | Hai nút có nhãn phân biệt được |  S3 |
| [TC-081](#tc-081) | 🟠 P1 | `UX` |  | Nhãn nói rõ nút nào xuất đúng cột đang xem |  S3 |
| [TC-082](#tc-082) | 🟠 P1 | `GREEN` |  | Tiêu đề trong tệp nút đang xem là DANH SÁCH ĐƠN THƯ |  S3 |
| [TC-083](#tc-083) | 🟠 P1 | `GREEN` |  | Tiêu đề trong tệp nút mọi trường là DANH SÁCH ĐƠN THƯ |  S3 |
| [TC-084](#tc-084) | 🟠 P1 | `RED` |  | Không còn hậu tố ĐẦY ĐỦ TRƯỜNG |  S3 |
| [TC-086](#tc-086) | 🟠 P1 | `UX` |  | Bốn nút và dòng đếm nằm cùng một đường căn |  S3 |
| [TC-088](#tc-088) | 🟠 P1 | `COMPAT` |  | Màn hẹp thì hàng nút xuống dòng, không tràn |  S3 |
| [TC-090](#tc-090) | 🟠 P1 | `RED` |  | Nút đang báo LỖI không làm lệch hàng |  S3 |
| [TC-093](#tc-093) | 🟠 P1 | `REGRESSION` |  | Nút đang xem xuất đúng cột đang nhìn |  S3 |
| [TC-094](#tc-094) | 🟠 P1 | `RED` |  | Nút đang xem KHÔNG cắt cột theo dữ liệu |  S3 |
| [TC-098](#tc-098) | 🟠 P1 | `PERMISSIONS` |  | Cán bộ xuất được tệp mọi trường |  S2 |
| [TC-106](#tc-106) | 🟠 P1 | `SECURITY` |  | Tệp ngoài danh sách loại cho phép bị từ chối |  S2 |
| [TC-107](#tc-107) | 🟠 P1 | `SECURITY` |  | Tên tệp chứa ký tự đường dẫn bị vô hiệu hoá |  S2 |
| [TC-108](#tc-108) | 🟠 P1 | `STATE` |  | Đóng popup rồi mở lại thì lấy giá trị từ máy chủ |  S2 |
| [TC-110](#tc-110) | 🟠 P1 | `STATE` |  | Hai tab cùng mở, tab A sửa nhanh, tab B tải lại thấy đúng |  S2 |
| [TC-111](#tc-111) | 🟠 P1 | `DECISION` |  | Nút xuất: có bộ lọc, có quyền xuất đầy đủ |  S3 |
| [TC-112](#tc-112) | 🟠 P1 | `DECISION` |  | Nút xuất: có bộ lọc, không quyền xuất đầy đủ |  S3 |
| [TC-113](#tc-113) | 🟠 P1 | `DECISION` |  | Nút xuất: không bộ lọc, có quyền xuất đầy đủ |  S3 |
| [TC-114](#tc-114) | 🟠 P1 | `DECISION` |  | Nút xuất: không bộ lọc, không quyền xuất đầy đủ |  S3 |
| [TC-115](#tc-115) | 🟠 P1 | `DECISION` |  | Sửa nhanh: ô rỗng, có quyền sửa |  S3 |
| [TC-116](#tc-116) | 🟠 P1 | `DECISION` |  | Sửa nhanh: ô có chữ, có quyền sửa |  S3 |
| [TC-117](#tc-117) | 🟠 P1 | `DECISION` |  | Sửa nhanh: ô rỗng, không quyền sửa |  S3 |
| [TC-118](#tc-118) | 🟠 P1 | `DECISION` |  | Sửa nhanh: ô có chữ, không quyền sửa |  S3 |
| [TC-120](#tc-120) | 🟠 P1 | `UX` |  | Đang xuất thì nút cho biết hệ đang chạy |  S3 |
| [TC-122](#tc-122) | 🟠 P1 | `UX` |  | Popup sửa nhanh có lối thoát rõ ràng |  S3 |
| [TC-124](#tc-124) | 🟠 P1 | `UX` |  | Vượt trần xuất thì báo trước, không để tải xong mới hỏng |  S3 |
| [TC-126](#tc-126) | 🟠 P1 | `UX` |  | Thông báo lỗi nói được cách khắc phục |  S3 |
| [TC-127](#tc-127) | 🟠 P1 | `UX` |  | Sửa từ bảng ít thao tác hơn mở hồ sơ |  S3 |
| [TC-129](#tc-129) | 🟠 P1 | `A11Y` |  | Tiêu điểm không bị che khi cuộn bảng |  S3 |
| [TC-131](#tc-131) | 🟠 P1 | `A11Y` |  | Tương phản chữ trên nút đạt mức AA |  S3 |
| [TC-132](#tc-132) | 🟠 P1 | `A11Y` |  | Mọi nút có tên đọc được |  S3 |
| [TC-133](#tc-133) | 🟠 P1 | `A11Y` |  | Popup giữ tiêu điểm đúng cách và Esc thoát được |  S3 |
| [TC-135](#tc-135) | 🟠 P1 | `A11Y` |  | Quét tự động không còn lỗi mức A/AA |  S3 |
| [TC-137](#tc-137) | 🟠 P1 | `COMPAT` |  | Chạy đúng trên Edge Chromium |  S3 |
| [TC-138](#tc-138) | 🟠 P1 | `COMPAT` |  | Bố cục đúng ở màn 1366x768 |  S3 |
| [TC-020](#tc-020) | 🟡 P2 | `EDGE` |  | Phép đo trong deploy chỉ cảnh báo, không chặn deploy |  S4 |
| [TC-029](#tc-029) | 🟡 P2 | `EDGE` |  | Ô rỗng thì nút chính là nội dung ô |  S4 |
| [TC-033](#tc-033) | 🟡 P2 | `GREEN` |  | Biểu tượng là bút, cùng biểu tượng sửa của hệ |  S4 |
| [TC-043](#tc-043) | 🟡 P2 | `STATE` |  | Thứ tự cột giữ nguyên sau khi tải lại trang |  S4 |
| [TC-049](#tc-049) | 🟡 P2 | `RED` |  | Nút KHÔNG hiện khi đang tạo mới |  S4 |
| [TC-060](#tc-060) | 🟡 P2 | `UX` |  | Hai khu tải tệp phân biệt được trên màn hình |  S4 |
| [TC-061](#tc-061) | 🟡 P2 | `GREEN` |  | Hai khu có định danh kiểm thử riêng |  S4 |
| [TC-066](#tc-066) | 🟡 P2 | `GREEN` |  | Ô Đồ vật, tài liệu kèm theo không còn trên form |  S4 |
| [TC-073](#tc-073) | 🟡 P2 | `BOUNDARY` |  | Một ký tự thì CHƯA gợi ý |  S4 |
| [TC-074](#tc-074) | 🟡 P2 | `BOUNDARY` |  | Hai ký tự thì CÓ gợi ý |  S4 |
| [TC-075](#tc-075) | 🟡 P2 | `BOUNDARY` |  | Nhiều kết quả thì cắt còn tối đa 10 |  S4 |
| [TC-085](#tc-085) | 🟡 P2 | `GREEN` |  | Một hằng số tiêu đề dùng cho cả hai đường xuất |  S4 |
| [TC-087](#tc-087) | 🟡 P2 | `GREEN` |  | Nhóm hành động phụ không dựng khối bọc dọc |  S4 |
| [TC-089](#tc-089) | 🟡 P2 | `COMPAT` |  | Nhãn dài khi có thay đổi chưa áp dụng cũng không tràn |  S4 |
| [TC-119](#tc-119) | 🟡 P2 | `EP` |  | Kết cặp nguồn đơn x loại thông tin x trạng thái trên tệp xuất |  S4 |
| [TC-121](#tc-121) | 🟡 P2 | `UX` |  | Nhãn nút dùng từ nghiệp vụ, không dùng từ kỹ thuật |  S4 |
| [TC-123](#tc-123) | 🟡 P2 | `UX` |  | Nút sửa nhanh nhất quán với chỗ sửa khác trong hệ |  S4 |
| [TC-128](#tc-128) | 🟡 P2 | `UX` |  | Popup có đủ trạng thái tải, rỗng, lỗi, khoá |  S4 |
| [TC-130](#tc-130) | 🟡 P2 | `A11Y` |  | Không đòi nhập lại thông tin vừa nhập |  S4 |
| [TC-134](#tc-134) | 🟡 P2 | `A11Y` |  | Thứ tự tiêu điểm theo thứ tự đọc |  S4 |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-ALL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-ALL
- Catches_bug: nút xuất 'mọi trường' thực ra chỉ xuất đúng cột đang nhìn

**Runner contract**:
- Coverage_ids: `COV-R1-ALL-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tệp mọi trường chứa ô chỉ có trên form, không có trên bảng

### Các bước kiểm thử
- [ ] Mở Danh sách đơn thư; bấm Xuất Excel (mọi trường); mở tệp tải về

### Kết quả mong đợi
- Tệp có cột ứng với ô chỉ tồn tại trên màn tạo/sửa, không chỉ các cột đang hiện trên bảng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-002

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-COUNT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-COUNT
- Catches_bug: cắt nhầm hoặc sót cột khi chuẩn hoá bộ cột

**Runner contract**:
- Coverage_ids: `COV-R1-ALL-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Số cột tệp mọi trường đếm được đúng 42

### Các bước kiểm thử
- [ ] Xuất tệp mọi trường; đếm số cột ở hàng tiêu đề bằng máy

### Kết quả mong đợi
- Đúng 42 cột, không 41 không 43

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: yêu cầu 13 của anh không được thực hiện, tệp vẫn đầy cột trống

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cột rỗng sạch không có trong tệp

### Các bước kiểm thử
- [ ] Xuất tệp mọi trường; tìm cột lanhDaoToTung, ngayXayRa, noiXayRaPhuongXa

### Kết quả mong đợi
- Ba cột ấy KHÔNG có trong tệp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-014

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-COUNT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-COUNT
- Catches_bug: cắt nhầm cột định danh khiến tệp không tra ngược được về hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R1-COUNT-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ba cột định danh stt, sttCu, status đều có mặt

### Các bước kiểm thử
- [ ] Xuất tệp mọi trường; tìm ba cột định danh

### Kết quả mong đợi
- Cả ba cột có mặt (đo prod: stt 47.626, sttCu 31.473, status 47.626)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-VALUE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-VALUE
- Catches_bug: 'mỗi cột có ít nhất một ô khác rỗng' vẫn xanh khi giá trị lệch hàng hoặc lệch cột; lỗi #475 là 44 trường ra ô trống, nhưng lớp lỗi anh em của nó là ra GIÁ TRỊ CỦA HỒ SƠ KHÁC

**Runner contract**:
- Coverage_ids: `COV-R1-VALUE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Từng ô trong tệp khớp dữ liệu nguồn, đối chiếu theo hồ sơ

### Các bước kiểm thử
- [ ] Chọn 50 hồ sơ có dữ liệu phong phú; đọc giá trị gốc của chúng bằng đường độc lập (truy vấn thẳng CSDL, không qua đường xuất); xuất tệp; so TỪNG ô với giá trị gốc. Tập 50 phải gồm cả hồ sơ có và không có ketQuaXuLyKhac (prod: 24% có)

### Kết quả mong đợi
- Mọi ô khớp giá trị gốc, kể cả ô rỗng phải rỗng đúng chỗ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-016

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-VALUE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-VALUE
- Catches_bug: đếm được 42 nhưng cắt nhầm một cột rồi thêm nhầm một cột khác thì phép đếm vẫn xanh

**Runner contract**:
- Coverage_ids: `COV-R1-VALUE-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tập 42 cột khớp ĐÚNG bộ cột chuẩn, không chỉ đúng số lượng

### Các bước kiểm thử
- [ ] Xuất tệp; lấy danh sách tên cột theo thứ tự; so bằng phép so TẬP với bộ 42 cột chuẩn đã chốt trong bảng khai

### Kết quả mong đợi
- Hai tập trùng khít: 0 cột thừa, 0 cột thiếu, đúng thứ tự

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-019

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-GUARD`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-GUARD
- Catches_bug: bộ cột cố định âm thầm thiếu khi nghiệp vụ bắt đầu dùng cột đã cắt

**Runner contract**:
- Coverage_ids: `COV-R1-GUARD-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cột đã cắt mà có dữ liệu thì phép đo báo ĐỎ

### Các bước kiểm thử
- [ ] Trên bản sao, ghi một giá trị vào ngayXayRa; chạy CLI kiểm bộ cột

### Kết quả mong đợi
- CLI thoát khác 0 và nêu đúng tên cột ngayXayRa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-023

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-EMPTY
- Catches_bug: ô rỗng không có gì để bấm nên cán bộ không biết sửa được tại chỗ

**Runner contract**:
- Coverage_ids: `COV-R2-EMPTY-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ô RỖNG hiện nút có cả biểu tượng và nhãn chữ

### Các bước kiểm thử
- [ ] Mở Danh sách đơn thư; tìm dòng có Kết quả xử lý khác đang rỗng

### Kết quả mong đợi
- Ô ấy hiện một nút mang biểu tượng bút và nhãn chữ mời nhập

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-024

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-EMPTY
- Catches_bug: yêu cầu 2 của anh không dùng được

**Runner contract**:
- Coverage_ids: `COV-R2-EMPTY-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bấm nút ở ô rỗng mở popup nhập

### Các bước kiểm thử
- [ ] Bấm nút sửa nhanh ở một ô rỗng

### Kết quả mong đợi
- Popup nhập Kết quả xử lý mở ra, ô nhập trống

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-025

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: đây đúng câu anh hỏi: sửa nhanh chỉ chạy ở ô rỗng thì tính năng dùng được 24% số hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R2-FILLED-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ô ĐÃ CÓ chữ vẫn có nút sửa nhanh

### Các bước kiểm thử
- [ ] Tìm dòng có Kết quả xử lý khác đã có nội dung

### Kết quả mong đợi
- Ô ấy vẫn hiện nút sửa nhanh bên cạnh chữ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-026

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: popup mở ra trống khiến cán bộ gõ lại từ đầu, hoặc lưu đè mất nội dung cũ

**Runner contract**:
- Coverage_ids: `COV-R2-FILLED-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bấm nút ở ô có chữ mở popup mang sẵn giá trị cũ

### Các bước kiểm thử
- [ ] Bấm nút sửa nhanh ở ô đã có nội dung

### Kết quả mong đợi
- Popup mở ra, ô nhập đã mang đúng nội dung đang hiển thị trên bảng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-027

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: lưu chỉ đổi trên màn hình mà không ghi xuống máy chủ

**Runner contract**:
- Coverage_ids: `COV-R2-FILLED-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa giá trị cũ rồi lưu thì giá trị mới thay thế

### Các bước kiểm thử
- [ ] Mở popup ở ô có chữ; đổi nội dung; bấm Lưu; đọc lại ô trên bảng và tải lại trang

### Kết quả mong đợi
- Ô mang nội dung mới cả trước và sau khi tải lại trang

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-028

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-TEXT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-TEXT
- Catches_bug: biến cả ô thành nút phá quy ước bấm dòng mở hồ sơ của mọi bảng (DESIGN.md §11.2)

**Runner contract**:
- Coverage_ids: `COV-R2-TEXT-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bấm vào CHỮ mở hồ sơ, KHÔNG mở popup

### Các bước kiểm thử
- [ ] Ở ô đã có chữ, bấm thẳng vào phần chữ (không bấm nút)

### Kết quả mong đợi
- Trang chuyển sang hồ sơ đơn thư, popup KHÔNG mở

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-032

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-STOP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-STOP
- Catches_bug: hai ca đơn vị trên chỉ đếm bộ nghe giả trong khung dựng thử; chúng không chứng minh gì về bảng thật, nơi còn có bộ định tuyến và bộ nghe của dòng do thư viện bảng gắn

**Runner contract**:
- Coverage_ids: `COV-R2-STOP-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Trên BẢNG THẬT, Enter ở nút mở popup mà không chuyển sang hồ sơ

### Các bước kiểm thử
- [ ] Trên Chrome thật: Tab tới nút sửa nhanh của một ô RỖNG, gõ Enter, đọc địa chỉ trang; lặp lại với một ô ĐÃ CÓ chữ

### Kết quả mong đợi
- Cả hai lần: popup mở và địa chỉ trang KHÔNG đổi sang trang hồ sơ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-035

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILE
- Catches_bug: yêu cầu 2 của anh chỉ làm được nửa: nhập chữ nhưng không đính tệp

**Runner contract**:
- Coverage_ids: `COV-R2-FILE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tải tệp lên từ ngay trong danh sách

### Các bước kiểm thử
- [ ] Mở popup sửa nhanh; chọn một tệp; bấm Lưu; tải lại trang

### Kết quả mong đợi
- Tệp gắn vào đúng hồ sơ ấy và thấy được sau khi tải lại

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-036

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILE
- Catches_bug: phải mở hồ sơ mới tải được tệp, tức yêu cầu 2 chưa xong

**Runner contract**:
- Coverage_ids: `COV-R2-FILE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tải tệp xuống từ ngay trong danh sách

### Các bước kiểm thử
- [ ] Ở hồ sơ đã có tệp, bấm tải xuống từ danh sách

### Kết quả mong đợi
- Tệp tải về đúng nội dung đã tải lên

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-041

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: dữ liệu cán bộ vừa gõ là thứ đắt nhất, mất là mất hẳn

**Runner contract**:
- Coverage_ids: `COV-R2-SAVE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Lưu hỏng thì báo lỗi và KHÔNG mất chữ đã gõ

### Các bước kiểm thử
- [ ] Ngắt mạng; gõ nội dung vào popup; bấm Lưu

### Kết quả mong đợi
- Popup báo lỗi rõ và giữ nguyên chữ đã gõ để thử lại

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-044

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-DATA`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-DATA
- Catches_bug: hỏng im lặng: cột lên máy thật rồi chết bằng danh sách rỗng

**Runner contract**:
- Coverage_ids: `COV-R3-DATA-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Danh mục loại thông tin có mục để chọn

### Các bước kiểm thử
- [ ] Mở form tạo đơn; mở ô Loại thông tin

### Kết quả mong đợi
- Danh sách có mục để chọn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-046

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-DATA`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-DATA
- Catches_bug: đây mới ĐÚNG dạng hỏng im lặng đã gặp ở #470: máy chủ trả 200 kèm mảng rỗng, không có lỗi nào để bắt; ca giả lập LỖI không chạm tới tình huống này

**Runner contract**:
- Coverage_ids: `COV-R3-DATA-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Máy chủ trả THÀNH CÔNG với danh sách rỗng thì nói rõ là danh mục chưa có mục

### Các bước kiểm thử
- [ ] Giả lập máy chủ trả 200 kèm danh sách rỗng; mở ô Loại thông tin

### Kết quả mong đợi
- Ô nói rõ danh mục chưa có mục và chỉ đường thêm mục, KHÔNG im lặng và KHÔNG báo tải hỏng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-051

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-FRESH`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-FRESH
- Catches_bug: hai hồ sơ cùng STT thì tra cứu ra sai hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R4-FRESH-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đơn mới KHÔNG mang STT của đơn cũ

### Các bước kiểm thử
- [ ] Ghi lại STT đơn cũ; bấm tạo đơn mới từ đơn này; đọc ô STT

### Kết quả mong đợi
- Ô STT rỗng hoặc mang số mới, KHÁC STT đơn cũ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-052

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-FRESH`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-FRESH
- Catches_bug: đơn mới chưa xử lý mà đã mang sẵn kết quả là ghi khống vào hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R4-FRESH-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đơn mới KHÔNG mang kết quả xử lý của đơn cũ

### Các bước kiểm thử
- [ ] Mở đơn cũ ĐÃ CÓ kết quả xử lý; bấm tạo đơn mới; đọc ô kết quả xử lý

### Kết quả mong đợi
- Ô kết quả xử lý rỗng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-053

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-FRESH`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-FRESH
- Catches_bug: 5 tuyến bị sót khiến React giữ nguyên trạng thái khi đi từ hồ sơ sang trang tạo mới

**Runner contract**:
- Coverage_ids: `COV-R4-FRESH-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Mọi tuyến form đều được gắn khoá dựng lại theo hồ sơ

### Các bước kiểm thử
- [ ] Đọc khai báo tuyến; liệt kê tuyến trỏ tới trang biểu mẫu; kiểm từng tuyến có khoá dựng lại

### Kết quả mong đợi
- Không tuyến biểu mẫu nào đứng ngoài khoá dựng lại

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-054

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-FRESH`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-FRESH
- Catches_bug: đường vòng là chỗ lỗi trạng thái sống sót, ca đi thẳng không bắt được

**Runner contract**:
- Coverage_ids: `COV-R4-FRESH-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đi hồ sơ A rồi tạo mới rồi sang hồ sơ B không dính trạng thái

### Các bước kiểm thử
- [ ] Mở hồ sơ A; tạo đơn mới; quay lại mở hồ sơ B; đọc các ô

### Kết quả mong đợi
- Form mang đúng dữ liệu hồ sơ B, không lẫn của A hay của đơn mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-055

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-SAVE
- Catches_bug: ghi đè lên đơn nguồn là mất một hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R4-SAVE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Lưu thì ra một hồ sơ MỚI

### Các bước kiểm thử
- [ ] Từ form chép, bấm Lưu; đọc định danh hồ sơ vừa tạo

### Kết quả mong đợi
- Một hồ sơ mới được tạo, định danh khác đơn nguồn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-056

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-SAVE
- Catches_bug: chép bằng cách sửa rồi lưu lại chính hồ sơ cũ

**Runner contract**:
- Coverage_ids: `COV-R4-SAVE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đơn cũ không đổi sau khi lưu đơn mới

### Các bước kiểm thử
- [ ] Đọc đơn nguồn trước và sau khi lưu đơn chép; so từng trường

### Kết quả mong đợi
- Đơn nguồn không đổi trường nào

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-062

**Meta**:
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-SEED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-SEED
- Catches_bug: khu tải tệp mở ra RỖNG trên máy thật dù ca kiểm xanh hết

**Runner contract**:
- Coverage_ids: `COV-R5-SEED-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Danh mục loại tài liệu có mục sau khi deploy

### Các bước kiểm thử
- [ ] Sau deploy, đọc danh mục loại tài liệu qua API

### Kết quả mong đợi
- Danh mục có mục

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-065

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-DEFAULT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-DEFAULT
- Catches_bug: giá trị mặc định đè lên dữ liệu đã lưu là sửa sai hồ sơ nghiệp vụ

**Runner contract**:
- Coverage_ids: `COV-R6-DEFAULT-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hồ sơ cũ có giá trị khác thì GIỮ, không đè Không

### Các bước kiểm thử
- [ ] Mở hồ sơ cũ có giá trị Có ở ô ấy; đọc ô

### Kết quả mong đợi
- Ô vẫn là Có

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-067

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-KEEP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-KEEP
- Catches_bug: bỏ ô khỏi màn hình mà thân lời gọi gửi rỗng đè lên là xoá dữ liệu 27.572 hồ sơ, không ai thấy

**Runner contract**:
- Coverage_ids: `COV-R6-KEEP-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Mở hồ sơ cũ, KHÔNG sửa gì, Lưu: ô đã ẩn đi nguyên vẹn

### Các bước kiểm thử
- [ ] Mở hồ sơ cũ có dữ liệu ở các ô đã ẩn; bấm Lưu ngay; đọc lại hồ sơ từ máy chủ

### Kết quả mong đợi
- Mọi ô đã ẩn giữ nguyên giá trị cũ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-068

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-KEEP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-KEEP
- Catches_bug: đây đúng thao tác hàng ngày của cán bộ, và là đường gây mất dữ liệu thật

**Runner contract**:
- Coverage_ids: `COV-R6-KEEP-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa một ô KHÁC rồi Lưu: ô đã ẩn vẫn nguyên

### Các bước kiểm thử
- [ ] Mở hồ sơ cũ; đổi một ô không liên quan; Lưu; đọc lại hồ sơ từ máy chủ

### Kết quả mong đợi
- Mọi ô đã ẩn giữ nguyên giá trị cũ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-069

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-KEEP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-KEEP
- Catches_bug: bỏ khoá khỏi thân lời gọi KHÔNG làm mất dữ liệu (máy chủ trộn theo khoá có mặt); gửi rỗng mới làm mất. Gieo đúng cái lỗi vô hại rồi kết luận cổng canh được là cổng rỗng

**Runner contract**:
- Coverage_ids: `COV-R6-KEEP-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Gieo lỗi: gửi RỖNG đè lên ô đã ẩn thì cổng phải ĐỎ

### Các bước kiểm thử
- [ ] Sửa hàm dựng thân lời gọi để một ô đã ẩn gửi lên chuỗi rỗng (rồi lặp lại với null) trong khi hồ sơ nguồn ĐANG CÓ dữ liệu ở ô ấy; chạy cổng giữ dữ liệu

### Kết quả mong đợi
- Cổng thất bại ở CẢ HAI lần gieo và nêu đúng tên ô bị ghi đè

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-076

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-TYPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-TYPE
- Catches_bug: ô gợi ý chỉ chốt giá trị lúc rời ô thì bấm Lưu ngay là mất chữ người ta vừa gõ

**Runner contract**:
- Coverage_ids: `COV-R7-TYPE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Gõ tên CHƯA CÓ rồi bấm Lưu NGAY thì tên được ghi

### Các bước kiểm thử
- [ ] Gõ một tên chưa từng có; không rời ô; bấm Lưu; đọc lại hồ sơ từ máy chủ

### Kết quả mong đợi
- Tên vừa gõ được ghi đúng nguyên văn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-078

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-SCOPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-SCOPE
- Catches_bug: ô gợi ý là đường rò dữ liệu dễ bỏ sót vì nó chỉ trả chuỗi, không trả hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R7-SCOPE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Gợi ý chỉ lấy hồ sơ trong phạm vi người đăng nhập

### Các bước kiểm thử
- [ ] Đăng nhập cán bộ tổ A; gọi đường gợi ý bằng đoạn chỉ khớp hồ sơ tổ B

### Kết quả mong đợi
- Không trả tên nào của hồ sơ tổ B

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-079

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-SCOPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-SCOPE
- Catches_bug: phạm vi dữ liệu phải đúng ở MỌI đường ra, không chỉ ở danh sách

**Runner contract**:
- Coverage_ids: `COV-R7-SCOPE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cán bộ tổ khác không thấy tên ngoài phạm vi

### Các bước kiểm thử
- [ ] Đăng nhập cán bộ tổ khác; gọi đường gợi ý với đoạn khớp hồ sơ ngoài phạm vi

### Kết quả mong đợi
- Kết quả rỗng hoặc chỉ gồm hồ sơ trong phạm vi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-091

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X1`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X1
- Catches_bug: đổi form là chỗ hồ sơ cũ mất ô, và chỉ lộ khi mở bản ghi di trú thật

**Runner contract**:
- Coverage_ids: `COV-X1-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Mở hồ sơ DI TRÚ thì không ô nào biến mất

### Các bước kiểm thử
- [ ] Mở một hồ sơ di trú từ hệ cũ; đối chiếu các ô với dữ liệu thô đã lưu

### Kết quả mong đợi
- Mọi ô có dữ liệu đều hiển thị

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-092

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X1`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X1
- Catches_bug: 4.454 hồ sơ mang chữ tự do ở ô ngày; bộ đọc hẹp sẽ chặn lưu

**Runner contract**:
- Coverage_ids: `COV-X1-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hồ sơ DI TRÚ không báo lỗi giả ở ngày viết đơn

### Các bước kiểm thử
- [ ] Mở hồ sơ di trú có ngày viết đơn là chữ tự do; đọc ô và thông báo lỗi

### Kết quả mong đợi
- Ô hiện nguyên văn chữ cũ và KHÔNG báo lỗi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-095

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X3`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X3
- Catches_bug: khoá form mới chưa khai ở DTO đá cả lời gọi bằng 400, kể cả hồ sơ không đụng khoá ấy

**Runner contract**:
- Coverage_ids: `COV-X3-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tạo đơn thư bình thường vẫn thành công

### Các bước kiểm thử
- [ ] Gửi lời gọi tạo đơn thư với bộ trường tối thiểu hợp lệ

### Kết quả mong đợi
- Trả về 201 và hồ sơ được tạo

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-096

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X3`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X3
- Catches_bug: lớp lỗi này đã xảy ra BA LẦN, lần nào cũng CI xanh hoàn toàn

**Runner contract**:
- Coverage_ids: `COV-X3-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Mọi khoá form gửi lên đều được máy chủ khai nhận

### Các bước kiểm thử
- [ ] Đọc hàm dựng thân lời gọi và lược đồ máy chủ; so tập khoá

### Kết quả mong đợi
- Không khoá nào gửi lên mà máy chủ chưa khai

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-097

**Meta**:
- Loại: `PERMISSIONS`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X4`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X4
- Catches_bug: cán bộ từng chỉ có quyền đọc nên không lưu được đơn, phát hiện trên máy thật

**Runner contract**:
- Coverage_ids: `COV-X4-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cán bộ (không phải quản trị) lưu được đơn

### Các bước kiểm thử
- [ ] Đăng nhập tài khoản cán bộ; tạo một đơn thư; bấm Lưu

### Kết quả mong đợi
- Lưu thành công

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-099

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X5`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X5
- Catches_bug: deploy xong mà bản cũ còn sống thì mọi kết luận UAT nói về bản không tồn tại

**Runner contract**:
- Coverage_ids: `COV-X5-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Máy chủ báo mã bản dựng khớp commit đã hợp nhất

### Các bước kiểm thử
- [ ] Gọi đường kiểm tra sức khoẻ; so mã bản dựng với commit đầu nhánh chính

### Kết quả mong đợi
- Hai giá trị khớp nhau

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-100

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-DANH-SACH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X6`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X6
- Catches_bug: phạm vi dữ liệu là ranh giới nghiệp vụ, không phải tuỳ chọn hiển thị

**Runner contract**:
- Coverage_ids: `COV-X6-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cán bộ tổ khác không thấy hồ sơ ngoài phạm vi

### Các bước kiểm thử
- [ ] Đăng nhập cán bộ tổ khác; gọi danh sách đơn thư

### Kết quả mong đợi
- Không hồ sơ nào ngoài phạm vi của tổ ấy

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-101

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X6`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X6
- Catches_bug: đường xuất là chỗ rò dữ liệu kinh điển vì nó đi vòng qua bộ lọc của màn hình

**Runner contract**:
- Coverage_ids: `COV-X6-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tệp xuất cũng lọc theo phạm vi dữ liệu

### Các bước kiểm thử
- [ ] Đăng nhập cán bộ tổ khác; gọi đường xuất mọi trường; đọc nội dung tệp

### Kết quả mong đợi
- Tệp chỉ chứa hồ sơ trong phạm vi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-102

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X6`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X6
- Catches_bug: ca phạm vi hiện chỉ phủ nút xuất mọi trường; nút đang xem là đường ra thứ hai và chưa ai kiểm nó có rò hồ sơ tổ khác hay không

**Runner contract**:
- Coverage_ids: `COV-X6-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tệp của nút ĐANG XEM cũng lọc theo phạm vi dữ liệu

### Các bước kiểm thử
- [ ] Dựng dữ liệu đối chứng: hồ sơ mốc của tổ A và hồ sơ mốc của tổ B; đăng nhập cán bộ tổ A; gọi đường xuất theo bộ lọc đang xem; đọc nội dung tệp

### Kết quả mong đợi
- Tệp CÓ hồ sơ mốc của tổ A và KHÔNG có hồ sơ mốc của tổ B

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-103

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-ALL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-ALL
- Catches_bug: đường xuất mang trọn dữ liệu nên phải có cổng quyền riêng

**Runner contract**:
- Coverage_ids: `COV-SEC-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thiếu quyền xuất đầy đủ thì bị từ chối

### Các bước kiểm thử
- [ ] Gỡ quyền xuất đầy đủ khỏi vai; gọi đường xuất mọi trường

### Kết quả mong đợi
- Bị từ chối bằng mã 403, không trả tệp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-104

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: popup ẩn nút là ở giao diện; đường máy chủ vẫn gọi thẳng được

**Runner contract**:
- Coverage_ids: `COV-SEC-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa nhanh hồ sơ ngoài phạm vi bị chặn

### Các bước kiểm thử
- [ ] Đăng nhập cán bộ tổ khác; gọi thẳng đường cập nhật với định danh hồ sơ ngoài phạm vi

### Kết quả mong đợi
- Bị từ chối, hồ sơ không đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-105

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-VO-DANH`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-ALL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-ALL
- Catches_bug: đường mới thêm hay quên gắn bộ gác xác thực

**Runner contract**:
- Coverage_ids: `COV-SEC-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Vai vô danh không gọi được đường xuất

### Các bước kiểm thử
- [ ] Gọi đường xuất mọi trường không kèm phiên đăng nhập

### Kết quả mong đợi
- Bị từ chối bằng 401

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-109

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: trạng thái sống sót giữa hai dòng làm ghi nội dung hồ sơ này sang hồ sơ khác

**Runner contract**:
- Coverage_ids: `COV-ST-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Lưu xong rồi mở dòng KHÁC không mang giá trị dòng trước

### Các bước kiểm thử
- [ ] Sửa nhanh dòng 1 và lưu; bấm ngay nút sửa nhanh của dòng 2

### Kết quả mong đợi
- Popup dòng 2 mang giá trị của dòng 2

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-125

**Meta**:
- Loại: `UX`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-DANH-SACH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-DATA`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-DATA
- Catches_bug: Nielsen 9: báo rỗng khi thật ra hỏng làm không ai đi tìm nguyên nhân

**Runner contract**:
- Coverage_ids: `COV-UX-6`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Trạng thái rỗng của bảng phân biệt với tải hỏng

### Các bước kiểm thử
- [ ] Làm lời gọi danh sách trả lỗi; đọc thông báo trên bảng

### Kết quả mong đợi
- Bảng nói TẢI HỎNG, không nói không có dữ liệu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-136

**Meta**:
- Loại: `COMPAT`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ALIGN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ALIGN
- Catches_bug: đây là trình duyệt cán bộ dùng hàng ngày

**Runner contract**:
- Coverage_ids: `COV-COMPAT-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Chạy đúng trên Chrome

### Các bước kiểm thử
- [ ] Chạy luồng xuất và sửa nhanh trên Chrome bản hiện hành

### Kết quả mong đợi
- Cả hai luồng hoạt động và hàng nút không lệch

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-139

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X5`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X5
- Catches_bug: trạng thái xanh của quy trình không chứng minh bản mới đang chạy

**Runner contract**:
- Coverage_ids: `COV-OAT-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sau deploy, đường kiểm tra sức khoẻ trả mã bản dựng đúng

### Các bước kiểm thử
- [ ] Sau khi deploy xong, gọi đường kiểm tra sức khoẻ

### Kết quả mong đợi
- Trả trạng thái tốt và mã bản dựng khớp commit vừa hợp nhất

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-140

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S1` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-SEED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-SEED
- Catches_bug: seed hỏng mà deploy vẫn xanh thì danh mục rỗng lên thẳng máy thật

**Runner contract**:
- Coverage_ids: `COV-OAT-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Seed chạy trong deploy và deploy ĐỎ nếu seed hỏng

### Các bước kiểm thử
- [ ] Làm bước seed thất bại; chạy lại deploy

### Kết quả mong đợi
- Deploy dừng và báo lỗi, không chuyển sang bản mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: S1
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-003

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-HIDDEN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-HIDDEN
- Catches_bug: hiểu nhầm 'ô ẩn' thành 'ô trong nhóm gập' rồi cắt mất ô có dữ liệu thật

**Runner contract**:
- Coverage_ids: `COV-R1-HIDDEN-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ô nằm trong nhóm GẬP trên form vẫn được xuất

### Các bước kiểm thử
- [ ] Mở form, ghi lại tên ô trong nhóm gập có dữ liệu; xuất tệp mọi trường; tìm cột ấy

### Kết quả mong đợi
- Cột của ô trong nhóm gập có mặt trong tệp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-004

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-HIDDEN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-HIDDEN
- Catches_bug: kiểm nhãn lý do loại trừ là cổng rỗng: bộ xuất vẫn có thể bỏ sạch cột gập miễn bảng lý do ghi chữ 'rỗng'

**Runner contract**:
- Coverage_ids: `COV-R1-HIDDEN-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cột thuộc nhóm gập mà CÓ dữ liệu thì thật sự xuất hiện trong tệp

### Các bước kiểm thử
- [ ] Liệt kê mọi ô thuộc nhóm gập đang có dữ liệu trên prod; dựng dòng xuất cho một hồ sơ mang đủ các ô ấy; đối chiếu từng cột trong tệp kết quả

### Kết quả mong đợi
- Mỗi ô gập có dữ liệu đều có cột tương ứng trong tệp VÀ mang đúng giá trị

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-006

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: cắt theo cảm tính thay vì theo phép đo trên dữ liệu thật

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: 88 khoá metadata rỗng sạch đã bị cắt

### Các bước kiểm thử
- [ ] Đọc bảng loại trừ; đếm dòng loại 'metadata'

### Kết quả mong đợi
- Đủ 88 khoá metadata nằm trong bảng loại trừ, mỗi dòng kèm số đo

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-007

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: đợt trước chỉ đo khoá metadata nên ba cột riêng rỗng lọt vào tệp

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: 3 cột riêng rỗng sạch đã bị cắt

### Các bước kiểm thử
- [ ] Đọc bảng loại trừ; đếm dòng loại 'cot'

### Kết quả mong đợi
- Đủ 3 cột riêng trong bảng loại trừ, mỗi dòng kèm số đo 0/47.626

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-008

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: phép đo chỉ bắt chuỗi trắng nên cột toàn NULL bị coi là có dữ liệu

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Rỗng kiểu NULL được tính là rỗng

### Các bước kiểm thử
- [ ] Trên bản sao, đặt một cột về NULL cho mọi hồ sơ; chạy phép đo bộ cột

### Kết quả mong đợi
- Phép đo xếp cột ấy vào nhóm rỗng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-009

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: chuỗi ' ' bị đếm là có dữ liệu, cột trống vẫn ra tệp

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-5`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Rỗng kiểu chuỗi trắng được tính là rỗng

### Các bước kiểm thử
- [ ] Trên bản sao, đặt một cột về chuỗi chỉ gồm dấu cách; chạy phép đo

### Kết quả mong đợi
- Phép đo xếp cột ấy vào nhóm rỗng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-010

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: mảng rỗng là một giá trị JSON hợp lệ nên bị đếm là có dữ liệu

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-6`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Rỗng kiểu mảng rỗng được tính là rỗng

### Các bước kiểm thử
- [ ] Trên bản sao, đặt một khoá metadata về mảng rỗng; chạy phép đo

### Kết quả mong đợi
- Phép đo xếp khoá ấy vào nhóm rỗng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-011

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-EMPTY
- Catches_bug: null JSON khác NULL cột, dễ lọt qua điều kiện IS NOT NULL

**Runner contract**:
- Coverage_ids: `COV-R1-EMPTY-7`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Rỗng kiểu JSON null được tính là rỗng

### Các bước kiểm thử
- [ ] Trên bản sao, đặt một khoá metadata về null JSON; chạy phép đo

### Kết quả mong đợi
- Phép đo xếp khoá ấy vào nhóm rỗng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-FIXED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-FIXED
- Catches_bug: đo lại lúc xuất khiến hai tệp khác hình dạng, không đối chiếu được

**Runner contract**:
- Coverage_ids: `COV-R1-FIXED-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai lần xuất liên tiếp cho cùng bộ cột

### Các bước kiểm thử
- [ ] Xuất tệp mọi trường hai lần cách nhau; so hàng tiêu đề hai tệp

### Kết quả mong đợi
- Hai hàng tiêu đề giống hệt nhau, cùng thứ tự

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-013

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-FIXED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-FIXED
- Catches_bug: anh chốt chuẩn hoá một lần; đo lại lúc xuất là làm ngược yêu cầu

**Runner contract**:
- Coverage_ids: `COV-R1-FIXED-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bộ cột KHÔNG đo lại lúc xuất

### Các bước kiểm thử
- [ ] Đọc đường xuất; kiểm không có truy vấn đếm dữ liệu nào chạy khi dựng bộ cột

### Kết quả mong đợi
- Bộ cột lấy từ bảng khai tĩnh, không từ truy vấn lúc xuất

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-017

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-VALUE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-VALUE
- Catches_bug: khoaLuu và tên cột lệch nhau ở nhóm cột typed

**Runner contract**:
- Coverage_ids: `COV-R1-VALUE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Khoá lưu đọc đúng cho cột riêng

### Các bước kiểm thử
- [ ] Gọi hàm dựng dòng xuất với hồ sơ có đủ cột riêng; so từng ô với giá trị nguồn

### Kết quả mong đợi
- Mỗi cột riêng lấy đúng giá trị từ cột cùng tên

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-018

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-VALUE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-VALUE
- Catches_bug: đọc metadata bằng tên hiển thị thay vì khoá lưu

**Runner contract**:
- Coverage_ids: `COV-R1-VALUE-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Khoá lưu đọc đúng cho khoá metadata

### Các bước kiểm thử
- [ ] Gọi hàm dựng dòng xuất với hồ sơ có metadata; so từng ô với giá trị nguồn

### Kết quả mong đợi
- Mỗi khoá metadata lấy đúng giá trị trong cột JSON

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-021

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-CAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-CAP
- Catches_bug: cắt sớm ở 4.999 hoặc đổ vì hết bộ nhớ ngay tại trần

**Runner contract**:
- Coverage_ids: `COV-R1-CAP-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Xuất đúng trần 5.000 dòng

### Các bước kiểm thử
- [ ] Gọi đường xuất mọi trường với bộ lọc khớp đúng 5.000 hồ sơ

### Kết quả mong đợi
- Tệp có đủ 5.000 dòng dữ liệu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-022

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-CAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-CAP
- Catches_bug: cắt im lặng khiến cán bộ tưởng đã xuất hết

**Runner contract**:
- Coverage_ids: `COV-R1-CAP-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Quá trần thì cắt còn 5.000 và nói rõ đã cắt

### Các bước kiểm thử
- [ ] Gọi đường xuất với bộ lọc khớp 5.001 hồ sơ trở lên

### Kết quả mong đợi
- Tệp có 5.000 dòng VÀ người dùng được báo là kết quả đã bị cắt

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-030

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-STOP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-STOP
- Catches_bug: mở popup đồng thời điều hướng sang hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R2-STOP-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thành phần nút chặn lan sự kiện chuột trong khung dựng thử

### Các bước kiểm thử
- [ ] Dựng bảng có bộ nghe click trên dòng; bấm nút sửa nhanh; đếm số lần bộ nghe dòng chạy

### Kết quả mong đợi
- Bộ nghe trên dòng chạy 0 lần

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-031

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-STOP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-STOP
- Catches_bug: chặn mỗi click thì người dùng bàn phím vẫn bị đẩy sang hồ sơ

**Runner contract**:
- Coverage_ids: `COV-R2-STOP-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thành phần nút chặn lan sự kiện bàn phím trong khung dựng thử

### Các bước kiểm thử
- [ ] Đưa tiêu điểm vào nút bằng bàn phím; gõ Enter; đếm số lần bộ nghe keydown của dòng chạy

### Kết quả mong đợi
- Bộ nghe trên dòng chạy 0 lần

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-034

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-ICON`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-ICON
- Catches_bug: biểu tượng nhỏ khó bấm, đúng lời anh phản ánh ở yêu cầu 9

**Runner contract**:
- Coverage_ids: `COV-R2-ICON-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Vùng chạm của nút đạt tối thiểu WCAG 2.2

### Các bước kiểm thử
- [ ] Đo hộp bao của nút sửa nhanh trên Chrome thật

### Kết quả mong đợi
- Cả hai chiều tối thiểu 24 CSS pixel (WCAG 2.2 — 2.5.8 Target Size)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-037

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILE
- Catches_bug: thuộc tính download trên thẻ a bỏ qua Content-Disposition, tệp về sai tên

**Runner contract**:
- Coverage_ids: `COV-R2-FILE-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tên tệp tải về theo máy chủ, không bị ép tên

### Các bước kiểm thử
- [ ] Tải xuống một tệp có tên tiếng Việt có dấu; đọc tên tệp nhận được

### Kết quả mong đợi
- Tên tệp đúng như máy chủ khai ở Content-Disposition

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-038

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-A11Y`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-A11Y
- Catches_bug: người dùng bàn phím nghe 50 nút giống hệt nhau, không biết đang ở dòng nào

**Runner contract**:
- Coverage_ids: `COV-R2-A11Y-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhãn đọc được nói rõ sửa ô nào của hồ sơ nào

### Các bước kiểm thử
- [ ] Đọc nhãn trợ năng của nút sửa nhanh trên nhiều dòng khác nhau

### Kết quả mong đợi
- Nhãn nêu tên ô và mô tả nhận ra được hồ sơ, không phải chuỗi Sửa nhanh trơ trọi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-039

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-A11Y`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-A11Y
- Catches_bug: nút chỉ bấm được bằng chuột

**Runner contract**:
- Coverage_ids: `COV-R2-A11Y-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tới được nút bằng phím Tab

### Các bước kiểm thử
- [ ] Từ đầu bảng, gõ Tab liên tiếp

### Kết quả mong đợi
- Tiêu điểm dừng ở nút sửa nhanh và thấy rõ vòng tiêu điểm

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-040

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: cán bộ tưởng lưu hỏng rồi bấm lại, sinh bản ghi trùng

**Runner contract**:
- Coverage_ids: `COV-R2-SAVE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Lưu xong bảng cập nhật ngay, không cần tải lại

### Các bước kiểm thử
- [ ] Sửa nhanh một ô rồi bấm Lưu; quan sát ô trên bảng

### Kết quả mong đợi
- Ô hiện giá trị mới mà không phải tải lại trang

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-042

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-DANH-SACH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-POS`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-POS
- Catches_bug: yêu cầu 3 nói rõ vị trí; đặt cuối bảng là làm sai yêu cầu

**Runner contract**:
- Coverage_ids: `COV-R3-POS-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cột Loại thông tin đứng ngay trước Nguồn đơn/Đơn vị giao

### Các bước kiểm thử
- [ ] Mở Danh sách đơn thư; đọc thứ tự hàng tiêu đề

### Kết quả mong đợi
- Loại thông tin nằm ngay sát bên trái Nguồn đơn/Đơn vị giao

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-045

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-DATA`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-DATA
- Catches_bug: tải hỏng khác rỗng: báo rỗng khi thật ra là hỏng khiến không ai đi tìm nguyên nhân

**Runner contract**:
- Coverage_ids: `COV-R3-DATA-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Máy chủ trả LỖI thì ô báo tải hỏng

### Các bước kiểm thử
- [ ] Giả lập máy chủ trả mã lỗi cho danh mục; mở ô Loại thông tin

### Kết quả mong đợi
- Ô báo TẢI HỎNG, KHÔNG hiện chữ không có mục nào

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-047

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-EXPORT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-EXPORT
- Catches_bug: thêm cột lên bảng mà quên đường xuất

**Runner contract**:
- Coverage_ids: `COV-R3-EXPORT-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cột Loại thông tin có trong tệp xuất

### Các bước kiểm thử
- [ ] Xuất tệp; tìm cột Loại thông tin

### Kết quả mong đợi
- Cột có mặt và mang giá trị đúng hồ sơ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-048

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-BTN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-BTN
- Catches_bug: yêu cầu 4 không dùng được

**Runner contract**:
- Coverage_ids: `COV-R4-BTN-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút hiện khi đang SỬA hồ sơ

### Các bước kiểm thử
- [ ] Mở một đơn thư ở chế độ sửa

### Kết quả mong đợi
- Có nút tạo đơn thư mới từ đơn này

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-050

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-COPY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-COPY
- Catches_bug: chép rỗng thì nút không tiết kiệm được thao tác nào

**Runner contract**:
- Coverage_ids: `COV-R4-COPY-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đơn mới mang theo nội dung đơn cũ

### Các bước kiểm thử
- [ ] Ở chế độ sửa, bấm tạo đơn mới từ đơn này; đọc các ô trên form mới

### Kết quả mong đợi
- Các ô nghiệp vụ mang giá trị của đơn cũ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-057

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-PLACE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-PLACE
- Catches_bug: yêu cầu 5 nói ngay cạnh; đặt ở tab tài liệu chung là chưa làm

**Runner contract**:
- Coverage_ids: `COV-R5-PLACE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Khu tải tệp nằm cạnh ô Kết quả xử lý

### Các bước kiểm thử
- [ ] Mở form; tìm ô Kết quả xử lý và khu tải tệp

### Kết quả mong đợi
- Khu tải tệp nằm trong cùng nhóm với ô Kết quả xử lý

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-058

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-TYPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-TYPE
- Catches_bug: tệp vào đúng hồ sơ nhưng sai loại thì không lọc ra được sau này

**Runner contract**:
- Coverage_ids: `COV-R5-TYPE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tệp tải ở khu này mang đúng loại của khu

### Các bước kiểm thử
- [ ] Tải một tệp lên khu Kết quả xử lý; mở lại hồ sơ; đọc loại tệp

### Kết quả mong đợi
- Tệp mang loại tài liệu của khu kết quả xử lý

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-059

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-TYPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-TYPE
- Catches_bug: mở biểu mẫu ra là tệp đầu tiên đã sai loại, trước cả khi bấm tải lên

**Runner contract**:
- Coverage_ids: `COV-R5-TYPE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Loại KHÔNG rơi về Văn bản

### Các bước kiểm thử
- [ ] Dựng khu với loại ban đầu khác Văn bản; mở biểu mẫu tải lên; đọc giá trị ô chọn loại

### Kết quả mong đợi
- Ô chọn loại mang loại ban đầu của khu, không phải Văn bản

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-063

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-SEED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-SEED
- Catches_bug: chỉ đếm số mục giữa hai lượt thì một seed KHÔNG LÀM GÌ CẢ vẫn xanh vì 0 bằng 0; và seed xoá-rồi-tạo-lại cũng xanh trong khi id đổi hết, làm gãy mọi tham chiếu

**Runner contract**:
- Coverage_ids: `COV-R5-SEED-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Seed lần đầu TẠO ĐỦ mục, lần hai giữ nguyên định danh và nội dung

### Các bước kiểm thử
- [ ] Xoá sạch danh mục trên bản sao; chạy seed lần 1 và ghi lại (id, mã, tên) từng mục; chạy seed lần 2; so nguyên bộ ba ấy

### Kết quả mong đợi
- Lần 1 tạo đủ các mục bắt buộc đã khai; lần 2 giữ NGUYÊN id, mã và tên của từng mục

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-064

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-DEFAULT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-DEFAULT
- Catches_bug: yêu cầu 6: cán bộ phải chọn tay mỗi lần tạo đơn

**Runner contract**:
- Coverage_ids: `COV-R6-DEFAULT-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Màn tạo mới: ô báo cáo Ban Giám đốc đã là Không

### Các bước kiểm thử
- [ ] Mở màn tạo đơn thư mới; đọc ô Trường hợp báo cáo Ban Giám đốc

### Kết quả mong đợi
- Ô đã mang giá trị Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-070

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-SUGGEST`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-SUGGEST
- Catches_bug: yêu cầu 8 không dùng được

**Runner contract**:
- Coverage_ids: `COV-R7-SUGGEST-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Gõ 2 ký tự trở lên thì hiện tên đã có trong dữ liệu

### Các bước kiểm thử
- [ ] Mở form tạo; gõ hai ký tự đầu của một tên chắc chắn đã có

### Kết quả mong đợi
- Danh sách gợi ý hiện tên ấy

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-071

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-SUGGEST`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-SUGGEST
- Catches_bug: chỉ khớp đầu chuỗi thì gõ tên đệm không ra gì, khác hẳn cách anh mô tả

**Runner contract**:
- Coverage_ids: `COV-R7-SUGGEST-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Khớp GIỮA chuỗi, không chỉ khớp đầu chuỗi

### Các bước kiểm thử
- [ ] Gọi đường gợi ý với một đoạn nằm giữa tên đã có

### Kết quả mong đợi
- Tên ấy có trong kết quả

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-072

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-SUGGEST`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-SUGGEST
- Catches_bug: ký tự mẫu không thoát làm một ký tự trở thành khớp tất cả

**Runner contract**:
- Coverage_ids: `COV-R7-SUGGEST-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ký tự đặc biệt của mẫu tìm được thoát đúng

### Các bước kiểm thử
- [ ] Gọi đường gợi ý với chuỗi chứa phần trăm và gạch dưới

### Kết quả mong đợi
- Kết quả khớp đúng ký tự ấy theo nghĩa đen, không khớp mọi thứ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-077

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-TYPE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-TYPE
- Catches_bug: rời ô làm ô tự xoá về giá trị đã chọn trước đó

**Runner contract**:
- Coverage_ids: `COV-R7-TYPE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Gõ rồi rời ô rồi quay lại, chữ còn nguyên

### Các bước kiểm thử
- [ ] Gõ tên; bấm sang ô khác; bấm lại vào ô tên

### Kết quả mong đợi
- Chữ vừa gõ còn nguyên

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-080

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: yêu cầu 10: hai nút tên khó hiểu nên bấm nhầm

**Runner contract**:
- Coverage_ids: `COV-R8-LABEL-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai nút có nhãn phân biệt được

### Các bước kiểm thử
- [ ] Mở khung Bộ lọc; đọc nhãn hai nút xuất

### Kết quả mong đợi
- Hai nhãn khác nhau và nói rõ nút nào xuất gì

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-081

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: cán bộ phải bấm thử mới biết nút làm gì

**Runner contract**:
- Coverage_ids: `COV-R8-LABEL-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhãn nói rõ nút nào xuất đúng cột đang xem

### Các bước kiểm thử
- [ ] Đọc nhãn nút thứ nhất mà không mở tài liệu nào

### Kết quả mong đợi
- Nhãn tự nói được rằng nút ấy xuất đúng cột đang hiển thị

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-082

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-TITLE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-TITLE
- Catches_bug: yêu cầu 12 của anh

**Runner contract**:
- Coverage_ids: `COV-R8-TITLE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tiêu đề trong tệp nút đang xem là DANH SÁCH ĐƠN THƯ

### Các bước kiểm thử
- [ ] Xuất bằng nút đang xem; mở tệp; đọc dòng tiêu đề

### Kết quả mong đợi
- Đúng chuỗi DANH SÁCH ĐƠN THƯ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-083

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-TITLE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-TITLE
- Catches_bug: đây đúng tệp anh chỉ ra là đang sai

**Runner contract**:
- Coverage_ids: `COV-R8-TITLE-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tiêu đề trong tệp nút mọi trường là DANH SÁCH ĐƠN THƯ

### Các bước kiểm thử
- [ ] Xuất bằng nút mọi trường; mở tệp; đọc dòng tiêu đề

### Kết quả mong đợi
- Đúng chuỗi DANH SÁCH ĐƠN THƯ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-084

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-TITLE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-TITLE
- Catches_bug: sửa một đường còn đường kia giữ tên cũ

**Runner contract**:
- Coverage_ids: `COV-R8-TITLE-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Không còn hậu tố ĐẦY ĐỦ TRƯỜNG

### Các bước kiểm thử
- [ ] Đọc toàn bộ dòng tiêu đề của cả hai tệp

### Kết quả mong đợi
- Không tệp nào chứa chuỗi ĐẦY ĐỦ TRƯỜNG

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-086

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ALIGN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ALIGN
- Catches_bug: yêu cầu 14: hai nút xuất tụt xuống nửa dòng chữ

**Runner contract**:
- Coverage_ids: `COV-R9-ALIGN-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bốn nút và dòng đếm nằm cùng một đường căn

### Các bước kiểm thử
- [ ] Mở khung Bộ lọc ở bề rộng đầy đủ; đo toạ độ tâm dọc của từng nút và dòng đếm

### Kết quả mong đợi
- Chênh lệch tâm dọc giữa các phần tử trong ngưỡng 2 pixel

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-088

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-WRAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-WRAP
- Catches_bug: bốn nút cộng dòng chữ tràn ra ngoài ở màn hẹp

**Runner contract**:
- Coverage_ids: `COV-R9-WRAP-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Màn hẹp thì hàng nút xuống dòng, không tràn

### Các bước kiểm thử
- [ ] Đặt bề rộng cửa sổ 400 pixel; đo hộp bao hàng nút và khung chứa

### Kết quả mong đợi
- Hàng nút nằm trọn trong khung, không có thanh cuộn ngang

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-090

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ERR`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ERR
- Catches_bug: chữ lỗi đẩy chiều cao nút, làm hỏng đúng thứ vừa sửa

**Runner contract**:
- Coverage_ids: `COV-R9-ERR-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút đang báo LỖI không làm lệch hàng

### Các bước kiểm thử
- [ ] Làm đường xuất trả lỗi; đo lại tâm dọc của bốn nút

### Kết quả mong đợi
- Bốn nút vẫn cùng một đường căn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-093

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X2`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X2
- Catches_bug: chuẩn hoá bộ cột cho nút kia mà làm hỏng hợp đồng của nút này

**Runner contract**:
- Coverage_ids: `COV-X2-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút đang xem xuất đúng cột đang nhìn

### Các bước kiểm thử
- [ ] Ẩn vài cột trên bảng; xuất bằng nút đang xem; so cột tệp với cột trên bảng

### Kết quả mong đợi
- Cột tệp khớp đúng cột đang hiển thị

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-094

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X2`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X2
- Catches_bug: nút này xuất đúng cái anh đang nhìn; cắt theo dữ liệu là phá hợp đồng của nó

**Runner contract**:
- Coverage_ids: `COV-X2-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút đang xem KHÔNG cắt cột theo dữ liệu

### Các bước kiểm thử
- [ ] Để hiện một cột đang rỗng ở trang hiện tại; xuất bằng nút đang xem

### Kết quả mong đợi
- Cột rỗng ấy VẪN có trong tệp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-098

**Meta**:
- Loại: `PERMISSIONS`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `X4`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §X4
- Catches_bug: quyền mới cấp cho quản trị mà quên cán bộ là tính năng chết với đa số người dùng

**Runner contract**:
- Coverage_ids: `COV-X4-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Cán bộ xuất được tệp mọi trường

### Các bước kiểm thử
- [ ] Đăng nhập tài khoản cán bộ; bấm Xuất Excel (mọi trường)

### Kết quả mong đợi
- Tệp tải về được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-106

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILE
- Catches_bug: đính tệp là đường nhận dữ liệu từ ngoài vào, phải chặn ngay ở máy chủ

**Runner contract**:
- Coverage_ids: `COV-SEC-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tệp ngoài danh sách loại cho phép bị từ chối

### Các bước kiểm thử
- [ ] Tải lên một tệp thực thi qua đường đính tệp

### Kết quả mong đợi
- Bị từ chối, tệp không được lưu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-107

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILE
- Catches_bug: tên tệp do người ngoài đặt là đường ghi đè tệp hệ thống

**Runner contract**:
- Coverage_ids: `COV-SEC-5`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tên tệp chứa ký tự đường dẫn bị vô hiệu hoá

### Các bước kiểm thử
- [ ] Tải lên tệp có tên chứa chuỗi đi lên thư mục cha

### Kết quả mong đợi
- Tệp lưu vào đúng thư mục đích, tên đã được làm sạch

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-108

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: bản nháp cũ sống sót khiến lần lưu sau ghi nhầm nội dung đã bỏ

**Runner contract**:
- Coverage_ids: `COV-ST-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đóng popup rồi mở lại thì lấy giá trị từ máy chủ

### Các bước kiểm thử
- [ ] Mở popup; gõ dở; đóng không lưu; mở lại popup cùng dòng

### Kết quả mong đợi
- Ô nhập mang giá trị đang lưu trên máy chủ, không phải bản nháp vừa bỏ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-110

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S2` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: ghi và đọc phải cùng một quy ước ở cả hai phía

**Runner contract**:
- Coverage_ids: `COV-ST-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai tab cùng mở, tab A sửa nhanh, tab B tải lại thấy đúng

### Các bước kiểm thử
- [ ] Mở danh sách ở hai tab; sửa nhanh một dòng ở tab A; tải lại tab B

### Kết quả mong đợi
- Tab B hiện giá trị mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: S2
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-111

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: tổ hợp hiếm là chỗ hai luật giao nhau và không ai nghĩ tới

**Runner contract**:
- Coverage_ids: `COV-DEC-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút xuất: có bộ lọc, có quyền xuất đầy đủ

### Các bước kiểm thử
- [ ] Đặt một bộ lọc; đăng nhập vai CÓ quyền xuất đầy đủ; mở khung Bộ lọc và bấm xuất

### Kết quả mong đợi
- Xuất được, tệp chỉ gồm hồ sơ khớp bộ lọc

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-112

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: tổ hợp hiếm là chỗ hai luật giao nhau và không ai nghĩ tới

**Runner contract**:
- Coverage_ids: `COV-DEC-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút xuất: có bộ lọc, không quyền xuất đầy đủ

### Các bước kiểm thử
- [ ] Đặt một bộ lọc; đăng nhập vai KHÔNG quyền xuất đầy đủ; mở khung Bộ lọc và bấm xuất

### Kết quả mong đợi
- Nút mọi trường không hiện; nút đang xem vẫn xuất được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-113

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: tổ hợp hiếm là chỗ hai luật giao nhau và không ai nghĩ tới

**Runner contract**:
- Coverage_ids: `COV-DEC-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút xuất: không bộ lọc, có quyền xuất đầy đủ

### Các bước kiểm thử
- [ ] Đặt không bộ lọc; đăng nhập vai CÓ quyền xuất đầy đủ; mở khung Bộ lọc và bấm xuất

### Kết quả mong đợi
- Xuất được toàn bộ phạm vi, tôn trọng trần 5.000 dòng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-114

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: tổ hợp hiếm là chỗ hai luật giao nhau và không ai nghĩ tới

**Runner contract**:
- Coverage_ids: `COV-DEC-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút xuất: không bộ lọc, không quyền xuất đầy đủ

### Các bước kiểm thử
- [ ] Đặt không bộ lọc; đăng nhập vai KHÔNG quyền xuất đầy đủ; mở khung Bộ lọc và bấm xuất

### Kết quả mong đợi
- Nút mọi trường không hiện; nút đang xem vẫn xuất được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-115

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: ca kiểm thiếu thiết lập quyền làm nút không hiện, và ca vẫn xanh vì không có gì để bấm

**Runner contract**:
- Coverage_ids: `COV-DEC-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa nhanh: ô rỗng, có quyền sửa

### Các bước kiểm thử
- [ ] Đăng nhập vai CÓ quyền sửa hồ sơ; mở danh sách; tìm dòng có ô Kết quả xử lý khác đang rỗng

### Kết quả mong đợi
- Ô rỗng hiện nút có biểu tượng và nhãn; bấm mở popup trống

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-116

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: ca kiểm thiếu thiết lập quyền làm nút không hiện, và ca vẫn xanh vì không có gì để bấm

**Runner contract**:
- Coverage_ids: `COV-DEC-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa nhanh: ô có chữ, có quyền sửa

### Các bước kiểm thử
- [ ] Đăng nhập vai CÓ quyền sửa hồ sơ; mở danh sách; tìm dòng có ô Kết quả xử lý khác đã có nội dung

### Kết quả mong đợi
- Ô có chữ hiện nút bên cạnh chữ; bấm mở popup mang giá trị cũ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-117

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: ca kiểm thiếu thiết lập quyền làm nút không hiện, và ca vẫn xanh vì không có gì để bấm

**Runner contract**:
- Coverage_ids: `COV-DEC-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa nhanh: ô rỗng, không quyền sửa

### Các bước kiểm thử
- [ ] Đăng nhập vai KHÔNG quyền sửa hồ sơ; mở danh sách; tìm dòng có ô Kết quả xử lý khác đang rỗng

### Kết quả mong đợi
- Ô rỗng KHÔNG hiện nút; ô trống và bấm vào ô mở hồ sơ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-118

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO-KHAC-TO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-FILLED`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-FILLED
- Catches_bug: ca kiểm thiếu thiết lập quyền làm nút không hiện, và ca vẫn xanh vì không có gì để bấm

**Runner contract**:
- Coverage_ids: `COV-DEC-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa nhanh: ô có chữ, không quyền sửa

### Các bước kiểm thử
- [ ] Đăng nhập vai KHÔNG quyền sửa hồ sơ; mở danh sách; tìm dòng có ô Kết quả xử lý khác đã có nội dung

### Kết quả mong đợi
- Ô có chữ KHÔNG hiện nút; bấm vào chữ mở hồ sơ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-120

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: Nielsen 1: không phản hồi thì cán bộ bấm lại nhiều lần

**Runner contract**:
- Coverage_ids: `COV-UX-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Đang xuất thì nút cho biết hệ đang chạy

### Các bước kiểm thử
- [ ] Bấm xuất tệp lớn; quan sát nút trong lúc chờ

### Kết quả mong đợi
- Nút chuyển trạng thái đang chạy và không nhận bấm tiếp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-122

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: Nielsen 3: mở nhầm mà không thoát được là bẫy

**Runner contract**:
- Coverage_ids: `COV-UX-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Popup sửa nhanh có lối thoát rõ ràng

### Các bước kiểm thử
- [ ] Mở popup; tìm cách đóng không lưu

### Kết quả mong đợi
- Có nút đóng thấy được và phím Esc cũng đóng được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-124

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-CAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-CAP
- Catches_bug: Nielsen 5: ngăn lỗi rẻ hơn báo lỗi

**Runner contract**:
- Coverage_ids: `COV-UX-5`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Vượt trần xuất thì báo trước, không để tải xong mới hỏng

### Các bước kiểm thử
- [ ] Đặt bộ lọc khớp hơn 5.000 hồ sơ; bấm xuất

### Kết quả mong đợi
- Hệ báo trước số dòng sẽ xuất và mời thu hẹp bộ lọc

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-126

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: Nielsen 9: thông báo không hành động được thì bằng không có

**Runner contract**:
- Coverage_ids: `COV-UX-7`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thông báo lỗi nói được cách khắc phục

### Các bước kiểm thử
- [ ] Gây lỗi khi lưu popup; đọc thông báo

### Kết quả mong đợi
- Thông báo nói rõ việc cần làm tiếp, không chỉ nêu mã lỗi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-127

**Meta**:
- Loại: `UX`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-EMPTY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-EMPTY
- Catches_bug: ISO 9241-11 hiệu quả: nếu không nhanh hơn thì yêu cầu 2 không giải quyết vấn đề gì

**Runner contract**:
- Coverage_ids: `COV-UX-8`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Sửa từ bảng ít thao tác hơn mở hồ sơ

### Các bước kiểm thử
- [ ] Đếm số lần bấm để ghi kết quả xử lý theo hai đường: từ bảng và qua mở hồ sơ

### Kết quả mong đợi
- Đường từ bảng ít thao tác hơn rõ rệt

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-129

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-A11Y`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-A11Y
- Catches_bug: hàng tiêu đề dính che mất nút đang chọn, người dùng bàn phím mất dấu

**Runner contract**:
- Coverage_ids: `COV-A11Y-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tiêu điểm không bị che khi cuộn bảng

### Các bước kiểm thử
- [ ] Dùng Tab đi qua các nút trong bảng có hàng tiêu đề dính

### Kết quả mong đợi
- Phần tử đang có tiêu điểm không bị hàng tiêu đề che (WCAG 2.2 — 2.4.11)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-131

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-ICON`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-ICON
- Catches_bug: màu xanh nhạt trên nền trắng là đúng thứ anh nói khó nhìn

**Runner contract**:
- Coverage_ids: `COV-A11Y-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Tương phản chữ trên nút đạt mức AA

### Các bước kiểm thử
- [ ] Đo tỷ lệ tương phản chữ và nền của nút sửa nhanh và hai nút xuất

### Kết quả mong đợi
- Tối thiểu 4.5:1 (WCAG 1.4.3)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-132

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-A11Y`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-A11Y
- Catches_bug: nút chỉ có biểu tượng là nút câm với trình đọc màn hình

**Runner contract**:
- Coverage_ids: `COV-A11Y-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Mọi nút có tên đọc được

### Các bước kiểm thử
- [ ] Quét bảng và popup; liệt kê nút không có tên đọc được

### Kết quả mong đợi
- Không nút nào thiếu tên (WCAG 4.1.2)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-133

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: bẫy tiêu điểm không thoát được là lỗi chặn với người dùng bàn phím

**Runner contract**:
- Coverage_ids: `COV-A11Y-5`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Popup giữ tiêu điểm đúng cách và Esc thoát được

### Các bước kiểm thử
- [ ] Mở popup; gõ Tab vòng quanh; gõ Esc

### Kết quả mong đợi
- Tiêu điểm quẩn trong popup và Esc đóng được (WCAG 2.1.2)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-135

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-DANH-SACH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-A11Y`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-A11Y
- Catches_bug: quét tự động chỉ bắt khoảng 57% vấn đề nên phải nói rõ phần còn lại kiểm bằng tay

**Runner contract**:
- Coverage_ids: `COV-A11Y-7`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Quét tự động không còn lỗi mức A/AA

### Các bước kiểm thử
- [ ] Chạy bộ quét trợ năng tự động trên bảng và trên popup

### Kết quả mong đợi
- lỗi mức A và AA; các mục chưa kết luận được đã phân loại bằng tay

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-137

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ALIGN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ALIGN
- Catches_bug: máy cơ quan cài sẵn Edge, nhiều cán bộ không đổi trình duyệt

**Runner contract**:
- Coverage_ids: `COV-COMPAT-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Chạy đúng trên Edge Chromium

### Các bước kiểm thử
- [ ] Chạy lại hai luồng trên Edge Chromium

### Kết quả mong đợi
- Kết quả như trên Chrome

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-138

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S3` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-WRAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-WRAP
- Catches_bug: đây là độ phân giải máy văn phòng phổ biến, hẹp hơn màn của người phát triển

**Runner contract**:
- Coverage_ids: `COV-COMPAT-3`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Bố cục đúng ở màn 1366x768

### Các bước kiểm thử
- [ ] Đặt khung nhìn 1366x768; đo hàng nút

### Kết quả mong đợi
- Hàng nút nằm trọn, không lệch, không cuộn ngang

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: S3
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-020

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-VAN-HANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-GUARD`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-GUARD
- Catches_bug: chặn deploy vì một cột mới có dữ liệu là phản ứng quá tay

**Runner contract**:
- Coverage_ids: `COV-R1-GUARD-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Phép đo trong deploy chỉ cảnh báo, không chặn deploy

### Các bước kiểm thử
- [ ] Chạy bước kiểm bộ cột trong deploy với một cột đã cắt nay có dữ liệu

### Kết quả mong đợi
- Bản ghi deploy có dòng CẢNH BÁO, và deploy vẫn đi tiếp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-029

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-TEXT`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-TEXT
- Catches_bug: vùng bấm của nút trùm cả ô khiến không mở được hồ sơ từ cột ấy

**Runner contract**:
- Coverage_ids: `COV-R2-TEXT-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ô rỗng thì nút chính là nội dung ô

### Các bước kiểm thử
- [ ] Ở ô rỗng, bấm vào vùng trống quanh nút

### Kết quả mong đợi
- Bấm ngoài nút mở hồ sơ như mọi ô khác

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-033

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-ICON`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-ICON
- Catches_bug: yêu cầu 9: biểu tượng lạ nên cán bộ không nhận ra đó là nút sửa

**Runner contract**:
- Coverage_ids: `COV-R2-ICON-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Biểu tượng là bút, cùng biểu tượng sửa của hệ

### Các bước kiểm thử
- [ ] Kết xuất nút; so tên biểu tượng với biểu tượng sửa khai ở danh mục hành động chung

### Kết quả mong đợi
- Cùng một biểu tượng bút, không phải biểu tượng riêng của màn này

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-043

**Meta**:
- Loại: `STATE`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-DANH-SACH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R3-POS`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R3-POS
- Catches_bug: cột mới chèn theo thứ tự nạp nên nhảy chỗ giữa các lần mở

**Runner contract**:
- Coverage_ids: `COV-R3-POS-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thứ tự cột giữ nguyên sau khi tải lại trang

### Các bước kiểm thử
- [ ] Tải lại trang danh sách; đọc lại thứ tự hàng tiêu đề

### Kết quả mong đợi
- Thứ tự không đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-049

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-BTN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-BTN
- Catches_bug: nút vô nghĩa ở màn tạo mới vì chưa có đơn nguồn để chép

**Runner contract**:
- Coverage_ids: `COV-R4-BTN-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút KHÔNG hiện khi đang tạo mới

### Các bước kiểm thử
- [ ] Mở màn tạo đơn thư mới

### Kết quả mong đợi
- Không có nút tạo đơn mới từ đơn này

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-060

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-TWO`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-TWO
- Catches_bug: hai khu giống hệt nhau thì cán bộ tải nhầm chỗ

**Runner contract**:
- Coverage_ids: `COV-R5-TWO-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai khu tải tệp phân biệt được trên màn hình

### Các bước kiểm thử
- [ ] Mở form có cả khu tệp chung và khu tệp kết quả; đọc tiêu đề hai khu

### Kết quả mong đợi
- Hai khu có tiêu đề khác nhau nói rõ tệp nào thuộc khu nào

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-061

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R5-TWO`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R5-TWO
- Catches_bug: trùng định danh làm ca kiểm chọn nhầm khu và báo xanh oan

**Runner contract**:
- Coverage_ids: `COV-R5-TWO-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai khu có định danh kiểm thử riêng

### Các bước kiểm thử
- [ ] Kết xuất form; đếm phần tử mang định danh kiểm thử của khu

### Kết quả mong đợi
- Mỗi khu một định danh riêng, không trùng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-066

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R6-REMOVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R6-REMOVE
- Catches_bug: yêu cầu 7 chưa làm

**Runner contract**:
- Coverage_ids: `COV-R6-REMOVE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Ô Đồ vật, tài liệu kèm theo không còn trên form

### Các bước kiểm thử
- [ ] Mở form tạo và form sửa; tìm ô Đồ vật, tài liệu kèm theo

### Kết quả mong đợi
- Ô không có trên cả hai màn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-073

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-MIN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-MIN
- Catches_bug: gõ một chữ cái quét gần 48.000 hồ sơ, vừa chậm vừa vô dụng

**Runner contract**:
- Coverage_ids: `COV-R7-MIN-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Một ký tự thì CHƯA gợi ý

### Các bước kiểm thử
- [ ] Gọi đường gợi ý với đúng 1 ký tự

### Kết quả mong đợi
- Không trả gợi ý nào

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-074

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-MIN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-MIN
- Catches_bug: đặt ngưỡng lệch một đơn vị làm ô gợi ý im lặng ở đúng độ dài người ta hay gõ

**Runner contract**:
- Coverage_ids: `COV-R7-MIN-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Hai ký tự thì CÓ gợi ý

### Các bước kiểm thử
- [ ] Gọi đường gợi ý với đúng 2 ký tự khớp dữ liệu có thật

### Kết quả mong đợi
- Trả về gợi ý

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-075

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-TAO`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R7-MAX`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R7-MAX
- Catches_bug: đổ hàng nghìn tên xuống một ô chọn làm treo trình duyệt

**Runner contract**:
- Coverage_ids: `COV-R7-MAX-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhiều kết quả thì cắt còn tối đa 10

### Các bước kiểm thử
- [ ] Gọi đường gợi ý với đoạn khớp rất nhiều hồ sơ

### Kết quả mong đợi
- Trả về nhiều nhất 10 mục

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-085

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `api`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-ONE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-ONE
- Catches_bug: hai chuỗi rời sẽ lệch nhau ở lần sửa sau

**Runner contract**:
- Coverage_ids: `COV-R8-ONE-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Một hằng số tiêu đề dùng cho cả hai đường xuất

### Các bước kiểm thử
- [ ] Đọc mã hai đường xuất; đếm số chuỗi tiêu đề viết thẳng

### Kết quả mong đợi
- Cả hai đường đọc từ cùng một hằng số, 0 chuỗi viết thẳng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-087

**Meta**:
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ALIGN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ALIGN
- Catches_bug: đo bằng chuỗi lớp CSS thay vì cây phần tử là cổng rỗng

**Runner contract**:
- Coverage_ids: `COV-R9-ALIGN-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhóm hành động phụ không dựng khối bọc dọc

### Các bước kiểm thử
- [ ] Kết xuất khung lọc; đọc cây phần tử; kiểm các nút là anh em ruột của hàng nút

### Kết quả mong đợi
- Không có khối xếp dọc bọc ngoài hai nút xuất

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-089

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-WRAP`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-WRAP
- Catches_bug: nhãn đổi theo trạng thái nên bề rộng không cố định

**Runner contract**:
- Coverage_ids: `COV-R9-WRAP-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhãn dài khi có thay đổi chưa áp dụng cũng không tràn

### Các bước kiểm thử
- [ ] Đổi một bộ lọc để nhãn nút dài ra; đo lại hộp bao ở bề rộng hẹp

### Kết quả mong đợi
- Vẫn nằm trọn trong khung

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-119

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-QUAN-TRI`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R1-VALUE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R1-VALUE
- Catches_bug: một cột đọc đúng khi đứng một mình nhưng lệch hàng khi kết hợp

**Runner contract**:
- Coverage_ids: `COV-PAIR-1`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Kết cặp nguồn đơn x loại thông tin x trạng thái trên tệp xuất

### Các bước kiểm thử
- [ ] Dựng bộ hồ sơ phủ kết cặp ba thuộc tính; xuất tệp; đọc ba cột tương ứng

### Kết quả mong đợi
- Mỗi hồ sơ ra đúng bộ ba giá trị của nó

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-121

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R8-LABEL`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R8-LABEL
- Catches_bug: Nielsen 2: ngôn ngữ của hệ thống phải là ngôn ngữ của người dùng

**Runner contract**:
- Coverage_ids: `COV-UX-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nhãn nút dùng từ nghiệp vụ, không dùng từ kỹ thuật

### Các bước kiểm thử
- [ ] Đọc nhãn hai nút và dòng đếm

### Kết quả mong đợi
- Không có từ kỹ thuật như trường, bản ghi, truy vấn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-123

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-ICON`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-ICON
- Catches_bug: Nielsen 4: mỗi màn một kiểu thì học một lần không dùng được chỗ khác

**Runner contract**:
- Coverage_ids: `COV-UX-4`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Nút sửa nhanh nhất quán với chỗ sửa khác trong hệ

### Các bước kiểm thử
- [ ] So biểu tượng và màu nút sửa nhanh với nút sửa ở các màn khác

### Kết quả mong đợi
- Cùng biểu tượng và cùng quy ước màu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-128

**Meta**:
- Loại: `UX`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA-NHANH`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R2-SAVE`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R2-SAVE
- Catches_bug: thiếu trạng thái khoá làm bấm Lưu hai lần sinh hai bản ghi

**Runner contract**:
- Coverage_ids: `COV-UX-9`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Popup có đủ trạng thái tải, rỗng, lỗi, khoá

### Các bước kiểm thử
- [ ] Lần lượt dựng bốn trạng thái của popup

### Kết quả mong đợi
- Mỗi trạng thái hiện khác nhau và đọc hiểu được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Refer to source code structure cho module này

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-130

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-SUA`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R4-COPY`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R4-COPY
- Catches_bug: chép rỗng buộc gõ lại toàn bộ, đúng thứ WCAG 2.2 mới đưa vào chuẩn

**Runner contract**:
- Coverage_ids: `COV-A11Y-2`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Không đòi nhập lại thông tin vừa nhập

### Các bước kiểm thử
- [ ] Tạo đơn mới từ đơn cũ; kiểm các ô đã có dữ liệu ở đơn nguồn

### Kết quả mong đợi
- Không ô nào bắt gõ lại thứ đã có (WCAG 2.2 — 3.3.7)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-134

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: ``
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `S4` 
- Platform: `web`
- Persona: `P-CAN-BO`
- Journey_ref: `J-DON-THU-XUAT`

**Oracle**:
- Oracle_type: `Claim`
- Rule_ref: `R9-ALIGN`
- Oracle_source: docs/uat/dot-2309/_domain-pack.md §R9-ALIGN
- Catches_bug: đổi bố cục hàng nút dễ làm thứ tự tiêu điểm nhảy cóc

**Runner contract**:
- Coverage_ids: `COV-A11Y-6`
- Backend_policy: `live`
- Evidence_required: `trace`, `screenshot-final`

**Tiêu đề**: Thứ tự tiêu điểm theo thứ tự đọc

### Các bước kiểm thử
- [ ] Gõ Tab qua khung Bộ lọc; ghi lại thứ tự dừng

### Kết quả mong đợi
- Thứ tự trùng thứ tự nhìn thấy từ trái sang phải (WCAG 2.4.3)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: S4
module: 
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## 🐛 Bug Reports (Claude Code điền khi fix bug)

> Mỗi bug được phát hiện sẽ thêm 1 block ở đây. Reference TC bằng ID.

> Template (copy + fill):


````markdown
### BUG-XXX

- **TC**: TC-XXX
- **Severity**: Critical | High | Medium | Low
- **Status**: Open | Fixing | Fixed | Verified | Closed | Reopened
- **Phát hiện**: DD/MM/YYYY
- **Module**: module name

**Reproduce**:
1. step 1
2. step 2

**Expected**: ...
**Actual**: ...

**Root cause**:
> Phân tích nguyên nhân gốc bởi Claude Code

**Fix**:
- [ ] File: `path/to/file.ts` line X-Y — thay đổi: ...
- [ ] Add test case mới nếu cần
- [ ] Update doc nếu cần

**Verify**: chạy lại TC-XXX → đặt Status = Verified
````

## ✅ Execution Checklist

> Claude Code tick khi hoàn thành từng TC. Mỗi line là 1 trạng thái có thể chuyển đổi.

- [ ] **TC-001** [P0] Tệp mọi trường chứa ô chỉ có trên form, không có trên bảng
- [ ] **TC-002** [P0] Số cột tệp mọi trường đếm được đúng 42
- [ ] **TC-005** [P0] Cột rỗng sạch không có trong tệp
- [ ] **TC-014** [P0] Ba cột định danh stt, sttCu, status đều có mặt
- [ ] **TC-015** [P0] Từng ô trong tệp khớp dữ liệu nguồn, đối chiếu theo hồ sơ
- [ ] **TC-016** [P0] Tập 42 cột khớp ĐÚNG bộ cột chuẩn, không chỉ đúng số lượng
- [ ] **TC-019** [P0] Cột đã cắt mà có dữ liệu thì phép đo báo ĐỎ
- [ ] **TC-023** [P0] Ô RỖNG hiện nút có cả biểu tượng và nhãn chữ
- [ ] **TC-024** [P0] Bấm nút ở ô rỗng mở popup nhập
- [ ] **TC-025** [P0] Ô ĐÃ CÓ chữ vẫn có nút sửa nhanh
- [ ] **TC-026** [P0] Bấm nút ở ô có chữ mở popup mang sẵn giá trị cũ
- [ ] **TC-027** [P0] Sửa giá trị cũ rồi lưu thì giá trị mới thay thế
- [ ] **TC-028** [P0] Bấm vào CHỮ mở hồ sơ, KHÔNG mở popup
- [ ] **TC-032** [P0] Trên BẢNG THẬT, Enter ở nút mở popup mà không chuyển sang hồ sơ
- [ ] **TC-035** [P0] Tải tệp lên từ ngay trong danh sách
- [ ] **TC-036** [P0] Tải tệp xuống từ ngay trong danh sách
- [ ] **TC-041** [P0] Lưu hỏng thì báo lỗi và KHÔNG mất chữ đã gõ
- [ ] **TC-044** [P0] Danh mục loại thông tin có mục để chọn
- [ ] **TC-046** [P0] Máy chủ trả THÀNH CÔNG với danh sách rỗng thì nói rõ là danh mục chưa có mục
- [ ] **TC-051** [P0] Đơn mới KHÔNG mang STT của đơn cũ
- [ ] **TC-052** [P0] Đơn mới KHÔNG mang kết quả xử lý của đơn cũ
- [ ] **TC-053** [P0] Mọi tuyến form đều được gắn khoá dựng lại theo hồ sơ
- [ ] **TC-054** [P0] Đi hồ sơ A rồi tạo mới rồi sang hồ sơ B không dính trạng thái
- [ ] **TC-055** [P0] Lưu thì ra một hồ sơ MỚI
- [ ] **TC-056** [P0] Đơn cũ không đổi sau khi lưu đơn mới
- [ ] **TC-062** [P0] Danh mục loại tài liệu có mục sau khi deploy
- [ ] **TC-065** [P0] Hồ sơ cũ có giá trị khác thì GIỮ, không đè Không
- [ ] **TC-067** [P0] Mở hồ sơ cũ, KHÔNG sửa gì, Lưu: ô đã ẩn đi nguyên vẹn
- [ ] **TC-068** [P0] Sửa một ô KHÁC rồi Lưu: ô đã ẩn vẫn nguyên
- [ ] **TC-069** [P0] Gieo lỗi: gửi RỖNG đè lên ô đã ẩn thì cổng phải ĐỎ
- [ ] **TC-076** [P0] Gõ tên CHƯA CÓ rồi bấm Lưu NGAY thì tên được ghi
- [ ] **TC-078** [P0] Gợi ý chỉ lấy hồ sơ trong phạm vi người đăng nhập
- [ ] **TC-079** [P0] Cán bộ tổ khác không thấy tên ngoài phạm vi
- [ ] **TC-091** [P0] Mở hồ sơ DI TRÚ thì không ô nào biến mất
- [ ] **TC-092** [P0] Hồ sơ DI TRÚ không báo lỗi giả ở ngày viết đơn
- [ ] **TC-095** [P0] Tạo đơn thư bình thường vẫn thành công
- [ ] **TC-096** [P0] Mọi khoá form gửi lên đều được máy chủ khai nhận
- [ ] **TC-097** [P0] Cán bộ (không phải quản trị) lưu được đơn
- [ ] **TC-099** [P0] Máy chủ báo mã bản dựng khớp commit đã hợp nhất
- [ ] **TC-100** [P0] Cán bộ tổ khác không thấy hồ sơ ngoài phạm vi
- [ ] **TC-101** [P0] Tệp xuất cũng lọc theo phạm vi dữ liệu
- [ ] **TC-102** [P0] Tệp của nút ĐANG XEM cũng lọc theo phạm vi dữ liệu
- [ ] **TC-103** [P0] Thiếu quyền xuất đầy đủ thì bị từ chối
- [ ] **TC-104** [P0] Sửa nhanh hồ sơ ngoài phạm vi bị chặn
- [ ] **TC-105** [P0] Vai vô danh không gọi được đường xuất
- [ ] **TC-109** [P0] Lưu xong rồi mở dòng KHÁC không mang giá trị dòng trước
- [ ] **TC-125** [P0] Trạng thái rỗng của bảng phân biệt với tải hỏng
- [ ] **TC-136** [P0] Chạy đúng trên Chrome
- [ ] **TC-139** [P0] Sau deploy, đường kiểm tra sức khoẻ trả mã bản dựng đúng
- [ ] **TC-140** [P0] Seed chạy trong deploy và deploy ĐỎ nếu seed hỏng
- [ ] **TC-003** [P1] Ô nằm trong nhóm GẬP trên form vẫn được xuất
- [ ] **TC-004** [P1] Cột thuộc nhóm gập mà CÓ dữ liệu thì thật sự xuất hiện trong tệp
- [ ] **TC-006** [P1] 88 khoá metadata rỗng sạch đã bị cắt
- [ ] **TC-007** [P1] 3 cột riêng rỗng sạch đã bị cắt
- [ ] **TC-008** [P1] Rỗng kiểu NULL được tính là rỗng
- [ ] **TC-009** [P1] Rỗng kiểu chuỗi trắng được tính là rỗng
- [ ] **TC-010** [P1] Rỗng kiểu mảng rỗng được tính là rỗng
- [ ] **TC-011** [P1] Rỗng kiểu JSON null được tính là rỗng
- [ ] **TC-012** [P1] Hai lần xuất liên tiếp cho cùng bộ cột
- [ ] **TC-013** [P1] Bộ cột KHÔNG đo lại lúc xuất
- [ ] **TC-017** [P1] Khoá lưu đọc đúng cho cột riêng
- [ ] **TC-018** [P1] Khoá lưu đọc đúng cho khoá metadata
- [ ] **TC-021** [P1] Xuất đúng trần 5.000 dòng
- [ ] **TC-022** [P1] Quá trần thì cắt còn 5.000 và nói rõ đã cắt
- [ ] **TC-030** [P1] Thành phần nút chặn lan sự kiện chuột trong khung dựng thử
- [ ] **TC-031** [P1] Thành phần nút chặn lan sự kiện bàn phím trong khung dựng thử
- [ ] **TC-034** [P1] Vùng chạm của nút đạt tối thiểu WCAG 2.2
- [ ] **TC-037** [P1] Tên tệp tải về theo máy chủ, không bị ép tên
- [ ] **TC-038** [P1] Nhãn đọc được nói rõ sửa ô nào của hồ sơ nào
- [ ] **TC-039** [P1] Tới được nút bằng phím Tab
- [ ] **TC-040** [P1] Lưu xong bảng cập nhật ngay, không cần tải lại
- [ ] **TC-042** [P1] Cột Loại thông tin đứng ngay trước Nguồn đơn/Đơn vị giao
- [ ] **TC-045** [P1] Máy chủ trả LỖI thì ô báo tải hỏng
- [ ] **TC-047** [P1] Cột Loại thông tin có trong tệp xuất
- [ ] **TC-048** [P1] Nút hiện khi đang SỬA hồ sơ
- [ ] **TC-050** [P1] Đơn mới mang theo nội dung đơn cũ
- [ ] **TC-057** [P1] Khu tải tệp nằm cạnh ô Kết quả xử lý
- [ ] **TC-058** [P1] Tệp tải ở khu này mang đúng loại của khu
- [ ] **TC-059** [P1] Loại KHÔNG rơi về Văn bản
- [ ] **TC-063** [P1] Seed lần đầu TẠO ĐỦ mục, lần hai giữ nguyên định danh và nội dung
- [ ] **TC-064** [P1] Màn tạo mới: ô báo cáo Ban Giám đốc đã là Không
- [ ] **TC-070** [P1] Gõ 2 ký tự trở lên thì hiện tên đã có trong dữ liệu
- [ ] **TC-071** [P1] Khớp GIỮA chuỗi, không chỉ khớp đầu chuỗi
- [ ] **TC-072** [P1] Ký tự đặc biệt của mẫu tìm được thoát đúng
- [ ] **TC-077** [P1] Gõ rồi rời ô rồi quay lại, chữ còn nguyên
- [ ] **TC-080** [P1] Hai nút có nhãn phân biệt được
- [ ] **TC-081** [P1] Nhãn nói rõ nút nào xuất đúng cột đang xem
- [ ] **TC-082** [P1] Tiêu đề trong tệp nút đang xem là DANH SÁCH ĐƠN THƯ
- [ ] **TC-083** [P1] Tiêu đề trong tệp nút mọi trường là DANH SÁCH ĐƠN THƯ
- [ ] **TC-084** [P1] Không còn hậu tố ĐẦY ĐỦ TRƯỜNG
- [ ] **TC-086** [P1] Bốn nút và dòng đếm nằm cùng một đường căn
- [ ] **TC-088** [P1] Màn hẹp thì hàng nút xuống dòng, không tràn
- [ ] **TC-090** [P1] Nút đang báo LỖI không làm lệch hàng
- [ ] **TC-093** [P1] Nút đang xem xuất đúng cột đang nhìn
- [ ] **TC-094** [P1] Nút đang xem KHÔNG cắt cột theo dữ liệu
- [ ] **TC-098** [P1] Cán bộ xuất được tệp mọi trường
- [ ] **TC-106** [P1] Tệp ngoài danh sách loại cho phép bị từ chối
- [ ] **TC-107** [P1] Tên tệp chứa ký tự đường dẫn bị vô hiệu hoá
- [ ] **TC-108** [P1] Đóng popup rồi mở lại thì lấy giá trị từ máy chủ
- [ ] **TC-110** [P1] Hai tab cùng mở, tab A sửa nhanh, tab B tải lại thấy đúng
- [ ] **TC-111** [P1] Nút xuất: có bộ lọc, có quyền xuất đầy đủ
- [ ] **TC-112** [P1] Nút xuất: có bộ lọc, không quyền xuất đầy đủ
- [ ] **TC-113** [P1] Nút xuất: không bộ lọc, có quyền xuất đầy đủ
- [ ] **TC-114** [P1] Nút xuất: không bộ lọc, không quyền xuất đầy đủ
- [ ] **TC-115** [P1] Sửa nhanh: ô rỗng, có quyền sửa
- [ ] **TC-116** [P1] Sửa nhanh: ô có chữ, có quyền sửa
- [ ] **TC-117** [P1] Sửa nhanh: ô rỗng, không quyền sửa
- [ ] **TC-118** [P1] Sửa nhanh: ô có chữ, không quyền sửa
- [ ] **TC-120** [P1] Đang xuất thì nút cho biết hệ đang chạy
- [ ] **TC-122** [P1] Popup sửa nhanh có lối thoát rõ ràng
- [ ] **TC-124** [P1] Vượt trần xuất thì báo trước, không để tải xong mới hỏng
- [ ] **TC-126** [P1] Thông báo lỗi nói được cách khắc phục
- [ ] **TC-127** [P1] Sửa từ bảng ít thao tác hơn mở hồ sơ
- [ ] **TC-129** [P1] Tiêu điểm không bị che khi cuộn bảng
- [ ] **TC-131** [P1] Tương phản chữ trên nút đạt mức AA
- [ ] **TC-132** [P1] Mọi nút có tên đọc được
- [ ] **TC-133** [P1] Popup giữ tiêu điểm đúng cách và Esc thoát được
- [ ] **TC-135** [P1] Quét tự động không còn lỗi mức A/AA
- [ ] **TC-137** [P1] Chạy đúng trên Edge Chromium
- [ ] **TC-138** [P1] Bố cục đúng ở màn 1366x768
- [ ] **TC-020** [P2] Phép đo trong deploy chỉ cảnh báo, không chặn deploy
- [ ] **TC-029** [P2] Ô rỗng thì nút chính là nội dung ô
- [ ] **TC-033** [P2] Biểu tượng là bút, cùng biểu tượng sửa của hệ
- [ ] **TC-043** [P2] Thứ tự cột giữ nguyên sau khi tải lại trang
- [ ] **TC-049** [P2] Nút KHÔNG hiện khi đang tạo mới
- [ ] **TC-060** [P2] Hai khu tải tệp phân biệt được trên màn hình
- [ ] **TC-061** [P2] Hai khu có định danh kiểm thử riêng
- [ ] **TC-066** [P2] Ô Đồ vật, tài liệu kèm theo không còn trên form
- [ ] **TC-073** [P2] Một ký tự thì CHƯA gợi ý
- [ ] **TC-074** [P2] Hai ký tự thì CÓ gợi ý
- [ ] **TC-075** [P2] Nhiều kết quả thì cắt còn tối đa 10
- [ ] **TC-085** [P2] Một hằng số tiêu đề dùng cho cả hai đường xuất
- [ ] **TC-087** [P2] Nhóm hành động phụ không dựng khối bọc dọc
- [ ] **TC-089** [P2] Nhãn dài khi có thay đổi chưa áp dụng cũng không tràn
- [ ] **TC-119** [P2] Kết cặp nguồn đơn x loại thông tin x trạng thái trên tệp xuất
- [ ] **TC-121** [P2] Nhãn nút dùng từ nghiệp vụ, không dùng từ kỹ thuật
- [ ] **TC-123** [P2] Nút sửa nhanh nhất quán với chỗ sửa khác trong hệ
- [ ] **TC-128** [P2] Popup có đủ trạng thái tải, rỗng, lỗi, khoá
- [ ] **TC-130** [P2] Không đòi nhập lại thông tin vừa nhập
- [ ] **TC-134** [P2] Thứ tự tiêu điểm theo thứ tự đọc

---

_Generated by `uat-test-writer` skill on 23/09/2026 11:48_