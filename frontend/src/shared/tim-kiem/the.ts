/**
 * Thẻ tìm kiếm của ô tìm kiếm danh sách (kiểu Odoo) — phần thuần, không React.
 *
 * Trên URL mỗi GIÁ TRỊ là một mục `<prefix>_tk=<khoá>~<giá trị>`; cùng khoá lặp lại nhiều mục.
 * Máy chủ (`backend/src/common/tim-kiem/dieu-kien.ts`) đọc đúng dạng ấy: cùng khoá → OR, khác
 * khoá → AND. Giới hạn ở đây phải khớp DTO máy chủ (`ArrayMaxSize(20)`, giá trị ≤ 200), vì vượt
 * là 400 cho cả danh sách.
 */
import type { KieuTruongTimKiem } from './generated';

export const KHOA_TAT_CA = '*';
export const SO_GIA_TRI_TOI_DA = 20;
export const DO_DAI_GIA_TRI_TOI_DA = 200;
const DAU_TACH = '~';

export interface TruongTimKiem {
  readonly key: string;
  readonly nhan: string;
  readonly kieu: KieuTruongTimKiem;
}

export interface The {
  khoa: string;
  giaTri: string[];
}

/** Khoá URL của thẻ. */
export const khoaUrlThe = (prefix: string) => `${prefix}_tk`;

function napVao(the: The[], khoa: string, giaTriTho: string): The[] {
  const giaTri = giaTriTho.trim().slice(0, DO_DAI_GIA_TRI_TOI_DA);
  if (!khoa || !giaTri) return the;
  const i = the.findIndex((t) => t.khoa === khoa);
  if (i < 0) return [...the, { khoa, giaTri: [giaTri] }];
  if (the[i].giaTri.includes(giaTri)) return the;
  const moi = [...the];
  moi[i] = { khoa, giaTri: [...the[i].giaTri, giaTri] };
  return moi;
}

/**
 * Đọc thẻ từ tham số trang. `thamSoCu` quy tham số trước thời thẻ (`q`, ô lọc chữ) về khoá thẻ:
 * đường dẫn cũ còn trong dấu trang và tin nhắn, mở ra mà mất bộ lọc thì cán bộ tưởng hồ sơ mất.
 *
 * Qua `themGiaTri` nên dừng ở SO_GIA_TRI_TOI_DA: đường dẫn dán tay không đi qua ô thẻ, vượt giới hạn
 * máy chủ là 400 cho cả danh sách lẫn thống kê.
 */
export function docTheTuThamSo(
  sp: URLSearchParams,
  prefix: string,
  thamSoCu: Readonly<Record<string, string>> = {},
): The[] {
  let the: The[] = [];
  for (const muc of sp.getAll(khoaUrlThe(prefix))) {
    const i = muc.indexOf(DAU_TACH);
    if (i <= 0) continue;
    the = themGiaTri(the, muc.slice(0, i), muc.slice(i + 1));
  }
  for (const [cu, khoa] of Object.entries(thamSoCu)) {
    const v = sp.get(`${prefix}_${cu}`);
    if (v) the = themGiaTri(the, khoa, v);
  }
  return the;
}

export function ghiTheRaUrl(the: readonly The[]): string[] {
  return the.flatMap((t) => t.giaTri.map((v) => `${t.khoa}${DAU_TACH}${v}`));
}

export const demGiaTri = (the: readonly The[]) =>
  the.reduce((n, t) => n + t.giaTri.length, 0);

/** Trả CHÍNH mảng cũ khi không đổi gì — để nơi gọi bỏ qua được lần ghi URL thừa. */
export function themGiaTri(the: The[], khoa: string, giaTri: string): The[] {
  if (demGiaTri(the) >= SO_GIA_TRI_TOI_DA) return the;
  return napVao(the, khoa, giaTri);
}

export function boGiaTri(the: readonly The[], khoa: string, giaTri: string): The[] {
  return the
    .map((t) => (t.khoa === khoa ? { khoa, giaTri: t.giaTri.filter((v) => v !== giaTri) } : t))
    .filter((t) => t.giaTri.length > 0);
}

export function boThe(the: readonly The[], khoa: string): The[] {
  return the.filter((t) => t.khoa !== khoa);
}

export function khoaHopLe(khoa: string, khai: readonly TruongTimKiem[]): boolean {
  return khoa === KHOA_TAT_CA || khai.some((t) => t.key === khoa);
}

const ngayHopLe = (nam: number, thang: number, ngay: number) => {
  if (nam < 1900 || nam > 2100 || thang < 1 || thang > 12 || ngay < 1) return false;
  return ngay <= new Date(Date.UTC(nam, thang, 0)).getUTCDate();
};

/**
 * Cùng bốn dạng `docKhoangNgay` của máy chủ nhận: dd/mm/yyyy · yyyy-mm-dd · mm/yyyy · yyyy.
 * Chỉ để ẩn gợi ý vô nghĩa — máy chủ vẫn là nơi quyết định (sai dạng → 400).
 */
export function laGiaTriNgay(giaTri: string): boolean {
  const v = giaTri.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return ngayHopLe(+m[3], +m[2], +m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return ngayHopLe(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return ngayHopLe(+m[2], +m[1], 1);
  m = /^(\d{4})$/.exec(v);
  return m ? ngayHopLe(+m[1], 1, 1) : false;
}
