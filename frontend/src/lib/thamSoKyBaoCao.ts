import type { KyDangChon, NenDangChon } from '@/components/shared/ChonKyBaoCao';

/**
 * Đổi lựa chọn kỳ trên màn thành tham số gửi máy chủ.
 *
 * Tách khỏi hai màn báo cáo vì cả hai gọi nó ở BA chỗ — nạp số liệu, xuất Excel, và đặt tên
 * tệp. Ba bản sao của cùng một phép đổi là ba bản sẽ lệch nhau, và lệch ở đây nghĩa là màn hình
 * hiện một kỳ còn tệp xuất ra là kỳ khác — đúng lỗi vừa sửa ở đợt trước.
 */
export function thamSoKy(
  ky: KyDangChon,
  donCon: 'THANG' | 'QUY',
): Record<string, string | number | undefined> {
  switch (ky.loai) {
    case 'NAM':
      return {};
    case 'LUY_KE':
      return { luyKeDenThang: ky.so };
    case 'TUY_CHON':
      // Thiếu một đầu thì KHÔNG gửi nửa khoảng: máy chủ sẽ coi như cả năm và trả một kỳ khác
      // hẳn thứ người dùng đang chọn dở.
      return ky.tu && ky.den ? { tu: ky.tu, den: ky.den } : {};
    default:
      return donCon === 'THANG' ? { month: ky.so } : { quarter: ky.so };
  }
}

/** Tên tệp Excel nói đúng kỳ đã xuất — người nhận tệp không có màn hình để đối chiếu. */
export function tenTepXuat(ky: KyDangChon, nam: number): string {
  switch (ky.loai) {
    case 'NAM':
      return `BaoCao_CaNam_${nam}.xlsx`;
    case 'LUY_KE':
      return `BaoCao_LuyKe${ky.so}Thang_${nam}.xlsx`;
    case 'TUY_CHON':
      return `BaoCao_${(ky.tu ?? '').replace(/-/g, '')}_${(ky.den ?? '').replace(/-/g, '')}.xlsx`;
    case 'QUY':
      return `BaoCao_Quy${['I', 'II', 'III', 'IV'][(ky.so ?? 1) - 1]}_${nam}.xlsx`;
    default:
      return `BaoCao_Thang${String(ky.so ?? 1).padStart(2, '0')}_${nam}.xlsx`;
  }
}

/**
 * Đổi lựa chọn nền so sánh thành tham số gửi máy chủ.
 *
 * Chốt duy nhất đáng nói: khi người dùng vừa chọn "khoảng tự chọn" mà CHƯA nhập đủ hai đầu, gửi
 * `soSanh=TUY_CHON` là bắt máy chủ ném lỗi — màn hình nháy sang trạng thái hỏng trong lúc người
 * ta còn đang gõ. Chưa đủ thì tạm KHÔNG SO: không có huy hiệu vẫn trung thực hơn một thông báo
 * lỗi do chính màn hình gây ra.
 */
export function thamSoNen(nen: NenDangChon): Record<string, string | undefined> {
  if (nen.kieu !== 'TUY_CHON') return { soSanh: nen.kieu };
  if (!nen.nenTu || !nen.nenDen) return { soSanh: 'KHONG' };
  return { soSanh: 'TUY_CHON', nenTu: nen.nenTu, nenDen: nen.nenDen };
}
