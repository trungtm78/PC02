import { describe, expect, it } from 'vitest';
import type { LegacyFieldValue } from '@/features/legacy-form/types';
import { fieldOutcomes } from '../fieldOutcomes';
import type { AppliedPatch, FormAccess } from '../fillPlan';

type Form = Record<string, LegacyFieldValue>;
const access: FormAccess<Form> = {
  read: (form, field) => form[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }),
};

const patch = (field: string, value: string, orange = false): AppliedPatch => ({
  field,
  before: '',
  value,
  orange,
  provenance: { claimKind: 'QUOTED', pageId: null, quote: null },
  warnings: [],
});

describe('fieldOutcomes', () => {
  it('says for each filled field whether the officer kept it, changed it or emptied it', () => {
    const form: Form = { a: 'giữ', b: 'đã sửa', c: '', d: 'giữ' };
    const outcomes = fieldOutcomes(access, form, [
      patch('a', 'giữ'),
      patch('b', 'gốc'),
      patch('c', 'xoá'),
      patch('d', 'giữ', true),
    ]);
    expect(outcomes).toEqual([
      { field: 'a', outcome: 'KEPT', mustConfirm: false },
      { field: 'b', outcome: 'EDITED', mustConfirm: false },
      { field: 'c', outcome: 'CLEARED', mustConfirm: false },
      { field: 'd', outcome: 'KEPT', mustConfirm: true },
    ]);
  });

  it('carries no value, only names and outcomes: nothing read from a scan leaves the form this way', () => {
    const form: Form = { a: 'Nguyễn Thị Hương' };
    expect(JSON.stringify(fieldOutcomes(access, form, [patch('a', 'Nguyễn Thị Hương')]))).not.toContain('Hương');
  });

  it('is empty when nothing was filled', () => {
    expect(fieldOutcomes(access, {}, [])).toEqual([]);
  });
});
