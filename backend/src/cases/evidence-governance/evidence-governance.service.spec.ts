import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CaseGovernanceService } from '../governance/case-governance.service';
import type { ActorContext } from '../governance/case-governance.contract';
import type { CustodyFacts } from './custody-facts';
const physicalHolder = {
  kind: 'WAREHOUSE' as const,
  identifier: 'warehouse-real-A',
  name: 'Actual synthetic custodian warehouse A',
};
const custodyFacts: CustodyFacts = {
  fromHolder: physicalHolder,
  toHolder: physicalHolder,
  fromLocation: 'Locker A',
  toLocation: 'Locker A',
  condition: 'SEALED',
  conditionNote: 'Correct verified seal note',
  receiptDocumentId: 'receipt1',
  receiptReference: 'receipt-ref-001',
  correctionReason: 'Append correction preserves original',
};
type ReadMock = jest.Mock<Promise<unknown>, unknown[]>;
type WriteArgs = { data: Record<string, unknown>; where: { id: string } };
type DelegateMock = {
  findFirst: ReadMock;
  findUnique: ReadMock;
  findMany: jest.Mock<Promise<unknown[]>, unknown[]>;
  count: jest.Mock<Promise<number>, unknown[]>;
  create: jest.Mock<Promise<unknown>, [WriteArgs]>;
  update: jest.Mock<Promise<unknown>, [WriteArgs]>;
  updateMany: ReadMock;
};
const models = [
  'document',
  'caseAssetVersion',
  'caseCustodyEvent',
  'caseDisclosurePacket',
  'caseDisclosurePacketItem',
  'caseEvidenceHold',
  'caseRepresentationGrant',
  'caseRetentionPolicy',
  'caseDispositionRequest',
  'lawyer',
  'subject',
  'user',
  'evidence',
  'caseRelation',
] as const;
type MockTx = Record<(typeof models)[number], DelegateMock> & {
  $transaction: jest.Mock<Promise<unknown>, unknown[]>;
  $queryRaw: jest.Mock<Promise<unknown[]>, unknown[]>;
  caseGovernanceEvent: { create: ReadMock };
  auditLog: { create: ReadMock };
};
const actor = { actorId: 'maker' };
const body = {
  requestKey: 'r1',
  expectedUpdatedAt: '2026-10-06T00:00:00.000Z',
  expectedRevision: 1,
};
function fixture() {
  const tx = {} as MockTx;
  tx.$queryRaw = jest.fn<Promise<unknown[]>, unknown[]>().mockResolvedValue([]);
  for (const key of models) {
    tx[key] = {
      findFirst: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(null),
      findUnique: jest
        .fn<Promise<unknown>, unknown[]>()
        .mockResolvedValue(null),
      findMany: jest.fn<Promise<unknown[]>, unknown[]>().mockResolvedValue([]),
      count: jest.fn<Promise<number>, unknown[]>().mockResolvedValue(0),
      create: jest.fn((args: WriteArgs) =>
        Promise.resolve({ id: 'new', ...args.data }),
      ),
      update: jest.fn((args: WriteArgs) =>
        Promise.resolve({ id: args.where.id, ...args.data }),
      ),
      updateMany: jest
        .fn<Promise<unknown>, unknown[]>()
        .mockResolvedValue({ count: 1 }),
    };
  }
  tx.$transaction = jest.fn(
    (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(tx as unknown as Prisma.TransactionClient),
  );
  tx.caseGovernanceEvent = {
    create: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(undefined),
  };
  tx.auditLog = {
    create: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue(undefined),
  };
  tx.user.findUnique.mockResolvedValue({
    isActive: true,
    caseAccessMode: 'INTERNAL',
    caseAccessRevision: 0,
  });
  const core = {
    hasEntityPermission: jest.fn().mockResolvedValue(true),
    currentActorScope: jest.fn().mockResolvedValue({
      teamIds: ['visible'],
      userIds: [],
      writableTeamIds: ['visible'],
      writableUserIds: [],
    }),
    assertBaseCaseReadable: jest.fn(),
    assertCaseAccessCapability: jest.fn(),
    assertClassificationInspectable: jest.fn(),
    readableCaseWhere: jest
      .fn()
      .mockResolvedValue({ assignedTeamId: 'visible' }),
    assertCaseReadable: jest.fn().mockResolvedValue({ id: 'case-1' }),
    assertCaseWritable: jest.fn().mockResolvedValue({ id: 'case-1' }),
    ensureEnabled: jest.fn(),
    hasCapability: jest.fn().mockResolvedValue(true),
    enqueue: jest.fn(),
    mutateCase: jest.fn(
      (
        _input: unknown,
        who: ActorContext,
        fn: (
          client: Prisma.TransactionClient,
          context: {
            caseRecord: { id: string };
            actor: ActorContext;
            operationId: string;
          },
        ) => Promise<unknown>,
      ) =>
        fn(tx as unknown as Prisma.TransactionClient, {
          caseRecord: { id: 'case-1' },
          actor: who,
          operationId: 'op1',
        }),
    ),
  };
  return {
    tx,
    core,
    service: new CaseEvidenceGovernanceService(
      tx as unknown as PrismaService,
      core as unknown as CaseGovernanceService,
      {
        byteFieldPolicySnapshot: jest.fn().mockResolvedValue({
          definitionVersionId: null,
          definitionHash: 'unrestricted-test-policy',
          hasDeniedProtectedFields: false,
        }),
      } as never,
    ),
  };
}
describe('CG11–13 evidence governed lifecycle', () => {
  it.each([null, [], ['asset1'], { assetVersionId: 42 }, 42])(
    'R4 packet malformed item %j is 400 before current-policy queries or writes',
    async (item) => {
      const { service, core, tx } = fixture();
      await expect(
        service.createPacket(
          'case-1',
          { ...body, items: [item] } as never,
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(core.mutateCase).not.toHaveBeenCalled();
      expect(tx.caseAssetVersion.findFirst).not.toHaveBeenCalled();
    },
  );
  it.each(['download', {}, null, [null], [42]])(
    'R4 malformed capabilities %j are rejected before ledger mutation',
    async (capabilities) => {
      const { service, core } = fixture();
      await expect(
        service.addRepresentation(
          'case-1',
          { ...body, lawyerId: 'lawyer', capabilities } as never,
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(core.mutateCase).not.toHaveBeenCalled();
    },
  );
  it.each(['asset1', {}, null, [null], [42]])(
    'R4 malformed disposition assets %j are rejected before ledger mutation',
    async (assetVersionIds) => {
      const { service, core } = fixture();
      await expect(
        service.createDisposition(
          'case-1',
          { ...body, policyId: 'policy', assetVersionIds } as never,
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(core.mutateCase).not.toHaveBeenCalled();
    },
  );
  it.each([
    'not-a-time',
    '2026-02-30T00:00:00.000Z',
    '2026-10-06',
    '2026-13-40T90:90:90Z',
  ])('rejects invalid preservation timestamp %s', async (preserveUntil) => {
    const { service, tx } = fixture();
    await expect(
      service.createRetention(
        'case-1',
        { ...body, preserveUntil, basis: 'synthetic valid reason' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.caseRetentionPolicy.create).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'x'.repeat(4001)])(
    'rejects missing/oversized retention basis',
    async (basis) => {
      const { service, tx } = fixture();
      await expect(
        service.createRetention(
          'case-1',
          { ...body, preserveUntil: '2026-10-06T00:00:00.000Z', basis },
          actor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(tx.caseRetentionPolicy.create).not.toHaveBeenCalled();
    },
  );
  it('denies a disabled actor and explicit capability removal before asset metadata/ledger writes', async () => {
    const { service, tx, core } = fixture();
    tx.user.findUnique.mockResolvedValue(null);
    await expect(
      service.authorizeDocumentDownload(
        tx as unknown as Prisma.TransactionClient,
        'case-1',
        'doc',
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    core.hasCapability.mockResolvedValue(false);
    await expect(
      service.createRetention(
        'case-1',
        {
          ...body,
          preserveUntil: '2026-10-06T00:00:00.000Z',
          basis: 'synthetic',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.caseRetentionPolicy.create).not.toHaveBeenCalled();
  });
  it('fails closed for missing or already registered original Documents', async () => {
    const { service, tx } = fixture();
    await expect(
      service.registerAsset(
        'case-1',
        { ...body, documentId: 'missing' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    tx.document.findFirst.mockResolvedValue({ id: 'doc', caseId: 'case-1' });
    tx.caseAssetVersion.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.registerAsset('case-1', { ...body, documentId: 'doc' }, actor),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseAssetVersion.create).not.toHaveBeenCalled();
  });
  it('unknown transitions and missing aggregates cannot create retention/disposition history', async () => {
    const { service, tx } = fixture();
    await expect(
      service.retentionTransition('case-1', 'missing', 'invalid', body, actor),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.retentionTransition('case-1', 'missing', 'review', body, actor),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.dispositionTransition(
        'case-1',
        'missing',
        'invalid',
        body,
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.dispositionTransition('case-1', 'missing', 'review', body, actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.caseDispositionRequest.update).not.toHaveBeenCalled();
  });
  it.each([
    ['PUBLISHED', 'review', 'reviewer', 409],
    ['DRAFT', 'revise', 'outsider', 403],
    ['REJECTED', 'review', 'reviewer', 409],
    ['DRAFT', 'review', 'reviewer', 409],
    ['DRAFT', 'publish', 'reviewer', 409],
  ])(
    'retention state %s rejects unauthorized %s by %s',
    async (status, transition, actorId, statusCode) => {
      const { service, tx } = fixture();
      tx.caseRetentionPolicy.findFirst.mockResolvedValue({
        id: 'policy',
        revision: 1,
        status,
        authorId: 'maker',
        contentHash: 'hash',
        approvedHash: null,
        approvedRevision: null,
      });
      await expect(
        service.retentionTransition('case-1', 'policy', transition, body, {
          actorId,
        }),
      ).rejects.toMatchObject({ status: statusCode });
      expect(tx.caseRetentionPolicy.update).not.toHaveBeenCalled();
    },
  );
  it('exact aggregate timestamp mismatch rejects a retained policy without rewriting it', async () => {
    const { service, tx } = fixture();
    tx.caseRetentionPolicy.findFirst.mockResolvedValue({
      id: 'policy',
      revision: 1,
      status: 'DRAFT',
      authorId: 'maker',
      updatedAt: new Date('2026-10-06'),
    });
    await expect(
      service.retentionTransition(
        'case-1',
        'policy',
        'review',
        {
          ...body,
          approve: true,
          expectedAggregateUpdatedAt: '2026-10-05T00:00:00.000Z',
        },
        { actorId: 'reviewer' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseRetentionPolicy.update).not.toHaveBeenCalled();
  });
  it('released holds and revoked/missing grants cannot be rewritten or revoked twice', async () => {
    const { service, tx } = fixture();
    await expect(
      service.releaseHold(
        'case-1',
        'missing',
        { ...body, reason: 'synthetic reason' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    tx.caseEvidenceHold.findFirst.mockResolvedValue({
      id: 'held',
      createdAt: new Date('2026-10-06'),
      releasedAt: new Date('2026-10-06'),
    });
    await expect(
      service.releaseHold(
        'case-1',
        'held',
        {
          ...body,
          expectedAggregateUpdatedAt: '2026-10-06T00:00:00.000Z',
          reason: 'synthetic reason',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.revokeRepresentation('case-1', 'missing', body, actor),
    ).rejects.toMatchObject({ status: 404 });
    tx.caseRepresentationGrant.findFirst.mockResolvedValue({
      id: 'grant',
      revision: 1,
      revokedAt: new Date(),
    });
    await expect(
      service.revokeRepresentation('case-1', 'grant', body, actor),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseEvidenceHold.update).not.toHaveBeenCalled();
    expect(tx.caseRepresentationGrant.update).not.toHaveBeenCalled();
  });
  it('summary rejects an authorized relation changing during original metadata hydration', async () => {
    const { service, tx } = fixture();
    const link = {
      id: 'rel',
      sourceCaseId: 'case-1',
      targetCaseId: 'owner',
      type: 'RELATED',
      revision: 1,
      revokedAt: null,
      deletedAt: null,
    };
    tx.caseRelation.findMany.mockResolvedValue([link]);
    tx.caseRelation.findFirst
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({ ...link, revision: 2 });
    await expect(service.getSummary('case-1', actor)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each([
    ['neither target', {}, 400],
    ['both targets', { evidenceId: 'physical', assetVersionId: 'asset' }, 400],
    ['unknown physical target', { evidenceId: 'missing' }, 404],
  ])('custody rejects %s before append', async (_label, extra, status) => {
    const { service, tx } = fixture();
    await expect(
      service.appendCustody(
        'case-1',
        {
          ...body,
          eventType: 'RECEIPT',
          occurredAt: '2026-10-06T00:00:00.000Z',
          expectedCustodyEventId: null,
          ...extra,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status });
    expect(tx.caseCustodyEvent.create).not.toHaveBeenCalled();
  });
  it.each([
    ['future physical event', { occurredAt: '2099-01-01T00:00:00.000Z' }, 400],
    ['missing explicit chain head', { expectedCustodyEventId: undefined }, 409],
    ['missing correction target', { eventType: 'CORRECTION' }, 400],
    ['duplicate facts sources', { payload: {}, custodyFacts }, 400],
  ])(
    'custody rejects %s with no ledger mutation',
    async (_label, extra, status) => {
      const { service, tx } = fixture();
      tx.evidence.findFirst.mockResolvedValue({
        id: 'physical',
        caseId: 'case-1',
      });
      await expect(
        service.appendCustody(
          'case-1',
          {
            ...body,
            evidenceId: 'physical',
            eventType: 'RECEIPT',
            occurredAt: '2026-10-06T00:00:00.000Z',
            expectedCustodyEventId: null,
            ...extra,
          },
          actor,
        ),
      ).rejects.toMatchObject({ status });
      expect(tx.caseCustodyEvent.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['unknown subject', { subjectId: 'hidden-subject' }, 404],
    ['expired grant', { expiresAt: '2020-01-01T00:00:00.000Z' }, 400],
    ['duplicate caps', { capabilities: ['download', 'download'] }, 400],
    ['unapproved cap', { capabilities: ['auto_approve'] }, 400],
    ['missing active grantee', {}, 404],
  ])(
    'representation denies %s before creating a grant',
    async (_label, extra, status) => {
      const { service, tx } = fixture();
      tx.lawyer.findFirst.mockResolvedValue({
        id: 'lawyer',
        caseId: 'case-1',
        subjectId: 'subjectId' in extra ? extra.subjectId : null,
      });
      await expect(
        service.addRepresentation(
          'case-1',
          {
            ...body,
            lawyerId: 'lawyer',
            granteeId: 'recipient',
            startsAt: '2020-01-01T00:00:00.000Z',
            expiresAt: '2099-01-01T00:00:00.000Z',
            capabilities: ['download'],
            ...extra,
          },
          actor,
        ),
      ).rejects.toMatchObject({ status });
      expect(tx.caseRepresentationGrant.create).not.toHaveBeenCalled();
    },
  );
  it('targeted hold accepts only an immutable asset owned by the same Case', async () => {
    const { service, tx } = fixture();
    await expect(
      service.addHold(
        'case-1',
        {
          ...body,
          assetVersionId: 'missing',
          reason: 'synthetic hold',
          basis: 'preservation basis',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    tx.caseAssetVersion.findFirst.mockResolvedValue({
      id: 'asset',
      caseId: 'case-1',
    });
    const held = await service.addHold(
      'case-1',
      {
        ...body,
        assetVersionId: 'asset',
        reason: 'synthetic hold',
        basis: 'preservation basis',
      },
      actor,
    );
    expect(held).toMatchObject({
      data: { assetVersionId: 'asset', caseId: 'case-1' },
    });
    expect(tx.caseAssetVersion.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'asset', caseId: 'case-1' },
    });
  });
  it('REP_ONLY cannot obtain orphan document bytes without an exact owning Case', async () => {
    const { service, tx } = fixture();
    tx.user.findUnique.mockResolvedValue({
      isActive: true,
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 1,
    });
    await expect(
      service.authorizeDocumentDownload(
        tx as unknown as Prisma.TransactionClient,
        null,
        'orphan',
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('summary omits packet source item metadata when its owner is hidden', async () => {
    const { service, tx, core } = fixture();
    tx.caseDisclosurePacket.findMany.mockResolvedValue([
      { id: 'packet', caseId: 'case-1' },
    ]);
    tx.caseDisclosurePacketItem.findMany.mockResolvedValue([
      {
        id: 'item',
        assetVersionId: 'hidden-asset',
        sha256: 'never-deliver-hidden-hash',
        relationId: 'rel',
        relationRevision: 1,
      },
    ]);
    tx.caseAssetVersion.findFirst.mockResolvedValue({
      id: 'hidden-asset',
      caseId: 'hidden-owner',
    });
    core.assertCaseReadable.mockImplementation((_tx: unknown, id: string) =>
      id === 'hidden-owner'
        ? Promise.reject(new ForbiddenException('hidden'))
        : Promise.resolve({ id }),
    );
    const result = await service.getSummary('case-1', actor);
    expect(result.data.packets).toEqual([
      expect.objectContaining({ items: [], contentsHidden: true }),
    ]);
    expect(JSON.stringify(result)).not.toContain('never-deliver-hidden-hash');
  });
  it('cannot claim physical transfer with only an app actor and empty payload', async () => {
    const { service, tx } = fixture();
    tx.evidence.findFirst.mockResolvedValue({
      id: 'physical1',
      caseId: 'case-1',
    });
    await expect(
      service.appendCustody(
        'case-1',
        {
          ...body,
          evidenceId: 'physical1',
          eventType: 'TRANSFER',
          occurredAt: '2026-10-06T00:00:00.000Z',
          payload: {},
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.caseCustodyEvent.create).not.toHaveBeenCalled();
  });
  it('REP_ONLY cannot download an unregistered original through the ordinary legacy document route', async () => {
    const { service, tx } = fixture();
    tx.user.findUnique.mockResolvedValue({
      isActive: true,
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 1,
    });
    await expect(
      service.authorizeDocumentDownload(
        tx as unknown as Prisma.TransactionClient,
        'case-1',
        'unregistered',
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('INTERNAL retains separately scoped legacy download rights despite representation records elsewhere', async () => {
    const { service, tx, core } = fixture();
    core.hasCapability.mockResolvedValue(false);
    tx.caseRepresentationGrant.findMany.mockResolvedValue([
      { caseId: 'other', revokedAt: new Date() },
    ]);
    expect(
      await service.authorizeDocumentDownload(
        tx as unknown as Prisma.TransactionClient,
        'case-1',
        'legacy',
        actor,
      ),
    ).toEqual({ mode: 'INTERNAL', revision: 0 });
  });
  it('basic evidence history read derives active scoped Case.read without an extra Gov.read grant', async () => {
    const { service, core } = fixture();
    core.hasCapability.mockResolvedValue(false);
    const result = await service.getSummary('case-1', actor);
    expect(result.success).toBe(true);
    expect(core.assertCaseReadable).toHaveBeenCalledTimes(2);
  });
  it('hydrates only this authorized Case ledgers and rechecks list scope', async () => {
    const { service, tx, core } = fixture();
    const result = await service.getSummary('case-1', actor);
    expect(result.data).toEqual({
      assets: [],
      custody: [],
      packets: [],
      holds: [],
      representationGrants: [],
      retentionPolicies: [],
      dispositions: [],
    });
    expect(core.assertCaseReadable).toHaveBeenCalledTimes(2);
    expect(tx.caseCustodyEvent.findMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1' },
      orderBy: { createdAt: 'asc' },
    });
  });
  it('uses the same registered asset visibility predicate for list and count', async () => {
    const { service, core } = fixture();
    const filter = await service.documentVisibilityWhere(actor);
    expect(filter).toMatchObject({
      OR: [
        {
          AND: [
            { caseAssetVersion_document: { none: {} } },
            { case: { AND: [{ assignedTeamId: 'visible' }, {}] } },
          ],
        },
        {
          AND: [
            { caseAssetVersion_document: { none: {} } },
            { OR: [{ caseId: null }, { caseId: { in: [] } }] },
            { OR: expect.any(Array) as unknown },
          ],
        },
        {
          case: { AND: [{ assignedTeamId: 'visible' }, expect.any(Object)] },
          caseAssetVersion_document: { some: { retiredAt: null } },
        },
      ],
    });
    core.hasCapability.mockResolvedValue(false);
    expect(await service.documentVisibilityWhere(actor)).toMatchObject({
      OR: [
        {
          AND: [
            { caseAssetVersion_document: { none: {} } },
            { case: { AND: [{ assignedTeamId: 'visible' }, {}] } },
          ],
        },
        {
          AND: [
            { caseAssetVersion_document: { none: {} } },
            { OR: [{ caseId: null }, { caseId: { in: [] } }] },
            { OR: expect.any(Array) as unknown },
          ],
        },
        { case: { AND: [{ assignedTeamId: 'visible' }, expect.any(Object)] } },
      ],
    });
    expect(await service.documentVisibilityWhere()).toEqual({
      caseAssetVersion_document: { none: {} },
    });
  });
  it('INTERNAL document lists never infer recipient-only restrictions from historical representation records', async () => {
    const { service, tx } = fixture();
    tx.caseRepresentationGrant.findMany.mockResolvedValue([
      { revokedAt: new Date() },
    ]);
    const filter = await service.documentVisibilityWhere(actor);
    expect(JSON.stringify(filter)).not.toContain(
      'caseRepresentationGrant_case',
    );
    expect(filter).toMatchObject({
      OR: [
        expect.any(Object),
        expect.any(Object),
        { case: { AND: [{ assignedTeamId: 'visible' }, {}] } },
      ],
    });
  });
  it('includes a directly related authorized original without reparenting it', async () => {
    const { service, tx } = fixture();
    const link = {
      id: 'relation1',
      sourceCaseId: 'case-1',
      targetCaseId: 'owner-1',
      type: 'RELATED',
      revision: 2,
      revokedAt: null,
      deletedAt: null,
    };
    tx.caseRelation.findMany.mockResolvedValue([link]);
    tx.caseRelation.findFirst.mockResolvedValue(link);
    tx.caseAssetVersion.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'asset-related',
          caseId: 'owner-1',
          documentId: 'original',
          sha256: 'abc',
        },
      ]);
    const result = await service.getSummary('case-1', actor);
    expect(result.data.assets).toEqual([
      expect.objectContaining({
        id: 'asset-related',
        caseId: 'owner-1',
        ownerCaseId: 'owner-1',
        relationId: 'relation1',
        relationRevision: 2,
      }),
    ]);
    expect(tx.caseAssetVersion.update).not.toHaveBeenCalled();
  });
  it('omits hidden related owners before querying their original metadata', async () => {
    const { service, tx, core } = fixture();
    tx.caseRelation.findMany.mockResolvedValue([
      {
        id: 'hidden-link',
        sourceCaseId: 'case-1',
        targetCaseId: 'hidden-owner',
        type: 'RELATED',
        revision: 1,
        revokedAt: null,
        deletedAt: null,
      },
    ]);
    core.assertCaseReadable.mockImplementation((_tx: unknown, id: string) =>
      id === 'hidden-owner'
        ? Promise.reject(new ForbiddenException('hidden'))
        : Promise.resolve({ id }),
    );
    expect((await service.getSummary('case-1', actor)).data.assets).toEqual([]);
    expect(tx.caseAssetVersion.findMany).toHaveBeenCalledTimes(1);
  });
  it('exposes packet exact item metadata to an authorized reviewer', async () => {
    const { service, tx } = fixture();
    tx.caseDisclosurePacket.findMany.mockResolvedValue([
      { id: 'packet1', caseId: 'case-1' },
    ]);
    tx.caseDisclosurePacketItem.findMany.mockResolvedValue([
      {
        id: 'item1',
        packetId: 'packet1',
        assetVersionId: 'asset1',
        sha256: 'exact-hash',
        relationId: null,
        relationRevision: null,
      },
    ]);
    tx.caseAssetVersion.findFirst.mockResolvedValue({
      id: 'asset1',
      caseId: 'case-1',
    });
    const result = await service.getSummary('case-1', actor);
    expect(result.data.packets).toEqual([
      expect.objectContaining({
        id: 'packet1',
        items: [
          expect.objectContaining({
            assetVersionId: 'asset1',
            sha256: 'exact-hash',
          }),
        ],
        contentsHidden: false,
      }),
    ]);
  });
  it('creates a preservation hold and releases by exact creation version without erasing history', async () => {
    const { service, tx } = fixture();
    const held = await service.addHold(
      'case-1',
      { ...body, reason: 'retain originals', basis: 'synthetic authority' },
      actor,
    );
    expect(held.data.reason).toBe('retain originals');
    tx.caseEvidenceHold.findFirst.mockResolvedValue({
      id: 'hold1',
      caseId: 'case-1',
      createdAt: new Date('2026-10-06'),
      releasedAt: null,
    });
    const released = await service.releaseHold(
      'case-1',
      'hold1',
      {
        ...body,
        expectedAggregateUpdatedAt: '2026-10-06T00:00:00.000Z',
        reason: 'authorized release',
      },
      actor,
    );
    expect(released.data.releasedById).toBe('maker');
    expect(released.data.releasedAt).toBeInstanceOf(Date);
  });
  it('rejects hold release lacking exact creation version', async () => {
    const { service, tx } = fixture();
    tx.caseEvidenceHold.findFirst.mockResolvedValue({
      id: 'hold1',
      createdAt: new Date('2026-10-06'),
      releasedAt: null,
    });
    await expect(
      service.releaseHold(
        'case-1',
        'hold1',
        { ...body, reason: 'release' },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('creates bounded case-specific representation and appends revocation', async () => {
    const { service, tx } = fixture();
    tx.lawyer.findFirst.mockResolvedValue({
      id: 'lawyer1',
      caseId: 'case-1',
      subjectId: null,
    });
    tx.user.findFirst.mockResolvedValue({
      id: 'recipient',
      enrollmentTokenHash: 'technical-issued-enrollment',
      mustChangePassword: true,
    });
    const granted = await service.addRepresentation(
      'case-1',
      {
        ...body,
        lawyerId: 'lawyer1',
        granteeId: 'recipient',
        capabilities: ['view', 'download'],
        startsAt: '2026-10-06T00:00:00.000Z',
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
      actor,
    );
    expect(granted.data.granteeId).toBe('recipient');
    expect(granted.data.capabilities).toEqual(['view', 'download']);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recipient' },
        data: expect.objectContaining({
          enrollmentTokenHash: null,
          enrollmentExpiresAt: null,
          refreshTokenHash: null,
          tokenVersion: { increment: 1 },
          mustChangePassword: true,
          passwordHash: expect.any(String),
        }),
      }),
    );
    tx.caseRepresentationGrant.findFirst.mockResolvedValue({
      id: 'grant1',
      caseId: 'case-1',
      revision: 1,
      revokedAt: null,
    });
    const revoked = await service.revokeRepresentation(
      'case-1',
      'grant1',
      body,
      actor,
    );
    expect(revoked.data.revokedById).toBe('maker');
    expect(revoked.data.revokedAt).toBeInstanceOf(Date);
  });
  it('returns held and future retention eligibility as preserve-only decisions', async () => {
    const { service, tx } = fixture();
    tx.caseRetentionPolicy.findFirst.mockResolvedValue({
      id: 'p1',
      revision: 1,
      approvedRevision: 1,
      contentHash: 'h',
      approvedHash: 'h',
      preserveUntil: new Date('2099-01-01'),
    });
    expect((await service.eligibility('case-1', actor)).data).toMatchObject({
      eligible: false,
      reason: 'RETENTION_NOT_DUE',
      preserve: true,
    });
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'hold1' });
    expect((await service.eligibility('case-1', actor)).data).toMatchObject({
      eligible: false,
      reason: 'ACTIVE_HOLD',
      preserve: true,
    });
  });
  it('retention revisions clear exact approval and require independent re-review', async () => {
    const { service, tx } = fixture();
    tx.caseRetentionPolicy.findFirst.mockResolvedValue({
      id: 'p1',
      authorId: 'maker',
      revision: 1,
      status: 'REVIEWED',
      approvedRevision: 1,
      approvedHash: 'old',
    });
    const changed = await service.retentionTransition(
      'case-1',
      'p1',
      'revise',
      {
        ...body,
        preserveUntil: '2099-01-01T00:00:00.000Z',
        basis: 'changed preservation basis',
      },
      actor,
    );
    expect(changed.data.status).toBe('DRAFT');
    expect(changed.data.approvedHash).toBeNull();
    expect(changed.data.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('independent packet rejection records reviewer and leaves no approval', async () => {
    const { service, tx } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet1',
      authorId: 'other',
      caseId: 'case-1',
      status: 'SUBMITTED',
      revision: 1,
    });
    const rejected = await service.reviewPacket(
      'case-1',
      'packet1',
      { ...body, approve: false },
      actor,
    );
    expect(rejected.data.status).toBe('REJECTED');
    expect(rejected.data.approvedHash).toBeNull();
    expect(rejected.data.reviewedById).toBe('maker');
  });
  it('rejects empty disclosure packets', async () => {
    const { service } = fixture();
    await expect(
      service.createPacket(
        'case-1',
        {
          ...body,
          recipientId: 'recipient',
          purpose: 'review',
          basis: 'synthetic',
          expiresAt: '2099-10-07T00:00:00.000Z',
          items: [],
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves approved packet immutable and requires a new/delta packet', async () => {
    const { tx, service } = fixture();
    tx.caseAssetVersion.findFirst.mockResolvedValue({
      id: 'asset-original',
      caseId: 'case-1',
    });
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      status: 'APPROVED',
      authorId: 'maker',
      revision: 1,
    });
    await expect(
      service.revisePacket(
        'case-1',
        'packet-1',
        {
          ...body,
          recipientId: 'recipient',
          purpose: 'valid attempted revision',
          basis: 'synthetic authority',
          expiresAt: '2099-01-01T00:00:00.000Z',
          items: [{ assetVersionId: 'asset-original' }],
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseDisclosurePacket.update).not.toHaveBeenCalled();
  });
  it('does not export revoked packet bytes', async () => {
    const { tx, service } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      status: 'APPROVED',
      revokedAt: new Date(),
      expiresAt: new Date('2099-01-01'),
    });
    await expect(
      service.exportPacket('case-1', 'packet-1', actor),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('does not export expired packet bytes', async () => {
    const { tx, service } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      status: 'APPROVED',
      expiresAt: new Date('2000-01-01'),
    });
    await expect(
      service.exportPacket('case-1', 'packet-1', actor),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies unapproved exact revision export', async () => {
    const { tx, service } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      status: 'APPROVED',
      revision: 2,
      approvedRevision: 1,
      approvedHash: 'old',
      contentHash: 'new',
      expiresAt: new Date('2099-01-01'),
    });
    await expect(
      service.exportPacket('case-1', 'packet-1', actor),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('denies retention maker publication even after a review', async () => {
    const { tx, service } = fixture();
    tx.caseRetentionPolicy.findFirst.mockResolvedValue({
      id: 'p1',
      caseId: 'case-1',
      authorId: 'maker',
      status: 'REVIEWED',
      revision: 1,
      approvedRevision: 1,
      approvedHash: 'h',
      contentHash: 'h',
    });
    await expect(
      service.retentionTransition('case-1', 'p1', 'publish', body, actor),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies self-reviewed disposition', async () => {
    const { tx, service } = fixture();
    tx.caseDispositionRequest.findFirst.mockResolvedValue({
      id: 'd1',
      caseId: 'case-1',
      authorId: 'maker',
      status: 'SUBMITTED',
      revision: 1,
    });
    await expect(
      service.dispositionTransition(
        'case-1',
        'd1',
        'review',
        { ...body, approve: true },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies disposition execution after a new hold', async () => {
    const { tx, service } = fixture();
    tx.caseDispositionRequest.findFirst.mockResolvedValue({
      id: 'd1',
      caseId: 'case-1',
      authorId: 'other',
      status: 'APPROVED',
      revision: 1,
      approvedRevision: 1,
      approvedHash: 'h',
      contentHash: 'h',
      assetVersionIds: ['asset-1'],
    });
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'new-hold' });
    await expect(
      service.dispositionTransition(
        'case-1',
        'd1',
        'execute',
        { ...body, outcome: 'RETIRED', receipt: { reference: 'synthetic' } },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseAssetVersion.updateMany).not.toHaveBeenCalled();
  });
  it('rejects registration of another parent document before file hydration', async () => {
    const { tx, service } = fixture();
    tx.document.findFirst.mockResolvedValue({ id: 'doc-1', caseId: 'hidden' });
    await expect(
      service.registerAsset('case-1', { ...body, documentId: 'doc-1' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.caseAssetVersion.create).not.toHaveBeenCalled();
  });
  it('rejects caller-provided storage paths and authority flags', async () => {
    const { service } = fixture();
    const hostile = {
      ...body,
      documentId: 'doc-1',
      filePath: 'C:/outside',
      approved: true,
    };
    await expect(
      service.registerAsset('case-1', hostile, actor),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('custody corrections append exact original event links without updates', async () => {
    const { tx, service } = fixture();
    tx.evidence.findFirst.mockResolvedValue({
      id: 'physical-1',
      caseId: 'case-1',
    });
    tx.caseCustodyEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      caseId: 'case-1',
      evidenceId: 'physical-1',
      assetVersionId: null,
      payload: {
        version: 1,
        currentCustody: {
          holder: physicalHolder,
          location: 'Locker A',
          condition: 'SEALED',
          conditionNote: 'sealed',
        },
      },
    });
    jest.spyOn(service, 'decisionSourceSnapshot').mockResolvedValue({
      documentId: 'receipt1',
      caseId: 'case-1',
      ownerCaseId: 'case-1',
      documentUpdatedAt: '2026-10-06T00:00:00.000Z',
      sha256: 'a'.repeat(64),
      byteLength: 1,
      assetVersionId: null,
      parentVersionId: null,
      parentSha256: null,
      relationId: null,
      relationRevision: null,
    });
    const result = await service.appendCustody(
      'case-1',
      {
        ...body,
        evidenceId: 'physical-1',
        eventType: 'CORRECTION',
        correctsEventId: 'event-1',
        expectedCustodyEventId: 'event-1',
        occurredAt: '2026-10-06T00:00:00.000Z',
        custodyFacts,
      },
      actor,
    );
    expect(result.data.correctsEventId).toBe('event-1');
    expect(tx.caseCustodyEvent.update).not.toHaveBeenCalled();
  });
  it('rejects custody correction to a different evidence object', async () => {
    const { tx, service } = fixture();
    tx.evidence.findFirst.mockResolvedValue({
      id: 'physical-1',
      caseId: 'case-1',
    });
    tx.caseCustodyEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      caseId: 'case-1',
      evidenceId: 'physical-2',
      assetVersionId: null,
    });
    await expect(
      service.appendCustody(
        'case-1',
        {
          ...body,
          evidenceId: 'physical-1',
          eventType: 'CORRECTION',
          correctsEventId: 'event-1',
          expectedCustodyEventId: 'event-1',
          occurredAt: '2026-10-06T00:00:00.000Z',
          payload: { reason: 'correction' },
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('denies packet maker self-review even when capability is explicitly granted', async () => {
    const { tx, service } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      authorId: 'maker',
      status: 'SUBMITTED',
      revision: 1,
    });
    await expect(
      service.reviewPacket(
        'case-1',
        'packet-1',
        { ...body, approve: true },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies stale packet revision before approval', async () => {
    const { tx, service } = fixture();
    tx.caseDisclosurePacket.findFirst.mockResolvedValue({
      id: 'packet-1',
      caseId: 'case-1',
      authorId: 'other',
      status: 'SUBMITTED',
      revision: 2,
    });
    await expect(
      service.reviewPacket(
        'case-1',
        'packet-1',
        { ...body, approve: true },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('preserves until published policy exists and never purges during eligibility', async () => {
    const { tx, service } = fixture();
    const result = await service.eligibility('case-1', actor);
    expect(result.data).toMatchObject({
      eligible: false,
      reason: 'NO_PUBLISHED_POLICY',
    });
    expect(tx.document.update).not.toHaveBeenCalled();
  });
  it('denies lawyer representation belonging to a hidden Case', async () => {
    const { tx, service } = fixture();
    tx.lawyer.findFirst.mockResolvedValue({ id: 'lawyer-1', caseId: 'hidden' });
    await expect(
      service.addRepresentation(
        'case-1',
        {
          ...body,
          lawyerId: 'lawyer-1',
          granteeId: 'recipient',
          capabilities: ['download'],
          startsAt: '2026-10-06T00:00:00.000Z',
          expiresAt: '2026-10-07T00:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('denies active hold disposition before any request creation', async () => {
    const { tx, service } = fixture();
    tx.caseRetentionPolicy.findFirst.mockResolvedValue({
      id: 'policy-1',
      caseId: 'case-1',
      status: 'PUBLISHED',
      preserveUntil: new Date('2026-10-01'),
      approvedRevision: 1,
      revision: 1,
      approvedHash: 'hash',
      contentHash: 'hash',
    });
    tx.caseEvidenceHold.findFirst.mockResolvedValue({ id: 'hold-1' });
    await expect(
      service.createDisposition(
        'case-1',
        {
          ...body,
          policyId: 'policy-1',
          assetVersionIds: ['asset-1'],
          purpose: 'authorized retirement',
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseDispositionRequest.create).not.toHaveBeenCalled();
  });
});
