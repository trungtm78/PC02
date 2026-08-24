# UAT Test Cases — In chứng từ — báo & bổ sung thông tin thiếu per mẫu (Đơn thư + Vụ việc + Vụ án + Admin required)

**Generated**: 28/06/2026 14:50  
**Complexity**: `high`  
**Total TC**: 128  
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
- r
- e
- a
- d
- i
- n
- e
- s
- s
-  
- 3
-  
- t
- h
- ự
- c
-  
- t
- h
- ể
- ,
-  
- b
- ổ
-  
- s
- u
- n
- g
-  
- t
- ạ
- i
-  
- p
- o
- p
- u
- p
- ,
-  
- a
- d
- m
- i
- n
-  
- c
- ấ
- u
-  
- h
- ì
- n
- h
-  
- r
- e
- q
- u
- i
- r
- e
- d
- ,
-  
- R
- B
- A
- C
- /
- D
- a
- t
- a
- S
- c
- o
- p
- e
- ,
-  
- e
- s
- c
- a
- p
- e
-  
- i
- n
- j
- e
- c
- t
- i
- o
- n
- ,
-  
- o
- p
- t
- i
- m
- i
- s
- t
- i
- c
- -
- l
- o
- c
- k

## 🔍 Self-Audit

**Tổng số TC**: 128

**Phân bố loại**:
- `RED`: 42
- `GREEN`: 21
- `SECURITY`: 14
- `DECISION`: 13
- `DATA`: 9
- `EP`: 8
- `BOUNDARY`: 5
- `A11Y`: 5
- `STATE`: 3
- `COMPAT`: 3
- `INTEGRATION`: 2
- `EDGE`: 2
- `PERFORMANCE`: 1

**Phân bố priority**:
- 🔴 `P0`: 61
- 🟠 `P1`: 55
- 🟡 `P2`: 11
- 🟢 `P3`: 1

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 61
- ⚠️ `High`: 55
- ⚡ `Medium`: 11
- 📌 `Low`: 1

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `ACC-ADMIN` | `admin@pc02.local` | `<env>` | ADMIN/SUPER_ADMIN | active | Full scope + Setting:write |
| `ACC-OFF1` | `officer1@pc02.local` | `<env>` | OFFICER | active | DataScope tổ 1 (không Setting:write) |
| `ACC-OFF2` | `officer2@pc02.local` | `<env>` | OFFICER | active | DataScope tổ 2 (isolation) |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| nhanThay/deXuat | `"   " (chỉ space)` | `whitespace` | **Tính THIẾU (trim)** | BOUNDARY |
| detailContent | `rỗng nhưng summary có` | `OR-rule` | **Bare-min content THOẢ** | EP |
| docTypes | `[] (rỗng)` | `array` | **400** | RED |
| templateIds | `[t,t] (trùng)` | `array` | **400 (no double cấp số)** | RED |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
| lyDoTraDon (đơn thư) | `<script>alert(1)</script> '; DROP TABLE petitions;--` | XSS/SQLi | Escape → xuất 2xx, DB nguyên | `A03 Injection` |
| manualValues.toiDanh (vụ án) | `{x} <b> {{y}}` | docxtemplater injection | Escape ❴❵‹› → 2xx | `A03 Injection` |
| export-readiness (no token) | `—` | Broken Auth | 401 | `A07` |
| case ngoài scope (officer) | `GET readiness` | IDOR/BOLA | 403/404 | `A01 Broken Access Control` |
| PATCH document-templates (officer) | `requiredVariables` | Privilege Esc | 403 (Setting:write) | `A01` |

## 🗂️ Data Maturity Matrix

> Data fixtures được runner tự động seed trước test, KHÔNG cần human chạy SQL.
> Mỗi fixture có ID format `<entity>.<state>.<lifecycle>.<shape>`.

### `petition.anonymous.D0.empty`

