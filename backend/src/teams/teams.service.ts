import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

const MAX_DEPTH = 3;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList() {
    return this.prisma.team.findMany({
      include: {
        parent: true,
        children: true,
        _count: { select: { members: true } },
      },
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

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_UPDATED',
      subject: 'Team',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return team;
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.team.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Team not found (id: ${id})`);

    // Soft delete — set isActive to false
    await this.prisma.team.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_DELETED',
      subject: 'Team',
      subjectId: id,
      metadata: { name: existing.name, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa tổ/nhóm thành công' };
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
