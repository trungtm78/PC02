# Coverage Ledger — đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)

> Sinh từ `_build.py` (một bảng mệnh đề cho cả ba tệp). Oracle: `_domain-pack.md` — lấy từ yêu cầu của anh và
> tệp kế hoạch, không lấy từ mã. Cột **Tầng** nói bằng chứng phải đi qua đâu: **E2E** = Chrome thật + máy chủ + CSDL
> thật · **API** = HTTP thật. Đợt này không có dòng nào ở tầng UNIT: mọi mệnh đề đều có chủ ngữ là người dùng hoặc
> là hệ thống nhìn từ ngoài.

## TC_min = MAX(M1, M2, M3, M4)

**Khai cho máy đọc (`coverage_calc.py` tự tính lại, không lấy số người tự ghi):**
`M2=807` · `FP=34` · `risk=CRITICAL`

M1 KHÔNG khai ở đây — nó được đếm từ số dòng của Sổ mệnh đề bên dưới.

| Phương pháp | Cách đếm | Giá trị |
|---|---|---|
| **M1** spec coverage items (29119-4) | Đếm từ Sổ mệnh đề: 59 luật trong `_domain-pack.md` khai triển qua AC, ca phủ định, EP, BVA, bảng quyết định, chuyển trạng thái | **179** |
| **M2** Σ V(G) cyclomatic | Đo bằng `lizard` trên các tệp logic mới của ba phần (danh sách tệp ở cuối tệp này) | **807** |
| **M3** ceil(FP^1.2) | 34 chức năng người dùng thấy được (3 thao tác vòng đời + gộp/hoàn tác; nhập tiêu chí, cài theo tổ, 4 cách nhanh, nhập liệu, tổng hợp, file chính thức, đổi giữa kỳ; 5 tab phân quyền, mẫu khởi đầu, công tắc) | **69** |
| **M4** risk-tier backstop | **CRITICAL**: đợt này đổi đường kiểm quyền của toàn hệ thống và phạm vi dữ liệu của ~231 cán bộ | **120** |

Tổng ca thật: **179**. Số này nảy sinh từ Sổ mệnh đề; không ca nào chèn cho đủ số.

Phân bố theo tầng: API 69 · E2E 110. Theo loại: A11Y 1 · BOUNDARY 6 · COMPAT 1 · DATA 2 · DECISION 5 · EDGE 15 · GREEN 69 · RED 46 · REGRESSION 3 · SECURITY 15 · STATE 8 · UX 8.

## Sổ mệnh đề

### I. Vòng đời Tổ (#650)

