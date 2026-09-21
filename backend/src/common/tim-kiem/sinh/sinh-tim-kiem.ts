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
  | 'doi-tuong'
  | 'quan-he'
  | 'ma-thuong';

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
   * Kiểu `quan-he` (quan hệ MỘT-MỘT, vd Luật sư → Vụ án): model đích, field cột bóng CÓ SẴN của đích
   * (vd `nameBd` do `cotBongPhu` của khai Vụ án sinh), và cột gốc của đích để lùi khi cột bóng rỗng. Không dựng
   * trigger riêng — bộ sinh báo lỗi nếu không khai nào sinh cột bóng đích.
   */
  modelDich?: string;
  cotDich?: string;
  cotNguonDich?: readonly string[];
  /**
   * Kiểu `chon`: giá trị được nhận (vd mã enum). Giá trị lạ trả 400 thay vì để Prisma ném 500.
   * Chỉ dùng phía máy chủ — bộ sinh không xuất ra giao diện.
   */
  giaTriHopLe?: readonly string[];
  /**
   * Kiểu `chon` trên cột KHÔNG phải chuỗi (boolean…): giá trị thẻ (luôn là chuỗi trên URL) → giá trị
   * cột thật. Khoá của bảng là danh sách giá trị hợp lệ (lạ → 400); gửi thẳng chuỗi tới cột boolean
   * là Prisma ném lỗi kiểu → 500.
   */
  giaTriCot?: Readonly<Record<string, string | number | boolean>>;
  /**
   * Kiểu `chu`: MỘT cột bóng ghép từ NHIỀU cột nguồn (vd "Họ tên" = họ + tên + tài khoản). `cot` khi
   * ấy là tên gốc của cột bóng (`hoTen` → `ho_ten_bd` / `hoTenBd`), không phải cột thật.
   */
  cotGhep?: readonly string[];
  /**
   * Kiểu `ngay`: cột CHỮ giữ ngày THIẾU thành phần theo EDTF (`2026-12-XX`), dùng khi cột ngày
   * thật rỗng.
   *
   * Đo prod 21/09/2026: 46.741 đơn thư, 41.820 có `petitionDate`, nên ~4.4k đơn chỉ mang
   * `ngayVietDonEdtf`. Không khai cột này thì chúng vô hình với mọi phép lọc ngày — gõ `12/2026`
   * không bao giờ ra. Chỉ đổi điều kiện Prisma, KHÔNG cần sinh lại SQL.
   */
  cotEdtf?: string;
}

/** Một cột thêm vào "tất cả các cột": chuỗi trần khi không có `@map`, object khi có. */
export type CotThem = string | { cot: string; cotDb?: string };

/** Dạng chuẩn hoá của `cotThemVaoTatCa` — dùng chung cho mọi nơi đọc danh sách ấy. */
export const chuanHoaCotThem = (
  ds: readonly CotThem[] | undefined,
): { cot: string; cotDb?: string }[] =>
  (ds ?? []).map((c) => (typeof c === 'string' ? { cot: c } : c));

