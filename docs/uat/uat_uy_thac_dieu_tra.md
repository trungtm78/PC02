# UAT Test Cases — Ủy thác Điều tra (UTDT)

**Generated**: 30/05/2026 22:03  
**Complexity**: `complex`  
**Total TC**: 124  
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

**Tổng số TC**: 124

**Phân bố loại**:
- `RED`: 50
- `GREEN`: 17
- `SECURITY`: 13
- `BOUNDARY`: 7
- `A11Y`: 7
- `COMPAT`: 7
- `STATE`: 5
- `DATA`: 4
- `PERFORMANCE`: 3
- `INTEGRATION`: 3
- `EP`: 3
- `EDGE`: 3
- `DECISION`: 2

**Phân bố priority**:
- 🔴 `P0`: 44
- 🟠 `P1`: 72
- 🟡 `P2`: 8

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 35
- ⚠️ `High`: 48
- ⚡ `Medium`: 29
- 📌 `Low`: 12

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `A-01` | `dtv.utdt.a@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team A | ACTIVE | DataScope |
| `A-02` | `dtv.utdt.b@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team B | ACTIVE | IDOR |
| `A-03` | `dispatcher.utdt@pc02hcm.com` | `Pa$$w0rd!` | Dispatcher | ACTIVE | Reassign |
| `A-04` | `admin@pc02.local` | `Admin@2026` | ADMIN | ACTIVE | Restore |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| donViGiao | `1` | `min` | **OK** |  |
| donViGiao | `500` | `max` | **OK** |  |
| donViGiao | `501` | `max+1` | **400** |  |
| soQuyetDinhUyThac | `100` | `max` | **OK** |  |
| soQuyetDinhUyThac | `101` | `max+1` | **400** |  |
| loaiThongTin | `200` | `max` | **OK** |  |
| loaiThongTin | `201` | `max+1` | **400** |  |
| thoiHanUyThac | `now` | `boundary` | **CHUA_PHAN_HOI hoặc QUA_HAN** |  |
| thoiHanUyThac | `now-1s` | `boundary-1` | **QUA_HAN** |  |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
|  | `' OR 1=1 --` |  | 200 | `` |
|  | `<script>alert(1)</script>` |  | Escape | `` |
|  | `<img src=x onerror=alert(1)>` |  | Escape | `` |
|  | `donViGiao; DROP` |  | 400 | `` |
|  | `UT-OVERRIDE` |  | Server ignore | `` |
|  | `http://evil.com` |  | Block | `` |
|  | `' UNION SELECT *` |  | 200 | `` |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | UTDT.Create | Tạo case UTDT hợp lệ với donViGiao + soQuyetDinhUyThac | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | UTDT.Create | Tạo UTDT với loaiUyThac=CHUYEN_DON_NGUON_TIN | ⚠️ High |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | UTDT.Create | Tạo UTDT với loaiUyThac=UY_THAC_GIAI_QUYET | ⚠️ High |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | UTDT.Create | Tạo Delegation độc lập (workflow SCR-PF-04) | 🚨 Critical |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` | UTDT.Read | GET /cases?caseType=UY_THAC_DIEU_TRA listing | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | UTDT.Stats | GET /cases/utdt-stats 4 trạng thái phản hồi | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | UTDT.Update | Cập nhật kết quả UTDT (ketQuaUyThac + ngayTraKetQua) | 🚨 Critical |
| [TC-012](#tc-012) | 🔴 P0 | `GREEN` | UTDT.Update | Cập nhật metadata utdt_lyDoKhongThucHienDuoc | ⚠️ High |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` | UTDT.Route | Row click → /uy-thac-dieu-tra/:id/edit redirect /cases/:id/edit | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `RED` | UTDT.Create | Tạo UTDT thiếu donViGiao (v0.67.3.0 bắt buộc) | 🚨 Critical |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | UTDT.Create | caseProvenance=UY_THAC_DIEU_TRA nhưng caseType=REGULAR | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | UTDT.Create | loaiUyThac enum không hợp lệ | 🚨 Critical |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | UTDT.Create | donViGiao > 500 ký tự | ⚠️ High |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | UTDT.Create | soQuyetDinhUyThac > 100 ký tự | ⚠️ High |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | UTDT.Create | loaiThongTin > 200 ký tự | ⚡ Medium |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | UTDT.Create | thoiHanUyThac < ngayTiepNhan | ⚠️ High |
| [TC-025](#tc-025) | 🔴 P0 | `RED` | UTDT.Update | ngayTraKetQua < ngayTiepNhan | ⚠️ High |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | UTDT.Create | Delegation thiếu receivingUnit | 🚨 Critical |
| [TC-027](#tc-027) | 🔴 P0 | `RED` | UTDT.Create | Delegation thiếu content | 🚨 Critical |
| [TC-028](#tc-028) | 🔴 P0 | `RED` | UTDT.Create | Delegation status không thuộc enum (XYZ) | ⚠️ High |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | UTDT.Create | delegationNumber manual trùng | 🚨 Critical |
| [TC-030](#tc-030) | 🔴 P0 | `RED` | UTDT.Create | relatedCaseId không tồn tại | ⚠️ High |
| [TC-031](#tc-031) | 🔴 P0 | `RED` | UTDT.Read | User Team A xem UTDT Team B (IDOR) | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `RED` | UTDT.Delegation | GET /delegations/X khác scope | 🚨 Critical |
| [TC-033](#tc-033) | 🔴 P0 | `RED` | UTDT.Auth | GET không JWT | 🚨 Critical |
| [TC-034](#tc-034) | 🔴 P0 | `RED` | UTDT.Auth | User không có write:Case create UTDT | 🚨 Critical |
| [TC-035](#tc-035) | 🔴 P0 | `RED` | UTDT.Delete | Delegation xóa bởi non-creator non-admin | 🚨 Critical |
| [TC-036](#tc-036) | 🔴 P0 | `RED` | UTDT.Stats | GET utdt-stats không strip caseType filter | ⚠️ High |
| [TC-037](#tc-037) | 🔴 P0 | `RED` | UTDT.Stats | GET utdt-stats không strip trangThaiPhanHoi | ⚠️ High |
| [TC-066](#tc-066) | 🔴 P0 | `STATE` | UTDT.State | Delegation PENDING → RECEIVED | ⚠️ High |
| [TC-067](#tc-067) | 🔴 P0 | `STATE` | UTDT.State | Delegation RECEIVED → COMPLETED | ⚠️ High |
| [TC-068](#tc-068) | 🔴 P0 | `STATE` | UTDT.State | COMPLETED → bất kỳ (terminal) | ⚠️ High |
| [TC-069](#tc-069) | 🔴 P0 | `STATE` | UTDT.State | trangThaiPhanHoi computed precedence DA_PHAN_HOI > KHONG_THUC_HIEN_DUOC | 🚨 Critical |
| [TC-070](#tc-070) | 🔴 P0 | `STATE` | UTDT.State | trangThaiPhanHoi precedence QUA_HAN < KHONG_THUC_HIEN_DUOC | 🚨 Critical |
| [TC-071](#tc-071) | 🔴 P0 | `DECISION` | UTDT.Decision | Decision Table — trangThaiPhanHoi 16 combination (4 fields × 2 state) | 🚨 Critical |
| [TC-072](#tc-072) | 🔴 P0 | `DECISION` | UTDT.Decision | caseProvenance × caseType validation CHECK constraint | 🚨 Critical |
| [TC-073](#tc-073) | 🔴 P0 | `SECURITY` | UTDT.Security | SQL Injection trong donViGiao filter | 🚨 Critical |
| [TC-074](#tc-074) | 🔴 P0 | `SECURITY` | UTDT.Security | XSS donViGiao + ketQuaUyThac | 🚨 Critical |
| [TC-075](#tc-075) | 🔴 P0 | `SECURITY` | UTDT.Security | IDOR — GET delegation cross-user | 🚨 Critical |
| [TC-076](#tc-076) | 🔴 P0 | `SECURITY` | UTDT.Security | Mass assignment delegationNumber để override engine | ⚠️ High |
| [TC-077](#tc-077) | 🔴 P0 | `SECURITY` | UTDT.Security | CSRF POST cross-origin | 🚨 Critical |
| [TC-100](#tc-100) | 🔴 P0 | `PERFORMANCE` | UTDT.Perf | List 1000 UTDT < 2s | ⚠️ High |
| [TC-103](#tc-103) | 🔴 P0 | `INTEGRATION` | UTDT.Notify | create delegation emit utdt.assigned → SSE assignedTo | ⚠️ High |
| [TC-104](#tc-104) | 🔴 P0 | `INTEGRATION` | UTDT.Case | Case UTDT khi caseProvenance=UY_THAC_DIEU_TRA tự force caseType | 🚨 Critical |
| [TC-005](#tc-005) | 🟠 P1 | `GREEN` | UTDT.Create | Delegation với relatedCaseId | ⚠️ High |
| [TC-008](#tc-008) | 🟠 P1 | `GREEN` | UTDT.Read | Filter theo trangThaiPhanHoi=QUA_HAN | ⚠️ High |
| [TC-009](#tc-009) | 🟠 P1 | `GREEN` | UTDT.Read | Filter theo donViGiao | ⚡ Medium |
| [TC-010](#tc-010) | 🟠 P1 | `GREEN` | UTDT.Read | Filter date range ngayTiepNhan | ⚡ Medium |
| [TC-013](#tc-013) | 🟠 P1 | `GREEN` | UTDT.Form | CaseFormPage hiển thị tab 'Thông tin Ủy thác' tại vị trí 2 | ⚠️ High |
| [TC-015](#tc-015) | 🟠 P1 | `GREEN` | UTDT.Update | Update Delegation status PENDING → RECEIVED | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `GREEN` | UTDT.Update | Delegation RECEIVED → COMPLETED có completedDate | ⚠️ High |
| [TC-017](#tc-017) | 🟠 P1 | `GREEN` | UTDT.Delete | Soft-delete Delegation bởi creator | ⚠️ High |
| [TC-038](#tc-038) | 🟠 P1 | `RED` | UTDT.Read | Filter trangThaiPhanHoi không hợp lệ | ⚡ Medium |
| [TC-039](#tc-039) | 🟠 P1 | `RED` | UTDT.Read | investigatorName search SQL injection | 🚨 Critical |
| [TC-040](#tc-040) | 🟠 P1 | `RED` | UTDT.Update | Update kết quả UTDT trên case không phải UTDT | ⚡ Medium |
| [TC-041](#tc-041) | 🟠 P1 | `RED` | UTDT.Form | Tab 'Thông tin Ủy thác' hiển thị khi caseProvenance khác UY_THAC_DIEU_TRA | ⚠️ High |
| [TC-042](#tc-042) | 🟠 P1 | `RED` | UTDT.Form | Đổi caseProvenance khác → tab UTDT ẩn ngay | ⚠️ High |
| [TC-043](#tc-043) | 🟠 P1 | `RED` | UTDT.Update | Update OCC stale | 🚨 Critical |
| [TC-044](#tc-044) | 🟠 P1 | `RED` | UTDT.Read | limit > 100 | ⚡ Medium |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | UTDT.Read | Sort theo donViGiao injection | 🚨 Critical |
| [TC-046](#tc-046) | 🟠 P1 | `RED` | UTDT.Form | loaiUyThac=null nhưng vẫn submit | ⚡ Medium |
| [TC-047](#tc-047) | 🟠 P1 | `RED` | UTDT.Create | ngayTraKetQua tương lai (>now) | ⚡ Medium |
| [TC-048](#tc-048) | 🟠 P1 | `RED` | UTDT.Form | Hidden field utdt_lyDoKhongThucHienDuoc bypass | ⚡ Medium |
| [TC-049](#tc-049) | 🟠 P1 | `RED` | UTDT.Read | Stats với case caseType=REGULAR (không UTDT) — phải bỏ qua | ⚠️ High |
| [TC-050](#tc-050) | 🟠 P1 | `RED` | UTDT.Bulk | Bulk assign UTDT khác đơn vị | ⚠️ High |
| [TC-051](#tc-051) | 🟠 P1 | `RED` | UTDT.Update | Đổi caseType từ UY_THAC_DIEU_TRA → REGULAR | ⚠️ High |
| [TC-052](#tc-052) | 🟠 P1 | `RED` | UTDT.Delete | Xóa UTDT case có sub-entities | ⚠️ High |
| [TC-053](#tc-053) | 🟠 P1 | `RED` | UTDT.Delegation | Update completedDate < createdAt | 📌 Low |
| [TC-054](#tc-054) | 🟠 P1 | `RED` | UTDT.Delegation | Delete với non-creator non-admin | 🚨 Critical |
| [TC-055](#tc-055) | 🟠 P1 | `RED` | UTDT.Create | Tạo case UTDT với linkedPetitionId (mâu thuẫn provenance) | ⚠️ High |
| [TC-056](#tc-056) | 🟠 P1 | `BOUNDARY` | UTDT.Create | donViGiao = 500 (max) | ⚡ Medium |
| [TC-057](#tc-057) | 🟠 P1 | `BOUNDARY` | UTDT.Create | donViGiao = 1 ký tự (min) | 📌 Low |
| [TC-058](#tc-058) | 🟠 P1 | `BOUNDARY` | UTDT.Create | soQuyetDinhUyThac = 100 (max) | 📌 Low |
| [TC-059](#tc-059) | 🟠 P1 | `BOUNDARY` | UTDT.Create | loaiThongTin = 200 (max) | 📌 Low |
| [TC-060](#tc-060) | 🟠 P1 | `BOUNDARY` | UTDT.Stats | thoiHanUyThac = now (boundary QUA_HAN) | ⚠️ High |
| [TC-061](#tc-061) | 🟠 P1 | `BOUNDARY` | UTDT.Stats | thoiHanUyThac = now-1s (QUA_HAN) | ⚠️ High |
| [TC-062](#tc-062) | 🟠 P1 | `BOUNDARY` | UTDT.Read | limit=100 | 📌 Low |
| [TC-063](#tc-063) | 🟠 P1 | `EP` | UTDT.Create | loaiUyThac 3 enum partition | ⚡ Medium |
| [TC-064](#tc-064) | 🟠 P1 | `EP` | UTDT.Stats | trangThaiPhanHoi 4 enum + default | ⚠️ High |
| [TC-065](#tc-065) | 🟠 P1 | `EP` | UTDT.Delegation | DelegationStatus 3 partition | ⚡ Medium |
| [TC-078](#tc-078) | 🟠 P1 | `SECURITY` | UTDT.Security | Privilege escalation — non-dispatcher reassign delegation | ⚠️ High |
| [TC-079](#tc-079) | 🟠 P1 | `SECURITY` | UTDT.Security | Rate limit list UTDT | ⚠️ High |
| [TC-080](#tc-080) | 🟠 P1 | `SECURITY` | UTDT.Security | Token replay sau khi user.dataScope thay đổi | 🚨 Critical |
| [TC-081](#tc-081) | 🟠 P1 | `SECURITY` | UTDT.Security | Audit log delegation lưu actor + diff | ⚠️ High |
| [TC-082](#tc-082) | 🟠 P1 | `DATA` | UTDT.Data | donViGiao tiếng Việt có dấu | ⚡ Medium |
| [TC-083](#tc-083) | 🟠 P1 | `DATA` | UTDT.Data | Trim donViGiao leading/trailing | 📌 Low |
| [TC-084](#tc-084) | 🟠 P1 | `DATA` | UTDT.Data | ngayTiepNhan ISO UTC+7 | ⚡ Medium |
| [TC-086](#tc-086) | 🟠 P1 | `EDGE` | UTDT.Edge | Concurrent update kết quả + lý do không thực hiện | 🚨 Critical |
| [TC-087](#tc-087) | 🟠 P1 | `EDGE` | UTDT.Edge | thoiHanUyThac vượt 365 ngày | ⚡ Medium |
| [TC-089](#tc-089) | 🟠 P1 | `A11Y` | UTDT.UI | Tab UTDT navigation bằng arrow keys | ⚠️ High |
| [TC-090](#tc-090) | 🟠 P1 | `A11Y` | UTDT.UI | donViGiao field label htmlFor | ⚠️ High |
| [TC-091](#tc-091) | 🟠 P1 | `A11Y` | UTDT.UI | Contrast 4 trangThaiPhanHoi badge | ⚡ Medium |
| [TC-094](#tc-094) | 🟠 P1 | `COMPAT` | UTDT.UI | Chrome 130 Win | ⚠️ High |
| [TC-095](#tc-095) | 🟠 P1 | `COMPAT` | UTDT.UI | Firefox 130 | ⚡ Medium |
| [TC-096](#tc-096) | 🟠 P1 | `COMPAT` | UTDT.UI | Edge 130 | ⚡ Medium |
| [TC-097](#tc-097) | 🟠 P1 | `COMPAT` | UTDT.UI | Safari 17 | ⚡ Medium |
| [TC-098](#tc-098) | 🟠 P1 | `COMPAT` | UTDT.UI | Mobile 375x667 — tab UTDT scroll horizontal | ⚠️ High |
| [TC-101](#tc-101) | 🟠 P1 | `PERFORMANCE` | UTDT.Perf | utdt-stats 4 parallel count < 1s | ⚠️ High |
| [TC-105](#tc-105) | 🟠 P1 | `INTEGRATION` | UTDT.Filter | FE list UTDT với 6 filter combine (caseType+donViGiao+loaiUyThac+date+state+investigator) | ⚠️ High |
| [TC-106](#tc-106) | 🟠 P1 | `RED` | UTDT.Create | caseProvenance khác UY_THAC_DIEU_TRA nhưng truyền donViGiao | ⚡ Medium |
| [TC-107](#tc-107) | 🟠 P1 | `RED` | UTDT.Create | ngayTraKetQua set nhưng ketQuaUyThac trống | ⚡ Medium |
| [TC-108](#tc-108) | 🟠 P1 | `RED` | UTDT.Update | PATCH /:id/assign vào non-investigator | ⚠️ High |
| [TC-109](#tc-109) | 🟠 P1 | `RED` | UTDT.Delegation | POST /delegations content > 5000 ký tự | 📌 Low |
| [TC-110](#tc-110) | 🟠 P1 | `RED` | UTDT.Delegation | receivingUnit > 255 ký tự | 📌 Low |
| [TC-111](#tc-111) | 🟠 P1 | `RED` | UTDT.Read | investigatorName chứa wildcard SQL | ⚡ Medium |
| [TC-112](#tc-112) | 🟠 P1 | `RED` | UTDT.Form | Save UTDT form nhưng API throw — error visible (v0.67.3.0) | 🚨 Critical |
| [TC-113](#tc-113) | 🟠 P1 | `RED` | UTDT.Stats | GET utdt-stats khi DB chỉ có case không UTDT | ⚡ Medium |
| [TC-114](#tc-114) | 🟠 P1 | `RED` | UTDT.Delete | Delete UTDT có Delegation liên kết | ⚠️ High |
| [TC-115](#tc-115) | 🟠 P1 | `RED` | UTDT.Form | Tab UTDT click trực tiếp URL khi caseProvenance khác | ⚡ Medium |
| [TC-116](#tc-116) | 🟠 P1 | `RED` | UTDT.Route | /uy-thac-dieu-tra/:id/edit với id không tồn tại | ⚡ Medium |
| [TC-117](#tc-117) | 🟠 P1 | `RED` | UTDT.Update | Update Delegation status thẳng PENDING → COMPLETED | ⚠️ High |
| [TC-118](#tc-118) | 🟠 P1 | `SECURITY` | UTDT.Security | Path traversal qua delegationNumber regex | ⚠️ High |
| [TC-119](#tc-119) | 🟠 P1 | `SECURITY` | UTDT.Security | NoSQL/Prisma operator injection trong filter | 🚨 Critical |
| [TC-120](#tc-120) | 🟠 P1 | `SECURITY` | UTDT.Security | Sensitive PII export — donViGiao + investigator name | ⚠️ High |
| [TC-121](#tc-121) | 🟠 P1 | `SECURITY` | UTDT.Security | Force browse /cases/X/edit của case UTDT đơn vị khác | 🚨 Critical |
| [TC-122](#tc-122) | 🟠 P1 | `A11Y` | UTDT.UI | Section UTDT có heading h2 + landmark role | ⚡ Medium |
| [TC-085](#tc-085) | 🟡 P2 | `DATA` | UTDT.Data | metadata JSON sâu (nested objects) | 📌 Low |
| [TC-088](#tc-088) | 🟡 P2 | `EDGE` | UTDT.Stats | Stats khi 0 UTDT | 📌 Low |
| [TC-092](#tc-092) | 🟡 P2 | `A11Y` | UTDT.UI | Required field 'Đơn vị giao' có dấu * + aria-required | ⚡ Medium |
| [TC-093](#tc-093) | 🟡 P2 | `A11Y` | UTDT.UI | Error catch real-error (v0.67.3.0) đọc qua live region | ⚡ Medium |
| [TC-099](#tc-099) | 🟡 P2 | `COMPAT` | UTDT.UI | Tablet 768x1024 | 📌 Low |
| [TC-102](#tc-102) | 🟡 P2 | `PERFORMANCE` | UTDT.Perf | Concurrent 30 create delegation | ⚠️ High |
| [TC-123](#tc-123) | 🟡 P2 | `A11Y` | UTDT.UI | Date picker thoiHanUyThac keyboard accessible | ⚡ Medium |
| [TC-124](#tc-124) | 🟡 P2 | `COMPAT` | UTDT.UI | PWA offline xem UTDT cached | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo case UTDT hợp lệ với donViGiao + soQuyetDinhUyThac

### Điều kiện tiên quyết
- User write:Case

### Các bước kiểm thử
- [ ] /cases/new?caseProvenance=UY_THAC_DIEU_TRA
- [ ] donViGiao='PC02 CA Hà Nội'
- [ ] loaiUyThac='UY_THAC_DIEU_TRA'
- [ ] soQuyetDinhUyThac='QĐ-123/2026'
- [ ] ngayTiepNhan, thoiHanUyThac
- [ ] Lưu

### Dữ liệu kiểm thử
```
caseType='UY_THAC_DIEU_TRA', donViGiao='PC02 CA Hà Nội'
```

### Kết quả mong đợi
**UI**:
- Tab 'Thông tin Ủy thác' hiển thị, lưu OK

**API**:
- POST /cases → 201

**Side effects** (DB, email, log, queue...):
- Case.caseType=UY_THAC_DIEU_TRA, caseProvenance=UY_THAC_DIEU_TRA, trangThaiPhanHoi=CHUA_PHAN_HOI default

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo UTDT với loaiUyThac=CHUYEN_DON_NGUON_TIN

### Các bước kiểm thử
- [ ] loaiUyThac='CHUYEN_DON_NGUON_TIN'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: TT 28/2020

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-03`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo UTDT với loaiUyThac=UY_THAC_GIAI_QUYET

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-04`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo Delegation độc lập (workflow SCR-PF-04)

### Điều kiện tiên quyết
- User write:Case

### Các bước kiểm thử
- [ ] POST /delegations body {receivingUnit, content}

### Dữ liệu kiểm thử
```
receivingUnit='PA05', content='Trưng cầu giám định'
```

### Kết quả mong đợi
**API**:
- , delegationNumber='UT-001/2026' auto-gen

**Side effects** (DB, email, log, queue...):
- emit utdt.assigned event; status=PENDING

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-006

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /cases?caseType=UY_THAC_DIEU_TRA listing

### Các bước kiểm thử
- [ ] GET với filter

### Kết quả mong đợi
**UI**:
- UyThacDieuTraListPage hiển thị

**API**:
- , chỉ case UTDT

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: Critical
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-007

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /cases/utdt-stats 4 trạng thái phản hồi

### Các bước kiểm thử
- [ ] GET /cases/utdt-stats

### Kết quả mong đợi
**UI**:
- chip count

**API**:
- , body {total, byTrangThai:{DA_PHAN_HOI, KHONG_THUC_HIEN_DUOC, QUA_HAN, CHUA_PHAN_HOI}}

**Side effects** (DB, email, log, queue...):
- Force caseType=UY_THAC_DIEU_TRA

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: Critical
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-011

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Cập nhật kết quả UTDT (ketQuaUyThac + ngayTraKetQua)

### Điều kiện tiên quyết
- Case UTDT đã có

### Các bước kiểm thử
- [ ] PUT /cases/X body có ketQuaUyThac, ngayTraKetQua

### Kết quả mong đợi
**UI**:
- Badge chuyển DA_PHAN_HOI

**API**:

**Side effects** (DB, email, log, queue...):
- trangThaiPhanHoi=DA_PHAN_HOI computed

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Cập nhật metadata utdt_lyDoKhongThucHienDuoc

### Các bước kiểm thử
- [ ] PUT metadata.utdt_lyDoKhongThucHienDuoc='...'

### Kết quả mong đợi
**UI**:
- Badge KHONG_THUC_HIEN_DUOC

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-014

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `UTDT.Route`
- Yêu cầu: `REQ-UTDT-RT-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Row click → /uy-thac-dieu-tra/:id/edit redirect /cases/:id/edit

### Các bước kiểm thử
- [ ] Click row trên list UTDT

### Kết quả mong đợi
**UI**:
- Mở edit, returnPath=/uy-thac-dieu-tra

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Route`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Route`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Critical
module: UTDT.Route
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.67.4.0 fix

---

## TC-018

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo UTDT thiếu donViGiao (v0.67.3.0 bắt buộc)

### Các bước kiểm thử
- [ ] caseProvenance=UY_THAC_DIEU_TRA, donViGiao=''

### Kết quả mong đợi
**UI**:
- Lỗi 'Đơn vị giao ủy thác là bắt buộc' surface từ catch (không nuốt)

**API**:

**Side effects** (DB, email, log, queue...):
- buildCreateCasePayload throw

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.67.3.0 — real-error fix

---

## TC-019

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-06`
- Kỹ thuật: `Negative + CHECK`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: caseProvenance=UY_THAC_DIEU_TRA nhưng caseType=REGULAR

### Các bước kiểm thử
- [ ] POST với mismatch

### Kết quả mong đợi
**API**:
- /422

**Side effects** (DB, email, log, queue...):
- DB CHECK constraint reject (migration 20260523000000)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-020

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-07`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: loaiUyThac enum không hợp lệ

### Các bước kiểm thử
- [ ] loaiUyThac='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: donViGiao > 500 ký tự

### Các bước kiểm thử
- [ ] char

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-022

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: soQuyetDinhUyThac > 100 ký tự

### Các bước kiểm thử
- [ ] char

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: loaiThongTin > 200 ký tự

### Các bước kiểm thử
- [ ] char

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-024

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-11`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: thoiHanUyThac < ngayTiepNhan

### Các bước kiểm thử
- [ ] thoiHanUyThac < ngayTiepNhan

### Kết quả mong đợi
**UI**:
- Cảnh báo

**API**:
- /200 flag

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-025

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-05`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: ngayTraKetQua < ngayTiepNhan

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-026

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-12`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Delegation thiếu receivingUnit

### Các bước kiểm thử
- [ ] POST /delegations body {content:'X'}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-027

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-13`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Delegation thiếu content

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-028

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-14`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delegation status không thuộc enum (XYZ)

### Các bước kiểm thử
- [ ] status='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-029

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-15`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: delegationNumber manual trùng

### Điều kiện tiên quyết
- DB có 'UT-001/2026'

### Các bước kiểm thử
- [ ] POST delegationNumber='UT-001/2026'

### Kết quả mong đợi
**API**:
- unique

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Critical
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-030

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-16`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: relatedCaseId không tồn tại

### Kết quả mong đợi
**API**:
- /404

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-031

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-05`
- Kỹ thuật: `Negative IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User Team A xem UTDT Team B (IDOR)

### Các bước kiểm thử
- [ ] GET /cases/<other-team-UTDT>

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-032

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-RD-06`
- Kỹ thuật: `Negative IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /delegations/X khác scope

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-033

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Auth`
- Yêu cầu: `REQ-UTDT-AUTH-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET không JWT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: Critical
module: UTDT.Auth
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-034

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Auth`
- Yêu cầu: `REQ-UTDT-AUTH-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User không có write:Case create UTDT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: Critical
module: UTDT.Auth
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-035

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Delete`
- Yêu cầu: `REQ-UTDT-DEL-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Delegation xóa bởi non-creator non-admin

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Critical
module: UTDT.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-036

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET utdt-stats không strip caseType filter

### Các bước kiểm thử
- [ ] GET /utdt-stats?caseType=REGULAR

### Kết quả mong đợi
**API**:
- vẫn force UY_THAC_DIEU_TRA

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: High
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-037

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET utdt-stats không strip trangThaiPhanHoi

### Các bước kiểm thử
- [ ] GET ?trangThaiPhanHoi=DA_PHAN_HOI

### Kết quả mong đợi
**API**:
- vẫn trả 4 trạng thái

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: High
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-066

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `UTDT.State`
- Yêu cầu: `REQ-UTDT-ST-01`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delegation PENDING → RECEIVED

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- emit utdt.received

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: High
module: UTDT.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-067

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `UTDT.State`
- Yêu cầu: `REQ-UTDT-ST-02`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delegation RECEIVED → COMPLETED

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- completedDate set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: High
module: UTDT.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-068

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `UTDT.State`
- Yêu cầu: `REQ-UTDT-ST-03`
- Kỹ thuật: `State`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: COMPLETED → bất kỳ (terminal)

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: High
module: UTDT.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-069

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `UTDT.State`
- Yêu cầu: `REQ-UTDT-ST-04`
- Kỹ thuật: `State Decision`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: trangThaiPhanHoi computed precedence DA_PHAN_HOI > KHONG_THUC_HIEN_DUOC

### Các bước kiểm thử
- [ ] ketQuaUyThac+ngayTraKetQua + utdt_lyDoKhongThucHienDuoc cùng có

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- DA_PHAN_HOI thắng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Critical
module: UTDT.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-070

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `UTDT.State`
- Yêu cầu: `REQ-UTDT-ST-05`
- Kỹ thuật: `State Decision`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: trangThaiPhanHoi precedence QUA_HAN < KHONG_THUC_HIEN_DUOC

### Các bước kiểm thử
- [ ] now>thoiHanUyThac + utdt_lyDoKhongThucHienDuoc set

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- KHONG_THUC_HIEN_DUOC thắng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Critical
module: UTDT.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-071

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `UTDT.Decision`
- Yêu cầu: `REQ-UTDT-DT-01`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Decision Table — trangThaiPhanHoi 16 combination (4 fields × 2 state)

### Các bước kiểm thử
- [ ] Bảng quyết định 4 yếu tố: ngayTraKetQua, ketQuaUyThac, lyDoKhongThucHienDuoc, thoiHanUyThac<now

### Dữ liệu kiểm thử
```
16 combinations
```

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Mỗi combination → badge đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Critical
module: UTDT.Decision
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-072

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `UTDT.Decision`
- Yêu cầu: `REQ-UTDT-DT-02`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: caseProvenance × caseType validation CHECK constraint

### Các bước kiểm thử
- [ ] x2 matrix: provenance UTDT/non + type UTDT/non

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Chỉ pair UTDT+UTDT hoặc non+non pass

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: Critical
module: UTDT.Decision
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DB CHECK constraint v0.67.2.0

---

## TC-073

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-01`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SQL Injection trong donViGiao filter

### Các bước kiểm thử
- [ ] ?donViGiao=' OR 1=1

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-074

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-02`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS donViGiao + ketQuaUyThac

### Các bước kiểm thử
- [ ] value '<script>alert(1)</script>'

### Kết quả mong đợi
**UI**:
- Escape

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-075

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-03`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR — GET delegation cross-user

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-076

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-04`
- Kỹ thuật: `OWASP A08`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mass assignment delegationNumber để override engine

### Các bước kiểm thử
- [ ] POST body có delegationNumber='UT-FAKE-0001'

### Kết quả mong đợi
**API**:
- server ignore + auto-gen

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-077

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-05`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CSRF POST cross-origin

### Kết quả mong đợi
**API**:
- CORS reject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-100

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `UTDT.Perf`
- Yêu cầu: `REQ-UTDT-PERF-01`
- Kỹ thuật: `Performance`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List 1000 UTDT < 2s

### Kết quả mong đợi
**API**:
- P95 < 2s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: High
module: UTDT.Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-103

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `UTDT.Notify`
- Yêu cầu: `REQ-UTDT-INT-01`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: create delegation emit utdt.assigned → SSE assignedTo

### Kết quả mong đợi
**UI**:
- Bell badge

**API**:
- SSE event

**Side effects** (DB, email, log, queue...):
- Notification row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Notify`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Notify`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: High
module: UTDT.Notify
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-104

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `UTDT.Case`
- Yêu cầu: `REQ-UTDT-INT-02`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Case UTDT khi caseProvenance=UY_THAC_DIEU_TRA tự force caseType

### Kết quả mong đợi
**API**:
- caseType=UY_THAC_DIEU_TRA

**Side effects** (DB, email, log, queue...):
- buildCreateCasePayload

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Case`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Case`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: Critical
module: UTDT.Case
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-05`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delegation với relatedCaseId

### Điều kiện tiên quyết
- Có Case X

### Các bước kiểm thử
- [ ] POST /delegations relatedCaseId=X

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- Link sang Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-008

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-02`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Filter theo trangThaiPhanHoi=QUA_HAN

### Các bước kiểm thử
- [ ] ?trangThaiPhanHoi=QUA_HAN

### Kết quả mong đợi
**API**:
- , case có thoiHanUyThac<now

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: High
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-009

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-03`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Filter theo donViGiao

### Các bước kiểm thử
- [ ] ?donViGiao='PC02'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Medium
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-04`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Filter date range ngayTiepNhan

### Các bước kiểm thử
- [ ] ?ngayTiepNhanFrom=2026-01-01&ngayTiepNhanTo=2026-12-31

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Medium
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-013

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: CaseFormPage hiển thị tab 'Thông tin Ủy thác' tại vị trí 2

### Điều kiện tiên quyết
- caseProvenance=UY_THAC_DIEU_TRA

### Các bước kiểm thử
- [ ] Mở form

### Kết quả mong đợi
**UI**:
- Tab 2 = 'Thông tin Ủy thác'; tab vụ việc/nguồn ẩn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: High
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.44.2.0

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-03`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update Delegation status PENDING → RECEIVED

### Các bước kiểm thử
- [ ] PUT /delegations/X status=RECEIVED

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- emit event

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-016

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-04`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delegation RECEIVED → COMPLETED có completedDate

### Các bước kiểm thử
- [ ] PUT status=COMPLETED completedDate

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-017

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `UTDT.Delete`
- Yêu cầu: `REQ-UTDT-DEL-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Soft-delete Delegation bởi creator

### Các bước kiểm thử
- [ ] DELETE /delegations/X

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delete`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: High
module: UTDT.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-038

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Filter trangThaiPhanHoi không hợp lệ

### Các bước kiểm thử
- [ ] ?trangThaiPhanHoi='RANDOM'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: Medium
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-039

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-08`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: investigatorName search SQL injection

### Các bước kiểm thử
- [ ] ?investigatorName=' OR 1=1

### Kết quả mong đợi
**API**:
- không leak

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Critical
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-040

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Update kết quả UTDT trên case không phải UTDT

### Điều kiện tiên quyết
- caseType=REGULAR

### Các bước kiểm thử
- [ ] PUT ketQuaUyThac

### Kết quả mong đợi
**API**:
- /200 ignore

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: Medium
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-041

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tab 'Thông tin Ủy thác' hiển thị khi caseProvenance khác UY_THAC_DIEU_TRA

### Các bước kiểm thử
- [ ] caseProvenance=DIRECT_DISCOVERY

### Kết quả mong đợi
**UI**:
- Tab UTDT KHÔNG hiển thị

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: High
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-042

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đổi caseProvenance khác → tab UTDT ẩn ngay

### Các bước kiểm thử
- [ ] Đang UTDT đổi sang DIRECT

### Kết quả mong đợi
**UI**:
- Tab UTDT ẩn, dữ liệu cảnh báo

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: High
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-043

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-07`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Update OCC stale

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: Critical
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-044

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: limit > 100

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Medium
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-045

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-10`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Sort theo donViGiao injection

### Các bước kiểm thử
- [ ] sortBy='donViGiao; DROP'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Critical
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-046

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-CR-17`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: loaiUyThac=null nhưng vẫn submit

### Các bước kiểm thử
- [ ] Bỏ trống loaiUyThac

### Kết quả mong đợi
**API**:
- hoặc 200 nếu optional

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Medium
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm spec

---

## TC-047

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-18`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: ngayTraKetQua tương lai (>now)

### Các bước kiểm thử
- [ ] ngayTraKetQua=2030-01-01

### Kết quả mong đợi
**API**:
- /200 cảnh báo

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-048

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Hidden field utdt_lyDoKhongThucHienDuoc bypass

### Các bước kiểm thử
- [ ] metadata.utdt_lyDoKhongThucHienDuoc='' nhưng UI không hiển thị

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Frontend computed badge đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Medium
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-049

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-STAT-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Stats với case caseType=REGULAR (không UTDT) — phải bỏ qua

### Các bước kiểm thử
- [ ] DB có cả REGULAR + UTDT

### Kết quả mong đợi
**API**:
- GET utdt-stats chỉ count UTDT

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: High
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-050

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Bulk`
- Yêu cầu: `REQ-UTDT-BULK-01`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bulk assign UTDT khác đơn vị

### Kết quả mong đợi
**API**:
- /partial

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: High
module: UTDT.Bulk
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-051

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-08`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đổi caseType từ UY_THAC_DIEU_TRA → REGULAR

### Các bước kiểm thử
- [ ] PUT caseType=REGULAR

### Kết quả mong đợi
**API**:
- immutable hoặc 200

**Side effects** (DB, email, log, queue...):
- Confirm spec

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-052

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delete`
- Yêu cầu: `REQ-UTDT-DEL-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xóa UTDT case có sub-entities

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: High
module: UTDT.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-053

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-UP-09`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Update completedDate < createdAt

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Low
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-054

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-DEL-04`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Delete với non-creator non-admin

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Critical
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-055

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-19`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo case UTDT với linkedPetitionId (mâu thuẫn provenance)

### Các bước kiểm thử
- [ ] caseProvenance=UY_THAC_DIEU_TRA + linkedPetitionId='X'

### Kết quả mong đợi
**API**:
- CHECK constraint

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-056

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-08`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: donViGiao = 500 (max)

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-057

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-08`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: donViGiao = 1 ký tự (min)

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Low
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-058

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-09`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: soQuyetDinhUyThac = 100 (max)

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: Low
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-059

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-10`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: loaiThongTin = 200 (max)

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Low
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-060

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: thoiHanUyThac = now (boundary QUA_HAN)

### Kết quả mong đợi
**API**:
- trangThaiPhanHoi=CHUA_PHAN_HOI hoặc QUA_HAN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: High
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Đúng giây boundary

---

## TC-061

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: thoiHanUyThac = now-1s (QUA_HAN)

### Kết quả mong đợi
**API**:
- trangThaiPhanHoi=QUA_HAN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: High
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-062

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-09`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=100

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Low
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-063

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-EP-01`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: loaiUyThac 3 enum partition

### Các bước kiểm thử
- [ ] Test 3 giá trị

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-064

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-EP-02`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: trangThaiPhanHoi 4 enum + default

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: High
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-065

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-EP-03`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DelegationStatus 3 partition

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Medium
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-078

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-06`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Privilege escalation — non-dispatcher reassign delegation

### Các bước kiểm thử
- [ ] PUT /delegations/X assignedToId khác

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-079

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-07`
- Kỹ thuật: `OWASP A04`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Rate limit list UTDT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-080

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-08`
- Kỹ thuật: `OWASP A07`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Token replay sau khi user.dataScope thay đổi

### Các bước kiểm thử
- [ ] Admin thu hồi team A user
- [ ] Token cũ list UTDT

### Kết quả mong đợi
**API**:
- Phải áp scope mới (refresh)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-081

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-09`
- Kỹ thuật: `OWASP A09`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Audit log delegation lưu actor + diff

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- AuditLog UTDT_CREATED/UPDATED/DELETED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-082

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `UTDT.Data`
- Yêu cầu: `REQ-UTDT-DATA-01`
- Kỹ thuật: `i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: donViGiao tiếng Việt có dấu

### Các bước kiểm thử
- [ ] donViGiao='Cục Cảnh sát Hình sự — Bộ Công an'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: Medium
module: UTDT.Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-083

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `UTDT.Data`
- Yêu cầu: `REQ-UTDT-DATA-02`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Trim donViGiao leading/trailing

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: Low
module: UTDT.Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-084

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `UTDT.Data`
- Yêu cầu: `REQ-UTDT-DATA-03`
- Kỹ thuật: `i18n`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: ngayTiepNhan ISO UTC+7

### Kết quả mong đợi
**UI**:
- Hiển thị giờ VN

**API**:
- ISO

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: Medium
module: UTDT.Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-086

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `UTDT.Edge`
- Yêu cầu: `REQ-UTDT-EDGE-01`
- Kỹ thuật: `Race`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Concurrent update kết quả + lý do không thực hiện

### Các bước kiểm thử
- [ ] User A ghi ketQuaUyThac, B ghi lyDo cùng lúc

### Kết quả mong đợi
**API**:
- OK 1 409

**Side effects** (DB, email, log, queue...):
- trangThaiPhanHoi consistent

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Edge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Edge`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: Critical
module: UTDT.Edge
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-087

**Meta**:
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `UTDT.Edge`
- Yêu cầu: `REQ-UTDT-EDGE-02`
- Kỹ thuật: `Edge`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: thoiHanUyThac vượt 365 ngày

### Các bước kiểm thử
- [ ] thoiHanUyThac=now+400 ngày

### Kết quả mong đợi
**API**:
- (no upper limit) hoặc 400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Edge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Edge`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Medium
module: UTDT.Edge
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-089

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-01`
- Kỹ thuật: `WCAG 2.1.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tab UTDT navigation bằng arrow keys

### Kết quả mong đợi
**UI**:
- Arrow left/right giữa tabs

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: High
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-090

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-02`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: donViGiao field label htmlFor

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: High
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-091

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-03`
- Kỹ thuật: `WCAG 1.4.3`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Contrast 4 trangThaiPhanHoi badge

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-094

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-01`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome 130 Win

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: High
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-095

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-02`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Firefox 130

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-096

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-03`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Edge 130

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-097

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-04`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Safari 17

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-098

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-05`
- Kỹ thuật: `Responsive`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mobile 375x667 — tab UTDT scroll horizontal

### Kết quả mong đợi
**UI**:
- Tab bar scroll, form fits

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: High
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-101

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `UTDT.Perf`
- Yêu cầu: `REQ-UTDT-PERF-02`
- Kỹ thuật: `Performance`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: utdt-stats 4 parallel count < 1s

### Kết quả mong đợi
**API**:
- P95 < 1s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: High
module: UTDT.Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-105

**Meta**:
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: `UTDT.Filter`
- Yêu cầu: `REQ-UTDT-INT-03`
- Kỹ thuật: `Integration`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: FE list UTDT với 6 filter combine (caseType+donViGiao+loaiUyThac+date+state+investigator)

### Kết quả mong đợi
**API**:
- đúng intersect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Filter`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Filter`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: High
module: UTDT.Filter
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-106

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-20`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: caseProvenance khác UY_THAC_DIEU_TRA nhưng truyền donViGiao

### Các bước kiểm thử
- [ ] caseProvenance=DIRECT_DISCOVERY + donViGiao='X'

### Kết quả mong đợi
**API**:
- hoặc 200 ignore

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm spec

---

## TC-107

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Create`
- Yêu cầu: `REQ-UTDT-CR-21`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: ngayTraKetQua set nhưng ketQuaUyThac trống

### Kết quả mong đợi
**API**:
- (cần cả 2)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: Medium
module: UTDT.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-108

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH /:id/assign vào non-investigator

### Các bước kiểm thử
- [ ] assignedToId user role=USER (không ĐTV)

### Kết quả mong đợi
**API**:
- /403

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-109

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-CR-22`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: POST /delegations content > 5000 ký tự

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Low
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-110

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delegation`
- Yêu cầu: `REQ-UTDT-CR-23`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: receivingUnit > 255 ký tự

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delegation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delegation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Low
module: UTDT.Delegation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-111

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Read`
- Yêu cầu: `REQ-UTDT-RD-11`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: investigatorName chứa wildcard SQL

### Các bước kiểm thử
- [ ] ?investigatorName='%'

### Kết quả mong đợi
**API**:
- escape

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: Medium
module: UTDT.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-112

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-05`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Save UTDT form nhưng API throw — error visible (v0.67.3.0)

### Các bước kiểm thử
- [ ] API trả 400
- [ ] Quan sát toast

### Kết quả mong đợi
**UI**:
- Toast hiển thị error.message thật từ catch

**Side effects** (DB, email, log, queue...):
- Không nuốt error

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: Critical
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.67.3.0 real error surface

---

## TC-113

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-STAT-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET utdt-stats khi DB chỉ có case không UTDT

### Kết quả mong đợi
**API**:
- all 0

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-114

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Delete`
- Yêu cầu: `REQ-UTDT-DEL-05`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Delete UTDT có Delegation liên kết

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: High
module: UTDT.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-115

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Form`
- Yêu cầu: `REQ-UTDT-FORM-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tab UTDT click trực tiếp URL khi caseProvenance khác

### Các bước kiểm thử
- [ ] /cases/X/edit?tab=uy-thac case là DIRECT

### Kết quả mong đợi
**UI**:
- Tab ẩn, fallback tab info

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Form`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: Medium
module: UTDT.Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-116

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Route`
- Yêu cầu: `REQ-UTDT-RT-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: /uy-thac-dieu-tra/:id/edit với id không tồn tại

### Kết quả mong đợi
**UI**:
- page

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Route`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Route`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Medium
module: UTDT.Route
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-117

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `UTDT.Update`
- Yêu cầu: `REQ-UTDT-UP-11`
- Kỹ thuật: `Negative State`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update Delegation status thẳng PENDING → COMPLETED

### Kết quả mong đợi
**API**:
- hoặc 200 tùy spec

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: High
module: UTDT.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-118

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-10`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Path traversal qua delegationNumber regex

### Các bước kiểm thử
- [ ] delegationNumber='UT-../../etc/passwd'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-119

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-11`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: NoSQL/Prisma operator injection trong filter

### Các bước kiểm thử
- [ ] ?status[gt]=''

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-120

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-12`
- Kỹ thuật: `OWASP A02`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Sensitive PII export — donViGiao + investigator name

### Các bước kiểm thử
- [ ] Export Excel xem có watermark

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- AuditLog với userId

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: High
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-121

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `UTDT.Security`
- Yêu cầu: `REQ-UTDT-SEC-13`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Force browse /cases/X/edit của case UTDT đơn vị khác

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: Critical
module: UTDT.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-122

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-06`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Section UTDT có heading h2 + landmark role

### Kết quả mong đợi
**UI**:
- <section role>+<h2>

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-085

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `UTDT.Data`
- Yêu cầu: `REQ-UTDT-DATA-04`
- Kỹ thuật: `Data shape`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: metadata JSON sâu (nested objects)

### Các bước kiểm thử
- [ ] metadata depth 5 levels

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- DB lưu JSONB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: Low
module: UTDT.Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-088

**Meta**:
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `UTDT.Stats`
- Yêu cầu: `REQ-UTDT-EDGE-03`
- Kỹ thuật: `Empty`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Stats khi 0 UTDT

### Kết quả mong đợi
**UI**:
- All 0

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Stats`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: Low
module: UTDT.Stats
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-092

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-04`
- Kỹ thuật: `WCAG 3.3.2`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Required field 'Đơn vị giao' có dấu * + aria-required

### Kết quả mong đợi
**UI**:
- <input aria-required=true>

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-093

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-05`
- Kỹ thuật: `WCAG 4.1.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Error catch real-error (v0.67.3.0) đọc qua live region

### Kết quả mong đợi
**UI**:
- aria-live đọc 'Đơn vị giao ủy thác là bắt buộc'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-099

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-06`
- Kỹ thuật: `Responsive`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tablet 768x1024

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Low
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-102

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `UTDT.Perf`
- Yêu cầu: `REQ-UTDT-PERF-03`
- Kỹ thuật: `Load`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Concurrent 30 create delegation

### Kết quả mong đợi
**API**:
- delegationNumber unique không collision

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: High
module: UTDT.Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-123

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-A11Y-07`
- Kỹ thuật: `WCAG 2.1.1`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Date picker thoiHanUyThac keyboard accessible

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: Medium
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-124

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `UTDT.UI`
- Yêu cầu: `REQ-UTDT-COMPAT-07`
- Kỹ thuật: `PWA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PWA offline xem UTDT cached

### Điều kiện tiên quyết
- v0.46

### Kết quả mong đợi
**UI**:
- Read cached UTDT list

**Side effects** (DB, email, log, queue...):
- ServiceWorker

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `UTDT.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `UTDT.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Low
module: UTDT.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

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

- [ ] **TC-001** [P0] Tạo case UTDT hợp lệ với donViGiao + soQuyetDinhUyThac
- [ ] **TC-002** [P0] Tạo UTDT với loaiUyThac=CHUYEN_DON_NGUON_TIN
- [ ] **TC-003** [P0] Tạo UTDT với loaiUyThac=UY_THAC_GIAI_QUYET
- [ ] **TC-004** [P0] Tạo Delegation độc lập (workflow SCR-PF-04)
- [ ] **TC-006** [P0] GET /cases?caseType=UY_THAC_DIEU_TRA listing
- [ ] **TC-007** [P0] GET /cases/utdt-stats 4 trạng thái phản hồi
- [ ] **TC-011** [P0] Cập nhật kết quả UTDT (ketQuaUyThac + ngayTraKetQua)
- [ ] **TC-012** [P0] Cập nhật metadata utdt_lyDoKhongThucHienDuoc
- [ ] **TC-014** [P0] Row click → /uy-thac-dieu-tra/:id/edit redirect /cases/:id/edit
- [ ] **TC-018** [P0] Tạo UTDT thiếu donViGiao (v0.67.3.0 bắt buộc)
- [ ] **TC-019** [P0] caseProvenance=UY_THAC_DIEU_TRA nhưng caseType=REGULAR
- [ ] **TC-020** [P0] loaiUyThac enum không hợp lệ
- [ ] **TC-021** [P0] donViGiao > 500 ký tự
- [ ] **TC-022** [P0] soQuyetDinhUyThac > 100 ký tự
- [ ] **TC-023** [P0] loaiThongTin > 200 ký tự
- [ ] **TC-024** [P0] thoiHanUyThac < ngayTiepNhan
- [ ] **TC-025** [P0] ngayTraKetQua < ngayTiepNhan
- [ ] **TC-026** [P0] Delegation thiếu receivingUnit
- [ ] **TC-027** [P0] Delegation thiếu content
- [ ] **TC-028** [P0] Delegation status không thuộc enum (XYZ)
- [ ] **TC-029** [P0] delegationNumber manual trùng
- [ ] **TC-030** [P0] relatedCaseId không tồn tại
- [ ] **TC-031** [P0] User Team A xem UTDT Team B (IDOR)
- [ ] **TC-032** [P0] GET /delegations/X khác scope
- [ ] **TC-033** [P0] GET không JWT
- [ ] **TC-034** [P0] User không có write:Case create UTDT
- [ ] **TC-035** [P0] Delegation xóa bởi non-creator non-admin
- [ ] **TC-036** [P0] GET utdt-stats không strip caseType filter
- [ ] **TC-037** [P0] GET utdt-stats không strip trangThaiPhanHoi
- [ ] **TC-066** [P0] Delegation PENDING → RECEIVED
- [ ] **TC-067** [P0] Delegation RECEIVED → COMPLETED
- [ ] **TC-068** [P0] COMPLETED → bất kỳ (terminal)
- [ ] **TC-069** [P0] trangThaiPhanHoi computed precedence DA_PHAN_HOI > KHONG_THUC_HIEN_DUOC
- [ ] **TC-070** [P0] trangThaiPhanHoi precedence QUA_HAN < KHONG_THUC_HIEN_DUOC
- [ ] **TC-071** [P0] Decision Table — trangThaiPhanHoi 16 combination (4 fields × 2 state)
- [ ] **TC-072** [P0] caseProvenance × caseType validation CHECK constraint
- [ ] **TC-073** [P0] SQL Injection trong donViGiao filter
- [ ] **TC-074** [P0] XSS donViGiao + ketQuaUyThac
- [ ] **TC-075** [P0] IDOR — GET delegation cross-user
- [ ] **TC-076** [P0] Mass assignment delegationNumber để override engine
- [ ] **TC-077** [P0] CSRF POST cross-origin
- [ ] **TC-100** [P0] List 1000 UTDT < 2s
- [ ] **TC-103** [P0] create delegation emit utdt.assigned → SSE assignedTo
- [ ] **TC-104** [P0] Case UTDT khi caseProvenance=UY_THAC_DIEU_TRA tự force caseType
- [ ] **TC-005** [P1] Delegation với relatedCaseId
- [ ] **TC-008** [P1] Filter theo trangThaiPhanHoi=QUA_HAN
- [ ] **TC-009** [P1] Filter theo donViGiao
- [ ] **TC-010** [P1] Filter date range ngayTiepNhan
- [ ] **TC-013** [P1] CaseFormPage hiển thị tab 'Thông tin Ủy thác' tại vị trí 2
- [ ] **TC-015** [P1] Update Delegation status PENDING → RECEIVED
- [ ] **TC-016** [P1] Delegation RECEIVED → COMPLETED có completedDate
- [ ] **TC-017** [P1] Soft-delete Delegation bởi creator
- [ ] **TC-038** [P1] Filter trangThaiPhanHoi không hợp lệ
- [ ] **TC-039** [P1] investigatorName search SQL injection
- [ ] **TC-040** [P1] Update kết quả UTDT trên case không phải UTDT
- [ ] **TC-041** [P1] Tab 'Thông tin Ủy thác' hiển thị khi caseProvenance khác UY_THAC_DIEU_TRA
- [ ] **TC-042** [P1] Đổi caseProvenance khác → tab UTDT ẩn ngay
- [ ] **TC-043** [P1] Update OCC stale
- [ ] **TC-044** [P1] limit > 100
- [ ] **TC-045** [P1] Sort theo donViGiao injection
- [ ] **TC-046** [P1] loaiUyThac=null nhưng vẫn submit
- [ ] **TC-047** [P1] ngayTraKetQua tương lai (>now)
- [ ] **TC-048** [P1] Hidden field utdt_lyDoKhongThucHienDuoc bypass
- [ ] **TC-049** [P1] Stats với case caseType=REGULAR (không UTDT) — phải bỏ qua
- [ ] **TC-050** [P1] Bulk assign UTDT khác đơn vị
- [ ] **TC-051** [P1] Đổi caseType từ UY_THAC_DIEU_TRA → REGULAR
- [ ] **TC-052** [P1] Xóa UTDT case có sub-entities
- [ ] **TC-053** [P1] Update completedDate < createdAt
- [ ] **TC-054** [P1] Delete với non-creator non-admin
- [ ] **TC-055** [P1] Tạo case UTDT với linkedPetitionId (mâu thuẫn provenance)
- [ ] **TC-056** [P1] donViGiao = 500 (max)
- [ ] **TC-057** [P1] donViGiao = 1 ký tự (min)
- [ ] **TC-058** [P1] soQuyetDinhUyThac = 100 (max)
- [ ] **TC-059** [P1] loaiThongTin = 200 (max)
- [ ] **TC-060** [P1] thoiHanUyThac = now (boundary QUA_HAN)
- [ ] **TC-061** [P1] thoiHanUyThac = now-1s (QUA_HAN)
- [ ] **TC-062** [P1] limit=100
- [ ] **TC-063** [P1] loaiUyThac 3 enum partition
- [ ] **TC-064** [P1] trangThaiPhanHoi 4 enum + default
- [ ] **TC-065** [P1] DelegationStatus 3 partition
- [ ] **TC-078** [P1] Privilege escalation — non-dispatcher reassign delegation
- [ ] **TC-079** [P1] Rate limit list UTDT
- [ ] **TC-080** [P1] Token replay sau khi user.dataScope thay đổi
- [ ] **TC-081** [P1] Audit log delegation lưu actor + diff
- [ ] **TC-082** [P1] donViGiao tiếng Việt có dấu
- [ ] **TC-083** [P1] Trim donViGiao leading/trailing
- [ ] **TC-084** [P1] ngayTiepNhan ISO UTC+7
- [ ] **TC-086** [P1] Concurrent update kết quả + lý do không thực hiện
- [ ] **TC-087** [P1] thoiHanUyThac vượt 365 ngày
- [ ] **TC-089** [P1] Tab UTDT navigation bằng arrow keys
- [ ] **TC-090** [P1] donViGiao field label htmlFor
- [ ] **TC-091** [P1] Contrast 4 trangThaiPhanHoi badge
- [ ] **TC-094** [P1] Chrome 130 Win
- [ ] **TC-095** [P1] Firefox 130
- [ ] **TC-096** [P1] Edge 130
- [ ] **TC-097** [P1] Safari 17
- [ ] **TC-098** [P1] Mobile 375x667 — tab UTDT scroll horizontal
- [ ] **TC-101** [P1] utdt-stats 4 parallel count < 1s
- [ ] **TC-105** [P1] FE list UTDT với 6 filter combine (caseType+donViGiao+loaiUyThac+date+state+investigator)
- [ ] **TC-106** [P1] caseProvenance khác UY_THAC_DIEU_TRA nhưng truyền donViGiao
- [ ] **TC-107** [P1] ngayTraKetQua set nhưng ketQuaUyThac trống
- [ ] **TC-108** [P1] PATCH /:id/assign vào non-investigator
- [ ] **TC-109** [P1] POST /delegations content > 5000 ký tự
- [ ] **TC-110** [P1] receivingUnit > 255 ký tự
- [ ] **TC-111** [P1] investigatorName chứa wildcard SQL
- [ ] **TC-112** [P1] Save UTDT form nhưng API throw — error visible (v0.67.3.0)
- [ ] **TC-113** [P1] GET utdt-stats khi DB chỉ có case không UTDT
- [ ] **TC-114** [P1] Delete UTDT có Delegation liên kết
- [ ] **TC-115** [P1] Tab UTDT click trực tiếp URL khi caseProvenance khác
- [ ] **TC-116** [P1] /uy-thac-dieu-tra/:id/edit với id không tồn tại
- [ ] **TC-117** [P1] Update Delegation status thẳng PENDING → COMPLETED
- [ ] **TC-118** [P1] Path traversal qua delegationNumber regex
- [ ] **TC-119** [P1] NoSQL/Prisma operator injection trong filter
- [ ] **TC-120** [P1] Sensitive PII export — donViGiao + investigator name
- [ ] **TC-121** [P1] Force browse /cases/X/edit của case UTDT đơn vị khác
- [ ] **TC-122** [P1] Section UTDT có heading h2 + landmark role
- [ ] **TC-085** [P2] metadata JSON sâu (nested objects)
- [ ] **TC-088** [P2] Stats khi 0 UTDT
- [ ] **TC-092** [P2] Required field 'Đơn vị giao' có dấu * + aria-required
- [ ] **TC-093** [P2] Error catch real-error (v0.67.3.0) đọc qua live region
- [ ] **TC-099** [P2] Tablet 768x1024
- [ ] **TC-102** [P2] Concurrent 30 create delegation
- [ ] **TC-123** [P2] Date picker thoiHanUyThac keyboard accessible
- [ ] **TC-124** [P2] PWA offline xem UTDT cached

---

_Generated by `uat-test-writer` skill on 30/05/2026 22:03_