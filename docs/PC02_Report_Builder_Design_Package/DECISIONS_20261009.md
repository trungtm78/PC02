# Quyết định D01–D10 và sửa AC — chốt 09/10/2026

Tài liệu này là **phần bổ sung chính thức** cho BRD/FRD/Basic Design/Detail Design trong thư mục này. Khi có mâu thuẫn, tài liệu này thắng. Quyết định được anh (chủ sản phẩm) ủy quyền thường trực cho Claude tự chốt theo tiêu chí: quản trị chặt nhất, dễ mở rộng nhất, không giảm phạm vi, được tăng phạm vi, được đổi trình tự. Mã tham chiếu cho ủy quyền: `AUTH-0910`.

Bản đầy đủ có review kỹ thuật (`/plan-eng-review` + Codex outside voice) và toàn bộ phân tích: `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md`.

## D01–D10

| ID | Quyết định |
|---|---|
| D01 | Loại kỳ: `DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, YEARLY, ONE_TIME`. ONE_TIME tạo đúng một kỳ. |
| D02 | Ngày đầu kỳ tuỳ chỉnh. Hạn: `FIXED_IN_PERIOD` hoặc `DAYS_AFTER_END`. Mở nhập: đầu kỳ / N ngày trước hạn / open future periods. Tuỳ chọn dời hạn khỏi ngày nghỉ (`CalendarEvent` scope=SYSTEM, dùng `expandOccurrences()`). |
| D03 | Tổng hợp 3 chế độ: mặc định `SUBMITTED`, `APPROVED`, `ALL_SAVED` (luôn nhãn "Tạm tính"). Ô trống tính là 0 (`blankPolicy=ZERO` mặc định, chuyển được sang `IGNORE` theo field). |
| D04 | Nộp xong là khoá. Quản lý Duyệt / Trả lại (lý do + hạn sửa) / Huỷ duyệt. Chốt kỳ khoá cả kỳ + snapshot chính thức. Sửa sau chốt = revision điều chỉnh (ADJUSTMENT), giữ snapshot cũ. Hỗ trợ phê duyệt nhiều cấp theo `Team.parentId`. |
| D05 | Bắt buộc hỗ trợ công thức: `+ − * /`, `&`, so sánh, `SUM AVERAGE MIN MAX COUNT ROUND IF AND OR ABS`, tham chiếu A1/vùng/chéo sheet. Không eval, chặn vòng lặp, timeout. Tính hai tầng (cá nhân → tổng input → công thức tổng). |
| D06 | Lượt giao = báo cáo × kỳ × **Tổ** (không phải từng người). Người nhập mặc định là tổ trưởng (`UserTeam.isLeader`), thêm/bớt được. |
| D07 | Ô mặc định **không bắt buộc**. Mở khoá: grant (mặc định +3h), tổ xin mở lại → quản lý duyệt/từ chối, mở khoá hàng loạt, thu hồi. |
| D08 | Ngày 29–31 không tồn tại → lấy cuối tháng. Quý: chọn tháng thứ 1/2/3 + ngày. Tuần theo ISO week-year. Preview ≥6 kỳ. |
| D09 | Đổi mẫu/lịch/phân công áp dụng ngay cho kỳ đang chạy **nếu chưa tổ nào có số**; có số rồi thì áp từ kỳ kế tiếp. |
| D10 | Quyền mới `read/manage/admin:DynamicReport`. Vai trò theo báo cáo: **≥1 MANAGER** (không phải đúng một), VIEWER theo phạm vi cây tổ. Không ai sửa hộ số liệu, kể cả ADMIN. |

## Bảng AC cần sửa khi `/uat-test-writer` sinh ca kiểm (so với FRD/TRACEABILITY gốc)

| AC | Bản sửa |
|---|---|
| AC-002 | Ô mở khoá + rỗng/literal → **cảnh báo + gợi ý "đặt làm ô nhập"**, không chặn xuất bản (khác bản gốc "báo lỗi Sheet!Cell"). Khoá+token, công thức ở ô mở khoá, ô nhập bị ẩn → vẫn chặn. |
| AC-009 | ONE_TIME giữ nguyên; thêm AC-mới cho DAILY. |
| AC-011 | **≥1** quản lý (không phải "đúng một"); ≥1 tổ phải nộp; mỗi tổ ≥1 người nhập đang hoạt động. |
| AC-013 | Mặc định chế độ `SUBMITTED` (không phải `all_saved`), nhãn "Đã nộp X/Y · Đã duyệt Z/Y". |
| AC-023 | Nộp thì khoá ngay (không phải "vẫn sửa được tới hạn"); chỉ Trả lại hoặc mở khoá mới sửa tiếp. |
| AC-025 | Theo `blankPolicy`: mặc định `ZERO` cho SUM=10, AVG=3,33, COUNT=2 (khác bản gốc AVG=5, COUNT=2 — đó là hành vi `IGNORE`, field tự chọn được). |
| Mọi AC nói "người" | Đọc là "tổ (lượt giao)". |

Áp dụng bảng này khi `/uat-test-writer` đọc FRD để không lấy nhầm expected result cũ.
