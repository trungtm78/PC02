import { BadRequestException } from '@nestjs/common';
import { cotBongCuaKhai } from '../cot-bong-an';
import { docThe, dungDieuKienTimKiem } from '../dieu-kien';
import {
  sinhCacCauNap,
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';
import { cotDbLech, kieuCotLech } from './tep-sinh';

/**
 * Two new capabilities of the search generator:
 *   - kind `so`: a tag compares EQUAL on a numeric column, no shadow column;
 *   - `nguonJson`: a field stored in the JSON column `metadata` (no column of its own) still gets a shadow column and a tag.
 *
 * Modelled on Petition: 3 prosecution fields live in `metadata`, 2 numeric fields (damage amount, victim count).
 */
const JSON_SO_QD = { cot: 'metadata', khoa: 'soQuyetDinhKhoiTo' } as const;
const JSON_NGAY = { cot: 'metadata', khoa: 'ngayKhoiTo' } as const;
const JSON_TOI_DANH = {
  cot: 'metadata',
  khoa: 'toiDanhChinhKhoiToId',
  tuBang: { bang: 'crimes', cot: 'name' },
} as const;

const KHAI: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  truong: [
    { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', cot: 'senderName' },
    {
      key: 'soQuyetDinhKhoiTo',
      nhan: 'Số Quyết định khởi tố',
      kieu: 'chu',
      cot: 'soQuyetDinhKhoiTo',
      nguonJson: JSON_SO_QD,
    },
    {
      key: 'ngayKhoiTo',
      nhan: 'Ngày khởi tố',
      kieu: 'ngay',
      cot: 'ngayKhoiTo',
      nguonJson: JSON_NGAY,
    },
    {
      key: 'toiDanhKhoiTo',
      nhan: 'Tội danh khi khởi tố',
      kieu: 'chu',
      cot: 'toiDanhChinhKhoiTo',
      nguonJson: JSON_TOI_DANH,
    },
    {
      key: 'soTienBiThietHai',
      nhan: 'Số tiền',
      kieu: 'so',
      cot: 'soTienBiThietHai',
    },
    {
      key: 'soLuongBiHai',
      nhan: 'Số người bị hại',
      kieu: 'so',
      cot: 'soLuongBiHai',
      soNguyen: true,
    },
  ],
};

const the = (key: string, ...giaTri: string[]) => ({ key, giaTri });

describe('sinhMigrationTimKiem - JSON source', () => {
  const sql = sinhMigrationTimKiem([KHAI]);

  it('every nguonJson field has a text shadow column named after `cot`', () => {
    for (const c of [
      'so_quyet_dinh_khoi_to_bd',
      'ngay_khoi_to_bd',
      'toi_danh_chinh_khoi_to_bd',
    ]) {
      expect(sql).toContain(
        `ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "${c}" text;`,
      );
    }
  });

  it('text field: leading space + f_bo_dau on the JSON value', () => {
    expect(sql).toContain(
      `NEW."so_quyet_dinh_khoi_to_bd" := ' ' || f_bo_dau(NEW."metadata"->>'soQuyetDinhKhoiTo');`,
    );
  });

  it('text field resolved through another table: looks the name up by the id held in the JSON', () => {
    expect(sql).toContain(
      `NEW."toi_danh_chinh_khoi_to_bd" := ' ' || f_bo_dau((SELECT t."name" FROM "crimes" t WHERE t."id" = NEW."metadata"->>'toiDanhChinhKhoiToId'));`,
    );
  });

  it('date field: RAW ISO yyyy-mm-dd string - no f_bo_dau, no leading space', () => {
    expect(sql).toContain(
      `NEW."ngay_khoi_to_bd" := CASE WHEN NEW."metadata"->>'ngayKhoiTo' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr(NEW."metadata"->>'ngayKhoiTo', 1, 10) END;`,
    );
    expect(sql).not.toMatch(/f_bo_dau\(CASE/);
  });

  it('the date shadow has NO trigram index (range comparison, not substring)', () => {
    expect(sql).toContain('"petitions_so_quyet_dinh_khoi_to_bd_trgm"');
    expect(sql).not.toContain('petitions_ngay_khoi_to_bd_trgm');
  });

  it('the trigger also listens to the source JSON column', () => {
    expect(sql).toMatch(
      /BEFORE INSERT OR UPDATE OF [^\n]*"senderName"[^\n]*"metadata"[^\n]* ON "petitions"/,
    );
  });

  it('"all columns" includes JSON text fields but NOT JSON date fields', () => {
    const dong = sql
      .split('\n')
      .find((d) => d.includes('NEW."tim_kiem_bd" :='))!;
    expect(dong).toContain(`NEW."metadata"->>'soQuyetDinhKhoiTo'`);
    expect(dong).toContain(`NEW."metadata"->>'toiDanhChinhKhoiToId'`);
    expect(dong).not.toContain(`'ngayKhoiTo'`);
  });

  it('kind `so` generates no shadow column', () => {
    expect(sql).not.toMatch(/so_tien_bi_thiet_hai_bd|so_luong_bi_hai_bd/);
  });
});

describe('sinhCacCauNap - JSON source', () => {
  const cau = sinhCacCauNap([KHAI]).find((c) => c.bang === 'petitions')!.cau;

  it('the backfill uses the SAME expression without the NEW. prefix', () => {
    expect(cau.nap).not.toContain('NEW.');
    expect(cau.nap).toContain(`f_bo_dau("metadata"->>'soQuyetDinhKhoiTo')`);
    expect(cau.nap).toContain(
      `"ngay_khoi_to_bd" = CASE WHEN "metadata"->>'ngayKhoiTo' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substr("metadata"->>'ngayKhoiTo', 1, 10) END`,
    );
  });

  it('the drift comparison for the date column is not wrapped in f_bo_dau', () => {
    expect(cau.dem).toContain(
      `"ngay_khoi_to_bd" IS DISTINCT FROM CASE WHEN "metadata"->>'ngayKhoiTo'`,
    );
  });
});

describe('truongPrismaCanCo - JSON source', () => {
  it('requires a shadow field for JSON fields, not for kind `so`', () => {
    const fields = truongPrismaCanCo([KHAI]).map((t) => t.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'soQuyetDinhKhoiToBd',
        'ngayKhoiToBd',
        'toiDanhChinhKhoiToBd',
      ]),
    );
    expect(fields.some((f) => /^so(Tien|Luong)/.test(f))).toBe(false);
  });
});

