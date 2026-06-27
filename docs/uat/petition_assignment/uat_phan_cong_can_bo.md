# UAT Test Cases — petition_assignment

**Generated**: 08/06/2026 03:44  
**Complexity**: `High`  
**Total TC**: 240  
**Companion Excel**: file `.xlsx` cùng tên trong thư mục này

## 🤖 Hướng dẫn cho Claude Code

File này được thiết kế để Claude Code đọc khi cần **fix bug** từ kết quả UAT.

**Workflow**:
1. Đọc section `## TC-XXX` của TC bị fail để hiểu context
2. Đọc `### 🔧 Fix Context` để biết khu vực code cần kiểm tra
3. Edit code → chạy lại test → đánh dấu `**Status**: Verified` trong Bug Report
4. File `.xlsx` companion được update bởi runner — KHÔNG edit thủ công

**Quy ước parsing**:
- TC ID nằm trong heading `## TC-XXX` (anchor-able)
- Bug report ở format YAML trong code fence
- Checklist `- [ ]` có thể tick bằng cách thay thành `- [x]`
- Test Data ở section riêng — load 1 lần dùng cho nhiều TC

## 🔍 Self-Audit

**Tổng số TC**: 240

**Phân bố loại**:
- `RED`: 96
- `SECURITY`: 24
- `GREEN`: 18
- `EP`: 18
- `BOUNDARY`: 18
- `A11Y`: 12
- `COMPAT`: 12
- `STATE`: 10
- `PERFORMANCE`: 8
- `DECISION`: 6
- `DATA`: 5
- `EDGE`: 5
- `INTEGRATION`: 4
- `REGRESSION`: 4

