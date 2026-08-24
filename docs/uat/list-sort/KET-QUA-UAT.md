# Kết quả UAT — v0.72.0.0 sắp xếp danh sách mới→cũ

**Ngày chạy:** 2026-08-24 · **Môi trường:** bản chạy thật `new.pc02hcm.com` với dữ liệu
thật (45.459 đơn thư · 4.713 vụ việc · 3.304 vụ án) · **Vai:** quản trị viên
· **Toàn bộ ca kiểm CHỈ ĐỌC** — không tạo/sửa/xoá hồ sơ nào.

**Nguồn chân lý:** `_plan-scope.md` — lấy từ kế hoạch đã duyệt + CHANGELOG (lời hứa với
người dùng). **Không lấy kết quả mong đợi từ mã nguồn.**

## Tổng kết

| Lớp | Ca chạy | Đạt | Không đạt |
|---|---|---|---|
| API trên bản chạy thật | 23 | **23** | 0 |
| Giao diện E2E (Chromium, bản chạy thật) | 8 | **8** | 0 |
| **Tổng đã EXECUTE** | **31** | **31** | **0** |

**Độ phủ:** 59/60 hạng mục = **98,3%**. Một hạng mục GAP có lý do (di động — xem dưới).
Sàn tối thiểu `TC_min = MAX(55, 18, 14, 50) = 55`; số hạng mục phủ 59 ≥ 55 ✅.

## Hiệu lực — gieo lỗi để chứng minh ca kiểm không phải đồ trang trí

Xanh chưa chứng minh gì. Ba phép gieo lỗi trên bản chạy thật:

| Lỗi gieo | Ca kiểm bắt được? | Bằng chứng |
|---|---|---|
| Hệ thống sắp theo **ngày tạo** (hành vi CŨ) | ✅ **TC-001 đỏ** | Gọi `sortBy=createdAt` → dãy ngày nhận lộn xộn, khẳng định giảm dần thất bại |
| Bỏ cột sinh, sắp theo **cột ngày gốc** | ✅ **TC-009 đỏ** (chứng minh ở tầng CSDL) | `ORDER BY "receivedDate" DESC` → 5 hồ sơ đầu là **năm 3023, 2925, 2205, 2205, 2203**. Với cột sinh: sạch |
| Gửi tham số để **lách** lớp bảo vệ | ✅ không lách được | `sortBy=receivedDate` và `sortBy=sortReceivedDate` đều cho kết quả an toàn — lớp nắn tên nằm ở máy chủ, client không vượt qua được |

**Ghi chú phương pháp đáng nói:** phép gieo lỗi thứ ba lộ ra một điều về chính bộ ca kiểm.
Vì tên trường được nắn ở máy chủ, **không có đầu vào nào từ phía client làm TC-009 đỏ** —
nghĩa là nếu chỉ kiểm qua API thì TC-009 sẽ luôn xanh kể cả khi lớp bảo vệ bị gỡ. Bằng
chứng hiệu lực của nó phải lấy ở **tầng CSDL**, và đã lấy. Đây đúng loại "ca kiểm xanh mà
không chứng minh gì" mà quy trình cảnh báo.

## Đã chứng minh đúng trên bản chạy thật

| Điều được xác nhận | Bằng chứng |
|---|---|
| Ba danh sách đều mới→cũ theo ngày tiếp nhận | TC-001/002/003 — dãy ngày giảm dần trên 50 hồ sơ đầu mỗi loại |
| Hồ sơ **không có ngày** nằm cuối, cả hai chiều | TC-006/007/008 |
| Hồ sơ **ngày phi lý** không còn ở màn hình đầu | TC-009 — 0/20 hồ sơ đầu ngoài khoảng 1900–2100 |
| Hồ sơ ngày phi lý **vẫn truy cập được**, chỉ bị đẩy cuối | TC-010 — không giấu, không xoá |
| Phân trang ổn định | TC-030/031/032 — 0 hồ sơ trùng giữa hai trang; hai lần gọi giống hệt cho cùng thứ tự |
| Tham số rác không gây lỗi máy chủ | TC-038/039 — `xyz`, `DESC; DROP TABLE`, rỗng đều < 500 |
| Không lộ cột nội bộ, không tiêm được | TC-040/041/042 |
| Sắp + lọc + tìm kiếm cộng hưởng | TC-045/046 |
| Bấm cột đổi thứ tự thật (không chỉ đổi địa chỉ) | TC-051 E2E — danh sách sau khi đảo chiều KHÁC lúc đầu |
| Trình đọc màn hình biết trạng thái sắp | TC-023 E2E — `aria-sort` = descending → ascending |
| Cột "Thao tác" không bấm được | TC-022 E2E |
| Tải lại trang giữ nguyên thứ tự | TC-025/026 E2E |
| Mở đường dẫn chia sẻ ra đúng thứ tự | TC-027 E2E |
| Ba màn hình đủ hai cột ngày | TC-034 E2E + TC-037 API |