export interface KhaiThucThe {
  thucThe: string;
  /** Tên bảng CSDL. */
  bang: string;
  /** Tên model Prisma. */
  model: string;
  truong: readonly TruongTimKiem[];
  /**
   * Cột không hiện trên danh sách nhưng thẻ "tất cả các cột" phải tìm được.
   *
   * Cột có `@map` PHẢI khai dạng `{ cot, cotDb }`. Khai bằng chuỗi trần thì biểu thức ghép sinh ra
   * `NEW."tenCamelCase"` — tên không tồn tại. Và plpgsql KHÔNG kiểm tên cột lúc `CREATE FUNCTION`,
   * nên lỗi nổ LÚC CHẠY rồi rơi vào `EXCEPTION WHEN OTHERS` đặt cột bóng := NULL: ghi vẫn "thành
   * công", mọi dòng mới có cột bóng rỗng, `luiCotGoc` bật vĩnh viễn, cả hệ quét bảng mãi mãi.
   * Cổng `cotDbLech` (`tep-sinh.ts`) đối chiếu với `schema.prisma` và chặn đúng việc này.
   */
  cotThemVaoTatCa?: readonly CotThem[];
  /**
   * Cột có cột bóng riêng mà KHÔNG thành khoá thẻ trên bảng này — chỉ làm đích cho thẻ `quan-he` của
   * thực thể khác (vd cột "Vụ án" ở Đối tượng/Luật sư hiện `case.name`: lọc trên `cases.tim_kiem_bd`
   * ghép 13 cột thì ra cả hồ sơ mà mô tả vụ án có chữ ấy, còn cột trên màn không có).
   */
  cotBongPhu?: readonly string[];
  /**
   * Thẻ "tất cả các cột" tìm CẢ tên người qua các trường kiểu `nguoi` (HOẶC với cột ghép). Chỉ bật cho
   * bảng không có cột chữ nào chứa tên người (vd Nhật ký hoạt động: thao tác/đối tượng/IP đều là mã) —
   * OR qua quan hệ users làm câu hỏi không dùng được chỉ mục GIN của cột ghép, bảng lớn là quét cả bảng.
   * Không cần sinh lại SQL: tuỳ chọn chỉ đổi điều kiện Prisma.
   */
  tatCaGomNguoi?: boolean;
  /**
   * Thẻ "tất cả các cột" tìm CẢ các trường kiểu `quan-he`/`doi-tuong` liệt kê (khoá trường) — chữ ấy
   * đang HIỆN trên cột nhưng không nằm trong cột ghép của bảng (vd Vụ án: tên tội danh chính, tên bị
   * can). Chỉ bật cho bảng vừa phải: mỗi khoá thêm một nhánh OR qua quan hệ. Không cần sinh lại SQL.
   */
  tatCaGomQuanHe?: readonly string[];
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
    } else if (t.kieu === 'quan-he') {
      for (const ten of ['quanHe', 'modelDich', 'cotDich'] as const) {
        const v = t[ten];
        if (!v)
          throw new Error(`Trường "${t.key}" (kiểu quan-he) thiếu ${ten}`);
        kiemTen(v, ten);
      }
      if (!t.cotNguonDich?.length) {
        throw new Error(`Trường "${t.key}" (kiểu quan-he) thiếu cotNguonDich`);
      }
      for (const c of t.cotNguonDich) kiemTen(c, 'nguồn đích');
    } else {
      if (!t.cot)
        throw new Error(`Trường "${t.key}" (kiểu ${t.kieu}) thiếu cot`);
      kiemTen(t.cot, 'nguồn');
      if (t.cotDb) kiemTen(t.cotDb, 'CSDL');
    }
    if (t.cotGhep) {
      if (t.kieu !== 'chu' || t.cotGhep.length < 2) {
        throw new Error(
          `Trường "${t.key}": cotGhep chỉ dùng cho kiểu chu và cần ít nhất hai cột`,
        );
      }
      for (const g of t.cotGhep) kiemTen(g, 'ghép');
    }
  }
  for (const c of chuanHoaCotThem(khai.cotThemVaoTatCa)) {
    kiemTen(c.cot, 'thêm');
    if (c.cotDb) kiemTen(c.cotDb, 'CSDL thêm');
  }
  for (const c of khai.cotBongPhu ?? []) kiemTen(c, 'bóng phụ');
  if (khai.tatCaGomNguoi && !khai.truong.some((t) => t.kieu === 'nguoi')) {
    throw new Error(
      `Khai tìm kiếm ${khai.thucThe}: tatCaGomNguoi cần ít nhất một trường kiểu nguoi`,
    );
  }
  for (const k of khai.tatCaGomQuanHe ?? []) {
    const t = khai.truong.find((x) => x.key === k);
    if (!t || (t.kieu !== 'quan-he' && t.kieu !== 'doi-tuong')) {
      throw new Error(
        `Khai tìm kiếm ${khai.thucThe}: tatCaGomQuanHe "${k}" phải là trường kiểu quan-he hoặc doi-tuong`,
      );
    }
  }
}

const cotChu = (khai: KhaiThucThe) =>
  khai.truong.filter((t) => t.kieu === 'chu').map((t) => t.cot as string);

/** Cột có cột bóng riêng: cột chữ (thành thẻ) rồi cột bóng phụ (chỉ làm đích quan hệ), không trùng. */
const cotCoBong = (khai: KhaiThucThe) => [
  ...new Set([...cotChu(khai), ...(khai.cotBongPhu ?? [])]),
];

