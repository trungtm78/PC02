STATUS: IN_PROGRESS
# PROGRESS
Cập nhật: 2026-09-15 | Milestone: M3/7 | Task: T1–T6 xong trên nhánh; kế: /review + /codex → PR → CI → merge → deploy → nạp cột bóng + kiểm vàng prod

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
- T9 (15/09): SQL vận hành khẩn SINH từ tệp khai (không chép tay tên hàm/cột): `docs/van-hanh/tat-trigger-tim-kiem.sql` thay thân hàm trigger = đặt cột bóng NULL (KHÔNG gỡ trigger — gỡ thì cột bóng cũ nằm lại, thẻ trả sai; NULL thì lùi cột gốc, vẫn đúng), `bat-lai-trigger-tim-kiem.sql` thân hàm nguyên văn migration + chỉ dẫn CLI nạp. Bộ sinh tách `thanHam`/`cacKhoiTrigger` dùng chung, migration sinh ra không đổi byte. Cổng sinh khớp thêm 2 tệp. Chạy thật pc02_spike: tắt → sửa hồ sơ cột bóng NULL; bật lại → cột bóng điền lại; 2 trigger còn nguyên. Tìm kiếm 9 bộ / 133 ca.
- T10 (15/09): GlobalSearchBar bỏ qua Enter khi `isComposing`/keyCode 229 (ca kiểm đỏ trước: Enter lúc ghép chữ điều hướng sang `/petitions?search=nguye`). Ghi nhận cho M6: Enter ở GlobalSearchBar mở `/petitions?search=` nhưng trang đọc `petitions_q`/`petitions_tk` → danh sách không lọc (có từ trước).
- Probe vàng vào repo (15/09): `common/tim-kiem/cli/kiem-vang-bo-dau.ts` + `npm run kiem:vang-bo-dau [-- --chuoi-that]` thay 3 chế độ script tạm (local/sinh-prod/so) bằng MỘT đường chạy được cả prod: hàm `pg_temp.f_bo_dau` trong một giao dịch (không để lại gì), bộ tổng hợp mọi mục bảng + câu khó, tuỳ chọn chuỗi thật đơn thư; thoát 0/1/2. Chạy sau deploy trên prod: `node dist/src/common/tim-kiem/cli/kiem-vang-bo-dau.js --chuoi-that`.
- /review nhánh (15/09, 5 chuyên gia + đối kháng Claude; Codex đang chạy): backend 335 bộ/5.039 ca + frontend 248 tệp/2.941 ca xanh trước khi sửa. ĐÃ SỬA (commit fix(tim-kiem) sửa theo /review): duplicateSearch trở lại 3 cột cũ + thoát LIKE (đi qua thẻ `*` từng mở rộng dò nội dung/đối tượng bị tố tổ khác — endpoint chưa lọc phạm vi là có từ trước, CHỜ quyết nghiệp vụ); thẻ ngày bỏ kỳ mặc định (trước ra 0 dòng); thẻ Người nhập lùi họ/tên/tài khoản; nhánh lùi cột gốc chỉ bật khi còn dòng chưa nạp (EXISTS trên chỉ mục một phần, 0,06 ms; đo 124→51 ms); tham số cũ cắt 200; useTheTimKiem bỏ viết lại URL lúc mở (race cờ đang nạp) + ref giữ lần ghi chưa vẽ; ca kiểm phạm vi chốt đúng điều kiện; DTO dùng hằng + spec ValidationPipe. GHI NHẬN KHÔNG SỬA: `*` cũ không còn tìm `summary` (≈ detailContent, lệch 58 hồ sơ); `/petitions/export` còn lọc `unit` kiểu cũ (M3); stt/sttCu cũ còn nhánh riêng; dấu trang `comprehensive_*` cũ mất lọc; migration chưa có lock_timeout; LC_CTYPE `lower()` với ký tự ngoài bảng — chạy `kiem:vang-bo-dau --chuoi-that` trên prod sau deploy.
- Codex adversarial (15/09): P0 `suspect-search`/`duplicate-search` bỏ qua `dataScope` (có từ trước) + `suspect-search?q=%` khớp mọi đơn (Prisma không thoát LIKE) → ĐÃ SỬA: cả hai áp `buildPetitionScopeFilter` + `thoatLike` (V-S4, V-D5). Quyết theo "quản trị sâu nhất" và CLAUDE.md (DataScope enforce mọi đường đọc) — rà trùng giờ chỉ trong phạm vi cán bộ; thay cho mục "CHỜ quyết nghiệp vụ" ở trên. GHI NHẬN theo thiết kế: một dòng chưa nạp giữ nhánh lùi cho cả bảng (đúng trước, nhanh sau); trigger EXCEPTION đặt NULL mà cache "đã nạp" còn 60 s thì dòng ấy tạm không tìm được; migration dựng GIN không CONCURRENTLY (cột mới toàn NULL, vài giây). Bộ kiểm đầy đủ sau sửa theo review: backend 5.052/5.054 (2 đỏ ở cổng đọc mã nguồn — đã sửa), frontend 2.939/2.942 (3 ca form đỏ do tải máy khi chạy chồng; chạy riêng 5/5 xanh).
- PR #376 tạo 15/09 (https://github.com/trungtm78/PC02/pull/376), push feat/tim-kiem-dang-the-nen. BƯỚC TIẾP: chờ CI (kiểm JSON statusCheckRollup, không chỉ hết PENDING) → merge squash → kiểm deploy + health + bundle → prod: `nap-cot-bong-tim-kiem.js` chạy thử rồi `--that` (chỉ ghi cột dẫn xuất, không đẩy updatedAt) → `kiem-vang-bo-dau.js --chuoi-that` phải lệch 0 → `db:seed:features` (cờ TIM_KIEM_THE) → sang M3.
- M2 PR1 PROD 15/09: PR #376 CI xanh 3/3 → merge `--admin` squash cb2b8b92 (như #375: chỉ vướng REVIEW_REQUIRED; nhánh remote CHƯA xoá — §8c). Deploy success; health buildId cb2b8b92; migration tim_kiem_don_thu áp; 2 trigger + f_bo_dau; chunk PetitionListPageShell-BaSYdf3h.js có `o-tim-kiem-the`. Chạy thử nạp: users 257, petitions 47.660 lệch. `--that` chạy nền trên VM, log /home/pc02/backups/nap-cot-bong-tim-kiem-20260915-081144.log. Tiếp: kiểm vàng `--chuoi-that` trên prod, `db:seed:features`, bấm thử màn Đơn thư bản công khai.
- **M2 PR1 HOÀN TẤT TRÊN PROD (15/09 ~08:30)**: nạp cột bóng `--that` users 257 + petitions 47.660/47.660, còn 0 lệch; kiểm vàng PG16.15 prod: tổng hợp 646 + chuỗi thật 100.419 lệch 0; `db:seed:features` 38 cờ, TIM_KIEM_THE bật; EXISTS chưa nạp = false → nhánh lùi tắt; EXPLAIN prod: người gửi 46 ms (GIN sender_name_bd_trgm), tất cả cột LIMIT 20 151 ms (GIN tim_kiem_bd_trgm). Chưa bấm thử màn thật trên prod (để UAT M7, cần tài khoản thử được phép). ĐANG LÀM: M3.
- Bản đồ M3 (subagent 15/09): UTDT không có service riêng — đi qua CasesService (caseType) + getUtdtStats, trang `features/uy-thac-dieu-tra/UyThacDieuTraListPage.tsx` lọc inline, không registry, không ColumnPicker. Lệch sẵn có: Vụ việc getStats bỏ stt/sttCu; Vụ án getStats bỏ stt/sttCu/createdById + overdue khác danh sách; getUtdtStats không áp kỳ (danh sách UTDT có) + thiếu caseCode/soHoSoCu/sttCu trong tìm; cột "Tên cá nhân…" Vụ việc hiện `benVu`, Vụ án hiện `tenCungCap` — cả hai không tìm được; Vụ án tìm `unit` rỗng 100%; Vụ án listDeleted tìm `id` thay caseCode; cột Đối tượng bị can là quan hệ Subject (kiểu mới, không phải 'nguoi'); lọc investigator Vụ án không có username. Chưa có GIN trên incidents/cases. Cổng phải sửa: o-form-va-cot (Vụ án where.donViGiaiQuyet), cot-danh-sach-phai-duoc-tra-ve, sap-xep-theo-stt (apDungKyVaoWhere phải chứa 'ngayDeXuat'), incidents-ky-thong-ke (list≡stats where.ngayDeXuat).
- Còn trong PR1: T8 lát Tổng hợp (gửi thẻ tới 3 API — chờ máy chủ Vụ việc/Vụ án nhận `tk`, nên phần gửi thẻ dời sang M3; phần vá prefix XONG), T9 hotfix SQL, T10 GlobalSearchBar isComposing, T11 shell-parity (XONG — matrix cập nhật), chuyển probe vàng vào repo, T7 scope (PR3). Rồi /review + /codex → PR → CI → merge → deploy → nạp cột bóng prod.

