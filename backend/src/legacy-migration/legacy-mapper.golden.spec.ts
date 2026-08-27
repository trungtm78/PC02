/**
 * EXPERT golden-master — chốt ánh xạ TỪNG cột (output field ↔ đúng source key).
 * Mục tiêu: giết field-mapping mutant (đổi rec.X → rec.Y) mà property test không bắt.
 * Mỗi source key 1 sentinel duy nhất → assert output field map đúng sentinel/parse.
 */
import {
  decomposeLegacyRecord,
  parseLegacyDate,
  parseLegacyNumber,
  parseLegacyBool,
  type LegacyRecord,
} from './legacy-mapper';

// Record sentinel: mỗi key 1 giá trị nhận diện duy nhất. Ngày dùng dd/mm/yyyy hợp lệ khác nhau.
const REC: LegacyRecord = {
  id: 'GM-1',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'NGUOI_GUI',
  // Số thật, không phải chuỗi nhận diện: ô này nay ĐI QUA bộ đọc số điện thoại hệ cũ, và một
  // chuỗi không có chữ số nào bị coi là ký hiệu "không có" — đúng như 4.693 hồ sơ trên máy chạy.
  so_dien_thoai_nguyen_don: '0912345678',
  sinh_nam_nguoi_to_giac: '1990',
  so_cccd_nguyen_don: 'CCCD',
  ngay_cap_cccd_nguyen_don: '01/01/2020',
  noi_cap_cccd_nguyen_don: 'NOI_CAP',
  'dia-chi-bi-hai': 'DIA_CHI',
  nghi_van_doi_tuong: 'NGHI_VAN',
  tom_tat_noi_dung: 'TOM_TAT',
  do_vat_tai_lieu_kem_theo: 'DO_VAT',
  nguon_don: 'NGUON',
  loai_thong_tin: 'LOAI_TT',
  so_phieu_chuyen: 'SO_PHIEU',
  ngay_phieu_chuyen: '02/01/2020',
  ngay_tiep_nhan_nguon_tin: '03/01/2020',
  'toi-danh-ban-dau': 'TD_BAN_DAU',
  toi_danh_chinh_blhs2015: '95',
  noi_xay_ra: 'NOI_XAY_RA',
  noi_xay_ra_phuong_xa: 'PHUONG_XA',
  ngay_xay_ra: '04/01/2020',
  loai_toi_pham: 'LOAI_TP',
  phuong_thuc_thu_doan: 'PHUONG_THUC',
  ngay_giao_don_vi_giai_quyet: '05/01/2020',
  lanh_dao_to_tung: 'LANH_DAO',
  ket_qua_xu_ly_giai_quyet_khac: 'KQ_KHAC',
  ngay_viet_don: '06/01/2020',
  nhan_xet: 'NHAN_XET',
  ghi_chu_trung_don: 'TRUNG_DON',
  phan_loai_toi_pham_cong_nghe_cao: 'Có',
  truong_hop_bao_cao_ban_giam_doc: 'Đã báo cáo',
  thoi_han_thuc_hien_uy_thac_dieu_tra: '07/01/2020',
  // Incident
  don_vi_giai_quyet: 'DON_VI_GQ',
  quyet_dinh_phan_cong_giai_quyet_nguon_tin: 'QD_PHAN_CONG',
  ngay_ra_quyet_dinh_phan_cong_tin_bao: '08/01/2020',
  can_cu_ra_quyet_dinh_khong_khoi_to: 'CC_KHONG_KT',
  can_cu_tam_dinh_chi_nguon_tin: 'CC_TDC_NT',
  phan_loai_dan_su: 'DAN_SU',
  quyet_dinh_tam_dinh_chi_nguon_tin: 'QD_TDC_NT',
  ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin: '09/01/2020',
  phuc_hoi_nguon_tin_toi_pham: 'QD_PHUC_HOI',
  ngay_phuc_hoi_nguon_tin_toi_pham: '10/01/2020',
  ngay_thang_nam_het_thoi_hieu_vu_viec: '11/01/2020',
  tien_do_khac_phuc_tdc: 'TIEN_DO',
  vu_viec_chuyen_don_vi_khac: 'CHUYEN_DV',
  // Case
  quyet_dinh_khoi_to_vu_an: 'QD_KHOI_TO',
  ngay_quyet_dinh_khoi_to_vu_an: '12/01/2020',
  quyet_dinh_nhap_vu_an: 'QD_NHAP',
  ngay_nhap_vu_an: '13/01/2020',
  ghi_chu_nhap_ho_so: 'GC_NHAP',
  quyet_dinh_tach_vu_an: 'QD_TACH',
  ngay_tach_ho_so: '14/01/2020',
  dinh_chi_vu_an: 'QD_DINH_CHI',
  ngay_quyet_dinh_dinh_chi_vu_an: '15/01/2020',
  chuyen_vu_an_cho_co_quan_khac: 'CHUYEN_CQK',
  so_ban_an_co_hieu_luc: 'SO_BAN_AN',
  ngay_ban_an_co_hieu_luc: '16/01/2020',
  ket_luan_dieu_tra_vu_an: 'SO_KLDT',
  ngay_ket_luan_dieu_tra: '17/01/2020',
  quyet_dinh_dieu_tra_lai: 'QD_DT_LAI',
  ngay_quyet_dinh_dieu_tra_lai: '18/01/2020',
  quyet_dinh_tach_hanh_vi: 'QD_TACH_HV',
  'ngay-quyet-dinh-tach-hanh-vi': '19/01/2020',
  can_cu_tam_dinh_chi_vu_an: 'CC_TDC_VA',
  can_cu_phuc_hoi_dieu_tra_vu_an: 'CC_PHUC_HOI_VA',
  ghi_chu_khac: 'GHI_CHU_KHAC',
};

