# Danh sách hồ sơ dễ đọc + tự cập nhật + bù dữ liệu hệ cũ thiếu (18/09/2026)

> Kế hoạch trước (`%like%`, PR #392–#407) đã XONG, prod `c3784b6d`.
> Anh giao (18/09): mọi quyết định còn lại em tự chọn theo tiêu chí quản trị sâu nhất và mở rộng tốt nhất. Không giảm phạm vi, được tăng phạm vi, được đổi thứ tự.

## Context
Anh gửi ảnh chụp và nêu 6 việc:
1. Thông báo "Đang dùng bản cũ" che màn hình và bắt người dùng tự bấm cập nhật → muốn TỰ cập nhật, bỏ mọi hộp nhắc.
2. Ô Tóm tắt nội dung: hiện 5 dòng; "Xem thêm" mở rộng TẠI CHỖ, không nhảy sang màn xem.
3. Các cột khác xuống dòng cho thấy đủ nội dung.
4. Thêm thanh cuộn ngang ở TRÊN bảng.
5. Bộ lọc: bấm "Áp dụng" không lọc được; thêm nút Xuất Excel theo kết quả đang lọc.
6. Dữ liệu cũ thiếu: "Lê Nguyễn Yến Thanh" và "Kha Tử Thạnh" hệ cũ có, hệ mới tìm không ra.

Anh đã chốt:
- Phạm vi giao diện: cả **Đơn thư, Vụ việc, Vụ án** (dùng chung bộ bảng), cộng màn Đơn thư phường.
- Hồ sơ lệch loại: **tạo đơn thư gắn kèm** (chỉ thêm bản ghi; chạy thử → sao lưu → xin xác nhận rồi mới ghi thật).
- Hồ sơ mới hệ cũ bị trùng số: **cấp số mới theo bộ đếm hệ mới, giữ số hệ cũ ở ô STT cũ**.
- Tự tải lại khi quay lại tab: **chỉ khi trang thật sự rảnh** (1A).
- Phần xuất: **một bộ xuất dùng chung** (D1).

## Số đo và nguyên nhân gốc (đã đo, chỉ đọc)

**(1) Thông báo bản cũ**
- `useTuChuaBanCu.ts` hỏi `/health` mỗi 10 phút và khi quay lại tab; thấy `buildId` khác thì hiện `BanCuPrompt`.
- Tự tải lại từng bị gỡ vì dự án KHÔNG có cơ chế giữ form đang nhập: không `beforeunload`, không `useBlocker`, không dirty-check (`App.tsx` dùng `<BrowserRouter>`).
- Còn hộp xanh `PwaUpdatePrompt` (service worker `registerType: 'prompt'`).
- Cờ chống lặp theo phiên → cập nhật một lần rồi thì cả phiên không cập nhật nữa.
- Lỗi tải chunk (`RouteBoundary.tsx`) chỉ hiện nút bấm tay.

**(2) "Xem thêm"**
- `SummaryCell.tsx` cắt theo 150 ký tự.
- Nút thiếu `e.stopPropagation()` → cú bấm lan lên `<tr onClick>` (`Table.tsx:469`) → mở màn xem. Lỗi có ở cả 3 màn.
- Ca kiểm cũ dựng ô không nằm trong dòng nên không bắt được lỗi này.

**(3) Cột bị cắt** — `TABLE_CELL` và `TABLE_CELL_TRUNCATE` (`constants/styles.ts:134,139`) là `nowrap … truncate`.
- Codex chỉ ra: chính `nowrap` đang đẩy bảng tràn ngang (`styles.ts:121`).
- `Table.tsx:381` chỉ đặt tổng bề rộng khi người dùng kéo giãn cột.

**(4) Cuộn ngang** — chỉ có `overflow-x-auto`, chưa có thanh cuộn trên.

**(5) Bộ lọc** — đường Áp dụng → URL → `GET /petitions` → `getList` đúng tham số. Các lỗi lộ ra ngoài:
- **Nhãn kỳ sai:** nhãn "Thống kê: …" luôn là kỳ MẶC ĐỊNH (`PetitionListPageShell.tsx:814`). Đơn thư phường đã vá bằng `nhanKyApDung`; Vụ việc và Vụ án cũng dính.
- **Thẻ số bỏ lọc cán bộ:** `getStats` Đơn thư bỏ qua `enteredById` (`petitions.service.ts:2179`). Gốc: stats tự dựng `where` riêng, không dùng chung với list.
- **Hai kiểu xuất lệch nhau:** thanh chọn hàng loạt quảng cáo "xuất tất cả theo bộ lọc" (`bulk/adapters/petitions.ts:15,21`) nhưng màn không truyền `fetchAllIdsMatchingFilter` (`PetitionListPageShell.tsx:401`), còn DTO chỉ nhận ID, tối đa 1.000.
- **`GET /petitions/export` sai lệch:** không nhận `enteredById`/`thongKeTruongNgay`, lọc sai cột ngày, cắt 500 dòng.
- **Chưa tái hiện trên Chrome:** còn nghi ô thẻ ghi đè URL lọc, và nghi trường hợp chỉ nhập "Đến ngày" thì đầu kỳ vẫn là ngày mặc định.

**(6) Dữ liệu thiếu — hai nguyên nhân khác nhau**
- **26-11129 Lê Nguyễn Yến Thanh:** có trên hệ mới nhưng là **Vụ án** (`ho_so_doi_1:86938`).
  - Hệ cũ xếp danh sách theo `loai=don_thu`; `normalizePhanLoai` (`legacy-mapper.ts:222`) ưu tiên `phan_loai_nguon_tin_ban_dau`.
  - Cùng dạng lệch: **61 vụ án + 25 vụ việc** `loai=don_thu` chưa có đơn.
  - Codex: bước commit chỉ nối `Case.linkedPetition`, KHÔNG ghi ngược `Petition.linkedCaseId/linkedIncidentId` (`legacy-migration.service.ts:245,303,346`).
- **26-11732 Kha Tử Thạnh:** vụ việc `id` 87541, chưa nạp. Lần cập nhật cuối 13/09 23:44.
  - Mongo (chỉ đọc): **14 mới** (13 đơn thư, 1 vụ việc; STT 11729–11742) + **12 đã sửa**.
  - Bộ đếm hệ mới **tách theo loại**: PETITION 11913, INCIDENT 11495, CASE 11721.
  - 185 đơn thư hệ mới mang 2026-11729…11913 → 13 đơn thư hệ cũ trùng số.
  - Codex: `buMaHoSo` hiện xử lý trùng bằng hậu tố `-2`, `-3` (`backfill-ma-ho-so.ts:45`) và không ghi `sttCu`.

## Thứ tự (đổi so với bản đầu)
**A → E → D → C → B → F**. F (font toàn app + mật độ dòng) thêm từ /design-consultation.
- A trước: mọi bản sửa sau đó tới tay cán bộ mà không cần ai bấm "Cập nhật".
- E, D kế: dữ liệu thiếu là sai nghiệp vụ, và hệ cũ vẫn nhận hồ sơ mỗi ngày → càng để lâu càng trùng thêm.
- C, B cuối: sửa giao diện.

## Cách làm

### PR-A · Tự cập nhật, bỏ hộp nhắc (việc 1)
- Gỡ `BanCuPrompt` và `PwaUpdatePrompt` khỏi `MainLayout.tsx`.
- `useTuChuaBanCu` → `useTuCapNhat`. Thấy `buildId` mới thì đặt cờ "có bản mới", KHÔNG hiện gì. Cập nhật ở **thời điểm an toàn** (khuôn "version skew" chuẩn: nạp lại ở đường đích khi chuyển route, và bắt `vite:preloadError`):
  1. **Chuyển màn** (pathname đổi) → tải trang đầy đủ tới URL đích, sau `thoatBanCu` (gỡ SW, xoá cache).
  2. **Tab ẩn ≥ 5 phút rồi quay lại** → chỉ tải lại khi `trangDangRanh()`. Hàm này kiểm cả ba:
     - (a) không có `[role=dialog]` / `[aria-modal=true]` nào đang mở;
     - (b) **sổ đăng ký form dở dang** trống (đọc thêm ở mục dưới);
     - (c) không `input`/`textarea`/`[contenteditable]` nào khác `defaultValue`. Đây là lưới cuối cho các hộp tự dựng.
     Vướng một điều là hoãn tới lần chuyển màn kế tiếp.
  3. **Lỗi tải chunk** (`vite:preloadError` + `isChunkLoadError`) → tự tải lại một lần, có chốt.
- **Sổ đăng ký form dở dang** (codex P3, quyết định tăng phạm vi: khai tường minh thay vì đoán):
  - Hook `useDauHieuDangSua(dangSua: boolean)` ghi vào một store chung.
  - Nối cho PetitionForm (dùng `savedSnapshotRef` đang bỏ dở ở `PetitionFormPage/index.tsx:87`), CaseForm, IncidentForm, và hộp xoá chuẩn `DeleteResourceModalProvider`.
  - Cổng: mọi trang form có trong routes phải gọi hook này.
- Chốt chống lặp theo **`buildId` đích**, không theo phiên.
- Hỏi `/health` khi tab được focus và mỗi 5 phút.
- SW `registerType: 'autoUpdate'` (skipWaiting + clientsClaim). Chunk cũ bị xoá thì mục 3 lo.
- Ca kiểm: 3 thời điểm an toàn; hoãn khi có hộp thoại / form đăng ký dở / ô có chữ; chống lặp theo buildId; gỡ `PwaUpdatePrompt.test.tsx`; ca cổng sổ đăng ký.

### PR-E · Nạp 14 mới + 12 sửa của hệ cũ, không trùng số (việc 6b)
- **Luật số mới** (thay luật hậu tố `-2`; codex P1). Hồ sơ mới mà mã năm-stt hệ cũ đã có hồ sơ **cùng loại** ở hệ mới (1B: khớp `@unique` và bộ đếm tách loại) thì:
  - cấp số qua **chính dịch vụ bộ đếm** dùng khi tạo hồ sơ thường, cùng giao dịch;
  - ghi số hệ cũ vào `sttCu`;
  - nếu `stt_cu` hệ cũ đã có giá trị thì dừng và báo, không ghi đè.
- Hồ sơ lịch sử đang mang hậu tố `-2` giữ nguyên (không đổi mã đã in giấy); ghi rõ trong mã.
- Kết quả dự kiến:
  - Kha Tử Thạnh giữ `2026-11732` (bảng vụ việc chưa có số này);
  - 13 đơn thư nhận 2026-11914…, `sttCu` = số cũ.
- `napLaiBoDem` chạy sau cùng như cũ.
- Ca kiểm (jest, dữ liệu thật dạng bản thô):
  - trùng cùng loại → số từ bộ đếm, có `sttCu`;
  - trùng khác loại → giữ số;
  - `stt_cu` đã có → dừng;
  - chạy lại → 0/0;
  - bộ đếm không bị hạ.
- Prod: `pg_dump` → `--dry` (in 26 dòng) → **dừng xin anh xác nhận** → chạy thật. Đối chiếu:
  - còn thiếu = 0, không mã tạm, không STT trùng;
  - tìm "Kha Tử Thạnh" ra;
  - thẻ `STT cũ: 11732` ra đúng hồ sơ.

### PR-D · Hồ sơ lệch loại hiện ở danh sách Đơn thư (việc 6a)
- Bộ nạp: `loai=don_thu` mà phân loại ra Vụ án/Vụ việc → tạo THÊM Petition bằng chính `buildPetition(rec)` (áp kinh nghiệm cũ: ngày hệ cũ phải cộng lệch múi giờ).
  - STT = số hệ cũ.
  - `DA_CHUYEN_VU_AN` / `DA_CHUYEN_VU_VIEC`.
- **Nối HAI CHIỀU trong cùng giao dịch** (codex P1): `Petition.linkedCaseId`/`linkedIncidentId` và `Case.linkedPetition` (nguồn đơn) đều được ghi.
  - Ca kiểm đọc cả hai chiều.
  - Kiểm luôn 168 vụ án FROM_PETITION hiện có còn thiếu chiều ngược không: đo trước; thiếu thì cùng CLI bù (chỉ thêm liên kết).
- Bộ cập nhật về sau (1C): hệ cũ sửa một trong các hồ sơ này → cập nhật cả đơn lẫn vụ án/vụ việc theo `legacySourceId`, không đẻ đơn thứ hai. Ca kiểm: chạy hai lần trên 86938.
- CLI `bu-don-thu-lech-loai --dry | --that`:
  - Tìm 86 hồ sơ (61 + 25); in mẫu 10 dòng.
  - Kiểm STT không đụng `petitions.stt` đang có.
  - Bình ổn: chạy lại ra 0.
- Prod: `pg_dump` → `--dry` → **dừng xin anh xác nhận** → `--that` → tìm "Yến Thanh" ở Đơn thư ra 26-11129, bấm mở sang vụ án.

### PR-C · Bộ lọc lọc đúng + Xuất Excel theo kết quả lọc (việc 5)
1. **Tái hiện trên Chrome thật trước** (`/investigate`): Hôm nay / Tháng này / Cán bộ nhập / chỉ "Đến ngày" → Áp dụng.
   - Ghi URL, request, số dòng, số trên thẻ.
   - Viết ca kiểm ĐỎ cho đúng lỗi tái hiện được, rồi mới sửa.
2. **Một nguồn điều kiện lọc** (sửa gốc, không vá ngọn; codex P2 đã chỉnh):
   - Mỗi service có `dungWhereDanhSach(query, scope, { boTrangThai })`. `boTrangThai: true` dùng cho stats, để các chip vẫn đếm trên mọi trạng thái (`query-petitions-stats.dto.ts:4,15`).
   - `getList`, `getStats`, xuất đều gọi hàm này.
   - Ca cổng: `where(list) = where(stats) + điều kiện trạng thái`; `where(xuất) = where(list)`.
3. Nhãn kỳ ở cả 3 màn dùng `nhanKyApDung`. Nếu ô thẻ ghi đè URL thì hai hook ghi URL qua `setSearchParams` dạng hàm cập nhật.
4. **Một khái niệm "Xuất Excel"** (codex P2):
   - Nút "Xuất Excel" trong khung Bộ lọc: áp các thay đổi chưa áp rồi xuất đúng bộ tham số của bảng.
   - Thanh chọn hàng loạt: "đã chọn" → xuất theo ID như cũ; "tất cả theo bộ lọc" → cùng đường xuất theo bộ lọc. Không còn hai hành vi khác trần.
5. **Bộ xuất dùng chung** `common/xuat-danh-sach/`:
   - Nhận `{ where, orderBy, khaiCot, cot[], tieuDe, phuDe }`.
   - Đọc theo lô 1.000 bằng keyset `(ngayDeXuat, id)`; `count` đúng một lần.
   - Ghi luồng `ExcelJS.stream.xlsx.WorkbookWriter`.
   - 3 điểm cuối `GET /{petitions,incidents,cases}/export/danh-sach` và 3 `exportWard*` (giữ URL) đều đi qua đây. Có ca hồi quy so tệp ward trước/sau.
6. **Khai cột xuất ở máy chủ**, khoá trùng khoá cột bảng: `{ key, tieuDe, doc(row) }`.
   - `cot` lạ → 400.
   - Cổng: mọi cột hiện được trên 3 màn phải có khai xuất (gieo lỗi).
7. Trần 50.000 dòng → 400 kèm câu rõ.
8. Mỗi lần xuất ghi `audit_logs` (ai, bộ lọc, số dòng).
9. Tải về theo `Content-Disposition`.

### PR-B · Bảng dễ đọc: 5 dòng, xuống dòng, thanh cuộn trên (việc 2–4)
- **`SummaryCell`:**
  - CSS `line-clamp-5`.
  - "Xem thêm" chỉ hiện khi tràn thật (`scrollHeight > clientHeight`, ResizeObserver).
  - Mở tại chỗ / Thu gọn; `type="button"` + `stopPropagation` cả chuột lẫn phím.
  - Ca kiểm dựng ô TRONG `<tr onClick>`.
- **`TABLE_CELL_WRAP`** (`whitespace-normal break-words align-top`) cho cột dữ liệu 3 màn. Nút thao tác và ngày vẫn không xuống dòng.
- **Giữ bảng vẫn tràn ngang khi xuống dòng** (codex P2):
  - `Table` luôn đặt `min-width` = tổng bề rộng khai của các cột đang hiện (không chỉ sau khi kéo giãn), cùng `<colgroup>`.
  - Nhờ vậy chữ xuống dòng TRONG cột, còn bảng rộng hơn màn thì vẫn cuộn ngang.
  - Ca kiểm: bảng 10 cột ở khung 1.000px → `scrollWidth > clientWidth`.
- **`ThanhCuonNgangTren`** (theo khuôn "sticky scrollbar" của Ant Design Table):
  - Div `overflow-x-auto` dính dưới thanh đầu trang.
  - Div con rộng bằng `scrollWidth` bảng (ResizeObserver); đồng bộ `scrollLeft` hai chiều, có cờ chống vòng.
  - Tự ẩn khi không tràn.
  - Đơn thư phường dùng lại thành phần này và `SummaryCell`.
- Ca cổng: 3 màn + Đơn thư phường có `ThanhCuonNgangTren`; cột dữ liệu không dùng `TABLE_CELL_TRUNCATE`.

### PR-F · Font hệ thống + mật độ dòng (tăng phạm vi từ /design-consultation 18/09)
- Tự host bằng gói `@fontsource`, không gọi Google Fonts vì mạng nội bộ có thể chặn. Cả ba gói đã kiểm: bản 5.3.0, giấy phép OFL-1.1, có bộ chữ tiếng Việt.
  - `@fontsource/be-vietnam-pro` (400/500/600): chữ giao diện toàn app.
  - `@fontsource-variable/source-serif-4`: CHỈ cột Tóm tắt.
  - `@fontsource-variable/jetbrains-mono`: mã hồ sơ và ngày, dùng số `tnum` để thẳng hàng.
  - Chỉ nạp bộ `vietnamese` + `latin`, `font-display: swap`.
- Đổi font sẽ làm lệch bề rộng cột, vốn được đo từ dữ liệu thật (#321–#324). Nên đo lại theo đúng khuôn "bề rộng cột từ số đo" rồi cập nhật `width` trong khai cột.
- **Mật độ dòng** theo mẫu Airtable (Ngắn/Vừa/Cao/Rất cao):
  - Ba mức: "Gọn" (1 dòng), "Đọc" (5 dòng, MẶC ĐỊNH theo yêu cầu anh), "Đầy đủ" (không cắt).
  - Nút chọn đặt cạnh nút "Cột".
  - Nhớ theo từng cán bộ ở máy chủ, dùng lại kho tuỳ chọn cán bộ đang có (khuôn "nhớ lựa chọn in").
  - Có mức "Đầy đủ" thì khi hầu hết hồ sơ đều dài, cán bộ không phải bấm "Xem thêm" từng dòng.
- Đặt SAU PR-B. Có ca kiểm: font được nạp, và mức mật độ đổi `line-clamp` đúng.

## Proposed DESIGN.md (ghi thật khi làm PR-B; plan mode chưa ghi tệp)
Nguồn đầu vào:
- Hai góc nhìn độc lập: codex và một agent Claude. Cả hai cùng ra hướng "sổ đăng ký ruled-ledger", Be Vietnam Pro, font có chân cho Tóm tắt, mono cho mã, header dính, cột thao tác dính phải, chip trạng thái kín đáo.
- Bản phác đã chọn: `~/.gstack/projects/trungtm78-PC02/designs/design-system-20260918/variant-C.png` + `approved.json`.
- Tra cứu: [Airtable row height](https://support.airtable.com/docs/airtable-grid-view) (Medium 2 dòng, Tall 4, Extra-tall 6); [Pencil & Paper — enterprise data tables](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) ("xem thêm" tại chỗ thành việc vặt khi hầu hết dòng đều dài → cần chế độ mật độ); [Vite build — `vite:preloadError`](https://vite.dev/guide/build); [version skew + Vue Router](https://paulau.dev/blog/handle-version-skew-after-new-deployment-with-vite-and-vue-router/) (tải lại ở đường đích khi chuyển route).

Cách ghi: DESIGN.md hiện là dạng cũ, sẽ chuyển sang dạng spec. Mọi mục cũ (§3–§10) được giữ trong phần thân. Thêm phần mở đầu YAML:
```yaml
---
# gstack: design-md-format=spec
name: PC02 Quản lý hồ sơ
description: Sổ thụ lý điện tử — sáng, mờ, kẻ dòng mảnh, đọc hồ sơ tiếng Việt cả ngày không mỏi mắt
colors:
  primary: "#003973"        # Xanh Công An — hành động chính, liên kết
  primary-hover: "#002B57"
  primary-soft: "#E6EEF7"   # dòng đang chọn
  background: "#F7F6F2"     # nền giấy
  surface: "#FFFDF8"        # mặt bảng
  header: "#EFEBE1"         # hàng tiêu đề bảng, khung lọc
  text: "#1B2433"           # mực chính
  text-muted: "#5C574B"     # mực phụ
  rule: "#E4DFD3"           # kẻ dòng 1px
  row-hover: "#F5F1E6"
  accent: "#F59E0B"         # CHỈ cho "vừa đổi"/cảnh báo
  error: "#B42318"          # quá hạn
  success: "#1F7A4D"
typography:
  body: { fontFamily: "Be Vietnam Pro", fontSize: 0.875rem, lineHeight: 1.55 }
  label: { fontFamily: "Be Vietnam Pro", fontSize: 0.75rem, fontWeight: 600, letterSpacing: 0.02em }
  reading: { fontFamily: "Source Serif 4", fontSize: 0.906rem, lineHeight: 1.6 }   # cột Tóm tắt
  mono: { fontFamily: "JetBrains Mono", fontSize: 0.8125rem, fontFeature: tnum }
rounded: { sm: 4px, md: 6px }
spacing: { xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "#FFFFFF", rounded: "{rounded.md}" }
  button-secondary: { borderColor: "{colors.primary}", textColor: "{colors.primary}", rounded: "{rounded.md}" }
  table-header: { backgroundColor: "{colors.header}", textColor: "{colors.text}" }
  table-row: { backgroundColor: "{colors.surface}", borderColor: "{colors.rule}" }
---
```
Phần thân thêm §11 "Danh sách hồ sơ":
- **Giải phẫu bảng:**
  - kẻ dòng 1px, KHÔNG zebra (dòng cao thấp khác nhau thì zebra làm mắt nhảy);
  - chữ canh trên; header dính, chữ thường (không viết hoa toàn bộ vì mất dấu khó đọc);
  - thanh cuộn ngang trên dính ngay trên header;
  - cột Thao tác dính phải, có bóng 1px bên trái.
- **Cột Tóm tắt:**
  - là cột rộng nhất, font có chân, `line-clamp` theo mức mật độ;
  - "Xem thêm ▾ / Thu gọn ▴" màu `primary`, `type=button`, không lan sự kiện lên dòng;
  - khi bung, chữ chỉ dài xuống trong đúng ô đó, nền ô `row-hover`.
- **Các cột khác:** xuống dòng. Dùng `overflow-wrap:anywhere` cho mã/địa chỉ dài, `hyphens:none` (không ngắt âm tiết). Ngày và mã dùng mono, một dòng.
- **Trạng thái:** chấm 8px + chữ màu mực phụ. Chỉ "Quá hạn" mới dùng nền đỏ nhạt.
- **Khung lọc:**
  - dải trải ngang, không phải thẻ nổi;
  - nút bên phải theo thứ tự `Xóa lọc` (nhẹ) · `Xuất N dòng Excel` (viền xanh, icon bảng tính) · `Áp dụng` (đặc xanh);
  - bộ lọc đang bật hiện thành dải chip có ×.
- **Trạng thái nút xuất:**
  - đang xuất: nút khoá, chữ "Đang xuất…";
  - vượt trần: câu nói rõ số dòng và trần;
  - rỗng: khoá, kèm lý do;
  - lỗi: dòng chữ đỏ dưới dải lọc.
- **Cập nhật phiên bản:** KHÔNG có giao diện nào (không hộp, không toast), theo yêu cầu anh.
- **Sửa lỗi đang có trong DESIGN.md §3:** CASE là **Vụ án**, INCIDENT là **Vụ việc** (bản cũ ghi ngược).

Do / Don't:
- **Do:** dùng token thay mã màu viết thẳng; bấm thử ô Tóm tắt NẰM TRONG dòng có `onClick`; chụp màn hình thật với chữ dấu chồng ("Nguyễn Thị Hường", "ỗ/ặ/ự") ở 13px trước khi chốt.
- **Don't:** zebra trên bảng xuống dòng; pill trạng thái cầu vồng; hộp thoại cho việc đọc thường ngày; bất kỳ lời nhắc cập nhật nào.

Thêm vào CLAUDE.md: mục "Design System" (đọc DESIGN.md trước mọi quyết định giao diện).

## Việc chung mỗi PR
- Trước PR-A: viết spec `docs/superpowers/specs/2026-09-18-danh-sach-de-doc-tu-cap-nhat-design.md`.
- Mỗi PR:
  - TDD đỏ → xanh;
  - `tsc -b` và jest/vitest toàn bộ;
  - rà mã độc lập + `codex review`;
  - CI xanh đúng SHA → merge squash → kiểm deploy qua buildId;
  - bấm thử trên Chrome thật.
- PR-D/E: chạy thử, sao lưu, xin xác nhận trước khi ghi prod.
- Hệ cũ chỉ đọc.

## Verification
1. **A:** deploy hai bản liên tiếp.
   - Tab mở sẵn → chuyển màn thì lên bản mới, không có hộp nào.
   - Đang gõ lý do xoá hoặc form rồi ẩn/hiện tab → KHÔNG tải lại.
   - Chunk hỏng → tự tải lại một lần.
2. **E/D:** tìm "Lê Nguyễn Yến Thanh" ở Đơn thư, "Kha Tử Thạnh" ở Vụ việc đều ra; `STT cũ: 11732` ra; `GROUP BY stt HAVING count>1` = 0.
3. **C:**
   - Áp dụng thì số dòng, nhãn kỳ và thẻ số cùng đổi.
   - Số dòng trong Excel = tổng trên màn; cột = cột đang hiện.
   - Xuất 47.352 đơn đo thời gian (< 60 s) và bộ nhớ tiến trình.
4. **B:** Chrome thật ở 4 màn: 5 dòng, Xem thêm tại chỗ (URL không đổi), cột xuống dòng, thanh cuộn trên đồng bộ.

## NOT in scope
- **Đồng bộ hệ cũ tự động theo lịch** (systemd timer): hệ cũ còn chạy song song nên đáng làm, nhưng tự ghi prod không người duyệt → cần anh cho phép riêng (đề xuất ở TODOS).
- **Đổi lại mã hậu tố `-2` của hồ sơ lịch sử:** mã đã in lên giấy tờ.
- **Chuyển `BrowserRouter` sang data router để dùng `useBlocker`:** sổ đăng ký form dở dang đạt cùng mục tiêu, diff nhỏ hơn nhiều.

## What already exists (dùng lại)
- `thoatBanCu`, `isChunkLoadError` (`RouteBoundary.tsx`), cờ `canTuChua`.
- `nhanKyApDung` (`constants/thongKeSettings.ts`).
- `exportWard*` (khuôn lặp `getList`) → gộp vào bộ xuất chung.
- `buildPetition`, `parseLegacyDate`, `buMaHoSo`, `napLaiBoDem`, dịch vụ bộ đếm tạo hồ sơ thường.
- `Petition.linkedCaseId/linkedIncidentId`, enum `DA_CHUYEN_VU_AN/VU_VIEC`, `sttCu` (có chỉ mục, tìm được).
- `DeleteResourceModalProvider`, `savedSnapshotRef` (PetitionForm).

## Sơ đồ ca kiểm (coverage)
```
CODE PATHS                                         USER FLOWS
[+] useTuCapNhat                                   [+] Deploy khi đang dùng
  ├─ health: buildId khác/giống/lỗi mạng [GAP→A]     ├─ chuyển màn → bản mới [GAP→A, E2E]
  ├─ chuyển màn → assign(url)          [GAP→A]       ├─ gõ lý do xoá + ẩn tab → giữ [GAP→A]
  ├─ quay tab: rảnh/có dialog/sổ/ô chữ [GAP→A]       └─ chunk hỏng → tự tải 1 lần [GAP→A]
  ├─ preloadError → reload 1 lần       [GAP→A]
  └─ chốt theo buildId                 [★★ có, sửa]
[+] buMaHoSo luật số mới                           [+] Nạp hệ cũ
  ├─ trùng cùng loại → bộ đếm + sttCu  [GAP→E]       ├─ dry in 26 dòng [GAP→E]
  ├─ trùng khác loại → giữ số          [GAP→E]       └─ chạy lại 0/0   [GAP→E]
  └─ stt_cu có sẵn → dừng              [GAP→E]
[+] mapper đơn gắn kèm + CLI bù                    [+] Tìm Yến Thanh ở Đơn thư [GAP→D, E2E]
  ├─ loai=don_thu → Case+Petition 2 chiều [GAP→D]
  ├─ cập nhật lại → không đơn thứ 2    [GAP→D]
  └─ STT đụng → dừng                   [GAP→D]
[+] dungWhereDanhSach ×3 + bộ xuất chung           [+] Lọc → Áp dụng → Xuất
  ├─ list/stats/export cùng where      [GAP→C]       ├─ thẻ số đổi theo Cán bộ nhập [GAP→C]
  ├─ keyset lô 1.000, trần 50k → 400   [GAP→C]       ├─ nhãn kỳ đúng [GAP→C]
  ├─ cot lạ → 400; phạm vi áp          [GAP→C]       └─ Excel = tổng màn [GAP→C, E2E]
  └─ exportWard* hồi quy               [GAP→C, REGRESSION]
[+] SummaryCell / Table / ThanhCuonNgangTren       [+] Đọc bảng
  ├─ tràn/không tràn; bấm trong <tr>   [GAP→B, REGRESSION]  ├─ Xem thêm tại chỗ [GAP→B]
  ├─ min-width luôn đặt → vẫn tràn     [GAP→B]       └─ kéo thanh trên ↔ bảng [GAP→B]
  └─ đồng bộ scrollLeft, ẩn khi hẹp    [GAP→B]
COVERAGE hiện có: 1/26 · mọi GAP đã có ca kiểm ghi trong PR tương ứng
```
REGRESSION (luật sắt, tự thêm):
- Xem thêm điều hướng nhầm: ca kiểm ô trong `<tr>`;
- `exportWard*` đi qua bộ xuất mới: so tệp trước/sau.

## Failure modes
| Đường mới | Cách hỏng thật | Ca kiểm | Xử lý | Người dùng thấy |
|---|---|---|---|---|
| Tự tải khi quay tab | hộp tự dựng không có role=dialog, ô không có defaultValue | có | lưới (c) + cổng sổ đăng ký | không mất chữ |
| preloadError | chunk hỏng thật → lặp tải | có | chốt theo buildId | báo lỗi RouteBoundary sau 1 lần |
| Bộ đếm + sttCu | hai tiến trình cấp cùng lúc | có | cấp trong giao dịch dịch vụ bộ đếm | không trùng |
| Đơn gắn kèm | nối một chiều | có | ghi 2 chiều cùng giao dịch | mở được sang vụ án |
| Xuất 47k dòng | hết bộ nhớ / quá thời gian | có (đo) | ghi luồng + keyset + trần | 400 câu rõ |
| Thanh cuộn trên | ResizeObserver không bắn khi đổi cột | có | quan sát cả bảng lẫn khung | thanh đúng độ dài |
Không còn khe nào vừa không có ca kiểm, vừa không có xử lý, vừa hỏng im lặng.

## Worktree parallelization
| Bước | Module | Phụ thuộc |
|---|---|---|
| A | frontend hooks/, layouts/, vite.config | — |
| E | backend legacy-migration/cli | — |
| D | backend legacy-migration (mapper, service) | E (cùng module) |
| C | backend petitions/incidents/cases + common/, frontend features/_shared, pages/* | — |
| B | frontend components/shared/ListPageShell, pages/* | C (cùng pages/*) |
| F | frontend index.css, package.json, ListPageShell, backend user-preferences | B |

Chạy song song: làn 1 A · làn 2 E → D · làn 3 C → B. Deploy vẫn tuần tự theo thứ tự A → E → D → C → B. Xung đột có thể ở `pages/*ListPageShell` giữa C và B, nên làn 3 làm tuần tự.

## Implementation Tasks
- [ ] **T1 (P1)** — PR-A — sổ đăng ký form dở dang + `trangDangRanh` + `vite:preloadError`. Nguồn: 1A + codex P3.
- [ ] **T2 (P1)** — PR-E — luật số mới qua dịch vụ bộ đếm + `sttCu`. Nguồn: codex P1.
- [ ] **T3 (P1)** — PR-D — đơn gắn kèm nối 2 chiều + CLI bù + bộ cập nhật idempotent. Nguồn: codex P1, 1C.
- [ ] **T4 (P1)** — PR-C — `dungWhereDanhSach` có chế độ stats. Nguồn: codex P2, gốc lỗi thẻ số.
- [ ] **T5 (P2)** — PR-C — bộ xuất chung + khai cột + gộp khái niệm xuất hàng loạt + audit. Nguồn: D1, codex P2.
- [ ] **T6 (P2)** — PR-B — `min-width` + `colgroup` luôn đặt để vẫn tràn ngang. Nguồn: codex P2.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex exec (plan-review) | Independent 2nd opinion | 1 | completed | 6 findings (2 P1, 3 P2, 1 P3), cả 6 đã đưa vào kế hoạch |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 9 issues, 0 critical gaps |
| Design Consultation | `/design-consultation` | Hệ thiết kế màn danh sách | 1 | DONE | codex + Claude subagent đồng thuận "sổ ledger"; chọn bản C; thêm PR-F |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** codex, plan-review, completed. P1 nối một chiều ở PR-D, P1 luật số hậu tố ở PR-E, P2 xuống dòng làm mất cuộn ngang, P2 stats phải bỏ điều kiện trạng thái, P2 hai khái niệm xuất, P3 đoán form bằng DOM.
- **CROSS-MODEL:** một điểm căng: codex P3 muốn khai form tường minh, còn quyết định 1A kiểm DOM. Em tự quyết theo chỉ đạo của anh: làm CẢ HAI (sổ đăng ký tường minh + lưới DOM cuối). Các điểm còn lại hai bên đồng thuận.
- **VERDICT:** ENG CLEARED — sẵn sàng làm.

NO UNRESOLVED DECISIONS
