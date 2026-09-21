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
      {
        model: 'Case',
        field: 'donViGiao',
        khai: 'donViGiao',
        schema: 'don_vi_giao',
      },
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
      {
        model: 'Case',
        field: 'moTaChiTiet',
        khai: 'mo_ta',
        schema: 'moTaChiTiet',
      },
    ]);
  });

  /** Trường ngày/chọn chỉ đi qua Prisma bằng tên trường — `@map` của chúng không vào SQL thô. */
  it('trường ngày có @map không cần cotDb; trường ngày sai tên vẫn bị báo', () => {
    const schemaNgay = schema.replace(
      '}',
      '  ngayTiepNhan DateTime? @map("ngay_tiep_nhan")\n}',
    );
    const coNgay: KhaiThucThe = {
      ...KHAI,
      truong: [
        ...KHAI.truong,
        {
          key: 'ngayTiepNhan',
          nhan: 'Ngày',
          kieu: 'ngay',
          cot: 'ngayTiepNhan',
        },
      ],
    };
    expect(cotDbLech(schemaNgay, [coNgay])).toEqual([]);

    const saiTen: KhaiThucThe = {
      ...KHAI,
      truong: [
        ...KHAI.truong,
        { key: 'x', nhan: 'X', kieu: 'ngay', cot: 'ngayKhongCo' },
      ],
    };
    expect(cotDbLech(schemaNgay, [saiTen])).toEqual([
      {
        model: 'Case',
        field: 'ngayKhongCo',
        khai: 'ngayKhongCo',
        schema: null,
      },
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

/**
 * `cotThemVaoTatCa` — LỖ HỔNG cùng loại, phát hiện 21/09/2026.
 *
 * `tenCotDb` chỉ tra `khai.truong`, còn `cotTatCa` nối THẲNG `cotThemVaoTatCa` vào biểu thức ghép.
 * Nên một cột có `@map` đưa vào đường này sinh ra `NEW."tenCamelCase"` — tên không tồn tại.
 *
 * Và đây là chỗ nó khác hẳn một migration hỏng bình thường: plpgsql KHÔNG kiểm tên cột lúc
 * `CREATE FUNCTION`. Lỗi nổ LÚC CHẠY, rơi vào `EXCEPTION WHEN OTHERS` rồi đặt cột bóng := NULL.
 * Ghi vẫn "thành công". Mọi dòng mới có cột bóng NULL → `luiCotGoc` bật vĩnh viễn → cả hệ quét
 * bảng mãi mãi, chỉ còn một `RAISE WARNING` trong log PostgreSQL mà không cổng nào đỏ.
 */
const KHAI_THEM: KhaiThucThe = {
  ...KHAI,
  cotThemVaoTatCa: [{ cot: 'ghiChuKhac', cotDb: 'ghi_chu_khac' }, 'soHoSoCu'],
};

describe('cotThemVaoTatCa — cũng phải đi qua cotDb', () => {
  const sql = sinhMigrationTimKiem([KHAI_THEM]);

  it('cột có @map trong danh sách thêm: biểu thức ghép dùng TÊN CỘT THẬT', () => {
    expect(sql).toContain('NEW."ghi_chu_khac"');
    expect(sql).not.toContain('NEW."ghiChuKhac"');
  });

  it('và cột ấy nằm trong `UPDATE OF` — thiếu là sửa hồ sơ xong tìm không ra', () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF [^\n]*"ghi_chu_khac"/);
  });

  it('cột KHÔNG có @map trong danh sách thêm vẫn giữ nguyên tên', () => {
    expect(sql).toContain('NEW."soHoSoCu"');
  });

  it('câu nạp lại cột bóng cũng dùng tên cột thật', () => {
    const nap = sinhCauNapCotBong(KHAI_THEM);
    expect(nap.nap).toContain('"ghi_chu_khac"');
    expect(nap.nap).not.toContain('"ghiChuKhac"');
  });

  it('cotDbLech soi CẢ danh sách thêm, không chỉ `truong`', () => {
    const schemaThem = [
      'model Case {',
      '  caseCode    String? @unique',
      '  donViGiao   String? @map("don_vi_giao")',
      '  moTaChiTiet String?',
      '  ghiChuKhac  String? @map("ghi_chu_khac")',
      '  soHoSoCu    String?',
      '}',
    ].join('\n');
    expect(cotDbLech(schemaThem, [KHAI_THEM])).toEqual([]);

    // Khai quên `cotDb` cho một cột CÓ @map — đúng kịch bản làm cột bóng NULL vĩnh viễn.
    const quenCotDb: KhaiThucThe = {
      ...KHAI,
      cotThemVaoTatCa: ['ghiChuKhac'],
    };
    expect(cotDbLech(schemaThem, [quenCotDb])).toEqual([
      {
        model: 'Case',
        field: 'ghiChuKhac',
        khai: 'ghiChuKhac',
        schema: 'ghi_chu_khac',
      },
    ]);
  });
});
