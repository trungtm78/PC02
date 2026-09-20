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
  /*
    Năm KHÔNG được đệm 0, khác hẳn ngày/tháng.

    Đệm ngày/tháng là chuẩn hoá thứ cán bộ gõ tắt ("5/3" ý là mồng 5 tháng 3). Đệm NĂM là bịa:
    `dem('20', 4)` biến một năm gõ thiếu thành `0020`, và chuỗi ấy đúng hình dạng EDTF nên
    `loiEdtf` không còn thấy gì sai — nút Lưu mở, cột nhận năm 20. Để nguyên `20` thì chuỗi
    lệch hình dạng và bị chặn ngay ở `validate.ts`.
  */
  if (!thang) return `${nam}-${KHUYET}-${KHUYET}`;
  if (!ngay) return `${nam}-${dem(thang, 2)}-${KHUYET}`;
  return `${nam}-${dem(thang, 2)}-${dem(ngay, 2)}`;
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
  /*
    Đúng BỐN chữ số, không phải "từ 1 đến 4".

    Ô ba phân đoạn che được khuyết điểm này: ô năm hiện rõ `20` nên cán bộ tự thấy mình gõ
    thiếu. Ô MỘT DÒNG thì `12/20` trông y như một ngày hoàn chỉnh — mà đoán hộ thế kỷ (2020?
    1920?) là bịa dữ liệu.

    Luật đặt ở ĐÂY chứ không ở ô nhập, vì `loiEdtf` gọi thẳng hàm này và `validate.ts` gọi
    `loiEdtf`: đặt ở đây thì năm thiếu chữ số CHẶN được nút Lưu; đặt ở ô nhập thì chỉ hiện chữ
    đỏ rồi cột vẫn lặng lẽ nhận `0020-12-XX`.
  */
  if (!/^\d{4}$/.test(nam)) return 'Năm phải đủ 4 chữ số';
  if (n < 1) return 'Năm không hợp lệ';

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
  /*
    Bắt năm bằng `\d+` chứ không `\d{4}`, rồi để `loiNgayTungPhan` phán.

    Dùng `\d{4}` thì `20-12-XX` chỉ nhận được câu "không đúng dạng" — đúng nhưng vô dụng với
    người vừa gõ `12/20`. Nới ở đây để luật năm-4-chữ-số nói đúng thứ cần sửa, và cũng để
    hình dạng chỉ còn MỘT nơi khai (hàm dưới) thay vì hai bản chép tay.
  */
  const m = /^(\d+)-(\d{2}|XX)-(\d{2}|XX)$/.exec(edtf.trim());
  if (!m) return 'Ngày viết đơn không đúng dạng';
  return loiNgayTungPhan({
    nam: m[1],
    thang: m[2] === KHUYET ? '' : m[2],
    ngay: m[3] === KHUYET ? '' : m[3],
  });
}

/**
 * Đọc chữ cán bộ GÕ hoặc DÁN vào một ô thành ba phần.
 *
 * Anh yêu cầu bỏ ba ô phân đoạn (20/09/2026) để chép ngày từ đơn giấy hay từ Word và dán MỘT
 * LẦN. Hàm này là toàn bộ phần "đọc"; mọi phép KIỂM vẫn là `loiNgayTungPhan` cũ — viết lại
 * luật lần hai là mở đường cho hai bản lệch nhau.
 *
 * Nguyên tắc: KHÔNG ĐOÁN HỘ. Thiếu phần nào thì để trống phần ấy và trả nguyên thứ đọc được,
 * kể cả khi biết chắc nó sai (`12/20`, `31/02/2026`) — chính `loiNgayTungPhan` mới là chỗ báo,
 * và nhờ thế nút Lưu bị chặn thay vì lặng lẽ ghi một ngày không ai nhập.
 *
 * Nhận: `15/12/2026` · `15-12-2026` · `15.12.2026` · `12/2026` · `2026` · `__/12/2026` (đúng
 * thứ `hienThiEdtf` in ra, nên dán lại được chính nó) · dãy số liền `15122026` / `122026`.
 */
export function tuChuNhapTay(chu: string): NgayTungPhan {
  const rong: NgayTungPhan = { ngay: '', thang: '', nam: '' };
  const s = (chu ?? '').trim();
  if (!s) return rong;

  // Dãy chữ số liền, không dấu ngăn: độ dài NÓI lên cấu trúc. Độ dài khác thì rơi xuống nhánh
  // dưới và thành một "phần năm" sai độ dài — để `loiNgayTungPhan` báo, không tự cắt bừa.
  if (/^\d+$/.test(s)) {
    if (s.length === 8) return { ngay: s.slice(0, 2), thang: s.slice(2, 4), nam: s.slice(4) };
    if (s.length === 6) return { ngay: '', thang: s.slice(0, 2), nam: s.slice(2) };
    return { ngay: '', thang: '', nam: s };
  }

  // `_` là ký tự KHUYẾT của `hienThiEdtf`, nên `__` phải đọc ra phần rỗng chứ không phải rác.
  const phan = s.split(/[\s/.-]+/).filter((x) => x !== '');
  const doc = (x: string) => (/^_+$/.test(x) ? '' : x);

  if (phan.length === 3) return { ngay: doc(phan[0]), thang: doc(phan[1]), nam: doc(phan[2]) };
  if (phan.length === 2) return { ngay: '', thang: doc(phan[0]), nam: doc(phan[1]) };
  if (phan.length === 1) return { ngay: '', thang: '', nam: doc(phan[0]) };

  /*
    Thừa phân đoạn (`15/12/2026/99`). Lấy ba cái đầu rồi báo hợp lệ là NUỐT phần thừa: cán bộ
    dán nhầm cả một đoạn văn và hệ lưu ra một ngày trông rất hợp lý. Trả về một "năm" chính là
    chuỗi gốc để `loiNgayTungPhan` báo sai độ dài — người gõ nhìn thấy và tự sửa.
  */
  return { ngay: '', thang: '', nam: s };
}
