# Domain Pack — Dynamic Report Builder (Báo cáo động PC02)

> Bước 0 của `uat-test-writer`. Mọi `rule_ref` trong `uat.json` trỏ về một `rule_id` ở đây.
> Nguồn: BRD/FRD/Basic Design/Detail Design gốc + **DECISIONS_20261009.md (D01–D10 và bảng
> AC sửa — THẮNG khi mâu thuẫn với FRD)** + ROLE_MATRIX_20261009.md + TRACEABILITY.csv +
> `~/.claude/plans/streamed-cuddling-catmull.md` (research gốc: 40 Excel thật + HSLN 228
> chỉ tiêu) + PROGRESS.md (PR0–PR9, trạng thái code thật).

## Pha A — Authority Brief (nguồn chân lý nghiệp vụ)

Domain: nội bộ (quy trình thu thập số liệu thống kê theo kỳ giữa các Đội/Tổ trong một đơn vị
Công an, KHÔNG phải pháp lý/y tế/thanh toán được quản chế bên ngoài) → research **nhẹ**,
neo vào tài liệu nội bộ đã chốt (D01–D10) + bằng chứng đo từ 40 file Excel thật đang dùng
(không phải luật/chuẩn ngành ngoài công bố).

| Nguồn | Trích dẫn | Hệ quả |
|---|---|---|
| Excel thật (HSLN + 39 mẫu khác) | "33/228 ô mở khoá nhập; 190/228 ô TỔNG ra `#REF!` vì sheet Tổ 10 hỏng" | Oracle của E07 (aggregate) **không được** lấy cache Excel làm chân lý — phải tự cộng bằng engine độc lập (oracle_type=`Product`, đối chiếu 228 dòng thật, xem UAT-COVERAGE E07) |
| Excel thật | `=IF(D10=D11+…+D16,TRUE,FALSE)` xuất hiện lặp lại | S36 validation rule phải gợi ý được rule dạng này từ công thức IF có sẵn trong mẫu |
| DECISIONS §D01–D10 | 10 quyết định chốt, ghi đè FRD khi khác | Mọi TC State/Decision neo vào D0x, không neo FRD gốc |
| Bảng AC sửa (DECISIONS cuối file) | AC-002/009/011/013/023/025 bản sửa | `oracle_source` của TC liên quan các AC này phải trích **bản sửa**, không phải FRD gốc |
| ROLE_MATRIX_20261009.md | quyền hệ thống × `DynReportRole`/`DynReportTargetEditor` độc lập hai tầng | Mọi TC PERMISSIONS phải thử đúng tổ hợp 2 tầng, không chỉ role hệ thống |

## Pha B — Ground vào repo

### D1 — Oracle table (rule_id → rule → nguồn → neo code)

