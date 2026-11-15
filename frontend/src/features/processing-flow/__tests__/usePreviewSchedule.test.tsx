import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const preview = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ processingFlowApi: { previewSchedule: preview } }));

import { usePreviewSchedule } from '../usePreviewSchedule';
import type { PreviewScheduleBody, SchedulePreviewDto } from '../types';

const body = (name: string): PreviewScheduleBody => ({ recordKind: 'PETITION', steps: [{ name } as never] });
const result = (tag: string): SchedulePreviewDto => ({ steps: [], recordDeadline: tag, provisional: false, issues: [] });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  preview.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('the preview of the schedule', () => {
  it('waits 400 ms of quiet before asking, and asks once for a burst of edits', async () => {
    preview.mockResolvedValue(result('x'));
    const { rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('a') } });
    await act(async () => void vi.advanceTimersByTime(300));
    rerender({ b: body('ab') });
    await act(async () => void vi.advanceTimersByTime(300));
    rerender({ b: body('abc') });
    await act(async () => void vi.advanceTimersByTime(399));
    expect(preview).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(1));
    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview.mock.calls[0][0]).toEqual(body('abc'));
  });

  it('asks nothing while there is nothing to draw (null)', async () => {
    renderHook(() => usePreviewSchedule(null));
    await act(async () => void vi.advanceTimersByTime(2000));
    expect(preview).not.toHaveBeenCalled();
  });

  it('a stale answer never overwrites a newer one', async () => {
    const first = deferred<SchedulePreviewDto>();
    const second = deferred<SchedulePreviewDto>();
    preview.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result: hook, rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('a') } });
    await act(async () => void vi.advanceTimersByTime(400));
    expect(preview).toHaveBeenCalledTimes(1);

    rerender({ b: body('b') });
    await act(async () => void vi.advanceTimersByTime(400));
    expect(preview).toHaveBeenCalledTimes(2);

    // The NEWER request answers first, then the older one arrives late.
    await act(async () => second.resolve(result('newer')));
    expect(hook.current.data?.recordDeadline).toBe('newer');
    await act(async () => first.resolve(result('older')));
    expect(hook.current.data?.recordDeadline).toBe('newer');
  });

  it('cancels the request it has overtaken', async () => {
    preview.mockReturnValue(new Promise(() => undefined));
    const { rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('a') } });
    await act(async () => void vi.advanceTimersByTime(400));
    const signal = preview.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    rerender({ b: body('b') });
    expect(signal.aborted).toBe(true);
  });

  it('a stale ERROR does not replace a newer answer either', async () => {
    const first = deferred<SchedulePreviewDto>();
    const second = deferred<SchedulePreviewDto>();
    preview.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result: hook, rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('a') } });
    await act(async () => void vi.advanceTimersByTime(400));
    rerender({ b: body('b') });
    await act(async () => void vi.advanceTimersByTime(400));
    await act(async () => second.resolve(result('newer')));
    await act(async () => first.reject({ isAxiosError: true, response: { status: 400, data: { success: false, code: 'STEPS_INVALID', error: { code: 'STEPS_INVALID', message: 'x', details: [] } } } }));
    expect(hook.current.error).toBeNull();
    expect(hook.current.data?.recordDeadline).toBe('newer');
  });

  it('a failed request keeps the last good chart and reports the error in words', async () => {
    preview.mockResolvedValueOnce(result('good'));
    const { result: hook, rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('a') } });
    await act(async () => void vi.advanceTimersByTime(400));
    expect(hook.current.data?.recordDeadline).toBe('good');
    preview.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { success: false, code: 'STEPS_INVALID', error: { code: 'STEPS_INVALID', message: 'x', details: [] } } } });
    rerender({ b: body('b') });
    await act(async () => void vi.advanceTimersByTime(400));
    expect(hook.current.data?.recordDeadline).toBe('good');
    expect(hook.current.error?.code).toBe('STEPS_INVALID');
  });

  it('says which steps the kept chart was drawn for, so its bars are never labelled with steps that moved since (found by Codex)', async () => {
    preview.mockResolvedValueOnce(result('good'));
    const { result: hook, rerender } = renderHook(({ b }) => usePreviewSchedule(b), { initialProps: { b: body('first') } });
    await act(async () => void vi.advanceTimersByTime(400));
    expect(hook.current.answeredFor).toEqual(body('first'));
    preview.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400, data: { success: false, code: 'STEPS_INVALID', error: { code: 'STEPS_INVALID', message: 'x', details: [] } } } });
    rerender({ b: body('second') });
    await act(async () => void vi.advanceTimersByTime(400));
    // The old chart is still shown; it belongs to "first", not to what is on screen now.
    expect(hook.current.data?.recordDeadline).toBe('good');
    expect(hook.current.answeredFor).toEqual(body('first'));
  });

  it('has nothing to say about a body when there is nothing to draw', async () => {
    const { result: hook } = renderHook(() => usePreviewSchedule(null));
    expect(hook.current.answeredFor).toBeNull();
  });
});
