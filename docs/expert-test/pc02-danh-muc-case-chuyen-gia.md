# PC02 — Danh mục case kiểm thử tầng chuyên gia

> Đầu vào cho `expert-test-runner`. Đây là DANH MỤC CASE, không phải mã, không phải kết luận.
> Lập 29/08/2026 · chế độ SYSTEM-WIDE · nguồn: mã nguồn + phép đo trên máy thật cùng ngày.

**Stack:** NestJS + Prisma 7 + PostgreSQL (jest) · React + Vite (vitest) · Playwright (API + E2E).
**Domain:** quản lý vụ án / vụ việc / đơn thư theo BLTTHS 2015 + TT28/2020/TT-BCA + TT 128/2025.
**Quy mô thật:** 46.499 đơn thư · 4.718 vụ việc · 1.690 vụ án · 238 cán bộ · 31 mẫu chứng từ.

---

## W1. Mô hình rủi ro & bất biến/oracle

| # | Vùng rủi ro | Mức | Bất biến / oracle phải đúng | Lớp |
|---|---|---|---|---|
| R1 | Bộ đếm số văn bản | **Cao** | Cấp số là **đơn điệu tăng, không trùng, không thủng**; số đã cấp không bao giờ tái sử dụng; đổi năm thì reset đúng quy ước `năm-stt` | 1,4,7 |
| R2 | Cấp số khi in hỏng | **Cao** | Thao tác in **thất bại KHÔNG được đốt số**; retry không sinh số mới nếu lần trước chưa phát hành | 6 |
| R3 | Máy tính thời hạn tố tụng | **Cao** | Hạn = mốc + thời hạn luật định (Đ.147/148/149); gia hạn chỉ đẩy hạn **ra xa**, không bao giờ kéo vào; ngày lễ/cuối tuần xử lý nhất quán | 4,7 |
| R4 | Bản đồ chuyển trạng thái | **Cao** | Chỉ đi được theo cạnh hợp lệ của BLTTHS; **mọi** cạnh ngoài bản đồ bị chặn ở tầng service, không chỉ ở giao diện | 7 |
| R5 | Phạm vi dữ liệu (DataScope) | **Cao** | Cán bộ tổ A **không đọc, không sửa, không xoá, không đếm thấy** hồ sơ tổ B — trên cả 12 resource, kể cả resource con | 3,8 |
| R6 | Kết xuất mẫu chứng từ | **Cao** | Mọi placeholder trong tệp .docx phải khai trong `variables` và ngược lại; giá trị in ra khớp giá trị trong CSDL | 2,7 |
| R7 | Di trú dữ liệu hệ cũ | **Cao** | Σ bản ghi hệ cũ == Σ đã nhập + Σ bị loại **có lý do ghi rõ**; chạy lại không nhân đôi | 1,6 |
| R8 | Vòng đời mẫu chứng từ | TB | Mẫu `draft`/`archived` **không bao giờ** lọt vào popup in của cán bộ | 3,8 |
| R9 | Chỉ tiêu KPI (TT28) | TB | 4 công thức đúng chuẩn; Σ theo tổ == tổng toàn đơn vị; 0 hồ sơ không sinh chia-cho-0 | 1,5,7 |
| R10 | Xuất hàng loạt / ZIP | TB | Số tệp trong ZIP == Σ hồ sơ chọn × Σ mẫu chọn; không tệp rỗng; tên tệp không đụng nhau | 1 |
| R11 | Lưu → đọc lại biểu mẫu | **Cao** | Round-trip: lưu giá trị V rồi mở lại phải ra **đúng** V — kể cả V rỗng (xoá phải có tác dụng) | 2 |
| R12 | Phân trang & lọc | TB | Trang n+1 không lặp/không thủng bản ghi của trang n; Σ theo từng trạng thái == tổng không lọc | 1,4 |
| R13 | Xác thực & khoá tài khoản | **Cao** | Khoá sau 5 lần sai; thông báo **không lộ** tài khoản có tồn tại hay không; mở khoá xoá cả bộ đếm lẫn mốc | 8 |
| R14 | Tải mẫu .docx (đầu vào ngoài) | **Cao** | Tệp méo/độc (XXE, zip-bomb, .docx giả) không làm sập tiến trình, lỗi có kiểm soát | 8 |
| R15 | Thiết lập cá nhân (in, bố cục cột) | TB | Lựa chọn của người A **không rò** sang người B, kể cả khi đổi tài khoản trên cùng trình duyệt | 3,8 |
| R16 | **Phản hồi khi GHI thất bại** | **Cao** | Máy chủ từ chối ⇒ giao diện **không được** thể hiện như đã lưu (không đóng popup, không chèn bản ghi giả, không báo thành công) | 2 |
| R17 | **Phân biệt tải hỏng vs rỗng** | **Cao** | Tải hỏng ⇒ màn hình phải **khác** màn hình "không có dữ liệu"; không hiện con số nào như một câu trả lời | 2 |
| R18 | Cô lập tenant/đơn vị trong thống kê | TB | Roll-up theo tổ/phường không trộn giữa các đơn vị | 3 |
| R19 | Thông báo (SSE + push) | TB | Không gửi nhầm người; nội dung nhạy cảm không lọt vào bộ đệm dùng chung | 3,8 |
| R20 | Bất biến lịch sử | TB | Hồ sơ đã kết thúc: số liệu quá khứ và bản in đã phát hành **không đổi** khi danh mục/mẫu đổi | 7 |

