# UAT Test Cases — Quản lý Đơn thư (Petitions)

**Generated**: 30/05/2026 22:03  
**Complexity**: `complex`  
**Total TC**: 141  
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

**Tổng số TC**: 141

**Phân bố loại**:
- `RED`: 57
- `GREEN`: 20
- `SECURITY`: 15
- `A11Y`: 8
- `COMPAT`: 8
- `BOUNDARY`: 7
- `STATE`: 6
- `DATA`: 5
- `EP`: 4
- `PERFORMANCE`: 3
- `INTEGRATION`: 3
- `EDGE`: 3
- `DECISION`: 2

**Phân bố priority**:
- 🔴 `P0`: 48
- 🟠 `P1`: 81
- 🟡 `P2`: 12

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 42
- ⚠️ `High`: 43
- ⚡ `Medium`: 28
- 📌 `Low`: 28

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `A-01` | `dtv.pet.a@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team A | ACTIVE | DataScope |
| `A-02` | `dtv.pet.b@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team B | ACTIVE | IDOR |
| `A-03` | `dispatcher.pet@pc02hcm.com` | `Pa$$w0rd!` | Dispatcher | ACTIVE | Assign |
| `A-04` | `admin@pc02.local` | `Admin@2026` | ADMIN | ACTIVE | Restore |
| `A-05` | `ward.pet@pc02hcm.com` | `Pa$$w0rd!` | Cán bộ phường | ACTIVE | Ward intake |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| senderName | `1 char` | `min` | **OK** |  |
| senderName | `255` | `max` | **OK** |  |
| senderName | `256` | `max+1` | **400** |  |
| summary | `2000` | `max` | **OK** |  |
| summary | `2001` | `max+1` | **400** |  |
| limit | `1` | `min` | **OK** |  |
| limit | `100` | `max` | **OK** |  |
| limit | `101` | `max+1` | **400** |  |
| listLinkable.limit | `50` | `default` | **OK** |  |
| STT year rollover | `DT-2025-99999 → DT-2026-00001` | `boundary` | **OK** |  |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
|  | `' OR 1=1 --` |  | 200 | `` |
|  | `<script>alert(1)</script>` |  | Escape | `` |
|  | `<iframe src='javascript:alert(1)'></iframe>` |  | Strip | `` |
|  | `id; DROP` |  | 400 | `` |
|  | `../../etc/passwd` |  | 400 | `` |
|  | `<other-id>` |  | Ignored | `` |
|  | `http://evil.com` |  | Block | `` |
|  | `DROP TABLE petitions` |  | 201 safe | `` |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Petitions.Create | Tạo đơn TO_CAO hợp lệ tự sinh STT | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Petitions.Create | Tạo đơn KHIEU_NAI hợp lệ | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Petitions.Create | Tạo đơn KIEN_NGHI | ⚠️ High |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | Petitions.Create | Tạo đơn PHAN_ANH | ⚠️ High |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | Petitions.Read | List đơn thư default | ⚠️ High |
| [TC-008](#tc-008) | 🔴 P0 | `GREEN` | Petitions.Read | Filter theo status MOI_TIEP_NHAN | ⚠️ High |
| [TC-009](#tc-009) | 🔴 P0 | `GREEN` | Petitions.Read | Search theo stt + senderName | ⚡ Medium |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | Petitions.Read | GET /petitions/:id (route alias v0.67.1) | 🚨 Critical |
| [TC-012](#tc-012) | 🔴 P0 | `GREEN` | Petitions.Update | PUT update đơn thư với expectedUpdatedAt | 🚨 Critical |
| [TC-013](#tc-013) | 🔴 P0 | `GREEN` | Petitions.Convert | Convert đơn thư → Vụ án (atomic) | 🚨 Critical |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` | Petitions.Convert | Convert → Vụ việc | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `GREEN` | Petitions.Delete | Soft-delete đơn thư | ⚠️ High |
| [TC-019](#tc-019) | 🔴 P0 | `GREEN` | Petitions.Restore | ADMIN restore | ⚠️ High |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | Petitions.Create | Thiếu senderName | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | Petitions.Create | Thiếu petitionType | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | Petitions.Create | petitionType không thuộc enum | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | Petitions.Create | receivedDate tương lai | ⚡ Medium |
| [TC-025](#tc-025) | 🔴 P0 | `RED` | Petitions.Create | STT trùng (manual) | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | Petitions.Create | senderEmail format sai | ⚡ Medium |
| [TC-027](#tc-027) | 🔴 P0 | `RED` | Petitions.Create | senderPhone format sai | ⚡ Medium |
| [TC-028](#tc-028) | 🔴 P0 | `RED` | Petitions.Update | OCC stale expectedUpdatedAt | 🚨 Critical |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | Petitions.Convert | Convert đơn đã linked Case | 🚨 Critical |
| [TC-030](#tc-030) | 🔴 P0 | `RED` | Petitions.Convert | Convert thiếu caseName | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `RED` | Petitions.Convert | Convert thiếu expectedUpdatedAt (chống race) | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `RED` | Petitions.Convert | Convert đơn đã soft-delete | ⚠️ High |
| [TC-033](#tc-033) | 🔴 P0 | `RED` | Petitions.Convert | Convert với jurisdiction enum sai | ⚠️ High |
| [TC-034](#tc-034) | 🔴 P0 | `RED` | Petitions.Auth | GET không JWT | 🚨 Critical |
| [TC-035](#tc-035) | 🔴 P0 | `RED` | Petitions.Auth | User không có read:Petition | 🚨 Critical |
| [TC-036](#tc-036) | 🔴 P0 | `RED` | Petitions.Delete | Non-creator non-admin xóa | 🚨 Critical |
| [TC-037](#tc-037) | 🔴 P0 | `RED` | Petitions.Delete | Xóa đơn đã DA_CHUYEN_VU_AN | ⚠️ High |
| [TC-038](#tc-038) | 🔴 P0 | `RED` | Petitions.Restore | Non-ADMIN restore | 🚨 Critical |
| [TC-039](#tc-039) | 🔴 P0 | `RED` | Petitions.Read | User Team A xem petition Team B | 🚨 Critical |
| [TC-076](#tc-076) | 🔴 P0 | `STATE` | Petitions.State | MOI_TIEP_NHAN → DANG_XU_LY | ⚠️ High |
| [TC-077](#tc-077) | 🔴 P0 | `STATE` | Petitions.State | DANG_XU_LY → CHO_PHE_DUYET | ⚠️ High |
| [TC-078](#tc-078) | 🔴 P0 | `STATE` | Petitions.State | CHO_PHE_DUYET → DA_GIAI_QUYET | ⚠️ High |
| [TC-079](#tc-079) | 🔴 P0 | `STATE` | Petitions.State | Convert-case auto đặt status=DA_CHUYEN_VU_AN | 🚨 Critical |
| [TC-080](#tc-080) | 🔴 P0 | `STATE` | Petitions.State | Convert-incident auto đặt status=DA_CHUYEN_VU_VIEC | 🚨 Critical |
| [TC-082](#tc-082) | 🔴 P0 | `DECISION` | Petitions.Decision | Deadline auto-calc theo petitionType (DT) | 🚨 Critical |
| [TC-083](#tc-083) | 🔴 P0 | `DECISION` | Petitions.Decision | DataScope filter — 4 role combinations | 🚨 Critical |
| [TC-084](#tc-084) | 🔴 P0 | `SECURITY` | Petitions.Security | SQL Injection trong search | 🚨 Critical |
| [TC-085](#tc-085) | 🔴 P0 | `SECURITY` | Petitions.Security | XSS senderName | 🚨 Critical |
| [TC-086](#tc-086) | 🔴 P0 | `SECURITY` | Petitions.Security | XSS detailContent (RichText) | 🚨 Critical |
| [TC-087](#tc-087) | 🔴 P0 | `SECURITY` | Petitions.Security | IDOR GET /:id khác team | 🚨 Critical |
| [TC-088](#tc-088) | 🔴 P0 | `SECURITY` | Petitions.Security | Mass assignment enteredById | 🚨 Critical |
| [TC-089](#tc-089) | 🔴 P0 | `SECURITY` | Petitions.Security | CSRF POST cross-origin | 🚨 Critical |
| [TC-117](#tc-117) | 🔴 P0 | `PERFORMANCE` | Petitions.Perf | List 1000 đơn < 2s | ⚠️ High |
| [TC-120](#tc-120) | 🔴 P0 | `INTEGRATION` | Petitions.Doc | STT auto-gen + DocumentNumberLog ghi đầy đủ | 🚨 Critical |
| [TC-121](#tc-121) | 🔴 P0 | `INTEGRATION` | Petitions.Notify | Assign → notification cho assignedToId | ⚠️ High |
| [TC-005](#tc-005) | 🟠 P1 | `GREEN` | Petitions.Create | Ward officer tự gán assignedTeamId | ⚠️ High |
| [TC-006](#tc-006) | 🟠 P1 | `GREEN` | Petitions.Create | Draft STT preview trước save | ⚡ Medium |
| [TC-010](#tc-010) | 🟠 P1 | `GREEN` | Petitions.Read | GET /linkable | ⚠️ High |
| [TC-015](#tc-015) | 🟠 P1 | `GREEN` | Petitions.Assign | Dispatcher assign đơn thư | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `GREEN` | Petitions.Export | Export Excel danh sách | ⚡ Medium |
| [TC-017](#tc-017) | 🟠 P1 | `GREEN` | Petitions.Export | Export document Word (PHIEU_DE_XUAT) | ⚠️ High |
| [TC-040](#tc-040) | 🟠 P1 | `RED` | Petitions.Read | limit > 100 | ⚡ Medium |
| [TC-041](#tc-041) | 🟠 P1 | `RED` | Petitions.Read | fromDate > toDate | ⚡ Medium |
| [TC-042](#tc-042) | 🟠 P1 | `RED` | Petitions.Assign | Non-dispatcher assign | 🚨 Critical |
| [TC-043](#tc-043) | 🟠 P1 | `RED` | Petitions.Assign | Assign thiếu assignedTeamId | ⚠️ High |
| [TC-044](#tc-044) | 🟠 P1 | `RED` | Petitions.Export | export-document docType không thuộc 6 template | ⚠️ High |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | Petitions.Export | Batch export ZIP với 0 ids | 📌 Low |
| [TC-046](#tc-046) | 🟠 P1 | `RED` | Petitions.Create | detailContent có HTML/script không sanitize | 🚨 Critical |
| [TC-047](#tc-047) | 🟠 P1 | `RED` | Petitions.Create | Senderr name > 255 ký tự | ⚡ Medium |
| [TC-048](#tc-048) | 🟠 P1 | `RED` | Petitions.Create | summary > 2000 ký tự | 📌 Low |
| [TC-049](#tc-049) | 🟠 P1 | `RED` | Petitions.Create | assignedToId không tồn tại | ⚠️ High |
| [TC-050](#tc-050) | 🟠 P1 | `RED` | Petitions.Create | deadline tự nhập < receivedDate | ⚡ Medium |
| [TC-051](#tc-051) | 🟠 P1 | `RED` | Petitions.Update | Update đơn đã soft-delete | ⚠️ High |
| [TC-052](#tc-052) | 🟠 P1 | `RED` | Petitions.Read | sortBy injection | 🚨 Critical |
| [TC-053](#tc-053) | 🟠 P1 | `RED` | Petitions.Read | Export rate limit 5/min | ⚡ Medium |
| [TC-054](#tc-054) | 🟠 P1 | `RED` | Petitions.Convert | Convert race — 2 user cùng convert | 🚨 Critical |
| [TC-055](#tc-055) | 🟠 P1 | `RED` | Petitions.Bulk | Bulk assign khác đơn vị | ⚠️ High |
| [TC-056](#tc-056) | 🟠 P1 | `RED` | Petitions.Bulk | Bulk delete >100 ids | ⚡ Medium |
| [TC-057](#tc-057) | 🟠 P1 | `RED` | Petitions.Read | GET stats với status filter — phải strip | ⚠️ High |
| [TC-058](#tc-058) | 🟠 P1 | `RED` | Petitions.Create | DocumentNumberEngine fail giữa transaction | 🚨 Critical |
| [TC-059](#tc-059) | 🟠 P1 | `RED` | Petitions.Create | unit > 255 ký tự | 📌 Low |
| [TC-060](#tc-060) | 🟠 P1 | `RED` | Petitions.Export | export-word legacy bị disable | 📌 Low |
| [TC-061](#tc-061) | 🟠 P1 | `RED` | Petitions.Create | Tạo đơn có notes chứa SQL keyword | 🚨 Critical |
| [TC-062](#tc-062) | 🟠 P1 | `RED` | Petitions.Create | baoCaoBanGiamDoc enum không hợp lệ | 📌 Low |
| [TC-063](#tc-063) | 🟠 P1 | `RED` | Petitions.Read | Cache HIT ở user A leak data sang user B | 🚨 Critical |
| [TC-064](#tc-064) | 🟠 P1 | `RED` | Petitions.Read | Search với % wildcard SQL | ⚡ Medium |
| [TC-065](#tc-065) | 🟠 P1 | `BOUNDARY` | Petitions.Create | senderName = 1 ký tự (min) | 📌 Low |
| [TC-066](#tc-066) | 🟠 P1 | `BOUNDARY` | Petitions.Create | senderName = 255 (max) | 📌 Low |
| [TC-067](#tc-067) | 🟠 P1 | `BOUNDARY` | Petitions.Create | summary = 2000 (max) | 📌 Low |
| [TC-068](#tc-068) | 🟠 P1 | `BOUNDARY` | Petitions.Read | limit=1 | 📌 Low |
| [TC-069](#tc-069) | 🟠 P1 | `BOUNDARY` | Petitions.Read | limit=100 | 📌 Low |
| [TC-070](#tc-070) | 🟠 P1 | `BOUNDARY` | Petitions.Read | listLinkable limit=50 default | 📌 Low |
| [TC-071](#tc-071) | 🟠 P1 | `BOUNDARY` | Petitions.Create | STT counter rollover năm mới | ⚠️ High |
| [TC-072](#tc-072) | 🟠 P1 | `EP` | Petitions.Read | status 7 partition | ⚡ Medium |
| [TC-073](#tc-073) | 🟠 P1 | `EP` | Petitions.Create | petitionType 4 partition | ⚠️ High |
| [TC-074](#tc-074) | 🟠 P1 | `EP` | Petitions.Read | overdue=true vs false | 📌 Low |
| [TC-075](#tc-075) | 🟠 P1 | `EP` | Petitions.Export | docType 6 template values | ⚠️ High |
| [TC-081](#tc-081) | 🟠 P1 | `STATE` | Petitions.State | DA_LUU_DON là terminal | ⚠️ High |
| [TC-090](#tc-090) | 🟠 P1 | `SECURITY` | Petitions.Security | Path traversal export filename | ⚠️ High |
| [TC-091](#tc-091) | 🟠 P1 | `SECURITY` | Petitions.Security | Sensitive PII trong export — masking | ⚠️ High |
| [TC-092](#tc-092) | 🟠 P1 | `SECURITY` | Petitions.Security | Rate limit list endpoint | ⚠️ High |
| [TC-093](#tc-093) | 🟠 P1 | `SECURITY` | Petitions.Security | Convert race — bypass optimistic lock với expectedUpdatedAt giả | 🚨 Critical |
| [TC-094](#tc-094) | 🟠 P1 | `SECURITY` | Petitions.Security | docx template path injection | 🚨 Critical |
| [TC-095](#tc-095) | 🟠 P1 | `SECURITY` | Petitions.Security | Audit log không chứa password/token | ⚠️ High |
| [TC-096](#tc-096) | 🟠 P1 | `SECURITY` | Petitions.Security | CORS — preflight evil origin | ⚠️ High |
| [TC-097](#tc-097) | 🟠 P1 | `DATA` | Petitions.Data | Unicode senderName tiếng Việt | ⚡ Medium |
| [TC-098](#tc-098) | 🟠 P1 | `DATA` | Petitions.Data | Phone E.164 vs local | 📌 Low |
| [TC-099](#tc-099) | 🟠 P1 | `DATA` | Petitions.Data | Trim senderName | 📌 Low |
| [TC-100](#tc-100) | 🟠 P1 | `DATA` | Petitions.Data | Date receivedDate UTC+7 | ⚡ Medium |
| [TC-102](#tc-102) | 🟠 P1 | `EDGE` | Petitions.Race | 2 user concurrent create cùng giây — STT unique | 🚨 Critical |
| [TC-103](#tc-103) | 🟠 P1 | `EDGE` | Petitions.Edge | Convert sau khi đã merge document | ⚠️ High |
| [TC-105](#tc-105) | 🟠 P1 | `A11Y` | Petitions.UI | Form keyboard tab order | ⚠️ High |
| [TC-106](#tc-106) | 🟠 P1 | `A11Y` | Petitions.UI | Label htmlFor đầy đủ | ⚠️ High |
| [TC-107](#tc-107) | 🟠 P1 | `A11Y` | Petitions.UI | Contrast badge 7 status ≥ 4.5 | ⚡ Medium |
| [TC-111](#tc-111) | 🟠 P1 | `COMPAT` | Petitions.UI | Chrome 130 Win | ⚠️ High |
| [TC-112](#tc-112) | 🟠 P1 | `COMPAT` | Petitions.UI | Firefox 130 | ⚡ Medium |
| [TC-113](#tc-113) | 🟠 P1 | `COMPAT` | Petitions.UI | Edge 130 | ⚡ Medium |
| [TC-114](#tc-114) | 🟠 P1 | `COMPAT` | Petitions.UI | Safari 17 macOS | ⚡ Medium |
| [TC-115](#tc-115) | 🟠 P1 | `COMPAT` | Petitions.UI | Mobile 375x667 | ⚠️ High |
| [TC-118](#tc-118) | 🟠 P1 | `PERFORMANCE` | Petitions.Perf | Convert đơn có 50 documents < 5s | ⚠️ High |
| [TC-122](#tc-122) | 🟠 P1 | `RED` | Petitions.Create | senderBirthYear < 1900 | 📌 Low |
| [TC-123](#tc-123) | 🟠 P1 | `RED` | Petitions.Create | senderBirthYear > năm hiện tại | 📌 Low |
| [TC-124](#tc-124) | 🟠 P1 | `RED` | Petitions.Update | Update senderName trên đơn đã DA_CHUYEN_VU_AN | ⚡ Medium |
| [TC-125](#tc-125) | 🟠 P1 | `RED` | Petitions.Bulk | Bulk-assign body ids rỗng | 📌 Low |
| [TC-126](#tc-126) | 🟠 P1 | `RED` | Petitions.Export | export/duplicates với date range > 365 ngày | 📌 Low |
| [TC-127](#tc-127) | 🟠 P1 | `RED` | Petitions.Convert | Convert-incident thiếu name | ⚠️ High |
| [TC-128](#tc-128) | 🟠 P1 | `RED` | Petitions.Create | raSoatTrung enum không hợp lệ | 📌 Low |
| [TC-129](#tc-129) | 🟠 P1 | `INTEGRATION` | Petitions.Doc | Export-document với 6 docType lần lượt → 6 SeriesKey khác | ⚠️ High |
| [TC-130](#tc-130) | 🟠 P1 | `RED` | Petitions.Convert | Convert đơn đã linked Incident | ⚠️ High |
| [TC-131](#tc-131) | 🟠 P1 | `RED` | Petitions.Read | Ward page WardPetitionsPage user thường không thấy | ⚠️ High |
| [TC-136](#tc-136) | 🟠 P1 | `RED` | Petitions.Create | Tạo đơn không thuộc đơn vị mình (unit param) | ⚡ Medium |
| [TC-137](#tc-137) | 🟠 P1 | `RED` | Petitions.Update | Update senderEmail format sai | ⚡ Medium |
| [TC-138](#tc-138) | 🟠 P1 | `SECURITY` | Petitions.Security | ZIP slip qua batch-export filename | 🚨 Critical |
| [TC-139](#tc-139) | 🟠 P1 | `RED` | Petitions.Create | Body content-type không phải application/json | 📌 Low |
| [TC-140](#tc-140) | 🟠 P1 | `RED` | Petitions.Read | GET /:id/journey với page=0 | 📌 Low |
| [TC-141](#tc-141) | 🟠 P1 | `SECURITY` | Petitions.Security | Document export OOXML macro injection | 🚨 Critical |
| [TC-020](#tc-020) | 🟡 P2 | `GREEN` | Petitions.Stats | GET /petitions/stats count theo 7 status | 📌 Low |
| [TC-101](#tc-101) | 🟡 P2 | `DATA` | Petitions.Data | Empty optional fields → null | 📌 Low |
| [TC-104](#tc-104) | 🟡 P2 | `EDGE` | Petitions.Stats | Stats DB rỗng | 📌 Low |
| [TC-108](#tc-108) | 🟡 P2 | `A11Y` | Petitions.UI | Error aria-live announce | ⚡ Medium |
| [TC-109](#tc-109) | 🟡 P2 | `A11Y` | Petitions.UI | Convert modal trap focus | ⚡ Medium |
| [TC-110](#tc-110) | 🟡 P2 | `A11Y` | Petitions.UI | PageHeader có heading h1 | 📌 Low |
| [TC-116](#tc-116) | 🟡 P2 | `COMPAT` | Petitions.UI | Tablet 768x1024 | 📌 Low |
| [TC-119](#tc-119) | 🟡 P2 | `PERFORMANCE` | Petitions.Perf | Export 5000 record < 30s | ⚡ Medium |
| [TC-132](#tc-132) | 🟡 P2 | `A11Y` | Petitions.UI | Bulk action checkbox có label SR | ⚡ Medium |
| [TC-133](#tc-133) | 🟡 P2 | `A11Y` | Petitions.UI | Overdue badge có aria-label đầy đủ ngày | ⚡ Medium |
| [TC-134](#tc-134) | 🟡 P2 | `COMPAT` | Petitions.UI | PWA install offline read cached petitions | 📌 Low |
| [TC-135](#tc-135) | 🟡 P2 | `COMPAT` | Petitions.UI | Print stylesheet cho export-document preview | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo đơn TO_CAO hợp lệ tự sinh STT

### Điều kiện tiên quyết
- User write:Petition

### Các bước kiểm thử
- [ ] POST /petitions name='Nguyễn Văn A', petitionType='TO_CAO', receivedDate

### Dữ liệu kiểm thử
```
senderName='Nguyễn Văn A', petitionType='TO_CAO'
```

### Kết quả mong đợi
**UI**:
- Toast OK

**API**:
- + stt='DT-2026-NNNNN'

**Side effects** (DB, email, log, queue...):
- DocumentNumberLog ghi; deadline auto theo THOI_HAN_TO_CAO

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo đơn KHIEU_NAI hợp lệ

### Các bước kiểm thử
- [ ] POST petitionType=KHIEU_NAI

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deadline auto theo THOI_HAN_KHIEU_NAI

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-03`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo đơn KIEN_NGHI

### Các bước kiểm thử
- [ ] POST petitionType=KIEN_NGHI

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deadline theo THOI_HAN_KIEN_NGHI

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: High
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-04`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo đơn PHAN_ANH

### Các bước kiểm thử
- [ ] POST petitionType=PHAN_ANH

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deadline theo THOI_HAN_PHAN_ANH

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: High
module: Petitions.Create
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List đơn thư default

### Các bước kiểm thử
- [ ] GET /petitions

### Kết quả mong đợi
**UI**:
- row

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: High
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Filter theo status MOI_TIEP_NHAN

### Các bước kiểm thử
- [ ] ?status=MOI_TIEP_NHAN

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: High
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-03`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Search theo stt + senderName

### Các bước kiểm thử
- [ ] ?search='DT-2026'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-05`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET /petitions/:id (route alias v0.67.1)

### Các bước kiểm thử
- [ ] GET /petitions/X

### Kết quả mong đợi
**UI**:
- PetitionFormPage hiển thị read mode

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Petitions.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.67.1 row click fix

---

## TC-012

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Petitions.Update`
- Yêu cầu: `REQ-PET-UP-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PUT update đơn thư với expectedUpdatedAt

### Các bước kiểm thử
- [ ] PUT

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: Critical
module: Petitions.Update
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
- Priority: `P0` 🔴
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert đơn thư → Vụ án (atomic)

### Điều kiện tiên quyết
- Petition status=MOI_TIEP_NHAN

### Các bước kiểm thử
- [ ] POST /:id/convert-case body {caseName, crime, jurisdiction, expectedUpdatedAt}

### Kết quả mong đợi
**UI**:
- Redirect Case mới

**API**:

**Side effects** (DB, email, log, queue...):
- Atomic: Case caseProvenance=FROM_PETITION + Petition.linkedCaseId + Petition.status=DA_CHUYEN_VU_AN; documents relink

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert → Vụ việc

### Các bước kiểm thử
- [ ] POST /:id/convert-incident

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- Petition.linkedIncidentId + status=DA_CHUYEN_VU_VIEC

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Delete`
- Yêu cầu: `REQ-PET-DEL-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Soft-delete đơn thư

### Các bước kiểm thử
- [ ] DELETE

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Delete`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: High
module: Petitions.Delete
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Petitions.Restore`
- Yêu cầu: `REQ-PET-RES-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: ADMIN restore

### Các bước kiểm thử
- [ ] POST /:id/restore

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt=null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Restore`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: High
module: Petitions.Restore
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Thiếu senderName

### Các bước kiểm thử
- [ ] POST bỏ senderName

### Dữ liệu kiểm thử
```
senderName=''
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Họ tên người gửi bắt buộc'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Thiếu petitionType

### Các bước kiểm thử
- [ ] petitionType=undefined

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-07`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: petitionType không thuộc enum

### Các bước kiểm thử
- [ ] petitionType='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: receivedDate tương lai

### Các bước kiểm thử
- [ ] receivedDate=2030-01-01

### Kết quả mong đợi
**UI**:
- Cảnh báo

**API**:
- /200

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-09`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STT trùng (manual)

### Điều kiện tiên quyết
- DB có stt='DT-2026-00001'

### Các bước kiểm thử
- [ ] POST stt='DT-2026-00001'

### Kết quả mong đợi
**API**:
- unique

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: senderEmail format sai

### Các bước kiểm thử
- [ ] senderEmail='abc'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-11`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: senderPhone format sai

### Các bước kiểm thử
- [ ] senderPhone='abc'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Update`
- Yêu cầu: `REQ-PET-UP-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: OCC stale expectedUpdatedAt

### Các bước kiểm thử
- [ ] PUT stale

### Kết quả mong đợi
**UI**:
- Dialog conflict

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Critical
module: Petitions.Update
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert đơn đã linked Case

### Điều kiện tiên quyết
- Petition.linkedCaseId !=null

### Các bước kiểm thử
- [ ] POST /convert-case

### Kết quả mong đợi
**API**:
- /422

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-04`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert thiếu caseName

### Các bước kiểm thử
- [ ] POST /convert-case body {}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-05`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert thiếu expectedUpdatedAt (chống race)

### Các bước kiểm thử
- [ ] POST /convert-case không expectedUpdatedAt

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-06`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert đơn đã soft-delete

### Các bước kiểm thử
- [ ] POST

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: High
module: Petitions.Convert
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert với jurisdiction enum sai

### Các bước kiểm thử
- [ ] jurisdiction='XYZ'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: High
module: Petitions.Convert
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
- Module: `Petitions.Auth`
- Yêu cầu: `REQ-PET-AUTH-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET không JWT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: Critical
module: Petitions.Auth
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
- Module: `Petitions.Auth`
- Yêu cầu: `REQ-PET-AUTH-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User không có read:Petition

### Các bước kiểm thử
- [ ] GET role guest

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Critical
module: Petitions.Auth
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
- Module: `Petitions.Delete`
- Yêu cầu: `REQ-PET-DEL-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-creator non-admin xóa

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: Critical
module: Petitions.Delete
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
- Module: `Petitions.Delete`
- Yêu cầu: `REQ-PET-DEL-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xóa đơn đã DA_CHUYEN_VU_AN

### Điều kiện tiên quyết
- status=DA_CHUYEN_VU_AN

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: High
module: Petitions.Delete
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
- Priority: `P0` 🔴
- Module: `Petitions.Restore`
- Yêu cầu: `REQ-PET-RES-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-ADMIN restore

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Restore`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: Critical
module: Petitions.Restore
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
- Priority: `P0` 🔴
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-06`
- Kỹ thuật: `Negative IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User Team A xem petition Team B

### Các bước kiểm thử
- [ ] GET /:id of Team B

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Critical
module: Petitions.Read
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
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-01`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: MOI_TIEP_NHAN → DANG_XU_LY

### Các bước kiểm thử
- [ ] PUT update status

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: High
module: Petitions.State
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
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-02`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DANG_XU_LY → CHO_PHE_DUYET

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: High
module: Petitions.State
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
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-03`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: CHO_PHE_DUYET → DA_GIAI_QUYET

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: High
module: Petitions.State
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
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-04`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert-case auto đặt status=DA_CHUYEN_VU_AN

### Các bước kiểm thử
- [ ] POST /convert-case

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- Petition.status=DA_CHUYEN_VU_AN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: Critical
module: Petitions.State
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
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-05`
- Kỹ thuật: `State`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert-incident auto đặt status=DA_CHUYEN_VU_VIEC

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: Petitions.State
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Petitions.Decision`
- Yêu cầu: `REQ-PET-DT-01`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Deadline auto-calc theo petitionType (DT)

### Các bước kiểm thử
- [ ] Tạo 4 đơn mỗi type, kiểm tra deadline

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- deadline = receivedDate + THOI_HAN_<TYPE>

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: Critical
module: Petitions.Decision
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Petitions.Decision`
- Yêu cầu: `REQ-PET-DT-02`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DataScope filter — 4 role combinations

### Các bước kiểm thử
- [ ] Admin/Dispatcher/Ward/ĐTV thường

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Decision`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Decision`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: Critical
module: Petitions.Decision
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-01`
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
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: Critical
module: Petitions.Security
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-02`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS senderName

### Các bước kiểm thử
- [ ] senderName='<script>alert(1)</script>'

### Kết quả mong đợi
**UI**:
- Escape

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-03`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS detailContent (RichText)

### Các bước kiểm thử
- [ ] RichText injection iframe

### Dữ liệu kiểm thử
```
<iframe src='javascript:alert(1)'></iframe>
```

### Kết quả mong đợi
**API**:
- + stripHtmlTags

**Side effects** (DB, email, log, queue...):
- DB không chứa iframe

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-04`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR GET /:id khác team

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-05`
- Kỹ thuật: `OWASP A08`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mass assignment enteredById

### Các bước kiểm thử
- [ ] body enteredById khác

### Kết quả mong đợi
**API**:
- , server set actor

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-06`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CSRF POST cross-origin

### Kết quả mong đợi
**API**:
- CORS reject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Critical
module: Petitions.Security
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
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `Petitions.Perf`
- Yêu cầu: `REQ-PET-PERF-01`
- Kỹ thuật: `Performance`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List 1000 đơn < 2s

### Kết quả mong đợi
**API**:
- P95 < 2s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: High
module: Petitions.Perf
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
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Petitions.Doc`
- Yêu cầu: `REQ-PET-INT-01`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: STT auto-gen + DocumentNumberLog ghi đầy đủ

### Các bước kiểm thử
- [ ] POST /petitions

### Kết quả mong đợi
**API**:
- stt

**Side effects** (DB, email, log, queue...):
- DocumentNumberLog row link logId→petition.id

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Doc`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Doc`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Critical
module: Petitions.Doc
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
- Module: `Petitions.Notify`
- Yêu cầu: `REQ-PET-INT-02`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Assign → notification cho assignedToId

### Kết quả mong đợi
**UI**:
- Bell badge

**API**:
- SSE event

**Side effects** (DB, email, log, queue...):
- Notification row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Notify`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Notify`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: High
module: Petitions.Notify
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.45

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-05`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Ward officer tự gán assignedTeamId

### Điều kiện tiên quyết
- User ward officer

### Các bước kiểm thử
- [ ] POST không truyền assignedTeamId

### Kết quả mong đợi
**API**:
- , assignedTeamId=wardTeamId

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: High
module: Petitions.Create
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

## TC-006

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-06`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Draft STT preview trước save

### Các bước kiểm thử
- [ ] Mở form
- [ ] GET /document-numbers/draft?type=PETITION

### Kết quả mong đợi
**UI**:
- STT preview hiển thị

**API**:
- next STT

**Side effects** (DB, email, log, queue...):
- Không commit

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: Medium
module: Petitions.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.42

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-04`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /linkable

### Các bước kiểm thử
- [ ] GET /linkable

### Kết quả mong đợi
**API**:
- , linkedCaseId=null + scope

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: High
module: Petitions.Read
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
- Module: `Petitions.Assign`
- Yêu cầu: `REQ-PET-ASN-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Dispatcher assign đơn thư

### Các bước kiểm thử
- [ ] PATCH /assign

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Assign`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: High
module: Petitions.Assign
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export Excel danh sách

### Các bước kiểm thử
- [ ] GET /export

### Kết quả mong đợi
**UI**:
- Download .xlsx

**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog PETITION_EXPORTED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: Medium
module: Petitions.Export
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-02`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export document Word (PHIEU_DE_XUAT)

### Các bước kiểm thử
- [ ] GET /:id/export-document?docType=PHIEU_DE_XUAT

### Kết quả mong đợi
**UI**:
- Download .docx

**API**:

**Side effects** (DB, email, log, queue...):
- DocumentNumberLog cho docType

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: High
module: Petitions.Export
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.47 PR2

---

## TC-040

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: limit > 100

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: fromDate > toDate

### Kết quả mong đợi
**API**:
- /empty

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Assign`
- Yêu cầu: `REQ-PET-ASN-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-dispatcher assign

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Critical
module: Petitions.Assign
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
- Module: `Petitions.Assign`
- Yêu cầu: `REQ-PET-ASN-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Assign thiếu assignedTeamId

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: High
module: Petitions.Assign
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: export-document docType không thuộc 6 template

### Các bước kiểm thử
- [ ] ?docType=INVALID

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: High
module: Petitions.Export
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-04`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Batch export ZIP với 0 ids

### Các bước kiểm thử
- [ ] POST /export-document-batch {ids:[]}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Low
module: Petitions.Export
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-12`
- Kỹ thuật: `Negative XSS`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: detailContent có HTML/script không sanitize

### Các bước kiểm thử
- [ ] detailContent='<script>alert(1)</script>'

### Kết quả mong đợi
**UI**:
- Stored escape

**API**:

**Side effects** (DB, email, log, queue...):
- DB stripHtmlTags

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-13`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Senderr name > 255 ký tự

### Các bước kiểm thử
- [ ] senderName 256

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-14`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: summary > 2000 ký tự

### Các bước kiểm thử
- [ ] summary 2001

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-15`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: assignedToId không tồn tại

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: High
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-16`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: deadline tự nhập < receivedDate

### Các bước kiểm thử
- [ ] deadline trước receivedDate

### Kết quả mong đợi
**UI**:
- Cảnh báo

**API**:
- /200 flag

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Update`
- Yêu cầu: `REQ-PET-UP-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update đơn đã soft-delete

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: High
module: Petitions.Update
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-09`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: sortBy injection

### Các bước kiểm thử
- [ ] sortBy='id; DROP'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: Critical
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-EXP-05`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export rate limit 5/min

### Các bước kiểm thử
- [ ] Export 6 lần

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-08`
- Kỹ thuật: `Negative Race`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert race — 2 user cùng convert

### Kết quả mong đợi
**API**:
- OK, 1 409

**Side effects** (DB, email, log, queue...):
- Không tạo 2 Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Critical
module: Petitions.Convert
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
- Module: `Petitions.Bulk`
- Yêu cầu: `REQ-PET-BULK-01`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bulk assign khác đơn vị

### Kết quả mong đợi
**API**:
- /partial

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: Petitions.Bulk
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
- Module: `Petitions.Bulk`
- Yêu cầu: `REQ-PET-BULK-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bulk delete >100 ids

### Kết quả mong đợi
**API**:
- /429

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: Medium
module: Petitions.Bulk
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET stats với status filter — phải strip

### Các bước kiểm thử
- [ ] GET /stats?status=X

### Kết quả mong đợi
**API**:
- đầy đủ 7 keys

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: High
module: Petitions.Read
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-17`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DocumentNumberEngine fail giữa transaction

### Điều kiện tiên quyết
- DB lock

### Các bước kiểm thử
- [ ] POST

### Kết quả mong đợi
**API**:
- /503

**Side effects** (DB, email, log, queue...):
- Rollback, không tạo petition

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-18`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: unit > 255 ký tự

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-06`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: export-word legacy bị disable

### Điều kiện tiên quyết
- feature flag off

### Các bước kiểm thử
- [ ] GET /export-word

### Kết quả mong đợi
**API**:
- /410

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Low
module: Petitions.Export
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-19`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo đơn có notes chứa SQL keyword

### Các bước kiểm thử
- [ ] notes='DROP TABLE petitions'

### Kết quả mong đợi
**API**:
- (parametrized)

**Side effects** (DB, email, log, queue...):
- DB intact

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Critical
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-20`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: baoCaoBanGiamDoc enum không hợp lệ

### Các bước kiểm thử
- [ ] baoCaoBanGiamDoc='X'

### Kết quả mong đợi
**API**:
- /200 ignore

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-11`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Cache HIT ở user A leak data sang user B

### Điều kiện tiên quyết
- v0.46 đã fix PII cache

### Các bước kiểm thử
- [ ] User A list → user B list

### Kết quả mong đợi
**API**:
- Mỗi user thấy data riêng

**Side effects** (DB, email, log, queue...):
- Cache key có scope

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Critical
module: Petitions.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.46 fix

---

## TC-064

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-12`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Search với % wildcard SQL

### Các bước kiểm thử
- [ ] ?search='%'

### Kết quả mong đợi
**API**:
- , escape %

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-01`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: senderName = 1 ký tự (min)

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-13`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: senderName = 255 (max)

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-14`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: summary = 2000 (max)

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-07`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=1

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Low
module: Petitions.Read
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-07`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=100

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Low
module: Petitions.Read
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-04`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: listLinkable limit=50 default

### Kết quả mong đợi
**API**:
- row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Low
module: Petitions.Read
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-21`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: STT counter rollover năm mới

### Điều kiện tiên quyết
- DB stt='DT-2025-99999'

### Các bước kiểm thử
- [ ] POST sau 31/12

### Kết quả mong đợi
**API**:
- stt='DT-2026-00001'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: High
module: Petitions.Create
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-EP-01`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: status 7 partition

### Các bước kiểm thử
- [ ] ?status=mỗi giá trị

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: Medium
module: Petitions.Read
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-EP-02`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: petitionType 4 partition

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- deadline khác nhau theo type

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: High
module: Petitions.Create
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
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-EP-03`
- Kỹ thuật: `EP`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: overdue=true vs false

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Low
module: Petitions.Read
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EP-04`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docType 6 template values

### Các bước kiểm thử
- [ ] Test mỗi docType: PHIEU_DE_XUAT, PHIEU_CHUYEN_NGUON_TIN, PHIEU_CHUYEN_DON, THONG_BAO_CHUYEN, THONG_BAO_HUONG_DAN, THONG_BAO_TRA_LAI

### Kết quả mong đợi
**API**:
- docx

**Side effects** (DB, email, log, queue...):
- Mỗi docType có DocumentNumberLog series riêng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: High
module: Petitions.Export
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
- Priority: `P1` 🟠
- Module: `Petitions.State`
- Yêu cầu: `REQ-PET-ST-06`
- Kỹ thuật: `State`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DA_LUU_DON là terminal

### Điều kiện tiên quyết
- status=DA_LUU_DON

### Các bước kiểm thử
- [ ] PUT status khác

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: Petitions.State
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
- Priority: `P1` 🟠
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-07`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Path traversal export filename

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: High
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-08`
- Kỹ thuật: `OWASP A02`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Sensitive PII trong export — masking

### Các bước kiểm thử
- [ ] Export xlsx có senderEmail, senderPhone

### Kết quả mong đợi
**API**:
- , có watermark / role-based redaction

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: High
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-09`
- Kỹ thuật: `OWASP A04`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Rate limit list endpoint

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: High
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-10`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Convert race — bypass optimistic lock với expectedUpdatedAt giả

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-11`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: docx template path injection

### Các bước kiểm thử
- [ ] docType='../../../etc/passwd'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: Critical
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-12`
- Kỹ thuật: `OWASP A09`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Audit log không chứa password/token

### Các bước kiểm thử
- [ ] GET /journey

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Body không có secret

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: High
module: Petitions.Security
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
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-13`
- Kỹ thuật: `OWASP A05`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: CORS — preflight evil origin

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: High
module: Petitions.Security
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Petitions.Data`
- Yêu cầu: `REQ-PET-DATA-01`
- Kỹ thuật: `i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Unicode senderName tiếng Việt

### Các bước kiểm thử
- [ ] senderName='Nguyễn Thị Cẩm Tú'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: Medium
module: Petitions.Data
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
- Module: `Petitions.Data`
- Yêu cầu: `REQ-PET-DATA-02`
- Kỹ thuật: `Validation`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Phone E.164 vs local

### Các bước kiểm thử
- [ ] senderPhone='+84909xxxxxx'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Low
module: Petitions.Data
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
- Module: `Petitions.Data`
- Yêu cầu: `REQ-PET-DATA-03`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Trim senderName

### Kết quả mong đợi
**API**:
- trimmed

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Low
module: Petitions.Data
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
- Module: `Petitions.Data`
- Yêu cầu: `REQ-PET-DATA-04`
- Kỹ thuật: `i18n`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Date receivedDate UTC+7

### Kết quả mong đợi
**UI**:
- Hiển thị giờ VN

**API**:
- ISO 8601

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Medium
module: Petitions.Data
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
- Loại: `EDGE`
- Priority: `P1` 🟠
- Module: `Petitions.Race`
- Yêu cầu: `REQ-PET-EDGE-01`
- Kỹ thuật: `Race`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: 2 user concurrent create cùng giây — STT unique

### Các bước kiểm thử
- [ ] POST concurrent

### Kết quả mong đợi
**API**:
- Cả 2 thành công, STT khác nhau

**Side effects** (DB, email, log, queue...):
- DocumentNumberEngine atomic

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Race`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Race`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: Critical
module: Petitions.Race
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
- Module: `Petitions.Edge`
- Yêu cầu: `REQ-PET-EDGE-02`
- Kỹ thuật: `Edge`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert sau khi đã merge document

### Điều kiện tiên quyết
- Petition có 5 documents

### Các bước kiểm thử
- [ ] Convert-case

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- documents relink sang Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Edge`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Edge`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: High
module: Petitions.Edge
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
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-01`
- Kỹ thuật: `WCAG 2.1.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form keyboard tab order

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: High
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-02`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Label htmlFor đầy đủ

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: High
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-03`
- Kỹ thuật: `WCAG 1.4.3`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Contrast badge 7 status ≥ 4.5

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: Medium
module: Petitions.UI
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-01`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome 130 Win

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: High
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-02`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Firefox 130

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: Medium
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-03`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Edge 130

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-04`
- Kỹ thuật: `Cross`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Safari 17 macOS

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Medium
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-05`
- Kỹ thuật: `Responsive`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mobile 375x667

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: High
module: Petitions.UI
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
- Priority: `P1` 🟠
- Module: `Petitions.Perf`
- Yêu cầu: `REQ-PET-PERF-02`
- Kỹ thuật: `Performance`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert đơn có 50 documents < 5s

### Kết quả mong đợi
**API**:
- < 5s

**Side effects** (DB, email, log, queue...):
- documents relinked

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: High
module: Petitions.Perf
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-22`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: senderBirthYear < 1900

### Các bước kiểm thử
- [ ] senderBirthYear='1899'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: Low
module: Petitions.Create
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-23`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: senderBirthYear > năm hiện tại

### Các bước kiểm thử
- [ ] senderBirthYear='2099'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: Low
module: Petitions.Create
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
- Module: `Petitions.Update`
- Yêu cầu: `REQ-PET-UP-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Update senderName trên đơn đã DA_CHUYEN_VU_AN

### Kết quả mong đợi
**API**:
- hoặc 200 ignored

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Medium
module: Petitions.Update
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
- Module: `Petitions.Bulk`
- Yêu cầu: `REQ-PET-BULK-03`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Bulk-assign body ids rỗng

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: Low
module: Petitions.Bulk
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
- Module: `Petitions.Export`
- Yêu cầu: `REQ-PET-EXP-07`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: export/duplicates với date range > 365 ngày

### Kết quả mong đợi
**API**:
- /clamp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: Low
module: Petitions.Export
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
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert-incident thiếu name

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: High
module: Petitions.Convert
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
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-24`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: raSoatTrung enum không hợp lệ

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: Low
module: Petitions.Create
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
- Loại: `INTEGRATION`
- Priority: `P1` 🟠
- Module: `Petitions.Doc`
- Yêu cầu: `REQ-PET-INT-03`
- Kỹ thuật: `Integration`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export-document với 6 docType lần lượt → 6 SeriesKey khác

### Kết quả mong đợi
**API**:
- mỗi lần

**Side effects** (DB, email, log, queue...):
- DocumentNumberLog series riêng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Doc`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Doc`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: High
module: Petitions.Doc
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Convert`
- Yêu cầu: `REQ-PET-CV-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Convert đơn đã linked Incident

### Điều kiện tiên quyết
- linkedIncidentId !=null

### Các bước kiểm thử
- [ ] POST /convert-case

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Convert`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Convert`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: High
module: Petitions.Convert
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-13`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Ward page WardPetitionsPage user thường không thấy

### Các bước kiểm thử
- [ ] /ward/petitions user không ward

### Kết quả mong đợi
**UI**:
- /404

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: High
module: Petitions.Read
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-25`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo đơn không thuộc đơn vị mình (unit param)

### Các bước kiểm thử
- [ ] unit='Đơn vị khác'

### Kết quả mong đợi
**API**:
- (free text) hoặc 403 nếu validated

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: Medium
module: Petitions.Create
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
- Module: `Petitions.Update`
- Yêu cầu: `REQ-PET-UP-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Update senderEmail format sai

### Các bước kiểm thử
- [ ] PUT senderEmail='abc'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: Medium
module: Petitions.Update
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-14`
- Kỹ thuật: `OWASP A03`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: ZIP slip qua batch-export filename

### Các bước kiểm thử
- [ ] POST /export-document-batch với filename '../../evil.docx'

### Kết quả mong đợi
**API**:
- sanitize

**Side effects** (DB, email, log, queue...):
- ZIP không escape

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: Critical
module: Petitions.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-139

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Create`
- Yêu cầu: `REQ-PET-CR-26`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Body content-type không phải application/json

### Các bước kiểm thử
- [ ] POST text/plain

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: Low
module: Petitions.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-140

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Petitions.Read`
- Yêu cầu: `REQ-PET-RD-14`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: GET /:id/journey với page=0

### Các bước kiểm thử
- [ ] ?page=0

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: Low
module: Petitions.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-141

**Meta**:
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Petitions.Security`
- Yêu cầu: `REQ-PET-SEC-15`
- Kỹ thuật: `OWASP A03`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Document export OOXML macro injection

### Các bước kiểm thử
- [ ] Insert {{=cmd()}} vào field nhanThay
- [ ] Export-document

### Kết quả mong đợi
**API**:
- docx render literal text

**Side effects** (DB, email, log, queue...):
- docxtemplater anti-injection

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-141
severity: Critical
module: Petitions.Security
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
- Loại: `GREEN`
- Priority: `P2` 🟡
- Module: `Petitions.Stats`
- Yêu cầu: `REQ-PET-STAT-01`
- Kỹ thuật: `Happy Path`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: GET /petitions/stats count theo 7 status

### Các bước kiểm thử
- [ ] GET /stats

### Kết quả mong đợi
**API**:
- đủ 7 key

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Stats`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Low
module: Petitions.Stats
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
- Module: `Petitions.Data`
- Yêu cầu: `REQ-PET-DATA-05`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Empty optional fields → null

### Các bước kiểm thử
- [ ] summary=''

### Kết quả mong đợi
**API**:
- null

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: Low
module: Petitions.Data
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
- Priority: `P2` 🟡
- Module: `Petitions.Stats`
- Yêu cầu: `REQ-PET-EDGE-03`
- Kỹ thuật: `Empty`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Stats DB rỗng

### Kết quả mong đợi
**API**:
- all=0

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Stats`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: Low
module: Petitions.Stats
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
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-04`
- Kỹ thuật: `WCAG 4.1.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Error aria-live announce

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Medium
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-05`
- Kỹ thuật: `WCAG 2.4.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Convert modal trap focus

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Medium
module: Petitions.UI
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
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-06`
- Kỹ thuật: `WCAG 2.4.6`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PageHeader có heading h1

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Low
module: Petitions.UI
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
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-06`
- Kỹ thuật: `Responsive`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tablet 768x1024

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Low
module: Petitions.UI
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
- Priority: `P2` 🟡
- Module: `Petitions.Perf`
- Yêu cầu: `REQ-PET-PERF-03`
- Kỹ thuật: `Stress`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export 5000 record < 30s

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: Medium
module: Petitions.Perf
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-07`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bulk action checkbox có label SR

### Kết quả mong đợi
**UI**:
- aria-label='Chọn đơn STT X'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: Medium
module: Petitions.UI
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-A11Y-08`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Overdue badge có aria-label đầy đủ ngày

### Kết quả mong đợi
**UI**:
- aria-label='Quá hạn, deadline 01/05/2026'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: Medium
module: Petitions.UI
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-07`
- Kỹ thuật: `PWA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: PWA install offline read cached petitions

### Điều kiện tiên quyết
- v0.46

### Các bước kiểm thử
- [ ] Install PWA
- [ ] Offline mode

### Kết quả mong đợi
**UI**:
- Read cached

**Side effects** (DB, email, log, queue...):
- ServiceWorker

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: Low
module: Petitions.UI
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Petitions.UI`
- Yêu cầu: `REQ-PET-COMPAT-08`
- Kỹ thuật: `Print`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Print stylesheet cho export-document preview

### Các bước kiểm thử
- [ ] Ctrl+P

### Kết quả mong đợi
**UI**:
- Print preview đẹp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Petitions.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Petitions.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: Low
module: Petitions.UI
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

- [ ] **TC-001** [P0] Tạo đơn TO_CAO hợp lệ tự sinh STT
- [ ] **TC-002** [P0] Tạo đơn KHIEU_NAI hợp lệ
- [ ] **TC-003** [P0] Tạo đơn KIEN_NGHI
- [ ] **TC-004** [P0] Tạo đơn PHAN_ANH
- [ ] **TC-007** [P0] List đơn thư default
- [ ] **TC-008** [P0] Filter theo status MOI_TIEP_NHAN
- [ ] **TC-009** [P0] Search theo stt + senderName
- [ ] **TC-011** [P0] GET /petitions/:id (route alias v0.67.1)
- [ ] **TC-012** [P0] PUT update đơn thư với expectedUpdatedAt
- [ ] **TC-013** [P0] Convert đơn thư → Vụ án (atomic)
- [ ] **TC-014** [P0] Convert → Vụ việc
- [ ] **TC-018** [P0] Soft-delete đơn thư
- [ ] **TC-019** [P0] ADMIN restore
- [ ] **TC-021** [P0] Thiếu senderName
- [ ] **TC-022** [P0] Thiếu petitionType
- [ ] **TC-023** [P0] petitionType không thuộc enum
- [ ] **TC-024** [P0] receivedDate tương lai
- [ ] **TC-025** [P0] STT trùng (manual)
- [ ] **TC-026** [P0] senderEmail format sai
- [ ] **TC-027** [P0] senderPhone format sai
- [ ] **TC-028** [P0] OCC stale expectedUpdatedAt
- [ ] **TC-029** [P0] Convert đơn đã linked Case
- [ ] **TC-030** [P0] Convert thiếu caseName
- [ ] **TC-031** [P0] Convert thiếu expectedUpdatedAt (chống race)
- [ ] **TC-032** [P0] Convert đơn đã soft-delete
- [ ] **TC-033** [P0] Convert với jurisdiction enum sai
- [ ] **TC-034** [P0] GET không JWT
- [ ] **TC-035** [P0] User không có read:Petition
- [ ] **TC-036** [P0] Non-creator non-admin xóa
- [ ] **TC-037** [P0] Xóa đơn đã DA_CHUYEN_VU_AN
- [ ] **TC-038** [P0] Non-ADMIN restore
- [ ] **TC-039** [P0] User Team A xem petition Team B
- [ ] **TC-076** [P0] MOI_TIEP_NHAN → DANG_XU_LY
- [ ] **TC-077** [P0] DANG_XU_LY → CHO_PHE_DUYET
- [ ] **TC-078** [P0] CHO_PHE_DUYET → DA_GIAI_QUYET
- [ ] **TC-079** [P0] Convert-case auto đặt status=DA_CHUYEN_VU_AN
- [ ] **TC-080** [P0] Convert-incident auto đặt status=DA_CHUYEN_VU_VIEC
- [ ] **TC-082** [P0] Deadline auto-calc theo petitionType (DT)
- [ ] **TC-083** [P0] DataScope filter — 4 role combinations
- [ ] **TC-084** [P0] SQL Injection trong search
- [ ] **TC-085** [P0] XSS senderName
- [ ] **TC-086** [P0] XSS detailContent (RichText)
- [ ] **TC-087** [P0] IDOR GET /:id khác team
- [ ] **TC-088** [P0] Mass assignment enteredById
- [ ] **TC-089** [P0] CSRF POST cross-origin
- [ ] **TC-117** [P0] List 1000 đơn < 2s
- [ ] **TC-120** [P0] STT auto-gen + DocumentNumberLog ghi đầy đủ
- [ ] **TC-121** [P0] Assign → notification cho assignedToId
- [ ] **TC-005** [P1] Ward officer tự gán assignedTeamId
- [ ] **TC-006** [P1] Draft STT preview trước save
- [ ] **TC-010** [P1] GET /linkable
- [ ] **TC-015** [P1] Dispatcher assign đơn thư
- [ ] **TC-016** [P1] Export Excel danh sách
- [ ] **TC-017** [P1] Export document Word (PHIEU_DE_XUAT)
- [ ] **TC-040** [P1] limit > 100
- [ ] **TC-041** [P1] fromDate > toDate
- [ ] **TC-042** [P1] Non-dispatcher assign
- [ ] **TC-043** [P1] Assign thiếu assignedTeamId
- [ ] **TC-044** [P1] export-document docType không thuộc 6 template
- [ ] **TC-045** [P1] Batch export ZIP với 0 ids
- [ ] **TC-046** [P1] detailContent có HTML/script không sanitize
- [ ] **TC-047** [P1] Senderr name > 255 ký tự
- [ ] **TC-048** [P1] summary > 2000 ký tự
- [ ] **TC-049** [P1] assignedToId không tồn tại
- [ ] **TC-050** [P1] deadline tự nhập < receivedDate
- [ ] **TC-051** [P1] Update đơn đã soft-delete
- [ ] **TC-052** [P1] sortBy injection
- [ ] **TC-053** [P1] Export rate limit 5/min
- [ ] **TC-054** [P1] Convert race — 2 user cùng convert
- [ ] **TC-055** [P1] Bulk assign khác đơn vị
- [ ] **TC-056** [P1] Bulk delete >100 ids
- [ ] **TC-057** [P1] GET stats với status filter — phải strip
- [ ] **TC-058** [P1] DocumentNumberEngine fail giữa transaction
- [ ] **TC-059** [P1] unit > 255 ký tự
- [ ] **TC-060** [P1] export-word legacy bị disable
- [ ] **TC-061** [P1] Tạo đơn có notes chứa SQL keyword
- [ ] **TC-062** [P1] baoCaoBanGiamDoc enum không hợp lệ
- [ ] **TC-063** [P1] Cache HIT ở user A leak data sang user B
- [ ] **TC-064** [P1] Search với % wildcard SQL
- [ ] **TC-065** [P1] senderName = 1 ký tự (min)
- [ ] **TC-066** [P1] senderName = 255 (max)
- [ ] **TC-067** [P1] summary = 2000 (max)
- [ ] **TC-068** [P1] limit=1
- [ ] **TC-069** [P1] limit=100
- [ ] **TC-070** [P1] listLinkable limit=50 default
- [ ] **TC-071** [P1] STT counter rollover năm mới
- [ ] **TC-072** [P1] status 7 partition
- [ ] **TC-073** [P1] petitionType 4 partition
- [ ] **TC-074** [P1] overdue=true vs false
- [ ] **TC-075** [P1] docType 6 template values
- [ ] **TC-081** [P1] DA_LUU_DON là terminal
- [ ] **TC-090** [P1] Path traversal export filename
- [ ] **TC-091** [P1] Sensitive PII trong export — masking
- [ ] **TC-092** [P1] Rate limit list endpoint
- [ ] **TC-093** [P1] Convert race — bypass optimistic lock với expectedUpdatedAt giả
- [ ] **TC-094** [P1] docx template path injection
- [ ] **TC-095** [P1] Audit log không chứa password/token
- [ ] **TC-096** [P1] CORS — preflight evil origin
- [ ] **TC-097** [P1] Unicode senderName tiếng Việt
- [ ] **TC-098** [P1] Phone E.164 vs local
- [ ] **TC-099** [P1] Trim senderName
- [ ] **TC-100** [P1] Date receivedDate UTC+7
- [ ] **TC-102** [P1] 2 user concurrent create cùng giây — STT unique
- [ ] **TC-103** [P1] Convert sau khi đã merge document
- [ ] **TC-105** [P1] Form keyboard tab order
- [ ] **TC-106** [P1] Label htmlFor đầy đủ
- [ ] **TC-107** [P1] Contrast badge 7 status ≥ 4.5
- [ ] **TC-111** [P1] Chrome 130 Win
- [ ] **TC-112** [P1] Firefox 130
- [ ] **TC-113** [P1] Edge 130
- [ ] **TC-114** [P1] Safari 17 macOS
- [ ] **TC-115** [P1] Mobile 375x667
- [ ] **TC-118** [P1] Convert đơn có 50 documents < 5s
- [ ] **TC-122** [P1] senderBirthYear < 1900
- [ ] **TC-123** [P1] senderBirthYear > năm hiện tại
- [ ] **TC-124** [P1] Update senderName trên đơn đã DA_CHUYEN_VU_AN
- [ ] **TC-125** [P1] Bulk-assign body ids rỗng
- [ ] **TC-126** [P1] export/duplicates với date range > 365 ngày
- [ ] **TC-127** [P1] Convert-incident thiếu name
- [ ] **TC-128** [P1] raSoatTrung enum không hợp lệ
- [ ] **TC-129** [P1] Export-document với 6 docType lần lượt → 6 SeriesKey khác
- [ ] **TC-130** [P1] Convert đơn đã linked Incident
- [ ] **TC-131** [P1] Ward page WardPetitionsPage user thường không thấy
- [ ] **TC-136** [P1] Tạo đơn không thuộc đơn vị mình (unit param)
- [ ] **TC-137** [P1] Update senderEmail format sai
- [ ] **TC-138** [P1] ZIP slip qua batch-export filename
- [ ] **TC-139** [P1] Body content-type không phải application/json
- [ ] **TC-140** [P1] GET /:id/journey với page=0
- [ ] **TC-141** [P1] Document export OOXML macro injection
- [ ] **TC-020** [P2] GET /petitions/stats count theo 7 status
- [ ] **TC-101** [P2] Empty optional fields → null
- [ ] **TC-104** [P2] Stats DB rỗng
- [ ] **TC-108** [P2] Error aria-live announce
- [ ] **TC-109** [P2] Convert modal trap focus
- [ ] **TC-110** [P2] PageHeader có heading h1
- [ ] **TC-116** [P2] Tablet 768x1024
- [ ] **TC-119** [P2] Export 5000 record < 30s
- [ ] **TC-132** [P2] Bulk action checkbox có label SR
- [ ] **TC-133** [P2] Overdue badge có aria-label đầy đủ ngày
- [ ] **TC-134** [P2] PWA install offline read cached petitions
- [ ] **TC-135** [P2] Print stylesheet cho export-document preview

---

_Generated by `uat-test-writer` skill on 30/05/2026 22:03_