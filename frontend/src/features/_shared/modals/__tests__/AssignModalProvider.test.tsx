import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AssignModalProvider, useAssignModal } from '../AssignModalProvider';

vi.mock('@/components/AssignModal', () => ({
  AssignModal: ({ open, recordId, resourceType, onClose }: {
    open: boolean;
    recordId: string;
    resourceType: string;
    onClose: () => void;
  }) =>
    open ? (
      <div data-testid="assign-modal-mock">
        <span data-testid="assign-modal-resource">{resourceType}</span>
        <span data-testid="assign-modal-record">{recordId}</span>
        <button data-testid="assign-modal-close" onClick={onClose}>
          Close
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
