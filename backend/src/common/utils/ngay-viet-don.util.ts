/**
 * Hiển thị "Ngày viết đơn" — MỘT nơi cho mọi chỗ đọc nó.
 *
 * Hồ sơ giữ hai cột: `petitionDate` (ngày thật, chỉ có khi nhập ĐỦ) và `ngayVietDonEdtf`
 * (EDTF Level 1, có cả khi nhập thiếu: `2026-12-XX`). Mỗi nơi tự ghép hai cột là mời chúng
 * trôi khỏi nhau — nơi này in "__/12/2026", nơi kia in rỗng, nơi thứ ba bịa ra ngày 01.
 *
 * Cổng `moiNoiInNgayVietDonDungMotHam` bắt mọi nơi đọc thẳng `petitionDate` để in.
 */

const KHUYET = 'XX';

interface HoSoCoNgay {
  petitionDate?: Date | string | null;
  ngayVietDonEdtf?: string | null;
}

function hai(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Chuỗi hiện cho người đọc: `15/12/2026` · `__/12/2026` · `__/__/2026` · `''`.
 *
 * KHÔNG BAO GIỜ bịa ngày: thiếu phần nào thì phần ấy là `__`.
 */
export function ngayVietDonHienThi(r: HoSoCoNgay): string {
  const edtf = r.ngayVietDonEdtf?.trim();
  if (edtf) {
    const m = /^(\d{4})-(\d{2}|XX)-(\d{2}|XX)$/.exec(edtf);
    if (m) {
      const ngay = m[3] === KHUYET ? '__' : m[3];
      const thang = m[2] === KHUYET ? '__' : m[2];
      return `${ngay}/${thang}/${m[1]}`;
    }
  }
  // Hồ sơ cũ chưa có cột EDTF thì vẫn in được từ cột ngày thật.
  const d = r.petitionDate ? new Date(r.petitionDate) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
