import type { OcrJob } from '@prisma/client';
import { OcrImportError } from '../ocr-import-error';
import { HttpStatus } from '@nestjs/common';
import { OcrJobRunner } from './ocr-job-runner';

const job = (id: string): OcrJob =>
  ({
    id,
    sessionId: `s-${id}`,
    kind: 'READ',
    createdById: 'u',
    claimedBy: 'w-test',
    attempts: 1,
  }) as OcrJob;

function setup(
  options: {
    enabled?: boolean;
    maxRunning?: number;
    heartbeatMs?: number;
  } = {},
) {
  const pending: OcrJob[] = [];
  const queue = {
    claim: jest.fn(() => Promise.resolve(pending.shift() ?? null)),
    complete: jest.fn(() => Promise.resolve()),
    heartbeat: jest.fn(() => Promise.resolve()),
    fail: jest.fn(() => Promise.resolve()),
    recoverStuck: jest.fn(() => Promise.resolve({ requeued: 0, failed: 0 })),
  };
  const executor = {
    execute: jest.fn<Promise<void>, [OcrJob]>(() => Promise.resolve()),
  };
  const flags = {
    isEnabled: jest.fn(() => Promise.resolve(options.enabled ?? true)),
  };
  const runner = new OcrJobRunner(
    queue as never,
    executor as never,
    flags as never,
    {
      maxRunning: options.maxRunning ?? 2,
      workerId: 'w-test',
      heartbeatMs: options.heartbeatMs ?? 60_000,
    },
  );
  return { runner, queue, executor, flags, pending };
}

describe('OcrJobRunner', () => {
  it('does nothing while the feature is off', async () => {
    const { runner, queue, pending } = setup({ enabled: false });
    pending.push(job('a'));
    expect(await runner.pump()).toBe(0);
    expect(queue.claim).not.toHaveBeenCalled();
    expect(queue.recoverStuck).not.toHaveBeenCalled();
  });

  it('runs the OCR_RUNNER=off kill switch without touching the queue', async () => {
    process.env.OCR_RUNNER = 'off';
    try {
      const { runner, queue, flags } = setup();
      expect(await runner.pump()).toBe(0);
      expect(flags.isEnabled).not.toHaveBeenCalled();
      expect(queue.claim).not.toHaveBeenCalled();
    } finally {
      delete process.env.OCR_RUNNER;
    }
  });

  it('claims work, executes it and marks it complete', async () => {
    const { runner, queue, executor, pending } = setup();
    pending.push(job('a'));
    expect(await runner.pump()).toBe(1);
    await runner.idle();
    expect(queue.claim).toHaveBeenCalledWith('w-test', { maxRunning: 2 });
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
    );
    expect(queue.complete).toHaveBeenCalledWith('a', {
      workerId: 'w-test',
      attempt: 1,
    });
    expect(queue.fail).not.toHaveBeenCalled();
  });

  it('records a failure with its code and whether to retry', async () => {
    const { runner, queue, executor, pending } = setup();
    pending.push(job('a'), job('b'));
    executor.execute
      .mockRejectedValueOnce(
        new OcrImportError('OCR_NO_PAGES', HttpStatus.CONFLICT),
      )
      .mockRejectedValueOnce(new Error('boom'));
    await runner.pump();
    await runner.idle();
    const token = { workerId: 'w-test', attempt: 1 };
    expect(queue.fail).toHaveBeenCalledWith(
      'a',
      'OCR_NO_PAGES',
      { retryable: false },
      token,
    );
    expect(queue.fail).toHaveBeenCalledWith(
      'b',
      'INTERNAL',
      { retryable: true },
      token,
    );
    expect(queue.complete).not.toHaveBeenCalled();
  });

  it("never has more of this server's jobs in flight than the cap, and picks up more as they finish", async () => {
    const { runner, executor, pending } = setup({ maxRunning: 2 });
    const release: Array<() => void> = [];
    executor.execute.mockImplementation(
      () =>
        new Promise<undefined>((resolve) =>
          release.push(() => resolve(undefined)),
        ),
    );
    pending.push(job('a'), job('b'), job('c'));
    expect(await runner.pump()).toBe(2);
    expect(await runner.pump()).toBe(0); // full
    release.shift()!();
    await new Promise((r) => setImmediate(r));
    expect(await runner.pump()).toBe(1);
    release.forEach((r) => r());
    await runner.idle();
  });

  it('keeps telling the queue a slow job is alive, and stops once it is done', async () => {
    const { runner, queue, executor, pending } = setup({ heartbeatMs: 5 });
    let finish: () => void = () => undefined;
    executor.execute.mockImplementation(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    pending.push(job('a'));
    await runner.pump();
    await new Promise((r) => setTimeout(r, 40));
    expect(queue.heartbeat).toHaveBeenCalledWith('a', {
      workerId: 'w-test',
      attempt: 1,
    });
    finish();
    await runner.idle();
    const beats = queue.heartbeat.mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(queue.heartbeat.mock.calls.length).toBe(beats);
  });

  it('puts stranded jobs back in the queue, at most once a minute', async () => {
    const { runner, queue } = setup();
    await runner.pump();
    await runner.pump();
    expect(queue.recoverStuck).toHaveBeenCalledTimes(1);
  });

  it('a queue error is swallowed so the next tick can try again', async () => {
    const { runner, queue } = setup();
    queue.claim.mockRejectedValueOnce(new Error('db down'));
    await expect(runner.pump()).resolves.toBe(0);
  });
});