**Lớp N/A:** không có lớp nào N/A — cả 8 lớp đều có ít nhất một bất biến.

---

## W2. Bản đồ phương pháp

| Vùng | Phương pháp chính | Phương pháp phụ | Lý do |
|---|---|---|---|
| R1 Bộ đếm số | property-based | stateful, performance (đồng thời) | bất biến rõ, miền input rộng, có tranh chấp đồng thời |
| R2 Cấp số khi in hỏng | stateful | property | phụ thuộc chuỗi hành động và điểm hỏng |
| R3 Thời hạn | property-based | metamorphic (scale ngày), golden-master | có công thức luật định |
| R4 Transition map | model-based/stateful | property | đúng định nghĩa state machine |
| R5 DataScope | security/pentest | property | ma trận role × resource × thao tác |
| R6 Kết xuất mẫu | golden-master | differential (so hệ cũ), property | có nguồn chuẩn: bản in hệ cũ |
| R7 Di trú | differential | property (bảo toàn), golden-master | có hệ tham chiếu Mongo |
| R8 Vòng đời mẫu | stateful | security | state machine + rò rỉ |
| R9 KPI | metamorphic | property | không có oracle tuyệt đối, nhưng có quan hệ |
| R10 ZIP | property | fuzzing (tên tệp) | bảo toàn số lượng |
| R11 Round-trip | property | metamorphic | encode∘decode == id |
| R12 Phân trang | property | metamorphic (tách/gộp) | bảo toàn + không lặp |
| R13 Xác thực | security | stateful | vòng đời khoá/mở |
| R14 Tải .docx | fuzzing | security | đầu vào ngoài |
| R15 Thiết lập cá nhân | security (cô lập) | property | rò rỉ giữa tài khoản |
| R16/R17 Phản hồi & phân biệt | property (trên toàn bộ màn) | fuzzing (chèn lỗi mạng) | đã đo thấy lớp lỗi này tồn tại thật |
| R18 Roll-up | metamorphic | property | cộng tính |
| R19 Thông báo | security | stateful | |
| R20 Lịch sử | golden-master | property | |
| **Toàn bộ** | **mutation testing** | — | 274 tệp ca kiểm hiện có: phải đo xem chúng có bắt được bug không |

---

## W3. Danh mục case

### W3.1 Property-based

