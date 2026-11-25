import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_CHARGE_AUDIT, WARD_CHARGE_ERROR, WARD_TEAM_LEVEL } from './team-ward-charges.codes';

type Tx = Prisma.TransactionClient;
type Meta = { ipAddress?: string; userAgent?: string };

/** One ward charged to a team other than the one being saved: what the 409 lists, one entry per ward. */
export interface WardChargeConflict {
  wardId: string;
  wardName: string;
  teamId: string;
  teamName: string;
}

/** The most wards one request may name (the city has 168). */
const MAX_WARDS = 1000;

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === 'P2002';

/** A ward is usable when it is a WARD row of the directory that is active and not abolished. */
const usableWard = (w: { type: string; isActive: boolean; abolishedAt: Date | null }) =>
  w.type === 'WARD' && w.isActive && w.abolishedAt === null;

/**
 * Which PC02 team is in charge of which ward ("Phường/xã phụ trách").
 *
 * The table is keyed by the WARD directory row (`wardDirectoryId` UNIQUE): one ward has at most one manager, whichever
 * ward teams point at it. The screen offers ward TEAMS (level 2 with a ward) and sends their `wardId`.
 *
 * The only writer of `team_ward_charges` besides the merge (which moves a merged team's charges to the target).
 */
@Injectable()
export class TeamWardChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The active ward teams the picker offers, each with the team now in charge of its ward. Sorted by name. */
  async choices() {
    const teams = await this.prisma.team.findMany({
      where: { status: 'ACTIVE', level: WARD_TEAM_LEVEL, wardId: { not: null } },
      select: {
        id: true,
        name: true,
        wardId: true,
        ward: { select: { wardCharge: { select: { managerTeam: { select: { id: true, name: true } } } } } },
      },
    });
    return teams
      .map((t) => ({ teamId: t.id, name: t.name, wardId: t.wardId as string, managerTeam: t.ward?.wardCharge?.managerTeam ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  /** The wards this team is in charge of, with the (first active) ward team of each ward. */
  async listFor(teamId: string, db: Tx | PrismaService = this.prisma) {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) throw new NotFoundException(`Team not found (id: ${teamId})`);
    const rows = await db.teamWardCharge.findMany({
      where: { managerTeamId: teamId },
      select: {
        wardDirectoryId: true,
        ward: {
          select: {
            name: true,
            teams: {
              where: { status: 'ACTIVE', level: WARD_TEAM_LEVEL },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
    return rows
      .map((r) => ({
        wardId: r.wardDirectoryId,
        wardName: r.ward.name,
        wardTeamId: r.ward.teams[0]?.id ?? null,
        wardTeamName: r.ward.teams[0]?.name ?? null,
      }))
      .sort((a, b) => (a.wardTeamName ?? a.wardName).localeCompare(b.wardTeamName ?? b.wardName, 'vi'));
  }

  /**
   * The team's set becomes exactly `wardIds`, in one transaction. A ward in charge of ANOTHER team is refused (409
   * listing every such ward); the UNIQUE ward key decides between two admins saving at the same moment, and its
   * violation is answered with the same 409.
   */
  async replace(teamId: string, body: unknown, actorId: string, meta?: Meta) {
    const wardIds = checkedWardIds(body);
    let result: { added: string[]; removed: string[] };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await this.lockManager(tx, teamId);
        await assertUsableWards(tx, wardIds);
        const conflicts = await conflictsOf(tx, wardIds, [teamId]);
        if (conflicts.length) throw new ConflictException({ code: WARD_CHARGE_ERROR.ALREADY_CHARGED, details: conflicts });

        const current = await tx.teamWardCharge.findMany({ where: { managerTeamId: teamId }, select: { wardDirectoryId: true } });
        const have = new Set(current.map((c) => c.wardDirectoryId));
        const want = new Set(wardIds);
        const removed = [...have].filter((id) => !want.has(id));
        const added = wardIds.filter((id) => !have.has(id));
        if (removed.length) await tx.teamWardCharge.deleteMany({ where: { managerTeamId: teamId, wardDirectoryId: { in: removed } } });
        if (added.length) {
          await tx.teamWardCharge.createMany({ data: added.map((wardDirectoryId) => ({ wardDirectoryId, managerTeamId: teamId, createdById: actorId })) });
        }
        return { added, removed };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Another save took one of these wards between our check and our insert: name it, as the check would have.
        throw new ConflictException({ code: WARD_CHARGE_ERROR.ALREADY_CHARGED, details: await conflictsOf(this.prisma, wardIds, [teamId]) });
      }
      throw error;
    }

    if (result.added.length || result.removed.length) {
      await this.audit.log({
        userId: actorId,
        action: WARD_CHARGE_AUDIT.REPLACED,
        subject: 'Team',
        subjectId: teamId,
        metadata: { added: result.added, removed: result.removed, total: wardIds.length },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
    }
    return this.listFor(teamId);
  }

  /** The team row, locked: it must be an ACTIVE team that is not a ward unit. */
  async lockManager(tx: Tx, teamId: string) {
    const rows = await tx.$queryRaw<{ id: string; status: string; wardId: string | null }[]>`
      SELECT id, status::text AS status, "wardId" FROM teams WHERE id = ${teamId} FOR UPDATE`;
    const team = rows[0];
    if (!team) throw new NotFoundException(`Team not found (id: ${teamId})`);
    if (team.status !== 'ACTIVE' || team.wardId !== null) {
      throw new ConflictException({ code: WARD_CHARGE_ERROR.MANAGER_INVALID, details: [{ teamId }] });
    }
  }
}

/** `{ wardIds: string[] }`, de-duplicated, order kept. */
function checkedWardIds(body: unknown): string[] {
  const raw = (body as { wardIds?: unknown } | null)?.wardIds;
  if (!Array.isArray(raw) || raw.length > MAX_WARDS || raw.some((x) => typeof x !== 'string' || !x.trim() || x.length > 64)) {
    throw new BadRequestException({ code: WARD_CHARGE_ERROR.BODY_INVALID });
  }
  return [...new Set((raw as string[]).map((x) => x.trim()))];
}

/** Every id must be an active WARD of the directory; the 400 lists those that are not. */
export async function assertUsableWards(db: Tx | PrismaService, wardIds: readonly string[]): Promise<void> {
  if (!wardIds.length) return;
  const rows = await db.directory.findMany({
    where: { id: { in: [...wardIds] } },
    select: { id: true, type: true, isActive: true, abolishedAt: true },
  });
  const ok = new Set(rows.filter(usableWard).map((r) => r.id));
  const bad = wardIds.filter((id) => !ok.has(id));
  if (bad.length) throw new BadRequestException({ code: WARD_CHARGE_ERROR.WARD_INVALID, details: bad.map((wardId) => ({ wardId })) });
}

/** The wards among `wardIds` in charge of a team outside `allowedTeamIds`, sorted by ward name. */
export async function conflictsOf(
  db: Tx | PrismaService,
  wardIds: readonly string[],
  allowedTeamIds: readonly string[],
): Promise<WardChargeConflict[]> {
  if (!wardIds.length) return [];
  const rows = await db.teamWardCharge.findMany({
    where: { wardDirectoryId: { in: [...wardIds] }, managerTeamId: { notIn: [...allowedTeamIds] } },
    select: { wardDirectoryId: true, ward: { select: { name: true } }, managerTeam: { select: { id: true, name: true } } },
  });
  return rows
    .map((r) => ({ wardId: r.wardDirectoryId, wardName: r.ward.name, teamId: r.managerTeam.id, teamName: r.managerTeam.name }))
    .sort((a, b) => a.wardName.localeCompare(b.wardName, 'vi'));
}

/**
 * The name of the PC02 team in charge of the ward of a ward unit (the request slip's closing item), or null: the
 * ward unit has no ward, or nobody is in charge of it.
 */
export async function chargeTeamNameOf(db: Tx | PrismaService, wardTeamId: string): Promise<string | null> {
  const team = await db.team.findUnique({
    where: { id: wardTeamId },
    select: { ward: { select: { wardCharge: { select: { managerTeam: { select: { name: true } } } } } } },
  });
  return team?.ward?.wardCharge?.managerTeam.name ?? null;
}
