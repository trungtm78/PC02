import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TeamLifecycleService } from './team-lifecycle.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

const MAX_DEPTH = 3;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lifecycle: TeamLifecycleService,
  ) {}

  /**
   * The admin list. Defaults to ACTIVE teams so that no screen shows a paused or archived team by accident; the admin
   * tabs ask for INACTIVE / ARCHIVED explicitly, and `ALL` is for an overview that is never a picker.
   */
  async getList(status: TeamStatus | 'ALL' = 'ACTIVE') {
    return this.prisma.team.findMany({
      where: status === 'ALL' ? {} : { status },
      include: {
        parent: true,
        children: true,
        _count: { select: { members: true } },
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
  }

  /** What every team picker uses: active teams only, and only the fields a picker needs. */
  async options() {
    return this.prisma.team.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, level: true, parentId: true, wardId: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
  }

  async getById(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                email: true,
              },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });
    if (!team) throw new NotFoundException(`Team not found (id: ${id})`);
    return team;
  }

  async create(
    dto: CreateTeamDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        code: dto.code,
        level: dto.level,
        parentId: dto.parentId,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
        // v0.33.0.0: Hybrid scoping + edit window override
        wardId: dto.wardId ?? null,
        editWindowHours: dto.editWindowHours ?? null,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_CREATED',
      subject: 'Team',
      subjectId: team.id,
      metadata: { name: team.name, code: team.code },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return team;
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Team not found (id: ${id})`);

    // The state is not a plain column: it moves through the lifecycle (transition rules, archive stamps, audit).
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.lifecycle.setStatus(id, dto.isActive ? 'ACTIVE' : 'INACTIVE', actorId, meta);
    }

    // v0.29: use wrapUpdate to capture before/after diff (was: changes: dto only).
    return this.audit.wrapUpdate({
      fetchFn: async () => existing,
      updateFn: async () =>
        this.prisma.team.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.code !== undefined && { code: dto.code }),
            ...(dto.level !== undefined && { level: dto.level }),
            ...(dto.parentId !== undefined && { parentId: dto.parentId }),
            ...(dto.order !== undefined && { order: dto.order }),
            // v0.33.0.0: allow update wardId/editWindowHours (null = clear)
            ...(dto.wardId !== undefined && { wardId: dto.wardId }),
            ...(dto.editWindowHours !== undefined && { editWindowHours: dto.editWindowHours }),
          },
        }),
      action: 'TEAM_UPDATED',
      subject: 'Team',
      subjectId: id,
      userId: actorId,
      meta,
    });
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Until the real delete lands this is a pause, through the lifecycle (the only writer of a team's state).
    await this.lifecycle.setStatus(id, 'INACTIVE', actorId, meta);
    return { success: true, message: 'Xóa tổ/nhóm thành công' };
  }

  async addMember(teamId: string, userId: string, actorId: string) {
    // Fix #1: Guard empty/undefined userId
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('userId is required');
    }

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team not found (id: ${teamId})`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User not found (id: ${userId})`);

    const member = await this.prisma.userTeam.upsert({
      where: { userId_teamId: { userId, teamId } },
      update: {},
      create: { userId, teamId, isLeader: false },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true, email: true },
        },
      },
    });

    // Fix #7: Audit failure should not rollback the upsert
    try {
      await this.audit.log({
        userId: actorId,
        action: 'TEAM_MEMBER_ADDED',
        subject: 'Team',
        subjectId: teamId,
        metadata: { userId, teamName: team.name },
      });
    } catch (err) {
      console.error('Audit log failed for TEAM_MEMBER_ADDED:', err);
    }

    return member;
  }

  async removeMember(teamId: string, userId: string, actorId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException(`Team not found (id: ${teamId})`);

    // Fix #2: Check if membership exists before audit
    const result = await this.prisma.userTeam.deleteMany({
      where: { userId, teamId },
    });

    if (result.count === 0) {
      throw new NotFoundException(`User ${userId} is not a member of team ${teamId}`);
    }

    try {
      await this.audit.log({
        userId: actorId,
        action: 'TEAM_MEMBER_REMOVED',
        subject: 'Team',
        subjectId: teamId,
        metadata: { userId, teamName: team.name },
      });
    } catch (err) {
      console.error('Audit log failed for TEAM_MEMBER_REMOVED:', err);
    }

    return { success: true };
  }

  /**
   * Recursively get all descendant team IDs.
   * depth=0 means start level; MAX_DEPTH prevents infinite loops.
   */
  async getDescendantIds(teamId: string, depth = 0): Promise<string[]> {
    if (depth >= MAX_DEPTH) return [];

    const children = await this.prisma.team.findMany({
      where: { parentId: teamId, isActive: true },
      select: { id: true },
    });

    const childIds = children.map((c) => c.id);
    const grandchildIds: string[] = [];

    for (const childId of childIds) {
      const descendants = await this.getDescendantIds(childId, depth + 1);
      grandchildIds.push(...descendants);
    }

    return [...childIds, ...grandchildIds];
  }

  /**
   * Get all unique user IDs belonging to the given teams.
   */
  async getUserIdsForTeams(teamIds: string[]): Promise<string[]> {
    if (teamIds.length === 0) return [];

    const userTeams = await this.prisma.userTeam.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    });

    return [...new Set(userTeams.map((ut) => ut.userId))];
  }
}
