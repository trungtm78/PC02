# UAT Test Cases — Xuất chứng từ động Vụ việc/Vụ án + Đơn thư (epic PR1-PR4)

**Generated**: 28/06/2026 02:28  
**Complexity**: `complex`  
**Total TC**: 129  
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

## 📐 Scope

**In scope**:
- Admin quản lý mẫu chứng từ động /document-templates (upload .docx, entityType, category, cấp số/numberSeriesId, sortOrder)
- GET /cases|incidents/export-templates (list mẫu active, quyền read Case/Incident)
- POST /cases|incidents/:id/export-documents (render gộp/zip, atomic cấp số no-gap)
- DynamicExportDocumentsModal (nhóm category, biến nhập tay, merged/zip)
- Nút Lưu và xuất file + In chứng từ (CaseFormPage, IncidentFormPage, PetitionFormPage)
- RBAC/DataScope theo tổ/điều tra viên + escape placeholder chống injection

**Out of scope**:
- Engine xuất đơn thư 7 mẫu hardcode (đã UAT ở v0.68.1.0)
- Document Number Engine nội bộ (đã có v0.42)
- Auth/login (đã UAT riêng)

**Exit Criteria**: 100% P0 PASS, 0 bug Critical/High mở, RED+SECURITY pass ≥95%, atomic cấp số no-gap đã chứng minh, RBAC chặn cross-tổ

## 🔍 Self-Audit

**Tổng số TC**: 129

**Phân bố loại**:
- `RED`: 52
- `GREEN`: 16
- `SECURITY`: 13
- `BOUNDARY`: 11
- `EP`: 9
- `A11Y`: 7
- `COMPAT`: 7
- `PERFORMANCE`: 4
- `STATE`: 3
- `EDGE`: 3
- `DECISION`: 2
- `DATA`: 2

**Phân bố priority**:
- 🔴 `P0`: 40
- 🟠 `P1`: 24
- 🟡 `P2`: 50
- 🟢 `P3`: 15

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 23
- ⚠️ `High`: 39
- ⚡ `Medium`: 50
- 📌 `Low`: 17

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `ACC-ADMIN` | `admin@pc02.local` | `<env UAT_ADMIN_PW>` | ADMIN | active |  |
| `ACC-OFF1` | `officer1@pc02.local` | `<env UAT_OFF1_PW>` | OFFICER | active |  |
| `ACC-OFF2` | `officer2@pc02.local` | `<env UAT_OFF2_PW>` | OFFICER | active |  |
| `ACC-ANON` | `` | `` | GUEST | no-token |  |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| file size | `5MB (5242880 bytes)` | `` | **Chấp nhận (=max)** | max |
| file size | `5MB + 1 byte` | `` | **Reject (413/400 quá lớn)** | max+1 |
| file size | `0 byte` | `` | **Reject .docx không hợp lệ** | min-1 |
| code length | `50 ký tự` | `` | **Chấp nhận (=MaxLength)** | max |
| code length | `51 ký tự` | `` | **Reject 400 MaxLength** | max+1 |
| name length | `255 ký tự` | `` | **Chấp nhận** | max |
| name length | `256 ký tự` | `` | **Reject 400** | max+1 |
| sortOrder | `0` | `` | **Chấp nhận (Min 0)** | min |
| sortOrder | `-1` | `` | **Reject 400 Min** | min-1 |
| templateIds | `[] (rỗng)` | `` | **Reject 400 ArrayNotEmpty + nút disabled** | min-1 |
| templateIds | `1 phần tử` | `` | **Chấp nhận** | min |
| export Throttle | `6 request/60s` | `` | **Request thứ 6 → 429** | max+1 throttle 5/60s |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
| POST /cases/:id/export-documents | `manualValues.ghiChu = "{soVuAn}{#x}{/x}"` | Docxtemplater template injection | esc() escape { } < > → render literal, KHÔNG thực thi tag | `A03 Injection` |
| export endpoint | `officer1 POST /incidents/<id-thuộc-tổ-B>/export-documents` | IDOR cross-scope | 403 Forbidden (DataScope chặn) | `A01 Broken Access Control` |
| admin endpoint | `officer1 POST /document-templates (upload mẫu)` | Privilege escalation | 403 (thiếu quyền write Setting) | `A01` |
| POST /document-templates | `file .exe đổi tên .docx + Content-Type docx` | Fake .docx (MIME spoof) | 400 assertValidDocx (thiếu word/document.xml) | `A08 Software/Data Integrity` |
| upload | `.docx nén phình > giới hạn` | Zip bomb / oversized | Reject 5MB cap / xử lý có kiểm soát | `A05 Misconfig` |
| export | `POST /cases/1' OR '1'='1/export-documents` | SQL injection entityId | 404/400 (id không tồn tại), $1 param-bind an toàn | `A03` |
| POST /document-templates → hiển thị list | `name = "<script>alert(1)</script>"` | XSS qua tên mẫu | React escape, không thực thi script | `A03 XSS` |
| DTO whitelist | `POST export-documents kèm field lạ (createdById, status)` | Mass assignment | ValidationPipe whitelist loại field thừa | `A08` |
| JwtAuthGuard | `POST export-documents không Authorization` | Token thiếu/sai | 401 Unauthorized | `A07 Auth Failures` |
| export | `manualValues = {x: {a:1}}` | manualValues non-string | esc(s(v)) coerce an toàn → '[object Object]', không injection | `A03` |

## 🗂️ Data Maturity Matrix

> Data fixtures được runner tự động seed trước test, KHÔNG cần human chạy SQL.
> Mỗi fixture có ID format `<entity>.<state>.<lifecycle>.<shape>`.

### `template.vuan.active.D0`

**Mô tả**: Mẫu VU_AN active, category Quyết định, không cấp số, biến trong catalog (soVuAn,tenVuAn)
**Entity**: `DocumentTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"POST /document-templates multipart {code:'QD-KT-{{random}}',name:'QĐ khởi tố',entityType:'VU_AN',category:'Quyết định',needsNumber:false,file:qd.docx} as ADMIN"
```

**Cleanup**:
```json
"DELETE /document-templates/{{id}} as ADMIN"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-004, TC-005, TC-007, TC-027, TC-028, TC-035, TC-038, TC-068, TC-076, TC-097, TC-006, TC-020, TC-024, TC-073, TC-119, TC-123, TC-128, TC-016, TC-045, TC-046, TC-049, TC-060, TC-065, TC-066, TC-067, TC-072, TC-075, TC-084, TC-089, TC-093, TC-099, TC-103, TC-108, TC-112, TC-118, TC-110

---

### `template.vuan.needsnumber.D0`

**Mô tả**: Mẫu VU_AN bật cấp số có numberSeriesId hợp lệ
**Entity**: `DocumentTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"POST /document-templates {...,needsNumber:true,numberSeriesId:'CASE'} as ADMIN"
```

**Cleanup**:
```json
"DELETE /document-templates/{{id}}"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-015, TC-077, TC-101, TC-114

---

### `template.vuviec.active.D0`

**Mô tả**: Mẫu VU_VIEC active category Biên bản
**Entity**: `DocumentTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"POST /document-templates {entityType:'VU_VIEC',category:'Biên bản',needsNumber:false,file:bb.docx} as ADMIN"
```

**Cleanup**:
```json
"DELETE /document-templates/{{id}}"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-010, TC-011, TC-023, TC-097, TC-098

---

### `template.vuan.manualvar.D0`

**Mô tả**: Mẫu VU_AN có placeholder ngoài catalog ({hoTenBiCan}) → biến source=manual
**Entity**: `DocumentTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"POST /document-templates {entityType:'VU_AN',file:docx_chua_{hoTenBiCan}}"
```

**Cleanup**:
```json
"DELETE /document-templates/{{id}}"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-014, TC-032, TC-036, TC-069, TC-070, TC-071, TC-092, TC-107

---

### `template.vuan.deleted.D0`

**Mô tả**: Mẫu VU_AN đã soft-delete (deletedAt set)
**Entity**: `DocumentTemplate` | **State**: `deleted` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"POST tạo rồi DELETE /document-templates/{{id}}"
```

**Cleanup**:
```json
"n/a"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-047, TC-048, TC-100

---

### `templates.vuan.empty`

**Mô tả**: Không có mẫu VU_AN nào active (list rỗng)
**Entity**: `DocumentTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `empty`

**Setup** (api):
```json
"Soft-delete toàn bộ mẫu VU_AN"
```

**Cleanup**:
```json
"restore/seed lại"
```

**Dùng bởi**: TC-082

---

### `case.toA.active.D0`

**Mô tả**: Vụ án thuộc Tổ A (officer1 scope), đủ field catalog
**Entity**: `Case` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /cases {caseProvenance:'DIRECT_DISCOVERY',caseTitle:'VA UAT',handler:officer1,assignedTeamId:'team-A'} as OFF1"
```

**Cleanup**:
```json
"DELETE /cases/{{id}} as ADMIN"
```

**Outputs**: `$.data.id`

**Dùng bởi**: TC-004, TC-005, TC-014, TC-015, TC-023, TC-030, TC-032, TC-035, TC-036, TC-047, TC-068, TC-069, TC-070, TC-077, TC-080, TC-101, TC-102, TC-109, TC-114, TC-006, TC-021, TC-022, TC-024, TC-025, TC-073, TC-091, TC-119, TC-123, TC-128, TC-009, TC-045, TC-060, TC-061, TC-065, TC-066, TC-067, TC-071, TC-072, TC-074, TC-075, TC-081, TC-082, TC-092, TC-093, TC-095, TC-108, TC-112, TC-113, TC-116, TC-117, TC-118, TC-121, TC-124, TC-125, TC-126, TC-127, TC-083, TC-106, TC-107, TC-120, TC-129

---

### `case.toB.active.D0`

**Mô tả**: Vụ án thuộc Tổ B (ngoài scope officer1) — test IDOR
**Entity**: `Case` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /cases {assignedTeamId:'team-B'} as OFF2"
```

**Cleanup**:
```json
"DELETE /cases/{{id}} as ADMIN"
```

**Outputs**: `$.data.id`

**Dùng bởi**: TC-028

---

### `incident.toA.active.D0`

**Mô tả**: Vụ việc thuộc Tổ A
**Entity**: `Incident` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /incidents {name:'VV UAT',assignedTeamId:'team-A',investigatorId:officer1} as OFF1"
```

**Cleanup**:
```json
"DELETE /incidents/{{id}} as ADMIN"
```

**Outputs**: `$.data.id`

**Dùng bởi**: TC-010, TC-029, TC-080

---

### `petition.toA.active.D0`

**Mô tả**: Đơn thư Tổ A để test nút In chứng từ
**Entity**: `Petition` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `normal`

**Setup** (api):
```json
"POST /petitions {senderName:'A',...} as OFF1"
```

**Cleanup**:
```json
"DELETE /petitions/{{id}}"
```

**Outputs**: `$.data.id`

**Dùng bởi**: TC-012, TC-013

---

### `series.case.active`

**Mô tả**: Chuỗi số documentType=CASE để gán numberSeriesId
**Entity**: `DocumentNumberTemplate` | **State**: `active` | **Lifecycle**: `D0` | **Shape**: `single`

**Setup** (api):
```json
"Seed sẵn (db:seed) hoặc POST /document-numbers/templates"
```

**Cleanup**:
```json
"n/a"
```

**Outputs**: `$.documentType`

**Dùng bởi**: TC-001, TC-003, TC-079

---

### 📋 Bảng tóm tắt

