# UTDT — Codebase Map (LEAN)

UTDT (Ủy Thác Điều Tra) là **sub-feature của Cases** — không có route/controller riêng. UTDT là Case với `caseType=UY_THAC_DIEU_TRA` + filter `caseProvenance=UY_THAC_DIEU_TRA`.

## Endpoints UTDT-specific
| METHOD | PATH | Note |
|--------|------|------|
| GET | /api/v1/cases?caseType=UY_THAC_DIEU_TRA | List UTDT cases (filter caseType) |
| GET | /api/v1/cases/utdt-stats | Stats by 4 TrangThaiPhanHoi computed states |
| POST | /api/v1/cases (với caseType=UY_THAC_DIEU_TRA) | Create UTDT case |
| PUT | /api/v1/cases/:id (với UTDT fields) | Update UTDT |
| GET | /api/v1/cases/:id (UTDT case) | Detail UTDT |

Reuse các endpoint Cases khác cho delete/restore/journey/export.

## UTDT-specific fields (Case schema)
- caseType (CaseType: REGULAR / UY_THAC_DIEU_TRA)
- caseProvenance=UY_THAC_DIEU_TRA (set kèm caseType)
- **donViGiao** (string max 500) — Đơn vị giao ủy thác (PC01, CA quận X)
- **soQuyetDinhUyThac** (string max 100) — Số QĐ/Phiếu (Mẫu 58 TT119/2021)
- **ngayTiepNhan** (DateString) — Ngày tiếp nhận biên bản
- **thoiHanUyThac** (DateString) — Thời hạn thực hiện
- **loaiUyThac** (LoaiUyThac enum 3) — UY_THAC_DIEU_TRA / CHUYEN_DON_NGUON_TIN / UY_THAC_GIAI_QUYET
- **ketQuaUyThac** (string) — Kết quả điều tra
- **ngayTraKetQua** (DateString) — Ngày trả kết quả
- **loaiThongTin** (string max 200) — Loại thông tin (Tố giác/Trình báo/Đề nghị/Kiến nghị)
- metadata.lyDoKhongThucHienDuoc (JSON) — Lý do không thực hiện được

## TrangThaiPhanHoi computed (cases.service.ts:44-82)
| State | Điều kiện |
|-------|-----------|
| **DA_PHAN_HOI** | ketQuaUyThac ≠ null AND ngayTraKetQua ≠ null |
| **KHONG_THUC_HIEN_DUOC** | metadata.lyDoKhongThucHienDuoc ≠ null |
| **QUA_HAN** | thoiHanUyThac < now AND ketQuaUyThac = null AND metadata.lyDoKhongThucHienDuoc = null |
| **CHUA_PHAN_HOI** | default (none of above) |

`buildTrangThaiFilter` exportable cho test.

## Filter UTDT
- `caseType=UY_THAC_DIEU_TRA` (default getList exclude UTDT, force = REGULAR)
- `donViGiao` (substring ILIKE)
- `loaiUyThac` (enum)
- `trangThaiPhanHoi` (computed state)
- `ngayTiepNhanFrom`/`ngayTiepNhanTo` (date range)
- `investigatorName` (search)

## UI
- Tab "Thông tin Ủy Thác" trong CaseFormPage (position 2, conditional)
- frontend/src/pages/cases/CaseFormTab1UyThac.tsx
- 3 sections: Section 1 (Loại UTDT + ngày + đơn vị giao + số QĐ + thời hạn + loại thông tin), Section 2 (nguồn đơn TT 28/2020), Section 3 (kết quả & phục hồi)

## Business rules
- Default GET /cases exclude UTDT (caseType=REGULAR implicit)
- POST tạo UTDT: caseType + caseProvenance đều phải UY_THAC_DIEU_TRA
- TrangThaiPhanHoi không phải field — computed runtime
- Mẫu 58 TT119/2021 — soQuyetDinhUyThac có pattern riêng
- Permissions: tái dùng Case (read/write/edit/delete/restore)

## Coverage target (LEAN): 110 TC
GREEN 14, RED 44, BOUNDARY 8, EP 8, EDGE 1, SECURITY 11, STATE 5, DECISION 3, DATA 2, A11Y 6, COMPAT 5, PERFORMANCE 3