| ID | Hàm/đối tượng | Miền input | BẤT BIẾN phải giữ |
|---|---|---|---|
| PB-01 | cấp số văn bản | chuỗi N lần cấp, N∈[1,10⁴] | dãy số **đơn điệu tăng ngặt**, không trùng |
| PB-02 | cấp số văn bản | N lần cấp | không có lỗ hổng: max − min + 1 == N |
| PB-03 | cấp số văn bản | mốc thời gian rải qua 31/12 → 01/01 | đổi năm thì phần `stt` reset, phần `năm` tăng đúng 1 |
| PB-04 | cấp số văn bản | đồng thời K tiến trình, K∈[2,50] | không hai tiến trình nào nhận cùng một số |
| PB-05 | tính thời hạn | mốc bất kỳ, thời hạn ∈[1,365] ngày | hạn > mốc luôn đúng |
| PB-06 | tính thời hạn | gia hạn G≥0 | hạn(G) ≥ hạn(0); đơn điệu không giảm theo G |
| PB-07 | tính thời hạn | G = 0 | hạn(0) == hạn gốc (không lệch một ngày) |
| PB-08 | tính thời hạn | mốc rơi vào 29/02, 31/12, đầu/cuối tháng | không sinh ngày không tồn tại |
| PB-09 | round-trip biểu mẫu | mọi field trong `field-parity.def.ts` | đọc(lưu(V)) == V |
| PB-10 | round-trip biểu mẫu | V = chuỗi rỗng / null | xoá có tác dụng: đọc lại vẫn rỗng, KHÔNG quay về giá trị cũ |
| PB-11 | round-trip biểu mẫu | V = ngày hợp lệ bất kỳ | không lệch múi giờ; không rơi về 1970 |
| PB-12 | phân trang | tổng T∈[0,10⁵], cỡ trang P∈[1,200] | hợp mọi trang == đúng T bản ghi, không lặp |
| PB-13 | phân trang | mọi P | không bản ghi nào xuất hiện ở hai trang |
| PB-14 | lọc theo trạng thái | mọi tập trạng thái | Σ đếm từng trạng thái == đếm không lọc |
| PB-15 | ZIP xuất hàng loạt | H hồ sơ × M mẫu | số tệp trong ZIP == H×M; không tệp 0 byte |
| PB-16 | ZIP xuất hàng loạt | tên hồ sơ có ký tự lạ/trùng nhau | tên tệp trong ZIP duy nhất |
| PB-17 | KPI | 0 hồ sơ | không chia cho 0; trả về "chưa có dữ liệu", không phải 0% |
| PB-18 | KPI | mọi hồ sơ đạt | đúng 100%, không 99,99% do làm tròn |
| PB-19 | ánh xạ placeholder | mọi mẫu trong CSDL | Σ placeholder trong tệp == Σ khai trong `variables` |
| PB-20 | soLieuHienThi | mọi (số, cờ hỏng) | hỏng ⇒ không bao giờ trả về chuỗi số |
| PB-21 | DataScope filter | mọi (role, tổ, resource) | tập trả về ⊆ tập được phép |
| PB-22 | mở khoá tài khoản | mọi trạng thái khoá | sau khi mở: bộ đếm == 0 **và** mốc khoá == null |

### W3.2 Metamorphic

| ID | Phép biến đổi | Quan hệ phải giữ |
|---|---|---|
| MR-01 | nhân đôi số hồ sơ mỗi trạng thái | mọi số tuyệt đối ×2, mọi tỷ lệ % **không đổi** |
| MR-02 | tách một tổ thành hai tổ con | Σ KPI hai tổ con == KPI tổ gốc |
| MR-03 | gộp hai kỳ báo cáo liền kề | Σ số liệu hai kỳ == số liệu kỳ gộp |
| MR-04 | cộng thêm k ngày vào mọi mốc | mọi hạn dịch đúng k ngày |
| MR-05 | đổi thứ tự nhập hồ sơ | KPI và thống kê không đổi |
| MR-06 | thêm một hồ sơ ngoài phạm vi tổ X | thống kê tổ X **không đổi** |
| MR-07 | in cùng hồ sơ hai lần với cùng mẫu | nội dung hai bản in giống nhau trừ số văn bản |
| MR-08 | đổi cặp dấu placeholder rồi đổi lại | tập biến dò được quay về y như cũ |
| MR-09 | lọc A rồi lọc B == lọc (A∧B) | cùng tập kết quả |
| MR-10 | thêm bản ghi rồi xoá mềm | thống kê quay về trạng thái trước |

### W3.3 Golden-master / differential

