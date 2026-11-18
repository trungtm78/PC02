/** The choices the ward assignment form offers: units, PC02 teams, investigators of a unit, return reasons. */
import { useQuery } from '@tanstack/react-query';
import { wardAssignmentsApi, wardInvestigatorsApi, WARD_QUERY_KEYS } from './api';
import type { WardAssignmentRow } from './types';

const APPROVED_PAGE = 200;

/**
 * The ward police units a person entering for a unit may choose: the module's own list, which holds exactly the
 * units the server accepts a new request for (the general list of teams offered units the server then refused).
 */
export function useWardUnits(enabled = true) {
  const q = useQuery({
    queryKey: ['ward-assignments', 'unit-choices'],
    queryFn: () => wardAssignmentsApi.unitChoices(),
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return { ...q, data: q.data ?? [] };
}

/**
 * Who is reading the ward assignment screens. `intake`: the shared desk at PC02. No answer (an older server, a refusal,
 * no network) reads as an ordinary account; `settled` says the question is no longer being asked.
 */
export function useWardViewer() {
  const q = useQuery({
    queryKey: WARD_QUERY_KEYS.viewer,
    queryFn: async () => {
      const answer = await wardAssignmentsApi.viewer();
      return { intake: answer?.intake === true };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { intake: q.data?.intake === true, settled: !q.isLoading };
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
