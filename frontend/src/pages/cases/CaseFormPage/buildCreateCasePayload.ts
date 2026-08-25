import type { CaseFormData, Subject, Evidence } from './types';
import { parseVND, parsePhone } from '../../../shared/utils/formatters';

// PR 1 v0.38.0.0 — Sub-entity inline DTOs (match backend CreateSubjectInlineDto/CreateEvidenceInlineDto)
export interface SubjectPayload {
  fullName: string;
  /** Tuỳ chọn: lược đồ cho phép trống — dữ liệu cũ nhiều đối tượng chỉ có tên. */
  dateOfBirth?: string;
  gender?: string;
  idNumber?: string;
  address?: string;
  phone?: string;
  occupationId?: string;
  nationalityId?: string;
  wardId?: string;
  /** Tuỳ chọn: nhân chứng và bị hại không cần tội danh (đúng theo `create-case.dto.ts`). */
  crimeId?: string;
  type?: string;
  notes?: string;
}

export interface EvidencePayload {
  code: string;
  name: string;
  description?: string;
  nguonDon?: string;
  nhanXet?: string;
  biHai?: string;
  noiXayRa?: string;
  nghiVanDoiTuong?: string;
  phuongThucThuDoan?: string;
  ketQuaXuLyKhac?: string;
  soPhieuChuyen?: string;
  dieuTraVienText?: string;
  sttCu?: string;
  tinhTrang?: string;
  phanLoaiToiPhamLinhVuc?: string;
  deXuatXuLy?: string;
  yeuCauBoSung?: string;
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
  // Chỉ mục chuỗi: payload này còn được đọc theo tên ô trong ca kiểm "điền kín mọi ô rồi
  // lưu". Không có nó thì ca kiểm ấy phải ép kiểu qua `unknown`, và ép kiểu là đúng thứ
  // che mất lỗi mà nó sinh ra để bắt.
  [key: string]: unknown;
  name: string;
  crime: string | null;
  crimeChinhId?: string | null;
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
  // ── Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) ──
  phanLoaiNguonTinBanDau?: string;
  ngayXayRa?: string;
  noiXayRaPhuongXa?: string;
  baoCaoBanGiamDocText?: string;
  baoCaoBanGiamDoc?: boolean;
  soQDPhanCongNguonTin?: string;
  ngayQDPhanCongNguonTin?: string;
  soQDKhongKhoiTo?: string;
  ngayQDKhongKhoiTo?: string;
  canCuKhongKhoiTo?: string;
  lyDoKhongKhoiTo?: string[];
  chuyenVuViecDonViKhac?: string;
  nhapVaoVuViecSo?: string;
  phanLoaiDanSu?: string;
  vuViecTamDungTruoc2015?: boolean;
  soQDTamDinhChiNguonTin?: string;
  ngayQDTamDinhChiNguonTin?: string;
  canCuTamDinhChiNguonTin?: string;
  lyDoTamDinhChiNguonTin?: string[];
  ngayHetThoiHieuVuViec?: string;
  khacPhucLyDoTDCVuViec?: string;
  tienDoKhacPhucTDCVuViec?: string;
  soPhucHoiNguonTin?: string;
  ngayPhucHoiNguonTin?: string;
  vatChungMoTa?: string;
  lenhNhapKho?: string;
  noiLuuTruBaoQuan?: string;
  toiDanhChinhKhoiToId?: string;
  laCongNgheCao?: boolean;
  soHoSoCu?: string;
  ngayDeXuat?: string;
  ngayPhieuChuyen?: string;
  doVatTaiLieuKemTheo?: string;
  ngayVietDon?: string;
  ghiChuTrungDon?: string;
  ngayGiaoDonViGiaiQuyet?: string;
  lanhDaoToTung?: string;
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
  // Field-parity: ghi chú khác + tội danh khác (donthu-parity)
  ghiChuKhac?: string;
  toiDanhKhacIds?: string[];
  // Field-parity: KLĐT + QĐ điều tra lại
  soKLDT?: string;
  ngayKLDT?: string;
  soQDDieuTraLai?: string;
  ngayQDDieuTraLai?: string;
  // Field-parity: số QĐ giai đoạn vụ án
  soQuyetDinhKhoiTo?: string;
  ngayKhoiTo?: string;
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
  lyDoTamDinhChiVuAn?: string[];
  ngayHetThoiHieu?: string;
  soQuyetDinhPhucHoi?: string;
  ngayPhucHoi?: string;
  tdcKhacPhucLyDoBienPhap?: string;
  tdcKhacPhucBienBan?: string;

