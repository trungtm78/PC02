# UAT — UTDT

**Tổng TC**: 110/110 | **Mode**: LEAN | **Generated**: 2026-05-30

## Phân bố loại TC

| Loại | Số TC | Tỷ lệ |
|------|-------|-------|
| RED | 44 | 40.0% |
| GREEN | 14 | 12.7% |
| SECURITY | 11 | 10.0% |
| BOUNDARY | 8 | 7.3% |
| EP | 8 | 7.3% |
| A11Y | 6 | 5.5% |
| STATE | 5 | 4.5% |
| COMPAT | 5 | 4.5% |
| DECISION | 3 | 2.7% |
| PERFORMANCE | 3 | 2.7% |
| DATA | 2 | 1.8% |
| EDGE | 1 | 0.9% |

## Phân bố priority

| Priority | Số TC | Tỷ lệ |
|----------|-------|-------|
| P0 | 58 | 52.7% |
| P1 | 45 | 40.9% |
| P2 | 7 | 6.4% |

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
**Outputs**: `{"token": "$.accessToken", "teamId": "$.user.primaryTeamId"}`

### `account.officer.secondary`
**Ref**: `_shared/test-accounts.json#account.officer.secondary`
**Setup**: login officer2@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken", "teamId": "$.user.primaryTeamId"}`

### `account.admin.primary`
**Ref**: `_shared/test-accounts.json#account.admin.primary`
**Setup**: login admin@
**Cleanup**: -
**Outputs**: `{"token": "$.accessToken"}`

### `account.viewer.D0`
**Setup**: Admin seed user role VIEWER
**Cleanup**: Admin delete
**Outputs**: `{"token": "$.accessToken"}`

### `utdt.chua_phan_hoi.D30`
**Setup**: POST /api/v1/cases {caseType:'UY_THAC_DIEU_TRA', caseProvenance:'UY_THAC_DIEU_TRA', loaiUyThac:'UY_THAC_DIEU_TRA', donViGiao:'PC01', soQuyetDinhUyThac:'58/2026/{{random}}', ngayTiepNhan:{{D-30}}, thoiHanUyThac:{{D+30}}} — ketQua=null, lyDo=null, thoiHan tương lai → CHUA_PHAN_HOI
**Cleanup**: DELETE /api/v1/cases/{id}
**Outputs**: `{"case_id": "$.id"}`

### `utdt.chua_phan_hoi.expiring.D0`
**Setup**: UTDT với thoiHanUyThac sắp hết (1 phút nữa) — dùng test transition tự động
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.da_phan_hoi.D60`
**Setup**: UTDT có ketQuaUyThac='Đã điều tra xong' + ngayTraKetQua={{D-1}} → DA_PHAN_HOI
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.khong_thuc_hien.D30`
**Setup**: UTDT có metadata.lyDoKhongThucHienDuoc='Đối tượng đã chết'
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.qua_han.D90`
**Setup**: UTDT có thoiHanUyThac={{D-30}} (đã quá hạn) + ketQua=null + lyDo=null
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.all_state.D0`
**Setup**: Seed 4 UTDT — mỗi state 1 cái
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.donvi_pc01.D0`
**Setup**: Seed 5 UTDT với donViGiao='PC01 Hà Nội'
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.donvi_pc02.D0`
**Setup**: Seed 5 UTDT với donViGiao='PC02 TP HCM'
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.other_team.D0`
**Setup**: UTDT thuộc team B (officer.secondary)
**Cleanup**: DELETE bằng officer.secondary
**Outputs**: `{"case_id": "$.id"}`

### `utdt.creator_owned.D0`
**Setup**: UTDT tạo bằng officer.primary
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.unassigned.D0`
**Setup**: UTDT chưa assign investigator
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.deleted.D7`
**Setup**: UTDT → DELETE → set deletedAt D-7
**Cleanup**: Prisma hard delete
**Outputs**: `{"case_id": "$.id"}`

### `utdt.recently_edited.D0`
**Setup**: UTDT vừa edited bằng admin2
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id", "stale_at": "$.oldAt"}`

### `utdt.with_events.D60`
**Setup**: UTDT có ≥5 events
**Cleanup**: DELETE
**Outputs**: `{"case_id": "$.id"}`

### `utdt.cross_team.D0`
**Setup**: Seed 4 UTDT — 2 team A, 2 team B
**Cleanup**: DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.shape.normal.D0`
**Setup**: Seed 20 UTDT mix state + loaiUyThac
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.shape.full.D0`
**Setup**: Seed 100 UTDT
**Cleanup**: Loop DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `utdt.shape.large.D0`
**Setup**: Prisma raw insert 5000 UTDT
**Cleanup**: Prisma raw DELETE WHERE caseType='UY_THAC_DIEU_TRA' AND name LIKE 'UAT-PERF-UTDT-%'
**Outputs**: `{"count": "5000"}`

### `cases.mixed_type.D0`
**Setup**: Seed 30 cases — 15 REGULAR + 15 UTDT
**Cleanup**: DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

### `cases.no_utdt.D0`
**Setup**: DB chỉ REGULAR, không UTDT
**Cleanup**: -

### `cases.regular.D0`
**Setup**: Seed 10 REGULAR cases
**Cleanup**: DELETE
**Outputs**: `{"case_ids": "$[*].id"}`

## Test Cases

