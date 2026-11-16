/** The choices the ward assignment form offers: units, PC02 teams, investigators of a unit, return reasons. */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { wardAssignmentsApi, wardInvestigatorsApi, WARD_QUERY_KEYS } from './api';

interface TeamOption {
  id: string;
  name: string;
  wardId?: string | null;
}

/** `GET /teams/options` (active teams, a plain array), split by `wardId`: ward police units vs PC02's own teams. */
function useTeamOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['ward-assignments', 'team-options'],
    queryFn: async (): Promise<TeamOption[]> => {
      const res = await api.get('/teams/options');
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useWardUnits(enabled = true) {
  const q = useTeamOptions(enabled);
  return { ...q, data: (q.data ?? []).filter((t) => t.wardId != null).map((t) => ({ id: t.id, name: t.name })) };
}

export function usePc02Teams(enabled = true) {
  const q = useTeamOptions(enabled);
  return { ...q, data: (q.data ?? []).filter((t) => t.wardId == null).map((t) => ({ id: t.id, name: t.name })) };
}

/** The unit's investigators, the stopped ones too: a request may name one who has since been stopped. */
export function useUnitInvestigators(teamId: string) {
  return useQuery({
    queryKey: WARD_QUERY_KEYS.investigators(teamId, true),
    queryFn: () => wardInvestigatorsApi.list(teamId, true),
    enabled: !!teamId,
    staleTime: 60_000,
    retry: false,
  });
}

export function useReturnReasons(enabled: boolean) {
  return useQuery({
    queryKey: WARD_QUERY_KEYS.returnReasons,
    queryFn: () => wardAssignmentsApi.returnReasons(),
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/** The approved requests of a unit: what a re-assignment may name as the request it re-assigns. */
export function useApprovedOfUnit(teamId: string, enabled: boolean) {
  return useQuery({
    queryKey: WARD_QUERY_KEYS.approvedOfUnit(teamId),
    queryFn: async () => {
      const res = await wardAssignmentsApi.list({ status: 'APPROVED', pageSize: 200 });
      return res.data.filter((r) => r.assignedTeamId === teamId);
    },
    enabled: enabled && !!teamId,
    staleTime: 60_000,
    retry: false,
  });
}
