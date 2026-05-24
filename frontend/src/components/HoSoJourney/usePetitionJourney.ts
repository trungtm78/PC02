import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JourneyData } from './useCaseJourney';

export function usePetitionJourney(petitionId: string, page = 1, limit = 50) {
  return useQuery<JourneyData>({
    queryKey: ['petition-journey', petitionId, page, limit],
    queryFn: async () => {
      const res = await api.get(`/petitions/${petitionId}/journey?page=${page}&limit=${limit}`);
      return res.data?.data ?? res.data;
    },
    enabled: !!petitionId,
    staleTime: 60 * 1000,
  });
}