### GREEN (14 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-001** | P0 | Critical | Tạo UTDT đầy đủ (caseType + loaiUyThac + donViGiao + ngày) | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-002** | P0 | Critical | Tạo UTDT loaiUyThac=CHUYEN_DON_NGUON_TIN | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-003** | P0 | High | Tạo UTDT loaiUyThac=UY_THAC_GIAI_QUYET | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-004** | P0 | Critical | List UTDT cases (caseType filter explicit) | `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA` | OFFICER |
| **TC-UTDT-005** | P0 | Critical | List default exclude UTDT (caseType=REGULAR implicit) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-006** | P0 | Critical | UTDT stats 4 TrangThaiPhanHoi | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-007** | P0 | Critical | Update ketQuaUyThac + ngayTraKetQua → state DA_PHAN_HOI | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-008** | P0 | High | Update metadata.lyDoKhongThucHienDuoc → state KHONG_THUC_HIEN_DUOC | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-009** | P0 | High | Filter UTDT DA_PHAN_HOI | `GET /api/v1/cases?trangThaiPhanHoi=DA_PHAN_HOI` | OFFICER |
| **TC-UTDT-010** | P0 | High | Filter UTDT QUA_HAN | `GET /api/v1/cases?trangThaiPhanHoi=QUA_HAN` | OFFICER |
| **TC-UTDT-011** | P0 | High | Filter UTDT theo donViGiao (substring) | `GET /api/v1/cases?donViGiao=PC01` | OFFICER |
| **TC-UTDT-012** | P1 | Medium | Filter UTDT date range | `GET /api/v1/cases?ngayTiepNhanFrom=…&ngayTiepNhanTo=…` | OFFICER |
| **TC-UTDT-013** | P1 | Medium | Filter UTDT theo tên ĐTV | `GET /api/v1/cases?investigatorName=…` | OFFICER |
| **TC-UTDT-014** | P0 | Critical | Xem chi tiết UTDT — đủ field | `GET /api/v1/cases/:id` | OFFICER |

#### TC-UTDT-001 — Tạo UTDT đầy đủ (caseType + loaiUyThac + donViGiao + ngày)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {name:'UTDT-{{random}}', caseProvenance:'UY_THAC_DIEU_TRA', caseType:'UY_THAC_DIEU_TRA', loaiUyThac:'UY_THAC_DIEU_TRA', donViGiao:'PC01 Hà Nội', soQuyetDinhUyThac:'58/2026/UTDT', ngayTiepNhan:'2026-05-30', thoiHanUyThac:'2026-08-30', loaiThongTin:'Tố giác'}
- **Expected**: HTTP 201, id≠null, computed TrangThaiPhanHoi=CHUA_PHAN_HOI
- **Data required**: `account.officer.primary`

#### TC-UTDT-002 — Tạo UTDT loaiUyThac=CHUYEN_DON_NGUON_TIN
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseType:'UY_THAC_DIEU_TRA', loaiUyThac:'CHUYEN_DON_NGUON_TIN', ...}
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-003 — Tạo UTDT loaiUyThac=UY_THAC_GIAI_QUYET
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST loaiUyThac=UY_THAC_GIAI_QUYET
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-004 — List UTDT cases (caseType filter explicit)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA`
- **Role**: OFFICER
- **Pre**: DB có UTDT
- **Steps**:
  GET ?caseType=UY_THAC_DIEU_TRA
- **Expected**: HTTP 200, items chỉ UTDT
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-005 — List default exclude UTDT (caseType=REGULAR implicit)
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB mix REGULAR + UTDT
- **Steps**:
  GET /api/v1/cases (không caseType)
- **Expected**: HTTP 200, items không có UTDT
- **Data required**: `cases.mixed_type.D0`

#### TC-UTDT-006 — UTDT stats 4 TrangThaiPhanHoi
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: DB có UTDT ở 4 state
- **Steps**:
  GET /utdt-stats
- **Expected**: HTTP 200, byTrangThai = {DA_PHAN_HOI, KHONG_THUC_HIEN_DUOC, QUA_HAN, CHUA_PHAN_HOI}
- **Data required**: `utdt.all_state.D0`

#### TC-UTDT-007 — Update ketQuaUyThac + ngayTraKetQua → state DA_PHAN_HOI
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT chưa có ketQua
- **Steps**:
  PUT {ketQuaUyThac:'Đã điều tra xong', ngayTraKetQua:'2026-07-15'}
- **Expected**: HTTP 200, computed state=DA_PHAN_HOI
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-008 — Update metadata.lyDoKhongThucHienDuoc → state KHONG_THUC_HIEN_DUOC
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {metadata:{lyDoKhongThucHienDuoc:'Đối tượng đã chuyển nơi cư trú'}}
- **Expected**: HTTP 200, computed state=KHONG_THUC_HIEN_DUOC
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-009 — Filter UTDT DA_PHAN_HOI
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/cases?trangThaiPhanHoi=DA_PHAN_HOI`
- **Role**: OFFICER
- **Pre**: DB có UTDT đã phản hồi
- **Steps**:
  GET ?caseType=UY_THAC_DIEU_TRA&trangThaiPhanHoi=DA_PHAN_HOI
- **Expected**: HTTP 200, items đều thỏa ketQua≠null AND ngayTra≠null
- **Data required**: `utdt.da_phan_hoi.D60`

