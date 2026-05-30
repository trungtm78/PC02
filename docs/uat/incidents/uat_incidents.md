# UAT — INCIDENTS

**Tổng TC**: 140/140 | **Mode**: LEAN | **Generated**: 2026-05-30

## Phân bố loại TC

| Loại | Số TC | Tỷ lệ |
|------|-------|-------|
| RED | 56 | 40.0% |
| GREEN | 18 | 12.9% |
| SECURITY | 14 | 10.0% |
| BOUNDARY | 10 | 7.1% |
| EP | 10 | 7.1% |
| STATE | 8 | 5.7% |
| A11Y | 7 | 5.0% |
| COMPAT | 6 | 4.3% |
| DECISION | 4 | 2.9% |
| DATA | 3 | 2.1% |
| PERFORMANCE | 3 | 2.1% |
| EDGE | 1 | 0.7% |

## Phân bố priority

| Priority | Số TC | Tỷ lệ |
|----------|-------|-------|
| P0 | 73 | 52.1% |
| P1 | 60 | 42.9% |
| P2 | 7 | 5.0% |

## Self-Audit Gate (LEAN 5 checkpoints)

- ✅ TC count ≥ target
- ✅ GREEN ≤ 20%
- ✅ RED ≥ 40%
- ✅ 12 loại có ≥ 1 case
- ✅ Fixture có setup+cleanup

## Data Fixtures

### `account.officer.primary`
**Ref**: `_shared/test-accounts.json#account.officer.primary`
**Setup**: login officer1@pc02.local
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id", "teamId": "$.user.primaryTeamId"}`

### `account.officer.secondary`
**Ref**: `_shared/test-accounts.json#account.officer.secondary`
**Setup**: login officer2@pc02.local
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "teamId": "$.user.primaryTeamId"}`

### `account.officer.no_team`
**Setup**: Admin tạo user mới chưa assign team
**Cleanup**: Admin delete user
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id"}`

### `account.officer.locked.D7`
**Setup**: Admin POST /admin/users/:id/lock với lockedAt=D-7
**Cleanup**: Admin POST /unlock
**Outputs**: `{"token": "$.token"}`

### `account.admin.primary`
**Ref**: `_shared/test-accounts.json#account.admin.primary`
**Setup**: login admin@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken"}`

### `incident.tiep_nhan.D0`
**Setup**: POST /api/v1/incidents {name:'UAT-VV-{{random}}', loaiDonVu:'TO_GIAC', nguonPhatTin:'CA_NHAN_TO_GIAC'} status mặc định TIEP_NHAN
**Cleanup**: DELETE /api/v1/incidents/{id}
**Outputs**: `{"incident_id": "$.id", "incident_updated_at": "$.updatedAt"}`

### `incident.dang_xac_minh.D7`
**Setup**: Tạo VV → PATCH /status DANG_XAC_MINH, set createdAt {{D-7}}
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.da_phan_cong.D30`
**Setup**: Tạo VV → assign + status DA_PHAN_CONG, createdAt {{D-30}}
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.giai_quyet.D60`
**Setup**: Tạo VV → chuỗi transition → DA_GIAI_QUYET, createdAt {{D-60}}
**Cleanup**: Prisma hard delete (terminal)
**Outputs**: `{"incident_id": "$.id"}`

### `incident.tdc.D30`
**Setup**: Tạo VV → PATCH status TAM_DINH_CHI + lyDoTamDinhChiVuViec=CHUA_CO_KET_QUA_GIAM_DINH
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.tdc.rasoat.D60`
**Setup**: VV TĐC + daRaSoat=true + ketQuaPhucHoiVuViec=DANG_XAC_MINH
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.tdc.expired.D365`
**Setup**: VV TĐC với ngayHetThoiHieu < now, createdAt D-365
**Cleanup**: Prisma hard delete
**Outputs**: `{"incident_id": "$.id"}`

### `incident.gia_han_1.D60`
**Setup**: Tạo VV → POST /extend lần 1, createdAt D-60
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.gia_han_2.D90`
**Setup**: Tạo VV → extend 2 lần, createdAt D-90
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.investigating.D0`
**Setup**: Generic VV ở giữa flow
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.investigating.D60`
**Setup**: VV đầy đủ thông tin đủ điều kiện khởi tố
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.investigating.D7.with_events`
**Setup**: VV có ≥3 events (create, assign, status_change)
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.cross_team_events.D60`
**Setup**: VV có events từ nhiều team (admin transfer + officer A + officer B comment)
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.unassigned.D0`
**Setup**: VV chưa assign investigator
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.creator_owned.D0`
**Setup**: Tạo bằng officer.primary → createdById=user
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.other_team.D0`
**Setup**: Tạo bằng officer.secondary (team B)
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.linked_to_case.D7`
**Setup**: Tạo VV → POST /prosecute → linkedCaseId set
**Cleanup**: DELETE Case → DELETE VV
**Outputs**: `{"incident_id": "$.id", "case_id": "$.linkedCaseId"}`

### `incident.merged.D7`
**Setup**: Tạo 2 VV → PATCH /merge
**Cleanup**: DELETE cả 2
**Outputs**: `{"incident_id": "$.id", "target_id": "$.mergedIntoId"}`

### `incident.da_chuyen_vu_an.D60`
**Setup**: VV đã prosecute, linkedCaseId set, status=DA_CHUYEN_VU_AN
**Cleanup**: DELETE Case → VV
**Outputs**: `{"incident_id": "$.id"}`

### `incident.deleted.D7`
**Setup**: Tạo VV → DELETE với reason, deletedAt set
**Cleanup**: Prisma hard delete
**Outputs**: `{"incident_id": "$.id"}`

### `incident.unlinked.D0`
**Setup**: VV không có linkedCaseId/linkedPetitionId
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id"}`

### `incident.recently_edited.D0`
**Setup**: PUT VV bằng admin2 mới (updatedAt hiện tại) — dùng để test optimistic lock
**Cleanup**: DELETE
**Outputs**: `{"incident_id": "$.id", "stale_updated_at": "$.oldUpdatedAt"}`

### `incidents.shape.normal.D0`
**Setup**: Seed 25 VV mix status
**Cleanup**: Loop DELETE
**Outputs**: `{"incident_ids": "$[*].id"}`

### `incidents.shape.full.D0`
**Setup**: Seed 100 VV — đủ 15 status
**Cleanup**: Loop DELETE
**Outputs**: `{"incident_ids": "$[*].id"}`

### `incidents.shape.large.D0`
**Setup**: Prisma raw insert 10000 VV
**Cleanup**: Prisma raw DELETE WHERE name LIKE 'UAT-PERF-VV-%'
**Outputs**: `{"count": "10000"}`

### `incidents.all_status.D0`
**Setup**: 15 VV — mỗi status 1 cái
**Cleanup**: DELETE all
**Outputs**: `{"incident_ids": "$[*].id"}`

### `petition.assigned.D0`
**Setup**: POST /api/v1/petitions
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

## Test Cases

