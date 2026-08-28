import { RefreshCw } from 'lucide-react';

/**
 * Dải báo "đang chạy bản cũ" — KHÔNG phụ thuộc service worker.
 *
 * ── Vì sao cần thêm, dù đã có `PwaUpdatePrompt` ──
 *
 * `PwaUpdatePrompt` do service worker báo, nên nó im lặng ở CẢ HAI đường vào:
 *
 *   • `http://171.244.40.245` — HTTP trần không phải ngữ cảnh bảo mật, trình duyệt KHÔNG cho
 *     chạy service worker (`navigator.serviceWorker` không tồn tại). Hộp báo không bao giờ
 *     hiện được, đúng theo thiết kế của trình duyệt.
 *   • `https://new.pc02hcm.com` — CDN ghim bản `sw.js` cũ ở biên, trình duyệt hỏi bản mới thì
 *     biên trả lại đúng bản cũ nên không có gì để báo.
 *
 * Hai đường, hai lý do khác nhau, cùng một kết quả: cán bộ dùng bản của 5 ngày trước mà không
 * ai biết (28/08/2026).
 *
 * Dải này hỏi thẳng `/api/v1/health` — đường không bao giờ bị cache — nên nó báo được ở cả hai
 * đường vào, kể cả khi không có service worker nào.
 *
 * ── Vì sao KHÔNG tự tải lại ──
 *
 * Bản đầu tự gọi `location.reload()`. Nó gắn ở khung ứng dụng, bọc MỌI màn nhập liệu, và dự án
 * không có lớp chặn nào cho form dở dang — tự tải lại giữa lúc cán bộ đang gõ một hồ sơ là
 * cuốn mất công của họ. Đổi một lỗi im lặng lấy một lỗi ồn ào hơn thì không phải là chữa.
 */
export function BanCuPrompt({ onCapNhat }: { onCapNhat: () => void }) {
  return (
    <div
      data-testid="ban-cu-prompt"
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-30 bg-amber-600 text-white rounded-lg shadow-xl p-4 flex items-start gap-3"
    >
      <RefreshCw className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1">Đang dùng bản cũ</p>
        <p className="text-xs text-white/90 mb-3">
          Máy chủ đã có bản mới hơn. Lưu việc đang làm rồi bấm cập nhật.
        </p>
        <button
          type="button"
          onClick={onCapNhat}
          data-testid="btn-cap-nhat-ban-cu"
          className="px-3 py-1.5 text-sm font-medium bg-white text-amber-700 rounded hover:bg-white/90 transition-colors min-h-[36px]"
        >
          Cập nhật ngay
        </button>
      </div>
    </div>
  );
}