| ID | Nguồn chuẩn | Đối tượng so | Điều phải đúng |
|---|---|---|---|
| GM-01 | bản in Word hệ cũ pc02hcm.com | 11 mẫu × ≥40 hồ sơ đã di trú | 0 lệch ở mức dữ liệu |
| GM-02 | Mongo hệ cũ (chỉ đọc) | từng bản ghi đã di trú | vân tay từng trường khớp, không chỉ khớp số lượng |
| GM-03 | mẫu TT 128/2025 | 7 mẫu chứng từ đơn thư | bố cục và trường bắt buộc đúng thông tư |
| GM-04 | bản in đã phát hành trước đây | in lại chính hồ sơ ấy | nội dung không đổi dù danh mục đã đổi (R20) |
| GM-05 | công thức Đ.147/148/149 | máy tính thời hạn | khớp từng ca luật định |

### W3.4 Model-based / stateful

| ID | State machine | Điều phải đúng |
|---|---|---|
| ST-01 | 15 trạng thái vụ việc | mọi chuỗi hành động sinh ngẫu nhiên: chỉ đi được cạnh hợp lệ |
| ST-02 | 15 trạng thái vụ việc | cạnh **ngoài** bản đồ bị chặn ở **service**, không chỉ ở giao diện |
| ST-03 | 4 giai đoạn BCA (TT28) | không bỏ qua giai đoạn; quay lui chỉ ở cạnh cho phép |
| ST-04 | vòng đời mẫu: draft→active→archived | ở `draft`/`archived` **không** xuất hiện trong popup in |
| ST-05 | vòng đời mẫu | thu hồi rồi ban hành lại được (hoàn tác được) |
| ST-06 | vòng đời cấp số | chuỗi (mở form → in hỏng → in lại): **không đốt số** |
| ST-07 | vòng đời khoá tài khoản | 4 sai → đúng ⇒ bộ đếm về 0; 5 sai ⇒ khoá; hết hạn ⇒ tự mở |
| ST-08 | vòng đời đơn thư → vụ việc → vụ án | dữ liệu không mất qua mỗi lần chuyển; liên kết hai chiều đúng |
| ST-09 | xoá mềm → khôi phục | trạng thái sau khôi phục == trạng thái trước xoá |
| ST-10 | phiên đăng nhập: A đăng xuất → B đăng nhập | không dữ liệu nào của A còn thấy được (R15) |

### W3.5 Fuzzing

| ID | Đầu vào méo | Điều phải đúng |
|---|---|---|
| FZ-01 | .docx hỏng cấu trúc zip | từ chối có kiểm soát, không sập tiến trình |
| FZ-02 | .docx chứa external entity (XXE) | không đọc tệp ngoài, không gọi mạng |
| FZ-03 | zip-bomb / .docx phình cực lớn | có ngưỡng, từ chối trước khi cạn bộ nhớ |
| FZ-04 | tệp đổi đuôi thành .docx | phát hiện bằng nội dung, không bằng đuôi |
| FZ-05 | placeholder lồng nhau / không đóng | không treo vòng lặp |
| FZ-06 | Excel nhập hàng loạt: cột thiếu/thừa/đổi thứ tự | báo rõ dòng nào sai, không nhập một nửa |
| FZ-07 | chuỗi Unicode tổ hợp, emoji, RTL trong tên/địa chỉ | lưu và in ra đúng, không cắt giữa ký tự |
| FZ-08 | chuỗi cực dài (10⁵ ký tự) ở mọi ô text | có giới hạn, không tràn |
| FZ-09 | ngày dạng lạ trong dữ liệu di trú | không sinh 1970, không âm |
| FZ-10 | chèn lỗi mạng ngẫu nhiên ở mọi lời gọi ghi | giao diện không bao giờ thể hiện như đã lưu (R16) |
| FZ-11 | chèn lỗi mạng ngẫu nhiên ở mọi lời gọi đọc | màn hình phân biệt được với "không có dữ liệu" (R17) |

### W3.6 Performance / load

