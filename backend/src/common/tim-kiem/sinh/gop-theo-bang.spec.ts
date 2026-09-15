import {
  sinhCacCauNap,
  sinhMigrationTimKiem,
  sinhSqlBatLaiTimKiem,
  sinhSqlTatTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';

/**
 * Hai nguồn cùng sinh khối trigger cho MỘT bảng: thẻ kiểu `doi-tuong` của Vụ án giữ
 * `subjects.full_name_bd`, và tệp khai riêng của Đối tượng (`bang: 'subjects'`). Không gộp thì
 * migration có hai `CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects()` — hàm sau âm thầm thay
 * hàm trước (mất cột bóng của khối đầu), field Prisma khai hai lần, CLI nạp chạy bảng hai lần.
 */
const VU_AN: KhaiThucThe = {
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
  ],
};

const DOI_TUONG: KhaiThucThe = {
  thucThe: 'doi-tuong',
  bang: 'subjects',
  model: 'Subject',
  truong: [
    { key: 'hoTen', nhan: 'Họ tên', kieu: 'chu', cot: 'fullName' },
    { key: 'cccd', nhan: 'CCCD', kieu: 'chu', cot: 'idNumber' },
  ],
  cotThemVaoTatCa: ['address'],
};

const dem = (s: string, con: string) => s.split(con).length - 1;

describe('bộ sinh — gộp khối trigger THEO BẢNG', () => {
  const sql = sinhMigrationTimKiem([VU_AN, DOI_TUONG]);

  it('subjects: đúng MỘT hàm, MỘT trigger', () => {
    expect(
      dem(sql, 'CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects()'),
    ).toBe(1);
    expect(dem(sql, 'CREATE TRIGGER pc02_tim_kiem_subjects')).toBe(1);
  });

  it('hàm gộp giữ đủ cột bóng của cả hai nguồn, mỗi cột một lần', () => {
    expect(dem(sql, `NEW."full_name_bd" := ' ' || f_bo_dau(`)).toBe(1);
    expect(sql).toContain(
      `NEW."id_number_bd" := ' ' || f_bo_dau(NEW."idNumber");`,
    );
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."fullName", NEW."idNumber", NEW."address"));`,
    );
  });

  it('trigger nghe HỢP cột nguồn, không lặp', () => {
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF "fullName", "idNumber", "address" ON "subjects"',
    );
  });

  it('SQL tắt khẩn / bật lại: một hàm subjects', () => {
    for (const vanHanh of [
      sinhSqlTatTimKiem([VU_AN, DOI_TUONG]),
      sinhSqlBatLaiTimKiem([VU_AN, DOI_TUONG]),
    ]) {
      expect(
        dem(vanHanh, 'CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_subjects()'),
      ).toBe(1);
    }
  });

  it('field Prisma không khai trùng', () => {
    const ds = truongPrismaCanCo([VU_AN, DOI_TUONG]).map(
      (t) => `${t.model}.${t.field}`,
    );
    expect(ds.filter((x) => x === 'Subject.fullNameBd')).toHaveLength(1);
    expect(new Set(ds).size).toBe(ds.length);
  });

  it('câu nạp: mỗi bảng MỘT lần, cùng cột bóng với trigger', () => {
    const nap = sinhCacCauNap([VU_AN, DOI_TUONG]);
    expect(nap.map((n) => n.bang)).toEqual(['subjects', 'cases']);
    const subjects = nap[0].cau.nap;
    expect(dem(subjects, `"full_name_bd" = `)).toBe(1);
    expect(subjects).toContain(`"id_number_bd" = ' ' || f_bo_dau("idNumber")`);
    expect(subjects).toContain(
      `"tim_kiem_bd" = ' ' || f_bo_dau(concat_ws(' ', "fullName", "idNumber", "address"))`,
    );
  });

  it('cùng cột bóng mà biểu thức LỆCH THẬT → báo lỗi, không để khối sau âm thầm thắng', () => {
    const a: KhaiThucThe = {
      thucThe: 'a',
      bang: 'bang_x',
      model: 'X',
      truong: [{ key: 'ten', nhan: 'Tên', kieu: 'chu', cot: 'ten' }],
    };
    const b: KhaiThucThe = {
      thucThe: 'b',
      bang: 'bang_x',
      model: 'X',
      truong: [
        { key: 'ten', nhan: 'Tên', kieu: 'chu', cot: 'ten', cotDb: 'ten_khac' },
      ],
    };
    expect(() => sinhMigrationTimKiem([a, b])).toThrow(/lệch/);
  });
});