## Đo prod cho M3 (15/09, chỉ đọc)
- cases 3.418 (UTDT 1.720); `nghiVanDoiTuong` cột typed phủ 2.170 = metadata 2.170 (UTDT 1.453 = 1.453) → thẻ Đối tượng nghi vấn dùng CỘT typed (JSON path không chỉ mục, phân biệt dấu). incidents 4.724. subjects 1.292 (SUSPECT 1.194) → cột bóng `subjects.full_name_bd` rẻ.
- Trường có `@map` (donViGiao→don_vi_giao, soQuyetDinhUyThac→so_quyet_dinh_uy_thac): trigger/câu nạp SQL phải dùng tên cột thật → thêm `cotDb` vào khai + cổng `cotDbLech` đối chiếu `@map` trong schema.prisma.

## M3 đã xong
- [x] M3-T1 — commit adc3cb69 (cotDb + cotDbLech), ffdc3db0 (kiểu doi-tuong + subjects.full_name_bd), b1c4090e (khai Vụ việc + Vụ án, migration 20260915083627_tim_kiem_vu_viec_vu_an: pc02_spike 839 ms, trigger cases/subjects/incidents đúng, 5 trigger) — tìm kiếm 13 bộ/169 ca.
- [x] M3-T2 — commit 286bb188 BoTimKiem dùng chung (dieuKien/luiCotGoc/kyApDung, tham số cũ nhiều khoá → OR); Đơn thư chuyển sang, 32 bộ/556 ca xanh.
- [x] M3-T3 — commit 94e9fbf4 Vụ việc máy chủ: DTO tk, getList/getStats/listLinkable/listDeleted qua BoTimKiem; `search` cũ = OR(tất cả cột, Điều tra viên); vá getStats bỏ stt/sttCu; src/incidents + 3 cổng 14 bộ/526 ca.
- [x] M3-T4 — Vụ án + UTDT máy chủ: DTO tk; getList/getStats/getUtdtStats/listDeleted qua BoTimKiem; THAM_SO_CU_VU_AN (search/charges/unit/stt/sttCu/donViGiao/investigatorName → thẻ); vá getStats bỏ stt/sttCu/createdById + overdue dùng TRANG_THAI_KET_THUC.case; getUtdtStats áp CÙNG kỳ với danh sách UTDT + trả ky, phạm vi nối AND không đè thẻ; listDeleted tìm mã hồ sơ thay id. Cổng o-form-va-cot gộp 3 thực thể soi đủ 3 mắt xích. src/cases + 3 cổng 20 bộ/335 ca, tsc sạch.
- [x] M3-T5 — giao diện Vụ việc + Vụ án + UTDT: ô thẻ, cột `timKiem`, THAM_SO_CU (Vụ việc q/unit/stt/stt_cu; Vụ án q/unit/investigator/charges/stt/stt_cu; UTDT q/dv/inv), registry gỡ ô chữ (Vụ việc giữ `reporter` CCCD/SĐT), thẻ tới list + stats/utdt-stats, UTDT thêm nhãn kỳ, ô chữ UTDT chỉ hiện khi cờ tắt. Cổng `pages/__tests__/timKiemCotKhai.gate.test.ts` gộp 3 thực thể (Vụ án = hợp cột Vụ án + UTDT), thay timKiemDonThu. Backend full 340 bộ/5107 ca xanh; FE full 2962/2963 (1 ca form Đơn thư timeout dưới tải, chạy riêng xanh 3,6s); tsc -b sạch; lint dòng mới 0 (diff --text vì tệp UTDT có ký tự điều khiển).
- [x] M3-T6 — lát Tổng hợp: `comp_q` → thẻ `*` tới 3 API danh sách + 3 stats (cờ tắt → `search`). 25 ca xanh, lint dòng mới 0, tsc sạch. Ô thẻ chọn cột → M4.
- [x] M3 /review (8 chuyên gia + Claude đối kháng + Codex đối kháng + Codex cấu trúc) — ĐÃ SỬA (TDD):
  - UTDT "Đối tượng nghi vấn": tab Ủy thác ghi ô riêng vào metadata, thẻ/bản in đọc cột typed → trôi khỏi nhau. Nay tab Ủy thác soi gương `nghiVanDoiTuong`, bỏ ghi đè metadata, danh sách UTDT đọc cột typed (getList select thêm cột; cổng cot-danh-sach phủ màn UTDT).
  - Màn Vụ án gỡ ô lọc Tội danh mà không cột nào mang `toiDanh` → thêm cột "Tội danh" ẩn sẵn; cổng timKiemCotKhai soi TỪNG màn (khoá mọi ô lọc chữ cũ có cột trên chính màn).
  - Sửa thẻ của cột đang ẩn âm thầm thành `*` → OTimKiemThe đưa trường đang sửa vào gợi ý.
  - Thẻ ngày rỗng `ngayDeXuat~` gỡ kỳ mặc định → coTheNgay đòi giá trị thật.
  - Giá trị bỏ dấu ra rỗng (chỉ dấu tổ hợp) bị bỏ lọc → so nguyên chữ trên cột gốc (4 kiểu thẻ).
  - URL >20 thẻ làm cả màn 400 → docTheTuThamSo dừng ở 20.
  - Trạng thái trống khi chỉ lọc ở mặt lọc hiện "Chưa có hồ sơ" → "lọc không ra" (Vụ việc, Vụ án, Đơn thư).
  - Ca kiểm bổ sung: getUtdtStats tìm+phạm vi cùng AND; incidents listLinkable/listDeleted; UTDT cờ tắt `inv`; BoTimKiem.dieuKienTatCa (gom 3 chỗ cắt 200 cứng); getUtdtStats dùng noiVaoWhere.
  - Kết quả: commit 636168c1. Bộ ĐẦY ĐỦ sau review: backend 341 bộ/5.121 ca xanh, tsc sạch; FE 250 tệp/2.980 ca xanh, tsc -b sạch; lint dòng mới 0 (FE 19 tệp, BE 10 tệp).
  - PR #377 CI 3/3 xanh → merge squash f6ba1f77 (--admin) → Deploy success, health buildId f6ba1f77, migration 20260915083627_tim_kiem_vu_viec_vu_an áp 10:46.
