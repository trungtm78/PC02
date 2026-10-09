import {
  parseTsv,
  mapPasteToCells,
  planPaste,
  parseAddress,
  formatAddress,
} from './paste';

/**
 * Paste engine — maps a TSV block (copied from Excel) onto a rectangular
 * region of grid addresses, anchored at the cell the user pasted into.
 * Pure, no I/O; shared verbatim between the grid's paste handler and the
 * server's re-validation of the same batch (FRD §6.1: "không dịch chuyển
 * cột khi gặp ô khóa; nếu có bất kỳ ô đích không hợp lệ/khóa thì từ chối
 * cả khối"). This engine only does positional mapping and the
 * editable/locked gate — actual per-cell type validation is values.ts's
 * job, applied afterward by the caller.
 */

describe('parseAddress / formatAddress', () => {
  it('parses a single-letter column address', () => {
    expect(parseAddress('A1')).toEqual({ col: 0, row: 1 });
    expect(parseAddress('C6')).toEqual({ col: 2, row: 6 });
  });

  it('parses a multi-letter column address', () => {
    expect(parseAddress('AA1')).toEqual({ col: 26, row: 1 });
    expect(parseAddress('AB10')).toEqual({ col: 27, row: 10 });
  });

  it('throws on a malformed address', () => {
    expect(() => parseAddress('123')).toThrow();
    expect(() => parseAddress('A')).toThrow();
  });

  it('round-trips format(parse(x)) === x', () => {
    for (const addr of ['A1', 'C6', 'Z1', 'AA1', 'AK12']) {
      expect(formatAddress(parseAddress(addr))).toBe(addr);
    }
  });
});

describe('parseTsv', () => {
  it('splits rows by newline and cells by tab', () => {
    expect(parseTsv('1\t2\n3\t4')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('strips a trailing \\r from Windows-style line endings', () => {
    expect(parseTsv('1\t2\r\n3\t4')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles a single cell with no tabs or newlines', () => {
    expect(parseTsv('125')).toEqual([['125']]);
  });

  it('drops a single trailing empty row (Excel copy often adds one trailing newline)', () => {
    expect(parseTsv('1\t2\n3\t4\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

describe('mapPasteToCells — pure positional mapping', () => {
  it('maps a 1x1 paste to the anchor cell', () => {
    expect(mapPasteToCells('C6', [['125']])).toEqual([
      { address: 'C6', rawValue: '125' },
    ]);
  });

  it('maps a 2x2 block anchored at C6 to C6,D6,C7,D7 in row-major order', () => {
    expect(
      mapPasteToCells('C6', [
        ['1', '2'],
        ['3', '4'],
      ]),
    ).toEqual([
      { address: 'C6', rawValue: '1' },
      { address: 'D6', rawValue: '2' },
      { address: 'C7', rawValue: '3' },
      { address: 'D7', rawValue: '4' },
    ]);
  });

  it('maps a tall single-column block', () => {
    expect(mapPasteToCells('A1', [['x'], ['y'], ['z']])).toEqual([
      { address: 'A1', rawValue: 'x' },
      { address: 'A2', rawValue: 'y' },
      { address: 'A3', rawValue: 'z' },
    ]);
  });
});

describe('planPaste — the locked/editable gate (FRD §6.1)', () => {
  const editableOnly = new Set(['C6', 'D6', 'C7', 'D7']);
  const isEditable = (address: string) => editableOnly.has(address);

  it('accepts a paste entirely within editable cells', () => {
    const result = planPaste('C6', '1\t2\n3\t4', isEditable);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cells).toHaveLength(4);
  });

  it('rejects the WHOLE block when one target cell is locked, instead of shifting around it (FRD: "không dịch chuyển cột khi gặp ô khóa")', () => {
    // D6 is editable, but E6 (one column further) is not in our editable set.
    const result = planPaste('D6', '1\t2', isEditable);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BLOCKED_CELL');
      expect(result.error.blockedAddresses).toEqual(['E6']);
    }
  });

  it('lists every blocked address, not just the first one', () => {
    const result = planPaste('A1', '1\t2\n3\t4', isEditable); // none of A1,B1,A2,B2 are editable
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.blockedAddresses).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('rejects an empty paste', () => {
    const result = planPaste('C6', '', isEditable);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMPTY_PASTE');
  });

  it('a TEXT cell value starting with "=" is passed through untouched — this engine never interprets it as a formula (AC-020)', () => {
    const result = planPaste('C6', '=1+1', isEditable);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cells[0].rawValue).toBe('=1+1');
  });
});