/**
 * Cột ghép vào "tất cả các cột": chữ + mã + cột thêm, theo thứ tự khai. Trường `cotGhep` góp CÁC CỘT
 * NGUỒN của nó (cột `cot` của nó là tên cột bóng, không có thật trong bảng).
 */
const cotTatCa = (khai: KhaiThucThe) => [
  ...khai.truong
    .filter(
      (t) =>
        t.kieu === 'chu' ||
        t.kieu === 'ma' ||
        t.kieu === 'ma-cu' ||
        t.kieu === 'ma-thuong',
    )
    .flatMap((t) => (t.cotGhep ? [...t.cotGhep] : [t.cot as string])),
  ...chuanHoaCotThem(khai.cotThemVaoTatCa).map((c) => c.cot),
];

/** Tên cột CSDL của một trường Prisma trong khai — `cotDb` nếu có `@map`, không thì chính tên trường. */
const tenCotDb = (khai: KhaiThucThe, cot: string): string =>
  khai.truong.find((t) => t.cot === cot && t.cotDb)?.cotDb ??
  // Danh sách "thêm vào tất cả các cột" cũng đi thẳng vào SQL thô, nên `@map` của nó cũng phải
  // được tra ở đây — bỏ sót là sinh `NEW."tenCamelCase"` và trigger chết lặng.
  chuanHoaCotThem(khai.cotThemVaoTatCa).find((c) => c.cot === cot && c.cotDb)
    ?.cotDb ??
  cot;

/** Cột CSDL nguồn của cột bóng mang tên `cot`: các cột `cotGhep` nếu có, không thì chính cột ấy. */
const nguonDb = (khai: KhaiThucThe, cot: string): string[] => {
  const ghepNguon = khai.truong.find(
    (t) => t.cot === cot && t.cotGhep,
  )?.cotGhep;
  return ghepNguon
    ? ghepNguon.map((g) => tenCotDb(khai, g))
    : [tenCotDb(khai, cot)];
};

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
  kiemDich(khais);
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
    const cotDbBong = cotCoBong(khai).flatMap((c) => nguonDb(khai, c));
    ra.push({
      tieuDe: `-- ── ${khai.bang} (${khai.thucThe}) ──`,
      bang: khai.bang,
      gan: [
        ...cotCoBong(khai).map((c) => {
          const nguon = nguonDb(khai, c);
          return {
            cotBong: cotBongCua(c).cot,
            // Một nguồn để trần `NEW."x"`; nhiều nguồn ghép — cùng dạng kiểu người sinh cho
            // `users.ho_ten_bd`, nên gopTheoBang coi là một.
            bieuThuc: nguon.length > 1 ? ghep(nguon) : moi(nguon[0]),
          };
        }),
        { cotBong: COT_TAT_CA.cot, bieuThuc: ghep(cotDbTatCa) },
      ],
      cotNguon: [...new Set([...cotDbTatCa, ...cotDbBong])],
    });
  }
  return gopTheoBang(ra);
}

/** `concat_ws(' ', NEW."x")` một cột ≡ `NEW."x"` (f_bo_dau coi NULL như chuỗi rỗng). */
const chuanHoaBieuThuc = (b: string): string =>
  /^concat_ws\(' ', (NEW\."\w+")\)$/.exec(b)?.[1] ?? b;

/**
 * MỘT khối mỗi bảng. Hai nguồn có thể cùng sinh khối cho một bảng — vd thẻ `doi-tuong` của Vụ án giữ
 * `subjects.full_name_bd`, và tệp khai riêng của Đối tượng. Không gộp thì migration có hai
 * `CREATE OR REPLACE FUNCTION` cùng tên: hàm sau âm thầm thay hàm trước, mất cột bóng của khối đầu.
 * Cùng cột bóng mà biểu thức lệch thật là khai sai — báo lỗi, không chọn bừa một bên.
 */
