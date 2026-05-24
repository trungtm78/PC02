import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JourneyData } from './useCaseJourney';

export function useIncidentJourney(incidentId: string, page = 1, limit = 50) {
  return useQuery<JourneyData>({
    queryKey: ['incident-journey', incidentId, page, limit],
    queryFn: async () => {
      const res = await api.get(`/incidents/${incidentId}/journey?page=${page}&limit=${limit}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!incidentId,
    staleTime: 60 * 1000,
  });
}
