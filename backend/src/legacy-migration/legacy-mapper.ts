// Lõi di trú: map 1 record hệ thống cũ (132 field flat, tên cột cũ) → các entity mới CÓ LIÊN KẾT.
// Thuần (testable). Tội danh trả về crimeChinhLegacyValue (số) — commit resolve sang crimeChinhId qua master Crime.

export type LegacyRecord = Record<string, unknown>;

export interface DecomposedEntities {
  petition?: Record<string, unknown>;
  incident?: Record<string, unknown>;
  case?: Record<string, unknown>;
  statistic?: Record<string, unknown>; // case_statistics 1-1 (gắn vào case)
  warnings: string[];
}

// Cờ boolean suy từ text tự do: có nội dung ⇒ true (giữ text gốc ở legacyRaw). Rỗng ⇒ undefined.
const boolFromText = (v: unknown): boolean | undefined => (s(v) !== undefined ? true : undefined);

const s = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const str = String(v).trim();
  return str === '' ? undefined : str;
};

const num = (v: unknown): number | undefined => {
  const str = s(v);
  if (str === undefined) return undefined;
  const n = Number(str);
  return Number.isNaN(n) ? undefined : n;
};

// Phân tích số tiền/đếm hệ cũ: phân tách nghìn VN (1.000.000 / 1,000,000), thập phân VN (1,5),
// hệ số nhân chữ ("triệu" → 1e6, "tỷ" → 1e9, "nghìn/ngàn" → 1e3). Convert lỗi → undefined (caller warn + giữ raw).
export function parseLegacyNumber(v: unknown): number | undefined {
  const raw = s(v);
  if (raw === undefined) return undefined;
  const lower = raw.toLowerCase();
  let multiplier = 1;
  if (lower.includes('tỷ') || lower.includes('tỉ') || /(^|\s)ty(\s|$)/.test(lower)) multiplier = 1e9;
  else if (lower.includes('triệu') || lower.includes('trieu')) multiplier = 1e6;
  else if (lower.includes('nghìn') || lower.includes('nghin') || lower.includes('ngàn') || lower.includes('ngan')) multiplier = 1e3;
  // Giữ lại chữ số, dấu . , -
  let core = lower.replace(/[^0-9.,-]/g, '');
  if (core === '' || core === '-') return undefined;
  const hasDot = core.includes('.');
  const hasComma = core.includes(',');
  if (hasDot && hasComma) {
    const dec = core.lastIndexOf(',') > core.lastIndexOf('.') ? ',' : '.';
    const tho = dec === ',' ? '.' : ',';
    core = core.split(tho).join('').replace(dec, '.');
  } else if (hasComma) {
    const parts = core.split(',');
    core = parts.length === 2 && parts[1].length !== 3 ? parts.join('.') : parts.join('');
  } else if (hasDot) {
    const parts = core.split('.');
    if (!(parts.length === 2 && parts[1].length !== 3)) core = parts.join(''); // dấu chấm = nghìn
  }
  const n = parseFloat(core);
  return Number.isNaN(n) ? undefined : n * multiplier;
}

// Phân tích nhãn boolean tiếng Việt. Rỗng → undefined (phân biệt "thiếu" vs false — Codex P1#6).
export function parseLegacyBool(v: unknown): boolean | undefined {
  const str = s(v);
  if (str === undefined) return undefined;
  const t = str.toLowerCase();
  if (/^(có|co|đã|da|rồi|roi|true|x|1|yes)$/.test(t)) return true;
  if (/^(không|khong|chưa|chua|false|0|no)$/.test(t)) return false;
  return undefined;
}

