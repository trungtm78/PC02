/* In-memory Prisma delegate fixtures intentionally use partial dynamic records. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { CaseGovernanceService } from './case-governance.service';
import { CaseGovernanceController } from './case-governance.controller';
const date = new Date('2026-10-06T00:00:00Z');
function fixture() {
  const record: any = {
    id: 'c1',
    updatedAt: date,
    status: 'DANG_DIEU_TRA',
    intakeStage: null,
    investigatorId: 'u1',
    assignedTeamId: null,
    deletedAt: null,
    governanceRevision: 0,
    sensitivity: 'NORMAL',
  };
  const actor: any = {
    id: 'u1',
    isActive: true,
    roleId: 'r1',
    canDispatch: false,
    role: {
      name: 'ADMIN',
      permissions: [
        { permission: { subject: 'Case', action: 'read', conditions: null } },
        { permission: { subject: 'Case', action: 'edit', conditions: null } },
        {
          permission: {
            subject: 'CaseGovernance',
            action: 'operate',
            conditions: null,
          },
        },
      ],
    },
  };
  const operations: any[] = [];
  const db: any = {
    user: { findUnique: async () => actor },
    featureFlag: { findUnique: async () => ({ enabled: true }) },
    case: {
      findFirst: async () => record,
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    caseGovernanceGrant: { findFirst: async () => null },
    caseGovernanceOperation: {
      findUnique: async ({ where }: any) =>
        operations.find((x) =>
          Object.entries(where.actorId_caseId_operation_requestKey).every(
            ([k, v]) => x[k] === v,
          ),
        ) ?? null,
      create: async ({ data }: any) => {
        operations.push({ ...data, id: 'op1' });
        return operations.at(-1);
      },
      update: async ({ data }: any) => Object.assign(operations.at(-1), data),
    },
    caseHandoff: { findFirst: async () => null },
    userTeam: { findMany: async () => [], findFirst: async () => null },
    caseGovernanceOutbox: { create: jest.fn() },
    $transaction: async (fn: any) => {
      const operationCount = operations.length;
      try {
        return await fn(db);
      } catch (error) {
        operations.splice(operationCount);
        throw error;
      }
    },
    $queryRaw: jest.fn(async () => []),
  };
  return {
    db,
    actor,
    record,
    operations,
    service: new CaseGovernanceService(db),
  };
}
describe('governance authorization and atomic replay', () => {
  it.each([
    { _sensitivity: 'RESTRICTED' },
    { sensitivity: 'NORMAL', _sensitivity: 'RESTRICTED' },
    { sensitivity: 'RESTRICTED', _sensitivity: 'NORMAL' },
    { _sensitivity: 'UNKNOWN' },
    { sensitivity: 'RESTRICTED', _sensitivity: 'UNKNOWN' },
  ])(
    'legal-R2 both sensitivity aliases tighten point access %j',
    async (metadata) => {
      const f = fixture();
      f.record.metadata = metadata;
      await expect(
        f.service.assertCaseReadable(f.db, 'c1', {
          actorId: 'u1',
          dataScope: null,
        }),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it('legal-R2 unknown legacy alias remains quarantined even with explicit sensitive permission', async () => {
    const f = fixture();
    f.record.metadata = { sensitivity: 'RESTRICTED', _sensitivity: 'UNKNOWN' };
    f.actor.role.permissions.push({
      permission: {
        subject: 'CaseGovernance',
        action: 'read_sensitive',
        conditions: null,
      },
    });
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('scope expands owned descendants and keeps borrowed READ teams out of writable responsibility', async () => {
    const f = fixture();
    f.actor.role.name = 'OFFICER';
    f.db.userTeam.findMany = async ({ where }: any) =>
      where.userId
        ? [{ teamId: 'own', team: { wardId: 'ward' } }]
        : [
            { userId: 'own-staff', teamId: 'own' },
            { userId: 'child-staff', teamId: 'child' },
            { userId: 'borrowed-staff', teamId: 'borrowed' },
          ];
    f.db.team = {
      findMany: async () => [
        { id: 'own', parentId: null },
        { id: 'child', parentId: 'own' },
        { id: 'grandchild', parentId: 'child' },
        { id: 'borrowed', parentId: null },
      ],
    };
    f.db.dataAccessGrant = {
      findMany: async () => [{ teamId: 'borrowed', accessLevel: 'READ' }],
    };
    const scope = await f.service.currentActorScope(f.db, {
      actorId: 'u1',
      dataScope: null,
    });
    expect(scope?.teamIds).toEqual(
      expect.arrayContaining(['own', 'child', 'grandchild', 'borrowed']),
    );
    expect(scope?.writableTeamIds).toEqual(
      expect.arrayContaining(['own', 'child', 'grandchild']),
    );
    expect(scope?.writableTeamIds).not.toContain('borrowed');
    expect(scope?.writableUserIds).not.toContain('borrowed-staff');
    expect(scope?.isWardOfficer).toBe(true);
    f.record.assignedTeamId = 'borrowed';
    f.record.investigatorId = 'borrowed-staff';
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).resolves.toHaveProperty('id', 'c1');
    await expect(
      f.service.assertCaseWritable(f.db, 'c1', {
        actorId: 'u1',
        dataScope: null,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('serialization race without authorized committed replay becomes 409 without running handler', async () => {
    const f = fixture();
    f.db.$transaction = async () => {
      throw Object.assign(new Error('Synthetic race'), { code: 'P2034' });
    };
    const handler = jest.fn();
    await expect(
      f.service.mutateCase(
        {
          caseId: 'c1',
          operation: 'LEGAL_ACTION_SUBMIT',
          requestKey: 'race-without-result',
          expectedUpdatedAt: date.toISOString(),
          payload: {},
        },
        { actorId: 'u1' },
        handler,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(handler).not.toHaveBeenCalled();
    expect(f.operations).toEqual([]);
  });
  it('current permissions deny read, edit and dispatch independently of forged actor context', async () => {
    const f = fixture();
    f.actor.role.name = 'OFFICER';
    f.db.team = { findMany: async () => [] };
    f.db.dataAccessGrant = { findMany: async () => [] };
    const forged = { actorId: 'u1', roleId: 'ADMIN', dataScope: null };
    await expect(
      f.service.assertCaseAssignable(f.db, 'c1', forged),
    ).rejects.toMatchObject({ status: 403 });
    f.actor.role.permissions = f.actor.role.permissions.filter(
      (p: any) => p.permission.action !== 'edit',
    );
    await expect(
      f.service.assertCaseWritable(f.db, 'c1', forged),
    ).rejects.toMatchObject({ status: 403 });
    f.actor.role.permissions = [];
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', forged),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.assertCaseAccessCapability(f.db, 'c1', forged, 'download'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.readableCaseWhere(f.db, forged),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.case.updateMany).not.toHaveBeenCalled();
  });
  it('HTTP snapshot masks current owner/type policy while preserving command pins and version', async () => {
    const f = fixture();
    Object.assign(f.record, {
      fieldDefinitionVersionId: 'f1',
      governanceRuleVersionId: 'r1',
      caseType: 'REGULAR',
      assignedTeamId: 'private-team',
    });
    f.db.caseFieldDefinitionVersion = {
      findUnique: async () => ({
        status: 'PUBLISHED',
        definition: {
          fields: [],
          fieldPolicies: [
            { key: 'assignedTeamId', sensitivity: 'RESTRICTED' },
            { key: 'investigatorId', sensitivity: 'RESTRICTED' },
            { key: 'caseType', sensitivity: 'RESTRICTED' },
          ],
        },
      }),
    };
    f.db.caseHandoff.findMany = async () => [];
    f.db.caseGovernanceEvent = { findMany: async () => [] };
    const controller = new CaseGovernanceController(f.service);
    const result = await controller.snapshot('c1', {
      id: 'u1',
      roleId: 'forged',
    } as any);
    expect(result.data).toMatchObject({
      caseId: 'c1',
      updatedAt: date,
      fieldDefinitionVersionId: 'f1',
      governanceRuleVersionId: 'r1',
    });
    expect(result.data).not.toHaveProperty('assignedTeamId');
    expect(result.data).not.toHaveProperty('investigatorId');
    expect(result.data).not.toHaveProperty('caseType');
    f.actor.isActive = false;
    await expect(
      controller.snapshot('c1', { id: 'u1' } as any),
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each([
    { shortcomings: 42 },
    { receiptChecklist: 'untyped' },
    {
      receiptChecklist: [
        {
          documentId: 'doc',
          expectedDocumentUpdatedAt: date.toISOString(),
          present: 'yes',
        },
      ],
    },
    {
      receiptChecklist: [
        {
          documentId: 'doc',
          expectedDocumentUpdatedAt: 'invalid',
          present: true,
        },
      ],
    },
    {
      receiptChecklist: [
        {
          documentId: 'foreign',
          expectedDocumentUpdatedAt: date.toISOString(),
          present: true,
        },
      ],
    },
  ])(
    'malformed or foreign receipt facts cannot create handoff, event or outbox: %j',
    async (facts) => {
      const f = fixture();
      f.db.team = { findFirst: async () => ({ id: 'target' }) };
      f.db.document = { findFirst: async () => null };
      f.db.caseHandoff.create = jest.fn();
      f.db.caseGovernanceEvent = { create: jest.fn() };
      await expect(
        f.service.sendHandoff(
          'c1',
          {
            toTeamId: 'target',
            requestKey: 'invalid-receipt',
            expectedUpdatedAt: date.toISOString(),
            ...facts,
          } as any,
          { actorId: 'u1' },
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(f.db.caseHandoff.create).not.toHaveBeenCalled();
      expect(f.db.case.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ intakeStage: 'CHO_NHAN' }),
        }),
      );
      expect(f.operations).toEqual([]);
      expect(f.db.caseGovernanceEvent.create).not.toHaveBeenCalled();
      expect(f.db.caseGovernanceOutbox.create).not.toHaveBeenCalled();
    },
  );
  it('handoff cannot use inactive team, nonmember recipient, or substitute same-team assignment after receipt', async () => {
    const f = fixture();
    const dto = {
      toTeamId: 'team',
      requestKey: 'invalid-target',
      expectedUpdatedAt: date.toISOString(),
    };
    f.db.team = { findFirst: async () => null };
    await expect(
      f.service.sendHandoff('c1', dto, { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 400 });
    f.db.team.findFirst = async () => ({ id: 'team' });
    await expect(
      f.service.sendHandoff(
        'c1',
        { ...dto, recipientId: 'outsider' },
        { actorId: 'u1' },
      ),
    ).rejects.toMatchObject({ status: 400 });
    f.record.assignedTeamId = 'team';
    f.record.intakeStage = 'DA_NHAN';
    await expect(
      f.service.sendHandoff('c1', dto, { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intakeStage: 'CHO_NHAN' }),
      }),
    );
    expect(f.operations).toEqual([]);
  });
  it('assignment destination requires active team and investigator membership, including creation', async () => {
    const f = fixture();
    f.actor.role.permissions.push({
      permission: { subject: 'Case', action: 'write', conditions: null },
    });
    f.db.team = { findFirst: async () => null };
    await expect(
      f.service.assertCaseCreation(
        f.db,
        { actorId: 'u1' },
        { assignedTeamId: 'inactive' },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.service.assertCaseCreation(
        f.db,
        { actorId: 'u1' },
        { investigatorId: 'outsider' },
      ),
    ).rejects.toMatchObject({ status: 400 });
    f.db.team.findFirst = async () => ({ id: 'team' });
    await expect(
      f.service.assertCaseCreation(
        f.db,
        { actorId: 'u1' },
        { assignedTeamId: 'team', investigatorId: 'outsider' },
      ),
    ).rejects.toMatchObject({ status: 400 });
    f.db.userTeam.findFirst = async () => ({
      userId: 'member',
      teamId: 'team',
    });
    await expect(
      f.service.assertCaseCreation(
        f.db,
        { actorId: 'u1' },
        { assignedTeamId: 'team', investigatorId: 'member' },
      ),
    ).resolves.toBeUndefined();
    f.actor.caseAccessMode = 'REPRESENTATION_ONLY';
    await expect(
      f.service.assertCaseCreation(f.db, { actorId: 'u1' }, {}),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('restore checks current permission, deleted identity, classification and pending state before allowing recovery', async () => {
    const f = fixture();
    await expect(
      f.service.assertCaseRestorable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
    f.actor.role.permissions.push({
      permission: { subject: 'Case', action: 'restore', conditions: null },
    });
    f.db.case.findFirst = async () => null;
    await expect(
      f.service.assertCaseRestorable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 404 });
    f.db.case.findFirst = async () => ({ ...f.record, deletedAt: date });
    await expect(
      f.service.assertCaseRestorable(f.db, 'c1', { actorId: 'u1' }),
    ).resolves.toMatchObject({ id: 'c1', deletedAt: date });
    f.record.intakeStage = 'CHO_NHAN';
    await expect(
      f.service.assertCaseRestorable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 409 });
    f.record.intakeStage = null;
    f.record.sensitivity = 'RESTRICTED';
    await expect(
      f.service.assertCaseRestorable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('Case capability discovery and governance snapshot preserve current authority and published facts', async () => {
    const f = fixture();
    f.record.investigationPhase = 'DIEU_TRA_BAN_DAU';
    f.record.governanceRevision = 2;
    f.record.governanceRuleVersionId = 'rule-v1';
    f.record.fieldDefinitionVersionId = 'fields-v1';
    f.record.caseType = 'REGULAR';
    f.record.assignedTeamId = 'team-v1';
    f.db.caseFieldDefinitionVersion = {
      findUnique: async () => ({
        status: 'PUBLISHED',
        definition: { fields: [] },
      }),
    };
    f.db.caseHandoff.findMany = async () => [
      { id: 'h1', caseId: 'c1', state: 'ACCEPTED' },
    ];
    f.db.caseGovernanceEvent = {
      findMany: async () => [
        { id: 'event1', caseId: 'c1', type: 'HANDOFF_ACCEPTED' },
      ],
    };
    const caps = await f.service.capabilities('c1', {
      actorId: 'u1',
      roleId: 'forged',
    });
    expect(caps.data).toMatchObject({
      actorId: 'u1',
      operate: true,
      review: false,
      publish: false,
      manage_access: false,
      canEdit: true,
      pendingHandoff: false,
    });
    const snapshot = await f.service.snapshot('c1', { actorId: 'u1' });
    expect(snapshot.data).toMatchObject({
      caseId: 'c1',
      investigationPhase: 'DIEU_TRA_BAN_DAU',
      governanceRevision: 2,
      governanceRuleVersionId: 'rule-v1',
      fieldDefinitionVersionId: 'fields-v1',
      caseType: 'REGULAR',
      assignedTeamId: 'team-v1',
      investigatorId: 'u1',
      handoffs: [{ id: 'h1' }],
      events: [{ id: 'event1' }],
    });
    f.record.intakeStage = 'CHO_NHAN';
    expect(
      (await f.service.capabilities('c1', { actorId: 'u1' })).data.canEdit,
    ).toBe(false);
  });
  it('receiving inbox omits sensitive Case rows without expanding ordinary read scope', async () => {
    const f = fixture();
    f.db.caseHandoff.findMany = async () => [
      { id: 'normal-handoff', caseId: 'c1', case: f.record },
      {
        id: 'secret-handoff',
        caseId: 'secret',
        case: { ...f.record, id: 'secret', sensitivity: 'RESTRICTED' },
      },
    ];
    const inbox = await f.service.handoffInbox({ actorId: 'u1' });
    expect(inbox.data.map((r: any) => r.id)).toEqual(['normal-handoff']);
    f.actor.caseAccessMode = 'REPRESENTATION_ONLY';
    await expect(
      f.service.handoffInbox({ actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('representation list summaries do not expose full facts and download grants do not imply full Case view', async () => {
    const f = fixture();
    f.actor.caseAccessMode = 'REPRESENTATION_ONLY';
    f.db.caseRepresentationGrant = {
      findFirst: async ({ where }: any) =>
        where.capabilities.array_contains[0] === 'view'
          ? null
          : { id: 'grant' },
    };
    const summary = await f.service.serializeCaseList(
      f.db,
      {
        ...f.record,
        name: 'Public identity',
        description: 'hidden narrative',
        deadline: date,
      },
      { actorId: 'u1' },
    );
    expect(summary).toMatchObject({
      id: 'c1',
      name: 'Public identity',
      quyenGhi: false,
    });
    expect(summary).not.toHaveProperty('description');
    expect(summary).not.toHaveProperty('deadline');
    await expect(
      f.service.assertCaseAccessCapability(
        f.db,
        'c1',
        { actorId: 'u1' },
        'download',
      ),
    ).resolves.toHaveProperty('id', 'c1');
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.assertGeneralExport(f.db, { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each(['accept', 'cancel', 'return'] as const)(
    'clears pending handoff with %s while flag is off, preserving legal status and dates',
    async (action) => {
      const f = fixture();
      f.record.intakeStage = 'CHO_NHAN';
      f.record.deadline = new Date('2026-11-01');
      f.db.featureFlag.findUnique = async () => ({ enabled: false });
      const handoff: any = {
        id: 'h1',
        caseId: 'c1',
        state: 'PENDING',
        sentById: 'u1',
        toTeamId: 'team2',
        recipientId: 'u1',
        priorIntakeStage: 'PHAN_LOAI',
        updatedAt: date,
      };
      f.db.caseHandoff.findFirst = async () => handoff;
      f.db.caseHandoff.updateMany = jest.fn(async ({ data }: any) => {
        Object.assign(handoff, data);
        return { count: 1 };
      });
      f.db.userTeam.findFirst = async () => ({ userId: 'u1', teamId: 'team2' });
      f.db.case.update = jest.fn(async ({ data }: any) => {
        Object.assign(f.record, data);
        return f.record;
      });
      f.db.caseGovernanceEvent = { create: jest.fn() };
      f.db.auditLog = { create: jest.fn() };
      const input = {
        requestKey: 'resolve-' + action,
        expectedUpdatedAt: date.toISOString(),
        expectedAggregateUpdatedAt: date.toISOString(),
        reason: 'Recorded receipt outcome',
      };
      const result = await f.service.resolveHandoff('c1', 'h1', action, input, {
        actorId: 'u1',
      });
      expect(result.data?.state).toBe(
        action === 'accept'
          ? 'ACCEPTED'
          : action === 'cancel'
            ? 'CANCELLED'
            : 'RETURNED',
      );
      expect(f.record.intakeStage).toBe(
        action === 'accept' ? 'DA_NHAN' : 'PHAN_LOAI',
      );
      expect(f.record.status).toBe('DANG_DIEU_TRA');
      expect(f.record.deadline.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(f.db.auditLog.create).toHaveBeenCalledTimes(1);
      expect(f.db.caseGovernanceOutbox.create).toHaveBeenCalledTimes(1);
      expect(
        await f.service.resolveHandoff('c1', 'h1', action, input, {
          actorId: 'u1',
        }),
      ).toEqual(result);
      expect(f.db.case.update).toHaveBeenCalledTimes(1);
    },
  );
  it('designated recipient and handoff revision guard run before any resolution write', async () => {
    const f = fixture();
    f.record.intakeStage = 'CHO_NHAN';
    f.db.userTeam.findFirst = async () => ({ userId: 'u1' });
    const handoff: any = {
      id: 'h1',
      caseId: 'c1',
      state: 'PENDING',
      recipientId: 'other-staff',
      sentById: 'sender',
      toTeamId: 'team2',
      updatedAt: date,
    };
    f.db.caseHandoff.findFirst = async () => handoff;
    f.db.caseHandoff.updateMany = jest.fn();
    const input = {
      requestKey: 'wrong-recipient',
      expectedUpdatedAt: date.toISOString(),
      expectedAggregateUpdatedAt: date.toISOString(),
    };
    await expect(
      f.service.resolveHandoff('c1', 'h1', 'accept', input, { actorId: 'u1' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.db.caseHandoff.updateMany).not.toHaveBeenCalled();
    // The in-memory fixture has no transaction engine: model the rolled-back operation insertion.
    f.operations.length = 0;
    handoff.recipientId = 'u1';
    await expect(
      f.service.resolveHandoff(
        'c1',
        'h1',
        'accept',
        { ...input, expectedAggregateUpdatedAt: '2000-01-01T00:00:00Z' },
        { actorId: 'u1' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.db.caseHandoff.updateMany).not.toHaveBeenCalled();
  });
  it('global capability discovery reports the current actor and keeps representation principals out of control-plane roles', async () => {
    const f = fixture();
    f.actor.caseAccessMode = 'REPRESENTATION_ONLY';
    f.actor.caseAccessRevision = 4;
    f.actor.role.permissions.push(
      ...['publish', 'manage_access'].map((action) => ({
        permission: { subject: 'CaseGovernance', action, conditions: null },
      })),
      { permission: { subject: 'User', action: 'write', conditions: null } },
    );
    const caps = await f.service.globalCapabilities({
      actorId: 'u1',
      roleId: 'forged',
    });
    expect(caps.data).toMatchObject({
      actorId: 'u1',
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 4,
      manage_access: false,
      publish: false,
      canClone: false,
      canExport: false,
      canDispatch: false,
    });
  });
  it('invalid handoff recipient identity returns 400 before database writes', async () => {
    const f = fixture();
    await expect(
      f.service.sendHandoff(
        'c1',
        {
          toTeamId: 'team2',
          recipientId: 123,
          requestKey: 'invalid-recipient',
          expectedUpdatedAt: date.toISOString(),
        } as any,
        { actorId: 'u1' },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.db.case.updateMany).not.toHaveBeenCalled();
  });
  it('concurrent classification replay retains controlled inspection authority for an unknown label', async () => {
    const f = fixture();
    f.record.metadata = { sensitivity: 'QUARANTINED_UNKNOWN' };
    f.actor.role.permissions.push(
      ...['manage_access', 'read_sensitive'].map((action) => ({
        permission: { subject: 'CaseGovernance', action, conditions: null },
      })),
    );
    const input = {
      caseId: 'c1',
      operation: 'LEGAL_ACTION_CREATE',
      requestKey: 'classify-replay',
      expectedUpdatedAt: date.toISOString(),
      payload: {
        actionCode: 'CLASSIFY_SENSITIVITY',
        payload: {
          inspectionPurpose: 'Inspect archived unknown classification',
        },
      },
    };
    await f.service.mutateCase(input, { actorId: 'u1' }, async () => ({
      data: { id: 'request' },
    }));
    f.db.$transaction = async () => {
      throw Object.assign(new Error('Synthetic serialization race'), {
        code: 'P2034',
      });
    };
    await expect(
      f.service.mutateCase(input, { actorId: 'u1' }, jest.fn()),
    ).resolves.toEqual({ data: { id: 'request' } });
    f.actor.role.permissions = f.actor.role.permissions.filter(
      (p: any) => p.permission.action !== 'manage_access',
    );
    await expect(
      f.service.mutateCase(input, { actorId: 'u1' }, jest.fn()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('same-team initial receipt records exact owned document versions and structured shortcomings', async () => {
    const f = fixture();
    f.record.assignedTeamId = 'same-team';
    f.record.intakeStage = 'PHAN_LOAI';
    f.db.team = {
      findFirst: async () => ({ id: 'same-team', isActive: true }),
    };
    f.db.userTeam = {
      findMany: async () => [],
      findFirst: async () => ({ userId: 'recipient' }),
    };
    f.db.document = {
      findFirst: async () => ({ id: 'doc1', caseId: 'c1', updatedAt: date }),
    };
    f.db.caseHandoff.create = jest.fn(async ({ data }: any) => ({
      id: 'handoff',
      updatedAt: date,
      ...data,
    }));
    f.db.caseGovernanceEvent = { create: jest.fn() };
    f.db.auditLog = { create: jest.fn() };
    f.db.caseGovernanceOutbox = { create: jest.fn() };
    const dto: any = {
      toTeamId: 'same-team',
      recipientId: 'recipient',
      requestKey: 'same-receipt',
      expectedUpdatedAt: date.toISOString(),
      receiptChecklist: [
        {
          documentId: 'doc1',
          expectedDocumentUpdatedAt: date.toISOString(),
          present: false,
          note: 'Paper copy missing',
        },
      ],
      shortcomings: 'Missing paper copy',
    };
    const received = await f.service.sendHandoff('c1', dto, { actorId: 'u1' });
    expect(received.data.receiptFacts).toEqual({
      receiptChecklist: [
        {
          documentId: 'doc1',
          documentUpdatedAt: date.toISOString(),
          present: false,
          note: 'Paper copy missing',
        },
      ],
      shortcomings: 'Missing paper copy',
    });
    expect(received.data.recipientId).toBe('recipient');
  });
  it('representation-only mode requires current exact Case view/list grants, with no expired/revoked staff fallback', async () => {
    const f = fixture();
    f.actor.caseAccessMode = 'REPRESENTATION_ONLY';
    f.actor.caseAccessRevision = 1;
    f.db.caseRepresentationGrant = { findFirst: jest.fn(async () => null) };
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', {
        actorId: 'u1',
        dataScope: null,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const where = await f.service.readableCaseWhere(f.db, { actorId: 'u1' });
    expect(JSON.stringify(where)).toContain('caseRepresentationGrant_case');
    expect(JSON.stringify(where)).toContain('list');
    f.db.caseRepresentationGrant.findFirst.mockResolvedValue({
      id: 'view-grant',
    });
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).resolves.toHaveProperty('id', 'c1');
    expect(f.db.caseRepresentationGrant.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          caseId: 'c1',
          granteeId: 'u1',
          revokedAt: null,
          capabilities: { array_contains: ['view'] },
        }),
      }),
    );
  });
  it('self investigator ownership cannot authorize a new foreign-team assignment', async () => {
    const f = fixture();
    f.actor.role.name = 'OFFICER';
    f.actor.role.permissions.push({
      permission: { subject: 'Case', action: 'write', conditions: null },
    });
    f.db.userTeam = {
      findMany: async () => [{ teamId: 'own-team', team: { wardId: null } }],
    };
    f.db.team = {
      findMany: async () => [
        { id: 'own-team', parentId: null },
        { id: 'foreign-team', parentId: null },
      ],
      findFirst: async () => ({ id: 'foreign-team', isActive: true }),
    };
    f.db.dataAccessGrant = { findMany: async () => [] };
    await expect(
      f.service.assertCaseCreation(
        f.db,
        { actorId: 'u1' },
        { assignedTeamId: 'foreign-team', investigatorId: 'u1' },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('governance history and replay omit foreign Case references after linked scope is revoked', async () => {
    const f = fixture();
    f.db.case.findMany = jest.fn(async () => []);
    const result = await f.service.serializeCaseResult(
      f.db,
      'c1',
      {
        caseId: 'c1',
        targetCaseId: 'hidden-case',
        payload: { sourceCaseId: 'hidden-case', reason: 'visible' },
        relatedCase: { id: 'hidden-case', name: 'hidden-name' },
      },
      { actorId: 'u1' },
    );
    expect(JSON.stringify(result)).not.toContain('hidden-case');
    expect(JSON.stringify(result)).not.toContain('hidden-name');
    expect(result.caseId).toBe('c1');
  });
  it('replay rechecks current native/custom field authority rather than exposing a cached secret', async () => {
    const f = fixture();
    f.record.fieldDefinitionVersionId = 'fields1';
    f.db.caseFieldDefinitionVersion = {
      findUnique: async () => ({
        id: 'fields1',
        status: 'PUBLISHED',
        definition: {
          fields: [
            {
              key: 'custom_secret',
              label: 'Secret',
              type: 'text',
              required: false,
              sensitivity: 'RESTRICTED',
            },
          ],
          fieldPolicies: [{ key: 'sdtCungCap', sensitivity: 'RESTRICTED' }],
        },
      }),
    };
    f.actor.role.permissions.push({
      permission: {
        subject: 'CaseGovernance',
        action: 'read_sensitive',
        conditions: null,
      },
    });
    const input = {
      caseId: 'c1',
      operation: 'asset.register',
      requestKey: 'replay-policy',
      expectedUpdatedAt: date.toISOString(),
      payload: {},
    };
    const handler = jest.fn(async () => ({
      data: {
        id: 'c1',
        sdtCungCap: 'secret-phone',
        metadata: {
          phone: 'secret-phone',
          _customFields: { custom_secret: 'hidden' },
        },
      },
    }));
    expect(
      (await f.service.mutateCase(input, { actorId: 'u1' }, handler)).data
        .sdtCungCap,
    ).toBe('secret-phone');
    f.actor.role.permissions = f.actor.role.permissions.filter(
      (p: any) => p.permission.action !== 'read_sensitive',
    );
    const replay = await f.service.mutateCase(
      input,
      { actorId: 'u1' },
      handler,
    );
    expect(JSON.stringify(replay)).not.toContain('secret-phone');
    expect(JSON.stringify(replay)).not.toContain('hidden');
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('list predicate tightens legacy sensitivity and grants permit no-expiry authority', async () => {
    const f = fixture();
    const where = await f.service.readableCaseWhere(f.db, { actorId: 'u1' });
    expect(f.db.$queryRaw.mock.calls[0][0].join('')).toContain('metadata');
    expect(JSON.stringify(where)).toContain('expiresAt');
    expect(JSON.stringify(where)).toContain('null');
    f.record.sensitivity = 'RESTRICTED';
    f.db.caseGovernanceGrant.findFirst = jest.fn(async () => ({ id: 'grant' }));
    await f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' });
    expect(f.db.caseGovernanceGrant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        }),
      }),
    );
  });
  it('send preserves legal status, identity and deadline, then accept checks exact recipient membership', async () => {
    const f = fixture();
    const handoffs: any[] = [];
    f.db.team = { findFirst: async () => ({ id: 'team2', isActive: true }) };
    f.db.caseHandoff.create = async ({ data }: any) => {
      handoffs.push({ ...data, id: 'h1', updatedAt: date });
      return handoffs[0];
    };
    f.db.caseGovernanceEvent = { create: async () => ({}) };
    f.db.auditLog = { create: async () => ({}) };
    const result = await f.service.sendHandoff(
      'c1',
      {
        toTeamId: 'team2',
        requestKey: 'send1',
        expectedUpdatedAt: date.toISOString(),
      },
      { actorId: 'u1' },
    );
    expect(result.data.toTeamId).toBe('team2');
    expect(f.db.case.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { intakeStage: 'CHO_NHAN' } }),
    );
    f.record.intakeStage = 'CHO_NHAN';
    f.db.caseHandoff.findFirst = async ({ where }: any) =>
      where.toTeam ? null : handoffs[0];
    await expect(
      f.service.resolveHandoff(
        'c1',
        'h1',
        'accept',
        {
          requestKey: 'accept1',
          expectedUpdatedAt: date.toISOString(),
          expectedAggregateUpdatedAt: date.toISOString(),
        },
        { actorId: 'u1' },
      ),
    ).rejects.toThrow();
  });
  it('uses explicit active capability even for ADMIN and ignores forged actor role', async () => {
    const f = fixture();
    expect(await f.service.hasCapability(f.db, 'u1', 'operate')).toBe(true);
    expect(await f.service.hasCapability(f.db, 'u1', 'review')).toBe(false);
    f.actor.isActive = false;
    expect(await f.service.hasCapability(f.db, 'u1', 'operate')).toBe(false);
  });
  it('keeps ordinary Case read while rejecting pending writes and restricted scope-null reads', async () => {
    const f = fixture();
    expect(
      await f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).toBe(f.record);
    f.record.intakeStage = 'CHO_NHAN';
    await expect(
      f.service.assertCaseWritable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toThrow();
    f.record.sensitivity = 'RESTRICTED';
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', {
        actorId: 'u1',
        dataScope: null,
      }),
    ).rejects.toThrow();
  });
  it('denies absent flag and inactive actors', async () => {
    const f = fixture();
    f.db.featureFlag.findUnique = async () => null;
    await expect(f.service.ensureEnabled()).rejects.toThrow();
    f.actor.isActive = false;
    await expect(
      f.service.assertCaseReadable(f.db, 'c1', { actorId: 'u1' }),
    ).rejects.toThrow();
  });
  it('replays identical business content without rerunning and rejects changed content', async () => {
    const f = fixture();
    const handler = jest.fn(async () => ({ value: 42 }));
    const input = {
      caseId: 'c1',
      operation: 'asset.register',
      requestKey: 'k1',
      expectedUpdatedAt: date.toISOString(),
      payload: { a: 1 },
    };
    expect(
      await f.service.mutateCase(input, { actorId: 'u1' }, handler),
    ).toEqual({ value: 42 });
    expect(
      await f.service.mutateCase(
        { ...input, expectedUpdatedAt: '2000-01-01T00:00:00Z' },
        { actorId: 'u1' },
        handler,
      ),
    ).toEqual({ value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(
      f.service.mutateCase(
        { ...input, payload: { a: 2 } },
        { actorId: 'u1' },
        handler,
      ),
    ).rejects.toThrow();
    f.actor.isActive = false;
    await expect(
      f.service.mutateCase(input, { actorId: 'u1' }, handler),
    ).rejects.toThrow();
  });
  it('CAS includes server ownership/status/intake/revision snapshot and maps stale write to 409', async () => {
    const f = fixture();
    const handler = jest.fn();
    f.db.case.updateMany.mockResolvedValue({ count: 0 });
    const input = {
      caseId: 'c1',
      operation: 'asset.register',
      requestKey: 'k1',
      expectedUpdatedAt: date.toISOString(),
      payload: {},
    };
    await expect(
      f.service.mutateCase(input, { actorId: 'u1' }, handler),
    ).rejects.toMatchObject({ status: 409 });
    expect(handler).not.toHaveBeenCalled();
    expect(f.db.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'c1',
          updatedAt: date,
          status: 'DANG_DIEU_TRA',
          intakeStage: null,
          assignedTeamId: null,
          investigatorId: 'u1',
          governanceRevision: 0,
          deletedAt: null,
        }),
      }),
    );
  });
});
