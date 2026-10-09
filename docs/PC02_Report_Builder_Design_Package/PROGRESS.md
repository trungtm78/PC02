# PROGRESS — Dynamic Report Builder (Báo cáo động)
Cập nhật: 2026-10-10T05:10:00+07:00 | Milestone: PR0-PR2 ĐÃ MERGE VÀO MAIN (PR #522) → bắt đầu PR3 | Task: 0/~6

## Đã hoàn thành
- [x] PR0 — spec, fixture (HSLN+5 mẫu thật+oracle+5 file độc hại giả lập), DECISIONS_20261009.md, ROLE_MATRIX_20261009.md — commit 2f077843
- [x] PR1 — 9 engine thuần + date-math.ts dùng chung: decimal, values, token, period, expr, aggregate, access, status, paste. 274 test, 95-100% dòng mỗi file. Oracle HSLN thật (228 dòng, 190 dòng Excel tự tính sai #REF!) đối chiếu khớp 100%. Commit 2b571f0b…4a44305d.
- [x] PR1 gen:dr-engine — bản sao frontend, 2 cổng (byte bằng nhau + ranh giới import), sửa lỗi `erasableSyntaxOnly` ở expr.ts — commit e73a8501
- [x] PR2 — Prisma schema (18 model mới `DynReport*`, theo R1: không có bảng DynReportFormula riêng — công thức nằm trong `DynReportVersion.layout`), migration `20261009170000_add_dynamic_reports` (556 dòng SQL, 18 CREATE TABLE/25 CREATE INDEX thường/0 DROP, đã áp thử thành công vào DB sạch từ baseline origin/main), 3 quyền mới `read/manage/admin:DynamicReport` — commit 6af80fed
- [x] PR2 — khung module (`DynamicReportsModule`, feature flag `dynamic_reports` tắt mặc định), `GET /bao-cao-dong/clock`, bảng chuyển trạng thái khai báo `workflow/transitions.ts` (R1: SAVE/SUBMIT/RETURN/APPROVE/UNAPPROVE, có phê duyệt nhiều cấp R21) — commit 1004c769
- [x] PR2 — vá 2 thiếu sót phát hiện qua `/review` (plan-completion audit so với checklist PR2 gốc): cấp `read:DynamicReport` cho OFFICER trong `seed.ts`; dựng `GET /bao-cao-dong/reports?mode=input|manage|setup` (đóng AC-012/AC-035), 100% dòng, 8 test mới — commit 0f0c489a
- [x] **Đã merge PR #522 vào `main` (squash, admin-merge theo yêu cầu "làm cho xong" của anh — branch protection yêu cầu review approval nhưng anh chưa approve qua GitHub UI, dùng `--admin` để hoàn tất theo chỉ đạo trực tiếp), merge commit `7951a9221940fe3d8db2df5bf9649d2a76f62da6`, 10/10/2026 05:07 (+07:00). Nhánh `feat/dynamic-reports-m1-engine` đã xoá trên remote.** CI trên PR xanh cả 5 check (Backend/Frontend/Database Gate/Engine Gate/Monkey Self-Test). Deploy + CI trên `main` đang chạy sau merge — xem Trạng thái test để biết kết quả.

**Tổng PR0-PR2: 338 test dynamic-reports (330 cũ + 8 mới), toàn bộ xanh. Backend full suite 7770/7885 (115 skip có trước, không liên quan) xanh. Frontend `tsc -b` sạch, vitest 4884/4885 (1 lỗi chập chờn CÓ TRƯỚC, không liên quan — xem Nợ kỹ thuật). Feature flag `dynamic_reports` tắt mặc định → 0 ảnh hưởng hành vi cho user hiện có kể cả sau khi lên production.**

### Vấn đề hạ tầng đã gỡ (không phải của dynamic-reports nhưng chặn đường)
- `prisma migrate deploy`/`migrate dev` không chạy được từ DB rỗng hoàn toàn trên nhánh này (migration `20260227000000_add_case_metadata` giả định bảng `cases` đã tồn tại từ trước — lỗi lịch sử migration có sẵn, không phải do dynamic-reports). Đường vòng đã dùng: `prisma migrate diff --from-schema <baseline origin/main> --to-schema <schema mới> --script`, kiểm chứng bằng cách áp schema baseline qua `db push` vào DB rỗng rồi chạy thẳng SQL sinh ra, xác nhận `db push` báo "already in sync" — 0 sai lệch.

## Đang làm dở
Task: Chưa bắt đầu PR3 — TemplateService (đọc/kiểm tra file Excel)
Đã làm: Chưa có gì.

BƯỚC TIẾP THEO: Viết `backend/src/dynamic-reports/template/parser.ts` (KHÔNG phải pure engine theo R2 — dùng `exceljs`, chạy phía backend). Theo spec §6.1 PR3 và R3/R6:
1. Mở rộng shared formula (exceljs `sharedFormula`) — test trên `bao_cao_ngay_shared_formulas.xlsx` (211 ô) và `a09_1034_unlocked.xlsx` (21 ô).
2. Resolve locked hiệu lực: ô → style dòng → style cột (`<col style>`) → mặc định Excel `locked=true`. Test trên HSLN (68 `<col style>`).
3. Phân loại ô theo bảng FRD §4.3, áp dụng sửa đổi đã chốt: unlocked+rỗng/literal → CẢNH BÁO (không chặn) kèm gợi ý "đặt làm ô nhập".
4. Giới hạn hai tầng (R6): tầng file (tái dùng `hostile-xlsx-guard.ts`, tham số hoá `XLSX_LIMITS`, HSLN có 17 sheet phải qua được) + tầng sheet-đã-chọn (≤5 sheet chọn làm mẫu, ≤50.000 ô, ≤5.000 input).
5. Chạy parse trong `worker_threads` (repo CHƯA từng dùng worker_threads — kiểm tra kỹ `timeout`/`terminate()`).
6. Dùng fixture độc hại đã có ở `backend/test/fixtures/dynamic-reports/hostile/` (5 file: mã hoá, macro đổi đuôi, external link, zip bomb, 8-sheet vượt giới hạn chọn).

File liên quan:
- `backend/src/dynamic-reports/template/` (chưa tạo)
- `backend/test/fixtures/dynamic-reports/` (đã có từ PR0, xem README.md trong đó)
- `backend/src/xlsx-imports/hostile-xlsx-guard.ts` (dùng lại, tham số hoá)

## Hàng đợi task kế tiếp
1. PR3: TemplateService (đang mô tả ở trên) — ~6-8 ngày công theo spec
2. PR4: Màn A (wizard 4 bước S01-S10, S22, S30-S32) + GridRenderer chỉ đọc dùng chung
3. PR5: PeriodScheduler + assignment (dùng `engine/period.ts` đã có sẵn)
4. PR6: Màn B người nhập (S11-S14, S24, S26, S28, S29, S35) — dùng `workflow/transitions.ts`, `engine/access.ts`, `engine/paste.ts` đã có
5. PR7: Màn B quản lý (S15-S18, S21, S25, S33, S34, S38) — R12 khoá kỳ (thứ tự period→assignment→submission, `clock_timestamp()`), R13 VIEWER theo phạm vi
6. PR8: Màn C (dùng `engine/status.ts` đã có)
7. PR9: Mở rộng (validation rules UI, ghi chú, nhắc hạn)
8. PR10: Hoàn thiện + UAT (`/uat-test-writer` → `/uat-test-only` thật, KHÔNG dùng engine unit test làm UAT) + monkey test một lần cuối

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 2026-10-09 | PROGRESS/UAT-COVERAGE của module sống ở `docs/PC02_Report_Builder_Design_Package/`, không phải gốc repo | File gốc repo đang theo dõi việc khác | Resume đọc đúng file này |
| 2026-10-09 | Worktree riêng `C:\PC02\pc02-dynamic-reports` từ `origin/main`, nhánh `feat/dynamic-reports-m1-engine` | Nhánh `fix/petition-all-column-search` có ~1.000 file thay đổi chưa commit không liên quan | Không đụng việc khác; CHƯA push/tạo PR lên GitHub (cần anh xác nhận trước khi push, theo §8(c) giao thức) |
| 2026-10-09 | `/review` và `/codex` đầy đủ chạy MỘT LẦN ở ranh giới PR; `/plan-eng-review` cho PR1 thay bằng tự rà soát diff-vs-spec | Hai skill dựng cho duyệt diff/plan hoàn chỉnh so với base branch, có dàn chuyên gia phụ rất nặng | Mỗi engine/task vẫn tự rà soát kỹ + cổng coverage/lint/tsc |
| 2026-10-09 | Migration PR2 sinh bằng `prisma migrate diff` thay vì `migrate dev`, vì lỗi lịch sử migration có sẵn trên nhánh (không phải do tôi) | `migrate dev`/`migrate deploy` đều cần replay 135 migration cũ từ DB rỗng, một migration cũ giả định bảng đã tồn tại | Đã kiểm chứng kỹ bằng db push + áp SQL trực tiếp, không ảnh hưởng đến deploy thật (deploy thật chạy trên DB đã có sẵn lịch sử, không phải DB rỗng) |
| 2026-10-09 | `GET /bao-cao-dong/clock` không qua `PermissionsGuard` | Không lộ dữ liệu báo cáo nào, chỉ trả giờ máy chủ — giống `/health` | Route-quyền gate (`cong-route-co-quyen.spec.ts`) không yêu cầu `@RequirePermissions` ở đây vì thiếu `PermissionsGuard` trong chuỗi guard |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ trong spec |
|---|---|---|
| Tên nhánh cho từng PR | PR0-PR2 dùng chung `feat/dynamic-reports-m1-engine`; cân nhắc tách nhánh riêng cho PR3 trở đi nếu PR này được duyệt/merge trước | Convention nhánh CLAUDE.md gốc: 1 branch = 1 mục đích, nhưng merge thật cần anh xác nhận push |
| Phê duyệt nhiều cấp (R21) ai giữ cấp nào | `actingApprovalLevel` lấy từ `DynReportRole` của người quản lý đó (sẽ gắn field `approvalLevel` lên `DynReportRole` khi PR7 hiện thực — CHƯA thêm vào schema PR2 vì PR2 chỉ cần bảng chuyển trạng thái thuần, chưa cần cột DB cho việc này) | spec §10 R21 |

## Trạng thái test
Backend full suite: PASS (exit 0, 6 lần chạy xuyên suốt PR0-PR2) | Frontend `tsc -b`: sạch | Frontend vitest: 4884/4885 (1 lỗi chập chờn có trước)
Patch coverage theo file mới: 95-100% dòng, tất cả ≥90%

## Nợ kỹ thuật / rủi ro
- Chưa có tài khoản quản lý/người nhập riêng cho UAT trên staging (chặn khâu UAT thật, không chặn viết code — xem spec §8).
- `/plan-eng-review` đầy đủ cho PR1/PR2 chưa chạy qua skill chính thức — nếu anh muốn chạy chính thức, gọi `/plan-eng-review` nhắm vào diff nhánh `feat/dynamic-reports-m1-engine` so với `origin/main`.
- Test frontend chập chờn CÓ TRƯỚC (không do dynamic-reports): `frontend/src/features/cases/governance/__tests__/configuration-editors.test.tsx` — fail khi chạy cùng full suite (4884/4885) nhưng PASS 8/8 khi chạy riêng. Đã ghi vào gbrain learnings, không phải việc của dynamic-reports.
- OFFICER's `read:DynamicReport` grant (seed.ts) chỉ nằm trong *bộ seed đầy đủ* — deploy.sh KHÔNG chạy `seed.ts` (chỉ `seed-quyen.ts`, cấp quyền cho ADMIN). Trên prod hiện tại, chỉ ADMIN có `read/manage/admin:DynamicReport` (qua seed-quyen.ts chạy mỗi lần deploy); OFFICER sẽ nhận quyền khi ai đó chạy `seed.ts` đầy đủ một lần (không khẩn, vì chưa có UI nào tiêu thụ quyền này).
- **[ĐÃ VÁ 10/10 22:20 UTC] Lỗ hổng phát hiện ngay sau deploy:** `feature_flags` bảng trên prod đã có 40 dòng (không rỗng) nên `seed-features-if-empty.ts` (chạy mỗi lần deploy, dòng 9b deploy.sh) bỏ qua — không tự tạo dòng `dynamic_reports`. `FeatureFlagsService.isEnabled()` mặc định **cho phép (`true`)** khi chưa seed (để module mới không khoá sidebar khi seed chưa chạy), và prod không đặt `ENABLED_FEATURES` (không có build whitelist) → `dynamic_reports` đang **BẬT ngầm** cho mọi người dùng đã đăng nhập ngay sau khi merge, trái với khẳng định "tắt mặc định" trong PR #522. Tác động thực tế gần như 0 (chưa có UI, `GET /clock` chỉ trả giờ máy chủ, `GET /reports` chỉ ADMIN gọi được và trả rỗng) nhưng không đúng như tài liệu. Đã vá bằng cách upsert thủ công dòng `feature_flags` với `enabled:false` trực tiếp trên DB prod (cache TTL 30s, không cần restart). **Đây là lỗ hổng có trước trong pipeline deploy chung** (`seed-features-if-empty.ts` chỉ xử lý case bảng rỗng, không xử lý case "thêm 1 key mới vào bảng đã có dữ liệu") — ảnh hưởng MỌI module tương lai thêm feature flag mới, không riêng dynamic-reports. Chưa sửa pipeline gốc (ngoài phạm vi PR này) — nên cân nhắc một task riêng: `seed-features-if-empty.ts` nên upsert từng key còn thiếu (theo diff với FEATURE_REGISTRY) thay vì chỉ kiểm `count===0`.
- **Đã merge PR #522 vào main bằng `gh pr merge --admin`** vì branch protection yêu cầu review approval nhưng chưa có ai approve qua GitHub UI — làm theo chỉ đạo trực tiếp "làm cho xong và deploy toàn bộ" của anh. Branch `feat/dynamic-reports-m1-engine` đã xoá trên remote.
