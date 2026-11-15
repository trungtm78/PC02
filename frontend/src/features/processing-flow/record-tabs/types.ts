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

export interface RecordStepPartyDto {
  partyKind: string;
  teamId: string | null;
  teamName: string | null;
  role: string;
  assigneeUserId: string | null;
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
export type ReasonBody = WriteBase & { reason?: string };
export type AdjustDueBody = WriteBase & { date: string | null; reason?: string };
