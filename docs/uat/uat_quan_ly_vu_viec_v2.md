# UAT Test Cases — Quản lý Vụ việc (Incidents)

**Generated**: 30/05/2026 22:02  
**Complexity**: `complex`  
**Total TC**: 138  
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

**Tổng số TC**: 138

**Phân bố loại**:
- `RED`: 56
- `GREEN`: 18
- `SECURITY`: 14
- `STATE`: 8
- `BOUNDARY`: 8
- `A11Y`: 7
- `COMPAT`: 7
- `DATA`: 5
- `EP`: 4
- `PERFORMANCE`: 3
- `INTEGRATION`: 3
- `EDGE`: 3
- `DECISION`: 2

**Phân bố priority**:
- 🔴 `P0`: 47
- 🟠 `P1`: 82
- 🟡 `P2`: 9

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 38
- ⚠️ `High`: 55
- ⚡ `Medium`: 29
- 📌 `Low`: 16

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `A-01` | `dtv.incident.a@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team A | ACTIVE | DataScope test |
| `A-02` | `dtv.incident.b@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team B | ACTIVE | IDOR test |
| `A-03` | `dispatcher.inc@pc02hcm.com` | `Pa$$w0rd!` | Dispatcher | ACTIVE | Assign |
| `A-04` | `admin@pc02.local` | `Admin@2026` | ADMIN | ACTIVE | Restore |
| `A-05` | `ward.officer.inc@pc02hcm.com` | `Pa$$w0rd!` | Cán bộ phường | ACTIVE | Ward auto-assign |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| name | `<5 chars>` | `min` | **OK** |  |
| name | `<4 chars>` | `min-1` | **400** |  |
| name | `<255 chars>` | `max` | **OK** |  |
| name | `<256 chars>` | `max+1` | **400** |  |
| limit | `1` | `min` | **OK** |  |
| limit | `100` | `max` | **OK** |  |
| limit | `101` | `max+1` | **400** |  |
| số lần gia hạn | `2` | `max` | **OK** | Đ.147.3 |
| số lần gia hạn | `3` | `max+1` | **422** |  |
| reason xóa | `10` | `min` | **OK** |  |
| reason xóa | `9` | `min-1` | **400** |  |
| thời gian xóa từ create | `72h` | `boundary` | **allow** |  |
| thời gian xóa từ create | `72h+1s` | `boundary+` | **422** |  |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
|  | `' OR 1=1 --` |  | 200 không leak | `` |
|  | `<svg onload=alert(1)>` |  | Escape | `` |
|  | `name; SELECT *` |  | 400 | `` |
|  | `<other-id>` |  | Ignored | `` |
|  | `http://evil.com` |  | Block | `` |
|  | `Bearer <tampered>` |  | 401 | `` |
|  | `<!DOCTYPE foo [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>` |  | Strip | `` |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Incidents.Create | Tạo vụ việc mới hợp lệ với name + loaiDonVu + nguonPhatTin | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Incidents.Create | Auto-gen code VV-YYYY-NNN | ⚠️ High |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Incidents.Create | Auto-calc deadline theo THOI_HAN_XAC_MINH rule | ⚠️ High |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | Incidents.Read | List vụ việc default pagination | ⚠️ High |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` | Incidents.Read | Filter theo phase=xac-minh | ⚠️ High |
| [TC-008](#tc-008) | 🔴 P0 | `GREEN` | Incidents.Read | GET stats exhaustive trả về tất cả status keys | ⚡ Medium |
| [TC-009](#tc-009) | 🔴 P0 | `GREEN` | Incidents.Update | PUT update vụ việc với expectedUpdatedAt | 🚨 Critical |
| [TC-010](#tc-010) | 🔴 P0 | `GREEN` | Incidents.Status | PATCH status TIEP_NHAN → DANG_XAC_MINH | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | Incidents.Status | PATCH KHONG_KHOI_TO kèm lyDoKhongKhoiTo (Đ.157) | 🚨 Critical |
| [TC-012](#tc-012) | 🔴 P0 | `GREEN` | Incidents.Prosecute | Khởi tố vụ việc → tạo Case (Branch-3) | 🚨 Critical |
| [TC-017](#tc-017) | 🔴 P0 | `GREEN` | Incidents.Delete | Soft-delete TIEP_NHAN bởi creator trong 72h | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `GREEN` | Incidents.Restore | ADMIN restore | ⚠️ High |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | Incidents.Create | name < 5 ký tự | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | Incidents.Create | nguonPhatTin không khớp loaiDonVu | 🚨 Critical |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | Incidents.Status | Transition không nằm trong VALID_TRANSITIONS | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | Incidents.Status | KHONG_KHOI_TO thiếu lyDoKhongKhoiTo | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | Incidents.Status | Chuyển từ terminal status (DA_GIAI_QUYET) | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | Incidents.Extend | Gia hạn quá maxExtensionsSnapshot (lần 3) | 🚨 Critical |
| [TC-025](#tc-025) | 🔴 P0 | `RED` | Incidents.Delete | Xóa có linked petitions | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | Incidents.Delete | Xóa có attached documents | 🚨 Critical |
| [TC-027](#tc-027) | 🔴 P0 | `RED` | Incidents.Delete | Xóa khi status != TIEP_NHAN | 🚨 Critical |
| [TC-028](#tc-028) | 🔴 P0 | `RED` | Incidents.Delete | Quá 72h kể từ created | ⚠️ High |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | Incidents.Delete | Non-creator non-admin xóa | 🚨 Critical |
| [TC-030](#tc-030) | 🔴 P0 | `RED` | Incidents.Assign | Non-dispatcher assign | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `RED` | Incidents.Prosecute | Prosecute thiếu caseName | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `RED` | Incidents.Prosecute | Prosecute incident đã DA_CHUYEN_VU_AN | 🚨 Critical |
| [TC-033](#tc-033) | 🔴 P0 | `RED` | Incidents.Merge | Merge vào chính nó (self) | ⚠️ High |
| [TC-034](#tc-034) | 🔴 P0 | `RED` | Incidents.Merge | Merge vào incident terminal | ⚠️ High |
| [TC-035](#tc-035) | 🔴 P0 | `RED` | Incidents.Read | User ĐTV Team A xem incident Team B (DataScope) | 🚨 Critical |
| [TC-036](#tc-036) | 🔴 P0 | `RED` | Incidents.Update | Update với expectedUpdatedAt stale | 🚨 Critical |
| [TC-037](#tc-037) | 🔴 P0 | `RED` | Incidents.Restore | Non-ADMIN restore | 🚨 Critical |
| [TC-076](#tc-076) | 🔴 P0 | `STATE` | Incidents.State | TIEP_NHAN → DA_PHAN_CONG (skip xác minh) | ⚠️ High |
| [TC-077](#tc-077) | 🔴 P0 | `STATE` | Incidents.State | DA_PHAN_CONG → CHUYEN_XPHC | ⚠️ High |
| [TC-078](#tc-078) | 🔴 P0 | `STATE` | Incidents.State | DANG_XAC_MINH → TAM_DINH_CHI có lyDoTamDinhChiVuViec | ⚠️ High |
| [TC-079](#tc-079) | 🔴 P0 | `STATE` | Incidents.State | TAM_DINH_CHI → PHUC_HOI_NGUON_TIN | ⚠️ High |
| [TC-080](#tc-080) | 🔴 P0 | `STATE` | Incidents.State | PHUC_HOI_NGUON_TIN → DANG_XAC_MINH | ⚠️ High |
| [TC-081](#tc-081) | 🔴 P0 | `STATE` | Incidents.State | QUA_HAN auto-set khi deadline < now và status active | ⚠️ High |
| [TC-084](#tc-084) | 🔴 P0 | `DECISION` | Incidents.Decision | Phase mapping cho từng status | ⚠️ High |
| [TC-085](#tc-085) | 🔴 P0 | `DECISION` | Incidents.Decision | DataScope rules — dispatcher/ĐTV/ward | 🚨 Critical |
| [TC-086](#tc-086) | 🔴 P0 | `SECURITY` | Incidents.Security | SQL Injection trong search | 🚨 Critical |
| [TC-087](#tc-087) | 🔴 P0 | `SECURITY` | Incidents.Security | XSS trong name + description | 🚨 Critical |
| [TC-088](#tc-088) | 🔴 P0 | `SECURITY` | Incidents.Security | IDOR PATCH /:id/status incident khác team | 🚨 Critical |
| [TC-089](#tc-089) | 🔴 P0 | `SECURITY` | Incidents.Security | Mass assignment createdById | 🚨 Critical |
| [TC-090](#tc-090) | 🔴 P0 | `SECURITY` | Incidents.Security | CSRF POST cross-origin | 🚨 Critical |
| [TC-118](#tc-118) | 🔴 P0 | `PERFORMANCE` | Incidents.Perf | List 1000 incident < 2s | ⚠️ High |
| [TC-121](#tc-121) | 🔴 P0 | `INTEGRATION` | Incidents.Notify | Assign → SSE notification investigator | ⚠️ High |
| [TC-122](#tc-122) | 🔴 P0 | `INTEGRATION` | Incidents.Notify | Escalate ward → non-ward emit event INCIDENT_ESCALATED_FROM_WARD | ⚠️ High |
| [TC-004](#tc-004) | 🟠 P1 | `GREEN` | Incidents.Create | Ward officer tự gán assignedTeamId từ wardTeamId | ⚠️ High |
| [TC-007](#tc-007) | 🟠 P1 | `GREEN` | Incidents.Read | GET /incidents/linkable cho Case picker | ⚠️ High |
| [TC-013](#tc-013) | 🟠 P1 | `GREEN` | Incidents.Extend | Gia hạn lần 1 trong giới hạn | ⚠️ High |
| [TC-014](#tc-014) | 🟠 P1 | `GREEN` | Incidents.Assign | Dispatcher assign investigator → status DANG_XAC_MINH | ⚠️ High |
| [TC-015](#tc-015) | 🟠 P1 | `GREEN` | Incidents.Merge | Gộp vụ việc A vào B | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `GREEN` | Incidents.Transfer | Chuyển đơn vị | ⚠️ High |
| [TC-038](#tc-038) | 🟠 P1 | `RED` | Incidents.Read | Stats không strip status filter | ⚠️ High |
| [TC-039](#tc-039) | 🟠 P1 | `RED` | Incidents.Create | fromDate > toDate | ⚡ Medium |
| [TC-040](#tc-040) | 🟠 P1 | `RED` | Incidents.Create | name > 255 ký tự | ⚠️ High |
| [TC-041](#tc-041) | 🟠 P1 | `RED` | Incidents.Create | sdtNguoiToGiac sai định dạng | ⚡ Medium |
| [TC-042](#tc-042) | 🟠 P1 | `RED` | Incidents.Create | cmndNguoiToGiac không đủ 9/12 số | ⚡ Medium |
| [TC-043](#tc-043) | 🟠 P1 | `RED` | Incidents.Create | investigatorId không thuộc đơn vị | ⚠️ High |
| [TC-044](#tc-044) | 🟠 P1 | `RED` | Incidents.Create | phuongThucTiepNhan enum không hợp lệ | ⚡ Medium |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | Incidents.Create | loaiKetQua không thuộc Wireframe 5 | ⚡ Medium |
| [TC-046](#tc-046) | 🟠 P1 | `RED` | Incidents.Update | Update khi đã soft-delete | ⚠️ High |
| [TC-047](#tc-047) | 🟠 P1 | `RED` | Incidents.Transfer | Transfer thiếu chuyenDenDonVi | ⚠️ High |
| [TC-048](#tc-048) | 🟠 P1 | `RED` | Incidents.Auth | GET không JWT | 🚨 Critical |
| [TC-049](#tc-049) | 🟠 P1 | `RED` | Incidents.Auth | JWT expired | 🚨 Critical |
| [TC-050](#tc-050) | 🟠 P1 | `RED` | Incidents.Auth | User không có permission write:Incident | 🚨 Critical |
| [TC-051](#tc-051) | 🟠 P1 | `RED` | Incidents.Create | sourcePetitionId thuộc Petition không trong scope | ⚠️ High |
| [TC-052](#tc-052) | 🟠 P1 | `RED` | Incidents.Extend | Gia hạn với newDeadline < deadline hiện tại | ⚠️ High |
| [TC-053](#tc-053) | 🟠 P1 | `RED` | Incidents.Read | limit > 100 | ⚡ Medium |
| [TC-054](#tc-054) | 🟠 P1 | `RED` | Incidents.Read | phase không hợp lệ | 📌 Low |
| [TC-055](#tc-055) | 🟠 P1 | `RED` | Incidents.Read | sortBy injection | 🚨 Critical |
| [TC-056](#tc-056) | 🟠 P1 | `RED` | Incidents.Delete | Reason xóa < 10 ký tự | ⚠️ High |
| [TC-057](#tc-057) | 🟠 P1 | `RED` | Incidents.Bulk | Bulk delete vượt rate 5/min | ⚡ Medium |
| [TC-058](#tc-058) | 🟠 P1 | `RED` | Incidents.Export | Export ward không thuộc user | ⚠️ High |
| [TC-059](#tc-059) | 🟠 P1 | `RED` | Incidents.Status | Status string sai chính tả | ⚡ Medium |
| [TC-060](#tc-060) | 🟠 P1 | `RED` | Incidents.Linkable | Linkable trả incident của team khác | 🚨 Critical |
| [TC-061](#tc-061) | 🟠 P1 | `RED` | Incidents.Create | diaChiXayRa > 500 ký tự | 📌 Low |
| [TC-062](#tc-062) | 🟠 P1 | `RED` | Incidents.Create | Body JSON malformed | ⚡ Medium |
| [TC-063](#tc-063) | 🟠 P1 | `RED` | Incidents.Status | Status chuyển từ TAM_DINH_CHI sang DANG_XAC_MINH (không qua PHUC_HOI) | 🚨 Critical |
| [TC-064](#tc-064) | 🟠 P1 | `BOUNDARY` | Incidents.Create | name = 5 ký tự (min) | 📌 Low |
| [TC-065](#tc-065) | 🟠 P1 | `BOUNDARY` | Incidents.Create | name = 4 ký tự (min-1) | 📌 Low |
| [TC-066](#tc-066) | 🟠 P1 | `BOUNDARY` | Incidents.Create | name = 255 ký tự (max) | ⚡ Medium |
| [TC-067](#tc-067) | 🟠 P1 | `BOUNDARY` | Incidents.Extend | Số lần gia hạn = 2 (max) | ⚠️ High |
| [TC-068](#tc-068) | 🟠 P1 | `BOUNDARY` | Incidents.Delete | Created cách đây đúng 72h (boundary) | ⚠️ High |
| [TC-069](#tc-069) | 🟠 P1 | `BOUNDARY` | Incidents.Delete | Created cách đây 72h+1s | ⚠️ High |
| [TC-070](#tc-070) | 🟠 P1 | `BOUNDARY` | Incidents.Read | limit=1 | 📌 Low |
| [TC-071](#tc-071) | 🟠 P1 | `BOUNDARY` | Incidents.Read | limit=100 | 📌 Low |
| [TC-072](#tc-072) | 🟠 P1 | `EP` | Incidents.State | VALID_TRANSITIONS — phủ tất cả 14 status start | ⚠️ High |
| [TC-073](#tc-073) | 🟠 P1 | `EP` | Incidents.Create | lyDoKhongKhoiTo — 7 enum giá trị | ⚡ Medium |
| [TC-074](#tc-074) | 🟠 P1 | `EP` | Incidents.Create | phuongThucTiepNhan — 5 enum TT28 | 📌 Low |
| [TC-075](#tc-075) | 🟠 P1 | `EP` | Incidents.Read | 4 phase × empty/filled scope | ⚡ Medium |
| [TC-082](#tc-082) | 🟠 P1 | `STATE` | Incidents.State | TDC_HET_THOI_HIEU là terminal | ⚠️ High |
| [TC-083](#tc-083) | 🟠 P1 | `STATE` | Incidents.State | DA_NHAP_VU_KHAC sau merge — không edit | ⚡ Medium |
| [TC-091](#tc-091) | 🟠 P1 | `SECURITY` | Incidents.Security | Insecure direct file path trong export | ⚠️ High |
| [TC-092](#tc-092) | 🟠 P1 | `SECURITY` | Incidents.Security | Tampering Authorization header | 🚨 Critical |
| [TC-093](#tc-093) | 🟠 P1 | `SECURITY` | Incidents.Security | Privilege escalation qua assign endpoint | 🚨 Critical |
| [TC-094](#tc-094) | 🟠 P1 | `SECURITY` | Incidents.Security | Rate limit list endpoint | ⚠️ High |
| [TC-095](#tc-095) | 🟠 P1 | `SECURITY` | Incidents.Security | Sensitive PII leak — sdt + cmnd trong journey API | 🚨 Critical |
| [TC-096](#tc-096) | 🟠 P1 | `SECURITY` | Incidents.Security | Open redirect qua returnPath param | ⚡ Medium |
| [TC-097](#tc-097) | 🟠 P1 | `SECURITY` | Incidents.Security | Tampering with expectedUpdatedAt to force overwrite | ⚠️ High |
| [TC-098](#tc-098) | 🟠 P1 | `DATA` | Incidents.Data | Unicode + diacritics trong name | ⚡ Medium |
| [TC-099](#tc-099) | 🟠 P1 | `DATA` | Incidents.Data | Trim space leading/trailing | 📌 Low |
| [TC-100](#tc-100) | 🟠 P1 | `DATA` | Incidents.Data | Date format trả về UTC+7 frontend | ⚡ Medium |
| [TC-103](#tc-103) | 🟠 P1 | `EDGE` | Incidents.Race | 2 user concurrent prosecute cùng incident | 🚨 Critical |
| [TC-104](#tc-104) | 🟠 P1 | `EDGE` | Incidents.Merge | Merge khi target đang được edit | ⚠️ High |
| [TC-106](#tc-106) | 🟠 P1 | `A11Y` | Incidents.UI | Form keyboard navigation | ⚠️ High |
| [TC-107](#tc-107) | 🟠 P1 | `A11Y` | Incidents.UI | Label đầy đủ cho enum select | ⚠️ High |
| [TC-108](#tc-108) | 🟠 P1 | `A11Y` | Incidents.UI | Contrast 14 status badge ≥ 4.5:1 | ⚡ Medium |
| [TC-112](#tc-112) | 🟠 P1 | `COMPAT` | Incidents.UI | Chrome 130 Win | ⚠️ High |
| [TC-113](#tc-113) | 🟠 P1 | `COMPAT` | Incidents.UI | Firefox 130 macOS | ⚡ Medium |
| [TC-114](#tc-114) | 🟠 P1 | `COMPAT` | Incidents.UI | Edge 130 | ⚡ Medium |
| [TC-115](#tc-115) | 🟠 P1 | `COMPAT` | Incidents.UI | Safari iOS | ⚡ Medium |
| [TC-116](#tc-116) | 🟠 P1 | `COMPAT` | Incidents.UI | Mobile 375x667 | ⚠️ High |
| [TC-119](#tc-119) | 🟠 P1 | `PERFORMANCE` | Incidents.Perf | 50 concurrent stats | ⚠️ High |
| [TC-123](#tc-123) | 🟠 P1 | `INTEGRATION` | Incidents.Journey | Journey combine statusHistory + AuditLog | ⚠️ High |
| [TC-124](#tc-124) | 🟠 P1 | `RED` | Incidents.Read | GET /:id incident đã soft-delete bằng user thường | ⚡ Medium |
| [TC-125](#tc-125) | 🟠 P1 | `RED` | Incidents.Prosecute | Prosecute với prosecutionDecision không hợp lệ | ⚠️ High |
| [TC-126](#tc-126) | 🟠 P1 | `RED` | Incidents.Bulk | Bulk delete ids gồm incident terminal | ⚠️ High |
| [TC-127](#tc-127) | 🟠 P1 | `RED` | Incidents.Create | Body có field không tồn tại — strict mode | 📌 Low |
| [TC-128](#tc-128) | 🟠 P1 | `RED` | Incidents.Merge | Merge khi A và B khác đơn vị | ⚠️ High |
| [TC-129](#tc-129) | 🟠 P1 | `RED` | Incidents.Read | Search SQL keyword UNION | ⚡ Medium |
| [TC-130](#tc-130) | 🟠 P1 | `SECURITY` | Incidents.Security | Insufficient logging — không log failed assign attempt | ⚠️ High |
| [TC-131](#tc-131) | 🟠 P1 | `A11Y` | Incidents.UI | Tab order trong form Phase 4 sections logic | ⚡ Medium |
| [TC-133](#tc-133) | 🟠 P1 | `RED` | Incidents.Create | deadline trong quá khứ | ⚡ Medium |
| [TC-134](#tc-134) | 🟠 P1 | `RED` | Incidents.Read | Filter trangThaiThoiHieu enum không hợp lệ | 📌 Low |
| [TC-135](#tc-135) | 🟠 P1 | `RED` | Incidents.Update | Đổi status qua PUT thay vì PATCH /status | ⚠️ High |
| [TC-136](#tc-136) | 🟠 P1 | `SECURITY` | Incidents.Security | Time-based timing attack — phân biệt 404 vs 403 | ⚠️ High |
| [TC-137](#tc-137) | 🟠 P1 | `RED` | Incidents.Create | Tạo incident với canBoNhapId user khác đơn vị | ⚠️ High |
| [TC-138](#tc-138) | 🟠 P1 | `RED` | Incidents.Status | PATCH /status request body rỗng | 📌 Low |
| [TC-101](#tc-101) | 🟡 P2 | `DATA` | Incidents.Data | Empty string vs null phân biệt | 📌 Low |
| [TC-102](#tc-102) | 🟡 P2 | `DATA` | Incidents.Data | Email format trong contact field | 📌 Low |
| [TC-105](#tc-105) | 🟡 P2 | `EDGE` | Incidents.Read | Stats khi DB rỗng | 📌 Low |
| [TC-109](#tc-109) | 🟡 P2 | `A11Y` | Incidents.UI | Confirm dialog merge có aria-modal | ⚡ Medium |
| [TC-110](#tc-110) | 🟡 P2 | `A11Y` | Incidents.UI | Error live region announce | ⚡ Medium |
| [TC-111](#tc-111) | 🟡 P2 | `A11Y` | Incidents.UI | Icon-only buttons có aria-label | ⚡ Medium |
| [TC-117](#tc-117) | 🟡 P2 | `COMPAT` | Incidents.UI | Tablet 768x1024 | 📌 Low |
| [TC-120](#tc-120) | 🟡 P2 | `PERFORMANCE` | Incidents.Perf | Export ward 2000 record | ⚡ Medium |
| [TC-132](#tc-132) | 🟡 P2 | `COMPAT` | Incidents.UI | Android Chrome 5'' viewport | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ việc mới hợp lệ với name + loaiDonVu + nguonPhatTin

### Điều kiện tiên quyết
- User role ĐTV có write:Incident

### Các bước kiểm thử
- [ ] POST /incidents
- [ ] name='Vụ việc trộm cắp xe máy', loaiDonVu='TO_GIAC', nguonPhatTin='QUA_NGUOI_DAN', phuongThucTiepNhan='TRUC_TIEP'

### Dữ liệu kiểm thử
```
name='VV trộm cắp', loaiDonVu='TO_GIAC'
```

### Kết quả mong đợi
**UI**:
- Toast tạo thành công, redirect detail

**API**:
- + code auto VV-2026-XXX

**Side effects** (DB, email, log, queue...):
- deadline auto-calc THOI_HAN_XAC_MINH; status=TIEP_NHAN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Auto-gen code VV-YYYY-NNN

### Các bước kiểm thử
- [ ] POST 3 vụ việc liên tiếp

### Dữ liệu kiểm thử
```
3 valid bodies
```

### Kết quả mong đợi
**API**:
- code khác nhau, format VV-2026-001/002/003

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: High
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-03`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Auto-calc deadline theo THOI_HAN_XAC_MINH rule

