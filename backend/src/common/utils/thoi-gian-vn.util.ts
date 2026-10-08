/**
 * Ngày/giờ theo múi giờ VIỆT NAM, độc lập `TZ` của tiến trình máy chủ.
 *
 * Vì sao có tệp này (08/10/2026): Giấy biên nhận in "Hồi 07 giờ 00" cho MỌI đơn. `receivedDate` chỉ lưu NGÀY (00:00 UTC);
 * hàm cũ đọc `getHours()` theo múi giờ máy chủ — máy chủ chạy giờ Việt Nam thì 00:00 UTC thành 07:00. Mọi chỗ đọc ngày/giờ
 * để IN hoặc SO SÁNH phải nói rõ múi giờ, không để mặc định theo máy.
 *
 * Việt Nam không có giờ mùa hè nên UTC+7 cố định; vẫn dùng `Intl` với tên múi giờ để không viết cứng số 7.
 */
export const MUI_GIO_VN = 'Asia/Ho_Chi_Minh';

/** Giờ khai dạng "HH:mm" 24 giờ. Không dùng cờ `m`/`g`: `^…$` neo toàn chuỗi, "09:30\n" bị từ chối. */
export const DAU_GIO_PHUT = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Dung sai lệch đồng hồ giữa máy khách và máy chủ khi kiểm "giờ không ở tương lai". */
export const DUNG_SAI_GIO_PHUT = 5;

const DINH_DANG = new Intl.DateTimeFormat('en-GB', {
  timeZone: MUI_GIO_VN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  // `h23`: nửa đêm là "00", không phải "24" (một số ICU với `hour12:false` cho "24:05").
  hourCycle: 'h23',
});

interface ThanhPhan {
  nam: number;
  thang: number;
  ngay: number;
  gio: number;
  phut: number;
}

function thanhPhan(d: Date): ThanhPhan | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const m: Record<string, string> = {};
  for (const p of DINH_DANG.formatToParts(d)) m[p.type] = p.value;
  const gio = Number(m.hour) === 24 ? 0 : Number(m.hour);
  return { nam: Number(m.year), thang: Number(m.month), ngay: Number(m.day), gio, phut: Number(m.minute) };
}

/** Ngày/tháng/năm theo giờ VN; `null` nếu `d` không phải thời điểm hợp lệ. */
export function phanNgayVN(d: Date): { ngay: number; thang: number; nam: number } | null {
  const t = thanhPhan(d);
  return t ? { ngay: t.ngay, thang: t.thang, nam: t.nam } : null;
}

/** "YYYY-MM-DD" theo giờ VN; chuỗi rỗng nếu không hợp lệ. */
export function ngayVN(d: Date): string {
  const t = thanhPhan(d);
  if (!t) return '';
  return `${t.nam}-${String(t.thang).padStart(2, '0')}-${String(t.ngay).padStart(2, '0')}`;
}

/** "HH:mm" 24 giờ theo giờ VN; chuỗi rỗng nếu không hợp lệ. */
export function gioPhutVN(d: Date): string {
  const t = thanhPhan(d);
  return t ? `${String(t.gio).padStart(2, '0')}:${String(t.phut).padStart(2, '0')}` : '';
}

export function homNayVN(now: Date = new Date()): string {
  return ngayVN(now);
}

export function laGioPhutHopLe(v: unknown): v is string {
  return typeof v === 'string' && DAU_GIO_PHUT.test(v);
}

function phutTrongNgay(gio: string): number {
  const [h, m] = gio.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Ngày khai là HÔM NAY (giờ VN) mà giờ khai vượt giờ hiện tại quá `DUNG_SAI_GIO_PHUT` phút?
 *
 * Chỉ xét khi ngày = hôm nay: ngày quá khứ thì giờ nào cũng hợp lệ, ngày tương lai đã bị luật "ngày tiếp nhận không được
 * là ngày tương lai" chặn từ trước. Không có giờ → không có gì để kiểm.
 */
export function laThoiDiemTuongLai(
  ngay: Date | string,
  gio: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!laGioPhutHopLe(gio)) return false;
  const ngayKhai = ngayVN(ngay instanceof Date ? ngay : new Date(ngay));
  if (!ngayKhai || ngayKhai !== homNayVN(now)) return false;
  return phutTrongNgay(gio) > phutTrongNgay(gioPhutVN(now)) + DUNG_SAI_GIO_PHUT;
}
