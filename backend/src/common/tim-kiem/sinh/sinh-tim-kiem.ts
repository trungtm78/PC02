import { sinhHamFBoDau } from '../bo-dau';

/**
 * Bộ sinh tìm kiếm: MỘT tệp khai mỗi thực thể (`khai/*.khai.ts`) → ba sản phẩm phải khớp nhau:
 *   1. migration SQL — cột bóng `<cot>_bd`, trigger giữ chúng, chỉ mục GIN trigram;
 *   2. danh sách field chỉ đọc cần có trong `schema.prisma`;
 *   3. `frontend/src/shared/tim-kiem/generated.ts` — khoá · nhãn · kiểu cho ô tìm dạng thẻ.
 *
 * Hàm THUẦN: CLI `scripts/gen-tim-kiem.ts` ghi tệp, cổng `tim-kiem-sinh-khop.gate.spec.ts` so tệp
 * đã commit với đầu ra ở đây — quên chạy bộ sinh là đỏ.
 */

export type KieuTruong = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi';

export interface TruongTimKiem {
  /** Khoá thẻ trên URL — tên CHUẨN liên thực thể. */
  key: string;
  nhan: string;
  kieu: KieuTruong;
  /** Cột Prisma (camelCase) — bắt buộc trừ kiểu `nguoi`. */
  cot?: string;
  /** Quan hệ tới `User` — bắt buộc với kiểu `nguoi`. */
  quanHe?: string;
  /**
   * Kiểu `chon`: giá trị được nhận (vd mã enum). Giá trị lạ trả 400 thay vì để Prisma ném 500.
   * Chỉ dùng phía máy chủ — bộ sinh không xuất ra giao diện.
   */
  giaTriHopLe?: readonly string[];
}

export interface KhaiThucThe {
  thucThe: string;
  /** Tên bảng CSDL. */
  bang: string;
  /** Tên model Prisma. */
  model: string;
  truong: readonly TruongTimKiem[];
  /** Cột không hiện trên danh sách nhưng thẻ "tất cả các cột" phải tìm được. */
  cotThemVaoTatCa?: readonly string[];
}

const TEN_HOP_LE = /^[A-Za-z][A-Za-z0-9_]*$/;
const COT_TAT_CA = { cot: 'tim_kiem_bd', field: 'timKiemBd' } as const;
const COT_HO_TEN = { cot: 'ho_ten_bd', field: 'hoTenBd' } as const;
const COT_NGUON_HO_TEN = ['lastName', 'firstName', 'username'] as const;

/** Tên cột bóng (snake_case + `_bd`) và field Prisma (`<cot>Bd`) của một cột nguồn. */
export function cotBongCua(cot: string): { cot: string; field: string } {
  const snake = cot.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return { cot: `${snake}_bd`, field: `${cot}Bd` };
}

function kiemTen(ten: string, loai: string): void {
  if (!TEN_HOP_LE.test(ten)) {
    throw new Error(`Khai tìm kiếm: tên cột ${loai} "${ten}" không hợp lệ`);
  }
}

function kiemKhai(khai: KhaiThucThe): void {
  kiemTen(khai.bang, 'bảng');
  const daCo = new Set<string>();
  for (const t of khai.truong) {
    if (daCo.has(t.key)) {
      throw new Error(`Khai tìm kiếm ${khai.thucThe}: trùng khoá "${t.key}"`);
    }
    daCo.add(t.key);
    if (t.kieu === 'nguoi') {
      if (!t.quanHe)
        throw new Error(`Trường "${t.key}" (kiểu nguoi) thiếu quanHe`);
      kiemTen(t.quanHe, 'quan hệ');
    } else {
      if (!t.cot)
        throw new Error(`Trường "${t.key}" (kiểu ${t.kieu}) thiếu cot`);
      kiemTen(t.cot, 'nguồn');
    }
  }
  for (const c of khai.cotThemVaoTatCa ?? []) kiemTen(c, 'thêm');
}

const cotChu = (khai: KhaiThucThe) =>
  khai.truong.filter((t) => t.kieu === 'chu').map((t) => t.cot as string);

/** Cột ghép vào "tất cả các cột": chữ + mã + cột thêm, theo thứ tự khai. */
const cotTatCa = (khai: KhaiThucThe) => [
  ...khai.truong
    .filter((t) => t.kieu === 'chu' || t.kieu === 'ma' || t.kieu === 'ma-cu')
    .map((t) => t.cot as string),
  ...(khai.cotThemVaoTatCa ?? []),
];