### GREEN (18 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-001** | P0 | Critical | Tạo vụ việc với name + loaiDonVu=TO_GIAC + nguonPhatTin=CA_NHAN_TO_GIAC | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-002** | P0 | Critical | Tạo VV TIN_BAO + nguồn CO_QUAN_NHA_NUOC | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-003** | P0 | Critical | Tạo VV KIEN_NGHI_KHOI_TO + nguồn VIEN_KIEM_SAT | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-004** | P0 | High | Tạo VV liên kết sourcePetitionId | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-005** | P0 | Critical | Liệt kê VV mặc định pagination | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-006** | P0 | High | Stats counts by 15 IncidentStatus | `GET /api/v1/incidents/stats` | OFFICER |
| **TC-INC-007** | P0 | High | List linkable VV (chưa link Case) cho CaseProvenancePicker | `GET /api/v1/incidents/linkable` | OFFICER |
| **TC-INC-008** | P1 | Medium | List ĐTV cho assign dropdown | `GET /api/v1/incidents/investigators` | OFFICER |
| **TC-INC-009** | P0 | Critical | Xem chi tiết VV trong scope | `GET /api/v1/incidents/:id` | OFFICER |
| **TC-INC-010** | P0 | High | Cập nhật mô tả + ngayDeXuat | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-011** | P0 | Critical | Đổi status TIEP_NHAN → DANG_XAC_MINH | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-012** | P0 | Critical | Gia hạn lần 1 (Điều 147 khoản 2) | `POST /api/v1/incidents/:id/extend` | OFFICER |
| **TC-INC-013** | P0 | Critical | Gia hạn lần 2 (Điều 147 khoản 3) | `POST /api/v1/incidents/:id/extend` | OFFICER |
| **TC-INC-014** | P0 | Critical | Khởi tố VV → tạo Case | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-015** | P1 | High | Nhập VV vào VV khác | `PATCH /api/v1/incidents/:id/merge` | OFFICER |
| **TC-INC-016** | P1 | High | Chuyển đơn vị xử lý | `PATCH /api/v1/incidents/:id/transfer` | OFFICER |
| **TC-INC-017** | P1 | High | Phân công ĐTV | `PATCH /api/v1/incidents/:id/assign` | ADMIN |
| **TC-INC-018** | P0 | Critical | Xóa mềm VV | `DELETE /api/v1/incidents/:id` | OFFICER |

#### TC-INC-001 — Tạo vụ việc với name + loaiDonVu=TO_GIAC + nguonPhatTin=CA_NHAN_TO_GIAC
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {name:'Vụ việc tố giác trộm cắp UAT', loaiDonVu:'TO_GIAC', nguonPhatTin:'CA_NHAN_TO_GIAC', phuongThucTiepNhan:'TRUC_TIEP_BANG_LOI', fromDate:'2026-05-01'}
- **Expected**: HTTP 201, response.id≠null, status=TIEP_NHAN, code dạng VV-YYYY-NNNNN
- **Data required**: `account.officer.primary`

#### TC-INC-002 — Tạo VV TIN_BAO + nguồn CO_QUAN_NHA_NUOC
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {name:'Vụ việc tin báo UAT', loaiDonVu:'TIN_BAO', nguonPhatTin:'CO_QUAN_NHA_NUOC', phuongThucTiepNhan:'TRUC_TIEP_BANG_VAN_BAN'}
- **Expected**: HTTP 201, cascading OK
- **Data required**: `account.officer.primary`

#### TC-INC-003 — Tạo VV KIEN_NGHI_KHOI_TO + nguồn VIEN_KIEM_SAT
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {name, loaiDonVu:'KIEN_NGHI_KHOI_TO', nguonPhatTin:'VIEN_KIEM_SAT'}
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-INC-004 — Tạo VV liên kết sourcePetitionId
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: Có petition đã processing
- **Steps**:
  1. POST {name, sourcePetitionId:'{{petition_id}}'}
- **Expected**: HTTP 201, response.sourcePetitionId set
- **Data required**: `petition.assigned.D0`

#### TC-INC-005 — Liệt kê VV mặc định pagination
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: DB ≥20 VV
- **Steps**:
  1. GET /api/v1/incidents
- **Expected**: HTTP 200, items.length≤20, sorted createdAt desc
- **Data required**: `incidents.shape.normal.D0`

#### TC-INC-006 — Stats counts by 15 IncidentStatus
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/incidents/stats`
- **Role**: OFFICER
- **Pre**: DB có VV ở 15 status
- **Steps**:
  1. GET /stats
- **Expected**: HTTP 200, byStatus đủ 15 key
- **Data required**: `incidents.shape.full.D0`

#### TC-INC-007 — List linkable VV (chưa link Case) cho CaseProvenancePicker
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/incidents/linkable`
- **Role**: OFFICER
- **Pre**: DB có VV chưa linked
- **Steps**:
  1. GET /linkable
- **Expected**: HTTP 200, items không có linkedCaseId
- **Data required**: `incidents.unlinked.D0`

#### TC-INC-008 — List ĐTV cho assign dropdown
- **Type/Priority/Severity**: GREEN / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents/investigators`
- **Role**: OFFICER
- **Pre**: DB có users role INVESTIGATOR/OFFICER
- **Steps**:
  1. GET /investigators
- **Expected**: HTTP 200, array {id, fullName}
- **Data required**: `account.admin.primary`

#### TC-INC-009 — Xem chi tiết VV trong scope
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: Có VV
- **Steps**:
  1. GET /api/v1/incidents/{{incident_id}}
- **Expected**: HTTP 200, đủ field nguồn tin, deadline rule version
- **Data required**: `incident.investigating.D0`

#### TC-INC-010 — Cập nhật mô tả + ngayDeXuat
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV status TIEP_NHAN
- **Steps**:
  1. PUT {description:'Bổ sung mô tả mới', ngayDeXuat:'2026-05-15'}
- **Expected**: HTTP 200
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-011 — Đổi status TIEP_NHAN → DANG_XAC_MINH
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. PATCH /status body {status:'DANG_XAC_MINH'}
- **Expected**: HTTP 200, status_history thêm entry
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-012 — Gia hạn lần 1 (Điều 147 khoản 2)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/extend`
- **Role**: OFFICER
- **Pre**: VV chưa gia hạn
- **Steps**:
  1. POST /extend
- **Expected**: HTTP 200, deadline được kéo dài, giaHan1RuleVersionId snapshot
- **Data required**: `incident.dang_xac_minh.D30`

#### TC-INC-013 — Gia hạn lần 2 (Điều 147 khoản 3)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/extend`
- **Role**: OFFICER
- **Pre**: VV đã gia hạn 1 lần
- **Steps**:
  1. POST /extend lần 2
- **Expected**: HTTP 200, giaHan2RuleVersionId snapshot
- **Data required**: `incident.gia_han_1.D60`

#### TC-INC-014 — Khởi tố VV → tạo Case
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: VV có đủ thông tin khởi tố
- **Steps**:
  1. POST /prosecute body {loaiKetQua:'KHOI_TO', canCuKhoiToCode:'DIEM_C_KHOAN_1'}