### Điều kiện tiên quyết
- SystemSetting THOI_HAN_XAC_MINH=30 days

### Các bước kiểm thử
- [ ] POST không truyền deadline

### Kết quả mong đợi
**UI**:
- Preview deadline = today+30

**API**:
- deadline đúng

**Side effects** (DB, email, log, queue...):
- deadlineRuleVersionId snapshot

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: High
module: Incidents.Create
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
- Priority: `P0` 🔴
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List vụ việc default pagination

### Điều kiện tiên quyết
- DB ≥25

### Các bước kiểm thử
- [ ] GET /incidents

### Kết quả mong đợi
**UI**:
- row

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: High
module: Incidents.Read
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Filter theo phase=xac-minh

### Các bước kiểm thử
- [ ] ?phase=xac-minh

### Kết quả mong đợi
**API**:
- , status ∈ [DANG_XAC_MINH, DA_PHAN_CONG, QUA_HAN]

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: High
module: Incidents.Read
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
- Priority: `P0` 🔴
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-04`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET stats exhaustive trả về tất cả status keys

### Các bước kiểm thử
- [ ] GET /incidents/stats

### Kết quả mong đợi
**API**:
- , body có đủ 14 key status

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: Medium
module: Incidents.Read
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
- Priority: `P0` 🔴
- Module: `Incidents.Update`
- Yêu cầu: `REQ-INC-UP-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PUT update vụ việc với expectedUpdatedAt

