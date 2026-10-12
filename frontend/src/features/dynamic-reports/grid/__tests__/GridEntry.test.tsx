import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useState } from 'react';
import GridEntry from '../GridEntry';
import type { EntryField } from '../GridEntry';
import { evaluateGrid } from '../gridEvaluation';
import { makeGrid, makeSheet } from './fixtures';
import type { GridModel } from '../../engine/generated/grid-types';

/**
 * 5 × 7 template (see fixtures.ts). Inputs: C3 (number, required), C4 (number ≥ 0),
 * E3 (date), C7 (text). Row 5 is hidden, rows 1-2 are frozen headings.
 */
const FIELDS: EntryField[] = [
  { sheetKey: 'Đội 3', address: 'C3', fieldKey: 'Đội 3!C3', type: 'NUM', label: 'Số vụ mới', required: true },
  { sheetKey: 'Đội 3', address: 'C4', fieldKey: 'Đội 3!C4', type: 'NUM', label: 'Đã giải quyết', min: '0' },
  { sheetKey: 'Đội 3', address: 'E3', fieldKey: 'Đội 3!E3', type: 'DATE', label: 'Ngày' },
  { sheetKey: 'Đội 3', address: 'C7', fieldKey: 'Đội 3!C7', type: 'TEXT', label: 'Ghi chú' },
];

interface Probe {
  changes: Array<[string, string]>;
  batches: Array<Record<string, string>>;
  leaves: number;
}

function Harness({
  probe,
  initial = {},
  editable = true,
  grid = makeGrid(),
  onlyInputRows = false,
}: {
  probe: Probe;
  initial?: Record<string, string>;
  editable?: boolean;
  grid?: GridModel;
  onlyInputRows?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const evaluation = useMemo(
    () => evaluateGrid(grid, FIELDS, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { v: v || null }]))),
    [grid, values],
  );
  return (
    <GridEntry
      grid={grid}
      sheetName="Đội 3"
      evaluation={evaluation}
      fields={FIELDS}
      editable={editable}
      onlyInputRows={onlyInputRows}
      valueOf={(k) => values[k] ?? ''}
      onChange={(k, v) => {
        probe.changes.push([k, v]);
        setValues((prev) => ({ ...prev, [k]: v }));
      }}
      onChangeMany={(batch) => {
        probe.batches.push(batch);
        setValues((prev) => ({ ...prev, ...batch }));
      }}
      onLeave={() => {
        probe.leaves += 1;
      }}
    />
  );
}

const newProbe = (): Probe => ({ changes: [], batches: [], leaves: 0 });
const editor = () => screen.getByTestId('grid-editor') as HTMLTextAreaElement;
const cell = (address: string) => screen.getByTestId(`cell-${address}`);
const click = (address: string) => fireEvent.mouseDown(cell(address), { button: 0 });
const key = (k: string, init: Record<string, unknown> = {}) => fireEvent.keyDown(editor(), { key: k, ...init });

/** Types text the way a keyboard does: a keydown, then the character lands in the textarea. */
function typeText(text: string) {
  for (const ch of text) {
    fireEvent.keyDown(editor(), { key: ch });
    fireEvent.change(editor(), { target: { value: editor().value + ch } });
  }
}

const mode = () => editor().getAttribute('data-mode');

afterEach(() => vi.useRealTimers());

describe('the editor over the active cell', () => {
  it('lets clicks through to the cells until something is being typed', () => {
    render(<Harness probe={newProbe()} />);
    click('C3');
    expect(editor().style.pointerEvents).toBe('none');
    typeText('1');
    expect(editor().style.pointerEvents).toBe('auto');
    expect(editor().style.border).toContain('solid');
  });
});

