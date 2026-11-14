import type {
  ANCHOR_KINDS,
  BANDS,
  CALENDAR_DAY_KINDS,
  CALENDAR_YEAR_STATUSES,
  COMPLETION_CLASSES,
  DURATION_UNITS,
  PARTY_ROLES,
  STEP_STATUSES,
} from '../contract/processing-codes';

/**
 * The string unions of the processing flow. Each is derived from the one list in `contract/processing-codes.ts`, the
 * same list the web and Flutter read, so a code cannot exist on one side only.
 */

/** HOUR | DAY | WORKING_DAY | MONTH */
export type DurationUnit = (typeof DURATION_UNITS)[number];
/** RECEIVED | PROPOSED | ASSIGNED_TO_UNIT | ACCEPTED | PROSECUTED | MINUTES_RECEIVED | PREVIOUS_STEP_DONE */
export type AnchorKind = (typeof ANCHOR_KINDS)[number];
/** OVERDUE | RED | YELLOW | GREEN | NONE */
export type Band = (typeof BANDS)[number];
/** MAIN | CHECK | COORDINATE | INFORM */
export type PartyRole = (typeof PARTY_ROLES)[number];
/** WAITING_ANCHOR | OPEN | REPORTED | DONE | SKIPPED */
export type StepStatus = (typeof STEP_STATUSES)[number];
/** DONE_ON_TIME | DONE_LATE | OPEN_IN_TIME | OPEN_OVERDUE */
export type CompletionClass = (typeof COMPLETION_CLASSES)[number];
/** DRAFT | CONFIRMED */
export type CalendarYearStatus = (typeof CALENDAR_YEAR_STATUSES)[number];
/** OFF | WORKING */
export type CalendarDayKind = (typeof CALENDAR_DAY_KINDS)[number];
