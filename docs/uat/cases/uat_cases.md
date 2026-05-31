# UAT — CASES

**Tổng TC**: 130/130 | **Mode**: LEAN | **Generated**: 2026-05-30

## Phân bố loại TC

| Loại | Số TC | Tỷ lệ |
|------|-------|-------|
| RED | 52 | 40.0% |
| GREEN | 16 | 12.3% |
| SECURITY | 13 | 10.0% |
| BOUNDARY | 10 | 7.7% |
| EP | 10 | 7.7% |
| A11Y | 7 | 5.4% |
| COMPAT | 7 | 5.4% |
| STATE | 5 | 3.8% |
| DECISION | 3 | 2.3% |
| DATA | 3 | 2.3% |
| PERFORMANCE | 3 | 2.3% |
| EDGE | 1 | 0.8% |

## Phân bố priority

| Priority | Số TC | Tỷ lệ |
|----------|-------|-------|
| P0 | 62 | 47.7% |
| P1 | 59 | 45.4% |
| P2 | 9 | 6.9% |

## Self-Audit Gate (LEAN 5 checkpoints)

- ✅ TC count ≥ target
- ✅ GREEN ≤ 20%
- ✅ RED ≥ 40%
- ✅ 12 loại có ≥ 1 case
- ✅ Fixture có setup+cleanup

## Data Fixtures

### `account.admin.primary`
**Ref**: `_shared/test-accounts.json#account.admin.primary`
**Setup**: login: POST /api/v1/auth/login {email:'admin@pc02.local', password:'68@Love2love68'} → outputs.token = response.accessToken
**Cleanup**: logout (token invalidate optional)
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id"}`

### `account.admin.secondary`
**Ref**: `_shared/test-accounts.json#account.admin.secondary`
**Setup**: login: POST /api/v1/auth/login {email:'admin2@pc02.local', password:'isP$sT4N@o71'}
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id"}`

### `account.officer.primary`
**Ref**: `_shared/test-accounts.json#account.officer.primary`
**Setup**: login: POST /api/v1/auth/login {email:'officer1@pc02.local', password:'8I@&5c1gHmfy'}
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id", "teamId": "$.user.primaryTeamId"}`

### `account.officer.secondary`
**Ref**: `_shared/test-accounts.json#account.officer.secondary`
**Setup**: login: POST /api/v1/auth/login {email:'officer2@pc02.local', password:'4TMa3hq*x3$v'}
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id", "teamId": "$.user.primaryTeamId"}`

### `account.officer.expired_jwt`
**Setup**: Lấy JWT của officer1 rồi đổi exp claim về quá khứ — hoặc sleep > tokenTTL. Trả về token expired.
**Cleanup**: -
**Outputs**: `{"token": "$.expiredToken"}`

### `account.officer.locked`
**Setup**: Admin gọi POST /api/v1/admin/users/{userId}/lock — set lockedAt=now. Login với account này lấy token (token issued trước khi lock).
**Cleanup**: POST /api/v1/admin/users/{userId}/unlock
**Outputs**: `{"token": "$.lockedAccountToken"}`

### `directory.crime.shape.normal`
**Setup**: GET /api/v1/directories?type=CRIME&limit=10 → outputs.crimeId = response[0].id (BLHS Đ.138 trộm cắp tài sản)
**Cleanup**: -
**Outputs**: `{"crimeId": "$.[0].id"}`

### `case.tiep_nhan.D0`
**Setup**: POST /api/v1/cases body {name:'UAT-TC-{{random}}', caseProvenance:'DIRECT_DISCOVERY', crime:'138', status:'TIEP_NHAN'} với token officer.primary
**Cleanup**: DELETE /api/v1/cases/{id} body {reason:'UAT cleanup test-data — 20+ char'}
**Outputs**: `{"case_id": "$.id", "updated_at": "$.updatedAt"}`

### `case.dang_dieu_tra.D30`
**Setup**: POST tạo case, sau đó PUT status=DANG_XAC_MINH → DA_XAC_MINH → DANG_DIEU_TRA, set createdAt 30 ngày trước (Prisma raw update)
**Cleanup**: DELETE /api/v1/cases/{id}
**Outputs**: `{"case_id": "$.id"}`

### `case.tdc.D30`
**Setup**: Tạo case → đến DANG_DIEU_TRA → PUT status=TAM_DINH_CHI + lyDoTamDinhChiVuAn=CHUA_XAC_DINH_BI_CAN + soQuyetDinhTamDinhChi='QĐ-UAT-{{random}}' + ngayTamDinhChi={{D-30}}
**Cleanup**: DELETE /api/v1/cases/{id}
**Outputs**: `{"case_id": "$.id"}`

### `case.tdc.rasoat.D60`
**Setup**: Tạo TĐC case rồi PUT {daRaSoat:true, ngayRaSoat:{{D-1}}, soQuyetDinhPhucHoi:'QĐ-PH-{{random}}', ketQuaPhucHoiVuAn:'DANG_DIEU_TRA_XAC_MINH'}
**Cleanup**: DELETE /api/v1/cases/{id}
**Outputs**: `{"case_id": "$.id"}`

### `case.tdc.no_reason.D30`
**Setup**: Tạo case raw qua Prisma với status=TAM_DINH_CHI nhưng lyDoTamDinhChiVuAn=null (backfill scenario)
**Cleanup**: Prisma delete
**Outputs**: `{"case_id": "$.id"}`

### `case.da_ket_luan.D60`
**Setup**: Tạo case đến DA_KET_LUAN qua chuỗi PUT (TIEP_NHAN→…→DA_KET_LUAN)
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `case.da_luu_tru.D365`
**Setup**: Tạo case + push qua full chain → DA_LUU_TRU, set createdAt {{D-365}}
**Cleanup**: Prisma hard delete (terminal state)
**Outputs**: `{"case_id": "$.id"}`

### `case.creator_owned.D0`
**Setup**: POST /api/v1/cases với token officer.primary → createdById=officer1.userId
**Cleanup**: DELETE (vì là creator)
**Outputs**: `{"case_id": "$.id"}`

### `case.other_owned.D0`
**Setup**: POST với token officer.secondary → createdById=officer2.userId; test với officer.primary
**Cleanup**: DELETE bằng officer.secondary
**Outputs**: `{"case_id": "$.id"}`

### `case.other_team.D0`
**Setup**: POST với officer.secondary (team B); officer.primary thuộc team A → scope không thấy
**Cleanup**: DELETE bằng officer.secondary
**Outputs**: `{"case_id": "$.id"}`

### `case.deleted.D7`
**Setup**: POST tạo case → DELETE với reason hợp lệ; set deletedAt {{D-7}} bằng Prisma update
**Cleanup**: Prisma hard delete
**Outputs**: `{"case_id": "$.id"}`

### `case.with_petition.D0`
**Setup**: Tạo petition trước → POST case với caseProvenance=FROM_PETITION + linkedPetitionId
**Cleanup**: DELETE case → DELETE petition
**Outputs**: `{"case_id": "$.id", "petition_id": "$.linkedPetitionId"}`

### `petition.assigned.D0`
**Setup**: POST /api/v1/petitions body {senderName:'Test {{random}}', receivedDate:'{{today}}', petitionType:'TOCAO'} với officer.primary
**Cleanup**: DELETE /api/v1/petitions/{id}
**Outputs**: `{"petition_id": "$.id", "petition_updated_at": "$.updatedAt"}`