function gopTheoBang(khois: readonly KhoiTrigger[]): KhoiTrigger[] {
  const theoBang = new Map<string, KhoiTrigger>();
  for (const k of khois) {
    const cu = theoBang.get(k.bang);
    if (!cu) {
      theoBang.set(k.bang, { ...k, gan: [...k.gan] });
      continue;
    }
    for (const g of k.gan) {
      const trung = cu.gan.find((x) => x.cotBong === g.cotBong);
      if (!trung) cu.gan.push(g);
      else if (
        chuanHoaBieuThuc(trung.bieuThuc) !== chuanHoaBieuThuc(g.bieuThuc)
      ) {
        throw new Error(
          `Khai tìm kiếm: cột bóng "${k.bang}.${g.cotBong}" có hai biểu thức lệch nhau: ${trung.bieuThuc} ≠ ${g.bieuThuc}`,
        );
      }
    }
    cu.cotNguon = [...new Set([...cu.cotNguon, ...k.cotNguon])];
    cu.tieuDe = `${cu.tieuDe}\n${k.tieuDe}`;
  }
  return [...theoBang.values()];
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
    '-- CẢNH BÁO: tắt trigger chỉ chặn dòng ghi TỪ LÚC NÀY. Dòng đã nạp giữ nguyên cột bóng cũ, mà nhánh lùi',
    '-- về cột gốc CHỈ chạy khi cột bóng NULL — nên nếu sự cố là f_bo_dau cho giá trị SAI, thẻ vẫn trả kết quả',
    '-- sai trên những dòng ấy, im lặng. Gặp trường hợp đó phải tắt CẢ cờ tính năng TIM_KIEM_THE (cán bộ trở',
    '-- lại ô chữ cũ, không đi qua cột bóng), sửa f_bo_dau, rồi nạp lại cột bóng trước khi bật cờ.',
    '--',
    '-- Muốn giấu luôn ô thẻ trên giao diện: tắt cờ tính năng TIM_KIEM_THE (màn danh sách trở lại ô chữ cũ).',
    '-- Bật lại: chạy docs/van-hanh/bat-lai-trigger-tim-kiem.sql rồi nạp lại cột bóng (chỉ dẫn trong tệp ấy).',
    '--',
    '-- LƯU Ý DEPLOY: mỗi migration tìm kiếm mới chạy lại `CREATE OR REPLACE FUNCTION` nên BẬT LẠI trigger.',
    '-- Deploy trong lúc đang tắt khẩn thì chạy lại tệp này ngay sau deploy nếu sự cố chưa xử lý xong.',
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
  kiemDich(khais);
  return truongPrismaGoc(khais);
}

/**
 * Thẻ `quan-he` lọc trên cột bóng CỦA ĐÍCH mà không dựng trigger riêng — đích phải là cột bóng bộ sinh
 * thật sự tạo. Thiếu thì Prisma ném 500 lúc lọc, và không ca kiểm đơn vị nào thấy trước khi lên máy thật.
 */
function kiemDich(khais: readonly KhaiThucThe[]): void {
  const co = truongPrismaGoc(khais);
  for (const khai of khais) {
    for (const t of khai.truong) {
      if (t.kieu !== 'quan-he') continue;
      if (!co.some((x) => x.model === t.modelDich && x.field === t.cotDich)) {
        throw new Error(
          `Trường "${t.key}" (kiểu quan-he): đích ${t.modelDich}.${t.cotDich} chưa có cột bóng — khai thực thể đích trước`,
        );
      }
    }
  }
}

function truongPrismaGoc(khais: readonly KhaiThucThe[]): TruongPrisma[] {
  const ra: TruongPrisma[] = [];
  for (const khai of khais) {
    for (const c of cotCoBong(khai))
      ra.push({ model: khai.model, ...cotBongCua(c) });
    ra.push({ model: khai.model, ...COT_TAT_CA });
  }
  if (coTruongNguoi(khais)) ra.push({ model: 'User', ...COT_HO_TEN });
  if (coTruongDoiTuong(khais)) ra.push({ model: 'Subject', ...COT_DOI_TUONG });
  // Một bảng có thể được hai nguồn đòi cùng cột bóng (xem gopTheoBang) — khai field một lần.
  return ra.filter(
    (t, i) =>
      ra.findIndex((x) => x.model === t.model && x.field === t.field) === i,
  );
}

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
  /**
   * Còn dòng CHƯA TỪNG nạp không (`co`: boolean) — cho kiểm lúc deploy. Rẻ hơn `dem` vì không tính
   * f_bo_dau, và dừng ở dòng đầu tìm thấy (đo prod 19/09/2026: 15 bảng ~0,2 giây, `dem` 1 phút 47 giây).
   */
  chuaNap: string;
  /**
   * Mẫu 200 dòng CŨ NHẤT có dòng nào lệch biểu thức hiện hành không (`co`). Bắt lớp `chuaNap` không thấy:
   * đổi biểu thức cột bóng ĐÃ CÓ mà không thêm cột → dòng cũ khác NULL nhưng sai (rà độc lập 19/09/2026).
   * id cuid tăng theo thời gian nên dòng cũ nhất là dòng không ai sửa sau migration.
   */
  lechMau: string;
}

