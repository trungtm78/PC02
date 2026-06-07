// Lõi di trú: map 1 record hệ thống cũ (132 field flat, tên cột cũ) → các entity mới CÓ LIÊN KẾT.
// Thuần (testable). Tội danh trả về crimeChinhLegacyValue (số) — commit resolve sang crimeChinhId qua master Crime.

export type LegacyRecord = Record<string, unknown>;

export interface DecomposedEntities {
  petition?: Record<string, unknown>;
  incident?: Record<string, unknown>;
  case?: Record<string, unknown>;
  warnings: string[];
}

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

// Chuyển ngày hệ thống cũ (dd/mm/yyyy hoặc yyyy-mm-dd) → Date.
// Dùng roundtrip check để từ chối ngày âm lịch/overflow (vd 31/02/2025 → wrap sang 3/3 mà không bị bắt).
export function parseLegacyDate(v: unknown): Date | undefined {
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
  });
}

function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
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

  return out;
}
