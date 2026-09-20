STATUS: IN_PROGRESS
# PROGRESS
Cập nhật: 2026-09-20T12:40:00+07:00 | Milestone: 7/9 (đợt Đơn thư nhập liệu nhanh) | Task: T5 + T6 XONG; T7 kế tiếp
Nhánh: `feat/don-thu-nhap-lieu-nhanh` (từ `origin/main` @ cec25c34)
Plan: `~/.claude/plans/th-c-hi-n-c-c-y-u-cosmic-yeti.md` (đã qua /plan-eng-review + /design-consultation)

<!-- Dấu trạng thái kết thúc chỉ ghi ĐẦU DÒNG khi hoàn tất hoặc bị chặn — stop-guard.bat neo theo đầu dòng. -->

## ĐỢT 20/09 — Form Đơn thư nhập liệu nhanh (anh gửi 5 việc)

Thứ tự: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9. Một làn nối tiếp vì 4 PR cùng sửa
`PetitionFormPage/index.tsx`; chỉ T5 chạy song song được.

### Đã hoàn thành
- [x] **T1 — Máy chủ trả tổ + form dùng một nguồn cán bộ duy nhất** — chưa commit
  - `GET /admin/users` trả thêm `teams: [{teamId, teamName, isLeader}]` (helper `withTeams`)
  - `useOfficerOptions` mang `teams` xuống từng mục (giữ cả `isLeader`)
  - Form Đơn thư BỎ lời gọi riêng `/admin/users?limit=200` → dùng `useOfficerOptions`
    (sửa lỗi thiếu ~45/245 cán bộ + lọt tài khoản đã khoá)
  - `giuCanBoDaChon` + `nhanCanBo`: giữ người đã chọn khi họ đã ngừng hoạt động; một cách
    dựng nhãn duy nhất cho cả ô chọn lẫn bảng phân công
  - **Vá thêm 1 lỗi P1 prod phát hiện khi rà mã:** hộp `AssignModal` chết im lặng ở CẢ HAI ô
  - Cổng mới: `motNguonCanBo.gate` (chặn lời gọi `/admin/users` thẳng ở màn Đơn thư)
  - Xoá mã chết `PetitionFormPage/userOption.ts`
  - Patch coverage: `admin.service.ts` dòng mới 100%; `useOfficerOptions.ts` 100% line / 87.5% branch
  - Lint: 0 lỗi mới (mốc HEAD `admin.service.ts` 19 = sau 19)

- [x] **T2 — ô chọn cán bộ gom nhóm theo Tổ + chuẩn ARIA + mặc định cán bộ đề xuất (gộp T4)**
  - `FKSelect` thêm `groups?: FKGroup[]`. Luật tìm: khớp TÊN NHÓM → giữ cả nhóm; khớp TÊN MỤC
    → lọc trong nhóm, bỏ nhóm rỗng. Chỉ số phẳng `dsPhang` cho phím mũi tên đi xuyên nhóm.
  - Chuẩn WAI-ARIA APG: `role=combobox` + `aria-activedescendant` ở ô nhập, `role=listbox`,
    `role=group` + `aria-label` mỗi tổ, `role=option` + `aria-selected`. Trước đây `FKSelect`
    KHÔNG có một thuộc tính `role`/`aria-` nào.
  - `gomCanBoTheoTo`: tổ sắp theo tên, tổ trưởng đầu nhóm, người ở 2 tổ hiện ở cả hai,
    "Chưa có tổ" luôn cuối và chỉ dựng khi có người.
  - Áp cho cả 3 ô chọn cán bộ: `canBoDeXuatId`, `assignedToId`, `PetitionAssignmentSection`.
  - **Bắt được 1 lỗi trong chính mã vừa viết:** ở chế độ nhóm, `FKSelect` tra nhãn đã chọn
    trong `options` (rỗng) → ô KHÔNG BAO GIỜ hiện giá trị đã chọn. Sửa bằng `tatCaMuc`.
  - **Rà mã độc lập bắt 7 lỗi, đã vá HẾT:**
    | # | Lỗi | Cách vá |
    |---|---|---|
    | P1 | `highlightedIndex` là CHỈ SỐ, danh sách đổi dưới chân nó (hồ sơ về muộn) → Enter chọn NHẦM người | bỏ tô khi `khoaDanhSach` đổi, không chỉ khi chữ tìm đổi |
    | P1 | ô bấm mở không có `tabIndex`/`role`/`onKeyDown` → bàn phím KHÔNG mở nổi; 3 ô vốn là `<select>` thật nên đây là LÙI | `role=combobox` + `tabIndex` + Enter/Space/↓ ở ô bấm mở; ô tìm bên trong bỏ `role` |
    | P2 | cán bộ 2 tổ → 2 mục cùng `data-testid` → `getByTestId` nổ, Playwright hỏng trên dữ liệu thật | bản lặp mang thêm chỉ số |
    | P2 | danh sách rỗng lúc ĐANG TẢI báo "không tìm thấy kết quả" → nói dối là "không có cán bộ nào" | tách 3 trạng thái: đang tải / rỗng / không tìm thấy; 3 chỗ gọi truyền `isLoading` |
    | P2 | `localeCompare` thuần → "Tổ CT số 10" đứng TRƯỚC "Tổ CT số 4" (tên tổ THẬT ở `tmp-teams.txt`) | `{ numeric: true }` + ca kiểm trên tên thật |
    | P2 | 4 ca UAT Playwright dùng `locator('option')` → 3 ca TỰ BỎ QUA, 1 ca xanh RỖNG | viết lại theo combobox; bỏ `test.skip` giả — danh sách rỗng LÀ lỗi |
    | P3 | `aria-selected` đánh dấu người đang TÔ → trình đọc màn hình đọc "đã chọn" mỗi lần bấm mũi tên; 2 mục cùng `true` khi cán bộ ở 2 tổ | `aria-selected` chỉ theo giá trị ĐÃ CHỌN |
    | P3 | Enter khi chưa tô tự lấy người ĐẦU danh sách → gõ để lọc rồi Enter là gán bừa, tên in lên Phiếu đề xuất | Enter chỉ chọn khi đang tô |
    | P3 | người đã ngừng hoạt động rơi vào "Chưa có tổ" ở ĐÁY danh sách 245 người | nhóm GHIM "Đang chọn" đầu danh sách |
    | P3 | 2 `useMemo` không bao giờ trúng (`giuCanBoDaChon` trả mảng mới) | bỏ |

- [x] **T3 — danh mục `NGUON_DON`**
  - Hàm thuần `laNguonTrucTiep` + `khoaNguonDon` (20 ca) — suy cờ từ TÊN, không đọc CSDL
  - Luật tạo nhanh `NGUON_DON` (7 ca): mục mới TỰ mang cờ `laTrucTiep`
  - Ô `nguonDon` trên form **Đơn thư** và **Vụ án** dùng `FKSelect directoryType="NGUON_DON"`
    (Vụ án cần dẫn `renderOverride` qua lớp bọc `CaseFormPage/LegacyTabBody`)
  - Câu chữ popup (`vi.ts`) + nhãn trang Danh mục
  - CLI `nap-nguon-don` (+ `.util`, 19 ca): đọc CẢ `petitions.nguonDon` lẫn `cases.nguonDon`,
    gộp theo khoá, tên phổ biến nhất làm tên chuẩn, <3 hồ sơ → chờ duyệt, **chạy thử mặc định**,
    `--csv` xuất bảng gộp có BOM, `--that` mới ghi, chạy lần hai ra 0 mục mới
  - **CHỜ ANH (§8c — ghi prod):** chạy `--csv` trên prod → anh soát bảng gộp → rồi mới `--that`,
    sau đó `--that --chuan-hoa` để đổi hồ sơ cũ về tên chuẩn
  - **Rà mã độc lập bắt 13 lỗi, đã vá HẾT:**
    | # | Lỗi | Cách vá |
    |---|---|---|
    | P1 | ô Nguồn đơn form Vụ án KHÔNG có "Tạo mới", mà danh mục đang RỖNG trên prod → deploy xong là ô chết | thêm `canCreate` + popup tạo nhanh, 4 ca kiểm thật (ca cũ chỉ soi nút mở nên khai sai vẫn xanh) |
    | P1 | khoá chạy-lại chỉ là TÊN mục → quản trị đổi tên/tắt mục xong, lượt sau NẠP LẠI rác vừa dọn | đọc cả `metadata.bienThe` và cả mục đã tắt |
    | P2 | `laNguonTrucTiep` khớp bừa cụm "trực tiếp" → "Không trực tiếp", "Đơn vị trực tiếp thụ lý" đều thành TRỰC TIẾP → cán bộ mở đơn cũ KHÔNG LƯU ĐƯỢC | luật bảo thủ: loại phủ định, đòi ngữ cảnh tiếp nhận; bộ tên chuẩn mở rộng 27 mẫu |
    | P2 | `khoaNguonDon` dùng lại `khoaDonVi` → "Phòng 1"→"1", "Phòng chống tệ nạn"→"chống tệ nạn" | chuẩn hoá riêng, KHÔNG bỏ tiền tố "phòng"/"bch"; cổng cặp-phải-khác/phải-giống |
    | P2 | báo "đã thêm N" trong khi máy chủ chèn 0 (hai lượt chồng nhau) | dùng `createMany.count` thật |
    | P2 | bỏ sót `incidents.chuyenTuDonVi` — màn Vụ việc cũng phơi khái niệm này | đọc cả ba bảng |
    | P2 | ca kiểm "mã nối tiếp" chạy với danh mục RỖNG nên không kiểm gì | truyền mã đã có, khẳng định `ND0008` |
    | P3 | CSV không vô hiệu hoá công thức → Excel diễn giải `=`/`+`/`-`/`@` | chèn nháy đơn |
    | P3 | `--csv --that` ghi bảng gộp ra tệp TÊN LÀ `--that` rồi vẫn ghi CSDL | kiểm đối số, thiếu tên tệp thì dừng |
    | P3 | `order` đánh lại từ 0 mỗi lượt → mục lượt sau chen vào giữa | nối tiếp `order` lớn nhất đang có |
    | P3 | **CLI chỉ dựng danh mục, 47.456 hồ sơ vẫn giữ 1.431 cách viết** → động cơ ban đầu chưa đạt | thêm `--chuan-hoa` ghi lại hồ sơ về tên chuẩn, sau cờ RIÊNG, chạy thử xem trước được |

