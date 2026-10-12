import { describe, it, expect } from 'vitest';
import { carryOverMarks, withPreviousExtras } from '../carryOver';
import type { ReportDetailField, TemplatePreviewResult } from '../types';

function oldField(address: string, over: Partial<ReportDetailField> = {}): ReportDetailField {
  return {
    sheetKey: 'S',
    address,
    fieldKey: `S!${address}`,
    label: `Nhãn ${address}`,
    type: 'NUM',
    format: null,
    aggregate: 'SUM',
    blankPolicy: 'ZERO',
    required: false,
    min: null,
    max: null,
    scale: null,
    maxLength: null,
    helpText: null,
    source: 'WEB',
    ...over,
  };
}

function preview(over: Partial<TemplatePreviewResult> = {}): TemplatePreviewResult {
  return {
    dateSystem: '1900',
    fields: [],
    formulas: [],
    issues: [],
    markableCells: [],
    totalCells: 10,
    inputCellCount: 0,
    sha256: 'x',
    suggestedRules: [],
    layout: {},
    ...over,
  } as TemplatePreviewResult;
}

describe('carryOverMarks — a new template must not make people name every cell again', () => {
  it('marks the previous input cells that are still markable on the new template, keeping label, type and aggregate', () => {
    const p = preview({
      markableCells: [
        { sheetKey: 'S', address: 'C3', suggestedLabel: null },
        { sheetKey: 'S', address: 'C4', suggestedLabel: null },
      ],
    });
    const out = carryOverMarks(p, [oldField('C3'), oldField('C4', { label: 'Số bị can', aggregate: 'AVG' })]);

    expect(out.carried).toEqual(['S!C3', 'S!C4']);
    expect(out.lost).toEqual([]);
    expect(out.result.fields.map((f) => [f.fieldKey, f.label, f.aggregate, f.source])).toEqual([
      ['S!C3', 'Nhãn C3', 'SUM', 'WEB'],
      ['S!C4', 'Số bị can', 'AVG', 'WEB'],
    ]);
  });

  it('a cell the new file already declares itself (a token) counts as carried and is not marked twice', () => {
    const p = preview({
      fields: [
        { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Từ token', type: 'NUM', format: '', aggregate: 'SUM', source: 'TOKEN' },
      ],
    });
    const out = carryOverMarks(p, [oldField('C3')]);
    expect(out.carried).toEqual(['S!C3']);
    expect(out.result.fields).toHaveLength(1);
    expect(out.result.fields[0].label).toBe('Từ token');
  });

  it('reports cells the new template no longer has instead of dropping them silently', () => {
    const p = preview({ markableCells: [{ sheetKey: 'S', address: 'C3', suggestedLabel: null }] });
    const out = carryOverMarks(p, [oldField('C3'), oldField('C9', { label: 'Đã biến mất' })]);

    expect(out.carried).toEqual(['S!C3']);
    expect(out.lost.map((f) => f.fieldKey)).toEqual(['S!C9']);
    expect(out.result.fields.map((f) => f.fieldKey)).toEqual(['S!C3']);
  });

  it('one cell that cannot be marked does not stop the others (each cell is its own decision)', () => {
    const p = preview({
      markableCells: [
        { sheetKey: 'S', address: 'C3', suggestedLabel: null },
        { sheetKey: 'S', address: 'C5', suggestedLabel: null },
      ],
    });
    const out = carryOverMarks(p, [oldField('C3'), oldField('C4'), oldField('C5')]);
    expect(out.carried).toEqual(['S!C3', 'S!C5']);
    expect(out.lost.map((f) => f.fieldKey)).toEqual(['S!C4']);
  });

  it('a previous type/aggregate pair the engine does not allow is lost, not forced', () => {
    const p = preview({ markableCells: [{ sheetKey: 'S', address: 'C3', suggestedLabel: null }] });
    const out = carryOverMarks(p, [oldField('C3', { type: 'TEXT', aggregate: 'SUM' })]);
    expect(out.lost.map((f) => f.fieldKey)).toEqual(['S!C3']);
  });
});

describe('withPreviousExtras', () => {
  it('gives back required, blank policy, scale, max length and help text the wizard has no editor for', () => {
    const fields = [{ sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'A', type: 'NUM' as const, format: '', aggregate: 'SUM' as const, source: 'WEB' as const }];
    const out = withPreviousExtras(fields, [
      oldField('C3', { required: true, blankPolicy: 'IGNORE', scale: 2, maxLength: 10, helpText: 'Nhập số vụ' }),
    ]);
    expect(out[0]).toMatchObject({ required: true, blankPolicy: 'IGNORE', scale: 2, maxLength: 10, helpText: 'Nhập số vụ' });
  });

  it('leaves a field the previous version did not have exactly as it is, and omits empty extras', () => {
    const fields = [
      { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'A', type: 'NUM' as const, format: '', aggregate: 'SUM' as const, source: 'WEB' as const },
      { sheetKey: 'S', address: 'C9', fieldKey: 'S!C9', label: 'Mới', type: 'NUM' as const, format: '', aggregate: 'SUM' as const, source: 'WEB' as const },
    ];
    const out = withPreviousExtras(fields, [oldField('C3')]);
    expect(out[1]).toEqual(fields[1]);
    expect('scale' in out[0]).toBe(false);
    expect('helpText' in out[0]).toBe(false);
  });
});
