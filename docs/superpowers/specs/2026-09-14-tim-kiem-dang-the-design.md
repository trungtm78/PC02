# Ô tìm kiếm dạng thẻ (kiểu Odoo) trên MỌI màn danh sách

Đặc tả ô "Loại thông tin" đã xong riêng: `docs/superpowers/specs/2026-09-14-loai-thong-tin-design.md`
(nhánh `feat/loai-thong-tin-smart-select`). Kế hoạch này là đợt TÌM KIẾM. Đã qua `/plan-eng-review` (báo cáo cuối tệp).

## Context

Ô tìm kiếm ngoài của các màn danh sách chỉ nhận MỘT chuỗi (`<prefix>_q` → API `search`), máy chủ so chuỗi
ấy với vài trường cố định chép tay ở từng module — không khớp cột đang hiển thị (Đơn thư hiện "Tóm tắt" =
`detailContent` nhưng tìm `summary`; "Đơn vị giải quyết" không tìm được; Vụ án tìm `unit` rỗng 100%), không
bỏ dấu, không chọn được cột. OR tìm kiếm còn bị chép sang getStats/listLinkable/listDeleted và đã trôi
(`getUtdtStats` thiếu caseCode/soHoSoCu/sttCu).

Anh yêu cầu (14/09/2026): tìm trên TẤT CẢ các cột; chỉ định được cột như ô tìm kiếm tree view Odoo; gõ không
dấu vẫn ra; mọi quyết định chọn theo quản trị sâu nhất + mở rộng tốt nhất, KHÔNG giảm phạm vi, được tăng phạm vi.

## Hành vi (Odoo search view + GitHub/Linear filter bar, chỉnh cho "tìm mọi cột")

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [Người gửi: Nguyễn hoặc Trần ×] [Trạng thái: Đang xử lý ×] nguyen van|   │
 └──────────────────────────────────────────────────────────────────────────┘
   ▸ Tìm trong tất cả các cột: "nguyen van"          ← Enter mặc định
     Tìm Số tiếp nhận: "nguyen van"
     Tìm Người gửi: "nguyen van"
     Tìm Tóm tắt nội dung: "nguyen van"
   ▸ Trạng thái ▸   (mở danh sách giá trị khớp — chọn đúng 1)
     Tìm Ngày đề xuất: (gõ 12/09/2026 · 09/2026 · 2026)
```

- Gợi ý = cột ĐANG HIỂN THỊ (`useBoCucCot`) có khai tìm được, đúng thứ tự cột; cột ẩn không hiện.
- ↑/↓ chọn · Enter chọn · Tab/→ mở danh sách giá trị · Esc đóng · `/` hoặc Ctrl+K đặt con trỏ vào ô.
- Chọn xong → thẻ. **Cùng cột → OR, gộp một thẻ "a hoặc b". Khác cột → AND.** Bấm thẻ sửa giá trị;
  × xoá; Backspace khi ô trống xoá thẻ cuối; "Xóa lọc" xoá hết.
- Kiểu so khớp: chữ = chứa, không dấu, không hoa thường, không phân biệt khoảng trắng thừa/NBSP; mã hồ sơ = đúng biến thể
  (`hoSoCodeVariants`, `dieuKienSttCu`); ngày = ngày/tháng/năm → khoảng trên CỘT NGÀY THẬT (múi giờ Asia/Ho_Chi_Minh);
  chọn-giá-trị (trạng thái, người nhập, tổ) = so đúng mã/id.
- Chữ 1–2 ký tự: khớp **đầu từ bất kỳ** ("An" ra "Nguyễn Văn An") + gợi ý "gõ từ 3 ký tự để tìm trong nội dung".
- Gõ tiếng Việt: dùng lại `useOChuDongBo`; Enter khi `isComposing`/keyCode 229 KHÔNG chọn dòng.
- Thẻ nằm trong URL → lùi trang / chia sẻ đường dẫn giữ nguyên; đường dẫn cũ `?<prefix>_q=` và khoá lọc chữ cũ vẫn mở thành thẻ.
- Khoá thẻ không hợp lệ (cột đổi tên, đường dẫn cũ) → hiện thẻ đỏ "Cột không còn tìm được", KHÔNG âm thầm bỏ qua.
- Không có kết quả: "Không tìm thấy với: <các thẻ>" + nút xoá từng thẻ.

## Kiến trúc (chốt sau review)

```
 MỘT tệp khai trường / thực thể  (backend/src/common/tim-kiem/khai/<thuc-the>.khai.ts)
          │  npm run gen:tim-kiem  (bộ sinh — giống gen:enums)
          ├──► migration SQL: cột <cot>_bd + GIN trigram + trigger BEFORE INSERT/UPDATE OF <cột nguồn>
          ├──► schema.prisma: field chỉ đọc  <cot>Bd String? @map("<cot>_bd")
          ├──► frontend/src/shared/tim-kiem/generated.ts: khoá · nhãn · kiểu (registry giao diện đọc)
          └──► gate: khai ≡ migration ≡ prisma ≡ generated (lệch là đỏ)

 Giao diện                            Máy chủ                                    CSDL
 OTimKiemThe ─thẻ─► useTheTimKiem ─URL tk[]─► DTO (@Transform chuỗi→mảng, whitelist, ≤20, ≤200)
                                                 │ docThe(): khoá lạ → 400
                                                 ▼
                                   dungDieuKienTimKiem() → mảng điều kiện
                                                 ▼
                              where.AND = [scope, ...điều kiện thẻ]        petitions.sender_name_bd LIKE '%x%'  (GIN)
                                                                            users.ho_ten_bd (quan hệ người nhập)
