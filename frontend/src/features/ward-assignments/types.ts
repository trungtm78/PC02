/**
 * The wire shapes of the ward assignment requests (`/api/v1/ward-assignments`, `/api/v1/ward-investigators`), as the
 * contract of 16/11/2026 states them. Dates of `@db.Date` columns arrive as ISO instants at UTC midnight; instants
 * (`submittedAt`, `updatedAt`) arrive with their offset.
 */

export type WardStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';
export type WardCaseType = 'INCIDENT' | 'CASE';
export type WardKind = 'NEW' | 'REASSIGN';
export type WardRoundStatus = 'PENDING' | 'WITHDRAWN' | 'DECIDED';
export type WardDecisionKind = 'RETURN' | 'APPROVE';

export const WARD_STATUSES: readonly WardStatus[] = ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'];

export interface NamedRef {
  id: string;
  name: string;
}

/** A person as the server includes them (a relation of a round, a decision, a deadline change), when it does. */
export interface PersonRef {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

export interface WardInvestigator {
  id: string;
  teamId: string;
  fullName: string;
  rank: string | null;
  position: string | null;
  grade: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface WardSubject {
  fullName: string;
  birthYear?: number | null;
  idNumber?: string | null;
  address?: string | null;
}

/** What a round keeps of the request as it was submitted (block 1 and the subjects). */
export interface WardSnapshot {
  caseType?: WardCaseType | null;
  kind?: WardKind | null;
  previousAssignmentId?: string | null;
  reassignReason?: string | null;
  crimeId?: string | null;
  crimeOther?: string | null;
  summary?: string | null;
  content?: string | null;
  discoveredOn?: string | null;
  place?: string | null;
  subjectsUnknown?: boolean | null;
  proposedInvestigatorId?: string | null;
  entryOfficerName?: string | null;
  entryOfficerPhone?: string | null;
  unitNote?: string | null;
  subjects?: WardSubject[] | null;
}

export interface WardDecision {
  id: string;
  kind: WardDecisionKind;
  decidedAt: string;
  decidedById: string;
  decidedBy?: PersonRef | null;
  reasonCode: string | null;
  reasonText: string | null;
  requirements: string[] | null;
  assignedInvestigatorId: string | null;
  followUpUserId: string | null;
  followUpTeamId: string | null;
  revokedAt: string | null;
  revokedById: string | null;
  revokedBy?: PersonRef | null;
  revokeReason: string | null;
  slipNumber: string | null;
  slipIssuedAt: string | null;
}

export interface WardRound {
  id: string;
  sequence: number;
  submissionNo: number;
  status: WardRoundStatus;
  submittedAt: string;
  submittedById: string;
  submittedBy?: PersonRef | null;
  snapshot: WardSnapshot | null;
  withdrawnAt: string | null;
  withdrawnById: string | null;
  withdrawnBy?: PersonRef | null;
  decisions: WardDecision[];
}

export interface WardDeadlineChange {
  id: string;
  oldDueOn: string | null;
  newDueOn: string;
  reason: string;
  changedById: string;
  changedBy?: PersonRef | null;
  changedAt: string;
}

/** What the person may do with the request: the same rules the commands apply (lane A adds the review half). */
export interface WardCan {
  edit: boolean;
  submit: boolean;
  withdraw: boolean;
  delete: boolean;
  review: boolean;
  archive: boolean;
  restore: boolean;
  returnIt?: boolean;
  approve?: boolean;
  revokeReturn?: boolean;
  cancelApproval?: boolean;
  followUp?: boolean;
  extend?: boolean;
  complete?: boolean;
  reopen?: boolean;
  deleteWithData?: boolean;
  /** PC02 deciding this request: issues and reissues the request slips of its decisions. */
  issueSlip?: boolean;
}

/** A row of the list. */
export interface WardAssignmentRow {
  id: string;
  code: string | null;
  status: WardStatus;
  assignedTeamId: string;
  assignedTeam: NamedRef | null;
  caseType: WardCaseType;
  kind: WardKind;
  crimeId: string | null;
  crime: NamedRef | null;
  crimeOther: string | null;
  summary: string;
  submissionCount: number;
  submittedAt: string | null;
  resultDueOn: string | null;
  completedOn: string | null;
  archivedAt: string | null;
  updatedAt: string;
  /** What the row's buttons may do (the same rules as the request's own `can`). Absent on an older server. */
  can?: Partial<WardCan>;
  /** The decision in force whose request slip the row prints, when PC02 has decided. */
  latestDecision?: { id: string; kind: WardDecisionKind; slipNumber: string | null } | null;
  place?: string | null;
  entryOfficerName?: string | null;
  /** Lane D: the deadline alert of the row. */
  alert?: { level: 'NONE' | 'YELLOW' | 'RED' | 'OVERDUE' | 'DONE'; dueOn: string | null; daysLeft: number | null } | null;
}

/** One request, as `GET /ward-assignments/:id` answers. */
export interface WardAssignmentDetail extends WardAssignmentRow {
  enteredById: string;
  enteredOnBehalf: boolean;
  previousAssignmentId: string | null;
  reassignReason: string | null;
  content: string;
  discoveredOn: string | null;
  place: string | null;
  subjectsUnknown: boolean;
  proposedInvestigatorId: string | null;
  proposedInvestigator: WardInvestigator | null;
  entryOfficerName: string;
  entryOfficerPhone: string | null;
  unitNote: string | null;
  assignedInvestigatorId: string | null;
  assignedInvestigator: WardInvestigator | null;
  followUpUserId: string | null;
  followUpTeamId: string | null;
  /** Who follows the approval and in which unit, named on the request (readable by whoever reads the request). */
  followUpUser?: { id: string; firstName: string | null; lastName: string | null; username: string } | null;
  followUpTeam?: { id: string; name: string } | null;
  pc02Note: string | null;
  receivedOn: string | null;
  resultText: string | null;
  createdAt: string;
  subjects: WardSubject[];
  rounds: WardRound[];
  deadlineChanges?: WardDeadlineChange[];
  timeliness?: { onTime: boolean; lateDays: number } | null;
  viewerId: string;
  can: WardCan;
}

/** Block 1 as the ward unit writes it: the body of create and update. */
export interface WardContentInput {
  caseType: WardCaseType;
  kind: WardKind;
  previousAssignmentId: string | null;
  reassignReason: string | null;
  crimeId: string | null;
  crimeOther: string | null;
  summary: string;
  content: string;
  discoveredOn: string | null;
  place: string | null;
  subjectsUnknown: boolean;
  subjects: WardSubject[];
  proposedInvestigatorId: string | null;
  entryOfficerName: string;
  entryOfficerPhone: string | null;
  unitNote: string | null;
}

export interface WardListQuery {
  /** The tags of the search box (`key~value`). */
  tk?: string[];
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: WardStatus;
  archived?: boolean;
  /** The filters a number of the statistics page opens (`wardListLink`): the server applies the same period rule. */
  submitted?: 'true';
  from?: string;
  to?: string;
  teamId?: string;
  crimeId?: string;
  caseType?: string;
  kind?: string;
  alert?: string;
  page?: number;
  pageSize?: number;
}

/** The numbers of the list's six cards (`GET /ward-assignments/list-stats`). */
export interface WardListStats {
  all: number;
  byStatus: Record<WardStatus, number>;
  archived: number;
}

/** Who may follow an approval and in which unit (`GET /ward-assignments/follow-up-choices`). */
export interface WardFollowUpChoices {
  teams: { id: string; name: string }[];
  people: { id: string; name: string; unitIds: string[] }[];
}

export interface WardReturnReason {
  code: string;
  name: string;
}

export interface WardDeletionImpact {
  subjects: number;
  rounds: number;
  decisions: number;
  deadlineChanges: number;
  files: number;
}