| ID | Kịch bản | Ngưỡng cần đo |
|---|---|---|
| PF-01 | danh sách đơn thư 46.499 bản ghi, phân trang | thời gian trang đầu và trang cuối |
| PF-02 | 50 cán bộ cùng cấp số văn bản | không trùng số, độ trễ ổn định |
| PF-03 | xuất hàng loạt 200 hồ sơ × 7 mẫu | thời gian, bộ nhớ, kích thước ZIP |
| PF-04 | KPI drill-down toàn đơn vị 12 tháng | thời gian truy vấn |
| PF-05 | di trú lại toàn bộ 46.499 hồ sơ | thời gian, không rò bộ nhớ |
| PF-06 | 238 phiên đồng thời có SSE thông báo | số kết nối giữ được, không rò |
| PF-07 | tải trang danh sách trên máy cấu hình thấp | thời gian tới lúc bấm được |

### W3.7 Security / pentest

| ID | Vector | Điều phải đúng |
|---|---|---|
| SC-01 | IDOR: đổi id trong URL/API sang hồ sơ tổ khác | 403/404, không rò tồn tại |
| SC-02 | IDOR trên **9 resource con** (bị can, luật sư, tài liệu…) | cùng mức chặn như resource cha |
| SC-03 | vượt quyền theo vai: OFFICER gọi endpoint ADMIN | chặn ở guard, không chỉ ẩn nút |
| SC-04 | đếm/thống kê rò dữ liệu ngoài phạm vi | số đếm cũng phải trong phạm vi |
| SC-05 | dò tên đăng nhập qua thông báo lỗi/thời gian phản hồi | không phân biệt được |
| SC-06 | brute-force sau khi hết 15 phút khoá | bộ đếm không tự về 0 sai cách |
| SC-07 | injection ở ô tìm kiếm/lọc | tham số hoá, không nối chuỗi |
| SC-08 | tải mẫu chứa macro/script | không thực thi |
| SC-09 | rò thiết lập cá nhân giữa hai tài khoản cùng trình duyệt | sạch sau đăng xuất |
| SC-10 | dữ liệu cá nhân lọt vào bộ đệm service worker | không cache nội dung có PII |
| SC-11 | sửa hồ sơ đã khoá/đã kết thúc | chặn ở service |
| SC-12 | tải tệp đính kèm của hồ sơ ngoài phạm vi | chặn ở tầng tệp, không chỉ ở danh sách |

### W3.8 Mutation testing

| ID | Phạm vi | Điều cần đo |
|---|---|---|
| MU-01 | máy tính thời hạn | kill rate; mutant sống = lỗ hổng ca kiểm |
| MU-02 | bộ đếm số văn bản | như trên |
| MU-03 | bản đồ chuyển trạng thái | như trên |
| MU-04 | `scope-filter.util.ts` (DataScope) | kill rate phải cao nhất hệ |
| MU-05 | máy tính KPI | như trên |
| MU-06 | `khoa-he-cu.ts` (giải giá trị khi in) | như trên |
| MU-07 | toàn bộ 274 tệp ca kiểm hiện có | tỷ lệ tổng thể + danh sách mutant sống |

---

## W4. Checklist màn hình & luồng cho RUNNER quan sát