### Các bước kiểm thử
- [ ] PUT /incidents/X

### Dữ liệu kiểm thử
```
name mới, expectedUpdatedAt
```

### Kết quả mong đợi
**UI**:
- Toast OK

**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog INCIDENT_UPDATED diff

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Critical
module: Incidents.Update
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
- Priority: `P0` 🔴
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-01`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH status TIEP_NHAN → DANG_XAC_MINH

### Điều kiện tiên quyết
- status=TIEP_NHAN

### Các bước kiểm thử
- [ ] PATCH /incidents/X/status body {status:'DANG_XAC_MINH'}

### Kết quả mong đợi
**UI**:
- Badge đổi

**API**:

**Side effects** (DB, email, log, queue...):
- IncidentStatusHistory entry

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Critical
module: Incidents.Status
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
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-02`
- Kỹ thuật: `State + Decision`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH KHONG_KHOI_TO kèm lyDoKhongKhoiTo (Đ.157)

### Điều kiện tiên quyết
- status=DANG_XAC_MINH

### Các bước kiểm thử
- [ ] PATCH status=KHONG_KHOI_TO, lyDoKhongKhoiTo='KHONG_CO_DAU_HIEU_TOI_PHAM'

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Incidents.Status
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: BLTTHS Đ.157

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Incidents.Prosecute`
- Yêu cầu: `REQ-INC-PROS-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Khởi tố vụ việc → tạo Case (Branch-3)