**Phân bố priority**:
- 🔴 `P0`: 68
- 🟠 `P1`: 97
- 🟡 `P2`: 75

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 68
- ⚠️ `High`: 65
- ⚡ `Medium`: 81
- 📌 `Low`: 26

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | GET /assignments | GET /assignments trả về danh sách 2 phân công đúng format | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | GET /assignments | GET /assignments trả về [] khi chưa có phân công | ⚠️ High |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | GET /assignments | GET /assignments — response có đủ fields user.username, assignedBy | ⚠️ High |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | GET /assignments | GET /assignments — response sắp xếp theo assignedAt tăng dần | ⚡ Medium |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | POST /assignments | POST /assignments — thêm phân công với role SUPPORT → 201 | 🚨 Critical |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` | POST /assignments | POST /assignments — thêm phân công với role LEAD → 201 | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | POST /assignments | POST /assignments — không gửi role → default SUPPORT | ⚠️ High |
| [TC-008](#tc-008) | 🔴 P0 | `GREEN` | DELETE /assignments | DELETE /assignments/:userId — xóa thành công → 200 + {success:true} | 🚨 Critical |
| [TC-009](#tc-009) | 🔴 P0 | `GREEN` | PATCH /assign | PATCH /assign — auto-gán trưởng đội khi không gửi assignedToId | 🚨 Critical |
| [TC-013](#tc-013) | 🔴 P0 | `GREEN` | UI Phân công | UI — danh sách 2 assignments hiển thị đúng sau load | 🚨 Critical |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` | UI Phân công | UI — nút Thêm disabled khi chưa chọn cán bộ | ⚠️ High |
| [TC-015](#tc-015) | 🔴 P0 | `GREEN` | UI Phân công | UI — chọn cán bộ → nút Thêm enabled → click → assignment xuất hiện | 🚨 Critical |
| [TC-017](#tc-017) | 🔴 P0 | `GREEN` | UI Phân công | UI — click xóa → assignment biến mất, user về dropdown | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `GREEN` | UI Phân công | UI — user đã assigned không hiển thị trong dropdown Cán bộ | 🚨 Critical |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | GET /assignments | GET /assignments — không có JWT → 401 | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — không có JWT → 401 | 🚨 Critical |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | DELETE /assignments | DELETE /assignments — không có JWT → 401 | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — không có JWT → 401 | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — user chỉ có quyền read Petition (không có edit) → 403 | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | DELETE /assignments | DELETE /assignments — user chỉ có quyền read → 403 | 🚨 Critical |
| [TC-025](#tc-025) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — user không có DispatchGuard role → 403 | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | GET /assignments | GET /assignments — petitionId không tồn tại → 404 | ⚠️ High |
| [TC-027](#tc-027) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — petitionId không tồn tại → 404 | ⚠️ High |
| [TC-028](#tc-028) | 🔴 P0 | `RED` | DELETE /assignments | DELETE /assignments — petitionId không tồn tại → 404 | ⚠️ High |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | DELETE /assignments | DELETE /assignments — userId không có assignment → 404 | ⚠️ High |
| [TC-030](#tc-030) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — JWT hết hạn → 401 | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — thêm user đã assigned → 409 ConflictException | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — P2002 race condition (2 request đồng thời cùng userId) → 409 | 🚨 Critical |
| [TC-033](#tc-033) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — petition bị soft-delete (deletedAt ≠ null) → 404 | 🚨 Critical |
| [TC-034](#tc-034) | 🔴 P0 | `RED` | DELETE /assignments | DELETE /assignments — petition đã soft-delete → 404 | ⚠️ High |
| [TC-035](#tc-035) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — teamId không tồn tại trong DB → 400 | ⚠️ High |
| [TC-036](#tc-036) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — team tồn tại nhưng isActive=false → 400 | ⚠️ High |
| [TC-037](#tc-037) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — assignedToId không thuộc assignedTeamId → 400 | ⚠️ High |
| [TC-038](#tc-038) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — expectedUpdatedAt không khớp → 409 (optimistic lock) | 🚨 Critical |
| [TC-040](#tc-040) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — thiếu userId (body rỗng) → 400 | ⚠️ High |
| [TC-041](#tc-041) | 🔴 P0 | `RED` | POST /assignments | POST /assignments — userId = null → 400 | ⚠️ High |
| [TC-052](#tc-052) | 🔴 P0 | `RED` | PATCH /assign | PATCH /assign — team không có isLeader=true → fail-open, assignedToId = null | ⚡ Medium |
| [TC-058](#tc-058) | 🔴 P0 | `RED` | UI Phân công | UI — nút Thêm disabled khi đang loading (isAdding=true) | ⚠️ High |
| [TC-091](#tc-091) | 🔴 P0 | `EP` | POST /assignments | EP — role partition LEAD → PASS | 🚨 Critical |
| [TC-092](#tc-092) | 🔴 P0 | `EP` | POST /assignments | EP — role partition SUPPORT → PASS | 🚨 Critical |
| [TC-095](#tc-095) | 🔴 P0 | `EP` | GET /assignments | EP — petition partition: TIEP_NHAN → có thể GET assignments | ⚠️ High |
| [TC-096](#tc-096) | 🔴 P0 | `EP` | GET /assignments | EP — petition partition: DA_CHUYEN_VU_VIEC → có thể GET assignments | ⚡ Medium |
| [TC-097](#tc-097) | 🔴 P0 | `EP` | POST /assignments | EP — user partition: user trong cùng team với petition → PASS | ⚠️ High |
| [TC-099](#tc-099) | 🔴 P0 | `EP` | PATCH /assign | EP — team partition: team active với leader → auto-assign | 🚨 Critical |
| [TC-100](#tc-100) | 🔴 P0 | `EP` | PATCH /assign | EP — team partition: team active, không leader → fail-open | ⚡ Medium |
| [TC-101](#tc-101) | 🔴 P0 | `EP` | PATCH /assign | EP — team partition: team inactive → 400 | ⚠️ High |
| [TC-107](#tc-107) | 🔴 P0 | `STATE` | Petition Assignment | STATE — petition không có assignment (s0) → POST → có 1 assignment (s1) | 🚨 Critical |
| [TC-108](#tc-108) | 🔴 P0 | `STATE` | Petition Assignment | STATE — có 1 assignment (s1) → POST user mới → 2 assignments (s2) | 🚨 Critical |
| [TC-109](#tc-109) | 🔴 P0 | `STATE` | Petition Assignment | STATE — có 2 assignments (s2) → DELETE 1 → 1 assignment còn (s1) | 🚨 Critical |
| [TC-110](#tc-110) | 🔴 P0 | `STATE` | Petition Assignment | STATE — có 1 assignment (s1) → DELETE → không còn assignment (s0) | 🚨 Critical |
| [TC-112](#tc-112) | 🔴 P0 | `STATE` | Petition Assignment | STATE — PATCH /assign team-A (no leader) → PATCH /assign team-B (has leader) → assignedToId = leaderB | ⚠️ High |
| [TC-117](#tc-117) | 🔴 P0 | `DECISION` | PATCH /assign | DECISION — assignedToId provided + trong team → gán cụ thể người đó | 🚨 Critical |
| [TC-118](#tc-118) | 🔴 P0 | `DECISION` | PATCH /assign | DECISION — assignedToId provided + KHÔNG trong team → 400 (xử lý lỗi trước khi auto) | 🚨 Critical |
| [TC-119](#tc-119) | 🔴 P0 | `DECISION` | PATCH /assign | DECISION — assignedToId null + team có leader → auto-gán leader | 🚨 Critical |
| [TC-120](#tc-120) | 🔴 P0 | `DECISION` | PATCH /assign | DECISION — assignedToId null + team không có leader → fail-open (null) | 🚨 Critical |
| [TC-123](#tc-123) | 🔴 P0 | `SECURITY` | GET /assignments | SECURITY — GET không auth → 401 | 🚨 Critical |
| [TC-124](#tc-124) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — POST không auth → 401 | 🚨 Critical |
| [TC-125](#tc-125) | 🔴 P0 | `SECURITY` | DELETE /assignments | SECURITY — DELETE không auth → 401 | 🚨 Critical |
| [TC-126](#tc-126) | 🔴 P0 | `SECURITY` | PATCH /assign | SECURITY — PATCH /assign không auth → 401 | 🚨 Critical |
| [TC-127](#tc-127) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — JWT tampered (signature invalid) → 401 | 🚨 Critical |
| [TC-128](#tc-128) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — JWT với algorithm 'none' → 401 | 🚨 Critical |
| [TC-129](#tc-129) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — POST với viewer role (không có edit Petition) → 403 | 🚨 Critical |
| [TC-130](#tc-130) | 🔴 P0 | `SECURITY` | PATCH /assign | SECURITY — PATCH /assign với non-dispatcher role → 403 | 🚨 Critical |
| [TC-131](#tc-131) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — Mass assignment: POST body với assignedById → ignored (actorId từ JWT) | 🚨 Critical |
| [TC-132](#tc-132) | 🔴 P0 | `SECURITY` | GET /assignments | SECURITY — Response không có sensitive fields (password hash, salt, twoFaSecret) | 🚨 Critical |
| [TC-133](#tc-133) | 🔴 P0 | `SECURITY` | POST /assignments | SECURITY — SQL injection trong userId path → không execute | 🚨 Critical |
| [TC-150](#tc-150) | 🔴 P0 | `INTEGRATION` | Full flow | INTEGRATION — Tạo petition → PATCH assign → GET assignments → DELETE → GET rỗng | 🚨 Critical |
| [TC-151](#tc-151) | 🔴 P0 | `INTEGRATION` | UI + API | INTEGRATION — PetitionFormPage edit: thêm assignment qua UI → reload page → vẫn còn | 🚨 Critical |
| [TC-010](#tc-010) | 🟠 P1 | `GREEN` | PATCH /assign | PATCH /assign — gán với assignedToId hợp lệ trong team | ⚠️ High |
| [TC-011](#tc-011) | 🟠 P1 | `GREEN` | POST /assignments | POST /assignments — response bao gồm user relation đầy đủ | ⚠️ High |
| [TC-012](#tc-012) | 🟠 P1 | `GREEN` | UI Phân công | UI — section header và form load khi mở PetitionFormPage edit mode | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `GREEN` | UI Phân công | UI — chọn role LEAD → badge 'Chủ trì' màu xanh | ⚡ Medium |
| [TC-039](#tc-039) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — role là giá trị không hợp lệ 'MANAGER' → 400 | ⚡ Medium |
| [TC-042](#tc-042) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — userId là string không phải ID format → DB FK error | ⚡ Medium |
| [TC-043](#tc-043) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — petitionId không phải CUID format → 404 | ⚡ Medium |
| [TC-044](#tc-044) | 🟠 P1 | `RED` | DELETE /assignments | DELETE /assignments — userId trong URL không phải format ID → 404 | ⚡ Medium |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | PATCH /assign | PATCH /assign — assignedTeamId = null → xóa team assignment | ⚡ Medium |
| [TC-046](#tc-046) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — request body là malformed JSON → 400 | ⚠️ High |
| [TC-047](#tc-047) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — extra fields trong body bị ignore (mass assignment safe) | 🚨 Critical |
| [TC-048](#tc-048) | 🟠 P1 | `RED` | DELETE /assignments | DELETE /assignments — petition có nhiều assignments, chỉ xóa đúng 1 user | 🚨 Critical |
| [TC-049](#tc-049) | 🟠 P1 | `RED` | GET /assignments | GET /assignments — petition bị soft-delete → 404 | ⚠️ High |
| [TC-050](#tc-050) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — petition ở mọi status vẫn có thể thêm (không block theo status) | ⚡ Medium |
| [TC-051](#tc-051) | 🟠 P1 | `RED` | PATCH /assign | PATCH /assign — team có 2 isLeader=true, không gửi assignedToId → gán leader đầu tiên | 📌 Low |
| [TC-053](#tc-053) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — userId chứa SQL injection string → sanitized, không execute | 🚨 Critical |
| [TC-054](#tc-054) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — request timeout → UI loading state reset | ⚡ Medium |
| [TC-055](#tc-055) | 🟠 P1 | `RED` | UI Phân công | UI — POST /assignments fail → hiện error message, không crash | ⚠️ High |
| [TC-056](#tc-056) | 🟠 P1 | `RED` | UI Phân công | UI — DELETE fail → hiện error message | ⚠️ High |
| [TC-057](#tc-057) | 🟠 P1 | `RED` | UI Phân công | UI — GET /assignments fail khi load → empty state (không crash) | ⚡ Medium |
| [TC-059](#tc-059) | 🟠 P1 | `RED` | UI Phân công | UI — dropdown trống khi tất cả users đã được assigned | ⚡ Medium |
| [TC-060](#tc-060) | 🟠 P1 | `RED` | UI Phân công | UI — unmount khi đang fetch → không memory leak (AbortController) | ⚡ Medium |
| [TC-061](#tc-061) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — concurrent 5 users khác nhau → tất cả 5 row được tạo | ⚠️ High |
| [TC-062](#tc-062) | 🟠 P1 | `RED` | GET /assignments | GET /assignments — response không leak password hay sensitive user data | 🚨 Critical |
| [TC-063](#tc-063) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — XSS payload trong userId → không execute script | 🚨 Critical |
| [TC-065](#tc-065) | 🟠 P1 | `RED` | UI Phân công | UI — thêm liên tiếp 3 assignments → list update từng cái chính xác | ⚠️ High |
| [TC-067](#tc-067) | 🟠 P1 | `RED` | PATCH /assign | PATCH /assign — gán cùng team lần 2 → idempotent, HTTP 200, không lỗi | ⚡ Medium |
| [TC-070](#tc-070) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — concurrent delete + add cùng user → consistent state | ⚡ Medium |
| [TC-072](#tc-072) | 🟠 P1 | `RED` | UI Phân công | UI — network disconnected → error message hiển thị | ⚡ Medium |
| [TC-073](#tc-073) | 🟠 P1 | `RED` | UI Phân công | UI — backend trả về 500 trên GET load → không crash, hiện empty state | ⚠️ High |
| [TC-076](#tc-076) | 🟠 P1 | `RED` | POST /assignments | POST /assignments — rate limiting: 100 request liên tiếp — server không crash | ⚡ Medium |
| [TC-079](#tc-079) | 🟠 P1 | `BOUNDARY` | POST /assignments | BOUNDARY — role='LEAD' (giá trị đúng, chuỗi 4 ký tự) → PASS | 🚨 Critical |
| [TC-080](#tc-080) | 🟠 P1 | `BOUNDARY` | POST /assignments | BOUNDARY — role='SUPPORT' (giá trị đúng, 7 ký tự) → PASS | 🚨 Critical |
| [TC-082](#tc-082) | 🟠 P1 | `BOUNDARY` | GET /assignments | BOUNDARY — 0 assignments → HTTP 200 + [] | ⚠️ High |
| [TC-083](#tc-083) | 🟠 P1 | `BOUNDARY` | GET /assignments | BOUNDARY — 1 assignment → HTTP 200 + [item] | ⚠️ High |
| [TC-085](#tc-085) | 🟠 P1 | `BOUNDARY` | POST /assignments | BOUNDARY — userId = CUID hợp lệ (26 chars) → PASS | ⚠️ High |
| [TC-093](#tc-093) | 🟠 P1 | `EP` | POST /assignments | EP — role partition undefined/omitted → default SUPPORT | ⚠️ High |
| [TC-094](#tc-094) | 🟠 P1 | `EP` | POST /assignments | EP — role partition invalid → reject | ⚡ Medium |
| [TC-098](#tc-098) | 🟠 P1 | `EP` | POST /assignments | EP — user partition: user KHÔNG trong team của petition → vẫn PASS (no validation) | ⚡ Medium |
| [TC-102](#tc-102) | 🟠 P1 | `EP` | PATCH /assign | EP — assignedToId partition: userId trong đúng team → PASS | ⚠️ High |
| [TC-103](#tc-103) | 🟠 P1 | `EP` | PATCH /assign | EP — assignedToId partition: userId KHÔNG trong team → 400 | ⚠️ High |
| [TC-104](#tc-104) | 🟠 P1 | `EP` | POST /assignments | EP — petition partition: 0 assignments → có thể thêm | 🚨 Critical |
| [TC-105](#tc-105) | 🟠 P1 | `EP` | POST /assignments | EP — petition partition: có N assignments rồi → vẫn có thể thêm user mới | ⚠️ High |
| [TC-106](#tc-106) | 🟠 P1 | `EP` | POST /assignments | EP — same user, 2 petition khác nhau → 2 assignment riêng (không conflict) | ⚠️ High |
| [TC-111](#tc-111) | 🟠 P1 | `STATE` | Petition Assignment | STATE — có assignment LEAD → xóa LEAD → còn SUPPORT → thêm LEAD mới | ⚠️ High |
| [TC-113](#tc-113) | 🟠 P1 | `STATE` | Petition Assignment | STATE — Xóa petition → cascade DELETE assignments | ⚡ Medium |
| [TC-114](#tc-114) | 🟠 P1 | `STATE` | Petition Assignment | STATE — Xóa user → cascade DELETE assignment của user đó | ⚠️ High |
| [TC-115](#tc-115) | 🟠 P1 | `STATE` | Petition Assignment | STATE — PATCH /assign khi petition chưa có team → set team và auto-assign leader | ⚠️ High |
| [TC-121](#tc-121) | 🟠 P1 | `DECISION` | PATCH /assign | DECISION — assignedTeamId null, assignedToId null → clear toàn bộ | ⚡ Medium |
| [TC-122](#tc-122) | 🟠 P1 | `DECISION` | PATCH /assign | DECISION — team thay đổi, assignedToId từ team cũ → 400 (không thuộc team mới) | ⚠️ High |
| [TC-134](#tc-134) | 🟠 P1 | `SECURITY` | GET /assignments | SECURITY — Path traversal trong petitionId → not found | ⚠️ High |
| [TC-135](#tc-135) | 🟠 P1 | `SECURITY` | POST /assignments | SECURITY — Null byte injection trong userId → rejected | ⚠️ High |
| [TC-136](#tc-136) | 🟠 P1 | `SECURITY` | DELETE /assignments | SECURITY — IDOR: user-A xóa assignment của petition không thuộc team-A → check permission | 🚨 Critical |
| [TC-137](#tc-137) | 🟠 P1 | `SECURITY` | POST /assignments | SECURITY — CSRF: request từ external domain không có JWT → 401 | 🚨 Critical |
| [TC-143](#tc-143) | 🟠 P1 | `SECURITY` | POST /assignments | SECURITY — Content-Type mismatch: POST với text/plain body → 400 hoặc 415 | ⚡ Medium |
| [TC-145](#tc-145) | 🟠 P1 | `DATA` | GET /assignments | DATA — displayName fallback: không có firstName/lastName → hiển thị username | ⚠️ High |
| [TC-146](#tc-146) | 🟠 P1 | `DATA` | GET /assignments | DATA — assignedAt timestamp format UTC ISO8601 | ⚡ Medium |
| [TC-147](#tc-147) | 🟠 P1 | `DATA` | GET /assignments | DATA — Vietnamese special chars trong user name → display đúng | ⚡ Medium |
| [TC-152](#tc-152) | 🟠 P1 | `INTEGRATION` | Team + Assignment | INTEGRATION — PATCH assign với team có leader → PetitionAssignment section hiện leader | 🚨 Critical |
| [TC-153](#tc-153) | 🟠 P1 | `INTEGRATION` | Form + Assignment | INTEGRATION — Submit PetitionFormPage không gửi assignment data trong request body | 🚨 Critical |
| [TC-154](#tc-154) | 🟠 P1 | `REGRESSION` | Regression | REGRESSION — Thêm assignment không ảnh hưởng đến petition list page | ⚡ Medium |
| [TC-155](#tc-155) | 🟠 P1 | `REGRESSION` | Regression | REGRESSION — Thêm assignment không thay đổi petition.updatedAt | ⚡ Medium |
| [TC-156](#tc-156) | 🟠 P1 | `REGRESSION` | Regression | REGRESSION — Xóa assignment không thay đổi petition.status | ⚠️ High |
| [TC-157](#tc-157) | 🟠 P1 | `REGRESSION` | Regression | REGRESSION — PATCH /assign (phân công đội) không xóa petition_assignments đã có | 🚨 Critical |
| [TC-167](#tc-167) | 🟠 P1 | `A11Y` | UI A11Y | A11Y — Nút xóa có title='Xóa phân công' để screen reader đọc | ⚡ Medium |
| [TC-185](#tc-185) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — GET /assignments với 1 item < 100ms | ⚡ Medium |
| [TC-186](#tc-186) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — GET /assignments với 50 items < 500ms | ⚡ Medium |
| [TC-187](#tc-187) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — POST /assignments < 200ms | ⚡ Medium |
| [TC-188](#tc-188) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — DELETE /assignments < 200ms | ⚡ Medium |
| [TC-190](#tc-190) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — Concurrent 10 GET /assignments cùng 1 petition → tất cả 200 | ⚡ Medium |
| [TC-191](#tc-191) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — Concurrent 5 POST /assignments với userId khác nhau → tất cả 201 | ⚠️ High |
| [TC-192](#tc-192) | 🟠 P1 | `PERFORMANCE` | PERFORMANCE | PERF — PATCH /assign với DB query tìm leader < 300ms | ⚡ Medium |
| [TC-193](#tc-193) | 🟠 P1 | `RED` | UI Phân công | RED — double-click nút Thêm → chỉ gọi POST API 1 lần (không double-submit) | ⚠️ High |
| [TC-194](#tc-194) | 🟠 P1 | `RED` | UI Phân công | RED — POST trả về 409 (duplicate) → UI hiện error message rõ ràng | ⚡ Medium |
| [TC-196](#tc-196) | 🟠 P1 | `RED` | UI Phân công | RED — xóa assignment không có confirmation dialog → immediate delete | 📌 Low |
| [TC-197](#tc-197) | 🟠 P1 | `RED` | UI Phân công | RED — sau add thành công, form reset: userId='' và role='SUPPORT' (default) | ⚡ Medium |
| [TC-201](#tc-201) | 🟠 P1 | `RED` | POST /assignments | RED — POST với null body → 400 | ⚡ Medium |
| [TC-203](#tc-203) | 🟠 P1 | `RED` | PATCH /assign | RED — PATCH /assign thiếu expectedUpdatedAt → 400 hoặc conflict | ⚡ Medium |
| [TC-204](#tc-204) | 🟠 P1 | `RED` | POST /assignments | RED — POST với Content-Type không phải application/json → 400 hoặc 415 | ⚡ Medium |
| [TC-205](#tc-205) | 🟠 P1 | `RED` | POST /assignments | RED — POST sau khi DELETE cùng user → 201 (unique constraint được free) | ⚠️ High |
| [TC-207](#tc-207) | 🟠 P1 | `RED` | POST /assignments | RED — POST self-assign (actorId === userId) → cho phép | ⚡ Medium |
| [TC-209](#tc-209) | 🟠 P1 | `RED` | PATCH /assign | RED — PATCH /assign với assignedToId không tồn tại trong DB → FK error | ⚠️ High |
| [TC-210](#tc-210) | 🟠 P1 | `RED` | PATCH /assign | RED — PATCH /assign body không có assignedTeamId → giữ nguyên team hiện tại | ⚡ Medium |
| [TC-211](#tc-211) | 🟠 P1 | `RED` | POST /assignments | RED — POST userId của user bị soft-delete → FK valid (user row exists) | ⚡ Medium |
| [TC-213](#tc-213) | 🟠 P1 | `RED` | GET /assignments | RED — GET sau DELETE → count giảm 1 chính xác | ⚠️ High |
| [TC-214](#tc-214) | 🟠 P1 | `RED` | POST /assignments | RED — POST với assignedTeamId field trong body → ignored (không phải field hợp lệ của DTO) | ⚠️ High |
| [TC-217](#tc-217) | 🟠 P1 | `RED` | PATCH /assign | RED — PATCH /assign khi petition bị archive → ... | ⚡ Medium |
| [TC-219](#tc-219) | 🟠 P1 | `RED` | POST /assignments | RED — POST không có Authorization header nhưng có cookie → vẫn 401 | 🚨 Critical |
| [TC-221](#tc-221) | 🟠 P1 | `RED` | GET /assignments | RED — GET /assignments trả về data sau khi có change từ tab khác (race) | ⚡ Medium |
| [TC-222](#tc-222) | 🟠 P1 | `RED` | POST /assignments | RED — POST với oversized payload (1MB body) → 413 Request Too Large | ⚡ Medium |
| [TC-223](#tc-223) | 🟠 P1 | `RED` | GET /assignments | RED — Multiple GET requests đồng thời từ cùng component → abort tất cả trừ last | ⚡ Medium |
| [TC-226](#tc-226) | 🟠 P1 | `RED` | UI Phân công | RED — Error message tự xóa sau lần thêm/xóa thành công tiếp theo | ⚡ Medium |
| [TC-229](#tc-229) | 🟠 P1 | `BOUNDARY` | POST /assignments | BOUNDARY — role = null → default SUPPORT (controller: dto.role ?? 'SUPPORT') | ⚡ Medium |
| [TC-231](#tc-231) | 🟠 P1 | `BOUNDARY` | POST /assignments | BOUNDARY — petitionId là CUID 26 chars (valid Prisma ID) → PASS | ⚡ Medium |
| [TC-235](#tc-235) | 🟠 P1 | `EP` | EP | EP — petition status partition: KIEM_TRA → GET /assignments OK | ⚡ Medium |
| [TC-236](#tc-236) | 🟠 P1 | `EP` | EP | EP — user partition: admin (không cần thuộc team) → POST /assignments OK | ⚠️ High |
| [TC-237](#tc-237) | 🟠 P1 | `SECURITY` | SECURITY | SECURITY — Authorization: Bearer token với extra spaces → 401 | ⚠️ High |
| [TC-064](#tc-064) | 🟡 P2 | `RED` | UI Phân công | UI — add assignment thành công → dropdown reset về placeholder | 📌 Low |
| [TC-066](#tc-066) | 🟡 P2 | `RED` | UI Phân công | UI — sau khi xóa assignment, user xuất hiện lại trong dropdown | ⚡ Medium |
| [TC-068](#tc-068) | 🟡 P2 | `RED` | POST /assignments | POST /assignments — Unicode name trong user → hiển thị đúng | ⚡ Medium |
| [TC-069](#tc-069) | 🟡 P2 | `RED` | GET /assignments | GET /assignments — assignedBy field là optional, không crash nếu null | ⚠️ High |
| [TC-071](#tc-071) | 🟡 P2 | `RED` | DELETE /assignments | DELETE /assignments — DELETE duplicate (2 lần cùng userId) → 2nd request 404 | ⚡ Medium |
| [TC-074](#tc-074) | 🟡 P2 | `RED` | PATCH /assign | PATCH /assign — CSRF attack từ external domain → bị chặn bởi JWT stateless | 🚨 Critical |
| [TC-075](#tc-075) | 🟡 P2 | `RED` | GET /assignments | GET /assignments — IDOR: user team-A xem assignment của petition team-B | 🚨 Critical |
| [TC-077](#tc-077) | 🟡 P2 | `RED` | POST /assignments | POST /assignments — HTTP method override header bị ignored | ⚡ Medium |
| [TC-078](#tc-078) | 🟡 P2 | `RED` | POST /assignments | POST /assignments — JWT với algorithm 'none' (alg:none attack) → 401 | 🚨 Critical |
| [TC-081](#tc-081) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — role='' (empty string) → default về SUPPORT (controller fallback) | ⚡ Medium |
| [TC-084](#tc-084) | 🟡 P2 | `BOUNDARY` | GET /assignments | BOUNDARY — 50 assignments → HTTP 200, tất cả 50 items (không có pagination limit) | ⚡ Medium |
| [TC-086](#tc-086) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — userId = 1 char → invalid ID, không tìm thấy user → FK error | ⚡ Medium |
| [TC-087](#tc-087) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — role='LEAd' (mixed case) → FAIL, rejected hoặc stored as-is | ⚡ Medium |
| [TC-088](#tc-088) | 🟡 P2 | `BOUNDARY` | DELETE /assignments | BOUNDARY — xóa assignment cuối cùng → list trở về [] | ⚠️ High |
| [TC-089](#tc-089) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — petitionId là empty string trong URL → 404 hay 400 | 📌 Low |
| [TC-090](#tc-090) | 🟡 P2 | `BOUNDARY` | GET /assignments | BOUNDARY — petitionId rất dài (500 chars) → handle gracefully (404) | 📌 Low |
| [TC-116](#tc-116) | 🟡 P2 | `STATE` | Petition Assignment | STATE — Add 10 assignments tuần tự → list chính xác sau mỗi add | 📌 Low |
| [TC-138](#tc-138) | 🟡 P2 | `SECURITY` | POST /assignments | SECURITY — XSS trong role field → không execute | ⚠️ High |
| [TC-139](#tc-139) | 🟡 P2 | `SECURITY` | GET /assignments | SECURITY — OWASP A09: Server không leak stack trace trong error response | ⚠️ High |
| [TC-140](#tc-140) | 🟡 P2 | `SECURITY` | POST /assignments | SECURITY — Log injection: userId có ký tự newline → sanitized trong logs | ⚡ Medium |
| [TC-141](#tc-141) | 🟡 P2 | `SECURITY` | POST /assignments | SECURITY — Rate limiting: 50 POST liên tiếp từ 1 IP → không 500 | ⚡ Medium |
| [TC-142](#tc-142) | 🟡 P2 | `SECURITY` | GET /assignments | SECURITY — JWT từ deactivated user → 401 hoặc 403 | ⚠️ High |
| [TC-144](#tc-144) | 🟡 P2 | `SECURITY` | POST /assignments | SECURITY — Replay attack: reuse expired JWT → 401 | 🚨 Critical |
| [TC-148](#tc-148) | 🟡 P2 | `DATA` | GET /assignments | DATA — assignedBy nullable (user được gán trực tiếp vào DB không qua API) → UI không crash | ⚠️ High |
| [TC-149](#tc-149) | 🟡 P2 | `DATA` | GET /assignments | DATA — GET response đủ 8 fields theo interface: id, petitionId, userId, user, role, assignedById, assignedBy?, assignedAt | ⚠️ High |
| [TC-158](#tc-158) | 🟡 P2 | `EDGE` | EDGE | EDGE — GET /assignments sau khi petition bị hard-deleted → 404 hoặc [] | ⚡ Medium |
| [TC-159](#tc-159) | 🟡 P2 | `EDGE` | EDGE | EDGE — Petition có assignment nhưng user đã bị soft-deleted → assignment vẫn còn | ⚡ Medium |
| [TC-160](#tc-160) | 🟡 P2 | `EDGE` | EDGE | EDGE — Section phân công không render trong petition CREATE mode | 🚨 Critical |
| [TC-161](#tc-161) | 🟡 P2 | `EDGE` | EDGE | EDGE — Add assignment khi petition đang có concurrent edit → optimistic lock không apply (assignments độc lập) | 📌 Low |
| [TC-162](#tc-162) | 🟡 P2 | `EDGE` | EDGE | EDGE — PATCH /assign với cùng team+cùng leader → idempotent, không tạo duplicate assignment | ⚡ Medium |
| [TC-163](#tc-163) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Section có heading h2 'Phân công cán bộ' (semantic HTML) | 📌 Low |
| [TC-164](#tc-164) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Select 'Cán bộ' có label liên kết đúng (for/id hoặc aria-labelledby) | ⚡ Medium |
| [TC-165](#tc-165) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Select 'Vai trò' có label liên kết đúng | 📌 Low |
| [TC-166](#tc-166) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Nút 'Thêm' có accessible name rõ ràng | ⚡ Medium |
| [TC-168](#tc-168) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Error message có role='alert' hoặc aria-live='assertive' | ⚡ Medium |
| [TC-169](#tc-169) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Tab order hợp lý: select Cán bộ → select Vai trò → nút Thêm | 📌 Low |
| [TC-170](#tc-170) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Keyboard: Enter trên nút Thêm (khi enabled) → trigger add | ⚡ Medium |
| [TC-171](#tc-171) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Loading state 'Đang thêm...' visible và accessible | 📌 Low |
| [TC-172](#tc-172) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Color contrast badge 'Chủ trì' đủ WCAG AA (4.5:1) | 📌 Low |
| [TC-173](#tc-173) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — List assignments có markup ul > li đúng (semantic list) | 📌 Low |
| [TC-174](#tc-174) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Chrome latest (131+): section render và interactions OK | ⚠️ High |
| [TC-175](#tc-175) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Firefox latest (120+): dropdown select render đúng | ⚡ Medium |
| [TC-176](#tc-176) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Safari 17 (macOS): form elements không bị clip | ⚡ Medium |
| [TC-177](#tc-177) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Edge latest: badges render đúng màu | 📌 Low |
| [TC-178](#tc-178) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Mobile Chrome Android 12: dropdown select có thể chọn | ⚡ Medium |
| [TC-179](#tc-179) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Mobile Safari iOS 16: touch target nút xóa ≥ 44px | ⚡ Medium |
| [TC-180](#tc-180) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Viewport 375px (mobile): section không overflow ngang | ⚠️ High |
| [TC-181](#tc-181) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Viewport 768px (tablet): layout 2 cột hoặc stacked OK | 📌 Low |
| [TC-182](#tc-182) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Viewport 1920px: section không quá rộng, centered | 📌 Low |
| [TC-183](#tc-183) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — Windows 11 + Chrome: font Vietnamese render đúng dấu | 📌 Low |
| [TC-184](#tc-184) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — MacOS Safari: hover effects (hover:bg-red-50) hoạt động | 📌 Low |
| [TC-189](#tc-189) | 🟡 P2 | `PERFORMANCE` | PERFORMANCE | PERF — UI load section với 20 assignments render < 1s | 📌 Low |
| [TC-195](#tc-195) | 🟡 P2 | `RED` | UI Phân công | RED — section không hiển thị trong create mode (/petitions/new) | 🚨 Critical |
| [TC-198](#tc-198) | 🟡 P2 | `RED` | UI Phân công | RED — navigate away và back → GET /assignments gọi lại (không dùng stale cache) | ⚡ Medium |
| [TC-199](#tc-199) | 🟡 P2 | `RED` | GET /assignments | RED — GET response 200 với null body → UI handle, setAssignments([]) | ⚠️ High |
| [TC-200](#tc-200) | 🟡 P2 | `RED` | GET /assignments | RED — GET response 200 với non-array (object) → UI handle, setAssignments([]) | ⚠️ High |
| [TC-202](#tc-202) | 🟡 P2 | `RED` | DELETE /assignments | RED — DELETE với body JSON → body ignored, delete vẫn hoạt động | 📌 Low |
| [TC-206](#tc-206) | 🟡 P2 | `RED` | GET /assignments | RED — GET với sort/filter query params → ignored (không support) | 📌 Low |
| [TC-208](#tc-208) | 🟡 P2 | `RED` | GET /assignments | RED — pagination: page/limit params → ignored, return all | 📌 Low |
| [TC-212](#tc-212) | 🟡 P2 | `RED` | GET /assignments | RED — GET /assignments sau khi PATCH /assign thay đổi team → assignments vẫn giữ nguyên | 🚨 Critical |
| [TC-215](#tc-215) | 🟡 P2 | `RED` | POST /assignments | RED — POST cùng userId nhưng khác role → vẫn 409 (unique per userId, không phải role) | 🚨 Critical |
| [TC-216](#tc-216) | 🟡 P2 | `RED` | GET /assignments | RED — GET /assignments khi network slow (2s) → loading state ổn định | 📌 Low |
| [TC-218](#tc-218) | 🟡 P2 | `RED` | POST /assignments | RED — POST với userId có leading/trailing spaces → exact match hoặc trimmed | 📌 Low |
| [TC-220](#tc-220) | 🟡 P2 | `RED` | DELETE /assignments | RED — DELETE sau khi petition được restore (undelete) → assignment có thể xóa bình thường | ⚡ Medium |
| [TC-224](#tc-224) | 🟡 P2 | `RED` | PATCH /assign | RED — PATCH /assign với expectedUpdatedAt = 9999-12-31 (far future) → conflict nếu petition.updatedAt < 9999 | 📌 Low |
| [TC-225](#tc-225) | 🟡 P2 | `RED` | POST /assignments | RED — POST /assignments role='lead' (lowercase) → lưu như 'lead' hoặc 400 | ⚡ Medium |
| [TC-227](#tc-227) | 🟡 P2 | `RED` | GET /assignments | RED — GET sau PATCH /assign với new leader → GET không tự include leader (2 systems riêng) | 🚨 Critical |
| [TC-228](#tc-228) | 🟡 P2 | `RED` | POST /assignments | RED — POST thành công nhưng server mất response (network drop sau 201) → UI state | ⚡ Medium |
| [TC-230](#tc-230) | 🟡 P2 | `BOUNDARY` | GET /assignments | BOUNDARY — 100 assignments → GET return all 100 (không có default pagination) | ⚡ Medium |
| [TC-232](#tc-232) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — role = 'SUPPORT' + thêm 1 ký tự = 'SUPPORTS' → 400 hoặc 201 (no enum validation) | ⚡ Medium |
| [TC-233](#tc-233) | 🟡 P2 | `BOUNDARY` | POST /assignments | BOUNDARY — userId rất ngắn 1 char 'x' → FK fail, không tìm thấy user | ⚡ Medium |
| [TC-234](#tc-234) | 🟡 P2 | `BOUNDARY` | GET /assignments | BOUNDARY — 0 items → response là [] (array), không phải null hay undefined | ⚠️ High |
| [TC-238](#tc-238) | 🟡 P2 | `SECURITY` | SECURITY | SECURITY — Host header injection: Host: evil.com → không redirect hay expose data | ⚡ Medium |
| [TC-239](#tc-239) | 🟡 P2 | `A11Y` | UI A11Y | A11Y — Role badges phân biệt bằng text (không chỉ màu sắc) | ⚡ Medium |
| [TC-240](#tc-240) | 🟡 P2 | `COMPAT` | COMPAT | COMPAT — PWA mode (standalone): section và interactions hoạt động như browser | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /assignments trả về danh sách 2 phân công đúng format

### Điều kiện tiên quyết
- Petition tồn tại với 2 assignment (user-1 LEAD, user-2 SUPPORT)

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/assignments với JWT hợp lệ

### Dữ liệu kiểm thử
```
account.officer.primary, petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Hiển thị 2 row trong danh sách, role đúng

**API**:
- HTTP 200, array 2 phần tử, mỗi phần tử có id, petitionId, userId, role, assignedAt, user{id,username,firstName,lastName}

**Side effects** (DB, email, log, queue...):
- Không có side effect DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Happy path — endpoint cần pass P0

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /assignments trả về [] khi chưa có phân công

### Điều kiện tiên quyết
- Petition mới tạo, chưa có assignment

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/assignments

### Dữ liệu kiểm thử
```
account.officer.primary, petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Hiển thị 'Chưa có cán bộ được phân công'

**API**:
- HTTP 200, data = []

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Empty state

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /assignments — response có đủ fields user.username, assignedBy

### Điều kiện tiên quyết
- Petition có 1 assignment

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/assignments → kiểm tra JSON response

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Tên cán bộ hiển thị đúng (firstName + lastName hoặc username)

**API**:
- HTTP 200, item.user.username ≠ null, item.assignedBy có {id, username}

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: username field phải có — fix từ /review adversarial

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET /assignments — response sắp xếp theo assignedAt tăng dần

### Điều kiện tiên quyết
- Petition có 3 assignments tạo lần lượt cách nhau 1 giây

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/assignments

### Dữ liệu kiểm thử
```
petition.with_3_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Cán bộ đầu tiên phân công ở đầu list

**API**:
- HTTP 200, items[0].assignedAt < items[1].assignedAt < items[2].assignedAt

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: orderBy assignedAt asc

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — thêm phân công với role SUPPORT → 201

### Điều kiện tiên quyết
- Petition tồn tại, user-3 chưa được assign

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/assignments body {userId:'user-3', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
account.officer.primary, petition.new.D0, user.officer2
```

### Kết quả mong đợi
**UI**:
- user-3 xuất hiện trong danh sách với badge 'Hỗ trợ'

**API**:
- HTTP 201, response.userId='user-3', response.role='SUPPORT', response.user.username present

**Side effects** (DB, email, log, queue...):
- petition_assignments table: 1 row mới, assignedAt = now()

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Core create flow

---

## TC-006

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — thêm phân công với role LEAD → 201

### Điều kiện tiên quyết
- Petition tồn tại, user-3 chưa assigned

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/assignments body {userId:'user-3', role:'LEAD'}

### Dữ liệu kiểm thử
```
petition.new.D0, user.officer2
```

### Kết quả mong đợi
**UI**:
- Badge 'Chủ trì' màu xanh hiện bên cạnh tên

**API**:
- HTTP 201, response.role='LEAD'

**Side effects** (DB, email, log, queue...):
- row trong petition_assignments với role='LEAD'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: LEAD role flow

---

## TC-007

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — không gửi role → default SUPPORT

### Điều kiện tiên quyết
- Petition tồn tại, user chưa assigned

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/assignments body {userId:'user-3'} (không có role)

### Dữ liệu kiểm thử
```
petition.new.D0, user.officer2
```

### Kết quả mong đợi
**UI**:
- Badge 'Hỗ trợ' hiển thị

**API**:
- HTTP 201, response.role='SUPPORT'

**Side effects** (DB, email, log, queue...):
- role='SUPPORT' trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Controller default: dto.role ?? 'SUPPORT'

---

## TC-008

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DELETE /assignments/:userId — xóa thành công → 200 + {success:true}

### Điều kiện tiên quyết
- Petition có user-1 được assigned

### Các bước kiểm thử
- [ ] DELETE /api/v1/petitions/:id/assignments/user-1

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- user-1 biến mất khỏi danh sách, hiện lại trong dropdown

**API**:
- HTTP 200, response = {success:true}

**Side effects** (DB, email, log, queue...):
- petition_assignments: row với userId=user-1 bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: HTTP 200 (không phải 204) theo @HttpCode(HttpStatus.OK)

---

## TC-009

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH /assign — auto-gán trưởng đội khi không gửi assignedToId

### Điều kiện tiên quyết
- Team-A có user-leader (isLeader=true)

### Các bước kiểm thử
- [ ] PATCH /api/v1/petitions/:id/assign body {assignedTeamId:'team-A', expectedUpdatedAt:'...'}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.with_leader
```

### Kết quả mong đợi
**UI**:
- Tên đội trưởng xuất hiện trong field 'Phụ trách'

**API**:
- HTTP 200, petition.assignedToId = leaderId, petition.assignedTeamId = 'team-A'

**Side effects** (DB, email, log, queue...):
- Petition row cập nhật assignedToId + assignedTeamId

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Nhóm I core feature — auto-assign to leader

---

## TC-013

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / Use case`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI — danh sách 2 assignments hiển thị đúng sau load

### Điều kiện tiên quyết
- Petition có 2 assignments: user-1 LEAD, user-2 SUPPORT

### Các bước kiểm thử
- [ ] Mở /petitions/:id/edit
- [ ] Kiểm tra danh sách

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- item trong danh sách. user-1 có badge 'Chủ trì' (xanh). user-2 có badge 'Hỗ trợ' (xám). Mỗi item có nút xóa (trash icon)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: Critical
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: UI rendering test

---

## TC-014

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — nút Thêm disabled khi chưa chọn cán bộ

### Điều kiện tiên quyết
- Petition load xong, không có assignment

### Các bước kiểm thử
- [ ] Mở edit page
- [ ] Kiểm tra nút Thêm

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nút 'Thêm' disabled (opacity-50), không thể click

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: disabled={!addUserId || isAdding}

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / End-to-end`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI — chọn cán bộ → nút Thêm enabled → click → assignment xuất hiện

### Điều kiện tiên quyết
- Petition có 0 assignments, userOptions có 3 users

### Các bước kiểm thử
- [ ] Chọn user-3 trong dropdown
- [ ] Để role SUPPORT mặc định
- [ ] Click Thêm
- [ ] Kiểm tra danh sách

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- user-3 xuất hiện trong danh sách với badge 'Hỗ trợ'. Dropdown trở về placeholder '-- Chọn cán bộ --'

**API**:
- POST /petitions/:id/assignments được gọi với {userId:'user-3', role:'SUPPORT'}

**Side effects** (DB, email, log, queue...):
- row mới trong petition_assignments

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: Critical
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Full add flow E2E

---

## TC-017

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / End-to-end`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI — click xóa → assignment biến mất, user về dropdown

### Điều kiện tiên quyết
- Petition có user-1 assigned

### Các bước kiểm thử
- [ ] Click nút trash của user-1
- [ ] Kiểm tra list + dropdown

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- user-1 biến mất khỏi list. Dropdown cán bộ lại có user-1 làm option

**API**:
- DELETE /petitions/:id/assignments/user-1

**Side effects** (DB, email, log, queue...):
- Row bị xóa khỏi DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Critical
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Remove flow + dropdown sync

---

## TC-018

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / Filter`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI — user đã assigned không hiển thị trong dropdown Cán bộ

### Điều kiện tiên quyết
- Petition có user-1 và user-2 assigned trong 3 users tổng

### Các bước kiểm thử
- [ ] Mở edit page
- [ ] Kiểm tra options của select Cán bộ

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Dropdown chỉ có user-3. user-1 và user-2 không xuất hiện

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: availableUsers = userOptions.filter(u => !assignments.some(a => a.userId===u.id))

---

## TC-019

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Auth`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /assignments — không có JWT → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/assignments không có Authorization header

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401, message='Unauthorized'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Bắt buộc authenticate

---

## TC-020

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Auth`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — không có JWT → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId, role} không có JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Auth guard

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Auth`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DELETE /assignments — không có JWT → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] DELETE /assignments/:userId không có JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- Không có row bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Auth guard

---

## TC-022

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Auth`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH /assign — không có JWT → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId} không có JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Auth guard DispatchGuard

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Authorization / RBAC`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — user chỉ có quyền read Petition (không có edit) → 403

### Điều kiện tiên quyết
- Đăng nhập với tài khoản viewer (chỉ read Petition)

### Các bước kiểm thử
- [ ] POST /assignments với JWT viewer

### Dữ liệu kiểm thử
```
account.viewer.primary, petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 403, message='Forbidden resource'

**Side effects** (DB, email, log, queue...):
- Không có row mới tạo

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: RequirePermissions action:edit subject:Petition

---

## TC-024

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Authorization / RBAC`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DELETE /assignments — user chỉ có quyền read → 403

### Điều kiện tiên quyết
- Đăng nhập với account viewer

### Các bước kiểm thử
- [ ] DELETE /assignments/:userId với JWT viewer

### Dữ liệu kiểm thử
```
account.viewer.primary, petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 403

**Side effects** (DB, email, log, queue...):
- Không bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: edit permission required

---

## TC-025

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Authorization / RBAC`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH /assign — user không có DispatchGuard role → 403

### Điều kiện tiên quyết
- Đăng nhập với officer (không có DISPATCH permission)

### Các bước kiểm thử
- [ ] PATCH /assign với JWT officer thường

### Dữ liệu kiểm thử
```
account.officer.primary, petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 403

**Side effects** (DB, email, log, queue...):
- petition không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DispatchGuard chỉ ADMIN/DISPATCHER

---

## TC-026

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-NOTFOUND`
- Kỹ thuật: `Negative / Not found`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /assignments — petitionId không tồn tại → 404

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/non-existent-id/assignments

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, message contains 'Đơn thư không tồn tại'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Service: findFirst({id, deletedAt:null})

---

## TC-027

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-NOTFOUND`
- Kỹ thuật: `Negative / Not found`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — petitionId không tồn tại → 404

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/non-existent/assignments {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, message='Đơn thư không tồn tại'

**Side effects** (DB, email, log, queue...):
- Không tạo row mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: addAssignment: petition check first

---

## TC-028

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-NOTFOUND`
- Kỹ thuật: `Negative / Not found`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DELETE /assignments — petitionId không tồn tại → 404

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] DELETE /api/v1/petitions/non-existent/assignments/user-1

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404

**Side effects** (DB, email, log, queue...):
- Không có gì bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: High
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: removeAssignment: petition check

---

## TC-029

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-NOTFOUND`
- Kỹ thuật: `Negative / Not found`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DELETE /assignments — userId không có assignment → 404

### Điều kiện tiên quyết
- Petition tồn tại, user-99 không được assigned

### Các bước kiểm thử
- [ ] DELETE /api/v1/petitions/:id/assignments/user-99

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, message='Cán bộ chưa được phân công cho đơn thư này'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: High
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: removeAssignment: assignment findUnique

---

## TC-030

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Session`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — JWT hết hạn → 401

### Điều kiện tiên quyết
- JWT đã expire

### Các bước kiểm thử
- [ ] POST /assignments với expired JWT

### Dữ liệu kiểm thử
```
account.officer.primary (expired token)
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401, message='Unauthorized'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Token expiry check

---

## TC-031

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Duplicate`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — thêm user đã assigned → 409 ConflictException

### Điều kiện tiên quyết
- user-1 đã được assign cho petition-001

### Các bước kiểm thử
- [ ] POST /petitions/petition-001/assignments body {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Hiện error message 'Không thể thêm phân công'

**API**:
- HTTP 409, message='Cán bộ đã được phân công cho đơn thư này'

**Side effects** (DB, email, log, queue...):
- Không tạo row trùng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: @@unique([petitionId, userId]) + ConflictException

---

## TC-032

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Concurrency / Race`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — P2002 race condition (2 request đồng thời cùng userId) → 409

### Điều kiện tiên quyết
- user-1 chưa assigned, 2 POST request gửi đồng thời

### Các bước kiểm thử
- [ ] Gửi song song: POST {userId:'user-1'} × 2

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- request thành công, 1 request nhận lỗi

**API**:
- HTTP 201 (1 request), HTTP 409 (request còn lại)

**Side effects** (DB, email, log, queue...):
- Chỉ 1 row trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P2002 caught → ConflictException 409

---

## TC-033

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Soft delete`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — petition bị soft-delete (deletedAt ≠ null) → 404

### Điều kiện tiên quyết
- Petition đã bị xóa mềm

### Các bước kiểm thử
- [ ] POST /petitions/deleted-petition/assignments {userId, role}

### Dữ liệu kiểm thử
```
petition.deleted.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, message='Đơn thư không tồn tại'

**Side effects** (DB, email, log, queue...):
- Không tạo row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findFirst({id, deletedAt: null})

---

## TC-034

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Soft delete`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DELETE /assignments — petition đã soft-delete → 404

### Điều kiện tiên quyết
- Petition đã bị xóa mềm

### Các bước kiểm thử
- [ ] DELETE /petitions/deleted-petition/assignments/user-1

### Dữ liệu kiểm thử
```
petition.deleted.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: High
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: removeAssignment: petition check deletedAt

---

## TC-035

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Invalid ref`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH /assign — teamId không tồn tại trong DB → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'nonexistent-team', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- Thông báo lỗi team không tồn tại

**API**:
- HTTP 400, message='Tổ không tồn tại hoặc đã ngừng hoạt động'

**Side effects** (DB, email, log, queue...):
- Petition không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: team findUnique + isActive check

---

## TC-036

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Inactive`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH /assign — team tồn tại nhưng isActive=false → 400

### Điều kiện tiên quyết
- Team-B tồn tại, isActive=false

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-B', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.inactive
```

### Kết quả mong đợi
**UI**:
- Hiện lỗi team ngừng hoạt động

**API**:
- HTTP 400, message='Tổ không tồn tại hoặc đã ngừng hoạt động'

**Side effects** (DB, email, log, queue...):
- Không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: isActive validation

---

## TC-037

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Cross-team`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH /assign — assignedToId không thuộc assignedTeamId → 400

### Điều kiện tiên quyết
- user-officer2 thuộc team-B, không thuộc team-A

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-A', assignedToId:'user-officer2', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_and_b_members
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400, message='Cán bộ xử lý không thuộc tổ được chỉ định'

**Side effects** (DB, email, log, queue...):
- assignedToId không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: member validation

---

## TC-038

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Concurrency / Optimistic lock`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH /assign — expectedUpdatedAt không khớp → 409 (optimistic lock)

### Điều kiện tiên quyết
- Petition updatedAt = T1

### Các bước kiểm thử
- [ ] PATCH /assign với expectedUpdatedAt = T0 (cũ hơn T1)

### Dữ liệu kiểm thử
```
petition.updated.D7
```

### Kết quả mong đợi
**UI**:
- Thông báo 'Đơn thư đã bị chỉnh sửa bởi người khác'

**API**:
- HTTP 409, message='Đơn thư đã được chỉnh sửa bởi người dùng khác'

**Side effects** (DB, email, log, queue...):
- Không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P2025 detection — optimistic lock

---

## TC-040

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Missing required`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — thiếu userId (body rỗng) → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400, validation error: userId is required

**Side effects** (DB, email, log, queue...):
- Không tạo row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DTO validation @IsNotEmpty()

---

## TC-041

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Null value`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — userId = null → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId: null, role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400

**Side effects** (DB, email, log, queue...):
- Không tạo row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Null check trong DTO

---

## TC-052

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Decision / No leader`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH /assign — team không có isLeader=true → fail-open, assignedToId = null

### Điều kiện tiên quyết
- Team-C có 3 thành viên, không ai isLeader=true

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-C', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.no_leader
```

### Kết quả mong đợi
**UI**:
- Toast 'Không tìm thấy đội trưởng' hoặc không thông báo

**API**:
- HTTP 200, assignedTeamId='team-C', assignedToId=null (giữ nguyên hay null)

**Side effects** (DB, email, log, queue...):
- Petition cập nhật team, assignedToId không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Fail-open: no throw, log warning

---

## TC-058

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Loading`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — nút Thêm disabled khi đang loading (isAdding=true)

### Điều kiện tiên quyết
- POST đang in-flight

### Các bước kiểm thử
- [ ] Click Thêm → kiểm tra ngay sau click (trong khoảng isAdding=true)

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nút hiển thị 'Đang thêm...', disabled=true, không thể click lần 2

**API**:
- Chỉ 1 POST request (không double-submit)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: disabled={!addUserId || isAdding}

---

## TC-091

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Role enum`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP — role partition LEAD → PASS

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {role:'LEAD'} — partition LEAD class

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='LEAD'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Partition 1/3: role=LEAD

---

## TC-092

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Role enum`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP — role partition SUPPORT → PASS

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {role:'SUPPORT'} — partition SUPPORT class

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='SUPPORT'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Partition 2/3: role=SUPPORT

---

## TC-095

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Status class`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — petition partition: TIEP_NHAN → có thể GET assignments

### Điều kiện tiên quyết
- Petition với status=TIEP_NHAN

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.status_tiep_nhan.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Status không ảnh hưởng GET

---

## TC-096

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Status class`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP — petition partition: DA_CHUYEN_VU_VIEC → có thể GET assignments

### Điều kiện tiên quyết
- Petition với status=DA_CHUYEN_VU_VIEC

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.converted_incident.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Status không ảnh hưởng GET

---

## TC-097

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / User-team relation`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — user partition: user trong cùng team với petition → PASS

### Điều kiện tiên quyết
- Petition assignedTeamId=team-A, user-1 trong team-A

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.assigned_team.D7, user.in_same_team
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Không có team-membership validation cho POST /assignments

---

## TC-099

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Team state`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP — team partition: team active với leader → auto-assign

### Điều kiện tiên quyết
- Team active, có leader

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId, không có assignedToId}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.active_with_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId = leaderId

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: active team + has leader

---

## TC-100

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Team state`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP — team partition: team active, không leader → fail-open

### Điều kiện tiên quyết
- Team active, không có isLeader=true

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId, không có assignedToId}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.active_no_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId không đổi

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: active team + no leader

---

## TC-101

**Meta**:
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Team state`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — team partition: team inactive → 400

### Điều kiện tiên quyết
- Team inactive

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'inactive-team'}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.inactive
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: inactive team

---

## TC-107

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE — petition không có assignment (s0) → POST → có 1 assignment (s1)

### Điều kiện tiên quyết
- Petition ở s0: 0 assignments

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'LEAD'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Transition s0 → s1: danh sách có 1 item

**API**:
- HTTP 201, GET sau → 1 item

**Side effects** (DB, email, log, queue...):
- DB: 1 row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: Critical
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: s0→s1

---

## TC-108

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE — có 1 assignment (s1) → POST user mới → 2 assignments (s2)

### Điều kiện tiên quyết
- Petition ở s1: 1 assignment

### Các bước kiểm thử
- [ ] POST {userId:'user-2', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- List có 2 items

**API**:
- HTTP 201, GET sau → 2 items

**Side effects** (DB, email, log, queue...):
- DB: 2 rows

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Critical
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: s1→s2

---

## TC-109

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE — có 2 assignments (s2) → DELETE 1 → 1 assignment còn (s1)

### Điều kiện tiên quyết
- Petition ở s2: 2 assignments

### Các bước kiểm thử
- [ ] DELETE userId='user-1'

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- List còn 1 item

**API**:
- HTTP 200, GET sau → 1 item

**Side effects** (DB, email, log, queue...):
- row còn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Critical
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: s2→s1

---

## TC-110

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STATE — có 1 assignment (s1) → DELETE → không còn assignment (s0)

### Điều kiện tiên quyết
- Petition ở s1: 1 assignment

### Các bước kiểm thử
- [ ] DELETE userId='user-1'

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Empty state 'Chưa có cán bộ được phân công.'

**API**:
- HTTP 200, GET sau → []

**Side effects** (DB, email, log, queue...):
- rows

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Critical
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: s1→s0

---

## TC-112

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Team reassign`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STATE — PATCH /assign team-A (no leader) → PATCH /assign team-B (has leader) → assignedToId = leaderB

### Điều kiện tiên quyết
- team-A không có leader, team-B có leaderB

### Các bước kiểm thử
- [ ] PATCH /assign {team-A, expectedUpdatedAt:T1}
- [ ] PATCH /assign {team-B, expectedUpdatedAt:T2}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_no_leader, team.b_with_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 (both), petition.assignedTeamId='team-B', assignedToId='leaderB'

**Side effects** (DB, email, log, queue...):
- Petition updated twice

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: High
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Re-assign flow

---

## TC-117

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION — assignedToId provided + trong team → gán cụ thể người đó

### Điều kiện tiên quyết
- user-1 trong team-A

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:'user-1', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId='user-1' (không phải leaderId)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Decision: explicit override > auto-leader

---

## TC-118

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION — assignedToId provided + KHÔNG trong team → 400 (xử lý lỗi trước khi auto)

### Điều kiện tiên quyết
- user-2 không trong team-A

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:'user-2', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400, 'Cán bộ xử lý không thuộc tổ được chỉ định'

**Side effects** (DB, email, log, queue...):
- Không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Validation trước auto-assign

---

## TC-119

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION — assignedToId null + team có leader → auto-gán leader

### Điều kiện tiên quyết
- team-A có leader

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:null, expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.with_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId = leaderId

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Auto-assign logic

---

## TC-120

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DECISION — assignedToId null + team không có leader → fail-open (null)

### Điều kiện tiên quyết
- team-A không có isLeader=true

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:null, expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.no_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId = null (không lỗi)

**Side effects** (DB, email, log, queue...):
- assignedToId = null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Fail-open behavior

---

## TC-123

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Auth`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — GET không auth → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments không có Authorization header

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A07:2021 Authentication Failures

---

## TC-124

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — POST không auth → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments không JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- Không tạo row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A07:2021

---

## TC-125

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — DELETE không auth → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] DELETE /assignments/:userId không JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- Không xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A07:2021

---

## TC-126

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — PATCH /assign không auth → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign không JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- Petition không đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A07:2021

---

## TC-127

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Token tamper`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — JWT tampered (signature invalid) → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với JWT payload hợp lệ nhưng signature sai

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401, invalid signature

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify JWT signature

---

## TC-128

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Alg confusion`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — JWT với algorithm 'none' → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST với JWT alg:none, không sign

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Algorithm confusion attack — A07:2021

---

## TC-129

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A01 / Broken Access`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — POST với viewer role (không có edit Petition) → 403

### Điều kiện tiên quyết
- Viewer không có edit Petition permission

### Các bước kiểm thử
- [ ] POST /assignments với JWT viewer

### Dữ liệu kiểm thử
```
account.viewer.primary, petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 403

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A01:2021 Broken Access Control

---

## TC-130

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — PATCH /assign với non-dispatcher role → 403

### Điều kiện tiên quyết
- Officer không có DispatchGuard permission

### Các bước kiểm thử
- [ ] PATCH /assign với JWT officer

### Dữ liệu kiểm thử
```
account.officer.primary, petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 403

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DispatchGuard — RBAC enforcement

---

## TC-131

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A04 / Mass assignment`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — Mass assignment: POST body với assignedById → ignored (actorId từ JWT)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:'LEAD', assignedById:'attacker', petitionId:'other'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, assignedById = JWT user ID (không phải 'attacker')

**Side effects** (DB, email, log, queue...):
- DB: assignedById = logged-in user

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A04:2021 Insecure Design — actorId từ @CurrentUser()

---

## TC-132

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A02 / Data exposure`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — Response không có sensitive fields (password hash, salt, twoFaSecret)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments, inspect response.user và response.assignedBy

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response.user chỉ có {id, firstName, lastName, email, username}. Không có: password, passwordHash, salt, refreshToken

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A02:2021 Cryptographic/Data Failures

---

## TC-133

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A03 / SQLi`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — SQL injection trong userId path → không execute

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST body {userId:"1'; DROP TABLE petition_assignments; --"}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 hoặc 400 — không execute SQL

**Side effects** (DB, email, log, queue...):
- petition_assignments table vẫn intact

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A03:2021 Injection — Prisma parameterized

---

## TC-150

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Full flow`
- Yêu cầu: `REQ-PA-INT`
- Kỹ thuật: `Integration / E2E flow`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION — Tạo petition → PATCH assign → GET assignments → DELETE → GET rỗng

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /petitions → petitionId
- [ ] PATCH /assign {teamId, auto-leader}
- [ ] POST /assignments {user-2, SUPPORT}
- [ ] GET /assignments → verify 2 items
- [ ] DELETE user-2
- [ ] GET /assignments → verify 1 item

### Dữ liệu kiểm thử
```
account.dispatcher.primary, petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- Tất cả HTTP 200/201, GET cuối → [leader only]

**Side effects** (DB, email, log, queue...):
- DB consistent sau mỗi bước

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Full flow`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Full flow`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-150
severity: Critical
module: Full flow
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Full round-trip integration

---

## TC-151

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `UI + API`
- Yêu cầu: `REQ-PA-INT`
- Kỹ thuật: `Integration / Persistence`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION — PetitionFormPage edit: thêm assignment qua UI → reload page → vẫn còn

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở /petitions/:id/edit
- [ ] Thêm user-3 qua UI
- [ ] Reload page
- [ ] Kiểm tra danh sách

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- user-3 vẫn có trong danh sách sau reload

**API**:
- GET /assignments sau reload → user-3 present

**Side effects** (DB, email, log, queue...):
- Data persisted in DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI + API`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI + API`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-151
severity: Critical
module: UI + API
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Persistence test

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH /assign — gán với assignedToId hợp lệ trong team

### Điều kiện tiên quyết
- Team-A có user-officer1 là thành viên

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-A', assignedToId:'user-officer1', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.with_members
```

### Kết quả mong đợi
**UI**:
- Cán bộ user-officer1 hiển thị trong chi tiết đơn

**API**:
- HTTP 200, petition.assignedToId = 'user-officer1'

**Side effects** (DB, email, log, queue...):
- assignedToId cập nhật trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Explicit assignment

---

## TC-011

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `Black-box`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — response bao gồm user relation đầy đủ

### Điều kiện tiên quyết
- user-3 có firstName='Lê', lastName='Văn C', username='levanc'

### Các bước kiểm thử
- [ ] POST /assignments {userId:'user-3', role:'SUPPORT'} → inspect response

### Dữ liệu kiểm thử
```
petition.new.D0, user.officer3_with_name
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, response.user.firstName='Lê', response.user.lastName='Văn C', response.user.username='levanc', response.assignedBy.username present

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: user relation + assignedBy relation

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / Use case`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — section header và form load khi mở PetitionFormPage edit mode

### Điều kiện tiên quyết
- Đăng nhập officer, mở petition edit page

### Các bước kiểm thử
- [ ] Navigate /petitions/:id/edit
- [ ] Cuộn đến section 'Phân công cán bộ'

### Dữ liệu kiểm thử
```
account.officer.primary, petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Section 'Phân công cán bộ' hiển thị với form select Cán bộ + Vai trò + nút Thêm

**API**:
- GET /petitions/:id/assignments tự động gọi khi load

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: E2E navigation test

---

## TC-016

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-I`
- Kỹ thuật: `UI / State`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — chọn role LEAD → badge 'Chủ trì' màu xanh

### Điều kiện tiên quyết
- Petition có 0 assignments

### Các bước kiểm thử
- [ ] Chọn user-3
- [ ] Đổi vai trò thành 'Chủ trì'
- [ ] Click Thêm

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Badge hiển thị 'Chủ trì' với class bg-blue-100 text-blue-700

**API**:
- POST với role='LEAD'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: LEAD role badge styling

---

## TC-039

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Invalid enum`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — role là giá trị không hợp lệ 'MANAGER' → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId:'user-3', role:'MANAGER'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc HTTP 201 với role='MANAGER' (tùy validation)

**Side effects** (DB, email, log, queue...):
- Nếu không có enum validation: row với role='MANAGER' trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: role là String trong schema, FE enforces enum — cần kiểm tra BE validation

---

## TC-042

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Invalid ID`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — userId là string không phải ID format → DB FK error

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId:'invalid-user-id', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 hoặc HTTP 400 — userId không tồn tại trong user table → FK violation

**Side effects** (DB, email, log, queue...):
- Không tạo row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: FK constraint khi userId không tồn tại

---

## TC-043

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Invalid path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — petitionId không phải CUID format → 404

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/!!!invalid-id!!!/assignments {userId, role}

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (petition findFirst → không tìm thấy)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: CUID vs UUID — Prisma findFirst không throw trên invalid format

---

## TC-044

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Invalid path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DELETE /assignments — userId trong URL không phải format ID → 404

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] DELETE /api/v1/petitions/:id/assignments/INVALID_USER_ID

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, assignment không tìm thấy

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Medium
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findUnique petitionId_userId composite key

---

## TC-045

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Clear assignment`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH /assign — assignedTeamId = null → xóa team assignment

### Điều kiện tiên quyết
- Petition có assignedTeamId='team-A'

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId: null, expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.assigned_team.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, petition.assignedTeamId = null

**Side effects** (DB, email, log, queue...):
- Petition.assignedTeamId set null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Clear team assignment

---

## TC-046

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Bad payload`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — request body là malformed JSON → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với Content-Type: application/json, body = '{bad json'

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400, JSON parse error

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS body parser error

---

## TC-047

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Security / Mass assignment`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — extra fields trong body bị ignore (mass assignment safe)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId:'user-3', role:'SUPPORT', assignedById:'attacker-id', petitionId:'wrong-id'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, response.assignedById = actorId thực tế (không phải 'attacker-id')

**Side effects** (DB, email, log, queue...):
- DB: assignedById = logged-in user ID

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: actorId lấy từ JWT, không từ body

---

## TC-048

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Partial delete`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DELETE /assignments — petition có nhiều assignments, chỉ xóa đúng 1 user

### Điều kiện tiên quyết
- Petition có user-1 và user-2 assigned

### Các bước kiểm thử
- [ ] DELETE /petitions/:id/assignments/user-1

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Chỉ user-1 biến mất, user-2 vẫn còn

**API**:
- HTTP 200, GET sau đó có 1 item (user-2)

**Side effects** (DB, email, log, queue...):
- Chỉ row userId=user-1 bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: deleteMany with petitionId_userId unique

---

## TC-049

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-NOTFOUND`
- Kỹ thuật: `State / Soft delete`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /assignments — petition bị soft-delete → 404

### Điều kiện tiên quyết
- Petition đã bị soft-delete

### Các bước kiểm thử
- [ ] GET /petitions/deleted-petition/assignments

### Dữ liệu kiểm thử
```
petition.deleted.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: listAssignments: findFirst({deletedAt:null})

---

## TC-050

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Status independence`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — petition ở mọi status vẫn có thể thêm (không block theo status)

### Điều kiện tiên quyết
- Petition có status DA_CHUYEN_VU_VIEC

### Các bước kiểm thử
- [ ] POST /assignments {userId:'user-3', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.converted_incident.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 (không block theo status)

**Side effects** (DB, email, log, queue...):
- Row mới tạo bình thường

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Không có status gate — service không validate petition status

---

## TC-051

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Decision / Multi-leader`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PATCH /assign — team có 2 isLeader=true, không gửi assignedToId → gán leader đầu tiên

### Điều kiện tiên quyết
- Team-A có 2 users đều isLeader=true

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-A', expectedUpdatedAt} (không gửi assignedToId)

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.multi_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedToId = 1 trong 2 leader (tùy order DB)

**Side effects** (DB, email, log, queue...):
- Một trong 2 leaders được gán

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: Low
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findMany().find(m=>m.isLeader) → đầu tiên tìm thấy

---

## TC-053

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / SQLi`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — userId chứa SQL injection string → sanitized, không execute

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId:"'; DROP TABLE petition_assignments;--", role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (petition not found) hoặc HTTP 400 — không execute SQL

**Side effects** (DB, email, log, queue...):
- Table petition_assignments vẫn tồn tại

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Prisma parameterized queries — SQL injection không thể xảy ra

---

## TC-054

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Recovery / Timeout`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — request timeout → UI loading state reset

### Điều kiện tiên quyết
- Server delay 31 giây (vượt timeout)

### Các bước kiểm thử
- [ ] POST /assignments, chờ timeout

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nút 'Thêm' trở về trạng thái bình thường (không bị kẹt 'Đang thêm...')

**API**:
- HTTP timeout / 504

**Side effects** (DB, email, log, queue...):
- isAdding = false sau timeout

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: finally { setIsAdding(false) }

---

## TC-055

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Error / Recovery`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — POST /assignments fail → hiện error message, không crash

### Điều kiện tiên quyết
- Server trả về 500 khi thêm assignment

### Các bước kiểm thử
- [ ] Chọn cán bộ, click Thêm
- [ ] Server mock trả về 500

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Hiện text 'Không thể thêm phân công. Vui lòng thử lại.' (data-testid=assignment-error)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- isAdding = false, addUserId không reset

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: catch { setAddError('...') }

---

## TC-056

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Error / Recovery`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — DELETE fail → hiện error message

### Điều kiện tiên quyết
- Server trả về 500 khi xóa

### Các bước kiểm thử
- [ ] Click trash icon
- [ ] Server mock trả về 500

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Hiện error message, assignment vẫn còn trong list

**API**:
- -

**Side effects** (DB, email, log, queue...):
- Không có gì bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: catch { setAddError('Không thể xóa...') }

---

## TC-057

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Error / Recovery`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — GET /assignments fail khi load → empty state (không crash)

### Điều kiện tiên quyết
- Server trả về 500 khi GET assignments

### Các bước kiểm thử
- [ ] Mở PetitionFormPage, GET /assignments mock → 500

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Hiển thị 'Chưa có cán bộ được phân công.' (empty state), không crash

**API**:
- -

**Side effects** (DB, email, log, queue...):
- setAssignments([]) trong catch block

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: catch() { if(!aborted) setAssignments([]) }

---

## TC-059

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Edge`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — dropdown trống khi tất cả users đã được assigned

### Điều kiện tiên quyết
- Cả 3 users trong userOptions đã assigned cho petition

### Các bước kiểm thử
- [ ] Kiểm tra select options

### Dữ liệu kiểm thử
```
petition.all_assigned.D7 (3 users, cả 3 assigned)
```

### Kết quả mong đợi
**UI**:
- Dropdown chỉ có '-- Chọn cán bộ --', nút Thêm disabled

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: availableUsers.length === 0

---

## TC-060

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Memory / Cleanup`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — unmount khi đang fetch → không memory leak (AbortController)

### Điều kiện tiên quyết
- GET /assignments in-flight khi navigate away

### Các bước kiểm thử
- [ ] Mở edit page
- [ ] Navigate away ngay (trước khi GET hoàn thành)

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Không có 'Can't perform a React state update on an unmounted component' warning

**API**:
- GET bị abort

**Side effects** (DB, email, log, queue...):
- setAssignments không được gọi sau unmount

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: AbortController trong useEffect cleanup

---

## TC-061

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Concurrency / Load`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST /assignments — concurrent 5 users khác nhau → tất cả 5 row được tạo

### Điều kiện tiên quyết
- users chưa assigned

### Các bước kiểm thử
- [ ] Gửi đồng thời 5 POST requests với userId khác nhau

### Dữ liệu kiểm thử
```
petition.new.D0, 5 unique users
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- × HTTP 201

**Side effects** (DB, email, log, queue...):
- rows trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Concurrent creates — no conflict nếu userId khác nhau

---

## TC-062

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / Data exposure`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /assignments — response không leak password hay sensitive user data

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments, inspect response JSON

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response.user không có: password, passwordHash, salt, refreshToken, twoFaSecret

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: select: {id, firstName, lastName, email, username} — no password

---

## TC-063

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / XSS`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — XSS payload trong userId → không execute script

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body {userId:'<script>alert(1)</script>', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nếu UI hiện userId, không execute script

**API**:
- HTTP 400 hoặc HTTP 404 (userId not found)

**Side effects** (DB, email, log, queue...):
- Không có script execution

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Prisma parameterized queries + React JSX escaping

---

## TC-065

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Sequential`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — thêm liên tiếp 3 assignments → list update từng cái chính xác

### Điều kiện tiên quyết
- users chưa assigned

### Các bước kiểm thử
- [ ] Thêm user-1
- [ ] Thêm user-2
- [ ] Thêm user-3
- [ ] Kiểm tra list

### Dữ liệu kiểm thử
```
petition.new.D0, 3 users
```

### Kết quả mong đợi
**UI**:
- items trong list, mỗi item đúng user

**API**:
- POST request tuần tự, mỗi lần 201

**Side effects** (DB, email, log, queue...):
- rows trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: setAssignments(prev => [...prev, newItem])

---

## TC-067

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Idempotency`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH /assign — gán cùng team lần 2 → idempotent, HTTP 200, không lỗi

### Điều kiện tiên quyết
- Petition đã có assignedTeamId='team-A'

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId:'team-A', expectedUpdatedAt} (cùng team lần 2)

### Dữ liệu kiểm thử
```
petition.assigned_team.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- assignedTeamId vẫn = 'team-A'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Update is idempotent

---

## TC-070

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Concurrency / Race`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — concurrent delete + add cùng user → consistent state

### Điều kiện tiên quyết
- user-1 đang assigned

### Các bước kiểm thử
- [ ] Đồng thời: DELETE user-1 + POST user-1

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- Một trong hai thành công: hoặc user-1 assigned (201) hoặc không (404 trên delete)

**Side effects** (DB, email, log, queue...):
- Consistent — không có orphaned state

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Race condition — eventual consistency

---

## TC-072

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Recovery / Network`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — network disconnected → error message hiển thị

### Điều kiện tiên quyết
- DevTools offline mode

### Các bước kiểm thử
- [ ] Ngắt mạng
- [ ] Click Thêm

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Error message 'Không thể thêm phân công. Vui lòng thử lại.' xuất hiện

**API**:
- -

**Side effects** (DB, email, log, queue...):
- isAdding=false

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Network error caught → setAddError

---

## TC-073

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Recovery / Server error`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: UI — backend trả về 500 trên GET load → không crash, hiện empty state

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mock GET /assignments → 500

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Không crash, hiện 'Chưa có cán bộ được phân công.'

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: catch → setAssignments([])

---

## TC-076

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Load`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — rate limiting: 100 request liên tiếp — server không crash

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Gửi 100 POST /assignments sequential với unique userId mỗi lần

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- Tất cả ≥ HTTP 200 (201 hoặc 409), server không crash/500

**Side effects** (DB, email, log, queue...):
- Tối đa 100 rows mới (nếu không dùng pagination limit)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No explicit rate limit trên endpoint này

---

## TC-079

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / String enum`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY — role='LEAD' (giá trị đúng, chuỗi 4 ký tự) → PASS

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'LEAD'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='LEAD'

**Side effects** (DB, email, log, queue...):
- DB: role='LEAD'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Giá trị enum min-length hợp lệ

---

## TC-080

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / String enum`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: BOUNDARY — role='SUPPORT' (giá trị đúng, 7 ký tự) → PASS

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='SUPPORT'

**Side effects** (DB, email, log, queue...):
- DB: role='SUPPORT'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Giá trị enum max-length hợp lệ

---

## TC-082

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Empty collection`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY — 0 assignments → HTTP 200 + []

### Điều kiện tiên quyết
- Petition mới, 0 assignments

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Empty state text

**API**:
- HTTP 200, data=[]

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: min-length = 0

---

## TC-083

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Single item`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY — 1 assignment → HTTP 200 + [item]

### Điều kiện tiên quyết
- assignment

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- item trong list

**API**:
- HTTP 200, data.length=1

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: min+1

---

## TC-085

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / ID format`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY — userId = CUID hợp lệ (26 chars) → PASS

### Điều kiện tiên quyết
- User với CUID tồn tại

### Các bước kiểm thử
- [ ] POST {userId:'clxxxxxxxxxxxxxxxxxxxxxxxxxxx', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0, user.cuid_valid
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: CUID = 25 chars starting with 'c'

---

## TC-093

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Default value`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — role partition undefined/omitted → default SUPPORT

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId, không có role} — partition role absent

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='SUPPORT'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Partition 3/3: role=undefined → default

---

## TC-094

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Invalid class`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP — role partition invalid → reject

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {role:'INVALID_ROLE'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc 201 với invalid role (tùy validator)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Partition: invalid enum class

---

## TC-098

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Cross-team`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP — user partition: user KHÔNG trong team của petition → vẫn PASS (no validation)

### Điều kiện tiên quyết
- Petition assignedTeamId=team-A, user-2 trong team-B

### Các bước kiểm thử
- [ ] POST {userId:'user-2', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.assigned_team.D7, user.in_other_team
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 (không validate team membership trong POST /assignments)

**Side effects** (DB, email, log, queue...):
- Row tạo thành công

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Chỉ PATCH /assign mới validate team membership

---

## TC-102

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Member validation`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — assignedToId partition: userId trong đúng team → PASS

### Điều kiện tiên quyết
- user-1 là thành viên team-A

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:'user-1'}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_with_user1
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: member of target team

---

## TC-103

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Member validation`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — assignedToId partition: userId KHÔNG trong team → 400

### Điều kiện tiên quyết
- user-2 thuộc team-B, không thuộc team-A

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:'user-2'}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_user2_in_b
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: non-member of target team

---

## TC-104

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Assignment count`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EP — petition partition: 0 assignments → có thể thêm

### Điều kiện tiên quyết
- Petition chưa có assignment nào

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'LEAD'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: EP class: no existing assignments

---

## TC-105

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Assignment count`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — petition partition: có N assignments rồi → vẫn có thể thêm user mới

### Điều kiện tiên quyết
- Petition đã có 5 assignments

### Các bước kiểm thử
- [ ] POST {userId:'user-new', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.with_5_assignments.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- rows tổng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Không giới hạn số assignments

---

## TC-106

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Cross-petition`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — same user, 2 petition khác nhau → 2 assignment riêng (không conflict)

### Điều kiện tiên quyết
- user-1 assigned cho petition-A

### Các bước kiểm thử
- [ ] POST petition-B/assignments {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.a.D7, petition.b.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 (không conflict — unique constraint chỉ trên petitionId+userId)

**Side effects** (DB, email, log, queue...):
- rows: (petition-A, user-1) + (petition-B, user-1)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: @@unique([petitionId, userId]) — không unique cross-petition

---

## TC-111

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Role transition`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STATE — có assignment LEAD → xóa LEAD → còn SUPPORT → thêm LEAD mới

### Điều kiện tiên quyết
- user-1 LEAD, user-2 SUPPORT

### Các bước kiểm thử
- [ ] DELETE user-1
- [ ] POST user-3 role LEAD

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- user-2 SUPPORT + user-3 LEAD trong list

**API**:
- HTTP 200 (delete) + HTTP 201 (add)

**Side effects** (DB, email, log, queue...):
- rows: user-2 SUPPORT, user-3 LEAD

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: High
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Role transition flow

---

## TC-113

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Cascade`
- Risk: `Cao`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: STATE — Xóa petition → cascade DELETE assignments

### Điều kiện tiên quyết
- Petition có 3 assignments

### Các bước kiểm thử
- [ ] DELETE petition (soft-delete), sau đó xem petition_assignments

### Dữ liệu kiểm thử
```
petition.with_3_assignments.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- Sau soft-delete: GET /assignments → 404 (petition không tồn tại). Cascade delete không xảy ra với soft-delete

**Side effects** (DB, email, log, queue...):
- DB: petition_assignments rows vẫn còn (chỉ petition.deletedAt set)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Soft delete ≠ hard delete — cascade chỉ xảy ra với hard delete

---

## TC-114

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Cascade`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STATE — Xóa user → cascade DELETE assignment của user đó

### Điều kiện tiên quyết
- user-1 có 2 assignments (khác petition)

### Các bước kiểm thử
- [ ] Hard delete user-1

### Dữ liệu kiểm thử
```
petition.with_user1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- GET /assignments sau → không còn user-1 (cascade đã xóa)

**Side effects** (DB, email, log, queue...):
- petition_assignments: rows có userId=user-1 bị xóa (onDelete: Cascade)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: High
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PetitionAssignment.user onDelete: Cascade

---

## TC-115

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Initial assign`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STATE — PATCH /assign khi petition chưa có team → set team và auto-assign leader

### Điều kiện tiên quyết
- Petition chưa có assignedTeamId (null)

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_with_leader
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedTeamId='team-A', assignedToId=leaderId

**Side effects** (DB, email, log, queue...):
- Petition từ unassigned → assigned

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: High
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Initial assignment state

---

## TC-121

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DECISION — assignedTeamId null, assignedToId null → clear toàn bộ

### Điều kiện tiên quyết
- Petition có assignedTeamId và assignedToId

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:null, assignedToId:null, expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.assigned_team.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, cả 2 field = null

**Side effects** (DB, email, log, queue...):
- Unassigned state

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Clear assignment

---

## TC-122

**Meta**:
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-DECISION`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DECISION — team thay đổi, assignedToId từ team cũ → 400 (không thuộc team mới)

### Điều kiện tiên quyết
- user-1 trong team-A, đang chuyển sang team-B

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-B', assignedToId:'user-1'}

### Dữ liệu kiểm thử
```
petition.assigned_to_team_a.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400

**Side effects** (DB, email, log, queue...):
- Không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Team change + old assignee — cross-check

---

## TC-134

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A01 / Path traversal`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — Path traversal trong petitionId → not found

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/../../admin/assignments

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (route không match hoặc petition not found)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Express router sanitizes path traversal

---

## TC-135

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A03 / Null byte`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — Null byte injection trong userId → rejected

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user\x00admin', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc 404 (userId not found)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Null byte in string — Prisma sanitizes

---

## TC-136

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A01 / IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — IDOR: user-A xóa assignment của petition không thuộc team-A → check permission

### Điều kiện tiên quyết
- petition-B thuộc team-B, user-A có edit Petition perm

### Các bước kiểm thử
- [ ] DELETE /petitions/petition-B/assignments/user-B với JWT user-A

### Dữ liệu kiểm thử
```
account.officer.team_a, petition.team_b.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 hoặc 403 — tùy DataScope policy

**Side effects** (DB, email, log, queue...):
- Verify: user-A không thể xóa nếu DataScope enforce team scope

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: Critical
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A01:2021 — IDOR cross-team

---

## TC-137

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A01 / CSRF`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — CSRF: request từ external domain không có JWT → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Simulate CSRF: POST /assignments từ evil.com không có Authorization header

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401 (không có JWT)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JWT = stateless, không cần CSRF token

---

## TC-143

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `Input validation`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY — Content-Type mismatch: POST với text/plain body → 400 hoặc 415

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với Content-Type: text/plain, body='userId=user-1'

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc 415 Unsupported Media Type

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-143
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS expects application/json

---

## TC-145

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Display logic`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DATA — displayName fallback: không có firstName/lastName → hiển thị username

### Điều kiện tiên quyết
- user có username='officer99', firstName=null, lastName=null

### Các bước kiểm thử
- [ ] POST {userId:'officer99'} → GET /assignments → check display

### Dữ liệu kiểm thử
```
petition.new.D0, user.no_name
```

### Kết quả mong đợi
**UI**:
- Hiển thị 'officer99' (username)

**API**:
- HTTP 200, user.username='officer99'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-145
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: displayName(): full || username fallback

---

## TC-146

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Timestamp`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DATA — assignedAt timestamp format UTC ISO8601

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST assignment → GET, inspect assignedAt

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- assignedAt hiển thị đúng theo timezone VN

**API**:
- HTTP 200, item.assignedAt format ISO8601, e.g. '2026-06-08T07:00:00.000Z'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-146
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: UTC storage, VN display via dates.ts

---

## TC-147

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DATA — Vietnamese special chars trong user name → display đúng

### Điều kiện tiên quyết
- user firstName='Nguyễn Thị Hương', lastName='Vũ'

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_vietnamese_user.D7
```

### Kết quả mong đợi
**UI**:
- Hiển thị 'Nguyễn Thị Hương Vũ' không bị méo hay mất dấu

**API**:
- HTTP 200, user.firstName='Nguyễn Thị Hương'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-147
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: UTF-8 Vietnamese diacritics

---

## TC-152

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: `Team + Assignment`
- Yêu cầu: `REQ-PA-INT`
- Kỹ thuật: `Integration / Data flow`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION — PATCH assign với team có leader → PetitionAssignment section hiện leader

### Điều kiện tiên quyết
- Team-A có leaderA

### Các bước kiểm thử
- [ ] PATCH /assign {team-A}
- [ ] Mở edit page
- [ ] Kiểm tra section phân công

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.a_with_leader
```

### Kết quả mong đợi
**UI**:
- leaderA không tự động xuất hiện trong PetitionAssignment section (auto-assign là field, không phải assignment record)

**API**:
- GET /assignments → [] (auto-assign chỉ set petition.assignedToId, không tạo PetitionAssignment record)

**Side effects** (DB, email, log, queue...):
- Phân biệt petition.assignedToId vs petition_assignments

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Team + Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Team + Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-152
severity: Critical
module: Team + Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Auto-assign ≠ PetitionAssignment — 2 khái niệm khác nhau

---

## TC-153

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: `Form + Assignment`
- Yêu cầu: `REQ-PA-INT`
- Kỹ thuật: `Integration / Form isolation`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: INTEGRATION — Submit PetitionFormPage không gửi assignment data trong request body

### Điều kiện tiên quyết
- Petition có 2 assignments

### Các bước kiểm thử
- [ ] Mở edit page với 2 assignments
- [ ] Sửa senderName
- [ ] Submit form
- [ ] GET assignments sau submit

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Assignments vẫn còn sau submit form

**API**:
- PUT /petitions/:id không có assignments field trong body

**Side effects** (DB, email, log, queue...):
- petition_assignments rows không thay đổi khi update petition

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Form + Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Form + Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-153
severity: Critical
module: Form + Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Assignment section độc lập với PetitionForm

---

## TC-154

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: `Regression`
- Yêu cầu: `REQ-PA-REG`
- Kỹ thuật: `Regression`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: REGRESSION — Thêm assignment không ảnh hưởng đến petition list page

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /petitions → note count
- [ ] POST /petitions/:id/assignments
- [ ] GET /petitions → verify count không đổi

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- GET /petitions: count không tăng

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-154
severity: Medium
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Assignment không tạo/xóa petition

---

## TC-155

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: `Regression`
- Yêu cầu: `REQ-PA-REG`
- Kỹ thuật: `Regression`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: REGRESSION — Thêm assignment không thay đổi petition.updatedAt

### Điều kiện tiên quyết
- Petition có updatedAt=T0

### Các bước kiểm thử
- [ ] POST /assignments
- [ ] GET /petitions/:id → check updatedAt

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- petition.updatedAt = T0 (không thay đổi)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-155
severity: Medium
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Assignment là bảng riêng — không trigger petition update

---

## TC-156

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: `Regression`
- Yêu cầu: `REQ-PA-REG`
- Kỹ thuật: `Regression`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: REGRESSION — Xóa assignment không thay đổi petition.status

### Điều kiện tiên quyết
- Petition status=DANG_XU_LY

### Các bước kiểm thử
- [ ] DELETE /assignments/user-1
- [ ] GET /petitions/:id → check status

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- petition.status vẫn = DANG_XU_LY

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-156
severity: High
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Status không phụ thuộc vào assignment

---

## TC-157

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: `Regression`
- Yêu cầu: `REQ-PA-REG`
- Kỹ thuật: `Regression`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: REGRESSION — PATCH /assign (phân công đội) không xóa petition_assignments đã có

### Điều kiện tiên quyết
- Petition có 2 assignments + assignedTeamId=team-A

### Các bước kiểm thử
- [ ] PATCH /assign {team-B, expectedUpdatedAt}
- [ ] GET /assignments → verify vẫn còn 2

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- GET /assignments vẫn trả về 2 items

**Side effects** (DB, email, log, queue...):
- petition_assignments không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-157
severity: Critical
module: Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PATCH /assign chỉ update petition.assignedTeamId/assignedToId

---

## TC-167

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Button accessible name`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Nút xóa có title='Xóa phân công' để screen reader đọc

### Điều kiện tiên quyết
- Petition có assignment

### Các bước kiểm thử
- [ ] Inspect delete button: kiểm tra title attr và aria

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Screen reader đọc 'Xóa phân công' khi focus vào trash button

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-167
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: title='Xóa phân công' → tooltip + SR name

---

## TC-185

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — GET /assignments với 1 item < 100ms

### Điều kiện tiên quyết
- assignment trong DB

### Các bước kiểm thử
- [ ] GET /assignments, measure response time

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response time < 100ms (p95)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-185
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Baseline performance

---

## TC-186

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — GET /assignments với 50 items < 500ms

### Điều kiện tiên quyết
- 0 assignments trong DB

### Các bước kiểm thử
- [ ] GET /assignments, measure response time

### Dữ liệu kiểm thử
```
petition.with_50_assignments.D30
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response time < 500ms (p95)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-186
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: List performance

---

## TC-187

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — POST /assignments < 200ms

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId, role}, measure time

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, response time < 200ms

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-187
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Create performance

---

## TC-188

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — DELETE /assignments < 200ms

### Điều kiện tiên quyết
- assignment

### Các bước kiểm thử
- [ ] DELETE, measure time

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response time < 200ms

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-188
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Delete performance

---

## TC-190

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Concurrency`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — Concurrent 10 GET /assignments cùng 1 petition → tất cả 200

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET requests đồng thời

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- × HTTP 200, không có 500

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-190
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Read concurrency

---

## TC-191

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Concurrency`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PERF — Concurrent 5 POST /assignments với userId khác nhau → tất cả 201

### Điều kiện tiên quyết
- users chưa assigned

### Các bước kiểm thử
- [ ] POST requests đồng thời

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- × HTTP 201, không có 500

**Side effects** (DB, email, log, queue...):
- rows trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-191
severity: High
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Write concurrency — no conflict

---

## TC-192

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / Response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PERF — PATCH /assign với DB query tìm leader < 300ms

### Điều kiện tiên quyết
- Team có 10 thành viên

### Các bước kiểm thử
- [ ] PATCH /assign {teamId, no assignedToId}, measure time

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.with_10_members
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response time < 300ms

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-192
severity: Medium
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: userTeam.findMany + find(isLeader)

---

## TC-193

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `UI / Debounce`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — double-click nút Thêm → chỉ gọi POST API 1 lần (không double-submit)

### Điều kiện tiên quyết
- user-3 đã chọn

### Các bước kiểm thử
- [ ] Double-click Thêm nhanh

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Chỉ 1 POST request được gửi

**API**:
- × HTTP 201

**Side effects** (DB, email, log, queue...):
- row, không duplicate

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-193
severity: High
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: disabled={!addUserId || isAdding} ngăn double-submit

---

## TC-194

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Error / UI feedback`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST trả về 409 (duplicate) → UI hiện error message rõ ràng

### Điều kiện tiên quyết
- user-1 đã assigned

### Các bước kiểm thử
- [ ] Chọn user-1, click Thêm (giả sử thoát khỏi UI filter do race)

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Error message hiển thị: 'Không thể thêm phân công. Vui lòng thử lại.'

**API**:
- POST → HTTP 409

**Side effects** (DB, email, log, queue...):
- addError set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-194
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: catch all errors → same message

---

## TC-196

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `UI / UX`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — xóa assignment không có confirmation dialog → immediate delete

### Điều kiện tiên quyết
- user-1 assigned

### Các bước kiểm thử
- [ ] Click trash → observe

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Không có confirm dialog. DELETE API gọi ngay

**API**:
- DELETE gọi ngay sau click

**Side effects** (DB, email, log, queue...):
- Row bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-196
severity: Low
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Current implementation: no confirm — potential UX risk

---

## TC-197

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Reset`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — sau add thành công, form reset: userId='' và role='SUPPORT' (default)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Chọn user-3, role LEAD
- [ ] Click Thêm → success
- [ ] Kiểm tra dropdown

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Dropdown về '-- Chọn cán bộ --', vai trò về 'Hỗ trợ'

**API**:
- -

**Side effects** (DB, email, log, queue...):
- setAddUserId('') sau success

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-197
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: setAddUserId('') — role không reset về SUPPORT

---

## TC-201

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Null body`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST với null body → 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments body=null hoặc không có body

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-201
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS DTO validation → 400

---

## TC-203

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Missing required`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — PATCH /assign thiếu expectedUpdatedAt → 400 hoặc conflict

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign body {assignedTeamId} không có expectedUpdatedAt

### Dữ liệu kiểm thử
```
petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 (validation) hoặc 409 (optimistic lock failed)

**Side effects** (DB, email, log, queue...):
- Petition không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-203
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: expectedUpdatedAt required trong DTO

---

## TC-204

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Content type`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST với Content-Type không phải application/json → 400 hoặc 415

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với Content-Type: multipart/form-data

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc 415

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-204
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS expects application/json

---

## TC-205

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Re-add`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — POST sau khi DELETE cùng user → 201 (unique constraint được free)

### Điều kiện tiên quyết
- user-1 đã assigned, sau đó bị xóa

### Các bước kiểm thử
- [ ] DELETE user-1 → 200
- [ ] POST user-1 lại → 201

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- user-1 xuất hiện lại trong list

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- Row mới tạo lại

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-205
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Unique constraint released sau delete

---

## TC-207

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Self-assign`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST self-assign (actorId === userId) → cho phép

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments {userId: <JWT user's own ID>, role:'LEAD'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Người dùng thấy chính mình trong danh sách

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- assignedById = userId (cùng người)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-207
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Không có validation chống self-assign

---

## TC-209

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / FK violation`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — PATCH /assign với assignedToId không tồn tại trong DB → FK error

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId:'team-A', assignedToId:'nonexistent-user'}

### Dữ liệu kiểm thử
```
petition.unassigned.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc 500 (FK violation) → cần proper handling

**Side effects** (DB, email, log, queue...):
- Petition không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-209
severity: High
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: FK userId → User table

---

## TC-210

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Partial update`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — PATCH /assign body không có assignedTeamId → giữ nguyên team hiện tại

### Điều kiện tiên quyết
- Petition có assignedTeamId='team-A'

### Các bước kiểm thử
- [ ] PATCH /assign {assignedToId:'user-1', expectedUpdatedAt} không có assignedTeamId

### Dữ liệu kiểm thử
```
petition.assigned_team.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, assignedTeamId vẫn = 'team-A'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-210
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Partial PATCH — undefined không overwrite

---

## TC-211

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Soft-deleted user`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST userId của user bị soft-delete → FK valid (user row exists)

### Điều kiện tiên quyết
- user-1 bị soft-delete (deletedAt set)

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0, user.soft_deleted
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 (FK không fail vì row vẫn tồn tại)

**Side effects** (DB, email, log, queue...):
- assignment row tạo thành công

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-211
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Soft-delete ≠ hard-delete — FK still valid

---

## TC-213

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Count verification`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — GET sau DELETE → count giảm 1 chính xác

### Điều kiện tiên quyết
- assignments

### Các bước kiểm thử
- [ ] GET → count=3
- [ ] DELETE user-1
- [ ] GET → count=2

### Dữ liệu kiểm thử
```
petition.with_3_assignments.D7
```

### Kết quả mong đợi
**UI**:
- List giảm xuống 2

**API**:
- GET trả về array 2 phần tử

**Side effects** (DB, email, log, queue...):
- DB: 2 rows

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-213
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Delete accuracy

---

## TC-214

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Mass assignment safety`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — POST với assignedTeamId field trong body → ignored (không phải field hợp lệ của DTO)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:'SUPPORT', assignedTeamId:'team-X'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, petition.assignedTeamId không đổi

**Side effects** (DB, email, log, queue...):
- assignedTeamId trong petition KHÔNG thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-214
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DTO không có assignedTeamId field

---

## TC-217

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Archived petition`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — PATCH /assign khi petition bị archive → ...

### Điều kiện tiên quyết
- Petition status=DA_DONG

### Các bước kiểm thử
- [ ] PATCH /assign {assignedTeamId, expectedUpdatedAt}

### Dữ liệu kiểm thử
```
petition.closed.D30
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 (không có status gate) hoặc HTTP 400 nếu có validation

**Side effects** (DB, email, log, queue...):
- Tùy business rule

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-217
severity: Medium
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Kiểm tra xem có status validation không

---

## TC-219

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-AUTH`
- Kỹ thuật: `Security / Auth method`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED — POST không có Authorization header nhưng có cookie → vẫn 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST với Cookie header nhưng không có Authorization: Bearer

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401 (JWT từ header, không phải cookie)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-219
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JWT strategy sử dụng header, không phải cookie

---

## TC-221

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Concurrency / Multi-tab`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — GET /assignments trả về data sau khi có change từ tab khác (race)

### Điều kiện tiên quyết
- tabs cùng mở edit page

### Các bước kiểm thử
- [ ] Tab A: add user-3. Tab B: GET /assignments

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Tab B thấy user-3 sau reload

**API**:
- GET trong Tab B trả về fresh data

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-221
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No real-time sync — need page refresh

---

## TC-222

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Large payload`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST với oversized payload (1MB body) → 413 Request Too Large

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với body 1MB (padding extra fields)

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 413 hoặc 400

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-222
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS body size limit default 10MB

---

## TC-223

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Concurrency / AbortController`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — Multiple GET requests đồng thời từ cùng component → abort tất cả trừ last

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] petitionId thay đổi nhanh 3 lần

### Dữ liệu kiểm thử
```
multiple petitions
```

### Kết quả mong đợi
**UI**:
- Chỉ data của petition cuối cùng hiển thị

**API**:
- Các request cũ bị abort

**Side effects** (DB, email, log, queue...):
- AbortController cancel previous requests

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-223
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: useEffect cleanup = controller.abort()

---

## TC-226

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Error reset`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — Error message tự xóa sau lần thêm/xóa thành công tiếp theo

### Điều kiện tiên quyết
- Có error message đang hiển thị

### Các bước kiểm thử
- [ ] Trigger error (add fail)
- [ ] Thêm user khác thành công
- [ ] Kiểm tra error message

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Error message biến mất sau success

**API**:
- -

**Side effects** (DB, email, log, queue...):
- setAddError(null) ở đầu handleAdd

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-226
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: handleAdd: setAddError(null) → then try

---

## TC-229

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Null value`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — role = null → default SUPPORT (controller: dto.role ?? 'SUPPORT')

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:null}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201, role='SUPPORT'

**Side effects** (DB, email, log, queue...):
- role='SUPPORT' trong DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-229
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: null ?? 'SUPPORT' = 'SUPPORT'

---

## TC-231

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / ID length`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — petitionId là CUID 26 chars (valid Prisma ID) → PASS

### Điều kiện tiên quyết
- Petition có CUID format ID

### Các bước kiểm thử
- [ ] POST /petitions/clxxxxxxxxxxxxxxxxxxxxxxxxx/assignments

### Dữ liệu kiểm thử
```
petition.with_cuid_id
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 hoặc 404 nếu không tồn tại

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-231
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: CUID = 26 chars

---

## TC-235

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `EP`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Status partition`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP — petition status partition: KIEM_TRA → GET /assignments OK

### Điều kiện tiên quyết
- Petition status=KIEM_TRA

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.status_kiem_tra.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EP`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EP`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-235
severity: Medium
module: EP
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Status không ảnh hưởng GET

---

## TC-236

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `EP`
- Yêu cầu: `REQ-PA-EP`
- Kỹ thuật: `EP / Role partition`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP — user partition: admin (không cần thuộc team) → POST /assignments OK

### Điều kiện tiên quyết
- Admin user không thuộc bất kỳ team nào, có edit Petition permission

### Các bước kiểm thử
- [ ] POST /assignments với JWT admin

### Dữ liệu kiểm thử
```
petition.new.D0, account.admin.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EP`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EP`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-236
severity: High
module: EP
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Admin có thể assign mà không cần team membership

---

## TC-237

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `SECURITY`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Token format`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — Authorization: Bearer token với extra spaces → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments với Authorization: 'Bearer  <token>' (2 spaces)

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401 (malformed Authorization header)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `SECURITY`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `SECURITY`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-237
severity: High
module: SECURITY
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Strict parsing — extra spaces invalid

---

## TC-064

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Reset`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: UI — add assignment thành công → dropdown reset về placeholder

### Điều kiện tiên quyết
- user-3 chưa assigned

### Các bước kiểm thử
- [ ] Chọn user-3
- [ ] Click Thêm → wait success

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Select value về '' (placeholder '-- Chọn cán bộ --')

**API**:
- -

**Side effects** (DB, email, log, queue...):
- setAddUserId('') sau success

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Low
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: UX: form reset sau add

---

## TC-066

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Sync`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: UI — sau khi xóa assignment, user xuất hiện lại trong dropdown

### Điều kiện tiên quyết
- user-1 đang assigned

### Các bước kiểm thử
- [ ] Xóa user-1
- [ ] Kiểm tra dropdown

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- user-1 xuất hiện lại trong dropdown Cán bộ

**API**:
- -

**Side effects** (DB, email, log, queue...):
- setAssignments(prev => prev.filter(a => a.userId !== userId))

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: availableUsers recomputed từ assignments state

---

## TC-068

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — Unicode name trong user → hiển thị đúng

### Điều kiện tiên quyết
- user có firstName='Nguyễn', lastName='Văn Đức'

### Các bước kiểm thử
- [ ] POST /assignments {userId:'unicode-user', role:'SUPPORT'} → GET list → check display

### Dữ liệu kiểm thử
```
petition.new.D0, user.vietnamese_name
```

### Kết quả mong đợi
**UI**:
- Hiển thị 'Nguyễn Văn Đức' đúng trong list, không bị méo

**API**:
- HTTP 201, user.firstName='Nguyễn', user.lastName='Văn Đức'

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Vietnamese chars in names

---

## TC-069

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Nullable`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /assignments — assignedBy field là optional, không crash nếu null

### Điều kiện tiên quyết
- Assignment có assignedById = user đã bị xóa (cascaded)

### Các bước kiểm thử
- [ ] GET /assignments, inspect response

### Dữ liệu kiểm thử
```
petition.with_orphan_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Không crash UI

**API**:
- HTTP 200, item.assignedBy có thể là null hoặc object

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: assignedBy?: Partial<UserOption> — optional trong interface

---

## TC-071

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Idempotency`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DELETE /assignments — DELETE duplicate (2 lần cùng userId) → 2nd request 404

### Điều kiện tiên quyết
- user-1 assigned

### Các bước kiểm thử
- [ ] DELETE user-1 → 200
- [ ] DELETE user-1 lần 2 → ?

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 (lần 1), HTTP 404 (lần 2)

**Side effects** (DB, email, log, queue...):
- Chỉ 1 row bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Medium
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Sau lần 1 xóa, lần 2 findUnique → null → 404

---

## TC-074

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / CSRF`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH /assign — CSRF attack từ external domain → bị chặn bởi JWT stateless

### Điều kiện tiên quyết
- Tấn công từ evil.com

### Các bước kiểm thử
- [ ] CSRF POST tới PATCH /assign với cookie nhưng không có JWT header

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401 (JWT không có trong Authorization header)

**Side effects** (DB, email, log, queue...):
- Petition không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Critical
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JWT = stateless CSRF protection

---

## TC-075

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /assignments — IDOR: user team-A xem assignment của petition team-B

### Điều kiện tiên quyết
- user-A thuộc team-A, petition-B thuộc team-B

### Các bước kiểm thử
- [ ] GET /petitions/petition-B/assignments với JWT user-A

### Dữ liệu kiểm thử
```
account.officer.team_a, petition.team_b.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 hoặc HTTP 403 tùy DataScope policy

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DataScope: _dataScope param ignored trong listAssignments — cần verify policy

---

## TC-077

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / Method override`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST /assignments — HTTP method override header bị ignored

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /assignments với header X-HTTP-Method-Override: DELETE

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 (POST xử lý bình thường, không chuyển thành DELETE)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS không honor X-HTTP-Method-Override by default

---

## TC-078

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SECURITY`
- Kỹ thuật: `Security / JWT algo confusion`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST /assignments — JWT với algorithm 'none' (alg:none attack) → 401

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Craft JWT với alg:none, POST /assignments

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JwtModule verify algorithm — reject alg:none

---

## TC-081

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Empty string`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — role='' (empty string) → default về SUPPORT (controller fallback)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:''}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 với role='SUPPORT' hoặc HTTP 400 tùy DTO validator

**Side effects** (DB, email, log, queue...):
- Behavior của '' khác null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: dto.role ?? 'SUPPORT' — '' truthy → 'SUPPORT' không apply

---

## TC-084

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Large collection`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — 50 assignments → HTTP 200, tất cả 50 items (không có pagination limit)

### Điều kiện tiên quyết
- Petition có 50 assignments

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_50_assignments.D30
```

### Kết quả mong đợi
**UI**:
- Tất cả 50 items hiển thị (hoặc virtual scroll)

**API**:
- HTTP 200, data.length=50

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findMany không giới hạn — max =?

---

## TC-086

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Min-1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — userId = 1 char → invalid ID, không tìm thấy user → FK error

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'x', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 hoặc HTTP 400 (user không tồn tại)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: min-1 length ID

---

## TC-087

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Case sensitivity`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — role='LEAd' (mixed case) → FAIL, rejected hoặc stored as-is

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'LEAd'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 400 hoặc HTTP 201 với role='LEAd' (backend không normalize)

**Side effects** (DB, email, log, queue...):
- Nếu stored: badge hiển thị '???' (không match LEAD|SUPPORT)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Enum case-sensitive check

---

## TC-088

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Last item`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY — xóa assignment cuối cùng → list trở về []

### Điều kiện tiên quyết
- assignment còn lại

### Các bước kiểm thử
- [ ] DELETE last assignment

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Hiện 'Chưa có cán bộ được phân công.'

**API**:
- HTTP 200, GET sau đó trả về []

**Side effects** (DB, email, log, queue...):
- rows

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: High
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Empty state sau xóa hết

---

## TC-089

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Empty path`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: BOUNDARY — petitionId là empty string trong URL → 404 hay 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST /api/v1/petitions//assignments {userId, role}

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (route không match) hoặc HTTP 400

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Low
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Express routing: empty segment

---

## TC-090

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Max length`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: BOUNDARY — petitionId rất dài (500 chars) → handle gracefully (404)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/{500-char-string}/assignments

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (không tìm thấy petition)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Low
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No explicit path param length check — DB query fails gracefully

---

## TC-116

**Meta**:
- Loại: `STATE`
- Priority: `P2` 🟡
- Module: `Petition Assignment`
- Yêu cầu: `REQ-PA-STATE`
- Kỹ thuật: `State Transition / Sequential`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: STATE — Add 10 assignments tuần tự → list chính xác sau mỗi add

### Điều kiện tiên quyết
- 0 users sẵn sàng

### Các bước kiểm thử
- [ ] POST 10 lần với 10 userId khác nhau, GET sau mỗi lần

### Dữ liệu kiểm thử
```
petition.new.D0, 10 users
```

### Kết quả mong đợi
**UI**:
- Count tăng dần từ 1→10

**API**:
- GET /assignments sau mỗi POST → count tăng 1

**Side effects** (DB, email, log, queue...):
- rows tổng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petition Assignment`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petition Assignment`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Low
module: Petition Assignment
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Sequential state transitions

---

## TC-138

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A03 / XSS`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — XSS trong role field → không execute

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:'<img src=x onerror=alert(1)>'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nếu hiển thị role, không execute script

**API**:
- HTTP 400 hoặc 201 với stored XSS string

**Side effects** (DB, email, log, queue...):
- React JSX escapes output

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: High
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Stored XSS — React escapes by default

---

## TC-139

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A09 / Security logging`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — OWASP A09: Server không leak stack trace trong error response

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /petitions/invalid/assignments → inspect error body

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404, error body chỉ có message và statusCode — không có stack trace

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A09:2021 Logging — no stack trace in prod

---

## TC-140

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A09 / Log injection`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY — Log injection: userId có ký tự newline → sanitized trong logs

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'user\nFAKE_LOG_ENTRY', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 hoặc 400

**Side effects** (DB, email, log, queue...):
- Log không có injected entry

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Log injection prevention

---

## TC-141

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / DoS`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY — Rate limiting: 50 POST liên tiếp từ 1 IP → không 500

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST requests tuần tự với cùng auth token

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- Tất cả ≥ 200, không có 500. Có thể có 429 nếu rate limit configured

**Side effects** (DB, email, log, queue...):
- Server không crash

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-141
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No explicit rate limit — server stability

---

## TC-142

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Revocation`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SECURITY — JWT từ deactivated user → 401 hoặc 403

### Điều kiện tiên quyết
- User deactivated trong DB

### Các bước kiểm thử
- [ ] GET /assignments với JWT của user đã deactivated

### Dữ liệu kiểm thử
```
account.deactivated.primary, petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401 hoặc 403 (tùy strategy — stateless JWT có thể không revoke ngay)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-142
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JWT stateless — revocation không immediate

---

## TC-144

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Replay`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SECURITY — Replay attack: reuse expired JWT → 401

### Điều kiện tiên quyết
- JWT đã expire 1 ngày trước

### Các bước kiểm thử
- [ ] POST /assignments với expired JWT

### Dữ liệu kiểm thử
```
-
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 401

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-144
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JWT exp claim verification

---

## TC-148

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Nullable`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DATA — assignedBy nullable (user được gán trực tiếp vào DB không qua API) → UI không crash

### Điều kiện tiên quyết
- Assignment có assignedById trỏ đến user đã bị xóa hard

### Các bước kiểm thử
- [ ] GET /assignments, inspect item.assignedBy

### Dữ liệu kiểm thử
```
petition.with_orphan_assignment.D7
```

### Kết quả mong đợi
**UI**:
- UI không crash, hiển thị tên cán bộ bình thường

**API**:
- HTTP 200, item.assignedBy có thể null

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-148
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: assignedBy?: Partial<UserOption> — optional

---

## TC-149

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Field completeness`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DATA — GET response đủ 8 fields theo interface: id, petitionId, userId, user, role, assignedById, assignedBy?, assignedAt

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments, so sánh response fields với interface Assignment

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, mỗi item có: id, petitionId, userId, user{id,username,firstName,lastName}, role, assignedById, assignedBy{id,username}, assignedAt

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-149
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Interface compliance

---

## TC-158

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `EDGE`
- Yêu cầu: `REQ-PA-EDGE`
- Kỹ thuật: `Edge / Cascade`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE — GET /assignments sau khi petition bị hard-deleted → 404 hoặc []

### Điều kiện tiên quyết
- Petition hard-deleted (cascade)

### Các bước kiểm thử
- [ ] GET /petitions/hard-deleted-id/assignments

### Dữ liệu kiểm thử
```
petition.hard_deleted.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 (petition findFirst → null)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EDGE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EDGE`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-158
severity: Medium
module: EDGE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Hard delete ≠ soft delete

---

## TC-159

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `EDGE`
- Yêu cầu: `REQ-PA-EDGE`
- Kỹ thuật: `Edge / Orphan`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE — Petition có assignment nhưng user đã bị soft-deleted → assignment vẫn còn

### Điều kiện tiên quyết
- user-1 soft-deleted, assignment vẫn còn

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_softdeleted_user_assignment.D7
```

### Kết quả mong đợi
**UI**:
- user-1 vẫn hiển thị trong list (dữ liệu cũ)

**API**:
- HTTP 200, item.user.username hiển thị (nếu user soft-delete không cascade)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EDGE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EDGE`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-159
severity: Medium
module: EDGE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Soft-delete của User không cascade assignment

---

## TC-160

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `EDGE`
- Yêu cầu: `REQ-PA-EDGE`
- Kỹ thuật: `Edge / Conditional render`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: EDGE — Section phân công không render trong petition CREATE mode

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở /petitions/new (tạo mới)

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- Section 'Phân công cán bộ' KHÔNG xuất hiện trong create form

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EDGE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EDGE`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-160
severity: Critical
module: EDGE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Section chỉ edit mode — petitionId không có trong create

---

## TC-161

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `EDGE`
- Yêu cầu: `REQ-PA-EDGE`
- Kỹ thuật: `Edge / Concurrency`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: EDGE — Add assignment khi petition đang có concurrent edit → optimistic lock không apply (assignments độc lập)

### Điều kiện tiên quyết
- Petition đang bị edit bởi user khác

### Các bước kiểm thử
- [ ] POST /petitions/:id/assignments đồng thời với PUT /petitions/:id

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- POST /assignments vẫn HTTP 201 (không check expectedUpdatedAt)

**Side effects** (DB, email, log, queue...):
- Cả 2 operations thành công độc lập

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EDGE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EDGE`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-161
severity: Low
module: EDGE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Assignment không cần expectedUpdatedAt

---

## TC-162

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `EDGE`
- Yêu cầu: `REQ-PA-EDGE`
- Kỹ thuật: `Edge / Idempotency`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EDGE — PATCH /assign với cùng team+cùng leader → idempotent, không tạo duplicate assignment

### Điều kiện tiên quyết
- Petition đã assign team-A với leaderA

### Các bước kiểm thử
- [ ] PATCH /assign lần 2 với cùng team-A, không gửi assignedToId

### Dữ liệu kiểm thử
```
petition.assigned_team.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, không tạo thêm PetitionAssignment record

**Side effects** (DB, email, log, queue...):
- petition_assignments không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `EDGE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `EDGE`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-162
severity: Medium
module: EDGE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PATCH /assign ≠ POST /assignments — không tạo record

---

## TC-163

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Headings`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — Section có heading h2 'Phân công cán bộ' (semantic HTML)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect DOM của section phân công

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Element h2 với text 'Phân công cán bộ' tồn tại, có thể đọc bởi screen reader

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-163
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 2.4.6: Headings — h2 cho section

---

## TC-164

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Form labels`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Select 'Cán bộ' có label liên kết đúng (for/id hoặc aria-labelledby)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect DOM: label[for] → select[id] hoặc aria-labelledby

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Screen reader đọc 'Cán bộ' khi focus vào select

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-164
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 1.3.1: Info and Relationships

---

## TC-165

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Form labels`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — Select 'Vai trò' có label liên kết đúng

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect DOM

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Label 'Vai trò' liên kết với select data-testid=assignment-role-select

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-165
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 1.3.1

---

## TC-166

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Button name`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Nút 'Thêm' có accessible name rõ ràng

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect button, check aria-label hoặc text content

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Screen reader đọc 'Thêm' (hoặc 'Thêm phân công'). Icon UserPlus có aria-hidden=true

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-166
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 4.1.2: Name, Role, Value

---

## TC-168

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Live regions`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Error message có role='alert' hoặc aria-live='assertive'

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Trigger error → inspect p[data-testid=assignment-error]

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Screen reader thông báo lỗi ngay khi xuất hiện

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-168
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 4.1.3: Status Messages — cần aria-live

---

## TC-169

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Focus order`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — Tab order hợp lý: select Cán bộ → select Vai trò → nút Thêm

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Tab từ select Cán bộ

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Tab đến select Vai trò → Tab đến nút Thêm (focus order đúng)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-169
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 2.4.3: Focus Order

---

## TC-170

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Keyboard`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Keyboard: Enter trên nút Thêm (khi enabled) → trigger add

### Điều kiện tiên quyết
- Đã chọn user

### Các bước kiểm thử
- [ ] Focus nút Thêm, nhấn Enter

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- POST /assignments được gọi, user xuất hiện trong list

**API**:
- POST 201

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-170
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 2.1.1: Keyboard

---

## TC-171

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / State changes`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — Loading state 'Đang thêm...' visible và accessible

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Click Thêm, observe button text trong khi loading

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Button text 'Đang thêm...' visible, không chỉ dùng spinner ẩn

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-171
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 4.1.3: Status

---

## TC-172

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Color contrast`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — Color contrast badge 'Chủ trì' đủ WCAG AA (4.5:1)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect badge LEAD: bg-blue-100 + text-blue-700 → tính contrast ratio

### Dữ liệu kiểm thử
```
petition.with_lead_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Contrast ratio ≥ 4.5:1 (text-blue-700 #1d4ed8 on bg-blue-100 #dbeafe)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-172
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 1.4.3: Contrast (Minimum)

---

## TC-173

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Semantic HTML`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: A11Y — List assignments có markup ul > li đúng (semantic list)

### Điều kiện tiên quyết
- Petition có 2 assignments

### Các bước kiểm thử
- [ ] Inspect DOM: data-testid=assignment-list

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Element ul[data-testid=assignment-list] chứa các li. Screen reader đọc '2 items'

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-173
severity: Low
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 1.3.1: Info and Relationships — semantic list

---

## TC-174

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Browser compatibility`
- Risk: `Thấp`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT — Chrome latest (131+): section render và interactions OK

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở edit page trên Chrome latest

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Section hiển thị đúng, add/remove hoạt động

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-174
severity: High
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Primary browser

---

## TC-175

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Browser compatibility`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT — Firefox latest (120+): dropdown select render đúng

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở trên Firefox, test dropdown

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Dropdown native select hiển thị options đúng

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-175
severity: Medium
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Firefox compat

---

## TC-176

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Browser compatibility`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT — Safari 17 (macOS): form elements không bị clip

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở trên Safari 17

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Select và button không bị clip, layout đúng

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-176
severity: Medium
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Safari CSS quirks

---

## TC-177

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Browser compatibility`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — Edge latest: badges render đúng màu

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở trên Edge latest

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Badge LEAD xanh, SUPPORT xám — màu đúng

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-177
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Edge Chromium — same as Chrome

---

## TC-178

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Mobile compatibility`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT — Mobile Chrome Android 12: dropdown select có thể chọn

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mở trên Android Chrome, tap dropdown

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Native mobile dropdown picker mở, có thể chọn option

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-178
severity: Medium
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Mobile touch — native select

---

## TC-179

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Mobile / Touch target`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: COMPAT — Mobile Safari iOS 16: touch target nút xóa ≥ 44px

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Inspect computed size của trash button trên iOS

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Button touch area ≥ 44×44px (iOS HIG)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-179
severity: Medium
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: iOS touch target minimum

---

## TC-180

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Responsive / Mobile first`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPAT — Viewport 375px (mobile): section không overflow ngang

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Set viewport 375px, kiểm tra layout

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Không có horizontal scrollbar, flex-wrap hoạt động, form stacks vertically

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-180
severity: High
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: flex-wrap + min-w-[200px]

---

## TC-181

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Responsive / Tablet`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — Viewport 768px (tablet): layout 2 cột hoặc stacked OK

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Set viewport 768px

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Form hàng đơn hoặc xuống hàng — không overflow

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-181
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Tablet viewport

---

## TC-182

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `Responsive / Large screen`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — Viewport 1920px: section không quá rộng, centered

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Set viewport 1920px

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Không bị kéo căng tới 1920px — max-width container giữ layout đẹp

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-182
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Wide screen layout

---

## TC-183

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `OS / Font rendering`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — Windows 11 + Chrome: font Vietnamese render đúng dấu

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Trên Windows 11 Chrome, hiển thị tên Vietnamese trong list

### Dữ liệu kiểm thử
```
petition.with_vietnamese_user.D7
```

### Kết quả mong đợi
**UI**:
- Tên 'Nguyễn Văn Đức' hiển thị đúng tất cả dấu

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-183
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Windows font rendering

---

## TC-184

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `OS / CSS hover`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — MacOS Safari: hover effects (hover:bg-red-50) hoạt động

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Hover vào trash button trên macOS Safari

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- Background đổi thành nhạt đỏ khi hover

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-184
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Safari hover CSS

---

## TC-189

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `PERFORMANCE`
- Yêu cầu: `REQ-PA-PERF`
- Kỹ thuật: `Performance / UI render`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PERF — UI load section với 20 assignments render < 1s

### Điều kiện tiên quyết
- 0 assignments

### Các bước kiểm thử
- [ ] Mở edit page, measure Time-to-Interactive

### Dữ liệu kiểm thử
```
petition.with_20_assignments.D30
```

### Kết quả mong đợi
**UI**:
- Section fully rendered < 1s sau API response

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PERFORMANCE`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PERFORMANCE`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-189
severity: Low
module: PERFORMANCE
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: React rendering 20 list items

---

## TC-195

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `UI / Conditional`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED — section không hiển thị trong create mode (/petitions/new)

### Điều kiện tiên quyết
- Navigate to /petitions/new

### Các bước kiểm thử
- [ ] Kiểm tra UI create form

### Dữ liệu kiểm thử
```
account.officer.primary
```

### Kết quả mong đợi
**UI**:
- Section 'Phân công cán bộ' KHÔNG tồn tại trong DOM

**API**:
- -

**Side effects** (DB, email, log, queue...):
- GET /petitions/undefined/assignments KHÔNG được gọi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-195
severity: Critical
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No petitionId in create mode

---

## TC-198

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `UI Phân công`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `State / Re-fetch`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — navigate away và back → GET /assignments gọi lại (không dùng stale cache)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Load trang → assignments loaded
- [ ] Navigate away
- [ ] Navigate back
- [ ] Kiểm tra GET có gọi lại không

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Danh sách fresh — không stale

**API**:
- GET /assignments gọi lại khi component mount

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI Phân công`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI Phân công`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-198
severity: Medium
module: UI Phân công
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: useEffect([petitionId]) → re-fetch on mount

---

## TC-199

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Defensive / Null response`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — GET response 200 với null body → UI handle, setAssignments([])

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mock GET → return {data: null}

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Empty state 'Chưa có cán bộ' (không crash)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- Array.isArray(null) = false → setAssignments([])

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-199
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Array.isArray(res.data) ? res.data : []

---

## TC-200

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Defensive / Type safety`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: RED — GET response 200 với non-array (object) → UI handle, setAssignments([])

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] Mock GET → return {data: {id:'x'}} (object, không phải array)

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Empty state, không crash

**API**:
- -

**Side effects** (DB, email, log, queue...):
- Array.isArray({}) = false → []

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-200
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Defensive check trong useEffect

---

## TC-202

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Negative / Extra data`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — DELETE với body JSON → body ignored, delete vẫn hoạt động

### Điều kiện tiên quyết
- user-1 assigned

### Các bước kiểm thử
- [ ] DELETE /assignments/user-1 với body {reason:'test'}

### Dữ liệu kiểm thử
```
petition.with_1_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- Row bị xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-202
severity: Low
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DELETE body irrelevant

---

## TC-206

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Unsupported params`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — GET với sort/filter query params → ignored (không support)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments?sort=role&filter=LEAD

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, trả về tất cả (params ignored)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-206
severity: Low
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No query param support

---

## TC-208

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Pagination`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — pagination: page/limit params → ignored, return all

### Điều kiện tiên quyết
- 0 assignments

### Các bước kiểm thử
- [ ] GET /assignments?page=1&limit=5

### Dữ liệu kiểm thử
```
petition.with_50_assignments.D30
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, 50 items (không phân trang)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-208
severity: Low
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findMany không có take/skip

---

## TC-212

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-REG`
- Kỹ thuật: `Regression / Independence`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED — GET /assignments sau khi PATCH /assign thay đổi team → assignments vẫn giữ nguyên

### Điều kiện tiên quyết
- Petition có 2 assignments + assignedTeamId=team-A

### Các bước kiểm thử
- [ ] PATCH /assign {team-B}
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- assignments vẫn còn

**API**:
- GET → 2 items (PATCH /assign không xóa assignments)

**Side effects** (DB, email, log, queue...):
- petition_assignments không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-212
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PATCH /assign độc lập với petition_assignments

---

## TC-215

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Negative / Unique constraint`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED — POST cùng userId nhưng khác role → vẫn 409 (unique per userId, không phải role)

### Điều kiện tiên quyết
- user-1 đã assigned với role LEAD

### Các bước kiểm thử
- [ ] POST {userId:'user-1', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.with_lead_assignment.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 409 (@@unique([petitionId, userId]) — không quan tâm role)

**Side effects** (DB, email, log, queue...):
- Không tạo row mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-215
severity: Critical
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Role không phân biệt trong unique constraint

---

## TC-216

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Performance / Network delay`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — GET /assignments khi network slow (2s) → loading state ổn định

### Điều kiện tiên quyết
- Simulate slow network 2s delay

### Các bước kiểm thử
- [ ] Open edit page với throttled network

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- Section render nhưng list empty → sau 2s → list update (không crash)

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-216
severity: Low
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: useEffect async — no loading state for GET (design choice)

---

## TC-218

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-DATA`
- Kỹ thuật: `Data / Whitespace`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — POST với userId có leading/trailing spaces → exact match hoặc trimmed

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:' user-1 ', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 với trimmed userId hoặc HTTP 404 (exact match failed)

**Side effects** (DB, email, log, queue...):
- Tùy BE trim behavior

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-218
severity: Low
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Whitespace handling

---

## TC-220

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `DELETE /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `State / Restore`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — DELETE sau khi petition được restore (undelete) → assignment có thể xóa bình thường

### Điều kiện tiên quyết
- Petition restore từ soft-delete

### Các bước kiểm thử
- [ ] DELETE /assignments/user-1 sau khi petition restored

### Dữ liệu kiểm thử
```
petition.restored.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200

**Side effects** (DB, email, log, queue...):
- Row xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `DELETE /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `DELETE /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-220
severity: Medium
module: DELETE /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Restore flow

---

## TC-224

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `PATCH /assign`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Boundary / Timestamp`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: RED — PATCH /assign với expectedUpdatedAt = 9999-12-31 (far future) → conflict nếu petition.updatedAt < 9999

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] PATCH /assign với expectedUpdatedAt='9999-12-31T00:00:00Z'

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 409 (petition.updatedAt < 9999-12-31)

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `PATCH /assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `PATCH /assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-224
severity: Low
module: PATCH /assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Optimistic lock future timestamp

---

## TC-225

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-VALID`
- Kỹ thuật: `Data / Case sensitivity`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST /assignments role='lead' (lowercase) → lưu như 'lead' hoặc 400

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:'lead'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- Nếu 201: badge hiển thị gì? Nếu 400: error

**API**:
- HTTP 201 (stored as 'lead') hoặc HTTP 400

**Side effects** (DB, email, log, queue...):
- DB: role='lead' nếu không validate

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-225
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: String type không enforce uppercase

---

## TC-227

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BIZ`
- Kỹ thuật: `Integration / System boundary`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: RED — GET sau PATCH /assign với new leader → GET không tự include leader (2 systems riêng)

### Điều kiện tiên quyết
- Petition vừa được PATCH /assign với leaderA

### Các bước kiểm thử
- [ ] GET /petitions/:id/assignments ngay sau PATCH

### Dữ liệu kiểm thử
```
petition.unassigned.D0, team.with_leader
```

### Kết quả mong đợi
**UI**:
- GET /assignments trả về [] (auto-assign là petition field, không phải PetitionAssignment record)

**API**:
- HTTP 200, data=[] hoặc data chỉ có manual assignments

**Side effects** (DB, email, log, queue...):
- Hai hệ thống độc lập

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-227
severity: Critical
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: petition.assignedToId ≠ PetitionAssignment — phân biệt rõ

---

## TC-228

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-UX`
- Kỹ thuật: `Recovery / Network drop`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: RED — POST thành công nhưng server mất response (network drop sau 201) → UI state

### Điều kiện tiên quyết
- Network drop sau POST thành công

### Các bước kiểm thử
- [ ] POST → server 201 → network drop trước khi client nhận response

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- UI có thể hiện error (timeout) nhưng DB đã có row. User cần refresh để thấy

**API**:
- POST ghi vào DB nhưng response không đến client

**Side effects** (DB, email, log, queue...):
- Potential phantom row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-228
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: At-least-once delivery issue

---

## TC-230

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Collection max`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — 100 assignments → GET return all 100 (không có default pagination)

### Điều kiện tiên quyết
- 00 assignments

### Các bước kiểm thử
- [ ] GET /assignments

### Dữ liệu kiểm thử
```
petition.with_100_assignments.D90
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, data.length=100

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-230
severity: Medium
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: No pagination limit — verify

---

## TC-232

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / max+1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — role = 'SUPPORT' + thêm 1 ký tự = 'SUPPORTS' → 400 hoặc 201 (no enum validation)

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'u1', role:'SUPPORTS'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 201 với role='SUPPORTS' (BE String type, no enum) hoặc HTTP 400 nếu có validation

**Side effects** (DB, email, log, queue...):
- Nếu stored: badge hiển thị gì?

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-232
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: BE không validate enum — String type

---

## TC-233

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `POST /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Min-1 length`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: BOUNDARY — userId rất ngắn 1 char 'x' → FK fail, không tìm thấy user

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] POST {userId:'x', role:'SUPPORT'}

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 404 hoặc 400 — FK violated

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `POST /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `POST /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-233
severity: Medium
module: POST /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: min-1 userId length

---

## TC-234

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `GET /assignments`
- Yêu cầu: `REQ-PA-BOUNDARY`
- Kỹ thuật: `BVA / Empty state API`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY — 0 items → response là [] (array), không phải null hay undefined

### Điều kiện tiên quyết
- Petition không có assignment

### Các bước kiểm thử
- [ ] GET /assignments → inspect raw JSON response

### Dữ liệu kiểm thử
```
petition.new.D0
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200, response body = [] (không phải null hay {})

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `GET /assignments`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `GET /assignments`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-234
severity: High
module: GET /assignments
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: findMany luôn return [] không phải null

---

## TC-238

**Meta**:
- Loại: `SECURITY`
- Priority: `P2` 🟡
- Module: `SECURITY`
- Yêu cầu: `REQ-PA-SEC`
- Kỹ thuật: `OWASP A07 / Host injection`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: SECURITY — Host header injection: Host: evil.com → không redirect hay expose data

### Điều kiện tiên quyết
- -

### Các bước kiểm thử
- [ ] GET /assignments với Host: evil.com

### Dữ liệu kiểm thử
```
petition.any.D7
```

### Kết quả mong đợi
**UI**:
- -

**API**:
- HTTP 200 hoặc 400 — không redirect tới evil.com

**Side effects** (DB, email, log, queue...):
- Không có Host header reflection trong response

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `SECURITY`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `SECURITY`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-238
severity: Medium
module: SECURITY
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: NestJS không process Host header

---

## TC-239

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UI A11Y`
- Yêu cầu: `REQ-PA-A11Y`
- Kỹ thuật: `WCAG 2.1 / Color not only`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: A11Y — Role badges phân biệt bằng text (không chỉ màu sắc)

### Điều kiện tiên quyết
- Petition có LEAD và SUPPORT assignment

### Các bước kiểm thử
- [ ] Kiểm tra text trong badges

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Badge LEAD: text 'Chủ trì'. Badge SUPPORT: text 'Hỗ trợ'. Không chỉ dùng màu để phân biệt

**API**:
- -

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UI A11Y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UI A11Y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-239
severity: Medium
module: UI A11Y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 1.4.1: Use of Color — không được chỉ dùng màu

---

## TC-240

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `COMPAT`
- Yêu cầu: `REQ-PA-COMPAT`
- Kỹ thuật: `PWA / Standalone mode`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: COMPAT — PWA mode (standalone): section và interactions hoạt động như browser

### Điều kiện tiên quyết
- Cài PC02 PWA, mở từ home screen

### Các bước kiểm thử
- [ ] Mở PetitionFormPage edit trong PWA mode

### Dữ liệu kiểm thử
```
petition.with_2_assignments.D7
```

### Kết quả mong đợi
**UI**:
- Section hiển thị đúng, add/remove hoạt động

**API**:
- API calls qua PWA service worker

**Side effects** (DB, email, log, queue...):
- -

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `COMPAT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `COMPAT`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-240
severity: Low
module: COMPAT
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PWA standalone = Chrome trong fullscreen — behavior same

---

## 🐛 Bug Reports (Claude Code điền khi fix bug)

> Mỗi bug được phát hiện sẽ thêm 1 block ở đây. Reference TC bằng ID.

> Template (copy + fill):


````markdown
### BUG-XXX

- **TC**: TC-XXX
- **Severity**: Critical | High | Medium | Low
- **Status**: Open | Fixing | Fixed | Verified | Closed | Reopened
- **Phát hiện**: DD/MM/YYYY
- **Module**: module name

**Reproduce**:
1. step 1
2. step 2

**Expected**: ...
**Actual**: ...

**Root cause**:
> Phân tích nguyên nhân gốc bởi Claude Code

**Fix**:
- [ ] File: `path/to/file.ts` line X-Y — thay đổi: ...
- [ ] Add test case mới nếu cần
- [ ] Update doc nếu cần

**Verify**: chạy lại TC-XXX → đặt Status = Verified
````

## ✅ Execution Checklist

> Claude Code tick khi hoàn thành từng TC. Mỗi line là 1 trạng thái có thể chuyển đổi.

- [ ] **TC-001** [P0] GET /assignments trả về danh sách 2 phân công đúng format
- [ ] **TC-002** [P0] GET /assignments trả về [] khi chưa có phân công
- [ ] **TC-003** [P0] GET /assignments — response có đủ fields user.username, assignedBy
- [ ] **TC-004** [P0] GET /assignments — response sắp xếp theo assignedAt tăng dần
- [ ] **TC-005** [P0] POST /assignments — thêm phân công với role SUPPORT → 201
- [ ] **TC-006** [P0] POST /assignments — thêm phân công với role LEAD → 201
- [ ] **TC-007** [P0] POST /assignments — không gửi role → default SUPPORT
- [ ] **TC-008** [P0] DELETE /assignments/:userId — xóa thành công → 200 + {success:true}
- [ ] **TC-009** [P0] PATCH /assign — auto-gán trưởng đội khi không gửi assignedToId
- [ ] **TC-013** [P0] UI — danh sách 2 assignments hiển thị đúng sau load
- [ ] **TC-014** [P0] UI — nút Thêm disabled khi chưa chọn cán bộ
- [ ] **TC-015** [P0] UI — chọn cán bộ → nút Thêm enabled → click → assignment xuất hiện
- [ ] **TC-017** [P0] UI — click xóa → assignment biến mất, user về dropdown
- [ ] **TC-018** [P0] UI — user đã assigned không hiển thị trong dropdown Cán bộ
- [ ] **TC-019** [P0] GET /assignments — không có JWT → 401
- [ ] **TC-020** [P0] POST /assignments — không có JWT → 401
- [ ] **TC-021** [P0] DELETE /assignments — không có JWT → 401
- [ ] **TC-022** [P0] PATCH /assign — không có JWT → 401
- [ ] **TC-023** [P0] POST /assignments — user chỉ có quyền read Petition (không có edit) → 403
- [ ] **TC-024** [P0] DELETE /assignments — user chỉ có quyền read → 403
- [ ] **TC-025** [P0] PATCH /assign — user không có DispatchGuard role → 403
- [ ] **TC-026** [P0] GET /assignments — petitionId không tồn tại → 404
- [ ] **TC-027** [P0] POST /assignments — petitionId không tồn tại → 404
- [ ] **TC-028** [P0] DELETE /assignments — petitionId không tồn tại → 404
- [ ] **TC-029** [P0] DELETE /assignments — userId không có assignment → 404
- [ ] **TC-030** [P0] POST /assignments — JWT hết hạn → 401
- [ ] **TC-031** [P0] POST /assignments — thêm user đã assigned → 409 ConflictException
- [ ] **TC-032** [P0] POST /assignments — P2002 race condition (2 request đồng thời cùng userId) → 409
- [ ] **TC-033** [P0] POST /assignments — petition bị soft-delete (deletedAt ≠ null) → 404
- [ ] **TC-034** [P0] DELETE /assignments — petition đã soft-delete → 404
- [ ] **TC-035** [P0] PATCH /assign — teamId không tồn tại trong DB → 400
- [ ] **TC-036** [P0] PATCH /assign — team tồn tại nhưng isActive=false → 400
- [ ] **TC-037** [P0] PATCH /assign — assignedToId không thuộc assignedTeamId → 400
- [ ] **TC-038** [P0] PATCH /assign — expectedUpdatedAt không khớp → 409 (optimistic lock)
- [ ] **TC-040** [P0] POST /assignments — thiếu userId (body rỗng) → 400
- [ ] **TC-041** [P0] POST /assignments — userId = null → 400
- [ ] **TC-052** [P0] PATCH /assign — team không có isLeader=true → fail-open, assignedToId = null
- [ ] **TC-058** [P0] UI — nút Thêm disabled khi đang loading (isAdding=true)
- [ ] **TC-091** [P0] EP — role partition LEAD → PASS
- [ ] **TC-092** [P0] EP — role partition SUPPORT → PASS
- [ ] **TC-095** [P0] EP — petition partition: TIEP_NHAN → có thể GET assignments
- [ ] **TC-096** [P0] EP — petition partition: DA_CHUYEN_VU_VIEC → có thể GET assignments
- [ ] **TC-097** [P0] EP — user partition: user trong cùng team với petition → PASS
- [ ] **TC-099** [P0] EP — team partition: team active với leader → auto-assign
- [ ] **TC-100** [P0] EP — team partition: team active, không leader → fail-open
- [ ] **TC-101** [P0] EP — team partition: team inactive → 400
- [ ] **TC-107** [P0] STATE — petition không có assignment (s0) → POST → có 1 assignment (s1)
- [ ] **TC-108** [P0] STATE — có 1 assignment (s1) → POST user mới → 2 assignments (s2)
- [ ] **TC-109** [P0] STATE — có 2 assignments (s2) → DELETE 1 → 1 assignment còn (s1)
- [ ] **TC-110** [P0] STATE — có 1 assignment (s1) → DELETE → không còn assignment (s0)
- [ ] **TC-112** [P0] STATE — PATCH /assign team-A (no leader) → PATCH /assign team-B (has leader) → assignedToId = leaderB
- [ ] **TC-117** [P0] DECISION — assignedToId provided + trong team → gán cụ thể người đó
- [ ] **TC-118** [P0] DECISION — assignedToId provided + KHÔNG trong team → 400 (xử lý lỗi trước khi auto)
- [ ] **TC-119** [P0] DECISION — assignedToId null + team có leader → auto-gán leader
- [ ] **TC-120** [P0] DECISION — assignedToId null + team không có leader → fail-open (null)
- [ ] **TC-123** [P0] SECURITY — GET không auth → 401
- [ ] **TC-124** [P0] SECURITY — POST không auth → 401
- [ ] **TC-125** [P0] SECURITY — DELETE không auth → 401
- [ ] **TC-126** [P0] SECURITY — PATCH /assign không auth → 401
- [ ] **TC-127** [P0] SECURITY — JWT tampered (signature invalid) → 401
- [ ] **TC-128** [P0] SECURITY — JWT với algorithm 'none' → 401
- [ ] **TC-129** [P0] SECURITY — POST với viewer role (không có edit Petition) → 403
- [ ] **TC-130** [P0] SECURITY — PATCH /assign với non-dispatcher role → 403
- [ ] **TC-131** [P0] SECURITY — Mass assignment: POST body với assignedById → ignored (actorId từ JWT)
- [ ] **TC-132** [P0] SECURITY — Response không có sensitive fields (password hash, salt, twoFaSecret)
- [ ] **TC-133** [P0] SECURITY — SQL injection trong userId path → không execute
- [ ] **TC-150** [P0] INTEGRATION — Tạo petition → PATCH assign → GET assignments → DELETE → GET rỗng
- [ ] **TC-151** [P0] INTEGRATION — PetitionFormPage edit: thêm assignment qua UI → reload page → vẫn còn
- [ ] **TC-010** [P1] PATCH /assign — gán với assignedToId hợp lệ trong team
- [ ] **TC-011** [P1] POST /assignments — response bao gồm user relation đầy đủ
- [ ] **TC-012** [P1] UI — section header và form load khi mở PetitionFormPage edit mode
- [ ] **TC-016** [P1] UI — chọn role LEAD → badge 'Chủ trì' màu xanh
- [ ] **TC-039** [P1] POST /assignments — role là giá trị không hợp lệ 'MANAGER' → 400
- [ ] **TC-042** [P1] POST /assignments — userId là string không phải ID format → DB FK error
- [ ] **TC-043** [P1] POST /assignments — petitionId không phải CUID format → 404
- [ ] **TC-044** [P1] DELETE /assignments — userId trong URL không phải format ID → 404
- [ ] **TC-045** [P1] PATCH /assign — assignedTeamId = null → xóa team assignment
- [ ] **TC-046** [P1] POST /assignments — request body là malformed JSON → 400
- [ ] **TC-047** [P1] POST /assignments — extra fields trong body bị ignore (mass assignment safe)
- [ ] **TC-048** [P1] DELETE /assignments — petition có nhiều assignments, chỉ xóa đúng 1 user
- [ ] **TC-049** [P1] GET /assignments — petition bị soft-delete → 404
- [ ] **TC-050** [P1] POST /assignments — petition ở mọi status vẫn có thể thêm (không block theo status)
- [ ] **TC-051** [P1] PATCH /assign — team có 2 isLeader=true, không gửi assignedToId → gán leader đầu tiên
- [ ] **TC-053** [P1] POST /assignments — userId chứa SQL injection string → sanitized, không execute
- [ ] **TC-054** [P1] POST /assignments — request timeout → UI loading state reset
- [ ] **TC-055** [P1] UI — POST /assignments fail → hiện error message, không crash
- [ ] **TC-056** [P1] UI — DELETE fail → hiện error message
- [ ] **TC-057** [P1] UI — GET /assignments fail khi load → empty state (không crash)
- [ ] **TC-059** [P1] UI — dropdown trống khi tất cả users đã được assigned
- [ ] **TC-060** [P1] UI — unmount khi đang fetch → không memory leak (AbortController)
- [ ] **TC-061** [P1] POST /assignments — concurrent 5 users khác nhau → tất cả 5 row được tạo
- [ ] **TC-062** [P1] GET /assignments — response không leak password hay sensitive user data
- [ ] **TC-063** [P1] POST /assignments — XSS payload trong userId → không execute script
- [ ] **TC-065** [P1] UI — thêm liên tiếp 3 assignments → list update từng cái chính xác
- [ ] **TC-067** [P1] PATCH /assign — gán cùng team lần 2 → idempotent, HTTP 200, không lỗi
- [ ] **TC-070** [P1] POST /assignments — concurrent delete + add cùng user → consistent state
- [ ] **TC-072** [P1] UI — network disconnected → error message hiển thị
- [ ] **TC-073** [P1] UI — backend trả về 500 trên GET load → không crash, hiện empty state
- [ ] **TC-076** [P1] POST /assignments — rate limiting: 100 request liên tiếp — server không crash
- [ ] **TC-079** [P1] BOUNDARY — role='LEAD' (giá trị đúng, chuỗi 4 ký tự) → PASS
- [ ] **TC-080** [P1] BOUNDARY — role='SUPPORT' (giá trị đúng, 7 ký tự) → PASS
- [ ] **TC-082** [P1] BOUNDARY — 0 assignments → HTTP 200 + []
- [ ] **TC-083** [P1] BOUNDARY — 1 assignment → HTTP 200 + [item]
- [ ] **TC-085** [P1] BOUNDARY — userId = CUID hợp lệ (26 chars) → PASS
- [ ] **TC-093** [P1] EP — role partition undefined/omitted → default SUPPORT
- [ ] **TC-094** [P1] EP — role partition invalid → reject
- [ ] **TC-098** [P1] EP — user partition: user KHÔNG trong team của petition → vẫn PASS (no validation)
- [ ] **TC-102** [P1] EP — assignedToId partition: userId trong đúng team → PASS
- [ ] **TC-103** [P1] EP — assignedToId partition: userId KHÔNG trong team → 400
- [ ] **TC-104** [P1] EP — petition partition: 0 assignments → có thể thêm
- [ ] **TC-105** [P1] EP — petition partition: có N assignments rồi → vẫn có thể thêm user mới
- [ ] **TC-106** [P1] EP — same user, 2 petition khác nhau → 2 assignment riêng (không conflict)
- [ ] **TC-111** [P1] STATE — có assignment LEAD → xóa LEAD → còn SUPPORT → thêm LEAD mới
- [ ] **TC-113** [P1] STATE — Xóa petition → cascade DELETE assignments
- [ ] **TC-114** [P1] STATE — Xóa user → cascade DELETE assignment của user đó
- [ ] **TC-115** [P1] STATE — PATCH /assign khi petition chưa có team → set team và auto-assign leader
- [ ] **TC-121** [P1] DECISION — assignedTeamId null, assignedToId null → clear toàn bộ
- [ ] **TC-122** [P1] DECISION — team thay đổi, assignedToId từ team cũ → 400 (không thuộc team mới)
- [ ] **TC-134** [P1] SECURITY — Path traversal trong petitionId → not found
- [ ] **TC-135** [P1] SECURITY — Null byte injection trong userId → rejected
- [ ] **TC-136** [P1] SECURITY — IDOR: user-A xóa assignment của petition không thuộc team-A → check permission
- [ ] **TC-137** [P1] SECURITY — CSRF: request từ external domain không có JWT → 401
- [ ] **TC-143** [P1] SECURITY — Content-Type mismatch: POST với text/plain body → 400 hoặc 415
- [ ] **TC-145** [P1] DATA — displayName fallback: không có firstName/lastName → hiển thị username
- [ ] **TC-146** [P1] DATA — assignedAt timestamp format UTC ISO8601
- [ ] **TC-147** [P1] DATA — Vietnamese special chars trong user name → display đúng
- [ ] **TC-152** [P1] INTEGRATION — PATCH assign với team có leader → PetitionAssignment section hiện leader
- [ ] **TC-153** [P1] INTEGRATION — Submit PetitionFormPage không gửi assignment data trong request body
- [ ] **TC-154** [P1] REGRESSION — Thêm assignment không ảnh hưởng đến petition list page
- [ ] **TC-155** [P1] REGRESSION — Thêm assignment không thay đổi petition.updatedAt
- [ ] **TC-156** [P1] REGRESSION — Xóa assignment không thay đổi petition.status
- [ ] **TC-157** [P1] REGRESSION — PATCH /assign (phân công đội) không xóa petition_assignments đã có
- [ ] **TC-167** [P1] A11Y — Nút xóa có title='Xóa phân công' để screen reader đọc
- [ ] **TC-185** [P1] PERF — GET /assignments với 1 item < 100ms
- [ ] **TC-186** [P1] PERF — GET /assignments với 50 items < 500ms
- [ ] **TC-187** [P1] PERF — POST /assignments < 200ms
- [ ] **TC-188** [P1] PERF — DELETE /assignments < 200ms
- [ ] **TC-190** [P1] PERF — Concurrent 10 GET /assignments cùng 1 petition → tất cả 200
- [ ] **TC-191** [P1] PERF — Concurrent 5 POST /assignments với userId khác nhau → tất cả 201
- [ ] **TC-192** [P1] PERF — PATCH /assign với DB query tìm leader < 300ms
- [ ] **TC-193** [P1] RED — double-click nút Thêm → chỉ gọi POST API 1 lần (không double-submit)
- [ ] **TC-194** [P1] RED — POST trả về 409 (duplicate) → UI hiện error message rõ ràng
- [ ] **TC-196** [P1] RED — xóa assignment không có confirmation dialog → immediate delete
- [ ] **TC-197** [P1] RED — sau add thành công, form reset: userId='' và role='SUPPORT' (default)
- [ ] **TC-201** [P1] RED — POST với null body → 400
- [ ] **TC-203** [P1] RED — PATCH /assign thiếu expectedUpdatedAt → 400 hoặc conflict
- [ ] **TC-204** [P1] RED — POST với Content-Type không phải application/json → 400 hoặc 415
- [ ] **TC-205** [P1] RED — POST sau khi DELETE cùng user → 201 (unique constraint được free)
- [ ] **TC-207** [P1] RED — POST self-assign (actorId === userId) → cho phép
- [ ] **TC-209** [P1] RED — PATCH /assign với assignedToId không tồn tại trong DB → FK error
- [ ] **TC-210** [P1] RED — PATCH /assign body không có assignedTeamId → giữ nguyên team hiện tại
- [ ] **TC-211** [P1] RED — POST userId của user bị soft-delete → FK valid (user row exists)
- [ ] **TC-213** [P1] RED — GET sau DELETE → count giảm 1 chính xác
- [ ] **TC-214** [P1] RED — POST với assignedTeamId field trong body → ignored (không phải field hợp lệ của DTO)
- [ ] **TC-217** [P1] RED — PATCH /assign khi petition bị archive → ...
- [ ] **TC-219** [P1] RED — POST không có Authorization header nhưng có cookie → vẫn 401
- [ ] **TC-221** [P1] RED — GET /assignments trả về data sau khi có change từ tab khác (race)
- [ ] **TC-222** [P1] RED — POST với oversized payload (1MB body) → 413 Request Too Large
- [ ] **TC-223** [P1] RED — Multiple GET requests đồng thời từ cùng component → abort tất cả trừ last
- [ ] **TC-226** [P1] RED — Error message tự xóa sau lần thêm/xóa thành công tiếp theo
- [ ] **TC-229** [P1] BOUNDARY — role = null → default SUPPORT (controller: dto.role ?? 'SUPPORT')
- [ ] **TC-231** [P1] BOUNDARY — petitionId là CUID 26 chars (valid Prisma ID) → PASS
- [ ] **TC-235** [P1] EP — petition status partition: KIEM_TRA → GET /assignments OK
- [ ] **TC-236** [P1] EP — user partition: admin (không cần thuộc team) → POST /assignments OK
- [ ] **TC-237** [P1] SECURITY — Authorization: Bearer token với extra spaces → 401
- [ ] **TC-064** [P2] UI — add assignment thành công → dropdown reset về placeholder
- [ ] **TC-066** [P2] UI — sau khi xóa assignment, user xuất hiện lại trong dropdown
- [ ] **TC-068** [P2] POST /assignments — Unicode name trong user → hiển thị đúng
- [ ] **TC-069** [P2] GET /assignments — assignedBy field là optional, không crash nếu null
- [ ] **TC-071** [P2] DELETE /assignments — DELETE duplicate (2 lần cùng userId) → 2nd request 404
- [ ] **TC-074** [P2] PATCH /assign — CSRF attack từ external domain → bị chặn bởi JWT stateless
- [ ] **TC-075** [P2] GET /assignments — IDOR: user team-A xem assignment của petition team-B
- [ ] **TC-077** [P2] POST /assignments — HTTP method override header bị ignored
- [ ] **TC-078** [P2] POST /assignments — JWT với algorithm 'none' (alg:none attack) → 401
- [ ] **TC-081** [P2] BOUNDARY — role='' (empty string) → default về SUPPORT (controller fallback)
- [ ] **TC-084** [P2] BOUNDARY — 50 assignments → HTTP 200, tất cả 50 items (không có pagination limit)
- [ ] **TC-086** [P2] BOUNDARY — userId = 1 char → invalid ID, không tìm thấy user → FK error
- [ ] **TC-087** [P2] BOUNDARY — role='LEAd' (mixed case) → FAIL, rejected hoặc stored as-is
- [ ] **TC-088** [P2] BOUNDARY — xóa assignment cuối cùng → list trở về []
- [ ] **TC-089** [P2] BOUNDARY — petitionId là empty string trong URL → 404 hay 400
- [ ] **TC-090** [P2] BOUNDARY — petitionId rất dài (500 chars) → handle gracefully (404)
- [ ] **TC-116** [P2] STATE — Add 10 assignments tuần tự → list chính xác sau mỗi add
- [ ] **TC-138** [P2] SECURITY — XSS trong role field → không execute
- [ ] **TC-139** [P2] SECURITY — OWASP A09: Server không leak stack trace trong error response
- [ ] **TC-140** [P2] SECURITY — Log injection: userId có ký tự newline → sanitized trong logs
- [ ] **TC-141** [P2] SECURITY — Rate limiting: 50 POST liên tiếp từ 1 IP → không 500
- [ ] **TC-142** [P2] SECURITY — JWT từ deactivated user → 401 hoặc 403
- [ ] **TC-144** [P2] SECURITY — Replay attack: reuse expired JWT → 401
- [ ] **TC-148** [P2] DATA — assignedBy nullable (user được gán trực tiếp vào DB không qua API) → UI không crash
- [ ] **TC-149** [P2] DATA — GET response đủ 8 fields theo interface: id, petitionId, userId, user, role, assignedById, assignedBy?, assignedAt
- [ ] **TC-158** [P2] EDGE — GET /assignments sau khi petition bị hard-deleted → 404 hoặc []
- [ ] **TC-159** [P2] EDGE — Petition có assignment nhưng user đã bị soft-deleted → assignment vẫn còn
- [ ] **TC-160** [P2] EDGE — Section phân công không render trong petition CREATE mode
- [ ] **TC-161** [P2] EDGE — Add assignment khi petition đang có concurrent edit → optimistic lock không apply (assignments độc lập)
- [ ] **TC-162** [P2] EDGE — PATCH /assign với cùng team+cùng leader → idempotent, không tạo duplicate assignment
- [ ] **TC-163** [P2] A11Y — Section có heading h2 'Phân công cán bộ' (semantic HTML)
- [ ] **TC-164** [P2] A11Y — Select 'Cán bộ' có label liên kết đúng (for/id hoặc aria-labelledby)
- [ ] **TC-165** [P2] A11Y — Select 'Vai trò' có label liên kết đúng
- [ ] **TC-166** [P2] A11Y — Nút 'Thêm' có accessible name rõ ràng
- [ ] **TC-168** [P2] A11Y — Error message có role='alert' hoặc aria-live='assertive'
- [ ] **TC-169** [P2] A11Y — Tab order hợp lý: select Cán bộ → select Vai trò → nút Thêm
- [ ] **TC-170** [P2] A11Y — Keyboard: Enter trên nút Thêm (khi enabled) → trigger add
- [ ] **TC-171** [P2] A11Y — Loading state 'Đang thêm...' visible và accessible
- [ ] **TC-172** [P2] A11Y — Color contrast badge 'Chủ trì' đủ WCAG AA (4.5:1)
- [ ] **TC-173** [P2] A11Y — List assignments có markup ul > li đúng (semantic list)
- [ ] **TC-174** [P2] COMPAT — Chrome latest (131+): section render và interactions OK
- [ ] **TC-175** [P2] COMPAT — Firefox latest (120+): dropdown select render đúng
- [ ] **TC-176** [P2] COMPAT — Safari 17 (macOS): form elements không bị clip
- [ ] **TC-177** [P2] COMPAT — Edge latest: badges render đúng màu
- [ ] **TC-178** [P2] COMPAT — Mobile Chrome Android 12: dropdown select có thể chọn
- [ ] **TC-179** [P2] COMPAT — Mobile Safari iOS 16: touch target nút xóa ≥ 44px
- [ ] **TC-180** [P2] COMPAT — Viewport 375px (mobile): section không overflow ngang
- [ ] **TC-181** [P2] COMPAT — Viewport 768px (tablet): layout 2 cột hoặc stacked OK
- [ ] **TC-182** [P2] COMPAT — Viewport 1920px: section không quá rộng, centered
- [ ] **TC-183** [P2] COMPAT — Windows 11 + Chrome: font Vietnamese render đúng dấu
- [ ] **TC-184** [P2] COMPAT — MacOS Safari: hover effects (hover:bg-red-50) hoạt động
- [ ] **TC-189** [P2] PERF — UI load section với 20 assignments render < 1s
- [ ] **TC-195** [P2] RED — section không hiển thị trong create mode (/petitions/new)
- [ ] **TC-198** [P2] RED — navigate away và back → GET /assignments gọi lại (không dùng stale cache)
- [ ] **TC-199** [P2] RED — GET response 200 với null body → UI handle, setAssignments([])
- [ ] **TC-200** [P2] RED — GET response 200 với non-array (object) → UI handle, setAssignments([])
- [ ] **TC-202** [P2] RED — DELETE với body JSON → body ignored, delete vẫn hoạt động
- [ ] **TC-206** [P2] RED — GET với sort/filter query params → ignored (không support)
- [ ] **TC-208** [P2] RED — pagination: page/limit params → ignored, return all
- [ ] **TC-212** [P2] RED — GET /assignments sau khi PATCH /assign thay đổi team → assignments vẫn giữ nguyên
- [ ] **TC-215** [P2] RED — POST cùng userId nhưng khác role → vẫn 409 (unique per userId, không phải role)
- [ ] **TC-216** [P2] RED — GET /assignments khi network slow (2s) → loading state ổn định
- [ ] **TC-218** [P2] RED — POST với userId có leading/trailing spaces → exact match hoặc trimmed
- [ ] **TC-220** [P2] RED — DELETE sau khi petition được restore (undelete) → assignment có thể xóa bình thường
- [ ] **TC-224** [P2] RED — PATCH /assign với expectedUpdatedAt = 9999-12-31 (far future) → conflict nếu petition.updatedAt < 9999
- [ ] **TC-225** [P2] RED — POST /assignments role='lead' (lowercase) → lưu như 'lead' hoặc 400
- [ ] **TC-227** [P2] RED — GET sau PATCH /assign với new leader → GET không tự include leader (2 systems riêng)
- [ ] **TC-228** [P2] RED — POST thành công nhưng server mất response (network drop sau 201) → UI state
- [ ] **TC-230** [P2] BOUNDARY — 100 assignments → GET return all 100 (không có default pagination)
- [ ] **TC-232** [P2] BOUNDARY — role = 'SUPPORT' + thêm 1 ký tự = 'SUPPORTS' → 400 hoặc 201 (no enum validation)
- [ ] **TC-233** [P2] BOUNDARY — userId rất ngắn 1 char 'x' → FK fail, không tìm thấy user
- [ ] **TC-234** [P2] BOUNDARY — 0 items → response là [] (array), không phải null hay undefined
- [ ] **TC-238** [P2] SECURITY — Host header injection: Host: evil.com → không redirect hay expose data
- [ ] **TC-239** [P2] A11Y — Role badges phân biệt bằng text (không chỉ màu sắc)
- [ ] **TC-240** [P2] COMPAT — PWA mode (standalone): section và interactions hoạt động như browser

---

_Generated by `uat-test-writer` skill on 08/06/2026 03:44_