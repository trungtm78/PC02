# UAT Test Cases — Quản lý vụ việc (Case Management)

**Generated**: 23/05/2026 13:56  
**Complexity**: `complex`  
**Total TC**: 69  
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
- CRUD vụ án (tạo / xem / sửa / xóa mềm / khôi phục) qua API + UI
- 10 trạng thái CaseStatus + chuyển trạng thái + lưu CaseStatusHistory
- Provenance model (CaseProvenance) — FROM_PETITION/FROM_INCIDENT/DIRECT_DISCOVERY/TRANSFERRED/SELF_SURRENDER/PROSECUTOR_PROPOSAL/OTHER_LEGAL_SOURCE
- Optimistic lock qua expectedUpdatedAt + expectedPetitionUpdatedAt + expectedIncidentUpdatedAt
- DataScope team-based access control (investigator + team + dispatcher + ADMIN)
- Soft delete với reason 10-500 chars + ràng buộc status=TIEP_NHAN + restore ADMIN-only
- Assign / re-assign dispatcher-only
- Search / filter (status, investigator, unit, date range, overdue, district/ward, capDoToiPham, wardTeamId)
- Export Excel theo phường/xã + theo phân loại khác (rate-limited 5 req/60s)
- TĐC tracking: auto-set ngayTamDinhChi + soLanTamDinhChi khi chuyển TAM_DINH_CHI; phục hồi với ketQuaPhucHoiVuAn
- Audit log: CASE_CREATED, CASE_UPDATED, CASE_STATUS_CHANGED, CASE_DELETED, CASE_RESTORED

**Out of scope**:
- Penetration test full (giao team Security)
- Load test >1000 concurrent user (dùng JMeter riêng)
- KPI Dashboard chi tiết — test trong feature KPI
- Comprehensive list / Initial cases — đã tách feature
- Module Petition / Incident sâu — test riêng
- Auto-deadline calculation logic chi tiết theo SystemSetting — test riêng module Settings

**Exit Criteria**: 100% TC P0 PASS; ≥95% P1; ≥85% P2; 0 defect Critical/High mở; ≤5 defect Medium mở

## 🔍 Self-Audit

**Tổng số TC**: 69

**Phân bố loại**:
- `RED`: 17
- `SECURITY`: 9
- `GREEN`: 8
- `BOUNDARY`: 7
- `STATE`: 5
- `DECISION`: 5
- `DATA`: 4
- `EP`: 3
- `PERFORMANCE`: 3
- `COMPAT`: 3
- `A11Y`: 3
- `AUDIT`: 2

**Phân bố priority**:
- 🔴 `P0`: 30
- 🟠 `P1`: 27
- 🟡 `P2`: 12

**Phân bố severity nếu fail**:
- 🚨 `Critical`: 28
- ⚠️ `High`: 16
- ⚡ `Medium`: 17
- 📌 `Low`: 8

## 📦 Test Data

> Dữ liệu chia sẻ giữa các TC. Claude Code đọc 1 lần, reference bằng ID khi fix.

### 1. Tài khoản kiểm thử

| ID | Email | Mật khẩu | Vai trò | Trạng thái | Mục đích |
|----|-------|----------|---------|------------|----------|
| `U001` | `dieuTra1@pc02.local` | `Test@1234` | DIEU_TRA_VIEN | Active | Happy path — tạo/sửa/xem Case của mình |
| `U002` | `dieuTra2@pc02.local` | `Test@1234` | DIEU_TRA_VIEN | Active | Test cross-team forbid (IDOR ngang) |
| `U003` | `dispatcher@pc02.local` | `Test@1234` | CAN_BO_PHAN_CONG | Active | Test phân công + xem full list |
| `U004` | `admin@pc02.local` | `Admin@2025` | ADMIN | Active | Test restore + xem full |
| `U005` | `locked@pc02.local` | `Test@1234` | DIEU_TRA_VIEN | Locked | Test login fail |
| `U006` | `tt_t2@pc02.local` | `Test@1234` | TO_TRUONG | Active | Test team owner xem Case của team |

### 2. Boundary Values (BVA)

| Field | Giá trị | Loại | Kỳ vọng | Ghi chú |
|-------|---------|------|---------|---------|
| name | `(empty)` | `min-1` | **FAIL** | @IsString cho phép '' — nhưng spec nên reject; test confirm |
| name | `A` | `min` | **PASS** | 1 char hợp lệ |
| name | `(500 chars)` | `max` | **PASS** | Đúng giới hạn @MaxLength(500) |
| name | `(501 chars)` | `max+1` | **FAIL** | Vượt MaxLength |
| reason (delete) | `(9 chars)` | `min-1` | **FAIL** | DTO @MinLength(10) |
| reason (delete) | `(10 chars)` | `min` | **PASS** | Đủ min |
| reason (delete) | `(500 chars)` | `max` | **PASS** | Đúng max |
| reason (delete) | `(501 chars)` | `max+1` | **FAIL** | @MaxLength(500) |
| subjectsCount | `-1` | `min-1` | **FAIL** | @Min(0) |
| subjectsCount | `0` | `min` | **PASS** | Đúng min |
| subjectsCount | `2147483647` | `max` | **PASS** | Int max |
| crime | `(256 chars)` | `max+1` | **FAIL** | @MaxLength(255) |
| unit | `(255 chars)` | `max` | **PASS** |  |
| sourceDocumentNote | `(1001 chars)` | `max+1` | **FAIL** | @MaxLength(1000) |

### 3. Security Payloads (OWASP)

| Target | Payload | Loại tấn công | Kỳ vọng | OWASP Ref |
|--------|---------|---------------|---------|-----------|
| GET /cases?search= | `'; DROP TABLE cases;--` | SQL Injection | Empty result, no SQL error, bảng cases nguyên vẹn | `A03:2021` |
| GET /cases?search= | `' OR '1'='1` | SQL Injection (bypass) | Không expose row ngoài scope | `A03:2021` |
| POST /cases name= | `<script>alert('XSS')</script>` | Stored XSS | Stored raw nhưng render escaped (React) | `A03:2021` |
| POST /cases name= | `<img src=x onerror=alert(1)>` | XSS — img onerror | Escape, không exec | `A03:2021` |
| POST /cases crime= | `javascript:alert(document.cookie)` | XSS — JS scheme | Escape | `A03:2021` |
| GET /cases/:id | `id='cAsE-DIff-TEAM'` | IDOR ngang | 403 ForbiddenException | `A01:2021` |
| POST /cases/:id/restore | `User role thường` | Privilege escalation (vertical) | 403 PermissionsGuard reject | `A01:2021` |
| PATCH /cases/:id/assign | `User non-dispatcher` | Privilege escalation | 403 DispatchGuard reject | `A01:2021` |
| Authorization header | `Bearer (none)` | Auth bypass | 401 JwtAuthGuard | `A07:2021` |
| Authorization header | `Bearer <expired-jwt>` | Session reuse | 401 | `A07:2021` |
| GET /cases/export/ward | `6 request / 60s` | DoS — no rate limit | 429 Too Many Requests | `A04:2021` |
| POST /cases metadata= | `{"__proto__":{"admin":true}}` | Prototype pollution | Reject hoặc strip prototype keys | `A08:2021` |
| POST /cases name= | `AAAAAA…(5000 chars)` | Buffer overflow / Long input | 400 @MaxLength(500) | `A04:2021` |

## 📋 Test Matrix

> Bảng tóm tắt tất cả TC. Format: `priority | type | module | title`.

