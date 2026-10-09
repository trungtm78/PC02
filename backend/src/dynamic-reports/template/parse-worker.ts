import { parentPort, workerData } from 'worker_threads';
import { parseTemplate } from './parser';
import type { ParseTemplateResult } from './types';

/**
 * worker_threads entry point (spec §10 R6: "Parse trong worker_threads có
 * timeout → PARSE_TIMEOUT. Repo chưa từng dùng worker_threads"). Runs the
 * actual exceljs parse in an isolated thread so a hostile/huge file can be
 * killed with `worker.terminate()` without touching the main event loop.
 * Never throws out of this module — every outcome, success or failure,
 * goes back to the caller as a `postMessage`, because an uncaught throw
 * inside a worker only emits an 'error' event on the Worker handle, which
 * `parse-in-worker.ts` also handles, but keeping both paths narrow here
 * means the caller only ever has to interpret ONE message shape.
 */

export interface WorkerSuccessMessage {
  ok: true;
  result: ParseTemplateResult;
}

export interface WorkerFailureMessage {
  ok: false;
  error: { message: string; code?: string };
}

export type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

interface ParseWorkerData {
  buffer: Buffer;
  selectedSheetNames: string[];
}

async function run(): Promise<void> {
  const { buffer, selectedSheetNames } = workerData as ParseWorkerData;
  try {
    const result = await parseTemplate(buffer, selectedSheetNames);
    const message: WorkerSuccessMessage = { ok: true, result };
    parentPort?.postMessage(message);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code: unknown }).code)
        : undefined;
    const message: WorkerFailureMessage = {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
        code,
      },
    };
    parentPort?.postMessage(message);
  }
}

void run();
