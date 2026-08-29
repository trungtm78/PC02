import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadErrorBanner } from '../LoadErrorBanner';

/**
 * Khối báo tải hỏng — bất biến: KHÔNG có lỗi thì không hiện gì, CÓ lỗi thì phải nói ra lý do
 * và phải phân biệt được với "không có dữ liệu".
 */
describe('LoadErrorBanner', () => {
  it('không có lỗi thì không dựng gì — không chiếm chỗ trên trang bình thường', () => {
    const { container } = render(<LoadErrorBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('có lỗi thì nói ra lý do máy chủ đưa', () => {
    render(<LoadErrorBanner error="Máy chủ bận" />);
    expect(screen.getByTestId('load-error')).toHaveTextContent('Máy chủ bận');
  });

  /** Câu quan trọng nhất: nói rõ số liệu trống KHÔNG phải là "không có dữ liệu". */
  it('nói rõ số liệu trống không phải là không có dữ liệu', () => {
    render(<LoadErrorBanner error="x" />);
    expect(screen.getByTestId('load-error')).toHaveTextContent(/không phải là.*không có dữ liệu/i);
  });

  it('khai role=alert để trình đọc màn hình đọc ngay', () => {
    render(<LoadErrorBanner error="x" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('nói đúng thứ đang tải', () => {
    render(<LoadErrorBanner error="x" what="danh sách đơn thư" />);
    expect(screen.getByTestId('load-error')).toHaveTextContent('danh sách đơn thư');
  });

  it('bấm Thử lại thì gọi lại', () => {
    const lai = vi.fn();
    render(<LoadErrorBanner error="x" onRetry={lai} />);
    fireEvent.click(screen.getByTestId('load-error-retry'));
    expect(lai).toHaveBeenCalledTimes(1);
  });

  it('đang tải lại thì khoá nút để không dồn yêu cầu', () => {
    render(<LoadErrorBanner error="x" onRetry={vi.fn()} loading />);
    expect(screen.getByTestId('load-error-retry')).toBeDisabled();
  });

  it('không truyền onRetry thì ẩn nút', () => {
    render(<LoadErrorBanner error="x" />);
    expect(screen.queryByTestId('load-error-retry')).not.toBeInTheDocument();
  });
});