### `incident.assigned.D0`
**Setup**: POST /api/v1/incidents body {name:'UAT-VV-{{random}}', incidentType:'TINH_BAO', fromDate:'{{today}}'} với officer.primary
**Cleanup**: DELETE /api/v1/incidents/{id}
**Outputs**: `{"incident_id": "$.id", "incident_updated_at": "$.updatedAt"}`

### `cases.shape.normal.D0`
**Setup**: Seed 25 cases qua loop POST (mix status) cho officer.primary team
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `cases.shape.full.D0`
**Setup**: Seed 100 cases — 10 mỗi status
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `cases.shape.large.D0`
**Setup**: Prisma raw insert 10000 cases (cho performance test); cleanup tốn thời gian — chỉ dùng test PERFORMANCE
**Cleanup**: Prisma raw DELETE WHERE name LIKE 'UAT-PERF-%'
**Outputs**: `{"count": "10000"}`

## Test Cases

### GREEN (16 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-001** | P0 | Critical | Tạo vụ án DIRECT_DISCOVERY hợp lệ | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-002** | P0 | Critical | Tạo vụ án FROM_PETITION với linkedPetitionId + expectedPetitionUpdatedAt hợp lệ | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-003** | P0 | Critical | Tạo vụ án FROM_INCIDENT với linkedIncidentId hợp lệ | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-004** | P0 | High | Tạo vụ án với subjects[] inline (atomic) | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-005** | P0 | High | Tạo vụ án với evidences[] inline | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-006** | P0 | Critical | WARD_OFFICER tạo vụ án — assignedTeamId auto-set từ dataScope | `POST /api/v1/cases` | WARD_OFFICER |
| **TC-CASE-007** | P0 | Critical | Liệt kê vụ án mặc định trang 1 limit 20 | `GET /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-008** | P0 | High | Lấy stats counts by status | `GET /api/v1/cases/stats` | INVESTIGATOR |
| **TC-CASE-009** | P0 | Critical | Xem chi tiết vụ án thuộc scope | `GET /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-010** | P0 | High | Cập nhật vụ án (đổi status từ TIEP_NHAN sang DANG_XAC_MINH) | `PUT /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-011** | P0 | Critical | Xóa mềm vụ án với reason hợp lệ | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-012** | P1 | High | ADMIN khôi phục vụ án đã xóa mềm | `POST /api/v1/cases/:id/restore` | ADMIN |
| **TC-CASE-013** | P1 | High | DISPATCHER phân công ĐTV | `PATCH /api/v1/cases/:id/assign` | DISPATCHER |
| **TC-CASE-014** | P1 | Medium | Xem hành trình hồ sơ vụ án | `GET /api/v1/cases/:id/journey` | INVESTIGATOR |
| **TC-CASE-015** | P1 | Medium | Export Excel theo phường | `GET /api/v1/cases/export/ward` | INVESTIGATOR |
| **TC-CASE-016** | P1 | High | Cập nhật TĐC (TAM_DINH_CHI) với lyDoTamDinhChiVuAn hợp lệ | `PUT /api/v1/cases/:id` | INVESTIGATOR |

#### TC-CASE-001 — Tạo vụ án DIRECT_DISCOVERY hợp lệ
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Đăng nhập role INVESTIGATOR có write/Case
- **Steps**:
  1. POST body {name:'Vụ án trộm cắp tài sản', caseProvenance:'DIRECT_DISCOVERY', crime:'138 BLHS', capDoToiPham:'NGHIEM_TRONG'}
- **Expected**: HTTP 201, response.id≠null, status=TIEP_NHAN, createdById=user, audit_log có entry CREATE
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-002 — Tạo vụ án FROM_PETITION với linkedPetitionId + expectedPetitionUpdatedAt hợp lệ
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Có petition.id={{petition_id}} với updatedAt={{petition_updated_at}}
- **Steps**:
  1. POST {name:'VA từ đơn thư', caseProvenance:'FROM_PETITION', linkedPetitionId:'{{petition_id}}', expectedPetitionUpdatedAt:'{{petition_updated_at}}'}
- **Expected**: HTTP 201, response.linkedPetitionId set, petition.linkedCaseId được update
- **Data required**: `petition.assigned.D0, account.investigator.active.D0`

#### TC-CASE-003 — Tạo vụ án FROM_INCIDENT với linkedIncidentId hợp lệ
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Có incident.id={{incident_id}}
- **Steps**:
  1. POST {name:'VA từ vụ việc', caseProvenance:'FROM_INCIDENT', linkedIncidentId:'{{incident_id}}', expectedIncidentUpdatedAt:'{{incident_updated_at}}'}
- **Expected**: HTTP 201, incident.linkedCaseId set
- **Data required**: `incident.assigned.D0, account.investigator.active.D0`

#### TC-CASE-004 — Tạo vụ án với subjects[] inline (atomic)
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Đăng nhập + có crimeId={{crime_id}}
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY', subjects:[{fullName:'Nguyễn Văn A', dateOfBirth:'1990-01-01', idNumber:'001090012345', address:'Số 1 Trần Phú', crimeId:'{{crime_id}}'}]}
- **Expected**: HTTP 201, response.subjects[0].id≠null, subjects được create trong cùng transaction
- **Data required**: `account.investigator.active.D0, directory.crime.shape.normal`

#### TC-CASE-005 — Tạo vụ án với evidences[] inline
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Đăng nhập
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY', evidences:[{code:'VC-001', name:'Điện thoại iPhone', quantity:1, unit:'cái'}]}
- **Expected**: HTTP 201, response.evidences[0].id≠null
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-006 — WARD_OFFICER tạo vụ án — assignedTeamId auto-set từ dataScope
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: WARD_OFFICER
- **Pre**: Đăng nhập WARD_OFFICER có ward team assignment
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY'} KHÔNG truyền assignedTeamId
- **Expected**: HTTP 201, response.assignedTeamId=team của ward officer
- **Data required**: `account.ward_officer.active.D0`

#### TC-CASE-007 — Liệt kê vụ án mặc định trang 1 limit 20
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: DB có ≥20 cases trong scope user
- **Steps**:
  1. GET /api/v1/cases
- **Expected**: HTTP 200, response.items.length=20, response.total≥20, sorted createdAt desc
- **Data required**: `cases.shape.normal.D0`

#### TC-CASE-008 — Lấy stats counts by status
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/cases/stats`
- **Role**: INVESTIGATOR
- **Pre**: DB có cases với 10 status khác nhau
- **Steps**:
  1. GET /api/v1/cases/stats
- **Expected**: HTTP 200, response.byStatus có đủ 10 key (TIEP_NHAN..DA_LUU_TRU) với count≥0
- **Data required**: `cases.shape.full.D0`

#### TC-CASE-009 — Xem chi tiết vụ án thuộc scope
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Có case.id={{case_id}} trong scope user
- **Steps**:
  1. GET /api/v1/cases/{{case_id}}
- **Expected**: HTTP 200, response.id={{case_id}}, đủ field tdc/utdt/relations
- **Data required**: `case.investigating.D0`

#### TC-CASE-010 — Cập nhật vụ án (đổi status từ TIEP_NHAN sang DANG_XAC_MINH)
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Có case status=TIEP_NHAN
- **Steps**:
  1. PUT /api/v1/cases/{{case_id}} body {status:'DANG_XAC_MINH', expectedUpdatedAt:'{{updated_at}}'}
