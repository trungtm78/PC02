import { sinhHamFBoDau } from '../bo-dau';
import {
  cotBongCua,
  sinhCauConChuaNap,
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from './sinh-tim-kiem';

/**
 * Bộ sinh tìm kiếm: MỘT tệp khai → migration SQL + field Prisma + khoá thẻ phía giao diện.
 *
 * Khai ở ba nơi (SQL, TypeScript, giao diện) là ba nơi trôi khỏi nhau — bẫy "hai chiều một quy
 * ước" đã cắn dự án nhiều lần. Ca kiểm dưới đây chốt phần dễ hỏng: cột nguồn của trigger, khối
 * EXCEPTION không chặn ghi nghiệp vụ, và KHÔNG backfill trong migration (đo T0: khoá bảng ~50 s).
 */
const KHAI: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'stt' },
    { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', cot: 'senderName' },
    { key: 'tomTat', nhan: 'Tóm tắt', kieu: 'chu', cot: 'detailContent' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'enteredBy',
    },
    { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', cot: 'status' },
  ],
  cotThemVaoTatCa: ['soHoSoCu'],
};

describe('cotBongCua', () => {
  it.each([
    ['senderName', { cot: 'sender_name_bd', field: 'senderNameBd' }],
    ['detailContent', { cot: 'detail_content_bd', field: 'detailContentBd' }],
    ['nguonDon', { cot: 'nguon_don_bd', field: 'nguonDonBd' }],
    [
      'ketQuaXuLyKhac',
      { cot: 'ket_qua_xu_ly_khac_bd', field: 'ketQuaXuLyKhacBd' },
    ],
  ])('%s → %j', (cot, ra) => {
    expect(cotBongCua(cot)).toEqual(ra);
  });
});