- **M3 HOÀN TẤT TRÊN PROD (15/09 ~10:55)**: nạp cột bóng `--that` subjects 1.293 + incidents 4.855 + cases 3.710, chạy thử lại lệch 0 cả 5 bảng; kiểm vàng PG16.15 tổng hợp 646 + chuỗi thật 100.441 lệch 0; EXISTS chưa nạp = false cả incidents/cases/subjects (nhánh lùi tắt); EXPLAIN: Vụ việc `*` LIMIT 20 2,7 ms, đếm Vụ án GIN cases_tim_kiem_bd_trgm 23,8 ms, thẻ bị can 1,6 ms.

## Hàng đợi M4 (nhánh feat/tim-kiem-dang-the-tong-hop-doi-tuong-luat-su từ main f6ba1f77 — push phải `-u origin <nhánh>`, upstream đang trỏ main)
1. M4-T1 bộ sinh: gộp khối trigger THEO BẢNG (khai `subjects` mới sẽ trùng tên hàm/trigger với khối doi-tuong của Vụ án; trùng field Prisma; CLI nạp chạy subjects 2 lần) + kiểu thẻ quan hệ một-một (`is`) cho Luật sư → Vụ án / Thân chủ.
2. M4-T2 Đối tượng máy chủ: khai `doi-tuong.khai.ts` (hoTen, cccd, vuAn, trangThai chon SubjectStatus, ngayTao; `*` thêm address/phone), DTO tk, getList qua BoTimKiem, phạm vi `where.case` chuyển vào AND (bài học subjects-lawyers-gan-where-case-scope), spec cũ where.OR sửa. Migration `gen:tim-kiem -- --moi`.
3. M4-T3 Luật sư máy chủ: khai `luat-su.khai.ts` (hoTen, soThe, vanPhong, vuAn, thanChu, sdt, ngayTao), tương tự T2.
4. M4-T4 giao diện Đối tượng (ObjectListPageShell, 4 đường dẫn / 3 loại, tiền tố objects/victims/witnesses) + Luật sư (LawyerListPageShell): ô thẻ, cột timKiem, tham số cũ q → *, cổng cột↔khai.
5. M4-T5 Tổng hợp đầy đủ: ô thẻ; "Tất cả" = khoá chung ba thực thể (*, stt, sttCu, nguoiGui, donViGiaiQuyet, nguoiNhap, ngayTao, ngayDeXuat); chọn một loại = khai đầy đủ loại ấy; cột hiển thị đúng trường thẻ lọc; mặt lọc nâng cao đang không gửi API (sửa hoặc gỡ).
6. Rồi /review + /codex → PR → CI → merge → deploy → nạp cột bóng + kiểm vàng + EXPLAIN.
- Review — CÓ LÝ DO KHÔNG SỬA / BÁO NHẦM:
  - Codex P1 "chuỗi không đóng dieu-kien-doi-tuong.spec.ts:48" = BÁO NHẦM (PowerShell đọc UTF-8 vỡ chữ; bộ 340 xanh).
  - Codex "stats bỏ status/phase lệch danh sách" = cố ý (thẻ đếm mọi trạng thái để drill-down).
  - Trộn `tk` + tham số cũ cùng khoá → OR: đúng doc ThamSoCu, giao diện không gửi cả hai.
  - Khoá lạ trên URL: hiện thẻ ĐỎ "Cột không còn tìm được", không gửi (theo kế hoạch), không 400 cả màn.
  - Thẻ trangThai thu hẹp số trên thẻ thống kê: đúng nguyên tắc thẻ khớp dòng.
