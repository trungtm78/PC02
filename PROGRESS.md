# PROGRESS
Cập nhật: 2026-08-10T00:35:00+07:00 | Milestone: M0/5 | Task: 1/1 của M0

> Nguồn sự thật về trạng thái thi công. Kế hoạch gốc: `~/.claude/plans/r-so-t-to-n-b-vast-minsky.md`
> (đã qua `/plan-eng-review` + outside voice). Lịch sử đợt di trú legacy trước đó đã chuyển sang
> [docs/legacy/PROGRESS-legacy-remigration.md](docs/legacy/PROGRESS-legacy-remigration.md).

## Bản đồ milestone

| MS | Tên | PR | Trạng thái |
|----|-----|----|-----------|
| M0 | Hồi sức — lỗi đang phá dữ liệu trên production | A1 | **1/1 xong** |
| M0.5 | Governance — CI gate + ADR | B0a, B0b, B0c | chưa bắt đầu |
| M1 | Mất dữ liệu / bảo mật còn lại + nền mobile | D1, A2, A3, A4, M1 | chưa bắt đầu |
| M2 | Hạ tầng cờ tính năng | B1, B2, B3 | chưa bắt đầu |
| M3 | Xóa mockup | C1–C12 | chưa bắt đầu |
| M4 | Vòng đời dữ liệu | D2–D9 | chưa bắt đầu |
| M5 | Dọn dẹp + gate API | E1–E6 | chưa bắt đầu |

## Đã hoàn thành

- [x] **M0-T1 — PR-A1 `fix/admin-role-permission-matrix`** — chưa commit (đang ở working tree) — patch coverage: BE 100% dòng mới, FE 69/70 statement (1 guard chống race)
  - BE: thêm `GET /admin/roles/:id/permissions` (`admin.controller.ts:127-132`, `admin.service.ts:getRolePermissions`)
  - BE: `deleteRole` chặn xóa vai trò hệ thống trong `SYSTEM_ROLE_NAMES` + validate tồn tại + ghi audit `ROLE_DELETED`
  - BE: thêm `SYSTEM_ROLE_NAMES` vào `common/constants/role.constants.ts`
  - FE: ma trận quyền dựng động từ `GET /admin/permissions`, fail-closed khi load lỗi, modal xác nhận hiện diff thật
  - Test: +8 BE (3 `getRolePermissions`, 4 role hệ thống, 1 NotFound), +2 BE controller, +8 FE

## Đang làm dở

Task: M0-T1d — checkpoint PR-A1 (**gần xong**)
Đã làm: code + test xong, `/review` xong (4 finding, đã sửa hết, commit `98f9b7c`), `/codex` xong (3 finding, đã sửa hết). Full suite BE 218 suite/**2885** test PASS, FE 150 file/**1469** test PASS, `tsc --noEmit` (BE) + `tsc -b` (FE) sạch, eslint trên file đã sửa không có lỗi mới.
**BƯỚC TIẾP THEO:** commit lớp fix từ codex, rồi bắt đầu M0.5-T1 (PR-B0a `chore/ci-governance-gate`) — xem mục 1 của hàng đợi.
File liên quan: `backend/src/admin/`, `backend/src/common/constants/role.constants.ts`, `backend/src/deadline-rules/deadline-rules.service.ts`, `backend/src/calendar-events/calendar-events.controller.ts`, `frontend/src/pages/users/UserManagementPage.tsx`, `frontend/src/shared/enums/roles.ts`

### Finding đã xử lý ở checkpoint này

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

1. M0.5-T1 — PR-B0a `chore/ci-governance-gate` (**blocking**): enum-literal grep guard, eslint `--max-warnings=0` không `--fix`, `gen:enums` + `git diff --exit-code`, mở rộng jest `roots` để `backend/test/` được chạy, mở rộng vitest `include` để `src/**/*.test.ts` ngoài `__tests__` được chạy, sửa CLAUDE.md:31.
2. M0.5-T2 — PR-B0b `chore/ci-drift-and-e2e-scaffold` (`continue-on-error`): `prisma migrate diff`, Postgres service, project Playwright `e2e-new`, `tests/.env.test.example`.
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
- Backend: 218 suite / **2885** test — PASS
- Frontend: 150 file / **1469** test — PASS
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
| ND-5 | Chạy song song jest (BE) và vitest (FE) trên máy này gây timeout giả ở test dùng `findBy*` — **luôn chạy tuần tự** | Ghi chú vận hành |
| ND-6 | Tầng phân quyền FE vẫn là mock (`MOCK_ALL_PERMISSIONS` cấp toàn quyền cho mọi user, 252 call site) — người dùng chủ động hoãn; yêu cầu "không mockup" **chưa thoả mãn hoàn toàn** | Quyết lại sau M2 |
| ND-7 | Cổng `prisma migrate diff` sẽ đỏ ngay do ≥6 partial index không biểu diễn được trong Prisma 7; PR-C4 còn cần thêm một cái nữa | PR-B0b (đặt `continue-on-error`) |
| ND-8 | Gate API bằng feature flag sẽ làm hỏng app mobile đã cài (`mobile/lib` không đọc cờ, interceptor chỉ bắt 401, không có forced-update) | PR-M1 chặn cứng E4–E6 |
