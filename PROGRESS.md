# PROGRESS
Cập nhật: 2026-09-09 | Milestone: M3/5 | Task: 3/5

STATUS: IN_PROGRESS — M3 (đối chiếu bản in Word với hệ cũ)

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`.
     Kẹp nó giữa một dòng có nội dung khác thì hook không khớp và chặn mãi.
     Cảnh báo này giữ lại từ bản PROGRESS.md của epic trước (đã ALL_MILESTONES_DONE 28/08). -->

Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\gleaming-pondering-thacker.md`
Nhánh: `feat/in-tu-danh-sach`, tách từ `main` @ f8945c6e

## Milestone
- M1 — icon In trên cột Thao tác của 3 danh sách (+ bảng gộp)
- M2 — STT cũ ghép vào cột STT theo đúng format hệ cũ
- M3 — đối chiếu bản in Word với hệ cũ, sửa cho khớp
- M4 — UAT phủ 100% (§9)
- M5 — monkey test (anh yêu cầu 09/09, chạy sau khi xong toàn bộ)

## Đã hoàn thành
- [x] Đo nền trước khi làm (không có commit — chỉ đọc)
- [x] **M1 — icon In trên cột Thao tác** — 4 danh sách, 12 ca kiểm mới — commit 445e0b26
- [x] **M2 — STT cũ theo format hệ cũ** — `phanSttCu` + `dieuKienSttCu` + mở `sttCu` cho Vụ việc,
      21 ca kiểm mới

## Đang làm dở
Task: M3 — đối chiếu bản in Word với hệ cũ
Đã làm: chưa viết mã. Đã khảo sát xong 5 chỗ lệch của công cụ cũ.
BƯỚC TIẾP THEO: thêm cờ `--mau <code>` và chuyển phần dựng bản hệ mới sang gọi API xuất thật
trong `backend/src/legacy-migration/cli/so-ban-in.ts`
File liên quan: `so-ban-in.ts`, `document-templates/docx-renderer`, `ban-in-he-cu/*.docx`

## Hàng đợi task kế tiếp
1. M1 — provider + ActionContext + 3 registry + 4 shell + nới cột 7rem→9rem
2. M2 — `sttCu` vào select Vụ việc; ô STT ghép `- (STT cũ: n)`; lọc nhận `2016-208`
3. M3 — `so-ban-in.ts` gọi API thật + thấy cấu trúc đoạn; sửa ngắt đoạn; ca kiểm mở .docx thật

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 09/09 | Modal In dùng khuôn provider singleton sẵn có | `CompositeModalProvider` đã chừa chỗ mở rộng; không dựng cơ chế thứ hai | 1 tệp mới + 1 dòng cắm |
| 09/09 | Đối chiếu bản in qua ĐƯỜNG XUẤT THẬT | Công cụ cũ lệch máy chủ thật ở 5 chỗ → từng cho kết luận "0 lệch" sai | Bỏ phần dựng lại render trong CLI |
| 09/09 | Nhánh mới tách từ `main` | `feat/data-export-excel` đang 79 commit chưa gộp | Không trộn hai việc |
| 09/09 | Ca kiểm shell bọc `CompositeModalProvider` thay vì từng provider | Bọc riêng thì mỗi lần thêm modal dùng chung là phải sửa lại mọi tệp ca kiểm, và chúng đỏ vì lý do không liên quan | 3 tệp ca kiểm |
| 09/09 | `printModal` khai BẮT BUỘC trong `ActionContext` | Để tuỳ chọn thì một shell quên truyền là nút In im lặng không làm gì | Trình biên dịch bắt ngay, đã bắt 3 chỗ |
| 09/09 | Gom điều kiện lọc STT cũ vào `dieuKienSttCu` | Ba service chép tay cùng một dòng; sửa một chỗ thì hai chỗ kia vẫn theo luật cũ | 3 service dùng chung |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Giao thức §4 đòi chú thích tiếng Anh | GIỮ tiếng Việt | Chính §4 ghi "convention repo thắng"; toàn kho đang tiếng Việt; anh đã chốt riêng cho dự án này |
| "STT theo format hệ cũ" | Chép đúng `doi_1_xem.tpl:44`: `mã - (STT cũ: n)`, nghiêng đỏ, vắng khi rỗng | Đọc thẳng mã nguồn hệ cũ, không suy diễn |
| "phản ảnh đầy đủ cột STT" | STT tự thân đã trung thành; phần thiếu là `sttCu` chưa hiện ở đâu | Đo trên bản chạy (bảng dưới) |

## Số đo nền (bản chạy thật, 09/09)
- STT khớp `năm-stt` hệ cũ: vụ án 3.360/3.360 · vụ việc 4.596/4.715 · đơn thư 46.576/46.580
- 118 vụ việc lệch vì **bản thô hệ cũ không có `nam`/`stt`** (nhóm `TamDinhChi_vu_viec_21` đã biết);
  1 lệch là hậu tố chống trùng `-2`. Không phải lỗi trung thành.
- `sttCu` có dữ liệu: đơn thư 31.460/46.741 (67%) · vụ việc 3.323/4.723 (70%) · vụ án 1.486/3.381 (44%)
- Mẫu chứng từ đang bật: 28 (Đơn thư 14 · Vụ án 8 · Vụ việc 6); chỉ **8** có bản đối chứng hệ cũ

## Trạng thái test
Frontend **2829/2829** (231 tệp) · Backend **4457/4457** (300 tệp) · `tsc` sạch cả hai phía

## Nợ kỹ thuật / rủi ro
- `kieu-truong-he-cu.generated.ts` tự khai cổng CI `kieu-truong-he-cu.gate.spec.ts` — **tệp không tồn tại**
- 916 hồ sơ hệ cũ in được mà hệ mới chưa có màn in — treo từ 28/08, ngoài phạm vi
- Nhánh `feat/data-export-excel` 79 commit chưa có PR