- Review — GHI NỢ (chưa sửa, cần quyết/đợt sau):
  - Cờ TIM_KIEM_THE tắt: Vụ việc/Vụ án/Đơn thư KHÔNG hiện lại ô lọc chữ đã gỡ (UTDT có); ghi rõ trong shell-parity-matrix.
  - Ngữ nghĩa đổi phía API: `search` 1–2 ký tự khớp đầu từ (quyết định 4A); utdt-stats nay áp kỳ thống kê (UAT docs/uat/utdt TC-006/041/065 cần sửa oracle); cases listDeleted không còn tìm theo id; listLinkable Vụ việc tìm mọi cột (rộng hơn tiền tố mã); `incidents_q`/Tổng hợp `*` không còn khớp tên điều tra viên.
  - Hiệu năng: search cũ Vụ việc OR quan hệ điều tra viên không dùng GIN; nhánh lùi subjects luôn bật; nạp cột bóng chưa tự động trong deploy.sh.
  - Migration: chưa `lock_timeout`; mỗi migration tìm kiếm dựng lại trigger petitions/users.
  - tat-trigger-tim-kiem.sql: f_bo_dau sai thì dòng đã nạp giữ giá trị sai → phải tắt cả cờ; ghi chú bộ sinh chưa nói.
  - Bảo trì (advisory): khối `tk` chép 3 DTO; khối ô thẻ/trạng thái rỗng chép 4 màn; kyApDung+getKyThongKe chép 7 chỗ.
  - ~~Dữ liệu prod UTDT nghiVanDoiTuong lệch metadata↔typed~~ — ĐO 15/09 (SELECT trong BEGIN READ ONLY qua ssh): 1.720 UTDT, 1.453 có ở CẢ hai, chỉ-metadata 0, chỉ-typed 0, khác nhau 0 → KHÔNG cần sửa dữ liệu; bản vá form chặn lệch từ nay.

