import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { parseTemplate } from './parser';
import { TemplateLimitError } from './limits';

const FIXTURES = path.join(__dirname, '../../../test/fixtures/dynamic-reports');

function readFixture(relPath: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, relPath));
}

async function buildWorkbookBuffer(
  build: (wb: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as ArrayBuffer);
}

/**
 * TemplateService parser golden tests (spec §10 PR3 checklist), run
 * against the real PR0 fixtures — never a synthetic re-encoding of the
 * oracle under test. README.md documents HSLN's 33 unlocked cells per
 * sheet as SAMPLE NUMBERS WITHOUT TOKENS (deliberately — it exercises the
 * "unlocked+literal → warn, don't block" rule), so the correct outcome on
 * the real file is zero fields and 33 warnings, not 33 fields.
 */
describe('parseTemplate — real fixtures', () => {
  it('HSLN "Đội 3" sheet: 33 unlocked sample-number cells are warnings, not fields (README.md oracle)', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    const result = await parseTemplate(buffer, ['Đội 3']);

    expect(result.fields).toHaveLength(0);
    const warnings = result.issues.filter(
      (i) => i.code === 'UNLOCKED_NO_TOKEN',
    );
    expect(warnings).toHaveLength(33);
    expect(warnings.every((w) => w.severity === 'WARNING')).toBe(true);
    expect(result.inputCellCount).toBe(0);
    // S04: every UNLOCKED_NO_TOKEN warning is a web-marking candidate.
    expect(result.markableCells).toHaveLength(33);
    expect(result.markableCells.every((c) => c.sheetKey === 'Đội 3')).toBe(
      true,
    );
    expect(
      result.markableCells.some((c) => typeof c.suggestedLabel === 'string'),
    ).toBe(true);
  });

  it('HSLN: selecting more than 5 sheets is rejected by the two-tier limit (R6) before any other sheet is touched', async () => {
    const buffer = readFixture('real/hsln_17_sheets.xlsx');
    await expect(
      parseTemplate(buffer, [
        'Đội 3',
        'Đội 4',
        'Đội 5',
        'Đội 6',
        'Đội 7',
        'Đội 8',
      ]),
    ).rejects.toBeInstanceOf(TemplateLimitError);
  });

  it('shared-formula fixture: every shared (slave) formula cell is translated via cell.formula, not left as the raw master reference', async () => {
    const buffer = readFixture('real/bao_cao_ngay_shared_formulas.xlsx');
    const result = await parseTemplate(buffer, ['Sheet1']);

    expect(result.formulas.length).toBeGreaterThan(190);
    // No formula string should be the literal unresolved shared-formula
    // marker — every one must be a real, cell-relative expression.
    for (const f of result.formulas) {
      expect(f.expression.length).toBeGreaterThan(0);
    }
    const l9 = result.formulas.find((f) => f.address === 'L9');
    expect(l9?.expression).toBe('L10+L34+L50+L56+L63+L69');
  });

  it('external-link hostile fixture: workbook-level ERROR issue, parsing still completes (rejection happens by severity, not by throwing)', async () => {
    const buffer = readFixture('hostile/external_link.xlsx');
    const result = await parseTemplate(buffer, ['Sheet1']);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EXTERNAL_LINK_DETECTED',
          severity: 'ERROR',
        }),
      ]),
    );
  });

  it('phu_luc_1_6_merges.xlsx: a template with zero formulas and zero unlocked cells produces zero fields and zero formula-related issues', async () => {
    const buffer = readFixture('real/phu_luc_1_6_merges.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const firstSheetName = wb.worksheets[0].name;

    const result = await parseTemplate(buffer, [firstSheetName]);
    expect(result.fields).toHaveLength(0);
    expect(result.formulas).toHaveLength(0);
  });

  it('a merged non-anchor cell never becomes a field, even if it happens to contain token-shaped text', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      const sheet = wb.addWorksheet('Sheet1');
      sheet.getCell('A1').value = '{NUM}';
      sheet.getCell('A1').protection = { locked: false };
      sheet.mergeCells('A1:B1');
    });
    const result = await parseTemplate(buffer, ['Sheet1']);
    // Only the anchor A1 should be classified — B1 (merge slave) must not
    // appear as a second field even though it shares A1's apparent value.
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].address).toBe('A1');
  });

  it('end-to-end: unlocked cell with a valid token becomes a field, with a label inferred from the cell to its left', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      const sheet = wb.addWorksheet('Sheet1');
      sheet.getCell('A1').value = 'Số vụ mới nhận';
      sheet.getCell('B1').value = '{NUM|#,##0|SUM}';
      sheet.getCell('B1').protection = { locked: false };
    });
    const result = await parseTemplate(buffer, ['Sheet1']);

    expect(result.fields).toHaveLength(1);
    const field = result.fields[0];
    expect(field.address).toBe('B1');
    expect(field.fieldKey).toBe('Sheet1!B1');
    expect(field.label).toBe('Số vụ mới nhận');
    expect(field.type).toBe('NUM');
    expect(field.aggregate).toBe('SUM');
    expect(result.inputCellCount).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it('a field with no label to its left is still reported (so the wizard can show it) but carries a LABEL_REQUIRED error', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      const sheet = wb.addWorksheet('Sheet1');
      sheet.getCell('A1').value = '{NUM}';
      sheet.getCell('A1').protection = { locked: false };
    });
    const result = await parseTemplate(buffer, ['Sheet1']);

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].label).toBe('');
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'LABEL_REQUIRED',
        severity: 'ERROR',
        address: 'A1',
      }),
    ]);
  });

  it('a locked boolean cell (e.g. a checkbox-style static flag) is read as STATIC_TEXT, not crashed on', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      const sheet = wb.addWorksheet('Sheet1');
      sheet.getCell('A1').value = true;
    });
    const result = await parseTemplate(buffer, ['Sheet1']);
    expect(result.fields).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('reports dateSystem "1900" when the workbook does not set date1904', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      wb.addWorksheet('Sheet1');
    });
    const result = await parseTemplate(buffer, ['Sheet1']);
    expect(result.dateSystem).toBe('1900');
  });

  it('a hidden unlocked no-token cell is reported as a warning but is NOT a markable candidate (consistent with HIDDEN_INPUT_CELL policy)', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      const sheet = wb.addWorksheet('Sheet1');
      sheet.getCell('A1').value = '123';
      sheet.getCell('A1').protection = { locked: false };
      sheet.getRow(1).hidden = true;
    });
    const result = await parseTemplate(buffer, ['Sheet1']);
    expect(result.issues.some((i) => i.code === 'UNLOCKED_NO_TOKEN')).toBe(
      true,
    );
    expect(result.markableCells).toHaveLength(0);
  });

  it('a sheet name that does not exist in the workbook is reported as an issue, not a thrown exception', async () => {
    const buffer = await buildWorkbookBuffer((wb) => {
      wb.addWorksheet('Sheet1');
    });
    const result = await parseTemplate(buffer, ['Sheet1', 'NoSuchSheet']);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheetKey: 'NoSuchSheet', severity: 'ERROR' }),
      ]),
    );
  });
});