| cov_id | Mệnh đề | Tầng | Loại | TC |
|---|---|---|---|---|
| COV-T1-STATES-1 | Tổ đang hoạt động chuyển được sang Tạm ngừng | E2E | STATE | TC-001 |
| COV-T1-STATES-2 | Tổ tạm ngừng hoạt động lại được | E2E | STATE | TC-002 |
| COV-T1-STATES-3 | Tổ lưu trữ được và khôi phục được | E2E | STATE | TC-003 |
| COV-T1-STATES-4 | Tổ đã lưu trữ không tạm ngừng tiếp được | API | STATE | TC-004 |
| COV-T4-TABS-1 | Màn quản trị Tổ có đúng ba tab kèm số đếm | E2E | GREEN | TC-005 |
| COV-T2-OPTIONS-1 | Tổ tạm ngừng biến khỏi ô chọn tổ ở màn tạo Đơn thư | E2E | RED | TC-006 |
| COV-T2-OPTIONS-2 | Tổ tạm ngừng biến khỏi ô chọn ở màn bàn giao và phân công | E2E | RED | TC-007 |
| COV-T2-OPTIONS-3 | Tổ tạm ngừng biến khỏi ô chọn tổ khi thiết lập báo cáo động | E2E | RED | TC-008 |
| COV-T2-OPTIONS-4 | Tổ đã lưu trữ cũng không có trong ô chọn | API | RED | TC-009 |
| COV-T2-OPTIONS-5 | Tổ hoạt động lại thì hiện lại trong ô chọn | E2E | GREEN | TC-010 |
| COV-T3-NAME-KEEP-1 | Hồ sơ cũ của tổ đã ngừng vẫn hiện đúng tên tổ | E2E | GREEN | TC-011 |
| COV-T5-REVERSE-1 | Mỗi thao tác vòng đời có nút chiều ngược ngay trên màn đó | E2E | UX | TC-012 |
| COV-T6-DELETE-1 | Tổ chưa có dữ liệu xoá hẳn được | E2E | GREEN | TC-013 |
| COV-T6-DELETE-2 | Tổ có hồ sơ không có nút Xoá, chỉ có Gộp hoặc Lưu trữ | E2E | RED | TC-014 |
| COV-T6-DELETE-3 | Gọi xoá thẳng một tổ có dữ liệu thì bị từ chối và nêu số bản ghi theo từng loại | API | RED | TC-015 |
| COV-T6-DELETE-4 | Tổ chỉ có thành viên (chưa có hồ sơ) cũng không xoá hẳn được | API | BOUNDARY | TC-016 |
| COV-T7-DELETE-RACE-1 | Thêm thành viên vào tổ đúng lúc đang xoá thì không mất ai | API | RED | TC-017 |
| COV-T8-MERGE-1 | Gộp tổ có màn xem trước nêu số bản ghi sẽ chuyển | E2E | GREEN | TC-018 |
| COV-T8-MERGE-2 | Sau khi gộp, hồ sơ của tổ cũ thuộc tổ đích | E2E | GREEN | TC-019 |
| COV-T8-MERGE-3 | Người thuộc cả hai tổ chỉ còn một dòng thành viên ở tổ đích | API | EDGE | TC-020 |
| COV-T8-MERGE-4 | Tổ cũ sau khi gộp nằm ở Đã lưu trữ | E2E | STATE | TC-021 |
| COV-T8-MERGE-5 | Kỳ báo cáo đã sinh của tổ cũ không bị sửa khi gộp | API | RED | TC-022 |
| COV-T8-MERGE-6 | Không gộp được một tổ vào chính nó | API | RED | TC-023 |
| COV-T9-UNDO-1 | Hoàn tác gộp đưa hồ sơ và thành viên về tổ cũ | E2E | GREEN | TC-024 |
| COV-T9-UNDO-2 | Hoàn tác bỏ qua bản ghi đã bị đổi sau khi gộp và nêu rõ là đã bỏ qua | API | EDGE | TC-025 |
| COV-T9-UNDO-3 | Hoàn tác hai lần thì lần hai bị từ chối | API | RED | TC-026 |
| COV-T1-STATES-5 | Cán bộ thường không đổi được trạng thái tổ | API | SECURITY | TC-027 |

### II. Báo cáo động theo tiêu chí từng tổ (#652–#654)