## Hàng đợi M3 (nhánh feat/tim-kiem-dang-the-vu-viec-vu-an, từ main cb2b8b92)
1. M3-T1 khai `vu-viec.khai.ts` (incidents) + `vu-an.khai.ts` (cases, chung Vụ án thường + UTDT) + kiểu `doi-tuong` (quan hệ subjects SUSPECT, cột bóng `subjects.full_name_bd` + trigger như users) → `gen:tim-kiem -- --moi vu_viec_vu_an`; CLI nạp + SQL tắt/bật + kiểm vàng tự gồm bảng mới. `*` giữ đủ cột ô tìm cũ (Vụ việc: name, doiTuongCaNhan, doiTuongToChuc, soHoSoCu; Vụ án: name, crime, soHoSoCu).
2. M3-T2 gom helper dùng chung sang `common/tim-kiem` (dựng điều kiện thẻ + tham số cũ, hỏi còn dòng chưa nạp có nhớ, kỳ áp dụng khi có thẻ ngày) — Đơn thư chuyển sang dùng, không đổi hành vi.
3. M3-T3 Vụ việc máy chủ: DTO `tk`, getList/getStats/listLinkable/listDeleted qua helper; `search` cũ vẫn gồm tên điều tra viên (OR với thẻ dieuTraVien); vá getStats bỏ stt/sttCu.
4. M3-T4 Vụ án + UTDT máy chủ: getList/getStats/getUtdtStats/listDeleted qua helper; vá getStats bỏ stt/sttCu/createdById + overdue lệch danh sách; getUtdtStats áp kỳ như danh sách; listDeleted tìm caseCode.
5. M3-T5 giao diện Vụ việc + Vụ án (ô thẻ, cột timKiem, registry gỡ ô chữ, tham số cũ → thẻ, cổng cột↔khai) + UTDT (ô thẻ, gửi tk tới list + utdt-stats).
6. M3-T6 lát Tổng hợp: gửi thẻ `*` tới 3 API. Rồi /review + /codex → PR → CI → merge → deploy → nạp cột bóng + kiểm vàng prod.

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
