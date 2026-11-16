/** The choices the ward assignment form offers: units, PC02 teams, investigators of a unit, return reasons. */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { wardAssignmentsApi, wardInvestigatorsApi, WARD_QUERY_KEYS } from './api';
import type { WardAssignmentRow } from './types';

const APPROVED_PAGE = 200;

interface TeamOption {
  id: string;
  name: string;
  wardId?: string | null;
}

/** `GET /teams/options` (active teams, a plain array): the ward police units a person entering for a unit may choose. */
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

/** The PC02 units and people a reviewer may name to follow an approval (the module's own list, not the admin screens'). */
export function useFollowUpChoices(enabled: boolean) {
  return useQuery({
    queryKey: ['ward-assignments', 'follow-up-choices'],
    queryFn: () => wardAssignmentsApi.followUpChoices(),
    enabled,
    staleTime: 10 * 60_000,
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
      // The list has no unit filter: read every page (200 a page, the server's ceiling) and keep this unit's. Stops on a
      // short page, on the total, or on a page that adds nothing (a server that ignores `page`).
      const rows: WardAssignmentRow[] = [];
      const seen = new Set<string>();
      for (let page = 1; ; page += 1) {
        const res = await wardAssignmentsApi.list({ status: 'APPROVED', page, pageSize: APPROVED_PAGE });
        const fresh = res.data.filter((r) => !seen.has(r.id));
        for (const r of fresh) {
          seen.add(r.id);
          rows.push(r);
        }
        if (res.data.length < APPROVED_PAGE || seen.size >= res.total || fresh.length === 0) break;
      }
      return rows.filter((r) => r.assignedTeamId === teamId);
    },
    enabled: enabled && !!teamId,
    staleTime: 60_000,
    retry: false,
  });
}
