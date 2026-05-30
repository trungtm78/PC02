# Incidents — Codebase Map (LEAN)

## Endpoints (15)
| METHOD | PATH | Permission | DTO |
|--------|------|------------|-----|
| GET | /api/v1/incidents | read/Incident | QueryIncidentsDto |
| GET | /api/v1/incidents/linkable | read/Incident | ListLinkableIncidentDto |
| GET | /api/v1/incidents/stats | read/Incident | QueryIncidentsStatsDto |
| GET | /api/v1/incidents/investigators | read/Incident | search? |
| GET | /api/v1/incidents/export/ward | read/Incident (5/60s) | unitId, fromDate, toDate |
| GET | /api/v1/incidents/:id/journey | read/Incident | page, limit (max 200) |
| GET | /api/v1/incidents/:id/delete-preflight | delete/Incident | - |
| GET | /api/v1/incidents/:id | read/Incident | - |
| POST | /api/v1/incidents | write/Incident | CreateIncidentDto |
| PUT | /api/v1/incidents/:id | edit/Incident | UpdateIncidentDto |
| DELETE | /api/v1/incidents/:id | delete/Incident | DeleteIncidentDto (reason 10-500) |
| GET | /api/v1/incidents/admin/deleted | restore/Incident | limit, offset, search |
| POST | /api/v1/incidents/:id/restore | restore/Incident | RestoreIncidentDto |
| PATCH | /api/v1/incidents/:id/status | edit/Incident | UpdateStatusDto |
| PATCH | /api/v1/incidents/:id/merge | edit/Incident | MergeIncidentDto |
| PATCH | /api/v1/incidents/:id/transfer | edit/Incident | TransferIncidentDto |
| PATCH | /api/v1/incidents/:id/assign | DispatchGuard | AssignInvestigatorDto |
| POST | /api/v1/incidents/:id/extend | edit/Incident | - (Đ.147 BLTTHS gia hạn) |
| POST | /api/v1/incidents/:id/prosecute | edit/Incident | ProsecuteIncidentDto |

## CreateIncidentDto inputs
- **name** (REQUIRED string, min 5, max 255)
- incidentType (optional, max 100)
- description (optional)
- fromDate, toDate, deadline (optional ISO8601)
- unitId, investigatorId (optional FK)
- sourcePetitionId, linkedPetitionId (optional FK Petition)
- doiTuongCaNhan, doiTuongToChuc (optional)
- loaiDonVu (enum LoaiNguonTin: TO_GIAC/TIN_BAO/KIEN_NGHI_KHOI_TO)
- nguonPhatTin (enum NguonPhatTin: 10 values — cascading từ loaiDonVu, custom validator IsNguonPhatTinMatchLoaiDonVu)
- phuongThucTiepNhan (enum: 5 values TT 28/2020/TT-BCA Đ.6)
- benVu, donViGiaiQuyet (optional)
- ngayDeXuat (DateString)
- canBoNhapId, assignedTeamId (optional)
- soQuyetDinh, ngayQuyetDinh (optional)
- lyDoKhongKhoiTo (enum 7 grounds Đ.157)
- lyDoTamDinhChi (string)
- diaChi/sdt/cmndNguoiToGiac (optional)
- ketQuaXuLy, loaiKetQua, canCuKhoiToCode, tinhTrangHoSo, tinhTrangThoiHieu, nguoiQuyetDinh (optional)

## Enums

- **IncidentStatus** (15): TIEP_NHAN, DANG_XAC_MINH, DA_PHAN_CONG, DA_GIAI_QUYET, TAM_DINH_CHI, QUA_HAN, DA_CHUYEN_VU_AN, KHONG_KHOI_TO, CHUYEN_XPHC, TDC_HET_THOI_HIEU, TDC_HTH_KHONG_KT, PHUC_HOI_NGUON_TIN, DA_CHUYEN_DON_VI, DA_NHAP_VU_KHAC, PHAN_LOAI_DAN_SU
- **LoaiNguonTin** (3): TO_GIAC, TIN_BAO, KIEN_NGHI_KHOI_TO
- **NguonPhatTin** (10): CA_NHAN_TO_GIAC (TO_GIAC) | CO_QUAN_NHA_NUOC, TO_CHUC, CA_NHAN_BAO_TIN, PHUONG_TIEN_TRUYEN_THONG (TIN_BAO) | VIEN_KIEM_SAT, THANH_TRA, KIEM_TOAN, TOA_AN, CO_QUAN_KHAC (KIEN_NGHI)
- **PhuongThucTiepNhan** (5): TRUC_TIEP_BANG_LOI, TRUC_TIEP_BANG_VAN_BAN, DIEN_THOAI, BUU_DIEN, PHUONG_TIEN_DIEN_TU
- **LyDoTamDinhChiVuViec** (6): CHUA_CO_KET_QUA_GIAM_DINH, CHUA_CO_KET_QUA_DINH_GIA, CHUA_CO_KET_QUA_TUONG_TRO, YEU_CAU_TAI_LIEU_CHUA_CO, BAT_KHA_KHANG, CAN_CU_KHAC
- **KetQuaPhucHoiVuViec** (5): QUYET_DINH_KHOI_TO, QUYET_DINH_KHONG_KHOI_TO, TAM_DINH_CHI_LAI, DANG_XAC_MINH, CHUYEN_CO_QUAN_KHAC
- **LyDoKhongKhoiTo** (7+): KHONG_CO_SU_VIEC, HANH_VI_KHONG_CAU_THANH_TOI_PHAM, NGUOI_THUC_HIEN_CHUA_DU_TUOI, NGUOI_PHAM_TOI_CHET, HET_THOI_HIEU... (Đ.157)

## Business rules
- name 5-255 chars (min!)
- Cascading: nguonPhatTin phải match với loaiDonVu (custom validator)
- Status transition theo IncidentStatus enum 15 values
- Gia hạn Điều 147 BLTTHS max 2 lần, mỗi lần snapshot rule version
- Merge: self-reference mergedIntoId
- Transfer: chuyenDenDonVi/chuyenTuDonVi audit
- Prosecute: loaiKetQua + canCuKhoiToCode → tạo Case via incident-factory
- Soft delete reason 10-500
- Scope: dataScope (Tổ/ĐTV)
- Auto-assign team v0.33

## Coverage target (LEAN)
**140 TC**: GREEN 18, RED 56, BOUNDARY 10, EP 10, EDGE 1, SECURITY 14, STATE 8, DECISION 4, DATA 3, A11Y 7, COMPAT 6, PERFORMANCE 3
