# UAT — PETITIONS

**Tổng TC**: 120/120 | **Mode**: LEAN | **Generated**: 2026-05-30

## Phân bố loại TC

| Loại | Số TC | Tỷ lệ |
|------|-------|-------|
| RED | 48 | 40.0% |
| GREEN | 16 | 13.3% |
| SECURITY | 12 | 10.0% |
| BOUNDARY | 9 | 7.5% |
| EP | 9 | 7.5% |
| A11Y | 6 | 5.0% |
| COMPAT | 6 | 5.0% |
| STATE | 5 | 4.2% |
| DECISION | 3 | 2.5% |
| PERFORMANCE | 3 | 2.5% |
| DATA | 2 | 1.7% |
| EDGE | 1 | 0.8% |

## Phân bố priority

| Priority | Số TC | Tỷ lệ |
|----------|-------|-------|
| P0 | 62 | 51.7% |
| P1 | 50 | 41.7% |
| P2 | 8 | 6.7% |

## Self-Audit Gate (LEAN 5 checkpoints)

- ✅ TC count ≥ target
- ✅ GREEN ≤ 20%
- ✅ RED ≥ 40%
- ✅ 12 loại có ≥ 1 case
- ✅ Fixture có setup+cleanup

## Data Fixtures

### `account.officer.primary`
**Ref**: `_shared/test-accounts.json#account.officer.primary`
**Setup**: login officer1@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "userId": "$.user.id", "teamId": "$.user.primaryTeamId"}`

### `account.officer.secondary`
**Ref**: `_shared/test-accounts.json#account.officer.secondary`
**Setup**: login officer2@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken"}`

### `account.officer.locked.D7`
**Setup**: Admin lock officer1 với lockedAt D-7
**Cleanup**: Admin unlock
**Outputs**: `{"token": "$.token"}`

### `account.admin.primary`
**Ref**: `_shared/test-accounts.json#account.admin.primary`
**Setup**: login admin@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken"}`

### `account.viewer.D0`
**Setup**: Admin seed user role VIEWER
**Cleanup**: Admin delete user
**Outputs**: `{"token": "$.accessToken"}`

### `petition.moi_tiep_nhan.D0`
**Setup**: POST /api/v1/petitions {senderName:'UAT-{{random}}', receivedDate:'{{today}}', petitionType:'TO_CAO'}
**Cleanup**: DELETE /api/v1/petitions/{id}
**Outputs**: `{"petition_id": "$.id"}`

### `petition.dang_xu_ly.D7`
**Setup**: Tạo petition → PUT status=DANG_XU_LY, createdAt D-7
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.cho_phe_duyet.D14`
**Setup**: Petition → CHO_PHE_DUYET
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.luu_don.D30`
**Setup**: Petition → DA_LUU_DON
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.giai_quyet.D30`
**Setup**: Petition → DA_GIAI_QUYET
**Cleanup**: Prisma hard delete
**Outputs**: `{"petition_id": "$.id"}`

### `petition.converted_incident.D7`
**Setup**: Petition → POST /convert-incident → linkedIncidentId set
**Cleanup**: DELETE Incident → DELETE Petition
**Outputs**: `{"petition_id": "$.id", "incident_id": "$.linkedIncidentId"}`

### `petition.converted_case.D7`
**Setup**: Petition → POST /convert-case → linkedCaseId set
**Cleanup**: DELETE Case → DELETE Petition
**Outputs**: `{"petition_id": "$.id", "case_id": "$.linkedCaseId"}`

### `petition.creator_owned.D0`
**Setup**: POST với officer.primary
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.other_team.D0`
**Setup**: POST với officer.secondary (team B)
**Cleanup**: DELETE bằng officer.secondary
**Outputs**: `{"petition_id": "$.id"}`

### `petition.unassigned.D0`
**Setup**: POST không assignedToId
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.assigned.D0`
**Setup**: POST + PATCH /assign
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id", "petition_updated_at": "$.updatedAt"}`

### `petition.assigned.D7`
**Setup**: Petition assigned 7 ngày trước
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.minimal.D0`
**Setup**: POST chỉ senderName + receivedDate + petitionType (không business fields)
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.with_business_content.D7`
**Setup**: POST đủ field business: nhanThay, deXuat, baoCaoBanGiamDoc, canCuPhapLy, raSoatTrung
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.with_events.D60`
**Setup**: Petition có ≥5 events (create, assign, status_change, comment, attachment)
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id"}`

### `petition.deleted.D7`
**Setup**: Petition → DELETE
**Cleanup**: Prisma hard delete
**Outputs**: `{"petition_id": "$.id"}`

### `petition.stt_existing.D0`
**Setup**: Petition có stt='DT-2026-00001'
**Cleanup**: DELETE
**Outputs**: `{"stt": "DT-2026-00001"}`

### `petition.recently_edited.D0`
**Setup**: Petition vừa edited bằng admin2
**Cleanup**: DELETE
**Outputs**: `{"petition_id": "$.id", "stale_updated_at": "$.oldAt"}`

### `petition.batch_3.D0`
**Setup**: Seed 3 petitions đủ business content
**Cleanup**: Loop DELETE
**Outputs**: `{"petition_ids": "$[*].id"}`

### `petitions.shape.normal.D0`
**Setup**: Seed 25 petitions mix status
**Cleanup**: Loop DELETE
**Outputs**: `{"petition_ids": "$[*].id"}`

### `petitions.shape.full.D0`
**Setup**: Seed 100 petitions
**Cleanup**: Loop DELETE
**Outputs**: `{"petition_ids": "$[*].id"}`

