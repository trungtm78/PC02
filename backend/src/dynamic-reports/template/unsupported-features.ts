import JSZip from 'jszip';
import type { ParsedIssue } from './types';

/**
 * Zip-structural feature detection (spec §10 PR3). External links are a
 * reject (same tier as macro/OLE — a published report must be self-
 * contained, never silently pulling numbers from `file:///...` on whoever's
 * machine opens it). Images, conditional formatting, charts, and pivot
 * tables only warn before publish (§10: "Báo trước khi xuất bản ... không
 * chặn"). Detected by zip entry name / a simple in-sheet XML tag scan —
 * exceljs doesn't parse charts or pivot tables into objects at all, so
 * there is no higher-level API to check instead.
 */
export async function detectUnsupportedFeatures(
  buffer: Buffer,
): Promise<ParsedIssue[]> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const issues: ParsedIssue[] = [];

  if (names.some((n) => n.startsWith('xl/externalLinks/'))) {
    issues.push({
      sheetKey: '',
      address: '',
      code: 'EXTERNAL_LINK_DETECTED',
      severity: 'ERROR',
      message:
        'File có tham chiếu tới workbook ngoài (external link) — không được hỗ trợ, phải gỡ trước khi tải lên.',
    });
  }

  if (names.some((n) => n.startsWith('xl/media/'))) {
    issues.push({
      sheetKey: '',
      address: '',
      code: 'UNSUPPORTED_FEATURE',
      severity: 'WARNING',
      message: 'File có ảnh/logo nhúng — sẽ không được giữ lại khi xuất bản.',
    });
  }

  if (names.some((n) => n.startsWith('xl/charts/'))) {
    issues.push({
      sheetKey: '',
      address: '',
      code: 'UNSUPPORTED_FEATURE',
      severity: 'WARNING',
      message: 'File có chart — sẽ không được giữ lại khi xuất bản.',
    });
  }

  if (names.some((n) => n.startsWith('xl/pivotTables/'))) {
    issues.push({
      sheetKey: '',
      address: '',
      code: 'UNSUPPORTED_FEATURE',
      severity: 'WARNING',
      message: 'File có pivot table — sẽ không được giữ lại khi xuất bản.',
    });
  }

  const sheetXmlEntries = names.filter(
    (n) => n.startsWith('xl/worksheets/sheet') && n.endsWith('.xml'),
  );
  for (const entry of sheetXmlEntries) {
    const xml = await zip.file(entry)?.async('string');
    if (xml?.includes('<conditionalFormatting')) {
      issues.push({
        sheetKey: '',
        address: '',
        code: 'UNSUPPORTED_FEATURE',
        severity: 'WARNING',
        message:
          'File có conditional formatting — sẽ không được giữ lại khi xuất bản.',
      });
      break;
    }
  }

  return issues;
}
