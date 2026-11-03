import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { LegacyFieldValue } from '@/features/legacy-form/types';
import type { FormAccess, ProjectionFill } from '../fillPlan';
import type { OcrAnalysisView } from '../ocrApi';
import { useOcrFill } from '../useOcrFill';

type Form = Record<string, LegacyFieldValue>;

const access: FormAccess<Form> = {
  read: (form, field) => form[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }),
};

const fill = (
  field: string,
  value: string,
  extra: Partial<ProjectionFill> = {},
): ProjectionFill => ({
  field,
  value,
  policy: 'AI_FILL',
  provenance: { claimKind: 'QUOTED', pageId: 'p1', quote: 'q' },
  warnings: [],
  ...extra,
});

const analysis = (...fills: ProjectionFill[]): OcrAnalysisView => ({
  id: 'ana-1',
  entity: 'PETITION',
  pageSetRevision: 1,
  inputFingerprint: 'fp',
  cleaned: {},
  issues: [],
  projection: { fills, skips: [] },
  promptVersions: {},
});

/** The hook next to a form it can write to, the way the page uses it. */
function setup(initial: Form = { a: '', b: '', c: '' }) {
  return renderHook(() => {
    const [form, setForm] = useState<Form>(initial);
    const ocr = useOcrFill({ access, form, setForm });
    return { form, setForm, ocr };
  });
}

describe('useOcrFill', () => {
  it('fills the form from an analysis and remembers the session to bind at save', () => {
    const { result } = setup();
    act(() => result.current.ocr.applyAnalysis('sess-1', analysis(fill('a', 'từ ảnh'))));
    expect(result.current.form.a).toBe('từ ảnh');
    expect(result.current.ocr.applied.map((p) => p.field)).toEqual(['a']);
    expect(result.current.ocr.bindingForSave()).toEqual({
      ocrPhienId: 'sess-1',
      ocrPhienBan: 'ana-1',
    });
  });

  it('sends nothing to bind when no reading was applied', () => {
    const { result } = setup();
    expect(result.current.ocr.bindingForSave()).toEqual({});
  });

  it('does not overwrite what the officer typed, and lists it as skipped', () => {
    const { result } = setup();
    act(() => result.current.setForm((f) => ({ ...f, a: 'gõ tay' })));
    act(() => result.current.ocr.applyAnalysis('s', analysis(fill('a', 'từ ảnh'))));
    expect(result.current.form.a).toBe('gõ tay');
    expect(result.current.ocr.skipped.map((s) => s.field)).toEqual(['a']);
  });

  it('keeps Save blocked while an orange field is unconfirmed, and unblocks it when confirmed', () => {
    const { result } = setup();
    act(() =>
      result.current.ocr.applyAnalysis(
        's',
        analysis(fill('a', '1', { policy: 'AI_FILL_MUST_CONFIRM' }), fill('b', '2')),
      ),
    );
    expect(result.current.ocr.blocksSave).toBe(true);
    expect(result.current.ocr.firstUnconfirmedField).toBe('a');
    act(() => result.current.ocr.confirm('a'));
    expect(result.current.ocr.blocksSave).toBe(false);
  });

  it('editing an orange field counts as the officer deciding it', () => {
    const { result } = setup();
    act(() =>
      result.current.ocr.applyAnalysis(
        's',
        analysis(fill('a', '1', { policy: 'AI_FILL_MUST_CONFIRM' })),
      ),
    );
    act(() => result.current.setForm((f) => ({ ...f, a: 'tôi sửa' })));
    expect(result.current.ocr.blocksSave).toBe(false);
  });

  it('undo puts back only what is still the filled value and reports the rest', () => {
    const { result } = setup({ a: 'mặc định', b: '', c: '' });
    act(() =>
      result.current.ocr.applyAnalysis('s', analysis(fill('a', 'x'), fill('b', 'y'))),
    );
    act(() => result.current.setForm((f) => ({ ...f, b: 'sau khi điền cán bộ sửa' })));
    let outcome: { conflicts: string[] } | undefined;
    act(() => {
      outcome = result.current.ocr.undo();
    });
    expect(result.current.form.a).toBe('mặc định');
    expect(result.current.form.b).toBe('sau khi điền cán bộ sửa');
    expect(outcome?.conflicts).toEqual(['b']);
    expect(result.current.ocr.applied).toEqual([]);
  });

  it('a second analysis refreshes what the first wrote but not what was typed since', () => {
    const { result } = setup();
    act(() => result.current.ocr.applyAnalysis('s', analysis(fill('a', 'lần 1'), fill('b', 'b1'))));
    act(() => result.current.setForm((f) => ({ ...f, b: 'cán bộ' })));
    act(() => result.current.ocr.applyAnalysis('s', analysis(fill('a', 'lần 2'), fill('b', 'b2'))));
    expect(result.current.form.a).toBe('lần 2');
    expect(result.current.form.b).toBe('cán bộ');
  });

  it('lets the officer take the value from the image for a field they had typed in', () => {
    const { result } = setup();
    act(() => result.current.setForm((f) => ({ ...f, a: 'gõ tay' })));
    act(() => result.current.ocr.applyAnalysis('s', analysis(fill('a', 'từ ảnh'))));
    expect(result.current.ocr.skipped.map((x) => x.field)).toEqual(['a']);

    act(() => result.current.ocr.takeSkippedValue('a'));

    expect(result.current.form.a).toBe('từ ảnh');
    expect(result.current.ocr.skipped).toEqual([]);
    expect(result.current.ocr.applied.map((p) => p.field)).toEqual(['a']);
    // and undo gives back what the officer had typed
    act(() => {
      result.current.ocr.undo();
    });
    expect(result.current.form.a).toBe('gõ tay');
  });

  it('unbind drops the link to the scans but keeps the fill tracked: values from the image still need confirming', () => {
    const { result } = setup();
    act(() =>
      result.current.ocr.applyAnalysis(
        's',
        analysis(fill('a', '1', { policy: 'AI_FILL_MUST_CONFIRM' })),
      ),
    );
    act(() => result.current.ocr.unbind());
    expect(result.current.ocr.bindingForSave()).toEqual({});
    expect(result.current.ocr.blocksSave).toBe(true);
    expect(result.current.ocr.applied).toHaveLength(1);
  });

  it('forget drops the link to the session, for a form the officer cleared', () => {
    const { result } = setup();
    act(() => result.current.ocr.applyAnalysis('s', analysis(fill('a', '1'))));
    act(() => result.current.ocr.forget());
    expect(result.current.ocr.bindingForSave()).toEqual({});
    expect(result.current.ocr.applied).toEqual([]);
  });
});
