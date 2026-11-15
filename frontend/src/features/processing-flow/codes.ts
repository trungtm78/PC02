/** The code lists of the processing contract, typed. The JSON is generated from the backend: never edit it by hand. */
import raw from '@/shared/processing/processing-codes.generated.json';
import type {
  AnchorKind,
  CalendarDayKind,
  CalendarYearStatus,
  CrimeGravity,
  DeadlineGroup,
  DurationUnit,
  PartyKind,
  PartyRole,
  RecordKind,
} from './types';

export const RECORD_KINDS = raw.recordKinds as readonly RecordKind[];
export const DURATION_UNITS = raw.durationUnits as readonly DurationUnit[];
export const ANCHOR_KINDS = raw.anchorKinds as readonly AnchorKind[];
export const PARTY_ROLES = raw.partyRoles as readonly PartyRole[];
export const PARTY_KINDS = raw.partyKinds as readonly PartyKind[];
export const CRIME_GRAVITIES = raw.crimeGravities as readonly CrimeGravity[];
export const DEADLINE_GROUPS = raw.deadlineGroups as readonly DeadlineGroup[];
export const CALENDAR_YEAR_STATUSES = raw.calendarYearStatuses as readonly CalendarYearStatus[];
export const CALENDAR_DAY_KINDS = raw.calendarDayKinds as readonly CalendarDayKind[];
/** Every code the server may answer with. Each one has a sentence in `locales/processingFlow.vi.ts`. */
export const ERROR_CODES = raw.errorCodes as readonly string[];

/** Whether the server's error code is one of the two the screens act on rather than only show. */
export const CODE = {
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  FLOW_IN_USE: 'FLOW_IN_USE',
  FLOW_INVALID: 'FLOW_INVALID',
  TEAM_NOT_ACTIVE: 'TEAM_NOT_ACTIVE',
  STEPS_INVALID: 'STEPS_INVALID',
  TYPE_ALREADY_BOUND: 'TYPE_ALREADY_BOUND',
  DEFAULT_FLOW_EXISTS: 'DEFAULT_FLOW_EXISTS',
  DRAFT_ALREADY_EXISTS: 'DRAFT_ALREADY_EXISTS',
} as const;
