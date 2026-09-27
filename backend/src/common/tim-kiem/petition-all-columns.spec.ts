import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import { KHAI_TIM_KIEM_DON_THU } from './khai/don-thu.khai';
import { sinhCauNapCotBong, sinhMigrationTimKiem } from './sinh/sinh-tim-kiem';

describe('petition all-column search', () => {
  it('replaces triggers and refreshes stale aggregates in one transaction', () => {
    const sql = sinhMigrationTimKiem([KHAI_TIM_KIEM_DON_THU]);
    expect(sql).toContain('\nBEGIN;\n');
    expect(sql).toContain('UPDATE "petitions" SET');
    expect(sql).toContain('WHERE (');
    expect(sql.slice(sql.indexOf('UPDATE "petitions" SET'))).not.toContain(
      '$1',
    );
    expect(sql).toMatch(/COMMIT;\n$/);
  });
  it('accepts an information-type chip and searches its accent-normalized shadow', () => {
    const chips = docThe(['loaiThongTin~Tố giác'], KHAI_TIM_KIEM_DON_THU);
    expect(
      JSON.stringify(dungDieuKienTimKiem(chips, KHAI_TIM_KIEM_DON_THU)),
    ).toContain('"loaiThongTinBd":{"contains":"to giac"}');
  });

  it.each(['deadline', 'createdAt'])(
    'includes %s in global date search',
    (column) => {
      const where = dungDieuKienTimKiem(
        [{ key: '*', giaTri: ['27/09/2026'] }],
        KHAI_TIM_KIEM_DON_THU,
      );
      expect(JSON.stringify(where)).toContain(`"${column}":{"gte":`);
    },
  );

  it('indexes information type and free-text petition dates for global search', () => {
    const sql = sinhMigrationTimKiem([KHAI_TIM_KIEM_DON_THU]);
    expect(sql).toContain('NEW."loaiThongTin"');
    expect(sql).toContain('NEW."ngay_viet_don_chu"');
    expect(sql).toContain('"loai_thong_tin_bd"');
  });

  it('refreshes stale non-null aggregates rather than only uninitialized rows', () => {
    const { nap } = sinhCauNapCotBong(KHAI_TIM_KIEM_DON_THU);
    expect(nap).toContain('"ngay_viet_don_chu"');
    expect(nap).toContain('IS DISTINCT FROM');
    expect(nap).toContain('"loaiThongTin"');
  });
});
