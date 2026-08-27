# PROGRESS

STATUS: IN_PROGRESS

Cập nhật: 2026-08-27T12:30+07:00 | Milestone: M1/5 | Task: 1/1 của M1

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`.
     Kẹp nó giữa một dòng có nội dung khác thì hook không khớp và chặn mãi. -->

Epic hiện tại: **Đồng bộ form Vụ việc với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`

> Hai epic trước đã xong và lên máy thật, ghi ở
> [docs/progress/](docs/progress/): **Vụ án** (26/08) và **Đơn thư** (27/08, PR #249–#267).

## Đã hoàn thành

- [x] **M1-T1 · PR0 — vá xoá-trắng ở Vụ việc** — `oHeCu()` thay `v || undefined` cho 45 ô —
      PR #268, đã deploy `bf18132f`
- [x] **M2-T1 · PR1 — ba cột còn thiếu ở máy chủ** — PR #269, deploy `75ba807f`. Codex bắt 3
      lỗi P1 (DTO thiếu khai · service không ghi · `resolveCrime` chưa được gọi), đã vá. Cổng
      DTO mở rộng cho ba thực thể bắt luôn lỗi thật ở Vụ án: `sttCu` gửi lên mà không ai nhận.
- [x] **M3-T1 · PR2 — tách phần nạp dữ liệu và phép kiểm** — PR #271, deploy
- [x] **M4-T1 · PR3 — form Vụ việc theo bố cục 10 tab** — PR #272 + #273 + #274, deploy `730d3937`
- [x] **M5-T1 · PR4 — cột "Nguồn đơn/Đơn vị giao"** — PR #275 + #276, deploy `e1820224`
- [x] **M2-T2 · PR1b — bù dữ liệu trên máy chạy** — PR #270, deploy `9613f522`.
      `crimeChinhId` 1.117 · `phanLoaiNguonTinBanDau` 4.693 · `baoCaoBanGiamDocText` 96 ·
      Vụ án thêm 71 tội danh còn sót. Sao lưu `truoc-bu-vuviec-20260827_134927.sql.gz`.

## Đang làm dở

Task: UAT theo §9 — lập `UAT-COVERAGE.md` cho form và danh sách Vụ việc.
Đã làm: toàn bộ 5 PR của epic đã lên máy thật và đã bấm thử tay trên hồ sơ DI TRÚ.
BƯỚC TIẾP THEO: lập ma trận phủ (mọi màn hình + chức năng của epic), rồi chạy
`/uat-test-writer` → `/uat-test-runner` từng dòng.
File liên quan: `UAT-COVERAGE.md` (chưa có).

## Hàng đợi task kế tiếp

1. **UAT** theo §9
2. ~~PR2 — tách `IncidentFormPage.tsx` thành thư mục (thuần di chuyển)
~~PR3~~ · ~~PR4~~ — đã xong

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 27/08 | Ô "Tóm tắt nội dung" ghi CẢ HAI cột `name` + `description` | Anh chốt. Hệ cũ có đúng một ô; 97,5% hồ sơ đã trùng sẵn | PR3 |
| 27/08 | Thêm `crimeChinhId` đầy đủ cho Vụ việc | Anh chốt. Đồng bộ với Đơn thư và Vụ án, tra cứu/thống kê theo tội danh dùng được cho cả ba | PR1 |
| 27/08 | Tách `buildIncidentPayload` + `incident-form.types` ngay ở PR0 | Không tách thì bản vá xoá-trắng không kiểm chứng được; đây là tập con của PR2 | PR0, PR2 |
| 27/08 | PR2 KHÔNG đổi `IncidentFormPage.tsx` thành thư mục; chỉ tách `mergeIncidentApiToFormData` + `validate-incident` | Hai mảnh ấy là chỗ dễ mất dữ liệu nhất và là thứ PR3 cần; đổi tên tệp chỉ thêm nhiễu vào diff mà không giảm rủi ro nào. Router, nhập khẩu, ca kiểm đều không phải sửa | PR2 |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Anh viết "màn hình Danh sách vụ án" nhưng bối cảnh là Vụ việc | Đối tượng là **Vụ việc**; xử cả form lẫn màn danh sách của nó | Cùng lỗi chép lại ở hai yêu cầu trước; đo trên máy: `/doi-1/vu-viec-da-phan-loai` |
| Ô chọn-nhiều và ô tích khi "rỗng" | Gửi mảng rỗng / `false`, KHÔNG bỏ khoá | Bỏ hết lựa chọn là một hành động; bỏ khoá thì gỡ không được |

## Bấm thử trên máy thật — hồ sơ DI TRÚ

Vụ việc 100% (4.717/4.717) là hồ sơ di trú, nên bước này là bắt buộc chứ không phải cho đủ lệ.
Mỗi lần bấm lộ thêm một lỗi chặn mà ca kiểm không thấy:

| Lần | Kết quả | Vá ở |
|---|---|---|
| 1 | 10 tab đúng tên/thứ tự; nhưng ô "Phân loại ban đầu" TRỐNG ở 4.594/4.717 hồ sơ — bộ lựa chọn lệch từ vựng | #273 |
| 2 | `PUT → 400` "Tên vụ việc không được vượt quá 255 ký tự" — 4.530/4.717 hồ sơ (96%) không lưu được | #274 |
| 3 | `PUT → 200`; mở lại: tên cắt còn 252, **nội dung đầy đủ 294**, phân loại/tội danh/nguồn đơn/tên người báo đều nguyên vẹn | — |

Danh sách: 10 cột đúng bộ hệ cũ + Trạng thái; cột "Nguồn đơn/Đơn vị giao" hiện đúng dữ liệu
(các dấu `—` ở đầu danh sách là 118 hồ sơ tạm đình chỉ vốn không có nguồn đơn).

## Trạng thái test

Full suite máy chủ: **PASS 3.372/3.372**. Full suite giao diện: **PASS 2.313/2.313** (`--maxWorkers=2`; chạy full song song trên máy này
bị chập chờn do tài nguyên, không phải lỗi thật — đã kiểm từng tệp fail chạy riêng đều xanh).
`tsc --noEmit` + `tsc -b`: sạch.

Ca `EXPERT performance (PF-01)` chập chờn TRÊN MÁY NÀY khi tải nặng (ngân sách 5s, đo được
5.2–8.0s) — **fail cả trên `main` chưa đụng gì**, nên là nhiễu môi trường chứ không phải hồi
quy. CI là trọng tài; không đụng ngân sách.

## Nợ kỹ thuật / rủi ro

- **Em đã gộp PR #275 khi CI ĐANG ĐỎ.** Script chờ CI chỉ chờ "hết PENDING" rồi in kết quả,
  không kiểm pass/fail. Đã sửa script để thoát lỗi nếu bất kỳ check nào không xanh, và đã
  kiểm lại prod bằng tay (không hỏng gì). Không lặp lại.
- **Lỗ hổng chèn mã ở `shell-parity-gate.yml`** (đã vá, PR #276): tiêu đề PR do người gửi tự
  đặt được nội suy thẳng vào thân script shell.

- **Bẫy đã tháo (codex bắt):** ô `lyDoTamDinhChi` trên form đọc `d.lyDoTamDinhChi` trong khi
  cột thật máy chủ trả về là `lyDoTamDinhChiText` → ô LUÔN rỗng. Trước PR0 nó gửi `undefined`
  nên vô hại; sau PR0 nó gửi `null`, tức chỉ cần mở hồ sơ rồi bấm Lưu là xoá mất ghi chú tạm
  đình chỉ. Đã vá, và siết cổng để bắt cả LỚP lỗi: mỗi ô phải nạp từ ĐÚNG khoá máy chủ, ô đổi
  tên phải khai ở `O_DOI_TEN`.
- `sdtNguoiToGiac` của Vụ việc có **761 hồ sơ** sai định dạng — cùng lớp ký hiệu "không có" của
  hệ cũ đã dọn cho Đơn thư (`so-dien-thoai-he-cu.ts`). Chưa dọn cho Vụ việc; form Vụ việc hiện
  KHÔNG kiểm định dạng số nên chưa chặn Lưu, nhưng dữ liệu vẫn bẩn.
- `name` trùng `description` ở 4.598/4.717 hồ sơ (97,5%) — PR3 xử theo quyết định #1.