- **Expected**: HTTP 200, status=DANG_XAC_MINH, status_history thêm entry
- **Data required**: `case.tiep_nhan.D0`

#### TC-CASE-011 — Xóa mềm vụ án với reason hợp lệ
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Là creator của case, chưa linked Petition/Incident
- **Steps**:
  1. DELETE /api/v1/cases/{{case_id}} body {reason:'Lý do xóa hợp lệ 10+ ký tự'}
- **Expected**: HTTP 200, case.deletedAt≠null, audit log DELETE
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-012 — ADMIN khôi phục vụ án đã xóa mềm
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `POST /api/v1/cases/:id/restore`
- **Role**: ADMIN
- **Pre**: Có case.deletedAt≠null
- **Steps**:
  1. POST /api/v1/cases/{{case_id}}/restore body {reason:'Khôi phục theo yêu cầu cấp trên'}
- **Expected**: HTTP 200, case.deletedAt=null, audit log RESTORE
- **Data required**: `case.deleted.D7, account.admin.active.D0`

#### TC-CASE-013 — DISPATCHER phân công ĐTV
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PATCH /api/v1/cases/:id/assign`
- **Role**: DISPATCHER
- **Pre**: Đăng nhập role có canDispatch=true
- **Steps**:
  1. PATCH /api/v1/cases/{{case_id}}/assign body {investigatorId:'{{inv_id}}'}
- **Expected**: HTTP 200, case.investigatorId set, notification gửi investigator
- **Data required**: `case.unassigned.D0, account.dispatcher.D0, account.investigator.active.D0`

#### TC-CASE-014 — Xem hành trình hồ sơ vụ án
- **Type/Priority/Severity**: GREEN / P1 / Medium
- **Endpoint**: `GET /api/v1/cases/:id/journey`
- **Role**: INVESTIGATOR
- **Pre**: Có case với ≥3 events (create, assign, update)
- **Steps**:
  1. GET /api/v1/cases/{{case_id}}/journey
- **Expected**: HTTP 200, response.events≥3, sorted timestamp desc, pagination meta
- **Data required**: `case.investigating.D7.with_events`

#### TC-CASE-015 — Export Excel theo phường
- **Type/Priority/Severity**: GREEN / P1 / Medium
- **Endpoint**: `GET /api/v1/cases/export/ward`
- **Role**: INVESTIGATOR
- **Pre**: DB có cases với subjects.wardId
- **Steps**:
  1. GET /api/v1/cases/export/ward?unitId={{unit_id}}&fromDate=2026-01-01&toDate=2026-12-31
- **Expected**: HTTP 200, Content-Type application/vnd.openxmlformats…, Content-Disposition attachment, file size > 0
- **Data required**: `cases.shape.full.D0`

#### TC-CASE-016 — Cập nhật TĐC (TAM_DINH_CHI) với lyDoTamDinhChiVuAn hợp lệ
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Case status DANG_DIEU_TRA
- **Steps**:
  1. PUT body {status:'TAM_DINH_CHI', lyDoTamDinhChiVuAn:'CHUA_XAC_DINH_BI_CAN', soQuyetDinhTamDinhChi:'QĐ-01/2026', ngayTamDinhChi:'2026-05-30', expectedUpdatedAt}
- **Expected**: HTTP 200, case.status=TAM_DINH_CHI, lyDoTamDinhChiVuAn lưu đúng enum
- **Data required**: `case.dang_dieu_tra.D30`

### RED (52 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-017** | P0 | Critical | Thiếu caseProvenance → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-018** | P0 | Critical | Thiếu name → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-019** | P0 | Critical | name là whitespace-only (trim → empty) → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-020** | P0 | High | caseProvenance=FROM_PETITION thiếu linkedPetitionId → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-021** | P0 | High | caseProvenance=FROM_INCIDENT thiếu linkedIncidentId → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-022** | P0 | High | caseProvenance không thuộc enum → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-023** | P0 | Critical | FROM_PETITION với linkedPetitionId không tồn tại → 404/400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-024** | P0 | Critical | FROM_PETITION với expectedPetitionUpdatedAt stale → 409 optimistic lock | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-025** | P1 | High | capDoToiPham không thuộc enum → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-026** | P1 | High | deadline không phải ISO8601 → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-027** | P0 | Critical | DELETE thiếu body.reason → 400 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-028** | P0 | Critical | DELETE reason < 10 ký tự → 400 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-029** | P0 | High | DELETE bởi user không phải creator → 403 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-030** | P0 | Critical | DELETE case có linkedPetition → 409 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-031** | P0 | Critical | VIEWER không có write/Case → 403 | `POST /api/v1/cases` | VIEWER |
| **TC-CASE-032** | P0 | Critical | Không có JWT (anonymous) → 401 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-033** | P0 | High | JWT expired → 401 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-034** | P0 | High | Account locked → 401/403 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-035** | P1 | High | subjects[] vượt 100 phần tử → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-036** | P1 | High | evidences[] vượt 100 phần tử → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-037** | P1 | Medium | documentIds[] vượt 50 phần tử → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-038** | P0 | High | subject thiếu crimeId → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-039** | P1 | Medium | subject idNumber vượt 20 ký tự → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-040** | P0 | Critical | PUT vào case không thuộc scope → 403/404 | `PUT /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-041** | P0 | Critical | PUT với expectedUpdatedAt stale → 409 optimistic lock | `PUT /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-042** | P1 | High | PUT lyDoTamDinhChiVuAn ngoài enum → 400 | `PUT /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-043** | P1 | High | PUT ketQuaPhucHoiVuAn ngoài enum → 400 | `PUT /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-044** | P0 | Critical | INVESTIGATOR (không DispatchGuard) gọi assign → 403 | `PATCH /api/v1/cases/:id/assign` | INVESTIGATOR |
| **TC-CASE-045** | P0 | Critical | GET case không tồn tại → 404 | `GET /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-046** | P1 | High | Query status không thuộc enum → 400 | `GET /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-047** | P1 | High | Query search > 200 chars → 400 | `GET /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-048** | P2 | Medium | Query limit > 100 → 400 | `GET /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-070** | P1 | Medium | Query offset âm → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-071** | P1 | Medium | limit=0 → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-072** | P1 | High | unknown field gửi qua (whitelist:true forbidNonWhitelisted) → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-073** | P0 | High | ngayKhoiTo không đúng ISO8601 → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-074** | P0 | Critical | FROM_INCIDENT với expectedIncidentUpdatedAt sai format → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-075** | P1 | High | subject dateOfBirth sai format → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-076** | P1 | Medium | evidence.quantity = 0 → 400 (Min 1) | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-077** | P1 | Medium | evidence.quantity âm → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-078** | P0 | Critical | DELETE case đã deletedAt≠null → 410 Gone hoặc 404 | `DELETE /api/v1/cases/:id` | OFFICER |
| **TC-CASE-079** | P0 | High | Restore reason < 10 ký tự → 400 | `POST /api/v1/cases/:id/restore` | ADMIN |
| **TC-CASE-080** | P0 | High | OFFICER không có restore permission → 403 | `POST /api/v1/cases/:id/restore` | OFFICER |
| **TC-CASE-081** | P1 | Medium | OFFICER gọi admin/deleted → 403 | `GET /api/v1/cases/admin/deleted` | OFFICER |
| **TC-CASE-091** | P0 | Critical | Concurrent create với cùng linkedPetitionId → 1 thành công 1 fail | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-092** | P1 | High | PUT status=DA_LUU_TRU từ TIEP_NHAN (skip state) → 400 | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-093** | P1 | Medium | page âm → 400 hoặc fallback 1 | `GET /api/v1/cases/:id/journey` | OFFICER |
| **TC-CASE-094** | P1 | Medium | Tạo case với deadline trong quá khứ → 400 hoặc warning | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-095** | P1 | High | Tạo case với assignedTeamId không thuộc DB → 400/404 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-096** | P1 | Medium | PUT thiếu expectedUpdatedAt (optimistic lock required) → 400 | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-097** | P0 | High | FROM_PETITION với petition đã có linkedCaseId → 409 | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-098** | P1 | Medium | subject phone vượt 20 ký tự → 400 | `POST /api/v1/cases` | OFFICER |

#### TC-CASE-017 — Thiếu caseProvenance → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name:'Vụ án test'} không có caseProvenance
- **Expected**: HTTP 400, message khớp 'caseProvenance bắt buộc'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-018 — Thiếu name → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {caseProvenance:'DIRECT_DISCOVERY'} không có name
- **Expected**: HTTP 400, message 'Tên vụ án bắt buộc'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-019 — name là whitespace-only (trim → empty) → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name:'   ', caseProvenance:'DIRECT_DISCOVERY'}
- **Expected**: HTTP 400, IsNotEmpty fail sau khi trim
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-020 — caseProvenance=FROM_PETITION thiếu linkedPetitionId → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'FROM_PETITION'} không có linkedPetitionId
- **Expected**: HTTP 400, message 'linkedPetitionId required when caseProvenance is FROM_PETITION'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-021 — caseProvenance=FROM_INCIDENT thiếu linkedIncidentId → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'FROM_INCIDENT'}
- **Expected**: HTTP 400, message 'linkedIncidentId required when caseProvenance is FROM_INCIDENT'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-022 — caseProvenance không thuộc enum → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'INVALID_VALUE'}
- **Expected**: HTTP 400, IsEnum validator fail
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-023 — FROM_PETITION với linkedPetitionId không tồn tại → 404/400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'FROM_PETITION', linkedPetitionId:'non-existent-uuid', expectedPetitionUpdatedAt:'2026-01-01T00:00:00Z'}
- **Expected**: HTTP 404 hoặc 400, không tạo orphan case
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-024 — FROM_PETITION với expectedPetitionUpdatedAt stale → 409 optimistic lock
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Petition.updatedAt mới hơn expected
- **Steps**:
  1. POST với expectedPetitionUpdatedAt là giá trị cũ trước khi Petition bị edit
- **Expected**: HTTP 409 Conflict, message về optimistic lock
- **Data required**: `petition.recently_edited.D0`

#### TC-CASE-025 — capDoToiPham không thuộc enum → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY', capDoToiPham:'SUPER_HEAVY'}
- **Expected**: HTTP 400, message gợi ý IT_NGHIEM_TRONG/NGHIEM_TRONG/RAT_NGHIEM_TRONG/DAC_BIET_NGHIEM_TRONG
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-026 — deadline không phải ISO8601 → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY', deadline:'30/05/2026'}
- **Expected**: HTTP 400, IsDateString validator fail
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-027 — DELETE thiếu body.reason → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. DELETE /api/v1/cases/{{case_id}} body {}
- **Expected**: HTTP 400, message 'Lý do xóa bắt buộc'
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-028 — DELETE reason < 10 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. DELETE body {reason:'Sai'}
- **Expected**: HTTP 400, message 'Lý do xóa phải có ít nhất 10 ký tự'
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-029 — DELETE bởi user không phải creator → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Case có createdById khác user hiện tại
- **Steps**:
  1. DELETE body {reason:'Lý do hợp lệ test creator-only'}
- **Expected**: HTTP 403, message 'Chỉ creator mới được xóa'
- **Data required**: `case.other_owned.D0, account.investigator.active.D0`

#### TC-CASE-030 — DELETE case có linkedPetition → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Case có linkedPetitionId set
- **Steps**:
  1. DELETE body {reason:'…'}
- **Expected**: HTTP 409, message liên kết Đơn thư, gợi ý unlink trước
- **Data required**: `case.with_petition.D0`

#### TC-CASE-031 — VIEWER không có write/Case → 403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: VIEWER
- **Pre**: -
- **Steps**:
  1. POST /api/v1/cases {name, caseProvenance:'DIRECT_DISCOVERY'}
- **Expected**: HTTP 403, ForbiddenException
- **Data required**: `account.viewer.active.D0`

#### TC-CASE-032 — Không có JWT (anonymous) → 401
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST không header Authorization
- **Expected**: HTTP 401, Unauthorized

#### TC-CASE-033 — JWT expired → 401
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: Dùng token expired 24h trước
- **Steps**:
  1. POST với JWT expired
- **Expected**: HTTP 401, token expired
- **Data required**: `account.investigator.expired_jwt.D0`

#### TC-CASE-034 — Account locked → 401/403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: User.lockedAt≠null
- **Steps**:
  1. POST với JWT của locked account
- **Expected**: HTTP 401 hoặc 403, account locked
- **Data required**: `account.investigator.locked.D7`

#### TC-CASE-035 — subjects[] vượt 100 phần tử → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST với subjects mảng 101 items
- **Expected**: HTTP 400, 'subjects[] tối đa 100 đối tượng'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-036 — evidences[] vượt 100 phần tử → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST với evidences mảng 101 items
- **Expected**: HTTP 400, 'evidences[] tối đa 100 vật chứng'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-037 — documentIds[] vượt 50 phần tử → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST documentIds 51 items
- **Expected**: HTTP 400, 'documentIds[] tối đa 50 file'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-038 — subject thiếu crimeId → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST subjects:[{fullName,...}] không có crimeId
- **Expected**: HTTP 400, 'crimeId required cho mỗi Subject'
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-039 — subject idNumber vượt 20 ký tự → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST subject.idNumber 21 chars
- **Expected**: HTTP 400, MaxLength fail
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-040 — PUT vào case không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Case thuộc team khác
- **Steps**:
  1. PUT /api/v1/cases/{{other_team_case_id}}
- **Expected**: HTTP 403/404, scope filter chặn
- **Data required**: `case.other_team.D0, account.investigator.active.D0`

#### TC-CASE-041 — PUT với expectedUpdatedAt stale → 409 optimistic lock
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: Case đã bị edit bởi user khác
- **Steps**:
  1. PUT với expectedUpdatedAt cũ
- **Expected**: HTTP 409, message optimistic lock conflict
- **Data required**: `case.recently_edited.D0`

#### TC-CASE-042 — PUT lyDoTamDinhChiVuAn ngoài enum → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. PUT body {lyDoTamDinhChiVuAn:'INVALID'}
- **Expected**: HTTP 400, message BLTTHS Điều 229
- **Data required**: `case.investigating.D7`

#### TC-CASE-043 — PUT ketQuaPhucHoiVuAn ngoài enum → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. PUT {ketQuaPhucHoiVuAn:'WRONG'}
- **Expected**: HTTP 400, IsEnum fail
- **Data required**: `case.tdc.D30`

#### TC-CASE-044 — INVESTIGATOR (không DispatchGuard) gọi assign → 403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PATCH /api/v1/cases/:id/assign`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. PATCH /assign body {investigatorId}
- **Expected**: HTTP 403, DispatchGuard fail
- **Data required**: `case.unassigned.D0, account.investigator.active.D0`

