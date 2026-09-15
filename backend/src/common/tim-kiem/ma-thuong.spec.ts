import { dungDieuKienTimKiem } from './dieu-kien';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  type KhaiThucThe,
} from './sinh/sinh-tim-kiem';

/**
 * Kiểu `ma-thuong`: mã danh mục, mã cán bộ, id đối tượng — so ĐÚNG mã, không phân biệt hoa thường.
 *
 * Không dùng `ma`: `ma` đi qua biến thể mã hồ sơ năm-stt và `in` (dùng chỉ mục btree trên 47k đơn
 * thư); mã danh mục "VA" gõ "va" thì `in` không ra. Không đổi `ma` sang không-phân-biệt-hoa: điều
 * kiện ấy thành ILIKE, mất chỉ mục của cột mã hồ sơ.
 */
const DANH_MUC: KhaiThucThe = {
  thucThe: 'danh-muc',
  bang: 'directories',
  model: 'Directory',
  truong: [
    { key: 'ma', nhan: 'Mã', kieu: 'ma-thuong', cot: 'code' },
    { key: 'ten', nhan: 'Tên', kieu: 'chu', cot: 'name' },
  ],
};

describe('điều kiện — ma-thuong', () => {
  it('so đúng mã, không phân biệt hoa thường; nhiều giá trị OR', () => {
    expect(
      dungDieuKienTimKiem([{ key: 'ma', giaTri: ['va'] }], DANH_MUC),
    ).toEqual([{ code: { equals: 'va', mode: 'insensitive' } }]);
    expect(
      dungDieuKienTimKiem([{ key: 'ma', giaTri: ['va', 'T01'] }], DANH_MUC),
    ).toEqual([
      {
        OR: [
          { code: { equals: 'va', mode: 'insensitive' } },
          { code: { equals: 'T01', mode: 'insensitive' } },
        ],
      },
    ]);
  });
});

describe('bộ sinh — ma-thuong', () => {
  it('ghép vào "tất cả các cột", không có cột bóng riêng', () => {
    const sql = sinhMigrationTimKiem([DANH_MUC]);
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."code", NEW."name"));`,
    );
    expect(sql).not.toContain('code_bd');
  });

  it('giao diện nhận kiểu ma-thuong', () => {
    const ts = sinhFrontendTimKiem([DANH_MUC]);
    expect(ts).toContain("'ma-thuong'");
    expect(ts).toContain("{ key: 'ma', nhan: 'Mã', kieu: 'ma-thuong' }");
  });
});
