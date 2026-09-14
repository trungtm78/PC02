import {
  TRUY_VAN_DANH_MUC_LOAI_THONG_TIN,
  lapChiMucLoaiThongTin,
  nhomHanCuaLoaiThongTin,
  nhomHanCuaMuc,
  traLoaiThongTin,
} from './loai-thong-tin.rule';

/**
 * Nhóm hạn của một hồ sơ = nhóm hạn của MỤC DANH MỤC Loại thông tin mà hồ sơ mang.
 *
 * Danh mục thắng luật theo tên: quản trị viên đã sửa `metadata.nhomHan` của một mục thì mọi hồ sơ
 * chọn mục ấy tính hạn theo giá trị mới — đó là lý do nhóm hạn nằm trong danh mục chứ không cứng
 * trong mã. Không có mục (giá trị lạ, danh mục chưa nạp) mới lùi về luật theo tên.
 */
describe('nhomHanCuaLoaiThongTin', () => {
  const danhMuc = [
    { name: 'Tố giác', metadata: { nhomHan: 'KHIEU_NAI' } },
    { name: 'Tố cáo', metadata: { nhomHan: 'TO_CAO' } },
    { name: 'Đề nghị', metadata: { choDuyet: false } },
    { name: 'Kiến nghị', metadata: { nhomHan: 'KHONG_CO_THAT' } },
    { name: 'Phản ánh', metadata: null },
  ];

  it('mục danh mục có nhomHan → dùng giá trị ấy, kể cả khi trái luật theo tên', () => {
    expect(nhomHanCuaLoaiThongTin('Tố giác', danhMuc)).toBe('KHIEU_NAI');
  });

  it('so khớp mục bằng khoá gộp, không bằng chuỗi thô', () => {
    expect(nhomHanCuaLoaiThongTin('tố giác (02 đơn)', danhMuc)).toBe(
      'KHIEU_NAI',
    );
  });

  it('mục thiếu nhomHan → lùi về luật theo tên', () => {
    expect(nhomHanCuaLoaiThongTin('Đề nghị', danhMuc)).toBe('PHAN_ANH');
  });

  /** Giá trị rác trong metadata không được đi vào cột enum — Prisma sẽ ném lỗi khi ghi. */
  it('nhomHan không thuộc enum → lùi về luật theo tên', () => {
    expect(nhomHanCuaLoaiThongTin('Kiến nghị', danhMuc)).toBe('KIEN_NGHI');
  });

  it('metadata null → lùi về luật theo tên', () => {
    expect(nhomHanCuaLoaiThongTin('Phản ánh', danhMuc)).toBe('PHAN_ANH');
  });

  it('không có trong danh mục → luật theo tên', () => {
    expect(nhomHanCuaLoaiThongTin('Khiếu nại (QĐ tố tụng)', danhMuc)).toBe(
      'KHIEU_NAI',
    );
  });

  it('loại thông tin trống → undefined (không tự gán nhóm hạn cho hồ sơ không có loại)', () => {
    expect(nhomHanCuaLoaiThongTin('', danhMuc)).toBeUndefined();
    expect(nhomHanCuaLoaiThongTin(null, danhMuc)).toBeUndefined();
    expect(nhomHanCuaLoaiThongTin(undefined, danhMuc)).toBeUndefined();
  });
});

describe('nhomHanCuaMuc', () => {
  it('metadata hợp lệ thắng, không thì theo tên của mục', () => {
    expect(
      nhomHanCuaMuc({ name: 'Tố giác', metadata: { nhomHan: 'TO_CAO' } }),
    ).toBe('TO_CAO');
    expect(
      nhomHanCuaMuc({ name: 'Khiếu nại', metadata: { nhomHan: 'XYZ' } }),
    ).toBe('KHIEU_NAI');
    expect(nhomHanCuaMuc({ name: 'Đề nghị', metadata: 'chuoi' })).toBe(
      'PHAN_ANH',
    );
  });
});

/**
 * Soát 15/09/2026: bảng `directories` chỉ duy nhất theo (type, code), nên hai mục có thể cùng khoá
 * tên. Tra bằng `find` trên kết quả KHÔNG sắp xếp thì nhóm hạn phụ thuộc thứ tự dòng PostgreSQL
 * trả về — hạn pháp lý đổi giữa hai lần lưu. Truy vấn sắp theo mã, chỉ mục giữ mục ĐẦU TIÊN.
 */
describe('lapChiMucLoaiThongTin + truy vấn danh mục', () => {
  it('truy vấn chỉ lấy mục đang dùng, sắp theo mã cho tất định', () => {
    expect(TRUY_VAN_DANH_MUC_LOAI_THONG_TIN).toEqual({
      where: { type: 'LOAI_THONG_TIN', isActive: true },
      select: { name: true, metadata: true },
      orderBy: { code: 'asc' },
    });
  });

  it('hai mục cùng khoá → mục đứng trước (mã nhỏ hơn) thắng', () => {
    const chiMuc = lapChiMucLoaiThongTin([
      { name: 'Tố giác', metadata: { nhomHan: 'TO_CAO' } },
      { name: 'tố giác', metadata: { nhomHan: 'KHIEU_NAI' } },
    ]);
    expect(chiMuc.size).toBe(1);
    expect(traLoaiThongTin('TỐ GIÁC', chiMuc)).toEqual({
      ten: 'Tố giác',
      nhomHan: 'TO_CAO',
    });
  });

  it('bỏ qua mục tên rỗng', () => {
    expect(lapChiMucLoaiThongTin([{ name: '  ', metadata: null }]).size).toBe(
      0,
    );
  });
});

describe('traLoaiThongTin — tên chuẩn + nhóm hạn', () => {
  const chiMuc = lapChiMucLoaiThongTin([
    {
      name: 'Khiếu nại (Quyết định tố tụng)',
      metadata: { nhomHan: 'KHIEU_NAI' },
    },
  ]);

  it('khớp danh mục → tên của mục (không phải chữ gõ) và nhóm hạn của mục', () => {
    expect(traLoaiThongTin('khiếu nại (QĐ tố tụng) (02 đơn)', chiMuc)).toEqual({
      ten: 'Khiếu nại (Quyết định tố tụng)',
      nhomHan: 'KHIEU_NAI',
    });
  });

  /** Chữ không có trong danh mục vẫn phải ở dạng NFC — chữ tổ hợp dấu từ máy Mac/iOS không so khớp được. */
  it('không có trong danh mục → chữ gõ ở dạng NFC, gộp khoảng trắng; nhóm hạn theo tên', () => {
    const ra = traLoaiThongTin('  Tố   cáo cán bộ '.normalize('NFD'), chiMuc);
    expect(ra).toEqual({ ten: 'Tố cáo cán bộ', nhomHan: 'TO_CAO' });
    expect(ra!.ten).toBe(ra!.ten.normalize('NFC'));
  });

  it('trống / chỉ khoảng trắng → undefined', () => {
    expect(traLoaiThongTin('   ', chiMuc)).toBeUndefined();
    expect(traLoaiThongTin(null, chiMuc)).toBeUndefined();
  });
});
