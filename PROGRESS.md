# PROGRESS
Cập nhật: 2026-08-10T03:15:00+07:00 | Milestone: M1/5 | Task: 0/5 của M1

> Nguồn sự thật về trạng thái thi công. Kế hoạch gốc: `~/.claude/plans/r-so-t-to-n-b-vast-minsky.md`
> (đã qua `/plan-eng-review` + outside voice). Lịch sử đợt di trú legacy trước đó đã chuyển sang
> [docs/legacy/PROGRESS-legacy-remigration.md](docs/legacy/PROGRESS-legacy-remigration.md).

## Bản đồ milestone

| MS | Tên | PR | Trạng thái |
|----|-----|----|-----------|
| M0 | Hồi sức — lỗi đang phá dữ liệu trên production | A1 | **1/1 xong** |
| M0.5 | Governance — CI gate + ADR | B0a, B0b, B0c | **3/3 xong** |
| M1 | Mất dữ liệu / bảo mật còn lại + nền mobile | D1, A2, A3, A4, M1 | chưa bắt đầu |
| M2 | Hạ tầng cờ tính năng | B1, B2, B3 | chưa bắt đầu |
| M3 | Xóa mockup | C1–C12 | chưa bắt đầu |
| M4 | Vòng đời dữ liệu | D2–D9 | chưa bắt đầu |
| M5 | Dọn dẹp + gate API | E1–E6 | chưa bắt đầu |

## Đã hoàn thành

- [x] **M0.5-T1 — PR-B0a `chore/ci-governance-gate`** — nhánh `chore/ci-governance-gate`
  - CI job `Governance Gate` (`.github/workflows/ci.yml`): enum-literal guard → gen:enums drift → lint ratchet. Hai guard đầu **không cần dependency** nên fail nhanh trước `npm ci`.
  - `scripts/governance/check-enum-literals.cjs` — hiện thực quy tắc CLAUDE.md:31 vốn chỉ là tuyên bố. Ratchet qua `enum-literals-baseline.json` (57 vi phạm sẵn có, chỉ được giảm). Dùng lại `parseEnums` của generator nên guard và codegen không thể lệch nhau.
  - `scripts/governance/lint-changed.cjs` — ratchet đếm lỗi theo file qua `lint-baseline.json` (555 file / 9278 vấn đề). File đã đụng không được **tệ đi**; file mới phải sạch.
  - Nối `backend/test/` vào jest roots và mở rộng vitest `include` → 2 file test chưa bao giờ chạy nay đã chạy; sửa 2 lỗi drift mà `enums-sync.spec.ts` phát hiện ngay khi được chạy.
  - Dọn 117 lỗi lint trên các file PR-A1 đã đụng (`eslint --fix`), tuân đúng chính sách ratchet vừa đặt ra.
  - Sửa 2 tuyên bố sai trong CLAUDE.md (grep guard "đã có", số test 2461) + bổ sung `tsc -b` và cảnh báo chạy tuần tự.
  - Test: +7 BE cho chính guard (`test/governance-enum-literals.spec.ts`).

- [x] **M0-T1 — PR-A1 `fix/admin-role-permission-matrix`** — 3 commit (`6ff8e67`, `98f9b7c`, `e64161c`) — patch coverage: BE 100% dòng mới, FE 69/70 statement (1 guard chống race)
  - BE: thêm `GET /admin/roles/:id/permissions` (`admin.controller.ts:127-132`, `admin.service.ts:getRolePermissions`)
  - BE: `deleteRole` chặn xóa vai trò hệ thống trong `SYSTEM_ROLE_NAMES` + validate tồn tại + ghi audit `ROLE_DELETED`
  - BE: thêm `SYSTEM_ROLE_NAMES` vào `common/constants/role.constants.ts`
  - FE: ma trận quyền dựng động từ `GET /admin/permissions`, fail-closed khi load lỗi, modal xác nhận hiện diff thật
  - Test: +8 BE (3 `getRolePermissions`, 4 role hệ thống, 1 NotFound), +2 BE controller, +8 FE

## Đang làm dở

