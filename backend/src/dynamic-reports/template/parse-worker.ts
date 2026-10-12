import { parentPort, workerData } from 'worker_threads';
import * as ExcelJS from 'exceljs';
import { parseTemplate } from './parser';
import { extractGridModel } from './grid-extract';
import { readRawGridInfo } from './grid-raw';
import type { ParseTemplateResult } from './types';
import type { GridModel } from '../engine/grid-types';

/**
 * worker_threads entry point (spec §10 R6: "Parse trong worker_threads có
 * timeout → PARSE_TIMEOUT. Repo chưa từng dùng worker_threads"). Runs the
 * actual exceljs work in an isolated thread so a hostile/huge file can be
 * killed with `worker.terminate()` without touching the main event loop.
 * Never throws out of this module — every outcome, success or failure,
 * goes back to the caller as a `postMessage`, because an uncaught throw
 * inside a worker only emits an 'error' event on the Worker handle, which
 * `parse-in-worker.ts` also handles, but keeping both paths narrow here
 * means the caller only ever has to interpret ONE message shape.
 *
 * Two modes share the thread plumbing: `parse` (template upload / preview)
 * and `grid` (render-ready GridModel for the entry grid, G1).
 */

export interface WorkerSuccessMessage {
  ok: true;
  result: ParseTemplateResult | GridModel;
}

export interface WorkerFailureMessage {
  ok: false;
  error: { message: string; code?: string };
}

export type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

interface WorkerData {
  mode?: 'parse' | 'grid';
  buffer: Buffer;
  selectedSheetNames: string[];
}

async function buildGrid(buffer: Buffer, selectedSheetNames: string[]): Promise<GridModel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const raw = await readRawGridInfo(buffer);
  const present = workbook.worksheets.map((w) => w.name);
  // Keep the caller's order (it is the report's tab order); drop names the file lacks.
  const selected = selectedSheetNames.filter((n) => present.includes(n));
  const excluded = present.filter((n) => !selected.includes(n));
  return extractGridModel(workbook, { selectedSheets: selected, excludedSheets: excluded, raw });
}

async function run(): Promise<void> {
  const { mode, buffer, selectedSheetNames } = workerData as WorkerData;
  try {
    const result =
      mode === 'grid'
        ? await buildGrid(buffer, selectedSheetNames)
        : await parseTemplate(buffer, selectedSheetNames);
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