describe('EXPERT golden-master — Petition builder (ánh xạ từng cột)', () => {
  const p = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }).petition!;
  it('map đúng các cột Petition', () => {
    expect(p.senderName).toBe('NGUOI_GUI');
    expect(p.senderPhone).toBe('0912345678');
    expect(p.senderBirthYear).toBe('1990');
    expect(p.senderIdNumber).toBe('CCCD');
    expect(p.senderIdIssueDate).toEqual(parseLegacyDate('01/01/2020'));
    expect(p.senderIdIssuePlace).toBe('NOI_CAP');
    expect(p.senderAddress).toBe('DIA_CHI');
    expect(p.suspectedPerson).toBe('NGHI_VAN');
    expect(p.summary).toBe('TOM_TAT');
    expect(p.attachmentsNote).toBe('DO_VAT');
    expect(p.nguonDon).toBe('NGUON');
    expect(p.loaiThongTin).toBe('LOAI_TT');
    expect(p.soPhieuChuyen).toBe('SO_PHIEU');
    expect(p.ngayPhieuChuyen).toEqual(parseLegacyDate('02/01/2020'));
    expect(p.ngayTiepNhanNguonTin).toEqual(parseLegacyDate('03/01/2020'));
    expect(p.toiDanhBanDau).toBe('TD_BAN_DAU');
    expect(p.crimeChinhLegacyValue).toBe(95);
    expect(p.noiXayRa).toBe('NOI_XAY_RA');
    expect(p.noiXayRaPhuongXa).toBe('PHUONG_XA');
    expect(p.ngayXayRa).toEqual(parseLegacyDate('04/01/2020'));
    expect(p.loaiToiPham).toBe('LOAI_TP');
    expect(p.phuongThucThuDoan).toBe('PHUONG_THUC');
    expect(p.ngayGiaoDonViGiaiQuyet).toEqual(parseLegacyDate('05/01/2020'));
    expect(p.lanhDaoToTung).toBe('LANH_DAO');
    expect(p.ketQuaXuLyKhac).toBe('KQ_KHAC');
    expect(p.petitionDate).toEqual(parseLegacyDate('06/01/2020'));
    expect(p.nhanThay).toBe('NHAN_XET');
    expect(p.raSoatTrung).toBe('TRUNG_DON');
    expect(p.laCongNgheCao).toBe(true);
    expect(p.baoCaoBanGiamDoc).toBe(true);
    expect(p.thoiHanUTDT).toEqual(parseLegacyDate('07/01/2020'));
  });
});

