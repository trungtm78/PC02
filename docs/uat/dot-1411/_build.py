# -*- coding: utf-8 -*-
"""Sinh `_coverage-ledger.md`, `UAT-COVERAGE.md` và `uat.json` của đợt 14/11/2026 từ MỘT bảng mệnh đề.

Ba tệp ấy phải nói cùng một điều; viết tay ba lần là ba cơ hội lệch nhau. Sửa nội dung thì sửa bảng `ITEMS`
bên dưới rồi chạy lại:  python docs/uat/dot-1411/_build.py

Oracle của từng dòng lấy từ `_domain-pack.md` (yêu cầu của anh + tệp kế hoạch), KHÔNG lấy từ mã.
"""
import io, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
WF = 'LOCAL'  # đã chạy trên máy chủ dựng cục bộ bằng tools/uat-phan-quyen/workflow.cjs (40/40, 14/11)

# (rule, claim, layer, type, persona, journey, priority, severity, steps, expected, catches_bug, extra)
# layer: E2E = trình duyệt thật + máy chủ + CSDL thật · API = HTTP thật · UNIT chỉ khi chủ ngữ là một hàm.
ADMIN, ADMIN2, CB, TT, CBK, NN, QL, VD = 'P-QUAN-TRI', 'P-QUAN-TRI-2', 'P-CAN-BO', 'P-TO-TRUONG', 'P-CAN-BO-KHAC-TO', 'P-NGUOI-NHAP', 'P-QUAN-LY-BC', 'P-VO-DANH'
acc = lambda url, allow, method='GET': {'access': {'url': url, 'method': method, 'allow': allow, 'deny_status': [401, 403]}}
tr = lambda a, b, ok: {'transition': {'from': a, 'to': b, 'allowed': ok}}

