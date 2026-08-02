import {
  parseTruongField,
  normalizeOptions,
  parseNgonNguEnum,
  mergeByFieldName,
  CatalogField,
} from './build-field-catalog.util';

describe('build-field-catalog.util', () => {
  it('parseTruongField chuẩn hoá đúng field text', () => {
    const f = parseTruongField({
      ten_truong: 'ngay_tiep_nhan_nguon_tin',
      ten_hien_thi: 'Ngày tiếp nhận',
      kieu_du_lieu: 'text',
      bat_buoc: false,
      loai: 'ho_so',
      hien_thi_trong_form: true,
      don_vi_arr: [0],
      id: 1,
    });
    expect(f.tenTruong).toBe('ngay_tiep_nhan_nguon_tin');
    expect(f.tenHienThi).toBe('Ngày tiếp nhận');
    expect(f.kieuDuLieu).toBe('text');
    expect(f.batBuoc).toBe(false);
    expect(f.loai).toBe('ho_so');
    expect(f.donViArr).toEqual([0]);
  });

  it('normalizeOptions: "" → [], mảng → chuẩn hoá', () => {
    expect(normalizeOptions('')).toEqual([]);
    expect(normalizeOptions(null)).toEqual([]);
    expect(normalizeOptions([{ gia_tri: 'a', ten_hien_thi: 'A' }])).toEqual([{ giaTri: 'a', tenHienThi: 'A' }]);
  });

  it('parseNgonNguEnum lấy val.vn thành map code→nhãn', () => {
    const e = parseNgonNguEnum({ ten: 'loai_ho_so', val: { vn: { vu_an: 'Vụ án', vu_viec: 'Vụ việc' } } });
    expect(e.ten).toBe('loai_ho_so');
    expect(e.values).toEqual({ vu_an: 'Vụ án', vu_viec: 'Vụ việc' });
  });

  it('mergeByFieldName union đơn vị + phát hiện xung đột nhãn giữa đơn vị', () => {
    const fields: CatalogField[] = [
      { tenTruong: 'x', tenHienThi: 'Nhãn A', kieuDuLieu: 'text', batBuoc: false, loai: 'ho_so', options: [], hienThiForm: true, donViArr: [9], id: 1 },
      { tenTruong: 'x', tenHienThi: 'Nhãn B', kieuDuLieu: 'text', batBuoc: true, loai: 'ho_so', options: [], hienThiForm: true, donViArr: [21], id: 1 },
    ];
    const merged = mergeByFieldName(fields);
    expect(merged).toHaveLength(1);
    expect(merged[0].donViArr.sort((a, b) => a - b)).toEqual([9, 21]);
    expect(merged[0].batBuoc).toBe(true); // bất kỳ đơn vị bắt buộc → bắt buộc
    expect(merged[0].conflicts.some((c) => /nhãn khác/.test(c))).toBe(true);
  });

  it('mergeByFieldName tách theo loai (ho_so vs bi_can không gộp)', () => {
    const fields: CatalogField[] = [
      { tenTruong: 'x', tenHienThi: 'A', kieuDuLieu: 'text', batBuoc: false, loai: 'ho_so', options: [], hienThiForm: true, donViArr: [0], id: 1 },
      { tenTruong: 'x', tenHienThi: 'A', kieuDuLieu: 'text', batBuoc: false, loai: 'bi_can', options: [], hienThiForm: true, donViArr: [0], id: 2 },
    ];
    expect(mergeByFieldName(fields)).toHaveLength(2);
  });
});
