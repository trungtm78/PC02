import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AssignModalProvider } from '../AssignModalProvider';
import { useAssignModal } from '../AssignModalContext';

vi.mock('@/components/AssignModal', () => ({
  AssignModal: ({ open, recordId, resourceType, onClose, onSuccess }: {
    open: boolean;
    recordId: string;
    resourceType: string;
    onClose: () => void;
    onSuccess: (response: unknown) => void;
  }) =>
    open ? (
      <div data-testid="assign-modal-mock">
        <span data-testid="assign-modal-resource">{resourceType}</span>
        <span data-testid="assign-modal-record">{recordId}</span>
        <button data-testid="assign-modal-close" onClick={onClose}>
          Close
        </button>
        <button data-testid="assign-modal-success" onClick={() => onSuccess({ assignedTeamId: 'T2' })}>
          Save
        </button>
      </div>
    ) : null,
}));

function Consumer() {
  const m = useAssignModal();
  return (
    <button
      data-testid="open-trigger"
      onClick={() =>
        m.open({
          resourceType: 'cases',
          recordId: 'C42',
          currentTeamId: 'T1',
        })
      }
    >
      open
    </button>
  );
}

describe('AssignModalProvider', () => {
  it('exposes useAssignModal().open which mounts AssignModal with args', () => {
    render(
      <AssignModalProvider>
        <Consumer />
      </AssignModalProvider>,
    );
    expect(screen.queryByTestId('assign-modal-mock')).not.toBeInTheDocument();
    act(() => {
      screen.getByTestId('open-trigger').click();
    });
    expect(screen.getByTestId('assign-modal-mock')).toBeInTheDocument();
    expect(screen.getByTestId('assign-modal-resource')).toHaveTextContent('cases');
    expect(screen.getByTestId('assign-modal-record')).toHaveTextContent('C42');
  });

  it('closes the modal via onClose', () => {
    render(
      <AssignModalProvider>
        <Consumer />
      </AssignModalProvider>,
    );
    act(() => screen.getByTestId('open-trigger').click());
    expect(screen.getByTestId('assign-modal-mock')).toBeInTheDocument();
    act(() => screen.getByTestId('assign-modal-close').click());
    expect(screen.queryByTestId('assign-modal-mock')).not.toBeInTheDocument();
  });

  it('forwards a successful assignment response and closes the modal', () => {
    const onSuccess = vi.fn();
    function SuccessConsumer() {
      const modal = useAssignModal();
      return <button data-testid="open-success" onClick={() => modal.open({
        resourceType: 'incidents',
        recordId: 'I1',
        onSuccess,
      })}>open</button>;
    }
    render(<AssignModalProvider><SuccessConsumer /></AssignModalProvider>);
    act(() => screen.getByTestId('open-success').click());
    act(() => screen.getByTestId('assign-modal-success').click());
    expect(onSuccess).toHaveBeenCalledWith({ assignedTeamId: 'T2' });
    expect(screen.queryByTestId('assign-modal-mock')).not.toBeInTheDocument();
  });

  it('throws if useAssignModal called outside provider', () => {
    const Bad = () => {
      useAssignModal();
      return null;
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/AssignModalProvider/);
    consoleError.mockRestore();
  });
});
