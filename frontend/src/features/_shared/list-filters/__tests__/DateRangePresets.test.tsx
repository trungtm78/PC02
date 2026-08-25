import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePresets } from '../DateRangePresets';

/**
 * Chip đặt nhanh khoảng thời gian, nằm ngay dưới hai ô Từ ngày / Đến ngày trong CÙNG mặt
 * lọc — nó ghi vào đúng hai ô ấy.
 *
 * Trước đây là menu thả xuống: tốn hai lần bấm, và nút cao gấp đôi vì nhãn dài xuống dòng.
 * Năm nhãn ngắn nằm gọn một hàng, bấm một lần, thấy hết lựa chọn mà không phải mở.
 */
const HOM_NAY = new Date(2026, 7, 25); // thứ Ba, 25/08/2026

describe('DateRangePresets', () => {
  it('hiện đủ năm mốc, mỗi mốc là một nút bấm được', () => {
    render(<DateRangePresets onPick={vi.fn()} today={HOM_NAY} />);
    for (const nhan of ['Hôm nay', 'Tuần này', 'Tháng này', 'Quý này', 'Năm nay']) {
      expect(screen.getByRole('button', { name: nhan })).toBeInTheDocument();
    }
  });

  it('bấm một mốc trả về CẢ HAI mốc trong một lần gọi', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DateRangePresets onPick={onPick} today={HOM_NAY} />);

    await user.click(screen.getByRole('button', { name: 'Tháng này' }));

    // Gọi hai lần rời nhau thì ở component cha có kiểm soát, lần sau ghi đè lần trước và
    // một mốc biến mất mà không ai thấy.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({ fromDate: '2026-08-01', toDate: '2026-08-31' });
  });

  it('mốc "Tuần này" tính từ THỨ HAI — tuần làm việc Việt Nam', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<DateRangePresets onPick={onPick} today={HOM_NAY} />);

    await user.click(screen.getByRole('button', { name: 'Tuần này' }));

    expect(onPick).toHaveBeenCalledWith({ fromDate: '2026-08-24', toDate: '2026-08-30' });
  });

  it('có nhãn cho biết cụm nút này làm gì', () => {
    render(<DateRangePresets onPick={vi.fn()} today={HOM_NAY} />);
    expect(screen.getByText(/nhanh/i)).toBeInTheDocument();
  });
});
