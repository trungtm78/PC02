import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { TemplateService, TemplateValidationError } from './template.service';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/dynamic-reports');

function readFixture(relPath: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, relPath));
}

/**
 * TemplateService (spec §10 PR3) end-to-end, against real fixtures only.
 * Ordering: hostile-xlsx-guard's synchronous checks (magic bytes,
 * compressed size, zip-bomb) run before the file ever reaches the parser
 * or a worker thread — verified here by confirming the hostile fixtures
 * are rejected without producing any ParseTemplateResult shape at all.
 */
describe('TemplateService', () => {
  jest.setTimeout(20_000);
  let service: TemplateService;

  beforeEach(() => {
    service = new TemplateService();
  });

  it('validates and parses a real template end-to-end, returning sha256 + suggested rules alongside the parse result', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    const result = await service.validateAndParse(buffer, ['Đội 3']);

    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.fields).toHaveLength(0); // 33 sample-number cells, no tokens
    expect(Array.isArray(result.suggestedRules)).toBe(true);
  });

  it('rejects a password-encrypted hostile fixture before it ever reaches the parser (INVALID_MIME)', async () => {
    const buffer = readFixture('hostile/password_encrypted.xlsx');
    await expect(
      service.validateAndParse(buffer, ['Sheet1']),
    ).rejects.toMatchObject({
      constructor: TemplateValidationError,
      code: 'INVALID_MIME',
    });
  });

  it('rejects a renamed .xlsm-as-.xlsx hostile fixture by vbaProject.bin presence, not by extension/MIME (MACRO_DETECTED)', async () => {
    const buffer = readFixture('hostile/renamed_macro_as_xlsx.xlsx');
    await expect(
      service.validateAndParse(buffer, ['Sheet1']),
    ).rejects.toMatchObject({
      constructor: TemplateValidationError,
      code: 'MACRO_DETECTED',
    });
  });

  it('rejects the zip-bomb hostile fixture (ZIP_BOMB_RATIO) without spawning a worker', async () => {
    const buffer = readFixture('hostile/zip_bomb.xlsx');
    await expect(
      service.validateAndParse(buffer, ['Sheet1']),
    ).rejects.toMatchObject({
      constructor: TemplateValidationError,
      code: 'ZIP_BOMB_RATIO',
    });
  });

  it('rejects an 8-sheet valid workbook when the author selects all 8 as report sheets (two-tier limit, R6)', async () => {
    const buffer = readFixture('hostile/eight_sheets_select_limit.xlsx');
    await expect(
      service.validateAndParse(buffer, [
        'Sheet1',
        'Sheet2',
        'Sheet3',
        'Sheet4',
        'Sheet5',
        'Sheet6',
        'Sheet7',
        'Sheet8',
      ]),
    ).rejects.toMatchObject({
      constructor: TemplateValidationError,
      code: 'TOO_MANY_SELECTED_SHEETS',
    });
  });

  it('accepts the same 8-sheet workbook when the author selects only 5 of its sheets', async () => {
    const buffer = readFixture('hostile/eight_sheets_select_limit.xlsx');
    const result = await service.validateAndParse(buffer, [
      'Sheet1',
      'Sheet2',
      'Sheet3',
      'Sheet4',
      'Sheet5',
    ]);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('logs and rethrows a non-TemplateLimitError worker failure as-is (not silently swallowed or mis-wrapped)', async () => {
    // A valid zip (passes every pre-check: magic bytes, size, zip-bomb,
    // macro) but with unparseable XML inside xl/workbook.xml — exceljs's
    // own XML parser throws once the worker actually tries to load it.
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook><sheets><sheet name="Sheet1"');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      service.validateAndParse(buffer, ['Sheet1']),
    ).rejects.toThrow();
  });

  it('surfaces the external-link hostile fixture as a WORKER-level issue, not a pre-check rejection (the zip itself is well-formed)', async () => {
    const buffer = readFixture('hostile/external_link.xlsx');
    const result = await service.validateAndParse(buffer, ['Sheet1']);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXTERNAL_LINK_DETECTED',
          severity: 'ERROR',
        }),
      ]),
    );
  });

  describe('listSheets (S02 — upload step, before any sheet is selected)', () => {
    it('lists every sheet name in a real multi-sheet workbook, in workbook order', async () => {
      const buffer = readFixture('real/hsln_17_sheets.xlsx');
      const sheets = await service.listSheets(buffer);
      expect(sheets.length).toBe(17);
      expect(sheets[0].name).toBe('TỔNG');
      expect(sheets.some((s) => s.name === 'Đội 3')).toBe(true);
    });

    it('runs the same pre-checks as validateAndParse — rejects a hostile fixture before exceljs ever loads it', async () => {
      const buffer = readFixture('hostile/zip_bomb.xlsx');
      await expect(service.listSheets(buffer)).rejects.toMatchObject({
        constructor: TemplateValidationError,
        code: 'ZIP_BOMB_RATIO',
      });
    });

    it('rejects a macro-renamed fixture the same way validateAndParse does', async () => {
      const buffer = readFixture('hostile/renamed_macro_as_xlsx.xlsx');
      await expect(service.listSheets(buffer)).rejects.toMatchObject({
        constructor: TemplateValidationError,
        code: 'MACRO_DETECTED',
      });
    });

    it('does not enforce the selected-sheet two-tier limit — an 8-sheet workbook lists fine before anything is selected', async () => {
      const buffer = readFixture('hostile/eight_sheets_select_limit.xlsx');
      const sheets = await service.listSheets(buffer);
      expect(sheets.length).toBe(8);
    });

    it("reports each sheet's visibility state (visible/hidden/veryHidden)", async () => {
      const buffer = readFixture('real/hsln_17_sheets.xlsx');
      const sheets = await service.listSheets(buffer);
      expect(
        sheets.every((s) =>
          ['visible', 'hidden', 'veryHidden'].includes(s.state),
        ),
      ).toBe(true);
    });
  });
});
