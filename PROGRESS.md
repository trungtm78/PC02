STATUS: IN_PROGRESS
# PROGRESS
Cập nhật: 2026-09-15T00:30+07:00 | Milestone: M1/7 | Task: 6/7

<!-- Dấu trạng thái kết thúc chỉ ghi ĐẦU DÒNG khi hoàn tất hoặc bị chặn — stop-guard.bat neo theo đầu dòng. -->

Spec gốc:
- M1: `docs/superpowers/specs/2026-09-14-loai-thong-tin-design.md`
- M2–M6: `docs/superpowers/specs/2026-09-14-tim-kiem-dang-the-design.md` (đã qua /plan-eng-review, 22 phát hiện đã gộp)

## Milestone
| # | Nội dung | Nhánh |
|---|---|---|
| M1 | Ô Loại thông tin: một ô smart select, danh mục LOAI_THONG_TIN, nhóm hạn, chuẩn hoá dữ liệu | feat/loai-thong-tin-smart-select |
| M2 | Tìm kiếm dạng thẻ — T0 đo trước + PR1 nền + Đơn thư + lát Tổng hợp | feat/tim-kiem-dang-the-nen |
| M3 | PR2 Vụ việc, Vụ án, Ủy thác điều tra | |
| M4 | PR3 Tổng hợp đầy đủ, Đối tượng, Luật sư | |
| M5 | PR4 12 màn tìm phía trình duyệt | |
| M6 | PR5 9 màn tìm phía máy chủ + GlobalSearchBar | |
| M7 | UAT phủ 100% (UAT-COVERAGE.md) | |

## Đã hoàn thành
- [x] M1-spec — commit eb1afe00 — đặc tả Loại thông tin
- [x] M2-spec — kế hoạch tìm kiếm dạng thẻ + /plan-eng-review (outside voice Claude subagent; Codex hết giờ)
- [x] M1-T1 — commit 74f7ede6 — khoaLoaiThongTin + nhomHanTheoTen (31 ca chuỗi thật, phủ 100%)
- [x] M1-T2 — commit f6dc213a — tạo nhanh LOAI_THONG_TIN chặn trùng theo khoá gộp (directory 53 ca, phủ 98,9%)
- [x] M1-T3 — commit 90974a41 — petitionType tuỳ chọn, suy nhóm hạn từ danh mục; field-catalog loaiDon ưu tiên loaiThongTin
- [x] M1-T4 — commit 2cfbbeb4 — bộ nạp hệ cũ chuẩn hoá loaiThongTin + gán petitionType (legacy 59 bộ/950 ca)
- [x] M1-T5 — commit (feat(don-thu) một ô Loại thông tin) — gỡ ô Loại đơn thư, FKSelect LOAI_THONG_TIN + tạo nhanh, popup câu chữ theo loại, tách hook popup (lint react-refresh) — frontend 237 tệp/2.863 ca

- [x] M1-T6 — commit feat(legacy) CLI nap-loai-thong-tin — 35 ca (util phủ 100% dòng, CLI 87,7% — phần chưa phủ là khối `require.main`); pc02_that: 512 mục/352 chờ duyệt, đổi loại 7.054, nhóm hạn 46.721, lần 2 ra 0, NFD 0, updatedAt không đổi

