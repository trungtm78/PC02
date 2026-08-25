import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryCell } from '../SummaryCell';

/**
 * Cột "Tóm tắt nội dung" là cột cán bộ đọc nhiều nhất ở hệ cũ, và là cột hệ mới đang
 * thiếu — dù dữ liệu có ở 99,99% đơn thư. Hệ cũ cắt ngắn kèm liên kết "Xem thêm".
 */
const DAI =
  'Tố giác bà Phạm Thị Thuỳ Oanh (Sinh năm: 1992; Địa chỉ: 93 Đặng Thuỳ Trâm, phường Bình Lợi Trung, TP. HCM) chiếm đoạt số tiền 769.325.000 đồng thông qua việc vay mượn và tạo các dây hụi ảo để thu tiền của bà Tâm sau đó chiếm đoạt, bỏ trốn khỏi nơi cư trú.';

describe('SummaryCell', () => {
  it('nội dung dài bị cắt và có nút "Xem thêm"', () => {
    render(<SummaryCell value={DAI} />);
    const nut = screen.getByRole('button', { name: /xem thêm/i });
    expect(nut).toBeInTheDocument();
    expect(screen.getByTestId('summary-text').textContent!.length).toBeLessThan(DAI.length);
  });

  it('bấm "Xem thêm" hiện đủ nội dung, và thu lại được', async () => {
    const user = userEvent.setup();
    render(<SummaryCell value={DAI} />);

    await user.click(screen.getByRole('button', { name: /xem thêm/i }));
    expect(screen.getByTestId('summary-text')).toHaveTextContent(DAI.slice(0, 60));
    expect(screen.getByTestId('summary-text').textContent).toBe(DAI);

    // Thu lại: cán bộ mở nhầm một dòng không nên phải tải lại trang mới đóng được.
    await user.click(screen.getByRole('button', { name: /thu gọn/i }));
    expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();
  });

  it('nội dung ngắn KHÔNG hiện nút — nút thừa làm rối bảng', () => {
    render(<SummaryCell value="Đơn tố giác ngắn." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-text')).toHaveTextContent('Đơn tố giác ngắn.');
  });

  it('ô trống hiện dấu gạch, không hiện nút', () => {
    render(<SummaryCell value={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-text')).toHaveTextContent('—');
  });

  it('cắt ở ranh giới TỪ, không cắt giữa chữ', () => {
    render(<SummaryCell value={DAI} />);
    const text = screen.getByTestId('summary-text').textContent!;
    // Bỏ dấu "…" rồi kiểm ký tự cuối không nằm giữa một từ.
    const thay = text.replace(/…$/, '');
    expect(DAI.startsWith(thay)).toBe(true);
    expect(DAI[thay.length]).toMatch(/\s|$/);
  });
});
