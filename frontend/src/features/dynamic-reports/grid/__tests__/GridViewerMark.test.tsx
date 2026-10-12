import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GridViewer from '../GridViewer';
import type { GridMarkBinding } from '../GridViewer';
import { dynamicReportsApi } from '../../api';
import { FIELDS, makeGrid } from './fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: { getVersionGrid: vi.fn() },
}));

/**
 * Wizard step S03/S04: the template is shown as the officer will see it, and the author drags over the cells to
 * turn them into inputs. The grid only PICKS cells; the batch form below the grid (type, format, label) and
 * `applyWebMarks` stay the one place that marks, so the list and the grid cannot disagree.
 */

const grid = makeGrid();

// In the fixture C3, C4, C7 and E3 are inputs; here C4 and C7 are NOT marked yet (candidates), C3 is a field.
const FIELDS_MARKED = [FIELDS[0]];
const CANDIDATES = new Set(['Đội 3!C4', 'Đội 3!C7', 'Đội 3!E3']);

function binding(over: Partial<GridMarkBinding> = {}): GridMarkBinding {
  return { candidates: CANDIDATES, chosen: new Set(), onPick: vi.fn(), ...over };
}

function renderMark(mark: GridMarkBinding, preloaded = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GridViewer versionId="v1" grid={preloaded ? grid : undefined} fields={FIELDS_MARKED} values={{}} mark={mark} />
    </QueryClientProvider>,
  );
}

function drag(from: string, to: string, init: MouseEventInit = {}) {
  fireEvent.mouseDown(screen.getByTestId(from), { button: 0, ...init });
  fireEvent.mouseEnter(screen.getByTestId(to), { buttons: 1, ...init });
  fireEvent.mouseUp(document, init);
}

describe('GridViewer — pick cells to mark (S03/S04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(grid);
  });

  it('draws the template it was given, without fetching one', () => {
    renderMark(binding());
    expect(screen.getByTestId('grid-viewer')).toBeInTheDocument();
    expect(dynamicReportsApi.getVersionGrid).not.toHaveBeenCalled();
  });

  it('dragging over a block reports the markable cells inside it, in sheet order', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    drag('cell-B3', 'cell-C7'); // B3:C7 holds C4 and C7 as candidates; C3 is already a field, C5 a formula
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(['Đội 3!C4', 'Đội 3!C7'], false);
  });

  it('a block with nothing markable in it picks nothing and reports it as an empty pick', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    drag('cell-A3', 'cell-B3'); // static cells only
    expect(onPick).toHaveBeenCalledWith([], false);
  });

  it('a click on one markable cell picks that cell', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    fireEvent.mouseDown(screen.getByTestId('cell-C7'), { button: 0 });
    fireEvent.mouseUp(document);
    expect(onPick).toHaveBeenCalledWith(['Đội 3!C7'], false);
  });

  it('holding Ctrl (or ⌘) adds to what is already chosen instead of replacing it', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    drag('cell-C7', 'cell-C7', { ctrlKey: true });
    expect(onPick).toHaveBeenCalledWith(['Đội 3!C7'], true);
    onPick.mockClear();
    drag('cell-C7', 'cell-C7', { metaKey: true });
    expect(onPick).toHaveBeenCalledWith(['Đội 3!C7'], true);
  });

  it('the drag may run in any direction', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    drag('cell-C7', 'cell-B3');
    expect(onPick).toHaveBeenCalledWith(['Đội 3!C4', 'Đội 3!C7'], false);
  });

  it('a press that does not end over the grid still ends the drag (the button is released outside)', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    fireEvent.mouseDown(screen.getByTestId('cell-C4'), { button: 0 });
    fireEvent.mouseUp(document.body);
    expect(onPick).toHaveBeenCalledTimes(1);
    // …and a later move over the grid is not a drag any more.
    fireEvent.mouseEnter(screen.getByTestId('cell-C7'), { buttons: 1 });
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('coming back over the grid with no button held (it was released elsewhere) cancels the drag, picking nothing', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    fireEvent.mouseDown(screen.getByTestId('cell-C4'), { button: 0, buttons: 1 });
    fireEvent.mouseEnter(screen.getByTestId('cell-C7'), { buttons: 0 });
    fireEvent.mouseUp(document);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('the window losing focus in the middle of a drag cancels it', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    fireEvent.mouseDown(screen.getByTestId('cell-C4'), { button: 0, buttons: 1 });
    fireEvent(window, new Event('blur'));
    fireEvent.mouseUp(document);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('only the left button picks', () => {
    const onPick = vi.fn();
    renderMark(binding({ onPick }));
    fireEvent.mouseDown(screen.getByTestId('cell-C4'), { button: 2 });
    fireEvent.mouseUp(document);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows which cells can be marked and which are chosen, and not for any other cell', () => {
    renderMark(binding({ chosen: new Set(['Đội 3!C7']) }));
    expect(screen.getByTestId('cell-C4')).toHaveAttribute('data-mark', 'candidate');
    expect(screen.getByTestId('cell-C7')).toHaveAttribute('data-mark', 'chosen');
    expect(screen.getByTestId('cell-E3')).toHaveAttribute('data-mark', 'candidate');
    expect(screen.getByTestId('cell-B3')).not.toHaveAttribute('data-mark');
    expect(screen.getByTestId('cell-C3')).not.toHaveAttribute('data-mark'); // already a field
  });

  it('the fields already marked draw as input cells, blank', () => {
    renderMark(binding());
    expect(screen.getByTestId('cell-C3')).toHaveAttribute('data-kind', 'input');
    expect(screen.getByTestId('cell-C3')).toHaveTextContent('');
  });

  it('nothing in mark mode can be typed into or opened as a popover', () => {
    renderMark(binding());
    expect(screen.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
    expect(screen.getByTestId('cell-C3')).not.toHaveAttribute('aria-haspopup');
  });

  it('a legend says what the colours mean', () => {
    renderMark(binding());
    expect(screen.getByTestId('mark-legend')).toBeInTheDocument();
  });
});