| ID | Màn / luồng | Điểm cần soi |
|---|---|---|
| UX-S01 | `/cases`, `/vu-viec`, `/petitions` | trạng thái rỗng vs đang tải vs lỗi có phân biệt được không; định dạng ngày/số; huy hiệu trạng thái |
| UX-S02 | `/cases/new`, `/vu-viec/new`, `/petitions/new` | có phải nhập lại thứ hệ thống đã biết? thứ tự tab có theo trình tự nghiệp vụ? |
| UX-S03 | Chi tiết vụ án — tab Kết luận điều tra | lưu hỏng thì màn hình nói gì; nội dung đã gõ có mất không |
| UX-S04 | `/prosecutor-proposal` | như trên, cộng thẻ thống kê khi tải hỏng |
| UX-S05 | 26 màn đã đo là "tải hỏng == rỗng" | mỗi màn: hỏng và rỗng có nhìn khác nhau không |
| UX-S06 | Popup **In chứng từ** | số mẫu tích sẵn; nhớ lựa chọn; thông tin còn thiếu báo ở đâu |
| UX-S07 | `/settings/document-templates` | thứ tự ô trong form sửa; nút Lưu có luôn bấm được |
| UX-S08 | `/kpi` | 4 chỉ tiêu có nói rõ mẫu số; drill-down có khớp thẻ tổng |
| UX-S09 | `/nguoi-dung` | dấu hiệu tài khoản đang bị khoá; đường mở khoá |
| UX-S10 | Thanh điều hướng | mở tab mới được chưa; nhóm có báo đóng/mở |
| UX-F01 | Đơn thư → Vụ việc → Vụ án | có phải nhập lại dữ liệu đã có? số có nhảy bất ngờ? có ngõ cụt? |
| UX-F02 | Tiếp nhận → Xác minh → Kết quả → Tạm đình chỉ | mỗi bước có nói rõ hạn còn bao lâu? |
| UX-F03 | Chọn hồ sơ → In chứng từ → tải về | bao nhiêu thao tác thừa; báo tiến độ khi in nhiều |
| UX-F04 | Đăng nhập sai 5 lần → bị khoá → nhờ mở | người dùng có hiểu chuyện gì đang xảy ra không |
| UX-F05 | Nhập Excel hàng loạt → sửa lỗi → nhập lại | lỗi có chỉ đúng dòng? sửa xong có phải làm lại từ đầu? |
| UX-F06 | Mở hồ sơ **đã di trú** (không phải hồ sơ tự tạo) | trường cũ hiện ra sao; có ô nào trùng nghĩa; lưu được không |
| UX-F07 | Cán bộ tổ A cố mở hồ sơ tổ B | thông báo có dễ hiểu, có lộ thông tin không |

---

## W5. Câu hỏi cho chuyên gia domain (giả định cần anh xác nhận)

1. **Thời hạn tố tụng** — ngày cuối rơi vào thứ Bảy/Chủ nhật/ngày lễ thì đẩy sang ngày làm việc kế tiếp, hay giữ nguyên? Kho hiện chưa nói rõ.
2. **Số văn bản** — một hồ sơ in lại lần hai thì cấp số MỚI hay giữ số cũ? Ảnh hưởng trực tiếp tới PB-01/ST-06.
3. **Reset bộ đếm** — reset theo năm dương lịch hay theo năm công tác của ngành?
4. **KPI TT28** — mẫu số của "tỷ lệ giải quyết" tính trên hồ sơ **thụ lý trong kỳ** hay **tồn đầu kỳ + thụ lý trong kỳ**?
5. **Phạm vi dữ liệu** — lãnh đạo đơn vị có thấy **toàn bộ** các tổ không, hay chỉ tổ mình phụ trách?
6. **Hồ sơ đã kết thúc** — có được sửa nữa không, và ai được sửa?
7. **Bản in đã phát hành** — khi mẫu chứng từ đổi, in lại hồ sơ cũ thì dùng mẫu MỚI hay mẫu tại thời điểm phát hành?
8. **Dữ liệu di trú** — 1.268 hồ sơ có ô "Địa chỉ" chứa tên bị hại (BUG-002 còn treo): coi là dữ liệu hợp lệ hay cần dọn trước khi lấy làm chuẩn cho GM-02?
9. **Ngưỡng hiệu năng** — bao nhiêu giây là chấp nhận được cho danh sách 46.499 bản ghi trên máy của cán bộ?
10. **`/incidents` vs `/vu-viec`** — hai màn cùng nghĩa: cái nào là chuẩn để lấy làm oracle?

---

## Tự kiểm trước khi giao

- [x] Bất biến rút qua đủ **8 lớp** — không lớp nào N/A
- [x] Mỗi vùng rủi ro **Cao** đều có ≥1 phương pháp gán (R1–R7, R11, R13, R14, R16, R17)
- [x] Mỗi state machine có mục stateful (ST-01→ST-10)
- [x] Mỗi parser/đầu-vào-ngoài có mục fuzz (FZ-01→FZ-11)
- [x] Có checklist màn hình W4 cho runner đánh giá UX
- [x] Không kết luận đạt/không, không đề xuất sửa
