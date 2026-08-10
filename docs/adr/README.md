# Architecture Decision Records

Vì sao một quyết định được chọn, và **vì sao các phương án khác bị loại**.

Phần thứ hai mới là phần đắt tiền. Người sáu tháng nữa muốn "sửa cho gọn" một
chỗ khó hiểu gần như chắc chắn sẽ nghĩ ra đúng một trong những phương án đã bị
loại — mục "Phương án đã cân nhắc và loại bỏ" tồn tại để họ đọc được lý do
trước khi làm.

## Khi nào viết ADR

Khi quyết định thoả **cả hai**:

- Nó không suy ra được từ code. Đọc code chỉ thấy *cái gì*, không thấy *vì sao không phải cách kia*.
- Đảo ngược nó tốn kém, hoặc đảo nhầm thì hỏng thứ khác.

Không viết cho: chọn tên biến, chọn thư viện tương đương, cấu trúc thư mục.
Những thứ đó thuộc `PROGRESS.md` §Quyết định.

## Cách viết

Chép `0000-template.md`, đánh số tiếp theo, đặt tên file kebab-case.
Không sửa ADR đã chấp nhận — viết cái mới và đánh dấu cái cũ
`Đã thay thế bởi ADR-XXXX`. Lịch sử của một quyết định cũng là thông tin.

## Danh mục

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-feature-flag-core-keys-compile-time.md) | `isCore`/`defaultEnabled` ở compile-time, không thành cột DB | Đã chấp nhận |
| [0002](0002-subject-lawyer-caseid-stays-required.md) | `Subject.caseId`/`Lawyer.caseId` giữ NOT NULL | Đã chấp nhận |
| [0003](0003-petition-duplicate-decision-model.md) | Quyết định trùng đơn lưu ở model riêng; hợp nhất không xoá | Đề xuất |
| [0004](0004-no-post-settings-endpoint.md) | Không có `POST /settings` | Đã chấp nhận |
| [0005](0005-seed-only-reference-data.md) | Danh mục do Nhà nước ban hành chỉ nạp bằng seed | Đã chấp nhận |
| [0006](0006-delete-duplicate-settings-tabs.md) | Xoá ba tab mockup ở `/settings` thay vì hiện thực | Đề xuất |
| [0007](0007-feature-flag-api-gating-scope.md) | Gate API ở cấp class + danh sách không bao giờ gate | Đã chấp nhận |
| [0008](0008-mobile-blocks-api-gating.md) | Mobile phải đọc được cờ trước khi gate API | Đã chấp nhận |
| [0009](0009-feature-flag-cache-single-instance.md) | Cache cờ giả định một instance, không pub/sub | Đã chấp nhận |
| [0010](0010-alter-type-add-value-is-one-way.md) | `ALTER TYPE ADD VALUE` là một chiều | Đã chấp nhận |
| [0011](0011-partial-index-drift-is-accepted.md) | Chấp nhận drift do partial index; cổng chỉ cảnh báo | Đã chấp nhận |
| [0012](0012-lint-ratchet-instead-of-clean-slate.md) | Cổng lint là ratchet đơn điệu | Đã chấp nhận |
| [0013](0013-legacy-uat-suite-not-in-ci.md) | Bộ UAT cũ không vào CI; spec mới ở `tests/e2e-new` | Đã chấp nhận |
| [0014](0014-rls-only-on-users-and-audit-logs.md) | RLS chỉ có trên 2 bảng; model mới không thêm policy | Đã chấp nhận |
| [0015](0015-no-unsafe-rules-off-in-test-files.md) | Tắt họ `no-unsafe-*` trong file test (matcher Jest trả `any`) | Đã chấp nhận |
| [0016](0016-evidence-code-uniqueness-by-row-lock.md) | Mã vật chứng duy nhất bằng khóa hàng, chưa dùng partial unique index | Đã chấp nhận (tạm thời) |
| [0017](0017-candispatch-does-not-grant-write.md) | `canDispatch` cho quyền đọc toàn hệ thống, **không** cho quyền ghi | Đã chấp nhận |

## Cổng CI

`.github/workflows/adr-nudge.yml` **cảnh báo** (không chặn) khi một PR đổi
`backend/prisma/schema.prisma` hoặc `backend/src/feature-flags/` mà không chạm
`docs/adr/`. Cảnh báo, vì không phải thay đổi schema nào cũng là quyết định
kiến trúc — thêm một cột nullable thì không. Bỏ qua bằng cách thêm
`[adr-skip]` vào tiêu đề PR.
