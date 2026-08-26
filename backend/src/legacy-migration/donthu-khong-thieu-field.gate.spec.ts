import { PARITY, PARITY_METADATA_ONLY } from './field-parity.def';

/**
 * CỔNG: mọi khoá hệ cũ CÓ DỮ LIỆU THẬT trên Đơn thư đều phải có chỗ ở.
 *
 * Yêu cầu của anh, nhắc lại 26/08/2026: *"chuyển hết dữ liệu, tuyệt đối không thiếu field,
 * tên field giữ nguyên hệ cũ"*. Cổng này biến câu ấy thành thứ kiểm được.
 *
 * VÌ SAO KHÔNG DÙNG MA TRẬN TÀI LIỆU: `docs/legacy/field-parity-matrix.md` đếm theo SỰ CÓ MẶT
 * của khoá trong `legacy_raw`. Hệ cũ ghi ĐỦ MỌI khoá cho MỌI hồ sơ, phần lớn là rỗng — nên ma
 * trận cao hơn thực tế rất nhiều. Đo lại trên máy chạy, đã loại ô rỗng và hai mốc rỗng `"0"` /
 * `"-25200"`, thì `ngay_thong_ke` chỉ có 1 hồ sơ chứ không phải 126, và
 * `ngay_thang_nam_het_thoi_hieu_vu_viec` có 0 hồ sơ chứ không phải 104.
 *
 * Đây là cùng cái bẫy đã mắc một lần ở epic Vụ án và phải đính chính với anh. Số dưới đây đo
 * bằng câu lệnh đếm giá trị THẬT trên 46.499 đơn thư có `legacyRaw`, ngày 26/08/2026.
 */

/** Khoá hệ cũ có ≥20 hồ sơ Đơn thư mang giá trị thật → phải có chỗ ở. */
const KHOA_CO_DU_LIEU_THAT: ReadonlyArray<readonly [string, number]> = [
  ['tom_tat_noi_dung', 46497],
  ['don_vi_giai_quyet', 46481],
  ['nguon_don', 46472],
  ['ten_ca_nhan_co_quan_to_chuc_cung_cap', 46457],
  ['phan_loai_nguon_tin_ban_dau', 46450],
  ['loai_thong_tin', 46413],
  ['nhan_xet', 46282],
  ['dia-chi-bi-hai', 46051],
  ['ngay_viet_don', 46047],
  ['ngay_tiep_nhan_nguon_tin', 44391],
  ['ghi_chu_trung_don', 36598],
  ['truong_hop_bao_cao_ban_giam_doc', 35261],
  ['stt_cu', 31460],
  ['ngay_giao_don_vi_giai_quyet', 25351],
  ['toi-danh-ban-dau', 15184],
  ['tinh_trang', 15039],
  ['toi_danh_chinh_blhs2015', 14511],
  ['do_vat_tai_lieu_kem_theo', 11472],
  ['ket_qua_xu_ly_giai_quyet_khac', 11142],
  ['so_phieu_chuyen', 10279],
  ['ngay_phieu_chuyen', 9415],
  ['so_dien_thoai_nguyen_don', 7511],
  ['phan_loai_toi_pham_theo_linh_vuc', 7489],
  ['sinh_nam_nguoi_to_giac', 5284],
  ['phan_loai_ho_so_doi_1', 4692],
  ['so_cccd_nguyen_don', 3280],
  ['noi_cap_cccd_nguyen_don', 2325],
  ['lich_su', 2244],
  ['ngay_cap_cccd_nguyen_don', 2181],
  ['so_tien_bi_thiet_hai', 1447],
  ['phuong_thuc_thu_doan', 1367],
  ['ghi_chu_khac', 704],
  ['nghi_van_doi_tuong', 655],
  ['so_luong_bi_hai', 599],
  ['phan_loai_toi_pham_cong_nghe_cao', 527],
  ['ngay_ra_quyet_dinh_phan_cong_tin_bao', 412],
  ['quyet_dinh_phan_cong_giai_quyet_nguon_tin', 411],
  ['dieu_tra_vien', 307],
  ['noi_xay_ra', 140],
  ['de_xuat', 91],
  ['ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', 62],
  ['quyet_dinh_tam_dinh_chi_nguon_tin', 58],
  ['can_cu_tam_dinh_chi_nguon_tin', 54],
  ['phuc_hoi_nguon_tin_toi_pham', 48],
  ['ngay_phuc_hoi_nguon_tin_toi_pham', 48],
];

/**
 * Khoá KHÔNG đi qua `PARITY.petition` mà có chỗ ở khác, khai tường minh kèm chỗ ở ấy.
 *
 * `buildPetition` trong `legacy-mapper.ts` đổ thẳng phần lớn ô tiếp nhận vào cột riêng, không
 * qua bảng parity. Liệt kê ở đây để cổng không báo sót nhầm, và để người đọc thấy được chỗ ở
 * của từng khoá mà không phải lần theo mã.
 */
