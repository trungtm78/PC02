/**
 * Kỳ báo cáo và các phép dịch kỳ.
 *
 * ── Vì sao mô tả kỳ bằng (loại, năm, số) chứ không bằng cặp ngày ──
 *
 * "Cùng kỳ năm trước" của tháng 2/2028 là tháng 2/2027 — **28 ngày, không phải 29**. Nếu chỉ
 * giữ cặp ngày rồi trừ 365, tháng 2 nhuận sẽ trượt sang ngày 1/3. Giữ nguyên (loại, năm, số)
 * rồi dựng lại cặp ngày từ đó thì phép dịch luôn đúng, không cần biết tháng ấy dài bao nhiêu.
 *
 * ── Múi giờ ──
 *
 * Dùng đúng `new Date(nam, thang - 1, 1)` như `reports.service.ts` vẫn dùng cho kỳ hiện tại.
 * Đây KHÔNG phải lựa chọn về múi giờ mà là ràng buộc về tính nhất quán: kỳ nền phải cắt theo
 * cùng một thước với kỳ hiện tại, nếu không thì chênh lệch đo được một phần là do đổi thước.
 * Đổi múi giờ là việc riêng, phải đổi cả hai chỗ cùng lúc.
 */

export type LoaiKy = 'THANG' | 'QUY' | 'NAM' | 'LUY_KE' | 'TUY_CHON';

export interface Ky {
  loai: LoaiKy;
  nam: number;
  /** Tháng 1-12 hoặc quý 1-4. Không có với kỳ NAM. */
  so?: number;
  tu: Date;
  den: Date;
  /** Nhãn đọc được, dùng thẳng trong câu "so với …". */
  nhan: string;
}

function cuoiNgay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function kyThang(nam: number, thang: number): Ky {
  if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
    throw new Error(`Tháng không hợp lệ: ${thang}`);
  }
  return {
    loai: 'THANG',
    nam,
    so: thang,
    tu: new Date(nam, thang - 1, 1),
    // Ngày 0 của tháng kế = ngày cuối tháng này. Tự đúng với tháng 28/29/30/31 ngày.
    den: cuoiNgay(new Date(nam, thang, 0)),
    nhan: `tháng ${thang}/${nam}`,
  };
}

export function kyQuy(nam: number, quy: number): Ky {
  if (!Number.isInteger(quy) || quy < 1 || quy > 4) {
    throw new Error(`Quý không hợp lệ: ${quy}`);
  }
  const thangDau = (quy - 1) * 3 + 1;
  return {
    loai: 'QUY',
    nam,
    so: quy,
    tu: new Date(nam, thangDau - 1, 1),
    den: cuoiNgay(new Date(nam, thangDau + 2, 0)),
    nhan: `quý ${quy}/${nam}`,
  };
}

export function kyNam(nam: number): Ky {
  return {
    loai: 'NAM',
    nam,
    tu: new Date(nam, 0, 1),
    den: cuoiNgay(new Date(nam, 12, 0)),
    nhan: `năm ${nam}`,
  };
}

function dungLai(loai: LoaiKy, nam: number, so?: number): Ky {
  if (loai === 'THANG') return kyThang(nam, so!);
  if (loai === 'QUY') return kyQuy(nam, so!);
  if (loai === 'LUY_KE') return kyLuyKe(nam, so!);
  if (loai === 'TUY_CHON') {
    // Một khoảng tuỳ ý không có "cùng kỳ năm trước" đúng đắn: lùi 365 ngày sai vào năm nhuận,
    // lùi một năm dương lịch thì 29/2 không tồn tại. Từ chối rõ ràng còn hơn trả một khoảng
    // trông hợp lý mà lệch một ngày.
    throw new Error('Kỳ tuỳ chọn không dịch được — phải chọn khoảng nền riêng.');
  }
  return kyNam(nam);
}

/** Cùng kỳ năm trước — nền mặc định, theo quy ước báo cáo ngành. */
export function cungKyNamTruoc(ky: Ky): Ky {
  return dungLai(ky.loai, ky.nam - 1, ky.so);
}

/** Kỳ liền trước — tháng trước, quý trước, năm trước; tự lùi năm khi vượt đầu năm. */
export function kyLienTruoc(ky: Ky): Ky {
  if (ky.loai === 'NAM') return kyNam(ky.nam - 1);
  // Số kỳ trong một năm: tháng và lũy kế đều đếm theo tháng (12), quý đếm theo quý (4).
  // Bản đầu viết `loai === 'THANG' ? 12 : 4` nên lũy kế tháng 1 lùi về "lũy kế quý 4" — một kỳ
  // không tồn tại. Khai theo LOẠI, đừng khai theo phủ định của một loại.
  const canh = ky.loai === 'QUY' ? 4 : 12;
  const truoc = ky.so! - 1;
  return truoc >= 1 ? dungLai(ky.loai, ky.nam, truoc) : dungLai(ky.loai, ky.nam - 1, canh);
}

