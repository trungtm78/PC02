import { api } from '@/lib/api';
import type {
  DeadlineRuleVersion,
  DeadlineRulesSummary,
  ImpactPreview,
  ProposeRuleInput,
  UpdateDraftInput,
  ApproveRuleInput,
  RejectRuleInput,
} from './types';

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * REST client for /api/v1/deadline-rules.
 * Mirrors DeadlineRulesController endpoints exactly so the type system enforces
 * the wire format end-to-end.
 */
export const deadlineRulesApi = {
  listActive: () =>
    api.get<Envelope<DeadlineRuleVersion[]>>('/deadline-rules').then((r) => r.data),

  getSummary: () =>
    api.get<Envelope<DeadlineRulesSummary>>('/deadline-rules/summary').then((r) => r.data),

  getApprovalQueue: () =>
    api.get<Envelope<DeadlineRuleVersion[]>>('/deadline-rules/approval-queue').then((r) => r.data),

  getHistory: (key: string) =>
    api
      .get<Envelope<DeadlineRuleVersion[]>>(`/deadline-rules/${encodeURIComponent(key)}/history`)
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<Envelope<DeadlineRuleVersion>>(`/deadline-rules/version/${id}`).then((r) => r.data),

  previewImpact: (id: string) =>
    api.get<Envelope<ImpactPreview>>(`/deadline-rules/version/${id}/impact`).then((r) => r.data),

  query: (params: { ruleKey?: string; status?: string }) =>
    api
      .get<Envelope<DeadlineRuleVersion[]>>('/deadline-rules/query', { params })
      .then((r) => r.data),

  propose: (input: ProposeRuleInput) =>
    api.post<Envelope<DeadlineRuleVersion>>('/deadline-rules', input).then((r) => r.data),

  updateDraft: (id: string, input: UpdateDraftInput) =>
    api.patch<Envelope<DeadlineRuleVersion>>(`/deadline-rules/${id}`, input).then((r) => r.data),

  submit: (id: string) =>
    api.post<Envelope<DeadlineRuleVersion>>(`/deadline-rules/${id}/submit`).then((r) => r.data),

  approve: (id: string, input: ApproveRuleInput) =>
    api
      .post<Envelope<DeadlineRuleVersion>>(`/deadline-rules/${id}/approve`, input)
      .then((r) => r.data),

  reject: (id: string, input: RejectRuleInput) =>
    api
      .post<Envelope<DeadlineRuleVersion>>(`/deadline-rules/${id}/reject`, input)
      .then((r) => r.data),

  deleteDraft: (id: string) =>
    api.delete<Envelope<null>>(`/deadline-rules/${id}`).then((r) => r.data),
};

export const DEADLINE_RULES_QUERY_KEYS = {
  active: ['deadline-rules', 'active'] as const,
  summary: ['deadline-rules', 'summary'] as const,
  queue: ['deadline-rules', 'approval-queue'] as const,
  history: (key: string) => ['deadline-rules', 'history', key] as const,
  detail: (id: string) => ['deadline-rules', 'detail', id] as const,
  impact: (id: string) => ['deadline-rules', 'impact', id] as const,
};
