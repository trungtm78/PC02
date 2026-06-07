# UAT Test Cases — Quản lý Vụ án (Cases)

**Generated**: 30/05/2026 22:02  
**Complexity**: `complex`  
**Total TC**: 147  
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

**Tổng số TC**: 147

**Phân bố loại**:
- `RED`: 60
- `GREEN`: 18
- `SECURITY`: 16
- `BOUNDARY`: 10
- `STATE`: 8
- `A11Y`: 8
- `COMPAT`: 6
- `EP`: 5
- `DATA`: 5
- `PERFORMANCE`: 4
- `EDGE`: 3
- `DECISION`: 2
- `INTEGRATION`: 2

**Phân bố priority**:
- 🔴 `P0`: 43
- 🟠 `P1`: 89
- 🟡 `P2`: 15

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 39
- ⚠️ `High`: 51
- ⚡ `Medium`: 36
- 📌 `Low`: 21

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `A-01` | `dtv.team-a@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team A | ACTIVE | User thuộc Team A để test scope |
| `A-02` | `dtv.team-b@pc02hcm.com` | `Pa$$w0rd!` | ĐTV Team B | ACTIVE | User thuộc Team B để test IDOR |
| `A-03` | `dispatcher@pc02hcm.com` | `Pa$$w0rd!` | Dispatcher (canDispatch=true) | ACTIVE | Test assign |
| `A-04` | `admin@pc02.local` | `Admin@2026` | ADMIN | ACTIVE | Restore, delete pre-migration |
| `A-05` | `ward.officer@pc02hcm.com` | `Pa$$w0rd!` | Cán bộ phường | ACTIVE | Test ward auto-assign |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| name | `A` | `min` | **OK** |  |
| name | `<500 chars>` | `max` | **OK** |  |
| name | `<501 chars>` | `max+1` | **400** |  |
| crime | `<255 chars>` | `max` | **OK** |  |
| crime | `<256 chars>` | `max+1` | **400** |  |
| sourceDocumentNote | `<1000 chars>` | `max` | **OK** |  |
| sourceDocumentNote | `<1001 chars>` | `max+1` | **400** |  |
| limit | `1` | `min` | **OK** |  |
| limit | `100` | `max` | **OK** |  |
| limit | `101` | `max+1` | **400** |  |
| offset | `0` | `min` | **OK** |  |
| offset | `-1` | `min-1` | **400** |  |
| reason | `<10 chars>` | `min` | **OK** |  |
| reason | `<9 chars>` | `min-1` | **400** |  |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
|  | `' OR 1=1 --` |  | 200 không leak | `` |
|  | `"; DROP TABLE cases; --` |  | 200 không exception | `` |
|  | `<script>alert(1)</script>` |  | Escape HTML | `` |
|  | `<img src=x onerror=alert(1)>` |  | Escape | `` |
|  | `name; SELECT * FROM users` |  | 400 | `` |
|  | `../../etc/passwd` |  | 404/400 | `` |
|  | `<other-user-id>` |  | Ignored, set actor thật | `` |
|  | `Bearer <stale-token>` |  | 401 | `` |
|  | `http://evil.com` |  | Block | `` |
|  | `abc\x00def` |  | Strip/400 | `` |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Cases.Create | Tạo vụ án mới hợp lệ với provenance DIRECT_DISCOVERY | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Cases.Create | Tạo vụ án từ Petition (FROM_PETITION) với optimistic lock | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Cases.Create | Tạo vụ án từ Incident (FROM_INCIDENT) | 🚨 Critical |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | Cases.Create | Tạo vụ án UTDT với caseType=UY_THAC_DIEU_TRA và donViGiao | 🚨 Critical |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | Cases.Read | Liệt kê vụ án với pagination mặc định | ⚠️ High |
| [TC-008](#tc-008) | 🔴 P0 | `GREEN` | Cases.Update | Cập nhật vụ án với optimistic lock đúng | 🚨 Critical |
| [TC-009](#tc-009) | 🔴 P0 | `GREEN` | Cases.Update | Chuyển status TIEP_NHAN → DANG_DIEU_TRA | 🚨 Critical |
| [TC-010](#tc-010) | 🔴 P0 | `GREEN` | Cases.Update | Đặt status TAM_DINH_CHI có lyDoTamDinhChiVuAn | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | Cases.Delete | Soft-delete vụ án TIEP_NHAN bởi creator với reason | 🚨 Critical |
| [TC-012](#tc-012) | 🔴 P0 | `GREEN` | Cases.Restore | ADMIN restore vụ án đã xóa | ⚠️ High |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | Cases.Create | Tạo vụ án thiếu name (required) | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | Cases.Create | Tạo vụ án không có caseProvenance | 🚨 Critical |
| [TC-021](#tc-021) | 🔴 P0 | `RED` | Cases.Create | FROM_PETITION nhưng thiếu linkedPetitionId | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `RED` | Cases.Create | FROM_INCIDENT thiếu linkedIncidentId | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | Cases.Create | UY_THAC_DIEU_TRA thiếu donViGiao (v0.67.3.0) | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `RED` | Cases.Update | Optimistic lock conflict khi 2 user edit | 🚨 Critical |
| [TC-025](#tc-025) | 🔴 P0 | `RED` | Cases.Update | Đổi status sang TAM_DINH_CHI thiếu lyDoTamDinhChiVuAn | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | Cases.Delete | Non-creator non-admin xóa vụ án | 🚨 Critical |
| [TC-027](#tc-027) | 🔴 P0 | `RED` | Cases.Delete | Xóa vụ án không phải TIEP_NHAN | 🚨 Critical |
| [TC-028](#tc-028) | 🔴 P0 | `RED` | Cases.Delete | Xóa vụ án còn linked Petition/Incident | 🚨 Critical |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | Cases.Delete | Reason xóa <10 ký tự | ⚠️ High |
| [TC-030](#tc-030) | 🔴 P0 | `RED` | Cases.Restore | Non-ADMIN restore | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `RED` | Cases.Assign | Non-dispatcher gọi assign | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `RED` | Cases.Read | User ĐTV scope khác xem case không thuộc tổ | 🚨 Critical |
| [TC-048](#tc-048) | 🔴 P0 | `RED` | Cases.Auth | Truy cập không JWT | 🚨 Critical |
| [TC-049](#tc-049) | 🔴 P0 | `RED` | Cases.Auth | JWT hết hạn | 🚨 Critical |
| [TC-050](#tc-050) | 🔴 P0 | `RED` | Cases.Auth | JWT chữ ký sai | 🚨 Critical |
| [TC-051](#tc-051) | 🔴 P0 | `RED` | Cases.Read | Pre-migration createdById=NULL chỉ ADMIN xóa | ⚠️ High |
| [TC-064](#tc-064) | 🔴 P0 | `BOUNDARY` | Cases.Read | limit=100 (max) | ⚡ Medium |
| [TC-076](#tc-076) | 🔴 P0 | `STATE` | Cases.State | DANG_DIEU_TRA → DA_KET_LUAN | ⚠️ High |
| [TC-077](#tc-077) | 🔴 P0 | `STATE` | Cases.State | DA_KET_LUAN → DANG_TRUY_TO | ⚠️ High |
| [TC-078](#tc-078) | 🔴 P0 | `STATE` | Cases.State | DANG_TRUY_TO → DANG_XET_XU | ⚠️ High |
| [TC-079](#tc-079) | 🔴 P0 | `STATE` | Cases.State | TAM_DINH_CHI → DA_KET_LUAN (phục hồi) | 🚨 Critical |
| [TC-080](#tc-080) | 🔴 P0 | `STATE` | Cases.State | DINH_CHI là terminal | 🚨 Critical |
| [TC-084](#tc-084) | 🔴 P0 | `DECISION` | Cases.UTDT | Decision Table — trangThaiPhanHoi 4 case | 🚨 Critical |
| [TC-085](#tc-085) | 🔴 P0 | `DECISION` | Cases.TDC | Decision Table — lyDoTamDinhChiVuAn cần khi status=TAM_DINH_CHI | 🚨 Critical |
| [TC-086](#tc-086) | 🔴 P0 | `SECURITY` | Cases.Security | SQL Injection trong search | 🚨 Critical |
| [TC-087](#tc-087) | 🔴 P0 | `SECURITY` | Cases.Security | XSS trong name vụ án | 🚨 Critical |
| [TC-088](#tc-088) | 🔴 P0 | `SECURITY` | Cases.Security | IDOR — đoán id case khác đơn vị | 🚨 Critical |
| [TC-089](#tc-089) | 🔴 P0 | `SECURITY` | Cases.Security | Mass assignment — gửi createdById trong body | 🚨 Critical |
| [TC-090](#tc-090) | 🔴 P0 | `SECURITY` | Cases.Security | CSRF — POST không token | 🚨 Critical |
| [TC-117](#tc-117) | 🔴 P0 | `PERFORMANCE` | Cases.Perf | GET /cases list 1000 record < 2s | ⚠️ High |
| [TC-121](#tc-121) | 🔴 P0 | `INTEGRATION` | Cases.Notify | Tạo case assigned → SSE/push tới investigator | ⚠️ High |
| [TC-006](#tc-006) | 🟠 P1 | `GREEN` | Cases.Read | Filter theo status=DANG_DIEU_TRA | ⚠️ High |
| [TC-007](#tc-007) | 🟠 P1 | `GREEN` | Cases.Read | Search theo tên vụ án (ILIKE) | ⚡ Medium |
| [TC-013](#tc-013) | 🟠 P1 | `GREEN` | Cases.Assign | Dispatcher gán investigator cho vụ án | ⚠️ High |
| [TC-014](#tc-014) | 🟠 P1 | `GREEN` | Cases.Export | Export Excel theo phường | ⚡ Medium |
| [TC-015](#tc-015) | 🟠 P1 | `GREEN` | Cases.Bulk | Bulk delete 5 vụ án | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `GREEN` | Cases.Journey | Xem journey timeline của vụ án | ⚡ Medium |
| [TC-033](#tc-033) | 🟠 P1 | `RED` | Cases.Read | limit > 100 | ⚡ Medium |
| [TC-034](#tc-034) | 🟠 P1 | `RED` | Cases.Read | offset âm | ⚡ Medium |
| [TC-035](#tc-035) | 🟠 P1 | `RED` | Cases.Read | fromDate > toDate | ⚡ Medium |
| [TC-036](#tc-036) | 🟠 P1 | `RED` | Cases.Update | Update tên >500 ký tự | ⚠️ High |
| [TC-037](#tc-037) | 🟠 P1 | `RED` | Cases.Create | Crime > 255 ký tự | ⚠️ High |
| [TC-038](#tc-038) | 🟠 P1 | `RED` | Cases.Create | sourceDocumentNote > 1000 ký tự | ⚡ Medium |
| [TC-039](#tc-039) | 🟠 P1 | `RED` | Cases.Create | Subjects > 100 | ⚠️ High |
| [TC-040](#tc-040) | 🟠 P1 | `RED` | Cases.Create | Evidences > 100 | ⚠️ High |
| [TC-041](#tc-041) | 🟠 P1 | `RED` | Cases.Create | documentIds > 50 | ⚡ Medium |
| [TC-042](#tc-042) | 🟠 P1 | `RED` | Cases.Create | investigatorId không tồn tại | ⚠️ High |
| [TC-043](#tc-043) | 🟠 P1 | `RED` | Cases.Create | assignedTeamId thuộc đơn vị khác | ⚠️ High |
| [TC-044](#tc-044) | 🟠 P1 | `RED` | Cases.Create | deadline trong quá khứ | ⚡ Medium |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | Cases.Create | ngayKhoiTo định dạng sai | ⚡ Medium |
| [TC-046](#tc-046) | 🟠 P1 | `RED` | Cases.Create | capDoToiPham không hợp lệ | ⚡ Medium |
| [TC-047](#tc-047) | 🟠 P1 | `RED` | Cases.Create | loaiUyThac không thuộc enum | ⚡ Medium |
| [TC-052](#tc-052) | 🟠 P1 | `RED` | Cases.Read | sortBy với cột không tồn tại | ⚠️ High |
| [TC-053](#tc-053) | 🟠 P1 | `RED` | Cases.Read | trangThaiPhanHoi không hợp lệ | ⚡ Medium |
| [TC-054](#tc-054) | 🟠 P1 | `RED` | Cases.Update | Update vụ án đã soft-delete | ⚠️ High |
| [TC-055](#tc-055) | 🟠 P1 | `RED` | Cases.Bulk | Bulk assign với ids khác đơn vị | ⚠️ High |
| [TC-056](#tc-056) | 🟠 P1 | `RED` | Cases.Bulk | Bulk delete > 100 items | ⚡ Medium |
| [TC-057](#tc-057) | 🟠 P1 | `RED` | Cases.Export | Export vượt rate limit 5/min | ⚡ Medium |
| [TC-058](#tc-058) | 🟠 P1 | `RED` | Cases.Create | linkedPetitionId thuộc Petition đã linked case khác | ⚠️ High |
| [TC-059](#tc-059) | 🟠 P1 | `RED` | Cases.Create | linkedIncidentId đã được dùng (@unique) | ⚠️ High |
| [TC-060](#tc-060) | 🟠 P1 | `RED` | Cases.Update | Đổi caseProvenance sau khi tạo | ⚡ Medium |
| [TC-061](#tc-061) | 🟠 P1 | `BOUNDARY` | Cases.Create | name = 500 ký tự (max) | ⚡ Medium |
| [TC-062](#tc-062) | 🟠 P1 | `BOUNDARY` | Cases.Create | name = 499 ký tự (max-1) | 📌 Low |
| [TC-063](#tc-063) | 🟠 P1 | `BOUNDARY` | Cases.Create | name = 1 ký tự (min) | 📌 Low |
| [TC-065](#tc-065) | 🟠 P1 | `BOUNDARY` | Cases.Read | limit=1 (min) | 📌 Low |
| [TC-066](#tc-066) | 🟠 P1 | `BOUNDARY` | Cases.Create | reason xóa = 10 ký tự (min) | 📌 Low |
| [TC-067](#tc-067) | 🟠 P1 | `BOUNDARY` | Cases.Create | reason xóa = 500 ký tự (max) | 📌 Low |
| [TC-068](#tc-068) | 🟠 P1 | `BOUNDARY` | Cases.Create | subjects = 100 (max) | ⚡ Medium |
| [TC-069](#tc-069) | 🟠 P1 | `BOUNDARY` | Cases.Create | evidences = 100 (max) | ⚡ Medium |
| [TC-071](#tc-071) | 🟠 P1 | `EP` | Cases.Create | caseProvenance hợp lệ — partition cho mỗi giá trị 8 enum | ⚠️ High |
| [TC-072](#tc-072) | 🟠 P1 | `EP` | Cases.Read | status enum 10 giá trị filter ra đúng partition | ⚡ Medium |
| [TC-073](#tc-073) | 🟠 P1 | `EP` | Cases.Read | capDoToiPham 4 partition | 📌 Low |
| [TC-074](#tc-074) | 🟠 P1 | `EP` | Cases.Read | sortOrder asc / desc | 📌 Low |
| [TC-081](#tc-081) | 🟠 P1 | `STATE` | Cases.State | soLanTamDinhChi auto-increment khi vào TĐC lần 2 | ⚠️ High |
| [TC-083](#tc-083) | 🟠 P1 | `STATE` | Cases.State | CaseStatusHistory ghi cả from + to + changedBy | ⚠️ High |
| [TC-091](#tc-091) | 🟠 P1 | `SECURITY` | Cases.Security | Path traversal trong filename export | ⚠️ High |
| [TC-092](#tc-092) | 🟠 P1 | `SECURITY` | Cases.Security | NoSQL/Prisma injection trong sortBy | 🚨 Critical |
| [TC-093](#tc-093) | 🟠 P1 | `SECURITY` | Cases.Security | Rate limit brute force list endpoint | ⚠️ High |
| [TC-094](#tc-094) | 🟠 P1 | `SECURITY` | Cases.Security | Auth missing trên restore admin endpoint | 🚨 Critical |
| [TC-095](#tc-095) | 🟠 P1 | `SECURITY` | Cases.Security | Sensitive data exposure trong audit log API | ⚠️ High |
| [TC-096](#tc-096) | 🟠 P1 | `SECURITY` | Cases.Security | CORS — origin trái phép bị reject | ⚠️ High |
| [TC-097](#tc-097) | 🟠 P1 | `SECURITY` | Cases.Security | JWT replay sau logout | 🚨 Critical |
| [TC-098](#tc-098) | 🟠 P1 | `DATA` | Cases.Data | Tên vụ án Unicode đa byte (tiếng Việt + emoji) | ⚡ Medium |
| [TC-099](#tc-099) | 🟠 P1 | `DATA` | Cases.Data | Trim leading/trailing space | 📌 Low |
| [TC-100](#tc-100) | 🟠 P1 | `DATA` | Cases.Data | Null byte injection | ⚡ Medium |
| [TC-103](#tc-103) | 🟠 P1 | `EDGE` | Cases.Create | Tạo 2 case song song cùng linkedIncidentId | ⚠️ High |
| [TC-104](#tc-104) | 🟠 P1 | `EDGE` | Cases.Create | Subjects/Evidences trùng code trong 1 case | ⚡ Medium |
| [TC-106](#tc-106) | 🟠 P1 | `A11Y` | Cases.UI | Tab key di chuyển focus qua mọi field form | ⚠️ High |
| [TC-107](#tc-107) | 🟠 P1 | `A11Y` | Cases.UI | Label gắn đúng với input (htmlFor) | ⚠️ High |
| [TC-108](#tc-108) | 🟠 P1 | `A11Y` | Cases.UI | Contrast badge status ≥ 4.5:1 | ⚡ Medium |
| [TC-111](#tc-111) | 🟠 P1 | `COMPAT` | Cases.UI | Chrome 130+ Windows | ⚠️ High |
| [TC-112](#tc-112) | 🟠 P1 | `COMPAT` | Cases.UI | Firefox 130+ macOS | ⚡ Medium |
| [TC-115](#tc-115) | 🟠 P1 | `COMPAT` | Cases.UI | Mobile portrait 375x667 (iPhone SE) | ⚠️ High |
| [TC-118](#tc-118) | 🟠 P1 | `PERFORMANCE` | Cases.Perf | POST tạo case kèm 100 subjects + 100 evidences < 5s | ⚠️ High |
| [TC-119](#tc-119) | 🟠 P1 | `PERFORMANCE` | Cases.Perf | 50 concurrent GET /cases/stats không sập | ⚠️ High |
| [TC-122](#tc-122) | 🟠 P1 | `INTEGRATION` | Cases.Doc | Generate caseCode auto khi tạo | ⚠️ High |
| [TC-123](#tc-123) | 🟠 P1 | `RED` | Cases.Create | Tạo case với metadata vượt 64KB JSON | ⚡ Medium |
| [TC-124](#tc-124) | 🟠 P1 | `RED` | Cases.Create | caseProvenance=FROM_PETITION với linkedPetitionId không tồn tại | ⚠️ High |
| [TC-125](#tc-125) | 🟠 P1 | `RED` | Cases.Create | linkedPetitionId thuộc Petition đã soft-delete | ⚠️ High |
| [TC-126](#tc-126) | 🟠 P1 | `RED` | Cases.Create | linkedIncidentId thuộc Incident đã soft-delete | ⚠️ High |
| [TC-127](#tc-127) | 🟠 P1 | `RED` | Cases.Update | Update của user khác đơn vị | 🚨 Critical |
| [TC-128](#tc-128) | 🟠 P1 | `RED` | Cases.Read | Stats vụ án không trong scope | ⚠️ High |
| [TC-129](#tc-129) | 🟠 P1 | `RED` | Cases.Atomic | Subject thiếu fullName trong atomic create | ⚠️ High |
| [TC-130](#tc-130) | 🟠 P1 | `RED` | Cases.Atomic | Evidence thiếu code | ⚠️ High |
| [TC-131](#tc-131) | 🟠 P1 | `RED` | Cases.Atomic | documentIds chứa id không tồn tại | ⚠️ High |
| [TC-132](#tc-132) | 🟠 P1 | `RED` | Cases.Update | TĐC backfill bởi non-creator non-admin | ⚠️ High |
| [TC-133](#tc-133) | 🟠 P1 | `RED` | Cases.Read | Journey với page=-1 | 📌 Low |
| [TC-134](#tc-134) | 🟠 P1 | `RED` | Cases.Read | limit journey > 200 | 📌 Low |
| [TC-135](#tc-135) | 🟠 P1 | `RED` | Cases.Create | sourceDocumentNote điền khi caseProvenance=FROM_PETITION | ⚡ Medium |
| [TC-136](#tc-136) | 🟠 P1 | `RED` | Cases.Bulk | Bulk export với ids rỗng | 📌 Low |
| [TC-137](#tc-137) | 🟠 P1 | `RED` | Cases.UTDT | ngayTraKetQua < ngayTiepNhan | ⚡ Medium |
| [TC-138](#tc-138) | 🟠 P1 | `SECURITY` | Cases.Security | XXE trong upload XML metadata | ⚠️ High |
| [TC-139](#tc-139) | 🟠 P1 | `SECURITY` | Cases.Security | SSRF qua URL field trong notes | ⚠️ High |
| [TC-140](#tc-140) | 🟠 P1 | `SECURITY` | Cases.Security | Privilege escalation — đổi role qua body | 🚨 Critical |
| [TC-141](#tc-141) | 🟠 P1 | `SECURITY` | Cases.Security | HTTP method tampering DELETE qua POST _method | ⚠️ High |
| [TC-142](#tc-142) | 🟠 P1 | `A11Y` | Cases.UI | Form error message screen reader đọc được | ⚠️ High |
| [TC-143](#tc-143) | 🟠 P1 | `A11Y` | Cases.UI | Keyboard ESC đóng dialog confirm delete | ⚡ Medium |
| [TC-145](#tc-145) | 🟠 P1 | `RED` | Cases.Read | Pagination total > tổng thật do scope leak | 🚨 Critical |
| [TC-146](#tc-146) | 🟠 P1 | `RED` | Cases.Read | Search SQL keyword reserved | ⚡ Medium |
| [TC-147](#tc-147) | 🟠 P1 | `RED` | Cases.Create | loaiThongTin > 200 ký tự | 📌 Low |
| [TC-017](#tc-017) | 🟡 P2 | `GREEN` | Cases.Stats | GET /cases/stats trả về count đúng theo status | 📌 Low |
| [TC-018](#tc-018) | 🟡 P2 | `GREEN` | Cases.Atomic | Tạo case kèm 3 subjects + 2 evidences atomic | ⚠️ High |
| [TC-070](#tc-070) | 🟡 P2 | `BOUNDARY` | Cases.Read | offset=0 (min) | 📌 Low |
| [TC-075](#tc-075) | 🟡 P2 | `EP` | Cases.Read | overdue=true vs false | 📌 Low |
| [TC-082](#tc-082) | 🟡 P2 | `STATE` | Cases.State | DA_LUU_TRU không cho edit field nghiệp vụ | ⚡ Medium |
| [TC-101](#tc-101) | 🟡 P2 | `DATA` | Cases.Data | Date ISO8601 timezone VN (UTC+7) | ⚡ Medium |
| [TC-102](#tc-102) | 🟡 P2 | `DATA` | Cases.Data | Number overflow soLanTamDinhChi | 📌 Low |
| [TC-105](#tc-105) | 🟡 P2 | `EDGE` | Cases.Stats | Stats khi DB rỗng (0 case) | 📌 Low |
| [TC-109](#tc-109) | 🟡 P2 | `A11Y` | Cases.UI | Error message announce qua aria-live | ⚡ Medium |
| [TC-110](#tc-110) | 🟡 P2 | `A11Y` | Cases.UI | Skip link đến nội dung chính | 📌 Low |
| [TC-113](#tc-113) | 🟡 P2 | `COMPAT` | Cases.UI | Edge 130+ | 📌 Low |
| [TC-114](#tc-114) | 🟡 P2 | `COMPAT` | Cases.UI | Safari 17+ | 📌 Low |
| [TC-116](#tc-116) | 🟡 P2 | `COMPAT` | Cases.UI | Tablet 768x1024 | 📌 Low |
| [TC-120](#tc-120) | 🟡 P2 | `PERFORMANCE` | Cases.Perf | Export 5000 case không OOM | ⚡ Medium |
| [TC-144](#tc-144) | 🟡 P2 | `A11Y` | Cases.UI | Icon-only button có aria-label | ⚡ Medium |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án mới hợp lệ với provenance DIRECT_DISCOVERY

### Điều kiện tiên quyết
- User đăng nhập role ĐTV với quyền write:Case; có Team được gán

### Các bước kiểm thử
- [ ] Vào /cases/new
- [ ] Nhập tên vụ án 'Vụ án trộm cắp ABC'
- [ ] Chọn caseProvenance=DIRECT_DISCOVERY
- [ ] Chọn capDoToiPham=NGHIEM_TRONG
- [ ] Bấm 'Lưu'

### Dữ liệu kiểm thử
```
name='Vụ án trộm cắp ABC', caseProvenance='DIRECT_DISCOVERY', sourceDocumentNote='Phát hiện qua tuần tra'
```

### Kết quả mong đợi
**UI**:
- Hiện toast 'Tạo thành công', redirect về /cases/:id

**API**:
- POST /api/v1/cases → 201, body có id + caseCode auto-gen

**Side effects** (DB, email, log, queue...):
- Insert row vào bảng cases; AuditLog ghi CASE_CREATED; status=TIEP_NHAN; deadline tự tính

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Cases.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Core happy path

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-02`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án từ Petition (FROM_PETITION) với optimistic lock

### Điều kiện tiên quyết
- Có Petition chưa link case (linkedCaseId=null)

### Các bước kiểm thử
- [ ] Mở Petition picker
- [ ] Chọn 1 Petition unlinked
- [ ] caseProvenance auto=FROM_PETITION, linkedPetitionId fill
- [ ] Lưu

### Dữ liệu kiểm thử
```
linkedPetitionId=<existing>, expectedPetitionUpdatedAt=<current updatedAt>
```

### Kết quả mong đợi
**UI**:
- Tạo Case thành công, link 2 chiều

**API**:
- POST /cases → 201; Petition.linkedCaseId được set

**Side effects** (DB, email, log, queue...):
- Petition.status đổi DA_CHUYEN_VU_AN; AuditLog ghi CASE_CREATED + PETITION_LINKED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: Critical
module: Cases.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Bi-directional link

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-03`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án từ Incident (FROM_INCIDENT)

### Điều kiện tiên quyết
- Có Incident chưa link case

### Các bước kiểm thử
- [ ] Trên Incident detail bấm 'Khởi tố'
- [ ] Form prefill linkedIncidentId, caseProvenance=FROM_INCIDENT
- [ ] Submit

### Dữ liệu kiểm thử
```
linkedIncidentId=<id>, expectedIncidentUpdatedAt=<value>
```

### Kết quả mong đợi
**UI**:
- Redirect tới Case mới

**API**:
- ; Incident.status → DA_CHUYEN_VU_AN

**Side effects** (DB, email, log, queue...):
- Incident.linkedCaseId set, CaseStatusHistory entry

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: Critical
module: Cases.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Branch-3 prosecute

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-04`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án UTDT với caseType=UY_THAC_DIEU_TRA và donViGiao

### Điều kiện tiên quyết
- User có quyền write:Case

### Các bước kiểm thử
- [ ] /cases/new?caseProvenance=UY_THAC_DIEU_TRA
- [ ] Điền donViGiao='PC02 CA TP HCM'
- [ ] Chọn loaiUyThac=UY_THAC_DIEU_TRA
- [ ] Nhập soQuyetDinhUyThac
- [ ] Lưu

### Dữ liệu kiểm thử
```
caseType='UY_THAC_DIEU_TRA', donViGiao='PC02', loaiUyThac='UY_THAC_DIEU_TRA'
```

### Kết quả mong đợi
**UI**:
- Lưu thành công, tab 'Thông tin Ủy thác' hiển thị

**API**:

**Side effects** (DB, email, log, queue...):
- Case.caseType=UY_THAC_DIEU_TRA, caseProvenance=UY_THAC_DIEU_TRA

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: Critical
module: Cases.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.44 UTDT integration

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Liệt kê vụ án với pagination mặc định

### Điều kiện tiên quyết
- DB có ≥25 vụ án trong scope user

### Các bước kiểm thử
- [ ] GET /cases
- [ ] Quan sát phân trang

### Dữ liệu kiểm thử
```
limit=20, offset=0
```

### Kết quả mong đợi
**UI**:
- List page hiển thị 20 row, tổng count, nút Next

**API**:
- , body {data:[...], total, limit:20, offset:0}

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: High
module: Cases.Read
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Cập nhật vụ án với optimistic lock đúng

### Điều kiện tiên quyết
- Vụ án id=X, lấy updatedAt hiện tại

### Các bước kiểm thử
- [ ] PUT /cases/X với expectedUpdatedAt=current
- [ ] Đổi name

### Dữ liệu kiểm thử
```
name='Vụ án mới', expectedUpdatedAt=<current>
```

### Kết quả mong đợi
**UI**:
- Toast 'Cập nhật thành công'

**API**:
- , body updatedAt mới

**Side effects** (DB, email, log, queue...):
- AuditLog CASE_UPDATED có diff

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: Critical
module: Cases.Update
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-ST-01`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Chuyển status TIEP_NHAN → DANG_DIEU_TRA

### Điều kiện tiên quyết
- Case status=TIEP_NHAN

### Các bước kiểm thử
- [ ] Edit case
- [ ] Chọn status=DANG_DIEU_TRA
- [ ] Lưu

### Dữ liệu kiểm thử
```
status='DANG_DIEU_TRA'
```

### Kết quả mong đợi
**UI**:
- Status badge chuyển

**API**:

**Side effects** (DB, email, log, queue...):
- CaseStatusHistory thêm entry (from→to, changedBy, createdAt)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Critical
module: Cases.Update
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-TDC-01`
- Kỹ thuật: `State Transition + Decision`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đặt status TAM_DINH_CHI có lyDoTamDinhChiVuAn

### Điều kiện tiên quyết
- Case status hợp lệ chuyển TDC

### Các bước kiểm thử
- [ ] Đổi status=TAM_DINH_CHI
- [ ] Chọn lyDoTamDinhChiVuAn=BI_CAN_BENH_TAM_THAN
- [ ] Nhập soQuyetDinhTamDinhChi='QĐ123'
- [ ] Lưu

### Dữ liệu kiểm thử
```
status='TAM_DINH_CHI', lyDoTamDinhChiVuAn='BI_CAN_BENH_TAM_THAN', soQuyetDinhTamDinhChi='QĐ123'
```

### Kết quả mong đợi
**UI**:
- Lưu OK, hiển thị badge TĐC

**API**:

**Side effects** (DB, email, log, queue...):
- Tự set ngayTamDinhChi=now(); soLanTamDinhChi+=1; AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Critical
module: Cases.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: BLTTHS Đ.229

---

## TC-011

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Cases.Delete`
- Yêu cầu: `REQ-CASE-DEL-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Soft-delete vụ án TIEP_NHAN bởi creator với reason

### Điều kiện tiên quyết
- Case status=TIEP_NHAN, không có sub-entity

### Các bước kiểm thử
- [ ] DELETE /cases/X body {reason:'Trùng lặp với vụ Y, dài >=10 ký tự'}

### Dữ liệu kiểm thử
```
reason='Trùng lặp với vụ Y'
```

### Kết quả mong đợi
**UI**:
- Toast xóa thành công

**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt set, không xóa thật; AuditLog CASE_DELETED có reason

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Delete`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Cases.Delete
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
- Module: `Cases.Restore`
- Yêu cầu: `REQ-CASE-RES-01`
- Kỹ thuật: `Happy Path`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: ADMIN restore vụ án đã xóa

### Điều kiện tiên quyết
- Case đã soft-delete; user role ADMIN

### Các bước kiểm thử
- [ ] POST /cases/X/restore body {reason:'Khôi phục do quyết định mới'}

### Dữ liệu kiểm thử
```
reason='Khôi phục do QĐ mới'
```

### Kết quả mong đợi
**UI**:
- Toast khôi phục

**API**:

**Side effects** (DB, email, log, queue...):
- deletedAt=null; AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Restore`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: Cases.Restore
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án thiếu name (required)

### Điều kiện tiên quyết
- Form mở

### Các bước kiểm thử
- [ ] Bỏ trống name
- [ ] Submit

### Dữ liệu kiểm thử
```
name=''
```

### Kết quả mong đợi
**UI**:
- Hiển thị lỗi 'Tên vụ án bắt buộc' inline

**API**:
- , body errors.name

**Side effects** (DB, email, log, queue...):
- Không insert DB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án không có caseProvenance

### Các bước kiểm thử
- [ ] Bỏ caseProvenance

### Dữ liệu kiểm thử
```
caseProvenance=undefined
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Nguồn gốc bắt buộc'

**API**:

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: FROM_PETITION nhưng thiếu linkedPetitionId

### Các bước kiểm thử
- [ ] caseProvenance=FROM_PETITION
- [ ] Bỏ linkedPetitionId

### Dữ liệu kiểm thử
```
caseProvenance='FROM_PETITION', linkedPetitionId=undefined
```

### Kết quả mong đợi
**UI**:
- Lỗi yêu cầu chọn Petition

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: Critical
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: FROM_INCIDENT thiếu linkedIncidentId

### Các bước kiểm thử
- [ ] caseProvenance=FROM_INCIDENT
- [ ] Bỏ linkedIncidentId

### Dữ liệu kiểm thử
```
linkedIncidentId=undefined
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Vụ việc nguồn bắt buộc'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: Critical
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-UTDT-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UY_THAC_DIEU_TRA thiếu donViGiao (v0.67.3.0)

### Các bước kiểm thử
- [ ] caseProvenance=UY_THAC_DIEU_TRA
- [ ] Bỏ donViGiao

### Dữ liệu kiểm thử
```
caseType='UY_THAC_DIEU_TRA', donViGiao=''
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Đơn vị giao ủy thác là bắt buộc' surface ra UI (không nuốt)

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Cases.Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.67.3.0 real-error fix

---

## TC-024

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Optimistic lock conflict khi 2 user edit

### Điều kiện tiên quyết
- User A và B mở cùng case

### Các bước kiểm thử
- [ ] A lưu xong
- [ ] B lưu với expectedUpdatedAt cũ

### Dữ liệu kiểm thử
```
expectedUpdatedAt=<stale>
```

### Kết quả mong đợi
**UI**:
- Dialog 'Dữ liệu đã thay đổi, vui lòng tải lại'

**API**:
- Conflict

**Side effects** (DB, email, log, queue...):
- Không ghi đè

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Critical
module: Cases.Update
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-TDC-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đổi status sang TAM_DINH_CHI thiếu lyDoTamDinhChiVuAn

### Các bước kiểm thử
- [ ] status='TAM_DINH_CHI'
- [ ] Bỏ lyDoTamDinhChiVuAn

### Dữ liệu kiểm thử
```
status='TAM_DINH_CHI', lyDoTamDinhChiVuAn=undefined
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Lý do tạm đình chỉ bắt buộc'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Critical
module: Cases.Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: BLTTHS Đ.229

---

## TC-026

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Cases.Delete`
- Yêu cầu: `REQ-CASE-DEL-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-creator non-admin xóa vụ án

### Điều kiện tiên quyết
- User != creator và không ADMIN

### Các bước kiểm thử
- [ ] DELETE /cases/X

### Kết quả mong đợi
**UI**:
- Toast 'Không có quyền'

**API**:
- Forbidden

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Critical
module: Cases.Delete
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
- Module: `Cases.Delete`
- Yêu cầu: `REQ-CASE-DEL-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa vụ án không phải TIEP_NHAN

### Điều kiện tiên quyết
- Case status=DANG_DIEU_TRA

### Các bước kiểm thử
- [ ] Bấm Delete

### Dữ liệu kiểm thử
```
reason='OK'
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Chỉ xóa được vụ án ở trạng thái tiếp nhận'

**API**:
- /422

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Critical
module: Cases.Delete
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
- Module: `Cases.Delete`
- Yêu cầu: `REQ-CASE-DEL-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa vụ án còn linked Petition/Incident

### Điều kiện tiên quyết
- Case có linkedPetitionId

### Các bước kiểm thử
- [ ] Bấm Delete

### Kết quả mong đợi
**UI**:
- Lỗi 'Còn liên kết với Petition'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Critical
module: Cases.Delete
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
- Module: `Cases.Delete`
- Yêu cầu: `REQ-CASE-DEL-04`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Reason xóa <10 ký tự

### Các bước kiểm thử
- [ ] reason='ngắn'

### Dữ liệu kiểm thử
```
reason='ngắn'
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Lý do tối thiểu 10 ký tự'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: High
module: Cases.Delete
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
- Module: `Cases.Restore`
- Yêu cầu: `REQ-CASE-RES-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-ADMIN restore

### Điều kiện tiên quyết
- User role ĐTV

### Các bước kiểm thử
- [ ] POST /cases/X/restore

### Kết quả mong đợi
**UI**:

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Restore`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: Cases.Restore
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
- Module: `Cases.Assign`
- Yêu cầu: `REQ-CASE-ASN-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-dispatcher gọi assign

### Điều kiện tiên quyết
- User không canDispatch

### Các bước kiểm thử
- [ ] PATCH /cases/X/assign

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Assign`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Critical
module: Cases.Assign
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-04`
- Kỹ thuật: `Negative IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User ĐTV scope khác xem case không thuộc tổ

### Điều kiện tiên quyết
- Case của Team B; user thuộc Team A

### Các bước kiểm thử
- [ ] GET /cases/<idOfTeamB>

### Kết quả mong đợi
**API**:
- (không leak existence)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: Cases.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DataScope enforcement

---

## TC-048

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Cases.Auth`
- Yêu cầu: `REQ-CASE-AUTH-01`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Truy cập không JWT

### Các bước kiểm thử
- [ ] GET /cases không header

### Kết quả mong đợi
**UI**:
- Redirect /login

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Critical
module: Cases.Auth
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
- Priority: `P0` 🔴
- Module: `Cases.Auth`
- Yêu cầu: `REQ-CASE-AUTH-02`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT hết hạn

### Điều kiện tiên quyết
- Token exp<now

### Các bước kiểm thử
- [ ] GET /cases

### Kết quả mong đợi
**UI**:
- Toast 'Phiên hết hạn'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Critical
module: Cases.Auth
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
- Priority: `P0` 🔴
- Module: `Cases.Auth`
- Yêu cầu: `REQ-CASE-AUTH-03`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT chữ ký sai

### Các bước kiểm thử
- [ ] Token sai signature

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Auth`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Auth`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Critical
module: Cases.Auth
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
- Priority: `P0` 🔴
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-DEL-05`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Pre-migration createdById=NULL chỉ ADMIN xóa

### Điều kiện tiên quyết
- Case createdById=NULL

### Các bước kiểm thử
- [ ] ĐTV thường DELETE

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: High
module: Cases.Read
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
- Loại: `BOUNDARY`
- Priority: `P0` 🔴
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: limit=100 (max)

### Các bước kiểm thử
- [ ] limit=100

### Kết quả mong đợi
**UI**:
- row

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Medium
module: Cases.Read
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-02`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DANG_DIEU_TRA → DA_KET_LUAN

### Điều kiện tiên quyết
- status=DANG_DIEU_TRA

### Các bước kiểm thử
- [ ] PUT status=DA_KET_LUAN

### Kết quả mong đợi
**UI**:
- Badge đổi

**API**:

**Side effects** (DB, email, log, queue...):
- History

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: High
module: Cases.State
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-03`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DA_KET_LUAN → DANG_TRUY_TO

### Các bước kiểm thử
- [ ] PUT status

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: High
module: Cases.State
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-04`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DANG_TRUY_TO → DANG_XET_XU

### Các bước kiểm thử
- [ ] PUT

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: High
module: Cases.State
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-05`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: TAM_DINH_CHI → DA_KET_LUAN (phục hồi)

### Điều kiện tiên quyết
- TĐC + có soQuyetDinhPhucHoi

### Các bước kiểm thử
- [ ] PUT status=DA_KET_LUAN; ketQuaPhucHoiVuAn=KET_LUAN_DE_NGHI_TRUY_TO

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: Critical
module: Cases.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: BLTTHS Đ.229

---

## TC-080

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-06`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DINH_CHI là terminal

### Điều kiện tiên quyết
- status=DINH_CHI

### Các bước kiểm thử
- [ ] PUT status=DANG_DIEU_TRA

### Kết quả mong đợi
**UI**:
- Lỗi 'Không thể đổi từ Đình chỉ'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: Cases.State
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm policy

---

## TC-084

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Cases.UTDT`
- Yêu cầu: `REQ-CASE-UTDT-DT-01`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Decision Table — trangThaiPhanHoi 4 case

### Điều kiện tiên quyết
- UTDT case mỗi trạng thái

### Các bước kiểm thử
- [ ] ketQuaUyThac+ngayTraKetQua → DA_PHAN_HOI
- [ ] utdt_lyDoKhongThucHienDuoc → KHONG_THUC_HIEN_DUOC
- [ ] now>thoiHanUyThac → QUA_HAN
- [ ] default → CHUA_PHAN_HOI

### Dữ liệu kiểm thử
```
4 fixtures
```

### Kết quả mong đợi
**UI**:
- Badge đúng cho mỗi case

**API**:
- GET /cases/utdt-stats trả count đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UTDT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UTDT`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: Critical
module: Cases.UTDT
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
- Module: `Cases.TDC`
- Yêu cầu: `REQ-CASE-TDC-DT-01`
- Kỹ thuật: `Decision Table`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Decision Table — lyDoTamDinhChiVuAn cần khi status=TAM_DINH_CHI

### Các bước kiểm thử
- [ ] status=TAM_DINH_CHI + có lyDo → 200
- [ ] status=TAM_DINH_CHI + bỏ lyDo → 400
- [ ] status≠TAM_DINH_CHI + có lyDo → 200 (ignore)
- [ ] status≠TAM_DINH_CHI + bỏ → 200

### Dữ liệu kiểm thử
```
4 combination
```

### Kết quả mong đợi
### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.TDC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.TDC`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: Critical
module: Cases.TDC
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-01`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SQL Injection trong search

### Các bước kiểm thử
- [ ] ?search=' OR 1=1 --

### Dữ liệu kiểm thử
```
search="' OR 1=1 --"
```

### Kết quả mong đợi
**API**:
- (parametrized), không leak data

**Side effects** (DB, email, log, queue...):
- Không exception SQL

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-02`
- Kỹ thuật: `OWASP A03`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: XSS trong name vụ án

### Các bước kiểm thử
- [ ] name='<script>alert(1)</script>'
- [ ] Xem detail

### Kết quả mong đợi
**UI**:
- Render text, KHÔNG execute JS

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-03`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR — đoán id case khác đơn vị

### Các bước kiểm thử
- [ ] GET /cases/<other-team-id>

### Kết quả mong đợi
**API**:
- không leak

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-04`
- Kỹ thuật: `OWASP A08`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mass assignment — gửi createdById trong body

### Các bước kiểm thử
- [ ] POST body có createdById='admin-id'

### Kết quả mong đợi
**API**:
- nhưng createdById = actor thật

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-05`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CSRF — POST không token

### Các bước kiểm thử
- [ ] Form POST từ origin khác

### Kết quả mong đợi
**API**:
- (CORS hoặc CSRF guard)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Critical
module: Cases.Security
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
- Module: `Cases.Perf`
- Yêu cầu: `REQ-CASE-PERF-01`
- Kỹ thuật: `Performance`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /cases list 1000 record < 2s

### Điều kiện tiên quyết
- Seed 1000 case

### Các bước kiểm thử
- [ ] GET /cases?limit=100

### Kết quả mong đợi
**API**:
- P95 < 2000ms

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: High
module: Cases.Perf
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
- Module: `Cases.Notify`
- Yêu cầu: `REQ-CASE-INT-01`
- Kỹ thuật: `Integration`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo case assigned → SSE/push tới investigator

### Điều kiện tiên quyết
- NotificationCenter v0.45

### Các bước kiểm thử
- [ ] Assign case
- [ ] Mở notification panel của investigator

### Kết quả mong đợi
**UI**:
- Notification hiện

**API**:
- SSE event CASE_ASSIGNED

**Side effects** (DB, email, log, queue...):
- Insert Notification row

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Notify`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Notify`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: High
module: Cases.Notify
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
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-02`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Filter theo status=DANG_DIEU_TRA

### Điều kiện tiên quyết
- Có vụ án ở nhiều status

### Các bước kiểm thử
- [ ] Chọn chip status=DANG_DIEU_TRA

### Dữ liệu kiểm thử
```
status=DANG_DIEU_TRA
```

### Kết quả mong đợi
**UI**:
- Chỉ hiện vụ án status=DANG_DIEU_TRA

**API**:
- , data items.status=='DANG_DIEU_TRA'

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: High
module: Cases.Read
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
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-03`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Search theo tên vụ án (ILIKE)

### Điều kiện tiên quyết
- Có vụ án tên chứa 'trộm cắp'

### Các bước kiểm thử
- [ ] Nhập 'trộm' vào ô search
- [ ] Enter

### Dữ liệu kiểm thử
```
search='trộm'
```

### Kết quả mong đợi
**UI**:
- List filter theo case insensitive

**API**:
- , name ILIKE %trộm%

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: Medium
module: Cases.Read
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
- Module: `Cases.Assign`
- Yêu cầu: `REQ-CASE-ASN-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Dispatcher gán investigator cho vụ án

### Điều kiện tiên quyết
- User role có canDispatch=true

### Các bước kiểm thử
- [ ] PATCH /cases/X/assign body {investigatorId, assignedTeamId}

### Dữ liệu kiểm thử
```
investigatorId='<uid>', assignedTeamId='<tid>'
```

### Kết quả mong đợi
**UI**:
- Toast gán thành công

**API**:

**Side effects** (DB, email, log, queue...):
- AuditLog CASE_ASSIGNED; thông báo SSE tới investigator

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Assign`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Assign`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: High
module: Cases.Assign
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
- Priority: `P1` 🟠
- Module: `Cases.Export`
- Yêu cầu: `REQ-CASE-EXP-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export Excel theo phường

### Điều kiện tiên quyết
- Có vụ án thuộc ward X

### Các bước kiểm thử
- [ ] GET /cases/export/ward?wardId=X

### Dữ liệu kiểm thử
```
wardId='<id>'
```

### Kết quả mong đợi
**UI**:
- Download file .xlsx

**API**:
- , content-type xlsx

**Side effects** (DB, email, log, queue...):
- AuditLog CASE_EXPORTED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Export`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Medium
module: Cases.Export
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
- Module: `Cases.Bulk`
- Yêu cầu: `REQ-CASE-BULK-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bulk delete 5 vụ án

### Điều kiện tiên quyết
- vụ án TIEP_NHAN của creator

### Các bước kiểm thử
- [ ] POST /cases/bulk-delete body {ids:[5 ids], reason}

### Dữ liệu kiểm thử
```
5 ids, reason='Clean up test data'
```

### Kết quả mong đợi
**UI**:
- Toast '5 vụ án đã xóa'

**API**:
- , body summary

**Side effects** (DB, email, log, queue...):
- row deletedAt set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Bulk`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: High
module: Cases.Bulk
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
- Module: `Cases.Journey`
- Yêu cầu: `REQ-CASE-JR-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Xem journey timeline của vụ án

### Điều kiện tiên quyết
- Vụ án có status history, subjects

### Các bước kiểm thử
- [ ] GET /cases/X/journey?page=1&limit=20

### Kết quả mong đợi
**UI**:
- Timeline render đúng thứ tự thời gian

**API**:
- , events sorted desc by createdAt

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Journey`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Journey`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: Medium
module: Cases.Journey
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
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-05`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: limit > 100

### Các bước kiểm thử
- [ ] GET /cases?limit=500

### Dữ liệu kiểm thử
```
limit=500
```

### Kết quả mong đợi
**API**:
- hoặc clamp về 100

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: Medium
module: Cases.Read
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
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: offset âm

### Các bước kiểm thử
- [ ] GET /cases?offset=-1

### Dữ liệu kiểm thử
```
offset=-1
```

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: Medium
module: Cases.Read
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
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: fromDate > toDate

### Các bước kiểm thử
- [ ] fromDate=2026-12-01&toDate=2026-01-01

### Kết quả mong đợi
**UI**:
- Empty list

**API**:
- [] hoặc 400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Medium
module: Cases.Read
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
- Priority: `P1` 🟠
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update tên >500 ký tự

### Các bước kiểm thử
- [ ] name='A' x 501

### Dữ liệu kiểm thử
```
name=501 char
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Tối đa 500 ký tự'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: High
module: Cases.Update
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
- Priority: `P1` 🟠
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-05`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Crime > 255 ký tự

### Các bước kiểm thử
- [ ] crime='X' x 256

### Dữ liệu kiểm thử
```
crime=256 char
```

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: sourceDocumentNote > 1000 ký tự

### Các bước kiểm thử
- [ ] sourceDocumentNote 1001 char

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-07`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Subjects > 100

### Các bước kiểm thử
- [ ] Thêm 101 subjects

### Dữ liệu kiểm thử
```
subjects.length=101
```

### Kết quả mong đợi
**UI**:
- Lỗi 'Tối đa 100 đối tượng'

**API**:

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Evidences > 100

### Các bước kiểm thử
- [ ] Thêm 101 evidences

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: documentIds > 50

### Các bước kiểm thử
- [ ] documentIds[51]

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: investigatorId không tồn tại

### Các bước kiểm thử
- [ ] investigatorId='nonexistent'

### Kết quả mong đợi
**UI**:
- Lỗi 'Điều tra viên không hợp lệ'

**API**:
- /404

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-11`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: assignedTeamId thuộc đơn vị khác

### Điều kiện tiên quyết
- User thuộc đơn vị X

### Các bước kiểm thử
- [ ] assignedTeamId thuộc Y

### Kết quả mong đợi
**API**:
- /400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-12`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: deadline trong quá khứ

### Các bước kiểm thử
- [ ] deadline='2020-01-01'

### Kết quả mong đợi
**UI**:
- Cảnh báo deadline quá khứ

**API**:
- + flag editedAfterWindow / hoặc 400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-13`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: ngayKhoiTo định dạng sai

### Các bước kiểm thử
- [ ] ngayKhoiTo='not-a-date'

### Kết quả mong đợi
**UI**:
- Lỗi format

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-14`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: capDoToiPham không hợp lệ

### Các bước kiểm thử
- [ ] capDoToiPham='ABC'

### Kết quả mong đợi
**UI**:
- Lỗi enum

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-15`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: loaiUyThac không thuộc enum

### Các bước kiểm thử
- [ ] loaiUyThac='XYZ'

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Medium
module: Cases.Create
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-08`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: sortBy với cột không tồn tại

### Các bước kiểm thử
- [ ] sortBy='hackerColumn'

### Kết quả mong đợi
**API**:
- hoặc fallback createdAt

**Side effects** (DB, email, log, queue...):
- Không SQL inject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: High
module: Cases.Read
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-09`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: trangThaiPhanHoi không hợp lệ

### Các bước kiểm thử
- [ ] trangThaiPhanHoi='RANDOM'

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Cases.Read
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Update vụ án đã soft-delete

### Điều kiện tiên quyết
- Case deletedAt != null

### Các bước kiểm thử
- [ ] PUT /cases/X

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: High
module: Cases.Update
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
- Module: `Cases.Bulk`
- Yêu cầu: `REQ-CASE-BULK-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bulk assign với ids khác đơn vị

### Các bước kiểm thử
- [ ] ids gồm case của team khác

### Kết quả mong đợi
**API**:
- hoặc partial result

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: Cases.Bulk
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
- Module: `Cases.Bulk`
- Yêu cầu: `REQ-CASE-BULK-03`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bulk delete > 100 items

### Các bước kiểm thử
- [ ] ids.length=200

### Kết quả mong đợi
**API**:
- hoặc throttle 5 req/min

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: Medium
module: Cases.Bulk
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
- Module: `Cases.Export`
- Yêu cầu: `REQ-CASE-EXP-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export vượt rate limit 5/min

### Điều kiện tiên quyết
- User vừa export 5 lần

### Các bước kiểm thử
- [ ] GET /export/ward lần 6

### Kết quả mong đợi
**API**:
- Too Many Requests

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Export`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Medium
module: Cases.Export
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-16`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: linkedPetitionId thuộc Petition đã linked case khác

### Các bước kiểm thử
- [ ] linkedPetitionId đã có sourceForCases

### Kết quả mong đợi
**UI**:
- Lỗi 'Petition đã chuyển vụ án'

**API**:
- /422

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-17`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: linkedIncidentId đã được dùng (@unique)

### Các bước kiểm thử
- [ ] linkedIncidentId đã có case khác

### Kết quả mong đợi
**UI**:
- Lỗi unique

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: High
module: Cases.Create
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-04`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đổi caseProvenance sau khi tạo

### Các bước kiểm thử
- [ ] PUT đổi caseProvenance từ DIRECT → FROM_PETITION

### Kết quả mong đợi
**API**:
- immutable hoặc cho phép

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Medium
module: Cases.Update
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

## TC-061

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: name = 500 ký tự (max)

### Các bước kiểm thử
- [ ] name 500 char

### Dữ liệu kiểm thử
```
name=500 char
```

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name = 499 ký tự (max-1)

### Các bước kiểm thử
- [ ] name 499

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Low
module: Cases.Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name = 1 ký tự (min)

### Các bước kiểm thử
- [ ] name='A'

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Low
module: Cases.Create
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-05`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit=1 (min)

### Các bước kiểm thử
- [ ] limit=1

### Kết quả mong đợi
**UI**:
- row

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Low
module: Cases.Read
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-DEL-04`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: reason xóa = 10 ký tự (min)

### Các bước kiểm thử
- [ ] reason 10 char

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Low
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-DEL-04`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: reason xóa = 500 ký tự (max)

### Các bước kiểm thử
- [ ] reason 500 char

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Low
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-07`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: subjects = 100 (max)

### Các bước kiểm thử
- [ ] subjects inline

### Kết quả mong đợi
**UI**:
- OK

**API**:

**Side effects** (DB, email, log, queue...):
- row Subject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-08`
- Kỹ thuật: `BVA`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: evidences = 100 (max)

### Các bước kiểm thử
- [ ] evidences

### Kết quả mong đợi
**UI**:
- OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Medium
module: Cases.Create
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-EP-01`
- Kỹ thuật: `Equivalence Partition`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: caseProvenance hợp lệ — partition cho mỗi giá trị 8 enum

### Các bước kiểm thử
- [ ] Lặp tạo 8 case mỗi caseProvenance khác nhau

### Dữ liệu kiểm thử
```
FROM_PETITION/FROM_INCIDENT/DIRECT_DISCOVERY/TRANSFERRED/SELF_SURRENDER/PROSECUTOR_PROPOSAL/OTHER_LEGAL_SOURCE/UY_THAC_DIEU_TRA
```

### Kết quả mong đợi
**UI**:
- Tất cả tạo OK

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: High
module: Cases.Create
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-EP-01`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: status enum 10 giá trị filter ra đúng partition

### Điều kiện tiên quyết
- DB có vụ ở đủ 10 status

### Các bước kiểm thử
- [ ] GET ?status=<each>

### Kết quả mong đợi
**API**:
- data đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: Medium
module: Cases.Read
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-EP-02`
- Kỹ thuật: `EP`
- Risk: `TB`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: capDoToiPham 4 partition

### Các bước kiểm thử
- [ ] ?capDoToiPham=mỗi giá trị

### Dữ liệu kiểm thử
```
4 enum
```

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: Low
module: Cases.Read
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-EP-03`
- Kỹ thuật: `EP`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: sortOrder asc / desc

### Các bước kiểm thử
- [ ] ?sortOrder=asc; 2. ?sortOrder=desc

### Kết quả mong đợi
**API**:
- thứ tự đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Low
module: Cases.Read
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-07`
- Kỹ thuật: `State Transition`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: soLanTamDinhChi auto-increment khi vào TĐC lần 2

### Điều kiện tiên quyết
- Case đã TĐC 1 lần phục hồi rồi

### Các bước kiểm thử
- [ ] PUT lần 2 status=TAM_DINH_CHI

### Kết quả mong đợi
**API**:

**Side effects** (DB, email, log, queue...):
- soLanTamDinhChi=2

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: Cases.State
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
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-09`
- Kỹ thuật: `State Verification`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: CaseStatusHistory ghi cả from + to + changedBy

### Các bước kiểm thử
- [ ] PUT status mới
- [ ] GET /cases/X/status-history

### Kết quả mong đợi
**UI**:
- Timeline đủ entry

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: High
module: Cases.State
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-06`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Path traversal trong filename export

### Các bước kiểm thử
- [ ] GET /export?filename=../../../etc/passwd

### Kết quả mong đợi
**API**:
- /sanitize

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: High
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-07`
- Kỹ thuật: `OWASP A03`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: NoSQL/Prisma injection trong sortBy

### Các bước kiểm thử
- [ ] sortBy='name; DROP TABLE'

### Kết quả mong đợi
**API**:
- whitelist

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-08`
- Kỹ thuật: `OWASP A04`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Rate limit brute force list endpoint

### Các bước kiểm thử
- [ ] Gửi 200 request/min

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: High
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-09`
- Kỹ thuật: `OWASP A01`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Auth missing trên restore admin endpoint

### Các bước kiểm thử
- [ ] POST /cases/:id/restore không token

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-10`
- Kỹ thuật: `OWASP A02`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Sensitive data exposure trong audit log API

### Các bước kiểm thử
- [ ] GET journey

### Kết quả mong đợi
**API**:
- Không trả password/token/raw IP

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: High
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-11`
- Kỹ thuật: `OWASP A05`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: CORS — origin trái phép bị reject

### Các bước kiểm thử
- [ ] Origin=evil.com

### Kết quả mong đợi
**API**:
- CORS reject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: High
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-12`
- Kỹ thuật: `OWASP A07`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT replay sau logout

### Điều kiện tiên quyết
- User logout

### Các bước kiểm thử
- [ ] Replay token cũ

### Kết quả mong đợi
**API**:
- (nếu blacklist) hoặc 200 (nếu stateless)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: Critical
module: Cases.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Confirm policy

---

## TC-098

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Cases.Data`
- Yêu cầu: `REQ-CASE-DATA-01`
- Kỹ thuật: `i18n`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tên vụ án Unicode đa byte (tiếng Việt + emoji)

### Các bước kiểm thử
- [ ] name='Vụ án 🚨 Trộm Cắp ÀẢÃẠỆỘỚỠỬỮ'

### Kết quả mong đợi
**UI**:
- Hiển thị đúng dấu

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Medium
module: Cases.Data
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
- Module: `Cases.Data`
- Yêu cầu: `REQ-CASE-DATA-02`
- Kỹ thuật: `Sanitization`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Trim leading/trailing space

### Các bước kiểm thử
- [ ] name='   Vụ A   '

### Kết quả mong đợi
**API**:
- với name='Vụ A'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Low
module: Cases.Data
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
- Module: `Cases.Data`
- Yêu cầu: `REQ-CASE-DATA-03`
- Kỹ thuật: `Sanitization`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Null byte injection

### Các bước kiểm thử
- [ ] name='abc\x00def'

### Kết quả mong đợi
**API**:
- hoặc strip

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Medium
module: Cases.Data
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-EDGE-01`
- Kỹ thuật: `Race`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo 2 case song song cùng linkedIncidentId

### Điều kiện tiên quyết
- user

### Các bước kiểm thử
- [ ] A và B cùng POST với linkedIncidentId X

### Kết quả mong đợi
**API**:
- thành công 201, 1 409 unique

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-EDGE-02`
- Kỹ thuật: `Duplicate`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Subjects/Evidences trùng code trong 1 case

### Các bước kiểm thử
- [ ] evidence cùng code

### Kết quả mong đợi
**UI**:
- Lỗi 'Mã trùng'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: Medium
module: Cases.Create
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-01`
- Kỹ thuật: `WCAG 2.1.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tab key di chuyển focus qua mọi field form

### Các bước kiểm thử
- [ ] Tab từ field 1 đến cuối form

### Kết quả mong đợi
**UI**:
- Focus ring hiện ở từng field theo thứ tự

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: High
module: Cases.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG A

---

## TC-107

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-02`
- Kỹ thuật: `WCAG 1.3.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Label gắn đúng với input (htmlFor)

### Các bước kiểm thử
- [ ] Inspect HTML form

### Kết quả mong đợi
**UI**:
- Mọi <label> có for=<input id>

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: High
module: Cases.UI
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-03`
- Kỹ thuật: `WCAG 1.4.3`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Contrast badge status ≥ 4.5:1

### Các bước kiểm thử
- [ ] Đo contrast badge

### Kết quả mong đợi
**UI**:
- Pass WCAG AA

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Medium
module: Cases.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: shared/enums/status-labels.ts

---

## TC-111

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-01`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome 130+ Windows

### Các bước kiểm thử
- [ ] Load /cases

### Kết quả mong đợi
**UI**:
- Render OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: High
module: Cases.UI
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-02`
- Kỹ thuật: `Cross-browser`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Firefox 130+ macOS

### Các bước kiểm thử
- [ ] Load

### Kết quả mong đợi
**UI**:
- OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: Medium
module: Cases.UI
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-05`
- Kỹ thuật: `Responsive`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mobile portrait 375x667 (iPhone SE)

### Các bước kiểm thử
- [ ] Resize 375x667

### Kết quả mong đợi
**UI**:
- AppSidebar drawer, layout không overflow

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: High
module: Cases.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.46 PWA

---

## TC-118

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Cases.Perf`
- Yêu cầu: `REQ-CASE-PERF-02`
- Kỹ thuật: `Performance`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: POST tạo case kèm 100 subjects + 100 evidences < 5s

### Các bước kiểm thử
- [ ] POST

### Kết quả mong đợi
**API**:
- < 5s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: High
module: Cases.Perf
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
- Module: `Cases.Perf`
- Yêu cầu: `REQ-CASE-PERF-03`
- Kỹ thuật: `Load`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: 50 concurrent GET /cases/stats không sập

### Các bước kiểm thử
- [ ] K6 50 VU 30s

### Kết quả mong đợi
**API**:
- Error rate < 1%, P95 < 1s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: High
module: Cases.Perf
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
- Priority: `P1` 🟠
- Module: `Cases.Doc`
- Yêu cầu: `REQ-CASE-INT-02`
- Kỹ thuật: `Integration`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Generate caseCode auto khi tạo

### Điều kiện tiên quyết
- DocumentNumberEngine v0.42

### Các bước kiểm thử
- [ ] POST /cases

### Kết quả mong đợi
**UI**:
- caseCode hiển thị

**API**:
- caseCode != null

**Side effects** (DB, email, log, queue...):
- DocumentNumberLog ghi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Doc`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Doc`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: High
module: Cases.Doc
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-18`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo case với metadata vượt 64KB JSON

### Các bước kiểm thử
- [ ] metadata payload 100KB

### Kết quả mong đợi
**UI**:
- Lỗi quá lớn

**API**:
- /400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: Medium
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-19`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: caseProvenance=FROM_PETITION với linkedPetitionId không tồn tại

### Các bước kiểm thử
- [ ] linkedPetitionId='ghost'

### Kết quả mong đợi
**API**:
- /404

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-20`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: linkedPetitionId thuộc Petition đã soft-delete

### Điều kiện tiên quyết
- Petition deletedAt!=null

### Các bước kiểm thử
- [ ] POST

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: High
module: Cases.Create
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-21`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: linkedIncidentId thuộc Incident đã soft-delete

### Các bước kiểm thử
- [ ] POST

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: High
module: Cases.Create
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
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-05`
- Kỹ thuật: `Negative IDOR`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Update của user khác đơn vị

### Các bước kiểm thử
- [ ] PUT /cases/<other-team>

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Critical
module: Cases.Update
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-10`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Stats vụ án không trong scope

### Các bước kiểm thử
- [ ] GET /cases/stats user ĐTV Team A

### Kết quả mong đợi
**API**:
- chỉ count case thuộc Team A

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: High
module: Cases.Read
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
- Module: `Cases.Atomic`
- Yêu cầu: `REQ-CASE-CR-22`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Subject thiếu fullName trong atomic create

### Các bước kiểm thử
- [ ] subjects=[{fullName:''}]

### Kết quả mong đợi
**UI**:
- Lỗi inline

**API**:

**Side effects** (DB, email, log, queue...):
- Rollback Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: High
module: Cases.Atomic
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
- Module: `Cases.Atomic`
- Yêu cầu: `REQ-CASE-CR-23`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Evidence thiếu code

### Các bước kiểm thử
- [ ] evidence={code:''}

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

**Side effects** (DB, email, log, queue...):
- Rollback

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-130
severity: High
module: Cases.Atomic
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
- Module: `Cases.Atomic`
- Yêu cầu: `REQ-CASE-CR-24`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: documentIds chứa id không tồn tại

### Các bước kiểm thử
- [ ] documentIds=['ghost']

### Kết quả mong đợi
**API**:
- /404

**Side effects** (DB, email, log, queue...):
- Rollback Case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-131
severity: High
module: Cases.Atomic
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Cases.Update`
- Yêu cầu: `REQ-CASE-UP-06`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: TĐC backfill bởi non-creator non-admin

### Các bước kiểm thử
- [ ] PATCH /cases/X/tdc-backfill

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-132
severity: High
module: Cases.Update
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-JR-02`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Journey với page=-1

### Các bước kiểm thử
- [ ] ?page=-1

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-133
severity: Low
module: Cases.Read
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
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-JR-03`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: limit journey > 200

### Các bước kiểm thử
- [ ] ?limit=500

### Kết quả mong đợi
**API**:
- /clamp

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-134
severity: Low
module: Cases.Read
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
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-25`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: sourceDocumentNote điền khi caseProvenance=FROM_PETITION

### Các bước kiểm thử
- [ ] FROM_PETITION + sourceDocumentNote='X'

### Kết quả mong đợi
**API**:
- hoặc ignore

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-135
severity: Medium
module: Cases.Create
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

## TC-136

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Cases.Bulk`
- Yêu cầu: `REQ-CASE-BULK-04`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Bulk export với ids rỗng

### Các bước kiểm thử
- [ ] POST /bulk-export {ids:[]}

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Bulk`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Bulk`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-136
severity: Low
module: Cases.Bulk
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
- Module: `Cases.UTDT`
- Yêu cầu: `REQ-CASE-UTDT-02`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: ngayTraKetQua < ngayTiepNhan

### Các bước kiểm thử
- [ ] ngayTraKetQua=2026-01-01 < ngayTiepNhan=2026-05-01

### Kết quả mong đợi
**UI**:
- Cảnh báo

**API**:
- /200

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UTDT`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UTDT`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-137
severity: Medium
module: Cases.UTDT
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-13`
- Kỹ thuật: `OWASP A03`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: XXE trong upload XML metadata

### Các bước kiểm thử
- [ ] Upload metadata XML có DOCTYPE

### Dữ liệu kiểm thử
```
<!DOCTYPE foo [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>
```

### Kết quả mong đợi
**API**:
- hoặc strip entity

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-138
severity: High
module: Cases.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-14`
- Kỹ thuật: `OWASP A10`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SSRF qua URL field trong notes

### Các bước kiểm thử
- [ ] notes='http://169.254.169.254/'

### Kết quả mong đợi
**API**:
- , server không fetch URL

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-139
severity: High
module: Cases.Security
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-15`
- Kỹ thuật: `OWASP A01`
- Risk: `TB`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Privilege escalation — đổi role qua body

### Các bước kiểm thử
- [ ] POST body có role='ADMIN'

### Kết quả mong đợi
**API**:
- , role không đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-140
severity: Critical
module: Cases.Security
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
- Module: `Cases.Security`
- Yêu cầu: `REQ-CASE-SEC-16`
- Kỹ thuật: `OWASP A05`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: HTTP method tampering DELETE qua POST _method

### Các bước kiểm thử
- [ ] POST /cases/X body {_method:'DELETE'}

### Kết quả mong đợi
**API**:
- Không xóa

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-141
severity: High
module: Cases.Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-142

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-06`
- Kỹ thuật: `WCAG 3.3.1`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form error message screen reader đọc được

### Các bước kiểm thử
- [ ] Submit lỗi
- [ ] NVDA/VoiceOver đọc

### Kết quả mong đợi
**UI**:
- Đọc thông báo lỗi rõ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-142
severity: High
module: Cases.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-143

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-07`
- Kỹ thuật: `WCAG 2.1.2`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Keyboard ESC đóng dialog confirm delete

### Các bước kiểm thử
- [ ] Bấm Delete
- [ ] ESC

### Kết quả mong đợi
**UI**:
- Dialog đóng, focus về nút

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-143
severity: Medium
module: Cases.UI
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-145

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-11`
- Kỹ thuật: `Negative`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Pagination total > tổng thật do scope leak

### Điều kiện tiên quyết
- User Team A

### Các bước kiểm thử
- [ ] GET /cases
- [ ] So sánh total với COUNT(*) WHERE scope

### Kết quả mong đợi
**API**:
- total === count thuộc scope

**Side effects** (DB, email, log, queue...):
- Không leak total cross-team

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-145
severity: Critical
module: Cases.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-146

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-12`
- Kỹ thuật: `Negative`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Search SQL keyword reserved

### Các bước kiểm thử
- [ ] ?search='SELECT *'

### Kết quả mong đợi
**API**:
- không exception

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-146
severity: Medium
module: Cases.Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-147

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Cases.Create`
- Yêu cầu: `REQ-CASE-CR-26`
- Kỹ thuật: `Negative`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: loaiThongTin > 200 ký tự

### Các bước kiểm thử
- [ ] loaiThongTin 201 char

### Kết quả mong đợi
**UI**:
- Lỗi

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-147
severity: Low
module: Cases.Create
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
- Priority: `P2` 🟡
- Module: `Cases.Stats`
- Yêu cầu: `REQ-CASE-STAT-01`
- Kỹ thuật: `Happy Path`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: GET /cases/stats trả về count đúng theo status

### Điều kiện tiên quyết
- DB có vụ án nhiều status

### Các bước kiểm thử
- [ ] GET /cases/stats

### Kết quả mong đợi
**UI**:
- Chip counts hiển thị

**API**:
- , body {TIEP_NHAN:n1, DANG_DIEU_TRA:n2, ...}

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Stats`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Low
module: Cases.Stats
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
- Priority: `P2` 🟡
- Module: `Cases.Atomic`
- Yêu cầu: `REQ-CASE-AT-01`
- Kỹ thuật: `Happy Path`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo case kèm 3 subjects + 2 evidences atomic

### Điều kiện tiên quyết
- Form mở

### Các bước kiểm thử
- [ ] Điền form
- [ ] Thêm 3 subject inline
- [ ] Thêm 2 evidence inline
- [ ] Lưu

### Dữ liệu kiểm thử
```
subjects.length=3, evidences.length=2
```

### Kết quả mong đợi
**UI**:
- Tất cả lưu cùng lúc

**API**:
- , body có ids của subjects/evidences

**Side effects** (DB, email, log, queue...):
- Cùng transaction; rollback nếu 1 fail

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Atomic`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: High
module: Cases.Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.38.0.0

---

## TC-070

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-06`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: offset=0 (min)

### Các bước kiểm thử
- [ ] offset=0

### Kết quả mong đợi
**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: Low
module: Cases.Read
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
- Priority: `P2` 🟡
- Module: `Cases.Read`
- Yêu cầu: `REQ-CASE-RD-EP-04`
- Kỹ thuật: `EP`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: overdue=true vs false

### Các bước kiểm thử
- [ ] ?overdue=true/false

### Kết quả mong đợi
**API**:
- filter đúng deadline<now

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Low
module: Cases.Read
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
- Priority: `P2` 🟡
- Module: `Cases.State`
- Yêu cầu: `REQ-CASE-ST-08`
- Kỹ thuật: `State Transition`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DA_LUU_TRU không cho edit field nghiệp vụ

### Điều kiện tiên quyết
- status=DA_LUU_TRU

### Các bước kiểm thử
- [ ] PUT name khác

### Kết quả mong đợi
**UI**:
- Lock UI

**API**:
- hoặc 200

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.State`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.State`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: Medium
module: Cases.State
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

## TC-101

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Cases.Data`
- Yêu cầu: `REQ-CASE-DATA-04`
- Kỹ thuật: `i18n`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Date ISO8601 timezone VN (UTC+7)

### Các bước kiểm thử
- [ ] ngayKhoiTo='2026-05-30T08:00:00+07:00'

### Kết quả mong đợi
**UI**:
- Hiển thị 'sáng 30/05/2026'

**API**:

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: Medium
module: Cases.Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: dates.ts utility

---

## TC-102

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Cases.Data`
- Yêu cầu: `REQ-CASE-DATA-05`
- Kỹ thuật: `BVA`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Number overflow soLanTamDinhChi

### Các bước kiểm thử
- [ ] Đẩy TĐC liên tục → kiểm tra Int32

### Kết quả mong đợi
**Side effects** (DB, email, log, queue...):
- Int4 column safe trong Prisma

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: Low
module: Cases.Data
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
- Module: `Cases.Stats`
- Yêu cầu: `REQ-CASE-EDGE-03`
- Kỹ thuật: `Empty`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Stats khi DB rỗng (0 case)

### Các bước kiểm thử
- [ ] GET /cases/stats

### Kết quả mong đợi
**UI**:
- All chip = 0

**API**:
- , mọi key = 0

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Stats`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Stats`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: Low
module: Cases.Stats
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-04`
- Kỹ thuật: `WCAG 4.1.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Error message announce qua aria-live

### Các bước kiểm thử
- [ ] Submit lỗi
- [ ] Test SR đọc lỗi

### Kết quả mong đợi
**UI**:
- aria-live=polite

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Medium
module: Cases.UI
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-05`
- Kỹ thuật: `WCAG 2.4.1`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Skip link đến nội dung chính

### Các bước kiểm thử
- [ ] Tab đầu trang

### Kết quả mong đợi
**UI**:
- Link 'Bỏ qua tới nội dung' hiện

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Low
module: Cases.UI
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
- Priority: `P2` 🟡
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-03`
- Kỹ thuật: `Cross-browser`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Edge 130+

### Kết quả mong đợi
**UI**:
- OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Low
module: Cases.UI
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
- Priority: `P2` 🟡
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-04`
- Kỹ thuật: `Cross-browser`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Safari 17+

### Kết quả mong đợi
**UI**:
- OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Low
module: Cases.UI
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
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-COMPAT-06`
- Kỹ thuật: `Responsive`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tablet 768x1024

### Kết quả mong đợi
**UI**:
- OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Low
module: Cases.UI
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
- Module: `Cases.Perf`
- Yêu cầu: `REQ-CASE-PERF-04`
- Kỹ thuật: `Stress`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export 5000 case không OOM

### Các bước kiểm thử
- [ ] GET /export/ward

### Kết quả mong đợi
**API**:
- , file < 50MB

**Side effects** (DB, email, log, queue...):
- Memory < 1GB

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Medium
module: Cases.Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-144

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Cases.UI`
- Yêu cầu: `REQ-CASE-A11Y-08`
- Kỹ thuật: `WCAG 4.1.2`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Icon-only button có aria-label

### Các bước kiểm thử
- [ ] Inspect nút edit/delete

### Kết quả mong đợi
**UI**:
- aria-label='Chỉnh sửa', 'Xóa'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Cases.UI`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Cases.UI`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-144
severity: Medium
module: Cases.UI
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

- [ ] **TC-001** [P0] Tạo vụ án mới hợp lệ với provenance DIRECT_DISCOVERY
- [ ] **TC-002** [P0] Tạo vụ án từ Petition (FROM_PETITION) với optimistic lock
- [ ] **TC-003** [P0] Tạo vụ án từ Incident (FROM_INCIDENT)
- [ ] **TC-004** [P0] Tạo vụ án UTDT với caseType=UY_THAC_DIEU_TRA và donViGiao
- [ ] **TC-005** [P0] Liệt kê vụ án với pagination mặc định
- [ ] **TC-008** [P0] Cập nhật vụ án với optimistic lock đúng
- [ ] **TC-009** [P0] Chuyển status TIEP_NHAN → DANG_DIEU_TRA
- [ ] **TC-010** [P0] Đặt status TAM_DINH_CHI có lyDoTamDinhChiVuAn
- [ ] **TC-011** [P0] Soft-delete vụ án TIEP_NHAN bởi creator với reason
- [ ] **TC-012** [P0] ADMIN restore vụ án đã xóa
- [ ] **TC-019** [P0] Tạo vụ án thiếu name (required)
- [ ] **TC-020** [P0] Tạo vụ án không có caseProvenance
- [ ] **TC-021** [P0] FROM_PETITION nhưng thiếu linkedPetitionId
- [ ] **TC-022** [P0] FROM_INCIDENT thiếu linkedIncidentId
- [ ] **TC-023** [P0] UY_THAC_DIEU_TRA thiếu donViGiao (v0.67.3.0)
- [ ] **TC-024** [P0] Optimistic lock conflict khi 2 user edit
- [ ] **TC-025** [P0] Đổi status sang TAM_DINH_CHI thiếu lyDoTamDinhChiVuAn
- [ ] **TC-026** [P0] Non-creator non-admin xóa vụ án
- [ ] **TC-027** [P0] Xóa vụ án không phải TIEP_NHAN
- [ ] **TC-028** [P0] Xóa vụ án còn linked Petition/Incident
- [ ] **TC-029** [P0] Reason xóa <10 ký tự
- [ ] **TC-030** [P0] Non-ADMIN restore
- [ ] **TC-031** [P0] Non-dispatcher gọi assign
- [ ] **TC-032** [P0] User ĐTV scope khác xem case không thuộc tổ
- [ ] **TC-048** [P0] Truy cập không JWT
- [ ] **TC-049** [P0] JWT hết hạn
- [ ] **TC-050** [P0] JWT chữ ký sai
- [ ] **TC-051** [P0] Pre-migration createdById=NULL chỉ ADMIN xóa
- [ ] **TC-064** [P0] limit=100 (max)
- [ ] **TC-076** [P0] DANG_DIEU_TRA → DA_KET_LUAN
- [ ] **TC-077** [P0] DA_KET_LUAN → DANG_TRUY_TO
- [ ] **TC-078** [P0] DANG_TRUY_TO → DANG_XET_XU
- [ ] **TC-079** [P0] TAM_DINH_CHI → DA_KET_LUAN (phục hồi)
- [ ] **TC-080** [P0] DINH_CHI là terminal
- [ ] **TC-084** [P0] Decision Table — trangThaiPhanHoi 4 case
- [ ] **TC-085** [P0] Decision Table — lyDoTamDinhChiVuAn cần khi status=TAM_DINH_CHI
- [ ] **TC-086** [P0] SQL Injection trong search
- [ ] **TC-087** [P0] XSS trong name vụ án
- [ ] **TC-088** [P0] IDOR — đoán id case khác đơn vị
- [ ] **TC-089** [P0] Mass assignment — gửi createdById trong body
- [ ] **TC-090** [P0] CSRF — POST không token
- [ ] **TC-117** [P0] GET /cases list 1000 record < 2s
- [ ] **TC-121** [P0] Tạo case assigned → SSE/push tới investigator
- [ ] **TC-006** [P1] Filter theo status=DANG_DIEU_TRA
- [ ] **TC-007** [P1] Search theo tên vụ án (ILIKE)
- [ ] **TC-013** [P1] Dispatcher gán investigator cho vụ án
- [ ] **TC-014** [P1] Export Excel theo phường
- [ ] **TC-015** [P1] Bulk delete 5 vụ án
- [ ] **TC-016** [P1] Xem journey timeline của vụ án
- [ ] **TC-033** [P1] limit > 100
- [ ] **TC-034** [P1] offset âm
- [ ] **TC-035** [P1] fromDate > toDate
- [ ] **TC-036** [P1] Update tên >500 ký tự
- [ ] **TC-037** [P1] Crime > 255 ký tự
- [ ] **TC-038** [P1] sourceDocumentNote > 1000 ký tự
- [ ] **TC-039** [P1] Subjects > 100
- [ ] **TC-040** [P1] Evidences > 100
- [ ] **TC-041** [P1] documentIds > 50
- [ ] **TC-042** [P1] investigatorId không tồn tại
- [ ] **TC-043** [P1] assignedTeamId thuộc đơn vị khác
- [ ] **TC-044** [P1] deadline trong quá khứ
- [ ] **TC-045** [P1] ngayKhoiTo định dạng sai
- [ ] **TC-046** [P1] capDoToiPham không hợp lệ
- [ ] **TC-047** [P1] loaiUyThac không thuộc enum
- [ ] **TC-052** [P1] sortBy với cột không tồn tại
- [ ] **TC-053** [P1] trangThaiPhanHoi không hợp lệ
- [ ] **TC-054** [P1] Update vụ án đã soft-delete
- [ ] **TC-055** [P1] Bulk assign với ids khác đơn vị
- [ ] **TC-056** [P1] Bulk delete > 100 items
- [ ] **TC-057** [P1] Export vượt rate limit 5/min
- [ ] **TC-058** [P1] linkedPetitionId thuộc Petition đã linked case khác
- [ ] **TC-059** [P1] linkedIncidentId đã được dùng (@unique)
- [ ] **TC-060** [P1] Đổi caseProvenance sau khi tạo
- [ ] **TC-061** [P1] name = 500 ký tự (max)
- [ ] **TC-062** [P1] name = 499 ký tự (max-1)
- [ ] **TC-063** [P1] name = 1 ký tự (min)
- [ ] **TC-065** [P1] limit=1 (min)
- [ ] **TC-066** [P1] reason xóa = 10 ký tự (min)
- [ ] **TC-067** [P1] reason xóa = 500 ký tự (max)
- [ ] **TC-068** [P1] subjects = 100 (max)
- [ ] **TC-069** [P1] evidences = 100 (max)
- [ ] **TC-071** [P1] caseProvenance hợp lệ — partition cho mỗi giá trị 8 enum
- [ ] **TC-072** [P1] status enum 10 giá trị filter ra đúng partition
- [ ] **TC-073** [P1] capDoToiPham 4 partition
- [ ] **TC-074** [P1] sortOrder asc / desc
- [ ] **TC-081** [P1] soLanTamDinhChi auto-increment khi vào TĐC lần 2
- [ ] **TC-083** [P1] CaseStatusHistory ghi cả from + to + changedBy
- [ ] **TC-091** [P1] Path traversal trong filename export
- [ ] **TC-092** [P1] NoSQL/Prisma injection trong sortBy
- [ ] **TC-093** [P1] Rate limit brute force list endpoint
- [ ] **TC-094** [P1] Auth missing trên restore admin endpoint
- [ ] **TC-095** [P1] Sensitive data exposure trong audit log API
- [ ] **TC-096** [P1] CORS — origin trái phép bị reject
- [ ] **TC-097** [P1] JWT replay sau logout
- [ ] **TC-098** [P1] Tên vụ án Unicode đa byte (tiếng Việt + emoji)
- [ ] **TC-099** [P1] Trim leading/trailing space
- [ ] **TC-100** [P1] Null byte injection
- [ ] **TC-103** [P1] Tạo 2 case song song cùng linkedIncidentId
- [ ] **TC-104** [P1] Subjects/Evidences trùng code trong 1 case
- [ ] **TC-106** [P1] Tab key di chuyển focus qua mọi field form
- [ ] **TC-107** [P1] Label gắn đúng với input (htmlFor)
- [ ] **TC-108** [P1] Contrast badge status ≥ 4.5:1
- [ ] **TC-111** [P1] Chrome 130+ Windows
- [ ] **TC-112** [P1] Firefox 130+ macOS
- [ ] **TC-115** [P1] Mobile portrait 375x667 (iPhone SE)
- [ ] **TC-118** [P1] POST tạo case kèm 100 subjects + 100 evidences < 5s
- [ ] **TC-119** [P1] 50 concurrent GET /cases/stats không sập
- [ ] **TC-122** [P1] Generate caseCode auto khi tạo
- [ ] **TC-123** [P1] Tạo case với metadata vượt 64KB JSON
- [ ] **TC-124** [P1] caseProvenance=FROM_PETITION với linkedPetitionId không tồn tại
- [ ] **TC-125** [P1] linkedPetitionId thuộc Petition đã soft-delete
- [ ] **TC-126** [P1] linkedIncidentId thuộc Incident đã soft-delete
- [ ] **TC-127** [P1] Update của user khác đơn vị
- [ ] **TC-128** [P1] Stats vụ án không trong scope
- [ ] **TC-129** [P1] Subject thiếu fullName trong atomic create
- [ ] **TC-130** [P1] Evidence thiếu code
- [ ] **TC-131** [P1] documentIds chứa id không tồn tại
- [ ] **TC-132** [P1] TĐC backfill bởi non-creator non-admin
- [ ] **TC-133** [P1] Journey với page=-1
- [ ] **TC-134** [P1] limit journey > 200
- [ ] **TC-135** [P1] sourceDocumentNote điền khi caseProvenance=FROM_PETITION
- [ ] **TC-136** [P1] Bulk export với ids rỗng
- [ ] **TC-137** [P1] ngayTraKetQua < ngayTiepNhan
- [ ] **TC-138** [P1] XXE trong upload XML metadata
- [ ] **TC-139** [P1] SSRF qua URL field trong notes
- [ ] **TC-140** [P1] Privilege escalation — đổi role qua body
- [ ] **TC-141** [P1] HTTP method tampering DELETE qua POST _method
- [ ] **TC-142** [P1] Form error message screen reader đọc được
- [ ] **TC-143** [P1] Keyboard ESC đóng dialog confirm delete
- [ ] **TC-145** [P1] Pagination total > tổng thật do scope leak
- [ ] **TC-146** [P1] Search SQL keyword reserved
- [ ] **TC-147** [P1] loaiThongTin > 200 ký tự
- [ ] **TC-017** [P2] GET /cases/stats trả về count đúng theo status
- [ ] **TC-018** [P2] Tạo case kèm 3 subjects + 2 evidences atomic
- [ ] **TC-070** [P2] offset=0 (min)
- [ ] **TC-075** [P2] overdue=true vs false
- [ ] **TC-082** [P2] DA_LUU_TRU không cho edit field nghiệp vụ
- [ ] **TC-101** [P2] Date ISO8601 timezone VN (UTC+7)
- [ ] **TC-102** [P2] Number overflow soLanTamDinhChi
- [ ] **TC-105** [P2] Stats khi DB rỗng (0 case)
- [ ] **TC-109** [P2] Error message announce qua aria-live
- [ ] **TC-110** [P2] Skip link đến nội dung chính
- [ ] **TC-113** [P2] Edge 130+
- [ ] **TC-114** [P2] Safari 17+
- [ ] **TC-116** [P2] Tablet 768x1024
- [ ] **TC-120** [P2] Export 5000 case không OOM
- [ ] **TC-144** [P2] Icon-only button có aria-label

---

_Generated by `uat-test-writer` skill on 30/05/2026 22:02_