import { bestEffortWithin } from './best-effort-within';

/**
 * Publishing must answer quickly: the proxy in front gives up after 90 seconds, and a publish that already
 * committed must not turn into a gateway timeout because making its periods took a while.
 */
describe('bestEffortWithin', () => {
  afterEach(() => jest.useRealTimers());

  it('resolves as soon as the work does', async () => {
    const onError = jest.fn();
    await expect(
      bestEffortWithin(Promise.resolve('x'), 1000, onError),
    ).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it('never rejects: a failure is handed to onError', async () => {
    const onError = jest.fn();
    await expect(
      bestEffortWithin(Promise.reject(new Error('boom')), 1000, onError),
    ).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    );
  });

  it('stops waiting after the budget while the work carries on, and a later failure is still reported once', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    let fail: (e: Error) => void = () => undefined;
    const slow = new Promise<void>((_, reject) => {
      fail = reject;
    });

    const waited = bestEffortWithin(slow, 15_000, onError);
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(waited).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    fail(new Error('late'));
    await jest.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'late' }),
    );
  });

  it('leaves no timer behind when the work finishes first', async () => {
    jest.useFakeTimers();
    await bestEffortWithin(Promise.resolve(), 15_000, jest.fn());
    expect(jest.getTimerCount()).toBe(0);
  });
});