// Chuyển ngày hệ thống cũ (dd/mm/yyyy, yyyy-mm-dd, hoặc Excel serial) → Date.
// Dùng roundtrip check để từ chối ngày âm lịch/overflow (vd 31/02/2025 → wrap sang 3/3 mà không bị bắt).
export function parseLegacyDate(v: unknown): Date | undefined {
  // Excel serial: số (hoặc chuỗi toàn số) trong khoảng hợp lý → ngày theo epoch Excel 1899-12-30.
  if (typeof v === 'number' || (typeof v === 'string' && /^\d{4,6}$/.test(v.trim()))) {
    const serial = Number(typeof v === 'number' ? v : v.trim());
    if (serial >= 20000 && serial <= 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + serial * 86400000);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  const str = s(v);
  if (!str) return undefined;
  let year: number, month: number, day: number;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (m) {
    day = Number(m[1]); month = Number(m[2]); year = Number(m[3]);
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
    if (!m) return undefined;
    year = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return undefined;
  // Roundtrip: JS wraps overflow (31/02 → 3/3). Reject nếu UTC day/month/year khác input.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return undefined;
  }
  return d;
}

const PHAN_LOAI_DON = new Set(['don-cong-van-ban-dau']);
const PHAN_LOAI_VU_VIEC = new Set(['vu-viec-ban-dau', 'vu-viec-nguon-tin']);
const PHAN_LOAI_VU_AN = new Set(['vu-an-ban-dau']);

// Field tiếp nhận chung (người gửi / nội dung) — dùng cho Petition.
function buildPetition(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: s(rec.id),
    senderName: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
    senderPhone: s(rec.so_dien_thoai_nguyen_don),
    senderBirthYear: s(rec.sinh_nam_nguoi_to_giac),
    senderIdNumber: s(rec.so_cccd_nguyen_don),
    senderIdIssueDate: parseLegacyDate(rec.ngay_cap_cccd_nguyen_don),
    senderIdIssuePlace: s(rec.noi_cap_cccd_nguyen_don),
    senderAddress: s(rec['dia-chi-bi-hai']),
    suspectedPerson: s(rec.nghi_van_doi_tuong),
    summary: s(rec.tom_tat_noi_dung),
    attachmentsNote: s(rec.do_vat_tai_lieu_kem_theo),
    nguonDon: s(rec.nguon_don),
    loaiThongTin: s(rec.loai_thong_tin),
    soPhieuChuyen: s(rec.so_phieu_chuyen),
    ngayPhieuChuyen: parseLegacyDate(rec.ngay_phieu_chuyen),
    ngayTiepNhanNguonTin: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin),
    toiDanhBanDau: s(rec['toi-danh-ban-dau']),
    crimeChinhLegacyValue: num(rec.toi_danh_chinh_blhs2015),
    noiXayRa: s(rec.noi_xay_ra),
    noiXayRaPhuongXa: s(rec.noi_xay_ra_phuong_xa),
    ngayXayRa: parseLegacyDate(rec.ngay_xay_ra),
    loaiToiPham: s(rec.loai_toi_pham),
    phuongThucThuDoan: s(rec.phuong_thuc_thu_doan),
    ngayGiaoDonViGiaiQuyet: parseLegacyDate(rec.ngay_giao_don_vi_giai_quyet),
    lanhDaoToTung: s(rec.lanh_dao_to_tung),
    ketQuaXuLyKhac: s(rec.ket_qua_xu_ly_giai_quyet_khac),
    receivedDate: parseLegacyDate(rec.ngay_tiep_nhan_nguon_tin) ?? parseLegacyDate(rec.ngay_de_xuat),
    petitionDate: parseLegacyDate(rec.ngay_viet_don),
    nhanThay: s(rec.nhan_xet),
    raSoatTrung: s(rec.ghi_chu_trung_don),
    // Field-parity nhóm B bổ sung
    laCongNgheCao: parseLegacyBool(rec.phan_loai_toi_pham_cong_nghe_cao),
    baoCaoBanGiamDoc: boolFromText(rec.truong_hop_bao_cao_ban_giam_doc),
    thoiHanUTDT: parseLegacyDate(rec.thoi_han_thuc_hien_uy_thac_dieu_tra),
    legacyRaw: { ...rec },
  });
}

