# PROGRESS — Dynamic Report Builder (Báo cáo động)
Cập nhật: 2026-10-09T16:10:00+07:00 | Milestone: PR1/11 | Task: 3/9 engine

Spec: `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md` (§6.1 có checklist đầy đủ từng PR).
Worktree: `C:\PC02\pc02-dynamic-reports`, nhánh `feat/dynamic-reports-m1-engine` từ `origin/main`.

## Đã hoàn thành
- [x] PR0 — spec, fixture (HSLN+5 mẫu thật+oracle+5 file độc hại giả lập), DECISIONS_20261009.md, ROLE_MATRIX_20261009.md — commit 2f077843
- [x] PR1 engine decimal.ts — 36/36 test, 100% line — commit 2b571f0b
- [x] PR1 engine values.ts — 39/39 test, 98.6% line — commit 2b571f0b
- [x] PR1 engine token.ts — 27/27 test, 100% line — commit 2b571f0b

## Đang làm dở
Task: PR1 engine period.ts (+ date-math.ts dùng chung với values.ts)
Đã làm:
- `date-math.ts` viết xong (daysInMonth, isValidCalendarDate, clampDayToMonthEnd, addDays, isoWeekday, isoWeekInfo/isoWeekMonday, quarterOfMonth) — CHƯA có spec riêng, CHƯA refactor values.ts dùng chung (values.ts đang có bản sao nội bộ của daysInMonth/isValidCalendarDate).

BƯỚC TIẾP THEO:
1. Viết `date-math.spec.ts` (TDD ngược — code đã viết trước khi viết test, cần RED giả định bằng cách xoá tạm rồi viết lại, hoặc chấp nhận viết test sau và coi là vi phạm nhỏ cần sửa: ưu tiên refactor values.ts dùng date-math.ts trước, viết spec cho date-math.ts đầy đủ, rồi mới viết period.spec.ts).
2. Viết `period.spec.ts` theo đúng ví dụ FRD §5: tuần 41/2026 (05–11/10, khoá 09/10 17:00); tháng 10 khoá 31/10 17:00; tháng 2/2027 cấu hình ngày 31 → hạn 28/02 17:00; quý IV tháng 3/ngày 25 → 25/12 17:00; tuần giao năm; năm nhuận; QIV→QI; kỳ bắt đầu ngày 21→20; DAYS_AFTER_END rơi ngày nghỉ; DAILY; ONE_TIME; cảnh báo "kỳ chưa kết thúc mà đã khoá".
3. Viết `period.ts` implement theo spec §4.1.

File liên quan:
- `backend/src/dynamic-reports/engine/date-math.ts` (viết xong, chưa test độc lập, chưa commit)
- `backend/src/dynamic-reports/engine/period.ts` (chưa tạo)

## Hàng đợi task kế tiếp
1. PR1 engine period.ts (đang làm, xem trên)
2. PR1 engine expr.ts (SUM/IF/AVERAGE/MIN/MAX/COUNT/ROUND/AND/OR/ABS, vòng lặp, PREV)
3. PR1 engine aggregate.ts (dùng oracle HSLN ở `backend/test/fixtures/dynamic-reports/real/hsln-oracle.json`)
4. PR1 engine access.ts, status.ts, paste.ts
5. Chạy /review + /codex MỘT LẦN cho toàn bộ PR1 (đã quyết định: không chạy per-engine, xem learnings-log `review-codex-granularity-pr-not-function`), rồi `/plan-eng-review` đối chiếu spec (giao thức §6), merge PR1
6. PR2: Schema + migration + quyền + feature flag

## Quyết định kiến trúc
| Ngày | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 2026-10-09 | PROGRESS/UAT-COVERAGE của module sống ở `docs/PC02_Report_Builder_Design_Package/`, không phải gốc repo | File gốc repo (`/PROGRESS.md`, `/UAT-COVERAGE.md`) đang theo dõi việc khác (petition search) | Resume đọc đúng file này |
| 2026-10-09 | Worktree riêng từ `origin/main`, không dùng nhánh `fix/petition-all-column-search` | Nhánh đó có ~1.000 file thay đổi chưa commit không liên quan | Không đụng việc khác |

## Assumption đã tự quyết
| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ trong spec |
|---|---|---|
| Tên nhánh cho từng PR | `feat/dynamic-reports-m1-engine` cho PR0+PR1; mỗi PR sau tạo nhánh riêng từ `main` khi PR trước đã merge | Convention nhánh của CLAUDE.md gốc: 1 branch = 1 mục đích |

## Trạng thái test
Full suite: CHƯA CHẠY (đang dựng fixture) | Patch coverage: N/A | Test fail: không có task nào bắt đầu

## Nợ kỹ thuật / rủi ro
- Chưa có tài khoản quản lý/người nhập riêng cho UAT trên staging (chặn khâu UAT, không chặn viết code — xem spec §8).