Task: M1-T2 — PR-A2 `fix/case-update-subentity-dataloss` (**code xong, chờ `/review` + `/codex`**)
Đã làm: `UpdateCaseDto` = `OmitType(PartialType(CreateCaseDto), ['subjects','evidences','documentIds'])` rồi khai lại 3 field với `@Equals(undefined)` kèm **thông điệp tiếng Việt chỉ sang endpoint đúng** — chỉ omit không thì `forbidNonWhitelisted` trả "property subjects should not exist", đúng nhưng không nói người dùng phải làm gì. FE: `buildCreateCasePayload` nhận `mode:'create'|'update'`, mode update bỏ 3 mảng (mặc định vẫn `create` nên mọi lời gọi cũ không đổi).
**Quan trọng — không chỉ dời chỗ mất dữ liệu:** nếu chỉ sửa payload thì hai tab "ĐTBS"/"Vật chứng" ở chế độ sửa vẫn cho nhập, và giờ FE lặng lẽ vứt đi thay vì BE. Nên ở chế độ sửa: tab ĐTBS thay bằng bảng chỉ đường sang tab thật ở trang chi tiết; tab Vật chứng **nhúng thẳng `CaseEvidenceTab`** của D1 — lưu ngay khi thêm dòng, không chờ bấm Lưu. Chế độ tạo giữ nguyên vì đó là nơi 3 mảng thực sự được ghi.
Kiểm: BE **223 suite / 2999 test** PASS, FE **153 file / 1492 test** PASS, `tsc --noEmit` + `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** `/review` rồi `/codex` cho PR-A2. Sau đó M1-T3 (PR-A3).

**Sai sót đã tự phát hiện và khắc phục trong lúc làm:** tôi ghi đè mất `update-case.dto.spec.ts` vốn đã có 9 test (regression TAM_DINH_CHI/PHUC_HOI v0.37.2.6). Phát hiện vì tổng số test giảm 9 so với dự kiến chứ không phải vì có test đỏ — suite vẫn báo xanh. Đã khôi phục từ `git show HEAD:` và nối 5 test mới vào cuối. **Bài học ghi lại:** đối chiếu tổng số test sau mỗi lần thêm, vì mất test không làm CI đỏ.

---

Task: M1-T1 — PR-D1 `feat/evidences-lifecycle` (**xong — qua `/review` và `/codex`**)
Đã làm: module `backend/src/evidences/` CRUD + soft-delete + restore, tab "Vật chứng" ở trang chi tiết vụ án, `cases.getById()` include evidences (**không** include ở `getList` — N+1, có comment cảnh báo tại chỗ), constants `EVIDENCE_STATUS` 2 phía (`Evidence.status` là `String`, **không** phải Prisma enum nên `gen:enums` không sinh), permission Evidence + runner seed chạy trong `deploy.sh`.
Kiểm: BE **223 suite / 2985 test** PASS, FE **152 file / 1485 test** PASS, `tsc --noEmit` + `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** chạy `/codex` cho PR-D1 theo §4, rồi commit. Sau đó M1-T2 (PR-A2) — D1 đã lên nên A2 không còn cắt đường nhập vật chứng.

### Finding đã xử lý ở checkpoint PR-D1

Bảy cái, đều **do tôi gây ra** trong chính PR này:
1. `QueryDeletedEvidencesDto` thiếu ⇒ endpoint `listDeleted` nhận query không validate.
2. **Permission mới sẽ 403 cho mọi người trên production** — `deploy.sh` không chạy `db:seed`, nên `seed-permissions.ts` không bao giờ tới prod. Đây đúng lớp lỗi ISSUE-001. Thêm `seed-permissions-runner.ts` (idempotent) + bước 9b-2 trong `deploy.sh`, fatal nếu hỏng.
3. Evidence chưa có trong danh sách quyền của `OFFICER` ⇒ đúng vai trò dùng module nhiều nhất lại không đọc được.
4. Form sửa gửi `''` cho ô đã xoá trắng thay vì `null` ⇒ không xoá được giá trị. Thêm `orNull()` + nới DTO cho nullable.
5. `restore()` không kiểm trùng `code` ⇒ khôi phục có thể tạo 2 vật chứng cùng mã trong một vụ án. Nay ném `ConflictException`.
6. Bộ lọc comment của enum guard mất đồng bộ khi gặp dấu nháy trong regex literal ⇒ **báo sai trên một cổng chặn**. Sửa thành máy trạng thái nhận biết cả chuỗi lẫn regex, +3 test.
7. `makeReq()`/`mockUser` trả `any` ⇒ lây `no-unsafe-*` sang mọi spec controller gọi chúng. Đổi sang `ScopedRequest`/`AuthUser` thật.

