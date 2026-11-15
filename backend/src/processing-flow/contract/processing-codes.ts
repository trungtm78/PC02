/**
 * The codes of the processing flow that travel between the server, the web screen and the Flutter app.
 *
 * ONE list per code family, here. `npm run gen:processing-codes` writes the same JSON for the web
 * (`frontend/src/shared/processing/processing-codes.generated.json`) and for Flutter
 * (`mobile/assets/contract/processing-codes.json`); `processing-codes.spec.ts` fails when either file differs from what
 * these lists say now. A code is WIRE FORMAT: it is stored and translated by the screens, so renaming one needs a
 * migration and a new translation, never a quiet edit.
 */

/** The kinds of record a processing flow can be attached to. */
export const RECORD_KINDS = ['PETITION', 'INCIDENT', 'CASE'] as const;

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

/**
 * Where the alert of a record on a list comes from: the steps of its flow, or (a record with no flow) its own
 * `deadline` column.
 */
export const ALERT_SOURCES = ['FLOW', 'RECORD_DEADLINE'] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];
export const ALERT_SOURCE = { FLOW: 'FLOW', RECORD_DEADLINE: 'RECORD_DEADLINE' } as const satisfies { [K in AlertSource]: K };

/** What a unit is to a step. */
export const PARTY_ROLES = ['MAIN', 'CHECK', 'COORDINATE', 'INFORM'] as const;

/** Who a party of a step is: the unit that holds the record (resolved per record), or one named unit. */
export const PARTY_KINDS = ['RECORD_TEAM', 'TEAM'] as const;

/** A fact of the record that picks another duration for a step. */
export const CONDITION_KEYS = ['CRIME_GRAVITY'] as const;

/** The values of `CRIME_GRAVITY`: the gravity of the crime of a case (the database enum `CapDoToiPham`). */
export const CRIME_GRAVITIES = ['IT_NGHIEM_TRONG', 'NGHIEM_TRONG', 'RAT_NGHIEM_TRONG', 'DAC_BIET_NGHIEM_TRONG'] as const;

/** The deadline groups of a petition a flow can be bound to (the database enum `LoaiDon`). */
export const DEADLINE_GROUPS = ['TO_CAO', 'KHIEU_NAI', 'KIEN_NGHI', 'PHAN_ANH'] as const;

export const FLOW_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

/** `PUBLISHED`: the version records follow; it never changes again. `SUPERSEDED`: a published version replaced by a later one. */
export const FLOW_VERSION_STATUSES = ['DRAFT', 'PUBLISHED', 'SUPERSEDED'] as const;

/**
 * How a record found its flow. `UNKNOWN_TYPE`: its information type matches no catalogue entry, so the default flow is
 * only a proposal a person has to confirm.
 */
export const FLOW_MATCHES = ['TYPE', 'GROUP', 'DEFAULT', 'UNKNOWN_TYPE'] as const;

export const STEP_STATUSES = ['WAITING_ANCHOR', 'OPEN', 'REPORTED', 'DONE', 'SKIPPED'] as const;

/** A step against its deadline, for the statistics. */
export const COMPLETION_CLASSES = ['DONE_ON_TIME', 'DONE_LATE', 'OPEN_IN_TIME', 'OPEN_OVERDUE'] as const;

/** What a unit reports on a step: progress so far, or its result. */
export const REPORT_KINDS = ['PROGRESS', 'RESULT'] as const;

/** Who is speaking in an opinion on a step. */
export const OPINION_KINDS = ['SUPERVISOR', 'COORDINATE', 'CHECK', 'APPROVAL'] as const;

/** What an opinion decides, if anything (`NOTE`: nothing). CHECK uses PASS / REQUEST_REWORK, APPROVAL uses AGREE / DISAGREE / OTHER_DIRECTION. */
export const OPINION_VERDICTS = ['NOTE', 'PASS', 'REQUEST_REWORK', 'AGREE', 'DISAGREE', 'OTHER_DIRECTION'] as const;

