# Domain pack — đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)

> Nguồn chân lý của bộ UAT này. **Mọi luật lấy từ yêu cầu của anh và tệp kế hoạch đã duyệt, không lấy từ mã nguồn.**
> Mã chỉ được đọc để biết màn hình nào, route nào; hành vi mong đợi thì không.

## Nguồn

| Ký hiệu | Là gì |
|---|---|
| Yêu cầu 1, 2, 3 | Ba việc anh nêu khi mở epic: quyền theo nhóm người dùng; báo cáo động theo tiêu chí từng tổ; vòng đời tổ |
| B1–B8 | Quyết định ràng buộc của anh (nhóm = Tổ; quyền theo tổ thay vai trò; 4 cách thiết lập nhanh; không giảm phạm vi; dễ dùng; mockup; một module; tiêu chí nằm trong wizard báo cáo) |
| R1–R12 | Sổ quyết định sau `/plan-eng-review` (Claude + Codex) |
| Kế hoạch | `~/.claude/plans/t-i-m-n-h-nh-danh-twinkling-acorn.md`: Phần 0, Phần A, Phần B, mockup, nguyên tắc dễ dùng |
| Xác nhận 13/11 | Anh xác nhận nhập tiêu chí bằng cách chọn cột/ô, kèm cột mã, ĐVT và cấp cha con |
| "Tạo thì phải sửa và xoá" | Tiêu chuẩn thiết kế anh chốt 13/10 (`CLAUDE.md`) |
| Quyết định D5, D6 | Quyết định em ghi trong `PROGRESS.md` khi làm, theo chỉ thị B4 (chọn quản trị sâu nhất) |
| Rà soát Codex #662 | Phát hiện của lượt rà độc lập, đã thành luật vì chúng nói về điều người dùng thấy |

Domain được điều chỉnh bởi pháp luật tố tụng (hồ sơ vụ án, đơn thư) nhưng **đợt này không đổi nghiệp vụ tố tụng**: nó đổi AI được xem/sửa hồ sơ nào. Luật vì thế là luật phân quyền và luật báo cáo nội bộ, không có điều luật để trích.


## D1. Luật (oracle)

