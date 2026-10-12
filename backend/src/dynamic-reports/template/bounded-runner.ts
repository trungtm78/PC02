/**
 * Runs at most `maxConcurrent` async tasks at once and queues up to
 * `maxQueue` more; anything beyond that is refused immediately instead of
 * piling up (review OV9). Worker threads each hold a whole parsed workbook
 * in memory, so letting every cold request or backfill step spawn its own
 * would let a burst of distinct versions exhaust the host.
 *
 * Pure scheduling, no Nest, no I/O.
 */
export class RunnerBusyError extends Error {
  readonly code = 'WORKER_POOL_BUSY';
  constructor() {
    super('Hàng đợi xử lý file mẫu đang đầy, thử lại sau ít giây.');
    this.name = 'RunnerBusyError';
  }
}

export class BoundedRunner {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  private readonly maxConcurrent: number;
  private readonly maxQueue: number;

  constructor(maxConcurrent: number, maxQueue: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.maxQueue = Math.max(0, maxQueue);
  }

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      if (this.waiting.length >= this.maxQueue) throw new RunnerBusyError();
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      // Claim the slot synchronously so two callers in the same tick cannot both pass.
      this.active += 1;
    }
    // A waiter is handed the slot by `release`, which keeps `active` unchanged.
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next(); // pass the slot on without dropping `active`
    else this.active -= 1;
  }
}
