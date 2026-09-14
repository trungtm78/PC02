import { boDauTiengViet } from '../utils/chuan-hoa-ten.util';
import {
  BANG_MOT_KY_TU,
  BANG_NHIEU_KY_TU,
  boDauTimKiem,
  sinhHamFBoDau,
  thoatLike,
} from './bo-dau';

/**
 * Bỏ dấu cho TÌM KIẾM — MỘT bảng ánh xạ sinh ra cả hàm JS lẫn hàm SQL `f_bo_dau`.
 *
 * Vì sao không dùng `unaccent` của PostgreSQL (đo T0 15/09/2026): tệp luật khác theo phiên bản —
 * PG16 trên prod 1.650 dòng, PG18 local 2.661 dòng, 29 dòng dịch khác nhau. Ca kiểm chạy local
 * không nói gì về prod, và nâng cấp PostgreSQL âm thầm đổi kết quả tìm. Bảng tự khai thì hai phía
 * (máy chủ lọc bằng cột bóng SQL, giao diện lọc danh sách phía trình duyệt) ra CÙNG một chuỗi.
 *
 * Ký tự trong ca kiểm lấy từ kiểm kê dữ liệu thật (47.169 đơn thư): ngoài chữ Việt chỉ có – “ ” … ’ ‘ · ² ¾ NBSP.
 */

/** Mô phỏng đúng ngữ nghĩa SQL sinh ra: translate → replace → lower → gộp khoảng trắng → btrim. */
function moPhongSql(v: string | null): string {
  let s = [...(v ?? '')].map((c) => BANG_MOT_KY_TU.get(c) ?? c).join('');
  for (const [nguon, dich] of BANG_NHIEU_KY_TU) s = s.split(nguon).join(dich);
  return s
    .toLowerCase()
    .replace(/[ \t\n\r\f\v]+/g, ' ')
    .trim();
}

describe('boDauTimKiem', () => {
  it.each([
    ['Nguyễn  Văn Á', 'nguyen van a'],
    ['ĐỖ THỊ HỒNG', 'do thi hong'],
    ['Công an Phường Bàn Cờ', 'cong an phuong ban co'],
    ['  Trần\u00a0Văn   Bình\t', 'tran van binh'],
    ['vụ “Lừa đảo chiếm đoạt tài sản”', 'vu "lua dao chiem doat tai san"'],
    ['Ngày 12/09 – 15/09', 'ngay 12/09 - 15/09'],
    ['tố giác…', 'to giac...'],
    ['ông Nguyễn’s', "ong nguyen's"],
    ['‘x’', "'x'"],
    ['diện tích 50m²', 'dien tich 50m2'],
    ['¾ căn nhà', '3/4 can nha'],
    ['A·B', 'a.b'],
  ])('%j → %j', (vao, ra) => {
    expect(boDauTimKiem(vao)).toBe(ra);
  });

  it('chữ tổ hợp dấu (NFD) ra cùng chuỗi với chữ dựng sẵn (NFC)', () => {
    const nfc = 'Nguyễn Thị Ánh Tuyết, Đường Hồ Chí Minh';
    expect(boDauTimKiem(nfc.normalize('NFD'))).toBe(boDauTimKiem(nfc));
  });

  it('rỗng / null / undefined → chuỗi rỗng', () => {
    expect(boDauTimKiem('')).toBe('');
    expect(boDauTimKiem(null)).toBe('');
    expect(boDauTimKiem(undefined)).toBe('');
  });

  /**
   * Chữ tiếng Việt phải ra ĐÚNG như `boDauTiengViet` — khoá gộp danh mục (Loại thông tin, Đơn vị)
   * dùng hàm ấy; hai cách bỏ dấu chữ khác nhau là cùng một tên tìm được ở chỗ này mà không ở chỗ kia.
   */
  it('mọi chữ tiếng Việt (hoa/thường, 6 thanh) khớp boDauTiengViet', () => {
    const goc = 'aăâeêioôơuưy';
    const thanh = ['', '\u0300', '\u0301', '\u0309', '\u0303', '\u0323'];
    const chu: string[] = ['đ', 'Đ'];
    for (const g of goc) {
      for (const t of thanh) {
        for (const c of [g, g.toUpperCase()])
          chu.push((c + t).normalize('NFC'));
      }
    }
    // Nguyên âm có mũ/móc/trăng + thanh: dựng từ dạng tổ hợp đầy đủ.
    for (const [base, mu] of [
      ['a', '\u0306'],
      ['a', '\u0302'],
      ['e', '\u0302'],
      ['o', '\u0302'],
      ['o', '\u031b'],
      ['u', '\u031b'],
    ]) {
      for (const t of thanh)
        chu.push(
          (base + mu + t).normalize('NFC'),
          (base.toUpperCase() + mu + t).normalize('NFC'),
        );
    }
    for (const c of chu)
      expect([c, boDauTimKiem(c)]).toEqual([c, boDauTiengViet(c)]);
  });

  /** JS `\s` rộng hơn `[[:space:]]` của SQL — mọi ký tự khoảng trắng Unicode phải quy về dấu cách trong bảng. */
  it('mọi ký tự JS coi là khoảng trắng đều thành dấu cách qua bảng (không lệch SQL)', () => {
    const khoangTrang = [
      '\u00a0',
      '\u1680',
      '\u2000',
      '\u2005',
      '\u200a',
      '\u2028',
      '\u2029',
      '\u202f',
      '\u205f',
      '\u3000',
      '\ufeff',
    ];
    for (const k of khoangTrang) {
      expect(/\s/.test(k)).toBe(true);
      expect([k, BANG_MOT_KY_TU.get(k)]).toEqual([k, ' ']);
    }
  });
});

