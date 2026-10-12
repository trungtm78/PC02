import { describe, it, expect } from 'vitest';
import { createSaveQueue } from '../saveQueue';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSaveQueue', () => {
  it('starts a task only after the previous one has settled', async () => {
    const queue = createSaveQueue();
    const order: string[] = [];
    const first = deferred<string>();

    const a = queue.enqueue(async () => {
      order.push('a:start');
      const v = await first.promise;
      order.push('a:end');
      return v;
    });
    const b = queue.enqueue(async () => {
      order.push('b:start');
      return 'b';
    });

    await Promise.resolve();
    expect(order).toEqual(['a:start']);

    first.resolve('a');
    expect(await a).toBe('a');
    expect(await b).toBe('b');
    expect(order).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('keeps running later tasks after an earlier one rejects', async () => {
    const queue = createSaveQueue();
    const failing = queue.enqueue(async () => {
      throw new Error('boom');
    });
    const next = queue.enqueue(async () => 'still ran');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('still ran');
  });

  it('reports how many tasks are queued or running', async () => {
    const queue = createSaveQueue();
    const gate = deferred<void>();
    expect(queue.pending).toBe(0);

    const a = queue.enqueue(() => gate.promise);
    const b = queue.enqueue(async () => undefined);
    expect(queue.pending).toBe(2);

    gate.resolve();
    await Promise.all([a, b]);
    await Promise.resolve();
    expect(queue.pending).toBe(0);
  });

  it('hands each task its own result even when enqueued back to back', async () => {
    const queue = createSaveQueue();
    const results = await Promise.all([1, 2, 3].map((n) => queue.enqueue(async () => n * 10)));
    expect(results).toEqual([10, 20, 30]);
  });
});
