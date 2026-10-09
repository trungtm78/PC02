import JSZip from 'jszip';
import { assertNoMacro, MacroDetectedError } from './macro-guard';

/**
 * Macro rejection (README.md hostile/renamed_macro_as_xlsx.xlsx: a real
 * .xlsm renamed to .xlsx — `assertMagicBytes` passes because it IS a
 * valid zip; this is the check that actually catches it, by presence of
 * `xl/vbaProject.bin`, same signal Excel itself uses to know a workbook is
 * macro-enabled regardless of its file extension).
 */
async function buildZip(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries))
    zip.file(name, content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('assertNoMacro', () => {
  it('rejects a workbook containing xl/vbaProject.bin', async () => {
    const buf = await buildZip({
      'xl/workbook.xml': '<workbook/>',
      'xl/vbaProject.bin': 'fake-vba-bytes',
    });
    await expect(assertNoMacro(buf)).rejects.toMatchObject({
      constructor: MacroDetectedError,
      code: 'MACRO_DETECTED',
    });
  });

  it('passes a plain workbook with no vbaProject part', async () => {
    const buf = await buildZip({ 'xl/workbook.xml': '<workbook/>' });
    await expect(assertNoMacro(buf)).resolves.toBeUndefined();
  });
});