| Luật | Nguồn | Phát biểu |
|---|---|---|
| T1-STATES | Kế hoạch Phần 0; yêu cầu 3 của anh | Tổ có ba trạng thái Hoạt động / Tạm ngừng / Lưu trữ; chỉ người quản trị đổi được. |
| T2-OPTIONS | Yêu cầu 3; R9 | Tổ tạm ngừng hoặc lưu trữ không hiện ở BẤT KỲ ô chọn tổ nào. |
| T3-NAME-KEEP | R9 | Hồ sơ cũ vẫn hiện đúng tên tổ dù tổ đã ngừng. |
| T4-TABS | Mockup Quản trị Tổ | Màn quản trị có ba tab theo trạng thái, kèm số đếm. |
| T5-REVERSE | Tiêu chuẩn "tạo thì phải sửa và xoá" (CLAUDE.md, 13/10) | Ngừng có Hoạt động lại; Lưu trữ có Khôi phục. |
| T6-DELETE | Yêu cầu 3; R8 | Xoá thật chỉ khi tổ chưa có dữ liệu; tổ có dữ liệu thì Gộp hoặc Lưu trữ. |
| T7-DELETE-RACE | R8 | Không có kẽ hở giữa lúc xem trước và lúc xoá. |
| T8-MERGE | R5 | Gộp có xem trước, xử lý thành viên trùng, không sửa kỳ báo cáo đã sinh, tổ cũ chuyển Lưu trữ. |
| T9-UNDO | R5 | Hoàn tác gộp khôi phục bản ghi chưa bị đổi sau đó; bản ghi đã đổi thì bỏ qua và liệt kê. |
| B1-IMPORT | Yêu cầu 2; xác nhận 13/11 "chọn phạm vi" | Tiêu chí lấy từ Excel bằng cách chọn cả cột hoặc một số ô trong MỘT cột; mỗi ô chữ là một tiêu chí, theo thứ tự dòng. |
| B2-CODE-UNIT | Xác nhận 13/11 | Chỉ được cột mã và cột đơn vị tính; dòng trống dùng mặc định. |
| B3-HIER | Xác nhận 13/11 | Cấp cha con theo thụt lề hoặc đánh số; mục con cộng vào mục cha. |
| B4-PREVIEW | Xác nhận 13/11 | Xem trước có cảnh báo (trống, trùng, ô gộp, công thức, quá 2.000 dòng) và sửa được từng dòng. |
| B5-SERVER | Kế hoạch Phần B mục 2 | Máy chủ đọc lại ô từ file đã lưu; không tin phạm vi/nội dung từ trình duyệt; không để công thức nguy hiểm. |
| B6-DEFAULT-ALL | Yêu cầu 2 "mặc định chọn hết" | Tổ mới chọn mặc định phải báo mọi tiêu chí. |
| B7-PER-TEAM | B8; kế hoạch mục 2b | Bước chọn tổ là nơi cài tiêu chí từng tổ: bỏ tick, thêm tay, chép từ tổ, áp nhiều tổ, ma trận. |
| B8-ENTRY-ONLY | Yêu cầu 2; R6 | Mỗi tổ chỉ thấy tiêu chí của mình ở MỌI đường đọc; nội dung không giao bị xoá hẳn, không chỉ ẩn. |
| B9-REJECT | Kế hoạch Phần B mục 4 | Ghi vào tiêu chí không thuộc tổ bị từ chối (FIELD_NOT_ASSIGNED); bắt buộc chỉ xét tiêu chí của tổ. |
| B10-AGG | Kế hoạch Phần B mục 5 | Tổ không được giao một tiêu chí thì không được tính vào tổng, kể cả như số 0. |
| B11-COMPLETE | R7 | Độ đầy đủ = đã nhận / phải nộp; phải nộp tách khỏi đã đóng góp. |
| B12-OFFICIAL | Yêu cầu 2; kế hoạch mục 6 | Khoá sổ xong có file chính thức không hết hạn: sheet Tổng hợp, sau đó mỗi tổ một sheet chỉ có tiêu chí của tổ. |
| B13-RETRY | R12 | Lỗi tạo file thì có báo và nút Tạo lại; mở lại kỳ thì file cũ vô hiệu. |
| B14-MIDPERIOD | Kế hoạch mục 3 (D09) | Đổi tập giữa kỳ phải có lý do; bản nộp đã duyệt bị trả lại; kỳ chưa mở theo cấu hình. |
| B15-MATRIX | B3 cách thứ tư | Xuất/nhập ma trận tổ × tiêu chí bằng Excel, khứ hồi không lệch, có kiểm xung đột. |
| B16-LEGACY | Rủi ro Phần B | Báo cáo cũ (tập = tất cả) cho kết quả y hệt trước đợt này. |
| B17-NEWVERSION | Kế hoạch mục 3 | Tiêu chí mới mặc định giao mọi tổ; phiên bản mới ánh xạ theo mã ổn định. |
| A1-DEFAULT | B2 | Tổ chưa cài gì (và không tổ cha nào cài) giữ quyền hiện nay. |
| A2-INHERIT | Kế hoạch "Kế thừa" | Tổ chưa cài thì kế thừa tổ cha. |
| A3-REACH | R2; yêu cầu 1 | Bốn mức phạm vi định nghĩa chặt: Chỉ của mình, Đúng tổ, Cả tổ (như hôm nay), Toàn bộ; Sửa/Xoá theo phạm vi Sửa. |
| A4-PER-SUBJECT | R1 | Phạm vi theo từng (thao tác, chức năng); quyền cộng dồn theo từng lượt thuộc tổ. |
| A5-MEMBER-LEADER | R4 | Mỗi tổ có mẫu cho Thành viên và mẫu cho Tổ trưởng. |
| A6-OVERRIDE | R3, R4 | Ngoại lệ theo người: thêm/tắt quyền, có lý do và hạn dùng; hết hạn tự mất. |
| A7-ADMIN | B2 | Quản trị viên không bị giới hạn. |
| A8-TEMPLATE | B3 cách 1; "tạo thì phải sửa và xoá" | Mẫu quyền tạo, sửa, sao chép, lưu trữ/khôi phục, xoá khi không tổ nào dùng. |
| A9-MATRIX | B3 cách 3 | Ma trận tick theo hàng, cột, mục. |
| A10-COPY-APPLY | B3 cách 2 và 4 | Chép từ tổ khác; áp cho nhiều tổ có xem trước, tất cả hoặc không. |
| A10-SCOPE | Kế hoạch Phần 0 | Thành viên của tổ đã ngừng không còn tính vào phạm vi dữ liệu. |
| A11-PREVIEW | Nguyên tắc dễ dùng 4 | Luôn xem trước ai mất/được quyền gì trước khi lưu và trước khi bật; kể cả thu hẹp phạm vi. |
| A12-CONFLICT | Kế hoạch màn Quyền theo tổ | Hai người sửa cùng lúc: người sau nhận 409, không ghi đè. |
| A13-NO-ESCALATE | Kế hoạch "Ai được sửa cấu hình quyền" | Không ai cấp vượt quyền mình có; thay đổi nhạy cảm phải có lý do. |
| A14-SEE-BEFORE-CHANGE | Kế hoạch (quyền ghi nằm trong quyền đọc) | Phải xem được thì mới được thêm/sửa/xoá; phạm vi ghi không rộng hơn phạm vi xem. |
| A15-LOOKUP | Nguyên tắc dễ dùng 5 | Tra cứu trả lời được "vì sao anh X có/không có quyền này". |
| A16-HISTORY-UNDO | Nguyên tắc dễ dùng 4 | Mọi thay đổi có lịch sử và hoàn tác được; hoàn tác là một thay đổi mới, bị từ chối nếu đã có thay đổi sau. |
| A17-STARTERS | B3 cách 1; kế hoạch D6 | Có ba mẫu khởi đầu dựng từ quyền cán bộ hiện có. |
| A18-OFF | Kế hoạch "Triển khai an toàn" | Chế độ Tắt giữ y hệt hôm nay; màn cấu hình chỉ dành cho người quản trị vai trò. |
| A19-TWO-ADMIN | Kế hoạch A12; quyết định D6 | Bật Áp dụng cần hai quản trị viên; Chạy thử/Tắt một người, có lý do. |
| A20-FINGERPRINT | Quyết định D6 | Hai người phải cùng đọc một bảng so sánh; cấu hình đổi thì phải đọc lại. |
| A21-TTL | Quyết định D6 | Đề nghị quá 24 giờ hết hiệu lực. |
| A22-WITHDRAW | "Yêu cầu ⇒ có Rút lại" | Đề nghị rút lại được, từ chối được; đề nghị đã đóng không sống lại. |
| A23-OFF-ONE-STEP | Kế hoạch "Rollback: đặt về OFF" | Tắt là một bước, một người, có hiệu lực ngay, không mất cấu hình. |
| A24-NO-LOCKOUT | Kế hoạch "Chống khoá" | Không bật được nếu người thao tác tự mất đường quay lại; vai trò quản trị giữ quyền quản trị vai trò. |
| A25-ENFORCED-PROFILE | Yêu cầu 1 "chọn màn hình/chức năng" | Khi áp dụng, thực đơn, màn hình và nút bấm theo đúng quyền tổ cấp; máy chủ từ chối điều giao diện đã ẩn. |
| A26-ENFORCED-RECORDS | Yêu cầu 1 "phạm vi xem" | Mọi con số đếm khớp số dòng người ấy mở được. |
| A27-NOTICE | Rà soát Codex #662 | Thông báo nêu hồ sơ chỉ tới người mở được hồ sơ đó khi áp dụng; chưa bật thì như trước. |
| A28-DASHBOARD | Rà soát Codex #662 | Số liệu Trang chủ theo phạm vi người xem khi áp dụng; chưa bật thì như trước. |
| A29-SETTINGS | Rà soát Codex #662 | Chế độ chỉ đổi được ở tab Áp dụng. |
| A30-UNAVAILABLE | Quyết định D5 | Không biết có đang áp dụng không thì từ chối, không lùi về vai trò. |
| A31-EASY | B5 "dễ dùng, dễ hiểu" | Lời đời thường; nâng cao giấu sau nút; dùng được bằng bàn phím, ở màn hình thường gặp. |
| A32-AUDIT | Tiêu chuẩn máy chủ (audit chỉ metadata) | Mỗi lần đổi chế độ có lịch sử và nhật ký, chỉ siêu dữ liệu. |

