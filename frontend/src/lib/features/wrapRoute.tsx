/**
 * Vỏ bọc dùng chung cho MỌI trang tải-động của mọi tính năng.
 *
 * VÌ SAO TỒN TẠI: trước đây mỗi tính năng tự khai một hàm `wrap` giống hệt nhau —
 * `<Suspense fallback={null}>{node}</Suspense>` — chép ở CẢ 24 tệp routes.tsx của tính năng.
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
import { Suspense, type ReactElement } from 'react';
import { RouteErrorBoundary, RouteLoading } from './RouteBoundary';

/** Bọc một trang tải-động: có khung chờ nhìn thấy được VÀ có lưới an toàn khi lỗi. */
export function wrapRoute(node: ReactElement): ReactElement {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteLoading />}>{node}</Suspense>
    </RouteErrorBoundary>
  );
}