/** The ways a unit may propose to settle a record, by kind of record. */
export const PROPOSAL_KINDS = {
  PETITION: ['REPLY', 'SAVE_FILE', 'TRANSFER_TO_INCIDENT', 'TRANSFER_TO_CASE', 'TRANSFER_TO_UNIT', 'EXTEND', 'OTHER'],
  INCIDENT: ['PROSECUTE', 'NOT_PROSECUTE', 'SUSPEND', 'TRANSFER_TO_UNIT', 'MERGE', 'EXTEND', 'OTHER'],
  CASE: ['SUSPEND', 'RESUME', 'CLOSE', 'TRANSFER_TO_UNIT', 'EXTEND', 'OTHER'],
} as const;

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
  // the life of a step of a record
  'STEP_TRANSITION_INVALID',
  'STEP_NEEDS_APPROVAL',
  'STEP_APPROVAL_NOT_REQUIRED',
  'STEP_DEPENDENT_STARTED',
  'RECORD_FLOW_NOT_FOUND',
  'RECORD_STEP_NOT_FOUND',
  'FLOW_ALREADY_CONFIRMED',
  'FLOW_HAS_PROGRESS',
  'NO_FLOW_FOR_RECORD',
  'STEP_HAS_NO_DEADLINE',
  'DUE_DATE_INVALID',
  'INTERNAL_DUE_AFTER_REGULATORY',
  'EXTENSION_NOT_ALLOWED',
  'DEADLINE_MANAGED_BY_FLOW',
  // results of a step
  'NOT_A_PARTY_OF_STEP',
  'STEP_NOT_OPEN',
  'STEP_NOT_REPORTED',
  'REPORT_TEXT_REQUIRED',
  'REPORT_NOT_FOUND',
  'REPORT_ANSWERED',
  'REPORT_NOT_YOURS',
  'PROPOSAL_KIND_UNKNOWN',
  'DOCUMENTS_INVALID',
  'NO_RESULT_REPORT',
  'OPINION_NOT_FOUND',
  'OPINION_NOT_ALLOWED',
  'OPINION_NOT_YOURS',
  'OPINION_ANSWERED',
  'ATTACHMENT_NOT_FOUND',
  'RECORD_FINISHED',
  'VERDICT_INVALID',
  'ACCEPTED_DATE_INVALID',
  'ACCEPTED_ALREADY_RECORDED',
  'STEP_REASON_REQUIRED',
  'IDEMPOTENCY_KEY_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  // the working calendar
  'REVISION_CONFLICT',
  'CALENDAR_YEAR_NOT_FOUND',
  'CALENDAR_YEAR_INVALID',
  'CALENDAR_WEEKEND_INVALID',
  'CALENDAR_DAY_INVALID',
  'CALENDAR_YEAR_CONFIRMED',
  'CALENDAR_YEAR_ALREADY_CONFIRMED',
  'CALENDAR_YEAR_NOT_CONFIRMED',
  // the flow configuration: requests
  'EXPECTED_REVISION_INVALID',
  'RECORD_KIND_INVALID',
  'FLOW_NOT_FOUND',
  'FLOW_VERSION_NOT_FOUND',
  'FLOW_STEP_NOT_FOUND',
  'FLOW_NAME_REQUIRED',
  'FLOW_NAME_TAKEN',
  'DEFAULT_FLOW_EXISTS',
  'FLOW_SOURCE_AMBIGUOUS',
  'FLOW_SOURCE_NOT_FOUND',
  'SOURCE_KIND_MISMATCH',
  'TEMPLATE_UNKNOWN',
  'FLOW_ARCHIVED',
  'FLOW_ALREADY_ARCHIVED',
  'FLOW_NOT_ARCHIVED',
  'TYPE_ALREADY_BOUND',
  'DIRECTORY_BOUND_TO_FLOW',
  'TYPE_UNKNOWN',
  'GROUP_UNKNOWN',
  'GROUP_NOT_FOR_KIND',
  'FLOW_IN_USE',
  'CONFIRMATION_MISMATCH',
  'DRAFT_ALREADY_EXISTS',
  'VERSION_IMMUTABLE',
  'STEPS_INVALID',
  'STEP_KEY_UNKNOWN',
  'TEAM_UNKNOWN',
  'TEAM_NOT_ACTIVE',
  'FLOW_INVALID',
  'LEGAL_BASIS_REQUIRED',
  'LEGAL_ALREADY_VERIFIED',
  'LEGAL_NOT_VERIFIED',
  'PREVIEW_ANCHORS_INVALID',
  // the flow configuration: what makes a version unfit to publish (`FLOW_INVALID` lists them)
  'FLOW_HAS_NO_STEPS',
  'STEP_NAME_REQUIRED',
  'STEP_NEEDS_ONE_MAIN',
  'DUPLICATE_PARTY',
  'EXTENSION_INCOMPLETE',
  'ANCHOR_NOT_AVAILABLE_FOR_KIND',
  'PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP',
  'MULTIPLE_RECORD_DEADLINE_STEPS',
  'VARIANT_DUPLICATE',
  'VARIANT_NOT_AVAILABLE_FOR_KIND',
  // the schedule preview
  'ANCHOR_DATE_MISSING',
  'PARTY_NOT_FOUND',
  'STEP_CLOSED',
  'ASSIGNEE_NOT_ELIGIBLE',
  'ASSIGN_NOT_ALLOWED',
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
    recordKinds: [...RECORD_KINDS],
    durationUnits: [...DURATION_UNITS],
    anchorKinds: [...ANCHOR_KINDS],
    bands: [...BANDS],
    alertSources: [...ALERT_SOURCES],
    partyRoles: [...PARTY_ROLES],
    partyKinds: [...PARTY_KINDS],
    conditionKeys: [...CONDITION_KEYS],
    crimeGravities: [...CRIME_GRAVITIES],
    deadlineGroups: [...DEADLINE_GROUPS],
    flowStatuses: [...FLOW_STATUSES],
    flowVersionStatuses: [...FLOW_VERSION_STATUSES],
    flowMatches: [...FLOW_MATCHES],
    stepStatuses: [...STEP_STATUSES],
    completionClasses: [...COMPLETION_CLASSES],
    reportKinds: [...REPORT_KINDS],
    opinionKinds: [...OPINION_KINDS],
    opinionVerdicts: [...OPINION_VERDICTS],
    proposalKinds: Object.fromEntries(Object.entries(PROPOSAL_KINDS).map(([kind, list]) => [kind, [...list]])),
    calendarYearStatuses: [...CALENDAR_YEAR_STATUSES],
    calendarDayKinds: [...CALENDAR_DAY_KINDS],
    errorCodes: [...PROCESSING_ERROR_CODES],
  };
}

/** The exact bytes of both generated files (LF line ends, one trailing newline). */
export function renderProcessingCodes(): string {
  return `${JSON.stringify(processingCodes(), null, 2)}\n`;
}