### `petitions.shape.large.D0`
**Setup**: Prisma raw insert 10000
**Cleanup**: Prisma raw DELETE
**Outputs**: `{"count": "10000"}`

### `petitions.all_status.D0`
**Setup**: 7 petitions — mỗi status 1
**Cleanup**: DELETE all
**Outputs**: `{"petition_ids": "$[*].id"}`

### `petitions.mixed_link.D0`
**Setup**: 6 petitions — 2 unlinked, 2 linkedCaseId, 2 linkedIncidentId
**Cleanup**: DELETE cẩn thận order
**Outputs**: `{"petition_ids": "$[*].id"}`

## Test Cases

### GREEN (16 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-001** | P0 | Critical | Tạo đơn tố cáo với senderName + receivedDate + petitionType=TO_CAO | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-002** | P0 | Critical | Tạo đơn KHIEU_NAI | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-003** | P0 | High | Tạo đơn KIEN_NGHI | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-004** | P0 | High | Tạo đơn PHAN_ANH | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-005** | P0 | High | Tạo đơn với stt tự cung cấp (override engine) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-006** | P0 | High | Tạo đơn đủ thông tin sender (phone, email, address, birthYear) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-007** | P0 | Critical | List petitions default pagination | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-008** | P0 | High | Stats 7 PetitionStatus | `GET /api/v1/petitions/stats` | OFFICER |
| **TC-PET-009** | P0 | Critical | Xem chi tiết đơn | `GET /api/v1/petitions/:id` | OFFICER |
| **TC-PET-010** | P0 | High | Cập nhật nội dung đơn | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-011** | P0 | Critical | Convert đơn thành Vụ việc (atomic) | `POST /api/v1/petitions/:id/convert-incident` | OFFICER |
| **TC-PET-012** | P0 | Critical | Convert đơn thành Vụ án (atomic) | `POST /api/v1/petitions/:id/convert-case` | OFFICER |
| **TC-PET-013** | P0 | Critical | Soft delete đơn | `DELETE /api/v1/petitions/:id` | OFFICER |
| **TC-PET-014** | P1 | High | Phân công xử lý đơn | `PATCH /api/v1/petitions/:id/assign` | ADMIN |
| **TC-PET-015** | P1 | High | Export PHIEU_DE_XUAT docx | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-016** | P1 | High | Batch export 3 đơn → ZIP | `POST /api/v1/petitions/export-document-batch` | OFFICER |

#### TC-PET-001 — Tạo đơn tố cáo với senderName + receivedDate + petitionType=TO_CAO
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {senderName:'Nguyễn Văn A', receivedDate:'2026-05-30', petitionType:'TO_CAO'}
- **Expected**: HTTP 201, response.id≠null, stt format DT-2026-NNNNN auto-gen, status=MOI_TIEP_NHAN
- **Data required**: `account.officer.primary`

#### TC-PET-002 — Tạo đơn KHIEU_NAI
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {senderName, receivedDate, petitionType:'KHIEU_NAI'}
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-003 — Tạo đơn KIEN_NGHI
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionType=KIEN_NGHI
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-004 — Tạo đơn PHAN_ANH
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionType=PHAN_ANH
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-005 — Tạo đơn với stt tự cung cấp (override engine)
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {stt:'DT-2026-99999', senderName, receivedDate, petitionType:'TO_CAO'}
- **Expected**: HTTP 201, stt='DT-2026-99999'
- **Data required**: `account.officer.primary`

#### TC-PET-006 — Tạo đơn đủ thông tin sender (phone, email, address, birthYear)
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST đủ field sender
- **Expected**: HTTP 201, sender info lưu đúng
- **Data required**: `account.officer.primary`

#### TC-PET-007 — List petitions default pagination
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: DB ≥20 đơn
- **Steps**:
  GET /api/v1/petitions
- **Expected**: HTTP 200, items.length≤20, sorted receivedDate desc
- **Data required**: `petitions.shape.normal.D0`

#### TC-PET-008 — Stats 7 PetitionStatus
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/petitions/stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /stats
- **Expected**: HTTP 200, byStatus đủ 7 key
- **Data required**: `petitions.shape.full.D0`

#### TC-PET-009 — Xem chi tiết đơn
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: Có petition
- **Steps**:
  GET /api/v1/petitions/{{petition_id}}
- **Expected**: HTTP 200, đủ field
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-010 — Cập nhật nội dung đơn
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {summary:'Tóm tắt cập nhật'}
- **Expected**: HTTP 200
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-011 — Convert đơn thành Vụ việc (atomic)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions/:id/convert-incident`
- **Role**: OFFICER
- **Pre**: Petition đang DANG_XU_LY
- **Steps**:
  POST /convert-incident body {incidentName, loaiDonVu, nguonPhatTin}
- **Expected**: HTTP 200/201, petition.linkedIncidentId set, petition.status=DA_CHUYEN_VU_VIEC, Incident mới tạo
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-012 — Convert đơn thành Vụ án (atomic)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions/:id/convert-case`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /convert-case body {caseName, caseProvenance:'FROM_PETITION'}
- **Expected**: HTTP 200/201, petition.linkedCaseId set, status=DA_CHUYEN_VU_AN
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-013 — Soft delete đơn
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `DELETE /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: Chưa convert
- **Steps**:
  DELETE body {reason:'Lý do hợp lệ'}
- **Expected**: HTTP 200, deletedAt set
- **Data required**: `petition.creator_owned.D0`

#### TC-PET-014 — Phân công xử lý đơn
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `PATCH /api/v1/petitions/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  PATCH /assign body {assignedToId:'{{officer_id}}'}
- **Expected**: HTTP 200, assignedToId set
- **Data required**: `petition.unassigned.D0, account.admin.primary, account.officer.primary`