describe('EXPERT golden-master — Incident builder (ánh xạ từng cột)', () => {
  const i = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' }).incident!;
  it('map đúng các cột Incident', () => {
    expect(i.description).toBe('TOM_TAT');
    expect(i.diaChiXayRa).toBe('NOI_XAY_RA');
    expect(i.sdtNguoiToGiac).toBe('0912345678');
    expect(i.cmndNguoiToGiac).toBe('CCCD');
    expect(i.benVu).toBe('NGUOI_GUI');
    expect(i.doiTuongCaNhan).toBe('NGHI_VAN');
    expect(i.donViGiaiQuyet).toBe('DON_VI_GQ');
    expect(i.soQDPhanCongNguonTin).toBe('QD_PHAN_CONG');
    expect(i.ngayQDPhanCongNguonTin).toEqual(parseLegacyDate('08/01/2020'));
    expect(i.canCuKhongKhoiTo).toBe('CC_KHONG_KT');
    expect(i.canCuTamDinhChi).toBe('CC_TDC_NT');
    expect(i.phanLoaiDanSuText).toBe('DAN_SU');
    expect(i.soQuyetDinhTamDinhChiVV).toBe('QD_TDC_NT');
    expect(i.ngayTamDinhChiVV).toEqual(parseLegacyDate('09/01/2020'));
    expect(i.soQuyetDinhPhucHoiVV).toBe('QD_PHUC_HOI');
    expect(i.ngayPhucHoiVV).toEqual(parseLegacyDate('10/01/2020'));
    expect(i.ngayHetThoiHieuVV).toEqual(parseLegacyDate('11/01/2020'));
    expect(i.tienDoKhacPhucTDC).toBe('TIEN_DO');
    expect(i.chuyenDenDonVi).toBe('CHUYEN_DV');
  });
});

describe('EXPERT golden-master — Case builder (ánh xạ từng cột)', () => {
  const c = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau' }).case!;
  it('map đúng các cột Case', () => {
    expect(c.soQuyetDinhKhoiTo).toBe('QD_KHOI_TO');
    expect(c.ngayKhoiTo).toEqual(parseLegacyDate('12/01/2020'));
    expect(c.soQDNhapVuAn).toBe('QD_NHAP');
    expect(c.ngayNhapVuAn).toEqual(parseLegacyDate('13/01/2020'));
    expect(c.ghiChuNhapHoSo).toBe('GC_NHAP');
    expect(c.soQDTachVuAn).toBe('QD_TACH');
    expect(c.ngayTachVuAn).toEqual(parseLegacyDate('14/01/2020'));
    expect(c.soQDDinhChiVuAn).toBe('QD_DINH_CHI');
    expect(c.ngayDinhChiVuAn).toEqual(parseLegacyDate('15/01/2020'));
    expect(c.chuyenVuAnChoCQK).toBe('CHUYEN_CQK');
    expect(c.soBanAnCoHieuLuc).toBe('SO_BAN_AN');
    expect(c.ngayBanAnCoHieuLuc).toEqual(parseLegacyDate('16/01/2020'));
    expect(c.crimeChinhLegacyValue).toBe(95);
    expect(c.soKLDT).toBe('SO_KLDT');
    expect(c.ngayKLDT).toEqual(parseLegacyDate('17/01/2020'));
    expect(c.soQDDieuTraLai).toBe('QD_DT_LAI');
    expect(c.ngayQDDieuTraLai).toEqual(parseLegacyDate('18/01/2020'));
    expect(c.soQDTachHanhVi).toBe('QD_TACH_HV');
    expect(c.ngayTachHanhVi).toEqual(parseLegacyDate('19/01/2020'));
    expect(c.canCuTamDinhChiVuAn).toBe('CC_TDC_VA');
    expect(c.canCuPhucHoiVuAn).toBe('CC_PHUC_HOI_VA');
    expect(c.ghiChuKhac).toBe('GHI_CHU_KHAC');
  });
});

