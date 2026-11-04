import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyFieldValue } from '@/features/legacy-form/types';
import type { FormAccess } from '../fillPlan';
import type { OcrAnalysisView } from '../ocrApi';

const api = vi.hoisted(() => ({ analysis: vi.fn(), cancel: vi.fn() }));
vi.mock('../ocrApi', () => ({ ocrApi: api }));
vi.mock('../useOcrAvailability', () => ({ useOcrAvailability: () => true }));

import { useOcrFormIntake } from '../useOcrFormIntake';

type Form = Record<string, LegacyFieldValue>;
const access: FormAccess<Form> = {
  read: (form, field) => form[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }),
};

const analysis = (...fills: Array<[string, string, boolean?]>): OcrAnalysisView => ({
  id: 'ana-1',
  entity: 'CASE',
  pageSetRevision: 1,
  inputFingerprint: 'fp',
  cleaned: {},
  issues: [],
  promptVersions: {},
  projection: {
    fills: fills.map(([field, value, confirm]) => ({
      field,
      value,
      policy: confirm ? ('AI_FILL_MUST_CONFIRM' as const) : ('AI_FILL' as const),
      provenance: { claimKind: 'QUOTED' as const, pageId: 'p1', quote: null },
      warnings: [],
    })),
    skips: [],
  },
});

const setup = (initial: Form = { a: '', b: '' }, toFormPath?: (field: string) => string) =>
  renderHook(() => {
    const [form, setForm] = useState<Form>(initial);
    const ocr = useOcrFormIntake({
      entity: 'CASE',
      access,
      form,
      setForm,
      baseline: initial,
      saved: false,
      toFormPath,
    });
    return { form, setForm, ocr };
  });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('useOcrFormIntake — drafts', () => {
  it('takes every field that was filled from the image out of a copy of the form, even one the officer then edited', () => {
    const { result } = setup({ a: 'mặc định', b: '' });
    act(() => result.current.ocr.fill.applyAnalysis('s1', analysis(['a', 'từ ảnh'], ['b', 'cũng từ ảnh'])));
    act(() => result.current.setForm((f) => ({ ...f, b: 'cán bộ sửa' })));
    const copy = result.current.ocr.withoutScanValues(result.current.form);
    // b was edited after the fill, but what the officer typed started from the image's text: it stays out of the browser too
    expect(copy).toEqual({ a: 'mặc định', b: '' });
    // the live form is untouched
    expect(result.current.form.a).toBe('từ ảnh');
  });

  it('sends, with the save, what became of each filled field: kept, edited or emptied, and never a value', () => {
    const { result } = setup({ a: '', b: '' });
    act(() => result.current.ocr.fill.applyAnalysis('s1', analysis(['a', 'giữ nguyên', true], ['b', 'sẽ sửa'])));
    act(() => result.current.setForm((f) => ({ ...f, b: 'đã sửa' })));
    const sent = result.current.ocr.bindingForSave();
    expect(sent.ocrKetQua).toEqual([
      { field: 'a', outcome: 'KEPT', mustConfirm: true },
      { field: 'b', outcome: 'EDITED', mustConfirm: false },
    ]);
    expect(JSON.stringify(sent.ocrKetQua)).not.toContain('giữ nguyên');
  });

  it('sends nothing when no scans were read', () => {
    const { result } = setup();
    expect(result.current.ocr.bindingForSave()).toEqual({});
  });

  it('names the session and analysis a draft should point to, or nothing when no scans were read', () => {
    const { result } = setup();
    expect(result.current.ocr.draftReference()).toBeUndefined();
    act(() => result.current.ocr.fill.applyAnalysis('s1', analysis(['a', 'x'])));
    expect(result.current.ocr.draftReference()).toEqual({ sessionId: 's1', analysisId: 'ana-1' });
  });

  it('restores a draft by fetching the analysis from the server again', async () => {
    api.analysis.mockResolvedValue(analysis(['a', 'từ ảnh', true]));
    const { result } = setup();
    await act(() => result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-1' }));
    expect(api.analysis).toHaveBeenCalledWith('s1');
    expect(result.current.form.a).toBe('từ ảnh');
    expect((result.current.ocr as Record<string, unknown>).saveBlockedMessage).toBeUndefined();
    expect(result.current.ocr.restoreNotice).toBeNull();
    expect(result.current.ocr.bindingForSave()).toMatchObject({ ocrPhienId: 's1', ocrPhienBan: 'ana-1' });
  });

  it('says so when the scans of a draft are gone or no longer match, and fills nothing', async () => {
    api.analysis.mockResolvedValue(null);
    const gone = setup();
    await act(() => gone.result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-1' }));
    expect(gone.result.current.form.a).toBe('');
    expect(gone.result.current.ocr.restoreNotice).toBe('UNAVAILABLE');

    api.analysis.mockRejectedValue({ response: { status: 404, data: { code: 'OCR_SESSION_NOT_FOUND' } } });
    const missing = setup();
    await act(() => missing.result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-1' }));
    await waitFor(() => expect(missing.result.current.ocr.restoreNotice).toBe('UNAVAILABLE'));
  });

  it('refuses a draft whose analysis has been replaced since: it would silently fill different values', async () => {
    api.analysis.mockResolvedValue(analysis(['a', 'giá trị của bản phân tích mới']));
    const { result } = setup();
    await act(() => result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-OLD' }));
    expect(result.current.form.a).toBe('');
    expect(result.current.ocr.restoreNotice).toBe('UNAVAILABLE');
    expect(result.current.ocr.bindingForSave()).toEqual({});
  });

  it('a draft discarded while its analysis was still loading is not filled in afterwards', async () => {
    let arrive: (v: unknown) => void = () => undefined;
    api.analysis.mockImplementation(() => new Promise((resolve) => (arrive = resolve)));
    const { result } = setup();
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-1' });
    });
    act(() => result.current.ocr.discardRestore());
    arrive(analysis(['a', 'đến muộn']));
    await act(async () => {
      await pending;
    });
    expect(result.current.form.a).toBe('');
    expect(result.current.ocr.bindingForSave()).toEqual({});
  });

  it('does nothing for a draft that never had scans', async () => {
    const { result } = setup();
    await act(() => result.current.ocr.restoreFromDraft(undefined));
    expect(api.analysis).not.toHaveBeenCalled();
    expect(result.current.ocr.restoreNotice).toBeNull();
  });
});

describe('useOcrFormIntake — field names', () => {
  // The server names fields as the shared layout does ("tenCungCap"); a form stores them under its own path
  // ("senderName"). The hook translates once, so everything after it speaks the form's names.
  const toPath = (field: string) => ({ tenCungCap: 'senderName', sdtCungCap: 'senderPhone' })[field] ?? field;

  it('maps the fills and the skipped fields of an analysis that comes from the server', async () => {
    api.analysis.mockResolvedValue({
      ...analysis(['tenCungCap', 'Nguyễn Thị Hương', true], ['sdtCungCap', '0901234567']),
    });
    const { result } = setup({ senderName: '', senderPhone: '' }, toPath);
    await act(() => result.current.ocr.restoreFromDraft({ sessionId: 's1', analysisId: 'ana-1' }));
    expect(result.current.form.senderName).toBe('Nguyễn Thị Hương');
    expect(result.current.form.senderPhone).toBe('0901234567');
    expect(result.current.ocr.fill.applied.map((p) => p.field).sort()).toEqual(['senderName', 'senderPhone']);
    expect(result.current.ocr.notes).toHaveProperty('senderName');
  });
});