#### TC-UTDT-010 — Filter UTDT QUA_HAN
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/cases?trangThaiPhanHoi=QUA_HAN`
- **Role**: OFFICER
- **Pre**: DB có UTDT quá hạn
- **Steps**:
  GET ?trangThaiPhanHoi=QUA_HAN
- **Expected**: HTTP 200, items đều thoiHanUyThac<now + ketQua=null
- **Data required**: `utdt.qua_han.D90`

#### TC-UTDT-011 — Filter UTDT theo donViGiao (substring)
- **Type/Priority/Severity**: GREEN / P0 / High
- **Endpoint**: `GET /api/v1/cases?donViGiao=PC01`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=UY_THAC_DIEU_TRA&donViGiao=PC01
- **Expected**: HTTP 200, items.donViGiao chứa 'PC01' (case-insensitive)
- **Data required**: `utdt.donvi_pc01.D0`

#### TC-UTDT-012 — Filter UTDT date range
- **Type/Priority/Severity**: GREEN / P1 / Medium
- **Endpoint**: `GET /api/v1/cases?ngayTiepNhanFrom=…&ngayTiepNhanTo=…`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?ngayTiepNhanFrom=2026-01-01&ngayTiepNhanTo=2026-06-30
- **Expected**: HTTP 200, items.ngayTiepNhan trong khoảng
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-013 — Filter UTDT theo tên ĐTV
- **Type/Priority/Severity**: GREEN / P1 / Medium
- **Endpoint**: `GET /api/v1/cases?investigatorName=…`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?investigatorName=Nguyễn
- **Expected**: HTTP 200, items investigator name match
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-014 — Xem chi tiết UTDT — đủ field
- **Type/Priority/Severity**: GREEN / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /api/v1/cases/{{utdt_id}}
- **Expected**: HTTP 200, response có đủ donViGiao, soQuyetDinhUyThac, loaiUyThac, ngày…, computed trangThaiPhanHoi
- **Data required**: `utdt.chua_phan_hoi.D30`

### RED (44 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-015** | P0 | Critical | caseType=UY_THAC_DIEU_TRA nhưng caseProvenance khác → 400 hoặc bị reject | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-016** | P0 | High | loaiUyThac ngoài enum → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-017** | P0 | High | donViGiao vượt 500 ký tự → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-018** | P0 | High | soQuyetDinhUyThac vượt 100 ký tự → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-019** | P0 | High | ngayTiepNhan sai format → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-020** | P0 | High | thoiHanUyThac sai format → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-021** | P0 | High | loaiThongTin vượt 200 ký tự → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-022** | P0 | Critical | Query caseType ngoài enum → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-023** | P0 | High | trangThaiPhanHoi ngoài 4 value → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-024** | P0 | High | utdt-stats không scope → 403 | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-025** | P0 | Critical | UTDT thiếu caseProvenance → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-026** | P0 | High | Update UTDT không thuộc scope → 403/404 | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-027** | P1 | High | PUT đổi caseType từ UTDT → REGULAR → 400 (immutable) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-028** | P1 | Medium | PUT ketQuaUyThac chỉ có ngayTraKetQua không có ketQua → state vẫn CHUA | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-029** | P1 | Medium | UTDT search > 200 chars → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-030** | P0 | High | UTDT với ngayTiepNhan tương lai → 400 hoặc warning | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-031** | P0 | Critical | utdt-stats không phải UTDT scope leak Regular case → fail | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-032** | P0 | High | UTDT với thoiHanUyThac < ngayTiepNhan → 400/warning | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-033** | P0 | High | trangThaiPhanHoi=QUA_HAN nhưng thiếu caseType=UY_THAC_DIEU_TRA → 200 nhưng items khác kỳ vọng | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-034** | P0 | High | UTDT với soQuyetDinhUyThac trùng (Mẫu 58 conflict) → 409 nếu unique | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-035** | P1 | High | PUT UTDT đã DA_PHAN_HOI — đổi ngayTraKetQua = null → state đổi | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-036** | P1 | Medium | loaiUyThac filter ngoài enum → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-037** | P1 | Medium | ngayTiepNhanFrom sai format → 400 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-038** | P1 | Medium | ngayTiepNhanFrom > ngayTiepNhanTo → 200 empty | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-039** | P0 | High | UTDT thiếu donViGiao → 201 (optional) hoặc 400 nếu rule | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-040** | P0 | Critical | DELETE UTDT (kế thừa case delete rules) — DA_PHAN_HOI thì cấm xóa hoặc cho phép | `DELETE /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-041** | P0 | High | utdt-stats với scope filter (donViGiao) → counts đúng theo filter | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-042** | P1 | Medium | PUT metadata.lyDoKhongThucHienDuoc='' (empty) → state vẫn CHUA | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-068** | P0 | Critical | UTDT XSS donViGiao | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-069** | P0 | High | SQL injection trong donViGiao filter | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-070** | P0 | High | UTDT metadata.lyDoKhongThucHienDuoc — JSON injection | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-071** | P1 | Medium | investigatorName injection — '%' wildcard | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-072** | P1 | Medium | PUT UTDT ngayTraKetQua = future date | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-073** | P1 | High | utdt-stats với scope filter wardId → counts đúng cho ward | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-074** | P0 | High | UTDT empty DB → stats 0/0/0/0 | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-075** | P0 | High | UTDT scope strict — officer team A không thấy UTDT team B | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-076** | P0 | Critical | VIEWER không write/Case → 403 | `POST /api/v1/cases` | VIEWER |
| **TC-UTDT-077** | P0 | High | PUT UTDT đã deleted → 410/404 | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-091** | P1 | Medium | PUT UTDT thay đổi loaiUyThac giữa chừng | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-092** | P1 | High | UTDT export/ward — verify chỉ UTDT trong ward | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-093** | P1 | High | PUT UTDT với expectedUpdatedAt stale → 409 | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-094** | P0 | High | Journey UTDT — events specific (assign, update ketQua, status change) | `GET /api/v1/cases/:id/journey` | OFFICER |
| **TC-UTDT-095** | P1 | Medium | DELETE UTDT với reason hợp lệ | `DELETE /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-096** | P1 | Medium | Restore UTDT đã xóa mềm | `POST /api/v1/cases/:id/restore` | ADMIN |

#### TC-UTDT-015 — caseType=UY_THAC_DIEU_TRA nhưng caseProvenance khác → 400 hoặc bị reject
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseType:'UY_THAC_DIEU_TRA', caseProvenance:'DIRECT_DISCOVERY'}
- **Expected**: HTTP 400 nếu service enforce match, hoặc 201 với mismatch warning
- **Data required**: `account.officer.primary`

#### TC-UTDT-016 — loaiUyThac ngoài enum → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseType:'UY_THAC_DIEU_TRA', loaiUyThac:'INVALID'}
- **Expected**: HTTP 400, IsEnum LoaiUyThac fail
- **Data required**: `account.officer.primary`

#### TC-UTDT-017 — donViGiao vượt 500 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST donViGiao length=501
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-018 — soQuyetDinhUyThac vượt 100 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST soQuyetDinhUyThac length=101
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-019 — ngayTiepNhan sai format → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST ngayTiepNhan='30/05/2026'
- **Expected**: HTTP 400, IsDateString
- **Data required**: `account.officer.primary`

#### TC-UTDT-020 — thoiHanUyThac sai format → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST thoiHanUyThac='soon'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-021 — loaiThongTin vượt 200 ký tự → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST loaiThongTin length=201
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-022 — Query caseType ngoài enum → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=INVALID
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-023 — trangThaiPhanHoi ngoài 4 value → 400
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?trangThaiPhanHoi=NEW_STATE
- **Expected**: HTTP 400, IsIn 4 values
- **Data required**: `account.officer.primary`

#### TC-UTDT-024 — utdt-stats không scope → 403
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: User không có read/Case
- **Steps**:
  GET /utdt-stats
- **Expected**: HTTP 403
- **Data required**: `account.viewer.D0`

#### TC-UTDT-025 — UTDT thiếu caseProvenance → 400
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseType:'UY_THAC_DIEU_TRA'} không caseProvenance
- **Expected**: HTTP 400, caseProvenance bắt buộc
- **Data required**: `account.officer.primary`

#### TC-UTDT-026 — Update UTDT không thuộc scope → 403/404
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT other team UTDT
- **Expected**: HTTP 403/404
- **Data required**: `utdt.other_team.D0`

#### TC-UTDT-027 — PUT đổi caseType từ UTDT → REGULAR → 400 (immutable)
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {caseType:'REGULAR'}
- **Expected**: HTTP 400 hoặc strip
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-028 — PUT ketQuaUyThac chỉ có ngayTraKetQua không có ketQua → state vẫn CHUA
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT chưa phản hồi
- **Steps**:
  PUT {ngayTraKetQua:'2026-07-15'} không ketQuaUyThac
- **Expected**: HTTP 200, computed vẫn CHUA_PHAN_HOI (cần cả 2 mới DA_PHAN_HOI)
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-029 — UTDT search > 200 chars → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?search=<201>&caseType=UY_THAC_DIEU_TRA
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-030 — UTDT với ngayTiepNhan tương lai → 400 hoặc warning
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST ngayTiepNhan='2027-01-01'
- **Expected**: HTTP 201 (validator chỉ ISO) hoặc 400 nếu rule
- **Data required**: `account.officer.primary`

#### TC-UTDT-031 — utdt-stats không phải UTDT scope leak Regular case → fail
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Verify response only counts UTDT cases
- **Expected**: byTrangThai counts đều ≤ tổng UTDT cases, không lẫn Regular
- **Data required**: `cases.mixed_type.D0`

#### TC-UTDT-032 — UTDT với thoiHanUyThac < ngayTiepNhan → 400/warning
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {ngayTiepNhan:'2026-05-30', thoiHanUyThac:'2026-05-01'}
- **Expected**: HTTP 400 nếu rule, hoặc 201 với log
- **Data required**: `account.officer.primary`

#### TC-UTDT-033 — trangThaiPhanHoi=QUA_HAN nhưng thiếu caseType=UY_THAC_DIEU_TRA → 200 nhưng items khác kỳ vọng
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?trangThaiPhanHoi=QUA_HAN không caseType
- **Expected**: HTTP 200 — filter apply trên REGULAR (default) → có thể empty
- **Data required**: `utdt.qua_han.D90`

#### TC-UTDT-034 — UTDT với soQuyetDinhUyThac trùng (Mẫu 58 conflict) → 409 nếu unique
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST 2 lần cùng soQuyetDinhUyThac
- **Expected**: HTTP 409 nếu unique constraint, hoặc 201 cả 2 nếu chỉ là string
- **Data required**: `account.officer.primary`

#### TC-UTDT-035 — PUT UTDT đã DA_PHAN_HOI — đổi ngayTraKetQua = null → state đổi
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT DA_PHAN_HOI
- **Steps**:
  PUT {ngayTraKetQua:null}
- **Expected**: HTTP 200, computed state ngược về CHUA_PHAN_HOI
- **Data required**: `utdt.da_phan_hoi.D60`

#### TC-UTDT-036 — loaiUyThac filter ngoài enum → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?loaiUyThac=INVALID
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-037 — ngayTiepNhanFrom sai format → 400
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?ngayTiepNhanFrom='hôm qua'
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-038 — ngayTiepNhanFrom > ngayTiepNhanTo → 200 empty
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET fromDate > toDate
- **Expected**: HTTP 200, items=[]
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-039 — UTDT thiếu donViGiao → 201 (optional) hoặc 400 nếu rule
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST không donViGiao
- **Expected**: HTTP 201 (vì optional theo DTO)
- **Data required**: `account.officer.primary`

#### TC-UTDT-040 — DELETE UTDT (kế thừa case delete rules) — DA_PHAN_HOI thì cấm xóa hoặc cho phép
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE UTDT DA_PHAN_HOI
- **Expected**: Verify rule: cho phép soft-delete với reason
- **Data required**: `utdt.da_phan_hoi.D60`

#### TC-UTDT-041 — utdt-stats với scope filter (donViGiao) → counts đúng theo filter
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /utdt-stats?donViGiao=PC01
- **Expected**: HTTP 200, byTrangThai chỉ tính UTDT có donViGiao=PC01
- **Data required**: `utdt.donvi_pc01.D0, utdt.donvi_pc02.D0`

#### TC-UTDT-042 — PUT metadata.lyDoKhongThucHienDuoc='' (empty) → state vẫn CHUA
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {metadata:{lyDoKhongThucHienDuoc:''}}
- **Expected**: HTTP 200, computed CHUA_PHAN_HOI (empty không count)
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-068 — UTDT XSS donViGiao
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST donViGiao='<script>alert(1)</script>PC01'
- **Expected**: HTTP 201, lưu literal, render UI escape
- **Data required**: `account.officer.primary`

#### TC-UTDT-069 — SQL injection trong donViGiao filter
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?donViGiao=' OR 1=1; --
- **Expected**: HTTP 200, ILIKE param safe, không trả tất cả
- **Data required**: `account.officer.primary`

#### TC-UTDT-070 — UTDT metadata.lyDoKhongThucHienDuoc — JSON injection
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {metadata:{lyDoKhongThucHienDuoc:{nested:{}}}}
- **Expected**: HTTP 201 (Prisma JSONB lưu raw), computed state KHONG_THUC_HIEN_DUOC (vì path['lyDoKhongThucHienDuoc'] not Prisma.JsonNull)
- **Data required**: `account.officer.primary`

#### TC-UTDT-071 — investigatorName injection — '%' wildcard
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?investigatorName=%
- **Expected**: HTTP 200, không leak tất cả (ILIKE escape %)
- **Data required**: `account.officer.primary`

#### TC-UTDT-072 — PUT UTDT ngayTraKetQua = future date
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT ngayTraKetQua='2030-01-01'
- **Expected**: HTTP 200 (DTO chỉ ISO check) — có thể warning business
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-073 — utdt-stats với scope filter wardId → counts đúng cho ward
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /utdt-stats?wardId={{ward}}
- **Expected**: counts chỉ tính UTDT trong ward
- **Data required**: `utdt.shape.full.D0`

#### TC-UTDT-074 — UTDT empty DB → stats 0/0/0/0
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB không có UTDT
- **Steps**:
  GET /utdt-stats
- **Expected**: HTTP 200, byTrangThai = {DA_PHAN_HOI:0, KHONG_THUC_HIEN_DUOC:0, QUA_HAN:0, CHUA_PHAN_HOI:0}
- **Data required**: `cases.no_utdt.D0`

#### TC-UTDT-075 — UTDT scope strict — officer team A không thấy UTDT team B
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=UY_THAC_DIEU_TRA
- **Expected**: HTTP 200, items chỉ team A
- **Data required**: `utdt.other_team.D0, account.officer.primary`

#### TC-UTDT-076 — VIEWER không write/Case → 403
- **Type/Priority/Severity**: RED / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: VIEWER
- **Pre**: -
- **Steps**:
  POST UTDT với VIEWER
- **Expected**: HTTP 403
- **Data required**: `account.viewer.D0`

#### TC-UTDT-077 — PUT UTDT đã deleted → 410/404
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT
- **Expected**: HTTP 410/404
- **Data required**: `utdt.deleted.D7`

#### TC-UTDT-091 — PUT UTDT thay đổi loaiUyThac giữa chừng
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT đang xử lý
- **Steps**:
  PUT loaiUyThac từ UY_THAC_DIEU_TRA → CHUYEN_DON_NGUON_TIN
- **Expected**: HTTP 200 (allowed) hoặc 400 nếu rule immutable
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-092 — UTDT export/ward — verify chỉ UTDT trong ward
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /export/ward với UTDT data
- **Expected**: Excel chỉ chứa UTDT cases theo ward
- **Data required**: `utdt.shape.full.D0`

#### TC-UTDT-093 — PUT UTDT với expectedUpdatedAt stale → 409
- **Type/Priority/Severity**: RED / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT stale optimistic lock
- **Expected**: HTTP 409
- **Data required**: `utdt.recently_edited.D0`

#### TC-UTDT-094 — Journey UTDT — events specific (assign, update ketQua, status change)
- **Type/Priority/Severity**: RED / P0 / High
- **Endpoint**: `GET /api/v1/cases/:id/journey`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /journey UTDT
- **Expected**: HTTP 200, events có UTDT-specific (ketQua change, lyDoKhongThucHienDuoc set)
- **Data required**: `utdt.with_events.D60`

#### TC-UTDT-095 — DELETE UTDT với reason hợp lệ
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `DELETE /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  DELETE body {reason:'UTDT bị thu hồi bởi đơn vị giao'}
- **Expected**: HTTP 200
- **Data required**: `utdt.creator_owned.D0`