describe('cotBongCuaKhai - payload hiding', () => {
  it('hides the shadow of JSON-backed text AND date fields from API payloads', () => {
    const hidden = cotBongCuaKhai(KHAI);
    expect(hidden).toEqual(
      expect.arrayContaining([
        'timKiemBd',
        'senderNameBd',
        'soQuyetDinhKhoiToBd',
        'toiDanhChinhKhoiToBd',
        // The date shadow is a shadow column too: leaving it out leaks it through Prisma's default select.
        'ngayKhoiToBd',
      ]),
    );
  });

  it('has no shadow for numeric fields', () => {
    expect(cotBongCuaKhai(KHAI).some((f) => /^so(Tien|Luong)/.test(f))).toBe(
      false,
    );
  });
});

describe('sinhFrontendTimKiem - kind so', () => {
  it('kind `so` is in the union and in the key list', () => {
    const ts = sinhFrontendTimKiem([KHAI]);
    expect(ts).toMatch(/KieuTruongTimKiem = [^;]*'so'/);
    expect(ts).toContain(
      `{ key: 'soTienBiThietHai', nhan: 'Số tiền', kieu: 'so' },`,
    );
    // An integer column travels to the UI so the suggestion box can refuse a decimal.
    expect(ts).toContain(
      `{ key: 'soLuongBiHai', nhan: 'Số người bị hại', kieu: 'so', soNguyen: true },`,
    );
  });
});

