/**
 * Làm sạch một giá trị bất kỳ thành thứ `<input type="date">` nhận được.
 *
 * VÌ SAO PHẢI TỰ LÀM, KHÔNG PHÓ MẶC TRÌNH DUYỆT — đo 23/09/2026 bằng Playwright, cùng một
 * trang, chỉ khác engine:
 *
 *     <input type="date" value="undefined">
 *       Chromium  →  .value === ""            (làm sạch theo đặc tả HTML)
 *       WebKit    →  .value === "undefined"   (GIỮ NGUYÊN chuỗi rác)
 *
 * WebKit là engine của Safari. Trên máy macOS, một chuỗi hỏng lọt vào ô ngày sẽ sống sót qua
 * giao diện rồi ĐI LÊN MÁY CHỦ lúc bấm Lưu — trong khi trên Windows cùng bản dựng ấy ô chỉ
 * hiện rỗng nên không ai thấy gì bất thường. Hỏng im lặng, và chỉ hỏng ở một nửa số máy.
 *
 * CẮT TIỀN TỐ, KHÔNG QUY ĐỔI MÚI GIỜ. Đi qua `new Date` thì một giá trị ngày trần bị lệch một
 * ngày ở nửa số trường hợp (`2021-03-15T23:00:00Z` ở giờ Việt Nam là 16/03). Panel anh em
 * `LegacyParityFields` cắt tiền tố từ đầu; hai panel dựng CÙNG một loại ô nên phải cho CÙNG
 * một kết quả, nếu không cùng một hồ sơ đọc ở hai chỗ sẽ ra hai ngày khác nhau.
 */

const DANG_NGAY = /^(\d{4})-(\d{2})-(\d{2})/;

const NGAY_TRONG_THANG = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * Ngày có thật trên lịch — tính bằng SỐ, không dùng `Date`.
 *
 * Bản đầu của hàm này kiểm bằng `new Date(Date.UTC(nam, thang - 1, ngay))` rồi so lại từng
 * phần. Codex bắt được 23/09/2026: `Date.UTC` đổi năm 0–99 thành 1900–1999 (luật tương thích
 * ngược của JavaScript), nên `0099-01-01` bị coi là sai lịch và bị xoá trắng — cùng với mọi
 * năm 1–99. Đo trên bản sao 46.755 hồ sơ: 0 hồ sơ mang năm ngoài [100..9999], nên lỗi ấy chưa
 * chạm dữ liệu thật; sửa vì nó sai, không vì nó đang gây hại.
 */
function coThatTrenLich(nam: number, thang: number, ngay: number): boolean {
  // Nam >= 1: dac ta HTML doi chuoi ngay hop le mang nam LON HON 0. Cong engine bat duoc
  // 24/09/2026 — truoc do ham cho `0000-01-01` di qua, roi Chromium TU CHOI (o ve rong) con
  // WebKit GIU NGUYEN. Tuc ham sinh ra chuoi ma trinh duyet khong nuot; ca kiem jsdom khong
  // bao gio thay duoc dieu do vi no chi do phep lam sach cua chinh no.
  // Nam > 0 la LUAT HTML. Tran 9999 la gioi han NGHIEP VU cua ta, khong phai cua dac ta:
  // HTML cho phep nam TU BON CHU SO TRO LEN, va ca hai engine deu nhan `10000-01-01`.
  // Ta chan vi ho so vu an khong co nam nam chu so, va vi bieu thuc doc chuoi chi lay
  // dung bon chu so — de tran cao hon thi hai nhanh (chuoi va Date) se lech nhau.
  if (nam < 1 || nam > 9999) return false;
  if (thang < 1 || thang > 12 || ngay < 1) return false;
  const nhuan = (nam % 4 === 0 && nam % 100 !== 0) || nam % 400 === 0;
  const toiDa = thang === 2 && nhuan ? 29 : NGAY_TRONG_THANG[thang - 1];
  return ngay <= toiDa;
}

/** Dựng `YYYY-MM-DD` từ ba số, sau khi đã biết chúng hợp lệ. */
function ghepNgay(nam: number, thang: number, ngay: number): string {
  const hai = (n: number) => String(n).padStart(2, '0');
  return `${String(nam).padStart(4, '0')}-${hai(thang)}-${hai(ngay)}`;
}

export function giaTriONgay(v: unknown): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    // KHÔNG dùng `toISOString().slice(0, 10)`: với năm ngoài [1000..9999] chuỗi ISO ở dạng
    // MỞ RỘNG (`+010000-01-01T…`), nên cắt 10 ký tự đầu cho ra `+010000-01` — đúng một chuỗi
    // rác lọt thẳng vào ô ngày. Codex bắt được 23/09/2026.
    const nam = v.getUTCFullYear();
    const thang = v.getUTCMonth() + 1;
    const ngay = v.getUTCDate();
    return coThatTrenLich(nam, thang, ngay) ? ghepNgay(nam, thang, ngay) : '';
  }
  if (typeof v !== 'string') return '';
  const m = DANG_NGAY.exec(v.trim());
  if (!m) return '';
  const [, nam, thang, ngay] = m;
  return coThatTrenLich(Number(nam), Number(thang), Number(ngay)) ? m[0] : '';
}
