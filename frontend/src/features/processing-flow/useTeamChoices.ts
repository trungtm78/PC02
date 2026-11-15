import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PROCESSING_QUERY_KEYS } from './queryKeys';

export interface TeamChoice {
  id: string;
  name: string;
}

/**
 * The units a step may name: `GET /teams/options` (active teams, a plain array). Only the working units inside the
 * office, not the ward police teams: the same split the other pickers make, by `wardId` (empty = a working unit).
 */
export function useTeamChoices() {
  return useQuery({
    queryKey: PROCESSING_QUERY_KEYS.teams,
    queryFn: async (): Promise<TeamChoice[]> => {
      const res = await api.get('/teams/options');
      const items: Array<{ id: string; name: string; wardId?: string | null }> = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      return items.filter((t) => t.wardId == null).map((t) => ({ id: t.id, name: t.name }));
    },
    staleTime: 10 * 60_000,
  });
}
