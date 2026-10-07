import { LegalWorkflowService } from './legal-workflow.service';
import { configurationHash } from './case-configuration.service';
const payload = {
  decision: {
    type: 'CONCLUSION',
    number: '1',
    date: '2026-10-01',
    effectiveDate: '2026-10-02',
    issuer: 'Authority',
    signatory: 'Signer',
    legalBasis: 'Provision',
    sourceDocumentId: 'doc',
  },
  sourceSnapshot: {
    documentId: 'doc',
    caseId: 'case',
    documentUpdatedAt: '2026-10-01T00:00:00.000Z',
    sha256: 'a'.repeat(64),
    byteLength: 1,
    assetVersionId: null,
    parentVersionId: null,
    parentSha256: null,
  },
};
const hash = configurationHash({
  actionCode: 'CONCLUDE_INITIAL',
  ruleVersionId: 'rule',
  payload,
});
describe('CG07 exact approval and CG10 atomic execution boundary', () => {
  const request = {
    id: 'req',
    caseId: 'case',
    authorId: 'author',
    actionCode: 'CONCLUDE_INITIAL',
    ruleVersionId: 'rule',
    revision: 2,
    status: 'SUBMITTED',
    contentHash: hash,
    payload,
    updatedAt: new Date('2026-10-01'),
  };
  const dto = {
    requestKey: 'key',
    expectedUpdatedAt: '2026-10-01',
    expectedRevision: 2,
    expectedAggregateUpdatedAt: '2026-10-01',
    approve: true,
    note: 'Reviewed',
  };
  function make(row: Record<string, unknown>) {
    const tx = {
      caseActionRequest: {
        create: jest.fn().mockResolvedValue(row),
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(row),
      },
      caseGovernanceTask: { updateMany: jest.fn() },
      caseRuleVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rule',
          status: 'PUBLISHED',
          sourceVerified: true,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          definition: {
            actions: [
              {
                code: 'CONCLUDE_INITIAL',
                legalSources: [
                  {
                    instrument: 'Synthetic',
                    provision: '1',
                    authority: 'Authority',
                    url: 'https://example.test',
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
        f(tx, {
          caseRecord: {
            id: 'case',
            status: 'DANG_DIEU_TRA',
            investigationPhase: 'INITIAL',
            deadline: null,
          },
          operationId: 'op',
        }),
      ),
      hasCapability: jest.fn().mockResolvedValue(true),
      recordEvent: jest.fn(),
      assertCaseWritable: jest.fn().mockResolvedValue({ id: 'case' }),
      enqueue: jest.fn(),
    };
    const evidence = {
      decisionSourceSnapshot: jest
        .fn()
        .mockResolvedValue(payload.sourceSnapshot),
    };
    return {
      svc: new LegalWorkflowService(
        {} as never,
        core as never,
        undefined,
        evidence as never,
      ),
      evidence,
      core,
      tx,
    };
  }
  it('governed execution cannot change a protected native status without current sensitive authority', async () => {
    const row = {
      ...request,
      status: 'APPROVED',
      reviewedById: 'reviewer',
      approvedHash: hash,
      approvedRevision: 2,
    };
    const { svc, tx, core } = make(row);
    Object.assign(await tx.caseRuleVersion.findUnique(), {
      revision: 1,
      contentHash: 'rulehash',
      approvedHash: 'rulehash',
      approvedRevision: 1,
      reviewedById: 'rule-reviewer',
      authorId: 'rule-author',
    });
    const record = {
      id: 'case',
      status: 'DANG_DIEU_TRA',
      investigationPhase: 'INITIAL',
      deadline: null,
      fieldDefinitionVersionId: 'private',
    };
    (tx as any).caseFieldDefinitionVersion = {
      findUnique: jest.fn().mockResolvedValue({
        status: 'PUBLISHED',
        definition: {
          fields: [],
          fieldPolicies: [{ key: 'status', sensitivity: 'RESTRICTED' }],
        },
      }),
    };
    (core as any).hasSensitiveAccess = jest.fn().mockResolvedValue(false);
    core.mutateCase.mockImplementation((_i, _a, f) =>
      f(tx, { caseRecord: record, operationId: 'op' } as any),
    );
    await expect(
      svc.execute('case', 'req', dto, { actorId: 'operator' }),
    ).rejects.toThrow('Protected native field write');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
    expect(tx.case.update).not.toHaveBeenCalled();
  });
  it('review stores exact hash/revision and separate reviewer', async () => {
    const { svc, tx } = make(request);
    await expect(
      svc.review('case', 'req', dto, { actorId: 'reviewer' }),
    ).resolves.toMatchObject({ success: true });
    expect(tx.caseActionRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedHash: hash,
          approvedRevision: 2,
          reviewedById: 'reviewer',
        }),
      }),
    );
  });
  it('rejects author self-review even with all explicit capabilities', async () => {
    const { svc, tx } = make(request);
    await expect(
      svc.review('case', 'req', dto, { actorId: 'author' }),
    ).rejects.toThrow();
    expect(tx.caseActionRequest.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    { approvedHash: 'different', approvedRevision: 2 },
    { approvedHash: hash, approvedRevision: 1 },
  ])(
    'never executes approval for altered content/revision',
    async (approval) => {
      const { svc, tx } = make({
        ...request,
        status: 'APPROVED',
        reviewedById: 'reviewer',
        ...approval,
      });
      await expect(
        svc.execute('case', 'req', dto, { actorId: 'operator' }),
      ).rejects.toThrow();
      expect(tx.caseDecision.create).not.toHaveBeenCalled();
    },
  );
  it('commits approved legal transition, exact decision/history and internal outbox through parent transaction', async () => {
    const { svc, tx, core } = make({
      ...request,
      status: 'APPROVED',
      reviewedById: 'reviewer',
      approvedHash: hash,
      approvedRevision: 2,
    });
    const rule = await tx.caseRuleVersion.findUnique();
    Object.assign(rule, {
      revision: 1,
      contentHash: 'rulehash',
      approvedHash: 'rulehash',
      approvedRevision: 1,
      reviewedById: 'rule-reviewer',
      authorId: 'rule-author',
    });
    (core as any).assertCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case' });
    tx.caseDecision.create.mockResolvedValue({ id: 'decision' });
    await expect(
      svc.execute('case', 'req', dto, { actorId: 'operator' }),
    ).resolves.toMatchObject({
      success: true,
      data: { decision: { id: 'decision' } },
    });
    expect(tx.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DA_KET_LUAN',
          investigationPhase: null,
          governanceRuleVersionId: 'rule',
        }),
      }),
    );
    expect(tx.caseStatusHistory.create).toHaveBeenCalledWith({
      data: {
        caseId: 'case',
        fromStatus: 'DANG_DIEU_TRA',
        toStatus: 'DA_KET_LUAN',
        changedById: 'operator',
        changedAt: new Date('2026-10-02'),
      },
    });
    expect(core.recordEvent).toHaveBeenCalledWith(
      tx,
      'case',
      'op',
      'operator',
      'ACTION_EXECUTED',
      expect.objectContaining({ decisionId: 'decision', fromPhase: 'INITIAL' }),
    );
    expect(core.enqueue).toHaveBeenCalled();
    expect(tx.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc', deletedAt: null },
    });
  });
  it('execution rejects when published provision is out of effect and creates no decision', async () => {
    const { svc, tx, core } = make({
      ...request,
      status: 'APPROVED',
      reviewedById: 'reviewer',
      approvedHash: hash,
      approvedRevision: 2,
    });
    const rule = await tx.caseRuleVersion.findUnique();
    Object.assign(rule, {
      revision: 1,
      contentHash: 'rulehash',
      approvedHash: 'rulehash',
      approvedRevision: 1,
      reviewedById: 'rule-reviewer',
      authorId: 'rule-author',
      effectiveTo: new Date('2026-10-02'),
    });
    (core as any).assertCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case' });
    await expect(
      svc.execute('case', 'req', dto, { actorId: 'operator' }),
    ).rejects.toThrow('outside legal effective interval');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
  });
  it('explicit source linking cannot widen Incident/Petition RBAC even for ADMIN scope null', async () => {
    const tx = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'admin',
          isActive: true,
          role: { name: 'ADMIN', permissions: [] },
        }),
      },
    };
    const core = { currentScope: jest.fn().mockResolvedValue(null) };
    const svc = new LegalWorkflowService({} as never, core as never);
    await expect(
      (svc as any).assertSourceScope(
        tx,
        { createdById: 'admin' },
        { actorId: 'admin' },
        'Incident',
      ),
    ).rejects.toThrow();
  });
  it('execution rechecks reviewer write scope after approval', async () => {
    const { svc, tx, core } = make({
      ...request,
      status: 'APPROVED',
      reviewedById: 'reviewer',
      approvedHash: hash,
      approvedRevision: 2,
    });
    const rule = await tx.caseRuleVersion.findUnique();
    Object.assign(rule, {
      revision: 1,
      contentHash: 'r',
      approvedHash: 'r',
      approvedRevision: 1,
      reviewedById: 'rule-reviewer',
      authorId: 'rule-author',
    });
    (core as any).assertCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case' });
    core.assertCaseWritable.mockRejectedValue(
      new Error('Reviewer write scope revoked'),
    );
    await expect(
      svc.execute('case', 'req', dto, { actorId: 'operator' }),
    ).rejects.toThrow('Reviewer write scope revoked');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
  });
  it('rejects client-supplied source snapshot authority before drafting', async () => {
    const { svc } = make(request);
    await expect(
      svc.create(
        'case',
        {
          requestKey: 'draft',
          expectedUpdatedAt: '2026-10-01',
          actionCode: 'CONCLUDE_INITIAL',
          ruleVersionId: 'rule',
          payload,
        },
        { actorId: 'author' },
      ),
    ).rejects.toThrow('Server-owned');
  });
  it('detects one-byte/source-version change against exact approved immutable snapshot', async () => {
    const { svc, tx, core, evidence } = make({
      ...request,
      status: 'APPROVED',
      reviewedById: 'reviewer',
      approvedHash: hash,
      approvedRevision: 2,
    });
    const rule = await tx.caseRuleVersion.findUnique();
    Object.assign(rule, {
      revision: 1,
      contentHash: 'rulehash',
      approvedHash: 'rulehash',
      approvedRevision: 1,
      reviewedById: 'rule-reviewer',
      authorId: 'rule-author',
    });
    (core as any).assertCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case' });
    evidence.decisionSourceSnapshot.mockResolvedValue({
      ...payload.sourceSnapshot,
      sha256: 'b'.repeat(64),
    });
    await expect(
      svc.execute('case', 'req', dto, { actorId: 'operator' }),
    ).rejects.toThrow('source snapshot');
    expect(tx.caseDecision.create).not.toHaveBeenCalled();
  });
  it('prepares concrete allocation version/hash before a split request can be approved', async () => {
    const { svc, tx, core } = make({ ...request, actionCode: 'SPLIT_CASE' });
    (core as any).assertCaseReadable = jest
      .fn()
      .mockResolvedValue({ id: 'case' });
    (tx as any).subject = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'subject',
        caseId: 'case',
        updatedAt: new Date('2026-10-01'),
        fullName: 'Synthetic',
        type: 'SUSPECT',
      }),
    };
    const p = {
      decision: payload.decision,
      newCase: {
        name: 'New',
        assignedTeamId: 'team',
        allocationBasis: 'Reviewed allocation',
      },
      allocation: {
        subjects: [{ id: 'subject', expectedUpdatedAt: '2026-10-01' }],
      },
    };
    await svc.create(
      'case',
      {
        requestKey: 'split-draft',
        expectedUpdatedAt: '2026-10-01',
        actionCode: 'SPLIT_CASE',
        ruleVersionId: 'rule',
        payload: p,
      },
      { actorId: 'author' },
    );
    expect(tx.caseActionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            allocationSnapshot: expect.objectContaining({
              subjects: [
                expect.objectContaining({
                  id: 'subject',
                  contentHash: expect.any(String),
                }),
              ],
            }),
          }),
        }),
      }),
    );
  });
});
