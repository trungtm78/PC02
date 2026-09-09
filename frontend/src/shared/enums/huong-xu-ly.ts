import { HuongXuLyDon } from './generated';

/**
 * Ba hướng xử lý đơn thư — nhãn và mô tả cho form.
 *
 * Nhãn ở đây phải khớp chữ anh dùng khi giao việc; đừng đổi cho "gọn". "Trả đơn/Lưu đơn" là MỘT
 * lựa chọn theo quyết định nghiệp vụ 09/09/2026, dù hệ thống có hai trạng thái riêng.
 */
export const HUONG_XU_LY_LABEL: Record<HuongXuLyDon, string> = {
  [HuongXuLyDon.GIAO_DON]: 'Giao đơn',
  [HuongXuLyDon.CHUYEN_DON]: 'Chuyển đơn',
  [HuongXuLyDon.TRA_LUU_DON]: 'Trả đơn/Lưu đơn',
};

export const HUONG_XU_LY_OPTIONS = (
  Object.keys(HUONG_XU_LY_LABEL) as HuongXuLyDon[]
).map((value) => ({ value, label: HUONG_XU_LY_LABEL[value] }));

/**
 * Hướng nào chọn TỔ NỘI BỘ (khác với chọn đơn vị ngoài trong danh mục).
 *
 * Chưa chọn hướng thì coi là nội bộ — giữ đúng hành vi cũ của ô tích "Thuộc thẩm quyền" vốn mặc
 * định bật, để hồ sơ đang mở dở không nhảy sang nguồn khác.
 */
export function laHuongNoiBo(huong: HuongXuLyDon | '' | undefined): boolean {
  return huong !== HuongXuLyDon.CHUYEN_DON;
}

export function moTaHuong(huong: HuongXuLyDon | '' | undefined): string {
  switch (huong) {
    case HuongXuLyDon.GIAO_DON:
      return 'Giao Tổ/Nhóm nội bộ tiếp nhận, kiểm tra, xác minh. Hồ sơ chuyển sang "Đang xử lý".';
    case HuongXuLyDon.CHUYEN_DON:
      return 'Chuyển đơn vị ngoài giải quyết theo thẩm quyền. Hồ sơ chuyển sang "Đã chuyển đơn vị".';
    case HuongXuLyDon.TRA_LUU_DON:
      return 'Trả đơn cho người gửi hoặc lưu đơn. Hồ sơ chuyển sang "Đã trả đơn".';
    default:
      return 'Chưa chọn hướng: bản in ghép câu "Đề xuất" theo mẫu Giao đơn như trước đây.';
  }
}
