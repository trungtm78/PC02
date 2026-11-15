/** What the tracking screen keeps outside its component: its keys in the address, its query keys, and the deadline's words. */
import { formatVNDate, formatVNTime } from '@/lib/dates';
import type { TrackedBand, TrackingFilters } from './types';

/** The prefix of every key this screen keeps in the address: `tracking_band`, `tracking_page`, ... */
export const TRACKING_URL_PREFIX = 'tracking';
/** The rows of one page: the server's own default. */
export const TRACKING_PAGE_SIZE = 20;

export const TRACKING_QUERY_KEYS = {
  all: ['processing-tracking'] as const,
  teams: ['processing-tracking', 'teams'] as const,
  summary: (filters: TrackingFilters) => ['processing-tracking', 'summary', filters] as const,
  items: (filters: TrackingFilters, band: TrackedBand | null, page: number, asOf: string) =>
    ['processing-tracking', 'items', filters, band, page, asOf] as const,
};

/** The hour a deadline that is the end of a civil day falls on in Vietnam: such a deadline is shown as its day alone. */
const END_OF_DAY = '23:59';

/** "11/12/2026", or with the hour when the deadline is not the end of a day (a step counted in hours). */
export function dueText(dueAt: string): string {
  const day = formatVNDate(dueAt);
  const time = formatVNTime(dueAt);
  return time === END_OF_DAY ? day : `${day} ${time}`;
}