#### TC-PET-015 — Export PHIEU_DE_XUAT docx
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: Petition có đủ field business
- **Steps**:
  GET /export-document?docType=PHIEU_DE_XUAT
- **Expected**: HTTP 200, Content-Type docx, file size > 0
- **Data required**: `petition.with_business_content.D7`

#### TC-PET-016 — Batch export 3 đơn → ZIP
- **Type/Priority/Severity**: GREEN / P1 / High
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {petitionIds:['{{p1}}','{{p2}}','{{p3}}'], docType:'PHIEU_DE_XUAT'}
- **Expected**: HTTP 200, Content-Type zip, manifest.json bên trong
- **Data required**: `petition.batch_3.D0`

### RED (48 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-017** | P0 | Critical | Thiếu senderName → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-018** | P0 | Critical | Thiếu receivedDate → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-019** | P0 | Critical | Thiếu petitionType → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-020** | P0 | High | petitionType ngoài enum → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-021** | P0 | High | senderEmail không hợp lệ → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-022** | P0 | High | senderPhone chứa chữ cái → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-023** | P0 | Critical | Không JWT → 401 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-024** | P0 | Critical | Convert đơn đã DA_CHUYEN_VU_VIEC → 409 | `POST /api/v1/petitions/:id/convert-incident` | OFFICER |
| **TC-PET-025** | P0 | Critical | Convert đơn đã DA_CHUYEN_VU_AN → 409 | `POST /api/v1/petitions/:id/convert-case` | OFFICER |
| **TC-PET-026** | P0 | Critical | DELETE đơn đã linked Case/VV → 409 | `DELETE /api/v1/petitions/:id` | OFFICER |
| **TC-PET-027** | P0 | Critical | DELETE reason < 10 → 400 | `DELETE /api/v1/petitions/:id` | OFFICER |
| **TC-PET-028** | P0 | High | GET không tồn tại → 404 | `GET /api/v1/petitions/:id` | OFFICER |
| **TC-PET-029** | P0 | Critical | docType không thuộc 6 template → 400 | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-030** | P0 | High | Batch petitionIds.length > 100 → 400 | `POST /api/v1/petitions/export-document-batch` | OFFICER |
| **TC-PET-031** | P0 | Critical | receivedDate sai format → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-032** | P1 | High | deadline sai format → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-033** | P0 | Critical | stt trùng → 409 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-034** | P0 | Critical | VIEWER không có write/Petition → 403 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-035** | P0 | Critical | PUT đơn không thuộc scope → 403/404 | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-036** | P0 | Critical | PUT đơn đã DA_CHUYEN_VU_VIEC → 409 | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-037** | P0 | High | Convert đơn DA_LUU_DON → 400 | `POST /api/v1/petitions/:id/convert-incident` | OFFICER |
| **TC-PET-038** | P0 | High | Convert thiếu caseName trong body → 400 | `POST /api/v1/petitions/:id/convert-case` | OFFICER |
| **TC-PET-039** | P0 | High | Convert thiếu loaiDonVu → 400 | `POST /api/v1/petitions/:id/convert-incident` | OFFICER |
| **TC-PET-040** | P1 | High | OFFICER assign (no DispatchGuard) → 403 | `PATCH /api/v1/petitions/:id/assign` | OFFICER |
| **TC-PET-041** | P1 | High | Assign tới user không tồn tại → 400/404 | `PATCH /api/v1/petitions/:id/assign` | ADMIN |
| **TC-PET-042** | P0 | High | Export docType khi petition thiếu field business required → 400 | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-043** | P1 | Medium | Batch petitionIds=[] (empty) → 400 | `POST /api/v1/petitions/export-document-batch` | OFFICER |
| **TC-PET-044** | P1 | Medium | Batch petitionIds chứa ID không tồn tại → 200 với manifest đánh dấu fail | `POST /api/v1/petitions/export-document-batch` | OFFICER |
| **TC-PET-045** | P0 | High | OFFICER → 403 | `GET /api/v1/petitions/admin/deleted` | OFFICER |
| **TC-PET-046** | P0 | High | Restore không có permission → 403 | `POST /api/v1/petitions/:id/restore` | OFFICER |
| **TC-PET-047** | P0 | High | Restore reason < 10 → 400 | `POST /api/v1/petitions/:id/restore` | ADMIN |
| **TC-PET-048** | P1 | Medium | Throttle 6 req trong 60s → 429 | `GET /api/v1/petitions/export` | OFFICER |
| **TC-PET-068** | P1 | Medium | Query status không thuộc enum → 400 | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-069** | P1 | Medium | Query limit > 100 → 400 | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-070** | P1 | Medium | Query offset âm → 400 | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-071** | P0 | Critical | detailContent rất dài (>1MB) → 413/400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-072** | P1 | High | PUT thay đổi stt → 400 (immutable) | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-073** | P1 | High | assignedToId không tồn tại → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-074** | P1 | Medium | assignedTeamId không tồn tại → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-075** | P2 | Medium | Duplicate detection không tìm thấy → 200 empty | `GET /api/v1/petitions/export/duplicates` | OFFICER |
| **TC-PET-076** | P2 | Low | docType không hợp lệ → 400 | `POST /api/v1/petitions/export-document-batch` | OFFICER |
| **TC-PET-077** | P1 | High | Legacy export-word đơn deleted → 410/404 | `GET /api/v1/petitions/:id/export-word` | OFFICER |
| **TC-PET-100** | P1 | Medium | Assign về null (unassign) → 200 | `PATCH /api/v1/petitions/:id/assign` | ADMIN |
| **TC-PET-101** | P1 | High | Convert đơn không thuộc scope → 403/404 | `POST /api/v1/petitions/:id/convert-case` | OFFICER |
| **TC-PET-102** | P1 | High | PUT optimistic lock stale → 409 | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-103** | P2 | Low | Account locked → 401 | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-104** | P1 | Medium | Journey limit > 200 → clamp 200 | `GET /api/v1/petitions/:id/journey` | OFFICER |
| **TC-PET-105** | P1 | Medium | Trùng senderEmail + receivedDate (duplicate detection) → flagged trong export | `POST /api/v1/petitions` | OFFICER |

