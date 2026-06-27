# UAT Test Cases — Popup Xuất chứng từ Đơn thư + Split-button Lưu

**Generated**: 27/06/2026 18:07  
**Complexity**: `medium`  
**Total TC**: 168  
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

**Tổng số TC**: 168

**Phân bố loại**:
- `RED`: 68
- `GREEN`: 24
- `SECURITY`: 18
- `BOUNDARY`: 14
- `EP`: 12
- `A11Y`: 9
- `COMPAT`: 9
- `PERFORMANCE`: 6
- `REGRESSION`: 3
- `STATE`: 3
- `DATA`: 2

**Phân bố priority**:
- 🔴 `P0`: 51
- 🟠 `P1`: 45
- 🟡 `P2`: 72

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 14
- ⚠️ `High`: 70
- ⚡ `Medium`: 48
- 📌 `Low`: 36

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `admin` | `admin@pc02.local` | `<từ .env/test accounts>` | ADMIN | active | Quyền đầy đủ — happy path + RBAC pass |
| `officer1` | `officer1@pc02.local` | `<từ test accounts>` | OFFICER | active | Kiểm DataScope/IDOR theo tổ |
| `noperm` | `<seed>` | `<seed>` | NO_PETITION_READ | active | RBAC 403 |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| docTypes.length | `0` | `min-1` | **400 ArrayNotEmpty** | rỗng |
| docTypes.length | `1` | `min` | **201, 0 ngắt trang** |  |
| docTypes.length | `7` | `max` | **201, 6 ngắt trang** | tất cả mẫu |
| throttle | `5/60s` | `max` | **201** | trong hạn |
| throttle | `6/60s` | `max+1` | **429** | vượt hạn |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
| id | `1' OR '1'='1` | SQLi | 404/400 không 500 | `A03` |
| docTypes[] | `<script>alert(1)</script>` | XSS | 400 | `A03` |
| docTypes[] | `../../etc/passwd` | Path Traversal | 400 allowlist | `A01` |
| Authorization | `(none)` | Broken Auth | 401 | `A07` |
| petitionId | `đơn tổ khác` | IDOR | 403/404 | `A01` |

## 🗂️ Data Maturity Matrix

> Data fixtures được runner tự động seed trước test, KHÔNG cần human chạy SQL.
> Mỗi fixture có ID format `<entity>.<state>.<lifecycle>.<shape>`.

### `petition.full.D0`

**Mô tả**: Đơn đủ TẤT CẢ trường cho 7 mẫu
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST /api/v1/petitions {senderName,senderPhone,petitionType:TO_CAO,crimeChinhId,summary,detailContent,nhanThay,deXuat,lyDoChuyen,canCuPhapLy,huongDanKhoiKien,lyDoTraDon}"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-001, TC-EXP-003, TC-EXP-005, TC-EXP-011, TC-EXP-012, TC-EXP-015, TC-EXP-018, TC-EXP-023, TC-EXP-024, TC-EXP-025, TC-EXP-026, TC-EXP-027, TC-EXP-028, TC-EXP-029, TC-EXP-030, TC-EXP-036, TC-EXP-041, TC-EXP-046, TC-EXP-047, TC-EXP-048, TC-EXP-066, TC-EXP-067, TC-EXP-068, TC-EXP-069, TC-EXP-088, TC-EXP-089, TC-EXP-141, TC-EXP-159, TC-EXP-006, TC-EXP-013, TC-EXP-014, TC-EXP-016, TC-EXP-017, TC-EXP-019, TC-EXP-021, TC-EXP-022, TC-EXP-031, TC-EXP-032, TC-EXP-033, TC-EXP-037, TC-EXP-038, TC-EXP-049, TC-EXP-050, TC-EXP-051, TC-EXP-056, TC-EXP-074, TC-EXP-075, TC-EXP-076, TC-EXP-080, TC-EXP-081, TC-EXP-090, TC-EXP-092, TC-EXP-093, TC-EXP-094, TC-EXP-095, TC-EXP-096, TC-EXP-097, TC-EXP-098, TC-EXP-099, TC-EXP-100, TC-EXP-101, TC-EXP-102, TC-EXP-114, TC-EXP-115, TC-EXP-116, TC-EXP-117, TC-EXP-118, TC-EXP-120, TC-EXP-144, TC-EXP-007, TC-EXP-008, TC-EXP-010, TC-EXP-020, TC-EXP-034, TC-EXP-035, TC-EXP-039, TC-EXP-054, TC-EXP-055, TC-EXP-072, TC-EXP-073, TC-EXP-077, TC-EXP-078, TC-EXP-079, TC-EXP-082, TC-EXP-083, TC-EXP-084, TC-EXP-085, TC-EXP-086, TC-EXP-087, TC-EXP-103, TC-EXP-112, TC-EXP-113, TC-EXP-119, TC-EXP-121, TC-EXP-122, TC-EXP-123, TC-EXP-126, TC-EXP-127, TC-EXP-128, TC-EXP-129, TC-EXP-130, TC-EXP-133, TC-EXP-134, TC-EXP-139, TC-EXP-142, TC-EXP-143, TC-EXP-145, TC-EXP-146, TC-EXP-147, TC-EXP-148, TC-EXP-150, TC-EXP-151, TC-EXP-152, TC-EXP-154, TC-EXP-155, TC-EXP-156, TC-EXP-157, TC-EXP-161, TC-EXP-162, TC-EXP-163, TC-EXP-165, TC-EXP-166, TC-EXP-167, TC-EXP-168

---

### `petition.new.valid`

**Mô tả**: Đơn mới hợp lệ tối thiểu để lưu
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Form /petitions/new đủ trường bắt buộc"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-002, TC-EXP-004

---

### `petition.new.invalid`

**Mô tả**: Đơn để trống Họ tên (fail validate FE)
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Form bỏ trống senderName"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-009

---

### `petition.missing.dexuat`

**Mô tả**: Đơn có senderName+summary nhưng THIẾU deXuat
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST petitions không gửi nhanThay/deXuat"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-040, TC-EXP-057

---

### `petition.empty.sender`

**Mô tả**: Đơn senderName rỗng (seed legacy)
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Đơn seed có senderName=''"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-042, TC-EXP-164

---

### `petition.missing.chuyen`

**Mô tả**: Đơn thiếu lyDoChuyen/canCuPhapLy
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST petitions không gửi lyDoChuyen"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-043, TC-EXP-091

---

### `petition.missing.huongdan`

**Mô tả**: Đơn thiếu huongDanKhoiKien
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST không gửi huongDanKhoiKien"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-044, TC-EXP-111

---

### `petition.missing.tralai`

**Mô tả**: Đơn thiếu lyDoTraDon
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST không gửi lyDoTraDon"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-045, TC-EXP-138

---

### `petition.deleted`

**Mô tả**: Đơn đã soft-delete
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"DELETE /api/v1/petitions/:id"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-053, TC-EXP-135

---

### `petition.converted`

**Mô tả**: Đơn đã convert sang vụ việc/vụ án, đủ trường mẫu
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Seed đơn linkedCaseId/linkedIncidentId set"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-110

---

### `petition.otherteam`

**Mô tả**: Đơn thuộc tổ khác user
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Seed đơn assignedTeam ≠ tổ user test"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-062, TC-EXP-160

---

### `petition.special.name`

**Mô tả**: senderName chứa { } < > &
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST petitions senderName='A{<b>}&'"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-070

---

### `petition.long.content`

**Mô tả**: summary 5000 ký tự
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"POST petitions summary dài"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-071, TC-EXP-149

---

### `user.noperm`

**Mô tả**: User KHÔNG có quyền read Petition
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"Seed user role thiếu permission Petition.read"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-061

---

### `none`

**Mô tả**: Không cần data (test auth/validation thuần)
**Entity**: `` | **State**: `` | **Lifecycle**: `` | **Shape**: `single`

**Setup** (api):
```json
"—"
```

**Cleanup**:
```json
"Soft-delete đơn/cleanup user sau test"
```

**Outputs**: `$.id`

**Dùng bởi**: TC-EXP-052, TC-EXP-058, TC-EXP-059, TC-EXP-060, TC-EXP-063, TC-EXP-064, TC-EXP-065, TC-EXP-140, TC-EXP-158, TC-EXP-104, TC-EXP-105, TC-EXP-106, TC-EXP-107, TC-EXP-108, TC-EXP-109, TC-EXP-124, TC-EXP-125, TC-EXP-131, TC-EXP-132, TC-EXP-136, TC-EXP-137, TC-EXP-153

---

### 📋 Bảng tóm tắt