describe('selecting', () => {
  it('a click selects a cell and the editor takes the keyboard, labelled with the cell', () => {
    render(<Harness probe={newProbe()} />);
    click('C3');
    expect(cell('C3')).toHaveAttribute('aria-selected', 'true');
    expect(editor()).toHaveAttribute('aria-label', 'C3 — Số vụ mới');
    expect(document.activeElement).toBe(editor());
    expect(screen.getByTestId('grid-announce')).toHaveTextContent('đang trống');
  });

  it('Tabbing into the grid puts the cursor on the first input cell', () => {
    render(<Harness probe={newProbe()} />);
    fireEvent.focus(editor());
    expect(cell('C3')).toHaveAttribute('aria-selected', 'true');
  });

  it('dragging selects a block; Shift+click extends it', () => {
    render(<Harness probe={newProbe()} />);
    click('C3');
    fireEvent.mouseEnter(cell('C4'), { buttons: 1 });
    expect(cell('C3')).toHaveAttribute('aria-selected', 'true');
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
    expect(cell('C7')).toHaveAttribute('aria-selected', 'false');
    fireEvent.mouseUp(window);
    fireEvent.mouseEnter(cell('C7'), { buttons: 1 }); // not dragging any more
    expect(cell('C7')).toHaveAttribute('aria-selected', 'false');
    fireEvent.mouseDown(cell('C7'), { button: 0, shiftKey: true });
    expect(cell('C7')).toHaveAttribute('aria-selected', 'true');
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
  });

  it('arrow keys move the cursor; Shift+arrow grows the selection', () => {
    render(<Harness probe={newProbe()} />);
    click('C3');
    key('ArrowDown');
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
    key('ArrowDown', { shiftKey: true });
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
    expect(cell('C5')).toHaveAttribute('aria-selected', 'true');
  });

  it('exposes the keyboard zone so global shortcuts stay out', () => {
    render(<Harness probe={newProbe()} />);
    expect(screen.getByTestId('grid-scroll-Đội 3')).toHaveAttribute('data-shortcut-zone', 'grid');
  });

  it('marks required input cells', () => {
    render(<Harness probe={newProbe()} />);
    expect(cell('C3').textContent).toContain('*');
    expect(cell('C4').textContent).not.toContain('*');
  });
});

