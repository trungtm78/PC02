import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GridContributorsPopover from '../GridContributorsPopover';
import type { FieldAggregateView } from '../../types';

const FIELD: FieldAggregateView = {
  fieldKey: 'Đội 3!C3',
  sheetKey: 'Đội 3',
  address: 'C3',
  label: 'Số vụ mới',
  type: 'NUM',
  value: '30',
  displayNotAggregated: false,
  countTotal: 3,
  countNonBlank: 2,
  contributors: [
    { teamName: 'Đội 3', value: '10', state: 'SUBMITTED', revision: '2', updatedAt: '2026-06-10T08:00:00.000Z' },
    { teamName: 'Đội 4', value: '20', state: 'APPROVED', revision: '3', updatedAt: '2026-06-11T08:00:00.000Z' },
    { teamName: 'Đội 5', value: null, state: 'SUBMITTED', revision: '1', updatedAt: null },
  ],
};

function open(field: FieldAggregateView = FIELD, onClose = vi.fn()) {
  const anchor = document.createElement('td');
  anchor.tabIndex = 0;
  document.body.appendChild(anchor);
  const utils = render(<GridContributorsPopover field={field} anchor={anchor} onClose={onClose} />);
  return { anchor, onClose, ...utils };
}

describe('GridContributorsPopover', () => {
  it('is a dialog named after the figure it explains', () => {
    open();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Số vụ mới/);
  });

  it('lists exactly the teams behind the figure with their value and state', () => {
    open();
    expect(screen.getByTestId('contributor-Đội 3')).toHaveTextContent('10');
    expect(screen.getByTestId('contributor-Đội 4')).toHaveTextContent('20');
    expect(screen.getByTestId('contributor-Đội 4')).toHaveTextContent(/đã duyệt/i);
    expect(screen.getByTestId('contributor-Đội 5')).toHaveTextContent('—'); // submitted but left it blank
  });

  it('says how the figure is made up: the total and how many teams gave a number', () => {
    open();
    expect(screen.getByTestId('contributors-total')).toHaveTextContent('30');
    expect(screen.getByTestId('contributors-count')).toHaveTextContent('2/3');
  });

  it('says so when no team has contributed in this mode', () => {
    open({ ...FIELD, contributors: [], countTotal: 0, countNonBlank: 0, value: null });
    expect(screen.getByTestId('contributors-empty')).toBeInTheDocument();
  });

  it('a field that is not aggregated says so instead of showing a total', () => {
    open({ ...FIELD, displayNotAggregated: true, value: null });
    expect(screen.getByTestId('contributors-total')).toHaveTextContent(/không tổng hợp/i);
  });

  it('Escape closes it', () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes it even when the focus is no longer inside (after Shift+Tab into the grid)', () => {
    const { onClose } = open();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the focus moves to somewhere else, but not back to the cell it came from', () => {
    const { anchor, onClose } = open();
    const dialog = screen.getByRole('dialog');
    fireEvent.blur(dialog, { relatedTarget: anchor });
    expect(onClose).not.toHaveBeenCalled();
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    fireEvent.blur(dialog, { relatedTarget: elsewhere });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the page scrolls under it or the window is resized, but not when its own list scrolls', () => {
    const { onClose } = open();
    fireEvent.scroll(screen.getByTestId('contributors-popover'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.scroll(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event('resize'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes when the cell it came from is no longer on the page', () => {
    const onClose = vi.fn();
    const anchor = document.createElement('td');
    document.body.appendChild(anchor);
    const { rerender } = render(<GridContributorsPopover field={FIELD} anchor={anchor} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    anchor.remove();
    rerender(<GridContributorsPopover field={{ ...FIELD }} anchor={anchor} onClose={onClose} />);
    expect(onClose).toHaveBeenCalled();
  });

  it('a click outside closes it, a click inside does not', () => {
    const { onClose } = open();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a press on the cell it came from is not an outside click (the cell toggles it itself)', () => {
    const { anchor, onClose } = open();
    fireEvent.mouseDown(anchor);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the close button closes it', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: /đóng/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog, and gives it back to the cell when it is closed', () => {
    const { anchor, unmount } = open();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    unmount();
    expect(document.activeElement).toBe(anchor);
  });
});