describe('sinhMigrationTimKiem', () => {
  const sql = sinhMigrationTimKiem([KHAI]);

  it('tạo hàm f_bo_dau từ CÙNG bảng bỏ dấu (không unaccent)', () => {
    expect(sql).toContain(sinhHamFBoDau());
    expect(sql).not.toMatch(/unaccent/i);
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  });

  it('thêm cột bóng cho mọi trường chữ + cột "tất cả các cột", KHÔNG cho ngày/chọn/mã', () => {
    expect(sql).toContain(
      'ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "sender_name_bd" text;',
    );
    expect(sql).toContain(
      'ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "detail_content_bd" text;',
    );
    expect(sql).toContain(
      'ALTER TABLE "petitions" ADD COLUMN IF NOT EXISTS "tim_kiem_bd" text;',
    );
    expect(sql).not.toMatch(/ngay_de_xuat_bd|status_bd|stt_bd/);
  });

  it('cột bóng = khoảng trắng đầu + f_bo_dau (khớp đầu từ bằng contains " x")', () => {
    expect(sql).toContain(
      `NEW."sender_name_bd" := ' ' || f_bo_dau(NEW."senderName");`,
    );
  });

  it('cột "tất cả các cột" ghép trường chữ + mã + cột thêm, theo thứ tự khai', () => {
    expect(sql).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."stt", NEW."senderName", NEW."detailContent", NEW."soHoSoCu"));`,
    );
  });

  /** Trigger chỉ chạy khi cột NGUỒN đổi — sửa trạng thái không tính lại chữ, không khuếch đại ghi. */
  it('trigger BEFORE INSERT OR UPDATE OF đúng cột nguồn', () => {
    expect(sql).toContain(
      'CREATE TRIGGER pc02_tim_kiem_petitions\n  BEFORE INSERT OR UPDATE OF "stt", "senderName", "detailContent", "soHoSoCu" ON "petitions"',
    );
    expect(sql).toContain(
      'DROP TRIGGER IF EXISTS pc02_tim_kiem_petitions ON "petitions";',
    );
  });

  /** Trigger hỏng KHÔNG được làm 500 mọi thao tác ghi đơn thư — để cột bóng NULL + cảnh báo. */
  it('lỗi trong trigger → cột bóng NULL + RAISE WARNING, vẫn RETURN NEW', () => {
    const than = sql.slice(sql.indexOf('FUNCTION pc02_dat_tim_kiem_petitions'));
    expect(than).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(than).toMatch(/NEW\."sender_name_bd" := NULL;/);
    expect(than).toMatch(/NEW\."tim_kiem_bd" := NULL;/);
    expect(than).toMatch(/RAISE WARNING/);
    expect(than.match(/RETURN NEW;/g)?.length).toBe(2);
  });

  it('chỉ mục GIN trigram cho từng cột bóng, KHÔNG CONCURRENTLY (Prisma chạy trong giao dịch)', () => {
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "petitions_sender_name_bd_trgm" ON "petitions" USING gin ("sender_name_bd" gin_trgm_ops);',
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "petitions_tim_kiem_bd_trgm" ON "petitions" USING gin ("tim_kiem_bd" gin_trgm_ops);',
    );
    expect(sql).not.toMatch(/CONCURRENTLY/i);
  });

  /**
   * Máy chủ chỉ lùi về cột gốc khi CÒN dòng chưa nạp — hỏi bằng EXISTS trên chỉ mục một phần,
   * nên câu hỏi tức thì dù bảng lớn. Không có chỉ mục này thì chính câu hỏi lại quét cả bảng.
   */
  it('chỉ mục một phần cho dòng chưa nạp cột ghép + câu hỏi dùng đúng điều kiện ấy', () => {
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "petitions_tim_kiem_bd_chua_nap" ON "petitions" ("id") WHERE "tim_kiem_bd" IS NULL;',
    );
    expect(sinhCauConChuaNap(KHAI)).toBe(
      'SELECT EXISTS (SELECT 1 FROM "petitions" WHERE "tim_kiem_bd" IS NULL) AS co',
    );
  });

  /** Đo T0: UPDATE 47k dòng + dựng GIN = ~50 s khoá bảng lúc deploy. Nạp bằng CLI theo lô. */
  it('KHÔNG backfill trong migration', () => {
    expect(sql).not.toMatch(/^\s*UPDATE\s/im);
  });

  it('có trường người → cột bóng họ tên trên users + trigger theo cột tên', () => {
    expect(sql).toContain(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ho_ten_bd" text;',
    );
    expect(sql).toContain(
      `NEW."ho_ten_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."lastName", NEW."firstName", NEW."username"));`,
    );
    expect(sql).toContain(
      'BEFORE INSERT OR UPDATE OF "lastName", "firstName", "username" ON "users"',
    );
    expect(sql).toContain('"users_ho_ten_bd_trgm"');
  });

  it('không có trường người → không đụng bảng users', () => {
    const khongNguoi = sinhMigrationTimKiem([
      { ...KHAI, truong: KHAI.truong.filter((t) => t.kieu !== 'nguoi') },
    ]);
    expect(khongNguoi).not.toContain('"users"');
  });

  it('tất định + có dòng đầu nói rõ sinh tự động', () => {
    expect(sinhMigrationTimKiem([KHAI])).toBe(sql);
    expect(sql.split('\n')[0]).toMatch(/SINH TỰ ĐỘNG.*gen:tim-kiem/);
  });

  it('khai sai → ném lỗi rõ ràng thay vì sinh SQL hỏng', () => {
    expect(() =>
      sinhMigrationTimKiem([
        { ...KHAI, truong: [{ key: 'x', nhan: 'X', kieu: 'chu' }] },
      ]),
    ).toThrow(/x.*cot/);
    expect(() =>
      sinhMigrationTimKiem([
        {
          ...KHAI,
          truong: [
            ...KHAI.truong,
            { key: 'stt', nhan: 'Trùng', kieu: 'ma', cot: 'stt' },
          ],
        },
      ]),
    ).toThrow(/trùng khoá.*stt/);
    expect(() =>
      sinhMigrationTimKiem([
        {
          ...KHAI,
          truong: [{ key: 'bad', nhan: 'B', kieu: 'chu', cot: 'a"b' }],
        },
      ]),
    ).toThrow(/tên cột/);
    expect(() =>
      sinhMigrationTimKiem([
        { ...KHAI, truong: [{ key: 'ng', nhan: 'N', kieu: 'nguoi' }] },
      ]),
    ).toThrow(/ng.*quanHe/);
    expect(() =>
      sinhMigrationTimKiem([
        {
          ...KHAI,
          truong: [{ key: 'ng', nhan: 'N', kieu: 'nguoi', quanHe: 'bad name' }],
        },
      ]),
    ).toThrow(/tên cột quan hệ/);
    expect(() =>
      sinhMigrationTimKiem([{ ...KHAI, bang: 'petitions; DROP' }]),
    ).toThrow(/tên cột bảng/);
    expect(() =>
      sinhMigrationTimKiem([{ ...KHAI, cotThemVaoTatCa: ['x-y'] }]),
    ).toThrow(/tên cột thêm/);
  });

  it('khai không có cotThemVaoTatCa → "tất cả các cột" chỉ gồm trường khai', () => {
    const khongThem: KhaiThucThe = {
      thucThe: KHAI.thucThe,
      bang: KHAI.bang,
      model: KHAI.model,
      truong: KHAI.truong,
    };
    const ra = sinhMigrationTimKiem([khongThem]);
    expect(ra).toContain(
      `NEW."tim_kiem_bd" := ' ' || f_bo_dau(concat_ws(' ', NEW."stt", NEW."senderName", NEW."detailContent"));`,
    );
    expect(ra).not.toContain('soHoSoCu');
  });
});

