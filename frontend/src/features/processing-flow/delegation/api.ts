import { api } from '@/lib/api';

/** Shapes of `/api/v1/processing/delegations` (`backend/src/processing-flow/records/processing-delegation.service.ts`). */
export type DelegationState = 'IN_FORCE' | 'UPCOMING' | 'ENDED' | 'REVOKED';

export interface DelegationDto {
  id: string;
  fromUserId: string;
  fromName: string | null;
  toUserId: string;
  toName: string | null;
  validFrom: string;
  validTo: string;
  note: string | null;
  state: DelegationState;
  createdById: string;
  createdAt: string;
  revokedAt: string | null;
  /** Whether the reader may revoke it now. */
  canRevoke: boolean;
}

export interface DelegationsDto {
  asOf: string;
  given: DelegationDto[];
  received: DelegationDto[];
}

export interface DelegationCandidateDto {
  userId: string;
  name: string;
}

export interface CreateDelegationBody {
  toUserId: string;
  /** `YYYY-MM-DD`: whole days in Vietnam. */
  validFrom: string;
  validTo: string;
  note?: string;
}

const data = <T>(r: { data: T }): T => r.data;
const BASE = '/processing/delegations';

/**
 * The calls of the screen "Uỷ quyền xử lý". The server answers 404 while the switch `processing_flow_records` is off
 * and 403 without `read:ProcessingStep`. A delegation is never edited: it is revoked and made anew.
 */
export const delegationApi = {
  mine: () => api.get<DelegationsDto>(BASE).then(data),
  candidates: () => api.get<DelegationCandidateDto[]>(`${BASE}/candidates`).then(data),
  create: (body: CreateDelegationBody) => api.post<DelegationDto>(BASE, body).then(data),
  revoke: (id: string) => api.post<DelegationDto>(`${BASE}/${encodeURIComponent(id)}/revoke`, {}).then(data),
};

export const DELEGATION_QUERY_KEYS = {
  mine: ['processing-delegations', 'mine'] as const,
  candidates: ['processing-delegations', 'candidates'] as const,
};
