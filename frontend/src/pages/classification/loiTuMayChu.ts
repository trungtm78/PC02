/**
 * Bóc lý do máy chủ từ chối, theo đúng bao bì lỗi của kho: `{ success, error: { code, message } }`.
 *
 * Không có thân phản hồi nghĩa là yêu cầu chưa tới được máy chủ (mất mạng, máy chủ ngã). Lúc ấy
 * KHÔNG dựng lại thông báo kỹ thuật tiếng Anh của trình duyệt cho cán bộ đọc — nói bằng thứ họ
 * làm được gì với nó.
 *
 * Để ở tệp riêng chứ không nằm trong trang: `react-refresh/only-export-components` cấm tệp
 * `.tsx` xuất ra thứ không phải component, và cổng lint của kho coi đó là LỖI, không phải cảnh
 * báo. Đây cũng là chỗ đúng của nó — một hàm thuần, không dính React, dùng lại được.
 */
export function loiTuMayChu(e: unknown): string {
  const than = (
    e as { response?: { data?: { error?: { message?: string }; message?: string } } }
  )?.response?.data;
  return (
    than?.error?.message ??
    than?.message ??
    'Không lưu được kiến nghị — máy chủ không phản hồi. Kiểm tra kết nối mạng rồi thử lại.'
  );
}
