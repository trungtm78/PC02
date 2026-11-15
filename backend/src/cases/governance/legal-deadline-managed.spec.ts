import { LegalWorkflowService } from './legal-workflow.service';
import { configurationHash } from './case-configuration.service';
import { DEADLINE_MANAGED_BY_FLOW } from '../../processing-flow/records/deadline-managed.guard';

/**
 * A governed action that moves the deadline of a case whose flow keeps it is refused before anything is written.
 * Same fixture as legal-deadline-integration.spec.ts (which builds the service without a writer), with a writer of the
 * managed deadline injected.
 */
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
describe('CG-DL02 a governed action never moves the deadline a flow keeps', () => {
  function fixture(managed: boolean | 'none') {
    const hash = configurationHash({
      actionCode: 'REINVESTIGATE_AFTER_SUPPLEMENT',
      ruleVersionId: 'rule',
      payload,
    });
    const row = {
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
        findUnique: jest.fn().mockResolvedValue({
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
      case: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ deadline: new Date('2099-01-01') }) },
      caseGovernanceTask: { upsert: jest.fn() },
      caseStatusHistory: { create: jest.fn() },
    };
    const core = {
      mutateCase: jest.fn((i, a, f) => f(tx, { caseRecord: record, operationId: 'op' })),
      hasCapability: jest.fn().mockResolvedValue(true),
      assertCaseWritable: jest.fn(),
      recordEvent: jest.fn(),
      enqueue: jest.fn(),
    };
    const evidence = { decisionSourceSnapshot: jest.fn().mockResolvedValue(sourceSnapshot) };
    const writer = { isManaged: jest.fn().mockResolvedValue(managed === true) };
    return {
      writer,
      tx,
      service: new LegalWorkflowService(
        {} as never,
        core as never,
        undefined,
        evidence as never,
        undefined,
        managed === 'none' ? undefined : (writer as never),
      ),
    };
  }
  const dto = {
    requestKey: 'deadline',
    expectedUpdatedAt: '2026-10-01',
    expectedAggregateUpdatedAt: '2026-10-01',
    expectedRevision: 1,
  };

  it('a managed record: the action that moves the deadline is refused before anything is written', async () => {
    const { service, tx, writer } = fixture(true);
    await expect(service.execute('case', 'req', dto, { actorId: 'executor' })).rejects.toMatchObject({
      response: { code: DEADLINE_MANAGED_BY_FLOW },
    });
    expect(writer.isManaged).toHaveBeenCalledWith(tx, 'CASE', 'case');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
    expect(tx.case.update).not.toHaveBeenCalled();
  });

  it('a managed record: judged against the deadline stored now; an action that lands on the same civil day does not write the column', async () => {
    const { service, tx } = fixture(true);
    // The flow keeps 28/02/2026 17:00 in Vietnam; the action computes 28/02/2026 23:59:59.999 there: the same day.
    tx.case.findUnique.mockResolvedValue({ deadline: new Date('2026-02-28T10:00:00.000Z') });
    await service.execute('case', 'req', dto, { actorId: 'executor' });
    expect(tx.case.update).toHaveBeenCalledTimes(1);
    const data = (tx.case.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).not.toHaveProperty('deadline');
    expect(data.investigationPhase).toBe('REINVESTIGATION');
  });

  it('a record that is not managed: the action moves the deadline as before', async () => {
    const { service, tx } = fixture(false);
    await service.execute('case', 'req', dto, { actorId: 'executor' });
    expect(tx.case.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deadline: new Date('2026-02-28T16:59:59.999Z') }) }),
    );
  });

  it('no writer injected: the action moves the deadline as before', async () => {
    const { service, tx } = fixture('none');
    await service.execute('case', 'req', dto, { actorId: 'executor' });
    expect(tx.case.update).toHaveBeenCalledTimes(1);
  });
});