## D2. Vai (persona)

| Mã | Là ai | Cần để kiểm |
|---|---|---|
| P-QUAN-TRI | Quản trị viên (vai trò ADMIN) thứ nhất | Cài mẫu, cài tổ, đề nghị áp dụng |
| P-QUAN-TRI-2 | Quản trị viên thứ hai, tài khoản khác | Duyệt / từ chối đề nghị, tắt áp dụng |
| P-CAN-BO | Cán bộ, thành viên thường của tổ T | Xem quyền và hồ sơ sau khi áp dụng |
| P-TO-TRUONG | Tổ trưởng của tổ T (T có tổ con T1) | Mẫu Tổ trưởng; phạm vi Đúng tổ / Cả tổ |
| P-CAN-BO-KHAC-TO | Cán bộ của một tổ chưa cài gì | Chứng minh tổ chưa cài giữ quyền như hiện nay, và ranh giới giữa hai tổ |
| P-QUAN-LY-BC | Người quản lý báo cáo động | Thiết lập báo cáo, cài tiêu chí theo tổ, khoá sổ |
| P-NGUOI-NHAP | Người nhập số liệu của một tổ | Chỉ thấy tiêu chí của tổ mình |
| P-VO-DANH | Chưa đăng nhập | Mọi route đều từ chối |

