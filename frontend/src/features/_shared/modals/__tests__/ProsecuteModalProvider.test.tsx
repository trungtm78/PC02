import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import {
  ProsecuteModalProvider,
  useProsecuteModal,
} from '../ProsecuteModalProvider';

const postMock = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => postMock(...args),
  },
}));

function Consumer({ onSuccessSpy }: { onSuccessSpy?: (caseId: string) => void }) {
  const m = useProsecuteModal();
  return (
    <button
      data-testid="open-prosecute"
      onClick={() =>
        m.open({
          recordId: 'I9',
          incidentName: 'Vụ việc HS-2026-007',
          currentUpdatedAt: '2026-05-01T00:00:00Z',
          onSuccess: onSuccessSpy,
        })
      }
    >
      open
    </button>
  );
}

beforeEach(() => {
  postMock.mockReset();
});

describe('ProsecuteModalProvider', () => {
  it('opens modal with warning banner', () => {
    postMock.mockResolvedValue({
      data: { incident: { id: 'I9' }, case: { id: 'C123' } },
    });
    render(
      <ProsecuteModalProvider>
        <Consumer />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    expect(screen.getByTestId('prosecute-modal')).toBeInTheDocument();
    expect(screen.getByText(/không thể hoàn tác/i)).toBeInTheDocument();
  });

  it('pre-fills caseName from incidentName', () => {
    postMock.mockResolvedValue({ data: { case: { id: 'C123' } } });
    render(
      <ProsecuteModalProvider>
        <Consumer />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    const caseNameInput = screen.getByTestId('field-case-name') as HTMLInputElement;
    expect(caseNameInput.value).toBe('Vụ việc HS-2026-007');
  });

  it('blocks submit when caseName or prosecutionDecision empty', () => {
    render(
      <ProsecuteModalProvider>
        <Consumer />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    fireEvent.change(screen.getByTestId('field-case-name'), { target: { value: '' } });
    expect(screen.getByTestId('btn-confirm-prosecute')).toBeDisabled();
  });

  it('submit calls POST /incidents/:id/prosecute with payload', async () => {
    postMock.mockResolvedValue({
      data: { incident: { id: 'I9' }, case: { id: 'C123' } },
    });
    const onSuccess = vi.fn();
    render(
      <ProsecuteModalProvider>
        <Consumer onSuccessSpy={onSuccess} />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    fireEvent.change(screen.getByTestId('field-prosecution-decision'), {
      target: { value: 'QĐ-123/2026' },
    });
    fireEvent.change(screen.getByTestId('field-prosecution-date'), {
      target: { value: '2026-05-30' },
    });
    fireEvent.change(screen.getByTestId('field-crime'), {
      target: { value: 'Trộm cắp tài sản' },
    });
    await act(async () => {
      screen.getByTestId('btn-confirm-prosecute').click();
    });
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        '/incidents/I9/prosecute',
        expect.objectContaining({
          caseName: 'Vụ việc HS-2026-007',
          prosecutionDecision: 'QĐ-123/2026',
          prosecutionDate: '2026-05-30',
          crime: 'Trộm cắp tài sản',
          expectedUpdatedAt: '2026-05-01T00:00:00Z',
        }),
      );
      expect(onSuccess).toHaveBeenCalledWith('C123');
    });
  });

  it('onSuccess passes new case.id for navigation', async () => {
    postMock.mockResolvedValue({
      data: { case: { id: 'NEW_CASE_42' } },
    });
    const onSuccess = vi.fn();
    render(
      <ProsecuteModalProvider>
        <Consumer onSuccessSpy={onSuccess} />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    fireEvent.change(screen.getByTestId('field-prosecution-decision'), {
      target: { value: 'QĐ-1' },
    });
    await act(async () => {
      screen.getByTestId('btn-confirm-prosecute').click();
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('NEW_CASE_42');
    });
  });

  it('cancel closes modal without API call', () => {
    render(
      <ProsecuteModalProvider>
        <Consumer />
      </ProsecuteModalProvider>,
    );
    act(() => screen.getByTestId('open-prosecute').click());
    act(() => screen.getByTestId('btn-cancel-prosecute').click());
    expect(screen.queryByTestId('prosecute-modal')).not.toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('throws if hook used outside provider', () => {
    const Bad = () => {
      useProsecuteModal();
      return null;
    };
    const ce = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ProsecuteModalProvider/);
    ce.mockRestore();
  });
});
