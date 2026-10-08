/**
 * Giờ/phút "HH:mm" 24 giờ theo GIỜ VIỆT NAM — logic THUẦN của ô "Giờ tiếp nhận" (08/10/2026).
 *
 * Mục tiêu của anh: nhập NHANH. Gõ liền chữ số `0830` → hiện `08:30`; `830` → `8:30` rồi chuẩn hoá `08:30` khi rời ô.
 * Nhưng đây là số liệu trên văn bản tố tụng, nên QUY TẮC: không bao giờ im lặng sửa một giá trị SAI thành giá trị ĐÚNG.
 * Giờ > 23 hay phút > 59 báo lỗi tại ô, không cắt, không đoán lại.
 *
 * Quy tắc tách giờ khi gõ liền chữ số (chỉ nhìn chữ số đầu — không bao giờ đổi cách hiểu một tiền tố đã gõ):
 *   - chữ số đầu 0, 1, 2 → giờ có 2 chữ số  ("0830"→"08:30", "1430"→"14:30", "245"→"24:5" rồi báo lỗi giờ 24)
 *   - chữ số đầu 3–9     → giờ có 1 chữ số  ("830"→"8:30", "9"→"9"): không giờ hợp lệ nào bắt đầu bằng 3–9 ở dạng 2 chữ số
 * Dấu `:` bị Backspace xoá được vì dấu hai chấm chỉ tự chèn khi đã có chữ số phút (hoặc người dùng tự gõ).
 */
export const MUI_GIO_VN = 'Asia/Ho_Chi_Minh';

/** "HH:mm" 24 giờ chặt — khớp DTO/CHECK ở máy chủ (`DAU_GIO_PHUT`). */
export const DAU_GIO_PHUT = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Dung sai lệch đồng hồ khi kiểm "giờ không ở tương lai" — khớp máy chủ. */
export const DUNG_SAI_GIO_PHUT = 5;

export const LOI_GIO_SAI = 'Giờ phải từ 00 đến 23';
export const LOI_PHUT_SAI = 'Phút phải từ 00 đến 59';
export const LOI_GIO_TUONG_LAI = 'Giờ tiếp nhận không được ở tương lai';
export const LOI_GIO_KHONG_HOP_LE = 'Giờ tiếp nhận không hợp lệ (dạng HH:MM, ví dụ 09:30)';

export function laGioPhutHopLe(v: unknown): v is string {
  return typeof v === 'string' && DAU_GIO_PHUT.test(v);
}

const soChuSo = (s: string) => s.replace(/\D/g, '');

/**
 * Chuỗi HIỂN THỊ khi đang gõ hoặc vừa dán. Chấp nhận dấu tách `:` `.` `,` khoảng trắng, chữ `h`/`g`, cụm "giờ" (và bỏ
 * "phút"), nên dán `8h30`, `8g30`, `8 giờ 30`, `08.30`, `0830` đều ra cùng một dạng.
 */
export function dinhDangKhiGo(raw: string): string {
  const s = String(raw ?? '')
    .trim() // khoảng trắng ĐẦU/CUỐI không phải dấu tách (chỉ khoảng trắng GIỮA hai số mới là dấu tách: "8 30")
    .replace(/\s*phút\s*/gi, '')
    .replace(/\s*giờ\s*/gi, ':')
    .replace(/[hHgG.,\s]/g, ':');
  if (s.includes(':')) {
    const phan = s.split(':');
    const gio = soChuSo(phan[0]).slice(0, 2);
    if (gio === '') return '';
    const phut = soChuSo(phan.slice(1).join('')).slice(0, 2);
    return `${gio}:${phut}`;
  }
  const d = soChuSo(s).slice(0, 4);
  if (d === '') return '';
  const doDaiGio = d[0] >= '3' ? 1 : 2;
  if (d.length <= doDaiGio) return d;
  return `${d.slice(0, doDaiGio)}:${d.slice(doDaiGio, doDaiGio + 2)}`;
}

export interface KetQuaChuanHoa {
  /** Giá trị sau chuẩn hoá. Khi có lỗi, vẫn là chuỗi đang hiển thị để người dùng thấy mình đã gõ gì. */
  giaTri: string;
  loi: string | null;
}

/** Chuẩn hoá khi RỜI Ô. Rỗng là hợp lệ (ô không bắt buộc: NULL = không biết giờ). */
export function chuanHoaKhiRoiO(raw: string): KetQuaChuanHoa {
  const hienThi = dinhDangKhiGo(raw);
  if (hienThi === '') return { giaTri: '', loi: null };
  const [g, p = ''] = hienThi.split(':');
  const gio = Number(g);
  if (gio > 23) return { giaTri: hienThi, loi: LOI_GIO_SAI };
  const phutChuoi = p === '' ? '00' : p.length === 1 ? `0${p}` : p;
  if (Number(phutChuoi) > 59) return { giaTri: hienThi, loi: LOI_PHUT_SAI };
  return { giaTri: `${String(gio).padStart(2, '0')}:${phutChuoi}`, loi: null };
}

/** Cộng/trừ phút, vòng quanh 24 giờ. Giá trị không hợp lệ → giữ nguyên. */
export function buocGioPhut(giaTri: string, phut: number): string {
  if (!laGioPhutHopLe(giaTri)) return giaTri;
  const [g, p] = giaTri.split(':').map(Number);
  const tong = (((g * 60 + p + phut) % 1440) + 1440) % 1440;
  return `${String(Math.floor(tong / 60)).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
}

const DINH_DANG = new Intl.DateTimeFormat('en-CA', {
  timeZone: MUI_GIO_VN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  // `h23`: nửa đêm là "00", không phải "24" (một số ICU với `hour12:false` cho "24:05").
  hourCycle: 'h23',
});

function phan(now: Date): { ngay: string; gio: string } {
  const m: Record<string, string> = {};
  for (const p of DINH_DANG.formatToParts(now)) m[p.type] = p.value;
  const gio = m.hour === '24' ? '00' : m.hour;
  return { ngay: `${m.year}-${m.month}-${m.day}`, gio: `${gio}:${m.minute}` };
}

/** Giờ hiện tại theo giờ VN, "HH:mm" 24 giờ. Tính LÚC GỌI (không lưu hằng mô-đun). */
export function gioHienTaiVN(now: Date = new Date()): string {
  return phan(now).gio;
}

/**
 * Ngày khai là HÔM NAY (giờ VN) mà giờ khai vượt giờ hiện tại quá dung sai? Khớp `laThoiDiemTuongLai` của máy chủ.
 * Ngày quá khứ → giờ nào cũng hợp lệ. Không có giờ hợp lệ → không có gì để kiểm.
 */
export function laGioTuongLai(ngay: string, gio: string, now: Date = new Date()): boolean {
  if (!laGioPhutHopLe(gio)) return false;
  const bayGio = phan(now);
  if (ngay !== bayGio.ngay) return false;
  const phut = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  return phut(gio) > phut(bayGio.gio) + DUNG_SAI_GIO_PHUT;
}