describe('typing a value', () => {
  it('typing over a cell then Enter stores the canonical value and moves down the column', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    typeText('1.234,5');
    expect(mode()).toBe('enter');
    expect(editor().value).toBe('1.234,5');
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C3', '1234.5']]);
    expect(cell('C3')).toHaveTextContent('1.235'); // shown with the cell's number format
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
    expect(mode()).toBe('nav');
    expect(editor().value).toBe('');
  });

  it('formulas recompute when the value is confirmed, not while typing', () => {
    render(<Harness probe={newProbe()} initial={{ 'Đội 3!C4': '5' }} />);
    expect(cell('C5')).toHaveTextContent('5');
    click('C3');
    typeText('100');
    expect(cell('C5')).toHaveTextContent('5'); // still the old total
    key('Enter');
    expect(cell('C5')).toHaveTextContent('105');
  });

  it('Tab walks the input cells in reading order and leaves the grid after the last', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    typeText('1');
    key('Tab');
    expect(cell('E3')).toHaveAttribute('aria-selected', 'true');
    key('Tab');
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
    key('Tab');
    expect(cell('C7')).toHaveAttribute('aria-selected', 'true');
    // At the last input cell Tab is NOT swallowed: focus moves on to the next control.
    expect(fireEvent.keyDown(editor(), { key: 'Tab' })).toBe(true);
    expect(cell('C7')).toHaveAttribute('aria-selected', 'true');
    key('Tab', { shiftKey: true });
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
  });

  it('F2 opens the existing value for editing, with a comma decimal', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '1234.5' }} />);
    click('C3');
    key('F2');
    expect(mode()).toBe('edit');
    expect(editor().value).toBe('1234,5');
    fireEvent.change(editor(), { target: { value: '1234,56' } });
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C3', '1234.56']]);
  });

  it('double-click opens the cell for editing', () => {
    render(<Harness probe={newProbe()} initial={{ 'Đội 3!C7': 'xong' }} />);
    click('C7');
    fireEvent.doubleClick(cell('C7'));
    expect(mode()).toBe('edit');
    expect(editor().value).toBe('xong');
  });

  it('Escape throws the typing away', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    typeText('999');
    key('Escape');
    expect(mode()).toBe('nav');
    expect(editor().value).toBe('');
    expect(probe.changes).toEqual([]);
    expect(cell('C3')).toHaveTextContent('7');
  });

  it('a wrong value stays in the editor, says why, and flags the cell until fixed', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C4');
    typeText('abc');
    key('Enter');
    expect(probe.changes).toEqual([]);
    expect(mode()).toBe('enter');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('C4');
    expect(cell('C4')).toHaveAttribute('aria-invalid', 'true');
    // Fix it.
    fireEvent.change(editor(), { target: { value: '12' } });
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C4', '12']]);
    expect(cell('C4')).not.toHaveAttribute('aria-invalid');
  });

  it('a value below the minimum is refused with the reason', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C4');
    typeText('-3');
    key('Enter');
    expect(probe.changes).toEqual([]);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent(/tối thiểu/);
  });

  it('dates accept dd/mm/yyyy and are stored as ISO', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('E3');
    typeText('04/07/2026');
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!E3', '2026-07-04']]);
    expect(cell('E3')).toHaveTextContent('04/07/2026');
  });

  it('an arrow key in Enter mode confirms the value and moves on', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    typeText('5');
    key('ArrowRight');
    expect(probe.changes).toEqual([['Đội 3!C3', '5']]);
    expect(cell('D3')).toHaveAttribute('aria-selected', 'true');
  });

  it('arrow keys inside F2 editing belong to the caret', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C7': 'abc' }} />);
    click('C7');
    key('F2');
    key('ArrowLeft');
    expect(mode()).toBe('edit');
    expect(cell('C7')).toHaveAttribute('aria-selected', 'true');
    expect(probe.changes).toEqual([]);
  });

  it('clicking another cell confirms what was typed', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    typeText('8');
    click('C4');
    expect(probe.changes).toEqual([['Đội 3!C3', '8']]);
    expect(cell('C4')).toHaveAttribute('aria-selected', 'true');
  });

  it('losing focus confirms the typing and asks the page to save', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    typeText('8');
    fireEvent.blur(editor());
    expect(probe.changes).toEqual([['Đội 3!C3', '8']]);
    expect(probe.leaves).toBe(1);
  });

  it('Backspace starts over an empty editor', () => {
    render(<Harness probe={newProbe()} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    key('Backspace');
    expect(mode()).toBe('enter');
    expect(editor().value).toBe('');
  });

  it('confirming an empty editor clears the cell', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    key('F2');
    fireEvent.change(editor(), { target: { value: '' } });
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C3', '']]);
  });

  it('Alt+Enter adds a line in a text cell', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C7');
    typeText('một');
    key('Enter', { altKey: true });
    typeText('hai');
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C7', 'một\nhai']]);
  });
});

describe('cells that cannot be typed into', () => {
  it('typing on a label says so and changes nothing', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('B3');
    key('5');
    expect(mode()).toBe('nav');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('không nhập được');
    expect(probe.changes).toEqual([]);
  });

  it('after the deadline the grid can be read but not typed into', () => {
    const probe = newProbe();
    render(<Harness probe={probe} editable={false} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    key('5');
    expect(mode()).toBe('nav');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('đã khoá');
    key('Delete');
    expect(probe.changes).toEqual([]);
    expect(probe.batches).toEqual([]);
    expect(editor()).toHaveAttribute('readonly');
  });
});

