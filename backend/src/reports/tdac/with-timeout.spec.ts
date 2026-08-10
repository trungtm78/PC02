import { withTimeout } from './tdac.service';

/**
 * The timeout guard leaked its timer: `Promise.race` discards the loser but
 * does not cancel it, so a query that returned in 20ms still left a live
 * handle for the full timeout window. Jest reported it once per run as
 * "A worker process has failed to exit gracefully" — a warning that says
 * nothing about which timer, which is why it sat unread for months.
 *
 * `getTimerCount()` is the assertion that actually catches it. Asserting only
 * on the resolved value passes with the leak still in place.
 */
describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('leaves no pending timer once the operation wins', async () => {
    const p = withTimeout(Promise.resolve('ok'), 30_000, 'q');

    await expect(p).resolves.toBe('ok');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves no pending timer once the operation fails', async () => {
    const p = withTimeout(Promise.reject(new Error('boom')), 30_000, 'q');

    await expect(p).rejects.toThrow('boom');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('still rejects with the labelled message when the timeout wins', async () => {
    // Never settles on its own — only the timer can resolve this race.
    const p = withTimeout(new Promise(() => {}), 5_000, 'tong-hop-vu-an');

    jest.advanceTimersByTime(5_000);

    await expect(p).rejects.toThrow('Query timeout: tong-hop-vu-an');
    expect(jest.getTimerCount()).toBe(0);
  });
});
