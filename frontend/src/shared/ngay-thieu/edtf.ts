/**
 * Ngày CÓ THỂ THIẾU thành phần, lưu theo EDTF Level 1 (ISO 8601-2 — chuẩn Library of Congress
 * cho ngày không đầy đủ): `2026-12-15` · `2026-12-XX` · `2026-XX-XX`.
 *
 * Vì sao EDTF chứ không lưu nguyên văn "__/12/2026": chuỗi EDTF SẮP XẾP đúng thứ tự thời gian
 * bằng so chuỗi, và lọc "tháng 12/2026" chạy thẳng bằng `LIKE '2026-12%'` trên cả đơn nhập đủ
 * lẫn nhập thiếu. Lưu nguyên văn thì cột chỉ để hiện, không dùng được vào việc gì.
 *
 * Nguyên tắc: KHÔNG BAO GIỜ bịa ngày 01. Thiếu ngày thì cột ngày thật để trống.
 */

export interface NgayTungPhan {
  ngay: string;
  thang: string;
  nam: string;
}

const KHUYET = 'XX';

const dem = (v: string, n: number) => v.trim().padStart(n, '0');

/** Ngày có thật trên lịch — `new Date` tự cuộn 31/02 thành 03/03 nên phải so lại từng phần. */
function laNgayThat(ngay: number, thang: number, nam: number): boolean {
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  return (
    d.getUTCFullYear() === nam && d.getUTCMonth() === thang - 1 && d.getUTCDate() === ngay
  );
}

export function sangEdtf(p: NgayTungPhan): string | null {
  const nam = p.nam.trim();
  // Năm là phần không thể thiếu: không có nó thì chuỗi không sắp xếp được, và cũng không nói
  // lên điều gì về thời gian.
  if (!nam) return null;
  const thang = p.thang.trim();
  const ngay = p.ngay.trim();
  if (!thang) return `${dem(nam, 4)}-${KHUYET}-${KHUYET}`;
  if (!ngay) return `${dem(nam, 4)}-${dem(thang, 2)}-${KHUYET}`;
  return `${dem(nam, 4)}-${dem(thang, 2)}-${dem(ngay, 2)}`;
}

export function tuEdtf(edtf: string | null | undefined): NgayTungPhan {
  const rong = { ngay: '', thang: '', nam: '' };
  if (!edtf) return rong;
  const m = /^(\d{4})-(\d{2}|XX)-(\d{2}|XX)$/.exec(edtf.trim());
  if (!m) return rong;
  return {
    nam: m[1],
    thang: m[2] === KHUYET ? '' : m[2],
    ngay: m[3] === KHUYET ? '' : m[3],
  };
}

/**
 * Chuỗi cho CỘT NGÀY THẬT — chỉ khi đủ ba phần.
 *
 * Thiếu một phần thì trả `null`: bịa ngày 01 để cột ngày có giá trị là đưa một mốc không ai
 * nhập vào hồ sơ, rồi nó đi thẳng lên bản in chứng từ.
 */
export function sangNgayDayDu(p: NgayTungPhan): string | null {
  if (!p.ngay.trim() || !p.thang.trim() || !p.nam.trim()) return null;
  if (loiNgayTungPhan(p)) return null;
  return `${dem(p.nam, 4)}-${dem(p.thang, 2)}-${dem(p.ngay, 2)}`;
}

/** Hiện lại ĐÚNG thứ cán bộ đã gõ: `__/12/2026`, không tự điền ngày. */
export function hienThiEdtf(edtf: string | null | undefined): string {
  const p = tuEdtf(edtf);
  if (!p.nam) return '';
  return `${p.ngay || '__'}/${p.thang || '__'}/${p.nam}`;
}

/**
 * Kiểm ngày RÁP LẠI, không kiểm từng ô.
 *
 * 31/02/2026 có từng phần đều trong khoảng nhưng không tồn tại trên lịch — kiểm từng ô thì
 * lọt, và Postgres lặng lẽ đổi nó thành 03/03.
 *
 * Thiếu từ TRÁI sang phải là hợp lệ (`__/12/2026`, `__/__/2026`) — đó chính là điều cần làm
 * được. Thiếu từ PHẢI sang trái thì vô nghĩa: biết ngày mà không biết tháng là không biết gì.
 */
export function loiNgayTungPhan(p: NgayTungPhan): string | null {
  const ngay = p.ngay.trim();
  const thang = p.thang.trim();
  const nam = p.nam.trim();

  if (!ngay && !thang && !nam) return null;
  if (!nam) return 'Thiếu năm — có ngày/tháng thì phải có năm';
  if (ngay && !thang) return 'Có ngày mà thiếu tháng — điền tháng hoặc bỏ trống cả ngày';

  const n = Number(nam);
  if (!/^\d{1,4}$/.test(nam) || n < 1) return 'Năm không hợp lệ';

  if (thang) {
    if (!/^\d{1,2}$/.test(thang)) return 'Tháng không hợp lệ';
    const t = Number(thang);
    if (t < 1 || t > 12) return 'Tháng phải từ 1 đến 12';
    if (ngay) {
      if (!/^\d{1,2}$/.test(ngay)) return 'Ngày không hợp lệ';
      const d = Number(ngay);
      if (d < 1 || !laNgayThat(d, t, n)) return `Ngày ${ngay}/${thang}/${nam} không có thật`;
    }
  }
  return null;
}

/**
 * Chuỗi EDTF có phải ngày CÓ THẬT không — dùng lúc Lưu, không chỉ hiện chữ đỏ dưới ô.
 *
 * Hình dạng đúng chưa đủ: `2026-02-31` khớp mẫu nhưng không tồn tại trên lịch. Chữ đỏ dưới ô
 * mà vẫn Lưu được thì cán bộ bấm Lưu, máy chủ trả 400, và thông báo ấy khó hiểu hơn hẳn lỗi
 * tại chỗ. Máy chủ kiểm cùng luật ở `is-edtf-ngay-that.validator.ts`.
 */
export function loiEdtf(edtf: string | null | undefined): string | null {
  if (!edtf) return null;
  if (!/^\d{4}-(\d{2}|XX)-(\d{2}|XX)$/.test(edtf)) return 'Ngày viết đơn không đúng dạng';
  return loiNgayTungPhan(tuEdtf(edtf));
}
