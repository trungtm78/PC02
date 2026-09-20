import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PartialDateInput } from '../PartialDateInput';

/**
 * Ô "Ngày viết đơn" cho nhập THIẾU thành phần.
 *
 * BA Ô PHÂN ĐOẠN trong một `fieldset`, KHÔNG phải một ô chữ có mặt nạ — theo NN/g và
 * uxpatterns.dev. Với yêu cầu của anh điều đó hợp hơn hẳn: ô mặt nạ làm "để trống ngày" thành
 * ca biên phải rà con trỏ, còn ba ô làm nó thành thao tác hạng nhất — bỏ trống ô ấy là xong.
 */
/**
 * Khung GIỮ TRẠNG THÁI: component được điều khiển, nên giá trị mới phải quay lại qua `value`.
 * Dựng bằng `value` cố định thì gõ ô thứ hai sẽ xoá mất ô thứ nhất — đó là lỗi của khung dựng,
 * không phải của component.
 */
function ve(props: Partial<React.ComponentProps<typeof PartialDateInput>> = {}) {
  const doi = vi.fn();
  function Khung() {
    const [v, setV] = useState<string | null>(props.value ?? null);
    return (
      <PartialDateInput
        label="Ngày viết đơn"
        testId="ngay"
        {...props}
        value={v}
        onChange={(x) => {
          doi(x);
          setV(x);
        }}
      />
    );
  }
  render(<Khung />);
  return { doi };
}

const o = (ten: 'ngay' | 'thang' | 'nam') => screen.getByTestId(`ngay-${ten}`) as HTMLInputElement;

describe('PartialDateInput', () => {
  it('có ba ô riêng, mỗi ô mang tên đọc được', () => {
    ve();
    expect(o('ngay')).toHaveAttribute('aria-label', expect.stringContaining('Ngày'));
    expect(o('thang')).toHaveAttribute('aria-label', expect.stringContaining('Tháng'));
    expect(o('nam')).toHaveAttribute('aria-label', expect.stringContaining('Năm'));
  });

  it('nhóm ba ô là một `fieldset` có tên chung', () => {
    ve();
    expect(screen.getByRole('group', { name: /Ngày viết đơn/ })).toBeInTheDocument();
  });

  it('gõ đủ ba ô → báo lên EDTF đầy đủ', () => {
    const { doi } = ve();
    fireEvent.change(o('ngay'), { target: { value: '15' } });
    fireEvent.change(o('thang'), { target: { value: '12' } });
    fireEvent.change(o('nam'), { target: { value: '2026' } });
    expect(doi).toHaveBeenLastCalledWith('2026-12-15');
  });

  it('BỎ TRỐNG ô ngày là thao tác hạng nhất → 2026-12-XX', () => {
    const { doi } = ve();
    fireEvent.change(o('thang'), { target: { value: '12' } });
    fireEvent.change(o('nam'), { target: { value: '2026' } });
    expect(doi).toHaveBeenLastCalledWith('2026-12-XX');
  });

  it('chỉ năm → 2026-XX-XX', () => {
    const { doi } = ve();
    fireEvent.change(o('nam'), { target: { value: '2026' } });
    expect(doi).toHaveBeenLastCalledWith('2026-XX-XX');
  });

  it('xoá hết → null, không gửi chuỗi rác', () => {
    const { doi } = ve({ value: '2026-12-15' });
    fireEvent.change(o('nam'), { target: { value: '' } });
    fireEvent.change(o('thang'), { target: { value: '' } });
    fireEvent.change(o('ngay'), { target: { value: '' } });
    expect(doi).toHaveBeenLastCalledWith(null);
  });

  it('hiện lại ĐÚNG giá trị đang có, không tự điền ngày', () => {
    ve({ value: '2026-12-XX' });
    expect(o('ngay').value).toBe('');
    expect(o('thang').value).toBe('12');
    expect(o('nam').value).toBe('2026');
  });

  it('gõ đủ số thì TỰ NHẢY sang ô kế', () => {
    ve();
    fireEvent.change(o('ngay'), { target: { value: '15' } });
    expect(document.activeElement).toBe(o('thang'));
  });

  it('Backspace ở ô RỖNG thì lùi về ô trước', () => {
    ve();
    o('thang').focus();
    fireEvent.keyDown(o('thang'), { key: 'Backspace' });
    expect(document.activeElement).toBe(o('ngay'));
  });

  it('mũi tên trái/phải đi lại giữa ba ô', () => {
    ve();
    o('ngay').focus();
    fireEvent.keyDown(o('ngay'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(o('thang'));
    fireEvent.keyDown(o('thang'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(o('ngay'));
  });

  it('chỉ nhận chữ SỐ — gõ chữ cái không vào được', () => {
    const { doi } = ve();
    fireEvent.change(o('nam'), { target: { value: 'abc' } });
    expect(o('nam').value).toBe('');
    expect(doi).not.toHaveBeenCalledWith(expect.stringContaining('abc'));
  });

  it('ngày RÁP LẠI không có thật thì báo lỗi ngay tại ô', () => {
    ve();
    fireEvent.change(o('ngay'), { target: { value: '31' } });
    fireEvent.change(o('thang'), { target: { value: '02' } });
    fireEvent.change(o('nam'), { target: { value: '2026' } });
    expect(screen.getByTestId('ngay-loi').textContent).toContain('không có thật');
  });

  it('dán nguyên chuỗi "15/12/2026" vào ô đầu → tách ra ba ô', () => {
    const { doi } = ve();
    fireEvent.paste(o('ngay'), {
      clipboardData: { getData: () => '15/12/2026' },
    });
    expect(doi).toHaveBeenLastCalledWith('2026-12-15');
  });
});