### Điều kiện tiên quyết
- status hợp lệ prosecute

### Các bước kiểm thử
- [ ] POST /incidents/X/prosecute body {caseName, prosecutionDecision}

### Dữ liệu kiểm thử
```
caseName='Vụ án X', prosecutionDecision='FROM_INCIDENT'
```

### Kết quả mong đợi
**UI**:
- Redirect Case mới

**API**:

**Side effects** (DB, email, log, queue...):
- Atomic: Case mới + Incident.status=DA_CHUYEN_VU_AN + linkedCaseId set 2 chiều

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Prosecute`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Prosecute`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: Critical
module: Incidents.Prosecute
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
- Priority: `P0` 🔴
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Soft-delete TIEP_NHAN bởi creator trong 72h

### Điều kiện tiên quyết
- status=TIEP_NHAN, không petitions/docs, creator

### Các bước kiểm thử
- [ ] DELETE /incidents/X body {reason 10+ char}

### Kết quả mong đợi
**UI**:
- Toast

**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt set, Case.linkedIncidentId nullify nếu có

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Critical
module: Incidents.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-018

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Incidents.Restore`
- Yêu cầu: `REQ-INC-RES-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: ADMIN restore

### Các bước kiểm thử
- [ ] POST /incidents/X/restore

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt=null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Restore`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: High
module: Incidents.Restore
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-019

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: name < 5 ký tự

### Các bước kiểm thử
- [ ] name='ABC'

### Kết quả mong đợi
**UI**:
- Lỗi 'Tối thiểu 5 ký tự'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-05`
- Kỹ thuật: `Negative + Decision`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: nguonPhatTin không khớp loaiDonVu

### Các bước kiểm thử
- [ ] loaiDonVu='TO_GIAC', nguonPhatTin='QUA_KIEN_NGHI_KHOI_TO'

### Kết quả mong đợi
**UI**:
- Lỗi mismatch

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: IsNguonPhatTinMatchLoaiDonVu validator

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-03`
- Kỹ thuật: `State Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Transition không nằm trong VALID_TRANSITIONS

### Điều kiện tiên quyết
- status=TIEP_NHAN

### Các bước kiểm thử
- [ ] PATCH status=DA_GIAI_QUYET (không có trong allowed)

### Kết quả mong đợi
**UI**:
- Lỗi 'Không thể chuyển'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: Critical
module: Incidents.Status
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
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: KHONG_KHOI_TO thiếu lyDoKhongKhoiTo

### Các bước kiểm thử
- [ ] PATCH KHONG_KHOI_TO bỏ lyDo

### Kết quả mong đợi
**UI**:
- Lỗi bắt buộc

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: Critical
module: Incidents.Status
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Đ.157

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-04`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Chuyển từ terminal status (DA_GIAI_QUYET)

### Điều kiện tiên quyết
- status=DA_GIAI_QUYET

### Các bước kiểm thử
- [ ] PATCH status=DANG_XAC_MINH

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Incidents.Status
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
- Module: `Incidents.Extend`
- Yêu cầu: `REQ-INC-EXT-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Gia hạn quá maxExtensionsSnapshot (lần 3)

### Điều kiện tiên quyết
- Đã gia hạn 2 lần

### Các bước kiểm thử
- [ ] POST extend lần 3

### Kết quả mong đợi
**UI**:
- Lỗi 'Vượt số lần gia hạn cho phép'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Extend`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Extend`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Critical
module: Incidents.Extend
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Đ.147.3

---

## TC-025

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa có linked petitions

### Điều kiện tiên quyết
- Incident có ≥1 petition

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**UI**:
- Lỗi 'Còn petition liên kết'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Critical
module: Incidents.Delete
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
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa có attached documents

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Critical
module: Incidents.Delete
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
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-04`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa khi status != TIEP_NHAN

### Điều kiện tiên quyết
- status=DANG_XAC_MINH

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Critical
module: Incidents.Delete
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
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-05`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Quá 72h kể từ created

### Điều kiện tiên quyết
- createdAt > 72h

### Các bước kiểm thử
- [ ] DELETE bởi non-admin

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: High
module: Incidents.Delete
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
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-06`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-creator non-admin xóa

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Critical
module: Incidents.Delete
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
- Module: `Incidents.Assign`
- Yêu cầu: `REQ-INC-ASN-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-dispatcher assign

### Các bước kiểm thử
- [ ] PATCH /assign user thường

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: Incidents.Assign
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
- Module: `Incidents.Prosecute`
- Yêu cầu: `REQ-INC-PROS-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Prosecute thiếu caseName

### Các bước kiểm thử
- [ ] POST /prosecute body {}

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Prosecute`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Prosecute`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: Incidents.Prosecute
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
- Module: `Incidents.Prosecute`
- Yêu cầu: `REQ-INC-PROS-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Prosecute incident đã DA_CHUYEN_VU_AN

### Điều kiện tiên quyết
- status=DA_CHUYEN_VU_AN

### Các bước kiểm thử
- [ ] POST /prosecute lần 2

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Prosecute`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Prosecute`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: Incidents.Prosecute
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
- Module: `Incidents.Merge`
- Yêu cầu: `REQ-INC-MRG-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merge vào chính nó (self)

### Các bước kiểm thử
- [ ] PATCH /A/merge targetIncidentId=A

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Merge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Merge`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: High
module: Incidents.Merge
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
- Module: `Incidents.Merge`
- Yêu cầu: `REQ-INC-MRG-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merge vào incident terminal

### Điều kiện tiên quyết
- target=DA_GIAI_QUYET

### Các bước kiểm thử
- [ ] PATCH merge

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Merge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Merge`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: High
module: Incidents.Merge
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-05`
- Kỹ thuật: `Negative IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User ĐTV Team A xem incident Team B (DataScope)

### Các bước kiểm thử
- [ ] GET /incidents/<other-team>

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Critical
module: Incidents.Read
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
- Module: `Incidents.Update`
- Yêu cầu: `REQ-INC-UP-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Update với expectedUpdatedAt stale

### Các bước kiểm thử
- [ ] PUT stale lock

### Kết quả mong đợi
**UI**:
- Dialog conflict

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: Critical
module: Incidents.Update
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
- Module: `Incidents.Restore`
- Yêu cầu: `REQ-INC-RES-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-ADMIN restore

### Các bước kiểm thử
- [ ] POST /restore

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Restore`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: Critical
module: Incidents.Restore
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-07`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: TIEP_NHAN → DA_PHAN_CONG (skip xác minh)

### Điều kiện tiên quyết
- status=TIEP_NHAN

### Các bước kiểm thử
- [ ] PATCH DA_PHAN_CONG

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- History

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-08`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DA_PHAN_CONG → CHUYEN_XPHC

### Các bước kiểm thử
- [ ] PATCH

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-09`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DANG_XAC_MINH → TAM_DINH_CHI có lyDoTamDinhChiVuViec

### Các bước kiểm thử
- [ ] PATCH TAM_DINH_CHI

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-10`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: TAM_DINH_CHI → PHUC_HOI_NGUON_TIN

### Các bước kiểm thử
- [ ] PATCH PHUC_HOI

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-11`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PHUC_HOI_NGUON_TIN → DANG_XAC_MINH

### Các bước kiểm thử
- [ ] PATCH

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-12`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: QUA_HAN auto-set khi deadline < now và status active

### Điều kiện tiên quyết
- deadline qua

### Các bước kiểm thử
- [ ] Trigger cron/list

### Kết quả mong đợi
**UI**:
- Badge overdue

**Side effects** (DB, email, log, queue...):
- Status có thể auto QUA_HAN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: Incidents.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm cron vs flag

---

## TC-084

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Incidents.Decision`
- Yêu cầu: `REQ-INC-DT-01`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Phase mapping cho từng status

