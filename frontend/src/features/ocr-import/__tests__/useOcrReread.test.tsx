import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyFieldValue } from '@/features/legacy-form/types';
import type { FormAccess, ProjectionFill } from '../fillPlan';
import type { OcrAnalysisView, OcrJobView } from '../ocrApi';

const api = vi.hoisted(() => ({
  startReread: vi.fn(),
  job: vi.fn(),
  analysis: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../ocrApi', () => ({ ocrApi: api }));

import { useOcrReread } from '../useOcrReread';

type Form = Record<string, LegacyFieldValue>;
const access: FormAccess<Form> = {
  read: (form, field) => form[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }),
};

const fill = (field: string, value: string, confirm = false): ProjectionFill => ({
  field,
  value,
  policy: confirm ? 'AI_FILL_MUST_CONFIRM' : 'AI_FILL',
  provenance: { claimKind: 'QUOTED', pageId: 'p1', quote: 'trích' },
  warnings: [],
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

const job = (
  state: OcrJobView['state'],
  lastErrorCode: string | null = null,
  stage: OcrJobView['stage'] = null,
): OcrJobView => ({
  id: 'j1', kind: 'READ', state, attempts: 1, lastErrorCode, stage,
  createdAt: '2026-11-03T00:00:00Z', finishedAt: null,
});

const setup = (initial: Form, toFormPath?: (f: string) => string) =>
  renderHook(() => {
    const [form, setForm] = useState<Form>(initial);
    const reread = useOcrReread({
      entity: 'PETITION',
      recordId: 'pet-1',
      access,
      form,
      setForm,
      toFormPath,
      pollMs: 5,
    });
    return { form, setForm, reread };
  });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.startReread.mockResolvedValue({ sessionId: 's1', jobId: 'j1', pages: 2 });
  api.job.mockResolvedValue(job('SUCCEEDED'));
  api.cancel.mockResolvedValue(undefined);
});

describe('useOcrReread', () => {
  it('starts a re-read of the saved record, follows the job, and lists only the fields whose value differs', async () => {
    api.analysis.mockResolvedValue(
      analysis(fill('a', 'giống nhau'), fill('b', 'giá trị mới'), fill('c', 'điền mới', true)),
    );
    const { result } = setup({ a: 'giống nhau', b: 'giá trị cũ', c: '' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));

    expect(api.startReread).toHaveBeenCalledWith('PETITION', 'pet-1');
    expect(result.current.reread.sameCount).toBe(1);
    expect(result.current.reread.differences.map((d) => [d.field, d.current, d.proposed, d.orange])).toEqual([
      ['b', 'giá trị cũ', 'giá trị mới', false],
      ['c', '', 'điền mới', true],
    ]);
  });

  it('applying one difference changes only that field of the form, and does not save anything', async () => {
    api.analysis.mockResolvedValue(analysis(fill('b', 'giá trị mới'), fill('c', 'khác')));
    const { result } = setup({ b: 'cũ', c: 'cũ c' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));

    act(() => result.current.reread.apply('b'));

    expect(result.current.form).toEqual({ b: 'giá trị mới', c: 'cũ c' });
    expect(result.current.reread.differences.map((d) => d.field)).toEqual(['c']);
    expect(result.current.reread.appliedCount).toBe(1);
  });

  it('skipping a difference leaves the form alone and removes it from the list', async () => {
    api.analysis.mockResolvedValue(analysis(fill('b', 'mới')));
    const { result } = setup({ b: 'cũ' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));
    act(() => result.current.reread.skip('b'));
    expect(result.current.form.b).toBe('cũ');
    expect(result.current.reread.differences).toEqual([]);
  });

  it('compares and writes under the form\'s own field names', async () => {
    api.analysis.mockResolvedValue(analysis(fill('tenCungCap', 'Nguyễn Thị Hương')));
    const { result } = setup({ senderName: 'Nguyen Thi Huong' }, (f) => (f === 'tenCungCap' ? 'senderName' : f));
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));
    expect(result.current.reread.differences[0]).toMatchObject({ field: 'senderName', current: 'Nguyen Thi Huong' });
    act(() => result.current.reread.apply('senderName'));
    expect(result.current.form.senderName).toBe('Nguyễn Thị Hương');
  });

  it('reports a refusal to start, by its code', async () => {
    api.startReread.mockRejectedValue({ response: { status: 409, data: { code: 'OCR_NO_PAGES' } } });
    const { result } = setup({ a: '' });
    await act(() => result.current.reread.start());
    expect(result.current.reread.phase).toBe('ERROR');
    expect(result.current.reread.errorCode).toBe('OCR_NO_PAGES');
  });

  it('reports a failed reading by the code the job ended with', async () => {
    api.job.mockResolvedValue(job('FAILED', 'LLM_BUDGET_EXHAUSTED'));
    const { result } = setup({ a: '' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('ERROR'));
    expect(result.current.reread.errorCode).toBe('LLM_BUDGET_EXHAUSTED');
  });

  it('an answer that arrives after the reading was closed does not set a step', async () => {
    let late: (() => void) | undefined;
    api.job.mockImplementation(
      () =>
        new Promise((resolve) => {
          late = () => resolve(job('RUNNING', null, 'ANALYSING'));
        }),
    );
    const { result } = setup({ b: 'cũ' });
    act(() => {
      void result.current.reread.start();
    });
    await waitFor(() => expect(late).toBeDefined());

    await act(() => result.current.reread.close());
    await act(async () => late?.());

    expect(result.current.reread.stage).toBeNull();
  });

  it('closing deletes the temporary session so no copy of the scans stays on the server', async () => {
    api.analysis.mockResolvedValue(analysis(fill('b', 'mới')));
    const { result } = setup({ b: 'cũ' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));
    await act(() => result.current.reread.close());
    expect(api.cancel).toHaveBeenCalledWith('s1');
    expect(result.current.reread.phase).toBe('IDLE');
    expect(result.current.reread.differences).toEqual([]);
  });

  it('starting a second reading deletes the first session instead of leaving its scans on the server', async () => {
    api.startReread
      .mockResolvedValueOnce({ sessionId: 's-first', jobId: 'j1', pages: 1 })
      .mockResolvedValueOnce({ sessionId: 's-second', jobId: 'j2', pages: 1 });
    api.analysis.mockResolvedValue(analysis(fill('a', 'x')));
    const { result } = setup({ a: '' });
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));
    await act(() => result.current.reread.start());
    await waitFor(() => expect(result.current.reread.phase).toBe('DONE'));
    expect(api.cancel).toHaveBeenCalledWith('s-first');
    expect(api.cancel).not.toHaveBeenCalledWith('s-second');
  });

  it('leaving the screen deletes the session and stops polling', async () => {
    api.job.mockResolvedValue(job('RUNNING'));
    const { result, unmount } = setup({ a: '' });
    act(() => {
      void result.current.reread.start();
    });
    await waitFor(() => expect(api.job).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('s1'));
    const polls = api.job.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(api.job.mock.calls.length).toBeLessThanOrEqual(polls + 1);
    expect(api.analysis).not.toHaveBeenCalled();
  });

  it('a session that finished setting up after the reading was closed is deleted at once', async () => {
    let release!: (value: { sessionId: string; jobId: string; pages: number }) => void;
    api.startReread.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result } = setup({ a: '' });
    act(() => {
      void result.current.reread.start();
    });
    await act(() => result.current.reread.close());
    release({ sessionId: 's-late', jobId: 'j9', pages: 1 });
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('s-late'));
  });
});