describe('a wrong declaration is rejected by the generator', () => {
  const khaiVoi = (t: KhaiThucThe['truong'][number]): KhaiThucThe => ({
    ...KHAI,
    truong: [t],
  });

  it('nguonJson only goes with kind chu / ngay', () => {
    expect(() =>
      sinhMigrationTimKiem([
        khaiVoi({
          key: 'x',
          nhan: 'X',
          kieu: 'ma',
          cot: 'x',
          nguonJson: JSON_SO_QD,
        }),
      ]),
    ).toThrow(/nguonJson/);
  });

  it('the JSON key and lookup table must be valid identifiers (blocks SQL injection)', () => {
    expect(() =>
      sinhMigrationTimKiem([
        khaiVoi({
          key: 'x',
          nhan: 'X',
          kieu: 'chu',
          cot: 'x',
          nguonJson: { cot: 'metadata', khoa: "a'; DROP TABLE users; --" },
        }),
      ]),
    ).toThrow(/không hợp lệ/);
    expect(() =>
      sinhMigrationTimKiem([
        khaiVoi({
          key: 'x',
          nhan: 'X',
          kieu: 'chu',
          cot: 'x',
          nguonJson: {
            cot: 'metadata',
            khoa: 'k',
            tuBang: { bang: 'crimes; --', cot: 'name' },
          },
        }),
      ]),
    ).toThrow(/không hợp lệ/);
  });

  it('kind so without cot is an error', () => {
    expect(() =>
      sinhMigrationTimKiem([khaiVoi({ key: 'x', nhan: 'X', kieu: 'so' })]),
    ).toThrow(/thiếu cot/);
  });

  it('soNguyen only applies to kind so', () => {
    expect(() =>
      sinhMigrationTimKiem([
        khaiVoi({ key: 'x', nhan: 'X', kieu: 'chu', cot: 'x', soNguyen: true }),
      ]),
    ).toThrow(/soNguyen/);
  });
});

describe('schema drift gates', () => {
  const SCHEMA = `
model Petition {
  id                  String  @id
  senderName          String?
  soTienBiThietHai    Float?
  soLuongBiHai        Int?
  metadata            Json?
}
`;

  it('a virtual JSON field (no column of its own) is NOT reported as a missing column', () => {
    expect(cotDbLech(SCHEMA, [KHAI])).toEqual([]);
  });

  it('kind so must point at a numeric column', () => {
    expect(kieuCotLech(SCHEMA, [KHAI])).toEqual([]);
    const lech = kieuCotLech(
      SCHEMA.replace(
        'soTienBiThietHai    Float?',
        'soTienBiThietHai    String?',
      ),
      [KHAI],
    );
    expect(lech.map((l) => l.field)).toEqual(['soTienBiThietHai']);
  });

  it('soNguyen demands an Int column, not Float', () => {
    const lech = kieuCotLech(
      SCHEMA.replace('soLuongBiHai        Int?', 'soLuongBiHai        Float?'),
      [KHAI],
    );
    expect(lech.map((l) => l.field)).toEqual(['soLuongBiHai']);
  });
});

describe('docThe - kind so', () => {
  it('reads Vietnamese numbers: dot groups thousands, comma is the decimal mark', () => {
    expect(() => docThe('soTienBiThietHai~1.500.000', KHAI)).not.toThrow();
    expect(() => docThe('soTienBiThietHai~1,5', KHAI)).not.toThrow();
    expect(() => docThe('soTienBiThietHai~1500000', KHAI)).not.toThrow();
  });

  it('non-numeric text is a 400 and never reaches Prisma', () => {
    expect(() => docThe('soTienBiThietHai~abc', KHAI)).toThrow(
      BadRequestException,
    );
    expect(() => docThe('soTienBiThietHai~12abc', KHAI)).toThrow(
      BadRequestException,
    );
    expect(() => docThe('soTienBiThietHai~1e999', KHAI)).toThrow(
      BadRequestException,
    );
  });

  it('an Int column rejects decimals', () => {
    expect(() => docThe('soLuongBiHai~1,5', KHAI)).toThrow(BadRequestException);
    expect(() => docThe('soLuongBiHai~3', KHAI)).not.toThrow();
  });

  it('a value beyond Int32 is a 400 (Prisma would throw a 500)', () => {
    expect(() => docThe('soLuongBiHai~99999999999', KHAI)).toThrow(
      BadRequestException,
    );
  });
});

