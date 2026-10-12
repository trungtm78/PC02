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