**Mô tả**: 
**Entity**: `Petition` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST /petitions {senderIsAnonymous:true, senderName:\"\", detailContent:\"\", petitionType:TO_CAO}"
```

**Cleanup**:
```json
"DELETE /petitions/:id"
```

**Outputs**: `petId`

---

### `petition.anonymous.D0.baremin`

**Mô tả**: 
**Entity**: `Petition` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST anon + PUT senderName+detailContent"
```

**Cleanup**:
```json
"DELETE"
```

**Outputs**: `id`

---

### `case.normal.existing`

**Mô tả**: 
**Entity**: `Case (VU_AN)` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"GET /cases?limit=1 (record sẵn)"
```

**Cleanup**:
```json
"— (không tạo)"
```

**Outputs**: `caseId`

---

### `incident.normal.existing`

**Mô tả**: 
**Entity**: `Incident (VU_VIEC)` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"GET /incidents?limit=1"
```

**Cleanup**:
```json
"—"
```

**Outputs**: `incId`

---

### 📋 Bảng tóm tắt

| Fixture ID | Entity | State | Lifecycle | TC dùng |
|------------|--------|-------|-----------|---------|
| `petition.anonymous.D0.empty` | Petition |  |  |  |
| `petition.anonymous.D0.baremin` | Petition |  |  |  |
| `case.normal.existing` | Case (VU_AN) |  |  |  |
| `incident.normal.existing` | Incident (VU_VIEC) |  |  |  |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | Tạo đơn thư fixture (thiếu nội dung) thành công | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | GET petition export-readiness trả 200 + items[] | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_DE_XUAT ready=false | 🚨 Critical |
| [TC-005](#tc-005) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN ready=false | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_CHUYEN_DON ready=false | 🚨 Critical |
| [TC-009](#tc-009) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_HUONG_DAN ready=false | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_TRA_LAI ready=false | 🚨 Critical |
| [TC-013](#tc-013) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_CHUYEN ready=false | 🚨 Critical |
| [TC-015](#tc-015) | 🔴 P0 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: BIEN_NHAN ready=false | 🚨 Critical |
| [TC-017](#tc-017) | 🔴 P0 | `DECISION` | Đơn thư (Petition) | PHIEU_DE_XUAT yêu cầu thêm nhanThay+deXuat | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `DECISION` | Đơn thư (Petition) | PHIEU_CHUYEN_NGUON_TIN yêu cầu thêm lyDoChuyen+canCuPhapLy | 🚨 Critical |
| [TC-019](#tc-019) | 🔴 P0 | `DECISION` | Đơn thư (Petition) | THONG_BAO_TRA_LAI yêu cầu thêm lyDoTraDon | 🚨 Critical |
| [TC-022](#tc-022) | 🔴 P0 | `GREEN` | Optimistic-lock | PUT bổ sung senderName+detailContent (đúng expectedUpdatedAt) → 200 | 🚨 Critical |
| [TC-023](#tc-023) | 🔴 P0 | `GREEN` | Optimistic-lock | PUT trả updatedAt mới (FE refresh tránh 409) | 🚨 Critical |
| [TC-024](#tc-024) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | Sau bổ sung bare-min: BIEN_NHAN ready=true | 🚨 Critical |
| [TC-025](#tc-025) | 🔴 P0 | `STATE` | Đơn thư (Petition) | Sau bare-min: PHIEU_DE_XUAT VẪN thiếu nhanThay+deXuat | 🚨 Critical |
| [TC-026](#tc-026) | 🔴 P0 | `RED` | Optimistic-lock | PUT petition với expectedUpdatedAt CŨ → 409 (optimistic-lock) | 🚨 Critical |
| [TC-027](#tc-027) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | Bổ sung nhanThay+deXuat → PHIEU_DE_XUAT ready=true (mẫu mở lại) | 🚨 Critical |
| [TC-028](#tc-028) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | Xuất PHIEU_DE_XUAT khi đã đủ thông tin → 2xx | 🚨 Critical |
| [TC-029](#tc-029) | 🔴 P0 | `RED` | Đơn thư (Petition) | Xuất THONG_BAO_TRA_LAI khi thiếu lyDoTraDon → 400 (chặn) | 🚨 Critical |
| [TC-030](#tc-030) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_AN: GET export-readiness 200 + items[] | 🚨 Critical |
| [TC-032](#tc-032) | 🔴 P0 | `DATA` | Vụ việc/Vụ án (Dynamic) | VU_AN: mọi trường thiếu savable=false (manual-override, không PUT) | 🚨 Critical |
| [TC-035](#tc-035) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_VIEC: GET export-readiness 200 + items[] | 🚨 Critical |
| [TC-037](#tc-037) | 🔴 P0 | `DATA` | Vụ việc/Vụ án (Dynamic) | VU_VIEC: mọi trường thiếu savable=false (manual-override, không PUT) | 🚨 Critical |
| [TC-040](#tc-040) | 🔴 P0 | `GREEN` | Admin cấu hình required | Admin PATCH requiredVariables → 2xx | 🚨 Critical |
| [TC-041](#tc-041) | 🔴 P0 | `DECISION` | Admin cấu hình required | PATCH set cờ required ĐÚNG biến chỉ định | 🚨 Critical |
| [TC-042](#tc-042) | 🔴 P0 | `DATA` | Admin cấu hình required | PATCH giữ nguyên name/source/label của variables | 🚨 Critical |
| [TC-046](#tc-046) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | export-readiness KHÔNG token → 401 | 🚨 Critical |
| [TC-047](#tc-047) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | export-readiness id không tồn tại → 404 (không lộ data) | 🚨 Critical |
| [TC-049](#tc-049) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Officer GET export-readiness case NGOÀI scope → 403/404 | 🚨 Critical |
| [TC-050](#tc-050) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Officer (không Setting:write) PATCH document-templates → 403 | 🚨 Critical |
| [TC-051](#tc-051) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Giá trị bổ sung có {}/<> (injection docxtemplater) → xuất 2xx (escape, không vỡ template) | 🚨 Critical |
| [TC-059](#tc-059) | 🔴 P0 | `PERFORMANCE` | Optimistic-lock | Concurrency: 2 PUT đồng thời cùng expectedUpdatedAt → 1 OK + 1 409 (no lost-update) | 🚨 Critical |
| [TC-060](#tc-060) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Payload XSS/SQL trong field bổ sung → xuất 2xx (escape, DB còn nguyên) | 🚨 Critical |
| [TC-061](#tc-061) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Sau payload SQL-ish: GET /petitions vẫn 200 (không bị DROP) | 🚨 Critical |
| [TC-062](#tc-062) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Export động: templateIds TRÙNG → 400 (chống cấp số 2 lần) | 🚨 Critical |
| [TC-063](#tc-063) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Export động: templateId không tồn tại → 400 | 🚨 Critical |
| [TC-064](#tc-064) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Export động: template VU_VIEC dùng cho /cases → 400 (sai loại hồ sơ) | 🚨 Critical |
| [TC-065](#tc-065) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | Export động VU_AN (merged) với manualValues bổ sung → 2xx | 🚨 Critical |
| [TC-066](#tc-066) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | Export động VU_AN (zip) với manualValues bổ sung → 2xx | 🚨 Critical |
| [TC-067](#tc-067) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Export động: manualValues chứa {}/<> → 2xx (escape docxtemplater) | 🚨 Critical |
| [TC-068](#tc-068) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | cases/:id/export-readiness KHÔNG token → 401 | 🚨 Critical |
| [TC-069](#tc-069) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | incidents/:id/export-readiness KHÔNG token → 401 | 🚨 Critical |
| [TC-071](#tc-071) | 🔴 P0 | `SECURITY` | Bảo mật/RBAC | Officer GET incidents export-readiness NGOÀI scope → 403/404 | 🚨 Critical |
| [TC-075](#tc-075) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Export động VU_VIEC: templateIds TRÙNG → 400 | 🚨 Critical |
| [TC-076](#tc-076) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Export động: template VU_AN dùng cho /incidents → 400 (sai loại) | 🚨 Critical |
| [TC-077](#tc-077) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | Export động VU_VIEC (merged) với manualValues → 2xx | 🚨 Critical |
| [TC-078](#tc-078) | 🔴 P0 | `GREEN` | Vụ việc/Vụ án (Dynamic) | Export động VU_VIEC (zip) với manualValues → 2xx | 🚨 Critical |
| [TC-080](#tc-080) | 🔴 P0 | `GREEN` | Đơn thư (Petition) | Đơn thư đủ bare-min ngay khi tạo: BIEN_NHAN + THONG_BAO_CHUYEN ready | 🚨 Critical |
| [TC-090](#tc-090) | 🔴 P0 | `RED` | Bảo mật/RBAC | POST export-documents đơn thư KHÔNG token → 401 | 🚨 Critical |
| [TC-091](#tc-091) | 🔴 P0 | `RED` | Bảo mật/RBAC | POST export-documents đơn thư không tồn tại → 404 | 🚨 Critical |
| [TC-092](#tc-092) | 🔴 P0 | `RED` | Bảo mật/RBAC | POST export-documents động KHÔNG token → 401 | 🚨 Critical |
| [TC-093](#tc-093) | 🔴 P0 | `RED` | Admin cấu hình required | PATCH document-templates id không tồn tại → 404 | 🚨 Critical |
| [TC-094](#tc-094) | 🔴 P0 | `RED` | Bảo mật/RBAC | PATCH document-templates KHÔNG token → 401 | 🚨 Critical |
| [TC-096](#tc-096) | 🔴 P0 | `RED` | Đơn thư (Petition) | Tạo petition petitionType sai enum → 400 | 🚨 Critical |
| [TC-098](#tc-098) | 🔴 P0 | `RED` | Đơn thư (Petition) | Xuất đơn thư docType sai enum → 400 | 🚨 Critical |
| [TC-100](#tc-100) | 🔴 P0 | `RED` | Vụ việc/Vụ án (Dynamic) | Xuất động thiếu templateIds → 400 | 🚨 Critical |
| [TC-103](#tc-103) | 🔴 P0 | `RED` | Admin cấu hình required | PATCH requiredVariables không phải mảng → 400 | 🚨 Critical |
| [TC-106](#tc-106) | 🔴 P0 | `RED` | Bảo mật/RBAC | Officer2 (không Setting:write) PATCH document-templates → 403 | 🚨 Critical |
| [TC-118](#tc-118) | 🔴 P0 | `INTEGRATION` | Đơn thư (Petition) | UI đơn thư: mở popup "In chứng từ" → mẫu thiếu disabled + "Thiếu: …" → bổ sung → Lưu → enable → xuất download | 🚨 Critical |
| [TC-119](#tc-119) | 🔴 P0 | `INTEGRATION` | Vụ việc/Vụ án (Dynamic) | UI vụ án: mở popup → mẫu thiếu khoá + "Thiếu" → nhập manualValues → enable → tick → xuất download | 🚨 Critical |
| [TC-004](#tc-004) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_DE_XUAT báo thiếu senderName+detailContent | ⚠️ High |
| [TC-006](#tc-006) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN báo thiếu senderName+detailContent | ⚠️ High |
| [TC-008](#tc-008) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: PHIEU_CHUYEN_DON báo thiếu senderName+detailContent | ⚠️ High |
| [TC-010](#tc-010) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_HUONG_DAN báo thiếu senderName+detailContent | ⚠️ High |
| [TC-012](#tc-012) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_TRA_LAI báo thiếu senderName+detailContent | ⚠️ High |
| [TC-014](#tc-014) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: THONG_BAO_CHUYEN báo thiếu senderName+detailContent | ⚠️ High |
| [TC-016](#tc-016) | 🟠 P1 | `RED` | Đơn thư (Petition) | Đơn thư rỗng: BIEN_NHAN báo thiếu senderName+detailContent | ⚠️ High |
| [TC-020](#tc-020) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | BIEN_NHAN KHÔNG yêu cầu trường đánh giá (chỉ bare-min) | ⚠️ High |
| [TC-021](#tc-021) | 🟠 P1 | `DATA` | Đơn thư (Petition) | Đơn thư: trường thiếu savable=true (lưu vào hồ sơ) | ⚠️ High |
| [TC-031](#tc-031) | 🟠 P1 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_AN: trả updatedAt cho FE (PUT bổ sung không 409) | ⚠️ High |
| [TC-033](#tc-033) | 🟠 P1 | `DATA` | Vụ việc/Vụ án (Dynamic) | VU_AN: ready=false ⇔ missing không rỗng (nhất quán) | ⚠️ High |
| [TC-034](#tc-034) | 🟠 P1 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_AN: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu) | ⚠️ High |
| [TC-036](#tc-036) | 🟠 P1 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_VIEC: trả updatedAt cho FE (PUT bổ sung không 409) | ⚠️ High |
| [TC-038](#tc-038) | 🟠 P1 | `DATA` | Vụ việc/Vụ án (Dynamic) | VU_VIEC: ready=false ⇔ missing không rỗng (nhất quán) | ⚠️ High |
| [TC-039](#tc-039) | 🟠 P1 | `GREEN` | Vụ việc/Vụ án (Dynamic) | VU_VIEC: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu) | ⚠️ High |
| [TC-043](#tc-043) | 🟠 P1 | `DATA` | Admin cấu hình required | Response KHÔNG có field requiredVariables (không spread thành cột) | ⚠️ High |
| [TC-044](#tc-044) | 🟠 P1 | `GREEN` | Admin cấu hình required | Restore requiredVariables về ban đầu (dọn data) | ⚠️ High |
| [TC-045](#tc-045) | 🟠 P1 | `RED` | Admin cấu hình required | DON_THU guard (không có mẫu DON_THU động — đơn thư hardcode) | ⚠️ High |
| [TC-048](#tc-048) | 🟠 P1 | `SECURITY` | Bảo mật/RBAC | Officer có case trong scope để đọc readiness | ⚠️ High |
| [TC-054](#tc-054) | 🟠 P1 | `EP` | Đơn thư (Petition) | Đơn thư: điền `summary` (không detailContent) → bare-min content thoả (OR) | ⚠️ High |
| [TC-055](#tc-055) | 🟠 P1 | `EP` | Đơn thư (Petition) | Đơn thư: điền senderName → senderName hết thiếu | ⚠️ High |
| [TC-056](#tc-056) | 🟠 P1 | `BOUNDARY` | Đơn thư (Petition) | Đơn thư: nhanThay/deXuat chỉ khoảng trắng → VẪN tính thiếu (trim) | ⚠️ High |
| [TC-057](#tc-057) | 🟠 P1 | `STATE` | Đơn thư (Petition) | Đơn thư: điền lyDoChuyen → PHIEU_CHUYEN_DON ready=true | ⚠️ High |
| [TC-058](#tc-058) | 🟠 P1 | `STATE` | Đơn thư (Petition) | Đơn thư: chưa điền huongDanKhoiKien → THONG_BAO_HUONG_DAN vẫn thiếu | ⚠️ High |
| [TC-070](#tc-070) | 🟠 P1 | `SECURITY` | Bảo mật/RBAC | IDOR: incidentId trên /cases/:id/export-readiness → 404 (không lẫn entity) | ⚠️ High |
| [TC-072](#tc-072) | 🟠 P1 | `DECISION` | Vụ việc/Vụ án (Dynamic) | VU_AN QD_KHOI_TO_VU_AN: missing chỉ gồm biến required (theo seed REQUIRED_VARS) | ⚠️ High |
| [TC-073](#tc-073) | 🟠 P1 | `DATA` | Vụ việc/Vụ án (Dynamic) | VU_AN missing field có {field,label,type,savable} | ⚠️ High |
| [TC-079](#tc-079) | 🟠 P1 | `DECISION` | Vụ việc/Vụ án (Dynamic) | VU_VIEC QD_PHAN_CONG_GIAI_QUYET: missing là biến required | ⚠️ High |
| [TC-081](#tc-081) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Đơn thư đủ bare-min: PHIEU_DE_XUAT vẫn thiếu (cần nhanThay+deXuat) | ⚠️ High |
| [TC-082](#tc-082) | 🟠 P1 | `DATA` | Optimistic-lock | readiness có updatedAt (đồng bộ optimistic-lock) | ⚠️ High |
| [TC-083](#tc-083) | 🟠 P1 | `BOUNDARY` | Đơn thư (Petition) | Xuất nhiều mẫu, 1 mẫu thiếu (PHIEU_DE_XUAT) → 400 (chặn cụm) | ⚠️ High |
| [TC-084](#tc-084) | 🟠 P1 | `RED` | Đơn thư (Petition) | Xuất với docTypes rỗng → 400 | ⚠️ High |
| [TC-085](#tc-085) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Decision: PHIEU_DE_XUAT (bare-min đủ) thiếu đúng {nhanThay,deXuat} | ⚠️ High |
| [TC-086](#tc-086) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Decision: PHIEU_CHUYEN_NGUON_TIN (bare-min đủ) thiếu đúng {lyDoChuyen,canCuPhapLy} | ⚠️ High |
| [TC-087](#tc-087) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Decision: PHIEU_CHUYEN_DON (bare-min đủ) thiếu đúng {lyDoChuyen} | ⚠️ High |
| [TC-088](#tc-088) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Decision: THONG_BAO_HUONG_DAN (bare-min đủ) thiếu đúng {huongDanKhoiKien} | ⚠️ High |
| [TC-089](#tc-089) | 🟠 P1 | `DECISION` | Đơn thư (Petition) | Decision: THONG_BAO_TRA_LAI (bare-min đủ) thiếu đúng {lyDoTraDon} | ⚠️ High |
| [TC-095](#tc-095) | 🟠 P1 | `RED` | Admin cấu hình required | DELETE document-templates id không tồn tại → 404 | ⚠️ High |
| [TC-097](#tc-097) | 🟠 P1 | `RED` | Đơn thư (Petition) | Tạo petition receivedDate sai định dạng → 400 | ⚠️ High |
| [TC-099](#tc-099) | 🟠 P1 | `RED` | Đơn thư (Petition) | Xuất đơn thư body rỗng (thiếu docTypes) → 400 | ⚠️ High |
| [TC-101](#tc-101) | 🟠 P1 | `RED` | Vụ việc/Vụ án (Dynamic) | Xuất động templateIds rỗng → 400 | ⚠️ High |
| [TC-102](#tc-102) | 🟠 P1 | `RED` | Vụ việc/Vụ án (Dynamic) | Xuất động mode không hợp lệ → 400 | ⚠️ High |
| [TC-104](#tc-104) | 🟠 P1 | `RED` | Admin cấu hình required | PATCH requiredVariables phần tử không phải string → 400 | ⚠️ High |
| [TC-105](#tc-105) | 🟠 P1 | `RED` | Bảo mật/RBAC | GET export-readiness id sai định dạng UUID → 400/404 | ⚠️ High |
| [TC-107](#tc-107) | 🟠 P1 | `RED` | Bảo mật/RBAC | GET export-readiness petition ĐÃ XOÁ → 404 | ⚠️ High |
| [TC-108](#tc-108) | 🟠 P1 | `RED` | Optimistic-lock | PUT petition expectedUpdatedAt sai định dạng → 400/409 | ⚠️ High |
| [TC-109](#tc-109) | 🟠 P1 | `EP` | Đơn thư (Petition) | EP content: detailContent có (summary rỗng) → bare-min content THOẢ | ⚠️ High |
| [TC-110](#tc-110) | 🟠 P1 | `BOUNDARY` | Đơn thư (Petition) | BOUNDARY: senderName 1 ký tự ("C") → không tính thiếu | ⚠️ High |
| [TC-112](#tc-112) | 🟠 P1 | `EP` | Đơn thư (Petition) | EP content: cả detailContent & summary rỗng → content THIẾU | ⚠️ High |
| [TC-117](#tc-117) | 🟠 P1 | `BOUNDARY` | Vụ việc/Vụ án (Dynamic) | BOUNDARY: đúng 1 templateId + đủ manualValues → 2xx | ⚠️ High |
| [TC-120](#tc-120) | 🟠 P1 | `A11Y` | Đơn thư (Petition) | Modal có role="dialog" + aria-modal="true" (focus/screen-reader nhận biết) | ⚠️ High |
| [TC-121](#tc-121) | 🟠 P1 | `A11Y` | Đơn thư (Petition) | Thông báo lỗi/cảnh báo dùng role="alert" (đọc to cho screen-reader) | ⚠️ High |
| [TC-122](#tc-122) | 🟠 P1 | `A11Y` | Vụ việc/Vụ án (Dynamic) | Checkbox mẫu thiếu có trạng thái disabled rõ ràng + <label> liên kết (click label = toggle) | ⚠️ High |
| [TC-123](#tc-123) | 🟠 P1 | `A11Y` | Đơn thư (Petition) | Ô bổ sung dùng <label> + input/textarea ngữ nghĩa (không div giả input) | ⚠️ High |
| [TC-125](#tc-125) | 🟠 P1 | `COMPAT` | Vụ việc/Vụ án (Dynamic) | Chromium (Playwright) — 2 luồng E2E xuất file .docx/.zip thành công | ⚠️ High |
| [TC-052](#tc-052) | 🟡 P2 | `EDGE` | Vụ việc/Vụ án (Dynamic) | GET cases/export-templates trả mảng (picker) | ⚡ Medium |
| [TC-053](#tc-053) | 🟡 P2 | `EDGE` | Bảo mật/RBAC | POST vào endpoint chỉ-GET export-readiness → 404/405 | ⚡ Medium |
| [TC-074](#tc-074) | 🟡 P2 | `SECURITY` | Bảo mật/RBAC | Admin GET readiness mọi case → 200 (full scope) | ⚡ Medium |
| [TC-111](#tc-111) | 🟡 P2 | `BOUNDARY` | Đơn thư (Petition) | readiness đơn thư trả đủ 7 docType | ⚡ Medium |
| [TC-113](#tc-113) | 🟡 P2 | `EP` | Đơn thư (Petition) | EP petitionType=TO_CAO hợp lệ → tạo 2xx | ⚡ Medium |
| [TC-114](#tc-114) | 🟡 P2 | `EP` | Đơn thư (Petition) | EP petitionType=KHIEU_NAI hợp lệ → tạo 2xx | ⚡ Medium |
| [TC-115](#tc-115) | 🟡 P2 | `EP` | Đơn thư (Petition) | EP petitionType=KIEN_NGHI hợp lệ → tạo 2xx | ⚡ Medium |
| [TC-116](#tc-116) | 🟡 P2 | `EP` | Đơn thư (Petition) | EP petitionType=PHAN_ANH hợp lệ → tạo 2xx | ⚡ Medium |
| [TC-124](#tc-124) | 🟡 P2 | `A11Y` | Đơn thư (Petition) | Nút đóng (X) có aria-label="Đóng" | ⚡ Medium |
| [TC-126](#tc-126) | 🟡 P2 | `COMPAT` | Bảo mật/RBAC | Download chứng từ: Content-Disposition filename* UTF-8 (tên file tiếng Việt mọi browser) | ⚡ Medium |
| [TC-127](#tc-127) | 🟡 P2 | `COMPAT` | Vụ việc/Vụ án (Dynamic) | Responsive: modal max-w-lg + max-h-[90vh] overflow-y-auto (mobile/desktop) | ⚡ Medium |
| [TC-128](#tc-128) | 🟢 P3 | `GREEN` | Đơn thư (Petition) | Dọn fixture đơn thư (DELETE) | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo đơn thư fixture (thiếu nội dung) thành công

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. POST /petitions status=201 id=cmqxhnkrt0000r0m72evjyn1x

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Đơn thư (Petition)
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
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: GET petition export-readiness trả 200 + items[]

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200 items=7

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: PHIEU_DE_XUAT ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent,nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent,lyDoChuyen,canCuPhapLy

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: PHIEU_CHUYEN_DON ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent,lyDoChuyen

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_HUONG_DAN ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent,huongDanKhoiKien

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_TRA_LAI ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent,lyDoTraDon

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_CHUYEN ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư rỗng: BIEN_NHAN ready=false

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=senderName,detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PHIEU_DE_XUAT yêu cầu thêm nhanThay+deXuat

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PHIEU_CHUYEN_NGUON_TIN yêu cầu thêm lyDoChuyen+canCuPhapLy

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,lyDoChuyen,canCuPhapLy

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: THONG_BAO_TRA_LAI yêu cầu thêm lyDoTraDon

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,lyDoTraDon

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PUT bổ sung senderName+detailContent (đúng expectedUpdatedAt) → 200

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: Critical
module: Optimistic-lock
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PUT trả updatedAt mới (FE refresh tránh 409)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. updatedAt=2026-06-28T07:49:48.574Z

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: Critical
module: Optimistic-lock
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Sau bổ sung bare-min: BIEN_NHAN ready=true

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=true

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Sau bare-min: PHIEU_DE_XUAT VẪN thiếu nhanThay+deXuat

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Critical
module: Đơn thư (Petition)
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
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PUT petition với expectedUpdatedAt CŨ → 409 (optimistic-lock)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=409

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Critical
module: Optimistic-lock
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Bổ sung nhanThay+deXuat → PHIEU_DE_XUAT ready=true (mẫu mở lại)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200 ready=true

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất PHIEU_DE_XUAT khi đã đủ thông tin → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Critical
module: Đơn thư (Petition)
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
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất THONG_BAO_TRA_LAI khi thiếu lyDoTraDon → 400 (chặn)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400 body={"success":false,"error":{"code":"BAD_REQUEST","message":"Không thể xuất THONG_BAO_TRA_LAI: thiếu các trường bắt buộc —

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: VU_AN: GET export-readiness 200 + items[]

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200 items=5

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: VU_AN: mọi trường thiếu savable=false (manual-override, không PUT)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. savable set=[false]

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: VU_VIEC: GET export-readiness 200 + items[]

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200 items=5

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: VU_VIEC: mọi trường thiếu savable=false (manual-override, không PUT)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. savable set=[false]

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Admin PATCH requiredVariables → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: Critical
module: Admin cấu hình required
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH set cờ required ĐÚNG biến chỉ định

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. before=tenVuAn,toiDanh,noiXayRa after=donVi

### Kết quả mong đợi
- = ["donVi"]

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Critical
module: Admin cấu hình required
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
- Loại: `DATA`
- Priority: `P0` 🔴
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH giữ nguyên name/source/label của variables

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. sample={"name":"donVi","label":"donVi","source":"auto","required":true}

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Critical
module: Admin cấu hình required
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: export-readiness KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=401

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: export-readiness id không tồn tại → 404 (không lộ data)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=404

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer GET export-readiness case NGOÀI scope → 403/404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=403

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer (không Setting:write) PATCH document-templates → 403

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=403

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Giá trị bổ sung có {}/<> (injection docxtemplater) → xuất 2xx (escape, không vỡ template)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `PERFORMANCE`
- Priority: `P0` 🔴
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Concurrency: 2 PUT đồng thời cùng expectedUpdatedAt → 1 OK + 1 409 (no lost-update)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. 200=1 409=1 (statuses 200/409)

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Critical
module: Optimistic-lock
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Payload XSS/SQL trong field bổ sung → xuất 2xx (escape, DB còn nguyên)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Sau payload SQL-ish: GET /petitions vẫn 200 (không bị DROP)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: Critical
module: Bảo mật/RBAC
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
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động: templateIds TRÙNG → 400 (chống cấp số 2 lần)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động: templateId không tồn tại → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động: template VU_VIEC dùng cho /cases → 400 (sai loại hồ sơ)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động VU_AN (merged) với manualValues bổ sung → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201 fields=9

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động VU_AN (zip) với manualValues bổ sung → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201 fields=9

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động: manualValues chứa {}/<> → 2xx (escape docxtemplater)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: cases/:id/export-readiness KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=401

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: incidents/:id/export-readiness KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=401

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer GET incidents export-readiness NGOÀI scope → 403/404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=403

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-071
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động VU_VIEC: templateIds TRÙNG → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-075
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động: template VU_AN dùng cho /incidents → 400 (sai loại)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-076
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động VU_VIEC (merged) với manualValues → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-077
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export động VU_VIEC (zip) với manualValues → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=201

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-078
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thư đủ bare-min ngay khi tạo: BIEN_NHAN + THONG_BAO_CHUYEN ready

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. BIEN_NHAN=true THONG_BAO_CHUYEN=true

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-080
severity: Critical
module: Đơn thư (Petition)
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
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST export-documents đơn thư KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-090
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST export-documents đơn thư không tồn tại → 404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-091
severity: Critical
module: Bảo mật/RBAC
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
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: POST export-documents động KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-092
severity: Critical
module: Bảo mật/RBAC
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
- Priority: `P0` 🔴
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH document-templates id không tồn tại → 404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-093
severity: Critical
module: Admin cấu hình required
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
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH document-templates KHÔNG token → 401

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-094
severity: Critical
module: Bảo mật/RBAC
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
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo petition petitionType sai enum → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-096
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất đơn thư docType sai enum → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-098
severity: Critical
module: Đơn thư (Petition)
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
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xuất động thiếu templateIds → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-100
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Priority: `P0` 🔴
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: PATCH requiredVariables không phải mảng → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-103
severity: Critical
module: Admin cấu hình required
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
- Priority: `P0` 🔴
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Officer2 (không Setting:write) PATCH document-templates → 403

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-106
severity: Critical
module: Bảo mật/RBAC
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
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI đơn thư: mở popup "In chứng từ" → mẫu thiếu disabled + "Thiếu: …" → bổ sung → Lưu → enable → xuất download

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. tests/e2e/{petition,dynamic}-export-readiness.e2e.spec.ts (chromium) — đã chạy PASS trong phiên UAT

### Kết quả mong đợi
- luồng UI hoàn chỉnh

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-118
severity: Critical
module: Đơn thư (Petition)
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
- Loại: `INTEGRATION`
- Priority: `P0` 🔴
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: UI vụ án: mở popup → mẫu thiếu khoá + "Thiếu" → nhập manualValues → enable → tick → xuất download

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. tests/e2e/{petition,dynamic}-export-readiness.e2e.spec.ts (chromium) — đã chạy PASS trong phiên UAT

### Kết quả mong đợi
- luồng UI hoàn chỉnh

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-119
severity: Critical
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: PHIEU_DE_XUAT báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,lyDoChuyen,canCuPhapLy

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: PHIEU_CHUYEN_DON báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,lyDoChuyen

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_HUONG_DAN báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,huongDanKhoiKien

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_TRA_LAI báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent,lyDoTraDon

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: THONG_BAO_CHUYEN báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: High
module: Đơn thư (Petition)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư rỗng: BIEN_NHAN báo thiếu senderName+detailContent

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: High
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BIEN_NHAN KHÔNG yêu cầu trường đánh giá (chỉ bare-min)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=senderName,detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: High
module: Đơn thư (Petition)
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: trường thiếu savable=true (lưu vào hồ sơ)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. savable=[true,true,true,true]

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: High
module: Đơn thư (Petition)
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
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_AN: trả updatedAt cho FE (PUT bổ sung không 409)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. updatedAt=2026-06-28T05:57:47.946Z

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_AN: ready=false ⇔ missing không rỗng (nhất quán)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. items=[["QD_KHOI_TO_VU_AN",false,2],["QD_KHOI_TO_BI_CAN",false,4],["KET_LUAN_DIEU_TRA",false,4],["QD_TAM_DINH_CHI_DT",false,1],["BB_HOI_CUNG_BI_CAN",false,3]]

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_AN: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. mẫu thiếu=5/5

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_VIEC: trả updatedAt cho FE (PUT bổ sung không 409)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. updatedAt=2026-06-28T05:57:47.976Z

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_VIEC: ready=false ⇔ missing không rỗng (nhất quán)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. items=[["QD_PHAN_CONG_GIAI_QUYET",false,3],["QD_KHOI_TO_TU_NGUON_TIN",false,2],["QD_KHONG_KHOI_TO",false,2],["TB_KET_QUA_GIAI_QUYET",false,2],["QD_TAM_DINH_CHI_GQ",false,1]]

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_VIEC: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. mẫu thiếu=5/5

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Response KHÔNG có field requiredVariables (không spread thành cột)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. keys=id,code,name,entityType,category,fileBytes,fileSha,fileName,variables,needsNumber,numberSeriesId,status,sortOrder,createdById,createdAt,updatedAt,deletedAt

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: High
module: Admin cấu hình required
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
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Restore requiredVariables về ban đầu (dọn data)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. cleanup

### Kết quả mong đợi
- = ["noiXayRa","tenVuAn","toiDanh"]

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: High
module: Admin cấu hình required
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
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DON_THU guard (không có mẫu DON_THU động — đơn thư hardcode)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. list DON_THU rỗng (đúng thiết kế)

### Kết quả mong đợi
- nếu có mẫu

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: High
module: Admin cấu hình required
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Officer có case trong scope để đọc readiness

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. officer1 không có case nào

### Kết quả mong đợi
- ≥1 case

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: High
module: Bảo mật/RBAC
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: điền `summary` (không detailContent) → bare-min content thoả (OR)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. BIEN_NHAN missing=

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: High
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: điền senderName → senderName hết thiếu

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: Đơn thư (Petition)
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
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: nhanThay/deXuat chỉ khoảng trắng → VẪN tính thiếu (trim)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. PHIEU_DE_XUAT missing=nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: High
module: Đơn thư (Petition)
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
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: điền lyDoChuyen → PHIEU_CHUYEN_DON ready=true

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=true

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: High
module: Đơn thư (Petition)
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
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư: chưa điền huongDanKhoiKien → THONG_BAO_HUONG_DAN vẫn thiếu

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=huongDanKhoiKien

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: High
module: Đơn thư (Petition)
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: IDOR: incidentId trên /cases/:id/export-readiness → 404 (không lẫn entity)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=404

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-070
severity: High
module: Bảo mật/RBAC
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
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_AN QD_KHOI_TO_VU_AN: missing chỉ gồm biến required (theo seed REQUIRED_VARS)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. code=QD_KHOI_TO_VU_AN ready=false missing=toiDanh,noiXayRa

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-072
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_AN missing field có {field,label,type,savable}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. sample={"field":"toiDanh","label":"toiDanh","type":"text","savable":false}

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-073
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: VU_VIEC QD_PHAN_CONG_GIAI_QUYET: missing là biến required

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false missing=nguonTin,dieuTraVien,nguoiQuyetDinh

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-079
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đơn thư đủ bare-min: PHIEU_DE_XUAT vẫn thiếu (cần nhanThay+deXuat)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ready=false

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-081
severity: High
module: Đơn thư (Petition)
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
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: readiness có updatedAt (đồng bộ optimistic-lock)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. updatedAt=true

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-082
severity: High
module: Optimistic-lock
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất nhiều mẫu, 1 mẫu thiếu (PHIEU_DE_XUAT) → 400 (chặn cụm)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-083
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất với docTypes rỗng → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=400

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-084
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Decision: PHIEU_DE_XUAT (bare-min đủ) thiếu đúng {nhanThay,deXuat}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=nhanThay,deXuat

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-085
severity: High
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Decision: PHIEU_CHUYEN_NGUON_TIN (bare-min đủ) thiếu đúng {lyDoChuyen,canCuPhapLy}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=lyDoChuyen,canCuPhapLy

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-086
severity: High
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Decision: PHIEU_CHUYEN_DON (bare-min đủ) thiếu đúng {lyDoChuyen}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=lyDoChuyen

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-087
severity: High
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Decision: THONG_BAO_HUONG_DAN (bare-min đủ) thiếu đúng {huongDanKhoiKien}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=huongDanKhoiKien

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-088
severity: High
module: Đơn thư (Petition)
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
- Loại: `DECISION`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Decision: THONG_BAO_TRA_LAI (bare-min đủ) thiếu đúng {lyDoTraDon}

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=lyDoTraDon

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-089
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: DELETE document-templates id không tồn tại → 404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-095
severity: High
module: Admin cấu hình required
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tạo petition receivedDate sai định dạng → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-097
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất đơn thư body rỗng (thiếu docTypes) → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-099
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất động templateIds rỗng → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-101
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xuất động mode không hợp lệ → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-102
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Module: `Admin cấu hình required`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PATCH requiredVariables phần tử không phải string → 400

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Admin cấu hình required`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Admin cấu hình required`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-104
severity: High
module: Admin cấu hình required
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
- Priority: `P1` 🟠
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET export-readiness id sai định dạng UUID → 400/404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-105
severity: High
module: Bảo mật/RBAC
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
- Priority: `P1` 🟠
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: GET export-readiness petition ĐÃ XOÁ → 404

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-107
severity: High
module: Bảo mật/RBAC
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
- Module: `Optimistic-lock`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PUT petition expectedUpdatedAt sai định dạng → 400/409

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Optimistic-lock`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Optimistic-lock`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-108
severity: High
module: Optimistic-lock
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP content: detailContent có (summary rỗng) → bare-min content THOẢ

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-109
severity: High
module: Đơn thư (Petition)
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY: senderName 1 ký tự ("C") → không tính thiếu

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-110
severity: High
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: EP content: cả detailContent & summary rỗng → content THIẾU

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. missing=detailContent

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-112
severity: High
module: Đơn thư (Petition)
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: BOUNDARY: đúng 1 templateId + đủ manualValues → 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-117
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Modal có role="dialog" + aria-modal="true" (focus/screen-reader nhận biết)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ExportDocumentsModal/DynamicExportDocumentsModal/TemplateRequiredModal

### Kết quả mong đợi
- role=dialog aria-modal

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-120
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Thông báo lỗi/cảnh báo dùng role="alert" (đọc to cho screen-reader)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ExportReadinessChecklist + modals

### Kết quả mong đợi
- role=alert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-121
severity: High
module: Đơn thư (Petition)
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
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Checkbox mẫu thiếu có trạng thái disabled rõ ràng + <label> liên kết (click label = toggle)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. tests/e2e/{petition,dynamic}-export-readiness.e2e.spec.ts (chromium) — đã chạy PASS trong phiên UAT

### Kết quả mong đợi
- disabled + label

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-122
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Priority: `P1` 🟠
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Ô bổ sung dùng <label> + input/textarea ngữ nghĩa (không div giả input)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. ExportReadinessChecklist.tsx

### Kết quả mong đợi
- label+input

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-123
severity: High
module: Đơn thư (Petition)
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
- Priority: `P1` 🟠
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chromium (Playwright) — 2 luồng E2E xuất file .docx/.zip thành công

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. tests/e2e/{petition,dynamic}-export-readiness.e2e.spec.ts (chromium) — đã chạy PASS trong phiên UAT

### Kết quả mong đợi
- chromium pass

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-125
severity: High
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET cases/export-templates trả mảng (picker)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. type=array len=5

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: Medium
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `EDGE`
- Priority: `P2` 🟡
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: POST vào endpoint chỉ-GET export-readiness → 404/405

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=404

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: Bảo mật/RBAC
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
- Priority: `P2` 🟡
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Admin GET readiness mọi case → 200 (full scope)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. status=200

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-074
severity: Medium
module: Bảo mật/RBAC
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
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: readiness đơn thư trả đủ 7 docType

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. count=7

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-111
severity: Medium
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP petitionType=TO_CAO hợp lệ → tạo 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-113
severity: Medium
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP petitionType=KHIEU_NAI hợp lệ → tạo 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-114
severity: Medium
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP petitionType=KIEN_NGHI hợp lệ → tạo 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-115
severity: Medium
module: Đơn thư (Petition)
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: EP petitionType=PHAN_ANH hợp lệ → tạo 2xx

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local.

### Kết quả mong đợi
- true

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-116
severity: Medium
module: Đơn thư (Petition)
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Nút đóng (X) có aria-label="Đóng"

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. DynamicExportDocumentsModal/ExportDocumentsModal

### Kết quả mong đợi
- aria-label

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-124
severity: Medium
module: Đơn thư (Petition)
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
- Module: `Bảo mật/RBAC`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Download chứng từ: Content-Disposition filename* UTF-8 (tên file tiếng Việt mọi browser)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. dynamic-export.service.ts

### Kết quả mong đợi
- filename* UTF-8

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Bảo mật/RBAC`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Bảo mật/RBAC`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-126
severity: Medium
module: Bảo mật/RBAC
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Vụ việc/Vụ án (Dynamic)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Responsive: modal max-w-lg + max-h-[90vh] overflow-y-auto (mobile/desktop)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. DynamicExportDocumentsModal.tsx

### Kết quả mong đợi
- responsive container

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Vụ việc/Vụ án (Dynamic)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Vụ việc/Vụ án (Dynamic)`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-127
severity: Medium
module: Vụ việc/Vụ án (Dynamic)
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
- Loại: `GREEN`
- Priority: `P3` 🟢
- Module: `Đơn thư (Petition)`
- Yêu cầu: ``
- Kỹ thuật: ``
- Risk: ``
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Dọn fixture đơn thư (DELETE)

### Các bước kiểm thử
- [ ] Chạy LIVE API trên local. DELETE /petitions/cmqxhnkrt0000r0m72evjyn1x

### Kết quả mong đợi
- đã dọn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Đơn thư (Petition)`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Đơn thư (Petition)`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-128
severity: Low
module: Đơn thư (Petition)
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

- [ ] **TC-001** [P0] Tạo đơn thư fixture (thiếu nội dung) thành công
- [ ] **TC-002** [P0] GET petition export-readiness trả 200 + items[]
- [ ] **TC-003** [P0] Đơn thư rỗng: PHIEU_DE_XUAT ready=false
- [ ] **TC-005** [P0] Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN ready=false
- [ ] **TC-007** [P0] Đơn thư rỗng: PHIEU_CHUYEN_DON ready=false
- [ ] **TC-009** [P0] Đơn thư rỗng: THONG_BAO_HUONG_DAN ready=false
- [ ] **TC-011** [P0] Đơn thư rỗng: THONG_BAO_TRA_LAI ready=false
- [ ] **TC-013** [P0] Đơn thư rỗng: THONG_BAO_CHUYEN ready=false
- [ ] **TC-015** [P0] Đơn thư rỗng: BIEN_NHAN ready=false
- [ ] **TC-017** [P0] PHIEU_DE_XUAT yêu cầu thêm nhanThay+deXuat
- [ ] **TC-018** [P0] PHIEU_CHUYEN_NGUON_TIN yêu cầu thêm lyDoChuyen+canCuPhapLy
- [ ] **TC-019** [P0] THONG_BAO_TRA_LAI yêu cầu thêm lyDoTraDon
- [ ] **TC-022** [P0] PUT bổ sung senderName+detailContent (đúng expectedUpdatedAt) → 200
- [ ] **TC-023** [P0] PUT trả updatedAt mới (FE refresh tránh 409)
- [ ] **TC-024** [P0] Sau bổ sung bare-min: BIEN_NHAN ready=true
- [ ] **TC-025** [P0] Sau bare-min: PHIEU_DE_XUAT VẪN thiếu nhanThay+deXuat
- [ ] **TC-026** [P0] PUT petition với expectedUpdatedAt CŨ → 409 (optimistic-lock)
- [ ] **TC-027** [P0] Bổ sung nhanThay+deXuat → PHIEU_DE_XUAT ready=true (mẫu mở lại)
- [ ] **TC-028** [P0] Xuất PHIEU_DE_XUAT khi đã đủ thông tin → 2xx
- [ ] **TC-029** [P0] Xuất THONG_BAO_TRA_LAI khi thiếu lyDoTraDon → 400 (chặn)
- [ ] **TC-030** [P0] VU_AN: GET export-readiness 200 + items[]
- [ ] **TC-032** [P0] VU_AN: mọi trường thiếu savable=false (manual-override, không PUT)
- [ ] **TC-035** [P0] VU_VIEC: GET export-readiness 200 + items[]
- [ ] **TC-037** [P0] VU_VIEC: mọi trường thiếu savable=false (manual-override, không PUT)
- [ ] **TC-040** [P0] Admin PATCH requiredVariables → 2xx
- [ ] **TC-041** [P0] PATCH set cờ required ĐÚNG biến chỉ định
- [ ] **TC-042** [P0] PATCH giữ nguyên name/source/label của variables
- [ ] **TC-046** [P0] export-readiness KHÔNG token → 401
- [ ] **TC-047** [P0] export-readiness id không tồn tại → 404 (không lộ data)
- [ ] **TC-049** [P0] Officer GET export-readiness case NGOÀI scope → 403/404
- [ ] **TC-050** [P0] Officer (không Setting:write) PATCH document-templates → 403
- [ ] **TC-051** [P0] Giá trị bổ sung có {}/<> (injection docxtemplater) → xuất 2xx (escape, không vỡ template)
- [ ] **TC-059** [P0] Concurrency: 2 PUT đồng thời cùng expectedUpdatedAt → 1 OK + 1 409 (no lost-update)
- [ ] **TC-060** [P0] Payload XSS/SQL trong field bổ sung → xuất 2xx (escape, DB còn nguyên)
- [ ] **TC-061** [P0] Sau payload SQL-ish: GET /petitions vẫn 200 (không bị DROP)
- [ ] **TC-062** [P0] Export động: templateIds TRÙNG → 400 (chống cấp số 2 lần)
- [ ] **TC-063** [P0] Export động: templateId không tồn tại → 400
- [ ] **TC-064** [P0] Export động: template VU_VIEC dùng cho /cases → 400 (sai loại hồ sơ)
- [ ] **TC-065** [P0] Export động VU_AN (merged) với manualValues bổ sung → 2xx
- [ ] **TC-066** [P0] Export động VU_AN (zip) với manualValues bổ sung → 2xx
- [ ] **TC-067** [P0] Export động: manualValues chứa {}/<> → 2xx (escape docxtemplater)
- [ ] **TC-068** [P0] cases/:id/export-readiness KHÔNG token → 401
- [ ] **TC-069** [P0] incidents/:id/export-readiness KHÔNG token → 401
- [ ] **TC-071** [P0] Officer GET incidents export-readiness NGOÀI scope → 403/404
- [ ] **TC-075** [P0] Export động VU_VIEC: templateIds TRÙNG → 400
- [ ] **TC-076** [P0] Export động: template VU_AN dùng cho /incidents → 400 (sai loại)
- [ ] **TC-077** [P0] Export động VU_VIEC (merged) với manualValues → 2xx
- [ ] **TC-078** [P0] Export động VU_VIEC (zip) với manualValues → 2xx
- [ ] **TC-080** [P0] Đơn thư đủ bare-min ngay khi tạo: BIEN_NHAN + THONG_BAO_CHUYEN ready
- [ ] **TC-090** [P0] POST export-documents đơn thư KHÔNG token → 401
- [ ] **TC-091** [P0] POST export-documents đơn thư không tồn tại → 404
- [ ] **TC-092** [P0] POST export-documents động KHÔNG token → 401
- [ ] **TC-093** [P0] PATCH document-templates id không tồn tại → 404
- [ ] **TC-094** [P0] PATCH document-templates KHÔNG token → 401
- [ ] **TC-096** [P0] Tạo petition petitionType sai enum → 400
- [ ] **TC-098** [P0] Xuất đơn thư docType sai enum → 400
- [ ] **TC-100** [P0] Xuất động thiếu templateIds → 400
- [ ] **TC-103** [P0] PATCH requiredVariables không phải mảng → 400
- [ ] **TC-106** [P0] Officer2 (không Setting:write) PATCH document-templates → 403
- [ ] **TC-118** [P0] UI đơn thư: mở popup "In chứng từ" → mẫu thiếu disabled + "Thiếu: …" → bổ sung → Lưu → enable → xuất download
- [ ] **TC-119** [P0] UI vụ án: mở popup → mẫu thiếu khoá + "Thiếu" → nhập manualValues → enable → tick → xuất download
- [ ] **TC-004** [P1] Đơn thư rỗng: PHIEU_DE_XUAT báo thiếu senderName+detailContent
- [ ] **TC-006** [P1] Đơn thư rỗng: PHIEU_CHUYEN_NGUON_TIN báo thiếu senderName+detailContent
- [ ] **TC-008** [P1] Đơn thư rỗng: PHIEU_CHUYEN_DON báo thiếu senderName+detailContent
- [ ] **TC-010** [P1] Đơn thư rỗng: THONG_BAO_HUONG_DAN báo thiếu senderName+detailContent
- [ ] **TC-012** [P1] Đơn thư rỗng: THONG_BAO_TRA_LAI báo thiếu senderName+detailContent
- [ ] **TC-014** [P1] Đơn thư rỗng: THONG_BAO_CHUYEN báo thiếu senderName+detailContent
- [ ] **TC-016** [P1] Đơn thư rỗng: BIEN_NHAN báo thiếu senderName+detailContent
- [ ] **TC-020** [P1] BIEN_NHAN KHÔNG yêu cầu trường đánh giá (chỉ bare-min)
- [ ] **TC-021** [P1] Đơn thư: trường thiếu savable=true (lưu vào hồ sơ)
- [ ] **TC-031** [P1] VU_AN: trả updatedAt cho FE (PUT bổ sung không 409)
- [ ] **TC-033** [P1] VU_AN: ready=false ⇔ missing không rỗng (nhất quán)
- [ ] **TC-034** [P1] VU_AN: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu)
- [ ] **TC-036** [P1] VU_VIEC: trả updatedAt cho FE (PUT bổ sung không 409)
- [ ] **TC-038** [P1] VU_VIEC: ready=false ⇔ missing không rỗng (nhất quán)
- [ ] **TC-039** [P1] VU_VIEC: readiness phản ánh cờ required (có mẫu báo thiếu khi hồ sơ thiếu)
- [ ] **TC-043** [P1] Response KHÔNG có field requiredVariables (không spread thành cột)
- [ ] **TC-044** [P1] Restore requiredVariables về ban đầu (dọn data)
- [ ] **TC-045** [P1] DON_THU guard (không có mẫu DON_THU động — đơn thư hardcode)
- [ ] **TC-048** [P1] Officer có case trong scope để đọc readiness
- [ ] **TC-054** [P1] Đơn thư: điền `summary` (không detailContent) → bare-min content thoả (OR)
- [ ] **TC-055** [P1] Đơn thư: điền senderName → senderName hết thiếu
- [ ] **TC-056** [P1] Đơn thư: nhanThay/deXuat chỉ khoảng trắng → VẪN tính thiếu (trim)
- [ ] **TC-057** [P1] Đơn thư: điền lyDoChuyen → PHIEU_CHUYEN_DON ready=true
- [ ] **TC-058** [P1] Đơn thư: chưa điền huongDanKhoiKien → THONG_BAO_HUONG_DAN vẫn thiếu
- [ ] **TC-070** [P1] IDOR: incidentId trên /cases/:id/export-readiness → 404 (không lẫn entity)
- [ ] **TC-072** [P1] VU_AN QD_KHOI_TO_VU_AN: missing chỉ gồm biến required (theo seed REQUIRED_VARS)
- [ ] **TC-073** [P1] VU_AN missing field có {field,label,type,savable}
- [ ] **TC-079** [P1] VU_VIEC QD_PHAN_CONG_GIAI_QUYET: missing là biến required
- [ ] **TC-081** [P1] Đơn thư đủ bare-min: PHIEU_DE_XUAT vẫn thiếu (cần nhanThay+deXuat)
- [ ] **TC-082** [P1] readiness có updatedAt (đồng bộ optimistic-lock)
- [ ] **TC-083** [P1] Xuất nhiều mẫu, 1 mẫu thiếu (PHIEU_DE_XUAT) → 400 (chặn cụm)
- [ ] **TC-084** [P1] Xuất với docTypes rỗng → 400
- [ ] **TC-085** [P1] Decision: PHIEU_DE_XUAT (bare-min đủ) thiếu đúng {nhanThay,deXuat}
- [ ] **TC-086** [P1] Decision: PHIEU_CHUYEN_NGUON_TIN (bare-min đủ) thiếu đúng {lyDoChuyen,canCuPhapLy}
- [ ] **TC-087** [P1] Decision: PHIEU_CHUYEN_DON (bare-min đủ) thiếu đúng {lyDoChuyen}
- [ ] **TC-088** [P1] Decision: THONG_BAO_HUONG_DAN (bare-min đủ) thiếu đúng {huongDanKhoiKien}
- [ ] **TC-089** [P1] Decision: THONG_BAO_TRA_LAI (bare-min đủ) thiếu đúng {lyDoTraDon}
- [ ] **TC-095** [P1] DELETE document-templates id không tồn tại → 404
- [ ] **TC-097** [P1] Tạo petition receivedDate sai định dạng → 400
- [ ] **TC-099** [P1] Xuất đơn thư body rỗng (thiếu docTypes) → 400
- [ ] **TC-101** [P1] Xuất động templateIds rỗng → 400
- [ ] **TC-102** [P1] Xuất động mode không hợp lệ → 400
- [ ] **TC-104** [P1] PATCH requiredVariables phần tử không phải string → 400
- [ ] **TC-105** [P1] GET export-readiness id sai định dạng UUID → 400/404
- [ ] **TC-107** [P1] GET export-readiness petition ĐÃ XOÁ → 404
- [ ] **TC-108** [P1] PUT petition expectedUpdatedAt sai định dạng → 400/409
- [ ] **TC-109** [P1] EP content: detailContent có (summary rỗng) → bare-min content THOẢ
- [ ] **TC-110** [P1] BOUNDARY: senderName 1 ký tự ("C") → không tính thiếu
- [ ] **TC-112** [P1] EP content: cả detailContent & summary rỗng → content THIẾU
- [ ] **TC-117** [P1] BOUNDARY: đúng 1 templateId + đủ manualValues → 2xx
- [ ] **TC-120** [P1] Modal có role="dialog" + aria-modal="true" (focus/screen-reader nhận biết)
- [ ] **TC-121** [P1] Thông báo lỗi/cảnh báo dùng role="alert" (đọc to cho screen-reader)
- [ ] **TC-122** [P1] Checkbox mẫu thiếu có trạng thái disabled rõ ràng + <label> liên kết (click label = toggle)
- [ ] **TC-123** [P1] Ô bổ sung dùng <label> + input/textarea ngữ nghĩa (không div giả input)
- [ ] **TC-125** [P1] Chromium (Playwright) — 2 luồng E2E xuất file .docx/.zip thành công
- [ ] **TC-052** [P2] GET cases/export-templates trả mảng (picker)
- [ ] **TC-053** [P2] POST vào endpoint chỉ-GET export-readiness → 404/405
- [ ] **TC-074** [P2] Admin GET readiness mọi case → 200 (full scope)
- [ ] **TC-111** [P2] readiness đơn thư trả đủ 7 docType
- [ ] **TC-113** [P2] EP petitionType=TO_CAO hợp lệ → tạo 2xx
- [ ] **TC-114** [P2] EP petitionType=KHIEU_NAI hợp lệ → tạo 2xx
- [ ] **TC-115** [P2] EP petitionType=KIEN_NGHI hợp lệ → tạo 2xx
- [ ] **TC-116** [P2] EP petitionType=PHAN_ANH hợp lệ → tạo 2xx
- [ ] **TC-124** [P2] Nút đóng (X) có aria-label="Đóng"
- [ ] **TC-126** [P2] Download chứng từ: Content-Disposition filename* UTF-8 (tên file tiếng Việt mọi browser)
- [ ] **TC-127** [P2] Responsive: modal max-w-lg + max-h-[90vh] overflow-y-auto (mobile/desktop)
- [ ] **TC-128** [P3] Dọn fixture đơn thư (DELETE)

---

_Generated by `uat-test-writer` skill on 28/06/2026 14:50_