#### TC-UTDT-096 — Restore UTDT đã xóa mềm
- **Type/Priority/Severity**: RED / P1 / Medium
- **Endpoint**: `POST /api/v1/cases/:id/restore`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  POST /restore reason='Khôi phục theo yêu cầu PC01'
- **Expected**: HTTP 200, deletedAt=null
- **Data required**: `utdt.deleted.D7, account.admin.primary`

### BOUNDARY (8 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-043** | P1 | High | donViGiao = 500 ký tự (max) → 201 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-044** | P1 | High | donViGiao = 501 → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-045** | P1 | Medium | soQuyetDinhUyThac = 100 ký tự (max) | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-046** | P1 | Medium | soQuyetDinhUyThac = 101 → 400 | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-047** | P1 | Medium | loaiThongTin = 200 ký tự (max) | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-048** | P0 | Critical | thoiHanUyThac = now exactly — state QUA_HAN không trigger (≤) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-049** | P0 | Critical | thoiHanUyThac = now-1ms — state QUA_HAN trigger | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-050** | P1 | High | caseType filter empty string → 400 hoặc default | `GET /api/v1/cases` | OFFICER |

#### TC-UTDT-043 — donViGiao = 500 ký tự (max) → 201
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST donViGiao length=500
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-044 — donViGiao = 501 → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST donViGiao length=501
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-045 — soQuyetDinhUyThac = 100 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST length=100
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-046 — soQuyetDinhUyThac = 101 → 400
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST length=101
- **Expected**: HTTP 400
- **Data required**: `account.officer.primary`