#### TC-PET-017 — Thiếu senderName → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST không senderName
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-018 — Thiếu receivedDate → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST không receivedDate
- **Expected**: HTTP 400, IsDateString fail
- **Data required**: `account.officer.primary`

#### TC-PET-019 — Thiếu petitionType → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST không petitionType
- **Expected**: HTTP 400, 'Loại đơn thư là bắt buộc'
- **Data required**: `account.officer.primary`

#### TC-PET-020 — petitionType ngoài enum → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionType='INVALID'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-021 — senderEmail không hợp lệ → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderEmail='not-an-email'
- **Expected**: HTTP 400, 'Email không đúng định dạng'
- **Data required**: `account.officer.primary`

#### TC-PET-022 — senderPhone chứa chữ cái → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderPhone='abc123'
- **Expected**: HTTP 400, 'Số điện thoại không hợp lệ'
- **Data required**: `account.officer.primary`

#### TC-PET-023 — Không JWT → 401
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST không Authorization
- **Expected**: HTTP 401

#### TC-PET-024 — Convert đơn đã DA_CHUYEN_VU_VIEC → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions/:id/convert-incident`
- **Role**: OFFICER
- **Pre**: Petition đã chuyển VV
- **Steps**:
  POST /convert-incident lần 2
- **Expected**: HTTP 409
- **Data required**: `petition.converted_incident.D7`

#### TC-PET-025 — Convert đơn đã DA_CHUYEN_VU_AN → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions/:id/convert-case`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /convert-case lần 2
- **Expected**: HTTP 409
- **Data required**: `petition.converted_case.D7`

#### TC-PET-026 — DELETE đơn đã linked Case/VV → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: linkedCaseId hoặc linkedIncidentId set
- **Steps**:
  DELETE
- **Expected**: HTTP 409, gỡ link trước
- **Data required**: `petition.converted_case.D7`

#### TC-PET-027 — DELETE reason < 10 → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE body {reason:'sh'}
- **Expected**: HTTP 400
- **Data required**: `petition.creator_owned.D0`

#### TC-PET-028 — GET không tồn tại → 404
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /api/v1/petitions/00000000-...
- **Expected**: HTTP 404
- **Data required**: `account.officer.primary`

#### TC-PET-029 — docType không thuộc 6 template → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?docType=INVALID
- **Expected**: HTTP 400
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-030 — Batch petitionIds.length > 100 → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionIds=101 items
- **Expected**: HTTP 400, max 100
- **Data required**: `account.officer.primary`

#### TC-PET-031 — receivedDate sai format → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST receivedDate='30/05/2026'
- **Expected**: HTTP 400, IsDateString
- **Data required**: `account.officer.primary`

#### TC-PET-032 — deadline sai format → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST deadline='tomorrow'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-033 — stt trùng → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: DB có petition stt='DT-2026-00001'
- **Steps**:
  POST {stt:'DT-2026-00001', ...}
- **Expected**: HTTP 409, unique constraint
- **Data required**: `petition.stt_existing.D0`

#### TC-PET-034 — VIEWER không có write/Petition → 403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST với VIEWER
- **Expected**: HTTP 403
- **Data required**: `account.viewer.D0`

#### TC-PET-035 — PUT đơn không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT other team
- **Expected**: HTTP 403/404
- **Data required**: `petition.other_team.D0`

#### TC-PET-036 — PUT đơn đã DA_CHUYEN_VU_VIEC → 409
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT
- **Expected**: HTTP 409, đơn đã convert
- **Data required**: `petition.converted_incident.D7`

#### TC-PET-037 — Convert đơn DA_LUU_DON → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/:id/convert-incident`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST
- **Expected**: HTTP 400, status không cho phép convert
- **Data required**: `petition.luu_don.D30`

#### TC-PET-038 — Convert thiếu caseName trong body → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/:id/convert-case`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /convert-case body {caseProvenance:'FROM_PETITION'} không caseName
- **Expected**: HTTP 400
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-039 — Convert thiếu loaiDonVu → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/:id/convert-incident`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /convert-incident thiếu loaiDonVu
- **Expected**: HTTP 400
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-040 — OFFICER assign (no DispatchGuard) → 403
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/petitions/:id/assign`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PATCH /assign
- **Expected**: HTTP 403
- **Data required**: `petition.unassigned.D0, account.officer.primary`

#### TC-PET-041 — Assign tới user không tồn tại → 400/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PATCH /api/v1/petitions/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  PATCH {assignedToId:'fake-uuid'}
- **Expected**: HTTP 400/404
- **Data required**: `petition.unassigned.D0, account.admin.primary`

