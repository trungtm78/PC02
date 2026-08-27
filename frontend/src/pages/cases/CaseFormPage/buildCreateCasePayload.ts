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
  /** Đơn vị GIẢI QUYẾT (`don_vi_giai_quyet` hệ cũ) — khác `unit` = đơn vị tiếp nhận. */
  donViGiaiQuyet: string | null;
  assignedTeamId: string | null;
  investigatorId: string | null;
  capDoToiPham?: string | null;
  caseProvenance: string;
  linkedPetitionId?: string;
  expectedPetitionUpdatedAt?: string;
  linkedIncidentId?: string;
  expectedIncidentUpdatedAt?: string;
  sourceDocumentNote?: string;
  // ── Ô hệ cũ đưa về đúng vị trí trên form (26/08/2026) ──
  phanLoaiNguonTinBanDau?: string | null;
  ngayXayRa?: string | null;
  noiXayRaPhuongXa?: string | null;
  baoCaoBanGiamDocText?: string | null;
  baoCaoBanGiamDoc?: boolean | null;
  soQDPhanCongNguonTin?: string | null;
  ngayQDPhanCongNguonTin?: string | null;
  soQDKhongKhoiTo?: string | null;
  ngayQDKhongKhoiTo?: string | null;
  canCuKhongKhoiTo?: string | null;
  lyDoKhongKhoiTo?: string[] | null;
  chuyenVuViecDonViKhac?: string | null;
  nhapVaoVuViecSo?: string | null;
  phanLoaiDanSu?: string | null;
  vuViecTamDungTruoc2015?: boolean | null;
  soQDTamDinhChiNguonTin?: string | null;
  ngayQDTamDinhChiNguonTin?: string | null;
  canCuTamDinhChiNguonTin?: string | null;
  lyDoTamDinhChiNguonTin?: string[] | null;
  ngayHetThoiHieuVuViec?: string | null;
  khacPhucLyDoTDCVuViec?: string | null;
  tienDoKhacPhucTDCVuViec?: string | null;
  soPhucHoiNguonTin?: string | null;
  ngayPhucHoiNguonTin?: string | null;
  vatChungMoTa?: string | null;
  lenhNhapKho?: string | null;
  noiLuuTruBaoQuan?: string | null;
  toiDanhChinhKhoiToId?: string | null;
  laCongNgheCao?: boolean | null;
  soHoSoCu?: string | null;
  ngayDeXuat?: string | null;
  ngayPhieuChuyen?: string | null;
  doVatTaiLieuKemTheo?: string | null;
  ngayVietDon?: string | null;
  ghiChuTrungDon?: string | null;
  ngayGiaoDonViGiaiQuyet?: string | null;
  lanhDaoToTung?: string | null;
  // v0.44 UTDT fields (top-level columns)
  caseType?: string;
  donViGiao?: string | null;
  soQuyetDinhUyThac?: string | null;
  ngayTiepNhan?: string | null;
  thoiHanUyThac?: string | null;
  loaiUyThac?: string | null;
  ketQuaUyThac?: string | null;
  ngayTraKetQua?: string | null;
  loaiThongTin?: string | null;
  metadata: Record<string, unknown>;
  // PR 1 v0.38.0.0 — Atomic sub-entity arrays (fix bug data-loss)
  subjects?: SubjectPayload[];
  evidences?: EvidencePayload[];
  documentIds?: string[];
  statistic?: Record<string, unknown>; // case_statistics (hybrid)
  // Field-parity: ghi chú khác + tội danh khác (donthu-parity)
  ghiChuKhac?: string | null;
  toiDanhKhacIds?: string[];
  // Field-parity: KLĐT + QĐ điều tra lại
  soKLDT?: string | null;
  ngayKLDT?: string | null;
  soQDDieuTraLai?: string | null;
  ngayQDDieuTraLai?: string | null;
  // Field-parity: số QĐ giai đoạn vụ án
  soQuyetDinhKhoiTo?: string | null;
  ngayKhoiTo?: string | null;
  soQDNhapVuAn?: string | null;
  ngayNhapVuAn?: string | null;
  ghiChuNhapHoSo?: string | null;
  soQDTachVuAn?: string | null;
  ngayTachVuAn?: string | null;
  soQDTachHanhVi?: string | null;
  ngayTachHanhVi?: string | null;
  soQDDinhChiVuAn?: string | null;
  ngayDinhChiVuAn?: string | null;
  chuyenVuAnChoCQK?: string | null;
  soBanAnCoHieuLuc?: string | null;
  ngayBanAnCoHieuLuc?: string | null;
  canCuTamDinhChiVuAn?: string | null;
  canCuPhucHoiVuAn?: string | null;
  // PR-3 — tab "Vụ án TĐC"
  soQuyetDinhTamDinhChi?: string | null;
  ngayTamDinhChi?: string | null;
  lyDoTamDinhChiVuAn?: string[];
  ngayHetThoiHieu?: string | null;
  soQuyetDinhPhucHoi?: string | null;
  ngayPhucHoi?: string | null;
  tdcKhacPhucLyDoBienPhap?: string | null;
  tdcKhacPhucBienBan?: string | null;

  // ── Consolidate epic: field promoted → cột typed (top-level, backend map→cột) ──
  tenCungCap?: string | null;
  cccdCungCap?: string | null;
  sinhNamCungCap?: string | null;
  sdtCungCap?: string | null;
  diaChiCungCap?: string | null;
  moTaChiTiet?: string | null;
  nguonDon?: string | null;
  noiXayRa?: string | null;
  nghiVanDoiTuong?: string | null;
  nhanXet?: string | null;
  phuongThucThuDoan?: string | null;
  ketQuaXuLyKhac?: string | null;
  soPhieuChuyen?: string | null;
  ngayCapCccd?: string | null;
  noiCapCccd?: string | null;
  phanLoaiToiPhamLinhVuc?: string;
  yeuCauBoSung?: string;
  sttCu?: string;
  deXuat?: string;
  dieuTraVien?: string | null;
  reporterDateOfBirth?: string | null;
  reporterDateOfBirthPrecision?: string;
  receiveDate?: string;
  caseClassification?: string;
  tinhTrang?: string;
  toiDanhBanDau?: string | null;
}

