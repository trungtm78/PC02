# PROGRESS — Dynamic Report Builder (Báo cáo động)
Cập nhật: 2026-10-09T15:30:00+07:00 | Milestone: PR0/11 | Task: 0/5

Spec: `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md` (§6.1 có checklist đầy đủ từng PR).
Worktree: `C:\PC02\pc02-dynamic-reports`, nhánh `feat/dynamic-reports-m1-engine` từ `origin/main`.

## Đã hoàn thành
(chưa có task nào commit)

## Đang làm dở
Task: PR0 — Spec, fixture, ma trận vai trò
Đã làm:
- Git worktree tạo xong, backend + frontend `npm ci` xong.
- Spec đã copy vào `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md`.
- `docs/PC02_Report_Builder_Design_Package/` đã copy sang worktree, thêm `DECISIONS_20261009.md` (D01–D10 + bảng AC sửa).
- File `PROGRESS.md` này và `UAT-COVERAGE.md` đã dựng khung.

BƯỚC TIẾP THEO: Dựng `backend/test/fixtures/dynamic-reports/` (copy HSLN + bao_cao_ngay.xlsx + A09/A10/PL7 từ repo gốc `docs/`, viết script oracle tự cộng 16 sheet đơn vị bằng Python, sinh file độc hại giả lập: macro .xlsm đổi đuôi, zip bomb, file mã hoá). Sau đó `git add -A && git commit` cho PR0, rồi vào PR1 (engine thuần) theo TDD.

File liên quan:
- `backend/test/fixtures/dynamic-reports/` (chưa tạo)
- `docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md`

## Hàng đợi task kế tiếp
1. PR0-T2: Fixture Excel thật + oracle script + file độc hại giả lập
2. PR0-T3: Ma trận vai trò (gate UAT-901) — ghi vào UAT-COVERAGE.md
3. PR0-T4: Commit PR0
4. PR1: Engine thuần (period, token, template-parser, expr, decimal, values, aggregate, access, status, paste) — TDD từng engine, xem spec §6.1 PR1

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
