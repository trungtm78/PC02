import { CasesBulkService } from './cases.bulk.service';

describe('CG-BA01 actual governed dispatcher authority', () => {
  function fixture(operate = false) {
    const record = { id: 'case', status: 'TIEP_NHAN', intakeStage: null, updatedAt: new Date(0), assignedTeamId: 'team', investigatorId: null, governanceRevision: 0, sensitivity: 'NORMAL', metadata: null, deletedAt: null };
    const actor = { id: 'actor', roleId: 'role', isActive: true, canDispatch: true, caseAccessMode: 'INTERNAL', role: { name: 'DISPATCHER', permissions: [{ permission: { action: 'read', subject: 'Case', conditions: null } },...(operate ? [{ permission: { action: 'operate', subject: 'CaseGovernance', conditions: null } }] : [])] } };
    const tx = { user: { findUnique: jest.fn(async () => actor) }, rolePermission: { findMany: jest.fn(async () => actor.role.permissions) }, team: { findFirst: jest.fn(async () => ({ id: 'team', isActive: true })), findMany: jest.fn(async () => [{ id: 'team', parentId: null }]) }, userTeam: { findFirst: jest.fn(async () => ({ userId: 'actor', teamId: 'team' })), findMany: jest.fn(async () => [{ userId: 'actor', teamId: 'team', team: { wardId: null } }]) }, dataAccessGrant: { findMany: jest.fn(async () => []) }, caseHandoff: { findFirst: jest.fn(async () => null) }, featureFlag: { findUnique: jest.fn(async () => ({ enabled: true })) }, case: { findMany: jest.fn(async () => [{ id: 'case' }]), findFirst: jest.fn(async () => record), update: jest.fn(async () => record) }, caseGovernanceOperation: { findUnique: jest.fn(async () => null), create: jest.fn(async () => ({ id: 'operation' })) }, caseGovernanceEvent: { create: jest.fn(async () => ({})) }, $queryRaw: jest.fn(async () => []), $transaction: jest.fn() };
    tx.$transaction.mockImplementation(async (fn: (db: typeof tx) => unknown) => fn(tx));
    const audit = { logBulkHeader: jest.fn(async () => ({ bulkOperationId: 'bulk' })), logBulkItem: jest.fn(async () => undefined), completeBulk: jest.fn(async () => undefined) };
    const service = new CasesBulkService(tx as never,audit as never);
    const input = { ids: ['case'], actorId: 'actor', assignedTeamId: 'team', reason: 'Synthetic same-team assignment', dataScope: null, expectedUpdatedAtByCaseId: { case: record.updatedAt } };
    return { service,input,tx,audit,actor };
  }
  it('dispatcher Case.read without actual governance operate cannot bulk assign a governed Case', async () => {
    const { service,input,tx } = fixture();
    const result = await service.bulkAssign(input);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.error).toMatch(/operate|governance/i);
    expect(tx.case.update).not.toHaveBeenCalled();
  });
  it('authorized dispatcher needs no invented Case.edit and commits parent revision/event/bulk audit in the same transaction', async () => {
    const { service,input,tx,audit } = fixture(true);
    const result = await service.bulkAssign(input);
    expect(result.succeeded).toHaveLength(1);
    expect(tx.case.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ governanceRevision: { increment: 1 } }) }));
    expect(tx.caseGovernanceEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ caseId: 'case', type: 'ASSIGNED', actorId: 'actor' }) }));
    expect(audit.logBulkItem).toHaveBeenCalledWith(expect.anything(),tx);
  });
});
