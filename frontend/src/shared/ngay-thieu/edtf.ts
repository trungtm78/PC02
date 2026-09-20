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
  /*
    Thiếu tháng mà CÓ ngày thì vẫn dựng chuỗi mang phần ngày, chứ không lặng lẽ vứt nó đi.

    Vứt đi là mất dữ liệu không ai thấy: cổng Lưu kiểm chuỗi ĐÃ SUY (`loiEdtf`) chứ không kiểm
    chữ thô, nên `15/__/2026` hoá `2026-XX-XX` là hợp lệ — cán bộ bấm Lưu, máy chủ trả 200, và
    ngày 15 biến mất. Giữ lại thì `loiEdtf` nhìn thấy và chặn ngay tại form.

    Chuỗi `2026-XX-15` cố ý KHÔNG phải EDTF hợp lệ (EDTF không cho tháng khuyết mà ngày rõ), nên
    máy chủ cũng từ chối — hai lớp chứ không một.
  */
  if (!thang) return ngay ? `${nam}-${KHUYET}-${dem(ngay, 2)}` : `${nam}-${KHUYET}-${KHUYET}`;
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
  /*
    Dải năm hợp lý — "đủ 4 chữ số" chưa đủ.

    Đo dữ liệu thật 20/09/2026: 41.820 đơn có ngày, năm nhỏ nhất 208, lớn nhất 2925, 7 hồ sơ
    ngoài dải. Đúng loại rác mà `legacy-migration/cli/sua-nam-ngay-tiep-nhan.ts` đã phải viết
    CLI đi dọn. Ô một dòng còn làm nó dễ gặp hơn: gõ ngày+tháng liền tay rồi dừng (`1512`) là
    đúng bốn chữ số nên luật trên không thấy gì sai.

    Cận trên là NĂM SAU: đơn đề ngày tới là chuyện có thật, đơn đề năm 2925 thì không.
  */
  const NAM_SOM_NHAT = 1900;
  const namMuonNhat = new Date().getFullYear() + 1;
  if (n < NAM_SOM_NHAT || n > namMuonNhat)
    return `Năm phải trong khoảng ${NAM_SOM_NHAT}–${namMuonNhat}`;

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
  if (!chu) return rong;

  /*
    Chuẩn hoá trước khi tách. Ba thứ dưới đây không phải ca biên mà là đường chính của một ô
    sinh ra ĐỂ DÁN:
    - `_` là ký tự khuyết của `hienThiEdtf`. Thao tác tự nhiên nhất trên ô là đặt con trỏ đầu
      dòng `__/12/2026` rồi gõ đè lên chỗ khuyết mà KHÔNG bôi đen → `15__/12/2026`.
    - Word tự đổi `-` thành gạch nối dài `–` `—` `−` khi gõ ngày.
    - Dấu phẩy đuôi khi chép từ một câu văn.
  */
  const s = chu
    .replace(/[‒–—―−]/g, '-')
    .replace(/_/g, '')
    .trim();
  if (!s) return rong;

  // Dãy chữ số liền, không dấu ngăn: độ dài NÓI lên cấu trúc. Độ dài khác thì rơi xuống nhánh
  // dưới và thành một "phần năm" sai độ dài — để `loiNgayTungPhan` báo, không tự cắt bừa.
  if (/^\d+$/.test(s)) {
    if (s.length === 8) return { ngay: s.slice(0, 2), thang: s.slice(2, 4), nam: s.slice(4) };
    if (s.length === 6) return { ngay: '', thang: s.slice(0, 2), nam: s.slice(2) };
    return { ngay: '', thang: '', nam: s };
  }

  const manh = s.split(/[\s/.,-]+/).filter((x) => x !== '');
  // Bỏ chữ dẫn ("Ngày 15/12/2026" — chép từ một câu văn).
  while (manh.length && !/^\d+$/.test(manh[0])) manh.shift();
  /*
    Chỉ lấy DÃY LIỀN các mảnh toàn chữ số ở đầu, dừng ở mảnh đầu tiên không phải số.

    Nhờ thế `15/12/2026 10:30` lấy đúng phần ngày và bỏ phần giờ, mà `15/12/2026/99` vẫn là
    BỐN mảnh số nên rơi xuống nhánh báo lỗi bên dưới — nuốt phần thừa mới là điều nguy hiểm.
  */
  const dung = manh.findIndex((x) => !/^\d+$/.test(x));
  const phan = dung === -1 ? manh : manh.slice(0, dung);

  /*
    ISO trước: `2026-12-15` là thứ chép ra từ cột hệ cũ và từ mọi bản kết xuất. Đọc theo thứ tự
    ngày/tháng/năm thì nó thành "ngày 2026" — sai câm, và câu báo lỗi lại trỏ vào năm.

    Nhận diện bằng CẤU TRÚC chứ không bằng dấu ngăn: mảnh đầu bốn chữ số thì chỉ có thể là năm.
  */
  const laIso = phan.length >= 2 && phan[0].length === 4;

  if (phan.length === 3)
    return laIso
      ? { ngay: phan[2], thang: phan[1], nam: phan[0] }
      : { ngay: phan[0], thang: phan[1], nam: phan[2] };
  if (phan.length === 2)
    return laIso
      ? { ngay: '', thang: phan[1], nam: phan[0] }
      : { ngay: '', thang: phan[0], nam: phan[1] };
  if (phan.length === 1) return { ngay: '', thang: '', nam: phan[0] };

  /*
    Không mảnh số nào, hoặc thừa mảnh số (`15/12/2026/99`). Lấy ba cái đầu rồi báo hợp lệ là
    NUỐT phần thừa: cán bộ dán nhầm cả một đoạn và hệ lưu ra một ngày trông rất hợp lý. Trả về
    một "năm" chính là chuỗi gốc để `loiNgayTungPhan` báo sai — người gõ nhìn thấy và tự sửa.
  */
  return { ngay: '', thang: '', nam: s };
}

