import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModalLifecycle } from '../useModalLifecycle';

interface SampleArgs {
  recordId: string;
}
interface SampleResult {
  ok: boolean;
}

describe('useModalLifecycle', () => {
  it('starts in idle state (no args, not open, not loading, no error)', () => {
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({
        submitFn: vi.fn().mockResolvedValue({ ok: true }),
      }),
    );
    expect(result.current.args).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('open(args) sets args and isOpen=true', () => {
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({
        submitFn: vi.fn().mockResolvedValue({ ok: true }),
      }),
    );
    act(() => result.current.open({ recordId: 'R1' }));
    expect(result.current.args).toEqual({ recordId: 'R1' });
    expect(result.current.isOpen).toBe(true);
  });

  it('close() clears args and resets error', () => {
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({
        submitFn: vi.fn().mockResolvedValue({ ok: true }),
      }),
    );
    act(() => result.current.open({ recordId: 'R2' }));
    act(() => result.current.close());
    expect(result.current.args).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('submit(payload) calls submitFn with (args, payload) and sets loading then idle on success', async () => {
    const submitFn = vi.fn().mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult, { reason: string }>({
        submitFn,
        onSuccess,
      }),
    );
    act(() => result.current.open({ recordId: 'R3' }));
    await act(async () => {
      await result.current.submit({ reason: 'test' });
    });
    expect(submitFn).toHaveBeenCalledWith({ recordId: 'R3' }, { reason: 'test' });
    expect(onSuccess).toHaveBeenCalledWith({ ok: true }, { recordId: 'R3' });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('submit sets error message on failure with response.data.message', async () => {
    const submitFn = vi.fn().mockRejectedValue({
      response: { data: { message: 'Backend error' }, status: 400 },
    });
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({
        submitFn,
      }),
    );
    act(() => result.current.open({ recordId: 'R4' }));
    await act(async () => {
      await result.current.submit(undefined);
    });
    expect(result.current.error).toBe('Backend error');
    expect(result.current.isOpen).toBe(true); // modal stays open on error
    expect(result.current.isLoading).toBe(false);
  });

  it('submit sets generic error when no message in response', async () => {
    const submitFn = vi.fn().mockRejectedValue(new Error('Network down'));
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({ submitFn }),
    );
    act(() => result.current.open({ recordId: 'R5' }));
    await act(async () => {
      await result.current.submit(undefined);
    });
    expect(result.current.error).toMatch(/Network down|Lỗi/i);
    expect(result.current.isOpen).toBe(true);
  });

  it('isLoading is true during submitFn execution', async () => {
    let resolveSubmit: (value: SampleResult) => void;
    const submitFn = vi.fn().mockImplementation(
      () =>
        new Promise<SampleResult>((res) => {
          resolveSubmit = res;
        }),
    );
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({ submitFn }),
    );
    act(() => result.current.open({ recordId: 'R6' }));
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submit(undefined);
    });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    await act(async () => {
      resolveSubmit!({ ok: true });
      await submitPromise!;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('opening while another args set replaces args (cancels previous)', () => {
    const { result } = renderHook(() =>
      useModalLifecycle<SampleArgs, SampleResult>({
        submitFn: vi.fn().mockResolvedValue({ ok: true }),
      }),
    );
    act(() => result.current.open({ recordId: 'R7' }));
    act(() => result.current.open({ recordId: 'R8' }));
    expect(result.current.args).toEqual({ recordId: 'R8' });
  });
});
