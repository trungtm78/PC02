/**
 * Shapes of `/api/v1/processing/tracking/...` as the backend answers them
 * (`backend/src/processing-flow/tracking/processing-tracking.service.ts`).
 */
import raw from '@/shared/processing/processing-codes.generated.json';
import type { RecordKind } from '../types';

export type TrackedBand = 'OVERDUE' | 'RED' | 'YELLOW' | 'GREEN';

/** The bands that have a card: every colour of the contract. `NONE` (not near its deadline yet) has none. */
export const TRACKED_BANDS = raw.bands.filter((band) => band !== 'NONE') as readonly TrackedBand[];

/** The filters the cards and the list share. */
export interface TrackingFilters {
  mine: boolean;
  teamId: string | null;
  kind: RecordKind | null;
}

export interface TrackingSummaryDto {
  /** The instant the counts were judged at: passed back as `asOf` with every list call, so the two agree. */
  asOf: string;
  counts: Record<TrackedBand, number>;
}

export interface TrackingItemDto {
  recordKind: RecordKind;
  recordId: string;
  recordCode: string | null;
  recordLabel: string | null;
  stepKey: string;
  stepName: string;
  teamId: string | null;
  teamName: string | null;
  assigneeUserId: string | null;
  responsibleName: string | null;
  dueAt: string;
  band: string;
  remainingDays: number;
}

export interface TrackingItemsDto {
  asOf: string;
  band: TrackedBand | null;
  items: TrackingItemDto[];
  total: number;
  page: number;
  pageSize: number;
}
