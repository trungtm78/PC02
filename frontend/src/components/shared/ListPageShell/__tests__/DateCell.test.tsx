import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateCell } from '../DateCell';

/**
 * Ô ngày của bảng danh sách (18/09/2026, PR-F). Bảng nay XUỐNG DÒNG; ngày thì phải MỘT DÒNG, chữ mono với số
 * `tnum` để các ngày thẳng cột (DESIGN §11). Bấm thử sau khi đổi font: "27/08/2026" bị bẻ thành "27/08/202 | 6".
 */
describe('DateCell', () => {
  it('ngày một dòng, chữ mono số thẳng hàng', () => {
    render(<DateCell value="2026-08-27T00:00:00+07:00" />);
    const o = screen.getByText('27/08/2026');
    expect(o.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(o.className).toMatch(/\bfont-mono\b/);
    expect(o.className).toMatch(/\btabular-nums\b/);
  });

  it('quá hạn → chữ đỏ đậm; chưa quá hạn → màu thường', () => {
    const { rerender } = render(<DateCell value="2026-08-27T00:00:00+07:00" quaHan />);
    expect(screen.getByText('27/08/2026').className).toMatch(/\btext-red-700\b/);
    rerender(<DateCell value="2026-08-27T00:00:00+07:00" quaHan={false} />);
    expect(screen.getByText('27/08/2026').className).not.toMatch(/\btext-red-700\b/);
  });

  it('chú giải (title) đi theo ô', () => {
    render(<DateCell value="2026-08-27T00:00:00+07:00" title="Ngày nhập vào hệ thống" />);
    expect(screen.getByText('27/08/2026')).toHaveAttribute('title', 'Ngày nhập vào hệ thống');
  });

  it('không có ngày → gạch; ngày phi lý vẫn một dòng và được đánh dấu', () => {
    const { container, rerender } = render(<DateCell value={null} />);
    expect(container.textContent).toBe('—');
    rerender(<DateCell value="3023-01-01T00:00:00+07:00" />);
    const o = screen.getByTitle(/Ngày không hợp lệ/);
    expect(o.className).toMatch(/\bwhitespace-nowrap\b/);
  });
});
