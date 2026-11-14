/**
 * The codes of the processing flow that travel between the server, the web screen and the Flutter app.
 *
 * ONE list per code family, here. `npm run gen:processing-codes` writes the same JSON for the web
 * (`frontend/src/shared/processing/processing-codes.generated.json`) and for Flutter
 * (`mobile/assets/contract/processing-codes.json`); `processing-codes.spec.ts` fails when either file differs from what
 * these lists say now. A code is WIRE FORMAT: it is stored and translated by the screens, so renaming one needs a
 * migration and a new translation, never a quiet edit.
 */

/** How the duration of a step is counted. */
export const DURATION_UNITS = ['HOUR', 'DAY', 'WORKING_DAY', 'MONTH'] as const;

/** The date a step's deadline is counted from. All but the last are dates of the record itself. */
export const ANCHOR_KINDS = [
  'RECEIVED',
  'PROPOSED',
  'ASSIGNED_TO_UNIT',
  'ACCEPTED',
  'PROSECUTED',
  'MINUTES_RECEIVED',
  'PREVIOUS_STEP_DONE',
] as const;

/** The alert colour of a deadline, worst first. `NONE`: further away than the green threshold. */
export const BANDS = ['OVERDUE', 'RED', 'YELLOW', 'GREEN', 'NONE'] as const;

/** What a unit is to a step. */
export const PARTY_ROLES = ['MAIN', 'CHECK', 'COORDINATE', 'INFORM'] as const;

export const STEP_STATUSES = ['WAITING_ANCHOR', 'OPEN', 'REPORTED', 'DONE', 'SKIPPED'] as const;

/** A step against its deadline, for the statistics. */
export const COMPLETION_CLASSES = ['DONE_ON_TIME', 'DONE_LATE', 'OPEN_IN_TIME', 'OPEN_OVERDUE'] as const;

export const CALENDAR_YEAR_STATUSES = ['DRAFT', 'CONFIRMED'] as const;

/** `OFF`: a day off. `WORKING`: a compensatory working day that falls on a weekend. */
export const CALENDAR_DAY_KINDS = ['OFF', 'WORKING'] as const;

/** Refusals, by code. The screens translate the code; no display text travels. */
export const PROCESSING_ERROR_CODES = [
  // the calculation engine
  'HOUR_ANCHOR_HAS_NO_TIME',
  'DURATION_INVALID',
  'ANCHOR_INVALID',
  'THRESHOLDS_NOT_ASCENDING',
  'PAUSE_INVALID',
  'CALENDAR_HAS_NO_WORKING_DAY',
  // the working calendar
  'REVISION_CONFLICT',
  'CALENDAR_YEAR_NOT_FOUND',
  'CALENDAR_YEAR_INVALID',
  'CALENDAR_WEEKEND_INVALID',
  'CALENDAR_DAY_INVALID',
  'CALENDAR_YEAR_CONFIRMED',
  'CALENDAR_YEAR_ALREADY_CONFIRMED',
  'CALENDAR_YEAR_NOT_CONFIRMED',
] as const;

export type ProcessingErrorCode = (typeof PROCESSING_ERROR_CODES)[number];

/** The same names as constants, so that code never spells a code as a string literal. */
export const PROCESSING_ERROR = Object.fromEntries(PROCESSING_ERROR_CODES.map((code) => [code, code])) as {
  readonly [K in ProcessingErrorCode]: K;
};

/** Where the generated copies live, from the repository root. */
export const PROCESSING_CODES_TARGETS = [
  'frontend/src/shared/processing/processing-codes.generated.json',
  'mobile/assets/contract/processing-codes.json',
] as const;

export function processingCodes() {
  return {
    _generated: 'Do not edit by hand. Source: backend/src/processing-flow/contract/processing-codes.ts. Re-run in backend: npm run gen:processing-codes',
    durationUnits: [...DURATION_UNITS],
    anchorKinds: [...ANCHOR_KINDS],
    bands: [...BANDS],
    partyRoles: [...PARTY_ROLES],
    stepStatuses: [...STEP_STATUSES],
    completionClasses: [...COMPLETION_CLASSES],
    calendarYearStatuses: [...CALENDAR_YEAR_STATUSES],
    calendarDayKinds: [...CALENDAR_DAY_KINDS],
    errorCodes: [...PROCESSING_ERROR_CODES],
  };
}

/** The exact bytes of both generated files (LF line ends, one trailing newline). */
export function renderProcessingCodes(): string {
  return `${JSON.stringify(processingCodes(), null, 2)}\n`;
}