#### TC-PET-042 — Export docType khi petition thiếu field business required → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: Petition không có nhanThay/deXuat
- **Steps**:
  GET ?docType=PHIEU_DE_XUAT
- **Expected**: HTTP 400, message field thiếu
- **Data required**: `petition.minimal.D0`

#### TC-PET-043 — Batch petitionIds=[] (empty) → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionIds=[]
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-044 — Batch petitionIds chứa ID không tồn tại → 200 với manifest đánh dấu fail
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST mix valid+invalid IDs
- **Expected**: HTTP 200, ZIP có manifest.failed[] entries
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-045 — OFFICER → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/petitions/admin/deleted`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: HTTP 403
- **Data required**: `account.officer.primary`

#### TC-PET-046 — Restore không có permission → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/:id/restore`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST /restore
- **Expected**: HTTP 403
- **Data required**: `petition.deleted.D7, account.officer.primary`

#### TC-PET-047 — Restore reason < 10 → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/petitions/:id/restore`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  POST /restore reason='sh'
- **Expected**: HTTP 400
- **Data required**: `petition.deleted.D7, account.admin.primary`

#### TC-PET-048 — Throttle 6 req trong 60s → 429
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions/export`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 GET /export trong 60s
- **Expected**: 6th → 429
- **Data required**: `account.officer.primary`

#### TC-PET-068 — Query status không thuộc enum → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?status=INVALID
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-069 — Query limit > 100 → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?limit=200
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-070 — Query offset âm → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?offset=-1
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-071 — detailContent rất dài (>1MB) → 413/400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST detailContent=1MB string
- **Expected**: HTTP 413 hoặc 400
- **Data required**: `account.officer.primary`

#### TC-PET-072 — PUT thay đổi stt → 400 (immutable)
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {stt:'DT-NEW-12345'}
- **Expected**: HTTP 400 nếu service enforce, hoặc 200 với stt giữ nguyên
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-073 — assignedToId không tồn tại → 400
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST assignedToId='fake'
- **Expected**: HTTP 400/404
- **Data required**: `account.officer.primary`

#### TC-PET-074 — assignedTeamId không tồn tại → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST assignedTeamId='fake'
- **Expected**: HTTP 400/404
- **Data required**: `account.officer.primary`

#### TC-PET-075 — Duplicate detection không tìm thấy → 200 empty
- **Type/Priority/Severity**: RED / P2 / Medium
- **Endpoint**: `GET /api/v1/petitions/export/duplicates`
- **Role**: OFFICER
- **Pre**: DB không có dup
- **Steps**:
  GET
- **Expected**: HTTP 200, items=[]
- **Data required**: `account.officer.primary`

#### TC-PET-076 — docType không hợp lệ → 400
- **Type/Priority/Severity**: RED / P2 / Low
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST docType='WRONG'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-077 — Legacy export-word đơn deleted → 410/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-word`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: HTTP 410/404
- **Data required**: `petition.deleted.D7`

#### TC-PET-100 — Assign về null (unassign) → 200
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PATCH /api/v1/petitions/:id/assign`
- **Role**: ADMIN
- **Pre**: Petition đã có assignedToId
- **Steps**:
  PATCH /assign body {assignedToId:null}
- **Expected**: HTTP 200, assignedToId=null
- **Data required**: `petition.assigned.D7, account.admin.primary`

#### TC-PET-101 — Convert đơn không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `POST /api/v1/petitions/:id/convert-case`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST
- **Expected**: HTTP 403/404
- **Data required**: `petition.other_team.D0`

#### TC-PET-102 — PUT optimistic lock stale → 409
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT với expectedUpdatedAt cũ
- **Expected**: HTTP 409
- **Data required**: `petition.recently_edited.D0`

#### TC-PET-103 — Account locked → 401
- **Type/Priority/Severity**: RED / P2 / Low
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET với locked
- **Expected**: HTTP 401
- **Data required**: `account.officer.locked.D7`

#### TC-PET-104 — Journey limit > 200 → clamp 200
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions/:id/journey`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?limit=500
- **Expected**: HTTP 200, items≤200
- **Data required**: `petition.with_events.D60`

#### TC-PET-105 — Trùng senderEmail + receivedDate (duplicate detection) → flagged trong export
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST 2 đơn cùng senderEmail+receivedDate
- **Expected**: Cả 2 HTTP 201, export/duplicates trả 2 items
- **Data required**: `account.officer.primary`

### BOUNDARY (9 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-049** | P0 | Critical | senderName = 255 ký tự (max) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-050** | P0 | Critical | senderName = 256 → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-051** | P1 | High | summary = 1000 ký tự (max) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-052** | P1 | High | summary = 1001 → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-053** | P1 | Medium | senderBirthYear = 4 ký tự (max) → 201 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-054** | P1 | Medium | senderBirthYear = 5 ký tự → 400 | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-055** | P1 | Medium | senderPhone = 20 ký tự (max) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-056** | P1 | Medium | nhanThay = 5000 ký tự (max) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-057** | P0 | High | Batch petitionIds.length = 100 (max) | `POST /api/v1/petitions/export-document-batch` | OFFICER |