Kèm quyết định governance: **ADR-0015** — tắt họ `no-unsafe-*` cho file test. Lý do: `@types/jest` khai `expect.objectContaining()` trả `any`, nên rule bắn vì cú pháp matcher chuẩn chứ không vì test viết ẩu; né rule đồng nghĩa với viết assertion yếu hơn. Mã sản phẩm giữ nguyên toàn bộ rule. Baseline ratchet 11.507 → **8.945**.

### Finding đã xử lý ở checkpoint `/codex` PR-D1

Codex CLI treo 2 lần ở `codex review` (diff `main...HEAD` = 402KB/79 file vì chưa PR nào merge). Chạy được bằng cách thu hẹp về đúng diff PR-D1 và đưa prompt qua **stdin** (`codex exec -`) — truyền 120KB qua argv thì Windows trả `Argument list too long`. Ghi lại vì sẽ gặp lại ở mọi checkpoint sau.

Kết quả: 6×[P1] + 2×[P2]. Sáu cái sửa trong vòng này:

1. **[P1] Quyền của OFFICER vẫn không tới production.** Runner chỉ cấp cho ADMIN; grant OFFICER nằm trong `seed.ts` mà deploy không chạy. Tức là tôi mới sửa được nửa lỗi ở vòng trước — module 403 với đúng những người nó phục vụ. Thêm `DEFAULT_ROLE_GRANTS` khai báo được, runner áp **chỉ cho permission nó vừa tạo** trong lần chạy đó, nên admin đã chủ động thu hồi quyền nào thì lần deploy sau không âm thầm cấp lại.
2. **[P1] Vụ án đã xóa mềm không kéo theo vật chứng.** List/detail/restore chưa hề kiểm `case.deletedAt` ⇒ xóa vụ án xong vật chứng vẫn đọc/sửa được, và khôi phục sinh ra con sống dưới cha đã xóa. Thêm `LIVE_CASE` vào cả 4 đường đọc.
3. **[P1] Đua tranh mã vật chứng.** Kiểm-rồi-ghi tách rời ở `create`/`update`/`restore`. Đóng bằng `withCaseLock` — `SELECT … FOR UPDATE` trên hàng vụ án cha, kiểm và ghi cùng transaction. **Không** thêm partial unique index: bảng đã có dữ liệu chưa từng bị ràng buộc trong nền 53k bản ghi legacy, `CREATE UNIQUE INDEX` sẽ hỏng nếu đang có cặp trùng, và chọn bỏ bản nào là quyết định về hồ sơ pháp lý — **ADR-0016** ghi rõ điều kiện chuyển sang index thật.
4. **[P1] `check-enum-literals.cjs` chỉ nhớ 1 ký tự trước.** `return /["']/…` không được nhận là regex ⇒ dấu nháy mở chuỗi ⇒ comment phía sau bị quét như code ⇒ **báo sai trên cổng chặn**. Thêm nhận diện theo từ khóa (`return`/`throw`/`typeof`/…), xử lý `i++ / 2`, và cho chuỗi chưa đóng dừng ở cuối dòng thay vì nuốt tới hết file. +4 test. (Tôi tự tìm ra cái này song song với codex — trùng khớp.)
5. **[P1] Bước seed trong `deploy.sh` không có giới hạn thời gian** ⇒ một khóa DB treo là treo cả job deploy vô hạn. Bọc `timeout 300`.
6. **[P2] Miễn trừ lint cho file test rộng hơn phần bị loại khỏi build.** `tsconfig.build.json` chỉ loại `**/*spec.ts`, nên `test-utils/` và `*.test.ts` vẫn biên dịch vào `dist` — miễn trừ của ADR-0015 chỉ chính đáng nếu chúng không ship. Loại đúng cùng tập hợp.

