import type { CaseFormData, CaseStatisticForm } from './types';
import { INITIAL_CASE_STATISTIC } from './types';
import { toDateInput } from '@/lib/dates';

const STAT_DATE_KEYS = new Set([
  'ngayDangKyHoSo', 'ngayNopLuuHoSo', 'ngayThongKe', 'ngayPhanCongGiaiQuyetToGiac',
  'ngayTiepNhanTin', 'ngayDauThu', 'ngayPhamToiQuaTang', 'ngayBatKhanCap', 'ngayPhatHienDauHieu',
]);
const STAT_BOOL_KEYS = new Set([
  'coGhiAmGhiHinh', 'laVuAnGhiAmGhiHinh', 'vksYeuCauGhiAm', 'coVPHC', 'coBangNhom',
  // PR-M2: vuAnDaDuocXetXu (sửa luôn round-trip cũ) + 3 cờ xét-xử riêng
  'vuAnDaDuocXetXu', 'ghiAmGhiHinhDaDuocXetXu', 'coSuDungKQGhiAmTrongXetXu', 'khongGAGHNhungToaYeuCau',
]);

// API CaseStatistic record → CaseStatisticForm (số→string, ngày→date input, bool→bool).
function mergeStatistic(
  api: Record<string, unknown> | null | undefined,
  prev: CaseStatisticForm,
): CaseStatisticForm {
  if (!api) return prev;
  const out = { ...INITIAL_CASE_STATISTIC } as Record<string, unknown>;
  for (const k of Object.keys(INITIAL_CASE_STATISTIC)) {
    const v = api[k];
    if (STAT_BOOL_KEYS.has(k)) out[k] = Boolean(v);
    else if (v == null) out[k] = '';
    else if (STAT_DATE_KEYS.has(k)) out[k] = toDateInput(v as string);
    else out[k] = String(v);
  }
  return out as unknown as CaseStatisticForm;
}

type ApiCaseRecord = {
  name?: string | null;
  caseCode?: string | null; // cột gốc (v0.42) — nguồn thật của mã vụ án
  crime?: string | null;
  crimeChinhId?: string | null; // FK master Crime (tội danh chính)
  status?: string | null;
  deadline?: string | null;
  unit?: string | null;
  assignedTeamId?: string | null;
  assignedTeam?: { id?: string } | null;
  investigatorId?: string | null;
  investigator?: { id?: string } | null;
  capDoToiPham?: string | null;
  caseProvenance?: string | null;
  linkedPetitionId?: string | null;
  linkedIncidentId?: string | null;
  sourceDocumentNote?: string | null;
  autoLinkedIncident?: { id: string; code?: string; name?: string } | null;
  metadata?: Record<string, string> | null;
  [k: string]: unknown;
};

/**
 * v0.37.2.5 — Merge API response into form state for EditMode load.
 *
 * Bug fix: previously omitted caseProvenance + linkedPetitionId +
 * linkedIncidentId + sourceDocumentNote → PUT payload sent empty
 * caseProvenance → BE @IsEnum 400. Now loads all 4 columns from API.
 *
 * Extracted from CaseFormPage useEffect to be unit-testable.
 */
