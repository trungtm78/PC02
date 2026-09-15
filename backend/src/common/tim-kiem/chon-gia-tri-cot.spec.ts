import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import type { KhaiThucThe } from './sinh/sinh-tim-kiem';

/**
 * `giaTriCot` (kiểu `chon`): giá trị thẻ trên URL luôn là CHUỖI, cột có thể là boolean (`isActive`,
 * `needsReview`). Gửi thẳng `{ in: ['true'] }` thì Prisma ném lỗi kiểu → 500. Bảng ánh xạ vừa là
 * danh sách giá trị hợp lệ (giá trị lạ → 400), vừa đổi sang giá trị cột thật.
 */
const DANH_MUC: KhaiThucThe = {
  thucThe: 'danh-muc',
  bang: 'directories',
  model: 'Directory',
  truong: [
    { key: 'ten', nhan: 'Tên', kieu: 'chu', cot: 'name' },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'isActive',
      giaTriCot: { active: true, inactive: false },
    },
  ],
};

describe('chon + giaTriCot', () => {
  it('đổi giá trị thẻ sang giá trị cột thật (boolean)', () => {
    expect(
      dungDieuKienTimKiem([{ key: 'trangThai', giaTri: ['active'] }], DANH_MUC),
    ).toEqual([{ isActive: { in: [true] } }]);
    expect(
      dungDieuKienTimKiem(
        [{ key: 'trangThai', giaTri: ['active', 'inactive'] }],
        DANH_MUC,
      ),
    ).toEqual([{ isActive: { in: [true, false] } }]);
  });

  it('giá trị không có trong bảng ánh xạ → 400', () => {
    expect(() => docThe(['trangThai~true'], DANH_MUC)).toThrow('không hợp lệ');
    expect(docThe(['trangThai~inactive'], DANH_MUC)).toEqual([
      { key: 'trangThai', giaTri: ['inactive'] },
    ]);
  });
});
