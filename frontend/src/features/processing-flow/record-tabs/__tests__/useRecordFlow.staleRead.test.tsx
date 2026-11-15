import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ processingRecordApi: { get } }));

import { useRecordFlow } from '../useRecordFlow';
import { useRecordWrite } from '../useRecordWrite';
import { recFlow } from './fixtures';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

/** A read that started before a write and answers after it must never put an older revision over the newer one. */
describe('the flow of a record: an older read never overwrites a newer write', () => {
  it('a GET that answers revision 5 after a write answered revision 6 leaves revision 6 in the cache', async () => {
    let answerOldRead!: (v: ReturnType<typeof recFlow>) => void;
    get.mockReset();
    get.mockImplementationOnce(() => new Promise((resolve) => (answerOldRead = resolve)));
    const { wrapper } = setup();
    const { result } = renderHook(
      () => {
        const handle = useRecordFlow('PETITION', 'r1');
        return { handle, write: useRecordWrite('PETITION', 'r1', handle) };
      },
      { wrapper },
    );
    // The read is on its way (loading), the screen already holds nothing; a write answers revision 6 first.
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.write.run('complete:s1', async () => recFlow({ revision: 6 }));
    });
    expect(result.current.handle.flow?.revision).toBe(6);

    await act(async () => {
      answerOldRead(recFlow({ revision: 5 }));
    });
    expect(result.current.handle.flow?.revision).toBe(6);
  });

  it('a read that answers an OLDER revision than the cache is dropped even when the write came earlier', async () => {
    get.mockReset();
    get.mockResolvedValueOnce(recFlow({ revision: 6 })).mockResolvedValueOnce(recFlow({ revision: 5 }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useRecordFlow('PETITION', 'r1'), { wrapper });
    await waitFor(() => expect(result.current.flow?.revision).toBe(6));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.flow?.revision).toBe(6);
  });

  it('a newer revision from the server is taken', async () => {
    get.mockReset();
    get.mockResolvedValueOnce(recFlow({ revision: 5 })).mockResolvedValueOnce(recFlow({ revision: 7 }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useRecordFlow('PETITION', 'r1'), { wrapper });
    await waitFor(() => expect(result.current.flow?.revision).toBe(5));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.flow?.revision).toBe(7));
  });
  it('a flow made anew (another id, revision back to 1) is taken, not mistaken for a stale read', async () => {
    get.mockReset();
    get.mockResolvedValueOnce(recFlow({ revision: 6 })).mockResolvedValueOnce(recFlow({ id: 'rf2', revision: 1 }));
    const { wrapper } = setup();
    const { result } = renderHook(() => useRecordFlow('PETITION', 'r1'), { wrapper });
    await waitFor(() => expect(result.current.flow?.revision).toBe(6));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.flow?.id).toBe('rf2'));
  });
});
