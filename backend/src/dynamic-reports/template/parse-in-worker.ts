import { Worker } from 'worker_threads';
import * as path from 'path';
import { TemplateLimitError } from './limits';
import { BoundedRunner } from './bounded-runner';
import type { ParseTemplateResult } from './types';
import type { GridModel } from '../engine/grid-types';
import type { EvaluateRequest, PeriodExportWorkerResult, WorkerMessage } from './parse-worker';
import type { FormulaOutcome } from '../engine/grid-workbook';
import type { TemplateExportRequest } from '../export/template-export';
import { PeriodExportTooLargeError } from '../export/period-export';
import type { PeriodExportRequest } from '../export/period-export';

/**
 * Main-thread side of the worker_threads isolation (spec §10 R6). Spawns
 * `parse-worker.ts`/`.js` (whichever this process actually runs as —
 * `.ts` under ts-node/ts-jest, `.js` once nest build compiles to `dist/`),
 * enforces a hard timeout via `worker.terminate()`, and re-hydrates the
 * handful of error codes callers need to branch on (TemplateLimitError)
 * instead of flattening every worker failure into a generic Error.
 *
 * Every worker run goes through ONE bounded runner (review OV9): a worker
 * holds a whole parsed workbook in memory, so concurrent cold requests,
 * uploads and a backfill must queue instead of each spawning their own.
 */

export class TemplateParseTimeoutError extends Error {
  /** Matches the mã lỗi table, spec §4.2: `PARSE_TIMEOUT`. */
  readonly code = 'PARSE_TIMEOUT';
  constructor(ms: number) {
    super(`Template parse timed out after ${ms}ms.`);
    this.name = 'TemplateParseTimeoutError';
  }
}

/** A drawing-size refusal from the grid extractor, re-hydrated across the thread boundary. */
export class GridTooLargeWorkerError extends Error {
  readonly code = 'GRID_TOO_LARGE';
  constructor(message: string) {
    super(message);
    this.name = 'GridTooLargeWorkerError';
  }
}

export const DEFAULT_PARSE_TIMEOUT_MS = 30_000;

/** At most this many worker threads at once, this many more waiting; the rest are refused. */
export const WORKER_MAX_CONCURRENT = 2;
export const WORKER_MAX_QUEUE = 50;
/** Old-generation heap ceiling for one worker; an over-large workbook dies alone instead of the host. */
const WORKER_MAX_OLD_GEN_MB = 768;

const runner = new BoundedRunner(WORKER_MAX_CONCURRENT, WORKER_MAX_QUEUE);

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
  if (error.code === 'GRID_TOO_LARGE') return new GridTooLargeWorkerError(error.message);
  if (error.code === 'EXPORT_TOO_LARGE') return new PeriodExportTooLargeError(error.message);
  return new Error(error.message);
}

/** The workbook bytes, or a function that fetches them once the job is admitted. */
export type WorkbookSource = Buffer | (() => Promise<Buffer>);

function runInWorker<T>(
  mode: 'parse' | 'grid' | 'export' | 'exportPeriod' | 'evaluate',
  source: WorkbookSource,
  selectedSheetNames: string[],
  timeoutMs: number,
  exportRequest?: TemplateExportRequest,
  evaluateRequest?: EvaluateRequest,
  periodExportRequest?: PeriodExportRequest,
): Promise<T> {
  return runner.run(async () => {
    // Fetched only now, inside the slot: a request that is queued — or refused
    // because the queue is full — never holds a copy of a 50 MB workbook.
    const buffer = typeof source === 'function' ? await source() : source;

    return new Promise<T>((resolve, reject) => {
      const isTs = path.extname(__filename) === '.ts';
      const worker = new Worker(workerFilePath(), {
        workerData: { mode, buffer, selectedSheetNames, exportRequest, evaluateRequest, periodExportRequest },
        execArgv: isTs ? ['-r', 'ts-node/register/transpile-only'] : [],
        resourceLimits: { maxOldGenerationSizeMb: WORKER_MAX_OLD_GEN_MB },
      });

      let settled = false;
      // The runner slot is held until the thread is actually gone: terminate()
      // is asynchronous, and settling first would let the next job start
      // while this one is still shutting down — more live threads than the limit.
      const finish = (outcome: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate().then(
          () => outcome(),
          () => outcome(), // a failed terminate must not swallow the real result
        );
      };

      // The clock starts when the worker does, not when the task queued.
      const timer = setTimeout(() => {
        finish(() => reject(new TemplateParseTimeoutError(timeoutMs)));
      }, timeoutMs);
      timer.unref?.();

      worker.once('message', (msg: WorkerMessage) => {
        finish(() => {
          if (msg.ok) resolve(msg.result as T);
          else reject(hydrateError(msg.error));
        });
      });

      worker.once('error', (err) => {
        finish(() => reject(err));
      });

      worker.once('exit', (code) => {
        // An exit nobody asked for (crash, OOM kill) before any answer.
        finish(() => reject(new Error(`Worker đóng (mã ${code}) mà không trả kết quả nào.`)));
      });
    });
  });
}
export function parseTemplateInWorker(
  buffer: WorkbookSource,
  selectedSheetNames: string[],
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<ParseTemplateResult> {
  return runInWorker<ParseTemplateResult>('parse', buffer, selectedSheetNames, timeoutMs);
}

/** Builds the render-ready GridModel of the selected sheets in an isolated, bounded worker. */
export function buildGridInWorker(
  buffer: WorkbookSource,
  selectedSheetNames: string[],
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<GridModel> {
  return runInWorker<GridModel>('grid', buffer, selectedSheetNames, timeoutMs);
}

/**
 * Fills the original template with a request's values in an isolated, bounded
 * worker and returns the finished .xlsx. The bytes cross the thread boundary as
 * a plain Uint8Array; the caller gets a Buffer.
 */
export async function exportTemplateInWorker(
  source: WorkbookSource,
  request: TemplateExportRequest,
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<Buffer> {
  const bytes = await runInWorker<Uint8Array>('export', source, [], timeoutMs, request);
  return Buffer.from(bytes);
}

/**
 * Works out every formula of a template for a set of values, in an isolated,
 * bounded worker. No workbook is read: the render model already carries every
 * constant and formula. The answer is a plain object (decimal strings, codes).
 */
export function evaluateFormulasInWorker(
  request: EvaluateRequest,
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<Record<string, FormulaOutcome>> {
  return runInWorker<Record<string, FormulaOutcome>>('evaluate', Buffer.alloc(0), [], timeoutMs, undefined, request);
}

/**
 * Builds a manager's file — the totals and every team in one workbook — in an isolated, bounded worker. The
 * workbook bytes are fetched once the job is admitted, like the single-team export.
 */
export async function exportPeriodInWorker(
  source: WorkbookSource,
  request: PeriodExportRequest,
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<{ buffer: Buffer; outcome: PeriodExportWorkerResult['outcome']; names: Map<string, string> }> {
  const built = await runInWorker<PeriodExportWorkerResult>(
    'exportPeriod',
    source,
    [],
    timeoutMs,
    undefined,
    undefined,
    request,
  );
  return { buffer: Buffer.from(built.buffer), outcome: built.outcome, names: new Map(built.names) };
}