describe('EXPERT golden-master — CaseStatistic builder (ánh xạ + kiểu Int/Float)', () => {
  const STAT_REC: LegacyRecord = {
    so_luong_bi_hai: '3',
    so_nguoi_bi_thuong: '4',
    so_luong_nguoi_chet: '5',
    so_tien_bi_thiet_hai: '1.000.000',
    so_tien_thu_hoi: '2.000.000',
    so_luong_sung_thu_hoi: '6',
    so_luong_thuoc_no_thu_hoi: '7',
    so_doi_tuong: '15',
    so_doi_tuong_da_bat: '8',
    so_doi_tuong_bi_bat_trong_vu_an_khac: '9',
    dieu_tra_mo_rong: '10',
    bat_duoc_bao_nhieu_bang_nhom: '11',
    xac_nhan_ghi_am_ghi_hinh: 'Có',
    xac_nhan_neu_la_vu_an_ghi_am_ghi_hinh: 'Không',
    xac_nhan_vu_viec_vphc: 'Có',
    co_bao_nhieu_bang_nhom: '0',
    xac_nhan_vu_an_da_duoc_xet_xu: 'Đã',
    ghi_am_ghi_hinh_da_duoc_xet_xu: 'Có',
    'vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu': 'Không',
    vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh: 'Có',
    so_dang_ky_ho_so: 'SO_DKHS',
    ngay_dang_ky_ho_so: '20/01/2020',
    ho_so_luu: 'HS_LUU',
    ngay_nop_luu_ho_so: '21/01/2020',
    don_vi_bao_quan_ho_so: 'DV_BAO_QUAN',
  };
  const stat = decomposeLegacyRecord({ ...STAT_REC, id: 'GM-S', phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau' }).statistic!;
  it('map đúng các cột thống kê', () => {
    expect(stat.soLuongBiHai).toBe(3);
    expect(stat.soNguoiBiThuong).toBe(4);
    expect(stat.soLuongNguoiChet).toBe(5);
    expect(stat.soTienBiThietHai).toBe(parseLegacyNumber('1.000.000'));
    expect(stat.soTienThuHoi).toBe(parseLegacyNumber('2.000.000'));
    expect(stat.soSungThuHoi).toBe(6);
    expect(stat.soThuocNoThuHoi).toBe(7);
    expect(stat.soDoiTuongDaBat).toBe(8);
    expect(stat.soDoiTuongBiBatVuAnKhac).toBe(9);
    expect(stat.dieuTraMoRong).toBe(10);
    expect(stat.soBangNhomBatDuoc).toBe(11);
    expect(stat.coGhiAmGhiHinh).toBe(true);
    expect(stat.laVuAnGhiAmGhiHinh).toBe(false);
    expect(stat.coVPHC).toBe(true);
    expect(stat.coBangNhom).toBe(false);
    expect(stat.vuAnDaDuocXetXu).toBe(true);
    expect(stat.ghiAmGhiHinhDaDuocXetXu).toBe(true);
    expect(stat.coSuDungKQGhiAmTrongXetXu).toBe(false);
    expect(stat.khongGAGHNhungToaYeuCau).toBe(true);
    expect(stat.soDangKyHoSo).toBe('SO_DKHS');
    expect(stat.ngayDangKyHoSo).toEqual(parseLegacyDate('20/01/2020'));
    expect(stat.hoSoLuu).toBe('HS_LUU');
    expect(stat.ngayNopLuuHoSo).toEqual(parseLegacyDate('21/01/2020'));
    expect(stat.donViBaoQuanHoSo).toBe('DV_BAO_QUAN');
  });
});

describe('EXPERT golden-master — tier③ builders + UTDT', () => {
  it('Guidance map đúng', () => {
    const g = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'huong-dan-ban-dau' }).guidance!;
    expect(g.guidedPerson).toBe('NGUOI_GUI');
    expect(g.guidedPersonPhone).toBe('0912345678');
    expect(g.subject).toBe('LOAI_TT');
    expect(g.guidanceContent).toBe('TOM_TAT');
    expect(g.unit).toBe('DON_VI_GQ');
    expect(g.notes).toBe('NHAN_XET');
  });
  it('Exchange map đúng', () => {
    const e = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'trao-doi-chuyen-an' }).exchange!;
    expect(e.recordCode).toBe('SO_PHIEU');
    expect(e.recordType).toBe('LOAI_TT');
    expect(e.senderUnit).toBe('NGUOI_GUI');
    expect(e.receiverUnit).toBe('DON_VI_GQ');
    expect(e.subject).toBe('TOM_TAT');
  });
  it('Proposal map đúng', () => {
    const pr = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'kien-nghi-vks' }).proposal!;
    expect(pr.content).toBe('TOM_TAT');
    expect(pr.unit).toBe('DON_VI_GQ');
    expect(pr.notes).toBe('NHAN_XET');
  });
  it('Lawyer map đúng', () => {
    const lw = decomposeLegacyRecord({ ...REC, phan_loai_nguon_tin_ban_dau: 'luat-su' }).lawyer!;
    expect(lw.fullName).toBe('NGUOI_GUI');
    expect(lw.phone).toBe('0912345678');
  });
  it('UTDT Case map đúng cột ủy thác + caseType', () => {
    const c = decomposeLegacyRecord({
      ...REC,
      phan_loai_nguon_tin_ban_dau: 'uy-thac-dieu-tra',
      don_vi_uy_thac: 'DV_UY_THAC',
      so_quyet_dinh_uy_thac: 'QD_UT',
      ngay_tiep_nhan_uy_thac: '22/01/2020',
      ket_qua_uy_thac: 'KQ_UT',
      ngay_tra_ket_qua_uy_thac: '23/01/2020',
    }).case!;
    expect(c.caseType).toBe('UY_THAC_DIEU_TRA');
    expect(c.donViGiao).toBe('DV_UY_THAC');
    expect(c.soQuyetDinhUyThac).toBe('QD_UT');
    expect(c.ngayTiepNhan).toEqual(parseLegacyDate('22/01/2020'));
    expect(c.ketQuaUyThac).toBe('KQ_UT');
    expect(c.ngayTraKetQua).toEqual(parseLegacyDate('23/01/2020'));
  });
});

