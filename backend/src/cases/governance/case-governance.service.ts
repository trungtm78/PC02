import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Case, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import {
  assertParentInScope,
  buildScopeFilter,
} from '../../common/utils/scope-filter.util';
import {
  ActorContext,
  MutationInput,
  mutationHash,
} from './case-governance.contract';
import {
  redactCaseFieldPolicies,
  isPublishedFieldSchema,
} from './case-native-field-policy';
type Tx = Prisma.TransactionClient;
type DbActor = Prisma.UserGetPayload<{
  include: {
    role: { include: { permissions: { include: { permission: true } } } };
  };
}>;
export type MutationHandler<T> = (
  tx: Tx,
  context: { caseRecord: Case; actor: ActorContext; operationId: string },
) => Promise<T>;
export interface ReceiptChecklistItem {
  documentId: string;
  expectedDocumentUpdatedAt: string;
  present: boolean;
  note?: string;
}
export interface ReceiptInput {
  receiptChecklist?: ReceiptChecklistItem[];
  shortcomings?: string;
}
export interface SendHandoffInput extends ReceiptInput {
  toTeamId: string;
  recipientId?: string;
  requestKey: string;
  expectedUpdatedAt: string;
  reason?: string;
}
export interface ResolveHandoffInput extends ReceiptInput {
  requestKey: string;
  expectedUpdatedAt: string;
  expectedAggregateUpdatedAt: string;
  reason?: string;
}
@Injectable()
export class CaseGovernanceService {
  constructor(private readonly prisma: PrismaService) {}
  private async receiptFacts(
    tx: Tx,
    caseId: string,
    dto: ReceiptInput,
  ): Promise<Prisma.InputJsonObject> {
    if (
      dto.shortcomings !== undefined &&
      (typeof dto.shortcomings !== 'string' || dto.shortcomings.length > 5000)
    )
      throw new BadRequestException('Receipt shortcomings must be text');
    if (
      dto.receiptChecklist !== undefined &&
      (!Array.isArray(dto.receiptChecklist) ||
        dto.receiptChecklist.length > 100)
    )
      throw new BadRequestException('Bounded receipt checklist required');
    const entries: Prisma.InputJsonObject[] = [],
      seen = new Set<string>();
    for (const entry of dto.receiptChecklist ?? []) {
      if (
        !entry ||
        typeof entry.documentId !== 'string' ||
        !entry.documentId ||
        seen.has(entry.documentId) ||
        typeof entry.present !== 'boolean' ||
        (entry.note !== undefined &&
          (typeof entry.note !== 'string' || entry.note.length > 2000))
      )
        throw new BadRequestException(
          'Unique owned document checklist items required',
        );
      seen.add(entry.documentId);
      const expected = new Date(entry.expectedDocumentUpdatedAt);
      if (
        typeof entry.expectedDocumentUpdatedAt !== 'string' ||
        !Number.isFinite(expected.getTime())
      )
        throw new BadRequestException('Checklist document version required');
      const document = await tx.document.findFirst({
        where: { id: entry.documentId, caseId, deletedAt: null },
      });
      if (!document)
        throw new BadRequestException(
          'Checklist document must belong to this Case',
        );
      if (document.updatedAt.getTime() !== expected.getTime())
        throw new ConflictException('Checklist document changed');
      entries.push({
        documentId: document.id,
        documentUpdatedAt: document.updatedAt.toISOString(),
        present: entry.present,
        note: entry.note ?? null,
      });
    }
    return {
      receiptChecklist: entries,
      shortcomings: dto.shortcomings ?? null,
    };
  }
  async currentActorScope(
    tx: Tx,
    actor: ActorContext,
  ): Promise<DataScope | null> {
    return this.currentScope(tx, await this.activeActor(tx, actor.actorId));
  }
  async hasEntityPermission(
    tx: Tx,
    actorId: string,
    subject: string,
    action: string,
  ): Promise<boolean> {
    return this.permission(
      await this.activeActor(tx, actorId),
      subject,
      action,
    );
  }
  private representationWhere(
    user: DbActor,
    capability: string,
  ): Prisma.CaseWhereInput {
    if (user.caseAccessMode !== 'REPRESENTATION_ONLY') return {};
    return {
      caseRepresentationGrant_case: {
        some: {
          granteeId: user.id,
          revokedAt: null,
          startsAt: { lte: new Date() },
          expiresAt: { gt: new Date() },
          capabilities: { array_contains: [capability] },
        },
      },
    };
  }
  private async representation(
    tx: Tx,
    caseId: string,
    user: DbActor,
    capability: string,
  ): Promise<void> {
    if (user.caseAccessMode !== 'REPRESENTATION_ONLY') return;
    const grant = await tx.caseRepresentationGrant.findFirst({
      where: {
        caseId,
        granteeId: user.id,
        revokedAt: null,
        startsAt: { lte: new Date() },
        expiresAt: { gt: new Date() },
        capabilities: { array_contains: [capability] },
      },
    });
    if (!grant)
      throw new ForbiddenException(
        'Current exact Case representation capability required',
      );
  }
  async accessProfile(
    tx: Tx,
    actor: ActorContext,
  ): Promise<{ caseAccessMode: string; caseAccessRevision: number }> {
    const user = await this.activeActor(tx, actor.actorId);
    return {
      caseAccessMode: user.caseAccessMode ?? 'INTERNAL',
      caseAccessRevision: user.caseAccessRevision ?? 0,
    };
  }
  async assertGeneralExport(tx: Tx, actor: ActorContext): Promise<void> {
    if (
      (await this.activeActor(tx, actor.actorId)).caseAccessMode ===
      'REPRESENTATION_ONLY'
    )
      throw new ForbiddenException(
        'Use an approved disclosure packet for representation downloads',
      );
  }
  async assertCaseAccessCapability(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    capability: string,
  ): Promise<Case> {
    const user = await this.activeActor(tx, actor.actorId);
    if (!this.permission(user, 'Case', 'read'))
      throw new ForbiddenException('Case read permission required');
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Case not found');
    assertParentInScope(record, await this.currentScope(tx, user), 'read');
    await this.sensitive(tx, record, user);
    await this.representation(tx, caseId, user, capability);
    return record;
  }
  async assertBaseCaseReadable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<Case> {
    const user = await this.activeActor(tx, actor.actorId);
    if (!this.permission(user, 'Case', 'read'))
      throw new ForbiddenException('Case read permission required');
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Case not found');
    assertParentInScope(record, await this.currentScope(tx, user), 'read');
    await this.sensitive(tx, record, user);
    return record;
  }
  async assertClassificationInspectable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    purpose: string,
  ): Promise<Case> {
    if (
      typeof purpose !== 'string' ||
      purpose.trim().length < 10 ||
      purpose.length > 1000
    )
      throw new BadRequestException(
        'Recorded classification inspection purpose required',
      );
    const user = await this.activeActor(tx, actor.actorId);
    if (
      user.caseAccessMode === 'REPRESENTATION_ONLY' ||
      !this.permission(user, 'Case', 'read') ||
      !this.permission(user, 'Case', 'edit') ||
      !this.permission(user, 'CaseGovernance', 'manage_access') ||
      !this.permission(user, 'CaseGovernance', 'read_sensitive')
    )
      throw new ForbiddenException(
        'Internal classification inspection authority required',
      );
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Case not found');
    assertParentInScope(record, await this.currentScope(tx, user), 'write');
    if (
      record.intakeStage === 'CHO_NHAN' ||
      (await tx.caseHandoff.findFirst({ where: { caseId, state: 'PENDING' } }))
    )
      throw new ConflictException('Pending handoff protects classification');
    return record;
  }
  async serializeCaseList<T extends { id: string; metadata?: unknown }>(
    tx: Tx,
    record: T,
    actor: ActorContext,
  ): Promise<T> {
    const user = await this.activeActor(tx, actor.actorId);
    const checked = await this.assertBaseCaseReadable(tx, record.id, actor);
    if (user.caseAccessMode !== 'REPRESENTATION_ONLY')
      return this.serializeGovernance(tx, checked, actor, record);
    await this.representation(tx, record.id, user, 'list');
    const summary = {
      id: record.id,
      ...Object.fromEntries(
        Object.entries(record).filter(([key]) =>
          [
            'caseCode',
            'name',
            'status',
            'caseType',
            'intakeStage',
            'updatedAt',
          ].includes(key),
        ),
      ),
      quyenGhi: false,
    };
    return this.serializeGovernance(
      tx,
      checked,
      actor,
      summary,
    ) as unknown as Promise<T>;
  }
  async canCaseEdit(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<boolean> {
    try {
      await this.assertCaseWritable(tx, caseId, actor);
      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        return false;
      throw error;
    }
  }
  async hasSensitiveAccess(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<boolean> {
    if (await this.hasCapability(tx, actor.actorId, 'read_sensitive'))
      return true;
    return !!(await tx.caseGovernanceGrant.findFirst({
      where: {
        caseId,
        granteeId: actor.actorId,
        revokedAt: null,
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        capabilities: { array_contains: ['read_sensitive'] },
      },
    }));
  }
  private async serializeGovernance<T>(
    tx: Tx,
    record: Case,
    actor: ActorContext,
    result: T,
  ): Promise<T> {
    result = await this.redactForeignCases(tx, record.id, actor, result);
    if (!record.fieldDefinitionVersionId) return result;
    const schema = await tx.caseFieldDefinitionVersion.findUnique({
      where: { id: record.fieldDefinitionVersionId },
    });
    if (!schema || !isPublishedFieldSchema(schema))
      throw new ForbiddenException('Pinned field policy unavailable');
    return redactCaseFieldPolicies(
      result,
      schema.definition,
      await this.hasSensitiveAccess(tx, record.id, actor),
    );
  }
  private async redactForeignCases<T>(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    value: T,
  ): Promise<T> {
    const single = new Set([
      'caseId',
      'sourceCaseId',
      'targetCaseId',
      'linkedCaseId',
      'relatedCaseId',
      'parentCaseId',
      'originalCaseId',
      'cloneSourceCaseId',
      'newCaseId',
    ]);
    const containers = new Set([
      'case',
      'sourceCase',
      'targetCase',
      'relatedCase',
      'parentCase',
      'originalCase',
      'newCase',
      '_splitProvenance',
      '_cloneSource',
      'sourceSnapshot',
      '_sourceSnapshot',
    ]);
    const refs = new Set<string>();
    const scan = (input: unknown, key = ''): void => {
      if (single.has(key) && typeof input === 'string' && input !== caseId)
        refs.add(input);
      if (!input || typeof input !== 'object' || input instanceof Date) return;
      if (Array.isArray(input)) {
        for (const item of input)
          scan(item, key === 'caseIds' ? 'caseId' : key);
        return;
      }
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (
        containers.has(key) &&
        typeof descriptors.id?.value === 'string' &&
        descriptors.id.value !== caseId
      )
        refs.add(descriptors.id.value);
      for (const [child, descriptor] of Object.entries(descriptors))
        if (!descriptor.get && !descriptor.set) scan(descriptor.value, child);
    };
    scan(value);
    if (!refs.size) return value;
    const where = await this.readableCaseWhere(tx, actor, {
      includeDeleted: true,
    });
    const rows = await tx.case.findMany({
      where: { AND: [where, { id: { in: [...refs] } }] },
      select: { id: true },
    });
    const allowed = new Set([caseId, ...rows.map((row) => row.id)]);
    const copy = (input: unknown, key = ''): unknown => {
      if (!input || typeof input !== 'object' || input instanceof Date)
        return input;
      if (Array.isArray(input))
        return input
          .filter(
            (item) =>
              key !== 'caseIds' ||
              typeof item !== 'string' ||
              allowed.has(item),
          )
          .map((item) => copy(item, key));
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (
        containers.has(key) &&
        Object.entries(descriptors).some(
          ([name, d]) =>
            (name === 'id' || single.has(name)) &&
            typeof d.value === 'string' &&
            !allowed.has(d.value),
        )
      )
        return undefined;
      const out: Record<string, unknown> = {};
      const hiddenPrefixes = Object.entries(descriptors)
        .filter(
          ([name, d]) =>
            single.has(name) &&
            typeof d.value === 'string' &&
            !allowed.has(d.value),
        )
        .map(([name]) => name.slice(0, -2));
      for (const [name, descriptor] of Object.entries(descriptors)) {
        if (
          descriptor.get ||
          descriptor.set ||
          ['__proto__', 'prototype', 'constructor'].includes(name) ||
          hiddenPrefixes.some((prefix) => name.startsWith(prefix))
        )
          continue;
        const next = copy(descriptor.value, name);
        if (next !== undefined) out[name] = next;
      }
      return out;
    };
    return copy(value) as T;
  }
  async serializeCaseResult<T>(
    tx: Tx,
    caseId: string,
    result: T,
    actor: ActorContext,
  ): Promise<T> {
    const record = await this.assertCaseReadable(tx, caseId, actor);
    return this.serializeGovernance(tx, record, actor, result);
  }
  async capabilities(caseId: string, actor: ActorContext) {
    const record = await this.assertCaseReadable(this.prisma, caseId, actor);
    const actions = [
      'operate',
      'review',
      'publish',
      'share',
      'download',
      'custody',
      'dispose',
      'read_sensitive',
    ];
    const permissions = Object.fromEntries<boolean>(
      await Promise.all(
        actions.map(
          async (action) =>
            [
              action,
              await this.hasCapability(this.prisma, actor.actorId, action),
            ] as const,
        ),
      ),
    );
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: 'CASE_GOVERNANCE_V1' },
    });
    const user = await this.activeActor(this.prisma, actor.actorId);
    return {
      success: true,
      data: {
        ...permissions,
        actorId: user.id,
        enabled: flag?.enabled === true,
        pendingHandoff: record.intakeStage === 'CHO_NHAN',
        caseAccessMode: user.caseAccessMode ?? 'INTERNAL',
        caseAccessRevision: user.caseAccessRevision ?? 0,
        canDispatch:
          user.caseAccessMode !== 'REPRESENTATION_ONLY' &&
          (user.canDispatch || user.role.name === 'ADMIN'),
        canEdit: await this.canCaseEdit(this.prisma, caseId, actor),
        manage_access:
          this.permission(user, 'CaseGovernance', 'manage_access') &&
          this.permission(user, 'User', 'write') &&
          user.caseAccessMode !== 'REPRESENTATION_ONLY',
        canExport: user.caseAccessMode !== 'REPRESENTATION_ONLY',
        canClone:
          user.caseAccessMode !== 'REPRESENTATION_ONLY' &&
          this.permission(user, 'Case', 'write'),
      },
    };
  }
  async globalCapabilities(actor: ActorContext) {
    const user = await this.activeActor(this.prisma, actor.actorId),
      internal = user.caseAccessMode !== 'REPRESENTATION_ONLY';
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: 'CASE_GOVERNANCE_V1' },
    });
    return {
      success: true,
      data: {
        actorId: user.id,
        enabled: flag?.enabled === true,
        caseAccessMode: user.caseAccessMode ?? 'INTERNAL',
        caseAccessRevision: user.caseAccessRevision ?? 0,
        operate: this.permission(user, 'CaseGovernance', 'operate'),
        review: this.permission(user, 'CaseGovernance', 'review'),
        publish: internal && this.permission(user, 'CaseGovernance', 'publish'),
        manage_access:
          internal &&
          this.permission(user, 'CaseGovernance', 'manage_access') &&
          this.permission(user, 'User', 'write'),
        canExport: internal && this.permission(user, 'Case', 'read'),
        canClone: internal && this.permission(user, 'Case', 'write'),
        canDispatch:
          internal && (user.canDispatch || user.role.name === 'ADMIN'),
        canRead: this.permission(user, 'Case', 'read'),
        canWrite: this.permission(user, 'Case', 'write'),
        share: this.permission(user, 'CaseGovernance', 'share'),
        download: this.permission(user, 'CaseGovernance', 'download'),
        custody: this.permission(user, 'CaseGovernance', 'custody'),
        dispose: this.permission(user, 'CaseGovernance', 'dispose'),
        read_sensitive: this.permission(
          user,
          'CaseGovernance',
          'read_sensitive',
        ),
      },
    };
  }
  async snapshot(caseId: string, actor: ActorContext) {
    const record = await this.assertCaseReadable(this.prisma, caseId, actor);
    const [handoffs, events] = await Promise.all([
      this.prisma.caseHandoff.findMany({
        where: { caseId },
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.caseGovernanceEvent.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return this.serializeGovernance(this.prisma, record, actor, {
      success: true,
      data: {
        caseId,
        updatedAt: record.updatedAt,
        intakeStage: record.intakeStage,
        investigationPhase: record.investigationPhase,
        governanceRevision: record.governanceRevision,
        governanceRuleVersionId: record.governanceRuleVersionId,
        fieldDefinitionVersionId: record.fieldDefinitionVersionId,
        caseType: record.caseType,
        assignedTeamId: record.assignedTeamId,
        investigatorId: record.investigatorId,
        sensitivity: record.sensitivity,
        handoffs,
        events,
      },
    });
  }
  async handoffInbox(actor: ActorContext) {
    const user = await this.activeActor(this.prisma, actor.actorId);
    if (user.caseAccessMode === 'REPRESENTATION_ONLY')
      throw new ForbiddenException('Staff receipt inbox required');
    if (!this.permission(user, 'Case', 'read')) throw new ForbiddenException();
    const rows = await this.prisma.caseHandoff.findMany({
      where: {
        state: 'PENDING',
        toTeam: {
          isActive: true,
          members: {
            some: { userId: actor.actorId, user: { isActive: true } },
          },
        },
        case: { deletedAt: null },
      },
      orderBy: { sentAt: 'asc' },
      include: { case: true },
    });
    const data: typeof rows = [];
    for (const row of rows) {
      try {
        await this.sensitive(this.prisma, row.case, user);
        data.push(
          await this.serializeGovernance(this.prisma, row.case, actor, row),
        );
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    return { success: true, data };
  }
  async sendHandoff(
    caseId: string,
    dto: SendHandoffInput,
    actor: ActorContext,
  ) {
    if (!dto || typeof dto.toTeamId !== 'string' || !dto.toTeamId.trim())
      throw new BadRequestException('Receiving team required');
    if (dto.reason !== undefined && typeof dto.reason !== 'string')
      throw new BadRequestException('Reason must be text');
    if (
      dto.recipientId !== undefined &&
      (typeof dto.recipientId !== 'string' ||
        !dto.recipientId.trim() ||
        dto.recipientId.length > 200)
    )
      throw new BadRequestException('Receiving staff identity must be text');
    return this.mutateAssignment(
      {
        caseId,
        operation: 'HANDOFF_SEND',
        requestKey: dto.requestKey,
        expectedUpdatedAt: dto.expectedUpdatedAt,
        payload: {
          toTeamId: dto.toTeamId,
          recipientId: dto.recipientId,
          reason: dto.reason,
          receiptChecklist: dto.receiptChecklist,
          shortcomings: dto.shortcomings,
        },
      },
      actor,
      async (tx, { caseRecord, operationId }) => {
        const user = await this.activeActor(tx, actor.actorId);
        if (user.caseAccessMode === 'REPRESENTATION_ONLY')
          throw new ForbiddenException('Staff receipt authority required');
        if (!user.canDispatch && user.role.name !== 'ADMIN')
          throw new ForbiddenException('Dispatch authority required');
        if (
          caseRecord.assignedTeamId === dto.toTeamId &&
          caseRecord.intakeStage === 'DA_NHAN'
        )
          throw new BadRequestException(
            'Use same-team assignment after receipt',
          );
        if (
          !(await tx.team.findFirst({
            where: { id: dto.toTeamId, isActive: true },
          }))
        )
          throw new BadRequestException('Receiving team inactive');
        if (dto.recipientId) {
          const member = await tx.userTeam.findFirst({
            where: {
              userId: dto.recipientId,
              teamId: dto.toTeamId,
              user: { isActive: true, caseAccessMode: 'INTERNAL' },
              team: { isActive: true },
            },
          });
          if (!member)
            throw new BadRequestException(
              'Designated staff recipient must be active in receiving team',
            );
        }
        const facts = await this.receiptFacts(tx, caseId, dto);
        const changed = await tx.case.updateMany({
          where: { id: caseId },
          data: { intakeStage: 'CHO_NHAN' },
        });
        if (changed.count !== 1) throw new ConflictException();
        const data = await tx.caseHandoff.create({
          data: {
            caseId,
            toTeamId: dto.toTeamId,
            fromTeamId: caseRecord.assignedTeamId,
            sentById: actor.actorId,
            priorIntakeStage: caseRecord.intakeStage,
            reason: dto.reason,
            recipientId: dto.recipientId,
            receiptFacts: facts,
          },
        });
        await this.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'HANDOFF_SENT',
          { handoffId: data.id, toTeamId: data.toTeamId },
        );
        const recipients = dto.recipientId
          ? [dto.recipientId]
          : (
              await tx.userTeam.findMany({
                where: {
                  teamId: dto.toTeamId,
                  user: { isActive: true, caseAccessMode: 'INTERNAL' },
                },
                select: { userId: true },
              })
            ).map((member) => member.userId);
        await this.enqueue(
          tx,
          caseId,
          operationId,
          { type: 'HANDOFF_SENT', handoffId: data.id },
          recipients,
        );
        return { success: true, data };
      },
    );
  }
  async resolveHandoff(
    caseId: string,
    handoffId: string,
    action: 'accept' | 'cancel' | 'return',
    dto: ResolveHandoffInput,
    actor: ActorContext,
  ) {
    if (!dto || (dto.reason !== undefined && typeof dto.reason !== 'string'))
      throw new BadRequestException('Resolution reason must be text');
    if (action !== 'accept' && !dto.reason?.trim())
      throw new BadRequestException('Resolution reason required');
    const aggregate = new Date(dto.expectedAggregateUpdatedAt);
    if (
      !dto.expectedAggregateUpdatedAt ||
      !Number.isFinite(aggregate.getTime())
    )
      throw new BadRequestException('Handoff version required');
    return this.mutate(
      {
        caseId,
        operation: 'HANDOFF_' + action.toUpperCase(),
        requestKey: dto.requestKey,
        expectedUpdatedAt: dto.expectedUpdatedAt,
        expectedAggregateUpdatedAt: dto.expectedAggregateUpdatedAt,
        payload: {
          handoffId,
          reason: dto.reason,
          receiptChecklist: dto.receiptChecklist,
          shortcomings: dto.shortcomings,
        },
      },
      actor,
      async (tx, { caseRecord, operationId }) => {
        if (
          (await this.activeActor(tx, actor.actorId)).caseAccessMode ===
          'REPRESENTATION_ONLY'
        )
          throw new ForbiddenException('Staff receipt authority required');
        const handoff = await tx.caseHandoff.findFirst({
          where: { id: handoffId, caseId },
        });
        if (!handoff) throw new NotFoundException('Handoff not found');
        if (
          handoff.state !== 'PENDING' ||
          caseRecord.intakeStage !== 'CHO_NHAN' ||
          handoff.updatedAt.getTime() !== aggregate.getTime()
        )
          throw new ConflictException('Handoff version changed');
        if (action === 'cancel') {
          const user = await this.activeActor(tx, actor.actorId);
          if (handoff.sentById !== actor.actorId && !user.canDispatch)
            throw new ForbiddenException('Sender or dispatcher required');
        } else if (
          !(await tx.userTeam.findFirst({
            where: {
              userId: actor.actorId,
              teamId: handoff.toTeamId,
              user: { isActive: true },
              team: { isActive: true },
            },
          }))
        )
          throw new ForbiddenException('Receiving team membership required');
        if (
          action !== 'cancel' &&
          handoff.recipientId &&
          handoff.recipientId !== actor.actorId
        )
          throw new ForbiddenException(
            'Designated receiving staff member required',
          );
        const facts = await this.receiptFacts(tx, caseId, dto);
        const state =
          action === 'accept'
            ? 'ACCEPTED'
            : action === 'cancel'
              ? 'CANCELLED'
              : 'RETURNED';
        const changed = await tx.caseHandoff.updateMany({
          where: {
            id: handoffId,
            caseId,
            state: 'PENDING',
            updatedAt: aggregate,
          },
          data: {
            state,
            resolvedById: actor.actorId,
            resolvedAt: new Date(),
            resolutionReason: dto.reason,
            resolutionFacts: facts,
          },
        });
        if (changed.count !== 1) throw new ConflictException('Handoff changed');
        await tx.case.update({
          where: { id: caseId },
          data:
            action === 'accept'
              ? {
                  intakeStage: 'DA_NHAN',
                  assignedTeamId: handoff.toTeamId,
                  investigatorId: null,
                }
              : { intakeStage: handoff.priorIntakeStage },
        });
        await this.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'HANDOFF_' + state,
          { handoffId, reason: dto.reason ?? null },
        );
        await this.enqueue(
          tx,
          caseId,
          operationId,
          { type: 'HANDOFF_' + state, handoffId },
          [handoff.sentById],
        );
        return {
          success: true,
          data: await tx.caseHandoff.findFirst({ where: { id: handoffId } }),
        };
      },
      { clearHandoff: true, recipient: action !== 'cancel' },
    );
  }
  async recordEvent(
    tx: Tx,
    caseId: string,
    operationId: string,
    actorId: string,
    type: string,
    payload: Prisma.InputJsonValue,
  ) {
    await tx.caseGovernanceEvent.create({
      data: { caseId, operationId, actorId, type, payload },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'CASE_' + type,
        subject: 'Case',
        subjectId: caseId,
        metadata: payload,
      },
    });
  }
  async ensureEnabled(tx: Tx = this.prisma): Promise<void> {
    const flag = await tx.featureFlag.findUnique({
      where: { key: 'CASE_GOVERNANCE_V1' },
    });
    if (!flag?.enabled)
      throw new ForbiddenException('Case governance is not enabled');
  }
  private async activeActor(tx: Tx, actorId: string): Promise<DbActor> {
    if (!actorId) throw new ForbiddenException('Authenticated actor required');
    const user = await tx.user.findUnique({
      where: { id: actorId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user?.isActive) throw new ForbiddenException('Actor is inactive');
    return user;
  }
  private permission(user: DbActor, subject: string, action: string): boolean {
    return user.role.permissions.some(
      ({ permission: p }) =>
        p.subject === subject && p.action === action && p.conditions === null,
    );
  }
  async hasCapability(
    tx: Tx,
    actorId: string,
    action: string,
  ): Promise<boolean> {
    try {
      return this.permission(
        await this.activeActor(tx, actorId),
        'CaseGovernance',
        action,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  }
  async currentScope(tx: Tx, actor: DbActor): Promise<DataScope | null> {
    if (actor.role.name === 'ADMIN') return null;
    const [memberships, teams, grants] = await Promise.all([
      tx.userTeam.findMany({
        where: { userId: actor.id, team: { isActive: true } },
        include: { team: true },
      }),
      tx.team.findMany({
        where: { isActive: true },
        select: { id: true, parentId: true },
      }),
      tx.dataAccessGrant.findMany({
        where: {
          granteeId: actor.id,
          team: { isActive: true },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    ]);
    const own = new Set(memberships.map((x) => x.teamId));
    for (let changed = true; changed; ) {
      changed = false;
      for (const team of teams)
        if (team.parentId && own.has(team.parentId) && !own.has(team.id)) {
          own.add(team.id);
          changed = true;
        }
    }
    const readable = new Set([...own, ...grants.map((x) => x.teamId)]);
    const writable = new Set([
      ...own,
      ...grants.filter((x) => x.accessLevel === 'WRITE').map((x) => x.teamId),
    ]);
    const members = await tx.userTeam.findMany({
      where: { teamId: { in: [...readable] }, user: { isActive: true } },
    });
    return {
      teamIds: [...readable],
      writableTeamIds: [...writable],
      userIds: [...new Set([actor.id, ...members.map((x) => x.userId)])],
      writableUserIds: [
        ...new Set([
          actor.id,
          ...members.filter((x) => writable.has(x.teamId)).map((x) => x.userId),
        ]),
      ],
      canDispatch: actor.canDispatch,
      isWardOfficer: memberships.some((x) => x.team.wardId !== null),
    };
  }
  async readableCaseWhere(
    tx: Tx,
    actor: ActorContext,
    options?: { includeDeleted?: boolean; representationCapability?: string },
  ): Promise<Prisma.CaseWhereInput> {
    const user = await this.activeActor(tx, actor.actorId);
    if (!this.permission(user, 'Case', 'read'))
      throw new ForbiddenException('Case read permission required');
    const scope = await this.currentScope(tx, user);
    // PostgreSQL JSON path absence and JSON null differ. Read the legacy labels
    // explicitly so absent metadata remains compatible and unknown labels fail closed.
    const legacy = await tx.$queryRaw<
      { id: string; label: string | null; legacyLabel?: string | null }[]
    >`SELECT id, metadata->>'sensitivity' AS label, metadata->>'_sensitivity' AS "legacyLabel" FROM cases WHERE (metadata->>'sensitivity' IS NOT NULL AND metadata->>'sensitivity' <> 'NORMAL') OR (metadata->>'_sensitivity' IS NOT NULL AND metadata->>'_sensitivity' <> 'NORMAL')`;
    const unknown = legacy
      .filter((x) =>
        [x.label, x.legacyLabel].some(
          (label) =>
            label != null && label !== 'NORMAL' && label !== 'RESTRICTED',
        ),
      )
      .map((x) => x.id);
    const restricted = legacy
      .filter((x) => [x.label, x.legacyLabel].includes('RESTRICTED'))
      .map((x) => x.id);
    const sensitivity: Prisma.CaseWhereInput = this.permission(
      user,
      'CaseGovernance',
      'read_sensitive',
    )
      ? {}
      : {
          OR: [
            { sensitivity: 'NORMAL', id: { notIn: restricted } },
            {
              caseGovernanceGrant_case: {
                some: {
                  granteeId: user.id,
                  startsAt: { lte: new Date() },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                  revokedAt: null,
                  capabilities: { array_contains: ['read_sensitive'] },
                },
              },
            },
          ],
        };
    return {
      AND: [
        ...(options?.includeDeleted ? [] : [{ deletedAt: null }]),
        { id: { notIn: unknown } },
        (buildScopeFilter(scope) ?? {}) as Prisma.CaseWhereInput,
        sensitivity,
        this.representationWhere(
          user,
          options?.representationCapability ?? 'list',
        ),
      ],
    };
  }
  private async sensitive(tx: Tx, record: Case, user: DbActor): Promise<void> {
    const meta = record.metadata as Record<string, unknown> | null;
    const labels = [meta?.sensitivity, meta?._sensitivity];
    if (
      record.sensitivity === 'NORMAL' &&
      labels.every(
        (label) => label === undefined || label === null || label === 'NORMAL',
      )
    )
      return;
    if (record.sensitivity !== 'NORMAL' && record.sensitivity !== 'RESTRICTED')
      throw new ForbiddenException('Unknown case sensitivity');
    if (
      labels.some(
        (label) =>
          label !== undefined &&
          label !== null &&
          label !== 'NORMAL' &&
          label !== 'RESTRICTED',
      )
    )
      throw new ForbiddenException('Unknown legacy sensitivity');
    if (this.permission(user, 'CaseGovernance', 'read_sensitive')) return;
    const grant = await tx.caseGovernanceGrant.findFirst({
      where: {
        caseId: record.id,
        granteeId: user.id,
        startsAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        revokedAt: null,
        capabilities: { array_contains: ['read_sensitive'] },
      },
    });
    if (!grant)
      throw new ForbiddenException(
        'Sensitive case access requires explicit authority',
      );
  }
  async assertCaseReadable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    _dataScope?: DataScope | null,
  ): Promise<Case> {
    void _dataScope;
    const user = await this.activeActor(tx, actor.actorId);
    if (!this.permission(user, 'Case', 'read'))
      throw new ForbiddenException('Case read permission required');
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Case not found');
    await this.representation(tx, caseId, user, 'view');
    assertParentInScope(record, await this.currentScope(tx, user), 'read');
    await this.sensitive(tx, record, user);
    return record;
  }
  async assertCaseWritable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
    _dataScope?: DataScope | null,
  ): Promise<Case> {
    void _dataScope;
    const record = await this.assertCaseReadable(tx, caseId, actor);
    const user = await this.activeActor(tx, actor.actorId);
    await this.representation(tx, caseId, user, 'edit');
    if (!this.permission(user, 'Case', 'edit'))
      throw new ForbiddenException('Case edit permission required');
    assertParentInScope(record, await this.currentScope(tx, user), 'write');
    if (
      record.intakeStage === 'CHO_NHAN' ||
      (await tx.caseHandoff.findFirst({ where: { caseId, state: 'PENDING' } }))
    )
      throw new ConflictException('Pending handoff protects this case');
    return record;
  }
  async assertCaseAssignable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<Case> {
    const record = await this.assertCaseReadable(tx, caseId, actor);
    const user = await this.activeActor(tx, actor.actorId);
    await this.representation(tx, caseId, user, 'edit');
    if (!user.canDispatch && user.role.name !== 'ADMIN')
      throw new ForbiddenException('Dispatch authority required');
    if (
      record.intakeStage === 'CHO_NHAN' ||
      (await tx.caseHandoff.findFirst({ where: { caseId, state: 'PENDING' } }))
    )
      throw new ConflictException('Pending handoff protects this case');
    return record;
  }
  async assertCaseCreation(
    tx: Tx,
    actor: ActorContext,
    parent: { assignedTeamId?: string | null; investigatorId?: string | null },
  ): Promise<void> {
    const user = await this.activeActor(tx, actor.actorId);
    if (!this.permission(user, 'Case', 'write'))
      throw new ForbiddenException('Case creation permission required');
    if (user.caseAccessMode === 'REPRESENTATION_ONLY')
      throw new ForbiddenException(
        'Representation-only principals cannot create ungranted Cases',
      );
    const scope = await this.currentScope(tx, user);
    if (
      parent.assignedTeamId &&
      scope &&
      !scope.writableTeamIds.includes(parent.assignedTeamId)
    )
      throw new ForbiddenException('Creation destination must be writable');
    if (parent.assignedTeamId || parent.investigatorId || !user.canDispatch)
      assertParentInScope(parent, scope, 'write');
    await this.validateAssignmentTarget(
      tx,
      parent.assignedTeamId ?? null,
      parent.investigatorId ?? null,
    );
  }
  async validateAssignmentTarget(
    tx: Tx,
    teamId: string | null,
    investigatorId: string | null,
  ): Promise<void> {
    if (
      teamId &&
      !(await tx.team.findFirst({ where: { id: teamId, isActive: true } }))
    )
      throw new BadRequestException('Active assignment team required');
    if (investigatorId) {
      if (!teamId)
        throw new BadRequestException(
          'Select a team before assigning an investigator',
        );
      if (
        !(await tx.userTeam.findFirst({
          where: {
            userId: investigatorId,
            teamId,
            user: { isActive: true },
            team: { isActive: true },
          },
        }))
      )
        throw new BadRequestException(
          'Investigator must be an active team member',
        );
    }
  }
  async assertCaseRestorable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<Case> {
    const user = await this.activeActor(tx, actor.actorId);
    await this.representation(tx, caseId, user, 'edit');
    if (!this.permission(user, 'Case', 'restore'))
      throw new ForbiddenException('Case restore permission required');
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: { not: null } },
    });
    if (!record) throw new NotFoundException('Deleted Case not found');
    assertParentInScope(record, await this.currentScope(tx, user), 'write');
    await this.sensitive(tx, record, user);
    if (
      record.intakeStage === 'CHO_NHAN' ||
      (await tx.caseHandoff.findFirst({ where: { caseId, state: 'PENDING' } }))
    )
      throw new ConflictException('Pending handoff protects this case');
    return record;
  }
  async mutateCase<T>(
    input: MutationInput,
    actor: ActorContext,
    handler: MutationHandler<T>,
  ): Promise<T> {
    return this.mutate(input, actor, handler);
  }
  async mutateAssignment<T>(
    input: MutationInput,
    actor: ActorContext,
    handler: MutationHandler<T>,
  ): Promise<T> {
    return this.mutate(input, actor, handler, { dispatch: true });
  }
  private async mutate<T>(
    input: MutationInput,
    actor: ActorContext,
    handler: MutationHandler<T>,
    options?: {
      clearHandoff?: boolean;
      recipient?: boolean;
      dispatch?: boolean;
    },
  ): Promise<T> {
    if (
      !input ||
      typeof input.requestKey !== 'string' ||
      !input.requestKey.trim() ||
      input.requestKey.length > 200 ||
      typeof input.operation !== 'string' ||
      !input.operation.trim()
    )
      throw new BadRequestException('Request key and operation required');
    const expected = new Date(input.expectedUpdatedAt);
    if (!input.expectedUpdatedAt || !Number.isFinite(expected.getTime()))
      throw new BadRequestException('Expected case version required');
    const hash = mutationHash(input, actor.actorId);
    const where = {
      actorId_caseId_operation_requestKey: {
        actorId: actor.actorId,
        caseId: input.caseId,
        operation: input.operation,
        requestKey: input.requestKey,
      },
    };
    const authorize = async (
      tx: Tx,
    ): Promise<{ record: Case; inspectionPurpose: string | undefined }> => {
      let inspectionPurpose: string | undefined;
      if (
        /^LEGAL_ACTION_(CREATE|REVISE|SUBMIT|REVIEW|EXECUTE)$/.test(
          input.operation,
        ) &&
        input.payload &&
        typeof input.payload === 'object' &&
        !Array.isArray(input.payload)
      ) {
        const body = input.payload as Record<string, unknown>;
        if (
          input.operation === 'LEGAL_ACTION_CREATE' &&
          body.actionCode === 'CLASSIFY_SENSITIVITY'
        )
          inspectionPurpose = (
            body.payload as Record<string, unknown> | undefined
          )?.inspectionPurpose as string | undefined;
        else if (typeof body.requestId === 'string') {
          const request = await tx.caseActionRequest.findFirst({
            where: { id: body.requestId, caseId: input.caseId },
          });
          if (request?.actionCode === 'CLASSIFY_SENSITIVITY')
            inspectionPurpose = (request.payload as Record<string, unknown>)
              ?.inspectionPurpose as string | undefined;
        }
      }
      const record = options?.recipient
        ? await this.recipientReadable(tx, input.caseId, actor)
        : inspectionPurpose !== undefined
          ? await this.assertClassificationInspectable(
              tx,
              input.caseId,
              actor,
              inspectionPurpose,
            )
          : await this.assertCaseReadable(tx, input.caseId, actor);
      return { record, inspectionPurpose };
    };
    const run = async (tx: Tx): Promise<T> => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.actorId} FOR SHARE`;
      const { record, inspectionPurpose } = await authorize(tx);
      const replay = await tx.caseGovernanceOperation.findUnique({ where });
      if (replay) {
        if (replay.contentHash !== hash || replay.result === null)
          throw new ConflictException('Request key content conflict');
        return this.serializeGovernance(tx, record, actor, replay.result as T);
      }
      if (!options?.clearHandoff) await this.ensureEnabled(tx);
      const capability =
        /EVIDENCE_(CUSTODY_APPEND|HOLD_ADD|HOLD_RELEASE)$/.test(input.operation)
          ? 'custody'
          : /EVIDENCE_(PACKET_REVIEW|DISPOSITION_REVIEW|RETENTION_REVIEW)$/.test(
                input.operation,
              )
            ? 'review'
            : input.operation === 'EVIDENCE_RETENTION_PUBLISH'
              ? 'publish'
              : /EVIDENCE_PACKET_(EXPORT|REVOKE)$/.test(input.operation)
                ? 'share'
                : input.operation === 'LEGAL_ACTION_REVIEW'
                  ? 'review'
                  : /EVIDENCE_DISPOSITION_(CREATE|REVISE|SUBMIT|EXECUTE)$/.test(
                        input.operation,
                      )
                    ? 'dispose'
                    : 'operate';
      if (!(await this.hasCapability(tx, actor.actorId, capability)))
        throw new ForbiddenException(
          'Governance operation capability required',
        );
      if (!options?.clearHandoff) {
        if (options?.dispatch)
          await this.assertCaseAssignable(tx, input.caseId, actor);
        else if (inspectionPurpose === undefined)
          await this.assertCaseWritable(tx, input.caseId, actor);
      } else if (!options.recipient) {
        const user = await this.activeActor(tx, actor.actorId);
        if (!this.permission(user, 'Case', 'edit'))
          throw new ForbiddenException();
        assertParentInScope(
          { ...record, intakeStage: null },
          await this.currentScope(tx, user),
          'write',
        );
      }
      if (record.updatedAt.getTime() !== expected.getTime())
        throw new ConflictException('Case version changed');
      const changed = await tx.case.updateMany({
        where: {
          id: record.id,
          updatedAt: record.updatedAt,
          status: record.status,
          intakeStage: record.intakeStage,
          investigatorId: record.investigatorId,
          assignedTeamId: record.assignedTeamId,
          deletedAt: null,
          governanceRevision: record.governanceRevision,
          sensitivity: record.sensitivity,
        },
        data: { governanceRevision: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException('Case snapshot changed');
      const operation = await tx.caseGovernanceOperation.create({
        data: {
          ...where.actorId_caseId_operation_requestKey,
          contentHash: hash,
        },
      });
      const result = await handler(tx, {
        caseRecord: record,
        actor: { actorId: actor.actorId, roleId: actor.roleId },
        operationId: operation.id,
      });
      const serialized = JSON.parse(
        JSON.stringify(result),
      ) as Prisma.InputJsonValue;
      await tx.caseGovernanceOperation.update({
        where: { id: operation.id },
        data: { result: serialized },
      });
      return this.serializeGovernance(tx, record, actor, serialized as T);
    };
    try {
      return await this.prisma.$transaction(run, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        ['P2002', 'P2025', 'P2034'].includes(
          (error as { code?: string }).code ?? '',
        )
      ) {
        const { record: current } = await authorize(this.prisma);
        const replay = await this.prisma.caseGovernanceOperation.findUnique({
          where,
        });
        if (replay?.contentHash === hash && replay.result !== null)
          return this.serializeGovernance(
            this.prisma,
            current,
            actor,
            replay.result as T,
          );
        throw new ConflictException(
          'Concurrent case operation; reload and retry',
        );
      }
      throw error;
    }
  }
  private async recipientReadable(
    tx: Tx,
    caseId: string,
    actor: ActorContext,
  ): Promise<Case> {
    const user = await this.activeActor(tx, actor.actorId);
    if (
      !this.permission(user, 'Case', 'read') ||
      !this.permission(user, 'Case', 'edit')
    )
      throw new ForbiddenException();
    const record = await tx.case.findFirst({
      where: { id: caseId, deletedAt: null },
    });
    if (!record) throw new NotFoundException();
    await this.representation(tx, caseId, user, 'view');
    await this.representation(tx, caseId, user, 'edit');
    await this.sensitive(tx, record, user);
    const handoff = await tx.caseHandoff.findFirst({
      where: {
        caseId,
        OR: [{ state: 'PENDING' }, { resolvedById: actor.actorId }],
        toTeam: {
          isActive: true,
          members: {
            some: { userId: actor.actorId, user: { isActive: true } },
          },
        },
      },
    });
    if (!handoff)
      throw new ForbiddenException(
        'Only an active receiving team member may resolve handoff',
      );
    return record;
  }
  async enqueue(
    tx: Tx,
    caseId: string,
    operationId: string,
    event: Prisma.InputJsonValue,
    recipientIds: string[],
  ) {
    for (const recipientId of [...new Set(recipientIds)])
      await tx.caseGovernanceOutbox.create({
        data: { caseId, operationId, event, recipientId },
      });
  }
}
