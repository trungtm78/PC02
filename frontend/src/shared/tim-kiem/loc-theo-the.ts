/**
 * Lọc thẻ tìm kiếm PHÍA TRÌNH DUYỆT — cho màn danh sách đã tải hết dòng về rồi mới lọc tại chỗ.
 *
 * Cùng ngữ nghĩa với máy chủ (`backend/src/common/tim-kiem/dieu-kien.ts`) để một đường dẫn thẻ cho ra
 * cùng kết quả dù màn lọc ở đâu:
 * - cùng khoá → OR, khác khoá → AND; `*` = mọi cột chữ và mã;
 * - chữ: không dấu, không hoa thường, gộp khoảng trắng thừa/NBSP; dưới 3 ký tự chỉ khớp ĐẦU TỪ;
 * - ngày: dd/mm/yyyy · yyyy-mm-dd · mm/yyyy · yyyy theo giờ Việt Nam (+07:00);
 * - chọn: so đúng mã.
 * Khoá không có trong khai bị bỏ qua — ô tìm hiện thẻ ĐỎ, không làm rỗng cả bảng.
 */
import { boDau } from '@/lib/bo-dau';
import { KHOA_TAT_CA, laGiaTriNgay, type The, type TruongTimKiem } from './the';

type GiaTriO = string | number | null | undefined;

export interface TruongLoc<R> extends TruongTimKiem {
  /** Giá trị cột của một dòng — mảng khi một ô hiện nhiều giá trị (vd danh sách cán bộ). */
  lay(dong: R): GiaTriO | readonly GiaTriO[];
}

const DO_DAI_TIM_NOI_DUNG = 3;
const LECH_GIO_VIET_NAM_MS = 7 * 60 * 60 * 1000;

/** Như `f_bo_dau` của máy chủ: bỏ dấu, chữ thường, mọi khoảng trắng (cả NBSP) gộp một, bỏ đầu cuối. */
function chuanHoa(chu: string): string {
  return boDau(chu).replace(/\s+/gu, ' ').trim();
}

const cacGiaTri = <R>(t: TruongLoc<R>, dong: R): string[] => {
  const v = t.lay(dong);
  return (Array.isArray(v) ? v : [v])
    .filter((x): x is string | number => x !== null && x !== undefined && x !== '')
    .map(String);
};

function khopChu(o: string, q: string, dauTu: boolean): boolean {
  const van = ` ${chuanHoa(o)}`;
  return dauTu ? van.includes(` ${q}`) : van.includes(q);
}

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

/** So chứa (dưới 3 ký tự: đầu từ) — cột chữ, và mọi cột chữ/mã khi thẻ là `*` (như `tim_kiem_bd`). */
function khopChuoi<R>(t: TruongLoc<R>, dong: R, giaTri: string): boolean {
  const q = chuanHoa(giaTri);
  return q !== '' && cacGiaTri(t, dong).some((x) => khopChu(x, q, q.length < DO_DAI_TIM_NOI_DUNG));
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
    case 'ma-cu':
    case 'ma-thuong': {
      // Máy chủ so thẻ mã ĐÚNG mã: so chứa thì `stt~5` ra cả dòng 15, 25, 50–59.
      const q = chuanHoa(giaTri);
      return q !== '' && o.some((x) => chuanHoa(x) === q);
    }
    default:
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
