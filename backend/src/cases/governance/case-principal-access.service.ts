import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CaseAccessMode, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from './case-governance.service';
import {
  canonicalJson,
  mutationHash,
  ActorContext,
} from './case-governance.contract';
import { businessCredentialInvalidation } from '../../admin/case-authority.guard';
export interface PrincipalAccessInput {
  caseAccessMode: CaseAccessMode;
  expectedUserUpdatedAt: string;
  expectedCaseAccessRevision: number;
  requestKey: string;
  reason: string;
}
@Injectable()
export class CasePrincipalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
  ) {}
  async change(userId: string, dto: PrincipalAccessInput, actor: ActorContext) {
    if (
      !dto ||
      !['INTERNAL', 'REPRESENTATION_ONLY'].includes(dto.caseAccessMode) ||
      typeof dto.reason !== 'string' ||
      dto.reason.trim().length < 10 ||
      dto.reason.length > 1000 ||
      typeof dto.requestKey !== 'string' ||
      !dto.requestKey.trim() ||
      dto.requestKey.length > 200 ||
      !Number.isInteger(dto.expectedCaseAccessRevision) ||
      dto.expectedCaseAccessRevision < 0
    )
      throw new BadRequestException(
        'Access mode, revision, request key and reason required',
      );
    const expected = new Date(dto.expectedUserUpdatedAt);
    if (!Number.isFinite(expected.getTime()))
      throw new BadRequestException('User version required');
    const namespace = {
      actorId: actor.actorId,
      userId,
      operation: 'PRINCIPAL_ACCESS_MODE',
      requestKey: dto.requestKey,
    };
    const id =
      'case-principal-' +
      createHash('sha256').update(canonicalJson(namespace)).digest('hex');
    const contentHash = mutationHash(
      {
        caseId: userId,
        operation: namespace.operation,
        payload: { caseAccessMode: dto.caseAccessMode, reason: dto.reason },
      },
      actor.actorId,
    );
    const run = () =>
      this.prisma.$transaction(
        async (tx) => {
          if (
            (await this.core.accessProfile(tx, actor)).caseAccessMode !==
            'INTERNAL'
          )
            throw new ForbiddenException(
              'Internal principal management required',
            );
          if (
            !(await this.core.hasCapability(
              tx,
              actor.actorId,
              'manage_access',
            )) ||
            !(await this.core.hasEntityPermission(
              tx,
              actor.actorId,
              'User',
              'write',
            ))
          )
            throw new ForbiddenException(
              'Explicit Case access management and User write permissions required',
            );
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user) throw new BadRequestException('Principal not found');
          const scope = await this.core.currentActorScope(tx, actor);
          if (scope && !scope.writableUserIds.includes(userId))
            throw new ForbiddenException('Principal is outside writable scope');
          const replay = await tx.auditLog.findUnique({ where: { id } });
          if (replay) {
            const metadata = replay.metadata as Record<string, unknown> | null;
            if (metadata?.contentHash !== contentHash)
              throw new ConflictException('Request key content conflict');
            return metadata.result as {
              success: true;
              data: {
                id: string;
                caseAccessMode: CaseAccessMode;
                caseAccessRevision: number;
                updatedAt: string;
              };
            };
          }
          await this.core.ensureEnabled(tx);
          const changed = await tx.user.updateMany({
            where: {
              id: userId,
              updatedAt: expected,
              caseAccessRevision: dto.expectedCaseAccessRevision,
              caseAccessMode: user.caseAccessMode,
            },
            data: {
              caseAccessMode: dto.caseAccessMode,
              caseAccessRevision: { increment: 1 },
              ...(user.caseAccessMode !== dto.caseAccessMode
                ? await businessCredentialInvalidation(true)
                : {}),
            },
          });
          if (changed.count !== 1)
            throw new ConflictException('Principal access profile changed');
          const fresh = await tx.user.findUniqueOrThrow({
            where: { id: userId },
          });
          const result = {
            success: true as const,
            data: {
              id: fresh.id,
              caseAccessMode: fresh.caseAccessMode,
              caseAccessRevision: fresh.caseAccessRevision,
              updatedAt: fresh.updatedAt.toISOString(),
            },
          };
          await tx.auditLog.create({
            data: {
              id,
              userId: actor.actorId,
              action: 'CASE_PRINCIPAL_ACCESS_MODE_CHANGED',
              subject: 'User',
              subjectId: userId,
              metadata: {
                contentHash,
                requestKey: dto.requestKey,
                reason: dto.reason,
                from: user.caseAccessMode,
                to: dto.caseAccessMode,
                revision: fresh.caseAccessRevision,
                result,
              } as Prisma.InputJsonValue,
            },
          });
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await run();
      } catch (error) {
        if (
          !['P2002', 'P2025', 'P2034'].includes(
            (error as { code?: string }).code ?? '',
          )
        )
          throw error;
        if (attempt === 1)
          throw new ConflictException(
            'Concurrent principal access change; reload and retry',
          );
      }
    }
    throw new ConflictException('Concurrent principal access change');
  }
  async get(userId: string, actor: ActorContext) {
    if (
      (await this.core.accessProfile(this.prisma, actor)).caseAccessMode !==
        'INTERNAL' ||
      !(await this.core.hasCapability(
        this.prisma,
        actor.actorId,
        'manage_access',
      )) ||
      !(await this.core.hasEntityPermission(
        this.prisma,
        actor.actorId,
        'User',
        'write',
      ))
    )
      throw new ForbiddenException(
        'Internal explicit principal management required',
      );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Principal not found');
    const scope = await this.core.currentActorScope(this.prisma, actor);
    if (scope && !scope.writableUserIds.includes(userId))
      throw new ForbiddenException('Principal outside writable scope');
    return {
      success: true,
      data: {
        id: user.id,
        caseAccessMode: user.caseAccessMode,
        caseAccessRevision: user.caseAccessRevision,
        updatedAt: user.updatedAt,
      },
    };
  }
}
