export class CaseAssignedEvent {
  constructor(
    public readonly caseId: string,
    public readonly caseCode: string,
    public readonly toUserId: string,
    public readonly byUserId: string,
    public readonly byUserName: string,
  ) {}
}

export class IncidentAssignedEvent {
  constructor(
    public readonly incidentId: string,
    public readonly incidentName: string,
    public readonly toUserId: string,
    public readonly byUserId: string,
    public readonly byUserName: string,
  ) {}
}

export class PetitionAssignedEvent {
  constructor(
    public readonly petitionId: string,
    public readonly petitionTitle: string,
    public readonly toUserId: string,
    public readonly byUserId: string,
    public readonly byUserName: string,
  ) {}
}

export class UydtAssignedEvent {
  constructor(
    public readonly delegationId: string,
    public readonly delegationTitle: string,
    public readonly toUserId: string,
    public readonly toLeaderUserIds: string[],
    public readonly byUserId: string,
    public readonly byUserName: string,
  ) {}
}

export class CaseCreatedEvent {
  constructor(
    public readonly caseId: string,
    public readonly caseCode: string,
    public readonly byUserId: string,
  ) {}
}

// Stub events — handlers deferred to next sprint (D12)
export class PetitionReceivedEvent {
  constructor(
    public readonly petitionId: string,
    public readonly petitionTitle: string,
    public readonly byUserId: string,
  ) {}
}

export class CaseStatusChangedEvent {
  constructor(
    public readonly caseId: string,
    public readonly caseCode: string,
    public readonly toUserId: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
  ) {}
}

export class IncidentCreatedEvent {
  constructor(
    public readonly incidentId: string,
    public readonly incidentName: string,
    public readonly byUserId: string,
  ) {}
}

// Dynamic Report Builder (Báo cáo động, PR9 slice 3) — `toUserIds` is a
// list (every active editor of the assignment, or every manager of the
// report), never a single recipient: an assignment can have >1 editor and
// a report can have >1 manager (D10 — "≥1 quản lý").
export class DynReportReturnedEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
    public readonly reason: string,
  ) {}
}

export class DynReportApprovedEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
  ) {}
}

export class DynReportUnlockGrantedEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
    public readonly expiresAt: string,
  ) {}
}

export class DynReportUnlockRequestedEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
    public readonly byUserName: string,
    public readonly reason: string,
  ) {}
}

export class DynReportPeriodFinalizedEvent {
  constructor(
    public readonly periodId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
  ) {}
}

export class DynReportDeadlineReminderEvent {
  constructor(
    public readonly assignmentId: string,
    public readonly reportName: string,
    public readonly periodKey: string,
    public readonly toUserIds: string[],
    public readonly dueAt: string,
    public readonly windowLabel: string,
  ) {}
}
