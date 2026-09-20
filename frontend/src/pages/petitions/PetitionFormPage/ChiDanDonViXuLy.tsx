import { HuongXuLyDon } from "@/shared/enums/generated";
import { laHuongNoiBo } from "@/shared/enums/huong-xu-ly";

/**
 * Câu chỉ đường khi ô "Đơn vị xử lý" đang ở nguồn NỘI BỘ.
 *
 * Không hứa điều ô này không làm được: ở đây KHÔNG tạo mới được, nên câu chữ phải nói cán bộ
 * đi đâu chứ không gợi ý gõ thêm.
 */
export const CHI_DAN_NOI_BO =
  "Danh sách này chỉ có Tổ/Nhóm trong đơn vị. Giao cho đơn vị ngoài thì chọn Chuyển đơn.";

/**
 * Vì sao cần câu này: ô "Đơn vị xử lý" đổi hẳn NGUỒN theo Hướng xử lý, nhưng nhãn ô giống hệt
 * nhau ở cả ba hướng.
 *
 * · Giao đơn / Trả đơn-Lưu đơn → 26 Tổ/Nhóm nội bộ, **không tạo mới được**.
 * · Chuyển đơn → danh mục đơn vị (~1.433 mục), **có tạo mới**.
 *
 * Từ chỗ cán bộ ngồi thì hai ô ấy trông y hệt, nên "lúc tạo được lúc không" đọc ra như một lỗi
 * của hệ thống — đúng điều anh báo ngày 20/09/2026.
 *
 * Quyết định 20/09: KHÔNG cho tạo Tổ nội bộ từ form đơn thư. Tổ gắn với thành viên, quyền và
 * phạm vi dữ liệu; tạo từ đây sẽ đẻ ra tổ rỗng không ai thuộc về, và hồ sơ giao vào đó thì
 * không ai nhìn thấy. Thay vào đó nói rõ ranh giới và chỉ đường.
 */
export function ChiDanDonViXuLy({
  huong,
}: {
  huong: HuongXuLyDon | "" | undefined;
}) {
  if (!laHuongNoiBo(huong)) return null;
  return (
    <p className="mt-1 text-xs text-slate-500" data-testid="chi-dan-don-vi-xu-ly">
      {CHI_DAN_NOI_BO}
    </p>
  );
}
