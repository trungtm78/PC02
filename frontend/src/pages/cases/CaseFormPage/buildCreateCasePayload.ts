import type { CaseFormData, Subject, Evidence } from './types';
import { parseVND, parsePhone } from '../../../shared/utils/formatters';

// PR 1 v0.38.0.0 — Sub-entity inline DTOs (match backend CreateSubjectInlineDto/CreateEvidenceInlineDto)
export interface SubjectPayload {
  fullName: string;
  dateOfBirth: string;
  gender?: string;
  idNumber: string;
  address: string;
  phone?: string;
  occupationId?: string;
  nationalityId?: string;
  wardId?: string;
  crimeId: string;
  type?: string;
  notes?: string;
}

export interface EvidencePayload {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  receivedDate?: string;
  status?: string;
  evidenceType?: string;
  entryOrder?: string;
  warehouseReceipt?: string;
}

export interface CreateCasePayload {
  name: string;
  crime: string | null;
  status?: string;
  deadline: string | null;
  unit: string | null;
  assignedTeamId: string | null;
  investigatorId: string | null;
  capDoToiPham?: string;
  caseProvenance: string;
  linkedPetitionId?: string;
  expectedPetitionUpdatedAt?: string;
  linkedIncidentId?: string;
  expectedIncidentUpdatedAt?: string;
  sourceDocumentNote?: string;
  // v0.44 UTDT fields (top-level columns)
  caseType?: string;
  donViGiao?: string;
  soQuyetDinhUyThac?: string;
  ngayTiepNhan?: string;
  thoiHanUyThac?: string;
  loaiUyThac?: string;
  ketQuaUyThac?: string;
  ngayTraKetQua?: string;
  loaiThongTin?: string;
  metadata: Record<string, unknown>;
  // PR 1 v0.38.0.0 — Atomic sub-entity arrays (fix bug data-loss)
  subjects?: SubjectPayload[];
  evidences?: EvidencePayload[];
  documentIds?: string[];
  statistic?: Record<string, unknown>; // case_statistics (hybrid)
  // Field-parity: KLĐT + QĐ điều tra lại
  soKLDT?: string;
  ngayKLDT?: string;
  soQDDieuTraLai?: string;
  ngayQDDieuTraLai?: string;
  // Field-parity: số QĐ giai đoạn vụ án
  soQuyetDinhKhoiTo?: string;
  soQDNhapVuAn?: string;
  ngayNhapVuAn?: string;
  ghiChuNhapHoSo?: string;
  soQDTachVuAn?: string;
  ngayTachVuAn?: string;
  soQDTachHanhVi?: string;
  ngayTachHanhVi?: string;
  soQDDinhChiVuAn?: string;
  ngayDinhChiVuAn?: string;
  chuyenVuAnChoCQK?: string;
  soBanAnCoHieuLuc?: string;
  ngayBanAnCoHieuLuc?: string;
  canCuTamDinhChiVuAn?: string;
  canCuPhucHoiVuAn?: string;
  // PR-3 — tab "Vụ án TĐC"
  soQuyetDinhTamDinhChi?: string;
  ngayTamDinhChi?: string;
  lyDoTamDinhChiVuAn?: string;
  ngayHetThoiHieu?: string;
  soQuyetDinhPhucHoi?: string;
  ngayPhucHoi?: string;
  tdcKhacPhucLyDoBienPhap?: string;
  tdcKhacPhucBienBan?: string;
}

/**
 * v0.37.2.3 — Build POST /cases payload from form state.
 * PR 1 v0.38.0.0 — Wire subjects[]/evidences[]/documentIds[] arrays
 *
 * Top-level provenance fields are REQUIRED by backend DTO. Conditional FK +
 * optimistic-lock fields included only when source type matches.
 *
 * Sub-entity arrays passed thẳng từ component local state. Backend create
 * tất cả trong cùng prisma.$transaction để fix bug mất dữ liệu wizard
 * "Khởi tố vụ án mới".
 */
