import type { ChieuTot } from './so-sanh';

/**
 * Sổ đăng ký chỉ tiêu: mỗi chỉ tiêu khai CHIỀU TỐT của nó.
 *
 * ── Vì sao phải khai, không suy ra được ──
 *
 * Báo cáo ngành Công an đọc "giảm 23,16% số vụ ma túy" như một THÀNH TÍCH, còn "giảm số vụ đã
 * giải quyết" là điều ngược lại. Cùng một dấu trừ, hai nghĩa trái nhau. Không có quy tắc nào
 * rút được nghĩa ấy ra từ con số — nó là tri thức nghiệp vụ, phải viết ra.
 *
 * Bảng này cũng là chỗ duy nhất quyết định màu của huy hiệu. Tô xanh cho mọi dấu cộng là cách
 * nhanh nhất để một màn hình chúc mừng cán bộ vì số vụ quá hạn vừa tăng.
 *
 * ── Vì sao đơn thư/vụ việc/vụ án là TRUNG TÍNH ──
 *
 * Chúng đếm khối lượng việc ĐẾN, không đo kết quả làm việc. Đơn thư tăng có thể là dân tin
 * tưởng hơn nên gửi nhiều hơn; đơn thư giảm có thể là địa bàn yên, mà cũng có thể là người dân
 * ngại. Gán tốt/xấu cho chúng là nhét một phán xét vào chỗ chỉ nên có một con số.
 */
export const CHIEU_TOT_CHI_TIEU: Record<string, ChieuTot> = {
  /** Khối lượng việc đến — không phán tốt/xấu. */
  donThu: null,
  vuViec: null,
  vuAn: null,
  /** Tổng ba loại hồ sơ tiếp nhận — vẫn là khối lượng việc đến. */
  tongTiepNhan: null,
  /** Kết quả làm việc — càng nhiều càng tốt. */
  daGiaiQuyet: true,
  /** Tồn đọng — càng nhiều càng xấu. */
  quaHan: false,
  dangXuLy: null,
};

export function chieuTotCua(khoa: string): ChieuTot {
  return khoa in CHIEU_TOT_CHI_TIEU ? CHIEU_TOT_CHI_TIEU[khoa] : null;
}
