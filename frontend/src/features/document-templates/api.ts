import { api } from '@/lib/api';
import type { DocumentTemplate, TemplateFilter } from './types';

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
  dto: Partial<DocumentTemplate>,
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
