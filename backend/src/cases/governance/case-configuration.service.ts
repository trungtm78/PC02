import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from './case-governance.service';
import { ActorContext, canonicalJson } from './case-governance.contract';
import { createHash } from 'node:crypto';
import { civilDate, nonblank, object } from './legal-workflow.validation';
import {
  validateRuleDefinition,
  validateFieldDefinition,
} from './configuration.validation';
export type ConfigurationKind = 'rules' | 'fields';
export interface ConfigurationVersion {
  expectedUpdatedAt: string;
  expectedRevision: number;
}
export function configurationHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
@Injectable()
export class CaseConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
  ) {}
  private model(
    tx: Prisma.TransactionClient,
    kind: ConfigurationKind,
  ): Prisma.CaseFieldDefinitionVersionDelegate {
    return (
      kind === 'rules' ? tx.caseRuleVersion : tx.caseFieldDefinitionVersion
    ) as Prisma.CaseFieldDefinitionVersionDelegate;
  }
  private async require(
    tx: Prisma.TransactionClient,
    actor: ActorContext,
    cap: string,
  ) {
    if (
      (await this.core.accessProfile(tx, actor)).caseAccessMode !== 'INTERNAL'
    )
      throw new ForbiddenException('Internal configuration authority required');
    await this.core.ensureEnabled(tx);
    if (!(await this.core.hasCapability(tx, actor.actorId, cap)))
      throw new ForbiddenException(`Explicit ${cap} required`);
  }
  async list(kind: ConfigurationKind, actor: ActorContext) {
    if (
      (await this.core.accessProfile(this.prisma, actor)).caseAccessMode !==
      'INTERNAL'
    )
      throw new ForbiddenException('Internal configuration access required');
    await this.core.readableCaseWhere(this.prisma, actor);
    return {
      success: true,
      data: await this.model(this.prisma, kind).findMany({
        orderBy: [{ code: 'asc' }, { revision: 'desc' }],
      }),
    };
  }
  async create(
    kind: ConfigurationKind,
    dto: {
      code: string;
      definition: unknown;
      requestKey: string;
      effectiveFrom?: string;
      effectiveTo?: string;
    },
    actor: ActorContext,
  ) {
    const code = nonblank(dto.code, 'Configuration code'),
      key = nonblank(dto.requestKey, 'Request key'),
      definition = object(dto.definition);
    const hash = configurationHash({
      definition,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
    });
    const id = configurationHash({ kind, actorId: actor.actorId, code, key });
    return this.prisma.$transaction(
      async (tx) => {
        await this.require(tx, actor, 'operate');
        const existing = await this.model(tx, kind).findUnique({
          where: { id },
        });
        if (existing) {
          if (existing.contentHash !== hash)
            throw new ConflictException('Request key conflict');
          return { success: true, data: existing };
        }
        const latest = await this.model(tx, kind).findFirst({
          where: { code },
          orderBy: { revision: 'desc' },
        });
        const data = {
          id,
          code,
          revision: (latest?.revision ?? 0) + 1,
          definition: definition as Prisma.InputJsonValue,
          contentHash: hash,
          authorId: actor.actorId,
        };
        const row =
          kind === 'rules'
            ? await tx.caseRuleVersion.create({
                data: {
                  ...data,
                  legalSources: [],
                  effectiveFrom: dto.effectiveFrom
                    ? civilDate(dto.effectiveFrom)
                    : null,
                  effectiveTo: dto.effectiveTo
                    ? civilDate(dto.effectiveTo)
                    : null,
                },
              })
            : await tx.caseFieldDefinitionVersion.create({ data });
        await tx.auditLog.create({
          data: {
            userId: actor.actorId,
            action: 'CASE_CONFIG_DRAFT',
            subject: 'CaseGovernance',
            subjectId: row.id,
            metadata: { kind, revision: row.revision },
          },
        });
        return { success: true, data: row };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async revise(
    kind: ConfigurationKind,
    id: string,
    dto: ConfigurationVersion & {
      definition: unknown;
      effectiveFrom?: string;
      effectiveTo?: string;
    },
    actor: ActorContext,
  ) {
    const definition = object(dto.definition);
    return this.prisma.$transaction(
      async (tx) => {
        await this.require(tx, actor, 'operate');
        const row = await this.load(tx, kind, id, dto);
        if (['PUBLISHED', 'SUPERSEDED'].includes(row.status))
          throw new ConflictException(
            'Published revision immutable; create a new revision',
          );
        if (row.authorId !== actor.actorId)
          throw new ForbiddenException('Author required');
        const changed = await this.model(tx, kind).updateMany({
          where: {
            id,
            revision: row.revision,
            updatedAt: row.updatedAt,
            status: row.status,
          },
          data: {
            definition: definition as Prisma.InputJsonValue,
            revision: { increment: 1 },
            status: 'DRAFT',
            contentHash: configurationHash({
              definition,
              effectiveFrom: dto.effectiveFrom,
              effectiveTo: dto.effectiveTo,
            }),
            approvedHash: null,
            approvedRevision: null,
            reviewedById: null,
            reviewedAt: null,
          },
        });
        if (changed.count !== 1) throw new ConflictException();
        if (kind === 'rules')
          await tx.caseRuleVersion.update({
            where: { id },
            data: {
              sourceVerified: false,
              legalSources: [],
              effectiveFrom: dto.effectiveFrom
                ? civilDate(dto.effectiveFrom)
                : null,
              effectiveTo: dto.effectiveTo ? civilDate(dto.effectiveTo) : null,
            },
          });
        await tx.auditLog.create({
          data: {
            userId: actor.actorId,
            action: 'CASE_CONFIG_REVISED',
            subject: 'CaseGovernance',
            subjectId: id,
            metadata: { kind },
          },
        });
        return {
          success: true,
          data: await this.model(tx, kind).findUnique({ where: { id } }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  private async load(
    tx: Prisma.TransactionClient,
    kind: ConfigurationKind,
    id: string,
    dto: ConfigurationVersion,
  ) {
    const row = await this.model(tx, kind).findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    const date = new Date(dto.expectedUpdatedAt);
    if (
      !Number.isSafeInteger(dto.expectedRevision) ||
      dto.expectedRevision < 1 ||
      !Number.isFinite(date.getTime()) ||
      date.getTime() !== row.updatedAt.getTime() ||
      row.revision !== dto.expectedRevision
    )
      throw new ConflictException('Configuration version changed');
    return row;
  }
  async transition(
    kind: ConfigurationKind,
    id: string,
    action: 'validate' | 'review' | 'publish',
    dto: ConfigurationVersion,
    actor: ActorContext,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.require(
          tx,
          actor,
          action === 'publish'
            ? 'publish'
            : action === 'review'
              ? 'review'
              : 'operate',
        );
        const row = await this.load(tx, kind, id, dto);
        if (kind === 'rules') validateRuleDefinition(row.definition);
        else validateFieldDefinition(row.definition);
        if (['PUBLISHED', 'SUPERSEDED'].includes(row.status))
          throw new ConflictException('Published revision immutable');
        let data: Prisma.CaseFieldDefinitionVersionUncheckedUpdateManyInput =
          {};
        if (action === 'validate') {
          if (row.authorId !== actor.actorId || row.status !== 'DRAFT')
            throw new ForbiddenException('Author draft required');
          data = { status: 'VALIDATED' };
          if (kind === 'rules') {
            const r = await tx.caseRuleVersion.findUnique({ where: { id } });
            if (
              !r?.effectiveFrom ||
              (r.effectiveTo && r.effectiveTo <= r.effectiveFrom)
            )
              throw new BadRequestException(
                'Effective legal interval required',
              );
          }
        } else if (action === 'review') {
          if (row.authorId === actor.actorId || row.status !== 'VALIDATED')
            throw new ForbiddenException(
              'Independent reviewer and validated revision required',
            );
          data = {
            status: 'REVIEWED',
            reviewedById: actor.actorId,
            reviewedAt: new Date(),
            approvedHash: row.contentHash,
            approvedRevision: row.revision,
          };
        } else {
          if (
            row.authorId === actor.actorId ||
            row.status !== 'REVIEWED' ||
            !row.reviewedById ||
            row.reviewedById === row.authorId ||
            row.approvedHash !== row.contentHash ||
            row.approvedRevision !== row.revision
          )
            throw new ForbiddenException('Exact independent approval required');
          data = { status: 'PUBLISHED', publishedAt: new Date() };
        }
        const changed = await this.model(tx, kind).updateMany({
          where: {
            id,
            revision: row.revision,
            status: row.status,
            updatedAt: row.updatedAt,
          },
          data,
        });
        if (changed.count !== 1) throw new ConflictException();
        if (kind === 'rules' && action === 'review')
          await tx.caseRuleVersion.update({
            where: { id },
            data: {
              sourceVerified: true,
              legalSources: (
                object(row.definition).actions as Record<string, unknown>[]
              ).flatMap((a) =>
                (a.legalSources as Prisma.InputJsonValue[]).map((s) => ({
                  actionCode: a.code,
                  source: s,
                })),
              ) as Prisma.InputJsonValue,
            },
          });
        await tx.auditLog.create({
          data: {
            userId: actor.actorId,
            action: 'CASE_CONFIG_' + action.toUpperCase(),
            subject: 'CaseGovernance',
            subjectId: id,
            metadata: {
              kind,
              revision: row.revision,
              contentHash: row.contentHash,
            },
          },
        });
        return { success: true, data: { ...row, ...data } };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
