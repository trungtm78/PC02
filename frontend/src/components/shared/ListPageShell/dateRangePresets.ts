/**
 * dateRangePresets.ts — "Chọn khoảng thời gian" của hệ cũ.
 *
 * Nút mở danh sách mốc dựng sẵn rồi điền vào ô Từ ngày / Đến ngày. Thuần frontend: chỉ
 * tính hai mốc rồi ghi vào bộ lọc `fromDate`/`toDate` đã có sẵn ở máy chủ.
 *
 * Mốc "hôm nay" nhận từ tham số thay vì gọi `new Date()` bên trong, để ca kiểm cố định
 * được thời điểm và không đỏ theo ngày chạy.
 */

export type DateRangePresetKey = 'hom-nay' | 'tuan-nay' | 'thang-nay' | 'quy-nay' | 'nam-nay';

export interface DateRangePreset {
  key: DateRangePresetKey;
  label: string;
}

export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  { key: 'hom-nay', label: 'Hôm nay' },
  { key: 'tuan-nay', label: 'Tuần này' },
  { key: 'thang-nay', label: 'Tháng này' },
  { key: 'quy-nay', label: 'Quý này' },
  { key: 'nam-nay', label: 'Năm nay' },
] as const;

export interface KhoangThoiGian {
  fromDate: string;
  toDate: string;
}

/** `YYYY-MM-DD` theo giờ địa phương — dùng UTC ở đây sẽ lệch một ngày với múi giờ +7. */
function ngayISO(d: Date): string {
  const thang = String(d.getMonth() + 1).padStart(2, '0');
  const ngay = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${thang}-${ngay}`;
}

/**
 * Thứ Hai của tuần chứa `d`.
 *
 * Tuần làm việc Việt Nam bắt đầu THỨ HAI. `getDay()` trả 0 cho Chủ nhật, nên dùng thẳng
 * sẽ coi Chủ nhật là đầu tuần SAU — cán bộ bấm "Tuần này" vào Chủ nhật mất cả tuần vừa làm.
 */
function thuHaiCuaTuan(d: Date): Date {
  const thu = d.getDay();
  const lui = thu === 0 ? 6 : thu - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - lui);
}

/** Ngày cuối tháng: ngày 0 của tháng kế tiếp — tự đúng với tháng 30 ngày và năm nhuận. */
function ngayCuoiThang(nam: number, thang: number): Date {
  return new Date(nam, thang + 1, 0);
}

export function tinhKhoangThoiGian(
  key: DateRangePresetKey,
  homNay: Date,
): KhoangThoiGian | null {
  const nam = homNay.getFullYear();
  const thang = homNay.getMonth();

  switch (key) {
    case 'hom-nay':
      return { fromDate: ngayISO(homNay), toDate: ngayISO(homNay) };

    case 'tuan-nay': {
      const dau = thuHaiCuaTuan(homNay);
      const cuoi = new Date(dau.getFullYear(), dau.getMonth(), dau.getDate() + 6);
      return { fromDate: ngayISO(dau), toDate: ngayISO(cuoi) };
    }

    case 'thang-nay':
      return {
        fromDate: ngayISO(new Date(nam, thang, 1)),
        toDate: ngayISO(ngayCuoiThang(nam, thang)),
      };

    case 'quy-nay': {
      const thangDauQuy = Math.floor(thang / 3) * 3;
      return {
        fromDate: ngayISO(new Date(nam, thangDauQuy, 1)),
        toDate: ngayISO(ngayCuoiThang(nam, thangDauQuy + 2)),
      };
    }

    case 'nam-nay':
      return {
        fromDate: ngayISO(new Date(nam, 0, 1)),
        toDate: ngayISO(new Date(nam, 11, 31)),
      };

    default:
      // Khoá lạ: trả null thay vì đoán bừa một khoảng — lọc sai mà cán bộ không biết là
      // tệ hơn không lọc.
      return null;
  }
}