| cov_id | Mệnh đề | Tầng | Loại | TC |
|---|---|---|---|---|
| COV-B1-IMPORT-1 | Tải file Excel lên thì thấy lưới của từng sheet và đổi sheet được | E2E | GREEN | TC-028 |
| COV-B1-IMPORT-2 | Bấm tiêu đề cột thì cả cột thành tiêu chí, theo thứ tự dòng | E2E | GREEN | TC-029 |
| COV-B1-IMPORT-3 | Chọn một số ô trong một cột thì chỉ các ô ấy thành tiêu chí | E2E | GREEN | TC-030 |
| COV-B1-IMPORT-4 | Chọn theo khoảng bằng Shift và "Chọn các dòng đang thấy" | E2E | EDGE | TC-031 |
| COV-B1-IMPORT-5 | Không chọn được ô ở hai cột khác nhau làm tiêu chí | E2E | RED | TC-032 |
| COV-B2-CODE-UNIT-1 | Đặt cột mã và cột đơn vị tính thì tiêu chí mang mã và ĐVT của cùng dòng | E2E | GREEN | TC-033 |
| COV-B2-CODE-UNIT-2 | Dòng trống mã hoặc trống ĐVT vẫn tạo được tiêu chí với giá trị mặc định | E2E | EDGE | TC-034 |
| COV-B3-HIER-1 | Thụt lề hoặc đánh số 1 / 1.1 / 1.1.1 thành cây cha con ở xem trước | E2E | GREEN | TC-035 |
| COV-B3-HIER-2 | Khi tổng hợp, mục cha bằng tổng các mục con | API | GREEN | TC-036 |
| COV-B4-PREVIEW-1 | Xem trước cảnh báo ô trống, trùng tên, ô gộp, ô công thức | E2E | RED | TC-037 |
| COV-B4-PREVIEW-2 | Quá 2.000 dòng thì bị chặn kèm lời giải thích | E2E | BOUNDARY | TC-038 |
| COV-B4-PREVIEW-3 | Sửa tên, bỏ dòng, đổi ĐVT ngay ở xem trước mà không phải sửa file | E2E | GREEN | TC-039 |
| COV-B5-SERVER-1 | Máy chủ tự đọc lại ô từ file đã lưu, không tin nội dung trình duyệt gửi | API | SECURITY | TC-040 |
| COV-B5-SERVER-2 | Ô bắt đầu bằng = + - @ không thành công thức khi mở file xuất | API | SECURITY | TC-041 |
| COV-B6-DEFAULT-ALL-1 | Tổ vừa được chọn mặc định phải báo TẤT CẢ tiêu chí | E2E | GREEN | TC-042 |
| COV-B7-PER-TEAM-1 | Bỏ tick một tiêu chí thì tổ ấy không phải báo tiêu chí đó | E2E | GREEN | TC-043 |
| COV-B7-PER-TEAM-2 | Chọn nhanh theo nhóm cha, Chọn hết, Bỏ hết, Đảo | E2E | GREEN | TC-044 |
| COV-B7-PER-TEAM-3 | Thêm tay một tiêu chí cho báo cáo này, có nhãn phân biệt với tiêu chí từ file | E2E | GREEN | TC-045 |
| COV-B7-PER-TEAM-4 | Chép bộ tiêu chí từ tổ khác | E2E | GREEN | TC-046 |
| COV-B7-PER-TEAM-5 | Áp một bộ tiêu chí cho nhiều tổ cùng lúc | E2E | GREEN | TC-047 |
| COV-B7-PER-TEAM-6 | Ma trận tổ × tiêu chí cho tick theo hàng, theo cột | E2E | GREEN | TC-048 |
| COV-B7-PER-TEAM-7 | Trước khi sang bước sau thấy số tiêu chí mỗi tổ sẽ báo | E2E | UX | TC-049 |
| COV-B15-MATRIX-1 | Xuất ma trận ra Excel rồi nhập lại thì bộ tick không đổi | E2E | GREEN | TC-050 |
| COV-B15-MATRIX-2 | Nhập ma trận đã sửa thì đổi đúng các ô đã sửa | E2E | GREEN | TC-051 |
| COV-B15-MATRIX-3 | File ma trận hỏng, sai mẫu hoặc nén bom bị từ chối, không đổi gì | API | SECURITY | TC-052 |
| COV-B15-MATRIX-4 | Nhập ma trận dựa trên bản cũ khi người khác vừa sửa thì bị báo xung đột | API | RED | TC-053 |
| COV-B8-ENTRY-ONLY-1 | Người nhập của tổ chỉ thấy tiêu chí được giao cho tổ mình | E2E | GREEN | TC-054 |
| COV-B8-ENTRY-ONLY-2 | Dữ liệu trả về cho người nhập không chứa tiêu chí ngoài tập của tổ | API | SECURITY | TC-055 |
| COV-B8-ENTRY-ONLY-3 | File tổ tự xuất không có nội dung của tiêu chí không được giao | E2E | RED | TC-056 |
| COV-B8-ENTRY-ONLY-4 | Đổi tập tiêu chí của tổ thì màn nhập đang mở nhận tập mới ở lần tải kế tiếp | E2E | EDGE | TC-057 |
| COV-B9-REJECT-1 | Lưu giá trị cho tiêu chí không thuộc tổ bị từ chối | API | RED | TC-058 |
| COV-B9-REJECT-2 | Nhập Excel có dòng của tiêu chí không thuộc tổ bị từ chối | API | RED | TC-059 |
| COV-B9-REJECT-3 | Kiểm tra bắt buộc chỉ xét tiêu chí của tổ | E2E | EDGE | TC-060 |
| COV-B10-AGG-1 | Tổng của một tiêu chí chỉ cộng các tổ được giao tiêu chí đó | API | GREEN | TC-061 |
| COV-B10-AGG-2 | Tổ không được giao không bị tính như số 0 | API | RED | TC-062 |
| COV-B11-COMPLETE-1 | Độ đầy đủ = số đã nhận / số PHẢI NỘP | API | GREEN | TC-063 |
| COV-B11-COMPLETE-2 | Tổ được miễn nộp không nằm trong số phải nộp | API | EDGE | TC-064 |
| COV-B11-COMPLETE-3 | Màn Tình trạng chia theo số tiêu chí thuộc từng tổ | E2E | GREEN | TC-065 |
| COV-B12-OFFICIAL-1 | Khoá sổ xong có file chính thức trong danh sách tải về | E2E | GREEN | TC-066 |
| COV-B12-OFFICIAL-2 | File chính thức không hết hạn | E2E | BOUNDARY | TC-067 |
| COV-B12-OFFICIAL-3 | Sheet đầu "Tổng hợp": mỗi tiêu chí một dòng, có Tổng, Đã nhận/Phải nộp, %, rồi mỗi tổ một cột | E2E | GREEN | TC-068 |
| COV-B12-OFFICIAL-4 | Ô của tổ ở sheet Tổng hợp: giá trị nếu có, đánh dấu thiếu nếu được giao mà chưa nộp, "—" nếu không giao | E2E | DECISION | TC-069 |
| COV-B12-OFFICIAL-5 | Sau sheet Tổng hợp, mỗi tổ một sheet chỉ có tiêu chí của tổ đó | E2E | GREEN | TC-070 |
| COV-B13-RETRY-1 | Tạo file lỗi thì kỳ vẫn khoá, có báo lỗi và nút Tạo lại | E2E | RED | TC-071 |
| COV-B13-RETRY-2 | Mở lại kỳ thì file chính thức cũ được đánh dấu vô hiệu | E2E | STATE | TC-072 |
| COV-B14-MIDPERIOD-1 | Đổi tập tiêu chí của kỳ đang chạy phải nhập lý do | E2E | RED | TC-073 |
| COV-B14-MIDPERIOD-2 | Đổi tập khi bản nộp đã duyệt thì bản nộp được trả lại kèm lý do | E2E | EDGE | TC-074 |
| COV-B14-MIDPERIOD-3 | Kỳ chưa mở nhận tập theo cấu hình mới, không cần thao tác giữa kỳ | API | GREEN | TC-075 |
| COV-B17-NEWVERSION-1 | Tiêu chí mới ở phiên bản sau mặc định giao cho mọi tổ | E2E | GREEN | TC-076 |
| COV-B17-NEWVERSION-2 | Ra phiên bản mới thì tập của tổ được giữ theo MÃ tiêu chí, kể cả khi đổi tên | E2E | EDGE | TC-077 |
| COV-B16-LEGACY-1 | Báo cáo cũ không cài tập tiêu chí cho ra tổng hợp y như trước | API | REGRESSION | TC-078 |
| COV-B8-ENTRY-ONLY-5 | Người không có quyền quản lý báo cáo không cài được tập tiêu chí | API | SECURITY | TC-079 |

