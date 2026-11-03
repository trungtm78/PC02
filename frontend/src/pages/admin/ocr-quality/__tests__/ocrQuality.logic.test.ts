import { describe, expect, it } from 'vitest';
import { microToUsd, percent, qualityByModel, worstFields, type FieldQualityRow } from '../ocrQuality.logic';

const row = (over: Partial<FieldQualityRow>): FieldQualityRow => ({
  entity: 'PETITION',
  field: 'senderName',
  providerKind: 'GEMINI',
  model: 'flash',
  promptVersion: 'v1',
  kept: 0,
  edited: 0,
  cleared: 0,
  total: 0,
  mustConfirm: 0,
  ...over,
});

describe('qualityByModel', () => {
  it('adds up every field of a model and gives the share kept, changed and emptied, best model first', () => {
    const result = qualityByModel([
      row({ model: 'flash', kept: 6, edited: 3, cleared: 1, total: 10 }),
      row({ model: 'flash', field: 'senderPhone', kept: 10, total: 10 }),
      row({ model: 'haiku', kept: 5, edited: 5, total: 10 }),
    ]);
    expect(result.map((r) => r.model)).toEqual(['flash', 'haiku']);
    expect(result[0]).toMatchObject({ total: 20 });
    expect(result[0].keptRate).toBeCloseTo(0.8);
    expect(result[0].editedRate).toBeCloseTo(0.15);
    expect(result[0].clearedRate).toBeCloseTo(0.05);
  });

  it('an empty report is an empty list, not a division by zero', () => {
    expect(qualityByModel([])).toEqual([]);
    expect(qualityByModel([row({ total: 0 })])[0].keptRate).toBe(0);
  });
});

describe('worstFields', () => {
  it('lists the fields officers correct most, and leaves out those seen too few times to judge', () => {
    const list = worstFields([
      row({ field: 'a', kept: 1, edited: 9, total: 10 }),
      row({ field: 'b', kept: 9, edited: 1, total: 10 }),
      row({ field: 'c', edited: 2, total: 2 }),
    ]);
    expect(list.map((f) => f.field)).toEqual(['a', 'b']);
    expect(list[0].correctedRate).toBeCloseTo(0.9);
  });
});

describe('formatting', () => {
  it('shows cost with enough digits for small amounts and percentages with one decimal', () => {
    expect(microToUsd(2500)).toBe('0.0025');
    expect(microToUsd(12_340_000)).toBe('12.34');
    expect(percent(0.1234)).toBe('12.3%');
  });
});
