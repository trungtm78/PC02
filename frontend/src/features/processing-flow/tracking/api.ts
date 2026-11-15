import { api } from '@/lib/api';
import { DEFAULT_TRACKING_ROLE, type TrackedBand, type TrackingFilters, type TrackingRole, type TrackingItemsDto, type TrackingSummaryDto, type TrackingTeamDto } from './types';

const data = <T>(r: { data: T }): T => r.data;

const BASE = '/processing/tracking';

/** Only what is set goes on the wire: the server validates every key it is sent. */
const filterParams = (filters: TrackingFilters): Record<string, string | boolean> => ({
  ...(filters.mine ? { mine: true } : {}),
  ...(filters.teamId ? { teamId: filters.teamId } : {}),
  ...(filters.kind ? { kind: filters.kind } : {}),
  ...(filters.role !== DEFAULT_TRACKING_ROLE ? { role: filters.role } : {}),
  ...(filters.q ? { q: filters.q } : {}),
});

/** What the unit filter is asked with. */
export interface TrackingTeamsQuery {
  role: TrackingRole;
  awaiting: boolean;
}

export interface TrackingItemsQuery extends TrackingFilters {
  /** The card that was clicked; `null`: every colour. */
  band: TrackedBand | null;
  /** The card "Chờ tôi duyệt" was clicked: the list is the work waiting for this person's decision, whatever its band. */
  awaiting: boolean;
  /** The `asOf` the summary answered: the list is judged at the instant the cards were. */
  asOf: string;
  page: number;
  pageSize: number;
}

/**
 * The two calls of the tracking screen. The server answers 404 while the switch `processing_flow_records` is off and
 * 403 without `read:ProcessingStep`.
 */
export const trackingApi = {
  /** Asked with no `asOf`: the server uses its clock and says which instant that was. */
  summary: (filters: TrackingFilters) => api.get<TrackingSummaryDto>(`${BASE}/summary`, { params: filterParams(filters) }).then(data),

  /**
   * The units holding the work the SCREEN lists (its role; with the card "Chờ tôi duyệt", the work waiting for the
   * person's decision): what the unit filter offers (no `read:Team` needed).
   */
  teams: (asked: TrackingTeamsQuery) =>
    api
      .get<TrackingTeamDto[]>(`${BASE}/teams`, {
        params: { ...(asked.role !== DEFAULT_TRACKING_ROLE ? { role: asked.role } : {}), ...(asked.awaiting ? { awaiting: 'approval' } : {}) },
      })
      .then(data),

  items: (query: TrackingItemsQuery) =>
    api
      .get<TrackingItemsDto>(`${BASE}/items`, {
        params: {
          ...filterParams(query),
          // The two are exclusive: the server does not read a band on the list of work waiting for a decision.
          ...(query.awaiting ? { awaiting: 'approval' } : query.band ? { band: query.band } : {}),
          asOf: query.asOf,
          page: query.page,
          pageSize: query.pageSize,
        },
      })
      .then(data),
};