| Fixture ID | Entity | State | Lifecycle | TC dùng |
|------------|--------|-------|-----------|---------|
| `petition.full.D0` |  |  |  | TC-EXP-001, TC-EXP-003, TC-EXP-005... |
| `petition.new.valid` |  |  |  | TC-EXP-002, TC-EXP-004 |
| `petition.new.invalid` |  |  |  | TC-EXP-009 |
| `petition.missing.dexuat` |  |  |  | TC-EXP-040, TC-EXP-057 |
| `petition.empty.sender` |  |  |  | TC-EXP-042, TC-EXP-164 |
| `petition.missing.chuyen` |  |  |  | TC-EXP-043, TC-EXP-091 |
| `petition.missing.huongdan` |  |  |  | TC-EXP-044, TC-EXP-111 |
| `petition.missing.tralai` |  |  |  | TC-EXP-045, TC-EXP-138 |
| `petition.deleted` |  |  |  | TC-EXP-053, TC-EXP-135 |
| `petition.converted` |  |  |  | TC-EXP-110 |
| `petition.otherteam` |  |  |  | TC-EXP-062, TC-EXP-160 |
| `petition.special.name` |  |  |  | TC-EXP-070 |
| `petition.long.content` |  |  |  | TC-EXP-071, TC-EXP-149 |
| `user.noperm` |  |  |  | TC-EXP-061 |
| `none` |  |  |  | TC-EXP-052, TC-EXP-058, TC-EXP-059... |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-EXP-001](#tc-exp-001) | 🔴 P0 | `GREEN` | M1-SplitButton | Form đơn thư hiển thị split-button 'Lưu đơn thư' + caret ▼ | ⚠️ High |
| [TC-EXP-002](#tc-exp-002) | 🔴 P0 | `GREEN` | M1-SplitButton | Bấm nút chính 'Lưu đơn thư' → lưu + về danh sách (hành vi cũ) | 🚨 Critical |
| [TC-EXP-003](#tc-exp-003) | 🔴 P0 | `GREEN` | M1-SplitButton | Mở menu caret ▼ hiển thị 2 mục 'Lưu đơn thư' / 'Lưu và xuất file' | ⚠️ High |
| [TC-EXP-005](#tc-exp-005) | 🔴 P0 | `GREEN` | M1-SplitButton | Chọn 'Lưu và xuất file' trên đơn hợp lệ → lưu xong mở popup | 🚨 Critical |
| [TC-EXP-011](#tc-exp-011) | 🔴 P0 | `GREEN` | M2-Popup | Popup mở: 7 mẫu checkbox đều tick sẵn | 🚨 Critical |
| [TC-EXP-012](#tc-exp-012) | 🔴 P0 | `GREEN` | M2-Popup | Mặc định định dạng = ◉ Gộp 1 file Word | ⚠️ High |
| [TC-EXP-015](#tc-exp-015) | 🔴 P0 | `RED` | M2-Popup | Bỏ hết mẫu (0 chọn) → nút [Xuất file] disabled | ⚠️ High |
| [TC-EXP-018](#tc-exp-018) | 🔴 P0 | `GREEN` | M2-Popup | Bấm [Đóng] → đóng popup + về danh sách | ⚠️ High |
| [TC-EXP-023](#tc-exp-023) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Biên nhận (BIEN_NHAN) → docx hợp lệ | ⚠️ High |
| [TC-EXP-024](#tc-exp-024) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Phiếu đề xuất (PHIEU_DE_XUAT) → docx hợp lệ | ⚠️ High |
| [TC-EXP-025](#tc-exp-025) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Phiếu chuyển nguồn tin (PHIEU_CHUYEN_NGUON_TIN) → docx hợp lệ | ⚠️ High |
| [TC-EXP-026](#tc-exp-026) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Phiếu chuyển đơn (PHIEU_CHUYEN_DON) → docx hợp lệ | ⚠️ High |
| [TC-EXP-027](#tc-exp-027) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Thông báo chuyển đơn (THONG_BAO_CHUYEN) → docx hợp lệ | ⚠️ High |
| [TC-EXP-028](#tc-exp-028) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Thông báo hướng dẫn (THONG_BAO_HUONG_DAN) → docx hợp lệ | ⚠️ High |
| [TC-EXP-029](#tc-exp-029) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged chứa mẫu Thông báo trả lại đơn (THONG_BAO_TRA_LAI) → docx hợp lệ | ⚠️ High |
| [TC-EXP-030](#tc-exp-030) | 🔴 P0 | `GREEN` | M3-API-Merged | Export merged CẢ 7 mẫu → 1 docx, 6 ngắt trang, 1 sectPr | 🚨 Critical |
| [TC-EXP-036](#tc-exp-036) | 🔴 P0 | `GREEN` | M4-API-Zip | Export zip 7 mẫu → ZIP đúng 7 file .docx | 🚨 Critical |
| [TC-EXP-040](#tc-exp-040) | 🔴 P0 | `RED` | M5-Atomic | Đơn thiếu deXuat + chọn PHIEU_DE_XUAT → 400, KHÔNG cấp số | 🚨 Critical |
| [TC-EXP-041](#tc-exp-041) | 🔴 P0 | `RED` | M5-Atomic | Export fail giữa chừng → số văn bản KHÔNG bị tiêu (no gap) | 🚨 Critical |
| [TC-EXP-042](#tc-exp-042) | 🔴 P0 | `RED` | M5-Atomic | Đơn thiếu senderName → mọi mẫu 400 | 🚨 Critical |
| [TC-EXP-043](#tc-exp-043) | 🔴 P0 | `RED` | M5-Atomic | PHIEU_CHUYEN_NGUON_TIN thiếu lyDoChuyen/canCuPhapLy → 400 | ⚠️ High |
| [TC-EXP-044](#tc-exp-044) | 🔴 P0 | `RED` | M5-Atomic | THONG_BAO_HUONG_DAN thiếu huongDanKhoiKien → 400 | ⚠️ High |
| [TC-EXP-045](#tc-exp-045) | 🔴 P0 | `RED` | M5-Atomic | THONG_BAO_TRA_LAI thiếu lyDoTraDon → 400 | ⚠️ High |
| [TC-EXP-046](#tc-exp-046) | 🔴 P0 | `RED` | M5-Validation | docTypes rỗng [] → 400 | ⚠️ High |
| [TC-EXP-047](#tc-exp-047) | 🔴 P0 | `RED` | M5-Validation | docTypes thiếu hẳn (undefined) → 400 | ⚠️ High |
| [TC-EXP-048](#tc-exp-048) | 🔴 P0 | `RED` | M5-Validation | docType không thuộc allowlist → 400 | ⚠️ High |
| [TC-EXP-052](#tc-exp-052) | 🔴 P0 | `RED` | M5-Validation | id đơn không tồn tại → 404 | ⚠️ High |
| [TC-EXP-057](#tc-exp-057) | 🔴 P0 | `RED` | M5-Atomic | Multi-mẫu: 1 mẫu thiếu trường → CẢ request fail (không xuất phần đúng) | ⚠️ High |
| [TC-EXP-058](#tc-exp-058) | 🔴 P0 | `SECURITY` | M6-Security | Không token → 401 | 🚨 Critical |
| [TC-EXP-059](#tc-exp-059) | 🔴 P0 | `SECURITY` | M6-Security | Token hết hạn → 401 | 🚨 Critical |
| [TC-EXP-060](#tc-exp-060) | 🔴 P0 | `SECURITY` | M6-Security | Token sai chữ ký → 401 | 🚨 Critical |
| [TC-EXP-061](#tc-exp-061) | 🔴 P0 | `SECURITY` | M6-Security | User KHÔNG quyền read Petition → 403 | 🚨 Critical |
| [TC-EXP-062](#tc-exp-062) | 🔴 P0 | `SECURITY` | M6-Security | IDOR: user ngoài phạm vi dữ liệu xuất đơn tổ khác → 403/404 | ⚠️ High |
| [TC-EXP-063](#tc-exp-063) | 🔴 P0 | `SECURITY` | M6-Security | SQL injection trong id → không 500, trả 404/400 | ⚠️ High |
| [TC-EXP-064](#tc-exp-064) | 🔴 P0 | `SECURITY` | M6-Security | XSS payload trong docTypes → 400, không phản chiếu | ⚠️ High |
| [TC-EXP-065](#tc-exp-065) | 🔴 P0 | `SECURITY` | M6-Security | Path traversal trong docType → 400 (allowlist chặn) | ⚠️ High |
| [TC-EXP-066](#tc-exp-066) | 🔴 P0 | `SECURITY` | M6-Throttle | Quá 5 request/60s → 429 | ⚠️ High |
| [TC-EXP-067](#tc-exp-067) | 🔴 P0 | `SECURITY` | M6-Throttle | Sau cửa sổ 60s → request lại được phép | ⚡ Medium |
| [TC-EXP-068](#tc-exp-068) | 🔴 P0 | `SECURITY` | M6-Security | Số văn bản không suy đoán được từ response (no leak counter) | 📌 Low |
| [TC-EXP-069](#tc-exp-069) | 🔴 P0 | `SECURITY` | M6-Security | Content-Disposition filename không chứa path traversal | ⚡ Medium |
| [TC-EXP-070](#tc-exp-070) | 🔴 P0 | `SECURITY` | M7-Data | Tên người gửi ký tự đặc biệt → render an toàn (escape token) | ⚠️ High |
| [TC-EXP-088](#tc-exp-088) | 🔴 P0 | `REGRESSION` | M7-Regression | In từng (ExportDocumentDropdown ở chi tiết) vẫn hoạt động | ⚠️ High |
| [TC-EXP-089](#tc-exp-089) | 🔴 P0 | `REGRESSION` | M7-Regression | In đồng loạt (batch danh sách) vẫn hoạt động | ⚠️ High |
| [TC-EXP-091](#tc-exp-091) | 🔴 P0 | `RED` | M5-Atomic | PHIEU_CHUYEN_DON thiếu lyDoChuyen → 400 | ⚠️ High |
| [TC-EXP-111](#tc-exp-111) | 🔴 P0 | `RED` | M5-Atomic | Export lỗi giữa loop multi (mẫu 5/7 thiếu) → rollback HẾT, 0 số tiêu | 🚨 Critical |
| [TC-EXP-138](#tc-exp-138) | 🔴 P0 | `RED` | M5-Atomic | Mẫu cuối (7/7) thiếu trường → rollback cả 6 mẫu trước | 🚨 Critical |
| [TC-EXP-140](#tc-exp-140) | 🔴 P0 | `SECURITY` | M6-Security | Lỗi 4xx/5xx không lộ stacktrace/đường dẫn nội bộ | ⚡ Medium |
| [TC-EXP-141](#tc-exp-141) | 🔴 P0 | `SECURITY` | M6-Throttle | Throttle đếm riêng theo endpoint, không ảnh hưởng API khác | 📌 Low |
| [TC-EXP-158](#tc-exp-158) | 🔴 P0 | `SECURITY` | M6-Security | CORS: request từ origin lạ bị chặn theo cấu hình | 📌 Low |
| [TC-EXP-159](#tc-exp-159) | 🔴 P0 | `SECURITY` | M6-Security | Không cache file nhạy cảm (Cache-Control) | 📌 Low |
| [TC-EXP-160](#tc-exp-160) | 🔴 P0 | `SECURITY` | M6-Security | IDOR đọc-ngang: officer tổ A KHÔNG xuất được đơn tổ B (lặp xác nhận scope) | ⚠️ High |
| [TC-EXP-004](#tc-exp-004) | 🟠 P1 | `GREEN` | M1-SplitButton | Chọn menu 'Lưu đơn thư' trong dropdown = hành vi nút chính | ⚠️ High |
| [TC-EXP-006](#tc-exp-006) | 🟠 P1 | `STATE` | M1-SplitButton | Trạng thái isSubmitting → nút chính disabled chống double-submit | ⚠️ High |
| [TC-EXP-009](#tc-exp-009) | 🟠 P1 | `RED` | M1-SplitButton | 'Lưu và xuất file' khi form thiếu trường bắt buộc → báo lỗi, KHÔNG mở popup | ⚠️ High |
| [TC-EXP-013](#tc-exp-013) | 🟠 P1 | `GREEN` | M2-Popup | Nút 'Bỏ chọn tất cả' → bỏ hết 7 mẫu | ⚠️ High |
| [TC-EXP-014](#tc-exp-014) | 🟠 P1 | `GREEN` | M2-Popup | Nút 'Chọn tất cả' (sau khi bỏ hết) → tick lại 7 mẫu | ⚠️ High |
| [TC-EXP-016](#tc-exp-016) | 🟠 P1 | `GREEN` | M2-Popup | Chọn 1 mẫu duy nhất → [Xuất file] enabled | ⚠️ High |
| [TC-EXP-017](#tc-exp-017) | 🟠 P1 | `GREEN` | M2-Popup | Đổi định dạng sang ○ Tách – ZIP | ⚠️ High |
| [TC-EXP-019](#tc-exp-019) | 🟠 P1 | `GREEN` | M2-Popup | Bấm nút X góc phải → đóng popup (như Đóng) | ⚠️ High |
| [TC-EXP-021](#tc-exp-021) | 🟠 P1 | `STATE` | M2-Popup | Đang xuất (isExporting) → nút [Xuất file] disabled/loading | ⚠️ High |
| [TC-EXP-022](#tc-exp-022) | 🟠 P1 | `RED` | M2-Popup | Toggle từng checkbox cập nhật counter chính xác | ⚠️ High |
| [TC-EXP-031](#tc-exp-031) | 🟠 P1 | `GREEN` | M3-API-Merged | Merged giữ tiếng Việt có dấu trong nội dung | ⚠️ High |
| [TC-EXP-032](#tc-exp-032) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged đúng 2 mẫu → đúng 1 ngắt trang (N-1) | ⚠️ High |
| [TC-EXP-033](#tc-exp-033) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged đúng 1 mẫu → 0 ngắt trang | ⚠️ High |
| [TC-EXP-037](#tc-exp-037) | 🟠 P1 | `BOUNDARY` | M4-API-Zip | Export zip 1 mẫu → ZIP 1 entry | ⚠️ High |
| [TC-EXP-038](#tc-exp-038) | 🟠 P1 | `GREEN` | M4-API-Zip | Tên entry zip có đúng số văn bản theo series | ⚠️ High |
| [TC-EXP-049](#tc-exp-049) | 🟠 P1 | `RED` | M5-Validation | mode sai (vd 'pdf') → 400 | ⚠️ High |
| [TC-EXP-050](#tc-exp-050) | 🟠 P1 | `RED` | M5-Validation | docTypes không phải mảng (string) → 400 | ⚠️ High |
| [TC-EXP-051](#tc-exp-051) | 🟠 P1 | `RED` | M5-Validation | Phần tử docTypes là số → 400 | ⚠️ High |
| [TC-EXP-053](#tc-exp-053) | 🟠 P1 | `RED` | M5-Validation | id đơn đã xoá mềm (deletedAt) → 404 | ⚠️ High |
| [TC-EXP-056](#tc-exp-056) | 🟠 P1 | `EP` | M5-Validation | docTypes trùng nhau nhiều lần → dedupe còn unique | ⚠️ High |
| [TC-EXP-071](#tc-exp-071) | 🟠 P1 | `BOUNDARY` | M7-Data | Nội dung dài (vài nghìn ký tự) → render không cắt/lỗi | ⚠️ High |
| [TC-EXP-074](#tc-exp-074) | 🟠 P1 | `A11Y` | M7-A11y | Popup có role dialog + tiêu đề liên kết | ⚡ Medium |
| [TC-EXP-075](#tc-exp-075) | 🟠 P1 | `A11Y` | M7-A11y | Bàn phím: Tab tới được checkbox/radio/nút | ⚡ Medium |
| [TC-EXP-076](#tc-exp-076) | 🟠 P1 | `A11Y` | M7-A11y | Esc đóng popup | 📌 Low |
| [TC-EXP-080](#tc-exp-080) | 🟠 P1 | `COMPAT` | M7-Compat | Chrome desktop: full flow lưu→popup→tải | ⚡ Medium |
| [TC-EXP-081](#tc-exp-081) | 🟠 P1 | `COMPAT` | M7-Compat | Edge desktop: full flow | ⚡ Medium |
| [TC-EXP-090](#tc-exp-090) | 🟠 P1 | `REGRESSION` | M7-Regression | Endpoint export-document (đơn lẻ) cũ vẫn 200 | ⚡ Medium |
| [TC-EXP-092](#tc-exp-092) | 🟠 P1 | `RED` | M5-Validation | mode 'ZIP' viết hoa → 400 (case-sensitive) | ⚠️ High |
| [TC-EXP-093](#tc-exp-093) | 🟠 P1 | `RED` | M5-Validation | mode 'Merged' viết hoa đầu → 400 | ⚡ Medium |
| [TC-EXP-094](#tc-exp-094) | 🟠 P1 | `RED` | M5-Validation | mode chuỗi rỗng '' → 400 | ⚡ Medium |
| [TC-EXP-095](#tc-exp-095) | 🟠 P1 | `RED` | M5-Validation | docTypes chứa phần tử null → 400 | ⚠️ High |
| [TC-EXP-096](#tc-exp-096) | 🟠 P1 | `RED` | M5-Validation | docTypes chứa chuỗi rỗng '' → 400 | ⚠️ High |
| [TC-EXP-097](#tc-exp-097) | 🟠 P1 | `RED` | M5-Validation | docType có khoảng trắng ' BIEN_NHAN ' → 400 | ⚡ Medium |
| [TC-EXP-098](#tc-exp-098) | 🟠 P1 | `RED` | M5-Validation | docType sai hoa-thường 'bien_nhan' → 400 | ⚡ Medium |
| [TC-EXP-099](#tc-exp-099) | 🟠 P1 | `RED` | M5-Validation | docTypes là object {} → 400 | ⚡ Medium |
| [TC-EXP-100](#tc-exp-100) | 🟠 P1 | `RED` | M5-Validation | Body rỗng {} → 400 | ⚠️ High |
| [TC-EXP-101](#tc-exp-101) | 🟠 P1 | `RED` | M5-Validation | Không có body → 400 | ⚡ Medium |
| [TC-EXP-102](#tc-exp-102) | 🟠 P1 | `RED` | M5-Validation | Mảng trộn docType hợp lệ + sai → 400 cả request | ⚠️ High |
| [TC-EXP-114](#tc-exp-114) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged 3 mẫu → đúng 2 ngắt trang (N-1) | ⚡ Medium |
| [TC-EXP-115](#tc-exp-115) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged 4 mẫu → đúng 3 ngắt trang (N-1) | ⚡ Medium |
| [TC-EXP-116](#tc-exp-116) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged 5 mẫu → đúng 4 ngắt trang (N-1) | ⚡ Medium |
| [TC-EXP-117](#tc-exp-117) | 🟠 P1 | `BOUNDARY` | M3-API-Merged | Merged 6 mẫu → đúng 5 ngắt trang (N-1) | ⚡ Medium |
| [TC-EXP-118](#tc-exp-118) | 🟠 P1 | `EP` | M4-API-Zip | Thứ tự docTypes khác nhau cùng tập → kết quả tương đương | ⚡ Medium |
| [TC-EXP-120](#tc-exp-120) | 🟠 P1 | `EP` | M5-Validation | docTypes lặp 50 lần 1 mẫu → dedupe còn 1 | ⚡ Medium |
| [TC-EXP-144](#tc-exp-144) | 🟠 P1 | `EP` | M4-API-Zip | Tập mẫu con (3 mẫu) → ZIP đúng 3 entry | ⚡ Medium |
| [TC-EXP-007](#tc-exp-007) | 🟡 P2 | `STATE` | M1-SplitButton | Click ngoài menu caret đang mở → menu đóng | ⚠️ High |
| [TC-EXP-008](#tc-exp-008) | 🟡 P2 | `BOUNDARY` | M1-SplitButton | Form sửa (edit) → nút chính nhãn 'Cập nhật' vẫn có caret xuất file | ⚠️ High |
| [TC-EXP-010](#tc-exp-010) | 🟡 P2 | `RED` | M1-SplitButton | Nhấn Enter trong form → submit = 'Lưu đơn thư' (không mở popup) | ⚠️ High |
| [TC-EXP-020](#tc-exp-020) | 🟡 P2 | `BOUNDARY` | M2-Popup | Mỗi mẫu hiển thị nhãn + mô tả đúng | ⚠️ High |
| [TC-EXP-034](#tc-exp-034) | 🟡 P2 | `EP` | M3-API-Merged | mode bỏ trống → mặc định 'merged' | ⚠️ High |
| [TC-EXP-035](#tc-exp-035) | 🟡 P2 | `PERFORMANCE` | M3-API-Merged | Export merged 7 mẫu < 3s | ⚡ Medium |
| [TC-EXP-039](#tc-exp-039) | 🟡 P2 | `EP` | M4-API-Zip | docTypes trùng lặp → dedupe, không tạo entry trùng | ⚠️ High |
| [TC-EXP-054](#tc-exp-054) | 🟡 P2 | `RED` | M5-Validation | Body JSON sai cú pháp → 400 | ⚡ Medium |
| [TC-EXP-055](#tc-exp-055) | 🟡 P2 | `RED` | M5-Validation | Content-Type không phải JSON → 400/415 | ⚡ Medium |
| [TC-EXP-072](#tc-exp-072) | 🟡 P2 | `DATA` | M7-Data | Nội dung xuống dòng nhiều đoạn → giữ định dạng linebreaks | ⚡ Medium |
| [TC-EXP-073](#tc-exp-073) | 🟡 P2 | `DATA` | M7-Data | Số văn bản tăng tuần tự đúng series mỗi mẫu | ⚠️ High |
| [TC-EXP-077](#tc-exp-077) | 🟡 P2 | `A11Y` | M7-A11y | Caret split-button có aria-haspopup/expanded | 📌 Low |
| [TC-EXP-078](#tc-exp-078) | 🟡 P2 | `A11Y` | M7-A11y | Checkbox có nhãn liên kết (label-for) | 📌 Low |
| [TC-EXP-079](#tc-exp-079) | 🟡 P2 | `A11Y` | M7-A11y | Contrast nút/tiêu đề đạt WCAG AA | 📌 Low |
| [TC-EXP-082](#tc-exp-082) | 🟡 P2 | `COMPAT` | M7-Compat | Firefox desktop: popup render + tải file | 📌 Low |
| [TC-EXP-083](#tc-exp-083) | 🟡 P2 | `COMPAT` | M7-Compat | File .docx mở được trên MS Word | ⚡ Medium |
| [TC-EXP-084](#tc-exp-084) | 🟡 P2 | `COMPAT` | M7-Compat | File .docx mở được trên LibreOffice/Google Docs | 📌 Low |
| [TC-EXP-085](#tc-exp-085) | 🟡 P2 | `COMPAT` | M7-Compat | ZIP giải nén được bằng Windows Explorer + 7-Zip | 📌 Low |
| [TC-EXP-086](#tc-exp-086) | 🟡 P2 | `PERFORMANCE` | M7-Perf | Export zip 7 mẫu < 3s | ⚡ Medium |
| [TC-EXP-087](#tc-exp-087) | 🟡 P2 | `PERFORMANCE` | M7-Perf | 2 user export đồng thời cùng đơn không deadlock | ⚠️ High |
| [TC-EXP-103](#tc-exp-103) | 🟡 P2 | `RED` | M5-Validation | Trường lạ thừa trong body → bỏ qua hoặc 400 (whitelist) | 📌 Low |
| [TC-EXP-104](#tc-exp-104) | 🟡 P2 | `RED` | M6-Security | Header 'Bearer ' rỗng token → 401 | ⚠️ High |
| [TC-EXP-105](#tc-exp-105) | 🟡 P2 | `RED` | M6-Security | Authorization thiếu prefix 'Bearer' → 401 | ⚠️ High |
| [TC-EXP-106](#tc-exp-106) | 🟡 P2 | `RED` | M5-Validation | Sai HTTP method GET → 404/405 | 📌 Low |
| [TC-EXP-107](#tc-exp-107) | 🟡 P2 | `RED` | M5-Validation | Sai HTTP method PUT → 404/405 | 📌 Low |
| [TC-EXP-108](#tc-exp-108) | 🟡 P2 | `RED` | M5-Validation | id chứa khoảng trắng → 404 | 📌 Low |
| [TC-EXP-109](#tc-exp-109) | 🟡 P2 | `RED` | M5-Validation | id rỗng → 404/400 | 📌 Low |
| [TC-EXP-110](#tc-exp-110) | 🟡 P2 | `RED` | M5-Atomic | Đơn đã chuyển thành vụ việc/vụ án vẫn export được (chỉ cần trường mẫu) | ⚡ Medium |
| [TC-EXP-112](#tc-exp-112) | 🟡 P2 | `RED` | M2-Popup | Lỗi export (server 500 giả lập) → popup hiện message, KHÔNG đóng/điều hướng | ⚠️ High |
| [TC-EXP-113](#tc-exp-113) | 🟡 P2 | `RED` | M2-Popup | Mất mạng khi tải file → báo lỗi, không treo | ⚡ Medium |
| [TC-EXP-119](#tc-exp-119) | 🟡 P2 | `EP` | M3-API-Merged | mode 'merged' và mode mặc định → cùng kết quả gộp | 📌 Low |
| [TC-EXP-121](#tc-exp-121) | 🟡 P2 | `BOUNDARY` | M5-Atomic | Số văn bản nhiều chữ số (rollover series) định dạng đúng | 📌 Low |
| [TC-EXP-122](#tc-exp-122) | 🟡 P2 | `EP` | M4-API-Zip | Tên file ZIP gốc 'ChungTu_<ngày>.zip' đúng định dạng | 📌 Low |
| [TC-EXP-123](#tc-exp-123) | 🟡 P2 | `EP` | M3-API-Merged | Tên file merged 'ChungTu_<ngày>.docx' đúng | 📌 Low |
| [TC-EXP-124](#tc-exp-124) | 🟡 P2 | `RED` | M6-Security | Authorization Basic thay vì Bearer → 401 | 📌 Low |
| [TC-EXP-125](#tc-exp-125) | 🟡 P2 | `RED` | M6-Security | Token của user đã bị xoá → 401 | ⚡ Medium |
| [TC-EXP-126](#tc-exp-126) | 🟡 P2 | `RED` | M5-Validation | mode có khoảng trắng đuôi 'merged ' → 400 | 📌 Low |
| [TC-EXP-127](#tc-exp-127) | 🟡 P2 | `RED` | M5-Validation | docTypes lồng mảng [[..]] → 400 | 📌 Low |
| [TC-EXP-128](#tc-exp-128) | 🟡 P2 | `RED` | M5-Validation | docTypes boolean → 400 | 📌 Low |
| [TC-EXP-129](#tc-exp-129) | 🟡 P2 | `RED` | M5-Validation | mode kiểu số → 400 | 📌 Low |
| [TC-EXP-130](#tc-exp-130) | 🟡 P2 | `RED` | M5-Validation | Body là mảng gốc [] thay vì object → 400 | 📌 Low |
| [TC-EXP-131](#tc-exp-131) | 🟡 P2 | `RED` | M5-Validation | id rất dài (1000 ký tự) → 404/400, không 500 | 📌 Low |
| [TC-EXP-132](#tc-exp-132) | 🟡 P2 | `RED` | M5-Validation | Double slash trong path → 404 | 📌 Low |
| [TC-EXP-133](#tc-exp-133) | 🟡 P2 | `RED` | M5-Validation | 8 docType (7 hợp lệ + 1 sai) → 400 | ⚡ Medium |
| [TC-EXP-134](#tc-exp-134) | 🟡 P2 | `RED` | M5-Validation | 1000 phần tử docTypes → 400 hoặc xử lý an toàn | 📌 Low |
| [TC-EXP-135](#tc-exp-135) | 🟡 P2 | `RED` | M5-Atomic | Export ngay sau khi xoá đơn (race) → 404 | ⚡ Medium |
| [TC-EXP-136](#tc-exp-136) | 🟡 P2 | `RED` | M6-Security | JWT alg=none → 401 | ⚠️ High |
| [TC-EXP-137](#tc-exp-137) | 🟡 P2 | `RED` | M6-Security | Token sửa payload nâng role → vẫn 401 (sai chữ ký) | ⚠️ High |
| [TC-EXP-139](#tc-exp-139) | 🟡 P2 | `RED` | M2-Popup | Bấm 'Xuất file' 2 lần nhanh → chỉ 1 request (chống double) | ⚡ Medium |
| [TC-EXP-142](#tc-exp-142) | 🟡 P2 | `BOUNDARY` | M6-Throttle | Đúng request thứ 5 trong 60s vẫn 201 (biên trong hạn) | ⚡ Medium |
| [TC-EXP-143](#tc-exp-143) | 🟡 P2 | `EP` | M3-API-Merged | Tập mẫu con bất kỳ (vd 4 mẫu) → merged đủ 4 phần | ⚡ Medium |
| [TC-EXP-145](#tc-exp-145) | 🟡 P2 | `A11Y` | M2-Popup | Đóng popup → focus trả về nút đã mở | 📌 Low |
| [TC-EXP-146](#tc-exp-146) | 🟡 P2 | `A11Y` | M2-Popup | Screen reader đọc tiêu đề + số mẫu đã chọn | 📌 Low |
| [TC-EXP-147](#tc-exp-147) | 🟡 P2 | `COMPAT` | M2-Popup | Mobile viewport: popup cuộn được, nút không bị che | ⚡ Medium |
| [TC-EXP-148](#tc-exp-148) | 🟡 P2 | `COMPAT` | M7-Compat | ZIP entry tên tiếng Việt mở đúng trên macOS | 📌 Low |
| [TC-EXP-149](#tc-exp-149) | 🟡 P2 | `PERFORMANCE` | M7-Perf | Nội dung lớn không gây OOM/treo server | ⚡ Medium |
| [TC-EXP-150](#tc-exp-150) | 🟡 P2 | `RED` | M6-Throttle | 6 request đồng thời (burst) → ≥1 trả 429 | ⚡ Medium |
| [TC-EXP-151](#tc-exp-151) | 🟡 P2 | `RED` | M5-Validation | mode='zip' nhưng docTypes rỗng → 400 | ⚡ Medium |
| [TC-EXP-152](#tc-exp-152) | 🟡 P2 | `RED` | M5-Validation | docTypes có phần tử số lẫn chuỗi → 400 | 📌 Low |
| [TC-EXP-153](#tc-exp-153) | 🟡 P2 | `RED` | M5-Validation | Header Content-Length sai (rỗng body khai báo có) → 400 | 📌 Low |
| [TC-EXP-154](#tc-exp-154) | 🟡 P2 | `RED` | M5-Atomic | Export khi đơn vừa bị user khác sửa (stale) → vẫn dùng data mới nhất | ⚡ Medium |
| [TC-EXP-155](#tc-exp-155) | 🟡 P2 | `RED` | M2-Popup | Token hết hạn ngay lúc bấm 'Xuất file' → 401, popup báo lỗi | ⚡ Medium |
| [TC-EXP-156](#tc-exp-156) | 🟡 P2 | `RED` | M2-Popup | 429 khi bấm 'Xuất file' → popup báo 'thử lại sau', không đóng | ⚡ Medium |
| [TC-EXP-157](#tc-exp-157) | 🟡 P2 | `RED` | M5-Validation | docType hợp lệ nhưng template file thiếu trên server → 500 có kiểm soát | ⚠️ High |
| [TC-EXP-161](#tc-exp-161) | 🟡 P2 | `BOUNDARY` | M3-API-Merged | Merged khi chỉ 2 trong 7 mẫu đủ trường, chọn đúng 2 → 201 | ⚡ Medium |
| [TC-EXP-162](#tc-exp-162) | 🟡 P2 | `EP` | M4-API-Zip | Re-export cùng đơn → số văn bản MỚI mỗi lần (không cache) | ⚡ Medium |
| [TC-EXP-163](#tc-exp-163) | 🟡 P2 | `EP` | M3-API-Merged | Export phản ánh data sau khi sửa đơn | ⚡ Medium |
| [TC-EXP-164](#tc-exp-164) | 🟡 P2 | `BOUNDARY` | M5-Atomic | Đơn nặc danh (senderName ẩn) — mẫu cần senderName → 400 đúng quy tắc | ⚡ Medium |
| [TC-EXP-165](#tc-exp-165) | 🟡 P2 | `PERFORMANCE` | M7-Perf | 10 lần export tuần tự không rò bộ nhớ | 📌 Low |
| [TC-EXP-166](#tc-exp-166) | 🟡 P2 | `PERFORMANCE` | M7-Perf | Lock FOR UPDATE không giữ quá lâu (release sau tx) | ⚡ Medium |
| [TC-EXP-167](#tc-exp-167) | 🟡 P2 | `A11Y` | M1-SplitButton | Caret điều hướng menu bằng phím mũi tên | 📌 Low |
| [TC-EXP-168](#tc-exp-168) | 🟡 P2 | `COMPAT` | M7-Compat | Tải file hoạt động khi trình duyệt chặn popup | ⚡ Medium |

## 📝 Test Cases chi tiết

---

## TC-EXP-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form đơn thư hiển thị split-button 'Lưu đơn thư' + caret ▼

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở /petitions/new
- [ ] Quan sát góc phải header form

### Kết quả mong đợi
- Hiện nút chính 'Lưu đơn thư' (xanh) + nút caret ▼ 'Tuỳ chọn lưu' liền kề.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-001
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Bấm nút chính 'Lưu đơn thư' → lưu + về danh sách (hành vi cũ)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở /petitions/new, nhập đủ trường bắt buộc
- [ ] Bấm nút chính 'Lưu đơn thư'

### Kết quả mong đợi
- Đơn được tạo (201); điều hướng về /petitions; KHÔNG mở popup xuất file.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-002
severity: Critical
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mở menu caret ▼ hiển thị 2 mục 'Lưu đơn thư' / 'Lưu và xuất file'

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở form đơn thư
- [ ] Bấm caret ▼ 'Tuỳ chọn lưu'

### Kết quả mong đợi
- Menu xổ xuống 2 menuitem: 'Lưu đơn thư' và 'Lưu và xuất file'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-003
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-005

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Chọn 'Lưu và xuất file' trên đơn hợp lệ → lưu xong mở popup

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở đơn đủ trường (edit)
- [ ] Caret ▼ → 'Lưu và xuất file'

### Kết quả mong đợi
- Đơn được lưu (PATCH 200); popup 'Xuất chứng từ' mở; KHÔNG điều hướng ngay.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-005
severity: Critical
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-011

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Popup mở: 7 mẫu checkbox đều tick sẵn

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] 'Lưu và xuất file' trên đơn đủ trường
- [ ] Quan sát danh sách mẫu

### Kết quả mong đợi
- Popup 'Xuất chứng từ' hiện đúng 7 mẫu, tất cả checkbox [checked]; counter 'Đã chọn 7/7 mẫu'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-011
severity: Critical
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-012

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mặc định định dạng = ◉ Gộp 1 file Word

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Quan sát 2 radio định dạng

### Kết quả mong đợi
- Radio 'Gộp 1 file Word' [checked]; 'Tách – file ZIP' không chọn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-012
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-015

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bỏ hết mẫu (0 chọn) → nút [Xuất file] disabled

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Bỏ chọn tất cả

### Kết quả mong đợi
- Nút 'Xuất file' bị disabled khi 0 mẫu được chọn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-015
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-018

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bấm [Đóng] → đóng popup + về danh sách

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup (sau lưu)
- [ ] Bấm 'Đóng'

### Kết quả mong đợi
- Popup đóng; điều hướng về /petitions.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-018
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-023

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Biên nhận (BIEN_NHAN) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[BIEN_NHAN],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["BIEN_NHAN"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Biên nhận; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-023
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-024

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Phiếu đề xuất (PHIEU_DE_XUAT) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[PHIEU_DE_XUAT],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["PHIEU_DE_XUAT"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Phiếu đề xuất; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-024
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-025

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Phiếu chuyển nguồn tin (PHIEU_CHUYEN_NGUON_TIN) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[PHIEU_CHUYEN_NGUON_TIN],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["PHIEU_CHUYEN_NGUON_TIN"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Phiếu chuyển nguồn tin; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-025
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-026

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Phiếu chuyển đơn (PHIEU_CHUYEN_DON) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[PHIEU_CHUYEN_DON],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["PHIEU_CHUYEN_DON"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Phiếu chuyển đơn; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-026
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-027

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Thông báo chuyển đơn (THONG_BAO_CHUYEN) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[THONG_BAO_CHUYEN],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["THONG_BAO_CHUYEN"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Thông báo chuyển đơn; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-027
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-028

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Thông báo hướng dẫn (THONG_BAO_HUONG_DAN) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[THONG_BAO_HUONG_DAN],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["THONG_BAO_HUONG_DAN"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Thông báo hướng dẫn; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-028
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-029

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export merged chứa mẫu Thông báo trả lại đơn (THONG_BAO_TRA_LAI) → docx hợp lệ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[THONG_BAO_TRA_LAI],mode:merged}
- [ ] Lưu file .docx

### Dữ liệu kiểm thử
```
{"docTypes":["THONG_BAO_TRA_LAI"],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; file .docx hợp lệ (mở được); chứa nội dung mẫu Thông báo trả lại đơn; cấp 1 số văn bản.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-029
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-030

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export merged CẢ 7 mẫu → 1 docx, 6 ngắt trang, 1 sectPr

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body 7 docTypes, mode=merged
- [ ] Giải nén word/document.xml

### Dữ liệu kiểm thử
```
{"docTypes":[7 mẫu],"mode":"merged"}
```

### Kết quả mong đợi
- HTTP 201; 1 file .docx; đúng 6 ngắt trang (<w:br w:type='page'/>) = N-1; đúng 1 <w:sectPr> cuối.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-030
severity: Critical
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-036

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export zip 7 mẫu → ZIP đúng 7 file .docx

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents 7 docTypes, mode=zip
- [ ] Liệt kê entry zip

### Dữ liệu kiểm thử
```
{"docTypes":[7 mẫu],"mode":"zip"}
```

### Kết quả mong đợi
- HTTP 201; ZIP hợp lệ; đúng 7 entry .docx; mỗi tên file chứa số văn bản (vd 00013BN).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-036
severity: Critical
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-040

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thiếu deXuat + chọn PHIEU_DE_XUAT → 400, KHÔNG cấp số

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN, PHIEU_DE_XUAT] trên đơn KHÔNG có deXuat

### Kết quả mong đợi
- HTTP 400 (thiếu trường); KHÔNG file; KHÔNG cấp số văn bản nào (cả BIEN_NHAN).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-040
severity: Critical
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-041

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export fail giữa chừng → số văn bản KHÔNG bị tiêu (no gap)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export BIEN_NHAN (số N)
- [ ] Export 1 request fail (400)
- [ ] Export BIEN_NHAN lại (số M)

### Kết quả mong đợi
- M = N+1 (chênh đúng 1); request fail KHÔNG tiêu số → không gap số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-041
severity: Critical
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-042

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Đơn thiếu senderName → mọi mẫu 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN] trên đơn senderName rỗng

### Kết quả mong đợi
- HTTP 400 (thiếu senderName); không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-042
severity: Critical
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-043

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PHIEU_CHUYEN_NGUON_TIN thiếu lyDoChuyen/canCuPhapLy → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [PHIEU_CHUYEN_NGUON_TIN] đơn thiếu lyDoChuyen

### Kết quả mong đợi
- HTTP 400 báo thiếu trường; không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-043
severity: High
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-044

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: THONG_BAO_HUONG_DAN thiếu huongDanKhoiKien → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [THONG_BAO_HUONG_DAN] đơn thiếu huongDanKhoiKien

### Kết quả mong đợi
- HTTP 400; không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-044
severity: High
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-045

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: THONG_BAO_TRA_LAI thiếu lyDoTraDon → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [THONG_BAO_TRA_LAI] đơn thiếu lyDoTraDon

### Kết quả mong đợi
- HTTP 400; không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-045
severity: High
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-046

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes rỗng [] → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[],mode:merged}

### Kết quả mong đợi
- HTTP 400 (ArrayNotEmpty).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-046
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-047

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes thiếu hẳn (undefined) → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {mode:merged}

### Kết quả mong đợi
- HTTP 400 (docTypes bắt buộc).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-047
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-048

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docType không thuộc allowlist → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:["HACKED"],mode:merged}

### Kết quả mong đợi
- HTTP 400 (@IsIn DOCUMENT_TYPES).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-048
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-052

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: id đơn không tồn tại → 404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents với id='khong-ton-tai'

### Kết quả mong đợi
- HTTP 404 (đơn không tồn tại).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-052
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-057

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DECISION`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Multi-mẫu: 1 mẫu thiếu trường → CẢ request fail (không xuất phần đúng)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN(ok), PHIEU_DE_XUAT(thiếu)]

### Kết quả mong đợi
- HTTP 400 toàn request; KHÔNG trả file chứa riêng BIEN_NHAN.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-057
severity: High
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-058

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Không token → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents không Authorization header

### Kết quả mong đợi
- HTTP 401 Unauthorized.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-058
severity: Critical
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-059

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Token hết hạn → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents với JWT expired

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-059
severity: Critical
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-060

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Token sai chữ ký → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents với JWT bịa chữ ký

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-060
severity: Critical
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-061

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User KHÔNG quyền read Petition → 403

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Login user thiếu quyền
- [ ] POST /api/v1/petitions/:id/export-documents

### Kết quả mong đợi
- HTTP 403 Forbidden (RequirePermissions read Petition).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-061
severity: Critical
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-062

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: IDOR: user ngoài phạm vi dữ liệu xuất đơn tổ khác → 403/404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Login điều tra viên tổ A
- [ ] POST export đơn của tổ B

### Kết quả mong đợi
- HTTP 403/404 (DataScope chặn); không lộ file.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-062
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-063

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: SQL injection trong id → không 500, trả 404/400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents id="1' OR '1'='1"

### Kết quả mong đợi
- Không 500; trả 404/400; không lộ lỗi DB.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-063
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-064

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: XSS payload trong docTypes → 400, không phản chiếu

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents docTypes ["<script>alert(1)</script>"]

### Kết quả mong đợi
- HTTP 400; payload không phản chiếu thô.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-064
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-065

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Path traversal trong docType → 400 (allowlist chặn)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes ["../../etc/passwd"]

### Kết quả mong đợi
- HTTP 400 (không thuộc allowlist).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-065
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-066

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Throttle`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Quá 5 request/60s → 429

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Gọi /api/v1/petitions/:id/export-documents 6 lần liên tiếp <60s

### Kết quả mong đợi
- Request thứ 6 trả HTTP 429 Too Many Requests.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Throttle`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Throttle`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-066
severity: High
module: M6-Throttle
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-067

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Throttle`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Sau cửa sổ 60s → request lại được phép

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bị 429
- [ ] Chờ >60s
- [ ] Gọi lại

### Kết quả mong đợi
- HTTP 201 (throttle reset).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Throttle`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Throttle`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-067
severity: Medium
module: M6-Throttle
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-068

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Số văn bản không suy đoán được từ response (no leak counter)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export 1 mẫu
- [ ] Kiểm header/response

### Kết quả mong đợi
- Không lộ thông tin nội bộ ngoài số văn bản hợp lệ; không stacktrace.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-068
severity: Low
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-069

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Content-Disposition filename không chứa path traversal

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export
- [ ] Đọc header Content-Disposition

### Kết quả mong đợi
- Filename đã sanitize (RFC 5987), không ../ ; an toàn khi lưu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-069
severity: Medium
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-070

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M7-Data`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DATA`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tên người gửi ký tự đặc biệt → render an toàn (escape token)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn senderName chứa { } < > &
- [ ] Export merged

### Kết quả mong đợi
- HTTP 201; docx không vỡ; token người dùng được escape, không lỗi docxtemplater.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Data`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-070
severity: High
module: M7-Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-088

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: `M7-Regression`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `REGRESSION`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: In từng (ExportDocumentDropdown ở chi tiết) vẫn hoạt động

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở chi tiết đơn
- [ ] Dùng dropdown in từng mẫu cũ

### Kết quả mong đợi
- Chức năng in từng cũ KHÔNG hồi quy.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-088
severity: High
module: M7-Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-089

**Meta**:
- Loại: `REGRESSION`
- Priority: `P0` 🔴
- Module: `M7-Regression`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `REGRESSION`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: In đồng loạt (batch danh sách) vẫn hoạt động

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Màn danh sách
- [ ] In đồng loạt nhiều đơn

### Kết quả mong đợi
- Chức năng batch cũ KHÔNG hồi quy.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-089
severity: High
module: M7-Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-091

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: PHIEU_CHUYEN_DON thiếu lyDoChuyen → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [PHIEU_CHUYEN_DON] đơn thiếu lyDoChuyen

### Kết quả mong đợi
- HTTP 400; không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-091
severity: High
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-111

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DECISION`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Export lỗi giữa loop multi (mẫu 5/7 thiếu) → rollback HẾT, 0 số tiêu

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn thiếu huongDanKhoiKien
- [ ] POST 7 mẫu merged

### Kết quả mong đợi
- HTTP 400; KHÔNG mẫu nào (kể cả 4 mẫu trước) cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-111
severity: Critical
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-138

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DECISION`
- Risk: `High`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Mẫu cuối (7/7) thiếu trường → rollback cả 6 mẫu trước

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn thiếu lyDoTraDon
- [ ] POST 7 mẫu

### Kết quả mong đợi
- HTTP 400; 0 số tiêu (6 mẫu trước rollback).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-138
severity: Critical
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-140

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Lỗi 4xx/5xx không lộ stacktrace/đường dẫn nội bộ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Trigger 400/404
- [ ] Đọc body

### Kết quả mong đợi
- Body chỉ message nghiệp vụ; không stacktrace/path server.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-140
severity: Medium
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-141

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Throttle`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Throttle đếm riêng theo endpoint, không ảnh hưởng API khác

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bị 429 export
- [ ] Gọi GET petitions

### Kết quả mong đợi
- GET petitions vẫn 200 (throttle theo route).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Throttle`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Throttle`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-141
severity: Low
module: M6-Throttle
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-158

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: CORS: request từ origin lạ bị chặn theo cấu hình

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST từ origin ngoài allowlist

### Kết quả mong đợi
- Bị chặn theo CORS policy.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-158
severity: Low
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-159

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Không cache file nhạy cảm (Cache-Control)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đọc header response file

### Kết quả mong đợi
- Header không cho cache công khai file chứa thông tin đơn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-159
severity: Low
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-160

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `SECURITY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: IDOR đọc-ngang: officer tổ A KHÔNG xuất được đơn tổ B (lặp xác nhận scope)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] officer A POST export đơn B

### Kết quả mong đợi
- HTTP 403/404; DataScope chặn triệt để.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-160
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-004

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chọn menu 'Lưu đơn thư' trong dropdown = hành vi nút chính

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở caret ▼
- [ ] Click menuitem 'Lưu đơn thư'

### Kết quả mong đợi
- Lưu đơn + về /petitions; không mở popup.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-004
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-006

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `STATE`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Trạng thái isSubmitting → nút chính disabled chống double-submit

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bấm 'Lưu đơn thư'
- [ ] Trong lúc đang lưu, quan sát nút

### Kết quả mong đợi
- Nút chính disabled khi isSubmitting=true; không gửi 2 request.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-006
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-009

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: 'Lưu và xuất file' khi form thiếu trường bắt buộc → báo lỗi, KHÔNG mở popup

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở /petitions/new để trống Họ tên
- [ ] Caret ▼ → 'Lưu và xuất file'

### Kết quả mong đợi
- Hiện lỗi validation form (Họ tên bắt buộc); KHÔNG lưu; KHÔNG mở popup.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-009
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-013

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Nút 'Bỏ chọn tất cả' → bỏ hết 7 mẫu

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup (7 tick)
- [ ] Bấm 'Bỏ chọn tất cả'

### Kết quả mong đợi
- Cả 7 checkbox bỏ tick; counter 'Đã chọn 0/7'; nhãn nút đổi 'Chọn tất cả'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-013
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-014

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Nút 'Chọn tất cả' (sau khi bỏ hết) → tick lại 7 mẫu

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bỏ chọn tất cả
- [ ] Bấm 'Chọn tất cả'

### Kết quả mong đợi
- Cả 7 checkbox tick lại; counter 'Đã chọn 7/7'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-014
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-016

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chọn 1 mẫu duy nhất → [Xuất file] enabled

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bỏ chọn tất cả
- [ ] Tick 1 mẫu BIEN_NHAN

### Kết quả mong đợi
- Nút 'Xuất file' enabled; counter 'Đã chọn 1/7'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-016
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-017

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đổi định dạng sang ○ Tách – ZIP

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Click radio 'Tách – file ZIP'

### Kết quả mong đợi
- Radio ZIP [checked], Gộp bỏ chọn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-017
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-019

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Bấm nút X góc phải → đóng popup (như Đóng)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Bấm icon X

### Kết quả mong đợi
- Popup đóng; về /petitions.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-019
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-021

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `STATE`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Đang xuất (isExporting) → nút [Xuất file] disabled/loading

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bấm 'Xuất file'
- [ ] Quan sát nút trong lúc tải

### Kết quả mong đợi
- Nút 'Xuất file' disabled/hiện trạng thái đang xử lý; chống bấm nhiều lần.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-021
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-022

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DECISION`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Toggle từng checkbox cập nhật counter chính xác

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup (7/7)
- [ ] Bỏ tick 3 mẫu lần lượt

### Kết quả mong đợi
- Counter giảm dần 7→6→5→4; [Xuất file] vẫn enabled (>0).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-022
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-031

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merged giữ tiếng Việt có dấu trong nội dung

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export merged đơn có tên 'Nguyễn Văn QA'
- [ ] Đọc document.xml

### Kết quả mong đợi
- Văn bản giữ nguyên dấu tiếng Việt (UTF-8), không lỗi mojibake.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-031
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-032

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merged đúng 2 mẫu → đúng 1 ngắt trang (N-1)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN, PHIEU_DE_XUAT]

### Kết quả mong đợi
- HTTP 201; document.xml có đúng 1 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-032
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-033

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Merged đúng 1 mẫu → 0 ngắt trang

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN]

### Kết quả mong đợi
- HTTP 201; 0 ngắt trang; 1 sectPr; file mở được.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-033
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-037

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Export zip 1 mẫu → ZIP 1 entry

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST zip [BIEN_NHAN]

### Kết quả mong đợi
- HTTP 201; ZIP 1 entry .docx; mở được.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-037
severity: High
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-038

**Meta**:
- Loại: `GREEN`
- Priority: `P1` 🟠
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `GREEN`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Tên entry zip có đúng số văn bản theo series

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export zip 7 mẫu
- [ ] Đọc tên các entry

### Kết quả mong đợi
- Mỗi entry tên dạng <CODE>_<số><series>-PC02-Đ1.docx (BN/ĐX/PC/TB/HD).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-038
severity: High
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-049

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: mode sai (vd 'pdf') → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[BIEN_NHAN],mode:"pdf"}

### Kết quả mong đợi
- HTTP 400 (@IsIn ['merged','zip']).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-049
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-050

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes không phải mảng (string) → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:"BIEN_NHAN",mode:merged}

### Kết quả mong đợi
- HTTP 400 (@IsArray).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-050
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-051

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Phần tử docTypes là số → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {docTypes:[123],mode:merged}

### Kết quả mong đợi
- HTTP 400 (@IsString each).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-051
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-053

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: id đơn đã xoá mềm (deletedAt) → 404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST export trên đơn đã soft-delete

### Kết quả mong đợi
- HTTP 404.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-053
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-056

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes trùng nhau nhiều lần → dedupe còn unique

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged [BIEN_NHAN, BIEN_NHAN, BIEN_NHAN]

### Kết quả mong đợi
- HTTP 201; chỉ render 1 mẫu unique.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-056
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-071

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M7-Data`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DATA`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Nội dung dài (vài nghìn ký tự) → render không cắt/lỗi

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn summary dài 5000 ký tự
- [ ] Export

### Kết quả mong đợi
- HTTP 201; nội dung đầy đủ trong docx.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Data`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-071
severity: High
module: M7-Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-074

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Popup có role dialog + tiêu đề liên kết

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Kiểm DOM aria

### Kết quả mong đợi
- Popup có vai trò dialog; tiêu đề 'Xuất chứng từ' gắn aria-label/labelledby.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-074
severity: Medium
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-075

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bàn phím: Tab tới được checkbox/radio/nút

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Tab qua các control

### Kết quả mong đợi
- Tab tới đủ 7 checkbox, 2 radio, [Xuất file], [Đóng]; focus thấy rõ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-075
severity: Medium
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-076

**Meta**:
- Loại: `A11Y`
- Priority: `P1` 🟠
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `High`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Esc đóng popup

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Nhấn Esc

### Kết quả mong đợi
- Popup đóng (nếu hỗ trợ) hoặc focus-trap giữ trong dialog.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-076
severity: Low
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-080

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Chrome desktop: full flow lưu→popup→tải

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Chrome
- [ ] Lưu và xuất file → tải

### Kết quả mong đợi
- Hoạt động đúng trên Chrome mới nhất.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-080
severity: Medium
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-081

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Edge desktop: full flow

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Edge
- [ ] Full flow

### Kết quả mong đợi
- Hoạt động đúng trên Edge.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-081
severity: Medium
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-090

**Meta**:
- Loại: `REGRESSION`
- Priority: `P1` 🟠
- Module: `M7-Regression`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `REGRESSION`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Endpoint export-document (đơn lẻ) cũ vẫn 200

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] GET :id/export-document như cũ

### Kết quả mong đợi
- Vẫn trả 1 docx như trước; không hồi quy.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Regression`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Regression`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-090
severity: Medium
module: M7-Regression
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-092

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: mode 'ZIP' viết hoa → 400 (case-sensitive)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents mode="ZIP"

### Kết quả mong đợi
- HTTP 400 (@IsIn lowercase).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-092
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-093

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: mode 'Merged' viết hoa đầu → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST mode="Merged"

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-093
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-094

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: mode chuỗi rỗng '' → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST mode=""

### Kết quả mong đợi
- HTTP 400 (không thuộc enum).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-094
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-095

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes chứa phần tử null → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes [null]

### Kết quả mong đợi
- HTTP 400 (@IsString each).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-095
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-096

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes chứa chuỗi rỗng '' → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes [""]

### Kết quả mong đợi
- HTTP 400 (không thuộc allowlist).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-096
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-097

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: docType có khoảng trắng ' BIEN_NHAN ' → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes [" BIEN_NHAN "]

### Kết quả mong đợi
- HTTP 400 (không khớp allowlist).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-097
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-098

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: docType sai hoa-thường 'bien_nhan' → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes ["bien_nhan"]

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-098
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-099

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: docTypes là object {} → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes {}

### Kết quả mong đợi
- HTTP 400 (@IsArray).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-099
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-100

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Body rỗng {} → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body {}

### Kết quả mong đợi
- HTTP 400 (docTypes bắt buộc).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-100
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-101

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Không có body → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents không body

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-101
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-102

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `High`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mảng trộn docType hợp lệ + sai → 400 cả request

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes ["BIEN_NHAN","XXX"]

### Kết quả mong đợi
- HTTP 400 (1 phần tử sai → fail).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-102
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-114

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Merged 3 mẫu → đúng 2 ngắt trang (N-1)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged 3 docTypes

### Kết quả mong đợi
- HTTP 201; document.xml có đúng 2 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-114
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-115

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Merged 4 mẫu → đúng 3 ngắt trang (N-1)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged 4 docTypes

### Kết quả mong đợi
- HTTP 201; document.xml có đúng 3 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-115
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-116

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Merged 5 mẫu → đúng 4 ngắt trang (N-1)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged 5 docTypes

### Kết quả mong đợi
- HTTP 201; document.xml có đúng 4 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-116
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-117

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Merged 6 mẫu → đúng 5 ngắt trang (N-1)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST merged 6 docTypes

### Kết quả mong đợi
- HTTP 201; document.xml có đúng 5 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-117
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-118

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Thứ tự docTypes khác nhau cùng tập → kết quả tương đương

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [A,B] và [B,A]

### Kết quả mong đợi
- Cả 2 trả ZIP đủ 2 mẫu (tập như nhau).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-118
severity: Medium
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-120

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: docTypes lặp 50 lần 1 mẫu → dedupe còn 1

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST [BIEN_NHAN ×50]

### Kết quả mong đợi
- HTTP 201; chỉ 1 mẫu render.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-120
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-144

**Meta**:
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `High`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tập mẫu con (3 mẫu) → ZIP đúng 3 entry

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST zip 3 mẫu

### Kết quả mong đợi
- HTTP 201; ZIP 3 entry.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-144
severity: Medium
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-007

**Meta**:
- Loại: `STATE`
- Priority: `P2` 🟡
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `STATE`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Click ngoài menu caret đang mở → menu đóng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở caret ▼
- [ ] Click vùng trống ngoài menu

### Kết quả mong đợi
- Menu đóng (click-outside), không chọn mục nào.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-007
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-008

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EDGE`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Form sửa (edit) → nút chính nhãn 'Cập nhật' vẫn có caret xuất file

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở /petitions/:id/edit
- [ ] Quan sát nút lưu

### Kết quả mong đợi
- Nút chính nhãn 'Cập nhật'; caret ▼ vẫn có 'Lưu và xuất file'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-008
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-010

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `STATE`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Nhấn Enter trong form → submit = 'Lưu đơn thư' (không mở popup)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Focus 1 input
- [ ] Nhấn Enter

### Kết quả mong đợi
- Form submit theo onSave (lưu + về danh sách), không mở popup xuất file.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-010
severity: High
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-020

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EDGE`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Mỗi mẫu hiển thị nhãn + mô tả đúng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở popup
- [ ] Đọc 7 dòng mẫu

### Kết quả mong đợi
- Mỗi mẫu có tên + mô tả ngắn (vd 'Biên nhận tiếp nhận đơn thư — xác nhận đã nhận hồ sơ').

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-020
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-034

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: mode bỏ trống → mặc định 'merged'

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body chỉ docTypes (không mode)

### Kết quả mong đợi
- HTTP 201; trả về .docx gộp (mode mặc định merged).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-034
severity: High
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-035

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export merged 7 mẫu < 3s

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đo thời gian POST merged 7 mẫu

### Kết quả mong đợi
- Phản hồi < 3 giây cho 7 mẫu trong 1 request.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-035
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-039

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docTypes trùng lặp → dedupe, không tạo entry trùng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST zip [BIEN_NHAN, BIEN_NHAN]

### Kết quả mong đợi
- HTTP 201; ZIP chỉ 1 entry BIEN_NHAN (đã dedupe).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-039
severity: High
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-054

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Body JSON sai cú pháp → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents body '{bad json'

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-054
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-055

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Content-Type không phải JSON → 400/415

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST /api/v1/petitions/:id/export-documents Content-Type text/plain

### Kết quả mong đợi
- HTTP 400/415.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-055
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-072

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `M7-Data`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DATA`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Nội dung xuống dòng nhiều đoạn → giữ định dạng linebreaks

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn có \n nhiều đoạn
- [ ] Export

### Kết quả mong đợi
- docx giữ ngắt đoạn (linebreaks=true).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-072
severity: Medium
module: M7-Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-073

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `M7-Data`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `DATA`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Số văn bản tăng tuần tự đúng series mỗi mẫu

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export 2 lần BIEN_NHAN
- [ ] So số

### Kết quả mong đợi
- Số văn bản BN tăng +1 đúng thứ tự, không trùng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Data`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Data`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-073
severity: High
module: M7-Data
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-077

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Caret split-button có aria-haspopup/expanded

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Kiểm DOM nút caret

### Kết quả mong đợi
- Caret có aria-haspopup=menu; aria-expanded đổi khi mở.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-077
severity: Low
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-078

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Checkbox có nhãn liên kết (label-for)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Kiểm DOM checkbox mẫu

### Kết quả mong đợi
- Mỗi checkbox có label/aria-label tên mẫu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-078
severity: Low
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-079

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M7-A11y`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Contrast nút/tiêu đề đạt WCAG AA

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đo contrast nút 'Xuất file' + tiêu đề

### Kết quả mong đợi
- Tỷ lệ tương phản ≥ 4.5:1.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-A11y`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-A11y`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-079
severity: Low
module: M7-A11y
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-082

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Firefox desktop: popup render + tải file

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Firefox
- [ ] Full flow

### Kết quả mong đợi
- Popup render đúng; tải file thành công.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-082
severity: Low
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-083

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: File .docx mở được trên MS Word

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Tải merged
- [ ] Mở bằng MS Word

### Kết quả mong đợi
- Word mở không báo hỏng; thấy ngắt trang giữa các mẫu.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-083
severity: Medium
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-084

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: File .docx mở được trên LibreOffice/Google Docs

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở merged bằng LibreOffice

### Kết quả mong đợi
- Mở được, bố cục giữ nguyên.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-084
severity: Low
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-085

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: ZIP giải nén được bằng Windows Explorer + 7-Zip

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Tải zip
- [ ] Giải nén

### Kết quả mong đợi
- Giải nén được 7 file; tên tiếng Việt đúng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-085
severity: Low
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-086

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M7-Perf`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export zip 7 mẫu < 3s

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đo POST zip 7 mẫu

### Kết quả mong đợi
- < 3 giây.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-086
severity: Medium
module: M7-Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-087

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M7-Perf`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: 2 user export đồng thời cùng đơn không deadlock

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] request export song song cùng petitionId

### Kết quả mong đợi
- Cả 2 hoàn tất (tuần tự hoá qua row lock FOR UPDATE); không deadlock; số văn bản không trùng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-087
severity: High
module: M7-Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-103

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Trường lạ thừa trong body → bỏ qua hoặc 400 (whitelist)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST body thêm {evil:1}

### Kết quả mong đợi
- Bỏ qua field lạ (whitelist) hoặc 400; không lỗi 500.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-103
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-104

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Header 'Bearer ' rỗng token → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST Authorization: 'Bearer '

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-104
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-105

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Authorization thiếu prefix 'Bearer' → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST Authorization: '<token>' (no Bearer)

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-105
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-106

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Sai HTTP method GET → 404/405

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] GET /api/v1/petitions/:id/export-documents

### Kết quả mong đợi
- HTTP 404/405 (chỉ POST).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-106
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-107

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Sai HTTP method PUT → 404/405

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] PUT /api/v1/petitions/:id/export-documents

### Kết quả mong đợi
- HTTP 404/405.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-107
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-108

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: id chứa khoảng trắng → 404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST id="abc def"

### Kết quả mong đợi
- HTTP 404 (không tồn tại).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-108
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-109

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: id rỗng → 404/400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST id=""

### Kết quả mong đợi
- HTTP 404/400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-109
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-110

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `STATE`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đơn đã chuyển thành vụ việc/vụ án vẫn export được (chỉ cần trường mẫu)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export đơn đã convert

### Kết quả mong đợi
- HTTP 201 nếu đủ trường; không lỗi do trạng thái.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-110
severity: Medium
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-112

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Lỗi export (server 500 giả lập) → popup hiện message, KHÔNG đóng/điều hướng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mock API lỗi
- [ ] Bấm 'Xuất file'

### Kết quả mong đợi
- Popup hiện thông báo lỗi; popup VẪN mở; không về danh sách.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-112
severity: High
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-113

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RECOVERY`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Mất mạng khi tải file → báo lỗi, không treo

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Ngắt mạng
- [ ] Bấm 'Xuất file'

### Kết quả mong đợi
- Hiện lỗi tải; nút trở lại enabled; không treo UI.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-113
severity: Medium
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-119

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: mode 'merged' và mode mặc định → cùng kết quả gộp

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST có mode=merged
- [ ] POST không mode

### Kết quả mong đợi
- Cả 2 trả 1 .docx gộp.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-119
severity: Low
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-121

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Số văn bản nhiều chữ số (rollover series) định dạng đúng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export khi counter lớn

### Kết quả mong đợi
- Số văn bản định dạng đủ chữ số, không tràn/format lỗi.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-121
severity: Low
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-122

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tên file ZIP gốc 'ChungTu_<ngày>.zip' đúng định dạng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đọc Content-Disposition của zip

### Kết quả mong đợi
- filename 'ChungTu_YYYYMMDD.zip' (sanitize RFC5987).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-122
severity: Low
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-123

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Tên file merged 'ChungTu_<ngày>.docx' đúng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đọc Content-Disposition merged

### Kết quả mong đợi
- filename 'ChungTu_YYYYMMDD.docx'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-123
severity: Low
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-124

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Authorization Basic thay vì Bearer → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST Authorization Basic

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-124
severity: Low
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-125

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Token của user đã bị xoá → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST token user deleted

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-125
severity: Medium
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-126

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: mode có khoảng trắng đuôi 'merged ' → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST mode="merged "

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-126
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-127

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: docTypes lồng mảng [[..]] → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes [["BIEN_NHAN"]]

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-127
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-128

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: docTypes boolean → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST docTypes true

### Kết quả mong đợi
- HTTP 400 (@IsArray).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-128
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-129

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: mode kiểu số → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST mode=1

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-129
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-130

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Body là mảng gốc [] thay vì object → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST body []

### Kết quả mong đợi
- HTTP 400.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-130
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-131

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: id rất dài (1000 ký tự) → 404/400, không 500

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST id 1000 ký tự

### Kết quả mong đợi
- HTTP 404/400; không 500.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-131
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-132

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Double slash trong path → 404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST //export-documents

### Kết quả mong đợi
- HTTP 404.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-132
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-133

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: 8 docType (7 hợp lệ + 1 sai) → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST 7 mẫu + "XXX"

### Kết quả mong đợi
- HTTP 400 cả request.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-133
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-134

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: 1000 phần tử docTypes → 400 hoặc xử lý an toàn

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST 1000 docType

### Kết quả mong đợi
- Không 500; 400 hoặc dedupe an toàn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-134
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-135

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export ngay sau khi xoá đơn (race) → 404

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Xoá đơn
- [ ] Export ngay

### Kết quả mong đợi
- HTTP 404; không cấp số.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-135
severity: Medium
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-136

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: JWT alg=none → 401

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST JWT alg none

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-136
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-137

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Security`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Token sửa payload nâng role → vẫn 401 (sai chữ ký)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST token role=ADMIN giả

### Kết quả mong đợi
- HTTP 401.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Security`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Security`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-137
severity: High
module: M6-Security
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-139

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Bấm 'Xuất file' 2 lần nhanh → chỉ 1 request (chống double)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Double-click 'Xuất file'

### Kết quả mong đợi
- Chỉ 1 POST; isExporting chặn cái thứ 2.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-139
severity: Medium
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-142

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M6-Throttle`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đúng request thứ 5 trong 60s vẫn 201 (biên trong hạn)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Gọi 5 lần liên tiếp

### Kết quả mong đợi
- Request 1-5 đều 201 (chưa vượt).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Throttle`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Throttle`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-142
severity: Medium
module: M6-Throttle
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-143

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tập mẫu con bất kỳ (vd 4 mẫu) → merged đủ 4 phần

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST 4 mẫu bất kỳ

### Kết quả mong đợi
- HTTP 201; docx chứa đủ 4 phần, 3 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-143
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-145

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Đóng popup → focus trả về nút đã mở

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Mở rồi đóng popup

### Kết quả mong đợi
- Focus quay lại nút 'Lưu và xuất file'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-145
severity: Low
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-146

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Screen reader đọc tiêu đề + số mẫu đã chọn

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bật SR
- [ ] Mở popup

### Kết quả mong đợi
- SR đọc 'Xuất chứng từ' + 'Đã chọn 7/7'.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-146
severity: Low
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-147

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Mobile viewport: popup cuộn được, nút không bị che

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Viewport 375x812
- [ ] Mở popup

### Kết quả mong đợi
- Popup responsive, cuộn tới [Xuất file]/[Đóng].

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-147
severity: Medium
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-148

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: ZIP entry tên tiếng Việt mở đúng trên macOS

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Giải nén trên macOS

### Kết quả mong đợi
- Tên file tiếng Việt không lỗi encoding.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-148
severity: Low
module: M7-Compat
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-149

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M7-Perf`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Nội dung lớn không gây OOM/treo server

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export đơn summary rất lớn

### Kết quả mong đợi
- Hoàn tất < 5s; không OOM; bộ nhớ ổn định.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-149
severity: Medium
module: M7-Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-150

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M6-Throttle`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: 6 request đồng thời (burst) → ≥1 trả 429

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bắn 6 request song song <60s

### Kết quả mong đợi
- Ít nhất 1 request 429; không 500; không tiêu số cho request bị chặn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M6-Throttle`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M6-Throttle`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-150
severity: Medium
module: M6-Throttle
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-151

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: mode='zip' nhưng docTypes rỗng → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST {docTypes:[],mode:"zip"}

### Kết quả mong đợi
- HTTP 400 (ArrayNotEmpty trước mode).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-151
severity: Medium
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-152

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: docTypes có phần tử số lẫn chuỗi → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST ["BIEN_NHAN",1]

### Kết quả mong đợi
- HTTP 400 (@IsString each).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-152
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-153

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Header Content-Length sai (rỗng body khai báo có) → 400

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] POST khai Content-Length lệch

### Kết quả mong đợi
- HTTP 400; không treo.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-153
severity: Low
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-154

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export khi đơn vừa bị user khác sửa (stale) → vẫn dùng data mới nhất

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] User A mở popup
- [ ] User B sửa đơn
- [ ] A xuất

### Kết quả mong đợi
- Xuất theo data hiện tại trong DB (không lỗi); số cấp đúng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-154
severity: Medium
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-155

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Token hết hạn ngay lúc bấm 'Xuất file' → 401, popup báo lỗi

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Để token hết hạn
- [ ] Bấm 'Xuất file'

### Kết quả mong đợi
- HTTP 401; popup hiện lỗi phiên; không tải file rỗng.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-155
severity: Medium
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-156

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M2-Popup`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RED`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: 429 khi bấm 'Xuất file' → popup báo 'thử lại sau', không đóng

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Vượt throttle
- [ ] Bấm 'Xuất file'

### Kết quả mong đợi
- Popup hiện thông báo giới hạn; vẫn mở; không tải file.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M2-Popup`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M2-Popup`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-156
severity: Medium
module: M2-Popup
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-157

**Meta**:
- Loại: `RED`
- Priority: `P2` 🟡
- Module: `M5-Validation`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `RECOVERY`
- Risk: `Medium`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: docType hợp lệ nhưng template file thiếu trên server → 500 có kiểm soát

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] (giả lập) thiếu .docx template

### Kết quả mong đợi
- Lỗi có kiểm soát; không cấp số (rollback); log rõ.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Validation`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Validation`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-157
severity: High
module: M5-Validation
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-161

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Merged khi chỉ 2 trong 7 mẫu đủ trường, chọn đúng 2 → 201

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Chọn đúng 2 mẫu đủ trường

### Kết quả mong đợi
- HTTP 201; docx 2 phần, 1 ngắt trang.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-161
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-162

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M4-API-Zip`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Re-export cùng đơn → số văn bản MỚI mỗi lần (không cache)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export zip 2 lần
- [ ] So số

### Kết quả mong đợi
- Mỗi lần cấp số mới (không trùng/không cache).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M4-API-Zip`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M4-API-Zip`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-162
severity: Medium
module: M4-API-Zip
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-163

**Meta**:
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `M3-API-Merged`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `EP`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Export phản ánh data sau khi sửa đơn

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Sửa deXuat
- [ ] Export

### Kết quả mong đợi
- docx chứa deXuat mới nhất.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M3-API-Merged`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M3-API-Merged`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-163
severity: Medium
module: M3-API-Merged
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-164

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P2` 🟡
- Module: `M5-Atomic`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `BOUNDARY`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Đơn nặc danh (senderName ẩn) — mẫu cần senderName → 400 đúng quy tắc

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Đơn nặc danh
- [ ] Export BIEN_NHAN

### Kết quả mong đợi
- Theo quy tắc validate (400 nếu thiếu senderName).

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M5-Atomic`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M5-Atomic`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-164
severity: Medium
module: M5-Atomic
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-165

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M7-Perf`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: 10 lần export tuần tự không rò bộ nhớ

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export 10 lần (giãn throttle)

### Kết quả mong đợi
- Bộ nhớ ổn định; không leak.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-165
severity: Low
module: M7-Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-166

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `M7-Perf`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `PERFORMANCE`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Lock FOR UPDATE không giữ quá lâu (release sau tx)

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Export A đang chạy
- [ ] Đo chờ của export B cùng đơn

### Kết quả mong đợi
- B chờ ngắn rồi hoàn tất; lock release sau commit.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Perf`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Perf`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-166
severity: Medium
module: M7-Perf
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-167

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `M1-SplitButton`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `A11Y`
- Risk: `Medium`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Caret điều hướng menu bằng phím mũi tên

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Focus caret
- [ ] Enter mở
- [ ] ↑/↓ chọn

### Kết quả mong đợi
- Di chuyển giữa 2 menuitem bằng bàn phím; Enter kích hoạt.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M1-SplitButton`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M1-SplitButton`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-167
severity: Low
module: M1-SplitButton
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

---

## TC-EXP-168

**Meta**:
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `M7-Compat`
- Yêu cầu: `EXPORT`
- Kỹ thuật: `COMPAT`
- Risk: `Medium`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tải file hoạt động khi trình duyệt chặn popup

### Điều kiện tiên quyết
- Đăng nhập admin@pc02.local; backend :3000, FE :5173; có đơn thư đủ trường.

### Các bước kiểm thử
- [ ] Bật chặn popup
- [ ] Xuất file

### Kết quả mong đợi
- Tải qua blob/anchor, không bị popup-blocker chặn.

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `M7-Compat`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `M7-Compat`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-EXP-168
severity: Medium
module: M7-Compat
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

- [ ] **TC-EXP-001** [P0] Form đơn thư hiển thị split-button 'Lưu đơn thư' + caret ▼
- [ ] **TC-EXP-002** [P0] Bấm nút chính 'Lưu đơn thư' → lưu + về danh sách (hành vi cũ)
- [ ] **TC-EXP-003** [P0] Mở menu caret ▼ hiển thị 2 mục 'Lưu đơn thư' / 'Lưu và xuất file'
- [ ] **TC-EXP-005** [P0] Chọn 'Lưu và xuất file' trên đơn hợp lệ → lưu xong mở popup
- [ ] **TC-EXP-011** [P0] Popup mở: 7 mẫu checkbox đều tick sẵn
- [ ] **TC-EXP-012** [P0] Mặc định định dạng = ◉ Gộp 1 file Word
- [ ] **TC-EXP-015** [P0] Bỏ hết mẫu (0 chọn) → nút [Xuất file] disabled
- [ ] **TC-EXP-018** [P0] Bấm [Đóng] → đóng popup + về danh sách
- [ ] **TC-EXP-023** [P0] Export merged chứa mẫu Biên nhận (BIEN_NHAN) → docx hợp lệ
- [ ] **TC-EXP-024** [P0] Export merged chứa mẫu Phiếu đề xuất (PHIEU_DE_XUAT) → docx hợp lệ
- [ ] **TC-EXP-025** [P0] Export merged chứa mẫu Phiếu chuyển nguồn tin (PHIEU_CHUYEN_NGUON_TIN) → docx hợp lệ
- [ ] **TC-EXP-026** [P0] Export merged chứa mẫu Phiếu chuyển đơn (PHIEU_CHUYEN_DON) → docx hợp lệ
- [ ] **TC-EXP-027** [P0] Export merged chứa mẫu Thông báo chuyển đơn (THONG_BAO_CHUYEN) → docx hợp lệ
- [ ] **TC-EXP-028** [P0] Export merged chứa mẫu Thông báo hướng dẫn (THONG_BAO_HUONG_DAN) → docx hợp lệ
- [ ] **TC-EXP-029** [P0] Export merged chứa mẫu Thông báo trả lại đơn (THONG_BAO_TRA_LAI) → docx hợp lệ
- [ ] **TC-EXP-030** [P0] Export merged CẢ 7 mẫu → 1 docx, 6 ngắt trang, 1 sectPr
- [ ] **TC-EXP-036** [P0] Export zip 7 mẫu → ZIP đúng 7 file .docx
- [ ] **TC-EXP-040** [P0] Đơn thiếu deXuat + chọn PHIEU_DE_XUAT → 400, KHÔNG cấp số
- [ ] **TC-EXP-041** [P0] Export fail giữa chừng → số văn bản KHÔNG bị tiêu (no gap)
- [ ] **TC-EXP-042** [P0] Đơn thiếu senderName → mọi mẫu 400
- [ ] **TC-EXP-043** [P0] PHIEU_CHUYEN_NGUON_TIN thiếu lyDoChuyen/canCuPhapLy → 400
- [ ] **TC-EXP-044** [P0] THONG_BAO_HUONG_DAN thiếu huongDanKhoiKien → 400
- [ ] **TC-EXP-045** [P0] THONG_BAO_TRA_LAI thiếu lyDoTraDon → 400
- [ ] **TC-EXP-046** [P0] docTypes rỗng [] → 400
- [ ] **TC-EXP-047** [P0] docTypes thiếu hẳn (undefined) → 400
- [ ] **TC-EXP-048** [P0] docType không thuộc allowlist → 400
- [ ] **TC-EXP-052** [P0] id đơn không tồn tại → 404
- [ ] **TC-EXP-057** [P0] Multi-mẫu: 1 mẫu thiếu trường → CẢ request fail (không xuất phần đúng)
- [ ] **TC-EXP-058** [P0] Không token → 401
- [ ] **TC-EXP-059** [P0] Token hết hạn → 401
- [ ] **TC-EXP-060** [P0] Token sai chữ ký → 401
- [ ] **TC-EXP-061** [P0] User KHÔNG quyền read Petition → 403
- [ ] **TC-EXP-062** [P0] IDOR: user ngoài phạm vi dữ liệu xuất đơn tổ khác → 403/404
- [ ] **TC-EXP-063** [P0] SQL injection trong id → không 500, trả 404/400
- [ ] **TC-EXP-064** [P0] XSS payload trong docTypes → 400, không phản chiếu
- [ ] **TC-EXP-065** [P0] Path traversal trong docType → 400 (allowlist chặn)
- [ ] **TC-EXP-066** [P0] Quá 5 request/60s → 429
- [ ] **TC-EXP-067** [P0] Sau cửa sổ 60s → request lại được phép
- [ ] **TC-EXP-068** [P0] Số văn bản không suy đoán được từ response (no leak counter)
- [ ] **TC-EXP-069** [P0] Content-Disposition filename không chứa path traversal
- [ ] **TC-EXP-070** [P0] Tên người gửi ký tự đặc biệt → render an toàn (escape token)
- [ ] **TC-EXP-088** [P0] In từng (ExportDocumentDropdown ở chi tiết) vẫn hoạt động
- [ ] **TC-EXP-089** [P0] In đồng loạt (batch danh sách) vẫn hoạt động
- [ ] **TC-EXP-091** [P0] PHIEU_CHUYEN_DON thiếu lyDoChuyen → 400
- [ ] **TC-EXP-111** [P0] Export lỗi giữa loop multi (mẫu 5/7 thiếu) → rollback HẾT, 0 số tiêu
- [ ] **TC-EXP-138** [P0] Mẫu cuối (7/7) thiếu trường → rollback cả 6 mẫu trước
- [ ] **TC-EXP-140** [P0] Lỗi 4xx/5xx không lộ stacktrace/đường dẫn nội bộ
- [ ] **TC-EXP-141** [P0] Throttle đếm riêng theo endpoint, không ảnh hưởng API khác
- [ ] **TC-EXP-158** [P0] CORS: request từ origin lạ bị chặn theo cấu hình
- [ ] **TC-EXP-159** [P0] Không cache file nhạy cảm (Cache-Control)
- [ ] **TC-EXP-160** [P0] IDOR đọc-ngang: officer tổ A KHÔNG xuất được đơn tổ B (lặp xác nhận scope)
- [ ] **TC-EXP-004** [P1] Chọn menu 'Lưu đơn thư' trong dropdown = hành vi nút chính
- [ ] **TC-EXP-006** [P1] Trạng thái isSubmitting → nút chính disabled chống double-submit
- [ ] **TC-EXP-009** [P1] 'Lưu và xuất file' khi form thiếu trường bắt buộc → báo lỗi, KHÔNG mở popup
- [ ] **TC-EXP-013** [P1] Nút 'Bỏ chọn tất cả' → bỏ hết 7 mẫu
- [ ] **TC-EXP-014** [P1] Nút 'Chọn tất cả' (sau khi bỏ hết) → tick lại 7 mẫu
- [ ] **TC-EXP-016** [P1] Chọn 1 mẫu duy nhất → [Xuất file] enabled
- [ ] **TC-EXP-017** [P1] Đổi định dạng sang ○ Tách – ZIP
- [ ] **TC-EXP-019** [P1] Bấm nút X góc phải → đóng popup (như Đóng)
- [ ] **TC-EXP-021** [P1] Đang xuất (isExporting) → nút [Xuất file] disabled/loading
- [ ] **TC-EXP-022** [P1] Toggle từng checkbox cập nhật counter chính xác
- [ ] **TC-EXP-031** [P1] Merged giữ tiếng Việt có dấu trong nội dung
- [ ] **TC-EXP-032** [P1] Merged đúng 2 mẫu → đúng 1 ngắt trang (N-1)
- [ ] **TC-EXP-033** [P1] Merged đúng 1 mẫu → 0 ngắt trang
- [ ] **TC-EXP-037** [P1] Export zip 1 mẫu → ZIP 1 entry
- [ ] **TC-EXP-038** [P1] Tên entry zip có đúng số văn bản theo series
- [ ] **TC-EXP-049** [P1] mode sai (vd 'pdf') → 400
- [ ] **TC-EXP-050** [P1] docTypes không phải mảng (string) → 400
- [ ] **TC-EXP-051** [P1] Phần tử docTypes là số → 400
- [ ] **TC-EXP-053** [P1] id đơn đã xoá mềm (deletedAt) → 404
- [ ] **TC-EXP-056** [P1] docTypes trùng nhau nhiều lần → dedupe còn unique
- [ ] **TC-EXP-071** [P1] Nội dung dài (vài nghìn ký tự) → render không cắt/lỗi
- [ ] **TC-EXP-074** [P1] Popup có role dialog + tiêu đề liên kết
- [ ] **TC-EXP-075** [P1] Bàn phím: Tab tới được checkbox/radio/nút
- [ ] **TC-EXP-076** [P1] Esc đóng popup
- [ ] **TC-EXP-080** [P1] Chrome desktop: full flow lưu→popup→tải
- [ ] **TC-EXP-081** [P1] Edge desktop: full flow
- [ ] **TC-EXP-090** [P1] Endpoint export-document (đơn lẻ) cũ vẫn 200
- [ ] **TC-EXP-092** [P1] mode 'ZIP' viết hoa → 400 (case-sensitive)
- [ ] **TC-EXP-093** [P1] mode 'Merged' viết hoa đầu → 400
- [ ] **TC-EXP-094** [P1] mode chuỗi rỗng '' → 400
- [ ] **TC-EXP-095** [P1] docTypes chứa phần tử null → 400
- [ ] **TC-EXP-096** [P1] docTypes chứa chuỗi rỗng '' → 400
- [ ] **TC-EXP-097** [P1] docType có khoảng trắng ' BIEN_NHAN ' → 400
- [ ] **TC-EXP-098** [P1] docType sai hoa-thường 'bien_nhan' → 400
- [ ] **TC-EXP-099** [P1] docTypes là object {} → 400
- [ ] **TC-EXP-100** [P1] Body rỗng {} → 400
- [ ] **TC-EXP-101** [P1] Không có body → 400
- [ ] **TC-EXP-102** [P1] Mảng trộn docType hợp lệ + sai → 400 cả request
- [ ] **TC-EXP-114** [P1] Merged 3 mẫu → đúng 2 ngắt trang (N-1)
- [ ] **TC-EXP-115** [P1] Merged 4 mẫu → đúng 3 ngắt trang (N-1)
- [ ] **TC-EXP-116** [P1] Merged 5 mẫu → đúng 4 ngắt trang (N-1)
- [ ] **TC-EXP-117** [P1] Merged 6 mẫu → đúng 5 ngắt trang (N-1)
- [ ] **TC-EXP-118** [P1] Thứ tự docTypes khác nhau cùng tập → kết quả tương đương
- [ ] **TC-EXP-120** [P1] docTypes lặp 50 lần 1 mẫu → dedupe còn 1
- [ ] **TC-EXP-144** [P1] Tập mẫu con (3 mẫu) → ZIP đúng 3 entry
- [ ] **TC-EXP-007** [P2] Click ngoài menu caret đang mở → menu đóng
- [ ] **TC-EXP-008** [P2] Form sửa (edit) → nút chính nhãn 'Cập nhật' vẫn có caret xuất file
- [ ] **TC-EXP-010** [P2] Nhấn Enter trong form → submit = 'Lưu đơn thư' (không mở popup)
- [ ] **TC-EXP-020** [P2] Mỗi mẫu hiển thị nhãn + mô tả đúng
- [ ] **TC-EXP-034** [P2] mode bỏ trống → mặc định 'merged'
- [ ] **TC-EXP-035** [P2] Export merged 7 mẫu < 3s
- [ ] **TC-EXP-039** [P2] docTypes trùng lặp → dedupe, không tạo entry trùng
- [ ] **TC-EXP-054** [P2] Body JSON sai cú pháp → 400
- [ ] **TC-EXP-055** [P2] Content-Type không phải JSON → 400/415
- [ ] **TC-EXP-072** [P2] Nội dung xuống dòng nhiều đoạn → giữ định dạng linebreaks
- [ ] **TC-EXP-073** [P2] Số văn bản tăng tuần tự đúng series mỗi mẫu
- [ ] **TC-EXP-077** [P2] Caret split-button có aria-haspopup/expanded
- [ ] **TC-EXP-078** [P2] Checkbox có nhãn liên kết (label-for)
- [ ] **TC-EXP-079** [P2] Contrast nút/tiêu đề đạt WCAG AA
- [ ] **TC-EXP-082** [P2] Firefox desktop: popup render + tải file
- [ ] **TC-EXP-083** [P2] File .docx mở được trên MS Word
- [ ] **TC-EXP-084** [P2] File .docx mở được trên LibreOffice/Google Docs
- [ ] **TC-EXP-085** [P2] ZIP giải nén được bằng Windows Explorer + 7-Zip
- [ ] **TC-EXP-086** [P2] Export zip 7 mẫu < 3s
- [ ] **TC-EXP-087** [P2] 2 user export đồng thời cùng đơn không deadlock
- [ ] **TC-EXP-103** [P2] Trường lạ thừa trong body → bỏ qua hoặc 400 (whitelist)
- [ ] **TC-EXP-104** [P2] Header 'Bearer ' rỗng token → 401
- [ ] **TC-EXP-105** [P2] Authorization thiếu prefix 'Bearer' → 401
- [ ] **TC-EXP-106** [P2] Sai HTTP method GET → 404/405
- [ ] **TC-EXP-107** [P2] Sai HTTP method PUT → 404/405
- [ ] **TC-EXP-108** [P2] id chứa khoảng trắng → 404
- [ ] **TC-EXP-109** [P2] id rỗng → 404/400
- [ ] **TC-EXP-110** [P2] Đơn đã chuyển thành vụ việc/vụ án vẫn export được (chỉ cần trường mẫu)
- [ ] **TC-EXP-112** [P2] Lỗi export (server 500 giả lập) → popup hiện message, KHÔNG đóng/điều hướng
- [ ] **TC-EXP-113** [P2] Mất mạng khi tải file → báo lỗi, không treo
- [ ] **TC-EXP-119** [P2] mode 'merged' và mode mặc định → cùng kết quả gộp
- [ ] **TC-EXP-121** [P2] Số văn bản nhiều chữ số (rollover series) định dạng đúng
- [ ] **TC-EXP-122** [P2] Tên file ZIP gốc 'ChungTu_<ngày>.zip' đúng định dạng
- [ ] **TC-EXP-123** [P2] Tên file merged 'ChungTu_<ngày>.docx' đúng
- [ ] **TC-EXP-124** [P2] Authorization Basic thay vì Bearer → 401
- [ ] **TC-EXP-125** [P2] Token của user đã bị xoá → 401
- [ ] **TC-EXP-126** [P2] mode có khoảng trắng đuôi 'merged ' → 400
- [ ] **TC-EXP-127** [P2] docTypes lồng mảng [[..]] → 400
- [ ] **TC-EXP-128** [P2] docTypes boolean → 400
- [ ] **TC-EXP-129** [P2] mode kiểu số → 400
- [ ] **TC-EXP-130** [P2] Body là mảng gốc [] thay vì object → 400
- [ ] **TC-EXP-131** [P2] id rất dài (1000 ký tự) → 404/400, không 500
- [ ] **TC-EXP-132** [P2] Double slash trong path → 404
- [ ] **TC-EXP-133** [P2] 8 docType (7 hợp lệ + 1 sai) → 400
- [ ] **TC-EXP-134** [P2] 1000 phần tử docTypes → 400 hoặc xử lý an toàn
- [ ] **TC-EXP-135** [P2] Export ngay sau khi xoá đơn (race) → 404
- [ ] **TC-EXP-136** [P2] JWT alg=none → 401
- [ ] **TC-EXP-137** [P2] Token sửa payload nâng role → vẫn 401 (sai chữ ký)
- [ ] **TC-EXP-139** [P2] Bấm 'Xuất file' 2 lần nhanh → chỉ 1 request (chống double)
- [ ] **TC-EXP-142** [P2] Đúng request thứ 5 trong 60s vẫn 201 (biên trong hạn)
- [ ] **TC-EXP-143** [P2] Tập mẫu con bất kỳ (vd 4 mẫu) → merged đủ 4 phần
- [ ] **TC-EXP-145** [P2] Đóng popup → focus trả về nút đã mở
- [ ] **TC-EXP-146** [P2] Screen reader đọc tiêu đề + số mẫu đã chọn
- [ ] **TC-EXP-147** [P2] Mobile viewport: popup cuộn được, nút không bị che
- [ ] **TC-EXP-148** [P2] ZIP entry tên tiếng Việt mở đúng trên macOS
- [ ] **TC-EXP-149** [P2] Nội dung lớn không gây OOM/treo server
- [ ] **TC-EXP-150** [P2] 6 request đồng thời (burst) → ≥1 trả 429
- [ ] **TC-EXP-151** [P2] mode='zip' nhưng docTypes rỗng → 400
- [ ] **TC-EXP-152** [P2] docTypes có phần tử số lẫn chuỗi → 400
- [ ] **TC-EXP-153** [P2] Header Content-Length sai (rỗng body khai báo có) → 400
- [ ] **TC-EXP-154** [P2] Export khi đơn vừa bị user khác sửa (stale) → vẫn dùng data mới nhất
- [ ] **TC-EXP-155** [P2] Token hết hạn ngay lúc bấm 'Xuất file' → 401, popup báo lỗi
- [ ] **TC-EXP-156** [P2] 429 khi bấm 'Xuất file' → popup báo 'thử lại sau', không đóng
- [ ] **TC-EXP-157** [P2] docType hợp lệ nhưng template file thiếu trên server → 500 có kiểm soát
- [ ] **TC-EXP-161** [P2] Merged khi chỉ 2 trong 7 mẫu đủ trường, chọn đúng 2 → 201
- [ ] **TC-EXP-162** [P2] Re-export cùng đơn → số văn bản MỚI mỗi lần (không cache)
- [ ] **TC-EXP-163** [P2] Export phản ánh data sau khi sửa đơn
- [ ] **TC-EXP-164** [P2] Đơn nặc danh (senderName ẩn) — mẫu cần senderName → 400 đúng quy tắc
- [ ] **TC-EXP-165** [P2] 10 lần export tuần tự không rò bộ nhớ
- [ ] **TC-EXP-166** [P2] Lock FOR UPDATE không giữ quá lâu (release sau tx)
- [ ] **TC-EXP-167** [P2] Caret điều hướng menu bằng phím mũi tên
- [ ] **TC-EXP-168** [P2] Tải file hoạt động khi trình duyệt chặn popup

---

_Generated by `uat-test-writer` skill on 27/06/2026 18:07_