- **Expected**: HTTP 200/201, response.caseId mới, VV.status=DA_CHUYEN_VU_AN, VV.linkedCaseId set
- **Data required**: `incident.investigating.D60`

#### TC-INC-015 — Nhập VV vào VV khác
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/merge`
- **Role**: OFFICER
- **Pre**: Có 2 VV
- **Steps**:
  1. PATCH /merge body {targetIncidentId:'{{other_incident}}'}
- **Expected**: HTTP 200, mergedIntoId set, status=DA_NHAP_VU_KHAC
- **Data required**: `incident.dang_xac_minh.D7, incident.investigating.D0`

#### TC-INC-016 — Chuyển đơn vị xử lý
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/transfer`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. PATCH /transfer body {chuyenDenDonVi:'CA Quận 1', lyDoChuyen:'Thẩm quyền'}
- **Expected**: HTTP 200, status=DA_CHUYEN_DON_VI, audit
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-017 — Phân công ĐTV
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  1. PATCH /assign body {investigatorId:'{{inv_id}}'}
- **Expected**: HTTP 200, investigatorId set, status=DA_PHAN_CONG
- **Data required**: `incident.unassigned.D0, account.admin.primary, account.officer.primary`

#### TC-INC-018 — Xóa mềm VV
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV chưa linked Case
- **Steps**:
  1. DELETE body {reason:'Lý do xóa hợp lệ 10+ char'}
- **Expected**: HTTP 200, deletedAt set
- **Data required**: `incident.tiep_nhan.D0`

### RED (56 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-019** | P0 | Critical | Thiếu name → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-020** | P0 | Critical | name < 5 ký tự → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-021** | P0 | High | nguonPhatTin không match loaiDonVu → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-022** | P0 | High | loaiDonVu ngoài enum → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-023** | P0 | High | phuongThucTiepNhan ngoài enum → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-024** | P0 | High | lyDoKhongKhoiTo ngoài 7 grounds → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-025** | P0 | Critical | Không JWT → 401 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-026** | P0 | Critical | VIEWER không có write/Incident → 403 | `POST /api/v1/incidents` | ADMIN |
| **TC-INC-027** | P0 | Critical | DELETE thiếu reason → 400 | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-028** | P0 | Critical | DELETE reason < 10 ký tự → 400 | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-029** | P0 | Critical | DELETE VV đã linked Case → 409 | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-030** | P0 | High | OFFICER (không DispatchGuard) gọi assign → 403 | `PATCH /api/v1/incidents/:id/assign` | OFFICER |
| **TC-INC-031** | P0 | Critical | PUT VV không thuộc scope → 403/404 | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-032** | P1 | High | fromDate > toDate → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-033** | P1 | Medium | fromDate sai format → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-034** | P1 | Medium | deadline sai format → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-035** | P0 | High | Gia hạn lần 3 → 400 | `POST /api/v1/incidents/:id/extend` | OFFICER |
| **TC-INC-036** | P0 | Critical | Khởi tố VV status=DA_CHUYEN_VU_AN (đã khởi tố) → 409 | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-037** | P0 | High | Khởi tố thiếu canCuKhoiToCode → 400 | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-038** | P0 | Critical | Status transition invalid (TIEP_NHAN → DA_GIAI_QUYET skip) → 400 | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-039** | P1 | High | Merge vào chính nó → 400 | `PATCH /api/v1/incidents/:id/merge` | OFFICER |
| **TC-INC-040** | P1 | High | Merge vào VV đã merged (chain) → 400 | `PATCH /api/v1/incidents/:id/merge` | OFFICER |
| **TC-INC-041** | P1 | High | Transfer thiếu chuyenDenDonVi → 400 | `PATCH /api/v1/incidents/:id/transfer` | OFFICER |
| **TC-INC-042** | P0 | High | GET VV không tồn tại → 404 | `GET /api/v1/incidents/:id` | OFFICER |
| **TC-INC-043** | P1 | Medium | Query status không thuộc enum 15 → 400 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-044** | P1 | Medium | Query limit > 100 → 400 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-045** | P0 | Critical | PUT VV đã deleted → 410/404 | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-046** | P1 | High | sourcePetitionId không tồn tại → 400/404 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-047** | P1 | High | unitId không tồn tại → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-048** | P2 | Medium | Unknown field (whitelist) → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-070** | P1 | Medium | Query offset âm → 400 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-071** | P1 | Medium | Query search > 200 chars → 400 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-072** | P0 | High | Extend VV không thuộc scope → 403/404 | `POST /api/v1/incidents/:id/extend` | OFFICER |
| **TC-INC-073** | P1 | High | PATCH /status VV deleted → 410/404 | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-074** | P1 | Medium | Merge thiếu targetIncidentId → 400 | `PATCH /api/v1/incidents/:id/merge` | OFFICER |
| **TC-INC-075** | P0 | High | OFFICER (no restore perm) → 403 | `POST /api/v1/incidents/:id/restore` | OFFICER |
| **TC-INC-076** | P0 | High | Restore reason < 10 → 400 | `POST /api/v1/incidents/:id/restore` | ADMIN |
| **TC-INC-077** | P1 | Medium | OFFICER admin/deleted → 403 | `GET /api/v1/incidents/admin/deleted` | OFFICER |
| **TC-INC-078** | P1 | High | Prosecute VV status TAM_DINH_CHI → 400 | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-079** | P0 | Critical | Prosecute VV không trong scope → 403/404 | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-080** | P1 | Medium | PUT description rất dài (1MB) → 413 hoặc 400 | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-081** | P0 | Critical | Concurrent merge cùng target → 1 success 1 conflict | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-082** | P0 | High | Transfer đến đơn vị không tồn tại → 400 | `PATCH /api/v1/incidents/:id/transfer` | OFFICER |
| **TC-INC-083** | P0 | High | PATCH status từ DA_GIAI_QUYET → QUA_HAN → 400 (final state) | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-103** | P0 | Critical | Tạo VV với deadline trong quá khứ → 400 hoặc warning | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-104** | P1 | High | assignedTeamId không tồn tại → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-105** | P1 | Medium | Page âm → fallback 1 | `GET /api/v1/incidents/:id/journey` | OFFICER |
| **TC-INC-106** | P1 | High | Transfer VV đã linked Case → 409 | `PATCH /api/v1/incidents/:id/transfer` | OFFICER |
| **TC-INC-107** | P1 | High | Merge VV đã merged → 400 | `PATCH /api/v1/incidents/:id/merge` | OFFICER |
| **TC-INC-108** | P1 | Medium | name chứa chỉ whitespace → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-109** | P0 | High | PUT update qua lỗi optimistic lock | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-110** | P0 | Critical | OFFICER không thuộc team → empty list | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-111** | P0 | Critical | Locked account → 401/403 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-112** | P1 | Medium | search > 100 chars → 400 hoặc 200 empty | `GET /api/v1/incidents/investigators` | OFFICER |
| **TC-INC-113** | P1 | High | sdtNguoiToGiac không hợp lệ (chữ cái) → 400 nếu có pattern, hoặc 201 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-114** | P1 | Medium | cmndNguoiToGiac sai format (11 chữ số) → 400 | `POST /api/v1/incidents` | OFFICER |