### III. Quyền theo Tổ (#655–#662)

| cov_id | Mệnh đề | Tầng | Loại | TC |
|---|---|---|---|---|
| COV-A18-OFF-1 | Chưa bật thì cấu hình ở màn Phân quyền không đổi quyền của ai | API | GREEN | TC-080 |
| COV-A31-EASY-1 | Phạm vi xem dùng lời Chỉ của mình / Cả tổ / Toàn bộ; thao tác là Thêm / Sửa / Xoá | E2E | UX | TC-081 |
| COV-A31-EASY-2 | Phần nâng cao (kế thừa, ngoại lệ, hạn dùng, theo người) nằm sau nút Nâng cao | E2E | UX | TC-082 |
| COV-A8-TEMPLATE-1 | Tạo mẫu quyền mới và thấy nó trong danh sách | E2E | GREEN | TC-083 |
| COV-A8-TEMPLATE-2 | Sửa mẫu rồi mở lại thấy đúng thay đổi | E2E | GREEN | TC-084 |
| COV-A8-TEMPLATE-3 | Sao chép mẫu cho ra mẫu mới giống hệt, sửa bản sao không đổi bản gốc | E2E | GREEN | TC-085 |
| COV-A8-TEMPLATE-4 | Lưu trữ mẫu rồi khôi phục được | E2E | STATE | TC-086 |
| COV-A8-TEMPLATE-5 | Xoá mẫu không tổ nào dùng | E2E | GREEN | TC-087 |
| COV-A8-TEMPLATE-6 | Mẫu đang có tổ dùng thì không xoá được, và nói rõ tổ nào đang dùng | E2E | RED | TC-088 |
| COV-A8-TEMPLATE-7 | Mẫu không có tên thì không lưu được | E2E | RED | TC-089 |
| COV-A9-MATRIX-1 | Tick cả hàng, cả cột, cả mục trong ma trận mẫu | E2E | GREEN | TC-090 |
| COV-A14-SEE-BEFORE-CHANGE-1 | Không cấp được Sửa rộng hơn Xem trên cùng một chức năng | E2E | RED | TC-091 |
| COV-A14-SEE-BEFORE-CHANGE-2 | Không cấp được Thêm/Sửa/Xoá khi không cấp Xem | E2E | RED | TC-092 |
| COV-A13-NO-ESCALATE-1 | Người lưu không cấp được quyền mà chính họ không có | API | SECURITY | TC-093 |
| COV-A13-NO-ESCALATE-2 | Cấp quyền nhạy cảm (Toàn bộ, xuất đầy đủ, quản trị người dùng/vai trò) phải có lý do | E2E | RED | TC-094 |
| COV-A17-STARTERS-1 | Bấm Tạo 3 mẫu khởi đầu thì có ba mẫu: Cán bộ (như hiện nay), Chỉ hồ sơ của mình, Chỉ xem | E2E | GREEN | TC-095 |
| COV-A17-STARTERS-2 | Bấm lần hai không tạo trùng | E2E | EDGE | TC-096 |
| COV-A17-STARTERS-3 | Mẫu khởi đầu sửa và xoá được như mẫu thường | E2E | GREEN | TC-097 |
| COV-A5-MEMBER-LEADER-1 | Mỗi tổ chọn riêng mẫu cho Thành viên và mẫu cho Tổ trưởng | E2E | GREEN | TC-098 |
| COV-A5-MEMBER-LEADER-2 | Khi áp dụng, tổ trưởng có quyền theo mẫu Tổ trưởng, thành viên theo mẫu Thành viên | API | DECISION | TC-099 |
| COV-A2-INHERIT-1 | Tổ chưa cài thì theo cấu hình của tổ cha | API | GREEN | TC-100 |
| COV-A2-INHERIT-2 | Cây tổ ghi nhãn Kế thừa hoặc Riêng cho từng tổ | E2E | UX | TC-101 |
| COV-A1-DEFAULT-1 | Tổ không cài gì và không tổ cha nào cài thì giữ quyền như hiện nay | API | GREEN | TC-102 |
| COV-A12-CONFLICT-1 | Hai người sửa cùng cấu hình một tổ: người lưu sau bị báo xung đột | E2E | RED | TC-103 |
| COV-A10-COPY-APPLY-1 | Chép cấu hình từ tổ khác | E2E | GREEN | TC-104 |
| COV-A10-COPY-APPLY-2 | Áp cho nhiều tổ có xem trước rồi mới lưu | E2E | GREEN | TC-105 |
| COV-A10-COPY-APPLY-3 | Áp cho nhiều tổ là tất cả hoặc không: một tổ không hợp lệ thì không tổ nào đổi | API | RED | TC-106 |
| COV-A11-PREVIEW-1 | Xem trước nêu số người và ai mất quyền gì, bằng lời | E2E | GREEN | TC-107 |
| COV-A11-PREVIEW-2 | Xem trước không ghi gì | API | RED | TC-108 |
| COV-A11-PREVIEW-3 | Phạm vi thu hẹp nhưng không mất tổ nào vẫn được đánh dấu "phạm vi hẹp hơn" | E2E | EDGE | TC-109 |
| COV-A6-OVERRIDE-1 | Thêm quyền riêng cho một người, có lý do và hạn dùng | E2E | GREEN | TC-110 |
| COV-A6-OVERRIDE-2 | Tắt một quyền riêng của một người | API | GREEN | TC-111 |
| COV-A6-OVERRIDE-3 | Ngoại lệ hết hạn thì quyền tự mất, không cần ai thao tác | API | BOUNDARY | TC-112 |
| COV-A6-OVERRIDE-4 | Ngoại lệ thiếu lý do không lưu được | E2E | RED | TC-113 |
| COV-A6-OVERRIDE-5 | Ngày hạn không có thật (31/02) bị từ chối | API | DATA | TC-114 |
| COV-A15-LOOKUP-1 | Tra cứu một người thấy quyền hiệu lực và lý do "vì sao" | E2E | GREEN | TC-115 |
| COV-A15-LOOKUP-2 | Tra cứu nêu cả quyền KHÔNG có và lý do | E2E | GREEN | TC-116 |
| COV-A15-LOOKUP-3 | Từ màn Quản lý người dùng mở được quyền hiệu lực của người đó | E2E | GREEN | TC-117 |
| COV-A15-LOOKUP-4 | Người thuộc hai tổ: tra cứu nêu quyền từ từng tổ | E2E | EDGE | TC-118 |
| COV-A16-HISTORY-UNDO-1 | Mỗi lần lưu cấu hình là một dòng lịch sử: ai, lúc nào, đổi gì | E2E | GREEN | TC-119 |
| COV-A16-HISTORY-UNDO-2 | Hoàn tác đưa cấu hình về như trước và tự nó là một dòng lịch sử mới | E2E | GREEN | TC-120 |
| COV-A16-HISTORY-UNDO-3 | Không hoàn tác được khi đối tượng đã bị sửa tiếp sau đó | E2E | RED | TC-121 |
| COV-A16-HISTORY-UNDO-4 | Hoàn tác cũng không cấp vượt quyền người bấm | API | SECURITY | TC-122 |
| COV-A18-OFF-2 | Người không có quyền quản trị vai trò không mở được màn Phân quyền | API | SECURITY | TC-123 |
| COV-A19-TWO-ADMIN-1 | Thẻ trạng thái nói rõ đang Tắt, Chạy thử hay Áp dụng bằng lời | E2E | UX | TC-124 |
| COV-A11-PREVIEW-4 | Bảng "Nếu áp dụng ngay bây giờ" nêu tổng số người, số bị mất, được thêm, đổi phạm vi | E2E | GREEN | TC-125 |
| COV-A11-PREVIEW-5 | Quản trị viên không nằm trong bảng so sánh | API | GREEN | TC-126 |
| COV-A11-PREVIEW-6 | Thành viên của tổ đã ngừng được nêu là mất phạm vi tổ ấy | API | EDGE | TC-127 |
| COV-A19-TWO-ADMIN-2 | Không bật Áp dụng trực tiếp được | API | RED | TC-128 |
| COV-A19-TWO-ADMIN-3 | Gửi đề nghị cần lý do và tick "đã đọc danh sách" | E2E | RED | TC-129 |
| COV-A19-TWO-ADMIN-4 | Người đề nghị không tự duyệt được | E2E | RED | TC-130 |
| COV-A19-TWO-ADMIN-5 | Quản trị viên thứ hai duyệt thì chế độ thành Áp dụng | E2E | GREEN | TC-131 |
| COV-A19-TWO-ADMIN-6 | Cán bộ không đề nghị, không duyệt, không từ chối được | API | SECURITY | TC-132 |
| COV-A19-TWO-ADMIN-7 | Khi đã có một đề nghị chờ thì không gửi được đề nghị thứ hai | API | RED | TC-133 |
| COV-A20-FINGERPRINT-1 | Đề nghị trên một bảng so sánh chưa đọc (đã cũ) bị từ chối và phải đọc lại | E2E | RED | TC-134 |
| COV-A20-FINGERPRINT-2 | Cấu hình đổi sau khi đề nghị thì người duyệt không duyệt được đề nghị cũ | API | RED | TC-135 |
| COV-A21-TTL-1 | Đề nghị quá 24 giờ chưa ai duyệt thì hết hiệu lực | API | BOUNDARY | TC-136 |
| COV-A22-WITHDRAW-1 | Người đề nghị rút lại được đề nghị của mình | E2E | GREEN | TC-137 |
| COV-A22-WITHDRAW-2 | Quản trị viên khác từ chối được đề nghị | E2E | GREEN | TC-138 |
| COV-A22-WITHDRAW-3 | Đề nghị đã đóng không duyệt được nữa | API | STATE | TC-139 |
| COV-A22-WITHDRAW-4 | Chuyển sang Chạy thử khi có đề nghị chờ thì đề nghị bị huỷ, có báo trước | E2E | EDGE | TC-140 |
| COV-A19-TWO-ADMIN-8 | Chạy thử bật và dừng được bởi một quản trị viên, không đổi quyền của ai | API | GREEN | TC-141 |
| COV-A19-TWO-ADMIN-9 | Đổi chế độ thiếu lý do bị từ chối | API | RED | TC-142 |
| COV-A29-SETTINGS-1 | Màn cấu hình chung không đổi được chế độ phân quyền | API | SECURITY | TC-143 |
| COV-A24-NO-LOCKOUT-1 | Không bật được khi người đề nghị hoặc người duyệt sẽ mất quyền mở màn này | API | RED | TC-144 |
| COV-A24-NO-LOCKOUT-2 | Vai trò quản trị không bỏ được quyền xem và sửa vai trò | E2E | RED | TC-145 |
| COV-A25-ENFORCED-PROFILE-1 | Khi áp dụng, cán bộ chỉ còn quyền tổ cấp, và thực đơn theo đó | E2E | GREEN | TC-146 |
| COV-A25-ENFORCED-PROFILE-2 | Màn hình mất quyền thì gõ thẳng địa chỉ cũng không vào được | E2E | SECURITY | TC-147 |
| COV-A25-ENFORCED-PROFILE-3 | Không có quyền Xoá thì không thấy nút Xoá, và gọi xoá bị từ chối | E2E | RED | TC-148 |
| COV-A3-REACH-1 | Chỉ của mình: chỉ thấy hồ sơ do mình phụ trách/nhập | E2E | GREEN | TC-149 |
| COV-A3-REACH-2 | Chỉ của mình: không thấy hồ sơ chưa giao tổ của người khác | API | RED | TC-150 |
| COV-A3-REACH-3 | Đúng tổ: thấy hồ sơ giao cho đúng tổ mình, không thấy của tổ con | API | BOUNDARY | TC-151 |
| COV-A3-REACH-4 | Đúng tổ: không thấy hồ sơ giao tổ khác dù do thành viên tổ mình xử lý | API | RED | TC-152 |
| COV-A3-REACH-5 | Đúng tổ: không thấy hồ sơ chưa giao tổ | API | RED | TC-153 |
| COV-A3-REACH-6 | Cả tổ: thấy tổ mình, tổ con, hồ sơ của thành viên và hồ sơ chưa giao, như hôm nay | E2E | GREEN | TC-154 |
| COV-A3-REACH-7 | Toàn bộ: thấy hồ sơ của mọi tổ | API | GREEN | TC-155 |
| COV-A3-REACH-8 | Mở thẳng một hồ sơ ngoài phạm vi bằng địa chỉ thì bị từ chối | API | SECURITY | TC-156 |
| COV-A3-REACH-9 | Tài liệu, đối tượng của hồ sơ theo phạm vi của hồ sơ cha | API | SECURITY | TC-157 |
| COV-A3-REACH-10 | Phạm vi Sửa hẹp hơn Xem: xem được cả tổ nhưng chỉ sửa được của mình | E2E | DECISION | TC-158 |
| COV-A4-PER-SUBJECT-1 | Phạm vi Đơn thư và phạm vi Vụ án độc lập nhau | API | DECISION | TC-159 |
| COV-A4-PER-SUBJECT-2 | Người thuộc hai tổ có hợp quyền, mỗi quyền phủ đúng tổ cấp nó | API | DECISION | TC-160 |
| COV-A7-ADMIN-1 | Quản trị viên không bị giới hạn khi áp dụng | API | GREEN | TC-161 |
| COV-A10-SCOPE-1 | Thành viên của tổ đã ngừng không còn với tới hồ sơ của tổ ấy khi áp dụng | API | EDGE | TC-162 |
| COV-A26-ENFORCED-RECORDS-1 | Số trên huy hiệu thực đơn bằng số dòng trong danh sách | E2E | GREEN | TC-163 |
| COV-A28-DASHBOARD-1 | Số liệu tổng và biểu đồ Trang chủ đếm theo phạm vi của người xem khi áp dụng | E2E | RED | TC-164 |
| COV-A28-DASHBOARD-2 | Người không có quyền xem vụ án không đọc được số liệu Trang chủ | API | SECURITY | TC-165 |
| COV-A28-DASHBOARD-3 | Chưa bật thì Trang chủ đếm toàn đơn vị như trước nay | API | REGRESSION | TC-166 |
| COV-A27-NOTICE-1 | Thông báo đơn quá hạn chỉ tới người mở được đơn đó khi áp dụng | API | RED | TC-167 |
| COV-A27-NOTICE-2 | Chưa bật thì thông báo hạn gửi như trước nay | API | REGRESSION | TC-168 |
| COV-A27-NOTICE-3 | Thông báo "được phân công" không tới người không có quyền xem loại hồ sơ đó | API | RED | TC-169 |
| COV-A23-OFF-ONE-STEP-1 | Một quản trị viên tắt áp dụng trong một bước, có lý do | E2E | GREEN | TC-170 |
| COV-A23-OFF-ONE-STEP-2 | Tắt xong cán bộ có lại quyền của vai trò ngay, không cần đăng nhập lại | API | GREEN | TC-171 |
| COV-A23-OFF-ONE-STEP-3 | Tắt không làm mất cấu hình mẫu và tổ | E2E | GREEN | TC-172 |
| COV-A32-AUDIT-1 | Lịch sử bật/tắt nêu ai đề nghị, ai quyết định, lý do, từ chế độ nào sang chế độ nào | E2E | GREEN | TC-173 |
| COV-A32-AUDIT-2 | Đổi chế độ để lại bản ghi trong nhật ký hệ thống, chỉ có siêu dữ liệu | API | DATA | TC-174 |
| COV-A30-UNAVAILABLE-1 | Đang áp dụng mà hệ thống không đọc được cấu hình quyền thì từ chối, không lùi về vai trò | API | RED | TC-175 |
| COV-A30-UNAVAILABLE-2 | Lời báo khi hệ thống phân quyền chưa sẵn sàng là lời tiếng Việt dễ hiểu | E2E | UX | TC-176 |
| COV-A31-EASY-3 | Màn Phân quyền dùng được bằng bàn phím và đọc được bằng trình đọc màn hình | E2E | A11Y | TC-177 |
| COV-A31-EASY-4 | Màn Phân quyền dùng được ở bề rộng máy tính xách tay 1366 | E2E | COMPAT | TC-178 |
| COV-A11-PREVIEW-7 | Bảng so sánh với hơn 200 người vẫn đọc và cuộn được | E2E | UX | TC-179 |

