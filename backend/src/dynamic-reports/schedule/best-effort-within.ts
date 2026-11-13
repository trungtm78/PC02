/**
 * Waits for `work` for at most `ms`, and never rejects.
 *
 * For what happens AFTER a request's real job is done and committed (making a just-published report's periods): the
 * answer must not wait on it for long, because the proxy in front gives up after 90 seconds and a publish that already
 * committed must not turn into a gateway timeout. If the work is slower than the budget the request answers anyway and
 * the work carries on; a failure, early or late, goes to `onError` once and is never an unhandled rejection.
 */
export async function bestEffortWithin(
  work: Promise<unknown>,
  ms: number,
  onError: (error: unknown) => void,
): Promise<void> {
  const guarded = Promise.resolve(work).then(
    () => undefined,
    (error: unknown) => {
      onError(error);
    },
  );
  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([guarded, budget]);
  } finally {
    clearTimeout(timer);
  }
}
