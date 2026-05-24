import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type TimelineEntityType = 'CASE' | 'INCIDENT' | 'PETITION';
export type TimelineEventType =
  | 'STATUS_CHANGE'
  | 'FIELD_UPDATE'
  | 'DOCUMENT_UPLOAD'
  | 'CREATED'
  | 'LINKED';

export interface TimelineActor {
  id: string;
  name: string;
}

export interface TimelineEventMetadata {
  hasDiff: boolean;
  fromStatus?: string;
  toStatus?: string;
  changedFields?: string[];
}

export interface TimelineEvent {
  id: string;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  eventType: TimelineEventType;
  title: string;
  detail: string | null;
  actor: TimelineActor | null;
  actedAt: string | Date;
  metadata: TimelineEventMetadata;
}

export interface JourneyData {
  events: TimelineEvent[];
  total: number;
  hasNextPage: boolean;
  page: number;
  limit: number;
}

export function useCaseJourney(caseId: string, page = 1, limit = 50) {
  return useQuery<JourneyData>({
    queryKey: ['case-journey', caseId, page, limit],
    queryFn: async () => {
      const res = await api.get(`/cases/${caseId}/journey?page=${page}&limit=${limit}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!caseId,
    staleTime: 60 * 1000,
  });
}
