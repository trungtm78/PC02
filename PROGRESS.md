# Tiến độ — In từ danh sách · STT cũ · bản in Word giống hệ cũ

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`. -->
STATUS: IN_PROGRESS — chờ #350/#351 lên máy, rồi đo lại vòng 4 và chốt

## Đã xong và ĐÃ LÊN MÁY THẬT

- **M1 · Nút In trên cột Thao tác** (PR #346) — ba màn danh sách + bảng gộp.
- **M2 · STT cũ trong cột STT** (PR #346) — dạng `16-243 - (STT cũ: 208)`; ô lọc nhận cả
  `208` lẫn `2016-208`; mở `sttCu` trong `select` của Vụ việc.
- **M3a · Sửa PHÉP ĐO trước khi sửa bản in** (PR #346) — bộ bóc chữ cũ gộp cả `</w:p>` lẫn
  `<w:br/>` thành `
`, nên bản tách đoạn và bản ngắt dòng mềm cho ra ĐÚNG MỘT mảng. Đây là
  chỗ mù đã đỡ cho kết luận "0 chỗ lệch" ngày 28/08.
- **M3b · Đối chiếu qua ĐƯỜNG XUẤT THẬT** (PR #346) — `cap-ban-in.ts` gọi API xuất của máy chủ.
- **M3c · Ngắt đoạn như hệ cũ** (PR #346) — 38 dòng lệch → 3, và cả 3 là hệ cũ tự in ra tên
  biến của nó. Prod-verified 09/09.

## Đã gộp — PR #347 (chờ deploy)

- **Mẫu hệ cũ phủ đủ thực thể**: 5.227 hồ sơ có chứng từ hệ cũ in được mà hệ mới không mời in
  (Vụ án 4.338 · Trả hồ sơ 441 · Đơn thư 245 · Đăng ký bào chữa 198 · …). Đo trên toàn bộ
  54.697 hồ sơ. Sửa bằng cách thêm dòng mẫu cho từng thực thể — khoá `(entityType, code)` cho
  phép, không đụng lược đồ.
- **Định dạng của nhãn trùm lên cả câu** — ANH PHÁT HIỆN: hệ cũ chỉ đậm nhãn "Đề xuất:" và tên
  đơn vị, hệ mới đậm + gạch chân cả câu. Hai bước chuẩn hoá cùng gây ra; cả hai đã sửa.
- **Phép so KIỂU CHỮ** — tầng thứ ba của công cụ. Hai tầng cũ (chữ · đoạn) không thể thấy lỗi
  trên: chữ giống hệt, còn đậm là thuộc tính của run.

## BƯỚC TIẾP THEO

1. Chờ #350 (`de_xuat` ngắt dòng mềm) và #351 (thông báo trực tuyến 401) lên máy thật.
2. Đo lại vòng 4 đủ 10 cặp — kỳ vọng hồ sơ 18 về 1 chỗ lệch (chỉ còn `${ nguon_don}` của hệ cũ).
3. Chạy lại monkey test sau #351 để xác nhận 401 đã hết.
4. Dựng ảnh từng trang cho bộ cuối, giao anh đối chiếu bằng mắt.
5. Dọn tệp tạm `tmp-*` trong kho.

## Đã xong (M1 · M2 · M3 · M4 · M5)

- **M1** nút In: PASS trên máy thật, tải được `ChungTu_20260909.docx`.
- **M2** STT cũ: PASS trên máy thật (hồ sơ `2017-259`).
- **M3** bản in Word: 9/10 cặp sạch cả ba tầng; cặp cuối vá ở #350.
- **M4** sổ phủ UAT: 5/5 mệnh đề có chủ ngữ là CÁN BỘ đã chạy thật.
- **M5** monkey test: 44 màn, 0 màn trắng, bắt được lỗi thông báo trực tuyến (#351).

## Còn treo

- **Cổng CI "Maestro on Android emulator" hỏng sẵn từ 23/08**: ghim SHA của
  `subosito/flutter-action` không còn tồn tại nên chạy 2 giây là đỏ. Không liên quan việc này,
  nhưng một cổng luôn đỏ là tiếng ồn che mất cổng đỏ thật — chờ anh quyết có sửa không.

- **916 hồ sơ** hệ cũ in được mà hệ mới chưa có màn in (hướng dẫn 540 · trao đổi 76 · …).
- Nhánh `feat/data-export-excel` còn 79 commit chưa gộp, chưa có PR.

## Chưa làm

- **M4** — `UAT-COVERAGE.md` 100% PASS.
- **M5** — monkey test.