Hai cái **không** sửa trong PR này, có lý do:

- **[P1] `assertParentInScope` bỏ qua mọi kiểm tra khi `canDispatch`**, kể cả thao tác ghi. Đúng, nhưng đây là hành vi dùng chung của **cả 12 resource**, không phải hồi quy của D1. Sửa ở đây sẽ đổi ngữ nghĩa phân quyền cho toàn hệ thống trong một PR về vật chứng. → ND-14, xử lý ở PR-A3 (PR chuyên về DataScope).
- **[P2] `getById` trả 403 cho ngoài phạm vi và 404 cho không tồn tại**, tức lộ sự tồn tại của bản ghi. Đúng, nhưng mọi module khác đang theo đúng mẫu này; đổi riêng một module tạo ra bất nhất. → ND-15, quyết một lần cho toàn hệ thống.

---

Task: M0.5-T3 — PR-B0c `docs/adr-foundation` (**xong**)
Đã làm: `docs/adr/` + template MADR + README danh mục + **14 ADR** + workflow `adr-nudge.yml` (cảnh báo, không chặn) + trỏ dẫn trong CLAUDE.md. Kiểm: 0 link hỏng, 0 số hiệu trùng. BE 221 suite/2951 test PASS, FE 151 file/1475 test PASS, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** M1-T1 — PR-D1 `feat/evidences-lifecycle`. Xem mục 2 hàng đợi. Nhớ: D1 **phải trước** A2.

ADR đã ghi: 0001 cờ lõi compile-time · 0002 `caseId` giữ NOT NULL · 0003 model quyết định trùng đơn · 0004 không có `POST /settings` · 0005 danh mục seed-only · 0006 xoá 3 tab mockup · 0007 gate cấp class · 0008 mobile chặn gate API · 0009 cache một-instance · 0010 `ALTER TYPE` một chiều · 0011 chấp nhận drift partial index · 0012 lint ratchet · 0013 bộ UAT cũ không vào CI · 0014 RLS chỉ 2 bảng · 0015 `no-unsafe-*` tắt trong file test.

---

