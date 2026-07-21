import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BulkActionBar } from '../BulkActionBar';
import type { BulkAction, BulkAdapter } from '../types';
import type { UseBulkSelectionResult } from '../useBulkSelection';

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ hasPermission: () => true }),
}));

function makeSelection(ids: string[], clear = vi.fn()): UseBulkSelectionResult {
  return {
    selectedIds: new Set(ids),
    mode: 'page',
    count: ids.length,
    pageState: 'some',
    isSelected: (id: string) => ids.includes(id),
    toggleOne: vi.fn(),
    togglePage: vi.fn(),
    selectAllMatchingFilter: vi.fn(),
    clear,
  };
}

function makeAdapter(action: BulkAction): BulkAdapter {
  return { resource: 'petitions', resourceLabel: 'đơn thư', actions: [action] };
}

const baseAction = (over: Partial<BulkAction>): BulkAction => ({
  key: 'act',
  label: 'Thao tác',
  variant: 'outline',
  permission: { resource: 'petitions', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: false,
  execute: vi.fn(),
  ...over,
});

beforeEach(() => vi.clearAllMocks());

/**
 * skipConfirm dành cho action tự mở UI riêng ngay sau đó (vd "Xuất Word" mở modal chọn mẫu):
 * bắt xác nhận rồi mới cho chọn mẫu là 2 hộp thoại liên tiếp vô nghĩa.
 *
 * Điều DỄ LÀM HỎNG: bỏ qua luôn handleExecute → mất selection.clear()/onSuccess/onError và
 * promise reject thành unhandled rejection. Bộ test này khoá đúng chỗ đó.
 */
describe('BulkActionBar — skipConfirm', () => {
  it('skipConfirm: bấm là chạy execute NGAY, KHÔNG hiện hộp xác nhận', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const action = baseAction({ label: 'Xuất Word', skipConfirm: true, execute });
    render(
      <BulkActionBar selection={makeSelection(['p1', 'p2'])} adapter={makeAdapter(action)} pageRows={[]} />,
    );
    fireEvent.click(screen.getByText('Xuất Word'));
    await waitFor(() => expect(execute).toHaveBeenCalledWith({ ids: ['p1', 'p2'], reason: undefined }));
    expect(screen.queryByText('Xác nhận')).toBeNull();
  });

  it('skipConfirm VẪN gọi onSuccess (không đi đường tắt bỏ qua handleExecute)', async () => {
    const onSuccess = vi.fn();
    const action = baseAction({ skipConfirm: true, execute: vi.fn().mockResolvedValue(undefined) });
    render(
      <BulkActionBar
        selection={makeSelection(['p1'])}
        adapter={makeAdapter(action)}
        pageRows={[]}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('[P2] skipConfirm KHÔNG xoá lựa chọn — action mới chỉ mở UI, chưa thao tác gì', async () => {
    // Xoá ở đây thì user bấm Hủy trong modal chọn mẫu sẽ mất sạch các dòng vừa tích.
    const clear = vi.fn();
    const action = baseAction({ skipConfirm: true, execute: vi.fn().mockResolvedValue(undefined) });
    render(
      <BulkActionBar selection={makeSelection(['p1'], clear)} adapter={makeAdapter(action)} pageRows={[]} />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    await waitFor(() => expect(action.execute).toHaveBeenCalled());
    expect(clear).not.toHaveBeenCalled();
  });

  it('action THƯỜNG vẫn xoá lựa chọn sau khi thực thi xong (hành vi cũ giữ nguyên)', async () => {
    const clear = vi.fn();
    const action = baseAction({ execute: vi.fn().mockResolvedValue(undefined) });
    render(
      <BulkActionBar selection={makeSelection(['p1'], clear)} adapter={makeAdapter(action)} pageRows={[]} />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    fireEvent.click(await screen.findByText('Xác nhận'));
    await waitFor(() => expect(clear).toHaveBeenCalled());
  });

  it('skipConfirm: execute reject → onError chạy, KHÔNG thành unhandled rejection', async () => {
    const onError = vi.fn();
    const boom = new Error('boom');
    const action = baseAction({ skipConfirm: true, execute: vi.fn().mockRejectedValue(boom) });
    render(
      <BulkActionBar
        selection={makeSelection(['p1'])}
        adapter={makeAdapter(action)}
        pageRows={[]}
        onError={onError}
      />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ key: 'act' })));
  });

  it('KHÔNG có skipConfirm → giữ nguyên hành vi cũ: hiện hộp xác nhận trước', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const action = baseAction({ execute });
    render(
      <BulkActionBar selection={makeSelection(['p1'])} adapter={makeAdapter(action)} pageRows={[]} />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    expect(await screen.findByText('Xác nhận')).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });

  it('ids truyền vào execute là bản CHỤP đầy đủ', async () => {
    let captured: string[] | null = null;
    const action = baseAction({
      skipConfirm: true,
      execute: vi.fn(async ({ ids }) => {
        captured = ids;
      }),
    });
    render(
      <BulkActionBar selection={makeSelection(['a', 'b', 'c'])} adapter={makeAdapter(action)} pageRows={[]} />,
    );
    fireEvent.click(screen.getByText('Thao tác'));
    await waitFor(() => expect(captured).toEqual(['a', 'b', 'c']));
  });
});
