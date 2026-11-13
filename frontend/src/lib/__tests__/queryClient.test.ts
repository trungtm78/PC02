import { describe, expect, it } from 'vitest';
import { createAppQueryClient } from '../queryClient';

/**
 * The report module's screens show figures that other people change (an editor saves, a manager returns or approves),
 * so a copy kept for five minutes made a reopened screen show old values, an old revision and an old "editable". The
 * rest of the app keeps its five-minute cache.
 */
describe('createAppQueryClient', () => {
  it('keeps the five-minute cache for everything that is not a report screen', () => {
    const client = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
    expect(client.getQueryDefaults(['officers', 'options']).gcTime).toBeUndefined();
  });

  it.each([
    ['submission', ['dynamic-reports', 'submission', 'a1']],
    ['submission-review', ['dynamic-reports', 'submission-review', 'a1']],
    ['period-summary', ['dynamic-reports', 'period-summary', 'p1', 'SUBMITTED']],
    ['status', ['dynamic-reports', 'status', { page: 1 }]],
    ['unlock-requests', ['dynamic-reports', 'unlock-requests']],
    ['period-assignments', ['dynamic-reports', 'period-assignments', 'p1']],
  ])('a report query (%s) is never served from an old copy', (_name, key) => {
    const defaults = createAppQueryClient().getQueryDefaults(key);
    expect(defaults.staleTime).toBe(0);
    expect(defaults.gcTime).toBe(0);
  });

  it('a report query is gone from the cache once nothing shows it, so reopening the screen fetches again', async () => {
    const client = createAppQueryClient();
    await client.prefetchQuery({ queryKey: ['dynamic-reports', 'submission', 'a1'], queryFn: () => 'old' });
    await client.prefetchQuery({ queryKey: ['officers', 'options'], queryFn: () => 'kept' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.getQueryData(['dynamic-reports', 'submission', 'a1'])).toBeUndefined();
    expect(client.getQueryData(['officers', 'options'])).toBe('kept');
  });

  it('the input grid is not refetched while someone is typing (window focus), the read-only screens are', () => {
    const client = createAppQueryClient();
    expect(client.getQueryDefaults(['dynamic-reports', 'submission', 'a1']).refetchOnWindowFocus).toBe(false);
    expect(client.getQueryDefaults(['dynamic-reports', 'period-summary', 'p1']).refetchOnWindowFocus).toBeUndefined();
  });
});
