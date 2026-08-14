# ADR-0014: RLS chỉ có trên `users` và `audit_logs`; model mới không thêm policy

- **Trạng thái**: Đã chấp nhận (ghi nhận hiện trạng)
- **Ngày**: 2026-08-10
- **Liên quan**: `backend/prisma/migrations/99999999999999_init_rls/migration.sql`

## Bối cảnh

Migration `99999999999999_init_rls` bật Row Level Security cho đúng hai bảng: `users` và `audit_logs`. 66 model còn lại không có policy nào.

Phân quyền dữ liệu thật sự diễn ra ở tầng ứng dụng: `buildScopeFilter`, `assertParentInScope`, `assertCreatorInScope` trong `scope-filter.util.ts`, áp cho 12 resource.

Đợt thi công này thêm model mới (`PetitionDuplicateLink`, `RecordReturn`). Câu hỏi: có thêm RLS policy cho chúng không?

## Quyết định

Không. Giữ nguyên hiện trạng — model mới dựa vào cùng tầng DataScope như 66 model còn lại.

Ghi lại khoảng trống này thay vì để nó ngầm định.

## Hệ quả

- Nhất quán: không có hai cơ chế phân quyền dữ liệu song song, mỗi cái phủ một tập bảng khác nhau.
- Đánh đổi: bất kỳ đường truy cập nào không đi qua service layer — script, truy vấn tay, một endpoint tương lai quên gọi `assertParentInScope` — đều không bị chặn ở tầng database. Đây là rủi ro thật, chỉ là không mới.
- Nếu dự án tự nhận "tối đa hoá quản trị" thì đây là khoảng trống cần gọi tên, không được im lặng.

## Phương án đã cân nhắc và loại bỏ

**Thêm RLS cho hai model mới.** Loại vì nó tạo ra tình trạng nửa vời khó hiểu hơn hiện tại: người đọc sẽ tưởng RLS là cơ chế chung, rồi tin nhầm vào nó cho 66 bảng không có.

**Bật RLS cho toàn bộ.** Đúng hướng về chiều sâu phòng thủ, nhưng là một dự án riêng: cần session variable mang danh tính người dùng xuống tận connection, và phải đối chiếu từng policy với logic DataScope hiện có. Không thuộc phạm vi đợt này.

## Điều kiện xem lại

Khi có yêu cầu kiểm toán đòi phân quyền ở tầng database, hoặc khi xuất hiện đường truy cập không qua service layer (BI, replica đọc, script vận hành).

## Ghi chú vận hành

Tên migration `99999999999999_init_rls` luôn sort cuối cùng, nên **mọi migration mới đều chèn vào trước nó**. Không phải lỗi, nhưng dễ gây nhầm khi đọc lịch sử migration theo thứ tự.
