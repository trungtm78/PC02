import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { isTeamOwnSetting, listTeamReferences, quoteIdent, type RawDb } from './team-references';

/** Machine codes the screen translates; the server never sends a sentence for these. */
export const TEAM_ERROR = {
  INVALID_TRANSITION: 'TEAM_INVALID_TRANSITION',
  STATUS_UNKNOWN: 'TEAM_STATUS_UNKNOWN',
  HAS_DATA: 'TEAM_HAS_DATA',
} as const;

/** One place that still refers to the team: a table, the column holding the team id, and how many rows. */
export interface TeamBlocker {
  table: string;
  column: string;
  count: number;
}

export interface TeamDeletionCheck {
  deletable: boolean;
  total: number;
  blockers: TeamBlocker[];
}

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

  /** Rows that still refer to the team, per table and column. Includes the cascading ones (members, grants), because
   * deleting those silently would be deleting people's data. The team's own settings (its permission configuration) are
   * not data about anybody: they do not block, and go with the team. */
  private async blockersOf(db: RawDb, id: string): Promise<TeamBlocker[]> {
    const blockers: TeamBlocker[] = [];
    for (const ref of await listTeamReferences(db)) {
      if (isTeamOwnSetting(ref)) continue;
      // The identifiers come from the catalogue and are quoted; the team id is always a bound parameter.
      const rows = await db.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM ${quoteIdent(ref.table)} WHERE ${quoteIdent(ref.column)} = $1`,
        id,
      );
      const count = Number(rows[0]?.n ?? 0);
      if (count > 0) blockers.push({ table: ref.table, column: ref.column, count });
    }
    return blockers;
  }

  private summarise(blockers: TeamBlocker[]): TeamDeletionCheck {
    const total = blockers.reduce((sum, b) => sum + b.count, 0);
    return { deletable: total === 0, total, blockers };
  }

  /** What the delete confirmation shows. Read-only: it locks nothing, so the answer may be stale by the time of delete. */
  async deletionCheck(id: string): Promise<TeamDeletionCheck> {
    const team = await this.prisma.team.findUnique({ where: { id }, select: { id: true } });
    if (!team) throw new NotFoundException(`Team not found (id: ${id})`);
    return this.summarise(await this.blockersOf(this.prisma, id));
  }

  /**
   * Real delete, only for a team nothing refers to. The row is locked FOR UPDATE and the references are counted again
   * INSIDE the same transaction: a foreign-key check from a concurrent insert (a member added a moment ago) takes a
   * share lock on this row, so it either committed before the count (and is counted) or waits for this delete and then
   * fails against the missing row. The earlier preview cannot make that decision.
   */
  async deleteIfEmpty(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; name: string; code: string }[]>`
        SELECT id, name, code FROM teams WHERE id = ${id} FOR UPDATE`;
      const team = rows[0];
      if (!team) throw new NotFoundException(`Team not found (id: ${id})`);

      const check = this.summarise(await this.blockersOf(tx, id));
      if (!check.deletable) {
        // `details` is the slot of the error envelope the HTTP filter forwards to the client for the screen to translate.
        throw new ConflictException({ code: TEAM_ERROR.HAS_DATA, details: check.blockers });
      }
      await tx.team.delete({ where: { id } });
      return team;
    });

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_DELETED',
      subject: 'Team',
      subjectId: id,
      metadata: { name: deleted.name, code: deleted.code },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { success: true };
  }

  /**
   * One transition on a client or transaction the caller owns: validates it, writes `status` and the archive stamps.
   * The caller writes the audit row. Returns the state the team was in, or null when it already had the asked state.
   */
  async applyStatus(
    db: Pick<PrismaService, 'team'>,
    id: string,
    to: TeamStatus,
    actorId: string,
  ): Promise<{ from: TeamStatus; name: string; team: Awaited<ReturnType<PrismaService['team']['update']>> } | null> {
    if (!Object.values(TeamStatus).includes(to)) {
      throw new ConflictException({ code: TEAM_ERROR.STATUS_UNKNOWN });
    }
    const team = await db.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException(`Team not found (id: ${id})`);

    const from = team.status;
    if (from === to) return null;
    if (!ALLOWED[from].includes(to)) {
      throw new ConflictException({ code: TEAM_ERROR.INVALID_TRANSITION, from, to });
    }

    const archiving = to === 'ARCHIVED';
    const updated = await db.team.update({
      where: { id },
      data: {
        status: to,
        archivedAt: archiving ? new Date() : null,
        archivedById: archiving ? actorId : null,
      },
    });
    return { from, name: team.name, team: updated };
  }

  async setStatus(
    id: string,
    to: TeamStatus,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Lock the row, then read and write under that lock: a stale read could otherwise overwrite what a merge (which
    // archives the source) has just committed, skipping the transition rules.
    const applied = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM teams WHERE id = ${id} FOR UPDATE`;
      return this.applyStatus(tx, id, to, actorId);
    });
    if (!applied) {
      // Already in the asked state: nothing changes and nothing is audited.
      const current = await this.prisma.team.findUnique({ where: { id } });
      return current;
    }
    await this.audit.log({
      userId: actorId,
      action: auditAction(applied.from, to),
      subject: 'Team',
      subjectId: id,
      metadata: { name: applied.name, from: applied.from, to },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return applied.team;
  }
}
