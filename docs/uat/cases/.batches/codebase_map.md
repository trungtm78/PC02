# Cases — Codebase Map (LEAN)

## Endpoints (13)

| # | METHOD | PATH | Permission | DTO/Query |
|---|--------|------|------------|-----------|
| 1 | GET | /api/v1/cases | read/Case | QueryCasesDto |
| 2 | GET | /api/v1/cases/stats | read/Case | QueryCasesStatsDto |
| 3 | GET | /api/v1/cases/utdt-stats | read/Case | QueryCasesStatsDto |
| 4 | GET | /api/v1/cases/export/ward | read/Case (5 req/60s throttle) | unitId, fromDate, toDate |
| 5 | GET | /api/v1/cases/export/other-classification | read/Case (5 req/60s) | fromDate, toDate, category |
| 6 | GET | /api/v1/cases/:id/status-history | read/Case | - |
| 7 | GET | /api/v1/cases/:id/journey | read/Case | page, limit (max 200) |
| 8 | GET | /api/v1/cases/:id | read/Case | - |
| 9 | POST | /api/v1/cases | write/Case | CreateCaseDto |
| 10 | PUT | /api/v1/cases/:id | edit/Case | UpdateCaseDto |
| 11 | GET | /api/v1/cases/:id/delete-preflight | delete/Case | - |
| 12 | GET | /api/v1/cases/admin/deleted | restore/Case | limit, offset, search |
| 13 | POST | /api/v1/cases/:id/restore | restore/Case | RestoreCaseDto (reason 10-500) |
| 14 | DELETE | /api/v1/cases/:id | delete/Case | DeleteCaseDto (reason 10-500) |
| 15 | PATCH | /api/v1/cases/:id/tdc-backfill | write/Case | { lyDoTamDinhChiVuAn } |
| 16 | PATCH | /api/v1/cases/:id/assign | DispatchGuard | AssignCaseDto |

## Inputs (CreateCaseDto)

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| name | string | YES | trim, max 500 |
| crime | string | no | max 255 |
| status | CaseStatus enum | no | 10 values |
| investigatorId | string | no | - |
| deadline | DateString | no | ISO8601 |
| unit | string | no | max 255 |
| assignedTeamId | string | no | FK Team |
| subjectsCount | int | no | min 0 |
| metadata | object | no | JSON |
| capDoToiPham | CapDoToiPham enum | no | 4 values |
| ngayKhoiTo | DateString | no | ISO8601 |
| caseProvenance | CaseProvenance enum | **YES** | 8 values (BLTTHS Đ.143) |
| linkedPetitionId | string | cond FROM_PETITION | non-empty |
| linkedIncidentId | string | cond FROM_INCIDENT | non-empty |
| expectedPetitionUpdatedAt | ISO8601 | cond FROM_PETITION | optimistic lock |
| expectedIncidentUpdatedAt | ISO8601 | cond FROM_INCIDENT | optimistic lock |
| sourceDocumentNote | string | no | max 1000 |
| **UTDT block** | | when caseType=UY_THAC_DIEU_TRA | |
| caseType | CaseType enum | no | REGULAR / UY_THAC_DIEU_TRA |
| donViGiao | string | no | max 500 |
| soQuyetDinhUyThac | string | no | max 100 |
| ngayTiepNhan | DateString | no | ISO8601 |
| thoiHanUyThac | DateString | no | ISO8601 |
| loaiUyThac | LoaiUyThac enum | no | 3 values |
| ketQuaUyThac | string | no | - |
| ngayTraKetQua | DateString | no | ISO8601 |
| loaiThongTin | string | no | max 200 |
| **Atomic sub-entity arrays** | | | |
| subjects[] | CreateSubjectInlineDto[] | no | max 100, ValidateNested |
| evidences[] | CreateEvidenceInlineDto[] | no | max 100 |
| documentIds[] | string[] | no | max 50 |

### CreateSubjectInlineDto (per subject)
fullName (req, max 255), dateOfBirth (req DateString), gender (max 10), idNumber (req, max 20), address (req, max 500), phone (max 20), occupationId, nationalityId, wardId, crimeId (req, FK CRIME), type, notes

### CreateEvidenceInlineDto (per evidence)
code (req, max 100), name (req, max 500), description (max 2000), quantity (int min 1), unit (max 50), storageLocation (max 255), receivedDate (DateString), status, evidenceType, entryOrder, warehouseReceipt

