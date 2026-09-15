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

export type KieuTruong =
  | 'chu'
  | 'ma'
  | 'ma-cu'
  | 'ngay'
  | 'chon'
  | 'nguoi'
  | 'doi-tuong';

export interface TruongTimKiem {
  /** Khoá thẻ trên URL — tên CHUẨN liên thực thể. */
  key: string;
  nhan: string;
  kieu: KieuTruong;
  /** Cột Prisma (camelCase) — bắt buộc trừ kiểu `nguoi`. */
  cot?: string;
  /**
   * Tên cột THẬT trong CSDL khi trường Prisma có `@map` (vd `donViGiao` → `don_vi_giao`). Trigger và
   * câu nạp chạy SQL thô nên phải gọi tên này; cổng `cotDbLech` đối chiếu với schema.prisma.
   */
  cotDb?: string;
  /**
   * Quan hệ — bắt buộc với kiểu `nguoi` (tới `User`, lọc qua `users.ho_ten_bd`) và `doi-tuong`
   * (danh sách `Subject`, lọc qua `subjects.full_name_bd`).
   */
  quanHe?: string;
  /** Kiểu `doi-tuong`: chỉ tính đối tượng loại này (vd `SUSPECT` cho cột "Đối tượng bị can"). */
  loaiDoiTuong?: string;
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
/** Cột gốc của `users.ho_ten_bd` — thẻ kiểu người lùi về đúng các cột này khi cột bóng rỗng. */
export const COT_NGUON_HO_TEN = ['lastName', 'firstName', 'username'] as const;

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
    if (t.kieu === 'nguoi' || t.kieu === 'doi-tuong') {
      if (!t.quanHe)
        throw new Error(`Trường "${t.key}" (kiểu ${t.kieu}) thiếu quanHe`);
      kiemTen(t.quanHe, 'quan hệ');
    } else {
      if (!t.cot)
        throw new Error(`Trường "${t.key}" (kiểu ${t.kieu}) thiếu cot`);
      kiemTen(t.cot, 'nguồn');
      if (t.cotDb) kiemTen(t.cotDb, 'CSDL');
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

/** Tên cột CSDL của một trường Prisma trong khai — `cotDb` nếu có `@map`, không thì chính tên trường. */
const tenCotDb = (khai: KhaiThucThe, cot: string): string =>
  khai.truong.find((t) => t.cot === cot && t.cotDb)?.cotDb ?? cot;

const coTruongNguoi = (khais: readonly KhaiThucThe[]) =>
  khais.some((k) => k.truong.some((t) => t.kieu === 'nguoi'));

const COT_DOI_TUONG = { cot: 'full_name_bd', field: 'fullNameBd' } as const;
/** Cột gốc của `subjects.full_name_bd` — thẻ kiểu đối tượng lùi về đúng cột này khi cột bóng rỗng. */
export const COT_NGUON_DOI_TUONG = ['fullName'] as const;

const coTruongDoiTuong = (khais: readonly KhaiThucThe[]) =>
  khais.some((k) => k.truong.some((t) => t.kieu === 'doi-tuong'));

const moi = (cot: string) => `NEW."${cot}"`;
const ghep = (cots: readonly string[]) =>
  `concat_ws(' ', ${cots.map(moi).join(', ')})`;

interface Gan {
  cotBong: string;
  bieuThuc: string;
}

const tenHam = (bang: string) => `pc02_dat_tim_kiem_${bang}`;

/** Thân hàm trigger — CÙNG một nguồn cho migration và SQL bật lại khẩn. */
function thanHam(bang: string, gan: readonly Gan[]): string[] {
  const ham = tenHam(bang);
  return [
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
  ];
}

function khoiBang(
  bang: string,
  gan: readonly Gan[],
  cotNguon: readonly string[],
): string {
  const ham = tenHam(bang);
  const trigger = `pc02_tim_kiem_${bang}`;
  return [
    ...gan.map(
      (g) =>
        `ALTER TABLE "${bang}" ADD COLUMN IF NOT EXISTS "${g.cotBong}" text;`,
    ),
    '',
    ...thanHam(bang, gan),
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
    // Máy chủ hỏi "còn dòng chưa nạp không" để quyết có lùi về cột gốc — chỉ mục một phần làm câu
    // hỏi tức thì (không có nó, chính câu hỏi quét cả bảng).
    ...(gan.some((g) => g.cotBong === COT_TAT_CA.cot)
      ? [
          `CREATE INDEX IF NOT EXISTS "${bang}_${COT_TAT_CA.cot}_chua_nap" ON "${bang}" ("id") WHERE "${COT_TAT_CA.cot}" IS NULL;`,
        ]
      : []),
  ].join('\n');
}

/**
 * "Còn dòng chưa nạp cột bóng không" — trigger, CLI nạp và SQL tắt khẩn luôn đặt MỌI cột bóng của
 * một dòng cùng lúc, nên hỏi cột ghép là đủ. Dùng chỉ mục một phần `<bang>_tim_kiem_bd_chua_nap`.
 */
export function sinhCauConChuaNap(khai: KhaiThucThe): string {
  kiemKhai(khai);
  return `SELECT EXISTS (SELECT 1 FROM "${khai.bang}" WHERE "${COT_TAT_CA.cot}" IS NULL) AS co`;
}

interface KhoiTrigger {
  tieuDe: string;
  bang: string;
  gan: Gan[];
  cotNguon: readonly string[];
}

/** Mỗi bảng có trigger tìm kiếm — thứ tự và nội dung dùng chung cho migration lẫn SQL vận hành. */
function cacKhoiTrigger(khais: readonly KhaiThucThe[]): KhoiTrigger[] {
  khais.forEach(kiemKhai);
  const ra: KhoiTrigger[] = [];
  if (coTruongNguoi(khais)) {
    ra.push({
      tieuDe:
        '-- ── users: họ tên người nhập / cán bộ (thẻ kiểu người lọc qua quan hệ) ──',
      bang: 'users',
      gan: [{ cotBong: COT_HO_TEN.cot, bieuThuc: ghep(COT_NGUON_HO_TEN) }],
      cotNguon: COT_NGUON_HO_TEN,
    });
  }
  if (coTruongDoiTuong(khais)) {
    ra.push({
      tieuDe:
        '-- ── subjects: họ tên đối tượng (thẻ kiểu đối tượng lọc qua quan hệ) ──',
      bang: 'subjects',
      gan: [
        { cotBong: COT_DOI_TUONG.cot, bieuThuc: ghep(COT_NGUON_DOI_TUONG) },
      ],
      cotNguon: COT_NGUON_DOI_TUONG,
    });
  }
  for (const khai of khais) {
    const cotDbTatCa = cotTatCa(khai).map((c) => tenCotDb(khai, c));
    ra.push({
      tieuDe: `-- ── ${khai.bang} (${khai.thucThe}) ──`,
      bang: khai.bang,
      gan: [
        ...cotChu(khai).map((c) => ({
          cotBong: cotBongCua(c).cot,
          bieuThuc: moi(tenCotDb(khai, c)),
        })),
        { cotBong: COT_TAT_CA.cot, bieuThuc: ghep(cotDbTatCa) },
      ],
      cotNguon: cotDbTatCa,
    });
  }
  return ra;
}

const DONG_SINH_TU_DONG =
  '-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/khai/*.khai.ts bằng `npm run gen:tim-kiem` — không sửa tay.';

export function sinhMigrationTimKiem(khais: readonly KhaiThucThe[]): string {
  const phan: string[] = [
    DONG_SINH_TU_DONG,
    '--',
    '-- Cột bóng bỏ dấu cho ô tìm dạng thẻ. Migration KHÔNG điền dữ liệu cũ: đo 15/09/2026 trên 47.169',
    '-- đơn thư, điền trong migration khoá bảng ~50 giây lúc deploy. Điền bằng CLI theo lô sau deploy;',
    '-- trong lúc chưa điền, thẻ chữ lùi về cột gốc cho dòng có cột bóng rỗng.',
    '',
    'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
    '',
    sinhHamFBoDau(),
  ];
  for (const k of cacKhoiTrigger(khais)) {
    phan.push('', k.tieuDe, khoiBang(k.bang, k.gan, k.cotNguon));
  }
  return `${phan.join('\n')}\n`;
}

/**
 * TẮT KHẨN trigger tìm kiếm: thay thân hàm bằng bản chỉ đặt cột bóng NULL. Không gỡ trigger — gỡ
 * thì cột bóng CŨ nằm lại trên dòng đã sửa và thẻ trả sai; NULL thì thẻ lùi về cột gốc, vẫn đúng.
 */
export function sinhSqlTatTimKiem(khais: readonly KhaiThucThe[]): string {
  const dong: string[] = [
    DONG_SINH_TU_DONG,
    '--',
    '-- TẮT KHẨN trigger tìm kiếm — chạy tay trên CSDL khi trigger cột bóng gây sự cố (ghi hồ sơ chậm,',
    '-- nhật ký PostgreSQL đầy cảnh báo `pc02_dat_tim_kiem_*`, hàm f_bo_dau hỏng). Không cần deploy.',
    '--',
    '-- Làm gì: thay thân hàm trigger bằng bản chỉ đặt cột bóng = NULL. Dòng được sửa từ lúc này có cột',
    '-- bóng NULL, thẻ tìm kiếm LÙI VỀ CỘT GỐC cho dòng ấy — kết quả vẫn đúng, chỉ chậm hơn. KHÔNG gỡ',
    '-- trigger: gỡ thì cột bóng cũ nằm lại trên dòng đã sửa và thẻ trả SAI mà không ai biết.',
    '-- Không đụng dữ liệu nghiệp vụ, không đổi cấu trúc bảng.',
    '--',
    '-- Muốn giấu luôn ô thẻ trên giao diện: tắt cờ tính năng TIM_KIEM_THE (màn danh sách trở lại ô chữ cũ).',
    '-- Bật lại: chạy docs/van-hanh/bat-lai-trigger-tim-kiem.sql rồi nạp lại cột bóng (chỉ dẫn trong tệp ấy).',
    '--',
    '-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/van-hanh/tat-trigger-tim-kiem.sql',
    '',
    'BEGIN;',
  ];
  for (const k of cacKhoiTrigger(khais)) {
    dong.push(
      '',
      k.tieuDe,
      `CREATE OR REPLACE FUNCTION ${tenHam(k.bang)}() RETURNS trigger`,
      'LANGUAGE plpgsql AS $$',
      'BEGIN',
      ...k.gan.map((g) => `  NEW."${g.cotBong}" := NULL;`),
      '  RETURN NEW;',
      'END $$;',
    );
  }
  dong.push('', 'COMMIT;');
  return `${dong.join('\n')}\n`;
}

/** BẬT LẠI sau khi đã tắt khẩn — thân hàm nguyên văn như migration. */
export function sinhSqlBatLaiTimKiem(khais: readonly KhaiThucThe[]): string {
  const dong: string[] = [
    DONG_SINH_TU_DONG,
    '--',
    '-- BẬT LẠI trigger tìm kiếm sau khi đã chạy tat-trigger-tim-kiem.sql — thân hàm y hệt migration.',
    '--',
    '-- Sau khi chạy: dòng sửa trong lúc tắt đang có cột bóng NULL (thẻ vẫn đúng nhờ lùi về cột gốc).',
    '-- Nạp lại để chúng dùng lại chỉ mục, từ thư mục backend đang chạy:',
    '--   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js          # chạy thử, đếm dòng lệch',
    '--   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that   # nạp theo lô, không đẩy updatedAt',
    '--',
    '-- Chạy: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/van-hanh/bat-lai-trigger-tim-kiem.sql',
    '',
    'BEGIN;',
    '',
    sinhHamFBoDau(),
  ];
  for (const k of cacKhoiTrigger(khais)) {
    dong.push('', k.tieuDe, ...thanHam(k.bang, k.gan));
  }
  dong.push('', 'COMMIT;');
  return `${dong.join('\n')}\n`;
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
  if (coTruongDoiTuong(khais)) ra.push({ model: 'Subject', ...COT_DOI_TUONG });
  return ra;
}

/** Có trường kiểu người → phải nạp `users.ho_ten_bd`. */
export const canNapHoTen = coTruongNguoi;
/** Có trường kiểu đối tượng → phải nạp `subjects.full_name_bd`. */
export const canNapDoiTuong = coTruongDoiTuong;

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
      bieuThuc: cotDong(tenCotDb(khai, c)),
    })),
    {
      cotBong: COT_TAT_CA.cot,
      bieuThuc: ghepDong(cotTatCa(khai).map((c) => tenCotDb(khai, c))),
    },
  ]);
}

export function sinhCauNapHoTen(): CauNap {
  return cauNap('users', [
    { cotBong: COT_HO_TEN.cot, bieuThuc: ghepDong(COT_NGUON_HO_TEN) },
  ]);
}

export function sinhCauNapDoiTuong(): CauNap {
  return cauNap('subjects', [
    { cotBong: COT_DOI_TUONG.cot, bieuThuc: ghepDong(COT_NGUON_DOI_TUONG) },
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
    "export type KieuTruongTimKiem = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi' | 'doi-tuong';",
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