describe('dungDieuKienTimKiem - kind so', () => {
  it('compares EQUAL on the numeric column, converting the Vietnamese format to a real number', () => {
    expect(
      dungDieuKienTimKiem([the('soTienBiThietHai', '1.500.000')], KHAI),
    ).toEqual([{ soTienBiThietHai: { equals: 1500000 } }]);
    expect(dungDieuKienTimKiem([the('soTienBiThietHai', '2,5')], KHAI)).toEqual(
      [{ soTienBiThietHai: { equals: 2.5 } }],
    );
    expect(dungDieuKienTimKiem([the('soLuongBiHai', '3')], KHAI)).toEqual([
      { soLuongBiHai: { equals: 3 } },
    ]);
  });

  it('several values on one tag are OR-ed', () => {
    expect(dungDieuKienTimKiem([the('soLuongBiHai', '3', '4')], KHAI)).toEqual([
      {
        OR: [{ soLuongBiHai: { equals: 3 } }, { soLuongBiHai: { equals: 4 } }],
      },
    ]);
  });

  it('the "all columns" box does NOT compare numbers (typing "5" must not return every record with 5 victims)', () => {
    const dk = JSON.stringify(dungDieuKienTimKiem([the('*', '5')], KHAI));
    expect(dk).not.toContain('soLuongBiHai');
    expect(dk).not.toContain('soTienBiThietHai');
  });
});

describe('dungDieuKienTimKiem - JSON source', () => {
  it('a text field filters on its shadow column, with NO fallback to a source column that does not exist', () => {
    const dk = dungDieuKienTimKiem([the('soQuyetDinhKhoiTo', '123')], KHAI);
    expect(dk).toEqual([
      { OR: [{ soQuyetDinhKhoiToBd: { contains: '123' } }] },
    ]);
    expect(JSON.stringify(dk)).not.toContain('"soQuyetDinhKhoiTo":');
  });

  it('input that strips to nothing still yields a condition on the shadow, never "no condition"', () => {
    // U+0301 is a combining mark: accent-stripping removes it, leaving an empty pattern.
    const dk = dungDieuKienTimKiem([the('soQuyetDinhKhoiTo', '\u0301')], KHAI);
    expect(dk).toEqual([
      { OR: [{ soQuyetDinhKhoiToBd: { contains: '\u0301' } }] },
    ]);
  });

  it('date field: [gte, lt) range on the text shadow, by VIETNAM calendar day', () => {
    expect(
      dungDieuKienTimKiem([the('ngayKhoiTo', '12/09/2026')], KHAI),
    ).toEqual([{ ngayKhoiToBd: { gte: '2026-09-12', lt: '2026-09-13' } }]);
    expect(dungDieuKienTimKiem([the('ngayKhoiTo', '09/2026')], KHAI)).toEqual([
      { ngayKhoiToBd: { gte: '2026-09-01', lt: '2026-10-01' } },
    ]);
    expect(dungDieuKienTimKiem([the('ngayKhoiTo', '2026')], KHAI)).toEqual([
      { ngayKhoiToBd: { gte: '2026-01-01', lt: '2027-01-01' } },
    ]);
  });

  it('a "*" tag typed as a date also finds the JSON date field and references no virtual column', () => {
    const dk = JSON.stringify(
      dungDieuKienTimKiem([the('*', '12/09/2026')], KHAI),
    );
    expect(dk).toContain(
      '"ngayKhoiToBd":{"gte":"2026-09-12","lt":"2026-09-13"}',
    );
    expect(dk).not.toContain('"ngayKhoiTo":');
  });

  it('a "*" tag falls back to REAL columns only (never a virtual JSON column)', () => {
    const dk = JSON.stringify(dungDieuKienTimKiem([the('*', '123')], KHAI));
    expect(dk).toContain('"senderName"');
    expect(dk).not.toContain('"soQuyetDinhKhoiTo":');
    expect(dk).not.toContain('"toiDanhChinhKhoiTo":');
  });
});