Task: M0.5-T2 — PR-B0b `chore/ci-drift-and-e2e-scaffold` (**xong**)
Đã làm: 2 commit (`030d3d2`, `80dd6c3`). `/review` xong — 7 finding, đã sửa hết. BE 221 suite/**2951** test PASS, FE 151 file/**1475** test PASS, 3 cổng governance xanh, collect Playwright từ **0 → 3849 test / 182 file**.
**BƯỚC TIẾP THEO:** M0.5-T3 — PR-B0c `docs/adr-foundation`: tạo `docs/adr/` + template MADR + 12 ADR (danh sách ở mục "Quyết định kiến trúc" bên dưới + 12 quyết định trong kế hoạch gốc) + CI nudge khi PR đổi `schema.prisma` hoặc `feature-flags/` mà không chạm `docs/adr/`, theo khuôn `shell-parity-gate.yml`.

### Finding đã xử lý ở checkpoint PR-B0b

3 cái **do tôi gây ra**: `testMatch` trên `chromium` làm 134 spec mồ côi; `_helpers.ts` ném lỗi lúc import làm vỡ collect; `.env.test.example` chỉ dẫn đặt `UAT_PROD` sai chỗ.
4 cái **có sẵn**: thiếu dependency `jszip` khiến **toàn bộ** khâu collect của Playwright chết (mọi project báo 0 test); allow-list `prisma/` miễn trừ nhầm `backend/src/prisma`; bộ lọc comment xoá nhầm `//` trong chuỗi; `asyncUtilTimeout` bằng đúng `testTimeout` mặc định nên vô hiệu.

---

Task: M0.5-T1e — checkpoint PR-B0a (**xong**)
Đã làm: code xong; `/review` xong (4 finding, đã sửa hết, commit `90d01e7`); dọn nợ lint trên chính file mới của mình thay vì baseline hoá nó. BE 220 suite/**2949** test PASS, FE 151 file/**1475** test PASS, BE `tsc --noEmit` + FE `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** sang M0.5-T2 (PR-B0b `chore/ci-drift-and-e2e-scaffold`) — xem mục 1 của hàng đợi.
File liên quan: `.github/workflows/ci.yml`, `scripts/governance/*`, `backend/package.json`, `backend/test/`, `frontend/vite.config.ts`, `frontend/src/test-setup.ts`, `CLAUDE.md`

### Finding đã xử lý ở checkpoint PR-B0a

`/review` (4) — đều nằm trong chính công cụ governance, 2 cái làm cổng **im lặng đi qua**:
1. Ratchet lint quét `backend/**` nhưng baseline chỉ sinh từ `src`+`test` ⇒ `prisma/seed.ts` (62 lỗi) fail `0 → 62` và `--write-baseline` không ghi nổi. Gộp về một nguồn sự thật `ownedBy()`, mở rộng sang `prisma/` + `scripts/`.
2. `lintCounts` coi stdout rỗng là "không lỗi" và bỏ qua exit code ⇒ eslint crash thì cổng báo xanh. Nay phân biệt exit 1 (có lỗi, bình thường) với lỗi thật và ném exception.
3. Spec khẳng định source production **vẫn còn** vi phạm ⇒ ai làm đúng hướng dẫn của guard sẽ làm đỏ test. Chuyển sang quét cây fixture tạm.
4. Allow-list khớp trên đường dẫn tuyệt đối ⇒ thư mục checkout chứa segment `prisma`/`test-utils` sẽ tắt guard toàn repo. Đổi sang đường dẫn tương đối + neo `(^|/)`.

Tự phát hiện thêm: 3 file test mới của chính tôi bị baseline hoá 7 lỗi lint thay vì dọn — đúng kiểu tự miễn trừ mà chính sách này cấm. Đã khai báo kiểu cho 2 script CommonJS (`test/governance-scripts.d.ts`) để dùng `import` thật thay `require()` + `any`; cả 4 file mới nay 0 lỗi.

### Finding đã xử lý ở checkpoint PR-A1

`/review` (4):
1. Race trong `loadPermissions` — response chậm của vai trò cũ đè lên vai trò đang chọn **và** đè cả baseline ⇒ diff báo "không có thay đổi" trong khi Lưu ghi quyền vai trò A sang B. Sửa bằng `permRequestSeq`.
2. `updateRole` cho đổi tên vai trò hệ thống ⇒ phá mọi so sánh `ROLE_NAMES` và lách được guard xoá. Chặn hai chiều.
3. Đổi tab làm refetch danh mục ⇒ đổi identity mảng ⇒ effect chạy lại ⇒ mất chỉnh sửa chưa lưu. Chỉ nạp một lần.
4. Audit `ROLE_DELETED` thiếu `ipAddress`/`userAgent`.

`/codex` (3):
5. `PATCH /admin/roles/:id/permissions` vẫn nhận mảng rỗng không điều kiện ⇒ đúng cơ chế đã gây mất quyền, chỉ là từ client khác. Thêm cờ `allowEmpty` bắt buộc + cảnh báo đỏ trong modal.
6. `permCatalogLoaded` là boolean ⇒ hai request đồng thời, cái lỗi đến sau xoá danh mục nhưng ref vẫn `true` ⇒ **kẹt vĩnh viễn tới khi reload trang**. Đổi thành state machine `idle/loading/loaded` + nút "Thử lại".
7. `SYSTEM_ROLE_NAMES` thiếu `OFFICER` và `DEADLINE_APPROVER` — hai vai trò seed thật và **được so sánh bằng chuỗi cứng** ở `deadline-rules.service.ts:905`, `calendar-events.controller.ts:42`, nên không được bảo vệ. Bổ sung vào `ROLE_NAMES` (cả BE lẫn FE) và thay chuỗi cứng bằng hằng số.

## Hàng đợi task kế tiếp

1. M1-T1 — PR-D1 `feat/evidences-lifecycle` (**phải trước A2**).
2. M1-T1 — PR-D1 `feat/evidences-lifecycle` (**phải trước A2** — nếu A2 chặn `evidences[]` khi chưa có module thay thế thì cán bộ mất luôn đường nhập vật chứng lúc sửa hồ sơ).
3. M1-T2 — PR-A2 `fix/case-update-subentity-dataloss` (FE + BE **cùng một PR**).
4. M1-T3 — PR-A3 `fix/create-endpoints-datascope` (4 service: subjects, lawyers, investigation-supplements, exchanges).
5. M1-T4 — PR-A4 `fix/seed-endpoints-and-settings-validation` (dùng chuỗi **có dấu** `'ngày'`/`'lần'`/`'giờ'`; trần theo unit, `giờ` → 8760).
6. M1-T5 — PR-M1 `feat/mobile-feature-flag-awareness` (**chặn cứng** E4–E6).

### Nhánh đã tạo (chưa mở PR, chưa push)
`fix/admin-role-permission-matrix` → `chore/ci-governance-gate` → `chore/ci-drift-and-e2e-scaffold` (xếp chồng, mỗi nhánh dựa trên nhánh trước). Khi mở PR cần tách hoặc merge tuần tự theo đúng thứ tự này.

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|------|-----------|-------|-----------|
| 2026-08-10 | Cài Node.js LTS v24.19.0 qua winget | Máy chưa có Node → không chạy được test/lint/tsc, tức không thoả §3 | Môi trường dev cục bộ |
| 2026-08-10 | Ma trận quyền FE dựng động từ `GET /admin/permissions`, không dùng danh sách cứng | Danh sách cứng cũ (8 subject × 5 action) bỏ sót 8/16 subject và 5/9 action thật, và chứa `export` không tồn tại → nút Lưu âm thầm xoá mọi quyền ngoài lưới | Mọi permission mới seed vào DB tự động xuất hiện trên lưới |
| 2026-08-10 | Ô không có trong danh mục render `—` thay vì checkbox | Lưới đầy đủ cartesian cho phép admin tạo permission không guard nào kiểm, và `updateRolePermissions` sẽ upsert chúng thành row thật | Không sinh Permission rác |
| 2026-08-10 | Fail-closed: load quyền lỗi → khoá nút Lưu | Trước đây lỗi bị nuốt, ma trận rỗng vẫn ghi đè được — đây chính là cơ chế gây mất quyền | Không thể ghi đè bằng dữ liệu chưa tải được |
| 2026-08-10 | `deleteRole` ghi audit `ROLE_DELETED` | `requesterId` vốn bị `eslint-disable no-unused-vars`; xoá vai trò là thao tác an ninh phải có vết | Bỏ được 1 lint suppression (§5) |
| 2026-08-10 | Chuyển `PROGRESS.md` cũ sang `docs/legacy/` thay vì ghi đè | §2 — bảo toàn dữ liệu khi spec mâu thuẫn | Lịch sử di trú legacy vẫn tra cứu được |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| §4 yêu cầu message là hằng số/khoá i18n, nhưng repo không có hạ tầng i18n | Gom message của ma trận quyền vào hằng `MESSAGES` có namespace ở đầu file, không dựng framework i18n giữa PR | §4 "convention hiện có của repo thắng"; vẫn tạo được điểm neo cho lần i18n sau |
| §3.4 "lint sạch" vs 59 lỗi lint có sẵn trong `admin.service.ts` | Diễn giải theo đúng chữ "không warning **mới**": chỉ đảm bảo dòng tôi thêm sạch, không reformat code cũ không liên quan | Reformat cả file làm diff phình và trộn mục đích, trái "1 branch = 1 mục đích". Nợ này giao cho PR-B0a — PR mà mục đích chính là bật lint |
| Baseline test trong CLAUDE.md (1728 BE + 733 FE) | Đo lại thực tế: **2867 BE + 1457 FE** (trước khi tôi thêm test). Dùng số đo thật làm mốc | Chạy `npx jest` và `npx vitest run` trực tiếp |

## Trạng thái test

Full suite: **PASS**
- Backend: 223 suite / **2994** test — PASS (xem ND-9: 1 suite flaky ~1/6 lần, có sẵn từ trước)
- Frontend: 152 file / **1485** test — PASS (3 lần chạy liên tiếp ổn định)
- Cổng governance: enum guard ✅ · gen:enums drift ✅ · lint ratchet ✅ (baseline 8.945 sau ADR-0015)
- `tsc --noEmit` (BE): sạch · `tsc -b` (FE): sạch
- eslint: không có lỗi mới trên dòng đã thêm (nợ lint có sẵn xem ND-1)

Patch coverage: BE 100% dòng mới · FE chỉ còn 1 guard chống race chưa phủ
Test fail: không

## Nợ kỹ thuật / rủi ro

| # | Nội dung | Giao cho |
|---|---|---|
| ND-1 | `backend/src/admin/admin.service.ts` có **59 lỗi prettier** và `admin.service.spec.ts` có ~32 dòng lỗi `no-unsafe-*` — đều có sẵn, do CI chưa bao giờ chạy eslint | PR-B0a |
| ND-2 | CLAUDE.md:31 tuyên bố "Verified by grep guard in CI" nhưng guard **không tồn tại** trong `.github/workflows/` | PR-B0a |
| ND-3 | CLAUDE.md ghi baseline test 1728+733, thực tế 2867+1457 — cần sửa tài liệu | PR-B0a |
| ND-4 | `backend/test/` không bao giờ chạy (`jest.rootDir = "src"`); `frontend/src/hooks/useMasterClassOptions.test.ts` không bao giờ chạy (vitest `include` chỉ nhận `__tests__/`) | PR-B0a |
| ND-5 | Chạy song song jest (BE) và vitest (FE) trên máy này gây timeout giả ở test dùng `findBy*` — **luôn chạy tuần tự**. Đã giảm nhẹ bằng `asyncUtilTimeout: 5000` trong `frontend/src/test-setup.ts` | Ghi chú vận hành |
| ND-10 | **6 spec UAT tự sinh không type-check được** (9 lỗi, đã bớt 2 sau khi thêm `jszip`): `cases-uat.api` (shorthand `linkedIncidentId` không có biến), `petitions-uat.api` (×4, `senderName`/`receivedDate` — `__baseBody()` đã có `receivedDate`, thiếu `senderName`), `petitions-uat-security.api` (`senderIsAnonymous` khai 2 lần + mojibake tiếng Việt), `export-chung-tu-dong-uat.api` + `petition-export-uat.api` (thiếu dependency `jszip`), `document-numbers-uat-2.e2e` (implicit any), `system-wide-uat.e2e` (possibly null). Generator quên khai báo biến ⇒ chạy sẽ `ReferenceError`. Chưa sửa vì phải nối fixture cho từng file và suite này đã bị loại khỏi CI. Đang là bước **advisory** trong job `Advisory Checks` | PR triage suite UAT |
| ND-11 | **Đã xoá** `tests/fixtures/data-factory-cases.ts` — file tự sinh với placeholder `⚠️ Chưa có fixture nào define` chèn thẳng vào tên hàm, `path = ""`, `fixture_id`. Không parse được, không ai import. Nếu generator UAT chạy lại với danh sách fixture rỗng thì nó sẽ sinh lại — cần sửa generator | PR triage suite UAT |
| ND-12 | **`tests/global-setup.ts` từng nhúng sẵn 5 mật khẩu trong source** và `tests/uat-auto/_helpers.ts` mặc định trỏ IP production `171.244.40.245`. Đã sửa ở PR-B0b (bắt buộc lấy từ env, thiếu thì ném lỗi rõ ràng). **Cần đối chiếu**: 5 mật khẩu đó có phải credential thật đang dùng không — nếu có, phải đổi vì chúng nằm trong git history | Cần người xác nhận |
| ND-13 | **`Evidence` chưa có ràng buộc DB cho `(caseId, code)` khi bản ghi còn sống.** Bất biến hiện thi hành bằng khóa hàng vụ án cha (`withCaseLock`) — đủ chặn đua tranh, nhưng chỉ đúng khi mọi đường ghi đều đi qua đó, và người sửa DB trực tiếp bằng `psql` vẫn tạo được bản trùng. Chưa thêm partial unique index vì bảng đã có dữ liệu chưa từng bị ràng buộc trong nền 53k bản ghi legacy: nếu đang có cặp trùng thì `CREATE UNIQUE INDEX` hỏng và deploy đứng, mà chọn bỏ bản nào là quyết định về hồ sơ pháp lý. **Việc cần làm:** chạy câu đối soát trong ADR-0016 §"Điều kiện chuyển sang index thật"; nếu rỗng thì thêm index luôn | Cần người giữ hồ sơ quyết |
| ND-14 | **`assertParentInScope` bỏ qua toàn bộ kiểm tra khi `scope.canDispatch`, kể cả `operation: 'write'`** (`scope-filter.util.ts:104`). `canDispatch` được mô tả là quyền đọc toàn cục + quyền phân công, không phải quyền sửa mọi hồ sơ — nhưng thực tế người điều phối tạo/sửa/xóa/khôi phục được bản ghi con của **mọi** vụ án. Ảnh hưởng cả 12 resource, không riêng vật chứng | PR-A3 (PR chuyên về DataScope) |
| ND-15 | **Đường đọc chi tiết trả 403 cho bản ghi ngoài phạm vi và 404 cho bản ghi không tồn tại**, tức lộ sự tồn tại của hồ sơ tổ khác. Mẫu này dùng thống nhất toàn hệ thống nên phải quyết một lần (đưa scope vào `where` rồi trả 404 cho cả hai), không sửa lẻ từng module | Quyết cùng PR-A3 |
| ND-9 (cập nhật) | **`two-fa.service.spec.ts` flaky ~1/6 lần chạy full — CHƯA sửa được, đã điều tra kỹ.** Đã thử và **loại bỏ** các giả thuyết: (a) `cacheDirectory` riêng cho backend — đã áp dụng, giảm va chạm giữa các tiến trình jest nhưng không dứt vì đua tranh nằm **giữa các worker trong cùng một lần chạy**; (b) `maxWorkers=4` — giảm tỷ lệ nhưng vẫn đỏ 1/6, và trên runner CI 4 nhân thì `50%`=2 worker còn ít hơn 4 nên giữ nguyên `50%`; (c) bỏ `transformIgnorePatterns` — **làm hỏng một suite khác** (2976 vs 2981), hoàn tác; (d) `globalSetup` hâm cache — **vô tác dụng**, vì globalSetup dùng `require` thuần của Node, không đi qua `ScriptTransformer` nên không ghi mục cache nào; đã gỡ thay vì để lại file giả vờ sửa. Hướng còn lại chưa thử: mock `otplib` trong spec (làm yếu test), hoặc chờ bản jest vá đua tranh ghi cache trên Windows. **Rủi ro CI: job `Backend Tests` có thể đỏ ngẫu nhiên ~1/6 lần.** | PR riêng |
| ND-9 (gốc) | **`backend/src/auth/services/two-fa.service.spec.ts` flaky ~1/4 lần chạy full song song.** Không phải lỗi TOTP theo thời gian: là `invariant` rỗng từ `ScriptTransformer._buildTransformResult` của jest khi nạp `node_modules/otplib/dist/index.cjs` → dấu hiệu đua tranh cache giữa các worker. Pass 5/5 khi chạy riêng. **Có sẵn từ trước** — không file nào trong chuỗi phụ thuộc này bị đợt thi công chạm tới. Chưa sửa: chẩn đoán cache race của jest là việc riêng. Rủi ro: job `Backend Tests` trong CI có thể đỏ ngẫu nhiên. Hướng điều tra: `cacheDirectory` riêng cho từng workspace, hoặc rà `transformIgnorePatterns` (`node_modules/(?!(@otplib\|@noble)/)` không bao gồm `otplib` không có scope) | PR riêng |
| ND-6 | Tầng phân quyền FE vẫn là mock (`MOCK_ALL_PERMISSIONS` cấp toàn quyền cho mọi user, 252 call site) — người dùng chủ động hoãn; yêu cầu "không mockup" **chưa thoả mãn hoàn toàn** | Quyết lại sau M2 |
| ND-7 | Cổng `prisma migrate diff` sẽ đỏ ngay do ≥6 partial index không biểu diễn được trong Prisma 7; PR-C4 còn cần thêm một cái nữa | PR-B0b (đặt `continue-on-error`) |
| ND-8 | Gate API bằng feature flag sẽ làm hỏng app mobile đã cài (`mobile/lib` không đọc cờ, interceptor chỉ bắt 401, không có forced-update) | PR-M1 chặn cứng E4–E6 |
