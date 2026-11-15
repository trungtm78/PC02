/**
 * Shapes of `/api/v1/processing-flows` and `/api/v1/processing-calendar/years`, as the backend answers them
 * (`backend/src/processing-flow/config/processing-flows.service.ts`, `calendar/working-calendar.service.ts`). The code
 * lists themselves live in `@/shared/processing/processing-codes.generated.json`; `codes.ts` types them.
 */

export type RecordKind = 'PETITION' | 'INCIDENT' | 'CASE';
export type DurationUnit = 'HOUR' | 'DAY' | 'WORKING_DAY' | 'MONTH';
export type AnchorKind =
  | 'RECEIVED'
  | 'PROPOSED'
  | 'ASSIGNED_TO_UNIT'
  | 'ACCEPTED'
  | 'PROSECUTED'
  | 'MINUTES_RECEIVED'
  | 'PREVIOUS_STEP_DONE';
/** The anchors that are a date of the record (everything but "the previous step is done"). */
export type RecordAnchorKey = Exclude<AnchorKind, 'PREVIOUS_STEP_DONE'>;
export type PartyRole = 'MAIN' | 'CHECK' | 'COORDINATE' | 'INFORM';
export type PartyKind = 'RECORD_TEAM' | 'TEAM';
export type ConditionKey = 'CRIME_GRAVITY';
export type CrimeGravity = 'IT_NGHIEM_TRONG' | 'NGHIEM_TRONG' | 'RAT_NGHIEM_TRONG' | 'DAC_BIET_NGHIEM_TRONG';
export type DeadlineGroup = 'TO_CAO' | 'KHIEU_NAI' | 'KIEN_NGHI' | 'PHAN_ANH';
export type FlowStatus = 'ACTIVE' | 'ARCHIVED';
export type FlowVersionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
export type CalendarYearStatus = 'DRAFT' | 'CONFIRMED';
export type CalendarDayKind = 'OFF' | 'WORKING';

// ---- what the flow routes answer

export interface BoundTypeDto {
  directoryId: string;
  name: string;
  code: string;
  isActive: boolean;
  typeKey: string | null;
  currentTypeKey: string;
  /** The entry was renamed since it was bound. */
  renamed: boolean;
}

export interface VersionSummaryDto {
  id: string;
  versionNo: number;
  status: FlowVersionStatus;
  revision: number;
  note: string | null;
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  stepCount: number;
}

export interface StepPartyDto {
  partyKind: PartyKind;
  teamId: string | null;
  role: PartyRole;
  note: string | null;
  teamName: string | null;
  teamStatus: string | null;
}

export interface StepVariantDto {
  conditionKey: ConditionKey;
  conditionValue: string;
  durationValue: number;
  durationUnit: DurationUnit;
  maxExtensions: number | null;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
}

export interface StepDto {
  stepKey: string;
  order: number;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  anchor: AnchorKind;
  rollToWorkingDay: boolean;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  legalBasis: string | null;
  legalDocNumber: string | null;
  legalDocUrl: string | null;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  maxExtensions: number;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
  escalateAfterDays: number | null;
  escalateLeadershipAfterDays: number | null;
  legalVerifiedAt: string | null;
  legalVerifiedById: string | null;
  parties: StepPartyDto[];
  variants: StepVariantDto[];
}

export interface VersionDto extends VersionSummaryDto {
  steps: StepDto[];
}

export interface FlowSummaryDto {
  id: string;
  recordKind: RecordKind;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: FlowStatus;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  updatedById: string;
  boundTypes: BoundTypeDto[];
  boundGroups: string[];
  stepCount: number;
  publishedVersionNo: number | null;
  draftVersionNo: number | null;
}

export interface FlowDetailDto extends FlowSummaryDto {
  /** Newest first. */
  versions: VersionSummaryDto[];
  draft: VersionDto | null;
  published: VersionDto | null;
}

export interface LegalTemplateDto {
  key: string;
  recordKind: RecordKind;
  name: string;
  steps: unknown[];
}

export interface StepIssue {
  code: string;
  stepIndex?: number;
  stepKey?: string;
}

export interface SchedulePreviewRow {
  stepIndex: number;
  stepKey: string | null;
  startAt: string | null;
  dueAt: string | null;
  provisional: boolean;
  greenFrom: string | null;
  yellowFrom: string | null;
  redFrom: string | null;
  variant: string | null;
  problem: string | null;
}

export interface SchedulePreviewDto {
  steps: SchedulePreviewRow[];
  recordDeadline: string | null;
  provisional: boolean;
  issues: StepIssue[];
}

export interface SaveStepsResult {
  flow: FlowDetailDto;
  warnings: StepIssue[];
}

// ---- what the flow routes take

/** A party of a step as it is SENT: exactly these four fields. */
export interface PartyPayload {
  partyKind: PartyKind;
  teamId?: string;
  role: PartyRole;
  note?: string | null;
}

export interface VariantPayload {
  conditionKey: ConditionKey;
  conditionValue: string;
  durationValue: number;
  durationUnit: DurationUnit;
  maxExtensions: number | null;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
}

/** A step as it is SENT: exactly these fields and no other (`order`, `legalVerifiedAt`, `teamName` are refused). */
export interface StepPayload {
  stepKey?: string;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  anchor: AnchorKind;
  rollToWorkingDay: boolean;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  legalBasis: string | null;
  legalDocNumber: string | null;
  legalDocUrl: string | null;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  maxExtensions: number;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
  escalateAfterDays: number | null;
  escalateLeadershipAfterDays: number | null;
  parties: PartyPayload[];
  variants: VariantPayload[];
}

export interface CreateFlowBody {
  name?: string;
  recordKind: RecordKind;
  description?: string | null;
  isDefault?: boolean;
  copyFromFlowId?: string;
  templateKey?: string;
}

export interface UpdateFlowBody {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  expectedRevision: number;
}

export interface PreviewScheduleBody {
  recordKind: RecordKind;
  steps: StepPayload[];
  anchors?: Partial<Record<RecordAnchorKey, string>>;
  conditions?: Partial<Record<ConditionKey, string>>;
}

// ---- the working calendar

export interface CalendarDayDto {
  date: string;
  kind: CalendarDayKind;
  label: string | null;
}

export interface CalendarYearSummaryDto {
  id: string;
  year: number;
  weekendDays: number[];
  status: CalendarYearStatus;
  revision: number;
  daysOff: number;
  workingDays: number;
  note: string | null;
  confirmedById: string | null;
  confirmedAt: string | null;
  updatedAt: string;
}

export interface CalendarYearDto {
  id: string;
  year: number;
  weekendDays: number[];
  status: CalendarYearStatus;
  revision: number;
  confirmedById: string | null;
  confirmedAt: string | null;
  note: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  days: CalendarDayDto[];
}

export interface CalendarYearRead {
  year: number;
  stored: CalendarYearDto | null;
}

/** The row and revision a writer looked at. */
export interface CalendarExpectation {
  id: string;
  revision: number;
}

export interface SaveCalendarYearBody {
  weekendDays: number[];
  days: Array<{ date: string; kind: CalendarDayKind; label?: string }>;
  note?: string;
  expected: CalendarExpectation | null;
}