#### TC-PET-049 — senderName = 255 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderName length=255
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-050 — senderName = 256 → 400
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderName=256
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-051 — summary = 1000 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST summary=1000
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-052 — summary = 1001 → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST summary=1001
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-053 — senderBirthYear = 4 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderBirthYear='1980'
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-054 — senderBirthYear = 5 ký tự → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderBirthYear='12345'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-PET-055 — senderPhone = 20 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderPhone='+84 901-234-567-890'
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-056 — nhanThay = 5000 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST nhanThay=5000
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-PET-057 — Batch petitionIds.length = 100 (max)
- **Type/Priority/Severity**: BOUNDARY / P0 / High
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST petitionIds=100 items
- **Expected**: HTTP 200
- **Data required**: `petitions.shape.full.D0`

### EP (9 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-059** | P1 | High | LoaiDon đủ 4 partition | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-060** | P1 | Medium | Filter status 7 partition | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-061** | P1 | High | docType 6 template partition | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-062** | P1 | Medium | priority partition (HIGH/MEDIUM/LOW) | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-063** | P1 | Medium | baoCaoBanGiamDoc boolean partition | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-064** | P1 | Medium | senderEmail partition (valid/invalid) | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-065** | P1 | Medium | Filter unlinked (no linkedCaseId AND no linkedIncidentId) | `GET /api/v1/petitions/linkable` | OFFICER |
| **TC-PET-066** | P2 | Low | Sort partition (asc/desc × stt/receivedDate/createdAt) | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-067** | P1 | Medium | Assign reassign partition | `PATCH /api/v1/petitions/:id/assign` | ADMIN |

#### TC-PET-059 — LoaiDon đủ 4 partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 4 enum
- **Expected**: 4 lần 201
- **Data required**: `account.officer.primary`

#### TC-PET-060 — Filter status 7 partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: DB có đủ 7
- **Steps**:
  Loop 7 ?status
- **Expected**: Mỗi truy vấn trả đúng tập
- **Data required**: `petitions.all_status.D0`

#### TC-PET-061 — docType 6 template partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop {PHIEU_DE_XUAT, PHIEU_CHUYEN_NGUON_TIN, PHIEU_CHUYEN_DON, THONG_BAO_CHUYEN, THONG_BAO_HUONG_DAN, THONG_BAO_TRA_LAI}
- **Expected**: 6 lần 200, mỗi template render đúng
- **Data required**: `petition.with_business_content.D7`

#### TC-PET-062 — priority partition (HIGH/MEDIUM/LOW)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: DB có petitions priority khác
- **Steps**:
  Loop priority filter
- **Expected**: Mỗi value trả đúng
- **Data required**: `petitions.shape.normal.D0`

#### TC-PET-063 — baoCaoBanGiamDoc boolean partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST baoCaoBanGiamDoc=true rồi =false
- **Expected**: 2 lần 201
- **Data required**: `account.officer.primary`

#### TC-PET-064 — senderEmail partition (valid/invalid)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  4 case: 'a@b.com', 'a+tag@b.co.uk', 'no-at', ''
- **Expected**: 2 valid 201, 1 invalid 400, 1 empty 201
- **Data required**: `account.officer.primary`

#### TC-PET-065 — Filter unlinked (no linkedCaseId AND no linkedIncidentId)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/petitions/linkable`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /linkable
- **Expected**: Items không có linkedCaseId/linkedIncidentId
- **Data required**: `petitions.mixed_link.D0`

#### TC-PET-066 — Sort partition (asc/desc × stt/receivedDate/createdAt)
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 combo
- **Expected**: 6 lần 200, order đúng
- **Data required**: `petitions.shape.normal.D0`

#### TC-PET-067 — Assign reassign partition
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PATCH /api/v1/petitions/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  3 case: unassigned→officer1, officer1→officer2, officer2→null
- **Expected**: 3 lần 200
- **Data required**: `petition.unassigned.D0, account.officer.primary, account.officer.secondary, account.admin.primary`

### EDGE (1 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-058** | P2 | Low | receivedDate = today (boundary not future) | `POST /api/v1/petitions` | OFFICER |

#### TC-PET-058 — receivedDate = today (boundary not future)
- **Type/Priority/Severity**: EDGE / P2 / Low
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST receivedDate={{today}}
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

### STATE (5 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-078** | P0 | Critical | State: MOI_TIEP_NHAN → DANG_XU_LY | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-091** | P0 | Critical | DANG_XU_LY → CHO_PHE_DUYET | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-092** | P0 | Critical | CHO_PHE_DUYET → DA_LUU_DON | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-093** | P0 | Critical | DANG_XU_LY → DA_GIAI_QUYET | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-094** | P0 | High | Invalid: DA_GIAI_QUYET → MOI_TIEP_NHAN → 400 | `PUT /api/v1/petitions/:id` | OFFICER |

#### TC-PET-078 — State: MOI_TIEP_NHAN → DANG_XU_LY
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT status=DANG_XU_LY
- **Expected**: HTTP 200
- **Data required**: `petition.moi_tiep_nhan.D0`

#### TC-PET-091 — DANG_XU_LY → CHO_PHE_DUYET
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT status=CHO_PHE_DUYET
- **Expected**: HTTP 200
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-092 — CHO_PHE_DUYET → DA_LUU_DON
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT status=DA_LUU_DON
- **Expected**: HTTP 200
- **Data required**: `petition.cho_phe_duyet.D14`

#### TC-PET-093 — DANG_XU_LY → DA_GIAI_QUYET
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT status=DA_GIAI_QUYET
- **Expected**: HTTP 200
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-094 — Invalid: DA_GIAI_QUYET → MOI_TIEP_NHAN → 400
- **Type/Priority/Severity**: STATE / P0 / High
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT
- **Expected**: HTTP 400
- **Data required**: `petition.giai_quyet.D30`

