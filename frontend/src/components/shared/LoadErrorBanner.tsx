import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Khối báo "không tải được danh sách" — dùng cho các trang danh sách TỰ DỰNG (không đi qua
 * `ListPageShell`, vốn đã có trạng thái `error` riêng).
 *
 * ── Vì sao có ──
 *
 * Đo trên máy thật 29/08/2026: chặn mọi `GET /api/v1/**` rồi so với lần tải bình thường trên
 * 54 màn. 26 màn KHÔNG báo lỗi gì, và 14 trong số đó hiện những con số 0. Nặng nhất:
 *
 *     /ward/incidents           133.874 ký tự  →  324   (không báo lỗi, 5 số 0)
 *     /ward/petitions            41.435 ký tự  →  392   (không báo lỗi, 5 số 0)
 *     /classification/duplicates 40.686 ký tự  →  321   (không báo lỗi, 7 số 0)
 *
 * Cán bộ nhìn thấy một trang phường/xã sạch bong với vài số 0 — giống hệt màn hình của một đơn
 * vị chưa có hồ sơ nào. Màn hình trắng làm người ta nghi ngờ; ba con số không thì ĐỌC NHƯ MỘT
 * CÂU TRẢ LỜI, và đó là một kết luận nghiệp vụ sai dựng trên một sự cố kỹ thuật.
 *
 * Dùng kèm `soLieuHienThi` (ở `lib/soLieuHienThi.ts`) cho các thẻ thống kê: khối này nói ra
 * chuyện đã xảy ra, còn hàm kia giữ cho các con số không tự nhận là câu trả lời.
 */
interface Props {
  /** Lý do máy chủ đưa ra. Rỗng/không có thì không hiện gì. */
  error?: string;
  /** Hỏi lại máy chủ. Không truyền thì ẩn nút. */
  onRetry?: () => void;
  /** Đang tải lại — khoá nút để không dồn yêu cầu. */
  loading?: boolean;
  /** Tên thứ đang tải, để câu chữ nói đúng việc: "danh sách đơn thư", "biểu đồ"… */
  what?: string;
  "data-testid"?: string;
}

export function LoadErrorBanner({
  error,
  onRetry,
  loading = false,
  what = "dữ liệu",
  "data-testid": testId = "load-error",
}: Props) {
  if (!error) return null;
  return (
    <div
      data-testid={testId}
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
      <div className="flex-1 text-sm text-red-800">
        <p className="font-medium">Không tải được {what}.</p>
        <p className="mt-0.5">{error}</p>
        <p className="mt-1 text-red-700">
          Số liệu bên dưới đang để trống vì chưa hỏi được máy chủ — đây không phải là “không có
          dữ liệu”.
        </p>
      </div>
      {onRetry && (
        <button
          data-testid={`${testId}-retry`}
          onClick={onRetry}
          disabled={loading}
          className="flex-shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          <RotateCcw className="mr-1 inline h-4 w-4" />
          Thử lại
        </button>
      )}
    </div>
  );
}

export default LoadErrorBanner;