| rule_id | Quy tắc | Nguồn | Neo code |
|---|---|---|---|
| D01-PERIOD-TYPE | 7 loại kỳ `DAILY/WEEKLY/MONTHLY/QUARTERLY/SEMI_ANNUAL/YEARLY/ONE_TIME`; ONE_TIME tạo đúng 1 kỳ | DECISIONS D01 | `backend/src/dynamic-reports/engine/period.ts`, E01 |
| D02-DEADLINE | Hạn `FIXED_IN_PERIOD`\|`DAYS_AFTER_END`; mở nhập đầu kỳ/N ngày trước hạn/open-future; dời hạn khỏi ngày nghỉ qua `CalendarEvent` | DECISIONS D02 | `engine/period.ts` + `CalendarEvent.expandOccurrences()` |
| D03-AGGREGATE-MODE | 3 chế độ tổng hợp `SUBMITTED`(mặc định)/`APPROVED`/`ALL_SAVED`("Tạm tính"); `blankPolicy` mặc định `ZERO`, field chọn được `IGNORE` | DECISIONS D03 + AC-025 sửa | `engine/aggregate.ts`, E07 |
| D04-WORKFLOW | Nộp = khoá ngay (AC-023 sửa). Duyệt/Trả lại(lý do+hạn sửa)/Huỷ duyệt. Chốt kỳ khoá cả kỳ+snapshot. Sửa sau chốt = ADJUSTMENT revision. Multi-level theo `Team.parentId` | DECISIONS D04 | `dynamic-reports/workflow/transitions.ts` (đã đọc — xem R21 dưới) |
| D05-FORMULA | `+ − * /`, `&`, so sánh, `SUM/AVERAGE/MIN/MAX/COUNT/ROUND/IF/AND/OR/ABS`; A1/vùng/chéo sheet; không eval; chặn vòng lặp+timeout; 2 tầng (cá nhân→tổng input→công thức tổng) | DECISIONS D05 | `engine/expr.ts`, E04 |
| D06-ASSIGNMENT-UNIT | Lượt giao = báo cáo×kỳ×**Tổ** (không phải người); editor mặc định = tổ trưởng (`UserTeam.isLeader`) | DECISIONS D06 | `config/*`, S09 |
| D07-UNLOCK | Ô mặc định không bắt buộc; mở khoá qua grant (mặc định +3h) hoặc tổ xin mở lại→manager duyệt/từ chối; mở khoá hàng loạt; thu hồi | DECISIONS D07 | `engine/access.ts` E08, `workflow/` S17/S34 |
| D08-CALENDAR-EDGE | 29–31 không tồn tại → cuối tháng; quý = tháng thứ 1/2/3+ngày; tuần theo ISO week-year; preview ≥6 kỳ | DECISIONS D08 | `engine/period.ts` E01, E11 date-math |
| D09-MIDFLIGHT-CHANGE | Đổi mẫu/lịch/phân công áp ngay cho kỳ đang chạy NẾU chưa tổ nào có số; có số rồi → áp từ kỳ kế tiếp | DECISIONS D09 | `config/` service, S22 |
| D10-PERMISSION | `read/manage/admin:DynamicReport` (role hệ thống) độc lập với `DynReportRole`(MANAGER/VIEWER)/`DynReportTargetEditor` (theo báo cáo); ≥1 MANAGER (không phải đúng 1, AC-011 sửa); ADMIN không sửa hộ số liệu | DECISIONS D10 + ROLE_MATRIX | `PermissionsGuard`, X01 |
| AC-002-FIX | Ô mở khoá rỗng/literal → **cảnh báo + gợi ý**, KHÔNG chặn publish (khác FRD gốc "báo lỗi"). Khoá+token / công thức ở ô mở khoá / ô nhập ẩn → vẫn chặn | DECISIONS bảng AC sửa | S03/S04 |
| R21-MULTILEVEL | `totalApprovalLevels`(default 1)/`approvalLevel` trên submission; APPROVE chỉ cho `actingApprovalLevel === approvalLevel+1`; UNAPPROVE chỉ cho `actingApprovalLevel === approvalLevel` (cấp thấp không huỷ ngầm cấp cao — BRD §6.3) | PROGRESS "Assumption đã tự quyết" + code thật | `workflow/transitions.ts` dòng 158-212 (đã đọc trực tiếp 11/10/2026) |
| R22-REPORTINGUNIT-GAP | `ReportingUnit=USER` (gán theo người thay theo tổ) | Brief PR9 | **GAP xác nhận bằng code**: `grep -r "ReportingUnit" backend/src` = 0 kết quả → CHƯA hiện thực. Mọi TC R22 ghi `oracle_type:"GAP"`, không viết TC khẳng định hành vi không tồn tại |
| S36-VALIDATION | ERROR chặn SUBMIT (`hasErrorSeverityRuleViolation` guard trong `applySubmit`), WARNING cần xác nhận không chặn; gợi ý rule từ `IF(a=b,TRUE,FALSE)` trong template | Brief PR9 + `transitions.ts` dòng 125-127 | `backend/src/dynamic-reports` (module S36 — cần Explore thêm khi viết TC chi tiết) |
| S37-NOTES | Ghi chú theo `fieldKey` (ô) và `fieldKey=null` (cả bản nộp); editor+manager đọc/viết | Brief PR9 | PROGRESS "PR9 slice 2 (S37)" |
| REMINDER-DEDUP | 3 mốc T-3D/T-24H/T-3H, chỉ gửi tổ `NOT_STARTED/DRAFT/RETURNED` (chưa nộp), `obligation=EXEMPT` bỏ qua, unique `(assignmentId, window)` chống trùng, non-blocking advisory lock (tick trước chưa xong → bỏ qua) | Code thật đã đọc | `schedule/reminder-scheduler.service.ts` (đã đọc trực tiếp dòng 1-140) |
| NOTIF-ICONS | 6 loại `DynReport*` phải có icon riêng trong `NotificationDropdown`, không rơi về SYSTEM | Brief PR9 | `frontend/src/components/NotificationDropdown.tsx` |

