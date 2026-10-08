import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { CaseEvidenceGovernanceService } from './evidence-governance.service';
import { verifyDisclosureBundle } from './disclosure-manifest';
import { ForbiddenException } from '@nestjs/common';
import type {
  CaseAssetVersion,
  CaseDisclosurePacket,
  CaseDisclosurePacketItem,
  CaseRetentionPolicy,
  CaseDispositionRequest,
  Prisma,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CaseGovernanceService } from '../governance/case-governance.service';
import type { ActorContext } from '../governance/case-governance.contract';
type WriteArgs = { data: Record<string, unknown> };
function applyRecord<T extends object>(
  record: T | null,
  data: Record<string, unknown>,
): T {
  if (!record) throw new Error('Missing synthetic fixture row');
  const changed = { ...data },
    value = data.revision;
  if (value && typeof value === 'object' && 'increment' in value) {
    const increment = (value as { increment: unknown }).increment,
      previous = (record as { revision?: number }).revision;
    if (typeof increment === 'number' && typeof previous === 'number')
      changed.revision = previous + increment;
  }
  Object.assign(record, changed);
  return record;
}

describe('CG11–13 complete synthetic operator lifecycles', () => {
  let root: string;
  const bytes = Buffer.from('synthetic disclosure bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc02-lifecycle-'));
    await writeFile(join(root, 'original.bin'), bytes, { flag: 'wx' });
  });
  afterEach(async () => {
    if (!root.startsWith(join(tmpdir(), 'pc02-lifecycle-')))
      throw new Error('Unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  });
  function fixture() {
    const doc = {
      id: 'doc1',
      caseId: 'case1',
      updatedAt: new Date('2026-10-06'),
      fileName: 'original.bin',
      size: bytes.length,
    };
    const asset: CaseAssetVersion = {
      id: 'asset1',
      caseId: 'case1',
      documentId: 'doc1',
      sha256,
      byteLength: bytes.length,
      documentUpdatedAt: doc.updatedAt,
      parentVersionId: null,
      parentSha256: null,
      tool: null,
      toolVersion: null,
      sourceHash: null,
      kind: 'ORIGINAL',
      retiredAt: null,
      dispositionId: null,
      createdById: 'maker',
      createdAt: new Date('2026-10-06'),
    };
    const stored: {
      packet: CaseDisclosurePacket | null;
      items: CaseDisclosurePacketItem[];
      policy: CaseRetentionPolicy | null;
      disposition: CaseDispositionRequest | null;
    } = {
      packet: null,
      items: [],
      policy: null,
      disposition: null,
    };
    const state = {
      get packet() {
        if (!stored.packet) throw new Error('Missing packet fixture');
        return stored.packet;
      },
      get policy() {
        if (!stored.policy) throw new Error('Missing policy fixture');
        return stored.policy;
      },
      get disposition() {
        if (!stored.disposition) throw new Error('Missing disposition fixture');
        return stored.disposition;
      },
    };
    const tx = {
      $transaction: jest.fn(),
      lawyer: { findFirst: jest.fn().mockResolvedValue(null) },
      caseRelation: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          caseAccessMode: 'INTERNAL',
          caseAccessRevision: 0,
        }),
      },
      document: { findFirst: jest.fn().mockResolvedValue(doc) },
      caseAssetVersion: {
        findFirst: jest.fn().mockResolvedValue(asset),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => {
            Object.assign(asset, args.data);
            return { count: 1 };
          }),
        ),
      },
      caseDisclosurePacket: {
        create: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => {
            stored.packet = {
              ...args.data,
              status: 'DRAFT',
              revision: 1,
              revokedAt: null,
              deltaOfPacketId: args.data.deltaOfPacketId ?? null,
              createdAt: new Date('2026-10-06'),
              updatedAt: new Date('2026-10-06'),
              approvedHash: null,
              approvedRevision: null,
              reviewedById: null,
              reviewedAt: null,
            } as CaseDisclosurePacket;
            return stored.packet;
          }),
        ),
        findFirst: jest.fn(() => Promise.resolve().then(() => stored.packet)),
        update: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => applyRecord(stored.packet, args.data)),
        ),
      },
      caseDisclosurePacketItem: {
        create: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => {
            stored.items.push({
              id: `item-${stored.items.length + 1}`,
              createdAt: new Date('2026-10-06'),
              ...args.data,
              redaction: args.data.redaction ?? null,
            } as CaseDisclosurePacketItem);
            return args.data;
          }),
        ),
        findMany: jest.fn((args: { where: { packetId?: string } }) =>
          Promise.resolve().then(() =>
            args.where.packetId
              ? stored.items.filter(
                  (item) => item.packetId === args.where.packetId,
                )
              : stored.items,
          ),
        ),
        deleteMany: jest.fn(() =>
          Promise.resolve().then(() => {
            stored.items = [];
            return { count: 1 };
          }),
        ),
      },
      caseRepresentationGrant: { findMany: jest.fn().mockResolvedValue([]) },
      caseEvidenceHold: { findFirst: jest.fn().mockResolvedValue(null) },
      caseRetentionPolicy: {
        create: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => {
            stored.policy = {
              id: 'policy1',
              status: 'DRAFT',
              revision: 1,
              ...args.data,
              createdAt: new Date('2026-10-06'),
              updatedAt: new Date('2026-10-06'),
              approvedHash: null,
              approvedRevision: null,
              reviewedById: null,
              publishedAt: null,
            } as CaseRetentionPolicy;
            return stored.policy;
          }),
        ),
        findFirst: jest.fn(() => Promise.resolve().then(() => stored.policy)),
        findFirstOrThrow: jest.fn(() =>
          Promise.resolve().then(() => state.policy),
        ),
        update: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => applyRecord(stored.policy, args.data)),
        ),
        updateMany: jest.fn(),
      },
      caseDispositionRequest: {
        create: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() => {
            stored.disposition = {
              id: 'disposition1',
              status: 'DRAFT',
              revision: 1,
              ...args.data,
              createdAt: new Date('2026-10-06'),
              updatedAt: new Date('2026-10-06'),
              approvedHash: null,
              approvedRevision: null,
              reviewedById: null,
              reviewedAt: null,
              executedAt: null,
              executedById: null,
              receipt: null,
              outcome: null,
            } as CaseDispositionRequest;
            return stored.disposition;
          }),
        ),
        findFirst: jest.fn(() =>
          Promise.resolve().then(() => stored.disposition),
        ),
        update: jest.fn((args: WriteArgs) =>
          Promise.resolve().then(() =>
            applyRecord(stored.disposition, args.data),
          ),
        ),
      },
      caseGovernanceEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    tx.$transaction.mockImplementation(
      (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        fn(tx as unknown as Prisma.TransactionClient),
    );
    const core = {
      assertBaseCaseReadable: jest.fn(),
      assertCaseAccessCapability: jest.fn(),
      assertClassificationInspectable: jest.fn(),
      assertCaseReadable: jest.fn(),
      hasCapability: jest.fn().mockResolvedValue(true),
      enqueue: jest.fn(),
      mutateCase: jest.fn(
        (
          _input: unknown,
          actor: ActorContext,
          handler: (
            client: Prisma.TransactionClient,
            context: {
              caseRecord: { id: string };
              actor: ActorContext;
              operationId: string;
            },
          ) => Promise<unknown>,
        ) =>
          handler(tx as unknown as Prisma.TransactionClient, {
            caseRecord: { id: 'case1' },
            actor,
            operationId: 'op1',
          }),
      ),
    };
    const service = new CaseEvidenceGovernanceService(
      tx as unknown as PrismaService,
      core as unknown as CaseGovernanceService,
      {
        byteFieldPolicySnapshot: jest.fn().mockResolvedValue({
          definitionVersionId: null,
          definitionHash: 'unrestricted-test-policy',
          hasDeniedProtectedFields: false,
        }),
      } as never,
    );
    Object.defineProperty(service, 'uploadRoot', { value: root });
    return { service, tx, core, state, asset };
  }
  let sequence = 0;
  const command = (extra: Record<string, unknown> = {}) => ({
    requestKey: `test-${++sequence}`,
    expectedUpdatedAt: '2026-10-06T00:00:00.000Z',
    expectedRevision: 1,
    ...extra,
  });
  const maker = { actorId: 'maker' },
    reviewer = { actorId: 'reviewer' },
    recipient = { actorId: 'recipient' };
  it('creates, submits, independently approves, exports and revokes exact approved bytes', async () => {
    const { service, state, tx } = fixture();
    await service.createPacket(
      'case1',
      command({
        recipientId: 'recipient',
        purpose: 'synthetic review',
        basis: 'synthetic authorization',
        expiresAt: '2099-01-01T00:00:00.000Z',
        items: [{ assetVersionId: 'asset1' }],
      }),
      maker,
    );
    expect(state.packet.contentHash).toMatch(/^[a-f0-9]{64}$/);
    await service.submitPacket('case1', state.packet.id, command(), maker);
    await service.reviewPacket(
      'case1',
      state.packet.id,
      command({ approve: true }),
      reviewer,
    );
    expect(state.packet.approvedRevision).toBe(1);
    tx.caseEvidenceHold.findFirst.mockResolvedValue({
      id: 'synthetic-preservation-hold',
    });
    const result = await service.exportPacket(
      'case1',
      state.packet.id,
      recipient,
    );
    expect(
      verifyDisclosureBundle(result.data, state.packet.approvedHash!).itemCount,
    ).toBe(1);
    await service.revokePacket(
      'case1',
      state.packet.id,
      command({ reason: 'synthetic revocation' }),
      reviewer,
    );
    await expect(
      service.exportPacket('case1', state.packet.id, recipient),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      verifyDisclosureBundle(result.data, result.data.manifestHash).valid,
    ).toBe(true);
    expect(tx.caseGovernanceEvent.create).toHaveBeenCalledTimes(4);
  });
  it('packet-ready notices require current exact approved recipient authority without delivering bytes', async () => {
    const { service, state, tx } = fixture();
    await service.createPacket(
      'case1',
      command({
        recipientId: 'recipient',
        purpose: 'synthetic recipient notice',
        basis: 'synthetic authority',
        expiresAt: '2099-01-01T00:00:00.000Z',
        items: [{ assetVersionId: 'asset1' }],
      }),
      maker,
    );
    await service.submitPacket('case1', state.packet.id, command(), maker);
    await service.reviewPacket(
      'case1',
      state.packet.id,
      command({ approve: true }),
      reviewer,
    );
    await expect(
      service.assertPacketNotificationRecipient(
        tx as unknown as Prisma.TransactionClient,
        state.packet.id,
        recipient,
      ),
    ).resolves.toMatchObject({
      packetId: state.packet.id,
      approvedHash: state.packet.approvedHash,
      revision: 1,
    });
    await expect(
      service.assertPacketNotificationRecipient(
        tx as unknown as Prisma.TransactionClient,
        state.packet.id,
        maker,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await service.revokePacket(
      'case1',
      state.packet.id,
      command({ reason: 'notice permission revoked' }),
      reviewer,
    );
    await expect(
      service.assertPacketNotificationRecipient(
        tx as unknown as Prisma.TransactionClient,
        state.packet.id,
        recipient,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('approved content changes use a new delta packet preserving original approved revision', async () => {
    const { service, state } = fixture();
    const content = {
      recipientId: 'recipient',
      purpose: 'approved original purpose',
      basis: 'synthetic lawful disclosure',
      expiresAt: '2099-01-01T00:00:00.000Z',
      items: [{ assetVersionId: 'asset1' }],
    };
    await service.createPacket('case1', command(content), maker);
    await service.submitPacket('case1', state.packet.id, command(), maker);
    await service.reviewPacket(
      'case1',
      state.packet.id,
      command({ approve: true }),
      reviewer,
    );
    const original = state.packet;
    const approvalHash = original.approvedHash;
    const delta = await service.createPacket(
      'case1',
      command({
        ...content,
        purpose: 'authorized additional disclosure',
        deltaOfPacketId: original.id,
      }),
      maker,
    );
    expect(delta.data.id).not.toBe(original.id);
    expect(delta.data.deltaOfPacketId).toBe(original.id);
    expect(delta.data.status).toBe('DRAFT');
    expect(original.approvedHash).toBe(approvalHash);
    expect(original.status).toBe('APPROVED');
    expect(original.revision).toBe(1);
  });
  it('draft revision replaces exact items and invalidates prior approval before renewed submission', async () => {
    const { service, state, tx } = fixture();
    const draft = {
      recipientId: 'recipient',
      purpose: 'initial review purpose',
      basis: 'synthetic authority',
      expiresAt: '2099-01-01T00:00:00.000Z',
      items: [{ assetVersionId: 'asset1' }],
    };
    await service.createPacket('case1', command(draft), maker);
    const firstHash = state.packet.contentHash;
    await service.revisePacket(
      'case1',
      state.packet.id,
      command({ ...draft, purpose: 'revised explicit disclosure purpose' }),
      maker,
    );
    expect(state.packet.revision).toBe(2);
    expect(state.packet.contentHash).not.toBe(firstHash);
    expect(state.packet.approvedHash).toBeNull();
    expect(tx.caseDisclosurePacketItem.deleteMany).toHaveBeenCalledTimes(1);
    await expect(
      service.submitPacket('case1', state.packet.id, command(), maker),
    ).rejects.toMatchObject({ status: 409 });
    await service.submitPacket(
      'case1',
      state.packet.id,
      command({ expectedRevision: 2 }),
      maker,
    );
    await service.reviewPacket(
      'case1',
      state.packet.id,
      command({ expectedRevision: 2, approve: true }),
      reviewer,
    );
    const result = await service.exportPacket(
      'case1',
      state.packet.id,
      recipient,
    );
    expect(result.data.manifest.revision).toBe(2);
    expect(
      verifyDisclosureBundle(result.data, state.packet.approvedHash!).valid,
    ).toBe(true);
  });
  it('registers and verifies an immutable original with actual server bytes', async () => {
    const { service, tx } = fixture();
    tx.caseAssetVersion.create.mockImplementation((args: WriteArgs) =>
      Promise.resolve({ id: 'asset-new', ...args.data }),
    );
    const registered = await service.registerAsset(
      'case1',
      command({ documentId: 'doc1' }),
      maker,
    );
    expect(registered).toMatchObject({
      data: {
        sha256,
        byteLength: bytes.length,
        documentId: 'doc1',
        kind: 'ORIGINAL',
      },
    });
    const verified = await service.verifyAsset('case1', 'asset1', maker);
    expect(verified).toMatchObject({
      data: { integrityVerified: true, legalSignatureVerified: false },
    });
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  });
  it.each([
    ['expired recipient packet', { expiresAt: '2020-01-01T00:00:00.000Z' }],
    [
      'duplicate items',
      { items: [{ assetVersionId: 'asset1' }, { assetVersionId: 'asset1' }] },
    ],
    [
      'oversized item list',
      {
        items: Array.from({ length: 51 }, () => ({ assetVersionId: 'asset1' })),
      },
    ],
    [
      'unknown item authority',
      { items: [{ assetVersionId: 'asset1', approved: true }] },
    ],
    [
      'pretend redacted original',
      {
        items: [
          { assetVersionId: 'asset1', contentPolicy: 'REDACTED_DERIVATIVE' },
        ],
      },
    ],
    [
      'redaction without derivative',
      { items: [{ assetVersionId: 'asset1', redaction: { reason: 'mask' } }] },
    ],
    [
      'unknown policy',
      { items: [{ assetVersionId: 'asset1', contentPolicy: 'TRUST_CLIENT' }] },
    ],
  ])('rejects %s before any packet persistence', async (_reason, extra) => {
    const { service, tx } = fixture();
    await expect(
      service.createPacket(
        'case1',
        command({
          recipientId: 'recipient',
          purpose: 'synthetic review',
          basis: 'synthetic authority',
          expiresAt: '2099-01-01T00:00:00.000Z',
          items: [{ assetVersionId: 'asset1' }],
          ...extra,
        }),
        maker,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.caseDisclosurePacket.create).not.toHaveBeenCalled();
  });
  it('disposition refuses incomplete, future or invalid preservation receipts without retiring bytes', async () => {
    const { service, state, asset } = fixture();
    await service.createRetention(
      'case1',
      command({
        preserveUntil: '2026-01-01T00:00:00.000Z',
        basis: 'synthetic due policy',
      }),
      maker,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'publish',
      command(),
      reviewer,
    );
    await service.createDisposition(
      'case1',
      command({
        policyId: 'policy1',
        assetVersionIds: ['asset1'],
        purpose: 'synthetic disposition',
      }),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'submit',
      command(),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    for (const extra of [
      { outcome: 'PURGED' },
      { outcome: 'ARCHIVED' },
      {
        outcome: 'ARCHIVED',
        receipt: {
          reference: 'receipt',
          recordedAt: '2099-01-01T00:00:00.000Z',
        },
      },
    ]) {
      await expect(
        service.dispositionTransition(
          'case1',
          'disposition1',
          'execute',
          command(extra),
          reviewer,
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(asset.retiredAt).toBeNull();
      expect(state.disposition.status).toBe('APPROVED');
    }
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  });
  it('pins derivative bytes, exact immutable parent hash and tool provenance', async () => {
    const { service, tx } = fixture();
    const derived = Buffer.from('reviewed synthetic derivative');
    await writeFile(join(root, 'derivative.bin'), derived, { flag: 'wx' });
    const derivedDoc = {
      id: 'doc2',
      caseId: 'case1',
      fileName: 'derivative.bin',
      size: derived.length,
      updatedAt: new Date('2026-10-06'),
    };
    tx.document.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(
          args.where.id === 'doc2'
            ? derivedDoc
            : {
                id: 'doc1',
                caseId: 'case1',
                fileName: 'original.bin',
                size: bytes.length,
                updatedAt: new Date('2026-10-06'),
              },
        ),
    );
    tx.caseAssetVersion.create.mockImplementation((args: WriteArgs) =>
      Promise.resolve({ id: 'derived1', ...args.data }),
    );
    const result = await service.registerAsset(
      'case1',
      command({
        documentId: 'doc2',
        tool: 'synthetic-review-tool',
        toolVersion: '2026.1',
        sourceHash: sha256,
      }),
      maker,
      'asset1',
    );
    expect(result).toMatchObject({
      data: {
        kind: 'DERIVATIVE',
        parentVersionId: 'asset1',
        parentSha256: sha256,
        sourceHash: sha256,
        tool: 'synthetic-review-tool',
        toolVersion: '2026.1',
        sha256: createHash('sha256').update(derived).digest('hex'),
      },
    });
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  });
  it('rejected retention and disposition must be revised and independently approved again', async () => {
    const { service, state } = fixture();
    await service.createRetention(
      'case1',
      command({
        preserveUntil: '2026-01-01T00:00:00.000Z',
        basis: 'initial preservation policy',
      }),
      maker,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'review',
      command({ approve: false }),
      reviewer,
    );
    expect(state.policy.status).toBe('REJECTED');
    expect(state.policy.approvedHash).toBeNull();
    await service.retentionTransition(
      'case1',
      'policy1',
      'revise',
      command({
        preserveUntil: '2026-02-01T00:00:00.000Z',
        basis: 'revised preservation policy',
      }),
      maker,
    );
    expect(state.policy.revision).toBe(2);
    expect(state.policy.reviewedById).toBeNull();
    await service.retentionTransition(
      'case1',
      'policy1',
      'review',
      command({ expectedRevision: 2, approve: true }),
      reviewer,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'publish',
      command({ expectedRevision: 2 }),
      reviewer,
    );
    await service.createDisposition(
      'case1',
      command({
        policyId: 'policy1',
        assetVersionIds: ['asset1'],
        purpose: 'initial retirement purpose',
      }),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'submit',
      command(),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'review',
      command({ approve: false }),
      reviewer,
    );
    expect(state.disposition.status).toBe('REJECTED');
    expect(state.disposition.approvedHash).toBeNull();
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'revise',
      command({
        assetVersionIds: ['asset1'],
        purpose: 'revised retirement purpose',
      }),
      maker,
    );
    expect(state.disposition.revision).toBe(2);
    expect(state.disposition.status).toBe('DRAFT');
    expect(state.disposition.reviewedById).toBeNull();
    await expect(
      service.dispositionTransition(
        'case1',
        'disposition1',
        'execute',
        command({ expectedRevision: 2 }),
        reviewer,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
  });
  it('R3 disposition execution pins an unregistered receipt exact version/hash and immutable source', async () => {
    const { service, state, tx } = fixture();
    const receiptBytes = Buffer.from(
      'synthetic authorized disposition receipt',
    );
    await writeFile(join(root, 'receipt.bin'), receiptBytes, { flag: 'wx' });
    const doc = {
      id: 'receipt-doc',
      caseId: 'case1',
      fileName: 'receipt.bin',
      size: receiptBytes.length,
      updatedAt: new Date('2026-10-06'),
    };
    tx.document.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(
          args.where.id === 'receipt-doc'
            ? doc
            : {
                id: 'doc1',
                caseId: 'case1',
                fileName: 'original.bin',
                size: bytes.length,
                updatedAt: new Date('2026-10-06'),
              },
        ),
    );
    tx.caseAssetVersion.create.mockImplementation((args: WriteArgs) =>
      Promise.resolve({ id: 'receipt-asset', ...args.data }),
    );
    await service.createRetention(
      'case1',
      command({
        preserveUntil: '2026-01-01T00:00:00.000Z',
        basis: 'synthetic due policy',
      }),
      maker,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'publish',
      command(),
      reviewer,
    );
    await service.createDisposition(
      'case1',
      command({
        policyId: 'policy1',
        assetVersionIds: ['asset1'],
        purpose: 'synthetic approved retirement',
      }),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'submit',
      command(),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'execute',
      command({
        outcome: 'ARCHIVED',
        receipt: {
          reference: 'receipt-001',
          recordedAt: '2026-01-01T00:00:00.000Z',
          documentId: 'receipt-doc',
          expectedDocumentUpdatedAt: doc.updatedAt.toISOString(),
        },
      }),
      reviewer,
    );
    expect(state.disposition).toMatchObject({
      receiptDocumentId: 'receipt-doc',
      receiptDocumentUpdatedAt: doc.updatedAt,
      receiptSha256: createHash('sha256').update(receiptBytes).digest('hex'),
      receiptByteLength: receiptBytes.length,
    });
    expect(state.disposition.receipt).toMatchObject({
      sourceSnapshot: {
        documentId: 'receipt-doc',
        assetVersionId: 'receipt-asset',
        sha256: createHash('sha256').update(receiptBytes).digest('hex'),
        documentUpdatedAt: doc.updatedAt.toISOString(),
      },
    });
    expect(tx.caseAssetVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentId: 'receipt-doc',
        kind: 'ORIGINAL',
        sha256: createHash('sha256').update(receiptBytes).digest('hex'),
      }) as unknown,
    });
    expect(await readFile(join(root, 'receipt.bin'))).toEqual(receiptBytes);
  });
  it('publishes reviewed retention and executes approved retirement without destroying original bytes', async () => {
    const { service, state, asset } = fixture();
    await service.createRetention(
      'case1',
      command({
        preserveUntil: '2026-01-01T00:00:00.000Z',
        basis: 'synthetic retention approval',
      }),
      maker,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    await service.retentionTransition(
      'case1',
      'policy1',
      'publish',
      command(),
      reviewer,
    );
    await service.createDisposition(
      'case1',
      command({
        policyId: 'policy1',
        assetVersionIds: ['asset1'],
        purpose: 'synthetic authorized retirement',
      }),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'submit',
      command(),
      maker,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'review',
      command({ approve: true }),
      reviewer,
    );
    await service.dispositionTransition(
      'case1',
      'disposition1',
      'execute',
      command({
        outcome: 'RETIRED',
        receipt: {
          reference: 'synthetic authorized receipt',
          recordedAt: '2026-10-01T00:00:00.000Z',
        },
      }),
      reviewer,
    );
    expect(state.disposition.status).toBe('EXECUTED');
    expect(asset.retiredAt).toBeInstanceOf(Date);
    expect(await readFile(join(root, 'original.bin'))).toEqual(bytes);
    await expect(
      service.verifiedAsset('case1', 'asset1', recipient, 'download'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('keeps view, download and share distinct even for otherwise readable actors', async () => {
    const { service, core } = fixture();
    core.hasCapability.mockImplementation(
      (_tx: unknown, _id: string, action: string) =>
        Promise.resolve().then(() => action === 'read'),
    );
    const result = await service.verifyAsset('case1', 'asset1', recipient);
    expect(result.data.integrityVerified).toBe(true);
    await expect(
      service.verifiedAsset('case1', 'asset1', recipient, 'download'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.authorizeAsset(
        {} as never,
        'case1',
        'asset1',
        recipient,
        'share',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('pins a read-only source snapshot and catches one-byte source alteration', async () => {
    const { service, tx } = fixture();
    tx.caseAssetVersion.findUnique = jest.fn().mockResolvedValue(null);
    const snapshot = await service.decisionSourceSnapshot(
      tx as unknown as Prisma.TransactionClient,
      'case1',
      'doc1',
      maker,
    );
    expect(snapshot.sha256).toBe(sha256);
    expect(snapshot.documentUpdatedAt).toBe('2026-10-06T00:00:00.000Z');
    expect(tx.caseGovernanceEvent.create).not.toHaveBeenCalled();
    const changed = Buffer.from(bytes);
    changed[0] ^= 1;
    await writeFile(join(root, 'original.bin'), changed);
    const altered = await service.decisionSourceSnapshot(
      tx as unknown as Prisma.TransactionClient,
      'case1',
      'doc1',
      maker,
    );
    expect(altered.sha256).not.toBe(snapshot.sha256);
  });
  it.each([
    ['missing tool', { tool: '' }, 400],
    ['missing tool version', { toolVersion: '' }, 400],
    ['wrong exact source hash', { sourceHash: '0'.repeat(64) }, 409],
  ])(
    'derivative registration rejects %s before ledger writes',
    async (_label, extra, status) => {
      const { service, tx } = fixture();
      tx.document.findFirst.mockImplementation(
        (args: { where: { id: string } }) =>
          Promise.resolve({
            id: args.where.id,
            caseId: 'case1',
            fileName: 'original.bin',
            size: bytes.length,
            updatedAt: new Date('2026-10-06'),
          }),
      );
      await expect(
        service.registerAsset(
          'case1',
          command({
            documentId: 'new-derived',
            tool: 'synthetic tool',
            toolVersion: '1',
            sourceHash: sha256,
            ...extra,
          }),
          maker,
          'asset1',
        ),
      ).rejects.toMatchObject({ status });
      expect(tx.caseAssetVersion.create).not.toHaveBeenCalled();
    },
  );
  it('parent size mismatch cannot establish derivative lineage even when SHA256 matches', async () => {
    const { service, tx, asset } = fixture();
    asset.byteLength += 1;
    tx.document.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          caseId: 'case1',
          fileName: 'original.bin',
          size: bytes.length,
          updatedAt: new Date('2026-10-06'),
        }),
    );
    await expect(
      service.registerAsset(
        'case1',
        command({
          documentId: 'new-derived',
          tool: 'synthetic tool',
          toolVersion: '1',
          sourceHash: sha256,
        }),
        maker,
        'asset1',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseAssetVersion.create).not.toHaveBeenCalled();
  });
  it('classification pins registered byte identity and refuses retired/version-changed sources', async () => {
    const { service, tx, asset } = fixture();
    tx.caseAssetVersion.findUnique.mockResolvedValue(asset);
    const snap = await service.decisionSourceSnapshot(
      tx as unknown as Prisma.TransactionClient,
      'case1',
      'doc1',
      maker,
      'Controlled classification inspection',
    );
    expect(snap.assetVersionId).toBe('asset1');
    expect(snap.sha256).toBe(sha256);
    asset.retiredAt = new Date();
    await expect(
      service.decisionSourceSnapshot(
        tx as unknown as Prisma.TransactionClient,
        'case1',
        'doc1',
        maker,
        'Controlled classification inspection',
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.verifyAsset('case1', 'asset1', maker),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('registered version mismatch and missing legal document prevent disclosure snapshots', async () => {
    const { service, tx } = fixture();
    tx.document.findFirst.mockResolvedValue({
      id: 'doc1',
      caseId: 'case1',
      updatedAt: new Date('2026-10-07'),
      fileName: 'original.bin',
      size: bytes.length,
    });
    await expect(
      service.verifyAsset('case1', 'asset1', maker),
    ).rejects.toMatchObject({ status: 409 });
    tx.document.findFirst.mockResolvedValue(null);
    await expect(
      service.decisionSourceSnapshot(
        tx as unknown as Prisma.TransactionClient,
        'case1',
        'doc1',
        maker,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('pins classification source only through server inspection purpose and never a related unknown Case', async () => {
    const { service, tx, core } = fixture();
    const result = await service.decisionSourceSnapshot(
      tx as unknown as Prisma.TransactionClient,
      'case1',
      'doc1',
      maker,
      'Controlled classification evidence inspection',
    );
    expect(result.sha256).toBe(sha256);
    expect(result.ownerCaseId).toBe('case1');
    expect(result.relationId).toBeNull();
    expect(core.assertClassificationInspectable).toHaveBeenCalledTimes(2);
    await expect(
      service.decisionSourceSnapshot(
        tx as unknown as Prisma.TransactionClient,
        'other-case',
        'doc1',
        maker,
        'Controlled classification evidence inspection',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('never pins a source document removed or changed during hydration', async () => {
    const { service, tx } = fixture();
    tx.document.findFirst
      .mockResolvedValueOnce({
        id: 'doc1',
        caseId: 'case1',
        updatedAt: new Date('2026-10-06'),
        fileName: 'original.bin',
        size: bytes.length,
      })
      .mockResolvedValueOnce(null);
    await expect(
      service.decisionSourceSnapshot(
        tx as unknown as Prisma.TransactionClient,
        'case1',
        'doc1',
        maker,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('refuses derivative provenance when the claimed exact parent bytes have changed', async () => {
    const { service, tx } = fixture();
    await writeFile(
      join(root, 'derivative.bin'),
      Buffer.from('synthetic redacted bytes'),
    );
    const derivativeDoc = {
      id: 'doc2',
      caseId: 'case1',
      fileName: 'derivative.bin',
      size: 24,
      updatedAt: new Date('2026-10-06'),
    };
    const originalDoc = {
      id: 'doc1',
      caseId: 'case1',
      fileName: 'original.bin',
      size: bytes.length,
      updatedAt: new Date('2026-10-06'),
    };
    tx.document.findFirst.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve().then(() =>
          args.where.id === 'doc2' ? derivativeDoc : originalDoc,
        ),
    );
    tx.caseAssetVersion.findUnique = jest.fn().mockResolvedValue(null);
    tx.caseAssetVersion.create = jest.fn(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve().then(() => ({
          id: 'derivative1',
          ...args.data,
        })),
    );
    const changed = Buffer.from(bytes);
    changed[0] ^= 1;
    await writeFile(join(root, 'original.bin'), changed);
    await expect(
      service.registerAsset(
        'case1',
        command({
          documentId: 'doc2',
          tool: 'synthetic redactor',
          toolVersion: '1',
          sourceHash: sha256,
        }),
        maker,
        'asset1',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.caseAssetVersion.create).not.toHaveBeenCalled();
  });
  it('representation download cannot bypass an approved exact packet item through the ordinary file route', async () => {
    const mode = {
      isActive: true,
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 1,
    };
    const { service, tx } = fixture();
    tx.caseRepresentationGrant.findMany.mockResolvedValue([
      {
        id: 'grant1',
        caseId: 'case1',
        lawyerId: 'lawyer1',
        subjectId: null,
        revision: 1,
        revokedAt: null,
        startsAt: new Date('2026-01-01'),
        expiresAt: new Date('2099-01-01'),
        capabilities: ['view', 'download'],
      },
    ]);
    tx.lawyer = {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'lawyer1', caseId: 'case1', subjectId: null }),
    };
    tx.user.findUnique.mockResolvedValue(mode);
    const hydration = service.verifiedAsset(
      'case1',
      'asset1',
      recipient,
      'download',
    );
    try {
      await expect(hydration).rejects.toMatchObject({ status: 403 });
    } finally {
      await hydration.then(
        (file) => file.handle.close(),
        () => undefined,
      );
    }
  });
  function relatedFixture() {
    const value = fixture();
    value.tx.caseAssetVersion.findFirst.mockImplementation(
      (args: { where: { id: string; caseId?: string } }) =>
        Promise.resolve().then(() =>
          args.where.id === 'asset1' &&
          (!args.where.caseId || args.where.caseId === 'case1')
            ? value.asset
            : null,
        ),
    );
    const link = {
      id: 'relation1',
      sourceCaseId: 'target1',
      targetCaseId: 'case1',
      type: 'RELATED',
      revision: 1,
      createdAt: new Date('2026-10-06'),
      revokedAt: null,
      deletedAt: null,
    };
    value.tx.caseRelation = { findFirst: jest.fn().mockResolvedValue(link) };
    return { ...value, link };
  }
  it('authorized direct relation preserves original parent and checks both Cases', async () => {
    const { service, tx, core } = relatedFixture();
    const result = (await service.authorizeAsset(
      tx as unknown as Prisma.TransactionClient,
      'target1',
      'asset1',
      maker,
      'view',
    )) as unknown as {
      asset: { caseId: string };
      relation: { id: string; revision: number };
    };
    expect(result.asset.caseId).toBe('case1');
    expect(result.relation).toMatchObject({ id: 'relation1', revision: 1 });
    expect(core.assertCaseReadable).toHaveBeenCalledWith(tx, 'case1', maker);
  });
  it.each(['revokedAt', 'deletedAt'])(
    'denies inactive direct relation: %s',
    async (field) => {
      const { service, tx, link } = relatedFixture();
      tx.caseRelation.findFirst.mockResolvedValue({
        ...link,
        [field]: new Date(),
      });
      await expect(
        service.authorizeAsset(
          tx as unknown as Prisma.TransactionClient,
          'target1',
          'asset1',
          maker,
          'view',
        ),
      ).rejects.toMatchObject({ status: 403 });
    },
  );
  it('a direct relation never grants hidden owner Case access', async () => {
    const { service, tx, core } = relatedFixture();
    core.assertCaseReadable.mockImplementation((_tx: unknown, id: string) =>
      Promise.resolve().then(() => {
        if (id === 'case1') throw new ForbiddenException('hidden');
      }),
    );
    await expect(
      service.authorizeAsset(
        tx as unknown as Prisma.TransactionClient,
        'target1',
        'asset1',
        maker,
        'view',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rechecks exact direct relation version after file hydration', async () => {
    const { service, tx, link } = relatedFixture();
    tx.caseRelation.findFirst
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({ ...link, revision: 2 });
    await expect(
      service.verifiedAsset('target1', 'asset1', maker, 'download'),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('representation on another Case never falls back to general unit staff download', async () => {
    const mode = {
      isActive: true,
      caseAccessMode: 'REPRESENTATION_ONLY',
      caseAccessRevision: 1,
    };
    const { service, tx } = fixture();
    const otherGrant = {
      id: 'grant-other',
      caseId: 'case-other',
      granteeId: 'recipient',
      lawyerId: 'lawyer-other',
      subjectId: null,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2099-01-01'),
      revokedAt: null,
      revision: 1,
      capabilities: ['list', 'view', 'download'],
    };
    tx.user.findUnique.mockResolvedValue(mode);
    tx.caseRepresentationGrant.findMany.mockImplementation(
      (args: { where: { caseId?: string } }) =>
        Promise.resolve().then(() =>
          args.where.caseId === 'case1' ? [] : [otherGrant],
        ),
    );
    const hydration = service.verifiedAsset(
      'case1',
      'asset1',
      recipient,
      'download',
    );
    try {
      await expect(hydration).rejects.toMatchObject({ status: 403 });
    } finally {
      await hydration.then(
        (file) => file.handle.close(),
        () => undefined,
      );
    }
  });
});
