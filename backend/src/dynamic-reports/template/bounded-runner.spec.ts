import { BoundedRunner, RunnerBusyError } from './bounded-runner';

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((res) => {
    open = res;
  });
  return { promise, open };
}

describe('BoundedRunner', () => {
  it('never runs more than maxConcurrent tasks at once', async () => {
    const runner = new BoundedRunner(2, 10);
    let live = 0;
    let peak = 0;
    const gates = Array.from({ length: 6 }, () => gate());
    const jobs = gates.map((g) =>
      runner.run(async () => {
        live++;
        peak = Math.max(peak, live);
        await g.promise;
        live--;
      }),
    );
    await Promise.resolve();
    expect(runner.running).toBe(2);
    expect(runner.queued).toBe(4);
    for (const g of gates) {
      g.open();
      await Promise.resolve();
    }
    await Promise.all(jobs);
    expect(peak).toBe(2);
    expect(runner.running).toBe(0);
    expect(runner.queued).toBe(0);
  });

  it('refuses a task once the queue is full, immediately', async () => {
    const runner = new BoundedRunner(1, 1);
    const g = gate();
    const first = runner.run(() => g.promise);
    const second = runner.run(async () => 'queued');
    await expect(runner.run(async () => 'overflow')).rejects.toBeInstanceOf(RunnerBusyError);
    g.open();
    await first;
    await expect(second).resolves.toBe('queued');
  });

  it('a failing task releases its slot and does not wedge the queue', async () => {
    const runner = new BoundedRunner(1, 5);
    const failing = runner.run(async () => {
      throw new Error('boom');
    });
    const next = runner.run(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
    expect(runner.running).toBe(0);
  });

  it('runs queued tasks in arrival order', async () => {
    const runner = new BoundedRunner(1, 5);
    const order: number[] = [];
    const g = gate();
    const jobs = [
      runner.run(async () => {
        await g.promise;
        order.push(1);
      }),
      runner.run(async () => {
        order.push(2);
      }),
      runner.run(async () => {
        order.push(3);
      }),
    ];
    g.open();
    await Promise.all(jobs);
    expect(order).toEqual([1, 2, 3]);
  });

  it('returns each task its own result', async () => {
    const runner = new BoundedRunner(2, 5);
    const out = await Promise.all([1, 2, 3, 4].map((n) => runner.run(async () => n * n)));
    expect(out).toEqual([1, 4, 9, 16]);
  });

  it('clamps nonsense limits instead of deadlocking', async () => {
    const runner = new BoundedRunner(0, -3);
    await expect(runner.run(async () => 'works')).resolves.toBe('works');
  });
});
