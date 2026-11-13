import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

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

/** Anything that can run the two raw queries below: the client itself, or a transaction. */
interface RawDb {
  $queryRaw: PrismaService['$queryRaw'];
  $queryRawUnsafe: PrismaService['$queryRawUnsafe'];
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

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

  /**
   * Every table and column that refers to `teams`, read from the database catalogue instead of a list kept by hand:
   * a relation added later (a permission table, a report table) is covered the day it is created. Includes the cascading
   * ones (members, grants), because deleting those silently would be deleting people's data.
   */
  private async blockersOf(db: RawDb, id: string): Promise<TeamBlocker[]> {
    const refs = await db.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'teams'::regclass
      ORDER BY 1, 2`;
    const blockers: TeamBlocker[] = [];
    for (const ref of refs) {
      // The identifiers come from the catalogue and are quoted; the team id is always a bound parameter.
      const table = ref.table_name.startsWith('"') ? ref.table_name : quoteIdent(ref.table_name);
      const rows = await db.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM ${table} WHERE ${quoteIdent(ref.column_name)} = $1`,
        id,
      );
      const count = Number(rows[0]?.n ?? 0);
      if (count > 0) blockers.push({ table: ref.table_name.replace(/^"|"$/g, ''), column: ref.column_name, count });
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