### DECISION (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-095** | P0 | Critical | Decision matrix convert: status × loaiDon | `POST /api/v1/petitions/:id/convert-incident` | OFFICER |
| **TC-PET-096** | P0 | High | Decision matrix docType × required fields | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-097** | P1 | Medium | Decision matrix stt auto-gen vs manual | `POST /api/v1/petitions` | OFFICER |

#### TC-PET-095 — Decision matrix convert: status × loaiDon
- **Type/Priority/Severity**: DECISION / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions/:id/convert-incident`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  4 status × 4 LoaiDon (16 cell)
- **Expected**: Chỉ MOI_TIEP_NHAN/DANG_XU_LY/CHO_PHE_DUYET → success
- **Data required**: `petition.moi_tiep_nhan.D0, petition.dang_xu_ly.D7, petition.cho_phe_duyet.D14, petition.luu_don.D30`

#### TC-PET-096 — Decision matrix docType × required fields
- **Type/Priority/Severity**: DECISION / P0 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 docType × (full fields vs missing nhanThay)
- **Expected**: Mỗi docType có required fields riêng — verify error message rõ
- **Data required**: `petition.with_business_content.D7, petition.minimal.D0`

#### TC-PET-097 — Decision matrix stt auto-gen vs manual
- **Type/Priority/Severity**: DECISION / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  2 case: (stt blank → engine gen), (stt manual → use manual)
- **Expected**: Case 1: stt='DT-2026-{seq}'; Case 2: stt giữ value manual
- **Data required**: `account.officer.primary`

### SECURITY (12 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-079** | P0 | Critical | XSS senderName — stripHtmlTags sanitize | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-080** | P0 | Critical | XSS summary — stripHtmlTags | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-081** | P0 | Critical | SQL Injection senderName | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-082** | P0 | Critical | IDOR — petition team khác → 403/404 | `GET /api/v1/petitions/:id` | OFFICER |
| **TC-PET-083** | P0 | Critical | Mass assignment — createdAt/deletedAt → 400 | `PUT /api/v1/petitions/:id` | OFFICER |
| **TC-PET-084** | P1 | High | JWT signature tamper → 401 | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-085** | P0 | High | Throttle 5/60s | `GET /api/v1/petitions/export` | OFFICER |
| **TC-PET-086** | P0 | Critical | Audit log integrity | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-087** | P0 | Critical | Document render log — verify DocumentRenderLog created | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-088** | P1 | High | Batch export không leak data ngoài scope | `POST /api/v1/petitions/export-document-batch` | OFFICER |
| **TC-PET-089** | P1 | High | OFFICER list deleted → 403, không leak count | `GET /api/v1/petitions/admin/deleted` | OFFICER |
| **TC-PET-090** | P1 | High | Stripped HTML không bypass qua entity reference | `POST /api/v1/petitions` | OFFICER |

#### TC-PET-079 — XSS senderName — stripHtmlTags sanitize
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderName='<script>alert(1)</script>Nguyễn'
- **Expected**: HTTP 201, senderName lưu 'Nguyễn' (HTML đã strip)
- **Data required**: `account.officer.primary`

#### TC-PET-080 — XSS summary — stripHtmlTags
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST summary='<img src=x onerror=alert(1)>Nội dung'
- **Expected**: HTTP 201, summary lưu 'Nội dung'
- **Data required**: `account.officer.primary`

#### TC-PET-081 — SQL Injection senderName
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderName="' OR 1=1; --"
- **Expected**: HTTP 201, lưu literal
- **Data required**: `account.officer.primary`

#### TC-PET-082 — IDOR — petition team khác → 403/404
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET other team petition
- **Expected**: HTTP 403/404
- **Data required**: `petition.other_team.D0, account.officer.primary`

#### TC-PET-083 — Mass assignment — createdAt/deletedAt → 400
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `PUT /api/v1/petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {createdAt:'2020-01-01', deletedAt:null}
- **Expected**: HTTP 400 hoặc strip
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-084 — JWT signature tamper → 401
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET với JWT sửa role=ADMIN
- **Expected**: HTTP 401

#### TC-PET-085 — Throttle 5/60s
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `GET /api/v1/petitions/export`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  6 GET trong 60s
- **Expected**: 6th → 429
- **Data required**: `account.officer.primary`

#### TC-PET-086 — Audit log integrity
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST + check audit
- **Expected**: audit có userId, ipAddress, userAgent
- **Data required**: `account.officer.primary`

#### TC-PET-087 — Document render log — verify DocumentRenderLog created
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET export-document
- **Expected**: DocumentRenderLog entry có petitionId, docType, userId
- **Data required**: `petition.with_business_content.D7`

#### TC-PET-088 — Batch export không leak data ngoài scope
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: Mix petitionIds team A + team B
- **Steps**:
  POST với officer.primary (team A)
- **Expected**: HTTP 200, ZIP chỉ chứa file của team A; manifest.skipped[] cho team B
- **Data required**: `petition.dang_xu_ly.D7, petition.other_team.D0`