### Các bước kiểm thử
- [ ] Tạo 14 incident mỗi status, kiểm tra phase return đúng

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: High
module: Incidents.Decision
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Incidents.Decision`
- Yêu cầu: `REQ-INC-DT-02`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DataScope rules — dispatcher/ĐTV/ward

### Các bước kiểm thử
- [ ] user role, kiểm tra list visible

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: Critical
module: Incidents.Decision
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-01`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SQL Injection trong search

### Các bước kiểm thử
- [ ] ?search=' OR 1=1 --

### Kết quả mong đợi
**API**:
- không leak

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-02`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS trong name + description

### Các bước kiểm thử
- [ ] name='<svg onload=alert(1)>'

### Kết quả mong đợi
**UI**:
- Escape

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-03`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR PATCH /:id/status incident khác team

### Các bước kiểm thử
- [ ] PATCH ngoài scope

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-04`
- Kỹ thuật: `OWASP A08`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mass assignment createdById

### Các bước kiểm thử
- [ ] body có createdById khác

### Kết quả mong đợi
**API**:
- , server set actor thật

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-05`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CSRF POST cross-origin

### Kết quả mong đợi
**API**:
- CORS reject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Critical
module: Incidents.Security
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
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `Incidents.Perf`
- Yêu cầu: `REQ-INC-PERF-01`
- Kỹ thuật: `Performance`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List 1000 incident < 2s

### Điều kiện tiên quyết
- Seed 1000

### Các bước kiểm thử
- [ ] GET /incidents?limit=100

### Kết quả mong đợi
**API**:
- P95 < 2s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: High
module: Incidents.Perf
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
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Incidents.Notify`
- Yêu cầu: `REQ-INC-INT-01`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Assign → SSE notification investigator

### Các bước kiểm thử
- [ ] PATCH /assign

### Kết quả mong đợi
**UI**:
- Bell badge

**API**:
- SSE event INCIDENT_ASSIGNED

**Side effects** (DB, email, log, queue...):
- Notification row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Notify`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Notify`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: High
module: Incidents.Notify
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
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Incidents.Notify`
- Yêu cầu: `REQ-INC-INT-02`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Escalate ward → non-ward emit event INCIDENT_ESCALATED_FROM_WARD

### Các bước kiểm thử
- [ ] Change assignedTeamId ward → non-ward

### Kết quả mong đợi
**API**:
- Event emitted

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Notify`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Notify`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: High
module: Incidents.Notify
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
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-04`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Ward officer tự gán assignedTeamId từ wardTeamId

### Điều kiện tiên quyết
- User ward officer có wardTeamId

### Các bước kiểm thử
- [ ] POST không truyền assignedTeamId

### Kết quả mong đợi
**API**:
- , assignedTeamId=wardTeamId

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: High
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.33

---

## TC-007

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-03`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /incidents/linkable cho Case picker

### Điều kiện tiên quyết
- Có incident unlinked

### Các bước kiểm thử
- [ ] GET /incidents/linkable

### Kết quả mong đợi
**API**:
- , chỉ incident linkedCaseId=null + scope

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: High
module: Incidents.Read
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
- Module: `Incidents.Extend`
- Yêu cầu: `REQ-INC-EXT-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Gia hạn lần 1 trong giới hạn

### Điều kiện tiên quyết
- maxExtensionsSnapshot=2, chưa gia hạn

### Các bước kiểm thử
- [ ] POST /incidents/X/extend body {newDeadline}

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- giaHan1RuleVersionId snapshot

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Extend`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Extend`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: High
module: Incidents.Extend
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Đ.147.2

---

## TC-014

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Incidents.Assign`
- Yêu cầu: `REQ-INC-ASN-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Dispatcher assign investigator → status DANG_XAC_MINH

### Điều kiện tiên quyết
- status=TIEP_NHAN

### Các bước kiểm thử
- [ ] PATCH /incidents/X/assign investigatorId

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- Status auto DANG_XAC_MINH + IncidentAssignedEvent emit

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Assign`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: High
module: Incidents.Assign
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Incidents.Merge`
- Yêu cầu: `REQ-INC-MRG-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Gộp vụ việc A vào B

### Điều kiện tiên quyết
- A status hợp lệ, B chưa terminal

### Các bước kiểm thử
- [ ] PATCH /incidents/A/merge body {targetIncidentId:B}

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- A.status=DA_NHAP_VU_KHAC, petitions+docs relink B

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Merge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Merge`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: High
module: Incidents.Merge
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
- Module: `Incidents.Transfer`
- Yêu cầu: `REQ-INC-TRF-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chuyển đơn vị

### Các bước kiểm thử
- [ ] PATCH /incidents/X/transfer body {chuyenDenDonVi}

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- status=DA_CHUYEN_DON_VI; audit chuyenTu/chuyenDen

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Transfer`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Transfer`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: High
module: Incidents.Transfer
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Stats không strip status filter

### Các bước kiểm thử
- [ ] GET /stats?status=DANG_XAC_MINH

### Kết quả mong đợi
**API**:
- , vẫn count đủ tất cả status (strip filter)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: High
module: Incidents.Read
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: fromDate > toDate

### Các bước kiểm thử
- [ ] fromDate=2026-06-01, toDate=2026-01-01

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Medium
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: name > 255 ký tự

### Các bước kiểm thử
- [ ] name 256 char

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: High
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: sdtNguoiToGiac sai định dạng

### Các bước kiểm thử
- [ ] sdt='abc'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Medium
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: cmndNguoiToGiac không đủ 9/12 số

### Các bước kiểm thử
- [ ] cmnd='123'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Medium
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: investigatorId không thuộc đơn vị

### Các bước kiểm thử
- [ ] investigatorId của đơn vị khác

### Kết quả mong đợi
**API**:
- /403

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: High
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-11`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: phuongThucTiepNhan enum không hợp lệ

### Các bước kiểm thử
- [ ] phuongThucTiepNhan='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Medium
module: Incidents.Create
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-12`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: loaiKetQua không thuộc Wireframe 5

### Các bước kiểm thử
- [ ] loaiKetQua='INVALID'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Medium
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.38.4.0 PR5

---

## TC-046

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Update`
- Yêu cầu: `REQ-INC-UP-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update khi đã soft-delete

### Điều kiện tiên quyết
- deletedAt != null

### Các bước kiểm thử
- [ ] PUT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: High
module: Incidents.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-047

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Transfer`
- Yêu cầu: `REQ-INC-TRF-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Transfer thiếu chuyenDenDonVi

### Các bước kiểm thử
- [ ] PATCH /transfer body {}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Transfer`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Transfer`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: High
module: Incidents.Transfer
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
- Module: `Incidents.Auth`
- Yêu cầu: `REQ-INC-AUTH-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET không JWT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Critical
module: Incidents.Auth
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
- Module: `Incidents.Auth`
- Yêu cầu: `REQ-INC-AUTH-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT expired

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Critical
module: Incidents.Auth
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
- Module: `Incidents.Auth`
- Yêu cầu: `REQ-INC-AUTH-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User không có permission write:Incident

### Các bước kiểm thử
- [ ] POST với role read-only

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Critical
module: Incidents.Auth
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
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-13`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: sourcePetitionId thuộc Petition không trong scope

### Các bước kiểm thử
- [ ] sourcePetitionId không thuộc team user

### Kết quả mong đợi
**API**:
- /403

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: High
module: Incidents.Create
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
- Module: `Incidents.Extend`
- Yêu cầu: `REQ-INC-EXT-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Gia hạn với newDeadline < deadline hiện tại

### Các bước kiểm thử
- [ ] POST extend newDeadline < current

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Extend`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Extend`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: High
module: Incidents.Extend
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: limit > 100

### Các bước kiểm thử
- [ ] ?limit=500

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Incidents.Read
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: phase không hợp lệ

### Các bước kiểm thử
- [ ] ?phase=invalid

### Kết quả mong đợi
**API**:
- hoặc bỏ qua

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Low
module: Incidents.Read
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
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-09`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: sortBy injection

### Các bước kiểm thử
- [ ] sortBy='name; DROP'

### Kết quả mong đợi
**API**:
- whitelist

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: Critical
module: Incidents.Read
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Reason xóa < 10 ký tự

### Các bước kiểm thử
- [ ] reason='abc'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: High
module: Incidents.Delete
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Bulk`
- Yêu cầu: `REQ-INC-BULK-01`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bulk delete vượt rate 5/min

### Các bước kiểm thử
- [ ] POST 6 lần liên tiếp

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Medium
module: Incidents.Bulk
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Export`
- Yêu cầu: `REQ-INC-EXP-01`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export ward không thuộc user

