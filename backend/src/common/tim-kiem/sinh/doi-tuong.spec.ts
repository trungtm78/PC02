import {
  sinhCauNapDoiTuong,
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  sinhSqlTatTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';

/**
 * Kiểu `doi-tuong`: cột "Đối tượng bị can" của Vụ án là QUAN HỆ tới bảng `subjects` (lọc theo
 * loại). Gõ không dấu phải ra → `subjects` có cột bóng `full_name_bd` do trigger giữ, như `users`.
 * Bảng nhỏ (prod 15/09: 1.292 dòng) nên chi phí trigger/chỉ mục không đáng kể.
 */
const KHAI: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'caseCode' },
    {
      key: 'doiTuongBiCan',
      nhan: 'Đối tượng bị can',
      kieu: 'doi-tuong',
      quanHe: 'subjects',
      loaiDoiTuong: 'SUSPECT',
    },
    { key: 'tomTat', nhan: 'Tóm tắt', kieu: 'chu', cot: 'moTaChiTiet' },
  ],
};

const KHAI_KHONG_DOI_TUONG: KhaiThucThe = {
  ...KHAI,
  truong: KHAI.truong.filter((t) => t.kieu !== 'doi-tuong'),
};

describe('kiểu doi-tuong — bộ sinh', () => {
  const sql = sinhMigrationTimKiem([KHAI]);

  it('sinh khối subjects: cột bóng, trigger theo fullName, GIN', () => {
    expect(sql).toContain(
      'ALTER TABLE "subjects" ADD COLUMN IF NOT EXISTS "full_name_bd" text;',
    );
    expect(sql).toContain(
      `NEW."full_name_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName"));`,
    );
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF "fullName" ON "subjects"',
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "subjects_full_name_bd_trgm" ON "subjects" USING gin ("full_name_bd" gin_trgm_ops);',
    );
  });

  it('không có trường doi-tuong → không đụng bảng subjects', () => {
    expect(sinhMigrationTimKiem([KHAI_KHONG_DOI_TUONG])).not.toContain(
      '"subjects"',
    );
  });

  it('không gộp quan hệ vào cột ghép "tất cả các cột" của bảng chính', () => {
    expect(sql).toMatch(
      /NEW\."tim_kiem_bd" := ' ' \|\| f_bo_dau\(concat_ws\(' ', NEW\."caseCode", NEW\."moTaChiTiet"\)\);/,
    );
  });

  it('field Prisma chỉ đọc Subject.fullNameBd', () => {
    expect(truongPrismaCanCo([KHAI])).toContainEqual({
      model: 'Subject',
      field: 'fullNameBd',
      cot: 'full_name_bd',
    });
    expect(truongPrismaCanCo([KHAI_KHONG_DOI_TUONG])).not.toContainEqual(
      expect.objectContaining({ model: 'Subject' }),
    );
  });

  it('câu nạp theo con trỏ cho subjects', () => {
    const nap = sinhCauNapDoiTuong();
    expect(nap.layLo).toContain('FROM "subjects"');
    expect(nap.nap).toContain(
      `"full_name_bd" = ' ' || f_bo_dau(concat_ws(' ', "fullName"))`,
    );
  });

  it('SQL tắt khẩn gồm cả hàm trigger subjects', () => {
    expect(sinhSqlTatTimKiem([KHAI])).toContain(
      'CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects() RETURNS trigger',
    );
  });

  it('giao diện nhận kiểu doi-tuong', () => {
    expect(sinhFrontendTimKiem([KHAI])).toContain(
      "{ key: 'doiTuongBiCan', nhan: 'Đối tượng bị can', kieu: 'doi-tuong' },",
    );
    expect(sinhFrontendTimKiem([KHAI])).toContain("| 'doi-tuong'");
  });

  it('thiếu quanHe → báo lỗi khai', () => {
    const thieu: KhaiThucThe = {
      ...KHAI,
      truong: [{ key: 'x', nhan: 'X', kieu: 'doi-tuong' }],
    };
    expect(() => sinhMigrationTimKiem([thieu])).toThrow(/quanHe/);
  });
});
