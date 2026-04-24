import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamsService } from '../../teams/teams.service';
import { AccessLevel } from '@prisma/client';

export interface DataScope {
  teamIds: string[];        // All readable teams (own + READ grants + WRITE grants)
  userIds: string[];
  writableTeamIds: string[]; // Writable teams (own + WRITE grants only) — GAP-9
}

@Injectable()
export class UnitScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) {}

  /**
   * Resolve the data scope for a user based on their role and team memberships.
   * ADMIN role returns null (full access).
   *
   * GAP-9 fix: READ grants expand read scope only; WRITE grants expand both
   * read and write scope. writableTeamIds is used by services to gate mutations.
   */
  async resolveScope(
    userId: string,
    roleName: string,
  ): Promise<DataScope | null> {
    // Admin bypasses all scope restrictions
    if (roleName === 'ADMIN') return null;

    // Get user's team memberships
    const userTeams = await this.prisma.userTeam.findMany({
      where: { userId },
      include: { team: true },
    });

    const ownTeamIds: string[] = [];

    for (const ut of userTeams) {
      ownTeamIds.push(ut.teamId);

      // Expand to all descendants regardless of level
      const descendants = await this.teamsService.getDescendantIds(ut.teamId);
      ownTeamIds.push(...descendants);
    }

    // Add teams from DataAccessGrants (active, not expired).
    // READ grants: read scope only. WRITE grants: read + write scope.
    const grants = await this.prisma.dataAccessGrant.findMany({
      where: {
        granteeId: userId,
        team: { isActive: true },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { teamId: true, accessLevel: true },
    });

    const readOnlyGrantTeamIds: string[] = [];
    const writeGrantTeamIds: string[] = [];

    for (const grant of grants) {
      if (grant.accessLevel === AccessLevel.WRITE) {
        writeGrantTeamIds.push(grant.teamId);
      } else {
        readOnlyGrantTeamIds.push(grant.teamId);
      }
    }

    // All readable teams = own + READ grants + WRITE grants
    const allReadTeamIds = [
      ...new Set([...ownTeamIds, ...readOnlyGrantTeamIds, ...writeGrantTeamIds]),
    ];
    // All writable teams = own + WRITE grants only (READ grants cannot write)
    const allWriteTeamIds = [...new Set([...ownTeamIds, ...writeGrantTeamIds])];

    // Get user IDs for all readable teams
    const userIds = await this.teamsService.getUserIdsForTeams(allReadTeamIds);

    // Always include the user themselves
    if (!userIds.includes(userId)) {
      userIds.push(userId);
    }

    return {
      teamIds: allReadTeamIds,
      userIds,
      writableTeamIds: allWriteTeamIds,
    };
  }
}
