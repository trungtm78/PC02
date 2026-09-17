/**
 * Lọc thẻ tìm kiếm PHÍA TRÌNH DUYỆT — cho màn danh sách đã tải hết dòng về rồi mới lọc tại chỗ.
 *
 * Cùng ngữ nghĩa với máy chủ (`backend/src/common/tim-kiem/dieu-kien.ts`) để một đường dẫn thẻ cho ra
 * cùng kết quả dù màn lọc ở đâu:
 * - cùng khoá → OR, khác khoá → AND; `*` = mọi cột chữ và mã;
 * - chữ: không dấu, không hoa thường, gộp khoảng trắng thừa/NBSP; khớp CHUỖI CON ở mọi độ dài (%like%);
 * - mã (mã hồ sơ, mã thường): chứa chuỗi gõ NGUYÊN VĂN, chỉ không phân biệt hoa thường — như máy chủ
 *   `contains` + `mode: insensitive` trên cột gốc (cột mã không có cột bóng bỏ dấu); STT cũ: luật hệ cũ
 *   rồi chứa như thế; thẻ `*` vẫn bỏ dấu cả hai phía (máy chủ chạy `*` trên `tim_kiem_bd`);
 * - ngày: dd/mm/yyyy · yyyy-mm-dd · mm/yyyy · yyyy theo giờ Việt Nam (+07:00);
 * - chọn: so đúng mã.
 * Khoá không có trong khai bị bỏ qua — ô tìm hiện thẻ ĐỎ, không làm rỗng cả bảng.
 *
 * Đổi luật 17/09/2026 (anh báo "search chưa đúng %like%", ví dụ thẻ "STT: 78" ra "Không tìm thấy"):
 * trước đó chuỗi dưới 3 ký tự chỉ khớp ĐẦU TỪ, mọi thẻ mã so ĐÚNG NGUYÊN giá trị, và bỏ dấu dùng hàm
 * riêng không quy đổi dấu câu như máy chủ.
 */
import { boDauTimKiem } from './bo-dau.generated';
import { KHOA_TAT_CA, laGiaTriNgay, type The, type TruongTimKiem } from './the';

type GiaTriO = string | number | null | undefined;

export interface TruongLoc<R> extends TruongTimKiem {
  /** Giá trị cột của một dòng — mảng khi một ô hiện nhiều giá trị (vd danh sách cán bộ). */
  lay(dong: R): GiaTriO | readonly GiaTriO[];
}

const LECH_GIO_VIET_NAM_MS = 7 * 60 * 60 * 1000;

/** Bỏ dấu y hệt máy chủ — bảng sinh từ `backend/src/common/tim-kiem/bo-dau.ts`, có cổng chạy thật so hai phía. */
const chuanHoa = (chu: string): string => boDauTimKiem(chu);

const cacGiaTri = <R>(t: TruongLoc<R>, dong: R): string[] => {
  const v = t.lay(dong);
  return (Array.isArray(v) ? v : [v])
    .filter((x): x is string | number => x !== null && x !== undefined && x !== '')
    .map(String);
};

/** Ô nào của dòng chứa MỘT trong các mẫu (đã chuẩn hoá). */
const chuaMotTrong = (o: readonly string[], mau: readonly string[]): boolean =>
  mau.length > 0 && o.some((x) => {
    const c = chuanHoa(x);
    return mau.some((m) => c.includes(m));
  });

/**
 * Ngày của ô theo giờ Việt Nam dạng `yyyy-mm-dd`; ô không đọc được ngày → null. Ô đã định dạng sẵn
 * `dd/mm/yyyy` (`formatVNDate`) là ngày Việt Nam rồi, đọc thẳng — `Date.parse` không hiểu dạng ấy.
 */
function ngayVietNam(o: string): string | null {
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(o.trim());
  if (vn) return `${vn[3]}-${vn[2].padStart(2, '0')}-${vn[1].padStart(2, '0')}`;
  const ms = Date.parse(o);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + LECH_GIO_VIET_NAM_MS).toISOString().slice(0, 10);
}

