import { api } from '@/lib/api';
import type {
  DocumentNumberTemplate,
  DocumentNumberLog,
  DraftResult,
  CommitResult,
  TemplateStats,
  PaginatedLogs,
  CreateTemplateInput,
  UpdateTemplateInput,
} from './types';

const BASE = '/document-numbers';

export const documentNumbersApi = {
  // ─── Templates ────────────────────────────────────────────────
  listTemplates: () =>
    api.get<DocumentNumberTemplate[]>(`${BASE}/templates`).then((r) => r.data),

  createTemplate: (input: CreateTemplateInput) =>
    api.post<DocumentNumberTemplate>(`${BASE}/templates`, input).then((r) => r.data),

  updateTemplate: (id: string, input: UpdateTemplateInput) =>
    api.put<DocumentNumberTemplate>(`${BASE}/templates/${id}`, input).then((r) => r.data),

  deleteTemplate: (id: string) =>
    api.delete<void>(`${BASE}/templates/${id}`),

  previewTemplate: (id: string) =>
    api.post<{ previewNumber: string }>(`${BASE}/templates/${id}/preview`).then((r) => r.data),

  getStats: (id: string) =>
    api.get<TemplateStats>(`${BASE}/templates/${id}/stats`).then((r) => r.data),

  resetCounter: (id: string) =>
    api.post<{ success: boolean }>(`${BASE}/templates/${id}/reset-counter`).then((r) => r.data),

  // ─── Logs ──────────────────────────────────────────────────────
  getLogs: (params?: {
    templateId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<PaginatedLogs>(`${BASE}/logs`, { params }).then((r) => r.data),

  // ─── Internal (draft / commit) ─────────────────────────────────
  draft: (documentType: string) =>
    api.post<DraftResult>(`${BASE}/draft`, { documentType }).then((r) => r.data),

  commit: (documentType: string, options?: { documentId?: string; draftPreview?: string }) =>
    api
      .post<CommitResult>(`${BASE}/commit`, { documentType, ...options })
      .then((r) => r.data),

  updateLogDocumentId: (logId: string, documentId: string) =>
    api.patch<{ success: boolean }>(`${BASE}/logs/${logId}`, { documentId }).then((r) => r.data),
};

export const DOC_NUM_QUERY_KEYS = {
  templates: ['document-numbers', 'templates'] as const,
  template: (id: string) => ['document-numbers', 'template', id] as const,
  stats: (id: string) => ['document-numbers', 'stats', id] as const,
  logs: (params?: object) => ['document-numbers', 'logs', params] as const,
};