describe('EXPERT mutation-killer — parseLegacyNumber mọi nhánh tách số', () => {
  it('hệ số nhân: mọi biến thể chữ', () => {
    expect(parseLegacyNumber('2 tỷ')).toBe(2e9);
    expect(parseLegacyNumber('2 tỉ')).toBe(2e9);
    expect(parseLegacyNumber('3 triệu')).toBe(3e6);
    expect(parseLegacyNumber('3 trieu')).toBe(3e6);
    expect(parseLegacyNumber('5 nghìn')).toBe(5000);
    expect(parseLegacyNumber('5 nghin')).toBe(5000);
    expect(parseLegacyNumber('5 ngàn')).toBe(5000);
    expect(parseLegacyNumber('5 ngan')).toBe(5000);
  });
  it('hỗn hợp dấu chấm+phẩy: VN (thập phân phẩy) vs US (thập phân chấm)', () => {
    expect(parseLegacyNumber('1.234,56')).toBeCloseTo(1234.56, 2); // VN: . nghìn, , thập phân
    expect(parseLegacyNumber('1,234.56')).toBeCloseTo(1234.56, 2); // US: , nghìn, . thập phân
  });
  it('chỉ phẩy: "1,5"→1.5 (thập phân); "1,500"→1500 (nghìn)', () => {
    expect(parseLegacyNumber('1,5')).toBe(1.5);
    expect(parseLegacyNumber('1,500')).toBe(1500);
  });
  it('chỉ chấm: "1.5"→1.5 (thập phân); "1.500"→1500 (nghìn)', () => {
    expect(parseLegacyNumber('1.5')).toBe(1.5);
    expect(parseLegacyNumber('1.500')).toBe(1500);
  });
  it('rỗng/chỉ dấu "-"/không chữ số → undefined', () => {
    expect(parseLegacyNumber('-')).toBeUndefined();
    expect(parseLegacyNumber('abc')).toBeUndefined();
    expect(parseLegacyNumber('')).toBeUndefined();
  });
  it('số âm giữ dấu', () => {
    expect(parseLegacyNumber('-1000')).toBe(-1000);
  });
});