```

### 1. CSDL — cột bỏ dấu trên CHÍNH bảng hồ sơ (thay EAV/jsonb)
- `CREATE EXTENSION IF NOT EXISTS unaccent;` (trusted; bước T0 kiểm `pg_available_extensions` trên prod).
- `f_bo_dau(text) RETURNS text IMMUTABLE PARALLEL SAFE SET search_path = public`:
  `btrim(regexp_replace(replace(lower(public.unaccent('public.unaccent'::regdictionary, coalesce($1,''))), E' ', ' '), '\s+', ' ', 'g'))`
  — khớp `boDauTiengViet` (`common/utils/chuan-hoa-ten.util.ts:13`, gộp khoảng trắng + trim).
- Mỗi cột chữ tìm được có cột bóng `<cot>_bd` = `' ' || f_bo_dau(<cot>)` (khoảng trắng đầu để khớp đầu từ bằng `contains ' ' || x`)
  + GIN `gin_trgm_ops`. Mỗi thực thể thêm `tim_kiem_bd` = ghép mọi cột bóng (thẻ "tất cả các cột").
- Trigger `BEFORE INSERT OR UPDATE OF <danh sách cột nguồn>` (tiền lệ `stt_sort/migration.sql:65`) — chỉ chạy khi cột
  nguồn đổi, không khuếch đại ghi, không deadlock chéo. Thân hàm bọc `EXCEPTION WHEN OTHERS` → để cột bóng NULL +
  `RAISE WARNING`, KHÔNG chặn thao tác ghi nghiệp vụ.
- Quan hệ tên người (người nhập, điều tra viên, cán bộ đề xuất): cột bóng `ho_ten_bd` trên `users`, thẻ dùng
  `enteredBy: { is: { hoTenBd: { contains } } }` — không trigger lan truyền khi đổi tên. Tổ/trạng thái = so id/mã.
- Migration điền luôn cột bóng (`UPDATE … SET <cot>_bd = …` theo cột bóng, không kích trigger nghiệp vụ): 47k dòng mất vài giây → không cần CLI nạp.
- Hotfix sẵn: `docs/van-hanh/tat-trigger-tim-kiem.sql` (`DROP TRIGGER` + ghi chú) — không chờ deploy.
- Ngày KHÔNG đưa vào cột bóng — tìm ngày luôn là khoảng trên cột ngày thật (hết lệch múi giờ).

### 2. Máy chủ — `backend/src/common/tim-kiem/`
- `khai/*.khai.ts`: `TruongTimKiem = { key, nhan, kieu: 'chu'|'ma'|'ngay'|'chon'|'nguoi'|'to', cot, cotBd? }` — nguồn duy nhất.
- **Khoá chuẩn liên thực thể** (`stt`, `sttCu`, `ngayDeXuat`, `nguoiGui`, `tomTat`, `donViGiaiQuyet`, `trangThai`, `nguoiNhap`, `to`…).
- `doc-the.ts` `docThe(tk, khai)`: tách `khoá~giá trị`; **khoá lạ → `BadRequestException` (400)**; gộp cùng khoá; `*` = mọi cột; giá trị rỗng bỏ.
- `dieu-kien.ts` `dungDieuKienTimKiem(the, khai)` → mảng điều kiện nối `where.AND`; không bao giờ trả khoá top-level
  `OR`/`case`/`investigator`/`assignedTeam` (subjects.service.ts:79 và lawyers.service.ts GÁN `where.case = scope`):
  - chữ ≥3: `{ [cotBd]: { contains: boDau(v) } }` (KHÔNG `mode: 'insensitive'`); 1–2: `{ contains: ' ' + boDau(v) }`
  - `*`: `{ timKiemBd: { contains } }`; mã: `hoSoCodeVariants`/`dieuKienSttCu`; ngày: `docKhoangNgay` (+07:00) → `{ gte, lt }`;
    chọn/tổ: `{ in }`; người: `{ [quanHe]: { is: { hoTenBd: { contains } } } }`
  - nhiều giá trị cùng khoá → `{ OR: [...] }` bên TRONG phần tử AND.
- Mọi đường đọc: `getList`, `getStats`, `getUtdtStats`, `listDeleted`, `listLinkable`, `duplicateSearch` gọi CÙNG helper; gỡ `where.OR` chép tay
  (đã kiểm: 5 module không có `$queryRaw` ở đường đọc).
- DTO list + stats: `tk?: string[]` với `@Transform` (một giá trị → mảng), `@ArrayMaxSize(20) @IsString({each}) @MaxLength(200,{each})`;
  `search` cũ → thẻ `*`. Tham số lọc chữ cũ (`senderName`, `unit`, `charges`, `reporter`, `investigatorName`) quy về thẻ ở máy chủ
  một chỗ (không áp hai lần).
- Danh sách giá trị cho cột chọn (người nhập, tổ) lấy qua endpoint ĐÃ lọc phạm vi (`useOfficerOptions`/`useTeamOptions` kiểm lại scope).
- Giữ cổng: `cot-danh-sach-phai-duoc-tra-ve.gate.spec.ts` (không đổi tên `async getList(`), `o-form-va-cot-danh-sach-phai-trung-cot`,
  `sap-xep-theo-stt`; sửa unit spec đang kỳ vọng `where.OR` top-level.

### 3. Giao diện — mở rộng primitive, không dựng hệ thứ hai
- **Registry bộ lọc là nguồn duy nhất** (`features/_shared/list-filters/registry.ts`), đọc khoá/nhãn/kiểu từ `shared/tim-kiem/generated.ts`.
  Ô lọc CHỮ hiện có (sender, stt, sttCu, unit, reporter, charges, investigator) thành thẻ; panel "Bộ lọc" còn ngày/khoảng/chọn
  (tiền lệ #233: hai bộ lọc song song → hai ô "Từ ngày" lệch nhau).
- `ColumnDef` (`Table.tsx:61`) thêm `timKiemKey?: string`; gợi ý = `visibleColumns ∩ khoá có trong generated`.
- `components/shared/ListPageShell/OTimKiemThe.tsx` thay input `Toolbar.tsx:115`: listbox/aria theo `GlobalSearchBar.tsx:272-420`,
  dropdown `ActionMenuPortal.tsx`, draft IME `useOChuDongBo.ts`, token pill `Toolbar.tsx:88`.
- `useTheTimKiem(url, registry)`: đọc/ghi `<prefix>_tk`; tương thích `<prefix>_q` + khoá lọc chữ cũ; mọi thay đổi xoá `<prefix>_page`.
- `docs/audit/shell-parity-matrix.md` cập nhật trong MỖI PR sửa `*ListPageShell.tsx` (CI shell-parity-gate).
- Tăng phạm vi: vá `GlobalSearchBar.tsx:272` thiếu kiểm `isComposing`.
- Cờ tính năng `TIM_KIEM_THE` (`feature_flags` + `@FeatureFlag`) chỉ để bật dần GIAO DIỆN theo màn và tắt tức thì; máy chủ luôn nhận cả `search` lẫn `tk`.

### 4. Thứ tự (mỗi đợt một PR)
0. **T0 — thử nghiệm đo trước khi xây** (không PR): trên `pc02_that` tạo `f_bo_dau` + 2 cột bóng Đơn thư + GIN; `EXPLAIN ANALYZE`
   câu Prisma sinh ra cho `contains` (≥3, 1–2 ký tự có khoảng trắng đầu, `*`), kiểm Prisma thoát `%`/`_`, đo count+findMany+groupBy.
   Kiểm `unaccent` trên prod. Kết quả ghi vào PR1.
1. **PR1 — nền + Đơn thư + lát mỏng Tổng hợp**: bộ sinh + migration + helper + DTO + gate + component + hook + registry;
   Đơn thư đầy đủ; Tổng hợp gửi thẻ `*` + `nguoiGui` tới 3 API (chứng minh khoá chuẩn ngay đợt đầu; vá prefix `comprehensive`≠`comp`).
2. **PR2 — Vụ việc, Vụ án, Ủy thác điều tra** (vá stats UTDT thiếu `caseStatus`).
3. **PR3 — Tổng hợp đầy đủ, Đối tượng (3 route), Luật sư** (scope Đối tượng/Luật sư đưa vào AND).
4. **PR4 — 12 màn tìm phía trình duyệt** (classification/*, workflow/*, WardPetitions, InitialCases, MasterClass): cùng component +
   `locTheoThe(rows, the, khai)`; gom `removeVietnameseDiacritics` (`FKSelect.tsx:19`) về `lib/bo-dau.ts`, cùng ca kiểm vàng với máy chủ.
5. **PR5 — 9 màn tìm phía máy chủ** (Users, Directories, Documents, Export/Overdue, Restore, AdminUnits, AddressMapping, ActivityLog) + GlobalSearchBar dùng thẻ `*`.

## Đã có sẵn — tái dùng
| Có sẵn | Dùng thế nào |
|---|---|
| `boDauTiengViet` `common/utils/chuan-hoa-ten.util.ts:13` | bỏ dấu phía ứng dụng (ca kiểm vàng ≡ `f_bo_dau`) |
| `hoSoCodeVariants`, `dieuKienSttCu` | khớp mã hồ sơ |
| `buildListOrderBy` `common/utils/list-sort.util.ts:45` | mẫu whitelist + alias |
| `buildScopeFilter`/`buildPetitionScopeFilter` | giữ nguyên, thẻ nối AND |
| `pg_trgm` (đã cài), GIN trigram `petitions.senderName`, trigger `stt_sort` | cùng mẫu chỉ mục + trigger `UPDATE OF` |
| `gen:enums` (bộ sinh schema → frontend) | mẫu cho `gen:tim-kiem` |
| registry + `useListFilters` + `useListPageUrlState` | nguồn khoá + URL |
| `useBoCucCot`, `ColumnPicker` | cột đang hiển thị |
| `GlobalSearchBar` (listbox/aria), `ActionMenuPortal`, `useOChuDongBo` | UI + IME |
| `feature_flags` + `@FeatureFlag` | bật/tắt giao diện không deploy |

## NOT in scope
- Elasticsearch/Meilisearch — 56k hồ sơ, PostgreSQL + pg_trgm đủ; thêm hạ tầng là thêm điểm hỏng.
- Bộ lọc yêu thích (Odoo Favorites) — cần bảng + chia sẻ theo tài khoản; TODO riêng.
- Nhóm theo (Group By) — bảng chưa có chế độ nhóm; TODO riêng.
- Tìm trong tệp đính kèm / nội dung Word.
- Toán tử nâng cao kiểu JQL (`!=`, `>`, cú pháp gõ tay) — thẻ đủ cho cán bộ; TODO nếu có yêu cầu.

## Kiểm (bao phủ mọi nhánh)
```
CODE PATHS                                                   USER FLOWS
[+] gen:tim-kiem                                             [+] Đơn thư: gõ không dấu → Enter
  ├── sinh migration/prisma/generated khớp khai [unit]         ├── [→E2E] thẻ "*" ra hồ sơ "Nguyễn…"
  └── gate lệch khai↔migration↔prisma↔generated → đỏ           ├── [→E2E] chọn cột Người gửi, thêm lần 2 → "hoặc"
[+] f_bo_dau (PG18 pc02_that)                                  ├── [→E2E] thẻ khác cột → thu hẹp; thẻ thống kê = số dòng
  ├── "Nguyễn Văn Á"→" nguyen van a", "ĐỖ"→"do", NULL          ├── Backspace / × / Xóa lọc / bấm thẻ sửa
  ├── NBSP, 2 khoảng trắng, tab, NFD vs NFC                    ├── ẩn cột bằng ColumnPicker → biến khỏi gợi ý
  └── ≡ boDauTiengViet trên 1.000 chuỗi thật [vàng]            ├── [→E2E] lùi trang / dán đường dẫn giữ thẻ
[+] trigger BEFORE UPDATE OF                                   └── đường dẫn cũ ?petitions_q=abc → thẻ
  ├── cột nguồn đổi → cột bóng đổi; cột khác đổi → không chạy  [+] Gõ tiếng Việt [→E2E Chrome thật]
  ├── lỗi trong thân hàm → ghi nghiệp vụ VẪN thành công        ├── gõ nhanh / Unikey / IME Telex
  └── migration cộng thêm cột nguồn/đổi tên → ca kiểm INSERT+   └── Enter lúc isComposing không tạo thẻ
      UPDATE một dòng thật sau `migrate deploy` (chống 500)    [+] Trạng thái rỗng / biên
[+] docThe: khoá lạ → 400 · gộp OR · 21 thẻ → 400 · rỗng ·       ├── không kết quả → hiện thẻ đang áp
    chuỗi đơn → mảng · `~` trong giá trị · `%`/`_` là chữ         ├── 1–2 ký tự → khớp đầu từ + gợi ý
[+] dungDieuKienTimKiem: AND/OR đúng · ≥3 vs 1–2 ký tự ·        ├── giá trị 200 ký tự
    ngày ngày/tháng/năm/rác/múi giờ · không khoá top-level       └── thẻ đỏ khi khoá không còn
    OR/case/investigator (ca kiểm cấu trúc + gieo lỗi)         [+] Phạm vi [→E2E]
[+] DTO @Transform + tham số cũ quy về thẻ, không áp 2 lần      ├── OFFICER tìm "*" không ra hồ sơ ngoài tổ (7 màn)
[+] Tổng hợp: 3 API cùng thẻ; khoá không hỗ trợ → 400, không    ├── Đối tượng/Luật sư: thẻ case.* không đè scope
    trả toàn bộ                                                 └── danh sách giá trị người/tổ đã lọc phạm vi
[+] Cờ TIM_KIEM_THE tắt → ô cũ, API cũ                         [+] Hiệu năng: EXPLAIN ANALYZE dùng GIN, < 300 ms
[+] Gieo lỗi: bỏ whitelist · trả where.OR · gỡ f_bo_dau · lệch gate · trigger thiếu cột → đỏ
```
Tệp kế hoạch QA: `~/.gstack/projects/trungtm78-PC02/Than Minh Trung-feat-loai-thong-tin-smart-select-eng-review-test-plan-20260914-223227.md`.

## Failure modes
| Đường mới | Hỏng thế nào | Ca kiểm | Xử lý | Người dùng thấy |
|---|---|---|---|---|
| migration unaccent | prod thiếu contrib | T0 kiểm trước | migration dừng, symlink chưa đổi | không ảnh hưởng |
| trigger | cột nguồn đổi tên → lỗi | INSERT/UPDATE sau migrate | EXCEPTION → cột bóng NULL + WARNING; hotfix SQL | ghi vẫn được; thẻ cột ấy thiếu kết quả |
| gen:tim-kiem | khai quên chạy bộ sinh | gate 4 chiều | CI đỏ | — |
| Tổng hợp | khoá không hỗ trợ ở 1 API | ca kiểm 400 | 400 → thẻ đỏ | thấy rõ, không lẫn dữ liệu chưa lọc |
| 1–2 ký tự | quét lớn | EXPLAIN T0 | khoảng trắng đầu → trigram dùng được | gợi ý gõ ≥3 |
| scope quan hệ | đè `where.case` | ca kiểm + gieo lỗi | chỉ AND | (critical — đã có ca kiểm) |
| múi giờ ngày | lệch 1 ngày 00–07h | ca kiểm +07:00 | khoảng trên cột thật | — |
Critical gaps: 0 (mọi đường có ca kiểm + xử lý + người dùng thấy rõ).

## Song song hoá
| Bước | Mô-đun | Phụ thuộc |
|---|---|---|
| A. bộ sinh + migration + f_bo_dau | backend/prisma, backend/src/common/tim-kiem/khai | T0 |
| B. helper + DTO + gate | backend/src/common/tim-kiem, backend/src/petitions | A |
| C. component + hook + registry | frontend/src/components/shared, frontend/src/features/_shared | A (generated.ts) |
| D. nối Đơn thư + lát Tổng hợp | frontend/src/pages/petitions, pages/cases | B, C |
Lane 1: T0 → A → B · Lane 2: C (sau A) song song B · rồi D. PR2–PR5 tuần tự sau PR1 (cùng chạm helper/registry).

## Implementation Tasks
- [ ] **T0 (P1, human: ~4h / CC: ~20m)** — db — Đo trước: EXPLAIN Prisma contains trên cột bóng, thoát `%`/`_`, unaccent trên prod
  - Surfaced by: Outside voice #7, Performance — trigram < 3 ký tự · Files: (spike trên pc02_that) · Verify: EXPLAIN dùng GIN
- [ ] **T1 (P1, human: ~2d / CC: ~1h)** — db — Cột bóng `_bd` + `f_bo_dau` IMMUTABLE schema-qualified + trigger BEFORE UPDATE OF có EXCEPTION
  - Surfaced by: Architecture (jsonb không dùng chỉ mục) + Outside voice #1 #4 #12 #14 · Files: backend/prisma/schema.prisma, backend/prisma/migrations · Verify: ca kiểm trigger PG18
- [ ] **T2 (P1, human: ~1d / CC: ~40m)** — tooling — Bộ sinh `gen:tim-kiem` từ tệp khai + gate 4 chiều
  - Surfaced by: Code quality (hai chiều một quy ước) · Files: backend/src/common/tim-kiem/khai, backend/scripts · Verify: gieo lệch → đỏ
- [ ] **T3 (P1, human: ~2d / CC: ~1h)** — backend — Helper docThe (khoá lạ 400) + dungDieuKienTimKiem (chỉ AND) + DTO @Transform; gỡ where.OR chép tay
  - Surfaced by: Code quality DRY + Outside voice #3 #13 · Files: backend/src/common/tim-kiem, *.service.ts, dto/query-*.dto.ts · Verify: jest + gieo lỗi
- [ ] **T4 (P1, human: ~3h / CC: ~15m)** — backend — `f_bo_dau` ≡ `boDauTiengViet` ca kiểm vàng (NBSP, khoảng trắng, NFD, đ)
  - Surfaced by: Outside voice #5 · Files: backend/src/common/utils/chuan-hoa-ten.util.ts · Verify: 1.000 chuỗi thật khớp 100%
- [ ] **T5 (P1, human: ~2d / CC: ~1h)** — frontend — Registry nguồn duy nhất + ô lọc chữ thành thẻ
  - Surfaced by: Architecture (tiền lệ #233) · Files: frontend/src/features/_shared/list-filters/registry.ts, features/*/list-filters.ts · Verify: vitest