| Fixture ID | Entity | State | Lifecycle | TC dùng |
|------------|--------|-------|-----------|---------|
| `template.vuan.active.D0` | DocumentTemplate | active | D0 | TC-004, TC-005, TC-007... |
| `template.vuan.needsnumber.D0` | DocumentTemplate | active | D0 | TC-015, TC-077, TC-101... |
| `template.vuviec.active.D0` | DocumentTemplate | active | D0 | TC-010, TC-011, TC-023... |
| `template.vuan.manualvar.D0` | DocumentTemplate | active | D0 | TC-014, TC-032, TC-036... |
| `template.vuan.deleted.D0` | DocumentTemplate | deleted | D0 | TC-047, TC-048, TC-100 |
| `templates.vuan.empty` | DocumentTemplate | active | D0 | TC-082 |
| `case.toA.active.D0` | Case | active | D0 | TC-004, TC-005, TC-014... |
| `case.toB.active.D0` | Case | active | D0 | TC-028 |
| `incident.toA.active.D0` | Incident | active | D0 | TC-010, TC-029, TC-080 |
| `petition.toA.active.D0` | Petition | active | D0 | TC-012, TC-013 |
| `series.case.active` | DocumentNumberTemplate | active | D0 | TC-001, TC-003, TC-079 |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Admin-Templates | Admin upload mẫu VU_AN không cấp số thành công | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Admin-Templates | Admin bật Cấp số + chọn chuỗi số → lưu thành công | 🚨 Critical |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | Export-VuAn | Officer mở modal xuất chứng từ ở form Vụ án (edit) qua nút In chứng từ | 🚨 Critical |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | Export-VuAn | Xuất 1 mẫu Vụ án dạng gộp (merged) tải file .docx | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | Export-VuAn | Lưu và xuất file (split-button) ở form Vụ án tạo mới | 🚨 Critical |
| [TC-010](#tc-010) | 🔴 P0 | `GREEN` | Export-VuViec | Xuất chứng từ Vụ việc qua nút In chứng từ (IncidentFormPage) | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `GREEN` | Export-VuViec | Lưu và xuất file ở form Vụ việc (split-button) | ⚠️ High |
| [TC-014](#tc-014) | 🔴 P0 | `GREEN` | Export-VuAn | Form biến nhập tay hiển thị khi mẫu có biến source=manual được chọn | 🚨 Critical |
| [TC-015](#tc-015) | 🔴 P0 | `GREEN` | Export-VuAn | Xuất mẫu bật cấp số → cấp 1 số văn bản vào file | 🚨 Critical |
| [TC-017](#tc-017) | 🔴 P0 | `RED` | Admin-Templates | Upload mẫu bật Cấp số nhưng KHÔNG chọn chuỗi số → chặn | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `RED` | Admin-Templates | Upload file không phải .docx (txt) → reject | 🚨 Critical |
| [TC-019](#tc-019) | 🔴 P0 | `RED` | Admin-Templates | Upload .docx giả (đổi đuôi từ .exe) → assertValidDocx reject | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `RED` | Export-VuAn | Export mẫu sai entityType (mẫu VU_VIEC cho case) → 400 | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `SECURITY` | RBAC | Officer KHÔNG có quyền Setting upload mẫu → 403 | 🚨 Critical |
| [TC-027](#tc-027) | 🔴 P0 | `SECURITY` | RBAC | Officer DELETE mẫu → 403 | 🚨 Critical |
| [TC-028](#tc-028) | 🔴 P0 | `SECURITY` | RBAC | IDOR: officer1 export vụ án Tổ B (ngoài scope) → 403 | 🚨 Critical |
| [TC-029](#tc-029) | 🔴 P0 | `SECURITY` | RBAC | IDOR: officer1 export vụ việc Tổ B → 403 | 🚨 Critical |
| [TC-030](#tc-030) | 🔴 P0 | `SECURITY` | RBAC | Export không kèm token → 401 | 🚨 Critical |
| [TC-031](#tc-031) | 🔴 P0 | `SECURITY` | RBAC | GET export-templates không token → 401 | ⚠️ High |
| [TC-032](#tc-032) | 🔴 P0 | `SECURITY` | Export-VuAn | Template injection qua manualValues → escape, không thực thi | ⚠️ High |
| [TC-033](#tc-033) | 🔴 P0 | `SECURITY` | Export-VuAn | SQL injection qua entityId path → an toàn | ⚠️ High |
| [TC-034](#tc-034) | 🔴 P0 | `SECURITY` | Admin-Templates | XSS qua tên mẫu hiển thị list admin → React escape | ⚠️ High |
| [TC-035](#tc-035) | 🔴 P0 | `SECURITY` | Export-VuAn | Mass assignment: gửi field lạ trong export body → whitelist loại bỏ | ⚡ Medium |
| [TC-036](#tc-036) | 🔴 P0 | `SECURITY` | Export-VuAn | manualValues non-string (object) → coerce an toàn | 📌 Low |
| [TC-037](#tc-037) | 🔴 P0 | `SECURITY` | RBAC | GET /document-templates (list admin) bởi officer → 403 | ⚠️ High |
| [TC-038](#tc-038) | 🔴 P0 | `SECURITY` | RBAC | officer1 sửa mẫu (PATCH) → 403 | ⚠️ High |
| [TC-047](#tc-047) | 🔴 P0 | `RED` | Export-VuAn | Export mẫu đã soft-delete → 400 không tồn tại | ⚠️ High |
| [TC-068](#tc-068) | 🔴 P0 | `EP` | Export-VuAn | EP biến auto (trong catalog) → tự điền không cần nhập | ⚠️ High |
| [TC-069](#tc-069) | 🔴 P0 | `EP` | Export-VuAn | EP biến manual (ngoài catalog) → yêu cầu nhập | ⚠️ High |
| [TC-070](#tc-070) | 🔴 P0 | `EP` | Export-VuAn | EP mẫu trộn biến auto + manual → chỉ manual cần nhập | ⚠️ High |
| [TC-076](#tc-076) | 🔴 P0 | `STATE` | Admin-Templates | Mẫu active → soft-delete → biến mất khỏi danh sách xuất | ⚠️ High |
| [TC-077](#tc-077) | 🔴 P0 | `STATE` | Export-VuAn | Số văn bản tăng tuần tự qua nhiều lần export (counter state) | 🚨 Critical |
| [TC-079](#tc-079) | 🔴 P0 | `DECISION` | Admin-Templates | Bảng quyết định needsNumber × numberSeriesId | 🚨 Critical |
| [TC-080](#tc-080) | 🔴 P0 | `DECISION` | Export-VuAn | Bảng quyết định entityType record × entityType mẫu | 🚨 Critical |
| [TC-097](#tc-097) | 🔴 P0 | `RED` | Export-VuViec | GET /incidents/export-templates KHÔNG trả mẫu VU_AN | ⚠️ High |
| [TC-098](#tc-098) | 🔴 P0 | `RED` | Export-VuAn | GET /cases/export-templates KHÔNG trả mẫu VU_VIEC/DON_THU | ⚠️ High |
| [TC-101](#tc-101) | 🔴 P0 | `RED` | Export-VuAn | 1 mẫu lỗi render trong lô gộp → toàn bộ tx rollback (atomic, no-gap) | 🚨 Critical |
| [TC-102](#tc-102) | 🔴 P0 | `RED` | Export-VuAn | Lỗi nén ZIP (archiver) → rollback số trong tx | ⚠️ High |
| [TC-109](#tc-109) | 🔴 P0 | `RED` | RBAC | Officer2 (Tổ B) export case Tổ A → 403 | 🚨 Critical |
| [TC-114](#tc-114) | 🔴 P0 | `PERFORMANCE` | Export-VuAn | 2 export đồng thời cùng hồ sơ → không cấp số trùng, không deadlock | 🚨 Critical |
| [TC-002](#tc-002) | 🟠 P1 | `GREEN` | Admin-Templates | Admin upload mẫu VU_VIEC category Biên bản | ⚠️ High |
| [TC-006](#tc-006) | 🟠 P1 | `GREEN` | Export-VuAn | Xuất nhiều mẫu Vụ án dạng ZIP | ⚠️ High |
| [TC-012](#tc-012) | 🟠 P1 | `GREEN` | Export-DonThu | Nút In chứng từ độc lập trên Đơn thư mở popup 7 mẫu | ⚠️ High |
| [TC-020](#tc-020) | 🟠 P1 | `RED` | Admin-Templates | Tạo mẫu code trùng (cùng entityType, chưa xoá) → 409 | ⚠️ High |
| [TC-021](#tc-021) | 🟠 P1 | `RED` | Export-VuAn | Export với templateIds rỗng → 400 ArrayNotEmpty | ⚠️ High |
| [TC-022](#tc-022) | 🟠 P1 | `RED` | Export-VuAn | Export templateId không tồn tại → 400 'không tồn tại hoặc đã bị xoá' | ⚠️ High |
| [TC-024](#tc-024) | 🟠 P1 | `RED` | Export-VuAn | Export templateIds trùng lặp → 400 | ⚠️ High |
| [TC-025](#tc-025) | 🟠 P1 | `RED` | Export-VuAn | Export mẫu cấp số nhưng numberSeriesId=null (mẫu cũ lỗi) → 400 | ⚠️ High |
| [TC-039](#tc-039) | 🟠 P1 | `RED` | Admin-Templates | Tạo mẫu thiếu code → 400 | ⚠️ High |
| [TC-040](#tc-040) | 🟠 P1 | `RED` | Admin-Templates | Tạo mẫu thiếu file → 400 | ⚠️ High |
| [TC-041](#tc-041) | 🟠 P1 | `RED` | Admin-Templates | Tạo mẫu entityType không hợp lệ → 400 | ⚠️ High |
| [TC-048](#tc-048) | 🟠 P1 | `RED` | Export-VuAn | List export-templates không trả mẫu đã soft-delete | ⚠️ High |
| [TC-051](#tc-051) | 🟠 P1 | `BOUNDARY` | Admin-Templates | Upload file đúng 5MB → chấp nhận | ⚠️ High |
| [TC-052](#tc-052) | 🟠 P1 | `BOUNDARY` | Admin-Templates | Upload file 5MB+1 byte → reject | ⚠️ High |
| [TC-073](#tc-073) | 🟠 P1 | `RED` | Export-VuAn | Export quá Throttle (request thứ 6 trong 60s) → 429 | ⚠️ High |
| [TC-085](#tc-085) | 🟠 P1 | `RED` | Export-VuViec | Form vụ việc tên < 5 ký tự → chặn lưu | ⚠️ High |
| [TC-086](#tc-086) | 🟠 P1 | `RED` | Export-VuAn | Form vụ án thiếu Nguồn vụ án → chặn lưu và xuất | ⚠️ High |
| [TC-087](#tc-087) | 🟠 P1 | `RED` | Export-VuAn | Double-submit form vụ án (click nhanh 2 lần) → chỉ 1 POST | ⚠️ High |
| [TC-088](#tc-088) | 🟠 P1 | `RED` | Export-VuViec | Double-submit form vụ việc → chỉ 1 POST | ⚠️ High |
| [TC-091](#tc-091) | 🟠 P1 | `RED` | Export-VuAn | Export trả lỗi nghiệp vụ (400) → modal hiện lỗi, KHÔNG tải file rỗng | ⚠️ High |
| [TC-104](#tc-104) | 🟠 P1 | `RED` | Admin-Templates | needsNumber gửi string 'false' (multipart) → parse đúng = false | ⚠️ High |
| [TC-119](#tc-119) | 🟠 P1 | `A11Y` | Export-VuAn | Keyboard: Tab tới checkbox, Space toggle, Enter xuất | ⚠️ High |
| [TC-123](#tc-123) | 🟠 P1 | `COMPAT` | Export-VuAn | Chrome desktop mới nhất — toàn luồng xuất | ⚠️ High |
| [TC-128](#tc-128) | 🟠 P1 | `COMPAT` | Export-VuAn | File .docx xuất mở đúng trên MS Word 365 + LibreOffice | ⚠️ High |
| [TC-008](#tc-008) | 🟡 P2 | `GREEN` | Export-VuAn | Đóng modal sau Lưu-và-xuất → điều hướng về danh sách | ⚡ Medium |
| [TC-009](#tc-009) | 🟡 P2 | `GREEN` | Export-VuAn | Đóng modal sau nút In chứng từ → ở lại form (không điều hướng) | ⚡ Medium |
| [TC-013](#tc-013) | 🟡 P2 | `GREEN` | Export-DonThu | Đóng popup In chứng từ đơn thư → ở lại form | ⚡ Medium |
| [TC-016](#tc-016) | 🟡 P2 | `GREEN` | Admin-Templates | Admin sửa sortOrder mẫu → thứ tự hiển thị thay đổi | 📌 Low |
| [TC-042](#tc-042) | 🟡 P2 | `RED` | Admin-Templates | Tạo mẫu category không hợp lệ → 400 | ⚡ Medium |
| [TC-043](#tc-043) | 🟡 P2 | `RED` | Admin-Templates | PATCH mẫu không tồn tại → 404 | ⚡ Medium |
| [TC-044](#tc-044) | 🟡 P2 | `RED` | Admin-Templates | DELETE mẫu không tồn tại → 404 | ⚡ Medium |
| [TC-045](#tc-045) | 🟡 P2 | `RED` | Export-VuAn | Export mode không hợp lệ → 400 | ⚡ Medium |
| [TC-046](#tc-046) | 🟡 P2 | `RED` | Export-VuAn | Export case không tồn tại → 404 | ⚡ Medium |
| [TC-049](#tc-049) | 🟡 P2 | `RED` | Export-VuAn | List export-templates không trả fileBytes (payload nặng) | ⚡ Medium |
| [TC-050](#tc-050) | 🟡 P2 | `RED` | RBAC | Officer1 GET export-templates Vụ án khi không có quyền read Case → 403 | ⚡ Medium |
| [TC-053](#tc-053) | 🟡 P2 | `BOUNDARY` | Admin-Templates | Upload file 0 byte → reject docx không hợp lệ | ⚡ Medium |
| [TC-054](#tc-054) | 🟡 P2 | `BOUNDARY` | Admin-Templates | code đúng 50 ký tự → chấp nhận | ⚡ Medium |
| [TC-055](#tc-055) | 🟡 P2 | `BOUNDARY` | Admin-Templates | code 51 ký tự → 400 | ⚡ Medium |
| [TC-060](#tc-060) | 🟡 P2 | `BOUNDARY` | Export-VuAn | Export đúng 1 mẫu (min) → thành công | ⚡ Medium |
| [TC-061](#tc-061) | 🟡 P2 | `BOUNDARY` | Export-VuAn | Export nhiều mẫu (vd 10) gộp → 1 file ngắt trang đúng | ⚡ Medium |
| [TC-062](#tc-062) | 🟡 P2 | `EP` | Admin-Templates | EP entityType hợp lệ VU_AN | ⚡ Medium |
| [TC-063](#tc-063) | 🟡 P2 | `EP` | Admin-Templates | EP entityType hợp lệ VU_VIEC | ⚡ Medium |
| [TC-065](#tc-065) | 🟡 P2 | `EP` | Export-VuAn | EP mode=merged (partition gộp) | ⚡ Medium |
| [TC-066](#tc-066) | 🟡 P2 | `EP` | Export-VuAn | EP mode=zip (partition tách) | ⚡ Medium |
| [TC-067](#tc-067) | 🟡 P2 | `EP` | Export-VuAn | EP mode mặc định (không gửi) → merged | ⚡ Medium |
| [TC-071](#tc-071) | 🟡 P2 | `DATA` | Export-VuAn | manualValues ký tự đặc biệt tiếng Việt có dấu → render đúng UTF-8 | ⚡ Medium |
| [TC-072](#tc-072) | 🟡 P2 | `DATA` | Export-VuAn | Field record null (vd crime trống) → placeholder rỗng không crash | ⚡ Medium |
| [TC-074](#tc-074) | 🟡 P2 | `RED` | Admin-Templates | Tạo mẫu needsNumber=true với numberSeriesId không tồn tại trong chuỗi số | ⚡ Medium |
| [TC-075](#tc-075) | 🟡 P2 | `RED` | Export-VuAn | Bỏ chọn hết mẫu trong modal → nút Xuất disabled | ⚡ Medium |
| [TC-078](#tc-078) | 🟡 P2 | `STATE` | Export-VuAn | Nút In chứng từ chỉ hiện ở edit mode (không hiện create) | ⚡ Medium |
| [TC-081](#tc-081) | 🟡 P2 | `EDGE` | Export-VuAn | Mẫu .docx không có placeholder nào → export ra file nguyên bản | ⚡ Medium |
| [TC-082](#tc-082) | 🟡 P2 | `EDGE` | Export-VuAn | Record mới tạo chưa có mẫu nào active → modal hiện 'Chưa có mẫu' | ⚡ Medium |
| [TC-084](#tc-084) | 🟡 P2 | `RED` | Admin-Templates | PATCH mẫu set needsNumber=true nhưng numberSeriesId=null → vẫn lưu (GAP) | ⚡ Medium |
| [TC-089](#tc-089) | 🟡 P2 | `RED` | Admin-Templates | replaceFile với file không docx → 400 | ⚡ Medium |
| [TC-090](#tc-090) | 🟡 P2 | `RED` | Admin-Templates | replaceFile mẫu không tồn tại → 404 | ⚡ Medium |
| [TC-092](#tc-092) | 🟡 P2 | `RED` | Export-VuAn | manualValues cho biến KHÔNG thuộc mẫu đang chọn → bị bỏ qua | ⚡ Medium |
| [TC-093](#tc-093) | 🟡 P2 | `RED` | Export-VuAn | Token hết hạn giữa lúc export → 401 (refresh/redirect login) | ⚡ Medium |
| [TC-094](#tc-094) | 🟡 P2 | `RED` | Admin-Templates | Upload .docx corrupt (zip hỏng) → 400 | ⚡ Medium |
| [TC-095](#tc-095) | 🟡 P2 | `RED` | Export-VuAn | Export khi record vừa bị người khác xoá → 404 | ⚡ Medium |
| [TC-099](#tc-099) | 🟡 P2 | `RED` | Admin-Templates | Tạo mẫu code trùng nhưng entityType KHÁC → cho phép | ⚡ Medium |
| [TC-100](#tc-100) | 🟡 P2 | `RED` | Admin-Templates | Tạo mẫu code trùng với mẫu đã soft-delete → cho phép (reuse) | ⚡ Medium |
| [TC-103](#tc-103) | 🟡 P2 | `RED` | Admin-Templates | PATCH update code trùng → hiện chưa catch P2002 (gap) | ⚡ Medium |
| [TC-108](#tc-108) | 🟡 P2 | `RED` | Admin-Templates | Xoá mẫu đang được hiển thị trong modal người khác → export sau đó 400 | ⚡ Medium |
| [TC-112](#tc-112) | 🟡 P2 | `PERFORMANCE` | Export-VuAn | Export 1 mẫu gộp < 3s | ⚡ Medium |
| [TC-113](#tc-113) | 🟡 P2 | `PERFORMANCE` | Export-VuAn | Export 10 mẫu ZIP < 8s | ⚡ Medium |
| [TC-115](#tc-115) | 🟡 P2 | `PERFORMANCE` | Export-VuAn | GET export-templates với 50 mẫu < 500ms (omit fileBytes) | ⚡ Medium |
| [TC-116](#tc-116) | 🟡 P2 | `A11Y` | Export-VuAn | Modal có role=dialog + aria-modal=true | ⚡ Medium |
| [TC-117](#tc-117) | 🟡 P2 | `A11Y` | Export-VuAn | Nút đóng (X) có aria-label='Đóng' | ⚡ Medium |
| [TC-118](#tc-118) | 🟡 P2 | `A11Y` | Export-VuAn | Checkbox mẫu liên kết label (click text toggle) | ⚡ Medium |
| [TC-121](#tc-121) | 🟡 P2 | `A11Y` | Export-VuAn | Thông báo lỗi export có role=alert | ⚡ Medium |
| [TC-124](#tc-124) | 🟡 P2 | `COMPAT` | Export-VuAn | Microsoft Edge — luồng xuất | ⚡ Medium |
| [TC-125](#tc-125) | 🟡 P2 | `COMPAT` | Export-VuAn | Firefox — tải blob + filename | ⚡ Medium |
| [TC-126](#tc-126) | 🟡 P2 | `COMPAT` | Export-VuAn | Safari macOS — filename UTF-8 + createObjectURL | ⚡ Medium |
| [TC-127](#tc-127) | 🟡 P2 | `COMPAT` | Export-VuAn | Mobile responsive — modal xuất trên màn hình hẹp | ⚡ Medium |
| [TC-056](#tc-056) | 🟢 P3 | `BOUNDARY` | Admin-Templates | name 255 ký tự → chấp nhận | 📌 Low |
| [TC-057](#tc-057) | 🟢 P3 | `BOUNDARY` | Admin-Templates | name 256 ký tự → 400 | 📌 Low |
| [TC-058](#tc-058) | 🟢 P3 | `BOUNDARY` | Admin-Templates | sortOrder = 0 → chấp nhận (Min 0) | 📌 Low |
| [TC-059](#tc-059) | 🟢 P3 | `BOUNDARY` | Admin-Templates | sortOrder = -1 → 400 | 📌 Low |
| [TC-064](#tc-064) | 🟢 P3 | `EP` | Admin-Templates | EP entityType hợp lệ DON_THU (lưu được, biến all manual) | 📌 Low |
| [TC-083](#tc-083) | 🟢 P3 | `EDGE` | Export-VuAn | Nhiều mẫu cùng category → gộp 1 nhóm header | 📌 Low |
| [TC-096](#tc-096) | 🟢 P3 | `RED` | Export-VuAn | filename header thiếu → FE fallback ChungTu.docx | 📌 Low |
| [TC-105](#tc-105) | 🟢 P3 | `RED` | Admin-Templates | sortOrder gửi 'abc' (không phải số) → 400 IsInt | 📌 Low |
| [TC-106](#tc-106) | 🟢 P3 | `RED` | Export-VuAn | Export body không phải JSON → 400 | 📌 Low |
| [TC-107](#tc-107) | 🟢 P3 | `RED` | Export-VuAn | manualValues rất lớn (vd 500 key) → xử lý không crash | 📌 Low |
| [TC-110](#tc-110) | 🟢 P3 | `RED` | Export-VuAn | GET export-templates trả đúng thứ tự sortOrder asc | 📌 Low |
| [TC-111](#tc-111) | 🟢 P3 | `RED` | Admin-Templates | Upload kèm 2 field file → chỉ nhận field 'file' | 📌 Low |
| [TC-120](#tc-120) | 🟢 P3 | `A11Y` | Export-VuAn | Radio định dạng có legend 'Định dạng xuất' | 📌 Low |
| [TC-122](#tc-122) | 🟢 P3 | `A11Y` | Export-VuAn | Tương phản nút Xuất file (trắng/xanh) ≥ 4.5:1 | 📌 Low |
| [TC-129](#tc-129) | 🟢 P3 | `COMPAT` | Export-VuAn | File ZIP giải nén đúng trên Windows Explorer + 7zip | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `POST /document-templates`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Admin upload mẫu VU_AN không cấp số thành công

### Điều kiện tiên quyết
- Đăng nhập ADMIN, có file qd.docx hợp lệ

### Các bước kiểm thử
- [ ] Vào /settings/document-templates
- [ ] Nhấn Thêm mẫu
- [ ] Nhập code=QD-KT-01, name=QĐ khởi tố
- [ ] entityType=Vụ án, category=Quyết định
- [ ] Chọn file qd.docx
- [ ] Nhấn Lưu

### Dữ liệu kiểm thử
```
code=QD-KT-01
```

### Kết quả mong đợi
**UI**:
- Modal đóng, mẫu mới xuất hiện trong danh sách

**API**:
- trả DocumentTemplate {id, code, entityType:'VU_AN', variables[]}

**Side effects** (DB, email, log, queue...):
- DB có row DocumentTemplate, fileBytes lưu, variables phân loại auto/manual

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Core admin flow

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `numberSeriesId`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Admin bật Cấp số + chọn chuỗi số → lưu thành công

### Điều kiện tiên quyết
- ADMIN, có chuỗi số CASE

### Các bước kiểm thử
- [ ] Thêm mẫu VU_AN
- [ ] Tick 'Cấp số văn bản'
- [ ] Select chuỗi số hiện ra → chọn 'Số vụ án (CASE)'
- [ ] Upload file + Lưu

### Dữ liệu kiểm thử
```
numberSeriesId=CASE
```

### Kết quả mong đợi
**UI**:
- Select chuỗi số hiện khi tick; nút Lưu enabled sau khi chọn

**API**:
- với needsNumber=true, numberSeriesId='CASE'

**Side effects** (DB, email, log, queue...):
- Mẫu lưu đúng numberSeriesId

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: Critical
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P1-A fix /review

---

## TC-004

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `GET /cases/export-templates`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer mở modal xuất chứng từ ở form Vụ án (edit) qua nút In chứng từ

### Điều kiện tiên quyết
- OFF1 đăng nhập, có case Tổ A, có mẫu VU_AN active

### Các bước kiểm thử
- [ ] Mở /cases/{case_A_id}/edit
- [ ] Nhấn nút 'In chứng từ'

### Kết quả mong đợi
**UI**:
- DynamicExportDocumentsModal mở, hiện mẫu VU_AN nhóm theo category, tick sẵn tất cả

**API**:
- GET /cases/export-templates 200 trả mảng mẫu active

**Side effects** (DB, email, log, queue...):
- Không cần lưu lại record

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: Critical
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Officer KHÔNG có quyền Setting vẫn list được

---

## TC-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `POST /cases/:id/export-documents`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất 1 mẫu Vụ án dạng gộp (merged) tải file .docx

### Điều kiện tiên quyết
- Modal đang mở, 1 mẫu tick

### Các bước kiểm thử
- [ ] Chọn 1 mẫu
- [ ] Chọn định dạng Gộp 1 file Word
- [ ] Nhấn Xuất file

### Dữ liệu kiểm thử
```
mode=merged
```

### Kết quả mong đợi
**UI**:
- File ChungTu_YYYYMMDD.docx tải về, modal đóng

**API**:
- POST 200, Content-Type docx, Content-Disposition filename=ChungTu_*.docx

**Side effects** (DB, email, log, queue...):
- DocumentRenderLog tạo, placeholder điền từ record

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: Critical
module: Export-VuAn
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
- Module: `Export-VuAn`
- Yêu cầu: `SaveSplitButton onSaveAndExport`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Lưu và xuất file (split-button) ở form Vụ án tạo mới

### Điều kiện tiên quyết
- OFF1, form tạo vụ án hợp lệ

### Các bước kiểm thử
- [ ] Điền form vụ án hợp lệ
- [ ] Mở menu ▼ split-button
- [ ] Chọn 'Lưu và xuất file'
- [ ] Qua gate PreSaveSummary → Xác nhận

### Kết quả mong đợi
**UI**:
- Lưu xong → mở modal xuất chứng từ (KHÔNG về danh sách)

**API**:
- POST /cases 201 trả id; sau đó modal fetch export-templates

**Side effects** (DB, email, log, queue...):
- Record lưu, exportForId = id mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: Critical
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: intent giữ qua exportAfterSaveRef

---

## TC-010

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Export-VuViec`
- Yêu cầu: `POST /incidents/:id/export-documents`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất chứng từ Vụ việc qua nút In chứng từ (IncidentFormPage)

### Điều kiện tiên quyết
- OFF1, incident Tổ A, mẫu VU_VIEC active

### Các bước kiểm thử
- [ ] Mở /vu-viec/{incident_A_id}/edit
- [ ] Nhấn In chứng từ
- [ ] Tick mẫu → Xuất file

### Kết quả mong đợi
- , file .docx tải về, entityType=VU_VIEC đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuViec`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuViec`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Critical
module: Export-VuViec
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
- Module: `Export-VuViec`
- Yêu cầu: `doSave {ok,id} + onSaveAndExport`
- Kỹ thuật: `Happy path`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Lưu và xuất file ở form Vụ việc (split-button)

### Điều kiện tiên quyết
- OFF1, form vụ việc hợp lệ (tên ≥5 ký tự)

### Các bước kiểm thử
- [ ] Điền tên vụ việc hợp lệ
- [ ] ▼ → Lưu và xuất file

### Kết quả mong đợi
- POST /incidents 201 → modal mở với id mới

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuViec`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuViec`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: High
module: Export-VuViec
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
- Module: `Export-VuAn`
- Yêu cầu: `manualVars union`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Form biến nhập tay hiển thị khi mẫu có biến source=manual được chọn

### Điều kiện tiên quyết
- Mẫu VU_AN có {hoTenBiCan} (manual)

### Các bước kiểm thử
- [ ] Mở modal, tick mẫu có biến manual
- [ ] Quan sát section 'Thông tin nhập tay'
- [ ] Nhập giá trị hoTenBiCan
- [ ] Xuất file

### Dữ liệu kiểm thử
```
hoTenBiCan=Nguyễn Văn X
```

### Kết quả mong đợi
**UI**:
- Input dyn-manual-hoTenBiCan hiện; ẩn khi bỏ chọn mẫu

**API**:
- POST gửi manualValues={hoTenBiCan:'...'}

**Side effects** (DB, email, log, queue...):
- File .docx điền đúng giá trị nhập tay (không rỗng câm)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Critical
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P1-B fix /review

---

## TC-015

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `atomic cấp số`
- Kỹ thuật: `Happy path`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất mẫu bật cấp số → cấp 1 số văn bản vào file

### Điều kiện tiên quyết
- Mẫu VU_AN needsNumber=true series=CASE

### Các bước kiểm thử
- [ ] Mở modal, tick mẫu cấp số
- [ ] Xuất file

### Kết quả mong đợi
- , file chứa số văn bản theo định dạng chuỗi CASE; DocumentRenderLog.generatedNumber set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: Critical
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `needsNumber thiếu series`
- Kỹ thuật: `Negative`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload mẫu bật Cấp số nhưng KHÔNG chọn chuỗi số → chặn

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Thêm mẫu, tick Cấp số
- [ ] KHÔNG chọn chuỗi số
- [ ] Thử Lưu

### Dữ liệu kiểm thử
```
needsNumber=true,numberSeriesId=''
```

### Kết quả mong đợi
**UI**:
- Nút Lưu disabled (canSave=false)

**API**:
- Nếu bypass UI: 400 'Bật cấp số... phải chọn chuỗi số'

**Side effects** (DB, email, log, queue...):
- Không tạo mẫu lỗi cấu hình

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Critical
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P1-A — tránh dead-on-arrival 400 lúc in

---

## TC-018

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `fileFilter`
- Kỹ thuật: `Negative`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload file không phải .docx (txt) → reject

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Thêm mẫu, chọn file a.txt

### Dữ liệu kiểm thử
```
file=a.txt
```

### Kết quả mong đợi
- 'Chỉ chấp nhận file .docx' (fileFilter chặn)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: Admin-Templates
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
- Module: `Admin-Templates`
- Yêu cầu: `assertValidDocx`
- Kỹ thuật: `Negative`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Upload .docx giả (đổi đuôi từ .exe) → assertValidDocx reject

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Đổi tên payload.exe → a.docx, set Content-Type docx
- [ ] Upload

### Dữ liệu kiểm thử
```
file=fake.docx
```

### Kết quả mong đợi
- 'File không phải .docx hợp lệ' (thiếu word/document.xml)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: MIME spoof

---

## TC-023

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `entityType match`
- Kỹ thuật: `Negative`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export mẫu sai entityType (mẫu VU_VIEC cho case) → 400

### Điều kiện tiên quyết
- OFF1, mẫu VU_VIEC, case Tổ A

### Các bước kiểm thử
- [ ] POST /cases/{case_id}/export-documents {templateIds:[tpl_vuviec_id]}

### Kết quả mong đợi
- 'Mẫu chứng từ không thuộc loại hồ sơ này'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Export-VuAn
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `write Setting`
- Kỹ thuật: `AuthZ`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer KHÔNG có quyền Setting upload mẫu → 403

### Điều kiện tiên quyết
- OFF1 (không Setting)

### Các bước kiểm thử
- [ ] OFF1 POST /document-templates multipart

### Kết quả mong đợi
- Forbidden (PermissionsGuard)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Critical
module: RBAC
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: OWASP A01

---

## TC-027

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `write Setting delete`
- Kỹ thuật: `AuthZ`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer DELETE mẫu → 403

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] OFF1 DELETE /document-templates/{id}

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Critical
module: RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `DataScope export`
- Kỹ thuật: `IDOR`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR: officer1 export vụ án Tổ B (ngoài scope) → 403

### Điều kiện tiên quyết
- OFF1 (Tổ A), case_B thuộc Tổ B

### Các bước kiểm thử
- [ ] OFF1 POST /cases/{case_B_id}/export-documents

### Kết quả mong đợi
- (getById scope-check ném Forbidden trước khi render)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Critical
module: RBAC
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Rò rỉ dữ liệu cross-tổ

---

## TC-029

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `DataScope incident`
- Kỹ thuật: `IDOR`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR: officer1 export vụ việc Tổ B → 403

### Điều kiện tiên quyết
- OFF1, incident Tổ B

### Các bước kiểm thử
- [ ] OFF1 POST /incidents/{incident_B_id}/export-documents

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Critical
module: RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `JwtAuthGuard`
- Kỹ thuật: `AuthN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export không kèm token → 401

### Điều kiện tiên quyết
- Không đăng nhập

### Các bước kiểm thử
- [ ] POST /cases/{id}/export-documents không Authorization

### Kết quả mong đợi
- Unauthorized

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: RBAC
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A07

---

## TC-031

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `JwtAuthGuard`
- Kỹ thuật: `AuthN`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET export-templates không token → 401

### Điều kiện tiên quyết
- Không token

### Các bước kiểm thử
- [ ] GET /cases/export-templates

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: High
module: RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `esc() placeholder`
- Kỹ thuật: `Injection`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Template injection qua manualValues → escape, không thực thi

### Điều kiện tiên quyết
- Mẫu có biến manual

### Các bước kiểm thử
- [ ] manualValues.hoTenBiCan = '{soVuAn}{#loop}{/loop}'
- [ ] Export

### Dữ liệu kiểm thử
```
payload tag docx
```

### Kết quả mong đợi
- File render literal chuỗi (❴soVuAn❵...), KHÔNG thực thi tag docxtemplater, không crash

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: High
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A03 — esc { } < >

---

## TC-033

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `param bind $1`
- Kỹ thuật: `Injection`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SQL injection qua entityId path → an toàn

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST /cases/1'%20OR%20'1'='1/export-documents

### Kết quả mong đợi
- /400 (id không khớp), không lỗi SQL, row-lock $1 bind

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: High
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A03

---

## TC-034

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `output encoding`
- Kỹ thuật: `XSS`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: XSS qua tên mẫu hiển thị list admin → React escape

### Điều kiện tiên quyết
- ADMIN tạo mẫu name có <script>

### Các bước kiểm thử
- [ ] Tạo mẫu name='<script>alert(1)</script>'
- [ ] Xem danh sách

### Dữ liệu kiểm thử
```
name=<script>
```

### Kết quả mong đợi
- Hiển thị literal text, script KHÔNG chạy

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: High
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A03

---

## TC-035

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `ValidationPipe whitelist`
- Kỹ thuật: `Mass assignment`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Mass assignment: gửi field lạ trong export body → whitelist loại bỏ

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export {templateIds:[t1],mode:'merged',createdById:'hack',status:'x'}

### Kết quả mong đợi
- Field thừa bị loại (whitelist), không ảnh hưởng; 200/400 theo whitelist config

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Medium
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: A08

---

## TC-036

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `esc(s(v))`
- Kỹ thuật: `Type confusion`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: manualValues non-string (object) → coerce an toàn

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export manualValues={hoTenBiCan:{a:1}}

### Kết quả mong đợi
- Không crash; render '[object Object]' đã escape, không injection

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: Low
module: Export-VuAn
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `read Setting`
- Kỹ thuật: `AuthZ`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /document-templates (list admin) bởi officer → 403

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] OFF1 GET /document-templates

### Kết quả mong đợi
- (officer dùng /cases|incidents/export-templates, không /document-templates)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: High
module: RBAC
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Phân tách quyền

---

## TC-038

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `write Setting patch`
- Kỹ thuật: `AuthZ`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: officer1 sửa mẫu (PATCH) → 403

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] OFF1 PATCH /document-templates/{id} {sortOrder:9}

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: High
module: RBAC
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
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `status active + deletedAt null`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export mẫu đã soft-delete → 400 không tồn tại

### Điều kiện tiên quyết
- Mẫu đã DELETE

### Các bước kiểm thử
- [ ] POST export {templateIds:[tpl_deleted_id]}

### Kết quả mong đợi
- 'không tồn tại hoặc đã bị xoá'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: High
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `isAutoPlaceholder`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP biến auto (trong catalog) → tự điền không cần nhập

### Điều kiện tiên quyết
- Mẫu chỉ chứa biến catalog

### Các bước kiểm thử
- [ ] Mở modal mẫu chỉ có {soVuAn}{tenVuAn}

### Kết quả mong đợi
- Section nhập tay KHÔNG hiện; file điền tự động

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: High
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `source=manual`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP biến manual (ngoài catalog) → yêu cầu nhập

### Điều kiện tiên quyết
- Mẫu có {hoTenBiCan}

### Các bước kiểm thử
- [ ] Mở modal mẫu có biến ngoài catalog

### Kết quả mong đợi
- Input nhập tay hiện cho hoTenBiCan

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: High
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `phân loại hỗn hợp`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP mẫu trộn biến auto + manual → chỉ manual cần nhập

### Điều kiện tiên quyết
- Mẫu {soVuAn}+{hoTenBiCan}

### Các bước kiểm thử
- [ ] Mở modal
- [ ] Quan sát

### Kết quả mong đợi
- Chỉ hoTenBiCan có input; soVuAn auto-điền

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: High
module: Export-VuAn
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
- Module: `Admin-Templates`
- Yêu cầu: `state active→deleted`
- Kỹ thuật: `State transition`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mẫu active → soft-delete → biến mất khỏi danh sách xuất

### Điều kiện tiên quyết
- Mẫu VU_AN active

### Các bước kiểm thử
- [ ] GET export-templates (thấy mẫu)
- [ ] ADMIN DELETE mẫu
- [ ] GET export-templates lại

### Kết quả mong đợi
- Sau xoá: mẫu không còn trong list; export mẫu đó → 400

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: High
module: Admin-Templates
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
- Module: `Export-VuAn`
- Yêu cầu: `commitWithTx counter`
- Kỹ thuật: `State transition`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Số văn bản tăng tuần tự qua nhiều lần export (counter state)

### Điều kiện tiên quyết
- Mẫu cấp số series=CASE

### Các bước kiểm thử
- [ ] Export lần 1 → số N
- [ ] Export lần 2 → số N+1
- [ ] Export lần 3 → số N+2

### Kết quả mong đợi
- Số tăng đơn điệu, không trùng, không bỏ qua (no-gap khi thành công)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: Critical
module: Export-VuAn
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Admin-Templates`
- Yêu cầu: `cấp số config matrix`
- Kỹ thuật: `Decision table`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Bảng quyết định needsNumber × numberSeriesId

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] (true,set)→tạo OK, export cấp số
- [ ] (true,null)→400 chặn tạo
- [ ] (false,null)→OK không số
- [ ] (false,set)→OK bỏ qua số

### Dữ liệu kiểm thử
```
matrix
```

### Kết quả mong đợi
- Đúng 4 nhánh; chỉ (true,null) bị chặn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: Critical
module: Admin-Templates
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `match entityType`
- Kỹ thuật: `Decision table`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Bảng quyết định entityType record × entityType mẫu

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] case×VU_AN→OK
- [ ] case×VU_VIEC→400
- [ ] incident×VU_VIEC→OK
- [ ] incident×VU_AN→400

### Dữ liệu kiểm thử
```
matrix
```

### Kết quả mong đợi
- Chỉ khớp loại mới render

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Export-VuViec`
- Yêu cầu: `entityType filter VU_VIEC`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /incidents/export-templates KHÔNG trả mẫu VU_AN

### Điều kiện tiên quyết
- Có mẫu VU_AN + VU_VIEC

### Các bước kiểm thử
- [ ] GET /incidents/export-templates

### Kết quả mong đợi
- Chỉ trả mẫu VU_VIEC, không lẫn VU_AN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuViec`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuViec`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: High
module: Export-VuViec
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Cách ly entity

---

## TC-098

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `entityType filter VU_AN`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET /cases/export-templates KHÔNG trả mẫu VU_VIEC/DON_THU

### Điều kiện tiên quyết
- Có mẫu nhiều loại

### Các bước kiểm thử
- [ ] GET /cases/export-templates

### Kết quả mong đợi
- Chỉ trả VU_AN

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: High
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `$transaction atomic`
- Kỹ thuật: `Negative atomic`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: 1 mẫu lỗi render trong lô gộp → toàn bộ tx rollback (atomic, no-gap)

### Điều kiện tiên quyết
- mẫu, 1 mẫu cấp số lỗi

### Các bước kiểm thử
- [ ] Export [mẫu_ok, mẫu_loi] merged

### Kết quả mong đợi
- Lỗi → rollback HẾT: số đã cấp cho mẫu_ok cũng hoàn, không file trả về, không gap số

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: Critical
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Lõi atomic

---

## TC-102

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `finalize trong tx`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Lỗi nén ZIP (archiver) → rollback số trong tx

### Điều kiện tiên quyết
- Mẫu cấp số mode=zip, mô phỏng archiver error

### Các bước kiểm thử
- [ ] Export zip gặp lỗi nén

### Kết quả mong đợi
- Số cấp bị rollback (finalize nằm trong tx)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: High
module: Export-VuAn
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
- Priority: `P0` 🔴
- Module: `RBAC`
- Yêu cầu: `DataScope đối xứng`
- Kỹ thuật: `Negative IDOR`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer2 (Tổ B) export case Tổ A → 403

### Điều kiện tiên quyết
- OFF2 Tổ B, case Tổ A

### Các bước kiểm thử
- [ ] OFF2 POST /cases/{case_A_id}/export-documents

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: Critical
module: RBAC
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
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `Export-VuAn`
- Yêu cầu: `row lock FOR UPDATE`
- Kỹ thuật: `Concurrency`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: 2 export đồng thời cùng hồ sơ → không cấp số trùng, không deadlock

### Điều kiện tiên quyết
- Mẫu cấp số

### Các bước kiểm thử
- [ ] Bắn 2 POST export song song cùng case_A

### Kết quả mong đợi
- số khác nhau tuần tự, không trùng, không deadlock (row lock serialize)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Critical
module: Export-VuAn
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
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `POST /document-templates`
- Kỹ thuật: `Happy path`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Admin upload mẫu VU_VIEC category Biên bản

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Thêm mẫu entityType=Vụ việc, category=Biên bản
- [ ] Upload bb.docx
- [ ] Lưu

### Dữ liệu kiểm thử
```
code=BB-01
```

### Kết quả mong đợi
- , mẫu VU_VIEC active hiển thị trong list lọc Vụ việc

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: High
module: Admin-Templates
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
- Module: `Export-VuAn`
- Yêu cầu: `POST export mode=zip`
- Kỹ thuật: `Happy path`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất nhiều mẫu Vụ án dạng ZIP

### Điều kiện tiên quyết
- ≥2 mẫu VU_AN active

### Các bước kiểm thử
- [ ] Tick 2 mẫu
- [ ] Chọn Tách - file ZIP
- [ ] Xuất file

### Dữ liệu kiểm thử
```
mode=zip
```

### Kết quả mong đợi
- application/zip, filename ChungTu_*.zip chứa 2 file .docx, mỗi file đúng nội dung

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: High
module: Export-VuAn
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
- Priority: `P1` 🟠
- Module: `Export-DonThu`
- Yêu cầu: `ExportDocumentsModal petition`
- Kỹ thuật: `Happy path`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Nút In chứng từ độc lập trên Đơn thư mở popup 7 mẫu

### Điều kiện tiên quyết
- OFF1, đơn thư đã lưu

### Các bước kiểm thử
- [ ] Mở /petitions/{petition_A_id}/edit
- [ ] Nhấn In chứng từ

### Kết quả mong đợi
**UI**:
- Popup 7 mẫu hardcode hiện, tick sẵn, KHÔNG cần lưu lại

**API**:
- Không gọi POST /petitions

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-DonThu`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-DonThu`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: Export-DonThu
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: PR4

---

## TC-020

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `partial unique P2002`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo mẫu code trùng (cùng entityType, chưa xoá) → 409

### Điều kiện tiên quyết
- Đã có mẫu code=QD-KT-01 VU_AN

### Các bước kiểm thử
- [ ] Tạo mẫu mới cùng code=QD-KT-01, entityType=VU_AN

### Dữ liệu kiểm thử
```
code=QD-KT-01
```

### Kết quả mong đợi
- Conflict 'Mã mẫu đã tồn tại cho loại hồ sơ này' (không 500)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: High
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: P2002 catch /review

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `ExportEntityDocumentsDto`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export với templateIds rỗng → 400 ArrayNotEmpty

### Điều kiện tiên quyết
- OFF1, case Tổ A

### Các bước kiểm thử
- [ ] POST /cases/{id}/export-documents body {templateIds:[],mode:'merged'}

### Dữ liệu kiểm thử
```
templateIds=[]
```

### Kết quả mong đợi
**UI**:
- Nút Xuất disabled khi 0 mẫu

**API**:
- ArrayNotEmpty

**Side effects** (DB, email, log, queue...):
- Không cấp số, không tạo file

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: High
module: Export-VuAn
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
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `pre-validate templates`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export templateId không tồn tại → 400 'không tồn tại hoặc đã bị xoá'

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export {templateIds:['non-existent-id']}

### Dữ liệu kiểm thử
```
templateIds=[fake]
```

### Kết quả mong đợi
- 'Có mẫu chứng từ không tồn tại hoặc đã bị xoá'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: High
module: Export-VuAn
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
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `reject duplicate`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export templateIds trùng lặp → 400

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export {templateIds:[t1,t1]}

### Dữ liệu kiểm thử
```
templateIds=[t1,t1]
```

### Kết quả mong đợi
- 'templateIds không được trùng lặp' (tránh cấp 2 số cho 1 mẫu)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: High
module: Export-VuAn
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
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `needsNumber no series`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export mẫu cấp số nhưng numberSeriesId=null (mẫu cũ lỗi) → 400

### Điều kiện tiên quyết
- Mẫu legacy needsNumber=true series=null

### Các bước kiểm thử
- [ ] Export mẫu đó

### Kết quả mong đợi
- 'Mẫu ... bật cấp số nhưng chưa cấu hình series'; tx rollback, không gap số

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: High
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: defense backend

---

## TC-039

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `@IsString code`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo mẫu thiếu code → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] POST không có code

### Dữ liệu kiểm thử
```
code=''
```

### Kết quả mong đợi
- validation

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: High
module: Admin-Templates
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
- Module: `Admin-Templates`
- Yêu cầu: `UploadedFile required`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo mẫu thiếu file → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] POST không kèm file

### Kết quả mong đợi
- 'Thiếu file .docx'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: High
module: Admin-Templates
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
- Module: `Admin-Templates`
- Yêu cầu: `@IsIn ENTITY_TYPES`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo mẫu entityType không hợp lệ → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] POST entityType='XYZ'

### Dữ liệu kiểm thử
```
entityType=XYZ
```

### Kết quả mong đợi
- IsIn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: High
module: Admin-Templates
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
- Module: `Export-VuAn`
- Yêu cầu: `deletedAt null filter`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: List export-templates không trả mẫu đã soft-delete

### Điều kiện tiên quyết
- Có mẫu đã xoá

### Các bước kiểm thử
- [ ] GET /cases/export-templates

### Kết quả mong đợi
- Mảng KHÔNG chứa mẫu deletedAt set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: High
module: Export-VuAn
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `fileSize 5MB max`
- Kỹ thuật: `BVA max`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload file đúng 5MB → chấp nhận

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Upload .docx kích thước 5242880 byte

### Dữ liệu kiểm thử
```
5MB
```

### Kết quả mong đợi
- chấp nhận

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: High
module: Admin-Templates
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `fileSize limit`
- Kỹ thuật: `BVA max+1`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Upload file 5MB+1 byte → reject

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Upload .docx 5242881 byte

### Dữ liệu kiểm thử
```
5MB+1
```

### Kết quả mong đợi
- /400 quá giới hạn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: High
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `@Throttle 5/60s`
- Kỹ thuật: `Negative rate-limit`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export quá Throttle (request thứ 6 trong 60s) → 429

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Gửi 6 POST export liên tiếp <60s

### Kết quả mong đợi
- Request thứ 6 → 429 Too Many Requests

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: High
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DoS guard

---

## TC-085

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuViec`
- Yêu cầu: `validateForm name≥5`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form vụ việc tên < 5 ký tự → chặn lưu

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Nhập tên 'abc'
- [ ] Lưu/Lưu và xuất

### Dữ liệu kiểm thử
```
name=abc
```

### Kết quả mong đợi
- Hiện lỗi 'Tên vụ việc phải có ít nhất 5 ký tự', không gọi POST, không mở modal

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuViec`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuViec`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: High
module: Export-VuViec
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `validateForm caseProvenance`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form vụ án thiếu Nguồn vụ án → chặn lưu và xuất

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Để trống caseProvenance
- [ ] ▼ Lưu và xuất file

### Kết quả mong đợi
- Hiện lỗi banner, không lưu, không mở modal

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: High
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `savingRef guard`
- Kỹ thuật: `Negative concurrency`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Double-submit form vụ án (click nhanh 2 lần) → chỉ 1 POST

### Điều kiện tiên quyết
- OFF1, form hợp lệ

### Các bước kiểm thử
- [ ] Click Lưu liên tục 2 lần thật nhanh

### Kết quả mong đợi
- savingRef chặn lần 2 → chỉ 1 POST /cases, không tạo trùng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: High
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: codex P2

---

## TC-088

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuViec`
- Yêu cầu: `savingRef incident`
- Kỹ thuật: `Negative concurrency`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Double-submit form vụ việc → chỉ 1 POST

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Click Lưu nhanh 2 lần

### Kết quả mong đợi
- savingRef chặn lần 2 → 1 POST /incidents

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuViec`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuViec`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: High
module: Export-VuViec
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: /review P2

---

## TC-091

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `parseBlobError + errorMsg`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export trả lỗi nghiệp vụ (400) → modal hiện lỗi, KHÔNG tải file rỗng

### Điều kiện tiên quyết
- Mẫu cấp số lỗi series

### Các bước kiểm thử
- [ ] Export mẫu lỗi → BE 400 blob JSON

### Kết quả mong đợi
- Modal hiện message nghiệp vụ (parseBlobError), không tải file, không đóng modal

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: High
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Admin-Templates`
- Yêu cầu: `@Transform bool`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: needsNumber gửi string 'false' (multipart) → parse đúng = false

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] multipart needsNumber='false'

### Dữ liệu kiểm thử
```
'false'
```

### Kết quả mong đợi
- needsNumber=false (KHÔNG bị Boolean('false')=true)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: High
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: codex P2 PR1

---

## TC-119

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 2.1.1 keyboard`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Keyboard: Tab tới checkbox, Space toggle, Enter xuất

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Chỉ dùng bàn phím điều hướng + thao tác

### Kết quả mong đợi
- Tab focus được mọi control, Space tick, kích hoạt nút Xuất bằng Enter

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: High
module: Export-VuAn
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `browser compat`
- Kỹ thuật: `Compat`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome desktop mới nhất — toàn luồng xuất

### Điều kiện tiên quyết
- Chrome

### Các bước kiểm thử
- [ ] Chạy luồng xuất gộp/zip

### Kết quả mong đợi
- Tải file đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: High
module: Export-VuAn
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
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Export-VuAn`
- Yêu cầu: `docx render`
- Kỹ thuật: `Compat`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: File .docx xuất mở đúng trên MS Word 365 + LibreOffice

### Điều kiện tiên quyết
- Có file xuất

### Các bước kiểm thử
- [ ] Mở file ChungTu.docx bằng Word 365
- [ ] Mở bằng LibreOffice Writer

### Kết quả mong đợi
- Cả 2 mở được, placeholder đã điền, không lỗi định dạng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: High
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `exportNavigateOnClose=true`
- Kỹ thuật: `Happy path`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đóng modal sau Lưu-và-xuất → điều hướng về danh sách

### Điều kiện tiên quyết
- Vừa Lưu và xuất, modal mở

### Các bước kiểm thử
- [ ] Nhấn Đóng trên modal

### Kết quả mong đợi
- Điều hướng về /cases (danh sách)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: Medium
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `exportNavigateOnClose=false`
- Kỹ thuật: `Happy path`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đóng modal sau nút In chứng từ → ở lại form (không điều hướng)

### Điều kiện tiên quyết
- Mở modal qua nút In chứng từ (edit)

### Các bước kiểm thử
- [ ] Nhấn Đóng

### Kết quả mong đợi
- Modal đóng, vẫn ở /cases/{id}/edit

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Medium
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-DonThu`
- Yêu cầu: `exportNavigateOnClose=false petition`
- Kỹ thuật: `Happy path`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đóng popup In chứng từ đơn thư → ở lại form

### Điều kiện tiên quyết
- Popup mở qua In chứng từ

### Các bước kiểm thử
- [ ] Nhấn Đóng

### Kết quả mong đợi
- Ở lại /petitions/{id}/edit, không về danh sách

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-DonThu`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-DonThu`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: Medium
module: Export-DonThu
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
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `PATCH /document-templates/:id`
- Kỹ thuật: `Happy path`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Admin sửa sortOrder mẫu → thứ tự hiển thị thay đổi

### Điều kiện tiên quyết
- ADMIN, có ≥2 mẫu

### Các bước kiểm thử
- [ ] PATCH mẫu set sortOrder=5

### Dữ liệu kiểm thử
```
sortOrder=5
```

### Kết quả mong đợi
- ; list sắp xếp lại theo sortOrder asc

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: Low
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `@IsIn TEMPLATE_CATEGORIES`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo mẫu category không hợp lệ → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] POST category='Linh tinh'

### Dữ liệu kiểm thử
```
category=Linh tinh
```

### Kết quả mong đợi
- IsIn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `getById NotFound`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH mẫu không tồn tại → 404

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] PATCH /document-templates/non-existent

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `getById NotFound`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: DELETE mẫu không tồn tại → 404

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] DELETE /document-templates/non-existent

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `@IsIn merged/zip`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export mode không hợp lệ → 400

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export {mode:'pdf'}

### Dữ liệu kiểm thử
```
mode=pdf
```

### Kết quả mong đợi
- IsIn (mode chỉ merged/zip)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Medium
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `getById`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export case không tồn tại → 404

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST /cases/non-existent/export-documents

### Kết quả mong đợi
- (record không tìm thấy)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Medium
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `select omit fileBytes`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: List export-templates không trả fileBytes (payload nặng)

### Điều kiện tiên quyết
- Có mẫu

### Các bước kiểm thử
- [ ] GET /cases/export-templates
- [ ] Kiểm tra JSON

### Kết quả mong đợi
- Không có field fileBytes trong response

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Medium
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Tránh tải ≤5MB/mẫu

---

## TC-050

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `RBAC`
- Yêu cầu: `read Case`
- Kỹ thuật: `AuthZ`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Officer1 GET export-templates Vụ án khi không có quyền read Case → 403

### Điều kiện tiên quyết
- User role bị revoke read Case

### Các bước kiểm thử
- [ ] GET /cases/export-templates

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Medium
module: RBAC
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Edge phân quyền

---

## TC-053

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `assertValidDocx`
- Kỹ thuật: `BVA min-1`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Upload file 0 byte → reject docx không hợp lệ

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Upload file rỗng .docx

### Dữ liệu kiểm thử
```
0 byte
```

### Kết quả mong đợi
- không phải docx hợp lệ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Admin-Templates
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
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `MaxLength 50`
- Kỹ thuật: `BVA max`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: code đúng 50 ký tự → chấp nhận

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] code = 50 ký tự

### Dữ liệu kiểm thử
```
50 chars
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Medium
module: Admin-Templates
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
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `MaxLength 50`
- Kỹ thuật: `BVA max+1`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: code 51 ký tự → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] code = 51 ký tự

### Dữ liệu kiểm thử
```
51 chars
```

### Kết quả mong đợi
- MaxLength

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `templateIds min`
- Kỹ thuật: `BVA min`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export đúng 1 mẫu (min) → thành công

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Tick đúng 1 mẫu → Xuất

### Dữ liệu kiểm thử
```
1 mẫu
```

### Kết quả mong đợi
- file 1 mẫu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Medium
module: Export-VuAn
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
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `merge nhiều`
- Kỹ thuật: `BVA max thực tế`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export nhiều mẫu (vd 10) gộp → 1 file ngắt trang đúng

### Điều kiện tiên quyết
- Có 10 mẫu VU_AN

### Các bước kiểm thử
- [ ] Tick 10 mẫu, mode merged → Xuất

### Dữ liệu kiểm thử
```
10 mẫu
```

### Kết quả mong đợi
- , 1 file .docx gồm 10 phần ngắt trang theo thứ tự sortOrder

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Medium
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `entityType partition`
- Kỹ thuật: `EP valid`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP entityType hợp lệ VU_AN

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Tạo mẫu VU_AN

### Dữ liệu kiểm thử
```
VU_AN
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `entityType partition`
- Kỹ thuật: `EP valid`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP entityType hợp lệ VU_VIEC

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Tạo mẫu VU_VIEC

### Dữ liệu kiểm thử
```
VU_VIEC
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Medium
module: Admin-Templates
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `mode merged`
- Kỹ thuật: `EP`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP mode=merged (partition gộp)

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Export mode=merged

### Dữ liệu kiểm thử
```
merged
```

### Kết quả mong đợi
- docx

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Medium
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `mode zip`
- Kỹ thuật: `EP`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP mode=zip (partition tách)

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Export mode=zip

### Dữ liệu kiểm thử
```
zip
```

### Kết quả mong đợi
- application/zip

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Medium
module: Export-VuAn
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `mode default`
- Kỹ thuật: `EP default`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP mode mặc định (không gửi) → merged

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export không gửi mode

### Dữ liệu kiểm thử
```
no mode
```

### Kết quả mong đợi
- docx (mặc định merged)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Medium
module: Export-VuAn
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
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `i18n UTF-8`
- Kỹ thuật: `Data validation`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: manualValues ký tự đặc biệt tiếng Việt có dấu → render đúng UTF-8

### Điều kiện tiên quyết
- Mẫu biến manual

### Các bước kiểm thử
- [ ] hoTenBiCan='Nguyễn Thị Hồng Ánh'
- [ ] Export

### Dữ liệu kiểm thử
```
tiếng Việt dấu
```

### Kết quả mong đợi
- File hiển thị đúng dấu tiếng Việt; filename header UTF-8 encode

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Medium
module: Export-VuAn
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
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `s() null-safe`
- Kỹ thuật: `Data validation`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Field record null (vd crime trống) → placeholder rỗng không crash

### Điều kiện tiên quyết
- Case thiếu field crime

### Các bước kiểm thử
- [ ] Export mẫu có {toiDanh}

### Kết quả mong đợi
- toiDanh render rỗng '', file vẫn tạo, không lỗi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: Medium
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: nullGetter

---

## TC-074

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `series ref`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo mẫu needsNumber=true với numberSeriesId không tồn tại trong chuỗi số

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Tạo mẫu numberSeriesId='KHONG_CO'
- [ ] Export mẫu đó

### Dữ liệu kiểm thử
```
numberSeriesId=KHONG_CO
```

### Kết quả mong đợi
- Tạo OK nhưng export sẽ lỗi khi commitWithTx không thấy series → 400/500 có kiểm soát

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Medium
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Gợi ý: validate series tồn tại khi tạo (cải tiến)

---

## TC-075

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `selected.size===0`
- Kỹ thuật: `Negative UI`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bỏ chọn hết mẫu trong modal → nút Xuất disabled

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Bỏ tick tất cả mẫu

### Kết quả mong đợi
- Nút 'Xuất file' disabled, hiện 'Đã chọn 0/N mẫu'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Medium
module: Export-VuAn
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
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `isEditMode && id`
- Kỹ thuật: `State transition`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Nút In chứng từ chỉ hiện ở edit mode (không hiện create)

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Mở /cases/new (create)
- [ ] Quan sát nút

### Kết quả mong đợi
- Nút In chứng từ KHÔNG hiện ở create; hiện sau khi đã lưu (edit)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: Medium
module: Export-VuAn
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
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `0 biến`
- Kỹ thuật: `Edge`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Mẫu .docx không có placeholder nào → export ra file nguyên bản

### Điều kiện tiên quyết
- Mẫu không placeholder

### Các bước kiểm thử
- [ ] Export mẫu không biến

### Kết quả mong đợi
- file giống template gốc, không lỗi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: Medium
module: Export-VuAn
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
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `empty templates`
- Kỹ thuật: `Edge`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Record mới tạo chưa có mẫu nào active → modal hiện 'Chưa có mẫu'

### Điều kiện tiên quyết
- Đã soft-delete hết mẫu VU_AN

### Các bước kiểm thử
- [ ] Mở modal xuất chứng từ vụ án

### Kết quả mong đợi
- Thông báo 'Chưa có mẫu chứng từ cho loại hồ sơ này', nút Xuất disabled

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: Medium
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `update không re-validate`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH mẫu set needsNumber=true nhưng numberSeriesId=null → vẫn lưu (GAP)

### Điều kiện tiên quyết
- ADMIN, mẫu không cấp số

### Các bước kiểm thử
- [ ] PATCH {needsNumber:true} (không kèm numberSeriesId)

### Kết quả mong đợi
- HIỆN TẠI: update không kiểm tra → lưu needsNumber=true series=null → export sau đó 400. KHUYẾN NGHỊ: update cũng validate như create

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: Medium
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Gap phát hiện UAT — backlog

---

## TC-089

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `assertValidDocx replace`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: replaceFile với file không docx → 400

### Điều kiện tiên quyết
- ADMIN, mẫu tồn tại

### Các bước kiểm thử
- [ ] POST /document-templates/{id}/file file=a.txt

### Kết quả mong đợi
- chỉ chấp nhận .docx / không docx hợp lệ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: Medium
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `getById replace`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: replaceFile mẫu không tồn tại → 404

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] POST /document-templates/non-existent/file

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Medium
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `chỉ gửi manualVars đang chọn`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: manualValues cho biến KHÔNG thuộc mẫu đang chọn → bị bỏ qua

### Điều kiện tiên quyết
- Modal có mẫu manual

### Các bước kiểm thử
- [ ] Nhập biến, bỏ chọn mẫu chứa biến đó
- [ ] Xuất

### Kết quả mong đợi
- manualValues KHÔNG gửi biến của mẫu đã bỏ chọn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Medium
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `interceptor 401`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Token hết hạn giữa lúc export → 401 (refresh/redirect login)

### Điều kiện tiên quyết
- Token sắp hết hạn

### Các bước kiểm thử
- [ ] Export khi token expired

### Kết quả mong đợi
- → interceptor refresh hoặc về login, không tải file lỗi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Medium
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `PizZip throw`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Upload .docx corrupt (zip hỏng) → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Upload file .docx bytes hỏng

### Kết quả mong đợi
- không phải docx hợp lệ (PizZip throw → catch)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: Medium
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `getById race`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export khi record vừa bị người khác xoá → 404

### Điều kiện tiên quyết
- Case bị DELETE giữa lúc mở modal

### Các bước kiểm thử
- [ ] Mở modal
- [ ] ADMIN xoá case
- [ ] Nhấn Xuất

### Kết quả mong đợi
- , modal hiện lỗi, không crash

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: Medium
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `partial unique [entityType,code]`
- Kỹ thuật: `Negative (đảo)`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo mẫu code trùng nhưng entityType KHÁC → cho phép

### Điều kiện tiên quyết
- Có QD-01 VU_AN

### Các bước kiểm thử
- [ ] Tạo QD-01 VU_VIEC

### Kết quả mong đợi
- (unique theo cặp entityType+code, không xung đột)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: Medium
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `partial unique WHERE deletedAt null`
- Kỹ thuật: `Negative (đảo)`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tạo mẫu code trùng với mẫu đã soft-delete → cho phép (reuse)

### Điều kiện tiên quyết
- Mẫu QD-01 đã DELETE

### Các bước kiểm thử
- [ ] Tạo lại QD-01 cùng entityType

### Kết quả mong đợi
- (partial index bỏ qua row deletedAt)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Medium
module: Admin-Templates
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
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `update P2002`
- Kỹ thuật: `Negative`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PATCH update code trùng → hiện chưa catch P2002 (gap)

### Điều kiện tiên quyết
- Có 2 mẫu A,B cùng entityType

### Các bước kiểm thử
- [ ] PATCH B set code = code của A

### Kết quả mong đợi
- HIỆN TẠI: P2002 → 500 thô (update chưa catch). KHUYẾN NGHỊ: catch → 409 như create

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: Medium
module: Admin-Templates
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Gap UAT — backlog

---

## TC-108

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `Admin-Templates`
- Yêu cầu: `soft-delete consistency`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Xoá mẫu đang được hiển thị trong modal người khác → export sau đó 400

### Điều kiện tiên quyết
- OFF1 mở modal, ADMIN xoá 1 mẫu

### Các bước kiểm thử
- [ ] ADMIN DELETE mẫu
- [ ] OFF1 (modal cũ) tick mẫu đó → Xuất

### Kết quả mong đợi
- 'không tồn tại hoặc đã bị xoá'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: Medium
module: Admin-Templates
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
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `perf single`
- Kỹ thuật: `Performance`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export 1 mẫu gộp < 3s

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Đo thời gian POST export 1 mẫu → nhận blob

### Kết quả mong đợi
- < 3s (P95)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: Medium
module: Export-VuAn
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
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `perf zip`
- Kỹ thuật: `Performance`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export 10 mẫu ZIP < 8s

### Điều kiện tiên quyết
- 0 mẫu

### Các bước kiểm thử
- [ ] Đo export 10 mẫu zip (zlib level 9)

### Kết quả mong đợi
- < 8s; cảnh báo nếu giữ row-lock lâu (P2 /review)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: theo dõi lock-in-tx

---

## TC-115

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `perf list`
- Kỹ thuật: `Performance`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET export-templates với 50 mẫu < 500ms (omit fileBytes)

### Điều kiện tiên quyết
- 0 mẫu VU_AN

### Các bước kiểm thử
- [ ] Đo GET /cases/export-templates

### Kết quả mong đợi
- < 500ms (không tải fileBytes)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: Medium
module: Export-VuAn
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 4.1.2`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Modal có role=dialog + aria-modal=true

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Inspect modal

### Kết quả mong đợi
- role='dialog' aria-modal='true'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Medium
module: Export-VuAn
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 4.1.2 name`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Nút đóng (X) có aria-label='Đóng'

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Inspect nút X

### Kết quả mong đợi
- aria-label='Đóng'

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: Medium
module: Export-VuAn
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 1.3.1/3.3.2`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Checkbox mẫu liên kết label (click text toggle)

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Click vào text tên mẫu

### Kết quả mong đợi
- Checkbox toggle (label bao input)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: Medium
module: Export-VuAn
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 4.1.3`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Thông báo lỗi export có role=alert

### Điều kiện tiên quyết
- Export lỗi

### Các bước kiểm thử
- [ ] Gây lỗi export

### Kết quả mong đợi
- div lỗi role='alert' (screen reader đọc)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: Medium
module: Export-VuAn
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
- Module: `Export-VuAn`
- Yêu cầu: `browser compat`
- Kỹ thuật: `Compat`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Microsoft Edge — luồng xuất

### Điều kiện tiên quyết
- Edge

### Các bước kiểm thử
- [ ] Luồng xuất

### Kết quả mong đợi
- OK

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Medium
module: Export-VuAn
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `blob download FF`
- Kỹ thuật: `Compat`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Firefox — tải blob + filename

### Điều kiện tiên quyết
- Firefox

### Các bước kiểm thử
- [ ] Xuất file

### Kết quả mong đợi
- Tải đúng tên ChungTu_*.docx

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: Medium
module: Export-VuAn
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `Safari blob`
- Kỹ thuật: `Compat`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Safari macOS — filename UTF-8 + createObjectURL

### Điều kiện tiên quyết
- Safari

### Các bước kiểm thử
- [ ] Xuất file tên có dấu

### Kết quả mong đợi
- Tải đúng, không lỗi revoke sớm

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: Medium
module: Export-VuAn
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: theo dõi revokeObjectURL timing

---

## TC-127

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Export-VuAn`
- Yêu cầu: `responsive`
- Kỹ thuật: `Compat`
- Risk: `Low`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Mobile responsive — modal xuất trên màn hình hẹp

### Điều kiện tiên quyết
- Viewport 375px

### Các bước kiểm thử
- [ ] Mở modal trên mobile

### Kết quả mong đợi
- Modal max-w-lg co giãn, scroll, nút bấm được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Medium
module: Export-VuAn
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `MaxLength 255`
- Kỹ thuật: `BVA max`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name 255 ký tự → chấp nhận

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] name = 255 ký tự

### Dữ liệu kiểm thử
```
255 chars
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: Low
module: Admin-Templates
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `MaxLength 255`
- Kỹ thuật: `BVA max+1`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name 256 ký tự → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] name = 256 ký tự

### Dữ liệu kiểm thử
```
256 chars
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Low
module: Admin-Templates
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `@Min(0)`
- Kỹ thuật: `BVA min`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: sortOrder = 0 → chấp nhận (Min 0)

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] sortOrder=0

### Dữ liệu kiểm thử
```
0
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: Low
module: Admin-Templates
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `@Min(0)`
- Kỹ thuật: `BVA min-1`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: sortOrder = -1 → 400

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] sortOrder=-1

### Dữ liệu kiểm thử
```
-1
```

### Kết quả mong đợi
- Min

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Low
module: Admin-Templates
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `entityType DON_THU`
- Kỹ thuật: `EP valid`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: EP entityType hợp lệ DON_THU (lưu được, biến all manual)

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] Tạo mẫu DON_THU

### Dữ liệu kiểm thử
```
DON_THU
```

### Kết quả mong đợi
- ; biến phân loại manual (không catalog VU_AN/VU_VIEC)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Low
module: Admin-Templates
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
- Loại: `EDGE`
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `group by category`
- Kỹ thuật: `Edge`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Nhiều mẫu cùng category → gộp 1 nhóm header

### Điều kiện tiên quyết
- mẫu cùng category Quyết định

### Các bước kiểm thử
- [ ] Mở modal

### Kết quả mong đợi
- heading 'Quyết định' chứa 3 mẫu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: Low
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `resolveFilename fallback`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: filename header thiếu → FE fallback ChungTu.docx

### Điều kiện tiên quyết
- Response thiếu content-disposition

### Các bước kiểm thử
- [ ] Mô phỏng response không header

### Kết quả mong đợi
- File tải tên ChungTu.docx (merged) / ChungTu.zip (zip)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: Low
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `@IsInt`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: sortOrder gửi 'abc' (không phải số) → 400 IsInt

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] sortOrder='abc'

### Dữ liệu kiểm thử
```
abc
```

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: Low
module: Admin-Templates
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
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `body parse`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Export body không phải JSON → 400

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] POST export body='not json'

### Kết quả mong đợi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: Low
module: Export-VuAn
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
- Loại: `RED`
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `resilience`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: manualValues rất lớn (vd 500 key) → xử lý không crash

### Điều kiện tiên quyết
- OFF1

### Các bước kiểm thử
- [ ] Export manualValues 500 cặp

### Kết quả mong đợi
- Chỉ biến trong template được dùng; không crash; thời gian hợp lý

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: Low
module: Export-VuAn
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
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `orderBy sortOrder`
- Kỹ thuật: `Negative (thứ tự)`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: GET export-templates trả đúng thứ tự sortOrder asc

### Điều kiện tiên quyết
- mẫu sortOrder 2,0,1

### Các bước kiểm thử
- [ ] GET /cases/export-templates

### Kết quả mong đợi
- Trả theo thứ tự 0,1,2

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: Low
module: Export-VuAn
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
- Priority: `P3` 🟢
- Module: `Admin-Templates`
- Yêu cầu: `FileInterceptor('file')`
- Kỹ thuật: `Negative`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Upload kèm 2 field file → chỉ nhận field 'file'

### Điều kiện tiên quyết
- ADMIN

### Các bước kiểm thử
- [ ] multipart 'file' + 'file2'

### Kết quả mong đợi
- Chỉ xử lý 'file'; field thừa bỏ qua

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin-Templates`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin-Templates`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: Low
module: Admin-Templates
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
- Loại: `A11Y`
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 1.3.1 group`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Radio định dạng có legend 'Định dạng xuất'

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Inspect fieldset

### Kết quả mong đợi
- fieldset+legend nhóm 2 radio merged/zip

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: Low
module: Export-VuAn
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
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `WCAG 1.4.3`
- Kỹ thuật: `A11Y`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tương phản nút Xuất file (trắng/xanh) ≥ 4.5:1

### Điều kiện tiên quyết
- Modal mở

### Các bước kiểm thử
- [ ] Đo contrast text nút

### Kết quả mong đợi
- ≥ 4.5:1

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: Low
module: Export-VuAn
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
- Loại: `COMPAT`
- Priority: `P3` 🟢
- Module: `Export-VuAn`
- Yêu cầu: `zip compat`
- Kỹ thuật: `Compat`
- Risk: `Low`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: File ZIP giải nén đúng trên Windows Explorer + 7zip

### Điều kiện tiên quyết
- File zip xuất

### Các bước kiểm thử
- [ ] Giải nén ChungTu.zip

### Kết quả mong đợi
- Chứa N file .docx tên sanitize hợp lệ, mở được

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export-VuAn`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export-VuAn`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-129
severity: Low
module: Export-VuAn
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

- [ ] **TC-001** [P0] Admin upload mẫu VU_AN không cấp số thành công
- [ ] **TC-003** [P0] Admin bật Cấp số + chọn chuỗi số → lưu thành công
- [ ] **TC-004** [P0] Officer mở modal xuất chứng từ ở form Vụ án (edit) qua nút In chứng từ
- [ ] **TC-005** [P0] Xuất 1 mẫu Vụ án dạng gộp (merged) tải file .docx
- [ ] **TC-007** [P0] Lưu và xuất file (split-button) ở form Vụ án tạo mới
- [ ] **TC-010** [P0] Xuất chứng từ Vụ việc qua nút In chứng từ (IncidentFormPage)
- [ ] **TC-011** [P0] Lưu và xuất file ở form Vụ việc (split-button)
- [ ] **TC-014** [P0] Form biến nhập tay hiển thị khi mẫu có biến source=manual được chọn
- [ ] **TC-015** [P0] Xuất mẫu bật cấp số → cấp 1 số văn bản vào file
- [ ] **TC-017** [P0] Upload mẫu bật Cấp số nhưng KHÔNG chọn chuỗi số → chặn
- [ ] **TC-018** [P0] Upload file không phải .docx (txt) → reject
- [ ] **TC-019** [P0] Upload .docx giả (đổi đuôi từ .exe) → assertValidDocx reject
- [ ] **TC-023** [P0] Export mẫu sai entityType (mẫu VU_VIEC cho case) → 400
- [ ] **TC-026** [P0] Officer KHÔNG có quyền Setting upload mẫu → 403
- [ ] **TC-027** [P0] Officer DELETE mẫu → 403
- [ ] **TC-028** [P0] IDOR: officer1 export vụ án Tổ B (ngoài scope) → 403
- [ ] **TC-029** [P0] IDOR: officer1 export vụ việc Tổ B → 403
- [ ] **TC-030** [P0] Export không kèm token → 401
- [ ] **TC-031** [P0] GET export-templates không token → 401
- [ ] **TC-032** [P0] Template injection qua manualValues → escape, không thực thi
- [ ] **TC-033** [P0] SQL injection qua entityId path → an toàn
- [ ] **TC-034** [P0] XSS qua tên mẫu hiển thị list admin → React escape
- [ ] **TC-035** [P0] Mass assignment: gửi field lạ trong export body → whitelist loại bỏ
- [ ] **TC-036** [P0] manualValues non-string (object) → coerce an toàn
- [ ] **TC-037** [P0] GET /document-templates (list admin) bởi officer → 403
- [ ] **TC-038** [P0] officer1 sửa mẫu (PATCH) → 403
- [ ] **TC-047** [P0] Export mẫu đã soft-delete → 400 không tồn tại
- [ ] **TC-068** [P0] EP biến auto (trong catalog) → tự điền không cần nhập
- [ ] **TC-069** [P0] EP biến manual (ngoài catalog) → yêu cầu nhập
- [ ] **TC-070** [P0] EP mẫu trộn biến auto + manual → chỉ manual cần nhập
- [ ] **TC-076** [P0] Mẫu active → soft-delete → biến mất khỏi danh sách xuất
- [ ] **TC-077** [P0] Số văn bản tăng tuần tự qua nhiều lần export (counter state)
- [ ] **TC-079** [P0] Bảng quyết định needsNumber × numberSeriesId
- [ ] **TC-080** [P0] Bảng quyết định entityType record × entityType mẫu
- [ ] **TC-097** [P0] GET /incidents/export-templates KHÔNG trả mẫu VU_AN
- [ ] **TC-098** [P0] GET /cases/export-templates KHÔNG trả mẫu VU_VIEC/DON_THU
- [ ] **TC-101** [P0] 1 mẫu lỗi render trong lô gộp → toàn bộ tx rollback (atomic, no-gap)
- [ ] **TC-102** [P0] Lỗi nén ZIP (archiver) → rollback số trong tx
- [ ] **TC-109** [P0] Officer2 (Tổ B) export case Tổ A → 403
- [ ] **TC-114** [P0] 2 export đồng thời cùng hồ sơ → không cấp số trùng, không deadlock
- [ ] **TC-002** [P1] Admin upload mẫu VU_VIEC category Biên bản
- [ ] **TC-006** [P1] Xuất nhiều mẫu Vụ án dạng ZIP
- [ ] **TC-012** [P1] Nút In chứng từ độc lập trên Đơn thư mở popup 7 mẫu
- [ ] **TC-020** [P1] Tạo mẫu code trùng (cùng entityType, chưa xoá) → 409
- [ ] **TC-021** [P1] Export với templateIds rỗng → 400 ArrayNotEmpty
- [ ] **TC-022** [P1] Export templateId không tồn tại → 400 'không tồn tại hoặc đã bị xoá'
- [ ] **TC-024** [P1] Export templateIds trùng lặp → 400
- [ ] **TC-025** [P1] Export mẫu cấp số nhưng numberSeriesId=null (mẫu cũ lỗi) → 400
- [ ] **TC-039** [P1] Tạo mẫu thiếu code → 400
- [ ] **TC-040** [P1] Tạo mẫu thiếu file → 400
- [ ] **TC-041** [P1] Tạo mẫu entityType không hợp lệ → 400
- [ ] **TC-048** [P1] List export-templates không trả mẫu đã soft-delete
- [ ] **TC-051** [P1] Upload file đúng 5MB → chấp nhận
- [ ] **TC-052** [P1] Upload file 5MB+1 byte → reject
- [ ] **TC-073** [P1] Export quá Throttle (request thứ 6 trong 60s) → 429
- [ ] **TC-085** [P1] Form vụ việc tên < 5 ký tự → chặn lưu
- [ ] **TC-086** [P1] Form vụ án thiếu Nguồn vụ án → chặn lưu và xuất
- [ ] **TC-087** [P1] Double-submit form vụ án (click nhanh 2 lần) → chỉ 1 POST
- [ ] **TC-088** [P1] Double-submit form vụ việc → chỉ 1 POST
- [ ] **TC-091** [P1] Export trả lỗi nghiệp vụ (400) → modal hiện lỗi, KHÔNG tải file rỗng
- [ ] **TC-104** [P1] needsNumber gửi string 'false' (multipart) → parse đúng = false
- [ ] **TC-119** [P1] Keyboard: Tab tới checkbox, Space toggle, Enter xuất
- [ ] **TC-123** [P1] Chrome desktop mới nhất — toàn luồng xuất
- [ ] **TC-128** [P1] File .docx xuất mở đúng trên MS Word 365 + LibreOffice
- [ ] **TC-008** [P2] Đóng modal sau Lưu-và-xuất → điều hướng về danh sách
- [ ] **TC-009** [P2] Đóng modal sau nút In chứng từ → ở lại form (không điều hướng)
- [ ] **TC-013** [P2] Đóng popup In chứng từ đơn thư → ở lại form
- [ ] **TC-016** [P2] Admin sửa sortOrder mẫu → thứ tự hiển thị thay đổi
- [ ] **TC-042** [P2] Tạo mẫu category không hợp lệ → 400
- [ ] **TC-043** [P2] PATCH mẫu không tồn tại → 404
- [ ] **TC-044** [P2] DELETE mẫu không tồn tại → 404
- [ ] **TC-045** [P2] Export mode không hợp lệ → 400
- [ ] **TC-046** [P2] Export case không tồn tại → 404
- [ ] **TC-049** [P2] List export-templates không trả fileBytes (payload nặng)
- [ ] **TC-050** [P2] Officer1 GET export-templates Vụ án khi không có quyền read Case → 403
- [ ] **TC-053** [P2] Upload file 0 byte → reject docx không hợp lệ
- [ ] **TC-054** [P2] code đúng 50 ký tự → chấp nhận
- [ ] **TC-055** [P2] code 51 ký tự → 400
- [ ] **TC-060** [P2] Export đúng 1 mẫu (min) → thành công
- [ ] **TC-061** [P2] Export nhiều mẫu (vd 10) gộp → 1 file ngắt trang đúng
- [ ] **TC-062** [P2] EP entityType hợp lệ VU_AN
- [ ] **TC-063** [P2] EP entityType hợp lệ VU_VIEC
- [ ] **TC-065** [P2] EP mode=merged (partition gộp)
- [ ] **TC-066** [P2] EP mode=zip (partition tách)
- [ ] **TC-067** [P2] EP mode mặc định (không gửi) → merged
- [ ] **TC-071** [P2] manualValues ký tự đặc biệt tiếng Việt có dấu → render đúng UTF-8
- [ ] **TC-072** [P2] Field record null (vd crime trống) → placeholder rỗng không crash
- [ ] **TC-074** [P2] Tạo mẫu needsNumber=true với numberSeriesId không tồn tại trong chuỗi số
- [ ] **TC-075** [P2] Bỏ chọn hết mẫu trong modal → nút Xuất disabled
- [ ] **TC-078** [P2] Nút In chứng từ chỉ hiện ở edit mode (không hiện create)
- [ ] **TC-081** [P2] Mẫu .docx không có placeholder nào → export ra file nguyên bản
- [ ] **TC-082** [P2] Record mới tạo chưa có mẫu nào active → modal hiện 'Chưa có mẫu'
- [ ] **TC-084** [P2] PATCH mẫu set needsNumber=true nhưng numberSeriesId=null → vẫn lưu (GAP)
- [ ] **TC-089** [P2] replaceFile với file không docx → 400
- [ ] **TC-090** [P2] replaceFile mẫu không tồn tại → 404
- [ ] **TC-092** [P2] manualValues cho biến KHÔNG thuộc mẫu đang chọn → bị bỏ qua
- [ ] **TC-093** [P2] Token hết hạn giữa lúc export → 401 (refresh/redirect login)
- [ ] **TC-094** [P2] Upload .docx corrupt (zip hỏng) → 400
- [ ] **TC-095** [P2] Export khi record vừa bị người khác xoá → 404
- [ ] **TC-099** [P2] Tạo mẫu code trùng nhưng entityType KHÁC → cho phép
- [ ] **TC-100** [P2] Tạo mẫu code trùng với mẫu đã soft-delete → cho phép (reuse)
- [ ] **TC-103** [P2] PATCH update code trùng → hiện chưa catch P2002 (gap)
- [ ] **TC-108** [P2] Xoá mẫu đang được hiển thị trong modal người khác → export sau đó 400
- [ ] **TC-112** [P2] Export 1 mẫu gộp < 3s
- [ ] **TC-113** [P2] Export 10 mẫu ZIP < 8s
- [ ] **TC-115** [P2] GET export-templates với 50 mẫu < 500ms (omit fileBytes)
- [ ] **TC-116** [P2] Modal có role=dialog + aria-modal=true
- [ ] **TC-117** [P2] Nút đóng (X) có aria-label='Đóng'
- [ ] **TC-118** [P2] Checkbox mẫu liên kết label (click text toggle)
- [ ] **TC-121** [P2] Thông báo lỗi export có role=alert
- [ ] **TC-124** [P2] Microsoft Edge — luồng xuất
- [ ] **TC-125** [P2] Firefox — tải blob + filename
- [ ] **TC-126** [P2] Safari macOS — filename UTF-8 + createObjectURL
- [ ] **TC-127** [P2] Mobile responsive — modal xuất trên màn hình hẹp
- [ ] **TC-056** [P3] name 255 ký tự → chấp nhận
- [ ] **TC-057** [P3] name 256 ký tự → 400
- [ ] **TC-058** [P3] sortOrder = 0 → chấp nhận (Min 0)
- [ ] **TC-059** [P3] sortOrder = -1 → 400
- [ ] **TC-064** [P3] EP entityType hợp lệ DON_THU (lưu được, biến all manual)
- [ ] **TC-083** [P3] Nhiều mẫu cùng category → gộp 1 nhóm header
- [ ] **TC-096** [P3] filename header thiếu → FE fallback ChungTu.docx
- [ ] **TC-105** [P3] sortOrder gửi 'abc' (không phải số) → 400 IsInt
- [ ] **TC-106** [P3] Export body không phải JSON → 400
- [ ] **TC-107** [P3] manualValues rất lớn (vd 500 key) → xử lý không crash
- [ ] **TC-110** [P3] GET export-templates trả đúng thứ tự sortOrder asc
- [ ] **TC-111** [P3] Upload kèm 2 field file → chỉ nhận field 'file'
- [ ] **TC-120** [P3] Radio định dạng có legend 'Định dạng xuất'
- [ ] **TC-122** [P3] Tương phản nút Xuất file (trắng/xanh) ≥ 4.5:1
- [ ] **TC-129** [P3] File ZIP giải nén đúng trên Windows Explorer + 7zip

---

_Generated by `uat-test-writer` skill on 28/06/2026 02:28_