describe('IME (Telex / VNI)', () => {
  it('starting a composition on an input cell switches to typing', () => {
    render(<Harness probe={newProbe()} />);
    click('C7');
    fireEvent.compositionStart(editor());
    expect(mode()).toBe('enter');
  });

  it('keys pressed during a composition are not commands', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C7');
    fireEvent.compositionStart(editor());
    fireEvent.change(editor(), { target: { value: 'tie' } });
    fireEvent.keyDown(editor(), { key: 'Enter', isComposing: true, keyCode: 229 });
    fireEvent.keyDown(editor(), { key: 'Tab', isComposing: true, keyCode: 229 });
    expect(probe.changes).toEqual([]);
    expect(editor().value).toBe('tie');
    expect(mode()).toBe('enter');
    // The composition ends and the officer confirms.
    fireEvent.change(editor(), { target: { value: 'tiếng' } });
    key('Enter');
    expect(probe.changes).toEqual([['Đội 3!C7', 'tiếng']]);
  });

  it('a composition on a label is refused', () => {
    render(<Harness probe={newProbe()} />);
    click('B3');
    fireEvent.compositionStart(editor());
    expect(mode()).toBe('nav');
  });
});

describe('clearing, undo and redo', () => {
  it('Delete clears the selected input cells in one step; Ctrl+Z brings them back; Ctrl+Y clears again', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '7', 'Đội 3!C4': '9' }} />);
    click('C3');
    key('ArrowDown', { shiftKey: true });
    key('Delete');
    expect(probe.batches).toEqual([{ 'Đội 3!C3': '', 'Đội 3!C4': '' }]);
    expect(cell('C3').textContent).not.toMatch(/\d/);
    key('z', { ctrlKey: true });
    expect(probe.batches[1]).toEqual({ 'Đội 3!C4': '9', 'Đội 3!C3': '7' });
    expect(cell('C4')).toHaveTextContent('9');
    key('y', { ctrlKey: true });
    expect(probe.batches[2]).toEqual({ 'Đội 3!C3': '', 'Đội 3!C4': '' });
  });

  it('undo takes back a typed value', () => {
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    typeText('99');
    key('Enter');
    expect(cell('C3')).toHaveTextContent('99');
    click('C3');
    key('z', { ctrlKey: true });
    expect(cell('C3')).toHaveTextContent('7');
  });

  it('Delete over cells that are all labels says so', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('B3');
    key('Delete');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('không nhập được');
    expect(probe.batches).toEqual([]);
  });
});

describe('clipboard', () => {
  const paste = (text: string) => fireEvent.paste(editor(), { clipboardData: { getData: () => text } });

  it('copy puts the selection on the clipboard as text an officer can paste back', () => {
    const setData = vi.fn();
    render(<Harness probe={newProbe()} initial={{ 'Đội 3!C3': '1234.5', 'Đội 3!C4': '9' }} />);
    click('C3');
    key('ArrowDown', { shiftKey: true });
    fireEvent.copy(editor(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '1234,5\n9\n');
  });

  it('cut copies and then clears', () => {
    const setData = vi.fn();
    const probe = newProbe();
    render(<Harness probe={probe} initial={{ 'Đội 3!C3': '7' }} />);
    click('C3');
    fireEvent.cut(editor(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '7\n');
    expect(probe.batches).toEqual([{ 'Đội 3!C3': '' }]);
  });

  it('pastes a block from Excel into the input cells below and to the right of the cursor', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    paste('1\n2\n'); // two rows, one column → C3, C4
    expect(probe.batches).toEqual([{ 'Đội 3!C3': '1', 'Đội 3!C4': '2' }]);
    expect(cell('C5')).toHaveTextContent('3');
  });

  it('a block that touches a locked cell is refused as a whole', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    paste('1\t2\n3\t4'); // D3 is not an input
    expect(probe.batches).toEqual([]);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('D3');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('Không ô nào được dán');
  });

  it('a block with one bad value is refused as a whole, naming the cell', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    paste('5\n-1'); // C4 has a minimum of 0
    expect(probe.batches).toEqual([]);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('C4');
  });

  it('paste is refused after the deadline', () => {
    const probe = newProbe();
    render(<Harness probe={probe} editable={false} />);
    click('C3');
    paste('1');
    expect(probe.batches).toEqual([]);
    expect(probe.changes).toEqual([]);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('đã khoá');
  });

  it('inside the editor a paste is plain text insertion (not intercepted)', () => {
    render(<Harness probe={newProbe()} />);
    click('C7');
    typeText('a');
    const notCancelled = fireEvent.paste(editor(), { clipboardData: { getData: () => 'x\ty' } });
    expect(notCancelled).toBe(true);
  });
});

