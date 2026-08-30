import { Ky, cungKyNamTruoc, kyLienTruoc, kyChuaTron, soNgayDaTroi, catTheoTienDo } from './ky-bao-cao';
import { KetQuaSoSanh, soSanh } from './so-sanh';
import { chieuTotCua } from './chi-tieu';

/** Nền để so. Mặc định là cùng kỳ năm trước, theo quy ước báo cáo ngành. */
export type KieuSoSanh = 'CUNG_KY_NAM_TRUOC' | 'KY_LIEN_TRUOC' | 'KHONG';

export const KIEU_SO_SANH_MAC_DINH: KieuSoSanh = 'CUNG_KY_NAM_TRUOC';

export interface MoTaKy {
  tu: string;
  den: string;
  nhan: string;
}

export interface KhoiSoSanh {
  kieu: KieuSoSanh;
  /** Kỳ đang xem. */
  ky: MoTaKy;
  /** Kỳ được lấy làm nền. `null` khi kiểu là KHONG. */
  nen: MoTaKy | null;
  /**
   * Kỳ hiện tại chưa đóng — số liệu còn chạy tiếp. Khi đó `nen` đã được CẮT cho khớp số ngày
   * đã trôi, và `nhan` của nó nói rõ điều đó.
   */
  kyChuaTron: boolean;
  /** Số ngày đã trôi của kỳ hiện tại, chỉ có nghĩa khi `kyChuaTron`. */
  soNgayDaTroi: number | null;
  chiTieu: Record<string, KetQuaSoSanh>;
}

export type BoDem = Record<string, number>;

/**
 * Dựng khối so sánh cho một kỳ.
 *
 * Nhận vào một hàm ĐẾM để tầng này không biết gì về Prisma — nhờ vậy ca kiểm chạy được mà
 * không cần cơ sở dữ liệu, và mọi màn báo cáo khác dùng lại được y nguyên.
 */
export async function dungSoSanh(
  ky: Ky,
  demTrongKhoang: (tu: Date, den: Date) => Promise<BoDem>,
  soLieuHienTai: BoDem,
  kieu: KieuSoSanh = KIEU_SO_SANH_MAC_DINH,
  moc: Date = new Date(),
): Promise<KhoiSoSanh> {
  const khoa = Object.keys(soLieuHienTai);

  if (kieu === 'KHONG') {
    return {
      kieu,
      ky: moTa(ky),
      nen: null,
      kyChuaTron: kyChuaTron(ky, moc),
      soNgayDaTroi: null,
      chiTieu: Object.fromEntries(
        khoa.map((k) => [k, soSanh(soLieuHienTai[k], null, chieuTotCua(k))]),
      ),
    };
  }

  const chuaTron = kyChuaTron(ky, moc);
  const daTroi = chuaTron ? soNgayDaTroi(ky, moc) : null;

  // Kỳ nằm ở TƯƠNG LAI — chưa trôi ngày nào. Không có gì để so, và nói "không có nền" mới đúng.
  // Cắt kỳ nền còn 0 ngày là sai theo hai nghĩa: bộ lọc `gte`/`lte` vẫn đếm được bản ghi ở đúng
  // thời khắc đầu kỳ, và một chênh lệch dựng trên đó trông y hệt một con số thật.
  if (chuaTron && daTroi === 0) {
    return {
      kieu,
      ky: moTa(ky),
      nen: null,
      kyChuaTron: true,
      soNgayDaTroi: 0,
      chiTieu: Object.fromEntries(
        khoa.map((k) => [k, soSanh(soLieuHienTai[k], null, chieuTotCua(k))]),
      ),
    };
  }

  const nenDay = kieu === 'KY_LIEN_TRUOC' ? kyLienTruoc(ky) : cungKyNamTruoc(ky);
  // Kỳ chưa đóng thì cắt nền cho khớp tiến độ — nếu không, mọi chỉ tiêu đều "giảm" chỉ vì kỳ
  // này mới chạy được vài ngày.
  const nen = chuaTron ? catTheoTienDo(nenDay, daTroi!) : nenDay;

  const soLieuNen = await demTrongKhoang(nen.tu, nen.den);

  return {
    kieu,
    ky: moTa(ky),
    nen: moTa(nen),
    kyChuaTron: chuaTron,
    soNgayDaTroi: daTroi,
    chiTieu: Object.fromEntries(
      khoa.map((k) => [k, soSanh(soLieuHienTai[k], soLieuNen[k] ?? 0, chieuTotCua(k))]),
    ),
  };
}

function moTa(k: Ky): MoTaKy {
  return { tu: k.tu.toISOString(), den: k.den.toISOString(), nhan: k.nhan };
}
