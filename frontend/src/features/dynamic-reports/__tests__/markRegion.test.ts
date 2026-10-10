import { describe, it, expect } from 'vitest';
import { applyWebMarks, removeWebMarks } from '../markRegion';
import type { TemplatePreviewResult } from '../types';

function baseResult(): TemplatePreviewResult {
  return {
    dateSystem: '1900',
    fields: [],
    formulas: [],
    issues: [
      {
        sheetKey: 'Đội 3',
        address: 'C6',
        code: 'UNLOCKED_NO_TOKEN',
        severity: 'WARNING',
        message: 'Ô đang mở khoá nhưng không có token hợp lệ — gợi ý đặt làm ô nhập hoặc khoá lại ô này.',
      },
      {
        sheetKey: 'Đội 3',
        address: 'C7',
        code: 'UNLOCKED_NO_TOKEN',
        severity: 'WARNING',
        message: 'Ô đang mở khoá nhưng không có token hợp lệ — gợi ý đặt làm ô nhập hoặc khoá lại ô này.',
      },
    ],
    markableCells: [
      { sheetKey: 'Đội 3', address: 'C6', suggestedLabel: 'Số vụ mới' },
      { sheetKey: 'Đội 3', address: 'C7', suggestedLabel: null },
    ],
    totalCells: 100,
    inputCellCount: 0,
    sha256: 'abc',
    suggestedRules: [],
  };
}

describe('applyWebMarks', () => {
  it('marks a markable cell as a WEB field, removing it from markableCells and its warning', () => {
    const result = baseResult();
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'Số vụ mới', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected ok');
    expect(out.result.fields).toEqual([
      { sheetKey: 'Đội 3', address: 'C6', fieldKey: 'Đội 3!C6', label: 'Số vụ mới', type: 'NUM', format: '', aggregate: 'SUM', source: 'WEB' },
    ]);
    expect(out.result.markableCells).toEqual([
      { sheetKey: 'Đội 3', address: 'C7', suggestedLabel: null },
    ]);
    expect(out.result.issues).toHaveLength(1);
    expect(out.result.issues[0].address).toBe('C7');
    expect(out.result.inputCellCount).toBe(1);
  });

  it('marks a whole batch atomically, applying all or none', () => {
    const result = baseResult();
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'A', type: 'NUM', format: '', aggregate: 'SUM' },
      { sheetKey: 'Đội 3', address: 'C7', label: 'B', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('expected ok');
    expect(out.result.fields).toHaveLength(2);
    expect(out.result.markableCells).toHaveLength(0);
    expect(out.result.issues).toHaveLength(0);
  });

  it('rejects the whole batch if one cell is not markable — no partial apply', () => {
    const result = baseResult();
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'A', type: 'NUM', format: '', aggregate: 'SUM' },
      { sheetKey: 'Đội 3', address: 'Z99', label: 'B', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.errors[0]).toContain('Z99');
    expect(out.errors).toHaveLength(1);
  });

  it('rejects an empty label', () => {
    const result = baseResult();
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C7', label: '   ', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(false);
  });

  it('rejects a type/aggregate mismatch (e.g. TEXT with SUM)', () => {
    const result = baseResult();
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'A', type: 'TEXT', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected failure');
    expect(out.errors[0]).toContain('TEXT');
  });

  it('rejects marking a cell that is already a field', () => {
    const result = baseResult();
    result.fields.push({
      sheetKey: 'Đội 3', address: 'C6', fieldKey: 'Đội 3!C6', label: 'X', type: 'NUM', format: '', aggregate: 'NONE', source: 'TOKEN',
    });
    result.markableCells = result.markableCells.filter((c) => c.address !== 'C6');
    const out = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'A', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    expect(out.ok).toBe(false);
  });

  it('rejects an empty mark request', () => {
    const out = applyWebMarks(baseResult(), []);
    expect(out.ok).toBe(false);
  });
});

describe('removeWebMarks', () => {
  it('reverses a WEB mark: restores the markable candidate and its warning, decrements inputCellCount', () => {
    const result = baseResult();
    const marked = applyWebMarks(result, [
      { sheetKey: 'Đội 3', address: 'C6', label: 'Số vụ mới', type: 'NUM', format: '', aggregate: 'SUM' },
    ]);
    if (!marked.ok) throw new Error('expected ok');

    const restored = removeWebMarks(marked.result, ['Đội 3!C6']);
    expect(restored.fields).toHaveLength(0);
    expect(restored.markableCells).toEqual(
      expect.arrayContaining([{ sheetKey: 'Đội 3', address: 'C6', suggestedLabel: 'Số vụ mới' }]),
    );
    expect(restored.issues.some((i) => i.address === 'C6' && i.code === 'UNLOCKED_NO_TOKEN')).toBe(true);
    expect(restored.inputCellCount).toBe(0);
  });

  it('never removes a TOKEN-sourced field even if its fieldKey is passed', () => {
    const result = baseResult();
    result.fields.push({
      sheetKey: 'Đội 3', address: 'B1', fieldKey: 'Đội 3!B1', label: 'Token field', type: 'NUM', format: '', aggregate: 'NONE', source: 'TOKEN',
    });
    const restored = removeWebMarks(result, ['Đội 3!B1']);
    expect(restored.fields).toHaveLength(1);
    expect(restored).toBe(result);
  });
});
