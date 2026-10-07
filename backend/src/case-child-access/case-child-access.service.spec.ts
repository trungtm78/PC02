import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CaseChildAccessService } from './case-child-access.service';

describe('CG14 child boundary current authority and atomic aggregate', () => {
  it('serializes each foreign graph using its own Case policy and only discriminated Case snapshots', async () => {
    const { service,core } = fixture();
    core.serializeCaseResult.mockImplementation(async (_tx, id, row) => ({ ...(row as object), name: `policy-${id}` }));
    const result = await service.redactCaseLinks({ otherCase: { id: 'other',name: 'private' },parentCase: { id: 'parent',name: 'private' },sourceSnapshot: { id: 'snapshot',entityType: 'CASE',name: 'private' },incident: { sourceSnapshot: { id: 'incident',name: 'public' } } },'actor');
    expect(result.otherCase.name).toBe('policy-other');
    expect(result.parentCase.name).toBe('policy-parent');
    expect(result.sourceSnapshot.name).toBe('policy-snapshot');
    expect(result.incident.sourceSnapshot.name).toBe('public');
    expect(core.serializeCaseResult.mock.calls.map(call => call[1])).toEqual(['other','parent','snapshot']);
  });
  it('mixed non-Case response retains its source fields while removing inaccessible Case IDs/graphs and native labels', async () => {
    const { service,core } = fixture();
    core.assertCaseReadable.mockRejectedValue(new ForbiddenException('No Case view'));
    const row = { id: 'incident',name: 'Public source',linkedCaseId: 'hidden',linkedCase: { id: 'hidden',name: 'PRIVATE_CASE' },metadata: { caseId: 'hidden',caseName: 'PRIVATE_CASE',unrelated: 'public' } };
    await expect(service.redactCaseLinks(row,'actor')).resolves.toEqual({ id: 'incident',name: 'Public source',metadata: { unrelated: 'public' } });
    expect(row.linkedCaseId).toBe('hidden');
  });
  it('mixed authorized graph uses pinned Case serialization and removes protected caseName aliases', async () => {
    const { service,core } = fixture();
    core.serializeCaseResult.mockResolvedValue({ id: 'case',caseCode: true,status: true });
    const result = await service.redactCaseLinks({ metadata: { caseId: 'case',caseName: 'private',caseCode: 'public-code' },linkedCase: { id: 'case',name: 'private' } },'actor');
    expect(result.metadata).not.toHaveProperty('caseName'); expect(result.metadata.caseCode).toBe('public-code'); expect(result.linkedCase).not.toHaveProperty('name');
  });
  it('source deletion cannot detach governed Case provenance, including bulk use of an existing transaction', async () => {
    const { service,tx } = fixture();
    Object.assign(tx,{ incident: { findUnique: jest.fn(async () => ({ linkedCaseId: 'case' })) },case: { ...tx.case,findMany: jest.fn(async () => [{ id: 'case' }]) } });
    const handler = jest.fn(async () => 'deleted');
    await expect(service.sourceDeletion('Incident','source','actor',handler,tx as never)).rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('source deletion rechecks current writable source scope before its handler', async () => {
    const { service,tx,core } = fixture();
    Object.assign(tx,{ petition: { findUnique: jest.fn(async () => ({ linkedCaseId: null,assignedTeamId: 'foreign',assignedToId: 'foreign-user' })) },case: { ...tx.case,findMany: jest.fn(async () => []) } });
    core.currentActorScope.mockResolvedValue({ teamIds: ['own'],userIds: ['actor'],writableTeamIds: ['own'],writableUserIds: ['actor'] } as never);
    const handler = jest.fn(async () => 'deleted');
    await expect(service.sourceDeletion('Petition','source','actor',handler,tx as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(handler).not.toHaveBeenCalled();
  });
  it.each(['document','petition-forward','petition-reverse'])('source merge preserves a Case %s association before moving any rows', async kind => {
    const { service,tx } = fixture();
    Object.assign(tx,{ incident: { findUnique: jest.fn(async () => ({ linkedCaseId: null,assignedTeamId: null,investigatorId: null })) },document: { findFirst: jest.fn(async () => kind === 'document' ? { id: 'doc' } : null) },petition: { findMany: jest.fn(async () => kind === 'document' ? [] : [{ id: 'petition',linkedCaseId: kind === 'petition-forward' ? 'case' : null }]) },case: { ...tx.case,findMany: jest.fn(async () => []),findFirst: jest.fn(async () => kind === 'petition-reverse' ? { id: 'case' } : null) } });
    const handler = jest.fn(async () => 'merged');
    await expect(service.sourceMerge('source','target','actor',handler)).rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });
  it('ordinary unlinked source merge keeps its edit permission and shared atomic transaction', async () => {
    const { service,tx,core } = fixture();
    Object.assign(tx,{ incident: { findUnique: jest.fn(async () => ({ linkedCaseId: null,assignedTeamId: null,investigatorId: null })) },document: { findFirst: jest.fn(async () => null) },petition: { findMany: jest.fn(async () => []) },case: { ...tx.case,findMany: jest.fn(async () => []) } });
    const handler = jest.fn(async db => { expect(db).toBe(tx); return 'merged'; });
    await expect(service.sourceMerge('source','target','actor',handler)).resolves.toBe('merged');
    expect(core.hasEntityPermission).toHaveBeenCalledWith(tx,'actor','Incident','edit');
    expect(tx.$transaction).toHaveBeenCalledTimes(1);
  });
  function fixture() {
    const parent = { id: 'case', updatedAt: new Date(0), governanceRevision: 4 };
    const tx = { user: { findUnique: jest.fn(async () => ({ roleId: 'role' })) }, case: { updateMany: jest.fn(async () => ({ count: 1 })) }, caseFieldDefinitionVersion: { findMany: jest.fn(async () => [] as unknown[] ) }, $queryRaw: jest.fn(async () => []), $transaction: jest.fn() };
    tx.$transaction.mockImplementation(async (handler: (db: typeof tx) => Promise<unknown>) => handler(tx));
    const core = { readableCaseWhere: jest.fn(async () => ({ id: 'view-current' })), assertCaseReadable: jest.fn(async () => parent), assertCaseWritable: jest.fn(async () => parent), serializeCaseResult: jest.fn(async (_tx: unknown, _id: string, row: unknown) => row), hasEntityPermission: jest.fn(async () => true), currentActorScope: jest.fn(async () => null), hasCapability: jest.fn(async () => false) };
    const service = new CaseChildAccessService(tx as never, core as never);
    return { tx, core, service, parent };
  }
  it('requires authenticated actor for list/detail/serialize/scope/entity', async () => {
    const { service, core } = fixture();
    for (const operation of [() => service.listWhere(), () => service.read('case'), () => service.serialize('case',{}), () => service.scope(), () => service.entity('Subject','read')])
      await expect(operation()).rejects.toBeInstanceOf(ForbiddenException);
    expect(core.readableCaseWhere).not.toHaveBeenCalled();
  });
  it('uses exact representation view for child lists rather than list summary', async () => {
    const { service, core, tx } = fixture();
    await service.listWhere('actor');
    expect(core.readableCaseWhere).toHaveBeenCalledWith(tx,{ actorId: 'actor' },{ representationCapability: 'view' });
  });
  it('checks current entity permission without cached ADMIN bypass', async () => {
    const { service, core } = fixture();
    core.hasEntityPermission.mockResolvedValue(false);
    await expect(service.entity('Subject','delete','actor')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('serializes only hydrated parent fields without deleting child status or notes', async () => {
    const { service, core } = fixture();
    core.serializeCaseResult.mockResolvedValue({ id: 'case' });
    const row = { caseId: 'case', status: 'child-status', notes: 'child-notes', case: { id: 'case', name: 'secret' } };
    await expect(service.serialize('case',row,'actor')).resolves.toEqual({ ...row, case: { id: 'case' } });
    expect(row.case.name).toBe('secret');
  });
  it('keeps ordinary result rows without a hydrated Case parent', async () => {
    const { service, core } = fixture();
    await expect(service.serialize('case', { content: 'child' },'actor')).resolves.toEqual({ content: 'child' });
    expect(core.serializeCaseResult).not.toHaveBeenCalled();
  });
  it('retains scalar serialization results', async () => {
    await expect(fixture().service.serialize('case',null,'actor')).resolves.toBeNull();
  });
  it('child write, current parent recheck and parent CAS use one serializable transaction', async () => {
    const { service, tx, core, parent } = fixture();
    const mutation = jest.fn(async () => 'committed');
    await expect(service.write(['case','case'],'actor','Subject','edit',mutation)).resolves.toBe('committed');
    expect(tx.$transaction).toHaveBeenCalledWith(expect.any(Function),{ isolationLevel: 'Serializable' });
    expect(mutation).toHaveBeenCalledWith(tx,[parent]);
    expect(core.assertCaseWritable).toHaveBeenCalledTimes(2);
    expect(tx.case.updateMany).toHaveBeenCalledWith({ where: { id: 'case', updatedAt: parent.updatedAt, governanceRevision: 4 }, data: { governanceRevision: { increment: 1 }, updatedAt: expect.any(Date) } });
  });
  it('resolves only authoritative parents supplied by the current write transaction', () => {
    const { service, parent } = fixture();
    expect(service.parent([parent] as never, 'case')).toBe(parent);
    expect(() => service.parent([parent] as never, 'other')).toThrow(ConflictException);
  });
  it('current permission revocation denies before any child or parent mutation', async () => {
    const { service, core, tx } = fixture();
    const mutation = jest.fn();
    core.hasEntityPermission.mockResolvedValue(false);
    await expect(service.write(['case'],'actor','Subject','edit',mutation)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mutation).not.toHaveBeenCalled();
    expect(tx.case.updateMany).not.toHaveBeenCalled();
  });
  it('parent scope/sensitivity/pending rejection occurs before child mutation', async () => {
    const { service, core, tx } = fixture();
    const mutation = jest.fn();
    core.assertCaseWritable.mockRejectedValue(new ConflictException('Pending handoff'));
    await expect(service.write(['case'],'actor','Subject','edit',mutation)).rejects.toBeInstanceOf(ConflictException);
    expect(mutation).not.toHaveBeenCalled();
    expect(tx.case.updateMany).not.toHaveBeenCalled();
  });
  it('parent CAS conflict fails the entire mutation', async () => {
    const { service, tx } = fixture();
    tx.case.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.write(['case'],'actor','Subject','edit',async () => 'child')).rejects.toBeInstanceOf(ConflictException);
  });
  it('serialization race becomes a retryable 409 without stale completion', async () => {
    const { service, tx } = fixture();
    tx.$transaction.mockRejectedValue(Object.assign(new Error('serialization race'),{ code: 'P2034' }));
    await expect(service.write(['case'],'actor','Subject','edit',async () => 'child')).rejects.toBeInstanceOf(ConflictException);
  });
  it('preserves unexpected database errors', async () => {
    const { service, tx } = fixture();
    const error = new Error('database unavailable');
    tx.$transaction.mockRejectedValue(error);
    await expect(service.write(['case'],'actor','Subject','edit',async () => 'child')).rejects.toBe(error);
  });
  it('denies a nonexistent current actor', async () => {
    const { service, tx } = fixture();
    tx.user.findUnique.mockResolvedValue(null as never);
    await expect(service.write(['case'],'actor','Subject','edit',async () => 'child')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('unconfigured native field search retains legacy and current visible Case predicate', async () => {
    const { service } = fixture();
    await expect(service.parentSearchWhere({ nameBd: { contains: 'token' } },'actor')).resolves.toEqual({ AND: [{ id: 'view-current' },{ nameBd: { contains: 'token' } },{ OR: [{ fieldDefinitionVersionId: null }] }] });
  });
  it('restricted/search-disabled/unpublished pinned field schemas cannot match private parent tokens', async () => {
    const { service, tx } = fixture();
    tx.caseFieldDefinitionVersion.findMany.mockResolvedValue([
      { id: 'restricted', status: 'PUBLISHED', definition: { fieldPolicies: [{ key: 'name', sensitivity: 'RESTRICTED' }] } },
      { id: 'disabled', status: 'PUBLISHED', definition: { fieldPolicies: [{ key: 'name', sensitivity: 'NORMAL', searchable: false }] } },
      { id: 'draft', status: 'DRAFT', definition: { fieldPolicies: [] } },
      { id: 'normal', status: 'PUBLISHED', definition: { fieldPolicies: [] } },
    ]);
    const where = await service.parentSearchWhere({ AND: [{ nameBd: { contains: 'secret' } }] },'actor');
    expect(JSON.stringify(where)).toContain('caseGovernanceGrant_case');
    expect(JSON.stringify(where)).toContain('restricted');
    expect(JSON.stringify(where)).toContain('normal');
    expect(JSON.stringify(where)).not.toContain('disabled');
    expect(JSON.stringify(where)).not.toContain('draft');
  });
  it('explicit full sensitive authority permits restricted searchable parent fields', async () => {
    const { service, tx, core } = fixture();
    core.hasCapability.mockResolvedValue(true);
    tx.caseFieldDefinitionVersion.findMany.mockResolvedValue([{ id: 'restricted', status: 'PUBLISHED', definition: { fieldPolicies: [{ key: 'name', sensitivity: 'RESTRICTED' }] } }]);
    const where = await service.parentSearchWhere({ nameBd: { contains: 'secret' } },'actor');
    expect(JSON.stringify(where)).not.toContain('caseGovernanceGrant_case');
    expect(JSON.stringify(where)).toContain('restricted');
  });
  it('rewrites parent relation branches while retaining unrelated child OR terms and scalar/null fields', async () => {
    const { service } = fixture();
    const where = await service.policyQuery({ OR: [{ fullName: { contains: 'public-child' } },{ case: { is: { nameBd: { contains: 'token' } } } }], unrelated: null },'case','actor');
    expect(where.OR[0]).toEqual({ fullName: { contains: 'public-child' } });
    expect(where.OR[1]).toHaveProperty('case.is.AND');
    expect(where.unrelated).toBeNull();
  });
  it('supports direct shorthand parent relations', async () => {
    const where = await fixture().service.policyQuery({ case: { nameBd: { contains: 'token' } } },'case','actor');
    expect(where).toHaveProperty('case.AND');
  });
  it('native parent export omits fields whose pinned export policy disallows them', async () => {
    const {service,tx,core}=fixture();
    core.assertCaseReadable.mockResolvedValue({id:'case',fieldDefinitionVersionId:'schema'} as never);
    Object.assign(tx.caseFieldDefinitionVersion,{findUnique:jest.fn(async()=>({status:'PUBLISHED',definition:{fieldPolicies:[{key:'name',sensitivity:'NORMAL',exportable:false}]}}))});
    Object.assign(core,{hasSensitiveAccess:jest.fn(async()=>false)});
    const result=await service.serialize('case',{case:{id:'case',name:'PRIVATE_NAME',caseCode:'Public'}},'actor',tx as never,'export');
    expect(result.case).not.toHaveProperty('name');
    expect(result.case.caseCode).toBe('Public');
  });
});
