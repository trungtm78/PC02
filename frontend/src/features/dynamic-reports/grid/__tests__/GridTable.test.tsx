import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GridTable from '../GridTable';
import { evaluateGrid } from '../gridEvaluation';
import { FIELDS, makeGrid } from './fixtures';

const VALUES = {
  'Đội 3!C3': { v: '1234.5' },
  'Đội 3!C4': { v: '5' },
  'Đội 3!E3': { v: '2026-10-12' },
  'Đội 3!C7': { v: 'xong' },
};

function renderTable(props: Partial<React.ComponentProps<typeof GridTable>> = {}, gridOver = {}, sheetOver = {}) {
  const grid = makeGrid(gridOver, sheetOver);
  const evaluation = evaluateGrid(grid, FIELDS, VALUES);
  return render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluation} {...props} />);
}

describe('GridTable', () => {
  it('is an accessible read-only grid with the sheet size announced', () => {
    renderTable();
    const table = screen.getByRole('grid');
    expect(table).toHaveAttribute('aria-readonly', 'true');
    expect(table).toHaveAttribute('aria-rowcount', '7');
    expect(table).toHaveAttribute('aria-colcount', '5');
    expect(table).toHaveAccessibleName('Bảng Đội 3');
  });

  it('draws a merged block once, spanning its columns, and drops the cells it covers', () => {
    renderTable();
    const title = screen.getByTestId('cell-A1');
    expect(title).toHaveAttribute('colspan', '5');
    expect(title).toHaveTextContent('THỐNG KÊ');
    expect(screen.queryByTestId('cell-B1')).toBeNull();
    expect(screen.queryByTestId('cell-E1')).toBeNull();
  });

  it('omits hidden rows', () => {
    renderTable();
    expect(screen.queryByText('6', { selector: 'th' })).toBeNull(); // row 6 is hidden
    expect(screen.getByText('7', { selector: 'th' })).toBeInTheDocument();
  });

  it('omits hidden columns and shrinks the span of a merge that crosses them', () => {
    renderTable({}, {}, { hiddenCols: [1, 2] });
    expect(screen.queryByTestId('cell-B3')).toBeNull();
    expect(screen.getByTestId('cell-A1')).toHaveAttribute('colspan', '3');
  });

  it('widths and heights come from the file, scaled by the zoom', () => {
    const { container } = renderTable({ zoom: 125 });
    const cols = container.querySelectorAll('col');
    // header column + 5 sheet columns
    expect(cols).toHaveLength(6);
    expect((cols[1] as HTMLElement).style.width).toBe(`${Math.round(40 * 1.25)}px`);
    expect((cols[3] as HTMLElement).style.width).toBe(`${Math.round(80 * 1.25)}px`);
    const row = screen.getByTestId('cell-A2').closest('tr') as HTMLElement;
    expect(row.style.height).toBe(`${Math.round(20 * 1.25)}px`);
  });

  it('shows Excel-style column letters and row numbers, and can hide them', () => {
    const { rerender } = renderTable();
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      expect(screen.getByText(letter, { selector: 'th' })).toBeInTheDocument();
    }
    const grid = makeGrid();
    rerender(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, FIELDS, VALUES)} showHeaders={false} />);
    expect(screen.queryByText('A', { selector: 'th' })).toBeNull();
  });

  it('applies the cell style: fill, weight, centred text, borders', () => {
    renderTable();
    const title = screen.getByTestId('cell-A1');
    expect(title).toHaveStyle({ fontWeight: '700', textAlign: 'center', backgroundColor: 'rgb(255, 255, 0)' });
    expect(title.style.borderBottom).toBe('2px solid rgb(255, 0, 0)');
  });

  it('shows submitted values formatted by the cell number format, and computed formulas', () => {
    renderTable();
    expect(screen.getByTestId('cell-C3')).toHaveTextContent('1.235');
    expect(screen.getByTestId('cell-C4')).toHaveTextContent('5'); // not the 99 the file ships
    expect(screen.getByTestId('cell-C5')).toHaveTextContent('1.240');
    expect(screen.getByTestId('cell-D3')).toHaveTextContent('99,6%');
    expect(screen.getByTestId('cell-E3')).toHaveTextContent('12/10/2026');
    expect(screen.getByTestId('cell-C7')).toHaveTextContent('xong');
  });

  it('marks input cells so a viewer can tell them from labels, and formulas carry their source', () => {
    renderTable();
    expect(screen.getByTestId('cell-C3')).toHaveAttribute('data-kind', 'input');
    expect(screen.getByTestId('cell-C3').style.outline).toContain('solid');
    expect(screen.getByTestId('cell-B3')).toHaveAttribute('data-kind', 'static');
    expect(screen.getByTestId('cell-C5')).toHaveAttribute('data-kind', 'formula');
    expect(screen.getByTestId('cell-C5')).toHaveAttribute('title', '=SUM(C3:C4)');
  });

  it('a formula error is red, readable, and explained on hover', () => {
    const cells = {
      A1: { k: 'formula' as const, f: '1/0', s: 0 },
    };
    renderTable({}, {}, { cells, merges: [], hiddenRows: [], rows: 1, cols: 1, colWidthsPx: [80], rowHeightsPx: [20], freeze: { rows: 0, cols: 0 } });
    const cell = screen.getByTestId('cell-A1');
    expect(cell).toHaveTextContent('#DIV/0!');
    expect(cell).toHaveAttribute('data-error', 'true');
    expect(cell.getAttribute('title')).toContain('chia cho 0');
    expect(cell).toHaveStyle({ color: 'rgb(185, 28, 28)' });
  });

  it('frozen heading rows stick below the column headers and keep their order', () => {
    renderTable();
    const a2 = screen.getByTestId('cell-A2');
    expect(a2.style.position).toBe('sticky');
    // header row is 20px; the title row (30px) is frozen above row 2
    expect(a2.style.top).toBe(`${20 + 30}px`);
    expect(screen.getByTestId('cell-A1').style.top).toBe('20px');
    // an unfrozen row does not stick
    expect(screen.getByTestId('cell-A3').style.position).toBe('');
  });

  it('frozen columns stick to the left of the row headers', () => {
    renderTable({}, {}, { freeze: { rows: 0, cols: 2 } });
    const b3 = screen.getByTestId('cell-B3');
    expect(b3.style.position).toBe('sticky');
    expect(b3.style.left).toBe(`${40 + 40}px`); // row-header width + column A
    expect(b3.style.backgroundColor).toBe('rgb(255, 255, 255)'); // opaque, or content scrolls through it
  });

  it('"only rows with inputs" keeps frozen headings and rows that hold an input', () => {
    renderTable({ onlyInputRows: true });
    expect(screen.getByTestId('cell-A1')).toBeInTheDocument(); // frozen
    expect(screen.getByTestId('cell-A2')).toBeInTheDocument(); // frozen
    expect(screen.getByTestId('cell-C3')).toBeInTheDocument(); // input row
    expect(screen.getByTestId('cell-C7')).toBeInTheDocument(); // input row
    expect(screen.queryByTestId('cell-A5')).toBeNull(); // the Tổng row has no input
  });

  it('a cell the file lacks takes its row style, else its column style', () => {
    const { container } = renderTable({}, {}, { rowStyles: { 6: 2 }, colStyles: [{ min: 4, max: 4, s: 1 }] });
    // E7 does not exist in the file: row 7 (index 6) style wins over column E's.
    expect(container).toBeTruthy();
    expect(screen.getByTestId('cell-D7')).toHaveStyle({ backgroundColor: 'rgb(221, 221, 221)' });
  });

  it('draws gridlines as a shadow, not a border, and can omit them', () => {
    const { unmount } = renderTable();
    expect(screen.getByTestId('cell-B3').style.boxShadow).toContain('inset');
    unmount();
    renderTable({}, {}, { showGridlines: false });
    expect(screen.getByTestId('cell-B3').style.boxShadow).toBe('');
  });

  it('a conditional format overlays its look on the matching cell only', () => {
    renderTable({}, {}, {
      conditionalFormats: [
        { ranges: ['C3:C4'], rules: [{ type: 'cellIs', operator: 'greaterThan', formulas: ['100'], style: { fill: '#ff0000' }, priority: 1, stopIfTrue: false }] },
      ],
    });
    expect(screen.getByTestId('cell-C3')).toHaveStyle({ backgroundColor: 'rgb(255, 0, 0)' }); // 1234.5 > 100
    expect(screen.getByTestId('cell-C4')).not.toHaveStyle({ backgroundColor: 'rgb(255, 0, 0)' }); // 5
  });

  it('rich text keeps its runs', () => {
    const cells = {
      A1: { k: 'text' as const, v: 'Đậm thường', s: 0, runs: [{ text: 'Đậm ', bold: true }, { text: 'thường' }] },
    };
    renderTable({}, {}, { cells, merges: [], hiddenRows: [], rows: 1, cols: 1, colWidthsPx: [120], rowHeightsPx: [20], freeze: { rows: 0, cols: 0 } });
    const cell = screen.getByTestId('cell-A1');
    const bold = within(cell).getByText('Đậm');
    expect(bold).toHaveStyle({ fontWeight: '700' });
    expect(cell).toHaveTextContent('Đậm thường');
  });

  it('renders nothing for a sheet the model does not have', () => {
    const grid = makeGrid();
    const { container } = render(
      <GridTable grid={grid} sheetName="Không có" evaluation={evaluateGrid(grid, FIELDS, VALUES)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
