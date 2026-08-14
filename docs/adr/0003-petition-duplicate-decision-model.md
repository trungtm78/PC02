# ADR-0003: Quyết định trùng đơn lưu trong model riêng, và hợp nhất không xoá đơn

- **Trạng thái**: Đề xuất (sẽ chấp nhận khi PR-C4 merge)
- **Ngày**: 2026-08-10
- **Liên quan**: PR-C3, PR-C4, `backend/src/petitions/petitions.service.ts:1363`

## Bối cảnh

Màn `/classification/duplicates` gọi `GET /petitions?limit=100`, gán nhãn **mọi** đơn là "trùng", và nút "Xử lý" chỉ `alert()` rồi đóng modal — thao tác hợp nhất/tách/xem xét không lưu ở đâu cả.

Backend đã có thuật toán phát hiện trùng thật trong `exportDuplicates()` (`groupBy` + `having count > 1`), chỉ là màn hình không dùng.

Chưa có chỗ nào lưu **kết quả xử lý**. Và đây là dữ liệu có hiệu lực pháp lý: mỗi đơn thư có nghĩa vụ thụ lý, thời hạn và văn bản trả lời riêng theo Luật Khiếu nại/Tố cáo. Gắn nhãn "trùng" sai đồng nghĩa với việc **không giải quyết đơn của một công dân**.

## Quyết định

Model riêng `PetitionDuplicateLink` với `decision`, `reason`, `previousStatus` (ảnh chụp để hoàn tác), `decidedById`, `revertedAt`. Partial unique index `WHERE reverted_at IS NULL` để mỗi đơn chỉ có tối đa một quyết định đang hiệu lực.

`DA_HOP_NHAT` **không xoá** đơn trùng. Nó đổi `status` sang `DA_LUU_DON` và ghi **hai** bản ghi audit — một cho đơn trùng, một cho đơn gốc — nên cả hai hồ sơ đều thấy sự kiện này trên `/hanh-trinh`.

## Hệ quả

- Hoàn tác được, kèm lý do, kèm người quyết định. Bắt buộc với hồ sơ chịu kiểm sát.
- Thêm một model và một migration.
- Việc phát hiện trùng phải chính xác hơn mức hiện tại trước khi kết quả được ghi bền vững: `groupBy` một cột, khớp chuỗi chính xác, sẽ gộp nhầm hai công dân trùng tên — "Nguyễn Văn A" là chuyện thường ngày ở Việt Nam. PR-C3 nâng lên đa tiêu chí kèm điểm khớp thật (`matched/compared`), không phải một con số phần trăm bịa.
- `buildPetitionScopeFilter` đang áp **trước** `groupBy`, nên trùng lặp giữa các tổ là vô hình với user bị giới hạn phạm vi — mà trùng chéo tổ mới đúng là vấn đề chính sách cần phát hiện. Cần quyền riêng để xem.

## Phương án đã cân nhắc và loại bỏ

**Thêm cột vào `Petition` (`duplicateOfId`, `duplicateDecision`, ...).** Loại vì "hợp nhất" là một **quan hệ** kèm quyết định, người quyết và lý do; nhét vào bảng đơn thì cần ít nhất sáu cột và mất sạch lịch sử khi quyết định bị đảo.

**Xoá mềm đơn trùng khi hợp nhất.** Loại vì hồ sơ phải giữ được để đối chiếu khi kiểm sát, và vì nó biến một thao tác phân loại thành một thao tác xoá dữ liệu.

**Dùng `duplicate-search` sẵn có làm nguồn cho danh sách.** Loại — đó là ô tìm kiếm thủ công theo từ khoá, không phải bộ phát hiện. Nguồn đúng là `exportDuplicates`, được trích ra thành `findDuplicateGroups()` dùng chung cho cả màn hình lẫn Excel để hai đường không lệch nhau.

## Điều kiện xem lại

Khi có quy định nội bộ về ai được phép hợp nhất đơn và thời hạn của đơn bị hợp nhất được xử lý ra sao. ADR này mô tả cơ chế lưu trữ, không thay thế quy trình nghiệp vụ đó.