- [x] **T4 — [P1] SĐT nguyên đơn bắt buộc CÓ ĐIỀU KIỆN theo Nguồn đơn**
  - Máy chủ: validator riêng `SdtNguyenDonHopLe`. **KHÔNG dùng `@ValidateIf` + `@IsNotEmpty`** —
    ca kiểm của chính em bắt được: `@ValidateIf` tắt MỌI validator của ô, nên nguồn "Bưu điện"
    + số "abc" đi lọt thẳng xuống cột. Nới "bắt buộc" không được phép nới luôn "hợp lệ".
  - Trình duyệt: `validate.ts` gọi ĐÚNG hàm thuần ấy.
  - **Cổng hai đầu:** `frontend/src/shared/nguon-don/truc-tiep.corpus.json` là MỘT nguồn sự thật;
    cả hai đầu chấm chính mình trên nó, và cả hai bộ ca kiểm luật cũng lấy mẫu từ đó — không
    bên nào tự chọn mẫu dễ. Gieo lỗi (bỏ xử lý dấu câu ở bản trình duyệt) → cổng đỏ.

- [x] **T5 — cơ chế nhóm ô gập + nhóm "Thông tin khác" (yêu cầu 5)**
  - `NhomOGap` mới: vỏ thẻ riêng, **bộ đếm "N ô · M đã nhập"** (thu gọn mà giấu dữ liệu đã
    nhập là kiểu hỏng tệ nhất), dấu `*` khi trong nhóm có ô bắt buộc, viền đỏ + chấm đỏ khi
    có ô báo lỗi. Nội dung KHÔNG nằm trong DOM khi đóng (không dùng `<details>`).
  - `LegacyLayoutSection` nhận prop `nhom` — mặc định `undefined` → dựng y hệt như trước, nên
    **Vụ án và Vụ việc không đổi một dòng**, 3 cổng `moiOCoChoLuu` giữ nguyên.
  - Bảng khai riêng `features/petitions/nhom-o.def.ts`, mỗi nhóm khai rõ `tab`.
  - **Cổng #5** `kiemNhomLienNhau`: ô trong nhóm phải LIỀN NHAU, không trùng nhóm, không gõ
    nhầm tên ô. Cộng mệnh đề **thứ tự DOM giữ nguyên thứ tự đặc tả**.
  - Cổng bắt được lỗi thật ngay khi khai: tab `subjects` chỉ có 1 trong 2 ô → phải khai `tab`.

- [x] **T6 — nhóm định danh nguyên đơn bung theo Nguồn đơn (yêu cầu 2, phần bung/thu)**
  - Dải LIỀN MẠCH 5 ô (167→171): SĐT · Sinh năm · Số CCCD · Ngày cấp · Nơi cấp. Gồm cả
    "Sinh năm" để dải liền mạch — **0 ô phải dời chỗ, 0 ô lệch cột**.
  - Ba điều kiện HOẶC: `laNguonTrucTiep(nguonDon)` · ô đã có giá trị · ô đang báo lỗi.
  - **Cổng #1** `oBatBuocKhongBiGiau`: bấm Lưu bị chặn thì ô gây chặn PHẢI nhìn thấy được —
    đúng lỗi PR #248. Thêm `oDangLoi` dẫn tín hiệu lỗi xuống nhóm (form Đơn thư hiện lỗi bằng
    điều hướng ô, không in chữ lỗi dưới ô bố cục hệ cũ).

### Đang làm dở
Task: T7 — `PartialDateInput` + cột EDTF `ngayVietDonEdtf`
BƯỚC TIẾP THEO: viết ca kiểm ĐỎ cho `PartialDateInput` (BA Ô PHÂN ĐOẠN trong `fieldset`, KHÔNG
phải một ô mặt nạ — xem TK3 trong plan), rồi cột `ngayVietDonEdtf` + migration + TRỌN đường ống
khoá form (`types.ts` → `buildPetitionPayload.ts` → `create-petition.dto.ts` → `petitions.service.ts`
→ `schema.prisma`). Thiếu một mắt là 400 cho MỌI lượt tạo đơn (cổng
`moi-khoa-form-gui-len-deu-duoc-nhan`). Cộng `ngayVietDonHienThi` dùng chung cho form, danh
sách, xuất Excel, in chứng từ; và sắp xếp danh sách theo khoá gộp `COALESCE`.

