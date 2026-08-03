import { decomposeLegacyRecord } from './legacy-mapper';
import { PARITY } from './field-parity.def';

/**
 * Field-parity: mọi field hệ cũ có data phải vào ĐÚNG cột typed của thực thể (không sót).
 * Kiểm builder đổ cột mới cho từng thực thể + legacyRaw luôn giữ bản gốc.
 */
describe('field-parity — builder đổ cột mới (không sót data)', () => {
  const base = { id: '77', stt: 'DT-2021-077', __sourceCollection: 'ho_so_doi_1' };

  it('Vụ việc (Incident): field intake trước chỉ ở legacyRaw → nay có cột', () => {
    const { incident } = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
      tom_tat_noi_dung: 'Nội dung vụ việc',
      nhan_xet: 'Nhận xét ĐTV',
      loai_thong_tin: 'Tố giác',
      'toi-danh-ban-dau': 'Trộm cắp tài sản',
      ngay_viet_don: '15/03/2021',
      lanh_dao_to_tung: 'Đ/c A',
      dieu_tra_vien: 'Đ/c B',
      truong_hop_bao_cao_ban_giam_doc: 'Đã báo cáo BGĐ ngày 16/3',
    } as any);
    expect(incident).toBeDefined();
    expect(incident!.nhanXet).toBe('Nhận xét ĐTV');
    expect(incident!.loaiThongTin).toBe('Tố giác');
    expect(incident!.toiDanhBanDau).toBe('Trộm cắp tài sản');
    expect(incident!.ngayVietDon).toBeInstanceOf(Date);
    expect(incident!.lanhDaoToTung).toBe('Đ/c A');
    expect(incident!.dieuTraVien).toBe('Đ/c B');
    expect(incident!.baoCaoBanGiamDoc).toBe(true);
    expect((incident!.legacyRaw as any).nhan_xet).toBe('Nhận xét ĐTV'); // gốc không mất
  });

  it('Vụ án (Case): field intake trước ở metadata → nay có cột typed', () => {
    const { case: c } = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau',
      tom_tat_noi_dung: 'Diễn biến vụ án dài...',
      ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Nguyễn Văn A',
      so_dien_thoai_nguyen_don: '0900000000',
      nghi_van_doi_tuong: 'Trần B (SN 1990)',
      nhan_xet: 'Nhận xét vụ án',
      phuong_thuc_thu_doan: 'Lừa đảo qua mạng',
    } as any);
    expect(c).toBeDefined();
    expect(c!.tenCungCap).toBe('Nguyễn Văn A');
    expect(c!.sdtCungCap).toBe('0900000000');
    expect(c!.nghiVanDoiTuong).toBe('Trần B (SN 1990)');
    expect(c!.nhanXet).toBe('Nhận xét vụ án');
    expect(c!.phuongThucThuDoan).toBe('Lừa đảo qua mạng');
    expect(c!.moTaChiTiet).toBe('Diễn biến vụ án dài...');
  });

  it('Đơn thư (Petition): số liệu thiệt hại + phân loại → cột', () => {
    const { petition } = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
      tom_tat_noi_dung: 'Đơn tố giác',
      so_tien_bi_thiet_hai: '50 triệu',
      so_luong_bi_hai: '3',
      ghi_chu_khac: 'Ghi chú',
    } as any);
    expect(petition).toBeDefined();
    expect(petition!.soTienBiThietHai).toBe(50000000);
    expect(petition!.soLuongBiHai).toBe(3);
    expect(petition!.ghiChuKhac).toBe('Ghi chú');
  });

  it('spec PARITY: mỗi field đều có col + type hợp lệ (không rỗng)', () => {
    const types = new Set(['String', 'DateTime', 'Int', 'Float', 'Boolean']);
    for (const e of ['petition', 'incident', 'case'] as const) {
      for (const c of PARITY[e]) {
        expect(c.field).toBeTruthy();
        expect(c.col).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        expect(types.has(c.type)).toBe(true);
      }
    }
  });
});