### Các bước kiểm thử
- [ ] GET /export/ward?wardId=khác

### Kết quả mong đợi
**API**:
- nhưng data rỗng / 403

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: High
module: Incidents.Export
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-05`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Status string sai chính tả

### Các bước kiểm thử
- [ ] status='dang_xac_minh' (lowercase)

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Medium
module: Incidents.Status
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Linkable`
- Yêu cầu: `REQ-INC-RD-10`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Linkable trả incident của team khác

### Các bước kiểm thử
- [ ] GET /linkable user Team A

### Kết quả mong đợi
**API**:
- chỉ incident scope A

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Linkable`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Linkable`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Critical
module: Incidents.Linkable
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-061

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-14`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: diaChiXayRa > 500 ký tự

### Các bước kiểm thử
- [ ] address 501 char

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Low
module: Incidents.Create
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-15`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Body JSON malformed

### Các bước kiểm thử
- [ ] body = '{name: "x"' (thiếu })

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Medium
module: Incidents.Create
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-06`
- Kỹ thuật: `Negative State`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Status chuyển từ TAM_DINH_CHI sang DANG_XAC_MINH (không qua PHUC_HOI)

### Điều kiện tiên quyết
- status=TAM_DINH_CHI

### Các bước kiểm thử
- [ ] PATCH status=DANG_XAC_MINH

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Critical
module: Incidents.Status
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Phải qua PHUC_HOI_NGUON_TIN

---

## TC-064

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-01`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name = 5 ký tự (min)

### Các bước kiểm thử
- [ ] name='12345'

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Low
module: Incidents.Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-01`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name = 4 ký tự (min-1)

### Các bước kiểm thử
- [ ] name='1234'

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Low
module: Incidents.Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-07`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: name = 255 ký tự (max)

### Các bước kiểm thử
- [ ] name 255

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Medium
module: Incidents.Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Extend`
- Yêu cầu: `REQ-INC-EXT-04`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Số lần gia hạn = 2 (max)

### Điều kiện tiên quyết
- đã 1 lần

### Các bước kiểm thử
- [ ] extend lần 2

### Kết quả mong đợi
**UI**:
- OK

**API**:

**Side effects** (DB, email, log, queue...):
- giaHan2 snapshot

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Extend`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Extend`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: High
module: Incidents.Extend
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Created cách đây đúng 72h (boundary)

### Điều kiện tiên quyết
- createdAt = now-72h

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:
- hoặc 422 tùy chính sách

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: High
module: Incidents.Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm chính xác

---

## TC-069

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Delete`
- Yêu cầu: `REQ-INC-DEL-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Created cách đây 72h+1s

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: High
module: Incidents.Delete
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-07`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=1

### Các bước kiểm thử
- [ ] ?limit=1

### Kết quả mong đợi
**API**:
- row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Low
module: Incidents.Read
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-07`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=100

### Các bước kiểm thử
- [ ] ?limit=100

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Low
module: Incidents.Read
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-EP-01`
- Kỹ thuật: `EP`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VALID_TRANSITIONS — phủ tất cả 14 status start

### Các bước kiểm thử
- [ ] Test mọi transition hợp lệ từng status

### Kết quả mong đợi
**API**:
- cho hợp lệ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: High
module: Incidents.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-073

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-EP-01`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: lyDoKhongKhoiTo — 7 enum giá trị

### Các bước kiểm thử
- [ ] Test mỗi enum

### Dữ liệu kiểm thử
```
7 giá trị
```

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: Medium
module: Incidents.Create
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-EP-02`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: phuongThucTiepNhan — 5 enum TT28

### Các bước kiểm thử
- [ ] Test

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Low
module: Incidents.Create
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-EP-03`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: 4 phase × empty/filled scope

### Các bước kiểm thử
- [ ] ?phase=tiep-nhan|xac-minh|ket-qua|tam-dinh-chi

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Medium
module: Incidents.Read
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
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-13`
- Kỹ thuật: `State`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: TDC_HET_THOI_HIEU là terminal

### Điều kiện tiên quyết
- status=TDC_HET_THOI_HIEU

### Các bước kiểm thử
- [ ] PATCH bất kỳ

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: High
module: Incidents.State
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
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Incidents.State`
- Yêu cầu: `REQ-INC-ST-14`
- Kỹ thuật: `State`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DA_NHAP_VU_KHAC sau merge — không edit

### Các bước kiểm thử
- [ ] PUT update

### Kết quả mong đợi
**UI**:
- Disable form

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: Medium
module: Incidents.State
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-06`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Insecure direct file path trong export

### Các bước kiểm thử
- [ ] ?fileName=../../etc/passwd

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: High
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-07`
- Kỹ thuật: `OWASP A07`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tampering Authorization header

### Các bước kiểm thử
- [ ] Token sửa userId

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-08`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Privilege escalation qua assign endpoint

### Các bước kiểm thử
- [ ] PATCH /assign by non-dispatcher

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-09`
- Kỹ thuật: `OWASP A04`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Rate limit list endpoint

### Các bước kiểm thử
- [ ] req/min

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: High
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-10`
- Kỹ thuật: `OWASP A02`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Sensitive PII leak — sdt + cmnd trong journey API

### Các bước kiểm thử
- [ ] GET /journey trong vai trò xem khác đơn vị

### Kết quả mong đợi
**API**:
- /mask

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: Critical
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-11`
- Kỹ thuật: `OWASP A05`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Open redirect qua returnPath param

### Các bước kiểm thử
- [ ] /incidents?returnPath=http://evil.com

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Front-end whitelist

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: Medium
module: Incidents.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-12`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tampering with expectedUpdatedAt to force overwrite

### Các bước kiểm thử
- [ ] PUT expectedUpdatedAt='9999-12-31'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: High
module: Incidents.Security
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Incidents.Data`
- Yêu cầu: `REQ-INC-DATA-01`
- Kỹ thuật: `i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Unicode + diacritics trong name

### Các bước kiểm thử
- [ ] name='Vụ trộm xe đạp ÀẢẠ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Medium
module: Incidents.Data
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Incidents.Data`
- Yêu cầu: `REQ-INC-DATA-02`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Trim space leading/trailing

### Các bước kiểm thử
- [ ] name='  abc  '

### Kết quả mong đợi
**API**:
- trimmed

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Low
module: Incidents.Data
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Incidents.Data`
- Yêu cầu: `REQ-INC-DATA-03`
- Kỹ thuật: `i18n`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Date format trả về UTC+7 frontend

### Các bước kiểm thử
- [ ] GET /incidents/X

### Kết quả mong đợi
**UI**:
- Hiển thị giờ VN

**API**:
- deadline ISO

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Medium
module: Incidents.Data
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
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Incidents.Race`
- Yêu cầu: `REQ-INC-EDGE-01`
- Kỹ thuật: `Race`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: 2 user concurrent prosecute cùng incident

### Các bước kiểm thử
- [ ] Concurrent POST /prosecute

### Kết quả mong đợi
**API**:
- thành công, 1 409/422

**Side effects** (DB, email, log, queue...):
- Không tạo 2 Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Race`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Race`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: Critical
module: Incidents.Race
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
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Incidents.Merge`
- Yêu cầu: `REQ-INC-EDGE-02`
- Kỹ thuật: `Race`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merge khi target đang được edit

### Các bước kiểm thử
- [ ] Merge song song edit target

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Merge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Merge`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: High
module: Incidents.Merge
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
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-01`
- Kỹ thuật: `WCAG 2.1.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form keyboard navigation

### Các bước kiểm thử
- [ ] Tab xuyên form

### Kết quả mong đợi
**UI**:
- Focus ring

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: High
module: Incidents.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-107

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-02`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Label đầy đủ cho enum select

### Kết quả mong đợi
**UI**:
- <label htmlFor>

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: High
module: Incidents.UI
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
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-03`
- Kỹ thuật: `WCAG 1.4.3`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Contrast 14 status badge ≥ 4.5:1

### Kết quả mong đợi
**UI**:
- Pass AA

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Medium
module: Incidents.UI
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-01`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome 130 Win

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: High
module: Incidents.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-113

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-02`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Firefox 130 macOS

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: Incidents.UI
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-03`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Edge 130

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Medium
module: Incidents.UI
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-04`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Safari iOS

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: Medium
module: Incidents.UI
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-05`
- Kỹ thuật: `Responsive`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mobile 375x667