#### TC-UTDT-047 — loaiThongTin = 200 ký tự (max)
- **Type/Priority/Severity**: BOUNDARY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST length=200
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-048 — thoiHanUyThac = now exactly — state QUA_HAN không trigger (≤)
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT thoiHanUyThac={{now}}
- **Expected**: HTTP 200, computed state CHUA_PHAN_HOI (vì < not ≤)
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-049 — thoiHanUyThac = now-1ms — state QUA_HAN trigger
- **Type/Priority/Severity**: BOUNDARY / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT thoiHanUyThac={{now-1ms}}
- **Expected**: HTTP 200, computed QUA_HAN
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-050 — caseType filter empty string → 400 hoặc default
- **Type/Priority/Severity**: BOUNDARY / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=
- **Expected**: HTTP 400 (IsEnum reject) hoặc 200 với default REGULAR
- **Data required**: `account.officer.primary`

### EP (8 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-052** | P1 | High | LoaiUyThac đủ 3 partition | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-053** | P1 | High | trangThaiPhanHoi đủ 4 partition | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-054** | P1 | Medium | caseType partition (REGULAR vs UY_THAC_DIEU_TRA) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-055** | P2 | Medium | donViGiao partition (PC01/PC02/CA Quận) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-056** | P2 | Medium | loaiThongTin partition (Tố giác / Trình báo / Đề nghị / Kiến nghị) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-057** | P2 | Low | sortBy partition (ngayTiepNhan/thoiHanUyThac/createdAt) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-058** | P1 | Medium | ketQuaUyThac partition (short / long / empty) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-059** | P2 | Low | investigatorName partition (full/partial/empty) | `GET /api/v1/cases` | OFFICER |

#### TC-UTDT-052 — LoaiUyThac đủ 3 partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop {UY_THAC_DIEU_TRA, CHUYEN_DON_NGUON_TIN, UY_THAC_GIAI_QUYET}
- **Expected**: 3 lần 201
- **Data required**: `account.officer.primary`

