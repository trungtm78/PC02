import { Worker } from 'worker_threads';
import * as path from 'path';
import { TemplateLimitError } from './limits';
import type { ParseTemplateResult } from './types';
import type { WorkerMessage } from './parse-worker';

/**
 * Main-thread side of the worker_threads isolation (spec §10 R6). Spawns
 * `parse-worker.ts`/`.js` (whichever this process actually runs as —
 * `.ts` under ts-node/ts-jest, `.js` once nest build compiles to `dist/`),
 * enforces a hard timeout via `worker.terminate()`, and re-hydrates the
 * handful of error codes callers need to branch on (TemplateLimitError)
 * instead of flattening every worker failure into a generic Error.
 */

export class TemplateParseTimeoutError extends Error {
  constructor(ms: number) {
    super(`Template parse timed out after ${ms}ms.`);
    this.name = 'TemplateParseTimeoutError';
  }
}

export const DEFAULT_PARSE_TIMEOUT_MS = 30_000;

function workerFilePath(): string {
  const isTs = path.extname(__filename) === '.ts';
  return path.join(__dirname, `parse-worker${isTs ? '.ts' : '.js'}`);
}

function hydrateError(error: { message: string; code?: string }): Error {
  if (
    error.code === 'TOO_MANY_SELECTED_SHEETS' ||
    error.code === 'TOO_MANY_CELLS' ||
    error.code === 'TOO_MANY_INPUT_CELLS'
  ) {
    return new TemplateLimitError(error.message, error.code);
  }
  return new Error(error.message);
}

export function parseTemplateInWorker(
  buffer: Buffer,
  selectedSheetNames: string[],
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<ParseTemplateResult> {
  return new Promise((resolve, reject) => {
    const isTs = path.extname(__filename) === '.ts';
    const worker = new Worker(workerFilePath(), {
      workerData: { buffer, selectedSheetNames },
      execArgv: isTs ? ['-r', 'ts-node/register/transpile-only'] : [],
    });

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => {
        void worker.terminate();
        reject(new TemplateParseTimeoutError(timeoutMs));
      });
    }, timeoutMs);
    timer.unref?.();

    worker.once('message', (msg: WorkerMessage) => {
      settle(() => {
        void worker.terminate();
        if (msg.ok) resolve(msg.result);
        else reject(hydrateError(msg.error));
      });
    });

    worker.once('error', (err) => {
      settle(() => reject(err));
    });

    worker.once('exit', (code) => {
      settle(() =>
        reject(new Error(`Worker đóng (mã ${code}) mà không trả kết quả nào.`)),
      );
    });
  });
}