/** Tiền tố `yyyy-mm-dd` / `yyyy-mm` / `yyyy` của giá trị thẻ ngày; sai dạng → null. */
function tienToNgay(giaTri: string): string | null {
  const v = giaTri.trim();
  if (!laGiaTriNgay(v)) return null;
  const hai = (s: string) => s.padStart(2, '0');
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${hai(m[2])}-${hai(m[1])}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  m = /^(\d{1,2})\/(\d{4})$/.exec(v);
  if (m) return `${m[2]}-${hai(m[1])}`;
  return v;
}

/**
 * STT cũ — cùng luật `dieuKienSttCu` của máy chủ (chép hệ cũ `list.php:140-151`): lấy vế SAU dấu `-`
 * (vế sau rỗng thì giữ nguyên chuỗi), chuỗi thuần số bỏ số 0 đệm.
 */
function mauSttCu(giaTri: string): string | null {
  const tho = giaTri.trim();
  if (!tho) return null;
  const sau = tho.includes('-') ? tho.slice(tho.indexOf('-') + 1).trim() : tho;
  const chon = sau || tho;
  return /^\d+$/.test(chon) ? String(parseInt(chon, 10)) : chon;
}

/**
 * So chứa NGUYÊN VĂN không phân biệt hoa thường — cho thẻ mã, như ILIKE trên cột gốc của máy chủ. Không bỏ
 * dấu: gõ "2026–11171" (gạch ngang ngắn) hay "DT" không được ra "2026-11171" / "ĐT01" khi máy chủ không ra.
 */
const chuaMaNguyenVan = (o: readonly string[], mau: string): boolean => {
  const m = mau.trim().toLowerCase();
  return m !== '' && o.some((x) => x.toLowerCase().includes(m));
};

/** So chứa — cột chữ, và mọi cột chữ/mã khi thẻ là `*` (như `tim_kiem_bd`). */
function khopChuoi<R>(t: TruongLoc<R>, dong: R, giaTri: string): boolean {
  const q = chuanHoa(giaTri);
  return q !== '' && chuaMotTrong(cacGiaTri(t, dong), [q]);
}

function khopMotGiaTri<R>(t: TruongLoc<R>, dong: R, giaTri: string): boolean {
  const o = cacGiaTri(t, dong);
  switch (t.kieu) {
    case 'chon':
      return o.includes(giaTri);
    case 'ngay': {
      const tienTo = tienToNgay(giaTri);
      return tienTo !== null && o.some((x) => ngayVietNam(x)?.startsWith(tienTo) ?? false);
    }
    case 'ma':
    case 'ma-thuong':
      return chuaMaNguyenVan(o, giaTri);
    case 'ma-cu': {
      const m = mauSttCu(giaTri);
      return m !== null && chuaMaNguyenVan(o, m);
    }
    default:
      // chu, nguoi, doi-tuong, quan-he: chứa chuỗi gõ, bỏ dấu cả hai phía (cột bóng).
      return khopChuoi(t, dong, giaTri);
  }
}

const laCotTatCa = (t: TruongTimKiem) =>
  t.kieu === 'chu' || t.kieu === 'ma' || t.kieu === 'ma-cu' || t.kieu === 'ma-thuong';

export function locTheoThe<R>(
  dong: readonly R[],
  the: readonly The[],
  khai: readonly TruongLoc<R>[],
): readonly R[] {
  const dieuKien = the.flatMap((th) => {
    if (th.khoa === KHOA_TAT_CA) {
      const cot = khai.filter(laCotTatCa);
      return [(d: R) => th.giaTri.some((v) => cot.some((t) => khopChuoi(t, d, v)))];
    }
    const t = khai.find((x) => x.key === th.khoa);
    return t ? [(d: R) => th.giaTri.some((v) => khopMotGiaTri(t, d, v))] : [];
  });
  if (dieuKien.length === 0) return dong;
  return dong.filter((d) => dieuKien.every((dk) => dk(d)));
}