export function mergeCaseApiToFormData(
  apiData: ApiCaseRecord,
  prev: CaseFormData,
): CaseFormData {
  const meta = (apiData.metadata ?? {}) as Record<string, string>;
  return {
    ...prev,
    caseTitle:             apiData.name                  ?? prev.caseTitle,
    criminalType:          apiData.crime                 ?? prev.criminalType,
    status:                apiData.status                ?? prev.status,
    investigationDeadline: apiData.deadline
                             ? toDateInput(apiData.deadline)
                             : prev.investigationDeadline,
    supervisingUnit:       apiData.unit                  ?? prev.supervisingUnit,
    assignedTeamId:        apiData.assignedTeamId        ?? apiData.assignedTeam?.id ?? prev.assignedTeamId,
    handler:               apiData.investigatorId        ?? apiData.investigator?.id ?? prev.handler,
    capDoToiPham:          apiData.capDoToiPham          ?? prev.capDoToiPham,
    statistic:             mergeStatistic(apiData.statistic as Record<string, unknown> | null | undefined, prev.statistic),
    // v0.37.2.5 — Provenance fields (4 columns + 0 lock tokens for EDIT).
    // Lock tokens only matter for CREATE FROM_PETITION/FROM_INCIDENT — for EDIT
    // the link is already established and BE preserves it.
    caseProvenance:        apiData.caseProvenance        ?? prev.caseProvenance,
    linkedPetitionId:      apiData.linkedPetitionId      ?? prev.linkedPetitionId,
    linkedIncidentId:      apiData.linkedIncidentId      ?? prev.linkedIncidentId,
    sourceDocumentNote:    apiData.sourceDocumentNote    ?? prev.sourceDocumentNote,
    autoLinkedIncidentId:  apiData.autoLinkedIncident?.id ?? prev.autoLinkedIncidentId ?? '',
    // caseCode PROMOTED thành cột gốc ở v0.42 (Case.caseCode @unique) — đọc GỐC trước, chỉ
    // lùi về metadata cho hồ sơ cũ chưa promote. Trước đây chỉ đọc metadata.caseCode nên
    // edit-mode luôn rỗng (bug): mọi vụ (kể cả di trú VA-/LS-) không hiện mã khi sửa.
    caseCode:                    apiData.caseCode ?? meta.caseCode ?? prev.caseCode,
    // Metadata fields
    receiveDate:                 meta.receiveDate                 ?? prev.receiveDate,
    receiveTime:                 meta.receiveTime                 ?? prev.receiveTime,
    caseClassification:          meta.caseClassification          ?? prev.caseClassification,
    priority:                    meta.priority                    ?? prev.priority,
    description:                 meta.description                 ?? prev.description,
    nguonDon:                     meta.nguonDon                     ?? prev.nguonDon,
    nhanXet:                      meta.nhanXet                      ?? prev.nhanXet,
    biHai:                        meta.biHai                        ?? prev.biHai,
    noiXayRa:                     meta.noiXayRa                     ?? prev.noiXayRa,
    nghiVanDoiTuong:              meta.nghiVanDoiTuong              ?? prev.nghiVanDoiTuong,
    phuongThucThuDoan:            meta.phuongThucThuDoan            ?? prev.phuongThucThuDoan,
    ketQuaXuLyKhac:               meta.ketQuaXuLyKhac               ?? prev.ketQuaXuLyKhac,
    soPhieuChuyen:                meta.soPhieuChuyen                ?? prev.soPhieuChuyen,
    dieuTraVienText:              meta.dieuTraVienText              ?? prev.dieuTraVienText,
    sttCu:                        meta.sttCu                        ?? prev.sttCu,
    soHoSoCu:                     (apiData as { soHoSoCu?: string }).soHoSoCu ?? prev.soHoSoCu,
    tenCungCap:                   meta.tenCungCap                   ?? prev.tenCungCap,
    sinhNamCungCap:               meta.sinhNamCungCap               ?? prev.sinhNamCungCap,
    cccdCungCap:                  meta.cccdCungCap                  ?? prev.cccdCungCap,
    ngayCapCccd:                  meta.ngayCapCccd                  ?? prev.ngayCapCccd,
    noiCapCccd:                   meta.noiCapCccd                   ?? prev.noiCapCccd,
    sdtCungCap:                   meta.sdtCungCap                   ?? prev.sdtCungCap,
    tinhTrang:                    meta.tinhTrang                    ?? prev.tinhTrang,
    phanLoaiToiPhamLinhVuc:       meta.phanLoaiToiPhamLinhVuc       ?? prev.phanLoaiToiPhamLinhVuc,
    deXuatXuLy:                   meta.deXuatXuLy                   ?? prev.deXuatXuLy,
    yeuCauBoSung:                 meta.yeuCauBoSung                 ?? prev.yeuCauBoSung,
    investigationStartDate:      meta.investigationStartDate      ?? prev.investigationStartDate,
    prosecutionOfficeAssigned:   meta.prosecutionOfficeAssigned   ?? prev.prosecutionOfficeAssigned,
    relatedCaseCode:             meta.relatedCaseCode             ?? prev.relatedCaseCode,
    // v0.39 — damageAmount stored as number in BE since input-mask refactor.
    // Convert to string for form state (types.ts declares string).
    damageAmount:                meta.damageAmount != null ? String(meta.damageAmount) : prev.damageAmount,
    damageDescription:           meta.damageDescription           ?? prev.damageDescription,
    note:                        meta.note                        ?? prev.note,
    reporter:                    meta.reporter                    ?? prev.reporter,
    reporterIdNumber:            meta.reporterIdNumber            ?? prev.reporterIdNumber,
    reporterDateOfBirth:         meta.reporterDateOfBirth         ?? prev.reporterDateOfBirth,
    reporterGender:              meta.reporterGender              ?? prev.reporterGender,
    reporterPhone:               meta.reporterPhone               ?? prev.reporterPhone,
    reporterEmail:               meta.reporterEmail               ?? prev.reporterEmail,
    reporterAddress:             meta.reporterAddress             ?? prev.reporterAddress,
    reporterNationality:         meta.reporterNationality         ?? prev.reporterNationality,
    reporterOccupation:          meta.reporterOccupation          ?? prev.reporterOccupation,
    reporterRelationToCase:      meta.reporterRelationToCase      ?? prev.reporterRelationToCase,
    province:                    meta.province                    ?? prev.province,
    district:                    meta.district                    ?? prev.district,
    ward:                        meta.ward                        ?? prev.ward,
    specificAddress:             meta.specificAddress             ?? prev.specificAddress,
    // Tab 2: Vụ việc
    incidentCode:        meta.incidentCode        ?? prev.incidentCode,
    incidentDate:        meta.incidentDate        ?? prev.incidentDate,
    incidentTime:        meta.incidentTime        ?? prev.incidentTime,
    incidentLocation:    meta.incidentLocation    ?? prev.incidentLocation,
    incidentDescription: meta.incidentDescription ?? prev.incidentDescription,
    incidentType:        meta.incidentType        ?? prev.incidentType,
    incidentLevel:       meta.incidentLevel       ?? prev.incidentLevel,
    incidentCause:       meta.incidentCause       ?? prev.incidentCause,
    incidentMethod:      meta.incidentMethod      ?? prev.incidentMethod,
    // Tab 3: Vụ án (criminalType restored via apiData.crime → not repeated here)
    crimeChinhId:            (apiData.crimeChinhId as string) ?? prev.crimeChinhId, // FK master Crime
    criminalCode:            meta.criminalCode            ?? prev.criminalCode,
    // Bridge dữ liệu di trú: hồ sơ cũ ghi ngày khởi tố vào CỘT ngayKhoiTo và địa điểm vào
    // metadata.noiXayRa (không phải metadata.criminalDate/criminalLocation). Lùi về nguồn di
    // trú để section "Thông tin vụ án" hiện dữ liệu thay vì trống.
    criminalDate:            meta.criminalDate ?? (apiData.ngayKhoiTo ? toDateInput(apiData.ngayKhoiTo as string) : undefined) ?? prev.criminalDate,
    criminalLocation:        meta.criminalLocation ?? meta.noiXayRa ?? prev.criminalLocation,
    criminalSecondaryType:   meta.criminalSecondaryType   ?? prev.criminalSecondaryType,
    accusation:              meta.accusation              ?? prev.accusation,
    prosecutionOffice:       meta.prosecutionOffice       ?? prev.prosecutionOffice,
    courtName:               meta.courtName               ?? prev.courtName,
    courtHearingDate:        meta.courtHearingDate        ?? prev.courtHearingDate,
    verdict:                 meta.verdict                 ?? prev.verdict,
    sentence:                meta.sentence                ?? prev.sentence,
    // Tab 5: Vụ việc TĐC
    tdcIncidentCode:  meta.tdcIncidentCode  ?? prev.tdcIncidentCode,
    tdcSource:        meta.tdcSource        ?? prev.tdcSource,
    tdcReceiveDate:   meta.tdcReceiveDate   ?? prev.tdcReceiveDate,
    tdcContent:       meta.tdcContent       ?? prev.tdcContent,
    tdcResult:        meta.tdcResult        ?? prev.tdcResult,
    tdcTransferDate:  meta.tdcTransferDate  ?? prev.tdcTransferDate,
    // Tab 6: Vụ án TĐC
    tdcCaseCode:         meta.tdcCaseCode         ?? prev.tdcCaseCode,
    tdcCaseType:         meta.tdcCaseType         ?? prev.tdcCaseType,
    tdcProcessingResult: meta.tdcProcessingResult ?? prev.tdcProcessingResult,
    tdcClosedDate:       meta.tdcClosedDate       ?? prev.tdcClosedDate,
    // Tab 9: Thống kê 48 trường
    stat_sourceType:            meta.stat_sourceType            ?? prev.stat_sourceType,
    stat_sourceOrigin:          meta.stat_sourceOrigin          ?? prev.stat_sourceOrigin,
    stat_informantType:         meta.stat_informantType         ?? prev.stat_informantType,
    stat_receiveMethod:         meta.stat_receiveMethod         ?? prev.stat_receiveMethod,
    stat_urgencyLevel:          meta.stat_urgencyLevel          ?? prev.stat_urgencyLevel,
    stat_reportingUnit:         meta.stat_reportingUnit         ?? prev.stat_reportingUnit,
    stat_incidentDate:          meta.stat_incidentDate          ?? prev.stat_incidentDate,
    stat_incidentTime:          meta.stat_incidentTime          ?? prev.stat_incidentTime,
    stat_incidentProvince:      meta.stat_incidentProvince      ?? prev.stat_incidentProvince,
    stat_incidentDistrict:      meta.stat_incidentDistrict      ?? prev.stat_incidentDistrict,
    stat_incidentWard:          meta.stat_incidentWard          ?? prev.stat_incidentWard,
    stat_initialClassification: meta.stat_initialClassification ?? prev.stat_initialClassification,
    stat_primaryCrime:          meta.stat_primaryCrime          ?? prev.stat_primaryCrime,
    stat_secondaryCrime:        meta.stat_secondaryCrime        ?? prev.stat_secondaryCrime,
    stat_crimeField:            meta.stat_crimeField            ?? prev.stat_crimeField,
    stat_crimeMethod:           meta.stat_crimeMethod           ?? prev.stat_crimeMethod,
    stat_damageAmount:          meta.stat_damageAmount != null ? String(meta.stat_damageAmount) : prev.stat_damageAmount,
    stat_recoveredAmount:       meta.stat_recoveredAmount       ?? prev.stat_recoveredAmount,
    stat_victimCount:           meta.stat_victimCount           ?? prev.stat_victimCount,
    stat_deathCount:            meta.stat_deathCount            ?? prev.stat_deathCount,
    stat_injuryCount:           meta.stat_injuryCount           ?? prev.stat_injuryCount,
    stat_propertyDamage:        meta.stat_propertyDamage        ?? prev.stat_propertyDamage,
    stat_organizedCrime:        meta.stat_organizedCrime        ?? prev.stat_organizedCrime,
    stat_repeatOffender:        meta.stat_repeatOffender        ?? prev.stat_repeatOffender,
    stat_suspectCount:          meta.stat_suspectCount          ?? prev.stat_suspectCount,
    stat_suspectArrested:       meta.stat_suspectArrested       ?? prev.stat_suspectArrested,
    stat_suspectDetained:       meta.stat_suspectDetained       ?? prev.stat_suspectDetained,
    stat_suspectGender:         meta.stat_suspectGender         ?? prev.stat_suspectGender,
    stat_suspectAge:            meta.stat_suspectAge            ?? prev.stat_suspectAge,
    stat_suspectEthnicity:      meta.stat_suspectEthnicity      ?? prev.stat_suspectEthnicity,
    stat_suspectNationality:    meta.stat_suspectNationality    ?? prev.stat_suspectNationality,
    stat_suspectOccupation:     meta.stat_suspectOccupation     ?? prev.stat_suspectOccupation,
    stat_suspectEducation:      meta.stat_suspectEducation      ?? prev.stat_suspectEducation,
    stat_suspectCriminalRecord: meta.stat_suspectCriminalRecord ?? prev.stat_suspectCriminalRecord,
    stat_suspectDrugRelated:    meta.stat_suspectDrugRelated    ?? prev.stat_suspectDrugRelated,
    stat_suspectWeaponUsed:     meta.stat_suspectWeaponUsed     ?? prev.stat_suspectWeaponUsed,
    stat_processingStatus:      meta.stat_processingStatus      ?? prev.stat_processingStatus,
    stat_investigationResult:   meta.stat_investigationResult   ?? prev.stat_investigationResult,
    stat_prosecutionResult:     meta.stat_prosecutionResult     ?? prev.stat_prosecutionResult,
    stat_trialResult:           meta.stat_trialResult           ?? prev.stat_trialResult,
    stat_sentencingResult:      meta.stat_sentencingResult      ?? prev.stat_sentencingResult,
    stat_closedDate:            meta.stat_closedDate            ?? prev.stat_closedDate,
    stat_processingDays:        meta.stat_processingDays        ?? prev.stat_processingDays,
    stat_evidenceCollected:     meta.stat_evidenceCollected     ?? prev.stat_evidenceCollected,
    stat_witnessCount:          meta.stat_witnessCount          ?? prev.stat_witnessCount,
    stat_propertySeized:        meta.stat_propertySeized        ?? prev.stat_propertySeized,
    stat_caseTransferred:       meta.stat_caseTransferred       ?? prev.stat_caseTransferred,
    stat_reportSubmitted:       meta.stat_reportSubmitted       ?? prev.stat_reportSubmitted,
    // UTDT top-level columns (caseProvenance=UY_THAC_DIEU_TRA)
    utdt_loaiUyThac:            (apiData.loaiUyThac as string)            ?? prev.utdt_loaiUyThac,
    utdt_donViGiao:             (apiData.donViGiao as string)             ?? prev.utdt_donViGiao,
    utdt_soQuyetDinhUyThac:     (apiData.soQuyetDinhUyThac as string)     ?? prev.utdt_soQuyetDinhUyThac,
    utdt_ngayTiepNhan:          apiData.ngayTiepNhan ? toDateInput(apiData.ngayTiepNhan as string) : prev.utdt_ngayTiepNhan,
    utdt_thoiHanUyThac:         apiData.thoiHanUyThac ? toDateInput(apiData.thoiHanUyThac as string) : prev.utdt_thoiHanUyThac,
    utdt_loaiThongTin:          (apiData.loaiThongTin as string)          ?? prev.utdt_loaiThongTin,
    utdt_ketQuaUyThac:          (apiData.ketQuaUyThac as string)          ?? prev.utdt_ketQuaUyThac,
    utdt_ngayTraKetQua:         apiData.ngayTraKetQua ? toDateInput(apiData.ngayTraKetQua as string) : prev.utdt_ngayTraKetQua,
    // UTDT metadata fields
    utdt_nghiVanDoiTuong:              meta.nghiVanDoiTuong              ?? prev.utdt_nghiVanDoiTuong,
    utdt_lyDoKhongThucHienDuoc:        meta.lyDoKhongThucHienDuoc        ?? prev.utdt_lyDoKhongThucHienDuoc,
    utdt_ngayThongBaoKhongThucHien:    meta.ngayThongBaoKhongThucHien    ?? prev.utdt_ngayThongBaoKhongThucHien,
    // Field-parity: KLĐT + QĐ điều tra lại
    soKLDT:          (apiData.soKLDT as string)          ?? prev.soKLDT,
    ngayKLDT:        apiData.ngayKLDT ? toDateInput(apiData.ngayKLDT as string) : prev.ngayKLDT,
    soQDDieuTraLai:  (apiData.soQDDieuTraLai as string)  ?? prev.soQDDieuTraLai,
    ngayQDDieuTraLai: apiData.ngayQDDieuTraLai ? toDateInput(apiData.ngayQDDieuTraLai as string) : prev.ngayQDDieuTraLai,
    // Field-parity: số QĐ giai đoạn vụ án (15 cột top-level)
    soQuyetDinhKhoiTo:   (apiData.soQuyetDinhKhoiTo as string)   ?? prev.soQuyetDinhKhoiTo,
    ngayKhoiTo:          apiData.ngayKhoiTo ? toDateInput(apiData.ngayKhoiTo as string) : prev.ngayKhoiTo,
    soQDNhapVuAn:        (apiData.soQDNhapVuAn as string)        ?? prev.soQDNhapVuAn,
    ngayNhapVuAn:        apiData.ngayNhapVuAn ? toDateInput(apiData.ngayNhapVuAn as string) : prev.ngayNhapVuAn,
    ghiChuNhapHoSo:      (apiData.ghiChuNhapHoSo as string)      ?? prev.ghiChuNhapHoSo,
    soQDTachVuAn:        (apiData.soQDTachVuAn as string)        ?? prev.soQDTachVuAn,
    ngayTachVuAn:        apiData.ngayTachVuAn ? toDateInput(apiData.ngayTachVuAn as string) : prev.ngayTachVuAn,
    soQDTachHanhVi:      (apiData.soQDTachHanhVi as string)      ?? prev.soQDTachHanhVi,
    ngayTachHanhVi:      apiData.ngayTachHanhVi ? toDateInput(apiData.ngayTachHanhVi as string) : prev.ngayTachHanhVi,
    soQDDinhChiVuAn:     (apiData.soQDDinhChiVuAn as string)     ?? prev.soQDDinhChiVuAn,
    ngayDinhChiVuAn:     apiData.ngayDinhChiVuAn ? toDateInput(apiData.ngayDinhChiVuAn as string) : prev.ngayDinhChiVuAn,
    chuyenVuAnChoCQK:    (apiData.chuyenVuAnChoCQK as string)    ?? prev.chuyenVuAnChoCQK,
    soBanAnCoHieuLuc:    (apiData.soBanAnCoHieuLuc as string)    ?? prev.soBanAnCoHieuLuc,
    ngayBanAnCoHieuLuc:  apiData.ngayBanAnCoHieuLuc ? toDateInput(apiData.ngayBanAnCoHieuLuc as string) : prev.ngayBanAnCoHieuLuc,
    canCuTamDinhChiVuAn: (apiData.canCuTamDinhChiVuAn as string) ?? prev.canCuTamDinhChiVuAn,
    canCuPhucHoiVuAn:    (apiData.canCuPhucHoiVuAn as string)    ?? prev.canCuPhucHoiVuAn,
    // PR-3 — tab "Vụ án TĐC"
    soQuyetDinhTamDinhChi:   (apiData.soQuyetDinhTamDinhChi as string)   ?? prev.soQuyetDinhTamDinhChi,
    ngayTamDinhChi:          apiData.ngayTamDinhChi ? toDateInput(apiData.ngayTamDinhChi as string) : prev.ngayTamDinhChi,
    lyDoTamDinhChiVuAn:      Array.isArray(apiData.lyDoTamDinhChiVuAn) ? (apiData.lyDoTamDinhChiVuAn as string[]) : prev.lyDoTamDinhChiVuAn,
    ngayHetThoiHieu:         apiData.ngayHetThoiHieu ? toDateInput(apiData.ngayHetThoiHieu as string) : prev.ngayHetThoiHieu,
    soQuyetDinhPhucHoi:      (apiData.soQuyetDinhPhucHoi as string)      ?? prev.soQuyetDinhPhucHoi,
    ngayPhucHoi:             apiData.ngayPhucHoi ? toDateInput(apiData.ngayPhucHoi as string) : prev.ngayPhucHoi,
    tdcKhacPhucLyDoBienPhap: (apiData.tdcKhacPhucLyDoBienPhap as string) ?? prev.tdcKhacPhucLyDoBienPhap,
    tdcKhacPhucBienBan:      (apiData.tdcKhacPhucBienBan as string)      ?? prev.tdcKhacPhucBienBan,
    // PR-M2: ghi chú tự do + tội danh khác (multi)
    ghiChuKhac:     (apiData.ghiChuKhac as string) ?? prev.ghiChuKhac,
    toiDanhKhacIds: Array.isArray(apiData.toiDanhKhacIds) ? (apiData.toiDanhKhacIds as string[]) : prev.toiDanhKhacIds,
  };
}