### Kết quả mong đợi
**UI**:
- Drawer + form fits

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: High
module: Incidents.UI
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
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Incidents.Perf`
- Yêu cầu: `REQ-INC-PERF-02`
- Kỹ thuật: `Load`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: 50 concurrent stats

### Các bước kiểm thử
- [ ] K6 50 VU

### Kết quả mong đợi
**API**:
- P95 < 1s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: High
module: Incidents.Perf
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
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: `Incidents.Journey`
- Yêu cầu: `REQ-INC-INT-03`
- Kỹ thuật: `Integration`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Journey combine statusHistory + AuditLog

### Các bước kiểm thử
- [ ] GET /journey

### Kết quả mong đợi
**UI**:
- Timeline đầy đủ

**API**:
- events sorted

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Journey`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Journey`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: High
module: Incidents.Journey
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-11`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET /:id incident đã soft-delete bằng user thường

### Điều kiện tiên quyết
- deletedAt!=null

### Các bước kiểm thử
- [ ] GET /incidents/X

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Medium
module: Incidents.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-125

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Prosecute`
- Yêu cầu: `REQ-INC-PROS-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Prosecute với prosecutionDecision không hợp lệ

### Các bước kiểm thử
- [ ] prosecutionDecision='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Prosecute`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Prosecute`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: High
module: Incidents.Prosecute
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-126

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Bulk`
- Yêu cầu: `REQ-INC-BULK-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bulk delete ids gồm incident terminal

### Các bước kiểm thử
- [ ] POST /bulk-delete

### Kết quả mong đợi
**API**:
- /partial

**Side effects** (DB, email, log, queue...):
- Chỉ xóa TIEP_NHAN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: High
module: Incidents.Bulk
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-127

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-16`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Body có field không tồn tại — strict mode

### Các bước kiểm thử
- [ ] body có field 'unknown'

### Kết quả mong đợi
**API**:
- hoặc bỏ qua

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Low
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-128

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Merge`
- Yêu cầu: `REQ-INC-MRG-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merge khi A và B khác đơn vị

### Các bước kiểm thử
- [ ] PATCH /A/merge target khác đơn vị

### Kết quả mong đợi
**API**:
- /422

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Merge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Merge`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: High
module: Incidents.Merge
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-129

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-12`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Search SQL keyword UNION

### Các bước kiểm thử
- [ ] ?search='UNION SELECT'

### Kết quả mong đợi
**API**:
- không leak

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: Medium
module: Incidents.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-130

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-13`
- Kỹ thuật: `OWASP A09`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Insufficient logging — không log failed assign attempt

### Các bước kiểm thử
- [ ] PATCH /assign by non-dispatcher

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog ghi attempt

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: High
module: Incidents.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-131

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-07`
- Kỹ thuật: `WCAG 2.4.3`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tab order trong form Phase 4 sections logic

### Các bước kiểm thử
- [ ] Tab xuyên 4 section

### Kết quả mong đợi
**UI**:
- Thứ tự đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: Medium
module: Incidents.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-133

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-17`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: deadline trong quá khứ

### Các bước kiểm thử
- [ ] deadline=2020-01-01

### Kết quả mong đợi
**UI**:
- Cảnh báo / lỗi

**API**:
- hoặc flag overdue

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: Medium
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-134

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-RD-13`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Filter trangThaiThoiHieu enum không hợp lệ

### Các bước kiểm thử
- [ ] ?tinhTrangThoiHieu='X'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: Low
module: Incidents.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-135

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Update`
- Yêu cầu: `REQ-INC-UP-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đổi status qua PUT thay vì PATCH /status

### Các bước kiểm thử
- [ ] PUT body có status

### Kết quả mong đợi
**API**:
- ignore status field hoặc 400

**Side effects** (DB, email, log, queue...):
- Không tạo statusHistory

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: High
module: Incidents.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-136

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Incidents.Security`
- Yêu cầu: `REQ-INC-SEC-14`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Time-based timing attack — phân biệt 404 vs 403

### Các bước kiểm thử
- [ ] GET id tồn tại khác scope vs id không tồn tại — đo response time

### Kết quả mong đợi
**API**:
- Cả 2 ≈ 404 same timing

**Side effects** (DB, email, log, queue...):
- Không leak existence

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: High
module: Incidents.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-137

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Create`
- Yêu cầu: `REQ-INC-CR-18`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo incident với canBoNhapId user khác đơn vị

### Các bước kiểm thử
- [ ] canBoNhapId outside scope

### Kết quả mong đợi
**API**:
- /403

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: High
module: Incidents.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-138

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Incidents.Status`
- Yêu cầu: `REQ-INC-ST-15`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PATCH /status request body rỗng

### Các bước kiểm thử
- [ ] PATCH /status body={}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Status`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Status`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: Low
module: Incidents.Status
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
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Incidents.Data`
- Yêu cầu: `REQ-INC-DATA-04`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Empty string vs null phân biệt

### Các bước kiểm thử
- [ ] description=''

### Kết quả mong đợi
**API**:
- null hoặc empty đồng nhất

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: Low
module: Incidents.Data
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
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Incidents.Data`
- Yêu cầu: `REQ-INC-DATA-05`
- Kỹ thuật: `Validation`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Email format trong contact field

### Các bước kiểm thử
- [ ] invalid email format

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: Low
module: Incidents.Data
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
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `Incidents.Read`
- Yêu cầu: `REQ-INC-EDGE-03`
- Kỹ thuật: `Empty`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Stats khi DB rỗng

### Các bước kiểm thử
- [ ] GET /stats

### Kết quả mong đợi
**UI**:
- All chips=0

**API**:
- mọi key=0

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: Low
module: Incidents.Read
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-04`
- Kỹ thuật: `WCAG 4.1.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Confirm dialog merge có aria-modal

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Medium
module: Incidents.UI
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-05`
- Kỹ thuật: `WCAG 4.1.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Error live region announce

### Kết quả mong đợi
**UI**:
- aria-live=assertive cho server error

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Medium
module: Incidents.UI
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-A11Y-06`
- Kỹ thuật: `WCAG 4.1.2`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Icon-only buttons có aria-label

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: Medium
module: Incidents.UI
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-06`
- Kỹ thuật: `Responsive`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tablet 768x1024

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: Low
module: Incidents.UI
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
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Incidents.Perf`
- Yêu cầu: `REQ-INC-PERF-03`
- Kỹ thuật: `Stress`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export ward 2000 record

### Các bước kiểm thử
- [ ] GET /export/ward

### Kết quả mong đợi
**API**:
- , < 30s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Medium
module: Incidents.Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-132

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Incidents.UI`
- Yêu cầu: `REQ-INC-COMPAT-07`
- Kỹ thuật: `Responsive`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Android Chrome 5'' viewport

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Incidents.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Incidents.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: Low
module: Incidents.UI
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

