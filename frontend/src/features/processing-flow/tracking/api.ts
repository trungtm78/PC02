import { api } from '@/lib/api';
import type { TrackedBand, TrackingFilters, TrackingItemsDto, TrackingSummaryDto } from './types';

const data = <T>(r: { data: T }): T => r.data;

const BASE = '/processing/tracking';

/** Only what is set goes on the wire: the server validates every key it is sent. */
const filterParams = (filters: TrackingFilters): Record<string, string | boolean> => ({
  ...(filters.mine ? { mine: true } : {}),
  ...(filters.teamId ? { teamId: filters.teamId } : {}),
  ...(filters.kind ? { kind: filters.kind } : {}),
});

export interface TrackingItemsQuery extends TrackingFilters {
  /** The card that was clicked; `null`: every colour. */
  band: TrackedBand | null;
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

  items: (query: TrackingItemsQuery) =>
    api
      .get<TrackingItemsDto>(`${BASE}/items`, {
        params: {
          ...filterParams(query),
          ...(query.band ? { band: query.band } : {}),
          asOf: query.asOf,
          page: query.page,
          pageSize: query.pageSize,
        },
      })
      .then(data),
};
