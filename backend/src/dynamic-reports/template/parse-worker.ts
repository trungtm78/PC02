import { parentPort, workerData } from 'worker_threads';
import * as ExcelJS from 'exceljs';
import { parseTemplate } from './parser';
import { extractGridModel } from './grid-extract';
import { readRawGridInfo } from './grid-raw';
import type { ParseTemplateResult } from './types';
import type { GridModel } from '../engine/grid-types';
import { buildTemplateWorkbook } from '../export/template-export';
import type { TemplateExportRequest } from '../export/template-export';
import { buildPeriodWorkbook } from '../export/period-export';
import type { PeriodExportOutcome, PeriodExportRequest } from '../export/period-export';
import { evaluateAllFormulas } from '../engine/grid-workbook';
import type { FormulaOutcome, InputFieldRef } from '../engine/grid-workbook';

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
 * Five modes share the thread plumbing (`evaluate` works out every formula of a template for a set of values — no file involved): `parse` (template upload / preview),
 * `grid` (render-ready GridModel for the entry grid, G1), `export` (the
 * template filled in with a team's values, G5a) and `exportPeriod` (a manager's
 * file: the totals and every team in one workbook, G5b).
 */

/** A manager's file, and what is worth knowing about how it was built. */
export interface PeriodExportWorkerResult {
  buffer: Uint8Array;
  outcome: PeriodExportOutcome;
  /** (scope, original sheet) → exported sheet name, as [key, name] pairs. */
  names: Array<[string, string]>;
}

export interface WorkerSuccessMessage {
  ok: true;
  result:
    | ParseTemplateResult
    | GridModel
    | Uint8Array
    | Record<string, FormulaOutcome>
    | PeriodExportWorkerResult;
}

export interface WorkerFailureMessage {
  ok: false;
  error: { message: string; code?: string };
}

export type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

export interface EvaluateRequest {
  grid: GridModel;
  fields: InputFieldRef[];
  values: Record<string, string | null>;
  blankAs: 'blank' | 'none';
}

interface WorkerData {
  mode?: 'parse' | 'grid' | 'export' | 'exportPeriod' | 'evaluate';
  buffer: Buffer;
  selectedSheetNames: string[];
  exportRequest?: TemplateExportRequest;
  periodExportRequest?: PeriodExportRequest;
  evaluateRequest?: EvaluateRequest;
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
  const { mode, buffer, selectedSheetNames, exportRequest, periodExportRequest, evaluateRequest } =
    workerData as WorkerData;
  try {
    let result: WorkerSuccessMessage['result'];
    if (mode === 'evaluate') {
      if (!evaluateRequest) throw new Error('Thiếu yêu cầu tính công thức.');
      const { grid, fields, values, blankAs } = evaluateRequest;
      result = evaluateAllFormulas(grid, fields, values, blankAs);
    } else if (mode === 'exportPeriod') {
      if (!periodExportRequest) throw new Error('Thiếu yêu cầu xuất file tổng hợp.');
      const built = await buildPeriodWorkbook(buffer, periodExportRequest);
      result = { buffer: built.buffer, outcome: built.outcome, names: [...built.names.entries()] };
    } else if (mode === 'export') {
      if (!exportRequest) throw new Error('Thiếu yêu cầu xuất file.');
      result = (await buildTemplateWorkbook(buffer, exportRequest)).buffer;
    } else if (mode === 'grid') {
      result = await buildGrid(buffer, selectedSheetNames);
    } else {
      result = await parseTemplate(buffer, selectedSheetNames);
    }
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