#### TC-INC-019 — Thiếu name → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST không name
- **Expected**: HTTP 400, IsString fail
- **Data required**: `account.officer.primary`

#### TC-INC-020 — name < 5 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {name:'Test'}
- **Expected**: HTTP 400, 'Tên vụ việc phải có ít nhất 5 ký tự'
- **Data required**: `account.officer.primary`

#### TC-INC-021 — nguonPhatTin không match loaiDonVu → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {loaiDonVu:'TO_GIAC', nguonPhatTin:'VIEN_KIEM_SAT'} (VKS chỉ thuộc KIEN_NGHI)
- **Expected**: HTTP 400, custom validator IsNguonPhatTinMatchLoaiDonVu fail
- **Data required**: `account.officer.primary`

#### TC-INC-022 — loaiDonVu ngoài enum → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {loaiDonVu:'INVALID'}
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-023 — phuongThucTiepNhan ngoài enum → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {phuongThucTiepNhan:'CARRIER_PIGEON'}
- **Expected**: HTTP 400, gợi ý 5 phương thức TT 28/2020
- **Data required**: `account.officer.primary`

#### TC-INC-024 — lyDoKhongKhoiTo ngoài 7 grounds → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {lyDoKhongKhoiTo:'INVENTED'}
- **Expected**: HTTP 400, gợi ý 7 căn cứ Đ.157
- **Data required**: `account.officer.primary`

#### TC-INC-025 — Không JWT → 401
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST không header Authorization
- **Expected**: HTTP 401

#### TC-INC-026 — VIEWER không có write/Incident → 403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: ADMIN
- **Pre**: User role VIEWER
- **Steps**:
  1. POST với VIEWER token
- **Expected**: HTTP 403
- **Data required**: `account.admin.primary`

#### TC-INC-027 — DELETE thiếu reason → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. DELETE body {}
- **Expected**: HTTP 400, 'Lý do xóa bắt buộc'
- **Data required**: `incident.creator_owned.D0`

#### TC-INC-028 — DELETE reason < 10 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. DELETE body {reason:'short'}
- **Expected**: HTTP 400
- **Data required**: `incident.creator_owned.D0`

#### TC-INC-029 — DELETE VV đã linked Case → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV có linkedCaseId
- **Steps**:
  1. DELETE
- **Expected**: HTTP 409, message liên kết Case
- **Data required**: `incident.linked_to_case.D7`

#### TC-INC-030 — OFFICER (không DispatchGuard) gọi assign → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/assign`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. PATCH /assign
- **Expected**: HTTP 403
- **Data required**: `incident.unassigned.D0, account.officer.primary`

#### TC-INC-031 — PUT VV không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV thuộc team khác
- **Steps**:
  1. PUT /api/v1/incidents/{{other_team_id}}
- **Expected**: HTTP 403/404
- **Data required**: `incident.other_team.D0`

#### TC-INC-032 — fromDate > toDate → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {fromDate:'2026-06-01', toDate:'2026-05-01'}
- **Expected**: HTTP 400, EC-05 fromDate <= toDate
- **Data required**: `account.officer.primary`

#### TC-INC-033 — fromDate sai format → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {fromDate:'01/06/2026'}
- **Expected**: HTTP 400, 'Từ ngày không đúng định dạng'
- **Data required**: `account.officer.primary`

#### TC-INC-034 — deadline sai format → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {deadline:'tomorrow'}
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-035 — Gia hạn lần 3 → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/extend`
- **Role**: OFFICER
- **Pre**: VV đã gia hạn 2 lần
- **Steps**:
  1. POST /extend lần 3
- **Expected**: HTTP 400, max 2 lần Điều 147
- **Data required**: `incident.gia_han_2.D90`

#### TC-INC-036 — Khởi tố VV status=DA_CHUYEN_VU_AN (đã khởi tố) → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: VV đã khởi tố trước đó
- **Steps**:
  1. POST /prosecute lần 2
- **Expected**: HTTP 409
- **Data required**: `incident.da_chuyen_vu_an.D60`

#### TC-INC-037 — Khởi tố thiếu canCuKhoiToCode → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: VV đủ điều kiện
- **Steps**:
  1. POST /prosecute body {loaiKetQua:'KHOI_TO'} không canCuKhoiToCode
- **Expected**: HTTP 400
- **Data required**: `incident.investigating.D60`

#### TC-INC-038 — Status transition invalid (TIEP_NHAN → DA_GIAI_QUYET skip) → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: VV TIEP_NHAN
- **Steps**:
  1. PATCH /status {status:'DA_GIAI_QUYET'}
- **Expected**: HTTP 400, transition map
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-039 — Merge vào chính nó → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/merge`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. PATCH /merge body {targetIncidentId:'{{same_id}}'}
- **Expected**: HTTP 400, self-merge forbidden
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-040 — Merge vào VV đã merged (chain) → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/merge`
- **Role**: OFFICER
- **Pre**: Target đã có mergedIntoId
- **Steps**:
  1. PATCH /merge target=incident_đã_merge
- **Expected**: HTTP 400, no chain merge
- **Data required**: `incident.merged.D7, incident.tiep_nhan.D0`

#### TC-INC-041 — Transfer thiếu chuyenDenDonVi → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/transfer`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. PATCH /transfer body {lyDoChuyen:'Thẩm quyền'}
- **Expected**: HTTP 400
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-042 — GET VV không tồn tại → 404
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. GET /api/v1/incidents/00000000-...
- **Expected**: HTTP 404
- **Data required**: `account.officer.primary`

#### TC-INC-043 — Query status không thuộc enum 15 → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. GET ?status=INVALID
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-044 — Query limit > 100 → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. GET ?limit=200
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-045 — PUT VV đã deleted → 410/404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV deletedAt≠null
- **Steps**:
  1. PUT
- **Expected**: HTTP 410/404
- **Data required**: `incident.deleted.D7`

#### TC-INC-046 — sourcePetitionId không tồn tại → 400/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {sourcePetitionId:'fake-uuid'}
- **Expected**: HTTP 400/404, FK Petition
- **Data required**: `account.officer.primary`

#### TC-INC-047 — unitId không tồn tại → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {unitId:'fake'}
- **Expected**: HTTP 400, FK Unit
- **Data required**: `account.officer.primary`

#### TC-INC-048 — Unknown field (whitelist) → 400
- **Type/Priority/Severity**: RED / P2 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST {name, randomField:'x'}
- **Expected**: HTTP 400, property randomField should not exist
- **Data required**: `account.officer.primary`

