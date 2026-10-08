import { CaseFieldSchemaService } from './case-field-schema.service';
describe('CG14 REPRESENTATION_ONLY summary search partition', () => {
  function fixture() {
    const db = {
      caseFieldDefinitionVersion: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ co: false }]),
    };
    const core = {
      accessProfile: jest
        .fn()
        .mockResolvedValue({ caseAccessMode: 'REPRESENTATION_ONLY' }),
      readableCaseWhere: jest
        .fn()
        .mockImplementation(async (_tx: any, _actor: any, options?: any) =>
          options?.representationCapability === 'view'
            ? { id: 'viewCase' }
            : { id: { in: ['listCase', 'viewCase'] } },
        ),
      hasCapability: jest.fn().mockResolvedValue(false),
    };
    return {
      service: new CaseFieldSchemaService(db as never, core as never),
      db,
      core,
    };
  }
  it('list-only broad search uses only id/code/name/status even with no field schema; view partition retains full permitted search', async () => {
    const { service } = fixture();
    const where: any = await service.policyAwareSearchWhere(
      {
        caseFieldDefinitionVersion: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ co: false }]),
      } as never,
      { actorId: 'lawyer' },
      { search: 'all' },
    );
    expect(where).not.toBeNull();
    const summary = where.AND[1].OR[1];
    expect(JSON.stringify(summary)).toContain('nameBd');
    expect(JSON.stringify(summary)).not.toContain('timKiemBd');
    expect(JSON.stringify(summary)).not.toContain('moTaChiTiet');
  });
  it('private sort/phase/empty filters are intersected with view grants, not evaluated on list-only cases', async () => {
    const { service, db } = fixture();
    const result = await service.policyAwareSearchWhere(
      db as never,
      { actorId: 'lawyer' },
      { investigationPhase: 'INITIAL', sortBy: 'ngayKhoiTo' },
    );
    expect(result).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ id: 'viewCase' }]),
      }),
    );
  });
  it('implicit reporting dates affect full-view cases but never list-only summary counts', async () => {
    const { service, db } = fixture();
    const period = { ngayKhoiTo: { gte: new Date('2026-01-01') } };
    const where: any = await service.policyAwareSearchWhere(
      db as never,
      { actorId: 'lawyer' },
      { search: 'summary' },
      undefined,
      false,
      { field: 'ngayKhoiTo', where: period },
    );
    expect(JSON.stringify(where.AND[1].OR[0])).toContain('2026-01-01');
    expect(JSON.stringify(where.AND[1].OR[1])).not.toContain('2026-01-01');
  });
  it('omits implicit protected-date predicates only from the current non-sensitive schema partition', async () => {
    const { service, db, core } = fixture();
    core.accessProfile.mockResolvedValue({ caseAccessMode: 'INTERNAL' });
    db.caseFieldDefinitionVersion.findMany.mockResolvedValue([
      {
        id: 'private',
        status: 'PUBLISHED',
        definition: {
          fields: [],
          fieldPolicies: [{ key: 'deadline', sensitivity: 'RESTRICTED' }],
        },
      },
    ] as never);
    const where: any = await service.policyAwareSearchWhere(
      db as never,
      { actorId: 'reader' },
      {},
      undefined,
      false,
      {
        field: 'deadline',
        where: { deadline: { gte: new Date('2026-01-01') } },
      },
    );
    expect(JSON.stringify(where.AND[1].OR[0])).toContain('2026-01-01');
    expect(JSON.stringify(where.AND[1].OR[1])).toContain('2026-01-01');
    expect(JSON.stringify(where.AND[1].OR[2])).not.toContain('2026-01-01');
  });
});
