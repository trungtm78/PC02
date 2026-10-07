import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CaseGovernanceTask } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from './case-governance.service';
import { LegalWorkflowService } from './legal-workflow.service';
import type { ActorContext } from './case-governance.contract';
import { nonblank, object } from './legal-workflow.validation';
import { civilDate } from './legal-workflow.validation';
import { CaseInvestigationPhase } from '@prisma/client';
export const GOVERNANCE_QUEUES = [
  'pending',
  'assigned',
  'missing',
  'review',
  'due',
  'overdue',
] as const;
export type GovernanceQueue = (typeof GOVERNANCE_QUEUES)[number];
type Row = Prisma.CaseGetPayload<{
  select: {
    id: true;
    name: true;
    caseCode: true;
    updatedAt: true;
    status: true;
    intakeStage: true;
    investigatorId: true;
    investigationPhase: true;
    deadline: true;
    ngayKhoiTo: true;
  };
}>;
function member(
  key: GovernanceQueue,
  row: Row,
  reviews: Set<string>,
  actor: ActorContext,
  now: Date,
) {
  const active = ![
    'DINH_CHI',
    'DA_KET_LUAN',
    'DA_CHUYEN_DON_VI',
    'DA_NHAP_VU_KHAC',
  ].includes(row.status);
  if (key === 'pending') return row.intakeStage === 'CHO_NHAN';
  if (key === 'assigned') return row.investigatorId === actor.actorId;
  if (key === 'missing')
    return Boolean(
      (Object.prototype.hasOwnProperty.call(row, 'name') &&
        !row.name?.trim()) ||
      (row.status === 'DANG_DIEU_TRA' &&
        Object.prototype.hasOwnProperty.call(row, 'investigationPhase') &&
        Object.prototype.hasOwnProperty.call(row, 'ngayKhoiTo') &&
        (!row.investigationPhase || !row.ngayKhoiTo))
    );
  if (key === 'review') return reviews.has(row.id);
  if (key === 'overdue')
    return (
      !!row.status &&
      active &&
      !!row.deadline &&
      caseCivilOverdue(row.deadline, now)
    );
  return (
    !!row.status && active && !!row.deadline && caseCivilDue(row.deadline, now)
  );
}
@Injectable()
export class CaseOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
    private readonly legal?: LegalWorkflowService,
  ) {}
  private async snapshot(actor: ActorContext) {
    const where = await this.core.readableCaseWhere(this.prisma, actor, {
      representationCapability: 'view',
    });
    const rows = await this.prisma.case.findMany({
      where,
      select: {
        id: true,
        name: true,
        caseCode: true,
        updatedAt: true,
        status: true,
        intakeStage: true,
        investigatorId: true,
        investigationPhase: true,
        deadline: true,
        ngayKhoiTo: true,
      },
      orderBy: { id: 'asc' },
    });
    const requests = await this.prisma.caseActionRequest.findMany({
      where: { status: 'SUBMITTED', caseId: { in: rows.map((r) => r.id) } },
      select: { caseId: true },
    });
    const serialized = await Promise.all(
      rows.map((row) =>
        this.core.serializeCaseResult(this.prisma, row.id, row, actor),
      ),
    );
    return {
      rows: serialized,
      reviews: new Set(requests.map((r) => r.caseId)),
    };
  }
  async caseFilters(
    query: Record<string, unknown>,
    actor: ActorContext,
    now = new Date(),
  ): Promise<Prisma.CaseWhereInput> {
    const filters: Prisma.CaseWhereInput[] = [];
    if (
      query.investigationPhase !== undefined &&
      query.investigationPhase !== ''
    ) {
      if (query.investigationPhase === 'UNKNOWN')
        filters.push({ investigationPhase: null });
      else if (
        Object.values(CaseInvestigationPhase).includes(
          query.investigationPhase as CaseInvestigationPhase,
        )
      )
        filters.push({
          investigationPhase:
            query.investigationPhase as CaseInvestigationPhase,
        });
      else throw new BadRequestException('Invalid investigation phase');
    }
    if (query.actionCode) {
      const code = nonblank(query.actionCode, 'Action history code');
      filters.push({
        caseActionRequest_case: {
          some: { actionCode: code, status: 'EXECUTED' },
        },
      });
    }
    const decision: Prisma.CaseDecisionWhereInput = {};
    if (query.decisionNumber)
      decision.number = {
        contains: nonblank(query.decisionNumber, 'Decision number'),
        mode: 'insensitive',
      };
    if (query.decisionType)
      decision.type = nonblank(query.decisionType, 'Decision type');
    if (query.decisionSourceDocumentId)
      decision.sourceDocumentId = nonblank(
        query.decisionSourceDocumentId,
        'Decision source',
      );
    const from = query.decisionDateFrom
        ? civilDate(query.decisionDateFrom)
        : null,
      to = query.decisionDateTo ? civilDate(query.decisionDateTo) : null;
    if (from && to && to < from)
      throw new BadRequestException('Invalid decision date range');
    if (from || to)
      decision.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}),
      };
    if (Object.keys(decision).length)
      filters.push({ caseDecision_case: { some: decision } });
    if (query.missingData === true || query.missingData === 'true')
      filters.push({
        OR: [
          { name: '' },
          {
            status: 'DANG_DIEU_TRA',
            OR: [{ investigationPhase: null }, { ngayKhoiTo: null }],
          },
        ],
      });
    if (query.governanceQueue) {
      const clock = query.governanceClock
        ? new Date(nonblank(query.governanceClock, 'Queue clock'))
        : now;
      if (!Number.isFinite(clock.getTime()))
        throw new BadRequestException('Invalid queue clock');
      const result = await this.queue(
        nonblank(query.governanceQueue, 'Queue'),
        actor,
        clock,
      );
      filters.push({ id: { in: result.data.items.map((r) => r.id) } });
    }
    return filters.length ? { AND: filters } : {};
  }
  async dashboard(actor: ActorContext, now = new Date()) {
    const { rows, reviews } = await this.snapshot(actor);
    return {
      success: true,
      data: {
        clock: now.toISOString(),
        buckets: GOVERNANCE_QUEUES.map((key) => ({
          key,
          count: rows.filter((r) => member(key, r, reviews, actor, now)).length,
          link: `/cases?governanceQueue=${key}&governanceClock=${encodeURIComponent(now.toISOString())}`,
        })),
      },
    };
  }
  async queue(key: string, actor: ActorContext, now = new Date()) {
    if (
      !(GOVERNANCE_QUEUES as readonly string[]).includes(key) ||
      !Number.isFinite(now.getTime())
    )
      throw new BadRequestException('Unknown governance queue/clock');
    const { rows, reviews } = await this.snapshot(actor);
    const items = rows.filter((r) =>
      member(key as GovernanceQueue, r, reviews, actor, now),
    );
    return {
      success: true,
      data: { clock: now.toISOString(), key, items, total: items.length },
    };
  }
  async tasks(actor: ActorContext) {
    const where = await this.core.readableCaseWhere(this.prisma, actor, {
      representationCapability: 'view',
    });
    return {
      success: true,
      data: await this.prisma.caseGovernanceTask.findMany({
        where: { case: where },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      }),
    };
  }
  async saveTask(
    caseId: string,
    id: string | null,
    dto: {
      requestKey: string;
      expectedUpdatedAt: string;
      expectedAggregateUpdatedAt?: string;
      type: string;
      sourceId: string;
      assigneeId?: string | null;
      status?: string;
      dueAt?: string | null;
      payload: unknown;
    },
    actor: ActorContext,
  ) {
    const type = nonblank(dto.type, 'Task type'),
      sourceId = nonblank(dto.sourceId, 'Task source'),
      payload = object(dto.payload),
      status = dto.status ?? 'OPEN';
    if (!['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status))
      throw new BadRequestException('Invalid task status');
    const due = dto.dueAt ? new Date(dto.dueAt) : null;
    if (due && !Number.isFinite(due.getTime()))
      throw new BadRequestException('Invalid task due date');
    return this.core.mutateCase(
      {
        caseId,
        operation: id ? 'TASK_REVISE' : 'TASK_CREATE',
        requestKey: dto.requestKey,
        expectedUpdatedAt: dto.expectedUpdatedAt,
        payload: {
          id,
          type,
          sourceId,
          payload,
          status,
          assigneeId: dto.assigneeId,
          dueAt: dto.dueAt,
        },
      },
      actor,
      async (tx, { operationId }) => {
        if (dto.assigneeId) {
          if (
            !(await tx.user.findFirst({
              where: { id: dto.assigneeId, isActive: true },
            }))
          )
            throw new BadRequestException('Active assignee required');
          await this.core.assertCaseWritable(tx, caseId, {
            actorId: dto.assigneeId,
          });
        }
        let task: CaseGovernanceTask | null;
        if (id) {
          const row = await tx.caseGovernanceTask.findFirst({
            where: { id, caseId },
          });
          if (!row) throw new NotFoundException();
          if (
            !dto.expectedAggregateUpdatedAt ||
            row.updatedAt.getTime() !==
              new Date(dto.expectedAggregateUpdatedAt).getTime()
          )
            throw new ConflictException('Task changed');
          if (row.type !== type || row.sourceId !== sourceId)
            throw new BadRequestException('Task identity immutable');
          const changed = await tx.caseGovernanceTask.updateMany({
            where: { id, updatedAt: row.updatedAt, status: row.status },
            data: {
              assigneeId: dto.assigneeId ?? null,
              status,
              dueAt: due,
              payload: payload as Prisma.InputJsonValue,
            },
          });
          if (changed.count !== 1) throw new ConflictException();
          task = await tx.caseGovernanceTask.findUnique({ where: { id } });
        } else
          task = await tx.caseGovernanceTask.create({
            data: {
              caseId,
              type,
              sourceId,
              assigneeId: dto.assigneeId ?? null,
              status,
              dueAt: due,
              payload: payload as Prisma.InputJsonValue,
            },
          });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'TASK_SAVED',
          { taskId: task!.id, status, dueAt: due?.toISOString() ?? null },
        );
        if (dto.assigneeId)
          await this.core.enqueue(
            tx,
            caseId,
            operationId,
            { type: 'TASK_ASSIGNED', taskId: task!.id },
            [dto.assigneeId],
          );
        return { success: true, data: task };
      },
    );
  }
  async relations(caseId: string, actor: ActorContext) {
    await this.core.assertCaseReadable(this.prisma, caseId, actor);
    const visible = await this.core.readableCaseWhere(this.prisma, actor, {
      representationCapability: 'view',
    });
    return {
      success: true,
      data: await this.prisma.caseRelation.findMany({
        where: {
          OR: [
            { sourceCaseId: caseId, targetCase: visible },
            { targetCaseId: caseId, sourceCase: visible },
          ],
        },
        include: {
          sourceCase: { select: { id: true, name: true, caseCode: true } },
          targetCase: { select: { id: true, name: true, caseCode: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
  async relate(
    caseId: string,
    dto: {
      requestKey: string;
      expectedUpdatedAt: string;
      targetCaseId: string;
      decisionId: string;
      type: 'RELATED';
    },
    actor: ActorContext,
  ) {
    if (dto.type !== 'RELATED')
      throw new BadRequestException(
        'Legal merge/split require approved action execution',
      );
    if (!this.legal)
      throw new BadRequestException('Relation validator unavailable');
    return this.core.mutateCase(
      {
        caseId,
        operation: 'RELATION_CREATE',
        requestKey: dto.requestKey,
        expectedUpdatedAt: dto.expectedUpdatedAt,
        payload: {
          targetCaseId: dto.targetCaseId,
          decisionId: dto.decisionId,
          type: dto.type,
        },
      },
      actor,
      async (tx, { operationId }) => {
        await this.legal!.assertRelation(tx, caseId, dto.targetCaseId, actor);
        const decision = await tx.caseDecision.findFirst({
          where: {
            id: dto.decisionId,
            caseId,
            request: { status: 'EXECUTED', actionCode: 'LINK_RELATED' },
          },
        });
        if (
          !decision ||
          object(decision.facts).targetCaseId !== dto.targetCaseId
        )
          throw new ForbiddenException(
            'Executed decision must authorize exact target relation',
          );
        const row = await tx.caseRelation.create({
          data: {
            sourceCaseId: caseId,
            targetCaseId: dto.targetCaseId,
            type: 'RELATED',
            decisionId: decision.id,
            createdById: actor.actorId,
          },
        });
        await this.core.recordEvent(
          tx,
          caseId,
          operationId,
          actor.actorId,
          'RELATION_CREATED',
          { relationId: row.id, targetCaseId: row.targetCaseId },
        );
        return { success: true, data: row };
      },
    );
  }
}
import { caseCivilDue, caseCivilOverdue } from './case-civil-day';
