/**
 * Phép so sánh giữa kỳ báo cáo hiện tại và một kỳ nền.
 *
 * ── Vì sao có tệp này ──
 *
 * Trước đây bốn thẻ của báo cáo tháng mang huy hiệu `change: "+12%"` — một chuỗi viết thẳng
 * trong mã, không đọc dữ liệu ở đâu cả. Mở tháng nào, năm nào, đơn vị nào cũng ra "+12%".
 * Nó sai kể cả khi mọi thứ chạy tốt, và nó nằm trên tờ báo cáo cán bộ mang đi họp.
 *
 * Tệp này là phép tính thật, tách rời khỏi Prisma và khỏi HTTP để ca kiểm với tới được.
 *
 * ── Ba luật không hiển nhiên ──
 *
 * 1. **Nền bằng 0 thì phần trăm không tồn tại.** 0 → 5 không phải "tăng 500%", cũng không phải
 *    "tăng 0%": phép chia cho 0 vô định. Nói ra là "mới phát sinh 5", kèm số tuyệt đối.
 *
 * 2. **Nền quá nhỏ thì phần trăm dao động dữ và đánh lừa.** 1 → 2 hiện thành "+100%" trông
 *    như một biến động lớn, trong khi chênh lệch thật là MỘT hồ sơ. Cơ quan thống kê y tế
 *    (Washington DOH, Oregon OHA) chặn tỷ lệ khi số ca ≤ 10 và ghi chú khi 11–20, vì dưới
 *    ngưỡng ấy sai số chuẩn tương đối vượt 25%. Lấy đúng hai ngưỡng ấy.
 *
 * 3. **Tăng không đồng nghĩa với tốt.** Báo cáo ngành Công an đọc "giảm 23,16% số vụ" như một
 *    THÀNH TÍCH, còn "giảm số vụ đã giải quyết" là điều ngược lại. Chiều tốt/xấu là thuộc tính
 *    của từng chỉ tiêu, không suy ra được từ dấu của con số.
 */

/** Vì sao không đưa ra được tỷ lệ phần trăm. */
export type LyDoKhongCoTyLe =
  /** Kỳ nền bằng 0 — phép chia vô định. */
  | 'NEN_BANG_KHONG'
  /** Kỳ nền dưới ngưỡng tin cậy — tỷ lệ sẽ đánh lừa. */
  | 'NEN_QUA_NHO'
  /** Không có kỳ nền để so (người dùng tắt so sánh, hoặc kỳ nền nằm ngoài dữ liệu). */
  | 'KHONG_CO_NEN';

/** Mức tin cậy của tỷ lệ, theo cỡ của kỳ nền. */
export type DoTinCay =
  /** Nền đủ lớn — tỷ lệ dùng được. */
  | 'DU'
  /** Nền nhỏ (11–20) — tỷ lệ tính được nhưng dao động mạnh, phải ghi chú. */
  | 'DAO_DONG'
  /** Nền quá nhỏ (≤10) hoặc bằng 0 — không đưa ra tỷ lệ. */
  | 'KHONG_DU';

export type Chieu = 'TANG' | 'GIAM' | 'KHONG_DOI';

export interface KetQuaSoSanh {
  hienTai: number;
  /** `null` khi không có kỳ nền. */
  nen: number | null;
  /** Chênh lệch tuyệt đối. Luôn tính được khi có nền — và luôn trung thực. */
  chenhLech: number | null;
  /** Phần trăm, làm tròn 2 chữ số. `null` khi không đưa ra được — xem `lyDoKhongCoTyLe`. */
  tyLe: number | null;
  lyDoKhongCoTyLe: LyDoKhongCoTyLe | null;
  doTinCay: DoTinCay;
  chieu: Chieu;
  /** `true` = diễn biến tốt, `false` = xấu, `null` = chỉ tiêu trung tính hoặc không đổi. */
  tot: boolean | null;
}

/**
 * Ngưỡng lấy từ hướng dẫn công bố số liệu của cơ quan thống kê y tế Hoa Kỳ (Poisson RSE):
 * đếm ≤ 10 thì chặn tỷ lệ, 11–20 thì công bố kèm ghi chú. Đặt tên và ghi nguồn ngay đây để
 * lần sau ai muốn đổi thì biết mình đang đổi cái gì.
 */
export const NEN_TOI_THIEU_DE_CO_TY_LE = 11;
export const NEN_TOI_THIEU_DE_ON_DINH = 21;

/**
 * Chiều "tốt" của một chỉ tiêu.
 * - `true`  — càng cao càng tốt (đã giải quyết, khám phá).
 * - `false` — càng cao càng xấu (quá hạn, số vụ phạm tội).
 * - `null`  — trung tính: khối lượng việc đến, tăng hay giảm đều không phải thành tích.
 */
export type ChieuTot = boolean | null;

export function soSanh(
  hienTai: number,
  nen: number | null,
  chieuTot: ChieuTot = null,
): KetQuaSoSanh {
  if (nen === null) {
    return {
      hienTai,
      nen: null,
      chenhLech: null,
      tyLe: null,
      lyDoKhongCoTyLe: 'KHONG_CO_NEN',
      doTinCay: 'KHONG_DU',
      chieu: 'KHONG_DOI',
      tot: null,
    };
  }

  const chenhLech = hienTai - nen;
  const chieu: Chieu = chenhLech > 0 ? 'TANG' : chenhLech < 0 ? 'GIAM' : 'KHONG_DOI';
  const tot = chieuTot === null || chieu === 'KHONG_DOI' ? null : chieuTot === (chieu === 'TANG');

  const chung = { hienTai, nen, chenhLech, chieu, tot };

  if (nen === 0) {
    return { ...chung, tyLe: null, lyDoKhongCoTyLe: 'NEN_BANG_KHONG', doTinCay: 'KHONG_DU' };
  }
  if (nen < NEN_TOI_THIEU_DE_CO_TY_LE) {
    return { ...chung, tyLe: null, lyDoKhongCoTyLe: 'NEN_QUA_NHO', doTinCay: 'KHONG_DU' };
  }

  return {
    ...chung,
    tyLe: Math.round((chenhLech / nen) * 10000) / 100,
    lyDoKhongCoTyLe: null,
    doTinCay: nen < NEN_TOI_THIEU_DE_ON_DINH ? 'DAO_DONG' : 'DU',
  };
}
