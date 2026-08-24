/**
 * Vỏ bọc dùng chung cho MỌI trang tải-động của mọi tính năng.
 *
 * VÌ SAO TỒN TẠI: trước đây mỗi tính năng tự khai một hàm `wrap` giống hệt nhau —
 * `<Suspense fallback={null}>{node}</Suspense>` — chép ở CẢ 24 tệp `features/*\/routes.tsx`.
 * Hai hệ quả đo được trên bản chạy thật (2026-08-24):
 *
 *   1. `fallback={null}` là ranh giới GẦN NHẤT với trang tải-động, nên nó THẮNG lớp
 *      `<Suspense fallback={<LoadingFallback/>}>` của MainLayout. Khi gói JS của trang
 *      treo hoặc không về, `<main>` dựng đúng con số không: cán bộ thấy thanh bên, thấy
 *      tiêu đề hệ thống, và một vùng nội dung TRẮNG không lời giải thích.
 *   2. Ứng dụng không có ErrorBoundary nào, nên một gói tải-động bị từ chối — chuyện
 *      thường gặp sau mỗi lần deploy, khi người dùng còn giữ tab cũ trỏ tới tên gói đã
 *      đổi — sẽ gỡ nguyên gốc React và làm trắng TOÀN BỘ màn hình.
 *
 * Gom về một chỗ để lần vá này áp cho cả 24 tính năng, và tính năng thứ 25 tự có.
 *
 * NGUYÊN TẮC: không bao giờ để lại khoảng trắng câm lặng. Đang tải thì nói đang tải;
 * hỏng thì nói hỏng, nói vì sao, và luôn chừa một đường đi tiếp.
 */
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';

export function RouteLoading(): ReactElement {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Đang tải...</p>
      </div>
    </div>
  );
}

/**
 * Lỗi tải gói tải-động khác hẳn lỗi nghiệp vụ: nó gần như luôn có nghĩa là bản mới đã
 * lên máy chủ trong lúc tab này còn mở, nên tên tệp gói đã đổi. Tải lại trang là cách
 * xử lý đúng, và cán bộ cần được nói thẳng điều đó thay vì đoán.
 */
function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(
    msg,
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Giữ nguyên dấu vết ở bảng điều khiển. Nuốt lỗi ở đây là tái lập đúng điểm mù
    // mà lớp bọc này sinh ra để xoá.
    console.error('[RouteErrorBoundary] trang lỗi khi dựng:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkFailed = isChunkLoadError(error);

    return (
      <div className="flex items-center justify-center h-full p-8">
        <div
          role="alert"
          className="max-w-lg w-full bg-red-50 border-l-4 border-red-500 rounded-r-lg p-5"
        >
          <h2 className="text-base font-semibold text-red-900 mb-2">
            {chunkFailed ? 'Đã có phiên bản mới' : 'Không mở được trang này'}
          </h2>
          <p className="text-sm text-red-800 mb-4">
            {chunkFailed
              ? 'Hệ thống vừa được cập nhật trong lúc trang này đang mở. Vui lòng tải lại trang để dùng bản mới nhất.'
              : 'Trang gặp lỗi khi hiển thị. Vui lòng tải lại trang. Nếu vẫn lỗi, báo quản trị hệ thống kèm mã lỗi bên dưới.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
          >
            Tải lại trang
          </button>
          {!chunkFailed && (
            // Mã lỗi để cán bộ đọc qua điện thoại cho quản trị — không cần chụp màn hình.
            <p className="mt-3 text-xs text-red-700 font-mono break-all">
              {error.name}: {error.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
