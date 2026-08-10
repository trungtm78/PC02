/**
 * E3. Nine child models had `deletedAt` and no way back. A soft delete you
 * cannot undo is soft in name only — the record leaves every screen and the
 * only recovery was `UPDATE ... SET deleted_at = NULL` in psql.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '@/lib/api';
import { OtherRestorePanel } from '../OtherRestorePanel';

const TARGETS = [
  { resource: 'subjects', label: 'Đối tượng liên quan' },
  { resource: 'lawyers', label: 'Luật sư' },
];

const ROW = { id: 's-1', fullName: 'Nguyễn Văn C', deletedAt: '2026-08-09T02:00:00.000Z' };

function mockApi(rows: unknown[] = [ROW]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/admin/restore') return Promise.resolve({ data: { data: TARGETS } });
    return Promise.resolve({ data: { data: { data: rows, total: rows.length } } });
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe('OtherRestorePanel', () => {
  it('offers the record types the server says are restorable', async () => {
    // Hard-coding the list in the UI is how it drifts from the registry that
    // actually decides what can be restored.
    render(<OtherRestorePanel />);

    const select = await screen.findByTestId('restore-resource');
    expect(within(select).getByText('Đối tượng liên quan')).toBeInTheDocument();
    expect(within(select).getByText('Luật sư')).toBeInTheDocument();
  });

  it('lists deleted records with when they were deleted', async () => {
    render(<OtherRestorePanel />);

    expect(await screen.findByTestId('restore-row-s-1')).toHaveTextContent('Nguyễn Văn C');
  });

  it('posts the restore with a reason', async () => {
    render(<OtherRestorePanel />);
    fireEvent.click(await screen.findByTestId('restore-btn-s-1'));
    fireEvent.change(screen.getByTestId('restore-reason'), {
      target: { value: 'Xoá nhầm khi dọn hồ sơ trùng.' },
    });
    fireEvent.click(screen.getByTestId('restore-confirm'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/restore/subjects/s-1/restore', {
        reason: 'Xoá nhầm khi dọn hồ sơ trùng.',
      }),
    );
  });

  it('will not restore without a reason', async () => {
    // Restoring reverses somebody else's decision; the log entry is only worth
    // having if it says why.
    render(<OtherRestorePanel />);
    fireEvent.click(await screen.findByTestId('restore-btn-s-1'));

    expect(screen.getByTestId('restore-confirm')).toBeDisabled();
  });

  it('keeps the dialog open and shows the error when the restore fails', async () => {
    // Closing on failure tells the user the record is back when it is not.
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 404, data: { error: { message: 'Ngoài phạm vi dữ liệu', details: [] } } },
      }),
    );
    render(<OtherRestorePanel />);
    fireEvent.click(await screen.findByTestId('restore-btn-s-1'));
    fireEvent.change(screen.getByTestId('restore-reason'), {
      target: { value: 'Xoá nhầm khi dọn hồ sơ trùng.' },
    });
    fireEvent.click(screen.getByTestId('restore-confirm'));

    expect(await screen.findByTestId('restore-modal-error')).toHaveTextContent('Ngoài phạm vi');
    expect(screen.getByTestId('restore-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('restore-banner')).not.toBeInTheDocument();
  });

  it('shows an empty state rather than a bare table', async () => {
    mockApi([]);
    render(<OtherRestorePanel />);

    expect(await screen.findByTestId('restore-empty')).toBeInTheDocument();
  });
});
