# Tiến độ — In từ danh sách · STT cũ · bản in Word giống hệ cũ

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`. -->
STATUS: IN_PROGRESS — M3 vòng cuối (PR #349 hoàn lại giả thuyết sai), rồi tới M5 monkey test

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

1. Gộp #349 → deploy → chạy lại `cap-ban-in` vòng 4, kỳ vọng hồ sơ 18 về mức vòng-2 rồi soi
   nốt 5 chỗ lệch còn lại của nó.
2. Dựng ảnh từng trang của các cặp giao anh đối chiếu bằng mắt.
3. **M5 — monkey test.**

## Kết quả đo mới nhất (vòng 3, sau khi #348 lên máy thật)

Chín trong mười cặp **0 lệch cả ba tầng** (chữ · đoạn · kiểu chữ), kể cả hai cặp kiểm chéo
mẫu-khác-thực-thể. Cặp còn lại là hồ sơ 18, xấu đi vì một giả thuyết sai đã được hoàn lại ở #349.

Ba dòng lệch duy nhất còn lại ở vòng 2 đều là hệ cũ tự in ra tên biến của nó (`${de_xuat}`,
`${ nguon_don}`) — lỗi hệ cũ, cố ý không chép.

## Còn treo

- **916 hồ sơ** hệ cũ in được mà hệ mới chưa có màn in (hướng dẫn 540 · trao đổi 76 · …).
- Nhánh `feat/data-export-excel` còn 79 commit chưa gộp, chưa có PR.

## Chưa làm

- **M4** — `UAT-COVERAGE.md` 100% PASS.
- **M5** — monkey test.
