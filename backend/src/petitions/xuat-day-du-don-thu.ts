import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { ngayVN } from '../common/xuat-danh-sach/dinh-dang';
import { maHoSoNgan } from '../common/utils/ho-so-code.util';
import { ngayVietDonHienThi } from '../common/utils/ngay-viet-don.util';
import { PETITION_STATUS_LABEL } from '../common/constants/status-labels.constants';
import { TRUONG_FORM_DON_THU } from './khai-truong-form-don-thu.generated';
import { COT_XUAT_DAY_DU_LOAI_TRU } from './cot-xuat-day-du.loai-tru';

/**
 * Khoá đã CẮT khỏi tệp xuất — đo được là rỗng trên toàn bộ hồ sơ.
 *
 * Lọc ở ĐÂY chứ không xoá khỏi bản sinh: bản sinh là sự thật về FORM, tệp loại trừ là sự thật
 * về TỆP XUẤT. Lẫn hai thứ thì ngày một ô có dữ liệu trở lại, không ai biết phải sửa chỗ nào.
 */
const DA_CAT = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu));

/**
 * Bảng xuất ĐẦY ĐỦ của Đơn thư — mọi trường đang đăng ký trên màn tạo/sửa.
 *
 * Anh yêu cầu 22/09/2026: "xuất toàn bộ các field đang được đăng ký, chứ không chỉ các field
 * đang hiện trên danh sách". Nguồn danh sách trường là BỐ CỤC FORM, sinh ra ở
 * `khai-truong-form-don-thu.generated.ts` — 127 trường (39 cột riêng + 88 nằm trong `metadata`).
 *
 * Bảng này là `export const` RIÊNG, KHÔNG nhập chung với `KHAI_COT_XUAT_DON_THU`: cổng
 * `khaiCotXuat` khoá tập cột xuất thường phải bằng đúng tập cột đang hiện trên bảng, và bảng
 * này cố ý rộng hơn. Nó có cổng riêng — `xuat-day-du-do-gia-tri.spec.ts`.
 */
export interface DongXuatDayDu {
  id: string;
  stt: string;
  sttCu: string | null;
  status: string;
  metadata: unknown;
  [k: string]: unknown;
}

/** Cột của bảng `petitions` mà bảng xuất đầy đủ cần đọc. */
export const COT_CAN_CHO_XUAT_DAY_DU: readonly string[] = [
  // Khử trùng: `petitionDate` vừa nằm ở danh sách tường minh (bộ đọc ghép ngày viết đơn) vừa
  // trong bảng trường. Prisma không đổ vì khoá trùng, nhưng danh sách có khoá lặp là danh sách
  // không đếm được — và cổng đếm nó.
  ...new Set([
  'id',
  'stt',
  'sttCu',
  'status',
  'metadata',
  // Ngày viết đơn hiện bằng BA cột theo thứ tự đọc — xem `ngayVietDonHienThi`.
  'petitionDate',
  'ngayVietDonEdtf',
  'ngayVietDonChu',
  'legacyRaw',
  ...TRUONG_FORM_DON_THU.filter((t) => t.cot).map((t) => t.cot as string),
  ]),
];

/** Cột kiểu ngày — in theo định dạng Việt Nam thay vì ISO. */
const LA_NGAY = (cot: string): boolean =>
  /^ngay[A-Z]/.test(cot) ||
  cot.endsWith('Date') ||
  cot === 'deadline' ||
  cot === 'thoiHanUTDT';

/**
 * Cách đọc một trường ra CHỮ trong ô Excel.
 *
 * Khai tường minh ba thứ cho mỗi trường — khoá form, chỗ lưu, bộ đọc — vì đó là thứ cổng đo
 * GIÁ TRỊ cần: trường nào có dữ liệu trong kho mà ra ô trống là đỏ. Đếm tiêu đề cột thì không
 * chứng minh được gì (đã vấp lớp cổng rỗng ấy nhiều lần).
 */
export function docTruong(
  khoaLuu: string,
  cot: string | null,
): (d: DongXuatDayDu) => string {
  // Ngày viết đơn: ba cột + bản thô hệ cũ, đã có bộ đọc chung.
  if (cot === 'petitionDate') return (d) => ngayVietDonHienThi(d as never) ?? '';
  if (cot === null) {
    return (d) => {
      const meta = (d.metadata ?? {}) as Record<string, unknown>;
      const v = meta[khoaLuu];
      if (v == null) return '';
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'boolean') return v ? 'Có' : 'Không';
      return String(v);
    };
  }
  if (LA_NGAY(cot)) return (d) => ngayVN(d[cot] as Date | null | undefined);
  return (d) => {
    const v = d[cot];
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Có' : 'Không';
    return String(v);
  };
}

export const KHAI_COT_XUAT_DON_THU_DAY_DU: readonly KhaiCotXuat<DongXuatDayDu>[] = [
  // Ba cột định danh đứng đầu — không nằm trong bố cục form nhưng thiếu chúng thì tệp xuất ra
  // không tra ngược được về hồ sơ nào.
  { key: 'stt', tieuDe: 'Số tiếp nhận', rong: 14, doc: (d) => maHoSoNgan(d.stt) },
  { key: 'sttCu', tieuDe: 'Số tiếp nhận cũ', rong: 14, doc: (d) => d.sttCu ?? '' },
  {
    key: 'status',
    tieuDe: 'Trạng thái',
    rong: 16,
    doc: (d) => PETITION_STATUS_LABEL[d.status as keyof typeof PETITION_STATUS_LABEL] ?? d.status,
  },
  ...TRUONG_FORM_DON_THU.filter((t) => !DA_CAT.has(t.khoaLuu)).map((t) => ({
    key: t.cot ?? `meta.${t.khoaLuu}`,
    tieuDe: t.caption,
    rong: 22,
    // ĐỌC BẰNG `khoaLuu`, không bằng `field`: ô nhánh `statistic.` được cắt tiền tố trước khi
    // lưu, nên đọc bằng tên đặc tả là đọc một khoá không tồn tại — 44 trường ra ô trống mà tệp
    // vẫn đủ cột, đủ tiêu đề. Lượt soát mô hình ngoài 23/09/2026 bắt được.
    doc: docTruong(t.khoaLuu, t.cot),
  })),
];
