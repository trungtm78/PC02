# Đối soát entity con: bị can (bi_can) & điều tra bổ sung (dieu_tra_bo_sung)

> feat/legacy-field-parity — PR-5. Kết luận: **KHÔNG có data cấu trúc để di trú** cho 2 entity con này; thông tin liên quan đã được bảo tồn qua đường khác.

## Xác minh nguồn (MongoDB LIVE + dump)
- `bi_can`: collection **RỖNG** (0 document) cả trên live `14.225.208.229` lẫn dump (`bi_can.ejsonl` = 0 byte). Xác nhận lại lần này (2026-08-03).
- `dieu_tra_bo_sung`: **KHÔNG tồn tại** trên live (export 14 collection không có file này) → 0 document.

→ Hệ cũ pc02hcm.com **không lưu bị can/ĐTBS dưới dạng bản ghi cấu trúc riêng**. `TruongTuyChinh` có định nghĩa field cho `bi_can`/`dieu_tra_bo_sung` (form động) nhưng **không có DATA**.

## Thông tin nghi can/bị can được bảo tồn ở đâu (không sót)
1. **Trường tự do `nghi_van_doi_tuong`** (hệ cũ) — "Nghi vấn đối tượng hoặc bị can", vd `"Lương Huỳnh Vũ (SN: 1988)"`. Đã map thành **cột typed**:
   - Đơn thư → `suspectedPerson`
   - Vụ việc → `doiTuongCaNhan`
   - Vụ án → `nghiVanDoiTuong` (cột mới field-parity)
2. **Subject (bảng nghi can hệ mới)** — **1.301 dòng** đã bóc tách tự động từ `nghi_van_doi_tuong` qua `cli/enrich-subjects.ts` (họ tên + năm sinh bắt được bằng regex). Đây là biểu diễn cấu trúc của thông tin nghi can.

## Kết luận
- KHÔNG cần tạo bảng/di trú `bi_can`/`dieu_tra_bo_sung` — **không có data nguồn**.
- Entity `Subject` + `InvestigationSupplement` (hệ mới) **đã tồn tại** cho nhập tay tương lai.
- "Không sót dữ liệu": mọi thông tin nghi can có trong hệ cũ (chỉ ở text tự do) đều đã vào cột typed + Subject.
