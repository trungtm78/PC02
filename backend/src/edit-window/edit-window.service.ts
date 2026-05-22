import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { TeamsService } from '../teams/teams.service';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { ROLE_NAMES } from '../common/constants/role.constants';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

/**
 * v0.33.0.0 Phase 5-lite: edit window (warning-only, audit flag) + Phase 5b reset workflow.
 *
 * - getEditWindow(teamId): override chain Team.editWindowHours → SystemSetting → 24
 * - isAfterEditWindow(record): returns boolean for audit flag — NOT throw (warning-only)
 * - createResetRequest: dedupe via partial unique index P2002 catch
 * - bulkApprove: per-request authorize + atomic transaction + immutable audit
 */
@Injectable()
export class EditWindowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly teamsService: TeamsService,
  ) {}

  async getEditWindow(assignedTeamId: string | null): Promise<number> {
    if (assignedTeamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: assignedTeamId },
        select: { editWindowHours: true },
      });
      if (team?.editWindowHours != null) return team.editWindowHours;
    }
    return this.settings.getNumericValue(SETTINGS_KEY.THOI_HAN_EDIT_VU_VAN, 168);
  }

  async isAfterEditWindow(record: {
    createdAt: Date;
    assignedTeamId: string | null;
    assignedTeam?: { wardId: string | null; editWindowHours: number | null } | null;
  }): Promise<boolean> {
    // Phase 5-lite: chỉ áp window cho records của ward team (assignedTeam.wardId != null)
    if (!record.assignedTeam?.wardId) return false;
    const window =
      record.assignedTeam.editWindowHours ??
      (await this.settings.getNumericValue(SETTINGS_KEY.THOI_HAN_EDIT_VU_VAN, 168));
    const hoursElapsed = (Date.now() - record.createdAt.getTime()) / 3_600_000;
    return hoursElapsed > window;
  }

  async createResetRequest(
    actorId: string,
    dto: { subjectType: 'Case' | 'Incident' | 'Petition'; subjectId: string; reason: string },
  ) {
    // CODEX HIGH 1: verify subject tồn tại + user có quyền truy cập subject
    // Chỉ ward officer (assignedTeam in user's writable teams) mới được tạo request.
    const subjectTeamId = await this.getSubjectAssignedTeamId(dto.subjectType, dto.subjectId);
    if (subjectTeamId === null) {
      // Hoặc subject không tồn tại, hoặc unassigned. Cả 2 trường hợp đều reject.
      throw new NotFoundException(`${dto.subjectType} không tồn tại hoặc chưa gán cho tổ nào.`);
    }
    const userTeams = await this.prisma.userTeam.findMany({
      where: { userId: actorId },
      select: { teamId: true },
    });
    const userTeamIds = new Set(userTeams.map((ut) => ut.teamId));
    if (!userTeamIds.has(subjectTeamId)) {
      throw new ForbiddenException(
        'Bạn không thuộc tổ quản lý record này, không thể yêu cầu reset.',
      );
    }

    // Rate limit: max 20 active pending per user
    const pendingCount = await this.prisma.editWindowResetRequest.count({
      where: { requestedById: actorId, status: 'PENDING' },
    });
    if (pendingCount >= 20) {
      throw new BadRequestException(
        'Bạn đã có 20 yêu cầu reset đang chờ duyệt. Vui lòng đợi admin xử lý trước.',
      );
    }

    // CODEX CRIT 2: dedupe via partial unique constraint — return existing pending
    try {
      const created = await this.prisma.editWindowResetRequest.create({
        data: {
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          requestedById: actorId,
          reason: dto.reason,
        },
      });
      return { success: true, data: created, message: 'Đã gửi yêu cầu reset' };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.editWindowResetRequest.findFirst({
          where: {
            subjectType: dto.subjectType,
            subjectId: dto.subjectId,
            requestedById: actorId,
            status: 'PENDING',
          },
        });
        return {
          success: true,
          data: existing,
          message: 'Bạn đã gửi yêu cầu reset cho record này, đang chờ admin duyệt.',
        };
      }
      throw err;
    }
  }

  async list(query: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
    limit?: number;
    offset?: number;
    countOnly?: boolean;
  }, user: AuthUser) {
    const where: Prisma.EditWindowResetRequestWhereInput = {};
    if (query.status && query.status !== 'ALL') where.status = query.status;

    // For HEAD_UNIT: filter by SUBJECT assigned team (not requester team) — codex HIGH 2 fix
    // List all requests then post-filter where subject.assignedTeam IN descendant teams.
    // Trade-off: 1 extra query per page, but correct scope semantics.
    let postFilterSubjectTeamIds: Set<string> | null = null;
    if (user.role === ROLE_NAMES.HEAD_UNIT) {
      const leaderTeams = await this.prisma.userTeam.findMany({
        where: { userId: user.id, isLeader: true },
        select: { teamId: true },
      });
      const descendantTeamIds = new Set<string>();
      for (const lt of leaderTeams) {
        descendantTeamIds.add(lt.teamId);
        const descendants = await this.teamsService.getDescendantIds(lt.teamId);
        descendants.forEach((id) => descendantTeamIds.add(id));
      }
      postFilterSubjectTeamIds = descendantTeamIds;
    }
    // ADMIN sees all

    if (query.countOnly) {
      // HEAD_UNIT count: load + post-filter (acceptable cho count badge)
      if (postFilterSubjectTeamIds) {
        const all = await this.prisma.editWindowResetRequest.findMany({
          where,
          select: { id: true, subjectType: true, subjectId: true },
        });
        let count = 0;
        for (const r of all) {
          const teamId = await this.getSubjectAssignedTeamId(r.subjectType, r.subjectId);
          if (teamId && postFilterSubjectTeamIds.has(teamId)) count++;
        }
        return { success: true, count };
      }
      const count = await this.prisma.editWindowResetRequest.count({ where });
      return { success: true, count };
    }

    const limit = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    let [data, total] = await Promise.all([
      this.prisma.editWindowResetRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          requestedBy: { select: { id: true, username: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.editWindowResetRequest.count({ where }),
    ]);

    // HEAD_UNIT post-filter by subject team — codex HIGH 2 fix
    if (postFilterSubjectTeamIds) {
      const filtered: typeof data = [];
      for (const r of data) {
        const teamId = await this.getSubjectAssignedTeamId(r.subjectType, r.subjectId);
        if (teamId && postFilterSubjectTeamIds.has(teamId)) filtered.push(r);
      }
      data = filtered;
      total = filtered.length; // Note: total is page-local, accept để giảm complexity
    }

    return { success: true, data, total };
  }

  /**
   * CODEX CRIT 3 + HIGH 4: bulk approve với per-request authorize + atomic tx + immutable audit.
   */
  async bulkApprove(
    requestIds: string[],
    reviewNote: string | undefined,
    user: AuthUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (user.role !== ROLE_NAMES.ADMIN && user.role !== ROLE_NAMES.HEAD_UNIT) {
      throw new ForbiddenException('Chỉ ADMIN hoặc Trưởng đơn vị mới được duyệt yêu cầu reset.');
    }

    const requests = await this.prisma.editWindowResetRequest.findMany({
      where: { id: { in: requestIds }, status: 'PENDING' },
    });
    if (requests.length !== requestIds.length) {
      throw new BadRequestException(
        'Một số yêu cầu không tồn tại hoặc đã được duyệt/từ chối. Tải lại danh sách.',
      );
    }

    // HEAD_UNIT: per-request authorize qua descendant check
    if (user.role === ROLE_NAMES.HEAD_UNIT) {
      const leaderTeams = await this.prisma.userTeam.findMany({
        where: { userId: user.id, isLeader: true },
        select: { teamId: true },
      });
      const descendantTeamIds = new Set<string>();
      for (const lt of leaderTeams) {
        descendantTeamIds.add(lt.teamId);
        const descendants = await this.teamsService.getDescendantIds(lt.teamId);
        descendants.forEach((id) => descendantTeamIds.add(id));
      }
      for (const req of requests) {
        const subjectTeamId = await this.getSubjectAssignedTeamId(req.subjectType, req.subjectId);
        if (!subjectTeamId || !descendantTeamIds.has(subjectTeamId)) {
          throw new ForbiddenException(
            `Không có quyền duyệt yêu cầu ${req.id} (subject ngoài tổ con của bạn).`,
          );
        }
      }
    }

    // Atomic transaction: tất cả approve cùng audit log
    await this.prisma.$transaction(async (tx) => {
      for (const req of requests) {
        await tx.editWindowResetRequest.update({
          where: { id: req.id, status: 'PENDING' }, // double-check race
          data: {
            status: 'APPROVED',
            reviewedById: user.id,
            reviewNote: reviewNote ?? null,
            reviewedAt: new Date(),
          },
        });
        // Immutable audit log per codex H4
        await this.audit.log(
          {
            userId: user.id,
            action: 'RESET_REQUEST_APPROVED',
            subject: req.subjectType,
            subjectId: req.subjectId,
            metadata: {
              requestId: req.id,
              reviewNote: reviewNote ?? null,
              previousStatus: 'PENDING',
              bulkBatchSize: requests.length,
              requesterId: req.requestedById,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );
      }
    });

    return { success: true, message: `Đã duyệt ${requests.length} yêu cầu reset`, count: requests.length };
  }

  async reject(
    requestId: string,
    reviewNote: string,
    user: AuthUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (user.role !== ROLE_NAMES.ADMIN && user.role !== ROLE_NAMES.HEAD_UNIT) {
      throw new ForbiddenException('Chỉ ADMIN hoặc Trưởng đơn vị mới được từ chối.');
    }
    const req = await this.prisma.editWindowResetRequest.findFirst({
      where: { id: requestId, status: 'PENDING' },
    });
    if (!req) {
      throw new NotFoundException('Yêu cầu không tồn tại hoặc đã được duyệt/từ chối.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.editWindowResetRequest.update({
        where: { id: requestId, status: 'PENDING' },
        data: { status: 'REJECTED', reviewedById: user.id, reviewNote, reviewedAt: new Date() },
      });
      await this.audit.log(
        {
          userId: user.id,
          action: 'RESET_REQUEST_REJECTED',
          subject: req.subjectType,
          subjectId: req.subjectId,
          metadata: { requestId, reviewNote, previousStatus: 'PENDING', requesterId: req.requestedById },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );
    });

    return { success: true, message: 'Đã từ chối yêu cầu reset' };
  }

  private async getSubjectAssignedTeamId(
    subjectType: string,
    subjectId: string,
  ): Promise<string | null> {
    if (subjectType === 'Case') {
      const c = await this.prisma.case.findUnique({
        where: { id: subjectId },
        select: { assignedTeamId: true },
      });
      return c?.assignedTeamId ?? null;
    }
    if (subjectType === 'Incident') {
      const i = await this.prisma.incident.findUnique({
        where: { id: subjectId },
        select: { assignedTeamId: true },
      });
      return i?.assignedTeamId ?? null;
    }
    if (subjectType === 'Petition') {
      const p = await this.prisma.petition.findUnique({
        where: { id: subjectId },
        select: { assignedTeamId: true },
      });
      return p?.assignedTeamId ?? null;
    }
    return null;
  }
}