describe('EXPERT mutation-killer — parseLegacyDate biên Excel serial', () => {
  it('biên dưới: 36526 = 2000-01-01 (number)', () => {
    const d = parseLegacyDate(36526);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2000);
    expect(d!.getUTCMonth() + 1).toBe(1);
    expect(d!.getUTCDate()).toBe(1);
  });
  it('dưới biên 36525 → undefined (ngoài range serial)', () => {
    expect(parseLegacyDate(36525)).toBeUndefined();
  });
  it('biên trên: 54789 nhận, 54790 → undefined', () => {
    expect(parseLegacyDate(54789)).toBeInstanceOf(Date);
    expect(parseLegacyDate(54790)).toBeUndefined();
  });
});

describe('EXPERT mutation-killer — parseLegacyBool nhãn dương', () => {
  it('mọi nhãn dương theo từ đầu → true', () => {
    ['có', 'co', 'đã', 'da', 'rồi', 'roi', 'true', 'x', '1', 'yes'].forEach((v) =>
      expect(parseLegacyBool(v)).toBe(true),
    );
  });
});

describe('EXPERT mutation-killer — fallback NOT NULL khi record thiếu field', () => {
  const bare = (phan_loai: string): LegacyRecord => ({ id: 'F1', phan_loai_nguon_tin_ban_dau: phan_loai });
  it('Incident name fallback "Vụ việc di trú <id>"', () => {
    expect(decomposeLegacyRecord(bare('vu-viec-ban-dau')).incident!.name).toBe('Vụ việc di trú F1');
  });
  it('Case name fallback "Vụ án di trú <id>"', () => {
    expect(decomposeLegacyRecord(bare('vu-an-ban-dau')).case!.name).toBe('Vụ án di trú F1');
  });
  it('Guidance guidedPerson + guidanceContent fallback', () => {
    const g = decomposeLegacyRecord(bare('huong-dan-ban-dau')).guidance!;
    expect(g.guidedPerson).toBe('(di trú)');
    expect(g.guidanceContent).toBe('(di trú — không có nội dung)');
  });
  it('Proposal content fallback', () => {
    expect(decomposeLegacyRecord(bare('kien-nghi-vks')).proposal!.content).toBe('(di trú — không có nội dung)');
  });
  it('Lawyer fullName fallback "Luật sư (di trú)"', () => {
    expect(decomposeLegacyRecord(bare('luat-su')).lawyer!.fullName).toBe('Luật sư (di trú)');
  });
});

describe('EXPERT mutation-killer — warning text + provenance hint chính xác', () => {
  it('luat-su có warning chứa "luật sư"', () => {
    const r = decomposeLegacyRecord({ id: 'W1', phan_loai_nguon_tin_ban_dau: 'luat-su' });
    expect(r.warnings.some((w) => w.includes('luật sư'))).toBe(true);
  });
  it('tra-ho-so có warning chứa "workflow"', () => {
    const r = decomposeLegacyRecord({ id: 'W2', phan_loai_nguon_tin_ban_dau: 'tra-ho-so-ban-dau' });
    expect(r.warnings.some((w) => w.includes('workflow'))).toBe(true);
  });
  it('uy-thac set caseProvenanceHint UY_THAC_DIEU_TRA', () => {
    const r = decomposeLegacyRecord({ id: 'W3', phan_loai_nguon_tin_ban_dau: 'uy-thac-dieu-tra' });
    expect(r.caseProvenanceHint).toBe('UY_THAC_DIEU_TRA');
  });
  it('phân loại lạ → warning chứa "phân loại" + 0 entity', () => {
    const r = decomposeLegacyRecord({ id: 'W4', phan_loai_nguon_tin_ban_dau: 'xyz-la' });
    expect(r.warnings.some((w) => w.includes('phân loại'))).toBe(true);
    expect(r.petition || r.incident || r.case).toBeUndefined();
  });
  it('decompose 1→nhiều: vu-viec + khởi tố → cả incident và case', () => {
    const r = decomposeLegacyRecord({
      id: 'W5',
      phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
      quyet_dinh_khoi_to_vu_an: 'QD',
    });
    expect(r.incident).toBeDefined();
    expect(r.case).toBeDefined();
  });
});

import { MAPPED_LEGACY_KEYS } from './legacy-mapper';

