/**
 * Đặt câu cho một phép so sánh kỳ.
 *
 * ── Vì sao là hàm thuần, tách khỏi thành phần giao diện ──
 *
 * Câu chữ ở đây là chỗ dễ nói sai nhất mà lại không màn nào bắt được: "giảm -23%" (thừa dấu),
 * "tăng 0%" khi nền bằng 0, "tăng 100%" khi nền có đúng một hồ sơ. Tách ra để ca kiểm gọi
 * thẳng, không phải dựng cả trang lên mới đọc được một dòng chữ.
 *
 * ── Cách ngành viết ──
 *
 * Báo cáo Công an viết "giảm 23,16% số vụ so với cùng kỳ năm 2024" — chữ tăng/giảm, KHÔNG dấu
 * cộng/trừ, và số thập phân dùng DẤU PHẨY. Theo đúng lối ấy.
 */

/** Khớp với `KetQuaSoSanh` của máy chủ. */
export interface KetQuaSoSanh {
  hienTai: number;
  nen: number | null;
  chenhLech: number | null;
  tyLe: number | null;
  lyDoKhongCoTyLe: 'NEN_BANG_KHONG' | 'NEN_QUA_NHO' | 'KHONG_CO_NEN' | null;
  doTinCay: 'DU' | 'DAO_DONG' | 'KHONG_DU';
  chieu: 'TANG' | 'GIAM' | 'KHONG_DOI';
  tot: boolean | null;
}

export interface KhoiSoSanh {
  kieu: 'CUNG_KY_NAM_TRUOC' | 'KY_LIEN_TRUOC' | 'KHONG';
  ky: { tu: string; den: string; nhan: string };
  nen: { tu: string; den: string; nhan: string } | null;
  kyChuaTron: boolean;
  soNgayDaTroi: number | null;
  chiTieu: Record<string, KetQuaSoSanh>;
}

/** Số thập phân theo lối Việt: dấu phẩy, tối đa 2 chữ số, không đuôi 0 thừa. */
export function soThapPhanVN(n: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n);
}

export interface CauSoSanh {
  /** Chữ ngắn trên huy hiệu. Rỗng nghĩa là KHÔNG hiện huy hiệu. */
  nhan: string;
  /** Câu đầy đủ cho tooltip — luôn nói rõ so với kỳ nào. */
  giaiThich: string;
  /** `true` tốt, `false` xấu, `null` trung tính hoặc không phán được. */
  tot: boolean | null;
  /** Tỷ lệ dựa trên nền nhỏ — phải hiện nhạt hơn và nói ra. */
  daoDong: boolean;
}

/**
 * Dựng câu cho một chỉ tiêu.
 *
 * Trả `nhan: ''` khi không có gì trung thực để nói — thà thiếu một huy hiệu còn hơn để nó
 * khẳng định một điều không tính được.
 */
export function cauSoSanh(k: KetQuaSoSanh | undefined, nenNhan: string | undefined): CauSoSanh {
  const trong: CauSoSanh = { nhan: '', giaiThich: '', tot: null, daoDong: false };
  if (!k) return trong;

  const soVoi = nenNhan ? ` so với ${nenNhan}` : '';

  if (k.lyDoKhongCoTyLe === 'KHONG_CO_NEN') return trong;

  if (k.chieu === 'KHONG_DOI') {
    return {
      nhan: 'không đổi',
      giaiThich: `Không đổi${soVoi}.`,
      tot: null,
      daoDong: false,
    };
  }

  const tu = k.chieu === 'TANG' ? 'tăng' : 'giảm';
  const doLon = Math.abs(k.chenhLech ?? 0);

  if (k.lyDoKhongCoTyLe === 'NEN_BANG_KHONG') {
    return {
      nhan: `mới phát sinh ${soThapPhanVN(doLon)}`,
      giaiThich: `${nenNhan ?? 'Kỳ nền'} không có hồ sơ nào, nên không tính được tỷ lệ phần trăm. Chênh lệch tuyệt đối: ${tu} ${soThapPhanVN(doLon)}.`,
      tot: k.tot,
      daoDong: false,
    };
  }

  if (k.lyDoKhongCoTyLe === 'NEN_QUA_NHO') {
    return {
      nhan: `${tu} ${soThapPhanVN(doLon)}`,
      giaiThich: `${tu.charAt(0).toUpperCase() + tu.slice(1)} ${soThapPhanVN(doLon)} hồ sơ${soVoi} (${soThapPhanVN(k.nen ?? 0)}). Kỳ nền quá ít hồ sơ nên tỷ lệ phần trăm sẽ đánh lừa — chỉ nêu số tuyệt đối.`,
      tot: k.tot,
      daoDong: true,
    };
  }

  const pt = soThapPhanVN(Math.abs(k.tyLe ?? 0));
  return {
    nhan: `${tu} ${pt}%`,
    giaiThich:
      `${tu.charAt(0).toUpperCase() + tu.slice(1)} ${pt}%${soVoi} — ${soThapPhanVN(k.nen ?? 0)} → ${soThapPhanVN(k.hienTai)} (${k.chieu === 'TANG' ? '+' : '−'}${soThapPhanVN(doLon)}).` +
      (k.doTinCay === 'DAO_DONG'
        ? ' Kỳ nền ít hồ sơ nên tỷ lệ này dao động mạnh, đọc kèm số tuyệt đối.'
        : ''),
    tot: k.tot,
    daoDong: k.doTinCay === 'DAO_DONG',
  };
}

/** Câu nhắc khi kỳ đang xem chưa đóng — phải nói ra, không được lặng lẽ so lệch. */
export function nhacKyChuaTron(khoi: KhoiSoSanh | undefined): string {
  if (!khoi?.kyChuaTron || !khoi.nen) return '';
  return `${khoi.ky.nhan} chưa kết thúc — đang so ${khoi.soNgayDaTroi} ngày đầu với ${khoi.nen.nhan}.`;
}
