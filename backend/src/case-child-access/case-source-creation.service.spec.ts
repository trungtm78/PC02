import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CaseSourceCreationService } from './case-source-creation.service';

describe('CG14 explicit source creation transaction', () => {
  function fixture() {
    const source = { id: 'source', assignedTeamId: 'team', investigatorId: 'actor', assignedToId: 'actor', updatedAt: new Date(0), linkedCaseId: null as string | null };
    const record = { id: 'case', name: 'New Case', assignedTeamId: 'team', investigatorId: 'actor' };
    const tx = { user: { findUnique: jest.fn(async () => ({ roleId: 'role' })) }, incident: { findFirst: jest.fn(async () => source) }, petition: { findFirst: jest.fn(async () => source) }, featureFlag: { findUnique: jest.fn(async () => ({ enabled: true })) }, caseGovernanceOperation: { findUnique: jest.fn(async () => null as { contentHash: string; caseId: string } | null), create: jest.fn(async (_input: { data: Record<string, unknown> }) => ({})) }, $queryRaw: jest.fn(async () => []), $transaction: jest.fn() };
    tx.$transaction.mockImplementation(async (handler: (db: typeof tx) => unknown) => handler(tx));
    const core = { hasEntityPermission: jest.fn(async () => true), accessProfile: jest.fn(async () => ({ caseAccessMode: 'INTERNAL' })), currentActorScope: jest.fn(async () => null), assertCaseCreation: jest.fn(async () => undefined), assertCaseReadable: jest.fn(async () => record), serializeCaseResult: jest.fn(async (_tx: unknown,_id: string,row: unknown) => row), recordEvent: jest.fn(async () => undefined), enqueue: jest.fn(async () => undefined) };
    const fields = { validateForWrite: jest.fn(async (_tx: unknown,input: { metadata?: object }) => ({ metadata: input.metadata ?? {}, fieldDefinitionVersionId: 'pinned-schema' })) };
    const service = new CaseSourceCreationService(tx as never,core as never,fields as never);
    const command = { kind: 'Incident' as const, sourceId: 'source', expectedUpdatedAt: source.updatedAt.toISOString(), payload: { caseName: 'New Case', prosecutionDate: '2026-10-01' } };
    const handler = jest.fn(async () => record as never);
    return { tx, core, fields, source, record, service, command, handler };
  }
  it('denies omitted authenticated actor before opening a mutation transaction', async () => {
    const { service, command, handler, tx } = fixture();
    await expect(service.execute(command,'',handler)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.$transaction).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(201)])('rejects invalid bounded request key %s', async requestKey => {
    const { service, command, handler } = fixture();
    await expect(service.execute({ ...command,requestKey },'actor',handler)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires current source edit and actual Case creation authority before source writes', async () => {
    const { service, command, handler, core } = fixture();
    core.hasEntityPermission.mockResolvedValue(false);
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('rejects representation-only source actors even with staff role capabilities', async () => {
    const { service, command, handler, core } = fixture();
    core.accessProfile.mockResolvedValue({ caseAccessMode: 'REPRESENTATION_ONLY' });
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('rejects missing and deactivated source actor', async () => {
    const { service, command, handler, tx } = fixture();
    tx.user.findUnique.mockResolvedValue(null as never);
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects nonexistent current source', async () => {
    const { service, command, handler, tx } = fixture();
    tx.incident.findFirst.mockResolvedValue(null as never);
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('flag ON requires actual source version before mutation', async () => {
    const { service, command, handler } = fixture();
    await expect(service.execute({ ...command,expectedUpdatedAt: undefined },'actor',handler)).rejects.toBeInstanceOf(BadRequestException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('legacy OFF Incident compatibility still binds the currently loaded source version', async () => {
    const { service, command, handler, tx } = fixture();
    tx.featureFlag.findUnique.mockResolvedValue({ enabled: false });
    await expect(service.execute({ ...command,expectedUpdatedAt: undefined },'actor',handler)).resolves.toHaveProperty('replayed',false);
    expect(tx.caseGovernanceOperation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ result: expect.objectContaining({ expectedSourceUpdatedAt: '1970-01-01T00:00:00.000Z' }) }) }));
  });
  it.each(['invalid','2026-10-05T00:00:00Z'])('rejects invalid/stale source version %s before consuming a Case number', async expectedUpdatedAt => {
    const { service, command, handler } = fixture();
    await expect(service.execute({ ...command,expectedUpdatedAt },'actor',handler)).rejects.toBeInstanceOf(expectedUpdatedAt==='invalid'?BadRequestException:ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('source write, durable ledger, Case audit/event, outbox and field serialization share one serializable transaction', async () => {
    const { service, command, handler, tx, core } = fixture();
    await expect(service.execute(command,'actor',handler)).resolves.toHaveProperty('caseRecord.id','case');
    expect(tx.$transaction).toHaveBeenCalledWith(expect.any(Function),{ isolationLevel: 'Serializable' });
    expect(core.recordEvent).toHaveBeenCalledWith(tx,'case',expect.any(String),'actor','SOURCE_CASE_CREATED',expect.objectContaining({ sourceId: 'source' }));
    expect(core.enqueue).toHaveBeenCalledWith(tx,'case',expect.any(String),expect.objectContaining({ type: 'CASE_CREATED' }),['actor']);
    expect(core.serializeCaseResult).toHaveBeenCalledWith(tx,'case',expect.any(Object),{ actorId: 'actor' });
  });
  it('Case.create denial aborts before source handler and operation ledger', async () => {
    const { service, command, handler, core, tx } = fixture();
    core.assertCaseCreation.mockRejectedValue(new ForbiddenException('Case.write missing'));
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handler).not.toHaveBeenCalled(); expect(tx.caseGovernanceOperation.create).not.toHaveBeenCalled();
  });
  it('canonical native/custom validation pins server schema and preserves source dates without inventing phase', async () => {
    const { service, command, fields } = fixture();
    const result = await service.execute(command,'actor',async (_tx,_source,context) => {
      const input = await context.prepare({ name: 'New Case', caseProvenance: 'FROM_INCIDENT', linkedIncidentId: 'source', ngayKhoiTo: new Date('2026-10-01T00:00:00Z') });
      expect(input).toEqual(expect.objectContaining({ fieldDefinitionVersionId: 'pinned-schema', createdById: 'actor', assignedTeamId: 'team', investigatorId: 'actor', ngayKhoiTo: new Date('2026-10-01T00:00:00Z'), intakeStage: 'PHAN_LOAI' }));
      expect(input).not.toHaveProperty('investigationPhase');
      expect(fields.validateForWrite).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({ ngayKhoiTo: '2026-10-01T00:00:00.000Z' }),null,{ actorId: 'actor' });
      return { id: 'case', ...input } as never;
    });
    expect(result.replayed).toBe(false);
  });
  it('idempotent replay returns current authorized/serialized Case without counter, source write or duplicate outbox', async () => {
    const { service, command, handler, tx, source, core } = fixture();
    await service.execute(command,'actor',handler);
    const stored = tx.caseGovernanceOperation.create.mock.calls[0]![0] as unknown as { data: { contentHash: string; caseId: string } };
    source.linkedCaseId = 'case'; source.updatedAt = new Date(1);
    tx.caseGovernanceOperation.findUnique.mockResolvedValue(stored.data);
    handler.mockClear(); core.recordEvent.mockClear(); core.enqueue.mockClear();
    await expect(service.execute(command,'actor',handler)).resolves.toHaveProperty('replayed',true);
    expect(handler).not.toHaveBeenCalled(); expect(core.recordEvent).not.toHaveBeenCalled(); expect(core.enqueue).not.toHaveBeenCalled();
  });
  it('request key reuse with changed content rejects replay', async () => {
    const { service, command, handler, tx } = fixture();
    tx.caseGovernanceOperation.findUnique.mockResolvedValue({ contentHash: 'different', caseId: 'case' });
    await expect(service.execute({ ...command,requestKey: 'one-key' },'actor',handler)).rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('serialization conflict becomes 409 and arbitrary faults stay faults', async () => {
    const { service, command, handler, tx } = fixture();
    tx.$transaction.mockRejectedValue(Object.assign(new Error('race'),{ code: 'P2034' }));
    await expect(service.execute(command,'actor',handler)).rejects.toBeInstanceOf(ConflictException);
    const fault = new Error('fault'); tx.$transaction.mockRejectedValue(fault);
    await expect(service.execute(command,'actor',handler)).rejects.toBe(fault);
  });
});