export function buildCreateCasePayload(
  formData: CaseFormData,
  options?: {
    subjects?: Subject[];
    evidences?: Evidence[];
    documentIds?: string[];
  },
): CreateCasePayload {
  const payload: CreateCasePayload = {
    name: formData.caseTitle,
    crime: formData.criminalType || null,
    status: formData.status || undefined,
    deadline: formData.investigationDeadline || null,
    unit: formData.supervisingUnit || null,
    assignedTeamId: formData.assignedTeamId || null,
    investigatorId: formData.handler || null,
    capDoToiPham: formData.capDoToiPham || undefined,
    caseProvenance: formData.caseProvenance,
    metadata: {
      caseCode: formData.caseCode,
      receiveDate: formData.receiveDate,
      receiveTime: formData.receiveTime,
      caseClassification: formData.caseClassification,
      priority: formData.priority,
      description: formData.description,
      investigationStartDate: formData.investigationStartDate,
      prosecutionOfficeAssigned: formData.prosecutionOfficeAssigned,
      relatedCaseCode: formData.relatedCaseCode,
      damageAmount: parseVND(formData.damageAmount) ?? undefined,
      damageDescription: formData.damageDescription,
      note: formData.note,
      reporter: formData.reporter,
      reporterIdNumber: formData.reporterIdNumber,
      reporterDateOfBirth: formData.reporterDateOfBirth,
      reporterGender: formData.reporterGender,
      reporterPhone: parsePhone(formData.reporterPhone) || undefined,
      reporterEmail: formData.reporterEmail,
      reporterAddress: formData.reporterAddress,
      reporterNationality: formData.reporterNationality,
      reporterOccupation: formData.reporterOccupation,
      reporterRelationToCase: formData.reporterRelationToCase,
      province: formData.province,
      district: formData.district,
      ward: formData.ward,
      specificAddress: formData.specificAddress,
      // ── Tab 2: Vụ việc (manual entry fields) ─────────────────────────────────
      incidentCode:        formData.incidentCode        || undefined,
      incidentDate:        formData.incidentDate        || undefined,
      incidentTime:        formData.incidentTime        || undefined,
      incidentLocation:    formData.incidentLocation    || undefined,
      incidentDescription: formData.incidentDescription || undefined,
      incidentType:        formData.incidentType        || undefined,
      incidentLevel:       formData.incidentLevel       || undefined,
      incidentCause:       formData.incidentCause       || undefined,
      incidentMethod:      formData.incidentMethod      || undefined,
      // ── Tab 3: Vụ án (criminalType already wired as top-level `crime`) ───────
      criminalCode:            formData.criminalCode            || undefined,
      criminalDate:            formData.criminalDate            || undefined,
      criminalLocation:        formData.criminalLocation        || undefined,
      criminalSecondaryType:   formData.criminalSecondaryType   || undefined,
      accusation:              formData.accusation              || undefined,
      prosecutionOffice:       formData.prosecutionOffice       || undefined,
      courtName:               formData.courtName               || undefined,
      courtHearingDate:        formData.courtHearingDate        || undefined,
      verdict:                 formData.verdict                 || undefined,
      sentence:                formData.sentence                || undefined,
      // ── Tab 5: Vụ việc TĐC ───────────────────────────────────────────────────
      tdcIncidentCode:  formData.tdcIncidentCode  || undefined,
      tdcSource:        formData.tdcSource        || undefined,
      tdcReceiveDate:   formData.tdcReceiveDate   || undefined,
      tdcContent:       formData.tdcContent       || undefined,
      tdcResult:        formData.tdcResult        || undefined,
      tdcTransferDate:  formData.tdcTransferDate  || undefined,
      // ── Tab 6: Vụ án TĐC ─────────────────────────────────────────────────────
      tdcCaseCode:          formData.tdcCaseCode          || undefined,
      tdcCaseType:          formData.tdcCaseType          || undefined,
      tdcProcessingResult:  formData.tdcProcessingResult  || undefined,
      tdcClosedDate:        formData.tdcClosedDate        || undefined,
      // ── Tab 9: Thống kê 48 trường ─────────────────────────────────────────────
      stat_sourceType:            formData.stat_sourceType            || undefined,
      stat_sourceOrigin:          formData.stat_sourceOrigin          || undefined,
      stat_informantType:         formData.stat_informantType         || undefined,
      stat_receiveMethod:         formData.stat_receiveMethod         || undefined,
      stat_urgencyLevel:          formData.stat_urgencyLevel          || undefined,
      stat_reportingUnit:         formData.stat_reportingUnit         || undefined,
      stat_incidentDate:          formData.stat_incidentDate          || undefined,
      stat_incidentTime:          formData.stat_incidentTime          || undefined,
      stat_incidentProvince:      formData.stat_incidentProvince      || undefined,
      stat_incidentDistrict:      formData.stat_incidentDistrict      || undefined,
      stat_incidentWard:          formData.stat_incidentWard          || undefined,
      stat_initialClassification: formData.stat_initialClassification || undefined,
      stat_primaryCrime:          formData.stat_primaryCrime          || undefined,
      stat_secondaryCrime:        formData.stat_secondaryCrime        || undefined,
      stat_crimeField:            formData.stat_crimeField            || undefined,
      stat_crimeMethod:           formData.stat_crimeMethod           || undefined,
      stat_damageAmount:          formData.stat_damageAmount          || undefined,
      stat_recoveredAmount:       formData.stat_recoveredAmount       || undefined,
      stat_victimCount:           formData.stat_victimCount           || undefined,
      stat_deathCount:            formData.stat_deathCount            || undefined,
      stat_injuryCount:           formData.stat_injuryCount           || undefined,
      stat_propertyDamage:        formData.stat_propertyDamage        || undefined,
      stat_organizedCrime:        formData.stat_organizedCrime        || undefined,
      stat_repeatOffender:        formData.stat_repeatOffender        || undefined,
      stat_suspectCount:          formData.stat_suspectCount          || undefined,
      stat_suspectArrested:       formData.stat_suspectArrested       || undefined,
      stat_suspectDetained:       formData.stat_suspectDetained       || undefined,
      stat_suspectGender:         formData.stat_suspectGender         || undefined,
      stat_suspectAge:            formData.stat_suspectAge            || undefined,
      stat_suspectEthnicity:      formData.stat_suspectEthnicity      || undefined,
      stat_suspectNationality:    formData.stat_suspectNationality    || undefined,
      stat_suspectOccupation:     formData.stat_suspectOccupation     || undefined,
      stat_suspectEducation:      formData.stat_suspectEducation      || undefined,
      stat_suspectCriminalRecord: formData.stat_suspectCriminalRecord || undefined,
      stat_suspectDrugRelated:    formData.stat_suspectDrugRelated    || undefined,
      stat_suspectWeaponUsed:     formData.stat_suspectWeaponUsed     || undefined,
      stat_processingStatus:      formData.stat_processingStatus      || undefined,
      stat_investigationResult:   formData.stat_investigationResult   || undefined,
      stat_prosecutionResult:     formData.stat_prosecutionResult     || undefined,
      stat_trialResult:           formData.stat_trialResult           || undefined,
      stat_sentencingResult:      formData.stat_sentencingResult      || undefined,
      stat_closedDate:            formData.stat_closedDate            || undefined,
      stat_processingDays:        formData.stat_processingDays        || undefined,
      stat_evidenceCollected:     formData.stat_evidenceCollected     || undefined,
      stat_witnessCount:          formData.stat_witnessCount          || undefined,
      stat_propertySeized:        formData.stat_propertySeized        || undefined,
      stat_caseTransferred:       formData.stat_caseTransferred       || undefined,
      stat_reportSubmitted:       formData.stat_reportSubmitted       || undefined,
    },
  };

  if (formData.caseProvenance === 'FROM_PETITION') {
    payload.linkedPetitionId = formData.linkedPetitionId;
    if (formData.expectedPetitionUpdatedAt) {
      payload.expectedPetitionUpdatedAt = formData.expectedPetitionUpdatedAt;
    }
  } else if (formData.caseProvenance === 'FROM_INCIDENT') {
    payload.linkedIncidentId = formData.linkedIncidentId;
    if (formData.expectedIncidentUpdatedAt) {
      payload.expectedIncidentUpdatedAt = formData.expectedIncidentUpdatedAt;
    }
  } else if (formData.caseProvenance === 'UY_THAC_DIEU_TRA') {
    // v0.44 UTDT: wire top-level columns + caseType
    if (!formData.utdt_donViGiao?.trim()) {
      throw new Error('Đơn vị giao ủy thác là bắt buộc');
    }
    payload.caseType = 'UY_THAC_DIEU_TRA';
    if (formData.utdt_donViGiao)         payload.donViGiao = formData.utdt_donViGiao;
    if (formData.utdt_soQuyetDinhUyThac) payload.soQuyetDinhUyThac = formData.utdt_soQuyetDinhUyThac;
    if (formData.utdt_ngayTiepNhan)      payload.ngayTiepNhan = formData.utdt_ngayTiepNhan;
    if (formData.utdt_thoiHanUyThac)     payload.thoiHanUyThac = formData.utdt_thoiHanUyThac;
    if (formData.utdt_loaiUyThac)        payload.loaiUyThac = formData.utdt_loaiUyThac;
    if (formData.utdt_ketQuaUyThac)      payload.ketQuaUyThac = formData.utdt_ketQuaUyThac;
    if (formData.utdt_ngayTraKetQua)     payload.ngayTraKetQua = formData.utdt_ngayTraKetQua;
    if (formData.utdt_loaiThongTin)      payload.loaiThongTin = formData.utdt_loaiThongTin;
    // Store additional UTDT metadata fields
    if (formData.utdt_nghiVanDoiTuong)               payload.metadata.nghiVanDoiTuong = formData.utdt_nghiVanDoiTuong;
    if (formData.utdt_lyDoKhongThucHienDuoc)         payload.metadata.lyDoKhongThucHienDuoc = formData.utdt_lyDoKhongThucHienDuoc;
    if (formData.utdt_ngayThongBaoKhongThucHien)     payload.metadata.ngayThongBaoKhongThucHien = formData.utdt_ngayThongBaoKhongThucHien;
  } else if (formData.sourceDocumentNote) {
    payload.sourceDocumentNote = formData.sourceDocumentNote;
  }

  // Field-parity: KLĐT + QĐ điều tra lại
  if (formData.soKLDT)           payload.soKLDT = formData.soKLDT;
  if (formData.ngayKLDT)         payload.ngayKLDT = formData.ngayKLDT;
  if (formData.soQDDieuTraLai)   payload.soQDDieuTraLai = formData.soQDDieuTraLai;
  if (formData.ngayQDDieuTraLai) payload.ngayQDDieuTraLai = formData.ngayQDDieuTraLai;
  // Field-parity: số QĐ giai đoạn vụ án
  if (formData.soQuyetDinhKhoiTo)   payload.soQuyetDinhKhoiTo = formData.soQuyetDinhKhoiTo;
  if (formData.soQDNhapVuAn)        payload.soQDNhapVuAn = formData.soQDNhapVuAn;
  if (formData.ngayNhapVuAn)        payload.ngayNhapVuAn = formData.ngayNhapVuAn;
  if (formData.ghiChuNhapHoSo)      payload.ghiChuNhapHoSo = formData.ghiChuNhapHoSo;
  if (formData.soQDTachVuAn)        payload.soQDTachVuAn = formData.soQDTachVuAn;
  if (formData.ngayTachVuAn)        payload.ngayTachVuAn = formData.ngayTachVuAn;
  if (formData.soQDTachHanhVi)      payload.soQDTachHanhVi = formData.soQDTachHanhVi;
  if (formData.ngayTachHanhVi)      payload.ngayTachHanhVi = formData.ngayTachHanhVi;
  if (formData.soQDDinhChiVuAn)     payload.soQDDinhChiVuAn = formData.soQDDinhChiVuAn;
  if (formData.ngayDinhChiVuAn)     payload.ngayDinhChiVuAn = formData.ngayDinhChiVuAn;
  if (formData.chuyenVuAnChoCQK)    payload.chuyenVuAnChoCQK = formData.chuyenVuAnChoCQK;
  if (formData.soBanAnCoHieuLuc)    payload.soBanAnCoHieuLuc = formData.soBanAnCoHieuLuc;
  if (formData.ngayBanAnCoHieuLuc)  payload.ngayBanAnCoHieuLuc = formData.ngayBanAnCoHieuLuc;
  if (formData.canCuTamDinhChiVuAn) payload.canCuTamDinhChiVuAn = formData.canCuTamDinhChiVuAn;
  if (formData.canCuPhucHoiVuAn)    payload.canCuPhucHoiVuAn = formData.canCuPhucHoiVuAn;
  // PR-3 — tab "Vụ án TĐC" (chỉ gửi khi có giá trị; tránh ghi đè workflow auto-set)
  if (formData.soQuyetDinhTamDinhChi)   payload.soQuyetDinhTamDinhChi = formData.soQuyetDinhTamDinhChi;
  if (formData.ngayTamDinhChi)          payload.ngayTamDinhChi = formData.ngayTamDinhChi;
  if (formData.lyDoTamDinhChiVuAn)      payload.lyDoTamDinhChiVuAn = formData.lyDoTamDinhChiVuAn;
  if (formData.ngayHetThoiHieu)         payload.ngayHetThoiHieu = formData.ngayHetThoiHieu;
  if (formData.soQuyetDinhPhucHoi)      payload.soQuyetDinhPhucHoi = formData.soQuyetDinhPhucHoi;
  if (formData.ngayPhucHoi)             payload.ngayPhucHoi = formData.ngayPhucHoi;
  if (formData.tdcKhacPhucLyDoBienPhap) payload.tdcKhacPhucLyDoBienPhap = formData.tdcKhacPhucLyDoBienPhap;
  if (formData.tdcKhacPhucBienBan)      payload.tdcKhacPhucBienBan = formData.tdcKhacPhucBienBan;
  // PR-M2: ghi chú tự do + tội danh khác (multi)
  if (formData.ghiChuKhac)                       payload.ghiChuKhac = formData.ghiChuKhac;
  if (formData.toiDanhKhacIds && formData.toiDanhKhacIds.length > 0) payload.toiDanhKhacIds = formData.toiDanhKhacIds;

  // PR 1 v0.38.0.0 — Wire sub-entity arrays vào payload (atomic create)
  // HOTFIX (codex P1 post-merge): chỉ include subjects với crimeId hợp lệ +
  // skip "Luật sư" (LAWYER không tồn tại trong Prisma SubjectType enum).
  // Lawyers nên submit qua separate Lawyer model API trong future PR.
  // Regression tested: buildCreateCasePayload.test.ts hotfix #112 describe block.
  if (options?.subjects && options.subjects.length > 0) {
    const validSubjects = options.subjects
      .filter((s) => s.type !== 'Luật sư') // LAWYER không có trong SubjectType
      .map((s) => {
        const crimeId = (s as Subject & { crimeId?: string }).crimeId;
        return { s, crimeId };
      })
      .filter(({ crimeId }) => crimeId && crimeId.length > 0); // Skip nếu thiếu crimeId

    if (validSubjects.length > 0) {
      payload.subjects = validSubjects.map(({ s, crimeId }) => ({
        fullName: s.name,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        idNumber: s.idNumber,
        address: s.address,
        phone: s.phone ? parsePhone(s.phone) : undefined,
        occupationId: s.occupation,
        nationalityId: s.nationality,
        crimeId: crimeId as string,
        type: subjectTypeToEnum(s.type),
        notes: s.criminalRecord,
      }));
    }
  }

  if (options?.evidences && options.evidences.length > 0) {
    payload.evidences = options.evidences.map((e) => ({
      code: e.code,
      name: e.name,
      description: e.description,
      quantity: e.quantity,
      unit: e.unit,
      storageLocation: e.storageLocation,
      receivedDate: e.receivedDate,
      status: e.status,
      evidenceType: e.evidenceType,
      entryOrder: e.entryOrder,
      warehouseReceipt: e.warehouseReceipt,
    }));
  }

  // HOTFIX: documentIds disabled — MediaFile.id local-only ("MF-${Date.now()}"),
  // file chưa được upload to backend. Linking fake IDs sẽ throw 400.
  // Future PR cần: 1) actual upload trên handleUploadMedia, 2) lưu real Document.id
  // vào MediaFile state. Regression tested: buildCreateCasePayload.test.ts.
  // if (options?.documentIds && options.documentIds.length > 0) {
  //   payload.documentIds = options.documentIds;
  // }

  // Thống kê mở rộng (hybrid) → payload.statistic (case_statistics). Chỉ gửi key có giá trị.
  const stat = buildStatisticPayload(formData.statistic);
  if (Object.keys(stat).length > 0) payload.statistic = stat;

  return payload;
}

