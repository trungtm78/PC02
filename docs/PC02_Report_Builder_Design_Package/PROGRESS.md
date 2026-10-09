# PROGRESS — Dynamic Report Builder (Báo cáo động)
Cập nhật: 2026-10-09T16:35:00+07:00 | Milestone: PR1/11 ĐÃ XONG → bắt đầu PR2 | Task: 0/4

## Đã hoàn thành
- [x] PR0 — spec, fixture (HSLN+5 mẫu thật+oracle+5 file độc hại giả lập), DECISIONS_20261009.md, ROLE_MATRIX_20261009.md — commit 2f077843
- [x] PR1-E1 decimal.ts — 36 test, 100% dòng — commit 2b571f0b
- [x] PR1-E2 values.ts — 39 test, 98.6% dòng — commit 2b571f0b
- [x] PR1-E3 token.ts — 27 test, 100% dòng — commit 2b571f0b
- [x] PR1-E4 date-math.ts (dùng chung) — 32 test, 100% dòng — commit 867a5bad
- [x] PR1-E5 period.ts — 25 test, 100% dòng (7 loại kỳ, đúng mọi ví dụ FRD §5) — commit 867a5bad
- [x] PR1-E6 expr.ts — 52 test, 93% dòng (bộ tính công thức + validation rule) — commit 2bfb0efc
- [x] PR1-E7 aggregate.ts — 12 test, 100% dòng, **đối chiếu đúng oracle HSLN thật (228 dòng, kể cả 190 dòng Excel tự tính sai #REF!)** — commit 62ad767d
- [x] PR1-E8 access.ts — 18 test, 100% dòng (biên T-1ms/T/T+1ms) — commit e61a41bd
- [x] PR1-E9 status.ts — 17 test, 100% dòng (KPI, mẫu số 0 → "—") — commit f74ef5f4
- [x] PR1-E10 paste.ts — 16 test, 100% dòng — commit 4a44305d
- [x] PR1 gen:dr-engine — sinh bản sao frontend, 2 cổng (byte bằng nhau + ranh giới import), sửa lỗi `erasableSyntaxOnly` ở expr.ts — commit e73a8501

**PR1 TỔNG: 274 test engine, toàn bộ xanh. Backend full suite (~1750+ test) xanh. Frontend tsc -b sạch.**

### Tự rà soát PR1 so với spec §6.1 (thay cho /plan-eng-review đầy đủ — xem ghi chú bên dưới)
Đối chiếu từng dòng checklist PR1 trong spec: Token, Period, Decimal, Values, Expr, Aggregate, Access, Status, Paste — **đủ cả**, không sót mục nào. Chi tiết từng bug thật đã bắt và sửa trong lúc TDD (không phải vá tạm, đã ghi trong từng commit message):
- decimal.ts: 2 lỗi logic phân biệt dấu chấm phân nhóm/thập phân.
- expr.ts: parser có thể tràn ngăn xếp với công thức lồng quá sâu (đã thêm giới hạn độ sâu); bỏ sót kiểm tra `[` bên trong tên sheet có nháy đơn (tham chiếu workbook ngoài).
- status.ts: điều kiện "đã nộp" ban đầu chỉ tính APPROVED, sửa thành SUBMITTED+APPROVED đúng D04.
- expr.ts (gen:dr-engine): cú pháp rút gọn tham số constructor không tương thích `erasableSyntaxOnly` của frontend — chỉ lộ ra khi chạy `tsc -b` phía frontend, không phải lúc chạy test backend.

## Đang làm dở
Task: Chuẩn bị PR2 — Nền tảng (schema + migration + quyền + feature flag)
Đã làm: Chưa bắt đầu.

BƯỚC TIẾP THEO: Thêm 19 model Prisma (DynReport, DynReportVersion, DynReportField, DynReportValidationRule, DynReportSchedule, DynReportRole, DynReportTarget(+Editor), DynReportPeriod, DynReportAssignment(+Editor), DynReportSubmission, DynReportRevision, DynReportUnlock, DynReportComment, DynReportSnapshot, DynReportExport, DynReportIdempotency) theo spec §4.3 (đã áp R1: bỏ DynReportFormula, công thức nằm trong layout). Thêm quyền `read/manage/admin:DynamicReport` vào SEED_PERMISSIONS. Tạo feature.manifest.ts + đăng ký feature-registry.ts. `GET /clock`. TDD cho `SubmissionWorkflowService` (R1: bảng TRANSITIONS khai báo).

File liên quan:
- `backend/prisma/schema.prisma` (chưa sửa)
- `backend/prisma/seed-permissions.ts`
- `backend/src/dynamic-reports/feature.manifest.ts` (chưa tạo)
- `backend/src/dynamic-reports/workflow/` (chưa tạo)

## Hàng đợi task kế tiếp
1. PR2: Schema + migration (CREATE INDEX thường, không CONCURRENTLY — bài học v0.40) + quyền + feature flag + khung module + `GET /clock` + `SubmissionWorkflowService`/TRANSITIONS (R1)
2. PR3: TemplateService (parse trong worker_threads R6, shared formula + locked hiệu lực R3, giới hạn hai tầng file/sheet-đã-chọn)
3. PR4: Màn A (wizard 4 bước + GridRenderer chỉ đọc dùng chung)
4. PR5: PeriodScheduler + assignment (dùng `period.ts` đã có)
5. PR6: Màn B người nhập
6. PR7: Màn B quản lý (R12 khoá kỳ, R13 VIEWER theo phạm vi, R21 phê duyệt nhiều cấp)
7. PR8: Màn C (dùng `status.ts` đã có)
8. PR9: Mở rộng (validation rules UI, ghi chú, nhắc hạn)
9. PR10: Hoàn thiện + UAT + monkey test

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 2026-10-09 | PROGRESS/UAT-COVERAGE của module sống ở `docs/PC02_Report_Builder_Design_Package/`, không phải gốc repo | File gốc repo đang theo dõi việc khác | Resume đọc đúng file này |
| 2026-10-09 | Worktree riêng `C:\PC02\pc02-dynamic-reports` từ `origin/main` | Nhánh `fix/petition-all-column-search` có ~1.000 file thay đổi chưa commit không liên quan | Không đụng việc khác |
| 2026-10-09 | `/review` và `/codex` đầy đủ chạy MỘT LẦN ở ranh giới PR, không chạy từng engine nhỏ; `/plan-eng-review` cho PR1 thay bằng tự rà soát diff-vs-spec (ghi ở trên) | Cả hai skill dựng cho duyệt một diff/plan đã hoàn chỉnh so với base branch, có dàn chuyên gia phụ rất nặng — không hợp để chạy lặp lại cho mỗi hàm thuần nhỏ giữa TDD | Mỗi engine vẫn được tự rà soát kỹ + cổng coverage/lint/tsc; review nặng dành cho ranh giới PR |
| 2026-10-09 | `date-math.ts` tách từ `values.ts` ngay trong PR1 (chưa đợi refactor sau) | `period.ts` cần cùng logic lịch; tránh trùng lặp ngay từ đầu | Không ảnh hưởng hành vi, 39/39 values test vẫn xanh sau refactor |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ trong spec |
|---|---|---|
| Tên nhánh cho từng PR | PR0+PR1 dùng chung `feat/dynamic-reports-m1-engine`; mỗi PR sau tạo nhánh riêng từ `main` khi PR trước đã merge | Convention nhánh CLAUDE.md gốc: 1 branch = 1 mục đích |
| `expr.ts` xử lý "&" (nối chuỗi) | Chặn với TYPE_ERROR ở engine số — grammar D05 liệt kê "&" nhưng engine này chỉ có kiểu number/boolean; TEXT không tham gia công thức | FRD §4.5: TEXT không tổng hợp/không tính công thức |
| "Paste qua merge" | Không có khái niệm merge riêng trong `paste.ts`; mọi tính không-sửa-được (khoá, merge phụ) đi qua cùng callback `isEditable` do caller (PR3/PR6) cung cấp | Giữ paste.ts không phụ thuộc cấu trúc workbook, đúng ranh giới engine thuần |

## Trạng thái test
Backend full suite: PASS (exit 0, chạy 2 lần sau PR1) | Frontend `tsc -b`: sạch | Frontend vitest full suite: đang chạy lúc ghi file này
Patch coverage theo engine: 95-100% dòng, tất cả ≥90%

## Nợ kỹ thuật / rủi ro
- Chưa có tài khoản quản lý/người nhập riêng cho UAT trên staging (chặn khâu UAT, không chặn viết code — xem spec §8).
- `/plan-eng-review` đầy đủ cho PR1 chưa chạy qua skill chính thức (xem quyết định kiến trúc ở trên) — nếu anh muốn chạy chính thức, gọi `/plan-eng-review` nhắm vào diff nhánh `feat/dynamic-reports-m1-engine`.
