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
