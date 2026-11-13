# UAT — Đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)

13 PR (#650, #652 → #662) · production bản `cb3f203a` · chế độ phân quyền theo tổ đang **Tắt**.

**179 ca / 3 nhóm.** Sàn `TC_min` do `coverage_calc.py` tính từ `_coverage-ledger.md`, không phải con số đặt ra.

Điều kiện kết thúc: 100% dòng PASS **trên production hoặc bản sao production**. **Bỏ qua ≠ đạt.**

## Trạng thái đo được (14/11/2026)

| | |
|---|---|
| Cổng máy của bộ viết ca | `validate_uat_json` ĐẠT · độ phủ 179/179 mục · **`TC_min` HỎNG: 179 ca < sàn 807** (M2 chi phối, xem dưới) · ba mục cần người (gieo lỗi, soát đối kháng, đánh giá bằng người đóng vai) **chưa làm** |
| Đã chạy trên production | **0/179** |
| Đã chạy trên máy chủ dựng CỤC BỘ, qua HTTP thật | **28/179** — `tools/uat-phan-quyen/workflow.cjs`, 40/40 bước đạt. Đây là tầng API trên CSDL thử, **không phải production**; các dòng E2E trong số này vẫn chưa có lượt chạy trình duyệt. |
| Chưa chạy ở đâu cả | **151/179** |
| Chặn ở | Tài khoản thử trên production (5 tài khoản cũ khoá từ 20/09); cần **hai quản trị viên**, **một cán bộ**, **một tổ trưởng**, **một cán bộ khác tổ**. Ca ghi dữ liệu và ca bật Áp dụng phải chạy trên bản sao, không chạy trên production thật. |

Ca kiểm tự động đã có (đơn vị, PostgreSQL, vitest) là tầng thấp hơn và **không thay được** các dòng dưới đây.

### Vì sao `TC_min` hỏng, và điều đó có nghĩa gì

`TC_min = MAX(M1, M2, M3, M4)`. M2 là tổng độ phức tạp vòng (cyclomatic) đo bằng `lizard` trên 17 tệp logic mới của ba phần: **807**. Bộ ca này có 179 dòng, mỗi dòng là một mệnh đề nhìn từ phía người dùng. Khoảng cách ấy là thật: phần lớn các nhánh trong bộ tính quyền (kế thừa, hợp quyền nhiều tổ, hạn dùng, so sánh trước/sau) được kiểm ở tầng đơn vị và PostgreSQL, là tầng mà quy ước UAT của kho **không tính**.

M2 không bị hạ bằng cách bỏ bớt tệp khỏi phép đo, và không có ca nào chèn cho đủ số. Hai hướng để đóng khoảng này, cần anh chọn: (1) đào tiếp sổ mệnh đề cho bộ tính quyền (tổ hợp tổ cha/con × vai trong tổ × mức phạm vi × ngoại lệ × hạn dùng) tới khi số ca tự lên; (2) chấp nhận bằng văn bản rằng đường cơ sở (basis-path) của các tệp ấy do tầng đơn vị gánh, và UAT chỉ gánh mệnh đề phía người dùng.

## Quy ước

- **Oracle lấy từ `_domain-pack.md`**, tức từ yêu cầu của anh và tệp kế hoạch — không lấy từ mã nguồn.
- Cột **Cục bộ**: `PASS` = bước tương ứng trong `workflow.cjs` đã đạt trên máy chủ dựng cục bộ; trống = chưa chạy.
- Cột **Production**: chỉ ghi khi có lượt chạy thật kèm bằng chứng.

## I. Vòng đời Tổ (#650)

| ID | Màn hình / chức năng | Luật | Tầng | Loại | Ưu tiên | Cục bộ | Production |
|---|---|---|---|---|---|---|---|
| TC-001 | Tổ đang hoạt động chuyển được sang Tạm ngừng | T1-STATES | E2E | STATE | P0 |  | CHƯA CHẠY |
| TC-002 | Tổ tạm ngừng hoạt động lại được | T1-STATES | E2E | STATE | P0 |  | CHƯA CHẠY |
| TC-003 | Tổ lưu trữ được và khôi phục được | T1-STATES | E2E | STATE | P1 |  | CHƯA CHẠY |
| TC-004 | Tổ đã lưu trữ không tạm ngừng tiếp được | T1-STATES | API | STATE | P2 |  | CHƯA CHẠY |
| TC-005 | Màn quản trị Tổ có đúng ba tab kèm số đếm | T4-TABS | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-006 | Tổ tạm ngừng biến khỏi ô chọn tổ ở màn tạo Đơn thư | T2-OPTIONS | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-007 | Tổ tạm ngừng biến khỏi ô chọn ở màn bàn giao và phân công | T2-OPTIONS | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-008 | Tổ tạm ngừng biến khỏi ô chọn tổ khi thiết lập báo cáo động | T2-OPTIONS | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-009 | Tổ đã lưu trữ cũng không có trong ô chọn | T2-OPTIONS | API | RED | P1 |  | CHƯA CHẠY |
| TC-010 | Tổ hoạt động lại thì hiện lại trong ô chọn | T2-OPTIONS | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-011 | Hồ sơ cũ của tổ đã ngừng vẫn hiện đúng tên tổ | T3-NAME-KEEP | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-012 | Mỗi thao tác vòng đời có nút chiều ngược ngay trên màn đó | T5-REVERSE | E2E | UX | P1 |  | CHƯA CHẠY |
| TC-013 | Tổ chưa có dữ liệu xoá hẳn được | T6-DELETE | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-014 | Tổ có hồ sơ không có nút Xoá, chỉ có Gộp hoặc Lưu trữ | T6-DELETE | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-015 | Gọi xoá thẳng một tổ có dữ liệu thì bị từ chối và nêu số bản ghi theo từng loại | T6-DELETE | API | RED | P0 |  | CHƯA CHẠY |
| TC-016 | Tổ chỉ có thành viên (chưa có hồ sơ) cũng không xoá hẳn được | T6-DELETE | API | BOUNDARY | P1 |  | CHƯA CHẠY |
| TC-017 | Thêm thành viên vào tổ đúng lúc đang xoá thì không mất ai | T7-DELETE-RACE | API | RED | P1 |  | CHƯA CHẠY |
| TC-018 | Gộp tổ có màn xem trước nêu số bản ghi sẽ chuyển | T8-MERGE | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-019 | Sau khi gộp, hồ sơ của tổ cũ thuộc tổ đích | T8-MERGE | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-020 | Người thuộc cả hai tổ chỉ còn một dòng thành viên ở tổ đích | T8-MERGE | API | EDGE | P1 |  | CHƯA CHẠY |
| TC-021 | Tổ cũ sau khi gộp nằm ở Đã lưu trữ | T8-MERGE | E2E | STATE | P1 |  | CHƯA CHẠY |
| TC-022 | Kỳ báo cáo đã sinh của tổ cũ không bị sửa khi gộp | T8-MERGE | API | RED | P1 |  | CHƯA CHẠY |
| TC-023 | Không gộp được một tổ vào chính nó | T8-MERGE | API | RED | P2 |  | CHƯA CHẠY |
| TC-024 | Hoàn tác gộp đưa hồ sơ và thành viên về tổ cũ | T9-UNDO | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-025 | Hoàn tác bỏ qua bản ghi đã bị đổi sau khi gộp và nêu rõ là đã bỏ qua | T9-UNDO | API | EDGE | P1 |  | CHƯA CHẠY |
| TC-026 | Hoàn tác hai lần thì lần hai bị từ chối | T9-UNDO | API | RED | P2 |  | CHƯA CHẠY |
| TC-027 | Cán bộ thường không đổi được trạng thái tổ | T1-STATES | API | SECURITY | P0 |  | CHƯA CHẠY |

## II. Báo cáo động theo tiêu chí từng tổ (#652–#654)

| ID | Màn hình / chức năng | Luật | Tầng | Loại | Ưu tiên | Cục bộ | Production |
|---|---|---|---|---|---|---|---|
| TC-028 | Tải file Excel lên thì thấy lưới của từng sheet và đổi sheet được | B1-IMPORT | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-029 | Bấm tiêu đề cột thì cả cột thành tiêu chí, theo thứ tự dòng | B1-IMPORT | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-030 | Chọn một số ô trong một cột thì chỉ các ô ấy thành tiêu chí | B1-IMPORT | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-031 | Chọn theo khoảng bằng Shift và "Chọn các dòng đang thấy" | B1-IMPORT | E2E | EDGE | P2 |  | CHƯA CHẠY |
| TC-032 | Không chọn được ô ở hai cột khác nhau làm tiêu chí | B1-IMPORT | E2E | RED | P2 |  | CHƯA CHẠY |
| TC-033 | Đặt cột mã và cột đơn vị tính thì tiêu chí mang mã và ĐVT của cùng dòng | B2-CODE-UNIT | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-034 | Dòng trống mã hoặc trống ĐVT vẫn tạo được tiêu chí với giá trị mặc định | B2-CODE-UNIT | E2E | EDGE | P2 |  | CHƯA CHẠY |
| TC-035 | Thụt lề hoặc đánh số 1 / 1.1 / 1.1.1 thành cây cha con ở xem trước | B3-HIER | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-036 | Khi tổng hợp, mục cha bằng tổng các mục con | B3-HIER | API | GREEN | P1 |  | CHƯA CHẠY |
| TC-037 | Xem trước cảnh báo ô trống, trùng tên, ô gộp, ô công thức | B4-PREVIEW | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-038 | Quá 2.000 dòng thì bị chặn kèm lời giải thích | B4-PREVIEW | E2E | BOUNDARY | P2 |  | CHƯA CHẠY |
| TC-039 | Sửa tên, bỏ dòng, đổi ĐVT ngay ở xem trước mà không phải sửa file | B4-PREVIEW | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-040 | Máy chủ tự đọc lại ô từ file đã lưu, không tin nội dung trình duyệt gửi | B5-SERVER | API | SECURITY | P0 |  | CHƯA CHẠY |
| TC-041 | Ô bắt đầu bằng = + - @ không thành công thức khi mở file xuất | B5-SERVER | API | SECURITY | P1 |  | CHƯA CHẠY |
| TC-042 | Tổ vừa được chọn mặc định phải báo TẤT CẢ tiêu chí | B6-DEFAULT-ALL | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-043 | Bỏ tick một tiêu chí thì tổ ấy không phải báo tiêu chí đó | B7-PER-TEAM | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-044 | Chọn nhanh theo nhóm cha, Chọn hết, Bỏ hết, Đảo | B7-PER-TEAM | E2E | GREEN | P2 |  | CHƯA CHẠY |
| TC-045 | Thêm tay một tiêu chí cho báo cáo này, có nhãn phân biệt với tiêu chí từ file | B7-PER-TEAM | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-046 | Chép bộ tiêu chí từ tổ khác | B7-PER-TEAM | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-047 | Áp một bộ tiêu chí cho nhiều tổ cùng lúc | B7-PER-TEAM | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-048 | Ma trận tổ × tiêu chí cho tick theo hàng, theo cột | B7-PER-TEAM | E2E | GREEN | P2 |  | CHƯA CHẠY |
| TC-049 | Trước khi sang bước sau thấy số tiêu chí mỗi tổ sẽ báo | B7-PER-TEAM | E2E | UX | P2 |  | CHƯA CHẠY |
| TC-050 | Xuất ma trận ra Excel rồi nhập lại thì bộ tick không đổi | B15-MATRIX | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-051 | Nhập ma trận đã sửa thì đổi đúng các ô đã sửa | B15-MATRIX | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-052 | File ma trận hỏng, sai mẫu hoặc nén bom bị từ chối, không đổi gì | B15-MATRIX | API | SECURITY | P1 |  | CHƯA CHẠY |
| TC-053 | Nhập ma trận dựa trên bản cũ khi người khác vừa sửa thì bị báo xung đột | B15-MATRIX | API | RED | P1 |  | CHƯA CHẠY |
| TC-054 | Người nhập của tổ chỉ thấy tiêu chí được giao cho tổ mình | B8-ENTRY-ONLY | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-055 | Dữ liệu trả về cho người nhập không chứa tiêu chí ngoài tập của tổ | B8-ENTRY-ONLY | API | SECURITY | P0 |  | CHƯA CHẠY |
| TC-056 | File tổ tự xuất không có nội dung của tiêu chí không được giao | B8-ENTRY-ONLY | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-057 | Đổi tập tiêu chí của tổ thì màn nhập đang mở nhận tập mới ở lần tải kế tiếp | B8-ENTRY-ONLY | E2E | EDGE | P2 |  | CHƯA CHẠY |
| TC-058 | Lưu giá trị cho tiêu chí không thuộc tổ bị từ chối | B9-REJECT | API | RED | P0 |  | CHƯA CHẠY |
| TC-059 | Nhập Excel có dòng của tiêu chí không thuộc tổ bị từ chối | B9-REJECT | API | RED | P1 |  | CHƯA CHẠY |
| TC-060 | Kiểm tra bắt buộc chỉ xét tiêu chí của tổ | B9-REJECT | E2E | EDGE | P1 |  | CHƯA CHẠY |
| TC-061 | Tổng của một tiêu chí chỉ cộng các tổ được giao tiêu chí đó | B10-AGG | API | GREEN | P0 |  | CHƯA CHẠY |
| TC-062 | Tổ không được giao không bị tính như số 0 | B10-AGG | API | RED | P0 |  | CHƯA CHẠY |
| TC-063 | Độ đầy đủ = số đã nhận / số PHẢI NỘP | B11-COMPLETE | API | GREEN | P0 |  | CHƯA CHẠY |
| TC-064 | Tổ được miễn nộp không nằm trong số phải nộp | B11-COMPLETE | API | EDGE | P1 |  | CHƯA CHẠY |
| TC-065 | Màn Tình trạng chia theo số tiêu chí thuộc từng tổ | B11-COMPLETE | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-066 | Khoá sổ xong có file chính thức trong danh sách tải về | B12-OFFICIAL | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-067 | File chính thức không hết hạn | B12-OFFICIAL | E2E | BOUNDARY | P1 |  | CHƯA CHẠY |
| TC-068 | Sheet đầu "Tổng hợp": mỗi tiêu chí một dòng, có Tổng, Đã nhận/Phải nộp, %, rồi mỗi tổ một cột | B12-OFFICIAL | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-069 | Ô của tổ ở sheet Tổng hợp: giá trị nếu có, đánh dấu thiếu nếu được giao mà chưa nộp, "—" nếu không giao | B12-OFFICIAL | E2E | DECISION | P1 |  | CHƯA CHẠY |
| TC-070 | Sau sheet Tổng hợp, mỗi tổ một sheet chỉ có tiêu chí của tổ đó | B12-OFFICIAL | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-071 | Tạo file lỗi thì kỳ vẫn khoá, có báo lỗi và nút Tạo lại | B13-RETRY | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-072 | Mở lại kỳ thì file chính thức cũ được đánh dấu vô hiệu | B13-RETRY | E2E | STATE | P1 |  | CHƯA CHẠY |
| TC-073 | Đổi tập tiêu chí của kỳ đang chạy phải nhập lý do | B14-MIDPERIOD | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-074 | Đổi tập khi bản nộp đã duyệt thì bản nộp được trả lại kèm lý do | B14-MIDPERIOD | E2E | EDGE | P1 |  | CHƯA CHẠY |
| TC-075 | Kỳ chưa mở nhận tập theo cấu hình mới, không cần thao tác giữa kỳ | B14-MIDPERIOD | API | GREEN | P2 |  | CHƯA CHẠY |
| TC-076 | Tiêu chí mới ở phiên bản sau mặc định giao cho mọi tổ | B17-NEWVERSION | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-077 | Ra phiên bản mới thì tập của tổ được giữ theo MÃ tiêu chí, kể cả khi đổi tên | B17-NEWVERSION | E2E | EDGE | P1 |  | CHƯA CHẠY |
| TC-078 | Báo cáo cũ không cài tập tiêu chí cho ra tổng hợp y như trước | B16-LEGACY | API | REGRESSION | P0 |  | CHƯA CHẠY |
| TC-079 | Người không có quyền quản lý báo cáo không cài được tập tiêu chí | B8-ENTRY-ONLY | API | SECURITY | P0 |  | CHƯA CHẠY |

## III. Quyền theo Tổ (#655–#662)

| ID | Màn hình / chức năng | Luật | Tầng | Loại | Ưu tiên | Cục bộ | Production |
|---|---|---|---|---|---|---|---|
| TC-080 | Chưa bật thì cấu hình ở màn Phân quyền không đổi quyền của ai | A18-OFF | API | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-081 | Phạm vi xem dùng lời Chỉ của mình / Cả tổ / Toàn bộ; thao tác là Thêm / Sửa / Xoá | A31-EASY | E2E | UX | P1 |  | CHƯA CHẠY |
| TC-082 | Phần nâng cao (kế thừa, ngoại lệ, hạn dùng, theo người) nằm sau nút Nâng cao | A31-EASY | E2E | UX | P2 |  | CHƯA CHẠY |
| TC-083 | Tạo mẫu quyền mới và thấy nó trong danh sách | A8-TEMPLATE | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-084 | Sửa mẫu rồi mở lại thấy đúng thay đổi | A8-TEMPLATE | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-085 | Sao chép mẫu cho ra mẫu mới giống hệt, sửa bản sao không đổi bản gốc | A8-TEMPLATE | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-086 | Lưu trữ mẫu rồi khôi phục được | A8-TEMPLATE | E2E | STATE | P1 |  | CHƯA CHẠY |
| TC-087 | Xoá mẫu không tổ nào dùng | A8-TEMPLATE | E2E | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-088 | Mẫu đang có tổ dùng thì không xoá được, và nói rõ tổ nào đang dùng | A8-TEMPLATE | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-089 | Mẫu không có tên thì không lưu được | A8-TEMPLATE | E2E | RED | P2 |  | CHƯA CHẠY |
| TC-090 | Tick cả hàng, cả cột, cả mục trong ma trận mẫu | A9-MATRIX | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-091 | Không cấp được Sửa rộng hơn Xem trên cùng một chức năng | A14-SEE-BEFORE-CHANGE | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-092 | Không cấp được Thêm/Sửa/Xoá khi không cấp Xem | A14-SEE-BEFORE-CHANGE | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-093 | Người lưu không cấp được quyền mà chính họ không có | A13-NO-ESCALATE | API | SECURITY | P0 |  | CHƯA CHẠY |
| TC-094 | Cấp quyền nhạy cảm (Toàn bộ, xuất đầy đủ, quản trị người dùng/vai trò) phải có lý do | A13-NO-ESCALATE | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-095 | Bấm Tạo 3 mẫu khởi đầu thì có ba mẫu: Cán bộ (như hiện nay), Chỉ hồ sơ của mình, Chỉ xem | A17-STARTERS | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-096 | Bấm lần hai không tạo trùng | A17-STARTERS | E2E | EDGE | P2 |  | CHƯA CHẠY |
| TC-097 | Mẫu khởi đầu sửa và xoá được như mẫu thường | A17-STARTERS | E2E | GREEN | P2 |  | CHƯA CHẠY |
| TC-098 | Mỗi tổ chọn riêng mẫu cho Thành viên và mẫu cho Tổ trưởng | A5-MEMBER-LEADER | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-099 | Khi áp dụng, tổ trưởng có quyền theo mẫu Tổ trưởng, thành viên theo mẫu Thành viên | A5-MEMBER-LEADER | API | DECISION | P0 |  | CHƯA CHẠY |
| TC-100 | Tổ chưa cài thì theo cấu hình của tổ cha | A2-INHERIT | API | GREEN | P0 |  | CHƯA CHẠY |
| TC-101 | Cây tổ ghi nhãn Kế thừa hoặc Riêng cho từng tổ | A2-INHERIT | E2E | UX | P2 |  | CHƯA CHẠY |
| TC-102 | Tổ không cài gì và không tổ cha nào cài thì giữ quyền như hiện nay | A1-DEFAULT | API | GREEN | P0 |  | CHƯA CHẠY |
| TC-103 | Hai người sửa cùng cấu hình một tổ: người lưu sau bị báo xung đột | A12-CONFLICT | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-104 | Chép cấu hình từ tổ khác | A10-COPY-APPLY | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-105 | Áp cho nhiều tổ có xem trước rồi mới lưu | A10-COPY-APPLY | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-106 | Áp cho nhiều tổ là tất cả hoặc không: một tổ không hợp lệ thì không tổ nào đổi | A10-COPY-APPLY | API | RED | P1 |  | CHƯA CHẠY |
| TC-107 | Xem trước nêu số người và ai mất quyền gì, bằng lời | A11-PREVIEW | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-108 | Xem trước không ghi gì | A11-PREVIEW | API | RED | P1 |  | CHƯA CHẠY |
| TC-109 | Phạm vi thu hẹp nhưng không mất tổ nào vẫn được đánh dấu "phạm vi hẹp hơn" | A11-PREVIEW | E2E | EDGE | P1 |  | CHƯA CHẠY |
| TC-110 | Thêm quyền riêng cho một người, có lý do và hạn dùng | A6-OVERRIDE | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-111 | Tắt một quyền riêng của một người | A6-OVERRIDE | API | GREEN | P1 |  | CHƯA CHẠY |
| TC-112 | Ngoại lệ hết hạn thì quyền tự mất, không cần ai thao tác | A6-OVERRIDE | API | BOUNDARY | P0 |  | CHƯA CHẠY |
| TC-113 | Ngoại lệ thiếu lý do không lưu được | A6-OVERRIDE | E2E | RED | P2 |  | CHƯA CHẠY |
| TC-114 | Ngày hạn không có thật (31/02) bị từ chối | A6-OVERRIDE | API | DATA | P2 |  | CHƯA CHẠY |
| TC-115 | Tra cứu một người thấy quyền hiệu lực và lý do "vì sao" | A15-LOOKUP | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-116 | Tra cứu nêu cả quyền KHÔNG có và lý do | A15-LOOKUP | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-117 | Từ màn Quản lý người dùng mở được quyền hiệu lực của người đó | A15-LOOKUP | E2E | GREEN | P2 |  | CHƯA CHẠY |
| TC-118 | Người thuộc hai tổ: tra cứu nêu quyền từ từng tổ | A15-LOOKUP | E2E | EDGE | P1 |  | CHƯA CHẠY |
| TC-119 | Mỗi lần lưu cấu hình là một dòng lịch sử: ai, lúc nào, đổi gì | A16-HISTORY-UNDO | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-120 | Hoàn tác đưa cấu hình về như trước và tự nó là một dòng lịch sử mới | A16-HISTORY-UNDO | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-121 | Không hoàn tác được khi đối tượng đã bị sửa tiếp sau đó | A16-HISTORY-UNDO | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-122 | Hoàn tác cũng không cấp vượt quyền người bấm | A16-HISTORY-UNDO | API | SECURITY | P1 |  | CHƯA CHẠY |
| TC-123 | Người không có quyền quản trị vai trò không mở được màn Phân quyền | A18-OFF | API | SECURITY | P0 | PASS | CHƯA CHẠY |
| TC-124 | Thẻ trạng thái nói rõ đang Tắt, Chạy thử hay Áp dụng bằng lời | A19-TWO-ADMIN | E2E | UX | P1 |  | CHƯA CHẠY |
| TC-125 | Bảng "Nếu áp dụng ngay bây giờ" nêu tổng số người, số bị mất, được thêm, đổi phạm vi | A11-PREVIEW | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-126 | Quản trị viên không nằm trong bảng so sánh | A11-PREVIEW | API | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-127 | Thành viên của tổ đã ngừng được nêu là mất phạm vi tổ ấy | A11-PREVIEW | API | EDGE | P1 |  | CHƯA CHẠY |
| TC-128 | Không bật Áp dụng trực tiếp được | A19-TWO-ADMIN | API | RED | P0 | PASS | CHƯA CHẠY |
| TC-129 | Gửi đề nghị cần lý do và tick "đã đọc danh sách" | A19-TWO-ADMIN | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-130 | Người đề nghị không tự duyệt được | A19-TWO-ADMIN | E2E | RED | P0 | PASS | CHƯA CHẠY |
| TC-131 | Quản trị viên thứ hai duyệt thì chế độ thành Áp dụng | A19-TWO-ADMIN | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-132 | Cán bộ không đề nghị, không duyệt, không từ chối được | A19-TWO-ADMIN | API | SECURITY | P0 | PASS | CHƯA CHẠY |
| TC-133 | Khi đã có một đề nghị chờ thì không gửi được đề nghị thứ hai | A19-TWO-ADMIN | API | RED | P1 | PASS | CHƯA CHẠY |
| TC-134 | Đề nghị trên một bảng so sánh chưa đọc (đã cũ) bị từ chối và phải đọc lại | A20-FINGERPRINT | E2E | RED | P0 | PASS | CHƯA CHẠY |
| TC-135 | Cấu hình đổi sau khi đề nghị thì người duyệt không duyệt được đề nghị cũ | A20-FINGERPRINT | API | RED | P0 |  | CHƯA CHẠY |
| TC-136 | Đề nghị quá 24 giờ chưa ai duyệt thì hết hiệu lực | A21-TTL | API | BOUNDARY | P1 |  | CHƯA CHẠY |
| TC-137 | Người đề nghị rút lại được đề nghị của mình | A22-WITHDRAW | E2E | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-138 | Quản trị viên khác từ chối được đề nghị | A22-WITHDRAW | E2E | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-139 | Đề nghị đã đóng không duyệt được nữa | A22-WITHDRAW | API | STATE | P1 |  | CHƯA CHẠY |
| TC-140 | Chuyển sang Chạy thử khi có đề nghị chờ thì đề nghị bị huỷ, có báo trước | A22-WITHDRAW | E2E | EDGE | P2 |  | CHƯA CHẠY |
| TC-141 | Chạy thử bật và dừng được bởi một quản trị viên, không đổi quyền của ai | A19-TWO-ADMIN | API | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-142 | Đổi chế độ thiếu lý do bị từ chối | A19-TWO-ADMIN | API | RED | P1 | PASS | CHƯA CHẠY |
| TC-143 | Màn cấu hình chung không đổi được chế độ phân quyền | A29-SETTINGS | API | SECURITY | P0 | PASS | CHƯA CHẠY |
| TC-144 | Không bật được khi người đề nghị hoặc người duyệt sẽ mất quyền mở màn này | A24-NO-LOCKOUT | API | RED | P0 |  | CHƯA CHẠY |
| TC-145 | Vai trò quản trị không bỏ được quyền xem và sửa vai trò | A24-NO-LOCKOUT | E2E | RED | P1 |  | CHƯA CHẠY |
| TC-146 | Khi áp dụng, cán bộ chỉ còn quyền tổ cấp, và thực đơn theo đó | A25-ENFORCED-PROFILE | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-147 | Màn hình mất quyền thì gõ thẳng địa chỉ cũng không vào được | A25-ENFORCED-PROFILE | E2E | SECURITY | P0 | PASS | CHƯA CHẠY |
| TC-148 | Không có quyền Xoá thì không thấy nút Xoá, và gọi xoá bị từ chối | A25-ENFORCED-PROFILE | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-149 | Chỉ của mình: chỉ thấy hồ sơ do mình phụ trách/nhập | A3-REACH | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-150 | Chỉ của mình: không thấy hồ sơ chưa giao tổ của người khác | A3-REACH | API | RED | P0 |  | CHƯA CHẠY |
| TC-151 | Đúng tổ: thấy hồ sơ giao cho đúng tổ mình, không thấy của tổ con | A3-REACH | API | BOUNDARY | P0 |  | CHƯA CHẠY |
| TC-152 | Đúng tổ: không thấy hồ sơ giao tổ khác dù do thành viên tổ mình xử lý | A3-REACH | API | RED | P0 |  | CHƯA CHẠY |
| TC-153 | Đúng tổ: không thấy hồ sơ chưa giao tổ | A3-REACH | API | RED | P1 |  | CHƯA CHẠY |
| TC-154 | Cả tổ: thấy tổ mình, tổ con, hồ sơ của thành viên và hồ sơ chưa giao, như hôm nay | A3-REACH | E2E | GREEN | P0 |  | CHƯA CHẠY |
| TC-155 | Toàn bộ: thấy hồ sơ của mọi tổ | A3-REACH | API | GREEN | P1 |  | CHƯA CHẠY |
| TC-156 | Mở thẳng một hồ sơ ngoài phạm vi bằng địa chỉ thì bị từ chối | A3-REACH | API | SECURITY | P0 |  | CHƯA CHẠY |
| TC-157 | Tài liệu, đối tượng của hồ sơ theo phạm vi của hồ sơ cha | A3-REACH | API | SECURITY | P0 |  | CHƯA CHẠY |
| TC-158 | Phạm vi Sửa hẹp hơn Xem: xem được cả tổ nhưng chỉ sửa được của mình | A3-REACH | E2E | DECISION | P0 |  | CHƯA CHẠY |
| TC-159 | Phạm vi Đơn thư và phạm vi Vụ án độc lập nhau | A4-PER-SUBJECT | API | DECISION | P0 |  | CHƯA CHẠY |
| TC-160 | Người thuộc hai tổ có hợp quyền, mỗi quyền phủ đúng tổ cấp nó | A4-PER-SUBJECT | API | DECISION | P0 |  | CHƯA CHẠY |
| TC-161 | Quản trị viên không bị giới hạn khi áp dụng | A7-ADMIN | API | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-162 | Thành viên của tổ đã ngừng không còn với tới hồ sơ của tổ ấy khi áp dụng | A10-SCOPE | API | EDGE | P1 |  | CHƯA CHẠY |
| TC-163 | Số trên huy hiệu thực đơn bằng số dòng trong danh sách | A26-ENFORCED-RECORDS | E2E | GREEN | P1 |  | CHƯA CHẠY |
| TC-164 | Số liệu tổng và biểu đồ Trang chủ đếm theo phạm vi của người xem khi áp dụng | A28-DASHBOARD | E2E | RED | P0 |  | CHƯA CHẠY |
| TC-165 | Người không có quyền xem vụ án không đọc được số liệu Trang chủ | A28-DASHBOARD | API | SECURITY | P1 | PASS | CHƯA CHẠY |
| TC-166 | Chưa bật thì Trang chủ đếm toàn đơn vị như trước nay | A28-DASHBOARD | API | REGRESSION | P0 |  | CHƯA CHẠY |
| TC-167 | Thông báo đơn quá hạn chỉ tới người mở được đơn đó khi áp dụng | A27-NOTICE | API | RED | P0 |  | CHƯA CHẠY |
| TC-168 | Chưa bật thì thông báo hạn gửi như trước nay | A27-NOTICE | API | REGRESSION | P1 |  | CHƯA CHẠY |
| TC-169 | Thông báo "được phân công" không tới người không có quyền xem loại hồ sơ đó | A27-NOTICE | API | RED | P2 |  | CHƯA CHẠY |
| TC-170 | Một quản trị viên tắt áp dụng trong một bước, có lý do | A23-OFF-ONE-STEP | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-171 | Tắt xong cán bộ có lại quyền của vai trò ngay, không cần đăng nhập lại | A23-OFF-ONE-STEP | API | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-172 | Tắt không làm mất cấu hình mẫu và tổ | A23-OFF-ONE-STEP | E2E | GREEN | P1 | PASS | CHƯA CHẠY |
| TC-173 | Lịch sử bật/tắt nêu ai đề nghị, ai quyết định, lý do, từ chế độ nào sang chế độ nào | A32-AUDIT | E2E | GREEN | P0 | PASS | CHƯA CHẠY |
| TC-174 | Đổi chế độ để lại bản ghi trong nhật ký hệ thống, chỉ có siêu dữ liệu | A32-AUDIT | API | DATA | P1 |  | CHƯA CHẠY |
| TC-175 | Đang áp dụng mà hệ thống không đọc được cấu hình quyền thì từ chối, không lùi về vai trò | A30-UNAVAILABLE | API | RED | P1 |  | CHƯA CHẠY |
| TC-176 | Lời báo khi hệ thống phân quyền chưa sẵn sàng là lời tiếng Việt dễ hiểu | A30-UNAVAILABLE | E2E | UX | P2 |  | CHƯA CHẠY |
| TC-177 | Màn Phân quyền dùng được bằng bàn phím và đọc được bằng trình đọc màn hình | A31-EASY | E2E | A11Y | P2 |  | CHƯA CHẠY |
| TC-178 | Màn Phân quyền dùng được ở bề rộng máy tính xách tay 1366 | A31-EASY | E2E | COMPAT | P2 |  | CHƯA CHẠY |
| TC-179 | Bảng so sánh với hơn 200 người vẫn đọc và cuộn được | A11-PREVIEW | E2E | UX | P2 |  | CHƯA CHẠY |

## Đối chiếu ngược

Mỗi luật trong `_domain-pack.md` có ít nhất một dòng ở trên (`_build.py` dừng nếu có luật không dòng nào). Mỗi dòng trỏ về đúng một luật.
