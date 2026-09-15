import type { KhaiThucThe } from './sinh-tim-kiem';
import { kieuCotLech } from './tep-sinh';

/**
 * Kiểu cột trong schema.prisma phải hợp với kiểu thẻ khai — vì bộ lọc Prisma khác nhau theo kiểu cột:
 * `BoolFilter` chỉ có `equals`/`not` (không có `in`), `mode: 'insensitive'` chỉ có ở `String`, cột bóng
 * `f_bo_dau(...)` cần chữ, khoảng ngày cần `DateTime`.
 *
 * [sau review M6 15/09/2026] Thẻ Trạng thái trên `User.isActive` (Boolean) từng dựng `{ in: [true] }` →
 * 500 cả danh sách, mà ca kiểm chỉ so hình đối tượng nên xanh. Cổng này bắt LỚP lỗi ấy từ khai + schema,
 * không phụ thuộc ai nhớ viết ca kiểm cho từng cột.
 */
const SCHEMA = [
  'model User {',
  '  id        String   @id',
  '  workId    String?',
  '  isActive  Boolean  @default(true)',
  '  loginAt   DateTime?',
  '  soLan     Int      @default(0)',
  '  status    UserStatus',
  '  ghiChu    String?  @map("ghi_chu")',
  '}',
].join('\n');

const khai = (truong: KhaiThucThe['truong']): KhaiThucThe => ({
  thucThe: 'nguoi-dung-thu',
  bang: 'users',
  model: 'User',
  truong,
});

describe('kieuCotLech — kiểu thẻ khớp kiểu cột schema.prisma', () => {
  it('khai đúng kiểu → không lệch', () => {
    expect(
      kieuCotLech(SCHEMA, [
        khai([
          { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'workId' },
          {
            key: 'trangThai',
            nhan: 'Trạng thái',
            kieu: 'chon',
            cot: 'isActive',
            giaTriCot: { active: true, inactive: false },
          },
          { key: 'loai', nhan: 'Loại', kieu: 'chon', cot: 'status' },
          { key: 'ngay', nhan: 'Ngày', kieu: 'ngay', cot: 'loginAt' },
          { key: 'ghiChu', nhan: 'Ghi chú', kieu: 'chu', cot: 'ghiChu' },
        ]),
      ]),
    ).toEqual([]);
  });

  it('chon trên cột Boolean mà không có giaTriCot → lệch (sẽ dựng `in` → 500)', () => {
    expect(
      kieuCotLech(SCHEMA, [
        khai([{ key: 'tt', nhan: 'TT', kieu: 'chon', cot: 'isActive' }]),
      ]),
    ).toEqual([
      expect.objectContaining({ field: 'isActive', kieuCot: 'Boolean' }),
    ]);
  });

  it('giaTriCot trên cột không phải Boolean → lệch', () => {
    expect(
      kieuCotLech(SCHEMA, [
        khai([
          {
            key: 'loai',
            nhan: 'Loại',
            kieu: 'chon',
            cot: 'status',
            giaTriCot: { a: true },
          },
        ]),
      ]),
    ).toEqual([expect.objectContaining({ field: 'status' })]);
  });

  it('ma-thuong / chu trên cột không phải String → lệch', () => {
    expect(
      kieuCotLech(SCHEMA, [
        khai([
          { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'soLan' },
          { key: 'chu', nhan: 'Chữ', kieu: 'chu', cot: 'isActive' },
        ]),
      ]).map((l) => l.field),
    ).toEqual(['soLan', 'isActive']);
  });

  it('ngay trên cột không phải DateTime → lệch', () => {
    expect(
      kieuCotLech(SCHEMA, [
        khai([{ key: 'ngay', nhan: 'Ngày', kieu: 'ngay', cot: 'workId' }]),
      ]),
    ).toEqual([
      expect.objectContaining({ field: 'workId', kieuCot: 'String' }),
    ]);
  });
});