- [ ] **TC-001** [P0] Tạo vụ việc mới hợp lệ với name + loaiDonVu + nguonPhatTin
- [ ] **TC-002** [P0] Auto-gen code VV-YYYY-NNN
- [ ] **TC-003** [P0] Auto-calc deadline theo THOI_HAN_XAC_MINH rule
- [ ] **TC-005** [P0] List vụ việc default pagination
- [ ] **TC-006** [P0] Filter theo phase=xac-minh
- [ ] **TC-008** [P0] GET stats exhaustive trả về tất cả status keys
- [ ] **TC-009** [P0] PUT update vụ việc với expectedUpdatedAt
- [ ] **TC-010** [P0] PATCH status TIEP_NHAN → DANG_XAC_MINH
- [ ] **TC-011** [P0] PATCH KHONG_KHOI_TO kèm lyDoKhongKhoiTo (Đ.157)
- [ ] **TC-012** [P0] Khởi tố vụ việc → tạo Case (Branch-3)
- [ ] **TC-017** [P0] Soft-delete TIEP_NHAN bởi creator trong 72h
- [ ] **TC-018** [P0] ADMIN restore
- [ ] **TC-019** [P0] name < 5 ký tự
- [ ] **TC-020** [P0] nguonPhatTin không khớp loaiDonVu
- [ ] **TC-021** [P0] Transition không nằm trong VALID_TRANSITIONS
- [ ] **TC-022** [P0] KHONG_KHOI_TO thiếu lyDoKhongKhoiTo
- [ ] **TC-023** [P0] Chuyển từ terminal status (DA_GIAI_QUYET)
- [ ] **TC-024** [P0] Gia hạn quá maxExtensionsSnapshot (lần 3)
- [ ] **TC-025** [P0] Xóa có linked petitions
- [ ] **TC-026** [P0] Xóa có attached documents
- [ ] **TC-027** [P0] Xóa khi status != TIEP_NHAN
- [ ] **TC-028** [P0] Quá 72h kể từ created
- [ ] **TC-029** [P0] Non-creator non-admin xóa
- [ ] **TC-030** [P0] Non-dispatcher assign
- [ ] **TC-031** [P0] Prosecute thiếu caseName
- [ ] **TC-032** [P0] Prosecute incident đã DA_CHUYEN_VU_AN
- [ ] **TC-033** [P0] Merge vào chính nó (self)
- [ ] **TC-034** [P0] Merge vào incident terminal
- [ ] **TC-035** [P0] User ĐTV Team A xem incident Team B (DataScope)
- [ ] **TC-036** [P0] Update với expectedUpdatedAt stale
- [ ] **TC-037** [P0] Non-ADMIN restore
- [ ] **TC-076** [P0] TIEP_NHAN → DA_PHAN_CONG (skip xác minh)
- [ ] **TC-077** [P0] DA_PHAN_CONG → CHUYEN_XPHC
- [ ] **TC-078** [P0] DANG_XAC_MINH → TAM_DINH_CHI có lyDoTamDinhChiVuViec
- [ ] **TC-079** [P0] TAM_DINH_CHI → PHUC_HOI_NGUON_TIN
- [ ] **TC-080** [P0] PHUC_HOI_NGUON_TIN → DANG_XAC_MINH
- [ ] **TC-081** [P0] QUA_HAN auto-set khi deadline < now và status active
- [ ] **TC-084** [P0] Phase mapping cho từng status
- [ ] **TC-085** [P0] DataScope rules — dispatcher/ĐTV/ward
- [ ] **TC-086** [P0] SQL Injection trong search
- [ ] **TC-087** [P0] XSS trong name + description
- [ ] **TC-088** [P0] IDOR PATCH /:id/status incident khác team
- [ ] **TC-089** [P0] Mass assignment createdById
- [ ] **TC-090** [P0] CSRF POST cross-origin
- [ ] **TC-118** [P0] List 1000 incident < 2s
- [ ] **TC-121** [P0] Assign → SSE notification investigator
- [ ] **TC-122** [P0] Escalate ward → non-ward emit event INCIDENT_ESCALATED_FROM_WARD
- [ ] **TC-004** [P1] Ward officer tự gán assignedTeamId từ wardTeamId
- [ ] **TC-007** [P1] GET /incidents/linkable cho Case picker
- [ ] **TC-013** [P1] Gia hạn lần 1 trong giới hạn
- [ ] **TC-014** [P1] Dispatcher assign investigator → status DANG_XAC_MINH
- [ ] **TC-015** [P1] Gộp vụ việc A vào B
- [ ] **TC-016** [P1] Chuyển đơn vị
- [ ] **TC-038** [P1] Stats không strip status filter
- [ ] **TC-039** [P1] fromDate > toDate
- [ ] **TC-040** [P1] name > 255 ký tự
- [ ] **TC-041** [P1] sdtNguoiToGiac sai định dạng
- [ ] **TC-042** [P1] cmndNguoiToGiac không đủ 9/12 số
- [ ] **TC-043** [P1] investigatorId không thuộc đơn vị
- [ ] **TC-044** [P1] phuongThucTiepNhan enum không hợp lệ
- [ ] **TC-045** [P1] loaiKetQua không thuộc Wireframe 5
- [ ] **TC-046** [P1] Update khi đã soft-delete
- [ ] **TC-047** [P1] Transfer thiếu chuyenDenDonVi
- [ ] **TC-048** [P1] GET không JWT
- [ ] **TC-049** [P1] JWT expired
- [ ] **TC-050** [P1] User không có permission write:Incident
- [ ] **TC-051** [P1] sourcePetitionId thuộc Petition không trong scope
- [ ] **TC-052** [P1] Gia hạn với newDeadline < deadline hiện tại
- [ ] **TC-053** [P1] limit > 100
- [ ] **TC-054** [P1] phase không hợp lệ
- [ ] **TC-055** [P1] sortBy injection
- [ ] **TC-056** [P1] Reason xóa < 10 ký tự
- [ ] **TC-057** [P1] Bulk delete vượt rate 5/min
- [ ] **TC-058** [P1] Export ward không thuộc user
- [ ] **TC-059** [P1] Status string sai chính tả
- [ ] **TC-060** [P1] Linkable trả incident của team khác
- [ ] **TC-061** [P1] diaChiXayRa > 500 ký tự
- [ ] **TC-062** [P1] Body JSON malformed
- [ ] **TC-063** [P1] Status chuyển từ TAM_DINH_CHI sang DANG_XAC_MINH (không qua PHUC_HOI)
- [ ] **TC-064** [P1] name = 5 ký tự (min)
- [ ] **TC-065** [P1] name = 4 ký tự (min-1)
- [ ] **TC-066** [P1] name = 255 ký tự (max)
- [ ] **TC-067** [P1] Số lần gia hạn = 2 (max)
- [ ] **TC-068** [P1] Created cách đây đúng 72h (boundary)
- [ ] **TC-069** [P1] Created cách đây 72h+1s
- [ ] **TC-070** [P1] limit=1
- [ ] **TC-071** [P1] limit=100
- [ ] **TC-072** [P1] VALID_TRANSITIONS — phủ tất cả 14 status start
- [ ] **TC-073** [P1] lyDoKhongKhoiTo — 7 enum giá trị
- [ ] **TC-074** [P1] phuongThucTiepNhan — 5 enum TT28
- [ ] **TC-075** [P1] 4 phase × empty/filled scope
- [ ] **TC-082** [P1] TDC_HET_THOI_HIEU là terminal
- [ ] **TC-083** [P1] DA_NHAP_VU_KHAC sau merge — không edit
- [ ] **TC-091** [P1] Insecure direct file path trong export
- [ ] **TC-092** [P1] Tampering Authorization header
- [ ] **TC-093** [P1] Privilege escalation qua assign endpoint
- [ ] **TC-094** [P1] Rate limit list endpoint
- [ ] **TC-095** [P1] Sensitive PII leak — sdt + cmnd trong journey API
- [ ] **TC-096** [P1] Open redirect qua returnPath param
- [ ] **TC-097** [P1] Tampering with expectedUpdatedAt to force overwrite
- [ ] **TC-098** [P1] Unicode + diacritics trong name
- [ ] **TC-099** [P1] Trim space leading/trailing
- [ ] **TC-100** [P1] Date format trả về UTC+7 frontend
- [ ] **TC-103** [P1] 2 user concurrent prosecute cùng incident
- [ ] **TC-104** [P1] Merge khi target đang được edit
- [ ] **TC-106** [P1] Form keyboard navigation
- [ ] **TC-107** [P1] Label đầy đủ cho enum select
- [ ] **TC-108** [P1] Contrast 14 status badge ≥ 4.5:1
- [ ] **TC-112** [P1] Chrome 130 Win
- [ ] **TC-113** [P1] Firefox 130 macOS
- [ ] **TC-114** [P1] Edge 130
- [ ] **TC-115** [P1] Safari iOS
- [ ] **TC-116** [P1] Mobile 375x667
- [ ] **TC-119** [P1] 50 concurrent stats
- [ ] **TC-123** [P1] Journey combine statusHistory + AuditLog
- [ ] **TC-124** [P1] GET /:id incident đã soft-delete bằng user thường
- [ ] **TC-125** [P1] Prosecute với prosecutionDecision không hợp lệ
- [ ] **TC-126** [P1] Bulk delete ids gồm incident terminal
- [ ] **TC-127** [P1] Body có field không tồn tại — strict mode
- [ ] **TC-128** [P1] Merge khi A và B khác đơn vị
- [ ] **TC-129** [P1] Search SQL keyword UNION
- [ ] **TC-130** [P1] Insufficient logging — không log failed assign attempt
- [ ] **TC-131** [P1] Tab order trong form Phase 4 sections logic
- [ ] **TC-133** [P1] deadline trong quá khứ
- [ ] **TC-134** [P1] Filter trangThaiThoiHieu enum không hợp lệ
- [ ] **TC-135** [P1] Đổi status qua PUT thay vì PATCH /status
- [ ] **TC-136** [P1] Time-based timing attack — phân biệt 404 vs 403
- [ ] **TC-137** [P1] Tạo incident với canBoNhapId user khác đơn vị
- [ ] **TC-138** [P1] PATCH /status request body rỗng
- [ ] **TC-101** [P2] Empty string vs null phân biệt
- [ ] **TC-102** [P2] Email format trong contact field
- [ ] **TC-105** [P2] Stats khi DB rỗng
- [ ] **TC-109** [P2] Confirm dialog merge có aria-modal
- [ ] **TC-110** [P2] Error live region announce
- [ ] **TC-111** [P2] Icon-only buttons có aria-label
- [ ] **TC-117** [P2] Tablet 768x1024
- [ ] **TC-120** [P2] Export ward 2000 record
- [ ] **TC-132** [P2] Android Chrome 5'' viewport

---

_Generated by `uat-test-writer` skill on 30/05/2026 22:02_