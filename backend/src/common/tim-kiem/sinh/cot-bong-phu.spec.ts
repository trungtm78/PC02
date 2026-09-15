import {
  sinhCacCauNap,
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';
import { cotDbLech } from './tep-sinh';

/**
 * `cotBongPhu`: cột bóng KHÔNG thành khoá thẻ trên bảng này, chỉ để thẻ `quan-he` của thực thể KHÁC
 * lọc đúng cột màn hình hiện. Vd cột "Vụ án" ở Đối tượng/Luật sư hiện `case.name` — lọc trên
 * `cases.tim_kiem_bd` (ghép 13 cột) ra cả đối tượng mà MÔ TẢ vụ án có chữ ấy, cột thì không.
 */
const VU_AN: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [{ key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'caseCode' }],
  cotBongPhu: ['name'],
};

describe('bộ sinh — cotBongPhu', () => {
  const sql = sinhMigrationTimKiem([VU_AN]);

  it('sinh cột bóng, gán trong trigger, GIN; trigger nghe cột nguồn', () => {
    expect(sql).toContain(
      'ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "name_bd" text;',
    );
    expect(sql).toContain(`NEW."name_bd" := ' ' || f_bo_dau(NEW."name");`);
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "cases_name_bd_trgm" ON "cases" USING gin ("name_bd" gin_trgm_ops);',
    );
    expect(sql).toMatch(
      /BEFORE INSERT OR UPDATE OF [^\n]*"name"[^\n]* ON "cases"/,
    );
  });

  it('không ghép vào "tất cả các cột" (chỉ là đích cho quan hệ)', () => {
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."caseCode"));`,
    );
  });

  it('không thành khoá thẻ trên giao diện', () => {
    expect(sinhFrontendTimKiem([VU_AN])).not.toContain("key: 'name'");
  });

  it('field Prisma chỉ đọc Case.nameBd', () => {
    expect(truongPrismaCanCo([VU_AN])).toContainEqual({
      model: 'Case',
      field: 'nameBd',
      cot: 'name_bd',
    });
  });

  it('câu nạp gồm cột bóng phụ', () => {
    const nap = sinhCacCauNap([VU_AN]).find((n) => n.bang === 'cases');
    expect(nap?.cau.nap).toContain(`"name_bd" = ' ' || f_bo_dau("name")`);
  });

  it('cotDbLech: cột bóng phụ không có trong model → báo lệch', () => {
    const schema = 'model Case {\n  caseCode String\n}\n';
    expect(cotDbLech(schema, [VU_AN]).map((l) => l.field)).toContain('name');
  });

  it('thẻ quan-he trỏ cột bóng phụ của đích → hợp lệ', () => {
    const LUAT_SU: KhaiThucThe = {
      thucThe: 'luat-su',
      bang: 'lawyers',
      model: 'Lawyer',
      truong: [
        { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu', cot: 'fullName' },
        {
          key: 'vuAn',
          nhan: 'Vụ án',
          kieu: 'quan-he',
          quanHe: 'case',
          modelDich: 'Case',
          cotDich: 'nameBd',
          cotNguonDich: ['name'],
        },
      ],
    };
    expect(() => sinhMigrationTimKiem([VU_AN, LUAT_SU])).not.toThrow();
  });
});
