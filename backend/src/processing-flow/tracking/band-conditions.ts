import type { Prisma } from '@prisma/client';
import { bandWhere, colouredWhere, type BandRow, type BandWhere } from '../engine/bands';
import type { Band } from '../engine/types';

/** The bands a card of the tracking screen counts: every colour. `NONE` (not near its deadline yet) has no card. */
export const TRACKED_BANDS = ['OVERDUE', 'RED', 'YELLOW', 'GREEN'] as const;
export type TrackedBand = (typeof TRACKED_BANDS)[number];

/**
 * The column each stored instant lives in. A step counts down to the EARLIER of its two deadlines, and the unit's own
 * (`internalDueAt`) is never later than the regulatory one, so it IS that deadline whenever the step has one.
 */
const STEP_COLUMN: Record<keyof BandRow, string> = { dueAt: 'internalDueAt', redFrom: 'redFrom', yellowFrom: 'yellowFrom', greenFrom: 'greenFrom' };
const FLOW_COLUMN: Record<keyof BandRow, string> = { dueAt: 'alertDueAt', redFrom: 'alertRedFrom', yellowFrom: 'alertYellowFrom', greenFrom: 'alertGreenFrom' };

const rename = (where: BandWhere, columns: Record<keyof BandRow, string>): Record<string, unknown> =>
  Object.fromEntries((Object.keys(where) as Array<keyof BandRow>).map((field) => [columns[field], where[field]]));

export interface BandConditions {
  /** For `ProcRecordStep`: the steps in the band. */
  step: Prisma.ProcRecordStepWhereInput;
  /** For `ProcRecordFlow`: the records whose WORST step is in the band (the stored alert). */
  flow: Prisma.ProcRecordFlowWhereInput;
}

/**
 * THE condition "in this band at this instant", for a count and for the list behind it: both call this with the same
 * `now`, so the number on a card is the number of rows. `band: null` = any colour (everything but NONE).
 *
 * `now` is always the APPLICATION's clock, passed in: these are comparisons between a stored instant and a parameter,
 * never with the database's `NOW()` (a `timestamp without time zone` column compared with it is off by the session's
 * time zone).
 *
 * A row whose instants are NULL (a step with no deadline, a record with no alert) is in NO band: every answer compares
 * at least one of them with `now`.
 */
export function bandConditions(band: Band | null, now: Date): BandConditions {
  const where = band === null ? colouredWhere(now) : bandWhere(band, now);
  return { step: rename(where, STEP_COLUMN), flow: rename(where, FLOW_COLUMN) };
}
