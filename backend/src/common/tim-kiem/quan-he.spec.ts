import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh/sinh-tim-kiem';

/**
 * Kiểu `quan-he`: cột danh sách hiện một bản ghi QUAN HỆ MỘT-MỘT (Luật sư → Vụ án, Luật sư → Thân
 * chủ, Đối tượng → Vụ án). Kiểu `doi-tuong` sinh `some` — chỉ đúng với quan hệ nhiều; đặt lên quan hệ
 * một thì Prisma ném 500. Kiểu này sinh `is`, lọc trên cột bóng CÓ SẴN của bảng đích (không dựng
 * trigger riêng), lùi về cột gốc của đích khi cột bóng rỗng.
 */
const VU_AN: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [{ key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'caseCode' }],
  cotThemVaoTatCa: ['name'],
};

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
      cotDich: 'timKiemBd',
      cotNguonDich: ['caseCode', 'name'],
    },
  ],
};

describe('kiểu quan-he — bộ sinh', () => {
  it('không dựng trigger/cột bóng cho quan hệ, không ghép vào "tất cả các cột"', () => {
    const sql = sinhMigrationTimKiem([VU_AN, LUAT_SU]);
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName"));`,
    );
    expect(sql).not.toContain('"case_bd"');
    expect(
      truongPrismaCanCo([VU_AN, LUAT_SU]).some((t) => t.field === 'caseBd'),
    ).toBe(false);
  });

  it.each(['quanHe', 'modelDich', 'cotDich', 'cotNguonDich'] as const)(
    'thiếu %s → báo lỗi khai',
    (thieu) => {
      const truong = { ...LUAT_SU.truong[1], [thieu]: undefined };
      expect(() =>
        sinhMigrationTimKiem([
          VU_AN,
          { ...LUAT_SU, truong: [LUAT_SU.truong[0], truong] },
        ]),
      ).toThrow(new RegExp(thieu));
    },
  );

  it('đích chưa có cột bóng (không khai nào sinh Case.timKiemBd) → báo lỗi, không để 500 lúc lọc', () => {
    expect(() => sinhMigrationTimKiem([LUAT_SU])).toThrow(/đích/);
  });

  it('giao diện nhận kiểu quan-he', () => {
    const fe = sinhFrontendTimKiem([VU_AN, LUAT_SU]);
    expect(fe).toContain("{ key: 'vuAn', nhan: 'Vụ án', kieu: 'quan-he' },");
    expect(fe).toContain("| 'quan-he'");
  });
});

describe('kiểu quan-he — điều kiện', () => {
  const dk = (tk: string[], luiCotGoc = true) =>
    dungDieuKienTimKiem(docThe(tk, LUAT_SU), LUAT_SU, { luiCotGoc });

  it('`is` trên cột bóng của đích, lùi về cột gốc của đích khi cột bóng rỗng', () => {
    expect(dk(['vuAn~Nguyễn'])).toEqual([
      {
        case: {
          is: {
            OR: [
              { timKiemBd: { contains: 'nguyen' } },
              {
                timKiemBd: null,
                OR: [
                  { caseCode: { contains: 'Nguyễn', mode: 'insensitive' } },
                  { name: { contains: 'Nguyễn', mode: 'insensitive' } },
                ],
              },
            ],
          },
        },
      },
    ]);
  });

  it('giá trị bỏ dấu ra rỗng → chỉ so nguyên chữ trên cột gốc của đích', () => {
    const dau = String.fromCharCode(0x301);
    expect(dk([`vuAn~${dau}`])).toEqual([
      {
        case: {
          is: {
            OR: [
              { caseCode: { contains: dau, mode: 'insensitive' } },
              { name: { contains: dau, mode: 'insensitive' } },
            ],
          },
        },
      },
    ]);
  });

  it('luiCotGoc: false vẫn giữ nhánh lùi (bảng đích có thể chưa nạp)', () => {
    expect(dk(['vuAn~An'], false)).toEqual(dk(['vuAn~An']));
  });

  it('nhiều giá trị → OR; không bao giờ trả khoá top-level `OR`/`case` gán đè', () => {
    const ra = dk(['vuAn~An', 'vuAn~Bình']);
    expect(ra).toHaveLength(1);
    expect(Object.keys(ra[0])).toEqual(['OR']);
    expect((ra[0] as { OR: unknown[] }).OR).toHaveLength(2);
  });
});
