import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/** Machine codes the screen translates; the server never sends a sentence for these. */
export const TEAM_ERROR = {
  INVALID_TRANSITION: 'TEAM_INVALID_TRANSITION',
  STATUS_UNKNOWN: 'TEAM_STATUS_UNKNOWN',
} as const;

/** Where a team may go from each state. A paused or active team can be archived; an archived team is only restored. */
const ALLOWED: Record<TeamStatus, readonly TeamStatus[]> = {
  ACTIVE: ['INACTIVE', 'ARCHIVED'],
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

function auditAction(from: TeamStatus, to: TeamStatus): string {
  if (to === 'ARCHIVED') return 'TEAM_ARCHIVED';
  if (to === 'INACTIVE') return 'TEAM_DEACTIVATED';
  return from === 'ARCHIVED' ? 'TEAM_RESTORED' : 'TEAM_ACTIVATED';
}

/**
 * The ONLY place application code changes a team's state. `isActive` is not written here: the `teams_status_sync`
 * trigger derives it from `status`, so the two can never disagree whichever writer touches the row.
 */
@Injectable()
export class TeamLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async setStatus(
    id: string,
    to: TeamStatus,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (!Object.values(TeamStatus).includes(to)) {
      throw new ConflictException({ code: TEAM_ERROR.STATUS_UNKNOWN });
    }
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException(`Team not found (id: ${id})`);

    const from = team.status;
    if (from === to) return team;
    if (!ALLOWED[from].includes(to)) {
      throw new ConflictException({ code: TEAM_ERROR.INVALID_TRANSITION, from, to });
    }

    const archiving = to === 'ARCHIVED';
    const updated = await this.prisma.team.update({
      where: { id },
      data: {
        status: to,
        archivedAt: archiving ? new Date() : null,
        archivedById: archiving ? actorId : null,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: auditAction(from, to),
      subject: 'Team',
      subjectId: id,
      metadata: { name: team.name, from, to },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return updated;
  }
}
