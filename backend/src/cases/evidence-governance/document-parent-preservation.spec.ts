import { CaseEvidenceGovernanceService } from './evidence-governance.service';
function fixture() {
  const row = {
    id: 'document',
    caseId: 'old-case',
    updatedAt: new Date('2026-10-06'),
  };
  const tx = {
    document: { findFirst: jest.fn().mockResolvedValue(row) },
    case: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'new-case',
        createdById: 'actor',
        assignedTeamId: 'team',
        investigatorId: 'actor',
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ createdHere: true }]),
    caseAssetVersion: { findUnique: jest.fn().mockResolvedValue(null) },
    caseDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    caseCustodyEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    caseDispositionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    caseEvidenceHold: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const core = { assertCaseWritable: jest.fn(), assertCaseCreation: jest.fn() };
  return {
    row,
    tx,
    core,
    service: new CaseEvidenceGovernanceService(
      tx as never,
      core as never,
      {} as never,
    ),
  };
}
describe('source adapter parent changes preserve original document provenance', () => {
  it.each([
    'caseAssetVersion',
    'caseDecision',
    'caseCustodyEvent',
    'caseDispositionRequest',
  ] as const)(
    'blocks %s before the source adapter can change a parent',
    async (delegate) => {
      const { service, tx } = fixture();
      if (delegate === 'caseAssetVersion')
        tx.caseAssetVersion.findUnique.mockResolvedValue({ id: 'original' });
      else tx[delegate].findFirst.mockResolvedValue({ id: 'provenance' });
      await expect(
        service.assertDocumentCanChangeParent(
          tx as never,
          'document',
          { actorId: 'actor' },
          'new-case',
        ),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it('keeps source hold and existing source pending/writable guards', async () => {
    const { service, tx, core } = fixture();
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'hold' });
    await expect(
      service.assertDocumentCanChangeParent(
        tx as never,
        'document',
        { actorId: 'actor' },
        'new-case',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(core.assertCaseWritable).toHaveBeenCalledWith(tx, 'old-case', {
      actorId: 'actor',
    });
  });
  it('a newly created target uses actual creation authority without inventing Case.edit', async () => {
    const { service, tx, core } = fixture();
    await service.assertDocumentCanChangeParent(
      tx as never,
      'document',
      { actorId: 'actor' },
      'new-case',
      { targetCreatedInTransaction: true },
    );
    expect(core.assertCaseCreation).toHaveBeenCalled();
    expect(core.assertCaseWritable).toHaveBeenCalledTimes(1);
    expect(core.assertCaseWritable).toHaveBeenCalledWith(tx, 'old-case', {
      actorId: 'actor',
    });
  });
  it('rejects a falsely labelled preexisting target from the same creator', async () => {
    const { service, tx } = fixture();
    tx.$queryRaw.mockResolvedValue([{ createdHere: false }]);
    await expect(
      service.assertDocumentCanChangeParent(
        tx as never,
        'document',
        { actorId: 'actor' },
        'new-case',
        { targetCreatedInTransaction: true },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