function buildIncident(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: s(rec.id),
    name: s(rec.tom_tat_noi_dung) ?? 'Vụ việc di trú ' + s(rec.id),
    description: s(rec.tom_tat_noi_dung),
    diaChiXayRa: s(rec.noi_xay_ra),
    sdtNguoiToGiac: s(rec.so_dien_thoai_nguyen_don),
    cmndNguoiToGiac: s(rec.so_cccd_nguyen_don),
    benVu: s(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap),
    doiTuongCaNhan: s(rec.nghi_van_doi_tuong),
    donViGiaiQuyet: s(rec.don_vi_giai_quyet),
    soQDPhanCongNguonTin: s(rec.quyet_dinh_phan_cong_giai_quyet_nguon_tin),
    ngayQDPhanCongNguonTin: parseLegacyDate(rec.ngay_ra_quyet_dinh_phan_cong_tin_bao),
    canCuKhongKhoiTo: s(rec.can_cu_ra_quyet_dinh_khong_khoi_to),
    canCuTamDinhChi: s(rec.can_cu_tam_dinh_chi_nguon_tin),
    phanLoaiDanSuText: s(rec.phan_loai_dan_su),
    // Field-parity nhóm B — TĐC nguồn tin / phục hồi / chuyển đơn vị
    soQuyetDinhTamDinhChiVV: s(rec.quyet_dinh_tam_dinh_chi_nguon_tin),
    ngayTamDinhChiVV: parseLegacyDate(rec.ngay_tam_dinh_chi_nguon_tin),
    soQuyetDinhPhucHoiVV: s(rec.phuc_hoi_nguon_tin_toi_pham),
    ngayPhucHoiVV: parseLegacyDate(rec.ngay_phuc_hoi_nguon_tin),
    ngayHetThoiHieuVV: parseLegacyDate(rec.ngay_thang_nam_het_thoi_hieu_vu_viec),
    tienDoKhacPhucTDC: s(rec.tien_do_khac_phuc_tdc),
    chuyenDenDonVi: s(rec.vu_viec_chuyen_don_vi_khac),
    legacyRaw: { ...rec },
  });
}

