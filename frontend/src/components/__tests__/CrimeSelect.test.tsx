import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrimeSelect } from '../CrimeSelect';
import type { CrimeOption } from '../crime-select-utils';

Element.prototype.scrollIntoView = vi.fn();

const CRIMES: CrimeOption[] = [
  { id: 'a', code: 'D123', name: 'Tội giết người', pc02Relevant: true, articleNo: 123 },
  { id: 'b', code: 'D173', name: 'Tội trộm cắp tài sản', pc02Relevant: true, articleNo: 173 },
  { id: 'c', code: 'D251', name: 'Tội mua bán trái phép chất ma túy', pc02Relevant: false, articleNo: 251 },
];

vi.mock('@/hooks/useCrimeOptions', () => ({
  useCrimeOptions: () => ({ data: CRIMES, isLoading: false }),
}));

function open() {
  fireEvent.click(screen.getByTestId('crime-select-trigger'));
}

describe('CrimeSelect', () => {
  it('mặc định mở dropdown chỉ hiện tội danh PC02', () => {
    render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
    open();
    expect(screen.getByTestId('crime-select-option-D123')).toBeTruthy();
    expect(screen.getByTestId('crime-select-option-D173')).toBeTruthy();
    expect(screen.queryByTestId('crime-select-option-D251')).toBeNull();
  });

  it('badge cho biết đang lọc PC02', () => {
    render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
    open();
    expect(screen.getByTestId('crime-select-filter-badge').textContent).toContain('PC02');
  });

  it('toggle "Hiện tất cả" hiện cả tội ngoài PC02', () => {
    render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
    open();
    fireEvent.click(screen.getByTestId('crime-select-toggle-all'));
    expect(screen.getByTestId('crime-select-option-D251')).toBeTruthy();
  });

  it('search tìm được tội ngoài PC02 mà không cần toggle', () => {
    render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
    open();
    fireEvent.change(screen.getByTestId('crime-select-search'), {
      target: { value: 'ma túy' },
    });
    expect(screen.getByTestId('crime-select-option-D251')).toBeTruthy();
  });

  it('chọn tội danh gọi onChange với id', () => {
    const onChange = vi.fn();
    render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
    open();
    fireEvent.click(screen.getByTestId('crime-select-option-D123'));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('hiển thị nhãn "Điều N · tên" khi đã chọn', () => {
    render(<CrimeSelect label="Tội danh" value="b" onChange={() => {}} />);
    expect(screen.getByTestId('crime-select-trigger').textContent).toContain(
      'Điều 173 · Tội trộm cắp tài sản',
    );
  });
});