#### TC-CASE-045 — GET case không tồn tại → 404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. GET /api/v1/cases/00000000-0000-0000-0000-000000000000
- **Expected**: HTTP 404, NotFoundException
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-046 — Query status không thuộc enum → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. GET /api/v1/cases?status=INVALID
- **Expected**: HTTP 400, ValidationPipe whitelist
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-047 — Query search > 200 chars → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. GET ?search=<chuỗi 201 ký tự>
- **Expected**: HTTP 400, MaxLength fail (bảo vệ JSONB ILIKE)
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-048 — Query limit > 100 → 400
- **Type/Priority/Severity**: RED / P2 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. GET ?limit=200
- **Expected**: HTTP 400, IsInt Max 100
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-070 — Query offset âm → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?offset=-1
- **Expected**: HTTP 400, Min 0
- **Data required**: `account.officer.primary`

#### TC-CASE-071 — limit=0 → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?limit=0
- **Expected**: HTTP 400, Min 1
- **Data required**: `account.officer.primary`

#### TC-CASE-072 — unknown field gửi qua (whitelist:true forbidNonWhitelisted) → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name, caseProvenance:'DIRECT_DISCOVERY', randomField:'x'}
- **Expected**: HTTP 400, property randomField should not exist
- **Data required**: `account.officer.primary`

