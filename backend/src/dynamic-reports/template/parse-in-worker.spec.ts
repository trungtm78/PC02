import * as fs from 'fs';
import * as path from 'path';
import {
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
    ).rejects.toBeInstanceOf(TemplateParseTimeoutError);
  });

  it('rejects (does not hang) when given a buffer that is not a valid xlsx at all', async () => {
    const buffer = Buffer.from('not an xlsx file');
    await expect(
      parseTemplateInWorker(buffer, ['Sheet1']),
    ).rejects.toBeInstanceOf(Error);
  });
});