const coTruongNguoi = (khais: readonly KhaiThucThe[]) =>
  khais.some((k) => k.truong.some((t) => t.kieu === 'nguoi'));

const moi = (cot: string) => `NEW."${cot}"`;
const ghep = (cots: readonly string[]) =>
  `concat_ws(' ', ${cots.map(moi).join(', ')})`;

interface Gan {
  cotBong: string;
  bieuThuc: string;
}

function khoiBang(
  bang: string,
  gan: readonly Gan[],
  cotNguon: readonly string[],
): string {
  const ham = `pc02_dat_tim_kiem_${bang}`;
  const trigger = `pc02_tim_kiem_${bang}`;
  return [
    ...gan.map(
      (g) =>
        `ALTER TABLE "${bang}" ADD COLUMN IF NOT EXISTS "${g.cotBong}" text;`,
    ),
    '',
    `CREATE OR REPLACE FUNCTION ${ham}() RETURNS trigger`,
    'LANGUAGE plpgsql AS $$',
    'BEGIN',
    ...gan.map(
      (g) => `  NEW."${g.cotBong}" := ' ' || f_bo_dau(${g.bieuThuc});`,
    ),
    '  RETURN NEW;',
    // Trigger hỏng không được chặn thao tác ghi nghiệp vụ: để cột bóng rỗng (thẻ lùi về cột gốc)
    // và cảnh báo vào nhật ký PostgreSQL.
    'EXCEPTION WHEN OTHERS THEN',
    `  RAISE WARNING '${ham}: %', SQLERRM;`,
    ...gan.map((g) => `  NEW."${g.cotBong}" := NULL;`),
    '  RETURN NEW;',
    'END $$;',
    '',
    `DROP TRIGGER IF EXISTS ${trigger} ON "${bang}";`,
    `CREATE TRIGGER ${trigger}`,
    `  BEFORE INSERT OR UPDATE OF ${cotNguon.map((c) => `"${c}"`).join(', ')} ON "${bang}"`,
    `  FOR EACH ROW EXECUTE FUNCTION ${ham}();`,
    '',
    ...gan.map(
      (g) =>
        `CREATE INDEX IF NOT EXISTS "${bang}_${g.cotBong}_trgm" ON "${bang}" USING gin ("${g.cotBong}" gin_trgm_ops);`,
    ),
  ].join('\n');
}

export function sinhMigrationTimKiem(khais: readonly KhaiThucThe[]): string {
  khais.forEach(kiemKhai);
  const phan: string[] = [
    '-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/khai/*.khai.ts bằng `npm run gen:tim-kiem` — không sửa tay.',
    '--',
    '-- Cột bóng bỏ dấu cho ô tìm dạng thẻ. Migration KHÔNG điền dữ liệu cũ: đo 15/09/2026 trên 47.169',
    '-- đơn thư, điền trong migration khoá bảng ~50 giây lúc deploy. Điền bằng CLI theo lô sau deploy;',
    '-- trong lúc chưa điền, thẻ chữ lùi về cột gốc cho dòng có cột bóng rỗng.',
    '',
    'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
    '',
    sinhHamFBoDau(),
  ];

  if (coTruongNguoi(khais)) {
    phan.push(
      '',
      '-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──',
      khoiBang(
        'users',
        [{ cotBong: COT_HO_TEN.cot, bieuThuc: ghep(COT_NGUON_HO_TEN) }],
        COT_NGUON_HO_TEN,
      ),
    );
  }

  for (const khai of khais) {
    const gan: Gan[] = [
      ...cotChu(khai).map((c) => ({
        cotBong: cotBongCua(c).cot,
        bieuThuc: moi(c),
      })),
      { cotBong: COT_TAT_CA.cot, bieuThuc: ghep(cotTatCa(khai)) },
    ];
    phan.push(
      '',
      `-- ── ${khai.bang} (${khai.thucThe}) ──`,
      khoiBang(khai.bang, gan, cotTatCa(khai)),
    );
  }
  return `${phan.join('\n')}\n`;
}

export interface TruongPrisma {
  model: string;
  field: string;
  cot: string;
}