## GAP đã biết (không có ca, có lý do)

| Mục | Lý do |
|---|---|
| Hiệu năng (thời gian tải bảng so sánh, danh sách khi phạm vi Toàn bộ) | Chưa có ngân sách p95 do người đặt; không bịa ngưỡng. Số đo tham khảo: 30 yêu cầu có kiểm quyền trên máy cục bộ, trung vị 17 ms. |
| Thông báo đã gửi trước khi áp dụng | Giới hạn đã biết, ghi trong runbook: không thu hồi. Không phải lỗi để kiểm. |
| Khoá/hạ vai trò tài khoản quản trị cuối cùng | Giới hạn đã biết, ghi trong runbook; chưa có luật trong kế hoạch để làm oracle. |
| Mobile | Ứng dụng di động không có tệp nào trong các PR #650–#662. |
| ISO 25010 — tính tương thích dữ liệu khi nâng cấp | Migration chỉ thêm bảng/cột; kiểm bằng so số liệu production trước/sau mỗi lần deploy (đã làm, giống hệt), không phải ca UAT. |

## Tệp đo M2

Đo bằng `lizard 1.23.0` ngày 14/11/2026, tổng **807**: `documents.ts` 145 · `authz-admin.service.ts` 127 · `compile.ts` 87 · `authz-mode.service.ts` 80 · `criteria-matrix.ts` 65 · `scope.ts` 56 · `team-merge.service.ts` 54 · `authz.service.ts` 37 · `precise-scope.ts` 30 · `team-lifecycle.service.ts` 30 · `criteria-matrix.service.ts` 24 · `authz-scope.service.ts` 17 · `starter-templates.ts` 14 · `target-subsets.ts` 14 · `validate.ts` 13 · `record-readers.ts` 9 · `enforcement.ts` 5.