/** Cỡ mẫu `lechMau` — đủ để lộ biểu thức đổi mà chưa nạp, mà vẫn tính f_bo_dau trên rất ít dòng. */
export const CO_MAU_LECH = 200;

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
  // Biểu thức cột bóng KHÔNG BAO GIỜ NULL (đo prod 19/09/2026: f_bo_dau(NULL) = '', nên dòng đã nạp mang
  // ít nhất ' '). Cột bóng NULL vì thế là dòng chưa có giá trị đúng: chưa từng nạp, HOẶC trigger rơi vào
  // nhánh EXCEPTION, HOẶC đang tắt khẩn (`sinhSqlTatTimKiem`). Cả ba đều cần người xem — nên vẫn báo.
  const chuaNap = gan.map((g) => `"${g.cotBong}" IS NULL`).join(' OR ');
  return {
    dem: `SELECT count(*)::int AS n FROM "${bang}" WHERE ${lech}`,
    layLo: `SELECT id FROM "${bang}" WHERE id > $1 ORDER BY id LIMIT $2`,
    nap: `UPDATE "${bang}" SET ${set} WHERE id = ANY($1::text[]) AND (${lech})`,
    chuaNap: `SELECT EXISTS (SELECT 1 FROM "${bang}" WHERE ${chuaNap} LIMIT 1) AS co`,
    lechMau: `SELECT EXISTS (SELECT 1 FROM (SELECT * FROM "${bang}" ORDER BY id LIMIT ${CO_MAU_LECH}) m WHERE ${lech} LIMIT 1) AS co`,
  };
}

export function sinhCauNapCotBong(khai: KhaiThucThe): CauNap {
  kiemKhai(khai);
  return cauNap(khai.bang, [
    ...cotCoBong(khai).map((c) => {
      const nguon = nguonDb(khai, c);
      return {
        cotBong: cotBongCua(c).cot,
        bieuThuc: nguon.length > 1 ? ghepDong(nguon) : cotDong(nguon[0]),
      };
    }),
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

/**
 * Câu nạp cho MỌI bảng có trigger tìm kiếm — dựng từ CHÍNH các khối trigger đã gộp theo bảng, nên
 * biểu thức nạp không thể lệch trigger và mỗi bảng chỉ nạp một lần.
 */
export function sinhCacCauNap(
  khais: readonly KhaiThucThe[],
): Array<{ bang: string; cau: CauNap }> {
  return cacKhoiTrigger(khais).map((k) => ({
    bang: k.bang,
    cau: cauNap(
      k.bang,
      k.gan.map((g) => ({
        cotBong: g.cotBong,
        bieuThuc: g.bieuThuc.replace(/NEW\./g, ''),
      })),
    ),
  }));
}

const chuoiTs = (s: string) =>
  `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function sinhFrontendTimKiem(khais: readonly KhaiThucThe[]): string {
  khais.forEach(kiemKhai);
  kiemDich(khais);
  const dong = [
    '// AUTO-GENERATED — SINH TỰ ĐỘNG bởi `cd backend && npm run gen:tim-kiem` — không sửa tay.',
    '// Nguồn: backend/src/common/tim-kiem/khai/*.khai.ts',
    '',
    "export type KieuTruongTimKiem = 'chu' | 'ma' | 'ma-cu' | 'ngay' | 'chon' | 'nguoi' | 'doi-tuong' | 'quan-he' | 'ma-thuong';",
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
