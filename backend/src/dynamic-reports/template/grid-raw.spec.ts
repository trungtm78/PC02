import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { readRawGridInfo } from './grid-raw';

const PL7 = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real/pl7.xlsx');

async function patched(edit: (parts: Record<string, string>) => void): Promise<Buffer> {
  const zip = await JSZip.loadAsync(fs.readFileSync(PL7));
  const parts: Record<string, string> = {};
  for (const name of ['xl/workbook.xml', 'xl/styles.xml']) {
    parts[name] = await (zip.file(name) as JSZip.JSZipObject).async('string');
  }
  edit(parts);
  for (const [name, body] of Object.entries(parts)) zip.file(name, body);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

describe('readRawGridInfo', () => {
  it('reads the Normal font, date system and per-sheet show-zeros switch from a real template', async () => {
    const info = await readRawGridInfo(fs.readFileSync(PL7));
    expect(info.defaultFont).toEqual({ name: 'Calibri', sizePt: 11 });
    expect(info.date1904).toBe(false);
    expect(info.indexedColors).toBeNull();
    // pl7 hides zeros on its single sheet (see the real-template notes).
    expect(Object.values(info.showZeros)).toEqual([false]);
  });

  it('recognises the 1904 date system', async () => {
    const buffer = await patched((p) => {
      p['xl/workbook.xml'] = p['xl/workbook.xml'].includes('<workbookPr')
        ? p['xl/workbook.xml'].replace(/<workbookPr\b/, '<workbookPr date1904="1"')
        : p['xl/workbook.xml'].replace(/<sheets>/, '<workbookPr date1904="1"/><sheets>');
    });
    expect((await readRawGridInfo(buffer)).date1904).toBe(true);
  });

  it('reads a custom indexed palette as six-digit hex', async () => {
    const buffer = await patched((p) => {
      p['xl/styles.xml'] = p['xl/styles.xml'].replace(
        /<\/styleSheet>/,
        '<colors><indexedColors><rgbColor rgb="FF010203"/><rgbColor rgb="FFAABBCC"/></indexedColors></colors></styleSheet>',
      );
    });
    expect((await readRawGridInfo(buffer)).indexedColors).toEqual(['010203', 'AABBCC']);
  });

  it('falls back to Calibri 11 when styles.xml has no fonts', async () => {
    const buffer = await patched((p) => {
      p['xl/styles.xml'] = p['xl/styles.xml'].replace(/<fonts[\s\S]*?<\/fonts>/, '');
    });
    expect((await readRawGridInfo(buffer)).defaultFont).toEqual({ name: 'Calibri', sizePt: 11 });
  });

  it('decodes XML entities in a font name', async () => {
    const buffer = await patched((p) => {
      p['xl/styles.xml'] = p['xl/styles.xml'].replace(/(<fonts[^>]*>\s*<font>[\s\S]*?<name val=")[^"]*(")/, '$1Tahoma &amp; Co$2');
    });
    expect((await readRawGridInfo(buffer)).defaultFont.name).toBe('Tahoma & Co');
  });

  it('tolerates a package with no workbook part', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types/>');
    const info = await readRawGridInfo(Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })));
    expect(info).toEqual({
      date1904: false,
      defaultFont: { name: 'Calibri', sizePt: 11 },
      indexedColors: null,
      showZeros: {},
      dataValidations: {},
    });
  });

  describe('data validations as written (OV7)', () => {
    const rawOf = async (file: string) =>
      readRawGridInfo(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/dynamic-reports/real', file)));

    it('keeps a bound that is a cell reference as text — exceljs reads it as NaN', async () => {
      const info = await rawOf('a09_1034_unlocked.xlsx');
      const rule = info.dataValidations['A09'].find((v) => v.sqref.includes('Q51'));
      expect(rule).toMatchObject({
        type: 'whole',
        formula1: '0',
        formula2: 'Q50',
        sqref: ['Q51', 'S51:V51'], // the blocks in the order written: the formula is relative to the first
        allowBlank: true,
        showErrorMessage: true,
        error: 'Bạn đã nhập sai.',
        prompt: 'Hàng 43=<hàng 42',
      });
      expect(rule?.operator).toBeUndefined(); // no operator written means "between"
    });

    it('reads every rule of the sheet, one entry each', async () => {
      const info = await rawOf('a10_99_formulas.xlsx');
      expect(info.dataValidations['A10']).toEqual([
        expect.objectContaining({ type: 'whole', operator: 'greaterThanOrEqual', formula1: '0', sqref: ['C9:V26'] }),
      ]);
    });

    it('a sheet with no validation has an empty list, not a missing one', async () => {
      const info = await rawOf('pl7.xlsx');
      expect(info.dataValidations['Thống kê sl vụ việc']).toEqual([]);
    });
  });
});
