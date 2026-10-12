import * as threads from 'worker_threads';

// Counts worker threads that are alive at once, so the concurrency limit is
// proven against real threads rather than assumed from the scheduler.
const liveWorkers = { current: 0, peak: 0 };
jest.mock('worker_threads', () => {
  const actual = jest.requireActual('worker_threads') as typeof import('worker_threads');
  class CountingWorker extends actual.Worker {
    constructor(...args: ConstructorParameters<typeof actual.Worker>) {
      super(...args);
      liveWorkers.current += 1;
      liveWorkers.peak = Math.max(liveWorkers.peak, liveWorkers.current);
      this.once('exit', () => {
        liveWorkers.current -= 1;
      });
    }
  }
  return { ...actual, Worker: CountingWorker };
});
void threads;
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  buildGridInWorker,
  evaluateFormulasInWorker,
  parseTemplateInWorker,
  TemplateParseTimeoutError,
} from './parse-in-worker';
import { parseTemplate } from './parser';
import { evaluateAllFormulas } from '../engine/grid-workbook';
import { TemplateLimitError } from './limits';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/dynamic-reports');

function readFixture(relPath: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, relPath));
}

/**
 * worker_threads isolation (spec §10 R6) — the repo's first use of
 * worker_threads, so every outcome is verified against a REAL spawned
 * worker, not mocked. Each test spawns an actual thread; expect these to
 * be slower (worker startup) than the in-process parser.spec.ts suite.
 */
