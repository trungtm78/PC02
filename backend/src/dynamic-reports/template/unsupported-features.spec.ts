import JSZip from 'jszip';
import { detectUnsupportedFeatures } from './unsupported-features';

/**
 * Zip-structural detection for features the PR3 checklist calls out:
 * external links block publish outright (reject, like macro/OLE); images,
 * conditional formatting, charts, pivot tables only warn before publish
 * (spec §10 PR3: "Báo trước khi xuất bản nếu có ảnh/logo, conditional
 * formatting, chart, pivot, named range"). Detected at the zip-entry-name
 * level — cheap, and exceljs doesn't expose charts/pivots as parsed
 * objects anyway.
 */
async function buildZip(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('detectUnsupportedFeatures', () => {
  it('returns no issues for a plain workbook with none of these parts', async () => {
    const buf = await buildZip({
      'xl/worksheets/sheet1.xml': '<worksheet/>',
      'xl/workbook.xml': '<workbook/>',
    });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues).toHaveLength(0);
  });

  it('flags an external link as an ERROR (reject — same tier as macro/OLE)', async () => {
    const buf = await buildZip({
      'xl/worksheets/sheet1.xml': '<worksheet/>',
      'xl/externalLinks/externalLink1.xml': '<externalLink/>',
    });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'EXTERNAL_LINK_DETECTED',
        severity: 'ERROR',
      }),
    ]);
  });

  it('flags embedded media (images/logos) as a WARNING, not a reject', async () => {
    const buf = await buildZip({
      'xl/worksheets/sheet1.xml': '<worksheet/>',
      'xl/media/image1.png': 'fake-bytes',
    });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_FEATURE',
        severity: 'WARNING',
      }),
    ]);
  });

  it('flags a chart as a WARNING', async () => {
    const buf = await buildZip({ 'xl/charts/chart1.xml': '<chart/>' });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues[0].code).toBe('UNSUPPORTED_FEATURE');
    expect(issues[0].message).toMatch(/chart/i);
  });

  it('flags a pivot table as a WARNING', async () => {
    const buf = await buildZip({
      'xl/pivotTables/pivotTable1.xml': '<pivot/>',
    });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues[0].code).toBe('UNSUPPORTED_FEATURE');
    expect(issues[0].message).toMatch(/pivot/i);
  });

  it('flags conditional formatting (in-sheet XML tag, no dedicated zip part) as a WARNING', async () => {
    const buf = await buildZip({
      'xl/worksheets/sheet1.xml':
        '<worksheet><conditionalFormatting sqref="A1:A10"><cfRule/></conditionalFormatting></worksheet>',
    });
    const issues = await detectUnsupportedFeatures(buf);
    expect(issues[0].code).toBe('UNSUPPORTED_FEATURE');
    expect(issues[0].message).toMatch(/conditional/i);
  });

  it('can report multiple distinct features found in the same workbook', async () => {
    const buf = await buildZip({
      'xl/charts/chart1.xml': '<chart/>',
      'xl/media/image1.png': 'fake',
      'xl/externalLinks/externalLink1.xml': '<externalLink/>',
    });
    const issues = await detectUnsupportedFeatures(buf);
    const codes = issues.map((i) => i.code).sort();
    expect(codes).toEqual([
      'EXTERNAL_LINK_DETECTED',
      'UNSUPPORTED_FEATURE',
      'UNSUPPORTED_FEATURE',
    ]);
  });
});