function buildCase(rec: LegacyRecord): Record<string, unknown> {
  return clean({
    legacySourceId: s(rec.id),
    name: s(rec.tom_tat_noi_dung) ?? 'Vụ án di trú ' + s(rec.id),
    soQuyetDinhKhoiTo: s(rec.quyet_dinh_khoi_to_vu_an),
    ngayKhoiTo: parseLegacyDate(rec.ngay_quyet_dinh_khoi_to_vu_an),
    soQDNhapVuAn: s(rec.quyet_dinh_nhap_vu_an),
    ngayNhapVuAn: parseLegacyDate(rec.ngay_nhap_vu_an),
    ghiChuNhapHoSo: s(rec.ghi_chu_nhap_ho_so),
    soQDTachVuAn: s(rec.quyet_dinh_tach_vu_an),
    ngayTachVuAn: parseLegacyDate(rec.ngay_tach_ho_so),
    soQDDinhChiVuAn: s(rec.dinh_chi_vu_an),
    ngayDinhChiVuAn: parseLegacyDate(rec.ngay_quyet_dinh_dinh_chi_vu_an),
    chuyenVuAnChoCQK: s(rec.chuyen_vu_an_cho_co_quan_khac),
    soBanAnCoHieuLuc: s(rec.so_ban_an_co_hieu_luc),
    ngayBanAnCoHieuLuc: parseLegacyDate(rec.ngay_ban_an_co_hieu_luc),
    crimeChinhLegacyValue: num(rec.toi_danh_chinh ?? rec.toi_danh_chinh_blhs2015),
    // Field-parity nhóm B — KLĐT, điều tra lại, tách hành vi, căn cứ TĐC/phục hồi, ghi chú tự do
    soKLDT: s(rec.ket_luan_dieu_tra_vu_an),
    ngayKLDT: parseLegacyDate(rec.ngay_ket_luan_dieu_tra),
    soQDDieuTraLai: s(rec.quyet_dinh_dieu_tra_lai),
    ngayQDDieuTraLai: parseLegacyDate(rec.ngay_quyet_dinh_dieu_tra_lai),
    soQDTachHanhVi: s(rec.quyet_dinh_tach_hanh_vi),
    ngayTachHanhVi: parseLegacyDate(rec['ngay-quyet-dinh-tach-hanh-vi']),
    canCuTamDinhChiVuAn: s(rec.can_cu_tam_dinh_chi_vu_an),
    canCuPhucHoiVuAn: s(rec.can_cu_phuc_hoi_dieu_tra_vu_an),
    ghiChuKhac: s(rec.ghi_chu_khac),
    legacyRaw: { ...rec },
  });
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

// Thống kê mở rộng (case_statistics, 1-1). Trả undefined nếu record không có field thống kê nào
// → KHÔNG tạo row rỗng (Codex P1#7). Cờ boolean dùng parseLegacyBool (nullable — phân biệt thiếu vs false).
export function buildCaseStatistic(rec: LegacyRecord): Record<string, unknown> | undefined {
  const stat = clean({
    soLuongBiHai: parseLegacyNumber(rec.so_luong_bi_hai),
    soNguoiBiThuong: parseLegacyNumber(rec.so_nguoi_bi_thuong),
    soLuongNguoiChet: parseLegacyNumber(rec.so_luong_nguoi_chet),
    soTienBiThietHai: parseLegacyNumber(rec.so_tien_bi_thiet_hai),
    soTienThuHoi: parseLegacyNumber(rec.so_tien_thu_hoi),
    soSungThuHoi: parseLegacyNumber(rec.so_sung_thu_hoi),
    soThuocNoThuHoi: parseLegacyNumber(rec.so_thuoc_no_thu_hoi),
    soDoiTuongDaBat: parseLegacyNumber(rec.so_doi_tuong_da_bat),
    soDoiTuongBiBatVuAnKhac: parseLegacyNumber(rec.so_doi_tuong_bi_bat_vu_an_khac),
    dieuTraMoRong: parseLegacyNumber(rec.dieu_tra_mo_rong),
    soBangNhomBatDuoc: parseLegacyNumber(rec.so_bang_nhom_bat_duoc),
    coGhiAmGhiHinh: parseLegacyBool(rec.co_ghi_am_ghi_hinh),
    laVuAnGhiAmGhiHinh: parseLegacyBool(rec.la_vu_an_ghi_am_ghi_hinh),
    coVPHC: parseLegacyBool(rec.co_vphc),
    coBangNhom: parseLegacyBool(rec.co_bang_nhom),
    vuAnDaDuocXetXu: parseLegacyBool(rec.xac_nhan_vu_an_da_duoc_xet_xu),
    ghiAmGhiHinhDaDuocXetXu: parseLegacyBool(rec.ghi_am_ghi_hinh_da_duoc_xet_xu),
    coSuDungKQGhiAmTrongXetXu: parseLegacyBool(rec.vu_an_co_su_dung_kqghi_am_trong_xet_xu),
    khongGAGHNhungToaYeuCau: parseLegacyBool(rec.vu_an_khong_gagh_nhung_toa_yeu_cau),
    soDangKyHoSo: s(rec.so_dang_ky_ho_so),
    ngayDangKyHoSo: parseLegacyDate(rec.ngay_dang_ky_ho_so),
    hoSoLuu: s(rec.ho_so_luu),
    ngayNopLuuHoSo: parseLegacyDate(rec.ngay_nop_luu_ho_so),
    donViBaoQuanHoSo: s(rec.don_vi_bao_quan_ho_so),
  });
  return Object.keys(stat).length > 0 ? stat : undefined;
}

export function decomposeLegacyRecord(rec: LegacyRecord): DecomposedEntities {
  const warnings: string[] = [];
  const phanLoai = s(rec.phan_loai_nguon_tin_ban_dau);
  const out: DecomposedEntities = { warnings };

  const hasKhoiTo = !!s(rec.quyet_dinh_khoi_to_vu_an);

  if (phanLoai && PHAN_LOAI_DON.has(phanLoai)) {
    out.petition = buildPetition(rec);
  } else if (phanLoai && PHAN_LOAI_VU_VIEC.has(phanLoai)) {
    out.incident = buildIncident(rec);
  } else if (phanLoai && PHAN_LOAI_VU_AN.has(phanLoai)) {
    out.case = buildCase(rec);
  } else {
    warnings.push(`Không nhận diện được phân loại '${phanLoai ?? '(trống)'}' — bỏ qua record ${s(rec.id)}`);
    return out;
  }

  // Decompose 1→nhiều: nếu có QĐ khởi tố mà chưa tạo Case → tạo thêm Case (giai đoạn vụ án).
  if (hasKhoiTo && !out.case) {
    out.case = buildCase(rec);
  }

  // Thống kê mở rộng (case_statistics 1-1) — chỉ khi có dữ liệu thống kê + có Case nhận.
  if (out.case) {
    const stat = buildCaseStatistic(rec);
    if (stat) out.statistic = stat;
  }

  return out;
}
