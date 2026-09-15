import {
  sinhCauNapCotBong,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';
import { cotDbLech } from './tep-sinh';

/**
 * Trường Prisma có `@map` (vd `donViGiao` → cột `don_vi_giao`): trigger và câu nạp chạy SQL thô nên
 * phải gọi TÊN CỘT THẬT. Gọi tên trường thì migration dừng giữa deploy (cột không tồn tại) — hoặc tệ
 * hơn, trigger lỗi → EXCEPTION đặt NULL mọi cột bóng của dòng mà ghi vẫn "thành công".
 */
const KHAI: KhaiThucThe = {
  thucThe: 'vu-an',
  bang: 'cases',
  model: 'Case',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'caseCode' },
    {
      key: 'donViGiao',
      nhan: 'Đơn vị giao',
      kieu: 'chu',
      cot: 'donViGiao',
      cotDb: 'don_vi_giao',
    },
    { key: 'tomTat', nhan: 'Tóm tắt', kieu: 'chu', cot: 'moTaChiTiet' },
  ],
};

describe('cotDb — tên cột thật của trường có @map', () => {
  const sql = sinhMigrationTimKiem([KHAI]);

  it('trigger đọc cột thật; cột bóng + field Prisma vẫn đặt theo tên trường', () => {
    expect(sql).toContain(
      `NEW."don_vi_giao_bd" := ' ' || f_bo_dau(NEW."don_vi_giao");`,
    );
    expect(sql).not.toContain('NEW."donViGiao"');
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF [^\n]*"don_vi_giao"/);
    expect(truongPrismaCanCo([KHAI])).toContainEqual({
      model: 'Case',
      field: 'donViGiaoBd',
      cot: 'don_vi_giao_bd',
    });
  });

  it('cột ghép "tất cả các cột" và câu nạp cũng dùng cột thật', () => {
    expect(sql).toMatch(/concat_ws\(' ', NEW\."caseCode", NEW\."don_vi_giao"/);
    const nap = sinhCauNapCotBong(KHAI);
    expect(nap.nap).toContain(`f_bo_dau("don_vi_giao")`);
    expect(nap.nap).not.toContain('"donViGiao"');
  });
});

describe('cotDbLech — đối chiếu khai với @map trong schema.prisma', () => {
  const schema = [
    'model Case {',
    '  caseCode    String? @unique',
    '  donViGiao   String? @map("don_vi_giao") // ghi chú',
    '  moTaChiTiet String?',
    '}',
  ].join('\n');

  it('khai khớp schema → không lệch', () => {
    expect(cotDbLech(schema, [KHAI])).toEqual([]);
  });

  it('quên cotDb cho trường có @map → báo lệch', () => {
    const quen: KhaiThucThe = {
      ...KHAI,
      truong: KHAI.truong.map((t) => ({ ...t, cotDb: undefined })),
    };
    expect(cotDbLech(schema, [quen])).toEqual([
      { model: 'Case', field: 'donViGiao', khai: 'donViGiao', schema: 'don_vi_giao' },
    ]);
  });

  it('khai cotDb cho trường KHÔNG có @map → báo lệch', () => {
    const thua: KhaiThucThe = {
      ...KHAI,
      truong: [
        ...KHAI.truong,
        {
          key: 'x',
          nhan: 'X',
          kieu: 'chu',
          cot: 'moTaChiTiet',
          cotDb: 'mo_ta',
        },
      ],
    };
    expect(cotDbLech(schema, [thua])).toEqual([
      { model: 'Case', field: 'moTaChiTiet', khai: 'mo_ta', schema: 'moTaChiTiet' },
    ]);
  });

  it('trường không có trong model → báo lệch (khai sai tên)', () => {
    const sai: KhaiThucThe = {
      ...KHAI,
      truong: [{ key: 'y', nhan: 'Y', kieu: 'chu', cot: 'khongCo' }],
    };
    expect(cotDbLech(schema, [sai])).toEqual([
      { model: 'Case', field: 'khongCo', khai: 'khongCo', schema: null },
    ]);
  });
});