#### TC-CASE-073 — ngayKhoiTo không đúng ISO8601 → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name, caseProvenance:'DIRECT_DISCOVERY', ngayKhoiTo:'2026-13-99'}
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-CASE-074 — FROM_INCIDENT với expectedIncidentUpdatedAt sai format → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseProvenance:'FROM_INCIDENT', linkedIncidentId, expectedIncidentUpdatedAt:'invalid'}
- **Expected**: HTTP 400, IsISO8601 fail
- **Data required**: `incident.assigned.D0`

#### TC-CASE-075 — subject dateOfBirth sai format → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST subjects:[{dateOfBirth:'invalid-date',...}]
- **Expected**: HTTP 400, IsDateString validator fail
- **Data required**: `account.officer.primary`

#### TC-CASE-076 — evidence.quantity = 0 → 400 (Min 1)
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST evidences:[{code,name,quantity:0}]
- **Expected**: HTTP 400, Min 1
- **Data required**: `account.officer.primary`

#### TC-CASE-077 — evidence.quantity âm → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST quantity:-5
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-CASE-078 — DELETE case đã deletedAt≠null → 410 Gone hoặc 404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Case đã soft-deleted
- **Steps**:
  DELETE lần 2
- **Expected**: HTTP 410/404, không double-delete
- **Data required**: `case.deleted.D7`

#### TC-CASE-079 — Restore reason < 10 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases/:id/restore`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  POST /restore body {reason:'short'}
- **Expected**: HTTP 400
- **Data required**: `case.deleted.D7, account.admin.primary`

#### TC-CASE-080 — OFFICER không có restore permission → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases/:id/restore`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /restore
- **Expected**: HTTP 403
- **Data required**: `case.deleted.D7, account.officer.primary`

#### TC-CASE-081 — OFFICER gọi admin/deleted → 403
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases/admin/deleted`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /admin/deleted
- **Expected**: HTTP 403
- **Data required**: `account.officer.primary`

#### TC-CASE-091 — Concurrent create với cùng linkedPetitionId → 1 thành công 1 fail
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: Petition chưa linked
- **Steps**:
  2 request POST cùng linkedPetitionId song song
- **Expected**: 1 HTTP 201, 1 HTTP 409 (unique constraint linkedPetitionId)
- **Data required**: `petition.assigned.D0`

#### TC-CASE-092 — PUT status=DA_LUU_TRU từ TIEP_NHAN (skip state) → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Case status TIEP_NHAN
- **Steps**:
  PUT {status:'DA_LUU_TRU'}
- **Expected**: HTTP 400, invalid state transition
- **Data required**: `case.tiep_nhan.D0`

#### TC-CASE-093 — page âm → 400 hoặc fallback 1
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases/:id/journey`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?page=-5
- **Expected**: HTTP 200 với page clamp 1 (Math.max(1,page))
- **Data required**: `case.investigating.D0`

#### TC-CASE-094 — Tạo case với deadline trong quá khứ → 400 hoặc warning
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name, caseProvenance:'DIRECT_DISCOVERY', deadline:'2020-01-01'}
- **Expected**: HTTP 201 (validation chỉ check ISO8601) hoặc 400 nếu có business rule deadline > today
- **Data required**: `account.officer.primary`

#### TC-CASE-095 — Tạo case với assignedTeamId không thuộc DB → 400/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {assignedTeamId:'00000000-…'}
- **Expected**: HTTP 400/404, FK Team không tồn tại
- **Data required**: `account.officer.primary`

#### TC-CASE-096 — PUT thiếu expectedUpdatedAt (optimistic lock required) → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT body không có expectedUpdatedAt
- **Expected**: HTTP 400 hoặc 200 (tuỳ enforcement) — verify service nếu reject
- **Data required**: `case.investigating.D0`

#### TC-CASE-097 — FROM_PETITION với petition đã có linkedCaseId → 409
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: Petition.linkedCaseId đã set (đã chuyển case khác)
- **Steps**:
  POST {caseProvenance:'FROM_PETITION', linkedPetitionId:'{{petition_id}}'}
- **Expected**: HTTP 409, message petition đã được liên kết
- **Data required**: `petition.linked_to_case.D7`

#### TC-CASE-098 — subject phone vượt 20 ký tự → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST subject.phone='1'.repeat(21)
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

### BOUNDARY (10 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-049** | P1 | High | name = 500 ký tự (max) → 201 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-050** | P1 | High | name = 501 ký tự → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-051** | P1 | Medium | crime = 255 ký tự (max) → 201 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-052** | P1 | Medium | sourceDocumentNote = 1000 ký tự (max) → 201 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-053** | P1 | Medium | sourceDocumentNote = 1001 → 400 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-054** | P1 | High | subjects = 100 items (max) → 201 | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-055** | P0 | High | reason = 10 ký tự (min) → 200 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-056** | P0 | High | reason = 500 ký tự (max) → 200 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-057** | P0 | High | reason = 501 ký tự → 400 | `DELETE /api/v1/cases/:id` | INVESTIGATOR |
| **TC-CASE-058** | P1 | Medium | limit=200 (max clamp) → 200 | `GET /api/v1/cases/:id/journey` | INVESTIGATOR |

