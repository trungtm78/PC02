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
    type: 'REINVESTIGATION',
    number: 'R01',
    date: '2026-01-01',
    effectiveDate: '2026-01-02',
    issuer: 'Authority',
    signatory: 'Signer',
    legalBasis: 'Synthetic provision',
    sourceDocumentId: 'doc',
  },
  sourceSnapshot,
  deadlineFacts: {
    dossierReceipt: { date: '2026-01-30', quality: 'VERIFIED' },
    requestReceipt: { date: '2026-01-31', quality: 'VERIFIED' },
    gravity: 'IT_NGHIEM_TRONG',
  },
};
const effect = {
  mode: 'CALCULATE',
  algorithm: 'CIVIL_PERIOD',
  version: 1,
  phase: 'REINVESTIGATION',
  anchors: {
    dossierReceipt: 'payload.deadlineFacts.dossierReceipt',
    requestReceipt: 'payload.deadlineFacts.requestReceipt',
  },
  gravityPath: 'payload.deadlineFacts.gravity',
  durations: [{ gravity: 'IT_NGHIEM_TRONG', value: 1, unit: 'MONTHS' }],
  calendar: {
    id: 'synthetic-calendar',
    version: '1',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2030-01-01',
    weekendDays: [],
    nonworkingDates: [],
    workingOverrides: [],
    sourceReferenceIds: ['law'],
  },
  sourceReferenceIds: ['law'],
};
describe('CG-DL01 deadline effect atomic legal integration', () => {
  function fixture() {
    const hash = configurationHash({
        actionCode: 'REINVESTIGATE_AFTER_SUPPLEMENT',
        ruleVersionId: 'rule',
        payload,
      }),
      row = {
        id: 'req',
        caseId: 'case',
        authorId: 'author',
        reviewedById: 'reviewer',
        actionCode: 'REINVESTIGATE_AFTER_SUPPLEMENT',
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
      status: 'DANG_DIEU_TRA',
      investigationPhase: 'SUPPLEMENTARY',
      deadline: new Date('2099-01-01'),
      fieldDefinitionVersionId: null,
      investigatorId: 'investigator',
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
                  code: 'REINVESTIGATE_AFTER_SUPPLEMENT',
                  deadlineEffect: effect,
                  legalSources: [
                    {
                      id: 'law',
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
          }),
      },
      document: { findFirst: jest.fn().mockResolvedValue({ id: 'doc' }) },
      caseDecision: { create: jest.fn().mockResolvedValue({ id: 'decision' }) },
      case: { update: jest.fn() },
      caseGovernanceTask: { upsert: jest.fn() },
      caseStatusHistory: { create: jest.fn() },
    };
    const core = {
        mutateCase: jest.fn((i, a, f) =>
          f(tx, { caseRecord: record, operationId: 'op' }),
        ),
        hasCapability: jest.fn().mockResolvedValue(true),
        assertCaseWritable: jest.fn(),
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
    };
  }
  const dto = {
    requestKey: 'deadline',
    expectedUpdatedAt: '2026-10-01',
    expectedAggregateUpdatedAt: '2026-10-01',
    expectedRevision: 1,
  };
  it('uses later actual receipt and month-end calendar instead of decision date or old initial deadline', async () => {
    const { service, tx, core } = fixture();
    await service.execute('case', 'req', dto, { actorId: 'executor' });
    expect(tx.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deadline: new Date('2026-02-28T16:59:59.999Z'),
          investigationPhase: 'REINVESTIGATION',
        }),
      }),
    );
    expect(tx.caseDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facts: expect.objectContaining({
            deadlineEvaluation: expect.objectContaining({
              algorithm: 'CIVIL_PERIOD',
              version: 1,
            }),
          }),
        }),
      }),
    );
    expect(core.recordEvent).toHaveBeenCalledWith(
      tx,
      'case',
      'op',
      'executor',
      'ACTION_EXECUTED',
      expect.objectContaining({ deadlineEvaluation: expect.any(Object) }),
    );
    expect(tx.caseGovernanceTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          dueAt: new Date('2026-02-28T16:59:59.999Z'),
        }),
      }),
    );
  });
  it('missing actual dossier/request receipt creates no decision, status/date or task mutation', async () => {
    const { service, tx } = fixture();
    const r = await tx.caseActionRequest.findFirst();
    r.payload = {
      ...payload,
      deadlineFacts: { gravity: 'IT_NGHIEM_TRONG' },
    } as never;
    r.contentHash = configurationHash({
      actionCode: r.actionCode,
      ruleVersionId: r.ruleVersionId,
      payload: r.payload,
    });
    r.approvedHash = r.contentHash;
    await expect(
      service.execute('case', 'req', dto, { actorId: 'executor' }),
    ).rejects.toThrow();
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
    expect(tx.case.update).not.toHaveBeenCalled();
  });
});