const CHO_O_KHAC: Readonly<Record<string, string>> = {
  tom_tat_noi_dung: 'summary (buildPetition)',
  don_vi_giai_quyet: 'donViGiaiQuyet (buildPetition)',
  nguon_don: 'nguonDon (buildPetition)',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'senderName (buildPetition)',
  phan_loai_nguon_tin_ban_dau: 'phanLoaiNguonTin (buildPetition)',
  loai_thong_tin: 'loaiThongTin (buildPetition)',
  nhan_xet: 'nhanThay (buildPetition)',
  'dia-chi-bi-hai': 'senderAddress (buildPetition)',
  ngay_viet_don: 'petitionDate (buildPetition)',
  ngay_tiep_nhan_nguon_tin: 'ngayTiepNhanNguonTin (buildPetition)',
  ghi_chu_trung_don: 'raSoatTrung (buildPetition)',
  stt_cu: 'sttCu (buildPetition)',
  ngay_giao_don_vi_giai_quyet: 'ngayGiaoDonViGiaiQuyet (buildPetition)',
  'toi-danh-ban-dau': 'toiDanhBanDau (buildPetition)',
  toi_danh_chinh_blhs2015: 'crimeChinhId (buildPetition)',
  do_vat_tai_lieu_kem_theo: 'attachmentsNote (buildPetition)',
  ket_qua_xu_ly_giai_quyet_khac: 'ketQuaXuLyKhac (buildPetition)',
  so_phieu_chuyen: 'soPhieuChuyen (buildPetition)',
  ngay_phieu_chuyen: 'ngayPhieuChuyen (buildPetition)',
  so_dien_thoai_nguyen_don: 'senderPhone (buildPetition)',
  sinh_nam_nguoi_to_giac: 'senderBirthYear (buildPetition)',
  so_cccd_nguyen_don: 'senderIdNumber (buildPetition)',
  noi_cap_cccd_nguyen_don: 'senderIdIssuePlace (buildPetition)',
  ngay_cap_cccd_nguyen_don: 'senderIdIssueDate (buildPetition)',
  phuong_thuc_thu_doan: 'phuongThucThuDoan (buildPetition)',
  nghi_van_doi_tuong: 'suspectedPerson (buildPetition)',
  phan_loai_toi_pham_cong_nghe_cao: 'laCongNgheCao (buildPetition)',
  noi_xay_ra: 'noiXayRa (buildPetition)',
  truong_hop_bao_cao_ban_giam_doc: 'baoCaoBanGiamDoc (Boolean, buildPetition) + baoCaoBanGiamDocText (parity)',
  // Nhật ký chuyển đơn vị của hệ cũ — mảng con, không phải ô nhập. Giữ ở metadata/legacyRaw.
  lich_su: 'metadata.lichSuChuyenDonVi + legacyRaw (cố ý, không dựng ô)',
};

describe('GATE Đơn thư — không thiếu field hệ cũ', () => {
  const coCot = new Set(PARITY.petition.map((c) => c.field));

  it.each(KHOA_CO_DU_LIEU_THAT)('khoá "%s" (%i hồ sơ) có chỗ ở', (khoa) => {
    const noiO =
      (coCot.has(khoa) && `cột ${PARITY.petition.find((c) => c.field === khoa)?.col}`) ||
      CHO_O_KHAC[khoa] ||
      (PARITY_METADATA_ONLY.has(khoa) && 'metadata (cố ý)') ||
      null;

    expect(noiO).not.toBeNull();
  });

  /**
   * Danh sách chỗ-ở-khác phải khai đúng khoá có thật. Gõ sai một khoá thì nó vẫn "có chỗ ở"
   * trên giấy trong khi dữ liệu thật vẫn rơi — đúng kiểu hỏng cổng này sinh ra để chặn.
   */
  it('mọi khoá khai ở CHO_O_KHAC đều nằm trong danh sách có dữ liệu thật', () => {
    const coDuLieu = new Set(KHOA_CO_DU_LIEU_THAT.map(([k]) => k));
    const thua = Object.keys(CHO_O_KHAC).filter((k) => !coDuLieu.has(k));
    expect(thua).toEqual([]);
  });

  it('chín cột thêm ngày 26/08/2026 đều có mặt trong PARITY.petition', () => {
    const cotMoi = [
      'baoCaoBanGiamDocText',
      'tinhTrang',
      'soQDPhanCongNguonTin',
      'ngayQDPhanCongNguonTin',
      'soQDTamDinhChiNguonTin',
      'ngayQDTamDinhChiNguonTin',
      'canCuTamDinhChiNguonTin',
      'soPhucHoiNguonTin',
      'ngayPhucHoiNguonTin',
    ];
    const coTrongSpec = new Set(PARITY.petition.map((c) => c.col));
    expect(cotMoi.filter((c) => !coTrongSpec.has(c))).toEqual([]);
  });
});
