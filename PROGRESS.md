# PROGRESS

STATUS: ALL_MILESTONES_DONE

Cập nhật: 2026-08-28T00:15+07:00 | Milestone: 5/5 + UAT + đợt rà soát từng cột | Task: xong

<!-- Dấu STATUS phải nằm ĐẦU DÒNG: `.claude/hooks/stop-guard.bat` neo bằng `^STATUS:`.
     Kẹp nó giữa một dòng có nội dung khác thì hook không khớp và chặn mãi. -->

Epic hiện tại: **Đồng bộ form Vụ việc với hệ cũ pc02hcm.com**
Spec gốc: `C:\Users\Than Minh Trung\.claude\plans\v-o-https-pc02hcm-com-login-b-ng-glistening-puffin.md`

> Hai epic trước đã xong và lên máy thật, ghi ở
> [docs/progress/](docs/progress/): **Vụ án** (26/08) và **Đơn thư** (27/08, PR #249–#267).

## Đợt 27/08 tối — rà soát TỪNG CỘT ba màn so hệ cũ

Anh yêu cầu kiểm từng cột của ba danh sách so với hệ cũ, và thêm: mặc định sắp theo STT
giảm dần, bấm tiêu đề đổi chiều.

- [x] **PR #283** — bốn cột đang hiện dữ liệu của cột khác, và sắp xếp theo STT.
      Em so từng ô, từng hồ sơ, trên 54.736 hồ sơ di trú (bản gốc hệ cũ nằm trong
      `legacyRaw`). Không cột nào HỤT, nhưng bốn cột lấy dữ liệu sai chỗ:

      | Màn | Cột | Đang hiện | Phải hiện | Sai |
      |---|---|---|---|---|
      | Đơn thư | Ngày đề xuất | ngày tiếp nhận | ngày đề xuất | 29.026 hồ sơ |
      | Đơn thư | Tóm tắt nội dung | bản rút gọn | nội dung thật | 58 hồ sơ |
      | Vụ việc | Tên cá nhân… | đối tượng bị tố | người cung cấp | khớp gốc 0% |
      | Vụ án | Tên cá nhân… | tên vụ án | người cung cấp | khớp gốc 0% |

      Codex bắt 5 lỗi ca kiểm không thấy, nặng nhất: `BigInt` làm `JSON.stringify` ném lỗi
      → mở BẤT KỲ hồ sơ nào là 500, cả ba màn. Đã vá, mỗi lỗi một nhánh cổng.

- [x] **PR #284** — đăng nhập hệ cũ (CHỈ ĐỌC) đọc thẳng mã nguồn ba màn anh chỉ
      (`/doi-1/don-thu`, `/doi-1/vu-viec-da-phan-loai`, `/doi-1/vu-an-da-phan-loai`).
      Xác nhận trực tiếp cả bốn bản vá trên, và bắt thêm một lệch: Vụ án ẩn nhầm cột
      "Nguồn đơn/Đơn vị giao" vì bản trước đo màn `/VuAn` — một màn KHÁC.

### Bấm thử trên máy thật sau deploy #283

| Việc | Kết quả |
|---|---|
| Thứ tự mặc định STT giảm dần | đúng ở cả ba màn |
| Bấm tiêu đề đổi chiều | đúng ở cả ba màn |
| Sắp theo SỐ, không theo chuỗi | `2026-10000 → 2026-9999` đúng; 1.500 mã liên tiếp không sai chỗ nào |
| Bốn cột đã vá | hiện đúng dữ liệu |
| Mở chi tiết (chỗ BigInt từng gây 500) | mở được cả ba màn |
| Bù ngày đề xuất | 426 hồ sơ, nay không còn hồ sơ nào thiếu |

### Khác hệ cũ CÓ CHỦ Ý

Sắp mặc định của hệ cũ là `stt` **tăng dần**; anh yêu cầu **giảm dần** nên hệ mới để giảm dần.

### Đã đo, KHÔNG dựng được

| Cột | Lý do |
|---|---|
| "Đơn vị" (`don_vi_ten`) | hệ cũ suy tên lúc chạy; bản gốc 0 bản ghi, mã đơn vị ánh xạ ra nhiều tên |
| "Đối tượng bị can" của Vụ việc | `bi_can_info` rỗng ở cả 5.000 hồ sơ mẫu, hệ mới không có quan hệ ấy |

Dựng cột rỗng cho khớp danh sách là bịa dữ liệu.

## Đợt 27/08 chiều — cột "Đơn vị giải quyết" rỗng toàn bộ

Anh chỉ ra trên ảnh chụp hệ cũ. Đo lại: hỏng thật, và hỏng hoàn toàn.

- [x] **PR #280** — quy Đơn thư · Vụ việc · Vụ án về một cột `donViGiaiQuyet`.
      `unit` có **0** bản ghi, `donViGiaiQuyet` có 46.642 đơn thư + 3.286 vụ án. Ba lớp (ô
      form · cột danh sách · bộ lọc) nhất quán với NHAU ở cột sai nên mọi ca kiểm khứ hồi
      đều xanh. Kèm ba cổng mới, và dedup **31 ô trùng** của Vụ án mà cổng thứ ba bắt được.
      Codex hai vòng bắt 5 lỗi em đã miss — nặng nhất: mở vụ án di trú rồi Lưu sẽ **xoá
      trắng** đơn vị giải quyết. Đã deploy, bấm thử máy thật xanh.
- [x] **PR #281** — bộ dọn số điện thoại chạy cho cả ba bảng (trước chỉ Đơn thư).
      Vụ việc 293 ô, Vụ án 7 ô mang ký hiệu "không có". Kèm ca kiểm khứ hồi "mở hồ sơ di
      trú rồi Lưu thì không mất gì" dựng theo hình dạng dữ liệu MÁY THẬT.

### Bấm thử trên máy thật sau deploy #280

| Việc | Kết quả |
|---|---|
| Đơn thư — cột "Đơn vị giải quyết" | 99/100 dòng có dữ liệu: "Tổ công tác Số 1", "BCH Đội 4", "PC01 Công an TP. HCM" |
| Lọc Đơn thư "Đội 8" | ra đúng, mọi dòng đều "Đội 8" |
| Vụ án — cột ấy | **100/100** dòng có dữ liệu |
| Lọc Vụ án "Đội 8" | ra đúng |
| Vụ việc (hồi quy) | không đổi |

### Dọn số điện thoại đã chạy trên máy thật — 27/08 21:30

Sao lưu trước: `/home/pc02/backups/pre-don-sdt-20260827-213021.sql.gz` (71 MB, ba bảng).

| Màn | Quét | Xoá ký hiệu "không có" | Chuẩn hoá | Giữ lại vì không đoán được |
|---|---|---|---|---|
| Đơn thư | 2.881 | 3 | 0 | 114 |
| Vụ việc | 781 | **756** | 5 | 0 |
| Vụ án | 597 | **518** | 8 | 1 |

Trước khi cho chạy, em soi đủ danh sách sẽ xoá: **không có một số thật nào** — toàn `0`
(431 + 466 lần), `"không có"`, `0000`, `000`, `00`, `...`, `.`. Con số 293 đo lúc đầu chỉ
đếm ô không chứa chữ số nào; họ `0`/`0000` cũng là ký hiệu để trống của hệ cũ.

Chạy lại lần hai: **0 thay đổi** — đúng tính bình ổn. Máy thật khoẻ.

### Đã đo, KHÔNG phải lỗi

**514/4.717 vụ việc trống ô "Đơn vị giải quyết"** — bản gốc hệ cũ (`don_vi_giai_quyet`) cũng
rỗng ở đúng những hồ sơ ấy. Có `don_vi_id` nhưng mã ấy ánh xạ ra NHIỀU tên khác nhau (mã "9"
ra cả "Đội 8", "Đội 7", "Đội 9") nên không suy được tên. Hệ cũ cũng hiện trống.

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

## UAT — 29/29 dòng PASS

Ma trận phủ ở `UAT-COVERAGE.md`. Năm ca bấm tay còn lại đã chạy hết:

- **VV-07** xoá trắng → Lưu → mở lại: ô trống hẳn, ô khác giữ nguyên.
- **VV-08** tạo mới qua 10 tab: `POST 201`, ô `legacyExtra` lưu được TỪ MÀN TẠO MỚI, xoá hồ sơ
  thử xong đếm lại đúng 4.717.
- **VV-16** nút "Khởi tố thành vụ án" còn nguyên.
- **HQ-01** Đơn thư: `PUT 200`.
- **HQ-02** Vụ án: `PUT 200`, liên kết nguồn nguyên vẹn.

Bước hồi quy bắt được HAI lỗi chặn ở Vụ án, cả hai CÓ TRƯỚC epic này: `receiveDate` chưa bao
giờ được di trú ghi (3.359/3.359 hồ sơ, vá ở #277) và mở vụ án có nguồn gốc là XOÁ liên kết
nguồn ngay rồi chặn Lưu bằng chính ô vừa xoá (169 hồ sơ, vá ở #278).

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
