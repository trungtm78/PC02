/**
 * D3. Before this, an officer learned a record was past its edit window by
 * pressing Save and being refused — after typing everything. The banner says so
 * first, and offers a way forward instead of a dead end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '@/lib/api';
import { EditWindowBanner } from '../EditWindowBanner';

const LOCKED = {
  locked: true,
  windowHours: 168,
  hoursElapsed: 400,
  hoursRemaining: 0,
  pendingRequest: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: LOCKED } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
});

describe('EditWindowBanner', () => {
  it('says nothing while the record is still editable', async () => {
    // A permanent strip reading "143 hours left" only teaches people to ignore
    // that part of the screen.
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { ...LOCKED, locked: false, hoursRemaining: 143 } },
    });
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByTestId('edit-window-banner')).not.toBeInTheDocument();
  });

  it('explains the lock once the window has passed', async () => {
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);

    expect(await screen.findByTestId('edit-window-banner')).toHaveTextContent('168 giờ');
  });

  it('sends the request with a reason', async () => {
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);
    fireEvent.click(await screen.findByTestId('edit-window-ask'));
    fireEvent.change(screen.getByTestId('edit-window-reason'), {
      target: { value: 'Bổ sung kết quả giám định vừa nhận được.' },
    });
    fireEvent.click(screen.getByTestId('edit-window-submit'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/edit-window/requests', {
        subjectType: 'Case',
        subjectId: 'c-1',
        reason: 'Bổ sung kết quả giám định vừa nhận được.',
      }),
    );
  });

  it('will not send without a reason', async () => {
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);
    fireEvent.click(await screen.findByTestId('edit-window-ask'));

    expect(screen.getByTestId('edit-window-submit')).toBeDisabled();
  });

  it('shows the pending state so nobody asks twice', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { ...LOCKED, pendingRequest: { id: 'r-1', createdAt: '2026-08-01' } } },
    });
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);

    expect(await screen.findByTestId('edit-window-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-window-ask')).not.toBeInTheDocument();
  });

  it('reports a failed send and stays open', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 400, data: { error: { message: 'Đã có 20 yêu cầu chờ duyệt', details: [] } } },
      }),
    );
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);
    fireEvent.click(await screen.findByTestId('edit-window-ask'));
    fireEvent.change(screen.getByTestId('edit-window-reason'), {
      target: { value: 'Bổ sung kết quả giám định vừa nhận được.' },
    });
    fireEvent.click(screen.getByTestId('edit-window-submit'));

    expect(await screen.findByTestId('edit-window-error')).toHaveTextContent('20 yêu cầu');
    expect(screen.getByTestId('edit-window-reason')).toBeInTheDocument();
  });

  it('stays silent when the status call fails', async () => {
    // The banner is secondary information. A failed side question must not put
    // a red strip at the top of a detail page.
    vi.mocked(api.get).mockRejectedValue(new Error('offline'));
    render(<EditWindowBanner subjectType="Case" subjectId="c-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByTestId('edit-window-banner')).not.toBeInTheDocument();
  });
});