describe('sinhHamFBoDau — thân hàm SQL sinh từ CÙNG bảng', () => {
  const sql = sinhHamFBoDau();

  it('không phụ thuộc unaccent, IMMUTABLE, tên hàm schema-qualified', () => {
    expect(sql).not.toMatch(/unaccent/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_bo_dau\(text\)/);
    expect(sql).toMatch(/IMMUTABLE/);
    expect(sql).toMatch(/PARALLEL SAFE/);
    expect(sql).toMatch(/translate\(/);
  });

  it('tất định: sinh hai lần ra cùng một chuỗi (gate so migration với bảng)', () => {
    expect(sinhHamFBoDau()).toBe(sql);
  });

  it('dấu nháy đơn trong bảng được thoát thành hai nháy trong literal SQL', () => {
    // ’ → ' : literal SQL phải chứa '' chứ không đóng chuỗi giữa chừng.
    const literals = sql.match(/'(?:[^']|'')*'/g) ?? [];
    expect(literals.some((l) => l.includes("''"))).toBe(true);
    // Mở-đóng nháy phải chẵn sau khi bỏ cặp ''.
    expect(sql.replace(/''/g, '').split("'").length % 2).toBe(1);
  });

  /**
   * Tương đương theo CẤU TRÚC: mô phỏng translate/replace/lower/gộp khoảng trắng của SQL trên bảng
   * phải ra đúng `boDauTimKiem` với mọi ký tự trong kiểm kê dữ liệu thật. Ca kiểm vàng chạy thật
   * trên PostgreSQL 16 và 18 nằm ở CLI kiểm, vì CI không có CSDL.
   */
  it('mô phỏng thân SQL ≡ boDauTimKiem trên ký tự dữ liệu thật', () => {
    const mau = [
      'Nguyễn Văn Á',
      'ĐỖ THỊ',
      'Tố giác (02 đơn)'.normalize('NFD'),
      '“Lừa đảo”',
      '12 – 15',
      'x…y',
      'Nguyễn’s',
      '‘a’',
      '50m²',
      '¾',
      'A·B',
      'a\u00a0b',
      ' Trần   Bình ',
      'Khiếu nại (QĐ tố tụng)',
    ];
    for (const m of mau)
      expect([m, moPhongSql(m)]).toEqual([m, boDauTimKiem(m)]);
  });

  it('ánh xạ nhiều ký tự áp SAU translate (translate chỉ đổi 1-1)', () => {
    for (const [nguon] of BANG_NHIEU_KY_TU)
      expect(BANG_MOT_KY_TU.has(nguon)).toBe(false);
    for (const [, dich] of BANG_MOT_KY_TU)
      expect([...dich].length).toBeLessThanOrEqual(1);
  });
});

describe('thoatLike — ký tự đại diện là CHỮ, không phải đại diện', () => {
  /** T0 đo: Prisma `contains` sinh LIKE ('%' || $1 || '%') và KHÔNG thoát — contains '%' khớp cả bảng. */
  it.each([
    ['50%', '50\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\x', 'c:\\\\x'],
    ['\\%_', '\\\\\\%\\_'],
    ['binh thuong', 'binh thuong'],
  ])('%j → %j', (vao, ra) => {
    expect(thoatLike(vao)).toBe(ra);
  });
});
