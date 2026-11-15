/**
 * Shapes of `/api/v1/processing/records/:kind/:id/...` as the backend answers them
 * (`backend/src/processing-flow/records/record-flow.dto.ts`, `processing-results.service.ts`). The code lists live in
 * `@/shared/processing/processing-codes.generated.json`.
 */
import type { RecordKind } from '../types';

export type { RecordKind };

export type StepStatus = 'WAITING_ANCHOR' | 'OPEN' | 'REPORTED' | 'DONE' | 'SKIPPED';
export type Band = 'OVERDUE' | 'RED' | 'YELLOW' | 'GREEN' | 'NONE';
export type CompletionClass = 'DONE_ON_TIME' | 'DONE_LATE' | 'OPEN_IN_TIME' | 'OPEN_OVERDUE';
export type ReportKind = 'PROGRESS' | 'RESULT';
export type OpinionKind = 'SUPERVISOR' | 'COORDINATE' | 'CHECK' | 'APPROVAL';
/** The roles a person can give an opinion in (the leader decides through `decision`, not an opinion). */
export type SpeakingKind = Exclude<OpinionKind, 'APPROVAL'>;
export type DecisionVerdict = 'AGREE' | 'DISAGREE' | 'OTHER_DIRECTION';

/** One person who answers for a party of a step. */
export interface ResponsiblePersonDto {
  userId: string;
  name: string;
}

export interface RecordStepPartyDto {
  /** The row of the party: what the assignment routes name. */
  id: string;
  partyKind: string;
  teamId: string | null;
  teamName: string | null;
  role: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  /** Who answers for the party: the person named, otherwise the heads of its unit. */
  responsible: ResponsiblePersonDto[];
  note: string | null;
}

/** A person who may be named on a party: an active member of its unit. */
export interface CandidateDto {
  userId: string;
  name: string;
  isLeader: boolean;
}

export interface RecordStepDto {
  stepKey: string;
  order: number;
  name: string;
  description: string | null;
  status: StepStatus;
  anchor: string;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  legalBasis: string | null;
  startAt: string | null;
  regulatoryDueAt: string | null;
  internalDueAt: string | null;
  /** The earlier of the two deadlines: the one the colour counts down to. */
  dueAt: string | null;
  greenFrom: string | null;
  yellowFrom: string | null;
  redFrom: string | null;
  thresholds: { redDays: number; yellowDays: number; greenDays: number };
  extensionsAllowed: number;
  extensionsUsed: number;
  band: Band;
  remainingDays: number | null;
  completion: CompletionClass | null;
  provisional: boolean;
  /** An error code of the contract: why the step has no deadline. */
  problem: string | null;
  deadlineRevision: number;
  upstreamReopened: boolean;
  doneAt: string | null;
  skippedAt: string | null;
  skippedFrom: StepStatus | null;
  revision: number;
  parties: RecordStepPartyDto[];
  latestReport: { kind: string; summary: string; at: string; revision: number } | null;
  latestOpinion: { kind: string; verdict: string; at: string } | null;
  /**
   * What the person looking may do on the step BY THEIR ROLE on it (the rules the write routes refuse with). A form is
   * offered only when the permission AND this allow it. Absent in an answer of an older server: permissions alone decide.
   */
  viewer?: StepViewerDto;
}

export interface StepViewerDto {
  canReport: boolean;
  opinionKinds: SpeakingKind[];
  canApprove: boolean;
  /** The parties of the step whose (active) unit the person belongs to: where they may take the work themself. */
  memberOfPartyIds: string[];
  /** The parties of the step whose (active) unit the person heads: there they may name anybody of the unit. */
  leaderOfPartyIds: string[];
}

export interface RecordFlowDto {
  id: string;
  recordKind: string;
  recordId: string;
  flowId: string;
  flowName: string;
  versionNo: number;
  match: string;
  /** `false`: only a proposal, no legal deadline is asserted yet. */
  confirmed: boolean;
  acceptedAt: string | null;
  pausedSince: string | null;
  suspended: boolean;
  revision: number;
  steps: RecordStepDto[];
}

export interface DocumentRef {
  type?: string;
  number?: string;
  date?: string;
}

/** A file attached to a report: a document of the record, listed under the report it was attached to. */
export interface ReportAttachmentDto {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  uploaderName: string | null;
}

export interface ReportDto {
  id: string;
  kind: string;
  doneWork: string;
  findings?: string | null;
  difficulties?: string | null;
  proposalKind?: string | null;
  proposalContent?: string | null;
  proposalBasis?: string | null;
  documents?: DocumentRef[] | null;
  authorId: string;
  authorName: string | null;
  authorTeamId: string | null;
  revision: number;
  withdrawnAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  /** Somebody has given an opinion on it: it can no longer be edited or taken back. */
  answered: boolean;
  /** Its files, oldest first (removed ones are not listed). */
  attachments: ReportAttachmentDto[];
}

export interface OpinionDto {
  id: string;
  kind: string;
  verdict: string;
  content: string | null;
  reportId: string | null;
  reportRevision: number | null;
  authorId: string;
  authorName: string | null;
  authorTeamId: string | null;
  withdrawnAt: string | null;
  createdAt: string;
}

export interface ResultsDto {
  reports: ReportDto[];
  opinions: OpinionDto[];
}

// ---- what the routes take. Every write carries the revision of the flow as the screen read it.

export interface WriteBase {
  expectedRevision: number;
  /** A fresh key per user action; a retry of the SAME action sends the same key. */
  idempotencyKey?: string;
}

export interface ReportFields {
  doneWork: string;
  findings?: string;
  difficulties?: string;
  proposalKind?: string;
  proposalContent?: string;
  proposalBasis?: string;
  documents?: DocumentRef[];
}

export type SubmitReportBody = WriteBase & ReportFields & { kind: ReportKind };
export type EditReportBody = WriteBase & ReportFields;
export type OpinionBody = WriteBase & { kind: SpeakingKind; verdict?: string; content?: string };
export type DecisionBody = WriteBase & { verdict: DecisionVerdict; content?: string };
/** `userId: null` gives the party back to the heads of its unit. */
export type AssignPartyBody = WriteBase & { userId: string | null };
export type ReasonBody = WriteBase & { reason?: string };
export type AdjustDueBody = WriteBase & { date: string | null; reason?: string };