describe('truongPrismaCanCo', () => {
  it('liệt kê field chỉ đọc cần khai trong schema.prisma, theo model', () => {
    expect(truongPrismaCanCo([KHAI])).toEqual([
      { model: 'Petition', field: 'senderNameBd', cot: 'sender_name_bd' },
      { model: 'Petition', field: 'detailContentBd', cot: 'detail_content_bd' },
      { model: 'Petition', field: 'timKiemBd', cot: 'tim_kiem_bd' },
      { model: 'User', field: 'hoTenBd', cot: 'ho_ten_bd' },
    ]);
  });
});

describe('sinhFrontendTimKiem', () => {
  const ts = sinhFrontendTimKiem([KHAI]);

  it('xuất khoá · nhãn · kiểu theo thực thể, không lộ tên cột CSDL', () => {
    expect(ts).toContain('export const TIM_KIEM_DON_THU = [');
    expect(ts).toContain(
      "  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },",
    );
    expect(ts).toContain('] as const;');
    expect(ts).not.toContain('senderName');
    expect(ts).not.toContain('sender_name_bd');
  });

  it('thoát nháy đơn trong nhãn', () => {
    const co = sinhFrontendTimKiem([
      {
        ...KHAI,
        truong: [{ key: 'a', nhan: "Ô'ng", kieu: 'chu', cot: 'nguonDon' }],
      },
    ]);
    expect(co).toContain("nhan: 'Ô\\'ng'");
  });

  it('thoát dấu gạch chéo ngược trong nhãn', () => {
    const co = sinhFrontendTimKiem([
      {
        ...KHAI,
        truong: [{ key: 'a', nhan: 'A\\B', kieu: 'chu', cot: 'nguonDon' }],
      },
    ]);
    expect(co).toContain("nhan: 'A\\\\B'");
  });

  it('dòng đầu nói rõ sinh tự động', () => {
    expect(ts.split('\n')[0]).toMatch(/AUTO-GENERATED|SINH TỰ ĐỘNG/);
  });
});