## D3. Trạng thái

- **Tổ:** `ACTIVE` ⇄ `INACTIVE`; `ACTIVE`/`INACTIVE` ⇄ `ARCHIVED`; gộp đưa tổ nguồn sang `ARCHIVED`; xoá thật chỉ từ tổ rỗng.
- **Chế độ phân quyền:** `OFF` ⇄ `SHADOW` (một quản trị viên); `OFF`/`SHADOW` → `ENFORCE` (đề nghị + người thứ hai duyệt); `ENFORCE` → `OFF` (một quản trị viên, một bước).
- **Đề nghị áp dụng:** `PENDING` → `APPLIED` | `WITHDRAWN` | `REJECTED` | `SUPERSEDED`; quá 24 giờ thì hết hiệu lực. Không trạng thái đóng nào quay lại `PENDING`.
- **Kỳ báo cáo:** đang chạy → khoá sổ (có file chính thức) → mở lại (file cũ vô hiệu) → khoá sổ lại.

## D4. Hành trình × vai × nền tảng

| Hành trình | Vai chính | Web | API |
|---|---|---|---|
| J-TO-VONG-DOI — tạm ngừng, lưu trữ, xoá tổ | P-QUAN-TRI | có | có |
| J-TO-GOP — gộp tổ và hoàn tác | P-QUAN-TRI | có | có |
| J-BC-THIET-LAP — nạp tiêu chí, cài theo tổ | P-QUAN-LY-BC | có | có |
| J-BC-NHAP — nhập số liệu của tổ | P-NGUOI-NHAP | có | có |
| J-BC-KHOA-SO — tổng hợp, khoá sổ, file chính thức | P-QUAN-LY-BC | có | có |
| J-PQ-MAU — mẫu quyền | P-QUAN-TRI | có | có |
| J-PQ-TO — quyền theo tổ, ngoại lệ | P-QUAN-TRI | có | có |
| J-PQ-TRA-CUU — tra cứu vì sao | P-QUAN-TRI | có | N/A (chỉ là màn đọc) |
| J-PQ-LICH-SU — lịch sử và hoàn tác | P-QUAN-TRI | có | có |
| J-PQ-AP-DUNG — so sánh, đề nghị, duyệt, tắt | P-QUAN-TRI + P-QUAN-TRI-2 | có | có |
| J-PQ-CAN-BO — cán bộ làm việc khi đã áp dụng | P-CAN-BO, P-TO-TRUONG | có | có |

Mobile: N/A cho cả đợt (xem `_platform.json`).

## D5. Dữ liệu cần dựng

Tổ T (đã cài mẫu) có tổ con T1 (chưa cài) và tổ T2 (cài mẫu khác); tổ U chưa cài gì; một tổ đã ngừng còn thành viên. Hồ sơ đơn thư: của cán bộ, của đồng đội cùng tổ, của tổ con, của tổ khác, chưa giao tổ (do cán bộ nhập và do người khác nhập). Một báo cáo động có 10 tiêu chí, giao 3 cho tổ A, đủ 10 cho tổ B. `tools/uat-phan-quyen/workflow.cjs` tự dựng phần quyền theo tổ cho lượt chạy cục bộ.

## D6. Được phép giả lập

Không gì cả ở phía hệ thống. Đường duy nhất được thay là **thời gian** (ca hết hạn ngoại lệ, ca đề nghị quá 24 giờ) và **sự cố** (ca hệ thống không đọc được cấu hình quyền): cả hai chỉ dựng được trên bản cục bộ hoặc bản sao, không trên production.