- [ ] **T6 (P1, human: ~3d / CC: ~2h)** — frontend — OTimKiemThe + useTheTimKiem (URL, tương thích, IME, thẻ đỏ, trạng thái rỗng)
  - Surfaced by: Architecture · Files: frontend/src/components/shared/ListPageShell/ · Verify: vitest + Playwright Chrome thật
- [ ] **T7 (P1, human: ~1d / CC: ~30m)** — backend — Scope: thẻ quan hệ chỉ AND; danh sách giá trị người/tổ lọc phạm vi
  - Surfaced by: Outside voice #11, learning subjects-lawyers-gan-where-case-scope · Files: subjects.service.ts, lawyers.service.ts · Verify: E2E OFFICER
- [ ] **T8 (P2, human: ~4h / CC: ~20m)** — frontend — Lát mỏng Tổng hợp trong PR1 + vá prefix comprehensive≠comp
  - Surfaced by: Outside voice #15 · Files: frontend/src/pages/cases/ComprehensiveListPageShell.tsx · Verify: 3 API cùng thẻ
- [ ] **T9 (P2, human: ~2h / CC: ~10m)** — ops — Hotfix `tat-trigger-tim-kiem.sql` + ghi chú deploy (migrate chạy ở deploy.sh:112 và docker-entrypoint.sh:5)
  - Surfaced by: Outside voice #10 · Files: docs/van-hanh/ · Verify: chạy thử trên pc02_that