#### TC-UTDT-053 — trangThaiPhanHoi đủ 4 partition
- **Type/Priority/Severity**: EP / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: DB có UTDT đủ 4 state
- **Steps**:
  Loop 4 ?trangThaiPhanHoi
- **Expected**: Mỗi truy vấn trả đúng tập
- **Data required**: `utdt.all_state.D0`

#### TC-UTDT-054 — caseType partition (REGULAR vs UY_THAC_DIEU_TRA)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=REGULAR rồi UY_THAC_DIEU_TRA
- **Expected**: Items khác hẳn
- **Data required**: `cases.mixed_type.D0`

#### TC-UTDT-055 — donViGiao partition (PC01/PC02/CA Quận)
- **Type/Priority/Severity**: EP / P2 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 3 substring
- **Expected**: Mỗi value trả đúng
- **Data required**: `utdt.donvi_pc01.D0, utdt.donvi_pc02.D0`

#### TC-UTDT-056 — loaiThongTin partition (Tố giác / Trình báo / Đề nghị / Kiến nghị)
- **Type/Priority/Severity**: EP / P2 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Loop 4 strings
- **Expected**: Match
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-057 — sortBy partition (ngayTiepNhan/thoiHanUyThac/createdAt)
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  3 sortBy × 2 sortOrder
- **Expected**: 6 lần 200
- **Data required**: `utdt.shape.normal.D0`

#### TC-UTDT-058 — ketQuaUyThac partition (short / long / empty)
- **Type/Priority/Severity**: EP / P1 / Medium
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  3 case: 'OK', '<300 chars>', ''
- **Expected**: 3 lần 200
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-059 — investigatorName partition (full/partial/empty)
- **Type/Priority/Severity**: EP / P2 / Low
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  3 case
- **Expected**: Mỗi case trả đúng
- **Data required**: `utdt.shape.normal.D0`

### EDGE (1 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-051** | P2 | Medium | UTDT với loaiUyThac giống caseProvenance (cả 2 đều UY_THAC_DIEU_TRA) | `POST /api/v1/cases` | OFFICER |

#### TC-UTDT-051 — UTDT với loaiUyThac giống caseProvenance (cả 2 đều UY_THAC_DIEU_TRA)
- **Type/Priority/Severity**: EDGE / P2 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {caseProvenance:'UY_THAC_DIEU_TRA', loaiUyThac:'UY_THAC_DIEU_TRA'}
- **Expected**: HTTP 201 (cùng tên enum nhưng 2 enum khác nhau OK)
- **Data required**: `account.officer.primary`

### STATE (5 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-060** | P0 | Critical | Transition computed: CHUA_PHAN_HOI → DA_PHAN_HOI (set cả ketQua+ngayTra) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-061** | P0 | Critical | State CHUA → KHONG_THUC_HIEN_DUOC (set metadata.lyDoKhongThucHienDuoc) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-062** | P0 | Critical | State CHUA → QUA_HAN (auto khi thoiHanUyThac < now) | `Job: cron-based` | SYSTEM |
| **TC-UTDT-063** | P1 | High | State QUA_HAN → DA_PHAN_HOI (trả kết quả muộn) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-064** | P1 | High | State KHONG_THUC_HIEN_DUOC → DA_PHAN_HOI (gỡ lyDo + set ketQua) | `PUT /api/v1/cases/:id` | OFFICER |

#### TC-UTDT-060 — Transition computed: CHUA_PHAN_HOI → DA_PHAN_HOI (set cả ketQua+ngayTra)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT CHUA
- **Steps**:
  PUT đủ 2 field
- **Expected**: HTTP 200, computed DA_PHAN_HOI
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-061 — State CHUA → KHONG_THUC_HIEN_DUOC (set metadata.lyDoKhongThucHienDuoc)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT CHUA
- **Steps**:
  PUT metadata.lyDoKhongThucHienDuoc='Đối tượng chết'
- **Expected**: HTTP 200, computed KHONG_THUC_HIEN_DUOC
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-062 — State CHUA → QUA_HAN (auto khi thoiHanUyThac < now)
- **Type/Priority/Severity**: STATE / P0 / Critical
- **Endpoint**: `Job: cron-based`
- **Role**: SYSTEM
- **Pre**: UTDT CHUA, thoiHanUyThac sắp hết
- **Steps**:
  Wait until thoiHanUyThac < now (hoặc trigger cron)
- **Expected**: computed QUA_HAN (không cần update DB, là computed)
- **Data required**: `utdt.chua_phan_hoi.expiring.D0`

#### TC-UTDT-063 — State QUA_HAN → DA_PHAN_HOI (trả kết quả muộn)
- **Type/Priority/Severity**: STATE / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT QUA_HAN
- **Steps**:
  PUT {ketQuaUyThac, ngayTraKetQua}
- **Expected**: HTTP 200, computed DA_PHAN_HOI
- **Data required**: `utdt.qua_han.D90`

#### TC-UTDT-064 — State KHONG_THUC_HIEN_DUOC → DA_PHAN_HOI (gỡ lyDo + set ketQua)
- **Type/Priority/Severity**: STATE / P1 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: UTDT KHONG_THUC_HIEN_DUOC
- **Steps**:
  PUT {metadata:{}, ketQuaUyThac, ngayTraKetQua}
- **Expected**: HTTP 200, computed DA_PHAN_HOI
- **Data required**: `utdt.khong_thuc_hien.D30`

### DECISION (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-065** | P0 | Critical | Decision matrix computed state — 4×3 (state × scenario) | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-066** | P0 | High | Decision matrix computed: ketQua × ngayTra × thoiHan × lyDo (truth table 16 cells) | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-067** | P1 | Medium | Decision matrix filter combo (caseType × trangThaiPhanHoi × loaiUyThac) | `GET /api/v1/cases` | OFFICER |

#### TC-UTDT-065 — Decision matrix computed state — 4×3 (state × scenario)
- **Type/Priority/Severity**: DECISION / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  3 scenario mỗi state: (default), (with filter donViGiao), (with date range)
- **Expected**: 12 cell counts đúng theo buildTrangThaiFilter
- **Data required**: `utdt.all_state.D0`

