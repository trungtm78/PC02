import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Case, Incident, Petition, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { CaseFieldSchemaService } from '../cases/governance/case-field-schema.service';
import {
  canonicalJson,
  mutationHash,
} from '../cases/governance/case-governance.contract';
import { normalizeCanonicalCaseWrite } from '../cases/case-canonical-fields';
import { assertParentInScope } from '../common/utils/scope-filter.util';
import type { DataScope } from '../auth/services/unit-scope.service';

type Tx = Prisma.TransactionClient;
export interface SourceCreationCommand {
  kind: 'Incident' | 'Petition';
  sourceId: string;
  expectedUpdatedAt?: string;
  requestKey?: string;
  payload: Record<string, unknown>;
}
export interface SourceCreationContext {
  enabled: boolean;
  scope: DataScope | null;
  prepare(
    data: Prisma.CaseUncheckedCreateInput,
  ): Promise<Prisma.CaseUncheckedCreateInput>;
}
@Injectable()
export class CaseSourceCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
    private readonly fields: CaseFieldSchemaService,
  ) {}

  async execute(
    input: SourceCreationCommand,
    actorId: string,
    handler: (
      tx: Tx,
      source: Incident | Petition,
      context: SourceCreationContext,
    ) => Promise<Case>,
  ): Promise<{ caseRecord: Case; replayed: boolean }> {
    if (!actorId)
      throw new ForbiddenException(
        'Current authenticated source actor required',
      );
    if (
      input.requestKey !== undefined &&
      (typeof input.requestKey !== 'string' ||
        !input.requestKey.trim() ||
        input.requestKey.length > 200)
    )
      throw new BadRequestException('Bounded source request key required');
    const payload = Object.fromEntries(
      Object.entries(input.payload).filter(
        ([key]) => !['requestKey', 'expectedUpdatedAt'].includes(key),
      ),
    );
    const actor = { actorId };
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId} FOR SHARE`;
          const user = await tx.user.findUnique({
            where: { id: actorId },
            select: { roleId: true },
          });
          if (!user)
            throw new ForbiddenException('Current source actor unavailable');
          await tx.$queryRaw`SELECT id FROM roles WHERE id = ${user.roleId} FOR SHARE`;
          if (
            !(await this.core.hasEntityPermission(
              tx,
              actorId,
              input.kind,
              'edit',
            ))
          )
            throw new ForbiddenException(
              'Current source edit permission required',
            );
          if (
            (await this.core.accessProfile(tx, actor)).caseAccessMode !==
            'INTERNAL'
          )
            throw new ForbiddenException(
              'Internal source Case creation required',
            );
          if (input.kind === 'Incident')
            await tx.$queryRaw`SELECT id FROM incidents WHERE id = ${input.sourceId} FOR UPDATE`;
          else
            await tx.$queryRaw`SELECT id FROM petitions WHERE id = ${input.sourceId} FOR UPDATE`;
          const source =
            input.kind === 'Incident'
              ? await tx.incident.findFirst({
                  where: { id: input.sourceId, deletedAt: null },
                })
              : await tx.petition.findFirst({
                  where: { id: input.sourceId, deletedAt: null },
                });
          if (!source)
            throw new NotFoundException('Current source record not found');
          const scope = await this.core.currentActorScope(tx, actor);
          const parent = {
            assignedTeamId: source.assignedTeamId,
            investigatorId:
              input.kind === 'Incident'
                ? (source as Incident).investigatorId
                : (source as Petition).assignedToId,
          };
          assertParentInScope(parent, scope, 'write');
          await this.core.assertCaseCreation(tx, actor, parent);
          const enabled = !!(
            await tx.featureFlag.findUnique({
              where: { key: 'CASE_GOVERNANCE_V1' },
            })
          )?.enabled;
          if (
            (enabled || input.kind === 'Petition') &&
            !input.expectedUpdatedAt
          )
            throw new BadRequestException(
              'Actual source expectedUpdatedAt required',
            );
          const expected = input.expectedUpdatedAt
            ? new Date(input.expectedUpdatedAt)
            : source.updatedAt;
          if (!Number.isFinite(expected.getTime()))
            throw new BadRequestException('Valid source version required');
          const operation =
            'SOURCE_' + input.kind.toUpperCase() + '_CASE_CREATE';
          const contentHash = mutationHash(
            {
              caseId: input.sourceId,
              operation,
              payload,
              expectedUpdatedAt: expected.toISOString(),
            },
            actorId,
          );
          const requestKey = input.requestKey ?? 'derived-' + contentHash;
          const operationId =
            'case-source-' +
            createHash('sha256')
              .update(
                canonicalJson({
                  actorId,
                  sourceId: input.sourceId,
                  operation,
                  requestKey,
                }),
              )
              .digest('hex');
          const replay = await tx.caseGovernanceOperation.findUnique({
            where: { id: operationId },
          });
          if (replay) {
            if (replay.contentHash !== contentHash)
              throw new ConflictException(
                'Source request key content conflict',
              );
            if (source.linkedCaseId !== replay.caseId)
              throw new ConflictException(
                'Source lineage changed since creation',
              );
            const caseRecord = await this.core.assertCaseReadable(
              tx,
              replay.caseId,
              actor,
            );
            await this.core.assertCaseCreation(tx, actor, caseRecord);
            return {
              caseRecord: await this.core.serializeCaseResult(
                tx,
                caseRecord.id,
                caseRecord,
                actor,
              ),
              replayed: true,
            };
          }
          if (source.updatedAt.getTime() !== expected.getTime())
            throw new ConflictException('Source record changed');
          const caseRecord = await handler(tx, source, {
            enabled,
            scope,
            prepare: async (data) => {
              const metadata =
                data.metadata &&
                typeof data.metadata === 'object' &&
                !Array.isArray(data.metadata)
                  ? data.metadata
                  : {};
              const withCustom = {
                ...data,
                ...(input.payload.caseCustomFields !== undefined
                  ? {
                      metadata: {
                        ...metadata,
                        _customFields: input.payload.caseCustomFields,
                      },
                    }
                  : {}),
              };
              const plain = Object.fromEntries(
                Object.entries(withCustom).map(([key, value]) => [
                  key,
                  value instanceof Date ? value.toISOString() : value,
                ]),
              );
              const canonical = normalizeCanonicalCaseWrite(plain);
              const validated = await this.fields.validateForWrite(
                tx,
                canonical,
                null,
                actor,
              );
              const normalized = Object.fromEntries(
                Object.entries(canonical).map(([key, value]) => [
                  key,
                  (data as unknown as Record<string, unknown>)[key] instanceof
                    Date && typeof value === 'string'
                    ? new Date(value)
                    : value,
                ]),
              );
              return {
                ...normalized,
                createdById: actorId,
                assignedTeamId: parent.assignedTeamId,
                investigatorId: parent.investigatorId,
                ...(enabled ? { intakeStage: 'PHAN_LOAI' } : {}),
                fieldDefinitionVersionId: validated.fieldDefinitionVersionId,
                metadata: validated.metadata as Prisma.InputJsonValue,
              } as Prisma.CaseUncheckedCreateInput;
            },
          });
          await tx.caseGovernanceOperation.create({
            data: {
              id: operationId,
              actorId,
              caseId: caseRecord.id,
              operation,
              requestKey,
              contentHash,
              result: {
                sourceId: input.sourceId,
                sourceKind: input.kind,
                expectedSourceUpdatedAt: expected.toISOString(),
                caseId: caseRecord.id,
              },
            },
          });
          await this.core.recordEvent(
            tx,
            caseRecord.id,
            operationId,
            actorId,
            'SOURCE_CASE_CREATED',
            {
              sourceId: input.sourceId,
              sourceKind: input.kind,
              expectedSourceUpdatedAt: expected.toISOString(),
            },
          );
          await this.core.enqueue(
            tx,
            caseRecord.id,
            operationId,
            {
              type: 'CASE_CREATED',
              sourceId: input.sourceId,
              sourceKind: input.kind,
            },
            [actorId],
          );
          return {
            caseRecord: await this.core.serializeCaseResult(
              tx,
              caseRecord.id,
              caseRecord,
              actor,
            ),
            replayed: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2034', 'P2025'].includes(String(error.code))
      )
        throw new ConflictException(
          'Current source authority/version changed; reload and retry',
        );
      throw error;
    }
  }
}
