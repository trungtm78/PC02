import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Case, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { ActorContext } from '../cases/governance/case-governance.contract';
import {
  isPublishedFieldSchema,
  nativePolicyAliases,
  NativeFieldPolicy,
  redactCaseFieldPolicies,
} from '../cases/governance/case-native-field-policy';
import { assertParentInScope } from '../common/utils/scope-filter.util';

type Tx = Prisma.TransactionClient;
@Injectable()
export class CaseChildAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
  ) {}

  private actor(actorId?: string): ActorContext {
    if (!actorId)
      throw new ForbiddenException('Authenticated current actor required');
    return { actorId };
  }
  async listWhere(actorId?: string, tx: Tx = this.prisma) {
    return this.core.readableCaseWhere(tx, this.actor(actorId), {
      representationCapability: 'view',
    });
  }
  async read(caseId: string, actorId?: string, tx: Tx = this.prisma) {
    return this.core.assertCaseReadable(tx, caseId, this.actor(actorId));
  }
  async serialize<T>(
    caseId: string,
    row: T,
    actorId?: string,
    tx: Tx = this.prisma,
    purpose: 'read' | 'export' = 'read',
  ): Promise<T> {
    const actor = this.actor(actorId);
    if (!row || typeof row !== 'object') return row;
    const result = { ...row } as Record<string, unknown>;
    for (const key of ['case', 'relatedCase']) {
      if (result[key]) {
        result[key] = await this.core.serializeCaseResult(
          tx,
          caseId,
          result[key],
          actor,
        );
        if (purpose === 'export') {
          const parent = await this.core.assertCaseReadable(tx, caseId, actor);
          if (parent.fieldDefinitionVersionId) {
            const schema = await tx.caseFieldDefinitionVersion.findUnique({
              where: { id: parent.fieldDefinitionVersionId },
            });
            if (!schema || !isPublishedFieldSchema(schema))
              throw new ForbiddenException('Pinned export policy unavailable');
            result[key] = redactCaseFieldPolicies(
              result[key],
              schema.definition,
              await this.core.hasSensitiveAccess(tx, caseId, actor),
              'export',
            );
          }
        }
      }
    }
    return result as T;
  }
  async entity(
    subject: string,
    action: string,
    actorId?: string,
    tx: Tx = this.prisma,
  ) {
    const actor = this.actor(actorId);
    if (
      !(await this.core.hasEntityPermission(tx, actor.actorId, subject, action))
    )
      throw new ForbiddenException('Current child entity permission required');
  }
  async scope(actorId?: string, tx: Tx = this.prisma) {
    return this.core.currentActorScope(tx, this.actor(actorId));
  }
  async assertExport(subject: string, actorId: string, tx: Tx = this.prisma) {
    const actor = this.actor(actorId);
    await this.entity(subject, 'read', actorId, tx);
    await this.core.assertGeneralExport(tx, actor);
  }
  async redactCaseLinks<T>(
    value: T,
    actorId: string,
    tx: Tx = this.prisma,
  ): Promise<T> {
    const actor = this.actor(actorId);
    const cache = new Map<string, Promise<Case | null>>();
    const parent = (id: string) => {
      if (!cache.has(id))
        cache.set(
          id,
          this.core.assertCaseReadable(tx, id, actor).catch((error) => {
            if (
              error instanceof ForbiddenException ||
              error instanceof NotFoundException
            )
              return null;
            throw error;
          }),
        );
      return cache.get(id)!;
    };
    const visit = async (input: unknown): Promise<unknown> => {
      if (
        !input ||
        typeof input !== 'object' ||
        input instanceof Date ||
        Buffer.isBuffer(input)
      )
        return input;
      if (Array.isArray(input)) return Promise.all(input.map(visit));
      const result: Record<string, unknown> = { ...input };
      for (const [key, item] of Object.entries(result)) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) continue;
        if (
          /^(?:linked|related|source|target|unlinked)?caseId$/i.test(key) &&
          typeof item === 'string'
        ) {
          const visible = await parent(item);
          if (!visible) {
            delete result[key];
            for (const label of ['caseName', 'caseCode', 'caseStatus'])
              delete result[label];
          } else {
            const proof = await this.core.serializeCaseResult(
              tx,
              item,
              { name: true, caseCode: true, status: true },
              actor,
            );
            if (!('name' in proof)) delete result.caseName;
            if (!('caseCode' in proof)) delete result.caseCode;
            if (!('status' in proof)) delete result.caseStatus;
          }
        } else if (
          item &&
          typeof item === 'object' &&
          'id' in item &&
          typeof item.id === 'string' &&
          ([
            'case',
            'linkedCase',
            'relatedCase',
            'sourceCase',
            'targetCase',
            'otherCase',
            'parentCase',
          ].includes(key) ||
            (key === 'sourceSnapshot' &&
              ('caseCode' in item ||
                'caseType' in item ||
                ('entityType' in item &&
                  ['CASE', 'VU_AN'].includes(String(item.entityType))))))
        ) {
          if (!(await parent(item.id))) delete result[key];
          else
            result[key] = await this.core.serializeCaseResult(
              tx,
              item.id,
              item,
              actor,
            );
        } else result[key] = await visit(item);
      }
      return result;
    };
    return (await visit(value)) as T;
  }
  async sourceDeletion<T>(
    kind: 'Incident' | 'Petition',
    id: string,
    actorId: string,
    handler: (tx: Tx) => Promise<T>,
    tx?: Tx,
    action: 'delete' | 'edit' = 'delete',
  ): Promise<T> {
    const run = async (current: Tx) => {
      const source =
        kind === 'Incident'
          ? await current.incident.findUnique({
              where: { id },
              select: {
                linkedCaseId: true,
                assignedTeamId: true,
                investigatorId: true,
              },
            })
          : await current.petition.findUnique({
              where: { id },
              select: {
                linkedCaseId: true,
                assignedTeamId: true,
                assignedToId: true,
              },
            });
      const cases = await current.case.findMany({
        where: {
          OR: [
            kind === 'Incident'
              ? { linkedIncidentId: id }
              : { linkedPetitionId: id },
            ...(source?.linkedCaseId ? [{ id: source.linkedCaseId }] : []),
          ],
        },
        select: { id: true },
      });
      return this.writeInTransaction(
        current,
        cases.map((row) => row.id),
        actorId,
        kind,
        action,
        async (scoped, parents) => {
          if (!source)
            throw new NotFoundException('Current source record not found');
          assertParentInScope(
            {
              assignedTeamId: source.assignedTeamId,
              investigatorId:
                'investigatorId' in source
                  ? source.investigatorId
                  : source.assignedToId,
            },
            await this.scope(actorId, scoped),
            'write',
          );
          for (const parent of parents) {
            if (
              parent.governanceRevision > 0 ||
              parent.governanceRuleVersionId ||
              parent.fieldDefinitionVersionId ||
              parent.intakeStage
            )
              throw new ConflictException(
                'Governed source identity must be preserved',
              );
            if (
              await scoped.caseEvidenceHold.findFirst({
                where: { caseId: parent.id, releasedAt: null },
                select: { id: true },
              })
            )
              throw new ConflictException(
                'Preserved Case source cannot be deleted',
              );
          }
          return handler(scoped);
        },
      );
    };
    return tx ? run(tx) : this.transaction(run);
  }

  async sourceMerge<T>(
    sourceId: string,
    targetId: string,
    actorId: string,
    handler: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.transaction((tx) =>
      this.sourceDeletion(
        'Incident',
        sourceId,
        actorId,
        async (current) => {
          const document = await current.document.findFirst({
            where: { incidentId: sourceId, caseId: { not: null } },
            select: { id: true },
          });
          const petitions = await current.petition.findMany({
            where: { linkedIncidentId: sourceId },
            select: { id: true, linkedCaseId: true },
          });
          const parent = petitions.length
            ? await current.case.findFirst({
                where: {
                  linkedPetitionId: { in: petitions.map((row) => row.id) },
                },
                select: { id: true },
              })
            : null;
          if (document || parent || petitions.some((row) => row.linkedCaseId))
            throw new ConflictException(
              'Case-owned source documents and lineage must be preserved',
            );
          return this.sourceDeletion(
            'Incident',
            targetId,
            actorId,
            handler,
            current,
            'edit',
          );
        },
        tx,
        'edit',
      ),
    );
  }

  /** Parent-field search partitions are attached to their own OR branch. */
  async parentSearchWhere(
    predicate: Record<string, unknown>,
    actorId?: string,
    tx: Tx = this.prisma,
  ): Promise<Prisma.CaseWhereInput> {
    const actor = this.actor(actorId);
    const visible = await this.listWhere(actorId, tx);
    const keys = new Set<string>();
    const scan = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(scan);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (!['AND', 'OR', 'NOT', 'is', 'isNot'].includes(key)) keys.add(key);
        else scan(child);
      }
    };
    scan(predicate);
    const schemas = await tx.caseFieldDefinitionVersion.findMany({
      where: { cases: { some: visible } },
    });
    const fullSensitive = await this.core.hasCapability(
      tx,
      actor.actorId,
      'read_sensitive',
    );
    const partitions: Prisma.CaseWhereInput[] = [
      { fieldDefinitionVersionId: null },
    ];
    for (const schema of schemas) {
      if (!isPublishedFieldSchema(schema)) continue;
      const policies =
        (
          schema.definition as unknown as {
            fieldPolicies?: NativeFieldPolicy[];
          }
        ).fieldPolicies ?? [];
      const relevant = policies.filter((p) =>
        nativePolicyAliases(p.key).some((key) => keys.has(key)),
      );
      if (relevant.some((p) => p.searchable === false)) continue;
      const restricted = relevant.some((p) => p.sensitivity === 'RESTRICTED');
      partitions.push({
        fieldDefinitionVersionId: schema.id,
        ...(!restricted || fullSensitive
          ? {}
          : {
              caseGovernanceGrant_case: {
                some: {
                  granteeId: actor.actorId,
                  revokedAt: null,
                  startsAt: { lte: new Date() },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                  capabilities: { array_contains: ['read_sensitive'] },
                },
              },
            }),
      });
    }
    return {
      AND: [visible, predicate as Prisma.CaseWhereInput, { OR: partitions }],
    };
  }
  async policyQuery<T>(
    where: T,
    relation: string,
    actorId?: string,
    tx: Tx = this.prisma,
  ): Promise<T> {
    if (Array.isArray(where))
      return (await Promise.all(
        where.map((value) => this.policyQuery(value, relation, actorId, tx)),
      )) as T;
    if (!where || typeof where !== 'object') return where;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(where)) {
      if (key === relation && value && typeof value === 'object') {
        const raw = value as Record<string, unknown>;
        if (raw.is && typeof raw.is === 'object')
          result[key] = {
            ...raw,
            is: await this.parentSearchWhere(
              raw.is as Record<string, unknown>,
              actorId,
              tx,
            ),
          };
        else result[key] = await this.parentSearchWhere(raw, actorId, tx);
      } else if (['AND', 'OR', 'NOT'].includes(key))
        result[key] = await this.policyQuery(value, relation, actorId, tx);
      else result[key] = value;
    }
    return result as T;
  }

  async write<T>(
    caseIds: string[],
    actorId: string,
    subject: string,
    action: string,
    handler: (tx: Tx, parents: Case[]) => Promise<T>,
  ): Promise<T> {
    return this.transaction((tx) =>
      this.writeInTransaction(tx, caseIds, actorId, subject, action, handler),
    );
  }
  parent(parents: Case[], caseId: string): Case {
    const parent = parents.find((item) => item.id === caseId);
    if (!parent)
      throw new ConflictException(
        'Current Case parent changed; reload and retry',
      );
    return parent;
  }
  async transaction<T>(handler: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(handler, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'Current Case authority changed; reload and retry',
        );
      throw error;
    }
  }
  async writeInTransaction<T>(
    tx: Tx,
    caseIds: string[],
    actorId: string,
    subject: string,
    action: string,
    handler: (tx: Tx, parents: Case[]) => Promise<T>,
  ): Promise<T> {
    const actor = this.actor(actorId);
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.actorId} FOR UPDATE`;
    const current = await tx.user.findUnique({
      where: { id: actor.actorId },
      select: { roleId: true },
    });
    if (!current) throw new ForbiddenException('Current actor unavailable');
    await tx.$queryRaw`SELECT id FROM roles WHERE id = ${current.roleId} FOR UPDATE`;
    await this.entity(subject, action, actorId, tx);
    const parents: Case[] = [];
    for (const id of [...new Set(caseIds)].sort())
      parents.push(await this.core.assertCaseWritable(tx, id, actor));
    const result = await handler(tx, parents);
    for (const parent of parents) {
      await this.core.assertCaseWritable(tx, parent.id, actor);
      const changed = await tx.case.updateMany({
        where: {
          id: parent.id,
          updatedAt: parent.updatedAt,
          governanceRevision: parent.governanceRevision,
        },
        data: { governanceRevision: { increment: 1 }, updatedAt: new Date() },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Case parent changed during child mutation',
        );
    }
    return result;
  }
}
