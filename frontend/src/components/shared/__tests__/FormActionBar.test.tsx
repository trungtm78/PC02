import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormActionBar } from '../FormActionBar';

describe('FormActionBar', () => {
  it('keeps the canonical cancel, clone, print, save order', () => {
    render(
      <FormActionBar
        title="Record"
        subtitle="Edit record"
        onBack={vi.fn()}
        onCancel={vi.fn()}
        cloneAction={{ label: 'Clone', onClick: vi.fn(), testId: 'clone' }}
        printAction={{ label: 'Print', onClick: vi.fn(), testId: 'print' }}
        saveAction={<button data-testid="save">Save</button>}
      />,
    );

    const actions = screen.getByTestId('form-action-bar-actions');
    expect(Array.from(actions.children).map((node) => node.getAttribute('data-testid'))).toEqual([
      'form-action-cancel',
      'clone',
      'print',
      'save',
    ]);
  });

  it('keeps clone available when the caller allows create from a read-only source', () => {
    const onClone = vi.fn();
    render(
      <FormActionBar
        title="Record"
        onBack={vi.fn()}
        onCancel={vi.fn()}
        cloneAction={{ label: 'Clone', onClick: onClone, testId: 'clone' }}
      />,
    );

    fireEvent.click(screen.getByTestId('clone'));
    expect(onClone).toHaveBeenCalledOnce();
  });

  it('renders the same canonical action order without a duplicate page heading at the form footer', () => {
    render(
      <FormActionBar
        actionsOnly
        testId="form-action-bar-bottom"
        onCancel={vi.fn()}
        cancelTestId="cancel-bottom"
        cloneAction={{ label: 'Clone', onClick: vi.fn(), testId: 'clone-bottom' }}
        printAction={{ label: 'Print', onClick: vi.fn(), testId: 'print-bottom' }}
        saveAction={<button data-testid="save-bottom">Save</button>}
      />,
    );

    expect(screen.queryByRole('heading')).toBeNull();
    const actions = screen.getByTestId('form-action-bar-bottom-actions');
    expect(Array.from(actions.children).map((node) => node.getAttribute('data-testid'))).toEqual([
      'cancel-bottom',
      'clone-bottom',
      'print-bottom',
      'save-bottom',
    ]);
  });
});
