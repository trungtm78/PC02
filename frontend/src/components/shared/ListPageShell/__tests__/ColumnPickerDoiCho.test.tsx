import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnPicker } from '../ColumnPicker';
import type { ColumnDef } from '../Table';

type Row = { id: string };
const COT: ColumnDef<Row>[] = [
  { key: 'a', header: 'Cột A', optional: 'show', render: () => null },
  { key: 'b', header: 'Cột B', optional: 'show', render: () => null },
  { key: 'c', header: 'Cột C', optional: 'hide', render: () => null },
];

function mo(props: Record<string, unknown> = {}) {
  const onToggle = vi.fn();
  const onReset = vi.fn();
  render(
    <ColumnPicker
      columns={COT}
      isVisible={(k) => k !== 'c'}
      onToggle={onToggle}
      onReset={onReset}
      {...props}
    />,
  );
  fireEvent.click(screen.getByTestId('btn-column-picker'));
  return { onToggle, onReset };
}

/**
 * Đổi thứ tự đặt trong MENU CHỌN CỘT, không kéo tiêu đề trên bảng.
 *
 * Bảng cuộn ngang, và tay nắm kéo giãn đã nằm ở mép phải mỗi ô tiêu đề — kéo tiêu đề sang trái
 * phải sẽ đánh nhau với cả hai. Menu cũng là chỗ DUY NHẤT thấy được cột đang ẩn.
 */
describe('ColumnPicker — đổi thứ tự cột', () => {
  it('không truyền `onDoiCho` thì không có nút dời — menu cũ y nguyên', () => {
    mo();
    expect(screen.queryByTestId('doi-cho-len-a')).not.toBeInTheDocument();
  });

  it('truyền `onDoiCho` thì mỗi cột có nút dời lên / dời xuống', () => {
    mo({ onDoiCho: vi.fn() });
    expect(screen.getByTestId('doi-cho-len-b')).toBeInTheDocument();
    expect(screen.getByTestId('doi-cho-xuong-a')).toBeInTheDocument();
  });

  it('dời lên gửi vị trí nhỏ hơn một bậc', () => {
    const doiCho = vi.fn();
    mo({ onDoiCho: doiCho });
    fireEvent.click(screen.getByTestId('doi-cho-len-b'));
    expect(doiCho).toHaveBeenCalledWith('b', 0);
  });

  it('dời xuống gửi vị trí lớn hơn một bậc', () => {
    const doiCho = vi.fn();
    mo({ onDoiCho: doiCho });
    fireEvent.click(screen.getByTestId('doi-cho-xuong-a'));
    expect(doiCho).toHaveBeenCalledWith('a', 1);
  });

  /** Cột đầu không dời lên được, cột cuối không dời xuống được — nút phải tắt, không im lặng. */
  it('cột đầu tắt nút dời lên, cột cuối tắt nút dời xuống', () => {
    mo({ onDoiCho: vi.fn() });
    expect(screen.getByTestId('doi-cho-len-a')).toBeDisabled();
    expect(screen.getByTestId('doi-cho-xuong-c')).toBeDisabled();
  });

  /**
   * Nút dời nằm trong cùng một `<label>` với ô tích. Không chặn lan thì mỗi lần dời cột là
   * một lần bật/tắt cột ấy — người dùng bấm "dời lên" và cột biến mất.
   */
  it('bấm nút dời KHÔNG bật/tắt cột', () => {
    const onToggle = vi.fn();
    mo({ onDoiCho: vi.fn(), onToggle });
    fireEvent.click(screen.getByTestId('doi-cho-len-b'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('nút dời có nhãn đọc được', () => {
    mo({ onDoiCho: vi.fn() });
    expect(screen.getByTestId('doi-cho-len-b').getAttribute('aria-label')).toContain('Cột B');
  });

  /** Nút "Về mặc định" phải xoá cả ba loại tuỳ chỉnh, không chỉ ẩn/hiện. */
  it('vẫn còn nút Về mặc định', () => {
    const onReset = vi.fn();
    mo({ onDoiCho: vi.fn(), onReset });
    fireEvent.click(screen.getByTestId('btn-column-reset'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