describe('today and now', () => {
  it('Ctrl+; writes today (Vietnam time) into a date cell', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z')); // 1 Jan 2027 in Ho Chi Minh City
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('E3');
    key(';', { ctrlKey: true });
    expect(probe.changes).toEqual([['Đội 3!E3', '2027-01-01']]);
  });

  it('Ctrl+; on a number cell explains itself and changes nothing', () => {
    const probe = newProbe();
    render(<Harness probe={probe} />);
    click('C3');
    key(';', { ctrlKey: true });
    expect(probe.changes).toEqual([]);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('ô ngày');
  });
});

describe('navigation keys', () => {
  it('Ctrl+Home goes below the frozen headings; Ctrl+End to the last used cell', () => {
    render(<Harness probe={newProbe()} />);
    click('C3');
    key('End', { ctrlKey: true });
    expect(cell('E7')).toHaveAttribute('aria-selected', 'true'); // last used row (7) × last used column (E)
    key('Home', { ctrlKey: true });
    expect(cell('A3')).toHaveAttribute('aria-selected', 'true'); // first cell below the 2 frozen heading rows
  });

  it('Enter goes down the column, then to the next column with inputs; at the very last input it stays put', () => {
    render(<Harness probe={newProbe()} />);
    click('C7');
    key('Enter'); // column C is finished → the first input of the next column that has one: E3
    expect(cell('E3')).toHaveAttribute('aria-selected', 'true');
    key('Enter'); // nothing after E3
    expect(cell('E3')).toHaveAttribute('aria-selected', 'true');
  });

  it('with "only rows with inputs" the cursor never lands on a hidden label row', () => {
    render(<Harness probe={newProbe()} onlyInputRows />);
    click('C4');
    key('ArrowDown');
    expect(cell('C7')).toHaveAttribute('aria-selected', 'true'); // row 5 (Tổng) is filtered out
  });
});

describe('merged blocks', () => {
  it('the cursor lives on the cell that draws a merge and selection grows to take it whole', () => {
    const grid = makeGrid({}, { merges: [{ top: 0, left: 0, bottom: 0, right: 4 }, { top: 2, left: 3, bottom: 3, right: 3 }] });
    render(<Harness probe={newProbe()} grid={grid} />);
    click('C3');
    key('ArrowRight');
    // D3:D4 is one block, drawn from D3.
    expect(cell('D3')).toHaveAttribute('aria-selected', 'true');
    key('ArrowDown');
    expect(cell('D3')).toHaveAttribute('aria-selected', 'false');
    expect(cell('D5')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('server problems', () => {
  it('flags the cells the server rejected', () => {
    const grid = makeGrid();
    const evaluation = evaluateGrid(grid, FIELDS, {});
    render(
      <GridEntry
        grid={grid}
        sheetName="Đội 3"
        evaluation={evaluation}
        fields={FIELDS}
        editable
        valueOf={() => ''}
        onChange={() => {}}
        onChangeMany={() => {}}
        onLeave={() => {}}
        serverErrors={{ 'Đội 3!C4': 'Ô "Đội 3!C4": giá trị sai' }}
      />,
    );
    expect(cell('C4')).toHaveAttribute('aria-invalid', 'true');
    expect(cell('C3')).not.toHaveAttribute('aria-invalid');
  });
});

void act;
void makeSheet;