| TC-ID | Pri | Loại | Module | Tiêu đề | Severity nếu fail |
|-------|-----|------|--------|---------|-------------------|
| [TC-001](#tc-001) | 🔴 P0 | `GREEN` | Create | Tạo vụ án mới với caseProvenance=DIRECT_DISCOVERY thành công | 🚨 Critical |
| [TC-002](#tc-002) | 🔴 P0 | `GREEN` | Create | Tạo Case FROM_PETITION với linkedPetitionId + expectedPetitionUpdatedAt hợp lệ | 🚨 Critical |
| [TC-003](#tc-003) | 🔴 P0 | `GREEN` | Create | Tạo Case FROM_INCIDENT với linkedIncidentId hợp lệ | 🚨 Critical |
| [TC-004](#tc-004) | 🔴 P0 | `GREEN` | Read | Xem chi tiết vụ án được phân công cho mình | ⚠️ High |
| [TC-005](#tc-005) | 🔴 P0 | `GREEN` | Read | Liệt kê danh sách vụ án — paginated default 20/page | ⚠️ High |
| [TC-006](#tc-006) | 🔴 P0 | `GREEN` | Update | Cập nhật name + crime của vụ án | 🚨 Critical |
| [TC-007](#tc-007) | 🔴 P0 | `GREEN` | Delete | Xóa mềm vụ TIEP_NHAN với reason đúng quy cách | 🚨 Critical |
| [TC-008](#tc-008) | 🔴 P0 | `GREEN` | Restore | ADMIN khôi phục vụ án đã xóa mềm | 🚨 Critical |
| [TC-009](#tc-009) | 🔴 P0 | `RED` | Create | Thiếu trường caseProvenance — phải trả 400 | 🚨 Critical |
| [TC-010](#tc-010) | 🔴 P0 | `RED` | Create | FROM_PETITION nhưng không truyền linkedPetitionId — phải 400 | 🚨 Critical |
| [TC-011](#tc-011) | 🔴 P0 | `RED` | Create | FROM_INCIDENT nhưng thiếu linkedIncidentId | 🚨 Critical |
| [TC-018](#tc-018) | 🔴 P0 | `RED` | Update | Optimistic lock: expectedUpdatedAt cũ hơn current → 409 | 🚨 Critical |
| [TC-020](#tc-020) | 🔴 P0 | `RED` | Delete | Xóa vụ có status ≠ TIEP_NHAN bị reject | 🚨 Critical |
| [TC-036](#tc-036) | 🔴 P0 | `STATE` | Update | TIEP_NHAN → DANG_XAC_MINH ghi CaseStatusHistory | 🚨 Critical |
| [TC-037](#tc-037) | 🔴 P0 | `STATE` | Update | DANG_DIEU_TRA → TAM_DINH_CHI auto-set ngayTamDinhChi + soLanTamDinhChi += 1 | 🚨 Critical |
| [TC-041](#tc-041) | 🔴 P0 | `DECISION` | Read | ADMIN xem toàn bộ cases không bị filter scope | 🚨 Critical |
| [TC-042](#tc-042) | 🔴 P0 | `DECISION` | Read | Dispatcher (canDispatch=true) xem full list | 🚨 Critical |
| [TC-043](#tc-043) | 🔴 P0 | `DECISION` | Read | Investigator xem được Case có investigatorId trùng | 🚨 Critical |
| [TC-044](#tc-044) | 🔴 P0 | `DECISION` | Read | User cùng team xem được Case của team mình | 🚨 Critical |
| [TC-045](#tc-045) | 🔴 P0 | `DECISION` | Read | User khác team + khác owner → 403 | 🚨 Critical |
| [TC-046](#tc-046) | 🔴 P0 | `SECURITY` | AuthN | Gọi API không kèm JWT → 401 | 🚨 Critical |
| [TC-047](#tc-047) | 🔴 P0 | `SECURITY` | AuthN | JWT đã hết hạn → 401 | 🚨 Critical |
| [TC-048](#tc-048) | 🔴 P0 | `SECURITY` | AuthZ | User thường gọi /cases/:id/restore → 403 (chỉ ADMIN) | 🚨 Critical |
| [TC-049](#tc-049) | 🔴 P0 | `SECURITY` | AuthZ | Non-dispatcher gọi PATCH /assign → 403 | 🚨 Critical |
| [TC-050](#tc-050) | 🔴 P0 | `SECURITY` | AuthZ | IDOR ngang: user A trực tiếp gọi GET /cases/<id-của-user-B-khác-team> → 403 | 🚨 Critical |
| [TC-051](#tc-051) | 🔴 P0 | `SECURITY` | Injection | SQLi vào search param không thực thi | 🚨 Critical |
| [TC-052](#tc-052) | 🔴 P0 | `SECURITY` | XSS | Stored XSS vào name field — script không thực thi khi render | 🚨 Critical |
| [TC-054](#tc-054) | 🔴 P0 | `SECURITY` | Audit | CASE_CREATED audit log có actor + IP + UA + subjectId | 🚨 Critical |
| [TC-068](#tc-068) | 🔴 P0 | `AUDIT` | Update | CASE_STATUS_CHANGED audit log có fromStatus + toStatus | 🚨 Critical |
| [TC-069](#tc-069) | 🔴 P0 | `AUDIT` | Delete | CASE_DELETED audit log lưu reason đầy đủ + actor | 🚨 Critical |
| [TC-012](#tc-012) | 🟠 P1 | `RED` | Create | linkedPetitionId trỏ tới Petition không tồn tại | ⚠️ High |
| [TC-013](#tc-013) | 🟠 P1 | `RED` | Create | Trường name rỗng → 400 | ⚠️ High |
| [TC-014](#tc-014) | 🟠 P1 | `RED` | Create | Trường name chỉ chứa whitespace | ⚡ Medium |
| [TC-016](#tc-016) | 🟠 P1 | `RED` | Create | subjectsCount âm | ⚠️ High |
| [TC-017](#tc-017) | 🟠 P1 | `RED` | Create | deadline sai định dạng ISO 8601 | ⚠️ High |
| [TC-019](#tc-019) | 🟠 P1 | `RED` | Update | Chuyển status sang TAM_DINH_CHI nhưng thiếu lyDoTamDinhChiVuAn | ⚠️ High |
| [TC-021](#tc-021) | 🟠 P1 | `RED` | Delete | Reason xóa < 10 chars → reject | ⚠️ High |
| [TC-022](#tc-022) | 🟠 P1 | `RED` | Delete | Reason rỗng → 400 | ⚠️ High |
| [TC-023](#tc-023) | 🟠 P1 | `RED` | Restore | Restore vụ chưa bị xóa → reject | ⚠️ High |
| [TC-024](#tc-024) | 🟠 P1 | `RED` | Read | GET /cases/:id với id không tồn tại → 404 | ⚡ Medium |
| [TC-025](#tc-025) | 🟠 P1 | `RED` | Update | PUT /cases/:id với id không tồn tại → 404 | ⚡ Medium |
| [TC-026](#tc-026) | 🟠 P1 | `BOUNDARY` | Create | name = 1 ký tự (min boundary) | 📌 Low |
| [TC-027](#tc-027) | 🟠 P1 | `BOUNDARY` | Create | name = 500 chars (max boundary) | ⚡ Medium |
| [TC-028](#tc-028) | 🟠 P1 | `BOUNDARY` | Create | name = 501 chars (max+1) → 400 | ⚡ Medium |
| [TC-029](#tc-029) | 🟠 P1 | `BOUNDARY` | Delete | reason = 10 chars (min boundary) | ⚡ Medium |
| [TC-030](#tc-030) | 🟠 P1 | `BOUNDARY` | Delete | reason = 500 chars (max boundary) | ⚡ Medium |
| [TC-031](#tc-031) | 🟠 P1 | `BOUNDARY` | Delete | reason = 9 chars (min-1) → reject | ⚡ Medium |
| [TC-032](#tc-032) | 🟠 P1 | `BOUNDARY` | Delete | reason = 501 chars (max+1) → reject | ⚡ Medium |
| [TC-035](#tc-035) | 🟠 P1 | `EP` | List | Filter overdue=true loại trừ DA_KET_LUAN, DA_LUU_TRU, DINH_CHI | ⚠️ High |
| [TC-038](#tc-038) | 🟠 P1 | `STATE` | Update | TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) ghi ngayPhucHoi + ketQuaPhucHoiVuAn | ⚠️ High |
| [TC-039](#tc-039) | 🟠 P1 | `STATE` | Read | GET /cases/:id/status-history trả danh sách giảm dần thời gian | ⚡ Medium |
| [TC-053](#tc-053) | 🟠 P1 | `SECURITY` | RateLimit | Rate limit /export/ward — 5 req/60s vượt → 429 | ⚡ Medium |
| [TC-055](#tc-055) | 🟠 P1 | `DATA` | Create | name có dấu tiếng Việt + chữ hoa + ký tự đặc biệt | ⚠️ High |
| [TC-058](#tc-058) | 🟠 P1 | `DATA` | Create | deadline timezone GMT+7 lưu UTC chuẩn | ⚠️ High |
| [TC-059](#tc-059) | 🟠 P1 | `PERFORMANCE` | List | GET /cases trả về < 2s với 1000 record | ⚡ Medium |
| [TC-061](#tc-061) | 🟠 P1 | `PERFORMANCE` | Update | 5 user concurrent update cùng case → 1 success, 4 conflict 409 | ⚠️ High |
| [TC-065](#tc-065) | 🟠 P1 | `COMPAT` | Browser | Chrome latest desktop 1920x1080 — luồng CRUD đầy đủ | ⚠️ High |
| [TC-015](#tc-015) | 🟡 P2 | `RED` | Create | capDoToiPham enum value không hợp lệ | ⚡ Medium |
| [TC-033](#tc-033) | 🟡 P2 | `EP` | Create | capDoToiPham=IT_NGHIEM_TRONG (class 1/4) | 📌 Low |
| [TC-034](#tc-034) | 🟡 P2 | `EP` | Create | capDoToiPham=DAC_BIET_NGHIEM_TRONG (class 4/4) | 📌 Low |
| [TC-040](#tc-040) | 🟡 P2 | `STATE` | Update | Idempotency: gửi cùng status hiện tại không tạo statusHistory mới | 📌 Low |
| [TC-056](#tc-056) | 🟡 P2 | `DATA` | Create | crime chứa emoji 4-byte + ký tự đặc biệt | 📌 Low |
| [TC-057](#tc-057) | 🟡 P2 | `DATA` | Create | name có leading + trailing whitespace | 📌 Low |
| [TC-060](#tc-060) | 🟡 P2 | `PERFORMANCE` | Export | Export Excel theo phường < 5s với 500 vụ | 📌 Low |
| [TC-062](#tc-062) | 🟡 P2 | `A11Y` | Form | Tab keyboard navigate qua form Create theo thứ tự logic | ⚡ Medium |
| [TC-063](#tc-063) | 🟡 P2 | `A11Y` | Form | Screen reader (NVDA) đọc đúng label + error message | ⚡ Medium |
| [TC-064](#tc-064) | 🟡 P2 | `A11Y` | List | Contrast ratio của badge status ≥ 4.5:1 | ⚡ Medium |
| [TC-066](#tc-066) | 🟡 P2 | `COMPAT` | Mobile | iOS Safari mobile 375x667 — list + detail usable | ⚡ Medium |
| [TC-067](#tc-067) | 🟡 P2 | `COMPAT` | Browser | Edge latest 1366x768 — không vỡ layout | 📌 Low |

## 📝 Test Cases chi tiết

---

## TC-001

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-01`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo vụ án mới với caseProvenance=DIRECT_DISCOVERY thành công

### Điều kiện tiên quyết
- User đã login với role có quyền 'write' subject Case (Điều tra viên)
- Đã có ít nhất 1 Team gắn user
- Token JWT hợp lệ

### Các bước kiểm thử
- [ ] Login với tài khoản dieuTra1@pc02.local
- [ ] Navigate /cases/new
- [ ] Nhập name = 'Vụ trộm cắp xe máy tại Q1 ngày 12/05/2026'
- [ ] Chọn caseProvenance = 'Phát hiện trực tiếp (DIRECT_DISCOVERY)'
- [ ] Nhập crime = 'Trộm cắp tài sản — Đ.173 BLHS'
- [ ] Chọn capDoToiPham = 'NGHIEM_TRONG'
- [ ] Nhập subjectsCount = 2
- [ ] Nhập ngayKhoiTo = '2026-05-12'
- [ ] Click 'Lưu'

### Dữ liệu kiểm thử
```
name='Vụ trộm cắp xe máy tại Q1 ngày 12/05/2026', caseProvenance='DIRECT_DISCOVERY', crime='Trộm cắp tài sản — Đ.173 BLHS', capDoToiPham='NGHIEM_TRONG', subjectsCount=2, ngayKhoiTo='2026-05-12'
```

### Kết quả mong đợi
**UI**:
- Toast 'Tạo vụ án thành công' xuất hiện
- Redirect tới /cases/<id>
- Trang chi tiết hiển thị đầy đủ field vừa nhập
- Status badge hiển thị 'Tiếp nhận'

**API**:
- POST /api/v1/cases trả 201 Created
- Response body: {success:true, data:{id, name, status:'TIEP_NHAN', caseProvenance:'DIRECT_DISCOVERY', createdById:<userId>, assignedTeamId:<teamId>, deadline:<auto-calc>, createdAt, updatedAt}}
- Header Location: /api/v1/cases/<id> (nếu có)

**Side effects** (DB, email, log, queue...):
- DB row trong table cases với deletedAt=NULL, status='TIEP_NHAN'
- Audit log CASE_CREATED có userId, subjectId=<caseId>, ipAddress, userAgent
- assignedTeamId được auto-set theo dataScope của ward officer (v0.33)
- deadline auto-tính từ SystemSetting key caseDeadlineDays

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-001
severity: Critical
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Smoke test chính của feature — fail nghĩa là feature broken hoàn toàn

---

## TC-002

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-02`
- Kỹ thuật: `Use case testing + Decision Table C1`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo Case FROM_PETITION với linkedPetitionId + expectedPetitionUpdatedAt hợp lệ

### Điều kiện tiên quyết
- User login role điều tra viên
- Có sẵn 1 Petition (id=PET-001) status=TIEP_NHAN, updatedAt='2026-05-20T10:00:00.000Z'

### Các bước kiểm thử
- [ ] Login
- [ ] Vào /petitions/PET-001 → click 'Khởi tố vụ án'
- [ ] Form mở với caseProvenance pre-fill = FROM_PETITION, linkedPetitionId=PET-001, expectedPetitionUpdatedAt=PET.updatedAt
- [ ] Nhập name = 'Vụ án từ đơn thư PET-001'
- [ ] Submit

### Dữ liệu kiểm thử
```
linkedPetitionId='PET-001', expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z', caseProvenance='FROM_PETITION', name='Vụ án từ đơn thư PET-001'
```

### Kết quả mong đợi
**UI**:
- Toast 'Tạo vụ án thành công'
- Redirect /cases/<newId>
- Trang detail hiển thị tab 'Nguồn tin' với link sang Petition gốc PET-001
- Trên trang Petition cũng hiển thị badge 'Đã khởi tố thành vụ án' và link sang Case

**API**:
- POST /cases trả 201
- Response data có linkedPetitionId='PET-001', caseProvenance='FROM_PETITION'
- KHÔNG có ConflictException nếu expectedPetitionUpdatedAt khớp

**Side effects** (DB, email, log, queue...):
- Petition.linkedCaseId được set = newId (atomic transaction)
- Petition.status có thể chuyển sang DA_KHOI_TO (tùy spec)
- Audit log CASE_CREATED + PETITION_LINKED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-002
severity: Critical
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Provenance contract Deploy-2 (v0.37.1) — atomic link bắt buộc

---

## TC-003

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-03`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Tạo Case FROM_INCIDENT với linkedIncidentId hợp lệ

### Điều kiện tiên quyết
- User login
- Có Incident id=INC-001 chưa được link

### Các bước kiểm thử
- [ ] Vào /incidents/INC-001 → click 'Khởi tố thành vụ án'
- [ ] Form pre-fill caseProvenance=FROM_INCIDENT, linkedIncidentId=INC-001
- [ ] Nhập name = 'Vụ án từ vụ việc INC-001'
- [ ] Submit

### Dữ liệu kiểm thử
```
linkedIncidentId='INC-001', expectedIncidentUpdatedAt='2026-05-20T11:00:00.000Z', caseProvenance='FROM_INCIDENT'
```

### Kết quả mong đợi
**UI**:
- Toast success
- Detail Case hiển thị link nguồn = Incident INC-001
- Trang Incident hiển thị badge 'Đã khởi tố'

**API**:
- POST /cases 201
- linkedIncidentId='INC-001' trong response

**Side effects** (DB, email, log, queue...):
- Incident.linkedCaseId set = newId
- Audit CASE_CREATED + INCIDENT_LINKED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-003
severity: Critical
module: Create
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
- Module: `Read`
- Yêu cầu: `REQ-CASE-RD-01`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Xem chi tiết vụ án được phân công cho mình

### Điều kiện tiên quyết
- User login (investigator A)
- Có Case id=CASE-001 với investigatorId = A.id

### Các bước kiểm thử
- [ ] Vào /cases
- [ ] Click row CASE-001
- [ ] Quan sát trang detail

### Dữ liệu kiểm thử
```
caseId='CASE-001', user.id='userA'
```

### Kết quả mong đợi
**UI**:
- Hiển thị đủ thông tin: name, crime, status badge, capDoToiPham, deadline, đơn vị, ngày tạo, người được phân công
- Tab 'Lịch sử trạng thái', 'Đối tượng', 'Tài liệu', 'Luật sư' đầy đủ
- Nút 'Sửa' và 'Xóa' hiển thị (đủ quyền)

**API**:
- GET /cases/:id trả 200
- Response data đầy đủ field + relations (investigator, assignedTeam)

**Side effects** (DB, email, log, queue...):
- Không side effect (read-only)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-004
severity: High
module: Read
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
- Module: `Read`
- Yêu cầu: `REQ-CASE-RD-02`
- Kỹ thuật: `Use case testing`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Liệt kê danh sách vụ án — paginated default 20/page

### Điều kiện tiên quyết
- User login
- DB có ≥25 case thuộc scope user

### Các bước kiểm thử
- [ ] Vào /cases
- [ ] Quan sát bảng + pagination
- [ ] Click trang 2

### Dữ liệu kiểm thử
```
default limit=20, offset=0
```

### Kết quả mong đợi
**UI**:
- Bảng hiển thị 20 row
- Pagination control hiển thị 'Trang 1 / 2 (25 vụ)'
- Click trang 2 → 5 row còn lại
- Cột Status badge có màu (TIEP_NHAN xám, DANG_DIEU_TRA xanh dương, TAM_DINH_CHI vàng, etc.)

**API**:
- GET /cases?limit=20&offset=0 → 200, data có 20 item, total=25, page=1, pageSize=20
- GET /cases?limit=20&offset=20 → 200, data có 5 item

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-005
severity: High
module: Read
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
- Module: `Update`
- Yêu cầu: `REQ-CASE-UP-01`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Cập nhật name + crime của vụ án

### Điều kiện tiên quyết
- User login (chính chủ Case)
- Case CASE-001 status=TIEP_NHAN, updatedAt='2026-05-20T08:00:00.000Z'

### Các bước kiểm thử
- [ ] Vào /cases/CASE-001/edit
- [ ] Sửa name = 'Vụ trộm xe máy đã cập nhật'
- [ ] Sửa crime = 'Trộm cắp tài sản (đã reclassify)'
- [ ] Click 'Lưu'

### Dữ liệu kiểm thử
```
name='Vụ trộm xe máy đã cập nhật', crime='Trộm cắp tài sản (đã reclassify)', expectedUpdatedAt='2026-05-20T08:00:00.000Z'
```

### Kết quả mong đợi
**UI**:
- Toast 'Cập nhật vụ án thành công'
- Redirect /cases/CASE-001
- Trang detail hiển thị giá trị mới
- updatedAt đổi sang giá trị mới

**API**:
- PUT /cases/CASE-001 → 200
- Response data có name + crime mới, updatedAt mới

**Side effects** (DB, email, log, queue...):
- DB row updated
- Audit log CASE_UPDATED chứa diff before/after (v0.30 wrapUpdate)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-006
severity: Critical
module: Update
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
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-01`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa mềm vụ TIEP_NHAN với reason đúng quy cách

### Điều kiện tiên quyết
- User login (creator hoặc admin)
- Case CASE-100 status=TIEP_NHAN

### Các bước kiểm thử
- [ ] Mở /cases/CASE-100
- [ ] Click 'Xóa vụ án'
- [ ] Modal hiện ra yêu cầu nhập reason
- [ ] Nhập reason = 'Trùng lặp với CASE-099 — đã được phát hiện sau khi đối chiếu hồ sơ ngày 22/05/2026'
- [ ] Confirm

### Dữ liệu kiểm thử
```
caseId='CASE-100', reason='Trùng lặp với CASE-099 — đã được phát hiện sau khi đối chiếu hồ sơ ngày 22/05/2026' (76 chars)
```

### Kết quả mong đợi
**UI**:
- Modal đóng
- Toast 'Đã xóa vụ án (có thể khôi phục)'
- Redirect /cases
- CASE-100 biến mất khỏi list

**API**:
- DELETE /cases/CASE-100 với body {reason: '...'} → 200
- Response: {success:true, message:'Đã xóa vụ án'}

**Side effects** (DB, email, log, queue...):
- DB: cases.deletedAt set timestamp; row vẫn còn
- Audit CASE_DELETED chứa reason đầy đủ
- Linked Petition/Incident KHÔNG bị xóa (onDelete: Restrict)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-007
severity: Critical
module: Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Test với cả creator (v0.31.0.2) và admin

---

## TC-008

**Meta**:
- Loại: `GREEN`
- Priority: `P0` 🔴
- Module: `Restore`
- Yêu cầu: `REQ-CASE-RES-01`
- Kỹ thuật: `Use case testing`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: ADMIN khôi phục vụ án đã xóa mềm

### Điều kiện tiên quyết
- Login với role ADMIN
- Case CASE-100 đã bị soft-deleted

### Các bước kiểm thử
- [ ] Vào /admin/deleted-cases (hoặc /cases/admin/deleted)
- [ ] Tìm CASE-100
- [ ] Click 'Khôi phục'
- [ ] Nhập reason = 'Khôi phục theo yêu cầu Trưởng phòng — biên bản số 15 ngày 22/05/2026'
- [ ] Confirm

### Dữ liệu kiểm thử
```
caseId='CASE-100', reason='Khôi phục theo yêu cầu Trưởng phòng — biên bản số 15 ngày 22/05/2026'
```

### Kết quả mong đợi
**UI**:
- Toast 'Khôi phục vụ án thành công'
- CASE-100 quay lại /cases list với status TIEP_NHAN nguyên trạng

**API**:
- POST /cases/CASE-100/restore với {reason} → 200
- Response data có Case đã restore

**Side effects** (DB, email, log, queue...):
- DB: deletedAt set NULL
- Audit CASE_RESTORED + reason

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Restore`
- Happy path flow: check business logic chính

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-008
severity: Critical
module: Restore
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
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-01`
- Kỹ thuật: `Error guessing — required field`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Thiếu trường caseProvenance — phải trả 400

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] Gửi POST /api/v1/cases với body {name:'X', crime:'Y'} — KHÔNG có caseProvenance
- [ ] Quan sát response

### Dữ liệu kiểm thử
```
body = {name:'Vụ X', crime:'Trộm cắp'} — không có caseProvenance
```

### Kết quả mong đợi
**UI**:
- Nếu qua UI: nút 'Lưu' phải disabled cho đến khi chọn provenance; hoặc validation error đỏ ngay dưới field 'Nguồn tin'

**API**:
- POST /cases trả 400 Bad Request
- Response message chứa 'caseProvenance bắt buộc — chọn FROM_PETITION / FROM_INCIDENT / DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE (BLTTHS Đ.143)'

**Side effects** (DB, email, log, queue...):
- Không có row nào được insert vào cases
- Không có audit log CASE_CREATED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-009
severity: Critical
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.37.1 Provenance contract — required field

---

## TC-010

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-02`
- Kỹ thuật: `Conditional validation`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: FROM_PETITION nhưng không truyền linkedPetitionId — phải 400

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases body {name:'X', caseProvenance:'FROM_PETITION'} — không có linkedPetitionId

### Dữ liệu kiểm thử
```
body={name:'Vụ X', caseProvenance:'FROM_PETITION'}
```

### Kết quả mong đợi
**UI**:
- Validation đỏ dưới field 'Đơn thư liên kết'

**API**:
- Bad Request
- Message: 'linkedPetitionId required when caseProvenance is FROM_PETITION'

**Side effects** (DB, email, log, queue...):
- Không insert + không audit

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-010
severity: Critical
module: Create
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
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-03`
- Kỹ thuật: `Conditional validation`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: FROM_INCIDENT nhưng thiếu linkedIncidentId

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases body {name:'X', caseProvenance:'FROM_INCIDENT'} — không có linkedIncidentId

### Dữ liệu kiểm thử
```
body={name:'X', caseProvenance:'FROM_INCIDENT'}
```

### Kết quả mong đợi
**UI**:
- Validation đỏ dưới field 'Vụ việc liên kết'

**API**:
- Message: 'linkedIncidentId required when caseProvenance is FROM_INCIDENT'

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-011
severity: Critical
module: Create
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
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Update`
- Yêu cầu: `REQ-CASE-UP-LOCK`
- Kỹ thuật: `Race condition / Concurrent edit`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Optimistic lock: expectedUpdatedAt cũ hơn current → 409

### Điều kiện tiên quyết
- User A và B cùng mở /cases/CASE-001/edit
- A submit trước → updatedAt server đổi thành T2

### Các bước kiểm thử
- [ ] User A mở form (snapshot updatedAt=T1)
- [ ] User B mở form (snapshot updatedAt=T1)
- [ ] User A submit name='Vụ X bởi A' → success, updatedAt → T2
- [ ] User B submit name='Vụ X bởi B' với expectedUpdatedAt=T1
- [ ] Quan sát response B

### Dữ liệu kiểm thử
```
expectedUpdatedAt='2026-05-22T10:00:00.000Z' (cũ), server hiện 'T2 = 2026-05-22T10:05:00.000Z'
```

### Kết quả mong đợi
**UI**:
- User B nhận toast lỗi 'Hồ sơ đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.'

**API**:
- Conflict
- Body: {message:'Hồ sơ đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang và thử lại.'}

**Side effects** (DB, email, log, queue...):
- Update của User B KHÔNG được apply
- Audit log KHÔNG có CASE_UPDATED cho User B

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-018
severity: Critical
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify race condition không gây lost update

---

## TC-020

**Meta**:
- Loại: `RED`
- Priority: `P0` 🔴
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-RULE`
- Kỹ thuật: `Decision Table / Business rule`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Xóa vụ có status ≠ TIEP_NHAN bị reject

### Điều kiện tiên quyết
- Case CASE-300 status=DANG_DIEU_TRA

### Các bước kiểm thử
- [ ] GET /cases/CASE-300/delete-preflight → kiểm tra response
- [ ] DELETE /cases/CASE-300 với reason hợp lệ

### Dữ liệu kiểm thử
```
caseId='CASE-300', reason='Lý do hợp lệ 12345', status hiện tại='DANG_DIEU_TRA'
```

### Kết quả mong đợi
**UI**:
- Nút 'Xóa' phải disabled hoặc ẩn
- Nếu force qua API → toast lỗi 'Trạng thái hiện tại không cho phép xóa (chỉ Tiếp nhận). Hiện: Đang điều tra.'

**API**:
- Preflight: trả về canDelete=false + reason
- DELETE: 400 hoặc 403 với message như expected_ui

**Side effects** (DB, email, log, queue...):
- deletedAt KHÔNG được set
- Không có audit CASE_DELETED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-020
severity: Critical
module: Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Atomic status TOCTOU guard tại cases.service.ts:861

---

## TC-036

**Meta**:
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Update`
- Yêu cầu: `REQ-CASE-STATE-01`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: TIEP_NHAN → DANG_XAC_MINH ghi CaseStatusHistory

### Điều kiện tiên quyết
- Case CASE-T01 status=TIEP_NHAN, statusHistory rỗng

### Các bước kiểm thử
- [ ] PUT /cases/CASE-T01 {status:'DANG_XAC_MINH', expectedUpdatedAt}

### Dữ liệu kiểm thử
```
fromStatus='TIEP_NHAN', toStatus='DANG_XAC_MINH'
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị status badge mới + tab 'Lịch sử' có 1 dòng mới

**API**:
- data.status='DANG_XAC_MINH'
- GET /cases/CASE-T01/status-history trả 1 record {fromStatus:'TIEP_NHAN', toStatus:'DANG_XAC_MINH', changedById, createdAt}

**Side effects** (DB, email, log, queue...):
- DB cases.status='DANG_XAC_MINH'
- case_status_history có 1 row mới
- Audit CASE_STATUS_CHANGED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-036
severity: Critical
module: Update
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
- Loại: `STATE`
- Priority: `P0` 🔴
- Module: `Update`
- Yêu cầu: `REQ-CASE-STATE-TDC`
- Kỹ thuật: `State Transition + Side effect`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: DANG_DIEU_TRA → TAM_DINH_CHI auto-set ngayTamDinhChi + soLanTamDinhChi += 1

### Điều kiện tiên quyết
- Case CASE-T02 status=DANG_DIEU_TRA, soLanTamDinhChi=0, ngayTamDinhChi=NULL

### Các bước kiểm thử
- [ ] PUT /cases/CASE-T02 {status:'TAM_DINH_CHI', lyDoTamDinhChiVuAn:'CHUA_XAC_DINH_BI_CAN', soQuyetDinhTamDinhChi:'QĐ-001/2026'}

### Dữ liệu kiểm thử
```
status='TAM_DINH_CHI', lyDoTamDinhChiVuAn='CHUA_XAC_DINH_BI_CAN'
```

### Kết quả mong đợi
**UI**:
- Status badge đổi 'Tạm đình chỉ'
- Hiển thị section TĐC với 'Số lần TĐC: 1', 'Ngày TĐC: <today>', 'Lý do: Chưa xác định được bị can'

**API**:
- data: {status:'TAM_DINH_CHI', soLanTamDinhChi:1, ngayTamDinhChi:<now>, lyDoTamDinhChiVuAn:'CHUA_XAC_DINH_BI_CAN'}

**Side effects** (DB, email, log, queue...):
- DB updated
- CaseStatusHistory có row mới
- Audit CASE_STATUS_CHANGED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-037
severity: Critical
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Logic cases.service.ts:601-607

---

## TC-041

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Read`
- Yêu cầu: `REQ-CASE-SCOPE-ADMIN`
- Kỹ thuật: `Decision Table C1`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: ADMIN xem toàn bộ cases không bị filter scope

### Điều kiện tiên quyết
- Login ADMIN. DB có 50 case thuộc nhiều team khác nhau

### Các bước kiểm thử
- [ ] GET /cases?limit=100

### Dữ liệu kiểm thử
```
user.role=ADMIN, dataScope=null
```

### Kết quả mong đợi
**UI**:
- Bảng hiển thị toàn bộ 50 case

**API**:
- , total=50

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-041
severity: Critical
module: Read
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
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Read`
- Yêu cầu: `REQ-CASE-SCOPE-DISPATCH`
- Kỹ thuật: `Decision Table C2`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Dispatcher (canDispatch=true) xem full list

### Điều kiện tiên quyết
- User login với role có canDispatch=true

### Các bước kiểm thử
- [ ] GET /cases

### Dữ liệu kiểm thử
```
dataScope.canDispatch=true
```

### Kết quả mong đợi
**UI**:
- Hiển thị tất cả case toàn cơ quan

**API**:
- , không apply scopeFilter

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-042
severity: Critical
module: Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: checkRecordInScope return early nếu canDispatch

---

## TC-043

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Read`
- Yêu cầu: `REQ-CASE-SCOPE-OWNER`
- Kỹ thuật: `Decision Table C3`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Investigator xem được Case có investigatorId trùng

### Điều kiện tiên quyết
- User A id='userA', Case CASE-O1 investigatorId='userA', assignedTeamId='teamX' (userA không trong teamX)

### Các bước kiểm thử
- [ ] GET /cases/CASE-O1

### Dữ liệu kiểm thử
```
user.id='userA', case.investigatorId='userA'
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị bình thường

**API**:

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-043
severity: Critical
module: Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: ownerMatch logic

---

## TC-044

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Read`
- Yêu cầu: `REQ-CASE-SCOPE-TEAM`
- Kỹ thuật: `Decision Table C4`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User cùng team xem được Case của team mình

### Điều kiện tiên quyết
- User B trong team T1; Case CASE-O2 assignedTeamId='T1', investigatorId='userOther'

### Các bước kiểm thử
- [ ] GET /cases/CASE-O2

### Dữ liệu kiểm thử
```
user.teams=['T1'], case.assignedTeamId='T1'
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị

**API**:

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-044
severity: Critical
module: Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: teamMatch logic

---

## TC-045

**Meta**:
- Loại: `DECISION`
- Priority: `P0` 🔴
- Module: `Read`
- Yêu cầu: `REQ-CASE-SCOPE-DENY`
- Kỹ thuật: `Decision Table C5`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User khác team + khác owner → 403

### Điều kiện tiên quyết
- User C team='T2'; Case CASE-O3 assignedTeamId='T1', investigatorId='userOther'

### Các bước kiểm thử
- [ ] GET /cases/CASE-O3

### Dữ liệu kiểm thử
```
user.teams=['T2'], case.assignedTeamId='T1', investigatorId≠userC
```

### Kết quả mong đợi
**UI**:
- Trang hiển thị 'Bạn không có quyền truy cập bản ghi này' hoặc redirect /403

**API**:
- Forbidden
- Message: 'Bạn không có quyền truy cập bản ghi này'

**Side effects** (DB, email, log, queue...):
- Audit ACCESS_DENIED log nếu có

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-045
severity: Critical
module: Read
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Security boundary — IDOR vertical/horizontal

---

## TC-046

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `AuthN`
- Yêu cầu: `REQ-CASE-AUTHN-01`
- Kỹ thuật: `Security — auth check`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Gọi API không kèm JWT → 401

### Điều kiện tiên quyết
- Không có token

### Các bước kiểm thử
- [ ] curl GET /api/v1/cases (không header Authorization)

### Dữ liệu kiểm thử
```
headers: {} (no Authorization)
```

### Kết quả mong đợi
**UI**:
- Redirect /login

**API**:
- Unauthorized
- Message kiểu 'Unauthorized'

**Side effects** (DB, email, log, queue...):
- Không audit (không truy cập được)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `AuthN`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `AuthN`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-046
severity: Critical
module: AuthN
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: JwtAuthGuard

---

## TC-047

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `AuthN`
- Yêu cầu: `REQ-CASE-AUTHN-02`
- Kỹ thuật: `Security — token expired`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: JWT đã hết hạn → 401

### Điều kiện tiên quyết
- Có token đã hết exp

### Các bước kiểm thử
- [ ] GET /cases với Authorization: Bearer <expired-token>

### Dữ liệu kiểm thử
```
Authorization: Bearer <jwt với exp < now>
```

### Kết quả mong đợi
**UI**:
- Redirect /login + toast 'Phiên đăng nhập hết hạn'

**API**:
- + message expired

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `AuthN`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `AuthN`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-047
severity: Critical
module: AuthN
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
- Priority: `P0` 🔴
- Module: `AuthZ`
- Yêu cầu: `REQ-CASE-AUTHZ-RESTORE`
- Kỹ thuật: `Security — RBAC`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: User thường gọi /cases/:id/restore → 403 (chỉ ADMIN)

### Điều kiện tiên quyết
- Login user role điều tra viên (không ADMIN)

### Các bước kiểm thử
- [ ] POST /cases/CASE-100/restore {reason:'test'}

### Dữ liệu kiểm thử
```
user.role='DIEU_TRA_VIEN', không có permission 'restore' subject Case
```

### Kết quả mong đợi
**UI**:
- Toast 'Bạn không có quyền thực hiện hành động này'

**API**:
- PermissionsGuard reject

**Side effects** (DB, email, log, queue...):
- deletedAt giữ nguyên

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `AuthZ`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `AuthZ`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-048
severity: Critical
module: AuthZ
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: @RequirePermissions({action:'restore', subject:'Case'})

---

## TC-049

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `AuthZ`
- Yêu cầu: `REQ-CASE-AUTHZ-ASSIGN`
- Kỹ thuật: `Security — RBAC`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Non-dispatcher gọi PATCH /assign → 403

### Điều kiện tiên quyết
- User login role điều tra viên thường

### Các bước kiểm thử
- [ ] PATCH /cases/CASE-001/assign {investigatorId:'userX'}

### Dữ liệu kiểm thử
```
user.canDispatch=false
```

### Kết quả mong đợi
**UI**:
- Nút 'Phân công' không hiển thị; nếu force qua API → toast 403

**API**:
- + DispatchGuard reject

**Side effects** (DB, email, log, queue...):
- investigatorId không thay đổi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `AuthZ`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `AuthZ`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-049
severity: Critical
module: AuthZ
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: DispatchGuard

---

## TC-050

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `AuthZ`
- Yêu cầu: `REQ-CASE-IDOR`
- Kỹ thuật: `Security — IDOR`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: IDOR ngang: user A trực tiếp gọi GET /cases/<id-của-user-B-khác-team> → 403

### Điều kiện tiên quyết
- User A team=T1; Case CASE-B1 thuộc team T2 investigator user B

### Các bước kiểm thử
- [ ] User A login lấy token
- [ ] Đoán/dò id CASE-B1
- [ ] curl GET /cases/CASE-B1 với token A

### Dữ liệu kiểm thử
```
userA token, target=CASE-B1 (team khác)
```

### Kết quả mong đợi
**UI**:
- Trang 'Không có quyền'

**API**:
- (NotFoundException → 404 hoặc Forbidden, kỳ vọng 403)

**Side effects** (DB, email, log, queue...):
- Có thể log ACCESS_DENIED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `AuthZ`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `AuthZ`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-050
severity: Critical
module: AuthZ
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: OWASP A01:2021 Broken Access Control

---

## TC-051

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Injection`
- Yêu cầu: `REQ-CASE-SECURITY-SQLI`
- Kỹ thuật: `Security — SQL Injection`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: SQLi vào search param không thực thi

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] GET /cases?search=%27%3B%20DROP%20TABLE%20cases%3B--

### Dữ liệu kiểm thử
```
search="'; DROP TABLE cases;--"
```

### Kết quả mong đợi
**UI**:
- List trả empty hoặc không match

**API**:
- + data=[]
- KHÔNG có SQL error
- KHÔNG drop bảng

**Side effects** (DB, email, log, queue...):
- Bảng cases vẫn còn (count = trước)
- Prisma sử dụng parameterized query → an toàn

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Injection`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Injection`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-051
severity: Critical
module: Injection
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: OWASP A03:2021

---

## TC-052

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `XSS`
- Yêu cầu: `REQ-CASE-SECURITY-XSS`
- Kỹ thuật: `Security — XSS stored`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: Stored XSS vào name field — script không thực thi khi render

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name='<script>alert("XSS")</script>', caseProvenance='DIRECT_DISCOVERY'
- [ ] GET /cases/:id và render trang detail

### Dữ liệu kiểm thử
```
name='<script>alert("XSS")</script>'
```

### Kết quả mong đợi
**UI**:
- Tên hiển thị literal '<script>alert("XSS")</script>' KHÔNG có alert popup

**API**:
- (insert được vì không có whitelist) — nhưng response trả nguyên text

**Side effects** (DB, email, log, queue...):
- DB lưu chuỗi raw
- React/JSX escape → an toàn render
- Audit log không break do payload

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `XSS`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `XSS`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-052
severity: Critical
module: XSS
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: OWASP A03:2021 — escape mặc định của React

---

## TC-054

**Meta**:
- Loại: `SECURITY`
- Priority: `P0` 🔴
- Module: `Audit`
- Yêu cầu: `REQ-CASE-AUDIT-CREATE`
- Kỹ thuật: `Security — audit trail`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CASE_CREATED audit log có actor + IP + UA + subjectId

### Điều kiện tiên quyết
- User login từ IP 192.168.1.50 UA Chrome

### Các bước kiểm thử
- [ ] POST /cases (tạo thành công)
- [ ] SELECT * FROM audit_logs WHERE action='CASE_CREATED' ORDER BY createdAt DESC LIMIT 1

### Dữ liệu kiểm thử
```
User.id='userA', IP='192.168.1.50', UA='Mozilla/5.0 (Chrome)'
```

### Kết quả mong đợi
**UI**:
- Trang /admin/audit-logs hiển thị log mới với đủ field

**API**:
- Audit log endpoint trả {userId:'userA', action:'CASE_CREATED', subject:'Case', subjectId:<caseId>, ipAddress:'192.168.1.50', userAgent:'Mozilla/5.0 (Chrome)', createdAt}

**Side effects** (DB, email, log, queue...):
- Audit log INSERT thành công

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Audit`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Audit`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-054
severity: Critical
module: Audit
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: OWASP A09:2021 Logging Failures

---

## TC-068

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: `Update`
- Yêu cầu: `REQ-CASE-AUDIT-STATUS`
- Kỹ thuật: `Audit — log content`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CASE_STATUS_CHANGED audit log có fromStatus + toStatus

### Điều kiện tiên quyết
- User login. Case CASE-A01 status=TIEP_NHAN

### Các bước kiểm thử
- [ ] PUT /cases/CASE-A01 {status:'DANG_XAC_MINH', expectedUpdatedAt}
- [ ] SELECT * FROM audit_logs WHERE subjectId='CASE-A01' AND action='CASE_STATUS_CHANGED'

### Dữ liệu kiểm thử
```
transition TIEP_NHAN→DANG_XAC_MINH
```

### Kết quả mong đợi
**UI**:
- Trang /admin/audit-logs row mới hiển thị diff

**API**:
- Log entry: {action:'CASE_STATUS_CHANGED', metadata:{fromStatus:'TIEP_NHAN', toStatus:'DANG_XAC_MINH', changedAt}}

**Side effects** (DB, email, log, queue...):
- audit_logs row mới
- case_status_history cũng có row mới (double-tracking)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-068
severity: Critical
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Logic cases.service.ts:684-696

---

## TC-069

**Meta**:
- Loại: `AUDIT`
- Priority: `P0` 🔴
- Module: `Delete`
- Yêu cầu: `REQ-CASE-AUDIT-DELETE`
- Kỹ thuật: `Audit — log content`
- Risk: `Cao`
- Severity nếu fail: `Critical` 🚨

**Tiêu đề**: CASE_DELETED audit log lưu reason đầy đủ + actor

### Điều kiện tiên quyết
- User login (creator), Case TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/CASE-A02 {reason:'Trùng lặp với CASE-098 — đối chiếu hồ sơ 23/05/2026'}
- [ ] Kiểm tra audit_logs

### Dữ liệu kiểm thử
```
reason='Trùng lặp với CASE-098 — đối chiếu hồ sơ 23/05/2026' (62 chars)
```

### Kết quả mong đợi
**UI**:
- Audit log dashboard hiển thị reason đầy đủ

**API**:
- Log: {action:'CASE_DELETED', userId, subjectId:'CASE-A02', metadata:{reason:<full text>}}

**Side effects** (DB, email, log, queue...):
- audit_logs INSERT
- cases.deletedAt set
- Transaction atomic — nếu log fail thì rollback delete

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-069
severity: Critical
module: Delete
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: v0.31.0.2 — $transaction wrap

---

## TC-012

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-04`
- Kỹ thuật: `Error guessing`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: linkedPetitionId trỏ tới Petition không tồn tại

### Điều kiện tiên quyết
- User login. Petition id='NONEXISTENT-999' không có trong DB

### Các bước kiểm thử
- [ ] POST /cases với caseProvenance=FROM_PETITION, linkedPetitionId='NONEXISTENT-999', expectedPetitionUpdatedAt='2026-05-20T10:00:00.000Z'

### Dữ liệu kiểm thử
```
linkedPetitionId='NONEXISTENT-999'
```

### Kết quả mong đợi
**UI**:
- Toast lỗi 'Đơn thư liên kết không tồn tại'

**API**:
- hoặc 404
- Message rõ ràng về Petition not found

**Side effects** (DB, email, log, queue...):
- Không có Case nào insert; Prisma FK CHECK constraint reject

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-012
severity: High
module: Create
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
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-05`
- Kỹ thuật: `Error guessing`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Trường name rỗng → 400

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases body {name:'', caseProvenance:'DIRECT_DISCOVERY'}

### Dữ liệu kiểm thử
```
name=''
```

### Kết quả mong đợi
**UI**:
- Field name viền đỏ + error 'Tên vụ án bắt buộc'

**API**:
- Message liên quan @IsString hoặc @MaxLength validation

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-013
severity: High
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: @IsString không cho phép undefined nhưng cho phép '' — kiểm chứng có @IsNotEmpty không

---

## TC-014

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-06`
- Kỹ thuật: `Error guessing — invalid whitespace`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Trường name chỉ chứa whitespace

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases body {name:'      ', caseProvenance:'DIRECT_DISCOVERY'}

### Dữ liệu kiểm thử
```
name='      ' (6 space)
```

### Kết quả mong đợi
**UI**:
- Field name viền đỏ

**API**:
- (kỳ vọng có trim + reject empty)
- Hoặc nếu trim không có thì là defect cần raise

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-014
severity: Medium
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify có trim hay không — nếu insert được tên 6 space là defect

---

## TC-016

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-08`
- Kỹ thuật: `BVA — below min`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: subjectsCount âm

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases với subjectsCount=-1

### Dữ liệu kiểm thử
```
subjectsCount=-1
```

### Kết quả mong đợi
**UI**:
- Field viền đỏ + error 'Số đối tượng phải ≥ 0'

**API**:
- (vi phạm @Min(0))
- Message dạng 'subjectsCount must not be less than 0'

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-016
severity: High
module: Create
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
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-09`
- Kỹ thuật: `Error guessing — invalid format`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: deadline sai định dạng ISO 8601

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases với deadline='22-05-2026 10:00'

### Dữ liệu kiểm thử
```
deadline='22-05-2026 10:00' (sai format)
```

### Kết quả mong đợi
**UI**:
- Field deadline viền đỏ + error format

**API**:
- (vi phạm @IsDateString)
- Message liên quan ISO 8601

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-017
severity: High
module: Create
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
- Priority: `P1` 🟠
- Module: `Update`
- Yêu cầu: `REQ-CASE-UP-TDC`
- Kỹ thuật: `Business rule validation`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chuyển status sang TAM_DINH_CHI nhưng thiếu lyDoTamDinhChiVuAn

### Điều kiện tiên quyết
- Case CASE-200 status=DANG_DIEU_TRA
- User login

### Các bước kiểm thử
- [ ] PUT /cases/CASE-200 với {status:'TAM_DINH_CHI'} — không kèm lyDoTamDinhChiVuAn

### Dữ liệu kiểm thử
```
{status:'TAM_DINH_CHI'} — thiếu lý do
```

### Kết quả mong đợi
**UI**:
- Validation đỏ — bắt buộc chọn lý do tạm đình chỉ theo Đ.229

**API**:
- (kỳ vọng business validation reject)
- Nếu BE không enforce → defect — phải raise

**Side effects** (DB, email, log, queue...):
- Không insert statusHistory; không tăng soLanTamDinhChi

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-019
severity: High
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify spec — backend có enforce required lý do hay chỉ FE

---

## TC-021

**Meta**:
- Loại: `RED`
- Priority: `P1` 🟠
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL`
- Kỹ thuật: `BVA — below min`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Reason xóa < 10 chars → reject

### Điều kiện tiên quyết
- Case CASE-400 status=TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/CASE-400 với body {reason:'Sai mất'}

### Dữ liệu kiểm thử
```
reason='Sai mất' (7 chars)
```

### Kết quả mong đợi
**UI**:
- Modal hiện validation đỏ 'Lý do phải ≥ 10 ký tự'

**API**:
- Message validation @MinLength(10)

**Side effects** (DB, email, log, queue...):
- deletedAt không set

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-021
severity: High
module: Delete
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
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL`
- Kỹ thuật: `Error guessing`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Reason rỗng → 400

### Điều kiện tiên quyết
- Case CASE-401 status=TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/CASE-401 body {reason:''}

### Dữ liệu kiểm thử
```
reason=''
```

### Kết quả mong đợi
**UI**:
- Modal hiện validation 'Lý do bắt buộc'

**API**:
- + message validation

**Side effects** (DB, email, log, queue...):
- Không delete

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-022
severity: High
module: Delete
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
- Priority: `P1` 🟠
- Module: `Restore`
- Yêu cầu: `REQ-CASE-RES-VAL`
- Kỹ thuật: `Business rule`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Restore vụ chưa bị xóa → reject

### Điều kiện tiên quyết
- Case CASE-500 deletedAt=NULL (chưa xóa)

### Các bước kiểm thử
- [ ] POST /cases/CASE-500/restore với reason hợp lệ

### Dữ liệu kiểm thử
```
caseId='CASE-500' (chưa deleted)
```

### Kết quả mong đợi
**UI**:
- Toast 'Vụ án này không ở trạng thái đã xóa'

**API**:
- hoặc 404
- Message tương ứng

**Side effects** (DB, email, log, queue...):
- Không thay đổi gì

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Restore`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Restore`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-023
severity: High
module: Restore
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
- Module: `Read`
- Yêu cầu: `REQ-CASE-RD-404`
- Kỹ thuật: `Error guessing`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET /cases/:id với id không tồn tại → 404

### Điều kiện tiên quyết
- User login. Không có Case nào id='NOT-EXIST-999'

### Các bước kiểm thử
- [ ] GET /cases/NOT-EXIST-999

### Dữ liệu kiểm thử
```
caseId='NOT-EXIST-999'
```

### Kết quả mong đợi
**UI**:
- Trang hiển thị 'Không tìm thấy vụ án' + nút quay về list

**API**:
- Not Found
- Message: 'Không tìm thấy vụ án'

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-024
severity: Medium
module: Read
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
- Module: `Update`
- Yêu cầu: `REQ-CASE-UP-404`
- Kỹ thuật: `Error guessing`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: PUT /cases/:id với id không tồn tại → 404

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] PUT /cases/NOT-EXIST-999 với body hợp lệ

### Dữ liệu kiểm thử
```
caseId='NOT-EXIST-999'
```

### Kết quả mong đợi
**UI**:
- Toast 'Không tìm thấy vụ án'

**API**:

**Side effects** (DB, email, log, queue...):
- Không update

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-025
severity: Medium
module: Update
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-NAME-MIN`
- Kỹ thuật: `BVA — min`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name = 1 ký tự (min boundary)

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name='A', caseProvenance='DIRECT_DISCOVERY'

### Dữ liệu kiểm thử
```
name='A'
```

### Kết quả mong đợi
**UI**:
- Tạo thành công (DTO không có @MinLength)

**API**:
- (kỳ vọng pass — chỉ @MaxLength(500))

**Side effects** (DB, email, log, queue...):
- Insert thành công

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-026
severity: Low
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Nếu spec yêu cầu min ≥3 char thì raise defect

---

## TC-027

**Meta**:
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-NAME-MAX`
- Kỹ thuật: `BVA — max`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: name = 500 chars (max boundary)

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name=<chuỗi 500 ký tự 'A...A'>, caseProvenance='DIRECT_DISCOVERY'

### Dữ liệu kiểm thử
```
name='A' × 500
```

### Kết quả mong đợi
**UI**:
- Toast success

**API**:

**Side effects** (DB, email, log, queue...):
- Insert thành công, DB column name = 500 chars

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-027
severity: Medium
module: Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-NAME-MAX-PLUS`
- Kỹ thuật: `BVA — max+1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: name = 501 chars (max+1) → 400

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name=<501 ký tự>

### Dữ liệu kiểm thử
```
name='A' × 501
```

### Kết quả mong đợi
**UI**:
- Field name viền đỏ + error 'Không quá 500 ký tự'

**API**:
- Message vi phạm @MaxLength(500)

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-028
severity: Medium
module: Create
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL-MIN`
- Kỹ thuật: `BVA — min`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: reason = 10 chars (min boundary)

### Điều kiện tiên quyết
- Case TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/:id reason='Trùng lặp1' (đúng 10 chars)

### Dữ liệu kiểm thử
```
reason='Trùng lặp1' (10 chars)
```

### Kết quả mong đợi
**UI**:
- Toast success

**API**:

**Side effects** (DB, email, log, queue...):
- Soft deleted + audit

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-029
severity: Medium
module: Delete
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL-MAX`
- Kỹ thuật: `BVA — max`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: reason = 500 chars (max boundary)

### Điều kiện tiên quyết
- Case TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/:id reason=<500 ký tự>

### Dữ liệu kiểm thử
```
reason='A' × 500
```

### Kết quả mong đợi
**UI**:
- Success

**API**:

**Side effects** (DB, email, log, queue...):
- Audit reason = 500 chars

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-030
severity: Medium
module: Delete
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL-MIN-MINUS`
- Kỹ thuật: `BVA — min-1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: reason = 9 chars (min-1) → reject

### Điều kiện tiên quyết
- Case TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/:id reason='Trùng lặp' (9 chars)

### Dữ liệu kiểm thử
```
reason='Trùng lặp' (9 chars)
```

### Kết quả mong đợi
**UI**:
- Validation đỏ

**API**:
- + message MinLength

**Side effects** (DB, email, log, queue...):
- Không delete

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-031
severity: Medium
module: Delete
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
- Loại: `BOUNDARY`
- Priority: `P1` 🟠
- Module: `Delete`
- Yêu cầu: `REQ-CASE-DEL-VAL-MAX-PLUS`
- Kỹ thuật: `BVA — max+1`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: reason = 501 chars (max+1) → reject

### Điều kiện tiên quyết
- Case TIEP_NHAN

### Các bước kiểm thử
- [ ] DELETE /cases/:id reason=<501 ký tự>

### Dữ liệu kiểm thử
```
reason='A' × 501
```

### Kết quả mong đợi
**UI**:
- Validation đỏ

**API**:
- + MaxLength

**Side effects** (DB, email, log, queue...):
- Không delete

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Delete`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Delete`
- Validation rules: check min/max constraints trong schema/DTO

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-032
severity: Medium
module: Delete
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
- Loại: `EP`
- Priority: `P1` 🟠
- Module: `List`
- Yêu cầu: `REQ-CASE-LIST-OVERDUE`
- Kỹ thuật: `EP — partition logic`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Filter overdue=true loại trừ DA_KET_LUAN, DA_LUU_TRU, DINH_CHI

### Điều kiện tiên quyết
- DB có 5 case: 2 status=DANG_DIEU_TRA deadline quá hạn, 1 DA_KET_LUAN deadline quá hạn, 1 DA_LUU_TRU quá hạn, 1 DINH_CHI quá hạn

### Các bước kiểm thử
- [ ] GET /cases?overdue=true

### Dữ liệu kiểm thử
```
overdue=true
```

### Kết quả mong đợi
**UI**:
- Danh sách chỉ hiển thị 2 case (loại trừ DA_KET_LUAN/DA_LUU_TRU/DINH_CHI)

**API**:
- data.length = 2
- total = 2

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `List`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `List`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-035
severity: High
module: List
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Logic trong cases.service.ts:98-103

---

## TC-038

**Meta**:
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Update`
- Yêu cầu: `REQ-CASE-STATE-PHUC-HOI`
- Kỹ thuật: `State Transition`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) ghi ngayPhucHoi + ketQuaPhucHoiVuAn

### Điều kiện tiên quyết
- Case CASE-T03 status=TAM_DINH_CHI, soLanTamDinhChi=1

### Các bước kiểm thử
- [ ] PUT /cases/CASE-T03 {status:'DANG_DIEU_TRA', ngayPhucHoi:'2026-05-23T00:00:00.000Z', soQuyetDinhPhucHoi:'QĐ-PH-001', ketQuaPhucHoiVuAn:'KET_LUAN_DE_NGHI_TRUY_TO'}

### Dữ liệu kiểm thử
```
ketQuaPhucHoiVuAn='KET_LUAN_DE_NGHI_TRUY_TO'
```

### Kết quả mong đợi
**UI**:
- Section phục hồi hiển thị đủ: ngày, số QĐ, kết quả

**API**:
- + data có ngayPhucHoi, soQuyetDinhPhucHoi, ketQuaPhucHoiVuAn

**Side effects** (DB, email, log, queue...):
- DB updated
- CaseStatusHistory có row mới
- soLanTamDinhChi giữ nguyên (KHÔNG decrement)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-038
severity: High
module: Update
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
- Loại: `STATE`
- Priority: `P1` 🟠
- Module: `Read`
- Yêu cầu: `REQ-CASE-STATUS-HIST`
- Kỹ thuật: `State sequence read`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET /cases/:id/status-history trả danh sách giảm dần thời gian

### Điều kiện tiên quyết
- Case có ≥3 chuyển trạng thái

### Các bước kiểm thử
- [ ] GET /cases/CASE-T04/status-history

### Dữ liệu kiểm thử
```
caseId='CASE-T04' với 3 transition: TIEP_NHAN→DANG_XAC_MINH (T1), DANG_XAC_MINH→DA_XAC_MINH (T2), DA_XAC_MINH→DANG_DIEU_TRA (T3)
```

### Kết quả mong đợi
**UI**:
- Tab 'Lịch sử' hiển thị 3 dòng theo thứ tự T3, T2, T1 (mới nhất ở trên)

**API**:
- , data sắp xếp createdAt desc

**Side effects** (DB, email, log, queue...):
- Không side effect

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Read`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Read`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-039
severity: Medium
module: Read
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
- Loại: `SECURITY`
- Priority: `P1` 🟠
- Module: `RateLimit`
- Yêu cầu: `REQ-CASE-RATELIMIT`
- Kỹ thuật: `Security — DoS prevention`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Rate limit /export/ward — 5 req/60s vượt → 429

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] Gọi GET /cases/export/ward 6 lần liên tiếp trong 60s

### Dữ liệu kiểm thử
```
6 request liên tiếp / 60s
```

### Kết quả mong đợi
**UI**:
- Lần thứ 6: toast 'Bạn thao tác quá nhanh, vui lòng thử lại sau'

**API**:
- request đầu: 200
- Request thứ 6: 429 Too Many Requests

**Side effects** (DB, email, log, queue...):
- Throttle counter reset sau 60s

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `RateLimit`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `RateLimit`
- Input sanitization: check ORM parameterization, escaping
- Authentication/Authorization middleware

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-053
severity: Medium
module: RateLimit
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: @Throttle({default:{ttl:60000,limit:5}})

---

## TC-055

**Meta**:
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-I18N-01`
- Kỹ thuật: `i18n / Unicode`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: name có dấu tiếng Việt + chữ hoa + ký tự đặc biệt

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name='Vụ trộm xe Nguyễn Văn Đệ ở phường Bến Nghé — Q1, ngày 12/05/2026 (KSV: Đỗ Quỳnh Như)'

### Dữ liệu kiểm thử
```
name chứa đầy đủ dấu tiếng Việt (Đ, ệ, ế, ý, ố), em dash '—', dấu phẩy, ngoặc
```

### Kết quả mong đợi
**UI**:
- Render đúng chính tả, font, dấu

**API**:
- , response.name bằng đúng input (UTF-8)

**Side effects** (DB, email, log, queue...):
- DB column UTF-8 lưu chính xác
- Audit log đọc lại đúng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-055
severity: High
module: Create
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
- Loại: `DATA`
- Priority: `P1` 🟠
- Module: `Create`
- Yêu cầu: `REQ-CASE-TZ`
- Kỹ thuật: `Timezone handling`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: deadline timezone GMT+7 lưu UTC chuẩn

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases deadline='2026-06-30T23:59:59+07:00'

### Dữ liệu kiểm thử
```
deadline='2026-06-30T23:59:59+07:00' (cuối ngày VN)
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị '30/06/2026' đúng (theo locale VN)

**API**:
- ; response.deadline='2026-06-30T16:59:59.000Z' (UTC equivalent)

**Side effects** (DB, email, log, queue...):
- DB lưu UTC chuẩn
- Khi query overdue=true so sánh với new Date() — không bị off-by-7h

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-058
severity: High
module: Create
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
- Priority: `P1` 🟠
- Module: `List`
- Yêu cầu: `REQ-CASE-PERF-01`
- Kỹ thuật: `Performance — response time`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: GET /cases trả về < 2s với 1000 record

### Điều kiện tiên quyết
- DB seed 1000 case

### Các bước kiểm thử
- [ ] GET /cases?limit=20&offset=500 — đo thời gian

### Dữ liệu kiểm thử
```
1000 record, query trang giữa
```

### Kết quả mong đợi
**UI**:
- Trang load skeleton → render đầy đủ < 2.5s (TTI < 3s)

**API**:
- Response time API < 2000ms (P95)

**Side effects** (DB, email, log, queue...):
- Có index trên createdAt, status để query nhanh

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `List`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `List`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-059
severity: Medium
module: List
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Dùng Postman collection runner hoặc autocannon

---

## TC-061

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P1` 🟠
- Module: `Update`
- Yêu cầu: `REQ-CASE-CONCURRENT`
- Kỹ thuật: `Concurrency / Race condition`
- Risk: `Cao`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: 5 user concurrent update cùng case → 1 success, 4 conflict 409

### Điều kiện tiên quyết
- Case CASE-C01 status=TIEP_NHAN updatedAt=T0. 5 user A-E cùng có expectedUpdatedAt=T0

### Các bước kiểm thử
- [ ] user submit PUT đồng thời với expectedUpdatedAt=T0

### Dữ liệu kiểm thử
```
5 PUT request đồng thời, mỗi req name khác nhau
```

### Kết quả mong đợi
**UI**:
- user thấy toast success, 4 user còn lại toast 'Hồ sơ đã được chỉnh sửa…'

**API**:
- response 200; 4 response 409 ConflictException

**Side effects** (DB, email, log, queue...):
- DB chỉ apply 1 update (atomic via where: {updatedAt: T0})
- Audit chỉ có 1 CASE_UPDATED

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-061
severity: High
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify optimistic lock chống lost update

---

## TC-065

**Meta**:
- Loại: `COMPAT`
- Priority: `P1` 🟠
- Module: `Browser`
- Yêu cầu: `REQ-CASE-COMPAT-CHROME`
- Kỹ thuật: `Compatibility testing`
- Risk: `TB`
- Severity nếu fail: `High` ⚠️

**Tiêu đề**: Chrome latest desktop 1920x1080 — luồng CRUD đầy đủ

### Điều kiện tiên quyết
- Chrome 120+, Windows 11, 1920x1080

### Các bước kiểm thử
- [ ] Tạo Case
- [ ] Sửa
- [ ] Xem detail
- [ ] Xóa
- [ ] Restore (ADMIN)

### Dữ liệu kiểm thử
```
primary browser
```

### Kết quả mong đợi
**UI**:
- Toàn bộ luồng không có layout bug, không error console

**API**:
- Tất cả 200/201

**Side effects** (DB, email, log, queue...):
- DB/Audit đầy đủ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Browser`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Browser`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-065
severity: High
module: Browser
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
- Priority: `P2` 🟡
- Module: `Create`
- Yêu cầu: `REQ-CASE-CR-VAL-07`
- Kỹ thuật: `Error guessing — invalid enum`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: capDoToiPham enum value không hợp lệ

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases body {name:'X', caseProvenance:'DIRECT_DISCOVERY', capDoToiPham:'SUPER_NGHIEM_TRONG'}

### Dữ liệu kiểm thử
```
capDoToiPham='SUPER_NGHIEM_TRONG'
```

### Kết quả mong đợi
**UI**:
- Validation đỏ dưới field 'Mức độ tội phạm'

**API**:
- Message chính xác: 'capDoToiPham phải là IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG hoặc DAC_BIET_NGHIEM_TRONG'

**Side effects** (DB, email, log, queue...):
- Không insert

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Error handling: check validation, exception handler

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-015
severity: Medium
module: Create
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Create`
- Yêu cầu: `REQ-CASE-CAPDO`
- Kỹ thuật: `EP — class 1`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: capDoToiPham=IT_NGHIEM_TRONG (class 1/4)

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases với capDoToiPham='IT_NGHIEM_TRONG'

### Dữ liệu kiểm thử
```
capDoToiPham='IT_NGHIEM_TRONG'
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị label 'Ít nghiêm trọng' (lookup từ status-labels)

**API**:
- + data.capDoToiPham='IT_NGHIEM_TRONG'

**Side effects** (DB, email, log, queue...):
- DB lưu enum chuẩn; KPI-4 query đếm vào nhóm tương ứng

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-033
severity: Low
module: Create
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
- Loại: `EP`
- Priority: `P2` 🟡
- Module: `Create`
- Yêu cầu: `REQ-CASE-CAPDO`
- Kỹ thuật: `EP — class 4`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: capDoToiPham=DAC_BIET_NGHIEM_TRONG (class 4/4)

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases với capDoToiPham='DAC_BIET_NGHIEM_TRONG'

### Dữ liệu kiểm thử
```
capDoToiPham='DAC_BIET_NGHIEM_TRONG'
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị 'Đặc biệt nghiêm trọng' với badge màu đỏ

**API**:

**Side effects** (DB, email, log, queue...):
- KPI-4 đếm vào nhóm 'án NT/ĐBNT' (KPI ≥ 95%)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-034
severity: Low
module: Create
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
- Loại: `STATE`
- Priority: `P2` 🟡
- Module: `Update`
- Yêu cầu: `REQ-CASE-STATE-IDEM`
- Kỹ thuật: `Idempotency check`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Idempotency: gửi cùng status hiện tại không tạo statusHistory mới

### Điều kiện tiên quyết
- Case CASE-T05 status=DANG_DIEU_TRA

### Các bước kiểm thử
- [ ] PUT /cases/CASE-T05 với {status:'DANG_DIEU_TRA'} (giống hiện tại)

### Dữ liệu kiểm thử
```
status='DANG_DIEU_TRA' (same as current)
```

### Kết quả mong đợi
**UI**:
- Toast success nhưng không có lịch sử mới

**API**:
- , không có statusHistory record mới

**Side effects** (DB, email, log, queue...):
- Không tạo row CaseStatusHistory mới (logic if dto.status !== existing.status)

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Update`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Update`

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-040
severity: Low
module: Update
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Logic cases.service.ts:675

---

## TC-056

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Create`
- Yêu cầu: `REQ-CASE-I18N-02`
- Kỹ thuật: `i18n / 4-byte UTF`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: crime chứa emoji 4-byte + ký tự đặc biệt

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases crime='🚨 Trộm cắp & lừa đảo 💰 (đa tội)'

### Dữ liệu kiểm thử
```
crime với emoji 🚨💰 + ký tự &, ()
```

### Kết quả mong đợi
**UI**:
- Hiển thị emoji đúng

**API**:
- , response giữ nguyên emoji

**Side effects** (DB, email, log, queue...):
- DB column charset utf8mb4 (Postgres mặc định) lưu đầy đủ

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-056
severity: Low
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Verify DB collation hỗ trợ 4-byte UTF

---

## TC-057

**Meta**:
- Loại: `DATA`
- Priority: `P2` 🟡
- Module: `Create`
- Yêu cầu: `REQ-CASE-DATA-TRIM`
- Kỹ thuật: `Data cleaning`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: name có leading + trailing whitespace

### Điều kiện tiên quyết
- User login

### Các bước kiểm thử
- [ ] POST /cases name='   Vụ trộm test   '

### Dữ liệu kiểm thử
```
name='   Vụ trộm test   '
```

### Kết quả mong đợi
**UI**:
- Detail hiển thị 'Vụ trộm test' (không có whitespace dư)

**API**:
- ; kỳ vọng response.name='Vụ trộm test' (trimmed). Nếu BE không trim → defect cần raise

**Side effects** (DB, email, log, queue...):
- DB lưu trimmed

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Create`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Create`
- Encoding handling (UTF-8), validation regex

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-057
severity: Low
module: Create
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: Spec không nói rõ về trim — verify

---

## TC-060

**Meta**:
- Loại: `PERFORMANCE`
- Priority: `P2` 🟡
- Module: `Export`
- Yêu cầu: `REQ-CASE-PERF-EXPORT`
- Kỹ thuật: `Performance — file gen`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Export Excel theo phường < 5s với 500 vụ

### Điều kiện tiên quyết
- DB có 500 vụ thuộc 1 ward

### Các bước kiểm thử
- [ ] GET /cases/export/ward?wardId=W001

### Dữ liệu kiểm thử
```
ward W001 có 500 case
```

### Kết quả mong đợi
**UI**:
- Trình duyệt download file .xlsx < 5s

**API**:
- Response time < 5000ms, Content-Type 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

**Side effects** (DB, email, log, queue...):
- Audit EXPORT_WARD log

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Export`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Export`
- DB queries: check N+1, missing indexes
- API caching, payload size

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-060
severity: Low
module: Export
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Form`
- Yêu cầu: `REQ-CASE-A11Y-KB`
- Kỹ thuật: `WCAG 2.4.3 Focus Order`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Tab keyboard navigate qua form Create theo thứ tự logic

### Điều kiện tiên quyết
- Trang /cases/new mở trên Chrome

### Các bước kiểm thử
- [ ] Click vào field 'Tên vụ án'
- [ ] Bấm Tab liên tục
- [ ] Quan sát focus order

### Dữ liệu kiểm thử
```
keyboard only — không dùng chuột
```

### Kết quả mong đợi
**UI**:
- Focus đi theo thứ tự visual top→bottom
- Focus visible (outline rõ)
- Không có element nào bị skip
- Submit form bằng Enter trên nút primary

**API**:
- POST tới /cases khi Enter

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Form`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-062
severity: Medium
module: Form
reproduce_steps: |  # copy từ Các bước kiểm thử ở trên
actual_behavior: |  # observed sau khi chạy
root_cause: |       # Claude Code phân tích
files_changed:
  - path/to/file.ts
fix_summary: |
verified_by_retest: false  # đặt true sau khi chạy lại pass
```

**Ghi chú**: WCAG 2.1 AA 2.4.3 + 2.1.1

---

## TC-063

**Meta**:
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `Form`
- Yêu cầu: `REQ-CASE-A11Y-SR`
- Kỹ thuật: `WCAG 1.3.1 + 3.3.1`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Screen reader (NVDA) đọc đúng label + error message

### Điều kiện tiên quyết
- Bật NVDA, mở /cases/new

### Các bước kiểm thử
- [ ] Tab tới field 'Tên vụ án'
- [ ] Bỏ trống và submit
- [ ] Tab tới error message

### Dữ liệu kiểm thử
```
NVDA on
```

### Kết quả mong đợi
**UI**:
- NVDA đọc 'Tên vụ án, bắt buộc, text edit'
- Sau submit lỗi, NVDA đọc 'Tên vụ án bắt buộc' (aria-describedby)

**API**:
- Không liên quan

**Side effects** (DB, email, log, queue...):
- HTML có aria-required='true', aria-invalid='true', aria-describedby pointing đến error id

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Form`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Form`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-063
severity: Medium
module: Form
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
- Loại: `A11Y`
- Priority: `P2` 🟡
- Module: `List`
- Yêu cầu: `REQ-CASE-A11Y-CONTRAST`
- Kỹ thuật: `WCAG 1.4.3`
- Risk: `Thấp`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: Contrast ratio của badge status ≥ 4.5:1

### Điều kiện tiên quyết
- Trang /cases mở trên Chrome

### Các bước kiểm thử
- [ ] Mở DevTools → Accessibility → Contrast checker
- [ ] Inspect badge 'Tiếp nhận', 'Đang điều tra', 'Tạm đình chỉ', 'Đình chỉ', 'Đã kết luận'

### Dữ liệu kiểm thử
```
Tất cả 10 status badge
```

### Kết quả mong đợi
**UI**:
- Mỗi badge có contrast ≥ 4.5:1 với background

**API**:
- Không

**Side effects** (DB, email, log, queue...):
- Tailwind classes trong status-labels.ts đảm bảo accessible

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `List`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `List`
- Component template/JSX: check semantic HTML, ARIA attrs
- CSS focus styles, tab order

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-064
severity: Medium
module: List
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Mobile`
- Yêu cầu: `REQ-CASE-COMPAT-MOBILE`
- Kỹ thuật: `Compatibility — mobile`
- Risk: `TB`
- Severity nếu fail: `Medium` ⚡

**Tiêu đề**: iOS Safari mobile 375x667 — list + detail usable

### Điều kiện tiên quyết
- iPhone SE simulator hoặc thiết bị thật

### Các bước kiểm thử
- [ ] Mở /cases
- [ ] Scroll list
- [ ] Click 1 case → detail
- [ ] Bấm 'Sửa'

### Dữ liệu kiểm thử
```
viewport 375x667, Safari
```

### Kết quả mong đợi
**UI**:
- Hamburger menu thay sidebar
- Bảng list → cards stack
- Form responsive
- Tab bar bottom-fixed nếu có

**API**:
- bình thường

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Mobile`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Mobile`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-066
severity: Medium
module: Mobile
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
- Loại: `COMPAT`
- Priority: `P2` 🟡
- Module: `Browser`
- Yêu cầu: `REQ-CASE-COMPAT-EDGE`
- Kỹ thuật: `Compatibility — secondary browser`
- Risk: `Thấp`
- Severity nếu fail: `Low` 📌

**Tiêu đề**: Edge latest 1366x768 — không vỡ layout

### Điều kiện tiên quyết
- Edge 120+, Windows 11, 1366x768

### Các bước kiểm thử
- [ ] Mở /cases + /cases/new + /cases/:id

### Dữ liệu kiểm thử
```
Edge browser
```

### Kết quả mong đợi
**UI**:
- Layout giống Chrome, không lệch element, không CSS error

**API**:

**Side effects** (DB, email, log, queue...):
- Không

### 🔧 Fix Context (cho Claude Code khi TC này fail)

**Khu vực có thể cần kiểm tra:**
- Source code module `Browser`: tìm component/page tương ứng
- API route handler: tìm endpoint cho `Browser`
- CSS prefixes, polyfills, browser API checks

**Bug report template** (Claude Code fill khi TC này fail):
```yaml
bug_id: BUG-XXX
tc_id: TC-067
severity: Low
module: Browser
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

- [ ] **TC-001** [P0] Tạo vụ án mới với caseProvenance=DIRECT_DISCOVERY thành công
- [ ] **TC-002** [P0] Tạo Case FROM_PETITION với linkedPetitionId + expectedPetitionUpdatedAt hợp lệ
- [ ] **TC-003** [P0] Tạo Case FROM_INCIDENT với linkedIncidentId hợp lệ
- [ ] **TC-004** [P0] Xem chi tiết vụ án được phân công cho mình
- [ ] **TC-005** [P0] Liệt kê danh sách vụ án — paginated default 20/page
- [ ] **TC-006** [P0] Cập nhật name + crime của vụ án
- [ ] **TC-007** [P0] Xóa mềm vụ TIEP_NHAN với reason đúng quy cách
- [ ] **TC-008** [P0] ADMIN khôi phục vụ án đã xóa mềm
- [ ] **TC-009** [P0] Thiếu trường caseProvenance — phải trả 400
- [ ] **TC-010** [P0] FROM_PETITION nhưng không truyền linkedPetitionId — phải 400
- [ ] **TC-011** [P0] FROM_INCIDENT nhưng thiếu linkedIncidentId
- [ ] **TC-018** [P0] Optimistic lock: expectedUpdatedAt cũ hơn current → 409
- [ ] **TC-020** [P0] Xóa vụ có status ≠ TIEP_NHAN bị reject
- [ ] **TC-036** [P0] TIEP_NHAN → DANG_XAC_MINH ghi CaseStatusHistory
- [ ] **TC-037** [P0] DANG_DIEU_TRA → TAM_DINH_CHI auto-set ngayTamDinhChi + soLanTamDinhChi += 1
- [ ] **TC-041** [P0] ADMIN xem toàn bộ cases không bị filter scope
- [ ] **TC-042** [P0] Dispatcher (canDispatch=true) xem full list
- [ ] **TC-043** [P0] Investigator xem được Case có investigatorId trùng
- [ ] **TC-044** [P0] User cùng team xem được Case của team mình
- [ ] **TC-045** [P0] User khác team + khác owner → 403
- [ ] **TC-046** [P0] Gọi API không kèm JWT → 401
- [ ] **TC-047** [P0] JWT đã hết hạn → 401
- [ ] **TC-048** [P0] User thường gọi /cases/:id/restore → 403 (chỉ ADMIN)
- [ ] **TC-049** [P0] Non-dispatcher gọi PATCH /assign → 403
- [ ] **TC-050** [P0] IDOR ngang: user A trực tiếp gọi GET /cases/<id-của-user-B-khác-team> → 403
- [ ] **TC-051** [P0] SQLi vào search param không thực thi
- [ ] **TC-052** [P0] Stored XSS vào name field — script không thực thi khi render
- [ ] **TC-054** [P0] CASE_CREATED audit log có actor + IP + UA + subjectId
- [ ] **TC-068** [P0] CASE_STATUS_CHANGED audit log có fromStatus + toStatus
- [ ] **TC-069** [P0] CASE_DELETED audit log lưu reason đầy đủ + actor
- [ ] **TC-012** [P1] linkedPetitionId trỏ tới Petition không tồn tại
- [ ] **TC-013** [P1] Trường name rỗng → 400
- [ ] **TC-014** [P1] Trường name chỉ chứa whitespace
- [ ] **TC-016** [P1] subjectsCount âm
- [ ] **TC-017** [P1] deadline sai định dạng ISO 8601
- [ ] **TC-019** [P1] Chuyển status sang TAM_DINH_CHI nhưng thiếu lyDoTamDinhChiVuAn
- [ ] **TC-021** [P1] Reason xóa < 10 chars → reject
- [ ] **TC-022** [P1] Reason rỗng → 400
- [ ] **TC-023** [P1] Restore vụ chưa bị xóa → reject
- [ ] **TC-024** [P1] GET /cases/:id với id không tồn tại → 404
- [ ] **TC-025** [P1] PUT /cases/:id với id không tồn tại → 404
- [ ] **TC-026** [P1] name = 1 ký tự (min boundary)
- [ ] **TC-027** [P1] name = 500 chars (max boundary)
- [ ] **TC-028** [P1] name = 501 chars (max+1) → 400
- [ ] **TC-029** [P1] reason = 10 chars (min boundary)
- [ ] **TC-030** [P1] reason = 500 chars (max boundary)
- [ ] **TC-031** [P1] reason = 9 chars (min-1) → reject
- [ ] **TC-032** [P1] reason = 501 chars (max+1) → reject
- [ ] **TC-035** [P1] Filter overdue=true loại trừ DA_KET_LUAN, DA_LUU_TRU, DINH_CHI
- [ ] **TC-038** [P1] TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) ghi ngayPhucHoi + ketQuaPhucHoiVuAn
- [ ] **TC-039** [P1] GET /cases/:id/status-history trả danh sách giảm dần thời gian
- [ ] **TC-053** [P1] Rate limit /export/ward — 5 req/60s vượt → 429
- [ ] **TC-055** [P1] name có dấu tiếng Việt + chữ hoa + ký tự đặc biệt
- [ ] **TC-058** [P1] deadline timezone GMT+7 lưu UTC chuẩn
- [ ] **TC-059** [P1] GET /cases trả về < 2s với 1000 record
- [ ] **TC-061** [P1] 5 user concurrent update cùng case → 1 success, 4 conflict 409
- [ ] **TC-065** [P1] Chrome latest desktop 1920x1080 — luồng CRUD đầy đủ
- [ ] **TC-015** [P2] capDoToiPham enum value không hợp lệ
- [ ] **TC-033** [P2] capDoToiPham=IT_NGHIEM_TRONG (class 1/4)
- [ ] **TC-034** [P2] capDoToiPham=DAC_BIET_NGHIEM_TRONG (class 4/4)
- [ ] **TC-040** [P2] Idempotency: gửi cùng status hiện tại không tạo statusHistory mới
- [ ] **TC-056** [P2] crime chứa emoji 4-byte + ký tự đặc biệt
- [ ] **TC-057** [P2] name có leading + trailing whitespace
- [ ] **TC-060** [P2] Export Excel theo phường < 5s với 500 vụ
- [ ] **TC-062** [P2] Tab keyboard navigate qua form Create theo thứ tự logic
- [ ] **TC-063** [P2] Screen reader (NVDA) đọc đúng label + error message
- [ ] **TC-064** [P2] Contrast ratio của badge status ≥ 4.5:1
- [ ] **TC-066** [P2] iOS Safari mobile 375x667 — list + detail usable
- [ ] **TC-067** [P2] Edge latest 1366x768 — không vỡ layout

---

_Generated by `uat-test-writer` skill on 23/05/2026 13:56_