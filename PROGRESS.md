# PROGRESS
Cập nhật: 2026-08-10T01:45:00+07:00 | Milestone: M0.5/5 | Task: 1/3 của M0.5

> Nguồn sự thật về trạng thái thi công. Kế hoạch gốc: `~/.claude/plans/r-so-t-to-n-b-vast-minsky.md`
> (đã qua `/plan-eng-review` + outside voice). Lịch sử đợt di trú legacy trước đó đã chuyển sang
> [docs/legacy/PROGRESS-legacy-remigration.md](docs/legacy/PROGRESS-legacy-remigration.md).

## Bản đồ milestone

| MS | Tên | PR | Trạng thái |
|----|-----|----|-----------|
| M0 | Hồi sức — lỗi đang phá dữ liệu trên production | A1 | **1/1 xong** |
| M0.5 | Governance — CI gate + ADR | B0a, B0b, B0c | **1/3** (B0a xong) |
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

Task: M0.5-T1e — checkpoint PR-B0a (**xong**, chờ commit cuối)
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

1. M0.5-T2 — PR-B0b `chore/ci-drift-and-e2e-scaffold` (`continue-on-error`): `prisma migrate diff`, Postgres service, project Playwright `e2e-new`, `tests/.env.test.example`.
3. M0.5-T3 — PR-B0c `docs/adr-foundation`: `docs/adr/` + 12 ADR + CI nudge.
4. M1-T1 — PR-D1 `feat/evidences-lifecycle` (phải trước A2).
5. M1-T2 — PR-A2 `fix/case-update-subentity-dataloss`.

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
- Backend: 220 suite / **2925** test — PASS (xem ND-9: 1 suite flaky ~1/4 lần, có sẵn từ trước)
- Frontend: 151 file / **1475** test — PASS (3 lần chạy liên tiếp ổn định)
- Cổng governance: enum guard ✅ · gen:enums drift ✅ · lint ratchet ✅
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
| ND-10 | **7 spec UAT tự sinh không type-check được** (11 lỗi): `cases-uat.api` (shorthand `linkedIncidentId` không có biến), `petitions-uat.api` (×4, `senderName`/`receivedDate` — `__baseBody()` đã có `receivedDate`, thiếu `senderName`), `petitions-uat-security.api` (`senderIsAnonymous` khai 2 lần + mojibake tiếng Việt), `export-chung-tu-dong-uat.api` + `petition-export-uat.api` (thiếu dependency `jszip`), `document-numbers-uat-2.e2e` (implicit any), `system-wide-uat.e2e` (possibly null). Generator quên khai báo biến ⇒ chạy sẽ `ReferenceError`. Chưa sửa vì phải nối fixture cho từng file và suite này đã bị loại khỏi CI. Đang là bước **advisory** trong job `Advisory Checks` | PR triage suite UAT |
| ND-11 | **Đã xoá** `tests/fixtures/data-factory-cases.ts` — file tự sinh với placeholder `⚠️ Chưa có fixture nào define` chèn thẳng vào tên hàm, `path = ""`, `fixture_id`. Không parse được, không ai import. Nếu generator UAT chạy lại với danh sách fixture rỗng thì nó sẽ sinh lại — cần sửa generator | PR triage suite UAT |
| ND-12 | **`tests/global-setup.ts` từng nhúng sẵn 5 mật khẩu trong source** và `tests/uat-auto/_helpers.ts` mặc định trỏ IP production `171.244.40.245`. Đã sửa ở PR-B0b (bắt buộc lấy từ env, thiếu thì ném lỗi rõ ràng). **Cần đối chiếu**: 5 mật khẩu đó có phải credential thật đang dùng không — nếu có, phải đổi vì chúng nằm trong git history | Cần người xác nhận |
| ND-9 | **`backend/src/auth/services/two-fa.service.spec.ts` flaky ~1/4 lần chạy full song song.** Không phải lỗi TOTP theo thời gian: là `invariant` rỗng từ `ScriptTransformer._buildTransformResult` của jest khi nạp `node_modules/otplib/dist/index.cjs` → dấu hiệu đua tranh cache giữa các worker. Pass 5/5 khi chạy riêng. **Có sẵn từ trước** — không file nào trong chuỗi phụ thuộc này bị đợt thi công chạm tới. Chưa sửa: chẩn đoán cache race của jest là việc riêng. Rủi ro: job `Backend Tests` trong CI có thể đỏ ngẫu nhiên. Hướng điều tra: `cacheDirectory` riêng cho từng workspace, hoặc rà `transformIgnorePatterns` (`node_modules/(?!(@otplib\|@noble)/)` không bao gồm `otplib` không có scope) | PR riêng |
| ND-6 | Tầng phân quyền FE vẫn là mock (`MOCK_ALL_PERMISSIONS` cấp toàn quyền cho mọi user, 252 call site) — người dùng chủ động hoãn; yêu cầu "không mockup" **chưa thoả mãn hoàn toàn** | Quyết lại sau M2 |
| ND-7 | Cổng `prisma migrate diff` sẽ đỏ ngay do ≥6 partial index không biểu diễn được trong Prisma 7; PR-C4 còn cần thêm một cái nữa | PR-B0b (đặt `continue-on-error`) |
| ND-8 | Gate API bằng feature flag sẽ làm hỏng app mobile đã cài (`mobile/lib` không đọc cờ, interceptor chỉ bắt 401, không có forced-update) | PR-M1 chặn cứng E4–E6 |