export function truongPrismaCanCo(
  khais: readonly KhaiThucThe[],
): TruongPrisma[] {
  khais.forEach(kiemKhai);
  const ra: TruongPrisma[] = [];
  for (const khai of khais) {
    for (const c of cotChu(khai))
      ra.push({ model: khai.model, ...cotBongCua(c) });
    ra.push({ model: khai.model, ...COT_TAT_CA });
  }
  if (coTruongNguoi(khais)) ra.push({ model: 'User', ...COT_HO_TEN });
  return ra;
}

/** Có trường kiểu người → phải nạp `users.ho_ten_bd`. */
export const canNapHoTen = coTruongNguoi;

/**
 * Cột gốc ghép vào `tim_kiem_bd` — CÙNG danh sách trigger dùng. Điều kiện thẻ "tất cả các cột" lùi
 * về đúng các cột này khi cột ghép chưa được nạp.
 */
export const cotGhepTatCa = cotTatCa;

const cotDong = (cot: string) => `"${cot}"`;
const ghepDong = (cots: readonly string[]) =>
  `concat_ws(' ', ${cots.map(cotDong).join(', ')})`;

export interface CauNap {
  /** Đếm dòng có cột bóng lệch cột nguồn (cả bảng). */
  dem: string;
  /** Lấy tối đa `$2` id sau con trỏ `$1`, sắp theo id — đi theo khoá chính. */
  layLo: string;
  /** Ghi cột bóng cho các id `$1` của lô, CHỈ dòng lệch. */
  nap: string;
}

/**
 * Câu nạp cột bóng cho dữ liệu cũ — CÙNG biểu thức trigger, chỉ đổi `NEW."x"` thành `"x"`.
 * Chỉ SET cột bóng: SET cột nguồn sẽ kích trigger (và trigger `sttSort`) trên cả bảng.
 *
 * Theo con trỏ id chứ không "lấy N dòng lệch đầu tiên": cách sau buộc lô thứ k đi qua lại mọi dòng
 * các lô trước đã sửa (đo trên 47.169 đơn thư: ~15 s mỗi lô).
 */
function cauNap(bang: string, gan: readonly Gan[]): CauNap {
  const bieu = (g: Gan) => `' ' || f_bo_dau(${g.bieuThuc})`;
  const lech = gan
    .map((g) => `"${g.cotBong}" IS DISTINCT FROM ${bieu(g)}`)
    .join(' OR ');
  const set = gan.map((g) => `"${g.cotBong}" = ${bieu(g)}`).join(', ');
  return {
    dem: `SELECT count(*)::int AS n FROM "${bang}" WHERE ${lech}`,
    layLo: `SELECT id FROM "${bang}" WHERE id > $1 ORDER BY id LIMIT $2`,
    nap: `UPDATE "${bang}" SET ${set} WHERE id = ANY($1::text[]) AND (${lech})`,
  };
}

export function sinhCauNapCotBong(khai: KhaiThucThe): CauNap {
  kiemKhai(khai);
  return cauNap(khai.bang, [
    ...cotChu(khai).map((c) => ({
      cotBong: cotBongCua(c).cot,
      bieuThuc: cotDong(c),
    })),
    { cotBong: COT_TAT_CA.cot, bieuThuc: ghepDong(cotTatCa(khai)) },
  ]);
}

export function sinhCauNapHoTen(): CauNap {
  return cauNap('users', [
    { cotBong: COT_HO_TEN.cot, bieuThuc: ghepDong(COT_NGUON_HO_TEN) },
  ]);
}

const chuoiTs = (s: string) =>
  `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function sinhFrontendTimKiem(khais: readonly KhaiThucThe[]): string {
  khais.forEach(kiemKhai);
  const dong = [
    '// AUTO-GENERATED — SINH TỰ ĐỘNG bởi `cd backend && npm run gen:tim-kiem` — không sửa tay.',
    '// Nguồn: backend/src/common/tim-kiem/khai/*.khai.ts',
    '',
    "export type KieuTruongTimKiem = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi';",
  ];
  for (const khai of khais) {
    const ten = khai.thucThe.toUpperCase().replace(/-/g, '_');
    dong.push('', `export const TIM_KIEM_${ten} = [`);
    for (const t of khai.truong) {
      dong.push(
        `  { key: ${chuoiTs(t.key)}, nhan: ${chuoiTs(t.nhan)}, kieu: ${chuoiTs(t.kieu)} },`,
      );
    }
    dong.push('] as const;');
  }
  return `${dong.join('\n')}\n`;
}