ITEMS = [
 # ── I. Vòng đời Tổ (#650) ────────────────────────────────────────────────────────────────────────────────────
 ('T1-STATES', 'Tổ đang hoạt động chuyển được sang Tạm ngừng', 'E2E', 'STATE', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S2', 'Quản trị Tổ; chọn một tổ đang hoạt động; bấm Tạm ngừng; xác nhận', 'Tổ rời tab Đang hoạt động, xuất hiện ở tab Tạm ngừng', 'nút Tạm ngừng không đổi trạng thái', tr('ACTIVE', 'INACTIVE', True)),
 ('T1-STATES', 'Tổ tạm ngừng hoạt động lại được', 'E2E', 'STATE', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S2', 'Tab Tạm ngừng; bấm Hoạt động lại', 'Tổ trở về tab Đang hoạt động', 'tạm ngừng là ngõ cụt', tr('INACTIVE', 'ACTIVE', True)),
 ('T1-STATES', 'Tổ lưu trữ được và khôi phục được', 'E2E', 'STATE', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S2', 'Lưu trữ một tổ; sang tab Đã lưu trữ; bấm Khôi phục', 'Sau Lưu trữ tổ ở tab Đã lưu trữ; sau Khôi phục tổ trở lại danh sách dùng được', 'lưu trữ xong không lấy lại được', tr('ARCHIVED', 'ACTIVE', True)),
 ('T1-STATES', 'Tổ đã lưu trữ không tạm ngừng tiếp được', 'API', 'STATE', ADMIN, 'J-TO-VONG-DOI', 'P2', 'S3', 'Gọi thao tác Tạm ngừng lên một tổ đã lưu trữ', 'Bị từ chối có mã lỗi; trạng thái giữ nguyên Đã lưu trữ', 'chuyển trạng thái tuỳ tiện', tr('ARCHIVED', 'INACTIVE', False)),
 ('T4-TABS', 'Màn quản trị Tổ có đúng ba tab kèm số đếm', 'E2E', 'GREEN', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S3', 'Mở Quản trị Tổ', 'Ba tab Đang hoạt động / Tạm ngừng / Đã lưu trữ; số trên tab bằng số dòng trong tab', 'số trên tab lệch số dòng', None),
 ('T2-OPTIONS', 'Tổ tạm ngừng biến khỏi ô chọn tổ ở màn tạo Đơn thư', 'E2E', 'RED', CB, 'J-TO-VONG-DOI', 'P0', 'S2', 'Tạm ngừng tổ X; mở màn tạo Đơn thư; mở ô chọn tổ', 'Không còn tổ X trong ô chọn', 'tổ đã ngừng vẫn chọn được khi giao việc', None),
 ('T2-OPTIONS', 'Tổ tạm ngừng biến khỏi ô chọn ở màn bàn giao và phân công', 'E2E', 'RED', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S2', 'Tạm ngừng tổ X; mở màn bàn giao / phân công; mở ô chọn tổ', 'Không còn tổ X', 'một trong 11 chỗ gọi danh sách tổ bị sót', None),
 ('T2-OPTIONS', 'Tổ tạm ngừng biến khỏi ô chọn tổ khi thiết lập báo cáo động', 'E2E', 'RED', QL, 'J-BC-THIET-LAP', 'P1', 'S2', 'Tạm ngừng tổ X; mở wizard báo cáo, bước chọn tổ', 'Không còn tổ X để chọn', 'báo cáo giao cho tổ đã ngừng', None),
 ('T2-OPTIONS', 'Tổ đã lưu trữ cũng không có trong ô chọn', 'API', 'RED', CB, 'J-TO-VONG-DOI', 'P1', 'S2', 'Lưu trữ tổ Y; lấy danh sách ô chọn tổ', 'Danh sách chỉ gồm tổ đang hoạt động; không có Y', 'ô chọn chỉ lọc tạm ngừng, sót lưu trữ', None),
 ('T2-OPTIONS', 'Tổ hoạt động lại thì hiện lại trong ô chọn', 'E2E', 'GREEN', CB, 'J-TO-VONG-DOI', 'P1', 'S3', 'Hoạt động lại tổ X; mở ô chọn tổ', 'Tổ X có trong ô chọn', 'bật lại mà ô chọn còn nhớ bản cũ', None),
 ('T3-NAME-KEEP', 'Hồ sơ cũ của tổ đã ngừng vẫn hiện đúng tên tổ', 'E2E', 'GREEN', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S2', 'Tạm ngừng tổ X đang có hồ sơ; mở danh sách và chi tiết một hồ sơ của X', 'Cột/ô Tổ vẫn ghi tên tổ X, không rỗng, không hiện mã', 'ngừng tổ làm mất tên tổ trên hồ sơ cũ', None),
 ('T5-REVERSE', 'Mỗi thao tác vòng đời có nút chiều ngược ngay trên màn đó', 'E2E', 'UX', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S3', 'Lần lượt Tạm ngừng, Lưu trữ; ở mỗi tab tìm nút đưa tổ trở lại', 'Tạm ngừng có Hoạt động lại; Lưu trữ có Khôi phục; không phải đi màn khác', 'tạo xong là kẹt', None),
 ('T6-DELETE', 'Tổ chưa có dữ liệu xoá hẳn được', 'E2E', 'GREEN', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S2', 'Tạo tổ mới chưa có người, chưa có hồ sơ; bấm Xoá; xác nhận', 'Tổ biến khỏi cả ba tab', 'xoá chỉ là ẩn', None),
 ('T6-DELETE', 'Tổ có hồ sơ không có nút Xoá, chỉ có Gộp hoặc Lưu trữ', 'E2E', 'RED', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S1', 'Mở dòng một tổ đang có hồ sơ', 'Không có nút Xoá; có Gộp vào tổ khác và Lưu trữ', 'xoá tổ làm mồ côi hồ sơ', None),
 ('T6-DELETE', 'Gọi xoá thẳng một tổ có dữ liệu thì bị từ chối và nêu số bản ghi theo từng loại', 'API', 'RED', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S1', 'Gọi xoá tổ đang có thành viên và hồ sơ', 'Từ chối kèm mã lỗi và số bản ghi phụ thuộc theo từng loại; tổ còn nguyên', 'máy chủ tin giao diện', None),
 ('T6-DELETE', 'Tổ chỉ có thành viên (chưa có hồ sơ) cũng không xoá hẳn được', 'API', 'BOUNDARY', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S2', 'Tổ có đúng 1 thành viên, 0 hồ sơ; gọi xoá', 'Từ chối; thành viên còn nguyên', 'xoá kéo theo mất thành viên (quan hệ Cascade)', None),
 ('T7-DELETE-RACE', 'Thêm thành viên vào tổ đúng lúc đang xoá thì không mất ai', 'API', 'RED', ADMIN, 'J-TO-VONG-DOI', 'P1', 'S1', 'Cùng lúc: một lệnh xoá tổ rỗng và một lệnh thêm thành viên vào tổ ấy', 'Hoặc xoá thành công và lệnh thêm bị từ chối, hoặc ngược lại; không có thành viên trỏ vào tổ đã mất', 'kẽ hở giữa xem trước và xoá', None),
 ('T8-MERGE', 'Gộp tổ có màn xem trước nêu số bản ghi sẽ chuyển', 'E2E', 'GREEN', ADMIN, 'J-TO-GOP', 'P0', 'S2', 'Chọn Gộp vào tổ khác; chọn tổ đích', 'Trước khi xác nhận thấy số hồ sơ, số thành viên sẽ chuyển theo từng loại', 'gộp hàng loạt mà không biết trước', None),
 ('T8-MERGE', 'Sau khi gộp, hồ sơ của tổ cũ thuộc tổ đích', 'E2E', 'GREEN', ADMIN, 'J-TO-GOP', 'P0', 'S1', 'Gộp tổ A vào tổ B; mở danh sách hồ sơ lọc theo tổ B', 'Hồ sơ trước đây của A nay hiện dưới tổ B; số lượng bằng số ở màn xem trước', 'gộp làm rơi hồ sơ', None),
 ('T8-MERGE', 'Người thuộc cả hai tổ chỉ còn một dòng thành viên ở tổ đích', 'API', 'EDGE', ADMIN, 'J-TO-GOP', 'P1', 'S2', 'A và B có chung một người; gộp A vào B', 'Người ấy thuộc B đúng một lần; nếu là tổ trưởng ở một trong hai thì vẫn là tổ trưởng', 'trùng khoá làm gộp vỡ giữa chừng', None),
 ('T8-MERGE', 'Tổ cũ sau khi gộp nằm ở Đã lưu trữ', 'E2E', 'STATE', ADMIN, 'J-TO-GOP', 'P1', 'S3', 'Gộp A vào B; mở tab Đã lưu trữ', 'Tổ A ở tab Đã lưu trữ, không còn ở Đang hoạt động', 'tổ cũ vẫn nhận việc sau khi gộp', tr('ACTIVE', 'ARCHIVED', True)),
 ('T8-MERGE', 'Kỳ báo cáo đã sinh của tổ cũ không bị sửa khi gộp', 'API', 'RED', QL, 'J-TO-GOP', 'P1', 'S2', 'Tổ A có lượt giao của một kỳ đã sinh; gộp A vào B; đọc lại kỳ ấy', 'Lượt giao của kỳ đã sinh vẫn đứng tên tổ A (lịch sử giữ nguyên)', 'gộp viết lại lịch sử báo cáo', None),
 ('T8-MERGE', 'Không gộp được một tổ vào chính nó', 'API', 'RED', ADMIN, 'J-TO-GOP', 'P2', 'S3', 'Gọi gộp tổ A vào tổ A', 'Từ chối có mã lỗi; không gì thay đổi', 'gộp vào chính mình rồi lưu trữ chính mình', None),
 ('T9-UNDO', 'Hoàn tác gộp đưa hồ sơ và thành viên về tổ cũ', 'E2E', 'GREEN', ADMIN, 'J-TO-GOP', 'P0', 'S1', 'Gộp A vào B; bấm Hoàn tác', 'Hồ sơ và thành viên đã chuyển trở về A; A hoạt động lại', 'gộp không có đường lui', None),
 ('T9-UNDO', 'Hoàn tác bỏ qua bản ghi đã bị đổi sau khi gộp và nêu rõ là đã bỏ qua', 'API', 'EDGE', ADMIN, 'J-TO-GOP', 'P1', 'S2', 'Gộp A vào B; chuyển một hồ sơ từ B sang C; hoàn tác', 'Hồ sơ đã chuyển sang C ở nguyên C và được liệt kê là bỏ qua; phần còn lại về A', 'hoàn tác đè lên thay đổi sau đó', None),
 ('T9-UNDO', 'Hoàn tác hai lần thì lần hai bị từ chối', 'API', 'RED', ADMIN, 'J-TO-GOP', 'P2', 'S3', 'Hoàn tác một lần gộp; gọi hoàn tác lần nữa', 'Lần hai bị từ chối có mã lỗi', 'hoàn tác lặp làm xáo dữ liệu', None),
 ('T1-STATES', 'Cán bộ thường không đổi được trạng thái tổ', 'API', 'SECURITY', ADMIN, 'J-TO-VONG-DOI', 'P0', 'S1', 'Dùng tài khoản cán bộ gọi Tạm ngừng / Lưu trữ / Xoá / Gộp', 'Bị từ chối; tổ giữ nguyên', 'route vòng đời thiếu kiểm quyền', acc('/api/v1/teams', [ADMIN, ADMIN2], 'POST')),

 # ── II. Báo cáo động theo tiêu chí từng Tổ (#652–#654) ──────────────────────────────────────────────────────
 ('B1-IMPORT', 'Tải file Excel lên thì thấy lưới của từng sheet và đổi sheet được', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Wizard báo cáo, bước mẫu; tải file có 2 sheet', 'Hiện lưới chỉ đọc của sheet đầu; chọn được sheet thứ hai', 'chỉ đọc được sheet đầu', None),
 ('B1-IMPORT', 'Bấm tiêu đề cột thì cả cột thành tiêu chí, theo thứ tự dòng', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Bấm tiêu đề cột chứa tên chỉ tiêu', 'Danh sách xem trước có mỗi ô chữ của cột là một tiêu chí, đúng thứ tự trên file', 'đảo thứ tự hoặc sót dòng', None),
 ('B1-IMPORT', 'Chọn một số ô trong một cột thì chỉ các ô ấy thành tiêu chí', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Tick 3 ô rời nhau trong một cột', 'Xem trước có đúng 3 tiêu chí ấy', 'chọn ô mà lấy cả cột', None),
 ('B1-IMPORT', 'Chọn theo khoảng bằng Shift và "Chọn các dòng đang thấy"', 'E2E', 'EDGE', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'Bấm ô đầu; giữ Shift bấm ô cuối; rồi thử Chọn các dòng đang thấy', 'Khoảng giữa được chọn hết; lệnh chọn nhanh chọn đúng các dòng đang hiển thị', 'chọn nhanh lệch một dòng', None),
 ('B1-IMPORT', 'Không chọn được ô ở hai cột khác nhau làm tiêu chí', 'E2E', 'RED', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'Đã chọn ô ở cột B; thử tick thêm ô ở cột D', 'Lựa chọn chỉ nằm trong một cột (bị chặn hoặc chuyển hẳn sang cột mới)', 'tiêu chí trộn từ nhiều cột, sai thứ tự', None),
 ('B2-CODE-UNIT', 'Đặt cột mã và cột đơn vị tính thì tiêu chí mang mã và ĐVT của cùng dòng', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Đặt cột A làm cột mã, cột C làm cột ĐVT', 'Mỗi tiêu chí ở xem trước có mã và ĐVT lấy từ đúng dòng của nó', 'mã lệch dòng với tên', None),
 ('B2-CODE-UNIT', 'Dòng trống mã hoặc trống ĐVT vẫn tạo được tiêu chí với giá trị mặc định', 'E2E', 'EDGE', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'File có vài dòng không có mã, không có ĐVT', 'Các dòng ấy vẫn thành tiêu chí; mã được sinh, ĐVT để trống hoặc mặc định', 'thiếu mã làm hỏng cả lượt nhập', None),
 ('B3-HIER', 'Thụt lề hoặc đánh số 1 / 1.1 / 1.1.1 thành cây cha con ở xem trước', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'File có mục 1, 1.1, 1.2, 2', 'Xem trước dạng cây: 1.1 và 1.2 nằm dưới 1', 'mất cấp cha con', None),
 ('B3-HIER', 'Khi tổng hợp, mục cha bằng tổng các mục con', 'API', 'GREEN', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'Nhập 1.1 = 3, 1.2 = 4; xem tổng hợp', 'Mục 1 hiện 7', 'mục cha không cộng con', None),
 ('B4-PREVIEW', 'Xem trước cảnh báo ô trống, trùng tên, ô gộp, ô công thức', 'E2E', 'RED', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'File có một ô trống, hai tên trùng, một ô gộp, một ô công thức trong phạm vi chọn', 'Mỗi loại có một cảnh báo nêu đúng dòng', 'nhập thầm lặng dữ liệu xấu', None),
 ('B4-PREVIEW', 'Quá 2.000 dòng thì bị chặn kèm lời giải thích', 'E2E', 'BOUNDARY', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'Chọn cột có 2.001 ô chữ', 'Bị chặn và nói rõ giới hạn 2.000; với đúng 2.000 thì qua', 'treo trình duyệt vì file quá lớn', None),
 ('B4-PREVIEW', 'Sửa tên, bỏ dòng, đổi ĐVT ngay ở xem trước mà không phải sửa file', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Ở xem trước: đổi tên một dòng, bỏ một dòng, đổi ĐVT một dòng; lưu', 'Bộ tiêu chí lưu đúng theo ba chỉnh sửa ấy', 'phải sửa Excel rồi tải lại vì một lỗi chính tả', None),
 ('B5-SERVER', 'Máy chủ tự đọc lại ô từ file đã lưu, không tin nội dung trình duyệt gửi', 'API', 'SECURITY', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Gửi yêu cầu tạo tiêu chí với (sheet, cột, dòng) hợp lệ nhưng kèm tên tiêu chí bịa', 'Tiêu chí được tạo mang tên ĐỌC TỪ FILE, không phải tên bịa', 'chèn tiêu chí không có trong file', acc('/api/v1/dynamic-reports', [ADMIN, QL], 'POST')),
 ('B5-SERVER', 'Ô bắt đầu bằng = + - @ không thành công thức khi mở file xuất', 'API', 'SECURITY', QL, 'J-BC-THIET-LAP', 'P1', 'S2', 'File có ô tên "=HYPERLINK(...)"; nhập; xuất file', 'Trong file xuất, ô ấy là chữ thường, không chạy công thức', 'CSV/Excel injection', acc('/api/v1/dynamic-reports', [ADMIN, QL], 'POST')),
 ('B6-DEFAULT-ALL', 'Tổ vừa được chọn mặc định phải báo TẤT CẢ tiêu chí', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Bước chọn tổ; chọn một tổ; mở phần Tiêu chí tổ này phải báo', 'Mọi tiêu chí đều đang tick; dòng đếm ghi N/N', 'mặc định rỗng làm tổ không phải báo gì', None),
 ('B7-PER-TEAM', 'Bỏ tick một tiêu chí thì tổ ấy không phải báo tiêu chí đó', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P0', 'S2', 'Bỏ tick 2 tiêu chí của tổ A; lưu', 'Đếm của tổ A giảm 2; tổ khác không đổi', 'bỏ tick của tổ này ảnh hưởng tổ khác', None),
 ('B7-PER-TEAM', 'Chọn nhanh theo nhóm cha, Chọn hết, Bỏ hết, Đảo', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'Tick nhóm cha; bấm Bỏ hết; bấm Chọn hết; bấm Đảo', 'Tick nhóm cha chọn mọi con; ba nút làm đúng tên gọi', 'nút chọn nhanh làm sai', None),
 ('B7-PER-TEAM', 'Thêm tay một tiêu chí cho báo cáo này, có nhãn phân biệt với tiêu chí từ file', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Gõ một tiêu chí mới (tên, ĐVT, mục cha); lưu', 'Tiêu chí mới có trong danh sách và mang nhãn khác tiêu chí nạp từ file', 'muốn thêm một dòng phải sửa Excel', None),
 ('B7-PER-TEAM', 'Chép bộ tiêu chí từ tổ khác', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Tổ B: bấm Chép từ tổ; chọn tổ A', 'Bộ tick của B giống hệt A', 'chép sai hoặc chép ngược', None),
 ('B7-PER-TEAM', 'Áp một bộ tiêu chí cho nhiều tổ cùng lúc', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Bấm Áp cho nhiều tổ; chọn 3 tổ; xác nhận', 'Cả 3 tổ có cùng bộ tick; tổ không chọn giữ nguyên', 'áp nhầm cho tổ không chọn', None),
 ('B7-PER-TEAM', 'Ma trận tổ × tiêu chí cho tick theo hàng, theo cột', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P2', 'S3', 'Mở Xem dạng ma trận; tick một ô; tick cả hàng; tick cả cột', 'Mỗi thao tác đổi đúng các ô tương ứng; số đếm mỗi tổ cập nhật', 'ma trận và danh sách nói khác nhau', None),
 ('B7-PER-TEAM', 'Trước khi sang bước sau thấy số tiêu chí mỗi tổ sẽ báo', 'E2E', 'UX', QL, 'J-BC-THIET-LAP', 'P2', 'S4', 'Sau khi cài cho 3 tổ, nhìn phần tóm tắt', 'Mỗi tổ một dòng dạng "Tổ A: 45/120"', 'không biết đã cài đúng chưa trước khi xuất bản', None),
 ('B15-MATRIX', 'Xuất ma trận ra Excel rồi nhập lại thì bộ tick không đổi', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Xuất ma trận; không sửa; nhập lại', 'Không ô nào đổi; báo 0 thay đổi', 'khứ hồi làm lệch dữ liệu', None),
 ('B15-MATRIX', 'Nhập ma trận đã sửa thì đổi đúng các ô đã sửa', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Xuất ma trận; đổi 2 ô trong Excel; nhập lại', 'Đúng 2 ô đổi; xem trước nêu 2 thay đổi trước khi lưu', 'nhập đè cả bảng', None),
 ('B15-MATRIX', 'File ma trận hỏng, sai mẫu hoặc nén bom bị từ chối, không đổi gì', 'API', 'SECURITY', QL, 'J-BC-THIET-LAP', 'P1', 'S2', 'Nhập một file không phải mẫu ma trận; một file giải nén ra cực lớn', 'Cả hai bị từ chối có mã lỗi; bộ tick giữ nguyên', 'file độc làm sập máy chủ', acc('/api/v1/dynamic-reports', [ADMIN, QL], 'POST')),
 ('B15-MATRIX', 'Nhập ma trận dựa trên bản cũ khi người khác vừa sửa thì bị báo xung đột', 'API', 'RED', QL, 'J-BC-THIET-LAP', 'P1', 'S2', 'A xuất ma trận; B sửa và lưu; A nhập file của mình', 'A bị từ chối vì dữ liệu đã đổi; thay đổi của B còn nguyên', 'người sau đè người trước', None),
 ('B8-ENTRY-ONLY', 'Người nhập của tổ chỉ thấy tiêu chí được giao cho tổ mình', 'E2E', 'GREEN', NN, 'J-BC-NHAP', 'P0', 'S1', 'Tổ A được giao 3/10 tiêu chí; người nhập của A mở màn nhập', 'Lưới có đúng 3 dòng ấy', 'tổ thấy tiêu chí của tổ khác', None),
 ('B8-ENTRY-ONLY', 'Dữ liệu trả về cho người nhập không chứa tiêu chí ngoài tập của tổ', 'API', 'SECURITY', NN, 'J-BC-NHAP', 'P0', 'S1', 'Người nhập của A tải mô hình lưới và giá trị', 'Phản hồi không có mã hay tên của 7 tiêu chí không giao (không chỉ ẩn trên màn hình)', 'ẩn ở giao diện nhưng lộ trong phản hồi', acc('/api/v1/dynamic-reports', [NN, QL, ADMIN])),
 ('B8-ENTRY-ONLY', 'File tổ tự xuất không có nội dung của tiêu chí không được giao', 'E2E', 'RED', NN, 'J-BC-NHAP', 'P0', 'S1', 'Người nhập của A xuất file của tổ mình', 'File chỉ có 3 tiêu chí của A; không ô nào mang tên/giá trị tiêu chí khác', 'file xuất lộ tiêu chí', None),
 ('B8-ENTRY-ONLY', 'Đổi tập tiêu chí của tổ thì màn nhập đang mở nhận tập mới ở lần tải kế tiếp', 'E2E', 'EDGE', NN, 'J-BC-NHAP', 'P2', 'S3', 'Người nhập đang mở lưới; quản lý bỏ một tiêu chí của tổ; người nhập tải lại', 'Lưới không còn dòng vừa bỏ (không dùng bản đệm cũ)', 'bộ đệm giữ tập cũ', None),
 ('B9-REJECT', 'Lưu giá trị cho tiêu chí không thuộc tổ bị từ chối', 'API', 'RED', NN, 'J-BC-NHAP', 'P0', 'S1', 'Người nhập của A gửi giá trị cho một tiêu chí không giao cho A', 'Từ chối với mã FIELD_NOT_ASSIGNED; không giá trị nào được ghi', 'ghi lậu vào tiêu chí của tổ khác', None),
 ('B9-REJECT', 'Nhập Excel có dòng của tiêu chí không thuộc tổ bị từ chối', 'API', 'RED', NN, 'J-BC-NHAP', 'P1', 'S2', 'Nhập file có thêm một dòng tiêu chí không giao', 'Lượt nhập bị từ chối nêu dòng sai; các giá trị cũ còn nguyên', 'đường nhập Excel đi vòng qua kiểm tra', None),
 ('B9-REJECT', 'Kiểm tra bắt buộc chỉ xét tiêu chí của tổ', 'E2E', 'EDGE', NN, 'J-BC-NHAP', 'P1', 'S2', 'Tổ A có 3 tiêu chí bắt buộc; báo cáo có tiêu chí bắt buộc khác không giao cho A; A điền đủ 3 rồi nộp', 'Nộp được; không bị đòi tiêu chí không giao', 'tổ không nộp được vì tiêu chí không phải của mình', None),
 ('B10-AGG', 'Tổng của một tiêu chí chỉ cộng các tổ được giao tiêu chí đó', 'API', 'GREEN', QL, 'J-BC-KHOA-SO', 'P0', 'S1', 'Tiêu chí X giao cho A (20) và B (25), không giao cho C; xem tổng', 'Tổng X = 45', 'tổng sai', None),
 ('B10-AGG', 'Tổ không được giao không bị tính như số 0', 'API', 'RED', QL, 'J-BC-KHOA-SO', 'P0', 'S1', 'Như trên; xem ô của tổ C và các phép tính trung bình', 'Ô của C là "—" (không giao), không phải 0; trung bình chia cho 2', 'tổ không giao kéo trung bình xuống', None),
 ('B11-COMPLETE', 'Độ đầy đủ = số đã nhận / số PHẢI NỘP', 'API', 'GREEN', QL, 'J-BC-KHOA-SO', 'P0', 'S1', 'X giao cho A và B; chỉ A nộp', 'X hiện 1/2 và 50%', 'báo 1/1 = 100% trong khi thiếu một tổ', None),
 ('B11-COMPLETE', 'Tổ được miễn nộp không nằm trong số phải nộp', 'API', 'EDGE', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'X giao cho A, B; B được miễn nộp; A nộp', 'X hiện 1/1 và 100%', 'miễn nộp vẫn bị tính thiếu', None),
 ('B11-COMPLETE', 'Màn Tình trạng chia theo số tiêu chí thuộc từng tổ', 'E2E', 'GREEN', QL, 'J-BC-KHOA-SO', 'P1', 'S3', 'Tổ A được giao 3, đã điền 3; tổ B được giao 10, đã điền 5', 'A hiện 3/3; B hiện 5/10', 'mọi tổ bị chia cho tổng số tiêu chí của báo cáo', None),
 ('B12-OFFICIAL', 'Khoá sổ xong có file chính thức trong danh sách tải về', 'E2E', 'GREEN', QL, 'J-BC-KHOA-SO', 'P0', 'S2', 'Khoá sổ một kỳ; mở danh sách file', 'Có file chính thức của kỳ, tải được', 'khoá sổ xong không có file', None),
 ('B12-OFFICIAL', 'File chính thức không hết hạn', 'E2E', 'BOUNDARY', QL, 'J-BC-KHOA-SO', 'P1', 'S3', 'Mở lại danh sách file sau hơn 24 giờ kể từ lúc khoá sổ', 'File vẫn tải được', 'file biến mất sau 24 giờ như file xuất thường', None),
 ('B12-OFFICIAL', 'Sheet đầu "Tổng hợp": mỗi tiêu chí một dòng, có Tổng, Đã nhận/Phải nộp, %, rồi mỗi tổ một cột', 'E2E', 'GREEN', QL, 'J-BC-KHOA-SO', 'P0', 'S2', 'Mở file chính thức, sheet đầu', 'Đúng bố cục ấy; số Tổng và % khớp phép tính tay trên dữ liệu đã nhập', 'sheet tổng hợp sai số', None),
 ('B12-OFFICIAL', 'Ô của tổ ở sheet Tổng hợp: giá trị nếu có, đánh dấu thiếu nếu được giao mà chưa nộp, "—" nếu không giao', 'E2E', 'DECISION', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'Dựng ba trường hợp cho ba tổ trên cùng một tiêu chí; khoá sổ; mở file', 'Ba ô hiện đúng ba kiểu', 'không phân biệt được thiếu với không giao', None),
 ('B12-OFFICIAL', 'Sau sheet Tổng hợp, mỗi tổ một sheet chỉ có tiêu chí của tổ đó', 'E2E', 'GREEN', QL, 'J-BC-KHOA-SO', 'P0', 'S2', 'Mở từng sheet tổ trong file chính thức', 'Số sheet tổ bằng số tổ; mỗi sheet chỉ có tiêu chí giao cho tổ ấy', 'sheet tổ chứa tiêu chí của tổ khác', None),
 ('B13-RETRY', 'Tạo file lỗi thì kỳ vẫn khoá, có báo lỗi và nút Tạo lại', 'E2E', 'RED', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'Gây lỗi tạo file (theo cách môi trường thử cho phép); khoá sổ', 'Kỳ đã khoá; màn kỳ báo tạo file lỗi và có nút Tạo lại; bấm thì có file', 'khoá sổ thành công mà không ai biết thiếu file', None),
 ('B13-RETRY', 'Mở lại kỳ thì file chính thức cũ được đánh dấu vô hiệu', 'E2E', 'STATE', ADMIN, 'J-BC-KHOA-SO', 'P1', 'S2', 'Kỳ đã có file chính thức; quản trị mở lại kỳ', 'File cũ mang nhãn vô hiệu; khoá sổ lại thì có file mới', 'file cũ vẫn được coi là chính thức sau khi số liệu đổi', tr('LOCKED', 'REOPENED', True)),
 ('B14-MIDPERIOD', 'Đổi tập tiêu chí của kỳ đang chạy phải nhập lý do', 'E2E', 'RED', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'Kỳ đang chạy; đổi tập tiêu chí của một tổ; để trống lý do', 'Không lưu được khi thiếu lý do; có lý do thì lưu và ghi lại ai, khi nào', 'đổi giữa kỳ không để lại dấu vết', None),
 ('B14-MIDPERIOD', 'Đổi tập khi bản nộp đã duyệt thì bản nộp được trả lại kèm lý do', 'E2E', 'EDGE', QL, 'J-BC-KHOA-SO', 'P1', 'S2', 'Bản nộp của tổ đã duyệt; thêm một tiêu chí cho tổ', 'Bản nộp trở về trạng thái trả lại, có lý do; tổ phải điền tiêu chí mới', 'bản đã duyệt thiếu tiêu chí vừa giao', None),
 ('B14-MIDPERIOD', 'Kỳ chưa mở nhận tập theo cấu hình mới, không cần thao tác giữa kỳ', 'API', 'GREEN', QL, 'J-BC-KHOA-SO', 'P2', 'S3', 'Đổi cấu hình tập của tổ; để kỳ kế tiếp sinh ra', 'Kỳ mới dùng tập mới; kỳ đã sinh giữ tập đã chụp', 'đổi cấu hình làm thay kỳ đã sinh', None),
 ('B17-NEWVERSION', 'Tiêu chí mới ở phiên bản sau mặc định giao cho mọi tổ', 'E2E', 'GREEN', QL, 'J-BC-THIET-LAP', 'P1', 'S3', 'Ra phiên bản mới có thêm một tiêu chí', 'Tiêu chí mới được tick cho mọi tổ; màn xuất bản cho đổi', 'tiêu chí mới không tổ nào phải báo', None),
 ('B17-NEWVERSION', 'Ra phiên bản mới thì tập của tổ được giữ theo MÃ tiêu chí, kể cả khi đổi tên', 'E2E', 'EDGE', QL, 'J-BC-THIET-LAP', 'P1', 'S2', 'Đổi tên một tiêu chí và đổi vị trí dòng trong file; ra phiên bản mới', 'Tổ nào đang báo tiêu chí ấy vẫn báo nó; màn so khác biệt ghi "đổi tên"', 'đổi tên làm rơi tiêu chí khỏi tập của tổ', None),
 ('B16-LEGACY', 'Báo cáo cũ không cài tập tiêu chí cho ra tổng hợp y như trước', 'API', 'REGRESSION', QL, 'J-BC-KHOA-SO', 'P0', 'S1', 'Báo cáo đã có từ trước đợt này (mọi tổ cùng một bộ ô); xem tổng hợp và độ đầy đủ', 'Số liệu bằng đúng số trước đợt này', 'gom vòng tính làm lệch báo cáo đang dùng', None),
 ('B8-ENTRY-ONLY', 'Người không có quyền quản lý báo cáo không cài được tập tiêu chí', 'API', 'SECURITY', QL, 'J-BC-THIET-LAP', 'P0', 'S1', 'Tài khoản cán bộ gọi lưu tập tiêu chí của một tổ', 'Bị từ chối', 'người nhập tự bớt tiêu chí của tổ mình', acc('/api/v1/dynamic-reports', [ADMIN, QL], 'PUT')),

 # ── III. Quyền theo Tổ (#655–#662) ──────────────────────────────────────────────────────────────────────────
 ('A18-OFF', 'Chưa bật thì cấu hình ở màn Phân quyền không đổi quyền của ai', 'API', 'GREEN', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Chế độ Tắt; gán cho tổ một mẫu ít quyền hơn vai trò; cán bộ của tổ đọc hồ sơ cá nhân', 'Cán bộ vẫn có đủ quyền của vai trò', 'cấu hình có hiệu lực trước khi bật', None, WF),
 ('A31-EASY', 'Phạm vi xem dùng lời Chỉ của mình / Cả tổ / Toàn bộ; thao tác là Thêm / Sửa / Xoá', 'E2E', 'UX', ADMIN, 'J-PQ-TO', 'P1', 'S3', 'Mở tab Quyền theo tổ, chọn một tổ', 'Bảng dùng đúng các từ ấy; không có mã quyền kỹ thuật trên màn chính', 'màn hình dùng từ kỹ thuật khó hiểu', None),
 ('A31-EASY', 'Phần nâng cao (kế thừa, ngoại lệ, hạn dùng, theo người) nằm sau nút Nâng cao', 'E2E', 'UX', ADMIN, 'J-PQ-TO', 'P2', 'S4', 'Mở tab Quyền theo tổ; chưa bấm Nâng cao', 'Chỉ thấy chọn mẫu và bảng quyền; bấm Nâng cao mới thấy ngoại lệ', 'màn chính quá rối', None),
 ('A8-TEMPLATE', 'Tạo mẫu quyền mới và thấy nó trong danh sách', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P0', 'S2', 'Tab Mẫu quyền; Thêm mẫu; đặt tên; tick vài quyền; lưu', 'Mẫu xuất hiện trong danh sách với đúng các quyền đã tick', 'lưu xong không thấy mẫu', None, WF),
 ('A8-TEMPLATE', 'Sửa mẫu rồi mở lại thấy đúng thay đổi', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P0', 'S2', 'Mở một mẫu; đổi phạm vi Đơn thư từ Cả tổ sang Chỉ của mình; lưu; mở lại', 'Mẫu ghi Chỉ của mình', 'sửa không lưu', None),
 ('A8-TEMPLATE', 'Sao chép mẫu cho ra mẫu mới giống hệt, sửa bản sao không đổi bản gốc', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P1', 'S3', 'Sao chép một mẫu; sửa bản sao; mở bản gốc', 'Bản gốc không đổi', 'bản sao dính bản gốc', None),
 ('A8-TEMPLATE', 'Lưu trữ mẫu rồi khôi phục được', 'E2E', 'STATE', ADMIN, 'J-PQ-MAU', 'P1', 'S3', 'Lưu trữ một mẫu; khôi phục', 'Mẫu lưu trữ không còn để chọn cho tổ; khôi phục thì chọn lại được', 'lưu trữ là ngõ cụt', tr('ARCHIVED', 'ACTIVE', True)),
 ('A8-TEMPLATE', 'Xoá mẫu không tổ nào dùng', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P1', 'S3', 'Xoá một mẫu chưa gán cho tổ nào', 'Mẫu biến khỏi danh sách', 'tạo được mà không xoá được', None, WF),
 ('A8-TEMPLATE', 'Mẫu đang có tổ dùng thì không xoá được, và nói rõ tổ nào đang dùng', 'E2E', 'RED', ADMIN, 'J-PQ-MAU', 'P0', 'S2', 'Xoá một mẫu đang gán cho tổ A', 'Bị từ chối, nêu tên tổ A; mẫu còn nguyên', 'xoá mẫu làm tổ mất cấu hình', None),
 ('A8-TEMPLATE', 'Mẫu không có tên thì không lưu được', 'E2E', 'RED', ADMIN, 'J-PQ-MAU', 'P2', 'S4', 'Thêm mẫu; để trống tên; lưu', 'Không lưu; báo cần tên', 'mẫu vô danh', None),
 ('A9-MATRIX', 'Tick cả hàng, cả cột, cả mục trong ma trận mẫu', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P1', 'S3', 'Trong ma trận: tick ô đầu mục; tick tiêu đề cột Xoá; tick đầu hàng Vụ án', 'Mỗi lần tick đổi đúng các ô thuộc mục / cột / hàng ấy', 'tick nhanh đổi nhầm ô', None),
 ('A14-SEE-BEFORE-CHANGE', 'Không cấp được Sửa rộng hơn Xem trên cùng một chức năng', 'E2E', 'RED', ADMIN, 'J-PQ-MAU', 'P0', 'S2', 'Đặt Xem Đơn thư = Chỉ của mình, Sửa Đơn thư = Cả tổ; lưu', 'Không lưu được; lời báo nói phải được xem thì mới được sửa', 'người sửa được hồ sơ mình không mở được', None),
 ('A14-SEE-BEFORE-CHANGE', 'Không cấp được Thêm/Sửa/Xoá khi không cấp Xem', 'E2E', 'RED', ADMIN, 'J-PQ-MAU', 'P1', 'S2', 'Bỏ Xem Vụ việc nhưng tick Sửa Vụ việc; lưu', 'Không lưu được', 'quyền ghi mồ côi', None),
 ('A13-NO-ESCALATE', 'Người lưu không cấp được quyền mà chính họ không có', 'API', 'SECURITY', ADMIN, 'J-PQ-MAU', 'P0', 'S1', 'Tài khoản có quyền sửa cấu hình nhưng thiếu quyền Q; lưu mẫu có Q', 'Bị từ chối, nêu quyền Q', 'tự nâng quyền qua mẫu', acc('/api/v1/authz/templates', [ADMIN, ADMIN2], 'POST')),
 ('A13-NO-ESCALATE', 'Cấp quyền nhạy cảm (Toàn bộ, xuất đầy đủ, quản trị người dùng/vai trò) phải có lý do', 'E2E', 'RED', ADMIN, 'J-PQ-MAU', 'P0', 'S2', 'Tick một quyền nhạy cảm; lưu không nhập lý do', 'Không lưu được khi thiếu lý do; có lý do thì lưu', 'cấp quyền nhạy cảm không dấu vết', None),
 ('A17-STARTERS', 'Bấm Tạo 3 mẫu khởi đầu thì có ba mẫu: Cán bộ (như hiện nay), Chỉ hồ sơ của mình, Chỉ xem', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P1', 'S3', 'Hệ thống chưa có mẫu; bấm Tạo 3 mẫu khởi đầu', 'Ba mẫu xuất hiện; mẫu Chỉ xem không có Thêm/Sửa/Xoá; mẫu Chỉ hồ sơ của mình ghi Chỉ của mình', 'quản trị viên không có điểm bắt đầu', None),
 ('A17-STARTERS', 'Bấm lần hai không tạo trùng', 'E2E', 'EDGE', ADMIN, 'J-PQ-MAU', 'P2', 'S3', 'Bấm Tạo 3 mẫu khởi đầu lần nữa', 'Báo ba mẫu đã có sẵn; không có mẫu trùng', 'bấm hai lần ra sáu mẫu', None),
 ('A17-STARTERS', 'Mẫu khởi đầu sửa và xoá được như mẫu thường', 'E2E', 'GREEN', ADMIN, 'J-PQ-MAU', 'P2', 'S3', 'Sửa tên một mẫu khởi đầu; xoá một mẫu khởi đầu chưa dùng', 'Cả hai thao tác thành công', 'mẫu hệ thống không gỡ được', None),
 ('A5-MEMBER-LEADER', 'Mỗi tổ chọn riêng mẫu cho Thành viên và mẫu cho Tổ trưởng', 'E2E', 'GREEN', ADMIN, 'J-PQ-TO', 'P0', 'S2', 'Tab Quyền theo tổ; chọn tổ; chọn mẫu Thành viên và mẫu Tổ trưởng khác nhau; lưu; mở lại', 'Hai lựa chọn được giữ đúng', 'một mẫu cho cả tổ', None, WF),
 ('A5-MEMBER-LEADER', 'Khi áp dụng, tổ trưởng có quyền theo mẫu Tổ trưởng, thành viên theo mẫu Thành viên', 'API', 'DECISION', TT, 'J-PQ-CAN-BO', 'P0', 'S1', 'Tổ T: mẫu Thành viên không có Xoá đơn thư, mẫu Tổ trưởng có; bật áp dụng; mỗi người đọc quyền của mình', 'Tổ trưởng có Xoá đơn thư; thành viên không', 'nâng quyền cán bộ hoặc hạ quyền tổ trưởng', None),
 ('A2-INHERIT', 'Tổ chưa cài thì theo cấu hình của tổ cha', 'API', 'GREEN', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Tổ cha có mẫu Chỉ xem; tổ con không cài; bật áp dụng; cán bộ tổ con đọc quyền', 'Cán bộ tổ con có quyền theo mẫu của tổ cha', 'tổ con rơi về vai trò dù tổ cha đã cài', None),
 ('A2-INHERIT', 'Cây tổ ghi nhãn Kế thừa hoặc Riêng cho từng tổ', 'E2E', 'UX', ADMIN, 'J-PQ-TO', 'P2', 'S4', 'Mở tab Quyền theo tổ với tổ cha đã cài, tổ con chưa cài', 'Tổ cha ghi Riêng; tổ con ghi Kế thừa và nêu kế thừa từ tổ nào', 'không biết tổ đang theo cấu hình nào', None),
 ('A1-DEFAULT', 'Tổ không cài gì và không tổ cha nào cài thì giữ quyền như hiện nay', 'API', 'GREEN', CBK, 'J-PQ-CAN-BO', 'P0', 'S1', 'Bật áp dụng; cán bộ của một tổ chưa cài gì đọc quyền và mở danh sách', 'Quyền và danh sách giống hệt lúc chưa bật', 'bật lên làm cả đơn vị mất quyền', None),
 ('A12-CONFLICT', 'Hai người sửa cùng cấu hình một tổ: người lưu sau bị báo xung đột', 'E2E', 'RED', ADMIN, 'J-PQ-TO', 'P0', 'S2', 'A và B mở cùng tổ; A lưu; B lưu', 'B bị báo cấu hình vừa được người khác sửa; thay đổi của A còn nguyên', 'người sau đè người trước không ai biết', None),
 ('A10-COPY-APPLY', 'Chép cấu hình từ tổ khác', 'E2E', 'GREEN', ADMIN, 'J-PQ-TO', 'P1', 'S3', 'Tổ B: Chép từ tổ; chọn tổ A; lưu', 'Tổ B có cùng mẫu Thành viên và Tổ trưởng như A', 'chép thiếu mẫu tổ trưởng', None),
 ('A10-COPY-APPLY', 'Áp cho nhiều tổ có xem trước rồi mới lưu', 'E2E', 'GREEN', ADMIN, 'J-PQ-TO', 'P0', 'S2', 'Chọn Áp cho nhiều tổ; chọn 3 tổ; xem trước; lưu', 'Xem trước nêu số người đổi quyền; sau lưu cả 3 tổ có cấu hình ấy, tổ khác không đổi', 'áp hàng loạt mù', None),
 ('A10-COPY-APPLY', 'Áp cho nhiều tổ là tất cả hoặc không: một tổ không hợp lệ thì không tổ nào đổi', 'API', 'RED', ADMIN, 'J-PQ-TO', 'P1', 'S2', 'Áp cho 3 tổ trong đó 1 tổ vừa bị người khác sửa', 'Cả lượt bị từ chối; 2 tổ còn lại không đổi', 'áp dở dang', None),
 ('A11-PREVIEW', 'Xem trước nêu số người và ai mất quyền gì, bằng lời', 'E2E', 'GREEN', ADMIN, 'J-PQ-TO', 'P0', 'S2', 'Đổi mẫu của tổ sang mẫu ít quyền hơn; bấm Xem trước thay đổi', 'Thấy dạng "áp cho N người: M người mất quyền Xoá đơn thư", nêu tên người', 'lưu mà không biết ai bị ảnh hưởng', None),
 ('A11-PREVIEW', 'Xem trước không ghi gì', 'API', 'RED', ADMIN, 'J-PQ-TO', 'P1', 'S2', 'Gọi xem trước; đọc lại cấu hình và lịch sử', 'Cấu hình và lịch sử không đổi', 'xem trước lỡ lưu', None),
 ('A11-PREVIEW', 'Phạm vi thu hẹp nhưng không mất tổ nào vẫn được đánh dấu "phạm vi hẹp hơn"', 'E2E', 'EDGE', ADMIN, 'J-PQ-TO', 'P1', 'S2', 'Đổi Xem Đơn thư từ Cả tổ sang Đúng tổ trên cùng một tổ; xem trước', 'Người trong tổ được liệt kê với nhãn phạm vi hẹp hơn', 'thu hẹp bị coi là không đổi', None),
 ('A6-OVERRIDE', 'Thêm quyền riêng cho một người, có lý do và hạn dùng', 'E2E', 'GREEN', ADMIN, 'J-PQ-TO', 'P1', 'S2', 'Nâng cao; ngoại lệ theo người; cấp Xem Vụ án Toàn bộ cho ông X, hạn 7 ngày, có lý do; lưu', 'Ngoại lệ được lưu, hiện người, quyền, lý do, hạn', 'ngoại lệ không có hạn', None),
 ('A6-OVERRIDE', 'Tắt một quyền riêng của một người', 'API', 'GREEN', CB, 'J-PQ-CAN-BO', 'P1', 'S2', 'Tắt Xoá đơn thư của riêng ông X; bật áp dụng; ông X và đồng đội đọc quyền', 'Ông X không có Xoá đơn thư; đồng đội cùng tổ vẫn có', 'tắt của một người ảnh hưởng cả tổ', None),
 ('A6-OVERRIDE', 'Ngoại lệ hết hạn thì quyền tự mất, không cần ai thao tác', 'API', 'BOUNDARY', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Cấp quyền riêng hạn tới thời điểm T; gọi trước T và sau T', 'Trước T có quyền; sau T không còn', 'quyền tạm thành vĩnh viễn', None),
 ('A6-OVERRIDE', 'Ngoại lệ thiếu lý do không lưu được', 'E2E', 'RED', ADMIN, 'J-PQ-TO', 'P2', 'S3', 'Thêm ngoại lệ; để trống lý do; lưu', 'Không lưu được', 'ngoại lệ không giải trình được', None),
 ('A6-OVERRIDE', 'Ngày hạn không có thật (31/02) bị từ chối', 'API', 'DATA', ADMIN, 'J-PQ-TO', 'P2', 'S3', 'Gửi ngoại lệ có hạn 2026-02-31', 'Bị từ chối; không lưu thành ngày khác', 'ngày sai lặng lẽ thành ngày khác', {'db_assert': {'query': "SELECT count(*) FROM user_permission_overrides WHERE reason = 'UAT-1411-NGAY-SAI'", 'expect': {'value': 0}}}),
 ('A15-LOOKUP', 'Tra cứu một người thấy quyền hiệu lực và lý do "vì sao"', 'E2E', 'GREEN', ADMIN, 'J-PQ-TRA-CUU', 'P0', 'S2', 'Tab Tra cứu quyền; chọn một cán bộ của tổ đã cài', 'Mỗi quyền nêu phạm vi và nguồn: tổ nào, mẫu Thành viên hay Tổ trưởng, hay ngoại lệ', 'không trả lời được vì sao anh X thấy hồ sơ này', None, WF),
 ('A15-LOOKUP', 'Tra cứu nêu cả quyền KHÔNG có và lý do', 'E2E', 'GREEN', ADMIN, 'J-PQ-TRA-CUU', 'P1', 'S3', 'Tra một cán bộ thuộc tổ có mẫu không cấp Xoá đơn thư', 'Dòng Xoá đơn thư ghi Không và lý do mẫu không cấp', 'chỉ liệt kê quyền có', None),
 ('A15-LOOKUP', 'Từ màn Quản lý người dùng mở được quyền hiệu lực của người đó', 'E2E', 'GREEN', ADMIN, 'J-PQ-TRA-CUU', 'P2', 'S4', 'Quản lý người dùng; trên một dòng bấm Xem quyền hiệu lực', 'Mở đúng tra cứu của người ấy', 'phải tìm lại người ở màn khác', None),
 ('A15-LOOKUP', 'Người thuộc hai tổ: tra cứu nêu quyền từ từng tổ', 'E2E', 'EDGE', ADMIN, 'J-PQ-TRA-CUU', 'P1', 'S3', 'Tra một người thuộc tổ T (Chỉ của mình) và T2 (Cả tổ)', 'Thấy hai nguồn, mỗi nguồn kèm tổ của nó', 'gộp thành một dòng không rõ nguồn', None),
 ('A16-HISTORY-UNDO', 'Mỗi lần lưu cấu hình là một dòng lịch sử: ai, lúc nào, đổi gì', 'E2E', 'GREEN', ADMIN, 'J-PQ-LICH-SU', 'P0', 'S2', 'Lưu một thay đổi; mở tab Lịch sử', 'Dòng mới nhất nêu người lưu, thời điểm, đối tượng đã đổi', 'đổi quyền không truy được', None),
 ('A16-HISTORY-UNDO', 'Hoàn tác đưa cấu hình về như trước và tự nó là một dòng lịch sử mới', 'E2E', 'GREEN', ADMIN, 'J-PQ-LICH-SU', 'P0', 'S2', 'Hoàn tác thay đổi vừa lưu', 'Cấu hình trở lại như trước; lịch sử có thêm dòng hoàn tác', 'hoàn tác xoá mất dấu vết', None),
 ('A16-HISTORY-UNDO', 'Không hoàn tác được khi đối tượng đã bị sửa tiếp sau đó', 'E2E', 'RED', ADMIN, 'J-PQ-LICH-SU', 'P1', 'S2', 'Lưu thay đổi 1; lưu thay đổi 2 trên cùng tổ; hoàn tác thay đổi 1', 'Bị từ chối, nói rõ đã có thay đổi sau đó', 'hoàn tác vứt thay đổi mới hơn', None),
 ('A16-HISTORY-UNDO', 'Hoàn tác cũng không cấp vượt quyền người bấm', 'API', 'SECURITY', ADMIN, 'J-PQ-LICH-SU', 'P1', 'S1', 'Người thiếu quyền Q hoàn tác một thay đổi đã GỠ Q', 'Bị từ chối', 'hoàn tác là cửa sau để cấp quyền', acc('/api/v1/authz/changes', [ADMIN, ADMIN2], 'POST')),
 ('A18-OFF', 'Người không có quyền quản trị vai trò không mở được màn Phân quyền', 'API', 'SECURITY', ADMIN, 'J-PQ-TO', 'P0', 'S1', 'Tài khoản cán bộ gọi đọc mẫu, cấu hình tổ, chế độ, bảng so sánh', 'Tất cả bị từ chối', 'cán bộ đọc được cấu hình quyền', acc('/api/v1/authz/mode', [ADMIN, ADMIN2]), WF),
 ('A19-TWO-ADMIN', 'Thẻ trạng thái nói rõ đang Tắt, Chạy thử hay Áp dụng bằng lời', 'E2E', 'UX', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S3', 'Mở tab Áp dụng ở từng chế độ', 'Tắt: "quyền theo vai trò như trước nay"; Chạy thử: "chưa áp dụng"; Áp dụng: "Đang áp dụng"', 'không biết hệ thống đang ở chế độ nào', None),
 ('A11-PREVIEW', 'Bảng "Nếu áp dụng ngay bây giờ" nêu tổng số người, số bị mất, được thêm, đổi phạm vi', 'E2E', 'GREEN', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Tab Áp dụng', 'Năm con số và danh sách từng người; người mất quyền xếp trên cùng', 'bật mà không biết ai mất quyền', None, WF),
 ('A11-PREVIEW', 'Quản trị viên không nằm trong bảng so sánh', 'API', 'GREEN', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Đọc bảng so sánh', 'Không có tài khoản quản trị nào trong danh sách', 'báo quản trị viên mất quyền', None, WF),
 ('A11-PREVIEW', 'Thành viên của tổ đã ngừng được nêu là mất phạm vi tổ ấy', 'API', 'EDGE', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Có người thuộc một tổ đã ngừng; đọc bảng so sánh', 'Người ấy có trong danh sách với nhãn phạm vi hẹp hơn và tên tổ đã ngừng', 'thay đổi có chủ đích bị giấu', None),
 ('A19-TWO-ADMIN', 'Không bật Áp dụng trực tiếp được', 'API', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Gọi đổi chế độ thẳng sang Áp dụng', 'Bị từ chối; chế độ vẫn Tắt', 'một người tự bật', None, WF),
 ('A19-TWO-ADMIN', 'Gửi đề nghị cần lý do và tick "đã đọc danh sách"', 'E2E', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S2', 'Tab Áp dụng; chưa nhập lý do hoặc chưa tick; nhìn nút Gửi đề nghị', 'Nút không bấm được cho tới khi có cả lý do và dấu tick', 'đề nghị bật mà chưa đọc', None),
 ('A19-TWO-ADMIN', 'Người đề nghị không tự duyệt được', 'E2E', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Quản trị viên A gửi đề nghị; vẫn A mở tab Áp dụng', 'A chỉ thấy Rút lại đề nghị và lời nhắc cần người khác duyệt; gọi duyệt thẳng thì bị từ chối', 'một người đóng cả hai vai', None, WF),
 ('A19-TWO-ADMIN', 'Quản trị viên thứ hai duyệt thì chế độ thành Áp dụng', 'E2E', 'GREEN', ADMIN2, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Quản trị viên B mở tab Áp dụng; đọc danh sách; tick; bấm Duyệt và áp dụng', 'Thẻ trạng thái ghi Đang áp dụng; lịch sử ghi A đề nghị, B duyệt', 'duyệt xong mà không bật', None, WF),
 ('A19-TWO-ADMIN', 'Cán bộ không đề nghị, không duyệt, không từ chối được', 'API', 'SECURITY', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Tài khoản cán bộ gọi đề nghị, duyệt, đóng đề nghị', 'Cả ba bị từ chối', 'cán bộ bật được chế độ', acc('/api/v1/authz/mode/requests', [ADMIN, ADMIN2], 'POST'), WF),
 ('A19-TWO-ADMIN', 'Khi đã có một đề nghị chờ thì không gửi được đề nghị thứ hai', 'API', 'RED', ADMIN2, 'J-PQ-AP-DUNG', 'P1', 'S3', 'A đã gửi; B gửi thêm một đề nghị', 'B bị từ chối, nói đang có đề nghị chờ', 'hai đề nghị chồng nhau', None, WF),
 ('A20-FINGERPRINT', 'Đề nghị trên một bảng so sánh chưa đọc (đã cũ) bị từ chối và phải đọc lại', 'E2E', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'A mở tab; người khác đổi cấu hình tổ; A tick và gửi', 'Bị báo danh sách đã khác; danh sách được tải lại; dấu tick tự bỏ', 'xác nhận một danh sách đã cũ', None, WF),
 ('A20-FINGERPRINT', 'Cấu hình đổi sau khi đề nghị thì người duyệt không duyệt được đề nghị cũ', 'API', 'RED', ADMIN2, 'J-PQ-AP-DUNG', 'P0', 'S1', 'A đề nghị; ai đó đổi một mẫu; B đọc danh sách mới và duyệt', 'Bị từ chối: hai người không cùng đọc một danh sách; phải đề nghị lại', 'bật một cấu hình người đề nghị chưa thấy', None),
 ('A21-TTL', 'Đề nghị quá 24 giờ chưa ai duyệt thì hết hiệu lực', 'API', 'BOUNDARY', ADMIN2, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Đề nghị tạo lúc T; duyệt lúc T+24h01', 'Bị từ chối vì quá hạn; ngay trước mốc 24 giờ thì duyệt được; sau đó gửi được đề nghị mới', 'đề nghị treo mãi', None),
 ('A22-WITHDRAW', 'Người đề nghị rút lại được đề nghị của mình', 'E2E', 'GREEN', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S3', 'A gửi đề nghị; bấm Rút lại đề nghị', 'Đề nghị ghi Đã rút lại; form đề nghị hiện lại', 'yêu cầu không có đường rút', None, WF),
 ('A22-WITHDRAW', 'Quản trị viên khác từ chối được đề nghị', 'E2E', 'GREEN', ADMIN2, 'J-PQ-AP-DUNG', 'P1', 'S3', 'A gửi; B bấm Từ chối', 'Đề nghị ghi Bị từ chối; chế độ không đổi', 'chỉ có duyệt, không có từ chối', None, WF),
 ('A22-WITHDRAW', 'Đề nghị đã đóng không duyệt được nữa', 'API', 'STATE', ADMIN2, 'J-PQ-AP-DUNG', 'P1', 'S2', 'A rút lại; B gọi duyệt đề nghị ấy', 'Bị từ chối; chế độ vẫn Tắt', 'đề nghị đã rút sống lại', tr('WITHDRAWN', 'APPLIED', False)),
 ('A22-WITHDRAW', 'Chuyển sang Chạy thử khi có đề nghị chờ thì đề nghị bị huỷ, có báo trước', 'E2E', 'EDGE', ADMIN2, 'J-PQ-AP-DUNG', 'P2', 'S3', 'A gửi đề nghị; B bấm Chạy thử', 'Trước khi xác nhận có lời nhắc đề nghị sẽ bị huỷ; sau đó đề nghị ghi Đã huỷ vì có thay đổi khác', 'đề nghị cũ được duyệt trên trạng thái mới', None),
 ('A19-TWO-ADMIN', 'Chạy thử bật và dừng được bởi một quản trị viên, không đổi quyền của ai', 'API', 'GREEN', CB, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Bật Chạy thử; cán bộ của tổ đã cài đọc quyền; Dừng chạy thử', 'Quyền của cán bộ không đổi trong lúc Chạy thử', 'chạy thử lỡ áp dụng', None, WF),
 ('A19-TWO-ADMIN', 'Đổi chế độ thiếu lý do bị từ chối', 'API', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S3', 'Gọi chuyển sang Chạy thử với lý do toàn khoảng trắng', 'Bị từ chối', 'đổi chế độ không giải trình', None, WF),
 ('A29-SETTINGS', 'Màn cấu hình chung không đổi được chế độ phân quyền', 'API', 'SECURITY', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Dùng màn/route cấu hình hệ thống đặt chế độ sang Chạy thử hoặc Tắt', 'Bị từ chối; chế độ không đổi', 'lách qua màn khác để tắt, không lịch sử', acc('/api/v1/settings/QUYEN_THEO_TO_CHE_DO', [ADMIN], 'PUT'), WF),
 ('A24-NO-LOCKOUT', 'Không bật được khi người đề nghị hoặc người duyệt sẽ mất quyền mở màn này', 'API', 'RED', ADMIN2, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Dựng cấu hình khiến một trong hai người mất quyền quản trị vai trò; duyệt', 'Bị từ chối, nói rõ lý do', 'bật xong không ai tắt được', None),
 ('A24-NO-LOCKOUT', 'Vai trò quản trị không bỏ được quyền xem và sửa vai trò', 'E2E', 'RED', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S1', 'Màn Vai trò & quyền; bỏ quyền Xem/Sửa vai trò khỏi vai trò quản trị; lưu', 'Không lưu được', 'mất đường tắt áp dụng', None),
 ('A25-ENFORCED-PROFILE', 'Khi áp dụng, cán bộ chỉ còn quyền tổ cấp, và thực đơn theo đó', 'E2E', 'GREEN', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Tổ của cán bộ có mẫu chỉ Xem Đơn thư; bật áp dụng; cán bộ tải lại trang', 'Thực đơn chỉ còn mục Đơn thư (và mục không cần quyền); không còn Vụ án, Vụ việc', 'giao diện còn hiện mục máy chủ sẽ từ chối', None, WF),
 ('A25-ENFORCED-PROFILE', 'Màn hình mất quyền thì gõ thẳng địa chỉ cũng không vào được', 'E2E', 'SECURITY', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Như trên; cán bộ gõ địa chỉ danh sách Vụ án', 'Không xem được dữ liệu vụ án', 'ẩn thực đơn nhưng địa chỉ vẫn mở', acc('/api/v1/cases', [ADMIN, ADMIN2, TT]), WF),
 ('A25-ENFORCED-PROFILE', 'Không có quyền Xoá thì không thấy nút Xoá, và gọi xoá bị từ chối', 'E2E', 'RED', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Mẫu của tổ không có Xoá đơn thư; cán bộ mở một đơn thư của mình', 'Không có nút Xoá; gọi xoá thẳng bị từ chối', 'nút ẩn nhưng xoá vẫn chạy', None),
 ('A3-REACH', 'Chỉ của mình: chỉ thấy hồ sơ do mình phụ trách/nhập', 'E2E', 'GREEN', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Mẫu Xem Đơn thư = Chỉ của mình; cán bộ mở danh sách', 'Chỉ có đơn do chính cán bộ ấy nhập; không có đơn của đồng đội cùng tổ', 'thấy hồ sơ của người khác', None, WF),
 ('A3-REACH', 'Chỉ của mình: không thấy hồ sơ chưa giao tổ của người khác', 'API', 'RED', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Có đơn chưa giao tổ do người khác nhập; cán bộ (Chỉ của mình) mở danh sách', 'Không có đơn ấy', 'hồ sơ chưa giao lọt qua', None),
 ('A3-REACH', 'Đúng tổ: thấy hồ sơ giao cho đúng tổ mình, không thấy của tổ con', 'API', 'BOUNDARY', TT, 'J-PQ-CAN-BO', 'P0', 'S1', 'Quyền ở mức Đúng tổ T; T có tổ con T1; mở danh sách', 'Có hồ sơ giao cho T; không có hồ sơ giao cho T1', 'Đúng tổ rò xuống tổ con', None),
 ('A3-REACH', 'Đúng tổ: không thấy hồ sơ giao tổ khác dù do thành viên tổ mình xử lý', 'API', 'RED', TT, 'J-PQ-CAN-BO', 'P0', 'S1', 'Hồ sơ giao cho tổ B nhưng người phụ trách thuộc tổ T; người có Đúng tổ T mở danh sách', 'Không có hồ sơ ấy', 'điều kiện "thành viên HOẶC tổ" làm rò', None),
 ('A3-REACH', 'Đúng tổ: không thấy hồ sơ chưa giao tổ', 'API', 'RED', TT, 'J-PQ-CAN-BO', 'P1', 'S1', 'Có hồ sơ chưa giao tổ; người có Đúng tổ T mở danh sách', 'Không có hồ sơ chưa giao', 'chưa giao lọt qua mức Đúng tổ', None),
 ('A3-REACH', 'Cả tổ: thấy tổ mình, tổ con, hồ sơ của thành viên và hồ sơ chưa giao, như hôm nay', 'E2E', 'GREEN', TT, 'J-PQ-CAN-BO', 'P0', 'S1', 'Quyền mức Cả tổ T; mở danh sách', 'Có hồ sơ của T, của T1, và hồ sơ chưa giao tổ; không có hồ sơ của tổ không liên quan', 'Cả tổ khác với hành vi hôm nay', None),
 ('A3-REACH', 'Toàn bộ: thấy hồ sơ của mọi tổ', 'API', 'GREEN', TT, 'J-PQ-CAN-BO', 'P1', 'S2', 'Quyền mức Toàn bộ; mở danh sách', 'Có hồ sơ của mọi tổ', 'Toàn bộ vẫn bị lọc', None),
 ('A3-REACH', 'Mở thẳng một hồ sơ ngoài phạm vi bằng địa chỉ thì bị từ chối', 'API', 'SECURITY', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Cán bộ (Chỉ của mình) gọi chi tiết một đơn của đồng đội', 'Bị từ chối; thân phản hồi không có nội dung đơn', 'IDOR', acc('/api/v1/petitions/{id-cua-nguoi-khac}', [ADMIN, ADMIN2, TT])),
 ('A3-REACH', 'Tài liệu, đối tượng của hồ sơ theo phạm vi của hồ sơ cha', 'API', 'SECURITY', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Cán bộ gọi tài liệu / đối tượng của một hồ sơ ngoài phạm vi', 'Bị từ chối', 'vào hồ sơ qua tài nguyên con', acc('/api/v1/documents', [ADMIN, ADMIN2, TT])),
 ('A3-REACH', 'Phạm vi Sửa hẹp hơn Xem: xem được cả tổ nhưng chỉ sửa được của mình', 'E2E', 'DECISION', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Mẫu: Xem Đơn thư = Cả tổ, Sửa = Chỉ của mình; mở đơn của đồng đội và thử sửa', 'Xem được; sửa bị từ chối; đơn của mình thì sửa được', 'quyền xem thành quyền sửa', None),
 ('A4-PER-SUBJECT', 'Phạm vi Đơn thư và phạm vi Vụ án độc lập nhau', 'API', 'DECISION', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Mẫu: Đơn thư = Chỉ của mình, Vụ án = Cả tổ; mở hai danh sách', 'Đơn thư chỉ của mình; Vụ án của cả tổ', 'gom phạm vi theo nhóm làm lẫn hai loại hồ sơ', None),
 ('A4-PER-SUBJECT', 'Người thuộc hai tổ có hợp quyền, mỗi quyền phủ đúng tổ cấp nó', 'API', 'DECISION', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Thuộc T (Đúng tổ) và T2 (Chỉ của mình); mở danh sách', 'Thấy mọi hồ sơ của T và chỉ hồ sơ của mình ở T2', 'quyền của tổ này phủ sang tổ kia', None),
 ('A7-ADMIN', 'Quản trị viên không bị giới hạn khi áp dụng', 'API', 'GREEN', ADMIN, 'J-PQ-CAN-BO', 'P0', 'S1', 'Bật áp dụng; quản trị viên mở danh sách, trang chủ, màn quản trị', 'Mọi thứ như trước', 'bật lên khoá cả quản trị viên', None, WF),
 ('A10-SCOPE', 'Thành viên của tổ đã ngừng không còn với tới hồ sơ của tổ ấy khi áp dụng', 'API', 'EDGE', CB, 'J-PQ-CAN-BO', 'P1', 'S2', 'Cán bộ chỉ thuộc một tổ đã ngừng; bật áp dụng; mở danh sách', 'Không còn hồ sơ của tổ đã ngừng (trừ hồ sơ của chính mình nếu mẫu cho)', 'tổ ngừng vẫn mở phạm vi', None),
 ('A26-ENFORCED-RECORDS', 'Số trên huy hiệu thực đơn bằng số dòng trong danh sách', 'E2E', 'GREEN', CB, 'J-PQ-CAN-BO', 'P1', 'S3', 'Khi áp dụng; so số trên huy hiệu Đơn thư với số dòng danh sách', 'Hai số bằng nhau', 'huy hiệu đếm ngoài phạm vi', None),
 ('A28-DASHBOARD', 'Số liệu tổng và biểu đồ Trang chủ đếm theo phạm vi của người xem khi áp dụng', 'E2E', 'RED', CB, 'J-PQ-CAN-BO', 'P0', 'S2', 'Cán bộ (Chỉ của mình, có quyền xem vụ án) mở Trang chủ', 'Tổng số vụ án bằng số vụ án của chính cán bộ ấy, không phải của cả đơn vị', 'con số tiết lộ điều danh sách không cho xem', None),
 ('A28-DASHBOARD', 'Người không có quyền xem vụ án không đọc được số liệu Trang chủ', 'API', 'SECURITY', CB, 'J-PQ-CAN-BO', 'P1', 'S2', 'Mẫu không có Xem Vụ án; gọi số liệu Trang chủ', 'Bị từ chối', 'đếm được hồ sơ không được xem', acc('/api/v1/dashboard/stats', [ADMIN, ADMIN2, TT]), WF),
 ('A28-DASHBOARD', 'Chưa bật thì Trang chủ đếm toàn đơn vị như trước nay', 'API', 'REGRESSION', CB, 'J-PQ-CAN-BO', 'P0', 'S2', 'Chế độ Tắt; cán bộ mở Trang chủ', 'Các con số bằng đúng trước đợt này', 'đợt này làm lệch số Trang chủ', None),
 ('A27-NOTICE', 'Thông báo đơn quá hạn chỉ tới người mở được đơn đó khi áp dụng', 'API', 'RED', CB, 'J-PQ-CAN-BO', 'P0', 'S2', 'Tổ có 2 cán bộ mức Chỉ của mình; đơn của người thứ nhất quá hạn; chạy lượt quét hạn', 'Người thứ nhất nhận thông báo; người thứ hai không', 'thông báo lộ tên người gửi đơn cho người không được xem', None),
 ('A27-NOTICE', 'Chưa bật thì thông báo hạn gửi như trước nay', 'API', 'REGRESSION', CB, 'J-PQ-CAN-BO', 'P1', 'S2', 'Chế độ Tắt; chạy lượt quét hạn', 'Cả tổ nhận như trước', 'đợt này làm mất thông báo', None),
 ('A27-NOTICE', 'Thông báo "được phân công" không tới người không có quyền xem loại hồ sơ đó', 'API', 'RED', CB, 'J-PQ-CAN-BO', 'P2', 'S3', 'Khi áp dụng; phân công một vụ việc cho người mà tổ không cấp Xem Vụ việc', 'Người ấy không nhận thông báo nêu tên vụ việc', 'thông báo nêu hồ sơ người nhận không mở được', None),
 ('A23-OFF-ONE-STEP', 'Một quản trị viên tắt áp dụng trong một bước, có lý do', 'E2E', 'GREEN', ADMIN2, 'J-PQ-AP-DUNG', 'P0', 'S1', 'Đang áp dụng; bấm Tắt áp dụng (về như cũ); nhập lý do; xác nhận', 'Thẻ trạng thái ghi Đang tắt; không cần người thứ hai', 'lùi lại phải chờ người khác', None, WF),
 ('A23-OFF-ONE-STEP', 'Tắt xong cán bộ có lại quyền của vai trò ngay, không cần đăng nhập lại', 'API', 'GREEN', CB, 'J-PQ-CAN-BO', 'P0', 'S1', 'Sau khi tắt; cán bộ đọc quyền và mở màn hình trước đó bị chặn', 'Có đủ quyền vai trò; màn hình mở được', 'tắt rồi mà vẫn bị chặn', None, WF),
 ('A23-OFF-ONE-STEP', 'Tắt không làm mất cấu hình mẫu và tổ', 'E2E', 'GREEN', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Tắt áp dụng; mở tab Mẫu quyền và Quyền theo tổ', 'Mẫu và cấu hình tổ còn nguyên', 'tắt là mất công cài đặt', None, WF),
 ('A32-AUDIT', 'Lịch sử bật/tắt nêu ai đề nghị, ai quyết định, lý do, từ chế độ nào sang chế độ nào', 'E2E', 'GREEN', ADMIN, 'J-PQ-AP-DUNG', 'P0', 'S2', 'Sau một vòng đề nghị, rút lại, từ chối, duyệt, tắt; đọc phần lịch sử ở tab Áp dụng', 'Mỗi lần là một dòng đủ các thông tin ấy, mới nhất ở trên', 'không truy được ai đã bật', None, WF),
 ('A32-AUDIT', 'Đổi chế độ để lại bản ghi trong nhật ký hệ thống, chỉ có siêu dữ liệu', 'API', 'DATA', ADMIN, 'J-PQ-AP-DUNG', 'P1', 'S2', 'Sau khi đổi chế độ; đọc nhật ký hệ thống', 'Có bản ghi hành động đổi chế độ nêu người và hai chế độ; không chứa danh sách quyền của từng người', 'đổi quyền toàn hệ thống mà nhật ký trống', {'db_assert': {'query': "SELECT count(*) FROM audit_logs WHERE action = 'AUTHZ_MODE_CHANGED'", 'expect': {'min_rows': 1}}}),
 ('A30-UNAVAILABLE', 'Đang áp dụng mà hệ thống không đọc được cấu hình quyền thì từ chối, không lùi về vai trò', 'API', 'RED', CB, 'J-PQ-CAN-BO', 'P1', 'S1', 'Đang áp dụng; làm cấu hình quyền không đọc được quá hạn tin cậy; cán bộ gọi một màn hình', 'Bị từ chối với mã AUTHZ_UNAVAILABLE; không được trả quyền của vai trò', 'sự cố trả lại quyền cấu hình đã lấy đi', None),
 ('A30-UNAVAILABLE', 'Lời báo khi hệ thống phân quyền chưa sẵn sàng là lời tiếng Việt dễ hiểu', 'E2E', 'UX', CB, 'J-PQ-CAN-BO', 'P2', 'S4', 'Như trên, nhìn trên giao diện', 'Thấy câu tiếng Việt bảo thử lại sau, không phải mã lỗi trần', 'người dùng thấy mã lỗi kỹ thuật', None),
 ('A31-EASY', 'Màn Phân quyền dùng được bằng bàn phím và đọc được bằng trình đọc màn hình', 'E2E', 'A11Y', ADMIN, 'J-PQ-TO', 'P2', 'S3', 'Đi hết 5 tab bằng phím Tab/Enter; chạy axe', 'Mọi nút, ô tick có nhãn; tiêu điểm nhìn thấy được; axe không báo lỗi mức A/AA', 'ô tick không nhãn', None),
 ('A31-EASY', 'Màn Phân quyền dùng được ở bề rộng máy tính xách tay 1366', 'E2E', 'COMPAT', ADMIN, 'J-PQ-TO', 'P2', 'S4', 'Mở 5 tab ở 1366×768 trên Chrome và Edge', 'Bảng quyền không vỡ, nút Lưu không bị che', 'ma trận tràn màn hình', None),
 ('A11-PREVIEW', 'Bảng so sánh với hơn 200 người vẫn đọc và cuộn được', 'E2E', 'UX', ADMIN, 'J-PQ-AP-DUNG', 'P2', 'S3', 'Tab Áp dụng trên dữ liệu thật (244 người)', 'Danh sách tải xong, cuộn được, người mất quyền ở trên', 'danh sách dài làm treo màn', None),
]

RULES = collections.OrderedDict([
 # id: (nguồn, phát biểu)
 ('T1-STATES', ('Kế hoạch Phần 0; yêu cầu 3 của anh', 'Tổ có ba trạng thái Hoạt động / Tạm ngừng / Lưu trữ; chỉ người quản trị đổi được.')),
 ('T2-OPTIONS', ('Yêu cầu 3; R9', 'Tổ tạm ngừng hoặc lưu trữ không hiện ở BẤT KỲ ô chọn tổ nào.')),
 ('T3-NAME-KEEP', ('R9', 'Hồ sơ cũ vẫn hiện đúng tên tổ dù tổ đã ngừng.')),
 ('T4-TABS', ('Mockup Quản trị Tổ', 'Màn quản trị có ba tab theo trạng thái, kèm số đếm.')),
 ('T5-REVERSE', ('Tiêu chuẩn "tạo thì phải sửa và xoá" (CLAUDE.md, 13/10)', 'Ngừng có Hoạt động lại; Lưu trữ có Khôi phục.')),
 ('T6-DELETE', ('Yêu cầu 3; R8', 'Xoá thật chỉ khi tổ chưa có dữ liệu; tổ có dữ liệu thì Gộp hoặc Lưu trữ.')),
 ('T7-DELETE-RACE', ('R8', 'Không có kẽ hở giữa lúc xem trước và lúc xoá.')),
 ('T8-MERGE', ('R5', 'Gộp có xem trước, xử lý thành viên trùng, không sửa kỳ báo cáo đã sinh, tổ cũ chuyển Lưu trữ.')),
 ('T9-UNDO', ('R5', 'Hoàn tác gộp khôi phục bản ghi chưa bị đổi sau đó; bản ghi đã đổi thì bỏ qua và liệt kê.')),
 ('B1-IMPORT', ('Yêu cầu 2; xác nhận 13/11 "chọn phạm vi"', 'Tiêu chí lấy từ Excel bằng cách chọn cả cột hoặc một số ô trong MỘT cột; mỗi ô chữ là một tiêu chí, theo thứ tự dòng.')),
 ('B2-CODE-UNIT', ('Xác nhận 13/11', 'Chỉ được cột mã và cột đơn vị tính; dòng trống dùng mặc định.')),
 ('B3-HIER', ('Xác nhận 13/11', 'Cấp cha con theo thụt lề hoặc đánh số; mục con cộng vào mục cha.')),
 ('B4-PREVIEW', ('Xác nhận 13/11', 'Xem trước có cảnh báo (trống, trùng, ô gộp, công thức, quá 2.000 dòng) và sửa được từng dòng.')),
 ('B5-SERVER', ('Kế hoạch Phần B mục 2', 'Máy chủ đọc lại ô từ file đã lưu; không tin phạm vi/nội dung từ trình duyệt; không để công thức nguy hiểm.')),
 ('B6-DEFAULT-ALL', ('Yêu cầu 2 "mặc định chọn hết"', 'Tổ mới chọn mặc định phải báo mọi tiêu chí.')),
 ('B7-PER-TEAM', ('B8; kế hoạch mục 2b', 'Bước chọn tổ là nơi cài tiêu chí từng tổ: bỏ tick, thêm tay, chép từ tổ, áp nhiều tổ, ma trận.')),
 ('B8-ENTRY-ONLY', ('Yêu cầu 2; R6', 'Mỗi tổ chỉ thấy tiêu chí của mình ở MỌI đường đọc; nội dung không giao bị xoá hẳn, không chỉ ẩn.')),
 ('B9-REJECT', ('Kế hoạch Phần B mục 4', 'Ghi vào tiêu chí không thuộc tổ bị từ chối (FIELD_NOT_ASSIGNED); bắt buộc chỉ xét tiêu chí của tổ.')),
 ('B10-AGG', ('Kế hoạch Phần B mục 5', 'Tổ không được giao một tiêu chí thì không được tính vào tổng, kể cả như số 0.')),
 ('B11-COMPLETE', ('R7', 'Độ đầy đủ = đã nhận / phải nộp; phải nộp tách khỏi đã đóng góp.')),
 ('B12-OFFICIAL', ('Yêu cầu 2; kế hoạch mục 6', 'Khoá sổ xong có file chính thức không hết hạn: sheet Tổng hợp, sau đó mỗi tổ một sheet chỉ có tiêu chí của tổ.')),
 ('B13-RETRY', ('R12', 'Lỗi tạo file thì có báo và nút Tạo lại; mở lại kỳ thì file cũ vô hiệu.')),
 ('B14-MIDPERIOD', ('Kế hoạch mục 3 (D09)', 'Đổi tập giữa kỳ phải có lý do; bản nộp đã duyệt bị trả lại; kỳ chưa mở theo cấu hình.')),
 ('B15-MATRIX', ('B3 cách thứ tư', 'Xuất/nhập ma trận tổ × tiêu chí bằng Excel, khứ hồi không lệch, có kiểm xung đột.')),
 ('B16-LEGACY', ('Rủi ro Phần B', 'Báo cáo cũ (tập = tất cả) cho kết quả y hệt trước đợt này.')),
 ('B17-NEWVERSION', ('Kế hoạch mục 3', 'Tiêu chí mới mặc định giao mọi tổ; phiên bản mới ánh xạ theo mã ổn định.')),
 ('A1-DEFAULT', ('B2', 'Tổ chưa cài gì (và không tổ cha nào cài) giữ quyền hiện nay.')),
 ('A2-INHERIT', ('Kế hoạch "Kế thừa"', 'Tổ chưa cài thì kế thừa tổ cha.')),
 ('A3-REACH', ('R2; yêu cầu 1', 'Bốn mức phạm vi định nghĩa chặt: Chỉ của mình, Đúng tổ, Cả tổ (như hôm nay), Toàn bộ; Sửa/Xoá theo phạm vi Sửa.')),
 ('A4-PER-SUBJECT', ('R1', 'Phạm vi theo từng (thao tác, chức năng); quyền cộng dồn theo từng lượt thuộc tổ.')),
 ('A5-MEMBER-LEADER', ('R4', 'Mỗi tổ có mẫu cho Thành viên và mẫu cho Tổ trưởng.')),
 ('A6-OVERRIDE', ('R3, R4', 'Ngoại lệ theo người: thêm/tắt quyền, có lý do và hạn dùng; hết hạn tự mất.')),
 ('A7-ADMIN', ('B2', 'Quản trị viên không bị giới hạn.')),
 ('A8-TEMPLATE', ('B3 cách 1; "tạo thì phải sửa và xoá"', 'Mẫu quyền tạo, sửa, sao chép, lưu trữ/khôi phục, xoá khi không tổ nào dùng.')),
 ('A9-MATRIX', ('B3 cách 3', 'Ma trận tick theo hàng, cột, mục.')),
 ('A10-COPY-APPLY', ('B3 cách 2 và 4', 'Chép từ tổ khác; áp cho nhiều tổ có xem trước, tất cả hoặc không.')),
 ('A10-SCOPE', ('Kế hoạch Phần 0', 'Thành viên của tổ đã ngừng không còn tính vào phạm vi dữ liệu.')),
 ('A11-PREVIEW', ('Nguyên tắc dễ dùng 4', 'Luôn xem trước ai mất/được quyền gì trước khi lưu và trước khi bật; kể cả thu hẹp phạm vi.')),
 ('A12-CONFLICT', ('Kế hoạch màn Quyền theo tổ', 'Hai người sửa cùng lúc: người sau nhận 409, không ghi đè.')),
 ('A13-NO-ESCALATE', ('Kế hoạch "Ai được sửa cấu hình quyền"', 'Không ai cấp vượt quyền mình có; thay đổi nhạy cảm phải có lý do.')),
 ('A14-SEE-BEFORE-CHANGE', ('Kế hoạch (quyền ghi nằm trong quyền đọc)', 'Phải xem được thì mới được thêm/sửa/xoá; phạm vi ghi không rộng hơn phạm vi xem.')),
 ('A15-LOOKUP', ('Nguyên tắc dễ dùng 5', 'Tra cứu trả lời được "vì sao anh X có/không có quyền này".')),
 ('A16-HISTORY-UNDO', ('Nguyên tắc dễ dùng 4', 'Mọi thay đổi có lịch sử và hoàn tác được; hoàn tác là một thay đổi mới, bị từ chối nếu đã có thay đổi sau.')),
 ('A17-STARTERS', ('B3 cách 1; kế hoạch D6', 'Có ba mẫu khởi đầu dựng từ quyền cán bộ hiện có.')),
 ('A18-OFF', ('Kế hoạch "Triển khai an toàn"', 'Chế độ Tắt giữ y hệt hôm nay; màn cấu hình chỉ dành cho người quản trị vai trò.')),
 ('A19-TWO-ADMIN', ('Kế hoạch A12; quyết định D6', 'Bật Áp dụng cần hai quản trị viên; Chạy thử/Tắt một người, có lý do.')),
 ('A20-FINGERPRINT', ('Quyết định D6', 'Hai người phải cùng đọc một bảng so sánh; cấu hình đổi thì phải đọc lại.')),
 ('A21-TTL', ('Quyết định D6', 'Đề nghị quá 24 giờ hết hiệu lực.')),
 ('A22-WITHDRAW', ('"Yêu cầu ⇒ có Rút lại"', 'Đề nghị rút lại được, từ chối được; đề nghị đã đóng không sống lại.')),
 ('A23-OFF-ONE-STEP', ('Kế hoạch "Rollback: đặt về OFF"', 'Tắt là một bước, một người, có hiệu lực ngay, không mất cấu hình.')),
 ('A24-NO-LOCKOUT', ('Kế hoạch "Chống khoá"', 'Không bật được nếu người thao tác tự mất đường quay lại; vai trò quản trị giữ quyền quản trị vai trò.')),
 ('A25-ENFORCED-PROFILE', ('Yêu cầu 1 "chọn màn hình/chức năng"', 'Khi áp dụng, thực đơn, màn hình và nút bấm theo đúng quyền tổ cấp; máy chủ từ chối điều giao diện đã ẩn.')),
 ('A26-ENFORCED-RECORDS', ('Yêu cầu 1 "phạm vi xem"', 'Mọi con số đếm khớp số dòng người ấy mở được.')),
 ('A27-NOTICE', ('Rà soát Codex #662', 'Thông báo nêu hồ sơ chỉ tới người mở được hồ sơ đó khi áp dụng; chưa bật thì như trước.')),
 ('A28-DASHBOARD', ('Rà soát Codex #662', 'Số liệu Trang chủ theo phạm vi người xem khi áp dụng; chưa bật thì như trước.')),
 ('A29-SETTINGS', ('Rà soát Codex #662', 'Chế độ chỉ đổi được ở tab Áp dụng.')),
 ('A30-UNAVAILABLE', ('Quyết định D5', 'Không biết có đang áp dụng không thì từ chối, không lùi về vai trò.')),
 ('A31-EASY', ('B5 "dễ dùng, dễ hiểu"', 'Lời đời thường; nâng cao giấu sau nút; dùng được bằng bàn phím, ở màn hình thường gặp.')),
 ('A32-AUDIT', ('Tiêu chuẩn máy chủ (audit chỉ metadata)', 'Mỗi lần đổi chế độ có lịch sử và nhật ký, chỉ siêu dữ liệu.')),
])

DOMAIN_HEAD = '''# Domain pack — đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)

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

'''

DOMAIN_TAIL = '''
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
'''

GROUPS = [('T', 'I. Vòng đời Tổ (#650)'), ('B', 'II. Báo cáo động theo tiêu chí từng tổ (#652–#654)'), ('A', 'III. Quyền theo Tổ (#655–#662)')]
PLATFORM = {'E2E': 'web', 'API': 'api', 'UNIT': 'api'}
# M2: Σ V(G) của các tệp logic MỚI, đo bằng lizard (xem cuối Ledger); FP ước từ số chức năng; risk theo tier.
M2, FP, RISK = int(os.environ.get('UAT_M2', '0')), 34, 'CRITICAL'


def build():
    counters = collections.Counter()
    rows = []
    for n, item in enumerate(ITEMS, 1):
        rule, claim, layer, typ, persona, journey, pri, sev, steps, expected, catches, extra = item[:12]
        local = len(item) > 12 and item[12] == WF
        assert rule in RULES, rule
        counters[rule] += 1
        cov = 'COV-%s-%d' % (rule, counters[rule])
        tc = collections.OrderedDict([
            ('tc_id', 'TC-%03d' % n), ('title', claim), ('type', typ), ('platform', PLATFORM[layer]), ('persona', persona),
            ('journey_ref', journey), ('priority', pri), ('severity_if_fail', sev),
            ('oracle_type', 'Claim'), ('rule_ref', rule), ('oracle_source', 'docs/uat/dot-1411/_domain-pack.md §%s (%s)' % (rule, RULES[rule][0])),
            ('catches_bug', catches), ('coverage_ids', [cov]), ('backend_policy', 'live'),
            ('evidence_required', ['trace', 'screenshot-final'] if layer == 'E2E' else ['http-log']),
            ('steps', steps), ('expected', expected),
        ])
        if extra:
            tc.update(extra)
        rows.append((cov, claim, layer, typ, tc, local, rule))
    unused = [r for r in RULES if counters[r] == 0]
    assert not unused, unused
    return rows


def main():
    rows = build()
    n = len(rows)
    w = lambda name, text: io.open(os.path.join(HERE, name), 'w', encoding='utf-8', newline='\n').write(text)

    # ── uat.json ────────────────────────────────────────────────────────────────────────────────────────────
    uat = collections.OrderedDict([('feature', 'to-bao-cao-quyen-dot-1411'), ('evidence_profile', 'signoff'), ('generated_at', '2026-11-14'),
                                   ('test_cases', [r[4] for r in rows])])
    path = os.path.join(HERE, 'uat.json')
    if os.path.exists(path):
        old = json.load(io.open(path, encoding='utf-8'))
        if 'tc_min' in old:
            uat['tc_min'] = old['tc_min']  # do coverage_calc.py ghi; giữ lại, không tự đặt
    w('uat.json', json.dumps(uat, ensure_ascii=False, indent=1) + '\n')

    # ── _coverage-ledger.md ────────────────────────────────────────────────────────────────────────────────
    by_layer = collections.Counter(r[2] for r in rows)
    by_type = collections.Counter(r[3] for r in rows)
    L = []
    L.append('# Coverage Ledger — đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)\n')
    L.append('> Sinh từ `_build.py` (một bảng mệnh đề cho cả ba tệp). Oracle: `_domain-pack.md` — lấy từ yêu cầu của anh và\n> tệp kế hoạch, không lấy từ mã. Cột **Tầng** nói bằng chứng phải đi qua đâu: **E2E** = Chrome thật + máy chủ + CSDL\n> thật · **API** = HTTP thật. Đợt này không có dòng nào ở tầng UNIT: mọi mệnh đề đều có chủ ngữ là người dùng hoặc\n> là hệ thống nhìn từ ngoài.\n')
    L.append('## TC_min = MAX(M1, M2, M3, M4)\n')
    L.append('**Khai cho máy đọc (`coverage_calc.py` tự tính lại, không lấy số người tự ghi):**\n`M2=%d` · `FP=%d` · `risk=%s`\n' % (M2, FP, RISK))
    L.append('M1 KHÔNG khai ở đây — nó được đếm từ số dòng của Sổ mệnh đề bên dưới.\n')
    L.append('| Phương pháp | Cách đếm | Giá trị |\n|---|---|---|')
    L.append('| **M1** spec coverage items (29119-4) | Đếm từ Sổ mệnh đề: %d luật trong `_domain-pack.md` khai triển qua AC, ca phủ định, EP, BVA, bảng quyết định, chuyển trạng thái | **%d** |' % (len(RULES), n))
    L.append('| **M2** Σ V(G) cyclomatic | Đo bằng `lizard` trên các tệp logic mới của ba phần (danh sách tệp ở cuối tệp này) | **%d** |' % M2)
    L.append('| **M3** ceil(FP^1.2) | %d chức năng người dùng thấy được (3 thao tác vòng đời + gộp/hoàn tác; nhập tiêu chí, cài theo tổ, 4 cách nhanh, nhập liệu, tổng hợp, file chính thức, đổi giữa kỳ; 5 tab phân quyền, mẫu khởi đầu, công tắc) | **%d** |' % (FP, -(-FP ** 1.2 // 1)))
    L.append('| **M4** risk-tier backstop | **CRITICAL**: đợt này đổi đường kiểm quyền của toàn hệ thống và phạm vi dữ liệu của ~231 cán bộ | **120** |\n')
    L.append('Tổng ca thật: **%d**. Số này nảy sinh từ Sổ mệnh đề; không ca nào chèn cho đủ số.\n' % n)
    L.append('Phân bố theo tầng: ' + ' · '.join('%s %d' % kv for kv in sorted(by_layer.items())) + '. Theo loại: ' + ' · '.join('%s %d' % kv for kv in sorted(by_type.items())) + '.\n')
    L.append('## Sổ mệnh đề\n')
    for prefix, title in GROUPS:
        L.append('### %s\n' % title)
        L.append('| cov_id | Mệnh đề | Tầng | Loại | TC |\n|---|---|---|---|---|')
        for cov, claim, layer, typ, tc, local, rule in rows:
            if rule.startswith(prefix):
                L.append('| %s | %s | %s | %s | %s |' % (cov, claim, layer, typ, tc['tc_id']))
        L.append('')
    L.append('## GAP đã biết (không có ca, có lý do)\n')
    L.append('| Mục | Lý do |\n|---|---|')
    L.append('| Hiệu năng (thời gian tải bảng so sánh, danh sách khi phạm vi Toàn bộ) | Chưa có ngân sách p95 do người đặt; không bịa ngưỡng. Số đo tham khảo: 30 yêu cầu có kiểm quyền trên máy cục bộ, trung vị 17 ms. |')
    L.append('| Thông báo đã gửi trước khi áp dụng | Giới hạn đã biết, ghi trong runbook: không thu hồi. Không phải lỗi để kiểm. |')
    L.append('| Khoá/hạ vai trò tài khoản quản trị cuối cùng | Giới hạn đã biết, ghi trong runbook; chưa có luật trong kế hoạch để làm oracle. |')
    L.append('| Mobile | Ứng dụng di động không có tệp nào trong các PR #650–#662. |')
    L.append('| ISO 25010 — tính tương thích dữ liệu khi nâng cấp | Migration chỉ thêm bảng/cột; kiểm bằng so số liệu production trước/sau mỗi lần deploy (đã làm, giống hệt), không phải ca UAT. |\n')
    L.append('## Tệp đo M2\n')
    L.append(os.environ.get('UAT_M2_FILES', '(chưa đo)') + '\n')
    w('_coverage-ledger.md', '\n'.join(L))

    # ── UAT-COVERAGE.md ────────────────────────────────────────────────────────────────────────────────────
    local_n = sum(1 for r in rows if r[5])
    C = []
    C.append('# UAT — Đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)\n')
    C.append('13 PR (#650, #652 → #662) · production bản `cb3f203a` · chế độ phân quyền theo tổ đang **Tắt**.\n')
    C.append('**%d ca / 3 nhóm.** Sàn `TC_min` do `coverage_calc.py` tính từ `_coverage-ledger.md`, không phải con số đặt ra.\n' % n)
    C.append('Điều kiện kết thúc: 100% dòng PASS **trên production hoặc bản sao production**. **Bỏ qua ≠ đạt.**\n')
    C.append('## Trạng thái đo được (14/11/2026)\n')
    C.append('| | |\n|---|---|')
    C.append('| Cổng máy của bộ viết ca | `validate_uat_json` ĐẠT · độ phủ %d/%d mục · **`TC_min` HỎNG: %d ca < sàn %d** (M2 chi phối, xem dưới) · ba mục cần người (gieo lỗi, soát đối kháng, đánh giá bằng người đóng vai) **chưa làm** |' % (n, n, n, max(n, M2, 120)))
    C.append('| Đã chạy trên production | **0/%d** |' % n)
    C.append('| Đã chạy trên máy chủ dựng CỤC BỘ, qua HTTP thật | **%d/%d** — `tools/uat-phan-quyen/workflow.cjs`, 40/40 bước đạt. Đây là tầng API trên CSDL thử, **không phải production**; các dòng E2E trong số này vẫn chưa có lượt chạy trình duyệt. |' % (local_n, n))
    C.append('| Chưa chạy ở đâu cả | **%d/%d** |' % (n - local_n, n))
    C.append('| Chặn ở | Tài khoản thử trên production (5 tài khoản cũ khoá từ 20/09); cần **hai quản trị viên**, **một cán bộ**, **một tổ trưởng**, **một cán bộ khác tổ**. Ca ghi dữ liệu và ca bật Áp dụng phải chạy trên bản sao, không chạy trên production thật. |\n')
    C.append('Ca kiểm tự động đã có (đơn vị, PostgreSQL, vitest) là tầng thấp hơn và **không thay được** các dòng dưới đây.\n')
    C.append('### Vì sao `TC_min` hỏng, và điều đó có nghĩa gì\n')
    C.append('`TC_min = MAX(M1, M2, M3, M4)`. M2 là tổng độ phức tạp vòng (cyclomatic) đo bằng `lizard` trên 17 tệp logic mới của ba phần: **%d**. Bộ ca này có %d dòng, mỗi dòng là một mệnh đề nhìn từ phía người dùng. Khoảng cách ấy là thật: phần lớn các nhánh trong bộ tính quyền (kế thừa, hợp quyền nhiều tổ, hạn dùng, so sánh trước/sau) được kiểm ở tầng đơn vị và PostgreSQL, là tầng mà quy ước UAT của kho **không tính**.\n' % (M2, n))
    C.append('M2 không bị hạ bằng cách bỏ bớt tệp khỏi phép đo, và không có ca nào chèn cho đủ số. Hai hướng để đóng khoảng này, cần anh chọn: (1) đào tiếp sổ mệnh đề cho bộ tính quyền (tổ hợp tổ cha/con × vai trong tổ × mức phạm vi × ngoại lệ × hạn dùng) tới khi số ca tự lên; (2) chấp nhận bằng văn bản rằng đường cơ sở (basis-path) của các tệp ấy do tầng đơn vị gánh, và UAT chỉ gánh mệnh đề phía người dùng.\n')
    C.append('## Quy ước\n')
    C.append('- **Oracle lấy từ `_domain-pack.md`**, tức từ yêu cầu của anh và tệp kế hoạch — không lấy từ mã nguồn.\n- Cột **Cục bộ**: `PASS` = bước tương ứng trong `workflow.cjs` đã đạt trên máy chủ dựng cục bộ; trống = chưa chạy.\n- Cột **Production**: chỉ ghi khi có lượt chạy thật kèm bằng chứng.\n')
    for prefix, title in GROUPS:
        C.append('## %s\n' % title)
        C.append('| ID | Màn hình / chức năng | Luật | Tầng | Loại | Ưu tiên | Cục bộ | Production |\n|---|---|---|---|---|---|---|---|')
        for cov, claim, layer, typ, tc, local, rule in rows:
            if rule.startswith(prefix):
                C.append('| %s | %s | %s | %s | %s | %s | %s | CHƯA CHẠY |' % (tc['tc_id'], claim, rule, layer, typ, tc['priority'], 'PASS' if local else ''))
        C.append('')
    C.append('## Đối chiếu ngược\n')
    C.append('Mỗi luật trong `_domain-pack.md` có ít nhất một dòng ở trên (`_build.py` dừng nếu có luật không dòng nào). Mỗi dòng trỏ về đúng một luật.\n')
    w('UAT-COVERAGE.md', '\n'.join(C))

    # ── bảng luật cho _domain-pack.md (in ra để dán; tệp ấy viết tay phần còn lại) ─────────────────────────
    R = [DOMAIN_HEAD, '## D1. Luật (oracle)\n', '| Luật | Nguồn | Phát biểu |', '|---|---|---|']
    for rid, (src, text) in RULES.items():
        R.append('| %s | %s | %s |' % (rid, src, text))
    R.append(DOMAIN_TAIL)
    w('_domain-pack.md', '\n'.join(R) + '\n')
    print('ok', n, 'ca;', len(RULES), 'luật; cục bộ', local_n)


if __name__ == '__main__':
    main()
