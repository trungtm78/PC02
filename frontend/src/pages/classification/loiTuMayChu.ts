/**
 * Bóc lý do máy chủ từ chối, theo đúng bao bì lỗi của kho: `{ success, error: { code, message } }`.
 *
 * Không có thân phản hồi nghĩa là yêu cầu chưa tới được máy chủ (mất mạng, quá hạn chờ, máy chủ
 * ngã). Lúc ấy KHÔNG dựng lại thông báo kỹ thuật tiếng Anh của trình duyệt cho cán bộ đọc — nói
 * bằng thứ họ làm được gì với nó.
 *
 * ── Vì sao câu dự phòng do NƠI GỌI đưa ──
 *
 * Bản đầu chôn cứng câu "Không lưu được kiến nghị…" vào đây. Khi hàm được dùng lại cho đường
 * TẢI danh sách, mất mạng cho ra một màn hình tự mâu thuẫn: tiêu đề nói "Không tải được danh
 * sách", còn dòng lý do ngay dưới nói "Không lưu được" — sai đúng ở ca mà bản vá sinh ra để làm
 * rõ. Máy chủ im lặng thì chỉ nơi gọi mới biết thao tác đang làm là gì.
 *
 * Để ở tệp riêng chứ không nằm trong trang: `react-refresh/only-export-components` cấm tệp
 * `.tsx` xuất ra thứ không phải component, và cổng lint của kho coi đó là LỖI, không phải cảnh
 * báo. Đây cũng là chỗ đúng của nó — một hàm thuần, không dính React, dùng lại được.
 */

/** Dùng khi nơi gọi không nói rõ đang làm thao tác gì. Nên truyền câu cụ thể hơn. */
export const DU_PHONG_CHUNG = 'Máy chủ không phản hồi. Kiểm tra kết nối mạng rồi thử lại.';

export function loiTuMayChu(e: unknown, duPhong: string = DU_PHONG_CHUNG): string {
  const than = (
    e as { response?: { data?: { error?: { message?: string }; message?: string } } }
  )?.response?.data;
  return than?.error?.message ?? than?.message ?? duPhong;
}
