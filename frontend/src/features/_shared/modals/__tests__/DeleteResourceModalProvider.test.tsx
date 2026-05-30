import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import {
  DeleteResourceModalProvider,
  useDeleteResourceModal,
} from '../DeleteResourceModalProvider';

const deleteMock = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

function Consumer({ recordLabel }: { recordLabel?: string }) {
  const m = useDeleteResourceModal();
  return (
    <button
      data-testid="open-delete"
      onClick={() =>
        m.open({
          resourceType: 'cases',
          recordId: 'C7',
          recordLabel,
        })
      }
    >
      open
    </button>
  );
}

beforeEach(() => {
  deleteMock.mockReset();
  deleteMock.mockResolvedValue({ data: { success: true } });
});

describe('DeleteResourceModalProvider', () => {
  it('open() mounts confirm dialog with record label', () => {
    render(
      <DeleteResourceModalProvider>
        <Consumer recordLabel="vụ án PC02-001" />
      </DeleteResourceModalProvider>,
    );
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    act(() => screen.getByTestId('open-delete').click());
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/vụ án PC02-001/)).toBeInTheDocument();
  });

  it('confirm calls api.delete with resource path and closes', async () => {
    const onSuccess = vi.fn();
    function ConsumerWithSuccess() {
      const m = useDeleteResourceModal();
      return (
        <button
          data-testid="open-delete"
          onClick={() => m.open({ resourceType: 'cases', recordId: 'C8', onSuccess })}
        >
          open
        </button>
      );
    }
    render(
      <DeleteResourceModalProvider>
        <ConsumerWithSuccess />
      </DeleteResourceModalProvider>,
    );
    act(() => screen.getByTestId('open-delete').click());
    await act(async () => {
      screen.getByTestId('btn-confirm-delete').click();
    });
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('/cases/C8');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('cancel closes without calling api', () => {
    render(
      <DeleteResourceModalProvider>
        <Consumer />
      </DeleteResourceModalProvider>,
    );
    act(() => screen.getByTestId('open-delete').click());
    act(() => screen.getByTestId('btn-cancel-delete').click());
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
  });

  it('throws if hook called outside provider', () => {
    const Bad = () => {
      useDeleteResourceModal();
      return null;
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/DeleteResourceModalProvider/);
    consoleError.mockRestore();
  });
});
