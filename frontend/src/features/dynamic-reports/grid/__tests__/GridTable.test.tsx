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
    // 7 + 5 sheet lines, plus the column-letter row and the row-number column.
    expect(table).toHaveAttribute('aria-rowcount', '8');
    expect(table).toHaveAttribute('aria-colcount', '6');
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

  it('ARIA indexes count the header row and header column, so no two cells share a position', () => {
    renderTable();
    const headerRow = screen.getByText('A', { selector: 'th' }).closest('tr') as HTMLElement;
    expect(headerRow).toHaveAttribute('aria-rowindex', '1');
    expect(screen.getByTestId('cell-A2').closest('tr')).toHaveAttribute('aria-rowindex', '3');
    expect(screen.getByTestId('cell-A2')).toHaveAttribute('aria-colindex', '2');
    expect(screen.getByTestId('cell-E3')).toHaveAttribute('aria-colindex', '6');
  });

  it('a merge whose anchor column is hidden is still drawn, by its first visible cell', () => {
    const cells = {
      A1: { k: 'text' as const, v: 'Gộp', s: 0 },
      C1: { k: 'num' as const, v: '123', s: 0 },
    };
    renderTable({}, {}, {
      cells, rows: 1, cols: 3, colWidthsPx: [40, 40, 40], rowHeightsPx: [20], hiddenRows: [],
      hiddenCols: [0], merges: [{ top: 0, left: 0, bottom: 0, right: 1 }], freeze: { rows: 0, cols: 0 },
    });
    // Visible columns are B and C: B's slot draws the block (content of its anchor A1), C stays under C.
    const cellsInRow = Array.from(screen.getByTestId('cell-A1').closest('tr')!.querySelectorAll('td'));
    expect(cellsInRow.map((td) => td.getAttribute('data-testid'))).toEqual(['cell-A1', 'cell-C1']);
    expect(cellsInRow[0]).toHaveAttribute('aria-colindex', '3'); // header col + A + B
    expect(screen.getByTestId('cell-A1')).toHaveTextContent('Gộp');
    expect(screen.getByTestId('cell-C1')).toHaveTextContent('123');
  });

  it('filtering rows shrinks a merged block to the rows still drawn', () => {
    const cells = {
      A2: { k: 'text' as const, v: 'Khối', s: 0 },
      A4: { k: 'empty' as const, s: 0 },
      B2: { k: 'empty' as const, s: 0 },
    };
    const grid = makeGrid({}, {
      cells, rows: 4, cols: 2, colWidthsPx: [40, 40], rowHeightsPx: [20, 20, 20, 20], hiddenRows: [],
      hiddenCols: [], merges: [{ top: 1, left: 0, bottom: 2, right: 0 }], freeze: { rows: 0, cols: 0 },
    });
    const fields = [
      { sheetKey: 'Đội 3', address: 'B2', fieldKey: 'k1', type: 'NUM' as const },
      { sheetKey: 'Đội 3', address: 'A4', fieldKey: 'k2', type: 'NUM' as const },
    ];
    render(
      <GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, fields, {})} onlyInputRows />,
    );
    // Row 3 is filtered out; the block A2:A3 now covers one drawn row, so A4 stays in column A.
    expect(screen.getByTestId('cell-A2')).not.toHaveAttribute('rowspan');
    const row4 = screen.getByTestId('cell-A4').closest('tr') as HTMLElement;
    expect(row4.querySelectorAll('td')).toHaveLength(2);
  });

  it('keeps the indent and justification the style asks for', () => {
    const grid = makeGrid({ styles: [{}, { indent: 2, hAlign: 'justify' }] }, {
      cells: { A1: { k: 'text', v: 'Thụt lề', s: 1 } },
      rows: 1, cols: 1, colWidthsPx: [120], rowHeightsPx: [20], hiddenRows: [], merges: [], freeze: { rows: 0, cols: 0 },
    });
    render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, [], {})} />);
    const cell = screen.getByTestId('cell-A1');
    expect(cell.style.paddingLeft).toBe('20px'); // 2 × 9 + 2
    expect(cell.style.textAlign).toBe('justify');
  });

  it('clips tall content to the row height so frozen offsets stay true', () => {
    const grid = makeGrid({}, {
      cells: { A1: { k: 'text', v: 'một\nhai\nba', s: 0 }, A2: { k: 'text', v: 'x', s: 0 } },
      rows: 2, cols: 1, colWidthsPx: [80], rowHeightsPx: [20, 20], hiddenRows: [], merges: [],
      freeze: { rows: 2, cols: 0 },
    });
    render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, [], {})} />);
    const box = screen.getByTestId('cell-A1').firstElementChild as HTMLElement;
    expect(box.style.height).toBe('20px');
    expect(box.style.overflow).toBe('hidden');
    expect(screen.getByTestId('cell-A2').style.top).toBe(`${20 + 20}px`);
  });

  it('renders nothing for a sheet the model does not have', () => {
    const grid = makeGrid();
    const { container } = render(
      <GridTable grid={grid} sheetName="Không có" evaluation={evaluateGrid(grid, FIELDS, VALUES)} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
