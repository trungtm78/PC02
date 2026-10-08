import { LegalWorkflowService } from './legal-workflow.service';
import { configurationHash } from './case-configuration.service';
const sourceSnapshot = {
  documentId: 'doc',
  caseId: 'source',
  documentUpdatedAt: '2026-10-01',
  sha256: 'a'.repeat(64),
  byteLength: 1,
  assetVersionId: null,
  parentVersionId: null,
  parentSha256: null,
};
const payload = {
  decision: {
    type: 'CORRECTION',
    number: 'C01',
    date: '2026-10-01',
    effectiveDate: '2026-10-02',
    issuer: 'Authority',
    signatory: 'Signer',
    legalBasis: 'Synthetic provision',
    sourceDocumentId: 'doc',
  },
  sourceSnapshot,
  correctedDecisionId: 'original',
  relationId: 'relation',
  expectedRelationRevision: 2,
  reason: 'Reviewed relation revocation',
};
describe('CG08 reviewed relation revision and preserved history', () => {
  function make() {
    const row = {
      id: 'req',
      caseId: 'source',
      authorId: 'author',
      reviewedById: 'reviewer',
      actionCode: 'CORRECT_DECISION',
      ruleVersionId: 'rule',
      revision: 1,
      status: 'APPROVED',
      payload,
      contentHash: configurationHash({
        actionCode: 'CORRECT_DECISION',
        ruleVersionId: 'rule',
        payload,
      }),
      updatedAt: new Date('2026-10-01'),
    };
    Object.assign(row, { approvedHash: row.contentHash, approvedRevision: 1 });
    const rule = {
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
            code: 'CORRECT_DECISION',
            legalSources: [
              {
                instrument: 'Synthetic',
                provision: '1',
                url: 'https://example.test',
                authority: 'Authority',
                effectiveFrom: '2026-01-01',
              },
            ],
          },
        ],
      },
    };
    const tx = {
      caseActionRequest: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caseRuleVersion: { findUnique: jest.fn().mockResolvedValue(rule) },
      document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc' }) },
      caseDecision: {
        findFirst: jest.fn().mockResolvedValue({ id: 'original' }),
        create: jest.fn().mockResolvedValue({ id: 'correction' }),
      },
      caseRelation: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'relation',
            sourceCaseId: 'source',
            targetCaseId: 'target',
            decisionId: 'original',
            revision: 2,
            revokedAt: null,
            deletedAt: null,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      case: { update: jest.fn() },
    };
    const core = {
      mutateCase: jest.fn((i, a, f) =>
        f(tx, {
          caseRecord: {
            id: 'source',
            status: 'DANG_DIEU_TRA',
            investigationPhase: 'INITIAL',
            deadline:null,
          },
          operationId: 'op',
        }),
      ),
      hasCapability: jest.fn().mockResolvedValue(true),
      assertCaseReadable: jest.fn(),
      assertCaseWritable: jest.fn(),
      recordEvent: jest.fn(),
      enqueue: jest.fn(),
    };
    const evidence = {
      decisionSourceSnapshot: jest.fn().mockResolvedValue(sourceSnapshot),
    };
    return {
      svc: new LegalWorkflowService(
        {} as never,
        core as never,
        undefined,
        evidence as never,
      ),
      tx,
      core,
    };
  }
  const dto = {
    requestKey: 'key',
    expectedUpdatedAt: '2026-10-01',
    expectedAggregateUpdatedAt: '2026-10-01',
    expectedRevision: 1,
  };
  it('appends correction and revokes exact active revision with authorization on both parents', async () => {
    const { svc, tx, core } = make();
    await expect(
      svc.execute('source', 'req', dto, { actorId: 'operator' }),
    ).resolves.toMatchObject({ success: true });
    expect(core.assertCaseWritable).toHaveBeenCalledWith(tx, 'target', {
      actorId: 'operator',
    });
    expect(tx.caseRelation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'relation',
          revision: 2,
          revokedAt: null,
          deletedAt: null,
        }),
        data: expect.objectContaining({
          revision: { increment: 1 },
          revokedAt: expect.any(Date),
          revokedById: 'operator',
        }),
      }),
    );
  });
  it('stale relation revision produces no correction or revocation writes', async () => {
    const { svc, tx } = make();
    tx.caseRelation.findFirst.mockResolvedValue({
      id: 'relation',
      sourceCaseId: 'source',
      targetCaseId: 'target',
      decisionId: 'original',
      revision: 3,
      revokedAt: null,
      deletedAt: null,
    });
    await expect(
      svc.execute('source', 'req', dto, { actorId: 'operator' }),
    ).rejects.toThrow();
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
    expect(tx.caseRelation.updateMany).not.toHaveBeenCalled();
  });
});
