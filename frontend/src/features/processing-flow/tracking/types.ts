/**
 * Shapes of `/api/v1/processing/tracking/...` as the backend answers them
 * (`backend/src/processing-flow/tracking/processing-tracking.service.ts`).
 */
import raw from '@/shared/processing/processing-codes.generated.json';
import type { RecordKind } from '../types';

export type TrackedBand = 'OVERDUE' | 'RED' | 'YELLOW' | 'GREEN';

/** The bands that have a card: every colour of the contract. `NONE` (not near its deadline yet) has none. */
export const TRACKED_BANDS = raw.bands.filter((band) => band !== 'NONE') as readonly TrackedBand[];

/** The part a unit plays in a step that makes the step its work (INFORM is never work). */
export type TrackingRole = 'MAIN' | 'CHECK' | 'COORDINATE';
export const TRACKING_ROLES: readonly TrackingRole[] = ['MAIN', 'CHECK', 'COORDINATE'];
/** What the server uses when no role is sent; never written to the address. */
export const DEFAULT_TRACKING_ROLE: TrackingRole = 'MAIN';

/** The shortest and the longest text the search box sends: the server refuses anything else. */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;

/** The filters the cards and the list share. */
export interface TrackingFilters {
  mine: boolean;
  teamId: string | null;
  kind: RecordKind | null;
  role: TrackingRole;
  /** The search, trimmed, of at least `SEARCH_MIN` characters; `null`: no search. */
  q: string | null;
}

export interface TrackingSummaryDto {
  /** The instant the counts were judged at: passed back as `asOf` with every list call, so the two agree. */
  asOf: string;
  counts: Record<TrackedBand, number>;
  /**
   * The records within the same reach and filters whose flow is only a proposal (nobody confirmed it): their work
   * asserts no deadline, so it is in none of the four counts. Absent in the answer of an older server.
   */
  unconfirmed?: number;
  /**
   * The work that waits for THIS person's decision, for the same filters: the rows the list answers with
   * `awaiting=approval`. 0 for a person who may not approve. Absent in the answer of an older server.
   */
  awaitingMyApproval?: number;
}

export interface TrackingItemDto {
  /**
   * The identity of this piece of work (the party row). Two MAIN parties of one step share the record and the step,
   * so rows are keyed by this and by nothing else.
   */
  id: string;
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
  /** Who acts for the responsible person(s) right now under a delegation; absent or `null` when nobody does. */
  delegateName?: string | null;
  /** `null` only on the list of work waiting for a decision: a step with no deadline still waits. */
  dueAt: string | null;
  band: string;
  remainingDays: number | null;
}

export interface TrackingItemsDto {
  asOf: string;
  band: TrackedBand | null;
  items: TrackingItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** A unit the filter offers (`GET /processing/tracking/teams`). */
export interface TrackingTeamDto {
  id: string;
  name: string;
  parentTeamId: string | null;
}
