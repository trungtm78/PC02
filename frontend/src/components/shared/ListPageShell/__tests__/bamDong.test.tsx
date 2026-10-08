/**
 * Cú bấm vào dòng của <Table>: rào bôi chọn, Ctrl/⌘+bấm, nút giữa, bấm đúp, phần tử tương tác con.
 * Mỗi ca ứng với một cách người dùng thật làm hỏng việc chép chữ hoặc mở nhầm trang.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table, type ColumnDef } from '../Table';

interface Row {
  id: string;
  name: string;
}
const ROWS: Row[] = [
  { id: '1', name: 'Nguyễn Văn A' },
  { id: '2', name: 'Trần Thị B' },
];
const COLS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Tên', render: (r) => <span data-testid={`ten-${r.id}`}>{r.name}</span> },
  {
    key: 'act',
    header: 'Thao tác',
    render: (r) => (
      <button type="button" data-testid={`nut-${r.id}`}>
        xem
      </button>
    ),
  },
];

function dung(props: Partial<React.ComponentProps<typeof Table<Row>>>) {
  return render(
    <ListPageShell>
      <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} title="ds" totalCount={2} {...props} />
    </ListPageShell>,
  );
}

function boiChon(el: Element) {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.addRange(range);
}

describe('<Table> — cú bấm vào dòng', () => {
  let moTab: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    moTab = vi.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => {
    moTab.mockRestore();
    window.getSelection()?.removeAllRanges();
  });

  it('bấm thường → gọi onRowClick(row)', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick });
    fireEvent.click(screen.getByTestId('ten-1'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS[0]);
  });

  it('hàm cũ (row) => … vẫn chạy: tham số event là tuỳ chọn', () => {
    const cu = vi.fn((row: Row) => row.id);
    dung({ onRowClick: cu });
    fireEvent.click(screen.getByTestId('ten-2'));
    expect(cu).toHaveBeenCalledWith(ROWS[1], expect.anything());
  });

  it('ĐANG BÔI CHỮ trong dòng → KHÔNG chuyển trang (cho chép)', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick });
    boiChon(screen.getByTestId('ten-1'));
    fireEvent.click(screen.getByTestId('ten-1'));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('vùng bôi nằm ở DÒNG KHÁC → dòng này vẫn mở bình thường', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick });
    boiChon(screen.getByTestId('ten-1'));
    fireEvent.click(screen.getByTestId('ten-2'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toEqual(ROWS[1]);
  });

  it('vùng chọn chỉ toàn khoảng trắng không tính là đang chép', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick });
    const o = screen.getByTestId('ten-1');
    o.textContent = '   ';
    boiChon(o);
    fireEvent.click(o);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('bấm vào NÚT bên trong dòng → việc của nút, dòng không mở', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick });
    fireEvent.click(screen.getByTestId('nut-1'));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('Ctrl+bấm với rowHref → mở TAB MỚI, không điều hướng tại chỗ', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick, rowHref: (r) => `/x/${r.id}` });
    fireEvent.click(screen.getByTestId('ten-1'), { ctrlKey: true });
    expect(moTab).toHaveBeenCalledWith('/x/1', '_blank', 'noopener,noreferrer');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('⌘+bấm (Mac) cũng mở tab mới', () => {
    dung({ onRowClick: vi.fn(), rowHref: (r) => `/x/${r.id}` });
    fireEvent.click(screen.getByTestId('ten-2'), { metaKey: true });
    expect(moTab).toHaveBeenCalledWith('/x/2', '_blank', 'noopener,noreferrer');
  });

  it('nút giữa với rowHref → mở tab mới', () => {
    dung({ onRowClick: vi.fn(), rowHref: (r) => `/x/${r.id}` });
    fireEvent(
      screen.getByTestId('ten-1'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
    );
    expect(moTab).toHaveBeenCalledWith('/x/1', '_blank', 'noopener,noreferrer');
  });

  it('nút phải (auxclick button=2) KHÔNG mở tab', () => {
    dung({ onRowClick: vi.fn(), rowHref: (r) => `/x/${r.id}` });
    fireEvent(
      screen.getByTestId('ten-1'),
      new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }),
    );
    expect(moTab).not.toHaveBeenCalled();
  });

  it('Ctrl+bấm mà dòng KHÔNG có đích → rơi về hành vi bấm thường', () => {
    const onRowClick = vi.fn();
    dung({ onRowClick, rowHref: () => null });
    fireEvent.click(screen.getByTestId('ten-1'), { ctrlKey: true });
    expect(moTab).not.toHaveBeenCalled();
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('bấm đúp → onRowDoubleClick, và xoá vùng chọn từ trình duyệt tự bôi', () => {
    const onRowDoubleClick = vi.fn();
    const onRowClick = vi.fn();
    dung({ onRowDoubleClick });
    boiChon(screen.getByTestId('ten-1'));
    fireEvent.doubleClick(screen.getByTestId('ten-1'));
    expect(onRowDoubleClick).toHaveBeenCalledTimes(1);
    expect(window.getSelection()?.rangeCount).toBe(0);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('chỉ đặt cursor-pointer khi dòng CÓ hành động', () => {
    const { container, unmount } = dung({});
    expect(container.querySelector('tbody tr')?.className).not.toContain('cursor-pointer');
    unmount();
    const r2 = dung({ onRowClick: vi.fn() });
    expect(r2.container.querySelector('tbody tr')?.className).toContain('cursor-pointer');
    r2.unmount();
    const r3 = dung({ onRowDoubleClick: vi.fn() });
    expect(r3.container.querySelector('tbody tr')?.className).toContain('cursor-pointer');
  });

  it('không có onRowClick lẫn rowHref → bấm không làm gì (không lỗi)', () => {
    dung({});
    expect(() => fireEvent.click(screen.getByTestId('ten-1'))).not.toThrow();
    expect(moTab).not.toHaveBeenCalled();
  });
});
