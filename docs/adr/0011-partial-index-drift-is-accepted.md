# ADR-0011: Chấp nhận schema drift do partial index, cổng `migrate diff` chỉ cảnh báo

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-B0b, `.github/workflows/ci.yml` job `Advisory Checks`

## Bối cảnh

Cổng kiểm schema drift được đề xuất là bước **chặn** trong governance gate. Nhưng nó đỏ ngay lần chạy đầu, và không phải vì có lỗi.

Production mang ít nhất sáu partial index được tạo bằng SQL thô trong migration:

- `20260516120000_.../migration.sql:13,18`
- `20260522131024_.../migration.sql:12,13,14`
- `20260627130700_.../migration.sql:25`

Prisma 7 **không có cú pháp** cho partial index (`CREATE INDEX ... WHERE ...`), nên chúng không thể tồn tại trong `schema.prisma`. `migrate diff` so migration history với schema và thấy khác biệt — khác biệt đó là đúng và không sửa được.

Và PR-C4 còn cần thêm một cái nữa: partial unique index `WHERE reverted_at IS NULL` cho `PetitionDuplicateLink`.

## Quyết định

Đưa `prisma migrate diff` vào job `Advisory Checks` với `continue-on-error: true`. Nó chạy, in cảnh báo, không chặn merge.

Cùng lý do, cùng job: type-check `tests/` (9 lỗi trong 6 spec UAT tự sinh mà CI không chạy).

Mỗi bước có `continue-on-error` riêng để bật thành chặn độc lập khi giải quyết xong.

## Hệ quả

- Drift thật do quên viết migration vẫn hiện trong log, nhưng không ai bị buộc phải xử lý. Đây là điểm yếu có ý thức của phương án này.
- Governance gate giữ được tính chặn cho ba cổng còn lại, thay vì cả cụm bị vô hiệu vì một cổng luôn đỏ.
- Ghi rõ trong comment của job: danh sách migration gây drift, và điều kiện lật `continue-on-error`.

## Phương án đã cân nhắc và loại bỏ

**Để `migrate diff` chặn ngay.** Loại vì nó đỏ với 100% PR kể từ ngày bật, khiến cả job governance bị bỏ qua hoặc gỡ.

**Bỏ partial index để schema biểu diễn được.** Loại — chúng tồn tại vì lý do hiệu năng và ràng buộc dữ liệu thật.

**Ghi baseline cho drift giống hai ratchet kia.** Đây là hướng đúng và nên làm, nhưng `migrate diff` xuất ra một bản vá SQL chứ không phải danh sách vi phạm đếm được, nên cần một bộ so sánh riêng. Chưa làm.

## Điều kiện xem lại

Khi có bộ so sánh drift dạng baseline, hoặc khi Prisma hỗ trợ partial index trong schema. Cái nào tới trước.
