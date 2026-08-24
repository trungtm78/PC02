/**
 * Chốt chặn lớp lỗi "màn hình trắng câm lặng" (bản chạy thật, 2026-08-24).
 *
 * HIỆN TƯỢNG: cán bộ đăng nhập, bấm "Danh sách đơn thư" → vùng nội dung TRẮNG HOÀN TOÀN.
 * Không tiêu đề, không bộ lọc, không bảng, không thông báo lỗi. Thanh bên và tiêu đề
 * trang vẫn nguyên, nên trông như hệ thống vẫn sống — chỉ là không có gì để làm.
 *
 * NGUYÊN NHÂN CẤU TRÚC (hai điểm mù, có mặt ở CẢ 24 tính năng):
 *   1. Mỗi tính năng bọc trang bằng `<Suspense fallback={null}>`. Đây là ranh giới gần
 *      nhất với trang tải-động nên nó THẮNG lớp `<Suspense fallback={<LoadingFallback/>}>`
 *      của MainLayout. Gói JS treo → dựng đúng con số không.
 *   2. Toàn ứng dụng KHÔNG có ErrorBoundary nào. Gói tải-động bị từ chối (chuyện thường
 *      sau mỗi lần deploy, khi người dùng còn giữ tab cũ trỏ tới tên gói đã đổi) thì React
 *      gỡ nguyên gốc → trắng cả màn hình, không một dấu vết để chẩn đoán.
 *
 * BẤT BIẾN mà bộ ca kiểm này bảo vệ: dù trang đang tải hay tải hỏng, người dùng luôn
 * THẤY CHỮ. Màn hình trắng không lời giải thích là hỏng, kể cả khi không có ngoại lệ nào
 * được ném ra.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { wrapRoute } from '../wrapRoute';

describe('wrapRoute — không bao giờ để lại khoảng trắng câm lặng', () => {
  beforeEach(() => {
    // Gói tải-động hỏng sẽ ghi lỗi ra bảng điều khiển; đó là hành vi ĐÚNG (giữ dấu vết
    // để chẩn đoán), nhưng làm nhiễu kết quả chạy kiểm nên tạm câm ở đây.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trang đang tải → hiện dấu hiệu đang tải, KHÔNG phải khoảng trắng', () => {
    // Lời hứa không bao giờ hoàn tất = gói JS treo, đúng kịch bản đã gặp.
    const NeverResolves = lazy(() => new Promise<never>(() => {}));
    const { container } = render(wrapRoute(<NeverResolves />));

    expect(container.textContent?.trim()).not.toBe('');
    expect(screen.getByText(/đang tải/i)).toBeTruthy();
  });

  it('gói tải-động HỎNG → hiện thông báo đọc được + nút tải lại, KHÔNG phải trắng', async () => {
    const Fails = lazy(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    );
    const { container } = render(wrapRoute(<Fails />));

    // Thông báo phải nói ĐÚNG nguyên nhân thường gặp: bản mới đã lên, tab cũ trỏ gói cũ.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/tải lại|phiên bản mới/i);
    expect(container.textContent?.trim()).not.toBe('');

    // Phải có đường đi tiếp, không được là ngõ cụt.
    expect(screen.getByRole('button', { name: /tải lại/i })).toBeTruthy();
  });

  it('trang ném lỗi lúc dựng → hiện thông báo, KHÔNG gỡ trắng cả màn hình', async () => {
    const Boom = () => {
      throw new Error('vỡ khi dựng');
    };
    const { container } = render(wrapRoute(<Boom />));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toBeTruthy();
    expect(container.textContent?.trim()).not.toBe('');
  });

  it('trang bình thường → dựng đúng nội dung, không chen thêm gì', async () => {
    const Ok = () => <h1>Danh sách đơn thư</h1>;
    render(wrapRoute(<Ok />));

    expect(await screen.findByText('Danh sách đơn thư')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