- [ ] **T10 (P2, human: ~2h / CC: ~10m)** — frontend — GlobalSearchBar thêm kiểm isComposing
  - Surfaced by: Code quality · Files: frontend/src/components/GlobalSearchBar.tsx:272 · Verify: vitest compositionStart
- [ ] **T11 (P2, human: ~1h / CC: ~5m)** — process — shell-parity-matrix mỗi PR sửa ListPageShell
  - Surfaced by: learning shell-parity-gate-listpageshell · Files: docs/audit/shell-parity-matrix.md · Verify: CI xanh

## Quyết định đã chốt (anh uỷ quyền 14/09/2026 — "quản trị sâu nhất, mở rộng tốt nhất, không giảm phạm vi")
| # | Vấn đề | Chốt |
|---|---|---|
| S0 | Kế hoạch chạm >8 tệp, >2 thành phần mới | Giữ nguyên phạm vi (anh cấm giảm) |
| 1A | jsonb `string_contains` không dùng chỉ mục | Cột bóng `_bd` trên bảng + GIN |
| 1B | Có nguy cơ dựng hệ lọc thứ hai | Registry là nguồn duy nhất, lọc chữ thành thẻ |
| 1C | Khoá thẻ không hỗ trợ bị âm thầm bỏ | 400 + thẻ đỏ |
| 2A | OR tìm kiếm chép 4+ nơi | Một helper cho mọi đường đọc |
| 2B | Khai trường ở 3 nơi (SQL/TS/giao diện) | Bộ sinh từ một tệp + gate 4 chiều |
| 2C | GlobalSearchBar thiếu kiểm IME | Vá trong PR5 (tăng phạm vi) |
| 3A | Ca kiểm | Toàn bộ sơ đồ trên, gồm E2E Chrome thật + gieo lỗi |
| 4A | Trigram không dùng dưới 3 ký tự | Khoảng trắng đầu + khớp đầu từ |
| 4B | Nạp 47k+ dòng | Điền cột bóng ngay trong migration (vài giây) |
| OV1 | Trigger hỏng làm 500 mọi ghi | EXCEPTION → WARNING + ca kiểm sau migrate + hotfix SQL |
| OV2 | Ngày lệch múi giờ | Không lưu ngày dạng chữ; khoảng +07:00 |
| OV4 | Ghi khuếch đại | `BEFORE UPDATE OF` cột nguồn, không EAV |
| OV5 | Bỏ dấu JS ≠ SQL | `f_bo_dau` gộp khoảng trắng/NBSP + ca kiểm vàng |
| OV9 | Tên quan hệ cũ | Cột bóng trên `users`, lọc qua quan hệ |
| OV14 | EAV quá nặng | Nhận — cột bóng + bộ sinh (giữ mở rộng) |
| OV15 | Khoá chuẩn chỉ thử ở PR3 | Lát mỏng Tổng hợp vào PR1 |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND (Codex hết giờ → Claude subagent) | 15 findings, 15 folded into plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 22 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** Codex timeout sau 5 phút (exit 124); outside voice chạy bằng Claude subagent (cùng họ mô hình). Tension duy nhất (EAV vs cột bóng) đã chốt theo outside voice, giữ mở rộng bằng bộ sinh.
- **VERDICT:** ENG CLEARED — ready to implement (bắt đầu từ T0 đo trước khi xây). Khuyến nghị thêm `/plan-design-review` cho ô thẻ.

NO UNRESOLVED DECISIONS