## Đang làm dở
Task: M1-T7 — /review + /codex → PR → CI → merge → deploy → chạy CLI trên prod
Đã làm: /review xong (4 chuyên gia + Claude đối kháng + Codex). Sửa: update đè/xoá nhóm hạn mỗi lần Lưu (chặn merge), client petitionType vòng qua luật hạn, tra danh mục không tất định/tính mục đã tắt, bộ nạp lệch nhóm hạn khi hệ cũ đổi loại, tạo nhanh đụng mã P2002, CLI bỏ lặng lẽ mục, luật tiền tố "Đơn tố cáo"/"Tố cáo/khiếu nại", rò mock giữa ca. Commit fix(loai-thong-tin). Còn INVESTIGATE (không sửa, ghi nợ): đổi TÊN mục danh mục làm hồ sơ mang tên cũ mất nhóm hạn danh mục (hồ sơ lưu tên, không lưu id); endpoint tạo nhanh chưa giới hạn tần suất; bản in "Loại đơn" của đơn cũ đổi từ nhãn nhóm hạn sang chữ loại (đúng đặc tả §3.3); tạo nhanh khớp cả mục đã tắt (có từ DON_VI).
BƯỚC TIẾP THEO: /review diff nhánh so với main; codex review; push + gh pr create; chờ CI xanh (kiểm kết quả, không chỉ hết PENDING); merge; kiểm deploy + bản công khai; prod: sao lưu → chạy thử CLI → **DỪNG xin anh xác nhận trước --that**
Điểm cần anh duyệt trong bảng gộp: "Tố giác"/"Trình báo"/"Đề nghị" nhóm hạn Phản ánh (15 ngày) theo đặc tả; "Đơn tố cáo" (2 hồ sơ) rơi vào Phản ánh; "Đề nghị (lần 2/3)" là mục riêng; 352 mục chờ duyệt đa số lỗi gõ

## M1 HOÀN TẤT (15/09) — kiểm prod sau ghi: nhóm hạn PHAN_ANH 43.955 · KHIEU_NAI 2.307 · KIEN_NGHI 628 · TO_CAO 322 · trống 20; NFD 0; updatedAt bị đẩy 0; loại ngoài danh mục 0

## M1-T7 trên prod (15/09 00:22)
- PR #375 merge 727f0970, CI + Deploy success, health ok buildId 727f0970, bundle có field-loaiThongTin.
- Sao lưu: /home/pc02/backups/truoc-nap-loai-thong-tin-20260915-002214.dump (133 MB, 72 bảng dữ liệu).
- Chạy thử CLI prod: 47.232 đơn thư → 517 mục (356 chờ duyệt), đổi tên 7.016, điền từ tóm tắt 67, không suy được 20, gán nhóm hạn 47.162. CSV: /home/pc02/backups/loai-thong-tin-bang-gop-20260915-002214.csv
- Anh xác nhận 15/09 → `--that` xong: thêm 517 mục, đổi loại 7.083 hồ sơ, gán nhóm hạn 47.162; chạy lần 2 ra 0 (20 hồ sơ không suy được giữ trống).