describe('vaoTatCa: false on a text field - tag-only free text', () => {
  const KHAI_NGAN: KhaiThucThe = {
    thucThe: 'don-thu',
    bang: 'petitions',
    model: 'Petition',
    truong: [
      { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', cot: 'senderName' },
      // Long free text: keeps its own shadow + tag, but stays OUT of the combined "all columns" shadow.
      {
        key: 'nhanXet',
        nhan: 'Nhận xét',
        kieu: 'chu',
        cot: 'nhanThay',
        vaoTatCa: false,
      },
    ],
  };
  const sql = sinhMigrationTimKiem([KHAI_NGAN]);

  it('still gets its own shadow column, trigger assignment and trigram index', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "nhan_thay_bd" text');
    expect(sql).toContain(
      `NEW."nhan_thay_bd" := ' ' || f_bo_dau(NEW."nhanThay");`,
    );
    expect(sql).toContain('"petitions_nhan_thay_bd_trgm"');
  });

  it('is left out of the combined shadow (trigger and backfill agree)', () => {
    const dong = sql
      .split('\n')
      .find((d) => d.includes('NEW."tim_kiem_bd" :='))!;
    expect(dong).toContain('NEW."senderName"');
    expect(dong).not.toContain('nhanThay');
    const nap = sinhCacCauNap([KHAI_NGAN]).find((c) => c.bang === 'petitions')!
      .cau.nap;
    expect(nap).toContain(
      `"tim_kiem_bd" = ' ' || f_bo_dau(concat_ws(' ', "senderName"))`,
    );
  });

  it('the trigger still listens to the column, so its own shadow is refreshed', () => {
    expect(sql).toMatch(
      /BEFORE INSERT OR UPDATE OF [^\n]*"nhanThay"[^\n]* ON "petitions"/,
    );
  });

  it('the "all columns" box neither searches it nor falls back to it, while its own tag does', () => {
    const tatCa = JSON.stringify(
      dungDieuKienTimKiem([the('*', 'abc')], KHAI_NGAN),
    );
    expect(tatCa).toContain('"senderName"');
    expect(tatCa).not.toContain('nhanThay');
    const rieng = JSON.stringify(
      dungDieuKienTimKiem([the('nhanXet', 'abc')], KHAI_NGAN),
    );
    expect(rieng).toContain('"nhanThayBd":{"contains":"abc"}');
  });
});

describe('tuBang: a rename in the referenced table refreshes the shadows that copied the name', () => {
  const sql = sinhMigrationTimKiem([KHAI]);

  it('creates an AFTER UPDATE OF name trigger on the referenced table, only when the name really changes', () => {
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION pc02_lan_toa_petitions_crimes()',
    );
    expect(sql).toContain(
      'DROP TRIGGER IF EXISTS pc02_lan_toa_petitions_crimes ON "crimes";',
    );
    expect(sql).toMatch(
      /CREATE TRIGGER pc02_lan_toa_petitions_crimes\s+AFTER UPDATE OF "name" ON "crimes"\s+FOR EACH ROW WHEN \(OLD\."name" IS DISTINCT FROM NEW\."name"\)\s+EXECUTE FUNCTION pc02_lan_toa_petitions_crimes\(\);/,
    );
  });

  it('re-assigns the JSON column of the dependent rows to itself so the existing search trigger recomputes them', () => {
    expect(sql).toContain(
      `UPDATE "petitions" SET "metadata" = "metadata" WHERE "metadata"->>'toiDanhChinhKhoiToId' = NEW."id";`,
    );
  });

  it('never blocks the write of the referenced table: a failure is a warning', () => {
    const fn = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION pc02_lan_toa_petitions_crimes()'),
    );
    expect(fn.slice(0, fn.indexOf('END $$;'))).toContain(
      'EXCEPTION WHEN OTHERS THEN',
    );
    expect(fn.slice(0, fn.indexOf('END $$;'))).toContain(
      "RAISE WARNING 'pc02_lan_toa_petitions_crimes: %', SQLERRM;",
    );
  });

  it('is not generated when no field copies a name from another table', () => {
    const khai: KhaiThucThe = {
      ...KHAI,
      truong: KHAI.truong.filter((t) => !t.nguonJson?.tuBang),
    };
    expect(sinhMigrationTimKiem([khai])).not.toContain('pc02_lan_toa_');
  });
});
