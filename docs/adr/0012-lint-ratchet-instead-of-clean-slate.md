# ADR-0012: Cổng lint là ratchet đơn điệu, không phải ngưỡng tuyệt đối

- **Trạng thái**: Đã chấp nhận
- **Ngày**: 2026-08-10
- **Liên quan**: PR-B0a, `scripts/governance/lint-changed.cjs`, `scripts/governance/lint-baseline.json`

## Bối cảnh

`CLAUDE.md` mô tả các quy tắc chất lượng, và `backend/package.json` có script `lint`. CI chưa bao giờ gọi nó. Kết quả đo được: **~11.5k vấn đề** trên toàn repo (backend chiếm phần lớn), trong đó khoảng 5.3k là formatting tự sửa được, phần còn lại chủ yếu là `no-unsafe-*` trong mock test và `req: any`.

Bật `eslint --max-warnings=0` toàn repo nghĩa là chặn mọi PR cho tới khi dọn xong toàn bộ — nhiều tuần công việc không liên quan tới bất kỳ PR nào đang mở.

## Quyết định

Cổng đơn điệu: file mà nhánh **chạm vào** không được mang nhiều vấn đề hơn con số ghi trong `lint-baseline.json`. File mới phải sạch. Nợ chỉ được giảm, không được tăng.

Cùng nguyên tắc cho enum-literal guard, nhưng baseline ở đó là danh sách `file:value` chứ không phải số đếm.

## Hệ quả

- Ngăn được nợ phình thêm ngay hôm nay, thay vì một cổng hoàn hảo bật được sau vài tuần.
- Chạm file nào thì dọn file đó — nợ tan dần theo vùng code thực sự được sửa. PR-A1 dọn 117 vấn đề theo đúng cơ chế này.
- Điểm yếu: baseline theo số đếm nên thêm một vi phạm mới trong khi xoá một vi phạm cũ ở cùng file sẽ lọt. Chấp nhận — nó vẫn chặn được xu hướng.
- `--write-baseline` phải quét **đúng** tập thư mục mà cổng kiểm. Lần đầu hai bên lệch nhau khiến `prisma/seed.ts` fail `0 → 62` mà không có cách nào ghi nhận; nay `ownedBy()` là nguồn sự thật duy nhất cho cả hai.

## Phương án đã cân nhắc và loại bỏ

**`eslint --max-warnings=0` toàn repo.** Loại: chặn mọi PR cho tới khi dọn hết 11.5k vấn đề.

**Lint chỉ file thay đổi, ngưỡng tuyệt đối 0.** Đã thử. Loại vì nó fail ngay chính PR đầu tiên: mọi file legacy được chạm đều mang nợ sẵn, nên "sửa một dòng" biến thành "reformat cả file" — trộn mục đích và làm diff phình.

**Chạy `eslint --fix` toàn repo một lần.** Xoá được 5.3k vấn đề formatting nhưng đẻ ra một diff khổng lồ chạm gần như mọi file, giữa lúc đang chạy nhiều PR khác. Ghi lại như một PR riêng đáng làm khi hàng đợi vắng.

## Điều kiện xem lại

Khi tổng nợ giảm đủ để `--max-warnings=0` khả thi. Chạy `--write-baseline` sau mỗi đợt dọn để siết ratchet.
