/**
 * Bỏ dấu cho TÌM KIẾM — MỘT bảng ánh xạ, hai nơi dùng: hàm JS `boDauTimKiem` (máy chủ dựng điều kiện,
 * giao diện lọc danh sách phía trình duyệt) và hàm SQL `f_bo_dau` (điền cột bóng `<cot>_bd`).
 *
 * Không dùng extension `unaccent`: tệp luật của nó khác theo phiên bản PostgreSQL (đo 15/09/2026 —
 * PG16 prod 1.650 dòng, PG18 local 2.661 dòng, 29 dòng dịch khác). Ca kiểm local vì thế không nói
 * gì về prod, và nâng cấp PostgreSQL sẽ âm thầm đổi kết quả tìm.
 *
 * Bảng khai ký tự đã gặp trong dữ liệu thật (47.169 đơn thư): chữ Latin có dấu (gồm mọi chữ tiếng
 * Việt, dựng sẵn lẫn tổ hợp), đ/Đ, dấu câu (gạch ngang, ngoặc kép/đơn cong, chấm giữa, ba chấm),
 * số mũ và phân số, cùng mọi khoảng trắng Unicode.
 *
 * Ký tự ngoài ASCII viết bằng MÃ ĐIỂM, không gõ thẳng: NBSP, BOM, dấu tổ hợp là ký tự vô hình — gõ
 * thẳng thì mắt không phân biệt được, và công cụ định dạng/ghi tệp đã từng nuốt chuỗi thoát.
 *
 * KHÔNG thay `boDauTiengViet`: khoá gộp danh mục (Đơn vị, Loại thông tin) đang dựa vào nó — đổi là đổi
 * khoá của dữ liệu đã nạp. Với chữ cái hai hàm cho cùng kết quả (có ca kiểm).
 */

const kt = (maDiem: number) => String.fromCharCode(maDiem);

/** Dấu câu và ký hiệu đổi 1-1. */
const DAU_CAU: ReadonlyArray<readonly [string, string]> = [
  [kt(0x2013), '-'], // gạch ngang ngắn
  [kt(0x2014), '-'], // gạch ngang dài
  [kt(0x201c), '"'], // ngoặc kép mở cong
  [kt(0x201d), '"'], // ngoặc kép đóng cong
  [kt(0x2018), "'"], // ngoặc đơn mở cong
  [kt(0x2019), "'"], // ngoặc đơn đóng cong / nháy
  [kt(0x00b7), '.'], // chấm giữa
  [kt(0x00b2), '2'], // mũ 2
  [kt(0x00b3), '3'], // mũ 3
];

/**
 * Mọi ký tự `\s` của JS mà `[[:space:]]` của SQL có thể không nhận — quy về dấu cách trong bảng để
 * bước gộp khoảng trắng hai phía chỉ còn làm việc trên ASCII.
 */
const MA_KHOANG_TRANG_UNICODE: readonly number[] = [
  0x00a0, // NBSP
  0x1680,
  ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), // U+2000..U+200A
  0x2028,
  0x2029,
  0x202f,
  0x205f,
  0x3000,
  0xfeff, // BOM
];

/** Dấu tổ hợp (U+0300–U+036F). */
const DAU_TO_HOP = /\p{Mn}/gu;

/** Chữ Latin có dấu → chữ gốc thường; dấu tổ hợp → xoá. Sinh từ Unicode, không gõ tay. */
function sinhBangChu(): Array<[string, string]> {
  const ra: Array<[string, string]> = [
    [kt(0x0111), 'd'], // đ
    [kt(0x0110), 'd'], // Đ
  ];
  for (const [dau, cuoi] of [
    [0x00c0, 0x024f],
    [0x1e00, 0x1eff],
  ]) {
    for (let cp = dau; cp <= cuoi; cp++) {
      const ch = kt(cp);
      const goc = ch.normalize('NFD').replace(DAU_TO_HOP, '');
      if (goc !== ch && /^[A-Za-z]$/.test(goc))
        ra.push([ch, goc.toLowerCase()]);
    }
  }
  for (let cp = 0x0300; cp <= 0x036f; cp++) ra.push([kt(cp), '']);
  return ra;
}

/** Ánh xạ một ký tự → tối đa một ký tự (rỗng = xoá). Thành `translate()` phía SQL. */
export const BANG_MOT_KY_TU: ReadonlyMap<string, string> = new Map([
  ...sinhBangChu(),
  ...DAU_CAU,
  ...MA_KHOANG_TRANG_UNICODE.map((ma): [string, string] => [kt(ma), ' ']),
]);

/** Ánh xạ ra nhiều ký tự — áp SAU bảng một ký tự (thành `replace()` phía SQL). */
export const BANG_NHIEU_KY_TU: ReadonlyArray<readonly [string, string]> = [
  [kt(0x2026), '...'], // ba chấm
  [kt(0x00bc), '1/4'],
  [kt(0x00bd), '1/2'],
  [kt(0x00be), '3/4'],
];

/** Gộp khoảng trắng ASCII — cùng lớp ký tự ở hai phía. */
const KHOANG_TRANG_ASCII = /[ \t\n\r\f\v]+/g;

export function boDauTimKiem(v: string | null | undefined): string {
  if (!v) return '';
  let s = '';
  for (const c of v) s += BANG_MOT_KY_TU.get(c) ?? c;
  for (const [nguon, dich] of BANG_NHIEU_KY_TU) s = s.split(nguon).join(dich);
  return s.toLowerCase().replace(KHOANG_TRANG_ASCII, ' ').trim();
}

const literalSql = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Câu `CREATE OR REPLACE FUNCTION public.f_bo_dau` sinh từ CÙNG bảng — migration chép nguyên văn,
 * gate so migration với hàm này. Chỉ dùng hàm dựng sẵn nên IMMUTABLE thật trên mọi phiên bản PG.
 */
export function sinhHamFBoDau(): string {
  const doiMot = [...BANG_MOT_KY_TU].filter(([, dich]) => dich.length === 1);
  const xoa = [...BANG_MOT_KY_TU].filter(([, dich]) => dich.length === 0);
  // translate(): ký tự nguồn không có ký tự đích tương ứng thì bị XOÁ — đặt nhóm xoá ở cuối.
  const tu = doiMot.map(([n]) => n).join('') + xoa.map(([n]) => n).join('');
  const den = doiMot.map(([, d]) => d).join('');
  let bieuThuc = `translate(coalesce($1, ''), ${literalSql(tu)}, ${literalSql(den)})`;
  for (const [nguon, dich] of BANG_NHIEU_KY_TU) {
    bieuThuc = `replace(${bieuThuc}, ${literalSql(nguon)}, ${literalSql(dich)})`;
  }
  return [
    '-- SINH TỰ ĐỘNG từ backend/src/common/tim-kiem/bo-dau.ts (sinhHamFBoDau) — không sửa tay.',
    'CREATE OR REPLACE FUNCTION public.f_bo_dau(text) RETURNS text',
    'LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$',
    `  SELECT btrim(regexp_replace(lower(${bieuThuc}), '[ \\t\\n\\r\\f\\v]+', ' ', 'g'))`,
    '$f$;',
  ].join('\n');
}

/**
 * Thoát ký tự đại diện LIKE. Prisma `contains` sinh `LIKE ('%' || $1 || '%')` và KHÔNG thoát —
 * đo 15/09/2026: `contains: '%'` khớp 47.169/47.169 đơn thư. Escape mặc định của PostgreSQL là `\`.
 */
export function thoatLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}