## Phát hiện M2-T0 (đo trước khi xây, 15/09 trên pc02_spike = bản sao pc02_that)
- **Prod là PostgreSQL 16.15** (không phải 18 như local). `pg_trgm` đã cài; `unaccent` có sẵn, chưa cài. `pc02_user` không superuser nhưng là chủ DB + có CREATE → cài được extension trusted `unaccent` trong migration. Prod 47.232 đơn thư.
- `f_bo_dau` IMMUTABLE đúng: "Nguyễn  Văn Á"→"nguyen van a", "ĐỖ"→"do", NBSP gộp.
- Hiệu năng (47.169 dòng): người gửi ≥3 ký tự LIMIT 20 = 10 ms, đếm 41 ms (GIN); 1–2 ký tự đếm 71 ms (GIN); "tất cả cột" LIMIT 0,7 ms, đếm 184 ms (10k dòng); từ hiếm 3 ms. Chỉ mục: người gửi 3,5 MB, tất cả cột 25 MB. Đạt < 300 ms.
- **Backfill trong migration mất 35 s (UPDATE 47k) + dựng GIN 14 s** — khoá bảng lúc deploy. Đổi kế hoạch: migration chỉ thêm cột/hàm/trigger/chỉ mục; nạp cột bóng bằng CLI theo lô, idempotent, không đẩy updatedAt.
- **Prisma `contains` KHÔNG thoát `%`/`_`** (contains '%' khớp 47.169/47.169). Helper tìm kiếm PHẢI tự thoát `\ % _` trước khi đưa vào contains.
- **boDauTiengViet (JS) ≠ f_bo_dau (SQL)**: `unaccent` đổi cả dấu câu (ngoặc kép cong “ ” → "), JS giữ nguyên. Đo 67.695 chuỗi thật (người gửi, loại thông tin, đơn vị, 200 ký tự đầu tóm tắt): lệch 221 (0,33%), TOÀN BỘ là dấu câu — “→" 109, –→- 58, …→. 45, ’→' 7, ¾→3 1, ”→" 1; không lệch chữ nào. Chốt T4: bộ bỏ dấu cho tìm kiếm phía JS mô phỏng đúng các ánh xạ dấu câu này (bảng nhỏ, có ca kiểm vàng chạy trên PG), không tự viết bảng chữ riêng ở SQL.

- **`unaccent.rules` khác theo phiên bản**: PG16 prod 1.650 dòng, PG18 local 2.661 (thêm 1.011, khác dịch 29). Chốt T0-d: bỏ phụ thuộc `unaccent`; một bảng ánh xạ TS sinh cả hàm JS lẫn thân `f_bo_dau` SQL (`translate` + `replace`), gate so bảng ≡ SQL. Không cần cài extension trên prod.

## M2-T4 bỏ dấu tìm kiếm (15/09)
- `backend/src/common/tim-kiem/bo-dau.ts`: bảng ánh xạ (mã điểm, không ký tự vô hình) → `boDauTimKiem` + `sinhHamFBoDau` (translate/replace, không unaccent) + `thoatLike`. Spec 26 ca, phủ 100%.
- Ca kiểm vàng PG18 local (pc02_spike): 99.553 chuỗi thật + 646 tổng hợp → 0 lệch. PG16.15 prod (hàm `pg_temp`, không ghi bền): 646 tổng hợp → 0 lệch. Probe tạm ở scratchpad/probe-vang-f-bo-dau.cjs — **phải chuyển thành CLI trong repo** (`common/tim-kiem/cli/kiem-vang-bo-dau.ts`) cùng T2/T12, không để công cụ kiểm nằm ngoài kho mã.

## M2-T1/T2 cột bóng + bộ sinh (15/09)
- Khai `common/tim-kiem/khai/don-thu.khai.ts` (13 trường theo cột danh sách + soHoSoCu) → bộ sinh `sinh/sinh-tim-kiem.ts` (migration SQL, field Prisma, `frontend/src/shared/tim-kiem/generated.ts`) + CLI `npm run gen:tim-kiem [-- --moi <ten>]` + cổng `tim-kiem-sinh-khop.gate.spec.ts` (đỏ trước khi sinh, xanh sau; có gieo lỗi).
- Migration `20260915060305_tim_kiem_don_thu`: f_bo_dau sinh từ bảng, 6 cột bóng + tim_kiem_bd trên petitions, ho_ten_bd trên users, trigger BEFORE INSERT/UPDATE OF có EXCEPTION, GIN trigram; KHÔNG backfill.
- Chạy thật pc02_spike PG18: migration sạch; sửa cột nguồn → cột bóng đổi; sửa cột khác → trigger không chạy; f_bo_dau hỏng → UPDATE vẫn thành công, cột bóng NULL + WARNING; users ho_ten_bd đúng; 2 trigger + 8 chỉ mục.
- schema.prisma: 7 field Petition + hoTenBd User; prisma validate + generate + tsc sạch. Spec tim-kiem 60 ca.
- T12: `sinhCauNapCotBong`/`sinhCauNapHoTen` (cùng biểu thức trigger, chỉ SET cột bóng) + CLI `cli/nap-cot-bong-tim-kiem.ts` theo CON TRỎ id (bản đầu "lấy N dòng lệch đầu tiên" chạy thật ~15 s/lô, tổng bình phương → đổi) + `chayGenTimKiem` tách để kiểm trên thư mục tạm. Tìm kiếm 78 ca, phủ 97,2%/92,2%. Nạp thật pc02_spike: 23.169 dòng / 301 s (gồm 2 lần đếm toàn bảng), chạy lại ra 0 → prod ~47k ≈ 10 phút, chạy nền sau deploy.
- T3 helper `common/tim-kiem/dieu-kien.ts`: docThe (khoá lạ/sai dạng/>20 thẻ/>200 ký tự/giá trị chọn lạ/ngày sai → 400), docKhoangNgay (+07:00, ngày/tháng/năm), dungDieuKienTimKiem (chữ: cột bóng + lùi cột gốc khi NULL, 1–2 ký tự khớp đầu từ, thoát LIKE; `*` tim_kiem_bd; mã biến thể; mã cũ; ngày khoảng; chọn in; người qua quan hệ; chỉ AND), noiVaoWhere. Tìm kiếm 124 ca.
- T3 nối dây Đơn thư: DTO `tk?: string[]` (@Transform đơn→mảng, ≤20, ≤250); `dieuKienTimKiemDonThu` quy tk + search→`*` + senderName→nguoiGui + unit→donViGiaiQuyet về thẻ; getList + getStats cùng helper, gỡ where.OR chép tay + lọc thẳng senderName/unit; khai trangThai `giaTriHopLe` = PetitionStatus. Spec Đơn thư + thống kê + tìm kiếm 261 ca, tsc sạch, lint dòng mới 0. listDeleted / listLinkable / duplicateSearch cũng qua thẻ `*` (listLinkable chuyển phạm vi từ OR vào AND trước khi nối; hai ô nhận chữ đang gõ cắt 200 ký tự); suspectSearch GIỮ (tra senderIdNumber, không phải cột danh sách). Cổng `o-form-va-cot-danh-sach-phai-trung-cot` sửa đúng đường mới cho Đơn thư (thân hàm gọi helper + helper quy unit→donViGiaiQuyet + khai trỏ cột donViGiaiQuyet), Vụ án giữ nguyên. Backend 333 bộ / 5.020 ca, tsc sạch. Tiếp: T7 scope Đối tượng/Luật sư (PR3), rồi giao diện T5/T6 + lát Tổng hợp T8.
- T5/T6 giao diện Đơn thư (15/09): `shared/tim-kiem/the.ts` (đọc/ghi thẻ URL `<prefix>_tk=khoá~giá trị`, tham số cũ → thẻ, giới hạn khớp DTO, ngày cùng 4 dạng máy chủ) + `useTheTimKiem` (thẻ đọc NGAY lần vẽ đầu, viết lại URL cũ không đổi trang, mọi thay đổi về trang 1 + đẩy lịch sử) + `OTimKiemThe` (combobox/listbox, ↑↓ Enter Esc Backspace, Enter bỏ qua khi IME ghép chữ, cột ngày khoá dòng khi chữ không phải ngày, cột chọn gõ không dấu gửi MÃ, thẻ đỏ khoá lạ, "Gõ từ 3 ký tự", phím /) + `DanhSachThe` dùng chung cho trạng thái "Không tìm thấy với" + `ColumnDef.timKiem` + `truongGoiY` (gợi ý = cột đang hiện) + Toolbar `searchSlot`. Registry Đơn thư GỠ ô chữ sender/unit/stt/sttCu (thành thẻ; đường dẫn cũ vẫn mở). Cờ `TIM_KIEM_THE` công tắc khẩn (`useFeatureBatMacDinh`: bật trừ khi quản trị tắt; manifest máy chủ + seed). `lib/bo-dau.ts` thay 2 bản chép trong FKSelect/FKSelection.
- Bắt được khi làm: (1) axios gửi mảng `tk[]=` → Express 5 query "simple" + forbidNonWhitelisted = 400 cả danh sách → `paramsSerializer.indexes=null` toàn cục + ca kiểm getUri. (2) "Xóa lọc" ở Đơn thư/Vụ việc/Vụ án/Tổng hợp KHÔNG xoá ô tìm/trạng thái: `clearAll()` rồi `reset()` — React Router 7 tính `prev` lúc vẽ nên lần ghi sau dựng lại tham số cũ → đổi thứ tự 4 màn + Tổng hợp thống nhất tiền tố `comp` (T8 phần vá prefix) + cổng `xoaLocGhiUrlCuoi.gate.test.ts` có gieo lỗi. Cổng `timKiemDonThu.gate.test.ts`: mọi trường khai có cột mang nó.
- Frontend 247 tệp / 2.940 ca xanh, tsc -b sạch, lint dòng mới 0 (lỗi còn lại có từ trước: FeatureFlagsContext 2 export, FKSelect `_resource`).
- Còn trong PR1: T8 lát Tổng hợp (gửi thẻ tới 3 API — chờ máy chủ Vụ việc/Vụ án nhận `tk`, nên phần gửi thẻ dời sang M3; phần vá prefix XONG), T9 hotfix SQL, T10 GlobalSearchBar isComposing, T11 shell-parity (XONG — matrix cập nhật), chuyển probe vàng vào repo, T7 scope (PR3). Rồi /review + /codex → PR → CI → merge → deploy → nạp cột bóng prod.

## Hàng đợi task kế tiếp (M1)
1. M1-T1 khoá gộp + nhóm hạn theo tên (util thuần)
2. M1-T2 máy chủ: LOAI_TAO_NHANH_DUOC + taoNhanh chặn trùng theo khoá gộp, metadata nhomHan/choDuyet
3. M1-T3 máy chủ: petitionType tuỳ chọn, suy nhóm hạn từ danh mục trước khối tính hạn; field-catalog `loaiDon` ưu tiên loaiThongTin
4. M1-T4 bộ nạp hệ cũ chuẩn hoá loaiThongTin + gán petitionType
5. M1-T5 giao diện: gỡ ô Loại đơn thư, ô Loại thông tin thành FKSelect LOAI_THONG_TIN + tạo nhanh
6. M1-T6 CLI nap-loai-thong-tin (chạy thử mặc định, CSV bảng gộp) + chạy trên bản sao pc02_that
7. M1-T7 PR → CI → merge → deploy; chạy CLI trên prod: sao lưu → chạy thử → **DỪNG xin xác nhận trước --that (ghi đè dữ liệu prod, §8c)**

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 14/09 | Gộp Loại đơn thư vào Loại thông tin; giữ cột petitionType làm nhóm hạn | petitionType quyết định hạn tự tính (petitions.service.ts:476) | Excel/số văn bản/đồng bộ vụ án đọc tiếp không vỡ |
| 14/09 | Tìm kiếm: cột bóng `_bd` trên bảng + bộ sinh từ một tệp khai, không EAV/jsonb | Prisma string_contains jsonb không dùng chỉ mục; EAV khuếch đại ghi | Thêm cột tìm được = sửa tệp khai + chạy bộ sinh |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Giao thức §4 "tiếng Anh toàn bộ" vs "convention repo thắng" | Theo repo: định danh/chú thích tiếng Việt như code lân cận; chữ hiển thị qua hằng số/i18n | §4 dòng cuối; CLAUDE.md toàn cục (Lumina mới bắt tiếng Anh) |
| Giá trị ghép "Tố giác, Đề nghị" | Giữ một mục riêng | Spec M1 §3.1 |
| Mục tạo nhanh chưa phân nhóm hạn | nhomHan = PHAN_ANH, choDuyet = true | Spec M1 §3.3 |

## Trạng thái test
Full suite: PASS (backend 319 bộ/4.754 ca, frontend 236 tệp/2.862 ca — lần chạy 14/09 trước PR #374) | Patch coverage: — | Test fail: không

## Nợ kỹ thuật / rủi ro
- Workflow "Mutation — expert modules" đỏ 3 tuần từ 30/08 (không chặn merge) — chưa điều tra.
- Tài khoản ADMIN tạm thời (duy.tranhoang.doi2, thanh.phamtruong.doi2, minh.nguyenhoang.doi2) chờ anh bảo hạ quyền.
- Comprehensive: prefix `comprehensive`≠`comp`, lọc nâng cao không gửi API (sửa ở M2/M4).