### D2 — Persona (End User thật, theo ROLE_MATRIX)

| persona | Vai hệ thống | Vai trong báo cáo | Mục tiêu |
|---|---|---|---|
| `nguoi-thiet-lap` | `manage:DynamicReport` (thường ADMIN/HEAD_UNIT được cấp riêng) | configurer | Tạo mẫu, cấu hình kỳ, phân công, xuất bản |
| `manager` | bất kỳ role có `read:DynamicReport` | `DynReportRole=MANAGER` | Xem tổng hợp, duyệt/trả lại/chốt kỳ, mở khoá |
| `viewer` | bất kỳ role có `read:DynamicReport` | `DynReportRole=VIEWER` (có thể giới hạn `teamScopeId`) | Chỉ xem, không ghi |
| `editor-to` | bất kỳ role có `read:DynamicReport` | `DynReportTargetEditor` của đúng 1 tổ | Nhập/sửa/nộp số liệu tổ mình |
| `nguoi-hai-vai` | — | vừa MANAGER báo cáo X vừa editor tổ Y | Kiểm công tắc mode, write luôn theo quyền thật không theo query param (AC-035) |
| `admin-chi-doc` | `admin:DynamicReport` | — | Xem toàn bộ chỉ-đọc, huỷ chốt kỳ, miễn nộp — KHÔNG sửa số liệu hộ |
| `nguoi-vo-danh` | không có `read:DynamicReport` | — | Mọi route phải 403/404, không lộ tồn tại báo cáo (X01) |

### D3 — State map (submission, theo code thật `transitions.ts`)

```
NOT_STARTED/DRAFT/RETURNED --SAVE(EDITOR)--> DRAFT
NOT_STARTED/DRAFT/RETURNED --SUBMIT(EDITOR, guard: required valid + 0 ERROR rule)--> SUBMITTED (approvalLevel=0)
SUBMITTED --RETURN(MANAGER/ADMIN)--> RETURNED (approvalLevel=0, notify DYN_REPORT_RETURNED)
SUBMITTED --APPROVE(MANAGER actingLevel=approvalLevel+1)--> SUBMITTED (approvalLevel++) nếu chưa đủ cấp
                                                          --> APPROVED nếu đủ totalApprovalLevels (notify DYN_REPORT_APPROVED)
APPROVED --UNAPPROVE(MANAGER actingLevel=approvalLevel)--> SUBMITTED (approvalLevel--)
```
Sneak path phải RED: SAVE từ SUBMITTED/APPROVED (guard state), SUBMIT từ APPROVED, RETURN từ
DRAFT/APPROVED, APPROVE bởi EDITOR, APPROVE sai cấp (`actingLevel != approvalLevel+1`),
UNAPPROVE bởi cấp không phải cấp cao nhất đã duyệt.

### D4 — Journeys chính (E2E bắt buộc — map vào `_platform.json` persona×journey)

| journey_ref | Mô tả | Persona | Màn hình (S) |
|---|---|---|---|
| J-WIZARD-01 | Tạo báo cáo mới từ upload Excel → publish | nguoi-thiet-lap | S01→S02→S03→(S04 lỗi)→S05/06/07/08→S09→S10 |
| J-ENTRY-01 | Tổ nhập số liệu, lưu, nộp, bị trả lại, sửa lại nộp | editor-to | S11→S12→(S13 khoá)→(S14 mở lại) |
| J-REVIEW-01 | Manager xem tổng hợp, duyệt nhiều cấp, chốt kỳ | manager | S15→S18→S33→S38 |
| J-UNLOCK-01 | Tổ xin mở lại → manager duyệt hàng loạt | editor-to + manager | S17→S34 |
| J-DASH-01 | Dashboard tình trạng, drilldown ma trận, biểu đồ | manager/viewer | S19→S20→S27 |
| J-RULE-01 | Soạn validation rule, gợi ý từ IF, nộp bị chặn ERROR/cảnh báo WARNING | nguoi-thiet-lap + editor-to | S36→S11/S12 |
| J-NOTE-01 | Ghi chú theo ô và theo bản nộp, cả hai vai đọc/viết | editor-to + manager | S37 |
| J-REMIND-01 | Nhắc hạn 3 mốc, chỉ tổ chưa nộp, không trùng | (hệ thống, không UI trực tiếp — observable qua `NotificationDropdown` + DB) | — (xuyên suốt) |
| J-EXPORT-01 | Xuất Excel đúng layout/typed values/snapshot | manager | S25 |
| J-AUDIT-01 | Lịch sử/audit đầy đủ, không sửa được từ UI | manager/admin-chi-doc | S21 |

