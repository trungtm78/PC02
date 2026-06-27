import type { AxiosResponse } from 'axios';
import { api } from '@/lib/api';
import type { DocumentTemplate } from './types';

/**
 * Xuất chứng từ ĐỘNG cho Vụ án (cases) / Vụ việc (incidents).
 * Backend PR2: POST /:entity/:id/export-documents { templateIds, mode, manualValues } → blob.
 * Tách helper tải/parse-lỗi blob ngay trong module document-templates để self-contained
 * (không phụ thuộc feature petitions).
 */
export type ExportEntity = 'cases' | 'incidents';

export interface ExportEntityDocumentsBody {
  templateIds: string[];
  mode: 'merged' | 'zip';
  manualValues?: Record<string, string>;
}

export function exportEntityDocuments(
  entity: ExportEntity,
  id: string,
  body: ExportEntityDocumentsBody,
): Promise<AxiosResponse<Blob>> {
  return api.post(`/${entity}/${id}/export-documents`, body, { responseType: 'blob' });
}

/**
 * Danh sách mẫu chứng từ active cho picker xuất — gọi GET /:entity/export-templates
 * (quyền read Case/Incident, KHÔNG dùng /document-templates vốn cần quyền Setting/admin).
 * Backend đã lọc theo entityType tương ứng (cases→VU_AN, incidents→VU_VIEC).
 */
export async function listExportTemplates(entity: ExportEntity): Promise<DocumentTemplate[]> {
  const res = await api.get(`/${entity}/export-templates`);
  return (res.data ?? []) as DocumentTemplate[];
}

/** Lấy filename từ header content-disposition; fallback theo mode. */
export function resolveFilename(
  headers: Record<string, unknown> | undefined,
  mode: 'merged' | 'zip',
): string {
  const cd = String((headers ?? {})['content-disposition'] ?? '');
  const m = cd.match(/filename="([^"]+)"/);
  return m?.[1] ?? (mode === 'merged' ? 'ChungTu.docx' : 'ChungTu.zip');
}

/** Kích hoạt tải file blob về máy người dùng. */
export function triggerDownload(response: AxiosResponse<Blob>, mode: 'merged' | 'zip'): void {
  const filename = resolveFilename(response.headers as Record<string, unknown>, mode);
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Khi tải qua `responseType: 'blob'`, lỗi (400/...) cũng về dạng Blob.
 * Parse Blob-JSON về object để extractApiError đọc message nghiệp vụ.
 */
export async function parseBlobError(err: unknown): Promise<unknown> {
  const e = err as { response?: { data?: unknown } };
  const data = e?.response?.data;
  if (data instanceof Blob && data.type.includes('json')) {
    try {
      const text = await data.text();
      (e as { response: { data: unknown } }).response.data = JSON.parse(text);
    } catch {
      /* ignore — extractApiError fallback sẽ chạy */
    }
  }
  return err;
}
