# Petitions — Codebase Map (LEAN)

## Endpoints
| METHOD | PATH | Permission | DTO |
|--------|------|------------|-----|
| GET | /api/v1/petitions | read/Petition | QueryPetitionsDto |
| GET | /api/v1/petitions/linkable | read/Petition | ListLinkableDto |
| GET | /api/v1/petitions/stats | read/Petition | QueryPetitionsStatsDto |
| GET | /api/v1/petitions/export | read/Petition (5/60s) | ExportPetitionsQueryDto |
| GET | /api/v1/petitions/export/ward | read/Petition (5/60s) | unitId, fromDate, toDate |
| GET | /api/v1/petitions/export/duplicates | read/Petition | - |
| GET | /api/v1/petitions/:id | read/Petition | - |
| POST | /api/v1/petitions | write/Petition | CreatePetitionDto |
| PUT | /api/v1/petitions/:id | edit/Petition | UpdatePetitionDto |
| DELETE | /api/v1/petitions/:id | delete/Petition | reason |
| POST | /api/v1/petitions/:id/convert-incident | edit/Petition | ConvertToIncidentDto |
| POST | /api/v1/petitions/:id/convert-case | edit/Petition | ConvertToCaseDto |
| PATCH | /api/v1/petitions/:id/assign | DispatchGuard | AssignPetitionDto |
| GET | /api/v1/petitions/:id/export-word | read/Petition | - |
| GET | /api/v1/petitions/:id/export-document | read/Petition | docType (6 templates) |
| POST | /api/v1/petitions/export-document-batch | read/Petition | { petitionIds[], docType } |
| GET | /api/v1/petitions/:id/journey | read/Petition | page, limit |
| POST | /api/v1/petitions/:id/restore | restore/Petition | RestorePetitionDto |
| GET | /api/v1/petitions/admin/deleted | restore/Petition | - |

## CreatePetitionDto
- **receivedDate** (REQUIRED ISO8601)
- **senderName** (REQUIRED string, max 255, stripHtml)
- **petitionType** (REQUIRED enum LoaiDon: TO_CAO/KHIEU_NAI/KIEN_NGHI/PHAN_ANH)
- stt (optional max 50, engine sinh nếu trống — format DT-YYYY-NNNNN)
- unit, enteredById, senderBirthYear (max 4), senderAddress (max 500), senderPhone (regex /^[0-9\\s+-]*$/ max 20), senderEmail (IsEmail max 255)
- suspectedPerson, suspectedAddress
- priority, summary (max 1000), detailContent, attachmentsNote, notes (all stripHtml)
- deadline, assignedToId, assignedTeamId, status (enum)
- Doc template engine fields (v0.47): nhanThay/deXuat (max 5000), raSoatTrung (max 1000), baoCaoBanGiamDoc (bool), petitionDate, nguonDon (max 500), subTeamAssigned (max 255), lyDoChuyen (max 2000), canCuPhapLy (max 1000), huongDanKhoiKien (max 5000), lyDoTraDon (max 2000)

## Enums
- **PetitionStatus** (7): MOI_TIEP_NHAN, DANG_XU_LY, CHO_PHE_DUYET, DA_LUU_DON, DA_GIAI_QUYET, DA_CHUYEN_VU_VIEC, DA_CHUYEN_VU_AN
- **LoaiDon** (4): TO_CAO, KHIEU_NAI, KIEN_NGHI, PHAN_ANH

## Business rules
- STT auto-gen DT-YYYY-NNNNN nếu trống (DocumentNumbersService)
- stripHtml chạy trước validator (XSS defense)
- senderPhone regex bắt buộc số/space/+/- only
- senderEmail IsEmail validator
- Convert atomic: convert-incident tạo Incident + set linkedIncidentId; convert-case tạo Case + set linkedCaseId
- Export batch: ZIP với manifest, per-row tx, partial failure không abort
- Doc Template Engine: 6 docx types (PHIEU_DE_XUAT/PHIEU_CHUYEN_NGUON_TIN/PHIEU_CHUYEN_DON/THONG_BAO_CHUYEN/THONG_BAO_HUONG_DAN/THONG_BAO_TRA_LAI)
- Throttle export 5/60s

## Coverage target (LEAN): 120 TC
GREEN 16, RED 48, BOUNDARY 9, EP 9, EDGE 1, SECURITY 12, STATE 5, DECISION 3, DATA 2, A11Y 6, COMPAT 6, PERFORMANCE 3