### D5 — Builders / seeding (dùng API thật, không SQL ghi trực tiếp trừ seed baseline)
- Tạo user/role: script Node `pg` tham số hoá (theo PROGRESS — KHÔNG nối chuỗi UTF-8 vào shell arg).
- Tạo report/period/assignment: qua API wizard thật (S01→S10) — vì đây chính là journey cần verify.
- Clock: `now` tham số hoá ở mọi engine (xác nhận trong `reminder-scheduler.service.ts`) → test boundary bằng cách gọi `sendDueReminders(tx, fixedDate)` trực tiếp cho UNIT, và set `dueAt` fixture gần hiện tại cho E2E/API thật.

### D6 — Mock-allowlist
- Không mock DB/Prisma nội bộ.
- Không có 3rd-party bên ngoài (không email/SMS thật trong scope này — notification là in-app).
- Mock duy nhất có lý do: clock cho UNIT test của scheduler (đã có sẵn qua tham số `now`, không cần mock module).

## Entry-criteria waiver (BẮT BUỘC đọc trước khi GO/NO-GO)

> **WAIVER-ENV-01**: Môi trường UAT thật là **DEV CỤC BỘ** (`127.0.0.1:5433`, DB
> `pc02_dynamic_reports_test`), KHÔNG phải named staging/production-like env riêng theo
> đúng nghĩa Entry Criteria ISO 29119-2. Lý do: 5 tài khoản UAT thử cũ trên staging đã bị
> khoá (lộ mật khẩu repo public, 20/09/2026 — xem memory `project_lo_mat_khau_repo_public`),
> chưa có tài khoản UAT riêng mới được cấp (PROGRESS.md "Đang làm dở" + "Nợ kỹ thuật").
> Risk acceptance: dev cục bộ dùng ĐÚNG mã nguồn + schema migration của nhánh
> `feat/dynamic-reports-pr10-uat` (từ `origin/main` mới nhất, đã merge PR9), nên hành vi
> tương đương staging ở tầng ứng dụng; rủi ro còn lại là KHÔNG kiểm được cấu hình hạ tầng
> thật (nginx, systemd, biến môi trường prod, feature flag thật trên VM — các mục này đã có
> X07 riêng, không thuộc entry criteria này). **Remediation**: khi anh cấp tài khoản UAT
> staging, chạy lại tối thiểu các TC P0/SECURITY trên staging trước khi ký UAT-905 chính
> thức. Approver cho waiver này: chưa có named approver bằng văn bản — ghi nhận là **GAP cần
> người** (không tự coi là đã được duyệt).

## Mobile — N/A (Bước 0.7 rút gọn)

Dynamic Report Builder **không có bản mobile** (`grep -r "pubspec.yaml\|react-native" .` ở
root PC02 chỉ khớp app PC02 Mobile — module khác, không phải báo cáo động). 12 danh mục
MOBILE-ONLY (PERMISSIONS/DEEPLINK/PUSH/OFFLINE/LIFECYCLE/GESTURE/SCREENSIZE/BIOMETRIC/
INTERRUPT/INSTALL/MOBILE-A11Y/MOBILE-SEC) = **N/A toàn bộ — lý do: platform=WEB only, xác
nhận bằng cấu trúc thư mục `frontend/` (Vite+React, không có `capacitor.config`/
`app.json`/Android-iOS project nào tham chiếu route `dynamic-reports`)**.
