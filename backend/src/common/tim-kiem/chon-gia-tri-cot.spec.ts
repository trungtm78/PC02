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
  /**
   * [sửa sau review 15/09/2026] Bộ lọc boolean của Prisma (`BoolFilter`) CHỈ có `equals`/`not` —
   * không có `in`. Bản trước dựng `{ isActive: { in: [true] } }`: Prisma từ chối tham số → 500 cả danh
   * sách khi chọn thẻ Trạng thái (Người dùng, Danh mục, Ánh xạ địa chỉ). Ca kiểm cũ ghim đúng hình lỗi.
   */
  it('một giá trị → `equals` giá trị cột thật (boolean)', () => {
    expect(
      dungDieuKienTimKiem([{ key: 'trangThai', giaTri: ['active'] }], DANH_MUC),
    ).toEqual([{ isActive: { equals: true } }]);
  });

  it('nhiều giá trị → OR các `equals`; trùng giá trị gộp một', () => {
    expect(
      dungDieuKienTimKiem(
        [{ key: 'trangThai', giaTri: ['active', 'inactive'] }],
        DANH_MUC,
      ),
    ).toEqual([
      {
        OR: [{ isActive: { equals: true } }, { isActive: { equals: false } }],
      },
    ]);
    expect(
      dungDieuKienTimKiem(
        [{ key: 'trangThai', giaTri: ['inactive', 'inactive'] }],
        DANH_MUC,
      ),
    ).toEqual([{ isActive: { equals: false } }]);
  });

  it('không bao giờ dựng `in` cho cột có giaTriCot (BoolFilter không có `in`)', () => {
    const ra = dungDieuKienTimKiem(
      [{ key: 'trangThai', giaTri: ['active', 'inactive'] }],
      DANH_MUC,
    );
    expect(JSON.stringify(ra)).not.toContain('"in"');
  });

  it('giá trị không có trong bảng ánh xạ → 400', () => {
    expect(() => docThe(['trangThai~true'], DANH_MUC)).toThrow('không hợp lệ');
    expect(docThe(['trangThai~inactive'], DANH_MUC)).toEqual([
      { key: 'trangThai', giaTri: ['inactive'] },
    ]);
  });
});