## Phát hiện

**Không có lỗi chức năng mức nghiêm trọng.** Theo thước đo sức khoẻ quy trình, đó là dấu
hiệu tốt: UAT không nên là lần kiểm hệ thống thứ hai. Ba lỗi thật của đợt này đã bị bắt
**trước** UAT — hai do em tự rà, một do `/review` — nên đến UAT thì không còn.

### F-01 · Mức S3 · Ứng dụng di động thừa hưởng thứ tự mới mà chưa được kiểm chứng

`mobile/lib/core/api/petitions_api.dart` gọi `GET /petitions` **không gửi tham số sắp
xếp** → nó dùng mặc định của máy chủ. Nghĩa là **thứ tự danh sách đơn thư trên điện thoại
cũng đã đổi**, dù kế hoạch không nhắc tới nền tảng này.

Nhiều khả năng đây là thay đổi mong muốn (cùng lý do như trên web), nhưng **chưa có bằng
chứng trên thiết bị**: quy trình dựng ứng dụng di động hỏng sẵn từ 14/08 — action bị ghim
mã phiên bản không còn tồn tại, chết ở bước dựng máy trước khi chạy bất kỳ kiểm thử nào,
đỏ y hệt trên mọi nhánh.

**Đề xuất:** bỏ ghim hoặc cập nhật `subosito/flutter-action` rồi chạy lại Maestro cho màn
danh sách đơn thư. Rủi ro thấp (cùng endpoint, cùng dữ liệu), nhưng nên xác nhận.

### F-02 · Mức S3 · Ba hồ sơ ngày tương lai vẫn ở đầu danh sách

`2026-3696` (19/03/2029) · `2026-8810` (29/09/2026) · `2025-6234` (25/08/2026).

Nằm trong khoảng hợp lý 1900–2100 nên lớp bảo vệ không đẩy chúng xuống. Chúng **có dấu
cảnh báo** trên màn hình. Biểu mẫu đã chặn ngày tương lai ở cả tạo lẫn sửa (quy tắc DOM-1),
nên đây là di sản di trú, không sinh thêm.

**Đây là việc của người, không phải của máy:** sửa đúng ngày cần đối chiếu hồ sơ gốc.

### F-03 · Mức S4 · Cột "Ngày tạo" hiển thị cùng một giá trị cho gần như mọi dòng

Hệ quả trực tiếp của dữ liệu di trú (một ngày chuyển dữ liệu duy nhất), không phải lỗi
hiển thị. Đã có chú giải khi rê chuột. Ghi nhận để không ai báo nhầm là lỗi.

## Đánh giá trải nghiệm (Nielsen + WCAG 2.2)

| Tiêu chí | Kết quả |
|---|---|
| #1 Hiện trạng hệ thống | ✅ mũi tên chỉ rõ cột nào đang sắp, chiều nào |
| #6 Nhận ra thay vì phải nhớ | ✅ cột bấm được có mũi tên mờ sẵn |
| #9 Giúp nhận ra và khắc phục lỗi | ✅ ngày phi lý có biểu tượng + chú thích "cần rà lại hồ sơ gốc" |
| #10 Trợ giúp | ✅ cột "Ngày tạo" có chú giải giải thích vì sao trùng nhau |
| WCAG 4.1.2 Name/Role/Value | ✅ `aria-sort` đúng ba trạng thái (TC-023) |
| WCAG 2.1.1 Bàn phím | ✅ tiêu đề là `<button>` thật nên tới được bằng Tab |

## Đề xuất: **GO**

Đủ điều kiện ra bản: 31/31 ca đã chạy thật đều đạt · độ phủ 98,3% · 0 lỗi chức năng
nghiêm trọng · hiệu lực ca kiểm đã chứng minh bằng gieo lỗi · hai phát hiện còn lại đều
mức S3 có đường xử lý rõ và không chặn người dùng.

⚠️ **Việc phê duyệt là của người có thẩm quyền.** Đây là đề xuất kèm bằng chứng, không
phải chữ ký.