/**
 * Giá trị cho ô hệ cũ: chuỗi đã cắt khoảng trắng, hoặc `null` khi cán bộ XOÁ TRẮNG ô.
 *
 * Máy chủ chỉ ghi những khoá CÓ MẶT trong lời gọi, nên bỏ ô rỗng khỏi payload biến thao tác
 * xoá thành thao tác không có tác dụng: báo thành công, mở lại vẫn thấy giá trị cũ. `null` đi
 * qua `@IsOptional()` (nó bỏ qua cả null lẫn undefined) và được ghi thành NULL.
 *
 * Khai ở tầng mô-đun vì nhiều câu lệnh gán nằm TRƯỚC chỗ khai cũ trong thân hàm — hằng `const`
 * chưa khởi tạo thì gọi là lỗi lúc chạy, không phải lúc dịch.
 */
export const oHeCu = (v: unknown): string | null => {
  const t = v == null ? '' : String(v).trim();
  return t === '' ? null : t;
};

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
    // Ô "Đơn vị giải quyết" ghi vào `donViGiaiQuyet`, KHÔNG phải `unit` — `unit` là
    // ĐƠN VỊ TIẾP NHẬN, một khái niệm khác. Xem chú thích ở binding Đơn thư.
    donViGiaiQuyet: formData.supervisingUnit || null,
    assignedTeamId: formData.assignedTeamId || null,
    investigatorId: formData.handler || null,
    capDoToiPham: formData.capDoToiPham || null,
    caseProvenance: formData.caseProvenance,
    metadata: {
      caseCode: formData.caseCode,
      receiveDate: formData.receiveDate,
      receiveTime: formData.receiveTime,
      caseClassification: formData.caseClassification,
      priority: formData.priority,
      description: formData.description,
      nguonDon: formData.nguonDon || null,
      nhanXet: formData.nhanXet || null,
      biHai: formData.biHai || undefined,
      noiXayRa: formData.noiXayRa || null,
      nghiVanDoiTuong: formData.nghiVanDoiTuong || null,
      phuongThucThuDoan: formData.phuongThucThuDoan || null,
      ketQuaXuLyKhac: formData.ketQuaXuLyKhac || null,
      soPhieuChuyen: formData.soPhieuChuyen || null,
      dieuTraVienText: formData.dieuTraVienText || null,
      sttCu: formData.sttCu || undefined,
      tenCungCap: formData.tenCungCap || null,
      sinhNamCungCap: formData.sinhNamCungCap || null,
      cccdCungCap: formData.cccdCungCap || null,
      ngayCapCccd: formData.ngayCapCccd || null,
      noiCapCccd: formData.noiCapCccd || null,
      sdtCungCap: formData.sdtCungCap || null,
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
    payload.donViGiao =         oHeCu(formData.utdt_donViGiao);
    payload.soQuyetDinhUyThac = oHeCu(formData.utdt_soQuyetDinhUyThac);
    // `ngayTiepNhan` và `loaiThongTin` nay do ô ở tab Thông tin làm chủ (tab Ủy thác chỉ
    // hiện lại cùng ô ấy). Ghi đè ở đây sẽ dựng lại đúng cảnh hai chỗ cùng ghi một cột.

    payload.thoiHanUyThac =     oHeCu(formData.utdt_thoiHanUyThac);
    payload.loaiUyThac =        oHeCu(formData.utdt_loaiUyThac);
    payload.ketQuaUyThac =      oHeCu(formData.utdt_ketQuaUyThac);
    payload.ngayTraKetQua =     oHeCu(formData.utdt_ngayTraKetQua);
    // Store additional UTDT metadata fields
    payload.metadata.nghiVanDoiTuong =               oHeCu(formData.utdt_nghiVanDoiTuong);
    payload.metadata.lyDoKhongThucHienDuoc =         oHeCu(formData.utdt_lyDoKhongThucHienDuoc);
    payload.metadata.ngayThongBaoKhongThucHien =     oHeCu(formData.utdt_ngayThongBaoKhongThucHien);
  } else if (formData.sourceDocumentNote) {
    payload.sourceDocumentNote = formData.sourceDocumentNote;
  }

  // Field-parity: KLĐT + QĐ điều tra lại
  payload.soKLDT =           oHeCu(formData.soKLDT);
  payload.ngayKLDT =         oHeCu(formData.ngayKLDT);
  payload.soQDDieuTraLai =   oHeCu(formData.soQDDieuTraLai);
  payload.ngayQDDieuTraLai = oHeCu(formData.ngayQDDieuTraLai);
  // Field-parity: số QĐ giai đoạn vụ án
  payload.soQuyetDinhKhoiTo =   oHeCu(formData.soQuyetDinhKhoiTo);
  payload.ngayKhoiTo =          oHeCu(formData.ngayKhoiTo);
  payload.soQDNhapVuAn =        oHeCu(formData.soQDNhapVuAn);
  payload.ngayNhapVuAn =        oHeCu(formData.ngayNhapVuAn);
  payload.ghiChuNhapHoSo =      oHeCu(formData.ghiChuNhapHoSo);
  payload.soQDTachVuAn =        oHeCu(formData.soQDTachVuAn);
  payload.ngayTachVuAn =        oHeCu(formData.ngayTachVuAn);
  payload.soQDTachHanhVi =      oHeCu(formData.soQDTachHanhVi);
  payload.ngayTachHanhVi =      oHeCu(formData.ngayTachHanhVi);
  payload.soQDDinhChiVuAn =     oHeCu(formData.soQDDinhChiVuAn);
  payload.ngayDinhChiVuAn =     oHeCu(formData.ngayDinhChiVuAn);
  payload.chuyenVuAnChoCQK =    oHeCu(formData.chuyenVuAnChoCQK);
  payload.soBanAnCoHieuLuc =    oHeCu(formData.soBanAnCoHieuLuc);
  payload.ngayBanAnCoHieuLuc =  oHeCu(formData.ngayBanAnCoHieuLuc);
  payload.canCuTamDinhChiVuAn = oHeCu(formData.canCuTamDinhChiVuAn);
  payload.canCuPhucHoiVuAn =    oHeCu(formData.canCuPhucHoiVuAn);
  // PR-3 — tab "Vụ án TĐC" (chỉ gửi khi có giá trị; tránh ghi đè workflow auto-set)
  payload.soQuyetDinhTamDinhChi =   oHeCu(formData.soQuyetDinhTamDinhChi);
  payload.ngayTamDinhChi =          oHeCu(formData.ngayTamDinhChi);
  if (formData.lyDoTamDinhChiVuAn && formData.lyDoTamDinhChiVuAn.length > 0) payload.lyDoTamDinhChiVuAn = formData.lyDoTamDinhChiVuAn;
  payload.ngayHetThoiHieu =         oHeCu(formData.ngayHetThoiHieu);
  payload.soQuyetDinhPhucHoi =      oHeCu(formData.soQuyetDinhPhucHoi);
  payload.ngayPhucHoi =             oHeCu(formData.ngayPhucHoi);
  payload.tdcKhacPhucLyDoBienPhap = oHeCu(formData.tdcKhacPhucLyDoBienPhap);
  payload.tdcKhacPhucBienBan =      oHeCu(formData.tdcKhacPhucBienBan);
  // PR-M2: ghi chú tự do + tội danh khác (multi)
  payload.ghiChuKhac =                       oHeCu(formData.ghiChuKhac);
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

  // MỘT CỘT — MỘT Ô. Ba cột dưới đây trước nay có HAI ô cùng ghi: ô hệ cũ trong tab Thông
  // tin và ô "Người tố cáo / Báo tin" trong khối Bổ sung hệ mới. Vì màn Sửa nạp cùng một
  // cột vào cả hai ô, xoá trắng ô hệ cũ thì ô kia vẫn giữ giá trị cũ và gửi lại nó — thao
  // tác xoá không có tác dụng. Đã gỡ ba ô trùng khỏi khối Bổ sung hệ mới (xem tabs.tsx).
  payload.tenCungCap = oHeCu(formData.tenCungCap);
  payload.cccdCungCap = oHeCu(formData.cccdCungCap);
  payload.sdtCungCap = oHeCu(parsePhone(formData.sdtCungCap) || formData.sdtCungCap);
  // MỘT CỘT — MỘT Ô. Ô "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại" ở tab Thông tin
  // là chủ cột `diaChiCungCap`; ô "Địa chỉ thường trú" trong khối Bổ sung hệ mới đã gỡ đi
  // (xem tabs.tsx). Trước đây hai ô cùng ghi cột này và ô hệ cũ luôn thắng, nên ô kia trở
  // thành ô gõ vào không có tác dụng — tệ hơn là không có ô.
  payload.diaChiCungCap = oHeCu(formData.diaChiCungCap);
  payload.moTaChiTiet = firstStr(formData.description) ?? null;
  payload.noiXayRa = firstStr(formData.noiXayRa, formData.specificAddress) ?? null;
  payload.nguonDon = firstStr(formData.nguonDon) ?? null;
  payload.nghiVanDoiTuong = firstStr(formData.nghiVanDoiTuong) ?? null;
  payload.nhanXet = firstStr(formData.nhanXet) ?? null;
  payload.phuongThucThuDoan = firstStr(formData.phuongThucThuDoan) ?? null;
  payload.ketQuaXuLyKhac = firstStr(formData.ketQuaXuLyKhac) ?? null;
  payload.soPhieuChuyen = firstStr(formData.soPhieuChuyen) ?? null;
  payload.ngayCapCccd = firstStr(formData.ngayCapCccd) ?? null;
  payload.noiCapCccd = firstStr(formData.noiCapCccd) ?? null;
  payload.phanLoaiToiPhamLinhVuc = firstStr(formData.phanLoaiToiPhamLinhVuc);
  payload.yeuCauBoSung = firstStr(formData.yeuCauBoSung);
  payload.sttCu = firstStr(formData.sttCu);
  payload.deXuat = firstStr(formData.deXuatXuLy);
  payload.dieuTraVien = firstStr(formData.dieuTraVienText) ?? null; // R7: text hệ cũ; handler(FK) riêng
  payload.receiveDate = firstStr(formData.receiveDate);
  payload.caseClassification = firstStr(formData.caseClassification);
  payload.tinhTrang = firstStr(formData.tinhTrang);
  payload.toiDanhBanDau = firstStr(formData.toiDanhBanDau) ?? null;
  // reporterDateOfBirth: merge native date + sinhNamCungCap year-only → kiểu native (Date).
  // GIỮ ngữ nghĩa "năm-only": input là date (YYYY-MM-DD) không diễn đạt được năm-only, nên khi
  // load năm-only ta hiện YYYY-01-01 + precision='year'. Round-trip: nếu value vẫn là YYYY-01-01
  // và precision đã load = 'year' → giữ 'year' (không tự nâng thành 'date' làm sai nghĩa pháp lý).
  // Cột `sinhNamCungCap` có thật trong lược đồ nhưng form trước nay chỉ ghi vào metadata, nên
  // giá trị di trú nằm trong cột luôn thắng lúc nạp lại: cán bộ sửa ô Sinh năm, lưu, mở lại
  // vẫn thấy con số cũ. Ghi thẳng vào cột.
  payload.sinhNamCungCap = oHeCu(formData.sinhNamCungCap);
  // `reporterDateOfBirth` là cột riêng của ô "Ngày sinh". Ô Sinh năm chỉ NÂNG năm-only lên
  // thành ngày khi ô kia còn trống — không phải hai ô cùng ghi một cột.
  const dobRaw = firstStr(formData.reporterDateOfBirth, formData.sinhNamCungCap);
  // Xoá trắng ô Sinh năm phải xoá được: bỏ khoá khỏi lời gọi thì máy chủ giữ nguyên ngày cũ.
  if (!dobRaw) payload.reporterDateOfBirth = null;
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
  payload.phanLoaiNguonTinBanDau = oHeCu(formData.phanLoaiNguonTinBanDau);
  payload.ngayXayRa = oHeCu(formData.ngayXayRa);
  payload.noiXayRaPhuongXa = oHeCu(formData.noiXayRaPhuongXa);
  payload.soQDPhanCongNguonTin = oHeCu(formData.soQDPhanCongNguonTin);
  payload.ngayQDPhanCongNguonTin = oHeCu(formData.ngayQDPhanCongNguonTin);
  payload.soQDKhongKhoiTo = oHeCu(formData.soQDKhongKhoiTo);
  payload.ngayQDKhongKhoiTo = oHeCu(formData.ngayQDKhongKhoiTo);
  payload.canCuKhongKhoiTo = oHeCu(formData.canCuKhongKhoiTo);
  payload.chuyenVuViecDonViKhac = oHeCu(formData.chuyenVuViecDonViKhac);
  payload.nhapVaoVuViecSo = oHeCu(formData.nhapVaoVuViecSo);
  payload.phanLoaiDanSu = oHeCu(formData.phanLoaiDanSu);
  payload.soQDTamDinhChiNguonTin = oHeCu(formData.soQDTamDinhChiNguonTin);
  payload.ngayQDTamDinhChiNguonTin = oHeCu(formData.ngayQDTamDinhChiNguonTin);
  payload.canCuTamDinhChiNguonTin = oHeCu(formData.canCuTamDinhChiNguonTin);
  payload.ngayHetThoiHieuVuViec = oHeCu(formData.ngayHetThoiHieuVuViec);
  payload.khacPhucLyDoTDCVuViec = oHeCu(formData.khacPhucLyDoTDCVuViec);
  payload.tienDoKhacPhucTDCVuViec = oHeCu(formData.tienDoKhacPhucTDCVuViec);
  payload.soPhucHoiNguonTin = oHeCu(formData.soPhucHoiNguonTin);
  payload.ngayPhucHoiNguonTin = oHeCu(formData.ngayPhucHoiNguonTin);
  payload.vatChungMoTa = oHeCu(formData.vatChungMoTa);
  payload.lenhNhapKho = oHeCu(formData.lenhNhapKho);
  payload.noiLuuTruBaoQuan = oHeCu(formData.noiLuuTruBaoQuan);
  payload.toiDanhChinhKhoiToId = oHeCu(formData.toiDanhChinhKhoiToId);
  // Ô chọn nhiều: mảng rỗng là "đã bỏ chọn hết", khác `undefined` là "không nhắc tới".
  payload.lyDoKhongKhoiTo = formData.lyDoKhongKhoiTo ?? [];
  payload.lyDoTamDinhChiNguonTin = formData.lyDoTamDinhChiNguonTin ?? [];
  payload.vuViecTamDungTruoc2015 = formData.vuViecTamDungTruoc2015 === true;
  // `soHoSoCu` trước nay hiện trên form nhưng KHÔNG có đường lên máy chủ: sửa xong là mất.
  //
  // `caseCode` thì KHÔNG gửi: ô ấy là số hiệu tự sinh (DocNumberPreviewField ở chế độ AUTO),
  // cán bộ không nhập tay. Gửi lên chỉ mở đường cho xung đột mã trùng mà không đổi lại điều
  // gì trên màn hình.
  payload.soHoSoCu = oHeCu(formData.soHoSoCu);
  // "Trường hợp báo cáo Ban Giám đốc": hệ cũ là ô CHỮ, cột hệ mới là ĐÚNG/SAI (di trú suy từ
  // chữ). Gửi cả hai — mất chữ là mất chỉ đạo của Ban Giám đốc, 34.931 hồ sơ đang có nội dung.
  // Nhóm ô trước nay chỉ hiện ở panel "Thông tin nghiệp vụ bổ sung" cuối trang (và ghi qua
  // `parityState`), nay đã về đúng vị trí trong tab nên phải tự đi lên máy chủ.
  payload.ngayDeXuat = oHeCu(formData.ngayDeXuat);
  // Hai ô này cũng theo luật MỘT CỘT — MỘT Ô: tab Thông tin là chủ, tab Ủy thác đã gỡ ô
  // trùng (xem CaseFormTab1UyThac.tsx).
  payload.loaiThongTin = oHeCu(formData.loaiThongTin);
  payload.ngayPhieuChuyen = oHeCu(formData.ngayPhieuChuyen);
  payload.ngayTiepNhan = oHeCu(formData.ngayTiepNhanNguonTin);
  payload.thoiHanUyThac = firstStr(formData.utdt_thoiHanUyThac) ?? null;
  payload.doVatTaiLieuKemTheo = oHeCu(formData.doVatTaiLieuKemTheo);
  payload.ngayVietDon = oHeCu(formData.ngayVietDon);
  payload.ghiChuTrungDon = oHeCu(formData.ghiChuTrungDon);
  payload.ngayGiaoDonViGiaiQuyet = oHeCu(formData.ngayGiaoDonViGiaiQuyet);
  payload.lanhDaoToTung = oHeCu(formData.lanhDaoToTung);
  payload.laCongNgheCao = formData.laCongNgheCao === true;

  // Một ô, hai cột, hai yêu cầu ngược chiều.
  //
  // `baoCaoBanGiamDoc` là `Boolean?`: gửi `false` mỗi lần lưu sẽ biến NULL ("chưa xác định")
  // thành `false` cho mọi hồ sơ chưa kịp bù cột chữ — tự tay xoá thông tin mà không ai yêu
  // cầu. Nên ô trống thì KHÔNG nhắc tới cột ấy.
  //
  // `baoCaoBanGiamDocText` là ô chữ cán bộ gõ, nên phải xoá được: ô trống gửi `null`.
  const baoCao = firstStr(formData.baoCaoBanGiamDoc);
  payload.baoCaoBanGiamDocText = baoCao ?? null;
  if (baoCao != null) payload.baoCaoBanGiamDoc = true;

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
