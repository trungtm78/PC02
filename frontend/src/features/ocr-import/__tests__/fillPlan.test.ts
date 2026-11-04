import { describe, expect, it } from 'vitest';
import type { LegacyFieldValue } from '@/features/legacy-form/types';
import {
  planFill,
  undoFill,
  unconfirmedPatches,
  type FormAccess,
  type Projection,
} from '../fillPlan';

type Form = Record<string, LegacyFieldValue>;

const access: FormAccess<Form> = {
  read: (form, field) => form[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }),
};

const fill = (
  field: string,
  value: string | number,
  extra: Partial<Projection['fills'][number]> = {},
): Projection['fills'][number] => ({
  field,
  value,
  policy: 'AI_FILL',
  provenance: { claimKind: 'QUOTED', pageId: 'p1', quote: 'trích dẫn' },
  warnings: [],
  ...extra,
});

const projection = (...fills: Projection['fills']): Projection => ({
  fills,
  skips: [],
});

describe('planFill', () => {
  it('fills empty fields and reports what it wrote, with the value that was there before', () => {
    const form: Form = { senderName: '', senderPhone: '' };
    const plan = planFill(access, {
      form,
      baseline: form,
      lastFilled: {},
      projection: projection(fill('senderName', 'Nguyễn Thị Hương')),
    });
    expect(plan.form.senderName).toBe('Nguyễn Thị Hương');
    expect(plan.applied).toEqual([
      expect.objectContaining({
        field: 'senderName',
        before: '',
        value: 'Nguyễn Thị Hương',
        orange: false,
      }),
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('never overwrites something the officer typed', () => {
    const baseline: Form = { senderName: '' };
    const form: Form = { senderName: 'Gõ tay' };
    const plan = planFill(access, {
      form,
      baseline,
      lastFilled: {},
      projection: projection(fill('senderName', 'Từ ảnh')),
    });
    expect(plan.form.senderName).toBe('Gõ tay');
    expect(plan.applied).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({
        field: 'senderName',
        reason: 'TYPED_BY_OFFICER',
        current: 'Gõ tay',
        value: 'Từ ảnh',
      }),
    ]);
  });

  it('treats a default the form put there itself as empty', () => {
    const baseline: Form = { receivedDate: '2026-11-03' };
    const plan = planFill(access, {
      form: baseline,
      baseline,
      lastFilled: {},
      projection: projection(fill('receivedDate', '2026-10-30')),
    });
    expect(plan.form.receivedDate).toBe('2026-10-30');
    expect(plan.applied[0].before).toBe('2026-11-03');
  });

  it('a second reading may replace what the first reading wrote, but still not what the officer then changed', () => {
    const baseline: Form = { a: '', b: '' };
    const form: Form = { a: 'lần 1', b: 'lần 1 b' };
    const edited: Form = { ...form, b: 'cán bộ sửa' };
    const plan = planFill(access, {
      form: edited,
      baseline,
      lastFilled: { a: 'lần 1', b: 'lần 1 b' },
      projection: projection(fill('a', 'lần 2'), fill('b', 'lần 2 b')),
    });
    expect(plan.form.a).toBe('lần 2');
    expect(plan.form.b).toBe('cán bộ sửa');
    expect(plan.skipped.map((s) => s.field)).toEqual(['b']);
  });

  it('marks a field orange when its policy needs confirmation or the analysis warned about it', () => {
    const form: Form = { x: '', y: '', z: '' };
    const plan = planFill(access, {
      form,
      baseline: form,
      lastFilled: {},
      projection: projection(
        fill('x', '1', { policy: 'AI_FILL_MUST_CONFIRM' }),
        fill('y', '2', { warnings: ['INFERRED_VALUE'] }),
        fill('z', '3'),
      ),
    });
    expect(Object.fromEntries(plan.applied.map((p) => [p.field, p.orange]))).toEqual({
      x: true,
      y: true,
      z: false,
    });
  });

  it('does not write a value that still has to be matched against a directory; it offers it instead', () => {
    const form: Form = { crimeChinhId: '' };
    const plan = planFill(access, {
      form,
      baseline: form,
      lastFilled: {},
      projection: projection(
        fill('crimeChinhId', 174, {
          pending: { kind: 'CRIME_BY_ARTICLE', article: 174, law: null },
        }),
      ),
    });
    expect(plan.form.crimeChinhId).toBe('');
    expect(plan.applied).toEqual([]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({ field: 'crimeChinhId', reason: 'NEEDS_RESOLUTION' }),
    ]);
  });

  it('writes numbers as the text the form holds', () => {
    const form: Form = { soTienBiThietHai: '' };
    const plan = planFill(access, {
      form,
      baseline: form,
      lastFilled: {},
      projection: projection(fill('soTienBiThietHai', 495253647)),
    });
    expect(plan.form.soTienBiThietHai).toBe('495253647');
  });

  it('leaves the input form object untouched', () => {
    const form: Form = { a: '' };
    planFill(access, {
      form,
      baseline: form,
      lastFilled: {},
      projection: projection(fill('a', 'x')),
    });
    expect(form.a).toBe('');
  });
});

describe('undoFill', () => {
  const applied = (field: string, before: LegacyFieldValue, value: string) => ({
    field,
    before,
    value,
    orange: false,
    provenance: { claimKind: 'QUOTED' as const, pageId: 'p1', quote: null },
    warnings: [],
  });

  it('puts back only the fields that still hold what was filled in', () => {
    const form: Form = { a: 'từ ảnh', b: 'cán bộ đã sửa', c: 'từ ảnh c' };
    const result = undoFill(access, form, [
      applied('a', '', 'từ ảnh'),
      applied('b', '', 'từ ảnh b'),
      applied('c', 'mặc định', 'từ ảnh c'),
    ]);
    expect(result.form).toEqual({ a: '', b: 'cán bộ đã sửa', c: 'mặc định' });
    expect(result.undone).toEqual(['a', 'c']);
    expect(result.conflicts).toEqual(['b']);
  });
});

describe('unconfirmedPatches', () => {
  const orange = (field: string, value: string) => ({
    field,
    before: '' as LegacyFieldValue,
    value,
    orange: true,
    provenance: { claimKind: 'QUOTED' as const, pageId: null, quote: null },
    warnings: [],
  });

  it('lists orange fields not yet confirmed that still hold the filled value', () => {
    const form: Form = { a: '1', b: '2' };
    const list = unconfirmedPatches(access, form, [orange('a', '1'), orange('b', '2')], new Set(['a']));
    expect(list.map((p) => p.field)).toEqual(['b']);
  });

  it('a field the officer changed is no longer waiting: they have decided it', () => {
    const form: Form = { a: 'đổi rồi' };
    expect(unconfirmedPatches(access, form, [orange('a', '1')], new Set())).toEqual([]);
  });

  it('plain fields never wait for confirmation', () => {
    const form: Form = { a: '1' };
    const plain = { ...orange('a', '1'), orange: false };
    expect(unconfirmedPatches(access, form, [plain], new Set())).toEqual([]);
  });
});