#### TC-INC-070 — Query offset âm → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?offset=-1
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-071 — Query search > 200 chars → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?search=<201 chars>
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-INC-072 — Extend VV không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/extend`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /extend other team
- **Expected**: HTTP 403/404
- **Data required**: `incident.other_team.D0`

#### TC-INC-073 — PATCH /status VV deleted → 410/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH
- **Expected**: HTTP 410/404
- **Data required**: `incident.deleted.D7`

#### TC-INC-074 — Merge thiếu targetIncidentId → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PATCH /api/v1/incidents/:id/merge`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH /merge body {}
- **Expected**: HTTP 400
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-075 — OFFICER (no restore perm) → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/restore`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /restore
- **Expected**: HTTP 403
- **Data required**: `incident.deleted.D7, account.officer.primary`

#### TC-INC-076 — Restore reason < 10 → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/restore`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  POST /restore body {reason:'sh'}
- **Expected**: HTTP 400
- **Data required**: `incident.deleted.D7, account.admin.primary`

#### TC-INC-077 — OFFICER admin/deleted → 403
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents/admin/deleted`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: HTTP 403
- **Data required**: `account.officer.primary`

#### TC-INC-078 — Prosecute VV status TAM_DINH_CHI → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /prosecute
- **Expected**: HTTP 400, không khởi tố từ TĐC
- **Data required**: `incident.tdc.D30`

#### TC-INC-079 — Prosecute VV không trong scope → 403/404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST
- **Expected**: HTTP 403/404
- **Data required**: `incident.other_team.D0`

#### TC-INC-080 — PUT description rất dài (1MB) → 413 hoặc 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT description=1MB string
- **Expected**: HTTP 413 Payload Too Large hoặc 400
- **Data required**: `incident.investigating.D0`

#### TC-INC-081 — Concurrent merge cùng target → 1 success 1 conflict
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  2 PATCH /merge song song
- **Expected**: 1 OK 1 409
- **Data required**: `incident.tiep_nhan.D0, incident.dang_xac_minh.D7`

#### TC-INC-082 — Transfer đến đơn vị không tồn tại → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/transfer`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH transfer chuyenDenDonVi='Cơ quan không có'
- **Expected**: HTTP 400/404
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-083 — PATCH status từ DA_GIAI_QUYET → QUA_HAN → 400 (final state)
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH /status
- **Expected**: HTTP 400, terminal state
- **Data required**: `incident.giai_quyet.D60`

#### TC-INC-103 — Tạo VV với deadline trong quá khứ → 400 hoặc warning
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST deadline='2020-01-01'
- **Expected**: HTTP 201 (validation chỉ check ISO) hoặc 400 nếu business rule
- **Data required**: `account.officer.primary`

#### TC-INC-104 — assignedTeamId không tồn tại → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {assignedTeamId:'fake'}
- **Expected**: HTTP 400/404
- **Data required**: `account.officer.primary`

#### TC-INC-105 — Page âm → fallback 1
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents/:id/journey`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?page=-3
- **Expected**: 200 với page=1
- **Data required**: `incident.investigating.D7.with_events`

#### TC-INC-106 — Transfer VV đã linked Case → 409
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/transfer`
- **Role**: OFFICER
- **Pre**: VV.linkedCaseId set
- **Steps**:
  PATCH /transfer
- **Expected**: HTTP 409
- **Data required**: `incident.linked_to_case.D7`

#### TC-INC-107 — Merge VV đã merged → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/merge`
- **Role**: OFFICER
- **Pre**: VV mergedIntoId set
- **Steps**:
  PATCH /merge
- **Expected**: HTTP 400, đã merge
- **Data required**: `incident.merged.D7`

#### TC-INC-108 — name chứa chỉ whitespace → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST name='     '
- **Expected**: HTTP 400 nếu trim, hoặc 400 vì < 5 sau trim
- **Data required**: `account.officer.primary`

#### TC-INC-109 — PUT update qua lỗi optimistic lock
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV bị edit bởi user khác
- **Steps**:
  PUT với expectedUpdatedAt cũ
- **Expected**: HTTP 409
- **Data required**: `incident.recently_edited.D0`

#### TC-INC-110 — OFFICER không thuộc team → empty list
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: User mới chưa assign team
- **Steps**:
  GET /api/v1/incidents
- **Expected**: HTTP 200, items=[] (scope filter strict)
- **Data required**: `account.officer.no_team.D0`

#### TC-INC-111 — Locked account → 401/403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST với locked account
- **Expected**: HTTP 401/403
- **Data required**: `account.officer.locked.D7`

