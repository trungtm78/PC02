import { api } from '@/lib/api';
import type {
  DocumentTemplate,
  TemplateFilter,
  FieldCatalogItem,
  DetectResult,
} from './types';

/** Bỏ key undefined để query params gọn (khớp BE @Query optional). */
function cleanParams(filter: TemplateFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.entityType) out.entityType = filter.entityType;
  if (filter.category) out.category = filter.category;
  if (filter.status) out.status = filter.status;
  return out;
}

export async function listTemplates(filter: TemplateFilter = {}): Promise<DocumentTemplate[]> {
  const res = await api.get('/document-templates', { params: cleanParams(filter) });
  return (res.data ?? []) as DocumentTemplate[];
}

export async function createTemplate(form: FormData): Promise<DocumentTemplate> {
  const res = await api.post('/document-templates', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as DocumentTemplate;
}

export async function updateTemplate(
  id: string,
  dto: Partial<DocumentTemplate> & { requiredVariables?: string[] },
): Promise<DocumentTemplate> {
  const res = await api.patch(`/document-templates/${id}`, dto);
  return res.data as DocumentTemplate;
}

export async function replaceTemplateFile(id: string, file: File): Promise<DocumentTemplate> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/document-templates/${id}/file`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as DocumentTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/document-templates/${id}`);
}

/** Danh mục trường khả dụng (whitelist) cho dropdown map placeholder→field. */
export async function getFieldCatalog(entityType: string): Promise<FieldCatalogItem[]> {
  const res = await api.get('/document-templates/field-catalog', { params: { entityType } });
  return (res.data ?? []) as FieldCatalogItem[];
}

/** Preview placeholder của file (chưa lưu) + gợi ý mapping, theo delimiter đã chọn. */
export async function detectVariables(
  file: File,
  entityType: string,
  delimStart: string,
  delimEnd: string,
): Promise<DetectResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('entityType', entityType);
  form.append('delimStart', delimStart);
  form.append('delimEnd', delimEnd);
  const res = await api.post('/document-templates/detect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as DetectResult;
}

/** Tải file .docx mẫu về (admin sửa rồi upload đè). Trả blob để trigger download. */
export async function downloadTemplateFile(id: string): Promise<Blob> {
  const res = await api.get(`/document-templates/${id}/file`, { responseType: 'blob' });
  return res.data as Blob;
}

/**
 * Đổi trạng thái vòng đời mẫu: ban hành (`active`), thu hồi (`archived`), đưa về nháp (`draft`).
 *
 * Popup In chứng từ chỉ hiện mẫu `active`, nên đây là công tắc duy nhất quyết định một mẫu có
 * tới tay cán bộ hay không.
 */
export async function doiTrangThaiTemplate(
  id: string,
  status: 'draft' | 'active' | 'archived',
): Promise<DocumentTemplate> {
  const res = await api.patch<DocumentTemplate>(`/document-templates/${id}/trang-thai`, { status });
  return res.data;
}