### UpdateCaseDto (extends PartialType + TĐC/PHUC_HOI)
expectedUpdatedAt (optimistic lock), lyDoTamDinhChiVuAn (enum 8 values), lyDoTamDinhChiText (max 500), soQuyetDinhTamDinhChi (max 100), ngayTamDinhChi (ISO8601), daRaSoat (boolean), ngayRaSoat (ISO8601), soQuyetDinhPhucHoi (max 100), ketQuaPhucHoiVuAn (enum 5 values)

## Enums

- **CaseStatus** (10): TIEP_NHAN, DANG_XAC_MINH, DA_XAC_MINH, DANG_DIEU_TRA, TAM_DINH_CHI, DINH_CHI, DA_KET_LUAN, DANG_TRUY_TO, DANG_XET_XU, DA_LUU_TRU
- **CaseProvenance** (8): FROM_PETITION, FROM_INCIDENT, DIRECT_DISCOVERY, TRANSFERRED, SELF_SURRENDER, PROSECUTOR_PROPOSAL, OTHER_LEGAL_SOURCE, UY_THAC_DIEU_TRA
- **CaseType** (2): REGULAR, UY_THAC_DIEU_TRA
- **LoaiUyThac** (3): UY_THAC_DIEU_TRA, CHUYEN_DON_NGUON_TIN, UY_THAC_GIAI_QUYET
- **CapDoToiPham** (4): IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG, DAC_BIET_NGHIEM_TRONG
- **LyDoTamDinhChiVuAn** (8): CHUA_XAC_DINH_BI_CAN, KHONG_BIET_BI_CAN_O_DAU, BI_CAN_BENH_TAM_THAN, CHUA_CO_KET_QUA_GIAM_DINH, CHUA_CO_KET_QUA_DINH_GIA, CHUA_CO_KET_QUA_TUONG_TRO, YEU_CAU_TAI_LIEU_CHUA_CO, BAT_KHA_KHANG
- **KetQuaPhucHoiVuAn** (5): KET_LUAN_DE_NGHI_TRUY_TO, DINH_CHI_DIEU_TRA, TAM_DINH_CHI_LAI, DANG_DIEU_TRA_XAC_MINH, CHUYEN_CO_QUAN_DIEU_TRA_KHAC

## State machine (CaseStatus)
TIEP_NHAN → DANG_XAC_MINH → DA_XAC_MINH → DANG_DIEU_TRA → {TAM_DINH_CHI ↔ phục hồi | DINH_CHI | DA_KET_LUAN → DANG_TRUY_TO → DANG_XET_XU → DA_LUU_TRU}

## Roles & permissions
- 5 actions on Case: read, write, edit, delete, restore
- DispatchGuard for /assign endpoint
- Roles: ADMIN, DISPATCHER, INVESTIGATOR, VIEWER, WARD_OFFICER
- DataScope: filter by Tổ/ĐTV (assignedTeamId, investigatorId)

## Business rules
- caseProvenance REQUIRED on create (review fix v0.37.2 — legacy metadata.petitionType returns 400)
- FROM_PETITION → linkedPetitionId + expectedPetitionUpdatedAt required (optimistic lock)
- FROM_INCIDENT → linkedIncidentId + expectedIncidentUpdatedAt required
- Soft delete with reason 10-500 chars, audit trail
- Ward officer auto-assignedTeamId from dataScope
- TĐC update requires lyDoTamDinhChiVuAn enum + status=TAM_DINH_CHI
- PHUC_HOI requires daRaSoat=true + soQuyetDinhPhucHoi + ketQuaPhucHoiVuAn
- Export throttled 5 req/60s
- Soft delete: only creator can delete (creator-only check)

## Coverage calc
- 13 endpoints × 6 = 78
- 10 states × 5 = 50
- 25 inputs × 8 = 200
- 5 roles × 4 = 20
- 15 errors × 2 = 30
- **Formula = 378 → LEAN target 130 TC (capped pragmatic)**

## Ratio target (130 TC)
- GREEN ≤20% → ≤26
- RED ≥40% → ≥52
- BOUNDARY+EP ≥15% → ≥20
- SECURITY ≥10% → ≥13
- A11Y ≥5% → ≥7
- COMPAT ≥5% → ≥7
- PERFORMANCE ≥3% → ≥4
- P0 30-50% → 39-65
