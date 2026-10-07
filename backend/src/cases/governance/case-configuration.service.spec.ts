import { CaseConfigurationService } from './case-configuration.service';
describe('CG06/07 configuration publication', () => {
  const make = (row: Record<string, unknown>) => {
    const model = {
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = {
      caseFieldDefinitionVersion: model,
      auditLog: { create: jest.fn() },
    };
    const db = { $transaction: jest.fn((f) => f(tx)) };
    const core = {
      accessProfile: jest
        .fn()
        .mockResolvedValue({ caseAccessMode: 'INTERNAL' }),
      ensureEnabled: jest.fn(),
      hasCapability: jest.fn().mockResolvedValue(true),
    };
    return {
      svc: new CaseConfigurationService(db as never, core as never),
      model,
      core,
    };
  };
  const row = {
    id: 's',
    code: 'default',
    revision: 1,
    status: 'REVIEWED',
    definition: { fields: [] },
    contentHash: 'hash',
    approvedHash: 'hash',
    approvedRevision: 1,
    authorId: 'author',
    reviewedById: 'reviewer',
    updatedAt: new Date('2026-10-01'),
  };
  it('publishes only exact independently reviewed revision', async () => {
    const { svc, model } = make(row);
    await expect(
      svc.transition(
        'fields',
        's',
        'publish',
        { expectedUpdatedAt: '2026-10-01', expectedRevision: 1 },
        { actorId: 'publisher' },
      ),
    ).resolves.toMatchObject({ success: true });
    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revision: 1, status: 'REVIEWED' }),
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });
  it.each([
    { ...row, authorId: 'publisher' },
    { ...row, approvedHash: 'changed' },
    { ...row, approvedRevision: 2 },
    { ...row, status: 'PUBLISHED' },
  ])('rejects author/stale/hash/republication', async (r) => {
    const { svc, model } = make(r);
    await expect(
      svc.transition(
        'fields',
        's',
        'publish',
        { expectedUpdatedAt: '2026-10-01', expectedRevision: 1 },
        { actorId: 'publisher' },
      ),
    ).rejects.toThrow();
    expect(model.updateMany).not.toHaveBeenCalled();
  });
  it('technical administrator needs explicit publication capability', async () => {
    const { svc, core } = make(row);
    core.hasCapability.mockResolvedValue(false);
    await expect(
      svc.transition(
        'fields',
        's',
        'publish',
        { expectedUpdatedAt: '2026-10-01', expectedRevision: 1 },
        { actorId: 'publisher' },
      ),
    ).rejects.toThrow();
  });
  it('representation-only users cannot publish global configuration even with accidental publish role capability', async () => {
    const { svc, core, model } = make(row);
    core.accessProfile.mockResolvedValue({
      caseAccessMode: 'REPRESENTATION_ONLY',
    });
    await expect(
      svc.transition(
        'fields',
        's',
        'publish',
        { expectedUpdatedAt: '2026-10-01', expectedRevision: 1 },
        { actorId: 'publisher' },
      ),
    ).rejects.toThrow('Internal');
    expect(model.updateMany).not.toHaveBeenCalled();
  });
});
