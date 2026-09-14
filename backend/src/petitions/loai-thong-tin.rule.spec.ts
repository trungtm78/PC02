import { nhomHanCuaLoaiThongTin } from './loai-thong-tin.rule';

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
    expect(nhomHanCuaLoaiThongTin('tố giác (02 đơn)', danhMuc)).toBe('KHIEU_NAI');
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
    expect(nhomHanCuaLoaiThongTin('Khiếu nại (QĐ tố tụng)', danhMuc)).toBe('KHIEU_NAI');
  });

  it('loại thông tin trống → undefined (không tự gán nhóm hạn cho hồ sơ không có loại)', () => {
    expect(nhomHanCuaLoaiThongTin('', danhMuc)).toBeUndefined();
    expect(nhomHanCuaLoaiThongTin(null, danhMuc)).toBeUndefined();
    expect(nhomHanCuaLoaiThongTin(undefined, danhMuc)).toBeUndefined();
  });
});