  // ── Consolidate epic: field promoted → cột typed (top-level, backend map→cột) ──
  tenCungCap?: string;
  cccdCungCap?: string;
  sdtCungCap?: string;
  diaChiCungCap?: string;
  moTaChiTiet?: string;
  nguonDon?: string;
  noiXayRa?: string;
  nghiVanDoiTuong?: string;
  nhanXet?: string;
  phuongThucThuDoan?: string;
  ketQuaXuLyKhac?: string;
  soPhieuChuyen?: string;
  ngayCapCccd?: string;
  noiCapCccd?: string;
  phanLoaiToiPhamLinhVuc?: string;
  yeuCauBoSung?: string;
  sttCu?: string;
  deXuat?: string;
  dieuTraVien?: string;
  reporterDateOfBirth?: string;
  reporterDateOfBirthPrecision?: string;
  receiveDate?: string;
  caseClassification?: string;
  tinhTrang?: string;
  toiDanhBanDau?: string;
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
    legacyMetadata?: Record<string, unknown>;
    /**
     * Gọi lại khi một mục trong danh sách đối tượng KHÔNG gửi lên được.
     *
     * Loại bỏ im lặng là cách chắc chắn nhất để dữ liệu biến mất mà không ai biết. Nơi gọi
     * dùng gọi lại này để báo cho cán bộ ngay tại màn hình.
     */
    onSubjectBiLoai?: (ten: string, lyDo: string) => void;
  },
): CreateCasePayload {
  const payload: CreateCasePayload = {
    name: formData.caseTitle,
    crime: formData.criminalType || null,
    crimeChinhId: formData.crimeChinhId || null, // FK master Crime — tội danh chính
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
      nguonDon: formData.nguonDon || undefined,
      nhanXet: formData.nhanXet || undefined,
      biHai: formData.biHai || undefined,
      noiXayRa: formData.noiXayRa || undefined,
      nghiVanDoiTuong: formData.nghiVanDoiTuong || undefined,
      phuongThucThuDoan: formData.phuongThucThuDoan || undefined,
      ketQuaXuLyKhac: formData.ketQuaXuLyKhac || undefined,
      soPhieuChuyen: formData.soPhieuChuyen || undefined,
      dieuTraVienText: formData.dieuTraVienText || undefined,
      sttCu: formData.sttCu || undefined,
      tenCungCap: formData.tenCungCap || undefined,
      sinhNamCungCap: formData.sinhNamCungCap || undefined,
      cccdCungCap: formData.cccdCungCap || undefined,
      ngayCapCccd: formData.ngayCapCccd || undefined,
      noiCapCccd: formData.noiCapCccd || undefined,
      sdtCungCap: formData.sdtCungCap || undefined,
      tinhTrang: formData.tinhTrang || undefined,
      phanLoaiToiPhamLinhVuc: formData.phanLoaiToiPhamLinhVuc || undefined,
      deXuatXuLy: formData.deXuatXuLy || undefined,
      yeuCauBoSung: formData.yeuCauBoSung || undefined,
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
  if (formData.ngayKhoiTo)          payload.ngayKhoiTo = formData.ngayKhoiTo;
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
  if (formData.lyDoTamDinhChiVuAn && formData.lyDoTamDinhChiVuAn.length > 0) payload.lyDoTamDinhChiVuAn = formData.lyDoTamDinhChiVuAn;
  if (formData.ngayHetThoiHieu)         payload.ngayHetThoiHieu = formData.ngayHetThoiHieu;
  if (formData.soQuyetDinhPhucHoi)      payload.soQuyetDinhPhucHoi = formData.soQuyetDinhPhucHoi;
  if (formData.ngayPhucHoi)             payload.ngayPhucHoi = formData.ngayPhucHoi;
  if (formData.tdcKhacPhucLyDoBienPhap) payload.tdcKhacPhucLyDoBienPhap = formData.tdcKhacPhucLyDoBienPhap;
  if (formData.tdcKhacPhucBienBan)      payload.tdcKhacPhucBienBan = formData.tdcKhacPhucBienBan;
  // PR-M2: ghi chú tự do + tội danh khác (multi)
  if (formData.ghiChuKhac)                       payload.ghiChuKhac = formData.ghiChuKhac;
  if (formData.toiDanhKhacIds && formData.toiDanhKhacIds.length > 0) payload.toiDanhKhacIds = formData.toiDanhKhacIds;

  // PR 1 v0.38.0.0 — Wire sub-entity arrays vào payload (atomic create)
  //
  // 26/08/2026 — GỠ bộ lọc `crimeId`. Hộp thoại thêm đối tượng KHÔNG có ô tội danh, nên
  // không đối tượng nào từng mang `crimeId`; bộ lọc ấy loại sạch mọi đối tượng cán bộ vừa
  // nhập, mà màn hình vẫn báo lưu thành công. Máy chủ vốn khai `crimeId` là tuỳ chọn —
  // nhân chứng và bị hại không cần tội danh — nên bộ lọc chặn nhầm ngay từ đầu.
  //
  // "Luật sư" vẫn phải loại: bảng Subject của máy chủ chỉ có ba loại (bị can, bị hại, nhân
  // chứng), gửi lên là 400 và hỏng cả lần lưu. Nhưng loại thì phải BÁO LẠI, vì hộp thoại
  // vẫn cho chọn "Luật sư".
  if (options?.subjects && options.subjects.length > 0) {
    const duocGiu = options.subjects.filter((s) => {
      if (s.type === 'Luật sư') {
        options.onSubjectBiLoai?.(
          s.name,
          'Luật sư lưu ở danh sách luật sư, không thuộc danh sách đối tượng',
        );
        return false;
      }
      return true;
    });

    if (duocGiu.length > 0) {
      // Ô để trống phải BỎ HẲN khỏi payload, không gửi chuỗi rỗng: máy chủ dùng
      // `@IsOptional()`, mà `@IsOptional()` coi chuỗi rỗng là CÓ giá trị nên vẫn chạy tiếp
      // `@IsDateString()` và trả 400 — hỏng cả lần lưu vì một ô trống.
      const boRong = (v: string | undefined): string | undefined => {
        const t = (v ?? '').trim();
        return t === '' ? undefined : t;
      };
      payload.subjects = duocGiu.map((s) => {
        const crimeId = (s as Subject & { crimeId?: string }).crimeId;
        return {
          fullName: s.name,
          dateOfBirth: boRong(s.dateOfBirth),
          gender: boRong(s.gender),
          idNumber: boRong(s.idNumber),
          address: boRong(s.address),
          phone: s.phone ? parsePhone(s.phone) : undefined,
          occupationId: boRong(s.occupation),
          nationalityId: boRong(s.nationality),
          ...(crimeId ? { crimeId } : {}),
          type: subjectTypeToEnum(s.type),
          notes: boRong(s.criminalRecord),
        };
      });
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
  const stat = buildStatisticPayload(formData.statistic as unknown as Record<string, unknown>);
  if (Object.keys(stat).length > 0) payload.statistic = stat;

  // ── Consolidate epic: field promoted → cột typed (TOP-LEVEL, backend map→cột) ──
  // Canonical = cột typed. Gửi từ form-key native (ưu tiên) → fallback key cũ hệ di trú.
  // metadata vẫn ghi (block trên) = dual-write an toàn cửa sổ chuyển tiếp; PR sau ngừng metadata.
  const firstStr = (...vals: unknown[]): string | undefined => {
    for (const v of vals) if (v != null && String(v).trim() !== '') return String(v).trim();
    return undefined;
  };
  payload.tenCungCap = firstStr(formData.reporter, formData.tenCungCap);
  payload.cccdCungCap = firstStr(formData.reporterIdNumber, formData.cccdCungCap);
  payload.sdtCungCap = firstStr(parsePhone(formData.reporterPhone), formData.sdtCungCap);
  // MỘT CỘT — MỘT Ô. Ô "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại" ở tab Thông tin
  // là chủ cột `diaChiCungCap`; ô "Địa chỉ thường trú" trong khối Bổ sung hệ mới đã gỡ đi
  // (xem tabs.tsx). Trước đây hai ô cùng ghi cột này và ô hệ cũ luôn thắng, nên ô kia trở
  // thành ô gõ vào không có tác dụng — tệ hơn là không có ô.
  payload.diaChiCungCap = firstStr(formData.diaChiCungCap);
  payload.moTaChiTiet = firstStr(formData.description);
  payload.noiXayRa = firstStr(formData.noiXayRa, formData.specificAddress);
  payload.nguonDon = firstStr(formData.nguonDon);
  payload.nghiVanDoiTuong = firstStr(formData.nghiVanDoiTuong);
  payload.nhanXet = firstStr(formData.nhanXet);
  payload.phuongThucThuDoan = firstStr(formData.phuongThucThuDoan);
  payload.ketQuaXuLyKhac = firstStr(formData.ketQuaXuLyKhac);
  payload.soPhieuChuyen = firstStr(formData.soPhieuChuyen);
  payload.ngayCapCccd = firstStr(formData.ngayCapCccd);
  payload.noiCapCccd = firstStr(formData.noiCapCccd);
  payload.phanLoaiToiPhamLinhVuc = firstStr(formData.phanLoaiToiPhamLinhVuc);
  payload.yeuCauBoSung = firstStr(formData.yeuCauBoSung);
  payload.sttCu = firstStr(formData.sttCu);
  payload.deXuat = firstStr(formData.deXuatXuLy);
  payload.dieuTraVien = firstStr(formData.dieuTraVienText); // R7: text hệ cũ; handler(FK) riêng
  payload.receiveDate = firstStr(formData.receiveDate);
  payload.caseClassification = firstStr(formData.caseClassification);
  payload.tinhTrang = firstStr(formData.tinhTrang);
  payload.toiDanhBanDau = firstStr(formData.toiDanhBanDau);
  // reporterDateOfBirth: merge native date + sinhNamCungCap year-only → kiểu native (Date).
  // GIỮ ngữ nghĩa "năm-only": input là date (YYYY-MM-DD) không diễn đạt được năm-only, nên khi
  // load năm-only ta hiện YYYY-01-01 + precision='year'. Round-trip: nếu value vẫn là YYYY-01-01
  // và precision đã load = 'year' → giữ 'year' (không tự nâng thành 'date' làm sai nghĩa pháp lý).
  const dobRaw = firstStr(formData.reporterDateOfBirth, formData.sinhNamCungCap);
  if (dobRaw) {
    if (/^\d{4}$/.test(dobRaw)) {
      payload.reporterDateOfBirth = `${dobRaw}-01-01`;
      payload.reporterDateOfBirthPrecision = 'year';
    } else {
      payload.reporterDateOfBirth = dobRaw;
      const isJan1 = /^\d{4}-01-01$/.test(dobRaw);
      payload.reporterDateOfBirthPrecision =
        isJan1 && formData.reporterDateOfBirthPrecision === 'year' ? 'year' : 'date';
    }
  }
  // Damage → statistic (canonical case_statistics). Tab Thống kê (formData.statistic.soTienBiThietHai)
  // LÀ nguồn chính đã ghi cột từ trước. damageAmount CHỈ seed khi tab TRỐNG (không đè giá trị tab đã
  // sửa → tránh silent-loss codex P1). Vụ mới không có statistic → damageAmount điền.
  const damage = parseVND(formData.damageAmount);
  if (damage != null && stat['soTienBiThietHai'] == null) {
    payload.statistic = { ...(payload.statistic ?? {}), soTienBiThietHai: damage };
  }

  // ── Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) → cột typed, cấp trên cùng ──
  //
  // Chôn trong `metadata` thì bộ lọc, xuất Excel và ma trận đối chiếu di trú đều không thấy.
  // `firstStr` bỏ chuỗi rỗng, nên ô để trống không gửi lên và không đè giá trị đang có.
  payload.phanLoaiNguonTinBanDau = firstStr(formData.phanLoaiNguonTinBanDau);
  payload.ngayXayRa = firstStr(formData.ngayXayRa);
  payload.noiXayRaPhuongXa = firstStr(formData.noiXayRaPhuongXa);
  payload.soQDPhanCongNguonTin = firstStr(formData.soQDPhanCongNguonTin);
  payload.ngayQDPhanCongNguonTin = firstStr(formData.ngayQDPhanCongNguonTin);
  payload.soQDKhongKhoiTo = firstStr(formData.soQDKhongKhoiTo);
  payload.ngayQDKhongKhoiTo = firstStr(formData.ngayQDKhongKhoiTo);
  payload.canCuKhongKhoiTo = firstStr(formData.canCuKhongKhoiTo);
  payload.chuyenVuViecDonViKhac = firstStr(formData.chuyenVuViecDonViKhac);
  payload.nhapVaoVuViecSo = firstStr(formData.nhapVaoVuViecSo);
  payload.phanLoaiDanSu = firstStr(formData.phanLoaiDanSu);
  payload.soQDTamDinhChiNguonTin = firstStr(formData.soQDTamDinhChiNguonTin);
  payload.ngayQDTamDinhChiNguonTin = firstStr(formData.ngayQDTamDinhChiNguonTin);
  payload.canCuTamDinhChiNguonTin = firstStr(formData.canCuTamDinhChiNguonTin);
  payload.ngayHetThoiHieuVuViec = firstStr(formData.ngayHetThoiHieuVuViec);
  payload.khacPhucLyDoTDCVuViec = firstStr(formData.khacPhucLyDoTDCVuViec);
  payload.tienDoKhacPhucTDCVuViec = firstStr(formData.tienDoKhacPhucTDCVuViec);
  payload.soPhucHoiNguonTin = firstStr(formData.soPhucHoiNguonTin);
  payload.ngayPhucHoiNguonTin = firstStr(formData.ngayPhucHoiNguonTin);
  payload.vatChungMoTa = firstStr(formData.vatChungMoTa);
  payload.lenhNhapKho = firstStr(formData.lenhNhapKho);
  payload.noiLuuTruBaoQuan = firstStr(formData.noiLuuTruBaoQuan);
  payload.toiDanhChinhKhoiToId = firstStr(formData.toiDanhChinhKhoiToId);
  // Ô chọn nhiều: mảng rỗng là "đã bỏ chọn hết", khác `undefined` là "không nhắc tới".
  payload.lyDoKhongKhoiTo = formData.lyDoKhongKhoiTo ?? [];
  payload.lyDoTamDinhChiNguonTin = formData.lyDoTamDinhChiNguonTin ?? [];
  payload.vuViecTamDungTruoc2015 = formData.vuViecTamDungTruoc2015 === true;
  // `soHoSoCu` trước nay hiện trên form nhưng KHÔNG có đường lên máy chủ: sửa xong là mất.
  //
  // `caseCode` thì KHÔNG gửi: ô ấy là số hiệu tự sinh (DocNumberPreviewField ở chế độ AUTO),
  // cán bộ không nhập tay. Gửi lên chỉ mở đường cho xung đột mã trùng mà không đổi lại điều
  // gì trên màn hình.
  payload.soHoSoCu = firstStr(formData.soHoSoCu);
  // "Trường hợp báo cáo Ban Giám đốc": hệ cũ là ô CHỮ, cột hệ mới là ĐÚNG/SAI (di trú suy từ
  // chữ). Gửi cả hai — mất chữ là mất chỉ đạo của Ban Giám đốc, 34.931 hồ sơ đang có nội dung.
  // Nhóm ô trước nay chỉ hiện ở panel "Thông tin nghiệp vụ bổ sung" cuối trang (và ghi qua
  // `parityState`), nay đã về đúng vị trí trong tab nên phải tự đi lên máy chủ.
  payload.ngayDeXuat = firstStr(formData.ngayDeXuat);
  // Hai ô này cũng theo luật MỘT CỘT — MỘT Ô: tab Thông tin là chủ, tab Ủy thác đã gỡ ô
  // trùng (xem CaseFormTab1UyThac.tsx).
  payload.loaiThongTin = firstStr(formData.loaiThongTin);
  payload.ngayPhieuChuyen = firstStr(formData.ngayPhieuChuyen);
  payload.ngayTiepNhan = firstStr(formData.ngayTiepNhanNguonTin);
  payload.thoiHanUyThac = firstStr(formData.utdt_thoiHanUyThac);
  payload.doVatTaiLieuKemTheo = firstStr(formData.doVatTaiLieuKemTheo);
  payload.ngayVietDon = firstStr(formData.ngayVietDon);
  payload.ghiChuTrungDon = firstStr(formData.ghiChuTrungDon);
  payload.ngayGiaoDonViGiaiQuyet = firstStr(formData.ngayGiaoDonViGiaiQuyet);
  payload.lanhDaoToTung = firstStr(formData.lanhDaoToTung);
  payload.laCongNgheCao = formData.laCongNgheCao === true;

  // CHỈ gửi khi ô có nội dung. Gửi `false` mỗi lần lưu sẽ biến cột `Boolean?` từ NULL
  // ("chưa xác định") thành `false` cho mọi hồ sơ chưa kịp bù cột chữ — tự tay xoá thông
  // tin mà không ai yêu cầu.
  const baoCao = firstStr(formData.baoCaoBanGiamDoc);
  if (baoCao != null) {
    payload.baoCaoBanGiamDocText = baoCao;
    payload.baoCaoBanGiamDoc = true;
  }

  // Gộp trường hệ cũ động (editable): field form/utdt THẮNG (ghi sau); giữ phần còn lại của legacy.
  // Backend còn MERGE lần nữa với metadata trong DB → không mất field nào.
  if (options?.legacyMetadata) {
    payload.metadata = { ...options.legacyMetadata, ...payload.metadata };
  }
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