#### TC-INC-112 — search > 100 chars → 400 hoặc 200 empty
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents/investigators`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?search=<200 chars>
- **Expected**: HTTP 200 với items=[] hoặc 400
- **Data required**: `account.officer.primary`

#### TC-INC-113 — sdtNguoiToGiac không hợp lệ (chữ cái) → 400 nếu có pattern, hoặc 201
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST sdtNguoiToGiac='abc'
- **Expected**: HTTP 201 (DTO chưa có validator) hoặc 400 nếu service validate
- **Data required**: `account.officer.primary`

#### TC-INC-114 — cmndNguoiToGiac sai format (11 chữ số) → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST cmndNguoiToGiac='12345678901' (CMND/CCCD 12 chữ)
- **Expected**: HTTP 201 hoặc 400
- **Data required**: `account.officer.primary`

### BOUNDARY (10 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-049** | P0 | Critical | name = 5 ký tự (min) → 201 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-050** | P0 | Critical | name = 4 ký tự → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-051** | P1 | High | name = 255 ký tự (max) → 201 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-052** | P1 | High | name = 256 ký tự → 400 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-053** | P1 | Medium | incidentType = 100 ký tự (max) → 201 | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-054** | P0 | High | reason = 10 chars (min) | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-055** | P0 | High | reason = 500 chars (max) | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-056** | P0 | High | reason = 501 chars → 400 | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-057** | P1 | Medium | limit=1 (min) → 200 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-058** | P1 | Medium | limit=100 (max) → 200 | `GET /api/v1/incidents` | OFFICER |

#### TC-INC-049 — name = 5 ký tự (min) → 201
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST name='12345'
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-INC-050 — name = 4 ký tự → 400
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST name='1234'
- **Expected**: HTTP 400, MinLength
- **Data required**: `account.officer.primary`

#### TC-INC-051 — name = 255 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST name length=255
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-INC-052 — name = 256 ký tự → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST name length=256
- **Expected**: HTTP 400, MaxLength
- **Data required**: `account.officer.primary`

#### TC-INC-053 — incidentType = 100 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  1. POST incidentType length=100
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-INC-054 — reason = 10 chars (min)
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE reason='1234567890'
- **Expected**: HTTP 200
- **Data required**: `incident.creator_owned.D0`

#### TC-INC-055 — reason = 500 chars (max)
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE reason length=500
- **Expected**: HTTP 200
- **Data required**: `incident.creator_owned.D0`

#### TC-INC-056 — reason = 501 chars → 400
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE reason 501
- **Expected**: HTTP 400
- **Data required**: `incident.creator_owned.D0`

#### TC-INC-057 — limit=1 (min) → 200
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?limit=1
- **Expected**: HTTP 200, items.length<=1
- **Data required**: `incidents.shape.normal.D0`

#### TC-INC-058 — limit=100 (max) → 200
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?limit=100
- **Expected**: HTTP 200
- **Data required**: `incidents.shape.large.D0`

### EP (10 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-060** | P1 | Medium | loaiDonVu 3 partition | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-061** | P1 | High | NguonPhatTin partition cho TO_GIAC (1 value) | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-062** | P1 | High | NguonPhatTin partition cho TIN_BAO (4 values) | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-063** | P1 | High | NguonPhatTin partition cho KIEN_NGHI (5 values) | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-064** | P1 | Medium | PhuongThucTiepNhan đủ 5 partition | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-065** | P1 | High | IncidentStatus 15 enum partition | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-066** | P1 | Medium | LyDoTamDinhChiVuViec 6 partition | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-067** | P1 | Medium | KetQuaPhucHoiVuViec 5 partition | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-068** | P1 | Medium | LyDoKhongKhoiTo 7 partition | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-069** | P2 | Low | Filter caseType (linked-Case vs not) | `GET /api/v1/incidents` | OFFICER |

#### TC-INC-060 — loaiDonVu 3 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 3 enum LoaiNguonTin với nguonPhatTin matching
- **Expected**: 3 lần 201
- **Data required**: `account.officer.primary`

#### TC-INC-061 — NguonPhatTin partition cho TO_GIAC (1 value)
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST loaiDonVu=TO_GIAC nguonPhatTin=CA_NHAN_TO_GIAC
- **Expected**: 201
- **Data required**: `account.officer.primary`

#### TC-INC-062 — NguonPhatTin partition cho TIN_BAO (4 values)
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop {CO_QUAN_NHA_NUOC, TO_CHUC, CA_NHAN_BAO_TIN, PHUONG_TIEN_TRUYEN_THONG}
- **Expected**: 4 lần 201
- **Data required**: `account.officer.primary`

#### TC-INC-063 — NguonPhatTin partition cho KIEN_NGHI (5 values)
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop {VIEN_KIEM_SAT, THANH_TRA, KIEM_TOAN, TOA_AN, CO_QUAN_KHAC}
- **Expected**: 5 lần 201
- **Data required**: `account.officer.primary`

#### TC-INC-064 — PhuongThucTiepNhan đủ 5 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 5 enum
- **Expected**: 5 lần 201
- **Data required**: `account.officer.primary`

#### TC-INC-065 — IncidentStatus 15 enum partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Mỗi enum value PATCH /status (sau khi đặt VV ở state hợp lý)
- **Expected**: Mỗi value transition hợp lệ → 200, invalid transition → 400
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-066 — LyDoTamDinhChiVuViec 6 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV ready cho TAM_DINH_CHI
- **Steps**:
  Loop 6 enum
- **Expected**: 6 lần 200
- **Data required**: `incident.dang_xac_minh.D30`

#### TC-INC-067 — KetQuaPhucHoiVuViec 5 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: VV TAM_DINH_CHI rasoat
- **Steps**:
  Loop 5 enum
- **Expected**: 5 lần 200
- **Data required**: `incident.tdc.rasoat.D60`

#### TC-INC-068 — LyDoKhongKhoiTo 7 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 7 enum Đ.157
- **Expected**: 7 lần 201
- **Data required**: `account.officer.primary`

#### TC-INC-069 — Filter caseType (linked-Case vs not)
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: DB có cả 2
- **Steps**:
  GET ?linkedCaseId rồi ?linkedCaseId__null
- **Expected**: Đúng tập
- **Data required**: `incidents.shape.full.D0`

### EDGE (1 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-059** | P2 | Low | Tạo VV với fromDate=toDate (cùng ngày) | `POST /api/v1/incidents` | OFFICER |

#### TC-INC-059 — Tạo VV với fromDate=toDate (cùng ngày)
- **Type/Priority/Severity**: EDGE / P2 / Low
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {fromDate:'2026-05-30', toDate:'2026-05-30'}
- **Expected**: HTTP 201, EC-05 pass
- **Data required**: `account.officer.primary`

### STATE (8 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-091** | P0 | Critical | Transition: TIEP_NHAN → DANG_XAC_MINH | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-092** | P0 | Critical | DANG_XAC_MINH → DA_PHAN_CONG (sau assign) | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-093** | P0 | Critical | DA_PHAN_CONG → DA_GIAI_QUYET | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-094** | P0 | Critical | DANG_XAC_MINH → TAM_DINH_CHI (kèm lyDo) | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-095** | P0 | High | TAM_DINH_CHI → PHUC_HOI_NGUON_TIN (sau rà soát) | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-096** | P0 | High | DANG_XAC_MINH → DA_CHUYEN_VU_AN (khởi tố) | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-097** | P1 | High | TAM_DINH_CHI → TDC_HET_THOI_HIEU (auto-update khi quá hạn) | `PATCH /api/v1/incidents/:id/status` | OFFICER |
| **TC-INC-098** | P0 | High | Invalid transition: DA_GIAI_QUYET → TIEP_NHAN → 400 | `PATCH /api/v1/incidents/:id/status` | OFFICER |

#### TC-INC-091 — Transition: TIEP_NHAN → DANG_XAC_MINH
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH status=DANG_XAC_MINH
- **Expected**: 200, history += entry
- **Data required**: `incident.tiep_nhan.D0`

#### TC-INC-092 — DANG_XAC_MINH → DA_PHAN_CONG (sau assign)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: VV assigned
- **Steps**:
  PATCH status=DA_PHAN_CONG
- **Expected**: 200
- **Data required**: `incident.dang_xac_minh.D7`

#### TC-INC-093 — DA_PHAN_CONG → DA_GIAI_QUYET
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH
- **Expected**: 200, status_history
- **Data required**: `incident.da_phan_cong.D30`

#### TC-INC-094 — DANG_XAC_MINH → TAM_DINH_CHI (kèm lyDo)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT lyDoTamDinhChiVuViec='CHUA_CO_KET_QUA_GIAM_DINH' rồi PATCH status=TAM_DINH_CHI
- **Expected**: 200
- **Data required**: `incident.dang_xac_minh.D7`

#### TC-INC-095 — TAM_DINH_CHI → PHUC_HOI_NGUON_TIN (sau rà soát)
- **Type/Priority/Severity**: STATE / P0 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: daRaSoat=true ketQuaPhucHoiVuViec set
- **Steps**:
  PATCH
- **Expected**: 200
- **Data required**: `incident.tdc.rasoat.D60`

#### TC-INC-096 — DANG_XAC_MINH → DA_CHUYEN_VU_AN (khởi tố)
- **Type/Priority/Severity**: STATE / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /prosecute
- **Expected**: 200, linkedCaseId set
- **Data required**: `incident.dang_xac_minh.D60`

#### TC-INC-097 — TAM_DINH_CHI → TDC_HET_THOI_HIEU (auto-update khi quá hạn)
- **Type/Priority/Severity**: STATE / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: VV TĐC + ngayHetThoiHieu < now
- **Steps**:
  PATCH hoặc job tự update
- **Expected**: 200
- **Data required**: `incident.tdc.expired.D365`

#### TC-INC-098 — Invalid transition: DA_GIAI_QUYET → TIEP_NHAN → 400
- **Type/Priority/Severity**: STATE / P0 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/status`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH
- **Expected**: HTTP 400
- **Data required**: `incident.giai_quyet.D60`

