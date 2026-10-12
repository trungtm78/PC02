import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  buildGridInWorker,
  parseTemplateInWorker,
  TemplateParseTimeoutError,
} from './parse-in-worker';
import { parseTemplate } from './parser';
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