#### TC-UTDT-066 — Decision matrix computed: ketQua × ngayTra × thoiHan × lyDo (truth table 16 cells)
- **Type/Priority/Severity**: DECISION / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  16 combination → compute expected state
- **Expected**: Mỗi combo match TrangThaiPhanHoi spec
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-067 — Decision matrix filter combo (caseType × trangThaiPhanHoi × loaiUyThac)
- **Type/Priority/Severity**: DECISION / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  2×4×3 = 24 cell sample
- **Expected**: Mỗi truy vấn trả tập đúng (no leak Regular khi caseType=UTDT)
- **Data required**: `utdt.all_state.D0`

### SECURITY (11 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-078** | P0 | Critical | IDOR — UTDT team khác → 403/404 | `GET /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-079** | P0 | Critical | Stats không leak counts cross-team | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-080** | P0 | Critical | Prototype pollution metadata.__proto__ | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-081** | P0 | High | Mass assignment UTDT — gửi caseProvenance, createdById | `PUT /api/v1/cases/:id` | OFFICER |
| **TC-UTDT-082** | P0 | High | Audit log UTDT có UTDT-specific fields | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-083** | P1 | High | UTDT stats RATE LIMIT (chống mass query) | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-084** | P1 | Medium | UTDT-related fields không leak qua /api/v1/cases (REGULAR) | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-085** | P0 | Critical | Assign UTDT — verify DispatchGuard | `PATCH /api/v1/cases/:id/assign` | ADMIN |
| **TC-UTDT-086** | P1 | Medium | UTDT search bypass caseType — verify can NOT bypass | `GET /api/v1/cases` | OFFICER |
| **TC-UTDT-087** | P1 | High | Verify counts buildTrangThaiFilter chính xác (đơn vị test) | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-090** | P0 | High | caseType=UY_THAC_DIEU_TRA scope chặt + wardTeamId verify | `GET /api/v1/cases` | OFFICER |

#### TC-UTDT-078 — IDOR — UTDT team khác → 403/404
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET other team UTDT
- **Expected**: HTTP 403/404
- **Data required**: `utdt.other_team.D0, account.officer.primary`

#### TC-UTDT-079 — Stats không leak counts cross-team
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET utdt-stats với officer A, sau đó officer B — verify counts khác nhau theo scope
- **Expected**: Counts strict theo dataScope
- **Data required**: `account.officer.primary, account.officer.secondary, utdt.cross_team.D0`

#### TC-UTDT-080 — Prototype pollution metadata.__proto__
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST {metadata:{__proto__:{admin:true}}}
- **Expected**: HTTP 201, không pollute
- **Data required**: `account.officer.primary`

#### TC-UTDT-081 — Mass assignment UTDT — gửi caseProvenance, createdById
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `PUT /api/v1/cases/:id`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  PUT {caseProvenance:'DIRECT_DISCOVERY', createdById:'attacker'}
- **Expected**: HTTP 400 (whitelist) hoặc strip
- **Data required**: `utdt.chua_phan_hoi.D30`

#### TC-UTDT-082 — Audit log UTDT có UTDT-specific fields
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST UTDT + check audit_log
- **Expected**: audit có donViGiao, soQuyetDinhUyThac trong oldValues/newValues
- **Data required**: `account.officer.primary`

#### TC-UTDT-083 — UTDT stats RATE LIMIT (chống mass query)
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  100 GET /utdt-stats trong 60s
- **Expected**: Sau threshold throttle 429
- **Data required**: `account.officer.primary`

#### TC-UTDT-084 — UTDT-related fields không leak qua /api/v1/cases (REGULAR)
- **Type/Priority/Severity**: SECURITY / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET /api/v1/cases?caseType=REGULAR
- **Expected**: Items REGULAR có UTDT fields đều null/undefined
- **Data required**: `cases.mixed_type.D0`

#### TC-UTDT-085 — Assign UTDT — verify DispatchGuard
- **Type/Priority/Severity**: SECURITY / P0 / Critical
- **Endpoint**: `PATCH /api/v1/cases/:id/assign`
- **Role**: ADMIN
- **Pre**: -
- **Steps**:
  PATCH /assign UTDT
- **Expected**: HTTP 200 cho admin với canDispatch
- **Data required**: `utdt.unassigned.D0, account.admin.primary, account.officer.primary`

#### TC-UTDT-086 — UTDT search bypass caseType — verify can NOT bypass
- **Type/Priority/Severity**: SECURITY / P1 / Medium
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?search=PC01 (UTDT donViGiao có PC01)
- **Expected**: HTTP 200 — REGULAR mode default exclude UTDT, không leak UTDT name qua search
- **Data required**: `utdt.donvi_pc01.D0, cases.regular.D0`

#### TC-UTDT-087 — Verify counts buildTrangThaiFilter chính xác (đơn vị test)
- **Type/Priority/Severity**: SECURITY / P1 / High
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: DB seed 4 UTDT đúng 4 state
- **Steps**:
  GET
- **Expected**: Counts (1,1,1,1)
- **Data required**: `utdt.all_state.D0`

#### TC-UTDT-090 — caseType=UY_THAC_DIEU_TRA scope chặt + wardTeamId verify
- **Type/Priority/Severity**: SECURITY / P0 / High
- **Endpoint**: `GET /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET ?caseType=UY_THAC_DIEU_TRA&wardTeamId={{other_team_ward}}
- **Expected**: HTTP 200, items=[] nếu officer không có wardTeam khớp — không leak qua wardTeamId param
- **Data required**: `utdt.shape.full.D0, account.officer.primary`

### DATA (2 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-088** | P1 | Medium | UTDT donViGiao tiếng Việt + dấu | `POST /api/v1/cases` | OFFICER |
| **TC-UTDT-089** | P1 | Medium | UTDT soQuyetDinhUyThac format chuẩn Mẫu 58 | `POST /api/v1/cases` | OFFICER |

#### TC-UTDT-088 — UTDT donViGiao tiếng Việt + dấu
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST donViGiao='Công an Quận Đống Đa — PC01'
- **Expected**: HTTP 201, GET lại đúng
- **Data required**: `account.officer.primary`

#### TC-UTDT-089 — UTDT soQuyetDinhUyThac format chuẩn Mẫu 58
- **Type/Priority/Severity**: DATA / P1 / Medium
- **Endpoint**: `POST /api/v1/cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  POST soQuyetDinhUyThac='58/2026/UTĐT-PC02'
- **Expected**: HTTP 201
- **Data required**: `account.officer.primary`

