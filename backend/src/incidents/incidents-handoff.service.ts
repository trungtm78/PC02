import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, Incident } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { TERMINAL_STATUSES } from './incidents.constants';
import { laNgayThat } from '../common/validators/is-ngay-that.validator';

export interface SendIncidentHandoff {
  toTeamId: string;
  expectedUpdatedAt: string;
  requestKey: string;
  reason?: string;
}
export interface ResolveIncidentHandoff {
  expectedUpdatedAt: string;
  expectedHandoffUpdatedAt: string;
  reason?: string;
}

@Injectable()
export class IncidentsHandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async ensureEnabled() {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key: 'INCIDENT_INTAKE_HANDOFF' },
    });
    if (!flag?.enabled)
      throw new ForbiddenException('Chức năng bàn giao chưa được bật');
  }

  private date(value: string): Date {
    if (!laNgayThat(value))
      throw new BadRequestException('Thiếu hoặc sai phiên bản hồ sơ');
    return new Date(value);
  }

  private writable(record: Incident, scope?: DataScope | null) {
    if (!scope) return;
    const own =
      record.investigatorId &&
      scope.writableUserIds.includes(record.investigatorId);
    const team =
      record.assignedTeamId &&
      scope.writableTeamIds.includes(record.assignedTeamId);
    const unassigned =
      !record.assignedTeamId &&
      scope.writableTeamIds.length > 0 &&
      !scope.isWardOfficer;
    if (!own && !team && !unassigned)
      throw new ForbiddenException('Không có quyền ghi hồ sơ');
  }

  private dispatch(scope?: DataScope | null) {
    if (scope && !scope.canDispatch)
      throw new ForbiddenException('Cần quyền điều phối');
  }

  private async incident(id: string) {
    const record = await this.prisma.incident.findFirst({
      where: { id, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Vụ việc không tồn tại');
    return record;
  }

  private async member(
    teamId: string,
    actorId: string,
    scope?: DataScope | null,
  ) {
    if (!scope) return; // ADMIN: UnitScopeService returns null.
    const member = await this.prisma.userTeam.findFirst({
      where: {
        teamId,
        userId: actorId,
        team: { isActive: true },
        user: { isActive: true },
      },
    });
    if (!member)
      throw new ForbiddenException('Chỉ tổ nhận được xác nhận hồ sơ');
  }

  private conflict() {
    return new ConflictException(
      'Hồ sơ hoặc lượt giao đã thay đổi; hãy tải lại',
    );
  }

  async send(
    id: string,
    dto: SendIncidentHandoff,
    actorId: string,
    scope?: DataScope | null,
  ) {
    this.dispatch(scope);
    await this.ensureEnabled();
    const record = await this.incident(id);
    this.writable(record, scope);
    if (!dto.requestKey?.trim() || !dto.toTeamId?.trim())
      throw new BadRequestException('Thiếu mã yêu cầu hoặc tổ nhận');
    const expected = this.date(dto.expectedUpdatedAt);
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          id,
          toTeamId: dto.toTeamId,
          reason: dto.reason ?? '',
          expected: expected.toISOString(),
        }),
      )
      .digest('hex');
    const replay = await this.prisma.incidentHandoff.findUnique({
      where: {
        sentById_requestKey: { sentById: actorId, requestKey: dto.requestKey },
      },
    });
    if (replay) {
      if (replay.incidentId !== id || replay.requestHash !== requestHash)
        throw this.conflict();
      return { success: true, data: replay };
    }
    if (expected.getTime() !== record.updatedAt.getTime())
      throw this.conflict();
    if (record.intakeStage === 'CHO_NHAN') throw this.conflict();
    if (TERMINAL_STATUSES.includes(record.status))
      throw new BadRequestException('Vụ việc đã kết thúc');
    if (dto.toTeamId === record.assignedTeamId)
      throw new BadRequestException('Tổ nhận trùng tổ hiện tại');
    const target = await this.prisma.team.findFirst({
      where: { id: dto.toTeamId, isActive: true },
    });
    if (!target)
      throw new BadRequestException(
        'Tổ nhận không tồn tại hoặc đã ngừng hoạt động',
      );
    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.incident.updateMany({
          where: { id, updatedAt: expected, deletedAt: null },
          data: { intakeStage: 'CHO_NHAN' },
        });
        if (changed.count !== 1) throw this.conflict();
        const handoff = await tx.incidentHandoff.create({
          data: {
            incidentId: id,
            fromTeamId: record.assignedTeamId,
            toTeamId: dto.toTeamId,
            priorIntakeStage: record.intakeStage,
            sentById: actorId,
            reason: dto.reason,
            requestKey: dto.requestKey,
            requestHash,
          },
        });
        await this.audit.log(
          {
            userId: actorId,
            action: 'INCIDENT_HANDOFF_SENT',
            subject: 'Incident',
            subjectId: id,
            metadata: {
              handoffId: handoff.id,
              fromTeamId: record.assignedTeamId,
              toTeamId: dto.toTeamId,
            },
          },
          tx,
        );
        return handoff;
      });
      return { success: true, data };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        const duplicate = await this.prisma.incidentHandoff.findUnique({
          where: {
            sentById_requestKey: {
              sentById: actorId,
              requestKey: dto.requestKey,
            },
          },
        });
        if (
          duplicate?.incidentId === id &&
          duplicate.requestHash === requestHash
        )
          return { success: true, data: duplicate };
        throw this.conflict();
      }
      throw error;
    }
  }

  async accept(
    id: string,
    handoffId: string,
    dto: ResolveIncidentHandoff,
    actorId: string,
    scope?: DataScope | null,
  ) {
    const record = await this.incident(id);
    const handoff = await this.prisma.incidentHandoff.findFirst({
      where: { id: handoffId, incidentId: id },
    });
    if (!handoff) throw new NotFoundException('Lượt giao không tồn tại');
    await this.member(handoff.toTeamId, actorId, scope);
    if (handoff.state === 'ACCEPTED' && handoff.receivedById === actorId) {
      this.writable(record, scope);
      return { success: true, data: handoff };
    }
    if (handoff.state !== 'PENDING' || record.intakeStage !== 'CHO_NHAN')
      throw this.conflict();
    const expected = this.date(dto.expectedUpdatedAt);
    const handoffExpected = this.date(dto.expectedHandoffUpdatedAt);
    const data = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.incident.updateMany({
        where: {
          id,
          updatedAt: expected,
          intakeStage: 'CHO_NHAN',
          deletedAt: null,
        },
        data: {
          intakeStage: 'DA_NHAN',
          assignedTeamId: handoff.toTeamId,
          investigatorId: null,
        },
      });
      if (changed.count !== 1) throw this.conflict();
      const receivedAt = new Date();
      const received = await tx.incidentHandoff.updateMany({
        where: {
          id: handoffId,
          incidentId: id,
          state: 'PENDING',
          updatedAt: handoffExpected,
        },
        data: { state: 'ACCEPTED', receivedById: actorId, receivedAt },
      });
      if (received.count !== 1) throw this.conflict();
      await this.audit.log(
        {
          userId: actorId,
          action: 'INCIDENT_HANDOFF_ACCEPTED',
          subject: 'Incident',
          subjectId: id,
          metadata: {
            handoffId,
            fromTeamId: handoff.fromTeamId,
            toTeamId: handoff.toTeamId,
            receivedAt: receivedAt.toISOString(),
          },
        },
        tx,
      );
      return tx.incidentHandoff.findFirst({ where: { id: handoffId } });
    });
    return { success: true, data };
  }

  async cancel(
    id: string,
    handoffId: string,
    dto: ResolveIncidentHandoff,
    actorId: string,
    scope?: DataScope | null,
  ) {
    this.dispatch(scope);
    const record = await this.incident(id);
    this.writable(record, scope);
    if (!dto.reason?.trim())
      throw new BadRequestException('Cần lý do hủy giao');
    const handoff = await this.prisma.incidentHandoff.findFirst({
      where: { id: handoffId, incidentId: id },
    });
    if (!handoff) throw new NotFoundException('Lượt giao không tồn tại');
    if (handoff.state === 'CANCELLED' && handoff.cancelledById === actorId)
      return { success: true, data: handoff };
    if (handoff.state !== 'PENDING' || record.intakeStage !== 'CHO_NHAN')
      throw this.conflict();
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.incident.updateMany({
        where: {
          id,
          updatedAt: this.date(dto.expectedUpdatedAt),
          intakeStage: 'CHO_NHAN',
          deletedAt: null,
        },
        data: { intakeStage: handoff.priorIntakeStage },
      });
      if (changed.count !== 1) throw this.conflict();
      const cancelled = await tx.incidentHandoff.updateMany({
        where: {
          id: handoffId,
          state: 'PENDING',
          updatedAt: this.date(dto.expectedHandoffUpdatedAt),
        },
        data: {
          state: 'CANCELLED',
          cancelledById: actorId,
          cancelledAt: new Date(),
          reason: dto.reason?.trim(),
        },
      });
      if (cancelled.count !== 1) throw this.conflict();
      await this.audit.log(
        {
          userId: actorId,
          action: 'INCIDENT_HANDOFF_CANCELLED',
          subject: 'Incident',
          subjectId: id,
          metadata: { handoffId, reason: dto.reason },
        },
        tx,
      );
    });
    return { success: true };
  }

  async inbox(scope?: DataScope | null, offset = 0, limit = 20) {
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new BadRequestException('Phân trang không hợp lệ');
    const where: Prisma.IncidentHandoffWhereInput = {
      state: 'PENDING',
      incident: { deletedAt: null },
      ...(scope ? { toTeamId: { in: scope.teamIds } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.incidentHandoff.findMany({
        where,
        include: {
          toTeam: { select: { name: true } },
          incident: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ sentAt: 'asc' }, { id: 'asc' }],
        skip: Math.max(0, offset),
        take: Math.min(100, Math.max(1, limit)),
      }),
      this.prisma.incidentHandoff.count({ where }),
    ]);
    return { success: true, data, total };
  }

  async history(id: string, scope?: DataScope | null) {
    const record = await this.incident(id);
    if (scope && !scope.canDispatch) {
      const team =
        record.assignedTeamId && scope.teamIds.includes(record.assignedTeamId);
      const owner =
        record.investigatorId && scope.userIds.includes(record.investigatorId);
      if (
        !team &&
        !owner &&
        !(
          record.assignedTeamId === null &&
          scope.teamIds.length &&
          !scope.isWardOfficer
        )
      )
        throw new ForbiddenException('Không có quyền xem lịch sử');
    }
    return {
      success: true,
      data: await this.prisma.incidentHandoff.findMany({
        where: { incidentId: id },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: 100,
      }),
    };
  }
}