const MOT_NGAY = 86_400_000;

/** Số ngày (tính cả ngày đầu) từ `tu` tới `moc`. Trả 0 khi `moc` còn trước `tu`. */
export function soNgayDaTroi(ky: Ky, moc: Date): number {
  if (moc < ky.tu) return 0;
  const dauMoc = new Date(moc.getFullYear(), moc.getMonth(), moc.getDate());
  return Math.floor((dauMoc.getTime() - ky.tu.getTime()) / MOT_NGAY) + 1;
}

export function kyChuaTron(ky: Ky, moc: Date): boolean {
  return moc < ky.den;
}

/**
 * Cắt kỳ nền cho khớp tiến độ của kỳ hiện tại.
 *
 * Ngày 10 tháng 8 mà đem cả tháng 8 (mới có 10 ngày dữ liệu) so với cả tháng 8 năm ngoái (đủ
 * 31 ngày) thì tháng nào cũng "giảm 68%" — một kết luận sai có hệ thống, và tệ hơn nữa vì nó
 * sai theo hướng nghe như thành tích. Cắt kỳ nền còn đúng 10 ngày đầu thì hai vế mới so được.
 *
 * Kẹp ở `den` của kỳ nền: tháng 2/2028 có 29 ngày, tháng 2/2027 chỉ có 28.
 */
export function catTheoTienDo(kyNen: Ky, soNgay: number): Ky {
  // 0 ngày KHÔNG phải một khoảng nhỏ, mà là không có khoảng nào. Trả `den = tu` thì bộ lọc
  // `gte`/`lte` vẫn đếm được bản ghi ở đúng thời khắc đầu kỳ, và một chênh lệch dựng trên đó
  // trông y hệt số thật. Người gọi phải xử "chưa có nền" trước khi tới đây.
  if (soNgay <= 0) {
    throw new Error(`Không cắt được kỳ nền theo ${soNgay} ngày — kỳ chưa trôi ngày nào.`);
  }
  const cat = cuoiNgay(new Date(kyNen.tu.getTime() + (soNgay - 1) * MOT_NGAY));
  if (cat >= kyNen.den) return kyNen;
  return { ...kyNen, den: cat, nhan: `${kyNen.nhan} (${soNgay} ngày đầu)` };
}

/**
 * Kỳ LŨY KẾ: từ đầu năm tới hết kỳ đang chọn.
 *
 * ── Vì sao là một LOẠI KỲ chứ không phải một kiểu so sánh ──
 *
 * "Lũy kế 8 tháng đầu năm" đổi cả TỬ SỐ lẫn mẫu số: con số hiện trên thẻ phải là tổng 8 tháng,
 * không phải riêng tháng 8. Nếu coi nó là một kiểu SO SÁNH thì thẻ hiện số của tháng 8 mà huy
 * hiệu lại nói về 8 tháng — hai câu về hai kỳ khác nhau đứng cạnh nhau trên một thẻ.
 *
 * Là một loại kỳ thì mọi thứ đi theo: số liệu, huy hiệu, tiêu đề, tệp xuất ra. Và nền so sánh
 * vẫn dùng chung phép cũ — cùng kỳ năm trước của một kỳ lũy kế là kỳ lũy kế cùng độ dài năm
 * trước, tự đúng vì `cungKyNamTruoc` dựng lại từ (loại, năm, số).
 */
export function kyLuyKe(nam: number, denThang: number): Ky {
  if (!Number.isInteger(denThang) || denThang < 1 || denThang > 12) {
    throw new Error(`Tháng không hợp lệ: ${denThang}`);
  }
  return {
    loai: 'LUY_KE',
    nam,
    so: denThang,
    tu: new Date(nam, 0, 1),
    den: cuoiNgay(new Date(nam, denThang, 0)),
    nhan: `lũy kế ${denThang} tháng đầu năm ${nam}`,
  };
}

/**
 * Kỳ do người dùng tự chọn hai đầu.
 *
 * Không có "cùng kỳ năm trước" tự nhiên cho một khoảng tuỳ ý — lùi 365 ngày là sai vào năm
 * nhuận, mà lùi một năm dương lịch thì 29/2 không tồn tại. Nên kỳ tuỳ chọn CHỈ so được với một
 * khoảng nền cũng do người dùng chọn; các phép dịch kỳ từ chối làm việc với nó.
 */
export function kyTuyChon(tu: Date, den: Date): Ky {
  if (den < tu) throw new Error('Khoảng thời gian không hợp lệ: ngày cuối trước ngày đầu.');
  return {
    loai: 'TUY_CHON',
    nam: tu.getFullYear(),
    tu: new Date(tu.getFullYear(), tu.getMonth(), tu.getDate()),
    den: cuoiNgay(den),
    nhan: `${dinhDang(tu)} – ${dinhDang(den)}`,
  };
}

function dinhDang(d: Date): string {
  const hai = (n: number) => String(n).padStart(2, '0');
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;
}