### DECISION (4 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-099** | P0 | Critical | Decision matrix loaiDonVu × nguonPhatTin (3×10=30 cell, only 10 valid) | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-100** | P0 | High | Decision matrix gia hạn: lần × status | `POST /api/v1/incidents/:id/extend` | OFFICER |
| **TC-INC-101** | P1 | High | Decision delete: 6 business rules | `DELETE /api/v1/incidents/:id` | OFFICER |
| **TC-INC-102** | P0 | High | Decision prosecute: status × loaiKetQua matrix | `POST /api/v1/incidents/:id/prosecute` | OFFICER |

#### TC-INC-099 — Decision matrix loaiDonVu × nguonPhatTin (3×10=30 cell, only 10 valid)
- **Type/Priority/Severity**: DECISION / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Cover toàn matrix: 10 valid → 201, 20 invalid → 400
- **Expected**: Đúng decision table
- **Data required**: `account.officer.primary`

#### TC-INC-100 — Decision matrix gia hạn: lần × status
- **Type/Priority/Severity**: DECISION / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/extend`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  4 combo: (0_lần, TIEP_NHAN), (1_lần, DANG_XAC_MINH), (2_lần, DANG_XAC_MINH), (2_lần, DA_GIAI_QUYET)
- **Expected**: Combo 1-3 OK, 4 reject (đã 2 lần)
- **Data required**: `incident.tiep_nhan.D0, incident.gia_han_1.D60, incident.gia_han_2.D90, incident.giai_quyet.D60`

#### TC-INC-101 — Decision delete: 6 business rules
- **Type/Priority/Severity**: DECISION / P1 / High
- **Endpoint**: `DELETE /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 case: (no_link), (linked_case), (linked_petition), (linked_subject), (already_deleted), (terminal_state)
- **Expected**: Hành vi theo 6 rules
- **Data required**: `incident.creator_owned.D0, incident.linked_to_case.D7, incident.deleted.D7`

#### TC-INC-102 — Decision prosecute: status × loaiKetQua matrix
- **Type/Priority/Severity**: DECISION / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  5 status × 4 loaiKetQua matrix
- **Expected**: Chỉ TIEP_NHAN/DANG_XAC_MINH + loaiKetQua=KHOI_TO → success
- **Data required**: `incident.tiep_nhan.D0, incident.dang_xac_minh.D7, incident.tdc.D30`

### SECURITY (14 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-084** | P0 | Critical | IDOR — VV team khác → 403/404 | `GET /api/v1/incidents/:id` | OFFICER |
| **TC-INC-085** | P0 | Critical | SQL Injection trong name | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-086** | P0 | Critical | XSS trong description | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-087** | P0 | Critical | Mass assignment — gửi createdById, deletedAt | `PUT /api/v1/incidents/:id` | OFFICER |
| **TC-INC-088** | P1 | High | JWT signature tamper → 401 | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-089** | P0 | High | Throttle 5/60s | `GET /api/v1/incidents/export/ward` | OFFICER |
| **TC-INC-090** | P1 | High | Journey không leak events team khác | `GET /api/v1/incidents/:id/journey` | OFFICER |
| **TC-INC-115** | P0 | Critical | Audit log integrity verify | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-116** | P0 | Critical | Prosecute audit trail — atomic với Case create | `POST /api/v1/incidents/:id/prosecute` | OFFICER |
| **TC-INC-117** | P1 | High | OFFICER admin/deleted leak danh sách → 403 | `GET /api/v1/incidents/admin/deleted` | OFFICER |
| **TC-INC-118** | P1 | High | Assign tới user role không phù hợp (VIEWER) → 400 | `PATCH /api/v1/incidents/:id/assign` | ADMIN |
| **TC-INC-119** | P0 | Critical | NoSQL injection trong description | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-120** | P0 | Critical | BOLA — sequential ID scan để guess incident IDs | `GET /api/v1/incidents/:id` | OFFICER |
| **TC-INC-124** | P0 | Critical | Transfer audit không bị tampering | `PATCH /api/v1/incidents/:id/transfer` | OFFICER |

#### TC-INC-084 — IDOR — VV team khác → 403/404
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /api/v1/incidents/{{teamB}}
- **Expected**: HTTP 403/404
- **Data required**: `incident.other_team.D0, account.officer.primary`

#### TC-INC-085 — SQL Injection trong name
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name:"'; DROP TABLE incidents; --"}
- **Expected**: HTTP 201, name literal
- **Data required**: `account.officer.primary`

#### TC-INC-086 — XSS trong description
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST description='<img src=x onerror=alert(1)>'
- **Expected**: HTTP 201, render UI escape
- **Data required**: `account.officer.primary`

#### TC-INC-087 — Mass assignment — gửi createdById, deletedAt
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `PUT /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {createdById:'attacker', deletedAt:null}
- **Expected**: HTTP 400 (whitelist) hoặc strip
- **Data required**: `incident.investigating.D0`

#### TC-INC-088 — JWT signature tamper → 401
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET với JWT bị sửa role=ADMIN
- **Expected**: HTTP 401

#### TC-INC-089 — Throttle 5/60s
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `GET /api/v1/incidents/export/ward`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 GET export trong 60s
- **Expected**: 6th → 429
- **Data required**: `account.officer.primary`

#### TC-INC-090 — Journey không leak events team khác
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/incidents/:id/journey`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /journey
- **Expected**: Chỉ events trong scope
- **Data required**: `incident.cross_team_events.D60`

#### TC-INC-115 — Audit log integrity verify
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST + check audit_log
- **Expected**: audit_log có userId, ipAddress, userAgent
- **Data required**: `account.officer.primary`

#### TC-INC-116 — Prosecute audit trail — atomic với Case create
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /prosecute
- **Expected**: VV.linkedCaseId + Case.linkedIncidentId atomically; nếu fail rollback cả 2
- **Data required**: `incident.investigating.D60`

#### TC-INC-117 — OFFICER admin/deleted leak danh sách → 403
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/incidents/admin/deleted`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: HTTP 403, KHÔNG leak filenames qua error
- **Data required**: `account.officer.primary`

#### TC-INC-118 — Assign tới user role không phù hợp (VIEWER) → 400
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `PATCH /api/v1/incidents/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  PATCH /assign body {investigatorId:'<viewer_uid>'}
- **Expected**: HTTP 400, không assign cho non-investigator
- **Data required**: `incident.tiep_nhan.D0, account.admin.primary`

#### TC-INC-119 — NoSQL injection trong description
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST description={$gt:''}
- **Expected**: HTTP 201, description lưu literal hoặc 400
- **Data required**: `account.officer.primary`

#### TC-INC-120 — BOLA — sequential ID scan để guess incident IDs
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/incidents/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Bash loop GET /incidents/{seq_id_1...100}
- **Expected**: Tất cả không thuộc scope đều 403/404, không leak count
- **Data required**: `account.officer.primary`