#### TC-PET-089 — OFFICER list deleted → 403, không leak count
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/petitions/admin/deleted`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: HTTP 403, không thông tin số petitions deleted
- **Data required**: `account.officer.primary`

#### TC-PET-090 — Stripped HTML không bypass qua entity reference
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST summary='&lt;script&gt;alert(1)&lt;/script&gt;'
- **Expected**: HTTP 201, render UI escape, không execute
- **Data required**: `account.officer.primary`

### DATA (2 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-098** | P1 | High | Unicode tiếng Việt — senderName + summary | `POST /api/v1/petitions` | OFFICER |
| **TC-PET-099** | P1 | Medium | senderEmail i18n (unicode local part) | `POST /api/v1/petitions` | OFFICER |

#### TC-PET-098 — Unicode tiếng Việt — senderName + summary
- **Type/Priority/Severity**: DATA / P1 / High
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderName='Nguyễn Văn Đệ' summary='Tố cáo trộm cắp tài sản tại Đà Nẵng'
- **Expected**: HTTP 201, GET trả lại đúng dấu
- **Data required**: `account.officer.primary`

#### TC-PET-099 — senderEmail i18n (unicode local part)
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST senderEmail='đỗ.thị@example.com'
- **Expected**: HTTP 201 hoặc 400 (validator chuẩn IsEmail có hỗ trợ unicode)
- **Data required**: `account.officer.primary`

### A11Y (6 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-106** | P1 | Medium | List page keyboard nav | `UI: /petitions` | OFFICER |
| **TC-PET-107** | P1 | Medium | Form aria-required + label cho senderName, receivedDate, petitionType | `UI: /petitions/new` | OFFICER |
| **TC-PET-108** | P1 | Medium | Status badge contrast 7 status WCAG AA | `UI: /petitions` | OFFICER |
| **TC-PET-109** | P2 | Low | Detail H1 + heading hierarchy | `UI: /petitions/:id` | OFFICER |
| **TC-PET-110** | P1 | Medium | Email input type=email | `UI: /petitions/new` | OFFICER |
| **TC-PET-111** | P2 | Low | Table caption hoặc aria-label | `UI: /petitions` | OFFICER |

#### TC-PET-106 — List page keyboard nav
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Tab qua filter chips, table, pagination
- **Expected**: Focus visible mọi element
- **Data required**: `account.officer.primary`

#### TC-PET-107 — Form aria-required + label cho senderName, receivedDate, petitionType
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /petitions/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect
- **Expected**: 3 required field có aria-required=true + <label>
- **Data required**: `account.officer.primary`

#### TC-PET-108 — Status badge contrast 7 status WCAG AA
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Render + measure
- **Expected**: 7 pair ≥4.5:1
- **Data required**: `petitions.all_status.D0`

#### TC-PET-109 — Detail H1 + heading hierarchy
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /petitions/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect
- **Expected**: 1 h1, no skip level
- **Data required**: `petition.dang_xu_ly.D7`

#### TC-PET-110 — Email input type=email
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /petitions/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect senderEmail
- **Expected**: <input type='email'> để mobile keyboard show @
- **Data required**: `account.officer.primary`

#### TC-PET-111 — Table caption hoặc aria-label
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect <table>
- **Expected**: <caption>'Danh sách đơn thư'</caption> hoặc aria-label
- **Data required**: `petitions.shape.normal.D0`

### COMPAT (6 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-112** | P1 | Medium | Chromium desktop | `UI: /petitions` | OFFICER |
| **TC-PET-113** | P1 | Medium | Firefox desktop | `UI: /petitions` | OFFICER |
| **TC-PET-114** | P1 | Medium | WebKit desktop | `UI: /petitions` | OFFICER |
| **TC-PET-115** | P0 | High | Mobile 375 viewport | `UI: /petitions` | OFFICER |
| **TC-PET-116** | P1 | Medium | Tablet 768 viewport | `UI: /petitions` | OFFICER |
| **TC-PET-117** | P2 | Low | Dark mode | `UI: /petitions` | OFFICER |

#### TC-PET-112 — Chromium desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: OK
- **Data required**: `account.officer.primary`

#### TC-PET-113 — Firefox desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: OK
- **Data required**: `account.officer.primary`

#### TC-PET-114 — WebKit desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: Date picker OK
- **Data required**: `account.officer.primary`

#### TC-PET-115 — Mobile 375 viewport
- **Type/Priority/Severity**: COMPAT / P0 / High
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Set viewport
- **Expected**: Drawer + table scroll
- **Data required**: `account.officer.primary`

#### TC-PET-116 — Tablet 768 viewport
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Set viewport
- **Expected**: Layout adapt
- **Data required**: `account.officer.primary`

#### TC-PET-117 — Dark mode
- **Type/Priority/Severity**: COMPAT / P2 / Low
- **Endpoint**: `UI: /petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Toggle
- **Expected**: Dark theme
- **Data required**: `account.officer.primary`

### PERFORMANCE (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-PET-118** | P0 | High | List 10k đơn p95 < 800ms | `GET /api/v1/petitions` | OFFICER |
| **TC-PET-119** | P0 | High | Single docx render < 1.5s | `GET /api/v1/petitions/:id/export-document` | OFFICER |
| **TC-PET-120** | P0 | High | Batch 100 đơn → ZIP < 30s | `POST /api/v1/petitions/export-document-batch` | OFFICER |

#### TC-PET-118 — List 10k đơn p95 < 800ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/petitions`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  100 GET concurrent
- **Expected**: p95 < 800ms
- **Data required**: `petitions.shape.large.D0`

#### TC-PET-119 — Single docx render < 1.5s
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/petitions/:id/export-document`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET
- **Expected**: < 1.5s
- **Data required**: `petition.with_business_content.D7`

#### TC-PET-120 — Batch 100 đơn → ZIP < 30s
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `POST /api/v1/petitions/export-document-batch`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST 100 IDs
- **Expected**: < 30s, ZIP size hợp lý
- **Data required**: `petitions.shape.full.D0`