### A11Y (6 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-097** | P1 | Medium | Tab 'Thông tin Ủy thác' keyboard nav | `UI: /cases/new (tab Ủy thác)` | OFFICER |
| **TC-UTDT-098** | P1 | Medium | Conditional tab visibility — aria-hidden khi REGULAR | `UI: /cases/new` | OFFICER |
| **TC-UTDT-099** | P1 | Medium | TrangThaiBadge contrast 4 state WCAG AA | `UI: /cases` | OFFICER |
| **TC-UTDT-100** | P1 | Medium | Field loaiUyThac dropdown — aria-label + role='combobox' | `UI: /cases/new` | OFFICER |
| **TC-UTDT-101** | P2 | Low | Date input ngayTiepNhan + thoiHanUyThac — aria-describedby format hint | `UI: /cases/new` | OFFICER |
| **TC-UTDT-102** | P2 | Low | UTDT-stats chips — focus order logic | `UI: /cases` | OFFICER |

#### TC-UTDT-097 — Tab 'Thông tin Ủy thác' keyboard nav
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases/new (tab Ủy thác)`
- **Role**: OFFICER
- **Pre**: caseType=UTDT chọn
- **Steps**:
  Tab qua các field UTDT
- **Expected**: Focus visible mọi field section 1/2/3
- **Data required**: `account.officer.primary`

#### TC-UTDT-098 — Conditional tab visibility — aria-hidden khi REGULAR
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases/new`
- **Role**: OFFICER
- **Pre**: caseType=REGULAR
- **Steps**:
  Inspect tab list
- **Expected**: Tab Ủy thác có aria-hidden='true' hoặc không render
- **Data required**: `account.officer.primary`

#### TC-UTDT-099 — TrangThaiBadge contrast 4 state WCAG AA
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Render 4 badge + measure
- **Expected**: 4 pair ≥4.5:1
- **Data required**: `utdt.all_state.D0`

#### TC-UTDT-100 — Field loaiUyThac dropdown — aria-label + role='combobox'
- **Type/Priority/Severity**: A11Y / P1 / Medium
- **Endpoint**: `UI: /cases/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect select
- **Expected**: role='combobox' aria-expanded
- **Data required**: `account.officer.primary`

#### TC-UTDT-101 — Date input ngayTiepNhan + thoiHanUyThac — aria-describedby format hint
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /cases/new`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Inspect
- **Expected**: Hint 'YYYY-MM-DD' có aria-describedby
- **Data required**: `account.officer.primary`

#### TC-UTDT-102 — UTDT-stats chips — focus order logic
- **Type/Priority/Severity**: A11Y / P2 / Low
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Tab qua 4 chip
- **Expected**: Order: DA_PHAN_HOI, KHONG_THUC_HIEN_DUOC, QUA_HAN, CHUA_PHAN_HOI
- **Data required**: `utdt.all_state.D0`

### COMPAT (5 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-103** | P1 | Medium | Chromium desktop | `UI: /cases (UTDT view)` | OFFICER |
| **TC-UTDT-104** | P1 | Medium | Firefox desktop | `UI: /cases` | OFFICER |
| **TC-UTDT-105** | P1 | Medium | WebKit desktop | `UI: /cases` | OFFICER |
| **TC-UTDT-106** | P0 | High | Mobile 375 — tab Ủy thác scrollable | `UI: /cases` | OFFICER |
| **TC-UTDT-107** | P1 | Medium | Tablet 768 | `UI: /cases` | OFFICER |

#### TC-UTDT-103 — Chromium desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases (UTDT view)`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: Tab Ủy thác render
- **Data required**: `account.officer.primary`

#### TC-UTDT-104 — Firefox desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: OK
- **Data required**: `account.officer.primary`

#### TC-UTDT-105 — WebKit desktop
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Open
- **Expected**: Date picker UTDT
- **Data required**: `account.officer.primary`

#### TC-UTDT-106 — Mobile 375 — tab Ủy thác scrollable
- **Type/Priority/Severity**: COMPAT / P0 / High
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Mobile viewport
- **Expected**: Tab list overflow scroll horizontal
- **Data required**: `account.officer.primary`

#### TC-UTDT-107 — Tablet 768
- **Type/Priority/Severity**: COMPAT / P1 / Medium
- **Endpoint**: `UI: /cases`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  Tablet viewport
- **Expected**: Adapt
- **Data required**: `account.officer.primary`

### PERFORMANCE (3 TC)

| ID | Priority | Severity | Title | Endpoint | Role |
|----|----------|----------|-------|----------|------|
| **TC-UTDT-108** | P0 | High | List 5k UTDT p95 < 800ms | `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA` | OFFICER |
| **TC-UTDT-109** | P0 | High | utdt-stats 5k UTDT — 4 parallel computed counts < 600ms | `GET /api/v1/cases/utdt-stats` | OFFICER |
| **TC-UTDT-110** | P0 | High | Filter computed state — query plan có index thoiHanUyThac | `GET /api/v1/cases?trangThaiPhanHoi=QUA_HAN` | OFFICER |

#### TC-UTDT-108 — List 5k UTDT p95 < 800ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases?caseType=UY_THAC_DIEU_TRA`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  100 GET concurrent
- **Expected**: p95 < 800ms
- **Data required**: `utdt.shape.large.D0`

#### TC-UTDT-109 — utdt-stats 5k UTDT — 4 parallel computed counts < 600ms
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases/utdt-stats`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  50 GET concurrent
- **Expected**: p95 < 600ms
- **Data required**: `utdt.shape.large.D0`

#### TC-UTDT-110 — Filter computed state — query plan có index thoiHanUyThac
- **Type/Priority/Severity**: PERFORMANCE / P0 / High
- **Endpoint**: `GET /api/v1/cases?trangThaiPhanHoi=QUA_HAN`
- **Role**: OFFICER
- **Pre**: -
- **Steps**:
  GET với 5k UTDT
- **Expected**: < 1s, query plan dùng index
- **Data required**: `utdt.shape.large.D0`