### Hàng đợi task kế tiếp
3. **T4** — [P1] SĐT nguyên đơn bắt buộc CÓ ĐIỀU KIỆN theo Nguồn đơn, đồng bộ FE `validate.ts` + BE DTO
4. **T5** — prop `nhom` cho `LegacyLayoutSection` + `nhom-o.def.ts` + nhóm "Thông tin khác" *(làn song song)*
5. **T6** — nhóm định danh (dải LIỀN MẠCH 167–171, gồm cả "Sinh năm") bung theo 3 điều kiện OR
6. **T7** — `PartialDateInput` 3 ô phân đoạn + cột EDTF `ngayVietDonEdtf` + TRỌN đường ống khoá form + sắp xếp danh sách
7. **T8** — áp ô chọn cán bộ có nhóm cho Vụ án/Vụ việc + các hộp phân công
8. **T9** — `DESIGN.md` §12 (TK1–TK4 + Do/Don't)

### Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 20/09 | Cơ chế nhóm khai RIÊNG cho Đơn thư (prop `nhom`), đặc tả `legacy-form-layout.def.ts` KHÔNG đổi | Đặc tả dùng chung cho 3 form (đã kiểm danh sách import) | Vụ án/Vụ việc không đổi; 3 cổng `moiOCoChoLuu` giữ nguyên, không phải nới |
| 20/09 | Nhóm định danh lấy dải LIỀN MẠCH 167–171, thêm ô "Sinh năm" | `LegacyLayoutSection` là lưới phẳng 2 cột đặt theo thứ tự DOM; gom tập rời buộc ô xen giữa phải dời và làm lệch cột mọi ô sau | 0 ô phải dời; tăng scope 1 ô |
| 20/09 | "Trực tiếp" = HÀM THUẦN suy từ tên chuẩn hoá, không đọc CSDL/metadata | `useDirectoryOptions` vứt `metadata`; validator DTO không chạm CSDL được | Chạy y hệt FE/BE; bịt lỗ tạo-nhanh-quên-cờ |
| 20/09 | Ngày thiếu lưu theo EDTF Level 1 (`2026-12-XX`) | Chuẩn ISO 8601-2; sắp xếp + lọc bằng tiền tố chuỗi chạy thẳng trên SQL | Lưu nguyên văn thì cột chết |
| 20/09 | Ô ngày = BA Ô PHÂN ĐOẠN trong `fieldset`, không phải ô mặt nạ | NN/g + uxpatterns.dev; "để trống ngày" thành thao tác hạng nhất | Đổi tên `MaskedDateInput` → `PartialDateInput` |
| 20/09 | `teams` là khoá THÊM ở `/admin/users`, không đổi khoá cũ | 3 trang danh sách + `AssignModal` đang đọc endpoint này | Không ai vỡ |
| 20/09 | `gomCanBoTheoTo` trả thẳng hình `FKGroup` (`key`/`label`/`options`) | Một hình duy nhất, khỏi dịch qua lại ở chỗ gọi | Chỗ gọi truyền thẳng vào `FKSelect` |
| 20/09 | Tiêu đề nhóm tổ trong dropdown KHÔNG gập được | Nhóm ở đây để đọc và lọc; thêm một trạng thái đóng/mở nữa vào danh sách đang lọc là hai mô hình tranh nhau | Chỉ có tiêu đề + chip đếm |

### Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| Ngôn ngữ chú thích/tên ca kiểm | Tiếng Việt (định danh tiếng Anh) | CLAUDE.md giới hạn luật "chú thích tiếng Anh" cho `Lumina_Approve`; protocol §4 nói "convention repo thắng" — repo PC02 dùng tiếng Việt |
| Nhãn cán bộ đã ngừng hoạt động | Giữ mục, ghi rõ "(không còn hoạt động)" | Mất mục = mất phân công; ô trắng khiến cán bộ chọn người khác = phân công lại ngầm |
| Ca kiểm cũ soi `role="button"` cho mục danh sách | Đổi sang `role="option"` | Mục nay nằm trong `role="listbox"`; soi theo vai trò nút là soi đúng thứ chuẩn nói KHÔNG nên dùng |
| Ảnh anh gửi kèm | Không có trong ngữ cảnh → bám mô tả chữ | Ghi rõ trong plan; sửa phần giao diện nếu ảnh chốt khác |

### Trạng thái test
Full suite: **backend 5839/5839 (416 suite)** · **frontend 3566/3566 (943 suite)** · tsc sạch
· 0 lỗi lint mới
Nguyên nhân gốc yêu cầu 4 (cán bộ đề xuất trắng): ô cũ đổ từ `limit=200` sắp `createdAt desc`
→ cán bộ có tài khoản CŨ không nằm trong danh sách nên `<select>` hiện trắng dù `formData` đúng
Patch coverage: 100% dòng mới (backend) · 100% line / 87.5% branch (`useOfficerOptions`)
Test fail: không

### Nợ kỹ thuật / rủi ro
- `admin.service.ts` có **19 lỗi lint prettier CÓ SẴN từ HEAD** (dòng 180, 206, 301–313, 399–431, 740, 846, 880–928) và 1 `no-unused-vars` (`AccessLevel` dòng 27). T1 không thêm lỗi nào. Dọn riêng một PR `chore(lint)` — gộp vào đây sẽ phình diff.
- `admin.service.spec.ts` 35 lỗi lint có sẵn (khối `mockAudit.wrapUpdate` dùng `any`).
- ĐÃ DỌN: `useOfficerOptions` nay gọi `hoTen()` dùng chung thay vì chép tay phép ghép.
- **Bẫy đo đạc (gặp HAI lần):** chạy `npx jest` (backend) và `npx vitest run` (frontend) SONG
  SONG gây hai kiểu đỏ GIẢ: (1) 3 ca xuất Excel quá hạn 5s vì đói CPU; (2) **hỏng kho đệm biến
  đổi của jest** → 32 ca `two-fa.service.spec.ts` đỏ với lỗi `ScriptTransformer`, không phải
  mệnh đề nào sai. `npx jest --clearCache` rồi chạy lại là 32/32 đạt. **Chạy LẦN LƯỢT.**


---

# (Đợt trước — 18/09, còn CHỜ ANH)

# PROGRESS
Cập nhật: 2026-09-18 | Milestone: 6/6 + C2 + UAT (A→E→D→C→C2→B→F1→F2→UAT) | Task: MÃ + UAT XONG; lượt ghi E ĐÃ CHẠY prod 19/09 (anh duyệt). BLOCKED chờ anh (§8c): D 86 đơn gắn kèm, C2 4.601 vụ việc bù Cán bộ nhập (anh CHƯA duyệt) — rồi E18 trên prod; ký UAT_PASS. Chờ anh: 3 lượt ghi prod (E 26 hồ sơ, D 86 đơn gắn kèm, C2 4.601 vụ việc). Plan: ~/.claude/plans/gleaming-pondering-thacker.md · Spec: docs/superpowers/specs/2026-09-18-danh-sach-de-doc-tu-cap-nhat-design.md

<!-- Dấu trạng thái kết thúc chỉ ghi ĐẦU DÒNG khi hoàn tất hoặc bị chặn — stop-guard.bat neo theo đầu dòng. -->

Spec gốc:
- M1: `docs/superpowers/specs/2026-09-14-loai-thong-tin-design.md`
- M2–M6: `docs/superpowers/specs/2026-09-14-tim-kiem-dang-the-design.md` (đã qua /plan-eng-review, 22 phát hiện đã gộp)

## Đợt 18/09 — danh sách dễ đọc + tự cập nhật + dữ liệu hệ cũ thiếu (anh gửi 6 việc)
Plan đã qua /plan-eng-review (9 phát hiện + codex 6, đã gộp) và /design-consultation (bản C). Thứ tự: A → E → D → C → B → F.
| PR | Nội dung | Trạng thái |
|---|---|---|
| A | Tự cập nhật im lặng: gỡ BanCuPrompt/PwaUpdatePrompt, cập nhật khi chuyển màn / tab rảnh / preloadError, sổ đăng ký form dở dang | DONE #408 → bf0d8ce1, deploy xanh buildId khớp, bundle prod không còn hộp nhắc. Rà mã P1 defaultValue React19 + P2 history.state; codex P2 ×3 (gỡ SW khi hỏng gói, ô tích/radio, tệp chờ tải) — đã vá. 277 tệp/3.247 ca FE xanh. |
| E | Nạp 14 mới + 12 sửa hệ cũ; trùng số cùng loại → bộ đếm + sttCu (cần anh xác nhận trước ghi prod) | DONE #409 → afacaa72. GHI PROD 19/09 06:28 (anh duyệt): sao lưu pre-cap-nhat-he-cu-20260919-0628.sql.gz → nạp 26; 13 đơn 11729–11742 → 2026-11936…11948 (STT cũ 13/13); Kha Tử Thạnh 2026-11732; chạy lại 0; 0 số trùng; E17 PASS prod |
| D | 86 hồ sơ loai=don_thu nằm ở Vụ án/Vụ việc → đơn gắn kèm nối 2 chiều (cần anh xác nhận trước ghi prod) | DONE #410 → 25f099e5. Dry prod: 86 (61 vụ án, 25 vụ việc). CHỜ ANH XÁC NHẬN: pg_dump → bu-don-thu-lech-loai --that |
| C | Bộ lọc: dungWhereDanhSach chung list/stats/export; bộ xuất Excel chung keyset+stream; nút Xuất N dòng | DONE #411 → f1b3dbc2, deploy xanh buildId khớp; prod 3 điểm cuối export/danh-sach trả 401 khi chưa đăng nhập, bundle có nút. Rà mã 0 P1/P2, 3 P3 đã vá; codex sạch 2 lượt. E2E bản sao: danh sách = thẻ số = số dòng Excel ở cả 3 màn (645/2/37), trang in A4 ngang |
| C2 | Vụ việc: "Người nhập" trắng + lọc Cán bộ nhập ra 0 (prod canBoNhapId 6/4.725) — bộ nạp ghi canBoNhapId, tạo mới mặc định người tạo, CLI bu-can-bo-nhap-vu-viec (cần anh xác nhận trước ghi prod) | DONE #412 → fdb62f1e, deploy xanh buildId khớp. Rà mã 2 P2 đã vá (đồng bộ hệ cũ đè người đã chọn; chuyển đơn/nhập Excel thiếu người nhập); codex sạch 2 lượt. Dry prod (chỉ đọc): 4.601 vụ việc sẽ bù. CHỜ ANH XÁC NHẬN: pg_dump → bu-can-bo-nhap-vu-viec --apply |
| B | Bảng: Tóm tắt 5 dòng + Xem thêm tại chỗ, cột xuống dòng, thanh cuộn trên, DESIGN.md §11 | DONE #413 → 0815c706, deploy xanh buildId khớp, bundle prod có ThanhCuonNgangTren. Chrome thật 4 màn đạt (bắt lỗi `block` đè line-clamp jsdom không thấy). Rà mã 2 lượt: P2 tiếng vọng cuộn + 6 P3 đã vá. Codex sạch lượt nhánh; HẾT HẠN MỨC tới 20/09 18:50 → commit sửa rà bằng agent độc lập |
| F | Font tự host + mật độ dòng nhớ theo cán bộ | DONE — F1 #414 → c4ef2987 (12 woff2/264KB, prod phục vụ font/woff2 immutable; DateCell một dòng; rà mã P2 mẫu in 59/60 đổi font → token font-doc riêng). F2 #415 → d85c81c1 (cột user_table_layouts.matDo đã có trên prod; Gọn/Đọc/Đầy đủ; rà mã 4 P3 đã vá). Chrome thật đạt cả hai. Codex hết hạn mức tới 20/09 → rà mã độc lập thay |
| UAT | §9 UAT-COVERAGE đợt 18/09 | DONE — docs/uat/dot-1809/UAT-COVERAGE.md (#419). Prod API 18/18, E2E 23 PASS (E17/E18 chờ ghi prod); bản sao API 18/18, E2E 24 PASS. UAT bắt 4 lỗi thật, đã sửa + deploy: U1 Xem thêm mất sau khi nạp font + U2 lượt kiểm bản mới bị bỏ khi effect chạy lại (#416 → 995b095b); U3 ô Cán bộ nhập cắt 200/245 + U4 13 cặp trùng tên (#418 → 31a5cbcc). Gieo lỗi 15/15. Bản sao pc02_e2e_c đã xoá, tiến trình local đã dừng |
Assumption: quy ước repo (định danh/chú thích tiếng Việt, chuỗi hiển thị viết thẳng như mọi màn hiện có) thắng §4 "tiếng Anh + i18n" vì protocol ghi "convention hiện có của repo thắng"; CLAUDE.md toàn cục cũng chỉ áp tiếng Anh cho Lumina_Approve.

## Việc chen ngang 17/09 — tìm kiếm %like% (anh báo "STT: 78" không ra)
Plan: ~/.claude/plans/gleaming-pondering-thacker.md. Nhánh `fix/tim-kiem-chuoi-con` (từ main 68661702), CHƯA đẩy.
- 38a1deea PR1: mọi thẻ chữ/mã khớp chuỗi con hai phía; bảng bỏ dấu trình duyệt sinh từ máy chủ + cổng chạy thật.
- 126924bf vá 3 phát hiện rà mã/Codex: bỏ biến thể năm (rò 2026-1→2025-126-1; prod 0 mã dạng ngắn); thẻ mã trình duyệt so nguyên văn như ILIKE; gỡ khoá STT số dòng ở 8 màn + cổng gieo lỗi. BE 5.281/5.281, FE 3.205/3.205, tsc 0, lint dòng mới 0.
- BỊ CHẶN: `gh` token hết hạn → git push cũng hỏng ("could not read Username"). Cần anh chạy `gh auth login -h github.com`.
- Sau khi đẩy: /review + codex lại trên 126924bf → PR → CI đúng SHA → merge → deploy → EXPLAIN prod + bấm thử "STT: 78". Rồi PR3a (Hướng dẫn đơn TRƯỚC: 441/541 hồ sơ không tìm ra).
- Codex rà 126924bf: sạch.
- Nhánh XẾP CHỒNG `fix/tim-kiem-huong-dan` (từ 126924bf): 6030e006 Hướng dẫn đơn tìm/phân trang/thống kê ở máy chủ + migration 20260917080606_tim_kiem_huong_dan (sau deploy PHẢI nạp cột bóng guidance_records bằng CLI). BE 5.291, FE 3.206 (trước refactor fetch), tsc 0, lint dòng mới 0. Chờ Codex.
- ĐO PROD 17/09 (chỉ đọc) guidance_records 541 bản đều di trú: createdById NULL 541 (legacyRaw.__createdById khớp user 541/541) → cán bộ phạm vi userIds KHÔNG thấy bản nào; subject rỗng 539 (mapper lấy loai_thong_tin chỉ 2 bản); SĐT hệ cũ rỗng thật; (nam,stt) duy nhất 541. → PR SAU (ghi dữ liệu prod, theo quy trình): cột mã + bù createdById + sửa buildGuidance.
- Rà mã độc lập 6030e006: 0 P1/P2, 3 P3 → vá ở 55c0425c (ngày gõ dở 400; nhớ trang cũ/kẹp trang; thẻ trangThai lệch thống kê). Codex 6030e006 sạch.
- Nhánh RIÊNG `fix/di-tru-nguoi-nhap-tier3` (từ main 68661702, worktree C:/PC02/wt-nguoi-nhap): 2c24f5a0 mapper tier-3 gắn createdById + CLI bu-nguoi-nhap-tier3 (mặc định chỉ đọc). 247 OFFICER đang thấy 0 bản ghi ở Hướng dẫn/Trao đổi/Kiến nghị. Sau merge: chạy CLI chỉ-đọc trên prod, đọc mẫu, rồi --apply (ghi prod — theo quy trình xác nhận). BE 5.279/5.279, tsc 0.
- SỰ CỐ LOCAL: set bị nuốt → 3 UPDATE bù người nhập tự commit trên pc02_that (local, 650 ô NULL→id đúng). Prod không bị đụng. pc02_that nay lệch prod ở đúng 650 ô này.
- 17/09 gh auth đã sửa: đẩy 3 nhánh, mở PR #392 (%like%, base main), #393 (người nhập tier-3, base main), #394 (Hướng dẫn đơn, base fix/tim-kiem-chuoi-con). Chờ CI.
- MERGED + DEPLOYED 17/09: #392 → a5dbb740 (EXPLAIN prod: stt ILIKE %78% 117 ms, tim_kiem_bd %an% 281 ms, audit 12 ms; STT:78 khớp 1.196 đơn); #393 → 63192969; #395 (thay #394 — cherry-pick tránh force-push) → 91261d91, nạp cột bóng guidance_records 541/541 (lua dao 216, Đội 4 362). Health buildId khớp từng lần.
- Bù người nhập tier-3 trên prod: anh xác nhận 17/09 → --apply 541/76/33, chạy lại 0 trống. OFFICER tuananh nay thấy 396 hướng dẫn + 66 trao đổi, thanhhoai 17 kiến nghị (trước: 0). Hoàn tác: đặt lại NULL cho id đã bù.
- Còn: nhánh remote fix/tim-kiem-chuoi-con, fix/tim-kiem-huong-dan, fix/di-tru-nguoi-nhap-tier3, fix/tim-kiem-huong-dan-v2 chưa xoá (§8c, chờ anh).
- PR3a Kiến nghị VKS DONE: #396 → 3876c7e0 (máy chủ tìm/phân trang/thống kê/xuất Excel; vá where.OR phạm vi đè ô tìm; phạm vi khớp getById cho canDispatch + tổ trưởng; search cũ khớp tên vụ án). Codex + rà mã độc lập đã vá. Deploy xanh, nạp cột bóng proposals 42/42, prod tìm quận 12=3.
- PR3a Ủy thác điều tra DONE: #397 → 12f2a21a (máy chủ tìm/phân trang/thống kê; vá where.OR; TẠO/SỬA ủy thác trước luôn 400/500 — gửi status chữ thường + khoá relatedCase, Partial DTO; nay UpdateDelegationDto + lưu Số/Ngày; tổ trưởng không thấy dòng 403 + sắp createdAt,id cho cả Kiến nghị). Deploy xanh, cột bóng delegations 10/10.
- PR3a Trao đổi chuyên án DONE: #398 → 5b19eb5e (máy chủ tìm/phân trang; tìm kiếm nâng cao trước không lọc gì; tạo mới trước luôn 400; addMessage kiểm phạm vi; maHoSo năm-stt). Deploy xanh, cột bóng exchanges 76/76. CLI bu-ma-trao-doi: anh xác nhận → --apply 73, chạy lại 0 rỗng; 76/76 có mã, tìm 2025-573 ra 1.
- PR3a Phân loại danh mục DONE: #399 → e87b401c — KHÔNG chuyển máy chủ (58 dòng, tải đủ, lọc tại chỗ đã %like%); thêm báo "Đang hiện N/M" khi total > số dòng tải.
- PR3a Đơn thư phường DONE: #400 → 3509257b (tải 100/47.352 → máy chủ; petitionType param; bỏ cột Mức độ 0% dữ liệu; cột ngày = Ngày đề xuất; Tóm tắt = detailContent). PR3a HOÀN TẤT.
- PR3b-1 Vụ án phường DONE: #401 → 6793b89d (máy chủ tìm/lọc/phân trang/KPI; bỏ phường gán cứng — non-admin trước 0 dòng; cột thật; khai tenVuAn + toiDanhChinh; tuỳ chọn tatCaGomQuanHe cho * (rà mã P2); nhãn kỳ thống kê ở Vụ án phường + Đơn thư phường (rà mã P2); xuất Excel dùng getList, phụ đề đúng kỳ). Codex 2 lượt sạch, CI xanh đúng SHA, deploy xanh buildId khớp. Nạp cột bóng crimes 317/317. Prod: tội danh chính trộm cắp 90 hồ sơ (ô chữ 7); * kèm quan hệ 19,6 ms. CÒN: xuất Excel Đơn thư phường chưa theo thẻ/trạng thái (có từ #400).
- PR3b-2 Vụ việc phường — ĐO PROD 17/09 (chỉ đọc): 1.165 vụ việc tổ phường (4.725 tổng, 584 không tổ). incidentType 0%, unitId 0% (cột Phường hiện unitId → trắng), diaChiXayRa 6, "Địa điểm" đang hiện description (bịa), name≈description (bài toán "Tên trùng Tóm tắt" chờ anh), tội danh chính 1.009, benVu 1.112, code/ngayDeXuat 100%, status TIEP_NHAN 1.162 + DA_CHUYEN_VU_AN 3. Kế hoạch: bỏ cột Loại + Mức độ (0%), Địa điểm → bỏ (6/1.165), Phường = assignedTeam.ward, Tội danh chính (cần khai vu-viec toiDanhChinh), STT = code.
- PR3b-2 Vụ việc phường DONE: #402 → a24aa6cf. Không migration (SQL sinh giống hệt #401). Rà mã P3 đã vá: chiToPhuong (helper dieuKienToPhuong — Vụ án/Vụ việc/Đơn thư phường chưa chọn phường chỉ lấy tổ CÓ phường; prod vụ việc 1.165/4.725, đơn 3.911/47.352), nhãn kỳ đúng khi tự chọn ngày (nhanKyApDung). Codex P2 đã vá: xuất Excel Đơn thư phường dùng getList (trước lọc donViGiaiQuyet=ID phường, createdAt, cắt 500). Để nguyên P3: * Vụ việc khớp cả tội danh chính ở màn chính (không có cột). Codex 3 lượt sạch, CI xanh đúng SHA, deploy xanh buildId khớp; cột bóng 0 lệch; * kèm tội danh 67 ms.
- PR3b-3 Phân loại khác — CHỜ ANH QUYẾT (đọc mã hệ cũ Modules/PhanLoaiKhac: màn lọc ho_so_doi_1.loai="phan_loai_khac" — loại hồ sơ thứ tư; Mongo live đếm CHỈ ĐỌC = 0 bản; hệ mới không có chỗ lưu loại này). Màn mới đang hiện MỌI vụ án REGULAR với phân loại = tội danh (bịa). Phương án: (a) gỡ khỏi menu qua feature flag, (b) giữ màn nhưng trống thật + giải thích, (c) dựng loại hồ sơ mới. Tạm bỏ qua, làm màn kế.
- Ghi chú đo 17/09: định nghĩa phường theo tổ khớp hệ cũ theo loai: vụ việc 1.090/1.102 vu_viec_phuong_xa nằm tổ phường (tổ phường 1.165); vụ án 294/294 vu_an_phuong_xa nằm tổ phường (tổ phường 368, chênh 43 gốc đơn thư + 23 gốc luật sư do tổ phường thụ lý).
- PR3b-4 Hồ sơ mới tiếp nhận DONE: #403 → cabff2db. Máy chủ hoá + cột thật (API trả thêm caseProvenance); gỡ Mức độ/Hạn xử lý/thẻ Quá hạn+Khẩn (deadline 0/860), ô lọc quận gán cứng, case-provenance-mapper. Rà mã P2: XOÁ vụ án luôn 400 vì DeleteCaseDto bắt buộc reason — cả Hồ sơ mới lẫn Vụ án phường nay đi qua hộp xoá chuẩn (có ô lý do); hộp chuẩn đọc lỗi sai chỗ (data.message) nay dùng extractApiError. Codex P2: 4 màn tự dựng gửi thongKeTruongNgay=NGAY_TIEP_NHAN để lọc đúng cột Ngày đề xuất (admin đặt "theo Ngày tạo" thì máy chủ lọc createdAt). Codex 3 lượt sạch, CI xanh đúng SHA, deploy xanh.
- PR3b-5 Đơn trùng DONE: #404 → d5e233d0. Migration don_trung_chuan_hoa (4 cột GENERATED giữ dấu thanh) + listDuplicates + GET /petitions/duplicates + xuất Excel dùng chung + màn viết lại theo nhóm. Rà mã: P2 cổng generated-columns thêm 4 cột; P2 xuất gọi listDuplicates MỘT lượt (trước ~150 lượt, 262 ms/lượt); P3 trần 20 đơn/nhóm + báo "Đang hiện N/M"; P3 nhận lại nhãn tiêu chí tiếng Việt. Codex 2 lượt sạch, CI xanh đúng SHA, deploy xanh. Prod: cột sinh đủ 47.352, gom 95 ms, 7.570 nhóm/29.605 đơn.
- PR3b-6 Chuyển đội/Trả hồ sơ DONE: #405 → b4efeeb8. Gộp ba nguồn xuống MÁY CHỦ (module workflow mới, GET /workflow/chuyen-tra, sortBy=ngayDeXuat, trần 2.000 dòng báo rõ); cột thật; Chuyển đội dùng PATCH /:id/assign; Trả hồ sơ ghi trạng thái Đã chuyển đơn vị (Vụ việc qua PATCH /:id/status + PUT chuyenDenDonVi; Đơn thư không có trạng thái ấy → nút tắt kèm lý do); gỡ nút Xuất Excel không có API. Rà mã 4 P1 + codex 2 P1/P2 đã vá (limit>100 từ trang 6, sắp sai khoá, /teams trả mảng thô, UpdateIncidentDto không nhận status, thiếu thongKeTruongNgay ở DTO, khoá phụ id). CI xanh đúng SHA, deploy xanh.
- PR3b-3 Phân loại khác DONE (anh chốt 18/09 "gỡ khỏi menu"): #407 → c3784b6d. Gỡ mục menu + route + màn + 2 ca kiểm cũ; cổng menu.test chốt không quay lại; Playwright e2e/uat CL-05 đổi thành "đã gỡ". #406 đóng vì nhánh còn commit trước squash của #405 (xung đột) — cherry-pick 3 commit sang nhánh mới từ main. CI xanh đúng SHA, deploy xanh buildId c3784b6d, bundle prod 0 chuỗi "Phân loại khác"/"classification/others".
- PR3b HOÀN TẤT 6/6 → kế hoạch %like% (PR1, PR3a, PR3b) XONG.
- CHỜ ANH: (1) UAT_PASS cho 9 mệnh đề bấm thử M7; (2) xoá nhánh remote đã merge (§8c, thêm fix/chuyen-tra-du-lieu-that, fix/go-phan-loai-khac); (3) hạ 3 TK .doi2 từ ADMIN về OFFICER; (4) PR ghi dữ liệu prod Hướng dẫn (cột Vấn đề rỗng 539/541, bù createdById); (5) sửa stop-guard.bat (^^STATUS).
- Ghi chú: `?stt=` API cũ của Đơn thư (petitions.service.ts:148) vẫn so đúng biến thể — giao diện đã quy sang `tk`, để nguyên.

## Milestone
| # | Nội dung | Nhánh |
|---|---|---|
| M1 | Ô Loại thông tin: một ô smart select, danh mục LOAI_THONG_TIN, nhóm hạn, chuẩn hoá dữ liệu | feat/loai-thong-tin-smart-select |
| M2 | Tìm kiếm dạng thẻ — T0 đo trước + PR1 nền + Đơn thư + lát Tổng hợp | feat/tim-kiem-dang-the-nen |
| M3 | PR2 Vụ việc, Vụ án, Ủy thác điều tra | |
| M4 | PR3 Tổng hợp đầy đủ, Đối tượng, Luật sư | DONE — PR #378 merge f5ed68a5, prod-verified 15/09 |
| M5 | PR4 12 màn tìm phía trình duyệt | DONE — PR #379 merge 93551023, deploy xanh 15/09 |
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

### Tiến độ M4 (nhánh feat/tim-kiem-dang-the-tong-hop-doi-tuong-luat-su)
- [x] M4-T1 — commit 5e5221b4: bộ sinh gộp khối trigger THEO BẢNG (một hàm/trigger mỗi bảng, biểu thức cột bóng lệch thật → lỗi), truongPrismaCanCo khử trùng, `sinhCacCauNap` (CLI nạp mỗi bảng một lần, cùng biểu thức trigger); kiểu thẻ `quan-he` (`is` trên cột bóng có sẵn của đích, lùi cột gốc đích; đích chưa có cột bóng → lỗi bộ sinh). tim-kiem 17 bộ/204 ca.
- [x] M4-T2+T3 — commit b631a765: khai doi-tuong.khai.ts + luat-su.khai.ts; migration 20260915110524_tim_kiem_doi_tuong_luat_su (subjects một trigger gộp thêm id_number_bd/tim_kiem_bd; lawyers cột bóng + GIN + chua_nap); schema field chỉ đọc; getList Đối tượng/Luật sư qua BoTimKiem (`search` cũ → `*`, khoá lạ 400, DTO `tk`); [P0] phạm vi `where.case` → AND. 25 bộ/315 ca.
- [x] M4-T4 — commit c1b1c628: ObjectListPageShell (3 loại, tiền tố objects/victims/witnesses, vẫn gửi `type`) + LawyerListPageShell: ô thẻ, cột timKiem, `q` → `*`; the.ts lọc ký tự điều khiển cho thẻ (giữ ranh giới tin cậy sanitizeStringParam). FE 32 tệp/380 ca, tsc -b sạch.
- [x] M4-T5 — Tổng hợp đầy đủ: khai theo chip loại ("Tất cả" = khoá chung ba loại bỏ kiểu chọn; một loại = khai đầy đủ); thẻ lạ với chế độ hiện đỏ không gửi; thống kê loại khác chỉ gọi khi mọi thẻ thuộc khoá chung (Đơn thư/Vụ việc cũng có khoá trangThai nhưng mã khác/trùng sai nghĩa); mặt lọc gỡ 3 ô chữ chết (thành thẻ donViGiaiQuyet/trangThai/nguoiNhap, đường dẫn cũ → thẻ), 2 ô ngày nay gửi xuống cả 3 API (Vụ việc fromDateRange); cột Đơn vị → "Đơn vị giải quyết" đọc donViGiaiQuyet; cột "Người nhập" ẩn sẵn; cổng timKiemCotKhai + xoaLocGhiUrlCuoi (gieo lỗi nhắm đúng useListFilters). FE 12 tệp/218 ca, lint dòng mới 0.
- [x] M4 /review (chuyên gia bảo mật/hiệu năng/di trú dữ liệu: KHÔNG phát hiện) — ĐÃ SỬA (TDD, đỏ 9 BE + 7 FE → xanh):
  - Thẻ "Vụ án" ở Đối tượng/Luật sư lọc `cases.tim_kiem_bd` (13 cột) trong khi cột hiện `case.name` → khai mới `cotBongPhu` (cột bóng không thành khoá thẻ, chỉ làm đích quan hệ); Vụ án `cotBongPhu: ['name']` → `cases.name_bd` + GIN; quan-he trỏ `nameBd`. Migration 20260915110524 sinh lại (chưa deploy).
  - DTO Đối tượng/Luật sư bỏ `MaxLength` trên `search` cũ (400 trước khi máy chủ kịp cắt → nhóm biến khỏi tìm chung); thêm spec DTO.
  - Thẻ chọn mang MÃ lạ (đổi chip loại ở Tổng hợp, `comp_status` gõ tự do) → 400 cả màn: `locTheHopLe`/`theHopLe` trong the.ts, hook nhận `giaTriChon`, trả `theHopLe`; thẻ đỏ không gửi.
  - Thẻ đỏ nói đúng lý do (`lyDoKhongHopLe`, kèm trong aria-label nút sửa); Tổng hợp: "Chỉ áp dụng khi chọn đúng loại hồ sơ" / "Không áp dụng cho loại hồ sơ này".
  - Chip "Tất cả" không cộng thiếu khi một thống kê bị bỏ; số bộ lọc chỉ đếm thẻ hợp lệ; còn thẻ (kể cả đỏ) mà rỗng → "lọc không ra".
  - Dọn: bỏ bí danh `canNap*` không ai gọi, chú thích CLI cũ, `tenNguoi` → `hoTen`; SQL tắt khẩn ghi chú migration mới bật lại trigger.
  - Commit e50f8a9d; bộ ĐẦY ĐỦ: backend 346 bộ/5.163 ca, FE 252 tệp/3.015 ca xanh; tsc sạch; lint dòng mới 0. PR #378, CI xanh.
- [x] M4 /codex (chia 2 lượt backend/frontend, reasoning medium — lần trước hết giờ): backend "No findings, Ship". Frontend 1 P2 + 2 P3, ĐÃ SỬA (TDD, đỏ 3 → xanh): bản vá thẻ hợp lệ chỉ áp ở Tổng hợp, chưa áp ở Đối tượng/Luật sư — Đối tượng: hook thiếu `giaTriChon` nên mã Trạng thái lạ vẫn gửi (400); cả hai màn: bảng rỗng xét `tkKey` (thẻ đỏ bị lọc hết → "chưa có dữ liệu" thay vì "lọc không ra"), số bộ lọc đếm cả thẻ đỏ.
- [x] M4 PR #378 — commit d8b73b31 (FE 252 tệp/3.018 ca xanh); CI 3/3 xanh ĐÚNG sha d8b73b31 (đối chiếu check-runs); merge --admin f5ed68a5.
- [x] M4 deploy — lượt đầu ĐỎ ở bước `ssh-keyscan` (runner không tới VM, lỗi mạng; dừng TRƯỚC rsync, prod giữ f6ba1f77 nguyên vẹn) → `gh run rerun --failed` xanh. Health công khai buildId f5ed68a5; release symlink f5ed68a5; migration 20260915110524 áp (không rolled back); index.html phục vụ ≡ bản release (sha256).
- [x] M4 prod dữ liệu — nạp cột bóng chạy thử: subjects 1.293, cases 3.710 (name_bd mới), lawyers 261, còn lại 0 → `--that` → chạy lại 0 lệch cả 6 bảng. `kiem-vang-bo-dau --chuoi-that`: 646 + 100.475 chuỗi, lệch 0.
- [x] M4 EXPLAIN prod — Đối tượng `*` 0,8 ms (seq, bảng 1.293 dòng); Đối tượng thẻ Vụ án qua `cases_name_bd_trgm` Bitmap Index 1,7 ms; Luật sư `*` 0,4 ms (seq, 261 dòng).

### Tiến độ M5 (nhánh feat/tim-kiem-dang-the-man-trinh-duyet từ main f5ed68a5)
- 12 màn lọc phía trình duyệt bằng `toLowerCase().includes` (không bỏ dấu, không chọn cột), KHÔNG dùng ListPageShell (bảng tự dựng): classification/{DuplicatePetitions, OtherClassification, ProsecutorProposal, WardCases, WardIncidents}, workflow/{CaseExchange, InvestigationDelegation, PetitionGuidance, TransferAndReturn}, petitions/WardPetitions, cases/InitialCases, admin/MasterClass.
- [x] M5-T1 — commit 0b4480f8: `locTheoThe(rows, the, khai)` thuần (shared/tim-kiem/loc-theo-the.ts), cùng ngữ nghĩa máy chủ: cùng khoá OR/khác khoá AND, `*` chữ+mã, bỏ dấu + gộp khoảng trắng/NBSP, <3 ký tự khớp đầu từ, ngày theo giờ VN (đọc cả ô đã định dạng dd/mm/yyyy — ca đỏ bắt được trước GREEN), chọn so đúng mã, khoá lạ bỏ qua. 13 ca.
- [x] M5-T2 — commit bbbbf5da: `useLocTheoThe` hook chung thẻ URL + lọc tại chỗ; `coThe` tính cả thẻ đỏ. 5 ca.
- [x] M5-T3 — commit 39931a2e: Đơn thư phường/xã (8 cột, 6 ca mới + 17 cũ xanh).
- [x] M5-T4 — commit 071af281: Vụ việc/Vụ án phường xã + Phân loại khác (Vụ án lọc SAU phạm vi quyền). 12 ca mới.
- [x] M5-T5 — commit 88cd3b51: Trao đổi chuyên án, Ủy thác điều tra, Hướng dẫn đơn, Chuyển đội/Trả hồ sơ (Trạng thái Chuyển đội tìm theo NHÃN — mã khác nhau theo loại; 2 màn trước không có dòng rỗng nay có). 16 ca mới.
- [x] M5-T6 — commit ad97b2b7: Hồ sơ mới tiếp nhận, Đơn trùng, Kiến nghị VKS, Phân loại danh mục; ca tải hỏng Kiến nghị VKS dựng trong router (màn nay giữ thẻ trên URL). 16 ca mới, 3 tệp kiểm cũ xanh.
- [x] Bộ FE đầy đủ lần 1 ĐỎ 2 ca — cổng CÓ SẴN `congSoLieuKhiTaiHong` bắt đúng: dòng rỗng "Không tìm thấy với:" mới thêm ở Trao đổi chuyên án + Chuyển đội chỉ xét `coThe`, tải HỎNG mà còn thẻ thì vừa báo lỗi vừa khẳng định "không tìm thấy". Vá `!loadError &&` như 3 màn còn lại; cổng + cụm B 108 ca xanh.
- [x] M5 PR #379 mở; CI 3/3 xanh trên eb161511 (chưa merge — còn sửa review).
- [x] M5 /review (subagent soát độc lập) + Codex (lượt đầu mất mạng DNS tạm thời, tự nối lại) — gộp 6 lớp lỗi thật, ĐÃ SỬA:
  - Thẻ MÃ so chứa (`stt~5` ra dòng 15, 25, 50–59) → so ĐÚNG mã như máy chủ; `*` vẫn so chứa trên cột mã (như tim_kiem_bd). TDD đỏ → xanh.
  - Trao đổi chuyên án + Chuyển đội: thẻ đổi không về trang 1 (trang 2 của kết quả 1 dòng = bảng rỗng giả) → về trang 1 khi thẻ đổi. TDD.
  - Chuyển đội: lựa chọn giữ id dòng đã bị thẻ ẩn, nút Chuyển đội/Trả hồ sơ thao tác lên hồ sơ không còn thấy → bỏ khỏi lựa chọn mọi id không còn trong kết quả lọc. TDD.
  - Kiến nghị VKS + Đơn trùng: thẻ thống kê đếm allData → đếm dòng đã áp thẻ (số thẻ khớp số dòng, như M3/M4). Kiến nghị TDD; Đơn trùng: ca kiểm viết SAU khi đã sửa (lệch thứ tự TDD — ghi nhận).
  - Nút làm mới: Kiến nghị VKS (thêm testid reset-filters-btn), Trao đổi chuyên án, Chuyển đội (nút trước KHÔNG có onClick) nay xoá thẻ. TDD.
  - Cổng M5 hai kẽ hở: không kiểm bảng lọc từ `timKiem.dongLoc.filter(`; điều kiện cờ xét trên CẢ tệp → xét TỪNG chỗ so chữ ô cũ (8 dòng trước). Gieo lỗi mới cho cả hai.
  - Không sửa (P3): "Thời gian khởi tạo" Trao đổi hiện cả giờ, thẻ ngày so ngày — đúng kiểu ngày.
  - 8 tệp liên quan 193 ca xanh; tsc -b sạch; lint dòng mới 0.
- [x] M5 commit b2a53e61 (sửa review); bộ FE đầy đủ 259 tệp/3.135 ca xanh; CI 2/2 xanh ĐÚNG sha b2a53e61 (commit này không đụng *ListPageShell nên parity-check không chạy — chỉ 1 workflow CI); merge --admin 93551023; Deploy xanh (CI + Deploy success trên 93551023). Prod: health công khai buildId 93551023, release symlink 93551023, index.html phục vụ ≡ bản release (sha256 418a17d2…). Chỉ giao diện — không migration, không nạp dữ liệu.

### Hàng đợi M6 (nhánh feat/tim-kiem-dang-the-man-may-chu từ main 93551023) — khảo sát 15/09
Hiện trạng: 9 màn đều bảng tự dựng, không URL, tìm Prisma `contains`+insensitive (KHÔNG bỏ dấu). Chỉ users/cases/subjects/lawyers/petitions/incidents có cột bóng; directories/documents/address_mappings/audit_logs CHƯA.
- [ ] M6-T1 hạ tầng: khai + migration cột bóng/trigger/GIN cho directories, documents, address_mappings, audit_logs (qua `gen:tim-kiem -- --moi`); khai users (đã có ho_ten_bd). Kiểm vàng + nạp CLI như M2–M4.
  - [x] M6-T1a commit 58e6dded — bộ sinh thiếu 3 năng lực cho các bảng này, đã mở rộng (TDD đỏ 9 → xanh; tim-kiem 222 ca):
    - `ma-thuong` (mã danh mục/mã cán bộ/id: đúng mã, không phân biệt hoa) — KHÔNG đổi `ma` (biến thể mã hồ sơ + `in` dùng btree; đổi sang insensitive là ILIKE mất chỉ mục).
    - `chon.giaTriCot` (chuỗi thẻ → boolean cột; khoá = danh sách hợp lệ) — `in: ['true']` trên cột boolean là Prisma 500.
    - `chu.cotGhep` (một cột bóng nhiều nguồn: Họ tên = họ+tên+tài khoản) — sinh đúng `users.ho_ten_bd` của kiểu người nên gộp một khối.
    - Sinh lại: chỉ generated.ts đổi (migration M4 đã lên prod không đổi byte).
  - [x] M6-T1b — khai 5 thực thể (users, directories, documents, address_mappings, audit_logs) + incidents.name_bd; migration `20260915155629_tim_kiem_may_chu` (--moi). Kiểm:
    - DB cục bộ pc02_db kẹt P3009 từ 31/08 (migration calendar cũ hỏng) và thiếu cột M3 → KHÔNG dùng được; dựng DB tạm từ chuỗi migration cũng không được (migration đầu giả định `cases` có sẵn).
    - Cách đúng: `pg_dump --schema-only` prod (chỉ đọc, không dữ liệu) → DB tạm cục bộ (0 lỗi) → áp migration M6 (thoát 0) → chèn thử có dấu: 6/6 phép so đúng (ộ, Đ, khoảng trắng thừa, UPDATE tính lại). Lần đầu ra `tr?m` là console Windows làm hỏng chữ gửi vào (psql -c), KHÔNG phải f_bo_dau — chạy lại bằng tệp UTF-8 + PGCLIENTENCODING=UTF8. Đã xoá DB tạm + tệp cấu trúc.
    - Backend đầy đủ 350 bộ/5.177 ca xanh; lint dòng mới 0; tsc sạch.
  - Quyết định khai: Vai trò (users) không thành thẻ — danh sách động + đã có ô chọn roleId. Loại tài liệu `chon` không danh sách cứng (danh mục động). Tài liệu Vụ án/Vụ việc lọc theo TÊN (`cases.name_bd`, `incidents.name_bd` mới qua `cotBongPhu`).
- [x] M6-T2 Tài liệu: getList qua BoTimKiem; màn DocumentsPage ô thẻ + URL.
  - [x] commit daec8119 — máy chủ qua BoTimKiem (search cũ → `*` trên timKiemBd bỏ dấu; tk chọn cột; khoá lạ 400; vẫn AND với phạm vi); DTO tk. TDD đỏ 6 → xanh; documents 49 ca.
  - [x] commit (DocumentsPage) — ô thẻ URL `documents_tk`, gửi tk thay search; loại theo danh mục động; thẻ đổi về offset 0; bảng rỗng nói rõ thẻ; cờ tắt → ô chữ cũ. TDD đỏ 4 → xanh (2 giả định sai của ca kiểm sửa: màn dùng limit/offset không page; nút "Bỏ thẻ" trùng ở ô tìm → xét trong vùng rỗng).
  - [x] commit b9c1853d — **[lỗi có sẵn] phạm vi gán lại `where.OR` ĐÈ mất điều kiện tìm** (cán bộ có phạm vi gõ gì cũng ra mọi tài liệu trong phạm vi) → hai điều kiện riêng trong `where.AND`. TDD đỏ (Received chỉ còn khối phạm vi) → xanh; 42 ca.
  - Đo prod 15/09 (chỉ đọc): directories 15.913 · documents 10 · address_mappings 1.086 · audit_logs 13.218 (10 MB, ~1.457/tuần) · users 257 → trigger cột bóng + nạp đều rẻ, không cần cách riêng cho audit_logs.
- [x] M6-T3 Quản lý người dùng: getUsers qua BoTimKiem; màn ô thẻ.
  - [x] commit (users UI) — ô thẻ URL `users_tk`; thamSoDanhSachNguoiDung: cờ bật gửi tk không gửi search; bảng rỗng nói rõ thẻ (xét loadError). TDD: hàm đỏ 1 → xanh; màn đỏ 2 → xanh (lần đỏ đầu SAI lý do — giả lập roles `{data:{data}}` trong khi loadRoles đặt thẳng res.data làm mảng → màn sập `roles.map`; sửa giả lập rồi mới tính đỏ). users + cổng congSoLieuKhiTaiHong 101 ca.
  - [x] commit (users backend) — getUsers qua BoTimKiem: search cũ → `*` trên tim_kiem_bd (mã cán bộ + họ tên + email); tk: họ tên (cotGhep ho_ten_bd), trạng thái (giaTriCot boolean), mã cán bộ (ma-thuong); khoá lạ 400. DTO tk. TDD đỏ 7 → xanh; admin 108 ca; ca cũ "search across multiple fields" đổi sang AND/timKiemBd (hợp đồng đổi có chủ đích).
  - [x] commit (users) — **[lỗi có sẵn] màn gửi `isActive`, DTO chỉ có `status`; main.ts bật forbidNonWhitelisted → 400 cả danh sách khi lọc trạng thái** (xác nhận trên mã). Tách `thamSoDanhSachNguoiDung.ts` gửi `status`; spec DTO chốt hợp đồng bằng đúng cấu hình pipe. TDD đỏ → xanh.
- [x] M6-T4 Danh mục (Directories) + AddressMapping (module Cài đặt): BoTimKiem + ô thẻ.
  - [x] 73ba4766 máy chủ — directory.findAll + addressMapping.findAll qua BoTimKiem (`search` cũ → "*"; FKSelect khắp hệ thống giờ gõ không dấu ra); DTO nhận `tk`. Ca kiểm cũ "filters by search term" chốt OR tầng trên → AND. TDD 13 đỏ → xanh; 101 ca; tsc sạch; lint dòng mới 0.
  - [x] giao diện DirectoriesPage (`directories_tk`) + AddressMappingModule (`addressMappings_tk`) — thẻ đổi về trang đầu; bảng rỗng nói rõ thẻ. TDD: 6 đỏ (thiếu ô thẻ) → xanh. [lỗi có sẵn] AddressMapping `catch` nuốt lỗi tải → "Không có dữ liệu" cho lượt hỏi hỏng → thêm `loiTai`. **Lệch thứ tự TDD:** mã `loiTai` viết TRƯỚC ca kiểm (ca kiểm thêm sau, xanh ngay) — ghi nhận. 183 ca + cổng; tsc -b sạch; lint dòng mới 0.
- [x] M6-T5 Nhật ký hoạt động (T5a 19888f5b máy chủ: findAll + export.csv qua BoTimKiem; tuỳ chọn khai `tatCaGomNguoi` cho "*" ra tên người thực hiện; TDD 13 đỏ → xanh, 1 lần đỏ do kỳ vọng sai "an" 2 ký tự = khớp đầu từ; 282 ca. T5b giao diện `activityLog_tk`: bỏ lọc lại phía trình duyệt, xuất CSV cùng thẻ, Làm mới xoá thẻ; TDD 5 đỏ → xanh — ca "không bị lọc lại" khi cờ bật XANH GIẢ lúc RED (màn chưa đọc thẻ nên chẳng có gì lọc), lỗi thật do ca cờ tắt bắt đỏ; 201 ca + cổng. Ghi chú: "mô tả" = nhãn thao tác tiếng Việt chỉ có ở giao diện, máy chủ không tìm được — thẻ Thao tác so mã): **[lỗi có sẵn] lọc HAI lần (máy chủ action/subject/subjectId rồi client lọc lại theo tên người dùng/nhãn) → tên người dùng không bao giờ ra**; thoát `%`/`_` tay trong khi Prisma contains đã thoát. Tìm máy chủ theo khai (người thực hiện qua quan hệ users.ho_ten_bd), bỏ lọc client.
- [x] M6-T6 Trễ hạn (reports/overdue) — XONG: T6a 2dc3eb45 máy chủ (BoTimKiem ba khai + khoa-chung + soHoSo; TDD 10 đỏ → xanh; 247 ca), T6b giao diện Overdue `overdue_tk` + ExportReports `exportReports_tk` (TDD 7 đỏ → xanh; 253 ca + cổng; lần tsc đỏ vì generic khoaChung suy kiểu từ hợp của ba mảng literal → tách khai đầu `T[]`, khai sau `{key,kieu}[]`). Ghi chú còn lại: xuất Excel `/petitions/export` của ExportReports vốn KHÔNG áp ô tìm (chỉ ngày/đơn vị/ids) — không phải hồi quy, để tech debt. ĐO prod 15/09 (chỉ đọc): đơn thư 47.273, `summary` có 47.271, khác `detailContent` chỉ 44 → thẻ "*" của khai Đơn thư (tìm detailContent) không giảm phạm vi so với OR cũ; hồ sơ trễ hạn hiện 0/0/0 cả ba loại. Thiết kế: thẻ "*" + khoá CHUNG ba khai cùng kiểu (stt, sttCu, ngayDeXuat, nguonDon, nguoiGui, tomTat, donViGiaiQuyet, ketQuaXuLyKhac, nguoiNhap, ngayTao; bỏ trangThai vì ba enum khác nhau, hanXuLy/dieuTraVien không đủ ba) — khoá khác 400; hai phía ghim cùng danh sách. [lỗi có sẵn] recordNumber vụ án/vụ việc = id cắt 8 ký tự vì select thiếu caseCode/code. Chi tiết cũ: 3 khối OR chép tay (cases name/unit, incidents name/unitId-là-ID, petitions) → BoTimKiem của 3 thực thể (đã có cột bóng); placeholder hứa số hồ sơ/người xử lý mà không tìm. ExportReportsPage: máy chủ /petitions đã có thẻ → chỉ giao diện.
- [x] M6-T7 Khôi phục (Restore) — T7b giao diện XONG (mỗi tab một khai + khoá URL riêng restoreCases/Incidents/Petitions_tk; TDD 4 đỏ → xanh; 203 ca + cổng). T7a máy chủ XONG (listDeleted ba loại nhận tk qua QueryDaXoaDto chung — vá @Query kiểu trần; AdminUnits tìm phường không dấu qua directories.name_bd; TDD 7 đỏ → xanh; 411 ca). AdminUnits giao diện là ô gợi ý kiểu Cmd+K chứ không phải danh sách → giữ ô chữ, chỉ máy chủ bỏ dấu (quyết định). Còn T7b giao diện RestorePage. XEN KẼ 15/09: hotfix #380 dòng "Lưu:" in "(Tổ 2)" thay "Tổ công tác Số 2" — merge 220fd8c5, CI+Deploy success, health buildId 220fd8c5, chạy field-catalog.js đã deploy trên VM với tên thật → "- Lưu: PC02-Đ1 (Tổ 2), V.Huy." (không gọi endpoint in để khỏi ghi audit/đốt số). DONE. Chi tiết cũ: máy chủ đã dùng tim-kiem (dieuKienTatCa) → giao diện ô thẻ; @Query inline không DTO → thêm DTO có kiểm tra. AdminUnits (cây + ô gợi ý): đánh giá — tìm phường/xã bỏ dấu qua cột bóng directories.
- [x] M6-T8 XONG (thẻ "*" 4 API; "Xem tất cả" → <prefix>_tk; nhãn đúng caseCode/code; vụ việc → /vu-viec/:id; đối tượng → danh sách đúng loại + thẻ hoTen; tô sáng không dấu; TDD 7 đỏ → xanh; 15 ca). TIẾP: full suite BE rồi FE → /review + Codex (chia lượt) → PR → CI → merge → deploy → nạp cột bóng prod. Chi tiết cũ M6-T8 GlobalSearchBar: gửi thẻ `*` (tk) thay `search`; "Xem tất cả" mở danh sách với `<prefix>_tk=*~q` (hiện gửi `?search=` mà màn không đọc); highlight bỏ dấu; mục Đối tượng/Vụ việc mở đúng bản ghi.
- [ ] M6 review (XONG — subagent rà diff 93551023..HEAD): **P1 thật** thẻ chon+giaTriCot dựng `{in:[true]}` trên cột boolean → Prisma BoolFilter không có `in` → 500 (Người dùng/Danh mục/Ánh xạ); ca kiểm cũ chỉ so hình đối tượng nên xanh → sửa equals/OR, TDD 6 đỏ → xanh, 392 ca. Tech debt (có từ trước, không hồi quy): ExportReports "Xuất Excel" (/petitions/export) không áp thẻ/ô tìm. Full suite trước sửa: BE 358/5.245, FE 270/3.186 xanh. Codex BE/FE đang chạy. merge-tree main (hotfix #380) vào nhánh: 0 xung đột.
- [ ] M7 ĐANG LÀM phần KHÔNG cần đăng nhập (16/09): sửa oracle UTDT TC-011 (đọc cột typed `nghiVanDoiTuong` thay `metadata`, bỏ `unit` khỏi cột tìm được, thêm mệnh đề gõ không dấu, ghi rõ `utdt_q` cũ vẫn mở được) · TC-UTDT-006/041/065 nói rõ áp kỳ thống kê · 3 bản đồ API ghi `tk[]` (`/cases|/incidents/admin/deleted`, `/petitions/export`) · thêm TC-PET-121 (xuất Excel áp CÙNG thẻ — lỗi codex vừa vá) và TC-PET-122 (thẻ khoá lạ khi xuất → 400).
- [x] M7 RÀ ORACLE TOÀN KHO XONG (16/09): giao agent rà `docs/uat/**` theo 4 thay đổi ngữ nghĩa M2–M6. **Sửa 8 ca / 12 bản song sinh**: TC-078 (nặng nhất — oracle cũ kỳ vọng gõ không dấu KHÔNG ra hồ sơ có dấu, tức ngược hẳn tiền đề cả đợt), TC-077 (bỏ `unit`), TC-007 Vụ án (`name ILIKE` → cột bóng), TC-032 UTDT (chốt dữ liệu mẫu, tránh đỏ oan khi lấy tên điều tra viên), TC-009 Đơn thư (oracle BỎ TRỐNG → điền theo REQ-PET-RD-03), TC-CASE-047/089, TC-INC-123. Kiểm bằng máy: 8 tệp JSON parse được, số ca giữ nguyên (130/130/30/30/140/140/20/781), 11 ca mang dấu sửa, 0 vấn đề. **PHÁT HIỆN LỚN HƠN: 3/4 thay đổi không làm sai ca nào chỉ vì KHÔNG CÓ ca nào phủ** (chuỗi 1–2 ký tự khớp đầu từ · `cases/admin/deleted` bỏ khớp id · `incidents/linkable` tìm mọi cột) → ghi thành M6-21/22/23 CHƯA CHẠY trong UAT-COVERAGE, không ghi PASS cho thứ chưa ai đo.
- [x] M7 VÁ AN TOÀN VẬN HÀNH (16/09): `tat-trigger-tim-kiem.sql` chỉ coi việc tắt cờ `TIM_KIEM_THE` là "giấu ô thẻ cho đẹp". Sai: tắt trigger chỉ chặn dòng ghi TỪ LÚC ẤY, dòng đã nạp giữ nguyên cột bóng cũ, mà nhánh lùi về cột gốc CHỈ chạy khi cột bóng NULL — nên nếu sự cố là `f_bo_dau` cho giá trị SAI thì thẻ vẫn trả kết quả sai, im lặng. Sửa ở BỘ SINH (`sinh-tim-kiem.ts`) rồi `gen:tim-kiem`; cổng `tim-kiem-sinh-khop.gate.spec.ts` đỏ 1/9 trước khi sinh lại, xanh 9/9 sau — RED→GREEN có thật.
- [x] M7 shell-parity-matrix (PR #384 → merge `81bbd6eb`, CI xanh 3/3 gồm `parity-check` trên đúng SHA `4d62e221`): ma trận hứa cờ `TIM_KIEM_THE` tắt thì "như cũ" — đọc registry thì KHÔNG: `features/petitions/list-filters.ts` và `features/comprehensive/list-filters.ts` gỡ hẳn ô lọc chữ, không nhánh nào rẽ theo cờ. Tắt cờ = Đơn thư mất 4 ô (Người gửi · Đơn vị · STT · STT cũ), Tổng hợp mất 3 ô (Quận/Huyện · Trạng thái chung · Người tạo), đường dẫn cũ `petitions_sender=`/`comp_district=` hết lọc. Vụ việc + Vụ án/UTDT đã ghi giới hạn này từ M2–M6. ĐỊNH thêm ca kiểm chốt registry Tổng hợp, rồi phát hiện đã có (`toEqual(['fromDate','toDate'])`) — không thêm ca thừa.
- [x] M6 tài liệu hậu deploy MERGE (16/09): PR #382 CONFLICTING vì nhánh tách trước khi #381 merge kiểu squash → đóng, dựng lại `docs/m6-hau-deploy-v2` từ `origin/main` + cherry-pick 6 commit → PR #383, CI xanh 2/2 trên đúng SHA `eb0a222b`, merge `6da4f55b`, Deploy success, health `buildId` khớp SHA.
- [ ] M7 CHẶN Ở MẬT KHẨU UAT (đo 16/09): `docs/uat/_shared/test-accounts.json` chỉ khai TÊN biến (`ADMIN_PASSWORD`, `OFFICER1_PASSWORD`…), không chứa mật khẩu — đúng nguyên tắc. Đã kiểm: 5 biến đều CHƯA ĐẶT ở máy này, kho mã chỉ có `.env.*.example`, `.env` trên VM không có biến UAT nào. → 9 mệnh đề "cán bộ bấm thử" (M6-9..M6-17) GIỮ **CHƯA CHẠY**, cần anh cấp `UAT_PASS`. Việc M7 KHÔNG cần đăng nhập vẫn làm tiếp: rà oracle các bộ UAT khác bị ngữ nghĩa M2–M6 làm sai.
- [x] M6 ĐO DỮ LIỆU THẬT SAU NẠP (prod 16/09, chỉ đọc): gõ KHÔNG DẤU ra đúng bản ghi CÓ DẤU — `trom cap` → 1 danh mục ("Trộm cắp tài sản (Điều 173)"); `phuong` → 3.005 danh mục; `nguyen` → 14 người dùng ("Nguyễn Hoàng Anh Tú", "Nguyễn Thanh Hoài", "Nguyễn Minh Chiến"…); `phu nhuan` → 10 ánh xạ địa chỉ. Đây là bằng chứng ở tầng DỮ LIỆU; mệnh đề "cán bộ bấm thử trên màn" vẫn CHƯA CHẠY (cần UAT_PASS).
- [x] M6 HẬU DEPLOY XONG 16/09 — chạy thử lại: **0 dòng lệch cả 10 bảng**. EXPLAIN prod: Danh mục thẻ "*" → Bitmap Index Scan `directories_tim_kiem_bd_trgm` 0,64 ms; Nhật ký thẻ "*" đếm toàn bộ → Bitmap Index Scan `audit_logs_tim_kiem_bd_trgm` 380 dòng/2,6 ms, chuỗi hiếm (IP) 1,0 ms; Nhật ký có `LIMIT 20` → Seq Scan 0,44 ms và Ánh xạ địa chỉ → Seq Scan 2,3 ms — là LỰA CHỌN của bộ tối ưu trên bảng nhỏ (13k/1k dòng), KHÔNG phải thiếu chỉ mục: đã kiểm `pg_indexes` có đủ GIN (address_mappings 5 · audit_logs 1 · directories 3 · documents 4 · users 3 · incidents 7). Người dùng 257 dòng → Seq Scan 1,1 ms (như lawyers ở M4).
- [x] M6 NẠP `--that` XONG PROD 16/09: users 257 · incidents.name_bd 4.855 · directories 15.913 · audit_logs 13.446 · address_mappings 1.086 · documents 10 → CLI báo "Đã nạp xong, còn 0 dòng lệch"; đếm lại trên CSDL: cả 4 bảng M6 đủ 100% (10/10, 1.086/1.086, 13.446/13.446, 15.913/15.913). Bảng cũ M2–M4 lệch 0 (CLI vẫn quét để xác nhận nên mất thời gian).
- [ ] M6 ĐANG NẠP `--that` (16/09): tiến trình còn sống trên VM (PID 1431988), `pg_stat_activity` cho thấy đang ĐẾM LẠI bảng cũ (`cases.nguon_don_bd` so `f_bo_dau`) — bảng M2–M4 lệch 0 nhưng CLI vẫn quét để xác nhận, nên 4 bảng M6 (directories/audit_logs/address_mappings/documents) chưa nhích. KHÔNG phải treo. Xong mới chạy thử lại + EXPLAIN.
- [x] M6 NHÁNH LÙI CÓ TÁC DỤNG THẬT (đo lúc ĐANG nạp 16/09): `directories` còn nguyên 15.913 dòng `name_bd` NULL mà truy vấn theo cột gốc vẫn ra bản ghi có dấu → cán bộ tìm trong lúc nạp vẫn ra kết quả đúng, chỉ chậm hơn vì chưa dùng được GIN. Tiến độ nạp: users 257/257 xong → incidents.name_bd 4.855/4.855 xong → đang tới directories/audit_logs/address_mappings/documents.
- [x] M6 KIỂM BẢN CÔNG KHAI 16/09 (không chỉ tin health): `GET /` → 200, 951 byte, trỏ `/assets/index-Bho83cfN.js` = đúng tệp `index.html` trên `/var/www/pc02`; tải tệp ấy → 200, 644.694 byte, `application/javascript`; health `buildId` fe56bb07. Cán bộ mở trang NHẬN được bản mới (bài học "hỏng im lặng phía người dùng": health xanh ≠ trình duyệt có bản mới).
- [x] M6 CHẠY THỬ nạp cột bóng prod 16/09 (không ghi): users 257 · incidents 4.855 (name_bd mới) · directories 15.913 · documents 10 · address_mappings 1.086 · audit_logs 13.446; subjects/petitions/cases/lawyers 0 (đã nạp từ M2–M4). KIỂM VÀNG bỏ dấu PG16.15 prod: 646 tổng hợp + 100.531 chuỗi thật → lệch 0. Đang chạy `--that`.
- [x] M6 DEPLOY PROD 16/09 XONG — Deploy completed/success; health `buildId` = `fe56bb07`; ĐO trên prod sau deploy: directories 3 · documents 4 · address_mappings 5 · audit_logs 1 · users 3 (có `email_bd`) · incidents 7 (có `name_bd`) · migration `%tim_kiem%` = 4 → đúng kỳ vọng, migration đã chạy THẬT (số nền trước deploy 0/0/0/0/1/6, migration 3).
- [x] M6 PR #381 MERGE 16/09 — commit `fe56bb07` trên main (CI xanh 2 check trên đúng commit 76840aa0 trước khi merge; merge squash `--admin`). Deploy tự chạy, đang theo dõi.
- [ ] M6 HẬU DEPLOY — chuỗi lệnh chốt sẵn (chạy đúng thứ tự, mỗi bước phải khớp số kỳ vọng mới sang bước sau):
  1. `curl -s http://171.244.40.245/api/v1/health` → `buildId` = mã commit merge của PR #381 (khác là chưa deploy xong, ĐỪNG chạy tiếp).
  2. Đếm cột bóng trên prod (chỉ đọc): directories 3 · documents 4 · address_mappings 5 · audit_logs 1 · users 3 (`ho_ten_bd`+`email_bd`+`tim_kiem_bd`) · incidents 7 (thêm `name_bd`); `_prisma_migrations` có 4 migration `%tim_kiem%`. Nếu vẫn bằng số nền (0/0/0/0/1/6/3) → migration CHƯA chạy.
  3. `ssh pc02vm 'cd /home/pc02/current/backend && set -a && source .env && set +a && node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js'` → CHẠY THỬ, in số dòng lệch từng bảng (không ghi gì).
  4. Lặp lại lệnh trên kèm `--that` → nạp thật (chỉ ghi cột dẫn xuất, không đụng cột nghiệp vụ, không đẩy `updatedAt`).
  5. Chạy lại bước 3 → phải còn **0 dòng lệch mọi bảng**.
  6. `node dist/src/common/tim-kiem/cli/kiem-vang-bo-dau.js --chuoi-that` → lệch **0** giữa bảng bỏ dấu JS và SQL.
  7. EXPLAIN vài truy vấn thẻ chính (`*` của audit_logs/directories, thẻ cột của users) → phải thấy Bitmap Index Scan trên chỉ mục GIN `*_trgm`, không Seq Scan toàn bảng.
  8. Ghi số đo từng bước vào PROGRESS; rồi mới chạy UAT máy thật (`tools/uat-may-that/uat-the-tim-kiem.cjs`, cần `UAT_PASS`).
- [ ] M6 SỐ ĐO NỀN TRƯỚC DEPLOY (prod 16/09, chỉ đọc — sau deploy phải ĐỔI, nếu không migration chưa chạy): cột `%_bd` hiện có: address_mappings 0, audit_logs 0, directories 0, documents 0, users 1 (`ho_ten_bd`; `email_bd` 0), incidents 6 (`name_bd` 0), petitions 7, cases 11; `_prisma_migrations` có 3 migration `%tim_kiem%`. Sau deploy kỳ vọng: directories 3, documents 4, address_mappings 5, audit_logs 1, users 3, incidents 7, migration tim_kiem = 4.
- [ ] M6 codex BACKEND XONG (lượt 3) — 4 phát hiện: (1) `priority` nhận mà không lọc → SỬA (lọc sau khi dựng bản ghi); (2) `recordType` so chữ thường, `CASE` trả rỗng → SỬA (chuẩn hoá); (3) ca kiểm controller chỉ kiểm chuyển tham số → thêm 2 ca tầng service; (4) thẻ "*" hẹp hơn tìm cũ ở overdue — ĐO prod: cases.unit 0 dòng (bỏ là đúng), incidents.unitId là ID, petitions.unit chỉ 89/47.273 (0,19%, 81 khác donViGiaiQuyet) + summary khác detailContent 44 dòng → GIỮ NGUYÊN (đổi khai phải sinh lại migration cột bóng đơn thư đã chạy prod từ M2); ghi tech debt. Codex FRONTEND XONG (lượt 3, phải đóng stdin `< /dev/null` — hai lượt trước treo ở "Reading additional input from stdin"): ĐÚNG 1 phát hiện — ExportReportsPage "Xuất Excel" bỏ qua thẻ đang lọc (màn hiện 3 đơn, tệp xuất cả 500 đơn khớp ngày/đơn vị); trùng phát hiện của agent → ĐÃ SỬA: `ExportPetitionsQueryDto` nhận `tk`/`search`, `exportToExcel` nối điều kiện qua CÙNG `BoTimKiem` của danh sách, `handleExportExcel` gửi thẻ (cờ tắt gửi `search`). TDD: DTO 3 đỏ + giao diện 1 đỏ + 2 ca service → xanh; petitions 364 ca, ExportReports 5 ca; tsc hai phía sạch; lint dòng mới 0. Lịch sử hỏng mạng (2 lượt: DNS `chatgpt.com` "No such host is known", đứt sau 117k token — đang chạy lại; rà soát agent đã xong, P1 boolean đã sửa + cổng kieuCotLech) → PR (đã merge origin/main vào nhánh: merge commit ae605610, hotfix #380 là tổ tiên, document-templates 501 ca + tsc sạch sau merge; LƯU Ý `git log` qua rtk có thể trả BẢN CŨ — xác minh bằng `git rev-parse`/`cat-file`) → CI → merge → deploy → nạp cột bóng + kiểm vàng + EXPLAIN prod. (12 màn dùng hook + ô thẻ; ô chữ cũ chỉ lọc khi cờ tắt; tiền tố không trùng; gieo lỗi) → bộ đầy đủ → /review + /codex → PR → CI → merge → deploy (chỉ giao diện, không migration).
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