#### TC-CASE-049 — name = 500 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST name length=500
- **Expected**: HTTP 201
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-050 — name = 501 ký tự → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST name length=501
- **Expected**: HTTP 400, MaxLength
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-051 — crime = 255 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST crime length=255
- **Expected**: HTTP 201
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-052 — sourceDocumentNote = 1000 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST sourceDocumentNote length=1000
- **Expected**: HTTP 201
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-053 — sourceDocumentNote = 1001 → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST sourceDocumentNote length=1001
- **Expected**: HTTP 400
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-054 — subjects = 100 items (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST subjects 100 items
- **Expected**: HTTP 201, tất cả subjects được create
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-055 — reason = 10 ký tự (min) → 200
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. DELETE reason='1234567890'
- **Expected**: HTTP 200
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-056 — reason = 500 ký tự (max) → 200
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. DELETE reason 500 chars
- **Expected**: HTTP 200
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-057 — reason = 501 ký tự → 400
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. DELETE reason length=501
- **Expected**: HTTP 400, MaxLength 500
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-058 — limit=200 (max clamp) → 200
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `GET /api/v1/cases/:id/journey`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. GET ?limit=500
- **Expected**: HTTP 200, response.events.length≤200 (clamp)
- **Data required**: `case.investigating.D90.with_events`

### EP (10 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-060** | P1 | Medium | capDoToiPham đủ 4 partition (EP class hợp lệ) | `POST /api/v1/cases` | INVESTIGATOR |
| **TC-CASE-061** | P1 | High | caseProvenance đủ 8 partition | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-062** | P1 | High | LyDoTamDinhChiVuAn đủ 8 partition | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-063** | P1 | Medium | KetQuaPhucHoiVuAn đủ 5 partition | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-064** | P1 | Medium | Filter caseType=REGULAR vs UY_THAC_DIEU_TRA | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-065** | P2 | Low | sortOrder ∈ {asc, desc} — partition | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-066** | P1 | Medium | overdue=true filter | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-067** | P2 | Low | capDoToiPham partition vs status tương ứng | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-068** | P1 | Medium | tdc-backfill chấp nhận 8 partition lyDoTamDinhChiVuAn | `PATCH /api/v1/cases/:id/tdc-backfill` | OFFICER |
| **TC-CASE-069** | P1 | Medium | trangThaiPhanHoi 4 partition (cho UTDT cases) | `GET /api/v1/cases` | OFFICER |

#### TC-CASE-060 — capDoToiPham đủ 4 partition (EP class hợp lệ)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  Loop 4 giá trị IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG, DAC_BIET_NGHIEM_TRONG
- **Expected**: Mỗi giá trị → HTTP 201
- **Data required**: `account.investigator.active.D0`

#### TC-CASE-061 — caseProvenance đủ 8 partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 8 enum CaseProvenance, đảm bảo điều kiện kèm theo (FROM_PETITION/FROM_INCIDENT cần linked id; UY_THAC_DIEU_TRA cần UTDT fields)
- **Expected**: Mỗi partition GREEN/RED đúng theo điều kiện
- **Data required**: `petition.assigned.D0, incident.assigned.D0`

#### TC-CASE-062 — LyDoTamDinhChiVuAn đủ 8 partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Case status DANG_DIEU_TRA
- **Steps**:
  Loop 8 enum lyDo, mỗi lần PUT status=TAM_DINH_CHI
- **Expected**: Mỗi enum value HTTP 200
- **Data required**: `case.dang_dieu_tra.D30`

#### TC-CASE-063 — KetQuaPhucHoiVuAn đủ 5 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Case status TAM_DINH_CHI, daRaSoat=true
- **Steps**:
  Loop 5 enum
- **Expected**: HTTP 200 mỗi value
- **Data required**: `case.tdc.rasoat.D60`

#### TC-CASE-064 — Filter caseType=REGULAR vs UY_THAC_DIEU_TRA
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB có cả 2 loại
- **Steps**:
  GET ?caseType=REGULAR rồi ?caseType=UY_THAC_DIEU_TRA
- **Expected**: Mỗi truy vấn trả đúng loại, không lẫn
- **Data required**: `cases.mixed_type.D0`

#### TC-CASE-065 — sortOrder ∈ {asc, desc} — partition
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?sortBy=createdAt&sortOrder=asc rồi desc
- **Expected**: Order đảo đúng
- **Data required**: `cases.shape.normal.D0`

#### TC-CASE-066 — overdue=true filter
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB có case deadline < now
- **Steps**:
  GET ?overdue=true
- **Expected**: Tất cả items có deadline < today
- **Data required**: `case.overdue.D30, case.active.D0`

#### TC-CASE-067 — capDoToiPham partition vs status tương ứng
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  4 case capDoToiPham × status mặc định TIEP_NHAN
- **Expected**: HTTP 201 đủ 4, capDoToiPham lưu đúng
- **Data required**: `account.officer.primary`

#### TC-CASE-068 — tdc-backfill chấp nhận 8 partition lyDoTamDinhChiVuAn
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PATCH /api/v1/cases/:id/tdc-backfill`
- **Role**: OFFICER
- **Pre**: Case có status TAM_DINH_CHI nhưng lyDo trống
- **Steps**:
  Loop 8 enum
- **Expected**: HTTP 200 mỗi value
- **Data required**: `case.tdc.no_reason.D30`

#### TC-CASE-069 — trangThaiPhanHoi 4 partition (cho UTDT cases)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB có UTDT cases ở mỗi state
- **Steps**:
  Loop 4 ?trangThaiPhanHoi
- **Expected**: Mỗi truy vấn trả đúng tập
- **Data required**: `utdt.shape.full.D0`

### EDGE (1 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-059** | P2 | Medium | Tạo vụ án với metadata = {} rỗng | `POST /api/v1/cases` | INVESTIGATOR |

#### TC-CASE-059 — Tạo vụ án với metadata = {} rỗng
- **Type/Priority/Severity**: EDGE / P2 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: INVESTIGATOR
- **Pre**: -
- **Steps**:
  1. POST {name, caseProvenance:'DIRECT_DISCOVERY', metadata:{}}
- **Expected**: HTTP 201, metadata lưu {}
- **Data required**: `account.investigator.active.D0`

### STATE (5 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-099** | P0 | Critical | Transition đúng: TIEP_NHAN → DANG_XAC_MINH | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-100** | P0 | Critical | Transition: DANG_DIEU_TRA → TAM_DINH_CHI (kèm lyDo) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-101** | P0 | Critical | Transition: TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-102** | P1 | High | Transition: DA_KET_LUAN → DANG_TRUY_TO | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-103** | P0 | High | Transition invalid: DA_LUU_TRU → DANG_XAC_MINH (final state) → 400 | `PUT /api/v1/cases/:id` | OFFICER |

#### TC-CASE-099 — Transition đúng: TIEP_NHAN → DANG_XAC_MINH
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Status TIEP_NHAN
- **Steps**:
  PUT status=DANG_XAC_MINH
- **Expected**: HTTP 200, status_history += entry
- **Data required**: `case.tiep_nhan.D0`

#### TC-CASE-100 — Transition: DANG_DIEU_TRA → TAM_DINH_CHI (kèm lyDo)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Status DANG_DIEU_TRA
- **Steps**:
  PUT status=TAM_DINH_CHI + lyDoTamDinhChiVuAn
- **Expected**: HTTP 200
- **Data required**: `case.dang_dieu_tra.D30`

#### TC-CASE-101 — Transition: TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Status TAM_DINH_CHI, daRaSoat=true, ketQuaPhucHoiVuAn=DANG_DIEU_TRA_XAC_MINH
- **Steps**:
  PUT status=DANG_DIEU_TRA
- **Expected**: HTTP 200, transition hợp lệ
- **Data required**: `case.tdc.rasoat.D60`

#### TC-CASE-102 — Transition: DA_KET_LUAN → DANG_TRUY_TO
- **Type/Priority/Severity**: STATE / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Status DA_KET_LUAN
- **Steps**:
  PUT status=DANG_TRUY_TO
- **Expected**: HTTP 200
- **Data required**: `case.da_ket_luan.D60`

#### TC-CASE-103 — Transition invalid: DA_LUU_TRU → DANG_XAC_MINH (final state) → 400
- **Type/Priority/Severity**: STATE / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Status DA_LUU_TRU
- **Steps**:
  PUT status=DANG_XAC_MINH
- **Expected**: HTTP 400, terminal state
- **Data required**: `case.da_luu_tru.D365`

### DECISION (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-104** | P0 | Critical | Decision table caseProvenance × linked_id_required matrix (8×2=16 cells) | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-105** | P0 | High | Decision table TĐC: lyDo × status × daRaSoat | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-106** | P1 | Medium | Decision table delete preconditions | `DELETE /api/v1/cases/:id` | OFFICER |

#### TC-CASE-104 — Decision table caseProvenance × linked_id_required matrix (8×2=16 cells)
- **Type/Priority/Severity**: DECISION / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Cover 16 cell — mỗi provenance × (có/không linkedXxxId)
- **Expected**: FROM_PETITION/FROM_INCIDENT yêu cầu linked → 400 nếu missing; còn lại không yêu cầu → 201
- **Data required**: `account.officer.primary, petition.assigned.D0, incident.assigned.D0`

#### TC-CASE-105 — Decision table TĐC: lyDo × status × daRaSoat
- **Type/Priority/Severity**: DECISION / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  4 combination key: (TAM_DINH_CHI + lyDo set + daRaSoat=false), (TAM_DINH_CHI + lyDo trống), (DANG_DIEU_TRA + lyDo set), (TAM_DINH_CHI + lyDo + daRaSoat=true + ketQua)
- **Expected**: Combo 1 OK, 2 400, 3 OK (lyDo ignored), 4 OK với phục hồi
- **Data required**: `case.investigating.D7`

#### TC-CASE-106 — Decision table delete preconditions
- **Type/Priority/Severity**: DECISION / P1 / Medium
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 case: (creator + no_link), (non-creator + no_link), (creator + linked_petition), (creator + linked_incident), (admin override + linked), (already deleted)
- **Expected**: Hành vi theo 6 business rules delete
- **Data required**: `case.creator_owned.D0, case.with_petition.D0, case.other_owned.D0, case.deleted.D7`

### SECURITY (13 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-082** | P0 | Critical | IDOR — truy cập case team khác → 403/404 | `GET /api/v1/cases/:id` | OFFICER |
| **TC-CASE-083** | P0 | Critical | SQL Injection trong name field | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-084** | P0 | Critical | XSS payload trong sourceDocumentNote | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-085** | P0 | Critical | NoSQL/Prisma injection qua metadata JSONB | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-086** | P0 | Critical | Mass assignment — gửi createdById, deletedAt | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-CASE-087** | P0 | High | JWT tampering — đổi role claim trong JWT | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-088** | P0 | High | CSRF — DELETE không có Origin/Referer match | `DELETE /api/v1/cases/:id` | OFFICER |
| **TC-CASE-089** | P1 | High | Path traversal trong search ?search=../../..etc/passwd | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-090** | P0 | Critical | Throttle export 5 req/60s | `GET /api/v1/cases/export/ward` | OFFICER |
| **TC-CASE-107** | P1 | High | Insecure deserialization — metadata field chứa __proto__ | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-108** | P0 | Critical | Audit log integrity — verify createdBy, ipAddress, userAgent lưu đúng | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-109** | P1 | High | Journey không leak data ngoài scope | `GET /api/v1/cases/:id/journey` | OFFICER |
| **TC-CASE-110** | P0 | Critical | Rate limit per-user — chống mass create | `POST /api/v1/cases` | OFFICER |

#### TC-CASE-082 — IDOR — truy cập case team khác → 403/404
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: Case thuộc team B, officer thuộc team A
- **Steps**:
  GET /api/v1/cases/{{teamB_case_id}}
- **Expected**: HTTP 403/404, scope filter chặn, không leak data
- **Data required**: `case.other_team.D0, account.officer.primary`

#### TC-CASE-083 — SQL Injection trong name field
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name:"'; DROP TABLE cases; --", caseProvenance:'DIRECT_DISCOVERY'}
- **Expected**: HTTP 201, name lưu literal string (Prisma parameterize). KHÔNG table drop
- **Data required**: `account.officer.primary`

#### TC-CASE-084 — XSS payload trong sourceDocumentNote
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {sourceDocumentNote:'<script>alert(1)</script>', ...}
- **Expected**: HTTP 201, lưu literal, khi render UI escape không execute
- **Data required**: `account.officer.primary`

#### TC-CASE-085 — NoSQL/Prisma injection qua metadata JSONB
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {metadata:{$ne:null}, ...}
- **Expected**: HTTP 201, metadata lưu raw, không bypass
- **Data required**: `account.officer.primary`

#### TC-CASE-086 — Mass assignment — gửi createdById, deletedAt
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {createdById:'attacker_id', deletedAt:null}
- **Expected**: HTTP 400 (whitelist:true forbidNonWhitelisted) hoặc field bị strip
- **Data required**: `case.investigating.D0`

#### TC-CASE-087 — JWT tampering — đổi role claim trong JWT
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET với JWT có role=ADMIN giả mạo (chữ ký sai)
- **Expected**: HTTP 401, signature verification fail

#### TC-CASE-088 — CSRF — DELETE không có Origin/Referer match
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE từ origin khác, không CSRF token
- **Expected**: HTTP 403 hoặc 401 (CORS/CSRF guard)
- **Data required**: `case.creator_owned.D0`

#### TC-CASE-089 — Path traversal trong search ?search=../../..etc/passwd
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?search=../../../etc/passwd
- **Expected**: HTTP 200, ILIKE literal, không leak filesystem
- **Data required**: `account.officer.primary`

#### TC-CASE-090 — Throttle export 5 req/60s
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/export/ward`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 lần GET export/ward trong 60s
- **Expected**: 6th request HTTP 429 Too Many Requests
- **Data required**: `account.officer.primary`

#### TC-CASE-107 — Insecure deserialization — metadata field chứa __proto__
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {metadata:{__proto__:{admin:true}}}
- **Expected**: HTTP 201, không pollute prototype object server
- **Data required**: `account.officer.primary`

#### TC-CASE-108 — Audit log integrity — verify createdBy, ipAddress, userAgent lưu đúng
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST + GET audit_log mới nhất
- **Expected**: audit_log entry có userId=current, ipAddress=req.ip, userAgent header value
- **Data required**: `account.officer.primary`

#### TC-CASE-109 — Journey không leak data ngoài scope
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/cases/:id/journey`
- **Role**: OFFICER
- **Pre**: Case có cross-team activity
- **Steps**:
  GET /journey
- **Expected**: Chỉ trả events thuộc dataScope user, không leak event team khác
- **Data required**: `case.cross_team_events.D60`

#### TC-CASE-110 — Rate limit per-user — chống mass create
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  100 POST trong 60s từ 1 user
- **Expected**: Sau N (theo throttler config) request 429
- **Data required**: `account.officer.primary`

### DATA (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-111** | P1 | High | i18n — name chứa ký tự Unicode tiếng Việt có dấu | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-112** | P1 | Medium | Emoji + special unicode trong name | `POST /api/v1/cases` | OFFICER |
| **TC-CASE-113** | P1 | Medium | Whitespace mixed (tab, nbsp) trong name — trim hoạt động | `POST /api/v1/cases` | OFFICER |

#### TC-CASE-111 — i18n — name chứa ký tự Unicode tiếng Việt có dấu
- **Type/Priority/Severity**: DATA / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST name='Vụ án trộm cắp tài sản — đối tượng Nguyễn Văn Đại'
- **Expected**: HTTP 201, lưu nguyên giá trị, GET trả lại đúng dấu
- **Data required**: `account.officer.primary`

#### TC-CASE-112 — Emoji + special unicode trong name
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST name='Vụ án 🚓👮 đặc biệt'
- **Expected**: HTTP 201, GET trả lại emoji
- **Data required**: `account.officer.primary`

#### TC-CASE-113 — Whitespace mixed (tab, nbsp) trong name — trim hoạt động
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST name='\t  Tên vụ án  \u00a0'
- **Expected**: HTTP 201, name lưu='Tên vụ án' (trim cả nbsp nếu transform hỗ trợ; nếu không, vẫn pass với leading/trailing)
- **Data required**: `account.officer.primary`

### A11Y (7 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-114** | P1 | Medium | Trang list /cases — keyboard navigation Tab order | `UI: /cases` | OFFICER |
| **TC-CASE-115** | P1 | Medium | Form tạo vụ án — aria-label cho input bắt buộc | `UI: /cases/new` | OFFICER |
| **TC-CASE-116** | P1 | Medium | Color contrast status badge ≥4.5:1 | `UI: /cases` | OFFICER |
| **TC-CASE-117** | P2 | Low | Detail page — H1 duy nhất, heading hierarchy hợp lệ | `UI: /cases/:id` | OFFICER |
| **TC-CASE-118** | P2 | Low | Form error message — aria-live region | `UI: /cases/new` | OFFICER |
| **TC-CASE-119** | P1 | Medium | Table — th có scope='col', row có scope='row' | `UI: /cases` | OFFICER |
| **TC-CASE-120** | P2 | Low | Skip-to-content link | `UI: /cases` | OFFICER |

#### TC-CASE-114 — Trang list /cases — keyboard navigation Tab order
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: Login UI
- **Steps**:
  1. Open /cases
2. Tab qua từng element
3. Verify focus visible
- **Expected**: Tab order logic: search → filter chips → table rows → pagination; mỗi focus có outline ring rõ
- **Data required**: `account.officer.primary`

#### TC-CASE-115 — Form tạo vụ án — aria-label cho input bắt buộc
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect DOM form #case-create
- **Expected**: Tất cả <input required> có aria-required='true' + aria-label/aria-labelledby
- **Data required**: `account.officer.primary`

#### TC-CASE-116 — Color contrast status badge ≥4.5:1
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Render status chip mỗi state, đo contrast với background
- **Expected**: Tất cả 10 status pair có ratio ≥4.5:1 (WCAG 2.1 AA)
- **Data required**: `cases.all_status.D0`

#### TC-CASE-117 — Detail page — H1 duy nhất, heading hierarchy hợp lệ
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect HTML headings
- **Expected**: 1 <h1>, không skip level (h2 → h4 fail)
- **Data required**: `case.investigating.D0`

#### TC-CASE-118 — Form error message — aria-live region
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /cases/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Submit form thiếu name → error
- **Expected**: Error hiển thị trong <div role='alert' aria-live='polite'> để screen reader đọc
- **Data required**: `account.officer.primary`

#### TC-CASE-119 — Table — th có scope='col', row có scope='row'
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect table headings
- **Expected**: <th scope='col'> trên header, screen reader phát đúng cột
- **Data required**: `cases.shape.normal.D0`

#### TC-CASE-120 — Skip-to-content link
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Tab đầu tiên trên page
- **Expected**: Skip link visible khi focus, click bỏ qua sidebar
- **Data required**: `account.officer.primary`

### COMPAT (7 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-121** | P1 | Medium | Chromium 120+ desktop 1920×1080 render | `UI: /cases` | OFFICER |
| **TC-CASE-122** | P1 | Medium | Firefox 121+ desktop render | `UI: /cases` | OFFICER |
| **TC-CASE-123** | P1 | Medium | Safari/WebKit 17+ desktop | `UI: /cases` | OFFICER |
| **TC-CASE-124** | P0 | High | Mobile 375×667 (iPhone SE) — drawer sidebar PWA | `UI: /cases` | OFFICER |
| **TC-CASE-125** | P1 | Medium | Tablet 768×1024 (iPad) | `UI: /cases` | OFFICER |
| **TC-CASE-126** | P2 | Low | Print stylesheet — print preview rõ ràng | `UI: /cases/:id` | OFFICER |
| **TC-CASE-127** | P2 | Low | Dark mode (prefers-color-scheme: dark) — contrast giữ AA | `UI: /cases` | OFFICER |

#### TC-CASE-121 — Chromium 120+ desktop 1920×1080 render
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open /cases trên Chromium
- **Expected**: Layout không vỡ, table sticky header, sidebar fixed
- **Data required**: `account.officer.primary`

#### TC-CASE-122 — Firefox 121+ desktop render
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open /cases trên Firefox
- **Expected**: Layout đồng nhất, không CSS-specific Chrome bị break
- **Data required**: `account.officer.primary`

#### TC-CASE-123 — Safari/WebKit 17+ desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open /cases trên WebKit
- **Expected**: Date input picker render, gap không vỡ
- **Data required**: `account.officer.primary`

#### TC-CASE-124 — Mobile 375×667 (iPhone SE) — drawer sidebar PWA
- **Type/Priority/Severity**: COMPAT / P0 / High
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Set viewport 375×667
- **Expected**: Sidebar collapse drawer, table horizontal scroll, no overflow
- **Data required**: `account.officer.primary`

#### TC-CASE-125 — Tablet 768×1024 (iPad)
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Viewport 768
- **Expected**: Sidebar visible, table giữ 6 cột chính
- **Data required**: `account.officer.primary`

#### TC-CASE-126 — Print stylesheet — print preview rõ ràng
- **Type/Priority/Severity**: COMPAT / P2 / Low
- **Endpoint**: `UI: /cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Ctrl+P trên detail page
- **Expected**: Print view ẩn sidebar, header gọn, không cắt bảng
- **Data required**: `case.investigating.D0`

#### TC-CASE-127 — Dark mode (prefers-color-scheme: dark) — contrast giữ AA
- **Type/Priority/Severity**: COMPAT / P2 / Low
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: OS dark mode
- **Steps**:
  Open /cases
- **Expected**: Toàn bộ UI có dark variant, không trắng trên trắng
- **Data required**: `account.officer.primary`

### PERFORMANCE (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-CASE-128** | P0 | High | List 10k cases — p95 < 800ms | `GET /api/v1/cases` | OFFICER |
| **TC-CASE-129** | P0 | High | Stats aggregation trên 10k cases < 500ms | `GET /api/v1/cases/stats` | OFFICER |
| **TC-CASE-130** | P0 | High | Export Excel 5000 rows < 10s | `GET /api/v1/cases/export/ward` | OFFICER |

#### TC-CASE-128 — List 10k cases — p95 < 800ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB seed 10000 cases
- **Steps**:
  100 GET ?limit=20 concurrent
- **Expected**: p95 latency < 800ms, không OOM
- **Data required**: `cases.shape.large.D0`

#### TC-CASE-129 — Stats aggregation trên 10k cases < 500ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases/stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  50 GET /stats concurrent
- **Expected**: p95 < 500ms, query plan dùng index status
- **Data required**: `cases.shape.large.D0`

#### TC-CASE-130 — Export Excel 5000 rows < 10s
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases/export/ward`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET export/ward fromDate=…toDate=cover 5000 cases
- **Expected**: Response < 10s, file size hợp lý, không timeout
- **Data required**: `cases.shape.large.D0`
