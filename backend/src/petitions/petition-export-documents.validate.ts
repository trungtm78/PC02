import { BadRequestException } from '@nestjs/common';
import {
  DOCUMENT_TYPES,
  type DocumentType,
} from '../document-templates/docx-loader.service';

export type ExportMode = 'merged' | 'zip';

/** Nguồn allowlist duy nhất = DOCUMENT_TYPES (docx-loader) — tránh hardcode lặp. */
const ALLOWED = new Set<string>(DOCUMENT_TYPES);

/**
 * Validate + chuẩn hoá request xuất nhiều mẫu (1 đơn × N docType).
 * - Reject rỗng / docType ngoài allowlist / mode lạ (400).
 * - Dedupe docTypes (tránh cấp số văn bản 2 lần cho cùng mẫu).
 * - mode mặc định 'merged'.
 * Hàm thuần (không Nest context) → unit-test độc lập.
 */
export function validateExportDocumentsRequest(
  docTypes: unknown,
  mode: unknown,
): { docTypes: DocumentType[]; mode: ExportMode } {
  if (!Array.isArray(docTypes) || docTypes.length === 0) {
    throw new BadRequestException('Danh sách docTypes không được trống');
  }
  const resolvedMode: ExportMode =
    mode === undefined || mode === null ? 'merged' : (mode as ExportMode);
  if (resolvedMode !== 'merged' && resolvedMode !== 'zip') {
    throw new BadRequestException(
      `mode không hợp lệ: ${String(mode)}. Cho phép: merged, zip`,
    );
  }
  const seen = new Set<string>();
  const deduped: DocumentType[] = [];
  for (const dt of docTypes) {
    if (typeof dt !== 'string' || !ALLOWED.has(dt)) {
      throw new BadRequestException(
        `docType không hợp lệ: ${String(dt)}. Cho phép: ${[...ALLOWED].join(', ')}`,
      );
    }
    if (!seen.has(dt)) {
      seen.add(dt);
      deduped.push(dt as DocumentType);
    }
  }
  return { docTypes: deduped, mode: resolvedMode };
}
