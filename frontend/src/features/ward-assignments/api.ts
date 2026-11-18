/**
 * The client of the ward assignment routes: lane "Exists" (PR #695) and lane A (review, block 3, delete with data) of
 * the contract of 16/11/2026, written exactly as the contract states them. Every write carries `expectedUpdatedAt`,
 * the record's `updatedAt` as the screen read it; a stale one answers 409 `WARD_ASSIGNMENT_CHANGED`.
 */
import { api } from '@/lib/api';
import type {
  WardAssignmentDetail,
  WardAssignmentRow,
  WardContentInput,
  WardDeletionImpact,
  WardInvestigator,
  WardListQuery,
  WardListStats,
  WardFollowUpChoices,
  WardReturnReason,
} from './types';

const BASE = '/ward-assignments';
const INVESTIGATORS = '/ward-investigators';
const at = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const data = <T>(r: { data: T }): T => r.data;

/** The filters of a list query alone: what a card stands for, the page and the order are not the cards' business. */
function withoutPaging(query: WardListQuery): WardListQuery {
  const { status: _status, archived: _archived, page: _page, pageSize: _pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = query;
  return filters;
}

export interface WardCreateInput extends WardContentInput {
  /** The ward unit; a ward officer's own when left out. */
  assignedTeamId?: string | null;
}

export interface WardApproveInput {
  assignedInvestigatorId: string;
  followUpUserId?: string | null;
  followUpTeamId?: string | null;
  requirements?: string[];
  pc02Note?: string | null;
}

export interface WardReturnInput {
  reasonCode?: string | null;
  reasonText?: string | null;
  requirements: string[];
}

export interface WardFollowUpInput {
  receivedOn?: string | null;
  resultText?: string | null;
  pc02Note?: string | null;
}

export interface WardInvestigatorInput {
  /** The unit already lists this name and the person says this is another one. */
  allowSameName?: boolean;
  fullName: string;
  rank?: string | null;
  position?: string | null;
  grade?: string | null;
}

export const wardAssignmentsApi = {
  list: (query: WardListQuery) =>
    api.get<{ data: WardAssignmentRow[]; total: number; intake?: boolean }>(BASE, { params: query }).then(data),
  /** Who is reading: the shared desk at PC02 (`intake`) sees only what it entered and has not yet submitted. */
  viewer: () => api.get<{ intake: boolean }>(`${BASE}/viewer`).then(data),
  /** The approved request of a unit that carries this code: what a re-assignment entered at the shared desk names. */
  previousByCode: (teamId: string, code: string) =>
    api.get<{ id: string; code: string }>(`${BASE}/previous-by-code`, { params: { teamId, code } }).then(data),
  /** The six cards in one answer, under the list's filters (no card, no page, no order). */
  listStats: (query: WardListQuery) => api.get<WardListStats>(`${BASE}/list-stats`, { params: withoutPaging(query) }).then(data),
  /** The ward units the filter panel offers (those with a request the person may read). */
  filterUnits: () => api.get<{ id: string; name: string }[]>(`${BASE}/filter-units`).then(data),
  get: (id: string) => api.get<WardAssignmentDetail>(at(id)).then(data),
  create: (body: WardCreateInput) => api.post<WardAssignmentDetail>(BASE, body).then(data),
  update: (id: string, body: WardContentInput, expectedUpdatedAt: string) =>
    api.patch<WardAssignmentDetail>(at(id), { ...body, expectedUpdatedAt }).then(data),
  submit: (id: string, expectedUpdatedAt: string) => api.post<{ code?: string | null }>(`${at(id)}/submit`, { expectedUpdatedAt }).then(data),
  withdraw: (id: string, expectedUpdatedAt: string) => api.post(`${at(id)}/withdraw`, { expectedUpdatedAt }).then(data),
  remove: (id: string, expectedUpdatedAt: string) => api.delete(at(id), { params: { expectedUpdatedAt } }).then(data),
  archive: (id: string, expectedUpdatedAt: string) => api.post(`${at(id)}/archive`, { expectedUpdatedAt }).then(data),
  restore: (id: string, expectedUpdatedAt: string) => api.post(`${at(id)}/restore`, { expectedUpdatedAt }).then(data),

  // ── lane A: review ──
  returnIt: (id: string, body: WardReturnInput, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/return`, { ...body, expectedUpdatedAt }).then(data),
  revokeReturn: (id: string, reason: string, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/return/revoke`, { reason, expectedUpdatedAt }).then(data),
  approve: (id: string, body: WardApproveInput, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/approve`, { ...body, expectedUpdatedAt }).then(data),
  cancelApproval: (id: string, reason: string, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/approval/cancel`, { reason, expectedUpdatedAt }).then(data),

  // ── lane A: after approval ──
  followUp: (id: string, body: WardFollowUpInput, expectedUpdatedAt: string) =>
    api.patch(`${at(id)}/follow-up`, { ...body, expectedUpdatedAt }).then(data),
  extendDeadline: (id: string, newDueOn: string, reason: string, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/deadline/extend`, { newDueOn, reason, expectedUpdatedAt }).then(data),
  complete: (id: string, completedOn: string, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/complete`, { completedOn, expectedUpdatedAt }).then(data),
  reopen: (id: string, reason: string, expectedUpdatedAt: string) =>
    api.post(`${at(id)}/complete/reopen`, { reason, expectedUpdatedAt }).then(data),

  returnReasons: () => api.get<WardReturnReason[]>(`${BASE}/return-reasons`).then(data),
  /** A reviewer adds a reason to the catalogue; the same words answer the reason already listed (`existed`). */
  addReturnReason: (name: string) => api.post<WardReturnReason & { existed: boolean }>(`${BASE}/return-reasons`, { name }).then(data),
  followUpChoices: () => api.get<WardFollowUpChoices>(`${BASE}/follow-up-choices`).then(data),
  /** The ward units the person may enter a request for (exactly those `create` accepts). */
  unitChoices: () => api.get<{ id: string; name: string }[]>(`${BASE}/unit-choices`).then(data),
  deletionImpact: (id: string) => api.get<WardDeletionImpact>(`${at(id)}/deletion-impact`).then(data),
  removeWithData: (id: string, confirmCode: string, expectedUpdatedAt: string) =>
    api.delete(`${at(id)}/with-data`, { data: { confirmCode, expectedUpdatedAt } }).then(data),
};

export const wardInvestigatorsApi = {
  list: (teamId: string, includeStopped = false) =>
    api.get<WardInvestigator[]>(INVESTIGATORS, { params: { teamId, includeStopped } }).then(data),
  create: (teamId: string, body: WardInvestigatorInput) =>
    api.post<WardInvestigator>(INVESTIGATORS, { teamId, ...body }).then(data),
  update: (id: string, body: Partial<WardInvestigatorInput>, expectedUpdatedAt: string) =>
    api.patch<WardInvestigator>(`${INVESTIGATORS}/${encodeURIComponent(id)}`, { ...body, expectedUpdatedAt }).then(data),
  deactivate: (id: string, expectedUpdatedAt: string) =>
    api.post<WardInvestigator>(`${INVESTIGATORS}/${encodeURIComponent(id)}/deactivate`, { expectedUpdatedAt }).then(data),
  reactivate: (id: string, expectedUpdatedAt: string) =>
    api.post<WardInvestigator>(`${INVESTIGATORS}/${encodeURIComponent(id)}/reactivate`, { expectedUpdatedAt }).then(data),
};

export const WARD_QUERY_KEYS = {
  all: ['ward-assignments'] as const,
  list: (query: WardListQuery) => ['ward-assignments', 'list', query] as const,
  count: (query: WardListQuery) => ['ward-assignments', 'count', query] as const,
  stats: (query: WardListQuery) => ['ward-assignments', 'list-stats', query] as const,
  filterUnits: ['ward-assignments', 'filter-units'] as const,
  viewer: ['ward-assignments', 'viewer'] as const,
  detail: (id: string) => ['ward-assignments', 'detail', id] as const,
  investigators: (teamId: string, includeStopped: boolean) => ['ward-investigators', teamId, includeStopped] as const,
  returnReasons: ['ward-assignments', 'return-reasons'] as const,
  approvedOfUnit: (teamId: string) => ['ward-assignments', 'approved-of', teamId] as const,
};