describe('parseTemplateInWorker', () => {
  jest.setTimeout(20_000);

  it('round-trips a real fixture to the exact same result as calling parseTemplate directly in-process', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    const direct = await parseTemplate(buffer, ['Đội 3']);
    const viaWorker = await parseTemplateInWorker(buffer, ['Đội 3']);
    expect(viaWorker).toEqual(direct);
  });

  it('propagates a TemplateLimitError (with its code) across the worker boundary, not a generic Error', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    await expect(
      parseTemplateInWorker(buffer, [
        'Đội 3',
        'Đội 4',
        'Đội 5',
        'Đội 6',
        'Đội 7',
        'Đội 8',
      ]),
    ).rejects.toMatchObject({
      constructor: TemplateLimitError,
      code: 'TOO_MANY_SELECTED_SHEETS',
    });
  });

  it('terminates the worker and rejects with TemplateParseTimeoutError when the timeout is hit', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    // 1ms is shorter than worker thread startup itself — guarantees the
    // timeout fires before the worker can ever post a result, without
    // needing an artificially huge/slow fixture to force a real timeout.
    await expect(
      parseTemplateInWorker(buffer, ['Đội 3'], 1),
    ).rejects.toMatchObject({
      constructor: TemplateParseTimeoutError,
      code: 'PARSE_TIMEOUT',
    });
  });

  it('rejects (does not hang) when given a buffer that is not a valid xlsx at all', async () => {
    const buffer = Buffer.from('not an xlsx file');
    await expect(
      parseTemplateInWorker(buffer, ['Sheet1']),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe('buildGridInWorker', () => {
  jest.setTimeout(30_000);

  it('builds the same GridModel in a worker as in-process, marking unselected sheets as excluded', async () => {
    const buffer = readFixture('real/pl7.xlsx');
    const model = await buildGridInWorker(buffer, ['Thống kê sl vụ việc']);
    expect(model.sheetOrder).toEqual(['Thống kê sl vụ việc']);
    expect(model.excludedSheets).toEqual([]);
    expect(Object.keys(model.sheets[0].cells).length).toBeGreaterThan(100);
    expect(model.sheets[0].merges.length).toBeGreaterThan(0);
    // It crossed a thread boundary: it must be plain, structured-cloneable JSON.
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('lists the workbook sheets the report did not select as excluded', async () => {
    const buffer = readFixture('real/phu_luc_07_08_multi_sheet.xlsx');
    const all = await buildGridInWorker(buffer, ['Thống kê sl vụ việc']);
    expect(all.sheetOrder).toHaveLength(1);
    expect(all.excludedSheets.length).toBeGreaterThanOrEqual(1);
    expect(all.excludedSheets).not.toContain(all.sheetOrder[0]);
  });

  it('ignores a selected sheet name the workbook does not have', async () => {
    const buffer = readFixture('real/pl7.xlsx');
    const model = await buildGridInWorker(buffer, ['Thống kê sl vụ việc', 'Không có']);
    expect(model.sheetOrder).toEqual(['Thống kê sl vụ việc']);
  });

  it('propagates GRID_TOO_LARGE with its code', async () => {
    // 129 columns of content in one row exceeds the 128-column drawing limit.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Rộng');
    for (let c = 1; c <= 129; c++) ws.getCell(1, c).value = c;
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(buildGridInWorker(buffer, ['Rộng'])).rejects.toMatchObject({ code: 'GRID_TOO_LARGE' });
  });

  it('terminates on timeout like the parse path', async () => {
    const buffer = readFixture('real/pl7.xlsx');
    await expect(buildGridInWorker(buffer, ['Thống kê sl vụ việc'], 1)).rejects.toMatchObject({
      code: 'PARSE_TIMEOUT',
    });
  });

  it('rejects, and does not hang, on a file that is not an xlsx', async () => {
    await expect(buildGridInWorker(Buffer.from('nope'), ['x'])).rejects.toBeInstanceOf(Error);
  });
});

describe('worker concurrency is bounded by real thread count (Codex G1b P2)', () => {
  jest.setTimeout(60_000);

  it('never has more than WORKER_MAX_CONCURRENT threads alive, even when every job times out', async () => {
    liveWorkers.peak = 0;
    const buffer = readFixture('real/pl7.xlsx');
    // 1 ms timeouts: each job is abandoned before its worker can answer, which
    // is exactly when a slot released too early lets the next job start while
    // the previous thread is still shutting down.
    const jobs = Array.from({ length: 12 }, () =>
      buildGridInWorker(buffer, ['Thống kê sl vụ việc'], 1).catch((e: unknown) => e),
    );
    const results = await Promise.all(jobs);
    expect(results.every((r) => r instanceof Error)).toBe(true);
    expect(liveWorkers.peak).toBeLessThanOrEqual(2);
    // And nothing is left running afterwards.
    for (let i = 0; i < 50 && liveWorkers.current > 0; i++) await new Promise((r) => setTimeout(r, 50));
    expect(liveWorkers.current).toBe(0);
  });

  it('a successful job releases its slot only after the thread is gone', async () => {
    liveWorkers.peak = 0;
    const buffer = readFixture('real/pl7.xlsx');
    await Promise.all(
      Array.from({ length: 6 }, () => buildGridInWorker(buffer, ['Thống kê sl vụ việc'])),
    );
    expect(liveWorkers.peak).toBeLessThanOrEqual(2);
  });
});

describe('buildGridInWorker accepts a lazy loader (Codex G1b P1)', () => {
  jest.setTimeout(30_000);

  it('does not call the loader until the job is admitted', async () => {
    const buffer = readFixture('real/pl7.xlsx');
    const loader = jest.fn(async () => buffer);
    const model = await buildGridInWorker(loader, ['Thống kê sl vụ việc']);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(model.sheetOrder).toEqual(['Thống kê sl vụ việc']);
  });

  it('a loader failure rejects the job and frees the slot', async () => {
    await expect(buildGridInWorker(async () => { throw new Error('db down'); }, ['x'])).rejects.toThrow('db down');
    const ok = await buildGridInWorker(readFixture('real/pl7.xlsx'), ['Thống kê sl vụ việc']);
    expect(ok.sheets).toHaveLength(1);
  });
});

describe('evaluateFormulasInWorker (official formula figures)', () => {
  jest.setTimeout(30_000);

  it('gives the same figures in a worker as in-process, for both blank rules', async () => {
    const model = await buildGridInWorker(readFixture('real/pl7.xlsx'), ['Thống kê sl vụ việc']);
    const inProcess = evaluateAllFormulas(model, [], {}, 'blank');
    expect(Object.keys(inProcess).length).toBeGreaterThan(0); // the comparison must be about something

    const viaWorker = await evaluateFormulasInWorker({ grid: model, fields: [], values: {}, blankAs: 'blank' });
    expect(viaWorker).toEqual(inProcess);

    const none = await evaluateFormulasInWorker({ grid: model, fields: [], values: {}, blankAs: 'none' });
    expect(none).toEqual(evaluateAllFormulas(model, [], {}, 'none'));
  });

  it('terminates on timeout like the other modes', async () => {
    const model = await buildGridInWorker(readFixture('real/pl7.xlsx'), ['Thống kê sl vụ việc']);
    await expect(
      evaluateFormulasInWorker({ grid: model, fields: [], values: {}, blankAs: 'blank' }, 1),
    ).rejects.toBeInstanceOf(TemplateParseTimeoutError);
  });
});