// Form CaseStatisticForm → object cho backend: số string→number, bool giữ nguyên, ngày string giữ nguyên.
const STAT_NUM_FIELDS = new Set([
  'tongSoBienBanGhiLoiKhai', 'soBienBanGhiLoiKhaiCoGhiAm', 'tongSoBienBanHoiCung',
  'tongSoBienBanHoiCungCoGhiAm', 'soBiCanCoGhiAm', 'soBiCanVksYeuCauGhiAm', 'soDoiTuongVPHC',
  'soNguoiBiPhatTien', 'tongTienPhatHanhChinh', 'soDoiTuong', 'soDoiTuongDaBat', 'soDoiTuongBiBatVuAnKhac',
  'dieuTraMoRong', 'soBangNhom', 'soBangNhomBatDuoc', 'soSungThuHoi', 'soThuocNoThuHoi', 'soDoiTuongSuuTraHiemNghi',
  'soLuongBiHai', 'soNguoiBiThuong', 'soLuongNguoiChet', 'soTienBiThietHai', 'soTienThuHoi',
]);
const STAT_BOOL_FIELDS = new Set([
  'coGhiAmGhiHinh', 'laVuAnGhiAmGhiHinh', 'vksYeuCauGhiAm', 'coVPHC', 'coBangNhom', 'vuAnDaDuocXetXu',
  // PR-M2: 3 cờ xét-xử riêng
  'ghiAmGhiHinhDaDuocXetXu', 'coSuDungKQGhiAmTrongXetXu', 'khongGAGHNhungToaYeuCau',
]);

export function buildStatisticPayload(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (STAT_BOOL_FIELDS.has(k)) {
      if (v === true) out[k] = true; // chỉ gửi khi true (mặc định false ở DB)
    } else if (STAT_NUM_FIELDS.has(k)) {
      if (v !== '' && v != null) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[k] = n;
      }
    } else if (v !== '' && v != null) {
      out[k] = v; // text/ngày
    }
  }
  return out;
}

// Map frontend Subject.type ("Bị can"/"Bị hại"/...) → Prisma SubjectType enum
// HOTFIX #112: LAWYER removed — Prisma SubjectType chỉ có SUSPECT/VICTIM/WITNESS.
// Lawyers filtered out trước khi mapping ở caller.
// Regression tested: buildCreateCasePayload.test.ts hotfix #112 describe block.
function subjectTypeToEnum(uiType: string): string {
  switch (uiType) {
    case 'Bị can':
      return 'SUSPECT';
    case 'Bị hại':
      return 'VICTIM';
    case 'Nhân chứng':
      return 'WITNESS';
    default:
      return 'SUSPECT';
  }
}