describe('EXPERT mutation-killer — MAPPED_LEGACY_KEYS registry (chốt từng key)', () => {
  // Golden list ĐỘC LẬP với source — drift hoặc literal bị đổi → test fail.
  const EXPECTED_MAPPED_KEYS = [
    'id', 'phan_loai_nguon_tin_ban_dau',
    'ten_ca_nhan_co_quan_to_chuc_cung_cap', 'so_dien_thoai_nguyen_don', 'sinh_nam_nguoi_to_giac',
    'so_cccd_nguyen_don', 'ngay_cap_cccd_nguyen_don', 'noi_cap_cccd_nguyen_don', 'dia-chi-bi-hai',
    'nghi_van_doi_tuong', 'tom_tat_noi_dung', 'do_vat_tai_lieu_kem_theo', 'nguon_don', 'loai_thong_tin',
    'so_phieu_chuyen', 'ngay_phieu_chuyen', 'ngay_tiep_nhan_nguon_tin', 'toi-danh-ban-dau',
    'toi_danh_chinh_blhs2015', 'noi_xay_ra', 'noi_xay_ra_phuong_xa', 'ngay_xay_ra', 'loai_toi_pham',
    'phuong_thuc_thu_doan', 'ngay_giao_don_vi_giai_quyet', 'lanh_dao_to_tung',
    'ket_qua_xu_ly_giai_quyet_khac', 'ngay_de_xuat', 'ngay_viet_don', 'nhan_xet', 'ghi_chu_trung_don',
    'phan_loai_toi_pham_cong_nghe_cao', 'truong_hop_bao_cao_ban_giam_doc', 'thoi_han_thuc_hien_uy_thac_dieu_tra',
    'don_vi_giai_quyet', 'quyet_dinh_phan_cong_giai_quyet_nguon_tin', 'ngay_ra_quyet_dinh_phan_cong_tin_bao',
    'can_cu_ra_quyet_dinh_khong_khoi_to', 'can_cu_tam_dinh_chi_nguon_tin', 'phan_loai_dan_su',
    'quyet_dinh_tam_dinh_chi_nguon_tin', 'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', 'phuc_hoi_nguon_tin_toi_pham',
    'ngay_phuc_hoi_nguon_tin_toi_pham', 'ngay_thang_nam_het_thoi_hieu_vu_viec', 'tien_do_khac_phuc_tdc',
    'vu_viec_chuyen_don_vi_khac',
    'quyet_dinh_khoi_to_vu_an', 'ngay_quyet_dinh_khoi_to_vu_an', 'quyet_dinh_nhap_vu_an', 'ngay_nhap_vu_an',
    'ghi_chu_nhap_ho_so', 'quyet_dinh_tach_vu_an', 'ngay_tach_ho_so', 'dinh_chi_vu_an',
    'ngay_quyet_dinh_dinh_chi_vu_an', 'chuyen_vu_an_cho_co_quan_khac', 'so_ban_an_co_hieu_luc',
    'ngay_ban_an_co_hieu_luc', 'toi_danh_chinh', 'ket_luan_dieu_tra_vu_an', 'ngay_ket_luan_dieu_tra',
    'quyet_dinh_dieu_tra_lai', 'ngay_quyet_dinh_dieu_tra_lai', 'quyet_dinh_tach_hanh_vi',
    'ngay-quyet-dinh-tach-hanh-vi', 'can_cu_tam_dinh_chi_vu_an', 'can_cu_phuc_hoi_dieu_tra_vu_an', 'ghi_chu_khac',
    'so_luong_bi_hai', 'so_nguoi_bi_thuong', 'so_luong_nguoi_chet', 'so_tien_bi_thiet_hai', 'so_tien_thu_hoi',
    'so_luong_sung_thu_hoi', 'so_luong_thuoc_no_thu_hoi', 'so_doi_tuong', 'so_doi_tuong_da_bat', 'so_doi_tuong_bi_bat_trong_vu_an_khac',
    'dieu_tra_mo_rong', 'bat_duoc_bao_nhieu_bang_nhom', 'xac_nhan_ghi_am_ghi_hinh', 'xac_nhan_neu_la_vu_an_ghi_am_ghi_hinh', 'xac_nhan_vu_viec_vphc',
    'co_bao_nhieu_bang_nhom', 'xac_nhan_vu_an_da_duoc_xet_xu', 'ghi_am_ghi_hinh_da_duoc_xet_xu',
    'vu_an_co_su_dung_ket_quả_ghi_am_ghi_hinh_trong_xet_xu', 'vu_an_khong_gagh_nhung_toa_an_yeu_cau_cung_cap_gagh', 'so_dang_ky_ho_so',
    'ngay_dang_ky_ho_so', 'ho_so_luu', 'ngay_nop_luu_ho_so', 'don_vi_bao_quan_ho_so',
    'don_vi_uy_thac', 'so_quyet_dinh_uy_thac', 'ngay_tiep_nhan_uy_thac', 'ket_qua_uy_thac',
    'ngay_tra_ket_qua_uy_thac',
    // ── Bổ sung 26/08/2026: khoá hệ cũ nay đã đổ vào cột (epic bố cục form Vụ án) ──
    // Bảy mốc ngày dưới đây phủ 16.9k–17.8k hồ sơ MỖI KHOÁ trên dữ liệu thật mà trước đó
    // chỉ nằm trong legacy_raw.
    'ngay_thong_ke', 'ngay_thoi_diem_phan_cong_giai_quyet_to_giac', 'ngay_tiep_nhan_tin',
    'ngay_nguoi_pham_toi_dau_thu', 'ngay_pham_toi_qua_tang', 'ngay_nguoi_pham_toi_bi_bat_khan_cap',
    'ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi',
    'su_dung_vu_khi_nong', 'so_doi_tuong_vi_pham_hanh_chinh', 'so_luong_nguoi_bi_phat_tien',
    'tong_so_tien_phat_hanh_chinh', 'so_doi_tuong_suu_tra_hiem_nghi',
    'tong_so_bien_ban_ghi_loi_khai', 'so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh',
    'tong_so_bien_ban_hoi_cung_bi_can', 'tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh',
    'so_bi_can_co_ghi_am_ghi_hinh', 'xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh',
    'so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh',
    'vat_chung', 'lenh_nhap_kho', 'Noi_luu_tru_bao_quan_ke_bien_phong_toa',
    'nhap_vao_vu_viec_so', 'xac_dinh_vu_viec_tam_dung_giai_quyet', 'khac_phuc_ly_do_tdc',
    'khac_phuc_tdc_vu_an', 'bien_phap_khac_phuc_tdc_vu_an', 'quyet_dinh_phuc_hoi_vu_an',
    'ngay_phuc_hoi_dieu_tra_vu_an', 'quyet_dinh_khong_khoi_to', 'ngay_ra_quyet_dinh_khong_khoi_to',
  ];
  it('mọi key kỳ vọng đều có trong registry (giết literal mutation)', () => {
    EXPECTED_MAPPED_KEYS.forEach((k) => expect(MAPPED_LEGACY_KEYS.has(k)).toBe(true));
  });
  it('registry không thừa/thiếu so với golden list', () => {
    expect(MAPPED_LEGACY_KEYS.size).toBe(EXPECTED_MAPPED_KEYS.length);
  });
});

describe('EXPERT mutation-killer — boolFromText (truong_hop_bao_cao_ban_giam_doc)', () => {
  const petWith = (v?: string): LegacyRecord => ({
    id: 'B1',
    phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
    ...(v === undefined ? {} : { truong_hop_bao_cao_ban_giam_doc: v }),
  });
  it('nhãn âm "Không" → false (KHÔNG bị coi free-text→true)', () => {
    expect(decomposeLegacyRecord(petWith('Không')).petition!.baoCaoBanGiamDoc).toBe(false);
  });
  it('text tự do → true', () => {
    expect(decomposeLegacyRecord(petWith('Đã báo cáo BGĐ ngày 1/6')).petition!.baoCaoBanGiamDoc).toBe(true);
  });
  it('thiếu field → undefined (không bịa)', () => {
    expect(decomposeLegacyRecord(petWith()).petition!.baoCaoBanGiamDoc).toBeUndefined();
  });
});
