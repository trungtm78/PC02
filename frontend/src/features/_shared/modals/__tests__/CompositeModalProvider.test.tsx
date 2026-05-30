import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompositeModalProvider } from '../CompositeModalProvider';
import { useAssignModal } from '../AssignModalProvider';
import { useDeleteResourceModal } from '../DeleteResourceModalProvider';
import { useStatusTransitionModal } from '../StatusTransitionModalProvider';
import { useProsecuteModal } from '../ProsecuteModalProvider';

describe('CompositeModalProvider', () => {
  it('provides all 4 modal contexts to children', () => {
    function Probe() {
      const assign = useAssignModal();
      const del = useDeleteResourceModal();
      const transition = useStatusTransitionModal();
      const prosecute = useProsecuteModal();
      return (
        <div>
          <span data-testid="probe-assign">{typeof assign.open === 'function' ? 'ok' : 'fail'}</span>
          <span data-testid="probe-delete">{typeof del.open === 'function' ? 'ok' : 'fail'}</span>
          <span data-testid="probe-transition">{typeof transition.open === 'function' ? 'ok' : 'fail'}</span>
          <span data-testid="probe-prosecute">{typeof prosecute.open === 'function' ? 'ok' : 'fail'}</span>
        </div>
      );
    }
    render(
      <CompositeModalProvider>
        <Probe />
      </CompositeModalProvider>,
    );
    expect(screen.getByTestId('probe-assign')).toHaveTextContent('ok');
    expect(screen.getByTestId('probe-delete')).toHaveTextContent('ok');
    expect(screen.getByTestId('probe-transition')).toHaveTextContent('ok');
    expect(screen.getByTestId('probe-prosecute')).toHaveTextContent('ok');
  });

  it('renders children inside provider tree', () => {
    render(
      <CompositeModalProvider>
        <div data-testid="child">hello</div>
      </CompositeModalProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });
});
