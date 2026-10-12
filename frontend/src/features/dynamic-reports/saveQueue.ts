/**
 * Serialises asynchronous tasks: a task starts only after every earlier task
 * has settled, whether it resolved or rejected.
 *
 * Why this exists (PR H0): the submission editor used to fire a save whenever
 * a blur, idle timer or paste happened, with no ordering between them. Two
 * saves in flight both read the same render-time revision, so the second one
 * conflicted with the first; and "Nộp" could run while a save was still
 * unacknowledged. Routing every save through one queue makes the revision
 * chain linear and gives submit a single promise to wait on.
 */
export interface SaveQueue {
  /** Runs `task` after all previously enqueued tasks settle; resolves with its result. */
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  /** Number of tasks that are queued or running. */
  readonly pending: number;
}

export function createSaveQueue(): SaveQueue {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      pending += 1;
      const result = tail.then(task);
      // `tail` must never reject, otherwise one failed save would wedge the
      // queue: later tasks chain onto a rejected promise and are skipped.
      tail = result.then(
        () => undefined,
        () => undefined,
      ).then(() => {
        pending -= 1;
      });
      return result;
    },
    get pending() {
      return pending;
    },
  };
}
