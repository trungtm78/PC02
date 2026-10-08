import { LegalWorkflowService } from './legal-workflow.service';
import { configurationHash } from './case-configuration.service';
const sourceSnapshot = {
  documentId: 'doc',
  caseId: 'case',
  documentUpdatedAt: '2026-10-01',
  sha256: 'a'.repeat(64),
  byteLength: 1,
  assetVersionId: null,
  parentVersionId: null,
  parentSha256: null,
};
const payload = {
  decision: {
    type: 'CLASSIFICATION',
    number: 'C01',
    date: '2026-10-01',
    effectiveDate: '2026-10-02',
    issuer: 'Authority',
    signatory: 'Signer',
    legalBasis: 'Policy provision',
    sourceDocumentId: 'doc',
  },
  sourceSnapshot,
  sensitivity: 'RESTRICTED',
  inspectionPurpose: 'Reviewed classification inspection',
  reason: 'Reviewed tightening',
};
describe('CG14 independently reviewed classification', () => {
  function fixture() {
    const hash = configurationHash({
        actionCode: 'CLASSIFY_SENSITIVITY',
        ruleVersionId: 'rule',
        payload,
      }),
      row = {
        id: 'request',
        caseId: 'case',
        authorId: 'author',
        reviewedById: 'reviewer',
        actionCode: 'CLASSIFY_SENSITIVITY',
        ruleVersionId: 'rule',
        revision: 1,
        status: 'APPROVED',
        payload,
        contentHash: hash,
        approvedHash: hash,
        approvedRevision: 1,
        updatedAt: new Date('2026-10-01'),
      };
    const record = {
      id: 'case',
      status: 'DA_KET_LUAN',
      investigationPhase: null,
      deadline:null,
      ngayGiaiQuyet: new Date('2026-09-01'),
      sensitivity: 'NORMAL',
      metadata: { sensitivity: 'UNKNOWN_LEGACY_LABEL', note: 'preserve' },
    };
    const tx = {
      caseActionRequest: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caseRuleVersion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'rule',
            revision: 1,
            status: 'PUBLISHED',
            sourceVerified: true,
            authorId: 'law-author',
            reviewedById: 'law-reviewer',
            contentHash: 'r',
            approvedHash: 'r',
            approvedRevision: 1,
            effectiveFrom: new Date('2026-01-01'),
            effectiveTo: null,
            definition: {
              actions: [
                {
                  code: 'CLASSIFY_SENSITIVITY',
                  legalSources: [
                    {
                      instrument: 'Synthetic policy',
                      provision: '1',
                      url: 'https://example.test',
                      authority: 'Policy authority',
                      effectiveFrom: '2026-01-01',
                    },
                  ],
                },
              ],
            },
          }),
      },
      document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc' }) },
      caseDecision: { create: jest.fn().mockResolvedValue({ id: 'decision' }) },
      case: { update: jest.fn() },
      caseStatusHistory: { create: jest.fn() },
    };
    const core = {
        mutateCase: jest.fn((i, a, f) =>
          f(tx, { caseRecord: record, operationId: 'op' }),
        ),
        hasCapability: jest.fn().mockResolvedValue(true),
        assertCaseWritable: jest.fn().mockResolvedValue(record),
        assertClassificationInspectable: jest.fn().mockResolvedValue(record),
        recordEvent: jest.fn(),
        enqueue: jest.fn(),
      },
      evidence = {
        decisionSourceSnapshot: jest.fn().mockResolvedValue(sourceSnapshot),
      };
    return {
      service: new LegalWorkflowService(
        {} as never,
        core as never,
        undefined,
        evidence as never,
      ),
      tx,
      core,
      evidence,
    };
  }
  const dto = {
    requestKey: 'classification',
    expectedUpdatedAt: '2026-10-01',
    expectedAggregateUpdatedAt: '2026-10-01',
    expectedRevision: 1,
  };
  it('tightens dedicated/legacy labels while preserving prior audit evidence and all legal state/dates', async () => {
    const { service, tx, core } = fixture();
    await service.execute('case', 'request', dto, { actorId: 'executor' });
    expect(core.assertClassificationInspectable).toHaveBeenCalledWith(
      tx,
      'case',
      { actorId: 'executor' },
      payload.inspectionPurpose,
    );
    expect(tx.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sensitivity: 'RESTRICTED',
          metadata: expect.objectContaining({
            sensitivity: 'RESTRICTED',
            note: 'preserve',
            _sensitivityHistory: [
              expect.objectContaining({
                previous: 'NORMAL',
                previousLegacy: {
                  sensitivity: 'UNKNOWN_LEGACY_LABEL',
                  _sensitivity: null,
                },
                decisionId: 'decision',
              }),
            ],
          }),
        }),
      }),
    );
    expect(tx.caseStatusHistory.create).not.toHaveBeenCalled();
    expect(
      tx.case.update.mock.calls.every(
        ([arg]: any) =>
          arg.data.status === undefined || arg.data.status === 'DA_KET_LUAN',
      ),
    ).toBe(true);
    expect(
      tx.case.update.mock.calls.every(
        ([arg]: any) => arg.data.ngayGiaiQuyet === undefined,
      ),
    ).toBe(true);
  });
  it('missing purpose-authorized INTERNAL manage_access/read_sensitive denies classification before any mutation', async () => {
    const { service, tx, core } = fixture();
    core.assertClassificationInspectable.mockRejectedValue(
      new Error('Classification authority required'),
    );
    await expect(
      service.execute('case', 'request', dto, { actorId: 'executor' }),
    ).rejects.toThrow('Classification authority');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
    expect(tx.case.update).not.toHaveBeenCalled();
  });
});
