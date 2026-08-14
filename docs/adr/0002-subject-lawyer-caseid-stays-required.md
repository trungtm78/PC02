# ADR-0002: `Subject.caseId` và `Lawyer.caseId` giữ nguyên NOT NULL

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-D2, `backend/src/common/utils/scope-filter.util.ts:107-112`, `backend/prisma/schema.prisma`

## Bối cảnh

Màn `/lawyers` và `/objects` (`/people/suspects|victims|witnesses`) chỉ đọc. `POST /subjects` và `POST /lawyers` tồn tại nhưng chỉ được gọi từ trong trang chi tiết vụ án, nên không tạo được luật sư hay đối tượng độc lập.

Phản xạ đầu tiên là cho `caseId` nullable để có "danh bạ dùng chung".

Nhưng `assertParentInScope` **deny-by-default khi parent là null** (`scope-filter.util.ts:107-112`, đây chính là bản vá P0-001). Và `buildScopeFilter` lọc theo `where.case`, nên bản ghi không có cha cũng biến mất khỏi mọi danh sách của user không phải admin.

## Quyết định

Giữ `caseId` NOT NULL. Form tạo độc lập có một ô **bắt buộc** chọn vụ án (`CasePickerField`), lấy danh sách từ `GET /cases?search=` — vốn đã lọc theo DataScope, nên người dùng chỉ chọn được vụ án trong phạm vi của mình.

## Hệ quả

- Không có bản ghi mồ côi, nên không có bản ghi vô hình với người không phải admin.
- Zero migration. Không đụng tới dữ liệu hiện có.
- Đánh đổi: không có "danh bạ luật sư" độc lập với hồ sơ. Muốn gắn một luật sư vào vụ án thứ hai thì tạo bản ghi thứ hai.

## Phương án đã cân nhắc và loại bỏ

**Cho `caseId` nullable.** Loại vì phải viết lại toàn bộ đường DataScope của hai resource: thêm cột `assignedTeamId`/`createdById` riêng cho `Subject` và `Lawyer`, sửa `assertParentInScope` để hiểu bản ghi không có cha, sửa `buildScopeFilter`. Chi phí không tương xứng, và nó chạm vào chính đoạn code đã từng là lỗ hổng P0.

**Bảng danh bạ riêng (`Person`) rồi liên kết nhiều-nhiều với vụ án.** Đúng về mặt mô hình dữ liệu, nhưng là một cuộc di trú cho 53k bản ghi legacy trong lúc đang chạy 28 PR khác. Ghi lại ở đây như hướng đi nếu nghiệp vụ thực sự cần dùng chung.

## Điều kiện xem lại

Khi có yêu cầu nghiệp vụ thật về tra cứu một luật sư/đối tượng xuyên nhiều hồ sơ, kèm quy tắc rõ ràng ai được thấy gì. Lúc đó phương án `Person` mới đáng làm.