#### TC-INC-124 — Transfer audit không bị tampering
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `PATCH /api/v1/incidents/:id/transfer`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH /transfer + verify status_history immutable
- **Expected**: status_history append-only, không update/delete
- **Data required**: `incident.tiep_nhan.D0`

### DATA (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-121** | P1 | High | Unicode tiếng Việt có dấu trong name + description | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-122** | P1 | Medium | Emoji trong description | `POST /api/v1/incidents` | OFFICER |
| **TC-INC-123** | P1 | Medium | Search match Vietnamese-fold (đồng ↔ dong) | `GET /api/v1/incidents` | OFFICER |

#### TC-INC-121 — Unicode tiếng Việt có dấu trong name + description
- **Type/Priority/Severity**: DATA / P1 / High
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST name='Vụ việc trộm cắp tài sản — Nguyễn Văn Đệ' description='Đã phát hiện đối tượng nghi vấn'
- **Expected**: HTTP 201, GET lại đúng dấu
- **Data required**: `account.officer.primary`

#### TC-INC-122 — Emoji trong description
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST description='Vụ việc nghiêm trọng ⚠️🚨'
- **Expected**: HTTP 201, GET trả emoji nguyên vẹn
- **Data required**: `account.officer.primary`

#### TC-INC-123 — Search match Vietnamese-fold (đồng ↔ dong)
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: DB có VV name chứa 'Đông'
- **Steps**:
  GET ?search=dong
- **Expected**: HTTP 200, match (nếu citext/unaccent) — verify behavior
- **Data required**: `incidents.shape.normal.D0`

### A11Y (7 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-125** | P1 | Medium | List page keyboard nav | `UI: /vu-viec` | OFFICER |
| **TC-INC-126** | P1 | Medium | Form aria-required + aria-describedby cho hint | `UI: /vu-viec/new` | OFFICER |
| **TC-INC-127** | P1 | Medium | Status badge contrast WCAG AA cho 15 status | `UI: /vu-viec` | OFFICER |
| **TC-INC-128** | P2 | Low | Detail page H1 + heading hierarchy | `UI: /vu-viec/:id` | OFFICER |
| **TC-INC-129** | P1 | Medium | Cascading select loaiDonVu → nguonPhatTin announce screen reader | `UI: /vu-viec/new` | OFFICER |
| **TC-INC-130** | P2 | Low | Error toast role=alert | `UI: /vu-viec` | OFFICER |
| **TC-INC-131** | P2 | Low | Skip-to-content link | `UI: /vu-viec` | OFFICER |

#### TC-INC-125 — List page keyboard nav
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: Login
- **Steps**:
  Tab qua filter chips, table rows, pagination
- **Expected**: Focus visible mọi element, Enter activate
- **Data required**: `account.officer.primary`

#### TC-INC-126 — Form aria-required + aria-describedby cho hint
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /vu-viec/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect form
- **Expected**: name input có aria-required=true + aria-describedby refer hint 'min 5 ký tự'
- **Data required**: `account.officer.primary`

#### TC-INC-127 — Status badge contrast WCAG AA cho 15 status
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Render 15 badge + đo contrast
- **Expected**: 15 pair ≥4.5:1
- **Data required**: `incidents.all_status.D0`

#### TC-INC-128 — Detail page H1 + heading hierarchy
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /vu-viec/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect headings
- **Expected**: 1 h1, không skip level
- **Data required**: `incident.investigating.D0`

#### TC-INC-129 — Cascading select loaiDonVu → nguonPhatTin announce screen reader
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /vu-viec/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Chọn loaiDonVu, verify nguonPhatTin update + aria-live announce
- **Expected**: aria-live='polite' announce 'Có 4 nguồn phát tin'
- **Data required**: `account.officer.primary`

#### TC-INC-130 — Error toast role=alert
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Trigger lỗi server (e.g. 500)
- **Expected**: Toast có role='alert' aria-live='assertive'
- **Data required**: `account.officer.primary`

#### TC-INC-131 — Skip-to-content link
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Tab đầu page
- **Expected**: Skip link visible khi focus
- **Data required**: `account.officer.primary`

### COMPAT (6 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-132** | P1 | Medium | Chromium desktop | `UI: /vu-viec` | OFFICER |
| **TC-INC-133** | P1 | Medium | Firefox desktop | `UI: /vu-viec` | OFFICER |
| **TC-INC-134** | P1 | Medium | WebKit desktop | `UI: /vu-viec` | OFFICER |
| **TC-INC-135** | P0 | High | Mobile 375 viewport | `UI: /vu-viec` | OFFICER |
| **TC-INC-136** | P1 | Medium | Tablet 768 viewport | `UI: /vu-viec` | OFFICER |
| **TC-INC-137** | P2 | Low | Dark mode | `UI: /vu-viec` | OFFICER |

#### TC-INC-132 — Chromium desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open trên Chromium 120+
- **Expected**: Layout OK
- **Data required**: `account.officer.primary`

#### TC-INC-133 — Firefox desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open trên Firefox 121+
- **Expected**: Layout đồng nhất
- **Data required**: `account.officer.primary`

#### TC-INC-134 — WebKit desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open WebKit
- **Expected**: Date picker render
- **Data required**: `account.officer.primary`

#### TC-INC-135 — Mobile 375 viewport
- **Type/Priority/Severity**: COMPAT / P0 / High
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Set viewport
- **Expected**: Sidebar drawer, table scroll horizontal
- **Data required**: `account.officer.primary`

#### TC-INC-136 — Tablet 768 viewport
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Set viewport
- **Expected**: Layout adapt
- **Data required**: `account.officer.primary`

#### TC-INC-137 — Dark mode
- **Type/Priority/Severity**: COMPAT / P2 / Low
- **Endpoint**: `UI: /vu-viec`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Toggle OS
- **Expected**: Dark theme apply
- **Data required**: `account.officer.primary`

### PERFORMANCE (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-INC-138** | P0 | High | List 10k incidents p95 < 800ms | `GET /api/v1/incidents` | OFFICER |
| **TC-INC-139** | P0 | High | Stats trên 10k < 500ms | `GET /api/v1/incidents/stats` | OFFICER |
| **TC-INC-140** | P0 | High | Prosecute atomic transaction < 2s | `POST /api/v1/incidents/:id/prosecute` | OFFICER |

#### TC-INC-138 — List 10k incidents p95 < 800ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/incidents`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  100 GET concurrent
- **Expected**: p95 < 800ms
- **Data required**: `incidents.shape.large.D0`

#### TC-INC-139 — Stats trên 10k < 500ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/incidents/stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  50 GET stats
- **Expected**: p95 < 500ms
- **Data required**: `incidents.shape.large.D0`

#### TC-INC-140 — Prosecute atomic transaction < 2s
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `POST /api/v1/incidents/:id/prosecute`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /prosecute
- **Expected**: Response < 2s (Case create + VV update transaction)
- **Data required**: `incident.investigating.D60`
