import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseAssetVersion,
  CaseDisclosurePacket,
  CaseDisclosurePacketItem,
  CaseRelation,
  CaseAccessMode,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from '../governance/case-governance.service';
import { CaseFieldSchemaService } from '../governance/case-field-schema.service';
import { validateCustodyFacts } from './custody-facts';
import {
  legacyDefinitionAllowsBytes,
  definitionAllowsCaseNameSearch,
} from './legacy-byte-eligibility';
import {
  buildScopeFilter,
  buildPetitionScopeFilter,
} from '../../common/utils/scope-filter.util';
import type { CustodyFacts, CustodyState } from './custody-facts';
import {
  canonicalJson,
  ActorContext,
} from '../governance/case-governance.contract';
import {
  openEvidenceFile,
  VerifiedEvidenceFile,
} from './evidence-file-integrity';
import {
  DisclosureManifest,
  manifestHash,
  verifyDisclosureBundle,
} from './disclosure-manifest';
import { businessCredentialInvalidation } from '../../admin/case-authority.guard';

type Tx = Prisma.TransactionClient;
export interface EvidenceCommand {
  requestKey: string;
  expectedUpdatedAt: string;
  expectedAggregateUpdatedAt?: string;
  expectedRevision?: number;
  documentId?: string;
  tool?: string;
  toolVersion?: string;
  sourceHash?: string;
  evidenceId?: string;
  assetVersionId?: string;
  correctsEventId?: string;
  eventType?: string;
  occurredAt?: string;
  payload?: unknown;
  custodyFacts?: CustodyFacts;
  expectedCustodyEventId?: string | null;
  recipientId?: string;
  purpose?: string;
  basis?: string;
  expiresAt?: string;
  items?: Array<{
    assetVersionId: string;
    redaction?: unknown;
    contentPolicy?: 'PUBLIC_CONTENT_REVIEWED' | 'REDACTED_DERIVATIVE';
  }>;
  approve?: boolean;
  reason?: string;
  lawyerId?: string;
  subjectId?: string;
  granteeId?: string;
  capabilities?: string[];
  startsAt?: string;
  preserveUntil?: string;
  policyId?: string;
  assetVersionIds?: string[];
  outcome?: string;
  receipt?: unknown;
  deltaOfPacketId?: string;
}
const VERSION_KEYS = [
  'requestKey',
  'expectedUpdatedAt',
  'expectedAggregateUpdatedAt',
  'expectedRevision',
  'expectedCustodyEventId',
];
const GRANT_CAPABILITIES = [
  'list',
  'view',
  'download',
  'edit',
  'share',
  'dispose',
];
const PACKET_KEYS = [
  'recipientId',
  'purpose',
  'basis',
  'expiresAt',
  'items',
  'deltaOfPacketId',
];
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(canonicalJson(value)) as Prisma.InputJsonValue;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000)
    throw new BadRequestException(`${label} required`);
  return value.trim();
}
function instant(value: unknown, label: string): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    throw new BadRequestException(`${label} requires complete UTC timestamp`);
  const result = new Date(value);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw new BadRequestException(`${label} invalid`);
  return result;
}
function allowed(body: EvidenceCommand, keys: string[]): void {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Evidence command object required');
  canonicalJson(body);
  if (
    Object.keys(body).some((key) => ![...VERSION_KEYS, ...keys].includes(key))
  )
    throw new BadRequestException('Unsupported evidence command field');
  if (Object.hasOwn(body, 'items')) packetItems(body.items);
  if (Object.hasOwn(body, 'capabilities'))
    stringCollection(body.capabilities, 'Representation capabilities', 6);
  if (Object.hasOwn(body, 'assetVersionIds'))
    stringCollection(body.assetVersionIds, 'Disposition assets', 50);
}
function stringCollection(
  value: unknown,
  label: string,
  maximum: number,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > maximum ||
    value.some(
      (item) => typeof item !== 'string' || !item.trim() || item.length > 128,
    ) ||
    new Set(value).size !== value.length
  )
    throw new BadRequestException(
      `${label} requires bounded distinct string array`,
    );
}
function packetItems(value: unknown): void {
  if (!Array.isArray(value) || !value.length || value.length > 50)
    throw new BadRequestException(
      'Distinct nonempty packet items required (maximum 50)',
    );
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.getPrototypeOf(item) !== Object.prototype
    )
      throw new BadRequestException('Plain packet item object required');
    const row = item as Record<string, unknown>;
    if (
      typeof row.assetVersionId !== 'string' ||
      !row.assetVersionId.trim() ||
      row.assetVersionId.length > 128 ||
      Object.keys(row).some(
        (key) =>
          !['assetVersionId', 'redaction', 'contentPolicy'].includes(key),
      )
    )
      throw new BadRequestException('Valid packet item fields required');
  }
  if (
    new Set(
      value.map((item) => (item as { assetVersionId: string }).assetVersionId),
    ).size !== value.length
  )
    throw new BadRequestException('Distinct packet items required');
}
function revision(
  record: { revision: number; updatedAt?: Date },
  body: EvidenceCommand,
): void {
  if (
    !Number.isInteger(body.expectedRevision) ||
    record.revision !== body.expectedRevision
  )
    throw new ConflictException('Aggregate revision changed');
  if (
    body.expectedAggregateUpdatedAt &&
    record.updatedAt?.getTime() !==
      instant(body.expectedAggregateUpdatedAt, 'Aggregate version').getTime()
  )
    throw new ConflictException('Aggregate version changed');
}
function approval(record: {
  revision: number;
  contentHash: string;
  approvedRevision: number | null;
  approvedHash: string | null;
}): void {
  if (
    record.approvedRevision !== record.revision ||
    record.approvedHash !== record.contentHash
  )
    throw new ConflictException('Exact revision approval required');
}
@Injectable()
export class CaseEvidenceGovernanceService {
  async authorizeDocumentDownload(
    tx: Tx,
    caseId: string | null,
    documentId: string,
    actor: ActorContext,
  ): Promise<{ mode: CaseAccessMode; revision: number }> {
    const principal = await this.actorAccessPolicy(tx, actor);
    const bytePolicy = caseId
      ? await this.fields.byteFieldPolicySnapshot(tx, caseId, actor)
      : null;
    if (caseId)
      await this.governance.assertCaseAccessCapability(
        tx,
        caseId,
        actor,
        'download',
      );
    if (
      principal.mode === CaseAccessMode.INTERNAL &&
      !bytePolicy?.hasDeniedProtectedFields
    )
      return principal;
    if (!caseId)
      throw new ForbiddenException(
        'Representation disclosure requires exact owning Case',
      );
    const asset = await tx.caseAssetVersion.findUnique({
      where: { documentId },
    });
    if (!asset)
      throw new ForbiddenException(
        'Original requires reviewed registered disclosure content',
      );
    await this.authorizeAsset(tx, caseId, asset.id, actor, 'download');
    return principal;
  }
  async decisionSourceSnapshot(
    tx: Tx,
    caseId: string,
    documentId: string,
    actor: ActorContext,
    inspectionPurpose?: string,
  ): Promise<{
    documentId: string;
    caseId: string;
    documentUpdatedAt: string;
    sha256: string;
    byteLength: number;
    assetVersionId: string | null;
    parentVersionId: string | null;
    parentSha256: string | null;
    ownerCaseId: string;
    relationId: string | null;
    relationRevision: number | null;
  }> {
    if (inspectionPurpose)
      await this.governance.assertClassificationInspectable(
        tx,
        caseId,
        actor,
        inspectionPurpose,
      );
    else await this.governance.assertCaseReadable(tx, caseId, actor);
    const document = await tx.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document || !document.caseId)
      throw new NotFoundException('Owned legal source document required');
    if (inspectionPurpose && document.caseId !== caseId)
      throw new ForbiddenException(
        'Classification source inspection is exact same Case only',
      );
    const relation = inspectionPurpose
      ? null
      : await this.directRelation(tx, caseId, document.caseId, actor);
    const asset = await tx.caseAssetVersion.findUnique({
      where: { documentId },
    });
    if (asset) {
      if (inspectionPurpose) {
        if (
          asset.caseId !== caseId ||
          asset.documentUpdatedAt.getTime() !== document.updatedAt.getTime() ||
          asset.retiredAt
        )
          throw new ConflictException('Classification source snapshot changed');
      } else await this.authorizeAsset(tx, caseId, asset.id, actor, 'view');
    }
    const file = await openEvidenceFile(
      this.uploadRoot,
      document.fileName,
      asset?.sha256,
    );
    try {
      if (file.byteLength !== document.size)
        throw new ConflictException('Legal source size changed');
      const latest = await tx.document.findFirst({
        where: { id: documentId, caseId: document.caseId, deletedAt: null },
      });
      if (
        !latest ||
        latest.updatedAt.getTime() !== document.updatedAt.getTime() ||
        latest.fileName !== document.fileName
      )
        throw new ConflictException('Legal source version changed');
      if (inspectionPurpose)
        await this.governance.assertClassificationInspectable(
          tx,
          caseId,
          actor,
          inspectionPurpose,
        );
      else await this.governance.assertCaseReadable(tx, caseId, actor);
      const latestRelation = inspectionPurpose
        ? null
        : await this.directRelation(tx, caseId, document.caseId, actor);
      if (
        latestRelation?.id !== relation?.id ||
        latestRelation?.revision !== relation?.revision
      )
        throw new ConflictException('Legal source relation changed');
      if (asset && !inspectionPurpose)
        await this.authorizeAsset(tx, caseId, asset.id, actor, 'view');
      return {
        documentId,
        caseId,
        documentUpdatedAt: document.updatedAt.toISOString(),
        sha256: file.sha256,
        byteLength: file.byteLength,
        assetVersionId: asset?.id ?? null,
        parentVersionId: asset?.parentVersionId ?? null,
        parentSha256: asset?.parentSha256 ?? null,
        ownerCaseId: document.caseId,
        relationId: relation?.id ?? null,
        relationRevision: relation?.revision ?? null,
      };
    } finally {
      await file.handle.close();
    }
  }
  readonly uploadRoot = join(process.cwd(), 'uploads', 'documents');
  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: CaseGovernanceService,
    private readonly fields: CaseFieldSchemaService,
  ) {}
  private async capability(
    tx: Tx,
    actor: ActorContext,
    capability: string,
  ): Promise<void> {
    if (!(await this.governance.hasCapability(tx, actor.actorId, capability)))
      throw new ForbiddenException(
        `Explicit evidence ${capability} capability required`,
      );
  }
  private async mutate<T>(
    caseId: string,
    operation: string,
    body: EvidenceCommand,
    actor: ActorContext,
    capability: string,
    handler: (tx: Tx) => Promise<T>,
    targetId?: string,
  ) {
    const { requestKey, expectedUpdatedAt, expectedAggregateUpdatedAt } = body;
    const payload: Record<string, unknown> = { ...body };
    for (const key of VERSION_KEYS) delete payload[key];
    if (operation.startsWith('EVIDENCE_PACKET_')) {
      await this.governance.assertCaseReadable(this.prisma, caseId, actor);
      const ids = Array.isArray(body.items)
        ? body.items.map((item) => item.assetVersionId)
        : targetId
          ? (
              await this.prisma.caseDisclosurePacketItem.findMany({
                where: { packetId: targetId, packet: { caseId } },
              })
            ).map((item) => item.assetVersionId)
          : [];
      for (const id of ids) {
        const source = await this.prisma.caseAssetVersion.findFirst({
          where: { id },
        });
        if (!source) throw new NotFoundException('Packet asset not found');
        await this.directRelation(this.prisma, caseId, source.caseId, actor);
      }
    }
    return this.governance.mutateCase(
      {
        caseId,
        operation,
        requestKey,
        expectedUpdatedAt,
        expectedAggregateUpdatedAt,
        payload: { targetId: targetId ?? null, content: payload },
      },
      actor,
      async (tx, context) => {
        await this.capability(tx, actor, capability);
        const data = await handler(tx);
        const event = json({
          operation,
          aggregateId: (data as { id?: string })?.id ?? null,
        });
        await tx.caseGovernanceEvent.create({
          data: {
            caseId,
            operationId: context.operationId,
            actorId: actor.actorId,
            type: operation,
            payload: event,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actor.actorId,
            action: operation,
            subject: 'CaseEvidenceGovernance',
            subjectId: caseId,
            metadata: event,
          },
        });
        await this.governance.enqueue(
          tx,
          caseId,
          context.operationId,
          event,
          context.caseRecord.investigatorId
            ? [context.caseRecord.investigatorId]
            : [],
        );
        return { success: true, data };
      },
    );
  }
  private async asset(
    tx: Tx,
    caseId: string,
    assetId: string,
  ): Promise<CaseAssetVersion> {
    const value = await tx.caseAssetVersion.findFirst({
      where: { id: assetId, caseId },
    });
    if (!value) throw new NotFoundException('Asset version not found');
    return value;
  }
  private async directRelation(
    tx: Tx,
    caseId: string,
    ownerCaseId: string,
    actor: ActorContext,
    access: 'view' | 'download' | 'share' | 'edit' | 'dispose' = 'view',
  ): Promise<CaseRelation | null> {
    if (access !== 'view')
      await this.governance.assertCaseAccessCapability(
        tx,
        caseId,
        actor,
        access,
      );
    else await this.governance.assertCaseReadable(tx, caseId, actor);
    if (caseId === ownerCaseId) return null;
    if (access !== 'view')
      await this.governance.assertCaseAccessCapability(
        tx,
        ownerCaseId,
        actor,
        access,
      );
    else await this.governance.assertCaseReadable(tx, ownerCaseId, actor);
    const relation = await tx.caseRelation.findFirst({
      where: {
        revokedAt: null,
        deletedAt: null,
        type: { in: ['RELATED', 'MERGE', 'SPLIT', 'TRANSFER'] },
        OR: [
          { sourceCaseId: caseId, targetCaseId: ownerCaseId },
          { sourceCaseId: ownerCaseId, targetCaseId: caseId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !relation ||
      relation.revokedAt ||
      relation.deletedAt ||
      !['RELATED', 'MERGE', 'SPLIT', 'TRANSFER'].includes(relation.type) ||
      !(
        (relation.sourceCaseId === caseId &&
          relation.targetCaseId === ownerCaseId) ||
        (relation.sourceCaseId === ownerCaseId &&
          relation.targetCaseId === caseId)
      )
    )
      throw new ForbiddenException(
        'Active direct authorized case relation required',
      );
    return relation;
  }
  private async noHold(
    tx: Tx,
    caseId: string,
    assetIds?: string[],
  ): Promise<void> {
    const hold = await tx.caseEvidenceHold.findFirst({
      where: {
        caseId,
        releasedAt: null,
        ...(assetIds
          ? {
              OR: [
                { assetVersionId: null },
                { assetVersionId: { in: assetIds } },
              ],
            }
          : {}),
      },
    });
    if (hold)
      throw new ConflictException(
        'Active evidence hold protects this operation',
      );
  }
  private async representation(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    action: string,
  ) {
    const principal = await this.actorAccessPolicy(tx, actor);
    if (principal.mode === CaseAccessMode.INTERNAL) return null;
    const grants = await tx.caseRepresentationGrant.findMany({
      where: { caseId, granteeId: actor.actorId },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    for (const grant of grants) {
      if (
        grant.caseId !== caseId ||
        grant.revokedAt ||
        grant.startsAt > now ||
        grant.expiresAt <= now ||
        !Array.isArray(grant.capabilities) ||
        !grant.capabilities.includes(action)
      )
        continue;
      const lawyer = await tx.lawyer.findFirst({
        where: { id: grant.lawyerId, caseId, deletedAt: null },
      });
      if (!lawyer || lawyer.subjectId !== grant.subjectId) continue;
      if (
        grant.subjectId &&
        !(await tx.subject.findFirst({
          where: { id: grant.subjectId, caseId, deletedAt: null },
        }))
      )
        continue;
      return grant;
    }
    throw new ForbiddenException(
      `Active case representation ${action} grant required`,
    );
  }
  private async actorAccessPolicy(tx: Tx, actor: ActorContext) {
    const principal = await tx.user.findUnique({
      where: { id: actor.actorId },
      select: {
        isActive: true,
        caseAccessMode: true,
        caseAccessRevision: true,
      },
    });
    if (
      !principal?.isActive ||
      ![CaseAccessMode.INTERNAL, CaseAccessMode.REPRESENTATION_ONLY].includes(
        principal.caseAccessMode,
      )
    )
      throw new ForbiddenException(
        'Active explicit case access principal required',
      );
    return {
      mode: principal.caseAccessMode,
      revision: principal.caseAccessRevision,
    };
  }
  private async assetEntitlement(
    tx: Tx,
    caseId: string,
    assetId: string,
    actor: ActorContext,
    action: 'view' | 'download' | 'share' | 'edit' | 'dispose' = 'view',
  ) {
    if (action !== 'view')
      await this.governance.assertCaseAccessCapability(
        tx,
        caseId,
        actor,
        action,
      );
    else await this.governance.assertCaseReadable(tx, caseId, actor);
    if (action !== 'view')
      await this.capability(
        tx,
        actor,
        {
          download: 'download',
          share: 'share',
          edit: 'operate',
          dispose: 'dispose',
        }[action],
      );
    const asset = await tx.caseAssetVersion.findFirst({
      where: { id: assetId },
    });
    if (!asset) throw new NotFoundException('Asset version not found');
    const relation = await this.directRelation(
      tx,
      caseId,
      asset.caseId,
      actor,
      action,
    );
    const requestGrant = await this.representation(tx, caseId, actor, action);
    const ownerGrant =
      asset.caseId === caseId
        ? requestGrant
        : await this.representation(tx, asset.caseId, actor, action);
    const grant = requestGrant ?? ownerGrant;
    if (asset.retiredAt)
      throw new ConflictException('Asset retired by approved disposition');
    if (action === 'dispose' && asset.caseId !== caseId)
      throw new ForbiddenException('Disposition requires original owning Case');
    if (action === 'dispose') await this.noHold(tx, asset.caseId, [assetId]);
    const document = await tx.document.findFirst({
      where: { id: asset.documentId, caseId: asset.caseId, deletedAt: null },
    });
    if (
      !document ||
      document.updatedAt.getTime() !== asset.documentUpdatedAt.getTime()
    )
      throw new ConflictException(
        'Registered document ownership/version changed',
      );
    const principal = await this.actorAccessPolicy(tx, actor);
    const bytePolicy = await this.fields.byteFieldPolicySnapshot(
      tx,
      asset.caseId,
      actor,
    );
    return {
      asset,
      document,
      grant,
      ownerGrant,
      requestGrant,
      relation,
      principal,
      bytePolicy,
    };
  }
  async authorizeAsset(
    tx: Tx,
    caseId: string,
    assetId: string,
    actor: ActorContext,
    action: 'view' | 'download' | 'share' | 'edit' | 'dispose' = 'view',
  ) {
    const checked = await this.assetEntitlement(
      tx,
      caseId,
      assetId,
      actor,
      action,
    );
    if (
      action === 'download' &&
      (checked.grant || checked.bytePolicy.hasDeniedProtectedFields)
    ) {
      const items = await tx.caseDisclosurePacketItem.findMany({
        where: {
          assetVersionId: assetId,
          packet: {
            recipientId: actor.actorId,
            status: 'APPROVED',
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
        include: { packet: true },
      });
      let authorized = false;
      for (const item of items) {
        const packet = item.packet;
        if (
          packet.approvedRevision !== packet.revision ||
          packet.approvedHash !== packet.contentHash ||
          item.sha256 !== checked.asset.sha256
        )
          continue;
        try {
          await this.validatePacket(tx, packet, actor, 'download');
        } catch (error) {
          if (
            error instanceof ForbiddenException ||
            error instanceof ConflictException ||
            error instanceof NotFoundException
          )
            continue;
          throw error;
        }
        if (
          manifestHash(await this.packetManifest(tx, packet)) !==
          packet.approvedHash
        )
          continue;
        if (
          checked.bytePolicy.hasDeniedProtectedFields &&
          !(await this.contentPolicyApproved(
            tx,
            packet,
            item,
            checked.bytePolicy,
          ))
        )
          continue;
        authorized = true;
        break;
      }
      if (!authorized)
        throw new ForbiddenException(
          'Approved exact disclosure packet item required for representation download',
        );
    }
    return checked;
  }
  private async contentPolicyApproved(
    tx: Tx,
    packet: CaseDisclosurePacket,
    item: { assetVersionId: string; sha256: string; lineage: Prisma.JsonValue },
    policy: Awaited<
      ReturnType<CaseFieldSchemaService['byteFieldPolicySnapshot']>
    >,
  ) {
    const lineage = item.lineage as {
      contentPolicy?: string;
      fieldPolicyHash?: string;
      fieldDefinitionVersionId?: string | null;
    };
    if (
      !['PUBLIC_CONTENT_REVIEWED', 'REDACTED_DERIVATIVE'].includes(
        lineage.contentPolicy ?? '',
      ) ||
      lineage.fieldPolicyHash !== policy.definitionHash ||
      (lineage.fieldDefinitionVersionId ?? null) !==
        policy.definitionVersionId ||
      !packet.reviewedById
    )
      return false;
    const event = await tx.caseGovernanceEvent.findFirst({
      where: {
        caseId: packet.caseId,
        type: 'EVIDENCE_CONTENT_POLICY_APPROVED',
        actorId: packet.reviewedById,
        payload: { path: ['packetId'], equals: packet.id },
      },
      orderBy: { createdAt: 'desc' },
    });
    const proof = event?.payload as
      | {
          revision?: number;
          contentHash?: string;
          items?: Array<{
            assetVersionId: string;
            sha256: string;
            fieldPolicyHash: string;
            definitionVersionId: string | null;
          }>;
        }
      | undefined;
    return !!(
      proof &&
      proof.revision === packet.revision &&
      proof.contentHash === packet.approvedHash &&
      proof.items?.some(
        (row) =>
          row.assetVersionId === item.assetVersionId &&
          row.sha256 === item.sha256 &&
          row.fieldPolicyHash === policy.definitionHash &&
          row.definitionVersionId === policy.definitionVersionId,
      )
    );
  }
  async verifiedAsset(
    caseId: string,
    assetId: string,
    actor: ActorContext,
    action: 'view' | 'download' | 'share' = 'download',
  ): Promise<VerifiedEvidenceFile> {
    const before = await this.authorizeAsset(
      this.prisma,
      caseId,
      assetId,
      actor,
      action,
    );
    const file = await openEvidenceFile(
      this.uploadRoot,
      before.document.fileName,
      before.asset.sha256,
    );
    try {
      const after = await this.authorizeAsset(
        this.prisma,
        caseId,
        assetId,
        actor,
        action,
      );
      if (
        after.asset.documentId !== before.asset.documentId ||
        after.document.fileName !== before.document.fileName ||
        after.grant?.id !== before.grant?.id ||
        after.grant?.revision !== before.grant?.revision ||
        after.ownerGrant?.id !== before.ownerGrant?.id ||
        after.ownerGrant?.revision !== before.ownerGrant?.revision ||
        after.relation?.id !== before.relation?.id ||
        after.relation?.revision !== before.relation?.revision ||
        after.principal.mode !== before.principal.mode ||
        after.principal.revision !== before.principal.revision ||
        after.bytePolicy.definitionVersionId !==
          before.bytePolicy.definitionVersionId ||
        after.bytePolicy.definitionHash !== before.bytePolicy.definitionHash ||
        after.bytePolicy.hasDeniedProtectedFields !==
          before.bytePolicy.hasDeniedProtectedFields ||
        file.byteLength !== before.asset.byteLength
      )
        throw new ConflictException(
          'Asset authorization changed before hydration',
        );
      return file;
    } catch (error) {
      await file.handle.close();
      throw error;
    }
  }
  async registerAsset(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
    parentId?: string,
  ) {
    allowed(body, [
      'documentId',
      ...(parentId ? ['tool', 'toolVersion', 'sourceHash'] : []),
    ]);
    return this.mutate(
      caseId,
      parentId ? 'EVIDENCE_DERIVATIVE_REGISTER' : 'EVIDENCE_ASSET_REGISTER',
      body,
      actor,
      'operate',
      async (tx) => {
        const document = await tx.document.findFirst({
          where: { id: text(body.documentId, 'Document'), deletedAt: null },
        });
        if (!document) throw new NotFoundException('Document not found');
        if (document.caseId !== caseId)
          throw new ForbiddenException('Document belongs to another parent');
        if (
          await tx.caseAssetVersion.findUnique({
            where: { documentId: document.id },
          })
        )
          throw new ConflictException(
            'Document already registered as immutable asset',
          );
        let parent: CaseAssetVersion | null = null;
        if (parentId) {
          const source = await this.authorizeAsset(
            tx,
            caseId,
            parentId,
            actor,
            'view',
          );
          parent = source.asset;
          if (parent.caseId !== caseId)
            throw new ForbiddenException(
              'Register derivative under original owning Case',
            );
          text(body.tool, 'Derivative tool');
          text(body.toolVersion, 'Tool version');
          if (body.sourceHash !== parent.sha256)
            throw new ConflictException(
              'Derivative exact parent source hash required',
            );
          const sourceFile = await openEvidenceFile(
            this.uploadRoot,
            source.document.fileName,
            parent.sha256,
          );
          try {
            if (sourceFile.byteLength !== parent.byteLength)
              throw new ConflictException('Derivative parent size changed');
          } finally {
            await sourceFile.handle.close();
          }
        }
        const file = await openEvidenceFile(this.uploadRoot, document.fileName);
        try {
          if (file.byteLength !== document.size)
            throw new ConflictException('Document size changed');
          return await tx.caseAssetVersion.create({
            data: {
              caseId,
              documentId: document.id,
              kind: parent ? 'DERIVATIVE' : 'ORIGINAL',
              sha256: file.sha256,
              byteLength: file.byteLength,
              documentUpdatedAt: document.updatedAt,
              parentVersionId: parent?.id,
              parentSha256: parent?.sha256,
              tool: body.tool,
              toolVersion: body.toolVersion,
              sourceHash: body.sourceHash,
              createdById: actor.actorId,
            },
          });
        } finally {
          await file.handle.close();
        }
      },
      parentId,
    );
  }
  async verifyAsset(caseId: string, assetId: string, actor: ActorContext) {
    const file = await this.verifiedAsset(caseId, assetId, actor, 'view');
    try {
      return {
        success: true,
        data: {
          assetVersionId: assetId,
          sha256: file.sha256,
          byteLength: file.byteLength,
          integrityVerified: true,
          legalSignatureVerified: false,
        },
      };
    } finally {
      await file.handle.close();
    }
  }
  async appendCustody(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, [
      'evidenceId',
      'assetVersionId',
      'correctsEventId',
      'eventType',
      'occurredAt',
      'payload',
      'custodyFacts',
    ]);
    return this.mutate(
      caseId,
      'EVIDENCE_CUSTODY_APPEND',
      body,
      actor,
      'custody',
      async (tx) => {
        if (
          (!body.evidenceId && !body.assetVersionId) ||
          (body.evidenceId && body.assetVersionId)
        )
          throw new BadRequestException(
            'Exactly one physical evidence or file asset required',
          );
        if (
          body.evidenceId &&
          !(await tx.evidence.findFirst({
            where: { id: body.evidenceId, caseId, deletedAt: null },
          }))
        )
          throw new NotFoundException('Physical evidence not found');
        if (body.assetVersionId) {
          const owned = await this.authorizeAsset(
            tx,
            caseId,
            body.assetVersionId,
            actor,
            'view',
          );
          if (owned.asset.caseId !== caseId)
            throw new ForbiddenException(
              'Custody event belongs to original owning Case',
            );
        }
        const occurredAt = instant(body.occurredAt, 'Custody occurrence');
        if (occurredAt > new Date())
          throw new BadRequestException('Future custody event forbidden');
        const eventType = text(body.eventType, 'Custody event type');
        if (!Object.hasOwn(body, 'expectedCustodyEventId'))
          throw new BadRequestException('Expected custody chain head required');
        const entity = {
          caseId,
          evidenceId: body.evidenceId ?? null,
          assetVersionId: body.assetVersionId ?? null,
        };
        const latest = await tx.caseCustodyEvent.findFirst({
          where: entity,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        if ((latest?.id ?? null) !== body.expectedCustodyEventId)
          throw new ConflictException('Custody chain version changed');
        if (body.correctsEventId) {
          const original = await tx.caseCustodyEvent.findFirst({
            where: { id: body.correctsEventId, caseId },
          });
          if (
            !original ||
            original.evidenceId !== (body.evidenceId ?? null) ||
            original.assetVersionId !== (body.assetVersionId ?? null)
          )
            throw new ConflictException(
              'Correction must reference exact evidence history',
            );
          if (eventType !== 'CORRECTION')
            throw new BadRequestException('Correction event type required');
        } else if (eventType === 'CORRECTION')
          throw new BadRequestException('Correction target required');
        if (eventType === 'CORRECTION' && body.correctsEventId !== latest?.id)
          throw new ConflictException(
            'Correct current chain head; earlier events remain historical',
          );
        if (body.custodyFacts && body.payload !== undefined)
          throw new BadRequestException(
            'Use one structured custody facts source',
          );
        const previousPayload = latest?.payload as
          | { currentCustody?: CustodyState; version?: number }
          | undefined;
        const validated = validateCustodyFacts(
          eventType,
          body.custodyFacts ?? body.payload,
          previousPayload?.currentCustody ?? null,
        );
        const sourceSnapshot = await this.decisionSourceSnapshot(
          tx,
          caseId,
          validated.facts.receiptDocumentId,
          actor,
        );
        if (sourceSnapshot.ownerCaseId !== caseId)
          throw new ForbiddenException(
            'Custody receipt must belong to original Case',
          );
        const version =
          (previousPayload?.version ??
            (await tx.caseCustodyEvent.count({ where: entity }))) + 1;
        return tx.caseCustodyEvent.create({
          data: {
            caseId,
            evidenceId: body.evidenceId,
            assetVersionId: body.assetVersionId,
            correctsEventId: body.correctsEventId,
            actorId: actor.actorId,
            eventType,
            occurredAt,
            sourceDocumentId: sourceSnapshot.documentId,
            sourceDocumentUpdatedAt: new Date(sourceSnapshot.documentUpdatedAt),
            payload: json({
              version,
              previousEventId: latest?.id ?? null,
              facts: validated.facts,
              currentCustody: validated.currentCustody,
              sourceSnapshot,
            }),
          },
        });
      },
    );
  }
  private async packet(tx: Tx, caseId: string, packetId: string) {
    const packet = await tx.caseDisclosurePacket.findFirst({
      where: { id: packetId, caseId },
    });
    if (!packet) throw new NotFoundException('Packet not found');
    return packet;
  }
  private async packetManifest(
    tx: Tx,
    packet: CaseDisclosurePacket,
  ): Promise<DisclosureManifest> {
    const items = await tx.caseDisclosurePacketItem.findMany({
      where: { packetId: packet.id },
      orderBy: { assetVersionId: 'asc' },
    });
    return {
      schemaVersion: 1,
      packetId: packet.id,
      caseId: packet.caseId,
      revision: packet.revision,
      deltaOfPacketId: packet.deltaOfPacketId,
      recipientId: packet.recipientId,
      recipientPolicy: packet.recipientPolicy,
      purpose: packet.purpose,
      basis: packet.basis,
      expiresAt: packet.expiresAt.toISOString(),
      items: await Promise.all(
        items.map(async (item) => {
          const asset = await tx.caseAssetVersion.findFirst({
            where: { id: item.assetVersionId },
          });
          if (!asset)
            throw new ConflictException('Packet immutable asset missing');
          return {
            assetVersionId: asset.id,
            documentId: asset.documentId,
            ownerCaseId: asset.caseId,
            relationId: item.relationId ?? null,
            relationRevision: item.relationRevision ?? null,
            sha256: item.sha256,
            byteLength: asset.byteLength,
            redaction: item.redaction,
            lineage: item.lineage,
          };
        }),
      ),
    };
  }
  async reviewPacket(
    caseId: string,
    packetId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, ['approve']);
    return this.mutate(
      caseId,
      'EVIDENCE_PACKET_REVIEW',
      body,
      actor,
      'review',
      async (tx) => {
        const packet = await this.packet(tx, caseId, packetId);
        revision(packet, body);
        if (packet.authorId === actor.actorId)
          throw new ForbiddenException('Packet maker cannot review own packet');
        if (packet.status !== 'SUBMITTED' || packet.revokedAt)
          throw new ConflictException('Submitted packet required');
        if (typeof body.approve !== 'boolean')
          throw new BadRequestException('Review decision required');
        if (body.approve) {
          const reviewedItems = await this.validatePacket(tx, packet, actor);
          const proofs: Array<{
            assetVersionId: string;
            sha256: string;
            definitionVersionId: string | null;
            fieldPolicyHash: string;
            contentPolicy: string;
          }> = [];
          for (const item of reviewedItems) {
            const lineage = item.lineage as {
              contentPolicy?: string | null;
              fieldPolicyHash?: string;
              fieldDefinitionVersionId?: string | null;
            };
            if (lineage.contentPolicy) {
              const asset = await tx.caseAssetVersion.findFirstOrThrow({
                where: { id: item.assetVersionId },
              });
              const policy = await this.fields.byteFieldPolicySnapshot(
                tx,
                asset.caseId,
                actor,
              );
              if (policy.hasDeniedProtectedFields)
                throw new ForbiddenException(
                  'Content reviewer must have actual protected-field authority',
                );
              if (
                lineage.fieldPolicyHash !== policy.definitionHash ||
                (lineage.fieldDefinitionVersionId ?? null) !==
                  policy.definitionVersionId
              )
                throw new ConflictException('Reviewed field policy changed');
              proofs.push({
                assetVersionId: asset.id,
                sha256: item.sha256,
                definitionVersionId: policy.definitionVersionId,
                fieldPolicyHash: policy.definitionHash,
                contentPolicy: lineage.contentPolicy,
              });
            }
          }
          if (
            manifestHash(await this.packetManifest(tx, packet)) !==
            packet.contentHash
          )
            throw new ConflictException('Packet content changed');
          if (proofs.length) {
            const operation = await tx.caseGovernanceOperation.findFirstOrThrow(
              {
                where: {
                  actorId: actor.actorId,
                  caseId,
                  operation: 'EVIDENCE_PACKET_REVIEW',
                  requestKey: body.requestKey,
                },
              },
            );
            await tx.caseGovernanceEvent.create({
              data: {
                caseId,
                operationId: operation.id,
                actorId: actor.actorId,
                type: 'EVIDENCE_CONTENT_POLICY_APPROVED',
                payload: json({
                  packetId: packet.id,
                  revision: packet.revision,
                  contentHash: packet.contentHash,
                  items: proofs,
                }),
              },
            });
          }
        }
        return tx.caseDisclosurePacket.update({
          where: { id: packet.id, revision: packet.revision },
          data: {
            status: body.approve ? 'APPROVED' : 'REJECTED',
            reviewedById: actor.actorId,
            reviewedAt: new Date(),
            approvedRevision: body.approve ? packet.revision : null,
            approvedHash: body.approve ? packet.contentHash : null,
          },
        });
      },
      packetId,
    );
  }
  private async validatePacket(
    tx: Tx,
    packet: CaseDisclosurePacket,
    actor: ActorContext,
    actorAccess: 'view' | 'download' | 'share' = 'view',
  ) {
    if (packet.revokedAt || packet.expiresAt <= new Date())
      throw new ForbiddenException('Packet revoked or expired');
    const recipient: ActorContext = { actorId: packet.recipientId };
    await this.governance.assertCaseAccessCapability(
      tx,
      packet.caseId,
      recipient,
      'download',
    );
    await this.capability(tx, recipient, 'download');
    const grant = await this.representation(
      tx,
      packet.caseId,
      recipient,
      'download',
    );
    const expected = packet.recipientPolicy as {
      grantId?: string;
      grantRevision?: number;
      mode?: CaseAccessMode;
      accessRevision?: number;
    } | null;
    const principal = await this.actorAccessPolicy(tx, recipient);
    if (
      expected?.mode !== principal.mode ||
      expected.accessRevision !== principal.revision
    )
      throw new ForbiddenException('Packet recipient access mode changed');
    if (
      (expected?.grantId ?? null) !== (grant?.id ?? null) ||
      (expected?.grantRevision ?? null) !== (grant?.revision ?? null)
    )
      throw new ForbiddenException('Packet recipient policy/grant changed');
    const items = await tx.caseDisclosurePacketItem.findMany({
      where: { packetId: packet.id },
    });
    if (!items.length) throw new BadRequestException('Packet items required');
    for (const item of items) {
      const current = await this.assetEntitlement(
        tx,
        packet.caseId,
        item.assetVersionId,
        actor,
        actorAccess,
      );
      const entitlement = await this.assetEntitlement(
        tx,
        packet.caseId,
        item.assetVersionId,
        recipient,
        'download',
      );
      if (
        (item.relationId ?? null) !== (current.relation?.id ?? null) ||
        (item.relationRevision ?? null) !== (current.relation?.revision ?? null)
      )
        throw new ConflictException('Packet direct relation version changed');
      const ownerPolicy = item.lineage as {
        ownerCaseId?: string;
        ownerGrantId?: string | null;
        ownerGrantRevision?: number | null;
        fieldPolicyHash?: string;
        fieldDefinitionVersionId?: string | null;
        contentPolicy?: string | null;
      };
      if (
        (ownerPolicy.ownerCaseId ?? current.asset.caseId) !==
          current.asset.caseId ||
        (ownerPolicy.ownerGrantId ?? null) !==
          (entitlement.ownerGrant?.id ?? null) ||
        (ownerPolicy.ownerGrantRevision ?? null) !==
          (entitlement.ownerGrant?.revision ?? null)
      )
        throw new ForbiddenException('Packet owner scope/grant policy changed');
      if (
        ownerPolicy.fieldPolicyHash !== current.bytePolicy.definitionHash ||
        (ownerPolicy.fieldDefinitionVersionId ?? null) !==
          current.bytePolicy.definitionVersionId ||
        (item.fieldDefinitionVersionId ?? null) !==
          current.bytePolicy.definitionVersionId
      )
        throw new ConflictException('Packet pinned field policy changed');
      if (entitlement.bytePolicy.hasDeniedProtectedFields) {
        if (
          !['PUBLIC_CONTENT_REVIEWED', 'REDACTED_DERIVATIVE'].includes(
            ownerPolicy.contentPolicy ?? '',
          )
        )
          throw new ForbiddenException(
            'Protected original requires reviewed authorized disclosure content',
          );
        if (
          packet.status === 'APPROVED' &&
          !(await this.contentPolicyApproved(
            tx,
            packet,
            item,
            entitlement.bytePolicy,
          ))
        )
          throw new ForbiddenException(
            'Exact sensitive-authorized content review proof required',
          );
      }
      if (current.asset.sha256 !== item.sha256)
        throw new ConflictException('Packet item version hash changed');
    }
    return items;
  }
  async eligibility(caseId: string, actor: ActorContext) {
    await this.governance.assertCaseReadable(this.prisma, caseId, actor);
    await this.capability(this.prisma, actor, 'dispose');
    const policy = await this.prisma.caseRetentionPolicy.findFirst({
      where: { caseId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });
    if (!policy)
      return {
        success: true,
        data: {
          eligible: false,
          reason: 'NO_PUBLISHED_POLICY',
          preserve: true,
        },
      };
    approval(policy);
    const hold = await this.prisma.caseEvidenceHold.findFirst({
      where: { caseId, releasedAt: null },
    });
    return {
      success: true,
      data: {
        policyId: policy.id,
        policyRevision: policy.revision,
        eligible: !hold && policy.preserveUntil <= new Date(),
        reason: hold
          ? 'ACTIVE_HOLD'
          : policy.preserveUntil > new Date()
            ? 'RETENTION_NOT_DUE'
            : 'ELIGIBLE_REQUIRES_APPROVED_DISPOSITION',
        preserve: true,
      },
    };
  }
  async addRepresentation(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, [
      'lawyerId',
      'subjectId',
      'granteeId',
      'capabilities',
      'startsAt',
      'expiresAt',
    ]);
    return this.mutate(
      caseId,
      'EVIDENCE_REPRESENTATION_ADD',
      body,
      actor,
      'operate',
      async (tx) => {
        const lawyer = await tx.lawyer.findFirst({
          where: { id: text(body.lawyerId, 'Lawyer'), deletedAt: null },
        });
        if (!lawyer || lawyer.caseId !== caseId)
          throw new ForbiddenException('Lawyer belongs to another case');
        if ((body.subjectId ?? null) !== lawyer.subjectId)
          throw new BadRequestException(
            'Representation subject must match lawyer record',
          );
        if (
          body.subjectId &&
          !(await tx.subject.findFirst({
            where: { id: body.subjectId, caseId, deletedAt: null },
          }))
        )
          throw new NotFoundException('Represented subject not found');
        const startsAt = instant(body.startsAt, 'Grant start'),
          expiresAt = instant(body.expiresAt, 'Grant expiry');
        if (expiresAt <= startsAt || expiresAt <= new Date())
          throw new BadRequestException('Bounded future grant expiry required');
        if (
          !body.capabilities?.length ||
          body.capabilities.some((cap) => !GRANT_CAPABILITIES.includes(cap)) ||
          new Set(body.capabilities).size !== body.capabilities.length
        )
          throw new BadRequestException(
            'Distinct representation capabilities required',
          );
        const granteeId = text(body.granteeId, 'Grantee');
        const grantee = await tx.user.findFirst({
            where: { id: granteeId, isActive: true },
          });
        if (!grantee)
          throw new NotFoundException('Active grantee required');
        await this.governance.assertBaseCaseReadable(tx, caseId, {
          actorId: granteeId,
        });
        await tx.user.update({
          where: { id: granteeId },
          data: await businessCredentialInvalidation(
            !!grantee.enrollmentTokenHash || grantee.mustChangePassword,
          ),
        });
        return tx.caseRepresentationGrant.create({
          data: {
            caseId,
            lawyerId: lawyer.id,
            subjectId: body.subjectId,
            granteeId,
            capabilities: json(body.capabilities),
            startsAt,
            expiresAt,
            createdById: actor.actorId,
          },
        });
      },
    );
  }
  async createDisposition(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, ['policyId', 'assetVersionIds', 'purpose']);
    return this.mutate(
      caseId,
      'EVIDENCE_DISPOSITION_CREATE',
      body,
      actor,
      'dispose',
      async (tx) => {
        const policy = await tx.caseRetentionPolicy.findFirst({
          where: {
            id: text(body.policyId, 'Retention policy'),
            caseId,
            status: 'PUBLISHED',
          },
        });
        if (!policy)
          throw new ConflictException('Published retention policy required');
        approval(policy);
        if (policy.preserveUntil > new Date())
          throw new ConflictException('Retention is not due');
        await this.noHold(tx, caseId, body.assetVersionIds);
        if (
          !body.assetVersionIds?.length ||
          new Set(body.assetVersionIds).size !== body.assetVersionIds.length
        )
          throw new BadRequestException('Distinct disposition assets required');
        for (const id of body.assetVersionIds)
          await this.authorizeAsset(tx, caseId, id, actor, 'dispose');
        const purpose = text(body.purpose, 'Disposition purpose');
        return tx.caseDispositionRequest.create({
          data: {
            caseId,
            policyId: policy.id,
            authorId: actor.actorId,
            assetVersionIds: json(body.assetVersionIds),
            purpose,
            contentHash: manifestHash({
              caseId,
              policyId: policy.id,
              policyHash: policy.contentHash,
              assetVersionIds: body.assetVersionIds,
              purpose,
            }),
          },
        });
      },
    );
  }
  private async packetData(
    tx: Tx,
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 50 ||
      new Set(body.items.map((item) => item.assetVersionId)).size !==
        body.items.length
    )
      throw new BadRequestException(
        'Distinct nonempty packet items required (maximum 50)',
      );
    const expiresAt = instant(body.expiresAt, 'Packet expiry');
    if (expiresAt <= new Date())
      throw new BadRequestException('Future packet expiry required');
    const recipientId = text(body.recipientId, 'Recipient');
    const recipient = { actorId: recipientId };
    await this.governance.assertCaseAccessCapability(
      tx,
      caseId,
      recipient,
      'download',
    );
    await this.capability(tx, recipient, 'download');
    const grant = await this.representation(tx, caseId, recipient, 'download');
    if (grant && expiresAt > grant.expiresAt)
      throw new BadRequestException(
        'Packet expiry cannot exceed representation grant',
      );
    const items = [] as Array<{
      assetVersionId: string;
      sha256: string;
      redaction?: Prisma.InputJsonValue;
      lineage: Prisma.InputJsonValue;
      relationId: string | null;
      relationRevision: number | null;
      fieldDefinitionVersionId: string | null;
    }>;
    let bytes = 0;
    for (const item of body.items) {
      if (
        Object.keys(item).some(
          (key) =>
            !['assetVersionId', 'redaction', 'contentPolicy'].includes(key),
        )
      )
        throw new BadRequestException('Unsupported packet item field');
      const checked = await this.authorizeAsset(
        tx,
        caseId,
        text(item.assetVersionId, 'Packet asset'),
        actor,
        'view',
      );
      const asset = checked.asset;
      if (
        item.contentPolicy &&
        !['PUBLIC_CONTENT_REVIEWED', 'REDACTED_DERIVATIVE'].includes(
          item.contentPolicy,
        )
      )
        throw new BadRequestException(
          'Explicit reviewed content policy required',
        );
      if (
        item.contentPolicy === 'REDACTED_DERIVATIVE' &&
        asset.kind !== 'DERIVATIVE'
      )
        throw new BadRequestException(
          'Redacted content requires registered derivative lineage',
        );
      const entitlement = await this.assetEntitlement(
        tx,
        caseId,
        asset.id,
        recipient,
        'download',
      );
      if (
        entitlement.ownerGrant &&
        expiresAt > entitlement.ownerGrant.expiresAt
      )
        throw new BadRequestException(
          'Packet expiry exceeds owner representation grant',
        );
      if (item.redaction != null && asset.kind !== 'DERIVATIVE')
        throw new BadRequestException(
          'Redaction requires exact registered derivative bytes',
        );
      bytes += asset.byteLength;
      if (bytes > 64 * 1024 * 1024)
        throw new BadRequestException(
          'Disclosure bundle exceeds 64 MiB; create separate packets',
        );
      items.push({
        assetVersionId: asset.id,
        sha256: asset.sha256,
        relationId: checked.relation?.id ?? null,
        relationRevision: checked.relation?.revision ?? null,
        fieldDefinitionVersionId: checked.bytePolicy.definitionVersionId,
        ...(item.redaction != null ? { redaction: json(item.redaction) } : {}),
        lineage: json({
          parentVersionId: asset.parentVersionId,
          parentSha256: asset.parentSha256,
          tool: asset.tool,
          toolVersion: asset.toolVersion,
          sourceHash: asset.sourceHash,
          ownerCaseId: asset.caseId,
          ownerGrantId: entitlement.ownerGrant?.id ?? null,
          ownerGrantRevision: entitlement.ownerGrant?.revision ?? null,
          contentPolicy: item.contentPolicy ?? null,
          fieldDefinitionVersionId: checked.bytePolicy.definitionVersionId,
          fieldPolicyHash: checked.bytePolicy.definitionHash,
        }),
      });
    }
    const principal = await this.actorAccessPolicy(tx, recipient);
    return {
      recipientId,
      recipientPolicy: json({
        mode: principal.mode,
        accessRevision: principal.revision,
        grantId: grant?.id ?? null,
        grantRevision: grant?.revision ?? null,
        capability: 'download',
      }),
      purpose: text(body.purpose, 'Purpose'),
      basis: text(body.basis, 'Disclosure basis'),
      expiresAt,
      items,
    };
  }
  async createPacket(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, PACKET_KEYS);
    return this.mutate(
      caseId,
      'EVIDENCE_PACKET_CREATE',
      body,
      actor,
      'operate',
      async (tx) => {
        const { items, ...data } = await this.packetData(
          tx,
          caseId,
          body,
          actor,
        );
        if (body.deltaOfPacketId) {
          const original = await this.packet(tx, caseId, body.deltaOfPacketId);
          if (original.status !== 'APPROVED')
            throw new ConflictException(
              'Delta requires exact approved prior packet',
            );
          approval(original);
        }
        const packet = await tx.caseDisclosurePacket.create({
          data: {
            id: randomUUID(),
            caseId,
            authorId: actor.actorId,
            ...data,
            deltaOfPacketId: body.deltaOfPacketId,
            contentHash: 'PENDING_HASH',
          },
        });
        for (const item of items)
          await tx.caseDisclosurePacketItem.create({
            data: { packetId: packet.id, ...item },
          });
        return tx.caseDisclosurePacket.update({
          where: { id: packet.id },
          data: {
            contentHash: manifestHash(await this.packetManifest(tx, packet)),
          },
        });
      },
    );
  }
  async revisePacket(
    caseId: string,
    packetId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, PACKET_KEYS);
    return this.mutate(
      caseId,
      'EVIDENCE_PACKET_REVISE',
      body,
      actor,
      'operate',
      async (tx) => {
        const old = await this.packet(tx, caseId, packetId);
        revision(old, body);
        if (
          !['DRAFT', 'SUBMITTED', 'REJECTED'].includes(old.status) ||
          old.revokedAt
        )
          throw new ConflictException(
            'Approved packet immutable; create new/delta packet',
          );
        if (old.authorId !== actor.actorId)
          throw new ForbiddenException('Only packet maker may revise');
        const { items, ...data } = await this.packetData(
          tx,
          caseId,
          body,
          actor,
        );
        const packet = await tx.caseDisclosurePacket.update({
          where: { id: old.id, revision: old.revision },
          data: {
            ...data,
            revision: { increment: 1 },
            status: 'DRAFT',
            approvedHash: null,
            approvedRevision: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
        await tx.caseDisclosurePacketItem.deleteMany({
          where: { packetId: packet.id },
        });
        for (const item of items)
          await tx.caseDisclosurePacketItem.create({
            data: { packetId: packet.id, ...item },
          });
        return tx.caseDisclosurePacket.update({
          where: { id: packet.id },
          data: {
            contentHash: manifestHash(await this.packetManifest(tx, packet)),
          },
        });
      },
      packetId,
    );
  }
  async submitPacket(
    caseId: string,
    packetId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, []);
    return this.mutate(
      caseId,
      'EVIDENCE_PACKET_SUBMIT',
      body,
      actor,
      'operate',
      async (tx) => {
        const packet = await this.packet(tx, caseId, packetId);
        revision(packet, body);
        if (packet.status !== 'DRAFT' || packet.authorId !== actor.actorId)
          throw new ConflictException('Maker draft packet required');
        await this.validatePacket(tx, packet, actor);
        if (
          manifestHash(await this.packetManifest(tx, packet)) !==
          packet.contentHash
        )
          throw new ConflictException('Packet content changed');
        return tx.caseDisclosurePacket.update({
          where: { id: packet.id, revision: packet.revision },
          data: { status: 'SUBMITTED' },
        });
      },
      packetId,
    );
  }
  async assertPacketNotificationRecipient(
    tx: Prisma.TransactionClient | PrismaService,
    packetId: string,
    actor: ActorContext,
  ) {
    const packet = await tx.caseDisclosurePacket.findFirst({
      where: { id: packetId },
    });
    if (
      !packet ||
      packet.recipientId !== actor.actorId ||
      packet.status !== 'APPROVED' ||
      packet.revokedAt ||
      packet.expiresAt <= new Date()
    )
      throw new ForbiddenException(
        'Current approved packet recipient required',
      );
    approval(packet);
    await this.capability(tx, actor, 'download');
    await this.validatePacket(tx, packet, actor, 'download');
    if (
      manifestHash(await this.packetManifest(tx, packet)) !==
      packet.approvedHash
    )
      throw new ConflictException(
        'Approved notification packet content changed',
      );
    return {
      caseId: packet.caseId,
      packetId: packet.id,
      revision: packet.revision,
      approvedHash: packet.approvedHash,
    };
  }
  async exportPacket(caseId: string, packetId: string, actor: ActorContext) {
    const packet = await this.packet(this.prisma, caseId, packetId);
    await this.governance.assertCaseAccessCapability(
      this.prisma,
      caseId,
      actor,
      actor.actorId === packet.recipientId ? 'download' : 'share',
    );
    if (packet.revokedAt || packet.expiresAt <= new Date())
      throw new ForbiddenException('Packet revoked or expired');
    if (packet.status !== 'APPROVED')
      throw new ConflictException('Approved packet required');
    approval(packet);
    await this.capability(
      this.prisma,
      actor,
      actor.actorId === packet.recipientId ? 'download' : 'share',
    );
    const items = await this.validatePacket(
      this.prisma,
      packet,
      actor,
      actor.actorId === packet.recipientId ? 'download' : 'share',
    );
    const manifest = await this.packetManifest(this.prisma, packet);
    if (manifestHash(manifest) !== packet.approvedHash)
      throw new ConflictException('Approved manifest changed');
    const files = [] as Array<{ assetVersionId: string; base64: string }>;
    for (const item of items) {
      const file = await this.verifiedAsset(
        caseId,
        item.assetVersionId,
        { actorId: packet.recipientId },
        'download',
      );
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of file.handle.createReadStream({
          start: 0,
          autoClose: false,
        }))
          chunks.push(chunk as Buffer);
        files.push({
          assetVersionId: item.assetVersionId,
          base64: Buffer.concat(chunks).toString('base64'),
        });
      } finally {
        await file.handle.close();
      }
    }
    // Hydration can span I/O. Recheck packet, grant and item ownership immediately before returning bytes.
    await this.prisma.$transaction(
      async (tx) => {
        const latest = await this.packet(tx, caseId, packetId);
        if (
          latest.contentHash !== packet.contentHash ||
          latest.revision !== packet.revision ||
          latest.status !== 'APPROVED'
        )
          throw new ConflictException('Packet changed before transmission');
        await this.governance.assertCaseAccessCapability(
          tx,
          caseId,
          actor,
          actor.actorId === packet.recipientId ? 'download' : 'share',
        );
        await this.capability(
          tx,
          actor,
          actor.actorId === packet.recipientId ? 'download' : 'share',
        );
        await this.validatePacket(
          tx,
          latest,
          actor,
          actor.actorId === packet.recipientId ? 'download' : 'share',
        );
        await tx.auditLog.create({
          data: {
            userId: actor.actorId,
            action: 'EVIDENCE_PACKET_EXPORTED',
            subject: 'CaseDisclosurePacket',
            subjectId: packet.id,
            metadata: json({
              revision: packet.revision,
              approvedHash: packet.approvedHash,
              recipientId: packet.recipientId,
            }),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const bundle = {
      manifest,
      manifestHash: packet.approvedHash,
      files,
      notice:
        'Online revocation blocks new access. Downloaded copies cannot be recalled. Integrity verification does not authenticate legal signatures.',
    };
    verifyDisclosureBundle(bundle, packet.approvedHash);
    return { success: true, data: bundle };
  }
  async revokePacket(
    caseId: string,
    packetId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, ['reason']);
    return this.mutate(
      caseId,
      'EVIDENCE_PACKET_REVOKE',
      body,
      actor,
      'share',
      async (tx) => {
        const packet = await this.packet(tx, caseId, packetId);
        revision(packet, body);
        if (packet.revokedAt)
          throw new ConflictException('Packet already revoked');
        return tx.caseDisclosurePacket.update({
          where: { id: packet.id, revision: packet.revision },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
            revocationReason: text(body.reason, 'Revocation reason'),
          },
        });
      },
      packetId,
    );
  }
  async createRetention(
    caseId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, ['preserveUntil', 'basis']);
    return this.mutate(
      caseId,
      'EVIDENCE_RETENTION_CREATE',
      body,
      actor,
      'operate',
      async (tx) => {
        const preserveUntil = instant(
            body.preserveUntil,
            'Preservation deadline',
          ),
          basis = text(body.basis, 'Retention basis');
        return tx.caseRetentionPolicy.create({
          data: {
            caseId,
            authorId: actor.actorId,
            preserveUntil,
            basis,
            contentHash: manifestHash({
              caseId,
              preserveUntil: preserveUntil.toISOString(),
              basis,
              revision: 1,
            }),
          },
        });
      },
    );
  }
  async retentionTransition(
    caseId: string,
    policyId: string,
    transition: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    if (!['revise', 'review', 'publish'].includes(transition))
      throw new BadRequestException('Unknown retention transition');
    allowed(
      body,
      transition === 'revise'
        ? ['preserveUntil', 'basis']
        : transition === 'review'
          ? ['approve']
          : [],
    );
    return this.mutate(
      caseId,
      `EVIDENCE_RETENTION_${transition.toUpperCase()}`,
      body,
      actor,
      transition === 'revise'
        ? 'operate'
        : transition === 'review'
          ? 'review'
          : 'publish',
      async (tx) => {
        const policy = await tx.caseRetentionPolicy.findFirst({
          where: { id: policyId, caseId },
        });
        if (!policy) throw new NotFoundException('Retention policy not found');
        revision(policy, body);
        if (policy.status === 'PUBLISHED')
          throw new ConflictException(
            'Published policy immutable; create new version',
          );
        if (transition === 'revise') {
          if (policy.authorId !== actor.actorId)
            throw new ForbiddenException('Retention maker required');
          const preserveUntil = instant(
              body.preserveUntil,
              'Preservation deadline',
            ),
            basis = text(body.basis, 'Retention basis');
          return tx.caseRetentionPolicy.update({
            where: { id: policy.id, revision: policy.revision },
            data: {
              preserveUntil,
              basis,
              revision: { increment: 1 },
              status: 'DRAFT',
              contentHash: manifestHash({
                caseId,
                preserveUntil: preserveUntil.toISOString(),
                basis,
                revision: policy.revision + 1,
              }),
              approvedRevision: null,
              approvedHash: null,
              reviewedById: null,
            },
          });
        }
        if (policy.authorId === actor.actorId)
          throw new ForbiddenException(
            'Retention maker cannot review or publish',
          );
        if (transition === 'review') {
          if (policy.status !== 'DRAFT' || typeof body.approve !== 'boolean')
            throw new ConflictException(
              'Draft policy review decision required',
            );
          return tx.caseRetentionPolicy.update({
            where: { id: policy.id, revision: policy.revision },
            data: {
              status: body.approve ? 'REVIEWED' : 'REJECTED',
              reviewedById: actor.actorId,
              approvedRevision: body.approve ? policy.revision : null,
              approvedHash: body.approve ? policy.contentHash : null,
            },
          });
        }
        if (policy.status !== 'REVIEWED')
          throw new ConflictException('Reviewed policy required');
        approval(policy);
        await tx.caseRetentionPolicy.updateMany({
          where: { caseId, status: 'PUBLISHED' },
          data: { status: 'SUPERSEDED' },
        });
        return tx.caseRetentionPolicy.update({
          where: { id: policy.id, revision: policy.revision },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      },
      policyId,
    );
  }
  private async dispositionReady(
    tx: Tx,
    caseId: string,
    request: { policyId: string; assetVersionIds: Prisma.JsonValue },
  ) {
    const policy = await tx.caseRetentionPolicy.findFirst({
      where: { id: request.policyId, caseId, status: 'PUBLISHED' },
    });
    if (!policy)
      throw new ConflictException('Disposition policy no longer published');
    approval(policy);
    if (policy.preserveUntil > new Date())
      throw new ConflictException('Retention is not due');
    if (
      !Array.isArray(request.assetVersionIds) ||
      !request.assetVersionIds.length ||
      request.assetVersionIds.some((id) => typeof id !== 'string')
    )
      throw new ConflictException('Invalid frozen disposition assets');
    const ids = request.assetVersionIds as string[];
    await this.noHold(tx, caseId, ids);
    return ids;
  }
  async dispositionTransition(
    caseId: string,
    id: string,
    transition: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    if (!['revise', 'submit', 'review', 'execute'].includes(transition))
      throw new BadRequestException('Unknown disposition transition');
    allowed(
      body,
      transition === 'review'
        ? ['approve']
        : transition === 'execute'
          ? ['outcome', 'receipt']
          : transition === 'revise'
            ? ['purpose', 'assetVersionIds']
            : [],
    );
    return this.mutate(
      caseId,
      `EVIDENCE_DISPOSITION_${transition.toUpperCase()}`,
      body,
      actor,
      transition === 'review' ? 'review' : 'dispose',
      async (tx) => {
        const request = await tx.caseDispositionRequest.findFirst({
          where: { id, caseId },
        });
        if (!request) throw new NotFoundException('Disposition not found');
        revision(request, body);
        if (transition === 'review' && request.authorId === actor.actorId)
          throw new ForbiddenException('Disposition maker cannot review');
        if (transition === 'execute') {
          if (request.status !== 'APPROVED')
            throw new ConflictException('Approved disposition required');
          approval(request);
          // Check hold before even considering receipt or policy; force never bypasses it.
          await this.noHold(
            tx,
            caseId,
            Array.isArray(request.assetVersionIds)
              ? (request.assetVersionIds as string[])
              : undefined,
          );
        }
        const ids = await this.dispositionReady(tx, caseId, request);
        for (const assetId of ids)
          await this.authorizeAsset(
            tx,
            caseId,
            assetId,
            actor,
            transition === 'review' ? 'view' : 'dispose',
          );
        if (transition === 'revise') {
          if (
            !['DRAFT', 'SUBMITTED', 'REJECTED'].includes(request.status) ||
            request.authorId !== actor.actorId
          )
            throw new ConflictException(
              'Maker unapproved disposition required',
            );
          if (
            !body.assetVersionIds?.length ||
            new Set(body.assetVersionIds).size !== body.assetVersionIds.length
          )
            throw new BadRequestException(
              'Distinct disposition assets required',
            );
          await this.noHold(tx, caseId, body.assetVersionIds);
          for (const assetId of body.assetVersionIds)
            await this.authorizeAsset(tx, caseId, assetId, actor, 'dispose');
          const policy = await tx.caseRetentionPolicy.findFirstOrThrow({
              where: { id: request.policyId },
            }),
            purpose = text(body.purpose, 'Disposition purpose');
          return tx.caseDispositionRequest.update({
            where: { id, revision: request.revision },
            data: {
              assetVersionIds: json(body.assetVersionIds),
              purpose,
              revision: { increment: 1 },
              status: 'DRAFT',
              contentHash: manifestHash({
                caseId,
                policyId: policy.id,
                policyHash: policy.contentHash,
                assetVersionIds: body.assetVersionIds,
                purpose,
              }),
              approvedHash: null,
              approvedRevision: null,
              reviewedById: null,
              reviewedAt: null,
            },
          });
        }
        if (transition === 'submit') {
          if (request.status !== 'DRAFT' || request.authorId !== actor.actorId)
            throw new ConflictException('Maker draft disposition required');
          return tx.caseDispositionRequest.update({
            where: { id, revision: request.revision },
            data: { status: 'SUBMITTED' },
          });
        }
        if (transition === 'review') {
          if (
            request.status !== 'SUBMITTED' ||
            typeof body.approve !== 'boolean'
          )
            throw new ConflictException(
              'Submitted disposition and review decision required',
            );
          return tx.caseDispositionRequest.update({
            where: { id, revision: request.revision },
            data: {
              status: body.approve ? 'APPROVED' : 'REJECTED',
              approvedHash: body.approve ? request.contentHash : null,
              approvedRevision: body.approve ? request.revision : null,
              reviewedById: actor.actorId,
              reviewedAt: new Date(),
            },
          });
        }
        if (!['ARCHIVED', 'RETIRED'].includes(body.outcome ?? ''))
          throw new BadRequestException(
            'Disposition outcome must preserve original bytes',
          );
        const receipt = body.receipt as
          | {
              reference?: unknown;
              recordedAt?: unknown;
              documentId?: unknown;
              expectedDocumentUpdatedAt?: unknown;
            }
          | undefined;
        if (!receipt || typeof receipt !== 'object')
          throw new BadRequestException(
            'Authorized disposition receipt required',
          );
        if (
          Array.isArray(receipt) ||
          Object.getPrototypeOf(receipt) !== Object.prototype ||
          Object.keys(receipt).some(
            (key) =>
              ![
                'reference',
                'recordedAt',
                'documentId',
                'expectedDocumentUpdatedAt',
              ].includes(key),
          )
        )
          throw new BadRequestException(
            'Plain authorized receipt fields required',
          );
        const reference = text(receipt.reference, 'Receipt reference');
        const recordedAt = instant(
          receipt.recordedAt,
          'Receipt recording date',
        );
        if (recordedAt > new Date())
          throw new BadRequestException('Future receipt forbidden');
        let sourceSnapshot: Awaited<
          ReturnType<CaseEvidenceGovernanceService['decisionSourceSnapshot']>
        > | null = null;
        if (receipt.documentId !== undefined) {
          const documentId = text(receipt.documentId, 'Receipt document');
          const receiptDocument = await tx.document.findFirst({
            where: { id: documentId, caseId, deletedAt: null },
          });
          if (!receiptDocument)
            throw new NotFoundException('Receipt document not in Case');
          if (
            receipt.expectedDocumentUpdatedAt !== undefined &&
            instant(
              receipt.expectedDocumentUpdatedAt,
              'Receipt document version',
            ).getTime() !== receiptDocument.updatedAt.getTime()
          )
            throw new ConflictException('Receipt document version changed');
          sourceSnapshot = await this.decisionSourceSnapshot(
            tx,
            caseId,
            documentId,
            actor,
          );
          if (sourceSnapshot.ownerCaseId !== caseId)
            throw new ForbiddenException(
              'Disposition receipt must belong to exact owning Case',
            );
          if (!sourceSnapshot.assetVersionId) {
            const pinned = await tx.caseAssetVersion.create({
              data: {
                caseId,
                documentId,
                kind: 'ORIGINAL',
                sha256: sourceSnapshot.sha256,
                byteLength: sourceSnapshot.byteLength,
                documentUpdatedAt: new Date(sourceSnapshot.documentUpdatedAt),
                createdById: actor.actorId,
              },
            });
            sourceSnapshot.assetVersionId = pinned.id;
          }
        } else if (receipt.expectedDocumentUpdatedAt !== undefined)
          throw new BadRequestException(
            'Receipt document required for version',
          );
        const now = new Date();
        const changed = await tx.caseAssetVersion.updateMany({
          where: { id: { in: ids }, caseId, retiredAt: null },
          data: { retiredAt: now, dispositionId: id },
        });
        if (changed.count !== ids.length)
          throw new ConflictException('Disposition asset snapshot changed');
        return tx.caseDispositionRequest.update({
          where: { id, revision: request.revision },
          data: {
            status: 'EXECUTED',
            executedById: actor.actorId,
            executedAt: now,
            receipt: json({
              reference,
              recordedAt: recordedAt.toISOString(),
              documentId: sourceSnapshot?.documentId ?? null,
              sourceSnapshot,
              sourceKind: sourceSnapshot
                ? 'IMMUTABLE_DOCUMENT'
                : 'EXTERNAL_REFERENCE_ONLY',
            }),
            receiptDocumentId: sourceSnapshot?.documentId ?? null,
            receiptDocumentUpdatedAt: sourceSnapshot
              ? new Date(sourceSnapshot.documentUpdatedAt)
              : null,
            receiptSha256: sourceSnapshot?.sha256 ?? null,
            receiptByteLength: sourceSnapshot?.byteLength ?? null,
            outcome: body.outcome,
          },
        });
      },
      id,
    );
  }
  async addHold(caseId: string, body: EvidenceCommand, actor: ActorContext) {
    allowed(body, ['assetVersionId', 'reason', 'basis']);
    return this.mutate(
      caseId,
      'EVIDENCE_HOLD_ADD',
      body,
      actor,
      'custody',
      async (tx) => {
        if (body.assetVersionId)
          await this.asset(tx, caseId, body.assetVersionId);
        return tx.caseEvidenceHold.create({
          data: {
            caseId,
            assetVersionId: body.assetVersionId,
            reason: text(body.reason, 'Hold reason'),
            basis: text(body.basis, 'Hold basis'),
            createdById: actor.actorId,
          },
        });
      },
    );
  }
  async releaseHold(
    caseId: string,
    holdId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, ['reason']);
    return this.mutate(
      caseId,
      'EVIDENCE_HOLD_RELEASE',
      body,
      actor,
      'custody',
      async (tx) => {
        const hold = await tx.caseEvidenceHold.findFirst({
          where: { id: holdId, caseId },
        });
        if (!hold) throw new NotFoundException('Hold not found');
        if (
          !body.expectedAggregateUpdatedAt ||
          instant(body.expectedAggregateUpdatedAt, 'Hold version').getTime() !==
            hold.createdAt.getTime()
        )
          throw new ConflictException('Exact hold creation version required');
        if (hold.releasedAt)
          throw new ConflictException('Hold already released');
        return tx.caseEvidenceHold.update({
          where: { id: holdId, releasedAt: null },
          data: {
            releasedAt: new Date(),
            releasedById: actor.actorId,
            releaseReason: text(body.reason, 'Release reason'),
          },
        });
      },
      holdId,
    );
  }
  async revokeRepresentation(
    caseId: string,
    grantId: string,
    body: EvidenceCommand,
    actor: ActorContext,
  ) {
    allowed(body, []);
    return this.mutate(
      caseId,
      'EVIDENCE_REPRESENTATION_REVOKE',
      body,
      actor,
      'operate',
      async (tx) => {
        const grant = await tx.caseRepresentationGrant.findFirst({
          where: { id: grantId, caseId },
        });
        if (!grant) throw new NotFoundException('Grant not found');
        revision(grant, body);
        if (grant.revokedAt)
          throw new ConflictException('Grant already revoked');
        return tx.caseRepresentationGrant.update({
          where: { id: grantId, revision: grant.revision },
          data: {
            revokedAt: new Date(),
            revokedById: actor.actorId,
            revision: { increment: 1 },
          },
        });
      },
      grantId,
    );
  }
  async getSummary(caseId: string, actor: ActorContext) {
    await this.governance.assertCaseReadable(this.prisma, caseId, actor);
    await this.representation(this.prisma, caseId, actor, 'list');
    const [
      assets,
      custody,
      packets,
      holds,
      representationGrants,
      retentionPolicies,
      dispositions,
    ] = await Promise.all([
      this.prisma.caseAssetVersion.findMany({
        where: { caseId },
        select: {
          id: true,
          caseId: true,
          documentId: true,
          parentVersionId: true,
          kind: true,
          sha256: true,
          byteLength: true,
          parentSha256: true,
          tool: true,
          toolVersion: true,
          sourceHash: true,
          createdAt: true,
          retiredAt: true,
          dispositionId: true,
          document: { select: { id: true, title: true, originalName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseCustodyEvent.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.caseDisclosurePacket.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseEvidenceHold.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseRepresentationGrant.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseRetentionPolicy.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.caseDispositionRequest.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const links = await this.prisma.caseRelation.findMany({
      where: {
        revokedAt: null,
        deletedAt: null,
        type: { in: ['RELATED', 'MERGE', 'SPLIT', 'TRANSFER'] },
        OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }],
      },
      orderBy: { createdAt: 'desc' },
    });
    const relatedAssets: Array<
      (typeof assets)[number] & {
        ownerCaseId: string;
        relationId: string;
        relationRevision: number;
      }
    > = [];
    const seenOwners = new Set<string>();
    for (const link of links) {
      const ownerCaseId =
        link.sourceCaseId === caseId ? link.targetCaseId : link.sourceCaseId;
      if (seenOwners.has(ownerCaseId)) continue;
      let current: CaseRelation | null;
      try {
        current = await this.directRelation(
          this.prisma,
          caseId,
          ownerCaseId,
          actor,
        );
        await this.representation(this.prisma, ownerCaseId, actor, 'list');
      } catch (error) {
        if (
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        )
          continue;
        throw error;
      }
      if (!current) continue;
      seenOwners.add(ownerCaseId);
      const originals = await this.prisma.caseAssetVersion.findMany({
        where: { caseId: ownerCaseId },
        select: {
          id: true,
          caseId: true,
          documentId: true,
          parentVersionId: true,
          kind: true,
          sha256: true,
          byteLength: true,
          parentSha256: true,
          tool: true,
          toolVersion: true,
          sourceHash: true,
          createdAt: true,
          retiredAt: true,
          dispositionId: true,
          document: { select: { id: true, title: true, originalName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      const after = await this.directRelation(
        this.prisma,
        caseId,
        ownerCaseId,
        actor,
      );
      await this.representation(this.prisma, ownerCaseId, actor, 'list');
      if (
        !after ||
        after.id !== current.id ||
        after.revision !== current.revision
      )
        throw new ConflictException(
          'Related source authority changed during hydration',
        );
      relatedAssets.push(
        ...originals.map((original) => ({
          ...original,
          ownerCaseId,
          relationId: after.id,
          relationRevision: after.revision,
        })),
      );
    }
    const packetSummaries: Array<
      CaseDisclosurePacket & {
        items: Array<CaseDisclosurePacketItem & { ownerCaseId: string }>;
        contentsHidden: boolean;
      }
    > = [];
    for (const packet of packets) {
      const frozenItems = await this.prisma.caseDisclosurePacketItem.findMany({
        where: { packetId: packet.id },
        orderBy: { createdAt: 'asc' },
      });
      const items: Array<CaseDisclosurePacketItem & { ownerCaseId: string }> =
        [];
      for (const item of frozenItems) {
        const original = await this.prisma.caseAssetVersion.findFirst({
          where: { id: item.assetVersionId },
        });
        if (!original) continue;
        let relation: CaseRelation | null;
        try {
          relation = await this.directRelation(
            this.prisma,
            caseId,
            original.caseId,
            actor,
          );
          await this.representation(
            this.prisma,
            original.caseId,
            actor,
            'list',
          );
        } catch (error) {
          if (
            error instanceof ForbiddenException ||
            error instanceof NotFoundException
          )
            continue;
          throw error;
        }
        if (
          (relation?.id ?? null) !== item.relationId ||
          (relation?.revision ?? null) !== item.relationRevision
        )
          continue;
        const current = await this.directRelation(
          this.prisma,
          caseId,
          original.caseId,
          actor,
        );
        await this.representation(this.prisma, original.caseId, actor, 'list');
        if (
          (current?.id ?? null) !== (relation?.id ?? null) ||
          (current?.revision ?? null) !== (relation?.revision ?? null)
        )
          throw new ConflictException(
            'Packet source authority changed during hydration',
          );
        items.push({ ...item, ownerCaseId: original.caseId });
      }
      packetSummaries.push({
        ...packet,
        items,
        contentsHidden: items.length !== frozenItems.length,
      });
    }
    await this.governance.assertCaseReadable(this.prisma, caseId, actor);
    await this.representation(this.prisma, caseId, actor, 'list');
    return {
      success: true,
      data: {
        assets: [...assets, ...relatedAssets],
        custody,
        packets: packetSummaries,
        holds,
        representationGrants,
        retentionPolicies,
        dispositions,
      },
    };
  }
  async assertDocumentCanChangeParent(
    tx: Prisma.TransactionClient,
    documentId: string,
    actor: ActorContext,
    targetCaseId: string,
    context?: { targetCreatedInTransaction: true },
  ): Promise<void> {
    const initial = await tx.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: { id: true, caseId: true, updatedAt: true },
    });
    if (!initial) throw new NotFoundException('Source document not found');
    const parents = [
      ...new Set(
        [initial.caseId, targetCaseId].filter((id): id is string => !!id),
      ),
    ].sort();
    for (const id of parents)
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM cases WHERE id=${id} FOR UPDATE`,
      );
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM documents WHERE id=${documentId} FOR UPDATE`,
    );
    const current = await tx.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: { caseId: true, updatedAt: true },
    });
    if (
      !current ||
      current.caseId !== initial.caseId ||
      current.updatedAt.getTime() !== initial.updatedAt.getTime()
    )
      throw new ConflictException('Source document parent/version changed');
    if (initial.caseId) {
      await this.governance.assertCaseWritable(tx, initial.caseId, actor);
      await this.noHold(tx, initial.caseId);
    }
    if (context?.targetCreatedInTransaction) {
      const target = await tx.case.findUnique({
        where: { id: targetCaseId },
        select: {
          createdById: true,
          assignedTeamId: true,
          investigatorId: true,
        },
      });
      const proof = await tx.$queryRaw<Array<{ createdHere: boolean }>>(
        Prisma.sql`SELECT (xmin::text::bigint = mod(txid_current(),4294967296) AND "createdAt" >= date_trunc('milliseconds',transaction_timestamp())) AS "createdHere" FROM cases WHERE id=${targetCaseId}`,
      );
      if (
        !target ||
        target.createdById !== actor.actorId ||
        proof[0]?.createdHere !== true
      )
        throw new ConflictException(
          'Target must be created by this actor in this transaction',
        );
      await this.governance.assertCaseCreation(tx, actor, target);
    } else await this.governance.assertCaseWritable(tx, targetCaseId, actor);
    if (
      (await tx.caseAssetVersion.findUnique({ where: { documentId } })) ||
      (await tx.caseDecision.findFirst({
        where: { sourceDocumentId: documentId },
      })) ||
      (await tx.caseCustodyEvent.findFirst({
        where: { sourceDocumentId: documentId },
      })) ||
      (await tx.caseDispositionRequest.findFirst({
        where: { receiptDocumentId: documentId },
      }))
    )
      throw new ConflictException(
        'Original document provenance prevents parent change',
      );
  }
  private async legacyByteCaseIds(
    tx: Tx,
    otherParents: Prisma.DocumentWhereInput[],
  ): Promise<string[]> {
    const documents = otherParents.length
      ? await tx.document.findMany({
          where: {
            caseId: { not: null },
            caseAssetVersion_document: { none: {} },
            OR: otherParents,
          },
          select: { caseId: true },
          distinct: ['caseId'],
        })
      : [];
    const caseIds = documents
      .map((row) => row.caseId)
      .filter((id): id is string => !!id);
    if (!caseIds.length) return [];
    const candidates = await tx.$queryRaw<
      Array<{ id: string; fieldDefinitionVersionId: string | null }>
    >(
      Prisma.sql`SELECT id, "fieldDefinitionVersionId" FROM cases WHERE id IN (${Prisma.join(caseIds)}) AND "deletedAt" IS NULL AND sensitivity::text = 'NORMAL' AND COALESCE(metadata->>'sensitivity','NORMAL') = 'NORMAL' AND COALESCE(metadata->>'_sensitivity','NORMAL') = 'NORMAL'`,
    );
    const pins = [
      ...new Set(
        candidates
          .map((row) => row.fieldDefinitionVersionId)
          .filter((id): id is string => !!id),
      ),
    ];
    const schemas = pins.length
      ? await tx.caseFieldDefinitionVersion.findMany({
          where: { id: { in: pins } },
          select: {
            id: true,
            status: true,
            publishedAt: true,
            definition: true,
          },
        })
      : [];
    return candidates
      .filter((row) =>
        legacyDefinitionAllowsBytes(
          row.fieldDefinitionVersionId,
          schemas.find(
            (schema) => schema.id === row.fieldDefinitionVersionId,
          ) ?? null,
        ),
      )
      .map((row) => row.id);
  }
  async authorizeLegacyDocumentRead(
    tx: Tx,
    documentId: string,
    actor: ActorContext,
  ) {
    const scope = await this.governance.currentActorScope(tx, actor);
    const record = await tx.document.findFirst({
      where: {
        AND: [
          { id: documentId, deletedAt: null },
          await this.documentVisibilityWhere(actor, tx),
        ],
      },
      select: { caseId: true },
    });
    if (!record)
      throw new ForbiddenException(
        'Current document parent authority required',
      );
    let caseVisible = false,
      fieldDefinitionVersionId: string | null = null;
    if (record.caseId) {
      try {
        const parent = await this.governance.assertCaseReadable(
          tx,
          record.caseId,
          actor,
        );
        caseVisible = true;
        fieldDefinitionVersionId = parent.fieldDefinitionVersionId;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return { scope, caseVisible, fieldDefinitionVersionId };
  }
  async filterDocumentCase<
    T extends {
      id: string;
      caseId: string | null;
      case?:
        | ({ id: string; name?: string | null } & Record<string, unknown>)
        | null;
    },
  >(record: T, actor: ActorContext, tx: Tx = this.prisma): Promise<T> {
    const access = await this.authorizeLegacyDocumentRead(tx, record.id, actor);
    if (!access.caseVisible) return { ...record, caseId: null, case: null };
    if (!record.case) return record;
    await this.fields.byteFieldPolicySnapshot(tx, record.case.id, actor);
    const filtered = await this.fields.filterCustomFields(
      {
        ...record.case,
        fieldDefinitionVersionId: access.fieldDefinitionVersionId,
      },
      actor,
      tx,
    );
    const { fieldDefinitionVersionId: _policy, ...parent } = filtered;
    void _policy;
    return { ...record, case: parent };
  }
  async documentCaseSearchWhere(
    actor: ActorContext,
    tx: Tx = this.prisma,
  ): Promise<Prisma.CaseWhereInput> {
    let readable: Prisma.CaseWhereInput;
    try {
      readable = await this.governance.readableCaseWhere(tx, actor);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      return { id: { in: [] } };
    }
    const definitions = await tx.caseFieldDefinitionVersion.findMany({
      select: { id: true, status: true, publishedAt: true, definition: true },
    });
    const sensitive = await this.governance.hasCapability(
      tx,
      actor.actorId,
      'read_sensitive',
    );
    const ordinary = definitions
      .filter((row) => definitionAllowsCaseNameSearch(row, sensitive))
      .map((row) => row.id);
    const withSensitive = definitions
      .filter((row) => definitionAllowsCaseNameSearch(row, true))
      .map((row) => row.id);
    const now = new Date();
    return {
      AND: [
        readable,
        {
          OR: [
            { fieldDefinitionVersionId: null },
            { fieldDefinitionVersionId: { in: ordinary } },
            {
              fieldDefinitionVersionId: { in: withSensitive },
              caseGovernanceGrant_case: {
                some: {
                  granteeId: actor.actorId,
                  revokedAt: null,
                  startsAt: { lte: now },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                  capabilities: { array_contains: ['read_sensitive'] },
                },
              },
            },
          ],
        },
      ],
    };
  }
  async documentVisibilityWhere(
    actor?: ActorContext,
    tx: Tx = this.prisma,
  ): Promise<Prisma.DocumentWhereInput> {
    const unregistered: Prisma.DocumentWhereInput = {
      caseAssetVersion_document: { none: {} },
    };
    if (!actor) return unregistered;
    if (
      !(await this.governance.hasEntityPermission(
        tx,
        actor.actorId,
        'Document',
        'read',
      ))
    )
      throw new ForbiddenException('Current document read permission required');
    const scope = await this.governance.currentActorScope(tx, actor);
    let readable: Prisma.CaseWhereInput;
    try {
      readable = await this.governance.readableCaseWhere(tx, actor);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      readable = { id: { in: [] } };
    }
    const now = new Date();
    const principal = await this.actorAccessPolicy(tx, actor);
    const representation: Prisma.CaseWhereInput =
      principal.mode === CaseAccessMode.INTERNAL
        ? {}
        : {
            caseRepresentationGrant_case: {
              some: {
                granteeId: actor.actorId,
                revokedAt: null,
                startsAt: { lte: now },
                expiresAt: { gt: now },
                capabilities: { array_contains: ['view', 'list'] },
                lawyer: { deletedAt: null },
              },
            },
          };
    const otherParents: Prisma.DocumentWhereInput[] = [];
    if (
      await this.governance.hasEntityPermission(
        tx,
        actor.actorId,
        'Incident',
        'read',
      )
    )
      otherParents.push({
        incident: { AND: [{ deletedAt: null }, buildScopeFilter(scope) ?? {}] },
      });
    if (
      await this.governance.hasEntityPermission(
        tx,
        actor.actorId,
        'Petition',
        'read',
      )
    )
      otherParents.push({
        petition: {
          AND: [{ deletedAt: null }, buildPetitionScopeFilter(scope) ?? {}],
        },
      });
    if (scope === null)
      otherParents.push({ caseId: null, incidentId: null, petitionId: null });
    const legacy: Prisma.DocumentWhereInput =
      principal.mode === CaseAccessMode.INTERNAL
        ? {
            AND: [
              unregistered,
              {
                OR: [
                  { caseId: null },
                  {
                    caseId: {
                      in: await this.legacyByteCaseIds(tx, otherParents),
                    },
                  },
                ],
              },
              { OR: otherParents },
            ],
          }
        : { id: { in: [] } };
    return {
      OR: [
        { AND: [unregistered, { case: { AND: [readable, representation] } }] },
        legacy,
        {
          case: { AND: [readable, representation] },
          caseAssetVersion_document: { some: { retiredAt: null } },
        },
      ],
    };
  }
}
