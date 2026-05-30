import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  StatusTransitionModalProvider,
  useStatusTransitionModal,
} from '../StatusTransitionModalProvider';

const patchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

function Consumer({ currentStatus = 'DANG_XAC_MINH', onSuccessSpy = vi.fn() }: {
  currentStatus?: string;
  onSuccessSpy?: () => void;
}) {
  const m = useStatusTransitionModal();
  return (
    <button
      data-testid="open-transition"
      onClick={() =>
        m.open({
          recordId: 'I1',
          currentStatus,
          currentUpdatedAt: '2026-01-01T00:00:00Z',
          onSuccess: onSuccessSpy,
        })
      }
    >
      open
    </button>
  );
}

beforeEach(() => {
  patchMock.mockReset();
  patchMock.mockResolvedValue({ data: { success: true } });
});

describe('StatusTransitionModalProvider', () => {
  it('exposes useStatusTransitionModal().open which mounts modal', () => {
    render(
      <StatusTransitionModalProvider>
        <Consumer />
      </StatusTransitionModalProvider>,
    );
    expect(screen.queryByTestId('status-transition-modal')).not.toBeInTheDocument();
    act(() => screen.getByTestId('open-transition').click());
    expect(screen.getByTestId('status-transition-modal')).toBeInTheDocument();
  });

  it('renders only valid transitions for current status', () => {
    render(
      <StatusTransitionModalProvider>
        <Consumer currentStatus="TIEP_NHAN" />
      </StatusTransitionModalProvider>,
    );
    act(() => screen.getByTestId('open-transition').click());
    // TIEP_NHAN → DANG_XAC_MINH, DA_PHAN_CONG, DA_CHUYEN_DON_VI, PHAN_LOAI_DAN_SU
    const select = screen.getByTestId('status-transition-select') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toContain('DANG_XAC_MINH');
    expect(optionValues).toContain('DA_PHAN_CONG');
    // NOT in TIEP_NHAN's valid transitions:
    expect(optionValues).not.toContain('TIEP_NHAN'); // can't transition to self
    expect(optionValues).not.toContain('KHONG_KHOI_TO'); // not valid from TIEP_NHAN
  });

  it('shows conditional lyDoKhongKhoiTo field only when status=KHONG_KHOI_TO', () => {
    render(
      <StatusTransitionModalProvider>
        <Consumer currentStatus="DANG_XAC_MINH" />
      </StatusTransitionModalProvider>,
    );
    act(() => screen.getByTestId('open-transition').click());
    expect(screen.queryByTestId('field-ly-do-khong-khoi-to')).not.toBeInTheDocument();
    const select = screen.getByTestId('status-transition-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'KHONG_KHOI_TO' } });
    expect(screen.getByTestId('field-ly-do-khong-khoi-to')).toBeInTheDocument();
  });

  it('submit calls PATCH /incidents/:id/status with status + payload', async () => {
    const onSuccess = vi.fn();
    render(
      <StatusTransitionModalProvider>
        <Consumer currentStatus="DANG_XAC_MINH" onSuccessSpy={onSuccess} />
      </StatusTransitionModalProvider>,
    );
    act(() => screen.getByTestId('open-transition').click());
    const select = screen.getByTestId('status-transition-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'DA_PHAN_CONG' } });
    await act(async () => {
      screen.getByTestId('btn-confirm-transition').click();
    });
    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        '/incidents/I1/status',
        expect.objectContaining({
          status: 'DA_PHAN_CONG',
          expectedUpdatedAt: '2026-01-01T00:00:00Z',
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('blocks submit when KHONG_KHOI_TO selected but lyDoKhongKhoiTo empty', async () => {
    render(
      <StatusTransitionModalProvider>
        <Consumer currentStatus="DANG_XAC_MINH" />
      </StatusTransitionModalProvider>,
    );
    act(() => screen.getByTestId('open-transition').click());
    const select = screen.getByTestId('status-transition-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'KHONG_KHOI_TO' } });
    const confirm = screen.getByTestId('btn-confirm-transition');
    expect(confirm).toBeDisabled();
  });

  it('cancel closes modal without API call', () => {
    render(
      <StatusTransitionModalProvider>
        <Consumer />
      </StatusTransitionModalProvider>,
    );
    act(() => screen.getByTestId('open-transition').click());
    act(() => screen.getByTestId('btn-cancel-transition').click());
    expect(screen.queryByTestId('status-transition-modal')).not.toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it('throws if hook called outside provider', () => {
    const Bad = () => {
      useStatusTransitionModal();
      return null;
    };
    const ce = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/StatusTransitionModalProvider/);
    ce.mockRestore();
  });
});
